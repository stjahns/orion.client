/******************************************************************************* 
 * @license
 * Copyright (c) 2011, 2012 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/

/*global define console document */

define(['require', 'dojo', 'orion/explorer', 'orion/util', 'orion/PageUtil', 'orion/globalCommands', 'orion/breadcrumbs', 'orion/git/gitCommands', 'orion/git/widgets/CommitTooltipDialog'], 
		function(require, dojo, mExplorer, mUtil, PageUtil, mGlobalCommands, mBreadcrumbs, mGitCommands) {
var exports = {};

exports.GitRepositoryExplorer = (function() {
	
	/**
	 * Creates a new Git repository explorer.
	 * @class Git repository explorerpadd
	 */
	function GitRepositoryExplorer(registry, commandService, linkService, selection, parentId, toolbarId, selectionToolsId, actionScopeId){
		this.parentId = parentId;
		this.registry = registry;
		this.linkService = linkService;
		this.commandService = commandService;
		this.selection = selection;
		this.parentId = parentId;
		this.toolbarId = toolbarId;
		this.selectionToolsId = selectionToolsId;
		this.actionScopeId = actionScopeId;
		this.checkbox = false;
	}
	
	GitRepositoryExplorer.prototype.handleError = function(error) {
		var display = {};
		display.Severity = "Error";
		display.HTML = false;
		try {
			var resp = JSON.parse(error.responseText);
			display.Message = resp.DetailedMessage ? resp.DetailedMessage : resp.Message;
		} catch (Exception) {
			display.Message = error.message;
		}
		this.registry.getService("orion.page.message").setProgressResult(display);
		
		if (error.status === 404) {
			this.initTitleBar();
			this.displayRepositories();
		}
	};
	
	GitRepositoryExplorer.prototype.setDefaultPath = function(defaultPath){
		this.defaultPath = defaultPath;
	};
	
	GitRepositoryExplorer.prototype.changedItem = function(parent, children) {
		this.redisplayClonesList();
	};
	
	GitRepositoryExplorer.prototype.redisplayClonesList = function(){
		var pageParams = PageUtil.matchResourceParameters();
		if (pageParams.resource) {
			this.displayRepository(pageParams.resource);
		} else {
			var path = this.defaultPath;
			var relativePath = mUtil.makeRelative(path);
			
			//NOTE: require.toURL needs special logic here to handle "gitapi/clone"
			var gitapiCloneUrl = require.toUrl("gitapi/clone._");
			gitapiCloneUrl = gitapiCloneUrl.substring(0,gitapiCloneUrl.length-2);
			
			this.displayRepository(relativePath[0] === "/" ? gitapiCloneUrl + relativePath : gitapiCloneUrl + "/" + relativePath);
		};
	};
	
	GitRepositoryExplorer.prototype.displayRepository = function(location){
		var that = this;
		var progressService = this.registry.getService("orion.page.message");

		progressService.setProgressMessage("Loading...");
		this.registry.getService("orion.git.provider").getGitClone(location).then(
			function(resp){
				
				if (resp.Children.length === 0) {
					that.initTitleBar({});
					that.displayRepositories([], "full");
				} else if (resp.Children.length == 1 && resp.Children[0].Type === "Clone") {
					var repositories = resp.Children;
					
					that.initTitleBar(repositories[0]);
					that.displayRepositories(repositories);
					that.displayStatus(repositories[0]);
					that.displayCommits(repositories[0]);
					that.displayBranches(repositories[0]);
					that.displayTags(repositories[0]);
					that.displayRemotes(repositories[0]);
					that.displayConfig(repositories[0]);
				} else if (resp.Children[0].Type === "Clone"){
					var repositories = resp.Children;
					
					that.initTitleBar(repositories);
					that.displayRepositories(repositories, "full", true);
				} else if (resp.Children[0].Type === "Branch"){
					var branches = resp.Children;
					
					that.registry.getService("orion.git.provider").getGitClone(branches[0].CloneLocation).then(
						function(resp){
							var repositories = resp.Children;
							
							that.initTitleBar(repositories[0], "Branches");
							
							that.displayRepositories(repositories, "mini", true);
							that.displayBranches(repositories[0], "full");
							that.displayRemoteBranches(repositories[0], "full");
						}, function () {
							dojo.hitch(that, that.handleError)(error);
						}
					);
				} else if (resp.Children[0].Type === "Tag"){
					var tags = resp.Children;
					
					that.registry.getService("orion.git.provider").getGitClone(tags[0].CloneLocation).then(
						function(resp){
							var repositories = resp.Children;
							
							that.initTitleBar(repositories[0], "Tags");
							
							that.displayRepositories(repositories, "mini", true);
							that.displayTags(repositories[0], "full");
						}, function () {
							dojo.hitch(that, that.handleError)(error);
						}
					);
				} else if (resp.Children[0].Type === "Config"){
					that.registry.getService("orion.git.provider").getGitClone(resp.CloneLocation).then(
						function(resp){
							var repositories = resp.Children;
							
							that.initTitleBar(repositories[0], "Configuration");
							
							that.displayRepositories(repositories, "mini", true);
							that.displayConfig(repositories[0], "full");
						}, function () {
							dojo.hitch(that, that.handleError)(error);
						}
					);
				}
				that.commandService.processURL(window.location.href);
				progressService.setProgressMessage("");
			}, function(error){
				dojo.hitch(that, that.handleError)(error);
			}
		);
	};
	
	GitRepositoryExplorer.prototype.initTitleBar = function(resource, sectionName){
		var that = this;
		var item = {};
		var pageTitle;		
		
		// render commands
		mGitCommands.updateNavTools(that.registry, that, "pageActions", "selectionTools", resource);
		
		if (resource && resource.Type === "Clone" && sectionName){
			var repository = resource;
			
			item.Name = sectionName;
			item.Parents = [];
			item.Parents[0] = {};
			item.Parents[0].Name = repository.Name;
			item.Parents[0].Location = repository.Location;
			item.Parents[0].ChildrenLocation = repository.Location;
			item.Parents[1] = {};
			item.Parents[1].Name = "Repositories";
			pageTitle = sectionName + " on " + repository.Name + " - Git";
		} else if (resource && resource.Type === "Clone") {
			var repository = resource;
			
			item.Name = repository.Name;
			item.Parents = [];
			item.Parents[0] = {};
			item.Parents[0].Name = "Repositories";
			pageTitle = repository.Name + " - Git";
		} else {
			item.Name = "Repositories";
			pageTitle = "Repositories - Git";
		}
		
		document.title = pageTitle;
		
		var location = dojo.byId("location");
		var breadcrumb = new mBreadcrumbs.BreadCrumbs({
			container: location,
			resource: item,
			makeHref:function(seg, location){
				that.makeHref(seg, location);
			}
		});		
	};
	
	GitRepositoryExplorer.prototype.makeHref = function(seg, location) {
		seg.href = "/git/git-repository.html#" + (location ? location : "");
	}
	
	// Git repo
	
	GitRepositoryExplorer.prototype.decorateRepositories = function(repositories, mode, deferred){
		var that = this;
		if (deferred == null)
			deferred = new dojo.Deferred();
		
		if (repositories.length > 0) {
			this.registry.getService("orion.core.file").loadWorkspace(repositories[0].ContentLocation + "?parts=meta").then(
				function(resp){
					repositories[0].Content = {};
					
					var path = "root / ";
					if (resp.Parents != null)
						for (var i=resp.Parents.length; i>0; i--){
							path += resp.Parents[i-1].Name + " / ";
						}
					path += resp.Name;
					
					repositories[0].Content.Path = path;
					
					if (mode !== "full"){
						that.decorateRepositories(repositories.slice(1), mode, deferred);
						return;
					}
					
					that.registry.getService("orion.git.provider").getGitStatus(repositories[0].StatusLocation).then(
						function(resp){
							repositories[0].Status = resp;

							that.registry.getService("orion.git.provider").getGitBranch(repositories[0].BranchLocation).then(
								function(resp){
									var branches = resp.Children;
									var currentBranch;
									for (var i=0; i<branches.length; i++){
										if (branches[i].Current){
											currentBranch = branches[i];
											break;
										}
									}
									
									if (currentBranch.RemoteLocation[0] == null){
										that.decorateRepositories(repositories.slice(1), mode, deferred);
										return;
									};
									
									var tracksRemoteBranch = (currentBranch.RemoteLocation.length == 1 && currentBranch.RemoteLocation[0].Children.length === 1);
									
									if (tracksRemoteBranch && currentBranch.RemoteLocation[0].Children[0].CommitLocation){
										that.registry.getService("orion.git.provider").getLog(currentBranch.RemoteLocation[0].Children[0].CommitLocation + "?page=1&pageSize=20", "HEAD", "",
											function(resp){
												repositories[0].CommitsToPush = resp.Children.length;
											}
										);
									} else {
										that.registry.getService("orion.git.provider").doGitLog(currentBranch.CommitLocation + "?page=1&pageSize=20", 
											function(resp){	
												repositories[0].CommitsToPush = resp.Children.length;
											}
										);	
									}
									
									that.decorateRepositories(repositories.slice(1), mode, deferred);
								}
							);
						}	
					);
				}
			);
		} else {
			deferred.callback();
		}
		
		return deferred;
	};
	
	GitRepositoryExplorer.prototype.displayRepositories = function(repositories, mode, links){
		var that = this;
		
		var tableNode = dojo.byId( 'table' );	
		dojo.empty( tableNode );

		var titleWrapper = dojo.create( "div", {"class":"auxpaneHeading sectionWrapper toolComposite", "id":"repositorySectionHeader"}, tableNode );
		
		dojo.create( "span", { "class":"sectionIcon gitImageSprite git-sprite-repository" }, titleWrapper );
		dojo.create( "div", { id: "repositorySectionTitle", "class":"layoutLeft", innerHTML: (mode === "full" ? "Repositories" : "Repository") }, titleWrapper );
		dojo.create( "div", { id: "repositorySectionActionsArea", "class":"layoutRight sectionActions"}, titleWrapper );
				
		if (!repositories || repositories.length === 0){
			dojo.byId("repositorySectionTitle").innerHTML = (mode === "full" ? "No Repositories" : "Repository Not Found");
			return;
		}
		
		var content =	
			'<div class="sectionTable">' +
				'<div class="plugin-settings">' +
					'<list id="repositoryNode" class="plugin-settings-list"></list>' +
				'</div>' +
			'</div>';
		
		dojo.place( content, tableNode );
		
		this.decorateRepositories(repositories, mode).then(
			function(){
				for(var i=0; i<repositories.length;i++){
					that.renderRepository(repositories[i], i, repositories.length, mode, links);
				}
			}
		);
	};
	
	GitRepositoryExplorer.prototype.renderRepository = function(repository, index, length, mode, links){
		var extensionListItem = dojo.create( "div", { "class":"sectionTableItem " + ((length == 1) ? "" : ((index % 2) ? "darkTreeTableRow" : "lightTreeTableRow"))}, dojo.byId("repositoryNode") );
		var horizontalBox = dojo.create( "div", null, extensionListItem );
		
		var detailsView = dojo.create( "div", { "class":"stretch" }, horizontalBox );
		var title = dojo.create( "span", { "class":"gitMainDescription"}, detailsView );
		
		if (links){
			link = dojo.create("a", {"class": "navlinkonpage", href: "/git/git-repository.html#" + repository.Location}, title);
			dojo.place(document.createTextNode(repository.Name), link);
		} else {
			dojo.place(document.createTextNode(repository.Name), title);
		}

		dojo.create( "div", null, detailsView );
		var description = dojo.create( "span", { "class":"gitSecondaryDescription", 
			innerHTML: (repository.GitUrl != null ? repository.GitUrl : "(no remote)") }, detailsView );
		dojo.create( "div", null, detailsView );
		var description = dojo.create( "span", { "class":"gitSecondaryDescription", innerHTML: "location: " + repository.Content.Path }, detailsView );
		
		var status = repository.Status;
		
		if (mode === "full"){
			var unstaged = status.Untracked.length + status.Conflicting.length + status.Modified.length;
			var staged = status.Changed.length + status.Added.length + status.Removed.length;
			
			var workspaceState = ((unstaged > 0 || staged > 0) 
				? unstaged + " file(s) to stage and " + staged + " file(s) to commit."
				: "Nothing to commit.");
			dojo.create( "div", {"style":"padding-top:10px"}, detailsView );		
			dojo.create( "span", { "class":"gitSecondaryDescription", "style":"padding-left:10px", innerHTML: workspaceState}, detailsView );
			
			var commitsState = repository.CommitsToPush;
			dojo.create( "span", { "class":"gitSecondaryDescription", "style":"padding-left:10px", 
				innerHTML: ((commitsState > 0 ) ? commitsState + " commit(s) to push." : "Nothing to push.")}, detailsView );
		}
		
		var actionsArea = dojo.create( "div", {"id":"repositoryActionsArea", "class":"sectionTableItemActions" }, horizontalBox );
		this.commandService.renderCommands(this.actionScopeId, actionsArea, repository, this, "tool");
	};
	
	// Git status
	
	GitRepositoryExplorer.prototype.displayStatus = function(repository){
		
		var statusLocation = repository.StatusLocation;
		
		var that = this;
		
		var tableNode = dojo.byId( 'table' );

		var titleWrapper = dojo.create( "div", {"class":"auxpaneHeading sectionWrapper toolComposite", "id":"workingDirectorySectionHeader"}, tableNode );
		
		dojo.create( "div", { id: "workingDirectorySectionTitle", "class":"layoutLeft", innerHTML: "Working Directory" }, titleWrapper );
		dojo.create( "div", { id: "workingDirectorySectionActionsArea", "class":"layoutRight sectionActions"}, titleWrapper );
		
		var content =	
			'<div class="sectionTable">' +
				'<div class="plugin-settings">' +
					'<list id="workingDirectoryNode" class="plugin-settings-list"></list>' +
				'</div>' +
			'</div>';
		
		dojo.place( content, tableNode );
		
		this.registry.getService("orion.git.provider").getGitBranch(statusLocation).then(
			function(resp){
				var status = resp;
				that.renderStatus(repository, status);
			}, function(error){
				
			}
		);
	};
		
	GitRepositoryExplorer.prototype.renderStatus = function(repository, status){
		var extensionListItem = dojo.create( "div", { "class":"sectionTableItem" }, dojo.byId("workingDirectoryNode") );
		var horizontalBox = dojo.create( "div", null, extensionListItem );
		
		var unstaged = status.Untracked.length + status.Conflicting.length + status.Modified.length;
		var staged = status.Changed.length + status.Added.length + status.Removed.length;
		var workspaceState = "You have no changes to commit."
		
		if (unstaged > 0 || staged > 0)
			workspaceState = "You have changes to commit in your workspace!"
		
		var detailsView = dojo.create( "div", { "class":"vbox stretch details-view"}, horizontalBox );
		var title = dojo.create( "span", { "class":"gitMainDescription", innerHTML: workspaceState}, detailsView );
		dojo.create( "div", null, detailsView );
		
		var description = dojo.create( "span", { "class":"gitSecondaryDescription", 
			innerHTML: unstaged + " file(s) to stage and "
			+ staged + " file(s) to commit."}, detailsView );
				
		var actionsArea = dojo.create( "div", {"id":"statusActionsArea", "class":"sectionTableItemActions"}, horizontalBox );
		this.commandService.renderCommands(this.actionScopeId, actionsArea, repository, this, "tool");	
	};
	
	// Git branches
	
	GitRepositoryExplorer.prototype.decorateBranches = function(branches, deferred){
		var that = this;
		if (deferred == null)
			deferred = new dojo.Deferred();
		
		if (branches.length > 0) {
			this.registry.getService("orion.git.provider").doGitLog(branches[0].CommitLocation + "?page=1&pageSize=1").then(
				function(resp){
					branches[0].Commit = resp.Children[0];
					that.decorateBranches(branches.slice(1), deferred);
				}
			);
		} else {
			deferred.callback();
		}
		
		return deferred;
	};
		
	GitRepositoryExplorer.prototype.displayBranches = function(repository, mode){
		
		var branchLocation = repository.BranchLocation;

		var that = this;
		
		var tableNode = dojo.byId( 'table' );
		
		var titleWrapper = dojo.create( "div", {"class":"auxpaneHeading sectionWrapper toolComposite", "id":"branchSectionHeader"}, tableNode );
		
		dojo.create( "span", { "class":"sectionIcon gitImageSprite git-sprite-branch" }, titleWrapper );
		dojo.create( "div", { id: "branchSectionTitle", "class":"layoutLeft", innerHTML: "Branches" }, titleWrapper );
		dojo.create( "div", { id: "branchSectionProgress", "class": "sectionProgress layoutLeft", innerHTML: "..."}, titleWrapper );
		dojo.create( "div", { id: "branchSectionActionsArea", "class":"layoutRight sectionActions"}, titleWrapper );

		var parentId = "branchSectionHeader";
		
		var slideout = 
			'<div id="' + parentId + 'slideContainer" class="layoutBlock slideParameters slideContainer">' +
				'<span id="' + parentId + 'slideOut" class="slide">' +
				   '<span id="' + parentId + 'pageCommandParameters" class="parameters"></span>' +
				   '<span id="' + parentId + 'pageCommandDismiss" class="parametersDismiss"></span>' +
				'</span>' +
			'</div>';
	
	
		dojo.place( slideout, titleWrapper );
		
		var content =	
			'<div class="sectionTable">' +
				'<div class="plugin-settings">' +
					'<list id="branchNode" class="plugin-settings-list"></list>' +
				'</div>' +
			'</div>';
		
		dojo.place( content, tableNode );
		
		this.registry.getService("orion.git.provider").getGitBranch(branchLocation + (mode === "full" ? "?commits=1" : "?commits=1&page=1&pageSize=5")).then(
			function(resp){
				var branches = resp.Children;
				dojo.style(dojo.byId("branchSectionProgress"), "visibility", "hidden");
				
				if (mode !== "full" && branches.length !== 0){
					that.commandService.registerCommandContribution("branchSectionActionsArea", "eclipse.orion.git.repositories.viewAllCommand", 10);
					that.commandService.renderCommands("branchSectionActionsArea", dojo.byId("branchSectionActionsArea"),
						{"ViewAllLink":"/git/git-repository.html#" + branchLocation + "?page=1", "ViewAllLabel":"View All", "ViewAllTooltip":"View all local and remote tracking branches"}, that, "button");
				}
				
				that.commandService.registerCommandContribution("branchSectionActionsArea", "eclipse.addBranch", 2000);
				that.commandService.renderCommands("branchSectionActionsArea", dojo.byId("branchSectionActionsArea"), repository, this, "button");
				
				for(var i=0; i<branches.length;i++){
					branches[i].ParentLocation = branchLocation;
					that.renderBranch(branches[i], i);
				}
			}, function(error){
				dojo.hitch(that, that.handleError)(error);
			}
		);
	};
		
	GitRepositoryExplorer.prototype.renderBranch = function(branch, index){
		var extensionListItem = dojo.create( "div", { "class":"sectionTableItem " + ((index % 2) ? "darkTreeTableRow" : "lightTreeTableRow")  }, dojo.byId("branchNode") );
		var horizontalBox = dojo.create( "div", null, extensionListItem );

		var detailsView = dojo.create( "div", { "class":"stretch"}, horizontalBox );

		if (branch.Current)
			dojo.create( "span", { "class":"sectionIcon gitImageSprite git-sprite-branch_active" }, detailsView );
		
		var title = dojo.create( "span", { "class":"gitMainDescription " + (branch.Current ? "activeBranch" : ""), innerHTML: branch.Name }, detailsView );
		dojo.create( "div", null, detailsView );
		
		var commit = branch.Commit.Children[0];
		
		var tracksMessage = ((branch.RemoteLocation.length == 1 && branch.RemoteLocation[0].Children.length == 1) ? 
				"tracks " + branch.RemoteLocation[0].Children[0].Name + ", " : "tracks no branch, ");
		
		var description = dojo.create( "span", { "class":"gitSecondaryDescription", 
			innerHTML: tracksMessage 
			+ "last modified " + dojo.date.locale.format(new Date(commit.Time), {formatLength: "short"})
			+ " by " + commit.AuthorName}, detailsView );
		
		var actionsArea = dojo.create( "div", {"id":"branchActionsArea", "class":"sectionTableItemActions" }, horizontalBox );
		this.commandService.renderCommands(this.actionScopeId, actionsArea, branch, this, "tool");	
	};
	
	// Git remote branches
	
	GitRepositoryExplorer.prototype.displayRemoteBranches = function(repository, mode){
		
		var remoteLocation = repository.RemoteLocation;
				
		var that = this;
		
		var tableNode = dojo.byId( 'table' );

		var titleWrapper = dojo.create( "div", {"class":"auxpaneHeading sectionWrapper toolComposite", "id":"remoteBranchSectionHeader"}, tableNode );
		
		dojo.create( "span", { "class":"sectionIcon gitImageSprite git-sprite-branch" }, titleWrapper );
		dojo.create( "div", { id: "remoteBranchSectionTitle", "class":"layoutLeft", innerHTML: "Remote Branches" }, titleWrapper );
		dojo.create( "div", { id: "remoteBranchSectionProgress", "class": "sectionProgress layoutLeft", innerHTML: "..."}, titleWrapper );
		dojo.create( "div", { id: "remoteBranchSectionActionsArea", "class":"layoutRight sectionActions"}, titleWrapper );
		
		var content =	
			'<div class="sectionTable">' +
				'<div class="plugin-settings">' +
					'<list id="remoteBranchNode" class="plugin-settings-list"></list>' +
				'</div>' +
			'</div>';
		
		dojo.place( content, tableNode );

		this.registry.getService("orion.git.provider").getGitRemote(remoteLocation).then(
			function(resp){
				var remotes = resp.Children;
				dojo.style(dojo.byId("remoteBranchSectionProgress"), "visibility", "hidden");
				
				if (remotes.length === 0){
					dojo.byId("remoteBranchSectionTitle").innerHTML = "No Remote Branches";
					return;
				}
				
				that.displayRemoteBranches2(remotes, repository);
			}, function(error){
				
			}
		);
	};
	
	GitRepositoryExplorer.prototype.displayRemoteBranches2 = function(remotes, repository, deferred, anyRemoteBranch){
		var that = this;
		if (deferred == null)
			deferred = new dojo.Deferred();
		
		if (remotes.length > 0) {
			this.registry.getService("orion.git.provider").getGitRemote(remotes[0].Location).then(
				function(resp){
					var remoteBranches = resp.Children;
					for(var i=0; (i<remoteBranches.length);i++){
						remoteBranches[i].Repository = repository;
						that.renderRemoteBranch(remoteBranches[i], i);
					}
					that.displayRemoteBranches2(remotes.slice(1), repository, deferred, (anyRemoteBranch || (remoteBranches.length > 0)));
				}, function () {
					
				}
			);
		} else {
			if (!anyRemoteBranch){
				dojo.style(dojo.byId("remoteBranchSectionProgress"), "visibility", "hidden");
				dojo.byId("remoteBranchSectionTitle").innerHTML = "No Remote Branches";
			}
			deferred.callback();
		}
		
		return deferred;
	};
			
	GitRepositoryExplorer.prototype.renderRemoteBranch = function(remoteBranch, index){
		var extensionListItem = dojo.create( "div", { "class":"sectionTableItem " + ((index % 2) ? "darkTreeTableRow" : "lightTreeTableRow") }, dojo.byId("remoteBranchNode") );
		var horizontalBox = dojo.create( "div", null, extensionListItem );
		
		var detailsView = dojo.create( "div", { "class":"vbox stretch details-view"}, horizontalBox );
		var title = dojo.create( "span", { "class":"gitMainDescription", innerHTML: remoteBranch.Name }, detailsView );
		dojo.create( "div", null, detailsView );
		
		var actionsArea = dojo.create( "div", {"id":"branchActionsArea", "class":"sectionTableItemActions" }, horizontalBox );
		this.commandService.renderCommands(this.actionScopeId, actionsArea, remoteBranch, this, "tool");	
	};

	// Git commits
		
	GitRepositoryExplorer.prototype.displayCommits = function(repository){
				
		var that = this;
		
		var tableNode = dojo.byId( 'table' );

		var titleWrapper = dojo.create( "div", {"class":"auxpaneHeading sectionWrapper toolComposite", "id":"commitSectionHeader"}, tableNode );
		
		dojo.create( "div", { id: "commitSectionTitle", "class":"layoutLeft", innerHTML: "Commits" }, titleWrapper );
		dojo.create( "div", { id: "commitSectionProgress", "class": "sectionProgress layoutLeft", innerHTML: "..."}, titleWrapper );
		dojo.create( "div", { id: "commitSectionActionsArea", "class":"layoutRight sectionActions"}, titleWrapper );
		
		var parentId = "commitSectionHeader";
		
		var slideout = 
			'<div id="' + parentId + 'slideContainer" class="layoutBlock slideParameters slideContainer">' +
				'<span id="' + parentId + 'slideOut" class="slide">' +
				   '<span id="' + parentId + 'pageCommandParameters" class="parameters"></span>' +
				   '<span id="' + parentId + 'pageCommandDismiss" class="parametersDismiss"></span>' +
				'</span>' +
			'</div>';
	
	
		dojo.place( slideout, titleWrapper );

		var content =	
			'<div class="sectionTable">' +
				'<div class="plugin-settings">' +
					'<list id="commitNode" class="plugin-settings-list"></list>' +
				'</div>' +
			'</div>';
		
		dojo.place( content, tableNode );

		this.registry.getService("orion.git.provider").getGitBranch(repository.BranchLocation).then(
			function(resp){
				var branches = resp.Children;
				var currentBranch;
				for (var i=0; i<branches.length; i++){
					if (branches[i].Current){
						currentBranch = branches[i];
						break;
					}
				}
				
				var tracksRemoteBranch = (currentBranch.RemoteLocation.length == 1 && currentBranch.RemoteLocation[0].Children.length === 1);
				
				dojo.byId("commitSectionTitle").innerHTML = "Commits for \"" + currentBranch.Name + "\" branch";
				
				that.commandService.registerCommandContribution("commitSectionActionsArea", "eclipse.orion.git.repositories.viewAllCommand", 10);
				that.commandService.renderCommands("commitSectionActionsArea", dojo.byId("commitSectionActionsArea"), 
					{"ViewAllLink":"/git/git-log.html#" + currentBranch.CommitLocation + "?page=1", "ViewAllLabel":"See Full Log", "ViewAllTooltip":"See the full log"}, that, "button");
						
				if (tracksRemoteBranch){
					that.commandService.registerCommandContribution("commitSectionActionsArea", "eclipse.orion.git.fetch", 100);
					that.commandService.registerCommandContribution("commitSectionActionsArea", "eclipse.orion.git.merge", 100);
					that.commandService.registerCommandContribution("commitSectionActionsArea", "eclipse.orion.git.rebase", 100);
					that.commandService.registerCommandContribution("commitSectionActionsArea", "eclipse.orion.git.resetIndex", 100);
					that.commandService.renderCommands("commitSectionActionsArea", dojo.byId("commitSectionActionsArea"), currentBranch.RemoteLocation[0].Children[0], that, "button"); 
				};
				
				that.commandService.registerCommandContribution("commitSectionActionsArea", "eclipse.orion.git.push", 100);
				that.commandService.renderCommands("commitSectionActionsArea", dojo.byId("commitSectionActionsArea"), currentBranch, that, "button"); 
				
				if (currentBranch.RemoteLocation[0] == null){
					dojo.style(dojo.byId("commitSectionProgress"), "visibility", "hidden");
					that.renderNoCommit();
					return;
				};
				
				if (tracksRemoteBranch && currentBranch.RemoteLocation[0].Children[0].CommitLocation){
					that.registry.getService("orion.git.provider").getLog(currentBranch.RemoteLocation[0].Children[0].CommitLocation + "?page=1&pageSize=20", "HEAD", "",
						function(resp){
							dojo.style(dojo.byId("commitSectionProgress"), "visibility", "hidden");
							
							var commitsCount = resp.Children.length;
							
							for (var i=0; i<resp.Children.length; i++){
								that.renderCommit(resp.Children[i], true, i);
							}
							
							that.registry.getService("orion.git.provider").getLog(currentBranch.CommitLocation + "?page=1&pageSize=20", currentBranch.RemoteLocation[0].Children[0].Id, "", 
								function(resp){	
									for (var i=0; i<resp.Children.length; i++){
										that.renderCommit(resp.Children[i], false, i + commitsCount);
									}
									
									commitsCount = commitsCount + resp.Children.length; 
									
									if (commitsCount == 0)
										that.renderNoCommit();
								}
							);	
						}
					);
				} else {
					that.registry.getService("orion.git.provider").doGitLog(currentBranch.CommitLocation + "?page=1&pageSize=20", 
						function(resp){	
							dojo.style(dojo.byId("commitSectionProgress"), "visibility", "hidden");
						
							for (var i=0; i<resp.Children.length; i++){
								that.renderCommit(resp.Children[i], true, i);
							}
							
							if (resp.Children.length == 0)
								that.renderNoCommit();
						}
					);	
				}
			}
		);
	};
	
	GitRepositoryExplorer.prototype.renderNoCommit = function(){
		var extensionListItem = dojo.create( "div", { "class":"sectionTableItem" }, dojo.byId("commitNode") );
		var horizontalBox = dojo.create( "div", null, extensionListItem );
		
		var detailsView = dojo.create( "div", { "class":"stretch"}, horizontalBox );
		var title = dojo.create( "span", { "class":"gitMainDescription", innerHTML: "The branch is up to date."}, detailsView );
		dojo.create( "div", null, detailsView );
		
		var description = dojo.create( "span", { "class":"gitSecondaryDescription", 
			innerHTML: "You have no outgoing or incoming commits."}, detailsView );	
	};
		
	GitRepositoryExplorer.prototype.renderCommit = function(commit, outgoing, index){
		var extensionListItem = dojo.create( "div", { "class":"sectionTableItem " + ((index % 2) ? "darkTreeTableRow" : "lightTreeTableRow") }, dojo.byId("commitNode") );
		var horizontalBox = dojo.create( "div", null, extensionListItem );
		
		var imgSpriteName = (outgoing ? "git-sprite-outgoing_commit" : "git-sprite-incoming_commit");
		
		dojo.create( "span", { "class":"sectionIcon gitImageSprite " + imgSpriteName}, horizontalBox );
		
		if (commit.AuthorImage) {
			var authorImage = dojo.create("span", {"class":"git-author-icon"}, horizontalBox);
			
			var image = new Image();
			image.src = commit.AuthorImage;
			image.name = commit.AuthorName;
			image.width = 30;
			image.height = 30;
			dojo.place(image, authorImage, "first");
		}
		
		var detailsView = dojo.create( "div", { "class":"stretch"}, horizontalBox );
		
		var titleLink = dojo.create("a", {"class": "gitMainDescription navlinkonpage", href: "/git/git-commit.html#" + commit.Location + "?page=1&pageSize=1"}, detailsView);
		dojo.place(document.createTextNode(commit.Message), titleLink);		
		
		var _timer;
		
		var tooltipDialog = new orion.git.widgets.CommitTooltipDialog({
		    commit: commit,
		    onMouseLeave: function(){
		    	if(dijit.popup.hide)
					dijit.popup.hide(tooltipDialog); //close doesn't work on FF
				dijit.popup.close(tooltipDialog);
            },
            onMouseEnter: function(){
		    	clearTimeout(_timer);
            }
		});
		
		dojo.connect(titleLink, "onmouseover", titleLink, function() {
			clearTimeout(_timer);
			
			_timer = setTimeout(function(){
				dijit.popup.open({
					popup: tooltipDialog,
					around: titleLink,
					orient: {'BR':'TL', 'TR':'BL'}
				});
			}, 600);
		});
		
		dojo.connect(titleLink, "onmouseout", titleLink, function() {
			clearTimeout(_timer);
			
			_timer = setTimeout(function(){
				if(dijit.popup.hide)
					dijit.popup.hide(tooltipDialog); //close doesn't work on FF
				dijit.popup.close(tooltipDialog);
			}, 200);
		});
		
		dojo.create( "div", null, detailsView );
		var description = dojo.create( "span", { "class":"gitSecondaryDescription", 
			innerHTML: " (SHA " + commit.Name + ") by " + commit.AuthorName 
			+ " on " + dojo.date.locale.format(new Date(commit.Time), {formatLength: "short"})}, detailsView );
		
		var actionsArea = dojo.create( "div", {"id":"branchActionsArea", "class":"sectionTableItemActions" }, horizontalBox );
		this.commandService.renderCommands(this.actionScopeId, actionsArea, commit, this, "tool");	
	};

	// Git tags
	
	GitRepositoryExplorer.prototype.decorateTags = function(tags, deferred){
		var that = this;
		if (deferred == null)
			deferred = new dojo.Deferred();
		
		if (tags.length > 0) {
			this.registry.getService("orion.git.provider").doGitLog(tags[0].CommitLocation + "?page=1&pageSize=1").then(
				function(resp){
					tags[0].Commit = resp.Children[0];
					that.decorateTags(tags.slice(1), deferred);
				}
			);
		} else {
			deferred.callback();
		}
		
		return deferred;
	};
	
	GitRepositoryExplorer.prototype.displayTags = function(repository, mode){
		
		var tagLocation = repository.TagLocation;		
		var that = this;
		
		var tableNode = dojo.byId( 'table' );

		var titleWrapper = dojo.create( "div", {"class":"auxpaneHeading sectionWrapper toolComposite", "id":"tagSectionHeader"}, tableNode );
		
		dojo.create( "span", { "class":"sectionIcon gitImageSprite git-sprite-tag" }, titleWrapper );
		dojo.create( "div", { id: "tagSectionTitle", "class":"layoutLeft", innerHTML: ("Tags" + (mode === "full" ? "" : " (5 most recent)")) }, titleWrapper );
		dojo.create( "div", { id: "tagSectionProgress", "class": "sectionProgress layoutLeft", innerHTML: "..."}, titleWrapper );
		dojo.create( "div", { id: "viewAllTagSectionActionsArea", "class":"layoutRight sectionActions"}, titleWrapper );

		var content =	
			'<div class="sectionTable">' +
				'<div class="plugin-settings">' +
					'<list id="tagNode" class="plugin-settings-list"></list>' +
				'</div>' +
			'</div>';
		
		dojo.place( content, tableNode );
		
		this.registry.getService("orion.git.provider").getGitBranch(tagLocation + (mode === "full" ? "" : "?commits=1&page=1&pageSize=5")).then(
			function(resp){
				var tags = resp.Children.slice(0, 5);
				if (mode === 'full')
					tags = resp.Children;
				
				dojo.style(dojo.byId("tagSectionProgress"), "visibility", "hidden");
				
				if (mode !== "full" && tags.length !== 0){
					that.commandService.registerCommandContribution("viewAllTagSectionActionsArea", "eclipse.orion.git.repositories.viewAllCommand", 10);
					that.commandService.renderCommands("viewAllTagSectionActionsArea", dojo.byId("viewAllTagSectionActionsArea"),
						{"ViewAllLink":"/git/git-repository.html#" + tagLocation + "?page=1", "ViewAllLabel":"View All", "ViewAllTooltip":"View all tags"}, that, "button");
				}

				if (tags.length === 0) {
					dojo.byId("tagSectionTitle").innerHTML = "No Tags";
					return;
				}
				
				for(var i=0; i<tags.length ;i++){
					tags[i].Repository = repository;
					that.renderTag(tags[i], i);
				};
			}, function(error){
				dojo.hitch(that, that.handleError)(error);
			}
		);
	};
			
	GitRepositoryExplorer.prototype.renderTag = function(tag, index){
		var extensionListItem = dojo.create( "div", { "class":"sectionTableItem " + ((index % 2) ? "darkTreeTableRow" : "lightTreeTableRow") }, dojo.byId("tagNode") );
		var horizontalBox = dojo.create( "div", null, extensionListItem );
		
		var detailsView = dojo.create( "div", { "class":"stretch"}, horizontalBox );
		var title = dojo.create( "span", { "class":"gitMainDescription", innerHTML: tag.Name }, detailsView );
		
		dojo.create( "div", null, detailsView );
		
		if (tag.Commit){
			var description = dojo.create( "span", { "class":"tag-description"}, detailsView );
			
			var commit = tag.Commit.Children[0];
			var link = dojo.create("a", {"class": "navlinkonpage", href: "/git/git-commit.html#" + commit.Location + "?page=1&pageSize=1"}, description);
			dojo.place(document.createTextNode(commit.Message), link);	
			dojo.place(document.createTextNode(" by " + commit.AuthorName + " on " + 
				dojo.date.locale.format(new Date(commit.Time), {formatLength: "short"})), description, "last");
			
			var _timer;
			
			var tooltipDialog = new orion.git.widgets.CommitTooltipDialog({
			    commit: commit,
			    onMouseLeave: function(){
			    	if(dijit.popup.hide)
						dijit.popup.hide(tooltipDialog); //close doesn't work on FF
					dijit.popup.close(tooltipDialog);
	            },
	            onMouseEnter: function(){
			    	clearTimeout(_timer);
	            }
			});
			
			dojo.connect(link, "onmouseover", link, function() {
				clearTimeout(_timer);
				
				_timer = setTimeout(function(){
					dijit.popup.open({
						popup: tooltipDialog,
						around: link,
						orient: {'BR':'TL', 'TR':'BL'}
					});
				}, 600);
			});
			
			dojo.connect(link, "onmouseout", link, function() {
				clearTimeout(_timer);
				
				_timer = setTimeout(function(){
					if(dijit.popup.hide)
						dijit.popup.hide(tooltipDialog); //close doesn't work on FF
					dijit.popup.close(tooltipDialog);
				}, 200);
			});
				
		}

		var actionsArea = dojo.create( "div", {"id":"tagActionsArea", "class":"sectionTableItemActions" }, horizontalBox );
		this.commandService.renderCommands(this.actionScopeId, actionsArea, tag, this, "tool");	
	};
	
	// Git Remotes
	
	GitRepositoryExplorer.prototype.displayRemotes = function(repository, mode){
		
		var remoteLocation = repository.RemoteLocation;
		mGlobalCommands.setPageTarget(repository, this.registry, this.commandService); 

				
		var that = this;
		
		var tableNode = dojo.byId( 'table' );

		var titleWrapper = dojo.create( "div", {"class":"auxpaneHeading sectionWrapper toolComposite", "id":"remoteSectionHeader"}, tableNode );
		
		dojo.create( "span", { "class":"sectionIcon gitImageSprite git-sprite-remote" }, titleWrapper );
		dojo.create( "div", { id: "remoteSectionTitle", "class":"layoutLeft", innerHTML: "Remotes" }, titleWrapper );
		dojo.create( "div", { id: "remoteSectionProgress", "class": "sectionProgress layoutLeft", innerHTML: "..."}, titleWrapper );
		dojo.create( "div", { id: "remoteSectionActionsArea", "class":"layoutRight sectionActions"}, titleWrapper );

		var parentId = "remoteSectionHeader";
		
		var slideout = 
			'<div id="' + parentId + 'slideContainer" class="layoutBlock slideParameters slideContainer">' +
				'<span id="' + parentId + 'slideOut" class="slide">' +
				   '<span id="' + parentId + 'pageCommandParameters" class="parameters"></span>' +
				   '<span id="' + parentId + 'pageCommandDismiss" class="parametersDismiss"></span>' +
				'</span>' +
			'</div>';
	
	
		dojo.place( slideout, titleWrapper );
		
		this.commandService.registerCommandContribution("remoteSectionActionsArea", "eclipse.addRemote", 2000);
		this.commandService.renderCommands("remoteSectionActionsArea", dojo.byId("remoteSectionActionsArea"), repository, this, "button");
		
		var content =	
			'<div class="sectionTable">' +
				'<div class="plugin-settings">' +
					'<list id="remoteNode" class="plugin-settings-list"></list>' +
				'</div>' +
			'</div>';
		
		dojo.place( content, tableNode );
		
		this.registry.getService("orion.git.provider").getGitRemote(remoteLocation).then(
			function(resp){
				var remotes = resp.Children;
				
				dojo.style(dojo.byId("remoteSectionProgress"), "visibility", "hidden");
				
				if (remotes.length === 0){
					dojo.byId("remoteSectionTitle").innerHTML = "No Remotes";
					return;
				}
				
				for(var i=0; i<remotes.length ;i++){
					that.renderRemote(remotes[i], i);
				};
			}, function(error){
				dojo.hitch(that, that.handleError)(error);
			}
		);
	};
	
	GitRepositoryExplorer.prototype.renderRemote = function(remote, index){
		var extensionListItem = dojo.create( "div", { "class":"sectionTableItem " + ((index % 2) ? "darkTreeTableRow" : "lightTreeTableRow")  }, dojo.byId("remoteNode") );
		var horizontalBox = dojo.create( "div", null, extensionListItem );
		
		var detailsView = dojo.create( "div", { "class":"stretch"}, horizontalBox );
		var title = dojo.create( "span", { "class":"gitMainDescription", innerHTML: remote.Name }, detailsView );
		
		dojo.create( "div", null, detailsView );
		var description = dojo.create( "span", { "class":"gitSecondaryDescription", innerHTML: remote.GitUrl}, detailsView );

		var actionsArea = dojo.create( "div", {"id":"remoteActionsArea", "class":"sectionTableItemActions" }, horizontalBox );
		this.commandService.renderCommands(this.actionScopeId, actionsArea, remote, this, "tool");	

	};
	
	// Git Config
	
	GitRepositoryExplorer.prototype.displayConfig = function(repository, mode){
		
		var configLocation = repository.ConfigLocation;
	
		var that = this;
		
		var tableNode = dojo.byId( 'table' );

		var titleWrapper = dojo.create( "div", {"class":"auxpaneHeading sectionWrapper toolComposite", "id":"configSectionHeader"}, tableNode );
		
		dojo.create( "div", { id: "configSectionTitle", "class":"layoutLeft", innerHTML: "Configuration" + (mode === "full" ? "" : " (user.*)") }, titleWrapper );
		dojo.create( "div", { id: "configSectionActionsArea", "class":"layoutRight sectionActions"}, titleWrapper );
		dojo.create( "div", { id: "viewAllConfigSectionActionsArea", "class":"layoutRight sectionActions"}, titleWrapper );

		var parentId = "configSectionHeader";
		
		var slideout = 
			'<div id="' + parentId + 'slideContainer" class="layoutBlock slideParameters slideContainer">' +
				'<span id="' + parentId + 'slideOut" class="slide">' +
				   '<span id="' + parentId + 'pageCommandParameters" class="parameters"></span>' +
				   '<span id="' + parentId + 'pageCommandDismiss" class="parametersDismiss"></span>' +
				'</span>' +
			'</div>';
	
	
		dojo.place( slideout, titleWrapper );
		
		
		
		var content =	
			'<div class="sectionTable">' +
				'<div class="plugin-settings">' +
					'<list id="configNode" class="plugin-settings-list"></list>' +
				'</div>' +
			'</div>';
		
		dojo.place( content, tableNode );
				
		this.registry.getService("orion.git.provider").getGitCloneConfig(configLocation).then(
			function(resp){
				var configurationEntries = resp.Children;
				
				if (mode !== "full" && configurationEntries.length !== 0){
					that.commandService.registerCommandContribution("viewAllConfigSectionActionsArea", "eclipse.orion.git.repositories.viewAllCommand", 10);
					that.commandService.renderCommands("viewAllConfigSectionActionsArea", dojo.byId("viewAllConfigSectionActionsArea"),
						{"ViewAllLink":"/git/git-repository.html#" + configLocation, "ViewAllLabel":"View All", "ViewAllTooltip":"View all configuration entries"}, that, "button");
				}
				
				if (mode === "full"){
					that.commandService.registerCommandContribution("configSectionActionsArea", "eclipse.orion.git.addConfigEntryCommand", 1000);
					that.commandService.renderCommands("configSectionActionsArea", dojo.byId("configSectionActionsArea"), repository, this, "button");
				}
				
				if (configurationEntries.length === 0){
					dojo.byId("configSectionTitle").innerHTML = "No Configuration";
					return;
				}
				
				for(var i=0; i<configurationEntries.length ;i++){
					if (mode === "full" || configurationEntries[i].Key.indexOf("user.") !== -1)
						that.renderConfigEntry(configurationEntries[i], i);
				};
			}, function(error){
				dojo.hitch(that, that.handleError)(error);
			}
		);
	};
	
	GitRepositoryExplorer.prototype.renderConfigEntry = function(configEntry, index){
		var extensionListItem = dojo.create( "div", { "class":"sectionTableItem " + ((index % 2) ? "darkTreeTableRow" : "lightTreeTableRow")  }, dojo.byId("configNode") );
		var horizontalBox = dojo.create( "div", null, extensionListItem );
		
		var detailsView = dojo.create( "div", { "class":"stretch"}, horizontalBox );
		dojo.create( "span", { "class":"gitMainDescription", innerHTML: configEntry.Key }, detailsView );
		dojo.create( "span", { "class":"gitSecondaryDescription", "style":"margin-left:20px", innerHTML: configEntry.Value}, detailsView );

		var actionsArea = dojo.create( "div", {"id":"configActionsArea", "class":"sectionTableItemActions" }, horizontalBox );
		this.commandService.renderCommands(this.actionScopeId, actionsArea, configEntry, this, "tool");

	};
	
	return GitRepositoryExplorer;
}());

return exports;

// end of define
});
