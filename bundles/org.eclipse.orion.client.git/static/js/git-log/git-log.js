/******************************************************************************* 
 * Copyright (c) 2011 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/

/*global dojo dijit window eclipse serviceRegistry:true widgets alert*/
/*browser:true*/
dojo.addOnLoad(function(){
	
	// initialize service registry and EAS services
	serviceRegistry = new eclipse.ServiceRegistry();
	var pluginRegistry = new eclipse.PluginRegistry(serviceRegistry);
	dojo.addOnUnload(function() {
		pluginRegistry.shutdown();
	});
	new eclipse.StatusReportingService(serviceRegistry, "statusPane", "pageActionsLeft");
	new eclipse.LogService(serviceRegistry);
	new eclipse.DialogService(serviceRegistry);
	var selection = new orion.Selection(serviceRegistry);
	new eclipse.SshService(serviceRegistry);
	var preferenceService = new eclipse.PreferencesService(serviceRegistry, "/prefs/user");
	var commandService = new eclipse.CommandService({serviceRegistry: serviceRegistry, selection: selection});
	
	var fileServices = serviceRegistry.getServiceReferences("IFileService");
	var fileServiceReference;
	var branch;
	
	for (var i=0; i<fileServices.length; i++) {
		var info = {};
		var propertyNames = fileServices[i].getPropertyNames();
		for (var j = 0; j < propertyNames.length; j++) {
			info[propertyNames[j]] = fileServices[i].getProperty(propertyNames[j]);
		}
		if (new RegExp(info.pattern).test(dojo.hash())) {
			fileServiceReference = fileServices[i];
		}
	}	
	
	// Git operations
	var gitClient = new eclipse.GitService(serviceRegistry);
	
	var searcher = new eclipse.Searcher({serviceRegistry: serviceRegistry});
	
	var navigator = new eclipse.GitCommitNavigator(serviceRegistry, selection, searcher, gitClient, "explorer-tree", "pageTitle", "pageActions", "selectionTools");

	// global commands
	eclipse.globalCommandUtils.generateBanner("toolbar", commandService, preferenceService, searcher, navigator);
	
	//TODO this should be removed and contributed by a plug-in
	eclipse.gitCommandUtils.createFileCommands(serviceRegistry, commandService, navigator, "pageActions", gitClient, "selectionTools");
	
	// define the command contributions - where things appear, first the groups
	commandService.addCommandGroup("eclipse.gitGroup.nav", 200, "More");
	commandService.addCommandGroup("eclipse.gitGroup.page", 100, null, null, "pageActions");
	commandService.addCommandGroup("eclipse.selectionGroup", 500, "More actions", null, "selectionTools");
	
	// commands appearing directly in local actions column
	commandService.registerCommandContribution("eclipse.openGitCommit", 1);
	commandService.registerCommandContribution("eclipse.compareWithWorkingTree", 2);
	if (!isRemote()){
		commandService.registerCommandContribution("eclipse.orion.git.addTag", 3);
	}

	// selection based command contributions in nav toolbar
	commandService.registerCommandContribution("eclipse.compareGitCommits", 1, "selectionTools", "eclipse.selectionGroup");
	
	// git contributions
	// commandService.registerCommandContribution("eclipse.cloneGitRepository", 100, "pageActions", "eclipse.gitGroup.page");
	
	if (isRemote()){
		commandService.registerCommandContribution("eclipse.orion.git.fetch", 100, "pageActions", "eclipse.gitGroup.page");
		commandService.registerCommandContribution("eclipse.orion.git.merge", 100, "pageActions", "eclipse.gitGroup.page");
	} else {
		commandService.registerCommandContribution("eclipse.orion.git.push", 100, "pageActions", "eclipse.gitGroup.page");
	};
	
	serviceRegistry.getService(fileServiceReference).then(function(fileService) {
		var fileClient = new eclipse.FileClient(fileService);
		initTitleBar(fileClient, navigator);
	});
	
	if (isRemote()) {
		// refresh the commit list for the remote
		var path = dojo.hash();
		dojo.xhrGet({
			url : path,
			headers : {
				"Orion-Version" : "1"
			},
			handleAs : "json",
			timeout : 5000,
			load : function(jsonData, secondArg) {
				serviceRegistry.getService("IGitService").then(function(gitService){
					gitService.getLog(jsonData.HeadLocation, jsonData.Id, function(scopedCommitsJsonData, secondArd) {
						navigator.renderer.setIncomingCommits(scopedCommitsJsonData);
						navigator.loadCommitsList(jsonData.CommitLocation + "?" + new dojo._Url(path).query, jsonData);
					});
				});
			},
			error : function(error, ioArgs) {
				handleGetAuthenticationError(this, ioArgs);
				console.error("HTTP status code: ", ioArgs.xhr.status);
			}
		});
	} else {
		var path = dojo.hash();
		dojo.xhrGet({
			url : path,
			headers : {
				"Orion-Version" : "1"
			},
			handleAs : "json",
			timeout : 5000,
			load : function(jsonData, secondArg) {
				return jsonData.RemoteLocation;
			},
			error : function(error, ioArgs) {
				handleGetAuthenticationError(this, ioArgs);
				console.error("HTTP status code: ", ioArgs.xhr.status);
			}
		}).then(function(remoteLocation){
			return dojo.xhrGet({
				url : remoteLocation,
				headers : {
					"Orion-Version" : "1"
				},
				handleAs : "json",
				timeout : 5000,
				load : function(jsonData, secondArg) {
					serviceRegistry.getService("IGitService").then(function(gitService){
						gitService.getLog(jsonData.CommitLocation, "HEAD", function(scopedCommitsJsonData, secondArd) {
							navigator.renderer.setOutgoingCommits(scopedCommitsJsonData);
							navigator.loadCommitsList(dojo.hash(), jsonData);
						});
					});
				},
				error : function(error, ioArgs) {
					handleGetAuthenticationError(this, ioArgs);
					console.error("HTTP status code: ", ioArgs.xhr.status);
				}
			});
		});
//		.then(function(blah){
//			serviceRegistry.getService("IGitService").then(function(gitService){
//				gitService.getLog(blah.CommitLocation, "HEAD", function(scopedCommitsJsonData, secondArd) {
//					navigator.renderer.setOutgoingCommits(scopedCommitsJsonData);
//					navigator.loadCommitsList(dojo.hash(), {});
//				});
//			});
//		});
	
		
		
		//navigator.loadCommitsList(dojo.hash(), {});
	}
	
	

	// every time the user manually changes the hash, we need to load the
	// workspace with that name
	dojo.subscribe("/dojo/hashchange", navigator, function() {
		serviceRegistry.getService(fileServiceReference).then(function(fileService) {
			var fileClient = new eclipse.FileClient(fileService);
			initTitleBar(fileClient, navigator);
		});
		if (isRemote()) {
			var path = dojo.hash();
			dojo.xhrGet({
				url : path,
				headers : {
					"Orion-Version" : "1"
				},
				handleAs : "json",
				timeout : 5000,
				load : function(jsonData, secondArg) {
					serviceRegistry.getService("IGitService").then(function(gitService){
						gitService.getLog(jsonData.HeadLocation, jsonData.Id, function(scopedCommitsJsonData, secondArd) {
							navigator.renderer.setIncomingCommits(scopedCommitsJsonData);
							navigator.loadCommitsList(jsonData.CommitLocation + "?" + new dojo._Url(path).query, jsonData);			
						});
					});
				},
				error : function(error, ioArgs) {
					handleGetAuthenticationError(this, ioArgs);
					console.error("HTTP status code: ", ioArgs.xhr.status);
				}
			});
		} else {
			navigator.loadCommitsList(dojo.hash(), {});
		}
	});
});

function isRemote(){
	var queryParams = dojo.queryToObject(window.location.search.slice(1));
	return queryParams["remote"] != null;
};

function getHeadFileUri(){
	var path = dojo.hash().split("git/commit/");
	if(path.length === 2){
		path = path[1].split("/");
		if(path.length > 1){
			branch = path[0];
			fileURI="";
			for(var i=1; i<path.length-1; i++){
				//first segment is a branch name
				fileURI+= "/" + path[i];
			}
			fileURI+="/" + path[path.length-1].split("?")[0];
		}
	}
	return fileURI;
}

function getRemoteFileURI(){
	var path = dojo.hash().split("git/remote/");
	if(path.length === 2){
		path = path[1].split("/");
		if(path.length > 2){
			branch = path[0]+"/"+path[1];
			fileURI="";
			for(var i=2; i<path.length-1; i++){
				//first two segments are a branch name
				fileURI+= "/" + path[i];
			}
			fileURI+="/" + path[path.length-1].split("?")[0];
		}
	}
	return fileURI;
}

function initTitleBar(fileClient, navigator){
	//TODO we are calculating file path from the URL, it should be returned by git API
	var fileURI = isRemote() ? getRemoteFileURI() : getHeadFileUri();
	
	
	if(fileURI){
		fileClient.read(fileURI, true).then(
				dojo.hitch(this, function(metadata) {
					var titlePane = dojo.byId("pageTitle");
					if (titlePane) {
						dojo.empty(titlePane);
						var breadcrumb = new eclipse.BreadCrumbs({container: "pageTitle", resource: metadata , makeHref:function(seg,location){makeHref(fileClient, seg,location);}});
						if(breadcrumb.path && breadcrumb.path!="")
							document.title = "Git Log - " + breadcrumb.path;
					}
					if(!metadata.Parents || metadata.Parents.length==0){
						navigator.isRoot=true;
					}
					eclipse.gitCommandUtils.updateNavTools(serviceRegistry, navigator, "pageActions", "selectionTools", navigator._lastTreeRoot);
				}),
				dojo.hitch(this, function(error) {
					console.error("Error loading file metadata: " + error.message);
				})
		);
	}
	
};

function makeHref(fileClient, seg, location){
	fileClient.read(location, true).then(
			dojo.hitch(this, function(metadata) {
				if (isRemote()) {
					serviceRegistry.getService("IGitService").then(function(gitService){
						gitService.getDefaultRemoteBranch(
								metadata.Git.RemoteLocation, function(
										defaultRemoteBranchJsonData, secondArg) {
									seg.href = "/git-log.html?remote#"
											+ defaultRemoteBranchJsonData.Location
											+ "?page=1";
								});
					});

				} else {
					seg.href = "/git-log.html#" + metadata.Git.CommitLocation
							+ "?page=1";
				}
			}),
			dojo.hitch(this, function(error) {
				console.error("Error loading file metadata: " + error.message);
			})
	);
};
