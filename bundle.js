(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
//import modules
var voronoi = require('./voronoi.js');

var bookshelf = exports;

bookshelf.width = 2*12*25.4; //bookshelf width in mm
bookshelf.height = 2*12*25.4; //bookshelf height in mm
bookshelf.depth = 254; //bookshelf depth in mm

bookshelf.woodWidth = 5.95;//6.35;//12.2; //thickness of the wood sheets in mm
bookshelf.flattenAngle = Math.PI*0.1;

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

},{"./voronoi.js":13}],2:[function(require,module,exports){
/*
	Based on PeasyCam by Jonathan Feinberg
	which is distributed under the Apache Public License, version 2.0 http://www.apache.org/licenses/LICENSE-2.0.html
	which there is a good chance I am not following
	http://mrfeinberg.com/peasycam/
*/
"use strict"

var glMatrix = require("../js/gl-matrix-min.js");
var vec3 = glMatrix.vec3;
var mat4 = glMatrix.mat4;
var quat = glMatrix.quat;

var NScamera = {};
NScamera = exports;

NScamera.rot = quat.create();
NScamera.center = vec3.create();
NScamera.distance = 10;
NScamera.velocityX = 0;
NScamera.velocityY = 0;
NScamera.velocityZ = 0;
NScamera.dampening = 0.84;
NScamera.startDistance = 10;
NScamera.minDistance = 5;
NScamera.fixX = false;
NScamera.fixY = false;
NScamera.fixZ = false;
NScamera.screenCenter = [0,0];
vec3.angle = function(v1,v2) {
	return Math.acos(vec3.dot(v1,v2)/(vec3.length(v1)*vec3.length(v2)));
}

NScamera.lookAt = (function() {
  var dir = vec3.create();
  return function lookAt(pos,center,up) {
    vec3.sub(dir,center,pos);
    vec3.copy(this.center,center);
    var len = vec3.length(dir);
    this.distance = len;
  }
})();

NScamera.feed = (function() {
  var pos = vec3.create();
  var up = vec3.create();
  var lookat = mat4.create();
  return function(mat) {
	vec3.set(pos,0,0,1);
	vec3.set(up,0,1,0);
	  vec3.transformQuat(pos,pos,this.rot);
	  vec3.scale(pos,pos,this.distance);
	  vec3.add(pos,pos, this.center);
	  vec3.transformQuat(up,up,this.rot);
	 // mat4.lookAt(pos,this.center,up,mat);
	  mat4.multiply(mat, mat, mat4.lookAt(lookat,pos,this.center,up));
  };
  })();


NScamera.eyeDir = function(dir) {
	vec3.set(dir,0,0,1);
	vec3.transformQuat(dir,dir,this.rot);
	vec3.scale(dir, dir, -1);
}

NScamera.eyePos = function(pos) {
	vec3.set(pos,0,0,1);
	vec3.transformQuat(pos,pos,this.rot);
	vec3.scale(pos, pos, this.distance);
  vec3.add(pos,pos, this.center);
}

NScamera.mouseDragged = function(dx,dy,mx,my,button) {
   if(button == 1) {
     this.mouseRotate(dx,dy,mx,my);
   } else if(button == 2) {
	 this.mousePan(dx,dy);
   } else if(button == 3) {
     this.mouseZoom(dy);
   }
}

NScamera.mousePan = function(dx,dy) {
  var panScale = Math.sqrt(this.distance *0.0001);
  this.pan(-dx*panScale, -dy*panScale);
}

NScamera.pan = function(dx,dy) {
  var temp = [dx,dy,0];
  vec3.transformQuat(temp,temp,this.rot);
  vec3.add(this.center,this.center,temp);
}

NScamera.mouseRotate = function(dx,dy,mx,my) {
	var u = [0,0,-100*.6*this.startDistance]; //this.distance?

	var rho = Math.abs(this.screenCenter[0] - mx) / 800;
	var adz = Math.abs(dy) * rho;
	var ady = Math.abs(dy) * (1 - rho);
	var ySign = dy < 0 ? -1 : 1;
	var vy = vec3.create(); //avoid
	vec3.add(vy,u,[0,ady,0]);
	this.velocityX += vec3.angle(u,vy)*ySign;
	var vz = vec3.create(); //avoid
	vec3.add(vz,u,[0,adz,0]);
	this.velocityZ += vec3.angle(u, vz) * -ySign
			* (mx < this.screenCenter[0] / 2 ? -1 : 1);


	var eccentricity = Math.abs(this.screenCenter[1] - my)
			/ 800;
	var xSign = dx > 0 ? -1 : 1;
	adz = Math.abs(dx) * eccentricity;
	var adx = Math.abs(dx) * (1 - eccentricity);
	var vx = vec3.create();
	vec3.add(vx,u,[adx, 0, 0]);
	this.velocityY += vec3.angle(u,vx)*xSign;
	vec3.add(vz,u,[0,adz,0]);
	this.velocityZ += vec3.angle(u,vz)*xSign
		* (my > this.screenCenter[1] ? -1 : 1);
	
}

NScamera.mouseZoom = function(delta) {
	this.distance = Math.max(this.minDistance, this.distance - delta * Math.sqrt(this.distance * .02));
}

NScamera.step = function() {
  this.velocityX *= this.dampening;
  this.velocityY *= this.dampening;
  this.velocityZ *= this.dampening;
  if(Math.abs(this.velocityX) < 0.001) this.velocityX = 0;
  if(Math.abs(this.velocityY) < 0.001) this.velocityY = 0;
  if(Math.abs(this.velocityZ) < 0.001) this.velocityZ = 0;
  //is create necessary? Also is w first or last
  //do not create quat every time
  if(this.velocityX != 0 && !this.fixX) quat.multiply(this.rot,this.rot,[Math.sin(this.velocityX/2.0),0,0,Math.cos(this.velocityX/2.0)]);
  if(this.velocityY != 0 && !this.fixY) quat.multiply(this.rot,this.rot,[0,Math.sin(this.velocityY/2.0),0,Math.cos(this.velocityY/2.0)]);
  if(this.velocityZ != 0 && !this.fixZ) quat.multiply(this.rot,this.rot,[0,0,Math.sin(this.velocityZ/2.0),Math.cos(this.velocityZ/2.0)]);
  
}

},{"../js/gl-matrix-min.js":14}],3:[function(require,module,exports){

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
},{}],4:[function(require,module,exports){
"use strict"

var glMatrix = require("../js/gl-matrix-min.js");
var vec3 = glMatrix.vec3;
var vec2 = glMatrix.vec2;
var mat4 = glMatrix.mat4;
var nurbs = require("./nurbs.js");
var vboMesh = require("./vboMesh.js");
var text = require("./text.js");
var poly2tri = require("./poly2tri.js");
var SweepContext = poly2tri.SweepContext;

var woodWidth = 6.3;//5.95;//6.35;//12.2;
var conLen = 25; //45
var conOffset = 8;//12;
var conWidth = 8;//12;//20
var shelfOffset = 7;//10;//13;
var printTolerance = 0;
var labelHeight = 3.1;
var filletRadius = 7;//9;

var toothWidth = 2.8;//2.35;//2.5;
var toothDepth = 1.8;//1.4;//2.5;
var toothOffset = 11;//12.25;

var bottomLip = .3;
var bottomLipH = .6;
var connectorTris = [];
function initConnector(gl) {
  text.init(gl);
  //get connector tris
  for(var i=2;i<6;++i) {
    connectorTris[i] = vboMesh.create();
    makeConnectorSkeleton(i,connectorTris[i]);
  }
}

var accuracy = 3.175;



var createConnector = (function() {
  var maxValence = 7;
  var dirs = [];
  var labelsPt = new Array(maxValence);
  for(var i=0;i<maxValence;++i) {
    dirs[i] = vec3.create();
    labelsPt[i] = vec3.create();
  }
  var lengths = new Array(maxValence);
  var labels = new Array(maxValence);
  var pt = vec3.create();
  var pt2 = vec3.create();
  var pt3 = vec3.create();
  var dir, nDir;
  var dir1 = vec3.create();
  var dir2 = vec3.create();
  
  var perp = vec3.create();
  var bisector = vec3.create();
  var e,startE;
  var trans = mat4.create();
  var cLen, aLen, lenDiff, len;
  return function createConnector(v,vboOut) {
    startE = v.e;
    e = startE;
    var center = v.pos;
    var index = 0;
    do {
      e = e.next;
      if((e.face && e.face.on) || (e.pair.face && e.pair.face.on)) {
        vec3.sub(dirs[index],e.v.pos,center);
        len = vec3.len(dirs[index]);
        vec3.scale(dirs[index],dirs[index],1.0/len);
        labels[index] = e.info.label;
        //console.log(e.info.label);
        lengths[index] = len;
        index++;
      }
      e = e.pair;
    } while(e != startE);
    if(index < 2) {
      console.log("insufficient legs on connector");
      return;
    }
    var numLegs = index;
    
    var baseIndex = vboOut.numVertices;
    var numPts = 0;
    
    for(var i=0;i<numLegs;++i) {
      //make points
      dir = dirs[i];
      var iNext = (i+1)%numLegs;
      nDir = dirs[iNext];
      
      cLen = lengths[i]-shelfOffset*2;
      aLen = accuracy * Math.floor(cLen / accuracy);
      lenDiff = (cLen-aLen)*0.5;
      var cConLen = conLen;
      cConLen = Math.min(cConLen, aLen*0.9*0.5);
      
      vec2.set(perp,dir[1],-dir[0]);
      vec3.scaleAndAdd(pt,center, dir, cConLen+shelfOffset+lenDiff);
      vec2.scaleAndAdd(pt,pt,perp,woodWidth*0.5+printTolerance);      
      //addConnectorPt(vboOut,pt);
      vboMesh.addVertex(vboOut,pt);
      vec2.scaleAndAdd(pt2,pt,dir,-filletRadius);
      pt2[2] = conWidth;
      vboMesh.addVertex(vboOut,pt2);
      numPts++;
      
      //tooth
      vec2.scaleAndAdd(pt,pt,dir,-cConLen+toothOffset+toothWidth);      
      addConnectorPt(vboOut,pt);
      numPts++;

      vec2.scaleAndAdd(pt,pt,perp,-toothDepth);
      addConnectorPt(vboOut,pt);
      numPts++;
      
      vec2.scaleAndAdd(pt,pt,dir,-toothWidth);
      addConnectorPt(vboOut,pt);
      numPts++;
      
      vec2.scaleAndAdd(pt,pt,perp,toothDepth);
      addConnectorPt(vboOut,pt);
      numPts++;
            
      //end tooth
      vec2.scaleAndAdd(pt,pt,dir,-toothOffset); //cConLet
      addConnectorPt(vboOut,pt);
      numPts++;
      
      vec2.scaleAndAdd(pt,pt,perp,-(woodWidth+printTolerance*2));
      addConnectorPt(vboOut,pt);
      numPts++;

      
      //make curve
      var crv = nurbs.createCrv(null, 2);
      var crvTop = nurbs.createCrv(null, 2);
      
      vec2.scaleAndAdd(pt,pt,dir,cConLen);
      //addConnectorPt(vboOut,pt);
      vboMesh.addVertex(vboOut,pt);
      vec2.scaleAndAdd(pt2,pt,dir,-filletRadius);
      pt2[2] = conWidth;
      vboMesh.addVertex(vboOut,pt2);

      
      numPts++;
      
      nurbs.addPoint(crv,pt);
      nurbs.addPoint(crvTop,pt2);

      vec2.scaleAndAdd(pt,pt,perp,-conOffset);
      vec2.scaleAndAdd(pt2,pt2,perp,-conOffset+filletRadius);
      //addConnectorPt(vboOut,pt);
      //numPts++;

      nurbs.addPoint(crv,pt);
      nurbs.addPoint(crvTop,pt2);
      
      //get offset
      bisector[0] = dir[0]-nDir[0];
      bisector[1] = dir[1]-nDir[1];
      vec2.normalize(bisector,bisector);
      //rotate 90
      var temp = bisector[0];
      bisector[0] = -bisector[1];
      bisector[1] = temp;
      var sinA = Math.abs(bisector[0]*dir[1]-bisector[1]*dir[0]);
      vec3.scaleAndAdd(pt,center,bisector,(woodWidth*0.5+conOffset)/sinA);
      vec2.scaleAndAdd(pt2,center,bisector,(woodWidth*0.5+(conOffset-filletRadius))/sinA);

      nurbs.addPoint(crv,pt);
      nurbs.addPoint(crvTop,pt2);
      
      //addConnectorPt(vboOut,pt);
      //numPts++;
      
      //deal with next leg
      cLen = lengths[iNext]-shelfOffset*2;
      aLen = accuracy * Math.floor(cLen / accuracy);
      lenDiff = (cLen-aLen)*0.5;
      cConLen = Math.min(conLen, aLen*0.9*0.5);

      vec2.set(perp,nDir[1],-nDir[0]);
      vec3.scaleAndAdd(pt,center, nDir, cConLen+shelfOffset+lenDiff);
      vec2.scaleAndAdd(pt,pt,perp,woodWidth*0.5+printTolerance+conOffset);      
      vec2.scaleAndAdd(pt2,pt,perp,-filletRadius);
      vec2.scaleAndAdd(pt2,pt2,nDir,-filletRadius);
      
      nurbs.addPoint(crv,pt);
      nurbs.addPoint(crvTop,pt2);
      vec2.scaleAndAdd(pt,pt,perp,-conOffset);      
      vec2.scaleAndAdd(pt2,pt2,perp,-(conOffset-filletRadius));      
      nurbs.addPoint(crv,pt);
      nurbs.addPoint(crvTop,pt2);
      
      var domain = nurbs.domain(crv);
      for(var j=1;j<20;++j) {
        var u = j/20.0*(domain[1]-domain[0])+domain[0];
        nurbs.evaluateCrv(crv,u,pt);
        nurbs.evaluateCrv(crvTop,u,pt2);
        //addConnectorPt(vboOut,pt);
        vboMesh.addVertex(vboOut,pt);
        vboMesh.addVertex(vboOut,pt2);
        
        numPts++;
        
      }
      
    }
    var baseIndex2 = vboOut.numVertices;

    //add label holes
    var labelSpace = 1;
    for(var i=0;i<numLegs;++i) {
      //make points
      dir = dirs[i];
      vec2.set(perp,dir[1],-dir[0]);
      vec3.scaleAndAdd(pt,center, dir, shelfOffset-labelSpace);
      vec2.scaleAndAdd(pt,pt,perp,labelHeight);
      pt[2] = -bottomLipH;
      addConnectorPt(vboOut,pt);
      
      vec2.scaleAndAdd(pt,pt,perp,-labelHeight);
      pt[2] = -bottomLipH;
      addConnectorPt(vboOut,pt);

      vec2.scaleAndAdd(pt,pt,perp,-labelHeight);
      pt[2] = -bottomLipH;
      addConnectorPt(vboOut,pt);
      
      vec2.scaleAndAdd(pt,pt,dir,-labelHeight);
      pt[2] = -bottomLipH;
      addConnectorPt(vboOut,pt);
      
      vec2.scaleAndAdd(pt,pt,perp,labelHeight);
      pt[2] = -bottomLipH;
      addConnectorPt(vboOut,pt);

      vec2.scaleAndAdd(pt,pt,perp,labelHeight);
      pt[2] = -bottomLipH;
      addConnectorPt(vboOut,pt);
      pt[2] = -bottomLipH;
      vec3.copy(labelsPt[i],pt);  
    }
    
    var baseIndex3 = vboOut.numVertices;
    //stitch sides
    /*
    for(var i=0;i<numPts;++i) {
      var iNext = (i+1)%numPts;
      vboMesh.addTriangle(vboOut,baseIndex+i*2,baseIndex+iNext*2+1,baseIndex+i*2+1);
      vboMesh.addTriangle(vboOut,baseIndex+i*2,baseIndex+iNext*2,baseIndex+iNext*2+1);
    }
    */
    
    var divs = 4;
    for(var i=0;i<numPts;++i) {
      var iNext = (i+1)%numPts;
      vboMesh.getVertex(pt,vboOut,baseIndex+i*2);
      vboMesh.getVertex(pt2,vboOut,baseIndex+i*2+1);
      vec2.sub(perp,pt,pt2);
      
      vboMesh.addTriangle(vboOut,baseIndex+i*2,baseIndex3+iNext*divs,baseIndex3+i*divs);
      vboMesh.addTriangle(vboOut,baseIndex+i*2,baseIndex+iNext*2,baseIndex3+iNext*divs);
      for(var j=0;j<divs;++j) {
        var angle = (j+1)*Math.PI*0.5/(divs+1);
        //redundant could precompute
        var cosA = Math.cos(angle);
        var sinA = Math.sin(angle);
        vec2.scaleAndAdd(pt,pt2,perp,cosA);
        pt[2] = sinA*pt2[2];
        
        vboMesh.addVertex(vboOut,pt);
        if(j<divs-1) {
          vboMesh.addTriangle(vboOut,baseIndex3+i*divs+j,baseIndex3+iNext*divs+j+1,baseIndex3+i*divs+j+1);
          vboMesh.addTriangle(vboOut,baseIndex3+i*divs+j,baseIndex3+iNext*divs+j,baseIndex3+iNext*divs+j+1);
        }

      }
      vboMesh.addTriangle(vboOut,baseIndex3+i*divs+divs-1,baseIndex+iNext*2+1,baseIndex+i*2+1);
      vboMesh.addTriangle(vboOut,baseIndex3+i*divs+divs-1,baseIndex3+iNext*divs+divs-1,baseIndex+iNext*2+1);
    }
    
    var baseIndex4 = vboOut.numVertices;
    //add bottom lip
    for(var i=0;i<numPts;++i) {
      var iNext = (i+1)%numPts;
      var iPrev = (i-1+numPts)%numPts;
      vboMesh.getVertex(pt,vboOut,baseIndex+i*2);
      vboMesh.getVertex(pt2,vboOut,baseIndex+iNext*2);
      vboMesh.getVertex(pt3,vboOut,baseIndex+iPrev*2);
      
      //offset in
      vec2.sub(dir1,pt2,pt);
      vec2.sub(dir2,pt,pt3);
      vec2.normalize(dir1,dir1);
      vec2.normalize(dir2,dir2);
      
      vec2.add(bisector,dir1,dir2);
      var temp = bisector[0];
      bisector[0] = -bisector[1];
      bisector[1] = temp;

      var sinA = Math.abs(bisector[0]*dir1[1]-bisector[1]*dir1[0]);
      vec3.scaleAndAdd(pt,pt,bisector,bottomLip/sinA);
      
      pt[2] = -bottomLipH;
      vboMesh.addVertex(vboOut,pt);
      
      vboMesh.addTriangle(vboOut,baseIndex+i*2, baseIndex4+i, baseIndex4+iNext);
      vboMesh.addTriangle(vboOut,baseIndex+i*2, baseIndex4+iNext, baseIndex+iNext*2);
    }
    //cover top hole
    for(var i=0;i<numLegs;++i) {
      vboMesh.addTriangle(vboOut, baseIndex2+i*12+1,baseIndex2+i*12+3,baseIndex2+i*12+9);
      vboMesh.addTriangle(vboOut, baseIndex2+i*12+1,baseIndex2+i*12+9,baseIndex2+i*12+11);

      vboMesh.addTriangle(vboOut, baseIndex2+i*12+3,baseIndex2+i*12+5,baseIndex2+i*12+7);
      vboMesh.addTriangle(vboOut, baseIndex2+i*12+3,baseIndex2+i*12+7,baseIndex2+i*12+9);

    }
    
    //stitch faces
    var faceVbo = connectorTris[numLegs];
    for(var i=0;i<faceVbo.numIndices;) {
      var i1 = faceVbo.indexData[i++];
      var i2 = faceVbo.indexData[i++];
      var i3 = faceVbo.indexData[i++];
      //vboMesh.addTriangle(vboOut, baseIndex+i1*2, baseIndex+i3*2, baseIndex+i2*2);
      var bi1 = baseIndex4+i1;
      var bi2 = baseIndex4+i3;
      var bi3 = baseIndex4+i2;
      if(i1 >= numPts) {
        bi1 = baseIndex+i1*2;
      }
      if(i3 >= numPts) {
        bi2 = baseIndex+i3*2;
      }
      if(i2 >= numPts) {
        bi3 = baseIndex+i2*2;
      }
      vboMesh.addTriangle(vboOut, bi1,bi2,bi3);
      vboMesh.addTriangle(vboOut, baseIndex+i1*2+1, baseIndex+i2*2+1, baseIndex+i3*2+1);      
    }
    
    //add labels
    
    for(var i=0;i<numLegs;++i) {
      dir = dirs[i];
      var hundreds = Math.floor(labels[i]/100)%10;
      var tens = Math.floor(labels[i]/10)%10;
      var ones = labels[i]%10;
      mat4.identity(trans);
      mat4.translate(trans,trans,labelsPt[i]);
      var angle = Math.atan2(-dir[0],dir[1]);
      mat4.rotateZ(trans,trans,angle);
      mat4.scale(trans,trans,[-labelHeight,labelHeight,1]);
      vec2.set(perp,dir[1],-dir[0]);
      
      vboMesh.addMeshTransform(vboOut,text.numVbos[tens], trans);
      
      vec2.scaleAndAdd(labelsPt[i],labelsPt[i], perp,-labelHeight);
      mat4.identity(trans);
      mat4.translate(trans,trans,labelsPt[i]);
      mat4.rotateZ(trans,trans,angle);
      mat4.scale(trans,trans,[-labelHeight,labelHeight,1]);
      vboMesh.addMeshTransform(vboOut,text.numVbos[ones], trans);
      if(hundreds > 0) {
        vec2.scaleAndAdd(labelsPt[i],labelsPt[i], perp,2*labelHeight);
        mat4.identity(trans);
        mat4.translate(trans,trans,labelsPt[i]);
        mat4.rotateZ(trans,trans,angle);
        mat4.scale(trans,trans,[-labelHeight,labelHeight,1]);
        vboMesh.addMeshTransform(vboOut,text.numVbos[hundreds], trans);
      }
    }
    
  }
})();

var makeConnectorSkeleton = (function() {
  var maxValence = 7;
  var dirs = [];
  for(var i=0;i<maxValence;++i) {
    dirs[i] = vec3.create();
  }
  var pt = vec3.create();
  var pt2 = vec3.create();
  var dir, nDir;
  var perp = vec3.create();
  var bisector = vec3.create();
  var e,startE;
  var center = vec3.create();
  return function makeConnectorSkeleton(numLegs,vboOut) {
    var index = 0;
    for(var i=0;i<numLegs;++i) {
      var angle = i/numLegs*Math.PI*2.0;
      vec2.set(dirs[i], Math.cos(angle),Math.sin(angle));
    }
    
    var baseIndex = vboOut.numVertices;
    var numPts = 0;
    var outsidePts = [];
    var innerCrvs = [];
    var labelSpace = 1;
    for(var i=0;i<numLegs;++i) {
      //make points
      dir = dirs[i];
      nDir = dirs[(i+1)%numLegs];
      vec2.set(perp,dir[1],-dir[0]);
      vec3.scaleAndAdd(pt,center, dir, conLen+shelfOffset);
      vec2.scaleAndAdd(pt,pt,perp,woodWidth*0.5+printTolerance);
      outsidePts.push({x:pt[0],y:pt[1],index:numPts});
      vboMesh.addVertex(vboOut,pt);
      numPts++;
      
      //tooth
      vec2.scaleAndAdd(pt,pt,dir,-conLen+toothOffset+toothWidth);      
      outsidePts.push({x:pt[0],y:pt[1],index:numPts});
      vboMesh.addVertex(vboOut,pt);
      numPts++;

      vec2.scaleAndAdd(pt,pt,perp,-toothDepth);
      outsidePts.push({x:pt[0],y:pt[1],index:numPts});
      vboMesh.addVertex(vboOut,pt);
      numPts++;
      
      vec2.scaleAndAdd(pt,pt,dir,-toothWidth);
      outsidePts.push({x:pt[0],y:pt[1],index:numPts});
      vboMesh.addVertex(vboOut,pt);
      numPts++;
      
      vec2.scaleAndAdd(pt,pt,perp,toothDepth);
      outsidePts.push({x:pt[0],y:pt[1],index:numPts});
      vboMesh.addVertex(vboOut,pt);
      numPts++;
      
      vec2.scaleAndAdd(pt,pt,dir,-toothOffset);
      outsidePts.push({x:pt[0],y:pt[1],index:numPts});
      vboMesh.addVertex(vboOut,pt);
      numPts++;
      
      vec2.scaleAndAdd(pt,pt,perp,-(woodWidth+printTolerance*2));
      outsidePts.push({x:pt[0],y:pt[1],index:numPts});
      vboMesh.addVertex(vboOut,pt);
      numPts++;

      
      //make curve
      var crv = nurbs.createCrv(null, 2);
      
      vec2.scaleAndAdd(pt,pt,dir,conLen);
      outsidePts.push({x:pt[0],y:pt[1],index:numPts});
      vboMesh.addVertex(vboOut,pt);
      numPts++;
      
      nurbs.addPoint(crv,pt);

      vec2.scaleAndAdd(pt,pt,perp,-conOffset);
      //addConnectorPt(vboOut,pt);
      //numPts++;

      nurbs.addPoint(crv,pt);
      
      //get offset
      bisector[0] = dir[0]-nDir[0];
      bisector[1] = dir[1]-nDir[1];
      vec2.normalize(bisector,bisector);
      //rotate 90
      var temp = bisector[0];
      bisector[0] = -bisector[1];
      bisector[1] = temp;
      var sinA = Math.abs(bisector[0]*dir[1]-bisector[1]*dir[0]);
      vec3.scaleAndAdd(pt,center,bisector,(woodWidth*0.5+conOffset)/sinA);

      nurbs.addPoint(crv,pt);
      
      //addConnectorPt(vboOut,pt);
      //numPts++;
      
      vec2.set(perp,nDir[1],-nDir[0]);
      vec3.scaleAndAdd(pt,center, nDir, conLen+shelfOffset);
      vec2.scaleAndAdd(pt,pt,perp,woodWidth*0.5+printTolerance+conOffset);      
      
      nurbs.addPoint(crv,pt);
      vec2.scaleAndAdd(pt,pt,perp,-conOffset);      
      nurbs.addPoint(crv,pt);
      
      var domain = nurbs.domain(crv);
      for(var j=1;j<20;++j) {
        var u = j/20.0*(domain[1]-domain[0])+domain[0];
        nurbs.evaluateCrv(crv,u,pt);
        outsidePts.push({x:pt[0],y:pt[1],index:numPts});
        vboMesh.addVertex(vboOut,pt);
        numPts++;
        
      }
      
      //labelHole
      
    }
    
    //holes    
    for(var i=0;i<numLegs;++i) {
      //make points
      innerCrvs[i] = [];
      dir = dirs[i];
      vec2.set(perp,dir[1],-dir[0]);
      vec3.scaleAndAdd(pt,center, dir, shelfOffset-labelSpace);
      vec2.scaleAndAdd(pt,pt,perp,labelHeight);
      innerCrvs[i].push({x:pt[0],y:pt[1],index:numPts});
      vboMesh.addVertex(vboOut,pt);
      numPts++;
      
      vec2.scaleAndAdd(pt,pt,perp,-labelHeight);
      innerCrvs[i].push({x:pt[0],y:pt[1],index:numPts});
      vboMesh.addVertex(vboOut,pt);
      numPts++;

      vec2.scaleAndAdd(pt,pt,perp,-labelHeight);
      innerCrvs[i].push({x:pt[0],y:pt[1],index:numPts});
      vboMesh.addVertex(vboOut,pt);
      numPts++;
      
      vec2.scaleAndAdd(pt,pt,dir,-labelHeight);
      innerCrvs[i].push({x:pt[0],y:pt[1],index:numPts});
      vboMesh.addVertex(vboOut,pt);
      numPts++;
      
      vec2.scaleAndAdd(pt,pt,perp,labelHeight);
      innerCrvs[i].push({x:pt[0],y:pt[1],index:numPts});
      vboMesh.addVertex(vboOut,pt);
      numPts++;

      vec2.scaleAndAdd(pt,pt,perp,labelHeight);
      innerCrvs[i].push({x:pt[0],y:pt[1],index:numPts});
      vboMesh.addVertex(vboOut,pt);
      numPts++;
    }
    var triangulation = new SweepContext(outsidePts);
    for(var i=0;i<innerCrvs.length;++i) {
      triangulation.addHole(innerCrvs[i]);
    }
    triangulation.triangulate();
    var triangles = triangulation.getTriangles();
    for(var i=0;i<triangles.length;++i) {
      var t = triangles[i];
      vboMesh.addTriangle(vboOut,t.points_[0].index,t.points_[1].index,t.points_[2].index);
    }
    
    //add labels
    
  }
})();

function addConnectorPt(vboOut,pt) {
  vboMesh.addVertex(vboOut,pt);
  pt[2] = conWidth;
  vboMesh.addVertex(vboOut,pt);
  pt[2] = 0;
}

var getShelfLength = function(e) {
  var len = vec2.dist(e.v.pos,e.pair.v.pos);
  var cLen = len-shelfOffset*2;
  var aLen = accuracy * Math.floor(cLen / accuracy);
  return aLen;
}

function save2D() {
  var doc = new jsPDF();
}

var createConnector2D = (function(pdf) {
  var maxValence = 7;
  var dirs = [];
  var labelsPt = new Array(maxValence);
  for(var i=0;i<maxValence;++i) {
    dirs[i] = vec3.create();
    labelsPt[i] = vec3.create();
  }
  var lengths = new Array(maxValence);
  var labels = new Array(maxValence);
  var pt = vec3.create();
  var pt2 = vec3.create();
  var pt3 = vec3.create();
  var dir, nDir;
  var dir1 = vec3.create();
  var dir2 = vec3.create();
  
  var perp = vec3.create();
  var bisector = vec3.create();
  var e,startE;
  var trans = mat4.create();
  var cLen, aLen, lenDiff, len;
  return function createConnector(v,doc) {
    startE = v.e;
    e = startE;
    var center = v.pos;
    var index = 0;
    do {
      e = e.next;
      if((e.face && e.face.on) || (e.pair.face && e.pair.face.on)) {
        vec3.sub(dirs[index],e.v.pos,center);
        len = vec3.len(dirs[index]);
        vec3.scale(dirs[index],dirs[index],1.0/len);
        labels[index] = e.info.label;
        //console.log(e.info.label);
        lengths[index] = len;
        index++;
      }
      e = e.pair;
    } while(e != startE);
    if(index < 2) return;
    var numLegs = index;
    
    var baseIndex = vboOut.numVertices;
    var numPts = 0;
    
    for(var i=0;i<numLegs;++i) {
      //make points
      dir = dirs[i];
      var iNext = (i+1)%numLegs;
      nDir = dirs[iNext];
      
      cLen = lengths[i]-shelfOffset*2;
      aLen = accuracy * Math.floor(cLen / accuracy);
      lenDiff = (cLen-aLen)*0.5;
      var cConLen = conLen;
      cConLen = Math.min(cConLen, aLen*0.9*0.5);
      
      vec2.set(perp,dir[1],-dir[0]);
      vec3.scaleAndAdd(pt,center, dir, cConLen+shelfOffset+lenDiff);
      vec2.scaleAndAdd(pt,pt,perp,woodWidth*0.5+printTolerance);      
      //addConnectorPt(vboOut,pt);
      vboMesh.addVertex(vboOut,pt);
      vec2.scaleAndAdd(pt2,pt,dir,-filletRadius);
      pt2[2] = conWidth;
      vboMesh.addVertex(vboOut,pt2);
      numPts++;
      
      //tooth
      vec2.scaleAndAdd(pt,pt,dir,-cConLen+toothOffset+toothWidth);      
      addConnectorPt(vboOut,pt);
      numPts++;

      vec2.scaleAndAdd(pt,pt,perp,-toothDepth);
      addConnectorPt(vboOut,pt);
      numPts++;
      
      vec2.scaleAndAdd(pt,pt,dir,-toothWidth);
      addConnectorPt(vboOut,pt);
      numPts++;
      
      vec2.scaleAndAdd(pt,pt,perp,toothDepth);
      addConnectorPt(vboOut,pt);
      numPts++;
            
      //end tooth
      vec2.scaleAndAdd(pt,pt,dir,-toothOffset); //cConLet
      addConnectorPt(vboOut,pt);
      numPts++;
      
      vec2.scaleAndAdd(pt,pt,perp,-(woodWidth+printTolerance*2));
      addConnectorPt(vboOut,pt);
      numPts++;

      
      //make curve
      var crv = nurbs.createCrv(null, 2);
      var crvTop = nurbs.createCrv(null, 2);
      
      vec2.scaleAndAdd(pt,pt,dir,cConLen);
      //addConnectorPt(vboOut,pt);
      vboMesh.addVertex(vboOut,pt);
      vec2.scaleAndAdd(pt2,pt,dir,-filletRadius);
      pt2[2] = conWidth;
      vboMesh.addVertex(vboOut,pt2);

      
      numPts++;
      
      nurbs.addPoint(crv,pt);
      nurbs.addPoint(crvTop,pt2);

      vec2.scaleAndAdd(pt,pt,perp,-conOffset);
      vec2.scaleAndAdd(pt2,pt2,perp,-conOffset+filletRadius);
      //addConnectorPt(vboOut,pt);
      //numPts++;

      nurbs.addPoint(crv,pt);
      nurbs.addPoint(crvTop,pt2);
      
      //get offset
      bisector[0] = dir[0]-nDir[0];
      bisector[1] = dir[1]-nDir[1];
      vec2.normalize(bisector,bisector);
      //rotate 90
      var temp = bisector[0];
      bisector[0] = -bisector[1];
      bisector[1] = temp;
      var sinA = Math.abs(bisector[0]*dir[1]-bisector[1]*dir[0]);
      vec3.scaleAndAdd(pt,center,bisector,(woodWidth*0.5+conOffset)/sinA);
      vec2.scaleAndAdd(pt2,center,bisector,(woodWidth*0.5+(conOffset-filletRadius))/sinA);

      nurbs.addPoint(crv,pt);
      nurbs.addPoint(crvTop,pt2);
      
      //addConnectorPt(vboOut,pt);
      //numPts++;
      
      //deal with next leg
      cLen = lengths[iNext]-shelfOffset*2;
      aLen = accuracy * Math.floor(cLen / accuracy);
      lenDiff = (cLen-aLen)*0.5;
      cConLen = Math.min(conLen, aLen*0.9*0.5);

      vec2.set(perp,nDir[1],-nDir[0]);
      vec3.scaleAndAdd(pt,center, nDir, cConLen+shelfOffset+lenDiff);
      vec2.scaleAndAdd(pt,pt,perp,woodWidth*0.5+printTolerance+conOffset);      
      vec2.scaleAndAdd(pt2,pt,perp,-filletRadius);
      vec2.scaleAndAdd(pt2,pt2,nDir,-filletRadius);
      
      nurbs.addPoint(crv,pt);
      nurbs.addPoint(crvTop,pt2);
      vec2.scaleAndAdd(pt,pt,perp,-conOffset);      
      vec2.scaleAndAdd(pt2,pt2,perp,-(conOffset-filletRadius));      
      nurbs.addPoint(crv,pt);
      nurbs.addPoint(crvTop,pt2);
      
      var domain = nurbs.domain(crv);
      for(var j=1;j<20;++j) {
        var u = j/20.0*(domain[1]-domain[0])+domain[0];
        nurbs.evaluateCrv(crv,u,pt);
        nurbs.evaluateCrv(crvTop,u,pt2);
        //addConnectorPt(vboOut,pt);
        vboMesh.addVertex(vboOut,pt);
        vboMesh.addVertex(vboOut,pt2);
        
        numPts++;
        
      }
      
    }
    var baseIndex2 = vboOut.numVertices;

    //add label holes
    var labelSpace = 1;
    for(var i=0;i<numLegs;++i) {
      //make points
      dir = dirs[i];
      vec2.set(perp,dir[1],-dir[0]);
      vec3.scaleAndAdd(pt,center, dir, shelfOffset-labelSpace);
      vec2.scaleAndAdd(pt,pt,perp,labelHeight);
      pt[2] = -bottomLipH;
      addConnectorPt(vboOut,pt);
      
      vec2.scaleAndAdd(pt,pt,perp,-labelHeight);
      pt[2] = -bottomLipH;
      addConnectorPt(vboOut,pt);

      vec2.scaleAndAdd(pt,pt,perp,-labelHeight);
      pt[2] = -bottomLipH;
      addConnectorPt(vboOut,pt);
      
      vec2.scaleAndAdd(pt,pt,dir,-labelHeight);
      pt[2] = -bottomLipH;
      addConnectorPt(vboOut,pt);
      
      vec2.scaleAndAdd(pt,pt,perp,labelHeight);
      pt[2] = -bottomLipH;
      addConnectorPt(vboOut,pt);

      vec2.scaleAndAdd(pt,pt,perp,labelHeight);
      pt[2] = -bottomLipH;
      addConnectorPt(vboOut,pt);
      pt[2] = -bottomLipH;
      vec3.copy(labelsPt[i],pt);  
    }
    
    var baseIndex3 = vboOut.numVertices;
    //stitch sides
    /*
    for(var i=0;i<numPts;++i) {
      var iNext = (i+1)%numPts;
      vboMesh.addTriangle(vboOut,baseIndex+i*2,baseIndex+iNext*2+1,baseIndex+i*2+1);
      vboMesh.addTriangle(vboOut,baseIndex+i*2,baseIndex+iNext*2,baseIndex+iNext*2+1);
    }
    */
    
    var divs = 4;
    for(var i=0;i<numPts;++i) {
      var iNext = (i+1)%numPts;
      vboMesh.getVertex(pt,vboOut,baseIndex+i*2);
      vboMesh.getVertex(pt2,vboOut,baseIndex+i*2+1);
      vec2.sub(perp,pt,pt2);
      
      vboMesh.addTriangle(vboOut,baseIndex+i*2,baseIndex3+iNext*divs,baseIndex3+i*divs);
      vboMesh.addTriangle(vboOut,baseIndex+i*2,baseIndex+iNext*2,baseIndex3+iNext*divs);
      for(var j=0;j<divs;++j) {
        var angle = (j+1)*Math.PI*0.5/(divs+1);
        //redundant could precompute
        var cosA = Math.cos(angle);
        var sinA = Math.sin(angle);
        vec2.scaleAndAdd(pt,pt2,perp,cosA);
        pt[2] = sinA*pt2[2];
        
        vboMesh.addVertex(vboOut,pt);
        if(j<divs-1) {
          vboMesh.addTriangle(vboOut,baseIndex3+i*divs+j,baseIndex3+iNext*divs+j+1,baseIndex3+i*divs+j+1);
          vboMesh.addTriangle(vboOut,baseIndex3+i*divs+j,baseIndex3+iNext*divs+j,baseIndex3+iNext*divs+j+1);
        }

      }
      vboMesh.addTriangle(vboOut,baseIndex3+i*divs+divs-1,baseIndex+iNext*2+1,baseIndex+i*2+1);
      vboMesh.addTriangle(vboOut,baseIndex3+i*divs+divs-1,baseIndex3+iNext*divs+divs-1,baseIndex+iNext*2+1);
    }
    
    var baseIndex4 = vboOut.numVertices;
    //add bottom lip
    for(var i=0;i<numPts;++i) {
      var iNext = (i+1)%numPts;
      var iPrev = (i-1+numPts)%numPts;
      vboMesh.getVertex(pt,vboOut,baseIndex+i*2);
      vboMesh.getVertex(pt2,vboOut,baseIndex+iNext*2);
      vboMesh.getVertex(pt3,vboOut,baseIndex+iPrev*2);
      
      //offset in
      vec2.sub(dir1,pt2,pt);
      vec2.sub(dir2,pt,pt3);
      vec2.normalize(dir1,dir1);
      vec2.normalize(dir2,dir2);
      
      vec2.add(bisector,dir1,dir2);
      var temp = bisector[0];
      bisector[0] = -bisector[1];
      bisector[1] = temp;

      var sinA = Math.abs(bisector[0]*dir1[1]-bisector[1]*dir1[0]);
      vec3.scaleAndAdd(pt,pt,bisector,bottomLip/sinA);
      
      pt[2] = -bottomLipH;
      vboMesh.addVertex(vboOut,pt);
      
      vboMesh.addTriangle(vboOut,baseIndex+i*2, baseIndex4+i, baseIndex4+iNext);
      vboMesh.addTriangle(vboOut,baseIndex+i*2, baseIndex4+iNext, baseIndex+iNext*2);
    }
    //cover top hole
    for(var i=0;i<numLegs;++i) {
      vboMesh.addTriangle(vboOut, baseIndex2+i*12+1,baseIndex2+i*12+3,baseIndex2+i*12+9);
      vboMesh.addTriangle(vboOut, baseIndex2+i*12+1,baseIndex2+i*12+9,baseIndex2+i*12+11);

      vboMesh.addTriangle(vboOut, baseIndex2+i*12+3,baseIndex2+i*12+5,baseIndex2+i*12+7);
      vboMesh.addTriangle(vboOut, baseIndex2+i*12+3,baseIndex2+i*12+7,baseIndex2+i*12+9);

    }
    
    //stitch faces
    var faceVbo = connectorTris[numLegs];
    for(var i=0;i<faceVbo.numIndices;) {
      var i1 = faceVbo.indexData[i++];
      var i2 = faceVbo.indexData[i++];
      var i3 = faceVbo.indexData[i++];
      //vboMesh.addTriangle(vboOut, baseIndex+i1*2, baseIndex+i3*2, baseIndex+i2*2);
      var bi1 = baseIndex4+i1;
      var bi2 = baseIndex4+i3;
      var bi3 = baseIndex4+i2;
      if(i1 >= numPts) {
        bi1 = baseIndex+i1*2;
      }
      if(i3 >= numPts) {
        bi2 = baseIndex+i3*2;
      }
      if(i2 >= numPts) {
        bi3 = baseIndex+i2*2;
      }
      vboMesh.addTriangle(vboOut, bi1,bi2,bi3);
      vboMesh.addTriangle(vboOut, baseIndex+i1*2+1, baseIndex+i2*2+1, baseIndex+i3*2+1);      
    }
    
    //add labels
    /*
    for(var i=0;i<numLegs;++i) {
      dir = dirs[i];
      var tens = Math.floor(labels[i]/10)%10;
      var ones = labels[i]%10;
      mat4.identity(trans);
      mat4.translate(trans,trans,labelsPt[i]);
      var angle = Math.atan2(-dir[0],dir[1]);
      mat4.rotateZ(trans,trans,angle);
      mat4.scale(trans,trans,[-labelHeight,labelHeight,1]);
      vec2.set(perp,dir[1],-dir[0]);
      
      vboMesh.addMeshTransform(vboOut,text.numVbos[tens], trans);
      
      vec2.scaleAndAdd(labelsPt[i],labelsPt[i], perp,-labelHeight);
      mat4.identity(trans);
      mat4.translate(trans,trans,labelsPt[i]);
      mat4.rotateZ(trans,trans,angle);
      mat4.scale(trans,trans,[-labelHeight,labelHeight,1]);
      vboMesh.addMeshTransform(vboOut,text.numVbos[ones], trans);
    }
    */
  }
})();

var setTolerance = function(tol) {
  printTolerance = tol;
}

var getTolerance = function() {
  return printTolerance;
}

exports.getShelfLength = getShelfLength;
exports.createConnector = createConnector;
exports.initConnector = initConnector;
exports.shelfOffset = shelfOffset;
exports.setTolerance = setTolerance;
exports.getTolerance = getTolerance;
},{"../js/gl-matrix-min.js":14,"./nurbs.js":9,"./poly2tri.js":10,"./text.js":11,"./vboMesh.js":12}],5:[function(require,module,exports){
var gl;
var ext = null;
function initGL(canvas, drawBuffer) {
  drawBuffer = drawBuffer ? drawBuffer : false;
    try {
        gl = canvas.getContext("webgl",{preserveDrawingBuffer: drawBuffer});
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;
        ext = gl.getExtension("OES_element_index_uint");
        return gl;
    } catch (e) {
    }
    if (!gl) {
        //alert("Could not initialise WebGL, sorry :-(");
        return false;
    }
}

/*
pass cube map object
cubemap has an array of six cubeImages
*/

function initCubeTexture(cubeMapObj) {
    cubeMapObj.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeMapObj.texture);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);

    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, cubeMapObj.cubeImages[0]);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, cubeMapObj.cubeImages[1]);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, cubeMapObj.cubeImages[2]);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, cubeMapObj.cubeImages[3]);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, cubeMapObj.cubeImages[4]);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, cubeMapObj.cubeImages[5]);
}

exports.init = initGL;
exports.initCubeTexture = initCubeTexture;
},{}],6:[function(require,module,exports){
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

},{"./bookshelf.js":1,"./colorSet.js":3,"./voronoi.js":13,"tween.js":8}],7:[function(require,module,exports){
"use strict"

var glShader = require('../js/glShader.js');
var glMatrix = require('../js/gl-matrix-min.js');
var poly2tri = require('./poly2tri.js');
var glUtils = require('./glUtils.js');
var voronoi = require('./voronoi.js');
var vboMesh = require('./vboMesh.js');
var connector = require('./connector.js');
var pointer = require('../js/pointer.js');
var camera = require('./camera.js');
var bookshelf = require('./bookshelf.js');
var gui = require('./gui.js');
var vec2 = glMatrix.vec2;
var vec3 = glMatrix.vec3;
var vec4 = glMatrix.vec4;
var mat4 = glMatrix.mat4;
var mat3 = glMatrix.mat3;
var quat = glMatrix.quat;

var canvas;
var canvas2d;
var ctx;
var gl;
var colorShader;
var phongShader;
var voronoiEdges;
var mvMatrix = mat4.create();
var pMatrix = mat4.create();
var nMatrix = mat3.create();
var connectorVbo;
var shelfVbo;
var circleVbo;
var tempVbo;

var colorInfo;

var minimumShelf = 75;//85;//105;
var flattenAngle = 0;//Math.PI*.1;
bookshelf.flattenAngle = flattenAngle;
var sinFlattenAngle = Math.sin(flattenAngle);

var selectedPt = -1;

var window2dWidth = 800;

init();

function init() {
//stupid
	document.addEventListener( "keydown",keyPress,false);
	document.addEventListener( 'drop', onDocumentDrop, false );
	document.addEventListener( 'dragover', function(event){event.preventDefault();}, false );
	document.addEventListener( 'dragleave', function(event){event.preventDefault();}, false );

  canvas = document.getElementById("gl");
  canvas2d = document.getElementById("2d");
  pointer.setupMouseEvents(canvas);
  camera.screenCenter = [1200,400];
  ctx = canvas2d.getContext('2d');
  gl = glUtils.init(canvas);
  //setupGui();
  
  gui.setColorCallback(setConnectorColor);
  gui.setSaveFunction(save);
  gui.init();
  colorShader = glShader.loadShader(gl,"../shaders/simpleColor.vert","../shaders/simpleColor.frag");
  phongShader = glShader.loadShader(gl,"../shaders/phongSimple.vert","../shaders/phongSimple.frag");
  vboMesh.setGL(gl);
  var loadId = getUrlVars()['id'];
  initVoronoi();
  if(loadId) {
    load(loadId);
  }
  connector.initConnector(gl);
  
  voronoiEdges = vboMesh.create();
  connectorVbo = vboMesh.create32();
  tempVbo = vboMesh.create();
  shelfVbo = vboMesh.create();
  vboMesh.enableTexCoord(shelfVbo);
  vboMesh.enableNormals(shelfVbo);
  initCircle();
  requestAnimationFrame(step);
  
  quat.rotateY(camera.rot,camera.rot,195*Math.PI/180.0);
  quat.rotateX(camera.rot,camera.rot,15*Math.PI/180.0);
  vec3.set(camera.center,bookshelf.width*0.5,bookshelf.height*0.5,5);
  //gui.init();
}

function initCircle() {
  circleVbo = vboMesh.create();
  vboMesh.addVertex(circleVbo,[0,0,0]);
  for(var i=0;i<=12;++i) {
    var angle = i*Math.PI*2.0/12.0;
    vboMesh.addVertex(circleVbo, [6*Math.cos(angle),6*Math.sin(angle),0]);
  }
  vboMesh.buffer(circleVbo,gl);
}

function step() {
  requestAnimationFrame(step);
  var maxX = -9e9, minX = 9e9, maxY = -9e9, minY = 9e9;
  for(var i=0;i<voronoi.boundary.length;++i) {
    var pt = voronoi.boundary[i];
    maxX = Math.max(maxX, pt[0]);
    minX = Math.min(minX, pt[0]);
    maxY = Math.max(maxY, pt[1]);
    minY = Math.min(minY, pt[1]);
  }
  vec3.set(camera.center,(maxX+minX)*0.5,(maxY+minY)*0.5,bookshelf.depth*0.5);
  camera.step();
  checkHover();
  dragHover();
  vboMesh.clear(connectorVbo);
  voronoi.voronoi();
  voronoi.centroidal();
  fixShelves();
  fixShelves();
  fixShelves();
  fixShelves();
  flattenShelves();
  getConnectors();
  drawShelves();
  draw();
  gui.setNumCellsUI();
  
  document.getElementById("selected").innerHTML = getTotalWood();
}

function onDocumentDrop(event) {
  event.preventDefault();
  var file = event.dataTransfer.files[ 0 ];
  var filename = file.name;
  if(filename.substr(filename.length-4,4) == ".obj") {
    var reader = new FileReader();
    
    reader.onload = function ( event ) {
      loadObj(event.target.result.split("\n"),voronoi.mesh);
      vboMesh.clear(connectorVbo);
      getConnectors();
      download();
    };
        
    reader.readAsText( file );
  }
}

function loadObj(lines,mesh) {
  mesh.edges.length = 0;
  mesh.faces.length = 0;
  mesh.vertices.length = 0;
  var pt = vec3.create();
  var ptToEdge = [];
  
  var j;
  var tri = [];
  for(var i=0,len=lines.length;i<len;++i) {
    var tokens = lines[i].split(" ");
    if(tokens[0] == "v") {
       var v = mesh.addVertex([parseFloat(tokens[1]), parseFloat(tokens[2]), parseFloat(tokens[3])]);
    } else if(tokens[0] == "f") {
      var newFace = mesh.addFace();
      tri.length = 0;
      for(j=1;j<tokens.length;++j) {
        tri.push(parseInt(tokens[j].split("/")[0])-1);
      }
      
      var i1 = tri[tri.length-1];
      var prevEdge = null;
      for(j=0;j<tri.length;++j) {
        var i2 = tri[j];
        var newEdge1 = mesh.addEdge();
        newEdge1.v = mesh.vertices[i2];
        mesh.vertices[i2].e = newEdge1;
        newEdge1.face = newFace;
        
        findPair(newEdge1, ptToEdge,i1,i2);
        if(prevEdge != null) {
          prevEdge.next = newEdge1;
          newEdge1.prev = prevEdge;
        }
        if(j==0) {
          newFace.e = newEdge1;
        }
        i1 = i2;
        prevEdge = newEdge1;
        
      }
      prevEdge.next = newFace.e;
      newFace.e.prev = prevEdge;
      newFace.on = true;
    }
  }
  
  makeBoundaryEdges(mesh,ptToEdge);
}

function findPair(e,ptToEdge,i1,i2) {
  var ptEdge = ptToEdge[i2];
  if(ptEdge) {
    for(var i=0;i<ptEdge.length;++i) {
      var e2 = ptEdge[i];
      if(e2.v.index == i1) {
        e2.pair = e;
        e.pair = e2;
        console.log("found pair");
        return;
      }
    }
  }
  ptEdge = ptToEdge[i1];
  if(ptEdge) {
    ptEdge.push(e);
  } else {
    ptEdge = [e];
    ptToEdge[i1] = ptEdge;
  }
}

function makeBoundaryEdges(mesh,ptToEdge) {
  //add boundary edges and unsure every edge has a pair
  var numEdges = mesh.edges.length;
  for(var i=0;i<numEdges;++i) {
    var e = mesh.edges[i];
    if(e.pair == null) {
      var newEdge = mesh.addEdge();
      newEdge.pair = e;
      e.pair = newEdge;
      //hack only works for triangles (should load edges in pairs instead)
      //if prev pointer is add could use e.prev.v;
      newEdge.v = e.prev.v;
      newEdge.v.b = true;
      var ptEdge = ptToEdge[e.v.index];
      ptEdge.push(newEdge);
    }
  }
  for(var i=numEdges;i<mesh.edges.length;++i) {
    var e = mesh.edges[i];
    var ptEdge = ptToEdge[e.v.index];
    if(ptEdge) {
      for(var j=0;j<ptEdge.length;++j) {
        var e2 = ptEdge[j];
        if(e2.face == null) {
          e.next = e2;
        }
      }
    }
  }
}

function draw() {
  //draw2d();
  draw3d();
}

function draw2d() {
  ctx.clearRect(0,0,canvas.offsetWidth,canvas.offsetHeight);
  var scaling = Math.min(canvas.offsetWidth/bookshelf.width,canvas.offsetHeight/bookshelf.height);
  ctx.save();
  ctx.scale(scaling,scaling);
  drawCells2d();
  //drawEdges2d();
  //drawTriangles2d();
  drawNodes2d();
  ctx.restore();
  
}

function drawEdges2d() {
  
  ctx.strokeStyle = "black";
  ctx.beginPath();
  for(var i=0;i<voronoi.triangles.length;++i) {
    var tri = voronoi.triangles[i];
    if(tri.interior_) {
      if(tri.neighbors_[0] && tri.neighbors_[0].interior_) {
        ctx.moveTo(tri.circumcenter[0],tri.circumcenter[1]);
        ctx.lineTo(tri.neighbors_[0].circumcenter[0],tri.neighbors_[0].circumcenter[1]);
      }
      if(tri.neighbors_[1] && tri.neighbors_[1].interior_) {
        ctx.moveTo(tri.circumcenter[0],tri.circumcenter[1]);
        ctx.lineTo(tri.neighbors_[1].circumcenter[0],tri.neighbors_[1].circumcenter[1]);        
      }
      if(tri.neighbors_[2] && tri.neighbors_[2].interior_) {
        ctx.moveTo(tri.circumcenter[0],tri.circumcenter[1]);
        ctx.lineTo(tri.neighbors_[2].circumcenter[0],tri.neighbors_[2].circumcenter[1]);        
      }
    }
  }
  ctx.stroke();
}

function drawTriangles2d() {
  
  ctx.strokeStyle = "black";
  for(var i=0;i<voronoi.triangles.length;++i) {
  ctx.beginPath();
    var tri = voronoi.triangles[i];
    if(tri.new1)   ctx.strokeStyle = "red";
    else if(tri.new2)   ctx.strokeStyle = "green";
    else ctx.strokeStyle = "black";
    
    ctx.moveTo(tri.points_[0].x,tri.points_[0].y);
    ctx.lineTo(tri.points_[1].x,tri.points_[1].y);
    ctx.lineTo(tri.points_[2].x,tri.points_[2].y);
    ctx.lineTo(tri.points_[0].x,tri.points_[0].y);

    ctx.stroke();
  }
}

function drawCells2d() {
  
  ctx.strokeStyle = "black";
  /*
  var v;
  for(var i=0;i<voronoi.pts.length;++i) {
    var pt = voronoi.pts[i];
    ctx.beginPath();
    v = pt.cell[0];
    ctx.moveTo(v[0],v[1]);
    for(var j=1;j<pt.cell.length;++j) {
      v = pt.cell[j];
      ctx.lineTo(v[0],v[1]);
    }
    ctx.closePath();
    ctx.stroke();
  }
  */
  for(var i=0;i<voronoi.mesh.faces.length;++i) {
    var f = voronoi.mesh.faces[i];
    if(f.on) {
      var e = f.e;
      var startE = e;
      ctx.beginPath();
      
      ctx.moveTo(e.v.pos[0],e.v.pos[1]);
      e = e.next;
      do {
        ctx.lineTo(e.v.pos[0],e.v.pos[1]);
        e = e.next;
      } while(e != startE);
      ctx.closePath();
      ctx.stroke();
    }
  }
}

function drawNodes2d() {
  ctx.fillStyle = "black";
  for(var i=0;i<voronoi.pts.length;++i) {
    var pt = voronoi.pts[i];
    if(selectedPt == i) {
      ctx.fillStyle = "red";
    } else if(pt.boundary) {
      ctx.fillStyle = "blue";        
    } else {
      ctx.fillStyle = "black";    
    }
    ctx.beginPath();
    ctx.arc(pt.x,pt.y,5,0,2*Math.PI);
    ctx.fill();
    
  }
  
}

function drawShelves() {
  vboMesh.clear(shelfVbo);
  for(var i=0;i<voronoi.mesh.edges.length;++i) {
    var e = voronoi.mesh.edges[i];
    if(e.v.e) {
      if(e.v.index < e.pair.v.index) {
        drawShelf(shelfVbo,e);
      }
    }
  }
  vboMesh.buffer(shelfVbo);
}

var drawShelf = (function() {
  var center = vec3.create();
  var dir = vec3.create();
  var perp = vec3.create();
  var pts = new Array(8);
  for(var i=0;i<pts.length;++i) pts[i] = vec3.create();
  return function drawShelf(vboOut, e) {
    var length = connector.getShelfLength(e);
    vec3.add(center,e.v.pos,e.pair.v.pos);
    vec3.scale(center,center,0.5);
    vec3.sub(dir,e.v.pos,e.pair.v.pos);
    vec3.normalize(dir,dir);
    vec3.set(perp,dir[1],-dir[0],0);

    //top
    vec3.scaleAndAdd(pts[0],center,dir,length*0.5);
    vec3.scaleAndAdd(pts[0],pts[0],perp,bookshelf.woodWidth*0.5);
    vec3.copy(pts[1],pts[0]);
    pts[1][2] = bookshelf.depth;
    
    vec3.scaleAndAdd(pts[3],center,dir,-length*0.5);
    vec3.scaleAndAdd(pts[3],pts[3],perp,bookshelf.woodWidth*0.5);
    vec3.copy(pts[2],pts[3]);
    pts[2][2] = bookshelf.depth;

    addQuadFaceTex(vboOut,pts[0],pts[1],pts[2],pts[3],[length,0],[length,bookshelf.depth],[0,bookshelf.depth],[0,0],perp);
    //bottom
    vec3.negate(perp,perp);

    vec3.scaleAndAdd(pts[4],center,dir,length*0.5);
    vec3.scaleAndAdd(pts[4],pts[4],perp,bookshelf.woodWidth*0.5);
    vec3.copy(pts[5],pts[4]);
    pts[5][2] = bookshelf.depth;
    
    vec3.scaleAndAdd(pts[7],center,dir,-length*0.5);
    vec3.scaleAndAdd(pts[7],pts[7],perp,bookshelf.woodWidth*0.5);
    vec3.copy(pts[6],pts[7]);
    pts[6][2] = bookshelf.depth;
    
    addQuadFaceTex(vboOut,pts[4],pts[5],pts[6],pts[7],[length,0],[length,bookshelf.depth],[0,bookshelf.depth],[0,0],perp);
    
    //sides
    addQuadFaceTex(vboOut,pts[1],pts[5],pts[6],pts[2],[length,0],[length,1],[0,1],[0,0],[0,0,1]);
    addQuadFaceTex(vboOut,pts[0],pts[4],pts[7],pts[3],[length,0],[length,1],[0,1],[0,0],[0,0,-1]);

    addQuadFaceTex(vboOut,pts[0],pts[1],pts[5],pts[4],[length,0],[length,1],[0,1],[0,0],dir);
    vec3.negate(dir,dir);
    addQuadFaceTex(vboOut,pts[3],pts[2],pts[6],pts[7],[length,0],[length,1],[0,1],[0,0],dir);
    
  }
})();

function addQuadFaceTex(vboOut,p1,p2,p3,p4,t1,t2,t3,t4,n) {
  vboMesh.addVertex(vboOut,p1,n);
  vboMesh.addTexCoord(vboOut,t1);
  vboMesh.addVertex(vboOut,p2,n);
  vboMesh.addTexCoord(vboOut,t2);
  vboMesh.addVertex(vboOut,p3,n);
  vboMesh.addTexCoord(vboOut,t3);
  
  vboMesh.addVertex(vboOut,p1,n);
  vboMesh.addTexCoord(vboOut,t1);
  vboMesh.addVertex(vboOut,p3,n);
  vboMesh.addTexCoord(vboOut,t3);
  vboMesh.addVertex(vboOut,p4,n);
  vboMesh.addTexCoord(vboOut,t4);
  
  
}

function draw3d() {
  gl.viewport(0,0,1600,800);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  if(!colorShader.isReady || !phongShader.isReady) return;
  //draw2dGL();
  gl.viewport(400,0,800,800);
  
  phongShader.begin();
  mat4.identity(mvMatrix);
  var maxDim = voronoi.boundary.reduce(function(prev,curr, index, array) {return Math.max(prev, curr[0], curr[1]);},0)*0.5+100;
  mat4.ortho(pMatrix,-maxDim,maxDim,maxDim,-maxDim,-3000,3000);
  camera.feed(mvMatrix);
  //set color
  phongShader.uniforms.ambientLightingColor.set([.3,.3,.3]);
  phongShader.uniforms.directionalDiffuseColor.set([.7,.7,.7]);//.7
  var lightingDir = [.3,.3,.8];//[.3,.3,.8];
  vec3.normalize(lightingDir,lightingDir);
  phongShader.uniforms.lightingDirection.set(lightingDir);
  phongShader.uniforms.materialShininess.set(8);
  
  //set matrices
  mat3.normalFromMat4(nMatrix,mvMatrix);
  phongShader.uniforms.mvMatrix.set(mvMatrix);
  phongShader.uniforms.nMatrix.set(nMatrix);
  phongShader.uniforms.pMatrix.set(pMatrix);
    
  phongShader.uniforms.matColor.set([0,0,0,1]);
  phongShader.attribs.vertexPosition.set(circleVbo.vertexBuffer);
  phongShader.attribs.vertexNormal.disable();
  phongShader.attribs.vertexPosition.set(circleVbo.vertexBuffer);
  for(var i=0;i<voronoi.pts.length;++i) {
    var pt = voronoi.pts[i];
    if(selectedPt == i) {
      phongShader.uniforms.matColor.set([1,0,0,.5]);
    } else if(pt.boundary) {
      phongShader.uniforms.matColor.set([0,0,1,.5]);
    } else {
      phongShader.uniforms.matColor.set([0,0,0,.5]);
    }
    mat4.translate(mvMatrix,mvMatrix,[pt.x,pt.y,0]);
    phongShader.uniforms.mvMatrix.set(mvMatrix);
    gl.drawArrays(gl.TRIANGLE_FAN,0,circleVbo.numVertices);
    mat4.translate(mvMatrix,mvMatrix,[-pt.x,-pt.y,0]);
  }
  phongShader.attribs.vertexNormal.enable();
  phongShader.uniforms.mvMatrix.set(mvMatrix);
  
  //draw shelves
  //wood color
  phongShader.uniforms.matColor.set([229.0/255,204.0/255,164.0/255,1]);
  //wood is not shiny
  phongShader.uniforms.materialShininess.set(1);
  phongShader.attribs.vertexNormal.set(shelfVbo.normalBuffer);
  phongShader.attribs.vertexPosition.set(shelfVbo.vertexBuffer);
  gl.drawArrays(gl.TRIANGLES,0,shelfVbo.numVertices);

  phongShader.uniforms.matColor.set([colorInfo.r/255,colorInfo.g/255,colorInfo.b/255,1]);

  mat4.scale(mvMatrix,mvMatrix,[1,1,-1]);
  mat3.normalFromMat4(nMatrix,mvMatrix);
  phongShader.uniforms.mvMatrix.set(mvMatrix);
  phongShader.uniforms.nMatrix.set(nMatrix);
  
  //make voronoi edges vbo
  //voronoiToEdgeVBO();
  
  //draw edges vbo
  //colorShader.attribs.vertexPosition.set(voronoiEdges.vertexBuffer);
  //gl.drawArrays(gl.LINES, 0,voronoiEdges.numVertices);

  //draw connectors
  phongShader.attribs.vertexPosition.set(connectorVbo.vertexBuffer);
  phongShader.attribs.vertexNormal.set(connectorVbo.normalBuffer);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,connectorVbo.indexBuffer);
  gl.drawElements(gl.TRIANGLES,connectorVbo.numIndices,gl.UNSIGNED_INT,0);
  
  mat4.scale(mvMatrix,mvMatrix,[1,1,-1]);
  mat4.translate(mvMatrix,mvMatrix,[0,0,bookshelf.depth]);
  mat3.normalFromMat4(nMatrix,mvMatrix);
  phongShader.uniforms.mvMatrix.set(mvMatrix);
  phongShader.uniforms.nMatrix.set(nMatrix);  
  gl.drawElements(gl.TRIANGLES,connectorVbo.numIndices,gl.UNSIGNED_INT,0);  
  
  phongShader.end();  
}

function draw2dGL() {
  gl.viewport(0,0,800,800);
  
  colorShader.begin();
  mat4.identity(mvMatrix);
  var scaling = Math.min(window2dWidth/bookshelf.width,canvas.offsetHeight/bookshelf.height);
  mat4.scale(mvMatrix,mvMatrix,[scaling,scaling,scaling]);
  mat4.ortho(pMatrix,0,window2dWidth,canvas.offsetHeight,0,-2000,2000);
  
  //set color
  colorShader.uniforms.matColor.set([0,0,0,1]);
  //set matrices
  colorShader.uniforms.mvMatrix.set(mvMatrix);
  colorShader.uniforms.pMatrix.set(pMatrix);
  
  //make voronoi edges vbo
  //voronoiToEdgeVBO();
  
  //draw edges vbo
  //colorShader.attribs.vertexPosition.set(voronoiEdges.vertexBuffer);
  //gl.drawArrays(gl.LINES, 0,voronoiEdges.numVertices);

  //draw connectors
  colorShader.attribs.vertexPosition.set(connectorVbo.vertexBuffer);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,connectorVbo.indexBuffer);
  gl.drawElements(gl.TRIANGLES,connectorVbo.numIndices,gl.UNSIGNED_INT,0);
  
  //draw shelves
  colorShader.attribs.vertexPosition.set(shelfVbo.vertexBuffer);
  gl.drawArrays(gl.TRIANGLES,0,shelfVbo.numVertices);
  
  
  colorShader.end();
}

//put voronoi edges into a vbo
function voronoiToEdgeVBO() {
  vboMesh.clear(voronoiEdges);
  for(var i=0;i<voronoi.triangles.length;++i) {
    var tri = voronoi.triangles[i];
    if(false || tri.interior_) {
      if(tri.neighbors_[0] && (false || tri.neighbors_[0].interior_)) {
        vboMesh.addVertex(voronoiEdges,tri.circumcenter);
        vboMesh.addVertex(voronoiEdges,tri.neighbors_[0].circumcenter);
      }
      if(tri.neighbors_[1] && (false || tri.neighbors_[1].interior_)) {
        vboMesh.addVertex(voronoiEdges,tri.circumcenter);
        vboMesh.addVertex(voronoiEdges,tri.neighbors_[1].circumcenter);
      }
      if(tri.neighbors_[2] && (false || tri.neighbors_[2].interior_)) {
        vboMesh.addVertex(voronoiEdges,tri.circumcenter);
        vboMesh.addVertex(voronoiEdges,tri.neighbors_[2].circumcenter);
      }
    }
  }
  vboMesh.buffer(voronoiEdges);
}

function getConnectors() {
  //for(var i=0;i<voronoi.triangles.length;++i) {
  //  var tri = voronoi.triangles[i];
  //  if(tri.interior_) {
  //    if(tri.neighbors_[0] && tri.neighbors_[0].interior_ &&
  //      tri.neighbors_[1] && tri.neighbors_[1].interior_ &&
  //      tri.neighbors_[2] && tri.neighbors_[2].interior_) {
  //      connector.createConnector(tri,connectorVbo);
  //    }
  //  }
  //}
  //label edges
  var label = 0;
  for(var i=0;i<voronoi.mesh.edges.length;++i) {
    var e = voronoi.mesh.edges[i];
    if(e.v.e) {
      if(typeof e.info.label == "undefined") {
        e.info.label = label++;
        e.pair.info.label = e.info.label;
      }
    }
  }
  
  for(var i=0;i<voronoi.mesh.vertices.length;++i) {
    var v = voronoi.mesh.vertices[i];
    if(v.e) {
      connector.createConnector(v,connectorVbo);
    }
  }
  vboMesh.computeSmoothNormals(connectorVbo);
  vboMesh.buffer(connectorVbo);
}

function fixShelves() {
  var dir = vec2.create();
  for(var i=0;i<voronoi.mesh.edges.length;++i) {
    var e = voronoi.mesh.edges[i];
    if(e.v.e != null) {
      var v1 = e.v;
      var v2 = e.pair.v;
      //check length;
      var len = vec2.sqrDist(v1.pos,v2.pos);
      //collapse edge
      if(len < minimumShelf*minimumShelf*0.04) {
        voronoi.mesh.simpleCollapse(e);
        //i--;
      //expand
      } else if(len < minimumShelf*minimumShelf*.95) {
        vec2.sub(dir, v2.pos, v1.pos);
        //vec2.normalize(dir,dir);
        len = Math.sqrt(len);
        vec2.scale(dir, dir, (minimumShelf-len)*0.5/len);
        if(!v2.b) {
          vec2.scaleAndAdd(v2.pos,v2.pos,dir,.5);
        }
        if(!v1.b) {
          vec2.scaleAndAdd(v1.pos,v1.pos,dir,-.5);
        }
      }
    }
  }
}

function flattenShelves() {
  var iterations = 2;
  var dir = vec2.create();
  var mid = vec2.create();
  sinFlattenAngle = Math.sin(bookshelf.flattenAngle);
  for(var i=0;i<iterations;++i) {
    for(var j=0;j<voronoi.mesh.edges.length;++j) {
      var e = voronoi.mesh.edges[j];
      if(e.v.e != null) {
        var v1 = e.v;
        var v2 = e.pair.v;
        vec2.sub(dir,v2.pos,v1.pos);
        var len = vec2.len(dir);
        vec2.scale(dir,dir,1.0/len);
        
        if(Math.abs(dir[1]) < sinFlattenAngle) {
          vec2.add(mid,v1.pos,v2.pos);
          vec2.scale(mid,mid,0.5);
          //v1.pos[1] = newY;
          //v2.pos[1] = newY;
          if(dir[0] > 0) {
            vec2.set(v1.pos, -len*0.5+mid[0], mid[1]);
            vec2.set(v2.pos, len*0.5+mid[0], mid[1]);
          } else {
            vec2.set(v1.pos, len*0.5+mid[0], mid[1]);
            vec2.set(v2.pos, -len*0.5+mid[0], mid[1]);          
          }
        }        
      }
    }
  }
}

function initVoronoi() {
  voronoi.setDimensions(bookshelf.width,bookshelf.height);
  voronoi.init();
  voronoi.reset();
  voronoi.voronoi();
}

function save() {
  
  var saveme = {};
  saveme.boundary = voronoi.boundary;
  saveme.pts = [];
  for(var i=0;i<voronoi.pts.length;++i) {
    var pt = voronoi.pts[i];
    saveme.pts.push(pt.x);
    saveme.pts.push(pt.y);
  }
  saveme.woodWidth = bookshelf.woodWidth;
  saveme.tolerance = connector.getTolerance();
  
  var xhr = new XMLHttpRequest();
	xhr.open("POST", "api.php",true); 
	var data = new FormData();
	data.append("action", "save");
	data.append("designData", JSON.stringify(saveme));
  /*
	//var imageData = gl.getImageData(canvas2d.offsetWidth,0,canvas2d.offsetWidth,canvas2d.offsetHeight);
	var pixels = new Uint8Array(canvas2d.offsetWidth*canvas2d.offsetHeight*4);
	gl.readPixels(canvas2d.offsetWidth,0,canvas2d.offsetWidth,canvas2d.offsetHeight,gl.RGBA, gl.UNSIGNED_BYTE,pixels);
	var imageData = context.createImageData(canvas2d.offsetWidth,canvas2d.offsetHeight);
	for(var i=0,j;i<canvas2d.offsetWidth;++i) {
		for(j=0;j<canvas2d.offsetHeight;++j) {
			var index1 = (canvas2d.offsetWidth*j+i)*4;
			var index2 = (canvas2d.offsetWidth*(canvas2d.offsetHeight-1-j)+i)*4;
			imageData.data[index1] = pixels[index2];
			imageData.data[index1+1] = pixels[index2+1];
			imageData.data[index1+2] = pixels[index2+2];
			imageData.data[index1+3] = pixels[index2+3];
		}
	}
	context.putImageData(imageData,0,0);
	
	data.append("imageData", (canvas2d.toDataURL("image/png").split(","))[1]);
  */
  
	//need to do something on error condition
	xhr.onreadystatechange = function() {
		if(xhr.readyState == 4 && xhr.status == 200) {
			var response =  xhr.responseText;
			var stuff = response.split(",");
			if(response == "error") {
        return;
      }
      var lastSaveId = stuff[0];
			alert("saved id: " + lastSaveId);
		}
	};
	xhr.send(data);
}

function load(id) {
  var xhr = new XMLHttpRequest();
	xhr.open("POST", "api.php",true); 
	var data = new FormData();
	data.append("action", "load");
  data.append("id", id);
  xhr.onreadystatechange = function() {
		if(xhr.readyState == 4 && xhr.status == 200) {
			var response =  xhr.responseText;
			if(response == "error") {
        return;
      }
      loadJSON(response);
		}
	};
	xhr.send(data);
}

function loadJSON(str) {
  var loadObj = JSON.parse(str);
  voronoi.boundary.length = 0;
  var maxX = 0, maxY = 0;
  for(var i=0;i<loadObj.boundary.length;++i) {
    voronoi.boundary.push(loadObj.boundary[i]);
    maxX = Math.max(maxX, loadObj.boundary[i][0]);
    maxY = Math.max(maxY, loadObj.boundary[i][1]);
  }
  bookshelf.width = maxX;
  bookshelf.height = maxY;
  voronoi.pts.length = 0;
  for(var i=0;i<loadObj.pts.length;) {
    var x = loadObj.pts[i++];
    var y = loadObj.pts[i++];
    voronoi.pts.push({x:x,y:y,on:true});
  }
  voronoi.updateOutsidePts();
  bookshelf.woodWidth = loadObj.woodWidth;
  connector.setTolerance(loadObj.tolerance);
}

function getUrlVars() {
  var vars = {};
  var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
  vars[key] = value;
  });
  return vars;
}


function keyPress(event) {
  switch(event.which) {
    case "D".charCodeAt(0):
      download();
      break;
  }
}

/*function setupGui() {
  var widthSlide = document.getElementById("width");
  widthSlide.oninput = function() {bookshelf.setWidth(parseFloat(this.value));}
  var heightSlide = document.getElementById("height");
  heightSlide.oninput = function() {setHeight(parseFloat(this.value));}
}*/

function getTotalWood() {
  var lens = [];
  var accuracy = 3.175;
  for(var i=0;i<voronoi.mesh.edges.length;++i) {
    var e = voronoi.mesh.edges[i];
    if(e.v.e) {
      var len = vec2.dist(e.v.pos,e.pair.v.pos)-connector.shelfOffset*2;
      len /= accuracy;
      len = Math.floor(len);
      len *= accuracy;
      lens[e.info.label] = len;
    }
  }
  var totalLen = 0;
  for(var i=0;i<lens.length;++i) {
    if(lens[i]) {
      totalLen += (lens[i]/25.4);
    }
  }
  return totalLen*bookshelf.depth/25.4;
}

function download() {
  var lenStr = "";
  var lens = [];
  var accuracy = 3.175;
  for(var i=0;i<voronoi.mesh.edges.length;++i) {
    var e = voronoi.mesh.edges[i];
    if(e.v.e) {
      var len = vec2.dist(e.v.pos,e.pair.v.pos)-connector.shelfOffset*2;
      len /= accuracy;
      len = Math.floor(len);
      len *= accuracy;
      lens[e.info.label] = len;
    }
  }
  var totalLen = 0;
  for(var i=0;i<lens.length;++i) {
    if(lens[i]) {
      lenStr += i + " " + (lens[i]/25.4).toFixed(3) + "\n";
      totalLen += (lens[i]/25.4);
    }
  }
  
  console.log(totalLen);
  
  var a = document.createElement('a');
  var blob = new Blob([lenStr]);
  a.href = window.URL.createObjectURL(blob);
  a.download = "lengths"+new Date().toISOString().substring(0,16)+".txt";
  a.click();
  
  downloadVboAsSTL(connectorVbo);
  downloadDesignMesh();
}

function downloadDesignMesh() {
  var objStr = "";
  for(var i=0;i<voronoi.mesh.vertices.length;++i) {
    var v = voronoi.mesh.vertices[i];
    objStr += "v " + v.pos[0] + " " + v.pos[1] + " " + v.pos[2] + "\n";
  }
  
  for(var i=0;i<voronoi.mesh.faces.length;++i) {
    var f = voronoi.mesh.faces[i];
    objStr += "f";
    var startE = f.e;
    var e = startE;
    do {
      objStr += " " + (e.v.index+1);
      e = e.next;
    } while(e != startE);
    objStr += "\n";
  }
  var a = document.createElement('a');
  var blob = new Blob([objStr]);
  a.href = window.URL.createObjectURL(blob);
  a.download = "bookshelfMesh"+new Date().toISOString().substring(0,16)+".txt";
  a.click();
}

/*
  convert point on screen to point on model
  
  @param float x
    mouse position in x
  @param float y
    mouse position in y
  @out array out
    output point in real space
*/
var screenToReal = (function() {
  var pt1 = vec3.create();
  var dir = vec3.create();
  var planeDir = vec3.create();
  var ray = vec4.create();
  var invMatrix = mat4.create();
  var tMat = mat4.create();
  var ray2 = vec4.create();
  var up = vec3.clone([0,0,1]);
  return function screenToReal(x,y,out) {
    //get camera transform
    mat4.identity(mvMatrix);
    camera.feed(mvMatrix);

    vec4.set(ray, 2.0*(x-400.0)/800.0-1.0, 1.0-2.0*y/800.0,-0.3,1.0);
    vec4.set(ray2, 2.0*(x-400.0)/800.0-1.0, 1.0-2.0*y/800.0,0.3,1.0);
    mat4.mul(tMat,pMatrix,mvMatrix);
    mat4.invert(invMatrix, tMat);
    vec4.transformMat4(ray, ray, invMatrix);
    vec4.transformMat4(ray2, ray2, invMatrix);

    //ray[2] = -1.0;
    //ray[3] = 0.0;
    //ray2[2] = -1.0;
    //ray2[3] = 0.0;
    
    
    //mat4.invert(invMatrix,mvMatrix);
    //vec4.transformMat4(ray, ray, invMatrix);
    //vec4.transformMat4(ray2, ray2, invMatrix);
    vec3.sub(dir,ray,ray2);
    vec3.normalize(dir,dir);
    vec2.scaleAndAdd(out,ray2,dir,(-ray2[2])/dir[2]);
    
    //var scaling = Math.min(canvas.offsetWidth/bookshelf.width,canvas.offsetHeight/bookshelf.height);
    //out[0] = x/scaling;
    //out[1] = y/scaling;
  
  }
})();

var realToScreen = (function() {
  var pt = vec3.create();
  var tMat = mat4.create();
  return function realToScreen(x,y,out) {
    //get camera transform
    mat4.identity(mvMatrix);
    camera.feed(mvMatrix);

    mat4.mul(tMat,pMatrix,mvMatrix);

    vec3.set(pt,x,y,0);
    vec3.transformMat4(pt,pt,tMat);
    //y = 1.0-2.0*y/800.0
    out[0] = (pt[0]+1.0)*400+400;
    out[1] = (pt[1]-1.0)*-400;
    //var scaling = Math.min(canvas.offsetWidth/bookshelf.width,canvas.offsetHeight/bookshelf.height);
    //out[0] = x*scaling;
    //out[1] = y*scaling;
  };
})();

pointer.mouseMoved = function() {
  checkHover();
  dragHover();
}

var dragHover = (function() {
  var coord = vec2.create();
  return function dragHover() {
    if(pointer.isMouseDown && selectedPt > -1) {
      var pt = voronoi.pts[selectedPt];
      screenToReal(pointer.mouseX,pointer.mouseY,coord);
      pt.x = coord[0];
      pt.y = coord[1];
    }
  }
  
})();

var checkHover = (function() {
  var coord = vec2.create();
  return function checkHover() {
    if(!pointer.isMouseDown) {
      selectedPt = -1;
      for(var i=0;i<voronoi.pts.length;++i) {
        var pt = voronoi.pts[i];
        realToScreen(pt.x,pt.y,coord);
        var dx = pointer.mouseX-coord[0];
        var dy = pointer.mouseY-coord[1];
        if(dx*dx+dy*dy < 15*15) {
          selectedPt = i;
        //console.log(dx + " " + dy);
          
        }
      }
    }
  }
})();

pointer.mouseDragged = (function() {
  var coord = vec2.create();
  return function mouseDragged() {
    //if(pointer.mouseX > window2dWidth) {
      //camera.mouseDragged(pointer.mouseX-pointer.pmouseX,pointer.mouseY-pointer.pmouseY,pointer.mouseX,pointer.mouseY,pointer.mouseButton);
    //}
  }
})();

pointer.mouseClicked = (function() {
  var coords = vec2.create();
  return function mouseClicked(event) {
    //if(pointer.mouseX < window2dWidth) {
      if(selectedPt == -1 && pointer.mouseButton == 1) {
        var pt = {x:0,y:0,on:true};
        screenToReal(pointer.mouseX,pointer.mouseY,coords);
        pt.x = coords[0];
        pt.y = coords[1];
        voronoi.pts.push(pt);
        selectedPt = voronoi.pts.length-1;
      } else {
        if(pointer.mouseButton == 3) {
          voronoi.pts.splice(selectedPt,1);
          selectedPt = -1;
        } else if(pointer.mouseButton == 1) {
          if(event.ctrlKey) {
            voronoi.pts[selectedPt].on = !voronoi.pts[selectedPt].on;

          }
        }
      //}
  
	}
  }
})();

function downloadVboAsSTL(vbo) {
  var triCount = vbo.numIndices/3;
  var buffer = new ArrayBuffer(80+4+50*triCount);
  var dataView = new DataView(buffer);
  dataView.offset = 80;
  setDVUint32(dataView, triCount);
  
  saveVBOBinary(vbo,dataView);

  var a = document.createElement('a');
  var blob = new Blob([buffer], {'type':'application\/octet-stream'});
  a.href = window.URL.createObjectURL(blob);
  a.download = "connectors"+new Date().toISOString().substring(0,16)+".stl";
  a.click();
}

function saveVBOBinary(vbo, dataView) {
  for(var i=0;i<vbo.numIndices;) {
    setDVFloat(dataView,0.0);
    setDVFloat(dataView,0.0);
    setDVFloat(dataView,0.0);
    var i1 = vbo.indexData[i++]*3;
    var i2 = vbo.indexData[i++]*3;
    var i3 = vbo.indexData[i++]*3;

    setDVFloat(dataView,vbo.vertexData[i1]);
    setDVFloat(dataView,vbo.vertexData[i1+1]);
    setDVFloat(dataView,vbo.vertexData[i1+2]);

    setDVFloat(dataView,vbo.vertexData[i2]);
    setDVFloat(dataView,vbo.vertexData[i2+1]);
    setDVFloat(dataView,vbo.vertexData[i2+2]);

    setDVFloat(dataView,vbo.vertexData[i3]);
    setDVFloat(dataView,vbo.vertexData[i3+1]);
    setDVFloat(dataView,vbo.vertexData[i3+2]);
    
    setDVUint16(dataView,0);
  }
}

function setDVFloat(dv, val) {
  dv.setFloat32(dv.offset,val,true);
  dv.offset += 4;
}

function setDVUint16(dv, val) {
  dv.setUint16(dv.offset,val,true);
  dv.offset += 2;
}

function setDVUint32(dv, val) {
  dv.setUint32(dv.offset,val,true);
  dv.offset += 4;
}

function setConnectorColor(c) {
	colorInfo = c;
}

},{"../js/gl-matrix-min.js":14,"../js/glShader.js":15,"../js/pointer.js":17,"./bookshelf.js":1,"./camera.js":2,"./connector.js":4,"./glUtils.js":5,"./gui.js":6,"./poly2tri.js":10,"./vboMesh.js":12,"./voronoi.js":13}],8:[function(require,module,exports){
/**
 * Tween.js - Licensed under the MIT license
 * https://github.com/sole/tween.js
 * ----------------------------------------------
 *
 * See https://github.com/sole/tween.js/graphs/contributors for the full list of contributors.
 * Thank you all, you're awesome!
 */

// Date.now shim for (ahem) Internet Explo(d|r)er
if ( Date.now === undefined ) {

	Date.now = function () {

		return new Date().valueOf();

	};

}

var TWEEN = TWEEN || ( function () {

	var _tweens = [];

	return {

		REVISION: '14',

		getAll: function () {

			return _tweens;

		},

		removeAll: function () {

			_tweens = [];

		},

		add: function ( tween ) {

			_tweens.push( tween );

		},

		remove: function ( tween ) {

			var i = _tweens.indexOf( tween );

			if ( i !== -1 ) {

				_tweens.splice( i, 1 );

			}

		},

		update: function ( time ) {

			if ( _tweens.length === 0 ) return false;

			var i = 0;

			time = time !== undefined ? time : ( typeof window !== 'undefined' && window.performance !== undefined && window.performance.now !== undefined ? window.performance.now() : Date.now() );

			while ( i < _tweens.length ) {

				if ( _tweens[ i ].update( time ) ) {

					i++;

				} else {

					_tweens.splice( i, 1 );

				}

			}

			return true;

		}
	};

} )();

TWEEN.Tween = function ( object ) {

	var _object = object;
	var _valuesStart = {};
	var _valuesEnd = {};
	var _valuesStartRepeat = {};
	var _duration = 1000;
	var _repeat = 0;
	var _yoyo = false;
	var _isPlaying = false;
	var _reversed = false;
	var _delayTime = 0;
	var _startTime = null;
	var _easingFunction = TWEEN.Easing.Linear.None;
	var _interpolationFunction = TWEEN.Interpolation.Linear;
	var _chainedTweens = [];
	var _onStartCallback = null;
	var _onStartCallbackFired = false;
	var _onUpdateCallback = null;
	var _onCompleteCallback = null;
	var _onStopCallback = null;

	// Set all starting values present on the target object
	for ( var field in object ) {

		_valuesStart[ field ] = parseFloat(object[field], 10);

	}

	this.to = function ( properties, duration ) {

		if ( duration !== undefined ) {

			_duration = duration;

		}

		_valuesEnd = properties;

		return this;

	};

	this.start = function ( time ) {

		TWEEN.add( this );

		_isPlaying = true;

		_onStartCallbackFired = false;

		_startTime = time !== undefined ? time : ( typeof window !== 'undefined' && window.performance !== undefined && window.performance.now !== undefined ? window.performance.now() : Date.now() );
		_startTime += _delayTime;

		for ( var property in _valuesEnd ) {

			// check if an Array was provided as property value
			if ( _valuesEnd[ property ] instanceof Array ) {

				if ( _valuesEnd[ property ].length === 0 ) {

					continue;

				}

				// create a local copy of the Array with the start value at the front
				_valuesEnd[ property ] = [ _object[ property ] ].concat( _valuesEnd[ property ] );

			}

			_valuesStart[ property ] = _object[ property ];

			if( ( _valuesStart[ property ] instanceof Array ) === false ) {
				_valuesStart[ property ] *= 1.0; // Ensures we're using numbers, not strings
			}

			_valuesStartRepeat[ property ] = _valuesStart[ property ] || 0;

		}

		return this;

	};

	this.stop = function () {

		if ( !_isPlaying ) {
			return this;
		}

		TWEEN.remove( this );
		_isPlaying = false;

		if ( _onStopCallback !== null ) {

			_onStopCallback.call( _object );

		}

		this.stopChainedTweens();
		return this;

	};

	this.stopChainedTweens = function () {

		for ( var i = 0, numChainedTweens = _chainedTweens.length; i < numChainedTweens; i++ ) {

			_chainedTweens[ i ].stop();

		}

	};

	this.delay = function ( amount ) {

		_delayTime = amount;
		return this;

	};

	this.repeat = function ( times ) {

		_repeat = times;
		return this;

	};

	this.yoyo = function( yoyo ) {

		_yoyo = yoyo;
		return this;

	};


	this.easing = function ( easing ) {

		_easingFunction = easing;
		return this;

	};

	this.interpolation = function ( interpolation ) {

		_interpolationFunction = interpolation;
		return this;

	};

	this.chain = function () {

		_chainedTweens = arguments;
		return this;

	};

	this.onStart = function ( callback ) {

		_onStartCallback = callback;
		return this;

	};

	this.onUpdate = function ( callback ) {

		_onUpdateCallback = callback;
		return this;

	};

	this.onComplete = function ( callback ) {

		_onCompleteCallback = callback;
		return this;

	};

	this.onStop = function ( callback ) {

		_onStopCallback = callback;
		return this;

	};

	this.update = function ( time ) {

		var property;

		if ( time < _startTime ) {

			return true;

		}

		if ( _onStartCallbackFired === false ) {

			if ( _onStartCallback !== null ) {

				_onStartCallback.call( _object );

			}

			_onStartCallbackFired = true;

		}

		var elapsed = ( time - _startTime ) / _duration;
		elapsed = elapsed > 1 ? 1 : elapsed;

		var value = _easingFunction( elapsed );

		for ( property in _valuesEnd ) {

			var start = _valuesStart[ property ] || 0;
			var end = _valuesEnd[ property ];

			if ( end instanceof Array ) {

				_object[ property ] = _interpolationFunction( end, value );

			} else {

				// Parses relative end values with start as base (e.g.: +10, -3)
				if ( typeof(end) === "string" ) {
					end = start + parseFloat(end, 10);
				}

				// protect against non numeric properties.
				if ( typeof(end) === "number" ) {
					_object[ property ] = start + ( end - start ) * value;
				}

			}

		}

		if ( _onUpdateCallback !== null ) {

			_onUpdateCallback.call( _object, value );

		}

		if ( elapsed == 1 ) {

			if ( _repeat > 0 ) {

				if( isFinite( _repeat ) ) {
					_repeat--;
				}

				// reassign starting values, restart by making startTime = now
				for( property in _valuesStartRepeat ) {

					if ( typeof( _valuesEnd[ property ] ) === "string" ) {
						_valuesStartRepeat[ property ] = _valuesStartRepeat[ property ] + parseFloat(_valuesEnd[ property ], 10);
					}

					if (_yoyo) {
						var tmp = _valuesStartRepeat[ property ];
						_valuesStartRepeat[ property ] = _valuesEnd[ property ];
						_valuesEnd[ property ] = tmp;
					}

					_valuesStart[ property ] = _valuesStartRepeat[ property ];

				}

				if (_yoyo) {
					_reversed = !_reversed;
				}

				_startTime = time + _delayTime;

				return true;

			} else {

				if ( _onCompleteCallback !== null ) {

					_onCompleteCallback.call( _object );

				}

				for ( var i = 0, numChainedTweens = _chainedTweens.length; i < numChainedTweens; i++ ) {

					_chainedTweens[ i ].start( time );

				}

				return false;

			}

		}

		return true;

	};

};


TWEEN.Easing = {

	Linear: {

		None: function ( k ) {

			return k;

		}

	},

	Quadratic: {

		In: function ( k ) {

			return k * k;

		},

		Out: function ( k ) {

			return k * ( 2 - k );

		},

		InOut: function ( k ) {

			if ( ( k *= 2 ) < 1 ) return 0.5 * k * k;
			return - 0.5 * ( --k * ( k - 2 ) - 1 );

		}

	},

	Cubic: {

		In: function ( k ) {

			return k * k * k;

		},

		Out: function ( k ) {

			return --k * k * k + 1;

		},

		InOut: function ( k ) {

			if ( ( k *= 2 ) < 1 ) return 0.5 * k * k * k;
			return 0.5 * ( ( k -= 2 ) * k * k + 2 );

		}

	},

	Quartic: {

		In: function ( k ) {

			return k * k * k * k;

		},

		Out: function ( k ) {

			return 1 - ( --k * k * k * k );

		},

		InOut: function ( k ) {

			if ( ( k *= 2 ) < 1) return 0.5 * k * k * k * k;
			return - 0.5 * ( ( k -= 2 ) * k * k * k - 2 );

		}

	},

	Quintic: {

		In: function ( k ) {

			return k * k * k * k * k;

		},

		Out: function ( k ) {

			return --k * k * k * k * k + 1;

		},

		InOut: function ( k ) {

			if ( ( k *= 2 ) < 1 ) return 0.5 * k * k * k * k * k;
			return 0.5 * ( ( k -= 2 ) * k * k * k * k + 2 );

		}

	},

	Sinusoidal: {

		In: function ( k ) {

			return 1 - Math.cos( k * Math.PI / 2 );

		},

		Out: function ( k ) {

			return Math.sin( k * Math.PI / 2 );

		},

		InOut: function ( k ) {

			return 0.5 * ( 1 - Math.cos( Math.PI * k ) );

		}

	},

	Exponential: {

		In: function ( k ) {

			return k === 0 ? 0 : Math.pow( 1024, k - 1 );

		},

		Out: function ( k ) {

			return k === 1 ? 1 : 1 - Math.pow( 2, - 10 * k );

		},

		InOut: function ( k ) {

			if ( k === 0 ) return 0;
			if ( k === 1 ) return 1;
			if ( ( k *= 2 ) < 1 ) return 0.5 * Math.pow( 1024, k - 1 );
			return 0.5 * ( - Math.pow( 2, - 10 * ( k - 1 ) ) + 2 );

		}

	},

	Circular: {

		In: function ( k ) {

			return 1 - Math.sqrt( 1 - k * k );

		},

		Out: function ( k ) {

			return Math.sqrt( 1 - ( --k * k ) );

		},

		InOut: function ( k ) {

			if ( ( k *= 2 ) < 1) return - 0.5 * ( Math.sqrt( 1 - k * k) - 1);
			return 0.5 * ( Math.sqrt( 1 - ( k -= 2) * k) + 1);

		}

	},

	Elastic: {

		In: function ( k ) {

			var s, a = 0.1, p = 0.4;
			if ( k === 0 ) return 0;
			if ( k === 1 ) return 1;
			if ( !a || a < 1 ) { a = 1; s = p / 4; }
			else s = p * Math.asin( 1 / a ) / ( 2 * Math.PI );
			return - ( a * Math.pow( 2, 10 * ( k -= 1 ) ) * Math.sin( ( k - s ) * ( 2 * Math.PI ) / p ) );

		},

		Out: function ( k ) {

			var s, a = 0.1, p = 0.4;
			if ( k === 0 ) return 0;
			if ( k === 1 ) return 1;
			if ( !a || a < 1 ) { a = 1; s = p / 4; }
			else s = p * Math.asin( 1 / a ) / ( 2 * Math.PI );
			return ( a * Math.pow( 2, - 10 * k) * Math.sin( ( k - s ) * ( 2 * Math.PI ) / p ) + 1 );

		},

		InOut: function ( k ) {

			var s, a = 0.1, p = 0.4;
			if ( k === 0 ) return 0;
			if ( k === 1 ) return 1;
			if ( !a || a < 1 ) { a = 1; s = p / 4; }
			else s = p * Math.asin( 1 / a ) / ( 2 * Math.PI );
			if ( ( k *= 2 ) < 1 ) return - 0.5 * ( a * Math.pow( 2, 10 * ( k -= 1 ) ) * Math.sin( ( k - s ) * ( 2 * Math.PI ) / p ) );
			return a * Math.pow( 2, -10 * ( k -= 1 ) ) * Math.sin( ( k - s ) * ( 2 * Math.PI ) / p ) * 0.5 + 1;

		}

	},

	Back: {

		In: function ( k ) {

			var s = 1.70158;
			return k * k * ( ( s + 1 ) * k - s );

		},

		Out: function ( k ) {

			var s = 1.70158;
			return --k * k * ( ( s + 1 ) * k + s ) + 1;

		},

		InOut: function ( k ) {

			var s = 1.70158 * 1.525;
			if ( ( k *= 2 ) < 1 ) return 0.5 * ( k * k * ( ( s + 1 ) * k - s ) );
			return 0.5 * ( ( k -= 2 ) * k * ( ( s + 1 ) * k + s ) + 2 );

		}

	},

	Bounce: {

		In: function ( k ) {

			return 1 - TWEEN.Easing.Bounce.Out( 1 - k );

		},

		Out: function ( k ) {

			if ( k < ( 1 / 2.75 ) ) {

				return 7.5625 * k * k;

			} else if ( k < ( 2 / 2.75 ) ) {

				return 7.5625 * ( k -= ( 1.5 / 2.75 ) ) * k + 0.75;

			} else if ( k < ( 2.5 / 2.75 ) ) {

				return 7.5625 * ( k -= ( 2.25 / 2.75 ) ) * k + 0.9375;

			} else {

				return 7.5625 * ( k -= ( 2.625 / 2.75 ) ) * k + 0.984375;

			}

		},

		InOut: function ( k ) {

			if ( k < 0.5 ) return TWEEN.Easing.Bounce.In( k * 2 ) * 0.5;
			return TWEEN.Easing.Bounce.Out( k * 2 - 1 ) * 0.5 + 0.5;

		}

	}

};

TWEEN.Interpolation = {

	Linear: function ( v, k ) {

		var m = v.length - 1, f = m * k, i = Math.floor( f ), fn = TWEEN.Interpolation.Utils.Linear;

		if ( k < 0 ) return fn( v[ 0 ], v[ 1 ], f );
		if ( k > 1 ) return fn( v[ m ], v[ m - 1 ], m - f );

		return fn( v[ i ], v[ i + 1 > m ? m : i + 1 ], f - i );

	},

	Bezier: function ( v, k ) {

		var b = 0, n = v.length - 1, pw = Math.pow, bn = TWEEN.Interpolation.Utils.Bernstein, i;

		for ( i = 0; i <= n; i++ ) {
			b += pw( 1 - k, n - i ) * pw( k, i ) * v[ i ] * bn( n, i );
		}

		return b;

	},

	CatmullRom: function ( v, k ) {

		var m = v.length - 1, f = m * k, i = Math.floor( f ), fn = TWEEN.Interpolation.Utils.CatmullRom;

		if ( v[ 0 ] === v[ m ] ) {

			if ( k < 0 ) i = Math.floor( f = m * ( 1 + k ) );

			return fn( v[ ( i - 1 + m ) % m ], v[ i ], v[ ( i + 1 ) % m ], v[ ( i + 2 ) % m ], f - i );

		} else {

			if ( k < 0 ) return v[ 0 ] - ( fn( v[ 0 ], v[ 0 ], v[ 1 ], v[ 1 ], -f ) - v[ 0 ] );
			if ( k > 1 ) return v[ m ] - ( fn( v[ m ], v[ m ], v[ m - 1 ], v[ m - 1 ], f - m ) - v[ m ] );

			return fn( v[ i ? i - 1 : 0 ], v[ i ], v[ m < i + 1 ? m : i + 1 ], v[ m < i + 2 ? m : i + 2 ], f - i );

		}

	},

	Utils: {

		Linear: function ( p0, p1, t ) {

			return ( p1 - p0 ) * t + p0;

		},

		Bernstein: function ( n , i ) {

			var fc = TWEEN.Interpolation.Utils.Factorial;
			return fc( n ) / fc( i ) / fc( n - i );

		},

		Factorial: ( function () {

			var a = [ 1 ];

			return function ( n ) {

				var s = 1, i;
				if ( a[ n ] ) return a[ n ];
				for ( i = n; i > 1; i-- ) s *= i;
				return a[ n ] = s;

			};

		} )(),

		CatmullRom: function ( p0, p1, p2, p3, t ) {

			var v0 = ( p2 - p0 ) * 0.5, v1 = ( p3 - p1 ) * 0.5, t2 = t * t, t3 = t * t2;
			return ( 2 * p1 - 2 * p2 + v0 + v1 ) * t3 + ( - 3 * p1 + 3 * p2 - 2 * v0 - v1 ) * t2 + v0 * t + p1;

		}

	}

};

module.exports=TWEEN;
},{}],9:[function(require,module,exports){
var glMatrix = require("../js/gl-matrix-min.js");
var vec3 = glMatrix.vec3;
var vec4 = glMatrix.vec4;
//VEC4 -----------------------------------------------------------------
//check for 0
vec4.projectDown=function(a,b){var d=1.0/a[3];if(!b) {b=vec3.create();} b[0]=a[0]*d;b[1]=a[1]*d;b[2]=a[2]*d;return b;};
//optimize to avoid multiplications with no b
vec4.fromVec3=function(a,b){if(!b) b=1;var c=new Float32Array(4);c[0]=a[0]*b;c[1]=a[1]*b;c[2]=a[2]*b;c[3]=b;return c};

//NURBS CURVE
//a nurbs object has control pts,knots, degree
var nurbs = exports;
//used locally
nurbs.MAX_DEGREE = 10;
nurbs.basisFuncs = new Float32Array(10);
nurbs.basisFuncsU = new Float32Array(10);
nurbs.basisFuncsV = new Float32Array(10);
nurbs.deriveBasisFuncs = new Array(11);
for(var i=0;i<nurbs.MAX_DEGREE+1;++i) nurbs.deriveBasisFuncs[i] = new Float32Array(nurbs.MAX_DEGREE+1);
nurbs.ndu = new Array(nurbs.MAX_DEGREE+1);
for(var i=0;i<nurbs.MAX_DEGREE+1;++i) nurbs.ndu[i] = new Float32Array(nurbs.MAX_DEGREE+1);

nurbs.bang = function(a) {
	var val=1;
	for(;a>1;a--) {
		val*=a;
	}
	return val;
};

//I am an idiot
nurbs.B = [new Float32Array(10),new Float32Array(10),new Float32Array(10),new Float32Array(10),new Float32Array(10),new Float32Array(10),new Float32Array(10),new Float32Array(10),new Float32Array(10),new Float32Array(10)];
for(var i=0;i<10;++i) {
	for(var j=0;j<10;++j) {
		nurbs.B[i][j] = nurbs.bang(i)/(nurbs.bang(j)*nurbs.bang(i-j));
	}
}

//make a nurbs crv object
//initialize with points??
nurbs.createCrv = function(crv,degree) {
	crv = crv || {};
	crv.degree = degree || 3;
	crv.knots = new Array(crv.degree+1);
	for(var i=0;i<=crv.degree;i++) crv.knots[i] = 0;
	crv.controlPts = [];
	return crv;
}

nurbs.createClosedCrv = function(pts, degree) {
	var crv = {};
	crv.degree = degree || 3;
	crv.knots = new Array(pts.length+crv.degree+crv.degree+1);
	for(var i=0;i<crv.knots.length;i++) crv.knots[i] = i-crv.degree;
	crv.controlPts = [];
	for(var i=0;i<pts.length;++i) {
		crv.controlPts.push(vec4.create(pts[i]));
	}
	for(var i=0;i<=degree;++i) {
		crv.controlPts.push(vec4.create(pts[i]));
	}
	return crv;
}

nurbs.copyCrv = function(crv) {
	var newCrv = {};
	newCrv.degree = crv.degree;
	newCrv.knots = crv.knots.slice(0);
	newCrv.controlPts = crv.controlPts.slice(0);
	return newCrv;
}

//binary search
nurbs.findKnot = function(knots,u,degree) {
	if (u==knots[knots.length-degree]) return knots.length-degree-2;
	if(u <= knots[degree]) return degree;
	var low = degree;
	var high = knots.length-degree;
	var mid = Math.floor((high+low)/2);
	while(knots[mid]>u || u >= knots[mid+1]) {
	  if(u<knots[mid]) {
		high = mid;
	  } else {
		low = mid;
	  }
	  mid = Math.floor((high+low)/2);
	}
	return mid;
}

 
//implement degree elevation and reduction, needed to loft curve of different degrees as well
nurbs.setDegree = function(deg) {
}
	
nurbs.evaluateCrv = (function() {
  var evalPt = vec4.create();
  return function evaluateCrv(crv,u,pt) {
    var currKnot = nurbs.findKnot(crv.knots,u,crv.degree);
    
    nurbs.basisFunctions(crv.knots,crv.degree,currKnot, u,nurbs.basisFuncs);
    vec4.set(evalPt,0,0,0,0);
    for(var i = 0;i<=crv.degree;++i) {
      vec4.scaleAndAdd(evalPt, evalPt,crv.controlPts[currKnot-crv.degree+i], nurbs.basisFuncs[i]);
    }
    return vec4.projectDown(evalPt,pt);  
  }
})();
/*	 
	 public PVector derivative(float u, int k) {
		 Vector4D[] derivesW = new Vector4D[k+1];
		 if(k>degree) return new PVector();
		 int currKnot = findKnot(u);
		 Vector4D[] hPts = new Vector4D[degree+1];
		 for(int i=0;i<=degree;++i) {
	      hPts[i] = Vector4D.multiply(new Vector4D(controlPts[currKnot-degree+i].x,controlPts[currKnot-degree+i].y,controlPts[currKnot-degree+i].z),weights[currKnot-degree+i]);
		 }
		 float[][] basFunc = deriveBasisFunctions(currKnot,u, k);
		 for(int i=0;i<=k;++i) {
			 derivesW[i] = new Vector4D();
			 for(int j=0;j<=degree;++j) {
				 derivesW[i] = Vector4D.add(derivesW[i],Vector4D.multiply(hPts[j],basFunc[i][j]));
			 }
		 }
		 
		 PVector[] derives = new PVector[derivesW.length];
		 derives[0] = new PVector();
		 for(int i=0;i<=k;++i) {
			PVector currPt = new PVector(derivesW[i].x,derivesW[i].y,derivesW[i].z);
			for(int j=1;j<=i;++j) {
				currPt = PVector.sub(currPt,PVector.mult(derives[i-j],B[i][j]*derivesW[j].w));
			}
			derives[i] = new PVector(currPt.x/derivesW[0].w,currPt.y/derivesW[0].w,currPt.z/derivesW[0].w);
		 }
		 return derives[k];
		 
	 }
	 
	 public PVector[] allDerivatives(float u, int k) {
		 Vector4D[] derivesW = new Vector4D[k+1];
		 int currKnot = findKnot(u);
		 Vector4D[] hPts = new Vector4D[degree+1];
		 for(int i=0;i<=degree;++i) {
	      hPts[i] = Vector4D.multiply(new Vector4D(controlPts[currKnot-degree+i].x,controlPts[currKnot-degree+i].y,controlPts[currKnot-degree+i].z),weights[currKnot-degree+i]);
		 }		 
		 float[][] basFunc = deriveBasisFunctions(currKnot,u, k);
		 for(int i=0;i<=k;++i) {
			 derivesW[i] = new Vector4D();
			 for(int j=0;j<=degree;++j)
				 derivesW[i] = Vector4D.add(derivesW[i],Vector4D.multiply(hPts[j],basFunc[i][j]));
		 }
		 
		 PVector[] derives = new PVector[derivesW.length];
		 derives[0] = new PVector();
		 for(int i=0;i<=k;++i) {
			PVector currPt = new PVector(derivesW[i].x,derivesW[i].y,derivesW[i].z);
			for(int j=1;j<=i;++j) {
				currPt = PVector.sub(currPt,PVector.mult(derives[i-j],B[i][j]*derivesW[j].w));
			}
			derives[i] = new PVector(currPt.x/derivesW[0].w,currPt.y/derivesW[0].w,currPt.z/derivesW[0].w);
		 }
		 return derives;
		 
	 }	 
*/	  
	  //approximate length, unimplemented
nurbs.crvLength=function(crv) {
	return 1;
}	
	  
nurbs.domain = function(c,b) {
	b = b || new Array(2);
	b[0]=c.knots[c.degree];
	b[1]=c.knots[c.knots.length-1-c.degree];
	return b;
}
	  
nurbs.addPoint = function(crv, pt) {
	crv.controlPts.push(vec4.fromVec3(pt,1));
	var inc = 1;
	var start = crv.knots[crv.degree];
	var end = crv.knots[crv.knots.length-1];
	if(crv.controlPts.length<=crv.degree+1) {
	  crv.knots.push(1);
	} else {
	  var i;
	  for( i=crv.degree+1;i<crv.knots.length-crv.degree;++i) {
		  if(crv.knots[i] != start) {
			  inc = crv.knots[i]-start;
			  i = crv.knots.length; //break?
		  }
	  }
	  crv.knots.push(end+inc);
	  for( i=crv.knots.length-2;i>crv.knots.length-crv.degree-2;--i) 
		crv.knots[i] = end+inc;			  
	  for( i=0;i<crv.knots.length;++i) 
		crv.knots[i] /= end+inc;
	}
}

//insert a knot a u some times
//this should use native array methods not this weird copying
nurbs.insertKnot = function(crv,u,times) {
	if(!times) times = 1;
	var currKnot = nurbs.findKnot(crv.knots,u,crv.degree);
	var multiplicity = nurbs.findMultiplicity(crv.knots,currKnot);
	//times = Math.min(degree-times-multiplicity,times);
	//times = Math.max(0,times);
	var newKnots = new Float32Array(crv.knots.length+times);
	var newPoints = new Array(crv.controlPts.length+times);

	var i;
	for(i=0;i<=currKnot;++i) newKnots[i] = crv.knots[i];
	for(i=1;i<=times;++i) newKnots[currKnot+i] = u;
	for(i=currKnot+1;i<crv.knots.length;++i) newKnots[i+times] = crv.knots[i];
	for(i=0;i<=currKnot-crv.degree;++i) newPoints[i] = crv.controlPts[i];
	for(i=currKnot-multiplicity; i<crv.controlPts.length;++i) newPoints[i+times] = crv.controlPts[i];
	var temp = new Array(degree+1);
	for(i=0;i<= crv.degree-multiplicity;++i) temp[i] = crv.controlPts[currKnot-crv.degree+i];
	var j, L,alpha;
	for(j=1;j<=times;++j) {
	 L = currKnot-crv.degree+j;
	 for(i=0;i<=crv.degree-j-multiplicity;++i) {
		 alpha = (u-crv.knots[L+i])/(crv.knots[i+currKnot+1]-crv.knots[L+i]);
		 vec4.add(vec4.scale(temp[i+1],alpha),vec4.scale(temp[i],1.0-alpha),temp[i]);
	 }
	 
	 newPoints[L] = temp[0];
	 newPoints[currKnot+times-j-multiplicity] = temp[crv.degree-j-multiplicity];
	}
	for(i=L+1;i<currKnot-multiplicity;++i) {
	 newPoints[i] = temp[i-L];
	}
	crv.controlPts = newPoints;
	crv.knots = newKnots;
}	  

nurbs.insertKnotArray = function(crv,us) {

}
	  /*	 
	 public void insertKnots(float[] insertKnots) {
		 int startKnot = findKnot(insertKnots[0]);
		 int endKnot = findKnot(insertKnots[insertKnots.length-1])+1;
		 float[] newKnots = new float[knots.length+insertKnots.length];
		 Vector4D[] newPoints = new Vector4D[controlPts.length+insertKnots.length];
		 for(int j=0;j<=startKnot-degree;++j) newPoints[j] = new Vector4D(controlPts[j],weights[j]);
		 for(int j=endKnot-1;j<controlPts.length;++j) newPoints[j+insertKnots.length] =  new Vector4D(controlPts[j],weights[j]);
		 for(int j=0;j<=startKnot;++j) newKnots[j] = knots[j];
		 for(int j=endKnot+degree;j<knots.length;++j) newKnots[j+insertKnots.length] = knots[j];
		 int i=endKnot+degree-1;
		 int k= endKnot+degree+insertKnots.length-1;
		 for(int j=insertKnots.length-1;j>=0;--j) {
			 while(insertKnots[j] <= knots[i] && i>startKnot) {
				 newPoints[k-degree-1] = new Vector4D(controlPts[i-degree-1],weights[i-degree-1]);
				 newKnots[k] = knots[i];
				 --k;
				 --i;
			 }
			 newPoints[k-degree-1] = newPoints[k-degree];
			 for(int l=1;l<=degree;++l) {
				 int ind = k-degree+l;
				 loat alpha = newKnots[k+l]-insertKnots[j];
				 if(Math.abs(alpha) == 0) newPoints[ind-1] = newPoints[ind];
				 else {
					 alpha = alpha/(newKnots[k+l]-knots[i-degree+l]);
					 newPoints[ind-1] = Vector4D.add(Vector4D.multiply(newPoints[ind-1],alpha), Vector4D.multiply(newPoints[ind],1-alpha));
				 }
			 }
			 newKnots[k] = insertKnots[j];
			 --k;
		 }
		 knots = newKnots;
		 controlPts = new PVector[newPoints.length];
		 weights = new float[newPoints.length];
		 for(int j=0;j<newPoints.length;++j) {
			 
			 if(newPoints[j] != null) {
				 controlPts[j] = newPoints[j].projectDown();
				 weights[j] = newPoints[j].w;
			 }
		 }
	 }
*/
//make knot values between 0 and 1 aka evaluate(0) = start and evaluate(1) = end
nurbs.normalizeKnots=function(knots) {
	var start = knots[0];
	var end = knots[knots.length-1];
	for(var i=0;i<knots.length;++i) {
		knots[i] = (knots[i]-start)/(end-start);
	}
}

//how many times does a knot appear
nurbs.findMultiplicity = function(knots,knot) {
	var mult = 1;
	var i;
	for(i=knot+1;i<knots.length && knots[i] == knots[knot];++i) ++mult;
	for(i=knot-1;i>=0 && knots[i] == knots[knot];--i) ++mult;

	return mult-1;
}
	 
nurbs.basisFunctions = (function() {
  var left = new Float32Array(nurbs.MAX_DEGREE+1);
  var right = new Float32Array(nurbs.MAX_DEGREE+1);
  return function basisFunctions(knots,degree,knot,u,funcs) {

    funcs[0] = 1;
    var j, r, saved, temp;
    for( j=1;j<=degree;++j) {
      left[j] = u-knots[knot+1-j];
      right[j] = knots[knot+j]-u;
      saved = 0;
      for( r = 0;r<j;++r) {
      temp = funcs[r]/(right[r+1]+left[j-r]);
      funcs[r] = saved+right[r+1]*temp;
      saved = left[j-r]*temp;
      }
      funcs[j] = saved;
    }
    return funcs;
  }
})();
	  
nurbs.deriveBasisFunctions = function(knots,degree,knot, u, der) {
	var left,right;
	ndu[0][0] = 1;
	var j,r;
	var saved,temp;
	for(j=1;j<=degree;++j) {
	 left[j] = u-knots[knot+1-j];
	 right[j] = knots[knot+j]-u;
	 saved = 0;
	 for(r=0;r<j;++r) {
		 ndu[j][r] = right[r+1]+left[j-r];
		 temp = ndu[r][j-1]/ndu[j][r];
		 ndu[r][j] = saved+right[r+1]*temp;
		 saved = left[j-r]*temp;
	 }
	 ndu[j][j] = saved;
	}
	for(j=0;j<=degree;++j)
		nurbs.deriveBasisFuncs[0][j] = ndu[j][degree];
	
	var s1, s2, k,d,rk,pk,j1,j2;
	var a=new Array(degree+1);
	for(j=0;j<degree+1;++j) a[j] = new Array(degree+1);
	for(r=0;r<=degree;++r) {
	 s1 = 0;
	 s2 = 1;
	 a[0][0] = 1;
	 for( k=1;k<=der;++k) {
		 d = 0;
		 rk = r-k;
		 pk = degree-k;
		 if(r>=k) {
			 a[s2][0] = a[s1][0]/ndu[pk+1][rk];
			 d = a[s2][0]*ndu[rk][pk];
		 }
		 j1 = -rk;
		 if(rk>=-1) j1 = 1;
		 j2=degree-r;
		 if(r-1 <=pk) j2 = k-1;
		 
		 for(j=j1;j<=j2;++j) {
			 a[s2][j] = (a[s1][j]-a[s1][j-1])/ndu[pk+1][rk+j];
			 d += a[s2][j]*ndu[rk+j][pk];
		 }
		 if(r<=pk) {
			 a[s2][k] = -a[s1][k-1]/ndu[pk+1][r];
			 d += a[s2][k]*ndu[r][pk];
		 }
		 nurbs.deriveBasisFuncs[k][r] = d;
		 temp =s1;
		 s1 = s2;
		 s2 = temp;	 
	 }
	}
	r = degree;
	for(k=1;k<=der;++k) {
	 for(j=0;j<=degree;++j) nurbs.deriveBasisFuncs[k][j] *= r; 
	 r *= (degree-k);
	}
	return nurbs.deriveBasisFuncs;
}

nurbs.circlePt = function(cen,radius) {

	var crv = nurbs.createCrv();
	crv.controlPts = [];
	crv.degree = 2;
	crv.knots = [0,0,0,Math.PI*0.5,Math.PI*0.5, Math.PI, Math.PI, Math.PI*1.5, Math.PI*1.5, Math.PI*2, Math.PI*2,Math.PI*2];
	var SQRT2 = Math.sqrt(2.0)*0.5;
	crv.controlPts = [ vec4.create([cen[0]+radius,cen[1],cen[2],1]),
		vec4.create([(cen[0]+radius)*SQRT2,(cen[1]+radius)*SQRT2,cen[2]*SQRT2,SQRT2]),
		vec4.create([cen[0],cen[1]+radius,cen[2],1]),
		vec4.create([(cen[0]-radius)*SQRT2,(cen[1]+radius)*SQRT2,cen[2]*SQRT2,SQRT2]),
		vec4.create([cen[0]-radius,cen[1],cen[2],1]),
		vec4.create([(cen[0]-radius)*SQRT2,(cen[1]-radius)*SQRT2,cen[2]*SQRT2,SQRT2]),
		vec4.create([cen[0],cen[1]-radius,cen[2],1]),
		vec4.create([(cen[0]+radius)*SQRT2,(cen[1]-radius)*SQRT2,cen[2]*SQRT2,SQRT2]),
		vec4.create([cen[0]+radius,cen[1],cen[2],1]) ];
	return crv;
}	


//--------------------------------------------------------------------------------------
//NURBS SURFACES
//
nurbs.createSrf = function() {
	var srf = {};
	srf.knotsU = [];
	srf.knotsV = [];
	srf.controlPts = [];
	srf.degreeU = [];
	srf.degreeV = [];
	return srf;
}


nurbs.evaluateSrf = function(srf,u,v,pt) {
	pt = pt || vec3.create();
	//if(controlPts.length == 0) return new PVector();
	var uKnot = nurbs.findKnot(srf.knotsU,u,srf.degreeU);
	var vKnot = nurbs.findKnot(srf.knotsV,v,srf.degreeV);
	nurbs.basisFunctions(srf.knotsU, srf.degreeU, uKnot,u,nurbs.basisFuncsU);
	nurbs.basisFunctions(srf.knotsV, srf.degreeV, vKnot,v,nurbs.basisFuncsV);
	
	var evalPt = vec4.create();
	var temp = [];
	var i,j;
	//avoid create commands
	for(i=0;i<=srf.degreeV;++i) {
		temp[i] = vec4.create();
		for(j=0;j<=srf.degreeU;++j) {
			vec4.add(temp[i],vec4.scale(srf.controlPts[uKnot-srf.degreeU+j][vKnot-srf.degreeV+i], nurbs.basisFuncsU[j],evalPt));
		}
	}
	
	vec4.set([0,0,0,0],evalPt);
	for(i=0;i<=srf.degreeV;++i) {
		vec4.add(evalPt, vec4.scale(temp[i],nurbs.basisFuncsV[i]));
	}
	return vec4.projectDown(evalPt,pt);
}
	/*

	NurbsCurve isocurve(float u, boolean dir) {
		int uKnot = findKnot(u,knotsU,degreeU);
		float[] basFunc = basisFunctions(uKnot,u,knotsU,degreeU);
		Vector4D[][] hPts = new Vector4D[degreeU+1][degreeV+1];
		for(int i=0;i<controlPts.length;++i) {
			for(int j=0;j<controlPts[0].length;++j) {
				PVector ctrlPt = controlPts[i][j];
				float w = weights[i][j];
				hPts[i][j] = new Vector4D(ctrlPt.x*w, ctrlPt.y*w,ctrlPt.z*w,w);
			}
		}
		Vector4D[] newPts = new Vector4D[controlPts[0].length];
		for(int i=0;i<controlPts[0].length;++i) {
			for(int j=0;j<=degreeU;++j) {
				newPts[i] = Vector4D.add(newPts[i],Vector4D.multiply(hPts[uKnot-degreeU+j][i], basFunc[j]));
			}
		}
		
		PVector[] newCPts = new PVector[newPts.length];
		float[] newWeights = new float[newPts.length];
		for(int i=0;i<newPts.length;++i) {
			newCPts[i] = new PVector(newPts[i].x*newPts[i].w,newPts[i].y*newPts[i].w,newPts[i].z*newPts[i].w);
			newWeights[i] = newPts[i].w;
		}
		return new NurbsCurve(newCPts, knotsV, newWeights, degreeV);
	}
	
	*/
	
nurbs.loft = function(crv1,crv2) {
	//do degree elevation
	if(crv1.degree != crv2.degree) return null;
	var temp1 = nurbs.copyCrv(crv1);
	var temp2 = nurbs.copyCrv(crv2);
	nurbs.normalizeKnots(temp1);
	nurbs.normalizeKnots(temp2);
	//find difference
	var k = 0,i;
	var insertTemp1 = [];
	var insertTemp2 = [];
	for(i=0;i<temp1.knots.length;++i) {
		while(k < temp2.knots.length && temp2.knots[k] < temp1.knots[i] ) {
			insertTemp1.push(temp2.knots[k]);
			++k;
		}
		if(temp2.knots[k] > temp1.knots[i]) insertTemp2.push(temp1.knots[i]);
		if(temp2.knots[k] == temp1.knots[i]) ++k;
	}
	while(k<temp2.knots.length) {
		insertTemp1.push(temp2.knots[k]);
		++k;
	}
	if(insertTemp1.length > 0) nurbs.insertKnots(temp1,insertTemp1);
	if(insertTemp2.length > 0) nurbs.insertKnots(temp2,insertTemp2);
	
	var pts = new Array(temp1.controlPts.length);
	for(i=0;i<pts.length;++i) {
		pts[i] = [temp1.controlPts[i], temp2.controlPts[i]];
	}
	
	var toReturn = nurbs.createSrf();
	toReturn.controlPts = pts;
	toReturn.degreeU = temp1.degree;
	toReturn.degreeV = 1;
	toReturn.knotsV = [0,0,1,1]; //this might be wrong
	for(i=0;i<temp1.knots.length;++i) {
		toReturn.knotsU[i] = temp1.knots[i];
	}
	return toReturn;
}

//revolve
nurbs.revolve = function(crv, axis) {

}

nurbs.sweep = function(crv1,crv2) {

}
},{"../js/gl-matrix-min.js":14}],10:[function(require,module,exports){
/*
 * Poly2Tri Copyright (c) 2009-2013, Poly2Tri Contributors
 * http://code.google.com/p/poly2tri/
 *
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *
 * * Redistributions of source code must retain the above copyright notice,
 *   this list of conditions and the following disclaimer.
 * * Redistributions in binary form must reproduce the above copyright notice,
 *   this list of conditions and the following disclaimer in the documentation
 *   and/or other materials provided with the distribution.
 * * Neither the name of Poly2Tri nor the names of its contributors may be
 *   used to endorse or promote products derived from this software without specific
 *   prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/* jshint browser:false, forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, 
   strict:true, undef:true, unused:true, curly:true, immed:true, latedef:true, 
   newcap:true, trailing:true, maxcomplexity:11, indent:4 
 */

/*
  edited by Nervous System, 2014
*/

/*
 * Note
 * ====
 * the structure of this JavaScript version of poly2tri intentionnaly follows
 * as closely as possible the structure of the reference C++ version, to make it 
 * easier to keep the 2 versions in sync.
 */


/**
 * Module encapsulation
 * @param {Object} global a reference to the global object :
 *                      window in the browser, global on the server
 */
(function(global) {
    "use strict";

// --------------------------------------------------------------poly2tri module

    // Save the previous value of the poly2tri variable, 
    // so that it can be restored later on, if noConflict is used.
    
    var previousPoly2tri = global.poly2tri;

    // The top-level namespace. All public poly2tri classes and functions will
    // be attached to it. Exported for both the browser and the server (Node.js).
    var poly2tri;
    /* global exports */
    
    if (typeof exports !== 'undefined') {
        poly2tri = exports;
    } else {
        poly2tri = global.poly2tri = {};
    }

    // Runs the library in noConflict mode, returning the poly2tri variable 
    // to its previous owner. Returns a reference to this library object.
    poly2tri.noConflict = function() {
        global.poly2tri = previousPoly2tri;
        return this;
    };

// -------------------------------------------------------------------PointError

    /**
     * Custom exception class to indicate invalid Point values
     * @param {String} message          error message
     * @param {array<Point>} points     invalid points
     */
    // Class added in the JavaScript version (was not present in the c++ version)
    var PointError = function (message, points) {
        this.name    = "PointError";
        this.points  = points = points || [];
        this.message = message || "Invalid Points!";
        for (var i = 0; i < points.length; i++) {
            this.message += " " + Point.toString(points[i]);
        }
    };
    PointError.prototype = new Error();
    PointError.prototype.constructor = PointError;


// ------------------------------------------------------------------------Point
    /**
     * Construct a point
     * @param {Number} x    coordinate (0 if undefined)
     * @param {Number} y    coordinate (0 if undefined)
     */
    var Point = function(x, y) {
        this.x = +x || 0;
        this.y = +y || 0;

        // All extra fields added to Point are prefixed with _p2t_
        // to avoid collisions if custom Point class is used.

        // The edges this point constitutes an upper ending point
        this._p2t_edge_list = null;
    };

    /**
     * For pretty printing ex. <i>"(5;42)"</i>)
     */
    Point.prototype.toString = function() {
        return ("(" + this.x + ";" + this.y + ")");
    };

    /**
     * Creates a copy of this Point object.
     * @returns Point
     */
    Point.prototype.clone = function() {
        return new Point(this.x, this.y);
    };

    /**
     * Set this Point instance to the origo. <code>(0; 0)</code>
     */
    Point.prototype.set_zero = function() {
        this.x = 0.0;
        this.y = 0.0;
        return this; // for chaining
    };

    /**
     * Set the coordinates of this instance.
     * @param   x   number.
     * @param   y   number;
     */
    Point.prototype.set = function(x, y) {
        this.x = +x || 0;
        this.y = +y || 0;
        return this; // for chaining
    };

    /**
     * Negate this Point instance. (component-wise)
     */
    Point.prototype.negate = function() {
        this.x = -this.x;
        this.y = -this.y;
        return this; // for chaining
    };

    /**
     * Add another Point object to this instance. (component-wise)
     * @param   n   Point object.
     */
    Point.prototype.add = function(n) {
        this.x += n.x;
        this.y += n.y;
        return this; // for chaining
    };

    /**
     * Subtract this Point instance with another point given. (component-wise)
     * @param   n   Point object.
     */
    Point.prototype.sub = function(n) {
        this.x -= n.x;
        this.y -= n.y;
        return this; // for chaining
    };

    /**
     * Multiply this Point instance by a scalar. (component-wise)
     * @param   s   scalar.
     */
    Point.prototype.mul = function(s) {
        this.x *= s;
        this.y *= s;
        return this; // for chaining
    };

    /**
     * Return the distance of this Point instance from the origo.
     */
    Point.prototype.length = function() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    };

    /**
     * Normalize this Point instance (as a vector).
     * @return The original distance of this instance from the origo.
     */
    Point.prototype.normalize = function() {
        var len = this.length();
        this.x /= len;
        this.y /= len;
        return len;
    };

    /**
     * Test this Point object with another for equality.
     * @param   p   any "Point like" object with {x,y} (duck typing)
     * @return <code>True</code> if <code>this == p</code>, <code>false</code> otherwise.
     */
    Point.prototype.equals = function(p) {
        return this.x === p.x && this.y === p.y;
    };

// -----------------------------------------------------Point ("static" methods)

    /**
     * Negate a point component-wise and return the result as a new Point object.
     * @param   p   Point object.
     * @return the resulting Point object.
     */
    Point.negate = function(p) {
        return new Point(-p.x, -p.y);
    };

    /**
     * Add two points component-wise and return the result as a new Point object.
     * @param   a   Point object.
     * @param   b   Point object.
     * @return the resulting Point object.
     */
    Point.add = function(a, b) {
        return new Point(a.x + b.x, a.y + b.y);
    };

    /**
     * Subtract two points component-wise and return the result as a new Point object.
     * @param   a   Point object.
     * @param   b   Point object.
     * @return the resulting Point object.
     */
    Point.sub = function(a, b) {
        return new Point(a.x - b.x, a.y - b.y);
    };

    /**
     * Multiply a point by a scalar and return the result as a new Point object.
     * @param   s   the scalar (a number).
     * @param   p   Point object.
     * @return the resulting Point object.
     */
    Point.mul = function(s, p) {
        return new Point(s * p.x, s * p.y);
    };

    /**
     * Perform the cross product on either two points (this produces a scalar)
     * or a point and a scalar (this produces a point).
     * This function requires two parameters, either may be a Point object or a
     * number.
     * @param   a   Point object or scalar.
     * @param   b   Point object or scalar.
     * @return  a   Point object or a number, depending on the parameters.
     */
    Point.cross = function(a, b) {
        if (typeof(a) === 'number') {
            if (typeof(b) === 'number') {
                return a * b;
            } else {
                return new Point(-a * b.y, a * b.x);
            }
        } else {
            if (typeof(b) === 'number') {
                return new Point(b * a.y, -b * a.x);
            } else {
                return a.x * b.y - a.y * b.x;
            }
        }
    };


// -----------------------------------------------------------------"Point-Like"
    /*
     * The following functions operate on "Point" or any "Point like" object 
     * with {x,y} (duck typing).
     */


    /**
     * Point pretty printing ex. <i>"(5;42)"</i>)
     * @param   p   any "Point like" object with {x,y} 
     * @returns {String}
     */
    Point.toString = function(p) {
        // Try a custom toString first, and fallback to Point.prototype.toString if none
        var s = p.toString();
        return (s === '[object Object]' ? Point.prototype.toString.call(p) : s);
    };

    /**
     * Compare two points component-wise.
     * @param   a,b   any "Point like" objects with {x,y} 
     * @return <code>&lt; 0</code> if <code>a &lt; b</code>, 
     *         <code>&gt; 0</code> if <code>a &gt; b</code>, 
     *         <code>0</code> otherwise.
     */
    Point.compare = function(a, b) {
        if (a.y === b.y) {
            return a.x - b.x;
        } else {
            return a.y - b.y;
        }
    };
    Point.cmp = Point.compare; // backward compatibility

    /**
     * Test two Point objects for equality.
     * @param   a,b   any "Point like" objects with {x,y} 
     * @return <code>True</code> if <code>a == b</code>, <code>false</code> otherwise.
     */
    Point.equals = function(a, b) {
        return a.x === b.x && a.y === b.y;
    };

    /**
     * Peform the dot product on two vectors.
     * @param   a,b   any "Point like" objects with {x,y} 
     * @return The dot product (as a number).
     */
    Point.dot = function(a, b) {
        return a.x * b.x + a.y * b.y;
    };


// -------------------------------------------------------------------------Edge
    /**
     * Represents a simple polygon's edge
     * @param {Point} p1
     * @param {Point} p2
     */
    var Edge = function(p1, p2) {
        this.p = p1;
        this.q = p2;

        if (p1.y > p2.y) {
            this.q = p1;
            this.p = p2;
        } else if (p1.y === p2.y) {
            if (p1.x > p2.x) {
                this.q = p1;
                this.p = p2;
            } else if (p1.x === p2.x) {
                throw new PointError('poly2tri Invalid Edge constructor: repeated points!', [p1]);
            }
        }

        if (! this.q._p2t_edge_list) {
            this.q._p2t_edge_list = [];
        }
        this.q._p2t_edge_list.push(this);
    };

// ---------------------------------------------------------------------Triangle
    /**
     * Triangle class.<br>
     * Triangle-based data structures are known to have better performance than
     * quad-edge structures.
     * See: J. Shewchuk, "Triangle: Engineering a 2D Quality Mesh Generator and
     * Delaunay Triangulator", "Triangulations in CGAL"
     * 
     * @param   a,b,c   any "Point like" objects with {x,y} (duck typing)
     */
    var Triangle = function(a, b, c) {
        // Triangle points
        this.points_ = [a, b, c];
        // Neighbor list
        this.neighbors_ = [null, null, null];
        // Has this triangle been marked as an interior triangle?
        this.interior_ = false;
        // Flags to determine if an edge is a Constrained edge
        this.constrained_edge = [false, false, false];
        // Flags to determine if an edge is a Delauney edge
        this.delaunay_edge = [false, false, false];
    };

    /**
     * For pretty printing ex. <i>"[(5;42)(10;20)(21;30)]"</i>)
     */
    Triangle.prototype.toString = function() {
        var p2s = Point.toString;
        return ("[" + p2s(this.points_[0]) + p2s(this.points_[1]) + p2s(this.points_[2]) + "]");
    };

    Triangle.prototype.getPoint = function(index) {
        return this.points_[index];
    };
    // for backward compatibility
    Triangle.prototype.GetPoint = Triangle.prototype.getPoint;

    Triangle.prototype.getNeighbor = function(index) {
        return this.neighbors_[index];
    };

    /**
     * Test if this Triangle contains the Point object given as parameters as its
     * vertices. Only point references are compared, not values.
     * @return <code>True</code> if the Point object is of the Triangle's vertices,
     *         <code>false</code> otherwise.
     */
    Triangle.prototype.containsPoint = function(point) {
        var points = this.points_;
        // Here we are comparing point references, not values
        return (point === points[0] || point === points[1] || point === points[2]);
    };

    /**
     * Test if this Triangle contains the Edge object given as parameter as its
     * bounding edges. Only point references are compared, not values.
     * @return <code>True</code> if the Edge object is of the Triangle's bounding
     *         edges, <code>false</code> otherwise.
     */
    Triangle.prototype.containsEdge = function(edge) {
        return this.containsPoint(edge.p) && this.containsPoint(edge.q);
    };
    Triangle.prototype.containsPoints = function(p1, p2) {
        return this.containsPoint(p1) && this.containsPoint(p2);
    };


    Triangle.prototype.isInterior = function() {
        return this.interior_;
    };
    Triangle.prototype.setInterior = function(interior) {
        this.interior_ = interior;
        return this;
    };

    /**
     * Update neighbor pointers.
     * @param {Point} p1 Point object.
     * @param {Point} p2 Point object.
     * @param {Triangle} t Triangle object.
     */
    Triangle.prototype.markNeighborPointers = function(p1, p2, t) {
        var points = this.points_;
        // Here we are comparing point references, not values
        if ((p1 === points[2] && p2 === points[1]) || (p1 === points[1] && p2 === points[2])) {
            this.neighbors_[0] = t;
        } else if ((p1 === points[0] && p2 === points[2]) || (p1 === points[2] && p2 === points[0])) {
            this.neighbors_[1] = t;
        } else if ((p1 === points[0] && p2 === points[1]) || (p1 === points[1] && p2 === points[0])) {
            this.neighbors_[2] = t;
        } else {
            throw new Error('poly2tri Invalid Triangle.markNeighborPointers() call');
        }
    };

    /**
     * Exhaustive search to update neighbor pointers
     * @param {Triangle} t
     */
    Triangle.prototype.markNeighbor = function(t) {
        var points = this.points_;
        if (t.containsPoints(points[1], points[2])) {
            this.neighbors_[0] = t;
            t.markNeighborPointers(points[1], points[2], this);
        } else if (t.containsPoints(points[0], points[2])) {
            this.neighbors_[1] = t;
            t.markNeighborPointers(points[0], points[2], this);
        } else if (t.containsPoints(points[0], points[1])) {
            this.neighbors_[2] = t;
            t.markNeighborPointers(points[0], points[1], this);
        }
    };


    Triangle.prototype.clearNeigbors = function() {
        this.neighbors_[0] = null;
        this.neighbors_[1] = null;
        this.neighbors_[2] = null;
    };

    Triangle.prototype.clearDelunayEdges = function() {
        this.delaunay_edge[0] = false;
        this.delaunay_edge[1] = false;
        this.delaunay_edge[2] = false;
    };

    /**
     * Returns the point clockwise to the given point.
     */
    Triangle.prototype.pointCW = function(p) {
        var points = this.points_;
        // Here we are comparing point references, not values
        if (p === points[0]) {
            return points[2];
        } else if (p === points[1]) {
            return points[0];
        } else if (p === points[2]) {
            return points[1];
        } else {
            return null;
        }
    };

    /**
     * Returns the point counter-clockwise to the given point.
     */
    Triangle.prototype.pointCCW = function(p) {
        var points = this.points_;
        // Here we are comparing point references, not values
        if (p === points[0]) {
            return points[1];
        } else if (p === points[1]) {
            return points[2];
        } else if (p === points[2]) {
            return points[0];
        } else {
            return null;
        }
    };

    /**
     * Returns the neighbor clockwise to given point.
     */
    Triangle.prototype.neighborCW = function(p) {
        // Here we are comparing point references, not values
        if (p === this.points_[0]) {
            return this.neighbors_[1];
        } else if (p === this.points_[1]) {
            return this.neighbors_[2];
        } else {
            return this.neighbors_[0];
        }
    };

    /**
     * Returns the neighbor counter-clockwise to given point.
     */
    Triangle.prototype.neighborCCW = function(p) {
        // Here we are comparing point references, not values
        if (p === this.points_[0]) {
            return this.neighbors_[2];
        } else if (p === this.points_[1]) {
            return this.neighbors_[0];
        } else {
            return this.neighbors_[1];
        }
    };

    Triangle.prototype.getConstrainedEdgeCW = function(p) {
        // Here we are comparing point references, not values
        if (p === this.points_[0]) {
            return this.constrained_edge[1];
        } else if (p === this.points_[1]) {
            return this.constrained_edge[2];
        } else {
            return this.constrained_edge[0];
        }
    };

    Triangle.prototype.getConstrainedEdgeCCW = function(p) {
        // Here we are comparing point references, not values
        if (p === this.points_[0]) {
            return this.constrained_edge[2];
        } else if (p === this.points_[1]) {
            return this.constrained_edge[0];
        } else {
            return this.constrained_edge[1];
        }
    };

    Triangle.prototype.setConstrainedEdgeCW = function(p, ce) {
        // Here we are comparing point references, not values
        if (p === this.points_[0]) {
            this.constrained_edge[1] = ce;
        } else if (p === this.points_[1]) {
            this.constrained_edge[2] = ce;
        } else {
            this.constrained_edge[0] = ce;
        }
    };

    Triangle.prototype.setConstrainedEdgeCCW = function(p, ce) {
        // Here we are comparing point references, not values
        if (p === this.points_[0]) {
            this.constrained_edge[2] = ce;
        } else if (p === this.points_[1]) {
            this.constrained_edge[0] = ce;
        } else {
            this.constrained_edge[1] = ce;
        }
    };

    Triangle.prototype.getDelaunayEdgeCW = function(p) {
        // Here we are comparing point references, not values
        if (p === this.points_[0]) {
            return this.delaunay_edge[1];
        } else if (p === this.points_[1]) {
            return this.delaunay_edge[2];
        } else {
            return this.delaunay_edge[0];
        }
    };

    Triangle.prototype.getDelaunayEdgeCCW = function(p) {
        // Here we are comparing point references, not values
        if (p === this.points_[0]) {
            return this.delaunay_edge[2];
        } else if (p === this.points_[1]) {
            return this.delaunay_edge[0];
        } else {
            return this.delaunay_edge[1];
        }
    };

    Triangle.prototype.setDelaunayEdgeCW = function(p, e) {
        // Here we are comparing point references, not values
        if (p === this.points_[0]) {
            this.delaunay_edge[1] = e;
        } else if (p === this.points_[1]) {
            this.delaunay_edge[2] = e;
        } else {
            this.delaunay_edge[0] = e;
        }
    };

    Triangle.prototype.setDelaunayEdgeCCW = function(p, e) {
        // Here we are comparing point references, not values
        if (p === this.points_[0]) {
            this.delaunay_edge[2] = e;
        } else if (p === this.points_[1]) {
            this.delaunay_edge[0] = e;
        } else {
            this.delaunay_edge[1] = e;
        }
    };

    /**
     * The neighbor across to given point.
     */
    Triangle.prototype.neighborAcross = function(p) {
        // Here we are comparing point references, not values
        if (p === this.points_[0]) {
            return this.neighbors_[0];
        } else if (p === this.points_[1]) {
            return this.neighbors_[1];
        } else {
            return this.neighbors_[2];
        }
    };

    Triangle.prototype.oppositePoint = function(t, p) {
        var cw = t.pointCW(p);
        return this.pointCW(cw);
    };

    /**
     * Legalize triangle by rotating clockwise around oPoint
     * @param {Point} opoint
     * @param {Point} npoint
     */
    Triangle.prototype.legalize = function(opoint, npoint) {
        var points = this.points_;
        // Here we are comparing point references, not values
        if (opoint === points[0]) {
            points[1] = points[0];
            points[0] = points[2];
            points[2] = npoint;
        } else if (opoint === points[1]) {
            points[2] = points[1];
            points[1] = points[0];
            points[0] = npoint;
        } else if (opoint === points[2]) {
            points[0] = points[2];
            points[2] = points[1];
            points[1] = npoint;
        } else {
            throw new Error('poly2tri Invalid Triangle.legalize() call');
        }
    };

    /**
     * Returns the index of a point in the triangle. 
     * The point *must* be a reference to one of the triangle's vertices.
     * @param {Point} p Point object
     * @returns {Number} index 0, 1 or 2
     */
    Triangle.prototype.index = function(p) {
        var points = this.points_;
        // Here we are comparing point references, not values
        if (p === points[0]) {
            return 0;
        } else if (p === points[1]) {
            return 1;
        } else if (p === points[2]) {
            return 2;
        } else {
            throw new Error('poly2tri Invalid Triangle.index() call');
        }
    };

    Triangle.prototype.edgeIndex = function(p1, p2) {
        var points = this.points_;
        // Here we are comparing point references, not values
        if (p1 === points[0]) {
            if (p2 === points[1]) {
                return 2;
            } else if (p2 === points[2]) {
                return 1;
            }
        } else if (p1 === points[1]) {
            if (p2 === points[2]) {
                return 0;
            } else if (p2 === points[0]) {
                return 2;
            }
        } else if (p1 === points[2]) {
            if (p2 === points[0]) {
                return 1;
            } else if (p2 === points[1]) {
                return 0;
            }
        }
        return -1;
    };

    /**
     * Mark an edge of this triangle as constrained.<br>
     * This method takes either 1 parameter (an edge index or an Edge instance) or
     * 2 parameters (two Point instances defining the edge of the triangle).
     */
    Triangle.prototype.markConstrainedEdgeByIndex = function(index) {
        this.constrained_edge[index] = true;
    };
    Triangle.prototype.markConstrainedEdgeByEdge = function(edge) {
        this.markConstrainedEdgeByPoints(edge.p, edge.q);
    };
    Triangle.prototype.markConstrainedEdgeByPoints = function(p, q) {
        var points = this.points_;
        // Here we are comparing point references, not values        
        if ((q === points[0] && p === points[1]) || (q === points[1] && p === points[0])) {
            this.constrained_edge[2] = true;
        } else if ((q === points[0] && p === points[2]) || (q === points[2] && p === points[0])) {
            this.constrained_edge[1] = true;
        } else if ((q === points[1] && p === points[2]) || (q === points[2] && p === points[1])) {
            this.constrained_edge[0] = true;
        }
    };

// ------------------------------------------------------------------------utils
    var PI_3div4 = 3 * Math.PI / 4;
    var PI_2 = Math.PI / 2;
    var EPSILON = 1e-12;

    /* 
     * Inital triangle factor, seed triangle will extend 30% of
     * PointSet width to both left and right.
     */
    var kAlpha = 0.3;

    var Orientation = {
        "CW": 1,
        "CCW": -1,
        "COLLINEAR": 0
    };

    /**
     * Forumla to calculate signed area<br>
     * Positive if CCW<br>
     * Negative if CW<br>
     * 0 if collinear<br>
     * <pre>
     * A[P1,P2,P3]  =  (x1*y2 - y1*x2) + (x2*y3 - y2*x3) + (x3*y1 - y3*x1)
     *              =  (x1-x3)*(y2-y3) - (y1-y3)*(x2-x3)
     * </pre>
     */
    function orient2d(pa, pb, pc) {
        var detleft = (pa.x - pc.x) * (pb.y - pc.y);
        var detright = (pa.y - pc.y) * (pb.x - pc.x);
        var val = detleft - detright;
        if (val > -(EPSILON) && val < (EPSILON)) {
            return Orientation.COLLINEAR;
        } else if (val > 0) {
            return Orientation.CCW;
        } else {
            return Orientation.CW;
        }
    }

    function inScanArea(pa, pb, pc, pd) {
        var pdx = pd.x;
        var pdy = pd.y;
        var adx = pa.x - pdx;
        var ady = pa.y - pdy;
        var bdx = pb.x - pdx;
        var bdy = pb.y - pdy;

        var adxbdy = adx * bdy;
        var bdxady = bdx * ady;
        var oabd = adxbdy - bdxady;

        if (oabd <= (EPSILON)) {
            return false;
        }

        var cdx = pc.x - pdx;
        var cdy = pc.y - pdy;

        var cdxady = cdx * ady;
        var adxcdy = adx * cdy;
        var ocad = cdxady - adxcdy;

        if (ocad <= (EPSILON)) {
            return false;
        }

        return true;
    }

// ---------------------------------------------------------------AdvancingFront
    /**
     * Advancing front node
     * @param {Point} p any "Point like" object with {x,y} (duck typing)
     * @param {Triangle} t triangle (optionnal)
     */
    var Node = function(p, t) {
        this.point = p;
        this.triangle = t || null;

        this.next = null; // Node
        this.prev = null; // Node

        this.value = p.x;
    };

    var AdvancingFront = function(head, tail) {
        this.head_ = head; // Node
        this.tail_ = tail; // Node
        this.search_node_ = head; // Node
    };

    AdvancingFront.prototype.head = function() {
        return this.head_;
    };

    AdvancingFront.prototype.setHead = function(node) {
        this.head_ = node;
    };

    AdvancingFront.prototype.tail = function() {
        return this.tail_;
    };

    AdvancingFront.prototype.setTail = function(node) {
        this.tail_ = node;
    };

    AdvancingFront.prototype.search = function() {
        return this.search_node_;
    };

    AdvancingFront.prototype.setSearch = function(node) {
        this.search_node_ = node;
    };

    AdvancingFront.prototype.findSearchNode = function(/*x*/) {
        // TODO: implement BST index
        return this.search_node_;
    };

    AdvancingFront.prototype.locateNode = function(x) {
        var node = this.search_node_;

        /* jshint boss:true */
        if (x < node.value) {
            while (node = node.prev) {
                if (x >= node.value) {
                    this.search_node_ = node;
                    return node;
                }
            }
        } else {
            while (node = node.next) {
                if (x < node.value) {
                    this.search_node_ = node.prev;
                    return node.prev;
                }
            }
        }
        return null;
    };

    AdvancingFront.prototype.locatePoint = function(point) {
        var px = point.x;
        var node = this.findSearchNode(px);
        var nx = node.point.x;

        if (px === nx) {
            // Here we are comparing point references, not values
            if (point !== node.point) {
                // We might have two nodes with same x value for a short time
                if (point === node.prev.point) {
                    node = node.prev;
                } else if (point === node.next.point) {
                    node = node.next;
                } else {
                    throw new Error('poly2tri Invalid AdvancingFront.locatePoint() call');
                }
            }
        } else if (px < nx) {
            /* jshint boss:true */
            while (node = node.prev) {
                if (point === node.point) {
                    break;
                }
            }
        } else {
            while (node = node.next) {
                if (point === node.point) {
                    break;
                }
            }
        }

        if (node) {
            this.search_node_ = node;
        }
        return node;
    };

// ------------------------------------------------------------------------Basin
    var Basin = function() {
        this.left_node = null; // Node
        this.bottom_node = null; // Node
        this.right_node = null; // Node
        this.width = 0.0; // number
        this.left_highest = false;
    };

    Basin.prototype.clear = function() {
        this.left_node = null;
        this.bottom_node = null;
        this.right_node = null;
        this.width = 0.0;
        this.left_highest = false;
    };

// --------------------------------------------------------------------EdgeEvent
    var EdgeEvent = function() {
        this.constrained_edge = null; // Edge
        this.right = false;
    };

// ----------------------------------------------------SweepContext (public API)
    /**
     * Constructor for the triangulation context.
     * It accepts a simple polyline, which defines the constrained edges.
     * Possible options are:
     *    cloneArrays:  if true, do a shallow copy of the Array parameters 
     *                  (contour, holes). Points inside arrays are never copied.
     *                  Default is false : keep a reference to the array arguments,
     *                  who will be modified in place.
     * @param {Array} contour  array of "Point like" objects with {x,y} (duck typing)
     * @param {Object} options  constructor options
     */
    var SweepContext = function(contour, options) {
        options = options || {};
        this.triangles_ = [];
        this.map_ = [];
        this.points_ = (options.cloneArrays ? contour.slice(0) : contour);
        this.edge_list = [];

        // Bounding box of all points. Computed at the start of the triangulation, 
        // it is stored in case it is needed by the caller.
        this.pmin_ = this.pmax_ = null;

        // Advancing front
        this.front_ = null; // AdvancingFront
        // head point used with advancing front
        this.head_ = null; // Point
        // tail point used with advancing front
        this.tail_ = null; // Point

        this.af_head_ = null; // Node
        this.af_middle_ = null; // Node
        this.af_tail_ = null; // Node

        this.basin = new Basin();
        this.edge_event = new EdgeEvent();

        this.initEdges(this.points_);
    };


    /**
     * Add a hole to the constraints
     * @param {Array} polyline  array of "Point like" objects with {x,y} (duck typing)
     */
    SweepContext.prototype.addHole = function(polyline) {
        this.initEdges(polyline);
        var i, len = polyline.length;
        for (i = 0; i < len; i++) {
            this.points_.push(polyline[i]);
        }
        return this; // for chaining
    };
    // Backward compatibility
    SweepContext.prototype.AddHole = SweepContext.prototype.addHole;


    /**
     * Add a Steiner point to the constraints
     * @param {Point} point     any "Point like" object with {x,y} (duck typing)
     */
    SweepContext.prototype.addPoint = function(point) {
        this.points_.push(point);
        return this; // for chaining
    };
    // Backward compatibility
    SweepContext.prototype.AddPoint = SweepContext.prototype.addPoint;


    /**
     * Add several Steiner points to the constraints
     * @param {array<Point>} points     array of "Point like" object with {x,y} 
     */
    // Method added in the JavaScript version (was not present in the c++ version)
    SweepContext.prototype.addPoints = function(points) {
        this.points_ = this.points_.concat(points);
        return this; // for chaining
    };


    /**
     * Triangulate the polygon with holes and Steiner points.
     */
    // Shortcut method for Sweep.triangulate(SweepContext).
    // Method added in the JavaScript version (was not present in the c++ version)
    SweepContext.prototype.triangulate = function() {
        Sweep.triangulate(this);
        return this; // for chaining
    };


    /**
     * Get the bounding box of the provided constraints (contour, holes and 
     * Steinter points). Warning : these values are not available if the triangulation 
     * has not been done yet.
     * @returns {Object} object with 'min' and 'max' Point
     */
    // Method added in the JavaScript version (was not present in the c++ version)
    SweepContext.prototype.getBoundingBox = function() {
        return {min: this.pmin_, max: this.pmax_};
    };

    /**
     * Get result of triangulation
     * @returns {array<Triangle>}   array of triangles
     */
    SweepContext.prototype.getTriangles = function() {
        return this.triangles_;
    };
    // Backward compatibility
    SweepContext.prototype.GetTriangles = SweepContext.prototype.getTriangles;


// ---------------------------------------------------SweepContext (private API)

    SweepContext.prototype.front = function() {
        return this.front_;
    };

    SweepContext.prototype.pointCount = function() {
        return this.points_.length;
    };

    SweepContext.prototype.head = function() {
        return this.head_;
    };

    SweepContext.prototype.setHead = function(p1) {
        this.head_ = p1;
    };

    SweepContext.prototype.tail = function() {
        return this.tail_;
    };

    SweepContext.prototype.setTail = function(p1) {
        this.tail_ = p1;
    };

    SweepContext.prototype.getMap = function() {
        return this.map_;
    };

    SweepContext.prototype.initTriangulation = function() {
        var xmax = this.points_[0].x;
        var xmin = this.points_[0].x;
        var ymax = this.points_[0].y;
        var ymin = this.points_[0].y;

        // Calculate bounds
        var i, len = this.points_.length;
        for (i = 1; i < len; i++) {
            var p = this.points_[i];
            /* jshint expr:true */
            (p.x > xmax) && (xmax = p.x);
            (p.x < xmin) && (xmin = p.x);
            (p.y > ymax) && (ymax = p.y);
            (p.y < ymin) && (ymin = p.y);
        }
        this.pmin_ = new Point(xmin, ymin);
        this.pmax_ = new Point(xmax, ymax);

        var dx = kAlpha * (xmax - xmin);
        var dy = kAlpha * (ymax - ymin);
        this.head_ = new Point(xmax + dx, ymin - dy);
        this.tail_ = new Point(xmin - dx, ymin - dy);

        // Sort points along y-axis
        this.points_.sort(Point.compare);
    };

    SweepContext.prototype.initEdges = function(polyline) {
        var i, len = polyline.length;
        for (i = 0; i < len; ++i) {
            this.edge_list.push(new Edge(polyline[i], polyline[(i + 1) % len]));
        }
    };

    SweepContext.prototype.getPoint = function(index) {
        return this.points_[index];
    };

    SweepContext.prototype.addToMap = function(triangle) {
        this.map_.push(triangle);
    };

    SweepContext.prototype.locateNode = function(point) {
        return this.front_.locateNode(point.x);
    };

    SweepContext.prototype.createAdvancingFront = function() {
        var head;
        var middle;
        var tail;
        // Initial triangle
        var triangle = new Triangle(this.points_[0], this.tail_, this.head_);

        this.map_.push(triangle);

        head = new Node(triangle.getPoint(1), triangle);
        middle = new Node(triangle.getPoint(0), triangle);
        tail = new Node(triangle.getPoint(2));

        this.front_ = new AdvancingFront(head, tail);

        head.next = middle;
        middle.next = tail;
        middle.prev = head;
        tail.prev = middle;
    };

    SweepContext.prototype.removeNode = function(node) {
        // do nothing
        /* jshint unused:false */
    };

    SweepContext.prototype.mapTriangleToNodes = function(t) {
        for (var i = 0; i < 3; ++i) {
            if (! t.getNeighbor(i)) {
                var n = this.front_.locatePoint(t.pointCW(t.getPoint(i)));
                if (n) {
                    n.triangle = t;
                }
            }
        }
    };

    SweepContext.prototype.removeFromMap = function(triangle) {
        var i, map = this.map_, len = map.length;
        for (i = 0; i < len; i++) {
            if (map[i] === triangle) {
                map.splice(i, 1);
                break;
            }
        }
    };

    /**
     * Do a depth first traversal to collect triangles
     * @param {Triangle} triangle start
     */
    SweepContext.prototype.meshClean = function(triangle) {
        // New implementation avoids recursive calls and use a loop instead.
        // Cf. issues # 57, 65 and 69.
        var triangles = [triangle], t, i;
        /* jshint boss:true */
        while (t = triangles.pop()) {
            if (!t.isInterior()) {
                t.setInterior(true);
                this.triangles_.push(t);
                for (i = 0; i < 3; i++) {
                    if (!t.constrained_edge[i]) {
                        triangles.push(t.getNeighbor(i));
                    }
                }
            }
        }
    };

// ------------------------------------------------------------------------Sweep

    /**
     * The 'Sweep' object is present in order to keep this JavaScript version 
     * as close as possible to the reference C++ version, even though almost
     * all Sweep methods could be declared as members of the SweepContext object.
     */
    var Sweep = {};


    /**
     * Triangulate the polygon with holes and Steiner points.
     * @param   tcx SweepContext object.
     */
    Sweep.triangulate = function(tcx) {
        tcx.initTriangulation();
        tcx.createAdvancingFront();
        // Sweep points; build mesh
        Sweep.sweepPoints(tcx);
        // Clean up
        Sweep.finalizationPolygon(tcx);
    };

    Sweep.sweepPoints = function(tcx) {
        var i, len = tcx.pointCount();
        for (i = 1; i < len; ++i) {
            var point = tcx.getPoint(i);
            var node = Sweep.pointEvent(tcx, point);
            var edges = point._p2t_edge_list;
            for (var j = 0; edges && j < edges.length; ++j) {
                Sweep.edgeEventByEdge(tcx, edges[j], node);
            }
        }
    };

    Sweep.finalizationPolygon = function(tcx) {
        // Get an Internal triangle to start with
        var t = tcx.front().head().next.triangle;
        var p = tcx.front().head().next.point;
        while (!t.getConstrainedEdgeCW(p)) {
            t = t.neighborCCW(p);
        }

        // Collect interior triangles constrained by edges
        tcx.meshClean(t);
    };

    /**
     * Find closes node to the left of the new point and
     * create a new triangle. If needed new holes and basins
     * will be filled to.
     */
    Sweep.pointEvent = function(tcx, point) {
        var node = tcx.locateNode(point);
        var new_node = Sweep.newFrontTriangle(tcx, point, node);

        // Only need to check +epsilon since point never have smaller
        // x value than node due to how we fetch nodes from the front
        if (point.x <= node.point.x + (EPSILON)) {
            Sweep.fill(tcx, node);
        }

        //tcx.AddNode(new_node);

        Sweep.fillAdvancingFront(tcx, new_node);
        return new_node;
    };

    Sweep.edgeEventByEdge = function(tcx, edge, node) {
        tcx.edge_event.constrained_edge = edge;
        tcx.edge_event.right = (edge.p.x > edge.q.x);

        if (Sweep.isEdgeSideOfTriangle(node.triangle, edge.p, edge.q)) {
            return;
        }

        // For now we will do all needed filling
        // TODO: integrate with flip process might give some better performance
        //       but for now this avoid the issue with cases that needs both flips and fills
        Sweep.fillEdgeEvent(tcx, edge, node);
        Sweep.edgeEventByPoints(tcx, edge.p, edge.q, node.triangle, edge.q);
    };

    Sweep.edgeEventByPoints = function(tcx, ep, eq, triangle, point) {
        if (Sweep.isEdgeSideOfTriangle(triangle, ep, eq)) {
            return;
        }

        var p1 = triangle.pointCCW(point);
        var o1 = orient2d(eq, p1, ep);
        if (o1 === Orientation.COLLINEAR) {
            // TODO integrate here changes from C++ version
            throw new PointError('poly2tri EdgeEvent: Collinear not supported!', [eq, p1, ep]);
        }

        var p2 = triangle.pointCW(point);
        var o2 = orient2d(eq, p2, ep);
        if (o2 === Orientation.COLLINEAR) {
            // TODO integrate here changes from C++ version
            throw new PointError('poly2tri EdgeEvent: Collinear not supported!', [eq, p2, ep]);
        }

        if (o1 === o2) {
            // Need to decide if we are rotating CW or CCW to get to a triangle
            // that will cross edge
            if (o1 === Orientation.CW) {
                triangle = triangle.neighborCCW(point);
            } else {
                triangle = triangle.neighborCW(point);
            }
            Sweep.edgeEventByPoints(tcx, ep, eq, triangle, point);
        } else {
            // This triangle crosses constraint so lets flippin start!
            Sweep.flipEdgeEvent(tcx, ep, eq, triangle, point);
        }
    };

    Sweep.isEdgeSideOfTriangle = function(triangle, ep, eq) {
        var index = triangle.edgeIndex(ep, eq);
        if (index !== -1) {
            triangle.markConstrainedEdgeByIndex(index);
            var t = triangle.getNeighbor(index);
            if (t) {
                t.markConstrainedEdgeByPoints(ep, eq);
            }
            return true;
        }
        return false;
    };

    Sweep.newFrontTriangle = function(tcx, point, node) {
        var triangle = new Triangle(point, node.point, node.next.point);

        triangle.markNeighbor(node.triangle);
        tcx.addToMap(triangle);

        var new_node = new Node(point);
        new_node.next = node.next;
        new_node.prev = node;
        node.next.prev = new_node;
        node.next = new_node;

        if (!Sweep.legalize(tcx, triangle)) {
            tcx.mapTriangleToNodes(triangle);
        }

        return new_node;
    };

    /**
     * Adds a triangle to the advancing front to fill a hole.
     * @param tcx
     * @param node - middle node, that is the bottom of the hole
     */
    Sweep.fill = function(tcx, node) {
        var triangle = new Triangle(node.prev.point, node.point, node.next.point);

        // TODO: should copy the constrained_edge value from neighbor triangles
        //       for now constrained_edge values are copied during the legalize
        triangle.markNeighbor(node.prev.triangle);
        triangle.markNeighbor(node.triangle);

        tcx.addToMap(triangle);

        // Update the advancing front
        node.prev.next = node.next;
        node.next.prev = node.prev;


        // If it was legalized the triangle has already been mapped
        if (!Sweep.legalize(tcx, triangle)) {
            tcx.mapTriangleToNodes(triangle);
        }

        //tcx.removeNode(node);
    };

    /**
     * Fills holes in the Advancing Front
     */
    Sweep.fillAdvancingFront = function(tcx, n) {
        // Fill right holes
        var node = n.next;
        var angle;
        while (node.next) {
            angle = Sweep.holeAngle(node);
            if (angle > PI_2 || angle < -(PI_2)) {
                break;
            }
            Sweep.fill(tcx, node);
            node = node.next;
        }

        // Fill left holes
        node = n.prev;
        while (node.prev) {
            angle = Sweep.holeAngle(node);
            if (angle > PI_2 || angle < -(PI_2)) {
                break;
            }
            Sweep.fill(tcx, node);
            node = node.prev;
        }

        // Fill right basins
        if (n.next && n.next.next) {
            angle = Sweep.basinAngle(n);
            if (angle < PI_3div4) {
                Sweep.fillBasin(tcx, n);
            }
        }
    };

    Sweep.basinAngle = function(node) {
        var ax = node.point.x - node.next.next.point.x;
        var ay = node.point.y - node.next.next.point.y;
        return Math.atan2(ay, ax);
    };

    /**
     *
     * @param node - middle node
     * @return the angle between 3 front nodes
     */
    Sweep.holeAngle = function(node) {
        /* Complex plane
         * ab = cosA +i*sinA
         * ab = (ax + ay*i)(bx + by*i) = (ax*bx + ay*by) + i(ax*by-ay*bx)
         * atan2(y,x) computes the principal value of the argument function
         * applied to the complex number x+iy
         * Where x = ax*bx + ay*by
         *       y = ax*by - ay*bx
         */
        var ax = node.next.point.x - node.point.x;
        var ay = node.next.point.y - node.point.y;
        var bx = node.prev.point.x - node.point.x;
        var by = node.prev.point.y - node.point.y;
        return Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
    };

    /**
     * Returns true if triangle was legalized
     */
    Sweep.legalize = function(tcx, t) {
        // To legalize a triangle we start by finding if any of the three edges
        // violate the Delaunay condition
        for (var i = 0; i < 3; ++i) {
            if (t.delaunay_edge[i]) {
                continue;
            }
            var ot = t.getNeighbor(i);
            if (ot) {
                var p = t.getPoint(i);
                var op = ot.oppositePoint(t, p);
                var oi = ot.index(op);

                // If this is a Constrained Edge or a Delaunay Edge(only during recursive legalization)
                // then we should not try to legalize
                if (ot.constrained_edge[oi] || ot.delaunay_edge[oi]) {
                    t.constrained_edge[i] = ot.constrained_edge[oi];
                    continue;
                }

                var inside = Sweep.inCircle(p, t.pointCCW(p), t.pointCW(p), op);
                if (inside) {
                    // Lets mark this shared edge as Delaunay
                    t.delaunay_edge[i] = true;
                    ot.delaunay_edge[oi] = true;

                    // Lets rotate shared edge one vertex CW to legalize it
                    Sweep.rotateTrianglePair(t, p, ot, op);

                    // We now got one valid Delaunay Edge shared by two triangles
                    // This gives us 4 new edges to check for Delaunay

                    // Make sure that triangle to node mapping is done only one time for a specific triangle
                    var not_legalized = !Sweep.legalize(tcx, t);
                    if (not_legalized) {
                        tcx.mapTriangleToNodes(t);
                    }

                    not_legalized = !Sweep.legalize(tcx, ot);
                    if (not_legalized) {
                        tcx.mapTriangleToNodes(ot);
                    }
                    // Reset the Delaunay edges, since they only are valid Delaunay edges
                    // until we add a new triangle or point.
                    // XXX: need to think about this. Can these edges be tried after we
                    //      return to previous recursive level?
                    t.delaunay_edge[i] = false;
                    ot.delaunay_edge[oi] = false;

                    // If triangle have been legalized no need to check the other edges since
                    // the recursive legalization will handles those so we can end here.
                    return true;
                }
            }
        }
        return false;
    };

    /**
     * <b>Requirement</b>:<br>
     * 1. a,b and c form a triangle.<br>
     * 2. a and d is know to be on opposite side of bc<br>
     * <pre>
     *                a
     *                +
     *               / \
     *              /   \
     *            b/     \c
     *            +-------+
     *           /    d    \
     *          /           \
     * </pre>
     * <b>Fact</b>: d has to be in area B to have a chance to be inside the circle formed by
     *  a,b and c<br>
     *  d is outside B if orient2d(a,b,d) or orient2d(c,a,d) is CW<br>
     *  This preknowledge gives us a way to optimize the incircle test
     * @param pa - triangle point, opposite d
     * @param pb - triangle point
     * @param pc - triangle point
     * @param pd - point opposite a
     * @return true if d is inside circle, false if on circle edge
     */
    Sweep.inCircle = function(pa, pb, pc, pd) {
        var adx = pa.x - pd.x;
        var ady = pa.y - pd.y;
        var bdx = pb.x - pd.x;
        var bdy = pb.y - pd.y;

        var adxbdy = adx * bdy;
        var bdxady = bdx * ady;
        var oabd = adxbdy - bdxady;
        if (oabd <= 0) {
            return false;
        }

        var cdx = pc.x - pd.x;
        var cdy = pc.y - pd.y;

        var cdxady = cdx * ady;
        var adxcdy = adx * cdy;
        var ocad = cdxady - adxcdy;
        if (ocad <= 0) {
            return false;
        }

        var bdxcdy = bdx * cdy;
        var cdxbdy = cdx * bdy;

        var alift = adx * adx + ady * ady;
        var blift = bdx * bdx + bdy * bdy;
        var clift = cdx * cdx + cdy * cdy;

        var det = alift * (bdxcdy - cdxbdy) + blift * ocad + clift * oabd;
        return det > 0;
    };

    /**
     * Rotates a triangle pair one vertex CW
     *<pre>
     *       n2                    n2
     *  P +-----+             P +-----+
     *    | t  /|               |\  t |
     *    |   / |               | \   |
     *  n1|  /  |n3           n1|  \  |n3
     *    | /   |    after CW   |   \ |
     *    |/ oT |               | oT \|
     *    +-----+ oP            +-----+
     *       n4                    n4
     * </pre>
     */
    Sweep.rotateTrianglePair = function(t, p, ot, op) {
        var n1, n2, n3, n4;
        n1 = t.neighborCCW(p);
        n2 = t.neighborCW(p);
        n3 = ot.neighborCCW(op);
        n4 = ot.neighborCW(op);

        var ce1, ce2, ce3, ce4;
        ce1 = t.getConstrainedEdgeCCW(p);
        ce2 = t.getConstrainedEdgeCW(p);
        ce3 = ot.getConstrainedEdgeCCW(op);
        ce4 = ot.getConstrainedEdgeCW(op);

        var de1, de2, de3, de4;
        de1 = t.getDelaunayEdgeCCW(p);
        de2 = t.getDelaunayEdgeCW(p);
        de3 = ot.getDelaunayEdgeCCW(op);
        de4 = ot.getDelaunayEdgeCW(op);

        t.legalize(p, op);
        ot.legalize(op, p);

        // Remap delaunay_edge
        ot.setDelaunayEdgeCCW(p, de1);
        t.setDelaunayEdgeCW(p, de2);
        t.setDelaunayEdgeCCW(op, de3);
        ot.setDelaunayEdgeCW(op, de4);

        // Remap constrained_edge
        ot.setConstrainedEdgeCCW(p, ce1);
        t.setConstrainedEdgeCW(p, ce2);
        t.setConstrainedEdgeCCW(op, ce3);
        ot.setConstrainedEdgeCW(op, ce4);

        // Remap neighbors
        // XXX: might optimize the markNeighbor by keeping track of
        //      what side should be assigned to what neighbor after the
        //      rotation. Now mark neighbor does lots of testing to find
        //      the right side.
        t.clearNeigbors();
        ot.clearNeigbors();
        if (n1) {
            ot.markNeighbor(n1);
        }
        if (n2) {
            t.markNeighbor(n2);
        }
        if (n3) {
            t.markNeighbor(n3);
        }
        if (n4) {
            ot.markNeighbor(n4);
        }
        t.markNeighbor(ot);
    };

    /**
     * Fills a basin that has formed on the Advancing Front to the right
     * of given node.<br>
     * First we decide a left,bottom and right node that forms the
     * boundaries of the basin. Then we do a reqursive fill.
     *
     * @param tcx
     * @param node - starting node, this or next node will be left node
     */
    Sweep.fillBasin = function(tcx, node) {
        if (orient2d(node.point, node.next.point, node.next.next.point) === Orientation.CCW) {
            tcx.basin.left_node = node.next.next;
        } else {
            tcx.basin.left_node = node.next;
        }

        // Find the bottom and right node
        tcx.basin.bottom_node = tcx.basin.left_node;
        while (tcx.basin.bottom_node.next && tcx.basin.bottom_node.point.y >= tcx.basin.bottom_node.next.point.y) {
            tcx.basin.bottom_node = tcx.basin.bottom_node.next;
        }
        if (tcx.basin.bottom_node === tcx.basin.left_node) {
            // No valid basin
            return;
        }

        tcx.basin.right_node = tcx.basin.bottom_node;
        while (tcx.basin.right_node.next && tcx.basin.right_node.point.y < tcx.basin.right_node.next.point.y) {
            tcx.basin.right_node = tcx.basin.right_node.next;
        }
        if (tcx.basin.right_node === tcx.basin.bottom_node) {
            // No valid basins
            return;
        }

        tcx.basin.width = tcx.basin.right_node.point.x - tcx.basin.left_node.point.x;
        tcx.basin.left_highest = tcx.basin.left_node.point.y > tcx.basin.right_node.point.y;

        Sweep.fillBasinReq(tcx, tcx.basin.bottom_node);
    };

    /**
     * Recursive algorithm to fill a Basin with triangles
     *
     * @param tcx
     * @param node - bottom_node
     */
    Sweep.fillBasinReq = function(tcx, node) {
        // if shallow stop filling
        if (Sweep.isShallow(tcx, node)) {
            return;
        }

        Sweep.fill(tcx, node);

        var o;
        if (node.prev === tcx.basin.left_node && node.next === tcx.basin.right_node) {
            return;
        } else if (node.prev === tcx.basin.left_node) {
            o = orient2d(node.point, node.next.point, node.next.next.point);
            if (o === Orientation.CW) {
                return;
            }
            node = node.next;
        } else if (node.next === tcx.basin.right_node) {
            o = orient2d(node.point, node.prev.point, node.prev.prev.point);
            if (o === Orientation.CCW) {
                return;
            }
            node = node.prev;
        } else {
            // Continue with the neighbor node with lowest Y value
            if (node.prev.point.y < node.next.point.y) {
                node = node.prev;
            } else {
                node = node.next;
            }
        }

        Sweep.fillBasinReq(tcx, node);
    };

    Sweep.isShallow = function(tcx, node) {
        var height;
        if (tcx.basin.left_highest) {
            height = tcx.basin.left_node.point.y - node.point.y;
        } else {
            height = tcx.basin.right_node.point.y - node.point.y;
        }

        // if shallow stop filling
        if (tcx.basin.width > height) {
            return true;
        }
        return false;
    };

    Sweep.fillEdgeEvent = function(tcx, edge, node) {
        if (tcx.edge_event.right) {
            Sweep.fillRightAboveEdgeEvent(tcx, edge, node);
        } else {
            Sweep.fillLeftAboveEdgeEvent(tcx, edge, node);
        }
    };

    Sweep.fillRightAboveEdgeEvent = function(tcx, edge, node) {
        while (node.next.point.x < edge.p.x) {
            // Check if next node is below the edge
            if (orient2d(edge.q, node.next.point, edge.p) === Orientation.CCW) {
                Sweep.fillRightBelowEdgeEvent(tcx, edge, node);
            } else {
                node = node.next;
            }
        }
    };

    Sweep.fillRightBelowEdgeEvent = function(tcx, edge, node) {
        if (node.point.x < edge.p.x) {
            if (orient2d(node.point, node.next.point, node.next.next.point) === Orientation.CCW) {
                // Concave
                Sweep.fillRightConcaveEdgeEvent(tcx, edge, node);
            } else {
                // Convex
                Sweep.fillRightConvexEdgeEvent(tcx, edge, node);
                // Retry this one
                Sweep.fillRightBelowEdgeEvent(tcx, edge, node);
            }
        }
    };

    Sweep.fillRightConcaveEdgeEvent = function(tcx, edge, node) {
        Sweep.fill(tcx, node.next);
        if (node.next.point !== edge.p) {
            // Next above or below edge?
            if (orient2d(edge.q, node.next.point, edge.p) === Orientation.CCW) {
                // Below
                if (orient2d(node.point, node.next.point, node.next.next.point) === Orientation.CCW) {
                    // Next is concave
                    Sweep.fillRightConcaveEdgeEvent(tcx, edge, node);
                } else {
                    // Next is convex
                    /* jshint noempty:false */
                }
            }
        }
    };

    Sweep.fillRightConvexEdgeEvent = function(tcx, edge, node) {
        // Next concave or convex?
        if (orient2d(node.next.point, node.next.next.point, node.next.next.next.point) === Orientation.CCW) {
            // Concave
            Sweep.fillRightConcaveEdgeEvent(tcx, edge, node.next);
        } else {
            // Convex
            // Next above or below edge?
            if (orient2d(edge.q, node.next.next.point, edge.p) === Orientation.CCW) {
                // Below
                Sweep.fillRightConvexEdgeEvent(tcx, edge, node.next);
            } else {
                // Above
                /* jshint noempty:false */
            }
        }
    };

    Sweep.fillLeftAboveEdgeEvent = function(tcx, edge, node) {
        while (node.prev.point.x > edge.p.x) {
            // Check if next node is below the edge
            if (orient2d(edge.q, node.prev.point, edge.p) === Orientation.CW) {
                Sweep.fillLeftBelowEdgeEvent(tcx, edge, node);
            } else {
                node = node.prev;
            }
        }
    };

    Sweep.fillLeftBelowEdgeEvent = function(tcx, edge, node) {
        if (node.point.x > edge.p.x) {
            if (orient2d(node.point, node.prev.point, node.prev.prev.point) === Orientation.CW) {
                // Concave
                Sweep.fillLeftConcaveEdgeEvent(tcx, edge, node);
            } else {
                // Convex
                Sweep.fillLeftConvexEdgeEvent(tcx, edge, node);
                // Retry this one
                Sweep.fillLeftBelowEdgeEvent(tcx, edge, node);
            }
        }
    };

    Sweep.fillLeftConvexEdgeEvent = function(tcx, edge, node) {
        // Next concave or convex?
        if (orient2d(node.prev.point, node.prev.prev.point, node.prev.prev.prev.point) === Orientation.CW) {
            // Concave
            Sweep.fillLeftConcaveEdgeEvent(tcx, edge, node.prev);
        } else {
            // Convex
            // Next above or below edge?
            if (orient2d(edge.q, node.prev.prev.point, edge.p) === Orientation.CW) {
                // Below
                Sweep.fillLeftConvexEdgeEvent(tcx, edge, node.prev);
            } else {
                // Above
                /* jshint noempty:false */
            }
        }
    };

    Sweep.fillLeftConcaveEdgeEvent = function(tcx, edge, node) {
        Sweep.fill(tcx, node.prev);
        if (node.prev.point !== edge.p) {
            // Next above or below edge?
            if (orient2d(edge.q, node.prev.point, edge.p) === Orientation.CW) {
                // Below
                if (orient2d(node.point, node.prev.point, node.prev.prev.point) === Orientation.CW) {
                    // Next is concave
                    Sweep.fillLeftConcaveEdgeEvent(tcx, edge, node);
                } else {
                    // Next is convex
                    /* jshint noempty:false */
                }
            }
        }
    };

    Sweep.flipEdgeEvent = function(tcx, ep, eq, t, p) {
        var ot = t.neighborAcross(p);
        if (!ot) {
            // If we want to integrate the fillEdgeEvent do it here
            // With current implementation we should never get here
            throw new Error('poly2tri [BUG:FIXME] FLIP failed due to missing triangle!');
        }
        var op = ot.oppositePoint(t, p);

        if (inScanArea(p, t.pointCCW(p), t.pointCW(p), op)) {
            // Lets rotate shared edge one vertex CW
            Sweep.rotateTrianglePair(t, p, ot, op);
            tcx.mapTriangleToNodes(t);
            tcx.mapTriangleToNodes(ot);

            // XXX: in the original C++ code for the next 2 lines, we are
            // comparing point values (and not pointers). In this JavaScript
            // code, we are comparing point references (pointers). This works
            // because we can't have 2 different points with the same values.
            // But to be really equivalent, we should use "Point.equals" here.
            if (p === eq && op === ep) {
                if (eq === tcx.edge_event.constrained_edge.q && ep === tcx.edge_event.constrained_edge.p) {
                    t.markConstrainedEdgeByPoints(ep, eq);
                    ot.markConstrainedEdgeByPoints(ep, eq);
                    Sweep.legalize(tcx, t);
                    Sweep.legalize(tcx, ot);
                } else {
                    // XXX: I think one of the triangles should be legalized here?
                    /* jshint noempty:false */
                }
            } else {
                var o = orient2d(eq, op, ep);
                t = Sweep.nextFlipTriangle(tcx, o, t, ot, p, op);
                Sweep.flipEdgeEvent(tcx, ep, eq, t, p);
            }
        } else {
            var newP = Sweep.nextFlipPoint(ep, eq, ot, op);
            Sweep.flipScanEdgeEvent(tcx, ep, eq, t, ot, newP);
            Sweep.edgeEventByPoints(tcx, ep, eq, t, p);
        }
    };

    Sweep.nextFlipTriangle = function(tcx, o, t, ot, p, op) {
        var edge_index;
        if (o === Orientation.CCW) {
            // ot is not crossing edge after flip
            edge_index = ot.edgeIndex(p, op);
            ot.delaunay_edge[edge_index] = true;
            Sweep.legalize(tcx, ot);
            ot.clearDelunayEdges();
            return t;
        }

        // t is not crossing edge after flip
        edge_index = t.edgeIndex(p, op);

        t.delaunay_edge[edge_index] = true;
        Sweep.legalize(tcx, t);
        t.clearDelunayEdges();
        return ot;
    };

    Sweep.nextFlipPoint = function(ep, eq, ot, op) {
        var o2d = orient2d(eq, op, ep);
        if (o2d === Orientation.CW) {
            // Right
            return ot.pointCCW(op);
        } else if (o2d === Orientation.CCW) {
            // Left
            return ot.pointCW(op);
        } else {
            throw new PointError("poly2tri [Unsupported] nextFlipPoint: opposing point on constrained edge!", [eq, op, ep]);
        }
    };

    Sweep.flipScanEdgeEvent = function(tcx, ep, eq, flip_triangle, t, p) {
        var ot = t.neighborAcross(p);
        if (!ot) {
            // If we want to integrate the fillEdgeEvent do it here
            // With current implementation we should never get here
            throw new Error('poly2tri [BUG:FIXME] FLIP failed due to missing triangle');
        }
        var op = ot.oppositePoint(t, p);

        if (inScanArea(eq, flip_triangle.pointCCW(eq), flip_triangle.pointCW(eq), op)) {
            // flip with new edge op.eq
            Sweep.flipEdgeEvent(tcx, eq, op, ot, op);
            // TODO: Actually I just figured out that it should be possible to
            //       improve this by getting the next ot and op before the the above
            //       flip and continue the flipScanEdgeEvent here
            // set new ot and op here and loop back to inScanArea test
            // also need to set a new flip_triangle first
            // Turns out at first glance that this is somewhat complicated
            // so it will have to wait.
        } else {
            var newP = Sweep.nextFlipPoint(ep, eq, ot, op);
            Sweep.flipScanEdgeEvent(tcx, ep, eq, flip_triangle, ot, newP);
        }
    };

// ---------------------------------------------------------Exports (public API)

    poly2tri.PointError     = PointError;
    poly2tri.Point          = Point;
    poly2tri.Triangle       = Triangle;
    poly2tri.SweepContext   = SweepContext;

    // Backward compatibility
    poly2tri.triangulate    = Sweep.triangulate;
    poly2tri.sweep = {Triangulate: Sweep.triangulate};

}(this));
},{}],11:[function(require,module,exports){
"use strict"

var poly2tri = require('./poly2tri.js');
var SweepContext = poly2tri.SweepContext;
var vboMesh = require('./vboMesh.js');
var glMatrix = require('../js/gl-matrix-min.js');
var vec2 = glMatrix.vec2;

var numVbos = [];

function init(gl) {
  vboMesh.setGL(gl);
  for(var i=0;i<10;++i) {
    numVbos[i] = vboMesh.create();
    loadText("geometry/"+i+".txt",numVbos[i]);
  }
}

function loadText(filename, vbo) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET",filename);
  xhr.onreadystatechange = 
  function() {
    if(xhr.readyState == 4 && xhr.status == 200) {
      var outline = JSON.parse(xhr.responseText);
      makeTextVbo(vbo,outline);
    }
  }
  xhr.send();
}

var makeTextVbo = function(vbo,outline) {
  vboMesh.clear(vbo);
  var min = vec2.create();
  var max = vec2.create();
  vec2.copy(min,outline[0]);
  vec2.copy(max,outline[0]);
  for(var i=1;i<outline.length-1;++i) {
    var pt = outline[i];
    min = vec2.min(min,min,pt);
    max = vec2.max(max,max,pt);
  }
  //add bounding box
  vboMesh.addVertex(vbo,[0,0,0]);
  vboMesh.addVertex(vbo,[0,1,0]);
  vboMesh.addVertex(vbo,[1,1,0]);
  vboMesh.addVertex(vbo,[1,0,0]);

  var scaling = 0.9/(max[1]-min[1]);
  var triPts = [];
  var triPts2 = [];
  for(var i=0;i<outline.length-1;++i) {
    var pt = outline[i];
    vec2.sub(pt,pt,min);
    vec2.scale(pt,pt,scaling);
    pt[1] += .05;
    pt[0] += .1;
    pt[2] = 0;
    triPts.push({x:pt[0],y:pt[1],index:i+4});
    triPts2.push({x:pt[0],y:pt[1],index:i+4});
    vboMesh.addVertex(vbo,pt);
    pt[2] = 1.0;
    vboMesh.addVertex(vbo,pt);
  }
  var triangulation = new SweepContext(triPts);
  triangulation.triangulate();
  var triangles = triangulation.getTriangles();
  
  
  triPts2.reverse();
  for(var i=0;i<triPts2.length;++i) {
    triPts2[i]._p2t_edge_list = null;
  }
  var triangulation2 = new SweepContext([{x:0,y:0,index:0},{x:0,y:1,index:1},{x:1,y:1,index:2},{x:1,y:0,index:3}]);
  triangulation2.addHole(triPts2);
  triangulation2.triangulate();
  var triangles2 = triangulation2.getTriangles();
  
  //walls
  for(var i=0;i<outline.length-1;++i) {
    var iNext = (i+1)%(outline.length-1);
    vboMesh.addTriangle(vbo,i*2+4,i*2+1+4,iNext*2+1+4);
    vboMesh.addTriangle(vbo,i*2+4,iNext*2+1+4,iNext*2+4);
  }
  
  //top
  for(var i=0;i<triangles.length;++i) {
    var tri = triangles[i];
    vboMesh.addTriangle(vbo,getIndex(tri.points_[0].index)+1,getIndex(tri.points_[1].index)+1,getIndex(tri.points_[2].index)+1);
  }
  //bottom
  for(var i=0;i<triangles2.length;++i) {
    var tri = triangles2[i];
    vboMesh.addTriangle(vbo,getIndex(tri.points_[0].index),getIndex(tri.points_[1].index),getIndex(tri.points_[2].index));
  }
}

function getIndex(i) {
  if(i < 4) return i;
  return (i-4)*2+4;
}

exports.init = init;
exports.numVbos = numVbos;
},{"../js/gl-matrix-min.js":14,"./poly2tri.js":10,"./vboMesh.js":12}],12:[function(require,module,exports){
var glMatrix = require('../js/gl-matrix-min.js');
var vec3 = glMatrix.vec3;


(function(_global) { 
  "use strict";

  var shim = {};
  if (typeof(exports) === 'undefined') {
    if(typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
      shim.exports = {};
      define(function() {
        return shim.exports;
      });
    } else {
      //this thing lives in a browser, define its namespaces in global
      shim.exports = typeof(window) !== 'undefined' ? window : _global;
    }
  }
  else {
    //this thing lives in commonjs, define its namespaces in exports
    shim.exports = exports;
  }
  (function(exports) {
  
var gl;
var vboMesh = exports;

vboMesh.setGL = function(_gl) {
  gl = _gl;
}

vboMesh.create = function() {
    var vbo = {};
    vbo.vertexData = new Float32Array(3*100);
    vbo.numVertices = 0;
    vbo.indexData = new Uint16Array(3*100);
    vbo.numIndices = 0;
    vbo.vertexBuffer = gl.createBuffer();
    vbo.indexBuffer = gl.createBuffer();
    vbo.numNormals = 0;
    vbo.normalsEnabled = false;
    vbo.normalData = null;
    vbo.colorEnabled = false;
    vbo.colorData= null;
    vbo.normalBuffer = null;
    vbo.colorBuffer = null;
    vbo.texCoordEnabled = false;
    vbo.texCoordData = null;
    vbo.texCoordBuffer = null;
    vbo.numTexCoords = 0;
    return vbo;
};

vboMesh.create32 = function() {
    var vbo = {};
    vbo.vertexData = new Float32Array(3*1000);
    vbo.numVertices = 0;
    vbo.indexData = new Uint32Array(3*1000);
    vbo.numIndices = 0;
    vbo.vertexBuffer = gl.createBuffer();
    vbo.indexBuffer = gl.createBuffer();
    vbo.normalsEnabled = false;
    vbo.numNormals = 0;
    vbo.normalData = null;
    vbo.colorData= null;
    vbo.normalBuffer = null;
    vbo.colorBuffer = null;
    return vbo;
};

vboMesh.clear = function(vbo) {
    vbo.numVertices = 0;
    vbo.numIndices = 0;
    vbo.numNormals = 0;
    vbo.numTexCoords = 0;
}

vboMesh.enableNormals = function(vbo) {
    if(!vbo.normalsEnabled) {
        vbo.normalData = new Float32Array(vbo.vertexData.length);
        if(vbo.normalBuffer === null) vbo.normalBuffer = gl.createBuffer();
        vbo.normalsEnabled = true;
    }
}

vboMesh.disableNormals = function(vbo) {
    vbo.normalData = null;
    if(vbo.normalBuffer !== null) gl.deleteBuffer(vbo.normalBuffer);
    vbo.normalsEnabled = false;
}

vboMesh.enableColor = function(vbo) {
  if(!vbo.colorEnabled) {
    vbo.colorData = new Uint8Array(vbo.vertexData.length/3*4);
    if(vbo.colorBuffer === null) vbo.colorBuffer = gl.createBuffer();
    vbo.colorEnabled = true;
  }
}

vboMesh.disableColor = function(vbo) {
    vbo.colorData = null;
    if(vbo.colorBuffer !== null) gl.deleteBuffer(vbo.colorBuffer);
    vbo.colorEnabled = false;
}

vboMesh.enableTexCoord = function(vbo) {
  if(!vbo.texCoordEnabled) {
    vbo.texCoordData = new Float32Array(vbo.vertexData.length/3*2);
    if(vbo.texCoordBuffer === null) vbo.texCoordBuffer = gl.createBuffer();
    vbo.texCoordEnabled = true;
  }
}

vboMesh.disableTexCoord = function(vbo) {
    vbo.texCoordData = null;
    if(vbo.texCoordBuffer !== null) gl.deleteBuffer(vbo.texCoordBuffer);
    vbo.texCoordEnabled = false;
}

vboMesh.addVertex = function(vbo, v,n) {
    var index = vbo.numVertices*3;
	if(index >= vbo.vertexData.length) {
		var newData = new Float32Array(vbo.vertexData.length*2);
		newData.set(vbo.vertexData);
		//do i need to explicitly kill the old vertexData?
		vbo.vertexData = newData;
    if(vbo.normalsEnabled) {
        var newData = new Float32Array(vbo.vertexData.length);
        newData.set(vbo.normalData);
        //do i need to explicitly kill the old vertexData?
        vbo.normalData = newData;        
    }
    if(vbo.colorEnabled) {
      var newData = new Uint8Array(vbo.vertexData.length/3*4);
      newData.set(vbo.colorData);
      //do i need to explicitly kill the old vertexData?
      vbo.colorData = newData;
    }
    if(vbo.texCoordEnabled) {
      var newData = new Float32Array(vbo.vertexData.length/3*2);
      newData.set(vbo.texCoordData);
      //do i need to explicitly kill the old vertexData?
      vbo.texCoordData = newData;
    }

  }
    vbo.vertexData[index] = v[0];
    vbo.vertexData[index+1] = v[1];
    vbo.vertexData[index+2] = v[2];
    if(n && vbo.normalsEnabled) {
        vbo.normalData[index] = n[0];
        vbo.normalData[index+1] = n[1];
        vbo.normalData[index+2] = n[2];
        vbo.numNormals++;
    }
    vbo.numVertices++;
}

vboMesh.getVertex = function(out, vbo, i) {
  var i3 = i*3;
  out[0] = vbo.vertexData[i3];
  out[1] = vbo.vertexData[i3+1];
  out[2] = vbo.vertexData[i3+2];
}

vboMesh.setVertex = function(vbo, i, pt) {
  var i3 = i*3;
  vbo.vertexData[i3] = pt[0];
  vbo.vertexData[i3+1] = pt[1];
  vbo.vertexData[i3+2] = pt[2];
}

vboMesh.setNormal = function(vbo, i, pt) {
  var i3 = i*3;
  vbo.normalData[i3] = pt[0];
  vbo.normalData[i3+1] = pt[1];
  vbo.normalData[i3+2] = pt[2];
}

vboMesh.getNormal = function(n, vbo, i) {
  var i3 = i*3;
  n[0] = vbo.normalData[i3];
  n[1] = vbo.normalData[i3+1];
  n[2] = vbo.normalData[i3+2];
}

vboMesh.setColor = function(vbo, i, c) {
  var i4 = i*4;
  vbo.colorData[i4] = c[0];
  vbo.colorData[i4+1] = c[1];
  vbo.colorData[i4+2] = c[2];
  vbo.colorData[i4+3] = c[3] === undefined ? 255 : c[3];
}

vboMesh.getTexCoord = function(tx, vbo, i) {
  var i2 = i*2;
  tx[0] = vbo.texCoordData[i2];
  tx[1] = vbo.texCoordData[i2+1];
}

vboMesh.setTexCoord = function(vbo, i, tx) {
  var i2 = i*2;
  vbo.texCoordData[i2] = tx[0];
  vbo.texCoordData[i2+1] = tx[1];
}

vboMesh.addTexCoord = function(vbo, tx) {
  var i2 = vbo.numTexCoords*2;
  vbo.texCoordData[i2] = tx[0];
  vbo.texCoordData[i2+1] = tx[1];  
  vbo.numTexCoords++;
}

vboMesh.addTriangle = function(vbo, i1,i2,i3) {
	if(vbo.numIndices >= vbo.indexData.length) {
		var newData = new vbo.indexData.constructor(vbo.indexData.length*2);
		newData.set(vbo.indexData);
		//do i need to explicitly kill the old vertexData?
		vbo.indexData = newData;
	}
    vbo.indexData[vbo.numIndices++] = i1;
    vbo.indexData[vbo.numIndices++] = i2;
    vbo.indexData[vbo.numIndices++] = i3;
}

vboMesh.addIndices = function(vbo, indices,numIndices) {
	if(vbo.numIndices+numIndices >= vbo.indexData.length) {
		var newData = new vbo.indexData.constructor(Math.max(vbo.indexData.length*2,vbo.indexData.length+numIndices));
		newData.set(vbo.indexData);
		//do i need to explicitly kill the old vertexData?
		vbo.indexData = newData;
	}
  for(var i=0;i<numIndices;++i) {
    vbo.indexData[vbo.numIndices++] = indices[i];
  }
}

vboMesh.addIndex = function(vbo,index) {
  if(vbo.numIndices >= vbo.indexData.length) {
		var newData = new vbo.indexData.constructor(vbo.indexData.length*2);
		newData.set(vbo.indexData);
		//do i need to explicitly kill the old vertexData?
		vbo.indexData = newData;
	}
  vbo.indexData[vbo.numIndices++] = index;
}

vboMesh.addLine = function(vbo, i1,i2) {
	if(vbo.numIndices >= vbo.indexData.length) {
		var newData = new vbo.indexData.constructor(vbo.indexData.length*2);
		newData.set(vbo.indexData);
		//do i need to explicitly kill the old vertexData?
		vbo.indexData = newData;
	}
  vbo.indexData[vbo.numIndices++] = i1;
  vbo.indexData[vbo.numIndices++] = i2;
}

vboMesh.addMesh = (function() {
  var pt = vec3.create();
  return function addMesh(vbo, vbo2) {
    var baseIndex = vbo.numVertices;
    for(var i=0;i<vbo2.numVertices;++i) {
      vboMesh.getVertex(pt,vbo2,i);
      vboMesh.addVertex(vbo,pt);
    }
    
    for(var i=0;i<vbo2.numIndices;++i) {
      vboMesh.addIndex(vbo,vbo2.indexData[i]+baseIndex);
    }
  }
})();

vboMesh.addMeshTransform = (function() {
  var pt = vec3.create();
  return function addMesh(vbo, vbo2, trans) {
    var baseIndex = vbo.numVertices;
    for(var i=0;i<vbo2.numVertices;++i) {
      vboMesh.getVertex(pt,vbo2,i);
      vec3.transformMat4(pt,pt,trans);
      vboMesh.addVertex(vbo,pt);
    }
    
    for(var i=0;i<vbo2.numIndices;++i) {
      vboMesh.addIndex(vbo,vbo2.indexData[i]+baseIndex);
    }
  }
})();

vboMesh.buffer = function(vbo) {
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,vbo.vertexData,gl.STREAM_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vbo.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,vbo.indexData,gl.STREAM_DRAW);
    if(vbo.normalsEnabled) {
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo.normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vbo.normalData,gl.STREAM_DRAW);
    }
}

vboMesh.computeSmoothNormals = (function() {
    var norm = vec3.create();
    var p1 = vec3.create(),
        p2 = vec3.create(),
        p3 = vec3.create();
    var x=0.0,y=0.0,z=0.0;
    var invLen = 0.0;
    var dir1 = vec3.create(),
        dir2 = vec3.create();
    function planeNormal(out,v1,v2,v3) {
      vec3.sub(dir1, v1,v2);
      vec3.sub(dir2, v3,v2);
      vec3.cross(out,dir2,dir1);
    }

    return function computeSmoothNormals(vbo) {
        vboMesh.enableNormals(vbo);
        for(var i=0;i<vbo.numVertices;++i) {
            var i3 = i*3;
            vbo.normalData[i3] = 0;
            vbo.normalData[i3+1] = 0;
            vbo.normalData[i3+2] = 0;
        }
        for(var i=0;i<vbo.numIndices;) {
            var i1 = vbo.indexData[i++]*3;
            var i2 = vbo.indexData[i++]*3;
            var i3 = vbo.indexData[i++]*3;
            
            vec3.set(p1,vbo.vertexData[i1],vbo.vertexData[i1+1], vbo.vertexData[i1+2]);
            vec3.set(p2,vbo.vertexData[i2],vbo.vertexData[i2+1], vbo.vertexData[i2+2]);
            vec3.set(p3,vbo.vertexData[i3],vbo.vertexData[i3+1], vbo.vertexData[i3+2]);
            
            planeNormal(norm, p1,p2,p3);
            //vec3.normalize(norm,norm);
            
            vbo.normalData[i1] += norm[0];
            vbo.normalData[i1+1] += norm[1];
            vbo.normalData[i1+2] += norm[2];
            
            vbo.normalData[i2] += norm[0];
            vbo.normalData[i2+1] += norm[1];
            vbo.normalData[i2+2] += norm[2];
            
            vbo.normalData[i3] += norm[0];
            vbo.normalData[i3+1] += norm[1];
            vbo.normalData[i3+2] += norm[2];
        }
        for(var i=0;i<vbo.numVertices;++i) {
            var i3 = i*3;
            x = vbo.normalData[i3];
            y = vbo.normalData[i3+1];
            z = vbo.normalData[i3+2];
            invLen = 1.0/Math.sqrt(x*x+y*y+z*z);
            vbo.normalData[i3] *= invLen;
            vbo.normalData[i3+1] *= invLen;
            vbo.normalData[i3+2] *= invLen;
        }
    };
})();

vboMesh.computeSmoothNormalsVBO = function(vbo) {
    var vertexData = vbo.vertexData;
    for(var i=0;i<vbo.numVertices;++i) {
        var i6 = i*6;
        vertexData[i6+3] = 0;
        vertexData[i6+4] = 0;
        vertexData[i6+5] = 0;
    }
    var norm = vec3.create();
    var p1 = vec3.create(),
        p2 = vec3.create(),
        p3 = vec3.create();
    for(var i=0;i<vbo.numIndices;) {
        var i1 = vbo.indexData[i++];
        var i2 = vbo.indexData[i++];
        var i3 = vbo.indexData[i++];
        
        vec3.set(p1,vertexData[i1*6],vertexData[i1*6+1], vertexData[i1*6+2]);
        vec3.set(p2,vertexData[i2*6],vertexData[i2*6+1], vertexData[i2*6+2]);
        vec3.set(p3,vertexData[i3*6],vertexData[i3*6+1], vertexData[i3*6+2]);
        
        planeNormal(norm, p1,p2,p3);
        vec3.normalize(norm,norm);
        
        vertexData[i1*3+3] += norm[0];
        vertexData[i1*3+4] += norm[1];
        vertexData[i1*3+5] += norm[2];
        
        vertexData[i2*6+3] += norm[0];
        vertexData[i2*6+4] += norm[1];
        vertexData[i2*6+5] += norm[2];
        
        vertexData[i3*6+3] += norm[0];
        vertexData[i3*6+4] += norm[1];
        vertexData[i3*6+5] += norm[2];
    }
    for(var i=0;i<vbo.numVertices;++i) {
        var i6 = i*6;
        var len = Math.sqrt(vertexData[i6+3]*vertexData[i6+3]+vertexData[i6+4]*vertexData[i6+4]+vertexData[i6+5]*vertexData[i6+5]);
        vertexData[i6+3] /= len;
        vertexData[i6+4] /= len;
        vertexData[i6+5] /= len;
    }
}


})(shim.exports);
})(this);
},{"../js/gl-matrix-min.js":14}],13:[function(require,module,exports){
"use strict"

var glMatrix = require('../js/gl-matrix-min.js');
var poly2tri = require('./poly2tri.js');
var hemesher = require('../js/hemesh.js');
var hemesh = hemesher.hemesh;
var vec3 = glMatrix.vec3;
var vec2 = glMatrix.vec2;

var SweepContext = poly2tri.SweepContext;
var pts = [];

var outsidePts = [];
var triangles = [];
var voroMesh = new hemesh();
var width = 1200;
var height = 1200;
var topOn = true;
var leftOn = true;
var bottomOn = true;
var rightOn = true;
var eWeight = 1.0;

var boundary = [];
boundary.push([0,0,0]);
boundary.push([width,0,0]);
boundary.push([width,height,0]);
boundary.push([0,height,0]);
boundary = boundary.reverse();
var epsilon = 0.00001;
function reset() {
  //make regularly spaced points
  pts.length = 0;
  
  var defaultSpacing = 200;
  var xDivs = Math.floor(width/(defaultSpacing+1));
  var yDivs = Math.floor(height/(defaultSpacing+1));
  
  var spacing = width/xDivs;
  var spacingY = height/yDivs;
  for(var i=0;i<xDivs;++i) {
    for(var j=0;j<yDivs;++j) {
      pts.push({x:i*spacing+j%2*spacing*0.5+spacing*0.25,y:j*spacingY+spacingY*0.5,on:true});
    }
  }
}

function init() {
  boundary.length = 0;
  boundary.push([0,0,0]);
  boundary.push([0,height,0]);
  boundary.push([width,height,0]);
  boundary.push([width,0,0]);
  
  updateOutsidePts();
}

function updateOutsidePts() {
  //get bounding box
  var maxX = -9e9, minX = 9e9, maxY = -9e9, minY = 9e9;
  for(var i=0;i<boundary.length;++i) {
    var pt = boundary[i];
    maxX = Math.max(maxX, pt[0]);
    minX = Math.min(minX, pt[0]);
    maxY = Math.max(maxY, pt[1]);
    minY = Math.min(minY, pt[1]);
  }
  width = maxX;
  height = maxY;
  outsidePts.length = 0;
  var d = 5000;
  outsidePts.push({x:minX,y:minY-d,fixed:true,bottom:true});
  outsidePts.push({x:(minX+maxX)*0.5,y:minY-d,fixed:true,bottom:true});
  outsidePts.push({x:maxX,y:minY-d,fixed:true,bottom:true});

  outsidePts.push({x:maxX+d,y:minY,fixed:true,right:true});
  outsidePts.push({x:maxX+d,y:(maxY+minY)*0.5,fixed:true,right:true});
  outsidePts.push({x:maxX+d,y:maxY,fixed:true,right:true});

  outsidePts.push({x:maxX,y:maxY+d,fixed:true,top:true});
  outsidePts.push({x:(maxX+minX)*0.5,y:maxY+d,fixed:true,top:true});
  outsidePts.push({x:minX,y:maxY+d,fixed:true,top:true});

  outsidePts.push({x:minX-d,y:maxY,fixed:true,left:true});
  outsidePts.push({x:minX-d,y:(minY+maxY)*0.5,fixed:true,left:true});
  outsidePts.push({x:minX-d,y:minY,fixed:true,left:true});
}

var voronoi = (function() {
  var p1 = vec2.create();
  var p2 = vec2.create();
  var p3 = vec2.create();
  return function voronoi() {
    var triangulation = new SweepContext(outsidePts);
    
    //limit pts
    for(var i=0;i<pts.length;++i) {
      var pt = pts[i];
      pt.x = Math.max(0,Math.min(pt.x,width));
      pt.y = Math.max(0,Math.min(pt.y,height));
    }
    
    triangulation.addPoints(pts);
    triangulation.triangulate();
    
    for(var i=0;i<outsidePts.length;++i) {
      outsidePts[i]._p2t_edge_list = null;
    }
    for(var i=0;i<pts.length;++i) {
      pts[i]._p2t_edge_list = null;
      pts[i].cell = null;
      pts[i].boundary = false;
    }
    
    triangles = triangulation.getTriangles();
    exports.triangles = triangles;
    //editBoundary();
    for(var i=0;i<triangles.length;++i) {
      var tri = triangles[i];
      tri.circumcenter = vec3.create();
      vec2.set(p1,tri.points_[0].x,tri.points_[0].y);
      vec2.set(p2,tri.points_[1].x,tri.points_[1].y);
      vec2.set(p3,tri.points_[2].x,tri.points_[2].y);
      tri.area = circumcircle(tri.circumcenter,p1,p2,p3);      
    }
    
    buildCells();
    makeBoundaryEdges(voroMesh);
    markInsideOut();
    trimCells();
  }
})();

function markInsideOut() {
  for(var i=0;i<voroMesh.vertices.length;++i) {
    var v = voroMesh.vertices[i];
    var winding = windingNumber(v.pos, boundary);
    if(winding == 0) {
      v.isInside = false;
    } else {
      v.isInside = true;
    }
  }
}

var circumcircle = (function() {
  var v1 = vec2.create();
  var v2 = vec2.create();
  var denom;
  return function circumcircle(out, p1,p2,p3) {
    vec2.sub(v1,p1,p3);
    vec2.sub(v2,p2,p3);
    denom = v1[0]*v2[1]-v1[1]*v2[0];
    //denom = orient2d(p1,p2,p3);
    var v1Len = vec2.sqrLen(v1);
    var v2Len = vec2.sqrLen(v2);
    //var crossLen = cross*cross;
    vec2.scale(v2,v2,v1Len);
    vec2.scale(v1,v1,v2Len);
    vec2.sub(v2,v2,v1);
    out[0] = v2[1];
    out[1] = -v2[0];
    vec2.scale(out,out,0.5/denom);
    vec2.add(out,out,p3);
    return Math.abs(denom);
  }
})();

var orient2d = (function() {
  var detleft, detright, det;
  var detsum, errbound;
  return function orient2d(pa,pb,pc) {
    

    detleft = (pa[0] - pc[0]) * (pb[1] - pc[1]);
    detright = (pa[1] - pc[1]) * (pb[0] - pc[0]);
    det = detleft - detright;

    if (detleft > 0.0) {
      if (detright <= 0.0) {
        return det;
      } else {
        detsum = detleft + detright;
      }
    } else if (detleft < 0.0) {
      if (detright >= 0.0) {
        return det;
      } else {
        detsum = -detleft - detright;
      }
    } else {
      return det;
    }

    errbound = ccwerrboundA * detsum;
    if ((det >= errbound) || (-det >= errbound)) {
      return det;
    }

    return orient2dadapt(pa, pb, pc, detsum);
  }
})();


function setDimensions(w,h) {
  width = w;
  height = h;
  
  boundary[3][0] = width;
  boundary[2][0] = width;
  boundary[2][1] = height;
  boundary[1][1] = height;
}

function editBoundary() {
  var dir1 = vec2.create();
  var dir2 = vec2.create();
  
  for(var i=0;i<triangles.length;++i) {
    var t = triangles[i];
    var boundary = t.points_[0].bottom || t.points_[0].bottom || t.points_[2].bottom ||
                    t.points_[0].left || t.points_[0].left || t.points_[2].left;
    if(boundary) {
      t.points_[0].boundary = true;
      t.points_[1].boundary = true;
      t.points_[2].boundary = true;

      /*
      t.points_[0].newPts = [];
      t.points_[1].newPts = [];
      t.points_[2].newPts = [];
      t.points_[0].newTris = [];
      t.points_[1].newTris = [];
      t.points_[2].newTris = [];

      //remove triangle
      triangles.splice(i,1);
      i--;
      //unmark neighbors
      for(var j=0;j<3;++j) {
        if(t.neighbors_[j]) {
          unmarkNeighbor(t.neighbors_[j],t);
        }
      }
      */
    }
  }
}

function unmarkNeighbor(t1,t2) {
  for(var i=0;i<3;++i) {
    if(t1.neighbors_[i] === t2) {
      t1.neighbors_[i] = null;
    }
  }
}


var centroidal = (function() {
  var centroid = vec2.create();
  var centroid2 = vec2.create();
  var center = vec2.create();
  var area,totalArea;
  var area2,totalArea2;
  var v1,v2;
  return function centroidal() {
    for(var i=0;i<pts.length;++i) {
      var pt = pts[i];
      if(!pt.fixed) {
        totalArea = 0;
        totalArea2 = 0;
        vec2.set(centroid,0,0);
        vec2.set(centroid2,0,0);
        var e = pt.cell.e;
        do {
          v1 = e.v.pos;
          var w = e.v.w;
          e = e.next;
          v2 = e.v.pos;
          //w += e.v.w;
          area = w;//w*((v1[0]*v2[1]-v1[1]*v2[0]));
          totalArea += area;
          centroid[0] += area*v1[0];//(v1[0]+v2[0])*area;
          centroid[1] += area*v1[1];//(v1[1]+v2[1])*area;
          
          area2 = ((v1[0]*v2[1]-v1[1]*v2[0]));
          totalArea2 += area2;
          centroid2[0] += (v1[0]+v2[0])*area2;
          centroid2[1] += (v1[1]+v2[1])*area2;
        } while(e != pt.cell.e);
        /*
        for(var j=0,l=pt.cell.length;j<l;++j) {
          var jNext = (j+1)%l;
          v1 = pt.cell[j];
          v2 = pt.cell[jNext];
          area = v1[0]*v2[1]-v1[1]*v2[0];
          totalArea += v1[0]*v2[1]-v1[1]*v2[0];
          centroid[0] += (v1[0]+v2[0])*area;
          centroid[1] += (v1[1]+v2[1])*area;
        }
        */
        totalArea2 *= 3;
        vec2.scale(centroid,centroid,1.0/totalArea);
        vec2.scale(centroid2,centroid2,1.0/totalArea2);
        vec2.lerp(centroid,centroid,centroid2,0.25);
        var dx = Math.min(Math.max(Math.random(.1),centroid[0]),width-Math.random(.1))-pt.x;
        var dy = Math.min(Math.max(Math.random(.1),centroid[1]),height-Math.random(.1))-pt.y;
        if(dx*dx+dy*dy > 16) {
          pt.x += dx*.1;
          pt.y += dy*.1;
        }
      }
    }
  }
})();


var ptToEdge = [];
var buildCells = function() {
  voroMesh.clear();
  ptToEdge.length = 0;
  for(var i=0;i<triangles.length;++i) {
    var t = triangles[i];
    var v = voroMesh.addVertex(t.circumcenter);
    v.w = 1.0;//1.0+1.0/Math.sqrt(t.area);
    t.v = v;
    t.bottom = t.points_[0].bottom || t.points_[1].bottom || t.points_[2].bottom;
    t.top = t.points_[0].top || t.points_[1].top || t.points_[2].top;
    t.left = t.points_[0].left || t.points_[1].left || t.points_[2].left;
    t.right = t.points_[0].right || t.points_[1].right || t.points_[2].right;
  }
  for(var i=0;i<triangles.length;++i) {
    var t = triangles[i];
    for(var j=0;j<3;++j) {
      var pt = t.points_[j];
      if(!pt.fixed && !pt.boundary) {
        if(!pt.cell) {
          buildCell(pt,t);
        }
      }
    }
  }
}

function buildCell(pt,t) {
  var prevV = t.v;
  t = t.neighborCCW(pt);
  var startT = t;
  var e, prevE = null;
  var left,right,top,bottom;
  left = right = top = bottom = false;
  do {
    if(t.left || t.bottom) return;
  } while(t != startT);

  pt.cell = voroMesh.addFace();
  pt.cell.on = pt.on;
  do {
    //pt.cell.push(t.circumcenter);
    e = voroMesh.addEdge();
    
    e.v = t.v;
    e.v.e = e;
    if(prevE) {
      prevE.next = e;
    } else {
      pt.cell.e = e;
    }
    e.face = pt.cell;
    findPair(e,ptToEdge,prevV.index, e.v.index);
    prevV = t.v;
    prevE = e;
    t = t.neighborCCW(pt);
  } while(t != startT);
  prevE.next = pt.cell.e;
}

//build hedge structure
function findPair(e,ptToEdge,i1,i2) {
  var ptEdge = ptToEdge[i2];
  if(ptEdge) {
    for(var i=0;i<ptEdge.length;++i) {
      var e2 = ptEdge[i];
      if(e2.v.index == i1) {
        e2.pair = e;
        e.pair = e2;
        return;
      }
    }
  }
  ptEdge = ptToEdge[i1];
  if(ptEdge) {
    ptEdge.push(e);
  } else {
    ptEdge = [e];
    ptToEdge[i1] = ptEdge;
  }
}

function makeBoundaryEdges(mesh) {
  //add boundary edges and ensure every edge has a pair
  var numEdges = mesh.edges.length;
  var e,v,startV;
  var ptToEdge = [];
  for(var i=0;i<numEdges;++i) {
    e = mesh.edges[i];
    if(e.pair == null) {
      var newEdge = mesh.addEdge();
      newEdge.pair = e;
      e.pair = newEdge;
      
      //lets try the inefficient route
      startV = e.v;
      do {
        v = e.v;
        e = e.next;
      } while(e.v != startV);
      newEdge.v = v;
      newEdge.v.b = true;
      ptToEdge[startV.index] = newEdge;
    }
  }
  for(var i=numEdges;i<mesh.edges.length;++i) {
    e = mesh.edges[i];
    var ptEdge = ptToEdge[e.v.index];
    if(ptEdge) {
      e.next = ptEdge;
    } else {
      console.log("error: no next boundary found");
    }
  }
}

function isInside(pt) {
  return pt.isInside;
  //return pt[0] > 0 && pt[0] < width && pt[1] > 0 && pt[1] < height;
}

var segSegIntersect = function(out,s1pt1,s1pt2,s2pt1,s2pt2) {
    var dx1 = s1pt2[0]-s1pt1[0];
    var dx2 = s2pt2[0]-s2pt1[0];
    var dy1 = s1pt2[1]-s1pt1[1];
    var dy2 = s2pt2[1]-s2pt1[1];
    var ax = s2pt1[0]-s1pt1[0];
    var ay = s2pt1[1]-s1pt1[1];
    //z component of cross product: sin(A)*|L1||L2|
    var crossish =  dx1*dy2-dy1*dx2;
    var u = (ax*dy1-ay*dx1)/crossish;
    if(u <= 0 || u > 1) return false;
    var t = (ax*dy2-ay*dx2)/crossish;
    if(t < 0 || t > 1) return false;
    out[0] = dx2*u+s2pt1[0];
    out[1] = dy2*u+s2pt1[1];
    return true;
};

var trimEdge = (function() {
  var dir = vec2.create();
  var dir2 = vec2.create();
  var bPt;
  
  return function trimEdge(out, inP,outP) {
    var prevPt = boundary[boundary.length-1];
    var prevIndex = boundary.length-1;
    vec2.sub(dir, outP, inP);
    var len = vec2.len(dir);
    vec2.scale(dir,dir,1.0/len);
    for(var i=0;i<boundary.length;++i) {
      bPt = boundary[i];
      if(segSegIntersect(out, inP, outP, prevPt, bPt)) {
        return i;
        //return prevIndex;
      }
      
      prevIndex = i;
      prevPt = bPt;
    }
  }
})();

var trimEdgeX = (function() {  
  var dir = vec2.create();
  return function trimEdge(out,inP,outP) {
  
    vec2.sub(dir,outP,inP);
    if(outP[0] < 0) {
      if(outP[1] <0) {
        var len = Math.min(-inP[0]/dir[0],-inP[1]/dir[1]);
        out[0] = inP[0]+dir[0]*len;
        out[1] = inP[1]+dir[1]*len;
      
      } else if(outP[1] > height) {
        var len = Math.min(-inP[0]/dir[0],(height-inP[1])/dir[1]);
        out[0] = inP[0]+dir[0]*len;
        out[1] = inP[1]+dir[1]*len;
      
      } else {
        out[0] = 0;
        out[1] = inP[1]+dir[1]*(-inP[0]/dir[0]);
        return 3;
      }
    } else if(outP[0] > width) {
      if(outP[1] <0) {
        var len = Math.min((width-inP[0])/dir[0],-inP[1]/dir[1]);
        out[0] = inP[0]+dir[0]*len;
        out[1] = inP[1]+dir[1]*len;      
      } else if(outP[1] > height) {
        var len = Math.min((width-inP[0])/dir[0],(height-inP[1])/dir[1]);
        out[0] = inP[0]+dir[0]*len;
        out[1] = inP[1]+dir[1]*len;      
      
      } else {
        out[0] = width;
        out[1] = inP[1]+dir[1]*((width-inP[0])/dir[0]);      
      }
    } else {
      if(outP[1] < 0) {
        out[1] = 0;
        out[0] = inP[0]+dir[0]*(-inP[1]/dir[1]);
      } else if(outP[1] > height) {
        out[1] = height;
        out[0] = inP[0]+dir[0]*((height-inP[1])/dir[1]);
      
      }
    }
    return 0;
  }
})();

var EPSILON = 0.00001;

var trimCells = (function() {
  var f, e, tInfo, tv;
  var pt = vec3.create();
  return function trimCells() {
    for(var i=0;i<voroMesh.edges.length;++i) {
      e = voroMesh.edges[i];
      if(!isInside(e.v) && isInside(e.pair.v)) {
        e.info.trimmed = true;
        tInfo = trimEdge(pt, e.pair.v.pos,e.v.pos);
        tv = voroMesh.addVertex(pt);
        tv.w = eWeight;
        tv.b = true;
        tv.isInside = true;
        e.info.trimIndex = tInfo;
        e.v = tv;
        tv.e = e;
      } 
    }
    for(var i=0,l = voroMesh.faces.length;i<l; ++i) {
      f = voroMesh.faces[i];
      trimFace(f);
    }
    makeBoundaryEdges(voroMesh);

    //clean
    for(var i=0;i<voroMesh.vertices.length;) {
      if(!isInside(voroMesh.vertices[i])) {
        voroMesh.vertices.splice(i,1);
      } else {
        voroMesh.vertices[i].index = i;
        i++;
      }
    }
    for(var i=0;i<voroMesh.edges.length;) {
      e = voroMesh.edges[i];
      if(!isInside(e.v) && (e.pair.v == null || !isInside(e.pair.v))) {
        e.pair = null;
        e.next = null;
        e.v = null;
        e.face = null;
        voroMesh.edges.splice(i,1);
      } else {
        e.index = i;
        i++;
      }
    }
    
  }
})();

var trimFace = (function() {
  var trimPt = vec3.create();
  var v,e, startE;
  var newV, trimE, trimE2;
  return function trimFace(f) {
    startE = f.e;
    e = startE;
    //get trimmed edge
    do {
      e = e.next;
    } while(!e.info.trimmed && e != startE);
    if(!e.info.trimmed) return;
    
    trimE = e;
    do {
      e = e.next;
    } while(!e.pair.info.trimmed && e != trimE);
    if(e == trimE) {
      console.log("error: out edge find, but no in edge");
      return;
    }
    trimE2 = e.pair;
    
    var bIndex = trimE.info.trimIndex;
    e = trimE;
    while(bIndex != trimE2.info.trimIndex) {
      var newV = voroMesh.addVertex(boundary[bIndex]);
      newV.pos[2] = 0;
      newV.isInside = true;
      newV.w = eWeight;
      var newE = voroMesh.addEdge();
      newE.v = newV;
      newV.e = newE;
      newE.face = f;
      
      e.next = newE;
      e = newE;
      
      bIndex = (bIndex+1)%boundary.length;
    }
    //add edge to trimE2.v
    f.e = trimE;
    var newE = voroMesh.addEdge();
    newE.v = trimE2.v;
    e.next = newE;
    newE.next = trimE2.pair;
    newE.face = f;
  }
})();

var trimFace2 = (function() {
  var trimPt = vec3.create();
  var v,e, startE, prevE;
  var newV;
  return function trimFace(f) {
    startE = f.e;
    e = startE;
    //get to an inside point
    //watchout for infinite loop (not done)
    do {
      e = e.next;
    } while(isInside(e.v) <= 0 && e != startE);
    startE = e;
    //find first outside pt
    do {
      
      prevE = e;
      e = e.next;
    } while(isInside(e.v) > 0 && e != startE);
    
    if(isInside(e.v) > 0) { return; }
    
    if(isInside(e.v) < 0) f.on = false;
    
    startE = e;
    f.e = e;      
    //has this edge already been trimmed
    if(e.pair.info.trimmed) {
      //point e to trimmed;
      newV = e.pair.info.trimmed;
      e.v = newV;
    } else {
      //make new trimmed vertex and point to that
      trimEdge(trimPt, e.pair.v.pos, e.v.pos);
      newV = voroMesh.addVertex(trimPt);
      newV.w = eWeight;//0.5;
      newV.b = true;
      newV.e = e;
      e.v.e = null;
      e.v = newV;
      e.info.trimmed = newV;
    }
    
    e = e.next;
    while(isInside(e.v) <= 0 && e != startE) {
      if(isInside(e.v) < 0) f.on = false;
      e.v.e = null;
      e = e.next;
    }    
    //has this edge already been trimmed
    if(e.pair.info.trimmed) {
      //point e to trimmed;
      newV = e.pair.info.trimmed;
    } else {
      //make new trimmed vertex and point to that
      trimEdge(trimPt,  e.v.pos,e.pair.v.pos);
      newV = voroMesh.addVertex(trimPt);
      newV.w = eWeight;//0.5;
      newV.b = true;
      e.info.trimmed = newV;
    }
    
    // corner
    //may need to check for floating point errors
    if(Math.abs(startE.v.pos[0]-newV.pos[0]) > EPSILON && Math.abs(startE.v.pos[1]-newV.pos[1]) > EPSILON) {
      //which corner
      if(startE.v.pos[0] < EPSILON || newV.pos[0] < EPSILON) {
        trimPt[0] = 0;
      } else if(startE.v.pos[0] > width-EPSILON || newV.pos[0] > width-EPSILON) {
        trimPt[0] = width;
      }
      
      if(startE.v.pos[1] < EPSILON || newV.pos[1] < EPSILON) {
        trimPt[1] = 0;
      } else if(startE.v.pos[1] > height-EPSILON || newV.pos[1] > height-EPSILON) {
        trimPt[1] = height;
      }
      //add corner
      var cornerV = voroMesh.addVertex(trimPt);
      cornerV.w = eWeight;//0.5;
      var newE = voroMesh.addEdge();
      var newEP = voroMesh.addEdge();
      var newE2 = voroMesh.addEdge();
      var newEP2 = voroMesh.addEdge();
      
      newE.face = f;
      newE2.face = f;
      newE.v = cornerV;
      newE2.v = newV;
      cornerV.e = newE;
      newV.e = newE2;
      newE.pair = newEP;
      newEP.pair = newE;
      newE2.pair = newEP2;
      newEP2.pair = newE2;
      newEP2.v = cornerV;
      newEP.v = startE.v;
      newE.next = newE2;
      newEP2.next = newEP;
      startE.next = newE;
      newE2.next = e;
      
      if(startE.pair.info.trimB) {
        newEP.next = startE.pair.info.trimB;
      } else {
        startE.info.trimB = newEP;
      }
      if(e.pair.info.trimB) {
        e.pair.info.trimB.next = newEP2;
      } else {
        e.info.trimB = newEP2;
      }
    } else {
      //connect the edges
      var newE = voroMesh.addEdge();
      var newEP = voroMesh.addEdge();
      newE.v = newV;
      newV.e = newE;
      newE.face = f;
      newE.pair = newEP;
      newEP.pair = newE;
      newEP.v = startE.v;
      newE.next = e;
      startE.next = newE;
      if(startE.pair.info.trimB) {
        newEP.next = startE.pair.info.trimB;
      } else {
        startE.info.trimB = newEP;
      }
      if(e.pair.info.trimB) {
        e.pair.info.trimB.next = newEP;
      } else {
        e.info.trimB = newEP;
      }
    }
  }
})();
/*
    var v, v2, startE,e,cv, prevE, prevEP, ePair, eNext;;
    for(var i=0,l=voroMesh.vertices.length;i<l;++i) {
      v = voroMesh.vertices[i];
      if(v.e && v.b) {
        //trim pt
        if(!isInside(v.pos)) {
          startE = v.e;
          e = startE;
          prevE = null;
          do {
            ePair = e.pair;
            eNext = e.next.pair;
            v2 = ePair.v;
            //trim edge
            cv = v;
            
            if(isInside(v2.pos)) {
              trimEdge(trimPt,v2.pos,v.pos);
              
              cv = voroMesh.addVertex(trimPt);
              cv.b = true;
              cv.e = e;
              e.v = cv;
              var newE = voroMesh.addEdge();
              newE.face = e.face;
              newE.next = e.next;
              newE.v = v;
              e = newE;
              
              if(prevE) {
                prevE.next = ePair;
              }
            }
            
            if(prevE) {
              prevE.v = cv;
              prevE.next = ePair.next;
              prevE.face.e = prevE;
              prevE.v.e = prevE;
            }
            if(e.face != hemesh.NULLFACE) {
            
              var newEP = voroMesh.addEdge();
              newEP.v = cv;
              newEP.pair = prevE;
              newEP.next = prevEP;
              
              prevEP = newEP;
            } else {
              e.pair = prevE;
              e.next = prevEP;
              e.v = _;//??
              prevEP = e;
            }
            
            prevE = e;
            e = eNext;
          } while(e != startE);
          
          
          
          v.e = null;
        }
      }
    }

*/

/*
  point in polygon adapted from http://geomalgorithms.com/a03-_inclusion.html
  Copyright 2000 softSurfer, 2012 Dan Sunday
  javascript port by Jesse Louis-Rosenberg 2015
*/
function isLeft(p0, p1, p2 )
{
    return ( (p1[0] - p0[0]) * (p2[1] - p0[1])
            - (p2[0] -  p0[0]) * (p1[1] - p0[1]) );
}
//===================================================================


function windingNumber(p,poly) {
  var wn = 0;    // the  winding number counter
  var v1,v2;
  //loop through all edges of the polygon
  for (var i=0; i<poly.length; i++) {   // edge from V[i] to  V[i+1]
    v1 = poly[i];
    var iNext = (i+1)%poly.length;
    v2 = poly[iNext];
    if (v1[1] <= p[1]) {          // start y <= P.y
      if (v2[1]  > p[1])      // an upward crossing
        if (isLeft( v1,v2, p) > 0)  // P left of  edge
          ++wn;            // have  a valid up intersect
    }
    else {                        // start y > P.y (no test needed)
      if (v2[1]  <= p[1])     // a downward crossing
        if (isLeft( v1, v2, p) < 0)  // P right of  edge
          --wn;            // have  a valid down intersect
    }
  }
  return wn;
}

exports.init = init;
exports.reset = reset;
exports.voronoi = voronoi;
exports.pts = pts;
exports.boundary = boundary;
exports.triangles = triangles;
exports.setDimensions = setDimensions;
exports.centroidal = centroidal;
exports.mesh = voroMesh;
exports.updateOutsidePts = updateOutsidePts;
},{"../js/gl-matrix-min.js":14,"../js/hemesh.js":16,"./poly2tri.js":10}],14:[function(require,module,exports){
/**
 * @fileoverview gl-matrix - High performance matrix and vector operations
 * @author Brandon Jones
 * @author Colin MacKenzie IV
 * @version 2.2.0
 */
/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */
(function(e){"use strict";var t={};typeof exports=="undefined"?typeof define=="function"&&typeof define.amd=="object"&&define.amd?(t.exports={},define(function(){return t.exports})):t.exports=typeof window!="undefined"?window:e:t.exports=exports,function(e){if(!t)var t=1e-6;if(!n)var n=typeof Float32Array!="undefined"?Float32Array:Array;if(!r)var r=Math.random;var i={};i.setMatrixArrayType=function(e){n=e},typeof e!="undefined"&&(e.glMatrix=i);var s={};s.create=function(){var e=new n(2);return e[0]=0,e[1]=0,e},s.clone=function(e){var t=new n(2);return t[0]=e[0],t[1]=e[1],t},s.fromValues=function(e,t){var r=new n(2);return r[0]=e,r[1]=t,r},s.copy=function(e,t){return e[0]=t[0],e[1]=t[1],e},s.set=function(e,t,n){return e[0]=t,e[1]=n,e},s.add=function(e,t,n){return e[0]=t[0]+n[0],e[1]=t[1]+n[1],e},s.subtract=function(e,t,n){return e[0]=t[0]-n[0],e[1]=t[1]-n[1],e},s.sub=s.subtract,s.multiply=function(e,t,n){return e[0]=t[0]*n[0],e[1]=t[1]*n[1],e},s.mul=s.multiply,s.divide=function(e,t,n){return e[0]=t[0]/n[0],e[1]=t[1]/n[1],e},s.div=s.divide,s.min=function(e,t,n){return e[0]=Math.min(t[0],n[0]),e[1]=Math.min(t[1],n[1]),e},s.max=function(e,t,n){return e[0]=Math.max(t[0],n[0]),e[1]=Math.max(t[1],n[1]),e},s.scale=function(e,t,n){return e[0]=t[0]*n,e[1]=t[1]*n,e},s.scaleAndAdd=function(e,t,n,r){return e[0]=t[0]+n[0]*r,e[1]=t[1]+n[1]*r,e},s.distance=function(e,t){var n=t[0]-e[0],r=t[1]-e[1];return Math.sqrt(n*n+r*r)},s.dist=s.distance,s.squaredDistance=function(e,t){var n=t[0]-e[0],r=t[1]-e[1];return n*n+r*r},s.sqrDist=s.squaredDistance,s.length=function(e){var t=e[0],n=e[1];return Math.sqrt(t*t+n*n)},s.len=s.length,s.squaredLength=function(e){var t=e[0],n=e[1];return t*t+n*n},s.sqrLen=s.squaredLength,s.negate=function(e,t){return e[0]=-t[0],e[1]=-t[1],e},s.normalize=function(e,t){var n=t[0],r=t[1],i=n*n+r*r;return i>0&&(i=1/Math.sqrt(i),e[0]=t[0]*i,e[1]=t[1]*i),e},s.dot=function(e,t){return e[0]*t[0]+e[1]*t[1]},s.cross=function(e,t,n){var r=t[0]*n[1]-t[1]*n[0];return e[0]=e[1]=0,e[2]=r,e},s.lerp=function(e,t,n,r){var i=t[0],s=t[1];return e[0]=i+r*(n[0]-i),e[1]=s+r*(n[1]-s),e},s.random=function(e,t){t=t||1;var n=r()*2*Math.PI;return e[0]=Math.cos(n)*t,e[1]=Math.sin(n)*t,e},s.transformMat2=function(e,t,n){var r=t[0],i=t[1];return e[0]=n[0]*r+n[2]*i,e[1]=n[1]*r+n[3]*i,e},s.transformMat2d=function(e,t,n){var r=t[0],i=t[1];return e[0]=n[0]*r+n[2]*i+n[4],e[1]=n[1]*r+n[3]*i+n[5],e},s.transformMat3=function(e,t,n){var r=t[0],i=t[1];return e[0]=n[0]*r+n[3]*i+n[6],e[1]=n[1]*r+n[4]*i+n[7],e},s.transformMat4=function(e,t,n){var r=t[0],i=t[1];return e[0]=n[0]*r+n[4]*i+n[12],e[1]=n[1]*r+n[5]*i+n[13],e},s.forEach=function(){var e=s.create();return function(t,n,r,i,s,o){var u,a;n||(n=2),r||(r=0),i?a=Math.min(i*n+r,t.length):a=t.length;for(u=r;u<a;u+=n)e[0]=t[u],e[1]=t[u+1],s(e,e,o),t[u]=e[0],t[u+1]=e[1];return t}}(),s.str=function(e){return"vec2("+e[0]+", "+e[1]+")"},typeof e!="undefined"&&(e.vec2=s);var o={};o.create=function(){var e=new n(3);return e[0]=0,e[1]=0,e[2]=0,e},o.clone=function(e){var t=new n(3);return t[0]=e[0],t[1]=e[1],t[2]=e[2],t},o.fromValues=function(e,t,r){var i=new n(3);return i[0]=e,i[1]=t,i[2]=r,i},o.copy=function(e,t){return e[0]=t[0],e[1]=t[1],e[2]=t[2],e},o.set=function(e,t,n,r){return e[0]=t,e[1]=n,e[2]=r,e},o.add=function(e,t,n){return e[0]=t[0]+n[0],e[1]=t[1]+n[1],e[2]=t[2]+n[2],e},o.subtract=function(e,t,n){return e[0]=t[0]-n[0],e[1]=t[1]-n[1],e[2]=t[2]-n[2],e},o.sub=o.subtract,o.multiply=function(e,t,n){return e[0]=t[0]*n[0],e[1]=t[1]*n[1],e[2]=t[2]*n[2],e},o.mul=o.multiply,o.divide=function(e,t,n){return e[0]=t[0]/n[0],e[1]=t[1]/n[1],e[2]=t[2]/n[2],e},o.div=o.divide,o.min=function(e,t,n){return e[0]=Math.min(t[0],n[0]),e[1]=Math.min(t[1],n[1]),e[2]=Math.min(t[2],n[2]),e},o.max=function(e,t,n){return e[0]=Math.max(t[0],n[0]),e[1]=Math.max(t[1],n[1]),e[2]=Math.max(t[2],n[2]),e},o.scale=function(e,t,n){return e[0]=t[0]*n,e[1]=t[1]*n,e[2]=t[2]*n,e},o.scaleAndAdd=function(e,t,n,r){return e[0]=t[0]+n[0]*r,e[1]=t[1]+n[1]*r,e[2]=t[2]+n[2]*r,e},o.distance=function(e,t){var n=t[0]-e[0],r=t[1]-e[1],i=t[2]-e[2];return Math.sqrt(n*n+r*r+i*i)},o.dist=o.distance,o.squaredDistance=function(e,t){var n=t[0]-e[0],r=t[1]-e[1],i=t[2]-e[2];return n*n+r*r+i*i},o.sqrDist=o.squaredDistance,o.length=function(e){var t=e[0],n=e[1],r=e[2];return Math.sqrt(t*t+n*n+r*r)},o.len=o.length,o.squaredLength=function(e){var t=e[0],n=e[1],r=e[2];return t*t+n*n+r*r},o.sqrLen=o.squaredLength,o.negate=function(e,t){return e[0]=-t[0],e[1]=-t[1],e[2]=-t[2],e},o.normalize=function(e,t){var n=t[0],r=t[1],i=t[2],s=n*n+r*r+i*i;return s>0&&(s=1/Math.sqrt(s),e[0]=t[0]*s,e[1]=t[1]*s,e[2]=t[2]*s),e},o.dot=function(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]},o.cross=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=n[0],u=n[1],a=n[2];return e[0]=i*a-s*u,e[1]=s*o-r*a,e[2]=r*u-i*o,e},o.lerp=function(e,t,n,r){var i=t[0],s=t[1],o=t[2];return e[0]=i+r*(n[0]-i),e[1]=s+r*(n[1]-s),e[2]=o+r*(n[2]-o),e},o.random=function(e,t){t=t||1;var n=r()*2*Math.PI,i=r()*2-1,s=Math.sqrt(1-i*i)*t;return e[0]=Math.cos(n)*s,e[1]=Math.sin(n)*s,e[2]=i*t,e},o.transformMat4=function(e,t,n){var r=t[0],i=t[1],s=t[2];return e[0]=n[0]*r+n[4]*i+n[8]*s+n[12],e[1]=n[1]*r+n[5]*i+n[9]*s+n[13],e[2]=n[2]*r+n[6]*i+n[10]*s+n[14],e},o.transformMat3=function(e,t,n){var r=t[0],i=t[1],s=t[2];return e[0]=r*n[0]+i*n[3]+s*n[6],e[1]=r*n[1]+i*n[4]+s*n[7],e[2]=r*n[2]+i*n[5]+s*n[8],e},o.transformQuat=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=n[0],u=n[1],a=n[2],f=n[3],l=f*r+u*s-a*i,c=f*i+a*r-o*s,h=f*s+o*i-u*r,p=-o*r-u*i-a*s;return e[0]=l*f+p*-o+c*-a-h*-u,e[1]=c*f+p*-u+h*-o-l*-a,e[2]=h*f+p*-a+l*-u-c*-o,e},o.forEach=function(){var e=o.create();return function(t,n,r,i,s,o){var u,a;n||(n=3),r||(r=0),i?a=Math.min(i*n+r,t.length):a=t.length;for(u=r;u<a;u+=n)e[0]=t[u],e[1]=t[u+1],e[2]=t[u+2],s(e,e,o),t[u]=e[0],t[u+1]=e[1],t[u+2]=e[2];return t}}(),o.str=function(e){return"vec3("+e[0]+", "+e[1]+", "+e[2]+")"},typeof e!="undefined"&&(e.vec3=o);var u={};u.create=function(){var e=new n(4);return e[0]=0,e[1]=0,e[2]=0,e[3]=0,e},u.clone=function(e){var t=new n(4);return t[0]=e[0],t[1]=e[1],t[2]=e[2],t[3]=e[3],t},u.fromValues=function(e,t,r,i){var s=new n(4);return s[0]=e,s[1]=t,s[2]=r,s[3]=i,s},u.copy=function(e,t){return e[0]=t[0],e[1]=t[1],e[2]=t[2],e[3]=t[3],e},u.set=function(e,t,n,r,i){return e[0]=t,e[1]=n,e[2]=r,e[3]=i,e},u.add=function(e,t,n){return e[0]=t[0]+n[0],e[1]=t[1]+n[1],e[2]=t[2]+n[2],e[3]=t[3]+n[3],e},u.subtract=function(e,t,n){return e[0]=t[0]-n[0],e[1]=t[1]-n[1],e[2]=t[2]-n[2],e[3]=t[3]-n[3],e},u.sub=u.subtract,u.multiply=function(e,t,n){return e[0]=t[0]*n[0],e[1]=t[1]*n[1],e[2]=t[2]*n[2],e[3]=t[3]*n[3],e},u.mul=u.multiply,u.divide=function(e,t,n){return e[0]=t[0]/n[0],e[1]=t[1]/n[1],e[2]=t[2]/n[2],e[3]=t[3]/n[3],e},u.div=u.divide,u.min=function(e,t,n){return e[0]=Math.min(t[0],n[0]),e[1]=Math.min(t[1],n[1]),e[2]=Math.min(t[2],n[2]),e[3]=Math.min(t[3],n[3]),e},u.max=function(e,t,n){return e[0]=Math.max(t[0],n[0]),e[1]=Math.max(t[1],n[1]),e[2]=Math.max(t[2],n[2]),e[3]=Math.max(t[3],n[3]),e},u.scale=function(e,t,n){return e[0]=t[0]*n,e[1]=t[1]*n,e[2]=t[2]*n,e[3]=t[3]*n,e},u.scaleAndAdd=function(e,t,n,r){return e[0]=t[0]+n[0]*r,e[1]=t[1]+n[1]*r,e[2]=t[2]+n[2]*r,e[3]=t[3]+n[3]*r,e},u.distance=function(e,t){var n=t[0]-e[0],r=t[1]-e[1],i=t[2]-e[2],s=t[3]-e[3];return Math.sqrt(n*n+r*r+i*i+s*s)},u.dist=u.distance,u.squaredDistance=function(e,t){var n=t[0]-e[0],r=t[1]-e[1],i=t[2]-e[2],s=t[3]-e[3];return n*n+r*r+i*i+s*s},u.sqrDist=u.squaredDistance,u.length=function(e){var t=e[0],n=e[1],r=e[2],i=e[3];return Math.sqrt(t*t+n*n+r*r+i*i)},u.len=u.length,u.squaredLength=function(e){var t=e[0],n=e[1],r=e[2],i=e[3];return t*t+n*n+r*r+i*i},u.sqrLen=u.squaredLength,u.negate=function(e,t){return e[0]=-t[0],e[1]=-t[1],e[2]=-t[2],e[3]=-t[3],e},u.normalize=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=n*n+r*r+i*i+s*s;return o>0&&(o=1/Math.sqrt(o),e[0]=t[0]*o,e[1]=t[1]*o,e[2]=t[2]*o,e[3]=t[3]*o),e},u.dot=function(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]+e[3]*t[3]},u.lerp=function(e,t,n,r){var i=t[0],s=t[1],o=t[2],u=t[3];return e[0]=i+r*(n[0]-i),e[1]=s+r*(n[1]-s),e[2]=o+r*(n[2]-o),e[3]=u+r*(n[3]-u),e},u.random=function(e,t){return t=t||1,e[0]=r(),e[1]=r(),e[2]=r(),e[3]=r(),u.normalize(e,e),u.scale(e,e,t),e},u.transformMat4=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3];return e[0]=n[0]*r+n[4]*i+n[8]*s+n[12]*o,e[1]=n[1]*r+n[5]*i+n[9]*s+n[13]*o,e[2]=n[2]*r+n[6]*i+n[10]*s+n[14]*o,e[3]=n[3]*r+n[7]*i+n[11]*s+n[15]*o,e},u.transformQuat=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=n[0],u=n[1],a=n[2],f=n[3],l=f*r+u*s-a*i,c=f*i+a*r-o*s,h=f*s+o*i-u*r,p=-o*r-u*i-a*s;return e[0]=l*f+p*-o+c*-a-h*-u,e[1]=c*f+p*-u+h*-o-l*-a,e[2]=h*f+p*-a+l*-u-c*-o,e},u.forEach=function(){var e=u.create();return function(t,n,r,i,s,o){var u,a;n||(n=4),r||(r=0),i?a=Math.min(i*n+r,t.length):a=t.length;for(u=r;u<a;u+=n)e[0]=t[u],e[1]=t[u+1],e[2]=t[u+2],e[3]=t[u+3],s(e,e,o),t[u]=e[0],t[u+1]=e[1],t[u+2]=e[2],t[u+3]=e[3];return t}}(),u.str=function(e){return"vec4("+e[0]+", "+e[1]+", "+e[2]+", "+e[3]+")"},typeof e!="undefined"&&(e.vec4=u);var a={};a.create=function(){var e=new n(4);return e[0]=1,e[1]=0,e[2]=0,e[3]=1,e},a.clone=function(e){var t=new n(4);return t[0]=e[0],t[1]=e[1],t[2]=e[2],t[3]=e[3],t},a.copy=function(e,t){return e[0]=t[0],e[1]=t[1],e[2]=t[2],e[3]=t[3],e},a.identity=function(e){return e[0]=1,e[1]=0,e[2]=0,e[3]=1,e},a.transpose=function(e,t){if(e===t){var n=t[1];e[1]=t[2],e[2]=n}else e[0]=t[0],e[1]=t[2],e[2]=t[1],e[3]=t[3];return e},a.invert=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=n*s-i*r;return o?(o=1/o,e[0]=s*o,e[1]=-r*o,e[2]=-i*o,e[3]=n*o,e):null},a.adjoint=function(e,t){var n=t[0];return e[0]=t[3],e[1]=-t[1],e[2]=-t[2],e[3]=n,e},a.determinant=function(e){return e[0]*e[3]-e[2]*e[1]},a.multiply=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=n[0],a=n[1],f=n[2],l=n[3];return e[0]=r*u+i*f,e[1]=r*a+i*l,e[2]=s*u+o*f,e[3]=s*a+o*l,e},a.mul=a.multiply,a.rotate=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=Math.sin(n),a=Math.cos(n);return e[0]=r*a+i*u,e[1]=r*-u+i*a,e[2]=s*a+o*u,e[3]=s*-u+o*a,e},a.scale=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=n[0],a=n[1];return e[0]=r*u,e[1]=i*a,e[2]=s*u,e[3]=o*a,e},a.str=function(e){return"mat2("+e[0]+", "+e[1]+", "+e[2]+", "+e[3]+")"},typeof e!="undefined"&&(e.mat2=a);var f={};f.create=function(){var e=new n(6);return e[0]=1,e[1]=0,e[2]=0,e[3]=1,e[4]=0,e[5]=0,e},f.clone=function(e){var t=new n(6);return t[0]=e[0],t[1]=e[1],t[2]=e[2],t[3]=e[3],t[4]=e[4],t[5]=e[5],t},f.copy=function(e,t){return e[0]=t[0],e[1]=t[1],e[2]=t[2],e[3]=t[3],e[4]=t[4],e[5]=t[5],e},f.identity=function(e){return e[0]=1,e[1]=0,e[2]=0,e[3]=1,e[4]=0,e[5]=0,e},f.invert=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=t[4],u=t[5],a=n*s-r*i;return a?(a=1/a,e[0]=s*a,e[1]=-r*a,e[2]=-i*a,e[3]=n*a,e[4]=(i*u-s*o)*a,e[5]=(r*o-n*u)*a,e):null},f.determinant=function(e){return e[0]*e[3]-e[1]*e[2]},f.multiply=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=t[4],a=t[5],f=n[0],l=n[1],c=n[2],h=n[3],p=n[4],d=n[5];return e[0]=r*f+i*c,e[1]=r*l+i*h,e[2]=s*f+o*c,e[3]=s*l+o*h,e[4]=f*u+c*a+p,e[5]=l*u+h*a+d,e},f.mul=f.multiply,f.rotate=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=t[4],a=t[5],f=Math.sin(n),l=Math.cos(n);return e[0]=r*l+i*f,e[1]=-r*f+i*l,e[2]=s*l+o*f,e[3]=-s*f+l*o,e[4]=l*u+f*a,e[5]=l*a-f*u,e},f.scale=function(e,t,n){var r=n[0],i=n[1];return e[0]=t[0]*r,e[1]=t[1]*i,e[2]=t[2]*r,e[3]=t[3]*i,e[4]=t[4]*r,e[5]=t[5]*i,e},f.translate=function(e,t,n){return e[0]=t[0],e[1]=t[1],e[2]=t[2],e[3]=t[3],e[4]=t[4]+n[0],e[5]=t[5]+n[1],e},f.str=function(e){return"mat2d("+e[0]+", "+e[1]+", "+e[2]+", "+e[3]+", "+e[4]+", "+e[5]+")"},typeof e!="undefined"&&(e.mat2d=f);var l={};l.create=function(){var e=new n(9);return e[0]=1,e[1]=0,e[2]=0,e[3]=0,e[4]=1,e[5]=0,e[6]=0,e[7]=0,e[8]=1,e},l.fromMat4=function(e,t){return e[0]=t[0],e[1]=t[1],e[2]=t[2],e[3]=t[4],e[4]=t[5],e[5]=t[6],e[6]=t[8],e[7]=t[9],e[8]=t[10],e},l.clone=function(e){var t=new n(9);return t[0]=e[0],t[1]=e[1],t[2]=e[2],t[3]=e[3],t[4]=e[4],t[5]=e[5],t[6]=e[6],t[7]=e[7],t[8]=e[8],t},l.copy=function(e,t){return e[0]=t[0],e[1]=t[1],e[2]=t[2],e[3]=t[3],e[4]=t[4],e[5]=t[5],e[6]=t[6],e[7]=t[7],e[8]=t[8],e},l.identity=function(e){return e[0]=1,e[1]=0,e[2]=0,e[3]=0,e[4]=1,e[5]=0,e[6]=0,e[7]=0,e[8]=1,e},l.transpose=function(e,t){if(e===t){var n=t[1],r=t[2],i=t[5];e[1]=t[3],e[2]=t[6],e[3]=n,e[5]=t[7],e[6]=r,e[7]=i}else e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8];return e},l.invert=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=t[4],u=t[5],a=t[6],f=t[7],l=t[8],c=l*o-u*f,h=-l*s+u*a,p=f*s-o*a,d=n*c+r*h+i*p;return d?(d=1/d,e[0]=c*d,e[1]=(-l*r+i*f)*d,e[2]=(u*r-i*o)*d,e[3]=h*d,e[4]=(l*n-i*a)*d,e[5]=(-u*n+i*s)*d,e[6]=p*d,e[7]=(-f*n+r*a)*d,e[8]=(o*n-r*s)*d,e):null},l.adjoint=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=t[4],u=t[5],a=t[6],f=t[7],l=t[8];return e[0]=o*l-u*f,e[1]=i*f-r*l,e[2]=r*u-i*o,e[3]=u*a-s*l,e[4]=n*l-i*a,e[5]=i*s-n*u,e[6]=s*f-o*a,e[7]=r*a-n*f,e[8]=n*o-r*s,e},l.determinant=function(e){var t=e[0],n=e[1],r=e[2],i=e[3],s=e[4],o=e[5],u=e[6],a=e[7],f=e[8];return t*(f*s-o*a)+n*(-f*i+o*u)+r*(a*i-s*u)},l.multiply=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=t[4],a=t[5],f=t[6],l=t[7],c=t[8],h=n[0],p=n[1],d=n[2],v=n[3],m=n[4],g=n[5],y=n[6],b=n[7],w=n[8];return e[0]=h*r+p*o+d*f,e[1]=h*i+p*u+d*l,e[2]=h*s+p*a+d*c,e[3]=v*r+m*o+g*f,e[4]=v*i+m*u+g*l,e[5]=v*s+m*a+g*c,e[6]=y*r+b*o+w*f,e[7]=y*i+b*u+w*l,e[8]=y*s+b*a+w*c,e},l.mul=l.multiply,l.translate=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=t[4],a=t[5],f=t[6],l=t[7],c=t[8],h=n[0],p=n[1];return e[0]=r,e[1]=i,e[2]=s,e[3]=o,e[4]=u,e[5]=a,e[6]=h*r+p*o+f,e[7]=h*i+p*u+l,e[8]=h*s+p*a+c,e},l.rotate=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=t[4],a=t[5],f=t[6],l=t[7],c=t[8],h=Math.sin(n),p=Math.cos(n);return e[0]=p*r+h*o,e[1]=p*i+h*u,e[2]=p*s+h*a,e[3]=p*o-h*r,e[4]=p*u-h*i,e[5]=p*a-h*s,e[6]=f,e[7]=l,e[8]=c,e},l.scale=function(e,t,n){var r=n[0],i=n[1];return e[0]=r*t[0],e[1]=r*t[1],e[2]=r*t[2],e[3]=i*t[3],e[4]=i*t[4],e[5]=i*t[5],e[6]=t[6],e[7]=t[7],e[8]=t[8],e},l.fromMat2d=function(e,t){return e[0]=t[0],e[1]=t[1],e[2]=0,e[3]=t[2],e[4]=t[3],e[5]=0,e[6]=t[4],e[7]=t[5],e[8]=1,e},l.fromQuat=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=n+n,u=r+r,a=i+i,f=n*o,l=n*u,c=n*a,h=r*u,p=r*a,d=i*a,v=s*o,m=s*u,g=s*a;return e[0]=1-(h+d),e[3]=l+g,e[6]=c-m,e[1]=l-g,e[4]=1-(f+d),e[7]=p+v,e[2]=c+m,e[5]=p-v,e[8]=1-(f+h),e},l.normalFromMat4=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=t[4],u=t[5],a=t[6],f=t[7],l=t[8],c=t[9],h=t[10],p=t[11],d=t[12],v=t[13],m=t[14],g=t[15],y=n*u-r*o,b=n*a-i*o,w=n*f-s*o,E=r*a-i*u,S=r*f-s*u,x=i*f-s*a,T=l*v-c*d,N=l*m-h*d,C=l*g-p*d,k=c*m-h*v,L=c*g-p*v,A=h*g-p*m,O=y*A-b*L+w*k+E*C-S*N+x*T;return O?(O=1/O,e[0]=(u*A-a*L+f*k)*O,e[1]=(a*C-o*A-f*N)*O,e[2]=(o*L-u*C+f*T)*O,e[3]=(i*L-r*A-s*k)*O,e[4]=(n*A-i*C+s*N)*O,e[5]=(r*C-n*L-s*T)*O,e[6]=(v*x-m*S+g*E)*O,e[7]=(m*w-d*x-g*b)*O,e[8]=(d*S-v*w+g*y)*O,e):null},l.str=function(e){return"mat3("+e[0]+", "+e[1]+", "+e[2]+", "+e[3]+", "+e[4]+", "+e[5]+", "+e[6]+", "+e[7]+", "+e[8]+")"},typeof e!="undefined"&&(e.mat3=l);var c={};c.create=function(){var e=new n(16);return e[0]=1,e[1]=0,e[2]=0,e[3]=0,e[4]=0,e[5]=1,e[6]=0,e[7]=0,e[8]=0,e[9]=0,e[10]=1,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,e},c.clone=function(e){var t=new n(16);return t[0]=e[0],t[1]=e[1],t[2]=e[2],t[3]=e[3],t[4]=e[4],t[5]=e[5],t[6]=e[6],t[7]=e[7],t[8]=e[8],t[9]=e[9],t[10]=e[10],t[11]=e[11],t[12]=e[12],t[13]=e[13],t[14]=e[14],t[15]=e[15],t},c.copy=function(e,t){return e[0]=t[0],e[1]=t[1],e[2]=t[2],e[3]=t[3],e[4]=t[4],e[5]=t[5],e[6]=t[6],e[7]=t[7],e[8]=t[8],e[9]=t[9],e[10]=t[10],e[11]=t[11],e[12]=t[12],e[13]=t[13],e[14]=t[14],e[15]=t[15],e},c.identity=function(e){return e[0]=1,e[1]=0,e[2]=0,e[3]=0,e[4]=0,e[5]=1,e[6]=0,e[7]=0,e[8]=0,e[9]=0,e[10]=1,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,e},c.transpose=function(e,t){if(e===t){var n=t[1],r=t[2],i=t[3],s=t[6],o=t[7],u=t[11];e[1]=t[4],e[2]=t[8],e[3]=t[12],e[4]=n,e[6]=t[9],e[7]=t[13],e[8]=r,e[9]=s,e[11]=t[14],e[12]=i,e[13]=o,e[14]=u}else e[0]=t[0],e[1]=t[4],e[2]=t[8],e[3]=t[12],e[4]=t[1],e[5]=t[5],e[6]=t[9],e[7]=t[13],e[8]=t[2],e[9]=t[6],e[10]=t[10],e[11]=t[14],e[12]=t[3],e[13]=t[7],e[14]=t[11],e[15]=t[15];return e},c.invert=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=t[4],u=t[5],a=t[6],f=t[7],l=t[8],c=t[9],h=t[10],p=t[11],d=t[12],v=t[13],m=t[14],g=t[15],y=n*u-r*o,b=n*a-i*o,w=n*f-s*o,E=r*a-i*u,S=r*f-s*u,x=i*f-s*a,T=l*v-c*d,N=l*m-h*d,C=l*g-p*d,k=c*m-h*v,L=c*g-p*v,A=h*g-p*m,O=y*A-b*L+w*k+E*C-S*N+x*T;return O?(O=1/O,e[0]=(u*A-a*L+f*k)*O,e[1]=(i*L-r*A-s*k)*O,e[2]=(v*x-m*S+g*E)*O,e[3]=(h*S-c*x-p*E)*O,e[4]=(a*C-o*A-f*N)*O,e[5]=(n*A-i*C+s*N)*O,e[6]=(m*w-d*x-g*b)*O,e[7]=(l*x-h*w+p*b)*O,e[8]=(o*L-u*C+f*T)*O,e[9]=(r*C-n*L-s*T)*O,e[10]=(d*S-v*w+g*y)*O,e[11]=(c*w-l*S-p*y)*O,e[12]=(u*N-o*k-a*T)*O,e[13]=(n*k-r*N+i*T)*O,e[14]=(v*b-d*E-m*y)*O,e[15]=(l*E-c*b+h*y)*O,e):null},c.adjoint=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=t[4],u=t[5],a=t[6],f=t[7],l=t[8],c=t[9],h=t[10],p=t[11],d=t[12],v=t[13],m=t[14],g=t[15];return e[0]=u*(h*g-p*m)-c*(a*g-f*m)+v*(a*p-f*h),e[1]=-(r*(h*g-p*m)-c*(i*g-s*m)+v*(i*p-s*h)),e[2]=r*(a*g-f*m)-u*(i*g-s*m)+v*(i*f-s*a),e[3]=-(r*(a*p-f*h)-u*(i*p-s*h)+c*(i*f-s*a)),e[4]=-(o*(h*g-p*m)-l*(a*g-f*m)+d*(a*p-f*h)),e[5]=n*(h*g-p*m)-l*(i*g-s*m)+d*(i*p-s*h),e[6]=-(n*(a*g-f*m)-o*(i*g-s*m)+d*(i*f-s*a)),e[7]=n*(a*p-f*h)-o*(i*p-s*h)+l*(i*f-s*a),e[8]=o*(c*g-p*v)-l*(u*g-f*v)+d*(u*p-f*c),e[9]=-(n*(c*g-p*v)-l*(r*g-s*v)+d*(r*p-s*c)),e[10]=n*(u*g-f*v)-o*(r*g-s*v)+d*(r*f-s*u),e[11]=-(n*(u*p-f*c)-o*(r*p-s*c)+l*(r*f-s*u)),e[12]=-(o*(c*m-h*v)-l*(u*m-a*v)+d*(u*h-a*c)),e[13]=n*(c*m-h*v)-l*(r*m-i*v)+d*(r*h-i*c),e[14]=-(n*(u*m-a*v)-o*(r*m-i*v)+d*(r*a-i*u)),e[15]=n*(u*h-a*c)-o*(r*h-i*c)+l*(r*a-i*u),e},c.determinant=function(e){var t=e[0],n=e[1],r=e[2],i=e[3],s=e[4],o=e[5],u=e[6],a=e[7],f=e[8],l=e[9],c=e[10],h=e[11],p=e[12],d=e[13],v=e[14],m=e[15],g=t*o-n*s,y=t*u-r*s,b=t*a-i*s,w=n*u-r*o,E=n*a-i*o,S=r*a-i*u,x=f*d-l*p,T=f*v-c*p,N=f*m-h*p,C=l*v-c*d,k=l*m-h*d,L=c*m-h*v;return g*L-y*k+b*C+w*N-E*T+S*x},c.multiply=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=t[4],a=t[5],f=t[6],l=t[7],c=t[8],h=t[9],p=t[10],d=t[11],v=t[12],m=t[13],g=t[14],y=t[15],b=n[0],w=n[1],E=n[2],S=n[3];return e[0]=b*r+w*u+E*c+S*v,e[1]=b*i+w*a+E*h+S*m,e[2]=b*s+w*f+E*p+S*g,e[3]=b*o+w*l+E*d+S*y,b=n[4],w=n[5],E=n[6],S=n[7],e[4]=b*r+w*u+E*c+S*v,e[5]=b*i+w*a+E*h+S*m,e[6]=b*s+w*f+E*p+S*g,e[7]=b*o+w*l+E*d+S*y,b=n[8],w=n[9],E=n[10],S=n[11],e[8]=b*r+w*u+E*c+S*v,e[9]=b*i+w*a+E*h+S*m,e[10]=b*s+w*f+E*p+S*g,e[11]=b*o+w*l+E*d+S*y,b=n[12],w=n[13],E=n[14],S=n[15],e[12]=b*r+w*u+E*c+S*v,e[13]=b*i+w*a+E*h+S*m,e[14]=b*s+w*f+E*p+S*g,e[15]=b*o+w*l+E*d+S*y,e},c.mul=c.multiply,c.translate=function(e,t,n){var r=n[0],i=n[1],s=n[2],o,u,a,f,l,c,h,p,d,v,m,g;return t===e?(e[12]=t[0]*r+t[4]*i+t[8]*s+t[12],e[13]=t[1]*r+t[5]*i+t[9]*s+t[13],e[14]=t[2]*r+t[6]*i+t[10]*s+t[14],e[15]=t[3]*r+t[7]*i+t[11]*s+t[15]):(o=t[0],u=t[1],a=t[2],f=t[3],l=t[4],c=t[5],h=t[6],p=t[7],d=t[8],v=t[9],m=t[10],g=t[11],e[0]=o,e[1]=u,e[2]=a,e[3]=f,e[4]=l,e[5]=c,e[6]=h,e[7]=p,e[8]=d,e[9]=v,e[10]=m,e[11]=g,e[12]=o*r+l*i+d*s+t[12],e[13]=u*r+c*i+v*s+t[13],e[14]=a*r+h*i+m*s+t[14],e[15]=f*r+p*i+g*s+t[15]),e},c.scale=function(e,t,n){var r=n[0],i=n[1],s=n[2];return e[0]=t[0]*r,e[1]=t[1]*r,e[2]=t[2]*r,e[3]=t[3]*r,e[4]=t[4]*i,e[5]=t[5]*i,e[6]=t[6]*i,e[7]=t[7]*i,e[8]=t[8]*s,e[9]=t[9]*s,e[10]=t[10]*s,e[11]=t[11]*s,e[12]=t[12],e[13]=t[13],e[14]=t[14],e[15]=t[15],e},c.rotate=function(e,n,r,i){var s=i[0],o=i[1],u=i[2],a=Math.sqrt(s*s+o*o+u*u),f,l,c,h,p,d,v,m,g,y,b,w,E,S,x,T,N,C,k,L,A,O,M,_;return Math.abs(a)<t?null:(a=1/a,s*=a,o*=a,u*=a,f=Math.sin(r),l=Math.cos(r),c=1-l,h=n[0],p=n[1],d=n[2],v=n[3],m=n[4],g=n[5],y=n[6],b=n[7],w=n[8],E=n[9],S=n[10],x=n[11],T=s*s*c+l,N=o*s*c+u*f,C=u*s*c-o*f,k=s*o*c-u*f,L=o*o*c+l,A=u*o*c+s*f,O=s*u*c+o*f,M=o*u*c-s*f,_=u*u*c+l,e[0]=h*T+m*N+w*C,e[1]=p*T+g*N+E*C,e[2]=d*T+y*N+S*C,e[3]=v*T+b*N+x*C,e[4]=h*k+m*L+w*A,e[5]=p*k+g*L+E*A,e[6]=d*k+y*L+S*A,e[7]=v*k+b*L+x*A,e[8]=h*O+m*M+w*_,e[9]=p*O+g*M+E*_,e[10]=d*O+y*M+S*_,e[11]=v*O+b*M+x*_,n!==e&&(e[12]=n[12],e[13]=n[13],e[14]=n[14],e[15]=n[15]),e)},c.rotateX=function(e,t,n){var r=Math.sin(n),i=Math.cos(n),s=t[4],o=t[5],u=t[6],a=t[7],f=t[8],l=t[9],c=t[10],h=t[11];return t!==e&&(e[0]=t[0],e[1]=t[1],e[2]=t[2],e[3]=t[3],e[12]=t[12],e[13]=t[13],e[14]=t[14],e[15]=t[15]),e[4]=s*i+f*r,e[5]=o*i+l*r,e[6]=u*i+c*r,e[7]=a*i+h*r,e[8]=f*i-s*r,e[9]=l*i-o*r,e[10]=c*i-u*r,e[11]=h*i-a*r,e},c.rotateY=function(e,t,n){var r=Math.sin(n),i=Math.cos(n),s=t[0],o=t[1],u=t[2],a=t[3],f=t[8],l=t[9],c=t[10],h=t[11];return t!==e&&(e[4]=t[4],e[5]=t[5],e[6]=t[6],e[7]=t[7],e[12]=t[12],e[13]=t[13],e[14]=t[14],e[15]=t[15]),e[0]=s*i-f*r,e[1]=o*i-l*r,e[2]=u*i-c*r,e[3]=a*i-h*r,e[8]=s*r+f*i,e[9]=o*r+l*i,e[10]=u*r+c*i,e[11]=a*r+h*i,e},c.rotateZ=function(e,t,n){var r=Math.sin(n),i=Math.cos(n),s=t[0],o=t[1],u=t[2],a=t[3],f=t[4],l=t[5],c=t[6],h=t[7];return t!==e&&(e[8]=t[8],e[9]=t[9],e[10]=t[10],e[11]=t[11],e[12]=t[12],e[13]=t[13],e[14]=t[14],e[15]=t[15]),e[0]=s*i+f*r,e[1]=o*i+l*r,e[2]=u*i+c*r,e[3]=a*i+h*r,e[4]=f*i-s*r,e[5]=l*i-o*r,e[6]=c*i-u*r,e[7]=h*i-a*r,e},c.fromRotationTranslation=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=r+r,a=i+i,f=s+s,l=r*u,c=r*a,h=r*f,p=i*a,d=i*f,v=s*f,m=o*u,g=o*a,y=o*f;return e[0]=1-(p+v),e[1]=c+y,e[2]=h-g,e[3]=0,e[4]=c-y,e[5]=1-(l+v),e[6]=d+m,e[7]=0,e[8]=h+g,e[9]=d-m,e[10]=1-(l+p),e[11]=0,e[12]=n[0],e[13]=n[1],e[14]=n[2],e[15]=1,e},c.fromQuat=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=n+n,u=r+r,a=i+i,f=n*o,l=n*u,c=n*a,h=r*u,p=r*a,d=i*a,v=s*o,m=s*u,g=s*a;return e[0]=1-(h+d),e[1]=l+g,e[2]=c-m,e[3]=0,e[4]=l-g,e[5]=1-(f+d),e[6]=p+v,e[7]=0,e[8]=c+m,e[9]=p-v,e[10]=1-(f+h),e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,e},c.frustum=function(e,t,n,r,i,s,o){var u=1/(n-t),a=1/(i-r),f=1/(s-o);return e[0]=s*2*u,e[1]=0,e[2]=0,e[3]=0,e[4]=0,e[5]=s*2*a,e[6]=0,e[7]=0,e[8]=(n+t)*u,e[9]=(i+r)*a,e[10]=(o+s)*f,e[11]=-1,e[12]=0,e[13]=0,e[14]=o*s*2*f,e[15]=0,e},c.perspective=function(e,t,n,r,i){var s=1/Math.tan(t/2),o=1/(r-i);return e[0]=s/n,e[1]=0,e[2]=0,e[3]=0,e[4]=0,e[5]=s,e[6]=0,e[7]=0,e[8]=0,e[9]=0,e[10]=(i+r)*o,e[11]=-1,e[12]=0,e[13]=0,e[14]=2*i*r*o,e[15]=0,e},c.ortho=function(e,t,n,r,i,s,o){var u=1/(t-n),a=1/(r-i),f=1/(s-o);return e[0]=-2*u,e[1]=0,e[2]=0,e[3]=0,e[4]=0,e[5]=-2*a,e[6]=0,e[7]=0,e[8]=0,e[9]=0,e[10]=2*f,e[11]=0,e[12]=(t+n)*u,e[13]=(i+r)*a,e[14]=(o+s)*f,e[15]=1,e},c.lookAt=function(e,n,r,i){var s,o,u,a,f,l,h,p,d,v,m=n[0],g=n[1],y=n[2],b=i[0],w=i[1],E=i[2],S=r[0],x=r[1],T=r[2];return Math.abs(m-S)<t&&Math.abs(g-x)<t&&Math.abs(y-T)<t?c.identity(e):(h=m-S,p=g-x,d=y-T,v=1/Math.sqrt(h*h+p*p+d*d),h*=v,p*=v,d*=v,s=w*d-E*p,o=E*h-b*d,u=b*p-w*h,v=Math.sqrt(s*s+o*o+u*u),v?(v=1/v,s*=v,o*=v,u*=v):(s=0,o=0,u=0),a=p*u-d*o,f=d*s-h*u,l=h*o-p*s,v=Math.sqrt(a*a+f*f+l*l),v?(v=1/v,a*=v,f*=v,l*=v):(a=0,f=0,l=0),e[0]=s,e[1]=a,e[2]=h,e[3]=0,e[4]=o,e[5]=f,e[6]=p,e[7]=0,e[8]=u,e[9]=l,e[10]=d,e[11]=0,e[12]=-(s*m+o*g+u*y),e[13]=-(a*m+f*g+l*y),e[14]=-(h*m+p*g+d*y),e[15]=1,e)},c.str=function(e){return"mat4("+e[0]+", "+e[1]+", "+e[2]+", "+e[3]+", "+e[4]+", "+e[5]+", "+e[6]+", "+e[7]+", "+e[8]+", "+e[9]+", "+e[10]+", "+e[11]+", "+e[12]+", "+e[13]+", "+e[14]+", "+e[15]+")"},typeof e!="undefined"&&(e.mat4=c);var h={};h.create=function(){var e=new n(4);return e[0]=0,e[1]=0,e[2]=0,e[3]=1,e},h.rotationTo=function(){var e=o.create(),t=o.fromValues(1,0,0),n=o.fromValues(0,1,0);return function(r,i,s){var u=o.dot(i,s);return u<-0.999999?(o.cross(e,t,i),o.length(e)<1e-6&&o.cross(e,n,i),o.normalize(e,e),h.setAxisAngle(r,e,Math.PI),r):u>.999999?(r[0]=0,r[1]=0,r[2]=0,r[3]=1,r):(o.cross(e,i,s),r[0]=e[0],r[1]=e[1],r[2]=e[2],r[3]=1+u,h.normalize(r,r))}}(),h.setAxes=function(){var e=l.create();return function(t,n,r,i){return e[0]=r[0],e[3]=r[1],e[6]=r[2],e[1]=i[0],e[4]=i[1],e[7]=i[2],e[2]=n[0],e[5]=n[1],e[8]=n[2],h.normalize(t,h.fromMat3(t,e))}}(),h.clone=u.clone,h.fromValues=u.fromValues,h.copy=u.copy,h.set=u.set,h.identity=function(e){return e[0]=0,e[1]=0,e[2]=0,e[3]=1,e},h.setAxisAngle=function(e,t,n){n*=.5;var r=Math.sin(n);return e[0]=r*t[0],e[1]=r*t[1],e[2]=r*t[2],e[3]=Math.cos(n),e},h.add=u.add,h.multiply=function(e,t,n){var r=t[0],i=t[1],s=t[2],o=t[3],u=n[0],a=n[1],f=n[2],l=n[3];return e[0]=r*l+o*u+i*f-s*a,e[1]=i*l+o*a+s*u-r*f,e[2]=s*l+o*f+r*a-i*u,e[3]=o*l-r*u-i*a-s*f,e},h.mul=h.multiply,h.scale=u.scale,h.rotateX=function(e,t,n){n*=.5;var r=t[0],i=t[1],s=t[2],o=t[3],u=Math.sin(n),a=Math.cos(n);return e[0]=r*a+o*u,e[1]=i*a+s*u,e[2]=s*a-i*u,e[3]=o*a-r*u,e},h.rotateY=function(e,t,n){n*=.5;var r=t[0],i=t[1],s=t[2],o=t[3],u=Math.sin(n),a=Math.cos(n);return e[0]=r*a-s*u,e[1]=i*a+o*u,e[2]=s*a+r*u,e[3]=o*a-i*u,e},h.rotateZ=function(e,t,n){n*=.5;var r=t[0],i=t[1],s=t[2],o=t[3],u=Math.sin(n),a=Math.cos(n);return e[0]=r*a+i*u,e[1]=i*a-r*u,e[2]=s*a+o*u,e[3]=o*a-s*u,e},h.calculateW=function(e,t){var n=t[0],r=t[1],i=t[2];return e[0]=n,e[1]=r,e[2]=i,e[3]=-Math.sqrt(Math.abs(1-n*n-r*r-i*i)),e},h.dot=u.dot,h.lerp=u.lerp,h.slerp=function(e,t,n,r){var i=t[0],s=t[1],o=t[2],u=t[3],a=n[0],f=n[1],l=n[2],c=n[3],h,p,d,v,m;return p=i*a+s*f+o*l+u*c,p<0&&(p=-p,a=-a,f=-f,l=-l,c=-c),1-p>1e-6?(h=Math.acos(p),d=Math.sin(h),v=Math.sin((1-r)*h)/d,m=Math.sin(r*h)/d):(v=1-r,m=r),e[0]=v*i+m*a,e[1]=v*s+m*f,e[2]=v*o+m*l,e[3]=v*u+m*c,e},h.invert=function(e,t){var n=t[0],r=t[1],i=t[2],s=t[3],o=n*n+r*r+i*i+s*s,u=o?1/o:0;return e[0]=-n*u,e[1]=-r*u,e[2]=-i*u,e[3]=s*u,e},h.conjugate=function(e,t){return e[0]=-t[0],e[1]=-t[1],e[2]=-t[2],e[3]=t[3],e},h.length=u.length,h.len=h.length,h.squaredLength=u.squaredLength,h.sqrLen=h.squaredLength,h.normalize=u.normalize,h.fromMat3=function(){var e=typeof Int8Array!="undefined"?new Int8Array([1,2,0]):[1,2,0];return function(t,n){var r=n[0]+n[4]+n[8],i;if(r>0)i=Math.sqrt(r+1),t[3]=.5*i,i=.5/i,t[0]=(n[7]-n[5])*i,t[1]=(n[2]-n[6])*i,t[2]=(n[3]-n[1])*i;else{var s=0;n[4]>n[0]&&(s=1),n[8]>n[s*3+s]&&(s=2);var o=e[s],u=e[o];i=Math.sqrt(n[s*3+s]-n[o*3+o]-n[u*3+u]+1),t[s]=.5*i,i=.5/i,t[3]=(n[u*3+o]-n[o*3+u])*i,t[o]=(n[o*3+s]+n[s*3+o])*i,t[u]=(n[u*3+s]+n[s*3+u])*i}return t}}(),h.str=function(e){return"quat("+e[0]+", "+e[1]+", "+e[2]+", "+e[3]+")"},typeof e!="undefined"&&(e.quat=h)}(t.exports)})(this);

},{}],15:[function(require,module,exports){
/*
	glShader
	Copyright (c) 2013, Nervous System, inc. All rights reserved.
	
	Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

	uses some ideas (and code) from gl-shader https://github.com/mikolalysenko/gl-shader
	however some differences include saving uniform locations and querying gl to get uniforms and attribs instead of parsing files and uses normal syntax instead of fake operator overloading which is a confusing pattern in Javascript.
*/

(function(_global) {
  "use strict";

  var shim = {};
  if (typeof(exports) === 'undefined') {
    if(typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
      shim.exports = {};
      define(function() {
        return shim.exports;
      });
    } else {
      //this thing lives in a browser, define its namespaces in global
      shim.exports = typeof(window) !== 'undefined' ? window : _global;
    }
  }
  else {
    //this thing lives in commonjs, define its namespaces in exports
    shim.exports = exports;
  }
  (function(exports) {


  var gl;
  function Shader(gl, prog) {
    this.gl = gl;
    this.program = prog;
    this.uniforms = {};
    this.attribs = {};
    this.isReady = false;
  }

  Shader.prototype.begin = function() {
    this.gl.useProgram(this.program);
    this.enableAttribs();
  }

  Shader.prototype.end = function() {
    this.disableAttribs();
  }

  Shader.prototype.enableAttribs = function() {
    for(var attrib in this.attribs) {
    this.attribs[attrib].enable();
    }
  }
  Shader.prototype.disableAttribs = function() {
    for(var attrib in this.attribs) {
    this.attribs[attrib].disable();
    }
  }

  function makeVectorUniform(gl, shader, location, obj, type, d, name) {
    var uniformObj = {};
    uniformObj.location = location;
    if(d > 1) {
      type += "v";
    }
    var setter = new Function("gl", "prog", "loc", "v", "gl.uniform" + d + type + "(loc, v)");
    uniformObj.set = setter.bind(undefined, gl, shader.program,location);
    Object.defineProperty(obj, name, {
      value:uniformObj,
      enumerable: true
    });
  }

  function makeMatrixUniform(gl, shader, location, obj, d, name) {
    var uniformObj = {};
    uniformObj.location = location;
    var setter = new Function("gl", "prog", "loc","v", "gl.uniformMatrix" + d + "fv(loc, false, v)");
    uniformObj.set = setter.bind(undefined, gl, shader.program,location);
    Object.defineProperty(obj, name, {
      value:uniformObj,
      enumerable: true
    });
  }

  function makeVectorAttrib(gl, shader, location, obj, d, name) {
    var out = {};
    out.set = function setAttrib(buffer,type) {
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.vertexAttribPointer(location, d, type||gl.FLOAT, false, 0, 0);
    }
    out.pointer = function attribPointer(type, normalized, stride, offset) {
      gl.vertexAttribPointer(location, d, type||gl.FLOAT, normalized?true:false, stride||0, offset||0);
    };
    out.enable = function enableAttrib() {
      gl.enableVertexAttribArray(location);
    };
    out.disable = function disableAttrib() {
      gl.disableVertexAttribArray(location);
    };
    out.location = location;
    Object.defineProperty(obj, name, {
    value: out,
    enumerable: true
    });
  }

  function setupUniform(gl,shader, uniform,loc) {
    switch(uniform.type) {
      case gl.INT:
      case gl.BOOL:
      case gl.SAMPLER_2D:
      case gl.SAMPLER_CUBE:
        makeVectorUniform(gl,shader,loc, shader.uniforms, "i",1,uniform.name);
        break;
      case gl.INT_VEC2:
      case gl.BOOL_VEC2:
        makeVectorUniform(gl,shader,loc, shader.uniforms, "i",2,uniform.name);
        break;
      case gl.INT_VEC3:
      case gl.BOOL_VEC3:
        makeVectorUniform(gl,shader,loc, shader.uniforms, "i",3,uniform.name);
        break;
      case gl.INT_VEC4:
      case gl.BOOL_VEC4:
        makeVectorUniform(gl,shader,loc, shader.uniforms, "i",4,uniform.name);
        break;
      case gl.FLOAT:
        makeVectorUniform(gl,shader,loc, shader.uniforms, "f",1,uniform.name);
        break;
      case gl.FLOAT_VEC2:
        makeVectorUniform(gl,shader,loc, shader.uniforms, "f",2,uniform.name);
        break;
      case gl.FLOAT_VEC3:
        makeVectorUniform(gl,shader,loc, shader.uniforms, "f",3,uniform.name);
        break;
      case gl.FLOAT_VEC4:
        makeVectorUniform(gl,shader,loc, shader.uniforms, "f",4,uniform.name);
        break;
      case gl.FLOAT_MAT2:
        makeMatrixUniform(gl,shader,loc, shader.uniforms, 2,uniform.name);
        break;
      case gl.FLOAT_MAT3:
        makeMatrixUniform(gl,shader,loc, shader.uniforms, 3,uniform.name);
        break;
      case gl.FLOAT_MAT4:
        makeMatrixUniform(gl,shader,loc, shader.uniforms, 4,uniform.name);
        break;
      default:
        throw new Error("Invalid uniform type in shader: " +shader);
        break;
    }
  }

  function setupAttrib(gl,shader,attrib,location) {
    var len = 1;
    switch(attrib.type) {
      case gl.FLOAT_VEC2:
        len = 2;
        break;
      case gl.FLOAT_VEC3:
        len = 3;
        break;
      case gl.FLOAT_VEC4:
        len = 4;
        break;
    }
    makeVectorAttrib(gl, shader, location,shader.attribs, len, attrib.name);
  }


  function loadXMLDoc(filename, callback) {
      var xmlhttp;
      var text;
      xmlhttp = new XMLHttpRequest();

      xmlhttp.onreadystatechange = function() {
          if (xmlhttp.readyState == 4 && xmlhttp.status == 200) callback(xmlhttp.responseText);
      }

      xmlhttp.open("GET", filename, true);
      xmlhttp.send();
  }

  function getShader(gl, src, type) {
      var shader;
      //decides if it's a fragment or vertex shader

      if (type == "fragment") {
          shader = gl.createShader(gl.FRAGMENT_SHADER);
      }
      else if (type == "vertex") {
          shader = gl.createShader(gl.VERTEX_SHADER);
      }
      else {
          return null;
      }
      gl.shaderSource(shader, src);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          alert(gl.getShaderInfoLog(shader));
          return null;
      }
      return shader;
  }

  function setupShaderProgram(gl,shaderProgram, vertexShader, fragmentShader,callback) {
      gl.attachShader(shaderProgram, vertexShader);
      gl.attachShader(shaderProgram, fragmentShader);
      gl.linkProgram(shaderProgram);

      if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
          alert("Could not initialise shaders");
      }
      callback(shaderProgram);
  }

  var glShader = exports;
  
  glShader.setGL = function(_gl) {
    gl = _gl;
  }
  
  glShader.makeShader = function(gl,program,shader) {
    var totalUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    shader = shader || new Shader(gl,program);
    for(var i=0;i<totalUniforms;++i) {
      var uniform = gl.getActiveUniform(program, i);
      setupUniform(gl,shader, uniform,gl.getUniformLocation(program, uniform.name));
    }
    var totalAttribs = gl.getProgramParameter(program,gl.ACTIVE_ATTRIBUTES);
    for(var i=0;i<totalAttribs;++i) {
      var attrib = gl.getActiveAttrib(program, i);
      setupAttrib(gl,shader,attrib,i);
    }
    shader.isReady = true;
    return shader;
  }

  glShader.loadShader = function(gl, vertexFile, fragmentFile) {
      var shaderProgram = gl.createProgram();
    var shader = new Shader(gl,shaderProgram);
      var fragShader, vertShader;
      var loaded = 0;
      var xmlhttp;
      xmlhttp = new XMLHttpRequest();
      loadXMLDoc(vertexFile, function(txt) {vertShader = getShader(gl, txt, "vertex");if(++loaded == 2) setupShaderProgram(gl,shaderProgram, vertShader,fragShader,function(prog) {glShader.makeShader(gl,prog,shader);})});
      loadXMLDoc(fragmentFile, function(txt) {fragShader = getShader(gl, txt, "fragment");if(++loaded == 2) setupShaderProgram(gl,shaderProgram, vertShader,fragShader,function(prog) {glShader.makeShader(gl,prog,shader);})});
      return shader;
  }

  //if(typeof(exports) !== 'undefined') {
  //    exports.glShader = glShader;
  //}

  })(shim.exports);
})(this);

},{}],16:[function(require,module,exports){
"use strict"

var glMatrix = require('../js/gl-matrix-min.js');
var vec3 = glMatrix.vec3;

var HEMESH_NULLFACE = null;

var hemesh = function() {
  this.vertices = [];
  this.edges = [];
  this.faces = [];
}

var hedge = function() {
  this.face = HEMESH_NULLFACE;
  this.next = null;
  this.pair = null;
  this.v = null;
  this.index = 0;
  this.info = {};
}

var heface = function() {
  this.e = null;
  this.index = 0;
  this.info = {};
}

var hevertex = function() {
  this.e = null;
  this.pos = vec3.create();
  this.index = 0;
  this.b = 0;
  this.tagged = 0;
  this.info = {};
}

hemesh.prototype.clear = function() {
  var e,v,f;
  for(var i=0,l=this.edges.length;i<l;++i) {
    e = this.edges[i];
    e.next = null;
    e.pair = null;
    e.v = null;
    e.face = null;
  }
  for(var i=0,l=this.faces.length;i<l;++i) {
    f = this.faces[i];
    f.e = null;
    
  }
  for(var i=0,l=this.vertices.length;i<l;++i) {
    v = this.vertices[i];
    v.e = null;
  }
  this.faces.length = 0;
  this.edges.length = 0;
  this.vertices.length = 0;
}

hemesh.prototype.addEdge = function() {
  var newEdge = new hedge();
  newEdge.index = this.edges.length;
  this.edges.push(newEdge);
  return newEdge;
}

hemesh.prototype.addVertex = function(pos) {
  var newVertex = new hevertex();
  vec3.copy(newVertex.pos,pos);
  newVertex.index = this.vertices.length;
  this.vertices.push(newVertex);
  return newVertex;
}

hemesh.prototype.addFace = function() {
  var newFace = new heface();
  newFace.index = this.faces.length;
  this.faces.push(newFace);
  return newFace;
}

hemesh.prototype.removeEdge = function(e) {
  e.next = null;
  e.pair = null;
  e.face = null;
  e.v = null;
  if(e.index == this.edges.length-1) {
    this.edges.pop();
  } else if(e.index >= this.edges.length) {
    
  } else {
    var temp = this.edges.pop();
    temp.index = e.index;
    this.edges[e.index] = temp;
  }
}

hemesh.prototype.removeFace = function(f) {
  f.e = null;
  if(f.index == this.faces.length-1) {
    this.faces.pop();
  } else if (f.index >= this.faces.length) {
    
  }else {
    var temp = this.faces.pop();
    temp.index = f.index;
    this.faces[f.index] = temp;
  }
}

hemesh.prototype.removeVertex = function(v) {
  v.e = null;
  if(v.index == this.vertices.length-1) {
    this.vertices.pop();
  } else if(v.index >= this.vertices.length) {
    
  } else {
    var temp = this.vertices.pop();
    temp.index = v.index;
    this.vertices[v.index] = temp;
  }
}

hemesh.prototype.isBoundary = function(e) {
  return (e.face == HEMESH_NULLFACE || e.pair.face == HEMESH_NULLFACE);
}

hemesh.prototype.isCollapsable = function(e) {
  //should I test if the edges,vertices, or faces have been deleted yet?
  var epair = e.pair;
  var p1 = e.v;
  var p2 = epair.v;
  
  //get opposite points, if boundary edge opposite is null
  var opp1 = e.face == HEMESH_NULLFACE ? null : e.next.v;
  var opp2 = epair.face == HEMESH_NULLFACE ? null : epair.next.v;
  
  //if end points are on the boundary but the edge is not
  if(p1.b && p2.b && e.face != HEMESH_NULLFACE && epair.face != HEMESH_NULLFACE) {
    return false;
  }
  
  if(opp1 == opp2) {
    return false;
  }
  //might need a check to see if opposite edges are both boundary but that seems covered by the previous check
  
  
  //test to see if end points share any neighbors beside opp1 and opp2
  //mark all neighbors of p1 as 0
  var currE = e;
  do {
    currE = currE.next;
    currE.v.tagged = 0;
    currE = currE.pair;
  } while(currE != e);
  //mark all neighbors of p2 as 1
  currE = epair;
  do {
    currE = currE.next;
    currE.v.tagged = 1;
    currE = currE.pair;
  } while(currE != epair);
  //untag opposite
  if(opp1 != null) {opp1.tagged = 0;}
  if(opp2 != null) {opp2.tagged = 0;}
  
  //check neighbors of p1, if any are marked as 1 return false
  currE = e;
  do {
    currE = currE.next;
    if(currE.v.tagged == 1) {
      return false;
    }
    currE = currE.pair;
  } while(currE != e);
   
  //test for a face on the backside/other side that might degenerate
  if(e.face != HEMESH_NULLFACE) {
    var enext, enext2;
    enext = e.next;
    enext2 = enext.next;
    
    enext = enext.pair;
    enext2 = enext2.pair;
    if(enext.face == enext2.face) {
      return false;
    }
  }
  if(epair.face != HEMESH_NULLFACE) {
    var enext, enext2;
    enext = epair.next;
    enext2 = enext.next;
    
    enext = enext.pair;
    enext2 = enext2.pair;
    if(enext.face == enext2.face) {
      return false;
    }
  }
  
  return true;
  /*
  if (v0v1_triangle)
  {
    HalfedgeHandle one, two;
    one = next_halfedge_handle(v0v1);
    two = next_halfedge_handle(one);
    
    one = opposite_halfedge_handle(one);
    two = opposite_halfedge_handle(two);
    
    if (face_handle(one) == face_handle(two) && valence(face_handle(one)) != 3)
    {
      return false;
    }
  
  */
  
}

hemesh.prototype.edgeCollapse = function(e) {
  if(!this.isCollapsable(e)) return;
  
  var epair = e.pair;
  var enext, enext2, enextp, enextp2;
  var p1 = e.v;
  var p2 = epair.v;
  p2.e = null;
  //need to check for edge vertices either through marking or checking edges
  if(p1.b) {
    if(!p2.b) {
    
    } else {    
      vec3.add(p1.pos,p1.pos,p2.pos);
      vec3.scale(p1.pos,p1.pos,0.5);
      p1.b = p2.b;
    }
  } else if(p2.b) {
    vec3.copy(p1.pos,p2.pos);
    p1.b = p2.b;
  } else {
    vec3.add(p1.pos,p1.pos,p2.pos);
    vec3.scale(p1.pos,p1.pos,0.5);
  }
  //remove p2
  var startE = epair;
  //slight inefficiency, no need to repoint edges that are about to be removed
  enext = epair;
  do {
    enext.v = p1;
    enext = enext.next.pair;
  } while(enext != startE);

  this.removeVertex(p2);
  
  var prevE, prevEP;
  if(e.face == null) {
    var currE = epair;
    while(currE.next != e) {
      currE = currE.next.pair;
    }
    prevE = currE;
  }
  if(epair.face == null) {
    var currE = e;
    while(currE.next != epair) {
      currE = currE.next.pair;
    }
    prevEP = currE;
  }
  //remove face
  if(e.face != null) {
    enext = e.next;
    enext2 = enext.next;
    
    //remove enext and enext2;
    enextp = enext.pair;
    enextp2 = enext2.pair;
    
    /*
    if(enextp.face == null && enextp2.face == null) {
      //pinched off, remove enextp and enextp2, connect across
      var currE = enext2;
      while(currE.next != enextp2) {
        currE = currE.next.pair;
      }
      currE.next = enextp.next;
      p1.e = currE;
      
      this.removeVertex(enext.v);
      this.removeEdge(enextp);
      this.removeEdge(enextp2);
    } else {
    */
      enextp.pair = enextp2;
      enextp2.pair = enextp;    
      //p1.e = enextp;
      enextp.v.e = enextp;
      enextp2.v.e = enextp2;   
    //}
    
    this.removeEdge(enext);
    this.removeEdge(enext2);

 
    
    this.removeFace(e.face);
  } else {
    
    prevE.next = e.next;
    p1.e = prevE;
  }
  
  if(epair.face != null) {
    enext = epair.next;
    enext2 = enext.next;
    
    //remove enext and enext2;

    enextp = enext.pair;
    enextp2 = enext2.pair;
    /*
    if(enextp.face == null && enextp2.face == null) {
      //pinched off, remove enextp and enextp2, connect across
      //inefficiently get previous edge
      var currE;
      for(var i=0;i<this.edges.length;++i) {
        currE = this.edges[i];
        if(currE.next == enextp2) {
          break;
        }
      }
      currE.next = enextp.next;
      p1.e = currE;
      
      this.removeVertex(enext.v);
      this.removeEdge(enextp);
      this.removeEdge(enextp2);
    } else {
    */
      enextp.pair = enextp2;
      enextp2.pair = enextp;    
      enextp.v.e = enextp;
      enextp2.v.e = enextp2;   
    //}
    this.removeEdge(enext);
    this.removeEdge(enext2);

    this.removeFace(epair.face);
  } else {
    prevEP.next = epair.next;
    p1.e = prevEP;
  }
  
  //remove e and epair
  this.removeEdge(e);
  this.removeEdge(epair);

  return p1;
}

hemesh.prototype.edgeSplit = (function() { 
  var pos = vec3.create();
  //assumes e.face != null but epair.face can == null
  return function(e) {
    //need to check for boundary edge
    //not done
    
    //new pt
    var epair = e.pair;
    var p1 = e.v;    
    var p2 = epair.v;
    var enext = e.next;
    var epnext = epair.next;
    
    vec3.add(pos,p1.pos,p2.pos);
    vec3.scale(pos,pos,0.5);
    var newVertex = this.addVertex(pos);
    
    var newEdge, newEdgePair, newFace, splitEdge1, splitEdge2;
    
    //do e first
    newEdge = this.addEdge();
    newEdge.v = p1;
    p1.e = newEdge;
    e.v = newVertex;
    newEdge.next = enext;
    newEdge.pair = epair;
    epair.pair = newEdge;
    
    newEdgePair = this.addEdge();
    newEdgePair.v = p2;
    newEdgePair.e = p2;
    epair.v = newVertex;
    newEdgePair.next = epnext;
    newEdgePair.pair = e;
    e.pair = newEdgePair;
    newVertex.e = e;
    
    //set b to neighboring b, it p1.b should equal p2.b
    if(e.face == null || epair.face == null) { newVertex.b = p1.b;}
    
    if(e.face != null) {
      //face 1
      newFace = this.addFace();
      splitEdge1 = this.addEdge();
      splitEdge2 = this.addEdge();
      splitEdge1.pair = splitEdge2;
      splitEdge2.pair = splitEdge1;
      splitEdge1.v = enext.v;
      splitEdge2.v = newVertex;
      
      //e.f
      e.next = splitEdge1;
      splitEdge1.next = enext.next;
      e.face.e = e;
      splitEdge1.face = e.face;
      //newFace
      newEdge.face = newFace;
      splitEdge2.face = newFace;
      enext.face = newFace;
      newFace.e = newEdge;
      enext.next = splitEdge2;
      splitEdge2.next = newEdge;
    } else {
      e.next = newEdge;
    }
    
    if(epair.face != null) {
      newFace = this.addFace();
      splitEdge1 = this.addEdge();
      splitEdge2 = this.addEdge();
      splitEdge1.pair = splitEdge2;
      splitEdge2.pair = splitEdge1;
      splitEdge1.v = epnext.v;
      splitEdge2.v = newVertex;
      
      //epair.f
      epair.next = splitEdge1;
      splitEdge1.next = epnext.next;
      epair.face.e = epair;
      splitEdge1.face = epair.face;
      
      //newFace
      newEdgePair.face = newFace;
      splitEdge2.face = newFace;
      epnext.face = newFace;
      newFace.e = newEdgePair;
      epnext.next = splitEdge2;
      splitEdge2.next = newEdgePair;
    } else {
      epair.next = newEdgePair;
    }
    
    return newVertex;
  }
})();

hemesh.prototype.splitLargest = function(e) {
  var largestEdge = this.longestEdge(e);
  while(largestEdge != e) {
    this.splitLargest(largestEdge);
    largestEdge = this.longestEdge(e);
  }
  var pair = e.pair;
  
  largestEdge = this.longestEdge(pair);
  while(largestEdge != pair) {
    this.splitLargest(largestEdge);
    largestEdge = this.longestEdge(pair);
  }
  this.edgeSplit(e);
}

hemesh.prototype.longestEdge = function(e) {
  if(e.face == null) {
    return e;
  } else {
    var longestLen = this.sqrLen(e);
    var longEdge = e;
    var startE = e;
    e = e.next;
    do {      
      var len = this.sqrLen(e);
      if(len > longestLen) {
        longestLen = len;
        longEdge = e;
      }
      e = e.next;
    } while(e != startE);
    return longEdge;
  }
}

hemesh.prototype.sqrLen = function(e) {
  return vec3.sqrDist(e.v.pos,e.pair.v.pos);
}

hemesh.prototype.edgeFlip = function(e) {
  var epair = e.pair;
  
  if(epair.face != null && e.face != null) {
    var enext = e.next;
    var enext2 = enext.next;
    var epnext = epair.next;
    var epnext2 = epnext.next;
    var p1 = e.v;
    var p2 = epair.v;
    e.v = enext.v;
    enext.face = epair.face;
    epair.v = epnext.v;
    epnext.face = e.face;
    //new faces
    e.next = enext2;
    enext2.next = epnext;
    epnext.next = e;
    
    epair.next = epnext2;
    epnext2.next = enext;
    enext.next = epair;
    
    //just in case face points to e.next, not that it strictly matters
    e.face.e = e;
    epair.face.e = epair;
    
    //deal with vertex pointers
    p2.e = e.next;
    p1.e = epair.next;
  }
}

hemesh.prototype.getValence = function(p) {
  var e = p.e;
  var count = 0;
  do {
    count++;
    e = e.next.pair;
  } while(e != p.e);
  return count;
}

hemesh.prototype.getValenceE = function(e) {
  var startE = e;
  var count = 0;
  do {
    count++;
    e = e.next.pair;
  } while(e != startE);
  return count;
}

//general collapse
hemesh.prototype.simpleCollapse = function(e) {  
  var epair = e.pair;
  var enext, enext2, enextp, enextp2;
  var toE,toEPair;
  var p1 = e.v;
  var p2 = epair.v;
  p2.e = null;
  //need to check for edge vertices either through marking or checking edges
  if(p1.b) {
    if(!p2.b) {
    
    } else {    
      vec3.add(p1.pos,p1.pos,p2.pos);
      vec3.scale(p1.pos,p1.pos,0.5);
      p1.b = p2.b;
    }
  } else if(p2.b) {
    vec3.copy(p1.pos,p2.pos);
    p1.b = p2.b;
  } else {
    vec3.add(p1.pos,p1.pos,p2.pos);
    vec3.scale(p1.pos,p1.pos,0.5);
  }
  //remove p2
  var startE = epair;
  //slight inefficiency, no need to repoint edges that are about to be removed
  enext = epair;
  do {
    enext.v = p1;
    if(enext.next == e) {
      toE = enext;
    }
    enext = enext.next.pair;
  } while(enext != startE);
  
  this.removeVertex(p2);

  startE = e;
  enext = e;
  do {
    if(enext.next == epair) {
      toEPair = enext;
    }
    enext = enext.next.pair;
  } while(enext != startE);
  
  toE.next = e.next;
  if(e.face) e.face.e = toE;
  toE.v.e = toE;
  
  toEPair.next = epair.next;
  if(epair.face) epair.face.e = toEPair;
  
  //remove e and epair
  this.removeEdge(e);
  this.removeEdge(epair);

  return p1;
}

exports.NULLFACE = HEMESH_NULLFACE;
exports.hemesh = hemesh;
exports.hedge = hedge;
exports.heface = heface;
exports.hevertex = hevertex;

},{"../js/gl-matrix-min.js":14}],17:[function(require,module,exports){
var pmouseX,pmouseY,mouseX,mouseY,startMouseX,startMouseY, mouseButton;
var startMouseTime;
exports.isMouseDown = false;
exports.mouseDragging = false;

function setupMouseEvents(canvas) {
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('contextmenu', function(event){event.preventDefault();});
    document.addEventListener('mouseup', onMouseUpDoc);
    
    setupTouchEvents(canvas);
}

exports.setupMouseEvents = setupMouseEvents;

function setupTouchEvents(canvas) {
    if(isTouchDevice()) {
        canvas.addEventListener('touchmove', onTouchMove);
        canvas.addEventListener('touchstart', onTouchStart);
        canvas.addEventListener('touchend', onTouchEnd);
        document.addEventListener('touchend', onMouseUpDoc);
    }
}

function isTouchDevice() {
  return 'ontouchstart' in window // works on most browsers 
      || 'onmsgesturechange' in window; // works on ie10
};

function onMouseDown(event) {
    // Cancel the default event handler
    event.preventDefault();

    exports.mouseDragging = false;
    var rect = event.target.getBoundingClientRect();

    var currentX = event.clientX-rect.left;
    var currentY = event.clientY-rect.top;
    
    exports.pmouseX = exports.mouseX = exports.startMouseX = currentX;
    exports.pmouseY = exports.mouseY = exports.startMouseY = currentY;

    exports.isMouseDown = true;
    exports.mouseButton = event.which;
    exports.startMouseTime = performance.now();
    if(typeof exports.mouseDown !== 'undefined') {
        exports.mouseDown();
    }
}

function onMouseMove(event) {
    // Cancel the default event handler
    event.preventDefault();
    
    var rect = event.target.getBoundingClientRect();

    var currentX = event.clientX-rect.left;
    var currentY = event.clientY-rect.top;
    
    exports.pmouseX = exports.mouseX;
    exports.pmouseY = exports.mouseY;
    
    exports.mouseX = currentX;
    exports.mouseY = currentY;
    if(exports.mouseX != exports.pmouseX || exports.mouseY != exports.pmouseY) {
        if(typeof exports.mouseMoved !== 'undefined') {
            exports.mouseMoved(event);
        }
        if(exports.isMouseDown) {
            exports.mouseDragging = true;
            if(typeof exports.mouseDragged !== 'undefined') {
                exports.mouseDragged(event);
            }
        }
    }
}

function onMouseUp(event) {
    // Cancel the default event handler
    event.preventDefault();
    exports.isMouseDown = false;
    if(typeof exports.mouseUp !== 'undefined') {
        exports.mouseUp(event);
    }
    if(!exports.mouseDragging && (typeof exports.mouseClicked !== 'undefined')) {
        exports.mouseClicked(event);
    }
    exports.mouseDragging = false;
}

function onMouseUpDoc(event) {
    exports.isMouseDown = false;
}

function onTouchStart(event) {
    // Cancel the default event handler
    event.preventDefault();

    mouseDragging = false;
    var rect = event.targetTouches[0].target.getBoundingClientRect();

    var currentX = event.targetTouches[0].clientX-rect.left;
    var currentY = event.targetTouches[0].clientY-rect.top;
    
    pmouseX = mouseX = startMouseX = currentX;
    pmouseY = mouseY = startMouseY = currentY;
    console.log("touch start");
    isMouseDown = true;
    //mouseButton = event.button;
    mouseButton = 0;
    startMouseTime = performance.now();
    if(typeof mouseDown !== 'undefined') {
        mouseDown();
    }
}

function onTouchMove(event) {
    // Cancel the default event handler
    event.preventDefault();
    
    var rect = event.targetTouches[0].target.getBoundingClientRect();

    var currentX = event.targetTouches[0].clientX-rect.left;
    var currentY = event.targetTouches[0].clientY-rect.top;
    
    pmouseX = mouseX;
    pmouseY = mouseY;
    
    mouseX = currentX;
    mouseY = currentY;
    if(typeof mouseMoved !== 'undefined') {
        mouseMoved();
    }
    if(isMouseDown) {
        mouseDragging = true;
        if(typeof mouseDragged !== 'undefined') {
            mouseDragged();
        }
    }
}

function onTouchEnd(event) {
    // Cancel the default event handler
    event.preventDefault();
    isMouseDown = false;
    if(typeof mouseUp !== 'undefined') {
        mouseUp();
    }
    if(!mouseDragging && (typeof mouseClicked !== 'undefined')) {
        mouseClicked();
    }
    mouseDragging = false;
}

},{}]},{},[7])