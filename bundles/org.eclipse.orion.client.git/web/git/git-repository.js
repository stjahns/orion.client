/******************************************************************************* 
 * @license
 * Copyright (c) 2011, 2012 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/

var eclipse;
/*global define document dojo dijit serviceRegistry:true */
/*browser:true*/
define(['i18n!git/nls/gitmessages', 'require', 'dojo', 'orion/bootstrap', 'orion/status', 'orion/progress', 'orion/util', 'orion/PageUtil', 'orion/commands', 'orion/dialogs', 'orion/selection', 
        'orion/fileClient', 'orion/operationsClient', 'orion/searchClient', 'orion/globalCommands',
        'orion/git/gitRepositoryExplorer', 'orion/git/gitCommands', 'orion/git/gitClient', 'orion/ssh/sshTools', 'orion/links',
	    'dojo/parser', 'dojo/hash', 'dijit/layout/BorderContainer', 'dijit/layout/ContentPane', 'orion/widgets/eWebBorderContainer'], 
		function(messages, require, dojo, mBootstrap, mStatus, mProgress, mUtil, PageUtil, mCommands, mDialogs, mSelection, 
				mFileClient, mOperationsClient, mSearchClient, mGlobalCommands, 
				mGitRepositoryExplorer, mGitCommands, mGitClient, mSshTools, mLinks) {

mBootstrap.startup().then(function(core) {
	var serviceRegistry = core.serviceRegistry;
	var preferences = core.preferences;
	document.body.style.visibility = "visible"; //$NON-NLS-0$
	dojo.parser.parse();
	
	new mDialogs.DialogService(serviceRegistry);
	var selection = new mSelection.Selection(serviceRegistry);
	new mSshTools.SshService(serviceRegistry);
	var commandService = new mCommands.CommandService({serviceRegistry: serviceRegistry});
	var operationsClient = new mOperationsClient.OperationsClient(serviceRegistry);
	new mProgress.ProgressService(serviceRegistry, operationsClient);
	new mStatus.StatusReportingService(serviceRegistry, operationsClient, "statusPane", "notifications", "notificationArea"); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
	
	// ...
	var linkService = new mLinks.TextLinkService({serviceRegistry: serviceRegistry});
	var gitClient = new mGitClient.GitService(serviceRegistry);
	var fileClient = new mFileClient.FileClient(serviceRegistry);
	var searcher = new mSearchClient.Searcher({serviceRegistry: serviceRegistry, commandService: commandService, fileService: fileClient});
	
	var explorer = new mGitRepositoryExplorer.GitRepositoryExplorer(serviceRegistry, commandService, linkService, /* selection */ null, "artifacts", "pageActions", null, "itemLevelCommands"); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
	mGlobalCommands.generateBanner("banner", serviceRegistry, commandService, preferences, searcher, explorer); //$NON-NLS-0$
	
	// define commands
	mGitCommands.createFileCommands(serviceRegistry, commandService, explorer, "pageActions", "selectionTools"); //$NON-NLS-1$ //$NON-NLS-0$
	mGitCommands.createGitClonesCommands(serviceRegistry, commandService, explorer, "pageActions", "selectionTools", fileClient); //$NON-NLS-1$ //$NON-NLS-0$

	// define the command contributions - where things appear, first the groups
	commandService.addCommandGroup("pageActions", "eclipse.gitGroup", 100); //$NON-NLS-1$ //$NON-NLS-0$
	commandService.registerCommandContribution("pageActions", "eclipse.cloneGitRepository", 100, "eclipse.gitGroup", false, null, new mCommands.URLBinding("cloneGitRepository", "url")); //$NON-NLS-4$ //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
	commandService.registerCommandContribution("pageActions", "eclipse.initGitRepository", 101, "eclipse.gitGroup"); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
	commandService.registerCommandContribution("pageActions", "eclipse.orion.git.openCommitCommand", 102, "eclipse.gitGroup", true,  //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
		new mCommands.CommandKeyBinding('h', true, true), new mCommands.URLBinding("openGitCommit", "commitName")); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
	commandService.registerCommandContribution("pageActions", "eclipse.orion.git.showContent", 300, null,true,new mCommands.CommandKeyBinding('e', true, true)); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
	
	// object contributions
	commandService.registerCommandContribution("itemLevelCommands", "eclipse.openCloneContent", 100); //$NON-NLS-1$ //$NON-NLS-0$
	commandService.registerCommandContribution("itemLevelCommands", "eclipse.openGitStatus", 100); //$NON-NLS-1$ //$NON-NLS-0$
	commandService.registerCommandContribution("itemLevelCommands", "eclipse.openGitLog", 100); //$NON-NLS-1$ //$NON-NLS-0$
	commandService.registerCommandContribution("itemLevelCommands", "eclipse.orion.git.pull", 200); //$NON-NLS-1$ //$NON-NLS-0$
	commandService.registerCommandContribution("itemLevelCommands", "eclipse.removeBranch", 1000); //$NON-NLS-1$ //$NON-NLS-0$
	commandService.registerCommandContribution("itemLevelCommands", "eclipse.checkoutTag", 200); //$NON-NLS-1$ //$NON-NLS-0$
	commandService.registerCommandContribution("itemLevelCommands", "eclipse.removeTag", 1000); //$NON-NLS-1$ //$NON-NLS-0$
	commandService.registerCommandContribution("itemLevelCommands", "eclipse.checkoutBranch", 200); //$NON-NLS-1$ //$NON-NLS-0$
	commandService.registerCommandContribution("itemLevelCommands", "eclipse.orion.git.applyPatch", 300); //$NON-NLS-1$ //$NON-NLS-0$
	commandService.registerCommandContribution("itemLevelCommands", "eclipse.orion.git.showContent", 300, null,true,new mCommands.CommandKeyBinding('e', true, true)); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
	commandService.registerCommandContribution("itemLevelCommands", "eclipse.git.deleteClone", 1000); //$NON-NLS-1$ //$NON-NLS-0$
	commandService.registerCommandContribution("itemLevelCommands", "eclipse.orion.git.fetch", 500); //$NON-NLS-1$ //$NON-NLS-0$
	commandService.registerCommandContribution("itemLevelCommands", "eclipse.orion.git.merge", 600); //$NON-NLS-1$ //$NON-NLS-0$
	commandService.registerCommandContribution("itemLevelCommands", "eclipse.orion.git.rebase", 700); //$NON-NLS-1$ //$NON-NLS-0$
	commandService.registerCommandContribution("itemLevelCommands", "eclipse.orion.git.resetIndex", 800); //$NON-NLS-1$ //$NON-NLS-0$
	commandService.registerCommandContribution("itemLevelCommands", "eclipse.removeRemote", 1000); //$NON-NLS-1$ //$NON-NLS-0$
	commandService.registerCommandContribution("itemLevelCommands", "eclipse.orion.git.deleteConfigEntryCommand", 1000); //$NON-NLS-1$ //$NON-NLS-0$
	commandService.registerCommandContribution("itemLevelCommands", "eclipse.orion.git.editConfigEntryCommand", 200); //$NON-NLS-1$ //$NON-NLS-0$
	
	// add commands specific for the page	
	var viewAllCommand = new mCommands.Command({
		name : messages["View All"],
		id : "eclipse.orion.git.repositories.viewAllCommand", //$NON-NLS-0$
		hrefCallback : function(data) {
			return require.toUrl(data.items.ViewAllLink);
		},
		visibleWhen : function(item) {
		
			this.name = item.ViewAllLabel;
			this.tooltip = item.ViewAllTooltip;
			return item.ViewAllLabel && item.ViewAllTooltip && item.ViewAllLink;
		}
	});
	commandService.addCommand(viewAllCommand);
		
	// process the URL to find our bindings, since we can't be sure these bindings were defined when the URL was first processed.
	commandService.processURL(window.location.href);
	
	fileClient.loadWorkspace().then(
		function(workspace){
			explorer.setDefaultPath(workspace.Location);
			var pageParams = PageUtil.matchResourceParameters();
			if (pageParams.resource) {
				explorer.displayRepository(pageParams.resource);
			} else {
				var path = workspace.Location;
				var relativePath = mUtil.makeRelative(path);
				
				//NOTE: require.toURL needs special logic here to handle "gitapi/clone"
				var gitapiCloneUrl = require.toUrl("gitapi/clone._"); //$NON-NLS-0$
				gitapiCloneUrl = gitapiCloneUrl.substring(0,gitapiCloneUrl.length-2);
				
				explorer.displayRepository(relativePath[0] === "/" ? gitapiCloneUrl + relativePath : gitapiCloneUrl + "/" + relativePath); //$NON-NLS-1$ //$NON-NLS-0$
			}
		}	
	);	
	
	//every time the user manually changes the hash, we need to load the workspace with that name
	dojo.subscribe("/dojo/hashchange", explorer, function() { //$NON-NLS-0$
		fileClient.loadWorkspace().then(
			function(workspace){
				explorer.setDefaultPath(workspace.Location);
				var pageParams = PageUtil.matchResourceParameters();
				if (pageParams.resource) {
					explorer.displayRepository(pageParams.resource);
				} else {
					var path = workspace.Location;
					var relativePath = mUtil.makeRelative(path);
					
					//NOTE: require.toURL needs special logic here to handle "gitapi/clone"
					var gitapiCloneUrl = require.toUrl("gitapi/clone._"); //$NON-NLS-0$
					gitapiCloneUrl = gitapiCloneUrl.substring(0,gitapiCloneUrl.length-2);
					
					explorer.displayRepository(relativePath[0] === "/" ? gitapiCloneUrl + relativePath : gitapiCloneUrl + "/" + relativePath); //$NON-NLS-1$ //$NON-NLS-0$
				}
			}	
		);	
	});

//	makeRightPane(explorer);
});

/*function makeRightPane(explorer){
	// set up the splitter bar and its key binding
	var splitArea = dijit.byId("orion.innerNavigator");
	
	//by default the pane should be closed
	if(splitArea.isRightPaneOpen()){
		splitArea.toggle();
	}
			
	var bufferedSelection = [];
	
	window.document.onkeydown = function (evt){
		evt = evt || window.event;
		var handled = false;
		if(evt.ctrlKey && evt.keyCode  === 79){ // Ctrl+o handler for toggling outline 
			splitArea.toggle();
			handled = true;			
		} 
		if (handled) {
			if (window.document.all) { 
				evt.keyCode = 0;
			} else { 
				evt.preventDefault();
				evt.stopPropagation();
			}		
		}
	};
}*/

//end of define
});
