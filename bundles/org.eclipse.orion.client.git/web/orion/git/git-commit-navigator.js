/******************************************************************************* 
 * Copyright (c) 2011 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/

/*global dojo eclipse:true widgets*/
/*jslint regexp:false browser:true forin:true*/

define(['dojo', 'orion/explorer', 'orion/util', 'orion/git/gitCommands'], function(dojo, mExplorer, mUtil, mGitCommands) {

var exports =  {};
exports.GitCommitNavigator = (function() {
	/**
	 * @name eclipse.GitCommitNavigator
	 * @class A table-based git commit navigator
	 */
	function GitCommitNavigator(serviceRegistry, selection, commitDetails, parentId, pageTitleId, toolbarId, selectionToolsId) {
		this.registry = serviceRegistry;
		this.selection = selection;
		this.parentId = parentId;
		this.pageTitleId = pageTitleId;
		this.toolbarId = toolbarId;
		this.selectionToolsId = selectionToolsId;
		this.isRoot = null;
		this.isDirectory = true;
		this.model = null;
		this.myTree = null;
		this.commitDetails = commitDetails;
		this.renderer = new exports.GitCommitRenderer({checkbox: this.checkbox, cachePrefix: "GitCommitsNavigator"}, this);
		if(this.commitDetails)
			this.commitDetails.render(null);
	}
	
	GitCommitNavigator.prototype = new mExplorer.Explorer();
	
	GitCommitNavigator.prototype.loadCommitsList = function(path, treeRoot, force) {
			path = mUtil.makeRelative(path);
			if (path === this._lastHash && !force) {
				return;
			}
						
			this._lastHash = path;
			this._lastTreeRoot = treeRoot;
			//dojo.hash(path, true);
			var parent = dojo.byId(this.parentId);

			// Progress indicator
			var progress = dojo.byId("progress"); 
			if(!progress){
				progress = dojo.create("div", {id: "progress"}, parent, "only");
			}
			dojo.empty(progress);
			b = dojo.create("b");
			dojo.place(document.createTextNode("Loading "), progress, "last");
			dojo.place(document.createTextNode(path), b, "last");
			dojo.place(b, progress, "last");
			dojo.place(document.createTextNode("..."), progress, "last");
			
			var self = this;

			if(this.toolbarId && this.selectionToolsId)
				mGitCommands.updateNavTools(this.registry, this, this.toolbarId, this.selectionToolsId, treeRoot);
						
			this.registry.getService("orion.git.provider").then(function(service){
				dojo.hitch(self, self.createTree(self.parentId, new mExplorer.ExplorerFlatModel(path, service.doGitLog)));
			});
			
		};
		
	GitCommitNavigator.prototype.loadCommitDetails = function(commitDetails) {
		if(this.commitDetails)
			this.commitDetails.loadCommitDetails(commitDetails);
	};
		
	return GitCommitNavigator;
}());

/********* Rendering json items into columns in the tree **************/


exports.GitCommitRenderer = (function() {
 	
	function GitCommitRenderer (options, explorer) {
		this._init(options);
		this.explorer = explorer;
	}
	GitCommitRenderer.prototype = mExplorer.SelectionRenderer.prototype;
	
	GitCommitRenderer.prototype.getCellHeaderElement = function(col_no){
		
		switch(col_no){
		case 0: 
			return dojo.create("th", {style: "padding-left: 5px; padding-right: 5px", innerHTML: "<h2>Message</h2>"});
			break;
		case 1:
			return dojo.create("th", {style: "padding-left: 5px; padding-right: 5px", innerHTML: "<h2>Author</h2>"});
			break;
		case 2:
			return dojo.create("th", {style: "padding-left: 5px; padding-right: 5px", innerHTML: "<h2>Date</h2>"});
			break;
		case 3:
			return dojo.create("th", {style: "padding-left: 5px; padding-right: 5px", innerHTML: "<h2>Actions</h2>"});
			break;
		case 4:
			return dojo.create("th", {style: "padding-left: 5px; padding-right: 5px", innerHTML: "<h2>Tags</h2>"});
			break;
		};
		
	};
	
	GitCommitRenderer.prototype.setIncomingCommits = function(scopedCommits){
		this.incomingCommits = scopedCommits;
	};
	
	GitCommitRenderer.prototype.setOutgoingCommits = function(scopedCommits){
		this.outgoingCommits = scopedCommits;
	};
	
	GitCommitRenderer.prototype.getCellElement = function(col_no, item, tableRow){
		
		var incomingCommit = false;
		
		dojo.forEach(this.incomingCommits, function(commit, i){
			if (item.Name === commit.Name){
				incomingCommit = true;
			}
		});
		
		var outgoingCommit = false;
		
		dojo.forEach(this.outgoingCommits, function(commit, i){
			if (item.Name === commit.Name){
				outgoingCommit = true;
			}
		});

		switch(col_no){
		case 0:
			var col, div, link;

			col = document.createElement('td');
			div = dojo.create("div", {style: "margin-left: 5px; margin-right: 5px; margin-top: 5px; margin-bottom: 5px; padding-left: 20px;"}, col, "only");
				
			// clicking the link should update the commit details pane
			link = dojo.create("a", {className: "navlinkonpage"}, div, "last");
			dojo.connect(link, "onclick", link, dojo.hitch(this, function() {
				this.explorer.loadCommitDetails(item);	
			}));			
			dojo.connect(link, "onmouseover", link, function() {
				link.style.cursor = /*self._controller.loading ? 'wait' :*/"pointer";
			});
			dojo.connect(link, "onmouseout", link, function() {
				link.style.cursor = /*self._controller.loading ? 'wait' :*/"default";
			});
			
			dojo.place(document.createTextNode(item.Message), link, "only");	
			
			if (incomingCommit)
				dojo.toggleClass(tableRow, "incomingCommitsdRow", true);
			else if (outgoingCommit)
				dojo.toggleClass(tableRow, "outgoingCommitsdRow", true);
			
			return col;
			break;
		case 1:
			return dojo.create("td", {style: "padding-left: 5px; padding-right: 5px", innerHTML: item.AuthorName + " (" + item.AuthorEmail + ")"});
			break;
		case 2:
			return dojo.create("td", {style: "padding-left: 5px; padding-right: 5px", innerHTML: dojo.date.locale.format(new Date(item.Time), {formatLength: "short"})});
			break;
		case 3:
			var actionsColumn = this.getActionsColumn(item, tableRow);
			dojo.style(actionsColumn, "padding-left", "5px");
			dojo.style(actionsColumn, "padding-right", "5px");
			return actionsColumn;
			break;
		case 4:
			var td = document.createElement("td", {style: "padding-left: 5px; padding-right: 5px"});
			dojo.forEach(item.Children, function(tag, i){
				dojo.place(document.createTextNode(tag.Name), dojo.create("p", {style: "margin: 5px"}, td, "last"), "only");
			});
			return td;
			break;
		};
	};
	
	return GitCommitRenderer;
}());
return exports;
});

