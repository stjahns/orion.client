/*global define window log */

define("orion/editor/vi", [ //$NON-NLS-0$
		"i18n!orion/editor/nls/messages", //$NON-NLS-0$
		"orion/editor/keyModes", //$NON-NLS-0$
		"orion/keyBinding",  //$NON-NLS-0$
		"orion/util" //$NON-NLS-0$
], function (messages, mKeyMode, mKeyBinding, util) {
	
	var yankText, yankEditLine;
	
	var previousEdit = {};
	
	function mixin(object, proto) {
		for (var p in proto) {
			if (proto.hasOwnProperty(p)) {
				object[p] = proto[p];
			}
		}
	}
	
	function createStroke(keyCode, mod1, mod2, mod3, mod4, type, scope) {
		var result = new mKeyBinding.KeyStroke(keyCode, mod1, mod2, mod3, mod4, type);
		result.scopeName = scope || messages.vi;
		return result;
	}
		
	function createSequence(keys, scope) {
		var result = new mKeyBinding.KeySequence(keys);
		result.scopeName = scope || messages.vi;
		return result;
	}
	
		
	function NumberMode(textView, key, msg){
		this.key = key;
		this.msg = msg;
		this.number = "";
		mKeyMode.KeyMode.call(this, textView);
		//Create actions
		if (textView) {	
			this._createActions(textView);
		}
	}
	NumberMode.prototype = new mKeyMode.KeyMode(); 
	mixin(NumberMode.prototype, /** @lends orion.editor.viMode.NumberMode.prototype */ {
		_msg: function(key){
			return {name: util.formatMessage(messages[key], this.msg)};
		},
		createKeyBindings: function() {
			var bindings = [];
			var key = this.key;
			
			if (key) {
				key = "-" + key + "-"; //$NON-NLS-1$ //$NON-NLS-0$
			} else {
				key = "-"; //$NON-NLS-0$
			}
			
			//Numbers
			for (var i=0; i<=9; i++) {
				bindings.push({actionID: "vi" + key  + i,	keyBinding: createStroke(i+"", false, false, false, false, "keypress"), predefined: true}); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			}
						
			//Movement
			//left
			bindings.push({actionID: "vi" + key + "Left",	keyBinding: createStroke("h", false, false, false, false, "keypress")}); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			bindings.push({actionID: "vi" + key + "Left",	keyBinding: createStroke("h", true, false, false, false)}); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			bindings.push({actionID: "vi" + key + "Left",	keyBinding: createStroke(8)}); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			bindings.push({actionID: "vi" + key + "Left",	keyBinding: createStroke(37)});  //$NON-NLS-1$ //$NON-NLS-0$
			
			//down
			bindings.push({actionID: "vi" + key + "Down",	keyBinding: createStroke("j", false, false, false, false, "keypress")}); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			bindings.push({actionID: "vi" + key + "Down",	keyBinding: createStroke(40)}); //$NON-NLS-1$ //$NON-NLS-0$
			
			//up
			bindings.push({actionID: "vi" + key + "Up",	keyBinding: createStroke("k", false, false, false, false, "keypress")}); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			bindings.push({actionID: "vi" + key + "Up",	keyBinding: createStroke(38)});  //$NON-NLS-1$ //$NON-NLS-0$
			
			//right
			bindings.push({actionID: "vi" + key + "Right",	keyBinding: createStroke("l", false, false, false, false, "keypress")}); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			bindings.push({actionID: "vi" + key + "Right",	keyBinding: createStroke(39)}); //$NON-NLS-1$ //$NON-NLS-0$
			bindings.push({actionID: "vi" + key + "Right",	keyBinding: createStroke(32)}); //$NON-NLS-1$ //$NON-NLS-0$
			
			//text movement
			bindings.push({actionID: "vi" + key + "w",	keyBinding: createStroke("w", false, false, false, false, "keypress")}); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			bindings.push({actionID: "vi" + key + "b",	keyBinding: createStroke("b", false, false, false, false, "keypress")}); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			//TODO: add
			bindings.push({actionID: "vi" + key + "W",	keyBinding: createStroke("W", false, false, false, false, "keypress")}); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			//TODO: add
			bindings.push({actionID: "vi" + key + "B",	keyBinding: createStroke("B", false, false, false, false, "keypress")}); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			//TODO: 
			bindings.push({actionID: "vi" + key + "e",	keyBinding: createStroke("e", false, false, false, false, "keypress")}); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			bindings.push({actionID: "vi" + key + "E",	keyBinding: createStroke("E", false, false, false, false, "keypress")}); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			//bindings.push({actionID: "vi" + key + ")",	keyBinding: createStroke(")", false, false, false, false, "keypress")}); //$NON-NLS-0$
			//bindings.push({actionID: "vi" + key + "(",	keyBinding: createStroke("(", false, false, false, false, "keypress")}); //$NON-NLS-0$
			//bindings.push({actionID: "vi" + key + "}",	keyBinding: createStroke("}", false, false, false, false, "keypress")}); //$NON-NLS-0$
			//bindings.push({actionID: "vi" + key + "{",	keyBinding: createStroke("{", false, false, false, false, "keypress")}); //$NON-NLS-0$
			//bindings.push({actionID: "vi" + key + "]]",	keyBinding: createStroke("]]", false, false, false, false, "keypress")}); //$NON-NLS-0$
			//bindings.push({actionID: "vi" + key + "[[",	keyBinding: createStroke("[[", false, false, false, false, "keypress")}); //$NON-NLS-0$
		
			//Lines
			bindings.push({actionID: "vi" + key + "$",	keyBinding: createStroke("$", false, false, false, false, "keypress")}); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			
			bindings.push({actionID: "vi" + key + "^_",	keyBinding: createStroke("^", false, false, false, false, "keypress")}); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			bindings.push({actionID: "vi" + key + "^_",	keyBinding: createStroke("_", false, false, false, false, "keypress")}); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			
			bindings.push({actionID: "vi" + key + "+",	keyBinding: createStroke("+", false, false, false, false, "keypress")}); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			bindings.push({actionID: "vi" + key + "+",	keyBinding:  createStroke(13)}); //$NON-NLS-1$ //$NON-NLS-0$
			bindings.push({actionID: "vi" + key + "-",	keyBinding:  createStroke("-", false, false, false, false, "keypress")}); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			bindings.push({actionID: "vi" + key + "|",	keyBinding:  createStroke("|", false, false, false, false, "keypress")}); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			
			bindings.push({actionID: "vi" + key + "H",	keyBinding: createStroke("H", false, false, false, false, "keypress")}); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			bindings.push({actionID: "vi" + key + "M",	keyBinding: createStroke("M", false, false, false, false, "keypress")}); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			bindings.push({actionID: "vi" + key + "L",	keyBinding: createStroke("L", false, false, false, false, "keypress")}); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			
			//Screens
			
			//Searches
			bindings.push({actionID: "vi" + key + "/",	keyBinding: createStroke("/", false, false, false, false, "keypress")}); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			bindings.push({actionID: "vi" + key + "?",	keyBinding: createStroke("?", false, false, false, false, "keypress")}); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			bindings.push({actionID: "vi" + key + "n",	keyBinding: createStroke("n", false, false, false, false, "keypress")}); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			bindings.push({actionID: "vi" + key + "N",	keyBinding: createStroke("N", false, false, false, false, "keypress")}); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			bindings.push({actionID: "vi" + key + "f",	keyBinding: createStroke("f", false, false, false, false, "keypress")}); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			bindings.push({actionID: "vi" + key + "F",	keyBinding: createStroke("F", false, false, false, false, "keypress")}); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			bindings.push({actionID: "vi" + key + "t",	keyBinding: createStroke("t", false, false, false, false, "keypress")}); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			bindings.push({actionID: "vi" + key + "T",	keyBinding: createStroke("T", false, false, false, false, "keypress")}); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			bindings.push({actionID: "vi" + key + ",",	keyBinding: createStroke(",", false, false, false, false, "keypress")}); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			bindings.push({actionID: "vi" + key + ";",	keyBinding: createStroke(";", false, false, false, false, "keypress")}); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			
			//Line numbering
			bindings.push({actionID: "vi" + key + "G",	keyBinding: createStroke("G", false, false, false, false, "keypress")}); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			
			return bindings;
		},
		_createActions: function(view) {
		
			var key = this.key;
			if (key) {
				key = "-" + key + "-"; //$NON-NLS-1$ //$NON-NLS-0$
			} else {
				key = "-"; //$NON-NLS-0$
			}
			var self = this;
			view.setAction("vi" + key +"0", function() {return self._storeNumber(0);}); //$NON-NLS-1$ //$NON-NLS-0$
			view.setAction("vi" + key +"1", function() {return self._storeNumber(1);}); //$NON-NLS-1$ //$NON-NLS-0$
			view.setAction("vi" + key +"2", function() {return self._storeNumber(2);}); //$NON-NLS-1$ //$NON-NLS-0$
			view.setAction("vi" + key +"3", function() {return self._storeNumber(3);}); //$NON-NLS-1$ //$NON-NLS-0$
			view.setAction("vi" + key +"4", function() {return self._storeNumber(4);}); //$NON-NLS-1$ //$NON-NLS-0$
			view.setAction("vi" + key +"5", function() {return self._storeNumber(5);}); //$NON-NLS-1$ //$NON-NLS-0$
			view.setAction("vi" + key +"6", function() {return self._storeNumber(6);}); //$NON-NLS-1$ //$NON-NLS-0$
			view.setAction("vi" + key +"7", function() {return self._storeNumber(7);}); //$NON-NLS-1$ //$NON-NLS-0$
			view.setAction("vi" + key +"8", function() {return self._storeNumber(8);}); //$NON-NLS-1$ //$NON-NLS-0$
			view.setAction("vi" + key +"9", function() {return self._storeNumber(9);}); //$NON-NLS-1$ //$NON-NLS-0$
			
			//Utility
			function firstNonBlankChar(lineIndex) {
				var model = view.getModel();
				var lineText = model.getLine(lineIndex);
				var offsetInLine = 0;
				var c = lineText.charCodeAt(offsetInLine);
				while (c === 32 || c === 9) {
					offsetInLine++;
					c = lineText.charCodeAt(offsetInLine);
				}
				return offsetInLine;
			}

			function findCallback(range, data){
				if (range) {
					self.getView().setCaretOffset(range.start);
				}
				if (data.editDone) {
					data.editDone();
				}
			}
			//
			
			//Movement
			view.setAction("vi" + key + "Left", function() { //$NON-NLS-1$ //$NON-NLS-0$
				return self._invoke("charPrevious", {unit: "character"}); //$NON-NLS-1$ //$NON-NLS-0$
			}, this._msg("viLeft")); //$NON-NLS-0$
			
			view.setAction("vi" + key + "Right", function() { //$NON-NLS-1$ //$NON-NLS-0$
				return self._invoke("charNext", {unit: "character"}); //$NON-NLS-1$ //$NON-NLS-0$
			}, this._msg("viRight")); //$NON-NLS-0$
			
			view.setAction("vi" + key + "Up", function() {//$NON-NLS-1$ //$NON-NLS-0$
				return self._invoke("lineUp", {editLine:true}); //$NON-NLS-0$
			}, this._msg("viUp")); //$NON-NLS-0$
			
			view.setAction("vi" + key + "Down", function() { //$NON-NLS-1$ //$NON-NLS-0$
				return self._invoke("lineDown", {editLine:true}); //$NON-NLS-0$
			}, this._msg("viDown")); //$NON-NLS-0$
			
			//text movement
			view.setAction("vi" + key + "w", function() { //$NON-NLS-1$ //$NON-NLS-0$
				return self._invoke("wordNext", {unit: "word"}); //$NON-NLS-1$ //$NON-NLS-0$
			}, this._msg("viw")); //$NON-NLS-0$
			
			view.setAction("vi" + key + "b", function() { //$NON-NLS-1$ //$NON-NLS-0$
				return self._invoke("wordPrevious", {unit: "word"}); //$NON-NLS-1$ //$NON-NLS-0$
			}, this._msg("vib")); //$NON-NLS-0$
			
			view.setAction("vi" + key + "W", function() { //$NON-NLS-1$ //$NON-NLS-0$
				return self._invoke("wordNext", {unit: "wordWS"}); //$NON-NLS-1$ //$NON-NLS-0$
			}, this._msg("viW")); //$NON-NLS-0$
			
			view.setAction("vi" + key + "B", function() {//$NON-NLS-1$ //$NON-NLS-0$
				return self._invoke("wordPrevious", {unit: "wordWS"}); //$NON-NLS-1$ //$NON-NLS-0$
			}, this._msg("viB")); //$NON-NLS-0$
			
			view.setAction("vi" + key + "e", function() { //$NON-NLS-1$ //$NON-NLS-0$
				self._invoke("charNext", {unit: "character"}); //$NON-NLS-1$ //$NON-NLS-0$
				self._invoke("wordNext", {unit: "wordend"}); //$NON-NLS-1$ //$NON-NLS-0$
				self._invoke("charPrevious", {unit: "character"}); //$NON-NLS-1$ //$NON-NLS-0$
				return true;
			}, this._msg("vie")); //$NON-NLS-0$
			
			view.setAction("vi" + key + "E", function() { //$NON-NLS-1$ //$NON-NLS-0$
				return self._invoke("wordNext", {unit: "wordendWS"}); //$NON-NLS-1$ //$NON-NLS-0$
			}, this._msg("viE")); //$NON-NLS-0$
			
			//Lines
			view.setAction("vi" + key + "$", function() { //$NON-NLS-1$ //$NON-NLS-0$
				return self._invoke("lineEnd"); //$NON-NLS-0$
			}, this._msg("vi$")); //$NON-NLS-0$
			
			view.setAction("vi" + key + "^_", function() {//$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
				return self._invoke(function () {
					var model = view.getModel();
					var offset = view.getCaretOffset();
					var lineIndex = model.getLineAtOffset(offset);
					view.setCaretOffset(model.getLineStart(lineIndex) + firstNonBlankChar(lineIndex));
				});
			}, this._msg("vi^_")); //$NON-NLS-0$
			
			view.setAction("vi" + key + "+", function() { ///$NON-NLS-1$ //$NON-NLS-0$
				return self._invoke(function (data) {
					var model = view.getModel();
					var offset = view.getCaretOffset();
					var lastLineCount = model.getLineCount() - 1;
					var lineIndex = Math.min (model.getLineAtOffset(offset) + data.count, lastLineCount);
					view.setCaretOffset(model.getLineStart(lineIndex) + firstNonBlankChar(lineIndex));
				}, {editLine:true});
			}, this._msg("vi+")); //$NON-NLS-0$
			
			view.setAction("vi" + key + "-", function() { //$NON-NLS-1$ //$NON-NLS-0$
				return self._invoke(function (data) {
					var model = view.getModel();
					var offset = view.getCaretOffset();
					var lineIndex = Math.max(model.getLineAtOffset(offset) - data.count, 0);
					view.setCaretOffset(model.getLineStart(lineIndex) + firstNonBlankChar(lineIndex));
				}, {editLine:true});
			}, this._msg("vi-")); //$NON-NLS-0$
			
			view.setAction("vi" + key + "|", function() { //$NON-NLS-1$ //$NON-NLS-0$
				return self._invoke(function (data) {
					var model = view.getModel();
					var offset = view.getCaretOffset();
					var lineIndex = model.getLineAtOffset(offset);
					view.setCaretOffset(Math.min(model.getLineStart(lineIndex) + data.count - 1, model.getLineEnd(lineIndex)));
				});
			}, this._msg("vi|")); //$NON-NLS-0$
			
			view.setAction("vi" + key + "H", function() { //$NON-NLS-1$ //$NON-NLS-0$
				return self._invoke(function (data) {
					var topIndex = view.getModel().getLineStart(view.getTopIndex(true) + (data.count - 1));
					view.setCaretOffset(topIndex);
				}, {editLine:true});
			}, this._msg("viH")); //$NON-NLS-0$
			
			view.setAction("vi" + key + "M", function() { //$NON-NLS-1$ //$NON-NLS-0$
				return self._invoke(function (data) {
					var middleIndex = Math.ceil((view.getBottomIndex(true) - view.getTopIndex(true))/2) + view.getTopIndex(true);
					view.setCaretOffset(view.getModel().getLineStart(middleIndex));
				}, {editLine:true});
			}, this._msg("viM")); //$NON-NLS-0$
			
			view.setAction("vi" + key + "L", function() { //$NON-NLS-1$ //$NON-NLS-0$
				return self._invoke(function (data) {
					view.setCaretOffset(view.getModel().getLineStart(view.getBottomIndex(true) - (data.count - 1)));
				}, {editLine:true});
			}, this._msg("viL")); //$NON-NLS-0$
			
			//Searches
			view.setAction("vi" + key + "/", function() { //$NON-NLS-1$ //$NON-NLS-0$
				var data = {hideAfterFind:true, incremental:false, reverse:false, findCallback: function(range) {
					self._searchFwd = true;
					findCallback(range, data);
				}};
				return self._invoke("find", data); //$NON-NLS-0$
			}, this._msg("vi/")); //$NON-NLS-0$
			
			view.setAction("vi" + key + "?", function() { //$NON-NLS-1$ //$NON-NLS-0$
				var data = {hideAfterFind:true, incremental:false, reverse:true, findCallback: function(range) {
					self._searchFwd = false;
					findCallback(range, data);
				}};
				return self._invoke("find", data); //$NON-NLS-0$
			}, this._msg("vi?")); //$NON-NLS-0$
			
			view.setAction("vi" + key + "n", function() { //$NON-NLS-1$ //$NON-NLS-0$
				var findAction, start = view.getCaretOffset();
				if (self._searchFwd) {
					findAction = "findNext"; //$NON-NLS-0$
					start++;
				} else {
					findAction = "findPrevious"; //$NON-NLS-0$
				}
				var data = {start: start, findCallback: function(range) { 
					findCallback(range, data);
				}};
				return self._invoke(findAction, data); 
			}, this._msg("vin")); //$NON-NLS-0$
			
			view.setAction("vi" + key + "N", function() { //$NON-NLS-1$ //$NON-NLS-0$
				var findAction, start = view.getCaretOffset();
				if (!self._searchFwd) {
					findAction = "findNext"; //$NON-NLS-0$
					start++;
				} else {
					findAction = "findPrevious"; //$NON-NLS-0$
				}
				var data = {start: start, findCallback: function(range) {
					findCallback(range, data);
				}};
				return self._invoke(findAction, data);
			}, this._msg("viN")); //$NON-NLS-0$
			
			view.setAction("vi" + key + "f", function() {//$NON-NLS-1$ //$NON-NLS-0$
				var model = view.getModel();
				var start = view.getCaretOffset();
				return self._findChar(start, model.getLineEnd(model.getLineAtOffset(start)), false, 0);
			}, this._msg("vif")); //$NON-NLS-0$
			
			view.setAction("vi" + key + "F", function() { //$NON-NLS-1$ //$NON-NLS-0$
				var model = view.getModel();
				var end = view.getCaretOffset();
				return self._findChar( model.getLineStart(model.getLineAtOffset(end)), end, true, 0);
			}, this._msg("viF")); //$NON-NLS-0$
			
			view.setAction("vi" + key + "t", function() {//$NON-NLS-1$ //$NON-NLS-0$
				var model = view.getModel();
				var start = view.getCaretOffset();
				return self._findChar(start, model.getLineEnd(model.getLineAtOffset(start)), false, -1);
			}, this._msg("vit")); //$NON-NLS-0$
			
			view.setAction("vi" + key + "T", function() { //$NON-NLS-1$ //$NON-NLS-0$
				var model = view.getModel();
				var end = view.getCaretOffset();
				return self._findChar( model.getLineStart(model.getLineAtOffset(end)), end, true, 1);
			}, this._msg("viT")); //$NON-NLS-0$
			
			view.setAction("vi" + key + ",", function() { //$NON-NLS-1$ //$NON-NLS-0$
				return self._findNextChar(self._charTempOptions.reverse);
			}, this._msg("vi,")); //$NON-NLS-0$
			
			view.setAction("vi" + key + ";", function() { //$NON-NLS-1$ //$NON-NLS-0$
				return self._findNextChar(!self._charTempOptions.reverse);
			}, this._msg("vi;")); //$NON-NLS-0$
			
			//Line numbering
			view.setAction("vi" + key + "G", function() { //$NON-NLS-1$ //$NON-NLS-0$
				if (self.number === "") { //$NON-NLS-0$
					var model = view.getModel();
					if (model.getBaseModel) {
						model = model.getBaseModel();
					}
					self.number = model.getLineCount();
				}
				return self._invoke(function (data) {
					data = data || {};
					data.line=data.count;
					data.editLine=true;
					data.callback = function() {
						if (data.editDone) {
							data.editDone();
						}
					};
					view.invokeAction("gotoLine", false, data); //$NON-NLS-0$
				});
				//TODO: this works if gotoLine is registered (not part of textview) - need to handle fail case
			}, this._msg("viG")); //$NON-NLS-0$
		},
		_invokeEdit: function(action, data) {
			// (for invoking actions that can be repeated with '.')
			var view = this.getView();
			data =  data || {};
			data.count = this._getCount();
				
			if (typeof action === "function") { //$NON-NLS-0$
				action(data);
				previousEdit.execute = action;
			} else {
				view.invokeAction(action, false, data);
				previousEdit.execute = function() {
					view.invokeAction(action, false, data);
				};
			}
			return true;
		},
		_invoke: function(action, data) {
			var view = this.getView();
			data =  data || {};
			
			if (!data.count) {
				data.count = this._getCount();
			}
			
			if (typeof action === "function") { //$NON-NLS-0$
				action(data);
			} else {
				view.invokeAction(action, false, data);
			}
			return true;
		},
		_getCount: function() {
			var num = 1;
			if (this.number !== "") { //$NON-NLS-0$
				num = this.number >> 0;
			}
			this.number = ""; //$NON-NLS-0$
			return num;
		},
		_findChar: function (start, end, reverse, offset) {
			this._charTempOptions = {};
			this._charTempOptions.start  = start;
			this._charTempOptions.end= end;
			this._charTempOptions.hideAfterFind = true;
			this._charTempOptions.incremental = false;
			this._charTempOptions.reverse = reverse;
			this._charTempOptions.offset = offset;
			var data = this._charTempOptions;
			var self = this;
			this._charTempOptions.findCallback = function(range) {
				if (range) {
					self.getView().setCaretOffset(range.start + offset);
				}
				if (data.editDone) {
					data.editDone();
				}
			};
			return this._invoke("find", this._charTempOptions); //$NON-NLS-0$
		},
		_findNextChar: function (forward, options) {
			if (this._charTempOptions) {
				var view = this.getView();
				var tempTempOptions = options || {};
				tempTempOptions.hideAfterFind = this._charTempOptions.hideAfterFind;
				tempTempOptions.incremental = this._charTempOptions.incremental;
				tempTempOptions.reverse = this._charTempOptions.reverse;
				tempTempOptions.wrap = false;
				var data = tempTempOptions;
				var self = this;
				tempTempOptions.findCallback = function(range){
					if (range) {
						self.getView().setCaretOffset(range.start + self._charTempOptions.offset);
					}
					if (data.editDone) {
						data.editDone();
					}
				};
				var model = view.getModel();
				if (forward) {
					tempTempOptions.start  = view.getCaretOffset() + 1 - this._charTempOptions.offset;
					tempTempOptions.end= model.getLineEnd(model.getLineAtOffset(tempTempOptions.start));
					tempTempOptions.reverse = false;
					return this._invoke("findNext", tempTempOptions); //$NON-NLS-0$
				} else {
					tempTempOptions.start = view.getCaretOffset() - this._charTempOptions.offset;
					tempTempOptions.end  = model.getLineStart(model.getLineAtOffset(tempTempOptions.start));
					tempTempOptions.reverse = true;
					return this._invoke("findPrevious", tempTempOptions); //$NON-NLS-0$
				}
			}
			return true;
		},
		_storeNumber: function(index) {
			var self = this;
			if (index === 0 && !this.number) {
				return this._invoke(function() {
					self.getView().invokeAction("lineStart", true); //$NON-NLS-0$)
				});
			}
			this.number += index;
			return true;
		}
	});
	
	//Status Line Mode
	function StatusLineMode(viMode) {
		var view = viMode.getView();
		this.viMode = viMode;
		mKeyMode.KeyMode.call(this, view);
		this._createActions(view);
	}
	StatusLineMode.prototype = new mKeyMode.KeyMode(); 
	mixin(StatusLineMode.prototype, /** @lends orion.editor.viMode.StatusLineMode.prototype */ {
		createKeyBindings: function() {
			var bindings = [];
			bindings.push({actionID: "vi-:-ESC",		keyBinding: createStroke(27), predefined: true}); //$NON-NLS-0$
			return bindings;
		},
		_createActions: function(view) {
			var self = this;
			view.setAction("vi-:-ESC", function() { //$NON-NLS-0$
				view.removeKeyMode(self);
				view.addKeyMode(self.viMode);
				return true;
			});
		},
		match: function(e) {
			var result = mKeyMode.KeyMode.prototype.match.call(this, e);
			if (!result) {
				result = this.getView().getKeyModes()[0].match(e);
			}
			return result;
		},
		storeNumber: function(n) {
			this.number = n;
		}
	});
	
	
	//Edit Mode
	function EditMode(viMode, nextMode, key, msg) {
		this.viMode = viMode;
		this.nextMode = nextMode;
		NumberMode.call(this, viMode.getView(), key, msg);
	}
	
	EditMode.prototype = new NumberMode(); 
	mixin(EditMode.prototype, /** @lends orion.editor.viMode.EditMode.prototype */ {
		createKeyBindings: function() {
			var bindings = NumberMode.prototype.createKeyBindings.call(this);
			bindings.push({actionID: "vi-"+this.key+"ESC",		keyBinding: createStroke(27), predefined: true});//$NON-NLS-1$ //$NON-NLS-0$
			bindings.push({actionID: "vi-"+this.key+"-"+this.key,	keyBinding: createStroke(this.key, false, false, false, false, "keypress")});//$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			return bindings;
		},
		_invoke: function(action, data) {
			data = data || {};
			var view = this.getView();
			var caretOffset = view.getCaretOffset();
			var startOffset = caretOffset;
			var model = view.getModel();
			var self = this;
			
			// If this is invoked via a repeat (hitting '.'), defer to NumberMode's 
			// implementation so it doesn't mess up 'previousEdit'
			if (data.suppressEditModeInvoke)
			{
					return NumberMode.prototype._invoke.call(this, action, data);
			}
			
			var getOffsets = function(startOffset) {
				var endOffset = view.getCaretOffset();
				if (startOffset > endOffset) {
					var tmp = startOffset;
					startOffset = endOffset;
					endOffset = tmp;
				}
				if (data.editLine) {
					startOffset = model.getLineStart(model.getLineAtOffset(startOffset));
					endOffset = model.getLineEnd(model.getLineAtOffset(endOffset), self.key === "c" ? false : true); //$NON-NLS-0$
				}
				return {start: startOffset, end: endOffset};
			};
			
			// For "c" and "d"
			var doDelete = function(view, args) {
				var startOffset = view.getCaretOffset();
				
				data.count = previousEdit.actionCount;
				
				data.editDone = function() {
					var offsets = getOffsets(startOffset);
					view.setText("", offsets.start, offsets.end); 
					if (args && args.firstTime && args.change && action === "find")	{ //$NON-NLS-0$
						// Wait till find is done before switching to the next mode
						view.removeKeyMode(self);	
						view.addKeyMode(self.nextMode);
					}
				};
						
				if ((args && args.firstTime ) || action !== "find") { //$NON-NLS-0$
					// If first execution, or action is not a find...
					NumberMode.prototype._invoke.call(self, action, data);
					var offsets = getOffsets(startOffset);
					
					if (action !== "find" && action !== "findNext" && action !== "findPrevious") { //$NON-NLS-0$ //$NON-NLS-1$ //$NON-NLS-2$
						// if not a find action, remove the text 
						// (otherwise the deletion will be done in the editDone callback for find actions)
						view.setText("", offsets.start, offsets.end); 
					}
				
				} else {
					// Need to repeat the last find action!
					if (data.start && data.end) {
						// last find was a tT/fF
						self._findNextChar(!self._charTempOptions.reverse, {editDone: data.editDone, suppressEditModeInvoke: true});
					}
					else {
						// last find was a / or ?
						var findAction, start = view.getCaretOffset();
						if (self._searchFwd) {
							findAction = "findNext"; //$NON-NLS-0$
							start++;
						} else {
							findAction = "findPrevious"; //$NON-NLS-0$
						}
						var findData = {start: start, suppressEditModeInvoke: true, findCallback: function(range) { 
							if (range) {
								view.setCaretOffset(range.start);
							}
							if (data.editDone) {
								data.editDone();
							}
						}};
						self._invoke(findAction, findData); 						
					}
				}

				if (args && args.firstTime && args.change && action !== "find")	{ //$NON-NLS-0$
					// On first execute,
					// for actions that dont involve "find", go to next mode right away
					view.removeKeyMode(self);	
					view.addKeyMode(self.nextMode);
				}
			};
			
			// Need to be able to redo 'd' and 'c' actions with '.'
			if (self.key === "d") { //$NON-NLS-0$
				previousEdit.execute = doDelete;
				previousEdit.actionCount = this._getCount();
				doDelete(view, {firstTime: true});
			} else if (self.key === "c") { //$NON-NLS-0$
				previousEdit.preInsertAction = doDelete;
				previousEdit.actionCount = this._getCount();
				previousEdit.change = true;
				doDelete(view, {firstTime: true, change: true});
			} else if (self.key === "y") { //$NON-NLS-0$
				data.editDone = function() {
					// yank
					var offsets = getOffsets(startOffset);
					yankText = view.getText(offsets.start, offsets.end); 
					yankEditLine = data.editLine;
					view.setCaretOffset(caretOffset);
				};
				NumberMode.prototype._invoke.call(this, action, data);
				data.editDone();
			}
			
			if (self.key !== "c") { //$NON-NLS-0$
				view.removeKeyMode(self);	
				view.addKeyMode(self.nextMode);
			}
			
			return true;
		},
		_getCount: function() {
			var num = 1;
			if (this.firstNumber !== "") {
				num = this.firstNumber >> 0;
			}
			var secondNum = 1;
			if (this.number !== "" ) {
				secondNum = this.number >> 0;
			}
			num *= secondNum;
			this.number = this.firstNumber = "";
			return num;
		},
		_createActions: function(view) {
			NumberMode.prototype._createActions.call(this, view);
			var self = this;
			view.setAction("vi-"+self.key+"ESC", function() { //$NON-NLS-1$ //$NON-NLS-0$
				view.removeKeyMode(self);
				view.addKeyMode(self.viMode);
				return true;
			});
			view.setAction("vi-"+self.key+"-"+self.key, function () { //$NON-NLS-1$ //$NON-NLS-0$ 
				return self._invoke("lineEnd", {editLine:true}); //$NON-NLS-0$
			}, this._msg("viycd")); //$NON-NLS-0$
		},
		storeNumber: function(number) {
			this.firstNumber = number;
		},
		_modeAdded: function() {
			this.secondNumber = "";
		},
		_modeRemoved: function() {
			this.command = "";
			this.firstNumber = "";
			this.number = "";
		}
	});
	
	//Insert Mode
	function InsertMode(viMode) {
		var view = viMode.getView();
		mKeyMode.KeyMode.call(this, view);
		this.viMode = viMode;
		this._createActions(view);
	}
	InsertMode.prototype = new mKeyMode.KeyMode(); 

	mixin(InsertMode.prototype, /** @lends orion.editor.viMode.InsertMode.prototype */ {
		createKeyBindings: function() {
			var bindings = [];
			bindings.push({actionID: "vi-insert-ESC",		keyBinding: createStroke(27), predefined: true}); //$NON-NLS-0$
			return bindings;
		},
		_createActions: function(view) {
			var self = this;
			view.setAction("vi-insert-ESC", function() { //$NON-NLS-0$
				view.removeKeyMode(self);
				view.addKeyMode(self.viMode);
				return true;
			});
		},
		match: function(e) {
			var result = mKeyMode.KeyMode.prototype.match.call(this, e);
			if (!result) {
				result = this.getView().getKeyModes()[0].match(e);
			}
			return result;
		},
		storeNumber: function(n) {
			this._count = n;
			if (n < 1) {
				this._count = 1;
			}
		},
		_modeAdded: function() {
			var view = this.getView();
			var model = view.getModel();
			var self = this;
			
			// start a new edit action for inserting text at caret
			self._currentEdit = previousEdit;
			self._currentEdit.offset = 0;
			self._currentEdit.text = "";
			self._currentEdit.count = 1;
			self._currentEdit.execute = function(view) {
				
				// if there was a pre insert action, execute it
				var action = previousEdit.preInsertAction;
				if (action) {
					if (typeof action === "function") { //$NON-NLS-0$
						action(view);
					} else {
						view.invokeAction(action.action, false, action.data);
					}
				}
				
				// insert the final text COUNT times
				for (i = 0; i < previousEdit.count; ++i) {
					var caretOffset = view.getCaretOffset();
					view.setText(previousEdit.text, caretOffset + previousEdit.offset, caretOffset);
				}
			};

			self._listener = {
				onSelection: function(e) {
					self.onSelection(e);
				},
				onChanged: function(e) {
					self.onChanged(e);
				},
				onChanging: function(e) {
					self.onChanging(e);
				}
			};
			
			// Must listen to text additinos/removals and selection changes
			view.addEventListener("Selection", this._listener.onSelection); //$NON-NLS-0$
			model.addEventListener("preChanging", this._listener.onChanging); //$NON-NLS-0$
			view.addEventListener("postModify", this._listener.onChanged); //$NON-NLS-0$
		},
		_modeRemoved: function() {
			var i, count = this._count;
			var view = this.getView();
			var model = view.getModel();
			if (this._listener)
			{
				view.removeEventListener("Selection", this._listener.onSelection); //$NON-NLS-0$
				model.removeEventListener("preChanging", this._listener.onChanging); //$NON-NLS-0$
				view.removeEventListener("postModify", this._listener.onChanged); //$NON-NLS-0$
			}
			if (this._currentEdit && !this._currentEdit.change) {
				// insert the final text COUNT - 1 more times
				for (i = 1; i < count; ++i) {
					var caretOffset = view.getCaretOffset();
					view.setText(this._currentEdit.text, caretOffset + this._currentEdit.offset, caretOffset);
				}
				// On repeat with '.', need to repeat COUNT times
				this._currentEdit.count = count;
				this._currentEdit = undefined;
			}
		},
		onSelection : function(e) {
			if (!this._changing) {
				// selection is changing without text being modified!
				// reset text, offset, and preInsertAction
				this._currentEdit.text = "";
				this._currentEdit.preInsertAction = undefined;
				this._currentEdit.offset = 0;
			}
		},
		onChanging: function(e) {
			this._changing = true;
			
			if (e.addedCharCount > 0) {
				// Add characters to end of text
				this._currentEdit.text = this._currentEdit.text + e.text;
			}
			if (e.removedCharCount > 0) {
				// Remove characters from end of text
				var length = this._currentEdit.text.length;
				length = length - e.removedCharCount;
				if (length < 0)
				{
					// If no characters left in text, add to offset
					// (This handles deleting text with backspace when in insert mode)
					this._currentEdit.offset += length;
				}
				this._currentEdit.text = this._currentEdit.text.substr(0, this._currentEdit.text.length - e.removedCharCount);
			}
		},
		onChanged: function(e) {
			this._changing = false;
		}
	});

	function VIMode(textView, statusReporter){
		NumberMode.call(this, textView, "", messages.vimove); 
		this.insertMode = new InsertMode(this);
		this.changeMode = new EditMode(this, this.insertMode, "c", messages.vichange);  //$NON-NLS-0$
		this.deleteMode = new EditMode(this, this, "d",  messages.videlete); //$NON-NLS-0$
		this.yankMode = new EditMode(this, this, "y",  messages.viyank); //$NON-NLS-0$
		this.statusReporter = statusReporter;
	}
	VIMode.prototype = new NumberMode(); 
	mixin(VIMode.prototype, /** @lends orion.editor.viMode.VIMode.prototype */ {
		createKeyBindings: function() {
			var bindings = NumberMode.prototype.createKeyBindings.call(this);
		
			bindings.push({actionID: "vi-ctrl-f",	keyBinding: createStroke("f", true)}); //$NON-NLS-1$ //$NON-NLS-0$
			bindings.push({actionID: "vi-ctrl-b",	keyBinding: createStroke("b", true)}); //$NON-NLS-1$ //$NON-NLS-0$
			
			bindings.push({actionID: "vi-ctrl-e",	keyBinding: createStroke("e", true)});  //$NON-NLS-1$ //$NON-NLS-0$
			bindings.push({actionID: "vi-ctrl-y",	keyBinding: createStroke("y", true)});  //$NON-NLS-1$ //$NON-NLS-0$

			//Status Line mode
			bindings.push({actionID: "statusLineMode",	keyBinding: createStroke(":", false, false, false, false, "keypress")});  //$NON-NLS-2$  //$NON-NLS-1$  //$NON-NLS-0$
			
			
			//Insert
			bindings.push({actionID: "vi-a",	keyBinding: createStroke("a", false, false, false, false, "keypress"), predefined: true});  //$NON-NLS-2$  //$NON-NLS-1$  //$NON-NLS-0$
			bindings.push({actionID: "vi-A",	keyBinding: createStroke("A", false, false, false, false, "keypress"), predefined: true});  //$NON-NLS-2$  //$NON-NLS-1$  //$NON-NLS-0$
		
			bindings.push({actionID: "vi-i",	keyBinding: createStroke("i", false, false, false, false, "keypress"), predefined: true});  //$NON-NLS-2$  //$NON-NLS-1$  //$NON-NLS-0$
			bindings.push({actionID: "vi-I",	keyBinding: createStroke("I", false, false, false, false, "keypress"), predefined: true});  //$NON-NLS-2$  //$NON-NLS-1$  //$NON-NLS-0$
	
			bindings.push({actionID: "vi-o",	keyBinding: createStroke("o", false, false, false, false, "keypress"), predefined: true});  //$NON-NLS-2$  //$NON-NLS-1$  //$NON-NLS-0$
			bindings.push({actionID: "vi-O",	keyBinding: createStroke("O", false, false, false, false, "keypress"), predefined: true});  //$NON-NLS-2$  //$NON-NLS-1$  //$NON-NLS-0$
	
			bindings.push({actionID: "vi-R",	keyBinding: createStroke("R", false, false, false, false, "keypress"), predefined: true});  //$NON-NLS-2$  //$NON-NLS-1$  //$NON-NLS-0$
			bindings.push({actionID: "vi-s",	keyBinding: createStroke("s", false, false, false, false, "keypress"), predefined: true});  //$NON-NLS-2$  //$NON-NLS-1$  //$NON-NLS-0$	
			bindings.push({actionID: "vi-S",	keyBinding: createStroke("S", false, false, false, false, "keypress"), predefined: true});  //$NON-NLS-2$  //$NON-NLS-1$  //$NON-NLS-0$
			
			//Paste
			bindings.push({actionID: "vi-p",	keyBinding: createStroke("p", false, false, false, false, "keypress"), predefined: true});  //$NON-NLS-2$  //$NON-NLS-1$  //$NON-NLS-0$
			bindings.push({actionID: "vi-P",	keyBinding: createStroke("P", false, false, false, false, "keypress"), predefined: true});  //$NON-NLS-2$  //$NON-NLS-1$  //$NON-NLS-0$
			
			// Undo
			bindings.push({actionID: "vi-u",	keyBinding: createStroke("u", false, false, false, false, "keypress"), predefined: true});  //$NON-NLS-2$  //$NON-NLS-1$  //$NON-NLS-0$
			
			//Change
			bindings.push({actionID: "vi-c",	keyBinding: createStroke("c", false, false, false, false, "keypress"), predefined: true});  //$NON-NLS-2$  //$NON-NLS-1$  //$NON-NLS-0$
			bindings.push({actionID: "vi-d",	keyBinding: createStroke("d", false, false, false, false, "keypress"), predefined: true});  //$NON-NLS-2$  //$NON-NLS-1$  //$NON-NLS-0$
			bindings.push({actionID: "vi-y",	keyBinding: createStroke("y", false, false, false, false, "keypress"), predefined: true});  //$NON-NLS-2$  //$NON-NLS-1$  //$NON-NLS-0$
			bindings.push({actionID: "vi-~",	keyBinding: createStroke("~", false, false, false, false, "keypress"), predefined: true});  //$NON-NLS-2$  //$NON-NLS-1$  //$NON-NLS-0$

			bindings.push({actionID: "vi-x",	keyBinding: createStroke("x", false, false, false, false, "keypress"), predefined: true});  //$NON-NLS-2$  //$NON-NLS-1$  //$NON-NLS-0$
			bindings.push({actionID: "vi-X",	keyBinding: createStroke("X", false, false, false, false, "keypress"), predefined: true});  //$NON-NLS-2$  //$NON-NLS-1$  //$NON-NLS-0$
			
			bindings.push({actionID: "vi-C",	keyBinding: createStroke("C", false, false, false, false, "keypress"), predefined: true});  //$NON-NLS-2$  //$NON-NLS-1$  //$NON-NLS-0$
			bindings.push({actionID: "vi-D",	keyBinding: createStroke("D", false, false, false, false, "keypress"), predefined: true});  //$NON-NLS-2$  //$NON-NLS-1$  //$NON-NLS-0$
			bindings.push({actionID: "vi-*",  keyBinding: createStroke("*", false, false, false, false, "keypress"), predefined: true});  //$NON-NLS-2$  //$NON-NLS-1$  //$NON-NLS-0$
			
			bindings.push({actionID: "vi-.",  keyBinding: createStroke(".", false, false, false, false, "keypress"), predefined: true});  //$NON-NLS-2$  //$NON-NLS-1$  //$NON-NLS-0$
			
			return bindings;
		},
		getKeyBindings: function (actionID) {
			var result = mKeyMode.KeyMode.prototype.getKeyBindings.call(this, actionID);
			result = result || [];
			var keyBindings = this.changeMode.getKeyBindings(actionID);
			var i;
			if (!this.changeMode.isActive()) {
				for (i=0; i<keyBindings.length; i++) {
					keyBindings[i] = createSequence([createStroke("c", false, false, false, false, "keypress"), keyBindings[i]]); //$NON-NLS-1$  //$NON-NLS-0$
					
				}
			}
			result = result.concat(keyBindings);
			keyBindings = this.deleteMode.getKeyBindings(actionID);
			if (!this.deleteMode.isActive()) {
				for (i=0; i<keyBindings.length; i++) {
					keyBindings[i] = createSequence([createStroke("d", false, false, false, false, "keypress"), keyBindings[i]]); //$NON-NLS-1$  //$NON-NLS-0$
					
				}
			}
			result = result.concat(keyBindings);
			keyBindings = this.yankMode.getKeyBindings(actionID);
			if (!this.yankMode.isActive()) {
				for (i=0; i<keyBindings.length; i++) {
					keyBindings[i] = createSequence([createStroke("y", false, false, false, false, "keypress"), keyBindings[i]]); //$NON-NLS-1$  //$NON-NLS-0$
					
				}
			}
			result = result.concat(keyBindings);
			return result;
		},
//		isStatusActive: function() {
//			return this.isActive();
//		},
		match: function(e) {
			var result = mKeyMode.KeyMode.prototype.match.call(this, e);
			if (!result && e.type === "keypress") { //$NON-NLS-0$
				result = "noop"; //$NON-NLS-0$
			}
			return result;
		},
		_createActions: function(view) {
			NumberMode.prototype._createActions.call(this, view);

			var self = this;
			
			view.setAction("vi-ctrl-f", function() { //$NON-NLS-0$
				return self._invoke("pageDown"); //$NON-NLS-0$
			}, {name: messages.pageDown});

			view.setAction("vi-ctrl-b", function() { //$NON-NLS-0$
				return self._invoke("pageUp"); //$NON-NLS-0$
			}, {name: messages.pageUp});

			view.setAction("vi-ctrl-e", function() { //$NON-NLS-0$
				return self._invoke("scrollLineDown"); //$NON-NLS-0$
			}, {name: messages.scrollLineDown});
			
			view.setAction("vi-ctrl-y", function() { //$NON-NLS-0$
				return self._invoke("scrollLineUp"); //$NON-NLS-0$
			}, {name: messages.scrollLineUp});
			
			//Insert
			view.setAction("vi-a", function() { //$NON-NLS-0$
				return self._toInsertMode(false, "charNext"); //$NON-NLS-0$
			}, {name: messages.via});
			
			view.setAction("vi-A", function() { //$NON-NLS-0$
				return self._toInsertMode(false, "lineEnd"); //$NON-NLS-0$
			}, {name: messages.viA});
			
			view.setAction("vi-i", function() { //$NON-NLS-0$
				return self._toInsertMode(false, "noop"); //$NON-NLS-0$
			}, {name: messages.vii});
			
			view.setAction("vi-I", function() { //$NON-NLS-0$
				return self._toInsertMode(false, "lineStart"); //$NON-NLS-0$
			}, {name: messages.viI});
			
			view.setAction("vi-O", function() { //$NON-NLS-0$
				self._toInsertMode(false, function() {
					self._invoke("lineUp"); //$NON-NLS-0$
					self._invoke("lineEnd"); //$NON-NLS-0$
					self._invoke("enter"); //$NON-NLS-0$
				});
				return true;
			}, {name: messages.viO});
			
			view.setAction("vi-o", function() { //$NON-NLS-0$
				self._toInsertMode(false, function() {
					self._invoke("lineEnd"); //$NON-NLS-0$
					self._invoke("enter"); //$NON-NLS-0$
				});
				return true;
			}, {name: messages.vio});
			
			view.setAction("vi-R", function() { //$NON-NLS-0$
				return self._toInsertMode(false, "toggleOverwriteMode"); //$NON-NLS-0$
			}, {name: messages.viR});
			
			view.setAction("vi-s", function() { //$NON-NLS-0$
				return self._toInsertMode(true, "deleteNext", {unit: "char"}); //$NON-NLS-1$ //$NON-NLS-0$
			}, {name: messages.vis});

			view.setAction("vi-S", function() { //$NON-NLS-0$
				return self._toInsertMode(true, "deleteLines", {unit: "line"}); //$NON-NLS-1$ //$NON-NLS-0$
			}, {name: messages.viS});
			
			//Paste
			view.setAction("vi-p", function() { //$NON-NLS-0$
				return self._invokeEdit(function() {
					var view = self.getView();
					var selection = view.getSelection();
					if (selection.start === selection.end) {
						var model = view.getModel();
						var caretOffset = view.getCaretOffset();
						if (yankEditLine) {
							selection.start = selection.end = model.getLineEnd(model.getLineAtOffset(caretOffset), true);
						} else {
							selection.start++;
							selection.end++;
						}
					}
					view.setText(yankText, selection.start, selection.end);
				}); 
			}, {name: messages.vip});

			view.setAction("vi-P", function() { //$NON-NLS-0$
				return self._invokeEdit(function() {
					var view = self.getView();
					var selection = view.getSelection();
					if (selection.start === selection.end) {
						var model = view.getModel();
						var caretOffset = view.getCaretOffset();
						if (yankEditLine) {
							selection.start = selection.end = model.getLineStart(model.getLineAtOffset(caretOffset));
						} 
					}
					view.setText(yankText, selection.start, selection.end);
				}); 
			}, {name: messages.viP});
			
			// Undo
			view.setAction("vi-u", function() { //$NON-NLS-0$
				return self._invoke("undo"); //$NON-NLS-0$
			}, {name: messages.Undo});
			
			//Change actions
			view.setAction("vi-c", function() { //$NON-NLS-0$
				view.removeKeyMode(self);
				view.addKeyMode(self.changeMode);
				self.changeMode.storeNumber(self.number);
				self.number = "";
				return true;
			});
			
			view.setAction("vi-d", function() { //$NON-NLS-0$
				view.removeKeyMode(self);
				view.addKeyMode(self.deleteMode);
				self.deleteMode.storeNumber(self.number);
				self.number = "";
				return true;
			});
			
			view.setAction("vi-y", function() { //$NON-NLS-0$
				view.removeKeyMode(self);
				view.addKeyMode(self.yankMode);
				self.yankMode.storeNumber(self.number);
				self.number = "";
				return true;
			});
			
			view.setAction("vi-~", function() { //$NON-NLS-0$
				return self._invokeEdit("reversecase"); //$NON-NLS-0$
			}, {name: messages.reversecase});
			
			view.setAction("vi-x", function() { //$NON-NLS-0$
				return self._invokeEdit("deleteNext"); //$NON-NLS-0$
			}, {name: messages.deleteNext});
			
			view.setAction("vi-X", function() { //$NON-NLS-0$
				return self._invokeEdit("deletePrevious"); //$NON-NLS-0$
			}, {name: messages.deletePrevious});
			
			view.setAction("vi-C", function() { //$NON-NLS-0$
				return self._toInsertMode(true, "deleteLineEnd"); //$NON-NLS-0$
			}, {name: messages.viC});
			
			view.setAction("vi-D", function() { //$NON-NLS-0$
				return self._invokeEdit("deleteLineEnd"); //$NON-NLS-0$
			}, {name: messages.deleteLineEnd});
			
			view.setAction("vi-*", function() { //$NON-NLS-0$
				// Get word under caret
				var view = self.getView();
				var caret = view.getCaretOffset();
				var wordStart = view.getNextOffset(caret + 1, {count: -1, unit: "word"}); //$NON-NLS-0$
				var wordEnd = view.getNextOffset(wordStart, {count: 1, unit: "wordend"}); //$NON-NLS-0$
				var text = view.getText(wordStart, wordEnd);
				// Search for the word
				self._searchFwd = true;
				var data = {
					hideAfterFind: true,
					incremental: false,
					reverse: false,
					findString: text
				};
				return self._invoke("find", data); //$NON-NLS-0$
			}, {name: messages.viStar});
				
			view.setAction("vi-.", function() { //$NON-NLS-0$
				// repeat last edit action
				if (previousEdit && typeof previousEdit.execute === "function") { //$NON-NLS-0$
					var count = self._getCount();
					for (var i = 0; i < count; ++i)
					{
						previousEdit.execute(view);
					}
				}
				return true;
			}, {name: messages.viDot});
			
//			Status Line Mode
//			view.setAction("statusLineMode", function() { //$NON-NLS-0$
//				self.insertMode.storeNumber(self.number);
//				view.removeKeyMode(self);
//				view.addKeyMode(self.insertMode);
//				self.number = "";
//				return true;
//			});
		},
		_reportStatus: function(msg) {
			if (this.statusReporter) {
				this.statusReporter(msg);
			}
		}, 
		// toInsertMode
		// Switches to insert mode after invoking the given action
		// 'change' argument affects what the given prefix number does, eg:
		// 	3cwx should replace the next 3 words with 'x', so pass 'change' as true
		// 	3Ax should append 'xxx' to the end of the current line, so pass 'change' as false
		_toInsertMode: function(change, action, data) {
			data =  data || {};
			var view = this.getView();
			this.insertMode.storeNumber(this.number);
			
			previousEdit.preInsertAction = {action: action, data: data};
			previousEdit.change = change;
			
			if (typeof action === "function") { //$NON-NLS-0$
				action();
				previousEdit.preInsertAction = action;
			} else {
				view.invokeAction(action, false, data);
				previousEdit.preInsertAction = {action: action, data: data};
			}
			
			view.removeKeyMode(this);
			view.addKeyMode(this.insertMode);
			this.number = "";
			return true;
		},
		_modeAdded: function() {
			this.getView().setOptions({blockCursorVisible: true});	
		},
		_modeRemoved: function() {
			var view = this.getView();
			view.setOptions({blockCursorVisible: false});
			view.removeKeyMode(this.insertMode);
			view.removeKeyMode(this.changeMode);
			view.removeKeyMode(this.deleteMode);
		}
	});
	
	return {
		VIMode: VIMode
	};
});
