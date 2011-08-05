/*******************************************************************************
 * Copyright (c) 2010, 2011 IBM Corporation and others. All rights reserved.
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v1.0
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html).
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/
define([ 'dojo', 'dijit', 'orion/commands', 'dijit/Menu', 'dijit/MenuItem', 'dijit/form/DropDownButton' ], function(dojo, dijit, mCommands){
	
var orion = orion || {};

orion.TextSearcher = (function() {
	function TextSearcher(cmdservice, textSearchResponser, options) {
		this._commandService = cmdservice;
		this._textSearchResponser = textSearchResponser;
		
		this._ignoreCase = false;
		this._wrapSearch = true;
		this._wholeWord = false;
		this._incremental = true;
		this._useRegExp = false;
		this._findAfterReplace = false;
		
		this._reverse = false;
		
		this._searchRange = null;
		this._searchOnRange = false;
		this._toolBarId = "optionalPageActions";
		this.setOptions(options);
	}
	TextSearcher.prototype = {
		_createActionTable : function() {
			var that = this;
			var parentDiv = document
					.getElementById(this._toolBarId);
			var table = document.createElement('table');
			// table.width = "100%";
			parentDiv.appendChild(table);

			var row = document.createElement('tr');
			table.appendChild(row);
			row.align = "right";
			table.align = "right";

			// create search text area
			var searchStrTd = document.createElement('td');
			row.appendChild(searchStrTd);
			var searchStringDiv = document.createElement('input');
			searchStringDiv.type = "text";
			searchStringDiv.name = "Find:";
			searchStringDiv.id = "localSearchFindWith";
			searchStringDiv.onkeyup = function(evt){
				var searchStr = document.getElementById("localSearchFindWith").value;
				var startPos = that._textSearchResponser.getSearchStartIndex(true);
				if(searchStr && searchStr.length > 0 && that._incremental){
					that.setOptions({reverse : false});
					that.doFind( document.getElementById("localSearchFindWith").value, startPos);
				} else {
					 that._textSearchResponser.responseFind(startPos, startPos);
				}
				document.getElementById("localSearchFindWith").focus();
			};
			searchStrTd.appendChild(searchStringDiv);

			// create the command span for Find
			var td = document.createElement('td');
			td.id = "localSearchFindCommands";
			row.appendChild(td);
			// td.noWrap = true;

			// create replace text
			var replaceStrTd = document.createElement('td');
			row.appendChild(replaceStrTd);
			var replaceStringDiv = document.createElement('input');
			replaceStringDiv.type = "text";
			replaceStringDiv.name = "ReplaceWith:";
			replaceStringDiv.id = "localSearchReplaceWith";
			dojo.addClass(replaceStringDiv, 'searchCmdGroupMargin');
			replaceStrTd.appendChild(replaceStringDiv);

			// create the command span for Replace
			td = document.createElement('td');
			td.id = "localSearchReplaceCommands";
			row.appendChild(td);

			// create all other span for commands : replace/find ,
			// replace all
			td = document.createElement('td');
			td.id = "localSearchOtherCommands";
			row.appendChild(td);

			// create directions : forward , backward (radion
			// button)
			var dirTd = document.createElement('td');
			// td.noWrap = true;
			row.appendChild(dirTd);

			// create Scope : All , selected lines (radion button)
			var scopeTd = document.createElement('td');
			// td.noWrap = true;
			row.appendChild(scopeTd);

			// create Options button , which will bring a dialog
			var optionTd = document.createElement('td');
			// td.noWrap = true;
			row.appendChild(optionTd);

			var optionMenu = dijit.byId("searchOptMenu");
			if (optionMenu) {
				optionMenu.destroy();
			}
			var newMenu = new dijit.Menu({
				style : "display: none;",
				id : "searchOptMenu"
			});
			
			newMenu.addChild(new dijit.CheckedMenuItem({
				label: "Case sensative",
				checked: !that._ignoreCase,
				onChange : function(checked) {
					that.setOptions({ignoreCase: !checked});
				}
			}));
			
			newMenu.addChild(new dijit.CheckedMenuItem({
				label: "Wrap search",
				checked: that._wrapSearch,
				onChange : function(checked) {
					that.setOptions({wrapSearch: checked});
				}
			}));
			/*
			newMenu.addChild(new dijit.CheckedMenuItem({
				label: "Whole word",
				checked: that._wholeWord,
				onChange : function(checked) {
					that.setOptions({wholeWord: checked});
				}
			}));
			*/
			newMenu.addChild(new dijit.CheckedMenuItem({
				label: "Incremental search",
				checked: that._incremental,
				onChange : function(checked) {
					that.setOptions({incremental: checked});
				}
			}));
			
			newMenu.addChild(new dijit.CheckedMenuItem({
				label: "Regular expression",
				checked: that._useRegExp,
				onChange : function(checked) {
					that.setOptions({useRegExp: checked});
				}
			}));
			
			newMenu.addChild(new dijit.CheckedMenuItem({
				label: "Find after replace",
				checked: that._findAfterReplace,
				onChange : function(checked) {
					that.setOptions({findAfterReplace: checked});
				}
			}));
			
			var menuButton = new dijit.form.DropDownButton({
				label : "Options",
				dropDown : newMenu
			});
			dojo.addClass(menuButton.domNode, "commandImage");
			dojo.place(menuButton.domNode, optionTd, "last");

			// create close command span
			var closeTd = document.createElement('td');
			closeTd.id = "localSearchCloseCommands";
			row.appendChild(closeTd);
			return table;
		},

		_closeUI : function() {
			dojo.empty(this._toolBarId);
			this._refreshTopContainer();
			this._toolBarExist = false;
		},

		_refreshTopContainer : function() {
			// There is refresh issue when we add some thing inside
			// the dijit.layout.BorderContainer
			// We need to work this around by doing the layout()
			// call.
			var topContainer = dijit.byId("topContainer");
			if (topContainer && topContainer.layout)
				topContainer.layout();
		},

		buildToolBar : function(defaultSearchStr) {
			if (this._toolBarExist) {
				this._closeUI();
				return;
			}
			this._toolBarExist = true;
			this._createActionTable();
			this._refreshTopContainer();

			// set the default value of search string
			var findDiv = document
					.getElementById("localSearchFindWith");
			findDiv.value = defaultSearchStr;
			findDiv.focus();

			var that = this;
			var findNextCommand = new mCommands.Command({
				name : "Find Next",
				image : "/images/move_down.gif",
				id : "orion.search.findNext",
				groupId : "orion.searchGroup",
				callback : function() {
					that.findNext(true);
				}
			});

			var findPrevCommand = new mCommands.Command({
				name : "Find Previous",
				image : "/images/move_up.gif",
				id : "orion.search.findPrev",
				groupId : "orion.searchGroup",
				callback : function() {
					that.findNext(false);
				}
			});

			var replaceCommand = new mCommands.Command({
				name : "ReplaceWith",
				image : "/images/rename.gif",
				id : "orion.search.replace",
				groupId : "orion.searchGroup",
				callback : function() {
					that.replace();
				}
			});

			var closeUICommand = new mCommands.Command({
				name : "Close",
				image : "/images/delete.gif",
				id : "orion.search.closeUI",
				groupId : "orion.searchGroup",
				callback : function() {
					that._closeUI();
				}
			});

			this._commandService.addCommand(findNextCommand, "dom");
			this._commandService.addCommand(findPrevCommand, "dom");
			this._commandService.addCommand(replaceCommand, "dom");
			this._commandService.addCommand(closeUICommand, "dom");

			// Register command contributions
			this._commandService.registerCommandContribution("orion.search.findNext", 1, "localSearchFindCommands");
			this._commandService.registerCommandContribution("orion.search.findPrev", 2, "localSearchFindCommands");
			this._commandService.registerCommandContribution("orion.search.replace", 1, "localSearchReplaceCommands");
			this._commandService.registerCommandContribution("orion.search.closeUI", 1, "localSearchCloseCommands");
			this._commandService.renderCommands("localSearchFindCommands", "dom", that, that, "image", 'searchCommandImage', null, false, 'searchCommandOver', 'searchCommandLink');
			this._commandService.renderCommands("localSearchReplaceCommands", "dom", that, that, "image", 'searchCommandImage', null, false, 'searchCommandOver', 'searchCommandLink');
			this._commandService.renderCommands("localSearchCloseCommands", "dom", that, that, "image", 'searchCommandImage', null, false, 'searchCommandOver', 'searchCommandLink');
		},

		/**
		 * Helper for finding occurrences of str in the editor
		 * contents.
		 * 
		 * @param {String}
		 *            str
		 * @param {Number}
		 *            startIndex
		 * @param {Boolean}
		 *            [ignoreCase] Default is false.
		 * @param {Boolean}
		 *            [reverse] Default is false.
		 * @return {Object} An object giving the match details, or
		 *         <code>null</code> if no match found. The
		 *         returned object will have the properties:<br />
		 *         {Number} index<br />
		 *         {Number} length
		 */
		_findString : function(firstTime, text, searchStr, startIndex) {
			var i;
			if (this._reverse) {
				if(firstTime){
					text = text.split("").reverse().join("");
					searchStr = searchStr.split("").reverse().join("");
				}
				startIndex = text.length - startIndex - 1;
				i = text.indexOf(searchStr, startIndex);
				if (i === -1) {
					if (this._wrapSearch && firstTime)
						return this._findString(false, text, searchStr, text.length - 1);
				} else {
					return {
						index : text.length - searchStr.length - i,
						length : searchStr.length
					};
				}

			} else {
				i = text.indexOf(searchStr, startIndex);
				if (i === -1) {
					if (this._wrapSearch && firstTime)
						return this._findString(false, text, searchStr, 0);
				} else {
					return {
						index : i,
						length : searchStr.length
					};
				}
			}
			return null;
		},

		getResponser : function() {
			return this._textSearchResponser;
		},

		setOptions : function(options) {
			if (options) {
				if (options.ignoreCase === true
						|| options.ignoreCase === false) {
					this._ignoreCase = options.ignoreCase;
				}
				if (options.wrapSearch === true
						|| options.wrapSearch === false) {
					this._wrapSearch = options.wrapSearch;
				}
				if (options.wholeWord === true
						|| options.wholeWord === false) {
					this._wholeWord = options.wholeWord;
				}
				if (options.incremental === true
						|| options.incremental === false) {
					this._incremental = options.incremental;
				}
				if (options.useRegExp === true
						|| options.useRegExp === false) {
					this._useRegExp = options.useRegExp;
				}
				if (options.findAfterReplace === true
						|| options.findAfterReplace === false) {
					this._findAfterReplace = options.findAfterReplace;
				}
				
				if (options.reverse === true
						|| options.reverse === false) {
					this._reverse = options.reverse;
				}
				
				if (options.toolBarId) {
					this._toolBarId = options.toolBarId;
				}
				if (options.searchRange) {
					this._searchRange = options.searchRange;
				}
				if (options.searchOnRange === true
						|| options.searchOnRange === false) {
					this._searchOnRange = options.searchOnRange;
				}
			}
		},

		findNext : function(next) {
			this.setOptions({
				reverse : !next
			});
			this.doFind(document.getElementById("localSearchFindWith").value, this._textSearchResponser.getSearchStartIndex(this._reverse));
		},

		replace : function() {
			this._textSearchResponser.responseReplace(document.getElementById("localSearchReplaceWith").value);
			if (this._findAfterReplace && document.getElementById("localSearchFindWith").value.length > 0)
				this.doFind(document.getElementById("localSearchFindWith").value, this._textSearchResponser.getSearchStartIndex(this._reverse));
		},

		doFind : function(searchStr, startIndex) {
			var text;
			if (this._searchOnRange && this._searchRange) {
				text = this._textSearchResponser.getText()
						.substring(this._searchRange.start,
								this._searchRange.end);
				startIndex = startIndex - this._searchRange.start;
			} else {
				text = this._textSearchResponser.getText();
			}
			if (this._ignoreCase) {
				searchStr = searchStr.toLowerCase();
				text = text.toLowerCase();
			}
			if(startIndex < 0)
				startIndex = 0;
			if (this._useRegExp) {
				var regexp = this.parseRegExp("/" + searchStr + "/");
				if (regexp) {
					var pattern = regexp.pattern;
					var flags = regexp.flags;
					flags = flags + (this._ignoreCase && flags.indexOf("i") === -1 ? "i" : "");
					result = this._findRegExp(true, text, pattern, flags, startIndex);
				}
			} else {
				result = this._findString(true, text, searchStr, startIndex);
			}

			if (result) {
				this._textSearchResponser.responseFind(result.index, result.index + result.length, this._reverse);
			} else {
				this._textSearchResponser.responseFind(-1, -1);
			}
		},

		/**
		 * Helper for finding regex matches in the editor contents.
		 * Use {@link #doFind} for simple string searches.
		 * 
		 * @param {String}
		 *            pattern A valid regexp pattern.
		 * @param {String}
		 *            flags Valid regexp flags: [is]
		 * @param {Number}
		 *            [startIndex] Default is false.
		 * @param {Boolean}
		 *            [reverse] Default is false.
		 * @return {Object} An object giving the match details, or
		 *         <code>null</code> if no match found. The
		 *         returned object will have the properties:<br />
		 *         {Number} index<br />
		 *         {Number} length
		 */
		_findRegExp : function(firsTime, text, pattern, flags, startIndex) {
			if (!pattern) {
				return null;
			}

			flags = flags || "";
			// 'g' makes exec() iterate all matches, 'm' makes ^$
			// work linewise
			flags += (flags.indexOf("g") === -1 ? "g" : "")
					+ (flags.indexOf("m") === -1 ? "m" : "");
			var regexp = new RegExp(pattern, flags);
			var result = null, match = null;
			if (this._reverse) {
				while (true) {
					result = regexp.exec(text);
					if(result){
						if(result.index <= startIndex){
							match = {index : result.index, length : result[0].length};
						} else {
							if(!this._wrapSearch)
								return match;
							if(match)
								return match;
							startIndex = text.length -1;
							match = {index : result.index, length : result[0].length};
						}
						
					} else {
						return match;
					}
					
				}
			} else {
				result = regexp.exec(text.substring(startIndex));
				if(!result && this._wrapSearch){
					startIndex = 0;
					result = regexp.exec(text.substring(startIndex));
				}
				return result && {
					index : result.index + startIndex,
					length : result[0].length
				};
			}
		},

		/**
		 * @private
		 * @static
		 * @param {String}
		 *            Input string
		 * @returns {pattern:String, flags:String} if str looks like
		 *          a RegExp, or null otherwise
		 */
		parseRegExp : function(str) {
			var regexp = /^\s*\/(.+)\/([gim]{0,3})\s*$/.exec(str);
			if (regexp) {
				return {
					pattern : regexp[1],
					flags : regexp[2]
				};
			}
			return null;
		}

	};
	return TextSearcher;
}());

return orion;
});
