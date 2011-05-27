/*******************************************************************************
 * Copyright (c) 2010, 2011 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/

define([], function() {

var eclipse = eclipse || {};

eclipse.ProblemService = function(serviceRegistry) {
	this._serviceRegistry = serviceRegistry;
	this._serviceRegistration = serviceRegistry.registerService("orion.core.marker", this);

};

eclipse.ProblemService.prototype = {
	// provider
	_setProblems: function(problems) {
		this.problems = problems;
		this._serviceRegistration.dispatchEvent("problemsChanged", problems);

	}	    
};

return eclipse;	
});

