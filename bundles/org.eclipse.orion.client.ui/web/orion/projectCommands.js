/*******************************************************************************
 * @license
 * Copyright (c) 2013 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/
/*global window define orion XMLHttpRequest confirm*/
/*jslint sub:true*/
define(['i18n!orion/navigate/nls/messages', 'orion/webui/littlelib', 'orion/commands', 'orion/Deferred', 'orion/webui/dialogs/DirectoryPrompterDialog', 'orion/commandRegistry', 'orion/i18nUtil'],
	function(messages, lib, mCommands, Deferred, DirectoryPrompterDialog, mCommandRegistry, i18nUtil){
		var projectCommandUtils = {};
		
		var selectionListenerAdded = false;
		
		var lastItemLoaded = {Location: null};
		
		var progress;
		
			
	function forceSingleItem(item) {
		if (!item) {
			return {};
		}
		if (Array.isArray(item)) {
			if (item.length === 1) {
				item = item[0];
			} else {
				item = {};
			}
		}
		return item;
	}
		
	/**
	 * Updates the explorer toolbar.
	 * @name orion.fileCommands#updateNavTools
	 * @function
	 * @param {orion.serviceregistry.ServiceRegistry} serviceRegistry
	 * @param {orion.commandregistry.CommandRegistry} commandRegistry
	 * @param {orion.explorer.Explorer} explorer
	 * @param {String} toolbarId Gives the scope for toolbar commands. Commands in this scope are rendered with the <code>item</code>
	 * parameter as their target.
	 * @param {String} [selectionToolbarId] Gives the scope for selection-based commands. Commands in this scope are rendered
	 * with current selection as their target.
	 * @param {Object} item The model item to render toolbar commands against.
	 * @param {Boolean} [rootSelection=false] If <code>true</code>, any selection-based commands will be rendered with the <code>explorer</code>'s 
	 * treeRoot as their target, when no selection has been made. If <code>false</code>, any selection-based commands will be inactive when no 
	 * selection has been made.
	 */
	projectCommandUtils.updateNavTools = function(registry, commandRegistry, explorer, toolbarId, selectionToolbarId, toolbarItem, rootSelection) {
		function updateSelectionTools(selectionService, item) {
			var selectionTools = lib.node(selectionToolbarId);
			if (selectionTools) {
				// Hacky: check for a local selection service of the selectionToolbarId, or the one associated with the commandRegistry
				var contributions = commandRegistry._contributionsByScopeId[selectionToolbarId];
				selectionService = selectionService || (contributions && contributions.localSelectionService) || commandRegistry.getSelectionService(); //$NON-NLS-0$
				if (contributions && selectionService) {
					Deferred.when(selectionService.getSelections(), function(selections) {
						commandRegistry.destroy(selectionTools);
						var isNoSelection = !selections || (Array.isArray(selections) && !selections.length);
						if (rootSelection && isNoSelection) {
							commandRegistry.renderCommands(selectionTools.id, selectionTools, item, explorer, "button");  //$NON-NLS-0$
						} else {
							commandRegistry.renderCommands(selectionTools.id, selectionTools, null, explorer, "button"); //$NON-NLS-1$ //$NON-NLS-0$
						}
					});
				}
			}
		}

		var toolbar = lib.node(toolbarId);
		if (toolbar) {
			commandRegistry.destroy(toolbar);
		} else {
			throw new Error("could not find toolbar " + toolbarId); //$NON-NLS-0$
		}
		// close any open slideouts because if we are retargeting the command
		if (toolbarItem.Location !== lastItemLoaded.Location) {
			commandRegistry.closeParameterCollector();
			lastItemLoaded.Location = toolbarItem.Location;
		}

		commandRegistry.renderCommands(toolbar.id, toolbar, toolbarItem, explorer, "button"); //$NON-NLS-0$
		if (lastItemLoaded.Location) {
			commandRegistry.processURL(window.location.href);
		} 
		if (selectionToolbarId) {
			updateSelectionTools(null, explorer.treeRoot);
		}

		// Attach selection listener once, keep forever
		if (!selectionListenerAdded) {
			selectionListenerAdded = true;
			var selectionService = registry.getService("orion.page.selection"); //$NON-NLS-0$
			selectionService.addEventListener("selectionChanged", function(event) { //$NON-NLS-0$
				updateSelectionTools(selectionService, explorer.treeRoot);
			});
		}
	};
		
	/**
	 * Creates the commands related to file management.
	 * @param {orion.serviceregistry.ServiceRegistry} serviceRegistry The service registry to use when creating commands
	 * @param {orion.commandregistry.CommandRegistry} commandRegistry The command registry to get commands from
	 * @param {orion.explorer.FileExplorer} explorer The explorer view to add commands to, and to update when model items change.
	 * To broadcast model change nodifications, this explorer must have a <code>modelEventDispatcher</code> field.
	 * @param {orion.EventTarget} [explorer.modelEventDispatcher] If supplied, this dispatcher will be invoked to dispatch events
	 * describing model changes that are performed by file commands.
	 * @param {orion.fileClient.FileClient} fileClient The file system client that the commands should use
	 * @name orion.fileCommands#createFileCommands
	 * @function
	 */
	projectCommandUtils.createProjectCommands = function(serviceRegistry, commandService, explorer, fileClient, projectClient) {
		progress = serviceRegistry.getService("orion.page.progress"); //$NON-NLS-0$
		var that = this;
		function errorHandler(error) {
			if (progress) {
				progress.setProgressResult(error);
			} else {
				window.console.log(error);
			}
		}
		
		var dependencyTypes = projectClient.getDependencyTypes();		
		
		var addFolderCommand = new mCommands.Command({
			name: "Add External Folder",
			tooltip: "Add an external folder from workspace",
			id: "orion.project.addFolder", //$NON-NLS-0$
			callback: function(data) {
				var item = forceSingleItem(data.items);
				
				var dialog = new DirectoryPrompterDialog.DirectoryPrompterDialog({ title : messages["Choose a Folder"],
					serviceRegistry : serviceRegistry,
					fileClient : fileClient,
					func : function(targetFolder) {
						fileClient.read(targetFolder.Location, true).then(function(fileMetadata){
						
							function addFileDependency(){
								var fileLocation = "";
								var name = fileMetadata.Name;
								if(fileMetadata.Parents && fileMetadata.Parents.length>0){
									for(var i=fileMetadata.Parents.length-1; i>=0; i--){
										fileLocation+=fileMetadata.Parents[i].Name;
										fileLocation+= "/";
									}
									name += " (" + fileMetadata.Parents[fileMetadata.Parents.length-1].Name + ")";
								}
								fileLocation+=fileMetadata.Name;
								projectClient.addProjectDependency(item, {Name: name, Type: "file", Location: fileLocation}).then(function(){
									explorer.changedItem();
								}, errorHandler);
							}
						
							if(!fileMetadata.Parents || fileMetadata.Parents.length===0){
								var otherTypesDefs = [];
								var isOtherDependency = false;
								for(var i=0; i<dependencyTypes.length; i++){
									if(isOtherDependency) {
										return;
									}
									var def = projectClient.getDependencyHandler(dependencyTypes[i]).getDependencyDescription(fileMetadata);
									otherTypesDefs.push(def);
									def.then(function(dependency){
										if(dependency){
											isOtherDependency = true;
											projectClient.addProjectDependency(item, dependency).then(function(){
												explorer.changedItem();
											}, errorHandler);
										}
									});
								}
								Deferred.all(otherTypesDefs).then(function(){
									if(!isOtherDependency){
										addFileDependency();
									}
								});
								return;
							}
							addFileDependency();
						}, errorHandler);
					}
				});
				
				dialog.show();
				
			},
			visibleWhen: function(item) {
				return item.type==="Project";
			}
		});
		commandService.addCommand(addFolderCommand);
		
		var initProjectCommand = new mCommands.Command({
			name: "Init Basic Project",
			tooltip: "Convert this folder into a project",
			id: "orion.project.initProject", //$NON-NLS-0$
			callback: function(data) {
				var item = forceSingleItem(data.items);
				var parentProject;
				if (item.Parents && item.Parents.length===0){
					parentProject = item;
				} else if(item.Parents){
					parentProject = item.Parents[item.Parents.length-1];
				}
				if(parentProject){
					projectClient.initProject(parentProject.Location).then(function(){
						fileClient.read(item.Location, true).then(function(fileMetadata){
							explorer.changedItem(fileMetadata);
						}, errorHandler);
					}, errorHandler);
				}
				
			},
			visibleWhen: function(item) {
				return item.type==="Folder";
			}
		});
		commandService.addCommand(initProjectCommand);
		
		function initDependency(handler, dependency, project, data, params){
			var actionComment;
			if(handler.actionComment){
				if(params){
					actionComment = handler.actionComment.replace(/\$\{([^\}]+)\}/g, function(str, key) {
						return params[key];
					});
				} else {
					actionComment = handler.actionComment;
				}
			} else {
				actionComment = "Getting content from "	+ handler.type;
			}
			progress.showWhile(handler.initDependency(dependency, params, project), actionComment).then(function(dependency){
				projectClient.addProjectDependency(project, dependency).then(function(){
						explorer.changedItem();
					}, errorHandler);
			}, function(error){
				if(error.retry && error.addParamethers){
					var paramDescps = [];
					for(var i=0; i<error.addParamethers.length; i++){
						paramDescps.push(new mCommandRegistry.CommandParameter(error.addParamethers[i].id, error.addParamethers[i].type, error.addParamethers[i].name));
					}
					data.parameters = new mCommandRegistry.ParametersDescription(paramDescps);
					data.oldParams = params;
					commandService.collectParameters(data);
				}
				errorHandler(error);
			});
		}
		
		function createAddDependencyCommand(type){
			var handler = projectClient.getDependencyHandler(type);
			
			var commandParams = {
				name: handler.name,
				id: "orion.project.adddependency." + type,
				tooltip: handler.tooltip,
				callback: function(data){
					var def = new Deferred();
					var item = forceSingleItem(data.items);
					var params = data.oldParams || {};
					for (var param in data.parameters.parameterTable) {
						params[param] = data.parameters.valueFor(param);
					}
					
					var searchLocallyDeferred = new Deferred();
					handler.paramsToDependencyDescription(params).then(function(dependency){
						fileClient.loadWorkspace(item.WorkspaceLocation).then(function(workspace){
							var checkdefs = [];
							var found = false;
							for(var i=0; i<workspace.Children.length; i++){
								if(found===true){
									break;
								}
								var def = handler.getDependencyDescription(workspace.Children[i]);
								checkdefs.push(def);
								(function(i, def){
									def.then(function(matches){
										if(matches && matches.Location === dependency.Location){
											found = true;
											searchLocallyDeferred.resolve(matches);
										}
									});
								})(i, def);
							}
							Deferred.all(checkdefs).then(function(){
								if(!found){
									searchLocallyDeferred.resolve();
								}
							});
						}, searchLocallyDeferred.reject);
					}, errorHandler);
					
					progress.showWhile(searchLocallyDeferred, "Searching your workspace for matching content").then(function(resp){
						if(resp) {
							projectClient.addProjectDependency(item, resp).then(function(){
								explorer.changedItem();
							}, errorHandler);
						} else {
							initDependency(handler, {}, item, data, params);
						}
					});

				},
				visibleWhen: function(item) {
					return item.type==="Project";
				}
			};
			
			if(handler.addParamethers){
				var paramDescps = [];
				for(var i=0; i<handler.addParamethers.length; i++){
					paramDescps.push(new mCommandRegistry.CommandParameter(handler.addParamethers[i].id, handler.addParamethers[i].type, handler.addParamethers[i].name));
				}
				commandParams.parameters = new mCommandRegistry.ParametersDescription(paramDescps);
			}
			
			
			var command = new mCommands.Command(commandParams);
			commandService.addCommand(command);
		}
		
			for(var type_no=0; type_no<dependencyTypes.length; type_no++){
				createAddDependencyCommand(dependencyTypes[type_no]);
			}
		
		var connectDependencyCommand = new mCommands.Command({
			name: "Connect",
			tooltip: "Fetch content",
			id: "orion.project.dependency.connect", //$NON-NLS-0$
			callback: function(data) {
				var item = forceSingleItem(data.items);
				var params = data.oldParams || {};
				if(data.parameters){
					for (var param in data.parameters.parameterTable) {
						params[param] = data.parameters.valueFor(param);
					}
				}
				initDependency(projectClient.getDependencyHandler(item.Dependency.Type), item.Dependency, item.Project, data, params);
				
			},
			visibleWhen: function(item) {
				if(!(item.Dependency && item.Project)){
					return false;	
				}
				for(var i=0; i<dependencyTypes.length; i++){
					if(dependencyTypes[i]===item.Dependency.Type){
						return true;	
					}
				}
				return false;
			}
		});
		commandService.addCommand(connectDependencyCommand);
		
				
		var disconnectDependencyCommand = new mCommands.Command({
			name: "Disconnect from project",
			tooltip: "Do not treat this folder as a part of the project",
			imageClass: "core-sprite-delete", //$NON-NLS-0$
			id: "orion.project.dependency.disconnect", //$NON-NLS-0$
			callback: function(data) {
				var item = forceSingleItem(data.items);
				progress.progress(projectClient.removeProjectDependency(item.Project, item.Dependency),
					i18nUtil.formatMessage("Removing ${0} from project ${1}", item.Dependency.Name, item.Project.Name)).then(function(resp){
						explorer.changedItem();
					});
			},
			visibleWhen: function(item) {
				if(!(item.Dependency && item.Project)){
					return false;	
				}
				return true;
			}
		});
		commandService.addCommand(disconnectDependencyCommand);
		
		};
	
		return projectCommandUtils;
});