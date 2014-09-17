
var div;
var colors;
var action;

var materialName;

function init(colorDiv,colorArray) {
	div = document.getElementById(colorDiv);
	colors = colorArray;
	
	var littleBoxes="";
	for(i=0;i<colors.length;i++)    {
		littleBoxes += "<div onclick=setColor('" + colors[i].name + "') ";
		littleBoxes += "id='"+ colors[i].name+"'";
		littleBoxes += "class='colorBox' style='background-color:rgb(";
		littleBoxes += colors[i].r + "," + colors[i].g + "," + colors[i].b +");";
		/*if(colors[i]=="ffffff") {littleBoxes += ";border: 1px solid #ccc;";}
		else if(colors[i]==materialColor) {littleBoxes += ";border: 2px solid #000;";}
		else littleBoxes += ";border: 2px solid #"+ colors[i] + ";";*/
		littleBoxes +="'></div>";
	}
	div.innerHTML = littleBoxes;

	materialName = colors[0].name;
	setColor(materialName);
	
}

function setColor(colorName){
	//deselect previous color
	var lastColor = document.getElementById(materialName);
	//lastColor.style.border = "2px solid #"+ materialColor;
	
	//select chosen color
	var myColor = document.getElementById(colorName);
	myColor.style.border = "2px solid #000";
	materialName = colorName;
	
	
	var colorId;
	//get id
	for(i = 0;i<colors.length;i++) {
		if(colors[i].name == colorName) colorId = i;
	}
	
	action(colors[colorId]);
	//materialColor = colors[colorId];
	//materialColorRGB= hexToRgb(materialColor);
	
	//var colorNameBox = document.getElementById("colorName");
	//colorNameBox.innerHTML = materialName;
	
}

function setCallback(func) {
	action =func;
}
/*
var colorSet = require("colorSet.js");
colorSet.setDiv("colorDiv")
	.setColors(colorList)
	.setCallback(colorfunction)
	.init();*/
	
exports.setCallback = setCallback;
exports.init = init;