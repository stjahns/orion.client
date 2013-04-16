/*******************************************************************************
 * @license
 * Copyright (c) 2010, 2012 IBM Corporation and others.
 * Copyright (c) 2012 VMware, Inc.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 *
 * Contributors: 
 *     IBM Corporation - initial API and implementation
 *     Andrew Eisenberg - rename jsContentAssist to jsTemplateContentAssist
 *******************************************************************************/
/*global window define*/
/*jslint browser:true devel:true*/

define([
	"orion/editor/edit",
	"orion/keyBinding"
],
function(edit, mKeyBinding){
	
	var editorDomNode = document.getElementById("editor"); //$NON-NLS-0$

	function save(editor) {
		editor.setInput(null, null, null, true);
		setTimeout(function() {
			window.alert("Save hook.");
		}, 0);
	}

	var status = "";
	var dirtyIndicator = "";
	var statusReporter = function(message, isError) {
		if (isError) {
			status =  "ERROR: " + message;
		} else {
			status = message;
		}
		document.getElementById("status").textContent = dirtyIndicator + status; //$NON-NLS-0$
	};
	
	var editor = edit({
		parent: editorDomNode,
		lang: "js", //$NON-NLS-0$
		contents: "window.alert('this is some javascript code');", //$NON-NLS-0$  // try pasting in some real code
		statusReporter: statusReporter
	});
	
	// save binding
	editor.getTextView().setKeyBinding(new mKeyBinding.KeyBinding("s", true), "save"); //$NON-NLS-1$ //$NON-NLS-0$
	editor.getTextView().setAction("save", function(){ //$NON-NLS-0$
			save(editor);
			return true;
	});
	document.getElementById("save").onclick = function() {save(editor);}; //$NON-NLS-0$
		
	editor.addEventListener("DirtyChanged", function(evt) { //$NON-NLS-0$
		if (editor.isDirty()) {
			dirtyIndicator = "*"; //$NON-NLS-0$
		} else {
			dirtyIndicator = "";
		}
		statusReporter(dirtyIndicator + status);
	});
	
	window.onbeforeunload = function() {
		if (editor.isDirty()) {
			 return "There are unsaved changes.";
		}
	};
});
