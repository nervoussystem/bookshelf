
var div;
var colors;
var action;

var materialName;
var materialId;

function init(colorDiv,colorArray) {
	div = document.getElementById(colorDiv);
	colors = colorArray;
	
	
	for(i=0;i<colors.length;i++)    {
		var swatch = document.createElement('div');
		div.appendChild(swatch);
		swatch.id = colors[i].name;
		swatch.className = 'colorBox';
		swatch.addEventListener("click", function(){setColor(this.id);}, false);
		swatch.style.backgroundColor = "rgb(" + colors[i].r + "," + colors[i].g + "," + colors[i].b + ")";
		if(colors[i].name == "white") swatch.style.border = "2px solid #ccc";
		else swatch.style.border = "2px solid rgb(" + colors[i].r + "," + colors[i].g + "," + colors[i].b + ")";
		/*if(colors[i]=="ffffff") {littleBoxes += ";border: 1px solid #ccc;";}
		else if(colors[i]==materialColor) {littleBoxes += ";border: 2px solid #000;";}
		else littleBoxes += ";border: 2px solid #"+ colors[i] + ";";*/
		
	}
	
	materialId = 1;
	materialName = colors[materialId].name;
	
	setColor(materialName);
	
}

function setColor(colorName){
	var colorId;
	//get new id
	for(i = 0;i<colors.length;i++) {
		if(colors[i].name == colorName) colorId = i;
	}
	
	//deselect previous color
	var lastColor = document.getElementById(materialName);
	if(materialName=="white") lastColor.style.border = "2px solid #ccc";
	else lastColor.style.border = "2px solid rgb(" + colors[materialId].r + "," + colors[materialId].g + "," + colors[materialId].b + ")";
	
	//select chosen color
	var myColor = document.getElementById(colorName);
	myColor.style.border = "2px solid #000";
	materialName = colorName;
	materialId = colorId;
	
	action(colors[colorId]);	
}

function setCallback(func) {
	action =func;
}
	
exports.setCallback = setCallback;
exports.init = init;