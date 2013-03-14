/*******************************************************************************
 * @license
 * Copyright (c) 2013 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/
/*global window document define orion*/
	
define(["orion/bootstrap", "orion/xhr", "orion/Deferred", "orion/plugin", "domReady!"], function(mBootstrap, xhr, Deferred) {

	mBootstrap.startup().then(
		function(core) {

			var headers = {
					name : "Orion NPM",
					version : "1.0",
					description : "Orion NPM"
				};

			var provider = new orion.PluginProvider(headers);

			/** Register parent NPM root command **/
		    provider.registerServiceProvider(
		        "orion.shell.command", null, {
		        name: "npm",
		        description: "Commands for interacting with node npm"
		    });


		    /** Add npm shrinkwrap command **/
		    var shrinkwrapImpl = {
		        callback: function(args, cwd) {
		            args.cwd = cwd.cwd;
		            args.type = "shrinkwrap";
		            var d = xhr("POST", "/npm", { //$NON-NLS-0$
		                headers: {
		                    "Orion-Version": "1" //$NON-NLS-0$
		                },
		                data: JSON.stringify(args),
		                timeout: 15000
		            }).then(
		            function(result) {
		                var res = JSON.parse(result.response);
		                return res.cmdOutput;
		            }, function(error) {
						var err = JSON.parse(error.response);
		                return err.Message;
		            });
		            return d;
		        }
		    };
		    provider.registerServiceProvider(
		        "orion.shell.command",
		    shrinkwrapImpl, {
		        name: "npm shrinkwrap",
		        description: "npm shrinkwrap",
		        parameters: null
		    });
		    
		    /** Add npm install command **/
		    var installImpl = {
		        callback: function(args, cwd) {
		            args.cwd = cwd.cwd;
		            args.type = "install";
		            var d = xhr("POST", "/npm", { //$NON-NLS-0$
		                headers: {
		                    "Orion-Version": "1" //$NON-NLS-0$
		                },
		                data: JSON.stringify(args),
		                timeout: 15000
		            }).then(
		            function(result) {
		                var res = JSON.parse(result.response);
		                return res.cmdOutput;
		            }, function(error) {
						var err = JSON.parse(error.response);
		                return err.Message;
		            });
		            return d;
		        }
		    };
		    provider.registerServiceProvider(
		        "orion.shell.command",
		    installImpl, {
		        name: "npm install",
		        description: "npm install",
		        parameters: [{
		            name: "package",
		            type: "string",
		            description: "package to install",
		            defaultValue: null		            
		        }]
		    });
		    
		    provider.connect();		
		}
	);
});