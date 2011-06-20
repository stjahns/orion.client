/*******************************************************************************
 * Copyright (c) 2011 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/

/*jslint browser:true devel:true*/
/*global dijit dojo orion widgets serviceRegistry:true window*/


define(['dojo', 'orion/serviceregistry', 'orion/preferences', 'orion/pluginregistry', 'orion/status', 'orion/commands', 
	        'orion/searchClient', 'orion/globalCommands', 'orion/dialogs',
	        'dojo/parser', 'dojo/hash', 'dijit/layout/BorderContainer', 'dijit/layout/ContentPane', 'orion/widgets/RegistryTree'], 
			function(dojo, mServiceregistry, mPreferences, mPluginRegistry, mStatus, mCommands, mSearchClient, mGlobalCommands, mDialogs) {

dojo.addOnLoad(function() {
	document.body.style.visibility = "visible";
	dojo.parser.parse();

	var serviceRegistry = new mServiceregistry.ServiceRegistry();
	// This is code to ensure the first visit to orion works
	// we read settings and wait for the plugin registry to fully startup before continuing
	var preferenceService = new mPreferences.PreferencesService(serviceRegistry, "/prefs/user");
	var dialogService = new mDialogs.DialogService(serviceRegistry);
	var pluginRegistry;
	preferenceService.getPreferences("/plugins").then(function() {
		pluginRegistry = new mPluginRegistry.PluginRegistry(serviceRegistry);
		dojo.addOnWindowUnload(function() {
			pluginRegistry.shutdown();
		});
		return pluginRegistry.startup();
	}).then(function() {
		var commandService = new mCommands.CommandService({serviceRegistry: serviceRegistry});
		var searcher = new mSearchClient.Searcher({serviceRegistry: serviceRegistry});
		var statusService = new mStatus.StatusReportingService(serviceRegistry, "statusPane", "notifications");
		var tree;
		
		var initTree = function() {
			tree = new orion.widgets.RegistryTree({ registry: pluginRegistry, showRoot: false }, "registry-tree");
			tree.startup();
		};
		
		// global commands
		mGlobalCommands.generateBanner("toolbar", serviceRegistry, commandService, preferenceService, searcher);
	
		// add install stuff to page actions toolbar
		// We could use the command framework for the links but we are being lazy since we have to add a textbox anyway
		var pageActions = dojo.byId("pageActions");
		if (pageActions) {
			dojo.place('<input type="text" id="installUrlTextBox" value="Type a plugin URL here" style="width:16em;"></input>',
				pageActions, "last");
			dojo.place('<a id="installButton">Install</a>',
				pageActions, "last");
			dojo.place('<a id="uninstallButton">Uninstall</a>',
				pageActions, "last");
			dojo.place('<a id="reloadButton">Reload</a>',
				pageActions, "last");
			dojo.place('<a id="copyButton">Copy Location</a>',
				pageActions, "last");


		}	
		// Hook up event handlers
		var installUrlTextBox = dojo.byId("installUrlTextBox");
		dojo.style(installUrlTextBox, "marginRight", "8px");
		var installButton = dojo.byId("installButton");
		dojo.addClass(installButton, "commandLink");
		var uninstallButton = dojo.byId("uninstallButton");
		dojo.addClass(uninstallButton, "commandLink");
		var reloadButton = dojo.byId("reloadButton");
		dojo.addClass(reloadButton, "commandLink");
		var copyButton = dojo.byId("copyButton");
		dojo.addClass(copyButton, "commandLink");
		
		var installHandler = function(evt) {
			var pluginUrl = installUrlTextBox.value;
			if (/^\S+$/.test(dojo.trim(pluginUrl))) {
				statusService.setMessage("Installing " + pluginUrl + "...");
				pluginRegistry.installPlugin(pluginUrl).then(
					function(plugin) {
						var old = dijit.byId("registry-tree");
						if (old) {
							dijit.registry.remove("registry-tree");
						}
						initTree();
						installUrlTextBox.value="";
						statusService.setMessage("Installed " + plugin.getLocation(), 5000);
						preferenceService.getPreferences("/plugins").then(function(plugins) {
							plugins.flush();
						}); // this will force a sync
					}, function(error) {
						statusService.setErrorMessage(error);
					});
			}
		};
		
		// enter is same as pushing install button
		dojo.connect(installUrlTextBox, "onkeypress", function(e) {
			if (dojo.keys.ENTER === e.keyCode) {
				installHandler(e);
			}
		});
		
		// select everything when focus first gets to install box
		dojo.connect(installUrlTextBox, "onfocus", function(e) {
			installUrlTextBox.select();
		});
		
		dojo.connect(installButton, "onclick", installHandler);
		dojo.connect(uninstallButton, "onclick", function() {
			var plugins = tree.getSelectedPlugins();
			if (plugins.length === 0) {
				window.alert("You must first select the plugins you wish to uninstall.");
				return;
			}
			var confirmMessage = plugins.length === 1 ? "Are you sure you want to uninstall '" + plugins[0].getLocation() + "'?" : "Are you sure you want to delete these " + plugins.length + " plugins?";
			dialogService.confirm(confirmMessage, function(doit) {
				if (!doit) {
					return;
				}
				var message = plugins[0].getLocation();
				if (plugins.length > 1) {
					message += ", " + (plugins.length - 1) + " more";
				}
				for (var i=0; i<plugins.length; i++) {
					plugins[i].uninstall();
				}
				var old = dijit.byId("registry-tree");
				if (old) {
					dijit.registry.remove("registry-tree");
				}
				initTree();
				// report what we uninstalled so it's easy for user to copy/paste a plugin that they want back
				statusService.setMessage("Uninstalled " + message, 5000);
				preferenceService.getPreferences("/plugins").then(function(plugins) {
					plugins.flush();
				}); // this will force a sync
			});
		});
		
		dojo.connect(reloadButton, "onclick", function() {
			var plugins = tree.getSelectedPlugins();
			if (plugins.length === 0) {
				plugins = pluginRegistry.getPlugins();
			}
			var count = 0;
			var d = new dojo.Deferred();
			for (var i = 0; i < plugins.length; i++) {
				plugins[i]._load().then(function() {
					count++;
					if (count === plugins.length) {
						d.resolve();
					}
				});
			}
			d.then(function() {
				statusService.setMessage("Reloaded " + plugins.length + " plugin" + (plugins.length===1 ? "": "s") + ".", 5000);
				var old = dijit.byId("registry-tree");
				if (old) {
					dijit.registry.remove("registry-tree");
				}
				initTree();
			});
		});	
		
		dojo.connect(copyButton, "onclick", function() {
			var plugins = tree.getSelectedPlugins();
			if (plugins.length > 0) {
				installUrlTextBox.value = plugins[0].getLocation();
				installUrlTextBox.focus();
			}
		});			

		initTree();
		installUrlTextBox.focus();
	});
});
});