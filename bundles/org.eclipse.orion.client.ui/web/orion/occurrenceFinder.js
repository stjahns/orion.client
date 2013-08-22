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

/*global define window */

define(['orion/Deferred'], function(Deferred) {

var OccurrenceFinder = (function () {
	function OccurrenceFinder(serviceRegistry, editor) {
		this.registry = serviceRegistry;
		this.editor = editor;
	}
	OccurrenceFinder.prototype = {
		/* Looks up applicable references of occurrence service, calls references, calls the editor to show the occurrences. */
		findOccurrences: function(inputManager, textView) {
			function getServiceRefs(registry, contentType, title) {
				var contentTypeService = registry.getService("orion.core.contenttypes"); //$NON-NLS-0$
				function getFilteredServiceRef(registry, sReference, contentType) {
					var contentTypeIds = sReference.getProperty("contentType"); //$NON-NLS-0$
					return contentTypeService.isSomeExtensionOf(contentType, contentTypeIds).then(function(result) {
						return result ? sReference : null;
					});
				}
				var serviceRefs = registry.getServiceReferences("orion.edit.occurrences"); //$NON-NLS-0$
				var filteredServiceRefs = [];
				for (var i=0; i < serviceRefs.length; i++) {
					var serviceRef = serviceRefs[i];
					var pattern = serviceRef.getProperty("pattern"); // backwards compatibility //$NON-NLS-0$
					if (serviceRef.getProperty("contentType")) { //$NON-NLS-0$
						filteredServiceRefs.push(getFilteredServiceRef(registry, serviceRef, contentType));
					} else if (pattern && new RegExp(pattern).test(title)) {
						var d = new Deferred();
						d.resolve(serviceRef);
						filteredServiceRefs.push(d);
					}
				}
				
				// Return a promise that gives the service references that aren't null
				return Deferred.all(filteredServiceRefs, function(error) {return {_error: error}; }).then(
					function(serviceRefs) {
						var capableServiceRefs = [];
						for (var i=0; i < serviceRefs.length; i++) {
							var serviceRef = serviceRefs[i];
							if (serviceRef && !serviceRef._error) {
								capableServiceRefs.push(serviceRef);
							}
						}
						return capableServiceRefs;
					});
			}
			
			var occurrenceTimer;
			var self = this;
			var occurrencesService = self.registry.getService("orion.edit.occurrences"); //$NON-NLS-0$
			var selectionListener = function(e) {
				if (occurrenceTimer) {
					window.clearTimeout(occurrenceTimer);
				}
				occurrenceTimer = window.setTimeout(function() {
					occurrenceTimer = null;
					var editor = self.editor;
					var sel = editor.getSelection();
					occurrencesService.findOccurrences(editor.getText(), sel).then(function (occurrences) {
						self.editor.showOccurrences(occurrences);
					});	
				}, 500);
			};
						
			inputManager.addEventListener("ContentTypeChanged", function(event) {//$NON-NLS-0$
				textView.removeEventListener("Selection", selectionListener); //$NON-NLS-0$
				getServiceRefs(self.registry, event.contentType, self.editor.getTitle()).then(function(serviceRefs) {
					if (!serviceRefs || serviceRefs.length === 0) {
						if (occurrenceTimer) {
							window.clearTimeout(occurrenceTimer);
						}
					} else {
						textView.addEventListener("Selection", selectionListener); //$NON-NLS-0$
					}
				});
			});
		}
	};
	return OccurrenceFinder;			
}());
return {OccurrenceFinder: OccurrenceFinder};
});