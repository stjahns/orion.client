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

/*global define window */
/*jslint browser:true*/
define([
	'i18n!orion/edit/nls/messages',
	'orion/i18nUtil',
	'orion/Deferred',
	'orion/EventTarget',
	'orion/objects',
	'orion/globalCommands',
	'orion/edit/dispatcher',
	'orion/highlight',
	'orion/edit/syntaxmodel',
	'orion/PageUtil'
], function(messages, i18nUtil, Deferred, EventTarget, objects, mGlobalCommands, mDispatcher, Highlight, SyntaxModelWirer, PageUtil) {

	function Idle(options){
		this._document = options.document || document;
		this._timeout = options.timeout;
		//TODO: remove listeners if there are no clients
		//TODO: add support for multiple clients with different timeouts
		var events = ["keypress","keydown","keyup","mousemove","mousedown","mousemove"]; //$NON-NLS-0$ //$NON-NLS-1$ //$NON-NLS-2$ //$NON-NLS-3$ //$NON-NLS-4$ //$NON-NLS-5$
		var reset = function (e) { this._resetTimer(); }.bind(this);
		for (var i=0; i<events.length; i++) {
			var event = events[i];
			this._document.addEventListener(event, reset, true);	
		}
		EventTarget.attach(this);
	}
	
	Idle.prototype = {
		_resetTimer: function() {
			var window = this._document.defaultView || this._document.parentWindow;
			if (this._timer) {
				window.clearTimeout(this._timer);
				this._timer = null;
			}
			if (this._timeout !== -1) {
				this._timer = window.setTimeout(function() {
					this.onIdle({type:"Idle"});	//$NON-NLS-0$ 
					this._timer = null;
					this._resetTimer();
				}.bind(this), this._timeout);
			}
		},
		onIdle: function (idleEvent) {
			return this.dispatchEvent(idleEvent);
		},
		setTimeout: function(timeout) {
			this._timeout = timeout;
			this._resetTimer();
		}
	};
	
	/**
	 * @name orion.editor.InputManager
	 * @class
	 */
	function InputManager(options) {
		this.editor = options.editor;
		this.serviceRegistry = options.serviceRegistry;
		this.fileClient = options.fileClient;
		this.progressService = options.progressService;
		this.contentTypeService = options.contentTypeService;
		this.selection = options.selection;
		this.syntaxHighlighter = new Highlight.SyntaxHighlighter(this.serviceRegistry);
		this.syntaxModelWirer = new SyntaxModelWirer(this.serviceRegistry);
		this.lastFilePath = "";
		this.dispatcher = null;
		EventTarget.attach(this);
	}
	objects.mixin(InputManager.prototype, /** @lends orion.editor.InputManager.prototype */ {
		setInput: function(location) {
			function errorMessage(error) {
				try {
					error = JSON.parse(error.responseText);
					return error.Message;
				} catch(e) {}
				return error.responseText;
			}
			function parseNumericParams(input, params) {
				for (var i=0; i < params.length; i++) {
					var param = params[i];
					if (input[param]) {
						input[param] = parseInt(input[param], 10);
					}
				}
			}
			var editor = this.getEditor();
			if (location && location[0] !== "#") { //$NON-NLS-0$
				location = "#" + location; //$NON-NLS-0$
			}
			this._lastHash = location;
			var input = PageUtil.matchResourceParameters(location);
			var fileURI = input.resource;
			parseNumericParams(input, ["start", "end", "line", "offset", "length"]); //$NON-NLS-4$ //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			// populate editor
			if (fileURI) {
				if (fileURI === this.lastFilePath) {
					editor.showSelection(input.start, input.end, input.line, input.offset, input.length);
				} else {
					if (!editor.getTextView()) {
						editor.installTextView();
						editor.getTextView().addEventListener("Focus", this._checkContents.bind(this)); //$NON-NLS-0$
					}
					var fullPathName = fileURI;
					var progressTimeout = window.setTimeout(function() {
						editor.setInput(fullPathName, messages["Fetching "] + fullPathName, null);
					}, 800); // wait 800ms before displaying
					var self = this;
					var load = function(results) {
						var contentOrError = results[0];
						var metadataOrError = results[1];
						window.clearTimeout(progressTimeout);
						if (contentOrError._error) {
							window.console.error("HTTP status code: ", contentOrError._error.status); //$NON-NLS-0$
							contentOrError = messages["An error occurred: "] + errorMessage(contentOrError._error);
						}
						if (metadataOrError._error) {
							window.console.error("Error loading file metadata: " + errorMessage(metadataOrError._error)); //$NON-NLS-0$
						}
						self._setInputContents(input, fileURI, contentOrError, metadataOrError);
						window.clearTimeout(progressTimeout);
					};
					var fileClient = this.fileClient;
					var progressService = this.progressService;
					new Deferred.all([
						progressService.progress(fileClient.read(fileURI), i18nUtil.formatMessage(messages.Reading, fileURI)),
						progressService.progress(fileClient.read(fileURI, true), i18nUtil.formatMessage(messages["Reading metedata of"], fileURI))
					], function(error) { return {_error: error}; }).then(load);
				}
				this.lastFilePath = fileURI;
			} else {
				// No input, no editor.
				this.lastFilePath = null;
				editor.uninstallTextView();
				this.dispatchEvent({ type: "InputChanged", input: null }); //$NON-NLS-0$
			}
		},
		_setInputContents: function(input, title, contents, metadata) {
			var editor = this.getEditor();
			var name;
			if (metadata) {
				this._fileMetadata = metadata;
				this.setTitle(metadata.Location || String(metadata));
				this._contentType = this.contentTypeService.getFileContentType(metadata);
				name = metadata.Name;
			} else {
				// No metadata
				this._fileMetadata = null;
				this.setTitle(title);
				this._contentType = this.contentTypeService.getFilenameContentType(this.getTitle());
				name = this.getTitle();
			}
			// TODO could potentially dispatch separate events for metadata and contents changing
			this.dispatchEvent({ type: "InputChanged", input: input, name: name, metadata: metadata, contents: contents }); //$NON-NLS-0$
			var self = this;
			this.syntaxHighlighter.setup(this._contentType, editor.getTextView(), editor.getAnnotationModel(), title, true)
				.then(function() {
					// TODO folding should be a preference.
					var styler = self.syntaxHighlighter.getStyler();
					editor.setFoldingEnabled(styler && styler.foldingEnabled);
					self.dispatchEvent({ type: "ContentTypeChanged", contentType: self._contentType, location: window.location }); //$NON-NLS-0$
					if (!self.dispatcher) {
						self.dispatcher = new mDispatcher.Dispatcher(self.serviceRegistry, editor, self._contentType);
					}
					// Contents
					editor.setInput(title, null, contents);
					editor.showSelection(input.start, input.end, input.line, input.offset, input.length);
				});

			this.setDirty(false);
		},
		_checkContents: function(e) {
			if (!this._autoLoadEnabled) { return; }
			var fileURI = this.getInput();
			this.progressService.progress(this.fileClient.read(fileURI, true), i18nUtil.formatMessage(messages["Reading metedata of"], fileURI)).then(function(data) {
				if (this.getFileMetadata().ETag !== data.ETag) {
					this._fileMetadata = data;
					var editor = this.getEditor();
					if (!editor.isDirty() || window.confirm(messages.loadOutOfSync)) {
						this.progressService.progress(this.fileClient.read(fileURI), i18nUtil.formatMessage(messages.Reading, fileURI)).then(function(contents) {
							editor.setInput(fileURI, null, contents);										
						});
					}
				}
			}.bind(this));
		},
		getInput: function() {
			return this.lastFilePath;
		},
		getTitle: function() {
			return this._lastTitle;
		},
		getFileMetadata: function() {
			return this._fileMetadata;
		},
		getContentType: function() {
			return this._contentType;
		},
		setAutoLoadEnabled: function(enabled) {
			this._autoLoadEnabled = enabled;
		},
		/**
		 * Set the autosave timeout. If the timeout is <code>-1</code>, autosave is
		 * disabled.
		 * @param {Number} timeout - the autosave timeout in milliseconds
		 */
		setAutoSaveTimeout: function(timeout){
			if (!this._idle) {
				var editor = this.getEditor(), textView = editor.getTextView();
				var setIdle = function() {
					editor.removeEventListener("TextViewInstalled", setIdle); //$NON-NLS-0$
					var document = editor.getTextView().getOptions("parent").ownerDocument; //$NON-NLS-0$
					var options = {
						document: document,
						timeout: timeout
					};
					this._idle = new Idle(options);
					this._idle.addEventListener("Idle", function () { //$NON-NLS-0$
						if (editor.isDirty() && !this._saving) {
							this.save();
						}
					}.bind(this));
					this._idle.setTimeout(timeout);
				}.bind(this);
				if (textView) {
					setIdle();
				} else {
					// wait for a textview to get installed
					editor.addEventListener("TextViewInstalled", setIdle); //$NON-NLS-0$
				}
			} else {
				this._idle.setTimeout(timeout);
			}
		},
		setDirty: function(dirty) {
			mGlobalCommands.setDirtyIndicator(dirty);
		},
		setTitle : function(title) {
			var indexOfSlash = title.lastIndexOf("/"); //$NON-NLS-0$
			var shortTitle = title;
			if (indexOfSlash !== -1) {
				shortTitle = shortTitle.substring(indexOfSlash + 1);
			}
			this._lastTitle = shortTitle;
		},
		_handleStatus: function(status, allowHTML) {
			if (!allowHTML && status && typeof status.HTML !== "undefined") { //$NON-NLS-0$
				delete status.HTML;
			}
			var statusService = this.serviceRegistry.getService("orion.page.message"); //$NON-NLS-0$
			if (statusService) {
				statusService.setProgressResult(status);
			} else {
				window.console.log(status);
			}
		},
		_handleError: function(error) {
			var errorToDisplay = {};
			errorToDisplay.Severity = "Error"; //$NON-NLS-0$
			if (error.status === 0) {
				errorToDisplay.Message = messages['No response from server.  Check your internet connection and try again.']; //$NON-NLS-1$
			} else {
				errorToDisplay = error;
			}
			this.handleStatus(errorToDisplay, true /*allow HTML for auth errors*/);
		},
		save: function() {
			this._saving = true;
			var input = this.getInput();
			var editor = this.getEditor();
			editor.reportStatus(messages['Saving...']);
			var contents = editor.getText();
			var etag = this.getFileMetadata().ETag;
			var args = { "ETag" : etag }; //$NON-NLS-0$
			var def = this.fileClient.write(input, contents, args);
			var progress = this.progressService;
			if (progress) {
				def = progress.progress(def, i18nUtil.formatMessage(messages['Saving file {0}'], input));
			}
			var self = this;
			function successHandler(result) {
				self.getFileMetadata().ETag = result.ETag;
				editor.setInput(input, null, contents, true);
				editor.reportStatus("");
				if (self.afterSave) {
					self.afterSave();
				}
				self._saving = false;
			}
			function errorHandler(error) {
				editor.reportStatus("");
				self.handleError(error);
				self._saving = false;
			}
			def.then(successHandler, function(error) {
				// expected error - HTTP 412 Precondition Failed 
				// occurs when file is out of sync with the server
				if (error.status === 412) {
					var forceSave = window.confirm(messages["Resource is out of sync with the server. Do you want to save it anyway?"]);
					if (forceSave) {
						// repeat save operation, but without ETag 
						var def = self.fileClient.write(input, contents);
						if (progress) {
							def = progress.progress(def, i18nUtil.formatMessage(messages['Saving file {0}'], input));
						}
						def.then(successHandler, errorHandler);
					}
				} else {
					// unknown error
					errorHandler(error);
				}
			});
		},
		hashChanged: function() {
			var editor = this.getEditor();
			var oldInput = this.getInput();
			this.selection.setSelections(window.location.hash); // may prompt, change input, or both //$NON-NLS-0$
			var newHash = window.location.hash;
			var newInput = this.getInput();
			var inputChanged = PageUtil.matchResourceParameters(oldInput).resource !== PageUtil.matchResourceParameters(newInput).resource; //$NON-NLS-1$ //$NON-NLS-0$
			var hashMatchesInput = PageUtil.matchResourceParameters(newInput).resource === PageUtil.matchResourceParameters(newHash).resource; //$NON-NLS-1$ //$NON-NLS-0$
			if (!inputChanged && !hashMatchesInput) {
				window.location.hash = this._lastHash[0] === "#" ? this._lastHash.substring(1): this._lastHash; //$NON-NLS-0$
			} else if (inputChanged) {
				this.setInput(newHash, editor);
				this._lastHash = newHash;
			} else {
				// Input didn't change and input matches hash, just remember the current hash
				this._lastHash = newHash;
			}
		},
		shouldGoToURI: function(fileURI) {
			if (typeof fileURI !== "string") { //$NON-NLS-0$
				return false;
			}
			var editor = this.getEditor();
			if (editor.isDirty()) {
				var oldStripped = PageUtil.matchResourceParameters("#" + this.lastFilePath).resource; //$NON-NLS-0$
				var newStripped = PageUtil.matchResourceParameters(fileURI).resource;
				if (oldStripped !== newStripped) {
					return window.confirm(messages["There are unsaved changes.  Do you still want to navigate away?"]);
				}
			}
			return true;
		},
		getEditor: function() {
			return this.editor;
		}
	});
	return {
		InputManager: InputManager
	};
});
