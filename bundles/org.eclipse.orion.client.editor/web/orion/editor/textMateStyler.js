/******************************************************************************* 
 * Copyright (c) 2011 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation 
 ******************************************************************************/

/*jslint regexp:false laxbreak:true*/
/*global define dojo window*/

var orion = orion || {};
orion.editor = orion.editor || {};

/**
 * A styler that does nothing, but can be extended by concrete stylers. Extenders can call 
 * {@link orion.editor.AbstractStyler.extend} and provide their own {@link #_onSelection}, 
 * {@link #_onModelChanged}, {@link #_onDestroy} and {@link #_onLineStyle} methods.
 * @class orion.editor.AbstractStyler
 */
orion.editor.AbstractStyler = (function() {
	/** @inner */
	function AbstractStyler() {
	}
	AbstractStyler.prototype = /** @lends orion.editor.AbstractStyler.prototype */ {
		/**
		 * Initializes this styler with a textView. Extenders <b>must</b> call this from their constructor.
		 * @param {orion.textview.TextView} textView
		 */
		initialize: function(textView) {
			this.textView = textView;
			
			textView.addEventListener("Selection", this, this._onSelection);
			textView.addEventListener("ModelChanged", this, this._onModelChanged);
			textView.addEventListener("Destroy", this, this._onDestroy);
			textView.addEventListener("LineStyle", this, this._onLineStyle);
			textView.redrawLines();
		},
		
		/**
		 * Destroys this styler and removes all listeners. Called by the editor.
		 */
		destroy: function() {
			if (this.textView) {
				this.textView.removeEventListener("Selection", this, this._onSelection);
				this.textView.removeEventListener("ModelChanged", this, this._onModelChanged);
				this.textView.removeEventListener("Destroy", this, this._onDestroy);
				this.textView.removeEventListener("LineStyle", this, this._onLineStyle);
				this.textView = null;
			}
		},
		
		/** To be overridden by subclass.
		 * @public
		 */
		_onSelection: function(/**eclipse.SelectionEvent*/ e) {},
		
		/** To be overridden by subclass.
		 * @public
		 */
		_onModelChanged: function(/**eclipse.ModelChangedEvent*/ e) {},
		
		/** To be overridden by subclass.
		 * @public
		 */
		_onDestroy: function(/**eclipse.DestroyEvent*/ e) {},
		
		/** To be overridden by subclass.
		 * @public
		 */
		_onLineStyle: function(/**eclipse.LineStyleEvent*/ e) {}
	};
	
	return AbstractStyler;
}());

/**
 * Helper for extending AbstractStyler.
 * @methodOf orion.editor.AbstractStyler
 * @static
 * @param {Function} subCtor The constructor function for the subclass.
 * @param {Object} [proto] Object to be mixed into the subclass's prototype. This object can contain your 
 * implementation of _onSelection, _onModelChanged, etc.
 * @see orion.editor.TextMateStyler for example usage.
 */
orion.editor.AbstractStyler.extend = function(subCtor, proto) {
	if (typeof(subCtor) !== "function") { throw new Error("Function expected"); }
	subCtor.prototype = new orion.editor.AbstractStyler();
	subCtor.constructor = subCtor;
	for (var p in proto) {
		if (proto.hasOwnProperty(p)) { subCtor.prototype[p] = proto[p]; }
	}
};

orion.editor.Util = {
	/**
	 * @returns {String} str with JSON-escaped control character sequences converted to real control characters.
	 */
	escapeJson: function(/**String*/ str) {
		return str.replace(new RegExp("\\\\n", "g"), "\n")
			.replace(new RegExp("\\\\t", "g"), "\b")
			.replace(new RegExp("\\\\t", "g"), "\t");
	},
	
	// Rules to detect some unsupported Oniguruma features
	unsupported: [
		{regex: /\(\?[ims\-]:/, func: function(match) { return "option on/off for subexp"; }},
		{regex: /\(\?<([=!])/, func: function(match) { return (match[1] === "=") ? "lookbehind" : "negative lookbehind"; }},
		{regex: /\(\?>/, func: function(match) { return "atomic group"; }}
	],
	
	/**
	 * @param {String} str String giving a regular expression pattern from a TextMate JSON grammar.
	 * @param {String} [flags] [ismg]+
	 * @returns {RegExp}
	 */
	toRegExp: function(str) {
		var flags = "";
		function fail(feature, match) {
			throw new Error("Unsupported regex feature \"" + feature + "\": \"" + match[0] + "\" at index: "
					+ match.index + " in " + match.input);
		}
		var match, i;
		for (i=0; i < this.unsupported.length; i++) {
			if ((match = this.unsupported[i].regex.exec(str))) {
				fail(this.unsupported[i].func(match));
			}
		}
		
		// Handle (?x)expr ("x" flag that applies to entire regex)
		var str2 = "";
		if ((match = /^\(\?x\)/.exec(str))) {
			// Eat \s+ (whitespace) and #.* (comment up to EOL) if they occur outside []
			var insideCharacterClass = false;
			for (i=0; i < str.length; ) {
				var match2;
				if ((match2 = /\s+|#.*/.exec(str)) && match2.index === i) {
					i = match2.index + match2[0].length;
//					console.debug("Ate " + match2[0]);
				} else {
					var chr = str.charAt(i);
					if (chr === "[") {
						insideCharacterClass = true;
					} else if (chr === "]") {
						insideCharacterClass = false;
					}
					str2 += chr;
					i++;
				}
			}
		}
		str2 = str2 || str;
		str2 = orion.editor.Util.escapeJson(str2);
		// TODO: tolerate /(?xExpr)/ -- eg. in JSON grammar
		// TODO: tolerate /(?iSubExp)/ -- eg. in PHP grammar (trickier)
		return new RegExp(str2, flags);
	},
	
	hasBackReference: function(/**RegExp*/ regex) {
		return (/\\\d+/).test(regex.source);
	},
	
	/** @returns {RegExp} A regex made by substituting any backreferences in <tt>regex</tt> for the value of the property
	 * in <tt>sub</tt> with the same name as the backreferenced group number. */
	getSubstitutedRegex: function(/**RegExp*/ regex, /**Object*/ sub, /**Boolean*/ escape) {
		escape = (typeof escape === "undefined") ? true : false;
		var exploded = regex.source.split(/(\\\d+)/g);
		var array = [];
		for (var i=0; i < exploded.length; i++) {
			var term = exploded[i];
			var backrefMatch = /\\(\d+)/.exec(term);
			if (backrefMatch) {
				var text = sub[backrefMatch[1]] || "";
				array.push(escape ? orion.editor.Util.escapeRegex(text) : text);
			} else {
				array.push(term);
			}
		}
		return new RegExp(array.join(""));
	},
	
	/** @returns {String} The input string with regex special characters escaped. */
	escapeRegex: function(/**String*/ str) {
		return str.replace(/([\\$\^*\/+?\.\(\)|{}\[\]])/g, "\\$&");
	},
	
	/**
	 * Builds a version of <tt>regex</tt> with every non-capturing term converted into a capturing group. This is a workaround
	 * for JavaScript's lack of API to get the index at which a matched group begins in the input string.<p>
	 * Using the "groupified" regex, we can sum the lengths of matches from <i>consuming groups</i> 1..n-1 to obtain the 
	 * starting index of group n. (A consuming group is a capturing group that is not inside a lookahead assertion).</p>
	 * Example: groupify(/(a+)x+(b+)/) === /(a+)(x+)(b+)/<br />
	 * Example: groupify(/(?:x+(a+))b+/) === /(?:(x+)(a+))(b+)/
	 * @param {RegExp} regex The regex to groupify.
	 * @param {Boolean} [updateBackRefs] Optional, default is true. If false, we won't update backreferences in regex to refer
	 * to the new group numbers of the returned regex.
	 * @returns {Array} An array with 3 elements:
	 * <ul><li>[0] {RegExp} The groupified version of the input regex.</li>
	 * <li>[1] {Object} A map containing old-group to new-group info. Each property is a capturing group number of <tt>regex</tt>
	 * and its value is the corresponding capturing group number of [0].</li>
	 * <li>[2] {Object} A map indicating which capturing groups of [0] are also consuming groups. If a group number is found
	 * as a property in this object, then it's a consuming group.</li></ul>
	 */
	groupify: function(regex, updateBackRefs) {
		updateBackRefs = typeof updateBackRefs === "boolean" ? updateBackRefs : true;
		var NON_CAPTURING = 1,
		    CAPTURING = 2,
		    LOOKAHEAD = 3,
		    NEW_CAPTURING = 4;
		var src = regex.source,
		    len = src.length;
		var groups = [],
		    lookaheadDepth = 0,
		    oldGroupNumber = 1,
		    newGroupNumber = 1;
		var result = [],
		    old2New = {},
		    consuming = {};
		for (var i=0; i < len; i++) {
			var curGroup = groups[groups.length-1];
			var chr = src[i];
			switch (chr) {
				case "(":
					// If we're in new capturing group, close it since ( signals end-of-term
					if (curGroup === NEW_CAPTURING) {
						groups.pop();
						result.push(")");
					}
					var peek2 = (i + 2 < len) ? (src[i+1] + "" + src[i+2]) : null;
					if (peek2 === "?:" || peek2 === "?=" || peek2 === "?!") {
						// Found non-capturing group or lookahead assertion. Note that we preserve non-capturing groups
						// as such, but any term inside them will become a new capturing group (unless it happens to
						// also be inside a lookahead).
						var groupType;
						if (peek2 === "?:") {
							groupType = NON_CAPTURING;
						} else {
							groupType = LOOKAHEAD;
							lookaheadDepth++;
						}
						groups.push(groupType);
						result.push(chr);
						result.push(peek2);
						i += peek2.length;
					} else {
						groups.push(CAPTURING);
						result.push(chr);
						if (lookaheadDepth === 0) {
							consuming[newGroupNumber] = null;
						}
						old2New[oldGroupNumber++] = newGroupNumber++;
					}
					break;
				case ")":
					var group = groups.pop();
					if (group === LOOKAHEAD) { lookaheadDepth--; }
					result.push(chr);
					break;
				default:
					if (curGroup !== CAPTURING && curGroup !== NEW_CAPTURING) {
						// Not in a capturing group, so make a new one to hold this term.
						// Perf improvement: don't create the new group if we're inside a lookahead, since we don't 
						// care about them (nothing inside a lookahead actually consumes input so we don't need it)
						if (lookaheadDepth === 0) {
							groups.push(NEW_CAPTURING);
							result.push("(");
							consuming[newGroupNumber] = null;
							newGroupNumber++;
						}
					}
					result.push(chr);
					if (chr === "\\") {
						var peek = src[i+1];
						if (peek === "\\" || peek === "(" || peek === ")") {
							// Eat next so following iteration doesn't think it's a real slash/lparen/rparen
							result.push(peek);
							i += 1;
						}
					}
					break;
			}
		}
		while (groups.length) {	
			// Close any remaining new capturing groups
			groups.pop();
			result.push(")");
		}
		var newRegex = new RegExp(result.join(""));
		if (updateBackRefs) {
			// Update backreferences so they refer to the new group numbers
			var backrefSubstitution = {};
			for (var prop in old2New) {
				if (old2New.hasOwnProperty(prop)) {
					backrefSubstitution[prop] = "\\" + old2New[prop];
				}
			}
			newRegex = this.getSubstitutedRegex(newRegex, backrefSubstitution, false);
		}
		return [newRegex, old2New, consuming];
	},
	
	/** @returns {Boolean} True if the captures object assigns scope to a matching group other than "0". */
	complexCaptures: function(capturesObj) {
		if (!capturesObj) { return false; }
		for (var prop in capturesObj) {
			if (capturesObj.hasOwnProperty(prop)) {
				if (prop !== "0") {
					return true;
				}
			}
		}
		return false;
	}
};

/**
 * A styler that knows how to apply a limited subset of the TextMate grammar format to style a line.<p>
 *
 * <h4>Styling from a grammar:</h4>
 * Each scope name given in the grammar is converted to an array of CSS class names. For example 
 * a region of text with scope <tt>keyword.control.php</tt> will be assigned the CSS classes 
 * <pre>keyword, keyword-control, keyword-control-php</pre>
 *
 * A CSS file can give rules matching any of these class names to provide generic or more specific styling.
 * For example, <pre>.keyword { font-color: blue; }</pre> colors all keywords blue, while
 * <pre>.keyword-control-php { font-weight: bold; }</pre> bolds only PHP control keywords.
 *
 * This is useful when using grammars that adhere to TextMate's
 * <a href="http://manual.macromates.com/en/language_grammars.html#naming_conventions">scope name conventions</a>,
 * as a single CSS rule can provide consistent styling to similar constructs across different languages.<p>
 * 
 * <h4>Supported top-level grammar features:</h4>
 * <ul><li><tt>fileTypes, patterns, repository</tt> (but see below) are supported.</li>
 * <li><tt>scopeName, firstLineMatch, foldingStartMarker, foldingStopMarker</tt> are <b>not</b> supported.</li>
 * </ul>
 *
 * <p>TODO update this section</p>
 * <del>
 * <h4>Supported grammar rule features:</h4>
 * <ul><li><tt>match</tt> patterns are supported.</li>
 * <li><tt>name</tt> scope is supported.</li>
 * <li><tt>captures</tt> is <b>not</b> supported. Any scopes given inside a <tt>captures</tt> object are not applied.</li>
 * <li><tt>begin/end</tt> patterns are <b>not</b> supported and are ignored, along with their subrules. Consequently, 
 *   matched constructs may <b>not</b> span multiple lines.</li>
 * <li><tt>contentName, beginCaptures, endCaptures, applyEndPatternLast</tt> are <b>not</b> supported.</li>
 * <li><tt>include</tt> is supported, but only when it references a rule in the current grammar's <tt>repository</tt>.
 *   Including <tt>$self</tt>, <tt>$base</tt>, or <tt>rule.from.another.grammar</tt> is <b>not</b> supported.</li>
 * <li>The <tt>(?x)</tt> option ("extended" regex format) is supported, but only when it appears at the beginning of a regex pattern.</li>
 * <li>Matching is done using native JavaScript {@link RegExp}s. As a result, many Oniguruma features are <b>not</b> supported.
 *   Unsupported features include:
 *   <ul><li>Named captures</li>
 *   <li>Setting flags inside groups (eg. <tt>(?i:a)b</tt>)</li>
 *   <li>Lookbehind and negative lookbehind</li>
 *   <li>Subexpression call</li>
 *   <li>etc.</li>
 *   </ul>
 * </li>
 * </ul>
 * </del>
 *
 * @class orion.editor.TextMateStyler
 * @extends orion.editor.AbstractStyler
 * @param {orion.textview.TextView} textView The textView.
 * @param {JSONObject} grammar The TextMate grammar as a JSON object. You can use a plist-to-JSON conversion tool
 * to produce this object. Note that some features of TextMate grammars are not supported.
 */
orion.editor.TextMateStyler = (function() {
	/** @inner */
	function TextMateStyler(textView, grammar) {
		this.initialize(textView);
		this.grammar = this.copy(grammar);
		this._styles = {}; /* key: {String} scopeName, value: {String[]} cssClassNames */
		this._tree = null;
		
		this.preprocess();
	}
	orion.editor.AbstractStyler.extend(TextMateStyler, /** @lends orion.editor.TextMateStyler.prototype */ {
		copy: function(grammar) {
			// Use a copy of the grammar object, since we'll mutate it
			return JSON.parse(JSON.stringify(grammar));
		},
		preprocess: function() {
			var stack = [this.grammar];
			for (; stack.length !== 0; ) {
				var rule = stack.pop();
				if (rule._resolvedRule && rule._typedRule) {
					continue;
				}
//				console.debug("Process " + (rule.include || rule.name));
				
				// Look up include'd rule, create typed *Rule instance
				rule._resolvedRule = this._resolve(rule);
				rule._typedRule = this._createTypedRule(rule);
				
				// Convert the scope names to styles and cache them for later
				this.addStyles(rule.name);
				this.addStyles(rule.contentName);
				this.addStylesForCaptures(rule.captures);
				this.addStylesForCaptures(rule.beginCaptures);
				this.addStylesForCaptures(rule.endCaptures);
				
				if (rule._resolvedRule !== rule) {
					// Add include target
					stack.push(rule._resolvedRule);
				}
				if (rule.patterns) {
					// Add subrules
					for (var i=0; i < rule.patterns.length; i++) {
						stack.push(rule.patterns[i]);
					}
				}
			}
		},
		
		/**
		 * Adds eclipse.Style objects for scope to our _styles cache.
		 * @param {String} scope A scope name, like "constant.character.php".
		 */
		addStyles: function(scope) {
			if (scope && !this._styles[scope]) {
				this._styles[scope] = dojo.map(scope.split("."),
						function(segment, i, segments) {
							return segments.slice(0, i+1).join("-");
						});
//				console.debug("add style for " + scope + " = [" + this._styles[scope].join(", ") + "]");
			}
		},
		addStylesForCaptures: function(/**Object*/ captures) {
			for (var prop in captures) {
				if (captures.hasOwnProperty(prop)) {
					var scope = captures[prop].name;
					this.addStyles(scope);
				}
			}
		},
		/**
		 * A rule that contains subrules ("patterns" in TextMate parlance) but has no "begin" or "end".
		 * Also handles top level of grammar.
		 * @private
		 */
		ContainerRule: (function() {
			function ContainerRule(/**Object*/ rule) {
				this.rule = rule;
				this.subrules = rule.patterns;
			}
			ContainerRule.prototype.valueOf = function() { return "aa"; };
			return ContainerRule;
		}()),
		/**
		 * A rule that is delimited by "begin" and "end" matches, which may be separated by any number of
		 * lines. This type of rule may contain subrules, which apply only inside the begin .. end region.
		 * @private
		 */
		BeginEndRule: (function() {
			function BeginEndRule(/**Object*/ rule) {
				this.rule = rule;
				// TODO: the TextMate blog claims that "end" is optional.
				this.beginRegex = orion.editor.Util.toRegExp(rule.begin);
				this.endRegex = orion.editor.Util.toRegExp(rule.end);
				this.subrules = rule.patterns || [];
				
				this.endRegexHasBackRef = orion.editor.Util.hasBackReference(this.endRegex);
				
				var complexCaptures = orion.editor.Util.complexCaptures(rule.captures);
				this.complexBeginEnd = complexCaptures || orion.editor.Util.complexCaptures(rule.beginCaptures) || orion.editor.Util.complexCaptures(rule.endCaptures);
				if (complexCaptures || this.complexBeginEnd) {
					this.beginRegexGroupified = orion.editor.Util.groupify(this.beginRegex);
				}
				if (complexCaptures || this.complexBeginEnd) {
					this.endRegexGroupified = orion.editor.Util.groupify(this.endRegex, false /*don't touch backrefs*/);
				}
			}
			BeginEndRule.prototype.valueOf = function() { return this.beginRegex; };
			return BeginEndRule;
		}()),
		/**
		 * A rule with a "match" pattern.
		 * @private
		 */
		MatchRule: (function() {
			function MatchRule(/**Object*/ rule) {
				this.rule = rule;
				this.matchRegex = orion.editor.Util.toRegExp(rule.match);
				this.complexCaptures = orion.editor.Util.complexCaptures(rule.captures);
				if (this.complexCaptures) {
					this.matchRegexGroupified = orion.editor.Util.groupify(this.matchRegex);
				}
			}
			MatchRule.prototype.valueOf = function() { return this.matchRegex; };
			return MatchRule;
		}()),
		/**
		 * @param {Object} rule A rule from the JSON grammar.
		 * @returns {MatchRule|BeginEndRule|ContainerRule}
		 */
		_createTypedRule: function(rule) {
			if (rule.match) {
				return new this.MatchRule(rule);
			} else if (rule.begin) {
				return new this.BeginEndRule(rule);
			} else {
				return new this.ContainerRule(rule);
			}
		},
		/**
		 * Resolves a rule from the grammar (which may be an include) into the real rule that it points to.
		 */
		_resolve: function(rule) {
			var resolved = rule;
			if (rule.include) {
				if (rule.begin || rule.end || rule.match) {
					throw new Error("Unexpected regex pattern in \"include\" rule " + rule.include);
				}
				var name = rule.include;
				if (name.charAt(0) === "#") {
					resolved = this.grammar.repository && this.grammar.repository[name.substring(1)];
					if (!resolved) { throw new Error("Couldn't find included rule " + name + " in grammar repository"); }
				} else if (name === "$self") {
					resolved = this.grammar;
				} else if (name === "$base") {
					// $base is only relevant when including rules from foreign grammars
					throw new Error("Include \"$base\" is not supported"); 
				} else {
					throw new Error("Include external rule \"" + name + "\" is not supported");
				}
			}
			return resolved;
		},
		ContainerNode: (function() {
			function ContainerNode(parent, rule) {
				this.parent = parent;
				this.rule = rule;
				this.children = [];
				
				this.start = null;
				this.end = null;
			}
			ContainerNode.prototype.addChild = function(child) {
				this.children.push(child);
			};
			ContainerNode.prototype.valueOf = function() {
				var r = this.rule;
				return "ContainerNode { " + (r.include || "") + " " + (r.name || "") + (r.comment || "") + "}";
			};
			return ContainerNode;
		}()),
		BeginEndNode: (function() {
			function BeginEndNode(parent, rule, beginMatch) {
				this.parent = parent;
				this.rule = rule;
				this.children = [];
				
				this.setStart(beginMatch);
				this.end = null; // will be set eventually during parsing (may be EOF)
				this.endMatch = null; // may remain null if we never match our "end" pattern
				
				// Build a new regex if the "end" regex has backrefs since they refer to matched groups of beginMatch
				if (rule.endRegexHasBackRef) {
					if (rule.complexBeginEnd) {
						// begin regex has been groupified, so we need to substitute using its new group numbers
						var old2New = this.rule.beginRegexGroupified[1];
						var newSub = {};
						for (var groupNum = 1; beginMatch[groupNum] !== undefined; groupNum++) {
							var value = beginMatch[groupNum];
							var newGroupNum = old2New[groupNum];
							newSub[newGroupNum] = value;
						}
						this.endRegexSubstituted = orion.editor.Util.getSubstitutedRegex(rule.endRegexGroupified[0], newSub);
					} else {
						this.endRegexSubstituted = orion.editor.Util.getSubstitutedRegex(rule.endRegex, beginMatch);
					}
				} else {
					this.endRegexSubstituted = null;
				}
			}
			BeginEndNode.prototype.addChild = function(child) {
				this.children.push(child);
			};
			/** @return {Number} This node's index in its parent's "children" list */
			BeginEndNode.prototype.getIndexInParent = function(node) {
				return this.parent ? this.parent.children.indexOf(this) : -1;
			};
			/** @param {RegExp.match} beginMatch */
			BeginEndNode.prototype.setStart = function(beginMatch) {
				this.start = beginMatch.index;
				this.beginMatch = beginMatch;
			};
			/** @param {RegExp.match|Number} endMatchOrLastChar */
			BeginEndNode.prototype.setEnd = function(endMatchOrLastChar) {
				if (endMatchOrLastChar && typeof(endMatchOrLastChar) === "object") {
					var endMatch = endMatchOrLastChar;
					this.endMatch = endMatch;
					this.end = endMatch.index + endMatch[0].length;
				} else {
					var lastChar = endMatchOrLastChar;
					this.endMatch = null;
					this.end = lastChar;
				}
			};
			BeginEndNode.prototype.shiftStart = function(amount) {
				this.start += amount;
				this.beginMatch.index += amount;
			};
			BeginEndNode.prototype.shiftEnd = function(amount) {
				this.end += amount;
				if (this.endMatch) { this.endMatch.index += amount; }
			};
			BeginEndNode.prototype.valueOf = function() {
				return "{" + this.rule.beginRegex + " range=" + this.start + ".." + this.end + "}";
			};
			return BeginEndNode;
		}()),
		/** Pushes rules onto stack so that rules[startFrom] is on top */
		push: function(/**Array*/ stack, /**Array*/ rules) {
			if (!rules) { return; }
			for (var i = rules.length; i > 0; ) {
				stack.push(rules[--i]);
			}
		},
		/** Execs regex on text, and returns the match object with its index offset by the given amount. */
		exec: function(/**RegExp*/ regex, /**String*/ text, /**Number*/ offset) {
			var match = regex.exec(text);
			if (match) { match.index += offset; }
			regex.lastIndex = 0; // Just in case
			return match;
		},
		/** @returns {Number} The position immediately following the match. */
		afterMatch: function(/**RegExp.match*/ match) {
			return match.index + match[0].length;
		},
		/** @returns {RegExp.match} If node is a BeginEndNode and its rule's "end" pattern matches the text. */
		getEndMatch: function(/**Node*/ node, /**String*/ text, /**Number*/ offset) {
			if (node instanceof this.BeginEndNode) {
				var rule = node.rule;
				var endRegex = node.endRegexSubstituted || rule.endRegex;
				if (!endRegex) { return null; }
				return this.exec(endRegex, text, offset);
			}
			return null;
		},
		/** Called once when file is first loaded to build the parse tree. Tree is updated incrementally thereafter as buffer is modified */
		initialParse: function() {
			var last = this.textView.getModel().getCharCount();
			// First time; make parse tree for whole buffer
			var root = new this.ContainerNode(null, this.grammar._typedRule);
			this._tree = root;
			this.parse(this._tree, false, 0);
		},
		_onModelChanged: function(/**eclipse.ModelChangedEvent*/ e) {
			var addedCharCount = e.addedCharCount,
			    addedLineCount = e.addedLineCount,
			    removedCharCount = e.removedCharCount,
			    removedLineCount = e.removedLineCount,
			    start = e.start;
			if (!this._tree) {
				this.initialParse();
			} else {
				var model = this.textView.getModel();
				var charCount = model.getCharCount();
				
				// For rs, we must rewind to the line preceding the line 'start' is on. We can't rely on start's
				// line since it may've been changed in a way that would cause a new beginMatch at its lineStart.
				var rs = model.getLineEnd(model.getLineAtOffset(start) - 1); // may be < 0
				var fd = this.getFirstDamaged(rs, rs);
				rs = rs === -1 ? 0 : rs;
				var stoppedAt;
				if (fd) {
					// [rs, re] is the region we need to verify. If we find the structure of the tree
					// has changed in that area, then we may need to reparse the rest of the file.
					stoppedAt = this.parse(fd, true, rs, start, addedCharCount, removedCharCount);
				} else {
					// FIXME: fd == null ?
					stoppedAt = charCount;
				}
				this.textView.redrawRange(rs, stoppedAt);
			}
		},
		/** @returns {BeginEndNode|ContainerNode} The result of taking the first (smallest "start" value) 
		 * node overlapping [start,end] and drilling down to get its deepest damaged descendant (if any).
		 */
		getFirstDamaged: function(start, end) {
			// If start === 0 we actually have to start from the root because there is no position
			// we can rely on. (First index is damaged)
			if (start < 0) {
				return this._tree;
			}
			
			var nodes = [this._tree];
			var result = null;
			while (nodes.length) {
				var n = nodes.pop();
				if (!n.parent /*n is root*/ || this.isDamaged(n, start, end)) {
					// n is damaged by the edit, so go into its children
					// Note: If a node is damaged, then some of its descendents MAY be damaged
					// If a node is undamaged, then ALL of its descendents are undamaged
					if (n instanceof this.BeginEndNode) {
						result = n;
					}
					// Examine children[0] last
					for (var i=0; i < n.children.length; i++) {
						nodes.push(n.children[i]);
					}
				}
			}
			return result || this._tree;
		},
		/** @returns true If n overlaps the interval [start,end] */
		isDamaged: function(/**BeginEndNode*/ n, start, end) {
			// Note strict > since [2,5] doesn't overlap [5,7]
			return (n.start <= end && n.end > start);
		},
		/**
		 * Builds tree from some of the buffer content
		 *
		 * TODO cleanup params
		 * @param {BeginEndNode|ContainerNode} origNode The deepest node that overlaps [rs,rs], or the root.
		 * @param {Boolean} repairing 
		 * @param {Number} rs See _onModelChanged()
		 * @param {Number} [editStart] Only used for repairing === true
		 * @param {Number} [addedCharCount] Only used for repairing === true
		 * @param {Number} [removedCharCount] Only used for repairing === true
		 */
		parse: function(origNode, repairing, rs, editStart, addedCharCount, removedCharCount) {
			var model = this.textView.getModel();
			var lastLineStart = model.getLineStart(model.getLineCount() - 1);
			var eof = model.getCharCount();
			var initialExpected = this.getInitialExpected(origNode, rs);
			
			// re is best-case stopping point; if we detect change to tree, we must continue past it
			var re = -1;
			if (repairing) {
				origNode.repaired = true;
				origNode.endNeedsUpdate = true;
				var lastChild = origNode.children[origNode.children.length-1];
				var delta = addedCharCount - removedCharCount;
				var lastChildLineEnd = lastChild ? model.getLineEnd(model.getLineAtOffset(lastChild.end + delta)) : -1;
				var editLineEnd = model.getLineEnd(model.getLineAtOffset(editStart + removedCharCount));
				re = Math.max(lastChildLineEnd, editLineEnd);
			}
			re = (re === -1) ? eof : re;
			
			var expected = initialExpected;
			var node = origNode;
			var matchedChildOrEnd = false;
			var pos = rs;
			while (node && (!repairing || (pos < re))) {
				var matchInfo = this.getNextMatch(model, node, pos);
				if (!matchInfo) {
					// Go to next line, if any
					pos = (pos >= lastLineStart) ? eof : model.getLineStart(model.getLineAtOffset(pos) + 1);
				}
				var match = matchInfo && matchInfo.match,
				    rule = matchInfo && matchInfo.rule,
				    isSub = matchInfo && matchInfo.isSub,
				    isEnd = matchInfo && matchInfo.isEnd;
				if (isSub) {
					pos = this.afterMatch(match);
					if (rule instanceof this.BeginEndRule) {
						matchedChildOrEnd = true;
						// Matched a child. Did we expect that?
						if (repairing && rule === expected.rule && node === expected.parent) {
							// Yes: matched expected child
							var foundChild = expected;
							foundChild.setStart(match);
							// Note: the 'end' position for this node will either be matched, or fixed up by us post-loop
							foundChild.repaired = true;
							foundChild.endNeedsUpdate = true;
							node = foundChild; // descend
							expected = this.getNextExpected(expected, "begin");
						} else {
							if (repairing) {
								// No: matched unexpected child.
								this.prune(node, expected);
								repairing = false;
							}
							
							// Add the new child (will replace 'expected' in node's children list)
							var subNode = new this.BeginEndNode(node, rule, match);
							node.addChild(subNode);
							node = subNode; // descend
						}
					} else {
						// Matched a MatchRule; no changes to tree required
					}
				} else if (isEnd || pos === eof) {
					if (node instanceof this.BeginEndNode) {
						if (match) {
							matchedChildOrEnd = true;
							node.setEnd(match);
							pos = this.afterMatch(match);
							// Matched node's end. Did we expect that?
							if (repairing && node === expected && node.parent === expected.parent) {
								// Yes: found the expected end of node
								node.repaired = true;
								delete node.endNeedsUpdate;
								expected = this.getNextExpected(expected, "end");
							} else {
								if (repairing) {
									// No: found an unexpected end
									this.prune(node, expected);
									repairing = false;
								}
							}
						} else {
							// Force-ending a BeginEndNode that runs until eof
							node.setEnd(eof);
							delete node.endNeedsUpdate;
						}
					}
					node = node.parent; // ascend
				}
				
//				if (repairing && pos >= re && !matchedChildOrEnd) {
//					// Reached re without matching any begin/end => initialExpected itself was removed => repair fail
//					this.prune(origNode, initialExpected);
//					repairing = false;
//				}
			} // end loop
			// TODO: do this for every node we end?
			this.removeUnrepairedChildren(origNode, repairing, rs);
			
			//console.debug("parsed " + (pos - rs) + " of " + model.getCharCount + "buf");
			this.cleanup(repairing, origNode, rs, re, eof, addedCharCount, removedCharCount);
			return pos; // where we stopped repairing/reparsing
		},
		/** Helper for parse() in the repair case. To be called when ending a node, as any children that
		 * lie in [rs,node.end] and were not repaired must've been deleted.
		 */
		removeUnrepairedChildren: function(node, repairing, start) {
			if (repairing) {
				var children = node.children;
				var removeFrom = -1;
				for (var i=0; i < children.length; i++) {
					var child = children[i];
					if (!child.repaired && this.isDamaged(child, start, Number.MAX_VALUE /*end doesn't matter*/)) {
						removeFrom = i;
						break;
					}
				}
				if (removeFrom !== -1) {
					node.children.length = removeFrom;
				}
			}
		},
		/** Helper for parse() in the repair case */
		cleanup: function(repairing, origNode, rs, re, eof, addedCharCount, removedCharCount) {
			var i, node, maybeRepairedNodes;
			if (repairing) {
				// The repair succeeded, so update stale begin/end indices by simple translation.
				var delta = addedCharCount - removedCharCount;
				// A repaired node's end can't exceed re, but it may exceed re-delta+1.
				// TODO: find a way to guarantee disjoint intervals for repaired vs unrepaired, then stop using flag
				var maybeUnrepairedNodes = this.getIntersecting(re-delta+1, eof);
				maybeRepairedNodes = this.getIntersecting(rs, re);
				// Handle unrepaired nodes. They are those intersecting [re-delta+1, eof] that don't have the flag
				for (i=0; i < maybeUnrepairedNodes.length; i++) {
					node = maybeUnrepairedNodes[i];
					if (!node.repaired && node instanceof this.BeginEndNode) {
						node.shiftEnd(delta);
						node.shiftStart(delta);
					}
				}
				// Translate 'end' index of repaired node whose 'end' was not matched in loop (>= re)
				for (i=0; i < maybeRepairedNodes.length; i++) {
					node = maybeRepairedNodes[i];
					if (node.repaired && node.endNeedsUpdate) {
						node.shiftEnd(delta);
					}
					delete node.endNeedsUpdate;
					delete node.repaired;
				}
			} else {
				// Clean up after ourself
				maybeRepairedNodes = this.getIntersecting(rs, re);
				for (i=0; i < maybeRepairedNodes.length; i++) {
					delete maybeRepairedNodes[i].repaired;
				}
			}
		},
		/**
		 * @param model {orion.textview.TextModel}
		 * @param node {Node}
		 * @param pos {Number}
		 * @param [matchRulesOnly] {Boolean} Optional, if true only "match" subrules will be considered.
		 * @returns {Object} A match info object with properties:
		 * {Boolean} isEnd
		 * {Boolean} isSub
		 * {RegExp.match} match
		 * {(Match|BeginEnd)Rule} rule
		 */
		getNextMatch: function(model, node, pos, matchRulesOnly) {
			var lineIndex = model.getLineAtOffset(pos);
			var lineEnd = model.getLineEnd(lineIndex);
			var line = model.getText(pos, lineEnd);

			var stack = [],
			    subMatches = [],
			    subrules = [];
			this.push(stack, node.rule.subrules);
			while (stack.length) {
				var next = stack.length ? stack.pop() : null;
				var subrule = next && next._resolvedRule._typedRule;
				if (subrule instanceof this.ContainerRule) {
					// Expand ContainerRule by pushing its subrules on
					this.push(stack, subrule.subrules);
					continue;
				}
				if (subrule && matchRulesOnly && !(subrule.matchRegex)) {
					continue;
				}
				var subMatch = subrule && this.exec(subrule.matchRegex || subrule.beginRegex, line, pos);
				if (subMatch) {
					subMatches.push(subMatch);
					subrules.push(subrule);
				}
			}

			var bestSub = Number.MAX_VALUE,
			    bestSubIndex = -1;
			for (var i=0; i < subMatches.length; i++) {
				var match = subMatches[i];
				if (match.index < bestSub) {
					bestSub = match.index;
					bestSubIndex = i;
				}
			}
			
			if (!matchRulesOnly) {
				// See if the "end" pattern of the active begin/end node matches.
				// TODO: The active begin/end node may not be the same as the node that holds the subrules
				var activeBENode = node;
				var endMatch = this.getEndMatch(node, line, pos);
				if (endMatch) {
					var doEndLast = activeBENode.rule.applyEndPatternLast;
					var endWins = bestSubIndex === -1 || (endMatch.index < bestSub) || (!doEndLast && endMatch.index === bestSub);
					if (endWins) {
						return {isEnd: true, rule: activeBENode.rule, match: endMatch};					}
				}
			}
			return bestSubIndex === -1 ? null : {isSub: true, rule: subrules[bestSubIndex], match: subMatches[bestSubIndex]};
		},
		/**
		 * Gets the node corresponding to the first match we expect to see in the repair.
		 * @param {BeginEndNode|ContainerNode} node The node returned via getFirstDamaged(rs,rs) -- may be the root.
		 * @param {Number} rs See _onModelChanged()
		 * Note that because rs is a line end (or 0, a line start), it will intersect a beginMatch or 
		 * endMatch either at their 0th character, or not at all. (begin/endMatches can't cross lines).
		 * This is the only time we rely on the start/end values from the pre-change tree. After this 
		 * we only look at node ordering, never use the old indices.
		 * @returns {Node}
		 */
		getInitialExpected: function(node, rs) {
			// TODO: Kind of weird.. maybe ContainerNodes should have start & end set, like BeginEndNodes
			var i, child;
			if (node === this._tree) {
				// get whichever of our children comes after rs
				for (i=0; i < node.children.length; i++) {
					child = node.children[i]; // BeginEndNode
					if (child.start >= rs) {
						return child;
					}
				}
			} else if (node instanceof this.BeginEndNode) {
				if (node.endMatch) {
					// Which comes next after rs: our nodeEnd or one of our children?
					var nodeEnd = node.endMatch.index;
					for (i=0; i < node.children.length; i++) {
						child = node.children[i]; // BeginEndNode
						if (child.start >= rs) {
							break;
						}
					}
					if (child && child.start < nodeEnd) {
						return child; // Expect child as the next match
					}
				} else {
					// No endMatch => node goes until eof => it end should be the next match
				}
			}
			return node; // We expect node to end, so it should be the next match
		},
		/**
		 * Helper for repair() to tell us what kind of event we expect next.
		 * @param {Node} expected Last value returned by this method.
		 * @param {String} event "begin" if the last value of expected was matched as "begin",
		 *  or "end" if it was matched as an end.
		 * @returns {Node} The next expected node to match, or null.
		 */
		getNextExpected: function(/**Node*/ expected, event) {
			var node = expected;
			if (event === "begin") {
				var child = node.children[0];
				if (child) {
					return child;
				} else {
					return node;
				}
			} else if (event === "end") {
				var parent = node.parent;
				if (parent) {
					var nextSibling = parent.children[parent.children.indexOf(node) + 1];
					if (nextSibling) {
						return nextSibling;
					} else {
						return parent;
					}
				}
			}
			return null;
		},
		/** Helper for parse() when repairing. Prunes out the unmatched nodes from the tree so we can continue parsing. */
		prune: function(/**BeginEndNode|ContainerNode*/ node, /**Node*/ expected) {
			var expectedAChild = expected.parent === node;
			if (expectedAChild) {
				// Expected child wasn't matched; prune it and all siblings after it
				node.children.length = expected.getIndexInParent();
			} else if (node instanceof this.BeginEndNode) {
				// Expected node to end but it didn't; set its end unknown and we'll match it eventually
				node.endMatch = null;
				node.end = null;
			}
			// Reparsing from node, so prune the successors outside of node's subtree
			if (node.parent) {
				node.parent.children.length = node.getIndexInParent() + 1;
			}
		},
		_onLineStyle: function(/**eclipse.LineStyleEvent*/ e) {
			function byStart(r1, r2) { return r1.start - r2.start; }
			function getClaimedBy(claimedRegions, start, end) {
				// claimedRegions is guaranteed to be a set of nonoverlapping intervals
				var len = claimedRegions.length;
				for (var i=0; i < len; i++) {
					var r = claimedRegions[i];
					if (r.start <= start && end <= r.end) {
						return r.node;
					}
				}
				return null;
			}
			// directRegions must be nonoverlapping intervals and sorted in ascending order by "start"
			function getGaps(directRegions, lineStart, lineEnd) {
				var gaps = [];
				var expect = e.lineStart;
				for (var i=0; i < directRegions.length; i++) {
					var scope = directRegions[i],
					    ss = scope.start,
					    se = scope.end;
					if (ss !== expect) {
						// gap region [expect, ss]
						gaps.push({start: expect, end:ss});
					}
					expect = se;
				}
				if (expect !== lineEnd) {
					gaps.push({start: expect, end: lineEnd});
				}
				return gaps;
			}
			
//			console.debug("lineIndex=" + e.lineIndex + " lineStart=" + e.lineStart + "" /*+ "lineText:" + e.lineText*/ + " ");
			if (!this._tree) {
				// In some cases it seems onLineStyle is called before onModelChanged, so we need to parse here
				this.initialParse();
			}
			
			var lineStart = e.lineStart;
			var model = this.textView.getModel();
			var lineEnd = model.getLineEnd(e.lineIndex);
			var nodes = this.getIntersecting(e.lineStart, lineEnd);
			
			var i, node;
			// Apply "dirct" scopes: ie MatchRule-matches and beginCaptures/endCaptures of the BeginEndRules that intersect this line
			var directScopes = [];
			var claimedRegions = [];
			if (nodes.length > 0 && nodes.length[nodes.length-1] === this._tree) {
				// Intersects multiple nodes, including toplevel node. Remove toplevel node since
				// it's dealth with below
				nodes.splice(nodes.length-1, 1);
			}
			for (i=0; i < nodes.length; i++) {
				node = nodes[i];
				this.styleDirect(directScopes, claimedRegions, node, lineStart, lineEnd);
			}
			
			// begin inherited
			// For each gap remaining in line that wasn't assigned a match/beginCaptures/endCaptures
			// scope above, assign the nearest inherited name/contentName scope to it (if any), or give 
			// the toplevel rules a chance to match it.
			var directSorted = directScopes.slice(0).sort(byStart); // TODO: are these already sorted?
			var gaps = getGaps(directSorted, e.lineStart, lineEnd);
//			console.debug("  gaps: " + gaps.map(function(g){return "["+g.start+","+g.end+" '"+model.getText(g.start,g.end)+"']";}).join(" "));
			
			var inheritedScopes = [];
			for (i=0; i < gaps.length; i++) {
				var gap = gaps[i];
				// find out who owns this gap
				node = getClaimedBy(claimedRegions, gap.start, gap.end);
				if (!node) {
					// Not claimed by anybody--use toplevel "match"-rules
					this.styleFromMatchRules(inheritedScopes, this._tree, gap.start, gap.end);
				} else {
					// Get the nearest inherited name/contentName scope and assign it to the gap
					this.styleInherited(inheritedScopes, node, gap.start, gap.end);
				}
			}
			// end inherited
			
			// directScopes, inheritedScopes are disjoint
			var scopes = directScopes.concat(inheritedScopes);
			e.ranges = this.toStyleRanges(scopes);
			
			// Editor requires StyleRanges must be in ascending order by 'start', or else some will be ignored
			e.ranges.sort(byStart);
			
//			console.debug("  text: " + this.textView.getText(lineStart, lineEnd));
//			console.debug("  scopes: " + scopes.map(function(sc){return sc.scope;}).join(", "));
			//console.debug("  intersects " + nodes.length + ": [" + nodes.map(function(r){return r.valueOf();}).join(", ") + "]");
		},
		// Find the nearest inherited name/contentName and apply it to [start..end]
		styleInherited: function(/**Array*/ scopes, /**BeginEndNode*/ node, start, end) {
			while (node) {
				// if node defines a contentName or name, apply it
				var rule = node.rule.rule;
				var name = rule.name,
				    contentName = rule.contentName;
				// TODO: if both, we don't resolve the conflict. contentName always wins
				var scope = contentName || name;
				if (scope) {
					this.addScope(scopes, node, start, end, contentName || name);
					break;
				}
				node = node.parent;
			}
		},
		// We know node intersects line somehow. Figure out how and apply the relevant styles
		// only for begin/endCaptures, and match rules.
		// claimedRegions records what portion of line this rule applies to
		styleDirect: function(/**Array*/ scopes, /**Array*/ claimedRegions, /**BeginEndNode*/ node, lineStart, lineEnd) {
			var claimedRegion;
			var matchRuleStart, matchRuleEnd;
			var isComplex, groupified;
			if (node instanceof this.BeginEndNode) {
				// if we start on this line, apply our beginCaptures
				// if we end on this line, apply our endCaptures
				var typedRule = node.rule;
				var rule = typedRule.rule;
				var start0 = node.start,
				    start1 = node.start + node.beginMatch[0].length,
				    end0 = (node.endMatch && node.endMatch.index) || node.end,
				    end1 = node.end;
				var beginCaptures = rule.beginCaptures,
				    endCaptures = rule.endCaptures,
				    captures = rule.captures;
				var beginsOnLine = lineStart <= start0 && start1 <= lineEnd,
				   endsOnLine = lineStart <= end0 && end1 <= lineEnd;
				if (beginsOnLine) {
					claimedRegion = {start: start0, end: Math.min(end1, lineEnd)};
					matchRuleStart = start1;
					matchRuleEnd = Math.min(end0, lineEnd);
					isComplex = typedRule.complexBeginEnd;
					groupified = isComplex && typedRule.beginRegexGroupified;
					this.addScopeForCaptures(scopes, node, start0, start1, node.beginMatch, beginCaptures || captures, isComplex, groupified);
				}
				if (endsOnLine) {
					claimedRegion = {start: Math.max(start0, lineStart), end: end1};
					matchRuleStart = Math.max(start1, lineStart);
					matchRuleEnd = end0;
					isComplex = typedRule.complexBeginEnd;
					groupified = isComplex && [node.endRegexSubstituted, typedRule.endRegexGroupified[1], typedRule.endRegexGroupified[2]];
					this.addScopeForCaptures(scopes, node, end0, end1, node.endMatch, endCaptures || captures, isComplex, groupified);
				}
				if (!beginsOnLine && !endsOnLine) {
					claimedRegion = {start: lineStart, end: lineEnd};
					matchRuleStart = lineStart;
					matchRuleEnd = lineEnd;
				}
			} else {
				matchRuleStart = lineStart;
				matchRuleEnd = lineEnd;
				throw new Error("Shouldn't get here--toplevel handled elsewhere");
			}
			// This begin/end rule claims a region of the line
			claimedRegion.node = node;
			claimedRegions.push(claimedRegion);
			
			// Now apply our "match" rules to the available area on this line.
			// TODO: this is probably wrong if we don't end on this line but another Begin/End node does.. oh well.
			this.styleFromMatchRules(scopes, node, matchRuleStart, matchRuleEnd);
		},
		/** Styles the region start..end by applying any "match"-subrules of node */
		styleFromMatchRules: function(/**Array*/ scopes, /**BeginEndNode|ContainerNode*/node, start, end) {
			var model = this.textView.getModel(),
			    pos = start;
			while (true) {
				var matchInfo = this.getNextMatch(model, node, pos, true);
				if (matchInfo) {
					var match = matchInfo.match,
					    typedRule = matchInfo.rule,
					    captures = typedRule.rule.captures;
					pos = this.afterMatch(match);
					// Is it in our range?
					if (match.index + match[0].length <= end) {
						if (captures) {
							// captures scope (takes priority over name)
							this.addScopeForCaptures(scopes, node, match.index, pos, match, captures, typedRule.complexCaptures, typedRule.matchRegexGroupified);
						} else {
							this.addScope(scopes, node, match.index, pos, typedRule.rule.name);
						}
						continue;
					}
				}
				break;
			}
		},
		// fromNode: The BeginEndNode that contributed this scope region
		addScope: function(scopes, fromNode, start, end, scope) {
			if (!scope || start === end) { return; }
			scopes.push({start: start, end: end, scope: scope, from: fromNode});
		},
		addScopeForCaptures: function(scopes, fromNode, start, end, match, captures, isComplex, groupified, isEnd) {
			if (!captures) { return; }
			this.addScope(scopes, fromNode, start, end, captures[0] && captures[0].name);
			
			// apply scopes captures[1..n] to matching groups [1]..[n] of match
			if (isComplex) {
				var newRegex = groupified[0],
				    old2New = groupified[1],
				    consuming = groupified[2];
				// Match again, this time against the groupifiedRegex on start..end (note newMatch guaranteed to be from start..end)
				var newMatch = this.exec(newRegex, this.textView.getText(start,end), start);
				// Now sum up the lengths of preceding consuming groups to get the start offset for each group.
				var newGroupStarts = {1: 0};
				var sum = 0;
				for (var num = 1; newMatch[num] !== undefined; num++) {
					if (consuming[num] !== undefined) {
						sum += newMatch[num].length;
					}
					if (newMatch[num+1] !== undefined) {
						newGroupStarts[num + 1] = sum;
					}
				}
				for (var oldGroupNum = 1; captures[oldGroupNum]; oldGroupNum++) {
					var scope = captures[oldGroupNum].name;
					var newGroupNum = old2New[oldGroupNum];
					var groupStart = start + newGroupStarts[newGroupNum];
					var groupEnd = groupStart + newMatch[newGroupNum].length;
					this.addScope(scopes, fromNode, groupStart, groupEnd, scope);
				}
			}
		},
		/** @returns {Node[]} In depth-first order */
		getIntersecting: function(start, end) {
			var result = [];
			var nodes = this._tree ? [this._tree] : [];
			while (nodes.length) {
				var n = nodes.pop();
				var visitChildren = false;
				if (n instanceof this.ContainerNode) {
					visitChildren = true;
				} else if (this.isDamaged(n, start, end)) {
					visitChildren = true;
					result.push(n);
				}
				if (visitChildren) {
					var len = n.children.length;
//					for (var i=len-1; i >= 0; i--) {
//						nodes.push(n.children[i]);
//					}
					for (var i=0; i < len; i++) {
						nodes.push(n.children[i]);
					}
				}
			}
			return result.reverse();
		},
		_onSelection: function(e) {
		},
		_onDestroy: function(/**eclipse.DestroyEvent*/ e) {
			this.grammar = null;
			this._styles = null;
			this._tree = null;
		},
		/**
		 * Applies the grammar to obtain the {@link eclipse.StyleRange[]} for the given line.
		 * @returns eclipse.StyleRange[]
		 */
		toStyleRanges: function(/**ScopeRange[]*/ scopeRanges) {
			var styleRanges = [];
			for (var i=0; i < scopeRanges.length; i++) {
				var scopeRange = scopeRanges[i];
				var classNames = this._styles[scopeRange.scope];
				if (!classNames) { throw new Error("styles not found for " + scopeRange.scope); }
				var classNamesString = classNames.join(" ");
				styleRanges.push({start: scopeRange.start, end: scopeRange.end, style: {styleClass: classNamesString}});
//				console.debug("{start " + styleRanges[i].start + ", end " + styleRanges[i].end + ", style: " + styleRanges[i].style.styleClass + "}");
			}
			return styleRanges;
		}
	});
	return TextMateStyler;
}());

if (typeof window !== "undefined" && typeof window.define !== "undefined") {
	define(['dojo'], function() {
		return orion.editor;
	});
}

