/*******************************************************************************
 * @license
 * Copyright (c) 2011 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/
/*global window widgets eclipse:true orion:true serviceRegistry dojo dijit define */
/*jslint maxerr:150 browser:true devel:true regexp:false*/


/**
 * @namespace The global container for orion APIs.
 */ 
define(['dojo', 'orion/commands', 'orion/globalCommands', 'orion/textview/keyBinding', 'orion/textview/undoStack'], function(dojo, mCommands, mGlobalCommands, mKeyBinding, mUndoStack) {

var exports = {};

exports.EditorCommandFactory = (function() {
	function EditorCommandFactory (serviceRegistry, commandService, fileClient, inputManager, toolbarId, isReadOnly, navToolbarId) {
		this.serviceRegistry = serviceRegistry;
		this.commandService = commandService;
		this.fileClient = fileClient;
		this.inputManager = inputManager;
		this.toolbarId = toolbarId;
		this.pageNavId = navToolbarId;
		this.isReadOnly = isReadOnly;
	}
	EditorCommandFactory .prototype = {
		/**
		 * Creates the common text editing commands.  Also generates commands for any installed plug-ins that
		 * contribute editor actions.  
		 */
		generateEditorCommands: function(editor) {
		
			// KB exists so that we can pass an array (from info.key) rather than actual arguments
			function createKeyBinding(args) {
				var keyBinding = new mKeyBinding.KeyBinding();
				mKeyBinding.KeyBinding.apply(keyBinding, args);
				return keyBinding;
			}
	
			// create commands common to all editors
			if (!this.isReadOnly) {
				editor.getTextView().setKeyBinding(new mKeyBinding.KeyBinding('s', true), "Save");
				editor.getTextView().setAction("Save", dojo.hitch(this, function () {
					var contents = editor.getText();
					var etag = this.inputManager.getFileMetadata().ETag;
					var args = { "ETag" : etag };
					this.fileClient.write(this.inputManager.getInput(), contents, args).then(
							dojo.hitch(this, function(result) {
								this.inputManager.getFileMetadata().ETag = result.ETag;
								editor.setInput(this.inputManager.getInput(), null, contents, true);
								if(this.inputManager.afterSave){
									this.inputManager.afterSave();
								}
							}),
							dojo.hitch(this, function(error) {
								// expected error - HTTP 412 Precondition Failed 
								// occurs when file is out of sync with the server
								if (error.status === 412) {
									var forceSave = confirm("Resource is out of sync with the server. Do you want to save it anyway?");
									if (forceSave) {
										// repeat save operation, but without ETag 
										this.fileClient.write(this.inputManager.getInput(), contents).then(
												dojo.hitch(this, function(result) {
													this.inputManager.getFileMetadata().ETag = result.ETag;
													editor.setInput(this.inputManager.getInput(), null, contents, true);
													if(this.inputManager.afterSave){
														this.inputManager.afterSave();
													}
												}));
									}
								}
								// unknown error
								else {
									error.log = true;
								}
							})
					);
					return true;
				}));
				var saveCommand = new mCommands.Command({
					name: "Save",
					tooltip: "Save this file",
					id: "orion.save",
					callback: function(data) {
						data.items.getTextView().invokeAction("Save");
					}});
				this.commandService.addCommand(saveCommand, "dom");
				this.commandService.addCommandGroup("orion.editorActions.unlabeled", 200, null, null, this.toolbarId);
				this.commandService.registerCommandContribution("orion.save", 1, this.toolbarId, "orion.editorActions.unlabeled", false, new mCommands.CommandKeyBinding('s', true));
	
				// page navigation commands (go to line)
				var lineParameter = new mCommands.ParametersDescription([new mCommands.CommandParameter('line', 'number', 'Line:')], false);
				
				var gotoLineCommand =  new mCommands.Command({
					name: "Go to Line",
					tooltip: "Go to specified line number",
					id: "orion.gotoLine",
					parameters: lineParameter,
					callback: function(data) {
						var line;
						var model = editor.getModel();
						if (data.parameters && data.parameters.valueFor('line')) {
							line = data.parameters.valueFor('line');
						} else {
							line = model.getLineAtOffset(editor.getCaretOffset());
							line = prompt("Go to line:", line + 1);
							if (line) {
								line = parseInt(line, 10);
							}
						}
						if (line) {
							editor.onGotoLine(line - 1, 0);
						}
					}});
				this.commandService.addCommand(gotoLineCommand, "dom");
				this.commandService.registerCommandContribution("orion.gotoLine", 1, this.pageNavId, null, true, new mCommands.CommandKeyBinding('l', true), new mCommands.URLBinding("gotoLine", "line"));
				// override the editor binding 
				editor.getTextView().setKeyBinding(new mKeyBinding.KeyBinding('l', true), "gotoLine");
				editor.getTextView().setAction("gotoLine", dojo.hitch(this, function () {
					this.commandService.runCommand("orion.gotoLine");
					return true;
				}));

				// add the commands generated by plug-ins who implement the "orion.edit.command" extension.
				// we currently position these first so that the regular commands always appear in the same place (on the right) regardless of installed plug-ins
				// eventually we should define command groups that are more functional in nature and that would require the extension knowing where it wants to be
				this.commandService.addCommandGroup("orion.editorActions.contributed.noImages", 100, "More", null, this.toolbarId);
				this.commandService.addCommandGroup("orion.editorActions.contributed.images", 101, null, null, this.toolbarId);
		
				// Note that the shape of the "orion.edit.command" extension is not in any shape or form that could be considered final.
				// We've included it to enable experimentation. Please provide feedback in the following bug:
				// https://bugs.eclipse.org/bugs/show_bug.cgi?id=337766
		
				// The shape of the contributed actions is (for now):
				// info - information about the action (object).
				//        required attribute: name - the name of the action
				//        optional attribute: key - an array with values to pass to the orion.textview.KeyBinding constructor
				//        optional attribute: img - a URL to an image for the action
				// run - the implementation of the action (function).
				//        arguments passed to run: (selectedText, fullText, selection)
				//          selectedText (string) - the currently selected text in the editor
				//          fullText (string) - the complete text of the editor
				//          selection (object) - an object with attributes: start, end
				//        the return value of the run function will be used as follows:
				//          if the return value is a string, the current selection in the editor will be replaced with the returned string
				//          if the return value is an object, its "text" attribute (required) will be used to replace the contents of the editor,
				//                                            and its "selection" attribute (optional) will be used to set the new selection.
			
				// iterate through the extension points and generate commands for each one.
				var actionReferences = this.serviceRegistry.getServiceReferences("orion.edit.command");
						
				for (var i=0; i<actionReferences.length; i++) {
					var service = this.serviceRegistry.getService(actionReferences[i]);
					var info = {};
					var propertyNames = actionReferences[i].getPropertyNames();
					for (var j = 0; j < propertyNames.length; j++) {
						info[propertyNames[j]] = actionReferences[i].getProperty(propertyNames[j]);
					}
					var command = new mCommands.Command({
						name: info.name,
						image: info.img,
						id: info.name,
						callback: dojo.hitch(editor, function(data) {
							// command service will provide editor parameter but editor widget callback will not
							editor = data.items || this;
							var selection = editor.getSelection();
							var model = editor.getModel();
							var text = model.getText();
							service.run(model.getText(selection.start,selection.end),text,selection).then(function(result){
								if (result.text) {
									editor.setText(result.text);
									if (result.selection) {
										editor.setSelection(result.selection.start, result.selection.end);
										editor.getTextView().focus();
									}
								} else {
									if (typeof result === 'string') {
										editor.setText(result, selection.start, selection.end);
										editor.setSelection(selection.start, selection.end);
										editor.getTextView().focus();
									}
								}
							});
							return true;
						})});
					this.commandService.addCommand(command, "dom");
					if (info.img) {
						// image will be placed on toolbar
						this.commandService.registerCommandContribution(command.id, i, this.toolbarId, "orion.editorActions.contributed.images");
					} else {
						// if there is no image it will be grouped in a "More..." menu button
						this.commandService.registerCommandContribution(command.id, i, this.toolbarId, "orion.editorActions.contributed.noImages");
					}
					// We must regenerate the command toolbar everytime we process an extension because
					// this is asynchronous and we probably have already populated the toolbar.
					// In the editor, we generate page level commands to the banner.
					mGlobalCommands.generateDomCommandsInBanner(this.commandService, editor);
					if (info.key) {
						// add it to the editor as a keybinding
						var textView = editor.getTextView();
						textView.setKeyBinding(createKeyBinding(info.key), command.id);
						textView.setAction(command.id, command.callback);
					}				
				}
			}
		}
	};
	return EditorCommandFactory;
}());

exports.UndoCommandFactory = (function() {
	function UndoCommandFactory(serviceRegistry, commandService, toolbarId) {
		this.serviceRegistry = serviceRegistry;
		this.commandService = commandService;
		this.toolbarId = toolbarId;
	}
	UndoCommandFactory.prototype = {
		createUndoStack: function(editor) {
			var undoStack =  new mUndoStack.UndoStack(editor.getTextView(), 200);
			editor.getTextView().setKeyBinding(new mKeyBinding.KeyBinding('z', true), "Undo");
			editor.getTextView().setAction("Undo", function() {
				undoStack.undo();
				return true;
			});
			var undoCommand = new mCommands.Command({
				name: "Undo",
				id: "orion.undo",
				callback: function(data) {
					data.items.getTextView().invokeAction("Undo");
				}});
			this.commandService.addCommand(undoCommand, "dom");
			
			var isMac = navigator.platform.indexOf("Mac") !== -1;
			var binding = isMac ? new mKeyBinding.KeyBinding('z', true, true) : new mKeyBinding.KeyBinding('y', true);
			editor.getTextView().setKeyBinding(binding, "Redo");
			
			editor.getTextView().setAction("Redo", function() {
				undoStack.redo();
				return true;
			});
	
			var redoCommand = new mCommands.Command({
				name: "Redo",
				id: "orion.redo",
				callback: function(data) {
					data.items.getTextView().invokeAction("Redo");
				}});
			this.commandService.addCommand(redoCommand, "dom");
	
			this.commandService.registerCommandContribution("orion.undo", 400, this.toolbarId, "orion.editorActions.unlabeled", true, new mCommands.CommandKeyBinding('z', true));
			this.commandService.registerCommandContribution("orion.redo", 401, this.toolbarId, "orion.editorActions.unlabeled", true, binding);

			return undoStack;
		}
	};
	return UndoCommandFactory;
}());

return exports;	
});
