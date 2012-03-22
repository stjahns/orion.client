/*******************************************************************************
 * @license
 * Copyright (c) 2009, 2011 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/
/*global dojo dijit window eclipse:true*/

define(['require', 'dojo', 'dijit', 'orion/commands', 'orion/auth', 'orion/breadcrumbs',
	        'dojo/parser', 'dojo/hash', 'dojo/date/locale', 'dijit/layout/ContentPane', 'dijit/form/TextBox', 'dijit/form/CheckBox', 'dijit/form/Form'], 
			function(require, dojo, dijit, mCommands ,mAuth, mBreadcrumbs) {

	/**
	 * Used when a value should be displayed as Date but is returned as long.
	 * Value displayed in always read only.
	 */

	function DateLong(options){
		this._init(options);
	}
	DateLong.prototype = {
		_init: function(options){
			options.style = "display: none";
			options.readOnly = true;
			this.contentText = new dijit.form.TextBox(options);
			this.contentText.set('ecliplseCustomValue',true);
			this.dateP = dojo.create("span", {innerHTML: "&nbsp;", className: "userprofile"});
			dojo.connect(this.contentText, "onChange", dojo.hitch(this, function(myDijit,p){
					if(myDijit.get('value')!==""){
						var value = parseInt(myDijit.get('value'));
						p.innerHTML = dojo.date.locale.format(new Date(value), {formatLength: "short"});
					}
					if(p.innerHTML==="") {
						p.innerHTML="&nbsp";
					}
				}, this.contentText, this.dateP));
			this.get = dojo.hitch(this.contentText,this.contentText.get);
			this.set = dojo.hitch(this.contentText,this.contentText.set);
		},
		placeAt: function(node){
			this.contentText.placeAt(node);
			dojo.place(this.dateP, node);
		}
	};

	function Profile(options) {
		this._init(options);
	}
	
	Profile.prototype = {
		_init : function(options) {
	
			this.registry = options.registry;
			this.pluginRegistry = options.pluginRegistry;
			this.profilePlaceholder = options.profilePlaceholder;
			this.commandService = options.commandService;
			this.pageActionsPlaceholder = options.pageActionsPlaceholder;
			this.usersClient = options.usersClient;
			this.iframes = new Array();
			
			var userProfile = this;
			
			this.usersService = this.registry.getService("orion.core.user");
			
			if(this.usersService !== null){
				this.usersService.addEventListener("requiredPluginsChanged", function(pluginsList){
					dojo.hitch(userProfile, userProfile.drawPlugins(pluginsList.plugins));
				});
				this.usersService.addEventListener("userInfoChanged", function(jsonData){
					dojo.hitch(userProfile,	userProfile.populateData(jsonData));
				});
				this.usersService.addEventListener("userDeleted", function(jsonData){
					window.location.replace("/");
				});
				dojo.hitch(userProfile, function(){this.addInputListener();})();
			}
	
		},
		addInputListener: function(){			
			dojo.subscribe("/dojo/hashchange", this, function() {
				this.setUserToDisplay(dojo.hash());
			});
			var uri = dojo.hash();
			if(uri && uri!=="") {
				this.setUserToDisplay(uri);
			}
			else{
						
				// TODO if no hash provided current user profile should be loaded - need a better way to find logged user URI
				//NOTE: require.toURL needs special logic here to handle "login"
				var loginUrl = require.toUrl("login._");
				loginUrl = loginUrl.substring(0,loginUrl.length-2);
				
				dojo.xhrPost({
					url : require.toUrl("login"),
					headers : {
						"Orion-Version" : "1"
					},
					handleAs : "json",
					timeout : 15000,
					load : function(jsonData, ioArgs) {
						dojo.hash(jsonData.Location);
					},
					error : function(response, ioArgs) {
						var currentXHR = this;
						mAuth.handleAuthenticationError(ioArgs.xhr, function(){
							dojo.xhrPost(currentXHR); // retry POST							
						});
					}
				});
			}
		},
		drawPlugins : function(pluginsList){
			
			var userProfile = this;
			
			if(this.profileForm){
				while(this.profileForm.get("domNode").lastChild){
					dojo.destroy(this.profileForm.get("domNode").lastChild);
				}
				
				this.profileForm.destroy();
				this.iframes = new Array();
			}
			this.pageActionsPlaceholder =  dojo.byId('pageActions');
			dojo.empty(this.pageActionsPlaceholder);
			
			this.profileForm = new dijit.form.Form({id: "profileForm"});			
			
			this.profileForm.placeAt(this.profilePlaceholder);
			
			var userPluginDiv = dojo.create("div", null, userProfile.profileForm.get("domNode"));
			
			
			this.usersClient.getDivContent().then(function(content) {
				dojo.hitch(userProfile, userProfile.draw(content, userPluginDiv));
			});
			
			
			
			for(var i=0; i<pluginsList.length; i++){
				var pluginDiv = dojo.create("div", {style: "clear: both", innerHTML: "Loading " + pluginsList[i].Url + "..."}, userProfile.profileForm.get("domNode"));
				var pluginReference= this.pluginRegistry.getPlugin(pluginsList[i].Url);
				if(pluginReference===null){
					var registry = this.registry;
					dojo.hitch(this, function(div){this.pluginRegistry.installPlugin(pluginsList[i].Url).then(
							function(ref){
								var pluginService = registry.getService(ref.getServiceReferences()[0]);
								if(pluginService.getDivContent) {
									pluginService.getDivContent().then(function(content) {
										dojo.hitch(userProfile, userProfile.draw(content, div));
									});
								}
							});
					})(pluginDiv);
					continue;
				}
				var plugin = this.registry.getService(pluginReference.getServiceReferences()[0]);
				
				if(plugin===null){
					console.error("Could not deploy plugin " + pluginsList[i].Url);
					continue;
				}
				dojo.hitch(this, function(div){
					plugin.getDivContent().then(function(content) {
						dojo.hitch(userProfile, userProfile.draw(content, div));
					});
				})(pluginDiv);
			}
			
	
		},
		setUserToDisplay : function(userURI) {
			this.currentUserURI = userURI;
			this.usersClient.initProfile(userURI, "requiredPluginsChanged", "userInfoChanged");
			
		},
		redisplayLastUser : function(){
			var profile = this;
			this.usersClient.getUserInfo(profile.currentUserURI);
		},
		populateData: function(jsonData){
			if(jsonData && jsonData.login){
				this.lastJSON = jsonData;
				if(this.profileForm){
					this.profileForm.reset();
					this.profileForm.set('value', jsonData);
					if(dojo.byId("profileBanner"))
						dojo.byId("profileBanner").innerHTML = "Profile Information for <b style='color: #000'>" + jsonData.login + "</b>";
				}
				for(var i in this.iframes){
					this.setHash(this.iframes[i], jsonData.Location);
				}
			}else{
				throw new Error("User is not defined");
			}
		},
		setHash: function(iframe, hash){
			if(iframe.src.indexOf("#")>0){
				iframe.src = iframe.src.substr(0, iframe.src.indexOf("#")) + "#" + hash;
			}else{
				iframe.src = iframe.src + "#" + hash;
			}
		},
		createFormElem: function(json, node){
			  if(!json.type){
			    throw new Error("type is missing!");
			  }
			  var cls = dojo.getObject(json.type, false, dijit.form);
			  if(!cls){
			    cls = dojo.getObject(json.type, false);
			  }
			  if(cls){
				  if(dijit.byId(json.props.id))
					  dijit.byId(json.props.id).destroy();
				  
				  formElem = new cls(json.props);
				  formElem.placeAt(node);
				  
				  function setInnerHTML(myDijit,p){
					  if(myDijit.declaredClass==="dijit.form.CheckBox"){
						  p.innerHTML = myDijit.get('checked') ? "yes" : "no";
						  return;
					  }
					  p.innerHTML = myDijit.get('value');
					  if(p.innerHTML=="")
						  p.innerHTML="&nbsp";
					};
				  
				  if(formElem.get('readOnly')===true && !formElem.get('ecliplseCustomValue')){
					  formElem.set('style', 'display: none');
					  var p = dojo.create("span", {id: formElem.get('id')+"_p", className: "userprofile", innerHTML: formElem.get('value')?formElem.get('value'):"&nbsp;"}, node, "last");
					  
					  setInnerHTML(formElem, p);
					  
					  dojo.connect(formElem, "onChange", dojo.hitch(this, function(myDijit,p){
						  if(myDijit.declaredClass==="dijit.form.CheckBox"){
							  p.innerHTML = myDijit.get('checked') ? "yes" : "no";
							  return;
						  }
						  p.innerHTML = myDijit.get('value');
						  if(p.innerHTML=="")
							  p.innerHTML="&nbsp";
						}, formElem, p));
				  }
				  
				  return formElem;
			  }else{
				  return new Error("Type not found " + json.type);
			  }
			  
			},
		drawIframe: function(desc, placeholder){
			var iframe = dojo.create("iframe", desc, placeholder);
			this.iframes.push(iframe);
			if(this.lastJSON)
				this.setHash(iframe, this.lastJSON.Location);
			dojo.place(iframe, placeholder);
		},
		
		draw: function(content, placeholder){
			var profile = this;
			placeholder.innerHTML = "";
			if(content.sections)
			for(var i=0; i<content.sections.length; i++){
				
				if(dijit.byId(content.sections[i].id))
					dijit.byId(content.sections[i].id).destroy();

				var titleWrapper = dojo.create( "div", {"class":"auxpaneHeading sectionWrapper toolComposite", "id": content.sections[i].id + "_SectionHeader"}, placeholder );
				
				dojo.create( "div", { id: content.sections[i].id + "_SectionTitle", "class":"layoutLeft", innerHTML: content.sections[i].name }, titleWrapper );

				var content2 =	
					'<div class="sectionTable">' +
						'<list id="' + content.sections[i].id + '"></list>' +
					'</div>';
				
				dojo.place( content2, placeholder );

				var sectionContents = dojo.create("div", null, placeholder);
				
				if(content.sections[i].type==="iframe"){
					dojo.hitch(this, this.drawIframe(content.sections[i].data, sectionContents));
					return;
				}

				for(var j=0; j<content.sections[i].data.length; j++){
					var tableListItem = dojo.create( "div", { "class":"sectionTableItem"}, dojo.byId(content.sections[i].id) );
					
					var data = content.sections[i].data[j];
					var label = dojo.create("label", {"for": data.props.id}, tableListItem);
					dojo.create( "span", {style: "min-width:150px; display:inline-block", innerHTML: data.label }, label );				
					var input = this.createFormElem(data, label);
					dojo.connect(input, "onKeyPress", dojo.hitch(profile, function(event){ if (event.keyCode === 13) { this.fire(); } else {return true;}}));
					if(this.lastJSON && data.props && this.lastJSON[data.props.name]){
						input.set('value', this.lastJSON[data.props.name]);
					}
				}
			}
			if(content.actions && content.actions.length>0){
				
				var bannerPane = dojo.byId('pageTitle');
				
				dojo.empty(bannerPane);
				dojo.create("span", {id:"profileBanner", innerHTML: "User Profile"}, bannerPane);
	
				var location = dojo.byId("location");
				if (location) {
					dojo.empty(location);
					new mBreadcrumbs.BreadCrumbs({
						container: "location",
						firstSegmentName: (profile.lastJSON.Name && profile.lastJSON.Name.replace(/^\s+|\s+$/g,"")!=="") ? profile.lastJSON.Name : profile.lastJSON.login
					});
				}
				
				dojo.empty(this.pageActionsPlaceholder);
				this.commandService.addCommandGroup(this.pageActionsPlaceholder.id, "eclipse.profileActionsGroup", 100);
				for(var i=0; i<content.actions.length; i++){
					var info = content.actions[i];
					var commandOptions = {
							name: info.name,
							image: info.image,
							id: info.id,
							tooltip: info.tooltip,
							callback: dojo.hitch(profile, function(action){this.fire(action);}, info.action)
					};
					var command = new mCommands.Command(commandOptions);
					this.commandService.addCommand(command);					
					this.commandService.registerCommandContribution(this.pageActionsPlaceholder.id, info.id, i, "eclipse.profileActionsGroup");
				}
				this.commandService.renderCommands(this.pageActionsPlaceholder.id, this.pageActionsPlaceholder, {}, {}, "button");
				
			}
			
		},
		fire: function(action){
			var self = this;
			var data = new Object();
			//collect all data that are not reaonly and are not empty passwords
			dojo.forEach(dijit.byId('profileForm').getDescendants(), function(widget){ 
	            var name = widget.name; 
	            if(!name || widget.disabled || widget.get('readOnly')){ return; }
	            if(widget.get('type') && widget.get('type')=='password' && widget.get('value')==="") {return;}
	            data[name] = widget.get('value');
			});
			var url = this.currentUserURI;
			this.usersClient.fire(action, url, data).then(
					function(info){
//							if(checkUser) checkUser(); //refresh the user header because user might been changed or user could be deleted
							dojo.hitch(self, self.displayMessage)(info, "Info");
						},
					function(error){
							if(error.status===401 || error.status===403 )
								return;
					dojo.hitch(self, self.displayMessage)(error, "Error");

				});
	
		},
		displayMessage: function(message, severity){
			if(!message)
				return;
			
			var display = [];
			
			display.Severity = severity;
			display.HTML = false;
			
			try{
				var resp = JSON.parse(message.responseText);
				display.Message = resp.DetailedMessage ? resp.DetailedMessage : resp.Message;
			}catch(Exception){
				display.Message = message.Message;
			}
			
			if(display.Message){
				this.registry.getService("orion.page.message").setProgressResult(display);	
			}
		}
	};
	// this has to be a global for now
	window.eclipse = window.eclipse || {};
	window.eclipse.DateLong = DateLong;
	return {
		Profile:Profile,
		DateLong:DateLong
	};
});
