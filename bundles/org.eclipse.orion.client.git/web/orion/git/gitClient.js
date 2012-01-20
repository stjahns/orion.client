/******************************************************************************* 
 * @license
 * Copyright (c) 2011 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/

/*global define console */

/** @namespace The global container for eclipse APIs. */

define(['require', 'dojo', 'orion/auth'], function(require, dojo, mAuth) {

var eclipse = eclipse || {};

eclipse.GitService = (function() {
	/**
	 * Creates a new Git service.
	 * @class Provides operations for browsing and manipulating Git repositories.
	 * @name orion.git.GitService
	 */
	function GitService(serviceRegistry) {
		if (serviceRegistry) {
			this._serviceRegistry = serviceRegistry;
			this._serviceRegistration = serviceRegistry.registerService(
					"orion.git.provider", this);
			this._sshService = serviceRegistry.getService("orion.net.ssh");
		}
	}

	GitService.prototype = /** @lends eclipse.GitService.prototype */
	{
		checkGitService : function() {
			var service = this;
		},
		cloneGitRepository : function(gitName, gitRepoUrl, targetPath, repoLocation, gitSshUsername, gitSshPassword, gitSshKnownHost, privateKey, passphrase) {
			var service = this;
			var postData = {};
			if(gitName){
				postData.Name = gitName;
			}
			if(targetPath){
				postData.Path = targetPath;
			}
			if(gitRepoUrl){
				postData.GitUrl=gitRepoUrl;
			}
			postData.Location = repoLocation;
			if(gitSshUsername){
				postData.GitSshUsername = gitSshUsername;
			}
			if(gitSshPassword){
				postData.GitSshPassword = gitSshPassword;
			}
			if(gitSshKnownHost){
				postData.GitSshKnownHost = gitSshKnownHost;
			}
			if(privateKey) postData.GitSshPrivateKey=privateKey;
			if(passphrase) postData.GitSshPassphrase=passphrase;			
			
			//NOTE: require.toURL needs special logic here to handle "gitapi/clone"
			var gitapiCloneUrl = require.toUrl("gitapi/clone/._");
			gitapiCloneUrl = gitapiCloneUrl.substring(0,gitapiCloneUrl.length-2);
			
			return dojo.xhrPost({
				url : gitapiCloneUrl,
				headers : {
					"Orion-Version" : "1"
				},
				postData : dojo.toJson(postData),
				handleAs : "json",
				timeout : 15000,
				load : function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, gitRepoUrl ? "Cloning repository: " + gitRepoUrl : "Initializing repository: " + gitName);
				},
				error : function(error, ioArgs) {
					var error =	mAuth.handleAuthenticationError(ioArgs.xhr, function(){});
					if(error!=null)
						return error;
					console.error("HTTP status code: ", ioArgs.xhr.status);
				}
			});
			
		},
		removeGitRepository : function(repositoryLocation){
			var service = this;
			return dojo.xhrDelete({
				url : repositoryLocation,
				headers : {
					"Orion-Version" : "1"
				},
				handleAs : "json",
				timeout : 5000,
				load : function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, "Removing repository");
				},
				error : function(error, ioArgs) {
					var error =	mAuth.handleAuthenticationError(ioArgs.xhr, function(){});
					if(error!=null)
						return error;
					console.error("HTTP status code: ", ioArgs.xhr.status);
				}
			});
		},
		getDiffContent: function(diffURI , onLoad , onError){
			var service = this;
			dojo.xhrGet({
				url: diffURI , 
				headers: {
					"Orion-Version": "1"
				},
				content: { "parts": "diff" },
				handleAs: "text",
				timeout: 15000,
				load: function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, "Getting git diff", onLoad, onError);
				},
				error: function(response, ioArgs) {
					if(onError)
						onError(response,ioArgs);
					var currentXHR = this;
					mAuth.handleAuthenticationError(ioArgs.xhr, function(){
						dojo.xhrGet(currentXHR); // retry GET							
					});
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
				load: function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, "Getting git diff", onLoad, onError);
				},
				error: function(response, ioArgs) {
					if(onError)
						onError(response,ioArgs);
					var currentXHR = this;
					mAuth.handleAuthenticationError(ioArgs.xhr, function(){
						dojo.xhrGet(currentXHR); // retry GET							
					});
					return response;
				}
			});
		},
		getGitStatus: function(url , onLoad , onError){
			var service = this;
			dojo.xhrGet({
				url: url , 
				headers: {
					"Orion-Version": "1"
				},
				handleAs: "json",
				timeout: 15000,
				load: function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, "Getting git status", onLoad, onError);
				},
				error: function(response, ioArgs) {
					if(onError)
						onError(response,ioArgs);
					var currentXHR = this;
					mAuth.handleAuthenticationError(ioArgs.xhr, function(){
						dojo.xhrGet(currentXHR); // retry GET							
					});
					return response;
				}
			});
		},
		stage: function(location , onLoad , onError){
			var service = this;
			return dojo.xhrPut({
				url: location , 
				headers: {
					"Orion-Version": "1"
				},
				handleAs: "json",
				timeout: 15000,
				load: function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, "Staging", onLoad, onError);
				},
				error: function(response, ioArgs) {
					if(onError) {
						onError(response,ioArgs);
					}
					mAuth.handleAuthenticationError(ioArgs.xhr, function(){});
				}
			});
		},
		stageMultipleFiles: function(gitCloneURI, paths , onLoad , onError){
			var service = this;
			return dojo.xhrPut({
				url: gitCloneURI , 
				headers: {
					"Orion-Version": "1"
				},
				putData : dojo.toJson({
					"Path" : paths
				}),
				handleAs: "json",
				timeout: 15000,
				load: function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, "Staging", onLoad, onError);
				},
				error: function(response, ioArgs) {
					if(onError)
						onError(response,ioArgs);
					mAuth.handleAuthenticationError(ioArgs.xhr, function(){});
					return response;
				}
			});
		},
		unstageAll: function(location , resetParam ,onLoad , onError){
			var service = this;
			return dojo.xhrPost({
				url: location , 
				headers: {
					"Orion-Version": "1"
				},
				handleAs: "json",
				timeout: 15000,
				postData: dojo.toJson({"Reset":resetParam} ),
				load: function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, "Unstaging", onLoad, onError);
				},
				error: function(response, ioArgs) {
					if(onError)
						onError(response,ioArgs);
					mAuth.handleAuthenticationError(ioArgs.xhr, function(){});
					return response;
				}
			});
		},
		unstage: function(location , paths ,onLoad , onError){
			var service = this;
			return dojo.xhrPost({
				url: location , 
				headers: {
					"Orion-Version": "1"
				},
				handleAs: "json",
				timeout: 15000,
				postData: dojo.toJson({"Path" : paths} ),
				load: function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, "Unstaging", onLoad, onError);
				},
				error: function(response, ioArgs) {
					if(onError)
						onError(response,ioArgs);
					mAuth.handleAuthenticationError(ioArgs.xhr, function(){});
					return response;
				}
			});
		},
		checkoutPath: function(gitCloneURI, paths , onLoad , onError){
			var service = this;
			return dojo.xhrPut({
				url : gitCloneURI,
				headers : {
					"Orion-Version" : "1"
				},
				putData : dojo.toJson({
					"Path" : paths,
					"RemoveUntracked" : "true"
				}),
				handleAs: "json",
				timeout: 15000,
				load: function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, "Checking out", onLoad, onError);
				},
				error: function(response, ioArgs) {
					if(onError)
						onError(response,ioArgs);
					mAuth.handleAuthenticationError(ioArgs.xhr, function(){});
					return response;
				}
			});
		},
		commitAll: function(location , message , body ,  onLoad , onError){
			var service = this;
			dojo.xhrPost({
				url: location , 
				headers: {
					"Orion-Version": "1"
				},
				handleAs: "json",
				timeout: 15000,
				postData: body,
				load: function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, "Committing", onLoad, onError);
				},
				error: function(response, ioArgs) {
					if(onError)
						onError(response,ioArgs);
					mAuth.handleAuthenticationError(ioArgs.xhr, function(){});
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
				load : function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, "Getting git repository information", onLoad);
				},
				error : function(error, ioArgs) {
					var currentXHR = this;
					mAuth.handleAuthenticationError(ioArgs.xhr, function(){
						dojo.xhrGet(currentXHR); // retry GET							
					});
					console.error("HTTP status code: ", ioArgs.xhr.status);
				}
			});
		},
		getGitCloneConfig : function(gitCloneConfigURI) {
			var service = this;
			return dojo.xhrGet({
				url : gitCloneConfigURI,
				headers : {
					"Orion-Version" : "1"
				},
				handleAs : "json",
				timeout : 5000,
				load : function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, "Getting git repository configuration");
				},
				error : function(error, ioArgs) {
					var currentXHR = this;
					mAuth.handleAuthenticationError(ioArgs.xhr, function(){
						dojo.xhrGet(currentXHR); // retry GET							
					});
					console.error("HTTP status code: ", ioArgs.xhr.status);
				}
			});
		},
		getGitBranch : function(gitBranchURI) {
			var service = this;
			return dojo.xhrGet({
				url : gitBranchURI,
				headers : {
					"Orion-Version" : "1"
				},
				handleAs : "json",
				timeout : 5000,
				load : function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, "Getting branch information");
				},
				error : function(error, ioArgs) {
					var currentXHR = this;
					mAuth.handleAuthenticationError(ioArgs.xhr, function(){
						dojo.xhrGet(currentXHR); // retry GET							
					});
					console.error("HTTP status code: ", ioArgs.xhr.status);
				}
			});
		},
		getGitRemote : function(gitRemoteURI) {
			var service = this;
			return dojo.xhrGet({
				url : gitRemoteURI,
				headers : {
					"Orion-Version" : "1"
				},
				handleAs : "json",
				timeout : 5000,
				load : function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, "Getting remote branch information");
				},
				error : function(error, ioArgs) {
					var currentXHR = this;
					mAuth.handleAuthenticationError(ioArgs.xhr, function(){
						dojo.xhrGet(currentXHR); // retry GET							
					});
					console.error("HTTP status code: ", ioArgs.xhr.status);
				}
			});
		},
		checkoutBranch : function(gitCloneURI, branchName) {
			var service = this;
			return dojo.xhrPut({
				url : gitCloneURI,
				headers : {
					"Orion-Version" : "1"
				},
				putData : dojo.toJson({
					"Branch" : branchName
				}),
				handleAs : "json",
				timeout : 5000,
				load : function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, branchName ? "Checking out branch " + branchName: "Checking out branch");
				},
				error : function(error, ioArgs) {
					var error =	mAuth.handleAuthenticationError(ioArgs.xhr, function(){});
					if(error!=null)
						return error;
					console.error("HTTP status code: ", ioArgs.xhr.status);
				}
			});
		},
		resetIndex : function(gitIndexURI, refId) {
			var service = this;
			return dojo.xhrPost({
				url : gitIndexURI,
				headers : {
					"Orion-Version" : "1"
				},
				postData : dojo.toJson({
					"Commit" : refId,
					"Reset" : "HARD"
				}),
				handleAs : "json",
				timeout : 5000,
				load : function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, "Resetting index");
				},
				error : function(error, ioArgs) {
					var error =	mAuth.handleAuthenticationError(ioArgs.xhr, function(){});
					if(error!=null)
						return error;
					console.error("HTTP status code: ", ioArgs.xhr.status);
				}
			});
		},
		addBranch : function(gitBranchParentURI, branchName, startPoint) {
			var service = this;
			
			var postData = {};
			if (branchName) postData.Name = branchName;
			if (startPoint) postData.Branch = startPoint;
			
			return dojo.xhrPost({
				url : gitBranchParentURI,
				headers : {
					"Orion-Version" : "1"
				},
				postData : dojo.toJson(postData),
				handleAs : "json",
				timeout : 5000,
				load : function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, branchName ? "Adding branch " + branchName: "Adding branch");
				},
				error : function(error, ioArgs) {
					var error =	mAuth.handleAuthenticationError(ioArgs.xhr, function(){});
					if(error!=null)
						return error;
					console.error("HTTP status code: ", ioArgs.xhr.status);
				}
			});
		},
		removeBranch : function(gitBranchURI) {
			var service = this;
			return dojo.xhrDelete({
				url : gitBranchURI,
				headers : {
					"Orion-Version" : "1"
				},
				handleAs : "json",
				timeout : 5000,
				load : function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, "Removing branch");
				},
				error : function(error, ioArgs) {
					var error =	mAuth.handleAuthenticationError(ioArgs.xhr, function(){});
					if(error!=null)
						return error;
					console.error("HTTP status code: ", ioArgs.xhr.status);
				}
			});
		},
		addRemote : function(gitRemoteParentURI, remoteName, remoteURI) {
			var service = this;
			return dojo.xhrPost({
				url : gitRemoteParentURI,
				headers : {
					"Orion-Version" : "1"
				},
				putData : dojo.toJson({
					"Remote" : remoteName,
					"RemoteURI" : remoteURI
				}),
				handleAs : "json",
				timeout : 5000,
				load : function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, remoteName ? "Adding remote " + remoteName : "Adding remote");
				},
				error : function(error, ioArgs) {
					var error =	mAuth.handleAuthenticationError(ioArgs.xhr, function(){});
					if(error!=null)
						return error;
					console.error("HTTP status code: ", ioArgs.xhr.status);
				}
			});
		},
		removeRemote : function(gitRemoteURI) {
			var service = this;
			return dojo.xhrDelete({
				url : gitRemoteURI,
				headers : {
					"Orion-Version" : "1"
				},
				handleAs : "json",
				timeout : 5000,
				load : function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, "Removing remote");
				},
				error : function(error, ioArgs) {
					var error =	mAuth.handleAuthenticationError(ioArgs.xhr, function(){});
					if(error!=null)
						return error;
					console.error("HTTP status code: ", ioArgs.xhr.status);
				}
			});
		},
		doGitLog : function(gitLogURI, onLoad) {
			var service = this;
						
			return dojo.xhrGet({
				url : gitLogURI,
				headers : {
					"Orion-Version" : "1"
				},
				handleAs : "json",
				timeout : 5000,
				load : function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, "Getting git log", onLoad);
				},
				error : function(error, ioArgs) {
					var currentXHR = this;
					mAuth.handleAuthenticationError(ioArgs.xhr, function(){
						dojo.xhrGet(currentXHR); // retry GET							
					});
					console.error("HTTP status code: ", ioArgs.xhr.status);
				}
			});
		},
		getDiff : function(gitDiffURI, commitName, onLoad) {
			var service = this;
			
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
				load : function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, commitName ? "Getting git diff for " + commitName: "Getting git diff", onLoad);
				},
				error : function(error, ioArgs) {
					var currentXHR = this;
					mAuth.handleAuthenticationError(ioArgs.xhr, function(){
						dojo.xhrGet(currentXHR); // retry GET							
					});
					console.error("HTTP status code: ", ioArgs.xhr.status);
				}
			});
		},
		doFetch : function(gitRemoteBranchURI, force, onLoad, gitSshUsername, gitSshPassword, gitSshKnownHost, gitPrivateKey, gitPassphrase) {
			var service = this;
			return dojo.xhrPost({
				url : gitRemoteBranchURI,
				headers : {
					"Orion-Version" : "1"
				},
				postData : dojo.toJson({
					"Fetch" : "true",
					"Force" : force,
					"GitSshUsername" : gitSshUsername,
					"GitSshPassword" : gitSshPassword,
					"GitSshKnownHost" : gitSshKnownHost,
					"GitSshPrivateKey" : gitPrivateKey,
					"GitSshPassphrase" : gitPassphrase
				}),
				handleAs : "json",
				timeout : 5000,
				load : function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, "Fetching remote: " + gitRemoteBranchURI, onLoad);
				},
				error : function(error, ioArgs) {
					var error =	mAuth.handleAuthenticationError(ioArgs.xhr, function(){});
					if(error!=null)
						return error;
					console.error("HTTP status code: ", ioArgs.xhr.status);
				}
			});
		},
		doPull : function(gitCloneURI, force, onLoad, gitSshUsername, gitSshPassword, gitSshKnownHost, gitPrivateKey, gitPassphrase) {
			var service = this;
			return dojo.xhrPost({
				url : gitCloneURI,
				headers : {
					"Orion-Version" : "1"
				},
				postData : dojo.toJson({
					"Pull" : "true",
					"Force" : force,
					"GitSshUsername" : gitSshUsername,
					"GitSshPassword" : gitSshPassword,
					"GitSshKnownHost" : gitSshKnownHost,
					"GitSshPrivateKey" : gitPrivateKey,
					"GitSshPassphrase" : gitPassphrase
				}),
				handleAs : "json",
				timeout : 5000,
				load : function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, "Pulling : " + gitCloneURI, onLoad);
				},
				error : function(error, ioArgs) {
					var error =	mAuth.handleAuthenticationError(ioArgs.xhr, function(){});
					if(error!=null)
						return error;
					console.error("HTTP status code: ", ioArgs.xhr.status);
				}
			});
		},
		doMerge : function(gitHeadURI, commitName) {
			var service = this;
			return dojo.xhrPost({
				url : gitHeadURI,
				headers : {
					"Orion-Version" : "1"
				},
				postData : dojo.toJson({
					"Merge" : commitName
				}),
				handleAs : "json",
				timeout : 5000,
				load : function(jsonData, xhrArgs) {
					var mergeResult = dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, "Merging " + gitHeadURI);
					if(mergeResult.than){
						return mergeResult.than(function(jsonData){
							return {jsonData: jsonData};
						});
					} else {
						return {jsonData: mergeResult};
					}
				},
				error : function(error, ioArgs) {
					var error =	mAuth.handleAuthenticationError(ioArgs.xhr, function(){});
					console.error("HTTP status code: ", ioArgs.xhr.status);
					return {error: error, ioArgs: ioArgs};
				}
			});
		},
		doCherryPick : function(gitHeadURI, commitName, onLoad, onError) {
			var service = this;
			
			return dojo.xhrPost({
				url : gitHeadURI,
				headers : {
					"Orion-Version" : "1"
				},
				postData : dojo.toJson({
					"Cherry-Pick" : commitName
				}),
				handleAs : "json",
				timeout : 5000,
				load : function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, "Cherry pick of " + commitName, onLoad, onError);
				},
				error : function(error, ioArgs) {
					if(onError)
						onError(error, ioArgs);
					var error =	mAuth.handleAuthenticationError(ioArgs.xhr, function(){});
					console.error("HTTP status code: ", ioArgs.xhr.status);
					return {error: error, ioArgs: ioArgs};
				}
			});
		},
		doRebase : function(gitHeadURI, commitName, operation, onLoad, onError) {
			var service = this;
			var postData = {};
			postData.Rebase = commitName;
			if (operation) postData.Operation = operation;
			
			return dojo.xhrPost({
				url : gitHeadURI,
				headers : {
					"Orion-Version" : "1"
				},
				postData : dojo.toJson(postData),
				handleAs : "json",
				timeout : 5000,
				load : function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, commitName ? "Rebase on top of " : "Rebase" + commitName, onLoad, onError);
				},
				error : function(error, ioArgs) {
					if(onError)
						onError(error, ioArgs);
					error = mAuth.handleAuthenticationError(ioArgs.xhr, function(){});
					console.error("HTTP status code: ", ioArgs.xhr.status);
					return {error: error, ioArgs: ioArgs};
				}
			});
		},
		doPush : function(gitBranchURI, srcRef, tags, force, onLoad, message, gitSshUsername, gitSshPassword, gitSshKnownHost, gitPrivateKey, gitPassphrase) {
			var service = this;
			
			return dojo.xhrPost({
				url : gitBranchURI,
				headers : {
					"Orion-Version" : "1"
				},
				postData : dojo.toJson({
					"PushSrcRef" : srcRef,
					"PushTags" : tags,
					"Force" : force,
					"GitSshUsername" : gitSshUsername,
					"GitSshPassword" : gitSshPassword,
					"GitSshKnownHost" : gitSshKnownHost,
					"GitSshPrivateKey" : gitPrivateKey,
					"GitSshPassphrase" : gitPassphrase
				}),
				handleAs : "json",
				timeout : 5000,
				load : function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, message ? message : "Pushing repository");
				},
				error : function(error, ioArgs) {
					var error =	mAuth.handleAuthenticationError(ioArgs.xhr, function(){});
					if(error!=null)
						return error;
					console.error("HTTP status code: ", ioArgs.xhr.status);
				}
			});
		},
		getLog : function(gitCommitURI, commitName, message, onLoad) {
			var service = this;
			
			return dojo.xhrPost({
				url : gitCommitURI,
				headers : {
					"Orion-Version" : "1"
				},
				postData : dojo.toJson({
					"New" : commitName
				}),
				handleAs : "json",
				timeout : 5000,
				load : function(jsonData, xhrArgs) {
					return xhrArgs.xhr.getResponseHeader("Location"); //TODO bug 367344
				},
				error : function(error, ioArgs) {
					var error =	mAuth.handleAuthenticationError(ioArgs.xhr, function(){});
					if(error!=null)
						return error;
					console.error("HTTP status code: ", ioArgs.xhr.status);
				}
			}).then(function(scopedGitCommitURI){
				dojo.xhrGet({
					url : scopedGitCommitURI,
					headers : {
						"Orion-Version" : "1"
					},
					handleAs : "json",
					timeout : 5000,
					load : function(jsonData, xhrArgs) {
						return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, message ? message : "Generating git log", onLoad);
					},
					error : function(error, ioArgs) {
						var currentXHR = this;
						mAuth.handleAuthenticationError(ioArgs.xhr, function(){
							dojo.xhrGet(currentXHR); // retry GET							
						});
						console.error("HTTP status code: ", ioArgs.xhr.status);
					}
				});
			});	
		},
		getDefaultRemoteBranch : function(gitRemoteURI, onLoad) {
			var service = this;
			
			dojo.xhrGet({
				url : gitRemoteURI,
				headers : {
					"Orion-Version" : "1"
				},
				handleAs : "json",
				timeout : 5000,
				load : function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, "Getting remote branches");
				},
				error : function(error, ioArgs) {
					var currentXHR = this;
					mAuth.handleAuthenticationError(ioArgs.xhr, function(){
						dojo.xhrGet(currentXHR); // retry GET							
					});
					console.error("HTTP status code: ", ioArgs.xhr.status);
				}
			}).then(function(remoteJsonData){
				if (remoteJsonData.Children[0] == null)
					return null;
				
				dojo.xhrGet({
					url : remoteJsonData.Children[0].Location,
					headers : {
						"Orion-Version" : "1"
					},
					handleAs : "json",
					timeout : 5000,
					load : function(jsonData, xhrArgs) {
						return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, "Getting default remote branch", onLoad);
					},
					error : function(error, ioArgs) {
						var currentXHR = this;
						mAuth.handleAuthenticationError(ioArgs.xhr, function(){
							dojo.xhrGet(currentXHR); // retry GET							
						});
						console.error("HTTP status code: ", ioArgs.xhr.status);
					}
				});
			});	
		},
		doAddTag : function(gitCommitURI, tagName, onLoad) {
			var service = this;
			
			return dojo.xhrPut({
				url : gitCommitURI,
				headers : { "Orion-Version" : "1" },
				putData : dojo.toJson({ "Name" : tagName }),
				handleAs : "json",
				timeout : 5000,
				load : function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, "Adding tag ..." + tagName, onLoad);
				},
				error : function(error, ioArgs) {
					var error =	mAuth.handleAuthenticationError(ioArgs.xhr, function(){});
					if(error!=null)
						return error;
					console.error("HTTP status code: ", ioArgs.xhr.status);
				}
			});
		},
		doRemoveTag : function(gitTagURI) {
			var service = this;
			return dojo.xhrDelete({
				url : gitTagURI,
				headers : { "Orion-Version" : "1" },
				handleAs : "json",
				timeout : 5000,
				load : function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, "Removing tag ...");
				},
				error : function(error, ioArgs) {
					var error =	mAuth.handleAuthenticationError(ioArgs.xhr, function(){});
					if(error!=null)
						return error;
					console.error("HTTP status code: ", ioArgs.xhr.status);
				}
			});
		},
		checkoutTag : function(gitCloneURI, tag, branchName, onLoad, onError){
			var service = this;
			return dojo.xhrPut({
				url : gitCloneURI,
				headers : {
					"Orion-Version" : "1"
				},
				putData : dojo.toJson({
					"Tag" : tag,
					"Branch" : branchName
				}),
				handleAs : "json",
				timeout : 5000,
				load : function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, "Checking out tag " + tag, onLoad, onError);
				},
				error : function(error, ioArgs) {
					var error =	mAuth.handleAuthenticationError(ioArgs.xhr, function(){});
					if(error!=null)
						return error;
					console.error("HTTP status code: ", ioArgs.xhr.status);
				}
			});
		},
		addCloneConfigurationProperty: function(location, newKey, newValue, onLoad , onError){
			var service = this;
			return dojo.xhrPost({
				url: location , 
				headers: {
					"Orion-Version": "1"
				},
				postData : dojo.toJson({
					"Key" : newKey,
					"Value" : newValue
				}),
				handleAs: "json",
				timeout: 15000,
				load: function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, "Adding configuration property " + newKey, onLoad, onError);
				},
				error: function(response, ioArgs) {
					if(onError)
						onError(response,ioArgs);
					var error =	mAuth.handleAuthenticationError(ioArgs.xhr, function(){});
					if(error!=null)
						return error;
					console.error("HTTP status code: ", ioArgs.xhr.status);
				}
			});
		},
		editCloneConfigurationProperty: function(location, newValue, onLoad , onError){
			var service = this;
			return dojo.xhrPut({
				url: location , 
				headers: {
					"Orion-Version": "1"
				},
				putData : dojo.toJson({
					"Value" : newValue
				}),
				handleAs: "json",
				timeout: 15000,
				load: function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, "Saving configuration property as " + newValue, onLoad, onError);
				},
				error: function(response, ioArgs) {
					if(onError)
						onError(response,ioArgs);
					var error =	mAuth.handleAuthenticationError(ioArgs.xhr, function(){});
					if(error!=null)
						return error;
					console.error("HTTP status code: ", ioArgs.xhr.status);
				}
			});
		},
		deleteCloneConfigurationProperty: function(location, onLoad , onError){
			var service = this;
			return dojo.xhrDelete({
				url: location , 
				headers: {
					"Orion-Version": "1"
				},
				handleAs: "json",
				timeout: 15000,
				load: function(jsonData, xhrArgs) {
					return dojo.hitch(service, service._getGitServiceResponse)(jsonData, xhrArgs, "Deleting configuration property", onLoad, onError);
				},
				error: function(response, ioArgs) {
					if(onError)
						onError(response,ioArgs);
					var error =	mAuth.handleAuthenticationError(ioArgs.xhr, function(){});
					if(error!=null)
						return error;
					console.error("HTTP status code: ", ioArgs.xhr.status);
				}
			});
		},
		_getGitServiceResponse: function(jsonData, xhrArgs, message, onLoad){
			var service = this;
			
			if(xhrArgs.xhr.status === 202){
				var deferred = new dojo.Deferred();
				deferred.callback(jsonData);
				return this._serviceRegistry.getService("orion.page.progress").showWhile(deferred, message).then(function(progressResp) {
					var returnData = progressResp.Result.Severity == "Ok" ? progressResp.Result.JsonData : progressResp.Result;
					if (onLoad) {
						if (typeof onLoad === "function")
							onLoad(returnData);
						else
							service._serviceRegistration.dispatchEvent(onLoad,
									returnData);
					}
					return returnData;
				});
			}
			
			if (onLoad) {
				if (typeof onLoad === "function")
					onLoad(jsonData, xhrArgs);
				else
					service._serviceRegistration.dispatchEvent(onLoad,
							jsonData);
			}
			return jsonData;
		}
	};
	return GitService;
}());

return eclipse;
});
