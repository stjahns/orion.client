/*******************************************************************************
 * @license
 * Copyright (c) 2011 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 *
 * Contributors: IBM Corporation - initial API and implementation
 *******************************************************************************/

/*global define document */

define([], function(){

	/**
	 * Instantiates the text link service. Clients should obtain the 
	 * <tt>orion.core.textlink</tt> service from the service registry rather
	 * than instantiating this service directly. This constructor is intended
	 * for use by page initialization code that is initializing the service registry.
	 *
	 * @name orion.links.TextLinkService
	 * @class A service for finding and inferring hyperlinks from a text input. The service
	 * examines a segment of text, and returns a DOm node with hyperlinks inserted in the appropriate
	 * locations. For example, the service could detect email addresses and convert them into
	 * <tt>mailto:</tt> hyperlinks.
	 * @param {Object} options The service options
	 */
	function TextLinkService(options) {
		this._init(options);
	}
	TextLinkService.prototype = /** @lends orion.links.TextLinkService.prototype */ {
		_init: function(options) {
			this._registry = options.serviceRegistry;
			this._serviceRegistration = this._registry.registerService("orion.core.textlink", this);
		},
		_replaceLink: function(text, result, pattern, words, anchor) {
			var index = text.search(pattern);
			//just append a text node for any content before the match
			if (index > 0) {
				result.appendChild(document.createTextNode(text.substring(0, index)));
				text = text.substring(index);
			}
			//find the exact match by subtracting a string with the match removed from the original string
			var remainder = text.replace(pattern, "");
			var match = text.substring(0,text.length-remainder.length);
			//replace matching text with anchor element
			var segments = match.split(' ', words);
			if (segments.length === words ) {
				var link = document.createElement('a');
				var href= anchor;
				//replace %i variables with words from matching phrase
				for (var i = 0; i < words; i++) {
					href = href.replace('%'+(i+1), segments[i]);
				}
				link.setAttribute('href', href);
				link.innerHTML = match;
				result.appendChild(link);
				text = remainder;
			}
			return text;
		},
		/**
		 * Adds links to an input text string. The links are added to the provided node, or to a new div
		 * node if not input node is provided.
		 * @param {String} text The string to compute links for
		 * @param {Object} [parent] The optional parent DOM node to place the links into
		 * @returns {Object} A DOM node containing the provided text as a series of text and anchor child nodes
		 */
		addLinks: function(text, parent) {
			//define div if one isn't provided
			var result = parent || document.createElement('div');
			var linkScanners = this._registry.getServiceReferences("orion.core.linkScanner");
			if (linkScanners.length > 0) {
				//TODO: support multiple scanners by picking the scanner with the first match
				var linkScanner = linkScanners[0];
				var pattern = new RegExp(linkScanner.getProperty("pattern"), "i");
				var words= linkScanner.getProperty("words");
				var anchor = linkScanner.getProperty("anchor");
				var index = text.search(pattern);
				while (index >= 0) {
					text = this._replaceLink(text, result, pattern, words, anchor);
					index = text.search(pattern);
				}
			}
			//append a text node for any remaining text
			if (text.length > 0) {
				result.appendChild(document.createTextNode(text));
			}
			return result;
		}
		
	};
	TextLinkService.prototype.constructor = TextLinkService;

	//return module exports
	return {
		TextLinkService: TextLinkService
	};
});