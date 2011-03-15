/*******************************************************************************
 * Copyright (c) 2011 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/

/*global orion */

orion.JSTestAdapter.runTests("All Tests", [
   	"http://localhost:8081/js-tests/commonjs-unittesting/test.html",
	"http://localhost:8081/js-tests/compare/test.html",
	"http://localhost:8081/js-tests/serviceRegistry/test.html",
	"http://localhost:8081/js-tests/preferences/test.html"
	/*"http://localhost:8081/js-tests/pluginRegistry/test.html",
	"http://localhost:8081/js-tests/testRunAsynch/test.html"*/
]);