/*******************************************************************************
 * @license
 * Copyright (c) 2011, 2012 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/
/*global window document define login logout localStorage orion */
/*browser:true*/

define(['require'], 
        function(require){
	
	/**
	 * This class contains static utility methods. It is not intended to be instantiated.
	 * @class This class contains HTML fragments for the common banner, footer, toolbars
	 * @name orion.commonHTMLFragments
	 */

	// BEGIN TOP BANNER FRAGMENT
	var topHTMLFragment =
	
	'<header role="banner">' +
		//Top row:  Logo + discovery links + user
		'<div id="staticBanner" class="layoutBlock topRowBanner">' +
			'<a id="home" class="layoutLeft logo" href="' + require.toUrl("navigate/table.html") + '" aria-label="Orion Home"><img src="' + require.toUrl("images/orion-transparent.png") + '" alt="Orion Logo"/></a>' +
			'<nav id="primaryNav" class="layoutLeft primaryNav" role="navigation"></nav>' +
			'<div class="layoutRight">' +
				'<div id="globalActions" class="spacingLeft layoutLeft"></div>' +
				'<div id="relatedLinks" class="spacingLeft layoutLeft"></div>' +
				'<input type="text" id="search" placeholder="Search" title="Type a keyword or wild card to search in root" class="layoutLeft spacingLeft searchbox" role="search">' +
				'<div id="userInfo" style= "display:none;" class="layoutLeft primaryNav"></div>' +
				'<div id="userMenu" class="spacingLeft layoutLeft"></div>' +
			'</div>' +
		'</div>' +
		//Title area
		'<div id="titleArea" class="layoutBlock titleArea">' +
			'<div class="layoutLeft pageTitle"></div>' +
			
			'<div id="location" style="padding-bottom:5px;display:inline;" class="clear currentLocation"></div>' +
			'<div class="layoutRight pageNav">' +
				'<span id="pageFavorite" tabindex="0" role="button" aria-label="Add this page to the favorites list" class="spacingLeft layoutLeft imageSprite core-sprite-favorite_sml"></span>' +
			'</div>' +
		'</div>' +
	'</header>';
	// END TOP BANNER FRAGMENT
	
	// BEGIN BOTTOM BANNER FRAGMENT
	// styling of the surrounding div (text-align, etc) is in ide.css "footer"
	var bottomHTMLFragment = 
		'<footer class="layoutBlock" role="contentinfo">' +
			'<div class="footerBlock">' +
				'Orion is in Beta. Please try it out but BEWARE your data may be lost.' +
			'</div>' +
			'<div class="footerRightBlock">' +
				'<a href="http://wiki.eclipse.org/Orion/FAQ" target="_blank">FAQ</a> | ' + 
				'<a href="https://bugs.eclipse.org/bugs/enter_bug.cgi?product=Orion&version=0.4" target="_blank">Report a Bug</a> | ' +
				'<a href="http://www.eclipse.org/legal/privacy.php" target="_blank">Privacy Policy</a> | ' + 
				'<a href="http://www.eclipse.org/legal/termsofuse.php" target="_blank">Terms of Use</a> | '+ 
				'<a href="http://www.eclipse.org/legal/copyright.php" target="_blank">Copyright Agent</a>'+
			'</div>' +
		'</footer>';
	// END BOTTOM BANNER FRAGMENT

	function slideoutHTMLFragment(id) { 
		return '<div id="'+id+'slideContainer" class="layoutBlock slideParameters slideContainer">' +
			'<span id="'+id+'pageParameterArea" class="slide">' +
				'<span id="'+id+'pageCommandParameters" class="layoutLeft parameters"></span>' +
				'<span id="'+id+'pageCommandDismiss" class="layoutRight parametersDismiss"></span>' +
			'</span>' +
		'</div>';
	}
	
	var toolbarHTMLFragment = 
		'<ul class="layoutLeft commandList pageActions" id="pageActions"></ul>' +
		'<ul class="layoutLeft commandList pageActions" id="selectionTools"></ul>' +
		'<img class="layoutRight progressPane" src="'+ require.toUrl("images/none.png") +'" id="progressPane" tabindex="0" role="progressbar" aria-label="Operations - Press spacebar to show current operations"></img>' +
		'<div class="layoutRight status" id="statusPane" role="status" aria-live="off"></div>' +
		'<ul class="layoutRight commandList pageActions" id="pageNavigationActions"></ul>' +
		'<div id="notificationArea" class="layoutLeft layoutBlock slideContainer">' +
				'<div class="layoutLeft" id="notifications" aria-live="assertive" aria-atomic="true"></div>' +
				'<div class="layoutRight"><span tabindex="0" role="button" aria-label="Close notification" class="layoutRight core-sprite-close imageSprite" id="closeNotifications"></span></div>' +
		'</div>' + slideoutHTMLFragment("mainToolbar");
		
	
	//return the module exports
	return {
		topHTMLFragment: topHTMLFragment,
		bottomHTMLFragment: bottomHTMLFragment,
		toolbarHTMLFragment: toolbarHTMLFragment,
		slideoutHTMLFragment: slideoutHTMLFragment
	};
});
