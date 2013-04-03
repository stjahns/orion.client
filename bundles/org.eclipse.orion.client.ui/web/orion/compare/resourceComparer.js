/*******************************************************************************
 * @license
 * Copyright (c) 2010, 2012 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/
/*global define document console prompt window*/
/*jslint forin:true regexp:false sub:true*/

define(['i18n!orion/compare/nls/messages', 'require', 'orion/Deferred', 'orion/webui/littlelib', 'orion/compare/compareUtils', 'orion/compare/diff-provider', 'orion/compare/compareView', 'orion/highlight', 
		'orion/fileClient', 'orion/globalCommands', 'orion/commands', 'orion/keyBinding', 'orion/searchAndReplace/textSearcher', 'orion/editorCommands', 'orion/editor/editorFeatures'], 
		function(messages, require, Deferred, lib, mCompareUtils, mDiffProvider, mCompareView, Highlight, mFileClient, mGlobalCommands, mCommands, mKeyBinding, mSearcher, mEditorCommands, mEditorFeatures) {

var exports = {};

exports.DefaultDiffProvider = (function() {
	function DefaultDiffProvider(serviceRegistry){
		this.serviceRegistry = serviceRegistry;
		this._diffProvider = new mDiffProvider.DiffProvider(serviceRegistry);
	}	
	DefaultDiffProvider.prototype = {
		_resolveTwoFiles: function(oldFileURL, newFileURL){
			var that = this;
			var compareTwo = function(results) {
				if(Array.isArray(results) && results.length === 2 && results[0] && results[1]){
					var oldFileContentType = results[0];
					var newFileContentType = results[1];
					return new Deferred().resolve({ oldFile:{URL: oldFileURL, Name: that._resolveFileName(oldFileURL), Type: oldFileContentType},
								newFile:{URL: newFileURL, Name: that._resolveFileName(newFileURL), Type: newFileContentType},
								diffContent: that._diffContent
							 });
				} else {
					var oldFileName = oldFileURL ? that._resolveFileName(oldFileURL) : ""; //$NON-NLS-0$
					var newFileName = newFileURL ? that._resolveFileName(newFileURL) : ""; //$NON-NLS-0$
					return new Deferred().resolve({ oldFile:{URL: oldFileURL, Name: oldFileName, Type: null},
								newFile:{URL: newFileURL, Name: newFileName, Type: null},
								diffContent: that._diffContent
							 });
				}
			};
			return Deferred.all([ that._getContentType(oldFileURL), that._getContentType(newFileURL)], function(error) { return {_error: error}; }).then(compareTwo);
		},
		
		//temporary
		//TODO : get the file name from file service
		_resolveFileName: function(fileURL){
			var fileName = fileURL.split("?")[0]; //$NON-NLS-0$
			return fileName;
		},
		
		_getContentType: function(fileURL){
			var filename = this._resolveFileName(fileURL);
			return this.serviceRegistry.getService("orion.core.contenttypes").getFilenameContentType(filename); //$NON-NLS-0$
		},
		
		_resolveComplexFileURL: function(complexURL) {
			var that = this;
			return this._diffProvider.getDiffFileURI(complexURL).then(function(jsonData, secondArg) {
				return that._resolveTwoFiles(jsonData.Old, jsonData.New);
			}, function(){});
		},
		
		resolveDiff: function(resource, compareTo, hasConflicts) {
			this._hasConflicts = hasConflicts;
			if(compareTo){
				return this._resolveTwoFiles(compareTo, resource);
			} else {
				if(!this._diffProvider){
					console.log("A diff provider is needed for compound diff URL"); //$NON-NLS-0$
					return;
				}
				var that = this;
				return that._diffProvider.getDiffContent(resource).then(function(jsonData, secondArg) {
					if (that._hasConflicts) {
						that._diffContent = jsonData.split("diff --git")[1]; //$NON-NLS-0$
					} else {
						that._diffContent = jsonData;
					}
					return that._resolveComplexFileURL(resource);
				}, function(){});
			}
		}
	};
	return DefaultDiffProvider;
}());

function CompareStyler(registry){
	this._syntaxHighlither = new Highlight.SyntaxHighlighter(registry);
}	
CompareStyler.prototype = {
	highlight: function(fileName, contentType, editor) {
		return this._syntaxHighlither.setup(contentType, editor.getTextView(), 
									 null, //passing an AnnotationModel allows the styler to use it to annotate tasks/comment folding/etc, but we do not really need this in compare editor
									 fileName,
									 false /*bug 378193*/);
	}
};

exports.ResourceComparer = (function() {
	function ResourceComparer (serviceRegistry, commandRegistry, options, viewOptions) {
		this._registry = serviceRegistry;
		this._commandService = commandRegistry;
		this._fileClient = new mFileClient.FileClient(serviceRegistry);
		this._fileClient = new mFileClient.FileClient(serviceRegistry);
		this._searchService = this._registry.getService("orion.core.search"); //$NON-NLS-0$
		this._progress = this._registry.getService("orion.page.progress"); //$NON-NLS-0$
		this.setOptions(options, true);
		if(options.toggleable) {
			this._compareView = new mCompareView.toggleableCompareView(options.type === "inline" ? "inline" : "twoWay", viewOptions); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
		} else if(options.type === "inline") { //$NON-NLS-0$
			this._compareView = new mCompareView.inlineCompareView(viewOptions);
		} else {
			this._compareView = new mCompareView.TwoWayCompareView(viewOptions);
		}
		this._compareView.getWidget().setOptions({extCmdHolder: this});
		if(!viewOptions.highlighters){
			this._compareView.getWidget().setOptions({highlighters: [new CompareStyler(serviceRegistry), new CompareStyler(serviceRegistry)]});
		}
		if(!viewOptions.oldFile){
			this._compareView.getWidget().setOptions({oldFile: {readonly: true}});
		}
		if(!viewOptions.newFile){
			this._compareView.getWidget().setOptions({newFile: {readonly: options.readonly}});
		}
		this.initExtCmds();
		var that = this;
		this._inputManager = {
			filePath: "",
			getInput: function() {
				return this.filePath;
			},
			
			setDirty: function(dirty) {
				mGlobalCommands.setDirtyIndicator(dirty);
			},
			
			getFileMetadata: function() {
				return this._fileMetadata;
			},
			
			setInput: function(fileURI, editor) {
				that._progress.progress(that._fileClient.read(fileURI, true), "Getting file metadata " + fileURI).then( //$NON-NLS-0$
					function(metadata) {
						this._fileMetadata = metadata;
						if( that.options.savable){
							var toolbar = lib.node("pageActions"); //$NON-NLS-0$
							if (toolbar) {	
								that._commandService.destroy(toolbar);
								that._commandService.renderCommands(toolbar.id, toolbar, that._compareView.getWidget().getEditors()[1], that._compareView.getWidget().getEditors()[1], "button"); //$NON-NLS-0$
							}
						}
						this.setTitle(metadata.Location, metadata);
					}.bind(this),
					function(error) {
						console.error("Error loading file metadata: " + error.message); //$NON-NLS-0$
						this.setTitle(fileURI);
					}.bind(this)
				);
				this.lastFilePath = fileURI;
			},
			
			setTitle : function(title, /*optional*/ metadata) {
				var name;
				if (metadata) {
					name = metadata.Name;
				}
				mGlobalCommands.setPageTarget({task: messages["Compare"], name: name, target: metadata,
							serviceRegistry: serviceRegistry, commandService: that._commandService,
							searchService: that._searchService, fileService: that._fileClient});
				if (title.charAt(0) === '*') { //$NON-NLS-0$
					mGlobalCommands.setDirtyIndicator(true);
					name = title.substring(1);
				} else {
					mGlobalCommands.setDirtyIndicator(false);
				} 
			},
			
			afterSave: function(){
				var editors = that._compareView.getWidget().getEditors();
				var newContents = editors[1].getTextView().getText();
				that._compareView.getWidget().options.newFile.Content = newContents;
				that._compareView.getWidget().refresh();
			}
		};
		if(!options.readonly && !options.toggleable && this._compareView.getWidget().type === "twoWay") { //$NON-NLS-0$
			var keyBindingFactory = function(editor, keyModeStack, undoStack, contentAssist) {
				var localSearcher = new mSearcher.TextSearcher(editor, that._commandService, undoStack);
				var commandGenerator = new mEditorCommands.EditorCommandFactory(that._registry, that._commandService,that._fileClient , that._inputManager, "pageActions", false, "pageNavigationActions", localSearcher); //$NON-NLS-1$ //$NON-NLS-0$
				commandGenerator.generateEditorCommands(editor);
				var genericBindings = new mEditorFeatures.TextActions(editor, undoStack);
				keyModeStack.push(genericBindings);
				// create keybindings for source editing
				var codeBindings = new mEditorFeatures.SourceCodeActions(editor, undoStack, contentAssist);
				keyModeStack.push(codeBindings);
			};
			this._compareView.getWidget().options.newFile.keyBindingFactory = keyBindingFactory;
		}
		this._compareView.getWidget().initEditors( messages['fetching...']);
		if(!options.readonly && !options.toggleable && this._compareView.getWidget().type === "twoWay") { //$NON-NLS-0$
			var editors = this._compareView.getWidget().getEditors();
			editors[1].addEventListener("DirtyChanged", function(evt) { //$NON-NLS-0$
				this._inputManager.setDirty(editors[1].isDirty());
			}.bind(this));
		}
	}
	ResourceComparer.prototype = {
		_clearOptions: function(){
			this.options = {};
		},
		setOptions: function(options, clearExisting){
			if(clearExisting){
				this._clearOptions();
			}
			if(!this.options) {
				this.options = {};
			}
			if(options) {
				Object.keys(options).forEach(function(option) {
					this.options[option] = options[option];
				}.bind(this));
			}
		},
		generateLink: function(compareWidget){	
			var diffPos = compareWidget.getCurrentDiffPos();
			var href = mCompareUtils.generateCompareHref(this.options.resource, {
				compareTo: this.options.compareTo,
				readonly: this.options.readonly,
				conflict: this.options.hasConflicts,
				block: diffPos.block ? diffPos.block : 1, 
				change: diffPos.change ? diffPos.change : 0 
			});
			prompt(messages["Copy the link URL:"], href);
		},
		
		openComparePage: function(compareWidget){	
			var diffPos = compareWidget.getCurrentDiffPos();
			var href = mCompareUtils.generateCompareHref(this.options.resource, {
				compareTo: this.options.compareTo,
				readonly: !this.options.editableInComparePage,
				conflict: this.options.hasConflicts,
				block: diffPos.block ? diffPos.block : 1, 
				change: diffPos.change ? diffPos.change : 0 
			});
			return href;
		},
		initExtCmds: function() {
			var cmdProvider = this._compareView.getWidget().options.commandProvider;
			if(cmdProvider && cmdProvider.getOptions().commandSpanId) {
				var commandSpanId = cmdProvider.getOptions().commandSpanId;
				var generateLinkCommand = new mCommands.Command({
					tooltip : messages["Generate link of the current diff"],
					name: messages["Generate Link"],
					//imageClass : "core-sprite-link", //$NON-NLS-0$
					id: "orion.compare.generateLink", //$NON-NLS-0$
					groupId: "orion.compareGroup", //$NON-NLS-0$
					visibleWhen: function(item) {
						return item.options.extCmdHolder.options.resource && item.options.extCmdHolder.options.generateLink;
					},
					callback : function(data) {
						data.items.options.extCmdHolder.generateLink(data.items);
				}});
				var openComparePageCommand = new mCommands.Command({
					tooltip : messages["Open the compare page"],
					name: messages["Compare"],
					//imageClass : "core-sprite-link", //$NON-NLS-0$
					id: "orion.compare.openComparePage", //$NON-NLS-0$
					groupId: "orion.compareGroup", //$NON-NLS-0$
					visibleWhen: function(item) {
						return item.options.extCmdHolder.options.resource && !item.options.extCmdHolder.options.generateLink;
					},
					hrefCallback: function(data) {
						return data.items.options.extCmdHolder.openComparePage(data.items);
				}});
				this._commandService.addCommand(generateLinkCommand);
				this._commandService.addCommand(openComparePageCommand);
					
				// Register command contributions
				this._commandService.registerCommandContribution(commandSpanId, "orion.compare.openComparePage", 98); //$NON-NLS-0$
				this._commandService.registerCommandContribution(commandSpanId, "orion.compare.generateLink", 99, null, false, new mKeyBinding.KeyBinding('l', true, true)); //$NON-NLS-1$ //$NON-NLS-0$
			}
		},
	    _getFilesContents: function(files){
	        var promises = [];
			files.forEach(function(file) {
				promises.push(this._loadSingleFile(file));
			}.bind(this));
			return Deferred.all(promises, function(error) { return {_error: error}; });
	    },
	    _loadSingleFile: function(file) {
	        return this._registry.getService("orion.page.progress").progress(this._fileClient.read(file.URL), "Getting contents of " + file.URL).then( //$NON-NLS-1$ //$NON-NLS-0$
		        function(contents) {
					file.Content = contents;
					return file;
		        }.bind(this),
		        function(error, ioArgs) {
					if (error.status === 404) {
						file.Content = "";
					} else {
						//TODO: show file loading error in the appropriate editor(error, ioArgs);
					}
					return file;
		        }.bind(this)
			);
	    },
		start: function(onLoadContents){
			if(this.options.resource){
				if(!this.options.diffProvider){
					console.log("A diff provider is needed for Complex diff URL"); //$NON-NLS-0$
					return;
				}
				var that = this;
				return that.options.diffProvider.resolveDiff(that.options.resource, that.options.compareTo, that.options.hasConflicts).then( function(diffParam){
					that._compareView.getWidget().setOptions(diffParam);
					var viewOptions = that._compareView.getWidget().options;
					viewOptions.oldFile.readonly = true;
					if(that.options.readonly) {
						viewOptions.newFile.readonly = true;
					}
					var filesToLoad = ( viewOptions.diffContent ? [viewOptions.oldFile/*, viewOptions.newFile*/] : [viewOptions.oldFile, viewOptions.newFile]); 
					return that._getFilesContents(filesToLoad).then( function(){
						var viewHeight = that._compareView.getWidget().refresh(true);
						if(!that.options.readonly && !that.options.toggleable && that._compareView.getWidget().type === "twoWay") { //$NON-NLS-0$
							this._inputManager.filePath = that._compareView.getWidget().options.newFile.URL;
							that._inputManager.setInput(viewOptions.newFile.URL , that._compareView.getWidget().getEditors()[1]);
						}
						return new Deferred().resolve(viewHeight);
					}.bind(that));
				});
			}
		}
	};
	return ResourceComparer;
}());

return exports;
});
