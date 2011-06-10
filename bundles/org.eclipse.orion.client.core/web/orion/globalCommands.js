/*******************************************************************************
 * Copyright (c) 2011 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/
/*global window document define login logout orion eclipse */
/*browser:true*/

define(['dojo', 'dijit', 'orion/commands', 'orion/util', 'orion/textview/keyBinding', 
        'dijit/Menu', 'dijit/MenuItem', 'dijit/form/DropDownButton', 'orion/widgets/OpenResourceDialog'], function(dojo, dijit, mCommands, mUtil, mKeyBinding ){

	/**
	 * This class contains static utility methods. It is not intended to be instantiated.
	 * @class This class contains static utility methods for creating and managing 
	 * global commands.
	 * @name orion.globalCommands
	 */

	// BEGIN TOP BANNER FRAGMENT
	var topHTMLFragment =
	// a table?!!?  Yes, you can't mix CSS float right and absolutes to pin the bottom.
	'<table style="border-spacing: 0px; margin: 0; padding: 0; border-collapse: collapse; width: 100%;">' +
	// Row 1:  Logo + page title + primary nav links
		'<tr class="topRowBanner" id="bannerRow1">' +
			'<td rowspan=3 style="padding-top: 12px; padding-bottom: 12px; padding-left: 16px; width: 124px"><a id="home" href="/index.html"><img class="toolbarLabel" src="/images/orion.png" alt="Orion Logo" align="top"></a></td>' +
			'<td class="leftGlobalToolbar" style="padding-top: 12px">' +
				'<span id="pageTitle" class="pageTitle"></span>' +
			'</td>' + 
			'<td class="rightGlobalToolbar" style="padding-top: 12px">' +
				'<span id="primaryNav" class="globalActions"></span>' +
			'</td>' + 
		'</tr>' +
	// Row 2:  Location (optional breadcrumb + current page resource)
		'<tr class="topRowBanner" id="bannerRow2">' +
			'<td>' +
				'<span id="location" class="currentLocation"></span>' +
			'</td>' + 
			'<td>' +
				'<span></span>' +
			'</td>' + 
		'</tr>' +
	// Row 3:  Status on left, global commands, search, user, etc. on right
		'<tr class="topRowBanner" id="bannerRow3">' +
			'<td style="text-align: left">' +
				'<span id="statusPane"></span>' +
				'<span id="notifications"></span>' +
			'</td>' +
			'<td style="text-align: right">' +
				'<span id="globalActions" class="globalActions"></span>' +
				'<input type="search" id="search" class="searchbox">' +
				'<span id="userInfo"></span>' +
				'<span id="help" class="help"><a id="help" href="/help/index.jsp">?</a></span>' +
			'</td>' + 
		'</tr>' +
		
	// Row 4: Page Toolbar
		'<tr class="pageToolbar">' +
			'<td colspan=3 style="padding-left: 16px;" id="pageToolbar" class="pageToolbar">' +
				'<span id="pageActions" class="pageActions"></span>' +
			'</td>' +
		'</tr>' +
	'</table>';
	

	// END TOP BANNER FRAGMENT
	
	// BEGIN BOTTOM BANNER FRAGMENT
	// styling of the surrounding div (text-align, etc) is in ide.css "footer"
	var bottomHTMLFragment = '<img src="http://dev.eclipse.org/small_icons/emblems/emblem-important.png"/> ' + 
		'This is a Beta build of Orion.  You can use it, play with it and explore the ' +
		'capabilities but BEWARE your data may be lost. &nbsp;| '+ 
		'<a href="http://wiki.eclipse.org/Orion/FAQ">FAQ</a> | ' + 
		'<a href="https://bugs.eclipse.org/bugs/enter_bug.cgi?product=e4&component=Orion&version=0.2">Report a Bug</a> | ' +
		'<a href="http://www.eclipse.org/legal/privacy.php">Privacy Policy</a> | ' + 
		'<a href="http://www.eclipse.org/legal/termsofuse.php">Terms of Use</a> | '+ 
		'<a href="http://www.eclipse.org/legal/copyright.php">Copyright Agent</a>'; 
	// END BOTTOM BANNER FRAGEMENT

	var userDataToSet = null;

	/**
	 * Adds the user-related commands to the toolbar
	 * @name orion.globalCommands#generateUserInfo
	 * @function
	 */
	function generateUserInfo(userName, userStatusText) {
		// add the logout button to the toolbar if available
		var userInfo = dojo.byId("userInfo");
		if (userInfo) {
			dojo.addClass(userInfo, "globalActions");
			var userMenu = dijit.byId("userMenu");
			if (userMenu) {
				userMenu.destroy();
			}
			dojo.empty(userInfo);
			if (userName) {
				mUtil.setUserName(userName);
				// user menu
				var newMenu= new dijit.Menu({
					style: "display: none;",
					id: "userMenu"
				});
				
				// profile item
				var menuitem2 = new dijit.MenuItem({
					label: "Profile",
					onClick: 
						dojo.hitch(this, 
								function(){window.location = "/profile/user-profile.html#/users/" + userName;})	
				});
				newMenu.addChild(menuitem2);
				
				// signout item
				var menuitem = new dijit.MenuItem({
					label: "Sign out",
					onClick: logout
				});
				newMenu.addChild(menuitem);
	
				var menuButton = new dijit.form.DropDownButton({
					label: userName,
					dropDown: newMenu,
					title: userStatusText
			        });
			        dojo.addClass(menuButton.domNode, "commandImage");
				dojo.place(menuButton.domNode, userInfo, "last");
			} else {
				var signout = document.createElement('span');
				signout.appendChild(document.createTextNode("Sign in"));
				signout.onclick = function(){login();};
				signout.id = "signOutUser";
				userInfo.appendChild(signout);
				dojo.addClass(signout, "commandLink");
			}
			
			userDataToSet = null;
		}else{
			userDataToSet = {userName : userName, userStatusText : userStatusText};
		}
	}

	/**
	 * Adds the DOM-related commands to the banner
	 * @name orion.globalCommands#generateDomCommandsInBanner
	 * @function
	 */
	function generateDomCommandsInBanner(commandService, handler , pageActionDomId , useImage) {
		var toolbar = dojo.byId("pageActions");
		if(pageActionDomId) {
			toolbar = dojo.byId(pageActionDomId);
		}
		if (toolbar) {	
			dojo.empty(toolbar);
			commandService.renderCommands(toolbar, "dom", handler, handler, "image", null, null, !useImage);  // use true when we want to force toolbar items to text
		}
	}
	
	/**
	 * Generates the banner at the top of a page.
	 * @name orion.globalCommands#generateBanner
	 * @function
	 */
	function generateBanner(parentId, serviceRegistry, commandService, prefsService, searcher, handler, /* optional */ editor, /* optional */ escapeProvider) {
		// this needs to come from somewhere but I'm not going to do a separate get for it
		var searchLocation = "/filesearch?q=";
		var text;
		var parent = dojo.byId(parentId);
		if (!parent) {
			throw "could not find banner parent, id was " + parentId;
		}
		
		// place the HTML fragment from above.
		dojo.place(topHTMLFragment, parent, "only");
		
		// place an empty div for keyAssist
		dojo.place('<div id="keyAssist" class="keyAssistFloat"></div>', document.body, "last");
		
		// generate primary nav links. 
		var primaryNav = dojo.byId("primaryNav");
		if (primaryNav) {
			// Note that the shape of the "orion.page.link" extension is not in any shape or form that could be considered final.
			// We've included it to enable experimentation. Please provide feedback on IRC or bugzilla.
			
			// The shape of a contributed navigation link is (for now):
			// info - information about the navigation link (object).
			//     required attribute: name - the name of the navigation link
			//     required attribute: id - the id of the navigation link
			//     required attribute: href - the URL for the navigation link
			//     optional attribute: image - a URL to an icon representing the link (currently not used, may use in future)
			var navLinks= serviceRegistry.getServiceReferences("orion.page.link");
			for (var i=0; i<navLinks.length; i++) {
				serviceRegistry.getService(navLinks[i]).then(function(service) {
					var info = {};
					var propertyNames = navLinks[i].getPropertyNames();
					for (var j = 0; j < propertyNames.length; j++) {
						info[propertyNames[j]] = navLinks[i].getProperty(propertyNames[j]);
					}
					if (info.href && info.name) {
						var link = dojo.create("a", {href: info.href}, primaryNav, "last");
						dojo.addClass(link, "commandLink");
						text = document.createTextNode(info.name);
						dojo.place(text, link, "only");
					}
				});
			}
		}
		
		// hook up search box behavior
		var searchField = dojo.byId("search");
		if (!searchField) {
			throw "failed to generate HTML for banner";
		}
		dojo.connect(searchField, "onkeypress", function(e){
			if (e.charOrCode === dojo.keys.ENTER) {
				if (searchLocation) {
					if (searchField.value.length > 0) {
						var query = searchLocation + searchField.value;
						window.location = "/search/search.html#"+query;
					}
				} else {
					window.alert("Can't search: SearchLocation not available");
				}
			}
		});
		
		// Put page title in title area.  This gets replaced by breadcrumbs, etc. in some pages.
		var title = dojo.byId("pageTitle");
		if (title) {
			text = document.createTextNode(document.title);
			dojo.place(text, title, "last");
		}
	
		var openResourceDialog = function(searchLocation, searcher, /* optional */ editor) {
			var dialog = new orion.widgets.OpenResourceDialog({
				SearchLocation: searchLocation,
				searcher: searcher
			});
			if (editor) {
				dojo.connect(dialog, "onHide", function() {
					editor.getTextView().focus(); // Focus editor after dialog close, Dojo's doesn't work
				});
			}
			window.setTimeout(function() {dialog.show();}, 0);
		};
			
		var openResourceCommand = new mCommands.Command({
			name: "Find File Named...",
			image: "/images/find.gif",
			id: "eclipse.openResource",
			callback: function(item) {
				openResourceDialog(searchLocation, searcher, editor);
			}});
			
		// We need a mod key binding in the editor, for now use the old one (ctrl-shift-r)
		if (editor) {
			editor.getTextView().setKeyBinding(new mKeyBinding.KeyBinding("r", true, true, false), "Find File Named...");
			editor.getTextView().setAction("Find File Named...", function() {
					openResourceDialog(searchLocation, searcher, editor);
					return true;
				});
		}
		
		// We are using 't' for the non-editor binding because of git-hub's use of t for similar function
		commandService.addCommand(openResourceCommand, "global");
		commandService.registerCommandContribution("eclipse.openResource", 1, "globalActions", null, new mCommands.CommandKeyBinding('t'), true);
		
		var keyAssistNode = dojo.byId("keyAssist");
		dojo.connect(document, "onkeypress", dojo.hitch(this, function (e){ 
			if (e.charOrCode === dojo.keys.ESCAPE) {
				keyAssistNode.style.display = "none";
			}
		}));
		
		if (escapeProvider) {
			var keyAssistEscHandler = {
				isActive: function() {
					return keyAssistNode.style.display === "block";
				},
				
				cancel: function() {
					if (this.isActive()) {
						keyAssistNode.style.display = "none";
						return true;
					}
					return false;   // not handled
				}
			};
			escapeProvider.addHandler(keyAssistEscHandler);
		}
		
		var keyAssistCommand = new mCommands.Command({
			name: "Show Keys",
			id: "eclipse.keyAssist",
			callback: function() {
				dojo.empty(keyAssistNode);
				if (editor) {
					dojo.place("<h2>Editor</h2>", keyAssistNode, "last");
					var editorActions = editor.getTextView().getActions(false);
					for(var i=0; i<editorActions.length; i++) {
						var actionName = editorActions[i];
						var bindings = editor.getTextView().getKeyBindings(actionName);
						for (var j=0; j<bindings.length; j++) {
							dojo.place("<span>"+mUtil.getUserKeyString(bindings[j])+" = " + actionName + "<br></span>", keyAssistNode, "last");
						}
					}
				}
				dojo.place("<h2>Global</h2>", keyAssistNode, "last");
				commandService.showKeyBindings(keyAssistNode);
				keyAssistNode.style.display = "block";
				return true;
			}});
		commandService.addCommand(keyAssistCommand, "global");
		commandService.registerCommandContribution("eclipse.keyAssist", 1, "globalActions", null, new mCommands.CommandKeyBinding(191, false, true), true);
		if (editor) {
			editor.getTextView().setKeyBinding(new mCommands.CommandKeyBinding(191, true, true), "Show Keys");
			editor.getTextView().setAction("Show Keys", keyAssistCommand.callback);
		}

		// generate global commands
		var toolbar = dojo.byId("globalActions");
		if (toolbar) {	
			dojo.empty(toolbar);
			// need to have some item, for global scoped commands it won't matter
			var item = handler || {};
			commandService.renderCommands(toolbar, "global", item, handler, "image");
		}
		
		if (userDataToSet) {
			//if last time we couldn't set the user name try again after creating the banner
			generateUserInfo(userDataToSet.userName, userDataToSet.userStatusText);
		}
		
		// generate the footer. 
		// TODO The footer div id should not be assumed here
		if (bottomHTMLFragment) {
			var footer = dojo.byId("footer");
			if (footer) {
				dojo.place(bottomHTMLFragment, footer, "only");
			}
		}
	
	}
	//return the module exports
	return {
		generateUserInfo: generateUserInfo,
		generateDomCommandsInBanner: generateDomCommandsInBanner,
		generateBanner: generateBanner
	};
});
