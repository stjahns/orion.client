/*******************************************************************************
 * Copyright (c) 2010, 2011 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/
/*global eclipse:true orion:true dojo dijit window*/
/*jslint devel:true*/

dojo.require("dojo.hash");

eclipse.setUpEditor = function(isReadOnly){
	var pluginRegistry = null;
	var serviceRegistry = null;
	var document = window.document;
	var selection;
	var prefsService;
	var commandService;
	var statusReportingService;
	var problemService;
	
	// Initialize the plugin registry
	(function() {
		// This is the new service registry.  All services should be registered and obtained here.
		serviceRegistry = new eclipse.ServiceRegistry();
		pluginRegistry = new eclipse.PluginRegistry(serviceRegistry);
		dojo.addOnWindowUnload(function() {
			pluginRegistry.shutdown();
		});
		
		selection = new orion.Selection(serviceRegistry);
		statusReportingService = new eclipse.StatusReportingService(serviceRegistry, "statusPane", "notifications");
		new eclipse.LogService(serviceRegistry);
		new eclipse.DialogService(serviceRegistry);
		new eclipse.UserService(serviceRegistry);
		prefsService = new eclipse.PreferencesService(serviceRegistry, "/prefs/user");
		commandService = new eclipse.CommandService({serviceRegistry: serviceRegistry, selection: selection});

		// Editor needs additional services besides EAS.
		problemService = new eclipse.ProblemService(serviceRegistry);
		new eclipse.OutlineService(serviceRegistry);
		new eclipse.FavoritesService({serviceRegistry: serviceRegistry});
	}());
	
	var splitArea = dijit.byId("orion.innerCoding"),
		outlineDomNode = dojo.byId("outline"),
		editorContainerDomNode = dojo.byId("editorContainer"),
		searchFloat = dojo.byId("searchFloat"),
		leftPane = dojo.byId("leftPane");

	var contentAssistFactory = null;
	if (!isReadOnly) {
		contentAssistFactory = function(editor) {
			return new eclipse.ContentAssist(editor, "contentassist", serviceRegistry);
		};
	}
	
	// Temporary.  This will evolve into something pluggable.
	var syntaxHighlightProviders = serviceRegistry.getServiceReferences("ISyntaxHighlight");
	var syntaxHighlighter = {
		styler: null, 
		
		highlight: function(fileName, editorWidget) {
			if (this.styler) {
				this.styler.destroy();
				this.styler = null;
			}
			if (fileName) {
				var splits = fileName.split(".");
				var extension = splits.pop().toLowerCase();
				if (splits.length > 0) {
					switch(extension) {
						case "js":
							this.styler = new eclipse.TextStyler(editorWidget, "js");
							break;
						case "java":
							this.styler = new eclipse.TextStyler(editorWidget, "java");
							break;
						case "css":
							this.styler = new eclipse.TextStyler(editorWidget, "css");
							break;
					}
					
					if (!this.styler && syntaxHighlightProviders) {
						// Check our syntax highlight providers
						var providerToUse;
						dojo.some(syntaxHighlightProviders, function(provider) {
							var fileTypes = provider.getProperty("fileTypes");
							if (fileTypes) {
								for (var i=0; i < fileTypes.length; i++) {
									if (fileTypes[i] === extension) {
										providerToUse = provider;
										return true;
									}
								}
							}
						});
						
						if (providerToUse) {
							var providerType = providerToUse.getProperty("type");
							if (providerType === "grammar") {
								// TextMate styler
								var grammar = providerToUse.getProperty("grammar");
								this.styler = new orion.styler.TextMateStyler(editorWidget, grammar);
							} else if (providerType === "parser") {
								console.debug("TODO implement support for parser-based syntax highlight provider");
							}
						}
					}
				}
			}
		}
	};

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

		var searcher = new eclipse.Searcher({serviceRegistry: serviceRegistry});
		
		var editorFactory = function() {
			return new eclipse.Editor({
				parent: editorContainerDomNode,
				stylesheet: ["/editor/samples/editor.css", "/css/default-theme.css"],
				tabSize: 4,
				readonly: isReadOnly
			});
		};
	
		var inputManager = {
			lastFilePath: "",
			
			setInput: function(location, editorContainer) {
				var input = eclipse.util.getPositionInfo(location);
				var fileURI = input.filePath;
				// populate editor
				if (fileURI) {
					if (fileURI === this.lastFilePath) {
						editorContainer.showSelection(input.start, input.end, input.line, input.offset, input.length);
					} else {
						if (!editorContainer.getEditorWidget()) {
							editorContainer.installEditor();
						}
						var fullPathName = fileURI;
						var progressTimeout = setTimeout(function() {
							editorContainer.onInputChange(fullPathName, "Fetching " + fullPathName, null);
						}, 800); // wait 800ms before displaying
						fileClient.read(fileURI).then(
							dojo.hitch(this, function(contents) {
								clearTimeout(progressTimeout);
								editorContainer.onInputChange(fileURI, null, contents);
								// in the long run we should be looking for plug-ins to call here for highlighting
								syntaxHighlighter.highlight(fileURI, editorContainer.getEditorWidget());
								editorContainer.showSelection(input.start, input.end, input.line, input.offset, input.length);
							}),
							dojo.hitch(this, function(error) {
								clearTimeout(progressTimeout);
								editorContainer.onInputChange(fullPathName, "An error occurred: " + error.message, null);
								console.error("HTTP status code: ", error.status);
							})
						);
						fileClient.read(fileURI, true).then(
							dojo.hitch(this, function(metadata) {
								this._fileMetadata = metadata;
								this.setTitle(metadata.Location);
							}),
							dojo.hitch(this, function(error) {
								console.error("Error loading file metadata: " + error.message);
								this.setTitle(fileURI);
							})
						);
					}
					this.lastFilePath = fileURI;
				} else {
					editorContainer.onInputChange("No File Selected", "", null);
				}
			},
			
			getInput: function() {
				return this.lastFilePath;
			},
				
			setTitle : function(title) {
				var indexOfSlash = title.lastIndexOf("/");
				var shortTitle = title;
				if (indexOfSlash !== -1) {
					shortTitle = shortTitle.substring(indexOfSlash + 1);
					if (title.charAt(0) === '*') {
						shortTitle = '*' + shortTitle;
					}
				}
				this._lastTitle = shortTitle;
				window.document.title = shortTitle;
				var titlePane = dojo.byId("pageTitle");
				if (titlePane) {
					dojo.empty(titlePane);
					new eclipse.BreadCrumbs({container: "pageTitle", resource: this._fileMetadata});
					if (title.charAt(0) === '*') {
						var dirty = dojo.create('b', null, titlePane, "last");
						dirty.innerHTML = '*';
					}
				}
			},
			
			getTitle: function() {
				return this._lastTitle;
			},
			
			getFileMetadata: function() {
				return this._fileMetadata;
			},
			
			setDirty: function(dirty) {
				if (dirty) {
					if (this._lastTitle && this._lastTitle.charAt(0) !== '*') {
						this.setTitle('*'+ this._lastTitle);
					}
				} else {
					if (this._lastTitle && this._lastTitle.charAt(0) === '*') {
						this.setTitle(this._lastTitle.substring(1));
					}
				}
			},
			
			hashChanged: function(editorContainer) {	
				if (this.shouldGoToURI(editorContainer, dojo.hash())) {
					selection.setSelections(dojo.hash());
				} else {
					// we are staying at our previous location
					dojo.hash(this.lastFilePath);
				}
			},
			
			shouldGoToURI: function(editorContainer, fileURI) {
				if (editorContainer.isDirty()) {
					var oldStripped = eclipse.util.getPositionInfo(this.lastFilePath).filePath;
					var newStripped = eclipse.util.getPositionInfo(fileURI).filePath;
					if (oldStripped !== newStripped) {
						return window.confirm("There are unsaved changes.  Do you still want to navigate away?");
					}
				}
				return true;
			}
		};	
		
		var keyBindingFactory = function(editor, keyModeStack, undoStack, contentAssist) {
			// Register commands that depend on external services, the registry, etc.
			var commandGenerator = new orion.EditorCommandFactory(serviceRegistry, commandService, fileClient, inputManager, "pageActions", isReadOnly);
			commandGenerator.generateEditorCommands(editor);
			
			// Create keybindings for generic editing, no dependency on the service model
			var genericBindings = new orion.TextActions(editor, undoStack);
			keyModeStack.push(genericBindings);
			
			// create keybindings for source editing
			// TODO this should probably be something that happens more dynamically, when the editor changes input
			var codeBindings = new orion.SourceCodeActions(editor, undoStack, contentAssist);
			keyModeStack.push(codeBindings);
			
			// global search
			editor.getEditorWidget().setKeyBinding(new eclipse.KeyBinding("h", true), "search");
			editor.getEditorWidget().setAction("search", function() {
				window.setTimeout(function() {
					var e = editor.getEditorWidget();
					var selection = e.getSelection();
					var searchPattern = "";
					if (selection.end > selection.start) {
						searchPattern = e.getText().substring(selection.start, selection.end);
					} if (searchPattern.length <= 0) {
						searchPattern = prompt("Enter search term:", searchPattern);
					} if (!searchPattern) {
						return;
					}
					searchFloat.onclick = function() {
						searchFloat.style.display = "none";
					};
					// TEMPORARY until we can better scope the search
					var extensionFilter = "";
					var fileName = inputManager.getTitle();
					
					dojo.place(document.createTextNode("Searching for occurrences of "), searchFloat, "last");
					var b = dojo.create("b", null, searchFloat, "last");
					dojo.place(document.createTextNode("\"" + searchPattern + "\""), b, "only");
					
					if (fileName) {
						var splits = fileName.split(".");
						if (splits.length > 0) {
							var extension = splits.pop().toLowerCase();
							extensionFilter = "+Name:*." + extension + "+";
							
							dojo.place(document.createTextNode(" in *."), searchFloat, "last");
							dojo.place(document.createTextNode(extension), searchFloat, "last");
						}
					}
					dojo.place(document.createTextNode("..."), searchFloat, "last");
					
					searchFloat.style.display = "block";
					var query = inputManager.getFileMetadata().SearchLocation + searchPattern + extensionFilter;
					searcher.search(searchFloat, query, inputManager.getInput());
				}, 0);
			});
				
			
			// splitter binding
			editor.getEditorWidget().setKeyBinding(new eclipse.KeyBinding("o", true), "toggle");
			editor.getEditorWidget().setAction("toggle", function(){
					splitArea.toggle();
			});
		};
		
		var statusReporter = function(message, isError) {
			if (isError) {
				statusReportingService.setErrorMessage(message);	
			} else {
				statusReportingService.setMessage(message);	
			}
		};
	
		var annotationFactory = new orion.AnnotationFactory();
		
		var editorContainer = new orion.EditorContainer({
			editorFactory: editorFactory,
			undoStackFactory: new orion.UndoCommandFactory(serviceRegistry, commandService, "pageActions"),
			annotationFactory: annotationFactory,
			lineNumberRulerFactory: new orion.LineNumberRulerFactory(),
			contentAssistFactory: contentAssistFactory,
			keyBindingFactory: keyBindingFactory, 
			statusReporter: statusReporter,
			domNode: editorContainerDomNode
		});
		
		// Establishing dependencies on registered services
		serviceRegistry.getService("IProblemProvider").then(function(problemProvider) {
			problemProvider.addEventListener("problemsChanged", function(problems) {
				annotationFactory.showProblems(problems);
			});
		});
		
		dojo.connect(editorContainer, "onDirtyChange", inputManager, inputManager.setDirty);
		
		// Generically speaking, we respond to changes in selection.  New selections change the editor's input.
		serviceRegistry.getService("Selection").then(function(service) {
			service.addEventListener("selectionChanged", function(fileURI) {
				if (inputManager.shouldGoToURI(editorContainer, fileURI)) {
					inputManager.setInput(fileURI, editorContainer);
				} 
			});
		});
	
		// In this page, the hash change drives selection.  In other scenarios, a file picker might drive selection
		dojo.subscribe("/dojo/hashchange", inputManager, function() {inputManager.hashChanged(editorContainer);});
		inputManager.setInput(dojo.hash(), editorContainer);
		
		// TODO search location needs to be gotten from somewhere
		eclipse.globalCommandUtils.generateBanner("toolbar", serviceRegistry, commandService, prefsService, searcher, editorContainer, editorContainer);
		eclipse.globalCommandUtils.generateDomCommandsInBanner(commandService, editorContainer);
			
		var syntaxChecker = new eclipse.SyntaxChecker(serviceRegistry, editorContainer);
		
		// Create outliner "gadget"
		new eclipse.Outliner({parent: outlineDomNode, serviceRegistry: serviceRegistry, selectionService: selection});	
		
		window.onbeforeunload = function() {
			if (editorContainer.isDirty()) {
				 return "There are unsaved changes.";
			}
		};
		
		// Set up the border container
		splitArea.setToggleCallback(function() {
			editorContainer.getEditorWidget().redrawLines();
		});
				
		// Ctrl+o handler for toggling outline 
		document.onkeydown = function (evt){
			evt = evt || window.event;
			if(evt.ctrlKey && evt.keyCode  === 79){
				splitArea.toggle();
				if(document.all){ 
					evt.keyCode = 0;
				}else{ 
					evt.preventDefault();
					evt.stopPropagation();
				}					
			} 
		};
	});
};
