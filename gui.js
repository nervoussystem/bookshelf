var bookshelf = require('./bookshelf.js');
var voronoi = require('./voronoi.js');
var TWEEN = require('tween.js');

/*
initializes the GUI and its listeners

called by main's init()
*/
function init() {
	console.log("starting up");
  var widthSlider = document.getElementById("widthSlider");
  var heightSlider = document.getElementById("heightSlider");
  var depthSlider = document.getElementById("depthSlider");
  var widthOut = document.getElementById("widthOut");
  var heightOut = document.getElementById("heightOut");
  var depthOut = document.getElementById("depthOut");
  
  widthSlider.addEventListener("input", function() {bookshelf.setWidth(parseFloat(this.value));setBookshelfWidthUI();}, false);
  heightSlider.addEventListener("input", function() {bookshelf.setHeight(parseFloat(this.value));setBookshelfHeightUI();}, false);
  depthSlider.addEventListener("input", function() {bookshelf.setDepth(parseFloat(this.value));setBookshelfDepthUI();}, false);
  
  //person enters text in width input box
  widthOut.addEventListener("change", function() {
	var val = parseFloat(this.value)*25.4;
	var tweenWidth = new TWEEN.Tween( {x:bookshelf.width} )
		.to( {x:val},2000 )
		.easing( TWEEN.Easing.Cubic.InOut  )
		.onUpdate( function() {
			bookshelf.setWidth(this.x);
		})
		.start();
	//widthSlider.value = val;
	//bookshelf.setWidth(widthSlider.value);
	//setBookshelfWidthUI();
	}, false);

  heightOut.addEventListener("change", function() {
	var val = parseFloat(this.value)*25.4;
	heightSlider.value = val;
	bookshelf.setHeight(heightSlider.value); //using slider to limit range
	setBookshelfHeightUI();}, false);
	
 depthOut.addEventListener("change", function() {
	var val = parseFloat(this.value)*25.4;
	depthSlider.value = val;
	bookshelf.setDepth(depthSlider.value);
	setBookshelfDepthUI();}, false);
  
  setBookshelfWidthUI();
  setBookshelfHeightUI();
  setBookshelfDepthUI();
  
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
function setBookshelfWidthUI() {
	var wDiv = document.getElementById("widthOut");
	var inches = bookshelf.width/25.4;
	wDiv.value = parseFloat(inches).toFixed(1);	
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

//FUNCTIONS INCLUDED IN EXPORTED MODULE
exports.init = init;
exports.setNumCellsUI = setNumCellsUI;
