/*******************************************************************************
 * @license
 * Copyright (c) 2010, 2013 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/
/*jslint browser:true devel:true sub:true*/
/*global define eclipse:true orion:true window*/

define([
	'i18n!orion/edit/nls/messages',
	'require',
	'orion/EventTarget',
	'orion/webui/littlelib',
	'orion/selection',
	'orion/status',
	'orion/progress',
	'orion/dialogs',
	'orion/commandRegistry',
	'orion/favorites',
	'orion/extensionCommands',
	'orion/fileClient',
	'orion/operationsClient',
	'orion/searchClient',
	'orion/globalCommands',
	'orion/outliner',
	'orion/problems',
	'orion/editor/contentAssist',
	'orion/editorCommands',
	'orion/editor/editorFeatures',
	'orion/editor/editor',
	'orion/syntaxchecker',
	'orion/editor/textView',
	'orion/editor/textModel',
	'orion/editor/projectionTextModel',
	'orion/keyBinding',
	'orion/searchAndReplace/textSearcher',
	'orion/contentTypes',
	'orion/PageUtil',
	'orion/inputManager',
	'orion/i18nUtil',
	'orion/widgets/themes/ThemePreferences',
	'orion/widgets/themes/editor/ThemeData',
	'orion/widgets/themes/editor/MiniThemeChooser',
	'edit/editorPreferences',
	'orion/URITemplate',
	'orion/sidebar'
], function(messages, require, EventTarget, lib, mSelection, mStatus, mProgress, mDialogs, mCommandRegistry, mFavorites, mExtensionCommands, 
			mFileClient, mOperationsClient, mSearchClient, mGlobalCommands, mOutliner, mProblems, mContentAssist, mEditorCommands, mEditorFeatures, mEditor,
			mSyntaxchecker, mTextView, mTextModel, mProjectionTextModel, mKeyBinding, mSearcher,
			mContentTypes, PageUtil, mInputManager, i18nUtil, mThemePreferences, mThemeData, mThemeChooser, mEditorPreferences, URITemplate, Sidebar) {
	
var exports = exports || {};
	
exports.setUpEditor = function(serviceRegistry, preferences, isReadOnly){
	var document = window.document;
	var selection;
	var commandRegistry;
	var statusReportingService;
	var problemService;
	var outlineService;
	var contentTypeService;
	var progressService;
	var dialogService;
	var favoriteService;
	var fileClient;
	var searcher;
	
	// Initialize the plugin registry
	(function() {
		selection = new mSelection.Selection(serviceRegistry);
		var operationsClient = new mOperationsClient.OperationsClient(serviceRegistry);
		statusReportingService = new mStatus.StatusReportingService(serviceRegistry, operationsClient, "statusPane", "notifications", "notificationArea"); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
		dialogService = new mDialogs.DialogService(serviceRegistry);
		commandRegistry = new mCommandRegistry.CommandRegistry({selection: selection});
		progressService = new mProgress.ProgressService(serviceRegistry, operationsClient, commandRegistry);

		// Editor needs additional services
		problemService = new mProblems.ProblemService(serviceRegistry);
		outlineService = new mOutliner.OutlineService({serviceRegistry: serviceRegistry, preferences: preferences});
		favoriteService = new mFavorites.FavoritesService({serviceRegistry: serviceRegistry});
		contentTypeService = new mContentTypes.ContentTypeService(serviceRegistry);
		fileClient = new mFileClient.FileClient(serviceRegistry);
		searcher = new mSearchClient.Searcher({serviceRegistry: serviceRegistry, commandService: commandRegistry, fileService: fileClient});
	}());

	var sidebarDomNode = lib.node("sidebar"), //$NON-NLS-0$
	    sidebarToolbar = lib.node("sidebarToolbar"), //$NON-NLS-0$
		editorDomNode = lib.node("editor"), //$NON-NLS-0$
		searchFloat = lib.node("searchFloat"); //$NON-NLS-0$

	var editor, inputManager;
	var editorPreferences, settings;
	var updateSettings = function(prefs) {
		settings = prefs;
		inputManager.setAutoLoadEnabled(prefs.autoLoadEnabled);
		inputManager.setAutoSaveTimeout(prefs.autoSaveEnabled ? prefs.autoSaveTimeout : -1);
	};
	var updateEditorSettings = function (prefs) {
		if (!prefs) {
			editorPreferences.getPrefs(updateSettings);
		} else {
			updateSettings(prefs);
		}
	};
	editorPreferences = new mEditorPreferences.EditorPreferences (preferences, updateEditorSettings);
	var themePreferences = new mThemePreferences.ThemePreferences(preferences, new mThemeData.ThemeData());
	themePreferences.apply();
	
	var textViewFactory = function() {
		var textView = new mTextView.TextView({
			parent: editorDomNode,
			model: new mProjectionTextModel.ProjectionTextModel(new mTextModel.TextModel()),
			tabSize: 4,
			scrollAnimation: 300,
			readonly: isReadOnly
		});
		return textView;
	};

	var tabHandler = {
		handlers: [],
		
		addHandler: function(handler) {
			this.handlers.push(handler);
		},
		
		cancel: function() {
			return false;
		},
	
		isActive: function() {
			for (var i=0; i<this.handlers.length; i++) {
				if (this.handlers[i].isActive()) {
					return true;
				}
			}
			return false;
		},
	
		lineUp: function() {
			return false;
		},
		lineDown: function() {
			return false;
		},
		enter: function() {
			return false;
		},
		tab: function() {
			for (var i=0; i<this.handlers.length; i++) {
				if (this.handlers[i].isActive()) {
					return this.handlers[i].tab();
				}
				
			}
		}
	};

	var escHandler = {
		handlers: [],
		
		addHandler: function(handler) {
			this.handlers.push(handler);
		},
		
		cancel: function() {
			var handled = false;
			// To be safe, we give all our handlers a chance, not just the first one.
			// In case the user has left multiple modal popups open (such as key assist and search)
			for (var i=0; i<this.handlers.length; i++) {
				handled = this.handlers[i].cancel() || handled;
			}
			return handled;
		},
	
		isActive: function() {
			for (var i=0; i<this.handlers.length; i++) {
				if (this.handlers[i].isActive()) {
					return true;
				}
			}
			return false;
		},
	
		lineUp: function() {
			return false;
		},
		lineDown: function() {
			return false;
		},
		enter: function() {
			return false;
		},
		tab: function() {
			return false;
		}
	};
	
	var keyBindingFactory = function(editor, keyModeStack, undoStack, contentAssist) {
		
		keyModeStack.push(tabHandler);
		
		var localSearcher = new mSearcher.TextSearcher(editor, commandRegistry, undoStack);
		// Create keybindings for generic editing, no dependency on the service model
		var genericBindings = new mEditorFeatures.TextActions(editor, undoStack , localSearcher);
		keyModeStack.push(genericBindings);
		
		// Linked Mode
		var linkedMode = new mEditorFeatures.LinkedMode(editor, undoStack, contentAssist);
		keyModeStack.push(linkedMode);
		
		// create keybindings for source editing
		// TODO this should probably be something that happens more dynamically, when the editor changes input
		var codeBindings = new mEditorFeatures.SourceCodeActions(editor, undoStack, contentAssist, linkedMode);
		keyModeStack.push(codeBindings);
		
		// Register commands that depend on external services, the registry, etc.  Do this after
		// the generic keybindings so that we can override some of them.
		var commandGenerator = new mEditorCommands.EditorCommandFactory(serviceRegistry, commandRegistry, fileClient, inputManager, "pageActions", isReadOnly, "pageNavigationActions", localSearcher); //$NON-NLS-1$ //$NON-NLS-0$
		commandGenerator.generateEditorCommands(editor);

		
		// give our external escape handler a shot at handling escape
		keyModeStack.push(escHandler);
		
		editor.getTextView().setKeyBinding(new mKeyBinding.KeyBinding('w', true, false, true), "toggleWrapMode"); //$NON-NLS-1$ //$NON-NLS-0$
		
		// global search
		editor.getTextView().setKeyBinding(new mKeyBinding.KeyBinding("h", true), "searchFiles"); //$NON-NLS-1$ //$NON-NLS-0$
		editor.getTextView().setAction("searchFiles", function() { //$NON-NLS-0$
			window.setTimeout(function() {
				var e = editor.getTextView();
				var selection = e.getSelection();
				var searchPattern = "";
				if (selection.end > selection.start) {
					searchPattern = e.getText().substring(selection.start, selection.end);
				} if (searchPattern.length <= 0) {
					searchPattern = prompt(messages["Enter search term:"], searchPattern);
				} if (!searchPattern) {
					return;
				}
				document.addEventListener("keydown", function (e){  //$NON-NLS-0$
					if (e.charOrCode === lib.KEY.ESCAPE) {
						searchFloat.style.display = "none"; //$NON-NLS-0$
						if(lib.$$array("a", searchFloat).indexOf(document.activeElement) !== -1) { //$NON-NLS-0$
							editor.getTextView().focus();
						}
					}
				}, false);
				
				var searchFloatTabHandler = {
					isActive: function() {
						return searchFloat.style.display === "block"; //$NON-NLS-0$
					},
					
					tab: function() {
						if (this.isActive()) {
							lib.$("a",searchFloat).focus(); //$NON-NLS-0$
							return true;
						}
						return false;
					}
				};
				tabHandler.addHandler(searchFloatTabHandler);
				
				var searchFloatEscHandler = {
					isActive: function() {
						return searchFloat.style.display === "block"; //$NON-NLS-0$
					},
					
					cancel: function() {
						if (this.isActive()) {
							searchFloat.style.display = "none"; //$NON-NLS-0$
							return true;
						}
						return false;   // not handled
					}
				};
				escHandler.addHandler(searchFloatEscHandler);
									
				searchFloat.appendChild(document.createTextNode(messages["Searching for occurrences of "])); 
				var b = document.createElement("b"); //$NON-NLS-0$
				searchFloat.appendChild(b);
				b.appendChild(document.createTextNode("\"" + searchPattern + "\"...")); //$NON-NLS-1$ //$NON-NLS-0$
				searchFloat.style.display = "block"; //$NON-NLS-0$
				var searchParams = searcher.createSearchParams(searchPattern, false, true);
				searchParams.sort = "Name asc"; //$NON-NLS-0$
				var renderer = searcher.defaultRenderer.makeRenderFunction(null, searchFloat, false);
				searcher.search(searchParams, inputManager.getInput(), renderer);
			}, 0);
			return true;
		}, {name: messages["Search Files"]}); //$NON-NLS-0$
	};
	
	// Content Assist
	var contentAssistFactory = isReadOnly ? null
		: {
			createContentAssistMode: function(editor) {
				var progress = serviceRegistry.getService("orion.page.progress"); //$NON-NLS-0$
				var contentAssist = new mContentAssist.ContentAssist(editor.getTextView());
				contentAssist.addEventListener("Activating", function() { //$NON-NLS-0$
					// Content assist is about to be activated; set its providers.
					var fileContentType = inputManager.getContentType();
					var fileName = editor.getTitle();
					var serviceReferences = serviceRegistry.getServiceReferences("orion.edit.contentAssist"); //$NON-NLS-0$
					var providers = [];
					for (var i=0; i < serviceReferences.length; i++) {
						var serviceReference = serviceReferences[i],
						    contentTypeIds = serviceReference.getProperty("contentType"), //$NON-NLS-0$
						    pattern = serviceReference.getProperty("pattern"); // backwards compatibility //$NON-NLS-0$
						if ((contentTypeIds && contentTypeService.isSomeExtensionOf(fileContentType, contentTypeIds)) || 
								(pattern && new RegExp(pattern).test(fileName))) {
							providers.push(serviceRegistry.getService(serviceReference));
						}
					}
					contentAssist.setProviders(providers);
					contentAssist.setProgress(progress);
				});
				var widget = new mContentAssist.ContentAssistWidget(contentAssist, "contentassist"); //$NON-NLS-0$
				return new mContentAssist.ContentAssistMode(contentAssist, widget);
			}
		};

	var statusReporter =  function(message, type, isAccessible) {
		if (type === "progress") { //$NON-NLS-0$
			statusReportingService.setProgressMessage(message);
		} else if (type === "error") { //$NON-NLS-0$
			statusReportingService.setErrorMessage(message);
		} else {
			statusReportingService.setMessage(message, null, isAccessible);
		}
	};
	
	editor = new mEditor.Editor({
		textViewFactory: textViewFactory,
		undoStackFactory: new mEditorCommands.UndoCommandFactory(serviceRegistry, commandRegistry, "pageActions"), //$NON-NLS-0$
		textDNDFactory: new mEditorFeatures.TextDNDFactory(),
		annotationFactory: new mEditorFeatures.AnnotationFactory(),
		foldingRulerFactory: new mEditorFeatures.FoldingRulerFactory(),
		lineNumberRulerFactory: new mEditorFeatures.LineNumberRulerFactory(),
		contentAssistFactory: contentAssistFactory,
		keyBindingFactory: keyBindingFactory, 
		statusReporter: statusReporter,
		domNode: editorDomNode
	});
	
	// Editor Settings
	updateEditorSettings();
	
	inputManager = new mInputManager.InputManager({
		editor: editor,
		serviceRegistry: serviceRegistry,
		fileClient: fileClient,
		progressService: progressService,
		selection: selection,
		contentTypeService: contentTypeService
	});
	inputManager.addEventListener("InputChanged", function(evt) { //$NON-NLS-0$
		if (evt.input === null || typeof evt.input === "undefined") {//$NON-NLS-0$
			var noFile = document.createElement("div"); //$NON-NLS-0$
			noFile.classList.add("noFile");
			noFile.textContent = messages["NoFile"];
			lib.empty(editorDomNode);
			editorDomNode.appendChild(noFile);
			return;
		}
		var metadata = evt.metadata;
		if (metadata) {
			var toolbar = lib.node("pageActions"); //$NON-NLS-0$
			if (toolbar) {
				commandRegistry.destroy(toolbar);
				// now add any "orion.navigate.command" commands that should be shown in non-nav pages.
				mExtensionCommands.createAndPlaceFileCommandsExtension(serviceRegistry, commandRegistry, "pageActions", 500).then(function() { //$NON-NLS-1$ //$NON-NLS-0$
					commandRegistry.renderCommands("pageActions", toolbar, metadata, editor, "button"); //$NON-NLS-1$ //$NON-NLS-0$
				});
			}
			var rightToolbar = lib.node("pageNavigationActions"); //$NON-NLS-0$
			if (rightToolbar) {	
				commandRegistry.destroy(rightToolbar);
				commandRegistry.renderCommands(rightToolbar.id, rightToolbar, editor, editor, "button");  // use true when we want to force toolbar items to text //$NON-NLS-0$
			}
		}
		var chooser = new mThemeChooser.MiniThemeChooser( themePreferences, editorPreferences );
		mGlobalCommands.addSettings( chooser );
		mGlobalCommands.setPageTarget({
			task: "Coding", //$NON-NLS-0$
			name: evt.name,
			target: metadata,
			makeAlternate: function() {
				if (metadata.Parents && metadata.Parents.length > 0) {
					// The mini-nav in sidebar wants to do the same work, can we share it?
					return progressService.progress(fileClient.read(metadata.Parents[0].Location, true), i18nUtil.formatMessage(messages["Reading metedata of"], metadata.Parents[0].Location));
				}
			},
			makeBreadcrumbLink: function(/**HTMLAnchorElement*/ segment, folderLocation, folder) {
				var top = !folderLocation && !folder;
				// Link to this page (edit page)
				segment.href = new URITemplate("#{,Resource,params*}").expand({ //$NON-NLS-0$
					Resource: inputManager.getInput(),
					params: {
						navigate: top ? "" : folder.ChildrenLocation //$NON-NLS-0$
					}
				});
			},
			serviceRegistry: serviceRegistry,
			commandService: commandRegistry,
			searchService: searcher,
			fileService: fileClient
		});
		commandRegistry.processURL(window.location.href);
	});

	// Sidebar
	function SidebarNavInputManager() {
		EventTarget.attach(this);
	}
	SidebarNavInputManager.prototype.processHash = function() {
		var newParams = PageUtil.matchResourceParameters(location.hash), navigate = newParams.navigate;
		if (typeof navigate === "string") { //$NON-NLS-0$
			this.dispatchEvent({type: "InputChanged", input: navigate}); //$NON-NLS-0$
		}
	};
	var sidebarNavInputManager = new SidebarNavInputManager();
	var sidebar = new Sidebar({
		commandRegistry: commandRegistry,
		contentTypeRegistry: contentTypeService,
		editorInputManager: inputManager,
		editor: editor,
		fileClient: fileClient,
		outlineService: outlineService,
		parent: sidebarDomNode,
		progressService: progressService,
		selection: selection,
		serviceRegistry: serviceRegistry,
		sidebarNavInputManager: sidebarNavInputManager,
		toolbar: sidebarToolbar
	});
	sidebar.show();

	// Establishing dependencies on registered services
	serviceRegistry.getService("orion.core.marker").addEventListener("problemsChanged", function(event) { //$NON-NLS-1$ //$NON-NLS-0$
		editor.showProblems(event.problems);
	});
	
	editor.addEventListener("DirtyChanged", function(evt) { //$NON-NLS-0$
		inputManager.setDirty(editor.isDirty());
	});
	
	// Generically speaking, we respond to changes in selection.  New selections change the editor's input.
	selection.addEventListener("selectionChanged", function(event) { //$NON-NLS-0$
		var fileURI = event.selection;
		if (inputManager.shouldGoToURI(fileURI)) {
			inputManager.setInput(fileURI);
		} 
	});
	
	window.addEventListener("hashchange", function() { inputManager.hashChanged(); }, false); //$NON-NLS-0$
	window.addEventListener("hashchange", function() { //$NON-NLS-0$
		// inform the sidebar
		sidebarNavInputManager.processHash(window.location.hash);
	});
	inputManager.setInput(window.location.hash);
	sidebarNavInputManager.processHash(window.location.hash);
	
	mGlobalCommands.generateBanner("orion-editor", serviceRegistry, commandRegistry, preferences, searcher, editor, editor, escHandler); //$NON-NLS-0$
	// Put the make favorite command in our toolbar."
	//commandRegistry.registerCommandContribution("pageActions", "orion.makeFavorite", 2); //$NON-NLS-1$ //$NON-NLS-0$

	var syntaxChecker = new mSyntaxchecker.SyntaxChecker(serviceRegistry, editor);
	editor.addEventListener("InputChanged", function(evt) { //$NON-NLS-0$
		syntaxChecker.checkSyntax(inputManager.getContentType(), evt.title, evt.message, evt.contents);
	});

	window.onbeforeunload = function() {
		if (editor.isDirty()) {
			 return messages["There are unsaved changes."];
		}
	};
};
return exports;
});
