/*******************************************************************************
 * @license
 * Copyright (c) 2010, 2011 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/

/*global define setTimeout clearTimeout addEventListener document console localStorage Worker*/

define(["orion/Deferred", "orion/serviceregistry", "orion/es5shim"], function(Deferred, mServiceregistry){
var eclipse = eclipse || {};

/**
 * Creates a new plugin
 * @class Represents a single plugin in the plugin registry
 * @name orion.pluginregistry.Plugin
 */
eclipse.Plugin = function(url, data, internalRegistry) {
	var _self = this;
	
	var _channel = null;
	var _deferredLoad = new Deferred();
	var _deferredUpdate = null;
	var _loaded = false;
	
	var _currentMessageId = 0;
	var _deferredResponses = {};
	var _serviceRegistrations = {};
	
	function _callService(serviceId, method, params) {
		if (!_channel) {
			throw new Error("plugin not connected");
		}
		var requestId = _currentMessageId++;
		var d = new Deferred();
		_deferredResponses[String(requestId)] = d;
		var message = {
			id: requestId,
			serviceId: serviceId,
			method: method,
			params: params
		};
		internalRegistry.postMessage(message, _channel);
		return d.promise;
	}

	function _createServiceProxy(service) {
		var serviceProxy = {};
		if (service.methods) {
			service.methods.forEach(function(method) {
				serviceProxy[method] = function() {
					var params = Array.prototype.slice.call(arguments);
					if (_loaded) {
						return _callService(service.serviceId, method, params);
					} else {
						return _self._load().then(function() {
							return _callService(service.serviceId, method, params);
						});
					}
				};
			});
		}
		return serviceProxy;
	}
	
	function _parseData() {
		var services = data.services;
		if (services) {
			services.forEach(function(service) {
				var serviceProxy = _createServiceProxy(service);
				_serviceRegistrations[service.serviceId] = internalRegistry.registerService(service.type, serviceProxy, service.properties);
			});
		}	
	}
	
	function _responseHandler(message) {
		var serviceRegistration, deferred;
		try {
			if (message.method) {
				if ("plugin" === message.method) { //$NON-NLS-0$
					if (!data) {
						data = message.params[0];
						_parseData();
					} else if (JSON.stringify(data) !== JSON.stringify(message.params[0])) {
						// check if the data has been updated
						for (var serviceId in _serviceRegistrations) {
							if (_serviceRegistrations.hasOwnProperty(serviceId)) {
								_serviceRegistrations[serviceId].unregister();
								delete _serviceRegistrations[serviceId];
							}
						}
						data = message.params[0];
						_parseData();
						internalRegistry.updatePlugin(_self);						
					}
					
					if (!_loaded) {
						_loaded = true;
						internalRegistry.dispatchEvent("pluginLoaded", _self); //$NON-NLS-0$
						_deferredLoad.resolve(_self);
					}
					
					if (_deferredUpdate) {
						_deferredUpdate.resolve(_self);
						_deferredUpdate = null;
					}
				} else if ("dispatchEvent" === message.method){ //$NON-NLS-0$
					serviceRegistration = _serviceRegistrations[message.serviceId];
					serviceRegistration.dispatchEvent.apply(serviceRegistration, message.params);		
				} else if ("progress" === message.method){ //$NON-NLS-0$
					deferred = _deferredResponses[String(message.requestId)];
					deferred.update.apply(deferred, message.params);	
				} else if ("timeout"){
					if (!_loaded) {
						_deferredLoad.reject(new Error("Load timeout for plugin: " + url));
					}
					
					if (_deferredUpdate) {
						_deferredUpdate.reject(new Error("Load timeout for plugin: " + url));
						_deferredUpdate = null;
					}
				} else {
					throw new Error("Bad response method: " + message.method);
				}		
			} else {
				deferred = _deferredResponses[String(message.id)];
				delete _deferredResponses[String(message.id)];
				if (message.error) {
					deferred.reject(message.error);
				} else {
					deferred.resolve(message.result);
				}
			}
		} catch (e) {
			console.log(e);
		}
	}

	/**
	 * Returns the URL location of this plugin
	 * @name orion.pluginregistry.Plugin#getLocation
	 * @return {String} The URL of this plugin
	 * @function
	 */
	this.getLocation = function() {
		return url;
	};
	
	/**
	 * Returns the declarative properties of this plugin
	 * @name orion.pluginregistry.Plugin#getData
	 * @return {Object} the service properties
	 * @function
	 */
	this.getData = function() {
		return data;
	};
	
	/**
	 * Uninstalls this plugin
	 * @name orion.pluginregistry.Plugin#uninstall
	 * @function
	 */
	this.uninstall = function() {
		for (var serviceId in _serviceRegistrations) {
			if (_serviceRegistrations.hasOwnProperty(serviceId)) {
				_serviceRegistrations[serviceId].unregister();
				delete _serviceRegistrations[serviceId];
			}
		}
		if (_channel) {
			internalRegistry.disconnect(_channel);
			_channel = null;
		}
		internalRegistry.uninstallPlugin(this);
	};
	
	/**
	 * Returns the service references provided by this plugin
	 * @name orion.pluginregistry.Plugin#getServiceReferences
	 * @return {orion.serviceregistry.ServiceReference} The service references provided
	 * by this plugin.
	 * @function 
	 */
	this.getServiceReferences = function() {
		var result = [];
		var serviceId;
		for (serviceId in _serviceRegistrations) {
			if (_serviceRegistrations.hasOwnProperty(serviceId)) {
				result.push(_serviceRegistrations[serviceId].getServiceReference());
			}
		}
		return result;
	};
	
	this.update = function() {
		if (!_loaded) {
			return this._load();
		}
		
		var updatePromise;
		if (_deferredUpdate === null) {
			_deferredUpdate = new Deferred();
			updatePromise = _deferredUpdate;
			internalRegistry.disconnect(_channel);
			_channel = internalRegistry.connect(url, _responseHandler);
		}
		return _deferredUpdate.promise;
	};
	
	this._load = function(isInstall, optTimeout) {
		if (!_channel) {
			_channel = internalRegistry.connect(url, _responseHandler, optTimeout);
			_deferredLoad.then(null, function() {
				if (!isInstall) {
					data = {};
					internalRegistry.updatePlugin(_self);
				}
			});
		}
		return _deferredLoad.promise;
	};
	
	if (typeof url !== "string") { //$NON-NLS-0$
		throw new Error("invalid url:" + url); //$NON-NLS-0$
	}
	
	if (data) {
		_parseData();
	}
};

/**
 * Creates a new plugin registry.
 * @class The Orion plugin registry
 * @name orion.pluginregistry.PluginRegistry
 */
eclipse.PluginRegistry = function(serviceRegistry, opt_storage, opt_visible) {
	var _storage = opt_storage || localStorage || {};
	var _plugins = [];
	var _channels = [];
	var _pluginEventTarget = new mServiceregistry.EventTarget();

	addEventListener("message", function(event) { //$NON-NLS-0$
		var source = event.source;
		_channels.some(function(channel){
			if (source === channel.target) {
				if (typeof channel.useStructuredClone === "undefined") { //$NON-NLS-0$
					channel.useStructuredClone = typeof event.data !== "string"; //$NON-NLS-0$
				}
				channel.handler(channel.useStructuredClone ? event.data : JSON.parse(event.data));
				return true; // e.g. break
			}
		});
	}, false);
	
	function _normalizeURL(location) {
		if (location.indexOf("://") === -1) { //$NON-NLS-0$
			var temp = document.createElement('a'); //$NON-NLS-0$
			temp.href = location;
	        return temp.href;
		}
		return location;
	}
	
	function _clear(plugin) {
		delete _storage["plugin."+plugin.getLocation()]; //$NON-NLS-0$
	}
	
	function _persist(plugin) {
		var expiresSeconds = 60 * 60;
		plugin.getData()._expires = new Date().getTime() + 1000 * expiresSeconds;
		_storage["plugin."+plugin.getLocation()] = JSON.stringify(plugin.getData()); //$NON-NLS-0$
	}

	var internalRegistry = {
			registerService: serviceRegistry.registerService.bind(serviceRegistry),
			connect: function(url, handler, timeout) {
				var channel = {
					handler: handler,
					url: url
				};
				
				function sendTimeout() {
					handler({method:"timeout"});
				}
				
				var loadTimeout = setTimeout(sendTimeout, timeout || 15000);
				
				if (url.match(/\.js$/) && typeof(Worker) !== "undefined") { //$NON-NLS-0$
					var worker = new Worker(url);
					worker.onmessage = function(event) {
							if (typeof channel.useStructuredClone === "undefined") { //$NON-NLS-0$
								channel.useStructuredClone = typeof event.data !== "string"; //$NON-NLS-0$
							}
							channel.handler(channel.useStructuredClone ? event.data : JSON.parse(event.data));
					};
					channel.target = worker;
					channel.close = function() {
						worker.terminate();
					};
				} else {
					var iframe = document.createElement("iframe"); //$NON-NLS-0$
					iframe.id = url;
					iframe.name = url;
					if (!opt_visible) {
						iframe.style.display = "none"; //$NON-NLS-0$
						iframe.style.visibility = "hidden"; //$NON-NLS-0$
					}
					iframe.src = url;
					iframe.onload = function() {
						clearTimeout(loadTimeout);
						setTimeout(sendTimeout, 5000);
					};
					iframe.sandbox = "allow-scripts allow-same-origin";
					document.body.appendChild(iframe);
					channel.target = iframe.contentWindow;
					channel.close = function() {
						document.body.removeChild(iframe);
					};
				}
				_channels.push(channel);
				return channel;
			},
			disconnect: function(channel) {
				for (var i = 0; i < _channels.length; i++) {
					if (channel === _channels[i]) {
						_channels.splice(i,1);
						try {
							channel.close();
						} catch(e) {
							// best effort
						}
						break;
					}
				}
			},
			uninstallPlugin: function(plugin) {
				_clear(plugin);
				for (var i = 0; i < _plugins.length; i++) {
					if (plugin === _plugins[i]) {
						_plugins.splice(i,1);
						_pluginEventTarget.dispatchEvent("pluginRemoved", plugin); //$NON-NLS-0$
						break;
					}
				}
			},
			updatePlugin: function(plugin) {
				_persist(plugin);
				_pluginEventTarget.dispatchEvent("pluginUpdated", plugin); //$NON-NLS-0$
			},
			postMessage: function(message, channel) {
				channel.target.postMessage((channel.useStructuredClone ? message : JSON.stringify(message)), channel.url);
			},
			dispatchEvent: function(type, plugin) {
				try {
					_pluginEventTarget.dispatchEvent(type, plugin);
				} catch (e) {
					if (console) {
						console.log(e);
					}
				}
			}
	};
	
	function _getPlugin(url) {
		var result = null;
		url = _normalizeURL(url);
		_plugins.some(function(plugin){
			if (url === plugin.getLocation()) {
				result = plugin;
				return true;
			}
		});
		return result;
	}
	
	/**
	 * Starts the plugin registry
	 * @name orion.pluginregistry.PluginRegistry#startup
	 * @return A promise that will resolve when the registry has been fully started
	 * @function 
	 */
	this.startup = function(pluginURLs) {	
		var installList = [];
		pluginURLs.forEach(function(pluginURL) {
			pluginURL = _normalizeURL(pluginURL);
			var key = "plugin." + pluginURL; //$NON-NLS-0$
			var pluginData = _storage[key] ? JSON.parse(_storage[key]) : null;
			if (pluginData && pluginData._expires && pluginData._expires > new Date().getTime()) {
				if (_getPlugin(pluginURL) === null) {
					delete pluginData._expires;
					_plugins.push(new eclipse.Plugin(pluginURL, pluginData, internalRegistry));
				}
			} else {
				_storage[key] ="{}"; //$NON-NLS-0$
				var plugin = new eclipse.Plugin(pluginURL, {}, internalRegistry); 
				_plugins.push(plugin);
				installList.push(plugin._load(false, 5000)); // _load(false) because we want to ensure the plugin is updated
			}
		});
		
		var d = new Deferred();
		return d.all(installList, function(){});
	};
	
	/**
	 * Shuts down the plugin registry
	 * @name orion.pluginregistry.PluginRegistry#shutdown
	 * @function 
	 */
	this.shutdown = function() {
		_channels.forEach(function(channel) {
			try {
				channel.close();
			} catch(e) {
				// best effort
			}
		});
	};
	
	/**
	 * Installs the plugin at the given location into the plugin registry
	 * @name orion.pluginregistry.PluginRegistry#installPlugin
	 * @param {String} url The location of the plugin
	 * @param {Object} opt_data The plugin metadata
	 * @function 
	 */
	this.installPlugin = function(url, opt_data) {
		url = _normalizeURL(url);
		var d = new Deferred();
		var plugin = _getPlugin(url);
		if (plugin) {
			if(plugin.getData()) {
				d.resolve(plugin);
			} else {
				var pluginTracker = function(plugin) {
					if (plugin.getLocation() === url) {
						d.resolve(plugin);
						_pluginEventTarget.removeEventListener("pluginAdded", pluginTracker); //$NON-NLS-0$
					}
				};
				_pluginEventTarget.addEventListener("pluginAdded", pluginTracker); //$NON-NLS-0$
			}
		} else {
			plugin = new eclipse.Plugin(url, opt_data, internalRegistry);
			_plugins.push(plugin);
			if(plugin.getData()) {
				_persist(plugin);
				_pluginEventTarget.dispatchEvent("pluginAdded", plugin); //$NON-NLS-0$
				d.resolve(plugin);
			} else {				
				plugin._load(true).then(function() {
					_persist(plugin);
					_pluginEventTarget.dispatchEvent("pluginAdded", plugin); //$NON-NLS-0$
					d.resolve(plugin);
				}, function(e) {
					d.reject(e);
				});
			}
		}
		return d.promise;	
	};
	
	/**
	 * Returns all installed plugins
	 * @name orion.pluginregistry.PluginRegistry#getPlugins
	 * @return {Array} An array of all installed plugins.
	 * @function 
	 */
	this.getPlugins = function() {
		var result =[];
		_plugins.forEach(function(plugin) {
			if (plugin.getData()) {
				result.push(plugin);
			}
		});
		return result;
	};

	/**
	 * Returns the installed plugin with the given URL, or null
	 * if no such plugin is installed.
	 * @name orion.pluginregistry.PluginRegistry#getPlugin
	 * @return {orion.pluginregistry.Plugin} The installed plugin matching the given URL.
	 * @function 
	 */
	this.getPlugin = function(url) {
		var plugin = _getPlugin(url);
		if (plugin && plugin.getData()) {
			return plugin;
		}
		return null;
	};
	
	// pluginAdded, pluginRemoved
	this.addEventListener = function(eventName, listener) {
		_pluginEventTarget.addEventListener(eventName, listener);
	};
	
	this.removeEventListener = function(eventName, listener) {
		_pluginEventTarget.removeEventListener(eventName, listener);
	};
};
return eclipse;
});