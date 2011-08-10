/*******************************************************************************
 * Copyright (c) 2009, 2011 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/
 
 /*global window dojo orion:true eclipse:true handleGetAuthenticationError*/
 /*jslint maxerr:150 browser:true devel:true regexp:false*/

var orion = orion || {};
orion.editor = orion.editor || {};	

/**
 * @name orion.editor.Editor
 * @class An <code>Editor</code> is a user interface for editing text that provides additional features over the basic {@link orion.textview.TextView}.
 * Some of <code>Editor</code>'s features include:
 * <ul>
 * <li>Additional actions and key bindings for editing text</li>
 * <li>Content assist</li>
 * <li>Find and Incremental Find</li>
 * <li>Rulers for displaying line numbers and annotations</li>
 * <li>Status reporting</li>
 * </ul>
 * 
 * @description Creates a new Editor with the given options.
 * @param {Object} options Options controlling the features of this Editor.
 * @param {Object} options.annotationFactory
 * @param {Object} options.contentAssistFactory
 * @param {Object} options.domNode
 * @param {Object} options.keyBindingFactory
 * @param {Object} options.lineNumberRulerFactory
 * @param {Object} options.statusReporter
 * @param {Object} options.syntaxHighlightProviders
 * @param {Object} options.textViewFactory
 * @param {Object} options.undoStackFactory
 */
orion.editor.Editor = (function() {
	/** @private */
	function Editor(options) {
		this._textViewFactory = options.textViewFactory;
		this._undoStackFactory = options.undoStackFactory;
		this._annotationFactory = options.annotationFactory;
		this._lineNumberRulerFactory = options.lineNumberRulerFactory;
		this._contentAssistFactory = options.contentAssistFactory;
		this._keyBindingFactory = options.keyBindingFactory;
		this._statusReporter = options.statusReporter;
		this._domNode = options.domNode;
		this._syntaxHighlightProviders = options.syntaxHighlightProviders;
		
		this._annotationsRuler = null;
		this._overviewRuler = null;
		this._dirty = false;
		this._contentAssist = null;
		this._keyModes = [];		
	}
	Editor.prototype = /** @lends orion.editor.Editor.prototype */ {
		/**
		 * Returns the underlying <code>TextView</code> used by this editor. 
		 * @returns orion.textview.TextView
		 */
		getTextView: function() {
			return this._textView;
		},
		
		/**
		 * @private
		 */
		reportStatus: function(message, isError, isProgress) {
			if (this._statusReporter) {
				this._statusReporter(message, isError, isProgress);
			} else {
				window.alert(isError ? "ERROR: " + message : message);
			}
		},
				
		/**
		 * @static
		 * @param {orion.textview.TextView} textView
		 * @param {Number} start
		 * @param {Number} [end]
		 * @param {function} callBack A call back function that is used after the move animation is done
		 * @private
		 */
		moveSelection: function(textView, start, end, callBack) {
			end = end || start;
			textView.setSelection(start, end, false);
			var topPixel = textView.getTopPixel();
			var bottomPixel = textView.getBottomPixel();
			var line = textView.getModel().getLineAtOffset(start);
			var linePixel = textView.getLinePixel(line);
			if (linePixel < topPixel || linePixel > bottomPixel) {
				var height = bottomPixel - topPixel;
				var target = Math.max(0, linePixel- Math.floor((linePixel<topPixel?3:1)*height / 4));
				var a = new dojo.Animation({
					node: textView,
					duration: 300,
					curve: [topPixel, target],
					onAnimate: function(x){
						textView.setTopPixel(Math.floor(x));
					},
					onEnd: function() {
						textView.showSelection();
						textView.focus();
						if(callBack)
							callBack();
					}
				});
				a.play();
			} else {
				textView.showSelection();
				textView.focus();
				if(callBack)
					callBack();
			}
		},
		/**
		 * Returns the current contents of the editor. 
		 * @returns {String}
		 */
		getContents : function() {
			if (this._textView) {
				return this._textView.getText();
			}
		},
		/**
		 * Returns <code>true</code> if the editor is dirty; <code>false</code> otherwise.
		 * @returns {Boolean} 
		 */
		isDirty : function() {
			return this._dirty;
		},
		/** @private */
		checkDirty : function() {
			var dirty = !this._undoStack.isClean();
			if (this._dirty === dirty) {
				return;
			}
			this.onDirtyChange(dirty);
		},
		
		/**
		 * @returns {Object}
		 */
		getAnnotationsRuler : function() {
			return this._annotationsRuler;
		},

		/**
		 * Helper for finding occurrences of str in the editor contents.
		 * @param {String} str
		 * @param {Number} startIndex
		 * @param {Boolean} [ignoreCase] Default is false.
		 * @param {Boolean} [reverse] Default is false.
		 * @return {Object} An object giving the match details, or <code>null</code> if no match found. The returned 
		 * object will have the properties:<br />
		 * {Number} index<br />
		 * {Number} length 
		 */
		doFind: function(str, startIndex, ignoreCase, reverse) {
			var text = this._textView.getText();
			if (ignoreCase) {
				str = str.toLowerCase();
				text = text.toLowerCase();
			}
			
			var i;
			if (reverse) {
				text = text.split("").reverse().join("");
				str = str.split("").reverse().join("");
				startIndex = text.length - startIndex - 1;
				i = text.indexOf(str, startIndex);
				if (i !== -1) {
					return {index: text.length - str.length - i, length: str.length};
				}
			} else {
				i = text.indexOf(str, startIndex);
				if (i !== -1) {
					return {index: i, length: str.length};
				}
			}
			return null;
		},
		
		/**
		 * Helper for finding regex matches in the editor contents. Use {@link #doFind} for simple string searches.
		 * @param {String} pattern A valid regexp pattern.
		 * @param {String} flags Valid regexp flags: [is]
		 * @param {Number} [startIndex] Default is false.
		 * @param {Boolean} [reverse] Default is false.
		 * @return {Object} An object giving the match details, or <code>null</code> if no match found. The returned object
		 * will have the properties:<br />
		 * {Number} index<br />
		 * {Number} length 
		 */
		doFindRegExp: function(pattern, flags, startIndex, reverse) {
			if (!pattern) {
				return null;
			}
			
			flags = flags || "";
			// 'g' makes exec() iterate all matches, 'm' makes ^$ work linewise
			flags += (flags.indexOf("g") === -1 ? "g" : "") + (flags.indexOf("m") === -1 ? "m" : "");
			var regexp = new RegExp(pattern, flags);
			var text = this._textView.getText();
			var result = null,
			    match = null;
			if (reverse) {
				while (true) {
					result = regexp.exec(text);
					if (result && result.index <= startIndex) {
						match = {index: result.index, length: result[0].length};
					} else {
						return match;
					}
				}
			} else {
				result = regexp.exec(text.substring(startIndex));
				return result && {index: result.index + startIndex, length: result[0].length};
			}
		},
		
		/**
		 * @private
		 * @static
		 * @param {String} Input string
		 * @returns {pattern:String, flags:String} if str looks like a RegExp, or null otherwise
		 */
		parseRegExp: function(str) {
			var regexp = /^\s*\/(.+)\/([gim]{0,3})\s*$/.exec(str);
			if (regexp) {
				return {pattern: regexp[1], flags: regexp[2]};
			}
			return null;
		},
		
		/**
		 * Creates the underlying TextView and installs the editor's features.
		 */
		installTextView : function() {
			// Create textView and install optional features
			this._textView = this._textViewFactory();
			if (this._undoStackFactory) {
				this._undoStack = this._undoStackFactory.createUndoStack(this);
			}
			if (this._contentAssistFactory) {
				this._contentAssist = this._contentAssistFactory(this);
				this._keyModes.push(this._contentAssist);
			}
			
			var editor = this,
				textView = this._textView;
						
			// Set up keybindings
			if (this._keyBindingFactory) {
				this._keyBindingFactory(this, this._keyModes, this._undoStack, this._contentAssist);
			}
			
			// Set keybindings for keys that apply to different modes
			textView.setKeyBinding(new orion.textview.KeyBinding(27), "Cancel Current Mode");
			textView.setAction("Cancel Current Mode", dojo.hitch(this, function() {
				for (var i=0; i<this._keyModes.length; i++) {
					if (this._keyModes[i].isActive()) {
						return this._keyModes[i].cancel();
					}
				}
				return false;
			}));

			textView.setAction("lineUp", dojo.hitch(this, function() {
				for (var i=0; i<this._keyModes.length; i++) {
					if (this._keyModes[i].isActive()) {
						return this._keyModes[i].lineUp();
					}
				}
				return false;
			}));
			textView.setAction("lineDown", dojo.hitch(this, function() {
				for (var i=0; i<this._keyModes.length; i++) {
					if (this._keyModes[i].isActive()) {
						return this._keyModes[i].lineDown();
					}
				}
				return false;
			}));

			textView.setAction("enter", dojo.hitch(this, function() {
				for (var i=0; i<this._keyModes.length; i++) {
					if (this._keyModes[i].isActive()) {
						return this._keyModes[i].enter();
					}
				}
				return false;
			}));
						
			/** @this {orion.editor.Editor} */
			function updateCursorStatus() {
				var model = textView.getModel();
				var caretOffset = textView.getCaretOffset();
				var lineIndex = model.getLineAtOffset(caretOffset);
				var lineStart = model.getLineStart(lineIndex);
				var offsetInLine = caretOffset - lineStart;
				// If we are in a mode, we will bail out from reporting the cursor position.
				for (var i=0; i<this._keyModes.length; i++) {
					if (this._keyModes[i].isActive()) {
						return;
					}
				}
				this.reportStatus("Line " + (lineIndex + 1) + " : Col " + offsetInLine);
			}
			
			// Listener for dirty state
			textView.addEventListener("ModelChanged", this, this.checkDirty);
					
			//Adding selection changed listener
			textView.addEventListener("Selection", this, updateCursorStatus);
			
			// Create rulers
			if (this._annotationFactory) {
				var annotations = this._annotationFactory.createAnnotationRulers();
				this._annotationsRuler = annotations.annotationRuler;
			
				this._annotationsRuler.onClick = function(lineIndex, e) {
					if (lineIndex === undefined) { return; }
					if (lineIndex === -1) { return; }
					var annotation = this.getAnnotation(lineIndex);
					if (annotation === undefined) { return; }
					editor.onGotoLine(annotation.line, annotation.column);
				};
				
				this._overviewRuler = annotations.overviewRuler;
				this._overviewRuler.onClick = function(lineIndex, e) {
					if (lineIndex === undefined) { return; }
					editor.moveSelection(textView, textView.getModel().getLineStart(lineIndex));
				};
			
				textView.addRuler(this._annotationsRuler);
				textView.addRuler(this._overviewRuler);
			}
			
			if (this._lineNumberRulerFactory) {
				this._lineNumberRuler = this._lineNumberRulerFactory.createLineNumberRuler();
				textView.addRuler(this._lineNumberRuler);
			}
		},
		
		/**
		 * Reveals and selects a portion of text.
		 * @param {Number} start
		 * @param {Number} end
		 * @param {Number} line
		 * @param {Number} offset
		 * @param {Number} length
		 */
		showSelection : function(start, end, line, offset, length) {
			// We use typeof because we need to distinguish the number 0 from an undefined or null parameter
			if (typeof(start) === "number") {
				if (typeof(end) !== "number") {
					end = start;
				}
				this.moveSelection(this._textView, start, end);
			} else if (typeof(line) === "number") {
				var pos = this._textView.getModel().getLineStart(line-1);
				if (typeof(offset) === "number") {
					pos = pos + offset;
				}
				if (typeof(length) !== "number") {
					length = 0;
				}
				this.moveSelection(this._textView, pos, pos+length);
			}
		},
		
		/**
		 * Called when the editor's contents have changed.
		 * @param {String} title
		 * @param {String} message
		 * @param {String} contents
		 * @param {Boolean} contentsSaved
		 */
		onInputChange : function (title, message, contents, contentsSaved) {
			if (contentsSaved && this._textView) {
				// don't reset undo stack on save, just mark it clean so that we don't lose the undo past the save
				this._undoStack.markClean();
				this.checkDirty();
				return;
			}
			if (this._textView) {
				if (message) {
					this._textView.setText(message);
				} else {
					if (contents !== null && contents !== undefined) {
						this._textView.setText(contents);
					}
				}
				this._undoStack.reset();
				this.checkDirty();
				this._textView.focus();
			}
		},
		
		/**
		 * Reveals a line in the editor, and optionally selects a portion of the line.
		 * @param {Number} line
		 * @param {Number|String} column
		 * @param {Number} [end]
		 */
		onGotoLine : function (line, column, end) {
			if (this._textView) {
				var lineStart = this._textView.getModel().getLineStart(line);
				if (typeof column === "string") {
					var index = this._textView.getModel().getLine(line).indexOf(column);
					if (index !== -1) {
						end = index + column.length;
						column = index;
					} else {
						column = 0;
					}
				}
				var col = Math.min(this._textView.getModel().getLineEnd(line), column);
				if (end===undefined) {
					end = col;
				}
				var offset = lineStart + col;
				this.moveSelection(this._textView, offset, lineStart + end);
			}
		},
		
		/**
		 * Called when the dirty state of the editor is changing.
		 * @param {Boolean} isDirty
		 */
		onDirtyChange: function(isDirty) {
			this._dirty = isDirty;
		}
	};
	return Editor;
}());

if (typeof window !== "undefined" && typeof window.define !== "undefined") {
	define(['dojo', 'orion/textview/keyBinding'], function(){
		return orion.editor;
	});
}
