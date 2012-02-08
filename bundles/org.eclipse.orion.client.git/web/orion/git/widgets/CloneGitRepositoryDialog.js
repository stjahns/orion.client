/******************************************************************************* 
 * @license
 * Copyright (c) 2010, 2012 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/

/*global dojo dijit widgets*/
/*jslint browser:true*/
define(['require', 'dojo', 'dijit', 'dijit/Dialog', 'orion/widgets/_OrionDialogMixin', 'orion/widgets/DirectoryPrompterDialog', 'text!orion/git/widgets/templates/CloneGitRepositoryDialog.html'], function(require, dojo, dijit) {

/**
 * @param options {{ 
 *     func: function
 * }}
 */
dojo.declare("orion.git.widgets.CloneGitRepositoryDialog", [dijit.Dialog, orion.widgets._OrionDialogMixin], {
	widgetsInTemplate: true,
	templateString: dojo.cache('orion', 'git/widgets/templates/CloneGitRepositoryDialog.html'),
	
	constructor : function() {
		this.inherited(arguments);
		this.options = arguments[0] || {};
	},
	postMixInProperties : function() {
		this.inherited(arguments);
		this.title = this.options.title ? this.options.title : "Clone Git Repository";
		this.gitUrlLabelText = "Repository URL:";
		this.gitPathLabelText = "Existing directory:";
		this.gitNameLabelText = "New folder:";
		this.advancedShown = false;
	},
	postCreate : function(){
		var that = this;
		this.inherited(arguments);
		if (this.options.url) {
			this.gitUrl.value = this.options.url;
		}
		if(this.options.advancedOnly){
			this.Basic.style.display="none";
			this.Advanced.style.display="";
			setTimeout(function(){that.gitName.focus();}, 400);
		}
		
		dojo.connect(this.changeGitPath, "onclick", null, dojo.hitch(this, this.openDirectoryPickerDialog));
		dojo.connect(this.isExistingProject, "onchange", null, dojo.hitch(this, this.showExistingFolder));
		dojo.connect(this.gitName, "onfocus", null, dojo.hitch(this, this.showNewProject));
		dojo.connect(this.advancedLink, "onclick", null, dojo.hitch(this, this.showAdvanced));
		dojo.connect(this.advancedLinkHide, "onclick", null, dojo.hitch(this, this.hideAdvanced));
		if (this.options.alwaysShowAdvanced) {
			this.showAdvanced();
		}
	},
	execute: function() {
		if(this.options.func)
		this.options.func(
				this.options.advancedOnly ? undefined : this.gitUrl.value,
				(this.advancedShown && this.isNewProject.checked) ? undefined : this.gitPath.value,
				(this.advancedShown && !this.isNewProject.checked) ? undefined : this.gitName.value
				);
		delete this.options.func; //prevent performing this action twice (IE)
	},
	showAdvanced: function(){
		this.advancedShown = true;
		this.Advanced.style.display="";
		this.advancedLink.style.display="none";
		this.advancedLinkHide.style.display="";
	},
	hideAdvanced: function(){
		this.advancedShown = false;
		this.Advanced.style.display="none";
		this.advancedLink.style.display="";
		this.advancedLinkHide.style.display="none";
		
	},
	showExistingFolder: function(){
		if(this.isExistingProject.checked){
			this.openDirectoryPickerDialog();
		}else{
			this.gitName.focus();
		}
	},
	showNewProject: function(){
		this.isNewProject.checked = true;
	},
	openDirectoryPickerDialog: function(){
		this.isExistingProject.checked = true; 
		var self = this;
		var dialog = new orion.widgets.DirectoryPrompterDialog({
				title: "Choose a Folder",
				serviceRegistry: this.options.serviceRegistry,
				fileClient: this.options.fileClient,	
				func: dojo.hitch(this, function(targetFolder) {
					if (targetFolder && targetFolder.Location) {
						this.gitPath.value = targetFolder.Location;
						this.shownGitPath.innerHTML = "<a href='" + require.toUrl("navigate/table.html") + "#" + targetFolder.ChildrenLocation+"'>" + targetFolder.Name + "</a>";
						var currentFolder = targetFolder;
						
						while(currentFolder.parent && !currentFolder.parent.Projects){
							this.shownGitPath.innerHTML = "<a href='" + require.toUrl("navigate/table.html") + "#"+currentFolder.parent.ChildrenLocation+"'>" + currentFolder.parent.Name + "</a>/" + this.shownGitPath.innerHTML;
							currentFolder = currentFolder.parent;
						}
					}
				})
			});
			dialog.startup();
			dialog.show();
	}
});
});