/*******************************************************************************
 * Copyright (c) 2011 IBM Corporation and others. 
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/
dojo.require("dojo.hash");
dojo.require("dijit.layout.BorderContainer");
dojo.require("dijit.layout.ContentPane");
dojo.addOnLoad(function(){
	// initialize service registry and EAS services
	var serviceRegistry = new eclipse.ServiceRegistry();
	var pluginRegistry = new eclipse.PluginRegistry(serviceRegistry);
	var commandService = new eclipse.CommandService({serviceRegistry: serviceRegistry});
	var preferenceService = new eclipse.PreferencesService(serviceRegistry, "/prefs/user");
	var searcher = new eclipse.Searcher({serviceRegistry: serviceRegistry});
	// File operations
	var fileServices = serviceRegistry.getServiceReferences("IFileService");
	var fileServiceReference;
	
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

	serviceRegistry.getService(fileServiceReference).then(function(fileService) {
		var fileClient = new eclipse.FileClient(fileService);
		
		eclipse.globalCommandUtils.generateBanner("toolbar", commandService, preferenceService, searcher);
		
		var factory = new orion.CompareMergeUIFactory("compareCon");
		factory.createTileDiv("left-viewer-title","left-con");
		factory.createLeftEditorParentDiv("left-viewer","left-con");
		factory.createStatusDiv("left-viewer-status","left-con");
		
		factory.createTileDiv("right-viewer-title","right-con");
		factory.createRightEditorParentDiv("right-viewer","diff-canvas","right-con");
		factory.createStatusDiv("right-viewer-status","right-con");
	
		
		var canvas = document.getElementById("diff-canvas");
		// Git operations
		new eclipse.GitService(serviceRegistry);
		var readOnly = isReadOnly();
		compareMergeContainer = new orion.CompareMergeContainer(readOnly ,serviceRegistry , commandService, fileClient,"left-viewer" , "right-viewer" , canvas);
		compareMergeContainer.resolveDiff(dojo.hash(), 
				  function(newFile , oldFile){
			  		dojo.place(document.createTextNode(newFile), "left-viewer-title", "only");				  
			  			dojo.place(document.createTextNode(oldFile), "right-viewer-title", "only");				  
		  		  },
				  function(errorResponse , ioArgs){
					  var message = typeof(errorResponse.message) === "string" ? errorResponse.message : ioArgs.xhr.statusText; 
					  dojo.place(document.createTextNode(message), "left-viewer-title", "only");				  
					  dojo.place(document.createTextNode(message), "right-viewer-title", "only");				  
					  dojo.style("left-viewer-title", "color", "red");
					  dojo.style("right-viewer-title", "color", "red");
				  }
		);
		
		//every time the user manually changes the hash, we need to load the diff
		dojo.subscribe("/dojo/hashchange", compareMergeContainer, function() {
			compareMergeContainer = new orion.CompareMergeContainer(readOnly ,serviceRegistry , commandService , fileClient,"left-viewer" , "right-viewer" , canvas);
			compareMergeContainer.resolveDiff(dojo.hash(), 
					  function(newFile , oldFile){
				  		dojo.place(document.createTextNode("File: " + newFile), "left-viewer-title", "only");				  
				  			dojo.place(document.createTextNode("File On Git: " + oldFile), "right-viewer-title", "only");				  
			  		  },
					  function(errorResponse , ioArgs){
						  var message = typeof(errorResponse.message) === "string" ? errorResponse.message : ioArgs.xhr.statusText; 
						  dojo.place(document.createTextNode(message), "left-viewer-title", "only");				  
						  dojo.place(document.createTextNode(message), "right-viewer-title", "only");				  
						  dojo.style("left-viewer-title", "color", "red");
						  dojo.style("right-viewer-title", "color", "red");
					  });
		});
			
		var nextDiffCommand = new eclipse.Command({
			name : "Next Difference",
			image : "/images/compare/next-diff.gif",
			id: "orion.compare.nextDiff",
			groupId: "orion.compareGroup",
			callback : function() {
				compareMergeContainer.nextDiff();
		}});
		var prevDiffCommand = new eclipse.Command({
			name : "Previous Difference",
			image : "/images/compare/prev-diff.gif",
			id: "orion.compare.prevDiff",
			groupId: "orion.compareGroup",
			callback : function() {
				compareMergeContainer.prevDiff();
		}});
		var copyToLeftCommand = new eclipse.Command({
			name : "Copy Current Change From Right to left",
			image : "/images/compare/copy-to-left.gif",
			id: "orion.compare.copyToLeft",
			groupId: "orion.compareGroup",
			callback : function() {
				compareMergeContainer.copyToLeft();;
			}});
		commandService.addCommand(prevDiffCommand, "dom");
		commandService.addCommand(nextDiffCommand, "dom");
		commandService.addCommand(copyToLeftCommand, "dom");
			
		// Register command contributions
		commandService.registerCommandContribution("orion.compare.prevDiff", 3, "pageActions");
		commandService.registerCommandContribution("orion.compare.nextDiff", 2, "pageActions");
		commandService.registerCommandContribution("orion.compare.copyToLeft", 1, "pageActions");
			
		eclipse.globalCommandUtils.generateDomCommandsInBanner(commandService, {} );
	});
});

function isReadOnly(){
	var queryParams = dojo.queryToObject(window.location.search.slice(1));
	return queryParams["readonly"] != null;
};


