/*******************************************************************************
 * @license
 * Copyright (c) 2009, 2012 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/

/*global define window */
/*jslint regexp:false browser:true forin:true*/

define(['i18n!orion/navigate/nls/messages', 'require', 'orion/Deferred', 'orion/webui/littlelib', 'orion/i18nUtil', 'orion/fileUtils', 'orion/explorers/explorer'],
		function(messages, require, Deferred, lib, i18nUtil, mFileUtils, mExplorer){

	/**
	 * Tree model used by the FileExplorer
	 */
	function FileModel(serviceRegistry, root, fileClient, idPrefix, excludeFiles, excludeFolders) {
		this.registry = serviceRegistry;
		this.root = root;
		this.fileClient = fileClient;
		this.idPrefix = idPrefix || "";
		this.excludeFiles = !!excludeFiles;
		this.excludeFolders = !!excludeFolders;
	}
	FileModel.prototype = new mExplorer.ExplorerModel(); 
	
	FileModel.prototype.getRoot = function(onItem){
		onItem(this.root);
	};
	
	/*
		Process the parent and children, doing any filtering or sorting that may be necessary.
	*/
	FileModel.prototype.processParent = function(parent, children) {
		if (this.excludeFiles || this.excludeFolders) {
			var filtered = [];
			for (var i in children) {
				var exclude = children[i].Directory ? this.excludeFolders : this.excludeFiles;
				if (!exclude) {
					filtered.push(children[i]);
					children[i].parent = parent;
				}
			}
			children = filtered;
		} else {
			for (var j in children) {
				children[j].parent = parent;
			}
		}
	
		//link the parent and children together
		parent.children = children;

		// not ideal, but for now, sort here so it's done in one place.
		// this should really be something pluggable that the UI defines
		parent.children.sort(function(a, b) {
			var isDir1 = a.Directory;
			var isDir2 = b.Directory;
			if (isDir1 !== isDir2) {
				return isDir1 ? -1 : 1;
			}
			var n1 = a.Name && a.Name.toLowerCase();
			var n2 = b.Name && b.Name.toLowerCase();
			if (n1 < n2) { return -1; }
			if (n1 > n2) { return 1; }
			return 0;
		}); 
		return children;
	};
		
	FileModel.prototype.getChildren = function(parentItem, /* function(items) */ onComplete){
		var self = this;
		// the parent already has the children fetched
		if (parentItem.children) {
			onComplete(parentItem.children);
		} else if (parentItem.Directory!==undefined && parentItem.Directory===false) {
			onComplete([]);
		} else if (parentItem.Location) {
			var progress = this.registry.getService("orion.page.progress");
			progress.progress(this.fileClient.fetchChildren(parentItem.ChildrenLocation), "Fetching children of " + parentItem.Name).then( 
				function(children) {
					onComplete(self.processParent(parentItem, children));
				}
			);
		} else {
			onComplete([]);
		}
	};
	FileModel.prototype.constructor = FileModel;


	/**
	 * Creates a new file explorer.
	 * @name orion.explorers.FileExplorer
	 * @class A user interface component that displays a table-oriented file explorer
	 * @extends orion.explorer.Explorer
	 *
	 * @param {Object} options.treeRoot an Object representing the root of the tree.
	 * @param {orion.selection.Selection} options.selection the selection service used to track selections.
	 * @param {orion.fileClient.FileClient} options.fileClient the file service used to retrieve file information
	 * @param {String|Element} options.parentId the id of the parent DOM element, or the parent DOM element itself.
	 * @param {Function} options.rendererFactory a factory that creates a renderer
	 * @param {Boolean} options.excludeFiles specifies that files should not be shown. Optional.
	 * @param {Boolean} options.excludeFolders specifies that folders should not be shown.  Optional.
	 * @param {Object} [options.navHandlerFactory] Optional factory to use for creating the explorer's nav handler. Must provide a function
	 * <code>createNavHandler(explorer, explorerNavDict, options)</code>.
	 * @param {orion.serviceregistry.ServiceRegistry} options.serviceRegistry  the service registry to use for retrieving other
	 *	Orion services.  Optional.  If not specified, then some features of the explorer will not be enabled, such as status reporting,
	 *  honoring preference settings, etc.
	 * @param {Boolean} [options.setFocus=true] Whether the explorer should steal keyboard focus when rendered. The default is to steal focus.
	 */
	/**
	 * Root model item of the tree.
	 * @name orion.explorers.FileExplorer#treeRoot
	 * @type {Object}
	 */
	function FileExplorer(options) {
		this.registry = options.serviceRegistry;
		this.treeRoot = options.treeRoot;
		this.selection = options.selection;
		this.fileClient = options.fileClient;
		this.excludeFiles = options.excludeFiles;
		this.excludeFolders = options.excludeFolders;
		this.navHandlerFactory = options.navHandlerFactory;
		this.parentId = options.parentId;
		this.renderer = options.rendererFactory(this);
		this.dragAndDrop = options.dragAndDrop;
		this.setFocus = options.setFocus;
		this.model = null;
		this.myTree = null;
		this.checkbox = false;
		this._hookedDrag = false;

		var renderer = this.renderer;
		if (this.registry) {
			this.registry.registerService("orion.cm.managedservice", //$NON-NLS-0$
				{	updated: function(properties) {
						var target;
						if (properties && properties["links.newtab"] !== "undefined") { //$NON-NLS-1$ //$NON-NLS-0$
							target = properties["links.newtab"] ? "_blank" : "_self"; //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
						} else {
							target = "_self"; //$NON-NLS-0$
						}
						renderer.setTarget(target);
					}
				}, {pid: "nav.config"}); //$NON-NLS-0$
		}
	}
	
	FileExplorer.prototype = new mExplorer.Explorer();
	
	FileExplorer.prototype._makeDropTarget = function(item, node, persistAndReplace) {
		function dropFileEntry(entry, path, target, explorer, performDrop, fileClient) {
			path = path || "";
			if (entry.isFile) {
				// can't drop files directly into workspace.
				if (mFileUtils.isAtRoot(target.Location)){ //$NON-NLS-0$
					explorer.registry.getService("orion.page.message").setProgressResult({ //$NON-NLS-0$
						Severity: "Error", Message: messages["You cannot copy files directly into the workspace.  Create a folder first."]});	 //$NON-NLS-1$ //$NON-NLS-0$ 
				} else {
					entry.file(function(file) {
						performDrop(target, file, explorer, file.name.indexOf(".zip") === file.name.length-4 && window.confirm(i18nUtil.formatMessage(messages["Unzip ${0}?"], file.name))); //$NON-NLS-1$ //$NON-NLS-0$ 
					});
				}
			} else if (entry.isDirectory) {
				var dirReader = entry.createReader();
				var traverseChildren = function(folder) {
					dirReader.readEntries(function(entries) {
						for (var i=0; i<entries.length; i++) {
							dropFileEntry(entries[i], path + entry.name + "/", folder, explorer, performDrop, fileClient); //$NON-NLS-0$
						}
					});
				};
				var progress = explorer.registry.getService("orion.page.progress");
				if (mFileUtils.isAtRoot(target.Location)){ //$NON-NLS-0$
					progress.progress(fileClient.createProject(target.ChildrenLocation, entry.name), "Initializing project " + entry.name).then(function(project) {
					explorer.loadResourceList(explorer.treeRoot.Path, true);					
					progress.progress(fileClient.read(project.ContentLocation, true), "Loading project info " + project.name).then(function(folder) {
							traverseChildren(folder);
						});
					});
				} else {
					progress.progress(fileClient.createFolder(target.Location, entry.name), "Creating folder " + entry.name).then(function(subFolder) {
						explorer.changedItem(target, true);
						traverseChildren(subFolder);
					});
				}
			}
		}
		
		if (this.dragAndDrop) {
			var explorer = this;
			var performDrop = this.dragAndDrop;
			
			var dragLeave = function(evt) { //$NON-NLS-0$
				node.classList.remove("dragOver"); //$NON-NLS-0$
				evt.preventDefault();
				evt.stopPropagation();
			};
			// if we are rehooking listeners on a node, unhook old before hooking and remembering new
			if (persistAndReplace) {
				if (this._oldDragLeave) {
					node.removeEventListener("dragleave", this._oldDragLeave, false); //$NON-NLS-0$
				}
				this._oldDragLeave = dragLeave;
			}
			node.addEventListener("dragleave", dragLeave, false); //$NON-NLS-0$

			var dragEnter = function (evt) { //$NON-NLS-0$
				if (evt.dataTransfer.effectAllowed === "all" ||   //$NON-NLS-0$
					evt.dataTransfer.effectAllowed === "uninitialized" ||  //$NON-NLS-0$
					evt.dataTransfer.effectAllowed.indexOf("copy") >= 0) {   //$NON-NLS-0$
					// only supported in Chrome.
						evt.dataTransfer.dropEffect = "copy";  //$NON-NLS-0$
				}   
				node.classList.add("dragOver"); //$NON-NLS-0$
				lib.stop(evt);
			};
			if (persistAndReplace) {
				if (this._oldDragEnter) {
					node.removeEventListener("dragenter", this._oldDragEnter, false); //$NON-NLS-0$
				}
				this._oldDragEnter = dragEnter;
			}
			node.addEventListener("dragenter", dragEnter, false); //$NON-NLS-0$

			// this listener is the same for any time, so we don't need to remove/rehook.
			var dragOver = function (evt) { //$NON-NLS-0$
				// default behavior is to not trigger a drop, so we override the default
				// behavior in order to enable drop.  
				// we have to specify "copy" again here, even though we did in dragEnter
				if (evt.dataTransfer.effectAllowed === "all" ||   //$NON-NLS-0$
					evt.dataTransfer.effectAllowed === "uninitialized" ||  //$NON-NLS-0$
					evt.dataTransfer.effectAllowed.indexOf("copy") >= 0) {   //$NON-NLS-0$
					// only supported in Chrome.
						evt.dataTransfer.dropEffect = "copy";  //$NON-NLS-0$
				}   
				lib.stop(evt);
			};
			if (persistAndReplace && !this._oldDragOver) {
				node.addEventListener("dragover", dragOver, false); //$NON-NLS-0$
				this._oldDragOver = dragOver;
			}

			var drop = function(evt) { //$NON-NLS-0$
				node.classList.remove("dragOver"); //$NON-NLS-0$
				// webkit supports testing for and traversing directories
				// http://wiki.whatwg.org/wiki/DragAndDropEntries
				if (evt.dataTransfer.items && evt.dataTransfer.items.length > 0) {
					for (var i=0; i<evt.dataTransfer.items.length; i++) {
						var entry = null;
						if (typeof evt.dataTransfer.items[i].getAsEntry === "function") { //$NON-NLS-0$
							entry = evt.dataTransfer.items[i].getAsEntry();
						} else if (typeof evt.dataTransfer.items[i].webkitGetAsEntry === "function") { //$NON-NLS-0$
							entry = evt.dataTransfer.items[i].webkitGetAsEntry();
						}
						if (entry) {
							dropFileEntry(entry, null, item, explorer, performDrop, explorer.fileClient);
						}
					}
				} else if (evt.dataTransfer.files && evt.dataTransfer.files.length > 0) {
					for (var i=0; i<evt.dataTransfer.files.length; i++) {
						var file = evt.dataTransfer.files[i];
						// this test is reverse engineered as a way to figure out when a file entry is a directory.
						// The File API in HTML5 doesn't specify a way to check explicitly (when this code was written).
						// see http://www.w3.org/TR/FileAPI/#file
						if (!file.length && (!file.type || file.type === "")) {
							explorer.registry.getService("orion.page.message").setProgressResult( //$NON-NLS-0$
								{Severity: "Error", Message: i18nUtil.formatMessage(messages["Did not drop ${0}.  Folder drop is not supported in this browser."], file.name)}); //$NON-NLS-1$ //$NON-NLS-0$ 
						} else if (mFileUtils.isAtRoot(item.Location)){ //$NON-NLS-0$
							explorer.registry.getService("orion.page.message").setProgressResult({ //$NON-NLS-0$
								Severity: "Error", Message: messages["You cannot copy files directly into the workspace.  Create a folder first."]});	 //$NON-NLS-1$ //$NON-NLS-0$ 
						} else {
							performDrop(item, file, explorer, file.name.indexOf(".zip") === file.name.length-4 && window.confirm(i18nUtil.formatMessage(messages["Unzip ${0}?"], file.name))); //$NON-NLS-1$ //$NON-NLS-0$ 
						}
					}
				}
				lib.stop(evt);
			};
			if (persistAndReplace) {
				if (this._oldDrop) {
					node.removeEventListener("drop", this._oldDrop, false); //$NON-NLS-0$
				}
				this._oldDrop = drop;
			}
			node.addEventListener("drop", drop, false); //$NON-NLS-0$
		}
	};

	/**
	 * @name orion.explorers.FileExplorer#changedItem
	 * @function
	 * we have changed an item on the server at the specified parent node
	 * @param {Object} parent The parent item under which the change occurred.
	 * @param {Boolean} forceExpand
	 * @returns {orion.Promise}
	 */
	FileExplorer.prototype.changedItem = function(parent, forceExpand) {
		var that = this;
		var progress = this.registry.getService("orion.page.progress");
		return progress.progress(this.fileClient.fetchChildren(parent.ChildrenLocation), "Fetching children of " + parent.Name).then(function(children) {
			children = that.model.processParent(parent, children);
			//If a key board navigator is hooked up, we need to sync up the model
			if(that.getNavHandler()){
				//that._initSelModel();
			}
			that.myTree.refresh.bind(that.myTree)(parent, children, forceExpand);
			return new Deferred().resolve(children);
		});
	};
	
	FileExplorer.prototype.isExpanded = function(item) {
		var rowId = this.model.getId(item);
		return this.renderer.tableTree.isExpanded(rowId);
	};

	/**
	 * Returns the node that a rename text input box should appear over top of.
	 * @name orion.explorers.FileExplorer#getNameNode
	 * @function
	 * @param {Object} item Item being renamed
	 * @returns {Element}
	 */
	FileExplorer.prototype.getNameNode = function(item) {
		var rowId = this.model.getId(item);
		if (rowId) {
			// I know this from my renderer below.
			// TODO This approach fails utterly for a custom renderer, better hope they override this method.
			return lib.node(rowId+"NameLink"); //$NON-NLS-0$
		}
	};
		
	/**
	 * The explorerNavHandler hooked up by the explorer will call this function when left arrow key is pressed on a 
	 * top level item that is aleady collapsed. The default implementation does nothing.
	 * @name orion.explorers.FileExplorer#scopeUp
	 * @function
	 */
	FileExplorer.prototype.scopeUp = function() {
	};
	
	/**
	 * Load the resource at the given path.
	 * @name orion.explorers.FileExplorer#loadResourceList
	 * @function
	 * @param path The path of the resource to load
	 * @param {Boolean} [force] If true, force reload even if the path is unchanged. Useful
	 * when the client knows the resource underlying the current path has changed.
	 * @param postLoad a function to call after loading the resource
	 */
	FileExplorer.prototype.loadResourceList = function(path, force, postLoad) {
		path = mFileUtils.makeRelative(path);
		if (!force && path === this._lastPath) {
			return new Deferred().resolve(this.treeRoot);
		}			
		this._lastPath = path;
		var self = this;
		if (force || (path !== this.treeRoot.Path)) {
			return this.load(this.fileClient.loadWorkspace(path), "Loading " + path).then(function() {
				self.treeRoot.Path = path;
				if (typeof postLoad === "function") { //$NON-NLS-0$
					postLoad();
				}
				return new Deferred().resolve(self.treeRoot);
			}, function(err) {
				self.treeRoot.Path = null;
				return new Deferred().reject(err);
			});
		}
		return new Deferred().resolve(self.treeRoot);
	};
	
	/**
	 * Load the explorer with the given root
	 * @name orion.explorers.FileExplorer#load
	 * @function
	 * @param {Object} root a root object or a deferred that will return the root of the FileModel
	 * @param {String} progress a string progress message describing the fetch of the root
	 * @returns {orion.Promise} A promise that resolves to the loaded <code>treeRoot</code>, or rejects with an error.
	 */
	FileExplorer.prototype.load = function(root, progressMessage, postLoad) {
		var parent = lib.node(this.parentId);			

		// Progress indicator
		var progress = lib.node("progress");  //$NON-NLS-0$
		if(!progress){
			progress = document.createElement("div"); //$NON-NLS-0$
			progress.id = "progress"; //$NON-NLS-0$
			lib.empty(parent);
			parent.appendChild(progress);
		}
		lib.empty(progress);
		
		var progressTimeout = setTimeout(function() {
			lib.empty(progress);
			progress.appendChild(document.createTextNode(progressMessage));
		}, 500); // wait 500ms before displaying
					
		var self = this;
		return Deferred.when(root,
			function(root) {
				self.treeRoot = {};
				clearTimeout(progressTimeout);
				// copy properties from root json to our object
				for (var property in root) {
					self.treeRoot[property] = root[property];
				}
				self.model = new FileModel(self.registry, self.treeRoot, self.fileClient, self.parentId, self.excludeFiles, self.excludeFolders);
				self.model.processParent(self.treeRoot, root.Children);	
				if (self.dragAndDrop) {
					if (self._hookedDrag) {
						// rehook on the parent to indicate the new root location
						self._makeDropTarget(self.treeRoot, parent, true);
					} else {
						// uses two different techniques from Modernizr
						// first ascertain that drag and drop in general is supported
						var supportsDragAndDrop = parent && (('draggable' in parent) || ('ondragstart' in parent && 'ondrop' in parent));  //$NON-NLS-2$  //$NON-NLS-1$  //$NON-NLS-0$ 
						// then check that file transfer is actually supported, since this is what we will be doing.
						// For example IE9 has drag and drop but not file transfer
						supportsDragAndDrop = supportsDragAndDrop && !!(window.File && window.FileList && window.FileReader);
						self._hookedDrag = true;
						if (supportsDragAndDrop) {
							self._makeDropTarget(self.treeRoot, parent, true);
						} else {
							self.dragAndDrop = null;
							window.console.log("Local file drag and drop is not supported in this browser."); //$NON-NLS-0$
						}
					}
				}

				self.createTree(self.parentId, self.model, {
					navHandlerFactory: self.navHandlerFactory,
					setFocus: (typeof self.setFocus === "undefined" ? true : self.setFocus), 
					selectionPolicy: self.renderer.selectionPolicy, 
					onCollapse: function(model){
						if(self.getNavHandler()){
							self.getNavHandler().onCollapse(model);
						}
					}});
				if (typeof postLoad === "function") { //$NON-NLS-0$
					try {
						postLoad();
					} catch(e){
						if (self.registry) {
							self.registry.getService("orion.page.message").setErrorMessage(e);	 //$NON-NLS-0$
						}
					}
				}				
				if (typeof self.onchange === "function") { //$NON-NLS-0$
					self.onchange(self.treeRoot);
				}
				return new Deferred().resolve(self.treeRoot);
			},
			function(error) {
				clearTimeout(progressTimeout);
				// Show an error message when a problem happens during getting the workspace
				self.registry.getService("orion.page.message").setProgressResult(error); //$NON-NLS-0$
				return new Deferred().reject(error);
			}
		);
	};
	/**
	 * Called when the root item changes. This can be overridden.
	 * @name orion.explorers.FileExplorer#onchange
	 * @function
	 * @param {Object} item
	 */
	FileExplorer.prototype.onchange = function(item) {
	};
	FileExplorer.prototype.constructor = FileExplorer;

	//return module exports
	return {
		FileExplorer: FileExplorer,
		FileModel: FileModel
	};
});
