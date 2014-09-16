var bookshelf = require('./bookshelf.js');

/*
initializes the GUI and its listeners

called by main's init()
*/
function init() {
  var widthSlider = document.getElementById("widthSlider");
  var heightSlider = document.getElementById("heightSlider");
  
  widthSlider.addEventListener("input", function() {bookshelf.setWidth(parseFloat(this.value));setBookshelfWidthUI();}, false);
  heightSlider.addEventListener("input", function() {bookshelf.setHeight(parseFloat(this.value));setBookshelfHeightUI();}, false);
}

/*
sets UI elements related to the bookshelf's width

callback for width slider
*/
function setBookshelfWidthUI() {
	var wDiv = document.getElementById("widthOut");
	wDiv.innerHTML = bookshelf.width/25.4 + " in";
	
}
/*
sets UI elements related to the bookshelf's height

callback for height slider
*/
function setBookshelfHeightUI(){
	var hDiv = document.getElementById("heightOut");
	hDiv.innerHTML = bookshelf.height/25.4 + " in";
};

//FUNCTIONS INCLUDED IN EXPORTED MODULE
exports.init = init;
