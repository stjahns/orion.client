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

/*global define console window*/
/*jslint regexp:false browser:true forin:true*/

define(['i18n!orion/search/nls/messages', 'require', 'orion/webui/littlelib', 'orion/contentTypes', 'orion/i18nUtil', 'orion/explorers/explorer', 'orion/explorers/explorerNavHandler', 'orion/fileClient', 'orion/commands', 'orion/searchUtils', 'orion/globalSearch/search-features', 'orion/compare/compare-features', 'orion/compare/compare-container', 'orion/explorers/navigationUtils', 'orion/webui/tooltip'],

function(messages, require, lib, mContentTypes, i18nUtil, mExplorer, mNavHandler, mFileClient, mCommands, mSearchUtils, mSearchFeatures, mCompareFeatures, mCompareContainer, mNavUtils, mTooltip) {
    /* Internal wrapper functions*/
    function _empty(nodeToEmpty) {
        var node = lib.node(nodeToEmpty);
        if (node) {
            lib.empty(node);
        }
    }

    function _connect(nodeOrId, event, eventHandler) {
        var node = lib.node(nodeOrId);
        if (node) {
            node.addEventListener(event, eventHandler, false);
        }
    }

    function _place(ndoeToPlace, parent, position) {
        var parentNode = lib.node(parent);
        if (parentNode) {
            if (position === "only") {
                lib.empty(parentNode);
            }
            parentNode.appendChild(ndoeToPlace);
        }
    }

    function _createElement(elementTag, classNames, id, parent) {
        var element = document.createElement(elementTag);
        if (classNames) {
            if (Array.isArray(classNames)) {
                for (var i = 0; i < classNames.length; i++) {
                    element.classList.add(classNames[i]);
                }
            } else if (typeof classNames === "string") {
                element.className = classNames;
            }
        }
        if (id) {
            element.id = id;
        }
        var parentNode = lib.node(parent);
        if (parentNode) {
            parentNode.appendChild(element);
        }
        return element;
    }

    function _createLink(classNames, id, href, parent, linkName) {
        var link = _createElement('a', classNames, id, parent); //$NON-NLS-2$
        link.href = href;
        if (linkName) {
            link.appendChild(document.createTextNode(linkName));
        }
        return link;
    }

    function _createSpan(classNames, id, parent, spanName) {
        var span = _createElement('span', classNames, id, parent); //$NON-NLS-2$
        if (spanName) {
            span.appendChild(document.createTextNode(spanName));
        }
        return span;
    }

    /*** Internal model wrapper functions ***/

    function _getFileModel(modelItem) {
        if (!modelItem) {
            return null;
        }
        if (modelItem.type === "file") { //$NON-NLS-0$
            return modelItem;
        }
        return modelItem.parent;
    };

    function _onSameFile(modelItem1, modelItem2) {
        return _getFileModel(modelItem1) === _getFileModel(modelItem2);
    };

    function _validFiles(searchModel) {
        if (typeof searchModel.getValidFileList === "function") { //$NON-NLS-0$
            return searchModel.getValidFileList();
        }
        return searchModel.getListRoot().children;
    };

    function _headerString(searchModel) {
        if (typeof searchModel.getHeaderString === "function") { //$NON-NLS-0$
            return searchModel.getHeaderString();
        }
        return messages["Results"]; //$NON-NLS-0$;
    };
    /*
     *	The model to support the search result.
     */
    function SearchResultModel(serviceRegistry, fileClient, resultLocation, totalNumber, searchParams, options) {
        this.registry = serviceRegistry;
        this.fileClient = fileClient;
        this._resultLocation = resultLocation;
        this._numberOnPage = resultLocation.length;
        this._totalNumber = totalNumber;
        this._listRoot = {
            isRoot: true,
            children: []
        };
        this._indexedFileItems = [];
        this._location2ModelMap = [];
        this._lineDelimiter = "\n"; //$NON-NLS-0$
        this.onMatchNumberChanged = options.onMatchNumberChanged;
        this._searchHelper = mSearchUtils.generateSearchHelper(searchParams);
    }
    SearchResultModel.prototype = new mExplorer.ExplorerModel();

    /*** Over write all the prototypes defined by mExplorer.ExplorerModel ***/
    SearchResultModel.prototype.getRoot = function(onItem) {
        onItem(this.getListRoot());
    };

    SearchResultModel.prototype.getChildren = function(parentItem, onComplete) {
        if (!parentItem) {
            return;
        }
        if (parentItem.children) {
            onComplete(parentItem.children);
        } else if (parentItem.type === "detail") { //$NON-NLS-0$
            onComplete([]);
        } else if (parentItem.type === "file" && parentItem.location) { //$NON-NLS-0$
            if (this._searchHelper.params.keyword === "") {
                return;
            }
            this.registry.getService("orion.page.progress").progress(this.fileClient.read(parentItem.location), "Getting file contents " + parentItem.name).then(

            function(jsonData) {
                mSearchUtils.searchWithinFile(this._searchHelper.inFileQuery, parentItem, jsonData, this._lineDelimiter, this.replaceMode(), this._searchHelper.params.caseSensitive);
                if (this.onMatchNumberChanged) {
                    this.onMatchNumberChanged(parentItem);
                }
                onComplete(parentItem.children);
            }.bind(this),

            function(error) {
                console.error("Error loading file content: " + error.message); //$NON-NLS-0$
                onComplete([]);
            }.bind(this));
        } else {
            onComplete([]);
        }
    };

    SearchResultModel.prototype.getId = function(item) {
        var result;
        if (item === this.getListRoot()) {
            result = this.rootId;
        } else {
            result = item.location;
            // remove all non valid chars to make a dom id. 
            result = result.replace(/[^\.\:\-\_0-9A-Za-z]/g, "");
        }
        return result;
    };

    /*** Prototypes required by the search/replace renderer and explorer ***/

    /**
     * Return the root model. Required function.
     * There should be three layers of the root model. Any model item in each layer must have a string property called type.
     * The top layer is the root model whose type is "root". It should have a property callded children which is an array object.
     * The middle layer is the files whose type is "file". It should have a property callded children which is an array object and a property called parent which points to the root model.
     * The bottom layer is the detail matches within a file, whose type is "detail". It should have a property called parent which points to the file item.
     */
    SearchResultModel.prototype.getListRoot = function() {
        return this._listRoot;
    };

    /**
     * build the model tree. Required function.
     * There should be three layers of the root model. Any model item in each layer must have a string property called type.
     * The top layer is the root model whose type is "root". It should have a property callded children which is an array object.
     * The middle layer is the files whose type is "file". It should have a property callded children which is an array object and a property called parent which points to the root model.
     * The bottom layer is the detail matches within a file, whose type is "detail". It should have a property called parent which points to the file item.
     */
    SearchResultModel.prototype.buildResultModel = function() {
        this._restoreGlobalStatus();
        this._indexedFileItems = [];
        for (var i = 0; i < this._resultLocation.length; i++) {
            var childNode = {
                parent: this.getListRoot(),
                type: "file",
                name: this._resultLocation[i].name,
                lastModified: this._resultLocation[i].lastModified, //$NON-NLS-0$
                linkLocation: this._resultLocation[i].linkLocation,
                location: this._resultLocation[i].location,
                parentLocation: mSearchUtils.path2FolderName(this._resultLocation[i].location, this._resultLocation[i].name, true),
                fullPathName: mSearchUtils.path2FolderName(this._resultLocation[i].path, this._resultLocation[i].name)
            };
            this._location2ModelMap[childNode.location] = childNode;
            this.getListRoot().children.push(childNode);
            this._indexedFileItems.push(childNode);
        }
    };

    /**
     * Determines if the model is in replace mode. Required function.
     */
    SearchResultModel.prototype.replaceMode = function() {
        return (typeof this._searchHelper.params.replace === "string"); //$NON-NLS-0$
    };

    /**
     * Get the paging paramerterss. Required function.
     * The return value is an object containing the following properties:
     * totalNumber: the total number of files in the model
     * start: the zero-based number of the starting number of the file in this page.
     * rows: max number of files per page.
     * numberOnPage: current file numbers on the page
     */
    SearchResultModel.prototype.getPagingParams = function() {
        return {
            totalNumber: this._totalNumber,
            start: this._searchHelper.params.start,
            rows: this._searchHelper.params.rows,
            numberOnPage: this._numberOnPage
        };
    };

    /**
     * Get the scoping paramerters by a given model item. Required function.
     * This function is for customizing each link on the "Location" column. Each link represents an URL that can scope down the search.
     * @param {Object} modelItem The given model item.
     * The return value is an object containing the following properties:
     * name: String. The name of the link.
     * href: String. The href of the link.
     * tooltip: String. The tooltip of the link.
     */
    SearchResultModel.prototype.getScopingParams = function(modelItem) {
        //TODO: Ask the model to give the HREF
        var qParams = mSearchUtils.copySearchParams(this._searchHelper.params, true);
        qParams.resource = modelItem.parentLocation;
        qParams.start = 0;
        var href = mSearchUtils.generateSearchHref(qParams);
        var tooltip = i18nUtil.formatMessage(messages["Search again in this folder with \"${0}\""], this._searchHelper.displayedSearchTerm);
        return {
            name: modelItem.fullPathName,
            href: href,
            tooltip: tooltip
        };
    };

    /**
     * Get the file contents by a given file model. Async call. Required function.
     */
    SearchResultModel.prototype.provideFileContent = function(fileItem, onComplete) {
        if (fileItem.contents) {
            onComplete(fileItem);
        } else {
            this.registry.getService("orion.page.progress").progress(this.fileClient.read(fileItem.location), "Getting file contents " + fileItem.Name).then(

            function(jsonData) {
                mSearchUtils.searchWithinFile(this._searchHelper.inFileQuery, fileItem, jsonData, this._lineDelimiter, this.replaceMode(), this._searchHelper.params.caseSensitive);
                onComplete(fileItem);
            }.bind(this),

            function(error) {
                console.error("Error loading file content: " + error.message); //$NON-NLS-0$
                onComplete(null);
            }.bind(this));
        }
    };

    /**
     * Get the file contents by a given file model. Sync call. Required function.
     */
    SearchResultModel.prototype.getFileContent = function(fileItem) {
        return fileItem.contents.join(this._lineDelimiter);
    }

    /**
     * Get the replaced file contents by a given file model. Sync call. Required function.
     */
    SearchResultModel.prototype.getReplacedFileContent = function(fileItem) {
        return fileItem.contents.join(this._lineDelimiter);
    }



    /**
     * Write the replace file contents. Required function.
     * @param {Array} reportList The array of the report items.
     * Each item of the reportList contains the following properties
     * model: the file item
     * matchesReplaced: The number of matches that replaced in this file
     * status: "pass" or "failed"
     * message: Optional. The error message when writing fails.
     * @param {Number} index The index of the result of the valid file list. The function has to recursively increase the number till the lengh of the file list.
     */
    SearchResultModel.prototype.writeIncrementalNewContent = function(reportList, index, onComplete) {
        var model = _validFiles(this)[index];
        if (!model || index === _validFiles(this).length) {
            onComplete(_validFiles(this));
            return;
        }
        var matchesReplaced = this._matchesReplaced(model);
        if (matchesReplaced > 0) {
            this.provideFileContent(model, function(fileItem) {
                matchesReplaced = this._matchesReplaced(fileItem);
                var newContents = [];
                mSearchUtils.generateNewContents(fileItem.contents, newContents, fileItem, this._searchHelper.params.replace, this._searchHelper.inFileQuery.searchStrLength);
                var contents = newContents.join(this._lineDelimiter);

                var etag = fileItem.ETag;
                var args = etag ? {
                    "ETag": etag
                } : null; //$NON-NLS-0$
                this.registry.getService("orion.page.progress").progress(this.fileClient.write(model.location, contents, args), "Saving changes to " + model.location).then(

                function(result) {
                    reportList.push({
                        model: model,
                        matchesReplaced: matchesReplaced,
                        status: "pass"
                    }); //$NON-NLS-0$
                    this.writeIncrementalNewContent(reportList, index + 1, onComplete);
                }.bind(this),

                function(error) {
                    // expected error - HTTP 412 Precondition Failed 
                    // occurs when file is out of sync with the server
                    if (error.status === 412) {
                        reportList.push({
                            model: model,
                            message: messages["Resource has been changed by others."],
                            matchesReplaced: matchesReplaced,
                            status: "failed"
                        }); //$NON-NLS-1$
                    }
                    // unknown error
                    else {
                        error.log = true;
                        reportList.push({
                            model: model,
                            message: messages["Failed to write file."],
                            matchesReplaced: matchesReplaced,
                            status: "failed"
                        }); //$NON-NLS-1$
                    }
                    this.writeIncrementalNewContent(reportList, index + 1, onComplete);
                }.bind(this));

            }.bind(this));

        } else {
            this.writeIncrementalNewContent(reportList, index + 1, onComplete);
        }

    };

    /**
     * Return the string that describe the header of the file column. Optional.
     * If not defined, "Results" is used.
     */
    SearchResultModel.prototype.getHeaderString = function() {
        var headerStr = messages["Results"]; //$NON-NLS-0$
        if (this._searchHelper.displayedSearchTerm) {
            var pagingParams = this.getPagingParams();
            if (pagingParams.numberOnPage > 0) {
                var startNumber = pagingParams.start + 1;
                var endNumber = startNumber + pagingParams.numberOnPage - 1;
                headerStr = "";
                if (!this.replaceMode()) {
                    headerStr = i18nUtil.formatMessage(messages["Files ${0} of ${1} matching ${2}"],
                    startNumber + "-" + endNumber, pagingParams.totalNumber, this._searchHelper.displayedSearchTerm);
                } else {
                    headerStr = i18nUtil.formatMessage(messages["Replace ${0} with ${1} for files ${2} of ${3}"],
                    this._searchHelper.displayedSearchTerm,
                    this._searchHelper.params.replace,
                    startNumber + "-" + endNumber, //$NON-NLS-2$
                    pagingParams.totalNumber);
                }
            }
        }
        return headerStr;
    };

    /**
     * The function to return the list of valid files. Optional.
     * If not defined, this.getListRoot().children is used.
     * For example, if staled files appear in the children of the root model, theses files have to be filtered out so that the valid file list will exclude them.
     */
    SearchResultModel.prototype.getValidFileList = function() {
        return this._indexedFileItems;
    };

    /**
     * Store the current selected model in to a session storage. Optional.
     * If defined, this function is called every time a selection on the model is changed by user.
     */
    SearchResultModel.prototype.storeLocationStatus = function(currentModel) {
        if (currentModel) {
            var fileItem = _getFileModel(currentModel);
            window.sessionStorage[this._searchHelper.params.keyword + "_search_result_currentFileLocation"] = fileItem.location; //$NON-NLS-0$
            if (currentModel.type === "file") { //$NON-NLS-0$
                window.sessionStorage[this._searchHelper.params.keyword + "_search_result_currentDetailIndex"] = "none"; //$NON-NLS-1$ //$NON-NLS-0$
            } else {
                window.sessionStorage[this._searchHelper.params.keyword + "_search_result_currentDetailIndex"] = JSON.stringify(this._model2Index(currentModel)); //$NON-NLS-0$
            }
        }
    };

    /**
     * Restore the previously selected model when the page is restored. Optional.
     * If defined, this function is called every time when the page is loaded.
     */
    SearchResultModel.prototype.restoreLocationStatus = function() {
        var currentFileLocation = window.sessionStorage[this._searchHelper.params.keyword + "_search_result_currentFileLocation"]; //$NON-NLS-0$
        var fileModel = this._location2Model(currentFileLocation);
        var currentDetailIndex = "none"; //$NON-NLS-0$
        var detailIndexCached = window.sessionStorage[this._searchHelper.params.keyword + "_search_result_currentDetailIndex"]; //$NON-NLS-0$
        if (typeof detailIndexCached === "string") { //$NON-NLS-0$
            if (detailIndexCached.length > 0) {
                currentDetailIndex = detailIndexCached;
            }
        }
        return {
            file: fileModel,
            detail: currentDetailIndex
        };
    };


    /*** Internal model functions ***/

    SearchResultModel.prototype._provideSearchHelper = function() {
        return this._searchHelper;
    };

    SearchResultModel.prototype._model2Index = function(model, list) {
        var lookAt = list;
        if (!lookAt && model.parent) {
            lookAt = model.parent.children;
        }
        if (lookAt) {
            for (var i = 0; i < lookAt.length; i++) {
                if (lookAt[i] === model) {
                    return i;
                }
            }
        }
        return -1;
    };

    SearchResultModel.prototype._location2Model = function(location) {
        if (location && this._location2ModelMap[location]) {
            return this._location2ModelMap[location];
        }
        if (this._indexedFileItems.length > 0) {
            return this._indexedFileItems[0];
        }
        return null;
    };

    SearchResultModel.prototype._restoreGlobalStatus = function() {
        this.defaultReplaceStr = this._searchHelper.displayedSearchTerm;
        var defaultReplaceStr = window.sessionStorage["global_search_default_replace_string"]; //$NON-NLS-0$
        if (typeof defaultReplaceStr === "string") { //$NON-NLS-0$
            if (defaultReplaceStr.length > 0) {
                this.defaultReplaceStr = defaultReplaceStr;
            }
        }
        this.sortByName = (this._provideSearchHelper().params.sort.indexOf("Name") > -1); //$NON-NLS-0$
    };

    SearchResultModel.prototype._storeGlobalStatus = function(replacingStr) {
        window.sessionStorage["global_search_default_replace_string"] = replacingStr; //$NON-NLS-0$
    };

    SearchResultModel.prototype._matchesReplaced = function(model) {
        var matchesReplaced = 0;
        if (!model.children) {
            return model.checked === false ? 0 : 1;
        }
        if (model.children) {
            for (var j = 0; j < model.children.length; j++) {
                if (!(model.children[j].checked === false)) {
                    matchesReplaced += 1;
                }
            }
        }
        return matchesReplaced;
    };

    SearchResultModel.prototype._hitOnceWithinFile = function(fileContentText) {
        var lineString = fileContentText.toLowerCase();
        var result;
        if (this._searchHelper.inFileQuery.wildCard) {
            result = mSearchUtils.searchOnelineRegEx(this._searchHelper.inFileQuery, lineString, true);
        } else {
            result = mSearchUtils.searchOnelineLiteral(this._searchHelper.inFileQuery, lineString, true);
        }
        return result;
    };

    SearchResultModel.prototype.constructor = SearchResultModel;

    //Renderer to render the model
    function SearchResultRenderer(options, explorer) {
        this._init(options);
        this.explorer = explorer;
    }
    SearchResultRenderer.prototype = new mExplorer.SelectionRenderer();

    // TODO:  this should be handled outside of here in a common select all command
    // see https://bugs.eclipse.org/bugs/show_bug.cgi?id=339500
    SearchResultRenderer.prototype.initCheckboxColumn = function(tableNode) {
        if (this._useCheckboxSelection) {
            var th = _createElement('th'); //$NON-NLS-0$
            var check = _createElement("span", null, null, th); //$NON-NLS-0$
            check.classList.add('selectionCheckmarkSprite'); //$NON-NLS-0$
            check.classList.add('core-sprite-check'); //$NON-NLS-0$
            if (this.getCheckedFunc) {
                check.checked = this.getCheckedFunc(this.explorer.model.getListRoot());
                check.classList.toggle("core-sprite-check_on"); //$NON-NLS-0$
            }
            _connect(check, "click", function(evt) { //$NON-NLS-0$
                var newValue = evt.target.checked ? false : true;
                this.onCheck(null, evt.target, newValue);
            }.bind(this));
            return th;
        }
    };

    SearchResultRenderer.prototype.getCellHeaderElement = function(col_no) {
        if (col_no > 2) {
            return null;
        }
        var title, header;
        if (col_no !== 0) {
            title = _createElement("th"); //$NON-NLS-2
            header = _createElement("h2", "search_header", null, title); //$NON-NLS-2
            if (col_no === 1) {
                var displayStr = _headerString(this.explorer.model);
                return title;
            } else if (col_no === 2) {
                header.textContent = messages["Location"];
            }
            return title;
        } else {
            return _createElement("th"); //$NON-NLS-0$
        }
    };

    SearchResultRenderer.prototype.focus = function() {
        var resultParentDiv = lib.node(this.explorer.getParentDivId());
        window.setTimeout(function() {
            resultParentDiv.focus();
        }, 10);
    };

    SearchResultRenderer.prototype.staleFileElement = function(item) {
        if (item.stale) {
            var navGridHolder = this.explorer.getNavDict() ? this.explorer.getNavDict().getGridNavHolder(item, true) : null;
            mNavUtils.removeNavGrid(navGridHolder, lib.node(this.getItemLinkId(item)));
            var span = lib.node(this.getFileSpanId(item));
            _empty(span);
            _place(document.createTextNode(item.name), span, "last"); //$NON-NLS-0$
            span = lib.node(this.getFileIconId(item));
            _empty(span);
        }
    };

    SearchResultRenderer.prototype.replaceFileElement = function(item) {
        var renderName = item.totalMatches ? item.name + " (" + item.totalMatches + " matches)" : item.name; //$NON-NLS-1$ //$NON-NLS-0$
        var linkDiv = lib.node(this.getItemLinkId(item));
        _place(document.createTextNode(renderName), linkDiv, "only"); //$NON-NLS-0$
    };

    SearchResultRenderer.prototype.replaceDetailIcon = function(item, direction) {
        if (this.explorer.model.replaceMode()) {
            return;
        }
        if (!item || item.type !== "detail") { //$NON-NLS-0$
            return;
        }
        var iconSpan = lib.node(this.getDetailIconId(item));
        if (!iconSpan) {
            return;
        }
        _empty(iconSpan);
        var icon = _createSpan(null, null, iconSpan);
        icon.classList.add('imageSprite'); //$NON-NLS-0$
        if (direction === "right") { //$NON-NLS-0$
            icon.classList.add('core-sprite-rightarrow'); //$NON-NLS-0$
        } else if (direction === "left") { //$NON-NLS-0$
            icon.classList.add('core-sprite-leftarrow'); //$NON-NLS-0$
        } else {
            icon.classList.add('core-sprite-none'); //$NON-NLS-0$
        }
    };

    SearchResultRenderer.prototype.renderFileElement = function(item, spanHolder, renderName) {
        var helper = null;
        if (this.explorer.model._provideSearchHelper) {
            helper = this.explorer.model._provideSearchHelper();
        }
        var href = item.linkLocation + (helper ? mSearchUtils.generateFindURLBinding(helper.params, helper.inFileQuery, null, this.explorer._replaceStr) : "");
        var link = _createLink('navlink', this.getItemLinkId(item), href, spanHolder, renderName); //$NON-NLS-0$
        mNavUtils.addNavGrid(this.explorer.getNavDict(), item, link);
    };

    SearchResultRenderer.prototype.generateContextTip = function(detailModel) {
        var tableNode = _createElement('table', "search_context_tip");
        for (var i = 0; i < detailModel.context.length; i++) {
            var lineDiv = _createElement('tr', null, null, tableNode); //$NON-NLS-0$
            if (detailModel.context[i].current) {
                var lineTd = _createElement('td', null, null, lineDiv);
                lineTd.noWrap = true;
                var span = _createElement('span', "primaryColumn", null, lineTd);
                this.generateDetailHighlight(detailModel, span); //$NON-NLS-1$ //$NON-NLS-0$
            } else {
                var lineTd = _createElement('td', null, null, lineDiv);
                lineTd.noWrap = true;
                lineTd.textContent = detailModel.context[i].context + "\u00a0"; //$NON-NLS-0$
            }
        }
        return tableNode;
    };

    SearchResultRenderer.prototype.generateDetailHighlight = function(detailModel, parentSpan) {
        var startIndex = 0;
        //TODO: ask the model to provide the highlighting model
        var gap = this.explorer.model._searchHelper.inFileQuery.searchStrLength;
        for (var i = 0; i < detailModel.matches.length; i++) {
            if (startIndex >= detailModel.name.length) break;
            if (this.explorer.model.replaceMode()) {
                if (i !== (detailModel.matchNumber - 1)) {
                    continue;
                }
            }

            if (startIndex !== detailModel.matches[i].startIndex) {
                _place(document.createTextNode(detailModel.name.substring(startIndex, detailModel.matches[i].startIndex)), parentSpan, "last"); //$NON-NLS-0$
            }
            var matchSegBold = _createElement('b', null, null, parentSpan);
            if (this.explorer.model._searchHelper.inFileQuery.wildCard) {
                gap = detailModel.matches[i].length;
            }
            _place(document.createTextNode(detailModel.name.substring(detailModel.matches[i].startIndex, detailModel.matches[i].startIndex + gap)), matchSegBold, "only"); //$NON-NLS-0$
            startIndex = detailModel.matches[i].startIndex + gap;
            if (this.explorer.model.replaceMode()) {
                break;
            }
        }
        if (startIndex < (detailModel.name.length - 1)) {
            _place(document.createTextNode(detailModel.name.substring(startIndex)), parentSpan, "last"); //$NON-NLS-0$
        }
    };

    SearchResultRenderer.prototype.renderDetailElement = function(item, tableRow, spanHolder, renderNumber) {
        var linkSpan = this.getDetailElement(item, tableRow, spanHolder);
        if (renderNumber) {
            this.renderDetailLineNumber(item, linkSpan);
        }
        this.generateDetailHighlight(item, linkSpan);
    };

    SearchResultRenderer.prototype.renderDetailLineNumber = function(item, spanHolder) {
        if (!this.explorer.model.replaceMode() || item.matches.length <= 1) {
            _place(document.createTextNode(item.lineNumber + ":"), spanHolder, "last"); //$NON-NLS-1$ //$NON-NLS-0$
        } else {
            _place(document.createTextNode(item.lineNumber + "(" + item.matchNumber + "):"), spanHolder, "last"); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
        }
    };

    SearchResultRenderer.prototype.getDetailElement = function(item, tableRow, spanHolder) {
        var that = this;
        var helper = null;
        if (this.explorer.model._provideSearchHelper) {
            helper = this.explorer.model._provideSearchHelper();
        }
        var linkLocation = item.parent.linkLocation + (helper ? mSearchUtils.generateFindURLBinding(helper.params, helper.inFileQuery, item.lineNumber, this.explorer._replaceStr) : "");
        var link = _createLink('navlink', this.getItemLinkId(item), linkLocation, spanHolder); //$NON-NLS-0$
        mNavUtils.addNavGrid(this.explorer.getNavDict(), item, link);
        _connect(link, "click", function() { //$NON-NLS-0$
            that.explorer.getNavHandler().cursorOn(item);
        });
        var span = _createElement('span', null, null, link); //$NON-NLS-0$
        return span;
    };

    //This is an optional function for explorerNavHandler. It provides the div with the "href" attribute.
    //The explorerNavHandler hooked up by the explorer will check if the href exist as the attribute and react on enter key press.
    SearchResultRenderer.prototype.getRowActionElement = function(tableRowId) {
        return lib.node(this.getItemLinkId(tableRowId));
    };

    SearchResultRenderer.prototype.getLocationSpanId = function(item) {
        return this.explorer.model.getId(item) + "_locationSpan"; //$NON-NLS-0$
    };

    SearchResultRenderer.prototype.getFileSpanId = function(item) {
        return this.explorer.model.getId(item) + "_fileSpan"; //$NON-NLS-0$
    };

    SearchResultRenderer.prototype.getFileIconId = function(item) {
        return this.explorer.model.getId(item) + "_fileIcon"; //$NON-NLS-0$
    };

    SearchResultRenderer.prototype.getItemLinkId = function(itemOrId) {
        if (typeof itemOrId === "string") { //$NON-NLS-0$
            return itemOrId + "_itemLink"; //$NON-NLS-0$
        }
        return this.explorer.model.getId(itemOrId) + "_itemLink"; //$NON-NLS-0$
    };

    SearchResultRenderer.prototype.getDetailIconId = function(item) {
        return this.explorer.model.getId(item) + "_detailIcon"; //$NON-NLS-0$
    };

    SearchResultRenderer.prototype.renderLocationElement = function(item, onSpan) {
        var spanHolder = onSpan ? onSpan : lib.node(this.getLocationSpanId(item));
        _empty(spanHolder);
        var scopeParams = this.explorer.model.getScopingParams(item);
        var link = _createLink('navlinkonpage', null, scopeParams.href, spanHolder, scopeParams.name); //$NON-NLS-0$
        link.title = scopeParams.tooltip;
        mNavUtils.addNavGrid(this.explorer.getNavDict(), item, link);
        var that = this;
        _connect(link, "click", function() { //$NON-NLS-0$
            that.explorer.closeContextTip();
        });
    };

    SearchResultRenderer.prototype.getPrimColumnStyle = function() {
        return "search_primaryColumn"; //$NON-NLS-0$
    };

    SearchResultRenderer.prototype.getSecondaryColumnStyle = function() {
        return "search_secondaryColumn"; //$NON-NLS-0$
    };

    SearchResultRenderer.prototype.getCellElement = function(col_no, item, tableRow) {
        switch (col_no) {
            case 0:
                var col, span, link;
                col = _createElement('td'); //$NON-NLS-0$
                if (item.type === "file") { //$NON-NLS-0$
                    col.noWrap = true;
                    span = _createSpan(null, this.getFileIconId(item), col, null);
                    //TODO: ask the model to give the condition
                    if (this.explorer.model._searchHelper.params.keyword !== "") {
                        this.getExpandImage(tableRow, span, "core-sprite-file"); //$NON-NLS-0$
                    } else {
                        var decorateImage = _createSpan(null, null, col, null);
                        decorateImage.classList.add('imageSprite'); //$NON-NLS-0$
                        decorateImage.classList.add('core-sprite-file'); //$NON-NLS-0$
                    }
                } else {
                    span = _createSpan(null, null, col, null);
                    col.noWrap = true;
                    col.align = "right"; //$NON-NLS-0$
                    this.renderDetailLineNumber(item, span);
                }
                return col;
            case 1:
                var col, span, link;
                col = _createElement('td'); //$NON-NLS-0$
                span = _createSpan(null, this.getFileSpanId(item), col, null);
                var that = this;
                if (item.type === "file") { //$NON-NLS-0$
                    var renderName = item.totalMatches ? item.name + " (" + item.totalMatches + " matches)" : item.name; //$NON-NLS-1$ //$NON-NLS-0$
                    this.renderFileElement(item, span, renderName);
                } else {
                    this.renderDetailElement(item, tableRow, span);
                    var iconSpan = _createSpan(null, this.getDetailIconId(item), span, null);
                    var icon = _createSpan(null, null, iconSpan, null);
                    icon.classList.add('imageSprite'); //$NON-NLS-0$
                    icon.classList.add('core-sprite-none'); //$NON-NLS-0$
                }
                return col;

            case 2:
                col = _createElement('td'); //$NON-NLS-0$
                if (item.type === "file") { //$NON-NLS-0$
                    span = _createSpan(null, this.getLocationSpanId(item), col, null);
                    if (item.parentLocation) {
                        this.renderLocationElement(item, span);
                    }
                }
                return col;
        }
    };
    SearchResultRenderer.prototype.constructor = SearchResultRenderer;


    function SearchReportRenderer(options, explorer) {
        this._init(options);
        this.options = options;
        this.explorer = explorer;
    };

    SearchReportRenderer.prototype = new mExplorer.SelectionRenderer();

    SearchReportRenderer.prototype.getCellHeaderElement = function(col_no) {
        var th, h2;
        switch (col_no) {
            case 0:
                th = _createElement('th', "search_report", null, null); //$NON-NLS-1$ //$NON-NLS-0$
                h2 = _createElement('h2', null, null, th); //$NON-NLS-1$
                h2.textContent = messages["Files replaced"];
                break;
            case 1:
                th = _createElement('th', "search_report", null, null); //$NON-NLS-1$ //$NON-NLS-0$
                h2 = _createElement('h2', null, null, th); //$NON-NLS-1$
                h2.textContent = messages["Status"];
                break;
        }
    };

    SearchReportRenderer.prototype.getCellElement = function(col_no, item, tableRow) {
        switch (col_no) {
            case 0:
                var col = _createElement('td', "search_report", null, null); //$NON-NLS-1$ //$NON-NLS-0$
                var div = _createElement('div', null, null, col); //$NON-NLS-1$
                var span = _createElement('span', "primaryColumn", null, div); //$NON-NLS-1$ //$NON-NLS-0$

                _place(document.createTextNode(item.model.fullPathName + "/" + item.model.name), span, "only"); //$NON-NLS-1$ //$NON-NLS-0$
                _connect(span, "click", function() { //$NON-NLS-0$
                    window.open(item.model.linkLocation);
                });
                _connect(span, "mouseover", function() { //$NON-NLS-0$
                    span.style.cursor = "pointer"; //$NON-NLS-0$
                });
                _connect(span, "mouseout", function() { //$NON-NLS-0$
                    span.style.cursor = "default"; //$NON-NLS-0$
                });

                var operationIcon = _createElement('span', null, null, div); //$NON-NLS-1$ //$NON-NLS-0$
                operationIcon.classList.add('imageSprite'); //$NON-NLS-0$
                if (item.status) {
                    switch (item.status) {
                        case "warning":
                            //$NON-NLS-0$
                            operationIcon.classList.add('core-sprite-warning'); //$NON-NLS-0$
                            return col;
                        case "failed":
                            //$NON-NLS-0$
                            operationIcon.classList.add('core-sprite-error'); //$NON-NLS-0$
                            return col;
                        case "pass":
                            //$NON-NLS-0$
                            operationIcon.classList.add('core-sprite-ok'); //$NON-NLS-0$
                            return col;
                    }
                }
                return col;
            case 1:
                var statusMessage;
                if (item.status) {
                    switch (item.status) {
                        case "warning":
                            //$NON-NLS-0$
                            statusMessage = item.message;
                            break;
                        case "failed":
                            //$NON-NLS-0$
                            statusMessage = item.message;
                            break;
                        case "pass":
                            //$NON-NLS-0$
                            statusMessage = i18nUtil.formatMessage(messages["${0} out of ${1}  matches replaced."], item.matchesReplaced, item.model.totalMatches);
                            break;
                    }
                    var td = _createElement('td', "search_report", null, null); //$NON-NLS-1$ //$NON-NLS-0$
                    td.textContent = statusMessage;
                    return td;
                }
        }
    };

    SearchReportRenderer.prototype.constructor = SearchReportRenderer;

    function SearchReportExplorer(parentId, reportList) {
        this.parentId = parentId;
        this.reportList = reportList;
        this.renderer = new SearchReportRenderer({
            checkbox: false
        }, this);
    }
    SearchReportExplorer.prototype = new mExplorer.Explorer();

    SearchReportExplorer.prototype.report = function() {
        this.createTree(this.parentId, new mExplorer.ExplorerFlatModel(null, null, this.reportList));
    };

    SearchReportExplorer.prototype.constructor = SearchReportExplorer;


    /**
     * Creates a new search result explorer.
     * @name orion.SearchResultExplorer
     */
    function SearchResultExplorer(registry, commandService) {
        this.registry = registry;
        this._commandService = commandService;
        this.fileClient = new mFileClient.FileClient(this.registry);
        this.defaulRows = 40;
        this.declareCommands();
    }

    SearchResultExplorer.prototype = new mExplorer.Explorer();

    /**
     * Clients can connect to this function to receive notification when the root item changes.
     * @param {Object} item
     */
    SearchResultExplorer.prototype.onchange = function(item) {};

    SearchResultExplorer.prototype.setResult = function(parentNode, resultLocation, searchParams, totalNumber) {
        var that = this;
        this.parentNode = parentNode;
        this.searchParams = searchParams;
        this.numberOnPage = resultLocation.length;
        this.model = new SearchResultModel(this.registry, this.fileClient, resultLocation, totalNumber, searchParams, {
            onMatchNumberChanged: function(fileItem) {
                that.renderer.replaceFileElement(fileItem);
            }
        });
        //TODO: ask model to provide replaceStr
        this._replaceStr = this.model._searchHelper.params.replace;
        if (this.model.replaceMode()) {
            this._hasCheckedItems = true;
            this.checkbox = true;
            this.renderer = new SearchResultRenderer({
                checkbox: true,
                highlightSelection: false,
                getCheckedFunc: function(item) {
                    return that.getItemChecked(item);
                },
                onCheckedFunc: function(rowId, checked, manually) {
                    that.onRowChecked(rowId, checked, manually);
                }
            }, that);
        } else {
            this.checkbox = false;
            this.renderer = new SearchResultRenderer({
                checkbox: false,
                highlightSelection: false
            }, this);
        }

        this._reporting = false;
        this._uiFactory = null;
        this._currentPreviewModel = null;
        this._currentReplacedContents = {
            contents: null
        };
        this._popUpContext = false;
        this.timerRunning -= false;
        this._timer = null;
        this.twoWayCompareContainer = null;
    };

    /* one-time setup of commands */
    SearchResultExplorer.prototype.declareCommands = function() {
        var that = this;
        // page actions for search

        var saveResultsCommand = new mCommands.Command({
            name: messages["Save Search"],
            tooltip: messages["Save search query"],
            id: "orion.saveSearchResults", //$NON-NLS-0$
            callback: function(data) {
                that.saveSearch(that.searchParams);
            },
            visibleWhen: function(item) {
                return that.model && that.model._provideSearchHelper && !that.model.replaceMode();
            }
        });

        var previewCurrentPageCommand = new mCommands.Command({
            name: messages['Replace'],
            tooltip: messages["Replace all matches with..."],
            id: "orion.previewCurrentPage", //$NON-NLS-0$
            callback: function(data) {
                that.preview();
            },
            visibleWhen: function(item) {
                return that.model && !that.model.replaceMode() && that.model._provideSearchHelper && that.model._provideSearchHelper().params.keyword !== "";
            }
        });

        var replaceAllCommand = new mCommands.Command({
            name: messages["Apply Changes"],
            tooltip: messages["Replace all selected matches"],
            id: "orion.globalSearch.replaceAll", //$NON-NLS-0$
            callback: function(data) {
                that.replaceAll();
            },
            visibleWhen: function(item) {
                return that.model && that.model.replaceMode() && !that._reporting && that._hasCheckedItems && that.model._provideSearchHelper && that.model._provideSearchHelper().params.keyword !== "";
            }
        });

        var hideCompareCommand = new mCommands.Command({
            name: messages["Hide Compare"],
            tooltip: messages["Hide compare view of changes"],
            id: "orion.globalSearch.hideCompare", //$NON-NLS-0$
            callback: function(data) {
                that.toggleCompare(false);
            },
            visibleWhen: function(item) {
                return that.model && that.model.replaceMode() && !that._reporting && that._uiFactory;
            }
        });

        var showCompareCommand = new mCommands.Command({
            name: messages["Show Compare"],
            tooltip: messages["Show compare view of changes"],
            id: "orion.globalSearch.showCompare", //$NON-NLS-0$
            callback: function(data) {
                that.toggleCompare(true);
            },
            visibleWhen: function(item) {
                return that.model && that.model.replaceMode() && !that._reporting && !that._uiFactory;
            }
        });

        var searchAgainCommand = new mCommands.Command({
            name: messages["Search Again"],
            tooltip: messages["Search again"],
            id: "orion.globalSearch.searchAgain", //$NON-NLS-0$
            callback: function() {
                return that.searchAgain();
            },
            visibleWhen: function(item) {
                return that._reporting || (that.model && that.model.replaceMode());
            }
        });

        this._commandService.addCommand(saveResultsCommand);
        this._commandService.addCommand(previewCurrentPageCommand);
        this._commandService.addCommand(searchAgainCommand);
        this._commandService.addCommand(hideCompareCommand);
        this._commandService.addCommand(showCompareCommand);
        this._commandService.addCommand(replaceAllCommand);
        this._commandService.addCommandGroup("pageActions", "orion.searchActions.unlabeled", 200); //$NON-NLS-1$ //$NON-NLS-0$
        this._commandService.registerCommandContribution("pageActions", "orion.saveSearchResults", 1, "orion.searchActions.unlabeled"); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
        this._commandService.registerCommandContribution("pageActions", "orion.previewCurrentPage", 2, "orion.searchActions.unlabeled"); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
        this._commandService.registerCommandContribution("pageActions", "orion.globalSearch.searchAgain", 3, "orion.searchActions.unlabeled"); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
        this._commandService.registerCommandContribution("pageActions", "orion.globalSearch.hideCompare", 4, "orion.searchActions.unlabeled"); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
        this._commandService.registerCommandContribution("pageActions", "orion.globalSearch.showCompare", 5, "orion.searchActions.unlabeled"); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
        this._commandService.registerCommandContribution("pageActions", "orion.globalSearch.replaceAll", 6, "orion.searchActions.unlabeled"); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$

        var previousPage = new mCommands.Command({
            name: messages["< Previous Page"],
            tooltip: messages["Show previous page of search result"],
            id: "orion.search.prevPage", //$NON-NLS-0$
            hrefCallback: function() {
                if (!that.model._provideSearchHelper) {
                    return null;
                }
                var prevPage = that.caculatePrevPage();
                var qParams = mSearchUtils.copySearchParams(that.model._provideSearchHelper().params, true);
                qParams.start = prevPage.start;
                return mSearchUtils.generateSearchHref(qParams);
            },
            visibleWhen: function(item) {
                var prevPage = that.caculatePrevPage();
                return (prevPage.start !== that.model.getPagingParams().start);
            }
        });
        var nextPage = new mCommands.Command({
            name: messages["Next Page >"],
            tooltip: messages["Show next page of search result"],
            id: "orion.search.nextPage", //$NON-NLS-0$
            hrefCallback: function() {
                if (!that.model._provideSearchHelper) {
                    return null;
                }
                var nextPage = that.caculateNextPage();
                var qParams = mSearchUtils.copySearchParams(that.model._provideSearchHelper().params, true);
                qParams.start = nextPage.start;
                return mSearchUtils.generateSearchHref(qParams);
            },
            visibleWhen: function(item) {
                var nextPage = that.caculateNextPage();
                return (nextPage.start !== that.model.getPagingParams().start);
            }
        });
        var nextResultCommand = new mCommands.Command({
            tooltip: messages["Next result"],
            imageClass: "core-sprite-move_down", //$NON-NLS-0$
            id: "orion.search.nextResult", //$NON-NLS-0$
            groupId: "orion.searchGroup", //$NON-NLS-0$
            visibleWhen: function(item) {
                return !that._reporting;
            },
            callback: function() {
                that.gotoNext(true, true);
            }
        });
        var prevResultCommand = new mCommands.Command({
            tooltip: messages["Previous result"],
            imageClass: "core-sprite-move_up", //$NON-NLS-0$
            id: "orion.search.prevResult", //$NON-NLS-0$
            groupId: "orion.searchGroup", //$NON-NLS-0$
            visibleWhen: function(item) {
                return !that._reporting;
            },
            callback: function() {
                that.gotoNext(false, true);
            }
        });
        this._commandService.addCommand(previousPage);
        this._commandService.addCommand(nextPage);
        this._commandService.addCommand(nextResultCommand);
        this._commandService.addCommand(prevResultCommand);
        mExplorer.createExplorerCommands(this._commandService, function(item) {
            return !item._reporting && that.model._provideSearchHelper && that.model._provideSearchHelper().params.keyword !== "";
        });
        // Register command contributions
        this._commandService.registerCommandContribution("pageNavigationActions", "orion.explorer.expandAll", 1); //$NON-NLS-1$ //$NON-NLS-0$
        this._commandService.registerCommandContribution("pageNavigationActions", "orion.explorer.collapseAll", 2); //$NON-NLS-1$ //$NON-NLS-0$
        this._commandService.registerCommandContribution("pageNavigationActions", "orion.search.nextResult", 3); //$NON-NLS-1$ //$NON-NLS-0$
        this._commandService.registerCommandContribution("pageNavigationActions", "orion.search.prevResult", 4); //$NON-NLS-1$ //$NON-NLS-0$
        this._commandService.registerCommandContribution("pageNavigationActions", "orion.search.prevPage", 5); //$NON-NLS-1$ //$NON-NLS-0$
        this._commandService.registerCommandContribution("pageNavigationActions", "orion.search.nextPage", 6); //$NON-NLS-1$ //$NON-NLS-0$
    };

    SearchResultExplorer.prototype._checkStale = function(model, onComplete) {
        if (!model.stale) {
            return;
        } else {
            this.registry.getService("orion.page.progress").progress(this.fileClient.read(model.location), "Checing file " + model.location + " for stale").then(

            function(contents) {
                if (this.model._hitOnceWithinFile(contents)) {
                    model.stale = false;
                } else {
                    onComplete(model);
                }
            }.bind(this),

            function(error) {
                console.error("Error loading file contents: " + error.message); //$NON-NLS-0$
                onComplete(model);
            }.bind(this));
        }
    };

    SearchResultExplorer.prototype._loadOneFileMetaData = function(index, onComplete) {
        if (this._crawling) {
            return;
        }
        var item = _validFiles(this.model)[index];
        var that = this;
        this.registry.getService("orion.page.progress").progress(this.fileClient.read(item.location, true), "Getting file metadata " + item.location).then(

        function(meta) {
            item.fullPathName = mSearchUtils.fullPathNameByMeta(meta.Parents);
            item.parentLocation = meta.Parents[0].Location;
            item.stale = (item.lastModified !== meta.LocalTimeStamp);
            item.ETag = meta.ETag;
            if (item.stale) {
                this._checkStale(item, function(item) {
                    //that.renderer.renderLocationElement(item);
                    that.renderer.staleFileElement(item);
                });
            } else {
                //this.renderer.renderLocationElement(item);
            }
            if (index === (_validFiles(this.model).length - 1)) {
                if (onComplete) {
                    onComplete();
                } else {
                    return;
                }
            } else {
                this._loadOneFileMetaData(index + 1, onComplete);
            }
        }.bind(this),

        function(error) {
            console.error("Error loading file metadata: status " + error.status); //$NON-NLS-0$
            //If we can't load file meta data we have to stale the file.
            item.stale = true;
            this.renderer.staleFileElement(item);
            if (index === _validFiles(this.model).length) {
                if (onComplete) {
                    onComplete();
                } else {
                    return;
                }
            } else {
                this._loadOneFileMetaData(index + 1, onComplete);
            }
        }.bind(this));
    };

    SearchResultExplorer.prototype.setCrawling = function(crawling) {
        this._crawling = crawling;
    };

    SearchResultExplorer.prototype.preview = function() {
        var that = this;
        this._commandService.openParameterCollector("pageActions", function(parentDiv) { //$NON-NLS-0$
            // create replace text
            var replaceStringDiv = _createElement('input', null, "globalSearchReplaceWith", parentDiv); //$NON-NLS-0$
            replaceStringDiv.type = "text"; //$NON-NLS-0$
            replaceStringDiv.name = "ReplaceWith:"; //$NON-NLS-0$
            replaceStringDiv.placeholder = "Replace With"; //$NON-NLS-0$
            replaceStringDiv.onkeydown = function(e) {
                if (e.keyCode === 13 /*Enter*/ ) {
                    var replaceInputDiv = lib.node("globalSearchReplaceWith"); //$NON-NLS-0$
                    that._commandService.closeParameterCollector();
                    return that._doPreview(replaceInputDiv.value);
                }
                if (e.keyCode === 27 /*ESC*/ ) {
                    that._commandService.closeParameterCollector();
                    return false;
                }
            };

            // create the command span for Replace
            var span = _createElement('span', 'parameters', "globalSearchReplaceCommands", parentDiv); //$NON-NLS-0$
            return replaceStringDiv;
        });

        var replaceDiv = document.getElementById("globalSearchReplaceWith"); //$NON-NLS-0$
        replaceDiv.value = this.model.defaultReplaceStr;
        window.setTimeout(function() {
            replaceDiv.select();
            replaceDiv.focus();
        }, 10);


        var innerReplaceAllCommand = new mCommands.Command({
            name: "Preview Changes", //$NON-NLS-0$
            image: require.toUrl("images/replaceAll.gif"), //$NON-NLS-0$
            id: "orion.globalSearch.innerReplaceAll", //$NON-NLS-0$
            groupId: "orion.searchGroup", //$NON-NLS-0$
            callback: function() {
                var replaceInputDiv = lib.node("globalSearchReplaceWith"); //$NON-NLS-0$
                that._commandService.closeParameterCollector();
                return that._doPreview(replaceInputDiv.value);
            }
        });

        this._commandService.addCommand(innerReplaceAllCommand);

        // Register command contributions
        this._commandService.registerCommandContribution("globalSearchReplaceCommands", "orion.globalSearch.innerReplaceAll", 1); //$NON-NLS-1$ //$NON-NLS-0$
        this._commandService.renderCommands("globalSearchReplaceCommands", "globalSearchReplaceCommands", this, this, "button"); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
    };

    SearchResultExplorer.prototype._fileExpanded = function(fileIndex, detailIndex) {
        var filItem = _validFiles(this.model)[fileIndex];
        if (detailIndex === null || detailIndex === undefined) {
            return {
                childrenNumber: 0,
                childDiv: lib.node(this.model.getId(filItem))
            };
        }
        if (filItem.children && filItem.children.length > 0) {
            if (detailIndex < 0) {
                detailIndex = filItem.children.length - 1;
            } else if (detailIndex >= filItem.children.length) {
                detailIndex = 0;
            }
            return {
                childrenNumber: filItem.children.length,
                childDiv: lib.node(this.model.getId(filItem.children[detailIndex]))
            };
        }
        return {
            childrenNumber: 0,
            childDiv: null
        };
    };

    SearchResultExplorer.prototype._doPreview = function(replacingStr, all) {
        if (!this.model._provideSearchHelper) {
            return;
        }
        if (this.model._storeGlobalStatus) {
            this.model._storeGlobalStatus(replacingStr);
        }
        var qParams = mSearchUtils.copySearchParams(this.model._provideSearchHelper().params, true);
        qParams.replace = replacingStr;
        if (all) {
            qParams.start = 0;
            qParams.rows = this.totalNumber;
        }
        var href = mSearchUtils.generateSearchHref(qParams);
        window.location.href = href;
    };

    SearchResultExplorer.prototype.searchAgain = function() {
        if (!this.model._provideSearchHelper) {
            return;
        }
        var qParams = mSearchUtils.copySearchParams(this.model._provideSearchHelper().params, true);
        qParams.replace = null;
        if (qParams.rows > this.defaulRows) {
            qParams.rows = this.defaulRows;
        }
        var href = mSearchUtils.generateSearchHref(qParams);
        if (href === window.location.href) {
            window.location.reload();
        } else {
            window.location.href = href;
        }
    };

    SearchResultExplorer.prototype.replaceAll = function() {
        var reportList = [];
        var that = this;
        this._reporting = true;
        this.initCommands();
        this.reportStatus(messages["Writing files..."]);
        this.model.writeIncrementalNewContent(reportList, 0, function(modellist) {
            _empty(that.getParentDivId());
            var reporter = new SearchReportExplorer(that.getParentDivId(), reportList);
            reporter.report();
            that.reportStatus("");
        });
    };

    SearchResultExplorer.prototype.toggleCompare = function(show) {
        this.replacePreview(false, show);
    };

    SearchResultExplorer.prototype.replacePreview = function(init, comparing) {

        _empty(this.getParentDivId());
        if (comparing) {
            this._uiFactory = new mSearchFeatures.SearchUIFactory({
                parentDivID: this.getParentDivId()
            });
            this._uiFactory.buildUI();
            this.twoWayCompareContainer = null;
            this._currentPreviewModel = null;
        } else {
            if (this._uiFactory) {
                this._uiFactory.destroy();
            }
            this._uiFactory = null;
            this.twoWayCompareContainer = null;
            this._currentPreviewModel = null;
        }
        this.initCommands();
        if (init) {
            this.reportStatus(messages["Preparing preview..."]);
        }
        var that = this;
        this.createTree(this._uiFactory ? this._uiFactory.getMatchDivID() : this.getParentDivId(), this.model, {
            selectionPolicy: "cursorOnly",
            indent: 0,
            onCollapse: function(model) {
                that.onCollapse(model);
            }
        }); //$NON-NLS-0$

        if (init) {
            this.hookUpNavHandler();
            this.gotoCurrent(this.model.restoreLocationStatus ? this.model.restoreLocationStatus() : null);
            this.reportStatus("");
            this._loadOneFileMetaData(0, function() {
                that.refreshIndex();
            });
        } else {
            this.hookUpNavHandler();
            this.gotoCurrent(this.model.restoreLocationStatus ? this.model.restoreLocationStatus() : null);
        }
    };

    SearchResultExplorer.prototype.getItemChecked = function(item) {
        if (item.checked === undefined) {
            item.checked = true;
        }
        return item.checked;
    };

    SearchResultExplorer.prototype._checkedItem = function() {
        var fileList = _validFiles(this.model);
        for (var i = 0; i < fileList.length; i++) {
            if (fileList[i].checked) {
                return true;
            }
            if (!fileList[i].children) {
                continue;
            }
            for (var j = 0; j < fileList[i].children.length; j++) {
                if (fileList[i].children[j].checked) {
                    return true;
                }
            }
        }
        return false;
    };

    SearchResultExplorer.prototype.onRowChecked = function(rowId, checked, manually) {
        var hasCheckedItems;
        if (!rowId) {
            hasCheckedItems = checked;
            this.onItemChecked(this.model.getListRoot(), checked, manually);
        } else {
            var row = lib.node(rowId);
            if (row && row._item) {
                this.onItemChecked(row._item, checked, manually);
            }
            hasCheckedItems = this._checkedItem();
        }
        if (hasCheckedItems !== this._hasCheckedItems) {
            this._hasCheckedItems = hasCheckedItems;
            this.initCommands();
        }
    };

    SearchResultExplorer.prototype.onNewContentChanged = function(fileItem) {
        if (fileItem === _getFileModel(this.getNavHandler().currentModel())) {
            this.buildPreview(true);
        }
    };

    SearchResultExplorer.prototype.onItemChecked = function(item, checked, manually) {
        item.checked = checked;
        if (item.type === "file" || item === this.model.getListRoot()) { //$NON-NLS-0$
            if (item.children) {
                for (var i = 0; i < item.children.length; i++) {
                    var checkBox = lib.node(this.renderer.getCheckBoxId(this.model.getId(item.children[i])));
                    if (checkBox) {
                        this.renderer.onCheck(null, checkBox, checked, false);
                    } else {
                        item.children[i].checked = checked;
                    }
                }
            }
            if (item.type === "file") { //$NON-NLS-0$
                this.onNewContentChanged(item);
            }
        } else if (manually) {
            this.onNewContentChanged(item.parent);
        }
    };

    SearchResultExplorer.prototype.buildPreview = function(updating) {
        if (!this._uiFactory) {
            return;
        }
        if (_validFiles(this.model).length === 0) {
            return;
        }
        var uiFactory = this._uiFactory;
        var fileItem = _getFileModel(this.getNavHandler().currentModel());
        this._currentPreviewModel = fileItem;
        var that = this;
        this.model.provideFileContent(fileItem, function(fileItem) {
            if (that.model.onMatchNumberChanged) {
                that.model.onMatchNumberChanged(fileItem);
            }
            //TODO: ask the model to give new contents
            mSearchUtils.generateNewContents(updating, fileItem.contents, that._currentReplacedContents, fileItem, that._replaceStr, that.model._searchHelper.inFileQuery.searchStrLength);
            // Diff operations
            var contentTypeService = new mContentTypes.ContentTypeService(that.registry);
            var fType = contentTypeService.getFilenameContentType(fileItem.name);
            var options = {
                readonly: true,
                hasConflicts: false,
                newFile: {
                    Name: fileItem.location,
                    Type: fType,
                    Content: fileItem.contents.join(that.model._lineDelimiter)
                },
                baseFile: {
                    Name: fileItem.location,
                    Type: fType,
                    Content: that._currentReplacedContents.contents.join(that.model._lineDelimiter)
                }
            };
            if (!that.twoWayCompareContainer) {
                that.uiFactoryCompare = new mCompareFeatures.TwoWayCompareUIFactory({
                    parentDivID: uiFactory.getCompareDivID(),
                    showTitle: true,
                    rightTitle: i18nUtil.formatMessage(messages["Replaced File (${0})"], fileItem.name),
                    leftTitle: i18nUtil.formatMessage(messages["Original File (${0})"], fileItem.name),
                    showLineStatus: false
                });
                that.uiFactoryCompare.buildUI();
                that.twoWayCompareContainer = new mCompareContainer.TwoWayCompareContainer(that.registry, uiFactory.getCompareDivID(), that.uiFactoryCompare, options);
                that.twoWayCompareContainer.startup(false, function() {
                    that._uiFactory.setCompareWidget(that.twoWayCompareContainer);
                });
            } else {
                _empty(that.uiFactoryCompare.getTitleDiv());
                _place(document.createTextNode(i18nUtil.formatMessage(messages['Replaced File (${0})'], fileItem.name)), that.uiFactoryCompare.getTitleDiv(), "only"); //$NON-NLS-1$
                _empty(that.uiFactoryCompare.getTitleDiv(true));
                _place(document.createTextNode(i18nUtil.formatMessage(messages['Original File (${0})'], fileItem.name)), that.uiFactoryCompare.getTitleDiv(true), "only"); //$NON-NLS-1$
                that.twoWayCompareContainer.setOptions(options);
                that.twoWayCompareContainer.setEditor();
            }
            window.setTimeout(function() {
                that.renderer.focus();
            }, 100);
        });
    };


    SearchResultExplorer.prototype.addSavedSearch = function(searchName, query) {
        this.registry.getService("orion.core.savedSearches").addSearch(searchName, query); //$NON-NLS-0$
    };

    SearchResultExplorer.prototype.saveSearch = function(searchParams) {
        if (!this.model._provideSearchHelper) {
            return;
        }
        var query = mSearchUtils.generateSearchHref(searchParams).split("#")[1];
        var qName = query;

        if (typeof(this.model._provideSearchHelper().displayedSearchTerm) === "string" && typeof(searchParams.resource) === "string") { //$NON-NLS-1$ //$NON-NLS-0$
            qName = "\'" + this.model._provideSearchHelper().displayedSearchTerm + "\' in "; // +queryObj.location; //$NON-NLS-1$ //$NON-NLS-0$
            if (searchParams.resource.length > 0) {
                this.registry.getService("orion.page.progress").progress(this.fileClient.read(searchParams.resource, true), "Getting file metadata " + searchParams.resource).then(

                function(meta) {
                    var parentName = mSearchUtils.fullPathNameByMeta(meta.Parents);
                    var fullName = parentName.length === 0 ? meta.Name : parentName + "/" + meta.Name; //$NON-NLS-0$
                    this.addSavedSearch(qName + fullName, query);
                }.bind(this),

                function(error) {
                    console.error("Error loading file meta data: " + error.message); //$NON-NLS-0$
                    this.addSavedSearch(qName + "root", query); //$NON-NLS-0$
                }.bind(this));
            } else {
                this.addSavedSearch(qName + "root", query); //$NON-NLS-0$
            }
        } else {
            this.addSavedSearch(qName, query);
        }
    };

    SearchResultExplorer.prototype.caculateNextPage = function(currentStart, pageSize, totalNumber) {
        var pagingParams = this.model.getPagingParams();
        if ((pagingParams.start + pagingParams.rows) >= pagingParams.totalNumber) {
            return {
                start: pagingParams.start
            };
        }
        return {
            start: pagingParams.start + pagingParams.rows
        };
    };

    SearchResultExplorer.prototype.caculatePrevPage = function() {
        var pagingParams = this.model.getPagingParams();
        var start = pagingParams.start - pagingParams.rows;
        if (start < 0) {
            start = 0;
        }
        return {
            start: start
        };
    };

    SearchResultExplorer.prototype.initCommands = function() {
        var that = this;
        this._commandService.destroy("pageActions"); //$NON-NLS-0$
        this._commandService.renderCommands("pageActions", "pageActions", that, that, "button"); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$

        this._commandService.destroy("pageNavigationActions"); //$NON-NLS-0$
        this._commandService.renderCommands("pageNavigationActions", "pageNavigationActions", that, that, "button"); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
        if (this.model._provideSearchHelper && this.model._provideSearchHelper().params.keyword !== "") {
            var newMenu = this._commandService._createDropdownMenu("pageNavigationActions", messages['Options'], false, function() { //$NON-NLS-0$
                if (!that.model.replaceMode()) {
                    that._commandService._generateCheckedMenuItem(newMenu.menu, messages["Sort by Name"], that.model.sortByName,

                    function(event) {
                        that.sortWithName(event.target.checked);
                        window.setTimeout(function() {
                            newMenu.dropdown.close(true);
                        }, 100); // so user can see the check take effect briefly before it closes
                    });
                } else {
                    that._commandService._generateCheckedMenuItem(newMenu.menu, messages["Compare changes"], true,

                    function(event) {
                        that.toggleCompare(event.target.checked);
                        window.setTimeout(function() {
                            newMenu.dropdown.close(true);
                        }, 100);
                    });
                }
            });
        }
    };

    SearchResultExplorer.prototype.reportStatus = function(message) {
        this.registry.getService("orion.page.message").setProgressMessage(message); //$NON-NLS-0$
    };

    SearchResultExplorer.prototype.isExpanded = function(model) {
        return this.myTree.isExpanded(this.model.getId(model));
    };

    SearchResultExplorer.prototype.popupContext = function(model) {
        if (this.contextTip) {
            this.contextTip.destroy();
            this.contextTip = null;
        }
        var that = this;
        var modelLinkId = this.renderer.getDetailIconId(model);
        var tableNode = this.renderer.generateContextTip(model);
        var aroundNode = lib.node(modelLinkId);
        var orient = ["below", "right"]; //$NON-NLS-3$ //$NON-NLS-2$
        if (aroundNode) {
            var parentNode = this.myTree._parent;
            var parentRect = parentNode.getClientRects()[0];
            var rects = aroundNode.getClientRects();
            for (var i = 0, l = rects.length; i < l; i++) {
                var r = rects[i];
                if ((r.bottom + 100) > parentRect.bottom) {
                    orient = ["above", "right"]; //$NON-NLS-3$ //$NON-NLS-2$
                    break;
                }
            }
        }
        this.contextTip = new mTooltip.Tooltip({
            node: aroundNode,
            showDelay: 0,
            trigger: "none", //$NON-NLS-0$
            position: orient
        });
        var toolTipContent = this.contextTip.contentContainer();
        //toolTipContent.classList.add("parameterPopup"); //$NON-NLS-0$
        toolTipContent.appendChild(tableNode);
        this.contextTip.show();
    };

    SearchResultExplorer.prototype.closeContextTip = function(remainFlag) {
        if (!this.model.replaceMode()) {
            if (this.contextTip) {
                this.contextTip.destroy();
                this.contextTip = null;
            }
            if (!remainFlag) {
                this._popUpContext = false;
            }
            this.renderer.replaceDetailIcon(this.getNavHandler().currentModel(), "right"); //$NON-NLS-0$
        }
    };

    SearchResultExplorer.prototype.onCollapse = function(model) {
        var curModel = this.getNavHandler().currentModel();
        if (!curModel) {
            return;
        }
        if (curModel.type === "detail") { //$NON-NLS-0$
            var curFileModel = _getFileModel(model);
            if (curFileModel === model) {
                this.getNavHandler().cursorOn(model);
            }
        }
    };

    SearchResultExplorer.prototype.onExpand = function(modelToExpand, childPosition, callback) {
        if (modelToExpand && modelToExpand.children && modelToExpand.children.length > 0 && typeof(childPosition) === "string") { //$NON-NLS-0$
            var childIndex = 0;
            var forward = true;
            if (childPosition === "first") { //$NON-NLS-0$
                childIndex = 0;
            } else if (childPosition === "last") { //$NON-NLS-0$
                childIndex = modelToExpand.children.length - 1;
                forward = false;
            } else {
                childIndex = JSON.parse(childPosition);
                forward = false;
            }
            if (typeof(childIndex) === "string" || childIndex < 0 || childIndex >= modelToExpand.children.length) { //$NON-NLS-0$
                childIndex = 0;
            }
            this.getNavHandler().cursorOn(modelToExpand.children[childIndex]);
        }
    };

    SearchResultExplorer.prototype.forceExpandFunc = function(modelToExpand, childPosition, callback) {
        this.myTree.expand(modelToExpand, function() {
            this.onExpand(modelToExpand, childPosition, callback);
        }.bind(this));
        return null;
    };

    //Provide the key listening div.If not provided this._myTree._parent will be used.
    SearchResultExplorer.prototype.keyEventListeningDiv = function(secondLevel) {
        return lib.node(this.getParentDivId(secondLevel));

    };

    SearchResultExplorer.prototype.onFocus = function(focus) {
        if (!focus) {
            this.closeContextTip();
        }
    };

    SearchResultExplorer.prototype.preventDefaultFunc = function(e, model) {
        if (!model) {
            return true;
        }
        if (!this.model.replaceMode() && !e.ctrlKey && model.type === "detail") { //$NON-NLS-0$
            if (e.keyCode === 37 /*left*/ && this._popUpContext) {
                this.closeContextTip();
                e.preventDefault();
                return true;
            }
            if (e.keyCode === 39 /*right*/ && !this._popUpContext) {
                this._popUpContext = true;
                this.renderer.replaceDetailIcon(model, "left"); //$NON-NLS-0$
                this.popupContext(model);
                e.preventDefault();
                return true;
            }
        }
        return false;
    };

    SearchResultExplorer.prototype.onReplaceCursorChanged = function(prevModel, currentModel) {
        var that = this;
        if (!_onSameFile(this._currentPreviewModel, currentModel)) {
            this.buildPreview();
        }
        if (currentModel.type === "detail") { //$NON-NLS-0$
            if (!currentModel.newMatches) {
                that.renderer.focus();
                return;
            }
            //TODO: ask model to decide the line NUmber
            this.twoWayCompareContainer.gotoMatch(currentModel.lineNumber - 1, currentModel.matches[currentModel.matchNumber - 1],
            currentModel.newMatches[currentModel.matchNumber - 1], this.model._searchHelper.inFileQuery.searchStrLength,

            function() {
                window.setTimeout(function() {
                    that.renderer.focus();
                }, 200);
            });
            window.setTimeout(function() {
                that.renderer.focus();
            }, 0);
        }
    };

    SearchResultExplorer.prototype.onCursorChanged = function(prevModel, currentModel) {
        this.renderer.replaceDetailIcon(prevModel, "none"); //$NON-NLS-0$
        if (this.model.storeLocationStatus) {
            this.model.storeLocationStatus(currentModel);
        }
        var that = this;
        if (this.model.replaceMode()) {
            if (!this._uiFactory) {
                return;
            }
            if (!this._timer) {
                this._timer = window.setTimeout(function() {
                    that.onReplaceCursorChanged(prevModel, currentModel);
                    that.timerRunning = false;
                    that._timer = null;
                }, 500);
            } else if (this.timerRunning) {
                window.clearTimeOut(this._timer);
                this._timer = window.setTimeout(function() {
                    that.onReplaceCursorChanged(prevModel, currentModel);
                    that.timerRunning = false;
                    that._timer = null;
                }, 500);
            }
        } else if (currentModel.type === "detail") { //$NON-NLS-0$
            if (this._popUpContext) {
                this.popupContext(currentModel);
                this.renderer.replaceDetailIcon(currentModel, "left"); //$NON-NLS-0$
            } else {
                this.renderer.replaceDetailIcon(currentModel, "right"); //$NON-NLS-0$
            }
        } else {
            if (this._popUpContext) {
                this.closeContextTip(true);
            }
        }
    };

    SearchResultExplorer.prototype.hookUpNavHandler = function() {
        if (!this.getNavHandler()) {
            var options = {
                preventDefaultFunc: function(event, model) {
                    return this.preventDefaultFunc(event, model);
                }.bind(this),
                onCursorChanged: function(prevModel, currentModel) {
                    this.onCursorChanged(prevModel, currentModel);
                }.bind(this)
            };
            var selModel = this.getSelectionModel();
            selModel.navHandler = new mNavHandler.ExplorerNavHandler(this, this.selectionModel.navDict, options);
        } else {
            this.getNavHandler().focus();
        }
        this.getNavHandler().refreshModel(this.getNavDict(), this.model, this.model.getListRoot().children);
    };

    SearchResultExplorer.prototype.startUp = function() {
        //TODO: ask model to decide the numberOnPage
        if (this.model._searchHelper.displayedSearchTerm) {
            if (this.numberOnPage > 0) {
                var pageTitle = lib.node("pageTitle"); //$NON-NLS-0$
                if (pageTitle) {
                    if (!this.model.replaceMode()) {
                        pageTitle.textContent = messages["Search Results"];
                    } else {
                        pageTitle.textContent = messages["Replace All Matches"];
                    }
                }
            } else {
                this.parentNode.textContent = "";
                var textBold = _createElement('b', null, null, this.parentNode); //$NON-NLS-1$ //$NON-NLS-0$
                var displayStr = i18nUtil.formatMessage(messages["No matches found for ${0}"], this.model._searchHelper.displayedSearchTerm);
                _place(document.createTextNode(displayStr), textBold, "only"); //$NON-NLS-0$
                return;
            }
        }
        var that = this;
        this.model.buildResultModel();
        if (!this.model.replaceMode()) {
            this.initCommands();
            _empty(this.getParentDivId());
            this.createTree(this.getParentDivId(), this.model, {
                selectionPolicy: "cursorOnly",
                indent: 0,
                onCollapse: function(model) {
                    that.onCollapse(model);
                }
            }); //$NON-NLS-0$
            this.hookUpNavHandler();
            this.gotoCurrent(this.model.restoreLocationStatus ? this.model.restoreLocationStatus() : null);
            this.reportStatus("");
            this._loadOneFileMetaData(0, function() {
                that.refreshIndex();
            });
        } else {
            that.replacePreview(true, true);
        }
    };

    SearchResultExplorer.prototype.incrementalRender = function() {
        var that = this;
        this.model.buildResultModel();
        this.createTree(this.getParentDivId(), this.model, {
            selectionPolicy: "cursorOnly",
            indent: 0,
            onCollapse: function(model) {
                that.onCollapse(model);
            }
        }); //$NON-NLS-0$
    };

    SearchResultExplorer.prototype.refreshIndex = function() {
        var newIndex = [];
        var currentFileItem = _getFileModel(this.getNavHandler().currentModel());
        var fileList = _validFiles(this.model);
        for (var i = 0; i < fileList.length; i++) {
            if (!fileList[i].stale) {
                newIndex.push(fileList[i]);
            } else if (currentFileItem === fileList[i]) {
                currentFileItem = null;
            }
        }
        this.model._indexedFileItems = newIndex;
        if (_validFiles(this.model).length === 0) {
            this.getNavHandler().refreshModel(this.getNavDict(), this.model, this.model.getListRoot().children);
            this.getNavHandler().cursorOn(null, true);
        } else if (!currentFileItem) {
            this.getNavHandler().cursorOn(null, true);
            this.getNavHandler().refreshModel(this.getNavDict(), this.model, this.model.getListRoot().children);
            this.gotoCurrent();
        } else {
            this.getNavHandler().refreshModel(this.getNavDict(), this.model, this.model.getListRoot().children, true);
        }
    };

    //provide to the expandAll/collapseAll commands
    SearchResultExplorer.prototype.getItemCount = function() {
        return this.model.getListRoot().children.length;
    };

    SearchResultExplorer.prototype.sortWithName = function(byName) {
        if (!this.model._provideSearchHelper || this.model.sortByName === byName) {
            return;
        }
        var qParams = mSearchUtils.copySearchParams(this.model._provideSearchHelper().params);
        qParams.sort = byName ? "NameLower asc" : "Path asc"; //$NON-NLS-1$ //$NON-NLS-0$
        qParams.start = 0;
        var href = mSearchUtils.generateSearchHref(qParams);
        window.location.href = href;
    };

    SearchResultExplorer.prototype.getParentDivId = function(secondLevel) {
        if (!this.model.replaceMode() || !secondLevel) {
            return this.parentNode.id;
        } else {
            return this._uiFactory ? this._uiFactory.getMatchDivID() : this.parentNode.id;
        }
    };

    SearchResultExplorer.prototype.gotoCurrent = function(cachedItem) {
        var modelToExpand = null;
        var detailIndex = "none"; //$NON-NLS-0$
        if (cachedItem) {
            modelToExpand = cachedItem.file;
            detailIndex = cachedItem.detail;
        } else {
            modelToExpand = this.getNavHandler().currentModel();
        }
        this.getNavHandler().cursorOn(modelToExpand, true);
        if (modelToExpand && detailIndex && detailIndex !== "none") { //$NON-NLS-0$
            this.myTree.expand(modelToExpand, function() {
                this.onExpand(modelToExpand, detailIndex);
            }.bind(this));
        }
    };

    SearchResultExplorer.prototype.gotoNext = function(next, forceExpand) {
        if (_validFiles(this.model).length === 0) {
            return;
        }
        this.getNavHandler().iterate(next, forceExpand);
    };

    SearchResultExplorer.prototype.constructor = SearchResultExplorer;

    //return module exports
    return {
        SearchResultExplorer: SearchResultExplorer
    };
});