/*******************************************************************************
 * @license
 * Copyright (c) 2012 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: 
 *		Felipe Heidrich (IBM Corporation) - initial API and implementation
 *		Silenio Quarti (IBM Corporation) - initial API and implementation
 ******************************************************************************/

//NLS_CHARSET=UTF-8

/*global define*/

define({
	"multipleAnnotations": "Multiple annotations:", //$NON-NLS-1$ //$NON-NLS-0$
	"line": "Line: ${0}", //$NON-NLS-1$ //$NON-NLS-0$
	"breakpoint": "Breakpoint", //$NON-NLS-1$ //$NON-NLS-0$
	"bookmark": "Bookmark", //$NON-NLS-1$ //$NON-NLS-0$
	"task": "Task", //$NON-NLS-1$ //$NON-NLS-0$
	"error": "Error", //$NON-NLS-1$ //$NON-NLS-0$
	"warning": "Warning", //$NON-NLS-1$ //$NON-NLS-0$
	"matchingSearch": "Matching Search", //$NON-NLS-1$ //$NON-NLS-0$
	"currentSearch": "Current Search", //$NON-NLS-1$ //$NON-NLS-0$
	"currentLine": "Current Line", //$NON-NLS-1$ //$NON-NLS-0$
	"matchingBracket": "Matching Bracket", //$NON-NLS-1$ //$NON-NLS-0$
	"currentBracket": "Current Bracket", //$NON-NLS-1$ //$NON-NLS-0$
	
	"lineUp": "Line Up", //$NON-NLS-1$ //$NON-NLS-0$
	"lineDown": "Line Down", //$NON-NLS-1$ //$NON-NLS-0$
	"lineStart": "Line Start", //$NON-NLS-1$ //$NON-NLS-0$
	"lineEnd": "Line End", //$NON-NLS-1$ //$NON-NLS-0$
	"charPrevious": "Previous Character", //$NON-NLS-1$ //$NON-NLS-0$
	"charNext": "Next Character", //$NON-NLS-1$ //$NON-NLS-0$
	"pageUp": "Page Up", //$NON-NLS-1$ //$NON-NLS-0$
	"pageDown": "Page Down", //$NON-NLS-1$ //$NON-NLS-0$
	"scrollPageUp": "Scroll Page Up", //$NON-NLS-1$ //$NON-NLS-0$
	"scrollPageDown": "Scroll Page Down", //$NON-NLS-1$ //$NON-NLS-0$
	"scrollLineUp": "Scroll Line Up", //$NON-NLS-1$ //$NON-NLS-0$
	"scrollLineDown": "Scroll Line Down", //$NON-NLS-1$ //$NON-NLS-0$
	"wordPrevious": "Previous Word", //$NON-NLS-1$ //$NON-NLS-0$
	"wordNext": "Next Word", //$NON-NLS-1$ //$NON-NLS-0$
	"textStart": "Document Start", //$NON-NLS-1$ //$NON-NLS-0$
	"textEnd": "Document End", //$NON-NLS-1$ //$NON-NLS-0$
	"scrollTextStart": "Scroll Document Start", //$NON-NLS-1$ //$NON-NLS-0$
	"scrollTextEnd": "Scroll Document End", //$NON-NLS-1$ //$NON-NLS-0$
	"centerLine": "Center Line", //$NON-NLS-1$ //$NON-NLS-0$
	
	"selectLineUp": "Select Line Up", //$NON-NLS-1$ //$NON-NLS-0$
	"selectLineDown": "Select Line Down", //$NON-NLS-1$ //$NON-NLS-0$
	"selectWholeLineUp": " Select Whole Line Up", //$NON-NLS-1$ //$NON-NLS-0$
	"selectWholeLineDown": "Select Whole Line Down", //$NON-NLS-1$ //$NON-NLS-0$
	"selectLineStart": "Select Line Start", //$NON-NLS-1$ //$NON-NLS-0$
	"selectLineEnd": "Select Line End", //$NON-NLS-1$ //$NON-NLS-0$
	"selectCharPrevious": "Select Previous Character", //$NON-NLS-1$ //$NON-NLS-0$
	"selectCharNext": "Select Next Character", //$NON-NLS-1$ //$NON-NLS-0$
	"selectPageUp": "Select Page Up", //$NON-NLS-1$ //$NON-NLS-0$
	"selectPageDown": "Select Page Down", //$NON-NLS-1$ //$NON-NLS-0$
	"selectWordPrevious": "Select Previous Word", //$NON-NLS-1$ //$NON-NLS-0$
	"selectWordNext": "Select Next Word", //$NON-NLS-1$ //$NON-NLS-0$
	"selectTextStart": "Select Document Start", //$NON-NLS-1$ //$NON-NLS-0$
	"selectTextEnd": "Select Document End", //$NON-NLS-1$ //$NON-NLS-0$

	"deletePrevious": "Delete Previous Character", //$NON-NLS-1$ //$NON-NLS-0$
	"deleteNext": "Delete Next Character", //$NON-NLS-1$ //$NON-NLS-0$
	"deleteWordPrevious": "Delete Previous Word", //$NON-NLS-1$ //$NON-NLS-0$
	"deleteWordNext": "Delete Next Word", //$NON-NLS-1$ //$NON-NLS-0$
	"deleteLineStart": "Delete Line Start", //$NON-NLS-1$ //$NON-NLS-0$
	"deleteLineEnd": "Delete Line End", //$NON-NLS-1$ //$NON-NLS-0$
	"tab": "Insert Tab", //$NON-NLS-1$ //$NON-NLS-0$
	"enter": "Insert Line Delimiter", //$NON-NLS-1$ //$NON-NLS-0$
	"enterNoCursor": "Insert Line Delimiter", //$NON-NLS-1$ //$NON-NLS-0$
	"selectAll": "Select All", //$NON-NLS-1$ //$NON-NLS-0$
	"copy": "Copy", //$NON-NLS-1$ //$NON-NLS-0$
	"cut": "Cut", //$NON-NLS-1$ //$NON-NLS-0$
	"paste": "Paste", //$NON-NLS-1$ //$NON-NLS-0$
	
	"toggleWrapMode": "Toggle Wrap Mode", //$NON-NLS-1$ //$NON-NLS-0$
	"toggleTabMode": "Toggle Tab Mode", //$NON-NLS-1$ //$NON-NLS-0$
	"toggleOverwriteMode": "Toggle Overwrite Mode", //$NON-NLS-1$ //$NON-NLS-0$
	
	//Emacs
	"emacs": "Emacs", //$NON-NLS-1$ //$NON-NLS-0$
	"exchangeMarkPoint": "Exchange Mark and Point", //$NON-NLS-1$ //$NON-NLS-0$
	"setMarkCommand": "Set Mark", //$NON-NLS-1$ //$NON-NLS-0$
	"clearMark": "Clear Mark", //$NON-NLS-1$ //$NON-NLS-0$
	"digitArgument": "Digit Argument ${0}", //$NON-NLS-1$ //$NON-NLS-0$
	"negativeArgument": "Negative Argument", //$NON-NLS-1$ //$NON-NLS-0$
			
	"Comment": "Comment", //$NON-NLS-1$ //$NON-NLS-0$
	"Flat outline": "Flat outline", //$NON-NLS-1$ //$NON-NLS-0$
	"incrementalFindStr": "Incremental find: ${0}", //$NON-NLS-1$ //$NON-NLS-0$
	"incrementalFindStrNotFound": "Incremental find: ${0} (not found)", //$NON-NLS-1$ //$NON-NLS-0$
	"incrementalFindReverseStr": "Reverse Incremental find: ${0}", //$NON-NLS-1$ //$NON-NLS-0$
	"incrementalFindReverseStrNotFound": "Reverse Incremental find: ${0} (not found)", //$NON-NLS-1$ //$NON-NLS-0$
	"find": "Find...", //$NON-NLS-1$ //$NON-NLS-0$
	"undo": "Undo", //$NON-NLS-1$ //$NON-NLS-0$
	"redo": "Redo", //$NON-NLS-1$ //$NON-NLS-0$
	"cancelMode": "Cancel Current Mode", //$NON-NLS-1$ //$NON-NLS-0$
	"findNext": "Find Next Occurrence", //$NON-NLS-1$ //$NON-NLS-0$
	"findPrevious": "Find Previous Occurrence", //$NON-NLS-1$ //$NON-NLS-0$
	"incrementalFind": "Incremental Find", //$NON-NLS-1$ //$NON-NLS-0$
	"incrementalFindReverse": "Incremental Find Reverse", //$NON-NLS-1$ //$NON-NLS-0$
	"indentLines": "Indent Lines", //$NON-NLS-1$ //$NON-NLS-0$
	"unindentLines": "Unindent Lines", //$NON-NLS-1$ //$NON-NLS-0$
	"moveLinesUp": "Move Lines Up", //$NON-NLS-1$ //$NON-NLS-0$
	"moveLinesDown": "Move Lines Down", //$NON-NLS-1$ //$NON-NLS-0$
	"copyLinesUp": "Copy Lines Up", //$NON-NLS-1$ //$NON-NLS-0$
	"copyLinesDown": "Copy Lines Down", //$NON-NLS-1$ //$NON-NLS-0$
	"deleteLines": "Delete Lines", //$NON-NLS-1$ //$NON-NLS-0$
	"gotoLine": "Goto Line...", //$NON-NLS-1$ //$NON-NLS-0$
	"gotoLinePrompty": "Goto Line:", //$NON-NLS-1$ //$NON-NLS-0$
	"nextAnnotation": "Next Annotation", //$NON-NLS-1$ //$NON-NLS-0$
	"prevAnnotation": "Previous Annotation", //$NON-NLS-1$ //$NON-NLS-0$
	"expand": "Expand", //$NON-NLS-1$ //$NON-NLS-0$
	"collapse": "Collapse", //$NON-NLS-1$ //$NON-NLS-0$
	"expandAll": "Expand All", //$NON-NLS-1$ //$NON-NLS-0$
	"collapseAll": "Collapse All", //$NON-NLS-1$ //$NON-NLS-0$
	"lastEdit": "Last Edit Location", //$NON-NLS-1$ //$NON-NLS-0$
	"toggleLineComment": "Toggle Line Comment", //$NON-NLS-1$ //$NON-NLS-0$
	"addBlockComment": "Add Block Comment", //$NON-NLS-1$ //$NON-NLS-0$
	"removeBlockComment": "Remove Block Comment", //$NON-NLS-1$ //$NON-NLS-0$
	"linkedModeEntered": "Linked Mode entered", //$NON-NLS-1$ //$NON-NLS-0$
	"linkedModeExited": "Linked Mode exited", //$NON-NLS-1$ //$NON-NLS-0$
	"syntaxError": "Syntax Error", //$NON-NLS-1$ //$NON-NLS-0$
	"contentAssist": "Content Assist", //$NON-NLS-1$ //$NON-NLS-0$
	"lineColumn": "Line ${0} : Col ${1}", //$NON-NLS-1$ //$NON-NLS-0$
	
	"replaceAll": "Replacing all...", //$NON-NLS-1$ //$NON-NLS-0$
	"replacedMatches": "Replaced ${0} matches", //$NON-NLS-1$ //$NON-NLS-0$
	"nothingReplaced": "Nothing replaced", //$NON-NLS-1$ //$NON-NLS-0$
	"notFound": "Not found" //$NON-NLS-1$ //$NON-NLS-0$
});