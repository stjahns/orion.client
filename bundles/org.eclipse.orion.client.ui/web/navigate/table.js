/*******************************************************************************
 * @license
 * Copyright (c) 2010, 2012 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/
/*global define document window eclipse orion serviceRegistry:true widgets alert URL*/
/*browser:true*/

define(['require', 'i18n!orion/navigate/nls/messages', 'orion/browserCompatibility', 'orion/bootstrap', 'orion/Deferred', 'orion/i18nUtil', 'orion/webui/littlelib', 'orion/selection', 'orion/status', 'orion/progress', 'orion/dialogs',
        'orion/ssh/sshTools', 'orion/keyBinding', 'orion/commandRegistry', 'orion/favorites', 'orion/tasks', 'orion/navoutliner', 'orion/searchClient', 'orion/fileClient', 'orion/operationsClient', 'orion/globalCommands',
        'orion/fileCommands', 'orion/extensionCommands', 'orion/explorers/explorer-table', 'orion/explorers/navigatorRenderer', 'orion/fileUtils', 'orion/PageUtil', 'orion/URITemplate', 'orion/contentTypes', 'orion/URL-shim', 'orion/PageLinks'], 
		function(require, messages, mBrowserCompatibility, mBootstrap, Deferred, i18nUtil, lib, mSelection, mStatus, mProgress, mDialogs, mSsh, KeyBinding, mCommandRegistry, mFavorites, mTasks, mNavOutliner,
				mSearchClient, mFileClient, mOperationsClient, mGlobalCommands, mFileCommands, mExtensionCommands, mExplorerTable, mNavigatorRenderer, mFileUtils, PageUtil, URITemplate, mContentTypes, _, PageLinks) {

	mBootstrap.startup().then(function(core) {
		var serviceRegistry = core.serviceRegistry;
		var preferences = core.preferences;
		var selection = new mSelection.Selection(serviceRegistry);
		var operationsClient = new mOperationsClient.OperationsClient(serviceRegistry);
		new mStatus.StatusReportingService(serviceRegistry, operationsClient, "statusPane", "notifications", "notificationArea"); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
		new mDialogs.DialogService(serviceRegistry);
		new mSsh.SshService(serviceRegistry);
		new mFavorites.FavoritesService({serviceRegistry: serviceRegistry});
		var commandRegistry = new mCommandRegistry.CommandRegistry({selection: selection});
		var progress = new mProgress.ProgressService(serviceRegistry, operationsClient, commandRegistry);
		var fileClient = new mFileClient.FileClient(serviceRegistry);
		var searcher = new mSearchClient.Searcher({serviceRegistry: serviceRegistry, commandService: commandRegistry, fileService: fileClient});

		// global commands
		mGlobalCommands.setPageCommandExclusions(["eclipse.openWith", "orion.navigateFromMetadata"]); //$NON-NLS-1$ //$NON-NLS-0$
		mGlobalCommands.generateBanner("orion-navigate", serviceRegistry, commandRegistry, preferences, searcher); //$NON-NLS-0$
		
		var treeRoot = {
			children:[]
		};
				
	
		var contentTypeService = new mContentTypes.ContentTypeService(serviceRegistry);
		
		var explorer = new mExplorerTable.FileExplorer({
				serviceRegistry: serviceRegistry, 
				treeRoot: treeRoot, 
				selection: selection, 
				fileClient: fileClient, 
				parentId: "explorer-tree", //$NON-NLS-0$
				dragAndDrop: mFileCommands.uploadFile,
				rendererFactory: function(explorer) {
					return new mNavigatorRenderer.NavigatorRenderer({
						checkbox: false, 
						cachePrefix: "Navigator"}, explorer, commandRegistry, contentTypeService);  //$NON-NLS-0$
				}});
		// On scope up, change the href of the window.location to navigate to the parent page.
		// TODO reuse eclipse.upFolder
		explorer.scopeUp = function() {
			if(this.treeRoot && this.treeRoot.Parents){
				if(this.treeRoot.Parents.length === 0){
					window.location.href = "#"; //$NON-NLS-0$
				} else if(this.treeRoot.Parents[0].ChildrenLocation){
					window.location.href = "#" + this.treeRoot.Parents[0].ChildrenLocation; //$NON-NLS-0$
				}
			}
		}.bind(explorer);

		function refresh() {
			var pageParams = PageUtil.matchResourceParameters();
			// TODO working around https://bugs.eclipse.org/bugs/show_bug.cgi?id=373450
			var nonHash = window.location.href.split('#')[0]; //$NON-NLS-0$
			var orionHome = PageLinks.getOrionHome();

			explorer.loadResourceList(pageParams.resource, false, function() {
				mGlobalCommands.setPageTarget({task: "Navigator", target: explorer.treeRoot, 
					serviceRegistry: serviceRegistry, searchService: searcher, fileService: fileClient, commandService: commandRegistry});
				mFileCommands.updateNavTools(serviceRegistry, commandRegistry, explorer, "pageActions", "selectionTools", explorer.treeRoot);
			});
		}
		refresh();
	
		// commands shared by navigators
		mFileCommands.createFileCommands(serviceRegistry, commandRegistry, explorer, fileClient); 
		
		// define the command contributions - where things appear, first the groups
		commandRegistry.addCommandGroup("pageActions", "orion.new", 1000, messages["New"]); //$NON-NLS-1$ //$NON-NLS-0$
		commandRegistry.addCommandGroup("pageActions", "orion.gitGroup", 200); //$NON-NLS-1$ //$NON-NLS-0$
		commandRegistry.addCommandGroup("selectionTools", "orion.selectionGroup", 500, messages["Actions"], null, messages["Click on an item to make a selection, then use this menu to see what actions are available."]); //$NON-NLS-1$ //$NON-NLS-0$
		commandRegistry.addCommandGroup("selectionTools", "orion.importExportGroup", 100, null, "orion.selectionGroup");		 //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
		commandRegistry.addCommandGroup("selectionTools", "orion.newResources", 101, null, "orion.selectionGroup"); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
		// commands that don't appear but have keybindings
		commandRegistry.registerCommandContribution("pageActions", "eclipse.copySelections", 1, null, true, new KeyBinding.KeyBinding('c', true)); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
		commandRegistry.registerCommandContribution("pageActions", "eclipse.pasteSelections", 1, null, true, new KeyBinding.KeyBinding('v', true)); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
		
		// commands appearing in nav tool bar
		commandRegistry.registerCommandContribution("pageActions", "eclipse.openResource", 500); //$NON-NLS-1$ //$NON-NLS-0$
		
		//new file and new folder in the nav bar do not label the group (we don't want a menu)
		commandRegistry.registerCommandContribution("pageActions", "eclipse.newFile", 1); //$NON-NLS-1$ //$NON-NLS-0$
		commandRegistry.registerCommandContribution("pageActions", "eclipse.newFolder", 2, null, false, null, new mCommandRegistry.URLBinding("newFolder", "name")); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
		commandRegistry.registerCommandContribution("pageActions", "eclipse.upFolder", 3, null, true, new KeyBinding.KeyBinding(38, false, false, true)); //$NON-NLS-1$ //$NON-NLS-0$
		// new project creation in the toolbar (in a group)
		commandRegistry.registerCommandContribution("pageActions", "orion.new.project", 1, "orion.new"); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
		commandRegistry.registerCommandContribution("pageActions", "orion.new.linkProject", 2, "orion.new"); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
	
		// selection based command contributions in nav toolbar
		var binding;
		//commandRegistry.registerCommandContribution("selectionTools", "orion.makeFavorite", 1, "orion.selectionGroup"); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
		binding = new KeyBinding.KeyBinding(113);
		binding.domScope = "explorer-tree"; //$NON-NLS-0$
		binding.scopeName = "Navigator"; //$NON-NLS-0$
		commandRegistry.registerCommandContribution("selectionTools", "eclipse.renameResource", 2, "orion.selectionGroup", false, binding); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
		commandRegistry.registerCommandContribution("selectionTools", "eclipse.copyFile", 3, "orion.selectionGroup"); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
		commandRegistry.registerCommandContribution("selectionTools", "eclipse.moveFile", 4, "orion.selectionGroup"); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
		binding = new KeyBinding.KeyBinding(46);
		binding.domScope = "explorer-tree"; //$NON-NLS-0$
		binding.scopeName = "Navigator"; //$NON-NLS-0$
		commandRegistry.registerCommandContribution("selectionTools", "eclipse.deleteFile", 5, "orion.selectionGroup", false, binding); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
		commandRegistry.registerCommandContribution("selectionTools", "eclipse.compareWithEachOther", 6, "orion.selectionGroup");  //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
		commandRegistry.registerCommandContribution("selectionTools", "eclipse.compareWith", 7, "orion.selectionGroup");  //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
		commandRegistry.registerCommandContribution("selectionTools", "orion.importZipURL", 1, "orion.selectionGroup/orion.importExportGroup"); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
		commandRegistry.registerCommandContribution("selectionTools", "orion.import", 2, "orion.selectionGroup/orion.importExportGroup"); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
		commandRegistry.registerCommandContribution("selectionTools", "eclipse.downloadFile", 3, "orion.selectionGroup/orion.importExportGroup"); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
		commandRegistry.registerCommandContribution("selectionTools", "orion.importSFTP", 4, "orion.selectionGroup/orion.importExportGroup"); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
		commandRegistry.registerCommandContribution("selectionTools", "eclipse.exportSFTPCommand", 5, "orion.selectionGroup/orion.importExportGroup"); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			
		mExtensionCommands.createAndPlaceFileCommandsExtension(serviceRegistry, commandRegistry, "selectionTools", 0, "orion.selectionGroup", true).then(function() { //$NON-NLS-1$ //$NON-NLS-0$
			mFileCommands.updateNavTools(serviceRegistry, commandRegistry, explorer, "pageActions", "selectionTools", explorer.treeRoot); //$NON-NLS-1$ //$NON-NLS-0$
			explorer.updateCommands();	
			// Must happen after the above call, so that all the open with commands are registered when we create our navigation links.
			new mNavOutliner.NavigationOutliner({parent: "fileSystems", commandService: commandRegistry, serviceRegistry: serviceRegistry}); //$NON-NLS-0$
		});

		window.addEventListener("hashchange", function() {refresh();}, false); //$NON-NLS-0$
	});
});
