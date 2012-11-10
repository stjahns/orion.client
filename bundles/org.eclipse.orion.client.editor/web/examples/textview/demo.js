/*******************************************************************************
 * @license
 * Copyright (c) 2011, 2012 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *     Mihai Sucan (Mozilla Foundation) - fix for bug 350636
 *******************************************************************************/
 
/*globals define window */

define(['examples/textview/demoSetup', 'tests/textview/test-performance', 'orion/textview/util'],   
 
function(mSetup, mTestPerformance, util) {

	/** Console */
	var document = window.document;
	var console = document.getElementById('console'); //$NON-NLS-0$
	var consoleCol = document.getElementById('consoleCol'); //$NON-NLS-0$
	var consoleHeader = document.getElementById('consoleHeader'); //$NON-NLS-0$
	var consoleActions = document.getElementById('consoleActions'); //$NON-NLS-0$
	
	/** Actions */
	var bCreateJava = document.getElementById("createJavaSample"); //$NON-NLS-0$
	var bCreateJS = document.getElementById("createJavaScriptSample"); //$NON-NLS-0$
	var bCreateHTML = document.getElementById("createHtmlSample"); //$NON-NLS-0$
	var bCreatePlain = document.getElementById("createPlainTextSample"); //$NON-NLS-0$
	var bCreateBidi = document.getElementById("createBidiTextSample"); //$NON-NLS-0$
	var bCreateLoad = document.getElementById("createLoad"); //$NON-NLS-0$
	var sLangSelect = document.getElementById("langSelect"); //$NON-NLS-0$
	var tURLContent = document.getElementById("urlContent"); //$NON-NLS-0$
	var bSetOptions = document.getElementById("setOptions"); //$NON-NLS-0$
	var bClearLog = document.getElementById("clearLog"); //$NON-NLS-0$
	var bHideLog = document.getElementById("hideLog"); //$NON-NLS-0$
	var bTest = document.getElementById("test"); //$NON-NLS-0$
	var bPerform = document.getElementById("performanceTest"); //$NON-NLS-0$
	var sPerform = document.getElementById("performanceTestSelect"); //$NON-NLS-0$
	var sTheme = document.getElementById("themeSelect"); //$NON-NLS-0$
	var bReadOnly = document.getElementById('readOnly'); //$NON-NLS-0$
	var bFullSel = document.getElementById('fullSelection'); //$NON-NLS-0$
	var bWrap = document.getElementById('wrap'); //$NON-NLS-0$
	var bExpandTab = document.getElementById('expandTab'); //$NON-NLS-0$
	var sTabSize = document.getElementById('tabSize'); //$NON-NLS-0$

	function clearConsole () {
		if (!console) { return; }
		while (console.hasChildNodes()) { console.removeChild(console.lastChild); }
	}
	
	function showConsole () {
		if (!console) { return; }
		consoleCol.style.display = consoleHeader.style.display = consoleActions.style.display = "block"; //$NON-NLS-0$
		if (mSetup.view) { mSetup.view.resize(); }
	}
	
	function hideConsole () {
		if (!console) { return; }
		consoleCol.style.display = consoleHeader.style.display = consoleActions.style.display = "none"; //$NON-NLS-0$
		if (mSetup.view) { mSetup.view.resize(); }
	}
	
	function log (text) {
		if (!console) { return; }
		showConsole();
		for (var n = 1; n < arguments.length; n++) {
			text += " "; //$NON-NLS-0$
			text += arguments[n];
		}
		console.appendChild(document.createTextNode(text));
		console.appendChild(util.createElement(document, "br")); //$NON-NLS-0$
		console.scrollTop = console.scrollHeight;
	}
	window.log = log;

	function getOptions() {
		return {
			readonly: bReadOnly.checked,
			fullSelection: bFullSel.checked,
			expandTab: bExpandTab.checked,
			tabSize: parseInt(sTabSize.value, 10),
			wrapMode: bWrap.checked,
			themeClass: sTheme.value
		};
	}
	
	function updateOptions() {
		var view = mSetup.view;
		var options = view.getOptions();
		bReadOnly.checked = options.readonly;
		bFullSel.checked = options.fullSelection;
		bWrap.checked = options.wrapMode;
		bExpandTab.checked = options.expandTab;
		sTabSize.value = options.tabSize;
		sTheme.value = options.themeClass;
	}

	function setOptions() {
		var view = mSetup.checkView(getOptions());
		view.focus();
		updateOptions();
	}

	function setupView(text, lang) {
		var view = mSetup.setupView(text, lang, getOptions());
		view.focus();
		updateOptions();
		return view;
	}
	
	function createJavaSample() {
		return setupView(mSetup.getFile("text.txt"), "java"); //$NON-NLS-1$ //$NON-NLS-0$
	}
	
	function createJavaScriptSample() {
		return setupView(mSetup.getFile("/orion/textview/textView.js"), "js"); //$NON-NLS-1$ //$NON-NLS-0$
	}

	function createHtmlSample() {
		return setupView(mSetup.getFile("/examples/textview/demo.html"), "html"); //$NON-NLS-1$ //$NON-NLS-0$
	}
	
	function createPlainTextSample() {
		var lineCount = 50000;
		var lines = [];
		for(var i = 0; i < lineCount; i++) {
			lines.push("This is the line of text number "+i); //$NON-NLS-0$
		}
		return setupView(lines.join("\r\n"), null); //$NON-NLS-0$
	}
	
	function createBidiTextSample() {
		var lines = [];
		lines.push("Hello \u0644\u0645\u0646\u0647"); //$NON-NLS-0$
		return setupView(lines.join(util.platformDelimiter), null);
	}
	
	function createLoad() {
		var text = tURLContent.value ? mSetup.getFile(tURLContent.value) : "";
		return setupView(text, sLangSelect.value);
	}

	function test() {
		log("test"); //$NON-NLS-0$
	}
	
	function performanceTest() {
		mTestPerformance[sPerform.value]();
	}
	
	/* Adding events */
	bCreateJava.onclick = createJavaSample;
	bCreateJS.onclick = createJavaScriptSample;
	bCreateHTML.onclick = createHtmlSample;
	bCreatePlain.onclick = createPlainTextSample;
	bCreateBidi.onclick = createBidiTextSample;
	bCreateLoad.onclick = createLoad;
	bSetOptions.onclick = setOptions;
	bClearLog.onclick = clearConsole;
	bHideLog.onclick = hideConsole;
	bTest.onclick = test;
	bPerform.onclick = performanceTest;
	var prefix = "test"; //$NON-NLS-0$
	mTestPerformance.noDojo = true;
	for (var property in mTestPerformance) {
		if (property.indexOf(prefix) === 0) {
			var option = util.createElement(document, "option"); //$NON-NLS-0$
			option.setAttribute("value", property); //$NON-NLS-0$
			option.appendChild(document.createTextNode(property.substring(prefix.length	)));
			sPerform.appendChild(option);
		}
	}
 });
