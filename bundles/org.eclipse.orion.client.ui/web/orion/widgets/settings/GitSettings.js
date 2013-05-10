/*******************************************************************************
 * @license
 * Copyright (c) 2012 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: Anton McConville - IBM Corporation - initial API and implementation
 ******************************************************************************/
/*global window console define */
/*jslint browser:true sub:true*/

define(['i18n!orion/settings/nls/messages', 'require', 'orion/commands', 'orion/section', 'orion/git/gitPreferenceStorage', 'orion/webui/littlelib', 'orion/objects', 'orion/i18nUtil',
		'orion/widgets/settings/Subsection', 'profile/UsersService', 'orion/widgets/input/LabeledTextfield', 'orion/widgets/input/LabeledCheckbox', 'orion/widgets/input/LabeledCommand'
		], function(messages, require, mCommands, mSection, GitPreferenceStorage, lib, objects, i18nUtil, Subsection, UsersService, LabeledTextfield, LabeledCheckbox, LabeledCommand) {

	function GitSettings(options, node) {
		objects.mixin(this, options);
		this.node = node;
	}
	objects.mixin(GitSettings.prototype, {
		dispatch: true,

		// TODO these should be real Orion sections, not fake DIVs
		templateString: '' +  //$NON-NLS-0$
				'<div>' +  //$NON-NLS-0$
					'<div class="sectionWrapper toolComposite">' +
						'<div class="sectionAnchor sectionTitle layoutLeft">${Git Settings}</div>' + 
						'<div id="userCommands" class="layoutRight sectionActions"></div>' +
					'</div>' + //$NON-NLS-2$ //$NON-NLS-0$
					'<div class="sections">' + //$NON-NLS-0$
					
					'</div>' + //$NON-NLS-0$
					'<div></div>' +
					
				'</div>' + //$NON-NLS-0$
				
				'<div>' +  //$NON-NLS-0$
					'<div class="sectionWrapper toolComposite">' +
						'<div class="sectionAnchor sectionTitle layoutLeft">${Git Credentials Storage}</div>' + 
						'<div id="gitCommands" class="layoutRight sectionActions"></div>' +
					'</div>' + //$NON-NLS-2$ //$NON-NLS-0$
					'<div class="gitSections">' + //$NON-NLS-0$
					
					'</div>' + //$NON-NLS-0$
					'<div></div>' +
					
				'</div>', //$NON-NLS-0$

		createElements: function() {
			this.node.innerHTML = this.templateString;
			lib.processTextNodes(this.node, messages);
			
			this.sections = lib.$('.sections', this.node);
			this.gitSections = lib.$('.gitSections', this.node);
			
			this.createSections();
		},

		setHash: function(iframe, hash){
			if(iframe.src.indexOf("#")>0){ //$NON-NLS-0$
				iframe.src = iframe.src.substr(0, iframe.src.indexOf("#")) + "#" + hash; //$NON-NLS-1$ //$NON-NLS-0$
			}else{
				iframe.src = iframe.src + "#" + hash; //$NON-NLS-0$
			}
		},
		
		refreshGitCredentials : function(){
			var that = this;
			var gitPreferenceStorage = new GitPreferenceStorage(this.registry);
			gitPreferenceStorage.isEnabled().then(
				function(isEnabled){
					that.gitCredentialsFields[0].setChecked(isEnabled);
				}
			);
		},
		
		createSections: function(){
			
			/* - git --------------------------------------------------------- */
			this.gitFields = [
				new LabeledTextfield( {fieldlabel:messages['Git Email Address']} ),
				new LabeledTextfield( {fieldlabel:messages['Git Username']} )
			];
			var gitSection = new Subsection( {sectionName:messages["Git Config"], parentNode: this.sections, children: this.gitFields } );
			gitSection.show();
			
			var updateCommand = new mCommands.Command({
				name: messages["Update"],
				tooltip: messages["Update Profile Settings"],
				id: "orion.updateprofile", //$NON-NLS-0$
				callback: function(data){
					this.update(data.items);
				}.bind(this)
			});
			
			this.commandService.addCommand(updateCommand);
			this.commandService.registerCommandContribution('profileCommands', "orion.updateprofile", 3); //$NON-NLS-1$ //$NON-NLS-0$
			this.commandService.renderCommands('profileCommands', lib.node( 'userCommands' ), this, this, "button"); //$NON-NLS-1$ //$NON-NLS-0$		
			
			//--------- git credentials -------------------------------
			this.gitCredentialsFields = [ new LabeledCheckbox( {fieldlabel:messages["Enable Storage"]} ) ];
			var gitCredentialsSection;
			var that = this;
			
			// erase credentials command
			var erasePrivateKeyCommand = new mCommands.Command({
				name: messages["Delete"],
				id: "eclipse.orion.git.eraseGitCredentials",
				callback : function(data){
					var repository = data.items.gitUrl;
					var keyIndex = data.items.keyIndex;
					
					var messageService = that.registry.getService("orion.page.message");
					
					var gitPreferenceStorage = new GitPreferenceStorage(that.registry);
					gitPreferenceStorage.remove(repository).then(
						function(){
							messageService.setProgressResult(i18nUtil.formatMessage(messages["Deleted git credentials for ${0}"], [repository]));
							that.gitCredentialsFields[keyIndex+1].destroy();
						}
					);
				},
				visibleWhen : function(item){
					return true;
				}
			});
			this.commandService.addCommand(erasePrivateKeyCommand);
			this.commandService.registerCommandContribution("repositoryItemCommands", "eclipse.orion.git.eraseGitCredentials", 1);
			
			var that = this;
			var gitPreferenceStorage = new GitPreferenceStorage(this.registry);
			gitPreferenceStorage.getRepositories().then(
				function(repositories){
					for(var i=0; i<repositories.length; ++i){
						var labeledCommand = new LabeledCommand( {keyIndex: i, fieldlabel: repositories[i], commandService: that.commandService, scopeId: "repositoryItemCommands"} );
						that.gitCredentialsFields.push(labeledCommand);
					}
					
					gitCredentialsSection = new Subsection( {sectionName:"", parentNode: that.gitSections, children: that.gitCredentialsFields} );
					gitCredentialsSection.show();
			
					var updateGitCredentialsCommand = new mCommands.Command({
						name: messages["Update"],
						tooltip: messages["Update Git Credentials"],
						id: "orion.updateGitCredentials", //$NON-NLS-0$
						callback: function(data){
							that.updateGitCredentials(data.items);
						}.bind(that)
					
					});
					
					that.commandService.addCommand(updateGitCredentialsCommand);
					that.commandService.registerCommandContribution('gitProfileCommands', "orion.updateGitCredentials", 2); //$NON-NLS-1$ //$NON-NLS-0$
					
					that.commandService.renderCommands('gitProfileCommands', lib.node( 'gitCommands' ), that, that, "button"); //$NON-NLS-1$ //$NON-NLS-0$		
					
				}
			);
			
		},
		
		update: function(data){
			
			var authenticationIds = [];
			
			var authServices = this.registry.getServiceReferences("orion.core.auth"); //$NON-NLS-0$
			
			var messageService = this.registry.getService("orion.page.message"); //$NON-NLS-0$
			
			var userService = this.userService;
			
			var settingsWidget = this;
			
			var userdata = {};
			
			userdata.GitMail = settingsWidget.gitFields[0].getValue();
			userdata.GitName = settingsWidget.gitFields[1].getValue();
			
			if( this.dispatch === true ){
			
				for(var i=0; i<authServices.length; i++){
					var servicePtr = authServices[i];
					var authService = this.registry.getService(servicePtr);		
	
					authService.getKey().then(function(key){
						authenticationIds.push(key);
						authService.getUser().then(function(jsonData){
						
							var data = jsonData;
							
							var b = userService.updateUserInfo(jsonData.Location, userdata).then( function(args){
								if(args){
									messageService.setProgressResult(args);
								}else{
									messageService.setProgressResult( messages['User profile data successfully updated.'] );
								}

								// TODO: don't reach into User Menu internals for this. Should dispatch a service event instead, etc.
//								if( userdata.Name ){
//									var userMenu = lib.node( 'userTrigger' ); //$NON-NLS-0$
//									if (userMenu) {
//										userMenu.replaceChild(document.createTextNode(userdata.Name), userMenu.firstChild);
//									}
//								}
							}, function(error){
								messageService.setProgressResult(error);
							});
						});
					});
				}	
			}
		},
		
		updateGitCredentials : function(data){
			var messageService = this.registry.getService("orion.page.message"); //$NON-NLS-0$
			
			// git authentication update
			var gitPreferenceStorage = new GitPreferenceStorage(this.registry);
			if( this.gitCredentialsFields[0].isChecked() ){
				if(window.confirm(messages["Please be aware that your credentials will be stored persistently in the browser."] + '\n' + messages["Do you wish to enable the Key Storage?"])){
					gitPreferenceStorage.enable().then(
						function(){
							messageService.setProgressResult( messages['Git Credentials successfully updated.'] );
						}
					);
				} else { return; }
			} else {
				gitPreferenceStorage.disable().then(
					function(){
						messageService.setProgressResult( messages['Git Credentials successfully updated.'] );
					}
				);
			}
		},
		
		show:function(){
			this.createElements();
			
			this.userService = this.registry.getService("orion.core.user"); //$NON-NLS-0$
			
			var authenticationIds = [];
			
			var authServices = this.registry.getServiceReferences("orion.core.auth"); //$NON-NLS-0$
			
			var userService = this.userService;
			
			var settingsWidget = this;
			
			for(var i=0; i<authServices.length; i++){
				var servicePtr = authServices[i];
				var authService = this.registry.getService(servicePtr);		

				authService.getKey().then(function(key){
					authenticationIds.push(key);
					authService.getUser().then(function(jsonData){
					
						var data = jsonData;
						
						var b = userService.getUserInfo(jsonData.Location).then( function( accountData ){
							
							if( accountData.GitMail ){
								settingsWidget.gitFields[0].setValue( accountData.GitMail );
							}
							
							if( accountData.GitName ){
								settingsWidget.gitFields[1].setValue( accountData.GitName );	
							}
						});
						
						settingsWidget.setHash( settingsWidget.iframe, jsonData.Location );	
					});
				});
			}
			
			// git authentication startup
			this.refreshGitCredentials();
		},

		destroy: function() {
			if (this.node) {
				lib.empty(this.node);
				this.node = this.sections = this.gitSections = null;
			}
		}
	});
	return GitSettings;
});