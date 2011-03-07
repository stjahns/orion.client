/*******************************************************************************
 * Copyright (c) 2011 IBM Corporation and others. All rights reserved. This
 * program and the accompanying materials are made available under the terms of
 * the Eclipse Public License v1.0 which accompanies this distribution, and is
 * available at http://www.eclipse.org/legal/epl-v10.html
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/

dojo.addOnLoad(function() {

	var serviceRegistry = new eclipse.ServiceRegistry();
	var inputService = new eclipse.InputService(serviceRegistry);
	var pluginRegistry = new eclipse.PluginRegistry(serviceRegistry);
	var commandService = new eclipse.CommandService({serviceRegistry: serviceRegistry});
	var prefsService = new eclipse.Preferences(serviceRegistry, "/prefs/user");
	var searcher = new eclipse.Searcher({serviceRegistry: serviceRegistry});
	
	var profile = new eclipse.Profile({
		registry : serviceRegistry,
		pluginRegistry: pluginRegistry,
		profilePlaceholder: dojo.byId('profileContent'),
		commandService: commandService
	});
	
	eclipse.globalCommandUtils.generateBanner("toolbar", commandService, prefsService, searcher, profile, profile);
	eclipse.globalCommandUtils.generateDomCommandsInBanner(commandService, profile);
});

/**
 * @namespace The global container for eclipse APIs.
 */
var eclipse = eclipse || {};

/**
 * Used when a value should be displayed as Date but is returned as long.
 * Value displayed in always read only.
 */
eclipse.DateLong = (function(){
		function DateLong(options){
			this._init(options);
		};
		DateLong.prototype = {
			_init: function(options){
				options.style = "display: none";
				this.contentText = new dijit.form.TextBox(options);
				this.contentText.set('ecliplseCustomValue',true);
				this.dateP = dojo.create("p", {innerHTML: "&nbsp;", className: "userprofile"});
				dojo.connect(this.contentText, "onChange", dojo.hitch(this, function(myDijit,p){
						if(myDijit.get('value')!=""){
							var value = parseInt(myDijit.get('value'));
							p.innerHTML = dojo.date.locale.format(new Date(value), {formatLength: "short"});
						}
						if(p.innerHTML=="")
							p.innerHTML="&nbsp";
					}, this.contentText, this.dateP));
				this.get = dojo.hitch(this.contentText,this.contentText.get);
				this.set = dojo.hitch(this.contentText,this.contentText.set);
			},
			placeAt: function(node){
				this.contentText.placeAt(node);
				dojo.place(this.dateP, node);
			}
		};
		return DateLong;
}());


eclipse.Profile = (function() {

	function Profile(options) {
		this._init(options);
	}

	Profile.prototype = {
		_init : function(options) {

			this.registry = options.registry;
			this.pluginRegistry = options.pluginRegistry;
			this.profilePlaceholder = options.profilePlaceholder;
			this.commandService = options.commandService;
			
			var userProfile = this;
			
			

			if(this.pluginRegistry.getPlugin("/profile/userservicePlugin.html")===null){
				this.pluginRegistry.installPlugin("/profile/userservicePlugin.html");
			}
			
			this.usersService = this.registry.getService("IUsersService");
			
			if(this.usersService!==null){
				this.usersService.then(function(service) {
					service.addEventListener("requiredPluginsChanged", function(pluginsList){
						dojo.hitch(userProfile, userProfile.drawPlugins(pluginsList.plugins));
					});
					service.addEventListener("userInfoChanged", function(jsonData){
						dojo.hitch(userProfile,	userProfile.populateData(jsonData));
					});
					service.addEventListener("userDeleted", function(jsonData){
						window.location.replace("/");
					});
				});

			}
			
			
			this.registry.getService("IInputProvider").then(function(input) {
				input.addEventListener("inputChanged", function(uri) {
					dojo.hitch(userProfile, userProfile.setUserToDisplay(uri));
				});
				input.getInput(function(uri) {
					if(uri && uri!=null && uri!="")
						dojo.hitch(userProfile, userProfile.setUserToDisplay(uri));
					else{
						
						// TODO if no hash provided current user profile should be loaded - need a better way to find logged user URI
						
						dojo.xhrPost({
							url : "/login",
							headers : {
								"Orion-Version" : "1"
							},
							handleAs : "json",
							timeout : 15000,
							load : function(jsonData, ioArgs) {
								input.setInput("/users/"+jsonData.login);
								return jsonData;
							},
							error : function(response, ioArgs) {
								handleGetAuthenticationError(this, ioArgs);
							}
						});
					}
				});
			});
			
		},
		drawPlugins : function(pluginsList){
			
			var userProfile = this;
			
			if(this.profileForm){
				while(this.profileForm.get("domNode").lastChild){
					dojo.destroy(this.profileForm.get("domNode").lastChild);
				}
				
				this.profileForm.destroy();
			}
			
			this.profileForm = new dijit.form.Form({id: "profileForm"});
			this.profilePlaceholder.innerHTML = "";
			this.profileForm.placeAt(this.profilePlaceholder);
			
			var userPluginDiv = dojo.create("div", null, userProfile.profileForm.get("domNode"));
			
			this.usersService.then(function(service) {
				service.getDivContent().then(function(content) {
					dojo.hitch(userProfile, userProfile.draw(content, userPluginDiv));
				});
			});
			
			
			for(var i=0; i<pluginsList.length; i++){
				var pluginDiv = dojo.create("div", {style: "clear: both", innerHTML: "Loading " + pluginsList[i].Url + "..."}, userProfile.profileForm.get("domNode"));
				var pluginReference= this.pluginRegistry.getPlugin(pluginsList[i].Url);
				if(pluginReference===null){
					var registry = this.registry;
					dojo.hitch(this, function(div){this.pluginRegistry.installPlugin(pluginsList[i].Url).then(
							function(ref){
								var plugin = registry.getService(ref.getServiceReferences()[0]);
								plugin.then(function(pluginService){
									pluginService.getDivContent().then(function(content) {
										dojo.hitch(userProfile, userProfile.draw(content, div));
									});
								});
							});
					})(pluginDiv);
					continue;
				}
				var plugin = this.registry.getService(pluginReference.getServiceReferences()[0]);
				
				if(plugin===null){
					console.error("Could not deploy plugin " + pluginsList[i].Url);
					continue;
				}
				dojo.hitch(this, function(div){plugin.then(function(pluginService){
						pluginService.getDivContent().then(function(content) {
							dojo.hitch(userProfile, userProfile.draw(content, div));
						});
					});
				})(pluginDiv);
			}
			

		},
		setUserToDisplay : function(userURI) {
			this.currentUserURI = userURI;
			var profile = this;
			this.usersService.then(
					function(service) {
						service.initProfile(userURI, "requiredPluginsChanged", "userInfoChanged");
					});
		},
		redisplayLastUser : function(){
			var profile = this;
			this.usersService.then(
					function(service) {
						service.getUserInfo(profile.currentUserURI);
					});
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
			}else{
				throw new Error("User is not defined");
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
				  
				  if(formElem.get('readOnly')===true && !formElem.get('ecliplseCustomValue')){
					  formElem.set('style', 'display: none');
					  var p = dojo.create("p", {id: formElem.get('id')+"_p", className: "userprofile", innerHTML: formElem.get('value')?formElem.get('value'):"&nbsp;"}, node, "last");
					  dojo.connect(formElem, "onChange", dojo.hitch(this, function(myDijit,p){p.innerHTML = myDijit.get('value'); if(p.innerHTML=="") p.innerHTML="&nbsp";}, formElem, p));
				  }
				  
				  return formElem;
			  }else{
				  return new Error("Type not found " + json.type);
			  }
			  
			},
		
		draw: function(content, placeholder){
			var profile = this;
			placeholder.innerHTML = "";
			if(content.sections)
			for(var i=0; i<content.sections.length; i++){
				
				if(dijit.byId(content.sections[i].id))
					dijit.byId(content.sections[i].id).destroy();
				
				var sectionPane = new dijit.layout.ContentPane({id: content.sections[i].id,
						"class": "userprofileSection",
			    		dojoType: "dijit.layout.ContentPane",
			    		region: "top",
			    		style: "height: 20px;",
			    		content: "<span style='vertical-align: middle'>"+content.sections[i].name+"</span>",
			    		style: "clear: both"
				});
				sectionPane.placeAt(placeholder);
				
				
				
				var sectionContents = dojo.create("div", null, placeholder);
				
				for(var j=0; j<content.sections[i].data.length; j++){
					var data = content.sections[i].data[j];
					var dataDiv = dojo.create("div", null, sectionContents);
					dojo.create("label", {className: "userprofile", innerHTML: data.label, "for": data.id}, dataDiv);
									
						var input = this.createFormElem(data, dataDiv);
						dojo.connect(input, "onKeyPress", dojo.hitch(profile, function(event){ if (event.keyCode === 13) { this.fire(); } else {return true;}}));
						if(this.lastJSON && data.props && this.lastJSON[data.props.name]){
							input.set('value', this.lastJSON[data.props.name]);
						}
				}
			}
			if(content.actions && content.actions.length>0){
				
				var bannerPane = dojo.create("div", null, placeholder, "first");

				dojo.create("h2", {id:"profileBanner", style: "margin-top: 10px;", innerHTML: profile.lastJSON ? "Profile Information for <b style='color: #000'>" + profile.lastJSON.login + "</b>" : ""}, bannerPane);

				var dataDiv = dojo.create("div", {id: "profile.actions"}, bannerPane);
				this.commandService.addCommandGroup("eclipse.profileActionsGroup", 100, null, null, "profile.actions");
				for(var i=0; i<content.actions.length; i++){
					var info = content.actions[i];
					var commandOptions = {
							name: info.name,
							image: info.image,
							id: info.id,
							tooltip: info.tooltip,
							callback: dojo.hitch(profile, function(action){this.fire(action);}, info.action)
					};
					var command = new eclipse.Command(commandOptions);
					this.commandService.addCommand(command, "dom");					
					this.commandService.registerCommandContribution(info.id, i, "profile.actions", "eclipse.profileActionsGroup");
				}
				this.commandService.renderCommands(dataDiv, "dom", {}, {}, "image");
				
			}
			
		},
		fire: function(action){
			var data = dijit.byId('profileForm').get('value');
			var url = this.currentUserURI;
			this.usersService.then(function(service) {
						service.fire(action, url, data);
					});
		}
	};
	return Profile;
}());
dojo.addOnUnload(function() {
	if(registry)
		registry.stop();
});
