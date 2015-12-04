var bookshelf = require('./bookshelf.js');
var voronoi = require('./voronoi.js');
var TWEEN = require('tween.js');
var colorSet = require("./colorSet.js");

var saveFunction;

var connectorColors = [
{"name": "white", "r":255, "g":255, "b":255},
{"name": "black", "r":0, "g":0, "b":0},
{"name": "ultramarine blue", "r": 6, "g": 33, "b": 186},
{"name": "leaf green", "r": 77, "g": 182, "b": 89},
{"name": "signal yellow", "r": 255, "g": 238, "b": 57},
{"name": "traffic red", "r":255, "g":71, "b":40}
];
/*
initializes the GUI and its listeners

called by main's init()
*/
function init() {
	console.log("starting up");
  var widthSlider = document.getElementById("widthSlider");
  var heightSlider = document.getElementById("heightSlider");
  var depthSlider = document.getElementById("depthSlider");
  var angleSlider = document.getElementById("angleSlider");
  var widthOut = document.getElementById("widthOut");
  var heightOut = document.getElementById("heightOut");
  var depthOut = document.getElementById("depthOut");
  
  widthSlider.min = 375;
  widthSlider.max = 3750;
  widthSlider.value = bookshelf.width;
  
  heightSlider.min = 375;
  heightSlider.max = 3750;
  heightSlider.value = bookshelf.height;

  depthSlider.min = 70;
  depthSlider.max = 600;
  depthSlider.value = bookshelf.depth;

  angleSlider.min = 0;
  angleSlider.max = 30;
  angleSlider.value = bookshelf.flattenAngle*180/Math.PI;
  
  widthSlider.addEventListener("input", function() {bookshelf.setWidth(parseFloat(this.value));setBookshelfWidthUI();}, false);
  heightSlider.addEventListener("input", function() {bookshelf.setHeight(parseFloat(this.value));setBookshelfHeightUI();}, false);
  depthSlider.addEventListener("input", function() {bookshelf.setDepth(parseFloat(this.value));setBookshelfDepthUI();}, false);

  angleSlider.addEventListener("input", function() {bookshelf.flattenAngle = parseFloat(this.value)*Math.PI/180.0;}, false);
  
  document.getElementById("saveButton").addEventListener("click", function() {saveFunction();}, false);
  
  //person enters text in width input box
  widthOut.addEventListener("change", function() {
	var val = parseFloat(this.value)*25.4;
	val = Math.min(val,widthSlider.max);
	val = Math.max(val,widthSlider.min);
	setBookshelfWidthUI(val);
	var tween = new TWEEN.Tween( {x:bookshelf.width} )
		.to( {x:val},2000 )
		.easing( TWEEN.Easing.Cubic.InOut  )
		.onUpdate( function() {
			bookshelf.setWidth(this.x);
			widthSlider.value = this.x;
		})
		.start();
	}, false);

	  //person enters text in height input box
  heightOut.addEventListener("change", function() {
	var val = parseFloat(this.value)*25.4;
	val = Math.min(val,heightSlider.max);
	val = Math.max(val,heightSlider.min);
	setBookshelfHeightUI(val);
	var tween = new TWEEN.Tween( {x:bookshelf.height} )
		.to( {x:val},2000 )
		.easing( TWEEN.Easing.Cubic.InOut  )
		.onUpdate( function() {
			bookshelf.setHeight(parseFloat(this.x));
			heightSlider.value = this.x;
		})
		.start();
	}, false);

	
	  //person enters text in width input box
  depthOut.addEventListener("change", function() {
	var val = parseFloat(this.value)*25.4;
	val = Math.min(val,depthSlider.max);
	val = Math.max(val,depthSlider.min);
	setBookshelfDepthUI(val);
	var tween = new TWEEN.Tween( {x:bookshelf.depth} )
		.to( {x:val},2000 )
		.easing( TWEEN.Easing.Cubic.InOut  )
		.onUpdate( function() {
			bookshelf.setDepth(this.x);
			depthSlider.value = this.x;
		})
		.start();
	}, false);


	

  
  setBookshelfWidthUI();
  setBookshelfHeightUI();
  setBookshelfDepthUI();
  
  colorSet.init("colorSet",connectorColors);
  
  animate();
}

function animate(time) {
	requestAnimationFrame(animate);
	TWEEN.update(time);
}

	
/*
sets UI elements related to the bookshelf's width

callback for width slider
*/
function setBookshelfWidthUI(val) {
	var wDiv = document.getElementById("widthOut");
	
	if(val==undefined) val = bookshelf.width/25.4;
	else val = val/25.4;
	wDiv.value = parseFloat(val).toFixed(1);	
	
}
/*
sets UI elements related to the bookshelf's height

callback for height slider
*/
function setBookshelfHeightUI(){
	var hDiv = document.getElementById("heightOut");
	var inches = bookshelf.height/25.4;
	hDiv.value = parseFloat(inches).toFixed(1);
};
/*
sets UI elements related to the bookshelf's depth

callback for depth slider
*/
function setBookshelfDepthUI(){
	var hDiv = document.getElementById("depthOut");
	var inches = bookshelf.depth/25.4;
	hDiv.value = parseFloat(inches).toFixed(1);
};

function setNumCellsUI() {
	var cellsOut = document.getElementById("cellsOut");
	cellsOut.innerHTML = voronoi.mesh.faces.length;
}

function setColorCallback(func){
	colorSet.setCallback(func);
}
//FUNCTIONS INCLUDED IN EXPORTED MODULE
exports.init = init;
exports.setNumCellsUI = setNumCellsUI;
exports.setColorCallback = setColorCallback;
exports.setSaveFunction = function(saveFunc) {saveFunction = saveFunc;};
