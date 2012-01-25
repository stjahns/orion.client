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
/*jslint regexp: true */
/*global define console top self eclipse setTimeout*/

define(['dojo', 'orion/assert'], function(dojo, assert) {

	function _serializeTasks(tasks) {
		var length = tasks.length;
		var current = 0;
		var promise = new dojo.Deferred();

		function _run() {
			function _runNextTick() {
				setTimeout(_run, 0);
			}
		
			while(current !== length) {
				try {				
					var result = tasks[current++]();
					if (result && typeof result.then === "function") {
						result.then(_runNextTick,_runNextTick);
						return promise;
					}
				} catch(e){
				}
			}
			promise.resolve();
			return promise;
		}
		return _run();
	}
	
	function _list(prefix, obj) {
		var result = [],
			property,
			test,
			testName;
		
		for (property in obj) {
			if (property.match(/^test/)) {
				test = obj[property];
				testName = prefix ? prefix + "." + property : property;
				if (typeof test === "function") {
					result.push(testName);
				} else if (typeof test === "object") {
					result = result.concat(_list(testName, test, result));
				}
			}
		}
		return result;
	}
	

	function Test() {
		var _namedListeners = {};
		function _dispatchEvent(eventName) {
			var listeners = _namedListeners[eventName];
			if (listeners) {
				for ( var i = 0; i < listeners.length; i++) {
					try {
						var args = Array.prototype.slice.call(arguments, 1);
						listeners[i].apply(null, args);
					} catch (e) {
						console.log(e); // for now, probably should dispatch an
										// ("error", e)
					}
				}
			}
		}

		function _createTestWrapper(name, test) {
			return function() {
				_dispatchEvent("testStart", name);
				try {
					var testResult = test();
					if (testResult && typeof testResult.then === "function") {
						return testResult.then(function() {
							_dispatchEvent("testDone", name, {result: true});
						}, function(e) {
							_dispatchEvent("testDone", name, {result: false, message: e.toString(), stack: e.stack || e.stacktrace});
						});
					} else {
						_dispatchEvent("testDone", name, {result: true});
						return testResult;
					}
				} catch(e) {
					_dispatchEvent("testDone", name, {result: false, message: e.toString(), stack: e.stack || e.stacktrace});
					return e;
				}
			};
		}		
		
		function _createRunWrapper(prefix, obj) {
			return function() {
				var tasks = [];
				_dispatchEvent("runStart", prefix);
				for ( var property in obj) {
					if (property.match(/^test/)) {
						var name = prefix ? prefix + "." + property : property;
						var test = obj[property];
						if (typeof test === "function") {
							tasks.push(_createTestWrapper(name, test));
						} else if (typeof test === "object") {
							tasks.push(_createRunWrapper(name, test));
						}
					}
				}

				return _serializeTasks(tasks).then(function(){
					_dispatchEvent("runDone", prefix);
				});
			};
		}	
		
		this.addEventListener = function(eventName, listener) {
			_namedListeners[eventName] = _namedListeners[eventName] || [];
			_namedListeners[eventName].push(listener);
		};
	
		this.removeEventListener = function(eventName, listener) {
			var listeners = _namedListeners[eventName];
			if (listeners) {
				for ( var i = 0; i < listeners.length; i++) {
					if (listeners[i] === listener) {
						if (listeners.length === 1) {
							delete _namedListeners[eventName];
						} else {
							_namedListeners[eventName].splice(i, 1);
						}
						break;
					}
				}
			}
		};
		
		this.hasEventListener = function(eventName) {
			if (! eventName) {
				return !!(_namedListeners.runStart || _namedListeners.runDone || _namedListeners.testStart  || _namedListeners.testDone);
			}
			return !!_namedListeners[eventName];
		};
		
		this.list = function(name, obj) {
			if (typeof obj === "undefined") {
				obj = name;
				name = "";
			}
	
			if (!obj || typeof obj !== "object") {
				throw new Error("not a test object");
			}
			return _list(name, obj);
		};
		
		this.run = function(prefix, obj) {
			if (typeof obj === "undefined") {
				obj = prefix;
				prefix = "";
			}
	
			if (!obj || typeof obj !== "object") {
				throw new Error("not a test object");
			}
			
			var _run = _createRunWrapper(prefix, obj);
			var that = this;
			
			if (!this.useLocal && top !== self && typeof(eclipse) !== "undefined" && eclipse.PluginProvider) {
				var result = new dojo.Deferred();
				try {
					var provider = new eclipse.PluginProvider();
					var serviceProvider = provider.registerServiceProvider("orion.test.runner", {
						run: function() {
							dojo.when(_run(), dojo.hitch(result, "resolve"));
							return result;
						},
						list: function() {
							return _list(prefix, obj);
						}
					});
	
					provider.connect(function() {
						that.addEventListener("runStart", function(name) { serviceProvider.dispatchEvent("runStart", name); });
						that.addEventListener("runDone", function(name, obj) { serviceProvider.dispatchEvent("runDone", name, obj); });
						that.addEventListener("testStart", function(name) { serviceProvider.dispatchEvent("testStart", name); });
						that.addEventListener("testDone", function(name, obj) { serviceProvider.dispatchEvent("testDone", name, obj); });
					}, function() {
						if (!that.hasEventListener()) {
							that.addConsoleListeners();
						}
						dojo.when(_run(), dojo.hitch(result, "resolve"));
					});
					return result;
				} catch (e) {
					// fall through
					console.log(e);
				}
			}
			// if no listeners add the console
			if (!this.hasEventListener()) {
				this.addConsoleListeners();
			}
			return _run();
		};
	}		

	Test.prototype.addConsoleListeners = function() {
		var times = {};
		var testCount = 0;
		var failures = 0;
		var top;
		
		this.addEventListener("runStart", function(name) {
			name = name ? name : "<top>";
			if (!top) {
				top = name;
			}
			console.log("[Test Run] - " + name + " start");
			times[name] = new Date().getTime();
		});
		this.addEventListener("runDone", function(name, obj) {
			name = name ? name : "<top>";
			var result = [];
			result.push("[Test Run] - " + name + " done - ");
			if (name === top) {
				result.push("[Failures:" + failures + (name === top ? ", Test Count:" + testCount : "") +"] ");
			}
			result.push("(" + (new Date().getTime() - times[name]) / 1000 + "s)");
			delete times[name];
			console.log(result.join(""));
		});
		this.addEventListener("testStart", function(name) {
			times[name] = new Date().getTime();
			testCount++;
		});
		this.addEventListener("testDone", function(name, obj) {
			var result = [];
			result.push(obj.result ? " [passed] " : " [failed] ");
			if (!obj.result) {
				failures++;
			}
			result.push(name);
			result.push(" (" + (new Date().getTime() - times[name]) / 1000 + "s)");
			delete times[name];
			if (!obj.result) {
				result.push("\n  " + obj.message);
				if (obj.stack) {
					result.push("\n Stack Trace:\n" + obj.stack);
				}
			}
			console.log(result.join(""));
		});
	};

	var exports = new Test();
	exports.Test = Test;
	return exports;
});