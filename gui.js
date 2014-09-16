var bookshelf = require('./bookshelf.js');
var voronoi = require('./voronoi.js');

/*
initializes the GUI and its listeners

called by main's init()
*/
function init() {
  var widthSlider = document.getElementById("widthSlider");
  var heightSlider = document.getElementById("heightSlider");
  var depthSlider = document.getElementById("depthSlider");
  
  widthSlider.addEventListener("input", function() {bookshelf.setWidth(parseFloat(this.value));setBookshelfWidthUI();}, false);
  heightSlider.addEventListener("input", function() {bookshelf.setHeight(parseFloat(this.value));setBookshelfHeightUI();}, false);
  depthSlider.addEventListener("input", function() {bookshelf.setDepth(parseFloat(this.value));setBookshelfDepthUI();}, false);
  
  setBookshelfWidthUI();
  setBookshelfHeightUI();
  setBookshelfDepthUI();
}

/*
sets UI elements related to the bookshelf's width

callback for width slider
*/
function setBookshelfWidthUI() {
	var wDiv = document.getElementById("widthOut");
	var inches = bookshelf.width/25.4;
	wDiv.innerHTML = parseFloat(inches).toFixed(1) + " in";
	
}
/*
sets UI elements related to the bookshelf's height

callback for height slider
*/
function setBookshelfHeightUI(){
	var hDiv = document.getElementById("heightOut");
	var inches = bookshelf.height/25.4;
	hDiv.innerHTML = parseFloat(inches).toFixed(1) + " in";
};
/*
sets UI elements related to the bookshelf's depth

callback for depth slider
*/
function setBookshelfDepthUI(){
	var hDiv = document.getElementById("depthOut");
	var inches = bookshelf.depth/25.4;
	hDiv.innerHTML = parseFloat(inches).toFixed(1) + " in";
};

function setNumCellsUI() {
	var cellsOut = document.getElementById("cellsOut");
	cellsOut.innerHTML = voronoi.mesh.faces.length;
}

//FUNCTIONS INCLUDED IN EXPORTED MODULE
exports.init = init;
exports.setNumCellsUI = setNumCellsUI;
