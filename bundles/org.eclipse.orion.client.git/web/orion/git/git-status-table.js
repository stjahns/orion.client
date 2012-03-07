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

define(['require', 'dojo',  'orion/compare/compare-container', 'orion/commands', 'orion/globalCommands', 'orion/git/git-commit-navigator', 'orion/git/gitCommands', 'orion/util', 'dijit/layout/ContentPane'], function(
		require, dojo,  mCompareContainer, mCommands, mGlobalCommands, mGitCommitNavigator, mGitCommands, mUtil) {

	var orion = orion || {};

orion.GitStatusModel = (function() {
	function GitStatusModel() {
		this.selectedFileId = undefined;
		this.selectedItem = undefined;
		this.interestedUnstagedGroup = ["Missing","Modified","Untracked","Conflicting"];
		this.interestedStagedGroup = ["Added", "Changed","Removed"];
		this.conflictPatterns = [["Both","Modified","Added", "Changed","Missing"],["RemoteDelete","Untracked","Removed"],["LocalDelete","Modified","Added", "Missing"]];
		this.conflictType = "Conflicting";
	}
	GitStatusModel.prototype = {
		destroy: function(){
		},
		
		interestedCategory: function(){
		},
		
		init: function(jsonData){
			this.items = jsonData;
		},
		
		getModelType: function(groupItem , groupName){
			return groupName;
		},
		
		_markConflict:function(conflictPattern){
			//if git status server API response a file with "Modified" ,"Added", "Changed","Missing" states , we treat it as a conflicting file
			//And we add additional attribute to that groupItem : groupItem.Conflicting = true;
			var baseGroup = this.getGroupData(conflictPattern[1]);
			if(!baseGroup)
				return;
			for(var i = 0 ; i < baseGroup.length ; i++){
				if(baseGroup[i].Conflicting)
					continue;
				var fileLocation = baseGroup[i].Location;
				var itemsInDetectGroup = [];
				
				for (var j = 2; j < conflictPattern.length ; j++){
					var groupName = conflictPattern[j];
					var groupData = this.getGroupData(groupName);
					if(!groupData)
						continue;
					var item = this._findSameFile(fileLocation , groupData);
					if(item){
						itemsInDetectGroup.push(item);
					} else {
						continue;
					}
				}
				
				//we have the same file at "Modified" ,"Added", "Changed","Missing" groups
				if(itemsInDetectGroup.length === (conflictPattern.length - 2) ){
					baseGroup[i].Conflicting = conflictPattern[0];
					for(var k = 0; k < itemsInDetectGroup.length ; k++){
						itemsInDetectGroup[k].Conflicting = "Hide";
					}
				}
			}
		},
		
		_findSameFile: function(fileLocation , groupData){
			for(var j = 0 ; j < groupData.length ; j++){
				if(groupData[j].Conflicting)
					continue;
				if(fileLocation === groupData[j].Location)
					return groupData[j];
			}
			return undefined;
		},
		
		getGroupData: function(groupName){
			return this.items[groupName];
		},
		
		isConflict: function(type){
			return type === this.conflictType;
		},
		
		isStaged: function(type){
			for(var i = 0; i < this.interestedStagedGroup.length ; i++){
				if(type === this.interestedStagedGroup[i]){
					return  true;
				}
			}
			return false;
		}
		
	};
	return GitStatusModel;
}());

orion.statusTypeMap = { "Missing":[require.toUrl("git/images/removal.gif"), "Unstaged removal" , require.toUrl("git/images/stage.gif"), "Stage" ],
						"Removed":[require.toUrl("git/images/removal.gif"),"Staged removal" ,require.toUrl("git/images/unstage.gif"), "Unstage" ],	
						 "Modified":[require.toUrl("git/images/modification.gif"),"Unstaged change" ,require.toUrl("git/images/stage.gif"), "Stage" ],	
						 "Changed":[require.toUrl("git/images/modification.gif"),"Staged change" ,require.toUrl("git/images/unstage.gif"), "Unstage"],	
					     "Untracked":[require.toUrl("git/images/addition.gif"),"Unstaged add" ,require.toUrl("git/images/stage.gif"), "Stage"],	
						 "Added":[require.toUrl("git/images/addition.gif"),"Staged add" ,require.toUrl("git/images/unstage.gif") , "Unstage"],	
						 "Conflicting":[require.toUrl("git/images/conflict-file.gif"),"Conflicting" ,require.toUrl("git/images/stage.gif") , "Resolve Conflict"]	
					  };


orion.GitStatusContentRenderer = (function() {
	function GitStatusContentRenderer(options, serviceRegistry ,tableDivId , model) {
		this._registry = serviceRegistry;
		this._useCheckboxSelection = (options.useCheckBox === undefined) ? false: options.useCheckBox;
		this._tableParentDivId = tableDivId;
		this._controller = model;
	}
	GitStatusContentRenderer.prototype = {
		initTable: function () {
			tableId = this._tableParentDivId + "_table";
		  	var tableParentDomNode = dojo.byId( this._tableParentDivId);
			dojo.place(document.createTextNode(""), tableParentDomNode, "only");
			var table = dojo.create("table", {id: tableId});
			dojo.addClass(table, "statusTable");
			tableParentDomNode.appendChild(table);
			this._table = table;
		},
		
		getSelected: function() {
			var selected = [];
			dojo.query(".selectionCheckmark" + this._tableParentDivId).forEach(dojo.hitch(this, function(node) {
				if (node.checked) {
					var row = node.parentNode.parentNode;
					selected.push({rowId:row.id, modelItem:row._item});
				}
			}));
			return selected;
		},
		
		toggleSelectAll: function(select) {
			var selected = [];
			dojo.query(".selectionCheckmark" + this._tableParentDivId).forEach(dojo.hitch(this, function(node) {
				node.checked = select;
				var row = node.parentNode.parentNode;
				dojo.toggleClass(row, "checkedRow", !!select);
			}));
			return selected;
		},
		
		getCheckboxColumn: function(tableRow){
			if (this._useCheckboxSelection) {
				var checkColumn = document.createElement('td');
				dojo.addClass(checkColumn, "secondaryColumn");
				var check = dojo.create("input", {type: "checkbox", id: tableRow.id+"selectedState" });
				dojo.addClass(check, "selectionCheckmark"+ this._tableParentDivId);
				dojo.addClass(check, "statusCheckBoxRow");
				check.itemId = tableRow.id;
				checkColumn.appendChild(check);
				dojo.connect(check, "onclick", dojo.hitch(this, function(evt) {
					dojo.toggleClass(tableRow, "checkedRow", !!evt.target.checked);
					this._controller._unstagedTableRenderer.renderAction();
					this._controller._stagedTableRenderer.renderAction();
					this._controller._stagedTableRenderer.updateCheckbox();
					this._controller._unstagedTableRenderer.updateCheckbox();
				}));
				return checkColumn;
			}
			return null;
		},
		
		renderRow: function(itemModel, lineNumber) {
			var self = this;
			var row = document.createElement('tr');
			row.id = itemModel.name + "_" + itemModel.type + "_row";
			row._item = itemModel;
			if (lineNumber % 2) {
				dojo.addClass(row, "darkTreeTableRow");
			} else {
				dojo.addClass(row, "lightTreeTableRow");
			}
			this._table.appendChild(row);

			//render the check box
			if(this._useCheckboxSelection){
				row.appendChild(this.getCheckboxColumn(row));
			}
			//render the type icon (added , modified ,untracked ...)
			var typeColumn = document.createElement('td');
			var typeImg = document.createElement('img');
			typeImg.src = orion.statusTypeMap[itemModel.type][0];
			dojo.style(typeImg, "verticalAlign", "middle");
			typeColumn.appendChild(typeImg);
			row.appendChild(typeColumn);
			
			//render the file name field
			var nameColumn = document.createElement('td');
			//nameColumn.width="100%";
			nameColumn.noWrap= true;
			row.appendChild(nameColumn);
			
			var nameSpan =  document.createElement('span');
			dojo.style(nameSpan, "verticalAlign", "middle");
			nameSpan.id = row.id +  "_nameSpan";
			dojo.place(document.createTextNode(itemModel.name), nameSpan, "only");
			dojo.style(nameSpan, "color", "#0000FF");
			nameSpan.title = "Click to compare";
			nameColumn.appendChild(nameSpan);
			if(nameSpan.id === self._controller._model.selectedFileId ){
				self._controller._model.selectedItem = itemModel;
				dojo.toggleClass(nameSpan, "fileNameSelectedRow", true);
			}
			
			dojo.connect(nameSpan, "onmouseover", nameSpan, function() {
				nameSpan.style.cursor = self._controller.loading ? 'wait' :"pointer";
				dojo.toggleClass(nameSpan, "fileNameCheckedRow", true);
			});
			dojo.connect(nameSpan, "onmouseout", nameSpan, function() {
				nameSpan.style.cursor = self._controller.loading ? 'wait' :"default";
				dojo.toggleClass(nameSpan, "fileNameCheckedRow", false);
			});
			
			dojo.connect(nameSpan, "onclick", nameSpan, function() {
				if(itemModel.name !== self._controller._model.selectedFileId ){
					if(self._controller._model.selectedFileId !== undefined){
						var selected = document.getElementById(self._controller._model.selectedFileId);
						if(selected)
							dojo.toggleClass(selected, "fileNameSelectedRow", false);
					}
					dojo.toggleClass(nameSpan, "fileNameSelectedRow", true);
					self._controller._model.selectedFileId = nameSpan.id;
					self._controller.loadDiffContent(itemModel);
				}
			});
			
			var actionCol = dojo.create("td", {id: row.id+"actionswrapper"}, row, "last");
			dojo.addClass(actionCol, "statusAction");
			actionCol.noWrap= true;
			var actionsWrapper = dojo.create("span", {id: row.id+"actionsWrapper"}, actionCol, "only");
			this._registry.getService("orion.page.command").renderCommands("itemLevelCommands", actionsWrapper, {type: "fileItem", object: itemModel, rowId:row.id}, this, "tool");
			this._registry.getService("orion.page.command").renderCommands("itemLevelCommands", actionsWrapper, itemModel, this, "tool");
			if(this._controller._model.isStaged(itemModel.type)){
				this._controller.hasStaged = true;
			} else {
				this._controller.hasUnstaged = true;
			}
		}
	};
	return GitStatusContentRenderer;
}());

orion.GitStatusTableRenderer = (function() {
	function GitStatusTableRenderer(options, serviceRegistry ,parentId , header , type) {
		this._registry = serviceRegistry;
		this._parentId = parentId;
		this._header = header;
		this._useCheckboxSelection = (options.useCheckBox === undefined) ? false: options.useCheckBox;
		this._type = type;
	}
	GitStatusTableRenderer.prototype = {
		render: function (renderSeparator) {
			var headingSection = mUtil.createPaneHeading(this._parentId, this._type + "heading", this._header, true, this._type + "_header", this._type + "commands");
			dojo.addClass(headingSection, "paneHeadingFixed");
			var check = dojo.create("input", {type: "checkbox"}, this._type+"_header", "after");
			dojo.addClass(check, "statusCheckBoxOverall");
			this.checkBox = check;
			dojo.connect(check, "onclick", dojo.hitch(this, function(evt) {
				this.contentRenderer.toggleSelectAll(evt.target.checked);
				this.renderAction();
			}));
			var localTools = dojo.byId(this._type+"commands");
			var id = this._type+"commandSpan";
			this._cmdSpan = dojo.create("span", {"id": id}, localTools, "last");
			// TODO this is done here 
			var commandService = this._registry.getService("orion.page.command");
			if (this._type === "stagedItems") {
				commandService.registerCommandContribution(id, "orion.gitUnstage", 1);
				commandService.registerCommandContribution(id, "orion.gitUnstageAll", 2);
			} else {
				commandService.registerCommandContribution(id, "orion.gitStage", 1);
				commandService.registerCommandContribution(id, "orion.gitCheckout", 2);
				commandService.registerCommandContribution(id, "orion.gitStageAll", 3);	
				commandService.registerCommandContribution(id, "orion.gitCheckoutAll", 4);	
				commandService.registerCommandContribution(id, "orion.gitSavePatch", 5);
			}
		
			dojo.addClass(this._cmdSpan, "paneHeadingCommands");
			this._statusContentId = this._parentId + "_" + this._type;
			dojo.create("div", {id:this._statusContentId}, this._parentId, "last");
		},
		
		select: function(selected){
			this.checkBox.checked = selected;
		},
		
		disable: function (disable) {
			this.checkBox.disabled = disable;
		},
		
		updateCheckbox: function(){
			var selectedItems = this.contentRenderer.getSelected();
			if (this.contentRenderer.totalRow === 0) 
				return;
			if(this.contentRenderer.totalRow === selectedItems.length)
				this.select(true);
			else
				this.select(false);
			
		},
		
		getStatusContentId: function(){
			return this._statusContentId;
		},
		
		renderAction:function(){
			dojo.place(document.createTextNode(""), this._cmdSpan, "only");
			var self = this;
			this._registry.getService("orion.page.command").renderCommands(self._cmdSpan.id, self._cmdSpan, {type: self._type}, this, "button");
		}
	};
	return GitStatusTableRenderer;
}());

orion.GitCommitZoneRenderer = (function() {
	function GitCommitZoneRenderer(serviceRegistry ,parentId) {
		this._registry = serviceRegistry;
		this._parentId = parentId;
	}
	GitCommitZoneRenderer.prototype = {
		render: function (renderSeparator) {
			this._commitZone = dojo.create("div", null, this._parentId, "last");
			var headingSection = dojo.create("div", null, this._commitZone);
			dojo.addClass(headingSection, "auxpaneHeading paneHeadingFixed");
			var title = dojo.create("span", {innerHTML: "Commit message"}, headingSection);
			
			var commitTable = dojo.create("table", null, this._commitZone);
			var commitRow = dojo.create("tr", null, commitTable);
			var messageCol = dojo.create("td", {nowrap :true}, commitRow, "last");
			var text = dojo.create("textarea", {id:"commitMessage", ROWS:6}, messageCol, "last");
			dojo.addClass(text, "pane");
			var actionCol = dojo.create("td", {nowrap :true}, commitRow, "last");
			var actionDiv = dojo.create("div", {style:"float: left;", align:"left"}, actionCol, "last");
			var actionTable = dojo.create("table", null,actionDiv);
			var actionRow1 = dojo.create("tr", null, actionTable);
			var actionCol1 = dojo.create("td", {nowrap :true}, actionRow1, "last");
			dojo.create("button", {id:"commit", innerHTML: "Commit", title: "Record changes in the active branch"}, actionCol1, "last");
			
			dojo.create("tr", {width:"100%" ,height:"20px"}, actionTable);

			var actionRow2 = dojo.create("tr", null, actionTable);
			var actionCol2 = dojo.create("td", {nowrap :true}, actionRow2, "last");
			dojo.create("input", {id:"amend", type:"checkbox" ,value: "Amend", title: "Amend last commit"}, actionCol2, "last");
			actionCol2.appendChild(document.createTextNode(" Amend"));
		},
		
		show:function(){
			this._commitZone.style.display = "";
		},
		
		hide:function(){
			this._commitZone.style.display = "none";
		}
	};
	return GitCommitZoneRenderer;
}());

orion.GitRebaseZoneRenderer = (function() {
	function GitRebaseZoneRenderer(serviceRegistry, parentId) {
		this._registry = serviceRegistry;
		this._parentId = parentId;
	}
	GitRebaseZoneRenderer.prototype = {
		render: function (renderSeparator) {
			this._rebaseZone = dojo.create("div", null, this._parentId, "last");
			
			var headerTable = dojo.create("table", {width:"100%"}, this._rebaseZone);
			var row = dojo.create("tr", null, headerTable);
			var titleCol = dojo.create("td", {nowrap :true}, row, "last");
			dojo.create("h2", {innerHTML: "Rebase in progress. Choose action:" }, titleCol, "last");
			
			var commitTable = dojo.create("table", null, this._rebaseZone);
			var commitRow = dojo.create("tr", null, commitTable);
			
			var actionCol = dojo.create("td", {nowrap :true}, commitRow, "last");
			var actionDiv = dojo.create("div", {style:"float: left;", align:"left"}, actionCol, "last");
			
			this._cmdSpan = dojo.create("span", {id:"rebaseActions"}, actionDiv, "last");

			if(	renderSeparator)
				dojo.create("table", {width:"100%", height:"10px"}, this._rebaseZone);
		},
		
		renderAction:function(){
			dojo.place(document.createTextNode(""), this._cmdSpan, "only");
			var self = this;
			this._registry.getService("orion.page.command").renderCommands(self._cmdSpan.id, self._cmdSpan, {type: "rebase"}, this, "button");
		},
		
		show:function(){
			this._rebaseZone.style.display = "";
		},
		
		hide:function(){
			this._rebaseZone.style.display = "none";
		}
	};
	return GitRebaseZoneRenderer;
}());

orion.GitCommitterAndAuthorZoneRenderer = (function() {
	function GitCommitterAndAuthorZoneRenderer(serviceRegistry, parentId) {
		this._registry = serviceRegistry;
		this._parentId = parentId;
	}
	GitCommitterAndAuthorZoneRenderer.prototype = {
		render: function (renderSeparator) {
			this._cmdSpanShow = dojo.create("span", {id:"personIdentShow"}, this._parentId, "last");
			this._cmdSpanHide = dojo.create("span", {id:"personIdentHide"}, this._parentId, "last");
			this._personIdentZone = dojo.create("div", null, this._parentId, "last");
			
			var committerTable = dojo.create("table", null, this._personIdentZone);
			var committerRow = dojo.create("tr", null, committerTable);
			var nameLabelCol = dojo.create("td", {nowrap :true}, committerRow, "last");
			dojo.create("h2", {innerHTML: "Committer name:"}, nameLabelCol, "last");
			var nameCol = dojo.create("td", {nowrap :true}, committerRow, "last");
			this._committerName = dojo.create("input", {id:"committerName", type:"text"}, nameCol, "last");
			var emailLabelCol = dojo.create("td", {nowrap :true}, committerRow, "last");
			dojo.create("h2", {innerHTML: "email:"}, emailLabelCol, "last");
			var emailCol = dojo.create("td", {nowrap :true}, committerRow, "last");
			this._committerEmail = dojo.create("input", {id:"committerEmail", type:"text"}, emailCol, "last");
			
			var authorRow = dojo.create("tr", null, committerTable);
			var nameLabelCol = dojo.create("td", {nowrap :true}, authorRow, "last");
			dojo.create("h2", {innerHTML: "Author name:\t" }, nameLabelCol, "last");
			var nameCol = dojo.create("td", {nowrap :true}, authorRow, "last");
			this._authorName = dojo.create("input", {id:"authorName", type:"text"}, nameCol, "last");
			var emailLabelCol = dojo.create("td", {nowrap :true}, authorRow, "last");
			dojo.create("h2", {innerHTML: "email:"}, emailLabelCol, "last");
			var emailCol = dojo.create("td", {nowrap :true}, authorRow, "last");
			this._authorEmail = dojo.create("input", {id:"authorEmail", type:"text"}, emailCol, "last");
			
			if(	renderSeparator)
				dojo.create("table", {width:"100%", height:"10px"},this._parentId);
		},
		
		renderAction:function(){
			dojo.place(document.createTextNode(""), this._cmdSpanShow, "only");
			dojo.place(document.createTextNode(""), this._cmdSpanHide, "only");
			var self = this;
			var service = this._registry.getService("orion.page.command");
			service.renderCommands(self._cmdSpanShow.id, self._cmdSpanShow, {type: "personIdentShow"}, this, "button");
			service.renderCommands(self._cmdSpanHide.id, self._cmdSpanHide, {type: "personIdentHide"}, this, "button");
		},
		
		setDefaultPersonIdent:function(name, email) {
			this._defName = name;
			this._defEmail = email;
		},
		
		show:function() {
			this._personIdentZone.style.display = "";
			this._cmdSpanHide.style.display = "";
			this._cmdSpanShow.style.display = "none";
		},
		
		hide:function() {
			this._personIdentZone.style.display = "none";
			this._cmdSpanHide.style.display = "none";
			this._cmdSpanShow.style.display = "";
			this.resetCommitterAndAuthor();
		},
		
		resetCommitterAndAuthor:function() {
			this._committerName.value = this._defName; 
			this._committerEmail.value = this._defEmail;
			this._authorName.value = this._defName; 
			this._authorEmail.value = this._defEmail;		
		}
	};
	return GitCommitterAndAuthorZoneRenderer;
}());

orion.GitLogTableRenderer = (function() {
	function GitLogTableRenderer(controller ,serviceRegistry ,parentId , header , type ) {
		this._controller = controller;
		this._registry = serviceRegistry;
		this._parentId = parentId;
		this._header = header;
		this._type = type;
		//The section Id represents a div that wraps the header , separator , and log contetn div
		this._sectionId = this._parentId + "_" + this._type + "_section";
	}
	GitLogTableRenderer.prototype = {
		render: function (renderSeparator) {
			var section = dojo.create("div", {id:this._sectionId}, this._parentId);
			var headingSection = mUtil.createPaneHeading(section, this._type + "heading", this._header, true, this._type + "_header", this._type + "commands");
			dojo.addClass(headingSection, "paneHeadingFixed");
			var idAdditional = this._type+"commandSpanAdditional";
			this._cmdSpanAdditional = dojo.create("span", {"id": idAdditional}, this._type + "commands", "last");
			dojo.addClass(this._cmdSpanAdditional, "statusLogCmd paneHeadingCommands");
			var id = this._type+"commandSpan";
			this._cmdSpan = dojo.create("span", {"id": id}, this._type + "commands", "last");
			var commandService = this._registry.getService("orion.page.command");
			if (this._type === "gitRemote") {
				commandService.registerCommandContribution(id, "orion.openGitRemote", 1);	
				commandService.registerCommandContribution(idAdditional, "eclipse.orion.git.fetch", 2);	
				commandService.registerCommandContribution(idAdditional, "eclipse.orion.git.merge", 3);	
			} else {
				commandService.registerCommandContribution(id, "orion.openGitLog", 1);	
				commandService.registerCommandContribution(idAdditional, "eclipse.orion.git.push", 2);	
			}
			dojo.addClass(this._cmdSpan, "statusLogCmd paneHeadingCommands");
			this._logContentId = this._parentId + "_" + this._type + "_content";
			var contentDiv = dojo.create("div", {id:this._logContentId }, section, "last");
			dojo.addClass(contentDiv, "statusLogContent");
		},
		
		getLogContentId: function(){
			return this._logContentId;
		},
			
		getLogSectionId: function(){
			return this._sectionId;
		},
			
		modifyHeader: function(location){
			//We should make sure that the header DIV still exist because sometimes the whole remote mini log is emptied.
			if(dojo.byId(this._type + "_header")){
				dojo.place(document.createTextNode("Recent commits on " + location), this._type + "_header", "only");
			}
		},
		
		renderAction:function(){
			dojo.place(document.createTextNode(""), this._cmdSpan, "only");
			var self = this;
			this._registry.getService("orion.page.command").renderCommands(self._cmdSpan.id, self._cmdSpan, {type: self._type , model: self._controller._model, branch: self._controller._curBranch}, this, "button");
		},
		
		renderAdditionalAction:function(item){
			dojo.place(document.createTextNode(""), this._cmdSpanAdditional, "only");
			var self = this;
			this._registry.getService("orion.page.command").renderCommands(self._cmdSpanAdditional.id, self._cmdSpanAdditional, item, this, "button");
		}
	};
	return GitLogTableRenderer;
}());

orion.InlineCompareRenderer = (function() {
	function InlineCompareRenderer(serviceRegistry ,parentId) {
		this._registry = serviceRegistry;
		this._parentId = parentId;
	}
	InlineCompareRenderer.prototype = {
		render: function (createCommandSpan) {
			var titleTable = dojo.create("table" , {width:"100%"});
			var row = dojo.create("tr", null, titleTable);
			var titleCol = dojo.create("td", {nowrap :true}, row, "last");
			var title = dojo.create("h2", {id :"fileNameInViewer" ,innerHTML: "Select a file on the left to compare..."}, titleCol, "last");
			var titleDiv = new dijit.layout.ContentPane({region: "top"});
			dojo.addClass(titleDiv.domNode, "inlineCompareTitle");
			titleDiv.attr('content', titleTable);
			
			var viewerDiv = new dijit.layout.ContentPane({"class":"mainpane" ,id : "inline-compare-viewer" ,splitter:false ,region: "center"});
			dojo.addClass(viewerDiv.domNode, 'mainpane');
			dojo.addClass(viewerDiv.domNode, 'inlineCompareContent');
			
			var parent = dijit.byId(this._parentId);
			parent.addChild(titleDiv);
			parent.addChild(viewerDiv);
			if (createCommandSpan) {
				td = document.createElement('td');
				td.id = "compare_rightContainerCommands"; // this id should not be known here.  It is decided in compare-container.js
				row.appendChild(td);
				td.noWrap = true;
				row.align = "right";
				titleTable.align = "right";
			}
		}
		
	};
	return InlineCompareRenderer;
}());

orion.GitStatusController = (function() {
	function GitStatusController(options ,serviceRegistry , commandService , statusService, unstagedDivId , stagedDivId) {
		this._registry = serviceRegistry;
		this._commandService = commandService;
		this._statusService = statusService;
		this._model = new orion.GitStatusModel();
		this._timerOn = false;
		this._renderLog = options.renderLog ? true:false;
		this._generateCommands();
		this._unstagedTableRenderer = new orion.GitStatusTableRenderer({useCheckBox:true}, serviceRegistry ,"statusZone" , "Unstaged" , "unstagedItems");
		this._unstagedTableRenderer.render(true);
		this._stagedTableRenderer = new orion.GitStatusTableRenderer({useCheckBox:true}, serviceRegistry ,"statusZone" , "Staged" , "stagedItems");
		this._stagedTableRenderer.render(true);
		this._commitZoneRenderer = new orion.GitCommitZoneRenderer(serviceRegistry ,"statusZone");
		this._commitZoneRenderer.render(true);
		this._rebaseZoneRenderer = new orion.GitRebaseZoneRenderer(serviceRegistry, "statusZone");
		this._rebaseZoneRenderer.render(true);
		this._committerAndAuthorZoneRenderer = new orion.GitCommitterAndAuthorZoneRenderer(serviceRegistry, "statusZone");
		this._committerAndAuthorZoneRenderer.render(true);
		if(this._renderLog){
			this._logTableRenderer = new orion.GitLogTableRenderer(this ,serviceRegistry ,"logZone" , "Recent commits on" , "gitLog");
			this._logTableRenderer.render(true);
			this._logTableRenderer.renderAction();
			
			this._remoteTableRenderer = new orion.GitLogTableRenderer(this,serviceRegistry ,"logZone" , "Recent commits on" , "gitRemote");
			this._remoteTableRenderer.render(true);
			this._remoteTableRenderer.renderAction();
		}
		
		(new orion.InlineCompareRenderer(serviceRegistry ,"viewerZone")).render(true);
		this._generateInlineCompareCmds();
		
		this._unstagedContentRenderer = new orion.GitStatusContentRenderer({useCheckBox:true}, serviceRegistry ,this._unstagedTableRenderer.getStatusContentId(), this);
		this._unstagedTableRenderer.contentRenderer = this._unstagedContentRenderer;
		this._stagedContentRenderer = new orion.GitStatusContentRenderer({useCheckBox:true}, serviceRegistry ,this._stagedTableRenderer.getStatusContentId() , this);
		this._stagedTableRenderer.contentRenderer = this._stagedContentRenderer;
		
		var diffProvider = new mCompareContainer.DefaultDiffProvider(serviceRegistry);
		var that = this;
		var options = {
				readonly: true,
				diffProvider: diffProvider
			};
			
		
		this._inlineCompareContainer = new mCompareContainer.InlineCompareContainer(serviceRegistry, "inline-compare-viewer", options);
		that._staging = false;
		that._stagingConflict = false;
		this.startTimer();		
		var commitBtn = document.getElementById("commit");
		commitBtn.onclick = function(evt){
			that.commit();
		};
	}
	GitStatusController.prototype = {
		loadStatus: function(jsonData){
			this._staging = false;
			this._model.init(jsonData);
			this._getCloneInfo();
		},
		
		_processStatus: function(){
			this.initViewer();
			this._model.selectedFileId = null;
			this._loadBlock(this._unstagedContentRenderer , this._model.interestedUnstagedGroup);
			this._loadBlock(this._stagedContentRenderer , this._model.interestedStagedGroup);
			this._stagedTableRenderer.disable(!this.hasStaged);
			this._unstagedTableRenderer.disable(!this.hasUnstaged);
			if(this._renderLog && this._initializing){
				var that = this;
				
				var commandService = this._registry.getService("orion.page.command");
				mGitCommands.createStatusCommands(that._registry , commandService , function(){that.getGitStatus(that._url ,true);} , 9 , that);
				
				this._renderLogs(false).then(function(){
					that._renderLogs(true);
					
				});
				
				
			}
			
			this._committerAndAuthorZoneRenderer.renderAction();
			this._unstagedTableRenderer.renderAction();
			this._stagedTableRenderer.renderAction();
		
			this._renderGlobalActions();
			if(this._stagingConflict){
				this._stagingConflict = false;
				if(!this.hasStaged){
					this.commit("Resolved deletion conflicts on file " + this._stagingName, false);
				}
			}
			
			this._statusService.setProgressMessage("");
			
			// check if repository state contains REBASING
			// (status could be: REBASING, REBASING_REBASING, REBASING_INTERACTIVE, REBASING_MERGE)
			if (this._model.items.RepositoryState.indexOf("REBASING") != -1) {
				this.rebaseState = true;
				// show rebase panel
				this._rebaseZoneRenderer.renderAction();
				this._rebaseZoneRenderer.show();
				this._commitZoneRenderer.hide();
			} 
			else {
				this.rebaseState = false;
				// show commit panel
				this._commitZoneRenderer.show();
				this._rebaseZoneRenderer.hide();
			}
		},
		
		_commitReady: function(){
			var amendBtn = document.getElementById("amend");
			if(this.hasStaged){
				return true;
			} else {
				if(amendBtn.checked)
					return true;
				else
					return false;
			}
		},
		
		_prepareStage: function(item, group){
			this._staging = true;
			if(group){
				for(var i = 0 ; i < item.length ;  i++){
					dojo.style(item[i].rowId + "_nameSpan", "color", "#666666");
				}
			} else {
				dojo.style(item + "_nameSpan", "color", "#666666");
			}
		},
		
		_renderGlobalActions:function(){
			var toolbar = dojo.byId( "pageActions");
			dojo.place(document.createTextNode(""), toolbar, "only");
			var self = this;
			this._registry.getService("orion.page.command").renderCommands(toolbar.id, toolbar, {type: "global"}, this, "button", true);
		},
		
		_processCloneInfo:function(){
			dojo.byId("logZone").style.display = "block";
			this._curBranch = undefined;
			for(var i=0; i<this._branchInfo.Children.length; i++){
				if(this._branchInfo.Children[i].Current)
					this._curBranch = this._branchInfo.Children[i];
			}
			this._curRemote =  ( this._remoteInfo &&  this._remoteInfo.Children && this._remoteInfo.Children.length > 0 ) ? this._remoteInfo.Children[0]:null;
			this._curClone = this._cloneInfo.Children[0];
			mGlobalCommands.setPageTarget(this._curClone, this._registry, this._commandService, dojo.hitch(this._curBranch || this._curRemote,
				function() {
					return this;
				}));
			this._initTitleBar(true);
			this._logTableRenderer.renderAction();
			this._remoteTableRenderer.renderAction();
			
			this._committerAndAuthorZoneRenderer.setDefaultPersonIdent(this._userName, this._userEmail);
			this._committerAndAuthorZoneRenderer.hide();
		},
		
		_initTitleBar:function(withBranchName){
			var title = "Git Status";
			var location = "";
			var branchName = this._curBranch ? this._curBranch.Name : "detached";
			if(withBranchName) {
				location = this._curClone.Name + " on " + branchName;
			}
			//render browser title
			document.title = location;
			//render page title
			//FIXME we should not know these global page ids inside component implementations
			dojo.place(document.createTextNode(title), "pageTitle", "only");
			if(withBranchName) {
				//render git status title on local branch 
				this._logTableRenderer.modifyHeader(branchName);
				if(this._curBranch && this._curRemote){
					branchName = (this._curBranch.RemoteLocation.length > 0 ? this._curBranch.RemoteLocation[0].Name : "") + "/" + this._curBranch.Name;
					//render git log title on remote branch
					this._remoteTableRenderer.modifyHeader(branchName);
				}
				//render page tilte details (clone name + remote name + local branch name)
				dojo.place(document.createTextNode(this._curClone.Name + " on " + branchName), "location", "only");
			}
			mUtil.forceLayout("pageTitle");

		},
		
		_getCloneInfo:function(){
			var that = this;
			if (that._initializing) {
				var path = that._model.items.CloneLocation;
				gitService = that._registry.getService("orion.git.provider");
				gitService.getGitClone(path, function(cloneJsonData, secondArd) {
					that._cloneInfo = cloneJsonData;
					if(that._cloneInfo.Children.length === 0){
						that._renderLog = false;
						that._initTitleBar();
						that._processStatus();
						return;
					}
					gitService.getGitBranch(that._cloneInfo.Children[0].BranchLocation).then(function(children){
						that._branchInfo = children;
						gitService.getGitRemote(that._cloneInfo.Children[0].RemoteLocation).then(function(children){
							that._remoteInfo = children;
							var userNamePath = that._cloneInfo.Children[0].ConfigLocation.replace("config", "config/user.name");
							var setUserEmailAndProcess = function(userEmail) {
								that._userEmail = userEmail;
								that._processCloneInfo();
								that._processStatus();
							};
							gitService.getGitCloneConfig(userNamePath).then(
								function(configEntry){
									that._userName = configEntry.Value;
									var userEmailPath = that._cloneInfo.Children[0].ConfigLocation.replace("config", "config/user.email");
									gitService.getGitCloneConfig(userEmailPath).then(
										function(configEntry){
											setUserEmailAndProcess(configEntry.Value);
										},
										function(error) {
											setUserEmailAndProcess("");
										});
								},
								function(error) {
									that._userName = "";
									var userEmailPath = that._cloneInfo.Children[0].ConfigLocation.replace("config", "config/user.email");
									gitService.getGitCloneConfig(userEmailPath).then(
										function(configEntry){
											setUserEmailAndProcess(configEntry.Value);
										},
										function(error) {
											setUserEmailAndProcess("");
										});
								});
						});
					});
				});
			} else {
				that._processStatus();
			}
		},
		
		_renderLogs:function(isRemote){
			var that = this;
			if(!this._renderLog)
				return;

			var retDeffered = new dojo.Deferred();
			if (isRemote) {
				if(!this._curRemote || !this._curBranch || this._curBranch.RemoteLocation.length!==1 || this._curBranch.RemoteLocation[0].Children.length!==1){
					//We want to empty the mini log section for the tracked remote branch if there is no such 
					dojo.empty(this._remoteTableRenderer.getLogSectionId());
					retDeffered.callback();
					return;
				}
		        this._gitCommitNavigatorRem = new mGitCommitNavigator.GitCommitNavigator(this._registry, null, {checkbox: false, actionScopeId: "itemLevelCommands", minimal: true}, this._remoteTableRenderer.getLogContentId());    
				if(dojo.byId(this._remoteTableRenderer.getLogContentId())){
					//If the remote section is rendered before, we need to empty the contents
					dojo.place(document.createTextNode(""), this._remoteTableRenderer.getLogContentId(), "only");
				} else {
					//If the remote section is not rendered before, we need to create the empty frame there
					this._remoteTableRenderer.render(true);
				}
				// refresh the commit list for the remote
				var path = this._curBranch.RemoteLocation[0].Children[0].Location + "?page=1&pageSize=5";
				dojo.xhrGet({
					url : path,
					headers : {
						"Orion-Version" : "1"
					},
					handleAs : "json",
					timeout : 5000,
					load : function(jsonData, secondArg) {
						var gitService = that._registry.getService("orion.git.provider");
						gitService.getLog(jsonData.HeadLocation, jsonData.Id, "Getting git incoming changes", function(scopedCommitsJsonData, secondArg) {
									that._gitCommitNavigatorRem.renderer.setIncomingCommits(scopedCommitsJsonData.Children);
									that._gitCommitNavigatorRem.loadCommitsList(jsonData.CommitLocation + "?page=1&pageSize=5", jsonData).then(function(){retDeffered.callback();});
									that._remoteTableRenderer.renderAdditionalAction(that._gitCommitNavigatorRem._lastTreeRoot);
						});
					},
					error : function(error, ioArgs) {
						if(ioArgs.xhr.status == 401 || ioArgs.xhr.status == 403){ 
							var currentXHR = this;
							mAuth.handleAuthenticationError(ioArgs.xhr, function(){
								dojo.xhrGet(currentXHR); // retry GET							
							});
						}else{
							that._gitCommitNavigatorRem.loadCommitsList(path, error).then(function(){retDeffered.callback();});	
						}
						console.error("HTTP status code: ", ioArgs.xhr.status);
					}
				});
			} else {
		        this._gitCommitNavigatorLog = new mGitCommitNavigator.GitCommitNavigator(this._registry, null, {checkbox: false, minimal: true},this._logTableRenderer.getLogContentId());
		        dojo.place(document.createTextNode(""), this._logTableRenderer.getLogContentId(), "only");
				var path = (that._curBranch ? that._curBranch.CommitLocation :  that._model.items.CommitLocation) + "?page=1&pageSize=5";
				dojo.xhrGet({ //TODO Bug 367352
					url : path,
					headers : {
						"Orion-Version" : "1"
					},
					handleAs : "json",
					timeout : 5000,
					load : function(commitLogJsonData, ioArgs) {
						
						function renderCommitLogJsonData(commitLogJsonData){
							if (commitLogJsonData.toRef == null || commitLogJsonData.toRef.RemoteLocation.length!==1 || commitLogJsonData.toRef.RemoteLocation[0].Children.length!==1 || !that._curBranch){
								that._gitCommitNavigatorLog.loadCommitsList((that._curBranch ? that._curBranch.CommitLocation :  that._model.items.CommitLocation) +"?page=1&pageSize=5", {Type:"LocalBranch" ,RemoteLocation: commitLogJsonData.toRef.RemoteLocation, Children: commitLogJsonData.Children}).then(function(){retDeffered.callback();});
								if(that._curRemote && that._curBranch)
									that._logTableRenderer.renderAdditionalAction(that._gitCommitNavigatorLog._lastTreeRoot);
							}
							else {
								dojo.xhrGet({
									url : commitLogJsonData.toRef.RemoteLocation[0].Children[0].Location,
									headers : {
										"Orion-Version" : "1"
									},
									handleAs : "json",
									timeout : 5000,
									load : function(remoteJsonData, secondArg) {
										that._registry.getService("orion.git.provider").getLog(remoteJsonData.CommitLocation, "HEAD", "Getting git incoming changes", function(scopedCommitsJsonData) {
												that._gitCommitNavigatorLog.renderer.setOutgoingCommits(scopedCommitsJsonData.Children);
												that._gitCommitNavigatorLog.loadCommitsList( that._curBranch.CommitLocation +"?page=1&pageSize=5" , {Type:"LocalBranch" ,RemoteLocation: commitLogJsonData.toRef.RemoteLocation, Children: commitLogJsonData.Children}).then(function(){retDeffered.callback();});
												if(that._curRemote)
													that._logTableRenderer.renderAdditionalAction(that._gitCommitNavigatorLog._lastTreeRoot);
											
										});
									},
									error : function(error, ioArgs) {
										console.error("HTTP status code: ", ioArgs.xhr.status);
										if(ioArgs.xhr.status == 401 || ioArgs.xhr.status == 403){ 
											var currentXHR = this;
											mAuth.handleAuthenticationError(ioArgs.xhr, function(){
												dojo.xhrGet(currentXHR); // retry GET							
											});
										}else{
											that._gitCommitNavigatorLog.loadCommitsList(path, {Type:"LocalBranch" ,RemoteLocation: commitLogJsonData.toRef.RemoteLocation, Children: commitLogJsonData.Children}).then(function(){retDeffered.callback();});
											if(that._curRemote && that._curBranch)
												that._logTableRenderer.renderAdditionalAction(that._gitCommitNavigatorLog._lastTreeRoot);
										}
									}
								});
							}
						}
						if(ioArgs.xhr.status===200){
							renderCommitLogJsonData(commitLogJsonData);
						} else if (ioArgs.xhr.status===202){
							var deferred = new dojo.Deferred();
							deferred.callback(commitLogJsonData);
							that._registry.getService("orion.page.progress").showWhile(deferred, "Getting git log").then(function(commitLogJsonData){renderCommitLogJsonData(commitLogJsonData.Result.JsonData);});
						}
						
					},
					error : function(error, ioArgs) {
						console.error("HTTP status code: ", ioArgs.xhr.status);
					}
				});
			}
			return retDeffered;
		},
		
		
		_generateCommands: function(){
			var self = this;
			var sbsCompareCommand = new mCommands.Command({
				name: "Compare",
				tooltip: "Show the side-by-side compare",
				imageClass: "git-sprite-open_compare",
				spriteClass: "gitCommandSprite",
				id: "orion.sbsCompare",
				hrefCallback: function(data) {
					return self.openCompareEditor(data.items.object);
				},
				visibleWhen: function(item) {
					return item.type === "fileItem";
				}
			});		

			var showCommitterAndAuthorPanel = new mCommands.Command({
				name : "Change Committer or Author",
				id : "orion.showCommitterAndAuthor",
				callback : function() {
					self._committerAndAuthorZoneRenderer.show();
				},
				visibleWhen : function(item) {
					return item.type === "personIdentShow";
				}
			});
			
			var hideCommitterAndAuthorPanel = new mCommands.Command({
				name : "Use Default Committer and Author",
				id : "orion.hideCommitterAndAuthor",
				callback : function() {
					self._committerAndAuthorZoneRenderer.hide();
				},
				visibleWhen : function(item) {
					return item.type === "personIdentHide";
				}
			});
			
			var checkoutCommand = new mCommands.Command({
				name: "Checkout",
				tooltip: "Checkout the file, discarding the unstaged change",
				imageClass: "git-sprite-checkout",
				spriteClass: "gitCommandSprite",
				id: "orion.gitCheckout",
				callback: function(data) {
					self._registry.getService("orion.page.dialog").confirm("Your changes to the file will be lost. Are you sure you want to checkout?", function(doit) {
						if (!doit) {
							return;
						}
						self._statusService.setProgressMessage("Checking out...");
						self.checkout([data.items.object.name]);
					});
				},
				visibleWhen: function(item) {
					return (item.type === "fileItem" && !self._model.isStaged(item.object.type));
				}
			});		

			var stageCommand = new mCommands.Command({
				name: "Stage",
				tooltip: "Stage the change",
				imageClass: "git-sprite-stage",
				spriteClass: "gitCommandSprite",
				id: "orion.gitStage",
				callback: function(data) {
					self._statusService.setProgressMessage("Staging...");
					self._prepareStage(data.items.rowId, false);
					return self.stage(data.items.object.indexURI , data.items.object);
				},
				visibleWhen: function(item) {
					return (item.type === "fileItem" && !self._model.isStaged(item.object.type));
				}
			});		

			var stageAllCommand = new mCommands.Command({
				name: "Stage",
				tooltip: "Stage the selected changes",
				imageClass: "git-sprite-stage_all",
				spriteClass: "gitCommandSprite",
				id: "orion.gitStageAll",
				callback: function(data) {
					self._statusService.setProgressMessage("Staging...");
					return self.stageSelected();
				},
				visibleWhen: function(item) {
					var return_value = (item.type === "unstagedItems" && self.hasUnstaged && self._unstagedContentRenderer.getSelected().length > 0);
					return return_value;
				}
			});		
			
			var checkoutAllCommand = new mCommands.Command({
				name: "Checkout",
				tooltip: "Checkout all the selected files, discarding all changes",
				imageClass: "git-sprite-checkout",
				spriteClass: "gitCommandSprite",
				id: "orion.gitCheckoutAll",
				callback: function(data) {
					self._registry.getService("orion.page.dialog").confirm("Your changes to all the selected files will be lost. Are you sure you want to checkout?", function(doit) {
						if (!doit) {
							return;
						}
						self._statusService.setProgressMessage("Checking out...");
						self.checkoutSelected();
					});
				},
				visibleWhen: function(item) {
					var return_value = (item.type === "unstagedItems" && self.hasUnstaged && self._unstagedContentRenderer.getSelected().length > 0);
					return return_value;
				}
			});		
			
			var savePatchCommand = new mCommands.Command({
				name: "Save Patch",
				tooltip: "Save workspace changes as a patch",
				imageClass: "git-sprite-diff",
				spriteClass: "gitCommandSprite",
				id: "orion.gitSavePatch",
				hrefCallback : function() {
					var url = self._curClone.DiffLocation + "?parts=diff";
					var selectedItems = self._unstagedContentRenderer.getSelected();
					for (var i = 0; i < selectedItems.length; i++) {
						url += "&Path=";
						url += selectedItems[i].modelItem.path;
					}
					return url;
				},
				visibleWhen: function(item) {
					var return_value = (item.type === "unstagedItems" && self.hasUnstaged && self._unstagedContentRenderer.getSelected().length > 0);
					return return_value;
				}
			});

			var unstageCommand = new mCommands.Command({
				name: "Unstage",
				tooltip: "Unstage the change",
				imageClass: "git-sprite-unstage",
				spriteClass: "gitCommandSprite",
				id: "orion.gitUnstage",
				callback: function(data) {
					self._statusService.setProgressMessage("Unstaging...");
					return self.unstage(data.items.object);
				},
				visibleWhen: function(item) {
					return item.type === "fileItem" && self._model.isStaged(item.object.type);
				}
			});		

			var unstageAllCommand = new mCommands.Command({
				name: "Unstage",
				tooltip: "Unstage the selected changes",
				imageClass: "git-sprite-unstage_all",
				spriteClass: "gitCommandSprite",
				id: "orion.gitUnstageAll",
				callback: function(data) {
					self._statusService.setProgressMessage("Unstaging...");
					return self.unstageSelected("MIXED");
				},
				visibleWhen: function(item) {
					var return_value = (item.type === "stagedItems" && self.hasStaged && self._stagedContentRenderer.getSelected().length > 0);
					return return_value;
				}
			});		

			var resetChangesCommand = new mCommands.Command({
				name: "Reset",
				tooltip: "Reset the branch, discarding all staged and unstaged changes",
				imageClass: "git-sprite-refresh",
				spriteClass: "gitCommandSprite",
				id: "orion.gitResetChanges",
				callback: function(data) {
					var dialog = self._registry.getService("orion.page.dialog");
					dialog.confirm("All unstaged and staged changes in the working directory and index will be discarded and cannot be recovered.\n" +
						"Are you sure you want to continue?",
						function(doit) {
							if (!doit) {
								return;
							}
							self._statusService.setProgressMessage("Resetting local changes...");
							return self.unstageAll("HARD");
						}
					);
				},
				
				visibleWhen: function(item) {
					return (self.hasStaged || self.hasUnstaged);
				}
			});
			
			var rebaseContinueCommand = new mCommands.Command({
				name: "Continue",
				tooltip: "Continue rebase",
				id: "orion.gitRebaseContinue",
				callback: function() {
						self._statusService.setProgressMessage("Continue rebase...");
						return self.rebase("CONTINUE");
				},
				visibleWhen: function(data) {
					return self.rebaseState;
				}
			});	
			
			var rebaseSkipCommand = new mCommands.Command({
				name: "Skip Patch",
				tooltip: "Skip patch",
				id: "orion.gitRebaseSkip",
				callback: function() {
						self._statusService.setProgressMessage("Skipping patch...");
						return self.rebase("SKIP");
				},
				visibleWhen: function(data) {
					return self.rebaseState;
				}
			});	
			
			var rebaseAbortCommand = new mCommands.Command({
				name: "Abort",
				tooltip: "Abort rebase",
				id: "orion.gitRebaseAbort",
				callback: function() {
						self._statusService.setProgressMessage("Aborting rebase...");
						return self.rebase("ABORT");
				},
				visibleWhen: function(data) {
					return self.rebaseState;
				}
			});		
			
			var openGitLog = new mCommands.Command({
				name : "Complete log",
				id : "orion.openGitLog",
				hrefCallback : function(data) {
					return require.toUrl("git/git-log.html") +"#" + (data.items.branch ? data.items.branch.CommitLocation : data.items.model.items.CommitLocation) + "?page=1";
				},
				visibleWhen : function(item) {
					return item.type === "gitLog" && ((item.branch && item.branch.CommitLocation) || (item.model && item.model.items && item.model.items.CommitLocation));
				}
			});
		
			var openGitRemote = new mCommands.Command({
				name : "Complete log",
				id : "orion.openGitRemote",
				hrefCallback : function(data) {
					return require.toUrl("git/git-log.html") +"#" + data.items.branch.RemoteLocation[0].Children[0].Location + "?page=1";
				},
				visibleWhen : function(item) {
					return (item.type === "gitRemote" && item.branch && item.branch.RemoteLocation.length===1 && item.branch.RemoteLocation[0].Children.length===1);
				}
			});
			
			var commandService = this._registry.getService("orion.page.command");
			// register commands with object scope
			commandService.addCommand(sbsCompareCommand);
			commandService.addCommand(stageCommand);	
			commandService.addCommand(checkoutCommand);
			commandService.addCommand(stageAllCommand);
			commandService.addCommand(checkoutAllCommand);
			commandService.addCommand(savePatchCommand);
			commandService.addCommand(unstageAllCommand);
			commandService.addCommand(unstageCommand);
			commandService.addCommand(resetChangesCommand);
			commandService.addCommand(rebaseContinueCommand);
			commandService.addCommand(rebaseSkipCommand);
			commandService.addCommand(rebaseAbortCommand);
			commandService.addCommand(resetChangesCommand);
			commandService.addCommand(showCommitterAndAuthorPanel);
			commandService.addCommand(hideCommitterAndAuthorPanel);
			commandService.addCommand(openGitLog);	
			commandService.addCommand(openGitRemote);	
			
			// object level contributions
			commandService.registerCommandContribution("itemLevelCommands", "orion.gitStage", 100);
			commandService.registerCommandContribution("itemLevelCommands", "orion.gitCheckout", 101);	
			commandService.registerCommandContribution("itemLevelCommands", "orion.gitUnstage", 102);	
			commandService.registerCommandContribution("itemLevelCommands", "orion.sbsCompare", 103);	
			
			// dom level contributions for commands with known ids.
			commandService.registerCommandContribution("pageActions", "orion.gitResetChanges", 1);
			commandService.registerCommandContribution("rebaseActions", "orion.gitRebaseContinue", 2);
			commandService.registerCommandContribution("rebaseActions", "orion.gitRebaseSkip", 3);	
			commandService.registerCommandContribution("rebaseActions", "orion.gitRebaseAbort", 4);
			commandService.registerCommandContribution("personIdentShow", "orion.showCommitterAndAuthor", 1);
			commandService.registerCommandContribution("personIdentHide", "orion.hideCommitterAndAuthor", 2);
			
			// dynamically generated sections register their commands once the id of tool area is computed
		},

		_generateInlineCompareCmds: function(){	
			var that = this;
			var nextDiffCommand = new mCommands.Command({
				tooltip : "Next Diff",
				imageClass : "core-sprite-move_down",
				id: "orion.compare.nextDiff",
				groupId: "orion.compareGroup",
				/*
				visibleWhen: function(item) {
					return that._inlineCompareContainer && that._inlineCompareContainer.hasContent;
				},*/
				
				callback : function() {
					that._inlineCompareContainer.nextDiff();
			}});
			var prevDiffCommand = new mCommands.Command({
				tooltip : "Previous Diff",
				imageClass : "core-sprite-move_up",
				id: "orion.compare.prevDiff",
				groupId: "orion.compareGroup",
				
				
				callback : function() {
					that._inlineCompareContainer.prevDiff();
			}});
			
			this._commandService.addCommand(prevDiffCommand);
			this._commandService.addCommand(nextDiffCommand);
				
			// Register command contributions
			this._commandService.registerCommandContribution("compare_rightContainerCommands", "orion.compare.prevDiff", 2);
			this._commandService.registerCommandContribution("compare_rightContainerCommands", "orion.compare.nextDiff", 1);
			this._commandService.renderCommands("compare_rightContainerCommands", "compare_rightContainerCommands", self, self, "button");
		},
		
		startTimer: function(){
			if(!this.timerOn){
				this.timerOn = true;
				this.doTimer();
			}
		},
		
		stopTimer: function(){
			if(this.timerOn && this._timerId){
				this.timerOn = false;
				clearTimeout(this._timerId);
			}
		},
		
		doTimer: function(){
			var messageArea = document.getElementById("commitMessage");
			var commitBtn = document.getElementById("commit");
			if(this._staging){
				commitBtn.disabled = true;
				messageArea.disabled = false;
			} else {
				commitBtn.disabled = !(this._commitReady() && messageArea.value !== "");
				messageArea.disabled = !this._commitReady();
			}
			
			this._timerId = setTimeout(dojo.hitch(this, function() {
				this.doTimer(); 
			}), 150);
		},
		
		initViewer: function () {
		  	this._inlineCompareContainer.destroyEditor();
			this._model.selectedItem = null;
			this.hasStaged = false;
			this.hasUnstaged = false;
			dojo.place(document.createTextNode("Select a file on the left to compare..."), "fileNameInViewer", "only");
			dojo.style("fileNameInViewer", "color", "#6d6d6d");
			dojo.empty("compare_rightContainerCommands");
		},

		_createImgButton: function(enableWaitCursor ,imgParentDiv , imgSrc, imgTitle,onClick){
			var imgBtn = document.createElement('img');
			imgBtn.src = imgSrc;
			imgParentDiv.appendChild(imgBtn);
			this.modifyImageButton(enableWaitCursor ,imgBtn , imgTitle,onClick);
		},
		
		_modifyImageButton: function(enableWaitCursor , imgBtnDiv , imgTitle, onClick , disabled , onHoverCallBack){
			var self = this;
			if(disabled === undefined || !disabled){
				imgBtnDiv.title= imgTitle;
				
				dojo.style(imgBtnDiv, "opacity", "0.4");
				dojo.connect(imgBtnDiv, "onmouseover", imgBtnDiv, function() {
					var disableOnHover = false;
					if(onHoverCallBack)
						disableOnHover = onHoverCallBack();
					imgBtnDiv.style.cursor = self.loading ? 'wait' : (disableOnHover ? "default" : "pointer");
					if(disableOnHover)
						dojo.style(imgBtnDiv, "opacity", "0.4");
					else
						dojo.style(imgBtnDiv, "opacity", "1");
				});
				dojo.connect(imgBtnDiv, "onmouseout", imgBtnDiv , function() {
					imgBtnDiv.style.cursor = self.loading ? 'wait' : "default";
					dojo.style(imgBtnDiv, "opacity", "0.4");
				});
				imgBtnDiv.onclick = function(evt){
					var disableOnHover = false;
					if(onHoverCallBack)
						disableOnHover = onHoverCallBack();
					if(enableWaitCursor && !disableOnHover)
						//self.cursorWait(imgBtnDiv , true) ;
					if(!disableOnHover)
						onClick(evt);
				};
			} else {
				imgBtnDiv.title= "";
				imgBtnDiv.style.cursor =  self.loading ? 'wait' : "default";
				dojo.style(imgBtnDiv, "opacity", "0.0");
				dojo.connect(imgBtnDiv, "onmouseover", imgBtnDiv, function() {
					imgBtnDiv.style.cursor = self.loading ? 'wait' : "default";
					dojo.style(imgBtnDiv, "opacity", "0");
				});
				dojo.connect(imgBtnDiv, "onmouseout", imgBtnDiv , function() {
					imgBtnDiv.style.cursor = self.loading ? 'wait' : "default";
					dojo.style(imgBtnDiv, "opacity", "0");
				});
				imgBtnDiv.onclick = null;
			}
		},
		
		_sortBlock: function(interedtedGroup){
			var retValue = [];
			for (var i = 0; i < interedtedGroup.length ; i++){
				var groupName = interedtedGroup[i];
				var groupData = this._model.getGroupData(groupName);
				if(!groupData)
					continue;
				for(var j = 0 ; j < groupData.length ; j++){
					var renderType = this._model.getModelType(groupData[j] , groupName);
					if(renderType){
						retValue.push({name:groupData[j].Name, 
											type:renderType, 
											location:groupData[j].Location,
											path:groupData[j].Path,
											commitURI:groupData[j].Git.CommitLocation,
											indexURI:groupData[j].Git.IndexLocation,
											diffURI:groupData[j].Git.DiffLocation,
											conflicting:this._model.isConflict(renderType)
						});
					}
				} 
			}
			retValue.sort(function(a, b) {
				var n1 = a.name && a.name.toLowerCase();
				var n2 = b.name && b.name.toLowerCase();
				if (n1 < n2) { return -1; }
				if (n1 > n2) { return 1; }
				return 0;
			}); 
			return retValue;
		},
			
		
		_loadBlock: function(renderer , interedtedGroup){
			renderer.initTable();
			var retValue = this._sortBlock(interedtedGroup);
			for (var i = 0; i < retValue.length ; i++){
				renderer.renderRow(retValue[i], i);
			}
			renderer.totalRow = retValue.length;
			return retValue.length;
		},
		
		loadDiffContent: function(itemModel){
			this._statusService.setProgressMessage("Loading diff...");
			var self = this;
			var diffVS = this._model.isStaged(itemModel.type) ? "index VS HEAD ) " : "local VS index ) " ;
			this._inlineCompareContainer.setDiffTitle("Compare( " + orion.statusTypeMap[itemModel.type][1] + " : " +diffVS) ;
			
			this._inlineCompareContainer.setOptions({hasConflicts: this._model.isConflict(itemModel.type),
													 complexURL: itemModel.diffURI});
			
			this._inlineCompareContainer.clearContent();
			this._inlineCompareContainer.startup();
		},
		
		openCompareEditor: function(itemModel){
			var diffParam = "";
			var baseUrl = require.toUrl("compare/compare.html") +"#";
			var paramLength = 0;
			if(this._model.isStaged(itemModel.type)){
				diffParam = "readonly";
				paramLength = 1;
			} 
			if(this._model.isConflict(itemModel.type)){
				if(paramLength === 0)
					diffParam = "conflict";
				else
					diffParam = diffParam + "&conflict";
				paramLength++;	
			}
			if(paramLength > 0)
				baseUrl = require.toUrl("compare/compare.html") + "?" + diffParam + "#";
			var url = baseUrl + itemModel.diffURI;
			return url;
			//window.open(url,"");
		},
		
		handleServerErrors: function(errorResponse , ioArgs){
			var display = [];
			display.Severity = "Error";
			display.HTML = false;
			
			try{
				var resp = JSON.parse(errorResponse.responseText);
				display.Message = resp.DetailedMessage ? resp.DetailedMessage : resp.Message;
			}catch(Exception){
				display.Message =  typeof(errorResponse.message) === "string" ? errorResponse.message : ioArgs.xhr.statusText;//dojo.fromJson(ioArgs.xhr.responseText).DetailedMessage;
			}
			
			this._statusService.setProgressResult(display);
		},
		
		getGitStatus: function(url , initializing){
			this._url = url;
			this._initializing = (initializing ? true : false);
			if (this._initializing) {
				this._cloneInfo = undefined;
				this._statusService.setProgressMessage("Loading status...");
			}
			var self = this;
			self._registry.getService("orion.git.provider").getGitStatus(url, function(jsonData, secondArg) {
				self.loadStatus(jsonData);
			}, function(response, ioArgs) {
				self.handleServerErrors(response, ioArgs);
			});
		},
		
		stage: function(location , itemModel){
			var self = this;
			if (itemModel && itemModel.conflicting) {
				self._stagingConflict = true;
				self._stagingName = itemModel.name;
			} else
				self._stagingConflict = false;
			self._registry.getService("orion.git.provider").stage(location, function(jsonData, secondArg) {
				self.getGitStatus(self._url);
			}, function(response, ioArgs) {
				self.handleServerErrors(response, ioArgs);
			});

		},
		
		stageSelected: function(){
			var selectedItems = this._unstagedContentRenderer.getSelected();
			if(selectedItems.length === 0)
				return;
			this._prepareStage(selectedItems, true);
			this._unstagedTableRenderer.select(false);
			this._stagedTableRenderer.select(false);
			if(this._unstagedContentRenderer.totalRow === selectedItems.length)
				//this.stageAll();
				this.stageMultipleFiles(selectedItems);
			else
				//this.stageOneSelection(selectedItems, 0);
				this.stageMultipleFiles(selectedItems);
		},

		checkoutSelected: function(){
			var selection = this._unstagedContentRenderer.getSelected();
			if(selection.length === 0)
				return;
			this._prepareStage(selection, true);
			this._unstagedTableRenderer.select(false);
			this._stagedTableRenderer.select(false);
			var nameList = [];
			for ( var i = 0; i < selection.length; i++) {
				var itemModel = selection[i].modelItem;
				if (itemModel && itemModel.name) {
					nameList.push(itemModel.name);
				}
			}
			this.checkout(nameList);
		},

		stageOneSelection: function (selection, index){
			var that = this;
			var itemModel = selection[index].modelItem;
			if (itemModel && itemModel.conflicting) {
				that._stagingConflict = true;
				that._stagingName = itemModel.name;
			}
			that._registry.getService("orion.git.provider").stage(itemModel.indexURI, function(jsonData, secondArg) {
				if (index === (selection.length - 1)) {
					that.getGitStatus(that._url);
				} else {
					that.stageOneSelection(selection, index + 1);
				}
			}, function(response, ioArgs) {
				that.handleServerErrors(response, ioArgs);
			});
		},

		stageMultipleFiles: function (selection){
			var that = this;
			var paths = [];
			for ( var i = 0; i < selection.length; i++) {
				var itemModel = selection[i].modelItem;
				if (itemModel && itemModel.conflicting) {
					that._stagingConflict = true;
					that._stagingName = itemModel.name;
				}
				paths.push(itemModel.name);
			}
			that._registry.getService("orion.git.provider").stageMultipleFiles(that._model.items.IndexLocation, paths, function(jsonData, secondArg) {
				that.getGitStatus(that._url);
			}, function(response, ioArgs) {
				that.handleServerErrors(response, ioArgs);
			});
		},

		checkout: function(itemNameList){
			var self = this;
			var location = this._model.items.CloneLocation;
			self._registry.getService("orion.git.provider").checkoutPath(location, itemNameList, function(jsonData, secondArg) {
				self.getGitStatus(self._url);
			}, function(response, ioArgs) {
				self.handleServerErrors(response, ioArgs);
			});
		},
		
		stageAll: function(){
			this.stage(this._curClone.IndexLocation);
		},

		unstageSelected: function(resetParam){
			var selectedItems = this._stagedContentRenderer.getSelected();
			this._stagedTableRenderer.select(false);
			this._unstagedTableRenderer.select(false);
			if(selectedItems.length === 0)
				return;
			if(this._stagedContentRenderer.totalRow === selectedItems.length)
				this.unstageAll(resetParam);
			else
				this.unstageMultipleFiles(selectedItems);
		},
		
		unstage: function(itemModel){
			var self = this;
			self._registry.getService("orion.git.provider").unstage(self._model.items.IndexLocation, [itemModel.name], function(jsonData, secondArg) {
				self.getGitStatus(self._url);
			}, function(response, ioArgs) {
				self.handleServerErrors(response, ioArgs);
			});
		},
		
		unstageAll: function(resetParam){
			var self = this;
			self._registry.getService("orion.git.provider").unstageAll(self._model.items.IndexLocation, resetParam, function(jsonData, secondArg) {
				self.getGitStatus(self._url);
			}, function(response, ioArgs) {
				self.handleServerErrors(response, ioArgs);
			});
		},
		
		unstageMultipleFiles: function(selection){
			var that = this;
			var paths = [];
			for ( var i = 0; i < selection.length; i++) {
				var itemModel = selection[i].modelItem;
				paths.push(itemModel.name);
			}
			that._registry.getService("orion.git.provider").unstage(that._model.items.IndexLocation, paths, function(jsonData, secondArg) {
				that.getGitStatus(that._url);
			}, function(response, ioArgs) {
				that.handleServerErrors(response, ioArgs);
			});
		},
		
		commitAll: function(location , message , body){
			var self = this;
			var messageArea = document.getElementById("commitMessage");
			messageArea.value = "";
			self._statusService.setProgressMessage("Committing...");
			self._registry.getService("orion.git.provider").commitAll(location, message, body, function(jsonData, secondArg) {
				self.getGitStatus(self._url, true);
			}, function(response, ioArgs) {
				self.handleServerErrors(response, ioArgs);
			});
		},
		
		commit: function(message, amend, committerName, committerEmail, authorName, authorEmail){
			var body = {};
			if(!message) {
				var messageArea = document.getElementById("commitMessage");
				message = messageArea.value;
				if(message !== "")
					body.Message = message;
				else
					return;
			}
	
			if(!amend) {
				var amendBtn = document.getElementById("amend");
				amend = amendBtn.checked;
				if(amend)
					body.Amend = "true";
			}
			
			if(!committerName) {
				var committerNameInput = document.getElementById("committerName");
				committerName =  committerNameInput.value;
				body.CommitterName = committerName;
				if (!committerName) {
					this.reportWarning("The committer name is required.");
					this._committerAndAuthorZoneRenderer.show();
					return;
				}
			}
			if(!committerEmail) {
				var committerEmailInput = document.getElementById("committerEmail");
				committerEmail =  committerEmailInput.value;
				body.CommitterEmail = committerEmail;
				if (!committerEmail) {
					this.reportWarning("The committer mail is required.");
					this._committerAndAuthorZoneRenderer.show();
					return;
				}
			}
			if(!authorName) {
				var authorNameInput = document.getElementById("authorName");
				authorName =  authorNameInput.value;
				body.AuthorName = authorName;
				if (!authorName) {
					this.reportWarning("The author name is required.");
					this._committerAndAuthorZoneRenderer.show();
					return;
				}
			}
			if(!authorEmail) {
				var authorEmailInput = document.getElementById("authorEmail");
				authorEmail =  authorEmailInput.value;
				body.AuthorEmail = authorEmail;
				if (!authorEmail) {
					this.reportWarning("The author mail is required.");
					this._committerAndAuthorZoneRenderer.show();
					return;
				}
			}
			
			this.commitAll(this._curClone.HeadLocation, message, dojo.toJson(body));
		},
		
		reportWarning: function(message){
			var display = [];
			display.Severity = "Warning";
			display.Message = message;
			this._registry.getService("orion.page.message").setProgressResult(display);
		},
				
		rebase: function(action){
			var self = this;
			self._registry.getService("orion.git.provider").doRebase(self._curClone.HeadLocation, "", action, function(jsonData) {
				if (jsonData.Result == "OK" || jsonData.Result == "ABORTED" || jsonData.Result == "FAST_FORWARD" || jsonData.Result == "UP_TO_DATE") {
					var display = [];
					display.Severity = "Ok";
					display.HTML = false;
					display.Message = jsonData.Result;
					self._statusService.setProgressResult(display);
					self.getGitStatus(self._url);
				}
				if (jsonData.Result == "STOPPED") {
					var display = [];
					display.Severity = "Warning";
					display.HTML = false;
					display.Message = jsonData.Result + ". Repository still contains conflicts.";
					self._statusService.setProgressResult(display);
					self.getGitStatus(self._url);
				} else if (jsonData.Result == "FAILED_UNMERGED_PATHS") {
					var display = [];
					display.Severity = "Error";
					display.HTML = false;
					display.Message = jsonData.Result + ". Repository contains unmerged paths. Resolve conflicts first.";
					self._statusService.setProgressResult(display);
				}
			}, function(response, ioArgs) {
				self.handleServerErrors(response, ioArgs);
			});
		}	
	};
	return GitStatusController;
}());

return orion;	
});
