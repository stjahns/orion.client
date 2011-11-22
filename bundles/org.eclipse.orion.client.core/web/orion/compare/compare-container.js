/*******************************************************************************
 * @license
 * Copyright (c) 2010, 2011 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/

define(['require', 'dojo', 'orion/compare/diff-parser', 'orion/compare/rulers', 'orion/compare/compare-inline-model', 'orion/compare/compare-2way-model', 'orion/editor/contentAssist',
        'orion/editorCommands','orion/editor/editor','orion/editor/editorFeatures','orion/globalCommands', 'orion/breadcrumbs', 'orion/compare/gap-model' , 'orion/commands',
        'orion/textview/textModel','orion/textview/textView','examples/textview/textStyler' , 'orion/compare/compareUtils'], 
		function(require, dojo, mDiffParser, mRulers, mCompareModel, mTwoWayCompareModel, mContentAssist, mEditorCommands, mEditor, mEditorFeatures, mGlobalCommands, mBreadcrumbs,
				mGapModel , mCommands, mTextModel, mTextView, mTextStyler , mCompareUtils) {

var exports = {};

exports.CompareContainer = (function() {
	function CompareContainer (diffProvider) {
		this._diffParser = new mDiffParser.DiffParser();
		this._diff = null;
		this._baseFileContent = null;
	}
	CompareContainer.prototype = {
		_getLineDelim: function(input , diff){	
			var delim = "\n";
			return delim;
		},
		
		setDiffProvider: function(diffProvider){
			this._diffProvider = diffProvider;
		},
		
		getFileDiff: function(diffURI, uiCallBack, errorCallBack, onsave) {
			var that = this;
			this._diffProvider.getDiffContent(diffURI).then(function(jsonData, secondArg) {
				if (that._conflict) {
					that._diff = jsonData.split("diff --git")[1];
				} else {
					that._diff = jsonData;
				}
				if (onsave)
					that.setEditor(onsave);
				else
					that.getFileURI(diffURI, uiCallBack, errorCallBack);
			}, errorCallBack);
		},
		
		getFileURI: function(diffURI, uiCallBack, errorCallBack) {
			var that = this;
			this._diffProvider.getDiffFileURI(diffURI).then(function(jsonData, secondArg) {
				that._baseFileURI = jsonData.Old;
				that._newFileURI = jsonData.New;
				that.getBaseFileContent(that._baseFileURI, errorCallBack);
				if (uiCallBack)
					uiCallBack(that._newFileURI, that._baseFileURI);
			}, errorCallBack);
		},
		
		getBaseFileContent: function(fileURI, errorCallBack) {
			var that = this;
			that._registry.getService("orion.core.file").read(fileURI).then(function(contents) {
				that._baseFileContent = contents;
				that.getNewFileContent(that._newFileURI, errorCallBack);
			}, function(error, ioArgs) {
				if (error.status === 404) {
					that._baseFileContent = "";
					that.getNewFileContent(that._newFileURI, errorCallBack);
				} else if (errorCallBack) {
					errorCallBack(error, ioArgs);
				}
			});
		},
		
		getNewFileContent: function(fileURI, errorCallBack) {
			var that = this;
			that._registry.getService("orion.core.file").read(fileURI).then(function(contents) {
				that._newFileContent = contents;
				that.setEditor();
			}, function(error, ioArgs) {
				if (error.status === 404) {
					that._newFileContent = "";
					that.setEditor();
				} else if (errorCallBack) {
					errorCallBack(error, ioArgs);
				}
			});
		},
		
		parseMapper: function(input, output, diff , detectConflicts ,doNotBuildNewFile){
			var delim = this._getLineDelim(input , diff);
			this._diffParser.setLineDelim(delim);
			var result = this._diffParser.parse(input ,diff, detectConflicts ,doNotBuildNewFile);
			
			var mapper = result.mapper;
			var diffArray = this._diffParser.getDiffArray();
			return {delim:delim , mapper:result.mapper, diffArray:diffArray};
		},
		
		resolveDiff: function(hash , callBack , errorCallBack , onsave){
			this._diffURI = hash;
			this.getFileDiff(this._diffURI , callBack , errorCallBack , onsave );
		},
				
		resolveDiffonSave: function(){
			this.getFileDiff(this._diffURI , null , null , true );
		},
				
		_initDiffPosition: function(textView){
			var model = textView.getModel();
			if(model && model.getAnnotations){
				var annotations = model.getAnnotations();
				if(annotations.length > 0) {
					var lineIndex = annotations[0][0];
					var lineHeight = textView.getLineHeight();
					var clientArea = textView.getClientArea();
					var lines = Math.floor(clientArea.height / lineHeight/3);
					textView.setTopIndex((lineIndex - lines) > 0 ? lineIndex - lines : 0);
				}
			}
		}
		
	};
	return CompareContainer;
}());

//temporary text ssyntax styler , we will need to change it later to some thing else
exports.CompareSyntaxHighlighter = (function() {
	function CompareSyntaxHighlighter(){
		this.styler = null;
	}	
	CompareSyntaxHighlighter.prototype = {
			highlight: function(fileName, editorWidget) {
				if (this.styler) {
					this.styler.destroy();
					this.styler = null;
				}
				if (fileName) {
					var splits = fileName.split(".");
					if (splits.length > 0) {
						var extension = splits.pop().toLowerCase();
						switch(extension) {
							case "js":
								this.styler = new mTextStyler.TextStyler(editorWidget, "js");
								break;
							case "java":
								this.styler = new mTextStyler.TextStyler(editorWidget, "java");
								break;
							case "html":
								//TODO
								break;
							case "xml":
								//TODO
								break;
							case "css":
								this.styler = new mTextStyler.TextStyler(editorWidget, "css");
								break;
						}
					}
				}
			}
	};
	return CompareSyntaxHighlighter;
}());

//Diff block styler , this will always be called after the text styler
exports.DiffStyler = (function() {
	function DiffStyler(compareMatchRenderer, textView){
		this._compareMatchRenderer = compareMatchRenderer;
		this._textView = textView;
	}	
	DiffStyler.prototype = {
		highlight: function(textView) {
			if (this._textView) {
				this._textView.removeEventListener("LineStyle", this._lineStyleListener);
			}
			if(textView)
				this._textView = textView;
			if(this._textView && !this._textView.getModel().isMapperEmpty())
				this._textView.addEventListener("LineStyle", this._lineStyleListener = dojo.hitch(this, this._onLineStyle));
		},
		
		_onLineStyle: function(lineStyleEvent){
			var textView = this._textView;
			var lineIndex = lineStyleEvent.lineIndex;
			var lineTypeWrapper =  textView.getModel().getLineType(lineIndex);
			var lineType = lineTypeWrapper.type;
			var annotationIndex = mCompareUtils.getAnnotationIndexByMapper(textView.getModel().getAnnotations(), lineTypeWrapper.mapperIndex).current;
			var conflict = mCompareUtils.isMapperConflict(textView.getModel().getMapper(), lineTypeWrapper.mapperIndex);
			//https://bugs.eclipse.org/bugs/show_bug.cgi?id=349227 : we were using border style as the line below.Changing to back ground color and image.
			//lineStyleEvent.style = {style: {backgroundColor: "#EEEEEE" , borderTop: "1px #AAAAAA solid" , borderLeft: borderStyle , borderRight: borderStyle}};
			
			var selected = (annotationIndex === this._compareMatchRenderer.getCurrentAnnotationIndex());
			if(lineType === "top-only") {
				
				var backgroundImg;
				if(selected){
					backgroundImg = "url('" + require.toUrl("images/diff-border-sel.png") + "')";
				} else {
					backgroundImg = "url('" + require.toUrl("images/diff-border.png") + "')";
				}
				lineStyleEvent.style = {style: {backgroundImage: backgroundImg, backgroundRepeat:"repeat-x"}};
			} else if (lineType !== "unchanged"){
				var backgroundClass;
				if(selected){
					backgroundClass = conflict ?  "diffConflictSelect" : "diffNormalSelect";
				} else {
					backgroundClass = conflict ?  "diffConflict" : "diffNormal";
				}
				lineStyleEvent.style = {styleClass : backgroundClass}; 
			}
		}
		
	};
	return DiffStyler;
}());

//the wrapper to order the text and diff styler so that we can always have diff highlighted on top of text syntax
exports.TwoWayCompareStyler = (function() {
	function TwoWayCompareStyler(compareMatchRenderer){
		this._syntaxHighlither = new exports.CompareSyntaxHighlighter();
		this._diffHighlither = new exports.DiffStyler(compareMatchRenderer);
	}	
	TwoWayCompareStyler.prototype = {
		highlight: function(fileName, editorWidget) {
			this._syntaxHighlither.highlight(fileName, editorWidget);
			this._diffHighlither.highlight(editorWidget);
		}
	};
	return TwoWayCompareStyler;
}());

exports.TwoWayCompareContainer = (function() {
	/**
	 * Constructs a new side by side compare container. 
	 */
	function TwoWayCompareContainer(readonly , compareConflict, diffProvider , resgistry , commandService , fileClient,uiFactory) {
		this.setDiffProvider(diffProvider);
		this._uiFactory = uiFactory;
		this.readonly = readonly;
		this._conflict = compareConflict;
		this._registry = resgistry;
		this._commandService = commandService;
		this._leftEditorDivId = this._uiFactory.getEditorParentDivId(true);
		this._fileClient = fileClient;
		this._rightEditorDivId = this._uiFactory.getEditorParentDivId(false);
		this.initCommands();
		var that = this;
		this._inputManager = {
			filePath: "",
			getInput: function() {
				return this.filePath;
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
			
			getFileMetadata: function() {
				return this._fileMetadata;
			},
			
			setInput: function(fileURI, editor) {
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
				this.lastFilePath = fileURI;
			},
			setTitle : function(title) {
				var indexOfSlash = title.lastIndexOf("/");
				var shortTitle = title;
				if (indexOfSlash !== -1) {
					shortTitle = "Compare " + shortTitle.substring(indexOfSlash + 1);
					if (title.charAt(0) === '*') {
						shortTitle = '*' + shortTitle;
					}
				}
				this._lastTitle = shortTitle;
				window.document.title = shortTitle;
				var location = dojo.byId("location");
				if (location) {
					dojo.empty(location);
					new mBreadcrumbs.BreadCrumbs({container: "location", resource: this._fileMetadata});
					if (title.charAt(0) === '*') {
						var dirty = dojo.create('b', null, location, "last");
						dirty.innerHTML = '*';
					}
				}
			},
			afterSave: function(){
				that.resolveDiffonSave();
			}
		};
		this._compareMatchRenderer = new mRulers.CompareMatchRenderer(document.getElementById(this._uiFactory.getDiffCanvasDivId()));
		this._highlighter = [];
		this._highlighter.push( new exports.TwoWayCompareStyler(this._compareMatchRenderer));//left side styler
		this._highlighter.push( new exports.TwoWayCompareStyler(this._compareMatchRenderer));//right side styler
		this.initEditorContainers("\n" , "fetching..." , "fetching..." , []);
	}
	TwoWayCompareContainer.prototype = new exports.CompareContainer();
	TwoWayCompareContainer.prototype.initEditorContainers = function(delim , leftContent , rightContent , mapper, createLineStyler , fileURILeft , fileURIRight){	
		this._editorLeft = this.createEditorContainer(leftContent , delim , mapper, 0 , this._leftEditorDivId , this._uiFactory.getStatusDivId(true) ,this.readonly ,createLineStyler , fileURILeft);
		mGlobalCommands.generateDomCommandsInBanner(this._commandService, this._editorLeft , "pageActions",true);
		this._textViewLeft = this._editorLeft.getTextView();
		this._editorRight = this.createEditorContainer(rightContent , delim , mapper ,1 , this._rightEditorDivId , this._uiFactory.getStatusDivId(false) ,true, createLineStyler , fileURIRight);
		this._textViewRight = this._editorRight.getTextView();
		var that = this;
		var overview  = new mRulers.TwoWayCompareOverviewRuler("right", {styleClass: "ruler_overview"} , that._compareMatchRenderer.getAnnotation(),
				                    function(lineIndex, ruler){that._compareMatchRenderer.matchPositionFromAnnotation(lineIndex);});
		this._textViewRight.addRuler(overview);
		this._compareMatchRenderer.setOverviewRuler(overview);
		var that = this;
		window.onbeforeunload = function() {
			if (that._editorLeft.isDirty()) {
				return "There are unsaved changes.";
			}
		};
		
	};
	
	TwoWayCompareContainer.prototype.initCommands = function(){	
		var that = this;
		var nextDiffCommand = new mCommands.Command({
			name : "Next Diff",
			imageClass : "core-sprite-move_down",
			id: "orion.compare.nextDiff",
			groupId: "orion.compareGroup",
			callback : function() {
				that.nextDiff();
		}});
		var prevDiffCommand = new mCommands.Command({
			name : "Previous Diff",
			imageClass : "core-sprite-move_up",
			id: "orion.compare.prevDiff",
			groupId: "orion.compareGroup",
			callback : function() {
				that.prevDiff();
		}});
		var copyToLeftCommand = new mCommands.Command({
			name : "Copy Current Change From Right to left",
			imageClass : "core-sprite-leftarrow",
			id: "orion.compare.copyToLeft",
			groupId: "orion.compareGroup",
			callback : function() {
				that.copyToLeft();;
			}});
		this._commandService.addCommand(prevDiffCommand, "dom");
		this._commandService.addCommand(nextDiffCommand, "dom");
		this._commandService.addCommand(copyToLeftCommand, "dom");
			
		// Register command contributions
		this._commandService.registerCommandContribution("orion.compare.prevDiff", 3, "rightContainerCommands");
		this._commandService.registerCommandContribution("orion.compare.nextDiff", 2, "rightContainerCommands");
		if (!this.readonly) {
			this._commandService.registerCommandContribution("orion.compare.copyToLeft", 1, "rightContainerCommands");
		}
		this._commandService.renderCommands("rightContainerCommands", "dom", that, that, "image");
	};
	
	TwoWayCompareContainer.prototype.nextDiff = function(){	
		this._compareMatchRenderer.nextDiff();
	};
	
	TwoWayCompareContainer.prototype.prevDiff = function(){	
		this._compareMatchRenderer.prevDiff();
	};
	
	TwoWayCompareContainer.prototype.copyToLeft = function(){	
		this._compareMatchRenderer.copyToLeft();
	};
	
	TwoWayCompareContainer.prototype.createEditorContainer = function(content , delim , mapper , columnIndex , parentDivId , statusDivId ,readOnly , createLineStyler , fileURI){
		var editorContainerDomNode = dojo.byId(parentDivId);
		var that = this;
		
		var model = new mTextModel.TextModel(content , delim);
		var compareModel = new mTwoWayCompareModel.TwoWayCompareModel(model, {mapper:mapper, columnIndex:columnIndex } );
		var textViewFactory = function() {
			return new mTextView.TextView({
				parent: editorContainerDomNode,
				model: compareModel,
				readonly: readOnly,
				stylesheet: require.toUrl("orion/compare/editor.css") ,
				tabSize: 4
			});
		};
			
		var contentAssistFactory = function(editor) {
			return new mContentAssist.ContentAssist(editor, "contentassist");
		};
			
		var keyBindingFactory = function(editor, keyModeStack, undoStack, contentAssist) {
			// Create keybindings for generic editing
			if(readOnly)
				return;
			
			var commandGenerator = new mEditorCommands.EditorCommandFactory(that._registry, that._commandService,that._fileClient , that._inputManager, "pageActions");
			commandGenerator.generateEditorCommands(editor);
			var genericBindings = new mEditorFeatures.TextActions(editor, undoStack);
			keyModeStack.push(genericBindings);
				
			// create keybindings for source editing
			var codeBindings = new mEditorFeatures.SourceCodeActions(editor, undoStack, contentAssist);
			keyModeStack.push(codeBindings);
				
		};

		var dirtyIndicator = "";
		var status = "";
		var statusReporter = function(message, isError) {
			if(!statusDivId)
				return;
			if (isError) {
				status =  "ERROR: " + message;
			} else {
				status = message;
			}
			dojo.byId(statusDivId).innerHTML = dirtyIndicator +  status;
		};
		var undoStackFactory = readOnly ? new mEditorFeatures.UndoFactory() : new mEditorCommands.UndoCommandFactory(that._registry, that._commandService, "pageActions");
		var editor = new mEditor.Editor({
			textViewFactory: textViewFactory,
			undoStackFactory: undoStackFactory,
			//annotationFactory: annotationFactory,
			//lineNumberRulerFactory: new exports.LineNumberRulerFactory(),
			contentAssistFactory: contentAssistFactory,
			keyBindingFactory: keyBindingFactory, 
			statusReporter: statusReporter,
			domNode: editorContainerDomNode
		});
				
		editor.installTextView();
		if(!readOnly){
			var inputManager = this._inputManager;
			editor.addEventListener("DirtyChanged", function(evt) {
				inputManager.setDirty(editor.isDirty());
			});
		}
			
		var textView = editor.getTextView();
		if(createLineStyler && fileURI){
			var fileName = fileURI.split("?")[0];
			editor.setInput(fileName);
			this._highlighter[columnIndex].highlight(fileName , editor);
		}
			
		textView.addRuler(new mRulers.LineNumberCompareRuler(0,"left", {styleClass: "ruler_lines"}, {styleClass: "ruler_lines_odd"}, {styleClass: "ruler_lines_even"}));

		textView.addEventListener("Selection", function() {
			var lineIndex = textView.getModel().getLineAtOffset(textView.getCaretOffset());
			var mapperIndex = mCompareUtils.lookUpMapper(textView.getModel().getMapper() , columnIndex , lineIndex).mapperIndex;
			var annotationIndex = mCompareUtils.getAnnotationIndexByMapper(textView.getModel().getAnnotations(), mapperIndex);
			if(annotationIndex.current !== -1)
				that._compareMatchRenderer.gotoDiff(annotationIndex.current);
		}); 
		
		if(columnIndex === 0){
			textView.getModel().addEventListener("Changed", function(e) {
				that._compareMatchRenderer.onChanged(e);
			});
			textView.addEventListener("Scroll", function(scrollEvent) {
				if(that._compareMatchRenderer){
					that._compareMatchRenderer.matchPositionFrom(true);
					that._compareMatchRenderer.render();
				}
			}); 
		} else {
			textView.addEventListener("Scroll", function(scrollEvent) {
				if(that._compareMatchRenderer){
					that._compareMatchRenderer.render();
				}
			}); 
		}
		return editor;
	};

	TwoWayCompareContainer.prototype.setEditor = function(onsave){	
		var input = this._baseFileContent;
		var output = this._newFileContent;
		var diff = this._diff;
	
		var result = this.parseMapper(input , output, diff , this._conflict, true);
		var that = this;
		if(!this._editorLeft){
			this.initEditorContainers(result.delim , output , input ,  result.mapper , true , this._newFileURI , this._baseFileURI);
		} else if (onsave) {
			this._textViewLeft.getModel().init(result.mapper);
			this._textViewRight.getModel().init(result.mapper);
			this._textViewLeft.redrawRange();
			this._textViewRight.redrawRange();
		}else {
			this._inputManager.filePath = this._newFileURI;
			this._textViewLeft.getModel().init(result.mapper);
			this._textViewRight.getModel().init(result.mapper);
			
			var fileNameR = this._baseFileURI.split("?")[0];
			this._editorRight.setInput(fileNameR, null, input);
			this._highlighter[1].highlight(fileNameR , this._textViewRight);
			
			var fileNameL = this._newFileURI.split("?")[0];
			this._editorLeft.setInput(fileNameL, null, output);
			this._highlighter[0].highlight(fileNameL , this._textViewLeft);
			if(!this.readonly)
				this._inputManager.setInput(fileNameL , this._editorLeft);
		}
		this._compareMatchRenderer.init(result.mapper ,this._textViewLeft , this._textViewRight);
		this._compareMatchRenderer.matchPositionFromAnnotation(-1);
	};
	return TwoWayCompareContainer;
}());

exports.InlineCompareContainer = (function() {
	function InlineCompareContainer(diffProvider ,resgistry , editorDivId ) {
		this._annotation = new mRulers.CompareAnnotation();
		this.setDiffProvider(diffProvider);
		this._registry = resgistry;
		this._editorDivId = editorDivId;
		this.initEditorContainers("" , "\n" , [],[]);
		this.hasContent = false;
	}
	InlineCompareContainer.prototype = new exports.CompareContainer();
	
	InlineCompareContainer.prototype.addRulers = function(){
		if(this._textView && !this._hasRuler){
			this._textView.addRuler(this._rulerOrigin);
			this._textView.addRuler(this._rulerNew);
			this._textView.addRuler(this._overview);
			this._hasRuler = true;
		}
	};
	
	InlineCompareContainer.prototype.removeRulers = function(){
		if(this._textView && this._hasRuler){
			this._textView.removeRuler(this._rulerOrigin);
			this._textView.removeRuler(this._rulerNew);
			this._textView.removeRuler(this._overview);
			this._hasRuler = false;
		}
	};

	InlineCompareContainer.prototype.destroyEditor = function(){
		if(this._textView){
			this._textView.getModel().init([],[]);
			this._textView.setText("");
			this.removeRulers();
		}
		this.hasContent = false;
	};

	InlineCompareContainer.prototype.createEditorContainer = function(content , delim , mapper , diffArray ,createLineStyler , fileURI){
		var editorContainerDomNode = dojo.byId(this._editorDivId);
		var that = this;
		
		var model = new mTextModel.TextModel(content, delim);
		var compareModel = new mCompareModel.CompareTextModel(model, {mapper:mapper , columnIndex:0} , new mCompareModel.DiffLineFeeder(diffArray ,delim));

		var textViewFactory = function() {
			return new mTextView.TextView({
				parent: editorContainerDomNode,
				model: compareModel,
				readonly: true,
				stylesheet: require.toUrl("orion/compare/editor.css") ,
				tabSize: 4
			});
		};
			
		var keyBindingFactory = function(editor, keyModeStack, undoStack, contentAssist) {
				return;
		};

		var statusReporter = function(message, isError) {
			return;
		};
		var undoStackFactory =  new mEditorFeatures.UndoFactory();
		var editor = new mEditor.Editor({
			textViewFactory: textViewFactory,
			undoStackFactory: undoStackFactory,
			//annotationFactory: annotationFactory,
			//lineNumberRulerFactory: new exports.LineNumberRulerFactory(),
			//contentAssistFactory: contentAssistFactory,
			keyBindingFactory: keyBindingFactory, 
			statusReporter: statusReporter,
			domNode: editorContainerDomNode
		});
				
		editor.installTextView();
		if(createLineStyler && fileURI)
			editor.setInput(fileURI.split("?")[0]);
			
		var textView = editor.getTextView();
			
		this._rulerOrigin = new mRulers.LineNumberCompareRuler(1,"left", {styleClass: "ruler_lines"}, {styleClass: "ruler_lines_odd"}, {styleClass: "ruler_lines_even"});
		this._rulerNew = new mRulers.LineNumberCompareRuler(0,"left", {styleClass: "ruler_lines"}, {styleClass: "ruler_lines_odd"}, {styleClass: "ruler_lines_even"});
		var that = this;
		this._overview  = new mRulers.TwoWayCompareOverviewRuler("right", {styleClass: "ruler_overview"} , that._annotation,
				function(lineIndex, ruler){
					that._annotation.matchPositionFromAnnotation(lineIndex);
					that.positionAnnotation(lineIndex);
				});
		textView.addEventListener("LineStyle", function(e) {
			that._onLineStyle(e);
		});
		
		textView.addEventListener("Selection", function() {
			var lineIndex = textView.getModel().getLineAtOffset(textView.getCaretOffset());
			var mapperIndex = textView.getModel().getLineType(lineIndex).mapperIndex;
			var annotationIndex = mCompareUtils.getAnnotationIndexByMapper(textView.getModel().getAnnotations(), mapperIndex);
			if(annotationIndex.current !== -1){
				that._annotation.gotoDiff(annotationIndex.current);
				var drawLine = textView.getTopIndex() ;
				textView.redrawRange();
				textView.redrawLines(drawLine , drawLine+  1 , that._overview);
			}
		}); 
		
		return editor;
	};

	InlineCompareContainer.prototype.initEditorContainers = function(delim , content , mapper, createLineStyler , fileURI){	
		this._editor = this.createEditorContainer(content , delim , mapper, createLineStyler , fileURI);
		this._textView = this._editor.getTextView();
	};
	
	InlineCompareContainer.prototype._onLineStyle = function(lineStyleEvent){
		var lineIndex = lineStyleEvent.lineIndex;
		var lineStart = lineStyleEvent.lineStart;
		var lineTypeWrapper = this._textView.getModel().getLineType(lineIndex);
		var lineType = lineTypeWrapper.type;
		
		var annotationIndex = mCompareUtils.getAnnotationIndexByMapper(this._textView.getModel().getAnnotations(), lineTypeWrapper.mapperIndex).current;
		if(lineType === "added") {
			if(annotationIndex === this._annotation.getCurrentAnnotationIndex())
				lineStyleEvent.style = {styleClass: "diffInlineAddedSelect"};
			else
				lineStyleEvent.style = {styleClass: "diffInlineAdded"};
		} else if (lineType === "removed"){
			if(annotationIndex === this._annotation.getCurrentAnnotationIndex())
				lineStyleEvent.style = {styleClass: "diffInlineRemovedSelect"};
			else
				lineStyleEvent.style = {styleClass: "diffInlineRemoved"};
		} 
	};
	
	InlineCompareContainer.prototype.setEditor = function(){
		var input = this._baseFileContent;
		var output = this._newFileContent;
		var diff = this._diff;

		this.hasContent = true;
		var result = this.parseMapper(input, output, diff, false, true);
		var that = this;
		if(!this._textView){
			this.initEditorContainers(result.delim , input ,  result.mapper , result.diffArray , true , this._newFileURI);
		}else {
			this.addRulers();
			this._textView.getModel().init([],[]);
			this._textView.setText("");
			
			this._textView.getModel().init(result.mapper , result.diffArray);
			this._textView.setText(input);
			this._annotation.init(result.mapper ,this._textView);
		}
		this._initDiffPosition(this._textView);
	};
	
	InlineCompareContainer.prototype.nextDiff = function(){	
		this._annotation.nextDiff();
		this.positionAnnotation(this._textView.getModel().getAnnotations()[this._annotation.getCurrentAnnotationIndex()][0]);
	};
	
	InlineCompareContainer.prototype.setConflicting =  function(conflicting){	
		this._conflcit = conflicting;
	};
	
	InlineCompareContainer.prototype.prevDiff = function(){	
		this._annotation.prevDiff();
		this.positionAnnotation(this._textView.getModel().getAnnotations()[this._annotation.getCurrentAnnotationIndex()][0]);
	};
	
	InlineCompareContainer.prototype.positionAnnotation = function(lineIndex){	
		if(this._textView){
			var lineHeight = this._textView.getLineHeight();
			var clientArea = this._textView.getClientArea();
			var lines = Math.floor(clientArea.height / lineHeight/3);
			this._textView.setTopIndex((lineIndex - lines) > 0 ? lineIndex - lines : 0);
			this._textView.redrawRange();
			var drawLine = this._textView.getTopIndex() ;
			this._textView.redrawLines(drawLine , drawLine+  1 , this._overview);
		}
	};

	return InlineCompareContainer;
}());

return exports;
});
