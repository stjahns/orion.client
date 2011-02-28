/*******************************************************************************
 * Copyright (c) 2010 IBM Corporation and others. All rights reserved. This
 * program and the accompanying materials are made available under the terms of
 * the Eclipse Public License v1.0 which accompanies this distribution, and is
 * available at http://www.eclipse.org/legal/epl-v10.html
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/
/*global dojo dijit*/
/*jslint browser:true*/
dojo.provide("widgets.SiteConfigEditor");

dojo.require("dijit.Dialog");
dojo.require("dijit.form.CheckBox");
dojo.require("dijit.form.ComboBox");
dojo.require("dojo.data.ItemFileReadStore");

/**
 * @param options <code>{
 *    title {String} Title for the dialog
 *    callback {Function} Invoked on OK
 *    fileService {eclipse.FileService}
 * }</code>
 */
dojo.declare("widgets.SiteConfigEditor", [dijit.Dialog], {
	widgetsInTemplate: true,
	templateString: dojo.cache("widgets", "templates/SiteConfigEditor.html"),
	workspaceIds: null,
	
	constructor : function() {
		this.inherited(arguments);
		this.options = arguments[0] || {};
	},
	postMixInProperties : function() {
		this.inherited(arguments);
		this.callback = this.options.callback || null;
		this.title = this.options.title || "No title";
		this.siteConfigNameLabelText = "Name:";
		this.mappingsLabelText = "Mappings:";
		this.hostHintLabelText = "Hostname hint:";
		this.workspaceLabelText = "Workspace:";
		this.buttonCancel = "Cancel";
	},
	postCreate: function() {
		this.inherited(arguments);
		this.refocus = false; // Dojo 10654
		
		this.name.isValid = dojo.hitch(this, function() {
			return dojo.trim(this.name.value) !== "";
		});
		
		// Populate fields here if we're editing existing site config
		if (this.options.siteConfiguration) {
			var site = this.options.siteConfiguration;
			this.name.set("value", site.Name);
			this.mappings.set("value", JSON.stringify(site.Mappings));
			this.hostHint.set("value", site.HostHint);
			//this.workspace
		} else {
			this.mappings.set("value", "[ ]");
		}
		
		this.options.fileService.loadWorkspaces(dojo.hitch(this, function(workspaces) {
			var i = 0;
			var options = dojo.map(workspaces, function(workspace) {
				return {label: workspace.Name, value: workspace.Id, selected: i++ === 0};
			});
			this.workspace.set("options", options);
			this.workspace._loadChildren();
		}));
	},
	onHide: function() {
		this.inherited(arguments);
		setTimeout(dojo.hitch(this, function() {
			this.destroyRecursive();
		}), this.duration);
	},
	execute: function() {
		if (this.callback) {
			var mappingsObject = JSON.parse(this.mappings.value);
			this.callback(this.name.value, this.workspace.value, mappingsObject, this.hostHint.value);
		}
	}
});