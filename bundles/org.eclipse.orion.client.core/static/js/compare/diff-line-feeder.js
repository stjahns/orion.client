/*******************************************************************************
 * Copyright (c) 2011 IBM Corporation and others. All rights reserved. This
 * program and the accompanying materials are made available under the terms of
 * the Eclipse Public License v1.0 which accompanies this distribution, and is
 * available at http://www.eclipse.org/legal/epl-v10.html
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/
var eclipse = eclipse || {};

eclipse.DiffLineFeeder = (function() {
	var isWindows = navigator.platform.indexOf("Win") !== -1;

	function DiffLineFeeder(mapper, diffLinesArray , lineDelimeter) {
		this._mapper = mapper;
		this._diffLinesArray = diffLinesArray;
		this._lineDelimeter = lineDelimeter;
	}

	DiffLineFeeder.prototype = /** @lends eclipse.TextModel.prototype */ {
	
		generateGapBlocks: function( mapperColumnIndex ){
		    var gapBlocks = [];//Each item represents the start lineIndex and the line number of a gap block , and the string index of the dummyLineArray
		    var gapNumber = 0;
			var curLineindex = 0;//zero based
			var mapperColumnIndexCompare = 1 - mapperColumnIndex;
			var delta = 0;
			for (var i = 0 ; i < this._mapper.length ; i++){
				if(this._mapper[i][2] === 0)
					delta = this._mapper[i][mapperColumnIndex];
				else
					delta = this._mapper[i][mapperColumnIndex] + this._mapper[i][mapperColumnIndexCompare];
				if(this._mapper[i][2] > 0){
					var gap =this._mapper[i][mapperColumnIndex];
					gapNumber +=gap;
					gapBlocks.push([curLineindex + this._mapper[i][mapperColumnIndexCompare] , gap , this._mapper[i][2]]);
				}
				curLineindex += delta;
			}
			return {gapBlocks:gapBlocks , gapNumber:gapNumber};
		},
		
		getLineAt: function(blocks , blockNumber , delta , includeDelimiter ){
			var lineText = this._diffLinesArray[blocks[blockNumber][2] + delta -1];
			lineText = lineText.substring(1);
			if (includeDelimiter) {
				return lineText + this._lineDelimeter;
			}
			return lineText;
		},
	
		//To get the line type from a zero based line index  
		getLineType: function(lineIndex , mapperColumnIndex){
			var curLineindex = 0;//zero based
			var mapperColumnIndexCompare = 1 - mapperColumnIndex;
			var delta = 0;
			
			for (var i = 0 ; i < this._mapper.length ; i++){
				if(this._mapper[i][2] === 0)
					delta = this._mapper[i][mapperColumnIndex];
				else
					delta = this._mapper[i][mapperColumnIndex] + this._mapper[i][mapperColumnIndexCompare];
				if(lineIndex >= curLineindex && lineIndex < (curLineindex +delta)){
					if(this._mapper[i][2] === 0){
						return "unchnaged";
					} else if(this._mapper[i][2] < 0){
						return "removed";
					} else if(this._mapper[i][1] === 0){
						return "added";
					} else if (lineIndex < this._mapper[i][mapperColumnIndexCompare] + curLineindex){
						return "removed";
					}	
					return "added";
				}
				curLineindex += delta;
			}
			return "unchnaged";
		},
		
		getLineNumber: function(lineIndex , mapperColumnIndex){
			if(this._mapper.length === 0)
				return lineIndex;
			var curLineindex = 0;//zero based
			var curMyLineindex = 0;//zero based
			var mapperColumnIndexCompare = 1 - mapperColumnIndex;
			var delta = 0;
			
			for (var i = 0 ; i < this._mapper.length ; i++){
				if(this._mapper[i][2] === 0)
					delta = this._mapper[i][mapperColumnIndex];
				else
					delta = this._mapper[i][mapperColumnIndex] + this._mapper[i][mapperColumnIndexCompare];
				
				if(lineIndex >= curLineindex && lineIndex < (curLineindex +delta)){
					var curDelta = lineIndex - curLineindex;
					if(this._mapper[i][2] === 0){
						return curMyLineindex + curDelta;
					} else if(this._mapper[i][2] < 0){
						return mapperColumnIndex === 0 ? -1 : (curMyLineindex + curDelta);
					} else if(this._mapper[i][1] === 0){
						return mapperColumnIndex === 0 ? (curMyLineindex + curDelta) : -1;
					} else if (lineIndex < this._mapper[i][1] + curLineindex){
						return mapperColumnIndex === 0 ? -1 : (curMyLineindex + curDelta);
					}	
					return mapperColumnIndex === 0 ? (curMyLineindex + curDelta - this._mapper[i][1]) : -1;
				}
				curLineindex += delta;
				curMyLineindex += this._mapper[i][mapperColumnIndex];
			}
			return lineIndex;
		}
		
	};
	
	return DiffLineFeeder;
}()); 
