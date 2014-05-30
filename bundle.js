(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var glMatrix = require("../js/gl-matrix-min.js");
var vec3 = glMatrix.vec3;
var vec2 = glMatrix.vec2;
var nurbs = require("./nurbs.js");
var vboMesh = require("./vboMesh.js");
var woodWidth = 12.2;
var conLen = 35; //45
var conOffset = 12;
var conWidth = 12;//20
var shelfOffset = 15;
var printTolerance = 0;

function initConnector() {

}

var createConnector = (function() {
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
  return function createConnector(v,vboOut) {
    startE = v.e;
    e = startE;
    var center = v.pos;
    var index = 0;
    do {
      e = e.next;
      vec3.sub(dirs[index],e.v.pos,center);
      vec3.normalize(dirs[index],dirs[index]);
      e = e.pair;
      index++;
    } while(e != startE);
    var numLegs = index;
    
    var baseIndex = vboOut.numVertices;
    var numPts = 0;
    
    for(var i=0;i<numLegs;++i) {
      //make points
      dir = dirs[i];
      nDir = dirs[(i+1)%numLegs];
      vec2.set(perp,dir[1],-dir[0]);
      vec3.scaleAndAdd(pt,center, dir, conLen+shelfOffset);
      vec2.scaleAndAdd(pt,pt,perp,woodWidth*0.5+printTolerance);      
      addConnectorPt(vboOut,pt);
      numPts++;
      
      vec2.scaleAndAdd(pt,pt,dir,-conLen);
      addConnectorPt(vboOut,pt);
      numPts++;
      
      vec2.scaleAndAdd(pt,pt,perp,-(woodWidth+printTolerance*2));
      addConnectorPt(vboOut,pt);
      numPts++;

      
      //make curve
      var crv = nurbs.createCrv(null, 2);
      
      vec2.scaleAndAdd(pt,pt,dir,conLen);
      addConnectorPt(vboOut,pt);
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
        addConnectorPt(vboOut,pt);
        numPts++;
        
      }
      
    }
    
    //stitch sides
    for(var i=0;i<numPts;++i) {
      var iNext = (i+1)%numPts;
      vboMesh.addTriangle(vboOut,baseIndex+i*2,baseIndex+iNext*2+1,baseIndex+i*2+1);
      vboMesh.addTriangle(vboOut,baseIndex+i*2,baseIndex+iNext*2,baseIndex+iNext*2+1);
    }    
  }
})();

function addConnectorPt(vboOut,pt) {
  vboMesh.addVertex(vboOut,pt);
  pt[2] = conWidth;
  vboMesh.addVertex(vboOut,pt);
  pt[2] = 0;
}

exports.createConnector = createConnector;
exports.initConnector = initConnector;

},{"../js/gl-matrix-min.js":8,"./nurbs.js":4,"./vboMesh.js":6}],2:[function(require,module,exports){
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
},{}],3:[function(require,module,exports){
"use strict"

var glShader = require('../js/glShader.js');
var glMatrix = require('../js/gl-matrix-min.js');
var poly2tri = require('./poly2tri.js');
var glUtils = require('./glUtils.js');
var voronoi = require('./voronoi.js');
var vboMesh = require('./vboMesh.js');
var connector = require('./connector.js');
var pointer = require('../js/pointer.js');
var vec2 = glMatrix.vec2;
var vec3 = glMatrix.vec3;
var mat4 = glMatrix.mat4;
var mat3 = glMatrix.mat4;

var canvas;
var canvas2d;
var ctx;
var gl;
var colorShader;
var voronoiEdges;
var mvMatrix = mat4.create();
var pMatrix = mat4.create();
var nMatrix = mat3.create();
var connectorVbo;

var shelfWidth = 1200;
var shelfHeight = 1200;

var selectedPt = -1;

function init() {
//stupid
	document.addEventListener( "keydown",keyPress,false);

  canvas = document.getElementById("gl");
  canvas2d = document.getElementById("2d");
  pointer.setupMouseEvents(canvas2d);
  ctx = canvas2d.getContext('2d');
  gl = glUtils.init(canvas);
  colorShader = glShader.loadShader(gl,"../shaders/simpleColor.vert","../shaders/simpleColor.frag");
  vboMesh.setGL(gl);
  initVoronoi();
  
  voronoiEdges = vboMesh.create();
  connectorVbo = vboMesh.create32();
  requestAnimationFrame(step);
}

init();


function step() {
  requestAnimationFrame(step);
  checkHover();
  dragHover();
  vboMesh.clear(connectorVbo);
  voronoi.voronoi();
  voronoi.centroidal();
  getConnectors();
  draw();
}

function draw() {
  draw2d();
  draw3d();
}

function draw2d() {
  ctx.clearRect(0,0,canvas.offsetWidth,canvas.offsetHeight);
  var scaling = Math.min(canvas.offsetWidth/shelfWidth,canvas.offsetHeight/shelfHeight);
  ctx.save();
  ctx.scale(scaling,scaling);
  drawCells2d();
  //drawEdges2d();
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

function drawNodes2d() {
  ctx.fillStyle = "black";
  for(var i=0;i<voronoi.pts.length;++i) {
    var pt = voronoi.pts[i];
    if(selectedPt == i) {
      ctx.fillStyle = "red";
    } else {
      ctx.fillStyle = "black";    
    }
    ctx.beginPath();
    ctx.arc(pt.x,pt.y,5,0,2*Math.PI);
    ctx.fill();
    
  }
  
}

function draw3d() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  if(!colorShader.isReady) return;
  
  colorShader.begin();
  mat4.identity(mvMatrix);
  mat4.ortho(pMatrix,-500,2000,2000,-500,-10,100);
  
  //set color
  colorShader.uniforms.matColor.set([0,0,0,1]);
  //set matrices
  colorShader.uniforms.mvMatrix.set(mvMatrix);
  colorShader.uniforms.pMatrix.set(pMatrix);
  
  //make voronoi edges vbo
  voronoiToEdgeVBO();
  
  //draw edges vbo
  colorShader.attribs.vertexPosition.set(voronoiEdges.vertexBuffer);
  gl.drawArrays(gl.LINES, 0,voronoiEdges.numVertices);

  //draw connectors
  colorShader.attribs.vertexPosition.set(connectorVbo.vertexBuffer);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,connectorVbo.indexBuffer);
  gl.drawElements(gl.TRIANGLES,connectorVbo.numIndices,gl.UNSIGNED_INT,0);
  
  colorShader.end();
}

//put voronoi edges into a vbo
function voronoiToEdgeVBO() {
  vboMesh.clear(voronoiEdges);
  for(var i=0;i<voronoi.triangles.length;++i) {
    var tri = voronoi.triangles[i];
    if(tri.interior_) {
      if(tri.neighbors_[0] && tri.neighbors_[0].interior_) {
        vboMesh.addVertex(voronoiEdges,tri.circumcenter);
        vboMesh.addVertex(voronoiEdges,tri.neighbors_[0].circumcenter);
      }
      if(tri.neighbors_[1] && tri.neighbors_[1].interior_) {
        vboMesh.addVertex(voronoiEdges,tri.circumcenter);
        vboMesh.addVertex(voronoiEdges,tri.neighbors_[1].circumcenter);
      }
      if(tri.neighbors_[2] && tri.neighbors_[2].interior_) {
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
  for(var i=0;i<voronoi.mesh.vertices.length;++i) {
    var v = voronoi.mesh.vertices[i];
    if(v.e) {
      connector.createConnector(v,connectorVbo);
    }
  }
  vboMesh.buffer(connectorVbo);
}

function initVoronoi() {
  voronoi.setDimensions(shelfWidth,shelfHeight);
  voronoi.init();
  voronoi.reset();
  voronoi.voronoi();
}


function keyPress(event) {
  switch(event.which) {
    case "D".charCodeAt(0):
      downloadVboAsSTL(connectorVbo);
      break;
  }
}

function screenToReal(x,y,out) {
  var scaling = Math.min(canvas.offsetWidth/shelfWidth,canvas.offsetHeight/shelfHeight);
  out[0] = x/scaling;
  out[1] = y/scaling;
}

function realToScreen(x,y,out) {
  var scaling = Math.min(canvas.offsetWidth/shelfWidth,canvas.offsetHeight/shelfHeight);
  out[0] = x*scaling;
  out[1] = y*scaling;
}

//pointer.mouseMoved = checkHover;

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
        if(dx*dx+dy*dy < 10*10) {
          selectedPt = i;
        }
      }
    }
  }
})();

pointer.mouseDragged = (function() {
  var coord = vec2.create();
  return function mouseDragged() {
    
  }
})();

pointer.mouseClicked = (function() {
  var coords = vec2.create();
  return function mouseClicked() {
    if(selectedPt == -1) {
      var pt = {x:0,y:0};
      screenToReal(pointer.mouseX,pointer.mouseY,coords);
      pt.x = coords[0];
      pt.y = coords[1];
      voronoi.pts.push(pt);
      selectedPt = voronoi.pts.length-1;
    } else {
      if(pointer.mouseButton == 3) {
        voronoi.pts.splice(selectedPt,1);
        selectedPt = -1;
      }
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
  a.download = "vbo"+new Date().toISOString().substring(0,16)+".stl";
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

},{"../js/gl-matrix-min.js":8,"../js/glShader.js":9,"../js/pointer.js":11,"./connector.js":1,"./glUtils.js":2,"./poly2tri.js":5,"./vboMesh.js":6,"./voronoi.js":7}],4:[function(require,module,exports){
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
},{"../js/gl-matrix-min.js":8}],5:[function(require,module,exports){
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
},{}],6:[function(require,module,exports){
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
	}
    vbo.vertexData[index] = v[0];
    vbo.vertexData[index+1] = v[1];
    vbo.vertexData[index+2] = v[2];
    if(n && vbo.normalsEnabled) {
        vbo.normalData[index] = n[0];
        vbo.normalData[index+1] = n[1];
        vbo.normalData[index+2] = n[2];
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
            vec3.normalize(norm,norm);
            
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
},{"../js/gl-matrix-min.js":8}],7:[function(require,module,exports){
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
function reset() {
  //make regularly spaced points
  pts.length = 0;
  
  var spacing = width/4;
  for(var i=0;i<4;++i) {
    for(var j=0;j<4;++j) {
      pts.push({x:i*spacing+j%2*spacing*0.5,y:j*spacing+spacing*0.5});
    }
  }
}

function init() {
  outsidePts.length = 0;
  var d = 500;
  outsidePts.push({x:-d,y:-d,fixed:true});
  outsidePts.push({x:width*0.5,y:-d,fixed:true});
  outsidePts.push({x:width+d,y:-d,fixed:true});
  outsidePts.push({x:width+d,y:height*0.5,fixed:true});
  outsidePts.push({x:width+d,y:height+d,fixed:true});
  outsidePts.push({x:width*0.5,y:height+d,fixed:true});
  outsidePts.push({x:-d,y:height+d,fixed:true});
  outsidePts.push({x:-d,y:height*0.5,fixed:true});
}

var voronoi = (function() {
  var p1 = vec2.create();
  var p2 = vec2.create();
  var p3 = vec2.create();
  return function voronoi() {
    var triangulation = new SweepContext(outsidePts);
    triangulation.addPoints(pts);
    triangulation.triangulate();
    
    for(var i=0;i<outsidePts.length;++i) {
      outsidePts[i]._p2t_edge_list = null;
    }
    for(var i=0;i<pts.length;++i) {
      pts[i]._p2t_edge_list = null;
      pts[i].cell = null;
    }
    
    triangles = triangulation.getTriangles();
    exports.triangles = triangles;
    
    for(var i=0;i<triangles.length;++i) {
      var tri = triangles[i];
      tri.circumcenter = vec3.create();
      vec2.set(p1,tri.points_[0].x,tri.points_[0].y);
      vec2.set(p2,tri.points_[1].x,tri.points_[1].y);
      vec2.set(p3,tri.points_[2].x,tri.points_[2].y);
      circumcircle(tri.circumcenter,p1,p2,p3);
    }
    
    buildCells();
    trimCells();
  }
})();

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
    return out;
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
}

var centroidal = (function() {
  var centroid = vec2.create();
  var center = vec2.create();
  var area,totalArea;
  var v1,v2;
  return function centroidal() {
    for(var i=0;i<pts.length;++i) {
      var pt = pts[i];
      if(!pt.fixed) {
        totalArea = 0;
        vec2.set(centroid,0,0);
        var e = pt.cell.e;
        do {
          v1 = e.v.pos;
          e = e.next;
          v2 = e.v.pos;
          area = v1[0]*v2[1]-v1[1]*v2[0];
          totalArea += v1[0]*v2[1]-v1[1]*v2[0];
          centroid[0] += (v1[0]+v2[0])*area;
          centroid[1] += (v1[1]+v2[1])*area;
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
        vec2.scale(centroid,centroid,1.0/totalArea/3.0);
        var dx = Math.min(Math.max(Math.random(.1),centroid[0]),width-Math.random(.1))-pt.x;
        var dy = Math.min(Math.max(Math.random(.1),centroid[1]),height-Math.random(.1))-pt.y;
        if(dx*dx+dy*dy > 4) {
          pt.x += .25*dx;
          pt.y += .25*dy;
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
    t.v = v;
  }
  for(var i=0;i<triangles.length;++i) {
    var t = triangles[i];
    for(var j=0;j<3;++j) {
      var pt = t.points_[j];
      if(!pt.fixed) {
        if(!pt.cell){
          buildCell(pt,t);
        }
      }
    }
  }
  makeBoundaryEdges(voroMesh, ptToEdge);
}

function buildCell(pt,t) {
  pt.cell = voroMesh.addFace();
  var prevV = t.v;
  t = t.neighborCCW(pt);
  var startT = t;
  var e, prevE = null;
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

function makeBoundaryEdges(mesh,ptToEdge) {
  //add boundary edges and unsure every edge has a pair
  var numEdges = mesh.edges.length;
  var e,v,startV;
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
      var ptEdge = ptToEdge[startV.index];
      ptEdge.push(newEdge);
    }
  }
  for(var i=numEdges;i<mesh.edges.length;++i) {
    e = mesh.edges[i];
    var ptEdge = ptToEdge[e.v.index];
    if(ptEdge) {
      for(var j=0;j<ptEdge.length;++j) {
        var e2 = ptEdge[j];
        if(e2.face == hemesh.NULLFACE) {
          e.next = e2;
        }
      }
    }
  }
}

function isInside(pt) {
  return pt[0] > 0 && pt[0] < width && pt[1] > 0 && pt[1] < height;
}

var trimEdge = (function() {
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
  }
})();

var trimCells = (function() {
  var f;
  return function trimCells() {
    for(var i=0,l = voroMesh.faces.length;i<l; ++i) {
      f = voroMesh.faces[i];
      trimFace(f);
    }
  }
})();
var trimFace = (function() {
  var trimPt = vec3.create();
  var v,e, startE, prevE;
  var newV;
  return function trimFace(f) {
    startE = f.e;
    e = startE;
    //get to an inside point
    //watchout for infinite loop (not done)
    while(!isInside(e.v.pos)) {
      e = e.next;
    }
    startE = e;
    //find first outside pt
    do {
      
      prevE = e;
      e = e.next;
    } while(isInside(e.v.pos) && e != startE);
    
    if(isInside(e.v.pos)) { return; }
    
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
      newV.b = true;
      newV.e = e;
      e.v.e = null;
      e.v = newV;
      e.info.trimmed = newV;
    }
    
    e = e.next;
    while(!isInside(e.v.pos)) {
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
      newV.b = true;
      e.info.trimmed = newV;
    }
    
    // corner
    //may need to check for floating point errors
    if(startE.v.pos[0] != newV.pos[0] && startE.v.pos[0] != newV.pos[0]) {
      //which corner
      if(startE.v.pos[0] == 0 || newV.pos[0] == 0) {
        trimPt[0] = 0;
      } else if(startE.v.pos[0] == width || newV.pos[0] == width) {
        trimPt[0] = width;
      }
      
      if(startE.v.pos[1] == 0 || newV.pos[1] == 0) {
        trimPt[1] = 0;
      } else if(startE.v.pos[1] == height || newV.pos[1] == height) {
        trimPt[1] = height;
      }
      //add corner
      var cornerV = voroMesh.addVertex(trimPt);
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

exports.init = init;
exports.reset = reset;
exports.voronoi = voronoi;
exports.pts = pts;
exports.triangles = triangles;
exports.setDimensions = setDimensions;
exports.centroidal = centroidal;
exports.mesh = voroMesh;
},{"../js/gl-matrix-min.js":8,"../js/hemesh.js":10,"./poly2tri.js":5}],8:[function(require,module,exports){
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

},{}],9:[function(require,module,exports){
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

},{}],10:[function(require,module,exports){
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

exports.NULLFACE = HEMESH_NULLFACE;
exports.hemesh = hemesh;
exports.hedge = hedge;
exports.heface = heface;
exports.hevertex = hevertex;

},{"../js/gl-matrix-min.js":8}],11:[function(require,module,exports){
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

},{}]},{},[3])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyJjOlxcVXNlcnNcXG5lcnZvdXMgc3lzdGVtXFxBcHBEYXRhXFxSb2FtaW5nXFxucG1cXG5vZGVfbW9kdWxlc1xcd2F0Y2hpZnlcXG5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwiYzovVXNlcnMvbmVydm91cyBzeXN0ZW0vaHRkb2NzL2Jvb2tzaGVsZi9jb25uZWN0b3IuanMiLCJjOi9Vc2Vycy9uZXJ2b3VzIHN5c3RlbS9odGRvY3MvYm9va3NoZWxmL2dsVXRpbHMuanMiLCJjOi9Vc2Vycy9uZXJ2b3VzIHN5c3RlbS9odGRvY3MvYm9va3NoZWxmL21haW4uanMiLCJjOi9Vc2Vycy9uZXJ2b3VzIHN5c3RlbS9odGRvY3MvYm9va3NoZWxmL251cmJzLmpzIiwiYzovVXNlcnMvbmVydm91cyBzeXN0ZW0vaHRkb2NzL2Jvb2tzaGVsZi9wb2x5MnRyaS5qcyIsImM6L1VzZXJzL25lcnZvdXMgc3lzdGVtL2h0ZG9jcy9ib29rc2hlbGYvdmJvTWVzaC5qcyIsImM6L1VzZXJzL25lcnZvdXMgc3lzdGVtL2h0ZG9jcy9ib29rc2hlbGYvdm9yb25vaS5qcyIsImM6L1VzZXJzL25lcnZvdXMgc3lzdGVtL2h0ZG9jcy9qcy9nbC1tYXRyaXgtbWluLmpzIiwiYzovVXNlcnMvbmVydm91cyBzeXN0ZW0vaHRkb2NzL2pzL2dsU2hhZGVyLmpzIiwiYzovVXNlcnMvbmVydm91cyBzeXN0ZW0vaHRkb2NzL2pzL2hlbWVzaC5qcyIsImM6L1VzZXJzL25lcnZvdXMgc3lzdGVtL2h0ZG9jcy9qcy9wb2ludGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbFhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOWdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2g4REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMVVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlpQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1aUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIGdsTWF0cml4ID0gcmVxdWlyZShcIi4uL2pzL2dsLW1hdHJpeC1taW4uanNcIik7XG52YXIgdmVjMyA9IGdsTWF0cml4LnZlYzM7XG52YXIgdmVjMiA9IGdsTWF0cml4LnZlYzI7XG52YXIgbnVyYnMgPSByZXF1aXJlKFwiLi9udXJicy5qc1wiKTtcbnZhciB2Ym9NZXNoID0gcmVxdWlyZShcIi4vdmJvTWVzaC5qc1wiKTtcbnZhciB3b29kV2lkdGggPSAxMi4yO1xudmFyIGNvbkxlbiA9IDM1OyAvLzQ1XG52YXIgY29uT2Zmc2V0ID0gMTI7XG52YXIgY29uV2lkdGggPSAxMjsvLzIwXG52YXIgc2hlbGZPZmZzZXQgPSAxNTtcbnZhciBwcmludFRvbGVyYW5jZSA9IDA7XG5cbmZ1bmN0aW9uIGluaXRDb25uZWN0b3IoKSB7XG5cbn1cblxudmFyIGNyZWF0ZUNvbm5lY3RvciA9IChmdW5jdGlvbigpIHtcbiAgdmFyIG1heFZhbGVuY2UgPSA3O1xuICB2YXIgZGlycyA9IFtdO1xuICBmb3IodmFyIGk9MDtpPG1heFZhbGVuY2U7KytpKSB7XG4gICAgZGlyc1tpXSA9IHZlYzMuY3JlYXRlKCk7XG4gIH1cbiAgdmFyIHB0ID0gdmVjMy5jcmVhdGUoKTtcbiAgdmFyIHB0MiA9IHZlYzMuY3JlYXRlKCk7XG4gIHZhciBkaXIsIG5EaXI7XG4gIHZhciBwZXJwID0gdmVjMy5jcmVhdGUoKTtcbiAgdmFyIGJpc2VjdG9yID0gdmVjMy5jcmVhdGUoKTtcbiAgdmFyIGUsc3RhcnRFO1xuICByZXR1cm4gZnVuY3Rpb24gY3JlYXRlQ29ubmVjdG9yKHYsdmJvT3V0KSB7XG4gICAgc3RhcnRFID0gdi5lO1xuICAgIGUgPSBzdGFydEU7XG4gICAgdmFyIGNlbnRlciA9IHYucG9zO1xuICAgIHZhciBpbmRleCA9IDA7XG4gICAgZG8ge1xuICAgICAgZSA9IGUubmV4dDtcbiAgICAgIHZlYzMuc3ViKGRpcnNbaW5kZXhdLGUudi5wb3MsY2VudGVyKTtcbiAgICAgIHZlYzMubm9ybWFsaXplKGRpcnNbaW5kZXhdLGRpcnNbaW5kZXhdKTtcbiAgICAgIGUgPSBlLnBhaXI7XG4gICAgICBpbmRleCsrO1xuICAgIH0gd2hpbGUoZSAhPSBzdGFydEUpO1xuICAgIHZhciBudW1MZWdzID0gaW5kZXg7XG4gICAgXG4gICAgdmFyIGJhc2VJbmRleCA9IHZib091dC5udW1WZXJ0aWNlcztcbiAgICB2YXIgbnVtUHRzID0gMDtcbiAgICBcbiAgICBmb3IodmFyIGk9MDtpPG51bUxlZ3M7KytpKSB7XG4gICAgICAvL21ha2UgcG9pbnRzXG4gICAgICBkaXIgPSBkaXJzW2ldO1xuICAgICAgbkRpciA9IGRpcnNbKGkrMSklbnVtTGVnc107XG4gICAgICB2ZWMyLnNldChwZXJwLGRpclsxXSwtZGlyWzBdKTtcbiAgICAgIHZlYzMuc2NhbGVBbmRBZGQocHQsY2VudGVyLCBkaXIsIGNvbkxlbitzaGVsZk9mZnNldCk7XG4gICAgICB2ZWMyLnNjYWxlQW5kQWRkKHB0LHB0LHBlcnAsd29vZFdpZHRoKjAuNStwcmludFRvbGVyYW5jZSk7ICAgICAgXG4gICAgICBhZGRDb25uZWN0b3JQdCh2Ym9PdXQscHQpO1xuICAgICAgbnVtUHRzKys7XG4gICAgICBcbiAgICAgIHZlYzIuc2NhbGVBbmRBZGQocHQscHQsZGlyLC1jb25MZW4pO1xuICAgICAgYWRkQ29ubmVjdG9yUHQodmJvT3V0LHB0KTtcbiAgICAgIG51bVB0cysrO1xuICAgICAgXG4gICAgICB2ZWMyLnNjYWxlQW5kQWRkKHB0LHB0LHBlcnAsLSh3b29kV2lkdGgrcHJpbnRUb2xlcmFuY2UqMikpO1xuICAgICAgYWRkQ29ubmVjdG9yUHQodmJvT3V0LHB0KTtcbiAgICAgIG51bVB0cysrO1xuXG4gICAgICBcbiAgICAgIC8vbWFrZSBjdXJ2ZVxuICAgICAgdmFyIGNydiA9IG51cmJzLmNyZWF0ZUNydihudWxsLCAyKTtcbiAgICAgIFxuICAgICAgdmVjMi5zY2FsZUFuZEFkZChwdCxwdCxkaXIsY29uTGVuKTtcbiAgICAgIGFkZENvbm5lY3RvclB0KHZib091dCxwdCk7XG4gICAgICBudW1QdHMrKztcbiAgICAgIFxuICAgICAgbnVyYnMuYWRkUG9pbnQoY3J2LHB0KTtcblxuICAgICAgdmVjMi5zY2FsZUFuZEFkZChwdCxwdCxwZXJwLC1jb25PZmZzZXQpO1xuICAgICAgLy9hZGRDb25uZWN0b3JQdCh2Ym9PdXQscHQpO1xuICAgICAgLy9udW1QdHMrKztcblxuICAgICAgbnVyYnMuYWRkUG9pbnQoY3J2LHB0KTtcbiAgICAgIFxuICAgICAgLy9nZXQgb2Zmc2V0XG4gICAgICBiaXNlY3RvclswXSA9IGRpclswXS1uRGlyWzBdO1xuICAgICAgYmlzZWN0b3JbMV0gPSBkaXJbMV0tbkRpclsxXTtcbiAgICAgIHZlYzIubm9ybWFsaXplKGJpc2VjdG9yLGJpc2VjdG9yKTtcbiAgICAgIC8vcm90YXRlIDkwXG4gICAgICB2YXIgdGVtcCA9IGJpc2VjdG9yWzBdO1xuICAgICAgYmlzZWN0b3JbMF0gPSAtYmlzZWN0b3JbMV07XG4gICAgICBiaXNlY3RvclsxXSA9IHRlbXA7XG4gICAgICB2YXIgc2luQSA9IE1hdGguYWJzKGJpc2VjdG9yWzBdKmRpclsxXS1iaXNlY3RvclsxXSpkaXJbMF0pO1xuICAgICAgdmVjMy5zY2FsZUFuZEFkZChwdCxjZW50ZXIsYmlzZWN0b3IsKHdvb2RXaWR0aCowLjUrY29uT2Zmc2V0KS9zaW5BKTtcblxuICAgICAgbnVyYnMuYWRkUG9pbnQoY3J2LHB0KTtcbiAgICAgIFxuICAgICAgLy9hZGRDb25uZWN0b3JQdCh2Ym9PdXQscHQpO1xuICAgICAgLy9udW1QdHMrKztcbiAgICAgIFxuICAgICAgdmVjMi5zZXQocGVycCxuRGlyWzFdLC1uRGlyWzBdKTtcbiAgICAgIHZlYzMuc2NhbGVBbmRBZGQocHQsY2VudGVyLCBuRGlyLCBjb25MZW4rc2hlbGZPZmZzZXQpO1xuICAgICAgdmVjMi5zY2FsZUFuZEFkZChwdCxwdCxwZXJwLHdvb2RXaWR0aCowLjUrcHJpbnRUb2xlcmFuY2UrY29uT2Zmc2V0KTsgICAgICBcbiAgICAgIFxuICAgICAgbnVyYnMuYWRkUG9pbnQoY3J2LHB0KTtcbiAgICAgIHZlYzIuc2NhbGVBbmRBZGQocHQscHQscGVycCwtY29uT2Zmc2V0KTsgICAgICBcbiAgICAgIG51cmJzLmFkZFBvaW50KGNydixwdCk7XG4gICAgICBcbiAgICAgIHZhciBkb21haW4gPSBudXJicy5kb21haW4oY3J2KTtcbiAgICAgIGZvcih2YXIgaj0xO2o8MjA7KytqKSB7XG4gICAgICAgIHZhciB1ID0gai8yMC4wKihkb21haW5bMV0tZG9tYWluWzBdKStkb21haW5bMF07XG4gICAgICAgIG51cmJzLmV2YWx1YXRlQ3J2KGNydix1LHB0KTtcbiAgICAgICAgYWRkQ29ubmVjdG9yUHQodmJvT3V0LHB0KTtcbiAgICAgICAgbnVtUHRzKys7XG4gICAgICAgIFxuICAgICAgfVxuICAgICAgXG4gICAgfVxuICAgIFxuICAgIC8vc3RpdGNoIHNpZGVzXG4gICAgZm9yKHZhciBpPTA7aTxudW1QdHM7KytpKSB7XG4gICAgICB2YXIgaU5leHQgPSAoaSsxKSVudW1QdHM7XG4gICAgICB2Ym9NZXNoLmFkZFRyaWFuZ2xlKHZib091dCxiYXNlSW5kZXgraSoyLGJhc2VJbmRleCtpTmV4dCoyKzEsYmFzZUluZGV4K2kqMisxKTtcbiAgICAgIHZib01lc2guYWRkVHJpYW5nbGUodmJvT3V0LGJhc2VJbmRleCtpKjIsYmFzZUluZGV4K2lOZXh0KjIsYmFzZUluZGV4K2lOZXh0KjIrMSk7XG4gICAgfSAgICBcbiAgfVxufSkoKTtcblxuZnVuY3Rpb24gYWRkQ29ubmVjdG9yUHQodmJvT3V0LHB0KSB7XG4gIHZib01lc2guYWRkVmVydGV4KHZib091dCxwdCk7XG4gIHB0WzJdID0gY29uV2lkdGg7XG4gIHZib01lc2guYWRkVmVydGV4KHZib091dCxwdCk7XG4gIHB0WzJdID0gMDtcbn1cblxuZXhwb3J0cy5jcmVhdGVDb25uZWN0b3IgPSBjcmVhdGVDb25uZWN0b3I7XG5leHBvcnRzLmluaXRDb25uZWN0b3IgPSBpbml0Q29ubmVjdG9yO1xuIiwidmFyIGdsO1xudmFyIGV4dCA9IG51bGw7XG5mdW5jdGlvbiBpbml0R0woY2FudmFzLCBkcmF3QnVmZmVyKSB7XG4gIGRyYXdCdWZmZXIgPSBkcmF3QnVmZmVyID8gZHJhd0J1ZmZlciA6IGZhbHNlO1xuICAgIHRyeSB7XG4gICAgICAgIGdsID0gY2FudmFzLmdldENvbnRleHQoXCJ3ZWJnbFwiLHtwcmVzZXJ2ZURyYXdpbmdCdWZmZXI6IGRyYXdCdWZmZXJ9KTtcbiAgICAgICAgZ2wudmlld3BvcnRXaWR0aCA9IGNhbnZhcy53aWR0aDtcbiAgICAgICAgZ2wudmlld3BvcnRIZWlnaHQgPSBjYW52YXMuaGVpZ2h0O1xuICAgICAgICBleHQgPSBnbC5nZXRFeHRlbnNpb24oXCJPRVNfZWxlbWVudF9pbmRleF91aW50XCIpO1xuICAgICAgICByZXR1cm4gZ2w7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgIH1cbiAgICBpZiAoIWdsKSB7XG4gICAgICAgIC8vYWxlcnQoXCJDb3VsZCBub3QgaW5pdGlhbGlzZSBXZWJHTCwgc29ycnkgOi0oXCIpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxufVxuXG4vKlxucGFzcyBjdWJlIG1hcCBvYmplY3RcbmN1YmVtYXAgaGFzIGFuIGFycmF5IG9mIHNpeCBjdWJlSW1hZ2VzXG4qL1xuXG5mdW5jdGlvbiBpbml0Q3ViZVRleHR1cmUoY3ViZU1hcE9iaikge1xuICAgIGN1YmVNYXBPYmoudGV4dHVyZSA9IGdsLmNyZWF0ZVRleHR1cmUoKTtcbiAgICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFX0NVQkVfTUFQLCBjdWJlTWFwT2JqLnRleHR1cmUpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV9DVUJFX01BUCwgZ2wuVEVYVFVSRV9NSU5fRklMVEVSLCBnbC5ORUFSRVNUKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfQ1VCRV9NQVAsIGdsLlRFWFRVUkVfTUFHX0ZJTFRFUiwgZ2wuTkVBUkVTVCk7XG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFX0NVQkVfTUFQLCBnbC5URVhUVVJFX1dSQVBfVCwgZ2wuQ0xBTVBfVE9fRURHRSk7XG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFX0NVQkVfTUFQLCBnbC5URVhUVVJFX1dSQVBfUywgZ2wuQ0xBTVBfVE9fRURHRSk7XG5cbiAgICBnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfQ1VCRV9NQVBfUE9TSVRJVkVfWCwgMCwgZ2wuUkdCLCBnbC5SR0IsIGdsLlVOU0lHTkVEX0JZVEUsIGN1YmVNYXBPYmouY3ViZUltYWdlc1swXSk7XG4gICAgZ2wudGV4SW1hZ2UyRChnbC5URVhUVVJFX0NVQkVfTUFQX05FR0FUSVZFX1gsIDAsIGdsLlJHQiwgZ2wuUkdCLCBnbC5VTlNJR05FRF9CWVRFLCBjdWJlTWFwT2JqLmN1YmVJbWFnZXNbMV0pO1xuICAgIGdsLnRleEltYWdlMkQoZ2wuVEVYVFVSRV9DVUJFX01BUF9QT1NJVElWRV9ZLCAwLCBnbC5SR0IsIGdsLlJHQiwgZ2wuVU5TSUdORURfQllURSwgY3ViZU1hcE9iai5jdWJlSW1hZ2VzWzJdKTtcbiAgICBnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfQ1VCRV9NQVBfTkVHQVRJVkVfWSwgMCwgZ2wuUkdCLCBnbC5SR0IsIGdsLlVOU0lHTkVEX0JZVEUsIGN1YmVNYXBPYmouY3ViZUltYWdlc1szXSk7XG4gICAgZ2wudGV4SW1hZ2UyRChnbC5URVhUVVJFX0NVQkVfTUFQX1BPU0lUSVZFX1osIDAsIGdsLlJHQiwgZ2wuUkdCLCBnbC5VTlNJR05FRF9CWVRFLCBjdWJlTWFwT2JqLmN1YmVJbWFnZXNbNF0pO1xuICAgIGdsLnRleEltYWdlMkQoZ2wuVEVYVFVSRV9DVUJFX01BUF9ORUdBVElWRV9aLCAwLCBnbC5SR0IsIGdsLlJHQiwgZ2wuVU5TSUdORURfQllURSwgY3ViZU1hcE9iai5jdWJlSW1hZ2VzWzVdKTtcbn1cblxuZXhwb3J0cy5pbml0ID0gaW5pdEdMO1xuZXhwb3J0cy5pbml0Q3ViZVRleHR1cmUgPSBpbml0Q3ViZVRleHR1cmU7IiwiXCJ1c2Ugc3RyaWN0XCJcblxudmFyIGdsU2hhZGVyID0gcmVxdWlyZSgnLi4vanMvZ2xTaGFkZXIuanMnKTtcbnZhciBnbE1hdHJpeCA9IHJlcXVpcmUoJy4uL2pzL2dsLW1hdHJpeC1taW4uanMnKTtcbnZhciBwb2x5MnRyaSA9IHJlcXVpcmUoJy4vcG9seTJ0cmkuanMnKTtcbnZhciBnbFV0aWxzID0gcmVxdWlyZSgnLi9nbFV0aWxzLmpzJyk7XG52YXIgdm9yb25vaSA9IHJlcXVpcmUoJy4vdm9yb25vaS5qcycpO1xudmFyIHZib01lc2ggPSByZXF1aXJlKCcuL3Zib01lc2guanMnKTtcbnZhciBjb25uZWN0b3IgPSByZXF1aXJlKCcuL2Nvbm5lY3Rvci5qcycpO1xudmFyIHBvaW50ZXIgPSByZXF1aXJlKCcuLi9qcy9wb2ludGVyLmpzJyk7XG52YXIgdmVjMiA9IGdsTWF0cml4LnZlYzI7XG52YXIgdmVjMyA9IGdsTWF0cml4LnZlYzM7XG52YXIgbWF0NCA9IGdsTWF0cml4Lm1hdDQ7XG52YXIgbWF0MyA9IGdsTWF0cml4Lm1hdDQ7XG5cbnZhciBjYW52YXM7XG52YXIgY2FudmFzMmQ7XG52YXIgY3R4O1xudmFyIGdsO1xudmFyIGNvbG9yU2hhZGVyO1xudmFyIHZvcm9ub2lFZGdlcztcbnZhciBtdk1hdHJpeCA9IG1hdDQuY3JlYXRlKCk7XG52YXIgcE1hdHJpeCA9IG1hdDQuY3JlYXRlKCk7XG52YXIgbk1hdHJpeCA9IG1hdDMuY3JlYXRlKCk7XG52YXIgY29ubmVjdG9yVmJvO1xuXG52YXIgc2hlbGZXaWR0aCA9IDEyMDA7XG52YXIgc2hlbGZIZWlnaHQgPSAxMjAwO1xuXG52YXIgc2VsZWN0ZWRQdCA9IC0xO1xuXG5mdW5jdGlvbiBpbml0KCkge1xuLy9zdHVwaWRcblx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggXCJrZXlkb3duXCIsa2V5UHJlc3MsZmFsc2UpO1xuXG4gIGNhbnZhcyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiZ2xcIik7XG4gIGNhbnZhczJkID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCIyZFwiKTtcbiAgcG9pbnRlci5zZXR1cE1vdXNlRXZlbnRzKGNhbnZhczJkKTtcbiAgY3R4ID0gY2FudmFzMmQuZ2V0Q29udGV4dCgnMmQnKTtcbiAgZ2wgPSBnbFV0aWxzLmluaXQoY2FudmFzKTtcbiAgY29sb3JTaGFkZXIgPSBnbFNoYWRlci5sb2FkU2hhZGVyKGdsLFwiLi4vc2hhZGVycy9zaW1wbGVDb2xvci52ZXJ0XCIsXCIuLi9zaGFkZXJzL3NpbXBsZUNvbG9yLmZyYWdcIik7XG4gIHZib01lc2guc2V0R0woZ2wpO1xuICBpbml0Vm9yb25vaSgpO1xuICBcbiAgdm9yb25vaUVkZ2VzID0gdmJvTWVzaC5jcmVhdGUoKTtcbiAgY29ubmVjdG9yVmJvID0gdmJvTWVzaC5jcmVhdGUzMigpO1xuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoc3RlcCk7XG59XG5cbmluaXQoKTtcblxuXG5mdW5jdGlvbiBzdGVwKCkge1xuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoc3RlcCk7XG4gIGNoZWNrSG92ZXIoKTtcbiAgZHJhZ0hvdmVyKCk7XG4gIHZib01lc2guY2xlYXIoY29ubmVjdG9yVmJvKTtcbiAgdm9yb25vaS52b3Jvbm9pKCk7XG4gIHZvcm9ub2kuY2VudHJvaWRhbCgpO1xuICBnZXRDb25uZWN0b3JzKCk7XG4gIGRyYXcoKTtcbn1cblxuZnVuY3Rpb24gZHJhdygpIHtcbiAgZHJhdzJkKCk7XG4gIGRyYXczZCgpO1xufVxuXG5mdW5jdGlvbiBkcmF3MmQoKSB7XG4gIGN0eC5jbGVhclJlY3QoMCwwLGNhbnZhcy5vZmZzZXRXaWR0aCxjYW52YXMub2Zmc2V0SGVpZ2h0KTtcbiAgdmFyIHNjYWxpbmcgPSBNYXRoLm1pbihjYW52YXMub2Zmc2V0V2lkdGgvc2hlbGZXaWR0aCxjYW52YXMub2Zmc2V0SGVpZ2h0L3NoZWxmSGVpZ2h0KTtcbiAgY3R4LnNhdmUoKTtcbiAgY3R4LnNjYWxlKHNjYWxpbmcsc2NhbGluZyk7XG4gIGRyYXdDZWxsczJkKCk7XG4gIC8vZHJhd0VkZ2VzMmQoKTtcbiAgZHJhd05vZGVzMmQoKTtcbiAgY3R4LnJlc3RvcmUoKTtcbiAgXG59XG5cbmZ1bmN0aW9uIGRyYXdFZGdlczJkKCkge1xuICBcbiAgY3R4LnN0cm9rZVN0eWxlID0gXCJibGFja1wiO1xuICBjdHguYmVnaW5QYXRoKCk7XG4gIGZvcih2YXIgaT0wO2k8dm9yb25vaS50cmlhbmdsZXMubGVuZ3RoOysraSkge1xuICAgIHZhciB0cmkgPSB2b3Jvbm9pLnRyaWFuZ2xlc1tpXTtcbiAgICBpZih0cmkuaW50ZXJpb3JfKSB7XG4gICAgICBpZih0cmkubmVpZ2hib3JzX1swXSAmJiB0cmkubmVpZ2hib3JzX1swXS5pbnRlcmlvcl8pIHtcbiAgICAgICAgY3R4Lm1vdmVUbyh0cmkuY2lyY3VtY2VudGVyWzBdLHRyaS5jaXJjdW1jZW50ZXJbMV0pO1xuICAgICAgICBjdHgubGluZVRvKHRyaS5uZWlnaGJvcnNfWzBdLmNpcmN1bWNlbnRlclswXSx0cmkubmVpZ2hib3JzX1swXS5jaXJjdW1jZW50ZXJbMV0pO1xuICAgICAgfVxuICAgICAgaWYodHJpLm5laWdoYm9yc19bMV0gJiYgdHJpLm5laWdoYm9yc19bMV0uaW50ZXJpb3JfKSB7XG4gICAgICAgIGN0eC5tb3ZlVG8odHJpLmNpcmN1bWNlbnRlclswXSx0cmkuY2lyY3VtY2VudGVyWzFdKTtcbiAgICAgICAgY3R4LmxpbmVUbyh0cmkubmVpZ2hib3JzX1sxXS5jaXJjdW1jZW50ZXJbMF0sdHJpLm5laWdoYm9yc19bMV0uY2lyY3VtY2VudGVyWzFdKTsgICAgICAgIFxuICAgICAgfVxuICAgICAgaWYodHJpLm5laWdoYm9yc19bMl0gJiYgdHJpLm5laWdoYm9yc19bMl0uaW50ZXJpb3JfKSB7XG4gICAgICAgIGN0eC5tb3ZlVG8odHJpLmNpcmN1bWNlbnRlclswXSx0cmkuY2lyY3VtY2VudGVyWzFdKTtcbiAgICAgICAgY3R4LmxpbmVUbyh0cmkubmVpZ2hib3JzX1syXS5jaXJjdW1jZW50ZXJbMF0sdHJpLm5laWdoYm9yc19bMl0uY2lyY3VtY2VudGVyWzFdKTsgICAgICAgIFxuICAgICAgfVxuICAgIH1cbiAgfVxuICBjdHguc3Ryb2tlKCk7XG59XG5cbmZ1bmN0aW9uIGRyYXdDZWxsczJkKCkge1xuICBcbiAgY3R4LnN0cm9rZVN0eWxlID0gXCJibGFja1wiO1xuICAvKlxuICB2YXIgdjtcbiAgZm9yKHZhciBpPTA7aTx2b3Jvbm9pLnB0cy5sZW5ndGg7KytpKSB7XG4gICAgdmFyIHB0ID0gdm9yb25vaS5wdHNbaV07XG4gICAgY3R4LmJlZ2luUGF0aCgpO1xuICAgIHYgPSBwdC5jZWxsWzBdO1xuICAgIGN0eC5tb3ZlVG8odlswXSx2WzFdKTtcbiAgICBmb3IodmFyIGo9MTtqPHB0LmNlbGwubGVuZ3RoOysraikge1xuICAgICAgdiA9IHB0LmNlbGxbal07XG4gICAgICBjdHgubGluZVRvKHZbMF0sdlsxXSk7XG4gICAgfVxuICAgIGN0eC5jbG9zZVBhdGgoKTtcbiAgICBjdHguc3Ryb2tlKCk7XG4gIH1cbiAgKi9cbiAgZm9yKHZhciBpPTA7aTx2b3Jvbm9pLm1lc2guZmFjZXMubGVuZ3RoOysraSkge1xuICAgIHZhciBmID0gdm9yb25vaS5tZXNoLmZhY2VzW2ldO1xuICAgIHZhciBlID0gZi5lO1xuICAgIHZhciBzdGFydEUgPSBlO1xuICAgIGN0eC5iZWdpblBhdGgoKTtcbiAgICBcbiAgICBjdHgubW92ZVRvKGUudi5wb3NbMF0sZS52LnBvc1sxXSk7XG4gICAgZSA9IGUubmV4dDtcbiAgICBkbyB7XG4gICAgICBjdHgubGluZVRvKGUudi5wb3NbMF0sZS52LnBvc1sxXSk7XG4gICAgICBlID0gZS5uZXh0O1xuICAgIH0gd2hpbGUoZSAhPSBzdGFydEUpO1xuICAgIGN0eC5jbG9zZVBhdGgoKTtcbiAgICBjdHguc3Ryb2tlKCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZHJhd05vZGVzMmQoKSB7XG4gIGN0eC5maWxsU3R5bGUgPSBcImJsYWNrXCI7XG4gIGZvcih2YXIgaT0wO2k8dm9yb25vaS5wdHMubGVuZ3RoOysraSkge1xuICAgIHZhciBwdCA9IHZvcm9ub2kucHRzW2ldO1xuICAgIGlmKHNlbGVjdGVkUHQgPT0gaSkge1xuICAgICAgY3R4LmZpbGxTdHlsZSA9IFwicmVkXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIGN0eC5maWxsU3R5bGUgPSBcImJsYWNrXCI7ICAgIFxuICAgIH1cbiAgICBjdHguYmVnaW5QYXRoKCk7XG4gICAgY3R4LmFyYyhwdC54LHB0LnksNSwwLDIqTWF0aC5QSSk7XG4gICAgY3R4LmZpbGwoKTtcbiAgICBcbiAgfVxuICBcbn1cblxuZnVuY3Rpb24gZHJhdzNkKCkge1xuICBnbC5jbGVhcihnbC5DT0xPUl9CVUZGRVJfQklUIHwgZ2wuREVQVEhfQlVGRkVSX0JJVCk7XG4gIGlmKCFjb2xvclNoYWRlci5pc1JlYWR5KSByZXR1cm47XG4gIFxuICBjb2xvclNoYWRlci5iZWdpbigpO1xuICBtYXQ0LmlkZW50aXR5KG12TWF0cml4KTtcbiAgbWF0NC5vcnRobyhwTWF0cml4LC01MDAsMjAwMCwyMDAwLC01MDAsLTEwLDEwMCk7XG4gIFxuICAvL3NldCBjb2xvclxuICBjb2xvclNoYWRlci51bmlmb3Jtcy5tYXRDb2xvci5zZXQoWzAsMCwwLDFdKTtcbiAgLy9zZXQgbWF0cmljZXNcbiAgY29sb3JTaGFkZXIudW5pZm9ybXMubXZNYXRyaXguc2V0KG12TWF0cml4KTtcbiAgY29sb3JTaGFkZXIudW5pZm9ybXMucE1hdHJpeC5zZXQocE1hdHJpeCk7XG4gIFxuICAvL21ha2Ugdm9yb25vaSBlZGdlcyB2Ym9cbiAgdm9yb25vaVRvRWRnZVZCTygpO1xuICBcbiAgLy9kcmF3IGVkZ2VzIHZib1xuICBjb2xvclNoYWRlci5hdHRyaWJzLnZlcnRleFBvc2l0aW9uLnNldCh2b3Jvbm9pRWRnZXMudmVydGV4QnVmZmVyKTtcbiAgZ2wuZHJhd0FycmF5cyhnbC5MSU5FUywgMCx2b3Jvbm9pRWRnZXMubnVtVmVydGljZXMpO1xuXG4gIC8vZHJhdyBjb25uZWN0b3JzXG4gIGNvbG9yU2hhZGVyLmF0dHJpYnMudmVydGV4UG9zaXRpb24uc2V0KGNvbm5lY3RvclZiby52ZXJ0ZXhCdWZmZXIpO1xuICBnbC5iaW5kQnVmZmVyKGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLGNvbm5lY3RvclZiby5pbmRleEJ1ZmZlcik7XG4gIGdsLmRyYXdFbGVtZW50cyhnbC5UUklBTkdMRVMsY29ubmVjdG9yVmJvLm51bUluZGljZXMsZ2wuVU5TSUdORURfSU5ULDApO1xuICBcbiAgY29sb3JTaGFkZXIuZW5kKCk7XG59XG5cbi8vcHV0IHZvcm9ub2kgZWRnZXMgaW50byBhIHZib1xuZnVuY3Rpb24gdm9yb25vaVRvRWRnZVZCTygpIHtcbiAgdmJvTWVzaC5jbGVhcih2b3Jvbm9pRWRnZXMpO1xuICBmb3IodmFyIGk9MDtpPHZvcm9ub2kudHJpYW5nbGVzLmxlbmd0aDsrK2kpIHtcbiAgICB2YXIgdHJpID0gdm9yb25vaS50cmlhbmdsZXNbaV07XG4gICAgaWYodHJpLmludGVyaW9yXykge1xuICAgICAgaWYodHJpLm5laWdoYm9yc19bMF0gJiYgdHJpLm5laWdoYm9yc19bMF0uaW50ZXJpb3JfKSB7XG4gICAgICAgIHZib01lc2guYWRkVmVydGV4KHZvcm9ub2lFZGdlcyx0cmkuY2lyY3VtY2VudGVyKTtcbiAgICAgICAgdmJvTWVzaC5hZGRWZXJ0ZXgodm9yb25vaUVkZ2VzLHRyaS5uZWlnaGJvcnNfWzBdLmNpcmN1bWNlbnRlcik7XG4gICAgICB9XG4gICAgICBpZih0cmkubmVpZ2hib3JzX1sxXSAmJiB0cmkubmVpZ2hib3JzX1sxXS5pbnRlcmlvcl8pIHtcbiAgICAgICAgdmJvTWVzaC5hZGRWZXJ0ZXgodm9yb25vaUVkZ2VzLHRyaS5jaXJjdW1jZW50ZXIpO1xuICAgICAgICB2Ym9NZXNoLmFkZFZlcnRleCh2b3Jvbm9pRWRnZXMsdHJpLm5laWdoYm9yc19bMV0uY2lyY3VtY2VudGVyKTtcbiAgICAgIH1cbiAgICAgIGlmKHRyaS5uZWlnaGJvcnNfWzJdICYmIHRyaS5uZWlnaGJvcnNfWzJdLmludGVyaW9yXykge1xuICAgICAgICB2Ym9NZXNoLmFkZFZlcnRleCh2b3Jvbm9pRWRnZXMsdHJpLmNpcmN1bWNlbnRlcik7XG4gICAgICAgIHZib01lc2guYWRkVmVydGV4KHZvcm9ub2lFZGdlcyx0cmkubmVpZ2hib3JzX1syXS5jaXJjdW1jZW50ZXIpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICB2Ym9NZXNoLmJ1ZmZlcih2b3Jvbm9pRWRnZXMpO1xufVxuXG5mdW5jdGlvbiBnZXRDb25uZWN0b3JzKCkge1xuICAvL2Zvcih2YXIgaT0wO2k8dm9yb25vaS50cmlhbmdsZXMubGVuZ3RoOysraSkge1xuICAvLyAgdmFyIHRyaSA9IHZvcm9ub2kudHJpYW5nbGVzW2ldO1xuICAvLyAgaWYodHJpLmludGVyaW9yXykge1xuICAvLyAgICBpZih0cmkubmVpZ2hib3JzX1swXSAmJiB0cmkubmVpZ2hib3JzX1swXS5pbnRlcmlvcl8gJiZcbiAgLy8gICAgICB0cmkubmVpZ2hib3JzX1sxXSAmJiB0cmkubmVpZ2hib3JzX1sxXS5pbnRlcmlvcl8gJiZcbiAgLy8gICAgICB0cmkubmVpZ2hib3JzX1syXSAmJiB0cmkubmVpZ2hib3JzX1syXS5pbnRlcmlvcl8pIHtcbiAgLy8gICAgICBjb25uZWN0b3IuY3JlYXRlQ29ubmVjdG9yKHRyaSxjb25uZWN0b3JWYm8pO1xuICAvLyAgICB9XG4gIC8vICB9XG4gIC8vfVxuICBmb3IodmFyIGk9MDtpPHZvcm9ub2kubWVzaC52ZXJ0aWNlcy5sZW5ndGg7KytpKSB7XG4gICAgdmFyIHYgPSB2b3Jvbm9pLm1lc2gudmVydGljZXNbaV07XG4gICAgaWYodi5lKSB7XG4gICAgICBjb25uZWN0b3IuY3JlYXRlQ29ubmVjdG9yKHYsY29ubmVjdG9yVmJvKTtcbiAgICB9XG4gIH1cbiAgdmJvTWVzaC5idWZmZXIoY29ubmVjdG9yVmJvKTtcbn1cblxuZnVuY3Rpb24gaW5pdFZvcm9ub2koKSB7XG4gIHZvcm9ub2kuc2V0RGltZW5zaW9ucyhzaGVsZldpZHRoLHNoZWxmSGVpZ2h0KTtcbiAgdm9yb25vaS5pbml0KCk7XG4gIHZvcm9ub2kucmVzZXQoKTtcbiAgdm9yb25vaS52b3Jvbm9pKCk7XG59XG5cblxuZnVuY3Rpb24ga2V5UHJlc3MoZXZlbnQpIHtcbiAgc3dpdGNoKGV2ZW50LndoaWNoKSB7XG4gICAgY2FzZSBcIkRcIi5jaGFyQ29kZUF0KDApOlxuICAgICAgZG93bmxvYWRWYm9Bc1NUTChjb25uZWN0b3JWYm8pO1xuICAgICAgYnJlYWs7XG4gIH1cbn1cblxuZnVuY3Rpb24gc2NyZWVuVG9SZWFsKHgseSxvdXQpIHtcbiAgdmFyIHNjYWxpbmcgPSBNYXRoLm1pbihjYW52YXMub2Zmc2V0V2lkdGgvc2hlbGZXaWR0aCxjYW52YXMub2Zmc2V0SGVpZ2h0L3NoZWxmSGVpZ2h0KTtcbiAgb3V0WzBdID0geC9zY2FsaW5nO1xuICBvdXRbMV0gPSB5L3NjYWxpbmc7XG59XG5cbmZ1bmN0aW9uIHJlYWxUb1NjcmVlbih4LHksb3V0KSB7XG4gIHZhciBzY2FsaW5nID0gTWF0aC5taW4oY2FudmFzLm9mZnNldFdpZHRoL3NoZWxmV2lkdGgsY2FudmFzLm9mZnNldEhlaWdodC9zaGVsZkhlaWdodCk7XG4gIG91dFswXSA9IHgqc2NhbGluZztcbiAgb3V0WzFdID0geSpzY2FsaW5nO1xufVxuXG4vL3BvaW50ZXIubW91c2VNb3ZlZCA9IGNoZWNrSG92ZXI7XG5cbnZhciBkcmFnSG92ZXIgPSAoZnVuY3Rpb24oKSB7XG4gIHZhciBjb29yZCA9IHZlYzIuY3JlYXRlKCk7XG4gIHJldHVybiBmdW5jdGlvbiBkcmFnSG92ZXIoKSB7XG4gICAgaWYocG9pbnRlci5pc01vdXNlRG93biAmJiBzZWxlY3RlZFB0ID4gLTEpIHtcbiAgICAgIHZhciBwdCA9IHZvcm9ub2kucHRzW3NlbGVjdGVkUHRdO1xuICAgICAgc2NyZWVuVG9SZWFsKHBvaW50ZXIubW91c2VYLHBvaW50ZXIubW91c2VZLGNvb3JkKTtcbiAgICAgIHB0LnggPSBjb29yZFswXTtcbiAgICAgIHB0LnkgPSBjb29yZFsxXTtcbiAgICB9XG4gIH1cbiAgXG59KSgpO1xuXG52YXIgY2hlY2tIb3ZlciA9IChmdW5jdGlvbigpIHtcbiAgdmFyIGNvb3JkID0gdmVjMi5jcmVhdGUoKTtcbiAgcmV0dXJuIGZ1bmN0aW9uIGNoZWNrSG92ZXIoKSB7XG4gICAgaWYoIXBvaW50ZXIuaXNNb3VzZURvd24pIHtcbiAgICAgIHNlbGVjdGVkUHQgPSAtMTtcbiAgICAgIGZvcih2YXIgaT0wO2k8dm9yb25vaS5wdHMubGVuZ3RoOysraSkge1xuICAgICAgICB2YXIgcHQgPSB2b3Jvbm9pLnB0c1tpXTtcbiAgICAgICAgcmVhbFRvU2NyZWVuKHB0LngscHQueSxjb29yZCk7XG4gICAgICAgIHZhciBkeCA9IHBvaW50ZXIubW91c2VYLWNvb3JkWzBdO1xuICAgICAgICB2YXIgZHkgPSBwb2ludGVyLm1vdXNlWS1jb29yZFsxXTtcbiAgICAgICAgaWYoZHgqZHgrZHkqZHkgPCAxMCoxMCkge1xuICAgICAgICAgIHNlbGVjdGVkUHQgPSBpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59KSgpO1xuXG5wb2ludGVyLm1vdXNlRHJhZ2dlZCA9IChmdW5jdGlvbigpIHtcbiAgdmFyIGNvb3JkID0gdmVjMi5jcmVhdGUoKTtcbiAgcmV0dXJuIGZ1bmN0aW9uIG1vdXNlRHJhZ2dlZCgpIHtcbiAgICBcbiAgfVxufSkoKTtcblxucG9pbnRlci5tb3VzZUNsaWNrZWQgPSAoZnVuY3Rpb24oKSB7XG4gIHZhciBjb29yZHMgPSB2ZWMyLmNyZWF0ZSgpO1xuICByZXR1cm4gZnVuY3Rpb24gbW91c2VDbGlja2VkKCkge1xuICAgIGlmKHNlbGVjdGVkUHQgPT0gLTEpIHtcbiAgICAgIHZhciBwdCA9IHt4OjAseTowfTtcbiAgICAgIHNjcmVlblRvUmVhbChwb2ludGVyLm1vdXNlWCxwb2ludGVyLm1vdXNlWSxjb29yZHMpO1xuICAgICAgcHQueCA9IGNvb3Jkc1swXTtcbiAgICAgIHB0LnkgPSBjb29yZHNbMV07XG4gICAgICB2b3Jvbm9pLnB0cy5wdXNoKHB0KTtcbiAgICAgIHNlbGVjdGVkUHQgPSB2b3Jvbm9pLnB0cy5sZW5ndGgtMTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYocG9pbnRlci5tb3VzZUJ1dHRvbiA9PSAzKSB7XG4gICAgICAgIHZvcm9ub2kucHRzLnNwbGljZShzZWxlY3RlZFB0LDEpO1xuICAgICAgICBzZWxlY3RlZFB0ID0gLTE7XG4gICAgICB9XG4gICAgfVxuICB9XG59KSgpO1xuXG5mdW5jdGlvbiBkb3dubG9hZFZib0FzU1RMKHZibykge1xuICB2YXIgdHJpQ291bnQgPSB2Ym8ubnVtSW5kaWNlcy8zO1xuICB2YXIgYnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKDgwKzQrNTAqdHJpQ291bnQpO1xuICB2YXIgZGF0YVZpZXcgPSBuZXcgRGF0YVZpZXcoYnVmZmVyKTtcbiAgZGF0YVZpZXcub2Zmc2V0ID0gODA7XG4gIHNldERWVWludDMyKGRhdGFWaWV3LCB0cmlDb3VudCk7XG4gIFxuICBzYXZlVkJPQmluYXJ5KHZibyxkYXRhVmlldyk7XG5cbiAgdmFyIGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XG4gIHZhciBibG9iID0gbmV3IEJsb2IoW2J1ZmZlcl0sIHsndHlwZSc6J2FwcGxpY2F0aW9uXFwvb2N0ZXQtc3RyZWFtJ30pO1xuICBhLmhyZWYgPSB3aW5kb3cuVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcbiAgYS5kb3dubG9hZCA9IFwidmJvXCIrbmV3IERhdGUoKS50b0lTT1N0cmluZygpLnN1YnN0cmluZygwLDE2KStcIi5zdGxcIjtcbiAgYS5jbGljaygpO1xufVxuXG5mdW5jdGlvbiBzYXZlVkJPQmluYXJ5KHZibywgZGF0YVZpZXcpIHtcbiAgZm9yKHZhciBpPTA7aTx2Ym8ubnVtSW5kaWNlczspIHtcbiAgICBzZXREVkZsb2F0KGRhdGFWaWV3LDAuMCk7XG4gICAgc2V0RFZGbG9hdChkYXRhVmlldywwLjApO1xuICAgIHNldERWRmxvYXQoZGF0YVZpZXcsMC4wKTtcbiAgICB2YXIgaTEgPSB2Ym8uaW5kZXhEYXRhW2krK10qMztcbiAgICB2YXIgaTIgPSB2Ym8uaW5kZXhEYXRhW2krK10qMztcbiAgICB2YXIgaTMgPSB2Ym8uaW5kZXhEYXRhW2krK10qMztcblxuICAgIHNldERWRmxvYXQoZGF0YVZpZXcsdmJvLnZlcnRleERhdGFbaTFdKTtcbiAgICBzZXREVkZsb2F0KGRhdGFWaWV3LHZiby52ZXJ0ZXhEYXRhW2kxKzFdKTtcbiAgICBzZXREVkZsb2F0KGRhdGFWaWV3LHZiby52ZXJ0ZXhEYXRhW2kxKzJdKTtcblxuICAgIHNldERWRmxvYXQoZGF0YVZpZXcsdmJvLnZlcnRleERhdGFbaTJdKTtcbiAgICBzZXREVkZsb2F0KGRhdGFWaWV3LHZiby52ZXJ0ZXhEYXRhW2kyKzFdKTtcbiAgICBzZXREVkZsb2F0KGRhdGFWaWV3LHZiby52ZXJ0ZXhEYXRhW2kyKzJdKTtcblxuICAgIHNldERWRmxvYXQoZGF0YVZpZXcsdmJvLnZlcnRleERhdGFbaTNdKTtcbiAgICBzZXREVkZsb2F0KGRhdGFWaWV3LHZiby52ZXJ0ZXhEYXRhW2kzKzFdKTtcbiAgICBzZXREVkZsb2F0KGRhdGFWaWV3LHZiby52ZXJ0ZXhEYXRhW2kzKzJdKTtcbiAgICBcbiAgICBzZXREVlVpbnQxNihkYXRhVmlldywwKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBzZXREVkZsb2F0KGR2LCB2YWwpIHtcbiAgZHYuc2V0RmxvYXQzMihkdi5vZmZzZXQsdmFsLHRydWUpO1xuICBkdi5vZmZzZXQgKz0gNDtcbn1cblxuZnVuY3Rpb24gc2V0RFZVaW50MTYoZHYsIHZhbCkge1xuICBkdi5zZXRVaW50MTYoZHYub2Zmc2V0LHZhbCx0cnVlKTtcbiAgZHYub2Zmc2V0ICs9IDI7XG59XG5cbmZ1bmN0aW9uIHNldERWVWludDMyKGR2LCB2YWwpIHtcbiAgZHYuc2V0VWludDMyKGR2Lm9mZnNldCx2YWwsdHJ1ZSk7XG4gIGR2Lm9mZnNldCArPSA0O1xufVxuIiwidmFyIGdsTWF0cml4ID0gcmVxdWlyZShcIi4uL2pzL2dsLW1hdHJpeC1taW4uanNcIik7XG52YXIgdmVjMyA9IGdsTWF0cml4LnZlYzM7XG52YXIgdmVjNCA9IGdsTWF0cml4LnZlYzQ7XG4vL1ZFQzQgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vY2hlY2sgZm9yIDBcbnZlYzQucHJvamVjdERvd249ZnVuY3Rpb24oYSxiKXt2YXIgZD0xLjAvYVszXTtpZighYikge2I9dmVjMy5jcmVhdGUoKTt9IGJbMF09YVswXSpkO2JbMV09YVsxXSpkO2JbMl09YVsyXSpkO3JldHVybiBiO307XG4vL29wdGltaXplIHRvIGF2b2lkIG11bHRpcGxpY2F0aW9ucyB3aXRoIG5vIGJcbnZlYzQuZnJvbVZlYzM9ZnVuY3Rpb24oYSxiKXtpZighYikgYj0xO3ZhciBjPW5ldyBGbG9hdDMyQXJyYXkoNCk7Y1swXT1hWzBdKmI7Y1sxXT1hWzFdKmI7Y1syXT1hWzJdKmI7Y1szXT1iO3JldHVybiBjfTtcblxuLy9OVVJCUyBDVVJWRVxuLy9hIG51cmJzIG9iamVjdCBoYXMgY29udHJvbCBwdHMsa25vdHMsIGRlZ3JlZVxudmFyIG51cmJzID0gZXhwb3J0cztcbi8vdXNlZCBsb2NhbGx5XG5udXJicy5NQVhfREVHUkVFID0gMTA7XG5udXJicy5iYXNpc0Z1bmNzID0gbmV3IEZsb2F0MzJBcnJheSgxMCk7XG5udXJicy5iYXNpc0Z1bmNzVSA9IG5ldyBGbG9hdDMyQXJyYXkoMTApO1xubnVyYnMuYmFzaXNGdW5jc1YgPSBuZXcgRmxvYXQzMkFycmF5KDEwKTtcbm51cmJzLmRlcml2ZUJhc2lzRnVuY3MgPSBuZXcgQXJyYXkoMTEpO1xuZm9yKHZhciBpPTA7aTxudXJicy5NQVhfREVHUkVFKzE7KytpKSBudXJicy5kZXJpdmVCYXNpc0Z1bmNzW2ldID0gbmV3IEZsb2F0MzJBcnJheShudXJicy5NQVhfREVHUkVFKzEpO1xubnVyYnMubmR1ID0gbmV3IEFycmF5KG51cmJzLk1BWF9ERUdSRUUrMSk7XG5mb3IodmFyIGk9MDtpPG51cmJzLk1BWF9ERUdSRUUrMTsrK2kpIG51cmJzLm5kdVtpXSA9IG5ldyBGbG9hdDMyQXJyYXkobnVyYnMuTUFYX0RFR1JFRSsxKTtcblxubnVyYnMuYmFuZyA9IGZ1bmN0aW9uKGEpIHtcblx0dmFyIHZhbD0xO1xuXHRmb3IoO2E+MTthLS0pIHtcblx0XHR2YWwqPWE7XG5cdH1cblx0cmV0dXJuIHZhbDtcbn07XG5cbi8vSSBhbSBhbiBpZGlvdFxubnVyYnMuQiA9IFtuZXcgRmxvYXQzMkFycmF5KDEwKSxuZXcgRmxvYXQzMkFycmF5KDEwKSxuZXcgRmxvYXQzMkFycmF5KDEwKSxuZXcgRmxvYXQzMkFycmF5KDEwKSxuZXcgRmxvYXQzMkFycmF5KDEwKSxuZXcgRmxvYXQzMkFycmF5KDEwKSxuZXcgRmxvYXQzMkFycmF5KDEwKSxuZXcgRmxvYXQzMkFycmF5KDEwKSxuZXcgRmxvYXQzMkFycmF5KDEwKSxuZXcgRmxvYXQzMkFycmF5KDEwKV07XG5mb3IodmFyIGk9MDtpPDEwOysraSkge1xuXHRmb3IodmFyIGo9MDtqPDEwOysraikge1xuXHRcdG51cmJzLkJbaV1bal0gPSBudXJicy5iYW5nKGkpLyhudXJicy5iYW5nKGopKm51cmJzLmJhbmcoaS1qKSk7XG5cdH1cbn1cblxuLy9tYWtlIGEgbnVyYnMgY3J2IG9iamVjdFxuLy9pbml0aWFsaXplIHdpdGggcG9pbnRzPz9cbm51cmJzLmNyZWF0ZUNydiA9IGZ1bmN0aW9uKGNydixkZWdyZWUpIHtcblx0Y3J2ID0gY3J2IHx8IHt9O1xuXHRjcnYuZGVncmVlID0gZGVncmVlIHx8IDM7XG5cdGNydi5rbm90cyA9IG5ldyBBcnJheShjcnYuZGVncmVlKzEpO1xuXHRmb3IodmFyIGk9MDtpPD1jcnYuZGVncmVlO2krKykgY3J2Lmtub3RzW2ldID0gMDtcblx0Y3J2LmNvbnRyb2xQdHMgPSBbXTtcblx0cmV0dXJuIGNydjtcbn1cblxubnVyYnMuY3JlYXRlQ2xvc2VkQ3J2ID0gZnVuY3Rpb24ocHRzLCBkZWdyZWUpIHtcblx0dmFyIGNydiA9IHt9O1xuXHRjcnYuZGVncmVlID0gZGVncmVlIHx8IDM7XG5cdGNydi5rbm90cyA9IG5ldyBBcnJheShwdHMubGVuZ3RoK2Nydi5kZWdyZWUrY3J2LmRlZ3JlZSsxKTtcblx0Zm9yKHZhciBpPTA7aTxjcnYua25vdHMubGVuZ3RoO2krKykgY3J2Lmtub3RzW2ldID0gaS1jcnYuZGVncmVlO1xuXHRjcnYuY29udHJvbFB0cyA9IFtdO1xuXHRmb3IodmFyIGk9MDtpPHB0cy5sZW5ndGg7KytpKSB7XG5cdFx0Y3J2LmNvbnRyb2xQdHMucHVzaCh2ZWM0LmNyZWF0ZShwdHNbaV0pKTtcblx0fVxuXHRmb3IodmFyIGk9MDtpPD1kZWdyZWU7KytpKSB7XG5cdFx0Y3J2LmNvbnRyb2xQdHMucHVzaCh2ZWM0LmNyZWF0ZShwdHNbaV0pKTtcblx0fVxuXHRyZXR1cm4gY3J2O1xufVxuXG5udXJicy5jb3B5Q3J2ID0gZnVuY3Rpb24oY3J2KSB7XG5cdHZhciBuZXdDcnYgPSB7fTtcblx0bmV3Q3J2LmRlZ3JlZSA9IGNydi5kZWdyZWU7XG5cdG5ld0Nydi5rbm90cyA9IGNydi5rbm90cy5zbGljZSgwKTtcblx0bmV3Q3J2LmNvbnRyb2xQdHMgPSBjcnYuY29udHJvbFB0cy5zbGljZSgwKTtcblx0cmV0dXJuIG5ld0Nydjtcbn1cblxuLy9iaW5hcnkgc2VhcmNoXG5udXJicy5maW5kS25vdCA9IGZ1bmN0aW9uKGtub3RzLHUsZGVncmVlKSB7XG5cdGlmICh1PT1rbm90c1trbm90cy5sZW5ndGgtZGVncmVlXSkgcmV0dXJuIGtub3RzLmxlbmd0aC1kZWdyZWUtMjtcblx0aWYodSA8PSBrbm90c1tkZWdyZWVdKSByZXR1cm4gZGVncmVlO1xuXHR2YXIgbG93ID0gZGVncmVlO1xuXHR2YXIgaGlnaCA9IGtub3RzLmxlbmd0aC1kZWdyZWU7XG5cdHZhciBtaWQgPSBNYXRoLmZsb29yKChoaWdoK2xvdykvMik7XG5cdHdoaWxlKGtub3RzW21pZF0+dSB8fCB1ID49IGtub3RzW21pZCsxXSkge1xuXHQgIGlmKHU8a25vdHNbbWlkXSkge1xuXHRcdGhpZ2ggPSBtaWQ7XG5cdCAgfSBlbHNlIHtcblx0XHRsb3cgPSBtaWQ7XG5cdCAgfVxuXHQgIG1pZCA9IE1hdGguZmxvb3IoKGhpZ2grbG93KS8yKTtcblx0fVxuXHRyZXR1cm4gbWlkO1xufVxuXG4gXG4vL2ltcGxlbWVudCBkZWdyZWUgZWxldmF0aW9uIGFuZCByZWR1Y3Rpb24sIG5lZWRlZCB0byBsb2Z0IGN1cnZlIG9mIGRpZmZlcmVudCBkZWdyZWVzIGFzIHdlbGxcbm51cmJzLnNldERlZ3JlZSA9IGZ1bmN0aW9uKGRlZykge1xufVxuXHRcbm51cmJzLmV2YWx1YXRlQ3J2ID0gKGZ1bmN0aW9uKCkge1xuICB2YXIgZXZhbFB0ID0gdmVjNC5jcmVhdGUoKTtcbiAgcmV0dXJuIGZ1bmN0aW9uIGV2YWx1YXRlQ3J2KGNydix1LHB0KSB7XG4gICAgdmFyIGN1cnJLbm90ID0gbnVyYnMuZmluZEtub3QoY3J2Lmtub3RzLHUsY3J2LmRlZ3JlZSk7XG4gICAgXG4gICAgbnVyYnMuYmFzaXNGdW5jdGlvbnMoY3J2Lmtub3RzLGNydi5kZWdyZWUsY3Vycktub3QsIHUsbnVyYnMuYmFzaXNGdW5jcyk7XG4gICAgdmVjNC5zZXQoZXZhbFB0LDAsMCwwLDApO1xuICAgIGZvcih2YXIgaSA9IDA7aTw9Y3J2LmRlZ3JlZTsrK2kpIHtcbiAgICAgIHZlYzQuc2NhbGVBbmRBZGQoZXZhbFB0LCBldmFsUHQsY3J2LmNvbnRyb2xQdHNbY3Vycktub3QtY3J2LmRlZ3JlZStpXSwgbnVyYnMuYmFzaXNGdW5jc1tpXSk7XG4gICAgfVxuICAgIHJldHVybiB2ZWM0LnByb2plY3REb3duKGV2YWxQdCxwdCk7ICBcbiAgfVxufSkoKTtcbi8qXHQgXG5cdCBwdWJsaWMgUFZlY3RvciBkZXJpdmF0aXZlKGZsb2F0IHUsIGludCBrKSB7XG5cdFx0IFZlY3RvcjREW10gZGVyaXZlc1cgPSBuZXcgVmVjdG9yNERbaysxXTtcblx0XHQgaWYoaz5kZWdyZWUpIHJldHVybiBuZXcgUFZlY3RvcigpO1xuXHRcdCBpbnQgY3Vycktub3QgPSBmaW5kS25vdCh1KTtcblx0XHQgVmVjdG9yNERbXSBoUHRzID0gbmV3IFZlY3RvcjREW2RlZ3JlZSsxXTtcblx0XHQgZm9yKGludCBpPTA7aTw9ZGVncmVlOysraSkge1xuXHQgICAgICBoUHRzW2ldID0gVmVjdG9yNEQubXVsdGlwbHkobmV3IFZlY3RvcjREKGNvbnRyb2xQdHNbY3Vycktub3QtZGVncmVlK2ldLngsY29udHJvbFB0c1tjdXJyS25vdC1kZWdyZWUraV0ueSxjb250cm9sUHRzW2N1cnJLbm90LWRlZ3JlZStpXS56KSx3ZWlnaHRzW2N1cnJLbm90LWRlZ3JlZStpXSk7XG5cdFx0IH1cblx0XHQgZmxvYXRbXVtdIGJhc0Z1bmMgPSBkZXJpdmVCYXNpc0Z1bmN0aW9ucyhjdXJyS25vdCx1LCBrKTtcblx0XHQgZm9yKGludCBpPTA7aTw9azsrK2kpIHtcblx0XHRcdCBkZXJpdmVzV1tpXSA9IG5ldyBWZWN0b3I0RCgpO1xuXHRcdFx0IGZvcihpbnQgaj0wO2o8PWRlZ3JlZTsrK2opIHtcblx0XHRcdFx0IGRlcml2ZXNXW2ldID0gVmVjdG9yNEQuYWRkKGRlcml2ZXNXW2ldLFZlY3RvcjRELm11bHRpcGx5KGhQdHNbal0sYmFzRnVuY1tpXVtqXSkpO1xuXHRcdFx0IH1cblx0XHQgfVxuXHRcdCBcblx0XHQgUFZlY3RvcltdIGRlcml2ZXMgPSBuZXcgUFZlY3RvcltkZXJpdmVzVy5sZW5ndGhdO1xuXHRcdCBkZXJpdmVzWzBdID0gbmV3IFBWZWN0b3IoKTtcblx0XHQgZm9yKGludCBpPTA7aTw9azsrK2kpIHtcblx0XHRcdFBWZWN0b3IgY3VyclB0ID0gbmV3IFBWZWN0b3IoZGVyaXZlc1dbaV0ueCxkZXJpdmVzV1tpXS55LGRlcml2ZXNXW2ldLnopO1xuXHRcdFx0Zm9yKGludCBqPTE7ajw9aTsrK2opIHtcblx0XHRcdFx0Y3VyclB0ID0gUFZlY3Rvci5zdWIoY3VyclB0LFBWZWN0b3IubXVsdChkZXJpdmVzW2ktal0sQltpXVtqXSpkZXJpdmVzV1tqXS53KSk7XG5cdFx0XHR9XG5cdFx0XHRkZXJpdmVzW2ldID0gbmV3IFBWZWN0b3IoY3VyclB0LngvZGVyaXZlc1dbMF0udyxjdXJyUHQueS9kZXJpdmVzV1swXS53LGN1cnJQdC56L2Rlcml2ZXNXWzBdLncpO1xuXHRcdCB9XG5cdFx0IHJldHVybiBkZXJpdmVzW2tdO1xuXHRcdCBcblx0IH1cblx0IFxuXHQgcHVibGljIFBWZWN0b3JbXSBhbGxEZXJpdmF0aXZlcyhmbG9hdCB1LCBpbnQgaykge1xuXHRcdCBWZWN0b3I0RFtdIGRlcml2ZXNXID0gbmV3IFZlY3RvcjREW2srMV07XG5cdFx0IGludCBjdXJyS25vdCA9IGZpbmRLbm90KHUpO1xuXHRcdCBWZWN0b3I0RFtdIGhQdHMgPSBuZXcgVmVjdG9yNERbZGVncmVlKzFdO1xuXHRcdCBmb3IoaW50IGk9MDtpPD1kZWdyZWU7KytpKSB7XG5cdCAgICAgIGhQdHNbaV0gPSBWZWN0b3I0RC5tdWx0aXBseShuZXcgVmVjdG9yNEQoY29udHJvbFB0c1tjdXJyS25vdC1kZWdyZWUraV0ueCxjb250cm9sUHRzW2N1cnJLbm90LWRlZ3JlZStpXS55LGNvbnRyb2xQdHNbY3Vycktub3QtZGVncmVlK2ldLnopLHdlaWdodHNbY3Vycktub3QtZGVncmVlK2ldKTtcblx0XHQgfVx0XHQgXG5cdFx0IGZsb2F0W11bXSBiYXNGdW5jID0gZGVyaXZlQmFzaXNGdW5jdGlvbnMoY3Vycktub3QsdSwgayk7XG5cdFx0IGZvcihpbnQgaT0wO2k8PWs7KytpKSB7XG5cdFx0XHQgZGVyaXZlc1dbaV0gPSBuZXcgVmVjdG9yNEQoKTtcblx0XHRcdCBmb3IoaW50IGo9MDtqPD1kZWdyZWU7KytqKVxuXHRcdFx0XHQgZGVyaXZlc1dbaV0gPSBWZWN0b3I0RC5hZGQoZGVyaXZlc1dbaV0sVmVjdG9yNEQubXVsdGlwbHkoaFB0c1tqXSxiYXNGdW5jW2ldW2pdKSk7XG5cdFx0IH1cblx0XHQgXG5cdFx0IFBWZWN0b3JbXSBkZXJpdmVzID0gbmV3IFBWZWN0b3JbZGVyaXZlc1cubGVuZ3RoXTtcblx0XHQgZGVyaXZlc1swXSA9IG5ldyBQVmVjdG9yKCk7XG5cdFx0IGZvcihpbnQgaT0wO2k8PWs7KytpKSB7XG5cdFx0XHRQVmVjdG9yIGN1cnJQdCA9IG5ldyBQVmVjdG9yKGRlcml2ZXNXW2ldLngsZGVyaXZlc1dbaV0ueSxkZXJpdmVzV1tpXS56KTtcblx0XHRcdGZvcihpbnQgaj0xO2o8PWk7KytqKSB7XG5cdFx0XHRcdGN1cnJQdCA9IFBWZWN0b3Iuc3ViKGN1cnJQdCxQVmVjdG9yLm11bHQoZGVyaXZlc1tpLWpdLEJbaV1bal0qZGVyaXZlc1dbal0udykpO1xuXHRcdFx0fVxuXHRcdFx0ZGVyaXZlc1tpXSA9IG5ldyBQVmVjdG9yKGN1cnJQdC54L2Rlcml2ZXNXWzBdLncsY3VyclB0LnkvZGVyaXZlc1dbMF0udyxjdXJyUHQuei9kZXJpdmVzV1swXS53KTtcblx0XHQgfVxuXHRcdCByZXR1cm4gZGVyaXZlcztcblx0XHQgXG5cdCB9XHQgXG4qL1x0ICBcblx0ICAvL2FwcHJveGltYXRlIGxlbmd0aCwgdW5pbXBsZW1lbnRlZFxubnVyYnMuY3J2TGVuZ3RoPWZ1bmN0aW9uKGNydikge1xuXHRyZXR1cm4gMTtcbn1cdFxuXHQgIFxubnVyYnMuZG9tYWluID0gZnVuY3Rpb24oYyxiKSB7XG5cdGIgPSBiIHx8IG5ldyBBcnJheSgyKTtcblx0YlswXT1jLmtub3RzW2MuZGVncmVlXTtcblx0YlsxXT1jLmtub3RzW2Mua25vdHMubGVuZ3RoLTEtYy5kZWdyZWVdO1xuXHRyZXR1cm4gYjtcbn1cblx0ICBcbm51cmJzLmFkZFBvaW50ID0gZnVuY3Rpb24oY3J2LCBwdCkge1xuXHRjcnYuY29udHJvbFB0cy5wdXNoKHZlYzQuZnJvbVZlYzMocHQsMSkpO1xuXHR2YXIgaW5jID0gMTtcblx0dmFyIHN0YXJ0ID0gY3J2Lmtub3RzW2Nydi5kZWdyZWVdO1xuXHR2YXIgZW5kID0gY3J2Lmtub3RzW2Nydi5rbm90cy5sZW5ndGgtMV07XG5cdGlmKGNydi5jb250cm9sUHRzLmxlbmd0aDw9Y3J2LmRlZ3JlZSsxKSB7XG5cdCAgY3J2Lmtub3RzLnB1c2goMSk7XG5cdH0gZWxzZSB7XG5cdCAgdmFyIGk7XG5cdCAgZm9yKCBpPWNydi5kZWdyZWUrMTtpPGNydi5rbm90cy5sZW5ndGgtY3J2LmRlZ3JlZTsrK2kpIHtcblx0XHQgIGlmKGNydi5rbm90c1tpXSAhPSBzdGFydCkge1xuXHRcdFx0ICBpbmMgPSBjcnYua25vdHNbaV0tc3RhcnQ7XG5cdFx0XHQgIGkgPSBjcnYua25vdHMubGVuZ3RoOyAvL2JyZWFrP1xuXHRcdCAgfVxuXHQgIH1cblx0ICBjcnYua25vdHMucHVzaChlbmQraW5jKTtcblx0ICBmb3IoIGk9Y3J2Lmtub3RzLmxlbmd0aC0yO2k+Y3J2Lmtub3RzLmxlbmd0aC1jcnYuZGVncmVlLTI7LS1pKSBcblx0XHRjcnYua25vdHNbaV0gPSBlbmQraW5jO1x0XHRcdCAgXG5cdCAgZm9yKCBpPTA7aTxjcnYua25vdHMubGVuZ3RoOysraSkgXG5cdFx0Y3J2Lmtub3RzW2ldIC89IGVuZCtpbmM7XG5cdH1cbn1cblxuLy9pbnNlcnQgYSBrbm90IGEgdSBzb21lIHRpbWVzXG4vL3RoaXMgc2hvdWxkIHVzZSBuYXRpdmUgYXJyYXkgbWV0aG9kcyBub3QgdGhpcyB3ZWlyZCBjb3B5aW5nXG5udXJicy5pbnNlcnRLbm90ID0gZnVuY3Rpb24oY3J2LHUsdGltZXMpIHtcblx0aWYoIXRpbWVzKSB0aW1lcyA9IDE7XG5cdHZhciBjdXJyS25vdCA9IG51cmJzLmZpbmRLbm90KGNydi5rbm90cyx1LGNydi5kZWdyZWUpO1xuXHR2YXIgbXVsdGlwbGljaXR5ID0gbnVyYnMuZmluZE11bHRpcGxpY2l0eShjcnYua25vdHMsY3Vycktub3QpO1xuXHQvL3RpbWVzID0gTWF0aC5taW4oZGVncmVlLXRpbWVzLW11bHRpcGxpY2l0eSx0aW1lcyk7XG5cdC8vdGltZXMgPSBNYXRoLm1heCgwLHRpbWVzKTtcblx0dmFyIG5ld0tub3RzID0gbmV3IEZsb2F0MzJBcnJheShjcnYua25vdHMubGVuZ3RoK3RpbWVzKTtcblx0dmFyIG5ld1BvaW50cyA9IG5ldyBBcnJheShjcnYuY29udHJvbFB0cy5sZW5ndGgrdGltZXMpO1xuXG5cdHZhciBpO1xuXHRmb3IoaT0wO2k8PWN1cnJLbm90OysraSkgbmV3S25vdHNbaV0gPSBjcnYua25vdHNbaV07XG5cdGZvcihpPTE7aTw9dGltZXM7KytpKSBuZXdLbm90c1tjdXJyS25vdCtpXSA9IHU7XG5cdGZvcihpPWN1cnJLbm90KzE7aTxjcnYua25vdHMubGVuZ3RoOysraSkgbmV3S25vdHNbaSt0aW1lc10gPSBjcnYua25vdHNbaV07XG5cdGZvcihpPTA7aTw9Y3Vycktub3QtY3J2LmRlZ3JlZTsrK2kpIG5ld1BvaW50c1tpXSA9IGNydi5jb250cm9sUHRzW2ldO1xuXHRmb3IoaT1jdXJyS25vdC1tdWx0aXBsaWNpdHk7IGk8Y3J2LmNvbnRyb2xQdHMubGVuZ3RoOysraSkgbmV3UG9pbnRzW2krdGltZXNdID0gY3J2LmNvbnRyb2xQdHNbaV07XG5cdHZhciB0ZW1wID0gbmV3IEFycmF5KGRlZ3JlZSsxKTtcblx0Zm9yKGk9MDtpPD0gY3J2LmRlZ3JlZS1tdWx0aXBsaWNpdHk7KytpKSB0ZW1wW2ldID0gY3J2LmNvbnRyb2xQdHNbY3Vycktub3QtY3J2LmRlZ3JlZStpXTtcblx0dmFyIGosIEwsYWxwaGE7XG5cdGZvcihqPTE7ajw9dGltZXM7KytqKSB7XG5cdCBMID0gY3Vycktub3QtY3J2LmRlZ3JlZStqO1xuXHQgZm9yKGk9MDtpPD1jcnYuZGVncmVlLWotbXVsdGlwbGljaXR5OysraSkge1xuXHRcdCBhbHBoYSA9ICh1LWNydi5rbm90c1tMK2ldKS8oY3J2Lmtub3RzW2krY3Vycktub3QrMV0tY3J2Lmtub3RzW0wraV0pO1xuXHRcdCB2ZWM0LmFkZCh2ZWM0LnNjYWxlKHRlbXBbaSsxXSxhbHBoYSksdmVjNC5zY2FsZSh0ZW1wW2ldLDEuMC1hbHBoYSksdGVtcFtpXSk7XG5cdCB9XG5cdCBcblx0IG5ld1BvaW50c1tMXSA9IHRlbXBbMF07XG5cdCBuZXdQb2ludHNbY3Vycktub3QrdGltZXMtai1tdWx0aXBsaWNpdHldID0gdGVtcFtjcnYuZGVncmVlLWotbXVsdGlwbGljaXR5XTtcblx0fVxuXHRmb3IoaT1MKzE7aTxjdXJyS25vdC1tdWx0aXBsaWNpdHk7KytpKSB7XG5cdCBuZXdQb2ludHNbaV0gPSB0ZW1wW2ktTF07XG5cdH1cblx0Y3J2LmNvbnRyb2xQdHMgPSBuZXdQb2ludHM7XG5cdGNydi5rbm90cyA9IG5ld0tub3RzO1xufVx0ICBcblxubnVyYnMuaW5zZXJ0S25vdEFycmF5ID0gZnVuY3Rpb24oY3J2LHVzKSB7XG5cbn1cblx0ICAvKlx0IFxuXHQgcHVibGljIHZvaWQgaW5zZXJ0S25vdHMoZmxvYXRbXSBpbnNlcnRLbm90cykge1xuXHRcdCBpbnQgc3RhcnRLbm90ID0gZmluZEtub3QoaW5zZXJ0S25vdHNbMF0pO1xuXHRcdCBpbnQgZW5kS25vdCA9IGZpbmRLbm90KGluc2VydEtub3RzW2luc2VydEtub3RzLmxlbmd0aC0xXSkrMTtcblx0XHQgZmxvYXRbXSBuZXdLbm90cyA9IG5ldyBmbG9hdFtrbm90cy5sZW5ndGgraW5zZXJ0S25vdHMubGVuZ3RoXTtcblx0XHQgVmVjdG9yNERbXSBuZXdQb2ludHMgPSBuZXcgVmVjdG9yNERbY29udHJvbFB0cy5sZW5ndGgraW5zZXJ0S25vdHMubGVuZ3RoXTtcblx0XHQgZm9yKGludCBqPTA7ajw9c3RhcnRLbm90LWRlZ3JlZTsrK2opIG5ld1BvaW50c1tqXSA9IG5ldyBWZWN0b3I0RChjb250cm9sUHRzW2pdLHdlaWdodHNbal0pO1xuXHRcdCBmb3IoaW50IGo9ZW5kS25vdC0xO2o8Y29udHJvbFB0cy5sZW5ndGg7KytqKSBuZXdQb2ludHNbaitpbnNlcnRLbm90cy5sZW5ndGhdID0gIG5ldyBWZWN0b3I0RChjb250cm9sUHRzW2pdLHdlaWdodHNbal0pO1xuXHRcdCBmb3IoaW50IGo9MDtqPD1zdGFydEtub3Q7KytqKSBuZXdLbm90c1tqXSA9IGtub3RzW2pdO1xuXHRcdCBmb3IoaW50IGo9ZW5kS25vdCtkZWdyZWU7ajxrbm90cy5sZW5ndGg7KytqKSBuZXdLbm90c1tqK2luc2VydEtub3RzLmxlbmd0aF0gPSBrbm90c1tqXTtcblx0XHQgaW50IGk9ZW5kS25vdCtkZWdyZWUtMTtcblx0XHQgaW50IGs9IGVuZEtub3QrZGVncmVlK2luc2VydEtub3RzLmxlbmd0aC0xO1xuXHRcdCBmb3IoaW50IGo9aW5zZXJ0S25vdHMubGVuZ3RoLTE7aj49MDstLWopIHtcblx0XHRcdCB3aGlsZShpbnNlcnRLbm90c1tqXSA8PSBrbm90c1tpXSAmJiBpPnN0YXJ0S25vdCkge1xuXHRcdFx0XHQgbmV3UG9pbnRzW2stZGVncmVlLTFdID0gbmV3IFZlY3RvcjREKGNvbnRyb2xQdHNbaS1kZWdyZWUtMV0sd2VpZ2h0c1tpLWRlZ3JlZS0xXSk7XG5cdFx0XHRcdCBuZXdLbm90c1trXSA9IGtub3RzW2ldO1xuXHRcdFx0XHQgLS1rO1xuXHRcdFx0XHQgLS1pO1xuXHRcdFx0IH1cblx0XHRcdCBuZXdQb2ludHNbay1kZWdyZWUtMV0gPSBuZXdQb2ludHNbay1kZWdyZWVdO1xuXHRcdFx0IGZvcihpbnQgbD0xO2w8PWRlZ3JlZTsrK2wpIHtcblx0XHRcdFx0IGludCBpbmQgPSBrLWRlZ3JlZStsO1xuXHRcdFx0XHQgbG9hdCBhbHBoYSA9IG5ld0tub3RzW2srbF0taW5zZXJ0S25vdHNbal07XG5cdFx0XHRcdCBpZihNYXRoLmFicyhhbHBoYSkgPT0gMCkgbmV3UG9pbnRzW2luZC0xXSA9IG5ld1BvaW50c1tpbmRdO1xuXHRcdFx0XHQgZWxzZSB7XG5cdFx0XHRcdFx0IGFscGhhID0gYWxwaGEvKG5ld0tub3RzW2srbF0ta25vdHNbaS1kZWdyZWUrbF0pO1xuXHRcdFx0XHRcdCBuZXdQb2ludHNbaW5kLTFdID0gVmVjdG9yNEQuYWRkKFZlY3RvcjRELm11bHRpcGx5KG5ld1BvaW50c1tpbmQtMV0sYWxwaGEpLCBWZWN0b3I0RC5tdWx0aXBseShuZXdQb2ludHNbaW5kXSwxLWFscGhhKSk7XG5cdFx0XHRcdCB9XG5cdFx0XHQgfVxuXHRcdFx0IG5ld0tub3RzW2tdID0gaW5zZXJ0S25vdHNbal07XG5cdFx0XHQgLS1rO1xuXHRcdCB9XG5cdFx0IGtub3RzID0gbmV3S25vdHM7XG5cdFx0IGNvbnRyb2xQdHMgPSBuZXcgUFZlY3RvcltuZXdQb2ludHMubGVuZ3RoXTtcblx0XHQgd2VpZ2h0cyA9IG5ldyBmbG9hdFtuZXdQb2ludHMubGVuZ3RoXTtcblx0XHQgZm9yKGludCBqPTA7ajxuZXdQb2ludHMubGVuZ3RoOysraikge1xuXHRcdFx0IFxuXHRcdFx0IGlmKG5ld1BvaW50c1tqXSAhPSBudWxsKSB7XG5cdFx0XHRcdCBjb250cm9sUHRzW2pdID0gbmV3UG9pbnRzW2pdLnByb2plY3REb3duKCk7XG5cdFx0XHRcdCB3ZWlnaHRzW2pdID0gbmV3UG9pbnRzW2pdLnc7XG5cdFx0XHQgfVxuXHRcdCB9XG5cdCB9XG4qL1xuLy9tYWtlIGtub3QgdmFsdWVzIGJldHdlZW4gMCBhbmQgMSBha2EgZXZhbHVhdGUoMCkgPSBzdGFydCBhbmQgZXZhbHVhdGUoMSkgPSBlbmRcbm51cmJzLm5vcm1hbGl6ZUtub3RzPWZ1bmN0aW9uKGtub3RzKSB7XG5cdHZhciBzdGFydCA9IGtub3RzWzBdO1xuXHR2YXIgZW5kID0ga25vdHNba25vdHMubGVuZ3RoLTFdO1xuXHRmb3IodmFyIGk9MDtpPGtub3RzLmxlbmd0aDsrK2kpIHtcblx0XHRrbm90c1tpXSA9IChrbm90c1tpXS1zdGFydCkvKGVuZC1zdGFydCk7XG5cdH1cbn1cblxuLy9ob3cgbWFueSB0aW1lcyBkb2VzIGEga25vdCBhcHBlYXJcbm51cmJzLmZpbmRNdWx0aXBsaWNpdHkgPSBmdW5jdGlvbihrbm90cyxrbm90KSB7XG5cdHZhciBtdWx0ID0gMTtcblx0dmFyIGk7XG5cdGZvcihpPWtub3QrMTtpPGtub3RzLmxlbmd0aCAmJiBrbm90c1tpXSA9PSBrbm90c1trbm90XTsrK2kpICsrbXVsdDtcblx0Zm9yKGk9a25vdC0xO2k+PTAgJiYga25vdHNbaV0gPT0ga25vdHNba25vdF07LS1pKSArK211bHQ7XG5cblx0cmV0dXJuIG11bHQtMTtcbn1cblx0IFxubnVyYnMuYmFzaXNGdW5jdGlvbnMgPSAoZnVuY3Rpb24oKSB7XG4gIHZhciBsZWZ0ID0gbmV3IEZsb2F0MzJBcnJheShudXJicy5NQVhfREVHUkVFKzEpO1xuICB2YXIgcmlnaHQgPSBuZXcgRmxvYXQzMkFycmF5KG51cmJzLk1BWF9ERUdSRUUrMSk7XG4gIHJldHVybiBmdW5jdGlvbiBiYXNpc0Z1bmN0aW9ucyhrbm90cyxkZWdyZWUsa25vdCx1LGZ1bmNzKSB7XG5cbiAgICBmdW5jc1swXSA9IDE7XG4gICAgdmFyIGosIHIsIHNhdmVkLCB0ZW1wO1xuICAgIGZvciggaj0xO2o8PWRlZ3JlZTsrK2opIHtcbiAgICAgIGxlZnRbal0gPSB1LWtub3RzW2tub3QrMS1qXTtcbiAgICAgIHJpZ2h0W2pdID0ga25vdHNba25vdCtqXS11O1xuICAgICAgc2F2ZWQgPSAwO1xuICAgICAgZm9yKCByID0gMDtyPGo7KytyKSB7XG4gICAgICB0ZW1wID0gZnVuY3Nbcl0vKHJpZ2h0W3IrMV0rbGVmdFtqLXJdKTtcbiAgICAgIGZ1bmNzW3JdID0gc2F2ZWQrcmlnaHRbcisxXSp0ZW1wO1xuICAgICAgc2F2ZWQgPSBsZWZ0W2otcl0qdGVtcDtcbiAgICAgIH1cbiAgICAgIGZ1bmNzW2pdID0gc2F2ZWQ7XG4gICAgfVxuICAgIHJldHVybiBmdW5jcztcbiAgfVxufSkoKTtcblx0ICBcbm51cmJzLmRlcml2ZUJhc2lzRnVuY3Rpb25zID0gZnVuY3Rpb24oa25vdHMsZGVncmVlLGtub3QsIHUsIGRlcikge1xuXHR2YXIgbGVmdCxyaWdodDtcblx0bmR1WzBdWzBdID0gMTtcblx0dmFyIGoscjtcblx0dmFyIHNhdmVkLHRlbXA7XG5cdGZvcihqPTE7ajw9ZGVncmVlOysraikge1xuXHQgbGVmdFtqXSA9IHUta25vdHNba25vdCsxLWpdO1xuXHQgcmlnaHRbal0gPSBrbm90c1trbm90K2pdLXU7XG5cdCBzYXZlZCA9IDA7XG5cdCBmb3Iocj0wO3I8ajsrK3IpIHtcblx0XHQgbmR1W2pdW3JdID0gcmlnaHRbcisxXStsZWZ0W2otcl07XG5cdFx0IHRlbXAgPSBuZHVbcl1bai0xXS9uZHVbal1bcl07XG5cdFx0IG5kdVtyXVtqXSA9IHNhdmVkK3JpZ2h0W3IrMV0qdGVtcDtcblx0XHQgc2F2ZWQgPSBsZWZ0W2otcl0qdGVtcDtcblx0IH1cblx0IG5kdVtqXVtqXSA9IHNhdmVkO1xuXHR9XG5cdGZvcihqPTA7ajw9ZGVncmVlOysrailcblx0XHRudXJicy5kZXJpdmVCYXNpc0Z1bmNzWzBdW2pdID0gbmR1W2pdW2RlZ3JlZV07XG5cdFxuXHR2YXIgczEsIHMyLCBrLGQscmsscGssajEsajI7XG5cdHZhciBhPW5ldyBBcnJheShkZWdyZWUrMSk7XG5cdGZvcihqPTA7ajxkZWdyZWUrMTsrK2opIGFbal0gPSBuZXcgQXJyYXkoZGVncmVlKzEpO1xuXHRmb3Iocj0wO3I8PWRlZ3JlZTsrK3IpIHtcblx0IHMxID0gMDtcblx0IHMyID0gMTtcblx0IGFbMF1bMF0gPSAxO1xuXHQgZm9yKCBrPTE7azw9ZGVyOysraykge1xuXHRcdCBkID0gMDtcblx0XHQgcmsgPSByLWs7XG5cdFx0IHBrID0gZGVncmVlLWs7XG5cdFx0IGlmKHI+PWspIHtcblx0XHRcdCBhW3MyXVswXSA9IGFbczFdWzBdL25kdVtwaysxXVtya107XG5cdFx0XHQgZCA9IGFbczJdWzBdKm5kdVtya11bcGtdO1xuXHRcdCB9XG5cdFx0IGoxID0gLXJrO1xuXHRcdCBpZihyaz49LTEpIGoxID0gMTtcblx0XHQgajI9ZGVncmVlLXI7XG5cdFx0IGlmKHItMSA8PXBrKSBqMiA9IGstMTtcblx0XHQgXG5cdFx0IGZvcihqPWoxO2o8PWoyOysraikge1xuXHRcdFx0IGFbczJdW2pdID0gKGFbczFdW2pdLWFbczFdW2otMV0pL25kdVtwaysxXVtyaytqXTtcblx0XHRcdCBkICs9IGFbczJdW2pdKm5kdVtyaytqXVtwa107XG5cdFx0IH1cblx0XHQgaWYocjw9cGspIHtcblx0XHRcdCBhW3MyXVtrXSA9IC1hW3MxXVtrLTFdL25kdVtwaysxXVtyXTtcblx0XHRcdCBkICs9IGFbczJdW2tdKm5kdVtyXVtwa107XG5cdFx0IH1cblx0XHQgbnVyYnMuZGVyaXZlQmFzaXNGdW5jc1trXVtyXSA9IGQ7XG5cdFx0IHRlbXAgPXMxO1xuXHRcdCBzMSA9IHMyO1xuXHRcdCBzMiA9IHRlbXA7XHQgXG5cdCB9XG5cdH1cblx0ciA9IGRlZ3JlZTtcblx0Zm9yKGs9MTtrPD1kZXI7KytrKSB7XG5cdCBmb3Ioaj0wO2o8PWRlZ3JlZTsrK2opIG51cmJzLmRlcml2ZUJhc2lzRnVuY3Nba11bal0gKj0gcjsgXG5cdCByICo9IChkZWdyZWUtayk7XG5cdH1cblx0cmV0dXJuIG51cmJzLmRlcml2ZUJhc2lzRnVuY3M7XG59XG5cbm51cmJzLmNpcmNsZVB0ID0gZnVuY3Rpb24oY2VuLHJhZGl1cykge1xuXG5cdHZhciBjcnYgPSBudXJicy5jcmVhdGVDcnYoKTtcblx0Y3J2LmNvbnRyb2xQdHMgPSBbXTtcblx0Y3J2LmRlZ3JlZSA9IDI7XG5cdGNydi5rbm90cyA9IFswLDAsMCxNYXRoLlBJKjAuNSxNYXRoLlBJKjAuNSwgTWF0aC5QSSwgTWF0aC5QSSwgTWF0aC5QSSoxLjUsIE1hdGguUEkqMS41LCBNYXRoLlBJKjIsIE1hdGguUEkqMixNYXRoLlBJKjJdO1xuXHR2YXIgU1FSVDIgPSBNYXRoLnNxcnQoMi4wKSowLjU7XG5cdGNydi5jb250cm9sUHRzID0gWyB2ZWM0LmNyZWF0ZShbY2VuWzBdK3JhZGl1cyxjZW5bMV0sY2VuWzJdLDFdKSxcblx0XHR2ZWM0LmNyZWF0ZShbKGNlblswXStyYWRpdXMpKlNRUlQyLChjZW5bMV0rcmFkaXVzKSpTUVJUMixjZW5bMl0qU1FSVDIsU1FSVDJdKSxcblx0XHR2ZWM0LmNyZWF0ZShbY2VuWzBdLGNlblsxXStyYWRpdXMsY2VuWzJdLDFdKSxcblx0XHR2ZWM0LmNyZWF0ZShbKGNlblswXS1yYWRpdXMpKlNRUlQyLChjZW5bMV0rcmFkaXVzKSpTUVJUMixjZW5bMl0qU1FSVDIsU1FSVDJdKSxcblx0XHR2ZWM0LmNyZWF0ZShbY2VuWzBdLXJhZGl1cyxjZW5bMV0sY2VuWzJdLDFdKSxcblx0XHR2ZWM0LmNyZWF0ZShbKGNlblswXS1yYWRpdXMpKlNRUlQyLChjZW5bMV0tcmFkaXVzKSpTUVJUMixjZW5bMl0qU1FSVDIsU1FSVDJdKSxcblx0XHR2ZWM0LmNyZWF0ZShbY2VuWzBdLGNlblsxXS1yYWRpdXMsY2VuWzJdLDFdKSxcblx0XHR2ZWM0LmNyZWF0ZShbKGNlblswXStyYWRpdXMpKlNRUlQyLChjZW5bMV0tcmFkaXVzKSpTUVJUMixjZW5bMl0qU1FSVDIsU1FSVDJdKSxcblx0XHR2ZWM0LmNyZWF0ZShbY2VuWzBdK3JhZGl1cyxjZW5bMV0sY2VuWzJdLDFdKSBdO1xuXHRyZXR1cm4gY3J2O1xufVx0XG5cblxuLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy9OVVJCUyBTVVJGQUNFU1xuLy9cbm51cmJzLmNyZWF0ZVNyZiA9IGZ1bmN0aW9uKCkge1xuXHR2YXIgc3JmID0ge307XG5cdHNyZi5rbm90c1UgPSBbXTtcblx0c3JmLmtub3RzViA9IFtdO1xuXHRzcmYuY29udHJvbFB0cyA9IFtdO1xuXHRzcmYuZGVncmVlVSA9IFtdO1xuXHRzcmYuZGVncmVlViA9IFtdO1xuXHRyZXR1cm4gc3JmO1xufVxuXG5cbm51cmJzLmV2YWx1YXRlU3JmID0gZnVuY3Rpb24oc3JmLHUsdixwdCkge1xuXHRwdCA9IHB0IHx8IHZlYzMuY3JlYXRlKCk7XG5cdC8vaWYoY29udHJvbFB0cy5sZW5ndGggPT0gMCkgcmV0dXJuIG5ldyBQVmVjdG9yKCk7XG5cdHZhciB1S25vdCA9IG51cmJzLmZpbmRLbm90KHNyZi5rbm90c1UsdSxzcmYuZGVncmVlVSk7XG5cdHZhciB2S25vdCA9IG51cmJzLmZpbmRLbm90KHNyZi5rbm90c1YsdixzcmYuZGVncmVlVik7XG5cdG51cmJzLmJhc2lzRnVuY3Rpb25zKHNyZi5rbm90c1UsIHNyZi5kZWdyZWVVLCB1S25vdCx1LG51cmJzLmJhc2lzRnVuY3NVKTtcblx0bnVyYnMuYmFzaXNGdW5jdGlvbnMoc3JmLmtub3RzViwgc3JmLmRlZ3JlZVYsIHZLbm90LHYsbnVyYnMuYmFzaXNGdW5jc1YpO1xuXHRcblx0dmFyIGV2YWxQdCA9IHZlYzQuY3JlYXRlKCk7XG5cdHZhciB0ZW1wID0gW107XG5cdHZhciBpLGo7XG5cdC8vYXZvaWQgY3JlYXRlIGNvbW1hbmRzXG5cdGZvcihpPTA7aTw9c3JmLmRlZ3JlZVY7KytpKSB7XG5cdFx0dGVtcFtpXSA9IHZlYzQuY3JlYXRlKCk7XG5cdFx0Zm9yKGo9MDtqPD1zcmYuZGVncmVlVTsrK2opIHtcblx0XHRcdHZlYzQuYWRkKHRlbXBbaV0sdmVjNC5zY2FsZShzcmYuY29udHJvbFB0c1t1S25vdC1zcmYuZGVncmVlVStqXVt2S25vdC1zcmYuZGVncmVlVitpXSwgbnVyYnMuYmFzaXNGdW5jc1Vbal0sZXZhbFB0KSk7XG5cdFx0fVxuXHR9XG5cdFxuXHR2ZWM0LnNldChbMCwwLDAsMF0sZXZhbFB0KTtcblx0Zm9yKGk9MDtpPD1zcmYuZGVncmVlVjsrK2kpIHtcblx0XHR2ZWM0LmFkZChldmFsUHQsIHZlYzQuc2NhbGUodGVtcFtpXSxudXJicy5iYXNpc0Z1bmNzVltpXSkpO1xuXHR9XG5cdHJldHVybiB2ZWM0LnByb2plY3REb3duKGV2YWxQdCxwdCk7XG59XG5cdC8qXG5cblx0TnVyYnNDdXJ2ZSBpc29jdXJ2ZShmbG9hdCB1LCBib29sZWFuIGRpcikge1xuXHRcdGludCB1S25vdCA9IGZpbmRLbm90KHUsa25vdHNVLGRlZ3JlZVUpO1xuXHRcdGZsb2F0W10gYmFzRnVuYyA9IGJhc2lzRnVuY3Rpb25zKHVLbm90LHUsa25vdHNVLGRlZ3JlZVUpO1xuXHRcdFZlY3RvcjREW11bXSBoUHRzID0gbmV3IFZlY3RvcjREW2RlZ3JlZVUrMV1bZGVncmVlVisxXTtcblx0XHRmb3IoaW50IGk9MDtpPGNvbnRyb2xQdHMubGVuZ3RoOysraSkge1xuXHRcdFx0Zm9yKGludCBqPTA7ajxjb250cm9sUHRzWzBdLmxlbmd0aDsrK2opIHtcblx0XHRcdFx0UFZlY3RvciBjdHJsUHQgPSBjb250cm9sUHRzW2ldW2pdO1xuXHRcdFx0XHRmbG9hdCB3ID0gd2VpZ2h0c1tpXVtqXTtcblx0XHRcdFx0aFB0c1tpXVtqXSA9IG5ldyBWZWN0b3I0RChjdHJsUHQueCp3LCBjdHJsUHQueSp3LGN0cmxQdC56Kncsdyk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdFZlY3RvcjREW10gbmV3UHRzID0gbmV3IFZlY3RvcjREW2NvbnRyb2xQdHNbMF0ubGVuZ3RoXTtcblx0XHRmb3IoaW50IGk9MDtpPGNvbnRyb2xQdHNbMF0ubGVuZ3RoOysraSkge1xuXHRcdFx0Zm9yKGludCBqPTA7ajw9ZGVncmVlVTsrK2opIHtcblx0XHRcdFx0bmV3UHRzW2ldID0gVmVjdG9yNEQuYWRkKG5ld1B0c1tpXSxWZWN0b3I0RC5tdWx0aXBseShoUHRzW3VLbm90LWRlZ3JlZVUral1baV0sIGJhc0Z1bmNbal0pKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0XG5cdFx0UFZlY3RvcltdIG5ld0NQdHMgPSBuZXcgUFZlY3RvcltuZXdQdHMubGVuZ3RoXTtcblx0XHRmbG9hdFtdIG5ld1dlaWdodHMgPSBuZXcgZmxvYXRbbmV3UHRzLmxlbmd0aF07XG5cdFx0Zm9yKGludCBpPTA7aTxuZXdQdHMubGVuZ3RoOysraSkge1xuXHRcdFx0bmV3Q1B0c1tpXSA9IG5ldyBQVmVjdG9yKG5ld1B0c1tpXS54Km5ld1B0c1tpXS53LG5ld1B0c1tpXS55Km5ld1B0c1tpXS53LG5ld1B0c1tpXS56Km5ld1B0c1tpXS53KTtcblx0XHRcdG5ld1dlaWdodHNbaV0gPSBuZXdQdHNbaV0udztcblx0XHR9XG5cdFx0cmV0dXJuIG5ldyBOdXJic0N1cnZlKG5ld0NQdHMsIGtub3RzViwgbmV3V2VpZ2h0cywgZGVncmVlVik7XG5cdH1cblx0XG5cdCovXG5cdFxubnVyYnMubG9mdCA9IGZ1bmN0aW9uKGNydjEsY3J2Mikge1xuXHQvL2RvIGRlZ3JlZSBlbGV2YXRpb25cblx0aWYoY3J2MS5kZWdyZWUgIT0gY3J2Mi5kZWdyZWUpIHJldHVybiBudWxsO1xuXHR2YXIgdGVtcDEgPSBudXJicy5jb3B5Q3J2KGNydjEpO1xuXHR2YXIgdGVtcDIgPSBudXJicy5jb3B5Q3J2KGNydjIpO1xuXHRudXJicy5ub3JtYWxpemVLbm90cyh0ZW1wMSk7XG5cdG51cmJzLm5vcm1hbGl6ZUtub3RzKHRlbXAyKTtcblx0Ly9maW5kIGRpZmZlcmVuY2Vcblx0dmFyIGsgPSAwLGk7XG5cdHZhciBpbnNlcnRUZW1wMSA9IFtdO1xuXHR2YXIgaW5zZXJ0VGVtcDIgPSBbXTtcblx0Zm9yKGk9MDtpPHRlbXAxLmtub3RzLmxlbmd0aDsrK2kpIHtcblx0XHR3aGlsZShrIDwgdGVtcDIua25vdHMubGVuZ3RoICYmIHRlbXAyLmtub3RzW2tdIDwgdGVtcDEua25vdHNbaV0gKSB7XG5cdFx0XHRpbnNlcnRUZW1wMS5wdXNoKHRlbXAyLmtub3RzW2tdKTtcblx0XHRcdCsraztcblx0XHR9XG5cdFx0aWYodGVtcDIua25vdHNba10gPiB0ZW1wMS5rbm90c1tpXSkgaW5zZXJ0VGVtcDIucHVzaCh0ZW1wMS5rbm90c1tpXSk7XG5cdFx0aWYodGVtcDIua25vdHNba10gPT0gdGVtcDEua25vdHNbaV0pICsraztcblx0fVxuXHR3aGlsZShrPHRlbXAyLmtub3RzLmxlbmd0aCkge1xuXHRcdGluc2VydFRlbXAxLnB1c2godGVtcDIua25vdHNba10pO1xuXHRcdCsraztcblx0fVxuXHRpZihpbnNlcnRUZW1wMS5sZW5ndGggPiAwKSBudXJicy5pbnNlcnRLbm90cyh0ZW1wMSxpbnNlcnRUZW1wMSk7XG5cdGlmKGluc2VydFRlbXAyLmxlbmd0aCA+IDApIG51cmJzLmluc2VydEtub3RzKHRlbXAyLGluc2VydFRlbXAyKTtcblx0XG5cdHZhciBwdHMgPSBuZXcgQXJyYXkodGVtcDEuY29udHJvbFB0cy5sZW5ndGgpO1xuXHRmb3IoaT0wO2k8cHRzLmxlbmd0aDsrK2kpIHtcblx0XHRwdHNbaV0gPSBbdGVtcDEuY29udHJvbFB0c1tpXSwgdGVtcDIuY29udHJvbFB0c1tpXV07XG5cdH1cblx0XG5cdHZhciB0b1JldHVybiA9IG51cmJzLmNyZWF0ZVNyZigpO1xuXHR0b1JldHVybi5jb250cm9sUHRzID0gcHRzO1xuXHR0b1JldHVybi5kZWdyZWVVID0gdGVtcDEuZGVncmVlO1xuXHR0b1JldHVybi5kZWdyZWVWID0gMTtcblx0dG9SZXR1cm4ua25vdHNWID0gWzAsMCwxLDFdOyAvL3RoaXMgbWlnaHQgYmUgd3Jvbmdcblx0Zm9yKGk9MDtpPHRlbXAxLmtub3RzLmxlbmd0aDsrK2kpIHtcblx0XHR0b1JldHVybi5rbm90c1VbaV0gPSB0ZW1wMS5rbm90c1tpXTtcblx0fVxuXHRyZXR1cm4gdG9SZXR1cm47XG59XG5cbi8vcmV2b2x2ZVxubnVyYnMucmV2b2x2ZSA9IGZ1bmN0aW9uKGNydiwgYXhpcykge1xuXG59XG5cbm51cmJzLnN3ZWVwID0gZnVuY3Rpb24oY3J2MSxjcnYyKSB7XG5cbn0iLCIvKlxuICogUG9seTJUcmkgQ29weXJpZ2h0IChjKSAyMDA5LTIwMTMsIFBvbHkyVHJpIENvbnRyaWJ1dG9yc1xuICogaHR0cDovL2NvZGUuZ29vZ2xlLmNvbS9wL3BvbHkydHJpL1xuICpcbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogUmVkaXN0cmlidXRpb24gYW5kIHVzZSBpbiBzb3VyY2UgYW5kIGJpbmFyeSBmb3Jtcywgd2l0aCBvciB3aXRob3V0IG1vZGlmaWNhdGlvbixcbiAqIGFyZSBwZXJtaXR0ZWQgcHJvdmlkZWQgdGhhdCB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnMgYXJlIG1ldDpcbiAqXG4gKiAqIFJlZGlzdHJpYnV0aW9ucyBvZiBzb3VyY2UgY29kZSBtdXN0IHJldGFpbiB0aGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSxcbiAqICAgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lci5cbiAqICogUmVkaXN0cmlidXRpb25zIGluIGJpbmFyeSBmb3JtIG11c3QgcmVwcm9kdWNlIHRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlLFxuICogICB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyIGluIHRoZSBkb2N1bWVudGF0aW9uXG4gKiAgIGFuZC9vciBvdGhlciBtYXRlcmlhbHMgcHJvdmlkZWQgd2l0aCB0aGUgZGlzdHJpYnV0aW9uLlxuICogKiBOZWl0aGVyIHRoZSBuYW1lIG9mIFBvbHkyVHJpIG5vciB0aGUgbmFtZXMgb2YgaXRzIGNvbnRyaWJ1dG9ycyBtYXkgYmVcbiAqICAgdXNlZCB0byBlbmRvcnNlIG9yIHByb21vdGUgcHJvZHVjdHMgZGVyaXZlZCBmcm9tIHRoaXMgc29mdHdhcmUgd2l0aG91dCBzcGVjaWZpY1xuICogICBwcmlvciB3cml0dGVuIHBlcm1pc3Npb24uXG4gKlxuICogVEhJUyBTT0ZUV0FSRSBJUyBQUk9WSURFRCBCWSBUSEUgQ09QWVJJR0hUIEhPTERFUlMgQU5EIENPTlRSSUJVVE9SU1xuICogXCJBUyBJU1wiIEFORCBBTlkgRVhQUkVTUyBPUiBJTVBMSUVEIFdBUlJBTlRJRVMsIElOQ0xVRElORywgQlVUIE5PVFxuICogTElNSVRFRCBUTywgVEhFIElNUExJRUQgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFkgQU5EIEZJVE5FU1MgRk9SXG4gKiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBUkUgRElTQ0xBSU1FRC4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFIENPUFlSSUdIVCBPV05FUiBPUlxuICogQ09OVFJJQlVUT1JTIEJFIExJQUJMRSBGT1IgQU5ZIERJUkVDVCwgSU5ESVJFQ1QsIElOQ0lERU5UQUwsIFNQRUNJQUwsXG4gKiBFWEVNUExBUlksIE9SIENPTlNFUVVFTlRJQUwgREFNQUdFUyAoSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sXG4gKiBQUk9DVVJFTUVOVCBPRiBTVUJTVElUVVRFIEdPT0RTIE9SIFNFUlZJQ0VTOyBMT1NTIE9GIFVTRSwgREFUQSwgT1JcbiAqIFBST0ZJVFM7IE9SIEJVU0lORVNTIElOVEVSUlVQVElPTikgSE9XRVZFUiBDQVVTRUQgQU5EIE9OIEFOWSBUSEVPUlkgT0ZcbiAqIExJQUJJTElUWSwgV0hFVEhFUiBJTiBDT05UUkFDVCwgU1RSSUNUIExJQUJJTElUWSwgT1IgVE9SVCAoSU5DTFVESU5HXG4gKiBORUdMSUdFTkNFIE9SIE9USEVSV0lTRSkgQVJJU0lORyBJTiBBTlkgV0FZIE9VVCBPRiBUSEUgVVNFIE9GIFRISVNcbiAqIFNPRlRXQVJFLCBFVkVOIElGIEFEVklTRUQgT0YgVEhFIFBPU1NJQklMSVRZIE9GIFNVQ0ggREFNQUdFLlxuICovXG5cbi8qIGpzaGludCBicm93c2VyOmZhbHNlLCBmb3Jpbjp0cnVlLCBub2FyZzp0cnVlLCBub2VtcHR5OnRydWUsIGVxZXFlcTp0cnVlLCBiaXR3aXNlOnRydWUsIFxuICAgc3RyaWN0OnRydWUsIHVuZGVmOnRydWUsIHVudXNlZDp0cnVlLCBjdXJseTp0cnVlLCBpbW1lZDp0cnVlLCBsYXRlZGVmOnRydWUsIFxuICAgbmV3Y2FwOnRydWUsIHRyYWlsaW5nOnRydWUsIG1heGNvbXBsZXhpdHk6MTEsIGluZGVudDo0IFxuICovXG5cbi8qXG4gIGVkaXRlZCBieSBOZXJ2b3VzIFN5c3RlbSwgMjAxNFxuKi9cblxuLypcbiAqIE5vdGVcbiAqID09PT1cbiAqIHRoZSBzdHJ1Y3R1cmUgb2YgdGhpcyBKYXZhU2NyaXB0IHZlcnNpb24gb2YgcG9seTJ0cmkgaW50ZW50aW9ubmFseSBmb2xsb3dzXG4gKiBhcyBjbG9zZWx5IGFzIHBvc3NpYmxlIHRoZSBzdHJ1Y3R1cmUgb2YgdGhlIHJlZmVyZW5jZSBDKysgdmVyc2lvbiwgdG8gbWFrZSBpdCBcbiAqIGVhc2llciB0byBrZWVwIHRoZSAyIHZlcnNpb25zIGluIHN5bmMuXG4gKi9cblxuXG4vKipcbiAqIE1vZHVsZSBlbmNhcHN1bGF0aW9uXG4gKiBAcGFyYW0ge09iamVjdH0gZ2xvYmFsIGEgcmVmZXJlbmNlIHRvIHRoZSBnbG9iYWwgb2JqZWN0IDpcbiAqICAgICAgICAgICAgICAgICAgICAgIHdpbmRvdyBpbiB0aGUgYnJvd3NlciwgZ2xvYmFsIG9uIHRoZSBzZXJ2ZXJcbiAqL1xuKGZ1bmN0aW9uKGdsb2JhbCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLXBvbHkydHJpIG1vZHVsZVxuXG4gICAgLy8gU2F2ZSB0aGUgcHJldmlvdXMgdmFsdWUgb2YgdGhlIHBvbHkydHJpIHZhcmlhYmxlLCBcbiAgICAvLyBzbyB0aGF0IGl0IGNhbiBiZSByZXN0b3JlZCBsYXRlciBvbiwgaWYgbm9Db25mbGljdCBpcyB1c2VkLlxuICAgIFxuICAgIHZhciBwcmV2aW91c1BvbHkydHJpID0gZ2xvYmFsLnBvbHkydHJpO1xuXG4gICAgLy8gVGhlIHRvcC1sZXZlbCBuYW1lc3BhY2UuIEFsbCBwdWJsaWMgcG9seTJ0cmkgY2xhc3NlcyBhbmQgZnVuY3Rpb25zIHdpbGxcbiAgICAvLyBiZSBhdHRhY2hlZCB0byBpdC4gRXhwb3J0ZWQgZm9yIGJvdGggdGhlIGJyb3dzZXIgYW5kIHRoZSBzZXJ2ZXIgKE5vZGUuanMpLlxuICAgIHZhciBwb2x5MnRyaTtcbiAgICAvKiBnbG9iYWwgZXhwb3J0cyAqL1xuICAgIFxuICAgIGlmICh0eXBlb2YgZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgcG9seTJ0cmkgPSBleHBvcnRzO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHBvbHkydHJpID0gZ2xvYmFsLnBvbHkydHJpID0ge307XG4gICAgfVxuXG4gICAgLy8gUnVucyB0aGUgbGlicmFyeSBpbiBub0NvbmZsaWN0IG1vZGUsIHJldHVybmluZyB0aGUgcG9seTJ0cmkgdmFyaWFibGUgXG4gICAgLy8gdG8gaXRzIHByZXZpb3VzIG93bmVyLiBSZXR1cm5zIGEgcmVmZXJlbmNlIHRvIHRoaXMgbGlicmFyeSBvYmplY3QuXG4gICAgcG9seTJ0cmkubm9Db25mbGljdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBnbG9iYWwucG9seTJ0cmkgPSBwcmV2aW91c1BvbHkydHJpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tUG9pbnRFcnJvclxuXG4gICAgLyoqXG4gICAgICogQ3VzdG9tIGV4Y2VwdGlvbiBjbGFzcyB0byBpbmRpY2F0ZSBpbnZhbGlkIFBvaW50IHZhbHVlc1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlICAgICAgICAgIGVycm9yIG1lc3NhZ2VcbiAgICAgKiBAcGFyYW0ge2FycmF5PFBvaW50Pn0gcG9pbnRzICAgICBpbnZhbGlkIHBvaW50c1xuICAgICAqL1xuICAgIC8vIENsYXNzIGFkZGVkIGluIHRoZSBKYXZhU2NyaXB0IHZlcnNpb24gKHdhcyBub3QgcHJlc2VudCBpbiB0aGUgYysrIHZlcnNpb24pXG4gICAgdmFyIFBvaW50RXJyb3IgPSBmdW5jdGlvbiAobWVzc2FnZSwgcG9pbnRzKSB7XG4gICAgICAgIHRoaXMubmFtZSAgICA9IFwiUG9pbnRFcnJvclwiO1xuICAgICAgICB0aGlzLnBvaW50cyAgPSBwb2ludHMgPSBwb2ludHMgfHwgW107XG4gICAgICAgIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2UgfHwgXCJJbnZhbGlkIFBvaW50cyFcIjtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwb2ludHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMubWVzc2FnZSArPSBcIiBcIiArIFBvaW50LnRvU3RyaW5nKHBvaW50c1tpXSk7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIFBvaW50RXJyb3IucHJvdG90eXBlID0gbmV3IEVycm9yKCk7XG4gICAgUG9pbnRFcnJvci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBQb2ludEVycm9yO1xuXG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVBvaW50XG4gICAgLyoqXG4gICAgICogQ29uc3RydWN0IGEgcG9pbnRcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geCAgICBjb29yZGluYXRlICgwIGlmIHVuZGVmaW5lZClcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geSAgICBjb29yZGluYXRlICgwIGlmIHVuZGVmaW5lZClcbiAgICAgKi9cbiAgICB2YXIgUG9pbnQgPSBmdW5jdGlvbih4LCB5KSB7XG4gICAgICAgIHRoaXMueCA9ICt4IHx8IDA7XG4gICAgICAgIHRoaXMueSA9ICt5IHx8IDA7XG5cbiAgICAgICAgLy8gQWxsIGV4dHJhIGZpZWxkcyBhZGRlZCB0byBQb2ludCBhcmUgcHJlZml4ZWQgd2l0aCBfcDJ0X1xuICAgICAgICAvLyB0byBhdm9pZCBjb2xsaXNpb25zIGlmIGN1c3RvbSBQb2ludCBjbGFzcyBpcyB1c2VkLlxuXG4gICAgICAgIC8vIFRoZSBlZGdlcyB0aGlzIHBvaW50IGNvbnN0aXR1dGVzIGFuIHVwcGVyIGVuZGluZyBwb2ludFxuICAgICAgICB0aGlzLl9wMnRfZWRnZV9saXN0ID0gbnVsbDtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogRm9yIHByZXR0eSBwcmludGluZyBleC4gPGk+XCIoNTs0MilcIjwvaT4pXG4gICAgICovXG4gICAgUG9pbnQucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoXCIoXCIgKyB0aGlzLnggKyBcIjtcIiArIHRoaXMueSArIFwiKVwiKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIGNvcHkgb2YgdGhpcyBQb2ludCBvYmplY3QuXG4gICAgICogQHJldHVybnMgUG9pbnRcbiAgICAgKi9cbiAgICBQb2ludC5wcm90b3R5cGUuY2xvbmUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQb2ludCh0aGlzLngsIHRoaXMueSk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFNldCB0aGlzIFBvaW50IGluc3RhbmNlIHRvIHRoZSBvcmlnby4gPGNvZGU+KDA7IDApPC9jb2RlPlxuICAgICAqL1xuICAgIFBvaW50LnByb3RvdHlwZS5zZXRfemVybyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLnggPSAwLjA7XG4gICAgICAgIHRoaXMueSA9IDAuMDtcbiAgICAgICAgcmV0dXJuIHRoaXM7IC8vIGZvciBjaGFpbmluZ1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIGNvb3JkaW5hdGVzIG9mIHRoaXMgaW5zdGFuY2UuXG4gICAgICogQHBhcmFtICAgeCAgIG51bWJlci5cbiAgICAgKiBAcGFyYW0gICB5ICAgbnVtYmVyO1xuICAgICAqL1xuICAgIFBvaW50LnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbih4LCB5KSB7XG4gICAgICAgIHRoaXMueCA9ICt4IHx8IDA7XG4gICAgICAgIHRoaXMueSA9ICt5IHx8IDA7XG4gICAgICAgIHJldHVybiB0aGlzOyAvLyBmb3IgY2hhaW5pbmdcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogTmVnYXRlIHRoaXMgUG9pbnQgaW5zdGFuY2UuIChjb21wb25lbnQtd2lzZSlcbiAgICAgKi9cbiAgICBQb2ludC5wcm90b3R5cGUubmVnYXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMueCA9IC10aGlzLng7XG4gICAgICAgIHRoaXMueSA9IC10aGlzLnk7XG4gICAgICAgIHJldHVybiB0aGlzOyAvLyBmb3IgY2hhaW5pbmdcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQWRkIGFub3RoZXIgUG9pbnQgb2JqZWN0IHRvIHRoaXMgaW5zdGFuY2UuIChjb21wb25lbnQtd2lzZSlcbiAgICAgKiBAcGFyYW0gICBuICAgUG9pbnQgb2JqZWN0LlxuICAgICAqL1xuICAgIFBvaW50LnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbihuKSB7XG4gICAgICAgIHRoaXMueCArPSBuLng7XG4gICAgICAgIHRoaXMueSArPSBuLnk7XG4gICAgICAgIHJldHVybiB0aGlzOyAvLyBmb3IgY2hhaW5pbmdcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogU3VidHJhY3QgdGhpcyBQb2ludCBpbnN0YW5jZSB3aXRoIGFub3RoZXIgcG9pbnQgZ2l2ZW4uIChjb21wb25lbnQtd2lzZSlcbiAgICAgKiBAcGFyYW0gICBuICAgUG9pbnQgb2JqZWN0LlxuICAgICAqL1xuICAgIFBvaW50LnByb3RvdHlwZS5zdWIgPSBmdW5jdGlvbihuKSB7XG4gICAgICAgIHRoaXMueCAtPSBuLng7XG4gICAgICAgIHRoaXMueSAtPSBuLnk7XG4gICAgICAgIHJldHVybiB0aGlzOyAvLyBmb3IgY2hhaW5pbmdcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogTXVsdGlwbHkgdGhpcyBQb2ludCBpbnN0YW5jZSBieSBhIHNjYWxhci4gKGNvbXBvbmVudC13aXNlKVxuICAgICAqIEBwYXJhbSAgIHMgICBzY2FsYXIuXG4gICAgICovXG4gICAgUG9pbnQucHJvdG90eXBlLm11bCA9IGZ1bmN0aW9uKHMpIHtcbiAgICAgICAgdGhpcy54ICo9IHM7XG4gICAgICAgIHRoaXMueSAqPSBzO1xuICAgICAgICByZXR1cm4gdGhpczsgLy8gZm9yIGNoYWluaW5nXG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFJldHVybiB0aGUgZGlzdGFuY2Ugb2YgdGhpcyBQb2ludCBpbnN0YW5jZSBmcm9tIHRoZSBvcmlnby5cbiAgICAgKi9cbiAgICBQb2ludC5wcm90b3R5cGUubGVuZ3RoID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBNYXRoLnNxcnQodGhpcy54ICogdGhpcy54ICsgdGhpcy55ICogdGhpcy55KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogTm9ybWFsaXplIHRoaXMgUG9pbnQgaW5zdGFuY2UgKGFzIGEgdmVjdG9yKS5cbiAgICAgKiBAcmV0dXJuIFRoZSBvcmlnaW5hbCBkaXN0YW5jZSBvZiB0aGlzIGluc3RhbmNlIGZyb20gdGhlIG9yaWdvLlxuICAgICAqL1xuICAgIFBvaW50LnByb3RvdHlwZS5ub3JtYWxpemUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoKCk7XG4gICAgICAgIHRoaXMueCAvPSBsZW47XG4gICAgICAgIHRoaXMueSAvPSBsZW47XG4gICAgICAgIHJldHVybiBsZW47XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFRlc3QgdGhpcyBQb2ludCBvYmplY3Qgd2l0aCBhbm90aGVyIGZvciBlcXVhbGl0eS5cbiAgICAgKiBAcGFyYW0gICBwICAgYW55IFwiUG9pbnQgbGlrZVwiIG9iamVjdCB3aXRoIHt4LHl9IChkdWNrIHR5cGluZylcbiAgICAgKiBAcmV0dXJuIDxjb2RlPlRydWU8L2NvZGU+IGlmIDxjb2RlPnRoaXMgPT0gcDwvY29kZT4sIDxjb2RlPmZhbHNlPC9jb2RlPiBvdGhlcndpc2UuXG4gICAgICovXG4gICAgUG9pbnQucHJvdG90eXBlLmVxdWFscyA9IGZ1bmN0aW9uKHApIHtcbiAgICAgICAgcmV0dXJuIHRoaXMueCA9PT0gcC54ICYmIHRoaXMueSA9PT0gcC55O1xuICAgIH07XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tUG9pbnQgKFwic3RhdGljXCIgbWV0aG9kcylcblxuICAgIC8qKlxuICAgICAqIE5lZ2F0ZSBhIHBvaW50IGNvbXBvbmVudC13aXNlIGFuZCByZXR1cm4gdGhlIHJlc3VsdCBhcyBhIG5ldyBQb2ludCBvYmplY3QuXG4gICAgICogQHBhcmFtICAgcCAgIFBvaW50IG9iamVjdC5cbiAgICAgKiBAcmV0dXJuIHRoZSByZXN1bHRpbmcgUG9pbnQgb2JqZWN0LlxuICAgICAqL1xuICAgIFBvaW50Lm5lZ2F0ZSA9IGZ1bmN0aW9uKHApIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQb2ludCgtcC54LCAtcC55KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQWRkIHR3byBwb2ludHMgY29tcG9uZW50LXdpc2UgYW5kIHJldHVybiB0aGUgcmVzdWx0IGFzIGEgbmV3IFBvaW50IG9iamVjdC5cbiAgICAgKiBAcGFyYW0gICBhICAgUG9pbnQgb2JqZWN0LlxuICAgICAqIEBwYXJhbSAgIGIgICBQb2ludCBvYmplY3QuXG4gICAgICogQHJldHVybiB0aGUgcmVzdWx0aW5nIFBvaW50IG9iamVjdC5cbiAgICAgKi9cbiAgICBQb2ludC5hZGQgPSBmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgIHJldHVybiBuZXcgUG9pbnQoYS54ICsgYi54LCBhLnkgKyBiLnkpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBTdWJ0cmFjdCB0d28gcG9pbnRzIGNvbXBvbmVudC13aXNlIGFuZCByZXR1cm4gdGhlIHJlc3VsdCBhcyBhIG5ldyBQb2ludCBvYmplY3QuXG4gICAgICogQHBhcmFtICAgYSAgIFBvaW50IG9iamVjdC5cbiAgICAgKiBAcGFyYW0gICBiICAgUG9pbnQgb2JqZWN0LlxuICAgICAqIEByZXR1cm4gdGhlIHJlc3VsdGluZyBQb2ludCBvYmplY3QuXG4gICAgICovXG4gICAgUG9pbnQuc3ViID0gZnVuY3Rpb24oYSwgYikge1xuICAgICAgICByZXR1cm4gbmV3IFBvaW50KGEueCAtIGIueCwgYS55IC0gYi55KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogTXVsdGlwbHkgYSBwb2ludCBieSBhIHNjYWxhciBhbmQgcmV0dXJuIHRoZSByZXN1bHQgYXMgYSBuZXcgUG9pbnQgb2JqZWN0LlxuICAgICAqIEBwYXJhbSAgIHMgICB0aGUgc2NhbGFyIChhIG51bWJlcikuXG4gICAgICogQHBhcmFtICAgcCAgIFBvaW50IG9iamVjdC5cbiAgICAgKiBAcmV0dXJuIHRoZSByZXN1bHRpbmcgUG9pbnQgb2JqZWN0LlxuICAgICAqL1xuICAgIFBvaW50Lm11bCA9IGZ1bmN0aW9uKHMsIHApIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQb2ludChzICogcC54LCBzICogcC55KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogUGVyZm9ybSB0aGUgY3Jvc3MgcHJvZHVjdCBvbiBlaXRoZXIgdHdvIHBvaW50cyAodGhpcyBwcm9kdWNlcyBhIHNjYWxhcilcbiAgICAgKiBvciBhIHBvaW50IGFuZCBhIHNjYWxhciAodGhpcyBwcm9kdWNlcyBhIHBvaW50KS5cbiAgICAgKiBUaGlzIGZ1bmN0aW9uIHJlcXVpcmVzIHR3byBwYXJhbWV0ZXJzLCBlaXRoZXIgbWF5IGJlIGEgUG9pbnQgb2JqZWN0IG9yIGFcbiAgICAgKiBudW1iZXIuXG4gICAgICogQHBhcmFtICAgYSAgIFBvaW50IG9iamVjdCBvciBzY2FsYXIuXG4gICAgICogQHBhcmFtICAgYiAgIFBvaW50IG9iamVjdCBvciBzY2FsYXIuXG4gICAgICogQHJldHVybiAgYSAgIFBvaW50IG9iamVjdCBvciBhIG51bWJlciwgZGVwZW5kaW5nIG9uIHRoZSBwYXJhbWV0ZXJzLlxuICAgICAqL1xuICAgIFBvaW50LmNyb3NzID0gZnVuY3Rpb24oYSwgYikge1xuICAgICAgICBpZiAodHlwZW9mKGEpID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgaWYgKHR5cGVvZihiKSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYSAqIGI7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUG9pbnQoLWEgKiBiLnksIGEgKiBiLngpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHR5cGVvZihiKSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFBvaW50KGIgKiBhLnksIC1iICogYS54KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGEueCAqIGIueSAtIGEueSAqIGIueDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cIlBvaW50LUxpa2VcIlxuICAgIC8qXG4gICAgICogVGhlIGZvbGxvd2luZyBmdW5jdGlvbnMgb3BlcmF0ZSBvbiBcIlBvaW50XCIgb3IgYW55IFwiUG9pbnQgbGlrZVwiIG9iamVjdCBcbiAgICAgKiB3aXRoIHt4LHl9IChkdWNrIHR5cGluZykuXG4gICAgICovXG5cblxuICAgIC8qKlxuICAgICAqIFBvaW50IHByZXR0eSBwcmludGluZyBleC4gPGk+XCIoNTs0MilcIjwvaT4pXG4gICAgICogQHBhcmFtICAgcCAgIGFueSBcIlBvaW50IGxpa2VcIiBvYmplY3Qgd2l0aCB7eCx5fSBcbiAgICAgKiBAcmV0dXJucyB7U3RyaW5nfVxuICAgICAqL1xuICAgIFBvaW50LnRvU3RyaW5nID0gZnVuY3Rpb24ocCkge1xuICAgICAgICAvLyBUcnkgYSBjdXN0b20gdG9TdHJpbmcgZmlyc3QsIGFuZCBmYWxsYmFjayB0byBQb2ludC5wcm90b3R5cGUudG9TdHJpbmcgaWYgbm9uZVxuICAgICAgICB2YXIgcyA9IHAudG9TdHJpbmcoKTtcbiAgICAgICAgcmV0dXJuIChzID09PSAnW29iamVjdCBPYmplY3RdJyA/IFBvaW50LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHApIDogcyk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIENvbXBhcmUgdHdvIHBvaW50cyBjb21wb25lbnQtd2lzZS5cbiAgICAgKiBAcGFyYW0gICBhLGIgICBhbnkgXCJQb2ludCBsaWtlXCIgb2JqZWN0cyB3aXRoIHt4LHl9IFxuICAgICAqIEByZXR1cm4gPGNvZGU+Jmx0OyAwPC9jb2RlPiBpZiA8Y29kZT5hICZsdDsgYjwvY29kZT4sIFxuICAgICAqICAgICAgICAgPGNvZGU+Jmd0OyAwPC9jb2RlPiBpZiA8Y29kZT5hICZndDsgYjwvY29kZT4sIFxuICAgICAqICAgICAgICAgPGNvZGU+MDwvY29kZT4gb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIFBvaW50LmNvbXBhcmUgPSBmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgIGlmIChhLnkgPT09IGIueSkge1xuICAgICAgICAgICAgcmV0dXJuIGEueCAtIGIueDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBhLnkgLSBiLnk7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIFBvaW50LmNtcCA9IFBvaW50LmNvbXBhcmU7IC8vIGJhY2t3YXJkIGNvbXBhdGliaWxpdHlcblxuICAgIC8qKlxuICAgICAqIFRlc3QgdHdvIFBvaW50IG9iamVjdHMgZm9yIGVxdWFsaXR5LlxuICAgICAqIEBwYXJhbSAgIGEsYiAgIGFueSBcIlBvaW50IGxpa2VcIiBvYmplY3RzIHdpdGgge3gseX0gXG4gICAgICogQHJldHVybiA8Y29kZT5UcnVlPC9jb2RlPiBpZiA8Y29kZT5hID09IGI8L2NvZGU+LCA8Y29kZT5mYWxzZTwvY29kZT4gb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIFBvaW50LmVxdWFscyA9IGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgICAgcmV0dXJuIGEueCA9PT0gYi54ICYmIGEueSA9PT0gYi55O1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBQZWZvcm0gdGhlIGRvdCBwcm9kdWN0IG9uIHR3byB2ZWN0b3JzLlxuICAgICAqIEBwYXJhbSAgIGEsYiAgIGFueSBcIlBvaW50IGxpa2VcIiBvYmplY3RzIHdpdGgge3gseX0gXG4gICAgICogQHJldHVybiBUaGUgZG90IHByb2R1Y3QgKGFzIGEgbnVtYmVyKS5cbiAgICAgKi9cbiAgICBQb2ludC5kb3QgPSBmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgIHJldHVybiBhLnggKiBiLnggKyBhLnkgKiBiLnk7XG4gICAgfTtcblxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tRWRnZVxuICAgIC8qKlxuICAgICAqIFJlcHJlc2VudHMgYSBzaW1wbGUgcG9seWdvbidzIGVkZ2VcbiAgICAgKiBAcGFyYW0ge1BvaW50fSBwMVxuICAgICAqIEBwYXJhbSB7UG9pbnR9IHAyXG4gICAgICovXG4gICAgdmFyIEVkZ2UgPSBmdW5jdGlvbihwMSwgcDIpIHtcbiAgICAgICAgdGhpcy5wID0gcDE7XG4gICAgICAgIHRoaXMucSA9IHAyO1xuXG4gICAgICAgIGlmIChwMS55ID4gcDIueSkge1xuICAgICAgICAgICAgdGhpcy5xID0gcDE7XG4gICAgICAgICAgICB0aGlzLnAgPSBwMjtcbiAgICAgICAgfSBlbHNlIGlmIChwMS55ID09PSBwMi55KSB7XG4gICAgICAgICAgICBpZiAocDEueCA+IHAyLngpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnEgPSBwMTtcbiAgICAgICAgICAgICAgICB0aGlzLnAgPSBwMjtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocDEueCA9PT0gcDIueCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBQb2ludEVycm9yKCdwb2x5MnRyaSBJbnZhbGlkIEVkZ2UgY29uc3RydWN0b3I6IHJlcGVhdGVkIHBvaW50cyEnLCBbcDFdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghIHRoaXMucS5fcDJ0X2VkZ2VfbGlzdCkge1xuICAgICAgICAgICAgdGhpcy5xLl9wMnRfZWRnZV9saXN0ID0gW107XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5xLl9wMnRfZWRnZV9saXN0LnB1c2godGhpcyk7XG4gICAgfTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tVHJpYW5nbGVcbiAgICAvKipcbiAgICAgKiBUcmlhbmdsZSBjbGFzcy48YnI+XG4gICAgICogVHJpYW5nbGUtYmFzZWQgZGF0YSBzdHJ1Y3R1cmVzIGFyZSBrbm93biB0byBoYXZlIGJldHRlciBwZXJmb3JtYW5jZSB0aGFuXG4gICAgICogcXVhZC1lZGdlIHN0cnVjdHVyZXMuXG4gICAgICogU2VlOiBKLiBTaGV3Y2h1aywgXCJUcmlhbmdsZTogRW5naW5lZXJpbmcgYSAyRCBRdWFsaXR5IE1lc2ggR2VuZXJhdG9yIGFuZFxuICAgICAqIERlbGF1bmF5IFRyaWFuZ3VsYXRvclwiLCBcIlRyaWFuZ3VsYXRpb25zIGluIENHQUxcIlxuICAgICAqIFxuICAgICAqIEBwYXJhbSAgIGEsYixjICAgYW55IFwiUG9pbnQgbGlrZVwiIG9iamVjdHMgd2l0aCB7eCx5fSAoZHVjayB0eXBpbmcpXG4gICAgICovXG4gICAgdmFyIFRyaWFuZ2xlID0gZnVuY3Rpb24oYSwgYiwgYykge1xuICAgICAgICAvLyBUcmlhbmdsZSBwb2ludHNcbiAgICAgICAgdGhpcy5wb2ludHNfID0gW2EsIGIsIGNdO1xuICAgICAgICAvLyBOZWlnaGJvciBsaXN0XG4gICAgICAgIHRoaXMubmVpZ2hib3JzXyA9IFtudWxsLCBudWxsLCBudWxsXTtcbiAgICAgICAgLy8gSGFzIHRoaXMgdHJpYW5nbGUgYmVlbiBtYXJrZWQgYXMgYW4gaW50ZXJpb3IgdHJpYW5nbGU/XG4gICAgICAgIHRoaXMuaW50ZXJpb3JfID0gZmFsc2U7XG4gICAgICAgIC8vIEZsYWdzIHRvIGRldGVybWluZSBpZiBhbiBlZGdlIGlzIGEgQ29uc3RyYWluZWQgZWRnZVxuICAgICAgICB0aGlzLmNvbnN0cmFpbmVkX2VkZ2UgPSBbZmFsc2UsIGZhbHNlLCBmYWxzZV07XG4gICAgICAgIC8vIEZsYWdzIHRvIGRldGVybWluZSBpZiBhbiBlZGdlIGlzIGEgRGVsYXVuZXkgZWRnZVxuICAgICAgICB0aGlzLmRlbGF1bmF5X2VkZ2UgPSBbZmFsc2UsIGZhbHNlLCBmYWxzZV07XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEZvciBwcmV0dHkgcHJpbnRpbmcgZXguIDxpPlwiWyg1OzQyKSgxMDsyMCkoMjE7MzApXVwiPC9pPilcbiAgICAgKi9cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHAycyA9IFBvaW50LnRvU3RyaW5nO1xuICAgICAgICByZXR1cm4gKFwiW1wiICsgcDJzKHRoaXMucG9pbnRzX1swXSkgKyBwMnModGhpcy5wb2ludHNfWzFdKSArIHAycyh0aGlzLnBvaW50c19bMl0pICsgXCJdXCIpO1xuICAgIH07XG5cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuZ2V0UG9pbnQgPSBmdW5jdGlvbihpbmRleCkge1xuICAgICAgICByZXR1cm4gdGhpcy5wb2ludHNfW2luZGV4XTtcbiAgICB9O1xuICAgIC8vIGZvciBiYWNrd2FyZCBjb21wYXRpYmlsaXR5XG4gICAgVHJpYW5nbGUucHJvdG90eXBlLkdldFBvaW50ID0gVHJpYW5nbGUucHJvdG90eXBlLmdldFBvaW50O1xuXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLmdldE5laWdoYm9yID0gZnVuY3Rpb24oaW5kZXgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubmVpZ2hib3JzX1tpbmRleF07XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFRlc3QgaWYgdGhpcyBUcmlhbmdsZSBjb250YWlucyB0aGUgUG9pbnQgb2JqZWN0IGdpdmVuIGFzIHBhcmFtZXRlcnMgYXMgaXRzXG4gICAgICogdmVydGljZXMuIE9ubHkgcG9pbnQgcmVmZXJlbmNlcyBhcmUgY29tcGFyZWQsIG5vdCB2YWx1ZXMuXG4gICAgICogQHJldHVybiA8Y29kZT5UcnVlPC9jb2RlPiBpZiB0aGUgUG9pbnQgb2JqZWN0IGlzIG9mIHRoZSBUcmlhbmdsZSdzIHZlcnRpY2VzLFxuICAgICAqICAgICAgICAgPGNvZGU+ZmFsc2U8L2NvZGU+IG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuY29udGFpbnNQb2ludCA9IGZ1bmN0aW9uKHBvaW50KSB7XG4gICAgICAgIHZhciBwb2ludHMgPSB0aGlzLnBvaW50c187XG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXG4gICAgICAgIHJldHVybiAocG9pbnQgPT09IHBvaW50c1swXSB8fCBwb2ludCA9PT0gcG9pbnRzWzFdIHx8IHBvaW50ID09PSBwb2ludHNbMl0pO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBUZXN0IGlmIHRoaXMgVHJpYW5nbGUgY29udGFpbnMgdGhlIEVkZ2Ugb2JqZWN0IGdpdmVuIGFzIHBhcmFtZXRlciBhcyBpdHNcbiAgICAgKiBib3VuZGluZyBlZGdlcy4gT25seSBwb2ludCByZWZlcmVuY2VzIGFyZSBjb21wYXJlZCwgbm90IHZhbHVlcy5cbiAgICAgKiBAcmV0dXJuIDxjb2RlPlRydWU8L2NvZGU+IGlmIHRoZSBFZGdlIG9iamVjdCBpcyBvZiB0aGUgVHJpYW5nbGUncyBib3VuZGluZ1xuICAgICAqICAgICAgICAgZWRnZXMsIDxjb2RlPmZhbHNlPC9jb2RlPiBvdGhlcndpc2UuXG4gICAgICovXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLmNvbnRhaW5zRWRnZSA9IGZ1bmN0aW9uKGVkZ2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29udGFpbnNQb2ludChlZGdlLnApICYmIHRoaXMuY29udGFpbnNQb2ludChlZGdlLnEpO1xuICAgIH07XG4gICAgVHJpYW5nbGUucHJvdG90eXBlLmNvbnRhaW5zUG9pbnRzID0gZnVuY3Rpb24ocDEsIHAyKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNvbnRhaW5zUG9pbnQocDEpICYmIHRoaXMuY29udGFpbnNQb2ludChwMik7XG4gICAgfTtcblxuXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLmlzSW50ZXJpb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaW50ZXJpb3JfO1xuICAgIH07XG4gICAgVHJpYW5nbGUucHJvdG90eXBlLnNldEludGVyaW9yID0gZnVuY3Rpb24oaW50ZXJpb3IpIHtcbiAgICAgICAgdGhpcy5pbnRlcmlvcl8gPSBpbnRlcmlvcjtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZSBuZWlnaGJvciBwb2ludGVycy5cbiAgICAgKiBAcGFyYW0ge1BvaW50fSBwMSBQb2ludCBvYmplY3QuXG4gICAgICogQHBhcmFtIHtQb2ludH0gcDIgUG9pbnQgb2JqZWN0LlxuICAgICAqIEBwYXJhbSB7VHJpYW5nbGV9IHQgVHJpYW5nbGUgb2JqZWN0LlxuICAgICAqL1xuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5tYXJrTmVpZ2hib3JQb2ludGVycyA9IGZ1bmN0aW9uKHAxLCBwMiwgdCkge1xuICAgICAgICB2YXIgcG9pbnRzID0gdGhpcy5wb2ludHNfO1xuICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlc1xuICAgICAgICBpZiAoKHAxID09PSBwb2ludHNbMl0gJiYgcDIgPT09IHBvaW50c1sxXSkgfHwgKHAxID09PSBwb2ludHNbMV0gJiYgcDIgPT09IHBvaW50c1syXSkpIHtcbiAgICAgICAgICAgIHRoaXMubmVpZ2hib3JzX1swXSA9IHQ7XG4gICAgICAgIH0gZWxzZSBpZiAoKHAxID09PSBwb2ludHNbMF0gJiYgcDIgPT09IHBvaW50c1syXSkgfHwgKHAxID09PSBwb2ludHNbMl0gJiYgcDIgPT09IHBvaW50c1swXSkpIHtcbiAgICAgICAgICAgIHRoaXMubmVpZ2hib3JzX1sxXSA9IHQ7XG4gICAgICAgIH0gZWxzZSBpZiAoKHAxID09PSBwb2ludHNbMF0gJiYgcDIgPT09IHBvaW50c1sxXSkgfHwgKHAxID09PSBwb2ludHNbMV0gJiYgcDIgPT09IHBvaW50c1swXSkpIHtcbiAgICAgICAgICAgIHRoaXMubmVpZ2hib3JzX1syXSA9IHQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3BvbHkydHJpIEludmFsaWQgVHJpYW5nbGUubWFya05laWdoYm9yUG9pbnRlcnMoKSBjYWxsJyk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogRXhoYXVzdGl2ZSBzZWFyY2ggdG8gdXBkYXRlIG5laWdoYm9yIHBvaW50ZXJzXG4gICAgICogQHBhcmFtIHtUcmlhbmdsZX0gdFxuICAgICAqL1xuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5tYXJrTmVpZ2hib3IgPSBmdW5jdGlvbih0KSB7XG4gICAgICAgIHZhciBwb2ludHMgPSB0aGlzLnBvaW50c187XG4gICAgICAgIGlmICh0LmNvbnRhaW5zUG9pbnRzKHBvaW50c1sxXSwgcG9pbnRzWzJdKSkge1xuICAgICAgICAgICAgdGhpcy5uZWlnaGJvcnNfWzBdID0gdDtcbiAgICAgICAgICAgIHQubWFya05laWdoYm9yUG9pbnRlcnMocG9pbnRzWzFdLCBwb2ludHNbMl0sIHRoaXMpO1xuICAgICAgICB9IGVsc2UgaWYgKHQuY29udGFpbnNQb2ludHMocG9pbnRzWzBdLCBwb2ludHNbMl0pKSB7XG4gICAgICAgICAgICB0aGlzLm5laWdoYm9yc19bMV0gPSB0O1xuICAgICAgICAgICAgdC5tYXJrTmVpZ2hib3JQb2ludGVycyhwb2ludHNbMF0sIHBvaW50c1syXSwgdGhpcyk7XG4gICAgICAgIH0gZWxzZSBpZiAodC5jb250YWluc1BvaW50cyhwb2ludHNbMF0sIHBvaW50c1sxXSkpIHtcbiAgICAgICAgICAgIHRoaXMubmVpZ2hib3JzX1syXSA9IHQ7XG4gICAgICAgICAgICB0Lm1hcmtOZWlnaGJvclBvaW50ZXJzKHBvaW50c1swXSwgcG9pbnRzWzFdLCB0aGlzKTtcbiAgICAgICAgfVxuICAgIH07XG5cblxuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5jbGVhck5laWdib3JzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMubmVpZ2hib3JzX1swXSA9IG51bGw7XG4gICAgICAgIHRoaXMubmVpZ2hib3JzX1sxXSA9IG51bGw7XG4gICAgICAgIHRoaXMubmVpZ2hib3JzX1syXSA9IG51bGw7XG4gICAgfTtcblxuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5jbGVhckRlbHVuYXlFZGdlcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmRlbGF1bmF5X2VkZ2VbMF0gPSBmYWxzZTtcbiAgICAgICAgdGhpcy5kZWxhdW5heV9lZGdlWzFdID0gZmFsc2U7XG4gICAgICAgIHRoaXMuZGVsYXVuYXlfZWRnZVsyXSA9IGZhbHNlO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBwb2ludCBjbG9ja3dpc2UgdG8gdGhlIGdpdmVuIHBvaW50LlxuICAgICAqL1xuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5wb2ludENXID0gZnVuY3Rpb24ocCkge1xuICAgICAgICB2YXIgcG9pbnRzID0gdGhpcy5wb2ludHNfO1xuICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlc1xuICAgICAgICBpZiAocCA9PT0gcG9pbnRzWzBdKSB7XG4gICAgICAgICAgICByZXR1cm4gcG9pbnRzWzJdO1xuICAgICAgICB9IGVsc2UgaWYgKHAgPT09IHBvaW50c1sxXSkge1xuICAgICAgICAgICAgcmV0dXJuIHBvaW50c1swXTtcbiAgICAgICAgfSBlbHNlIGlmIChwID09PSBwb2ludHNbMl0pIHtcbiAgICAgICAgICAgIHJldHVybiBwb2ludHNbMV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBwb2ludCBjb3VudGVyLWNsb2Nrd2lzZSB0byB0aGUgZ2l2ZW4gcG9pbnQuXG4gICAgICovXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLnBvaW50Q0NXID0gZnVuY3Rpb24ocCkge1xuICAgICAgICB2YXIgcG9pbnRzID0gdGhpcy5wb2ludHNfO1xuICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlc1xuICAgICAgICBpZiAocCA9PT0gcG9pbnRzWzBdKSB7XG4gICAgICAgICAgICByZXR1cm4gcG9pbnRzWzFdO1xuICAgICAgICB9IGVsc2UgaWYgKHAgPT09IHBvaW50c1sxXSkge1xuICAgICAgICAgICAgcmV0dXJuIHBvaW50c1syXTtcbiAgICAgICAgfSBlbHNlIGlmIChwID09PSBwb2ludHNbMl0pIHtcbiAgICAgICAgICAgIHJldHVybiBwb2ludHNbMF07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBuZWlnaGJvciBjbG9ja3dpc2UgdG8gZ2l2ZW4gcG9pbnQuXG4gICAgICovXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLm5laWdoYm9yQ1cgPSBmdW5jdGlvbihwKSB7XG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXG4gICAgICAgIGlmIChwID09PSB0aGlzLnBvaW50c19bMF0pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm5laWdoYm9yc19bMV07XG4gICAgICAgIH0gZWxzZSBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzFdKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5uZWlnaGJvcnNfWzJdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubmVpZ2hib3JzX1swXTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBuZWlnaGJvciBjb3VudGVyLWNsb2Nrd2lzZSB0byBnaXZlbiBwb2ludC5cbiAgICAgKi9cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUubmVpZ2hib3JDQ1cgPSBmdW5jdGlvbihwKSB7XG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXG4gICAgICAgIGlmIChwID09PSB0aGlzLnBvaW50c19bMF0pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm5laWdoYm9yc19bMl07XG4gICAgICAgIH0gZWxzZSBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzFdKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5uZWlnaGJvcnNfWzBdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubmVpZ2hib3JzX1sxXTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuZ2V0Q29uc3RyYWluZWRFZGdlQ1cgPSBmdW5jdGlvbihwKSB7XG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXG4gICAgICAgIGlmIChwID09PSB0aGlzLnBvaW50c19bMF0pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbMV07XG4gICAgICAgIH0gZWxzZSBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzFdKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jb25zdHJhaW5lZF9lZGdlWzJdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29uc3RyYWluZWRfZWRnZVswXTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuZ2V0Q29uc3RyYWluZWRFZGdlQ0NXID0gZnVuY3Rpb24ocCkge1xuICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlc1xuICAgICAgICBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzBdKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jb25zdHJhaW5lZF9lZGdlWzJdO1xuICAgICAgICB9IGVsc2UgaWYgKHAgPT09IHRoaXMucG9pbnRzX1sxXSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29uc3RyYWluZWRfZWRnZVswXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbMV07XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLnNldENvbnN0cmFpbmVkRWRnZUNXID0gZnVuY3Rpb24ocCwgY2UpIHtcbiAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcbiAgICAgICAgaWYgKHAgPT09IHRoaXMucG9pbnRzX1swXSkge1xuICAgICAgICAgICAgdGhpcy5jb25zdHJhaW5lZF9lZGdlWzFdID0gY2U7XG4gICAgICAgIH0gZWxzZSBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzFdKSB7XG4gICAgICAgICAgICB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbMl0gPSBjZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuY29uc3RyYWluZWRfZWRnZVswXSA9IGNlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5zZXRDb25zdHJhaW5lZEVkZ2VDQ1cgPSBmdW5jdGlvbihwLCBjZSkge1xuICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlc1xuICAgICAgICBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzBdKSB7XG4gICAgICAgICAgICB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbMl0gPSBjZTtcbiAgICAgICAgfSBlbHNlIGlmIChwID09PSB0aGlzLnBvaW50c19bMV0pIHtcbiAgICAgICAgICAgIHRoaXMuY29uc3RyYWluZWRfZWRnZVswXSA9IGNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5jb25zdHJhaW5lZF9lZGdlWzFdID0gY2U7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLmdldERlbGF1bmF5RWRnZUNXID0gZnVuY3Rpb24ocCkge1xuICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlc1xuICAgICAgICBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzBdKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5kZWxhdW5heV9lZGdlWzFdO1xuICAgICAgICB9IGVsc2UgaWYgKHAgPT09IHRoaXMucG9pbnRzX1sxXSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGVsYXVuYXlfZWRnZVsyXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmRlbGF1bmF5X2VkZ2VbMF07XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLmdldERlbGF1bmF5RWRnZUNDVyA9IGZ1bmN0aW9uKHApIHtcbiAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcbiAgICAgICAgaWYgKHAgPT09IHRoaXMucG9pbnRzX1swXSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGVsYXVuYXlfZWRnZVsyXTtcbiAgICAgICAgfSBlbHNlIGlmIChwID09PSB0aGlzLnBvaW50c19bMV0pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmRlbGF1bmF5X2VkZ2VbMF07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5kZWxhdW5heV9lZGdlWzFdO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5zZXREZWxhdW5heUVkZ2VDVyA9IGZ1bmN0aW9uKHAsIGUpIHtcbiAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcbiAgICAgICAgaWYgKHAgPT09IHRoaXMucG9pbnRzX1swXSkge1xuICAgICAgICAgICAgdGhpcy5kZWxhdW5heV9lZGdlWzFdID0gZTtcbiAgICAgICAgfSBlbHNlIGlmIChwID09PSB0aGlzLnBvaW50c19bMV0pIHtcbiAgICAgICAgICAgIHRoaXMuZGVsYXVuYXlfZWRnZVsyXSA9IGU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmRlbGF1bmF5X2VkZ2VbMF0gPSBlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5zZXREZWxhdW5heUVkZ2VDQ1cgPSBmdW5jdGlvbihwLCBlKSB7XG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXG4gICAgICAgIGlmIChwID09PSB0aGlzLnBvaW50c19bMF0pIHtcbiAgICAgICAgICAgIHRoaXMuZGVsYXVuYXlfZWRnZVsyXSA9IGU7XG4gICAgICAgIH0gZWxzZSBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzFdKSB7XG4gICAgICAgICAgICB0aGlzLmRlbGF1bmF5X2VkZ2VbMF0gPSBlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5kZWxhdW5heV9lZGdlWzFdID0gZTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbmVpZ2hib3IgYWNyb3NzIHRvIGdpdmVuIHBvaW50LlxuICAgICAqL1xuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5uZWlnaGJvckFjcm9zcyA9IGZ1bmN0aW9uKHApIHtcbiAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcbiAgICAgICAgaWYgKHAgPT09IHRoaXMucG9pbnRzX1swXSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubmVpZ2hib3JzX1swXTtcbiAgICAgICAgfSBlbHNlIGlmIChwID09PSB0aGlzLnBvaW50c19bMV0pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm5laWdoYm9yc19bMV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5uZWlnaGJvcnNfWzJdO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5vcHBvc2l0ZVBvaW50ID0gZnVuY3Rpb24odCwgcCkge1xuICAgICAgICB2YXIgY3cgPSB0LnBvaW50Q1cocCk7XG4gICAgICAgIHJldHVybiB0aGlzLnBvaW50Q1coY3cpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBMZWdhbGl6ZSB0cmlhbmdsZSBieSByb3RhdGluZyBjbG9ja3dpc2UgYXJvdW5kIG9Qb2ludFxuICAgICAqIEBwYXJhbSB7UG9pbnR9IG9wb2ludFxuICAgICAqIEBwYXJhbSB7UG9pbnR9IG5wb2ludFxuICAgICAqL1xuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5sZWdhbGl6ZSA9IGZ1bmN0aW9uKG9wb2ludCwgbnBvaW50KSB7XG4gICAgICAgIHZhciBwb2ludHMgPSB0aGlzLnBvaW50c187XG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXG4gICAgICAgIGlmIChvcG9pbnQgPT09IHBvaW50c1swXSkge1xuICAgICAgICAgICAgcG9pbnRzWzFdID0gcG9pbnRzWzBdO1xuICAgICAgICAgICAgcG9pbnRzWzBdID0gcG9pbnRzWzJdO1xuICAgICAgICAgICAgcG9pbnRzWzJdID0gbnBvaW50O1xuICAgICAgICB9IGVsc2UgaWYgKG9wb2ludCA9PT0gcG9pbnRzWzFdKSB7XG4gICAgICAgICAgICBwb2ludHNbMl0gPSBwb2ludHNbMV07XG4gICAgICAgICAgICBwb2ludHNbMV0gPSBwb2ludHNbMF07XG4gICAgICAgICAgICBwb2ludHNbMF0gPSBucG9pbnQ7XG4gICAgICAgIH0gZWxzZSBpZiAob3BvaW50ID09PSBwb2ludHNbMl0pIHtcbiAgICAgICAgICAgIHBvaW50c1swXSA9IHBvaW50c1syXTtcbiAgICAgICAgICAgIHBvaW50c1syXSA9IHBvaW50c1sxXTtcbiAgICAgICAgICAgIHBvaW50c1sxXSA9IG5wb2ludDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigncG9seTJ0cmkgSW52YWxpZCBUcmlhbmdsZS5sZWdhbGl6ZSgpIGNhbGwnKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBpbmRleCBvZiBhIHBvaW50IGluIHRoZSB0cmlhbmdsZS4gXG4gICAgICogVGhlIHBvaW50ICptdXN0KiBiZSBhIHJlZmVyZW5jZSB0byBvbmUgb2YgdGhlIHRyaWFuZ2xlJ3MgdmVydGljZXMuXG4gICAgICogQHBhcmFtIHtQb2ludH0gcCBQb2ludCBvYmplY3RcbiAgICAgKiBAcmV0dXJucyB7TnVtYmVyfSBpbmRleCAwLCAxIG9yIDJcbiAgICAgKi9cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuaW5kZXggPSBmdW5jdGlvbihwKSB7XG4gICAgICAgIHZhciBwb2ludHMgPSB0aGlzLnBvaW50c187XG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXG4gICAgICAgIGlmIChwID09PSBwb2ludHNbMF0pIHtcbiAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICB9IGVsc2UgaWYgKHAgPT09IHBvaW50c1sxXSkge1xuICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH0gZWxzZSBpZiAocCA9PT0gcG9pbnRzWzJdKSB7XG4gICAgICAgICAgICByZXR1cm4gMjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigncG9seTJ0cmkgSW52YWxpZCBUcmlhbmdsZS5pbmRleCgpIGNhbGwnKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuZWRnZUluZGV4ID0gZnVuY3Rpb24ocDEsIHAyKSB7XG4gICAgICAgIHZhciBwb2ludHMgPSB0aGlzLnBvaW50c187XG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXG4gICAgICAgIGlmIChwMSA9PT0gcG9pbnRzWzBdKSB7XG4gICAgICAgICAgICBpZiAocDIgPT09IHBvaW50c1sxXSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAyO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChwMiA9PT0gcG9pbnRzWzJdKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAocDEgPT09IHBvaW50c1sxXSkge1xuICAgICAgICAgICAgaWYgKHAyID09PSBwb2ludHNbMl0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocDIgPT09IHBvaW50c1swXSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHAxID09PSBwb2ludHNbMl0pIHtcbiAgICAgICAgICAgIGlmIChwMiA9PT0gcG9pbnRzWzBdKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHAyID09PSBwb2ludHNbMV0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gLTE7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIE1hcmsgYW4gZWRnZSBvZiB0aGlzIHRyaWFuZ2xlIGFzIGNvbnN0cmFpbmVkLjxicj5cbiAgICAgKiBUaGlzIG1ldGhvZCB0YWtlcyBlaXRoZXIgMSBwYXJhbWV0ZXIgKGFuIGVkZ2UgaW5kZXggb3IgYW4gRWRnZSBpbnN0YW5jZSkgb3JcbiAgICAgKiAyIHBhcmFtZXRlcnMgKHR3byBQb2ludCBpbnN0YW5jZXMgZGVmaW5pbmcgdGhlIGVkZ2Ugb2YgdGhlIHRyaWFuZ2xlKS5cbiAgICAgKi9cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUubWFya0NvbnN0cmFpbmVkRWRnZUJ5SW5kZXggPSBmdW5jdGlvbihpbmRleCkge1xuICAgICAgICB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbaW5kZXhdID0gdHJ1ZTtcbiAgICB9O1xuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5tYXJrQ29uc3RyYWluZWRFZGdlQnlFZGdlID0gZnVuY3Rpb24oZWRnZSkge1xuICAgICAgICB0aGlzLm1hcmtDb25zdHJhaW5lZEVkZ2VCeVBvaW50cyhlZGdlLnAsIGVkZ2UucSk7XG4gICAgfTtcbiAgICBUcmlhbmdsZS5wcm90b3R5cGUubWFya0NvbnN0cmFpbmVkRWRnZUJ5UG9pbnRzID0gZnVuY3Rpb24ocCwgcSkge1xuICAgICAgICB2YXIgcG9pbnRzID0gdGhpcy5wb2ludHNfO1xuICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlcyAgICAgICAgXG4gICAgICAgIGlmICgocSA9PT0gcG9pbnRzWzBdICYmIHAgPT09IHBvaW50c1sxXSkgfHwgKHEgPT09IHBvaW50c1sxXSAmJiBwID09PSBwb2ludHNbMF0pKSB7XG4gICAgICAgICAgICB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbMl0gPSB0cnVlO1xuICAgICAgICB9IGVsc2UgaWYgKChxID09PSBwb2ludHNbMF0gJiYgcCA9PT0gcG9pbnRzWzJdKSB8fCAocSA9PT0gcG9pbnRzWzJdICYmIHAgPT09IHBvaW50c1swXSkpIHtcbiAgICAgICAgICAgIHRoaXMuY29uc3RyYWluZWRfZWRnZVsxXSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSBpZiAoKHEgPT09IHBvaW50c1sxXSAmJiBwID09PSBwb2ludHNbMl0pIHx8IChxID09PSBwb2ludHNbMl0gJiYgcCA9PT0gcG9pbnRzWzFdKSkge1xuICAgICAgICAgICAgdGhpcy5jb25zdHJhaW5lZF9lZGdlWzBdID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH07XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLXV0aWxzXG4gICAgdmFyIFBJXzNkaXY0ID0gMyAqIE1hdGguUEkgLyA0O1xuICAgIHZhciBQSV8yID0gTWF0aC5QSSAvIDI7XG4gICAgdmFyIEVQU0lMT04gPSAxZS0xMjtcblxuICAgIC8qIFxuICAgICAqIEluaXRhbCB0cmlhbmdsZSBmYWN0b3IsIHNlZWQgdHJpYW5nbGUgd2lsbCBleHRlbmQgMzAlIG9mXG4gICAgICogUG9pbnRTZXQgd2lkdGggdG8gYm90aCBsZWZ0IGFuZCByaWdodC5cbiAgICAgKi9cbiAgICB2YXIga0FscGhhID0gMC4zO1xuXG4gICAgdmFyIE9yaWVudGF0aW9uID0ge1xuICAgICAgICBcIkNXXCI6IDEsXG4gICAgICAgIFwiQ0NXXCI6IC0xLFxuICAgICAgICBcIkNPTExJTkVBUlwiOiAwXG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEZvcnVtbGEgdG8gY2FsY3VsYXRlIHNpZ25lZCBhcmVhPGJyPlxuICAgICAqIFBvc2l0aXZlIGlmIENDVzxicj5cbiAgICAgKiBOZWdhdGl2ZSBpZiBDVzxicj5cbiAgICAgKiAwIGlmIGNvbGxpbmVhcjxicj5cbiAgICAgKiA8cHJlPlxuICAgICAqIEFbUDEsUDIsUDNdICA9ICAoeDEqeTIgLSB5MSp4MikgKyAoeDIqeTMgLSB5Mip4MykgKyAoeDMqeTEgLSB5Myp4MSlcbiAgICAgKiAgICAgICAgICAgICAgPSAgKHgxLXgzKSooeTIteTMpIC0gKHkxLXkzKSooeDIteDMpXG4gICAgICogPC9wcmU+XG4gICAgICovXG4gICAgZnVuY3Rpb24gb3JpZW50MmQocGEsIHBiLCBwYykge1xuICAgICAgICB2YXIgZGV0bGVmdCA9IChwYS54IC0gcGMueCkgKiAocGIueSAtIHBjLnkpO1xuICAgICAgICB2YXIgZGV0cmlnaHQgPSAocGEueSAtIHBjLnkpICogKHBiLnggLSBwYy54KTtcbiAgICAgICAgdmFyIHZhbCA9IGRldGxlZnQgLSBkZXRyaWdodDtcbiAgICAgICAgaWYgKHZhbCA+IC0oRVBTSUxPTikgJiYgdmFsIDwgKEVQU0lMT04pKSB7XG4gICAgICAgICAgICByZXR1cm4gT3JpZW50YXRpb24uQ09MTElORUFSO1xuICAgICAgICB9IGVsc2UgaWYgKHZhbCA+IDApIHtcbiAgICAgICAgICAgIHJldHVybiBPcmllbnRhdGlvbi5DQ1c7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gT3JpZW50YXRpb24uQ1c7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpblNjYW5BcmVhKHBhLCBwYiwgcGMsIHBkKSB7XG4gICAgICAgIHZhciBwZHggPSBwZC54O1xuICAgICAgICB2YXIgcGR5ID0gcGQueTtcbiAgICAgICAgdmFyIGFkeCA9IHBhLnggLSBwZHg7XG4gICAgICAgIHZhciBhZHkgPSBwYS55IC0gcGR5O1xuICAgICAgICB2YXIgYmR4ID0gcGIueCAtIHBkeDtcbiAgICAgICAgdmFyIGJkeSA9IHBiLnkgLSBwZHk7XG5cbiAgICAgICAgdmFyIGFkeGJkeSA9IGFkeCAqIGJkeTtcbiAgICAgICAgdmFyIGJkeGFkeSA9IGJkeCAqIGFkeTtcbiAgICAgICAgdmFyIG9hYmQgPSBhZHhiZHkgLSBiZHhhZHk7XG5cbiAgICAgICAgaWYgKG9hYmQgPD0gKEVQU0lMT04pKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgY2R4ID0gcGMueCAtIHBkeDtcbiAgICAgICAgdmFyIGNkeSA9IHBjLnkgLSBwZHk7XG5cbiAgICAgICAgdmFyIGNkeGFkeSA9IGNkeCAqIGFkeTtcbiAgICAgICAgdmFyIGFkeGNkeSA9IGFkeCAqIGNkeTtcbiAgICAgICAgdmFyIG9jYWQgPSBjZHhhZHkgLSBhZHhjZHk7XG5cbiAgICAgICAgaWYgKG9jYWQgPD0gKEVQU0lMT04pKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLUFkdmFuY2luZ0Zyb250XG4gICAgLyoqXG4gICAgICogQWR2YW5jaW5nIGZyb250IG5vZGVcbiAgICAgKiBAcGFyYW0ge1BvaW50fSBwIGFueSBcIlBvaW50IGxpa2VcIiBvYmplY3Qgd2l0aCB7eCx5fSAoZHVjayB0eXBpbmcpXG4gICAgICogQHBhcmFtIHtUcmlhbmdsZX0gdCB0cmlhbmdsZSAob3B0aW9ubmFsKVxuICAgICAqL1xuICAgIHZhciBOb2RlID0gZnVuY3Rpb24ocCwgdCkge1xuICAgICAgICB0aGlzLnBvaW50ID0gcDtcbiAgICAgICAgdGhpcy50cmlhbmdsZSA9IHQgfHwgbnVsbDtcblxuICAgICAgICB0aGlzLm5leHQgPSBudWxsOyAvLyBOb2RlXG4gICAgICAgIHRoaXMucHJldiA9IG51bGw7IC8vIE5vZGVcblxuICAgICAgICB0aGlzLnZhbHVlID0gcC54O1xuICAgIH07XG5cbiAgICB2YXIgQWR2YW5jaW5nRnJvbnQgPSBmdW5jdGlvbihoZWFkLCB0YWlsKSB7XG4gICAgICAgIHRoaXMuaGVhZF8gPSBoZWFkOyAvLyBOb2RlXG4gICAgICAgIHRoaXMudGFpbF8gPSB0YWlsOyAvLyBOb2RlXG4gICAgICAgIHRoaXMuc2VhcmNoX25vZGVfID0gaGVhZDsgLy8gTm9kZVxuICAgIH07XG5cbiAgICBBZHZhbmNpbmdGcm9udC5wcm90b3R5cGUuaGVhZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5oZWFkXztcbiAgICB9O1xuXG4gICAgQWR2YW5jaW5nRnJvbnQucHJvdG90eXBlLnNldEhlYWQgPSBmdW5jdGlvbihub2RlKSB7XG4gICAgICAgIHRoaXMuaGVhZF8gPSBub2RlO1xuICAgIH07XG5cbiAgICBBZHZhbmNpbmdGcm9udC5wcm90b3R5cGUudGFpbCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy50YWlsXztcbiAgICB9O1xuXG4gICAgQWR2YW5jaW5nRnJvbnQucHJvdG90eXBlLnNldFRhaWwgPSBmdW5jdGlvbihub2RlKSB7XG4gICAgICAgIHRoaXMudGFpbF8gPSBub2RlO1xuICAgIH07XG5cbiAgICBBZHZhbmNpbmdGcm9udC5wcm90b3R5cGUuc2VhcmNoID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNlYXJjaF9ub2RlXztcbiAgICB9O1xuXG4gICAgQWR2YW5jaW5nRnJvbnQucHJvdG90eXBlLnNldFNlYXJjaCA9IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICAgICAgdGhpcy5zZWFyY2hfbm9kZV8gPSBub2RlO1xuICAgIH07XG5cbiAgICBBZHZhbmNpbmdGcm9udC5wcm90b3R5cGUuZmluZFNlYXJjaE5vZGUgPSBmdW5jdGlvbigvKngqLykge1xuICAgICAgICAvLyBUT0RPOiBpbXBsZW1lbnQgQlNUIGluZGV4XG4gICAgICAgIHJldHVybiB0aGlzLnNlYXJjaF9ub2RlXztcbiAgICB9O1xuXG4gICAgQWR2YW5jaW5nRnJvbnQucHJvdG90eXBlLmxvY2F0ZU5vZGUgPSBmdW5jdGlvbih4KSB7XG4gICAgICAgIHZhciBub2RlID0gdGhpcy5zZWFyY2hfbm9kZV87XG5cbiAgICAgICAgLyoganNoaW50IGJvc3M6dHJ1ZSAqL1xuICAgICAgICBpZiAoeCA8IG5vZGUudmFsdWUpIHtcbiAgICAgICAgICAgIHdoaWxlIChub2RlID0gbm9kZS5wcmV2KSB7XG4gICAgICAgICAgICAgICAgaWYgKHggPj0gbm9kZS52YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNlYXJjaF9ub2RlXyA9IG5vZGU7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBub2RlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHdoaWxlIChub2RlID0gbm9kZS5uZXh0KSB7XG4gICAgICAgICAgICAgICAgaWYgKHggPCBub2RlLnZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2VhcmNoX25vZGVfID0gbm9kZS5wcmV2O1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbm9kZS5wcmV2O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9O1xuXG4gICAgQWR2YW5jaW5nRnJvbnQucHJvdG90eXBlLmxvY2F0ZVBvaW50ID0gZnVuY3Rpb24ocG9pbnQpIHtcbiAgICAgICAgdmFyIHB4ID0gcG9pbnQueDtcbiAgICAgICAgdmFyIG5vZGUgPSB0aGlzLmZpbmRTZWFyY2hOb2RlKHB4KTtcbiAgICAgICAgdmFyIG54ID0gbm9kZS5wb2ludC54O1xuXG4gICAgICAgIGlmIChweCA9PT0gbngpIHtcbiAgICAgICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXG4gICAgICAgICAgICBpZiAocG9pbnQgIT09IG5vZGUucG9pbnQpIHtcbiAgICAgICAgICAgICAgICAvLyBXZSBtaWdodCBoYXZlIHR3byBub2RlcyB3aXRoIHNhbWUgeCB2YWx1ZSBmb3IgYSBzaG9ydCB0aW1lXG4gICAgICAgICAgICAgICAgaWYgKHBvaW50ID09PSBub2RlLnByZXYucG9pbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZSA9IG5vZGUucHJldjtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHBvaW50ID09PSBub2RlLm5leHQucG9pbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZSA9IG5vZGUubmV4dDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3BvbHkydHJpIEludmFsaWQgQWR2YW5jaW5nRnJvbnQubG9jYXRlUG9pbnQoKSBjYWxsJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHB4IDwgbngpIHtcbiAgICAgICAgICAgIC8qIGpzaGludCBib3NzOnRydWUgKi9cbiAgICAgICAgICAgIHdoaWxlIChub2RlID0gbm9kZS5wcmV2KSB7XG4gICAgICAgICAgICAgICAgaWYgKHBvaW50ID09PSBub2RlLnBvaW50KSB7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHdoaWxlIChub2RlID0gbm9kZS5uZXh0KSB7XG4gICAgICAgICAgICAgICAgaWYgKHBvaW50ID09PSBub2RlLnBvaW50KSB7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChub2RlKSB7XG4gICAgICAgICAgICB0aGlzLnNlYXJjaF9ub2RlXyA9IG5vZGU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgfTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tQmFzaW5cbiAgICB2YXIgQmFzaW4gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5sZWZ0X25vZGUgPSBudWxsOyAvLyBOb2RlXG4gICAgICAgIHRoaXMuYm90dG9tX25vZGUgPSBudWxsOyAvLyBOb2RlXG4gICAgICAgIHRoaXMucmlnaHRfbm9kZSA9IG51bGw7IC8vIE5vZGVcbiAgICAgICAgdGhpcy53aWR0aCA9IDAuMDsgLy8gbnVtYmVyXG4gICAgICAgIHRoaXMubGVmdF9oaWdoZXN0ID0gZmFsc2U7XG4gICAgfTtcblxuICAgIEJhc2luLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmxlZnRfbm9kZSA9IG51bGw7XG4gICAgICAgIHRoaXMuYm90dG9tX25vZGUgPSBudWxsO1xuICAgICAgICB0aGlzLnJpZ2h0X25vZGUgPSBudWxsO1xuICAgICAgICB0aGlzLndpZHRoID0gMC4wO1xuICAgICAgICB0aGlzLmxlZnRfaGlnaGVzdCA9IGZhbHNlO1xuICAgIH07XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tRWRnZUV2ZW50XG4gICAgdmFyIEVkZ2VFdmVudCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmNvbnN0cmFpbmVkX2VkZ2UgPSBudWxsOyAvLyBFZGdlXG4gICAgICAgIHRoaXMucmlnaHQgPSBmYWxzZTtcbiAgICB9O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tU3dlZXBDb250ZXh0IChwdWJsaWMgQVBJKVxuICAgIC8qKlxuICAgICAqIENvbnN0cnVjdG9yIGZvciB0aGUgdHJpYW5ndWxhdGlvbiBjb250ZXh0LlxuICAgICAqIEl0IGFjY2VwdHMgYSBzaW1wbGUgcG9seWxpbmUsIHdoaWNoIGRlZmluZXMgdGhlIGNvbnN0cmFpbmVkIGVkZ2VzLlxuICAgICAqIFBvc3NpYmxlIG9wdGlvbnMgYXJlOlxuICAgICAqICAgIGNsb25lQXJyYXlzOiAgaWYgdHJ1ZSwgZG8gYSBzaGFsbG93IGNvcHkgb2YgdGhlIEFycmF5IHBhcmFtZXRlcnMgXG4gICAgICogICAgICAgICAgICAgICAgICAoY29udG91ciwgaG9sZXMpLiBQb2ludHMgaW5zaWRlIGFycmF5cyBhcmUgbmV2ZXIgY29waWVkLlxuICAgICAqICAgICAgICAgICAgICAgICAgRGVmYXVsdCBpcyBmYWxzZSA6IGtlZXAgYSByZWZlcmVuY2UgdG8gdGhlIGFycmF5IGFyZ3VtZW50cyxcbiAgICAgKiAgICAgICAgICAgICAgICAgIHdobyB3aWxsIGJlIG1vZGlmaWVkIGluIHBsYWNlLlxuICAgICAqIEBwYXJhbSB7QXJyYXl9IGNvbnRvdXIgIGFycmF5IG9mIFwiUG9pbnQgbGlrZVwiIG9iamVjdHMgd2l0aCB7eCx5fSAoZHVjayB0eXBpbmcpXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgIGNvbnN0cnVjdG9yIG9wdGlvbnNcbiAgICAgKi9cbiAgICB2YXIgU3dlZXBDb250ZXh0ID0gZnVuY3Rpb24oY29udG91ciwgb3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICAgICAgdGhpcy50cmlhbmdsZXNfID0gW107XG4gICAgICAgIHRoaXMubWFwXyA9IFtdO1xuICAgICAgICB0aGlzLnBvaW50c18gPSAob3B0aW9ucy5jbG9uZUFycmF5cyA/IGNvbnRvdXIuc2xpY2UoMCkgOiBjb250b3VyKTtcbiAgICAgICAgdGhpcy5lZGdlX2xpc3QgPSBbXTtcblxuICAgICAgICAvLyBCb3VuZGluZyBib3ggb2YgYWxsIHBvaW50cy4gQ29tcHV0ZWQgYXQgdGhlIHN0YXJ0IG9mIHRoZSB0cmlhbmd1bGF0aW9uLCBcbiAgICAgICAgLy8gaXQgaXMgc3RvcmVkIGluIGNhc2UgaXQgaXMgbmVlZGVkIGJ5IHRoZSBjYWxsZXIuXG4gICAgICAgIHRoaXMucG1pbl8gPSB0aGlzLnBtYXhfID0gbnVsbDtcblxuICAgICAgICAvLyBBZHZhbmNpbmcgZnJvbnRcbiAgICAgICAgdGhpcy5mcm9udF8gPSBudWxsOyAvLyBBZHZhbmNpbmdGcm9udFxuICAgICAgICAvLyBoZWFkIHBvaW50IHVzZWQgd2l0aCBhZHZhbmNpbmcgZnJvbnRcbiAgICAgICAgdGhpcy5oZWFkXyA9IG51bGw7IC8vIFBvaW50XG4gICAgICAgIC8vIHRhaWwgcG9pbnQgdXNlZCB3aXRoIGFkdmFuY2luZyBmcm9udFxuICAgICAgICB0aGlzLnRhaWxfID0gbnVsbDsgLy8gUG9pbnRcblxuICAgICAgICB0aGlzLmFmX2hlYWRfID0gbnVsbDsgLy8gTm9kZVxuICAgICAgICB0aGlzLmFmX21pZGRsZV8gPSBudWxsOyAvLyBOb2RlXG4gICAgICAgIHRoaXMuYWZfdGFpbF8gPSBudWxsOyAvLyBOb2RlXG5cbiAgICAgICAgdGhpcy5iYXNpbiA9IG5ldyBCYXNpbigpO1xuICAgICAgICB0aGlzLmVkZ2VfZXZlbnQgPSBuZXcgRWRnZUV2ZW50KCk7XG5cbiAgICAgICAgdGhpcy5pbml0RWRnZXModGhpcy5wb2ludHNfKTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBBZGQgYSBob2xlIHRvIHRoZSBjb25zdHJhaW50c1xuICAgICAqIEBwYXJhbSB7QXJyYXl9IHBvbHlsaW5lICBhcnJheSBvZiBcIlBvaW50IGxpa2VcIiBvYmplY3RzIHdpdGgge3gseX0gKGR1Y2sgdHlwaW5nKVxuICAgICAqL1xuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUuYWRkSG9sZSA9IGZ1bmN0aW9uKHBvbHlsaW5lKSB7XG4gICAgICAgIHRoaXMuaW5pdEVkZ2VzKHBvbHlsaW5lKTtcbiAgICAgICAgdmFyIGksIGxlbiA9IHBvbHlsaW5lLmxlbmd0aDtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnBvaW50c18ucHVzaChwb2x5bGluZVtpXSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7IC8vIGZvciBjaGFpbmluZ1xuICAgIH07XG4gICAgLy8gQmFja3dhcmQgY29tcGF0aWJpbGl0eVxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUuQWRkSG9sZSA9IFN3ZWVwQ29udGV4dC5wcm90b3R5cGUuYWRkSG9sZTtcblxuXG4gICAgLyoqXG4gICAgICogQWRkIGEgU3RlaW5lciBwb2ludCB0byB0aGUgY29uc3RyYWludHNcbiAgICAgKiBAcGFyYW0ge1BvaW50fSBwb2ludCAgICAgYW55IFwiUG9pbnQgbGlrZVwiIG9iamVjdCB3aXRoIHt4LHl9IChkdWNrIHR5cGluZylcbiAgICAgKi9cbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLmFkZFBvaW50ID0gZnVuY3Rpb24ocG9pbnQpIHtcbiAgICAgICAgdGhpcy5wb2ludHNfLnB1c2gocG9pbnQpO1xuICAgICAgICByZXR1cm4gdGhpczsgLy8gZm9yIGNoYWluaW5nXG4gICAgfTtcbiAgICAvLyBCYWNrd2FyZCBjb21wYXRpYmlsaXR5XG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5BZGRQb2ludCA9IFN3ZWVwQ29udGV4dC5wcm90b3R5cGUuYWRkUG9pbnQ7XG5cblxuICAgIC8qKlxuICAgICAqIEFkZCBzZXZlcmFsIFN0ZWluZXIgcG9pbnRzIHRvIHRoZSBjb25zdHJhaW50c1xuICAgICAqIEBwYXJhbSB7YXJyYXk8UG9pbnQ+fSBwb2ludHMgICAgIGFycmF5IG9mIFwiUG9pbnQgbGlrZVwiIG9iamVjdCB3aXRoIHt4LHl9IFxuICAgICAqL1xuICAgIC8vIE1ldGhvZCBhZGRlZCBpbiB0aGUgSmF2YVNjcmlwdCB2ZXJzaW9uICh3YXMgbm90IHByZXNlbnQgaW4gdGhlIGMrKyB2ZXJzaW9uKVxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUuYWRkUG9pbnRzID0gZnVuY3Rpb24ocG9pbnRzKSB7XG4gICAgICAgIHRoaXMucG9pbnRzXyA9IHRoaXMucG9pbnRzXy5jb25jYXQocG9pbnRzKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7IC8vIGZvciBjaGFpbmluZ1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIFRyaWFuZ3VsYXRlIHRoZSBwb2x5Z29uIHdpdGggaG9sZXMgYW5kIFN0ZWluZXIgcG9pbnRzLlxuICAgICAqL1xuICAgIC8vIFNob3J0Y3V0IG1ldGhvZCBmb3IgU3dlZXAudHJpYW5ndWxhdGUoU3dlZXBDb250ZXh0KS5cbiAgICAvLyBNZXRob2QgYWRkZWQgaW4gdGhlIEphdmFTY3JpcHQgdmVyc2lvbiAod2FzIG5vdCBwcmVzZW50IGluIHRoZSBjKysgdmVyc2lvbilcbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLnRyaWFuZ3VsYXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIFN3ZWVwLnRyaWFuZ3VsYXRlKHRoaXMpO1xuICAgICAgICByZXR1cm4gdGhpczsgLy8gZm9yIGNoYWluaW5nXG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBib3VuZGluZyBib3ggb2YgdGhlIHByb3ZpZGVkIGNvbnN0cmFpbnRzIChjb250b3VyLCBob2xlcyBhbmQgXG4gICAgICogU3RlaW50ZXIgcG9pbnRzKS4gV2FybmluZyA6IHRoZXNlIHZhbHVlcyBhcmUgbm90IGF2YWlsYWJsZSBpZiB0aGUgdHJpYW5ndWxhdGlvbiBcbiAgICAgKiBoYXMgbm90IGJlZW4gZG9uZSB5ZXQuXG4gICAgICogQHJldHVybnMge09iamVjdH0gb2JqZWN0IHdpdGggJ21pbicgYW5kICdtYXgnIFBvaW50XG4gICAgICovXG4gICAgLy8gTWV0aG9kIGFkZGVkIGluIHRoZSBKYXZhU2NyaXB0IHZlcnNpb24gKHdhcyBub3QgcHJlc2VudCBpbiB0aGUgYysrIHZlcnNpb24pXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5nZXRCb3VuZGluZ0JveCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4ge21pbjogdGhpcy5wbWluXywgbWF4OiB0aGlzLnBtYXhffTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogR2V0IHJlc3VsdCBvZiB0cmlhbmd1bGF0aW9uXG4gICAgICogQHJldHVybnMge2FycmF5PFRyaWFuZ2xlPn0gICBhcnJheSBvZiB0cmlhbmdsZXNcbiAgICAgKi9cbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLmdldFRyaWFuZ2xlcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy50cmlhbmdsZXNfO1xuICAgIH07XG4gICAgLy8gQmFja3dhcmQgY29tcGF0aWJpbGl0eVxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUuR2V0VHJpYW5nbGVzID0gU3dlZXBDb250ZXh0LnByb3RvdHlwZS5nZXRUcmlhbmdsZXM7XG5cblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tU3dlZXBDb250ZXh0IChwcml2YXRlIEFQSSlcblxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUuZnJvbnQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZnJvbnRfO1xuICAgIH07XG5cbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLnBvaW50Q291bnQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucG9pbnRzXy5sZW5ndGg7XG4gICAgfTtcblxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUuaGVhZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5oZWFkXztcbiAgICB9O1xuXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5zZXRIZWFkID0gZnVuY3Rpb24ocDEpIHtcbiAgICAgICAgdGhpcy5oZWFkXyA9IHAxO1xuICAgIH07XG5cbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLnRhaWwgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudGFpbF87XG4gICAgfTtcblxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUuc2V0VGFpbCA9IGZ1bmN0aW9uKHAxKSB7XG4gICAgICAgIHRoaXMudGFpbF8gPSBwMTtcbiAgICB9O1xuXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5nZXRNYXAgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubWFwXztcbiAgICB9O1xuXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5pbml0VHJpYW5ndWxhdGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgeG1heCA9IHRoaXMucG9pbnRzX1swXS54O1xuICAgICAgICB2YXIgeG1pbiA9IHRoaXMucG9pbnRzX1swXS54O1xuICAgICAgICB2YXIgeW1heCA9IHRoaXMucG9pbnRzX1swXS55O1xuICAgICAgICB2YXIgeW1pbiA9IHRoaXMucG9pbnRzX1swXS55O1xuXG4gICAgICAgIC8vIENhbGN1bGF0ZSBib3VuZHNcbiAgICAgICAgdmFyIGksIGxlbiA9IHRoaXMucG9pbnRzXy5sZW5ndGg7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgdmFyIHAgPSB0aGlzLnBvaW50c19baV07XG4gICAgICAgICAgICAvKiBqc2hpbnQgZXhwcjp0cnVlICovXG4gICAgICAgICAgICAocC54ID4geG1heCkgJiYgKHhtYXggPSBwLngpO1xuICAgICAgICAgICAgKHAueCA8IHhtaW4pICYmICh4bWluID0gcC54KTtcbiAgICAgICAgICAgIChwLnkgPiB5bWF4KSAmJiAoeW1heCA9IHAueSk7XG4gICAgICAgICAgICAocC55IDwgeW1pbikgJiYgKHltaW4gPSBwLnkpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMucG1pbl8gPSBuZXcgUG9pbnQoeG1pbiwgeW1pbik7XG4gICAgICAgIHRoaXMucG1heF8gPSBuZXcgUG9pbnQoeG1heCwgeW1heCk7XG5cbiAgICAgICAgdmFyIGR4ID0ga0FscGhhICogKHhtYXggLSB4bWluKTtcbiAgICAgICAgdmFyIGR5ID0ga0FscGhhICogKHltYXggLSB5bWluKTtcbiAgICAgICAgdGhpcy5oZWFkXyA9IG5ldyBQb2ludCh4bWF4ICsgZHgsIHltaW4gLSBkeSk7XG4gICAgICAgIHRoaXMudGFpbF8gPSBuZXcgUG9pbnQoeG1pbiAtIGR4LCB5bWluIC0gZHkpO1xuXG4gICAgICAgIC8vIFNvcnQgcG9pbnRzIGFsb25nIHktYXhpc1xuICAgICAgICB0aGlzLnBvaW50c18uc29ydChQb2ludC5jb21wYXJlKTtcbiAgICB9O1xuXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5pbml0RWRnZXMgPSBmdW5jdGlvbihwb2x5bGluZSkge1xuICAgICAgICB2YXIgaSwgbGVuID0gcG9seWxpbmUubGVuZ3RoO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgICAgICAgIHRoaXMuZWRnZV9saXN0LnB1c2gobmV3IEVkZ2UocG9seWxpbmVbaV0sIHBvbHlsaW5lWyhpICsgMSkgJSBsZW5dKSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5nZXRQb2ludCA9IGZ1bmN0aW9uKGluZGV4KSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBvaW50c19baW5kZXhdO1xuICAgIH07XG5cbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLmFkZFRvTWFwID0gZnVuY3Rpb24odHJpYW5nbGUpIHtcbiAgICAgICAgdGhpcy5tYXBfLnB1c2godHJpYW5nbGUpO1xuICAgIH07XG5cbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLmxvY2F0ZU5vZGUgPSBmdW5jdGlvbihwb2ludCkge1xuICAgICAgICByZXR1cm4gdGhpcy5mcm9udF8ubG9jYXRlTm9kZShwb2ludC54KTtcbiAgICB9O1xuXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5jcmVhdGVBZHZhbmNpbmdGcm9udCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgaGVhZDtcbiAgICAgICAgdmFyIG1pZGRsZTtcbiAgICAgICAgdmFyIHRhaWw7XG4gICAgICAgIC8vIEluaXRpYWwgdHJpYW5nbGVcbiAgICAgICAgdmFyIHRyaWFuZ2xlID0gbmV3IFRyaWFuZ2xlKHRoaXMucG9pbnRzX1swXSwgdGhpcy50YWlsXywgdGhpcy5oZWFkXyk7XG5cbiAgICAgICAgdGhpcy5tYXBfLnB1c2godHJpYW5nbGUpO1xuXG4gICAgICAgIGhlYWQgPSBuZXcgTm9kZSh0cmlhbmdsZS5nZXRQb2ludCgxKSwgdHJpYW5nbGUpO1xuICAgICAgICBtaWRkbGUgPSBuZXcgTm9kZSh0cmlhbmdsZS5nZXRQb2ludCgwKSwgdHJpYW5nbGUpO1xuICAgICAgICB0YWlsID0gbmV3IE5vZGUodHJpYW5nbGUuZ2V0UG9pbnQoMikpO1xuXG4gICAgICAgIHRoaXMuZnJvbnRfID0gbmV3IEFkdmFuY2luZ0Zyb250KGhlYWQsIHRhaWwpO1xuXG4gICAgICAgIGhlYWQubmV4dCA9IG1pZGRsZTtcbiAgICAgICAgbWlkZGxlLm5leHQgPSB0YWlsO1xuICAgICAgICBtaWRkbGUucHJldiA9IGhlYWQ7XG4gICAgICAgIHRhaWwucHJldiA9IG1pZGRsZTtcbiAgICB9O1xuXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5yZW1vdmVOb2RlID0gZnVuY3Rpb24obm9kZSkge1xuICAgICAgICAvLyBkbyBub3RoaW5nXG4gICAgICAgIC8qIGpzaGludCB1bnVzZWQ6ZmFsc2UgKi9cbiAgICB9O1xuXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5tYXBUcmlhbmdsZVRvTm9kZXMgPSBmdW5jdGlvbih0KSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgMzsgKytpKSB7XG4gICAgICAgICAgICBpZiAoISB0LmdldE5laWdoYm9yKGkpKSB7XG4gICAgICAgICAgICAgICAgdmFyIG4gPSB0aGlzLmZyb250Xy5sb2NhdGVQb2ludCh0LnBvaW50Q1codC5nZXRQb2ludChpKSkpO1xuICAgICAgICAgICAgICAgIGlmIChuKSB7XG4gICAgICAgICAgICAgICAgICAgIG4udHJpYW5nbGUgPSB0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLnJlbW92ZUZyb21NYXAgPSBmdW5jdGlvbih0cmlhbmdsZSkge1xuICAgICAgICB2YXIgaSwgbWFwID0gdGhpcy5tYXBfLCBsZW4gPSBtYXAubGVuZ3RoO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChtYXBbaV0gPT09IHRyaWFuZ2xlKSB7XG4gICAgICAgICAgICAgICAgbWFwLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBEbyBhIGRlcHRoIGZpcnN0IHRyYXZlcnNhbCB0byBjb2xsZWN0IHRyaWFuZ2xlc1xuICAgICAqIEBwYXJhbSB7VHJpYW5nbGV9IHRyaWFuZ2xlIHN0YXJ0XG4gICAgICovXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5tZXNoQ2xlYW4gPSBmdW5jdGlvbih0cmlhbmdsZSkge1xuICAgICAgICAvLyBOZXcgaW1wbGVtZW50YXRpb24gYXZvaWRzIHJlY3Vyc2l2ZSBjYWxscyBhbmQgdXNlIGEgbG9vcCBpbnN0ZWFkLlxuICAgICAgICAvLyBDZi4gaXNzdWVzICMgNTcsIDY1IGFuZCA2OS5cbiAgICAgICAgdmFyIHRyaWFuZ2xlcyA9IFt0cmlhbmdsZV0sIHQsIGk7XG4gICAgICAgIC8qIGpzaGludCBib3NzOnRydWUgKi9cbiAgICAgICAgd2hpbGUgKHQgPSB0cmlhbmdsZXMucG9wKCkpIHtcbiAgICAgICAgICAgIGlmICghdC5pc0ludGVyaW9yKCkpIHtcbiAgICAgICAgICAgICAgICB0LnNldEludGVyaW9yKHRydWUpO1xuICAgICAgICAgICAgICAgIHRoaXMudHJpYW5nbGVzXy5wdXNoKHQpO1xuICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCAzOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0LmNvbnN0cmFpbmVkX2VkZ2VbaV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyaWFuZ2xlcy5wdXNoKHQuZ2V0TmVpZ2hib3IoaSkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tU3dlZXBcblxuICAgIC8qKlxuICAgICAqIFRoZSAnU3dlZXAnIG9iamVjdCBpcyBwcmVzZW50IGluIG9yZGVyIHRvIGtlZXAgdGhpcyBKYXZhU2NyaXB0IHZlcnNpb24gXG4gICAgICogYXMgY2xvc2UgYXMgcG9zc2libGUgdG8gdGhlIHJlZmVyZW5jZSBDKysgdmVyc2lvbiwgZXZlbiB0aG91Z2ggYWxtb3N0XG4gICAgICogYWxsIFN3ZWVwIG1ldGhvZHMgY291bGQgYmUgZGVjbGFyZWQgYXMgbWVtYmVycyBvZiB0aGUgU3dlZXBDb250ZXh0IG9iamVjdC5cbiAgICAgKi9cbiAgICB2YXIgU3dlZXAgPSB7fTtcblxuXG4gICAgLyoqXG4gICAgICogVHJpYW5ndWxhdGUgdGhlIHBvbHlnb24gd2l0aCBob2xlcyBhbmQgU3RlaW5lciBwb2ludHMuXG4gICAgICogQHBhcmFtICAgdGN4IFN3ZWVwQ29udGV4dCBvYmplY3QuXG4gICAgICovXG4gICAgU3dlZXAudHJpYW5ndWxhdGUgPSBmdW5jdGlvbih0Y3gpIHtcbiAgICAgICAgdGN4LmluaXRUcmlhbmd1bGF0aW9uKCk7XG4gICAgICAgIHRjeC5jcmVhdGVBZHZhbmNpbmdGcm9udCgpO1xuICAgICAgICAvLyBTd2VlcCBwb2ludHM7IGJ1aWxkIG1lc2hcbiAgICAgICAgU3dlZXAuc3dlZXBQb2ludHModGN4KTtcbiAgICAgICAgLy8gQ2xlYW4gdXBcbiAgICAgICAgU3dlZXAuZmluYWxpemF0aW9uUG9seWdvbih0Y3gpO1xuICAgIH07XG5cbiAgICBTd2VlcC5zd2VlcFBvaW50cyA9IGZ1bmN0aW9uKHRjeCkge1xuICAgICAgICB2YXIgaSwgbGVuID0gdGN4LnBvaW50Q291bnQoKTtcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgICAgICB2YXIgcG9pbnQgPSB0Y3guZ2V0UG9pbnQoaSk7XG4gICAgICAgICAgICB2YXIgbm9kZSA9IFN3ZWVwLnBvaW50RXZlbnQodGN4LCBwb2ludCk7XG4gICAgICAgICAgICB2YXIgZWRnZXMgPSBwb2ludC5fcDJ0X2VkZ2VfbGlzdDtcbiAgICAgICAgICAgIGZvciAodmFyIGogPSAwOyBlZGdlcyAmJiBqIDwgZWRnZXMubGVuZ3RoOyArK2opIHtcbiAgICAgICAgICAgICAgICBTd2VlcC5lZGdlRXZlbnRCeUVkZ2UodGN4LCBlZGdlc1tqXSwgbm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgU3dlZXAuZmluYWxpemF0aW9uUG9seWdvbiA9IGZ1bmN0aW9uKHRjeCkge1xuICAgICAgICAvLyBHZXQgYW4gSW50ZXJuYWwgdHJpYW5nbGUgdG8gc3RhcnQgd2l0aFxuICAgICAgICB2YXIgdCA9IHRjeC5mcm9udCgpLmhlYWQoKS5uZXh0LnRyaWFuZ2xlO1xuICAgICAgICB2YXIgcCA9IHRjeC5mcm9udCgpLmhlYWQoKS5uZXh0LnBvaW50O1xuICAgICAgICB3aGlsZSAoIXQuZ2V0Q29uc3RyYWluZWRFZGdlQ1cocCkpIHtcbiAgICAgICAgICAgIHQgPSB0Lm5laWdoYm9yQ0NXKHApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ29sbGVjdCBpbnRlcmlvciB0cmlhbmdsZXMgY29uc3RyYWluZWQgYnkgZWRnZXNcbiAgICAgICAgdGN4Lm1lc2hDbGVhbih0KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogRmluZCBjbG9zZXMgbm9kZSB0byB0aGUgbGVmdCBvZiB0aGUgbmV3IHBvaW50IGFuZFxuICAgICAqIGNyZWF0ZSBhIG5ldyB0cmlhbmdsZS4gSWYgbmVlZGVkIG5ldyBob2xlcyBhbmQgYmFzaW5zXG4gICAgICogd2lsbCBiZSBmaWxsZWQgdG8uXG4gICAgICovXG4gICAgU3dlZXAucG9pbnRFdmVudCA9IGZ1bmN0aW9uKHRjeCwgcG9pbnQpIHtcbiAgICAgICAgdmFyIG5vZGUgPSB0Y3gubG9jYXRlTm9kZShwb2ludCk7XG4gICAgICAgIHZhciBuZXdfbm9kZSA9IFN3ZWVwLm5ld0Zyb250VHJpYW5nbGUodGN4LCBwb2ludCwgbm9kZSk7XG5cbiAgICAgICAgLy8gT25seSBuZWVkIHRvIGNoZWNrICtlcHNpbG9uIHNpbmNlIHBvaW50IG5ldmVyIGhhdmUgc21hbGxlclxuICAgICAgICAvLyB4IHZhbHVlIHRoYW4gbm9kZSBkdWUgdG8gaG93IHdlIGZldGNoIG5vZGVzIGZyb20gdGhlIGZyb250XG4gICAgICAgIGlmIChwb2ludC54IDw9IG5vZGUucG9pbnQueCArIChFUFNJTE9OKSkge1xuICAgICAgICAgICAgU3dlZXAuZmlsbCh0Y3gsIG5vZGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy90Y3guQWRkTm9kZShuZXdfbm9kZSk7XG5cbiAgICAgICAgU3dlZXAuZmlsbEFkdmFuY2luZ0Zyb250KHRjeCwgbmV3X25vZGUpO1xuICAgICAgICByZXR1cm4gbmV3X25vZGU7XG4gICAgfTtcblxuICAgIFN3ZWVwLmVkZ2VFdmVudEJ5RWRnZSA9IGZ1bmN0aW9uKHRjeCwgZWRnZSwgbm9kZSkge1xuICAgICAgICB0Y3guZWRnZV9ldmVudC5jb25zdHJhaW5lZF9lZGdlID0gZWRnZTtcbiAgICAgICAgdGN4LmVkZ2VfZXZlbnQucmlnaHQgPSAoZWRnZS5wLnggPiBlZGdlLnEueCk7XG5cbiAgICAgICAgaWYgKFN3ZWVwLmlzRWRnZVNpZGVPZlRyaWFuZ2xlKG5vZGUudHJpYW5nbGUsIGVkZ2UucCwgZWRnZS5xKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRm9yIG5vdyB3ZSB3aWxsIGRvIGFsbCBuZWVkZWQgZmlsbGluZ1xuICAgICAgICAvLyBUT0RPOiBpbnRlZ3JhdGUgd2l0aCBmbGlwIHByb2Nlc3MgbWlnaHQgZ2l2ZSBzb21lIGJldHRlciBwZXJmb3JtYW5jZVxuICAgICAgICAvLyAgICAgICBidXQgZm9yIG5vdyB0aGlzIGF2b2lkIHRoZSBpc3N1ZSB3aXRoIGNhc2VzIHRoYXQgbmVlZHMgYm90aCBmbGlwcyBhbmQgZmlsbHNcbiAgICAgICAgU3dlZXAuZmlsbEVkZ2VFdmVudCh0Y3gsIGVkZ2UsIG5vZGUpO1xuICAgICAgICBTd2VlcC5lZGdlRXZlbnRCeVBvaW50cyh0Y3gsIGVkZ2UucCwgZWRnZS5xLCBub2RlLnRyaWFuZ2xlLCBlZGdlLnEpO1xuICAgIH07XG5cbiAgICBTd2VlcC5lZGdlRXZlbnRCeVBvaW50cyA9IGZ1bmN0aW9uKHRjeCwgZXAsIGVxLCB0cmlhbmdsZSwgcG9pbnQpIHtcbiAgICAgICAgaWYgKFN3ZWVwLmlzRWRnZVNpZGVPZlRyaWFuZ2xlKHRyaWFuZ2xlLCBlcCwgZXEpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgcDEgPSB0cmlhbmdsZS5wb2ludENDVyhwb2ludCk7XG4gICAgICAgIHZhciBvMSA9IG9yaWVudDJkKGVxLCBwMSwgZXApO1xuICAgICAgICBpZiAobzEgPT09IE9yaWVudGF0aW9uLkNPTExJTkVBUikge1xuICAgICAgICAgICAgLy8gVE9ETyBpbnRlZ3JhdGUgaGVyZSBjaGFuZ2VzIGZyb20gQysrIHZlcnNpb25cbiAgICAgICAgICAgIHRocm93IG5ldyBQb2ludEVycm9yKCdwb2x5MnRyaSBFZGdlRXZlbnQ6IENvbGxpbmVhciBub3Qgc3VwcG9ydGVkIScsIFtlcSwgcDEsIGVwXSk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgcDIgPSB0cmlhbmdsZS5wb2ludENXKHBvaW50KTtcbiAgICAgICAgdmFyIG8yID0gb3JpZW50MmQoZXEsIHAyLCBlcCk7XG4gICAgICAgIGlmIChvMiA9PT0gT3JpZW50YXRpb24uQ09MTElORUFSKSB7XG4gICAgICAgICAgICAvLyBUT0RPIGludGVncmF0ZSBoZXJlIGNoYW5nZXMgZnJvbSBDKysgdmVyc2lvblxuICAgICAgICAgICAgdGhyb3cgbmV3IFBvaW50RXJyb3IoJ3BvbHkydHJpIEVkZ2VFdmVudDogQ29sbGluZWFyIG5vdCBzdXBwb3J0ZWQhJywgW2VxLCBwMiwgZXBdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvMSA9PT0gbzIpIHtcbiAgICAgICAgICAgIC8vIE5lZWQgdG8gZGVjaWRlIGlmIHdlIGFyZSByb3RhdGluZyBDVyBvciBDQ1cgdG8gZ2V0IHRvIGEgdHJpYW5nbGVcbiAgICAgICAgICAgIC8vIHRoYXQgd2lsbCBjcm9zcyBlZGdlXG4gICAgICAgICAgICBpZiAobzEgPT09IE9yaWVudGF0aW9uLkNXKSB7XG4gICAgICAgICAgICAgICAgdHJpYW5nbGUgPSB0cmlhbmdsZS5uZWlnaGJvckNDVyhwb2ludCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRyaWFuZ2xlID0gdHJpYW5nbGUubmVpZ2hib3JDVyhwb2ludCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBTd2VlcC5lZGdlRXZlbnRCeVBvaW50cyh0Y3gsIGVwLCBlcSwgdHJpYW5nbGUsIHBvaW50KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFRoaXMgdHJpYW5nbGUgY3Jvc3NlcyBjb25zdHJhaW50IHNvIGxldHMgZmxpcHBpbiBzdGFydCFcbiAgICAgICAgICAgIFN3ZWVwLmZsaXBFZGdlRXZlbnQodGN4LCBlcCwgZXEsIHRyaWFuZ2xlLCBwb2ludCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgU3dlZXAuaXNFZGdlU2lkZU9mVHJpYW5nbGUgPSBmdW5jdGlvbih0cmlhbmdsZSwgZXAsIGVxKSB7XG4gICAgICAgIHZhciBpbmRleCA9IHRyaWFuZ2xlLmVkZ2VJbmRleChlcCwgZXEpO1xuICAgICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgICB0cmlhbmdsZS5tYXJrQ29uc3RyYWluZWRFZGdlQnlJbmRleChpbmRleCk7XG4gICAgICAgICAgICB2YXIgdCA9IHRyaWFuZ2xlLmdldE5laWdoYm9yKGluZGV4KTtcbiAgICAgICAgICAgIGlmICh0KSB7XG4gICAgICAgICAgICAgICAgdC5tYXJrQ29uc3RyYWluZWRFZGdlQnlQb2ludHMoZXAsIGVxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9O1xuXG4gICAgU3dlZXAubmV3RnJvbnRUcmlhbmdsZSA9IGZ1bmN0aW9uKHRjeCwgcG9pbnQsIG5vZGUpIHtcbiAgICAgICAgdmFyIHRyaWFuZ2xlID0gbmV3IFRyaWFuZ2xlKHBvaW50LCBub2RlLnBvaW50LCBub2RlLm5leHQucG9pbnQpO1xuXG4gICAgICAgIHRyaWFuZ2xlLm1hcmtOZWlnaGJvcihub2RlLnRyaWFuZ2xlKTtcbiAgICAgICAgdGN4LmFkZFRvTWFwKHRyaWFuZ2xlKTtcblxuICAgICAgICB2YXIgbmV3X25vZGUgPSBuZXcgTm9kZShwb2ludCk7XG4gICAgICAgIG5ld19ub2RlLm5leHQgPSBub2RlLm5leHQ7XG4gICAgICAgIG5ld19ub2RlLnByZXYgPSBub2RlO1xuICAgICAgICBub2RlLm5leHQucHJldiA9IG5ld19ub2RlO1xuICAgICAgICBub2RlLm5leHQgPSBuZXdfbm9kZTtcblxuICAgICAgICBpZiAoIVN3ZWVwLmxlZ2FsaXplKHRjeCwgdHJpYW5nbGUpKSB7XG4gICAgICAgICAgICB0Y3gubWFwVHJpYW5nbGVUb05vZGVzKHRyaWFuZ2xlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuZXdfbm9kZTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQWRkcyBhIHRyaWFuZ2xlIHRvIHRoZSBhZHZhbmNpbmcgZnJvbnQgdG8gZmlsbCBhIGhvbGUuXG4gICAgICogQHBhcmFtIHRjeFxuICAgICAqIEBwYXJhbSBub2RlIC0gbWlkZGxlIG5vZGUsIHRoYXQgaXMgdGhlIGJvdHRvbSBvZiB0aGUgaG9sZVxuICAgICAqL1xuICAgIFN3ZWVwLmZpbGwgPSBmdW5jdGlvbih0Y3gsIG5vZGUpIHtcbiAgICAgICAgdmFyIHRyaWFuZ2xlID0gbmV3IFRyaWFuZ2xlKG5vZGUucHJldi5wb2ludCwgbm9kZS5wb2ludCwgbm9kZS5uZXh0LnBvaW50KTtcblxuICAgICAgICAvLyBUT0RPOiBzaG91bGQgY29weSB0aGUgY29uc3RyYWluZWRfZWRnZSB2YWx1ZSBmcm9tIG5laWdoYm9yIHRyaWFuZ2xlc1xuICAgICAgICAvLyAgICAgICBmb3Igbm93IGNvbnN0cmFpbmVkX2VkZ2UgdmFsdWVzIGFyZSBjb3BpZWQgZHVyaW5nIHRoZSBsZWdhbGl6ZVxuICAgICAgICB0cmlhbmdsZS5tYXJrTmVpZ2hib3Iobm9kZS5wcmV2LnRyaWFuZ2xlKTtcbiAgICAgICAgdHJpYW5nbGUubWFya05laWdoYm9yKG5vZGUudHJpYW5nbGUpO1xuXG4gICAgICAgIHRjeC5hZGRUb01hcCh0cmlhbmdsZSk7XG5cbiAgICAgICAgLy8gVXBkYXRlIHRoZSBhZHZhbmNpbmcgZnJvbnRcbiAgICAgICAgbm9kZS5wcmV2Lm5leHQgPSBub2RlLm5leHQ7XG4gICAgICAgIG5vZGUubmV4dC5wcmV2ID0gbm9kZS5wcmV2O1xuXG5cbiAgICAgICAgLy8gSWYgaXQgd2FzIGxlZ2FsaXplZCB0aGUgdHJpYW5nbGUgaGFzIGFscmVhZHkgYmVlbiBtYXBwZWRcbiAgICAgICAgaWYgKCFTd2VlcC5sZWdhbGl6ZSh0Y3gsIHRyaWFuZ2xlKSkge1xuICAgICAgICAgICAgdGN4Lm1hcFRyaWFuZ2xlVG9Ob2Rlcyh0cmlhbmdsZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvL3RjeC5yZW1vdmVOb2RlKG5vZGUpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBGaWxscyBob2xlcyBpbiB0aGUgQWR2YW5jaW5nIEZyb250XG4gICAgICovXG4gICAgU3dlZXAuZmlsbEFkdmFuY2luZ0Zyb250ID0gZnVuY3Rpb24odGN4LCBuKSB7XG4gICAgICAgIC8vIEZpbGwgcmlnaHQgaG9sZXNcbiAgICAgICAgdmFyIG5vZGUgPSBuLm5leHQ7XG4gICAgICAgIHZhciBhbmdsZTtcbiAgICAgICAgd2hpbGUgKG5vZGUubmV4dCkge1xuICAgICAgICAgICAgYW5nbGUgPSBTd2VlcC5ob2xlQW5nbGUobm9kZSk7XG4gICAgICAgICAgICBpZiAoYW5nbGUgPiBQSV8yIHx8IGFuZ2xlIDwgLShQSV8yKSkge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgU3dlZXAuZmlsbCh0Y3gsIG5vZGUpO1xuICAgICAgICAgICAgbm9kZSA9IG5vZGUubmV4dDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEZpbGwgbGVmdCBob2xlc1xuICAgICAgICBub2RlID0gbi5wcmV2O1xuICAgICAgICB3aGlsZSAobm9kZS5wcmV2KSB7XG4gICAgICAgICAgICBhbmdsZSA9IFN3ZWVwLmhvbGVBbmdsZShub2RlKTtcbiAgICAgICAgICAgIGlmIChhbmdsZSA+IFBJXzIgfHwgYW5nbGUgPCAtKFBJXzIpKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBTd2VlcC5maWxsKHRjeCwgbm9kZSk7XG4gICAgICAgICAgICBub2RlID0gbm9kZS5wcmV2O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRmlsbCByaWdodCBiYXNpbnNcbiAgICAgICAgaWYgKG4ubmV4dCAmJiBuLm5leHQubmV4dCkge1xuICAgICAgICAgICAgYW5nbGUgPSBTd2VlcC5iYXNpbkFuZ2xlKG4pO1xuICAgICAgICAgICAgaWYgKGFuZ2xlIDwgUElfM2RpdjQpIHtcbiAgICAgICAgICAgICAgICBTd2VlcC5maWxsQmFzaW4odGN4LCBuKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBTd2VlcC5iYXNpbkFuZ2xlID0gZnVuY3Rpb24obm9kZSkge1xuICAgICAgICB2YXIgYXggPSBub2RlLnBvaW50LnggLSBub2RlLm5leHQubmV4dC5wb2ludC54O1xuICAgICAgICB2YXIgYXkgPSBub2RlLnBvaW50LnkgLSBub2RlLm5leHQubmV4dC5wb2ludC55O1xuICAgICAgICByZXR1cm4gTWF0aC5hdGFuMihheSwgYXgpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSBub2RlIC0gbWlkZGxlIG5vZGVcbiAgICAgKiBAcmV0dXJuIHRoZSBhbmdsZSBiZXR3ZWVuIDMgZnJvbnQgbm9kZXNcbiAgICAgKi9cbiAgICBTd2VlcC5ob2xlQW5nbGUgPSBmdW5jdGlvbihub2RlKSB7XG4gICAgICAgIC8qIENvbXBsZXggcGxhbmVcbiAgICAgICAgICogYWIgPSBjb3NBICtpKnNpbkFcbiAgICAgICAgICogYWIgPSAoYXggKyBheSppKShieCArIGJ5KmkpID0gKGF4KmJ4ICsgYXkqYnkpICsgaShheCpieS1heSpieClcbiAgICAgICAgICogYXRhbjIoeSx4KSBjb21wdXRlcyB0aGUgcHJpbmNpcGFsIHZhbHVlIG9mIHRoZSBhcmd1bWVudCBmdW5jdGlvblxuICAgICAgICAgKiBhcHBsaWVkIHRvIHRoZSBjb21wbGV4IG51bWJlciB4K2l5XG4gICAgICAgICAqIFdoZXJlIHggPSBheCpieCArIGF5KmJ5XG4gICAgICAgICAqICAgICAgIHkgPSBheCpieSAtIGF5KmJ4XG4gICAgICAgICAqL1xuICAgICAgICB2YXIgYXggPSBub2RlLm5leHQucG9pbnQueCAtIG5vZGUucG9pbnQueDtcbiAgICAgICAgdmFyIGF5ID0gbm9kZS5uZXh0LnBvaW50LnkgLSBub2RlLnBvaW50Lnk7XG4gICAgICAgIHZhciBieCA9IG5vZGUucHJldi5wb2ludC54IC0gbm9kZS5wb2ludC54O1xuICAgICAgICB2YXIgYnkgPSBub2RlLnByZXYucG9pbnQueSAtIG5vZGUucG9pbnQueTtcbiAgICAgICAgcmV0dXJuIE1hdGguYXRhbjIoYXggKiBieSAtIGF5ICogYngsIGF4ICogYnggKyBheSAqIGJ5KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRyaWFuZ2xlIHdhcyBsZWdhbGl6ZWRcbiAgICAgKi9cbiAgICBTd2VlcC5sZWdhbGl6ZSA9IGZ1bmN0aW9uKHRjeCwgdCkge1xuICAgICAgICAvLyBUbyBsZWdhbGl6ZSBhIHRyaWFuZ2xlIHdlIHN0YXJ0IGJ5IGZpbmRpbmcgaWYgYW55IG9mIHRoZSB0aHJlZSBlZGdlc1xuICAgICAgICAvLyB2aW9sYXRlIHRoZSBEZWxhdW5heSBjb25kaXRpb25cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCAzOyArK2kpIHtcbiAgICAgICAgICAgIGlmICh0LmRlbGF1bmF5X2VkZ2VbaV0pIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBvdCA9IHQuZ2V0TmVpZ2hib3IoaSk7XG4gICAgICAgICAgICBpZiAob3QpIHtcbiAgICAgICAgICAgICAgICB2YXIgcCA9IHQuZ2V0UG9pbnQoaSk7XG4gICAgICAgICAgICAgICAgdmFyIG9wID0gb3Qub3Bwb3NpdGVQb2ludCh0LCBwKTtcbiAgICAgICAgICAgICAgICB2YXIgb2kgPSBvdC5pbmRleChvcCk7XG5cbiAgICAgICAgICAgICAgICAvLyBJZiB0aGlzIGlzIGEgQ29uc3RyYWluZWQgRWRnZSBvciBhIERlbGF1bmF5IEVkZ2Uob25seSBkdXJpbmcgcmVjdXJzaXZlIGxlZ2FsaXphdGlvbilcbiAgICAgICAgICAgICAgICAvLyB0aGVuIHdlIHNob3VsZCBub3QgdHJ5IHRvIGxlZ2FsaXplXG4gICAgICAgICAgICAgICAgaWYgKG90LmNvbnN0cmFpbmVkX2VkZ2Vbb2ldIHx8IG90LmRlbGF1bmF5X2VkZ2Vbb2ldKSB7XG4gICAgICAgICAgICAgICAgICAgIHQuY29uc3RyYWluZWRfZWRnZVtpXSA9IG90LmNvbnN0cmFpbmVkX2VkZ2Vbb2ldO1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2YXIgaW5zaWRlID0gU3dlZXAuaW5DaXJjbGUocCwgdC5wb2ludENDVyhwKSwgdC5wb2ludENXKHApLCBvcCk7XG4gICAgICAgICAgICAgICAgaWYgKGluc2lkZSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBMZXRzIG1hcmsgdGhpcyBzaGFyZWQgZWRnZSBhcyBEZWxhdW5heVxuICAgICAgICAgICAgICAgICAgICB0LmRlbGF1bmF5X2VkZ2VbaV0gPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBvdC5kZWxhdW5heV9lZGdlW29pXSA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gTGV0cyByb3RhdGUgc2hhcmVkIGVkZ2Ugb25lIHZlcnRleCBDVyB0byBsZWdhbGl6ZSBpdFxuICAgICAgICAgICAgICAgICAgICBTd2VlcC5yb3RhdGVUcmlhbmdsZVBhaXIodCwgcCwgb3QsIG9wKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBXZSBub3cgZ290IG9uZSB2YWxpZCBEZWxhdW5heSBFZGdlIHNoYXJlZCBieSB0d28gdHJpYW5nbGVzXG4gICAgICAgICAgICAgICAgICAgIC8vIFRoaXMgZ2l2ZXMgdXMgNCBuZXcgZWRnZXMgdG8gY2hlY2sgZm9yIERlbGF1bmF5XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gTWFrZSBzdXJlIHRoYXQgdHJpYW5nbGUgdG8gbm9kZSBtYXBwaW5nIGlzIGRvbmUgb25seSBvbmUgdGltZSBmb3IgYSBzcGVjaWZpYyB0cmlhbmdsZVxuICAgICAgICAgICAgICAgICAgICB2YXIgbm90X2xlZ2FsaXplZCA9ICFTd2VlcC5sZWdhbGl6ZSh0Y3gsIHQpO1xuICAgICAgICAgICAgICAgICAgICBpZiAobm90X2xlZ2FsaXplZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGN4Lm1hcFRyaWFuZ2xlVG9Ob2Rlcyh0KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIG5vdF9sZWdhbGl6ZWQgPSAhU3dlZXAubGVnYWxpemUodGN4LCBvdCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChub3RfbGVnYWxpemVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0Y3gubWFwVHJpYW5nbGVUb05vZGVzKG90KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBSZXNldCB0aGUgRGVsYXVuYXkgZWRnZXMsIHNpbmNlIHRoZXkgb25seSBhcmUgdmFsaWQgRGVsYXVuYXkgZWRnZXNcbiAgICAgICAgICAgICAgICAgICAgLy8gdW50aWwgd2UgYWRkIGEgbmV3IHRyaWFuZ2xlIG9yIHBvaW50LlxuICAgICAgICAgICAgICAgICAgICAvLyBYWFg6IG5lZWQgdG8gdGhpbmsgYWJvdXQgdGhpcy4gQ2FuIHRoZXNlIGVkZ2VzIGJlIHRyaWVkIGFmdGVyIHdlXG4gICAgICAgICAgICAgICAgICAgIC8vICAgICAgcmV0dXJuIHRvIHByZXZpb3VzIHJlY3Vyc2l2ZSBsZXZlbD9cbiAgICAgICAgICAgICAgICAgICAgdC5kZWxhdW5heV9lZGdlW2ldID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIG90LmRlbGF1bmF5X2VkZ2Vbb2ldID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gSWYgdHJpYW5nbGUgaGF2ZSBiZWVuIGxlZ2FsaXplZCBubyBuZWVkIHRvIGNoZWNrIHRoZSBvdGhlciBlZGdlcyBzaW5jZVxuICAgICAgICAgICAgICAgICAgICAvLyB0aGUgcmVjdXJzaXZlIGxlZ2FsaXphdGlvbiB3aWxsIGhhbmRsZXMgdGhvc2Ugc28gd2UgY2FuIGVuZCBoZXJlLlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiA8Yj5SZXF1aXJlbWVudDwvYj46PGJyPlxuICAgICAqIDEuIGEsYiBhbmQgYyBmb3JtIGEgdHJpYW5nbGUuPGJyPlxuICAgICAqIDIuIGEgYW5kIGQgaXMga25vdyB0byBiZSBvbiBvcHBvc2l0ZSBzaWRlIG9mIGJjPGJyPlxuICAgICAqIDxwcmU+XG4gICAgICogICAgICAgICAgICAgICAgYVxuICAgICAqICAgICAgICAgICAgICAgICtcbiAgICAgKiAgICAgICAgICAgICAgIC8gXFxcbiAgICAgKiAgICAgICAgICAgICAgLyAgIFxcXG4gICAgICogICAgICAgICAgICBiLyAgICAgXFxjXG4gICAgICogICAgICAgICAgICArLS0tLS0tLStcbiAgICAgKiAgICAgICAgICAgLyAgICBkICAgIFxcXG4gICAgICogICAgICAgICAgLyAgICAgICAgICAgXFxcbiAgICAgKiA8L3ByZT5cbiAgICAgKiA8Yj5GYWN0PC9iPjogZCBoYXMgdG8gYmUgaW4gYXJlYSBCIHRvIGhhdmUgYSBjaGFuY2UgdG8gYmUgaW5zaWRlIHRoZSBjaXJjbGUgZm9ybWVkIGJ5XG4gICAgICogIGEsYiBhbmQgYzxicj5cbiAgICAgKiAgZCBpcyBvdXRzaWRlIEIgaWYgb3JpZW50MmQoYSxiLGQpIG9yIG9yaWVudDJkKGMsYSxkKSBpcyBDVzxicj5cbiAgICAgKiAgVGhpcyBwcmVrbm93bGVkZ2UgZ2l2ZXMgdXMgYSB3YXkgdG8gb3B0aW1pemUgdGhlIGluY2lyY2xlIHRlc3RcbiAgICAgKiBAcGFyYW0gcGEgLSB0cmlhbmdsZSBwb2ludCwgb3Bwb3NpdGUgZFxuICAgICAqIEBwYXJhbSBwYiAtIHRyaWFuZ2xlIHBvaW50XG4gICAgICogQHBhcmFtIHBjIC0gdHJpYW5nbGUgcG9pbnRcbiAgICAgKiBAcGFyYW0gcGQgLSBwb2ludCBvcHBvc2l0ZSBhXG4gICAgICogQHJldHVybiB0cnVlIGlmIGQgaXMgaW5zaWRlIGNpcmNsZSwgZmFsc2UgaWYgb24gY2lyY2xlIGVkZ2VcbiAgICAgKi9cbiAgICBTd2VlcC5pbkNpcmNsZSA9IGZ1bmN0aW9uKHBhLCBwYiwgcGMsIHBkKSB7XG4gICAgICAgIHZhciBhZHggPSBwYS54IC0gcGQueDtcbiAgICAgICAgdmFyIGFkeSA9IHBhLnkgLSBwZC55O1xuICAgICAgICB2YXIgYmR4ID0gcGIueCAtIHBkLng7XG4gICAgICAgIHZhciBiZHkgPSBwYi55IC0gcGQueTtcblxuICAgICAgICB2YXIgYWR4YmR5ID0gYWR4ICogYmR5O1xuICAgICAgICB2YXIgYmR4YWR5ID0gYmR4ICogYWR5O1xuICAgICAgICB2YXIgb2FiZCA9IGFkeGJkeSAtIGJkeGFkeTtcbiAgICAgICAgaWYgKG9hYmQgPD0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGNkeCA9IHBjLnggLSBwZC54O1xuICAgICAgICB2YXIgY2R5ID0gcGMueSAtIHBkLnk7XG5cbiAgICAgICAgdmFyIGNkeGFkeSA9IGNkeCAqIGFkeTtcbiAgICAgICAgdmFyIGFkeGNkeSA9IGFkeCAqIGNkeTtcbiAgICAgICAgdmFyIG9jYWQgPSBjZHhhZHkgLSBhZHhjZHk7XG4gICAgICAgIGlmIChvY2FkIDw9IDApIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBiZHhjZHkgPSBiZHggKiBjZHk7XG4gICAgICAgIHZhciBjZHhiZHkgPSBjZHggKiBiZHk7XG5cbiAgICAgICAgdmFyIGFsaWZ0ID0gYWR4ICogYWR4ICsgYWR5ICogYWR5O1xuICAgICAgICB2YXIgYmxpZnQgPSBiZHggKiBiZHggKyBiZHkgKiBiZHk7XG4gICAgICAgIHZhciBjbGlmdCA9IGNkeCAqIGNkeCArIGNkeSAqIGNkeTtcblxuICAgICAgICB2YXIgZGV0ID0gYWxpZnQgKiAoYmR4Y2R5IC0gY2R4YmR5KSArIGJsaWZ0ICogb2NhZCArIGNsaWZ0ICogb2FiZDtcbiAgICAgICAgcmV0dXJuIGRldCA+IDA7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFJvdGF0ZXMgYSB0cmlhbmdsZSBwYWlyIG9uZSB2ZXJ0ZXggQ1dcbiAgICAgKjxwcmU+XG4gICAgICogICAgICAgbjIgICAgICAgICAgICAgICAgICAgIG4yXG4gICAgICogIFAgKy0tLS0tKyAgICAgICAgICAgICBQICstLS0tLStcbiAgICAgKiAgICB8IHQgIC98ICAgICAgICAgICAgICAgfFxcICB0IHxcbiAgICAgKiAgICB8ICAgLyB8ICAgICAgICAgICAgICAgfCBcXCAgIHxcbiAgICAgKiAgbjF8ICAvICB8bjMgICAgICAgICAgIG4xfCAgXFwgIHxuM1xuICAgICAqICAgIHwgLyAgIHwgICAgYWZ0ZXIgQ1cgICB8ICAgXFwgfFxuICAgICAqICAgIHwvIG9UIHwgICAgICAgICAgICAgICB8IG9UIFxcfFxuICAgICAqICAgICstLS0tLSsgb1AgICAgICAgICAgICArLS0tLS0rXG4gICAgICogICAgICAgbjQgICAgICAgICAgICAgICAgICAgIG40XG4gICAgICogPC9wcmU+XG4gICAgICovXG4gICAgU3dlZXAucm90YXRlVHJpYW5nbGVQYWlyID0gZnVuY3Rpb24odCwgcCwgb3QsIG9wKSB7XG4gICAgICAgIHZhciBuMSwgbjIsIG4zLCBuNDtcbiAgICAgICAgbjEgPSB0Lm5laWdoYm9yQ0NXKHApO1xuICAgICAgICBuMiA9IHQubmVpZ2hib3JDVyhwKTtcbiAgICAgICAgbjMgPSBvdC5uZWlnaGJvckNDVyhvcCk7XG4gICAgICAgIG40ID0gb3QubmVpZ2hib3JDVyhvcCk7XG5cbiAgICAgICAgdmFyIGNlMSwgY2UyLCBjZTMsIGNlNDtcbiAgICAgICAgY2UxID0gdC5nZXRDb25zdHJhaW5lZEVkZ2VDQ1cocCk7XG4gICAgICAgIGNlMiA9IHQuZ2V0Q29uc3RyYWluZWRFZGdlQ1cocCk7XG4gICAgICAgIGNlMyA9IG90LmdldENvbnN0cmFpbmVkRWRnZUNDVyhvcCk7XG4gICAgICAgIGNlNCA9IG90LmdldENvbnN0cmFpbmVkRWRnZUNXKG9wKTtcblxuICAgICAgICB2YXIgZGUxLCBkZTIsIGRlMywgZGU0O1xuICAgICAgICBkZTEgPSB0LmdldERlbGF1bmF5RWRnZUNDVyhwKTtcbiAgICAgICAgZGUyID0gdC5nZXREZWxhdW5heUVkZ2VDVyhwKTtcbiAgICAgICAgZGUzID0gb3QuZ2V0RGVsYXVuYXlFZGdlQ0NXKG9wKTtcbiAgICAgICAgZGU0ID0gb3QuZ2V0RGVsYXVuYXlFZGdlQ1cob3ApO1xuXG4gICAgICAgIHQubGVnYWxpemUocCwgb3ApO1xuICAgICAgICBvdC5sZWdhbGl6ZShvcCwgcCk7XG5cbiAgICAgICAgLy8gUmVtYXAgZGVsYXVuYXlfZWRnZVxuICAgICAgICBvdC5zZXREZWxhdW5heUVkZ2VDQ1cocCwgZGUxKTtcbiAgICAgICAgdC5zZXREZWxhdW5heUVkZ2VDVyhwLCBkZTIpO1xuICAgICAgICB0LnNldERlbGF1bmF5RWRnZUNDVyhvcCwgZGUzKTtcbiAgICAgICAgb3Quc2V0RGVsYXVuYXlFZGdlQ1cob3AsIGRlNCk7XG5cbiAgICAgICAgLy8gUmVtYXAgY29uc3RyYWluZWRfZWRnZVxuICAgICAgICBvdC5zZXRDb25zdHJhaW5lZEVkZ2VDQ1cocCwgY2UxKTtcbiAgICAgICAgdC5zZXRDb25zdHJhaW5lZEVkZ2VDVyhwLCBjZTIpO1xuICAgICAgICB0LnNldENvbnN0cmFpbmVkRWRnZUNDVyhvcCwgY2UzKTtcbiAgICAgICAgb3Quc2V0Q29uc3RyYWluZWRFZGdlQ1cob3AsIGNlNCk7XG5cbiAgICAgICAgLy8gUmVtYXAgbmVpZ2hib3JzXG4gICAgICAgIC8vIFhYWDogbWlnaHQgb3B0aW1pemUgdGhlIG1hcmtOZWlnaGJvciBieSBrZWVwaW5nIHRyYWNrIG9mXG4gICAgICAgIC8vICAgICAgd2hhdCBzaWRlIHNob3VsZCBiZSBhc3NpZ25lZCB0byB3aGF0IG5laWdoYm9yIGFmdGVyIHRoZVxuICAgICAgICAvLyAgICAgIHJvdGF0aW9uLiBOb3cgbWFyayBuZWlnaGJvciBkb2VzIGxvdHMgb2YgdGVzdGluZyB0byBmaW5kXG4gICAgICAgIC8vICAgICAgdGhlIHJpZ2h0IHNpZGUuXG4gICAgICAgIHQuY2xlYXJOZWlnYm9ycygpO1xuICAgICAgICBvdC5jbGVhck5laWdib3JzKCk7XG4gICAgICAgIGlmIChuMSkge1xuICAgICAgICAgICAgb3QubWFya05laWdoYm9yKG4xKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobjIpIHtcbiAgICAgICAgICAgIHQubWFya05laWdoYm9yKG4yKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobjMpIHtcbiAgICAgICAgICAgIHQubWFya05laWdoYm9yKG4zKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobjQpIHtcbiAgICAgICAgICAgIG90Lm1hcmtOZWlnaGJvcihuNCk7XG4gICAgICAgIH1cbiAgICAgICAgdC5tYXJrTmVpZ2hib3Iob3QpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBGaWxscyBhIGJhc2luIHRoYXQgaGFzIGZvcm1lZCBvbiB0aGUgQWR2YW5jaW5nIEZyb250IHRvIHRoZSByaWdodFxuICAgICAqIG9mIGdpdmVuIG5vZGUuPGJyPlxuICAgICAqIEZpcnN0IHdlIGRlY2lkZSBhIGxlZnQsYm90dG9tIGFuZCByaWdodCBub2RlIHRoYXQgZm9ybXMgdGhlXG4gICAgICogYm91bmRhcmllcyBvZiB0aGUgYmFzaW4uIFRoZW4gd2UgZG8gYSByZXF1cnNpdmUgZmlsbC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB0Y3hcbiAgICAgKiBAcGFyYW0gbm9kZSAtIHN0YXJ0aW5nIG5vZGUsIHRoaXMgb3IgbmV4dCBub2RlIHdpbGwgYmUgbGVmdCBub2RlXG4gICAgICovXG4gICAgU3dlZXAuZmlsbEJhc2luID0gZnVuY3Rpb24odGN4LCBub2RlKSB7XG4gICAgICAgIGlmIChvcmllbnQyZChub2RlLnBvaW50LCBub2RlLm5leHQucG9pbnQsIG5vZGUubmV4dC5uZXh0LnBvaW50KSA9PT0gT3JpZW50YXRpb24uQ0NXKSB7XG4gICAgICAgICAgICB0Y3guYmFzaW4ubGVmdF9ub2RlID0gbm9kZS5uZXh0Lm5leHQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0Y3guYmFzaW4ubGVmdF9ub2RlID0gbm9kZS5uZXh0O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRmluZCB0aGUgYm90dG9tIGFuZCByaWdodCBub2RlXG4gICAgICAgIHRjeC5iYXNpbi5ib3R0b21fbm9kZSA9IHRjeC5iYXNpbi5sZWZ0X25vZGU7XG4gICAgICAgIHdoaWxlICh0Y3guYmFzaW4uYm90dG9tX25vZGUubmV4dCAmJiB0Y3guYmFzaW4uYm90dG9tX25vZGUucG9pbnQueSA+PSB0Y3guYmFzaW4uYm90dG9tX25vZGUubmV4dC5wb2ludC55KSB7XG4gICAgICAgICAgICB0Y3guYmFzaW4uYm90dG9tX25vZGUgPSB0Y3guYmFzaW4uYm90dG9tX25vZGUubmV4dDtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGN4LmJhc2luLmJvdHRvbV9ub2RlID09PSB0Y3guYmFzaW4ubGVmdF9ub2RlKSB7XG4gICAgICAgICAgICAvLyBObyB2YWxpZCBiYXNpblxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGN4LmJhc2luLnJpZ2h0X25vZGUgPSB0Y3guYmFzaW4uYm90dG9tX25vZGU7XG4gICAgICAgIHdoaWxlICh0Y3guYmFzaW4ucmlnaHRfbm9kZS5uZXh0ICYmIHRjeC5iYXNpbi5yaWdodF9ub2RlLnBvaW50LnkgPCB0Y3guYmFzaW4ucmlnaHRfbm9kZS5uZXh0LnBvaW50LnkpIHtcbiAgICAgICAgICAgIHRjeC5iYXNpbi5yaWdodF9ub2RlID0gdGN4LmJhc2luLnJpZ2h0X25vZGUubmV4dDtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGN4LmJhc2luLnJpZ2h0X25vZGUgPT09IHRjeC5iYXNpbi5ib3R0b21fbm9kZSkge1xuICAgICAgICAgICAgLy8gTm8gdmFsaWQgYmFzaW5zXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0Y3guYmFzaW4ud2lkdGggPSB0Y3guYmFzaW4ucmlnaHRfbm9kZS5wb2ludC54IC0gdGN4LmJhc2luLmxlZnRfbm9kZS5wb2ludC54O1xuICAgICAgICB0Y3guYmFzaW4ubGVmdF9oaWdoZXN0ID0gdGN4LmJhc2luLmxlZnRfbm9kZS5wb2ludC55ID4gdGN4LmJhc2luLnJpZ2h0X25vZGUucG9pbnQueTtcblxuICAgICAgICBTd2VlcC5maWxsQmFzaW5SZXEodGN4LCB0Y3guYmFzaW4uYm90dG9tX25vZGUpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBSZWN1cnNpdmUgYWxnb3JpdGhtIHRvIGZpbGwgYSBCYXNpbiB3aXRoIHRyaWFuZ2xlc1xuICAgICAqXG4gICAgICogQHBhcmFtIHRjeFxuICAgICAqIEBwYXJhbSBub2RlIC0gYm90dG9tX25vZGVcbiAgICAgKi9cbiAgICBTd2VlcC5maWxsQmFzaW5SZXEgPSBmdW5jdGlvbih0Y3gsIG5vZGUpIHtcbiAgICAgICAgLy8gaWYgc2hhbGxvdyBzdG9wIGZpbGxpbmdcbiAgICAgICAgaWYgKFN3ZWVwLmlzU2hhbGxvdyh0Y3gsIG5vZGUpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBTd2VlcC5maWxsKHRjeCwgbm9kZSk7XG5cbiAgICAgICAgdmFyIG87XG4gICAgICAgIGlmIChub2RlLnByZXYgPT09IHRjeC5iYXNpbi5sZWZ0X25vZGUgJiYgbm9kZS5uZXh0ID09PSB0Y3guYmFzaW4ucmlnaHRfbm9kZSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9IGVsc2UgaWYgKG5vZGUucHJldiA9PT0gdGN4LmJhc2luLmxlZnRfbm9kZSkge1xuICAgICAgICAgICAgbyA9IG9yaWVudDJkKG5vZGUucG9pbnQsIG5vZGUubmV4dC5wb2ludCwgbm9kZS5uZXh0Lm5leHQucG9pbnQpO1xuICAgICAgICAgICAgaWYgKG8gPT09IE9yaWVudGF0aW9uLkNXKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbm9kZSA9IG5vZGUubmV4dDtcbiAgICAgICAgfSBlbHNlIGlmIChub2RlLm5leHQgPT09IHRjeC5iYXNpbi5yaWdodF9ub2RlKSB7XG4gICAgICAgICAgICBvID0gb3JpZW50MmQobm9kZS5wb2ludCwgbm9kZS5wcmV2LnBvaW50LCBub2RlLnByZXYucHJldi5wb2ludCk7XG4gICAgICAgICAgICBpZiAobyA9PT0gT3JpZW50YXRpb24uQ0NXKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbm9kZSA9IG5vZGUucHJldjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIENvbnRpbnVlIHdpdGggdGhlIG5laWdoYm9yIG5vZGUgd2l0aCBsb3dlc3QgWSB2YWx1ZVxuICAgICAgICAgICAgaWYgKG5vZGUucHJldi5wb2ludC55IDwgbm9kZS5uZXh0LnBvaW50LnkpIHtcbiAgICAgICAgICAgICAgICBub2RlID0gbm9kZS5wcmV2O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBub2RlID0gbm9kZS5uZXh0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgU3dlZXAuZmlsbEJhc2luUmVxKHRjeCwgbm9kZSk7XG4gICAgfTtcblxuICAgIFN3ZWVwLmlzU2hhbGxvdyA9IGZ1bmN0aW9uKHRjeCwgbm9kZSkge1xuICAgICAgICB2YXIgaGVpZ2h0O1xuICAgICAgICBpZiAodGN4LmJhc2luLmxlZnRfaGlnaGVzdCkge1xuICAgICAgICAgICAgaGVpZ2h0ID0gdGN4LmJhc2luLmxlZnRfbm9kZS5wb2ludC55IC0gbm9kZS5wb2ludC55O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaGVpZ2h0ID0gdGN4LmJhc2luLnJpZ2h0X25vZGUucG9pbnQueSAtIG5vZGUucG9pbnQueTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIHNoYWxsb3cgc3RvcCBmaWxsaW5nXG4gICAgICAgIGlmICh0Y3guYmFzaW4ud2lkdGggPiBoZWlnaHQpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9O1xuXG4gICAgU3dlZXAuZmlsbEVkZ2VFdmVudCA9IGZ1bmN0aW9uKHRjeCwgZWRnZSwgbm9kZSkge1xuICAgICAgICBpZiAodGN4LmVkZ2VfZXZlbnQucmlnaHQpIHtcbiAgICAgICAgICAgIFN3ZWVwLmZpbGxSaWdodEFib3ZlRWRnZUV2ZW50KHRjeCwgZWRnZSwgbm9kZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBTd2VlcC5maWxsTGVmdEFib3ZlRWRnZUV2ZW50KHRjeCwgZWRnZSwgbm9kZSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgU3dlZXAuZmlsbFJpZ2h0QWJvdmVFZGdlRXZlbnQgPSBmdW5jdGlvbih0Y3gsIGVkZ2UsIG5vZGUpIHtcbiAgICAgICAgd2hpbGUgKG5vZGUubmV4dC5wb2ludC54IDwgZWRnZS5wLngpIHtcbiAgICAgICAgICAgIC8vIENoZWNrIGlmIG5leHQgbm9kZSBpcyBiZWxvdyB0aGUgZWRnZVxuICAgICAgICAgICAgaWYgKG9yaWVudDJkKGVkZ2UucSwgbm9kZS5uZXh0LnBvaW50LCBlZGdlLnApID09PSBPcmllbnRhdGlvbi5DQ1cpIHtcbiAgICAgICAgICAgICAgICBTd2VlcC5maWxsUmlnaHRCZWxvd0VkZ2VFdmVudCh0Y3gsIGVkZ2UsIG5vZGUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBub2RlID0gbm9kZS5uZXh0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIFN3ZWVwLmZpbGxSaWdodEJlbG93RWRnZUV2ZW50ID0gZnVuY3Rpb24odGN4LCBlZGdlLCBub2RlKSB7XG4gICAgICAgIGlmIChub2RlLnBvaW50LnggPCBlZGdlLnAueCkge1xuICAgICAgICAgICAgaWYgKG9yaWVudDJkKG5vZGUucG9pbnQsIG5vZGUubmV4dC5wb2ludCwgbm9kZS5uZXh0Lm5leHQucG9pbnQpID09PSBPcmllbnRhdGlvbi5DQ1cpIHtcbiAgICAgICAgICAgICAgICAvLyBDb25jYXZlXG4gICAgICAgICAgICAgICAgU3dlZXAuZmlsbFJpZ2h0Q29uY2F2ZUVkZ2VFdmVudCh0Y3gsIGVkZ2UsIG5vZGUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBDb252ZXhcbiAgICAgICAgICAgICAgICBTd2VlcC5maWxsUmlnaHRDb252ZXhFZGdlRXZlbnQodGN4LCBlZGdlLCBub2RlKTtcbiAgICAgICAgICAgICAgICAvLyBSZXRyeSB0aGlzIG9uZVxuICAgICAgICAgICAgICAgIFN3ZWVwLmZpbGxSaWdodEJlbG93RWRnZUV2ZW50KHRjeCwgZWRnZSwgbm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgU3dlZXAuZmlsbFJpZ2h0Q29uY2F2ZUVkZ2VFdmVudCA9IGZ1bmN0aW9uKHRjeCwgZWRnZSwgbm9kZSkge1xuICAgICAgICBTd2VlcC5maWxsKHRjeCwgbm9kZS5uZXh0KTtcbiAgICAgICAgaWYgKG5vZGUubmV4dC5wb2ludCAhPT0gZWRnZS5wKSB7XG4gICAgICAgICAgICAvLyBOZXh0IGFib3ZlIG9yIGJlbG93IGVkZ2U/XG4gICAgICAgICAgICBpZiAob3JpZW50MmQoZWRnZS5xLCBub2RlLm5leHQucG9pbnQsIGVkZ2UucCkgPT09IE9yaWVudGF0aW9uLkNDVykge1xuICAgICAgICAgICAgICAgIC8vIEJlbG93XG4gICAgICAgICAgICAgICAgaWYgKG9yaWVudDJkKG5vZGUucG9pbnQsIG5vZGUubmV4dC5wb2ludCwgbm9kZS5uZXh0Lm5leHQucG9pbnQpID09PSBPcmllbnRhdGlvbi5DQ1cpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gTmV4dCBpcyBjb25jYXZlXG4gICAgICAgICAgICAgICAgICAgIFN3ZWVwLmZpbGxSaWdodENvbmNhdmVFZGdlRXZlbnQodGN4LCBlZGdlLCBub2RlKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBOZXh0IGlzIGNvbnZleFxuICAgICAgICAgICAgICAgICAgICAvKiBqc2hpbnQgbm9lbXB0eTpmYWxzZSAqL1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBTd2VlcC5maWxsUmlnaHRDb252ZXhFZGdlRXZlbnQgPSBmdW5jdGlvbih0Y3gsIGVkZ2UsIG5vZGUpIHtcbiAgICAgICAgLy8gTmV4dCBjb25jYXZlIG9yIGNvbnZleD9cbiAgICAgICAgaWYgKG9yaWVudDJkKG5vZGUubmV4dC5wb2ludCwgbm9kZS5uZXh0Lm5leHQucG9pbnQsIG5vZGUubmV4dC5uZXh0Lm5leHQucG9pbnQpID09PSBPcmllbnRhdGlvbi5DQ1cpIHtcbiAgICAgICAgICAgIC8vIENvbmNhdmVcbiAgICAgICAgICAgIFN3ZWVwLmZpbGxSaWdodENvbmNhdmVFZGdlRXZlbnQodGN4LCBlZGdlLCBub2RlLm5leHQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gQ29udmV4XG4gICAgICAgICAgICAvLyBOZXh0IGFib3ZlIG9yIGJlbG93IGVkZ2U/XG4gICAgICAgICAgICBpZiAob3JpZW50MmQoZWRnZS5xLCBub2RlLm5leHQubmV4dC5wb2ludCwgZWRnZS5wKSA9PT0gT3JpZW50YXRpb24uQ0NXKSB7XG4gICAgICAgICAgICAgICAgLy8gQmVsb3dcbiAgICAgICAgICAgICAgICBTd2VlcC5maWxsUmlnaHRDb252ZXhFZGdlRXZlbnQodGN4LCBlZGdlLCBub2RlLm5leHQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBBYm92ZVxuICAgICAgICAgICAgICAgIC8qIGpzaGludCBub2VtcHR5OmZhbHNlICovXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgU3dlZXAuZmlsbExlZnRBYm92ZUVkZ2VFdmVudCA9IGZ1bmN0aW9uKHRjeCwgZWRnZSwgbm9kZSkge1xuICAgICAgICB3aGlsZSAobm9kZS5wcmV2LnBvaW50LnggPiBlZGdlLnAueCkge1xuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgbmV4dCBub2RlIGlzIGJlbG93IHRoZSBlZGdlXG4gICAgICAgICAgICBpZiAob3JpZW50MmQoZWRnZS5xLCBub2RlLnByZXYucG9pbnQsIGVkZ2UucCkgPT09IE9yaWVudGF0aW9uLkNXKSB7XG4gICAgICAgICAgICAgICAgU3dlZXAuZmlsbExlZnRCZWxvd0VkZ2VFdmVudCh0Y3gsIGVkZ2UsIG5vZGUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBub2RlID0gbm9kZS5wcmV2O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIFN3ZWVwLmZpbGxMZWZ0QmVsb3dFZGdlRXZlbnQgPSBmdW5jdGlvbih0Y3gsIGVkZ2UsIG5vZGUpIHtcbiAgICAgICAgaWYgKG5vZGUucG9pbnQueCA+IGVkZ2UucC54KSB7XG4gICAgICAgICAgICBpZiAob3JpZW50MmQobm9kZS5wb2ludCwgbm9kZS5wcmV2LnBvaW50LCBub2RlLnByZXYucHJldi5wb2ludCkgPT09IE9yaWVudGF0aW9uLkNXKSB7XG4gICAgICAgICAgICAgICAgLy8gQ29uY2F2ZVxuICAgICAgICAgICAgICAgIFN3ZWVwLmZpbGxMZWZ0Q29uY2F2ZUVkZ2VFdmVudCh0Y3gsIGVkZ2UsIG5vZGUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBDb252ZXhcbiAgICAgICAgICAgICAgICBTd2VlcC5maWxsTGVmdENvbnZleEVkZ2VFdmVudCh0Y3gsIGVkZ2UsIG5vZGUpO1xuICAgICAgICAgICAgICAgIC8vIFJldHJ5IHRoaXMgb25lXG4gICAgICAgICAgICAgICAgU3dlZXAuZmlsbExlZnRCZWxvd0VkZ2VFdmVudCh0Y3gsIGVkZ2UsIG5vZGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIFN3ZWVwLmZpbGxMZWZ0Q29udmV4RWRnZUV2ZW50ID0gZnVuY3Rpb24odGN4LCBlZGdlLCBub2RlKSB7XG4gICAgICAgIC8vIE5leHQgY29uY2F2ZSBvciBjb252ZXg/XG4gICAgICAgIGlmIChvcmllbnQyZChub2RlLnByZXYucG9pbnQsIG5vZGUucHJldi5wcmV2LnBvaW50LCBub2RlLnByZXYucHJldi5wcmV2LnBvaW50KSA9PT0gT3JpZW50YXRpb24uQ1cpIHtcbiAgICAgICAgICAgIC8vIENvbmNhdmVcbiAgICAgICAgICAgIFN3ZWVwLmZpbGxMZWZ0Q29uY2F2ZUVkZ2VFdmVudCh0Y3gsIGVkZ2UsIG5vZGUucHJldik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBDb252ZXhcbiAgICAgICAgICAgIC8vIE5leHQgYWJvdmUgb3IgYmVsb3cgZWRnZT9cbiAgICAgICAgICAgIGlmIChvcmllbnQyZChlZGdlLnEsIG5vZGUucHJldi5wcmV2LnBvaW50LCBlZGdlLnApID09PSBPcmllbnRhdGlvbi5DVykge1xuICAgICAgICAgICAgICAgIC8vIEJlbG93XG4gICAgICAgICAgICAgICAgU3dlZXAuZmlsbExlZnRDb252ZXhFZGdlRXZlbnQodGN4LCBlZGdlLCBub2RlLnByZXYpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBBYm92ZVxuICAgICAgICAgICAgICAgIC8qIGpzaGludCBub2VtcHR5OmZhbHNlICovXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgU3dlZXAuZmlsbExlZnRDb25jYXZlRWRnZUV2ZW50ID0gZnVuY3Rpb24odGN4LCBlZGdlLCBub2RlKSB7XG4gICAgICAgIFN3ZWVwLmZpbGwodGN4LCBub2RlLnByZXYpO1xuICAgICAgICBpZiAobm9kZS5wcmV2LnBvaW50ICE9PSBlZGdlLnApIHtcbiAgICAgICAgICAgIC8vIE5leHQgYWJvdmUgb3IgYmVsb3cgZWRnZT9cbiAgICAgICAgICAgIGlmIChvcmllbnQyZChlZGdlLnEsIG5vZGUucHJldi5wb2ludCwgZWRnZS5wKSA9PT0gT3JpZW50YXRpb24uQ1cpIHtcbiAgICAgICAgICAgICAgICAvLyBCZWxvd1xuICAgICAgICAgICAgICAgIGlmIChvcmllbnQyZChub2RlLnBvaW50LCBub2RlLnByZXYucG9pbnQsIG5vZGUucHJldi5wcmV2LnBvaW50KSA9PT0gT3JpZW50YXRpb24uQ1cpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gTmV4dCBpcyBjb25jYXZlXG4gICAgICAgICAgICAgICAgICAgIFN3ZWVwLmZpbGxMZWZ0Q29uY2F2ZUVkZ2VFdmVudCh0Y3gsIGVkZ2UsIG5vZGUpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIE5leHQgaXMgY29udmV4XG4gICAgICAgICAgICAgICAgICAgIC8qIGpzaGludCBub2VtcHR5OmZhbHNlICovXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIFN3ZWVwLmZsaXBFZGdlRXZlbnQgPSBmdW5jdGlvbih0Y3gsIGVwLCBlcSwgdCwgcCkge1xuICAgICAgICB2YXIgb3QgPSB0Lm5laWdoYm9yQWNyb3NzKHApO1xuICAgICAgICBpZiAoIW90KSB7XG4gICAgICAgICAgICAvLyBJZiB3ZSB3YW50IHRvIGludGVncmF0ZSB0aGUgZmlsbEVkZ2VFdmVudCBkbyBpdCBoZXJlXG4gICAgICAgICAgICAvLyBXaXRoIGN1cnJlbnQgaW1wbGVtZW50YXRpb24gd2Ugc2hvdWxkIG5ldmVyIGdldCBoZXJlXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3BvbHkydHJpIFtCVUc6RklYTUVdIEZMSVAgZmFpbGVkIGR1ZSB0byBtaXNzaW5nIHRyaWFuZ2xlIScpO1xuICAgICAgICB9XG4gICAgICAgIHZhciBvcCA9IG90Lm9wcG9zaXRlUG9pbnQodCwgcCk7XG5cbiAgICAgICAgaWYgKGluU2NhbkFyZWEocCwgdC5wb2ludENDVyhwKSwgdC5wb2ludENXKHApLCBvcCkpIHtcbiAgICAgICAgICAgIC8vIExldHMgcm90YXRlIHNoYXJlZCBlZGdlIG9uZSB2ZXJ0ZXggQ1dcbiAgICAgICAgICAgIFN3ZWVwLnJvdGF0ZVRyaWFuZ2xlUGFpcih0LCBwLCBvdCwgb3ApO1xuICAgICAgICAgICAgdGN4Lm1hcFRyaWFuZ2xlVG9Ob2Rlcyh0KTtcbiAgICAgICAgICAgIHRjeC5tYXBUcmlhbmdsZVRvTm9kZXMob3QpO1xuXG4gICAgICAgICAgICAvLyBYWFg6IGluIHRoZSBvcmlnaW5hbCBDKysgY29kZSBmb3IgdGhlIG5leHQgMiBsaW5lcywgd2UgYXJlXG4gICAgICAgICAgICAvLyBjb21wYXJpbmcgcG9pbnQgdmFsdWVzIChhbmQgbm90IHBvaW50ZXJzKS4gSW4gdGhpcyBKYXZhU2NyaXB0XG4gICAgICAgICAgICAvLyBjb2RlLCB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMgKHBvaW50ZXJzKS4gVGhpcyB3b3Jrc1xuICAgICAgICAgICAgLy8gYmVjYXVzZSB3ZSBjYW4ndCBoYXZlIDIgZGlmZmVyZW50IHBvaW50cyB3aXRoIHRoZSBzYW1lIHZhbHVlcy5cbiAgICAgICAgICAgIC8vIEJ1dCB0byBiZSByZWFsbHkgZXF1aXZhbGVudCwgd2Ugc2hvdWxkIHVzZSBcIlBvaW50LmVxdWFsc1wiIGhlcmUuXG4gICAgICAgICAgICBpZiAocCA9PT0gZXEgJiYgb3AgPT09IGVwKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVxID09PSB0Y3guZWRnZV9ldmVudC5jb25zdHJhaW5lZF9lZGdlLnEgJiYgZXAgPT09IHRjeC5lZGdlX2V2ZW50LmNvbnN0cmFpbmVkX2VkZ2UucCkge1xuICAgICAgICAgICAgICAgICAgICB0Lm1hcmtDb25zdHJhaW5lZEVkZ2VCeVBvaW50cyhlcCwgZXEpO1xuICAgICAgICAgICAgICAgICAgICBvdC5tYXJrQ29uc3RyYWluZWRFZGdlQnlQb2ludHMoZXAsIGVxKTtcbiAgICAgICAgICAgICAgICAgICAgU3dlZXAubGVnYWxpemUodGN4LCB0KTtcbiAgICAgICAgICAgICAgICAgICAgU3dlZXAubGVnYWxpemUodGN4LCBvdCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gWFhYOiBJIHRoaW5rIG9uZSBvZiB0aGUgdHJpYW5nbGVzIHNob3VsZCBiZSBsZWdhbGl6ZWQgaGVyZT9cbiAgICAgICAgICAgICAgICAgICAgLyoganNoaW50IG5vZW1wdHk6ZmFsc2UgKi9cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciBvID0gb3JpZW50MmQoZXEsIG9wLCBlcCk7XG4gICAgICAgICAgICAgICAgdCA9IFN3ZWVwLm5leHRGbGlwVHJpYW5nbGUodGN4LCBvLCB0LCBvdCwgcCwgb3ApO1xuICAgICAgICAgICAgICAgIFN3ZWVwLmZsaXBFZGdlRXZlbnQodGN4LCBlcCwgZXEsIHQsIHApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIG5ld1AgPSBTd2VlcC5uZXh0RmxpcFBvaW50KGVwLCBlcSwgb3QsIG9wKTtcbiAgICAgICAgICAgIFN3ZWVwLmZsaXBTY2FuRWRnZUV2ZW50KHRjeCwgZXAsIGVxLCB0LCBvdCwgbmV3UCk7XG4gICAgICAgICAgICBTd2VlcC5lZGdlRXZlbnRCeVBvaW50cyh0Y3gsIGVwLCBlcSwgdCwgcCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgU3dlZXAubmV4dEZsaXBUcmlhbmdsZSA9IGZ1bmN0aW9uKHRjeCwgbywgdCwgb3QsIHAsIG9wKSB7XG4gICAgICAgIHZhciBlZGdlX2luZGV4O1xuICAgICAgICBpZiAobyA9PT0gT3JpZW50YXRpb24uQ0NXKSB7XG4gICAgICAgICAgICAvLyBvdCBpcyBub3QgY3Jvc3NpbmcgZWRnZSBhZnRlciBmbGlwXG4gICAgICAgICAgICBlZGdlX2luZGV4ID0gb3QuZWRnZUluZGV4KHAsIG9wKTtcbiAgICAgICAgICAgIG90LmRlbGF1bmF5X2VkZ2VbZWRnZV9pbmRleF0gPSB0cnVlO1xuICAgICAgICAgICAgU3dlZXAubGVnYWxpemUodGN4LCBvdCk7XG4gICAgICAgICAgICBvdC5jbGVhckRlbHVuYXlFZGdlcygpO1xuICAgICAgICAgICAgcmV0dXJuIHQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB0IGlzIG5vdCBjcm9zc2luZyBlZGdlIGFmdGVyIGZsaXBcbiAgICAgICAgZWRnZV9pbmRleCA9IHQuZWRnZUluZGV4KHAsIG9wKTtcblxuICAgICAgICB0LmRlbGF1bmF5X2VkZ2VbZWRnZV9pbmRleF0gPSB0cnVlO1xuICAgICAgICBTd2VlcC5sZWdhbGl6ZSh0Y3gsIHQpO1xuICAgICAgICB0LmNsZWFyRGVsdW5heUVkZ2VzKCk7XG4gICAgICAgIHJldHVybiBvdDtcbiAgICB9O1xuXG4gICAgU3dlZXAubmV4dEZsaXBQb2ludCA9IGZ1bmN0aW9uKGVwLCBlcSwgb3QsIG9wKSB7XG4gICAgICAgIHZhciBvMmQgPSBvcmllbnQyZChlcSwgb3AsIGVwKTtcbiAgICAgICAgaWYgKG8yZCA9PT0gT3JpZW50YXRpb24uQ1cpIHtcbiAgICAgICAgICAgIC8vIFJpZ2h0XG4gICAgICAgICAgICByZXR1cm4gb3QucG9pbnRDQ1cob3ApO1xuICAgICAgICB9IGVsc2UgaWYgKG8yZCA9PT0gT3JpZW50YXRpb24uQ0NXKSB7XG4gICAgICAgICAgICAvLyBMZWZ0XG4gICAgICAgICAgICByZXR1cm4gb3QucG9pbnRDVyhvcCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgUG9pbnRFcnJvcihcInBvbHkydHJpIFtVbnN1cHBvcnRlZF0gbmV4dEZsaXBQb2ludDogb3Bwb3NpbmcgcG9pbnQgb24gY29uc3RyYWluZWQgZWRnZSFcIiwgW2VxLCBvcCwgZXBdKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBTd2VlcC5mbGlwU2NhbkVkZ2VFdmVudCA9IGZ1bmN0aW9uKHRjeCwgZXAsIGVxLCBmbGlwX3RyaWFuZ2xlLCB0LCBwKSB7XG4gICAgICAgIHZhciBvdCA9IHQubmVpZ2hib3JBY3Jvc3MocCk7XG4gICAgICAgIGlmICghb3QpIHtcbiAgICAgICAgICAgIC8vIElmIHdlIHdhbnQgdG8gaW50ZWdyYXRlIHRoZSBmaWxsRWRnZUV2ZW50IGRvIGl0IGhlcmVcbiAgICAgICAgICAgIC8vIFdpdGggY3VycmVudCBpbXBsZW1lbnRhdGlvbiB3ZSBzaG91bGQgbmV2ZXIgZ2V0IGhlcmVcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigncG9seTJ0cmkgW0JVRzpGSVhNRV0gRkxJUCBmYWlsZWQgZHVlIHRvIG1pc3NpbmcgdHJpYW5nbGUnKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgb3AgPSBvdC5vcHBvc2l0ZVBvaW50KHQsIHApO1xuXG4gICAgICAgIGlmIChpblNjYW5BcmVhKGVxLCBmbGlwX3RyaWFuZ2xlLnBvaW50Q0NXKGVxKSwgZmxpcF90cmlhbmdsZS5wb2ludENXKGVxKSwgb3ApKSB7XG4gICAgICAgICAgICAvLyBmbGlwIHdpdGggbmV3IGVkZ2Ugb3AuZXFcbiAgICAgICAgICAgIFN3ZWVwLmZsaXBFZGdlRXZlbnQodGN4LCBlcSwgb3AsIG90LCBvcCk7XG4gICAgICAgICAgICAvLyBUT0RPOiBBY3R1YWxseSBJIGp1c3QgZmlndXJlZCBvdXQgdGhhdCBpdCBzaG91bGQgYmUgcG9zc2libGUgdG9cbiAgICAgICAgICAgIC8vICAgICAgIGltcHJvdmUgdGhpcyBieSBnZXR0aW5nIHRoZSBuZXh0IG90IGFuZCBvcCBiZWZvcmUgdGhlIHRoZSBhYm92ZVxuICAgICAgICAgICAgLy8gICAgICAgZmxpcCBhbmQgY29udGludWUgdGhlIGZsaXBTY2FuRWRnZUV2ZW50IGhlcmVcbiAgICAgICAgICAgIC8vIHNldCBuZXcgb3QgYW5kIG9wIGhlcmUgYW5kIGxvb3AgYmFjayB0byBpblNjYW5BcmVhIHRlc3RcbiAgICAgICAgICAgIC8vIGFsc28gbmVlZCB0byBzZXQgYSBuZXcgZmxpcF90cmlhbmdsZSBmaXJzdFxuICAgICAgICAgICAgLy8gVHVybnMgb3V0IGF0IGZpcnN0IGdsYW5jZSB0aGF0IHRoaXMgaXMgc29tZXdoYXQgY29tcGxpY2F0ZWRcbiAgICAgICAgICAgIC8vIHNvIGl0IHdpbGwgaGF2ZSB0byB3YWl0LlxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIG5ld1AgPSBTd2VlcC5uZXh0RmxpcFBvaW50KGVwLCBlcSwgb3QsIG9wKTtcbiAgICAgICAgICAgIFN3ZWVwLmZsaXBTY2FuRWRnZUV2ZW50KHRjeCwgZXAsIGVxLCBmbGlwX3RyaWFuZ2xlLCBvdCwgbmV3UCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1FeHBvcnRzIChwdWJsaWMgQVBJKVxuXG4gICAgcG9seTJ0cmkuUG9pbnRFcnJvciAgICAgPSBQb2ludEVycm9yO1xuICAgIHBvbHkydHJpLlBvaW50ICAgICAgICAgID0gUG9pbnQ7XG4gICAgcG9seTJ0cmkuVHJpYW5nbGUgICAgICAgPSBUcmlhbmdsZTtcbiAgICBwb2x5MnRyaS5Td2VlcENvbnRleHQgICA9IFN3ZWVwQ29udGV4dDtcblxuICAgIC8vIEJhY2t3YXJkIGNvbXBhdGliaWxpdHlcbiAgICBwb2x5MnRyaS50cmlhbmd1bGF0ZSAgICA9IFN3ZWVwLnRyaWFuZ3VsYXRlO1xuICAgIHBvbHkydHJpLnN3ZWVwID0ge1RyaWFuZ3VsYXRlOiBTd2VlcC50cmlhbmd1bGF0ZX07XG5cbn0odGhpcykpOyIsInZhciBnbE1hdHJpeCA9IHJlcXVpcmUoJy4uL2pzL2dsLW1hdHJpeC1taW4uanMnKTtcbnZhciB2ZWMzID0gZ2xNYXRyaXgudmVjMztcblxuXG4oZnVuY3Rpb24oX2dsb2JhbCkgeyBcbiAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgdmFyIHNoaW0gPSB7fTtcbiAgaWYgKHR5cGVvZihleHBvcnRzKSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZih0eXBlb2YgZGVmaW5lID09ICdmdW5jdGlvbicgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT0gJ29iamVjdCcgJiYgZGVmaW5lLmFtZCkge1xuICAgICAgc2hpbS5leHBvcnRzID0ge307XG4gICAgICBkZWZpbmUoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBzaGltLmV4cG9ydHM7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy90aGlzIHRoaW5nIGxpdmVzIGluIGEgYnJvd3NlciwgZGVmaW5lIGl0cyBuYW1lc3BhY2VzIGluIGdsb2JhbFxuICAgICAgc2hpbS5leHBvcnRzID0gdHlwZW9mKHdpbmRvdykgIT09ICd1bmRlZmluZWQnID8gd2luZG93IDogX2dsb2JhbDtcbiAgICB9XG4gIH1cbiAgZWxzZSB7XG4gICAgLy90aGlzIHRoaW5nIGxpdmVzIGluIGNvbW1vbmpzLCBkZWZpbmUgaXRzIG5hbWVzcGFjZXMgaW4gZXhwb3J0c1xuICAgIHNoaW0uZXhwb3J0cyA9IGV4cG9ydHM7XG4gIH1cbiAgKGZ1bmN0aW9uKGV4cG9ydHMpIHtcbiAgXG52YXIgZ2w7XG52YXIgdmJvTWVzaCA9IGV4cG9ydHM7XG5cbnZib01lc2guc2V0R0wgPSBmdW5jdGlvbihfZ2wpIHtcbiAgZ2wgPSBfZ2w7XG59XG5cbnZib01lc2guY3JlYXRlID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHZibyA9IHt9O1xuICAgIHZiby52ZXJ0ZXhEYXRhID0gbmV3IEZsb2F0MzJBcnJheSgzKjEwMCk7XG4gICAgdmJvLm51bVZlcnRpY2VzID0gMDtcbiAgICB2Ym8uaW5kZXhEYXRhID0gbmV3IFVpbnQxNkFycmF5KDMqMTAwKTtcbiAgICB2Ym8ubnVtSW5kaWNlcyA9IDA7XG4gICAgdmJvLnZlcnRleEJ1ZmZlciA9IGdsLmNyZWF0ZUJ1ZmZlcigpO1xuICAgIHZiby5pbmRleEJ1ZmZlciA9IGdsLmNyZWF0ZUJ1ZmZlcigpO1xuICAgIHZiby5udW1Ob3JtYWxzID0gMDtcbiAgICB2Ym8ubm9ybWFsc0VuYWJsZWQgPSBmYWxzZTtcbiAgICB2Ym8ubm9ybWFsRGF0YSA9IG51bGw7XG4gICAgdmJvLmNvbG9yRW5hYmxlZCA9IGZhbHNlO1xuICAgIHZiby5jb2xvckRhdGE9IG51bGw7XG4gICAgdmJvLm5vcm1hbEJ1ZmZlciA9IG51bGw7XG4gICAgdmJvLmNvbG9yQnVmZmVyID0gbnVsbDtcbiAgICByZXR1cm4gdmJvO1xufTtcblxudmJvTWVzaC5jcmVhdGUzMiA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciB2Ym8gPSB7fTtcbiAgICB2Ym8udmVydGV4RGF0YSA9IG5ldyBGbG9hdDMyQXJyYXkoMyoxMDAwKTtcbiAgICB2Ym8ubnVtVmVydGljZXMgPSAwO1xuICAgIHZiby5pbmRleERhdGEgPSBuZXcgVWludDMyQXJyYXkoMyoxMDAwKTtcbiAgICB2Ym8ubnVtSW5kaWNlcyA9IDA7XG4gICAgdmJvLnZlcnRleEJ1ZmZlciA9IGdsLmNyZWF0ZUJ1ZmZlcigpO1xuICAgIHZiby5pbmRleEJ1ZmZlciA9IGdsLmNyZWF0ZUJ1ZmZlcigpO1xuICAgIHZiby5ub3JtYWxzRW5hYmxlZCA9IGZhbHNlO1xuICAgIHZiby5udW1Ob3JtYWxzID0gMDtcbiAgICB2Ym8ubm9ybWFsRGF0YSA9IG51bGw7XG4gICAgdmJvLmNvbG9yRGF0YT0gbnVsbDtcbiAgICB2Ym8ubm9ybWFsQnVmZmVyID0gbnVsbDtcbiAgICB2Ym8uY29sb3JCdWZmZXIgPSBudWxsO1xuICAgIHJldHVybiB2Ym87XG59O1xuXG52Ym9NZXNoLmNsZWFyID0gZnVuY3Rpb24odmJvKSB7XG4gICAgdmJvLm51bVZlcnRpY2VzID0gMDtcbiAgICB2Ym8ubnVtSW5kaWNlcyA9IDA7XG4gICAgdmJvLm51bU5vcm1hbHMgPSAwO1xufVxuXG52Ym9NZXNoLmVuYWJsZU5vcm1hbHMgPSBmdW5jdGlvbih2Ym8pIHtcbiAgICBpZighdmJvLm5vcm1hbHNFbmFibGVkKSB7XG4gICAgICAgIHZiby5ub3JtYWxEYXRhID0gbmV3IEZsb2F0MzJBcnJheSh2Ym8udmVydGV4RGF0YS5sZW5ndGgpO1xuICAgICAgICBpZih2Ym8ubm9ybWFsQnVmZmVyID09PSBudWxsKSB2Ym8ubm9ybWFsQnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKCk7XG4gICAgICAgIHZiby5ub3JtYWxzRW5hYmxlZCA9IHRydWU7XG4gICAgfVxufVxuXG52Ym9NZXNoLmRpc2FibGVOb3JtYWxzID0gZnVuY3Rpb24odmJvKSB7XG4gICAgdmJvLm5vcm1hbERhdGEgPSBudWxsO1xuICAgIGlmKHZiby5ub3JtYWxCdWZmZXIgIT09IG51bGwpIGdsLmRlbGV0ZUJ1ZmZlcih2Ym8ubm9ybWFsQnVmZmVyKTtcbiAgICB2Ym8ubm9ybWFsc0VuYWJsZWQgPSBmYWxzZTtcbn1cblxudmJvTWVzaC5lbmFibGVDb2xvciA9IGZ1bmN0aW9uKHZibykge1xuICBpZighdmJvLmNvbG9yRW5hYmxlZCkge1xuICAgIHZiby5jb2xvckRhdGEgPSBuZXcgVWludDhBcnJheSh2Ym8udmVydGV4RGF0YS5sZW5ndGgvMyo0KTtcbiAgICBpZih2Ym8uY29sb3JCdWZmZXIgPT09IG51bGwpIHZiby5jb2xvckJ1ZmZlciA9IGdsLmNyZWF0ZUJ1ZmZlcigpO1xuICAgIHZiby5jb2xvckVuYWJsZWQgPSB0cnVlO1xuICB9XG59XG5cbnZib01lc2guZGlzYWJsZUNvbG9yID0gZnVuY3Rpb24odmJvKSB7XG4gICAgdmJvLmNvbG9yRGF0YSA9IG51bGw7XG4gICAgaWYodmJvLmNvbG9yQnVmZmVyICE9PSBudWxsKSBnbC5kZWxldGVCdWZmZXIodmJvLmNvbG9yQnVmZmVyKTtcbiAgICB2Ym8uY29sb3JFbmFibGVkID0gZmFsc2U7XG59XG5cbnZib01lc2guYWRkVmVydGV4ID0gZnVuY3Rpb24odmJvLCB2LG4pIHtcbiAgICB2YXIgaW5kZXggPSB2Ym8ubnVtVmVydGljZXMqMztcblx0aWYoaW5kZXggPj0gdmJvLnZlcnRleERhdGEubGVuZ3RoKSB7XG5cdFx0dmFyIG5ld0RhdGEgPSBuZXcgRmxvYXQzMkFycmF5KHZiby52ZXJ0ZXhEYXRhLmxlbmd0aCoyKTtcblx0XHRuZXdEYXRhLnNldCh2Ym8udmVydGV4RGF0YSk7XG5cdFx0Ly9kbyBpIG5lZWQgdG8gZXhwbGljaXRseSBraWxsIHRoZSBvbGQgdmVydGV4RGF0YT9cblx0XHR2Ym8udmVydGV4RGF0YSA9IG5ld0RhdGE7XG4gICAgaWYodmJvLm5vcm1hbHNFbmFibGVkKSB7XG4gICAgICAgIHZhciBuZXdEYXRhID0gbmV3IEZsb2F0MzJBcnJheSh2Ym8udmVydGV4RGF0YS5sZW5ndGgpO1xuICAgICAgICBuZXdEYXRhLnNldCh2Ym8ubm9ybWFsRGF0YSk7XG4gICAgICAgIC8vZG8gaSBuZWVkIHRvIGV4cGxpY2l0bHkga2lsbCB0aGUgb2xkIHZlcnRleERhdGE/XG4gICAgICAgIHZiby5ub3JtYWxEYXRhID0gbmV3RGF0YTtcbiAgICB9XG4gICAgaWYodmJvLmNvbG9yRW5hYmxlZCkge1xuICAgICAgdmFyIG5ld0RhdGEgPSBuZXcgVWludDhBcnJheSh2Ym8udmVydGV4RGF0YS5sZW5ndGgvMyo0KTtcbiAgICAgIG5ld0RhdGEuc2V0KHZiby5jb2xvckRhdGEpO1xuICAgICAgLy9kbyBpIG5lZWQgdG8gZXhwbGljaXRseSBraWxsIHRoZSBvbGQgdmVydGV4RGF0YT9cbiAgICAgIHZiby5jb2xvckRhdGEgPSBuZXdEYXRhO1xuICAgIH1cblx0fVxuICAgIHZiby52ZXJ0ZXhEYXRhW2luZGV4XSA9IHZbMF07XG4gICAgdmJvLnZlcnRleERhdGFbaW5kZXgrMV0gPSB2WzFdO1xuICAgIHZiby52ZXJ0ZXhEYXRhW2luZGV4KzJdID0gdlsyXTtcbiAgICBpZihuICYmIHZiby5ub3JtYWxzRW5hYmxlZCkge1xuICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpbmRleF0gPSBuWzBdO1xuICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpbmRleCsxXSA9IG5bMV07XG4gICAgICAgIHZiby5ub3JtYWxEYXRhW2luZGV4KzJdID0gblsyXTtcbiAgICB9XG4gICAgdmJvLm51bVZlcnRpY2VzKys7XG59XG5cbnZib01lc2guZ2V0VmVydGV4ID0gZnVuY3Rpb24ob3V0LCB2Ym8sIGkpIHtcbiAgdmFyIGkzID0gaSozO1xuICBvdXRbMF0gPSB2Ym8udmVydGV4RGF0YVtpM107XG4gIG91dFsxXSA9IHZiby52ZXJ0ZXhEYXRhW2kzKzFdO1xuICBvdXRbMl0gPSB2Ym8udmVydGV4RGF0YVtpMysyXTtcbn1cblxudmJvTWVzaC5zZXRWZXJ0ZXggPSBmdW5jdGlvbih2Ym8sIGksIHB0KSB7XG4gIHZhciBpMyA9IGkqMztcbiAgdmJvLnZlcnRleERhdGFbaTNdID0gcHRbMF07XG4gIHZiby52ZXJ0ZXhEYXRhW2kzKzFdID0gcHRbMV07XG4gIHZiby52ZXJ0ZXhEYXRhW2kzKzJdID0gcHRbMl07XG59XG5cbnZib01lc2guc2V0Tm9ybWFsID0gZnVuY3Rpb24odmJvLCBpLCBwdCkge1xuICB2YXIgaTMgPSBpKjM7XG4gIHZiby5ub3JtYWxEYXRhW2kzXSA9IHB0WzBdO1xuICB2Ym8ubm9ybWFsRGF0YVtpMysxXSA9IHB0WzFdO1xuICB2Ym8ubm9ybWFsRGF0YVtpMysyXSA9IHB0WzJdO1xufVxuXG52Ym9NZXNoLmdldE5vcm1hbCA9IGZ1bmN0aW9uKG4sIHZibywgaSkge1xuICB2YXIgaTMgPSBpKjM7XG4gIG5bMF0gPSB2Ym8ubm9ybWFsRGF0YVtpM107XG4gIG5bMV0gPSB2Ym8ubm9ybWFsRGF0YVtpMysxXTtcbiAgblsyXSA9IHZiby5ub3JtYWxEYXRhW2kzKzJdO1xufVxudmJvTWVzaC5zZXRDb2xvciA9IGZ1bmN0aW9uKHZibywgaSwgYykge1xuICB2YXIgaTQgPSBpKjQ7XG4gIHZiby5jb2xvckRhdGFbaTRdID0gY1swXTtcbiAgdmJvLmNvbG9yRGF0YVtpNCsxXSA9IGNbMV07XG4gIHZiby5jb2xvckRhdGFbaTQrMl0gPSBjWzJdO1xuICB2Ym8uY29sb3JEYXRhW2k0KzNdID0gY1szXSA9PT0gdW5kZWZpbmVkID8gMjU1IDogY1szXTtcbn1cblxudmJvTWVzaC5hZGRUcmlhbmdsZSA9IGZ1bmN0aW9uKHZibywgaTEsaTIsaTMpIHtcblx0aWYodmJvLm51bUluZGljZXMgPj0gdmJvLmluZGV4RGF0YS5sZW5ndGgpIHtcblx0XHR2YXIgbmV3RGF0YSA9IG5ldyB2Ym8uaW5kZXhEYXRhLmNvbnN0cnVjdG9yKHZiby5pbmRleERhdGEubGVuZ3RoKjIpO1xuXHRcdG5ld0RhdGEuc2V0KHZiby5pbmRleERhdGEpO1xuXHRcdC8vZG8gaSBuZWVkIHRvIGV4cGxpY2l0bHkga2lsbCB0aGUgb2xkIHZlcnRleERhdGE/XG5cdFx0dmJvLmluZGV4RGF0YSA9IG5ld0RhdGE7XG5cdH1cbiAgICB2Ym8uaW5kZXhEYXRhW3Ziby5udW1JbmRpY2VzKytdID0gaTE7XG4gICAgdmJvLmluZGV4RGF0YVt2Ym8ubnVtSW5kaWNlcysrXSA9IGkyO1xuICAgIHZiby5pbmRleERhdGFbdmJvLm51bUluZGljZXMrK10gPSBpMztcbn1cblxudmJvTWVzaC5hZGRJbmRpY2VzID0gZnVuY3Rpb24odmJvLCBpbmRpY2VzLG51bUluZGljZXMpIHtcblx0aWYodmJvLm51bUluZGljZXMrbnVtSW5kaWNlcyA+PSB2Ym8uaW5kZXhEYXRhLmxlbmd0aCkge1xuXHRcdHZhciBuZXdEYXRhID0gbmV3IHZiby5pbmRleERhdGEuY29uc3RydWN0b3IoTWF0aC5tYXgodmJvLmluZGV4RGF0YS5sZW5ndGgqMix2Ym8uaW5kZXhEYXRhLmxlbmd0aCtudW1JbmRpY2VzKSk7XG5cdFx0bmV3RGF0YS5zZXQodmJvLmluZGV4RGF0YSk7XG5cdFx0Ly9kbyBpIG5lZWQgdG8gZXhwbGljaXRseSBraWxsIHRoZSBvbGQgdmVydGV4RGF0YT9cblx0XHR2Ym8uaW5kZXhEYXRhID0gbmV3RGF0YTtcblx0fVxuICBmb3IodmFyIGk9MDtpPG51bUluZGljZXM7KytpKSB7XG4gICAgdmJvLmluZGV4RGF0YVt2Ym8ubnVtSW5kaWNlcysrXSA9IGluZGljZXNbaV07XG4gIH1cbn1cblxudmJvTWVzaC5hZGRJbmRleCA9IGZ1bmN0aW9uKHZibyxpbmRleCkge1xuICBpZih2Ym8ubnVtSW5kaWNlcyA+PSB2Ym8uaW5kZXhEYXRhLmxlbmd0aCkge1xuXHRcdHZhciBuZXdEYXRhID0gbmV3IHZiby5pbmRleERhdGEuY29uc3RydWN0b3IodmJvLmluZGV4RGF0YS5sZW5ndGgqMik7XG5cdFx0bmV3RGF0YS5zZXQodmJvLmluZGV4RGF0YSk7XG5cdFx0Ly9kbyBpIG5lZWQgdG8gZXhwbGljaXRseSBraWxsIHRoZSBvbGQgdmVydGV4RGF0YT9cblx0XHR2Ym8uaW5kZXhEYXRhID0gbmV3RGF0YTtcblx0fVxuICB2Ym8uaW5kZXhEYXRhW3Ziby5udW1JbmRpY2VzKytdID0gaW5kZXg7XG59XG5cbnZib01lc2guYWRkTGluZSA9IGZ1bmN0aW9uKHZibywgaTEsaTIpIHtcblx0aWYodmJvLm51bUluZGljZXMgPj0gdmJvLmluZGV4RGF0YS5sZW5ndGgpIHtcblx0XHR2YXIgbmV3RGF0YSA9IG5ldyB2Ym8uaW5kZXhEYXRhLmNvbnN0cnVjdG9yKHZiby5pbmRleERhdGEubGVuZ3RoKjIpO1xuXHRcdG5ld0RhdGEuc2V0KHZiby5pbmRleERhdGEpO1xuXHRcdC8vZG8gaSBuZWVkIHRvIGV4cGxpY2l0bHkga2lsbCB0aGUgb2xkIHZlcnRleERhdGE/XG5cdFx0dmJvLmluZGV4RGF0YSA9IG5ld0RhdGE7XG5cdH1cbiAgdmJvLmluZGV4RGF0YVt2Ym8ubnVtSW5kaWNlcysrXSA9IGkxO1xuICB2Ym8uaW5kZXhEYXRhW3Ziby5udW1JbmRpY2VzKytdID0gaTI7XG59XG5cbnZib01lc2guYnVmZmVyID0gZnVuY3Rpb24odmJvKSB7XG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHZiby52ZXJ0ZXhCdWZmZXIpO1xuICAgIGdsLmJ1ZmZlckRhdGEoZ2wuQVJSQVlfQlVGRkVSLHZiby52ZXJ0ZXhEYXRhLGdsLlNUUkVBTV9EUkFXKTtcbiAgICBnbC5iaW5kQnVmZmVyKGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLCB2Ym8uaW5kZXhCdWZmZXIpO1xuICAgIGdsLmJ1ZmZlckRhdGEoZ2wuRUxFTUVOVF9BUlJBWV9CVUZGRVIsdmJvLmluZGV4RGF0YSxnbC5TVFJFQU1fRFJBVyk7XG4gICAgaWYodmJvLm5vcm1hbHNFbmFibGVkKSB7XG4gICAgICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCB2Ym8ubm9ybWFsQnVmZmVyKTtcbiAgICAgICAgZ2wuYnVmZmVyRGF0YShnbC5BUlJBWV9CVUZGRVIsIHZiby5ub3JtYWxEYXRhLGdsLlNUUkVBTV9EUkFXKTtcbiAgICB9XG59XG5cbnZib01lc2guY29tcHV0ZVNtb290aE5vcm1hbHMgPSAoZnVuY3Rpb24oKSB7XG4gICAgdmFyIG5vcm0gPSB2ZWMzLmNyZWF0ZSgpO1xuICAgIHZhciBwMSA9IHZlYzMuY3JlYXRlKCksXG4gICAgICAgIHAyID0gdmVjMy5jcmVhdGUoKSxcbiAgICAgICAgcDMgPSB2ZWMzLmNyZWF0ZSgpO1xuICAgIHZhciB4PTAuMCx5PTAuMCx6PTAuMDtcbiAgICB2YXIgaW52TGVuID0gMC4wO1xuICAgIHZhciBkaXIxID0gdmVjMy5jcmVhdGUoKSxcbiAgICAgICAgZGlyMiA9IHZlYzMuY3JlYXRlKCk7XG4gICAgZnVuY3Rpb24gcGxhbmVOb3JtYWwob3V0LHYxLHYyLHYzKSB7XG4gICAgICB2ZWMzLnN1YihkaXIxLCB2MSx2Mik7XG4gICAgICB2ZWMzLnN1YihkaXIyLCB2Myx2Mik7XG4gICAgICB2ZWMzLmNyb3NzKG91dCxkaXIyLGRpcjEpO1xuICAgIH1cblxuICAgIHJldHVybiBmdW5jdGlvbiBjb21wdXRlU21vb3RoTm9ybWFscyh2Ym8pIHtcbiAgICAgICAgdmJvTWVzaC5lbmFibGVOb3JtYWxzKHZibyk7XG4gICAgICAgIGZvcih2YXIgaT0wO2k8dmJvLm51bVZlcnRpY2VzOysraSkge1xuICAgICAgICAgICAgdmFyIGkzID0gaSozO1xuICAgICAgICAgICAgdmJvLm5vcm1hbERhdGFbaTNdID0gMDtcbiAgICAgICAgICAgIHZiby5ub3JtYWxEYXRhW2kzKzFdID0gMDtcbiAgICAgICAgICAgIHZiby5ub3JtYWxEYXRhW2kzKzJdID0gMDtcbiAgICAgICAgfVxuICAgICAgICBmb3IodmFyIGk9MDtpPHZiby5udW1JbmRpY2VzOykge1xuICAgICAgICAgICAgdmFyIGkxID0gdmJvLmluZGV4RGF0YVtpKytdKjM7XG4gICAgICAgICAgICB2YXIgaTIgPSB2Ym8uaW5kZXhEYXRhW2krK10qMztcbiAgICAgICAgICAgIHZhciBpMyA9IHZiby5pbmRleERhdGFbaSsrXSozO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB2ZWMzLnNldChwMSx2Ym8udmVydGV4RGF0YVtpMV0sdmJvLnZlcnRleERhdGFbaTErMV0sIHZiby52ZXJ0ZXhEYXRhW2kxKzJdKTtcbiAgICAgICAgICAgIHZlYzMuc2V0KHAyLHZiby52ZXJ0ZXhEYXRhW2kyXSx2Ym8udmVydGV4RGF0YVtpMisxXSwgdmJvLnZlcnRleERhdGFbaTIrMl0pO1xuICAgICAgICAgICAgdmVjMy5zZXQocDMsdmJvLnZlcnRleERhdGFbaTNdLHZiby52ZXJ0ZXhEYXRhW2kzKzFdLCB2Ym8udmVydGV4RGF0YVtpMysyXSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHBsYW5lTm9ybWFsKG5vcm0sIHAxLHAyLHAzKTtcbiAgICAgICAgICAgIHZlYzMubm9ybWFsaXplKG5vcm0sbm9ybSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZiby5ub3JtYWxEYXRhW2kxXSArPSBub3JtWzBdO1xuICAgICAgICAgICAgdmJvLm5vcm1hbERhdGFbaTErMV0gKz0gbm9ybVsxXTtcbiAgICAgICAgICAgIHZiby5ub3JtYWxEYXRhW2kxKzJdICs9IG5vcm1bMl07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZiby5ub3JtYWxEYXRhW2kyXSArPSBub3JtWzBdO1xuICAgICAgICAgICAgdmJvLm5vcm1hbERhdGFbaTIrMV0gKz0gbm9ybVsxXTtcbiAgICAgICAgICAgIHZiby5ub3JtYWxEYXRhW2kyKzJdICs9IG5vcm1bMl07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZiby5ub3JtYWxEYXRhW2kzXSArPSBub3JtWzBdO1xuICAgICAgICAgICAgdmJvLm5vcm1hbERhdGFbaTMrMV0gKz0gbm9ybVsxXTtcbiAgICAgICAgICAgIHZiby5ub3JtYWxEYXRhW2kzKzJdICs9IG5vcm1bMl07XG4gICAgICAgIH1cbiAgICAgICAgZm9yKHZhciBpPTA7aTx2Ym8ubnVtVmVydGljZXM7KytpKSB7XG4gICAgICAgICAgICB2YXIgaTMgPSBpKjM7XG4gICAgICAgICAgICB4ID0gdmJvLm5vcm1hbERhdGFbaTNdO1xuICAgICAgICAgICAgeSA9IHZiby5ub3JtYWxEYXRhW2kzKzFdO1xuICAgICAgICAgICAgeiA9IHZiby5ub3JtYWxEYXRhW2kzKzJdO1xuICAgICAgICAgICAgaW52TGVuID0gMS4wL01hdGguc3FydCh4KngreSp5K3oqeik7XG4gICAgICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpM10gKj0gaW52TGVuO1xuICAgICAgICAgICAgdmJvLm5vcm1hbERhdGFbaTMrMV0gKj0gaW52TGVuO1xuICAgICAgICAgICAgdmJvLm5vcm1hbERhdGFbaTMrMl0gKj0gaW52TGVuO1xuICAgICAgICB9XG4gICAgfTtcbn0pKCk7XG5cbnZib01lc2guY29tcHV0ZVNtb290aE5vcm1hbHNWQk8gPSBmdW5jdGlvbih2Ym8pIHtcbiAgICB2YXIgdmVydGV4RGF0YSA9IHZiby52ZXJ0ZXhEYXRhO1xuICAgIGZvcih2YXIgaT0wO2k8dmJvLm51bVZlcnRpY2VzOysraSkge1xuICAgICAgICB2YXIgaTYgPSBpKjY7XG4gICAgICAgIHZlcnRleERhdGFbaTYrM10gPSAwO1xuICAgICAgICB2ZXJ0ZXhEYXRhW2k2KzRdID0gMDtcbiAgICAgICAgdmVydGV4RGF0YVtpNis1XSA9IDA7XG4gICAgfVxuICAgIHZhciBub3JtID0gdmVjMy5jcmVhdGUoKTtcbiAgICB2YXIgcDEgPSB2ZWMzLmNyZWF0ZSgpLFxuICAgICAgICBwMiA9IHZlYzMuY3JlYXRlKCksXG4gICAgICAgIHAzID0gdmVjMy5jcmVhdGUoKTtcbiAgICBmb3IodmFyIGk9MDtpPHZiby5udW1JbmRpY2VzOykge1xuICAgICAgICB2YXIgaTEgPSB2Ym8uaW5kZXhEYXRhW2krK107XG4gICAgICAgIHZhciBpMiA9IHZiby5pbmRleERhdGFbaSsrXTtcbiAgICAgICAgdmFyIGkzID0gdmJvLmluZGV4RGF0YVtpKytdO1xuICAgICAgICBcbiAgICAgICAgdmVjMy5zZXQocDEsdmVydGV4RGF0YVtpMSo2XSx2ZXJ0ZXhEYXRhW2kxKjYrMV0sIHZlcnRleERhdGFbaTEqNisyXSk7XG4gICAgICAgIHZlYzMuc2V0KHAyLHZlcnRleERhdGFbaTIqNl0sdmVydGV4RGF0YVtpMio2KzFdLCB2ZXJ0ZXhEYXRhW2kyKjYrMl0pO1xuICAgICAgICB2ZWMzLnNldChwMyx2ZXJ0ZXhEYXRhW2kzKjZdLHZlcnRleERhdGFbaTMqNisxXSwgdmVydGV4RGF0YVtpMyo2KzJdKTtcbiAgICAgICAgXG4gICAgICAgIHBsYW5lTm9ybWFsKG5vcm0sIHAxLHAyLHAzKTtcbiAgICAgICAgdmVjMy5ub3JtYWxpemUobm9ybSxub3JtKTtcbiAgICAgICAgXG4gICAgICAgIHZlcnRleERhdGFbaTEqMyszXSArPSBub3JtWzBdO1xuICAgICAgICB2ZXJ0ZXhEYXRhW2kxKjMrNF0gKz0gbm9ybVsxXTtcbiAgICAgICAgdmVydGV4RGF0YVtpMSozKzVdICs9IG5vcm1bMl07XG4gICAgICAgIFxuICAgICAgICB2ZXJ0ZXhEYXRhW2kyKjYrM10gKz0gbm9ybVswXTtcbiAgICAgICAgdmVydGV4RGF0YVtpMio2KzRdICs9IG5vcm1bMV07XG4gICAgICAgIHZlcnRleERhdGFbaTIqNis1XSArPSBub3JtWzJdO1xuICAgICAgICBcbiAgICAgICAgdmVydGV4RGF0YVtpMyo2KzNdICs9IG5vcm1bMF07XG4gICAgICAgIHZlcnRleERhdGFbaTMqNis0XSArPSBub3JtWzFdO1xuICAgICAgICB2ZXJ0ZXhEYXRhW2kzKjYrNV0gKz0gbm9ybVsyXTtcbiAgICB9XG4gICAgZm9yKHZhciBpPTA7aTx2Ym8ubnVtVmVydGljZXM7KytpKSB7XG4gICAgICAgIHZhciBpNiA9IGkqNjtcbiAgICAgICAgdmFyIGxlbiA9IE1hdGguc3FydCh2ZXJ0ZXhEYXRhW2k2KzNdKnZlcnRleERhdGFbaTYrM10rdmVydGV4RGF0YVtpNis0XSp2ZXJ0ZXhEYXRhW2k2KzRdK3ZlcnRleERhdGFbaTYrNV0qdmVydGV4RGF0YVtpNis1XSk7XG4gICAgICAgIHZlcnRleERhdGFbaTYrM10gLz0gbGVuO1xuICAgICAgICB2ZXJ0ZXhEYXRhW2k2KzRdIC89IGxlbjtcbiAgICAgICAgdmVydGV4RGF0YVtpNis1XSAvPSBsZW47XG4gICAgfVxufVxuXG5cbn0pKHNoaW0uZXhwb3J0cyk7XG59KSh0aGlzKTsiLCJcInVzZSBzdHJpY3RcIlxuXG52YXIgZ2xNYXRyaXggPSByZXF1aXJlKCcuLi9qcy9nbC1tYXRyaXgtbWluLmpzJyk7XG52YXIgcG9seTJ0cmkgPSByZXF1aXJlKCcuL3BvbHkydHJpLmpzJyk7XG52YXIgaGVtZXNoZXIgPSByZXF1aXJlKCcuLi9qcy9oZW1lc2guanMnKTtcbnZhciBoZW1lc2ggPSBoZW1lc2hlci5oZW1lc2g7XG52YXIgdmVjMyA9IGdsTWF0cml4LnZlYzM7XG52YXIgdmVjMiA9IGdsTWF0cml4LnZlYzI7XG5cbnZhciBTd2VlcENvbnRleHQgPSBwb2x5MnRyaS5Td2VlcENvbnRleHQ7XG52YXIgcHRzID0gW107XG5cbnZhciBvdXRzaWRlUHRzID0gW107XG52YXIgdHJpYW5nbGVzID0gW107XG52YXIgdm9yb01lc2ggPSBuZXcgaGVtZXNoKCk7XG52YXIgd2lkdGggPSAxMjAwO1xudmFyIGhlaWdodCA9IDEyMDA7XG5mdW5jdGlvbiByZXNldCgpIHtcbiAgLy9tYWtlIHJlZ3VsYXJseSBzcGFjZWQgcG9pbnRzXG4gIHB0cy5sZW5ndGggPSAwO1xuICBcbiAgdmFyIHNwYWNpbmcgPSB3aWR0aC80O1xuICBmb3IodmFyIGk9MDtpPDQ7KytpKSB7XG4gICAgZm9yKHZhciBqPTA7ajw0Oysraikge1xuICAgICAgcHRzLnB1c2goe3g6aSpzcGFjaW5nK2olMipzcGFjaW5nKjAuNSx5Omoqc3BhY2luZytzcGFjaW5nKjAuNX0pO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBpbml0KCkge1xuICBvdXRzaWRlUHRzLmxlbmd0aCA9IDA7XG4gIHZhciBkID0gNTAwO1xuICBvdXRzaWRlUHRzLnB1c2goe3g6LWQseTotZCxmaXhlZDp0cnVlfSk7XG4gIG91dHNpZGVQdHMucHVzaCh7eDp3aWR0aCowLjUseTotZCxmaXhlZDp0cnVlfSk7XG4gIG91dHNpZGVQdHMucHVzaCh7eDp3aWR0aCtkLHk6LWQsZml4ZWQ6dHJ1ZX0pO1xuICBvdXRzaWRlUHRzLnB1c2goe3g6d2lkdGgrZCx5OmhlaWdodCowLjUsZml4ZWQ6dHJ1ZX0pO1xuICBvdXRzaWRlUHRzLnB1c2goe3g6d2lkdGgrZCx5OmhlaWdodCtkLGZpeGVkOnRydWV9KTtcbiAgb3V0c2lkZVB0cy5wdXNoKHt4OndpZHRoKjAuNSx5OmhlaWdodCtkLGZpeGVkOnRydWV9KTtcbiAgb3V0c2lkZVB0cy5wdXNoKHt4Oi1kLHk6aGVpZ2h0K2QsZml4ZWQ6dHJ1ZX0pO1xuICBvdXRzaWRlUHRzLnB1c2goe3g6LWQseTpoZWlnaHQqMC41LGZpeGVkOnRydWV9KTtcbn1cblxudmFyIHZvcm9ub2kgPSAoZnVuY3Rpb24oKSB7XG4gIHZhciBwMSA9IHZlYzIuY3JlYXRlKCk7XG4gIHZhciBwMiA9IHZlYzIuY3JlYXRlKCk7XG4gIHZhciBwMyA9IHZlYzIuY3JlYXRlKCk7XG4gIHJldHVybiBmdW5jdGlvbiB2b3Jvbm9pKCkge1xuICAgIHZhciB0cmlhbmd1bGF0aW9uID0gbmV3IFN3ZWVwQ29udGV4dChvdXRzaWRlUHRzKTtcbiAgICB0cmlhbmd1bGF0aW9uLmFkZFBvaW50cyhwdHMpO1xuICAgIHRyaWFuZ3VsYXRpb24udHJpYW5ndWxhdGUoKTtcbiAgICBcbiAgICBmb3IodmFyIGk9MDtpPG91dHNpZGVQdHMubGVuZ3RoOysraSkge1xuICAgICAgb3V0c2lkZVB0c1tpXS5fcDJ0X2VkZ2VfbGlzdCA9IG51bGw7XG4gICAgfVxuICAgIGZvcih2YXIgaT0wO2k8cHRzLmxlbmd0aDsrK2kpIHtcbiAgICAgIHB0c1tpXS5fcDJ0X2VkZ2VfbGlzdCA9IG51bGw7XG4gICAgICBwdHNbaV0uY2VsbCA9IG51bGw7XG4gICAgfVxuICAgIFxuICAgIHRyaWFuZ2xlcyA9IHRyaWFuZ3VsYXRpb24uZ2V0VHJpYW5nbGVzKCk7XG4gICAgZXhwb3J0cy50cmlhbmdsZXMgPSB0cmlhbmdsZXM7XG4gICAgXG4gICAgZm9yKHZhciBpPTA7aTx0cmlhbmdsZXMubGVuZ3RoOysraSkge1xuICAgICAgdmFyIHRyaSA9IHRyaWFuZ2xlc1tpXTtcbiAgICAgIHRyaS5jaXJjdW1jZW50ZXIgPSB2ZWMzLmNyZWF0ZSgpO1xuICAgICAgdmVjMi5zZXQocDEsdHJpLnBvaW50c19bMF0ueCx0cmkucG9pbnRzX1swXS55KTtcbiAgICAgIHZlYzIuc2V0KHAyLHRyaS5wb2ludHNfWzFdLngsdHJpLnBvaW50c19bMV0ueSk7XG4gICAgICB2ZWMyLnNldChwMyx0cmkucG9pbnRzX1syXS54LHRyaS5wb2ludHNfWzJdLnkpO1xuICAgICAgY2lyY3VtY2lyY2xlKHRyaS5jaXJjdW1jZW50ZXIscDEscDIscDMpO1xuICAgIH1cbiAgICBcbiAgICBidWlsZENlbGxzKCk7XG4gICAgdHJpbUNlbGxzKCk7XG4gIH1cbn0pKCk7XG5cbnZhciBjaXJjdW1jaXJjbGUgPSAoZnVuY3Rpb24oKSB7XG4gIHZhciB2MSA9IHZlYzIuY3JlYXRlKCk7XG4gIHZhciB2MiA9IHZlYzIuY3JlYXRlKCk7XG4gIHZhciBkZW5vbTtcbiAgcmV0dXJuIGZ1bmN0aW9uIGNpcmN1bWNpcmNsZShvdXQsIHAxLHAyLHAzKSB7XG4gICAgdmVjMi5zdWIodjEscDEscDMpO1xuICAgIHZlYzIuc3ViKHYyLHAyLHAzKTtcbiAgICBkZW5vbSA9IHYxWzBdKnYyWzFdLXYxWzFdKnYyWzBdO1xuICAgIC8vZGVub20gPSBvcmllbnQyZChwMSxwMixwMyk7XG4gICAgdmFyIHYxTGVuID0gdmVjMi5zcXJMZW4odjEpO1xuICAgIHZhciB2MkxlbiA9IHZlYzIuc3FyTGVuKHYyKTtcbiAgICAvL3ZhciBjcm9zc0xlbiA9IGNyb3NzKmNyb3NzO1xuICAgIHZlYzIuc2NhbGUodjIsdjIsdjFMZW4pO1xuICAgIHZlYzIuc2NhbGUodjEsdjEsdjJMZW4pO1xuICAgIHZlYzIuc3ViKHYyLHYyLHYxKTtcbiAgICBvdXRbMF0gPSB2MlsxXTtcbiAgICBvdXRbMV0gPSAtdjJbMF07XG4gICAgdmVjMi5zY2FsZShvdXQsb3V0LDAuNS9kZW5vbSk7XG4gICAgdmVjMi5hZGQob3V0LG91dCxwMyk7XG4gICAgcmV0dXJuIG91dDtcbiAgfVxufSkoKTtcblxudmFyIG9yaWVudDJkID0gKGZ1bmN0aW9uKCkge1xuICB2YXIgZGV0bGVmdCwgZGV0cmlnaHQsIGRldDtcbiAgdmFyIGRldHN1bSwgZXJyYm91bmQ7XG4gIHJldHVybiBmdW5jdGlvbiBvcmllbnQyZChwYSxwYixwYykge1xuICAgIFxuXG4gICAgZGV0bGVmdCA9IChwYVswXSAtIHBjWzBdKSAqIChwYlsxXSAtIHBjWzFdKTtcbiAgICBkZXRyaWdodCA9IChwYVsxXSAtIHBjWzFdKSAqIChwYlswXSAtIHBjWzBdKTtcbiAgICBkZXQgPSBkZXRsZWZ0IC0gZGV0cmlnaHQ7XG5cbiAgICBpZiAoZGV0bGVmdCA+IDAuMCkge1xuICAgICAgaWYgKGRldHJpZ2h0IDw9IDAuMCkge1xuICAgICAgICByZXR1cm4gZGV0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGV0c3VtID0gZGV0bGVmdCArIGRldHJpZ2h0O1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZGV0bGVmdCA8IDAuMCkge1xuICAgICAgaWYgKGRldHJpZ2h0ID49IDAuMCkge1xuICAgICAgICByZXR1cm4gZGV0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGV0c3VtID0gLWRldGxlZnQgLSBkZXRyaWdodDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGRldDtcbiAgICB9XG5cbiAgICBlcnJib3VuZCA9IGNjd2VycmJvdW5kQSAqIGRldHN1bTtcbiAgICBpZiAoKGRldCA+PSBlcnJib3VuZCkgfHwgKC1kZXQgPj0gZXJyYm91bmQpKSB7XG4gICAgICByZXR1cm4gZGV0O1xuICAgIH1cblxuICAgIHJldHVybiBvcmllbnQyZGFkYXB0KHBhLCBwYiwgcGMsIGRldHN1bSk7XG4gIH1cbn0pKCk7XG5cblxuZnVuY3Rpb24gc2V0RGltZW5zaW9ucyh3LGgpIHtcbiAgd2lkdGggPSB3O1xuICBoZWlnaHQgPSBoO1xufVxuXG52YXIgY2VudHJvaWRhbCA9IChmdW5jdGlvbigpIHtcbiAgdmFyIGNlbnRyb2lkID0gdmVjMi5jcmVhdGUoKTtcbiAgdmFyIGNlbnRlciA9IHZlYzIuY3JlYXRlKCk7XG4gIHZhciBhcmVhLHRvdGFsQXJlYTtcbiAgdmFyIHYxLHYyO1xuICByZXR1cm4gZnVuY3Rpb24gY2VudHJvaWRhbCgpIHtcbiAgICBmb3IodmFyIGk9MDtpPHB0cy5sZW5ndGg7KytpKSB7XG4gICAgICB2YXIgcHQgPSBwdHNbaV07XG4gICAgICBpZighcHQuZml4ZWQpIHtcbiAgICAgICAgdG90YWxBcmVhID0gMDtcbiAgICAgICAgdmVjMi5zZXQoY2VudHJvaWQsMCwwKTtcbiAgICAgICAgdmFyIGUgPSBwdC5jZWxsLmU7XG4gICAgICAgIGRvIHtcbiAgICAgICAgICB2MSA9IGUudi5wb3M7XG4gICAgICAgICAgZSA9IGUubmV4dDtcbiAgICAgICAgICB2MiA9IGUudi5wb3M7XG4gICAgICAgICAgYXJlYSA9IHYxWzBdKnYyWzFdLXYxWzFdKnYyWzBdO1xuICAgICAgICAgIHRvdGFsQXJlYSArPSB2MVswXSp2MlsxXS12MVsxXSp2MlswXTtcbiAgICAgICAgICBjZW50cm9pZFswXSArPSAodjFbMF0rdjJbMF0pKmFyZWE7XG4gICAgICAgICAgY2VudHJvaWRbMV0gKz0gKHYxWzFdK3YyWzFdKSphcmVhO1xuICAgICAgICB9IHdoaWxlKGUgIT0gcHQuY2VsbC5lKTtcbiAgICAgICAgLypcbiAgICAgICAgZm9yKHZhciBqPTAsbD1wdC5jZWxsLmxlbmd0aDtqPGw7KytqKSB7XG4gICAgICAgICAgdmFyIGpOZXh0ID0gKGorMSklbDtcbiAgICAgICAgICB2MSA9IHB0LmNlbGxbal07XG4gICAgICAgICAgdjIgPSBwdC5jZWxsW2pOZXh0XTtcbiAgICAgICAgICBhcmVhID0gdjFbMF0qdjJbMV0tdjFbMV0qdjJbMF07XG4gICAgICAgICAgdG90YWxBcmVhICs9IHYxWzBdKnYyWzFdLXYxWzFdKnYyWzBdO1xuICAgICAgICAgIGNlbnRyb2lkWzBdICs9ICh2MVswXSt2MlswXSkqYXJlYTtcbiAgICAgICAgICBjZW50cm9pZFsxXSArPSAodjFbMV0rdjJbMV0pKmFyZWE7XG4gICAgICAgIH1cbiAgICAgICAgKi9cbiAgICAgICAgdmVjMi5zY2FsZShjZW50cm9pZCxjZW50cm9pZCwxLjAvdG90YWxBcmVhLzMuMCk7XG4gICAgICAgIHZhciBkeCA9IE1hdGgubWluKE1hdGgubWF4KE1hdGgucmFuZG9tKC4xKSxjZW50cm9pZFswXSksd2lkdGgtTWF0aC5yYW5kb20oLjEpKS1wdC54O1xuICAgICAgICB2YXIgZHkgPSBNYXRoLm1pbihNYXRoLm1heChNYXRoLnJhbmRvbSguMSksY2VudHJvaWRbMV0pLGhlaWdodC1NYXRoLnJhbmRvbSguMSkpLXB0Lnk7XG4gICAgICAgIGlmKGR4KmR4K2R5KmR5ID4gNCkge1xuICAgICAgICAgIHB0LnggKz0gLjI1KmR4O1xuICAgICAgICAgIHB0LnkgKz0gLjI1KmR5O1xuICAgICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn0pKCk7XG5cbnZhciBwdFRvRWRnZSA9IFtdO1xudmFyIGJ1aWxkQ2VsbHMgPSBmdW5jdGlvbigpIHtcbiAgdm9yb01lc2guY2xlYXIoKTtcbiAgcHRUb0VkZ2UubGVuZ3RoID0gMDtcbiAgZm9yKHZhciBpPTA7aTx0cmlhbmdsZXMubGVuZ3RoOysraSkge1xuICAgIHZhciB0ID0gdHJpYW5nbGVzW2ldO1xuICAgIHZhciB2ID0gdm9yb01lc2guYWRkVmVydGV4KHQuY2lyY3VtY2VudGVyKTtcbiAgICB0LnYgPSB2O1xuICB9XG4gIGZvcih2YXIgaT0wO2k8dHJpYW5nbGVzLmxlbmd0aDsrK2kpIHtcbiAgICB2YXIgdCA9IHRyaWFuZ2xlc1tpXTtcbiAgICBmb3IodmFyIGo9MDtqPDM7KytqKSB7XG4gICAgICB2YXIgcHQgPSB0LnBvaW50c19bal07XG4gICAgICBpZighcHQuZml4ZWQpIHtcbiAgICAgICAgaWYoIXB0LmNlbGwpe1xuICAgICAgICAgIGJ1aWxkQ2VsbChwdCx0KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBtYWtlQm91bmRhcnlFZGdlcyh2b3JvTWVzaCwgcHRUb0VkZ2UpO1xufVxuXG5mdW5jdGlvbiBidWlsZENlbGwocHQsdCkge1xuICBwdC5jZWxsID0gdm9yb01lc2guYWRkRmFjZSgpO1xuICB2YXIgcHJldlYgPSB0LnY7XG4gIHQgPSB0Lm5laWdoYm9yQ0NXKHB0KTtcbiAgdmFyIHN0YXJ0VCA9IHQ7XG4gIHZhciBlLCBwcmV2RSA9IG51bGw7XG4gIGRvIHtcbiAgICAvL3B0LmNlbGwucHVzaCh0LmNpcmN1bWNlbnRlcik7XG4gICAgZSA9IHZvcm9NZXNoLmFkZEVkZ2UoKTtcbiAgICBcbiAgICBlLnYgPSB0LnY7XG4gICAgZS52LmUgPSBlO1xuICAgIGlmKHByZXZFKSB7XG4gICAgICBwcmV2RS5uZXh0ID0gZTtcbiAgICB9IGVsc2Uge1xuICAgICAgcHQuY2VsbC5lID0gZTtcbiAgICB9XG4gICAgZS5mYWNlID0gcHQuY2VsbDtcbiAgICBmaW5kUGFpcihlLHB0VG9FZGdlLHByZXZWLmluZGV4LCBlLnYuaW5kZXgpO1xuICAgIHByZXZWID0gdC52O1xuICAgIHByZXZFID0gZTtcbiAgICB0ID0gdC5uZWlnaGJvckNDVyhwdCk7XG4gIH0gd2hpbGUodCAhPSBzdGFydFQpO1xuICBwcmV2RS5uZXh0ID0gcHQuY2VsbC5lO1xufVxuXG4vL2J1aWxkIGhlZGdlIHN0cnVjdHVyZVxuZnVuY3Rpb24gZmluZFBhaXIoZSxwdFRvRWRnZSxpMSxpMikge1xuICB2YXIgcHRFZGdlID0gcHRUb0VkZ2VbaTJdO1xuICBpZihwdEVkZ2UpIHtcbiAgICBmb3IodmFyIGk9MDtpPHB0RWRnZS5sZW5ndGg7KytpKSB7XG4gICAgICB2YXIgZTIgPSBwdEVkZ2VbaV07XG4gICAgICBpZihlMi52LmluZGV4ID09IGkxKSB7XG4gICAgICAgIGUyLnBhaXIgPSBlO1xuICAgICAgICBlLnBhaXIgPSBlMjtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBwdEVkZ2UgPSBwdFRvRWRnZVtpMV07XG4gIGlmKHB0RWRnZSkge1xuICAgIHB0RWRnZS5wdXNoKGUpO1xuICB9IGVsc2Uge1xuICAgIHB0RWRnZSA9IFtlXTtcbiAgICBwdFRvRWRnZVtpMV0gPSBwdEVkZ2U7XG4gIH1cbn1cblxuZnVuY3Rpb24gbWFrZUJvdW5kYXJ5RWRnZXMobWVzaCxwdFRvRWRnZSkge1xuICAvL2FkZCBib3VuZGFyeSBlZGdlcyBhbmQgdW5zdXJlIGV2ZXJ5IGVkZ2UgaGFzIGEgcGFpclxuICB2YXIgbnVtRWRnZXMgPSBtZXNoLmVkZ2VzLmxlbmd0aDtcbiAgdmFyIGUsdixzdGFydFY7XG4gIGZvcih2YXIgaT0wO2k8bnVtRWRnZXM7KytpKSB7XG4gICAgIGUgPSBtZXNoLmVkZ2VzW2ldO1xuICAgIGlmKGUucGFpciA9PSBudWxsKSB7XG4gICAgICB2YXIgbmV3RWRnZSA9IG1lc2guYWRkRWRnZSgpO1xuICAgICAgbmV3RWRnZS5wYWlyID0gZTtcbiAgICAgIGUucGFpciA9IG5ld0VkZ2U7XG4gICAgICBcbiAgICAgIC8vbGV0cyB0cnkgdGhlIGluZWZmaWNpZW50IHJvdXRlXG4gICAgICBzdGFydFYgPSBlLnY7XG4gICAgICBkbyB7XG4gICAgICAgIHYgPSBlLnY7XG4gICAgICAgIGUgPSBlLm5leHQ7XG4gICAgICB9IHdoaWxlKGUudiAhPSBzdGFydFYpO1xuICAgICAgbmV3RWRnZS52ID0gdjtcbiAgICAgIG5ld0VkZ2Uudi5iID0gdHJ1ZTtcbiAgICAgIHZhciBwdEVkZ2UgPSBwdFRvRWRnZVtzdGFydFYuaW5kZXhdO1xuICAgICAgcHRFZGdlLnB1c2gobmV3RWRnZSk7XG4gICAgfVxuICB9XG4gIGZvcih2YXIgaT1udW1FZGdlcztpPG1lc2guZWRnZXMubGVuZ3RoOysraSkge1xuICAgIGUgPSBtZXNoLmVkZ2VzW2ldO1xuICAgIHZhciBwdEVkZ2UgPSBwdFRvRWRnZVtlLnYuaW5kZXhdO1xuICAgIGlmKHB0RWRnZSkge1xuICAgICAgZm9yKHZhciBqPTA7ajxwdEVkZ2UubGVuZ3RoOysraikge1xuICAgICAgICB2YXIgZTIgPSBwdEVkZ2Vbal07XG4gICAgICAgIGlmKGUyLmZhY2UgPT0gaGVtZXNoLk5VTExGQUNFKSB7XG4gICAgICAgICAgZS5uZXh0ID0gZTI7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNJbnNpZGUocHQpIHtcbiAgcmV0dXJuIHB0WzBdID4gMCAmJiBwdFswXSA8IHdpZHRoICYmIHB0WzFdID4gMCAmJiBwdFsxXSA8IGhlaWdodDtcbn1cblxudmFyIHRyaW1FZGdlID0gKGZ1bmN0aW9uKCkge1xuICB2YXIgZGlyID0gdmVjMi5jcmVhdGUoKTtcbiAgcmV0dXJuIGZ1bmN0aW9uIHRyaW1FZGdlKG91dCxpblAsb3V0UCkge1xuICAgIHZlYzIuc3ViKGRpcixvdXRQLGluUCk7XG4gICAgaWYob3V0UFswXSA8IDApIHtcbiAgICAgIGlmKG91dFBbMV0gPDApIHtcbiAgICAgICAgdmFyIGxlbiA9IE1hdGgubWluKC1pblBbMF0vZGlyWzBdLC1pblBbMV0vZGlyWzFdKTtcbiAgICAgICAgb3V0WzBdID0gaW5QWzBdK2RpclswXSpsZW47XG4gICAgICAgIG91dFsxXSA9IGluUFsxXStkaXJbMV0qbGVuO1xuICAgICAgXG4gICAgICB9IGVsc2UgaWYob3V0UFsxXSA+IGhlaWdodCkge1xuICAgICAgICB2YXIgbGVuID0gTWF0aC5taW4oLWluUFswXS9kaXJbMF0sKGhlaWdodC1pblBbMV0pL2RpclsxXSk7XG4gICAgICAgIG91dFswXSA9IGluUFswXStkaXJbMF0qbGVuO1xuICAgICAgICBvdXRbMV0gPSBpblBbMV0rZGlyWzFdKmxlbjtcbiAgICAgIFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3V0WzBdID0gMDtcbiAgICAgICAgb3V0WzFdID0gaW5QWzFdK2RpclsxXSooLWluUFswXS9kaXJbMF0pO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZihvdXRQWzBdID4gd2lkdGgpIHtcbiAgICAgIGlmKG91dFBbMV0gPDApIHtcbiAgICAgICAgdmFyIGxlbiA9IE1hdGgubWluKCh3aWR0aC1pblBbMF0pL2RpclswXSwtaW5QWzFdL2RpclsxXSk7XG4gICAgICAgIG91dFswXSA9IGluUFswXStkaXJbMF0qbGVuO1xuICAgICAgICBvdXRbMV0gPSBpblBbMV0rZGlyWzFdKmxlbjsgICAgICBcbiAgICAgIH0gZWxzZSBpZihvdXRQWzFdID4gaGVpZ2h0KSB7XG4gICAgICAgIHZhciBsZW4gPSBNYXRoLm1pbigod2lkdGgtaW5QWzBdKS9kaXJbMF0sKGhlaWdodC1pblBbMV0pL2RpclsxXSk7XG4gICAgICAgIG91dFswXSA9IGluUFswXStkaXJbMF0qbGVuO1xuICAgICAgICBvdXRbMV0gPSBpblBbMV0rZGlyWzFdKmxlbjsgICAgICBcbiAgICAgIFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3V0WzBdID0gd2lkdGg7XG4gICAgICAgIG91dFsxXSA9IGluUFsxXStkaXJbMV0qKCh3aWR0aC1pblBbMF0pL2RpclswXSk7ICAgICAgXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmKG91dFBbMV0gPCAwKSB7XG4gICAgICAgIG91dFsxXSA9IDA7XG4gICAgICAgIG91dFswXSA9IGluUFswXStkaXJbMF0qKC1pblBbMV0vZGlyWzFdKTtcbiAgICAgIH0gZWxzZSBpZihvdXRQWzFdID4gaGVpZ2h0KSB7XG4gICAgICAgIG91dFsxXSA9IGhlaWdodDtcbiAgICAgICAgb3V0WzBdID0gaW5QWzBdK2RpclswXSooKGhlaWdodC1pblBbMV0pL2RpclsxXSk7XG4gICAgICBcbiAgICAgIH1cbiAgICB9XG4gIH1cbn0pKCk7XG5cbnZhciB0cmltQ2VsbHMgPSAoZnVuY3Rpb24oKSB7XG4gIHZhciBmO1xuICByZXR1cm4gZnVuY3Rpb24gdHJpbUNlbGxzKCkge1xuICAgIGZvcih2YXIgaT0wLGwgPSB2b3JvTWVzaC5mYWNlcy5sZW5ndGg7aTxsOyArK2kpIHtcbiAgICAgIGYgPSB2b3JvTWVzaC5mYWNlc1tpXTtcbiAgICAgIHRyaW1GYWNlKGYpO1xuICAgIH1cbiAgfVxufSkoKTtcbnZhciB0cmltRmFjZSA9IChmdW5jdGlvbigpIHtcbiAgdmFyIHRyaW1QdCA9IHZlYzMuY3JlYXRlKCk7XG4gIHZhciB2LGUsIHN0YXJ0RSwgcHJldkU7XG4gIHZhciBuZXdWO1xuICByZXR1cm4gZnVuY3Rpb24gdHJpbUZhY2UoZikge1xuICAgIHN0YXJ0RSA9IGYuZTtcbiAgICBlID0gc3RhcnRFO1xuICAgIC8vZ2V0IHRvIGFuIGluc2lkZSBwb2ludFxuICAgIC8vd2F0Y2hvdXQgZm9yIGluZmluaXRlIGxvb3AgKG5vdCBkb25lKVxuICAgIHdoaWxlKCFpc0luc2lkZShlLnYucG9zKSkge1xuICAgICAgZSA9IGUubmV4dDtcbiAgICB9XG4gICAgc3RhcnRFID0gZTtcbiAgICAvL2ZpbmQgZmlyc3Qgb3V0c2lkZSBwdFxuICAgIGRvIHtcbiAgICAgIFxuICAgICAgcHJldkUgPSBlO1xuICAgICAgZSA9IGUubmV4dDtcbiAgICB9IHdoaWxlKGlzSW5zaWRlKGUudi5wb3MpICYmIGUgIT0gc3RhcnRFKTtcbiAgICBcbiAgICBpZihpc0luc2lkZShlLnYucG9zKSkgeyByZXR1cm47IH1cbiAgICBcbiAgICBzdGFydEUgPSBlO1xuICAgIGYuZSA9IGU7ICAgICAgXG4gICAgLy9oYXMgdGhpcyBlZGdlIGFscmVhZHkgYmVlbiB0cmltbWVkXG4gICAgaWYoZS5wYWlyLmluZm8udHJpbW1lZCkge1xuICAgICAgLy9wb2ludCBlIHRvIHRyaW1tZWQ7XG4gICAgICBuZXdWID0gZS5wYWlyLmluZm8udHJpbW1lZDtcbiAgICAgIGUudiA9IG5ld1Y7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vbWFrZSBuZXcgdHJpbW1lZCB2ZXJ0ZXggYW5kIHBvaW50IHRvIHRoYXRcbiAgICAgIHRyaW1FZGdlKHRyaW1QdCwgZS5wYWlyLnYucG9zLCBlLnYucG9zKTtcbiAgICAgIG5ld1YgPSB2b3JvTWVzaC5hZGRWZXJ0ZXgodHJpbVB0KTtcbiAgICAgIG5ld1YuYiA9IHRydWU7XG4gICAgICBuZXdWLmUgPSBlO1xuICAgICAgZS52LmUgPSBudWxsO1xuICAgICAgZS52ID0gbmV3VjtcbiAgICAgIGUuaW5mby50cmltbWVkID0gbmV3VjtcbiAgICB9XG4gICAgXG4gICAgZSA9IGUubmV4dDtcbiAgICB3aGlsZSghaXNJbnNpZGUoZS52LnBvcykpIHtcbiAgICAgIGUudi5lID0gbnVsbDtcbiAgICAgIGUgPSBlLm5leHQ7XG4gICAgfSAgICBcbiAgICAvL2hhcyB0aGlzIGVkZ2UgYWxyZWFkeSBiZWVuIHRyaW1tZWRcbiAgICBpZihlLnBhaXIuaW5mby50cmltbWVkKSB7XG4gICAgICAvL3BvaW50IGUgdG8gdHJpbW1lZDtcbiAgICAgIG5ld1YgPSBlLnBhaXIuaW5mby50cmltbWVkO1xuICAgIH0gZWxzZSB7XG4gICAgICAvL21ha2UgbmV3IHRyaW1tZWQgdmVydGV4IGFuZCBwb2ludCB0byB0aGF0XG4gICAgICB0cmltRWRnZSh0cmltUHQsICBlLnYucG9zLGUucGFpci52LnBvcyk7XG4gICAgICBuZXdWID0gdm9yb01lc2guYWRkVmVydGV4KHRyaW1QdCk7XG4gICAgICBuZXdWLmIgPSB0cnVlO1xuICAgICAgZS5pbmZvLnRyaW1tZWQgPSBuZXdWO1xuICAgIH1cbiAgICBcbiAgICAvLyBjb3JuZXJcbiAgICAvL21heSBuZWVkIHRvIGNoZWNrIGZvciBmbG9hdGluZyBwb2ludCBlcnJvcnNcbiAgICBpZihzdGFydEUudi5wb3NbMF0gIT0gbmV3Vi5wb3NbMF0gJiYgc3RhcnRFLnYucG9zWzBdICE9IG5ld1YucG9zWzBdKSB7XG4gICAgICAvL3doaWNoIGNvcm5lclxuICAgICAgaWYoc3RhcnRFLnYucG9zWzBdID09IDAgfHwgbmV3Vi5wb3NbMF0gPT0gMCkge1xuICAgICAgICB0cmltUHRbMF0gPSAwO1xuICAgICAgfSBlbHNlIGlmKHN0YXJ0RS52LnBvc1swXSA9PSB3aWR0aCB8fCBuZXdWLnBvc1swXSA9PSB3aWR0aCkge1xuICAgICAgICB0cmltUHRbMF0gPSB3aWR0aDtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgaWYoc3RhcnRFLnYucG9zWzFdID09IDAgfHwgbmV3Vi5wb3NbMV0gPT0gMCkge1xuICAgICAgICB0cmltUHRbMV0gPSAwO1xuICAgICAgfSBlbHNlIGlmKHN0YXJ0RS52LnBvc1sxXSA9PSBoZWlnaHQgfHwgbmV3Vi5wb3NbMV0gPT0gaGVpZ2h0KSB7XG4gICAgICAgIHRyaW1QdFsxXSA9IGhlaWdodDtcbiAgICAgIH1cbiAgICAgIC8vYWRkIGNvcm5lclxuICAgICAgdmFyIGNvcm5lclYgPSB2b3JvTWVzaC5hZGRWZXJ0ZXgodHJpbVB0KTtcbiAgICAgIHZhciBuZXdFID0gdm9yb01lc2guYWRkRWRnZSgpO1xuICAgICAgdmFyIG5ld0VQID0gdm9yb01lc2guYWRkRWRnZSgpO1xuICAgICAgdmFyIG5ld0UyID0gdm9yb01lc2guYWRkRWRnZSgpO1xuICAgICAgdmFyIG5ld0VQMiA9IHZvcm9NZXNoLmFkZEVkZ2UoKTtcbiAgICAgIFxuICAgICAgbmV3RS5mYWNlID0gZjtcbiAgICAgIG5ld0UyLmZhY2UgPSBmO1xuICAgICAgbmV3RS52ID0gY29ybmVyVjtcbiAgICAgIG5ld0UyLnYgPSBuZXdWO1xuICAgICAgY29ybmVyVi5lID0gbmV3RTtcbiAgICAgIG5ld1YuZSA9IG5ld0UyO1xuICAgICAgbmV3RS5wYWlyID0gbmV3RVA7XG4gICAgICBuZXdFUC5wYWlyID0gbmV3RTtcbiAgICAgIG5ld0UyLnBhaXIgPSBuZXdFUDI7XG4gICAgICBuZXdFUDIucGFpciA9IG5ld0UyO1xuICAgICAgbmV3RVAyLnYgPSBjb3JuZXJWO1xuICAgICAgbmV3RVAudiA9IHN0YXJ0RS52O1xuICAgICAgbmV3RS5uZXh0ID0gbmV3RTI7XG4gICAgICBuZXdFUDIubmV4dCA9IG5ld0VQO1xuICAgICAgc3RhcnRFLm5leHQgPSBuZXdFO1xuICAgICAgbmV3RTIubmV4dCA9IGU7XG4gICAgICBcbiAgICAgIGlmKHN0YXJ0RS5wYWlyLmluZm8udHJpbUIpIHtcbiAgICAgICAgbmV3RVAubmV4dCA9IHN0YXJ0RS5wYWlyLmluZm8udHJpbUI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdGFydEUuaW5mby50cmltQiA9IG5ld0VQO1xuICAgICAgfVxuICAgICAgaWYoZS5wYWlyLmluZm8udHJpbUIpIHtcbiAgICAgICAgZS5wYWlyLmluZm8udHJpbUIubmV4dCA9IG5ld0VQMjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGUuaW5mby50cmltQiA9IG5ld0VQMjtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy9jb25uZWN0IHRoZSBlZGdlc1xuICAgICAgdmFyIG5ld0UgPSB2b3JvTWVzaC5hZGRFZGdlKCk7XG4gICAgICB2YXIgbmV3RVAgPSB2b3JvTWVzaC5hZGRFZGdlKCk7XG4gICAgICBuZXdFLnYgPSBuZXdWO1xuICAgICAgbmV3Vi5lID0gbmV3RTtcbiAgICAgIG5ld0UuZmFjZSA9IGY7XG4gICAgICBuZXdFLnBhaXIgPSBuZXdFUDtcbiAgICAgIG5ld0VQLnBhaXIgPSBuZXdFO1xuICAgICAgbmV3RVAudiA9IHN0YXJ0RS52O1xuICAgICAgbmV3RS5uZXh0ID0gZTtcbiAgICAgIHN0YXJ0RS5uZXh0ID0gbmV3RTtcbiAgICAgIGlmKHN0YXJ0RS5wYWlyLmluZm8udHJpbUIpIHtcbiAgICAgICAgbmV3RVAubmV4dCA9IHN0YXJ0RS5wYWlyLmluZm8udHJpbUI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdGFydEUuaW5mby50cmltQiA9IG5ld0VQO1xuICAgICAgfVxuICAgICAgaWYoZS5wYWlyLmluZm8udHJpbUIpIHtcbiAgICAgICAgZS5wYWlyLmluZm8udHJpbUIubmV4dCA9IG5ld0VQO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZS5pbmZvLnRyaW1CID0gbmV3RVA7XG4gICAgICB9XG4gICAgfVxuICB9XG59KSgpO1xuLypcbiAgICB2YXIgdiwgdjIsIHN0YXJ0RSxlLGN2LCBwcmV2RSwgcHJldkVQLCBlUGFpciwgZU5leHQ7O1xuICAgIGZvcih2YXIgaT0wLGw9dm9yb01lc2gudmVydGljZXMubGVuZ3RoO2k8bDsrK2kpIHtcbiAgICAgIHYgPSB2b3JvTWVzaC52ZXJ0aWNlc1tpXTtcbiAgICAgIGlmKHYuZSAmJiB2LmIpIHtcbiAgICAgICAgLy90cmltIHB0XG4gICAgICAgIGlmKCFpc0luc2lkZSh2LnBvcykpIHtcbiAgICAgICAgICBzdGFydEUgPSB2LmU7XG4gICAgICAgICAgZSA9IHN0YXJ0RTtcbiAgICAgICAgICBwcmV2RSA9IG51bGw7XG4gICAgICAgICAgZG8ge1xuICAgICAgICAgICAgZVBhaXIgPSBlLnBhaXI7XG4gICAgICAgICAgICBlTmV4dCA9IGUubmV4dC5wYWlyO1xuICAgICAgICAgICAgdjIgPSBlUGFpci52O1xuICAgICAgICAgICAgLy90cmltIGVkZ2VcbiAgICAgICAgICAgIGN2ID0gdjtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYoaXNJbnNpZGUodjIucG9zKSkge1xuICAgICAgICAgICAgICB0cmltRWRnZSh0cmltUHQsdjIucG9zLHYucG9zKTtcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIGN2ID0gdm9yb01lc2guYWRkVmVydGV4KHRyaW1QdCk7XG4gICAgICAgICAgICAgIGN2LmIgPSB0cnVlO1xuICAgICAgICAgICAgICBjdi5lID0gZTtcbiAgICAgICAgICAgICAgZS52ID0gY3Y7XG4gICAgICAgICAgICAgIHZhciBuZXdFID0gdm9yb01lc2guYWRkRWRnZSgpO1xuICAgICAgICAgICAgICBuZXdFLmZhY2UgPSBlLmZhY2U7XG4gICAgICAgICAgICAgIG5ld0UubmV4dCA9IGUubmV4dDtcbiAgICAgICAgICAgICAgbmV3RS52ID0gdjtcbiAgICAgICAgICAgICAgZSA9IG5ld0U7XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICBpZihwcmV2RSkge1xuICAgICAgICAgICAgICAgIHByZXZFLm5leHQgPSBlUGFpcjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZihwcmV2RSkge1xuICAgICAgICAgICAgICBwcmV2RS52ID0gY3Y7XG4gICAgICAgICAgICAgIHByZXZFLm5leHQgPSBlUGFpci5uZXh0O1xuICAgICAgICAgICAgICBwcmV2RS5mYWNlLmUgPSBwcmV2RTtcbiAgICAgICAgICAgICAgcHJldkUudi5lID0gcHJldkU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZihlLmZhY2UgIT0gaGVtZXNoLk5VTExGQUNFKSB7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgICAgdmFyIG5ld0VQID0gdm9yb01lc2guYWRkRWRnZSgpO1xuICAgICAgICAgICAgICBuZXdFUC52ID0gY3Y7XG4gICAgICAgICAgICAgIG5ld0VQLnBhaXIgPSBwcmV2RTtcbiAgICAgICAgICAgICAgbmV3RVAubmV4dCA9IHByZXZFUDtcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIHByZXZFUCA9IG5ld0VQO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZS5wYWlyID0gcHJldkU7XG4gICAgICAgICAgICAgIGUubmV4dCA9IHByZXZFUDtcbiAgICAgICAgICAgICAgZS52ID0gXzsvLz8/XG4gICAgICAgICAgICAgIHByZXZFUCA9IGU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHByZXZFID0gZTtcbiAgICAgICAgICAgIGUgPSBlTmV4dDtcbiAgICAgICAgICB9IHdoaWxlKGUgIT0gc3RhcnRFKTtcbiAgICAgICAgICBcbiAgICAgICAgICBcbiAgICAgICAgICBcbiAgICAgICAgICB2LmUgPSBudWxsO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4qL1xuXG5leHBvcnRzLmluaXQgPSBpbml0O1xuZXhwb3J0cy5yZXNldCA9IHJlc2V0O1xuZXhwb3J0cy52b3Jvbm9pID0gdm9yb25vaTtcbmV4cG9ydHMucHRzID0gcHRzO1xuZXhwb3J0cy50cmlhbmdsZXMgPSB0cmlhbmdsZXM7XG5leHBvcnRzLnNldERpbWVuc2lvbnMgPSBzZXREaW1lbnNpb25zO1xuZXhwb3J0cy5jZW50cm9pZGFsID0gY2VudHJvaWRhbDtcbmV4cG9ydHMubWVzaCA9IHZvcm9NZXNoOyIsIi8qKlxuICogQGZpbGVvdmVydmlldyBnbC1tYXRyaXggLSBIaWdoIHBlcmZvcm1hbmNlIG1hdHJpeCBhbmQgdmVjdG9yIG9wZXJhdGlvbnNcbiAqIEBhdXRob3IgQnJhbmRvbiBKb25lc1xuICogQGF1dGhvciBDb2xpbiBNYWNLZW56aWUgSVZcbiAqIEB2ZXJzaW9uIDIuMi4wXG4gKi9cbi8qIENvcHlyaWdodCAoYykgMjAxMywgQnJhbmRvbiBKb25lcywgQ29saW4gTWFjS2VuemllIElWLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuXG5SZWRpc3RyaWJ1dGlvbiBhbmQgdXNlIGluIHNvdXJjZSBhbmQgYmluYXJ5IGZvcm1zLCB3aXRoIG9yIHdpdGhvdXQgbW9kaWZpY2F0aW9uLFxuYXJlIHBlcm1pdHRlZCBwcm92aWRlZCB0aGF0IHRoZSBmb2xsb3dpbmcgY29uZGl0aW9ucyBhcmUgbWV0OlxuXG4gICogUmVkaXN0cmlidXRpb25zIG9mIHNvdXJjZSBjb2RlIG11c3QgcmV0YWluIHRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlLCB0aGlzXG4gICAgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIuXG4gICogUmVkaXN0cmlidXRpb25zIGluIGJpbmFyeSBmb3JtIG11c3QgcmVwcm9kdWNlIHRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlLFxuICAgIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIgaW4gdGhlIGRvY3VtZW50YXRpb24gXG4gICAgYW5kL29yIG90aGVyIG1hdGVyaWFscyBwcm92aWRlZCB3aXRoIHRoZSBkaXN0cmlidXRpb24uXG5cblRISVMgU09GVFdBUkUgSVMgUFJPVklERUQgQlkgVEhFIENPUFlSSUdIVCBIT0xERVJTIEFORCBDT05UUklCVVRPUlMgXCJBUyBJU1wiIEFORFxuQU5ZIEVYUFJFU1MgT1IgSU1QTElFRCBXQVJSQU5USUVTLCBJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgVEhFIElNUExJRURcbldBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZIEFORCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBUkUgXG5ESVNDTEFJTUVELiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQ09QWVJJR0hUIEhPTERFUiBPUiBDT05UUklCVVRPUlMgQkUgTElBQkxFIEZPUlxuQU5ZIERJUkVDVCwgSU5ESVJFQ1QsIElOQ0lERU5UQUwsIFNQRUNJQUwsIEVYRU1QTEFSWSwgT1IgQ09OU0VRVUVOVElBTCBEQU1BR0VTXG4oSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFBST0NVUkVNRU5UIE9GIFNVQlNUSVRVVEUgR09PRFMgT1IgU0VSVklDRVM7XG5MT1NTIE9GIFVTRSwgREFUQSwgT1IgUFJPRklUUzsgT1IgQlVTSU5FU1MgSU5URVJSVVBUSU9OKSBIT1dFVkVSIENBVVNFRCBBTkQgT05cbkFOWSBUSEVPUlkgT0YgTElBQklMSVRZLCBXSEVUSEVSIElOIENPTlRSQUNULCBTVFJJQ1QgTElBQklMSVRZLCBPUiBUT1JUXG4oSU5DTFVESU5HIE5FR0xJR0VOQ0UgT1IgT1RIRVJXSVNFKSBBUklTSU5HIElOIEFOWSBXQVkgT1VUIE9GIFRIRSBVU0UgT0YgVEhJU1xuU09GVFdBUkUsIEVWRU4gSUYgQURWSVNFRCBPRiBUSEUgUE9TU0lCSUxJVFkgT0YgU1VDSCBEQU1BR0UuICovXG4oZnVuY3Rpb24oZSl7XCJ1c2Ugc3RyaWN0XCI7dmFyIHQ9e307dHlwZW9mIGV4cG9ydHM9PVwidW5kZWZpbmVkXCI/dHlwZW9mIGRlZmluZT09XCJmdW5jdGlvblwiJiZ0eXBlb2YgZGVmaW5lLmFtZD09XCJvYmplY3RcIiYmZGVmaW5lLmFtZD8odC5leHBvcnRzPXt9LGRlZmluZShmdW5jdGlvbigpe3JldHVybiB0LmV4cG9ydHN9KSk6dC5leHBvcnRzPXR5cGVvZiB3aW5kb3chPVwidW5kZWZpbmVkXCI/d2luZG93OmU6dC5leHBvcnRzPWV4cG9ydHMsZnVuY3Rpb24oZSl7aWYoIXQpdmFyIHQ9MWUtNjtpZighbil2YXIgbj10eXBlb2YgRmxvYXQzMkFycmF5IT1cInVuZGVmaW5lZFwiP0Zsb2F0MzJBcnJheTpBcnJheTtpZighcil2YXIgcj1NYXRoLnJhbmRvbTt2YXIgaT17fTtpLnNldE1hdHJpeEFycmF5VHlwZT1mdW5jdGlvbihlKXtuPWV9LHR5cGVvZiBlIT1cInVuZGVmaW5lZFwiJiYoZS5nbE1hdHJpeD1pKTt2YXIgcz17fTtzLmNyZWF0ZT1mdW5jdGlvbigpe3ZhciBlPW5ldyBuKDIpO3JldHVybiBlWzBdPTAsZVsxXT0wLGV9LHMuY2xvbmU9ZnVuY3Rpb24oZSl7dmFyIHQ9bmV3IG4oMik7cmV0dXJuIHRbMF09ZVswXSx0WzFdPWVbMV0sdH0scy5mcm9tVmFsdWVzPWZ1bmN0aW9uKGUsdCl7dmFyIHI9bmV3IG4oMik7cmV0dXJuIHJbMF09ZSxyWzFdPXQscn0scy5jb3B5PWZ1bmN0aW9uKGUsdCl7cmV0dXJuIGVbMF09dFswXSxlWzFdPXRbMV0sZX0scy5zZXQ9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXQsZVsxXT1uLGV9LHMuYWRkPWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10WzBdK25bMF0sZVsxXT10WzFdK25bMV0sZX0scy5zdWJ0cmFjdD1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dFswXS1uWzBdLGVbMV09dFsxXS1uWzFdLGV9LHMuc3ViPXMuc3VidHJhY3Qscy5tdWx0aXBseT1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dFswXSpuWzBdLGVbMV09dFsxXSpuWzFdLGV9LHMubXVsPXMubXVsdGlwbHkscy5kaXZpZGU9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0vblswXSxlWzFdPXRbMV0vblsxXSxlfSxzLmRpdj1zLmRpdmlkZSxzLm1pbj1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09TWF0aC5taW4odFswXSxuWzBdKSxlWzFdPU1hdGgubWluKHRbMV0sblsxXSksZX0scy5tYXg9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPU1hdGgubWF4KHRbMF0sblswXSksZVsxXT1NYXRoLm1heCh0WzFdLG5bMV0pLGV9LHMuc2NhbGU9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0qbixlWzFdPXRbMV0qbixlfSxzLnNjYWxlQW5kQWRkPWZ1bmN0aW9uKGUsdCxuLHIpe3JldHVybiBlWzBdPXRbMF0rblswXSpyLGVbMV09dFsxXStuWzFdKnIsZX0scy5kaXN0YW5jZT1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0tZVswXSxyPXRbMV0tZVsxXTtyZXR1cm4gTWF0aC5zcXJ0KG4qbityKnIpfSxzLmRpc3Q9cy5kaXN0YW5jZSxzLnNxdWFyZWREaXN0YW5jZT1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0tZVswXSxyPXRbMV0tZVsxXTtyZXR1cm4gbipuK3Iqcn0scy5zcXJEaXN0PXMuc3F1YXJlZERpc3RhbmNlLHMubGVuZ3RoPWZ1bmN0aW9uKGUpe3ZhciB0PWVbMF0sbj1lWzFdO3JldHVybiBNYXRoLnNxcnQodCp0K24qbil9LHMubGVuPXMubGVuZ3RoLHMuc3F1YXJlZExlbmd0aD1mdW5jdGlvbihlKXt2YXIgdD1lWzBdLG49ZVsxXTtyZXR1cm4gdCp0K24qbn0scy5zcXJMZW49cy5zcXVhcmVkTGVuZ3RoLHMubmVnYXRlPWZ1bmN0aW9uKGUsdCl7cmV0dXJuIGVbMF09LXRbMF0sZVsxXT0tdFsxXSxlfSxzLm5vcm1hbGl6ZT1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0scj10WzFdLGk9bipuK3IqcjtyZXR1cm4gaT4wJiYoaT0xL01hdGguc3FydChpKSxlWzBdPXRbMF0qaSxlWzFdPXRbMV0qaSksZX0scy5kb3Q9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXSp0WzBdK2VbMV0qdFsxXX0scy5jcm9zcz1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSpuWzFdLXRbMV0qblswXTtyZXR1cm4gZVswXT1lWzFdPTAsZVsyXT1yLGV9LHMubGVycD1mdW5jdGlvbihlLHQsbixyKXt2YXIgaT10WzBdLHM9dFsxXTtyZXR1cm4gZVswXT1pK3IqKG5bMF0taSksZVsxXT1zK3IqKG5bMV0tcyksZX0scy5yYW5kb209ZnVuY3Rpb24oZSx0KXt0PXR8fDE7dmFyIG49cigpKjIqTWF0aC5QSTtyZXR1cm4gZVswXT1NYXRoLmNvcyhuKSp0LGVbMV09TWF0aC5zaW4obikqdCxlfSxzLnRyYW5zZm9ybU1hdDI9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdO3JldHVybiBlWzBdPW5bMF0qcituWzJdKmksZVsxXT1uWzFdKnIrblszXSppLGV9LHMudHJhbnNmb3JtTWF0MmQ9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdO3JldHVybiBlWzBdPW5bMF0qcituWzJdKmkrbls0XSxlWzFdPW5bMV0qcituWzNdKmkrbls1XSxlfSxzLnRyYW5zZm9ybU1hdDM9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdO3JldHVybiBlWzBdPW5bMF0qcituWzNdKmkrbls2XSxlWzFdPW5bMV0qcituWzRdKmkrbls3XSxlfSxzLnRyYW5zZm9ybU1hdDQ9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdO3JldHVybiBlWzBdPW5bMF0qcituWzRdKmkrblsxMl0sZVsxXT1uWzFdKnIrbls1XSppK25bMTNdLGV9LHMuZm9yRWFjaD1mdW5jdGlvbigpe3ZhciBlPXMuY3JlYXRlKCk7cmV0dXJuIGZ1bmN0aW9uKHQsbixyLGkscyxvKXt2YXIgdSxhO258fChuPTIpLHJ8fChyPTApLGk/YT1NYXRoLm1pbihpKm4rcix0Lmxlbmd0aCk6YT10Lmxlbmd0aDtmb3IodT1yO3U8YTt1Kz1uKWVbMF09dFt1XSxlWzFdPXRbdSsxXSxzKGUsZSxvKSx0W3VdPWVbMF0sdFt1KzFdPWVbMV07cmV0dXJuIHR9fSgpLHMuc3RyPWZ1bmN0aW9uKGUpe3JldHVyblwidmVjMihcIitlWzBdK1wiLCBcIitlWzFdK1wiKVwifSx0eXBlb2YgZSE9XCJ1bmRlZmluZWRcIiYmKGUudmVjMj1zKTt2YXIgbz17fTtvLmNyZWF0ZT1mdW5jdGlvbigpe3ZhciBlPW5ldyBuKDMpO3JldHVybiBlWzBdPTAsZVsxXT0wLGVbMl09MCxlfSxvLmNsb25lPWZ1bmN0aW9uKGUpe3ZhciB0PW5ldyBuKDMpO3JldHVybiB0WzBdPWVbMF0sdFsxXT1lWzFdLHRbMl09ZVsyXSx0fSxvLmZyb21WYWx1ZXM9ZnVuY3Rpb24oZSx0LHIpe3ZhciBpPW5ldyBuKDMpO3JldHVybiBpWzBdPWUsaVsxXT10LGlbMl09cixpfSxvLmNvcHk9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXT10WzBdLGVbMV09dFsxXSxlWzJdPXRbMl0sZX0sby5zZXQ9ZnVuY3Rpb24oZSx0LG4scil7cmV0dXJuIGVbMF09dCxlWzFdPW4sZVsyXT1yLGV9LG8uYWRkPWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10WzBdK25bMF0sZVsxXT10WzFdK25bMV0sZVsyXT10WzJdK25bMl0sZX0sby5zdWJ0cmFjdD1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dFswXS1uWzBdLGVbMV09dFsxXS1uWzFdLGVbMl09dFsyXS1uWzJdLGV9LG8uc3ViPW8uc3VidHJhY3Qsby5tdWx0aXBseT1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dFswXSpuWzBdLGVbMV09dFsxXSpuWzFdLGVbMl09dFsyXSpuWzJdLGV9LG8ubXVsPW8ubXVsdGlwbHksby5kaXZpZGU9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0vblswXSxlWzFdPXRbMV0vblsxXSxlWzJdPXRbMl0vblsyXSxlfSxvLmRpdj1vLmRpdmlkZSxvLm1pbj1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09TWF0aC5taW4odFswXSxuWzBdKSxlWzFdPU1hdGgubWluKHRbMV0sblsxXSksZVsyXT1NYXRoLm1pbih0WzJdLG5bMl0pLGV9LG8ubWF4PWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT1NYXRoLm1heCh0WzBdLG5bMF0pLGVbMV09TWF0aC5tYXgodFsxXSxuWzFdKSxlWzJdPU1hdGgubWF4KHRbMl0sblsyXSksZX0sby5zY2FsZT1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dFswXSpuLGVbMV09dFsxXSpuLGVbMl09dFsyXSpuLGV9LG8uc2NhbGVBbmRBZGQ9ZnVuY3Rpb24oZSx0LG4scil7cmV0dXJuIGVbMF09dFswXStuWzBdKnIsZVsxXT10WzFdK25bMV0qcixlWzJdPXRbMl0rblsyXSpyLGV9LG8uZGlzdGFuY2U9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLWVbMF0scj10WzFdLWVbMV0saT10WzJdLWVbMl07cmV0dXJuIE1hdGguc3FydChuKm4rcipyK2kqaSl9LG8uZGlzdD1vLmRpc3RhbmNlLG8uc3F1YXJlZERpc3RhbmNlPWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXS1lWzBdLHI9dFsxXS1lWzFdLGk9dFsyXS1lWzJdO3JldHVybiBuKm4rcipyK2kqaX0sby5zcXJEaXN0PW8uc3F1YXJlZERpc3RhbmNlLG8ubGVuZ3RoPWZ1bmN0aW9uKGUpe3ZhciB0PWVbMF0sbj1lWzFdLHI9ZVsyXTtyZXR1cm4gTWF0aC5zcXJ0KHQqdCtuKm4rcipyKX0sby5sZW49by5sZW5ndGgsby5zcXVhcmVkTGVuZ3RoPWZ1bmN0aW9uKGUpe3ZhciB0PWVbMF0sbj1lWzFdLHI9ZVsyXTtyZXR1cm4gdCp0K24qbityKnJ9LG8uc3FyTGVuPW8uc3F1YXJlZExlbmd0aCxvLm5lZ2F0ZT1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdPS10WzBdLGVbMV09LXRbMV0sZVsyXT0tdFsyXSxlfSxvLm5vcm1hbGl6ZT1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0scj10WzFdLGk9dFsyXSxzPW4qbityKnIraSppO3JldHVybiBzPjAmJihzPTEvTWF0aC5zcXJ0KHMpLGVbMF09dFswXSpzLGVbMV09dFsxXSpzLGVbMl09dFsyXSpzKSxlfSxvLmRvdD1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdKnRbMF0rZVsxXSp0WzFdK2VbMl0qdFsyXX0sby5jcm9zcz1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89blswXSx1PW5bMV0sYT1uWzJdO3JldHVybiBlWzBdPWkqYS1zKnUsZVsxXT1zKm8tciphLGVbMl09cip1LWkqbyxlfSxvLmxlcnA9ZnVuY3Rpb24oZSx0LG4scil7dmFyIGk9dFswXSxzPXRbMV0sbz10WzJdO3JldHVybiBlWzBdPWkrciooblswXS1pKSxlWzFdPXMrciooblsxXS1zKSxlWzJdPW8rciooblsyXS1vKSxlfSxvLnJhbmRvbT1mdW5jdGlvbihlLHQpe3Q9dHx8MTt2YXIgbj1yKCkqMipNYXRoLlBJLGk9cigpKjItMSxzPU1hdGguc3FydCgxLWkqaSkqdDtyZXR1cm4gZVswXT1NYXRoLmNvcyhuKSpzLGVbMV09TWF0aC5zaW4obikqcyxlWzJdPWkqdCxlfSxvLnRyYW5zZm9ybU1hdDQ9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXTtyZXR1cm4gZVswXT1uWzBdKnIrbls0XSppK25bOF0qcytuWzEyXSxlWzFdPW5bMV0qcituWzVdKmkrbls5XSpzK25bMTNdLGVbMl09blsyXSpyK25bNl0qaStuWzEwXSpzK25bMTRdLGV9LG8udHJhbnNmb3JtTWF0Mz1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdO3JldHVybiBlWzBdPXIqblswXStpKm5bM10rcypuWzZdLGVbMV09cipuWzFdK2kqbls0XStzKm5bN10sZVsyXT1yKm5bMl0raSpuWzVdK3Mqbls4XSxlfSxvLnRyYW5zZm9ybVF1YXQ9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPW5bMF0sdT1uWzFdLGE9blsyXSxmPW5bM10sbD1mKnIrdSpzLWEqaSxjPWYqaSthKnItbypzLGg9ZipzK28qaS11KnIscD0tbypyLXUqaS1hKnM7cmV0dXJuIGVbMF09bCpmK3AqLW8rYyotYS1oKi11LGVbMV09YypmK3AqLXUraCotby1sKi1hLGVbMl09aCpmK3AqLWErbCotdS1jKi1vLGV9LG8uZm9yRWFjaD1mdW5jdGlvbigpe3ZhciBlPW8uY3JlYXRlKCk7cmV0dXJuIGZ1bmN0aW9uKHQsbixyLGkscyxvKXt2YXIgdSxhO258fChuPTMpLHJ8fChyPTApLGk/YT1NYXRoLm1pbihpKm4rcix0Lmxlbmd0aCk6YT10Lmxlbmd0aDtmb3IodT1yO3U8YTt1Kz1uKWVbMF09dFt1XSxlWzFdPXRbdSsxXSxlWzJdPXRbdSsyXSxzKGUsZSxvKSx0W3VdPWVbMF0sdFt1KzFdPWVbMV0sdFt1KzJdPWVbMl07cmV0dXJuIHR9fSgpLG8uc3RyPWZ1bmN0aW9uKGUpe3JldHVyblwidmVjMyhcIitlWzBdK1wiLCBcIitlWzFdK1wiLCBcIitlWzJdK1wiKVwifSx0eXBlb2YgZSE9XCJ1bmRlZmluZWRcIiYmKGUudmVjMz1vKTt2YXIgdT17fTt1LmNyZWF0ZT1mdW5jdGlvbigpe3ZhciBlPW5ldyBuKDQpO3JldHVybiBlWzBdPTAsZVsxXT0wLGVbMl09MCxlWzNdPTAsZX0sdS5jbG9uZT1mdW5jdGlvbihlKXt2YXIgdD1uZXcgbig0KTtyZXR1cm4gdFswXT1lWzBdLHRbMV09ZVsxXSx0WzJdPWVbMl0sdFszXT1lWzNdLHR9LHUuZnJvbVZhbHVlcz1mdW5jdGlvbihlLHQscixpKXt2YXIgcz1uZXcgbig0KTtyZXR1cm4gc1swXT1lLHNbMV09dCxzWzJdPXIsc1szXT1pLHN9LHUuY29weT1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdPXRbMF0sZVsxXT10WzFdLGVbMl09dFsyXSxlWzNdPXRbM10sZX0sdS5zZXQ9ZnVuY3Rpb24oZSx0LG4scixpKXtyZXR1cm4gZVswXT10LGVbMV09bixlWzJdPXIsZVszXT1pLGV9LHUuYWRkPWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10WzBdK25bMF0sZVsxXT10WzFdK25bMV0sZVsyXT10WzJdK25bMl0sZVszXT10WzNdK25bM10sZX0sdS5zdWJ0cmFjdD1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dFswXS1uWzBdLGVbMV09dFsxXS1uWzFdLGVbMl09dFsyXS1uWzJdLGVbM109dFszXS1uWzNdLGV9LHUuc3ViPXUuc3VidHJhY3QsdS5tdWx0aXBseT1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dFswXSpuWzBdLGVbMV09dFsxXSpuWzFdLGVbMl09dFsyXSpuWzJdLGVbM109dFszXSpuWzNdLGV9LHUubXVsPXUubXVsdGlwbHksdS5kaXZpZGU9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0vblswXSxlWzFdPXRbMV0vblsxXSxlWzJdPXRbMl0vblsyXSxlWzNdPXRbM10vblszXSxlfSx1LmRpdj11LmRpdmlkZSx1Lm1pbj1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09TWF0aC5taW4odFswXSxuWzBdKSxlWzFdPU1hdGgubWluKHRbMV0sblsxXSksZVsyXT1NYXRoLm1pbih0WzJdLG5bMl0pLGVbM109TWF0aC5taW4odFszXSxuWzNdKSxlfSx1Lm1heD1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09TWF0aC5tYXgodFswXSxuWzBdKSxlWzFdPU1hdGgubWF4KHRbMV0sblsxXSksZVsyXT1NYXRoLm1heCh0WzJdLG5bMl0pLGVbM109TWF0aC5tYXgodFszXSxuWzNdKSxlfSx1LnNjYWxlPWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10WzBdKm4sZVsxXT10WzFdKm4sZVsyXT10WzJdKm4sZVszXT10WzNdKm4sZX0sdS5zY2FsZUFuZEFkZD1mdW5jdGlvbihlLHQsbixyKXtyZXR1cm4gZVswXT10WzBdK25bMF0qcixlWzFdPXRbMV0rblsxXSpyLGVbMl09dFsyXStuWzJdKnIsZVszXT10WzNdK25bM10qcixlfSx1LmRpc3RhbmNlPWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXS1lWzBdLHI9dFsxXS1lWzFdLGk9dFsyXS1lWzJdLHM9dFszXS1lWzNdO3JldHVybiBNYXRoLnNxcnQobipuK3IqcitpKmkrcypzKX0sdS5kaXN0PXUuZGlzdGFuY2UsdS5zcXVhcmVkRGlzdGFuY2U9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLWVbMF0scj10WzFdLWVbMV0saT10WzJdLWVbMl0scz10WzNdLWVbM107cmV0dXJuIG4qbityKnIraSppK3Mqc30sdS5zcXJEaXN0PXUuc3F1YXJlZERpc3RhbmNlLHUubGVuZ3RoPWZ1bmN0aW9uKGUpe3ZhciB0PWVbMF0sbj1lWzFdLHI9ZVsyXSxpPWVbM107cmV0dXJuIE1hdGguc3FydCh0KnQrbipuK3IqcitpKmkpfSx1Lmxlbj11Lmxlbmd0aCx1LnNxdWFyZWRMZW5ndGg9ZnVuY3Rpb24oZSl7dmFyIHQ9ZVswXSxuPWVbMV0scj1lWzJdLGk9ZVszXTtyZXR1cm4gdCp0K24qbityKnIraSppfSx1LnNxckxlbj11LnNxdWFyZWRMZW5ndGgsdS5uZWdhdGU9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXT0tdFswXSxlWzFdPS10WzFdLGVbMl09LXRbMl0sZVszXT0tdFszXSxlfSx1Lm5vcm1hbGl6ZT1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0scj10WzFdLGk9dFsyXSxzPXRbM10sbz1uKm4rcipyK2kqaStzKnM7cmV0dXJuIG8+MCYmKG89MS9NYXRoLnNxcnQobyksZVswXT10WzBdKm8sZVsxXT10WzFdKm8sZVsyXT10WzJdKm8sZVszXT10WzNdKm8pLGV9LHUuZG90PWZ1bmN0aW9uKGUsdCl7cmV0dXJuIGVbMF0qdFswXStlWzFdKnRbMV0rZVsyXSp0WzJdK2VbM10qdFszXX0sdS5sZXJwPWZ1bmN0aW9uKGUsdCxuLHIpe3ZhciBpPXRbMF0scz10WzFdLG89dFsyXSx1PXRbM107cmV0dXJuIGVbMF09aStyKihuWzBdLWkpLGVbMV09cytyKihuWzFdLXMpLGVbMl09bytyKihuWzJdLW8pLGVbM109dStyKihuWzNdLXUpLGV9LHUucmFuZG9tPWZ1bmN0aW9uKGUsdCl7cmV0dXJuIHQ9dHx8MSxlWzBdPXIoKSxlWzFdPXIoKSxlWzJdPXIoKSxlWzNdPXIoKSx1Lm5vcm1hbGl6ZShlLGUpLHUuc2NhbGUoZSxlLHQpLGV9LHUudHJhbnNmb3JtTWF0ND1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXTtyZXR1cm4gZVswXT1uWzBdKnIrbls0XSppK25bOF0qcytuWzEyXSpvLGVbMV09blsxXSpyK25bNV0qaStuWzldKnMrblsxM10qbyxlWzJdPW5bMl0qcituWzZdKmkrblsxMF0qcytuWzE0XSpvLGVbM109blszXSpyK25bN10qaStuWzExXSpzK25bMTVdKm8sZX0sdS50cmFuc2Zvcm1RdWF0PWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz1uWzBdLHU9blsxXSxhPW5bMl0sZj1uWzNdLGw9ZipyK3Uqcy1hKmksYz1mKmkrYSpyLW8qcyxoPWYqcytvKmktdSpyLHA9LW8qci11KmktYSpzO3JldHVybiBlWzBdPWwqZitwKi1vK2MqLWEtaCotdSxlWzFdPWMqZitwKi11K2gqLW8tbCotYSxlWzJdPWgqZitwKi1hK2wqLXUtYyotbyxlfSx1LmZvckVhY2g9ZnVuY3Rpb24oKXt2YXIgZT11LmNyZWF0ZSgpO3JldHVybiBmdW5jdGlvbih0LG4scixpLHMsbyl7dmFyIHUsYTtufHwobj00KSxyfHwocj0wKSxpP2E9TWF0aC5taW4oaSpuK3IsdC5sZW5ndGgpOmE9dC5sZW5ndGg7Zm9yKHU9cjt1PGE7dSs9billWzBdPXRbdV0sZVsxXT10W3UrMV0sZVsyXT10W3UrMl0sZVszXT10W3UrM10scyhlLGUsbyksdFt1XT1lWzBdLHRbdSsxXT1lWzFdLHRbdSsyXT1lWzJdLHRbdSszXT1lWzNdO3JldHVybiB0fX0oKSx1LnN0cj1mdW5jdGlvbihlKXtyZXR1cm5cInZlYzQoXCIrZVswXStcIiwgXCIrZVsxXStcIiwgXCIrZVsyXStcIiwgXCIrZVszXStcIilcIn0sdHlwZW9mIGUhPVwidW5kZWZpbmVkXCImJihlLnZlYzQ9dSk7dmFyIGE9e307YS5jcmVhdGU9ZnVuY3Rpb24oKXt2YXIgZT1uZXcgbig0KTtyZXR1cm4gZVswXT0xLGVbMV09MCxlWzJdPTAsZVszXT0xLGV9LGEuY2xvbmU9ZnVuY3Rpb24oZSl7dmFyIHQ9bmV3IG4oNCk7cmV0dXJuIHRbMF09ZVswXSx0WzFdPWVbMV0sdFsyXT1lWzJdLHRbM109ZVszXSx0fSxhLmNvcHk9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXT10WzBdLGVbMV09dFsxXSxlWzJdPXRbMl0sZVszXT10WzNdLGV9LGEuaWRlbnRpdHk9ZnVuY3Rpb24oZSl7cmV0dXJuIGVbMF09MSxlWzFdPTAsZVsyXT0wLGVbM109MSxlfSxhLnRyYW5zcG9zZT1mdW5jdGlvbihlLHQpe2lmKGU9PT10KXt2YXIgbj10WzFdO2VbMV09dFsyXSxlWzJdPW59ZWxzZSBlWzBdPXRbMF0sZVsxXT10WzJdLGVbMl09dFsxXSxlWzNdPXRbM107cmV0dXJuIGV9LGEuaW52ZXJ0PWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXSxyPXRbMV0saT10WzJdLHM9dFszXSxvPW4qcy1pKnI7cmV0dXJuIG8/KG89MS9vLGVbMF09cypvLGVbMV09LXIqbyxlWzJdPS1pKm8sZVszXT1uKm8sZSk6bnVsbH0sYS5hZGpvaW50PWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXTtyZXR1cm4gZVswXT10WzNdLGVbMV09LXRbMV0sZVsyXT0tdFsyXSxlWzNdPW4sZX0sYS5kZXRlcm1pbmFudD1mdW5jdGlvbihlKXtyZXR1cm4gZVswXSplWzNdLWVbMl0qZVsxXX0sYS5tdWx0aXBseT1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXSx1PW5bMF0sYT1uWzFdLGY9blsyXSxsPW5bM107cmV0dXJuIGVbMF09cip1K2kqZixlWzFdPXIqYStpKmwsZVsyXT1zKnUrbypmLGVbM109cyphK28qbCxlfSxhLm11bD1hLm11bHRpcGx5LGEucm90YXRlPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz10WzNdLHU9TWF0aC5zaW4obiksYT1NYXRoLmNvcyhuKTtyZXR1cm4gZVswXT1yKmEraSp1LGVbMV09ciotdStpKmEsZVsyXT1zKmErbyp1LGVbM109cyotdStvKmEsZX0sYS5zY2FsZT1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXSx1PW5bMF0sYT1uWzFdO3JldHVybiBlWzBdPXIqdSxlWzFdPWkqYSxlWzJdPXMqdSxlWzNdPW8qYSxlfSxhLnN0cj1mdW5jdGlvbihlKXtyZXR1cm5cIm1hdDIoXCIrZVswXStcIiwgXCIrZVsxXStcIiwgXCIrZVsyXStcIiwgXCIrZVszXStcIilcIn0sdHlwZW9mIGUhPVwidW5kZWZpbmVkXCImJihlLm1hdDI9YSk7dmFyIGY9e307Zi5jcmVhdGU9ZnVuY3Rpb24oKXt2YXIgZT1uZXcgbig2KTtyZXR1cm4gZVswXT0xLGVbMV09MCxlWzJdPTAsZVszXT0xLGVbNF09MCxlWzVdPTAsZX0sZi5jbG9uZT1mdW5jdGlvbihlKXt2YXIgdD1uZXcgbig2KTtyZXR1cm4gdFswXT1lWzBdLHRbMV09ZVsxXSx0WzJdPWVbMl0sdFszXT1lWzNdLHRbNF09ZVs0XSx0WzVdPWVbNV0sdH0sZi5jb3B5PWZ1bmN0aW9uKGUsdCl7cmV0dXJuIGVbMF09dFswXSxlWzFdPXRbMV0sZVsyXT10WzJdLGVbM109dFszXSxlWzRdPXRbNF0sZVs1XT10WzVdLGV9LGYuaWRlbnRpdHk9ZnVuY3Rpb24oZSl7cmV0dXJuIGVbMF09MSxlWzFdPTAsZVsyXT0wLGVbM109MSxlWzRdPTAsZVs1XT0wLGV9LGYuaW52ZXJ0PWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXSxyPXRbMV0saT10WzJdLHM9dFszXSxvPXRbNF0sdT10WzVdLGE9bipzLXIqaTtyZXR1cm4gYT8oYT0xL2EsZVswXT1zKmEsZVsxXT0tciphLGVbMl09LWkqYSxlWzNdPW4qYSxlWzRdPShpKnUtcypvKSphLGVbNV09KHIqby1uKnUpKmEsZSk6bnVsbH0sZi5kZXRlcm1pbmFudD1mdW5jdGlvbihlKXtyZXR1cm4gZVswXSplWzNdLWVbMV0qZVsyXX0sZi5tdWx0aXBseT1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXSx1PXRbNF0sYT10WzVdLGY9blswXSxsPW5bMV0sYz1uWzJdLGg9blszXSxwPW5bNF0sZD1uWzVdO3JldHVybiBlWzBdPXIqZitpKmMsZVsxXT1yKmwraSpoLGVbMl09cypmK28qYyxlWzNdPXMqbCtvKmgsZVs0XT1mKnUrYyphK3AsZVs1XT1sKnUraCphK2QsZX0sZi5tdWw9Zi5tdWx0aXBseSxmLnJvdGF0ZT1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXSx1PXRbNF0sYT10WzVdLGY9TWF0aC5zaW4obiksbD1NYXRoLmNvcyhuKTtyZXR1cm4gZVswXT1yKmwraSpmLGVbMV09LXIqZitpKmwsZVsyXT1zKmwrbypmLGVbM109LXMqZitsKm8sZVs0XT1sKnUrZiphLGVbNV09bCphLWYqdSxlfSxmLnNjYWxlPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj1uWzBdLGk9blsxXTtyZXR1cm4gZVswXT10WzBdKnIsZVsxXT10WzFdKmksZVsyXT10WzJdKnIsZVszXT10WzNdKmksZVs0XT10WzRdKnIsZVs1XT10WzVdKmksZX0sZi50cmFuc2xhdGU9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0sZVsxXT10WzFdLGVbMl09dFsyXSxlWzNdPXRbM10sZVs0XT10WzRdK25bMF0sZVs1XT10WzVdK25bMV0sZX0sZi5zdHI9ZnVuY3Rpb24oZSl7cmV0dXJuXCJtYXQyZChcIitlWzBdK1wiLCBcIitlWzFdK1wiLCBcIitlWzJdK1wiLCBcIitlWzNdK1wiLCBcIitlWzRdK1wiLCBcIitlWzVdK1wiKVwifSx0eXBlb2YgZSE9XCJ1bmRlZmluZWRcIiYmKGUubWF0MmQ9Zik7dmFyIGw9e307bC5jcmVhdGU9ZnVuY3Rpb24oKXt2YXIgZT1uZXcgbig5KTtyZXR1cm4gZVswXT0xLGVbMV09MCxlWzJdPTAsZVszXT0wLGVbNF09MSxlWzVdPTAsZVs2XT0wLGVbN109MCxlWzhdPTEsZX0sbC5mcm9tTWF0ND1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdPXRbMF0sZVsxXT10WzFdLGVbMl09dFsyXSxlWzNdPXRbNF0sZVs0XT10WzVdLGVbNV09dFs2XSxlWzZdPXRbOF0sZVs3XT10WzldLGVbOF09dFsxMF0sZX0sbC5jbG9uZT1mdW5jdGlvbihlKXt2YXIgdD1uZXcgbig5KTtyZXR1cm4gdFswXT1lWzBdLHRbMV09ZVsxXSx0WzJdPWVbMl0sdFszXT1lWzNdLHRbNF09ZVs0XSx0WzVdPWVbNV0sdFs2XT1lWzZdLHRbN109ZVs3XSx0WzhdPWVbOF0sdH0sbC5jb3B5PWZ1bmN0aW9uKGUsdCl7cmV0dXJuIGVbMF09dFswXSxlWzFdPXRbMV0sZVsyXT10WzJdLGVbM109dFszXSxlWzRdPXRbNF0sZVs1XT10WzVdLGVbNl09dFs2XSxlWzddPXRbN10sZVs4XT10WzhdLGV9LGwuaWRlbnRpdHk9ZnVuY3Rpb24oZSl7cmV0dXJuIGVbMF09MSxlWzFdPTAsZVsyXT0wLGVbM109MCxlWzRdPTEsZVs1XT0wLGVbNl09MCxlWzddPTAsZVs4XT0xLGV9LGwudHJhbnNwb3NlPWZ1bmN0aW9uKGUsdCl7aWYoZT09PXQpe3ZhciBuPXRbMV0scj10WzJdLGk9dFs1XTtlWzFdPXRbM10sZVsyXT10WzZdLGVbM109bixlWzVdPXRbN10sZVs2XT1yLGVbN109aX1lbHNlIGVbMF09dFswXSxlWzFdPXRbM10sZVsyXT10WzZdLGVbM109dFsxXSxlWzRdPXRbNF0sZVs1XT10WzddLGVbNl09dFsyXSxlWzddPXRbNV0sZVs4XT10WzhdO3JldHVybiBlfSxsLmludmVydD1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0scj10WzFdLGk9dFsyXSxzPXRbM10sbz10WzRdLHU9dFs1XSxhPXRbNl0sZj10WzddLGw9dFs4XSxjPWwqby11KmYsaD0tbCpzK3UqYSxwPWYqcy1vKmEsZD1uKmMrcipoK2kqcDtyZXR1cm4gZD8oZD0xL2QsZVswXT1jKmQsZVsxXT0oLWwqcitpKmYpKmQsZVsyXT0odSpyLWkqbykqZCxlWzNdPWgqZCxlWzRdPShsKm4taSphKSpkLGVbNV09KC11Km4raSpzKSpkLGVbNl09cCpkLGVbN109KC1mKm4rciphKSpkLGVbOF09KG8qbi1yKnMpKmQsZSk6bnVsbH0sbC5hZGpvaW50PWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXSxyPXRbMV0saT10WzJdLHM9dFszXSxvPXRbNF0sdT10WzVdLGE9dFs2XSxmPXRbN10sbD10WzhdO3JldHVybiBlWzBdPW8qbC11KmYsZVsxXT1pKmYtcipsLGVbMl09cip1LWkqbyxlWzNdPXUqYS1zKmwsZVs0XT1uKmwtaSphLGVbNV09aSpzLW4qdSxlWzZdPXMqZi1vKmEsZVs3XT1yKmEtbipmLGVbOF09bipvLXIqcyxlfSxsLmRldGVybWluYW50PWZ1bmN0aW9uKGUpe3ZhciB0PWVbMF0sbj1lWzFdLHI9ZVsyXSxpPWVbM10scz1lWzRdLG89ZVs1XSx1PWVbNl0sYT1lWzddLGY9ZVs4XTtyZXR1cm4gdCooZipzLW8qYSkrbiooLWYqaStvKnUpK3IqKGEqaS1zKnUpfSxsLm11bHRpcGx5PWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz10WzNdLHU9dFs0XSxhPXRbNV0sZj10WzZdLGw9dFs3XSxjPXRbOF0saD1uWzBdLHA9blsxXSxkPW5bMl0sdj1uWzNdLG09bls0XSxnPW5bNV0seT1uWzZdLGI9bls3XSx3PW5bOF07cmV0dXJuIGVbMF09aCpyK3AqbytkKmYsZVsxXT1oKmkrcCp1K2QqbCxlWzJdPWgqcytwKmErZCpjLGVbM109dipyK20qbytnKmYsZVs0XT12KmkrbSp1K2cqbCxlWzVdPXYqcyttKmErZypjLGVbNl09eSpyK2Iqbyt3KmYsZVs3XT15KmkrYip1K3cqbCxlWzhdPXkqcytiKmErdypjLGV9LGwubXVsPWwubXVsdGlwbHksbC50cmFuc2xhdGU9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM10sdT10WzRdLGE9dFs1XSxmPXRbNl0sbD10WzddLGM9dFs4XSxoPW5bMF0scD1uWzFdO3JldHVybiBlWzBdPXIsZVsxXT1pLGVbMl09cyxlWzNdPW8sZVs0XT11LGVbNV09YSxlWzZdPWgqcitwKm8rZixlWzddPWgqaStwKnUrbCxlWzhdPWgqcytwKmErYyxlfSxsLnJvdGF0ZT1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXSx1PXRbNF0sYT10WzVdLGY9dFs2XSxsPXRbN10sYz10WzhdLGg9TWF0aC5zaW4obikscD1NYXRoLmNvcyhuKTtyZXR1cm4gZVswXT1wKnIraCpvLGVbMV09cCppK2gqdSxlWzJdPXAqcytoKmEsZVszXT1wKm8taCpyLGVbNF09cCp1LWgqaSxlWzVdPXAqYS1oKnMsZVs2XT1mLGVbN109bCxlWzhdPWMsZX0sbC5zY2FsZT1mdW5jdGlvbihlLHQsbil7dmFyIHI9blswXSxpPW5bMV07cmV0dXJuIGVbMF09cip0WzBdLGVbMV09cip0WzFdLGVbMl09cip0WzJdLGVbM109aSp0WzNdLGVbNF09aSp0WzRdLGVbNV09aSp0WzVdLGVbNl09dFs2XSxlWzddPXRbN10sZVs4XT10WzhdLGV9LGwuZnJvbU1hdDJkPWZ1bmN0aW9uKGUsdCl7cmV0dXJuIGVbMF09dFswXSxlWzFdPXRbMV0sZVsyXT0wLGVbM109dFsyXSxlWzRdPXRbM10sZVs1XT0wLGVbNl09dFs0XSxlWzddPXRbNV0sZVs4XT0xLGV9LGwuZnJvbVF1YXQ9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLHI9dFsxXSxpPXRbMl0scz10WzNdLG89bituLHU9cityLGE9aStpLGY9bipvLGw9bip1LGM9biphLGg9cip1LHA9ciphLGQ9aSphLHY9cypvLG09cyp1LGc9cyphO3JldHVybiBlWzBdPTEtKGgrZCksZVszXT1sK2csZVs2XT1jLW0sZVsxXT1sLWcsZVs0XT0xLShmK2QpLGVbN109cCt2LGVbMl09YyttLGVbNV09cC12LGVbOF09MS0oZitoKSxlfSxsLm5vcm1hbEZyb21NYXQ0PWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXSxyPXRbMV0saT10WzJdLHM9dFszXSxvPXRbNF0sdT10WzVdLGE9dFs2XSxmPXRbN10sbD10WzhdLGM9dFs5XSxoPXRbMTBdLHA9dFsxMV0sZD10WzEyXSx2PXRbMTNdLG09dFsxNF0sZz10WzE1XSx5PW4qdS1yKm8sYj1uKmEtaSpvLHc9bipmLXMqbyxFPXIqYS1pKnUsUz1yKmYtcyp1LHg9aSpmLXMqYSxUPWwqdi1jKmQsTj1sKm0taCpkLEM9bCpnLXAqZCxrPWMqbS1oKnYsTD1jKmctcCp2LEE9aCpnLXAqbSxPPXkqQS1iKkwrdyprK0UqQy1TKk4reCpUO3JldHVybiBPPyhPPTEvTyxlWzBdPSh1KkEtYSpMK2YqaykqTyxlWzFdPShhKkMtbypBLWYqTikqTyxlWzJdPShvKkwtdSpDK2YqVCkqTyxlWzNdPShpKkwtcipBLXMqaykqTyxlWzRdPShuKkEtaSpDK3MqTikqTyxlWzVdPShyKkMtbipMLXMqVCkqTyxlWzZdPSh2KngtbSpTK2cqRSkqTyxlWzddPShtKnctZCp4LWcqYikqTyxlWzhdPShkKlMtdip3K2cqeSkqTyxlKTpudWxsfSxsLnN0cj1mdW5jdGlvbihlKXtyZXR1cm5cIm1hdDMoXCIrZVswXStcIiwgXCIrZVsxXStcIiwgXCIrZVsyXStcIiwgXCIrZVszXStcIiwgXCIrZVs0XStcIiwgXCIrZVs1XStcIiwgXCIrZVs2XStcIiwgXCIrZVs3XStcIiwgXCIrZVs4XStcIilcIn0sdHlwZW9mIGUhPVwidW5kZWZpbmVkXCImJihlLm1hdDM9bCk7dmFyIGM9e307Yy5jcmVhdGU9ZnVuY3Rpb24oKXt2YXIgZT1uZXcgbigxNik7cmV0dXJuIGVbMF09MSxlWzFdPTAsZVsyXT0wLGVbM109MCxlWzRdPTAsZVs1XT0xLGVbNl09MCxlWzddPTAsZVs4XT0wLGVbOV09MCxlWzEwXT0xLGVbMTFdPTAsZVsxMl09MCxlWzEzXT0wLGVbMTRdPTAsZVsxNV09MSxlfSxjLmNsb25lPWZ1bmN0aW9uKGUpe3ZhciB0PW5ldyBuKDE2KTtyZXR1cm4gdFswXT1lWzBdLHRbMV09ZVsxXSx0WzJdPWVbMl0sdFszXT1lWzNdLHRbNF09ZVs0XSx0WzVdPWVbNV0sdFs2XT1lWzZdLHRbN109ZVs3XSx0WzhdPWVbOF0sdFs5XT1lWzldLHRbMTBdPWVbMTBdLHRbMTFdPWVbMTFdLHRbMTJdPWVbMTJdLHRbMTNdPWVbMTNdLHRbMTRdPWVbMTRdLHRbMTVdPWVbMTVdLHR9LGMuY29weT1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdPXRbMF0sZVsxXT10WzFdLGVbMl09dFsyXSxlWzNdPXRbM10sZVs0XT10WzRdLGVbNV09dFs1XSxlWzZdPXRbNl0sZVs3XT10WzddLGVbOF09dFs4XSxlWzldPXRbOV0sZVsxMF09dFsxMF0sZVsxMV09dFsxMV0sZVsxMl09dFsxMl0sZVsxM109dFsxM10sZVsxNF09dFsxNF0sZVsxNV09dFsxNV0sZX0sYy5pZGVudGl0eT1mdW5jdGlvbihlKXtyZXR1cm4gZVswXT0xLGVbMV09MCxlWzJdPTAsZVszXT0wLGVbNF09MCxlWzVdPTEsZVs2XT0wLGVbN109MCxlWzhdPTAsZVs5XT0wLGVbMTBdPTEsZVsxMV09MCxlWzEyXT0wLGVbMTNdPTAsZVsxNF09MCxlWzE1XT0xLGV9LGMudHJhbnNwb3NlPWZ1bmN0aW9uKGUsdCl7aWYoZT09PXQpe3ZhciBuPXRbMV0scj10WzJdLGk9dFszXSxzPXRbNl0sbz10WzddLHU9dFsxMV07ZVsxXT10WzRdLGVbMl09dFs4XSxlWzNdPXRbMTJdLGVbNF09bixlWzZdPXRbOV0sZVs3XT10WzEzXSxlWzhdPXIsZVs5XT1zLGVbMTFdPXRbMTRdLGVbMTJdPWksZVsxM109byxlWzE0XT11fWVsc2UgZVswXT10WzBdLGVbMV09dFs0XSxlWzJdPXRbOF0sZVszXT10WzEyXSxlWzRdPXRbMV0sZVs1XT10WzVdLGVbNl09dFs5XSxlWzddPXRbMTNdLGVbOF09dFsyXSxlWzldPXRbNl0sZVsxMF09dFsxMF0sZVsxMV09dFsxNF0sZVsxMl09dFszXSxlWzEzXT10WzddLGVbMTRdPXRbMTFdLGVbMTVdPXRbMTVdO3JldHVybiBlfSxjLmludmVydD1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0scj10WzFdLGk9dFsyXSxzPXRbM10sbz10WzRdLHU9dFs1XSxhPXRbNl0sZj10WzddLGw9dFs4XSxjPXRbOV0saD10WzEwXSxwPXRbMTFdLGQ9dFsxMl0sdj10WzEzXSxtPXRbMTRdLGc9dFsxNV0seT1uKnUtcipvLGI9biphLWkqbyx3PW4qZi1zKm8sRT1yKmEtaSp1LFM9cipmLXMqdSx4PWkqZi1zKmEsVD1sKnYtYypkLE49bCptLWgqZCxDPWwqZy1wKmQsaz1jKm0taCp2LEw9YypnLXAqdixBPWgqZy1wKm0sTz15KkEtYipMK3cqaytFKkMtUypOK3gqVDtyZXR1cm4gTz8oTz0xL08sZVswXT0odSpBLWEqTCtmKmspKk8sZVsxXT0oaSpMLXIqQS1zKmspKk8sZVsyXT0odip4LW0qUytnKkUpKk8sZVszXT0oaCpTLWMqeC1wKkUpKk8sZVs0XT0oYSpDLW8qQS1mKk4pKk8sZVs1XT0obipBLWkqQytzKk4pKk8sZVs2XT0obSp3LWQqeC1nKmIpKk8sZVs3XT0obCp4LWgqdytwKmIpKk8sZVs4XT0obypMLXUqQytmKlQpKk8sZVs5XT0ocipDLW4qTC1zKlQpKk8sZVsxMF09KGQqUy12KncrZyp5KSpPLGVbMTFdPShjKnctbCpTLXAqeSkqTyxlWzEyXT0odSpOLW8qay1hKlQpKk8sZVsxM109KG4qay1yKk4raSpUKSpPLGVbMTRdPSh2KmItZCpFLW0qeSkqTyxlWzE1XT0obCpFLWMqYitoKnkpKk8sZSk6bnVsbH0sYy5hZGpvaW50PWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXSxyPXRbMV0saT10WzJdLHM9dFszXSxvPXRbNF0sdT10WzVdLGE9dFs2XSxmPXRbN10sbD10WzhdLGM9dFs5XSxoPXRbMTBdLHA9dFsxMV0sZD10WzEyXSx2PXRbMTNdLG09dFsxNF0sZz10WzE1XTtyZXR1cm4gZVswXT11KihoKmctcCptKS1jKihhKmctZiptKSt2KihhKnAtZipoKSxlWzFdPS0ociooaCpnLXAqbSktYyooaSpnLXMqbSkrdiooaSpwLXMqaCkpLGVbMl09ciooYSpnLWYqbSktdSooaSpnLXMqbSkrdiooaSpmLXMqYSksZVszXT0tKHIqKGEqcC1mKmgpLXUqKGkqcC1zKmgpK2MqKGkqZi1zKmEpKSxlWzRdPS0obyooaCpnLXAqbSktbCooYSpnLWYqbSkrZCooYSpwLWYqaCkpLGVbNV09biooaCpnLXAqbSktbCooaSpnLXMqbSkrZCooaSpwLXMqaCksZVs2XT0tKG4qKGEqZy1mKm0pLW8qKGkqZy1zKm0pK2QqKGkqZi1zKmEpKSxlWzddPW4qKGEqcC1mKmgpLW8qKGkqcC1zKmgpK2wqKGkqZi1zKmEpLGVbOF09byooYypnLXAqdiktbCoodSpnLWYqdikrZCoodSpwLWYqYyksZVs5XT0tKG4qKGMqZy1wKnYpLWwqKHIqZy1zKnYpK2QqKHIqcC1zKmMpKSxlWzEwXT1uKih1KmctZip2KS1vKihyKmctcyp2KStkKihyKmYtcyp1KSxlWzExXT0tKG4qKHUqcC1mKmMpLW8qKHIqcC1zKmMpK2wqKHIqZi1zKnUpKSxlWzEyXT0tKG8qKGMqbS1oKnYpLWwqKHUqbS1hKnYpK2QqKHUqaC1hKmMpKSxlWzEzXT1uKihjKm0taCp2KS1sKihyKm0taSp2KStkKihyKmgtaSpjKSxlWzE0XT0tKG4qKHUqbS1hKnYpLW8qKHIqbS1pKnYpK2QqKHIqYS1pKnUpKSxlWzE1XT1uKih1KmgtYSpjKS1vKihyKmgtaSpjKStsKihyKmEtaSp1KSxlfSxjLmRldGVybWluYW50PWZ1bmN0aW9uKGUpe3ZhciB0PWVbMF0sbj1lWzFdLHI9ZVsyXSxpPWVbM10scz1lWzRdLG89ZVs1XSx1PWVbNl0sYT1lWzddLGY9ZVs4XSxsPWVbOV0sYz1lWzEwXSxoPWVbMTFdLHA9ZVsxMl0sZD1lWzEzXSx2PWVbMTRdLG09ZVsxNV0sZz10Km8tbipzLHk9dCp1LXIqcyxiPXQqYS1pKnMsdz1uKnUtcipvLEU9biphLWkqbyxTPXIqYS1pKnUseD1mKmQtbCpwLFQ9Zip2LWMqcCxOPWYqbS1oKnAsQz1sKnYtYypkLGs9bCptLWgqZCxMPWMqbS1oKnY7cmV0dXJuIGcqTC15KmsrYipDK3cqTi1FKlQrUyp4fSxjLm11bHRpcGx5PWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz10WzNdLHU9dFs0XSxhPXRbNV0sZj10WzZdLGw9dFs3XSxjPXRbOF0saD10WzldLHA9dFsxMF0sZD10WzExXSx2PXRbMTJdLG09dFsxM10sZz10WzE0XSx5PXRbMTVdLGI9blswXSx3PW5bMV0sRT1uWzJdLFM9blszXTtyZXR1cm4gZVswXT1iKnIrdyp1K0UqYytTKnYsZVsxXT1iKmkrdyphK0UqaCtTKm0sZVsyXT1iKnMrdypmK0UqcCtTKmcsZVszXT1iKm8rdypsK0UqZCtTKnksYj1uWzRdLHc9bls1XSxFPW5bNl0sUz1uWzddLGVbNF09YipyK3cqdStFKmMrUyp2LGVbNV09YippK3cqYStFKmgrUyptLGVbNl09YipzK3cqZitFKnArUypnLGVbN109YipvK3cqbCtFKmQrUyp5LGI9bls4XSx3PW5bOV0sRT1uWzEwXSxTPW5bMTFdLGVbOF09YipyK3cqdStFKmMrUyp2LGVbOV09YippK3cqYStFKmgrUyptLGVbMTBdPWIqcyt3KmYrRSpwK1MqZyxlWzExXT1iKm8rdypsK0UqZCtTKnksYj1uWzEyXSx3PW5bMTNdLEU9blsxNF0sUz1uWzE1XSxlWzEyXT1iKnIrdyp1K0UqYytTKnYsZVsxM109YippK3cqYStFKmgrUyptLGVbMTRdPWIqcyt3KmYrRSpwK1MqZyxlWzE1XT1iKm8rdypsK0UqZCtTKnksZX0sYy5tdWw9Yy5tdWx0aXBseSxjLnRyYW5zbGF0ZT1mdW5jdGlvbihlLHQsbil7dmFyIHI9blswXSxpPW5bMV0scz1uWzJdLG8sdSxhLGYsbCxjLGgscCxkLHYsbSxnO3JldHVybiB0PT09ZT8oZVsxMl09dFswXSpyK3RbNF0qaSt0WzhdKnMrdFsxMl0sZVsxM109dFsxXSpyK3RbNV0qaSt0WzldKnMrdFsxM10sZVsxNF09dFsyXSpyK3RbNl0qaSt0WzEwXSpzK3RbMTRdLGVbMTVdPXRbM10qcit0WzddKmkrdFsxMV0qcyt0WzE1XSk6KG89dFswXSx1PXRbMV0sYT10WzJdLGY9dFszXSxsPXRbNF0sYz10WzVdLGg9dFs2XSxwPXRbN10sZD10WzhdLHY9dFs5XSxtPXRbMTBdLGc9dFsxMV0sZVswXT1vLGVbMV09dSxlWzJdPWEsZVszXT1mLGVbNF09bCxlWzVdPWMsZVs2XT1oLGVbN109cCxlWzhdPWQsZVs5XT12LGVbMTBdPW0sZVsxMV09ZyxlWzEyXT1vKnIrbCppK2Qqcyt0WzEyXSxlWzEzXT11KnIrYyppK3Yqcyt0WzEzXSxlWzE0XT1hKnIraCppK20qcyt0WzE0XSxlWzE1XT1mKnIrcCppK2cqcyt0WzE1XSksZX0sYy5zY2FsZT1mdW5jdGlvbihlLHQsbil7dmFyIHI9blswXSxpPW5bMV0scz1uWzJdO3JldHVybiBlWzBdPXRbMF0qcixlWzFdPXRbMV0qcixlWzJdPXRbMl0qcixlWzNdPXRbM10qcixlWzRdPXRbNF0qaSxlWzVdPXRbNV0qaSxlWzZdPXRbNl0qaSxlWzddPXRbN10qaSxlWzhdPXRbOF0qcyxlWzldPXRbOV0qcyxlWzEwXT10WzEwXSpzLGVbMTFdPXRbMTFdKnMsZVsxMl09dFsxMl0sZVsxM109dFsxM10sZVsxNF09dFsxNF0sZVsxNV09dFsxNV0sZX0sYy5yb3RhdGU9ZnVuY3Rpb24oZSxuLHIsaSl7dmFyIHM9aVswXSxvPWlbMV0sdT1pWzJdLGE9TWF0aC5zcXJ0KHMqcytvKm8rdSp1KSxmLGwsYyxoLHAsZCx2LG0sZyx5LGIsdyxFLFMseCxULE4sQyxrLEwsQSxPLE0sXztyZXR1cm4gTWF0aC5hYnMoYSk8dD9udWxsOihhPTEvYSxzKj1hLG8qPWEsdSo9YSxmPU1hdGguc2luKHIpLGw9TWF0aC5jb3MociksYz0xLWwsaD1uWzBdLHA9blsxXSxkPW5bMl0sdj1uWzNdLG09bls0XSxnPW5bNV0seT1uWzZdLGI9bls3XSx3PW5bOF0sRT1uWzldLFM9blsxMF0seD1uWzExXSxUPXMqcypjK2wsTj1vKnMqYyt1KmYsQz11KnMqYy1vKmYsaz1zKm8qYy11KmYsTD1vKm8qYytsLEE9dSpvKmMrcypmLE89cyp1KmMrbypmLE09byp1KmMtcypmLF89dSp1KmMrbCxlWzBdPWgqVCttKk4rdypDLGVbMV09cCpUK2cqTitFKkMsZVsyXT1kKlQreSpOK1MqQyxlWzNdPXYqVCtiKk4reCpDLGVbNF09aCprK20qTCt3KkEsZVs1XT1wKmsrZypMK0UqQSxlWzZdPWQqayt5KkwrUypBLGVbN109diprK2IqTCt4KkEsZVs4XT1oKk8rbSpNK3cqXyxlWzldPXAqTytnKk0rRSpfLGVbMTBdPWQqTyt5Kk0rUypfLGVbMTFdPXYqTytiKk0reCpfLG4hPT1lJiYoZVsxMl09blsxMl0sZVsxM109blsxM10sZVsxNF09blsxNF0sZVsxNV09blsxNV0pLGUpfSxjLnJvdGF0ZVg9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPU1hdGguc2luKG4pLGk9TWF0aC5jb3Mobikscz10WzRdLG89dFs1XSx1PXRbNl0sYT10WzddLGY9dFs4XSxsPXRbOV0sYz10WzEwXSxoPXRbMTFdO3JldHVybiB0IT09ZSYmKGVbMF09dFswXSxlWzFdPXRbMV0sZVsyXT10WzJdLGVbM109dFszXSxlWzEyXT10WzEyXSxlWzEzXT10WzEzXSxlWzE0XT10WzE0XSxlWzE1XT10WzE1XSksZVs0XT1zKmkrZipyLGVbNV09byppK2wqcixlWzZdPXUqaStjKnIsZVs3XT1hKmkraCpyLGVbOF09ZippLXMqcixlWzldPWwqaS1vKnIsZVsxMF09YyppLXUqcixlWzExXT1oKmktYSpyLGV9LGMucm90YXRlWT1mdW5jdGlvbihlLHQsbil7dmFyIHI9TWF0aC5zaW4obiksaT1NYXRoLmNvcyhuKSxzPXRbMF0sbz10WzFdLHU9dFsyXSxhPXRbM10sZj10WzhdLGw9dFs5XSxjPXRbMTBdLGg9dFsxMV07cmV0dXJuIHQhPT1lJiYoZVs0XT10WzRdLGVbNV09dFs1XSxlWzZdPXRbNl0sZVs3XT10WzddLGVbMTJdPXRbMTJdLGVbMTNdPXRbMTNdLGVbMTRdPXRbMTRdLGVbMTVdPXRbMTVdKSxlWzBdPXMqaS1mKnIsZVsxXT1vKmktbCpyLGVbMl09dSppLWMqcixlWzNdPWEqaS1oKnIsZVs4XT1zKnIrZippLGVbOV09bypyK2wqaSxlWzEwXT11KnIrYyppLGVbMTFdPWEqcitoKmksZX0sYy5yb3RhdGVaPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj1NYXRoLnNpbihuKSxpPU1hdGguY29zKG4pLHM9dFswXSxvPXRbMV0sdT10WzJdLGE9dFszXSxmPXRbNF0sbD10WzVdLGM9dFs2XSxoPXRbN107cmV0dXJuIHQhPT1lJiYoZVs4XT10WzhdLGVbOV09dFs5XSxlWzEwXT10WzEwXSxlWzExXT10WzExXSxlWzEyXT10WzEyXSxlWzEzXT10WzEzXSxlWzE0XT10WzE0XSxlWzE1XT10WzE1XSksZVswXT1zKmkrZipyLGVbMV09byppK2wqcixlWzJdPXUqaStjKnIsZVszXT1hKmkraCpyLGVbNF09ZippLXMqcixlWzVdPWwqaS1vKnIsZVs2XT1jKmktdSpyLGVbN109aCppLWEqcixlfSxjLmZyb21Sb3RhdGlvblRyYW5zbGF0aW9uPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz10WzNdLHU9cityLGE9aStpLGY9cytzLGw9cip1LGM9ciphLGg9cipmLHA9aSphLGQ9aSpmLHY9cypmLG09byp1LGc9byphLHk9bypmO3JldHVybiBlWzBdPTEtKHArdiksZVsxXT1jK3ksZVsyXT1oLWcsZVszXT0wLGVbNF09Yy15LGVbNV09MS0obCt2KSxlWzZdPWQrbSxlWzddPTAsZVs4XT1oK2csZVs5XT1kLW0sZVsxMF09MS0obCtwKSxlWzExXT0wLGVbMTJdPW5bMF0sZVsxM109blsxXSxlWzE0XT1uWzJdLGVbMTVdPTEsZX0sYy5mcm9tUXVhdD1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0scj10WzFdLGk9dFsyXSxzPXRbM10sbz1uK24sdT1yK3IsYT1pK2ksZj1uKm8sbD1uKnUsYz1uKmEsaD1yKnUscD1yKmEsZD1pKmEsdj1zKm8sbT1zKnUsZz1zKmE7cmV0dXJuIGVbMF09MS0oaCtkKSxlWzFdPWwrZyxlWzJdPWMtbSxlWzNdPTAsZVs0XT1sLWcsZVs1XT0xLShmK2QpLGVbNl09cCt2LGVbN109MCxlWzhdPWMrbSxlWzldPXAtdixlWzEwXT0xLShmK2gpLGVbMTFdPTAsZVsxMl09MCxlWzEzXT0wLGVbMTRdPTAsZVsxNV09MSxlfSxjLmZydXN0dW09ZnVuY3Rpb24oZSx0LG4scixpLHMsbyl7dmFyIHU9MS8obi10KSxhPTEvKGktciksZj0xLyhzLW8pO3JldHVybiBlWzBdPXMqMip1LGVbMV09MCxlWzJdPTAsZVszXT0wLGVbNF09MCxlWzVdPXMqMiphLGVbNl09MCxlWzddPTAsZVs4XT0obit0KSp1LGVbOV09KGkrcikqYSxlWzEwXT0obytzKSpmLGVbMTFdPS0xLGVbMTJdPTAsZVsxM109MCxlWzE0XT1vKnMqMipmLGVbMTVdPTAsZX0sYy5wZXJzcGVjdGl2ZT1mdW5jdGlvbihlLHQsbixyLGkpe3ZhciBzPTEvTWF0aC50YW4odC8yKSxvPTEvKHItaSk7cmV0dXJuIGVbMF09cy9uLGVbMV09MCxlWzJdPTAsZVszXT0wLGVbNF09MCxlWzVdPXMsZVs2XT0wLGVbN109MCxlWzhdPTAsZVs5XT0wLGVbMTBdPShpK3IpKm8sZVsxMV09LTEsZVsxMl09MCxlWzEzXT0wLGVbMTRdPTIqaSpyKm8sZVsxNV09MCxlfSxjLm9ydGhvPWZ1bmN0aW9uKGUsdCxuLHIsaSxzLG8pe3ZhciB1PTEvKHQtbiksYT0xLyhyLWkpLGY9MS8ocy1vKTtyZXR1cm4gZVswXT0tMip1LGVbMV09MCxlWzJdPTAsZVszXT0wLGVbNF09MCxlWzVdPS0yKmEsZVs2XT0wLGVbN109MCxlWzhdPTAsZVs5XT0wLGVbMTBdPTIqZixlWzExXT0wLGVbMTJdPSh0K24pKnUsZVsxM109KGkrcikqYSxlWzE0XT0obytzKSpmLGVbMTVdPTEsZX0sYy5sb29rQXQ9ZnVuY3Rpb24oZSxuLHIsaSl7dmFyIHMsbyx1LGEsZixsLGgscCxkLHYsbT1uWzBdLGc9blsxXSx5PW5bMl0sYj1pWzBdLHc9aVsxXSxFPWlbMl0sUz1yWzBdLHg9clsxXSxUPXJbMl07cmV0dXJuIE1hdGguYWJzKG0tUyk8dCYmTWF0aC5hYnMoZy14KTx0JiZNYXRoLmFicyh5LVQpPHQ/Yy5pZGVudGl0eShlKTooaD1tLVMscD1nLXgsZD15LVQsdj0xL01hdGguc3FydChoKmgrcCpwK2QqZCksaCo9dixwKj12LGQqPXYscz13KmQtRSpwLG89RSpoLWIqZCx1PWIqcC13Kmgsdj1NYXRoLnNxcnQocypzK28qbyt1KnUpLHY/KHY9MS92LHMqPXYsbyo9dix1Kj12KToocz0wLG89MCx1PTApLGE9cCp1LWQqbyxmPWQqcy1oKnUsbD1oKm8tcCpzLHY9TWF0aC5zcXJ0KGEqYStmKmYrbCpsKSx2Pyh2PTEvdixhKj12LGYqPXYsbCo9dik6KGE9MCxmPTAsbD0wKSxlWzBdPXMsZVsxXT1hLGVbMl09aCxlWzNdPTAsZVs0XT1vLGVbNV09ZixlWzZdPXAsZVs3XT0wLGVbOF09dSxlWzldPWwsZVsxMF09ZCxlWzExXT0wLGVbMTJdPS0ocyptK28qZyt1KnkpLGVbMTNdPS0oYSptK2YqZytsKnkpLGVbMTRdPS0oaCptK3AqZytkKnkpLGVbMTVdPTEsZSl9LGMuc3RyPWZ1bmN0aW9uKGUpe3JldHVyblwibWF0NChcIitlWzBdK1wiLCBcIitlWzFdK1wiLCBcIitlWzJdK1wiLCBcIitlWzNdK1wiLCBcIitlWzRdK1wiLCBcIitlWzVdK1wiLCBcIitlWzZdK1wiLCBcIitlWzddK1wiLCBcIitlWzhdK1wiLCBcIitlWzldK1wiLCBcIitlWzEwXStcIiwgXCIrZVsxMV0rXCIsIFwiK2VbMTJdK1wiLCBcIitlWzEzXStcIiwgXCIrZVsxNF0rXCIsIFwiK2VbMTVdK1wiKVwifSx0eXBlb2YgZSE9XCJ1bmRlZmluZWRcIiYmKGUubWF0ND1jKTt2YXIgaD17fTtoLmNyZWF0ZT1mdW5jdGlvbigpe3ZhciBlPW5ldyBuKDQpO3JldHVybiBlWzBdPTAsZVsxXT0wLGVbMl09MCxlWzNdPTEsZX0saC5yb3RhdGlvblRvPWZ1bmN0aW9uKCl7dmFyIGU9by5jcmVhdGUoKSx0PW8uZnJvbVZhbHVlcygxLDAsMCksbj1vLmZyb21WYWx1ZXMoMCwxLDApO3JldHVybiBmdW5jdGlvbihyLGkscyl7dmFyIHU9by5kb3QoaSxzKTtyZXR1cm4gdTwtMC45OTk5OTk/KG8uY3Jvc3MoZSx0LGkpLG8ubGVuZ3RoKGUpPDFlLTYmJm8uY3Jvc3MoZSxuLGkpLG8ubm9ybWFsaXplKGUsZSksaC5zZXRBeGlzQW5nbGUocixlLE1hdGguUEkpLHIpOnU+Ljk5OTk5OT8oclswXT0wLHJbMV09MCxyWzJdPTAsclszXT0xLHIpOihvLmNyb3NzKGUsaSxzKSxyWzBdPWVbMF0sclsxXT1lWzFdLHJbMl09ZVsyXSxyWzNdPTErdSxoLm5vcm1hbGl6ZShyLHIpKX19KCksaC5zZXRBeGVzPWZ1bmN0aW9uKCl7dmFyIGU9bC5jcmVhdGUoKTtyZXR1cm4gZnVuY3Rpb24odCxuLHIsaSl7cmV0dXJuIGVbMF09clswXSxlWzNdPXJbMV0sZVs2XT1yWzJdLGVbMV09aVswXSxlWzRdPWlbMV0sZVs3XT1pWzJdLGVbMl09blswXSxlWzVdPW5bMV0sZVs4XT1uWzJdLGgubm9ybWFsaXplKHQsaC5mcm9tTWF0Myh0LGUpKX19KCksaC5jbG9uZT11LmNsb25lLGguZnJvbVZhbHVlcz11LmZyb21WYWx1ZXMsaC5jb3B5PXUuY29weSxoLnNldD11LnNldCxoLmlkZW50aXR5PWZ1bmN0aW9uKGUpe3JldHVybiBlWzBdPTAsZVsxXT0wLGVbMl09MCxlWzNdPTEsZX0saC5zZXRBeGlzQW5nbGU9ZnVuY3Rpb24oZSx0LG4pe24qPS41O3ZhciByPU1hdGguc2luKG4pO3JldHVybiBlWzBdPXIqdFswXSxlWzFdPXIqdFsxXSxlWzJdPXIqdFsyXSxlWzNdPU1hdGguY29zKG4pLGV9LGguYWRkPXUuYWRkLGgubXVsdGlwbHk9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM10sdT1uWzBdLGE9blsxXSxmPW5bMl0sbD1uWzNdO3JldHVybiBlWzBdPXIqbCtvKnUraSpmLXMqYSxlWzFdPWkqbCtvKmErcyp1LXIqZixlWzJdPXMqbCtvKmYrciphLWkqdSxlWzNdPW8qbC1yKnUtaSphLXMqZixlfSxoLm11bD1oLm11bHRpcGx5LGguc2NhbGU9dS5zY2FsZSxoLnJvdGF0ZVg9ZnVuY3Rpb24oZSx0LG4pe24qPS41O3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM10sdT1NYXRoLnNpbihuKSxhPU1hdGguY29zKG4pO3JldHVybiBlWzBdPXIqYStvKnUsZVsxXT1pKmErcyp1LGVbMl09cyphLWkqdSxlWzNdPW8qYS1yKnUsZX0saC5yb3RhdGVZPWZ1bmN0aW9uKGUsdCxuKXtuKj0uNTt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz10WzNdLHU9TWF0aC5zaW4obiksYT1NYXRoLmNvcyhuKTtyZXR1cm4gZVswXT1yKmEtcyp1LGVbMV09aSphK28qdSxlWzJdPXMqYStyKnUsZVszXT1vKmEtaSp1LGV9LGgucm90YXRlWj1mdW5jdGlvbihlLHQsbil7bio9LjU7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXSx1PU1hdGguc2luKG4pLGE9TWF0aC5jb3Mobik7cmV0dXJuIGVbMF09ciphK2kqdSxlWzFdPWkqYS1yKnUsZVsyXT1zKmErbyp1LGVbM109byphLXMqdSxlfSxoLmNhbGN1bGF0ZVc9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLHI9dFsxXSxpPXRbMl07cmV0dXJuIGVbMF09bixlWzFdPXIsZVsyXT1pLGVbM109LU1hdGguc3FydChNYXRoLmFicygxLW4qbi1yKnItaSppKSksZX0saC5kb3Q9dS5kb3QsaC5sZXJwPXUubGVycCxoLnNsZXJwPWZ1bmN0aW9uKGUsdCxuLHIpe3ZhciBpPXRbMF0scz10WzFdLG89dFsyXSx1PXRbM10sYT1uWzBdLGY9blsxXSxsPW5bMl0sYz1uWzNdLGgscCxkLHYsbTtyZXR1cm4gcD1pKmErcypmK28qbCt1KmMscDwwJiYocD0tcCxhPS1hLGY9LWYsbD0tbCxjPS1jKSwxLXA+MWUtNj8oaD1NYXRoLmFjb3MocCksZD1NYXRoLnNpbihoKSx2PU1hdGguc2luKCgxLXIpKmgpL2QsbT1NYXRoLnNpbihyKmgpL2QpOih2PTEtcixtPXIpLGVbMF09dippK20qYSxlWzFdPXYqcyttKmYsZVsyXT12Km8rbSpsLGVbM109dip1K20qYyxlfSxoLmludmVydD1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0scj10WzFdLGk9dFsyXSxzPXRbM10sbz1uKm4rcipyK2kqaStzKnMsdT1vPzEvbzowO3JldHVybiBlWzBdPS1uKnUsZVsxXT0tcip1LGVbMl09LWkqdSxlWzNdPXMqdSxlfSxoLmNvbmp1Z2F0ZT1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdPS10WzBdLGVbMV09LXRbMV0sZVsyXT0tdFsyXSxlWzNdPXRbM10sZX0saC5sZW5ndGg9dS5sZW5ndGgsaC5sZW49aC5sZW5ndGgsaC5zcXVhcmVkTGVuZ3RoPXUuc3F1YXJlZExlbmd0aCxoLnNxckxlbj1oLnNxdWFyZWRMZW5ndGgsaC5ub3JtYWxpemU9dS5ub3JtYWxpemUsaC5mcm9tTWF0Mz1mdW5jdGlvbigpe3ZhciBlPXR5cGVvZiBJbnQ4QXJyYXkhPVwidW5kZWZpbmVkXCI/bmV3IEludDhBcnJheShbMSwyLDBdKTpbMSwyLDBdO3JldHVybiBmdW5jdGlvbih0LG4pe3ZhciByPW5bMF0rbls0XStuWzhdLGk7aWYocj4wKWk9TWF0aC5zcXJ0KHIrMSksdFszXT0uNSppLGk9LjUvaSx0WzBdPShuWzddLW5bNV0pKmksdFsxXT0oblsyXS1uWzZdKSppLHRbMl09KG5bM10tblsxXSkqaTtlbHNle3ZhciBzPTA7bls0XT5uWzBdJiYocz0xKSxuWzhdPm5bcyozK3NdJiYocz0yKTt2YXIgbz1lW3NdLHU9ZVtvXTtpPU1hdGguc3FydChuW3MqMytzXS1uW28qMytvXS1uW3UqMyt1XSsxKSx0W3NdPS41KmksaT0uNS9pLHRbM109KG5bdSozK29dLW5bbyozK3VdKSppLHRbb109KG5bbyozK3NdK25bcyozK29dKSppLHRbdV09KG5bdSozK3NdK25bcyozK3VdKSppfXJldHVybiB0fX0oKSxoLnN0cj1mdW5jdGlvbihlKXtyZXR1cm5cInF1YXQoXCIrZVswXStcIiwgXCIrZVsxXStcIiwgXCIrZVsyXStcIiwgXCIrZVszXStcIilcIn0sdHlwZW9mIGUhPVwidW5kZWZpbmVkXCImJihlLnF1YXQ9aCl9KHQuZXhwb3J0cyl9KSh0aGlzKTtcbiIsIi8qXG5cdGdsU2hhZGVyXG5cdENvcHlyaWdodCAoYykgMjAxMywgTmVydm91cyBTeXN0ZW0sIGluYy4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cblx0XG5cdFJlZGlzdHJpYnV0aW9uIGFuZCB1c2UgaW4gc291cmNlIGFuZCBiaW5hcnkgZm9ybXMsIHdpdGggb3Igd2l0aG91dCBtb2RpZmljYXRpb24sXG5hcmUgcGVybWl0dGVkIHByb3ZpZGVkIHRoYXQgdGhlIGZvbGxvd2luZyBjb25kaXRpb25zIGFyZSBtZXQ6XG5cbiAgKiBSZWRpc3RyaWJ1dGlvbnMgb2Ygc291cmNlIGNvZGUgbXVzdCByZXRhaW4gdGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UsIHRoaXNcbiAgICBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lci5cbiAgKiBSZWRpc3RyaWJ1dGlvbnMgaW4gYmluYXJ5IGZvcm0gbXVzdCByZXByb2R1Y2UgdGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UsXG4gICAgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lciBpbiB0aGUgZG9jdW1lbnRhdGlvbiBcbiAgICBhbmQvb3Igb3RoZXIgbWF0ZXJpYWxzIHByb3ZpZGVkIHdpdGggdGhlIGRpc3RyaWJ1dGlvbi5cblxuVEhJUyBTT0ZUV0FSRSBJUyBQUk9WSURFRCBCWSBUSEUgQ09QWVJJR0hUIEhPTERFUlMgQU5EIENPTlRSSUJVVE9SUyBcIkFTIElTXCIgQU5EXG5BTlkgRVhQUkVTUyBPUiBJTVBMSUVEIFdBUlJBTlRJRVMsIElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBUSEUgSU1QTElFRFxuV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFkgQU5EIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFSRSBcbkRJU0NMQUlNRUQuIElOIE5PIEVWRU5UIFNIQUxMIFRIRSBDT1BZUklHSFQgSE9MREVSIE9SIENPTlRSSUJVVE9SUyBCRSBMSUFCTEUgRk9SXG5BTlkgRElSRUNULCBJTkRJUkVDVCwgSU5DSURFTlRBTCwgU1BFQ0lBTCwgRVhFTVBMQVJZLCBPUiBDT05TRVFVRU5USUFMIERBTUFHRVNcbihJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgUFJPQ1VSRU1FTlQgT0YgU1VCU1RJVFVURSBHT09EUyBPUiBTRVJWSUNFUztcbkxPU1MgT0YgVVNFLCBEQVRBLCBPUiBQUk9GSVRTOyBPUiBCVVNJTkVTUyBJTlRFUlJVUFRJT04pIEhPV0VWRVIgQ0FVU0VEIEFORCBPTlxuQU5ZIFRIRU9SWSBPRiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQ09OVFJBQ1QsIFNUUklDVCBMSUFCSUxJVFksIE9SIFRPUlRcbihJTkNMVURJTkcgTkVHTElHRU5DRSBPUiBPVEhFUldJU0UpIEFSSVNJTkcgSU4gQU5ZIFdBWSBPVVQgT0YgVEhFIFVTRSBPRiBUSElTXG5TT0ZUV0FSRSwgRVZFTiBJRiBBRFZJU0VEIE9GIFRIRSBQT1NTSUJJTElUWSBPRiBTVUNIIERBTUFHRS5cblxuXHR1c2VzIHNvbWUgaWRlYXMgKGFuZCBjb2RlKSBmcm9tIGdsLXNoYWRlciBodHRwczovL2dpdGh1Yi5jb20vbWlrb2xhbHlzZW5rby9nbC1zaGFkZXJcblx0aG93ZXZlciBzb21lIGRpZmZlcmVuY2VzIGluY2x1ZGUgc2F2aW5nIHVuaWZvcm0gbG9jYXRpb25zIGFuZCBxdWVyeWluZyBnbCB0byBnZXQgdW5pZm9ybXMgYW5kIGF0dHJpYnMgaW5zdGVhZCBvZiBwYXJzaW5nIGZpbGVzIGFuZCB1c2VzIG5vcm1hbCBzeW50YXggaW5zdGVhZCBvZiBmYWtlIG9wZXJhdG9yIG92ZXJsb2FkaW5nIHdoaWNoIGlzIGEgY29uZnVzaW5nIHBhdHRlcm4gaW4gSmF2YXNjcmlwdC5cbiovXG5cbihmdW5jdGlvbihfZ2xvYmFsKSB7XG4gIFwidXNlIHN0cmljdFwiO1xuXG4gIHZhciBzaGltID0ge307XG4gIGlmICh0eXBlb2YoZXhwb3J0cykgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYodHlwZW9mIGRlZmluZSA9PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBkZWZpbmUuYW1kID09ICdvYmplY3QnICYmIGRlZmluZS5hbWQpIHtcbiAgICAgIHNoaW0uZXhwb3J0cyA9IHt9O1xuICAgICAgZGVmaW5lKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gc2hpbS5leHBvcnRzO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vdGhpcyB0aGluZyBsaXZlcyBpbiBhIGJyb3dzZXIsIGRlZmluZSBpdHMgbmFtZXNwYWNlcyBpbiBnbG9iYWxcbiAgICAgIHNoaW0uZXhwb3J0cyA9IHR5cGVvZih3aW5kb3cpICE9PSAndW5kZWZpbmVkJyA/IHdpbmRvdyA6IF9nbG9iYWw7XG4gICAgfVxuICB9XG4gIGVsc2Uge1xuICAgIC8vdGhpcyB0aGluZyBsaXZlcyBpbiBjb21tb25qcywgZGVmaW5lIGl0cyBuYW1lc3BhY2VzIGluIGV4cG9ydHNcbiAgICBzaGltLmV4cG9ydHMgPSBleHBvcnRzO1xuICB9XG4gIChmdW5jdGlvbihleHBvcnRzKSB7XG5cblxuICB2YXIgZ2w7XG4gIGZ1bmN0aW9uIFNoYWRlcihnbCwgcHJvZykge1xuICAgIHRoaXMuZ2wgPSBnbDtcbiAgICB0aGlzLnByb2dyYW0gPSBwcm9nO1xuICAgIHRoaXMudW5pZm9ybXMgPSB7fTtcbiAgICB0aGlzLmF0dHJpYnMgPSB7fTtcbiAgICB0aGlzLmlzUmVhZHkgPSBmYWxzZTtcbiAgfVxuXG4gIFNoYWRlci5wcm90b3R5cGUuYmVnaW4gPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmdsLnVzZVByb2dyYW0odGhpcy5wcm9ncmFtKTtcbiAgICB0aGlzLmVuYWJsZUF0dHJpYnMoKTtcbiAgfVxuXG4gIFNoYWRlci5wcm90b3R5cGUuZW5kID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5kaXNhYmxlQXR0cmlicygpO1xuICB9XG5cbiAgU2hhZGVyLnByb3RvdHlwZS5lbmFibGVBdHRyaWJzID0gZnVuY3Rpb24oKSB7XG4gICAgZm9yKHZhciBhdHRyaWIgaW4gdGhpcy5hdHRyaWJzKSB7XG4gICAgdGhpcy5hdHRyaWJzW2F0dHJpYl0uZW5hYmxlKCk7XG4gICAgfVxuICB9XG4gIFNoYWRlci5wcm90b3R5cGUuZGlzYWJsZUF0dHJpYnMgPSBmdW5jdGlvbigpIHtcbiAgICBmb3IodmFyIGF0dHJpYiBpbiB0aGlzLmF0dHJpYnMpIHtcbiAgICB0aGlzLmF0dHJpYnNbYXR0cmliXS5kaXNhYmxlKCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gbWFrZVZlY3RvclVuaWZvcm0oZ2wsIHNoYWRlciwgbG9jYXRpb24sIG9iaiwgdHlwZSwgZCwgbmFtZSkge1xuICAgIHZhciB1bmlmb3JtT2JqID0ge307XG4gICAgdW5pZm9ybU9iai5sb2NhdGlvbiA9IGxvY2F0aW9uO1xuICAgIGlmKGQgPiAxKSB7XG4gICAgICB0eXBlICs9IFwidlwiO1xuICAgIH1cbiAgICB2YXIgc2V0dGVyID0gbmV3IEZ1bmN0aW9uKFwiZ2xcIiwgXCJwcm9nXCIsIFwibG9jXCIsIFwidlwiLCBcImdsLnVuaWZvcm1cIiArIGQgKyB0eXBlICsgXCIobG9jLCB2KVwiKTtcbiAgICB1bmlmb3JtT2JqLnNldCA9IHNldHRlci5iaW5kKHVuZGVmaW5lZCwgZ2wsIHNoYWRlci5wcm9ncmFtLGxvY2F0aW9uKTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBuYW1lLCB7XG4gICAgICB2YWx1ZTp1bmlmb3JtT2JqLFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gbWFrZU1hdHJpeFVuaWZvcm0oZ2wsIHNoYWRlciwgbG9jYXRpb24sIG9iaiwgZCwgbmFtZSkge1xuICAgIHZhciB1bmlmb3JtT2JqID0ge307XG4gICAgdW5pZm9ybU9iai5sb2NhdGlvbiA9IGxvY2F0aW9uO1xuICAgIHZhciBzZXR0ZXIgPSBuZXcgRnVuY3Rpb24oXCJnbFwiLCBcInByb2dcIiwgXCJsb2NcIixcInZcIiwgXCJnbC51bmlmb3JtTWF0cml4XCIgKyBkICsgXCJmdihsb2MsIGZhbHNlLCB2KVwiKTtcbiAgICB1bmlmb3JtT2JqLnNldCA9IHNldHRlci5iaW5kKHVuZGVmaW5lZCwgZ2wsIHNoYWRlci5wcm9ncmFtLGxvY2F0aW9uKTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBuYW1lLCB7XG4gICAgICB2YWx1ZTp1bmlmb3JtT2JqLFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gbWFrZVZlY3RvckF0dHJpYihnbCwgc2hhZGVyLCBsb2NhdGlvbiwgb2JqLCBkLCBuYW1lKSB7XG4gICAgdmFyIG91dCA9IHt9O1xuICAgIG91dC5zZXQgPSBmdW5jdGlvbiBzZXRBdHRyaWIoYnVmZmVyLHR5cGUpIHtcbiAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUixidWZmZXIpO1xuICAgIGdsLnZlcnRleEF0dHJpYlBvaW50ZXIobG9jYXRpb24sIGQsIHR5cGV8fGdsLkZMT0FULCBmYWxzZSwgMCwgMCk7XG4gICAgfVxuICAgIG91dC5wb2ludGVyID0gZnVuY3Rpb24gYXR0cmliUG9pbnRlcih0eXBlLCBub3JtYWxpemVkLCBzdHJpZGUsIG9mZnNldCkge1xuICAgICAgZ2wudmVydGV4QXR0cmliUG9pbnRlcihsb2NhdGlvbiwgZCwgdHlwZXx8Z2wuRkxPQVQsIG5vcm1hbGl6ZWQ/dHJ1ZTpmYWxzZSwgc3RyaWRlfHwwLCBvZmZzZXR8fDApO1xuICAgIH07XG4gICAgb3V0LmVuYWJsZSA9IGZ1bmN0aW9uIGVuYWJsZUF0dHJpYigpIHtcbiAgICAgIGdsLmVuYWJsZVZlcnRleEF0dHJpYkFycmF5KGxvY2F0aW9uKTtcbiAgICB9O1xuICAgIG91dC5kaXNhYmxlID0gZnVuY3Rpb24gZGlzYWJsZUF0dHJpYigpIHtcbiAgICAgIGdsLmRpc2FibGVWZXJ0ZXhBdHRyaWJBcnJheShsb2NhdGlvbik7XG4gICAgfTtcbiAgICBvdXQubG9jYXRpb24gPSBsb2NhdGlvbjtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBuYW1lLCB7XG4gICAgdmFsdWU6IG91dCxcbiAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBzZXR1cFVuaWZvcm0oZ2wsc2hhZGVyLCB1bmlmb3JtLGxvYykge1xuICAgIHN3aXRjaCh1bmlmb3JtLnR5cGUpIHtcbiAgICAgIGNhc2UgZ2wuSU5UOlxuICAgICAgY2FzZSBnbC5CT09MOlxuICAgICAgY2FzZSBnbC5TQU1QTEVSXzJEOlxuICAgICAgY2FzZSBnbC5TQU1QTEVSX0NVQkU6XG4gICAgICAgIG1ha2VWZWN0b3JVbmlmb3JtKGdsLHNoYWRlcixsb2MsIHNoYWRlci51bmlmb3JtcywgXCJpXCIsMSx1bmlmb3JtLm5hbWUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgZ2wuSU5UX1ZFQzI6XG4gICAgICBjYXNlIGdsLkJPT0xfVkVDMjpcbiAgICAgICAgbWFrZVZlY3RvclVuaWZvcm0oZ2wsc2hhZGVyLGxvYywgc2hhZGVyLnVuaWZvcm1zLCBcImlcIiwyLHVuaWZvcm0ubmFtZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBnbC5JTlRfVkVDMzpcbiAgICAgIGNhc2UgZ2wuQk9PTF9WRUMzOlxuICAgICAgICBtYWtlVmVjdG9yVW5pZm9ybShnbCxzaGFkZXIsbG9jLCBzaGFkZXIudW5pZm9ybXMsIFwiaVwiLDMsdW5pZm9ybS5uYW1lKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGdsLklOVF9WRUM0OlxuICAgICAgY2FzZSBnbC5CT09MX1ZFQzQ6XG4gICAgICAgIG1ha2VWZWN0b3JVbmlmb3JtKGdsLHNoYWRlcixsb2MsIHNoYWRlci51bmlmb3JtcywgXCJpXCIsNCx1bmlmb3JtLm5hbWUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgZ2wuRkxPQVQ6XG4gICAgICAgIG1ha2VWZWN0b3JVbmlmb3JtKGdsLHNoYWRlcixsb2MsIHNoYWRlci51bmlmb3JtcywgXCJmXCIsMSx1bmlmb3JtLm5hbWUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgZ2wuRkxPQVRfVkVDMjpcbiAgICAgICAgbWFrZVZlY3RvclVuaWZvcm0oZ2wsc2hhZGVyLGxvYywgc2hhZGVyLnVuaWZvcm1zLCBcImZcIiwyLHVuaWZvcm0ubmFtZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBnbC5GTE9BVF9WRUMzOlxuICAgICAgICBtYWtlVmVjdG9yVW5pZm9ybShnbCxzaGFkZXIsbG9jLCBzaGFkZXIudW5pZm9ybXMsIFwiZlwiLDMsdW5pZm9ybS5uYW1lKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGdsLkZMT0FUX1ZFQzQ6XG4gICAgICAgIG1ha2VWZWN0b3JVbmlmb3JtKGdsLHNoYWRlcixsb2MsIHNoYWRlci51bmlmb3JtcywgXCJmXCIsNCx1bmlmb3JtLm5hbWUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgZ2wuRkxPQVRfTUFUMjpcbiAgICAgICAgbWFrZU1hdHJpeFVuaWZvcm0oZ2wsc2hhZGVyLGxvYywgc2hhZGVyLnVuaWZvcm1zLCAyLHVuaWZvcm0ubmFtZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBnbC5GTE9BVF9NQVQzOlxuICAgICAgICBtYWtlTWF0cml4VW5pZm9ybShnbCxzaGFkZXIsbG9jLCBzaGFkZXIudW5pZm9ybXMsIDMsdW5pZm9ybS5uYW1lKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGdsLkZMT0FUX01BVDQ6XG4gICAgICAgIG1ha2VNYXRyaXhVbmlmb3JtKGdsLHNoYWRlcixsb2MsIHNoYWRlci51bmlmb3JtcywgNCx1bmlmb3JtLm5hbWUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgdW5pZm9ybSB0eXBlIGluIHNoYWRlcjogXCIgK3NoYWRlcik7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHNldHVwQXR0cmliKGdsLHNoYWRlcixhdHRyaWIsbG9jYXRpb24pIHtcbiAgICB2YXIgbGVuID0gMTtcbiAgICBzd2l0Y2goYXR0cmliLnR5cGUpIHtcbiAgICAgIGNhc2UgZ2wuRkxPQVRfVkVDMjpcbiAgICAgICAgbGVuID0gMjtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGdsLkZMT0FUX1ZFQzM6XG4gICAgICAgIGxlbiA9IDM7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBnbC5GTE9BVF9WRUM0OlxuICAgICAgICBsZW4gPSA0O1xuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgbWFrZVZlY3RvckF0dHJpYihnbCwgc2hhZGVyLCBsb2NhdGlvbixzaGFkZXIuYXR0cmlicywgbGVuLCBhdHRyaWIubmFtZSk7XG4gIH1cblxuXG4gIGZ1bmN0aW9uIGxvYWRYTUxEb2MoZmlsZW5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICB2YXIgeG1saHR0cDtcbiAgICAgIHZhciB0ZXh0O1xuICAgICAgeG1saHR0cCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgICB4bWxodHRwLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGlmICh4bWxodHRwLnJlYWR5U3RhdGUgPT0gNCAmJiB4bWxodHRwLnN0YXR1cyA9PSAyMDApIGNhbGxiYWNrKHhtbGh0dHAucmVzcG9uc2VUZXh0KTtcbiAgICAgIH1cblxuICAgICAgeG1saHR0cC5vcGVuKFwiR0VUXCIsIGZpbGVuYW1lLCB0cnVlKTtcbiAgICAgIHhtbGh0dHAuc2VuZCgpO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0U2hhZGVyKGdsLCBzcmMsIHR5cGUpIHtcbiAgICAgIHZhciBzaGFkZXI7XG4gICAgICAvL2RlY2lkZXMgaWYgaXQncyBhIGZyYWdtZW50IG9yIHZlcnRleCBzaGFkZXJcblxuICAgICAgaWYgKHR5cGUgPT0gXCJmcmFnbWVudFwiKSB7XG4gICAgICAgICAgc2hhZGVyID0gZ2wuY3JlYXRlU2hhZGVyKGdsLkZSQUdNRU5UX1NIQURFUik7XG4gICAgICB9XG4gICAgICBlbHNlIGlmICh0eXBlID09IFwidmVydGV4XCIpIHtcbiAgICAgICAgICBzaGFkZXIgPSBnbC5jcmVhdGVTaGFkZXIoZ2wuVkVSVEVYX1NIQURFUik7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICAgIGdsLnNoYWRlclNvdXJjZShzaGFkZXIsIHNyYyk7XG4gICAgICBnbC5jb21waWxlU2hhZGVyKHNoYWRlcik7XG5cbiAgICAgIGlmICghZ2wuZ2V0U2hhZGVyUGFyYW1ldGVyKHNoYWRlciwgZ2wuQ09NUElMRV9TVEFUVVMpKSB7XG4gICAgICAgICAgYWxlcnQoZ2wuZ2V0U2hhZGVySW5mb0xvZyhzaGFkZXIpKTtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzaGFkZXI7XG4gIH1cblxuICBmdW5jdGlvbiBzZXR1cFNoYWRlclByb2dyYW0oZ2wsc2hhZGVyUHJvZ3JhbSwgdmVydGV4U2hhZGVyLCBmcmFnbWVudFNoYWRlcixjYWxsYmFjaykge1xuICAgICAgZ2wuYXR0YWNoU2hhZGVyKHNoYWRlclByb2dyYW0sIHZlcnRleFNoYWRlcik7XG4gICAgICBnbC5hdHRhY2hTaGFkZXIoc2hhZGVyUHJvZ3JhbSwgZnJhZ21lbnRTaGFkZXIpO1xuICAgICAgZ2wubGlua1Byb2dyYW0oc2hhZGVyUHJvZ3JhbSk7XG5cbiAgICAgIGlmICghZ2wuZ2V0UHJvZ3JhbVBhcmFtZXRlcihzaGFkZXJQcm9ncmFtLCBnbC5MSU5LX1NUQVRVUykpIHtcbiAgICAgICAgICBhbGVydChcIkNvdWxkIG5vdCBpbml0aWFsaXNlIHNoYWRlcnNcIik7XG4gICAgICB9XG4gICAgICBjYWxsYmFjayhzaGFkZXJQcm9ncmFtKTtcbiAgfVxuXG4gIHZhciBnbFNoYWRlciA9IGV4cG9ydHM7XG4gIFxuICBnbFNoYWRlci5zZXRHTCA9IGZ1bmN0aW9uKF9nbCkge1xuICAgIGdsID0gX2dsO1xuICB9XG4gIFxuICBnbFNoYWRlci5tYWtlU2hhZGVyID0gZnVuY3Rpb24oZ2wscHJvZ3JhbSxzaGFkZXIpIHtcbiAgICB2YXIgdG90YWxVbmlmb3JtcyA9IGdsLmdldFByb2dyYW1QYXJhbWV0ZXIocHJvZ3JhbSwgZ2wuQUNUSVZFX1VOSUZPUk1TKTtcbiAgICBzaGFkZXIgPSBzaGFkZXIgfHwgbmV3IFNoYWRlcihnbCxwcm9ncmFtKTtcbiAgICBmb3IodmFyIGk9MDtpPHRvdGFsVW5pZm9ybXM7KytpKSB7XG4gICAgICB2YXIgdW5pZm9ybSA9IGdsLmdldEFjdGl2ZVVuaWZvcm0ocHJvZ3JhbSwgaSk7XG4gICAgICBzZXR1cFVuaWZvcm0oZ2wsc2hhZGVyLCB1bmlmb3JtLGdsLmdldFVuaWZvcm1Mb2NhdGlvbihwcm9ncmFtLCB1bmlmb3JtLm5hbWUpKTtcbiAgICB9XG4gICAgdmFyIHRvdGFsQXR0cmlicyA9IGdsLmdldFByb2dyYW1QYXJhbWV0ZXIocHJvZ3JhbSxnbC5BQ1RJVkVfQVRUUklCVVRFUyk7XG4gICAgZm9yKHZhciBpPTA7aTx0b3RhbEF0dHJpYnM7KytpKSB7XG4gICAgICB2YXIgYXR0cmliID0gZ2wuZ2V0QWN0aXZlQXR0cmliKHByb2dyYW0sIGkpO1xuICAgICAgc2V0dXBBdHRyaWIoZ2wsc2hhZGVyLGF0dHJpYixpKTtcbiAgICB9XG4gICAgc2hhZGVyLmlzUmVhZHkgPSB0cnVlO1xuICAgIHJldHVybiBzaGFkZXI7XG4gIH1cblxuICBnbFNoYWRlci5sb2FkU2hhZGVyID0gZnVuY3Rpb24oZ2wsIHZlcnRleEZpbGUsIGZyYWdtZW50RmlsZSkge1xuICAgICAgdmFyIHNoYWRlclByb2dyYW0gPSBnbC5jcmVhdGVQcm9ncmFtKCk7XG4gICAgdmFyIHNoYWRlciA9IG5ldyBTaGFkZXIoZ2wsc2hhZGVyUHJvZ3JhbSk7XG4gICAgICB2YXIgZnJhZ1NoYWRlciwgdmVydFNoYWRlcjtcbiAgICAgIHZhciBsb2FkZWQgPSAwO1xuICAgICAgdmFyIHhtbGh0dHA7XG4gICAgICB4bWxodHRwID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgICBsb2FkWE1MRG9jKHZlcnRleEZpbGUsIGZ1bmN0aW9uKHR4dCkge3ZlcnRTaGFkZXIgPSBnZXRTaGFkZXIoZ2wsIHR4dCwgXCJ2ZXJ0ZXhcIik7aWYoKytsb2FkZWQgPT0gMikgc2V0dXBTaGFkZXJQcm9ncmFtKGdsLHNoYWRlclByb2dyYW0sIHZlcnRTaGFkZXIsZnJhZ1NoYWRlcixmdW5jdGlvbihwcm9nKSB7Z2xTaGFkZXIubWFrZVNoYWRlcihnbCxwcm9nLHNoYWRlcik7fSl9KTtcbiAgICAgIGxvYWRYTUxEb2MoZnJhZ21lbnRGaWxlLCBmdW5jdGlvbih0eHQpIHtmcmFnU2hhZGVyID0gZ2V0U2hhZGVyKGdsLCB0eHQsIFwiZnJhZ21lbnRcIik7aWYoKytsb2FkZWQgPT0gMikgc2V0dXBTaGFkZXJQcm9ncmFtKGdsLHNoYWRlclByb2dyYW0sIHZlcnRTaGFkZXIsZnJhZ1NoYWRlcixmdW5jdGlvbihwcm9nKSB7Z2xTaGFkZXIubWFrZVNoYWRlcihnbCxwcm9nLHNoYWRlcik7fSl9KTtcbiAgICAgIHJldHVybiBzaGFkZXI7XG4gIH1cblxuICAvL2lmKHR5cGVvZihleHBvcnRzKSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgLy8gICAgZXhwb3J0cy5nbFNoYWRlciA9IGdsU2hhZGVyO1xuICAvL31cblxuICB9KShzaGltLmV4cG9ydHMpO1xufSkodGhpcyk7XG4iLCJ2YXIgZ2xNYXRyaXggPSByZXF1aXJlKCcuLi9qcy9nbC1tYXRyaXgtbWluLmpzJyk7XG52YXIgdmVjMyA9IGdsTWF0cml4LnZlYzM7XG5cbnZhciBIRU1FU0hfTlVMTEZBQ0UgPSBudWxsO1xuXG52YXIgaGVtZXNoID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMudmVydGljZXMgPSBbXTtcbiAgdGhpcy5lZGdlcyA9IFtdO1xuICB0aGlzLmZhY2VzID0gW107XG59XG5cbnZhciBoZWRnZSA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLmZhY2UgPSBIRU1FU0hfTlVMTEZBQ0U7XG4gIHRoaXMubmV4dCA9IG51bGw7XG4gIHRoaXMucGFpciA9IG51bGw7XG4gIHRoaXMudiA9IG51bGw7XG4gIHRoaXMuaW5kZXggPSAwO1xuICB0aGlzLmluZm8gPSB7fTtcbn1cblxudmFyIGhlZmFjZSA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLmUgPSBudWxsO1xuICB0aGlzLmluZGV4ID0gMDtcbiAgdGhpcy5pbmZvID0ge307XG59XG5cbnZhciBoZXZlcnRleCA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLmUgPSBudWxsO1xuICB0aGlzLnBvcyA9IHZlYzMuY3JlYXRlKCk7XG4gIHRoaXMuaW5kZXggPSAwO1xuICB0aGlzLmIgPSAwO1xuICB0aGlzLnRhZ2dlZCA9IDA7XG4gIHRoaXMuaW5mbyA9IHt9O1xufVxuXG5oZW1lc2gucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24oKSB7XG4gIHZhciBlLHYsZjtcbiAgZm9yKHZhciBpPTAsbD10aGlzLmVkZ2VzLmxlbmd0aDtpPGw7KytpKSB7XG4gICAgZSA9IHRoaXMuZWRnZXNbaV07XG4gICAgZS5uZXh0ID0gbnVsbDtcbiAgICBlLnBhaXIgPSBudWxsO1xuICAgIGUudiA9IG51bGw7XG4gICAgZS5mYWNlID0gbnVsbDtcbiAgfVxuICBmb3IodmFyIGk9MCxsPXRoaXMuZmFjZXMubGVuZ3RoO2k8bDsrK2kpIHtcbiAgICBmID0gdGhpcy5mYWNlc1tpXTtcbiAgICBmLmUgPSBudWxsO1xuICAgIFxuICB9XG4gIGZvcih2YXIgaT0wLGw9dGhpcy52ZXJ0aWNlcy5sZW5ndGg7aTxsOysraSkge1xuICAgIHYgPSB0aGlzLnZlcnRpY2VzW2ldO1xuICAgIHYuZSA9IG51bGw7XG4gIH1cbiAgdGhpcy5mYWNlcy5sZW5ndGggPSAwO1xuICB0aGlzLmVkZ2VzLmxlbmd0aCA9IDA7XG4gIHRoaXMudmVydGljZXMubGVuZ3RoID0gMDtcbn1cblxuaGVtZXNoLnByb3RvdHlwZS5hZGRFZGdlID0gZnVuY3Rpb24oKSB7XG4gIHZhciBuZXdFZGdlID0gbmV3IGhlZGdlKCk7XG4gIG5ld0VkZ2UuaW5kZXggPSB0aGlzLmVkZ2VzLmxlbmd0aDtcbiAgdGhpcy5lZGdlcy5wdXNoKG5ld0VkZ2UpO1xuICByZXR1cm4gbmV3RWRnZTtcbn1cblxuaGVtZXNoLnByb3RvdHlwZS5hZGRWZXJ0ZXggPSBmdW5jdGlvbihwb3MpIHtcbiAgdmFyIG5ld1ZlcnRleCA9IG5ldyBoZXZlcnRleCgpO1xuICB2ZWMzLmNvcHkobmV3VmVydGV4LnBvcyxwb3MpO1xuICBuZXdWZXJ0ZXguaW5kZXggPSB0aGlzLnZlcnRpY2VzLmxlbmd0aDtcbiAgdGhpcy52ZXJ0aWNlcy5wdXNoKG5ld1ZlcnRleCk7XG4gIHJldHVybiBuZXdWZXJ0ZXg7XG59XG5cbmhlbWVzaC5wcm90b3R5cGUuYWRkRmFjZSA9IGZ1bmN0aW9uKCkge1xuICB2YXIgbmV3RmFjZSA9IG5ldyBoZWZhY2UoKTtcbiAgbmV3RmFjZS5pbmRleCA9IHRoaXMuZmFjZXMubGVuZ3RoO1xuICB0aGlzLmZhY2VzLnB1c2gobmV3RmFjZSk7XG4gIHJldHVybiBuZXdGYWNlO1xufVxuXG5oZW1lc2gucHJvdG90eXBlLnJlbW92ZUVkZ2UgPSBmdW5jdGlvbihlKSB7XG4gIGUubmV4dCA9IG51bGw7XG4gIGUucGFpciA9IG51bGw7XG4gIGUuZmFjZSA9IG51bGw7XG4gIGUudiA9IG51bGw7XG4gIGlmKGUuaW5kZXggPT0gdGhpcy5lZGdlcy5sZW5ndGgtMSkge1xuICAgIHRoaXMuZWRnZXMucG9wKCk7XG4gIH0gZWxzZSBpZihlLmluZGV4ID49IHRoaXMuZWRnZXMubGVuZ3RoKSB7XG4gICAgXG4gIH0gZWxzZSB7XG4gICAgdmFyIHRlbXAgPSB0aGlzLmVkZ2VzLnBvcCgpO1xuICAgIHRlbXAuaW5kZXggPSBlLmluZGV4O1xuICAgIHRoaXMuZWRnZXNbZS5pbmRleF0gPSB0ZW1wO1xuICB9XG59XG5cbmhlbWVzaC5wcm90b3R5cGUucmVtb3ZlRmFjZSA9IGZ1bmN0aW9uKGYpIHtcbiAgZi5lID0gbnVsbDtcbiAgaWYoZi5pbmRleCA9PSB0aGlzLmZhY2VzLmxlbmd0aC0xKSB7XG4gICAgdGhpcy5mYWNlcy5wb3AoKTtcbiAgfSBlbHNlIGlmIChmLmluZGV4ID49IHRoaXMuZmFjZXMubGVuZ3RoKSB7XG4gICAgXG4gIH1lbHNlIHtcbiAgICB2YXIgdGVtcCA9IHRoaXMuZmFjZXMucG9wKCk7XG4gICAgdGVtcC5pbmRleCA9IGYuaW5kZXg7XG4gICAgdGhpcy5mYWNlc1tmLmluZGV4XSA9IHRlbXA7XG4gIH1cbn1cblxuaGVtZXNoLnByb3RvdHlwZS5yZW1vdmVWZXJ0ZXggPSBmdW5jdGlvbih2KSB7XG4gIHYuZSA9IG51bGw7XG4gIGlmKHYuaW5kZXggPT0gdGhpcy52ZXJ0aWNlcy5sZW5ndGgtMSkge1xuICAgIHRoaXMudmVydGljZXMucG9wKCk7XG4gIH0gZWxzZSBpZih2LmluZGV4ID49IHRoaXMudmVydGljZXMubGVuZ3RoKSB7XG4gICAgXG4gIH0gZWxzZSB7XG4gICAgdmFyIHRlbXAgPSB0aGlzLnZlcnRpY2VzLnBvcCgpO1xuICAgIHRlbXAuaW5kZXggPSB2LmluZGV4O1xuICAgIHRoaXMudmVydGljZXNbdi5pbmRleF0gPSB0ZW1wO1xuICB9XG59XG5cbmhlbWVzaC5wcm90b3R5cGUuaXNCb3VuZGFyeSA9IGZ1bmN0aW9uKGUpIHtcbiAgcmV0dXJuIChlLmZhY2UgPT0gSEVNRVNIX05VTExGQUNFIHx8IGUucGFpci5mYWNlID09IEhFTUVTSF9OVUxMRkFDRSk7XG59XG5cbmhlbWVzaC5wcm90b3R5cGUuaXNDb2xsYXBzYWJsZSA9IGZ1bmN0aW9uKGUpIHtcbiAgLy9zaG91bGQgSSB0ZXN0IGlmIHRoZSBlZGdlcyx2ZXJ0aWNlcywgb3IgZmFjZXMgaGF2ZSBiZWVuIGRlbGV0ZWQgeWV0P1xuICB2YXIgZXBhaXIgPSBlLnBhaXI7XG4gIHZhciBwMSA9IGUudjtcbiAgdmFyIHAyID0gZXBhaXIudjtcbiAgXG4gIC8vZ2V0IG9wcG9zaXRlIHBvaW50cywgaWYgYm91bmRhcnkgZWRnZSBvcHBvc2l0ZSBpcyBudWxsXG4gIHZhciBvcHAxID0gZS5mYWNlID09IEhFTUVTSF9OVUxMRkFDRSA/IG51bGwgOiBlLm5leHQudjtcbiAgdmFyIG9wcDIgPSBlcGFpci5mYWNlID09IEhFTUVTSF9OVUxMRkFDRSA/IG51bGwgOiBlcGFpci5uZXh0LnY7XG4gIFxuICAvL2lmIGVuZCBwb2ludHMgYXJlIG9uIHRoZSBib3VuZGFyeSBidXQgdGhlIGVkZ2UgaXMgbm90XG4gIGlmKHAxLmIgJiYgcDIuYiAmJiBlLmZhY2UgIT0gSEVNRVNIX05VTExGQUNFICYmIGVwYWlyLmZhY2UgIT0gSEVNRVNIX05VTExGQUNFKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIFxuICBpZihvcHAxID09IG9wcDIpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgLy9taWdodCBuZWVkIGEgY2hlY2sgdG8gc2VlIGlmIG9wcG9zaXRlIGVkZ2VzIGFyZSBib3RoIGJvdW5kYXJ5IGJ1dCB0aGF0IHNlZW1zIGNvdmVyZWQgYnkgdGhlIHByZXZpb3VzIGNoZWNrXG4gIFxuICBcbiAgLy90ZXN0IHRvIHNlZSBpZiBlbmQgcG9pbnRzIHNoYXJlIGFueSBuZWlnaGJvcnMgYmVzaWRlIG9wcDEgYW5kIG9wcDJcbiAgLy9tYXJrIGFsbCBuZWlnaGJvcnMgb2YgcDEgYXMgMFxuICB2YXIgY3VyckUgPSBlO1xuICBkbyB7XG4gICAgY3VyckUgPSBjdXJyRS5uZXh0O1xuICAgIGN1cnJFLnYudGFnZ2VkID0gMDtcbiAgICBjdXJyRSA9IGN1cnJFLnBhaXI7XG4gIH0gd2hpbGUoY3VyckUgIT0gZSk7XG4gIC8vbWFyayBhbGwgbmVpZ2hib3JzIG9mIHAyIGFzIDFcbiAgY3VyckUgPSBlcGFpcjtcbiAgZG8ge1xuICAgIGN1cnJFID0gY3VyckUubmV4dDtcbiAgICBjdXJyRS52LnRhZ2dlZCA9IDE7XG4gICAgY3VyckUgPSBjdXJyRS5wYWlyO1xuICB9IHdoaWxlKGN1cnJFICE9IGVwYWlyKTtcbiAgLy91bnRhZyBvcHBvc2l0ZVxuICBpZihvcHAxICE9IG51bGwpIHtvcHAxLnRhZ2dlZCA9IDA7fVxuICBpZihvcHAyICE9IG51bGwpIHtvcHAyLnRhZ2dlZCA9IDA7fVxuICBcbiAgLy9jaGVjayBuZWlnaGJvcnMgb2YgcDEsIGlmIGFueSBhcmUgbWFya2VkIGFzIDEgcmV0dXJuIGZhbHNlXG4gIGN1cnJFID0gZTtcbiAgZG8ge1xuICAgIGN1cnJFID0gY3VyckUubmV4dDtcbiAgICBpZihjdXJyRS52LnRhZ2dlZCA9PSAxKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGN1cnJFID0gY3VyckUucGFpcjtcbiAgfSB3aGlsZShjdXJyRSAhPSBlKTtcbiAgIFxuICAvL3Rlc3QgZm9yIGEgZmFjZSBvbiB0aGUgYmFja3NpZGUvb3RoZXIgc2lkZSB0aGF0IG1pZ2h0IGRlZ2VuZXJhdGVcbiAgaWYoZS5mYWNlICE9IEhFTUVTSF9OVUxMRkFDRSkge1xuICAgIHZhciBlbmV4dCwgZW5leHQyO1xuICAgIGVuZXh0ID0gZS5uZXh0O1xuICAgIGVuZXh0MiA9IGVuZXh0Lm5leHQ7XG4gICAgXG4gICAgZW5leHQgPSBlbmV4dC5wYWlyO1xuICAgIGVuZXh0MiA9IGVuZXh0Mi5wYWlyO1xuICAgIGlmKGVuZXh0LmZhY2UgPT0gZW5leHQyLmZhY2UpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgaWYoZXBhaXIuZmFjZSAhPSBIRU1FU0hfTlVMTEZBQ0UpIHtcbiAgICB2YXIgZW5leHQsIGVuZXh0MjtcbiAgICBlbmV4dCA9IGVwYWlyLm5leHQ7XG4gICAgZW5leHQyID0gZW5leHQubmV4dDtcbiAgICBcbiAgICBlbmV4dCA9IGVuZXh0LnBhaXI7XG4gICAgZW5leHQyID0gZW5leHQyLnBhaXI7XG4gICAgaWYoZW5leHQuZmFjZSA9PSBlbmV4dDIuZmFjZSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICBcbiAgcmV0dXJuIHRydWU7XG4gIC8qXG4gIGlmICh2MHYxX3RyaWFuZ2xlKVxuICB7XG4gICAgSGFsZmVkZ2VIYW5kbGUgb25lLCB0d287XG4gICAgb25lID0gbmV4dF9oYWxmZWRnZV9oYW5kbGUodjB2MSk7XG4gICAgdHdvID0gbmV4dF9oYWxmZWRnZV9oYW5kbGUob25lKTtcbiAgICBcbiAgICBvbmUgPSBvcHBvc2l0ZV9oYWxmZWRnZV9oYW5kbGUob25lKTtcbiAgICB0d28gPSBvcHBvc2l0ZV9oYWxmZWRnZV9oYW5kbGUodHdvKTtcbiAgICBcbiAgICBpZiAoZmFjZV9oYW5kbGUob25lKSA9PSBmYWNlX2hhbmRsZSh0d28pICYmIHZhbGVuY2UoZmFjZV9oYW5kbGUob25lKSkgIT0gMylcbiAgICB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICBcbiAgKi9cbiAgXG59XG5cbmhlbWVzaC5wcm90b3R5cGUuZWRnZUNvbGxhcHNlID0gZnVuY3Rpb24oZSkge1xuICBpZighdGhpcy5pc0NvbGxhcHNhYmxlKGUpKSByZXR1cm47XG4gIFxuICB2YXIgZXBhaXIgPSBlLnBhaXI7XG4gIHZhciBlbmV4dCwgZW5leHQyLCBlbmV4dHAsIGVuZXh0cDI7XG4gIHZhciBwMSA9IGUudjtcbiAgdmFyIHAyID0gZXBhaXIudjtcbiAgcDIuZSA9IG51bGw7XG4gIC8vbmVlZCB0byBjaGVjayBmb3IgZWRnZSB2ZXJ0aWNlcyBlaXRoZXIgdGhyb3VnaCBtYXJraW5nIG9yIGNoZWNraW5nIGVkZ2VzXG4gIGlmKHAxLmIpIHtcbiAgICBpZighcDIuYikge1xuICAgIFxuICAgIH0gZWxzZSB7ICAgIFxuICAgICAgdmVjMy5hZGQocDEucG9zLHAxLnBvcyxwMi5wb3MpO1xuICAgICAgdmVjMy5zY2FsZShwMS5wb3MscDEucG9zLDAuNSk7XG4gICAgICBwMS5iID0gcDIuYjtcbiAgICB9XG4gIH0gZWxzZSBpZihwMi5iKSB7XG4gICAgdmVjMy5jb3B5KHAxLnBvcyxwMi5wb3MpO1xuICAgIHAxLmIgPSBwMi5iO1xuICB9IGVsc2Uge1xuICAgIHZlYzMuYWRkKHAxLnBvcyxwMS5wb3MscDIucG9zKTtcbiAgICB2ZWMzLnNjYWxlKHAxLnBvcyxwMS5wb3MsMC41KTtcbiAgfVxuICAvL3JlbW92ZSBwMlxuICB2YXIgc3RhcnRFID0gZXBhaXI7XG4gIC8vc2xpZ2h0IGluZWZmaWNpZW5jeSwgbm8gbmVlZCB0byByZXBvaW50IGVkZ2VzIHRoYXQgYXJlIGFib3V0IHRvIGJlIHJlbW92ZWRcbiAgZW5leHQgPSBlcGFpcjtcbiAgZG8ge1xuICAgIGVuZXh0LnYgPSBwMTtcbiAgICBlbmV4dCA9IGVuZXh0Lm5leHQucGFpcjtcbiAgfSB3aGlsZShlbmV4dCAhPSBzdGFydEUpO1xuXG4gIHRoaXMucmVtb3ZlVmVydGV4KHAyKTtcbiAgXG4gIHZhciBwcmV2RSwgcHJldkVQO1xuICBpZihlLmZhY2UgPT0gbnVsbCkge1xuICAgIHZhciBjdXJyRSA9IGVwYWlyO1xuICAgIHdoaWxlKGN1cnJFLm5leHQgIT0gZSkge1xuICAgICAgY3VyckUgPSBjdXJyRS5uZXh0LnBhaXI7XG4gICAgfVxuICAgIHByZXZFID0gY3VyckU7XG4gIH1cbiAgaWYoZXBhaXIuZmFjZSA9PSBudWxsKSB7XG4gICAgdmFyIGN1cnJFID0gZTtcbiAgICB3aGlsZShjdXJyRS5uZXh0ICE9IGVwYWlyKSB7XG4gICAgICBjdXJyRSA9IGN1cnJFLm5leHQucGFpcjtcbiAgICB9XG4gICAgcHJldkVQID0gY3VyckU7XG4gIH1cbiAgLy9yZW1vdmUgZmFjZVxuICBpZihlLmZhY2UgIT0gbnVsbCkge1xuICAgIGVuZXh0ID0gZS5uZXh0O1xuICAgIGVuZXh0MiA9IGVuZXh0Lm5leHQ7XG4gICAgXG4gICAgLy9yZW1vdmUgZW5leHQgYW5kIGVuZXh0MjtcbiAgICBlbmV4dHAgPSBlbmV4dC5wYWlyO1xuICAgIGVuZXh0cDIgPSBlbmV4dDIucGFpcjtcbiAgICBcbiAgICAvKlxuICAgIGlmKGVuZXh0cC5mYWNlID09IG51bGwgJiYgZW5leHRwMi5mYWNlID09IG51bGwpIHtcbiAgICAgIC8vcGluY2hlZCBvZmYsIHJlbW92ZSBlbmV4dHAgYW5kIGVuZXh0cDIsIGNvbm5lY3QgYWNyb3NzXG4gICAgICB2YXIgY3VyckUgPSBlbmV4dDI7XG4gICAgICB3aGlsZShjdXJyRS5uZXh0ICE9IGVuZXh0cDIpIHtcbiAgICAgICAgY3VyckUgPSBjdXJyRS5uZXh0LnBhaXI7XG4gICAgICB9XG4gICAgICBjdXJyRS5uZXh0ID0gZW5leHRwLm5leHQ7XG4gICAgICBwMS5lID0gY3VyckU7XG4gICAgICBcbiAgICAgIHRoaXMucmVtb3ZlVmVydGV4KGVuZXh0LnYpO1xuICAgICAgdGhpcy5yZW1vdmVFZGdlKGVuZXh0cCk7XG4gICAgICB0aGlzLnJlbW92ZUVkZ2UoZW5leHRwMik7XG4gICAgfSBlbHNlIHtcbiAgICAqL1xuICAgICAgZW5leHRwLnBhaXIgPSBlbmV4dHAyO1xuICAgICAgZW5leHRwMi5wYWlyID0gZW5leHRwOyAgICBcbiAgICAgIC8vcDEuZSA9IGVuZXh0cDtcbiAgICAgIGVuZXh0cC52LmUgPSBlbmV4dHA7XG4gICAgICBlbmV4dHAyLnYuZSA9IGVuZXh0cDI7ICAgXG4gICAgLy99XG4gICAgXG4gICAgdGhpcy5yZW1vdmVFZGdlKGVuZXh0KTtcbiAgICB0aGlzLnJlbW92ZUVkZ2UoZW5leHQyKTtcblxuIFxuICAgIFxuICAgIHRoaXMucmVtb3ZlRmFjZShlLmZhY2UpO1xuICB9IGVsc2Uge1xuICAgIFxuICAgIHByZXZFLm5leHQgPSBlLm5leHQ7XG4gICAgcDEuZSA9IHByZXZFO1xuICB9XG4gIFxuICBpZihlcGFpci5mYWNlICE9IG51bGwpIHtcbiAgICBlbmV4dCA9IGVwYWlyLm5leHQ7XG4gICAgZW5leHQyID0gZW5leHQubmV4dDtcbiAgICBcbiAgICAvL3JlbW92ZSBlbmV4dCBhbmQgZW5leHQyO1xuXG4gICAgZW5leHRwID0gZW5leHQucGFpcjtcbiAgICBlbmV4dHAyID0gZW5leHQyLnBhaXI7XG4gICAgLypcbiAgICBpZihlbmV4dHAuZmFjZSA9PSBudWxsICYmIGVuZXh0cDIuZmFjZSA9PSBudWxsKSB7XG4gICAgICAvL3BpbmNoZWQgb2ZmLCByZW1vdmUgZW5leHRwIGFuZCBlbmV4dHAyLCBjb25uZWN0IGFjcm9zc1xuICAgICAgLy9pbmVmZmljaWVudGx5IGdldCBwcmV2aW91cyBlZGdlXG4gICAgICB2YXIgY3VyckU7XG4gICAgICBmb3IodmFyIGk9MDtpPHRoaXMuZWRnZXMubGVuZ3RoOysraSkge1xuICAgICAgICBjdXJyRSA9IHRoaXMuZWRnZXNbaV07XG4gICAgICAgIGlmKGN1cnJFLm5leHQgPT0gZW5leHRwMikge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjdXJyRS5uZXh0ID0gZW5leHRwLm5leHQ7XG4gICAgICBwMS5lID0gY3VyckU7XG4gICAgICBcbiAgICAgIHRoaXMucmVtb3ZlVmVydGV4KGVuZXh0LnYpO1xuICAgICAgdGhpcy5yZW1vdmVFZGdlKGVuZXh0cCk7XG4gICAgICB0aGlzLnJlbW92ZUVkZ2UoZW5leHRwMik7XG4gICAgfSBlbHNlIHtcbiAgICAqL1xuICAgICAgZW5leHRwLnBhaXIgPSBlbmV4dHAyO1xuICAgICAgZW5leHRwMi5wYWlyID0gZW5leHRwOyAgICBcbiAgICAgIGVuZXh0cC52LmUgPSBlbmV4dHA7XG4gICAgICBlbmV4dHAyLnYuZSA9IGVuZXh0cDI7ICAgXG4gICAgLy99XG4gICAgdGhpcy5yZW1vdmVFZGdlKGVuZXh0KTtcbiAgICB0aGlzLnJlbW92ZUVkZ2UoZW5leHQyKTtcblxuICAgIHRoaXMucmVtb3ZlRmFjZShlcGFpci5mYWNlKTtcbiAgfSBlbHNlIHtcbiAgICBwcmV2RVAubmV4dCA9IGVwYWlyLm5leHQ7XG4gICAgcDEuZSA9IHByZXZFUDtcbiAgfVxuICBcbiAgLy9yZW1vdmUgZSBhbmQgZXBhaXJcbiAgdGhpcy5yZW1vdmVFZGdlKGUpO1xuICB0aGlzLnJlbW92ZUVkZ2UoZXBhaXIpO1xuXG4gIHJldHVybiBwMTtcbn1cblxuaGVtZXNoLnByb3RvdHlwZS5lZGdlU3BsaXQgPSAoZnVuY3Rpb24oKSB7IFxuICB2YXIgcG9zID0gdmVjMy5jcmVhdGUoKTtcbiAgLy9hc3N1bWVzIGUuZmFjZSAhPSBudWxsIGJ1dCBlcGFpci5mYWNlIGNhbiA9PSBudWxsXG4gIHJldHVybiBmdW5jdGlvbihlKSB7XG4gICAgLy9uZWVkIHRvIGNoZWNrIGZvciBib3VuZGFyeSBlZGdlXG4gICAgLy9ub3QgZG9uZVxuICAgIFxuICAgIC8vbmV3IHB0XG4gICAgdmFyIGVwYWlyID0gZS5wYWlyO1xuICAgIHZhciBwMSA9IGUudjsgICAgXG4gICAgdmFyIHAyID0gZXBhaXIudjtcbiAgICB2YXIgZW5leHQgPSBlLm5leHQ7XG4gICAgdmFyIGVwbmV4dCA9IGVwYWlyLm5leHQ7XG4gICAgXG4gICAgdmVjMy5hZGQocG9zLHAxLnBvcyxwMi5wb3MpO1xuICAgIHZlYzMuc2NhbGUocG9zLHBvcywwLjUpO1xuICAgIHZhciBuZXdWZXJ0ZXggPSB0aGlzLmFkZFZlcnRleChwb3MpO1xuICAgIFxuICAgIHZhciBuZXdFZGdlLCBuZXdFZGdlUGFpciwgbmV3RmFjZSwgc3BsaXRFZGdlMSwgc3BsaXRFZGdlMjtcbiAgICBcbiAgICAvL2RvIGUgZmlyc3RcbiAgICBuZXdFZGdlID0gdGhpcy5hZGRFZGdlKCk7XG4gICAgbmV3RWRnZS52ID0gcDE7XG4gICAgcDEuZSA9IG5ld0VkZ2U7XG4gICAgZS52ID0gbmV3VmVydGV4O1xuICAgIG5ld0VkZ2UubmV4dCA9IGVuZXh0O1xuICAgIG5ld0VkZ2UucGFpciA9IGVwYWlyO1xuICAgIGVwYWlyLnBhaXIgPSBuZXdFZGdlO1xuICAgIFxuICAgIG5ld0VkZ2VQYWlyID0gdGhpcy5hZGRFZGdlKCk7XG4gICAgbmV3RWRnZVBhaXIudiA9IHAyO1xuICAgIG5ld0VkZ2VQYWlyLmUgPSBwMjtcbiAgICBlcGFpci52ID0gbmV3VmVydGV4O1xuICAgIG5ld0VkZ2VQYWlyLm5leHQgPSBlcG5leHQ7XG4gICAgbmV3RWRnZVBhaXIucGFpciA9IGU7XG4gICAgZS5wYWlyID0gbmV3RWRnZVBhaXI7XG4gICAgbmV3VmVydGV4LmUgPSBlO1xuICAgIFxuICAgIC8vc2V0IGIgdG8gbmVpZ2hib3JpbmcgYiwgaXQgcDEuYiBzaG91bGQgZXF1YWwgcDIuYlxuICAgIGlmKGUuZmFjZSA9PSBudWxsIHx8IGVwYWlyLmZhY2UgPT0gbnVsbCkgeyBuZXdWZXJ0ZXguYiA9IHAxLmI7fVxuICAgIFxuICAgIGlmKGUuZmFjZSAhPSBudWxsKSB7XG4gICAgICAvL2ZhY2UgMVxuICAgICAgbmV3RmFjZSA9IHRoaXMuYWRkRmFjZSgpO1xuICAgICAgc3BsaXRFZGdlMSA9IHRoaXMuYWRkRWRnZSgpO1xuICAgICAgc3BsaXRFZGdlMiA9IHRoaXMuYWRkRWRnZSgpO1xuICAgICAgc3BsaXRFZGdlMS5wYWlyID0gc3BsaXRFZGdlMjtcbiAgICAgIHNwbGl0RWRnZTIucGFpciA9IHNwbGl0RWRnZTE7XG4gICAgICBzcGxpdEVkZ2UxLnYgPSBlbmV4dC52O1xuICAgICAgc3BsaXRFZGdlMi52ID0gbmV3VmVydGV4O1xuICAgICAgXG4gICAgICAvL2UuZlxuICAgICAgZS5uZXh0ID0gc3BsaXRFZGdlMTtcbiAgICAgIHNwbGl0RWRnZTEubmV4dCA9IGVuZXh0Lm5leHQ7XG4gICAgICBlLmZhY2UuZSA9IGU7XG4gICAgICBzcGxpdEVkZ2UxLmZhY2UgPSBlLmZhY2U7XG4gICAgICAvL25ld0ZhY2VcbiAgICAgIG5ld0VkZ2UuZmFjZSA9IG5ld0ZhY2U7XG4gICAgICBzcGxpdEVkZ2UyLmZhY2UgPSBuZXdGYWNlO1xuICAgICAgZW5leHQuZmFjZSA9IG5ld0ZhY2U7XG4gICAgICBuZXdGYWNlLmUgPSBuZXdFZGdlO1xuICAgICAgZW5leHQubmV4dCA9IHNwbGl0RWRnZTI7XG4gICAgICBzcGxpdEVkZ2UyLm5leHQgPSBuZXdFZGdlO1xuICAgIH0gZWxzZSB7XG4gICAgICBlLm5leHQgPSBuZXdFZGdlO1xuICAgIH1cbiAgICBcbiAgICBpZihlcGFpci5mYWNlICE9IG51bGwpIHtcbiAgICAgIG5ld0ZhY2UgPSB0aGlzLmFkZEZhY2UoKTtcbiAgICAgIHNwbGl0RWRnZTEgPSB0aGlzLmFkZEVkZ2UoKTtcbiAgICAgIHNwbGl0RWRnZTIgPSB0aGlzLmFkZEVkZ2UoKTtcbiAgICAgIHNwbGl0RWRnZTEucGFpciA9IHNwbGl0RWRnZTI7XG4gICAgICBzcGxpdEVkZ2UyLnBhaXIgPSBzcGxpdEVkZ2UxO1xuICAgICAgc3BsaXRFZGdlMS52ID0gZXBuZXh0LnY7XG4gICAgICBzcGxpdEVkZ2UyLnYgPSBuZXdWZXJ0ZXg7XG4gICAgICBcbiAgICAgIC8vZXBhaXIuZlxuICAgICAgZXBhaXIubmV4dCA9IHNwbGl0RWRnZTE7XG4gICAgICBzcGxpdEVkZ2UxLm5leHQgPSBlcG5leHQubmV4dDtcbiAgICAgIGVwYWlyLmZhY2UuZSA9IGVwYWlyO1xuICAgICAgc3BsaXRFZGdlMS5mYWNlID0gZXBhaXIuZmFjZTtcbiAgICAgIFxuICAgICAgLy9uZXdGYWNlXG4gICAgICBuZXdFZGdlUGFpci5mYWNlID0gbmV3RmFjZTtcbiAgICAgIHNwbGl0RWRnZTIuZmFjZSA9IG5ld0ZhY2U7XG4gICAgICBlcG5leHQuZmFjZSA9IG5ld0ZhY2U7XG4gICAgICBuZXdGYWNlLmUgPSBuZXdFZGdlUGFpcjtcbiAgICAgIGVwbmV4dC5uZXh0ID0gc3BsaXRFZGdlMjtcbiAgICAgIHNwbGl0RWRnZTIubmV4dCA9IG5ld0VkZ2VQYWlyO1xuICAgIH0gZWxzZSB7XG4gICAgICBlcGFpci5uZXh0ID0gbmV3RWRnZVBhaXI7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBuZXdWZXJ0ZXg7XG4gIH1cbn0pKCk7XG5cbmhlbWVzaC5wcm90b3R5cGUuc3BsaXRMYXJnZXN0ID0gZnVuY3Rpb24oZSkge1xuICB2YXIgbGFyZ2VzdEVkZ2UgPSB0aGlzLmxvbmdlc3RFZGdlKGUpO1xuICB3aGlsZShsYXJnZXN0RWRnZSAhPSBlKSB7XG4gICAgdGhpcy5zcGxpdExhcmdlc3QobGFyZ2VzdEVkZ2UpO1xuICAgIGxhcmdlc3RFZGdlID0gdGhpcy5sb25nZXN0RWRnZShlKTtcbiAgfVxuICB2YXIgcGFpciA9IGUucGFpcjtcbiAgXG4gIGxhcmdlc3RFZGdlID0gdGhpcy5sb25nZXN0RWRnZShwYWlyKTtcbiAgd2hpbGUobGFyZ2VzdEVkZ2UgIT0gcGFpcikge1xuICAgIHRoaXMuc3BsaXRMYXJnZXN0KGxhcmdlc3RFZGdlKTtcbiAgICBsYXJnZXN0RWRnZSA9IHRoaXMubG9uZ2VzdEVkZ2UocGFpcik7XG4gIH1cbiAgdGhpcy5lZGdlU3BsaXQoZSk7XG59XG5cbmhlbWVzaC5wcm90b3R5cGUubG9uZ2VzdEVkZ2UgPSBmdW5jdGlvbihlKSB7XG4gIGlmKGUuZmFjZSA9PSBudWxsKSB7XG4gICAgcmV0dXJuIGU7XG4gIH0gZWxzZSB7XG4gICAgdmFyIGxvbmdlc3RMZW4gPSB0aGlzLnNxckxlbihlKTtcbiAgICB2YXIgbG9uZ0VkZ2UgPSBlO1xuICAgIHZhciBzdGFydEUgPSBlO1xuICAgIGUgPSBlLm5leHQ7XG4gICAgZG8geyAgICAgIFxuICAgICAgdmFyIGxlbiA9IHRoaXMuc3FyTGVuKGUpO1xuICAgICAgaWYobGVuID4gbG9uZ2VzdExlbikge1xuICAgICAgICBsb25nZXN0TGVuID0gbGVuO1xuICAgICAgICBsb25nRWRnZSA9IGU7XG4gICAgICB9XG4gICAgICBlID0gZS5uZXh0O1xuICAgIH0gd2hpbGUoZSAhPSBzdGFydEUpO1xuICAgIHJldHVybiBsb25nRWRnZTtcbiAgfVxufVxuXG5oZW1lc2gucHJvdG90eXBlLnNxckxlbiA9IGZ1bmN0aW9uKGUpIHtcbiAgcmV0dXJuIHZlYzMuc3FyRGlzdChlLnYucG9zLGUucGFpci52LnBvcyk7XG59XG5cbmhlbWVzaC5wcm90b3R5cGUuZWRnZUZsaXAgPSBmdW5jdGlvbihlKSB7XG4gIHZhciBlcGFpciA9IGUucGFpcjtcbiAgXG4gIGlmKGVwYWlyLmZhY2UgIT0gbnVsbCAmJiBlLmZhY2UgIT0gbnVsbCkge1xuICAgIHZhciBlbmV4dCA9IGUubmV4dDtcbiAgICB2YXIgZW5leHQyID0gZW5leHQubmV4dDtcbiAgICB2YXIgZXBuZXh0ID0gZXBhaXIubmV4dDtcbiAgICB2YXIgZXBuZXh0MiA9IGVwbmV4dC5uZXh0O1xuICAgIHZhciBwMSA9IGUudjtcbiAgICB2YXIgcDIgPSBlcGFpci52O1xuICAgIGUudiA9IGVuZXh0LnY7XG4gICAgZW5leHQuZmFjZSA9IGVwYWlyLmZhY2U7XG4gICAgZXBhaXIudiA9IGVwbmV4dC52O1xuICAgIGVwbmV4dC5mYWNlID0gZS5mYWNlO1xuICAgIC8vbmV3IGZhY2VzXG4gICAgZS5uZXh0ID0gZW5leHQyO1xuICAgIGVuZXh0Mi5uZXh0ID0gZXBuZXh0O1xuICAgIGVwbmV4dC5uZXh0ID0gZTtcbiAgICBcbiAgICBlcGFpci5uZXh0ID0gZXBuZXh0MjtcbiAgICBlcG5leHQyLm5leHQgPSBlbmV4dDtcbiAgICBlbmV4dC5uZXh0ID0gZXBhaXI7XG4gICAgXG4gICAgLy9qdXN0IGluIGNhc2UgZmFjZSBwb2ludHMgdG8gZS5uZXh0LCBub3QgdGhhdCBpdCBzdHJpY3RseSBtYXR0ZXJzXG4gICAgZS5mYWNlLmUgPSBlO1xuICAgIGVwYWlyLmZhY2UuZSA9IGVwYWlyO1xuICAgIFxuICAgIC8vZGVhbCB3aXRoIHZlcnRleCBwb2ludGVyc1xuICAgIHAyLmUgPSBlLm5leHQ7XG4gICAgcDEuZSA9IGVwYWlyLm5leHQ7XG4gIH1cbn1cblxuaGVtZXNoLnByb3RvdHlwZS5nZXRWYWxlbmNlID0gZnVuY3Rpb24ocCkge1xuICB2YXIgZSA9IHAuZTtcbiAgdmFyIGNvdW50ID0gMDtcbiAgZG8ge1xuICAgIGNvdW50Kys7XG4gICAgZSA9IGUubmV4dC5wYWlyO1xuICB9IHdoaWxlKGUgIT0gcC5lKTtcbiAgcmV0dXJuIGNvdW50O1xufVxuXG5oZW1lc2gucHJvdG90eXBlLmdldFZhbGVuY2VFID0gZnVuY3Rpb24oZSkge1xuICB2YXIgc3RhcnRFID0gZTtcbiAgdmFyIGNvdW50ID0gMDtcbiAgZG8ge1xuICAgIGNvdW50Kys7XG4gICAgZSA9IGUubmV4dC5wYWlyO1xuICB9IHdoaWxlKGUgIT0gc3RhcnRFKTtcbiAgcmV0dXJuIGNvdW50O1xufVxuXG5leHBvcnRzLk5VTExGQUNFID0gSEVNRVNIX05VTExGQUNFO1xuZXhwb3J0cy5oZW1lc2ggPSBoZW1lc2g7XG5leHBvcnRzLmhlZGdlID0gaGVkZ2U7XG5leHBvcnRzLmhlZmFjZSA9IGhlZmFjZTtcbmV4cG9ydHMuaGV2ZXJ0ZXggPSBoZXZlcnRleDtcbiIsInZhciBwbW91c2VYLHBtb3VzZVksbW91c2VYLG1vdXNlWSxzdGFydE1vdXNlWCxzdGFydE1vdXNlWSwgbW91c2VCdXR0b247XG52YXIgc3RhcnRNb3VzZVRpbWU7XG5leHBvcnRzLmlzTW91c2VEb3duID0gZmFsc2U7XG5leHBvcnRzLm1vdXNlRHJhZ2dpbmcgPSBmYWxzZTtcblxuZnVuY3Rpb24gc2V0dXBNb3VzZUV2ZW50cyhjYW52YXMpIHtcbiAgICBjYW52YXMuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgb25Nb3VzZU1vdmUpO1xuICAgIGNhbnZhcy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCBvbk1vdXNlRG93bik7XG4gICAgY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBvbk1vdXNlVXApO1xuICAgIGNhbnZhcy5hZGRFdmVudExpc3RlbmVyKCdjb250ZXh0bWVudScsIGZ1bmN0aW9uKGV2ZW50KXtldmVudC5wcmV2ZW50RGVmYXVsdCgpO30pO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBvbk1vdXNlVXBEb2MpO1xuICAgIFxuICAgIHNldHVwVG91Y2hFdmVudHMoY2FudmFzKTtcbn1cblxuZXhwb3J0cy5zZXR1cE1vdXNlRXZlbnRzID0gc2V0dXBNb3VzZUV2ZW50cztcblxuZnVuY3Rpb24gc2V0dXBUb3VjaEV2ZW50cyhjYW52YXMpIHtcbiAgICBpZihpc1RvdWNoRGV2aWNlKCkpIHtcbiAgICAgICAgY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIG9uVG91Y2hNb3ZlKTtcbiAgICAgICAgY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCBvblRvdWNoU3RhcnQpO1xuICAgICAgICBjYW52YXMuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hlbmQnLCBvblRvdWNoRW5kKTtcbiAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hlbmQnLCBvbk1vdXNlVXBEb2MpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gaXNUb3VjaERldmljZSgpIHtcbiAgcmV0dXJuICdvbnRvdWNoc3RhcnQnIGluIHdpbmRvdyAvLyB3b3JrcyBvbiBtb3N0IGJyb3dzZXJzIFxuICAgICAgfHwgJ29ubXNnZXN0dXJlY2hhbmdlJyBpbiB3aW5kb3c7IC8vIHdvcmtzIG9uIGllMTBcbn07XG5cbmZ1bmN0aW9uIG9uTW91c2VEb3duKGV2ZW50KSB7XG4gICAgLy8gQ2FuY2VsIHRoZSBkZWZhdWx0IGV2ZW50IGhhbmRsZXJcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgZXhwb3J0cy5tb3VzZURyYWdnaW5nID0gZmFsc2U7XG4gICAgdmFyIHJlY3QgPSBldmVudC50YXJnZXQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cbiAgICB2YXIgY3VycmVudFggPSBldmVudC5jbGllbnRYLXJlY3QubGVmdDtcbiAgICB2YXIgY3VycmVudFkgPSBldmVudC5jbGllbnRZLXJlY3QudG9wO1xuICAgIFxuICAgIGV4cG9ydHMucG1vdXNlWCA9IGV4cG9ydHMubW91c2VYID0gZXhwb3J0cy5zdGFydE1vdXNlWCA9IGN1cnJlbnRYO1xuICAgIGV4cG9ydHMucG1vdXNlWSA9IGV4cG9ydHMubW91c2VZID0gZXhwb3J0cy5zdGFydE1vdXNlWSA9IGN1cnJlbnRZO1xuXG4gICAgZXhwb3J0cy5pc01vdXNlRG93biA9IHRydWU7XG4gICAgZXhwb3J0cy5tb3VzZUJ1dHRvbiA9IGV2ZW50LndoaWNoO1xuICAgIGV4cG9ydHMuc3RhcnRNb3VzZVRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICBpZih0eXBlb2YgZXhwb3J0cy5tb3VzZURvd24gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIGV4cG9ydHMubW91c2VEb3duKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBvbk1vdXNlTW92ZShldmVudCkge1xuICAgIC8vIENhbmNlbCB0aGUgZGVmYXVsdCBldmVudCBoYW5kbGVyXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICBcbiAgICB2YXIgcmVjdCA9IGV2ZW50LnRhcmdldC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblxuICAgIHZhciBjdXJyZW50WCA9IGV2ZW50LmNsaWVudFgtcmVjdC5sZWZ0O1xuICAgIHZhciBjdXJyZW50WSA9IGV2ZW50LmNsaWVudFktcmVjdC50b3A7XG4gICAgXG4gICAgZXhwb3J0cy5wbW91c2VYID0gZXhwb3J0cy5tb3VzZVg7XG4gICAgZXhwb3J0cy5wbW91c2VZID0gZXhwb3J0cy5tb3VzZVk7XG4gICAgXG4gICAgZXhwb3J0cy5tb3VzZVggPSBjdXJyZW50WDtcbiAgICBleHBvcnRzLm1vdXNlWSA9IGN1cnJlbnRZO1xuICAgIGlmKGV4cG9ydHMubW91c2VYICE9IGV4cG9ydHMucG1vdXNlWCB8fCBleHBvcnRzLm1vdXNlWSAhPSBleHBvcnRzLnBtb3VzZVkpIHtcbiAgICAgICAgaWYodHlwZW9mIGV4cG9ydHMubW91c2VNb3ZlZCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGV4cG9ydHMubW91c2VNb3ZlZChldmVudCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYoZXhwb3J0cy5pc01vdXNlRG93bikge1xuICAgICAgICAgICAgZXhwb3J0cy5tb3VzZURyYWdnaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgIGlmKHR5cGVvZiBleHBvcnRzLm1vdXNlRHJhZ2dlZCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICBleHBvcnRzLm1vdXNlRHJhZ2dlZChldmVudCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIG9uTW91c2VVcChldmVudCkge1xuICAgIC8vIENhbmNlbCB0aGUgZGVmYXVsdCBldmVudCBoYW5kbGVyXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICBleHBvcnRzLmlzTW91c2VEb3duID0gZmFsc2U7XG4gICAgaWYodHlwZW9mIGV4cG9ydHMubW91c2VVcCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgZXhwb3J0cy5tb3VzZVVwKGV2ZW50KTtcbiAgICB9XG4gICAgaWYoIWV4cG9ydHMubW91c2VEcmFnZ2luZyAmJiAodHlwZW9mIGV4cG9ydHMubW91c2VDbGlja2VkICE9PSAndW5kZWZpbmVkJykpIHtcbiAgICAgICAgZXhwb3J0cy5tb3VzZUNsaWNrZWQoZXZlbnQpO1xuICAgIH1cbiAgICBleHBvcnRzLm1vdXNlRHJhZ2dpbmcgPSBmYWxzZTtcbn1cblxuZnVuY3Rpb24gb25Nb3VzZVVwRG9jKGV2ZW50KSB7XG4gICAgZXhwb3J0cy5pc01vdXNlRG93biA9IGZhbHNlO1xufVxuXG5mdW5jdGlvbiBvblRvdWNoU3RhcnQoZXZlbnQpIHtcbiAgICAvLyBDYW5jZWwgdGhlIGRlZmF1bHQgZXZlbnQgaGFuZGxlclxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICBtb3VzZURyYWdnaW5nID0gZmFsc2U7XG4gICAgdmFyIHJlY3QgPSBldmVudC50YXJnZXRUb3VjaGVzWzBdLnRhcmdldC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblxuICAgIHZhciBjdXJyZW50WCA9IGV2ZW50LnRhcmdldFRvdWNoZXNbMF0uY2xpZW50WC1yZWN0LmxlZnQ7XG4gICAgdmFyIGN1cnJlbnRZID0gZXZlbnQudGFyZ2V0VG91Y2hlc1swXS5jbGllbnRZLXJlY3QudG9wO1xuICAgIFxuICAgIHBtb3VzZVggPSBtb3VzZVggPSBzdGFydE1vdXNlWCA9IGN1cnJlbnRYO1xuICAgIHBtb3VzZVkgPSBtb3VzZVkgPSBzdGFydE1vdXNlWSA9IGN1cnJlbnRZO1xuICAgIGNvbnNvbGUubG9nKFwidG91Y2ggc3RhcnRcIik7XG4gICAgaXNNb3VzZURvd24gPSB0cnVlO1xuICAgIC8vbW91c2VCdXR0b24gPSBldmVudC5idXR0b247XG4gICAgbW91c2VCdXR0b24gPSAwO1xuICAgIHN0YXJ0TW91c2VUaW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgaWYodHlwZW9mIG1vdXNlRG93biAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgbW91c2VEb3duKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBvblRvdWNoTW92ZShldmVudCkge1xuICAgIC8vIENhbmNlbCB0aGUgZGVmYXVsdCBldmVudCBoYW5kbGVyXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICBcbiAgICB2YXIgcmVjdCA9IGV2ZW50LnRhcmdldFRvdWNoZXNbMF0udGFyZ2V0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXG4gICAgdmFyIGN1cnJlbnRYID0gZXZlbnQudGFyZ2V0VG91Y2hlc1swXS5jbGllbnRYLXJlY3QubGVmdDtcbiAgICB2YXIgY3VycmVudFkgPSBldmVudC50YXJnZXRUb3VjaGVzWzBdLmNsaWVudFktcmVjdC50b3A7XG4gICAgXG4gICAgcG1vdXNlWCA9IG1vdXNlWDtcbiAgICBwbW91c2VZID0gbW91c2VZO1xuICAgIFxuICAgIG1vdXNlWCA9IGN1cnJlbnRYO1xuICAgIG1vdXNlWSA9IGN1cnJlbnRZO1xuICAgIGlmKHR5cGVvZiBtb3VzZU1vdmVkICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBtb3VzZU1vdmVkKCk7XG4gICAgfVxuICAgIGlmKGlzTW91c2VEb3duKSB7XG4gICAgICAgIG1vdXNlRHJhZ2dpbmcgPSB0cnVlO1xuICAgICAgICBpZih0eXBlb2YgbW91c2VEcmFnZ2VkICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgbW91c2VEcmFnZ2VkKCk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIG9uVG91Y2hFbmQoZXZlbnQpIHtcbiAgICAvLyBDYW5jZWwgdGhlIGRlZmF1bHQgZXZlbnQgaGFuZGxlclxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgaXNNb3VzZURvd24gPSBmYWxzZTtcbiAgICBpZih0eXBlb2YgbW91c2VVcCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgbW91c2VVcCgpO1xuICAgIH1cbiAgICBpZighbW91c2VEcmFnZ2luZyAmJiAodHlwZW9mIG1vdXNlQ2xpY2tlZCAhPT0gJ3VuZGVmaW5lZCcpKSB7XG4gICAgICAgIG1vdXNlQ2xpY2tlZCgpO1xuICAgIH1cbiAgICBtb3VzZURyYWdnaW5nID0gZmFsc2U7XG59XG4iXX0=
