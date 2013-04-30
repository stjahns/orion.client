/*******************************************************************************
 * @license
 * Copyright (c) 2012 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: Anton McConville - IBM Corporation - initial API and implementation
 ******************************************************************************/
/*global window console define localStorage*/
/*jslint browser:true*/

define(['orion/objects', 'orion/webui/littlelib'], function(objects, lib) {

	/**
	 * @param {Object[]} param.options Array of {value:Object, label:String, selected:Boolean(optional)}
	 */

	 
	function GroupedContent( node, body ){
	}
	
	objects.mixin(GroupedContent.prototype, {
	
		templateString: '<div style="float:left;">' +
							'<section>' +
							'<span style="color:#333;padding:15px;">Navigation</span>' +
							'<nav>' +
								'<ul id="navigationlinks"></ul>' +
							'</nav>' +
							'</section>' +
						'</div>' +
						'<div style="float:left;border-left:1px solid #eee;">' +
							'<section>' +
								'<span style="color:#333;padding:15px;">Related Links</span>' +
								'<nav>' +
									'<ul id="relatedlinks">' +
									'</ul>' +
								'</nav>' +
							'</section>' +
						'</div>',
		
		getContentPane: function(){
			return this.templateString;
		}
		
	});
	return GroupedContent;
});
