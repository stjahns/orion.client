/*******************************************************************************
 * @license
 * Copyright (c) 2013 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/
/*global define prompt window*/

define("orion/editor/find", [ //$NON-NLS-0$
	'i18n!orion/editor/nls/messages', //$NON-NLS-0$
	'orion/keyBinding', //$NON-NLS-0$
	'orion/editor/keyModes', //$NON-NLS-0$
	'orion/editor/annotations', //$NON-NLS-0$
	'orion/editor/regex', //$NON-NLS-0$
	'orion/objects', //$NON-NLS-0$
	'orion/util' //$NON-NLS-0$
], function(messages, mKeyBinding, mKeyModes, mAnnotations, mRegex, objects, util) {

	var exports = {};
	
	function IncrementalFind(editor) {
		mKeyModes.KeyMode.call(this);
		this.editor = editor;
		this._active = false;
		this._success = true;
		this._ignoreSelection = false;
		this._prefix = "";
		
		var textView = editor.getTextView();
		textView.setAction("incrementalFindCancel", function() { //$NON-NLS-0$
			this.setActive(false);
			return true;
		}.bind(this));
		textView.setAction("incrementalFindBackspace", function() { //$NON-NLS-0$
			return this._backspace();
		}.bind(this));
		
		var self = this;
		this._listener = {
			onVerify: function(e){
				var editor = self.editor;
				var model = editor.getModel();
				var start = editor.mapOffset(e.start), end = editor.mapOffset(e.end);
				var txt = model.getText(start, end);
				var prefix = self._prefix;
				// TODO: mRegex is pulled in just for this one call so we can get case-insensitive search
				// is it really necessary
				var match = prefix.match(new RegExp("^" + mRegex.escape(txt), "i")); //$NON-NLS-1$ //$NON-NLS-0$
				if (match && match.length > 0) {
					prefix = self._prefix += e.text;
					self._success = true;
					self._status();
					self.find(self._forward, true);
					e.text = null;
				}
			},
			onSelection: function() {
				if (!self._ignoreSelection) {
					self.setActive(false);
				}
			}
		};
	}
	IncrementalFind.prototype = new mKeyModes.KeyMode();
	objects.mixin(IncrementalFind.prototype, {
		createKeyBindings: function() {
			var KeyBinding = mKeyBinding.KeyBinding;
			var bindings = [];
			bindings.push({actionID: "incrementalFindBackspace", keyBinding: new KeyBinding(8)}); //$NON-NLS-0$
			bindings.push({actionID: "incrementalFindCancel", keyBinding: new KeyBinding(13)}); //$NON-NLS-0$
			bindings.push({actionID: "incrementalFindCancel", keyBinding: new KeyBinding(27)}); //$NON-NLS-0$
			bindings.push({actionID: "incrementalFindReverse", keyBinding: new KeyBinding(38)}); //$NON-NLS-0$
			bindings.push({actionID: "incrementalFind", keyBinding: new KeyBinding(40)}); //$NON-NLS-0$
			bindings.push({actionID: "incrementalFindReverse", keyBinding: new KeyBinding('k', true, true)}); //$NON-NLS-1$ //$NON-NLS-0$
			bindings.push({actionID: "incrementalFind", keyBinding: new KeyBinding('k', true)}); //$NON-NLS-1$ //$NON-NLS-0$
			return bindings;
		},
		find: function(forward, incremental) {
			this._forward = forward;
			if (!this.isActive()) {
				this.setActive(true);
				return false;
			}
			var prefix = this._prefix;
			if (prefix.length === 0) {
				return false;
			}
			var editor = this.editor;
			var model = editor.getModel();
			var start;
			if (forward) {
				if (this._success) {
					start = incremental ? this._start : editor.getCaretOffset() + 1;
				} else {
					start = 0;
				}
			} else {
				if (this._success) {
					start = incremental ? this._start : editor.getCaretOffset();
				} else {
					start = model.getCharCount() - 1;
				}
			}
			var result = editor.getModel().find({
				string: prefix,
				start: start,
				reverse: !forward,
				caseInsensitive: prefix.toLowerCase() === prefix}).next();
			if (result) {
				if (!incremental) {
					this._start = start;
				}
				this._success = true;
				this._ignoreSelection = true;
				editor.moveSelection(forward ? result.start : result.end, forward ? result.end : result.start);
				this._ignoreSelection = false;
			} else {
				this._success = false;
			}
			this._status();
			return true;
		},
		isActive: function() {
			return this._active;
		},
		isStatusActive: function() {
			return this.isActive();
		},
		setActive: function(active) {
			if (this._active === active) {
				return;
			}
			this._active = active;
			this._prefix = "";
			this._success = true;
			var editor = this.editor;
			var textView = editor.getTextView();
			this._start = this.editor.getCaretOffset();
			this.editor.setCaretOffset(this._start);
			if (this._active) {
				textView.addEventListener("Verify", this._listener.onVerify); //$NON-NLS-0$
				textView.addEventListener("Selection", this._listener.onSelection); //$NON-NLS-0$
				textView.addKeyMode(this);
			} else {
				textView.removeEventListener("Verify", this._listener.onVerify); //$NON-NLS-0$
				textView.removeEventListener("Selection", this._listener.onSelection); //$NON-NLS-0$
				textView.removeKeyMode(this);
			}
			this._status();
		},
		_backspace: function() {
			var prefix = this._prefix;
			prefix = this._prefix = prefix.substring(0, prefix.length-1);
			if (prefix.length === 0) {
				this._success = true;
				this._ignoreSelection = true;
				this.editor.setCaretOffset(this.editor.getSelection().start);
				this._ignoreSelection = false;
				this._status();
				return true;
			}
			return this.find(this._forward, true);
		},
		_status: function() {
			if (!this.isActive()) {
				this.editor.reportStatus("");
				return;
			}
			var msg;
			if (this._forward) {
				msg = this._success ? messages.incrementalFindStr : messages.incrementalFindStrNotFound;
			} else {
				msg = this._success ? messages.incrementalFindReverseStr : messages.incrementalFindReverseStrNotFound;
			}
			msg = util.formatMessage(msg, this._prefix);
			this.editor.reportStatus(msg, this._success ? "" : "error"); //$NON-NLS-0$
		}
	});
	exports.IncrementalFind = IncrementalFind;
	
	
	function Find(editor, undoStack, options) {
		if (!editor) { return; }	
		this._editor = editor;
		this._undoStack = undoStack;
		this._showAllOccurrence = true;
		this._visible = false;
		this._caseInsensitive = true;
		this._wrap = true;
		this._wholeWord = false;
		this._incremental = true;
		this._regex = false;
		this._findAfterReplace = true;
		this._reverse = false;
		this._start = null;
		this._end = null;
		this._timer = null;
		this._lastString = "";
		var that = this;
		this._listeners = {
			onEditorFocus: function(e) {
				that._removeCurrentAnnotation(e);
			}
		};
		this.setOptions(options);
	}
	Find.prototype = {
		find: function (forward, string, incremental) {
			string = string || this.getFindString();
			this.setOptions({
				reverse : !forward
			});
			var startOffset = incremental ? this._startOffset : this.getStartOffset();
			var result =  this._doFind(string, startOffset);
			if (result) {
				if (!incremental) {
					this._startOffset = result.start;
				}
			}
			return result;
		},
		getStartOffset: function() {
			if (this._reverse) {
				return this._editor.getSelection().start - 1;
			}
			return this._editor.getCaretOffset();
		},
		getFindString: function() {
			var selection = this._editor.getSelection();
			return this._editor.getText(selection.start, selection.end) || this._lastString;
		},
		getReplaceString: function() {
			return "";
		},
		hide: function() {
			this._visible = false;
			this._removeAllAnnotations();
			this._editor.getTextView().removeEventListener("Focus", this._listeners.onEditorFocus); //$NON-NLS-0$
			this._editor.getTextView().focus();
		},
		isVisible: function() {
			return this._visible;
		},
		replace: function() {
			var string = this.getFindString();
			if (string) {
				var editor = this._editor;
				var replaceString = this.getReplaceString();
				var selection = editor.getSelection();
				var start = selection.start;
				var result = editor.getModel().find({
					string: string,
					start: start,
					reverse: false,
					wrap: this._wrap,
					regex: this._regex,
					wholeWord: this._wholeWord,
					caseInsensitive: this._caseInsensitive
				}).next();
				if (result) {
					this.startUndo();
					this._doReplace(result.start, result.end, string, replaceString);
					this.endUndo();
				}
			}
			if (this._findAfterReplace && string){
				this._doFind(string, this.getStartOffset());
			}
		},
		replaceAll : function() {
			var string = this.getFindString();
			if (string) {
				this._replacingAll = true;
				var editor = this._editor;
				editor.reportStatus("");
				editor.reportStatus(messages.replaceAll, "progress"); //$NON-NLS-0$
				var replaceString = this.getReplaceString();
				var self = this;
				window.setTimeout(function() {
					var startPos = 0;
					var count = 0, lastResult;
					while (true) {
						var result = self._doFind(string, startPos);
						if (!result) {
							break;
						}
						lastResult = result;
						count++;
						if (count === 1) {
							self.startUndo();
						}
						var selection = editor.getSelection();
						self._doReplace(selection.start, selection.end, string, replaceString);
						startPos = self.getStartOffset();
					}
					if (count > 0) {
						self.endUndo();
					}
					editor.reportStatus("", "progress"); //$NON-NLS-0$
					if (startPos > 0) {
						editor.reportStatus(util.formatMessage(messages.replacedMatches, count));
					} else {
						editor.reportStatus(messages.nothingReplaced, "error"); //$NON-NLS-0$ 
					}
					self._replacingAll = false;
				}, 100);				
				
			}
		},
		/**
		 * @property {String} string the search string to be found.
		 * @property {Boolean} [regex=false] whether or not the search string is a regular expression.
		 * @property {Boolean} [wrap=false] whether or not to wrap search.
		 * @property {Boolean} [wholeWord=false] whether or not to search only whole words.
		 * @property {Boolean} [caseInsensitive=false] whether or not search is case insensitive.
		 * @property {Boolean} [reverse=false] whether or not to search backwards.
		 * @property {Number} [start=0] The start offset to start searching
		 * @property {Number} [end=charCount] The end offset of the search. Used to search in a given range.	
		 */
		setOptions : function(options) {
			if (options) {
				if (options.showAllOccurrence === true || options.showAllOccurrence === false) {
					this._showAllOccurrence = options.showAllOccurrence;
					if (this.isVisible()) {
						if (this._showAllOccurrence) {
							this.markAllOccurrences(true);
						} else {
							var annotationModel = this._editor.getAnnotationModel();
							if(annotationModel){
								annotationModel.removeAnnotations(mAnnotations.AnnotationType.ANNOTATION_MATCHING_SEARCH);
							}
						}
					}
				}
				if (options.caseInsensitive === true || options.caseInsensitive === false) {
					this._caseInsensitive = options.caseInsensitive;
				}
				if (options.wrap === true || options.wrap === false) {
					this._wrap = options.wrap;
				}
				if (options.wholeWord === true || options.wholeWord === false) {
					this._wholeWord = options.wholeWord;
				}
				if (options.incremental === true || options.incremental === false) {
					this._incremental = options.incremental;
				}
				if (options.regex === true || options.regex === false) {
					this._regex = options.regex;
				}
				if (options.findAfterReplace === true || options.findAfterReplace === false) {
					this._findAfterReplace = options.findAfterReplace;
				}
				
				if (options.reverse === true || options.reverse === false) {
					this._reverse = options.reverse;
				}
				if (options.start) {
					this._start = options.start;
				}
				if (options.end) {
					this._end = options.end;
				}
			}
		},
		show: function() {
			this._visible = true;
			this._startOffset = this._editor.getSelection().start;
			this._editor.getTextView().addEventListener("Focus", this._listeners.onEditorFocus); //$NON-NLS-0$
			if (this._incremental) {
				this.find(true, null, true);
			}
		},
		startUndo: function() {
			if (this._undoStack) {
				this._undoStack.startCompoundChange();
			}
		}, 
		endUndo: function() {
			if (this._undoStack) {
				this._undoStack.endCompoundChange();
			}
		},
		_doFind: function(string, startOffset) {
			var editor = this._editor;
			if (!string) {
				this._removeAllAnnotations();
				return null;
			}
			this._lastString = string;
			var result = editor.getModel().find({
				string: string,
				start: startOffset,
				reverse: this._reverse,
				wrap: this._wrap,
				regex: this._regex,
				wholeWord: this._wholeWord,
				caseInsensitive: this._caseInsensitive
			}).next();
			if (!this._replacingAll) {
				if (result) {
					this._editor.reportStatus("");
				} else {
					this._editor.reportStatus(messages.notFound, "error"); //$NON-NLS-0$
				}
				if (this.isVisible()) {
					var type = mAnnotations.AnnotationType.ANNOTATION_CURRENT_SEARCH;
					var annotationModel = editor.getAnnotationModel();
					if (annotationModel) {
						annotationModel.removeAnnotations(type);
						if (result) {
							annotationModel.addAnnotation(mAnnotations.AnnotationType.createAnnotation(type, result.start, result.end));
						}
					}
					if (this._showAllOccurrence) {
						if (this._timer) {
							window.clearTimeout(this._timer);
						}
						var that = this;
						this._timer = window.setTimeout(function(){
							that._markAllOccurrences(!!result, string);
							that._timer = null;
						}, 500);
					}
				}
			}
			if (result) {
				editor.moveSelection(result.start, result.end, null, false);
			}
			return result;
		},
		_doReplace: function(start, end, searchStr, newStr) {
			var editor = this._editor;
			if (this._regex) {
				var newStrWithSubstitutions = editor.getText().substring(start, end).replace(new RegExp(searchStr, this._caseInsensitive ? "i" : ""), newStr); //$NON-NLS-0$
				if (newStrWithSubstitutions) {
					editor.setText(newStrWithSubstitutions, start, end);
					editor.setSelection(start, start + newStrWithSubstitutions.length, true);
				}
			} else {
				editor.setText(newStr, start, end);
				editor.setSelection(start, start + newStr.length, true);
			}
		},
		_markAllOccurrences: function(match, string) {
			var annotationModel = this._editor.getAnnotationModel();
			if (!annotationModel) {
				return;
			}
			var type = mAnnotations.AnnotationType.ANNOTATION_MATCHING_SEARCH;
			var iter = annotationModel.getAnnotations(0, annotationModel.getTextModel().getCharCount());
			var remove = [], add;
			while (iter.hasNext()) {
				var annotation = iter.next();
				if (annotation.type === type) {
					remove.push(annotation);
				}
			}
			if (this.isVisible()) {
				if (match && string) {
					iter = this._editor.getModel().find({
						string: string,
						regex: this._regex,
						wholeWord: this._wholeWord,
						caseInsensitive: this._caseInsensitive
					});
					add = [];
					while (iter.hasNext()) {
						var range = iter.next();
						add.push(mAnnotations.AnnotationType.createAnnotation(type, range.start, range.end));
					}
				}
			}
			annotationModel.replaceAnnotations(remove, add);
		},
		_removeAllAnnotations: function() {
			var annotationModel = this._editor.getAnnotationModel();
			if (annotationModel) {
				annotationModel.removeAnnotations(mAnnotations.AnnotationType.ANNOTATION_CURRENT_SEARCH);
				annotationModel.removeAnnotations(mAnnotations.AnnotationType.ANNOTATION_MATCHING_SEARCH);
			}
		},
		_removeCurrentAnnotation: function(evt){
			var annotationModel = this._editor.getAnnotationModel();
			if (annotationModel) {
				annotationModel.removeAnnotations(mAnnotations.AnnotationType.ANNOTATION_CURRENT_SEARCH);
			}
		}
	};
	
	exports.Find = Find;
	
	return exports;
});
