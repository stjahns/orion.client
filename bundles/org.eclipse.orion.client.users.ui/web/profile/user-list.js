/*******************************************************************************
 * @license
 * Copyright (c) 2009, 2011 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/

define(['require', 'dojo', 'orion/bootstrap', 'orion/status', 'orion/progress', 'orion/operationsClient', 'orion/commands', 'orion/selection',
	        'orion/searchClient', 'orion/fileClient', 'orion/globalCommands', 'orion/profile/UsersList', 'orion/profile/usersUtil',
	        'dojo/parser', 'dojo/hash', 'dojo/date/locale', 'dijit/layout/BorderContainer', 'dijit/layout/ContentPane', 'orion/profile/widgets/NewUserDialog',
	        'orion/profile/widgets/ResetPasswordDialog'], 
			function(require, dojo, mBootstrap, mStatus, mProgress, mOperationsClient, mCommands, mSelection, mSearchClient, mFileClient, mGlobalCommands, mUsersList, mUsersUtil) {

	dojo.addOnLoad(function() {
		mBootstrap.startup().then(function(core) {
			var serviceRegistry = core.serviceRegistry;
			var preferences = core.preferences;
			document.body.style.visibility = "visible";
			dojo.parser.parse();
		
			var commandService = new mCommands.CommandService({serviceRegistry: serviceRegistry});
			var fileClient = new mFileClient.FileClient(serviceRegistry);
			var searcher = new mSearchClient.Searcher({serviceRegistry: serviceRegistry, commandService: commandService, fileService: fileClient});
			var selection = new mSelection.Selection(serviceRegistry);
			
			var operationsClient = new mOperationsClient.OperationsClient(serviceRegistry);
			new mStatus.StatusReportingService(serviceRegistry, operationsClient, "statusPane", "notifications", "notificationArea");
			new mProgress.ProgressService(serviceRegistry, operationsClient);
		
			mGlobalCommands.generateBanner("banner", serviceRegistry, commandService, preferences, searcher, usersList, usersList);
			mGlobalCommands.generateDomCommandsInBanner(commandService, usersList);
		
			var usersList = new mUsersList.UsersList(serviceRegistry, selection, searcher, "usersList", "pageActions", "selectionTools", "userCommands");
			
			var createUserCommand = new mCommands.Command({
				name: "Create User",
				id: "eclipse.createUser",
				callback: function() {
					var dialog = new orion.profile.widgets.NewUserDialog({
						func : dojo.hitch(usersList, function() {
							this.reloadUsers();
						}),
						registry : serviceRegistry
					});
					dialog.startup();
					dialog.show();
				},
				visibleWhen: function(item) {
					return true;
				}
			});
			
			commandService.addCommand(createUserCommand);
				
			var deleteCommand = new mCommands.Command({
				name: "Delete User",
				image: require.toUrl("images/delete.gif"),
				id: "eclipse.deleteUser",
				visibleWhen: function(item) {
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
				},
				callback: function(data) {
					var item = data.items;
					var userService = serviceRegistry.getService("orion.core.user");
					if(dojo.isArray(item) && item.length > 1){
						if(confirm("Are you sure you want to delete these " + item.length + " users?")){
							var usersProcessed = 0;
							for(var i=0; i<item.length; i++){
								userService.deleteUser(item[i].Location).then( dojo.hitch(usersList, function(jsonData) {
									  usersProcessed++;
									  if(usersProcessed==item.length)
										  this.reloadUsers();
								  }));	
							}
						}
						
					}else{
						item = dojo.isArray(item) ? item[0] : item;
						if (confirm("Are you sure you want to delete user '" + item.login + "'?")) {
							userService.deleteUser(item.Location).then( dojo.hitch(usersList, function(jsonData) {
							  this.reloadUsers();
						  }));
						}
					}
				}
			});
			commandService.addCommand(deleteCommand);
			
			var changePasswordCommand = new mCommands.Command({
				name: "Change Password",
				id: "eclipse.changePassword",
				callback: function(data) {
					var item = data.items;
					var dialog = new orion.profile.widgets.ResetPasswordDialog({
						user: item,
						registry : serviceRegistry
					});
					dialog.startup();
					dialog.show();
					
				},
				visibleWhen: function(item){
					return true;
				}
			});
			commandService.addCommand(changePasswordCommand);
			
			
		
			// define the command contributions - where things appear, first the groups
			commandService.addCommandGroup("pageActions", "eclipse.usersGroup", 100);
			commandService.addCommandGroup("selectionTools", "eclipse.selectionGroup", 500, "More");
			
			commandService.registerCommandContribution("pageActions", "eclipse.createUser", 1, "eclipse.usersGroup");
			
			commandService.registerCommandContribution("userCommands", "eclipse.deleteUser", 1);
			commandService.registerCommandContribution("userCommands", "eclipse.changePassword", 2);
			commandService.registerCommandContribution("selectionTools", "eclipse.deleteUser", 1, "eclipse.selectionGroup");
			
		
			usersList.loadUsers();
			mUsersUtil.updateNavTools(serviceRegistry, usersList, "pageActions", "selectionTools", {});	
		});
	});
});