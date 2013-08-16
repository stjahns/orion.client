/*******************************************************************************
 * @license
 * Copyright (c) 2010, 2012 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/

/*global define */

define("orion/editor/undoStack", [], function() { //$NON-NLS-0$

	/** 
	 * Constructs a new Change object.
	 * 
	 * @class 
	 * @name orion.editor.Change
	 * @private
	 */
	function Change(offset, text, previousText) {
		this.offset = offset;
		this.text = text;
		this.previousText = previousText;
	}
	Change.prototype = {
		/** @ignore */
		getRedoChanges: function() {
			return [{start: this.offset, end: this.offset + this.previousText.length, text: this.text}];
		},
		/** @ignore */
		getUndoChanges: function() {
			return [{start: this.offset, end: this.offset + this.text.length, text: this.previousText}];
		},
		/** @ignore */
		undo: function (view, select) {
			this._doUndoRedo(this.offset, this.previousText, this.text, view, select);
			return true;
		},
		/** @ignore */
		redo: function (view, select) {
			this._doUndoRedo(this.offset, this.text, this.previousText, view, select);
			return true;
		},
		_doUndoRedo: function(offset, text, previousText, view, select) {
			var model = view.getModel();
			/* 
			* TODO UndoStack should be changing the text in the base model.
			* This is code needs to change when modifications in the base
			* model are supported properly by the projection model.
			*/
			if (model.mapOffset && view.annotationModel) {
				var mapOffset = model.mapOffset(offset, true);
				if (mapOffset < 0) {
					var annotationModel = view.annotationModel;
					var iter = annotationModel.getAnnotations(offset, offset + 1);
					while (iter.hasNext()) {
						var annotation = iter.next();
						if (annotation.type === "orion.annotation.folding") { //$NON-NLS-0$
							annotation.expand();
							mapOffset = model.mapOffset(offset, true);
							break;
						}
					}
				}
				if (mapOffset < 0) { return; }
				offset = mapOffset;
			}
			model.setText(text, offset, offset + previousText.length);
			if (select) {
				view.setSelection(offset, offset + text.length);
			}
		}
	};

	/** 
	 * Constructs a new CompoundChange object.
	 * 
	 * @param owner the owner of the compound change
	 *
	 * @class 
	 * @name orion.editor.CompoundChange
	 * @private
	 */
	function CompoundChange (owner) {
		this.owner = owner;
		this.changes = [];
	}
	CompoundChange.prototype = {
		/** @ignore */
		getRedoChanges: function() {
			var changes = [];
			for (var i=0; i<this.changes.length; i++) {
				changes = changes.concat(this.changes[i].getRedoChanges());
			}
			return changes;
		},
		/** @ignore */
		getUndoChanges: function() {
			var changes = [];
			for (var i=this.changes.length - 1; i >= 0; i--) {
				changes = changes.concat(this.changes[i].getUndoChanges());
			}
			return changes;
		},
		/** @ignore */
		add: function (change) {
			this.changes.push(change);
		},
		/** @ignore */
		end: function (view) {
			this.endSelection = view.getSelection();
			this.endCaret = view.getCaretOffset();
			var owner = this.owner;
			if (owner && owner.end) {
				owner.end();
			}
		},
		/** @ignore */
		undo: function (view, select) {
			if (this.changes.length > 1) {
				view.setRedraw(false);
			}
			for (var i=this.changes.length - 1; i >= 0; i--) {
				this.changes[i].undo(view, false);
			}
			if (this.changes.length > 1) {
				view.setRedraw(true);
			}
			if (select) {
				var start = this.startSelection.start;
				var end = this.startSelection.end;
				view.setSelection(this.startCaret ? start : end, this.startCaret ? end : start);
			}
			var owner = this.owner;
			if (owner && owner.undo) {
				owner.undo();
			}
			return this.changes.length > 0;
		},
		/** @ignore */
		redo: function (view, select) {
			if (this.changes.length > 1) {
				view.setRedraw(false);
			}
			for (var i = 0; i < this.changes.length; i++) {
				this.changes[i].redo(view, false);
			}
			if (this.changes.length > 1) {
				view.setRedraw(true);
			}
			if (select) {
				var start = this.endSelection.start;
				var end = this.endSelection.end;
				view.setSelection(this.endCaret ? start : end, this.endCaret ? end : start);
			}
			var owner = this.owner;
			if (owner && owner.redo) {
				owner.redo();
			}
			return this.changes.length > 0;
		},
		/** @ignore */
		start: function (view) {
			this.startSelection = view.getSelection();
			this.startCaret = view.getCaretOffset();
			var owner = this.owner;
			if (owner && owner.start) {
				owner.start();
			}
		}
	};

	/**
	 * Constructs a new UndoStack on a text view.
	 *
	 * @param {orion.editor.TextView} view the text view for the undo stack.
	 * @param {Number} [size=100] the size for the undo stack.
	 *
	 * @name orion.editor.UndoStack
	 * @class The UndoStack is used to record the history of a text model associated to an view. Every
	 * change to the model is added to stack, allowing the application to undo and redo these changes.
	 *
	 * <p>
	 * <b>See:</b><br/>
	 * {@link orion.editor.TextView}<br/>
	 * </p>
	 */
	function UndoStack (view, size) {
		this.view = view;
		this.size = size !== undefined ? size : 100;
		this.reset();
		var model = view.getModel();
		if (model.getBaseModel) {
			model = model.getBaseModel();
		}
		this.model = model;
		var self = this;
		this._listener = {
			onChanging: function(e) {
				self._onChanging(e);
			},
			onDestroy: function(e) {
				self._onDestroy(e);
			}
		};
		model.addEventListener("Changing", this._listener.onChanging); //$NON-NLS-0$
		view.addEventListener("Destroy", this._listener.onDestroy); //$NON-NLS-0$
	}
	UndoStack.prototype = /** @lends orion.editor.UndoStack.prototype */ {
		/**
		 * Adds a change to the stack.
		 * 
		 * @param change the change to add.
		 */
		add: function (change) {
			if (this.compoundChange) {
				this.compoundChange.add(change);
			} else {
				var length = this.stack.length;
				var removed = this.stack.splice(this.index, length-this.index, change);
				if (removed.length > 0 && this.cleanIndex > this.index) {
					this._unsavedChanges = this._unsavedChanges.concat(removed);
					this.cleanIndex = this.index;
				}
				this.index++;
				if (this.stack.length > this.size) {
					this.stack.shift();
					this.index--;
					this.cleanIndex--;
				}
			}
		},
		/** 
		 * Marks the current state of the stack as clean.
		 *
		 * <p>
		 * This function is typically called when the content of view associated with the stack is saved.
		 * </p>
		 *
		 * @see orion.editor.UndoStack#isClean
		 */
		markClean: function() {
			this.endCompoundChange();
			this._commitUndo();
			this.cleanIndex = this.index;
			this._unsavedChanges = [];
		},
		/**
		 * Returns true if current state of stack is the same
		 * as the state when markClean() was called.
		 *
		 * <p>
		 * For example, the application calls markClean(), then calls undo() four times and redo() four times.
		 * At this point isClean() returns true.  
		 * </p>
		 * <p>
		 * This function is typically called to determine if the content of the view associated with the stack
		 * has changed since the last time it was saved.
		 * </p>
		 *
		 * @return {Boolean} returns if the state is the same as the state when markClean() was called.
		 *
		 * @see orion.editor.UndoStack#markClean
		 */
		isClean: function() {
			return this.cleanIndex === this.getSize().undo && this._unsavedChanges.length === 0;
		},
		/**
		 * Returns true if there is at least one change to undo.
		 *
		 * @return {Boolean} returns true if there is at least one change to undo.
		 *
		 * @see orion.editor.UndoStack#canRedo
		 * @see orion.editor.UndoStack#undo
		 */
		canUndo: function() {
			return this.getSize().undo > 0;
		},
		/**
		 * Returns true if there is at least one change to redo.
		 *
		 * @return {Boolean} returns true if there is at least one change to redo.
		 *
		 * @see orion.editor.UndoStack#canUndo
		 * @see orion.editor.UndoStack#redo
		 */
		canRedo: function() {
			return this.getSize().redo > 0;
		},
		/**
		 * Finishes a compound change.
		 *
		 * @see orion.editor.UndoStack#startCompoundChange
		 */
		endCompoundChange: function() {
			if (this.compoundChange) {
				this.compoundChange.end(this.view);
			}
			this.compoundChange = undefined;
		},
		/**
		 * Returns the sizes of the stack.
		 *
		 * @return {object} a object where object.undo is the number of changes that can be un-done, 
		 *  and object.redo is the number of changes that can be re-done.
		 *
		 * @see orion.editor.UndoStack#canUndo
		 * @see orion.editor.UndoStack#canRedo
		 */
		getSize: function() {
			var index = this.index;
			var length = this.stack.length;
			if (this._undoStart !== undefined) {
				index++;
			}
			return {undo: index, redo: (length - index)};
		},
		/**
		 * @class This object represents a text change.
		 * <p>
		 * <b>See:</b><br/>
		 * {@link orion.editor.UndoStack}<br/>
		 * {@link orion.editor.UndoStack#getUndoChanges}<br/>
		 * {@link orion.editor.UndoStack#getRedoChanges}<br/>
		 * </p>
		 * @name orion.editor.TextChange
		 * 
		 * @property {Number} start The start offset in the model of the range to be replaced.
		 * @property {Number} end The end offset in the model of the range to be replaced
		 * @property {String} text the text to be inserted
		 */
		/**
		 * Returns the redo changes.
		 *
		 * @return {orion.editor.TextChange[]} an array of TextChanges that are returned in the order
		 * that they occurred (most recent change last).
		 *
		 * @see orion.editor.UndoStack#getUndoChanges
		 */
		getRedoChanges: function() {
			this._commitUndo();
			var changes = [];
			for (var i=this.index; i<this.stack.length; i++) {
				changes = changes.concat(this.stack[i].getRedoChanges());
			}
			return changes;
		},
		/**
		 * Returns the undo changes.
		 *
		 * @return {orion.editor.TextChange[]} an array of TextChanges that are returned in the reverse order
		 * that they occurred (most recent change first).
		 *
		 * @see orion.editor.UndoStack#getRedoChanges
		 */
		getUndoChanges: function() {
			this._commitUndo();
			var changes = [];
			for (var i=this.index; i >= 0; i--) {
				changes = changes.concat(this.stack[i].getUndoChanges());
			}
			return changes;
		},
		/**
		 * Returns the changes up to the last clean point.
		 *
		 * @return {orion.editor.TextChange[]} an array of TextChanges that are returned in the reverse order
		 * that they occurred (most recent change first).
		 *
		 * @see orion.editor.UndoStack#markClean
		 */
		getUncleanChanges: function() {
			this._commitUndo();
			var changes = [], i;
			for (i=this._unsavedChanges.length - 1; i >= 0; i--) {
				changes = changes.concat(this._unsavedChanges[i].getUndoChanges());
			}
			if (this.index > this.cleanIndex) {
				i = this.cleanIndex;
				while (i < this.index) {
					changes = changes.concat(this.stack[i].getRedoChanges());
					i++;
				}
			} else {
				i = this.cleanIndex - 1;
				while (i >= this.index) {
					changes = changes.concat(this.stack[i].getUndoChanges());
					i--;
				}
			}
			return changes;
		},
		/**
		 * Undo the last change in the stack.
		 *
		 * @return {Boolean} returns true if a change was un-done.
		 *
		 * @see orion.editor.UndoStack#redo
		 * @see orion.editor.UndoStack#canUndo
		 */
		undo: function() {
			this._commitUndo();
			var change, result = false;
			this._ignoreUndo = true;
			do {
				if (this.index <= 0) {
					break;
				}
				change = this.stack[--this.index];
			} while (!(result = change.undo(this.view, true)));
			this._ignoreUndo = false;
			return result;
		},
		/**
		 * Redo the last change in the stack.
		 *
		 * @return {Boolean} returns true if a change was re-done.
		 *
		 * @see orion.editor.UndoStack#undo
		 * @see orion.editor.UndoStack#canRedo
		 */
		redo: function() {
			this._commitUndo();
			var change, result = false;
			this._ignoreUndo = true;
			do {
				if (this.index >= this.stack.length) {
					break;
				}
				change = this.stack[this.index++];
			} while (!(result = change.redo(this.view, true)));
			this._ignoreUndo = false;
			return true;
		},
		/**
		 * Reset the stack to its original state. All changes in the stack are thrown away.
		 */
		reset: function() {
			this.index = this.cleanIndex = 0;
			this.stack = [];
			this._unsavedChanges = [];
			this._undoStart = undefined;
			this._undoText = "";
			this._undoType = 0;
			this._ignoreUndo = false;
			this._compoundChange = undefined;
		},
		/**
		 * Starts a compound change. 
		 * <p>
		 * All changes added to stack from the time startCompoundChange() is called
		 * to the time that endCompoundChange() is called are compound on one change that can be un-done or re-done
		 * with one single call to undo() or redo().
		 * </p>
		 *
		 * @param owner the owner of the compound change which is called for start, end, undo and redo.
		 *		 
		 * @return the compound change
		 *
		 * @see orion.editor.UndoStack#endCompoundChange
		 */
		startCompoundChange: function(owner) {
			this._commitUndo();
			var change = new CompoundChange(owner);
			this.add(change);
			this.compoundChange = change;
			this.compoundChange.start(this.view);
			return this.compoundChange;
		},
		_commitUndo: function () {
			if (this._undoStart !== undefined) {
				if (this._undoType === -1) {
					this.add(new Change(this._undoStart, "", this._undoText));
				} else {
					this.add(new Change(this._undoStart, this._undoText, ""));
				}
				this._undoStart = undefined;
				this._undoText = "";
				this._undoType = 0;
			}
			this.endCompoundChange();
		},
		_onDestroy: function(evt) {
			this.model.removeEventListener("Changing", this._listener.onChanging); //$NON-NLS-0$
			this.view.removeEventListener("Destroy", this._listener.onDestroy); //$NON-NLS-0$
		},
		_onChanging: function(e) {
			var newText = e.text;
			var start = e.start;
			var removedCharCount = e.removedCharCount;
			var addedCharCount = e.addedCharCount;
			if (this._ignoreUndo) {
				return;
			}
			if (this._undoStart !== undefined && 
				!((addedCharCount === 1 && removedCharCount === 0 && this._undoType === 1 && start === this._undoStart + this._undoText.length) ||
					(addedCharCount === 0 && removedCharCount === 1 && this._undoType === -1 && (((start + 1) === this._undoStart) || (start === this._undoStart)))))
			{
				this._commitUndo();
			}
			if (!this.compoundChange) {
				if (addedCharCount === 1 && removedCharCount === 0) {
					if (this._undoStart === undefined) {
						this._undoStart = start;
					}
					this._undoText = this._undoText + newText;
					this._undoType = 1;
					return;
				} else if (addedCharCount === 0 && removedCharCount === 1) {
					var deleting = this._undoText.length > 0 && this._undoStart === start;
					this._undoStart = start;
					this._undoType = -1;
					if (deleting) {
						this._undoText = this._undoText + this.model.getText(start, start + removedCharCount);
					} else {
						this._undoText = this.model.getText(start, start + removedCharCount) + this._undoText;
					}
					return;
				}
			}
			this.add(new Change(start, newText, this.model.getText(start, start + removedCharCount)));
		}
	};
	
	return {
		UndoStack: UndoStack
	};
});
