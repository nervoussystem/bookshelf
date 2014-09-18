//import modules
var voronoi = require('./voronoi.js');

var bookshelf = exports;

bookshelf.width = 4*12*25.4; //bookshelf width in mm
bookshelf.height = 3*12*25.4; //bookshelf height in mm
bookshelf.depth = 254; //bookshelf depth in mm

bookshelf.woodWidth = 12.2; //thickness of the wood sheets in mm



/*
sets the bookshelf width

callback for width slider

@param float val
	the width of the bookshelf in mm
*/
function setWidth(val) {
	bookshelf.width = val;
	voronoi.setDimensions(bookshelf.width,bookshelf.height);

 
}
/*
sets the bookshelf height

callback for height slider

@param float val
	the height of the bookshelf in mm
*/
function setHeight(val) {
  bookshelf.height = val;
  voronoi.setDimensions(bookshelf.width,bookshelf.height);

}
/*
sets the bookshelf depth

callback for depth slider

@param float val
	the depth of the bookshelf in mm
*/
function setDepth(val) {
  bookshelf.depth = val;
}


//FUNCTIONS INCLUDED IN EXPORTED MODULE
exports.setWidth = setWidth;
exports.setHeight = setHeight;
exports.setDepth = setDepth;
