/*******************************************************************************
 * @license
 * Copyright (c) 2011 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/
/*global window define orion */
/*browser:true*/

define(["require", "dojo", "orion/util", "orion/commands", "orion/extensionCommands", "orion/widgets/NewItemDialog", "orion/widgets/DirectoryPrompterDialog", 'orion/widgets/ImportDialog', 'orion/widgets/SFTPConnectionDialog'],
	function(require, dojo, mUtil, mCommands, mExtensionCommands){

	/**
	 * Utility methods
	 * @class This class contains static utility methods for creating and managing commands 
	 * related to file management.
	 * @name orion.fileCommands
	 */
	var fileCommandUtils = {};

	var favoritesCache = null;
	
	var lastItemLoaded = {Location: null};

	// I'm not sure where this belongs.  This is the first time an outer party consumes
	// favorites and understands the structure.  We need a cache for synchronous requests
	// for move/copy targets.
	function FavoriteFoldersCache(registry) {
		this.registry = registry;
		this.favorites = [];
		var self = this;
		var service = this.registry.getService("orion.core.favorite");
		service.getFavorites().then(function(favs) {
			self.cacheFavorites(favs.navigator);
		});
		service.addEventListener("favoritesChanged", function(favs) {
			self.cacheFavorites(favs.navigator);
		});
	}
	FavoriteFoldersCache.prototype = {
		cacheFavorites: function(faves) {
			this.favorites = [];
			for (var i=0; i<faves.length; i++) {
				if (faves[i].directory) {
					this.favorites.push(faves[i]);
				}
			}
			this.favorites.sort(function(a,b) {
				if (a < b) {
					return -1;
				}
				if (a > b) {
					return 1;
				}
				return 0;
			});
		}
	};
	FavoriteFoldersCache.prototype.constructor = FavoriteFoldersCache;

	/**
	 * Updates the explorer tool bar
	 * @name orion.fileCommands#updateNavTools
	 * @function
	 */
	fileCommandUtils.updateNavTools = function(registry, explorer, toolbarId, selectionToolbarId, item) {
		var toolbar = dojo.byId(toolbarId);
		if (toolbar) {
			dojo.empty(toolbar);
		} else {
			throw "could not find toolbar " + toolbarId;
		}
		var service = registry.getService("orion.page.command");
		// close any open slideouts because if we are retargeting the command
		if (item.Location !== lastItemLoaded.Location) {
			service.closeParameterCollector();
			lastItemLoaded.Location = item.Location;
		}

		service.renderCommands(toolbar.id, toolbar, item, explorer, "button").then(function() {
			if (lastItemLoaded.Location) {
				service.processURL(window.location.href);
			}
		}); 
		if (selectionToolbarId) {
			var selectionTools = dojo.byId(selectionToolbarId);
			if (selectionTools) {
				dojo.empty(selectionToolbarId);
				service.renderCommands(selectionToolbarId, selectionToolbarId, null, explorer, "button"); 
			}
		}
		
		// Stuff we do only the first time
		if (!favoritesCache) {
			favoritesCache = new FavoriteFoldersCache(registry);
			var selectionService = registry.getService("orion.page.selection");
			selectionService.addEventListener("selectionChanged", function(singleSelection, selections) {
				var selectionTools = dojo.byId(selectionToolbarId);
				if (selectionTools) {
					dojo.empty(selectionTools);
					registry.getService("orion.page.command").renderCommands(selectionTools.id, selectionTools, selections, explorer, "button");
				}
			});
		}
	};

	/**
	 * Creates the commands related to file management.
	 * @param {orion.serviceregistry.ServiceRegistry} serviceRegistry The service registry to use when creating commands
	 * @param {orion.commands.CommandService} commandService The command service to get commands from
	 * @param {orion.explorer.Explorer} explorer The explorer view to add commands to
	 * @param {orion.fileClient.FileClient} fileClient The file system client that the commands should use
	 * @param {String} toolbarId The id of the toolbar to add commands to
	 * @name orion.fileCommands#createFileCommands
	 * @function
	 */
	fileCommandUtils.createFileCommands = function(serviceRegistry, commandService, explorer, fileClient, toolbarId) {
		var progress = serviceRegistry.getService("orion.page.progress");
		var errorHandler = function(error) {
			progress.setProgressResult(error);
		};
		
		function forceSingleItem(item) {
			if (dojo.isArray(item)) {
				if (item.length > 1) {
					item = {};
				} else {
					item = item[0];
				}
			}
			return item;
		}
		
		function contains(arr, item) {
			for (var i=0; i<arr.length; i++) {
				if (arr[i] === item) {
					return true;
				}
			}
			return false;
		}
		
		function stripPath(location) {
			location = mUtil.makeRelative(location);
			// get hash part and strip query off
			var splits = location.split('#');
			var path = splits[splits.length-1];
			var qIndex = path.indexOf("/?");
			if (qIndex > 0) {
				//remove the query but not the trailing separator
				path = path.substring(0, qIndex+1);
			}
			return path;
		}
		
		function makeMoveCopyTargetChoices(items, userData, isCopy) {
			items = dojo.isArray(items) ? items : [items];
			var refreshFunc = function() {
				this.changedItem(this.treeRoot);
			};
			var callback = function(selectedItems) {
				if (!dojo.isArray(selectedItems)) {
					selectedItems = [selectedItems];
				}
				for (var i=0; i < selectedItems.length; i++) {
					var item = selectedItems[i];
					var func = isCopy ? fileClient.copyFile : fileClient.moveFile;
					func.apply(fileClient, [item.Location, this.path]).then(
						dojo.hitch(explorer, refreshFunc), //refresh the root
						errorHandler
					);
				}
			};
			
			var prompt = function(selectedItems) {
				var dialog = new orion.widgets.DirectoryPrompterDialog({
					title: "Choose a Folder",
					serviceRegistry: serviceRegistry,
					fileClient: fileClient,				
					func: function(targetFolder) { 
						if (targetFolder && targetFolder.Location) {
							if (!dojo.isArray(selectedItems)) {
								selectedItems = [selectedItems];
							}
							for (var i=0; i < selectedItems.length; i++) {
								var location = targetFolder.Location;
								var newName; // intentionally undefined.  Only use if we need.
								var item = selectedItems[i];
								var func = isCopy ? fileClient.copyFile : fileClient.moveFile;
								if (isCopy && item.parent && item.parent.Location === location) {
									newName = window.prompt("Enter a new name for '" + item.Name+ "'", "Copy of " + item.Name);
									// user cancelled?  don't copy this one
									if (!newName) {
										location = null;
									}
								}
								if (location) {
									func.apply(fileClient, [item.Location, targetFolder.Location, newName]).then(
										dojo.hitch(explorer, refreshFunc), //refresh the root
										errorHandler
									);
								}
							}
						}
					}
				});
				dialog.startup();
				dialog.show();
			};
			
			// Remember all source paths so we do not propose to move/copy a source to its own location
			var sourceLocations = [];
			for (var i=0; i<items.length; i++) {
				// moving or copying to the parent location is a no-op (we don't support rename or copy with rename from this menu)
				if (items[i].parent && items[i].parent.Location ) {
					items[i].parent.stripped = items[i].parent.stripped || stripPath(items[i].parent.Location);
					if (!contains(sourceLocations, items[i].parent.stripped)) {
						sourceLocations.push(items[i].parent.stripped);
					}
				}
				// moving a directory into itself is not supported
				if (items[i].Directory && !isCopy) {
					items[i].stripped = items[i].stripped || stripPath(items[i].Location);
					sourceLocations.push(items[i].stripped);
				}
			}
	
			var choices = [];
			// Propose any favorite that is not already a sourceLocation
			if (favoritesCache) {
				var favorites = favoritesCache.favorites;
				for (i=0; i<favorites.length; i++) {
					var stripped = stripPath(favorites[i].path);
					if (!contains(sourceLocations, stripped)) {
						choices.push({name: favorites[i].name, imageClass: "core-sprite-makeFavorite", path: stripped, callback: callback});
					}
				}
				if (favorites.length > 0) {
					choices.push({});  //separator
				}
			}
			var proposedPaths = [];
			// All children of the root that are folders should be available for choosing.
			var topLevel = explorer.treeRoot.Children;
			for (i=0; i<topLevel.length; i++) {
				var child = topLevel[i];
				child.stripped = child.stripped || (child.Directory ? stripPath(child.Location) : null);
				if (child.stripped && !contains(sourceLocations, child.stripped)) {
					proposedPaths.push(child);
				}
			}
			// sort the choices
			proposedPaths.sort(function(a,b) {
				if (a.stripped < b.stripped) {
					return -1;
				}
				if (a.stripped > b.stripped) {
					return 1;
				}
				return 0;
			});
			// now add them
			for (i=0; i<proposedPaths.length; i++) {
				var item = proposedPaths[i];
				var displayPath = item.Name;
				// we know we've left leading and trailing slash so slashes is splits + 1
				var slashes = item.stripped.split('/').length + 1;
				// but don't indent for leading or trailing slash
				// TODO is there a smarter way to do this?
				for (var j=0; j<slashes-2; j++) {
					displayPath = "  " + displayPath;
				}
				choices.push({name: displayPath, path: item.stripped, callback: callback});
			}
			if (proposedPaths.length > 0) {
				choices.push({});  //separator
			}
			choices.push({name: "Choose folder...", callback: prompt});
			return choices;
		}
		
		var oneOrMoreFilesOrFolders = function(item) {
			var items = dojo.isArray(item) ? item : [item];
			if (items.length === 0) {
				return false;
			}
			for (var i=0; i < items.length; i++) {
				if (!items[i].Location) {
					return false;
				}
			}
			return true;
		};
			
		var renameCommand = new mCommands.Command({
				name: "Rename",
				tooltip: "Rename the selected files or folders",
				imageClass: "core-sprite-rename",
				id: "eclipse.renameResource",
				visibleWhen: function(item) {
					item = forceSingleItem(item);
					return item.Location;
				},
				callback: dojo.hitch(this, function(data) {
					// we want to popup the edit box over the name in the explorer.
					// if we can't find it, we'll pop it up over the command dom element.
					var item = data.items;
					var refNode = explorer.getNameNode(item);
					if (!refNode) {
						refNode = data.domNode;
					}
					mUtil.getUserText(refNode.id+"EditBox", refNode, true, item.Name, 
						dojo.hitch(this, function(newText) {
							fileClient.moveFile(item.Location, item.parent.Location, newText).then(
								dojo.hitch(explorer, function() {this.changedItem(this.treeRoot);}), //refresh the root
								errorHandler
							);
						}), 
						null, null, "."
					); 
				})
			});
		commandService.addCommand(renameCommand);
		
		var deleteCommand = new mCommands.Command({
			name: "Delete",
			tooltip: "Delete the selected files or folders",
			imageClass: "core-sprite-delete",
			id: "eclipse.deleteFile",
			visibleWhen: oneOrMoreFilesOrFolders,
			callback: function(data) {
				var items = dojo.isArray(data.items) ? data.items : [data.items];
				var confirmMessage = items.length === 1 ? "Are you sure you want to delete '" + items[0].Name + "'?" : "Are you sure you want to delete these " + items.length + " items?";
				serviceRegistry.getService("orion.page.dialog").confirm(confirmMessage, 
					dojo.hitch(explorer, function(doit) {
						if (!doit) {
							return;
						}
						var count = 0;
						var refresher = function(item) {
							count++;
							if (count === items.length) {
								explorer.changedItem(item);
							}
						};
						for (var i=0; i < items.length; i++) {
							var item = items[i];
							var deleteLocation = item.Location;
							var refreshItem = item.parent;
							if (item.parent.Projects) {
								//special case for deleting a project. We want to remove the 
								//project rather than delete the project's content
								refreshItem = this.treeRoot;
								deleteLocation = null;
								for (var p=0; p < item.parent.Projects.length; p++) {
									var project = item.parent.Projects[p];
									if (project.Id === item.Id) {
										deleteLocation = project.Location;
										break;
									}
								}
							}
							if (deleteLocation) {
								fileClient.deleteFile(deleteLocation).then(function() {
									refresher(refreshItem);
								}, function(error) {
									errorHandler(error);
									refresher(refreshItem);
								});
							}
						}
					})
				);	
			}});
		commandService.addCommand(deleteCommand);
	
		var downloadCommand = new mCommands.Command({
			name: "Export as zip",
			tooltip: "Create a zip file of the folder contents and download it",
			imageClass: "core-sprite-exportzip",
			id: "eclipse.downloadFile",
			visibleWhen: function(item) {
				item = forceSingleItem(item);
				return item.ExportLocation && item.Directory;},
			hrefCallback: function(data) {
				return forceSingleItem(data.items).ExportLocation;
			}});
		commandService.addCommand(downloadCommand);
		
		function getNewItemName(item, domId, defaultName, onDone) {
			var refNode, name, tempNode;
			if (item.Location === explorer.treeRoot.Location) {
				refNode = dojo.byId(domId);
			} else {
				var nodes = explorer.makeNewItemPlaceHolder(item, domId);
				if (nodes) {
					refNode = nodes.refNode;
					tempNode = nodes.tempNode;
				} else {
					refNode = dojo.byId(domId);
				}
			}
			if (refNode) {
				mUtil.getUserText(domId+"EditBox", refNode, false, defaultName, 
					dojo.hitch(this, function(name) {
						if (name) {
							if (tempNode) {
								tempNode.parentNode.removeChild(tempNode);
							}
							onDone(name);
						}
					})); 
			} else {
				name = window.prompt(defaultName);
				if (name) {
					onDone(name);
				}
			}
		}
		
		var newFileNameParameters = new mCommands.ParametersDescription([new mCommands.CommandParameter('name', 'text', 'Name:', 'New File')]);
		
		var newFileCommand =  new mCommands.Command({
			name: "New File",
			tooltip: "Create a new file",
			imageClass: "core-sprite-new_file",
			id: "eclipse.newFile",
			parameters: newFileNameParameters,
			callback: function(data) {
				var item = forceSingleItem(data.items);
				var createFunction = function(name) {
					if (name) {
						fileClient.createFile(item.Location, name).then(
							dojo.hitch(explorer, function() {this.changedItem(item);}),
							errorHandler);
					}
				};
				if (data.parameters && data.parameters.valueFor('name')) {
					createFunction(data.parameters.valueFor('name'));
				} else {
					getNewItemName(item, data.domNode.id, "New File", createFunction);
				}
			},
			visibleWhen: function(item) {
				item = forceSingleItem(item);
				return item.Directory && !mUtil.isAtRoot(item.Location);}});
		commandService.addCommand(newFileCommand);
		
		var newFolderNameParameters = new mCommands.ParametersDescription([new mCommands.CommandParameter('name', 'text', 'Name:', 'New Folder')]);

		var newFolderCommand = new mCommands.Command({
			name: "New Folder",
			tooltip: "Create a new folder",
			imageClass: "core-sprite-new_folder",
			id: "eclipse.newFolder",
			parameters: newFolderNameParameters,
			callback: function(data) {
				var item = forceSingleItem(data.items);
				var createFunction = function(name) {
					if (name) {
						fileClient.createFolder(item.Location, name).then(
							dojo.hitch(explorer, function() {this.changedItem(item);}),
							errorHandler);
					}
				};
				if (data.parameters && data.parameters.valueFor('name')) {
					createFunction(data.parameters.valueFor('name'));
				} else {
					getNewItemName(item, data.domNode.id, "New Folder", createFunction);
				}
			},
			visibleWhen: function(item) {
				item = forceSingleItem(item);
				return item.Directory && !mUtil.isAtRoot(item.Location);}});
	
		commandService.addCommand(newFolderCommand);
		
		var newProjectCommand = new mCommands.Command({
			name: "New Folder",
			parameters: newFolderNameParameters,
			tooltip: "Create a new folder",
			imageClass: "core-sprite-new_folder",
			id: "eclipse.newProject",
			callback: function(data) {
				var createFunction = function(name) {
					if (name) {
						fileClient.createProject(explorer.treeRoot.ChildrenLocation, name).then(
							dojo.hitch(explorer, function() {this.loadResourceList(this.treeRoot.Path, true);}), // refresh the root
							errorHandler);
					}
				};
				if (data.parameters && data.parameters.valueFor('name')) {
					createFunction(data.parameters.valueFor('name'));
				} else {
					getNewItemName(data.items, data.domNode.id, "New Folder", createFunction);
				}
			},
			visibleWhen: function(item) {
				item = forceSingleItem(item);
				return item.Location && mUtil.isAtRoot(item.Location);}});
	
		commandService.addCommand(newProjectCommand);
		
		var linkProjectCommand = new mCommands.Command({
			name: "Link Folder",
			tooltip: "Create a folder that links to an existing folder on the server",
			imageClass: "core-sprite-link",
			id: "eclipse.linkProject",
			callback: function(data) {
				var dialog = new orion.widgets.NewItemDialog({
					title: "Link Folder",
					label: "Folder name:",
					func:  function(name, url, create){
						fileClient.createProject(explorer.treeRoot.ChildrenLocation, name, url, create).then(
							dojo.hitch(explorer, function() {this.loadResourceList(this.treeRoot.Path, true);}), //refresh the root
							errorHandler);
					},
					advanced: true
				});
				dialog.startup();
				dialog.show();
			},
			visibleWhen: function(item) {
				item = forceSingleItem(item);
				return item.Location && mUtil.isAtRoot(item.Location);}});
		commandService.addCommand(linkProjectCommand);
		
		var goUpCommand = new mCommands.Command({
			name: "Go Up",
			tooltip: "Move up to the parent folder",
			imageClass: "core-sprite-move_up",
			id: "eclipse.upFolder",
			callback: function(data) {
				var item = forceSingleItem(data.items);
				var parents = item.Parents;
				if (parents) {
					if (parents.length > 0) {
						window.document.location="#" + parents[0].ChildrenLocation;
					} else {
						// move to file system root
						window.document.location="#";
					}
				}
			},
			visibleWhen: function(item) {
				item = forceSingleItem(item);
				return item.Parents;}});
		commandService.addCommand(goUpCommand);

					
		var importCommand = new mCommands.Command({
			name : "Import from zip...",
			tooltip: "Copy files and folders contained in a local zip file",
			imageClass: "core-sprite-importzip",
			id: "eclipse.importCommand",
			callback : function(data) {
				var item = forceSingleItem(data.items);
				var dialog = new orion.widgets.ImportDialog({
					importLocation: item.ImportLocation,
					func: dojo.hitch(explorer, function() { this.changedItem(item); })
				});
				dialog.startup();
				dialog.show();
			},
			visibleWhen: function(item) {
				item = forceSingleItem(item);
				return item.Directory && !mUtil.isAtRoot(item.Location);}});
		commandService.addCommand(importCommand);
	
		var importSFTPCommand = new mCommands.Command({
			name : "SFTP from...",
			tooltip: "Copy files and folders from a specified SFTP connection",
			imageClass: "core-sprite-transferin",
			id: "eclipse.importSFTPCommand",
			callback : function(data) {
				var item = forceSingleItem(data.items);
				var dialog = new orion.widgets.SFTPConnectionDialog({
					func:  function(host,path,user,password, overwriteOptions){
						var optionHeader = overwriteOptions ? "sftp,"+overwriteOptions : "sftp";
						var importOptions = {"OptionHeader":optionHeader,"Host":host,"Path":path,"UserName":user,"Passphrase":password};
						var deferred = fileClient.remoteImport(item.ImportLocation, importOptions);
						progress.showWhile(deferred, "Importing from " + host).then(
							dojo.hitch(explorer, function() {
								this.changedItem(this.treeRoot);
							}),
							errorHandler
						);//refresh the root
					}
				});
				dialog.startup();
				dialog.show();
			},
			visibleWhen: function(item) {
				item = forceSingleItem(item);
				return item.Directory && !mUtil.isAtRoot(item.Location);}});
		commandService.addCommand(importSFTPCommand);
	
		var exportSFTPCommand = new mCommands.Command({
			name : "SFTP to...",
			tooltip: "Copy files and folders to a specified SFTP location",
			imageClass: "core-sprite-transferout",
			id: "eclipse.exportSFTPCommand",
			callback : function(data) {
				var item = forceSingleItem(data.items);
				var dialog = new orion.widgets.SFTPConnectionDialog({
					func:  function(host,path,user,password, overwriteOptions){
						var optionHeader = overwriteOptions ? "sftp,"+overwriteOptions : "sftp";
						var exportOptions = {"OptionHeader":optionHeader,"Host":host,"Path":path,"UserName":user,"Passphrase":password};
						var deferred = fileClient.remoteExport(item.ExportLocation, exportOptions);
						progress.showWhile(deferred, "Exporting from " + host).then(
							dojo.hitch(explorer, function() {this.changedItem(this.treeRoot);}),
							errorHandler);//refresh the root
					}
				});
				dialog.startup();
				dialog.show();
			},
			visibleWhen: function(item) {
				item = forceSingleItem(item);
				return item.Directory && !mUtil.isAtRoot(item.Location);}});
		commandService.addCommand(exportSFTPCommand);
		
		var copyCommand = new mCommands.Command({
			name : "Copy to",
			tooltip: "Copy files and folders to a specified location",
			id: "eclipse.copyFile",
			choiceCallback: function(items, userData) {
				return makeMoveCopyTargetChoices(items, userData, true);
			},
			visibleWhen: oneOrMoreFilesOrFolders 
		});
		commandService.addCommand(copyCommand);
		
		var moveCommand = new mCommands.Command({
			name : "Move to",
			tooltip: "Move files and folders to a new location",
			id: "eclipse.moveFile",
			choiceCallback: function(items, userData) {
				return makeMoveCopyTargetChoices(items, userData, false);
			},
			visibleWhen: oneOrMoreFilesOrFolders
			});
		commandService.addCommand(moveCommand);
		
		var bufferedSelection = [];
		var copyToBufferCommand = new mCommands.Command({
				name: "Copy Items",
				tooltip: "Copy the selected items to the copy/paste buffer",
				id: "eclipse.copySelections",
				callback: function() {
					commandService.getSelectionService().getSelections(function(selections) {
						bufferedSelection = selections;
					});
				}
			});
		commandService.addCommand(copyToBufferCommand);
			
		var pasteFromBufferCommand = new mCommands.Command({
				name: "Paste Items",
				tooltip: "Paste items from the copy/paste buffer",
				id: "eclipse.pasteSelections",
				callback: function() {
					if (bufferedSelection.length > 0) {
						// Do not allow pasting into the Root of the Workspace
						if (mUtil.isAtRoot(this.treeRoot.Location)) {
							errorHandler("Cannot paste into the Workspace root");
							return;
						}
						for (var i=0; i<bufferedSelection.length; i++) {
							var location = bufferedSelection[i].Location;
							var name = null;
							if (location) {
								if (bufferedSelection[i].parent && bufferedSelection[i].parent.Location === explorer.treeRoot.Location) {
									name = window.prompt("Enter a new name for '" + bufferedSelection[i].Name+ "'", "Copy of " + bufferedSelection[i].Name);
									// user cancelled?  don't copy this one
									if (!name) {
										location = null;
									}
								}
								if (location) {
									fileClient.copyFile(location, explorer.treeRoot.Location, name).then(dojo.hitch(explorer, function() {
										this.changedItem(this.treeRoot);
									}), errorHandler);
								}
							}
						}
					}
				}
			});
		commandService.addCommand(pasteFromBufferCommand);
		
	};
	
	var contentTypesMapCache;

	fileCommandUtils.createAndPlaceFileCommandsExtension = function(serviceRegistry, commandService, explorer, toolbarId, selectionToolbarId, fileGroup, selectionGroup) {
		// Note that the shape of the "orion.navigate.command" extension is not in any shape or form that could be considered final.
		// We've included it to enable experimentation. Please provide feedback on IRC or bugzilla.
		
		// The shape of the contributed commands is (for now):
		// info - information about the command (object).
		//		required attribute: name - the name of the command
		//		required attribute: id - the id of the command
		//		optional attribute: tooltip - the tooltip to use for the command
		//        optional attribute: image - a URL to an image for the command
		//        optional attribute: href - if true, then the service returns an href when it runs
		//        optional attribute: forceSingleItem - if true, then the service is only invoked when a single item is selected
		//			and the item parameter to the run method is guaranteed to be a single item vs. an array.  When this is not true, 
		//			the item parameter to the run method may be an array of items.
		//        optional attribute: validationProperties - an object containing key/value pairs for validating the
		//          the resource metadata to determine whether the command is valid for the given resource.
		//          Wildcards are supported.  For example the validation property
		//				{"Git":"*", "Directory":"true"}
		//              specifies that the property "Git" must be present, and that the property "Directory" must be true.
		// run - the implementation of the command (function).
		//        arguments passed to run: (itemOrItems)
		//          itemOrItems (object or array) - an array of items to which the item applies, or a single item if the info.forceSingleItem is true
		//        the return value of the run function will be used as follows:
		//          if info.href is true, the return value should be an href and the window location will be replaced with the href
		//			if info.href is not true, the run function is assumed to perform all necessary action and the return is not used.
		var commandsReferences = serviceRegistry.getServiceReferences("orion.navigate.command");
		
		var fileCommands = [];
		var i;
		for (i=0; i<commandsReferences.length; i++) {
			// Exclude any navigation commands themselves, since we are the navigator.
			var id = commandsReferences[i].getProperty("id");
			if (id !== "orion.navigateFromFileMetadata") {
				var impl = serviceRegistry.getService(commandsReferences[i]);
				var info = {};
				var propertyNames = commandsReferences[i].getPropertyNames();
				for (var j = 0; j < propertyNames.length; j++) {
					info[propertyNames[j]] = commandsReferences[i].getProperty(propertyNames[j]);
				}
				fileCommands.push({properties: info, service: impl});
			}
		}
		
		function getContentTypesMap() {
			return contentTypesMapCache || serviceRegistry.getService("orion.core.contenttypes").getContentTypesMap().then(function(map) {
				contentTypesMapCache = map;
				return contentTypesMapCache;
			});
		}
		dojo.when(getContentTypesMap(), dojo.hitch(this, function() {
			fileCommands = fileCommands.concat(mExtensionCommands._createOpenWithCommands(serviceRegistry, contentTypesMapCache));
			var extensionGroupCreated = false;
			var selectionGroupCreated = false;
			var openWithGroupCreated = false;
		
			for (i=0; i < fileCommands.length; i++) {
				var commandInfo = fileCommands[i].properties;
				var service = fileCommands[i].service;
 				var commandOptions = mExtensionCommands._createCommandOptions(commandInfo, service, serviceRegistry, true);
				var command = new mCommands.Command(commandOptions);
				if (commandInfo.isEditor) {
					command.isEditor = commandInfo.isEditor;
				}
				
				if (commandInfo.forceSingleItem || commandInfo.href) {
					// single items go in the local actions column, grouped in their own unnamed group to get a separator
					commandService.addCommand(command);
					if (!extensionGroupCreated) {
						extensionGroupCreated = true;
						commandService.addCommandGroup("fileFolderCommands", "eclipse.fileCommandExtensions", 1000, null, fileGroup);
					}
					if (!openWithGroupCreated) {
						openWithGroupCreated = true;
						commandService.addCommandGroup("fileFolderCommands", "eclipse.openWith", 1000, "Open With", fileGroup + "/eclipse.fileCommandExtensions");
					}
					
					if (commandInfo.isEditor) {
						commandService.registerCommandContribution("fileFolderCommands", command.id, i, fileGroup + "/eclipse.fileCommandExtensions/eclipse.openWith");
					} else {
						commandService.registerCommandContribution("fileFolderCommands", command.id, i, fileGroup + "/eclipse.fileCommandExtensions");
					}
				} else {  
					// items based on selection are added to the selections toolbar, grouped in their own unnamed group to get a separator
					// TODO would we also want to add these to the menu above so that they are available for single selections?  
					// For now we do not do this to reduce clutter, but we may revisit this.
					commandService.addCommand(command);
					if (!selectionGroupCreated) {
						selectionGroupCreated = true;
						commandService.addCommandGroup(selectionToolbarId, "eclipse.bulkFileCommandExtensions", 1000, null, selectionGroup);
					}
					commandService.registerCommandContribution(selectionToolbarId, command.id, i, selectionGroup + "/eclipse.bulkFileCommandExtensions");
				}
				fileCommandUtils.updateNavTools(serviceRegistry, explorer, toolbarId, selectionToolbarId, explorer.treeRoot);
				explorer.updateCommands();
			}
		}));
	};
	
	return fileCommandUtils;
});
