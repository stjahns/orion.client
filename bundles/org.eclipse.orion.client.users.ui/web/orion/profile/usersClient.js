/*******************************************************************************
 * Copyright (c) 2009, 2011 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/

/** @namespace The global container for eclipse APIs. */

define(['dojo', 'orion/auth'], function(dojo, mAuth) {

var eclipse = eclipse || {};

eclipse.UsersClient = (
		function(){
			function UsersClient(serviceRegistry, pluginRegistry) {
				this.serviceRegistry = serviceRegistry;
			}
			
			UsersClient.prototype = /**@lends eclipse.UsersClient.prototype */
			{
					getUserInfo: function(userURI, onLoad){
						return this._doServiceCall("getUserInfo", arguments);
					},
					getUsersList : function(onLoad) {
						return this._doServiceCall("getUsersList", arguments);
					},
					deleteUser : function(userURI, onLoad) {
						return this._doServiceCall("deleteUser", arguments);
					},
					createUser : function(userName, password, onLoad, onError) {
						return this._doServiceCall("createUser", arguments);
					},
					updateUserInfo: function(userUri, data, onLoad){
						return this._doServiceCall("updateUserInfo", arguments);
					},
					initProfile: function(userURI, pluginsEventName, dataEventName){
						return this._doServiceCall("initProfile", arguments);
					},
					fire: function(action, url, jsonData){
						return this._doServiceCall("fire", arguments);
					},
					getDivContent: function() {
						return this._doServiceCall("getDivContent", arguments);
					},

			
				/**
				 * This helper method implements invocation of the service call,
				 * with retry on authentication error if needed.
				 */
				_doServiceCall: function(funcName, funcArgs) {
					var clientDeferred = new dojo.Deferred();
					this.serviceRegistry.getService("orion.core.user").then(
						function(usersService) {
							usersService[funcName].apply(usersService, funcArgs).then(
								//on success, just forward the result to the client
								function(result) {
									clientDeferred.callback(result);
								},
								//on failure we might need to retry
								function(error) {
									if (error.status === 401 || error.status===403) {
										mAuth.handleAuthenticationError(error, function(message) {
											//try again
											usersService[funcName].apply(usersService, funcArgs).then(
												function(result) {
													clientDeferred.callback(result);
												},
												function(error) {
													clientDeferred.errback(error);
												}
											);
										});
									} else {
										//forward other errors to client
										clientDeferred.errback(error);
									}
								}
							);
						}
					);
					return clientDeferred;
				}
			};
			
			return UsersClient;
		}());
return eclipse;	
});
