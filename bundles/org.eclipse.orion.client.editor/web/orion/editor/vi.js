/*global define window log */

define("orion/editor/vi", [ 
		"orion/editor/keyModes", //$NON-NLS-0$
		"orion/keyBinding"  //$NON-NLS-0$
], function (mKeyMode, mKeyBinding) {

	//Status Line Mode
	function StatusLineMode(viMode){
		mKeyMode.KeyMode.call(this);
		this.viMode = viMode;
	}
	StatusLineMode.prototype = new mKeyMode.KeyMode(); 
		
	function mixin(object, proto) {
		for (var p in proto) {
			if (proto.hasOwnProperty(p)) {
				object[p] = proto[p];
			}
		}
	}
	
	mixin(StatusLineMode.prototype, /** @lends orion.editor.viMode.StatusLineMode.prototype */ {
		createKeyBindings: function() {
			var KeyBinding = mKeyBinding.KeyBinding;
			var bindings = [];
			bindings.push({actionID: "cancel",		keyBinding: new KeyBinding(27), predefined: true}); //$NON-NLS-0$
			return bindings;
		},
		_createActions: function() {
			var view = this.getView();
			if (view) {
				var self = this;
				view.setAction("cancel", function() { //$NON-NLS-0$
					view.removeKeyMode(self);
					view.addKeyMode(self.viMode);
					return true;
				});
			}
		},
		match: function(e) {
			var result = mKeyMode.KeyMode.prototype.match.call(this, e);
			if (!result) {
				result = this.getView().getKeyModes()[0].match(e);
			}
			return result;
		},
		setView: function(view) {
			mKeyMode.KeyMode.prototype.setView.call(this, view);
			this._createActions();
		},
		setNumber: function(n) {
			this.number = n;
		}
	});
	
	
	//Change Mode
	function ChangeMode(viMode){
		mKeyMode.KeyMode.call(this);
		this.viMode = viMode;
	}
	ChangeMode.prototype = new mKeyMode.KeyMode(); 

	mixin(ChangeMode.prototype, /** @lends orion.editor.viMode.ChangeMode.prototype */ {
		createKeyBindings: function() {
			var KeyBinding = mKeyBinding.KeyBinding;
			var bindings = [];
			bindings.push({actionID: "cancel",		keyBinding: new KeyBinding(27), predefined: true}); //$NON-NLS-0$
			return bindings;
		},
		_createActions: function() {
			var view = this.getView();
			if (view) {
				var self = this;
				view.setAction("cancel", function() { //$NON-NLS-0$
					view.removeKeyMode(self);
					view.addKeyMode(self.viMode);
					return true;
				});
			}
		},
		match: function(e) {
			var result = mKeyMode.KeyMode.prototype.match.call(this, e);
			if (!result) {
				result = this.getView().getKeyModes()[0].match(e);
			}
			return result;
		},
		setView: function(view) {
			mKeyMode.KeyMode.prototype.setView.call(this, view);
			this._createActions();
		},
		storeNumber: function(n ) {
		}
	});
	
	
	//Insert Mode
	function InsertMode(viMode){
		mKeyMode.KeyMode.call(this);
		this.viMode = viMode;
	}
	InsertMode.prototype = new mKeyMode.KeyMode(); 

	mixin(InsertMode.prototype, /** @lends orion.editor.viMode.InsertMode.prototype */ {
		createKeyBindings: function() {
			var KeyBinding = mKeyBinding.KeyBinding;
			var bindings = [];
			bindings.push({actionID: "cancel",		keyBinding: new KeyBinding(27), predefined: true}); //$NON-NLS-0$
			return bindings;
		},
		_createActions: function() {
			var view = this.getView();
			if (view) {
				var self = this;
				view.setAction("cancel", function() { //$NON-NLS-0$
					view.removeKeyMode(self);
					view.addKeyMode(self.viMode);
					return true;
				});
			}
		},
		match: function(e) {
			var result = mKeyMode.KeyMode.prototype.match.call(this, e);
			if (!result) {
				result = this.getView().getKeyModes()[0].match(e);
			}
			return result;
		},
		setView: function(view) {
			mKeyMode.KeyMode.prototype.setView.call(this, view);
			this._createActions();
		},
		storeNumber: function(n ) {
		}
	});
	
	function VIMode(statusReporter){
		mKeyMode.KeyMode.call(this);
		this.number = "";
		this.insertMode = new InsertMode(this);
		this.statusReporter = statusReporter;
	}
	VIMode.prototype = new mKeyMode.KeyMode(); 
	mixin(VIMode.prototype, /** @lends orion.editor.viMode.VIMode.prototype */ {
		createKeyBindings: function() {
			var KeyBinding = mKeyBinding.KeyBinding;
			var bindings = [];
			//Movement
			//left
			bindings.push({actionID: "vi-Left",	keyBinding: new KeyBinding("h", false, false, false, false, "keypress")}); //$NON-NLS-0$
			bindings.push({actionID: "vi-Left",	keyBinding: new KeyBinding("h", true, false, false, false)}); //$NON-NLS-0$
			bindings.push({actionID: "vi-Left",	keyBinding: new KeyBinding(8)}); //$NON-NLS-0$
			bindings.push({actionID: "vi-Left",	keyBinding: new KeyBinding(37)}); //$NON-NLS-0$
			
			//down
			bindings.push({actionID: "vi-Down",	keyBinding: new KeyBinding("j", false, false, false, false, "keypress")}); //$NON-NLS-0$
			bindings.push({actionID: "vi-Down",	keyBinding: new KeyBinding(40)}); //$NON-NLS-0$
			
			//up
			bindings.push({actionID: "vi-Up",	keyBinding: new KeyBinding("k", false, false, false, false, "keypress")}); //$NON-NLS-0$
			bindings.push({actionID: "vi-Up",	keyBinding: new KeyBinding(38)}); //$NON-NLS-0$
			
			//right
			bindings.push({actionID: "vi-Right",	keyBinding: new KeyBinding("l", false, false, false, false, "keypress")}); //$NON-NLS-0$
			bindings.push({actionID: "vi-Right",	keyBinding: new KeyBinding(39)}); //$NON-NLS-0$
			bindings.push({actionID: "vi-Right",	keyBinding: new KeyBinding(32)}); //$NON-NLS-0$
			
			//text movement
			bindings.push({actionID: "vi-w",	keyBinding: new KeyBinding("w", false, false, false, false, "keypress")}); //$NON-NLS-0$
			bindings.push({actionID: "vi-b",	keyBinding: new KeyBinding("b", false, false, false, false, "keypress")}); //$NON-NLS-0$
			//TODO: add
			bindings.push({actionID: "vi-W",	keyBinding: new KeyBinding("W", false, false, false, false, "keypress")}); //$NON-NLS-0$
			//TODO: add
			bindings.push({actionID: "vi-B",	keyBinding: new KeyBinding("B", false, false, false, false, "keypress")}); //$NON-NLS-0$
			//TODO: 
			bindings.push({actionID: "vi-e",	keyBinding: new KeyBinding("e", false, false, false, false, "keypress")}); //$NON-NLS-0$
			bindings.push({actionID: "vi-E",	keyBinding: new KeyBinding("E", false, false, false, false, "keypress")}); //$NON-NLS-0$
			//bindings.push({actionID: "vi-)",	keyBinding: new KeyBinding(")", false, false, false, false, "keypress")}); //$NON-NLS-0$
			//bindings.push({actionID: "vi-(",	keyBinding: new KeyBinding("(", false, false, false, false, "keypress")}); //$NON-NLS-0$
			//bindings.push({actionID: "vi-}",	keyBinding: new KeyBinding("}", false, false, false, false, "keypress")}); //$NON-NLS-0$
			//bindings.push({actionID: "vi-{",	keyBinding: new KeyBinding("{", false, false, false, false, "keypress")}); //$NON-NLS-0$
			//bindings.push({actionID: "vi-]]",	keyBinding: new KeyBinding("]]", false, false, false, false, "keypress")}); //$NON-NLS-0$
			//bindings.push({actionID: "vi-[[",	keyBinding: new KeyBinding("[[", false, false, false, false, "keypress")}); //$NON-NLS-0$
		
			//Line numbering
			bindings.push({actionID: "vi-goToLine",	keyBinding: new KeyBinding("G", false, false, false, false, "keypress")}); //$NON-NLS-0$
			
			//Status Line mode
			bindings.push({actionID: "statusLineMode",	keyBinding: new KeyBinding(":", false, false, false, false, "keypress")}); //$NON-NLS-0$
			
			//Numbers
			for (var i=0; i<9; i++) {
				bindings.push({actionID: "storeNumber" + i,	keyBinding: new KeyBinding(i+"", false, false, false, false, "keypress"), predefined: true}); //$NON-NLS-0$
			}
			
			//Insert
			bindings.push({actionID: "insertBeforeCursor",	keyBinding: new KeyBinding("i", false, false, false, false, "keypress"), predefined: true}); //$NON-NLS-0$
			bindings.push({actionID: "insertAfterCursor",	keyBinding: new KeyBinding("I", false, false, false, false, "keypress"), predefined: true}); //$NON-NLS-0$
	
			//Change
			return bindings;
		},
		_createActions: function() {
			var view = this.getView();
			if (view) {
				var self = this;
				//Movement
				view.setAction("vi-Left", function() { //$NON-NLS-0$
					var result = view.invokeAction("charPrevious", true, {count:self.number >> 0, unit: "character"}); //$NON-NLS-1$ //$NON-NLS-0$
					self.number = "";
					return result;
				});
				
				view.setAction("vi-Right", function() { //$NON-NLS-0$
					var result = view.invokeAction("charNext", true, {count:self.number >> 0, unit: "character"}); //$NON-NLS-1$ //$NON-NLS-0$
					self.number = "";
					return result;
				});
				
				view.setAction("vi-Up", function() { //$NON-NLS-0$
					var result = view.invokeAction("lineUp", true, {count:self.number >> 0}); //$NON-NLS-1$ //$NON-NLS-0$
					self.number = "";
					return result;
				});
				
				view.setAction("vi-Down", function() { //$NON-NLS-0$
					var result = view.invokeAction("lineDown", true, {count:self.number >> 0}); //$NON-NLS-1$ //$NON-NLS-0$
					self.number = "";
					return result;
				});
				
				//text movement
				view.setAction("vi-w", function() { //$NON-NLS-0$
					var result = view.invokeAction("wordNext", true, {count:self.number >> 0, unit: "word"}); //$NON-NLS-1$ //$NON-NLS-0$
					self.number = "";
					return result;
				});
				
				view.setAction("vi-b", function() { //$NON-NLS-0$
					var result = view.invokeAction("wordPrevious", true, {count:self.number >> 0, unit: "word"}); //$NON-NLS-1$ //$NON-NLS-0$
					self.number = "";
					return result;
				});
				
				view.setAction("vi-W", function() { //$NON-NLS-0$
					var result = view.invokeAction("wordNext", true, {count:self.number >> 0, unit: "wordWS"}); //$NON-NLS-1$ //$NON-NLS-0$
					self.number = "";
					return result;
				});
				
				view.setAction("vi-B", function() { //$NON-NLS-0$
					var result = view.invokeAction("wordPrevious", true, {count:self.number >> 0, unit: "wordWS"}); //$NON-NLS-1$ //$NON-NLS-0$
					self.number = "";
					return result;
				});
				
				view.setAction("vi-e", function() { //$NON-NLS-0$
					var result = view.invokeAction("wordNext", true, {count:self.number >> 0, unit: "wordend"}); //$NON-NLS-1$ //$NON-NLS-0$
					self.number = "";
					return result;
				});
				
				view.setAction("vi-E", function() { //$NON-NLS-0$
					var result = view.invokeAction("wordNext", true, {count:self.number >> 0, unit: "wordendWS"}); //$NON-NLS-1$ //$NON-NLS-0$
					self.number = "";
					return result;
				});
				
				//Line numbering
				view.setAction("vi-goToLine", function() { //$NON-NLS-0$
					if (self.statusReporter) {
						self.statusReporter("Go to Line!");
					}
					if (self.number === "") {
						var model = view.getModel();
						if (model.getBaseModel) {
							model = model.getBaseModel();
						}
						self.number = model.getLineCount();
					}
					var result = view.invokeAction("gotoLine", false, {line:self.number >> 0}); //$NON-NLS-1$ //$NON-NLS-0$
					//TODO: this works if gotoLine is registered (not part of textview) - need to handle fail case
					self.number = "";
					return result;
				});
				
				//Insert
				view.setAction("insertBeforeCursor", function() { //$NON-NLS-0$
					self.insertMode.storeNumber(self.number);
					view.addKeyMode(self.insertMode);
					view.removeKeyMode(self);
					return true;
				});
				
				view.setAction("insertAfterCursor", function() { //$NON-NLS-0$
					self.insertMode.storeNumber(self.number);
					view.addKeyMode(self.insertMode);
					view.removeKeyMode(self);
					return true;
				});
				
				//Status Line Mode
				view.setAction("statusLineMode", function() { //$NON-NLS-0$
					self.insertMode.storeNumber(self.number);
					view.addKeyMode(self.insertMode);
					view.removeKeyMode(self);
					return true;
				});
				
				view.setAction("storeNumber0", function() {return self._storeNumber(0);});
				view.setAction("storeNumber1", function() {return self._storeNumber(1);});
				view.setAction("storeNumber2", function() {return self._storeNumber(2);});
				view.setAction("storeNumber3", function() {return self._storeNumber(3);});
				view.setAction("storeNumber4", function() {return self._storeNumber(4);});
				view.setAction("storeNumber5", function() {return self._storeNumber(5);});
				view.setAction("storeNumber6", function() {return self._storeNumber(6);});
				view.setAction("storeNumber7", function() {return self._storeNumber(7);});
				view.setAction("storeNumber8", function() {return self._storeNumber(8);});
				view.setAction("storeNumber9", function() {return self._storeNumber(9);});
			}	
		},
		match: function(e) {
			var result = mKeyMode.KeyMode.prototype.match.call(this, e);
			if (!result && e.type === "keypress") {
				result = "noop";
			}
			return result;
		},
		setView: function(view) {
			mKeyMode.KeyMode.prototype.setView.call(this, view);
			this._createActions();
		},
		_storeNumber: function(index) {
			if (index === 0 && !this.number) {
				return false;
			}
			this.number += index;
			return true;
		}
//		isStatusActive: function() {
//			return this.isActive();
//		}
	});
	
	return {
		VIMode: VIMode, 
		InsertMode: InsertMode
	};
});