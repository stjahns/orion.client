/*******************************************************************************
 * @license
 * Copyright (c) 2012 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 *
 * Contributors: IBM Corporation - initial API and implementation
 *******************************************************************************/

/*global define*/
define(['require' ,'orion/Deferred'], function(require, Deferred) {

	function formatMessage(msg) {
		var args = arguments;
		return msg.replace(/\$\{([^\}]+)\}/g, function(str, index) { return args[(index << 0) + 1]; });
	}

	function getMessageBundle(name){
		var d = new Deferred();
		require(['orion/i18n!' + name], function() { //$NON-NLS-0$
			require(['i18n!' + name], function(bundle) { //$NON-NLS-0$
				d.resolve(bundle);
			});
		});
		return d;
	}
	return {
		getMessageBundle: getMessageBundle,
		formatMessage: formatMessage
	};
});