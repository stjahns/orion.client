/*global define*/
/*jslint browser:true*/
define("orion/editor/viCommandLine", [ //$NON-NLS-0$
		"i18n!orion/editor/nls/messages", //$NON-NLS-0$
		"orion/util" //$NON-NLS-0$
], function (messages, util) {

	// Regexs for parsing commands

	var gotoLinePattern = /^[0-9]+$/;
	gotoLinePattern.compile(gotoLinePattern);

	var savePattern = /^wq?$/;
	savePattern.compile(savePattern);

	function ViCommandLine(textView) {
		this.textView = textView;
	}

	ViCommandLine.prototype = {

		/**
		 * Show / focus the command line at the bottom of the editor,
		 * creating it if necessary
		 */
		show: function() {

			var findDiv = document.getElementById("viCommandLine"); //$NON-NLS-0$

			if (!findDiv) {
				this._createCommandLine();
				findDiv = document.getElementById("viCommandLine"); //$NON-NLS-0$
			}

			// Give focus to command line after a short delay
			window.setTimeout(function() {
				findDiv.select();
				findDiv.focus();
			}, 10);

			this._visible = true;
		},

		/**
		 * Remove the command line from the DOM, if it exists
		 */
		hide: function() {
			var findDiv = document.getElementById("viCommandLineContainer"); //$NON-NLS-0$
			if (findDiv)
			{
				findDiv.parentElement.removeChild(findDiv);
			}
			this.textView.focus();
		},

		/**
		 * Create the DOM elements for the VIM command line
		 */
		_createCommandLine: function() {

			var self = this;

			var parentDiv = document.getElementById("editor").parentElement; //$NON-NLS-0$

			var commandLineContainer = document.createElement('div'); //$NON-NLS-0$
			commandLineContainer.className = "viCommandLineContainer editorTheme textView annotationLine currentLine"; //$NON-NLS-0$
			commandLineContainer.id = "viCommandLineContainer"; //$NON-NLS-0$
			commandLineContainer.style.position = "absolute"; //$NON-NLS-0$
			commandLineContainer.style.width = "100%"; //$NON-NLS-0$
			commandLineContainer.style.bottom = "0"; //$NON-NLS-0$
			commandLineContainer.style["z-index"] = "1"; //$NON-NLS-1$ //$NON-NLS-0$

			var commandLinePrefix = document.createElement('div'); //$NON-NLS-0$
			commandLinePrefix.textContent = ":"; //$NON-NLS-0$
			commandLinePrefix.style.display = "table-cell"; //$NON-NLS-0$

			var inputContainer = document.createElement('div'); //$NON-NLS-0$
			inputContainer.style.width = "100%"; //$NON-NLS-0$
			inputContainer.style.display = "table-cell"; //$NON-NLS-0$

			var commandLineInput = document.createElement('input'); //$NON-NLS-0$
			commandLineInput.type = "text"; //$NON-NLS-0$
			commandLineInput.id = "viCommandLine"; //$NON-NLS-0$
			commandLineInput.className = "parameterInput editorTheme"; //$NON-NLS-0$
			commandLineInput.style.margin = "0"; //$NON-NLS-0$
			commandLineInput.style.background = "transparent"; //$NON-NLS-0$
			commandLineInput.style.border = "none"; //$NON-NLS-0$
			commandLineInput.style.width = "100%"; //$NON-NLS-0$

			this.commandLineInput = commandLineInput;

			commandLineInput.onkeydown = function(evt){
				return self._handleKeyDown(evt);
			};

			inputContainer.appendChild(commandLineInput);

			commandLineContainer.appendChild(commandLinePrefix);
			commandLineContainer.appendChild(inputContainer);

			parentDiv.appendChild(commandLineContainer);
		},

		/**
		 * Handle key events for when the command line has focus
		 */
		_handleKeyDown: function(evt) {

			switch (evt.keyCode) {
				
				case 27: // ESC
					this.hide();
					return false;

				case 13: // ENTER
					this._execute(this.commandLineInput.value);
					this.hide();
					return false;

				case 8: // BACKSPACE
					if (this.commandLineInput.value === "") {
						this.hide();
						return false;
					}
					break;
			}

			return true;
		},

		/**
		 * Parse and execute the command line input
		 */
		_execute: function(string) {

			if (string.match(gotoLinePattern)) {
				var data = {};
				data.line = parseInt(string, 10);
				this.textView.invokeAction("gotoLine", false, data); //$NON-NLS-0$
				
			} else if (string.match(savePattern)) {
				this.textView.invokeAction("save"); //$NON-NLS-0$
			}
		}
	};

	return {
		ViCommandLine: ViCommandLine
	};
});