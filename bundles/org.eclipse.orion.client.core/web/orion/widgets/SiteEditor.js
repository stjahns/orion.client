/*******************************************************************************
 * @license
 * Copyright (c) 2010, 2011 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/
/*global define orion*/
/*jslint browser:true */

define(['require', 'dojo', 'dijit', 'orion/util', 'orion/commands', 'orion/siteMappingsTable',
		'orion/widgets/DirectoryPrompterDialog', 'text!orion/widgets/templates/SiteEditor.html',
		'dojo/DeferredList', 'dijit/layout/ContentPane', 'dijit/Tooltip', 'dijit/_Templated',
		'dijit/form/Form', 'dijit/form/TextBox', 'dijit/form/ValidationTextBox'],
		function(require, dojo, dijit, mUtil, mCommands, mSiteMappingsTable) {

var AUTOSAVE_INTERVAL = 8000;

/**
 * @name orion.widgets.SiteEditor
 * @class Editor for an individual site configuration.
 * @param {Object} options Options bag for creating the widget.
 * @param {orion.fileClient.FileClient} options.fileClient
 * @param {orion.sites.SiteService} options.siteService
 * @param {orion.commands.CommandService} options.commandService
 * @param {String} [options.location] Optional URL of a site configuration to load in editor
 * upon creation.
 */
dojo.declare("orion.widgets.SiteEditor", [dijit.layout.ContentPane, dijit._Templated], {
	widgetsInTemplate: true,
	templateString: dojo.cache('orion', 'widgets/templates/SiteEditor.html'),
	
	/** dojo.Deferred */
	_workspaces: null,
	
	/** dojo.Deferred */
	_projects: null,
	
	_fetched: false,
	
	/** SiteConfiguration */
	_siteConfiguration: null,
	
	/** Array */
	_modelListeners: null,
	
	/** MappingsTable */
	mappings: null,
	
	_isDirty: false,
	
	_autoSaveTimer: null,

	constructor: function() {
		this.inherited(arguments);
		this.options = arguments[0] || {};
		this.checkOptions(this.options, ["serviceRegistry", "fileClient", "siteService", "commandService", "statusService", "progressService"]);

		this._fileClient = this.options.fileClient;
		this._siteService = this.options.siteService;
		this._commandService = this.options.commandService;
		this._statusService = this.options.statusService;
		this._progressService = this.options.progressService;
		
		this._commandsContainer = this.options.commandsContainer;
		
		if (this.options.location) {
			this.load(this.options.location);
		}
		
		this._workspaces = this._fileClient.loadWorkspaces();
		this._projects = new dojo.Deferred();
	},
	
	postMixInProperties: function() {
		this.inherited(arguments);
		this.siteConfigNameLabelText = "Name:";
		this.mappingsLabelText = "Mappings:";
		this.hostHintLabelText = "Hostname hint:";
		this.hostingStatusLabelText = "Status:";
	},
	
	postCreate: function() {
		this.inherited(arguments);
		this.refocus = false; // Dojo 10654
		
		// Validation
		this.name.set("invalidMessage", "Not a valid name");
		this.name.set("isValid", dojo.hitch(this, function(focused) {
			return focused || dojo.trim(this.name.get("value")) !== "";
		}));
		this.hostHint.set("invalidMessage", "Not a valid hostname");
		this.hostHint.set("isValid", dojo.hitch(this, function(focused) {
			var hostish = /^(?:\s*|[A-Za-z0-9-_]+)$/;
			return focused || hostish.test(this.hostHint.get("value"));
		}));
		
		dijit.byId("siteForm").onSubmit = dojo.hitch(this, this.save);
		
		dojo.when(this._projects, dojo.hitch(this, function(projects) {
			// Register command used for adding mapping
			var addMappingCommand = new mCommands.Command({
				name: "Add",
				tooltip: "Add a directory mapping to the site configuration",
				imageClass: "core-sprite-add",
				id: "orion.site.mappings.add",
				visibleWhen: function(item) {
					return true;
				},
				choiceCallback: dojo.hitch(this, this._makeAddMenuChoices, projects)});
			this._commandService.addCommand(addMappingCommand);
			var toolbarId = this.addMappingToolbar.id;
			this._commandService.registerCommandContribution(toolbarId, "orion.site.mappings.add", 1);
			this._commandService.renderCommands(toolbarId, this.addMappingToolbar, this.mappings, this, "button");
			
			var convertCommand = new mCommands.Command({
				name: "Convert to Self-Hosting",
				tooltip: "Enable the site configuration to launch an Orion server running your local client code",
				imageClass: "core-sprite-add",
				id: "orion.site.convert",
				visibleWhen: dojo.hitch(this, function(item) {
					// Only applies to SiteConfiguration objects
					return !!item.Location && !this.isSelfHosting(projects);
				}),
				callback: dojo.hitch(this, this.convertToSelfHostedSite, this._projects)});
			this._commandService.addCommand(convertCommand);
			
			this._refreshFields();

			this._autoSaveTimer = setTimeout(dojo.hitch(this, this.autoSave), AUTOSAVE_INTERVAL);
		}));
		
		// Save command
		var saveCommand = new mCommands.Command({
				name: "Save",
				tooltip: "Save the site configuration",
				imageClass: "core-sprite-save",
				id: "orion.site.save",
				visibleWhen: function(item) {
					return !!item.Location /*looks like a site config*/;
				},
				callback: dojo.hitch(this, this.save)});
		this._commandService.addCommand(saveCommand);
	},
	
	checkOptions: function(options, names) {
		for (var i=0; i < names.length; i++) {
			if (typeof options[names[i]] === "undefined") {
				throw new Error("options." + names[i] + " is required");
			}
		}
	},
	
	/**
	 * this._projects must be resolved before this is called
	 * @param {Array} Projects in workspace
	 * @param {Array|Object} items
	 * @param {Object} userData
	 * @returns {Array}
	 */
	_makeAddMenuChoices: function(projects, items, userData) {
		items = dojo.isArray(items) ? items[0] : items;
		var workspaceId = this.getSiteConfiguration().Workspace;
		projects = projects.sort(function(projectA, projectB) {
				return projectA.Name.toLowerCase().localeCompare(projectB.Name.toLowerCase());
			});
		
		/**
		 * @this An object from the choices array with shape {name:String, path:String, callback:Function}
		 * @param {Object} item
		 */
		var editor = this;
		var addMappingCallback = function(data) {
			editor.mappings.addMapping(null, this.path, this.name);
		};
//		var addOther = function() {
//			editor.mappings.addMapping("/mountPoint", "/FolderId/somepath");
//		};
		var addUrl = function() {
			editor.mappings.addMapping("/web/somePath", "http://");
		};
		
		var choices = dojo.map(projects, function(project) {
				return {
					name: "/" + project.Name,
					imageClass: "core-sprite-folder",
					path: editor._siteService.makeRelativeFilePath(project.Location),
					callback: addMappingCallback
				};
			});
		
		if (projects.length > 0) {
			choices.push({}); // Separator
		}
		choices.push({
			name: "Choose folder&#8230;",
			imageClass: "core-sprite-folder",
			callback: dojo.hitch(this, function() {
				var dialog = new orion.widgets.DirectoryPrompterDialog({
					serviceRegistry: this.serviceRegistry,
					fileClient: this.fileClient,
					func: dojo.hitch(this, function(folder) {
						if (!!folder) {
							this.mappings.addMapping(null, editor._siteService.makeRelativeFilePath(folder.Location), folder.Name);
						}
					})});
				dialog.startup();
				dialog.show();
			})});
		choices.push({name: "URL", imageClass: "core-sprite-link", callback: addUrl});
		return choices;
	},

	// Special feature for setting up self-hosting
	convertToSelfHostedSite: function(projectsPromise, items, userData) {
		var dialog = new orion.widgets.DirectoryPrompterDialog({
			serviceRegistry: this.serviceRegistry,
			fileClient: this.fileClient,
			func: dojo.hitch(this, function(folder) {
				if (folder) {
					var path = this._siteService.makeRelativeFilePath(folder.Location);
					this.mappings.deleteAllMappings();
					this.mappings.addMappings(this.getSelfHostingMappings(path));
					this.save();
				}
			}),
			title: "Choose Orion Source Folder",
			message: "Select the folder where you checked out the <b>org.eclipse.orion.client</b> repository:"});
		dialog.startup();
		dialog.show();
	},
	
	isSelfHosting: function(projects) {
		for (var i=0; i < projects.length; i++) {
			var path = this._siteService.makeRelativeFilePath(projects[i].Location);
			var selfHostingMappings = this.getSelfHostingMappings(path);
			var pass = true;
			for (var j=0; j < selfHostingMappings.length; j++) {
				if (!this.mappings.mappingExists(selfHostingMappings[j])) {
					pass = false;
				}
			}
			if (pass) {
				return true;
			}
		}
		return false;
	},
	
	getSelfHostingMappings: function(clientRepoPath) {
		var context = this._siteService.getContext();
		context = this._siteService._makeHostRelative(context);
		// TODO: prompt for port? It is not detectable from client side if proxy is used
		var hostPrefix = "http://localhost" + ":" + "8080" + context;
		return [
			{ Source: "/",
			  Target: clientRepoPath + "/bundles/org.eclipse.orion.client.core/web/index.html"
			},
			{ Source: "/",
			  Target: clientRepoPath + "/bundles/org.eclipse.orion.client.core/web"
			},
			{ Source: "/",
			  Target: clientRepoPath + "/bundles/org.eclipse.orion.client.editor/web"
			},
			{ Source: "/org.dojotoolkit/dojo",
			  Target: clientRepoPath + "/bundles/org.eclipse.orion.client.core/web/dojo"
			},
			{ Source: "/org.dojotoolkit/dojox",
			  Target: clientRepoPath + "/bundles/org.eclipse.orion.client.core/web/dojox"
			},
			{ Source: "/file",
			  Target: hostPrefix + "file"
			},
			{ Source: "/prefs",
			  Target: hostPrefix + "prefs"
			},
			{ Source: "/workspace",
			  Target: hostPrefix + "workspace"
			},
			{ Source: "/org.dojotoolkit",
			  Target: hostPrefix + "org.dojotoolkit"
			},
			{ Source: "/users",
			  Target: hostPrefix + "users"
			},
			{ Source: "/authenticationPlugin.html",
			  Target: hostPrefix + "authenticationPlugin.html"
			},
			{ Source: "/login",
			  Target: hostPrefix + "login"
			},
			{ Source: "/loginstatic",
			  Target: hostPrefix + "loginstatic"
			},
			{ Source: "/site",
			  Target: hostPrefix + "site"
			},
			{ Source: "/",
			  Target: clientRepoPath + "/bundles/org.eclipse.orion.client.git/web"
			},
			{ Source: "/gitapi",
			  Target: hostPrefix + "gitapi"
			},
			{ Source: "/",
			  Target: clientRepoPath + "/bundles/org.eclipse.orion.client.users.ui/web"
			},
			{ Source: "/xfer",
			  Target: hostPrefix + "xfer"
			},
			{ Source: "/filesearch",
			  Target: hostPrefix + "filesearch"
			},
			{ Source: "/index.jsp",
			  Target: hostPrefix + "index.jsp"
			},
			{ Source: "/plugins/git",
			  Target: hostPrefix + "plugins/git"
			},
			{ Source: "/plugins/user",
			  Target: hostPrefix + "plugins/user"
			},
			{ Source: "/logout",
			  Target: hostPrefix + "logout"
			},
			{ Source: "/mixloginstatic",
			  Target: hostPrefix + "mixloginstatic"
			},
			{ Source: "/mixlogin/manageopenids",
			  Target: hostPrefix + "mixlogin/manageopenids"
			},
			{ Source: "/openids",
			  Target: hostPrefix + "openids"
			},
			{ Source: "/task",
			  Target: hostPrefix + "task"
			},
			{ Source: "/help",
			  Target: hostPrefix + "help"
			}
		];
	},
	
	/**
	 * Loads site configuration from a URL into the editor.
	 * @param {String} location URL of the site configuration to load.
	 * @returns {dojo.Deferred} A deferred, resolved when the editor has loaded & refreshed itself.
	 */
	load: function(location) {
		var deferred = new dojo.Deferred();
		this._busyWhile(deferred, "Loading...");
		this._siteService.loadSiteConfiguration(location).then(
			dojo.hitch(this, function(siteConfig) {
				this._setSiteConfiguration(siteConfig);
				deferred.callback(siteConfig);
			}),
			function(error) {
				deferred.errback(error);
			});
		return deferred;
	},
	
	/**
	 * Fetches top-level children of the siteConfiguration's workspace
	 * @returns {dojo.Deferred}
	 */
	_fetchProjects: function(siteConfiguration) {
		if (!this._fetched) {
			dojo.when(this._workspaces, dojo.hitch(this, function(workspaces) {
				var workspace;
				for (var i=0; i < workspaces.length; i++) {
					if (workspaces[i].Id === siteConfiguration.Workspace) {
						workspace = workspaces[i];
						break;
					}
				}
				if (workspace) {
					this._fileClient.fetchChildren(workspace.Location).then(
						dojo.hitch(this, function(projects) {
							this._fetched = true;
							this._projects.callback(projects);
						}),
						dojo.hitch(this, this._onError));
				}
			}));
		}
	},

	_setSiteConfiguration: function(siteConfiguration) {
		this._detachListeners();
		this._siteConfiguration = siteConfiguration;
		this._fetchProjects(siteConfiguration);
		this._refreshFields();
		this.setDirty(false);
	},
	
	setDirty: function(value) {
		this._isDirty = value;
	},
	
	isDirty: function() {
		return this._isDirty;
	},
	
	_refreshFields: function() {
		this.name.set("value", this._siteConfiguration.Name);
		this.hostHint.set("value", this._siteConfiguration.HostHint);

		if (!this.mappings) {
			this.mappings = new mSiteMappingsTable.MappingsTable({serviceRegistry: this.serviceRegistry,
					siteService: this._siteService, selection: null, parentId: this.mappingsPlaceholder.id,
					siteConfiguration: this._siteConfiguration, projects: this._projects /**dojo.Deferred*/
				});
		} else {
			this.mappings._setSiteConfiguration(this._siteConfiguration);
		}

		var hostStatus = this._siteConfiguration.HostingStatus;
		if (hostStatus && hostStatus.Status === "started") {
			dojo.style(this.siteStartedWarning, {display: "block"});
			this.hostingStatus.innerHTML = mUtil.safeText(hostStatus.Status[0].toLocaleUpperCase() + hostStatus.Status.substr(1) + " at ");
			dojo.create("a", {href: hostStatus.URL, innerHTML: mUtil.safeText(hostStatus.URL), target: "_new"}, this.hostingStatus, "last");
		} else {
			dojo.style(this.siteStartedWarning, {display: "none"});
			mUtil.setText(this.hostingStatus, hostStatus.Status[0].toLocaleUpperCase() + hostStatus.Status.substr(1));
		}
		
		dojo.empty(this._commandsContainer);
		this._commandService.renderCommands(this._commandsContainer.id, this._commandsContainer, this._siteConfiguration, {},
			"button", this._siteConfiguration /*userData*/);

		setTimeout(dojo.hitch(this, function() {
			this._attachListeners(this._siteConfiguration);
		}), 0);
	},
	
	/**
	 * Hook up listeners that perform form widget -> model updates.
	 * @param site {SiteConfiguration}
	 */
	_attachListeners: function(site) {
		this._detachListeners();
		this._modelListeners = this._modelListeners || [];
		
		var editor = this;
		function bindText(widget, modelField) {
			function commitWidgetValue() {
				var value = widget.get("value");
				var oldValue = site[modelField];
				site[modelField] = value;
				var isChanged = oldValue !== value;
				editor.setDirty(isChanged || editor.isDirty());
			}
			editor._modelListeners.push(dojo.connect(widget, "onChange", commitWidgetValue));
			editor._modelListeners.push(dojo.connect(widget, "onKeyUp", commitWidgetValue));
		}
		
		bindText(this.name, "Name");
		bindText(this.hostHint, "HostHint");
		
		this._modelListeners.push(dojo.connect(this.mappings, "setDirty", this, function(dirty) {
			this.setDirty(dirty);
		}));
	},
	
	_detachListeners: function() {
		if (this._modelListeners) {
			for (var i=0; i < this._modelListeners.length; i++) {
				dojo.disconnect(this._modelListeners[i]);
			}
			this._modelListeners.splice(0);
		}
	},
	
	/**
	 * @returns {SiteConfiguration} The site configuration that is being edited.
	 */
	getSiteConfiguration: function() {
		return this._siteConfiguration;
	},
	
	getResource: function() {
		return this._siteConfiguration && this._siteConfiguration.Location;
	},

	/**
	 * Callback when 'save' is clicked.
	 * @Override
	 * @returns True to allow save to proceed, false to prevent it.
	 */
	save: function(/** Event */ e) {
		var form = dijit.byId("siteForm");
		if (form.isValid()) {
			var editor = this;
			var siteConfig = editor._siteConfiguration;
			// Omit the HostingStatus field before save since it's likely to be updated from
			// the sites page, and we don't want to overwrite
			delete siteConfig.HostingStatus;
			var deferred = this._siteService.updateSiteConfiguration(siteConfig.Location, siteConfig).then(
					function(updatedSiteConfig) {
						editor._setSiteConfiguration(updatedSiteConfig);
						return updatedSiteConfig;
					});
			this._busyWhile(deferred);
			return true;
		} else {
			return false;
		}
	},

	autoSave: function() {
		if (this.isDirty()) {
			this.save();
		}
		setTimeout(dojo.hitch(this, this.autoSave), AUTOSAVE_INTERVAL);
	},

	_busyWhile: function(deferred, msg) {
		deferred.then(dojo.hitch(this, this._onSuccess), dojo.hitch(this, this._onError));
		this.progressService.showWhile(deferred, msg);
	},
	
	_onSuccess: function(deferred) {
		this.onSuccess(deferred);
	},
	
	_onError: function(deferred) {
		this._statusService.setErrorMessage(deferred);
		this.onError(deferred);
	},
	
	/**
	 * Clients can dojo.connect() to this function to receive notifications about server calls that succeeded.
	 * @param {dojo.Deferred} deferred The deferred that succeeded.
	 */
	onSuccess: function(deferred) {
	},
		
	/**
	 * Clients can dojo.connect() to this function to receive notifications about server called that failed.
	 * @param {dojo.Deferred} deferred The deferred that errback'd.
	 */
	onError: function(deferred) {
	}
});
});
