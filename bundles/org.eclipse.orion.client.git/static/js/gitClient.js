/*******************************************************************************
 * Copyright (c) 2011 IBM Corporation and others All rights reserved. This
 * program and the accompanying materials are made available under the terms of
 * the Eclipse Public License v1.0 which accompanies this distribution, and is
 * available at http://www.eclipse.org/legal/epl-v10.html
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/

/** @namespace The global container for eclipse APIs. */
var eclipse = eclipse || {};

eclipse.GitService = (function() {
	/**
	 * @class Provides operations on Git.
	 * @name eclipse.GitService
	 */
	function GitService(serviceRegistry) {
		if (serviceRegistry) {
			this._serviceRegistry = serviceRegistry;
			this._serviceRegistration = serviceRegistry.registerService(
					"IGitService", this);
			var self = this;
			serviceRegistry.getService("ISshService").then(function(sshService){
				self._sshService = sshService;
			});
		}
	}

	GitService.prototype = /** @lends eclipse.GitService.prototype */
	{
		checkGitService : function() {
			var service = this;
			console.info("Git Service checked");
		},
		cloneGitRepository : function(gitName, gitRepoUrl, gitSshUsername, gitSshPassword, gitSshKnownHost, onLoad) {
			var service = this;
			if(gitSshKnownHost && gitSshKnownHost!=""){
				this._sshService.addKnownHosts(gitSshKnownHost);
			}
			this._sshService.getKnownHosts().then(function(knownHosts){
				dojo.xhrPost({
					url : "/git/clone/",
					headers : {
						"Orion-Version" : "1"
					},
					postData : dojo.toJson({
						"Name" : gitName,
						"GitUrl" : gitRepoUrl,
						"GitSshUsername" : gitSshUsername,
						"GitSshPassword" : gitSshPassword,
						"GitSshKnownHost" : knownHosts
					}),
					handleAs : "json",
					timeout : 15000,
					load : function(jsonData, secondArg) {
						if (onLoad) {
							if (typeof onLoad === "function")
								onLoad(jsonData, secondArg);
							else
								service._serviceRegistration.dispatchEvent(onLoad,
										jsonData);
						}
					},
					error : function(error, ioArgs) {
						handleGetAuthenticationError(this, ioArgs);
						console.error("HTTP status code: ", ioArgs.xhr.status);
					}
				});
			});
			
		},
		
		getDiffContent: function(diffURI , onLoad , onError){
			dojo.xhrGet({
				url: diffURI , 
				headers: {
					"Orion-Version": "1"
				},
				content: { "parts": "diff" },
				handleAs: "text",
				timeout: 15000,
				load: function(jsonData, secondArg) {
					if (onLoad) {
						if (typeof onLoad === "function")
							onLoad(jsonData, secondArg);
						else
							service._serviceRegistration.dispatchEvent(onLoad,
									jsonData);
					}
				},
				error: function(response, ioArgs) {
					if(onError)
						onError(response,ioArgs);
					handleGetAuthenticationError(this, ioArgs);
					return response;
				}
			});
		},
		
		getDiffFileURI: function(diffURI , onLoad , onError){
			dojo.xhrGet({
				url: diffURI , 
				headers: {
					"Orion-Version": "1"
				},
				content: { "parts": "uris" },
				handleAs: "json",
				timeout: 15000,
				load: function(jsonData, secondArg) {
					if (onLoad) {
						if (typeof onLoad === "function")
							onLoad(jsonData, secondArg);
						else
							service._serviceRegistration.dispatchEvent(onLoad,
									jsonData);
					}
				},
				error: function(response, ioArgs) {
					if(onError)
						onError(response,ioArgs);
					handleGetAuthenticationError(this, ioArgs);
					return response;
				}
			});
		},
		
		getDiffFileContent: function(fileURI ,  onLoad , onError ){
			dojo.xhrGet({
				url: fileURI , 
				headers: {
					"Orion-Version": "1"
				},
				handleAs: "text",
				timeout: 15000,
				load: function(jsonData, secondArg) {
					if (onLoad) {
						if (typeof onLoad === "function")
							onLoad(jsonData, secondArg);
						else
							service._serviceRegistration.dispatchEvent(onLoad,
									jsonData);
					}
				},
				error: function(response, ioArgs) {
					if(onError)
						onError(response,ioArgs);
					handleGetAuthenticationError(this, ioArgs);
					return response;
				}
			});
		},
		
		getGitStatus: function(url , onLoad , onError){
			dojo.xhrGet({
				url: url , 
				headers: {
					"Orion-Version": "1"
				},
				handleAs: "json",
				timeout: 15000,
				load: function(jsonData, secondArg) {
					if (onLoad) {
						if (typeof onLoad === "function")
							onLoad(jsonData, secondArg);
						else
							service._serviceRegistration.dispatchEvent(onLoad,
									jsonData);
					}
				},
				error: function(response, ioArgs) {
					if(onError)
						onError(response,ioArgs);
					handleGetAuthenticationError(this, ioArgs);
					return response;
				}
			});
		},
		
		stage: function(location , onLoad , onError){
			dojo.xhrPut({
				url: location , 
				headers: {
					"Orion-Version": "1"
				},
				handleAs: "json",
				timeout: 15000,
				load: function(jsonData, secondArg) {
					if (onLoad) {
						if (typeof onLoad === "function")
							onLoad(jsonData, secondArg);
						else
							service._serviceRegistration.dispatchEvent(onLoad,
									jsonData);
					}
				},
				error: function(response, ioArgs) {
					if(onError)
						onError(response,ioArgs);
					handleGetAuthenticationError(this, ioArgs);
					return response;
				}
			});
		},
		
		unstage: function(location , onLoad , onError){
			dojo.xhrPost({
				url: location , 
				headers: {
					"Orion-Version": "1"
				},
				handleAs: "json",
				timeout: 15000,
				postData: dojo.toJson({"Reset":"MIXED"} ),
				load: function(jsonData, secondArg) {
					if (onLoad) {
						if (typeof onLoad === "function")
							onLoad(jsonData, secondArg);
						else
							service._serviceRegistration.dispatchEvent(onLoad,
									jsonData);
					}
				},
				error: function(response, ioArgs) {
					if(onError)
						onError(response,ioArgs);
					handleGetAuthenticationError(this, ioArgs);
					return response;
				}
			});
		},
		
		commitAll: function(location , message , body ,  onLoad , onError){
			dojo.xhrPost({
				url: location , 
				headers: {
					"Orion-Version": "1"
				},
				handleAs: "json",
				timeout: 15000,
				postData: body,
				load: function(jsonData, secondArg) {
					if (onLoad) {
						if (typeof onLoad === "function")
							onLoad(jsonData, secondArg);
						else
							service._serviceRegistration.dispatchEvent(onLoad,
									jsonData);
					}
				},
				error: function(response, ioArgs) {
					if(onError)
						onError(response,ioArgs);
					handleGetAuthenticationError(this, ioArgs);
					return response;
				}
			});
		},
		
		getGitClone : function(gitCloneURI, onLoad) {
			var service = this;
			
			return dojo.xhrGet({
				url : gitCloneURI,
				headers : {
					"Orion-Version" : "1"
				},
				handleAs : "json",
				timeout : 5000,
				load : function(jsonData, secondArg) {
					if (onLoad) {
						if (typeof onLoad === "function")
							onLoad(jsonData, secondArg);
						else
							service._serviceRegistration.dispatchEvent(onLoad,
									jsonData);
					}
				},
				error : function(error, ioArgs) {
					handleGetAuthenticationError(this, ioArgs);
					console.error("HTTP status code: ", ioArgs.xhr.status);
				}
			});
		},
		doGitLog : function(gitDiffURI, onLoad) {
			var service = this;
			
			console.info("doGitLog called");
			
			dojo.xhrGet({
				url : gitDiffURI,
				headers : {
					"Orion-Version" : "1"
				},
				handleAs : "json",
				timeout : 5000,
				load : function(jsonData, secondArg) {
					if (onLoad) {
						if (typeof onLoad === "function")
							onLoad(jsonData, secondArg);
						else
							service._serviceRegistration.dispatchEvent(onLoad,
									jsonData);
					}
				},
				error : function(error, ioArgs) {
					handleGetAuthenticationError(this, ioArgs);
					console.error("HTTP status code: ", ioArgs.xhr.status);
				}
			});
		},
		getDiff : function(gitDiffURI, commitName, onLoad) {
			var service = this;
			
			console.info("getDiff called");
			
			dojo.xhrPost({
				url : gitDiffURI,
				headers : {
					"Orion-Version" : "1"
				},
				postData : dojo.toJson({
					"New" : commitName
				}),
				handleAs : "json",
				timeout : 5000,
				load : function(jsonData, secondArg) {
					if (onLoad) {
						if (typeof onLoad === "function")
							onLoad(jsonData, secondArg, secondArg);
						else
							service._serviceRegistration.dispatchEvent(onLoad,
									jsonData);
					}
				},
				error : function(error, ioArgs) {
					handleGetAuthenticationError(this, ioArgs);
					console.error("HTTP status code: ", ioArgs.xhr.status);
				}
			});
		}
	};
	return GitService;
}());
