/*global console define*/
/*jslint browser:true sub:true*/
define(['orion/Deferred', 'orion/objects', 'orion/commands', 'orion/outliner', 'orion/explorers/explorer-table', 'orion/webui/littlelib',
		'orion/widgets/nav/mini-nav',
		'i18n!orion/nls/messages'],
		function(Deferred, objects, mCommands, mOutliner, mExplorer, lib, MiniNavRenderer, messages) {
	/**
	 * @name orion.sidebar.Sidebar
	 * @class Sidebar that appears alongside an {@link orion.editor.Editor} in the Orion IDE.
	 * @param {Object} params
	 * @param {orion.commandRegistry.CommandRegistry} params.commandRegistry
	 * @param {orion.core.ContentTypeService} params.contentTypeRegistry
	 * @param {orion.fileClient.FileClient} params.fileClient
	 * @param {orion.editor.InputManager} params.inputManager
	 * @param {orion.outliner.OutlineService} params.outlineService
	 * @param {orion.selection.Selection} params.selection
	 * @param {orion.serviceregistry.ServiceRegistry} params.serviceRegistry
	 *
	 * TODO separate UI from rest of Sidebar
	 * @param {Element|String} params.parent
	 * @param {Element|String} params.toolbar
	 */
	function Sidebar(params) {
		this.params = params;
		this.commandRegistry = params.commandRegistry;
		this.contentTypeRegistry = params.contentTypeRegistry;
		this.editor = params.editor;
		this.fileClient = params.fileClient;
		this.inputManager = params.inputManager;
		this.outlineService = params.outlineService;
		this.parentNode = lib.node(params.parent);
		this.toolbarNode = lib.node(params.toolbar);
		this.selection = params.selection;
		this.serviceRegistry = params.serviceRegistry;
		this.viewModes = {};
		this.activeViewMode = null;
		this.switcherNode = null;
	}
	objects.mixin(Sidebar.prototype, /** @lends orion.sidebar.Sidebar.prototype */ {
		show: function() {
			if (this.created) {
				return;
			}
			this.created = true;
			var commandRegistry = this.commandRegistry;
			var contentTypeRegistry = this.contentTypeRegistry;
			var fileClient = this.fileClient;
			var inputManager = this.inputManager;
			var outlineService = this.outlineService;
			var parentNode = this.parentNode;
			var toolbarNode = this.toolbarNode;
			var selection = this.selection;
			var serviceRegistry = this.serviceRegistry;

			// Create toolbar contribution area for use by viewmodes
			var modeContributionToolbar = document.createElement("div"); //$NON-NLS-0$
			modeContributionToolbar.id = toolbarNode.id + "childModes"; //$NON-NLS-0$
			modeContributionToolbar.classList.add("layoutLeft"); //$NON-NLS-0$
			modeContributionToolbar.classList.add("pageActions"); //$NON-NLS-0$
			toolbarNode.appendChild(modeContributionToolbar);
			var switcherNode = this.switcherNode = document.createElement("div"); //$NON-NLS-0$
			switcherNode.classList.add("layoutRight"); //$NON-NLS-0$
			switcherNode.classList.add("pageActions"); //$NON-NLS-0$
			switcherNode.id = toolbarNode.id + "viewmodeSwitch"; //$NON-NLS-0$
			toolbarNode.appendChild(switcherNode);

			var changeViewModeCommand = new mCommands.Command({
				name: messages["View"],
				tooltip: messages["ViewTooltip"],
				id: "orion.sidebar.viewmode", //$NON-NLS-0$
				visibleWhen: function(item) {
					return true;
				},
				choiceCallback: this.viewModeMenuCallback.bind(this)
			});
			commandRegistry.addCommand(changeViewModeCommand);
			commandRegistry.registerCommandContribution(switcherNode.id, "orion.sidebar.viewmode", 1); //$NON-NLS-0$

			var _self = this;
			// TODO refactor create and destroy into mini-nav.js
			this.addViewMode("nav", { //$NON-NLS-0$
				label: messages["Navigator"],
				create: function() {
					if (_self.miniNavExplorer) {
						return;
					}
					_self.miniNavExplorer = new mExplorer.FileExplorer({
						selection: this.drivesSelection,
						serviceRegistry: serviceRegistry,
						fileClient: fileClient,
						parentId: parentNode,
						rendererFactory: function(explorer) { //$NON-NLS-0$
							var renderer = new MiniNavRenderer({
								checkbox: false,
								cachePrefix: "MiniNav"}, explorer, commandRegistry, contentTypeRegistry); //$NON-NLS-0$
							return renderer;
					}});
				},
				destroy: function() {
				}
			});

			this.outliner = new mOutliner.Outliner({
				parent: parentNode,
				toolbar: modeContributionToolbar,
				serviceRegistry: serviceRegistry,
				contentTypeRegistry: contentTypeRegistry,
				outlineService: outlineService,
				commandService: commandRegistry,
				selectionService: selection,
				inputManager: inputManager,
				sidebar: this
			});
			/*
			catch (e) {
				if (typeof console !== "undefined" && console) { console.log(e && e.stack); } //$NON-NLS-0$
			}
			*/
		},
		/** @private */
		viewModeMenuCallback: function() {
			var _self = this;
			return Object.keys(this.viewModes).map(function(modeId) {
				var mode = _self.getViewMode(modeId);
				return {
					name: mode.label || modeId,
					callback: _self.setViewMode.bind(_self, modeId)
				};
			});
		},
		addViewMode: function(id, mode) {
			if (!id) {
				throw new Error("Invalid id: " + id);
			}
			if (!mode || typeof mode !== "object") {
				throw new Error("Invalid mode: "  + mode);
			}
			if (!Object.hasOwnProperty.call(this.viewModes, id)) {
				this.viewModes[id] = mode;
			}
		},
		removeViewMode: function(id) {
			var mode = this.getViewMode(id);
			if (mode && typeof mode.destroy === "function") {
				mode.destroy();
			}
			delete this.viewModes[id];
		},
		getViewMode: function(id) {
			if (Object.hasOwnProperty.call(this.viewModes, id)) {
				return this.viewModes[id];
			}
			return null;
		},
		setViewMode: function(id) {
			var mode = this.activeViewMode;
			if (mode && typeof mode.destroy === "function") {
				mode.destroy();
			}
			mode = this.activeViewMode = this.getViewMode(id);
			if (mode && typeof mode.create === "function") {
				mode.create();
			}
		},
		renderViewModeMenu: function() {
			var switcher = this.switcherNode;
			this.commandRegistry.destroy(switcher);
			var modes = Object.keys(this.viewModes);
			if (modes.length > 1) {
				this.commandRegistry.renderCommands(switcher.id, switcher, {}, this, "button"); //$NON-NLS-0$
			}
		}
	});

	/**
	 * @name orion.sidebar.ViewMode
	 * @class Interface for a view mode that can provide content to a {@link orion.sidebar.Sidebar}.
	 */
	/**
	 * @name orion.sidebar.ViewMode#create
	 * @function
	 */
	/**
	 * @name orion.sidebar.ViewMode#destroy
	 * @function
	 */
	/**
	 * @name orion.sidebar.ViewMode#label
	 * @type {String}
	 */
	return Sidebar;
});