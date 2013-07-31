/*******************************************************************************
 * @license
 * Copyright (c) 2012 VMware, Inc. All Rights Reserved.
 * Copyright (c) 2013 IBM Corporation.
 *
 * THIS FILE IS PROVIDED UNDER THE TERMS OF THE ECLIPSE PUBLIC LICENSE
 * ("AGREEMENT"). ANY USE, REPRODUCTION OR DISTRIBUTION OF THIS FILE
 * CONSTITUTES RECIPIENTS ACCEPTANCE OF THE AGREEMENT.
 * You can obtain a current copy of the Eclipse Public License from
 * http://www.opensource.org/licenses/eclipse-1.0.php
 *
 * Contributors:
 *     Andrew Eisenberg (VMware) - initial API and implementation
 *     Manu Sridharan (IBM) - Various improvements
 ******************************************************************************/

/*
This module contains functions for manipulating internal type signatures and
other utility functions related to types.
*/
/*jslint es5:true browser:true*/
/*global define doctrine console */
define(["plugins/esprima/proposalUtils", "plugins/esprima/scriptedLogger", "doctrine/doctrine"],
function(proposalUtils, scriptedLogger/*, doctrine*/) {
	/**
	 * Doctrine closure compiler style type objects
	 */
	function ensureTypeObject(signature) {
		if (!signature) {
			return signature;
		}
		if (signature.type) {
			return signature;
		}
		try {
			return doctrine.parseParamType(signature);
		} catch(e) {
			debugger;
			console.error("doctrine failure to parse: " + signature);
			return {};
		}
	}


	function createNameType(name) {
	    if (typeof name !== 'string') {
	        throw new Error('Expected string, but found: ' + JSON.parse(name));
	    }
		return { type: 'NameExpression', name: name };
	}
	
	var THE_UNKNOWN_TYPE = createNameType("Object");
	var JUST_DOTS = '$$__JUST_DOTS__$$';
	var JUST_DOTS_REGEX = /\$\$__JUST_DOTS__\$\$/g;
	var UNDEFINED_OR_EMPTY_OBJ = /:undefined|:\{\}/g;




	/**
	 * The Definition class refers to the declaration of an identifier.
	 * The start and end are locations in the source code.
	 * Path is a URL corresponding to the document where the definition occurs.
	 * If range is undefined, then the definition refers to the entire document
	 * Range is a two element array with the start and end values
	 * (Exactly the same range field as is used in Esprima)
	 * If the document is undefined, then the definition is in the current document.
	 *
	 * @param String typeName
	 * @param {[Number]} range
	 * @param String path
	 */
	var Definition = function(typeObj, range, path) {
		this._typeObj = ensureTypeObject(typeObj);
		this.range = range;
		this.path = path;
	};

	Definition.prototype = {
		set typeObj(val) {
			var maybeObj = val;
			if (typeof maybeObj === 'string') {
				maybeObj = ensureTypeObject(maybeObj);
			}
			this._typeObj = maybeObj;
		},

		get typeObj() {
			return this._typeObj;
		}
	};

	/**
	 * Revivies a Definition object from a regular object
	 */
	Definition.revive = function(obj) {
		var defn = new Definition();
		for (var prop in obj) {
			if (obj.hasOwnProperty(prop)) {
				if (prop === 'typeSig') {
					defn.typeObj = obj[prop];
				} else {
					defn[prop] = obj[prop];
				}
			}
		}
		return defn;
	};

	var protoLength = "~proto".length;
	return {
		Definition : Definition,

		// now some functions that handle types signatures, styling, and parsing

		/** constant that defines generated type name prefixes */
		GEN_NAME : "gen~",


		// type parsing
		isArrayType : function(typeObj) {
			return typeObj.type === 'ArrayType' || typeObj.type === 'TypeApplication';
		},

		isFunctionOrConstructor : function(typeObj) {
			return typeObj.type === 'FunctionType';
		},

		isPrototypeName : function(typeName) {
			return typeName.substr( - protoLength, protoLength) === "~proto";
		},

		/**
		 * returns a parameterized array type with the given type parameter
		 */
		parameterizeArray : function(parameterTypeObj) {
			return {
				type: 'ArrayType',
				elements: [parameterTypeObj]
			};
		},

		createFunctionType : function(params, result, isConstructor) {
			var functionTypeObj = {
				type: 'FunctionType',
				params: params,
				result: result
			};
			if (isConstructor) {
				functionTypeObj.params = functionTypeObj.params || [];
			    // TODO should we also do 'this'?
				functionTypeObj.params.push({
					type: 'ParameterType',
					name: 'new',
					expression: result
				});
			}

			return functionTypeObj;
		},

		/**
		 * If this is a parameterized array type, then extracts the type,
		 * Otherwise object
		 */
		extractArrayParameterType : function(arrayObj) {
			var elts;
			if (arrayObj.type === 'TypeApplication') {
				if (arrayObj.expression.name === 'Array') {
					elts = arrayObj.applications;
				} else {
					return arrayObj.expression;
				}
			} else if (arrayObj.type === 'ArrayType') {
				elts = arrayObj.elements;
			} else {
				// not an array type
				return arrayObj;
			}

			if (elts.length > 0) {
				return elts[0];
			} else {
				return THE_UNKNOWN_TYPE;
			}
		},

		extractReturnType : function(fnType) {
			return fnType.result || (fnType.type === 'FunctionType' ? this.UNDEFINED_TYPE: fnType);
		},

		// TODO should we just return a typeObj here???
		parseJSDocComment : function(docComment) {
			var result = { };
			result.params = {};
			if (docComment) {
				var commentText = docComment.value;
				if (!commentText) {
					return result;
				}
				try {
					var rawresult = doctrine.parse("/*" + commentText + "*/", {unwrap : true, tags : ['param', 'type', 'return']});
					// transform result into something more manageable
					var rawtags = rawresult.tags;
					if (rawtags) {
						for (var i = 0; i < rawtags.length; i++) {
							switch (rawtags[i].title) {
								case "typedef":
								case "define":
								case "type":
									result.type = rawtags[i].type;
									break;
								case "return":
									result.rturn = rawtags[i].type;
									break;
								case "param":
									// remove square brackets
									var name = rawtags[i].name;
									if (name.charAt(0) === '[' && name.charAt(name.length -1) === ']') {
										name = name.substring(1, name.length-1);
									}
									result.params[name] = rawtags[i].type;
									break;
							}
						}
					}
				} catch (e) {
					scriptedLogger.error(e.message, "CONTENT_ASSIST");
					scriptedLogger.error(e.stack, "CONTENT_ASSIST");
					scriptedLogger.error("Error parsing doc comment:\n" + (docComment && docComment.value),
							"CONTENT_ASSIST");
				}
			}
			return result;
		},


		/**
		 * takes this jsdoc type and recursively splits out all record types into their own type
		 * also converts unknown name types into Objects
		 * @see https://developers.google.com/closure/compiler/docs/js-for-compiler
		 */
		convertJsDocType : function(jsdocType, env, doCombine, depth) {
		    if (typeof depth !== 'number') {
		        depth = 0;
		    }
			if (!jsdocType) {
				return THE_UNKNOWN_TYPE;
			}

			var self = this;
			var name = jsdocType.name;
			var allTypes = env.getAllTypes();
			switch (jsdocType.type) {
				case 'NullableLiteral':
				case 'AllLiteral':
				case 'NullLiteral':
				case 'UndefinedLiteral':
				case 'VoidLiteral':
					return {
						type: jsdocType.type
					};

				case 'UnionType':
					return {
						type: jsdocType.type,
						elements: jsdocType.elements.map(function(elt) {
							return self.convertJsDocType(elt, env, doCombine, depth);
						})
					};

				case 'RestType':
					return {
						type: jsdocType.type,
						expression: self.convertJsDocType(jsdocType.expression, env, doCombine, depth)
					};

				case 'ArrayType':
					return {
						type: jsdocType.type,
						elements: jsdocType.elements.map(function(elt) {
							return self.convertJsDocType(elt, env, doCombine, depth);
						})
					};

				case 'FunctionType':
					var fnType = {
						type: jsdocType.type,
						params: jsdocType.params.map(function(elt) {
							return self.convertJsDocType(elt, env, doCombine, depth);
						})
					};
					if (jsdocType.result) {
						// prevent recursion on functions that return themselves
						fnType.result = depth > 1 && jsdocType.result.type === 'FunctionType' ?
							{ type : 'NameExpression', name : JUST_DOTS } :
							self.convertJsDocType(jsdocType.result, env, doCombine, depth);
					}

					// TODO should remove?  new and this are folded into params
//					if (jsdocType['new']) {
//						// prevent recursion on functions that return themselves
//						fnType['new'] = depth < 2 && jsdocType['new'].type === 'FunctionType' ?
//							self.convertJsDocType(jsdocType['new'], env, doCombine, depth) :
//							{ type : 'NameExpression', name : JUST_DOTS };
//					}
//
//					if (jsdocType['this']) {
//						// prevent recursion on functions that return themselves
//						fnType['this'] = depth < 2 && jsdocType['this'].type === 'FunctionType' ?
//							self.convertJsDocType(jsdocType['this'], env, doCombine, depth) :
//							{ type : 'NameExpression', name : JUST_DOTS };
//					}

					return fnType;

				case 'TypeApplication':
					var typeApp = {
						type: jsdocType.type,
						expression: self.convertJsDocType(jsdocType.expression, env, doCombine, depth)

					};
					if (jsdocType.applications) {
                        typeApp.applications = jsdocType.applications.map(function(elt) {
							return self.convertJsDocType(elt, env, doCombine, depth);
						});
					}
					return typeApp;

				case 'ParameterType':
					return {
						type: jsdocType.type,
						name: name,
						expression: jsdocType.expression ?
							self.convertJsDocType(jsdocType.expression, env, doCombine, depth) :
							null
					};

				case 'NonNullableType':
				case 'OptionalType':
				case 'NullableType':
					return {
						prefix: true,
						type: jsdocType.type,
						expression: self.convertJsDocType(jsdocType.expression, env, doCombine, depth)
					};

				case 'NameExpression':
					if (doCombine && env.isSyntheticName(name)) {
						// Must mush together all properties for this synthetic type
						var origFields = allTypes[name];
						if (origFields.$$fntype) {
							// just represent the function type directly, not as an object type
							return self.convertJsDocType(origFields.$$fntype, env, doCombine, depth);
						}
						// must combine a record type
						var newFields = [];
						Object.keys(origFields).forEach(function(key) {
							if (key === '$$proto') {
								// maybe should traverse the prototype
								return;
							}
							var prop = origFields[key];
							var fieldType = depth > 0 && (prop.typeObj.type === 'NameExpression' && env.isSyntheticName(prop.typeObj.name) && !allTypes[prop.typeObj.name].$$fntype) ?
							     { type : 'NameExpression', name : JUST_DOTS } :
							     self.convertJsDocType(prop.typeObj, env, doCombine, depth+1);
							newFields.push({
								type: 'FieldType',
								key: key,
								value: fieldType
							});
						});


						return {
							type: 'RecordType',
							fields: newFields
						};
					} else {
						if (allTypes[name]) {
							return { type: 'NameExpression', name: name };
						} else {
							var capType = name[0].toUpperCase() + name.substring(1);
							if (allTypes[capType]) {
								return { type: 'NameExpression', name: capType };
							}
						}
					}
					return THE_UNKNOWN_TYPE;

				case 'FieldType':
					return {
						type: jsdocType.type,
						key: jsdocType.key,
						value: self.convertJsDocType(jsdocType.value, env, doCombine, depth)
					};

				case 'RecordType':
					if (doCombine) {
						// when we are combining, do not do anything special for record types
						return {
							type: jsdocType.type,
							params: jsdocType.fields.map(function(elt) {
								return self.convertJsDocType(elt, env, doCombine, depth+1);
							})
						};
					} else {
						// here's where it gets interesting
						// create a synthetic type in the env and then
						// create a property in the env type for each record property
						var fields = { };
						for (var i = 0; i < jsdocType.fields.length; i++) {
							var field = jsdocType.fields[i];
							var convertedField = self.convertJsDocType(field, env, doCombine, depth+1);
							fields[convertedField.key] = convertedField.value;
						}
						// create a new type to store the record
						var obj = env.newFleetingObject();
						for (var prop in fields) {
							if (fields.hasOwnProperty(prop)) {
								// add the variable to the new object, which happens to be the top-level scope
								env.addVariable(prop, obj.name, fields[prop]);
							}
						}
						return obj;
					}
			}
			return THE_UNKNOWN_TYPE;
		},

		createNameType : createNameType,

		createParamType : function(name, typeObj) {
			return {
				type: 'ParameterType',
				name: name,
				expression: typeObj
			};
		},

		convertToSimpleTypeName : function(typeObj) {
			switch (typeObj.type) {
				case 'NullableLiteral':
				case 'AllLiteral':
				case 'NullLiteral':
					return "Object";

				case 'UndefinedLiteral':
				case 'VoidLiteral':
					return "undefined";

				case 'NameExpression':
					return typeObj.name;

				case 'TypeApplication':
				case 'ArrayType':
					return "Array";

				case 'FunctionType':
					return "Function";

				case 'UnionType':
					return typeObj.expressions && typeObj.expressions.length > 0 ?
						this.convertToSimpleTypeName(typeObj.expressions[0]) :
						"Object";

				case 'RecordType':
					return "Object";

				case 'FieldType':
					return this.convertToSimpleTypeName(typeObj.value);

				case 'NonNullableType':
				case 'OptionalType':
				case 'NullableType':
				case 'ParameterType':
					return this.convertToSimpleTypeName(typeObj.expression);
			}
		},

		// type styling
		styleAsProperty : function(prop, useHtml) {
			return useHtml ? '<span style="color: blue;font-weight:bold;">' + prop + '</span>': prop;
		},
		styleAsType : function(type, useHtml) {
			return useHtml ? '<span style="color: black;">' + type + '</span>': type;
		},
		styleAsOther : function(text, useHtml) {
			return useHtml ? '<span style="font-weight:bold; color:purple;">' + text + '</span>': text;
		},


		/**
		 * creates a human readable type name from the name given
		 */
		createReadableType : function(typeObj, env, useFunctionSig, depth, useHtml) {
			if (useFunctionSig) {
				typeObj = this.convertJsDocType(typeObj, env, true);
				if (useHtml) {
					return this.convertToHtml(typeObj, 0);
				}
				var res = doctrine.type.stringify(typeObj, {compact: true});
				res = res.replace(JUST_DOTS_REGEX, "{...}");
				res = res.replace(UNDEFINED_OR_EMPTY_OBJ, "");
				return res;
			} else {
				typeObj = this.extractReturnType(typeObj);
				return this.createReadableType(typeObj, env, true, depth, useHtml);
			}
		},
		convertToHtml : function(typeObj, depth) {
			// typeObj must already be converted to avoid infinite loops
//			typeObj = this.convertJsDocType(typeObj, env, true);
			var self = this;
			var res;
			var parts = [];
			depth = depth || 0;

			switch(typeObj.type) {
				case 'NullableLiteral':
					return this.styleAsType("?", true);
				case 'AllLiteral':
					return this.styleAsType("*", true);
				case 'NullLiteral':
					return this.styleAsType("null", true);
				case 'UndefinedLiteral':
					return this.styleAsType("undefined", true);
				case 'VoidLiteral':
					return this.styleAsType("void", true);

				case 'NameExpression':
					var name = typeObj.name === JUST_DOTS ? "{...}" : typeObj.name;
					return this.styleAsType(name, true);

				case 'UnionType':
					parts = [];
					if (typeObj.expressions) {
						typeObj.expressions.forEach(function(elt) {
							parts.push(self.convertToHtml(elt, depth+1));
						});
					}
					return "( " + parts.join(", ") + " )";



				case 'TypeApplication':
					if (typeObj.applications) {
						typeObj.applications.forEach(function(elt) {
							parts.push(self.convertToHtml(elt, depth));
						});
					}
					var isArray = typeObj.expression.name === 'Array';
					if (!isArray) {
						res = this.convertToHtml(typeObj.expression, depth) + ".<";
					}
					res += parts.join(",");
					if (isArray) {
						res += '[]';
					} else {
						res += ">";
					}
					return res;
				case 'ArrayType':
					if (typeObj.elements) {
						typeObj.elements.forEach(function(elt) {
							parts.push(self.convertToHtml(elt, depth+1));
						});
					}
					return parts.join(", ") + '[]';

				case 'NonNullableType':
					return "!" +  this.convertToHtml(typeObj.expression, depth);
				case 'OptionalType':
					return this.convertToHtml(typeObj.expression, depth) + "=";
				case 'NullableType':
					return "?" +  this.convertToHtml(typeObj.expression, depth);
				case 'RestType':
					return "..." +  this.convertToHtml(typeObj.expression, depth);

				case 'ParameterType':
					return this.styleAsProperty(typeObj.name, true) +
						(typeObj.expression.name === JUST_DOTS ? "" : (":" + this.convertToHtml(typeObj.expression, depth)));

				case 'FunctionType':
					var isCons = false;
					var resType;
					if (typeObj.params) {
						typeObj.params.forEach(function(elt) {
							if (elt.name === 'this') {
								isCons = true;
								resType = elt.expression;
							} else if (elt.name === 'new') {
								isCons = true;
								resType = elt.expression;
							} else {
								parts.push(self.convertToHtml(elt, depth+1));
							}
						});
					}

					if (!resType && typeObj.result) {
						resType = typeObj.result;
					}

					var resText;
					if (resType && resType.type !== 'UndefinedLiteral' && resType.name !== 'undefined') {
						resText = this.convertToHtml(resType, depth+1);
					} else {
						resText = '';
					}
					res = this.styleAsOther(isCons ? 'new ' : 'function', true);
					if (isCons) {
						res += resText;
					}
					res += '(' + parts.join(",") + ')';
					if (!isCons && resText) {
						res += '&rarr;' + resText;
					}

					return res;

				case 'RecordType':
					if (typeObj.fields && typeObj.fields.length > 0) {
						typeObj.fields.forEach(function(elt) {
							parts.push(proposalUtils.repeatChar('&nbsp;&nbsp;', depth+1) + self.convertToHtml(elt, depth+1));
						});
						return '{<br/>' + parts.join(',<br/>') + '<br/>' + proposalUtils.repeatChar('&nbsp;&nbsp;', depth) + '}';
					} else {
						return '{ }';
					}
					break;

				case 'FieldType':
					return this.styleAsProperty(typeObj.key, true) +
						":" + this.convertToHtml(typeObj.value, depth);
			}

		},
		ensureTypeObject: ensureTypeObject,
		OBJECT_TYPE: THE_UNKNOWN_TYPE,
		UNDEFINED_TYPE: createNameType("undefined"),
		NUMBER_TYPE: createNameType("Number"),
		BOOLEAN_TYPE: createNameType("Boolean"),
		STRING_TYPE: createNameType("String"),
		ARRAY_TYPE: createNameType("Array"),
		FUNCTION_TYPE: createNameType("Function")	
	};
	
});

