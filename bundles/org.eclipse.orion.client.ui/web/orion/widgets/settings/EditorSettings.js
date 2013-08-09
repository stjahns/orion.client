/*globals define document*/

define("orion/widgets/settings/EditorSettings", //$NON-NLS-0$
[
	'i18n!orion/settings/nls/messages', //$NON-NLS-0$ 
	'orion/widgets/input/LabeledTextfield', //$NON-NLS-0$
	'orion/widgets/input/LabeledCheckbox',  //$NON-NLS-0$
	'orion/widgets/input/LabeledSelect', //$NON-NLS-0$ 
	'orion/section', //$NON-NLS-0$ 
	'orion/widgets/settings/Subsection', //$NON-NLS-0$
	'orion/commands', //$NON-NLS-0$ 
	'orion/objects', //$NON-NLS-0$
	'orion/webui/littlelib' //$NON-NLS-0$
], function(messages, LabeledTextfield, LabeledCheckbox, LabeledSelect, mSection, Subsection, commands, objects, lib)  {
    var KEY_MODES = [
	    messages.Default,
		"Emacs", //$NON-NLS-0$
		"vi" //$NON-NLS-0$
	];
	
	function createBooleanProperty(property, options) {
		return new LabeledCheckbox(options);
	}
	
	function createIntegerProperty(property, options) {
		options.inputType = "integer"; //$NON-NLS-0$
		return new LabeledTextfield(options);
	}
	
	function createSelectProperty(property, options, prefs) {
		var keys = this.values;
		options.options = [];
		for( var i= 0; i < keys.length; i++ ){
			var key = keys[i];
			var set = {
				value: key,
				label: key
			};	
			if( key === prefs[property] ){
				set.selected = true;
			}
			options.options.push(set);
		}
		return new LabeledSelect(options);
	}
	
	function validateIntegerProperty(property, prefs) {
		if (!(this.min <= prefs[property] && prefs[property] <= this.max)) {
			return messages[property + "Invalid"]; //$NON-NLS-0$
		}
		return "";
	}
	
	var sections = {
		editorSettings: {
			keys: {
				keyBindings: {
					values: KEY_MODES, 
					create: createSelectProperty
				}
			},
			fileManagement: {
				autoSave: {
					create: createBooleanProperty
				},
				autoSaveTimeout: {
					min: 50,
					max: 10000,
					create: createIntegerProperty,
					validate: validateIntegerProperty
				},
				autoLoad: {
					create: createBooleanProperty
				}
			},
			tabs: {
				tabSize: {
					min: 1,
					max: 16,
					create: createIntegerProperty,
					validate: validateIntegerProperty
				},
				expandTab: {
					create: createBooleanProperty
				}
			},
			smoothScrolling: {
				scrollAnimation: {
					create: createBooleanProperty
				},
				scrollAnimationTimeout: {
					min: 50,
					max: 1000,
					create: createIntegerProperty,
					validate: validateIntegerProperty
				}
			}
		}
	};
				
	function EditorSettings(options, node) {
		objects.mixin(this, options);
		this.node = node;
	}
	objects.mixin( EditorSettings.prototype, {
		templateString: '<div class="sections"></div>', //$NON-NLS-0$
		commandTemplate:
				'<div id="commandButtons">' + //$NON-NLS-0$
					'<div id="editorCommands" class="layoutRight sectionActions"></div>' + //$NON-NLS-0$
				'</div>', //$NON-NLS-0$
		createElements: function() {
			this.node.innerHTML = this.templateString;
			this.sections = lib.$('.sections', this.node); //$NON-NLS-0$
			this.createSections();
			if (this.local) {
				this.sections.classList.add("local"); //$NON-NLS-0$
			} else {
				var commandArea = document.getElementById( 'pageActions' ); //$NON-NLS-0$
				commandArea.innerHTML = this.commandTemplate;
				this.createToolbar();
			}
		},
		createSections: function() {
			var prefs = this.oldPrefs;
		
			var fields = [], subSection, options, set, select;
			var themePreferences = this.themePreferences;
			if (!this.local && this.editorThemeWidget) {
				this.editorThemeSection = new mSection.Section(this.sections, {
					id: "editorThemeSettings", //$NON-NLS-0$
					title: messages.EditorThemes,
					canHide: true,
					slideout: true
				});
				
				this.editorThemeWidget.renderData( this.editorThemeSection.getContentElement(), 'INITIALIZE' ); //$NON-NLS-0$
			} else {
				var themeStyles = this.oldThemeStyles;
				if (prefs.themeVisible && (!this.local || prefs.themeLocalVisible)) {
					var styles = themeStyles.styles;
					options = [];
					for( var theme= 0; theme < styles.length; theme++ ){
						set = {
							value: styles[theme].name,
							label: styles[theme].name
						};	
						if( styles[theme].name === themeStyles.style.name ){
							set.selected = true;
						}
						options.push(set);
					}	
					fields.push(select = this.themeSelect = new LabeledSelect( {fieldlabel:messages.Theme, options:options}));
					select.setStorageItem = function(name) {
						themePreferences.setTheme(name);
					};
				}
				if (prefs.fontSizeVisible && (!this.local || prefs.fontSizeLocalVisible)) {
					var fontSize = themeStyles.style.fontSize;
					options = [];
					for( var size = 8; size < 19; size++ ){
						set = {
							value: size + 'pt', //$NON-NLS-0$
							label: size + 'pt' //$NON-NLS-0$
						};
						if( set.label === fontSize ){
							set.selected = true;
						}
						options.push(set);
					}	
					fields.push(select = this.sizeSelect = new LabeledSelect( {fieldlabel:messages["Font Size"], options:options}));
					select.setStorageItem = function(size) {
						themePreferences.setFontSize(size);
					};
				}
				if (!this.local && fields.length > 0) {
					subSection = new Subsection( {sectionName:messages.Theme, parentNode: this.editorThemeSection.getContentElement(), children: fields} );
					subSection.show();
					fields = [];
				}
			}
			
			var sectionWidget, subsectionWidget;
			for (var section in sections) {
				if (sections.hasOwnProperty(section)) {
					if (!this.local) {
						sectionWidget = new mSection.Section(this.sections, {
							id: section,
							title: messages[section],
							canHide: true,
							slideout: true
						});
					}
					for (var subsection in sections[section]) {
						if (sections[section].hasOwnProperty(subsection)) {
							for (var property in sections[section][subsection]) {
								if (prefs[property + "Visible"] && (!this.local || prefs[property + "LocalVisible"])) { //$NON-NLS-1$ //$NON-NLS-0$
									var info = sections[section][subsection][property];
									options = {};
									options.fieldlabel = messages[property];
									fields.push(info.widget = info.create(property, options, prefs));
								}
							}
							if (!this.local && fields.length > 0) {
								subsectionWidget = new Subsection( {sectionName:messages[subsection], parentNode: sectionWidget.getContentElement(), children: fields } );
								subsectionWidget.show();
								fields = [];
							}
						}
					}
				}
			}
			
			if (this.local) {
				fields.forEach(function(child) {
					this.sections.appendChild( child.node );
					if (!child.hasOwnProperty("setStorageItem")) { //$NON-NLS-0$
						child.setStorageItem = this.update.bind(this);
					}
					child.show();
				}.bind(this));
			}
		},
		createToolbar: function() {
			var toolbar = lib.node( 'editorSettingsToolActionsArea' ); //$NON-NLS-0$
			var restoreCommand = new commands.Command({
				name: messages.Restore,
				tooltip: messages["Restore default Editor Settings"],
				id: "orion.restoreeditorsettings", //$NON-NLS-0$
				callback: function(data){
					this.restore(data.items);
				}.bind(this)
			});
			this.commandService.addCommand(restoreCommand);
			this.commandService.registerCommandContribution('restoreEditorSettingCommand', "orion.restoreeditorsettings", 2); //$NON-NLS-1$ //$NON-NLS-0$
			this.commandService.renderCommands('restoreEditorSettingCommand', toolbar, this, this, "button"); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$			

			var updateCommand = new commands.Command({
				name: messages.Update,
				tooltip: messages["Update Editor Settings"],
				id: "orion.updateeditorsettings", //$NON-NLS-0$
				callback: function(data){
					this.update(data.items);
				}.bind(this)
			});
			this.commandService.addCommand(updateCommand);
			this.commandService.registerCommandContribution('editorSettingCommand', "orion.updateeditorsettings", 1); //$NON-NLS-1$ //$NON-NLS-0$
			this.commandService.renderCommands('editorSettingCommand', toolbar, this, this, "button"); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$		
		},
		valueChanged: function() {
			var currentPrefs = {};
			for (var property in this.oldPrefs) {
				if (this.oldPrefs.hasOwnProperty(property)) {
					currentPrefs[property] = this.oldPrefs[property];
				}
			}
			this.getValues(currentPrefs);
			for (var prop in currentPrefs) {
				if (currentPrefs.hasOwnProperty(prop)) {
					if (currentPrefs[prop] !== this.oldPrefs[prop]) {
						return currentPrefs;
					}
				}
			}
			return undefined;
		},
		validate: function(prefs) {
			var msg = "";
			this._forEach(function(property, info) {
				if (info.validate) {
					msg = info.validate(property, prefs);
					if (msg) {
						return false;
					}
				}
				return true;
			});
			return msg;
		},
		_progress: function(msg, severity) {
			if (this.registry) {
				var messageService = this.registry.getService("orion.page.message"); //$NON-NLS-0$
				messageService.setProgressResult( {Message:msg, Severity:severity} );
			}
		},
		update: function() {
			var currentPrefs = this.valueChanged();
			if (currentPrefs) {
				var msg = this.validate(currentPrefs);
				if (msg) {
					this._progress(msg,"Error"); //$NON-NLS-0$
					return;
				}
				this.preferences.setPrefs(currentPrefs, function () { 
					this.setValues(this.oldPrefs = currentPrefs);
					this._progress(messages["Editor preferences updated"], "Normal"); //$NON-NLS-0$
				}.bind(this));
			} else {
				this.setValues(this.oldPrefs);
			}
		},
		restore: function() {
			this.preferences.setPrefs({}, function (editorPrefs){ 
				this._show(editorPrefs);
				this._progress(messages["Editor defaults restored"], "Normal"); //$NON-NLS-0$
			}.bind(this));
		},
		show: function(node, callback) {
			if (node) {
				this.node = node;
			}
			this.themePreferences.getTheme(function(themeStyles) {
				this.preferences.getPrefs(function (editorPrefs) {
					this._show(editorPrefs, themeStyles);
					if (callback) {
						callback();
					}
				}.bind(this));
			}.bind(this));
		},
		_show: function(editorPrefs, themeStyles) {
			if (themeStyles) {
				this.oldThemeStyles = themeStyles;
			}
			this.oldPrefs = editorPrefs;
			this.createElements();
			this.setValues(editorPrefs);
		},
		_forEach: function(callback) {
			for (var section in sections) {
				if (sections.hasOwnProperty(section)) {
					for (var subsection in sections[section]) {
						if (sections[section].hasOwnProperty(subsection)) {
							for (var property in sections[section][subsection]) {
								if (sections[section][subsection].hasOwnProperty(property)) {
									var info = sections[section][subsection][property];
									if (info.widget) {
										if (!callback(property, info)) {
											return;
										}
									}
								}
							}
						}
					}
				}
			}
		},
		getValues: function(editorPrefs) {
			this._forEach(function(property, info) {
				editorPrefs[property] = info.widget.getSelection();
				return true;
			});
		},
		setValues: function(editorPrefs) {
			this._forEach(function(property, info) {
				info.widget.setSelection(editorPrefs[property]);
				return true;
			});
		},
		destroy: function() {
			if (this.node) {
				this.node = null;
			}
			if (this.editorThemeWidget) {
				this.editorThemeWidget.destroy();
				this.editorThemeWidget = null;
			}
		}
	});
	
	return EditorSettings;
});