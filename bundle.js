(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var glMatrix = require("../js/gl-matrix-min.js");
var vec3 = glMatrix.vec3;
var vec2 = glMatrix.vec2;
var nurbs = require("./nurbs.js");
var vboMesh = require("./vboMesh.js");
var woodWidth = 12.2;
var conLen = 45;
var conOffset = 12;
var conWidth = 20;
var shelfOffset = 15;
var printTolerance = 0;

function initConnector() {

}

var createConnector = (function() {
  var dir1 = vec3.create();
  var dir2 = vec3.create();
  var dir3 = vec3.create();
  var pt = vec3.create();
  var pt2 = vec3.create();
  var dirs = [dir1,dir2,dir3];
  var dir, nDir;
  var perp = vec3.create();
  var bisector = vec3.create();
  return function createConnector(tri,vboOut) {
    var center = tri.circumcenter;
    var p1 = tri.neighbors_[0].circumcenter;
    var p2 = tri.neighbors_[1].circumcenter;
    var p3 = tri.neighbors_[2].circumcenter;
    vec3.sub(dir1,p1,center);
    vec3.sub(dir2,p2,center);
    vec3.sub(dir3,p3,center);
    
    vec3.normalize(dir1,dir1);
    vec3.normalize(dir2,dir2);
    vec3.normalize(dir3,dir3);

    var baseIndex = vboOut.numVertices;
    var numPts = 0;
    
    for(var i=0;i<3;++i) {
      //make points
      dir = dirs[i];
      nDir = dirs[(1<<i)&3];
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
      vec3.add(bisector, dir,nDir);
      vec3.normalize(bisector,bisector);
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
var vec3 = glMatrix.vec3;
var mat4 = glMatrix.mat4;
var mat3 = glMatrix.mat4;

var canvas;
var gl;
var colorShader;
var voronoiEdges;
var mvMatrix = mat4.create();
var pMatrix = mat4.create();
var nMatrix = mat3.create();
var connectorVbo;

function init() {
//stupid
	document.addEventListener( "keydown",keyPress,false);

  canvas = document.getElementById("gl");
  gl = glUtils.init(canvas);
  colorShader = glShader.loadShader(gl,"../shaders/simpleColor.vert","../shaders/simpleColor.frag");
  vboMesh.setGL(gl);
  initVoronoi();
  
  voronoiEdges = vboMesh.create();
  connectorVbo = vboMesh.create32();
  requestAnimationFrame(step);
}

function step() {
  requestAnimationFrame(step);
  vboMesh.clear(connectorVbo);
  getConnectors();
  draw();
}

function draw() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  if(!colorShader.isReady) return;
  
  colorShader.begin();
  mat4.identity(mvMatrix);
  mat4.ortho(pMatrix,-100,1000,1000,-100,-10,100);
  
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
  for(var i=0;i<voronoi.triangles.length;++i) {
    var tri = voronoi.triangles[i];
    if(tri.interior_) {
      if(tri.neighbors_[0] && tri.neighbors_[0].interior_ &&
        tri.neighbors_[1] && tri.neighbors_[1].interior_ &&
        tri.neighbors_[2] && tri.neighbors_[2].interior_) {
        connector.createConnector(tri,connectorVbo);
      }
    }
  }
  vboMesh.buffer(connectorVbo);
}

function initVoronoi() {
  voronoi.init();
  voronoi.reset();
  voronoi.voronoi();
}

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

init();

function keyPress(event) {
  switch(event.which) {
    case "D".charCodeAt(0):
      downloadVboAsSTL(connectorVbo);
      break;
  }
}

},{"../js/gl-matrix-min.js":8,"../js/glShader.js":9,"./connector.js":1,"./glUtils.js":2,"./poly2tri.js":5,"./vboMesh.js":6,"./voronoi.js":7}],4:[function(require,module,exports){
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
	
nurbs.evaluateCrv = function(crv,u,pt) {
	var currKnot = nurbs.findKnot(crv.knots,u,crv.degree);
	
	nurbs.basisFunctions(crv.knots,crv.degree,currKnot, u,nurbs.basisFuncs);
	var evalPt = vec4.create();
	for(var i = 0;i<=crv.degree;++i) {
	  vec4.scaleAndAdd(evalPt, evalPt,crv.controlPts[currKnot-crv.degree+i], nurbs.basisFuncs[i]);
	}
	return vec4.projectDown(evalPt,pt);
}
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
	 
nurbs.basisFunctions = function(knots,degree,knot,u,funcs) {
	var left = new Float32Array(degree+1);
	var right = new Float32Array(degree+1);

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
var glMatrix = require('../js/gl-matrix-min.js');
var poly2tri = require('./poly2tri.js');
var vec3 = glMatrix.vec3;
var vec2 = glMatrix.vec2;

var SweepContext = poly2tri.SweepContext;
var pts = [];

var outsidePts = [];
var triangles = [];

var width = 1200;
var height = 1200;
function reset() {
  //make regularly spaced points
  pts.length = 0;
  
  for(var i=0;i<4;++i) {
    for(var j=0;j<4;++j) {
      pts.push({x:i*250+j%2*125,y:j*250});
    }
  }
}

function init() {
  outsidePts.length = 0;
  outsidePts.push({x:-10,y:-10,fixed:true});
  outsidePts.push({x:width+10,y:-10,fixed:true});
  outsidePts.push({x:width+10,y:height+10,fixed:true});
  outsidePts.push({x:-10,y:height+10,fixed:true});
}

var voronoi = (function() {
  var p1 = vec2.create();
  var p2 = vec2.create();
  var p3 = vec2.create();
  return function voronoi() {
    var triangulation = new SweepContext(outsidePts);
    triangulation.addPoints(pts);
    triangulation.triangulate();
    
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
    
  }
})();

var circumcircle = (function() {
  var v1 = vec2.create();
  var v2 = vec2.create();
  var cross;
  return function circumcircle(out, p1,p2,p3) {
    vec2.sub(v1,p1,p3);
    vec2.sub(v2,p2,p3);
    cross = v1[0]*v2[1]-v1[1]*v2[0];
    var v1Len = vec2.sqrLen(v1);
    var v2Len = vec2.sqrLen(v2);
    var crossLen = cross*cross;
    vec2.scale(v2,v2,v1Len);
    vec2.scale(v1,v1,v2Len);
    vec2.sub(v2,v2,v1);
    out[0] = v2[1]*cross;
    out[1] = -v2[0]*cross;
    vec2.scale(out,out,1.0/(2.0*crossLen));
    vec2.add(out,out,p3);
    return out;
  }
})();

exports.init = init;
exports.reset = reset;
exports.voronoi = voronoi;
exports.pts = pts;
exports.triangles = triangles;
},{"../js/gl-matrix-min.js":8,"./poly2tri.js":5}],8:[function(require,module,exports){
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

},{}]},{},[3])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyJjOlxcVXNlcnNcXEplc3NlXFxBcHBEYXRhXFxSb2FtaW5nXFxucG1cXG5vZGVfbW9kdWxlc1xcd2F0Y2hpZnlcXG5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwiYzovVXNlcnMvSmVzc2UvRG9jdW1lbnRzL2h0ZG9jcy9ib29rc2hlbGYvY29ubmVjdG9yLmpzIiwiYzovVXNlcnMvSmVzc2UvRG9jdW1lbnRzL2h0ZG9jcy9ib29rc2hlbGYvZ2xVdGlscy5qcyIsImM6L1VzZXJzL0plc3NlL0RvY3VtZW50cy9odGRvY3MvYm9va3NoZWxmL21haW4uanMiLCJjOi9Vc2Vycy9KZXNzZS9Eb2N1bWVudHMvaHRkb2NzL2Jvb2tzaGVsZi9udXJicy5qcyIsImM6L1VzZXJzL0plc3NlL0RvY3VtZW50cy9odGRvY3MvYm9va3NoZWxmL3BvbHkydHJpLmpzIiwiYzovVXNlcnMvSmVzc2UvRG9jdW1lbnRzL2h0ZG9jcy9ib29rc2hlbGYvdmJvTWVzaC5qcyIsImM6L1VzZXJzL0plc3NlL0RvY3VtZW50cy9odGRvY3MvYm9va3NoZWxmL3Zvcm9ub2kuanMiLCJjOi9Vc2Vycy9KZXNzZS9Eb2N1bWVudHMvaHRkb2NzL2pzL2dsLW1hdHJpeC1taW4uanMiLCJjOi9Vc2Vycy9KZXNzZS9Eb2N1bWVudHMvaHRkb2NzL2pzL2dsU2hhZGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMWdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzc3REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMVVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBnbE1hdHJpeCA9IHJlcXVpcmUoXCIuLi9qcy9nbC1tYXRyaXgtbWluLmpzXCIpO1xyXG52YXIgdmVjMyA9IGdsTWF0cml4LnZlYzM7XHJcbnZhciB2ZWMyID0gZ2xNYXRyaXgudmVjMjtcclxudmFyIG51cmJzID0gcmVxdWlyZShcIi4vbnVyYnMuanNcIik7XHJcbnZhciB2Ym9NZXNoID0gcmVxdWlyZShcIi4vdmJvTWVzaC5qc1wiKTtcclxudmFyIHdvb2RXaWR0aCA9IDEyLjI7XHJcbnZhciBjb25MZW4gPSA0NTtcclxudmFyIGNvbk9mZnNldCA9IDEyO1xyXG52YXIgY29uV2lkdGggPSAyMDtcclxudmFyIHNoZWxmT2Zmc2V0ID0gMTU7XHJcbnZhciBwcmludFRvbGVyYW5jZSA9IDA7XHJcblxyXG5mdW5jdGlvbiBpbml0Q29ubmVjdG9yKCkge1xyXG5cclxufVxyXG5cclxudmFyIGNyZWF0ZUNvbm5lY3RvciA9IChmdW5jdGlvbigpIHtcclxuICB2YXIgZGlyMSA9IHZlYzMuY3JlYXRlKCk7XHJcbiAgdmFyIGRpcjIgPSB2ZWMzLmNyZWF0ZSgpO1xyXG4gIHZhciBkaXIzID0gdmVjMy5jcmVhdGUoKTtcclxuICB2YXIgcHQgPSB2ZWMzLmNyZWF0ZSgpO1xyXG4gIHZhciBwdDIgPSB2ZWMzLmNyZWF0ZSgpO1xyXG4gIHZhciBkaXJzID0gW2RpcjEsZGlyMixkaXIzXTtcclxuICB2YXIgZGlyLCBuRGlyO1xyXG4gIHZhciBwZXJwID0gdmVjMy5jcmVhdGUoKTtcclxuICB2YXIgYmlzZWN0b3IgPSB2ZWMzLmNyZWF0ZSgpO1xyXG4gIHJldHVybiBmdW5jdGlvbiBjcmVhdGVDb25uZWN0b3IodHJpLHZib091dCkge1xyXG4gICAgdmFyIGNlbnRlciA9IHRyaS5jaXJjdW1jZW50ZXI7XHJcbiAgICB2YXIgcDEgPSB0cmkubmVpZ2hib3JzX1swXS5jaXJjdW1jZW50ZXI7XHJcbiAgICB2YXIgcDIgPSB0cmkubmVpZ2hib3JzX1sxXS5jaXJjdW1jZW50ZXI7XHJcbiAgICB2YXIgcDMgPSB0cmkubmVpZ2hib3JzX1syXS5jaXJjdW1jZW50ZXI7XHJcbiAgICB2ZWMzLnN1YihkaXIxLHAxLGNlbnRlcik7XHJcbiAgICB2ZWMzLnN1YihkaXIyLHAyLGNlbnRlcik7XHJcbiAgICB2ZWMzLnN1YihkaXIzLHAzLGNlbnRlcik7XHJcbiAgICBcclxuICAgIHZlYzMubm9ybWFsaXplKGRpcjEsZGlyMSk7XHJcbiAgICB2ZWMzLm5vcm1hbGl6ZShkaXIyLGRpcjIpO1xyXG4gICAgdmVjMy5ub3JtYWxpemUoZGlyMyxkaXIzKTtcclxuXHJcbiAgICB2YXIgYmFzZUluZGV4ID0gdmJvT3V0Lm51bVZlcnRpY2VzO1xyXG4gICAgdmFyIG51bVB0cyA9IDA7XHJcbiAgICBcclxuICAgIGZvcih2YXIgaT0wO2k8MzsrK2kpIHtcclxuICAgICAgLy9tYWtlIHBvaW50c1xyXG4gICAgICBkaXIgPSBkaXJzW2ldO1xyXG4gICAgICBuRGlyID0gZGlyc1soMTw8aSkmM107XHJcbiAgICAgIHZlYzIuc2V0KHBlcnAsZGlyWzFdLC1kaXJbMF0pO1xyXG4gICAgICB2ZWMzLnNjYWxlQW5kQWRkKHB0LGNlbnRlciwgZGlyLCBjb25MZW4rc2hlbGZPZmZzZXQpO1xyXG4gICAgICB2ZWMyLnNjYWxlQW5kQWRkKHB0LHB0LHBlcnAsd29vZFdpZHRoKjAuNStwcmludFRvbGVyYW5jZSk7ICAgICAgXHJcbiAgICAgIGFkZENvbm5lY3RvclB0KHZib091dCxwdCk7XHJcbiAgICAgIG51bVB0cysrO1xyXG4gICAgICBcclxuICAgICAgdmVjMi5zY2FsZUFuZEFkZChwdCxwdCxkaXIsLWNvbkxlbik7XHJcbiAgICAgIGFkZENvbm5lY3RvclB0KHZib091dCxwdCk7XHJcbiAgICAgIG51bVB0cysrO1xyXG4gICAgICBcclxuICAgICAgdmVjMi5zY2FsZUFuZEFkZChwdCxwdCxwZXJwLC0od29vZFdpZHRoK3ByaW50VG9sZXJhbmNlKjIpKTtcclxuICAgICAgYWRkQ29ubmVjdG9yUHQodmJvT3V0LHB0KTtcclxuICAgICAgbnVtUHRzKys7XHJcblxyXG4gICAgICBcclxuICAgICAgLy9tYWtlIGN1cnZlXHJcbiAgICAgIHZhciBjcnYgPSBudXJicy5jcmVhdGVDcnYobnVsbCwgMik7XHJcbiAgICAgIFxyXG4gICAgICB2ZWMyLnNjYWxlQW5kQWRkKHB0LHB0LGRpcixjb25MZW4pO1xyXG4gICAgICBhZGRDb25uZWN0b3JQdCh2Ym9PdXQscHQpO1xyXG4gICAgICBudW1QdHMrKztcclxuICAgICAgXHJcbiAgICAgIG51cmJzLmFkZFBvaW50KGNydixwdCk7XHJcblxyXG4gICAgICB2ZWMyLnNjYWxlQW5kQWRkKHB0LHB0LHBlcnAsLWNvbk9mZnNldCk7XHJcbiAgICAgIC8vYWRkQ29ubmVjdG9yUHQodmJvT3V0LHB0KTtcclxuICAgICAgLy9udW1QdHMrKztcclxuXHJcbiAgICAgIG51cmJzLmFkZFBvaW50KGNydixwdCk7XHJcbiAgICAgIFxyXG4gICAgICAvL2dldCBvZmZzZXRcclxuICAgICAgdmVjMy5hZGQoYmlzZWN0b3IsIGRpcixuRGlyKTtcclxuICAgICAgdmVjMy5ub3JtYWxpemUoYmlzZWN0b3IsYmlzZWN0b3IpO1xyXG4gICAgICB2YXIgc2luQSA9IE1hdGguYWJzKGJpc2VjdG9yWzBdKmRpclsxXS1iaXNlY3RvclsxXSpkaXJbMF0pO1xyXG4gICAgICB2ZWMzLnNjYWxlQW5kQWRkKHB0LGNlbnRlcixiaXNlY3Rvciwod29vZFdpZHRoKjAuNStjb25PZmZzZXQpL3NpbkEpO1xyXG5cclxuICAgICAgbnVyYnMuYWRkUG9pbnQoY3J2LHB0KTtcclxuICAgICAgXHJcbiAgICAgIC8vYWRkQ29ubmVjdG9yUHQodmJvT3V0LHB0KTtcclxuICAgICAgLy9udW1QdHMrKztcclxuICAgICAgXHJcbiAgICAgIHZlYzIuc2V0KHBlcnAsbkRpclsxXSwtbkRpclswXSk7XHJcbiAgICAgIHZlYzMuc2NhbGVBbmRBZGQocHQsY2VudGVyLCBuRGlyLCBjb25MZW4rc2hlbGZPZmZzZXQpO1xyXG4gICAgICB2ZWMyLnNjYWxlQW5kQWRkKHB0LHB0LHBlcnAsd29vZFdpZHRoKjAuNStwcmludFRvbGVyYW5jZStjb25PZmZzZXQpOyAgICAgIFxyXG4gICAgICBcclxuICAgICAgbnVyYnMuYWRkUG9pbnQoY3J2LHB0KTtcclxuICAgICAgdmVjMi5zY2FsZUFuZEFkZChwdCxwdCxwZXJwLC1jb25PZmZzZXQpOyAgICAgIFxyXG4gICAgICBudXJicy5hZGRQb2ludChjcnYscHQpO1xyXG4gICAgICBcclxuICAgICAgdmFyIGRvbWFpbiA9IG51cmJzLmRvbWFpbihjcnYpO1xyXG4gICAgICBmb3IodmFyIGo9MTtqPDIwOysraikge1xyXG4gICAgICAgIHZhciB1ID0gai8yMC4wKihkb21haW5bMV0tZG9tYWluWzBdKStkb21haW5bMF07XHJcbiAgICAgICAgbnVyYnMuZXZhbHVhdGVDcnYoY3J2LHUscHQpO1xyXG4gICAgICAgIGFkZENvbm5lY3RvclB0KHZib091dCxwdCk7XHJcbiAgICAgICAgbnVtUHRzKys7XHJcbiAgICAgICAgXHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vc3RpdGNoIHNpZGVzXHJcbiAgICBmb3IodmFyIGk9MDtpPG51bVB0czsrK2kpIHtcclxuICAgICAgdmFyIGlOZXh0ID0gKGkrMSklbnVtUHRzO1xyXG4gICAgICB2Ym9NZXNoLmFkZFRyaWFuZ2xlKHZib091dCxiYXNlSW5kZXgraSoyLGJhc2VJbmRleCtpTmV4dCoyKzEsYmFzZUluZGV4K2kqMisxKTtcclxuICAgICAgdmJvTWVzaC5hZGRUcmlhbmdsZSh2Ym9PdXQsYmFzZUluZGV4K2kqMixiYXNlSW5kZXgraU5leHQqMixiYXNlSW5kZXgraU5leHQqMisxKTtcclxuICAgIH0gICAgXHJcbiAgfVxyXG59KSgpO1xyXG5cclxuZnVuY3Rpb24gYWRkQ29ubmVjdG9yUHQodmJvT3V0LHB0KSB7XHJcbiAgdmJvTWVzaC5hZGRWZXJ0ZXgodmJvT3V0LHB0KTtcclxuICBwdFsyXSA9IGNvbldpZHRoO1xyXG4gIHZib01lc2guYWRkVmVydGV4KHZib091dCxwdCk7XHJcbiAgcHRbMl0gPSAwO1xyXG59XHJcblxyXG5leHBvcnRzLmNyZWF0ZUNvbm5lY3RvciA9IGNyZWF0ZUNvbm5lY3RvcjtcclxuZXhwb3J0cy5pbml0Q29ubmVjdG9yID0gaW5pdENvbm5lY3RvcjtcclxuIiwidmFyIGdsO1xudmFyIGV4dCA9IG51bGw7XG5mdW5jdGlvbiBpbml0R0woY2FudmFzLCBkcmF3QnVmZmVyKSB7XG4gIGRyYXdCdWZmZXIgPSBkcmF3QnVmZmVyID8gZHJhd0J1ZmZlciA6IGZhbHNlO1xuICAgIHRyeSB7XG4gICAgICAgIGdsID0gY2FudmFzLmdldENvbnRleHQoXCJ3ZWJnbFwiLHtwcmVzZXJ2ZURyYXdpbmdCdWZmZXI6IGRyYXdCdWZmZXJ9KTtcbiAgICAgICAgZ2wudmlld3BvcnRXaWR0aCA9IGNhbnZhcy53aWR0aDtcbiAgICAgICAgZ2wudmlld3BvcnRIZWlnaHQgPSBjYW52YXMuaGVpZ2h0O1xuICAgICAgICBleHQgPSBnbC5nZXRFeHRlbnNpb24oXCJPRVNfZWxlbWVudF9pbmRleF91aW50XCIpO1xuICAgICAgICByZXR1cm4gZ2w7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgIH1cbiAgICBpZiAoIWdsKSB7XG4gICAgICAgIC8vYWxlcnQoXCJDb3VsZCBub3QgaW5pdGlhbGlzZSBXZWJHTCwgc29ycnkgOi0oXCIpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxufVxuXG4vKlxucGFzcyBjdWJlIG1hcCBvYmplY3RcbmN1YmVtYXAgaGFzIGFuIGFycmF5IG9mIHNpeCBjdWJlSW1hZ2VzXG4qL1xuXG5mdW5jdGlvbiBpbml0Q3ViZVRleHR1cmUoY3ViZU1hcE9iaikge1xuICAgIGN1YmVNYXBPYmoudGV4dHVyZSA9IGdsLmNyZWF0ZVRleHR1cmUoKTtcbiAgICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFX0NVQkVfTUFQLCBjdWJlTWFwT2JqLnRleHR1cmUpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV9DVUJFX01BUCwgZ2wuVEVYVFVSRV9NSU5fRklMVEVSLCBnbC5ORUFSRVNUKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfQ1VCRV9NQVAsIGdsLlRFWFRVUkVfTUFHX0ZJTFRFUiwgZ2wuTkVBUkVTVCk7XG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFX0NVQkVfTUFQLCBnbC5URVhUVVJFX1dSQVBfVCwgZ2wuQ0xBTVBfVE9fRURHRSk7XG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFX0NVQkVfTUFQLCBnbC5URVhUVVJFX1dSQVBfUywgZ2wuQ0xBTVBfVE9fRURHRSk7XG5cbiAgICBnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfQ1VCRV9NQVBfUE9TSVRJVkVfWCwgMCwgZ2wuUkdCLCBnbC5SR0IsIGdsLlVOU0lHTkVEX0JZVEUsIGN1YmVNYXBPYmouY3ViZUltYWdlc1swXSk7XG4gICAgZ2wudGV4SW1hZ2UyRChnbC5URVhUVVJFX0NVQkVfTUFQX05FR0FUSVZFX1gsIDAsIGdsLlJHQiwgZ2wuUkdCLCBnbC5VTlNJR05FRF9CWVRFLCBjdWJlTWFwT2JqLmN1YmVJbWFnZXNbMV0pO1xuICAgIGdsLnRleEltYWdlMkQoZ2wuVEVYVFVSRV9DVUJFX01BUF9QT1NJVElWRV9ZLCAwLCBnbC5SR0IsIGdsLlJHQiwgZ2wuVU5TSUdORURfQllURSwgY3ViZU1hcE9iai5jdWJlSW1hZ2VzWzJdKTtcbiAgICBnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfQ1VCRV9NQVBfTkVHQVRJVkVfWSwgMCwgZ2wuUkdCLCBnbC5SR0IsIGdsLlVOU0lHTkVEX0JZVEUsIGN1YmVNYXBPYmouY3ViZUltYWdlc1szXSk7XG4gICAgZ2wudGV4SW1hZ2UyRChnbC5URVhUVVJFX0NVQkVfTUFQX1BPU0lUSVZFX1osIDAsIGdsLlJHQiwgZ2wuUkdCLCBnbC5VTlNJR05FRF9CWVRFLCBjdWJlTWFwT2JqLmN1YmVJbWFnZXNbNF0pO1xuICAgIGdsLnRleEltYWdlMkQoZ2wuVEVYVFVSRV9DVUJFX01BUF9ORUdBVElWRV9aLCAwLCBnbC5SR0IsIGdsLlJHQiwgZ2wuVU5TSUdORURfQllURSwgY3ViZU1hcE9iai5jdWJlSW1hZ2VzWzVdKTtcbn1cblxuZXhwb3J0cy5pbml0ID0gaW5pdEdMO1xuZXhwb3J0cy5pbml0Q3ViZVRleHR1cmUgPSBpbml0Q3ViZVRleHR1cmU7IiwiXCJ1c2Ugc3RyaWN0XCJcclxuXHJcbnZhciBnbFNoYWRlciA9IHJlcXVpcmUoJy4uL2pzL2dsU2hhZGVyLmpzJyk7XHJcbnZhciBnbE1hdHJpeCA9IHJlcXVpcmUoJy4uL2pzL2dsLW1hdHJpeC1taW4uanMnKTtcclxudmFyIHBvbHkydHJpID0gcmVxdWlyZSgnLi9wb2x5MnRyaS5qcycpO1xyXG52YXIgZ2xVdGlscyA9IHJlcXVpcmUoJy4vZ2xVdGlscy5qcycpO1xyXG52YXIgdm9yb25vaSA9IHJlcXVpcmUoJy4vdm9yb25vaS5qcycpO1xyXG52YXIgdmJvTWVzaCA9IHJlcXVpcmUoJy4vdmJvTWVzaC5qcycpO1xyXG52YXIgY29ubmVjdG9yID0gcmVxdWlyZSgnLi9jb25uZWN0b3IuanMnKTtcclxudmFyIHZlYzMgPSBnbE1hdHJpeC52ZWMzO1xyXG52YXIgbWF0NCA9IGdsTWF0cml4Lm1hdDQ7XHJcbnZhciBtYXQzID0gZ2xNYXRyaXgubWF0NDtcclxuXHJcbnZhciBjYW52YXM7XHJcbnZhciBnbDtcclxudmFyIGNvbG9yU2hhZGVyO1xyXG52YXIgdm9yb25vaUVkZ2VzO1xyXG52YXIgbXZNYXRyaXggPSBtYXQ0LmNyZWF0ZSgpO1xyXG52YXIgcE1hdHJpeCA9IG1hdDQuY3JlYXRlKCk7XHJcbnZhciBuTWF0cml4ID0gbWF0My5jcmVhdGUoKTtcclxudmFyIGNvbm5lY3RvclZibztcclxuXHJcbmZ1bmN0aW9uIGluaXQoKSB7XHJcbi8vc3R1cGlkXHJcblx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggXCJrZXlkb3duXCIsa2V5UHJlc3MsZmFsc2UpO1xyXG5cclxuICBjYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImdsXCIpO1xyXG4gIGdsID0gZ2xVdGlscy5pbml0KGNhbnZhcyk7XHJcbiAgY29sb3JTaGFkZXIgPSBnbFNoYWRlci5sb2FkU2hhZGVyKGdsLFwiLi4vc2hhZGVycy9zaW1wbGVDb2xvci52ZXJ0XCIsXCIuLi9zaGFkZXJzL3NpbXBsZUNvbG9yLmZyYWdcIik7XHJcbiAgdmJvTWVzaC5zZXRHTChnbCk7XHJcbiAgaW5pdFZvcm9ub2koKTtcclxuICBcclxuICB2b3Jvbm9pRWRnZXMgPSB2Ym9NZXNoLmNyZWF0ZSgpO1xyXG4gIGNvbm5lY3RvclZibyA9IHZib01lc2guY3JlYXRlMzIoKTtcclxuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoc3RlcCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHN0ZXAoKSB7XHJcbiAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHN0ZXApO1xyXG4gIHZib01lc2guY2xlYXIoY29ubmVjdG9yVmJvKTtcclxuICBnZXRDb25uZWN0b3JzKCk7XHJcbiAgZHJhdygpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBkcmF3KCkge1xyXG4gIGdsLmNsZWFyKGdsLkNPTE9SX0JVRkZFUl9CSVQgfCBnbC5ERVBUSF9CVUZGRVJfQklUKTtcclxuICBpZighY29sb3JTaGFkZXIuaXNSZWFkeSkgcmV0dXJuO1xyXG4gIFxyXG4gIGNvbG9yU2hhZGVyLmJlZ2luKCk7XHJcbiAgbWF0NC5pZGVudGl0eShtdk1hdHJpeCk7XHJcbiAgbWF0NC5vcnRobyhwTWF0cml4LC0xMDAsMTAwMCwxMDAwLC0xMDAsLTEwLDEwMCk7XHJcbiAgXHJcbiAgLy9zZXQgY29sb3JcclxuICBjb2xvclNoYWRlci51bmlmb3Jtcy5tYXRDb2xvci5zZXQoWzAsMCwwLDFdKTtcclxuICAvL3NldCBtYXRyaWNlc1xyXG4gIGNvbG9yU2hhZGVyLnVuaWZvcm1zLm12TWF0cml4LnNldChtdk1hdHJpeCk7XHJcbiAgY29sb3JTaGFkZXIudW5pZm9ybXMucE1hdHJpeC5zZXQocE1hdHJpeCk7XHJcbiAgXHJcbiAgLy9tYWtlIHZvcm9ub2kgZWRnZXMgdmJvXHJcbiAgdm9yb25vaVRvRWRnZVZCTygpO1xyXG4gIFxyXG4gIC8vZHJhdyBlZGdlcyB2Ym9cclxuICBjb2xvclNoYWRlci5hdHRyaWJzLnZlcnRleFBvc2l0aW9uLnNldCh2b3Jvbm9pRWRnZXMudmVydGV4QnVmZmVyKTtcclxuICBnbC5kcmF3QXJyYXlzKGdsLkxJTkVTLCAwLHZvcm9ub2lFZGdlcy5udW1WZXJ0aWNlcyk7XHJcblxyXG4gIC8vZHJhdyBjb25uZWN0b3JzXHJcbiAgY29sb3JTaGFkZXIuYXR0cmlicy52ZXJ0ZXhQb3NpdGlvbi5zZXQoY29ubmVjdG9yVmJvLnZlcnRleEJ1ZmZlcik7XHJcbiAgZ2wuYmluZEJ1ZmZlcihnbC5FTEVNRU5UX0FSUkFZX0JVRkZFUixjb25uZWN0b3JWYm8uaW5kZXhCdWZmZXIpO1xyXG4gIGdsLmRyYXdFbGVtZW50cyhnbC5UUklBTkdMRVMsY29ubmVjdG9yVmJvLm51bUluZGljZXMsZ2wuVU5TSUdORURfSU5ULDApO1xyXG4gIFxyXG4gIGNvbG9yU2hhZGVyLmVuZCgpO1xyXG59XHJcblxyXG4vL3B1dCB2b3Jvbm9pIGVkZ2VzIGludG8gYSB2Ym9cclxuZnVuY3Rpb24gdm9yb25vaVRvRWRnZVZCTygpIHtcclxuICB2Ym9NZXNoLmNsZWFyKHZvcm9ub2lFZGdlcyk7XHJcbiAgZm9yKHZhciBpPTA7aTx2b3Jvbm9pLnRyaWFuZ2xlcy5sZW5ndGg7KytpKSB7XHJcbiAgICB2YXIgdHJpID0gdm9yb25vaS50cmlhbmdsZXNbaV07XHJcbiAgICBpZih0cmkuaW50ZXJpb3JfKSB7XHJcbiAgICAgIGlmKHRyaS5uZWlnaGJvcnNfWzBdICYmIHRyaS5uZWlnaGJvcnNfWzBdLmludGVyaW9yXykge1xyXG4gICAgICAgIHZib01lc2guYWRkVmVydGV4KHZvcm9ub2lFZGdlcyx0cmkuY2lyY3VtY2VudGVyKTtcclxuICAgICAgICB2Ym9NZXNoLmFkZFZlcnRleCh2b3Jvbm9pRWRnZXMsdHJpLm5laWdoYm9yc19bMF0uY2lyY3VtY2VudGVyKTtcclxuICAgICAgfVxyXG4gICAgICBpZih0cmkubmVpZ2hib3JzX1sxXSAmJiB0cmkubmVpZ2hib3JzX1sxXS5pbnRlcmlvcl8pIHtcclxuICAgICAgICB2Ym9NZXNoLmFkZFZlcnRleCh2b3Jvbm9pRWRnZXMsdHJpLmNpcmN1bWNlbnRlcik7XHJcbiAgICAgICAgdmJvTWVzaC5hZGRWZXJ0ZXgodm9yb25vaUVkZ2VzLHRyaS5uZWlnaGJvcnNfWzFdLmNpcmN1bWNlbnRlcik7XHJcbiAgICAgIH1cclxuICAgICAgaWYodHJpLm5laWdoYm9yc19bMl0gJiYgdHJpLm5laWdoYm9yc19bMl0uaW50ZXJpb3JfKSB7XHJcbiAgICAgICAgdmJvTWVzaC5hZGRWZXJ0ZXgodm9yb25vaUVkZ2VzLHRyaS5jaXJjdW1jZW50ZXIpO1xyXG4gICAgICAgIHZib01lc2guYWRkVmVydGV4KHZvcm9ub2lFZGdlcyx0cmkubmVpZ2hib3JzX1syXS5jaXJjdW1jZW50ZXIpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG4gIHZib01lc2guYnVmZmVyKHZvcm9ub2lFZGdlcyk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldENvbm5lY3RvcnMoKSB7XHJcbiAgZm9yKHZhciBpPTA7aTx2b3Jvbm9pLnRyaWFuZ2xlcy5sZW5ndGg7KytpKSB7XHJcbiAgICB2YXIgdHJpID0gdm9yb25vaS50cmlhbmdsZXNbaV07XHJcbiAgICBpZih0cmkuaW50ZXJpb3JfKSB7XHJcbiAgICAgIGlmKHRyaS5uZWlnaGJvcnNfWzBdICYmIHRyaS5uZWlnaGJvcnNfWzBdLmludGVyaW9yXyAmJlxyXG4gICAgICAgIHRyaS5uZWlnaGJvcnNfWzFdICYmIHRyaS5uZWlnaGJvcnNfWzFdLmludGVyaW9yXyAmJlxyXG4gICAgICAgIHRyaS5uZWlnaGJvcnNfWzJdICYmIHRyaS5uZWlnaGJvcnNfWzJdLmludGVyaW9yXykge1xyXG4gICAgICAgIGNvbm5lY3Rvci5jcmVhdGVDb25uZWN0b3IodHJpLGNvbm5lY3RvclZibyk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcbiAgdmJvTWVzaC5idWZmZXIoY29ubmVjdG9yVmJvKTtcclxufVxyXG5cclxuZnVuY3Rpb24gaW5pdFZvcm9ub2koKSB7XHJcbiAgdm9yb25vaS5pbml0KCk7XHJcbiAgdm9yb25vaS5yZXNldCgpO1xyXG4gIHZvcm9ub2kudm9yb25vaSgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBkb3dubG9hZFZib0FzU1RMKHZibykge1xyXG4gIHZhciB0cmlDb3VudCA9IHZiby5udW1JbmRpY2VzLzM7XHJcbiAgdmFyIGJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcig4MCs0KzUwKnRyaUNvdW50KTtcclxuICB2YXIgZGF0YVZpZXcgPSBuZXcgRGF0YVZpZXcoYnVmZmVyKTtcclxuICBkYXRhVmlldy5vZmZzZXQgPSA4MDtcclxuICBzZXREVlVpbnQzMihkYXRhVmlldywgdHJpQ291bnQpO1xyXG4gIFxyXG4gIHNhdmVWQk9CaW5hcnkodmJvLGRhdGFWaWV3KTtcclxuXHJcbiAgdmFyIGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XHJcbiAgdmFyIGJsb2IgPSBuZXcgQmxvYihbYnVmZmVyXSwgeyd0eXBlJzonYXBwbGljYXRpb25cXC9vY3RldC1zdHJlYW0nfSk7XHJcbiAgYS5ocmVmID0gd2luZG93LlVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYik7XHJcbiAgYS5kb3dubG9hZCA9IFwidmJvXCIrbmV3IERhdGUoKS50b0lTT1N0cmluZygpLnN1YnN0cmluZygwLDE2KStcIi5zdGxcIjtcclxuICBhLmNsaWNrKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNhdmVWQk9CaW5hcnkodmJvLCBkYXRhVmlldykge1xyXG4gIGZvcih2YXIgaT0wO2k8dmJvLm51bUluZGljZXM7KSB7XHJcbiAgICBzZXREVkZsb2F0KGRhdGFWaWV3LDAuMCk7XHJcbiAgICBzZXREVkZsb2F0KGRhdGFWaWV3LDAuMCk7XHJcbiAgICBzZXREVkZsb2F0KGRhdGFWaWV3LDAuMCk7XHJcbiAgICB2YXIgaTEgPSB2Ym8uaW5kZXhEYXRhW2krK10qMztcclxuICAgIHZhciBpMiA9IHZiby5pbmRleERhdGFbaSsrXSozO1xyXG4gICAgdmFyIGkzID0gdmJvLmluZGV4RGF0YVtpKytdKjM7XHJcblxyXG4gICAgc2V0RFZGbG9hdChkYXRhVmlldyx2Ym8udmVydGV4RGF0YVtpMV0pO1xyXG4gICAgc2V0RFZGbG9hdChkYXRhVmlldyx2Ym8udmVydGV4RGF0YVtpMSsxXSk7XHJcbiAgICBzZXREVkZsb2F0KGRhdGFWaWV3LHZiby52ZXJ0ZXhEYXRhW2kxKzJdKTtcclxuXHJcbiAgICBzZXREVkZsb2F0KGRhdGFWaWV3LHZiby52ZXJ0ZXhEYXRhW2kyXSk7XHJcbiAgICBzZXREVkZsb2F0KGRhdGFWaWV3LHZiby52ZXJ0ZXhEYXRhW2kyKzFdKTtcclxuICAgIHNldERWRmxvYXQoZGF0YVZpZXcsdmJvLnZlcnRleERhdGFbaTIrMl0pO1xyXG5cclxuICAgIHNldERWRmxvYXQoZGF0YVZpZXcsdmJvLnZlcnRleERhdGFbaTNdKTtcclxuICAgIHNldERWRmxvYXQoZGF0YVZpZXcsdmJvLnZlcnRleERhdGFbaTMrMV0pO1xyXG4gICAgc2V0RFZGbG9hdChkYXRhVmlldyx2Ym8udmVydGV4RGF0YVtpMysyXSk7XHJcbiAgICBcclxuICAgIHNldERWVWludDE2KGRhdGFWaWV3LDApO1xyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gc2V0RFZGbG9hdChkdiwgdmFsKSB7XHJcbiAgZHYuc2V0RmxvYXQzMihkdi5vZmZzZXQsdmFsLHRydWUpO1xyXG4gIGR2Lm9mZnNldCArPSA0O1xyXG59XHJcblxyXG5mdW5jdGlvbiBzZXREVlVpbnQxNihkdiwgdmFsKSB7XHJcbiAgZHYuc2V0VWludDE2KGR2Lm9mZnNldCx2YWwsdHJ1ZSk7XHJcbiAgZHYub2Zmc2V0ICs9IDI7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNldERWVWludDMyKGR2LCB2YWwpIHtcclxuICBkdi5zZXRVaW50MzIoZHYub2Zmc2V0LHZhbCx0cnVlKTtcclxuICBkdi5vZmZzZXQgKz0gNDtcclxufVxyXG5cclxuaW5pdCgpO1xyXG5cclxuZnVuY3Rpb24ga2V5UHJlc3MoZXZlbnQpIHtcclxuICBzd2l0Y2goZXZlbnQud2hpY2gpIHtcclxuICAgIGNhc2UgXCJEXCIuY2hhckNvZGVBdCgwKTpcclxuICAgICAgZG93bmxvYWRWYm9Bc1NUTChjb25uZWN0b3JWYm8pO1xyXG4gICAgICBicmVhaztcclxuICB9XHJcbn1cclxuIiwidmFyIGdsTWF0cml4ID0gcmVxdWlyZShcIi4uL2pzL2dsLW1hdHJpeC1taW4uanNcIik7XG52YXIgdmVjMyA9IGdsTWF0cml4LnZlYzM7XG52YXIgdmVjNCA9IGdsTWF0cml4LnZlYzQ7XG4vL1ZFQzQgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vY2hlY2sgZm9yIDBcbnZlYzQucHJvamVjdERvd249ZnVuY3Rpb24oYSxiKXt2YXIgZD0xLjAvYVszXTtpZighYikge2I9dmVjMy5jcmVhdGUoKTt9IGJbMF09YVswXSpkO2JbMV09YVsxXSpkO2JbMl09YVsyXSpkO3JldHVybiBiO307XG4vL29wdGltaXplIHRvIGF2b2lkIG11bHRpcGxpY2F0aW9ucyB3aXRoIG5vIGJcbnZlYzQuZnJvbVZlYzM9ZnVuY3Rpb24oYSxiKXtpZighYikgYj0xO3ZhciBjPW5ldyBGbG9hdDMyQXJyYXkoNCk7Y1swXT1hWzBdKmI7Y1sxXT1hWzFdKmI7Y1syXT1hWzJdKmI7Y1szXT1iO3JldHVybiBjfTtcblxuLy9OVVJCUyBDVVJWRVxuLy9hIG51cmJzIG9iamVjdCBoYXMgY29udHJvbCBwdHMsa25vdHMsIGRlZ3JlZVxudmFyIG51cmJzID0gZXhwb3J0cztcbi8vdXNlZCBsb2NhbGx5XG5udXJicy5NQVhfREVHUkVFID0gMTA7XG5udXJicy5iYXNpc0Z1bmNzID0gbmV3IEZsb2F0MzJBcnJheSgxMCk7XG5udXJicy5iYXNpc0Z1bmNzVSA9IG5ldyBGbG9hdDMyQXJyYXkoMTApO1xubnVyYnMuYmFzaXNGdW5jc1YgPSBuZXcgRmxvYXQzMkFycmF5KDEwKTtcbm51cmJzLmRlcml2ZUJhc2lzRnVuY3MgPSBuZXcgQXJyYXkoMTEpO1xuZm9yKHZhciBpPTA7aTxudXJicy5NQVhfREVHUkVFKzE7KytpKSBudXJicy5kZXJpdmVCYXNpc0Z1bmNzW2ldID0gbmV3IEZsb2F0MzJBcnJheShudXJicy5NQVhfREVHUkVFKzEpO1xubnVyYnMubmR1ID0gbmV3IEFycmF5KG51cmJzLk1BWF9ERUdSRUUrMSk7XG5mb3IodmFyIGk9MDtpPG51cmJzLk1BWF9ERUdSRUUrMTsrK2kpIG51cmJzLm5kdVtpXSA9IG5ldyBGbG9hdDMyQXJyYXkobnVyYnMuTUFYX0RFR1JFRSsxKTtcblxubnVyYnMuYmFuZyA9IGZ1bmN0aW9uKGEpIHtcblx0dmFyIHZhbD0xO1xuXHRmb3IoO2E+MTthLS0pIHtcblx0XHR2YWwqPWE7XG5cdH1cblx0cmV0dXJuIHZhbDtcbn07XG5cbi8vSSBhbSBhbiBpZGlvdFxubnVyYnMuQiA9IFtuZXcgRmxvYXQzMkFycmF5KDEwKSxuZXcgRmxvYXQzMkFycmF5KDEwKSxuZXcgRmxvYXQzMkFycmF5KDEwKSxuZXcgRmxvYXQzMkFycmF5KDEwKSxuZXcgRmxvYXQzMkFycmF5KDEwKSxuZXcgRmxvYXQzMkFycmF5KDEwKSxuZXcgRmxvYXQzMkFycmF5KDEwKSxuZXcgRmxvYXQzMkFycmF5KDEwKSxuZXcgRmxvYXQzMkFycmF5KDEwKSxuZXcgRmxvYXQzMkFycmF5KDEwKV07XG5mb3IodmFyIGk9MDtpPDEwOysraSkge1xuXHRmb3IodmFyIGo9MDtqPDEwOysraikge1xuXHRcdG51cmJzLkJbaV1bal0gPSBudXJicy5iYW5nKGkpLyhudXJicy5iYW5nKGopKm51cmJzLmJhbmcoaS1qKSk7XG5cdH1cbn1cblxuLy9tYWtlIGEgbnVyYnMgY3J2IG9iamVjdFxuLy9pbml0aWFsaXplIHdpdGggcG9pbnRzPz9cbm51cmJzLmNyZWF0ZUNydiA9IGZ1bmN0aW9uKGNydixkZWdyZWUpIHtcblx0Y3J2ID0gY3J2IHx8IHt9O1xuXHRjcnYuZGVncmVlID0gZGVncmVlIHx8IDM7XG5cdGNydi5rbm90cyA9IG5ldyBBcnJheShjcnYuZGVncmVlKzEpO1xuXHRmb3IodmFyIGk9MDtpPD1jcnYuZGVncmVlO2krKykgY3J2Lmtub3RzW2ldID0gMDtcblx0Y3J2LmNvbnRyb2xQdHMgPSBbXTtcblx0cmV0dXJuIGNydjtcbn1cblxubnVyYnMuY3JlYXRlQ2xvc2VkQ3J2ID0gZnVuY3Rpb24ocHRzLCBkZWdyZWUpIHtcblx0dmFyIGNydiA9IHt9O1xuXHRjcnYuZGVncmVlID0gZGVncmVlIHx8IDM7XG5cdGNydi5rbm90cyA9IG5ldyBBcnJheShwdHMubGVuZ3RoK2Nydi5kZWdyZWUrY3J2LmRlZ3JlZSsxKTtcblx0Zm9yKHZhciBpPTA7aTxjcnYua25vdHMubGVuZ3RoO2krKykgY3J2Lmtub3RzW2ldID0gaS1jcnYuZGVncmVlO1xuXHRjcnYuY29udHJvbFB0cyA9IFtdO1xuXHRmb3IodmFyIGk9MDtpPHB0cy5sZW5ndGg7KytpKSB7XG5cdFx0Y3J2LmNvbnRyb2xQdHMucHVzaCh2ZWM0LmNyZWF0ZShwdHNbaV0pKTtcblx0fVxuXHRmb3IodmFyIGk9MDtpPD1kZWdyZWU7KytpKSB7XG5cdFx0Y3J2LmNvbnRyb2xQdHMucHVzaCh2ZWM0LmNyZWF0ZShwdHNbaV0pKTtcblx0fVxuXHRyZXR1cm4gY3J2O1xufVxuXG5udXJicy5jb3B5Q3J2ID0gZnVuY3Rpb24oY3J2KSB7XG5cdHZhciBuZXdDcnYgPSB7fTtcblx0bmV3Q3J2LmRlZ3JlZSA9IGNydi5kZWdyZWU7XG5cdG5ld0Nydi5rbm90cyA9IGNydi5rbm90cy5zbGljZSgwKTtcblx0bmV3Q3J2LmNvbnRyb2xQdHMgPSBjcnYuY29udHJvbFB0cy5zbGljZSgwKTtcblx0cmV0dXJuIG5ld0Nydjtcbn1cblxuLy9iaW5hcnkgc2VhcmNoXG5udXJicy5maW5kS25vdCA9IGZ1bmN0aW9uKGtub3RzLHUsZGVncmVlKSB7XG5cdGlmICh1PT1rbm90c1trbm90cy5sZW5ndGgtZGVncmVlXSkgcmV0dXJuIGtub3RzLmxlbmd0aC1kZWdyZWUtMjtcblx0aWYodSA8PSBrbm90c1tkZWdyZWVdKSByZXR1cm4gZGVncmVlO1xuXHR2YXIgbG93ID0gZGVncmVlO1xuXHR2YXIgaGlnaCA9IGtub3RzLmxlbmd0aC1kZWdyZWU7XG5cdHZhciBtaWQgPSBNYXRoLmZsb29yKChoaWdoK2xvdykvMik7XG5cdHdoaWxlKGtub3RzW21pZF0+dSB8fCB1ID49IGtub3RzW21pZCsxXSkge1xuXHQgIGlmKHU8a25vdHNbbWlkXSkge1xuXHRcdGhpZ2ggPSBtaWQ7XG5cdCAgfSBlbHNlIHtcblx0XHRsb3cgPSBtaWQ7XG5cdCAgfVxuXHQgIG1pZCA9IE1hdGguZmxvb3IoKGhpZ2grbG93KS8yKTtcblx0fVxuXHRyZXR1cm4gbWlkO1xufVxuXG4gXG4vL2ltcGxlbWVudCBkZWdyZWUgZWxldmF0aW9uIGFuZCByZWR1Y3Rpb24sIG5lZWRlZCB0byBsb2Z0IGN1cnZlIG9mIGRpZmZlcmVudCBkZWdyZWVzIGFzIHdlbGxcbm51cmJzLnNldERlZ3JlZSA9IGZ1bmN0aW9uKGRlZykge1xufVxuXHRcbm51cmJzLmV2YWx1YXRlQ3J2ID0gZnVuY3Rpb24oY3J2LHUscHQpIHtcblx0dmFyIGN1cnJLbm90ID0gbnVyYnMuZmluZEtub3QoY3J2Lmtub3RzLHUsY3J2LmRlZ3JlZSk7XG5cdFxuXHRudXJicy5iYXNpc0Z1bmN0aW9ucyhjcnYua25vdHMsY3J2LmRlZ3JlZSxjdXJyS25vdCwgdSxudXJicy5iYXNpc0Z1bmNzKTtcblx0dmFyIGV2YWxQdCA9IHZlYzQuY3JlYXRlKCk7XG5cdGZvcih2YXIgaSA9IDA7aTw9Y3J2LmRlZ3JlZTsrK2kpIHtcblx0ICB2ZWM0LnNjYWxlQW5kQWRkKGV2YWxQdCwgZXZhbFB0LGNydi5jb250cm9sUHRzW2N1cnJLbm90LWNydi5kZWdyZWUraV0sIG51cmJzLmJhc2lzRnVuY3NbaV0pO1xuXHR9XG5cdHJldHVybiB2ZWM0LnByb2plY3REb3duKGV2YWxQdCxwdCk7XG59XG4vKlx0IFxuXHQgcHVibGljIFBWZWN0b3IgZGVyaXZhdGl2ZShmbG9hdCB1LCBpbnQgaykge1xuXHRcdCBWZWN0b3I0RFtdIGRlcml2ZXNXID0gbmV3IFZlY3RvcjREW2srMV07XG5cdFx0IGlmKGs+ZGVncmVlKSByZXR1cm4gbmV3IFBWZWN0b3IoKTtcblx0XHQgaW50IGN1cnJLbm90ID0gZmluZEtub3QodSk7XG5cdFx0IFZlY3RvcjREW10gaFB0cyA9IG5ldyBWZWN0b3I0RFtkZWdyZWUrMV07XG5cdFx0IGZvcihpbnQgaT0wO2k8PWRlZ3JlZTsrK2kpIHtcblx0ICAgICAgaFB0c1tpXSA9IFZlY3RvcjRELm11bHRpcGx5KG5ldyBWZWN0b3I0RChjb250cm9sUHRzW2N1cnJLbm90LWRlZ3JlZStpXS54LGNvbnRyb2xQdHNbY3Vycktub3QtZGVncmVlK2ldLnksY29udHJvbFB0c1tjdXJyS25vdC1kZWdyZWUraV0ueiksd2VpZ2h0c1tjdXJyS25vdC1kZWdyZWUraV0pO1xuXHRcdCB9XG5cdFx0IGZsb2F0W11bXSBiYXNGdW5jID0gZGVyaXZlQmFzaXNGdW5jdGlvbnMoY3Vycktub3QsdSwgayk7XG5cdFx0IGZvcihpbnQgaT0wO2k8PWs7KytpKSB7XG5cdFx0XHQgZGVyaXZlc1dbaV0gPSBuZXcgVmVjdG9yNEQoKTtcblx0XHRcdCBmb3IoaW50IGo9MDtqPD1kZWdyZWU7KytqKSB7XG5cdFx0XHRcdCBkZXJpdmVzV1tpXSA9IFZlY3RvcjRELmFkZChkZXJpdmVzV1tpXSxWZWN0b3I0RC5tdWx0aXBseShoUHRzW2pdLGJhc0Z1bmNbaV1bal0pKTtcblx0XHRcdCB9XG5cdFx0IH1cblx0XHQgXG5cdFx0IFBWZWN0b3JbXSBkZXJpdmVzID0gbmV3IFBWZWN0b3JbZGVyaXZlc1cubGVuZ3RoXTtcblx0XHQgZGVyaXZlc1swXSA9IG5ldyBQVmVjdG9yKCk7XG5cdFx0IGZvcihpbnQgaT0wO2k8PWs7KytpKSB7XG5cdFx0XHRQVmVjdG9yIGN1cnJQdCA9IG5ldyBQVmVjdG9yKGRlcml2ZXNXW2ldLngsZGVyaXZlc1dbaV0ueSxkZXJpdmVzV1tpXS56KTtcblx0XHRcdGZvcihpbnQgaj0xO2o8PWk7KytqKSB7XG5cdFx0XHRcdGN1cnJQdCA9IFBWZWN0b3Iuc3ViKGN1cnJQdCxQVmVjdG9yLm11bHQoZGVyaXZlc1tpLWpdLEJbaV1bal0qZGVyaXZlc1dbal0udykpO1xuXHRcdFx0fVxuXHRcdFx0ZGVyaXZlc1tpXSA9IG5ldyBQVmVjdG9yKGN1cnJQdC54L2Rlcml2ZXNXWzBdLncsY3VyclB0LnkvZGVyaXZlc1dbMF0udyxjdXJyUHQuei9kZXJpdmVzV1swXS53KTtcblx0XHQgfVxuXHRcdCByZXR1cm4gZGVyaXZlc1trXTtcblx0XHQgXG5cdCB9XG5cdCBcblx0IHB1YmxpYyBQVmVjdG9yW10gYWxsRGVyaXZhdGl2ZXMoZmxvYXQgdSwgaW50IGspIHtcblx0XHQgVmVjdG9yNERbXSBkZXJpdmVzVyA9IG5ldyBWZWN0b3I0RFtrKzFdO1xuXHRcdCBpbnQgY3Vycktub3QgPSBmaW5kS25vdCh1KTtcblx0XHQgVmVjdG9yNERbXSBoUHRzID0gbmV3IFZlY3RvcjREW2RlZ3JlZSsxXTtcblx0XHQgZm9yKGludCBpPTA7aTw9ZGVncmVlOysraSkge1xuXHQgICAgICBoUHRzW2ldID0gVmVjdG9yNEQubXVsdGlwbHkobmV3IFZlY3RvcjREKGNvbnRyb2xQdHNbY3Vycktub3QtZGVncmVlK2ldLngsY29udHJvbFB0c1tjdXJyS25vdC1kZWdyZWUraV0ueSxjb250cm9sUHRzW2N1cnJLbm90LWRlZ3JlZStpXS56KSx3ZWlnaHRzW2N1cnJLbm90LWRlZ3JlZStpXSk7XG5cdFx0IH1cdFx0IFxuXHRcdCBmbG9hdFtdW10gYmFzRnVuYyA9IGRlcml2ZUJhc2lzRnVuY3Rpb25zKGN1cnJLbm90LHUsIGspO1xuXHRcdCBmb3IoaW50IGk9MDtpPD1rOysraSkge1xuXHRcdFx0IGRlcml2ZXNXW2ldID0gbmV3IFZlY3RvcjREKCk7XG5cdFx0XHQgZm9yKGludCBqPTA7ajw9ZGVncmVlOysrailcblx0XHRcdFx0IGRlcml2ZXNXW2ldID0gVmVjdG9yNEQuYWRkKGRlcml2ZXNXW2ldLFZlY3RvcjRELm11bHRpcGx5KGhQdHNbal0sYmFzRnVuY1tpXVtqXSkpO1xuXHRcdCB9XG5cdFx0IFxuXHRcdCBQVmVjdG9yW10gZGVyaXZlcyA9IG5ldyBQVmVjdG9yW2Rlcml2ZXNXLmxlbmd0aF07XG5cdFx0IGRlcml2ZXNbMF0gPSBuZXcgUFZlY3RvcigpO1xuXHRcdCBmb3IoaW50IGk9MDtpPD1rOysraSkge1xuXHRcdFx0UFZlY3RvciBjdXJyUHQgPSBuZXcgUFZlY3RvcihkZXJpdmVzV1tpXS54LGRlcml2ZXNXW2ldLnksZGVyaXZlc1dbaV0ueik7XG5cdFx0XHRmb3IoaW50IGo9MTtqPD1pOysraikge1xuXHRcdFx0XHRjdXJyUHQgPSBQVmVjdG9yLnN1YihjdXJyUHQsUFZlY3Rvci5tdWx0KGRlcml2ZXNbaS1qXSxCW2ldW2pdKmRlcml2ZXNXW2pdLncpKTtcblx0XHRcdH1cblx0XHRcdGRlcml2ZXNbaV0gPSBuZXcgUFZlY3RvcihjdXJyUHQueC9kZXJpdmVzV1swXS53LGN1cnJQdC55L2Rlcml2ZXNXWzBdLncsY3VyclB0LnovZGVyaXZlc1dbMF0udyk7XG5cdFx0IH1cblx0XHQgcmV0dXJuIGRlcml2ZXM7XG5cdFx0IFxuXHQgfVx0IFxuKi9cdCAgXG5cdCAgLy9hcHByb3hpbWF0ZSBsZW5ndGgsIHVuaW1wbGVtZW50ZWRcbm51cmJzLmNydkxlbmd0aD1mdW5jdGlvbihjcnYpIHtcblx0cmV0dXJuIDE7XG59XHRcblx0ICBcbm51cmJzLmRvbWFpbiA9IGZ1bmN0aW9uKGMsYikge1xuXHRiID0gYiB8fCBuZXcgQXJyYXkoMik7XG5cdGJbMF09Yy5rbm90c1tjLmRlZ3JlZV07XG5cdGJbMV09Yy5rbm90c1tjLmtub3RzLmxlbmd0aC0xLWMuZGVncmVlXTtcblx0cmV0dXJuIGI7XG59XG5cdCAgXG5udXJicy5hZGRQb2ludCA9IGZ1bmN0aW9uKGNydiwgcHQpIHtcblx0Y3J2LmNvbnRyb2xQdHMucHVzaCh2ZWM0LmZyb21WZWMzKHB0LDEpKTtcblx0dmFyIGluYyA9IDE7XG5cdHZhciBzdGFydCA9IGNydi5rbm90c1tjcnYuZGVncmVlXTtcblx0dmFyIGVuZCA9IGNydi5rbm90c1tjcnYua25vdHMubGVuZ3RoLTFdO1xuXHRpZihjcnYuY29udHJvbFB0cy5sZW5ndGg8PWNydi5kZWdyZWUrMSkge1xuXHQgIGNydi5rbm90cy5wdXNoKDEpO1xuXHR9IGVsc2Uge1xuXHQgIHZhciBpO1xuXHQgIGZvciggaT1jcnYuZGVncmVlKzE7aTxjcnYua25vdHMubGVuZ3RoLWNydi5kZWdyZWU7KytpKSB7XG5cdFx0ICBpZihjcnYua25vdHNbaV0gIT0gc3RhcnQpIHtcblx0XHRcdCAgaW5jID0gY3J2Lmtub3RzW2ldLXN0YXJ0O1xuXHRcdFx0ICBpID0gY3J2Lmtub3RzLmxlbmd0aDsgLy9icmVhaz9cblx0XHQgIH1cblx0ICB9XG5cdCAgY3J2Lmtub3RzLnB1c2goZW5kK2luYyk7XG5cdCAgZm9yKCBpPWNydi5rbm90cy5sZW5ndGgtMjtpPmNydi5rbm90cy5sZW5ndGgtY3J2LmRlZ3JlZS0yOy0taSkgXG5cdFx0Y3J2Lmtub3RzW2ldID0gZW5kK2luYztcdFx0XHQgIFxuXHQgIGZvciggaT0wO2k8Y3J2Lmtub3RzLmxlbmd0aDsrK2kpIFxuXHRcdGNydi5rbm90c1tpXSAvPSBlbmQraW5jO1xuXHR9XG59XG5cbi8vaW5zZXJ0IGEga25vdCBhIHUgc29tZSB0aW1lc1xuLy90aGlzIHNob3VsZCB1c2UgbmF0aXZlIGFycmF5IG1ldGhvZHMgbm90IHRoaXMgd2VpcmQgY29weWluZ1xubnVyYnMuaW5zZXJ0S25vdCA9IGZ1bmN0aW9uKGNydix1LHRpbWVzKSB7XG5cdGlmKCF0aW1lcykgdGltZXMgPSAxO1xuXHR2YXIgY3Vycktub3QgPSBudXJicy5maW5kS25vdChjcnYua25vdHMsdSxjcnYuZGVncmVlKTtcblx0dmFyIG11bHRpcGxpY2l0eSA9IG51cmJzLmZpbmRNdWx0aXBsaWNpdHkoY3J2Lmtub3RzLGN1cnJLbm90KTtcblx0Ly90aW1lcyA9IE1hdGgubWluKGRlZ3JlZS10aW1lcy1tdWx0aXBsaWNpdHksdGltZXMpO1xuXHQvL3RpbWVzID0gTWF0aC5tYXgoMCx0aW1lcyk7XG5cdHZhciBuZXdLbm90cyA9IG5ldyBGbG9hdDMyQXJyYXkoY3J2Lmtub3RzLmxlbmd0aCt0aW1lcyk7XG5cdHZhciBuZXdQb2ludHMgPSBuZXcgQXJyYXkoY3J2LmNvbnRyb2xQdHMubGVuZ3RoK3RpbWVzKTtcblxuXHR2YXIgaTtcblx0Zm9yKGk9MDtpPD1jdXJyS25vdDsrK2kpIG5ld0tub3RzW2ldID0gY3J2Lmtub3RzW2ldO1xuXHRmb3IoaT0xO2k8PXRpbWVzOysraSkgbmV3S25vdHNbY3Vycktub3QraV0gPSB1O1xuXHRmb3IoaT1jdXJyS25vdCsxO2k8Y3J2Lmtub3RzLmxlbmd0aDsrK2kpIG5ld0tub3RzW2krdGltZXNdID0gY3J2Lmtub3RzW2ldO1xuXHRmb3IoaT0wO2k8PWN1cnJLbm90LWNydi5kZWdyZWU7KytpKSBuZXdQb2ludHNbaV0gPSBjcnYuY29udHJvbFB0c1tpXTtcblx0Zm9yKGk9Y3Vycktub3QtbXVsdGlwbGljaXR5OyBpPGNydi5jb250cm9sUHRzLmxlbmd0aDsrK2kpIG5ld1BvaW50c1tpK3RpbWVzXSA9IGNydi5jb250cm9sUHRzW2ldO1xuXHR2YXIgdGVtcCA9IG5ldyBBcnJheShkZWdyZWUrMSk7XG5cdGZvcihpPTA7aTw9IGNydi5kZWdyZWUtbXVsdGlwbGljaXR5OysraSkgdGVtcFtpXSA9IGNydi5jb250cm9sUHRzW2N1cnJLbm90LWNydi5kZWdyZWUraV07XG5cdHZhciBqLCBMLGFscGhhO1xuXHRmb3Ioaj0xO2o8PXRpbWVzOysraikge1xuXHQgTCA9IGN1cnJLbm90LWNydi5kZWdyZWUrajtcblx0IGZvcihpPTA7aTw9Y3J2LmRlZ3JlZS1qLW11bHRpcGxpY2l0eTsrK2kpIHtcblx0XHQgYWxwaGEgPSAodS1jcnYua25vdHNbTCtpXSkvKGNydi5rbm90c1tpK2N1cnJLbm90KzFdLWNydi5rbm90c1tMK2ldKTtcblx0XHQgdmVjNC5hZGQodmVjNC5zY2FsZSh0ZW1wW2krMV0sYWxwaGEpLHZlYzQuc2NhbGUodGVtcFtpXSwxLjAtYWxwaGEpLHRlbXBbaV0pO1xuXHQgfVxuXHQgXG5cdCBuZXdQb2ludHNbTF0gPSB0ZW1wWzBdO1xuXHQgbmV3UG9pbnRzW2N1cnJLbm90K3RpbWVzLWotbXVsdGlwbGljaXR5XSA9IHRlbXBbY3J2LmRlZ3JlZS1qLW11bHRpcGxpY2l0eV07XG5cdH1cblx0Zm9yKGk9TCsxO2k8Y3Vycktub3QtbXVsdGlwbGljaXR5OysraSkge1xuXHQgbmV3UG9pbnRzW2ldID0gdGVtcFtpLUxdO1xuXHR9XG5cdGNydi5jb250cm9sUHRzID0gbmV3UG9pbnRzO1xuXHRjcnYua25vdHMgPSBuZXdLbm90cztcbn1cdCAgXG5cbm51cmJzLmluc2VydEtub3RBcnJheSA9IGZ1bmN0aW9uKGNydix1cykge1xuXG59XG5cdCAgLypcdCBcblx0IHB1YmxpYyB2b2lkIGluc2VydEtub3RzKGZsb2F0W10gaW5zZXJ0S25vdHMpIHtcblx0XHQgaW50IHN0YXJ0S25vdCA9IGZpbmRLbm90KGluc2VydEtub3RzWzBdKTtcblx0XHQgaW50IGVuZEtub3QgPSBmaW5kS25vdChpbnNlcnRLbm90c1tpbnNlcnRLbm90cy5sZW5ndGgtMV0pKzE7XG5cdFx0IGZsb2F0W10gbmV3S25vdHMgPSBuZXcgZmxvYXRba25vdHMubGVuZ3RoK2luc2VydEtub3RzLmxlbmd0aF07XG5cdFx0IFZlY3RvcjREW10gbmV3UG9pbnRzID0gbmV3IFZlY3RvcjREW2NvbnRyb2xQdHMubGVuZ3RoK2luc2VydEtub3RzLmxlbmd0aF07XG5cdFx0IGZvcihpbnQgaj0wO2o8PXN0YXJ0S25vdC1kZWdyZWU7KytqKSBuZXdQb2ludHNbal0gPSBuZXcgVmVjdG9yNEQoY29udHJvbFB0c1tqXSx3ZWlnaHRzW2pdKTtcblx0XHQgZm9yKGludCBqPWVuZEtub3QtMTtqPGNvbnRyb2xQdHMubGVuZ3RoOysraikgbmV3UG9pbnRzW2oraW5zZXJ0S25vdHMubGVuZ3RoXSA9ICBuZXcgVmVjdG9yNEQoY29udHJvbFB0c1tqXSx3ZWlnaHRzW2pdKTtcblx0XHQgZm9yKGludCBqPTA7ajw9c3RhcnRLbm90OysraikgbmV3S25vdHNbal0gPSBrbm90c1tqXTtcblx0XHQgZm9yKGludCBqPWVuZEtub3QrZGVncmVlO2o8a25vdHMubGVuZ3RoOysraikgbmV3S25vdHNbaitpbnNlcnRLbm90cy5sZW5ndGhdID0ga25vdHNbal07XG5cdFx0IGludCBpPWVuZEtub3QrZGVncmVlLTE7XG5cdFx0IGludCBrPSBlbmRLbm90K2RlZ3JlZStpbnNlcnRLbm90cy5sZW5ndGgtMTtcblx0XHQgZm9yKGludCBqPWluc2VydEtub3RzLmxlbmd0aC0xO2o+PTA7LS1qKSB7XG5cdFx0XHQgd2hpbGUoaW5zZXJ0S25vdHNbal0gPD0ga25vdHNbaV0gJiYgaT5zdGFydEtub3QpIHtcblx0XHRcdFx0IG5ld1BvaW50c1trLWRlZ3JlZS0xXSA9IG5ldyBWZWN0b3I0RChjb250cm9sUHRzW2ktZGVncmVlLTFdLHdlaWdodHNbaS1kZWdyZWUtMV0pO1xuXHRcdFx0XHQgbmV3S25vdHNba10gPSBrbm90c1tpXTtcblx0XHRcdFx0IC0taztcblx0XHRcdFx0IC0taTtcblx0XHRcdCB9XG5cdFx0XHQgbmV3UG9pbnRzW2stZGVncmVlLTFdID0gbmV3UG9pbnRzW2stZGVncmVlXTtcblx0XHRcdCBmb3IoaW50IGw9MTtsPD1kZWdyZWU7KytsKSB7XG5cdFx0XHRcdCBpbnQgaW5kID0gay1kZWdyZWUrbDtcblx0XHRcdFx0IGxvYXQgYWxwaGEgPSBuZXdLbm90c1trK2xdLWluc2VydEtub3RzW2pdO1xuXHRcdFx0XHQgaWYoTWF0aC5hYnMoYWxwaGEpID09IDApIG5ld1BvaW50c1tpbmQtMV0gPSBuZXdQb2ludHNbaW5kXTtcblx0XHRcdFx0IGVsc2Uge1xuXHRcdFx0XHRcdCBhbHBoYSA9IGFscGhhLyhuZXdLbm90c1trK2xdLWtub3RzW2ktZGVncmVlK2xdKTtcblx0XHRcdFx0XHQgbmV3UG9pbnRzW2luZC0xXSA9IFZlY3RvcjRELmFkZChWZWN0b3I0RC5tdWx0aXBseShuZXdQb2ludHNbaW5kLTFdLGFscGhhKSwgVmVjdG9yNEQubXVsdGlwbHkobmV3UG9pbnRzW2luZF0sMS1hbHBoYSkpO1xuXHRcdFx0XHQgfVxuXHRcdFx0IH1cblx0XHRcdCBuZXdLbm90c1trXSA9IGluc2VydEtub3RzW2pdO1xuXHRcdFx0IC0taztcblx0XHQgfVxuXHRcdCBrbm90cyA9IG5ld0tub3RzO1xuXHRcdCBjb250cm9sUHRzID0gbmV3IFBWZWN0b3JbbmV3UG9pbnRzLmxlbmd0aF07XG5cdFx0IHdlaWdodHMgPSBuZXcgZmxvYXRbbmV3UG9pbnRzLmxlbmd0aF07XG5cdFx0IGZvcihpbnQgaj0wO2o8bmV3UG9pbnRzLmxlbmd0aDsrK2opIHtcblx0XHRcdCBcblx0XHRcdCBpZihuZXdQb2ludHNbal0gIT0gbnVsbCkge1xuXHRcdFx0XHQgY29udHJvbFB0c1tqXSA9IG5ld1BvaW50c1tqXS5wcm9qZWN0RG93bigpO1xuXHRcdFx0XHQgd2VpZ2h0c1tqXSA9IG5ld1BvaW50c1tqXS53O1xuXHRcdFx0IH1cblx0XHQgfVxuXHQgfVxuKi9cbi8vbWFrZSBrbm90IHZhbHVlcyBiZXR3ZWVuIDAgYW5kIDEgYWthIGV2YWx1YXRlKDApID0gc3RhcnQgYW5kIGV2YWx1YXRlKDEpID0gZW5kXG5udXJicy5ub3JtYWxpemVLbm90cz1mdW5jdGlvbihrbm90cykge1xuXHR2YXIgc3RhcnQgPSBrbm90c1swXTtcblx0dmFyIGVuZCA9IGtub3RzW2tub3RzLmxlbmd0aC0xXTtcblx0Zm9yKHZhciBpPTA7aTxrbm90cy5sZW5ndGg7KytpKSB7XG5cdFx0a25vdHNbaV0gPSAoa25vdHNbaV0tc3RhcnQpLyhlbmQtc3RhcnQpO1xuXHR9XG59XG5cbi8vaG93IG1hbnkgdGltZXMgZG9lcyBhIGtub3QgYXBwZWFyXG5udXJicy5maW5kTXVsdGlwbGljaXR5ID0gZnVuY3Rpb24oa25vdHMsa25vdCkge1xuXHR2YXIgbXVsdCA9IDE7XG5cdHZhciBpO1xuXHRmb3IoaT1rbm90KzE7aTxrbm90cy5sZW5ndGggJiYga25vdHNbaV0gPT0ga25vdHNba25vdF07KytpKSArK211bHQ7XG5cdGZvcihpPWtub3QtMTtpPj0wICYmIGtub3RzW2ldID09IGtub3RzW2tub3RdOy0taSkgKyttdWx0O1xuXG5cdHJldHVybiBtdWx0LTE7XG59XG5cdCBcbm51cmJzLmJhc2lzRnVuY3Rpb25zID0gZnVuY3Rpb24oa25vdHMsZGVncmVlLGtub3QsdSxmdW5jcykge1xuXHR2YXIgbGVmdCA9IG5ldyBGbG9hdDMyQXJyYXkoZGVncmVlKzEpO1xuXHR2YXIgcmlnaHQgPSBuZXcgRmxvYXQzMkFycmF5KGRlZ3JlZSsxKTtcblxuXHRmdW5jc1swXSA9IDE7XG5cdHZhciBqLCByLCBzYXZlZCwgdGVtcDtcblx0Zm9yKCBqPTE7ajw9ZGVncmVlOysraikge1xuXHQgIGxlZnRbal0gPSB1LWtub3RzW2tub3QrMS1qXTtcblx0ICByaWdodFtqXSA9IGtub3RzW2tub3Qral0tdTtcblx0ICBzYXZlZCA9IDA7XG5cdCAgZm9yKCByID0gMDtyPGo7KytyKSB7XG5cdFx0dGVtcCA9IGZ1bmNzW3JdLyhyaWdodFtyKzFdK2xlZnRbai1yXSk7XG5cdFx0ZnVuY3Nbcl0gPSBzYXZlZCtyaWdodFtyKzFdKnRlbXA7XG5cdFx0c2F2ZWQgPSBsZWZ0W2otcl0qdGVtcDtcblx0ICB9XG5cdCAgZnVuY3Nbal0gPSBzYXZlZDtcblx0fVxuXHRyZXR1cm4gZnVuY3M7XG59XG5cdCAgXG5cdCAgXG5udXJicy5kZXJpdmVCYXNpc0Z1bmN0aW9ucyA9IGZ1bmN0aW9uKGtub3RzLGRlZ3JlZSxrbm90LCB1LCBkZXIpIHtcblx0dmFyIGxlZnQscmlnaHQ7XG5cdG5kdVswXVswXSA9IDE7XG5cdHZhciBqLHI7XG5cdHZhciBzYXZlZCx0ZW1wO1xuXHRmb3Ioaj0xO2o8PWRlZ3JlZTsrK2opIHtcblx0IGxlZnRbal0gPSB1LWtub3RzW2tub3QrMS1qXTtcblx0IHJpZ2h0W2pdID0ga25vdHNba25vdCtqXS11O1xuXHQgc2F2ZWQgPSAwO1xuXHQgZm9yKHI9MDtyPGo7KytyKSB7XG5cdFx0IG5kdVtqXVtyXSA9IHJpZ2h0W3IrMV0rbGVmdFtqLXJdO1xuXHRcdCB0ZW1wID0gbmR1W3JdW2otMV0vbmR1W2pdW3JdO1xuXHRcdCBuZHVbcl1bal0gPSBzYXZlZCtyaWdodFtyKzFdKnRlbXA7XG5cdFx0IHNhdmVkID0gbGVmdFtqLXJdKnRlbXA7XG5cdCB9XG5cdCBuZHVbal1bal0gPSBzYXZlZDtcblx0fVxuXHRmb3Ioaj0wO2o8PWRlZ3JlZTsrK2opXG5cdFx0bnVyYnMuZGVyaXZlQmFzaXNGdW5jc1swXVtqXSA9IG5kdVtqXVtkZWdyZWVdO1xuXHRcblx0dmFyIHMxLCBzMiwgayxkLHJrLHBrLGoxLGoyO1xuXHR2YXIgYT1uZXcgQXJyYXkoZGVncmVlKzEpO1xuXHRmb3Ioaj0wO2o8ZGVncmVlKzE7KytqKSBhW2pdID0gbmV3IEFycmF5KGRlZ3JlZSsxKTtcblx0Zm9yKHI9MDtyPD1kZWdyZWU7KytyKSB7XG5cdCBzMSA9IDA7XG5cdCBzMiA9IDE7XG5cdCBhWzBdWzBdID0gMTtcblx0IGZvciggaz0xO2s8PWRlcjsrK2spIHtcblx0XHQgZCA9IDA7XG5cdFx0IHJrID0gci1rO1xuXHRcdCBwayA9IGRlZ3JlZS1rO1xuXHRcdCBpZihyPj1rKSB7XG5cdFx0XHQgYVtzMl1bMF0gPSBhW3MxXVswXS9uZHVbcGsrMV1bcmtdO1xuXHRcdFx0IGQgPSBhW3MyXVswXSpuZHVbcmtdW3BrXTtcblx0XHQgfVxuXHRcdCBqMSA9IC1yaztcblx0XHQgaWYocms+PS0xKSBqMSA9IDE7XG5cdFx0IGoyPWRlZ3JlZS1yO1xuXHRcdCBpZihyLTEgPD1waykgajIgPSBrLTE7XG5cdFx0IFxuXHRcdCBmb3Ioaj1qMTtqPD1qMjsrK2opIHtcblx0XHRcdCBhW3MyXVtqXSA9IChhW3MxXVtqXS1hW3MxXVtqLTFdKS9uZHVbcGsrMV1bcmsral07XG5cdFx0XHQgZCArPSBhW3MyXVtqXSpuZHVbcmsral1bcGtdO1xuXHRcdCB9XG5cdFx0IGlmKHI8PXBrKSB7XG5cdFx0XHQgYVtzMl1ba10gPSAtYVtzMV1bay0xXS9uZHVbcGsrMV1bcl07XG5cdFx0XHQgZCArPSBhW3MyXVtrXSpuZHVbcl1bcGtdO1xuXHRcdCB9XG5cdFx0IG51cmJzLmRlcml2ZUJhc2lzRnVuY3Nba11bcl0gPSBkO1xuXHRcdCB0ZW1wID1zMTtcblx0XHQgczEgPSBzMjtcblx0XHQgczIgPSB0ZW1wO1x0IFxuXHQgfVxuXHR9XG5cdHIgPSBkZWdyZWU7XG5cdGZvcihrPTE7azw9ZGVyOysraykge1xuXHQgZm9yKGo9MDtqPD1kZWdyZWU7KytqKSBudXJicy5kZXJpdmVCYXNpc0Z1bmNzW2tdW2pdICo9IHI7IFxuXHQgciAqPSAoZGVncmVlLWspO1xuXHR9XG5cdHJldHVybiBudXJicy5kZXJpdmVCYXNpc0Z1bmNzO1xufVxuXG5udXJicy5jaXJjbGVQdCA9IGZ1bmN0aW9uKGNlbixyYWRpdXMpIHtcblxuXHR2YXIgY3J2ID0gbnVyYnMuY3JlYXRlQ3J2KCk7XG5cdGNydi5jb250cm9sUHRzID0gW107XG5cdGNydi5kZWdyZWUgPSAyO1xuXHRjcnYua25vdHMgPSBbMCwwLDAsTWF0aC5QSSowLjUsTWF0aC5QSSowLjUsIE1hdGguUEksIE1hdGguUEksIE1hdGguUEkqMS41LCBNYXRoLlBJKjEuNSwgTWF0aC5QSSoyLCBNYXRoLlBJKjIsTWF0aC5QSSoyXTtcblx0dmFyIFNRUlQyID0gTWF0aC5zcXJ0KDIuMCkqMC41O1xuXHRjcnYuY29udHJvbFB0cyA9IFsgdmVjNC5jcmVhdGUoW2NlblswXStyYWRpdXMsY2VuWzFdLGNlblsyXSwxXSksXG5cdFx0dmVjNC5jcmVhdGUoWyhjZW5bMF0rcmFkaXVzKSpTUVJUMiwoY2VuWzFdK3JhZGl1cykqU1FSVDIsY2VuWzJdKlNRUlQyLFNRUlQyXSksXG5cdFx0dmVjNC5jcmVhdGUoW2NlblswXSxjZW5bMV0rcmFkaXVzLGNlblsyXSwxXSksXG5cdFx0dmVjNC5jcmVhdGUoWyhjZW5bMF0tcmFkaXVzKSpTUVJUMiwoY2VuWzFdK3JhZGl1cykqU1FSVDIsY2VuWzJdKlNRUlQyLFNRUlQyXSksXG5cdFx0dmVjNC5jcmVhdGUoW2NlblswXS1yYWRpdXMsY2VuWzFdLGNlblsyXSwxXSksXG5cdFx0dmVjNC5jcmVhdGUoWyhjZW5bMF0tcmFkaXVzKSpTUVJUMiwoY2VuWzFdLXJhZGl1cykqU1FSVDIsY2VuWzJdKlNRUlQyLFNRUlQyXSksXG5cdFx0dmVjNC5jcmVhdGUoW2NlblswXSxjZW5bMV0tcmFkaXVzLGNlblsyXSwxXSksXG5cdFx0dmVjNC5jcmVhdGUoWyhjZW5bMF0rcmFkaXVzKSpTUVJUMiwoY2VuWzFdLXJhZGl1cykqU1FSVDIsY2VuWzJdKlNRUlQyLFNRUlQyXSksXG5cdFx0dmVjNC5jcmVhdGUoW2NlblswXStyYWRpdXMsY2VuWzFdLGNlblsyXSwxXSkgXTtcblx0cmV0dXJuIGNydjtcbn1cdFxuXG5cbi8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vTlVSQlMgU1VSRkFDRVNcbi8vXG5udXJicy5jcmVhdGVTcmYgPSBmdW5jdGlvbigpIHtcblx0dmFyIHNyZiA9IHt9O1xuXHRzcmYua25vdHNVID0gW107XG5cdHNyZi5rbm90c1YgPSBbXTtcblx0c3JmLmNvbnRyb2xQdHMgPSBbXTtcblx0c3JmLmRlZ3JlZVUgPSBbXTtcblx0c3JmLmRlZ3JlZVYgPSBbXTtcblx0cmV0dXJuIHNyZjtcbn1cblxuXG5udXJicy5ldmFsdWF0ZVNyZiA9IGZ1bmN0aW9uKHNyZix1LHYscHQpIHtcblx0cHQgPSBwdCB8fCB2ZWMzLmNyZWF0ZSgpO1xuXHQvL2lmKGNvbnRyb2xQdHMubGVuZ3RoID09IDApIHJldHVybiBuZXcgUFZlY3RvcigpO1xuXHR2YXIgdUtub3QgPSBudXJicy5maW5kS25vdChzcmYua25vdHNVLHUsc3JmLmRlZ3JlZVUpO1xuXHR2YXIgdktub3QgPSBudXJicy5maW5kS25vdChzcmYua25vdHNWLHYsc3JmLmRlZ3JlZVYpO1xuXHRudXJicy5iYXNpc0Z1bmN0aW9ucyhzcmYua25vdHNVLCBzcmYuZGVncmVlVSwgdUtub3QsdSxudXJicy5iYXNpc0Z1bmNzVSk7XG5cdG51cmJzLmJhc2lzRnVuY3Rpb25zKHNyZi5rbm90c1YsIHNyZi5kZWdyZWVWLCB2S25vdCx2LG51cmJzLmJhc2lzRnVuY3NWKTtcblx0XG5cdHZhciBldmFsUHQgPSB2ZWM0LmNyZWF0ZSgpO1xuXHR2YXIgdGVtcCA9IFtdO1xuXHR2YXIgaSxqO1xuXHQvL2F2b2lkIGNyZWF0ZSBjb21tYW5kc1xuXHRmb3IoaT0wO2k8PXNyZi5kZWdyZWVWOysraSkge1xuXHRcdHRlbXBbaV0gPSB2ZWM0LmNyZWF0ZSgpO1xuXHRcdGZvcihqPTA7ajw9c3JmLmRlZ3JlZVU7KytqKSB7XG5cdFx0XHR2ZWM0LmFkZCh0ZW1wW2ldLHZlYzQuc2NhbGUoc3JmLmNvbnRyb2xQdHNbdUtub3Qtc3JmLmRlZ3JlZVUral1bdktub3Qtc3JmLmRlZ3JlZVYraV0sIG51cmJzLmJhc2lzRnVuY3NVW2pdLGV2YWxQdCkpO1xuXHRcdH1cblx0fVxuXHRcblx0dmVjNC5zZXQoWzAsMCwwLDBdLGV2YWxQdCk7XG5cdGZvcihpPTA7aTw9c3JmLmRlZ3JlZVY7KytpKSB7XG5cdFx0dmVjNC5hZGQoZXZhbFB0LCB2ZWM0LnNjYWxlKHRlbXBbaV0sbnVyYnMuYmFzaXNGdW5jc1ZbaV0pKTtcblx0fVxuXHRyZXR1cm4gdmVjNC5wcm9qZWN0RG93bihldmFsUHQscHQpO1xufVxuXHQvKlxuXG5cdE51cmJzQ3VydmUgaXNvY3VydmUoZmxvYXQgdSwgYm9vbGVhbiBkaXIpIHtcblx0XHRpbnQgdUtub3QgPSBmaW5kS25vdCh1LGtub3RzVSxkZWdyZWVVKTtcblx0XHRmbG9hdFtdIGJhc0Z1bmMgPSBiYXNpc0Z1bmN0aW9ucyh1S25vdCx1LGtub3RzVSxkZWdyZWVVKTtcblx0XHRWZWN0b3I0RFtdW10gaFB0cyA9IG5ldyBWZWN0b3I0RFtkZWdyZWVVKzFdW2RlZ3JlZVYrMV07XG5cdFx0Zm9yKGludCBpPTA7aTxjb250cm9sUHRzLmxlbmd0aDsrK2kpIHtcblx0XHRcdGZvcihpbnQgaj0wO2o8Y29udHJvbFB0c1swXS5sZW5ndGg7KytqKSB7XG5cdFx0XHRcdFBWZWN0b3IgY3RybFB0ID0gY29udHJvbFB0c1tpXVtqXTtcblx0XHRcdFx0ZmxvYXQgdyA9IHdlaWdodHNbaV1bal07XG5cdFx0XHRcdGhQdHNbaV1bal0gPSBuZXcgVmVjdG9yNEQoY3RybFB0LngqdywgY3RybFB0LnkqdyxjdHJsUHQueip3LHcpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRWZWN0b3I0RFtdIG5ld1B0cyA9IG5ldyBWZWN0b3I0RFtjb250cm9sUHRzWzBdLmxlbmd0aF07XG5cdFx0Zm9yKGludCBpPTA7aTxjb250cm9sUHRzWzBdLmxlbmd0aDsrK2kpIHtcblx0XHRcdGZvcihpbnQgaj0wO2o8PWRlZ3JlZVU7KytqKSB7XG5cdFx0XHRcdG5ld1B0c1tpXSA9IFZlY3RvcjRELmFkZChuZXdQdHNbaV0sVmVjdG9yNEQubXVsdGlwbHkoaFB0c1t1S25vdC1kZWdyZWVVK2pdW2ldLCBiYXNGdW5jW2pdKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdFxuXHRcdFBWZWN0b3JbXSBuZXdDUHRzID0gbmV3IFBWZWN0b3JbbmV3UHRzLmxlbmd0aF07XG5cdFx0ZmxvYXRbXSBuZXdXZWlnaHRzID0gbmV3IGZsb2F0W25ld1B0cy5sZW5ndGhdO1xuXHRcdGZvcihpbnQgaT0wO2k8bmV3UHRzLmxlbmd0aDsrK2kpIHtcblx0XHRcdG5ld0NQdHNbaV0gPSBuZXcgUFZlY3RvcihuZXdQdHNbaV0ueCpuZXdQdHNbaV0udyxuZXdQdHNbaV0ueSpuZXdQdHNbaV0udyxuZXdQdHNbaV0ueipuZXdQdHNbaV0udyk7XG5cdFx0XHRuZXdXZWlnaHRzW2ldID0gbmV3UHRzW2ldLnc7XG5cdFx0fVxuXHRcdHJldHVybiBuZXcgTnVyYnNDdXJ2ZShuZXdDUHRzLCBrbm90c1YsIG5ld1dlaWdodHMsIGRlZ3JlZVYpO1xuXHR9XG5cdFxuXHQqL1xuXHRcbm51cmJzLmxvZnQgPSBmdW5jdGlvbihjcnYxLGNydjIpIHtcblx0Ly9kbyBkZWdyZWUgZWxldmF0aW9uXG5cdGlmKGNydjEuZGVncmVlICE9IGNydjIuZGVncmVlKSByZXR1cm4gbnVsbDtcblx0dmFyIHRlbXAxID0gbnVyYnMuY29weUNydihjcnYxKTtcblx0dmFyIHRlbXAyID0gbnVyYnMuY29weUNydihjcnYyKTtcblx0bnVyYnMubm9ybWFsaXplS25vdHModGVtcDEpO1xuXHRudXJicy5ub3JtYWxpemVLbm90cyh0ZW1wMik7XG5cdC8vZmluZCBkaWZmZXJlbmNlXG5cdHZhciBrID0gMCxpO1xuXHR2YXIgaW5zZXJ0VGVtcDEgPSBbXTtcblx0dmFyIGluc2VydFRlbXAyID0gW107XG5cdGZvcihpPTA7aTx0ZW1wMS5rbm90cy5sZW5ndGg7KytpKSB7XG5cdFx0d2hpbGUoayA8IHRlbXAyLmtub3RzLmxlbmd0aCAmJiB0ZW1wMi5rbm90c1trXSA8IHRlbXAxLmtub3RzW2ldICkge1xuXHRcdFx0aW5zZXJ0VGVtcDEucHVzaCh0ZW1wMi5rbm90c1trXSk7XG5cdFx0XHQrK2s7XG5cdFx0fVxuXHRcdGlmKHRlbXAyLmtub3RzW2tdID4gdGVtcDEua25vdHNbaV0pIGluc2VydFRlbXAyLnB1c2godGVtcDEua25vdHNbaV0pO1xuXHRcdGlmKHRlbXAyLmtub3RzW2tdID09IHRlbXAxLmtub3RzW2ldKSArK2s7XG5cdH1cblx0d2hpbGUoazx0ZW1wMi5rbm90cy5sZW5ndGgpIHtcblx0XHRpbnNlcnRUZW1wMS5wdXNoKHRlbXAyLmtub3RzW2tdKTtcblx0XHQrK2s7XG5cdH1cblx0aWYoaW5zZXJ0VGVtcDEubGVuZ3RoID4gMCkgbnVyYnMuaW5zZXJ0S25vdHModGVtcDEsaW5zZXJ0VGVtcDEpO1xuXHRpZihpbnNlcnRUZW1wMi5sZW5ndGggPiAwKSBudXJicy5pbnNlcnRLbm90cyh0ZW1wMixpbnNlcnRUZW1wMik7XG5cdFxuXHR2YXIgcHRzID0gbmV3IEFycmF5KHRlbXAxLmNvbnRyb2xQdHMubGVuZ3RoKTtcblx0Zm9yKGk9MDtpPHB0cy5sZW5ndGg7KytpKSB7XG5cdFx0cHRzW2ldID0gW3RlbXAxLmNvbnRyb2xQdHNbaV0sIHRlbXAyLmNvbnRyb2xQdHNbaV1dO1xuXHR9XG5cdFxuXHR2YXIgdG9SZXR1cm4gPSBudXJicy5jcmVhdGVTcmYoKTtcblx0dG9SZXR1cm4uY29udHJvbFB0cyA9IHB0cztcblx0dG9SZXR1cm4uZGVncmVlVSA9IHRlbXAxLmRlZ3JlZTtcblx0dG9SZXR1cm4uZGVncmVlViA9IDE7XG5cdHRvUmV0dXJuLmtub3RzViA9IFswLDAsMSwxXTsgLy90aGlzIG1pZ2h0IGJlIHdyb25nXG5cdGZvcihpPTA7aTx0ZW1wMS5rbm90cy5sZW5ndGg7KytpKSB7XG5cdFx0dG9SZXR1cm4ua25vdHNVW2ldID0gdGVtcDEua25vdHNbaV07XG5cdH1cblx0cmV0dXJuIHRvUmV0dXJuO1xufVxuXG4vL3Jldm9sdmVcbm51cmJzLnJldm9sdmUgPSBmdW5jdGlvbihjcnYsIGF4aXMpIHtcblxufVxuXG5udXJicy5zd2VlcCA9IGZ1bmN0aW9uKGNydjEsY3J2Mikge1xuXG59IiwiLypcbiAqIFBvbHkyVHJpIENvcHlyaWdodCAoYykgMjAwOS0yMDEzLCBQb2x5MlRyaSBDb250cmlidXRvcnNcbiAqIGh0dHA6Ly9jb2RlLmdvb2dsZS5jb20vcC9wb2x5MnRyaS9cbiAqXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFJlZGlzdHJpYnV0aW9uIGFuZCB1c2UgaW4gc291cmNlIGFuZCBiaW5hcnkgZm9ybXMsIHdpdGggb3Igd2l0aG91dCBtb2RpZmljYXRpb24sXG4gKiBhcmUgcGVybWl0dGVkIHByb3ZpZGVkIHRoYXQgdGhlIGZvbGxvd2luZyBjb25kaXRpb25zIGFyZSBtZXQ6XG4gKlxuICogKiBSZWRpc3RyaWJ1dGlvbnMgb2Ygc291cmNlIGNvZGUgbXVzdCByZXRhaW4gdGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UsXG4gKiAgIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIuXG4gKiAqIFJlZGlzdHJpYnV0aW9ucyBpbiBiaW5hcnkgZm9ybSBtdXN0IHJlcHJvZHVjZSB0aGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSxcbiAqICAgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lciBpbiB0aGUgZG9jdW1lbnRhdGlvblxuICogICBhbmQvb3Igb3RoZXIgbWF0ZXJpYWxzIHByb3ZpZGVkIHdpdGggdGhlIGRpc3RyaWJ1dGlvbi5cbiAqICogTmVpdGhlciB0aGUgbmFtZSBvZiBQb2x5MlRyaSBub3IgdGhlIG5hbWVzIG9mIGl0cyBjb250cmlidXRvcnMgbWF5IGJlXG4gKiAgIHVzZWQgdG8gZW5kb3JzZSBvciBwcm9tb3RlIHByb2R1Y3RzIGRlcml2ZWQgZnJvbSB0aGlzIHNvZnR3YXJlIHdpdGhvdXQgc3BlY2lmaWNcbiAqICAgcHJpb3Igd3JpdHRlbiBwZXJtaXNzaW9uLlxuICpcbiAqIFRISVMgU09GVFdBUkUgSVMgUFJPVklERUQgQlkgVEhFIENPUFlSSUdIVCBIT0xERVJTIEFORCBDT05UUklCVVRPUlNcbiAqIFwiQVMgSVNcIiBBTkQgQU5ZIEVYUFJFU1MgT1IgSU1QTElFRCBXQVJSQU5USUVTLCBJTkNMVURJTkcsIEJVVCBOT1RcbiAqIExJTUlURUQgVE8sIFRIRSBJTVBMSUVEIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZIEFORCBGSVRORVNTIEZPUlxuICogQSBQQVJUSUNVTEFSIFBVUlBPU0UgQVJFIERJU0NMQUlNRUQuIElOIE5PIEVWRU5UIFNIQUxMIFRIRSBDT1BZUklHSFQgT1dORVIgT1JcbiAqIENPTlRSSUJVVE9SUyBCRSBMSUFCTEUgRk9SIEFOWSBESVJFQ1QsIElORElSRUNULCBJTkNJREVOVEFMLCBTUEVDSUFMLFxuICogRVhFTVBMQVJZLCBPUiBDT05TRVFVRU5USUFMIERBTUFHRVMgKElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLFxuICogUFJPQ1VSRU1FTlQgT0YgU1VCU1RJVFVURSBHT09EUyBPUiBTRVJWSUNFUzsgTE9TUyBPRiBVU0UsIERBVEEsIE9SXG4gKiBQUk9GSVRTOyBPUiBCVVNJTkVTUyBJTlRFUlJVUFRJT04pIEhPV0VWRVIgQ0FVU0VEIEFORCBPTiBBTlkgVEhFT1JZIE9GXG4gKiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQ09OVFJBQ1QsIFNUUklDVCBMSUFCSUxJVFksIE9SIFRPUlQgKElOQ0xVRElOR1xuICogTkVHTElHRU5DRSBPUiBPVEhFUldJU0UpIEFSSVNJTkcgSU4gQU5ZIFdBWSBPVVQgT0YgVEhFIFVTRSBPRiBUSElTXG4gKiBTT0ZUV0FSRSwgRVZFTiBJRiBBRFZJU0VEIE9GIFRIRSBQT1NTSUJJTElUWSBPRiBTVUNIIERBTUFHRS5cbiAqL1xuXG4vKiBqc2hpbnQgYnJvd3NlcjpmYWxzZSwgZm9yaW46dHJ1ZSwgbm9hcmc6dHJ1ZSwgbm9lbXB0eTp0cnVlLCBlcWVxZXE6dHJ1ZSwgYml0d2lzZTp0cnVlLCBcbiAgIHN0cmljdDp0cnVlLCB1bmRlZjp0cnVlLCB1bnVzZWQ6dHJ1ZSwgY3VybHk6dHJ1ZSwgaW1tZWQ6dHJ1ZSwgbGF0ZWRlZjp0cnVlLCBcbiAgIG5ld2NhcDp0cnVlLCB0cmFpbGluZzp0cnVlLCBtYXhjb21wbGV4aXR5OjExLCBpbmRlbnQ6NCBcbiAqL1xuXG5cbi8qXG4gKiBOb3RlXG4gKiA9PT09XG4gKiB0aGUgc3RydWN0dXJlIG9mIHRoaXMgSmF2YVNjcmlwdCB2ZXJzaW9uIG9mIHBvbHkydHJpIGludGVudGlvbm5hbHkgZm9sbG93c1xuICogYXMgY2xvc2VseSBhcyBwb3NzaWJsZSB0aGUgc3RydWN0dXJlIG9mIHRoZSByZWZlcmVuY2UgQysrIHZlcnNpb24sIHRvIG1ha2UgaXQgXG4gKiBlYXNpZXIgdG8ga2VlcCB0aGUgMiB2ZXJzaW9ucyBpbiBzeW5jLlxuICovXG5cblxuLyoqXG4gKiBNb2R1bGUgZW5jYXBzdWxhdGlvblxuICogQHBhcmFtIHtPYmplY3R9IGdsb2JhbCBhIHJlZmVyZW5jZSB0byB0aGUgZ2xvYmFsIG9iamVjdCA6XG4gKiAgICAgICAgICAgICAgICAgICAgICB3aW5kb3cgaW4gdGhlIGJyb3dzZXIsIGdsb2JhbCBvbiB0aGUgc2VydmVyXG4gKi9cbihmdW5jdGlvbihnbG9iYWwpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1wb2x5MnRyaSBtb2R1bGVcblxuICAgIC8vIFNhdmUgdGhlIHByZXZpb3VzIHZhbHVlIG9mIHRoZSBwb2x5MnRyaSB2YXJpYWJsZSwgXG4gICAgLy8gc28gdGhhdCBpdCBjYW4gYmUgcmVzdG9yZWQgbGF0ZXIgb24sIGlmIG5vQ29uZmxpY3QgaXMgdXNlZC5cbiAgICBcbiAgICB2YXIgcHJldmlvdXNQb2x5MnRyaSA9IGdsb2JhbC5wb2x5MnRyaTtcblxuICAgIC8vIFRoZSB0b3AtbGV2ZWwgbmFtZXNwYWNlLiBBbGwgcHVibGljIHBvbHkydHJpIGNsYXNzZXMgYW5kIGZ1bmN0aW9ucyB3aWxsXG4gICAgLy8gYmUgYXR0YWNoZWQgdG8gaXQuIEV4cG9ydGVkIGZvciBib3RoIHRoZSBicm93c2VyIGFuZCB0aGUgc2VydmVyIChOb2RlLmpzKS5cbiAgICB2YXIgcG9seTJ0cmk7XG4gICAgLyogZ2xvYmFsIGV4cG9ydHMgKi9cbiAgICBcbiAgICBpZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHBvbHkydHJpID0gZXhwb3J0cztcbiAgICB9IGVsc2Uge1xuICAgICAgICBwb2x5MnRyaSA9IGdsb2JhbC5wb2x5MnRyaSA9IHt9O1xuICAgIH1cblxuICAgIC8vIFJ1bnMgdGhlIGxpYnJhcnkgaW4gbm9Db25mbGljdCBtb2RlLCByZXR1cm5pbmcgdGhlIHBvbHkydHJpIHZhcmlhYmxlIFxuICAgIC8vIHRvIGl0cyBwcmV2aW91cyBvd25lci4gUmV0dXJucyBhIHJlZmVyZW5jZSB0byB0aGlzIGxpYnJhcnkgb2JqZWN0LlxuICAgIHBvbHkydHJpLm5vQ29uZmxpY3QgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgZ2xvYmFsLnBvbHkydHJpID0gcHJldmlvdXNQb2x5MnRyaTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVBvaW50RXJyb3JcblxuICAgIC8qKlxuICAgICAqIEN1c3RvbSBleGNlcHRpb24gY2xhc3MgdG8gaW5kaWNhdGUgaW52YWxpZCBQb2ludCB2YWx1ZXNcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZSAgICAgICAgICBlcnJvciBtZXNzYWdlXG4gICAgICogQHBhcmFtIHthcnJheTxQb2ludD59IHBvaW50cyAgICAgaW52YWxpZCBwb2ludHNcbiAgICAgKi9cbiAgICAvLyBDbGFzcyBhZGRlZCBpbiB0aGUgSmF2YVNjcmlwdCB2ZXJzaW9uICh3YXMgbm90IHByZXNlbnQgaW4gdGhlIGMrKyB2ZXJzaW9uKVxuICAgIHZhciBQb2ludEVycm9yID0gZnVuY3Rpb24gKG1lc3NhZ2UsIHBvaW50cykge1xuICAgICAgICB0aGlzLm5hbWUgICAgPSBcIlBvaW50RXJyb3JcIjtcbiAgICAgICAgdGhpcy5wb2ludHMgID0gcG9pbnRzID0gcG9pbnRzIHx8IFtdO1xuICAgICAgICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlIHx8IFwiSW52YWxpZCBQb2ludHMhXCI7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcG9pbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLm1lc3NhZ2UgKz0gXCIgXCIgKyBQb2ludC50b1N0cmluZyhwb2ludHNbaV0pO1xuICAgICAgICB9XG4gICAgfTtcbiAgICBQb2ludEVycm9yLnByb3RvdHlwZSA9IG5ldyBFcnJvcigpO1xuICAgIFBvaW50RXJyb3IucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gUG9pbnRFcnJvcjtcblxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1Qb2ludFxuICAgIC8qKlxuICAgICAqIENvbnN0cnVjdCBhIHBvaW50XG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHggICAgY29vcmRpbmF0ZSAoMCBpZiB1bmRlZmluZWQpXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHkgICAgY29vcmRpbmF0ZSAoMCBpZiB1bmRlZmluZWQpXG4gICAgICovXG4gICAgdmFyIFBvaW50ID0gZnVuY3Rpb24oeCwgeSkge1xuICAgICAgICB0aGlzLnggPSAreCB8fCAwO1xuICAgICAgICB0aGlzLnkgPSAreSB8fCAwO1xuXG4gICAgICAgIC8vIEFsbCBleHRyYSBmaWVsZHMgYWRkZWQgdG8gUG9pbnQgYXJlIHByZWZpeGVkIHdpdGggX3AydF9cbiAgICAgICAgLy8gdG8gYXZvaWQgY29sbGlzaW9ucyBpZiBjdXN0b20gUG9pbnQgY2xhc3MgaXMgdXNlZC5cblxuICAgICAgICAvLyBUaGUgZWRnZXMgdGhpcyBwb2ludCBjb25zdGl0dXRlcyBhbiB1cHBlciBlbmRpbmcgcG9pbnRcbiAgICAgICAgdGhpcy5fcDJ0X2VkZ2VfbGlzdCA9IG51bGw7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEZvciBwcmV0dHkgcHJpbnRpbmcgZXguIDxpPlwiKDU7NDIpXCI8L2k+KVxuICAgICAqL1xuICAgIFBvaW50LnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKFwiKFwiICsgdGhpcy54ICsgXCI7XCIgKyB0aGlzLnkgKyBcIilcIik7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBjb3B5IG9mIHRoaXMgUG9pbnQgb2JqZWN0LlxuICAgICAqIEByZXR1cm5zIFBvaW50XG4gICAgICovXG4gICAgUG9pbnQucHJvdG90eXBlLmNsb25lID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBuZXcgUG9pbnQodGhpcy54LCB0aGlzLnkpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhpcyBQb2ludCBpbnN0YW5jZSB0byB0aGUgb3JpZ28uIDxjb2RlPigwOyAwKTwvY29kZT5cbiAgICAgKi9cbiAgICBQb2ludC5wcm90b3R5cGUuc2V0X3plcm8gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy54ID0gMC4wO1xuICAgICAgICB0aGlzLnkgPSAwLjA7XG4gICAgICAgIHJldHVybiB0aGlzOyAvLyBmb3IgY2hhaW5pbmdcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBjb29yZGluYXRlcyBvZiB0aGlzIGluc3RhbmNlLlxuICAgICAqIEBwYXJhbSAgIHggICBudW1iZXIuXG4gICAgICogQHBhcmFtICAgeSAgIG51bWJlcjtcbiAgICAgKi9cbiAgICBQb2ludC5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24oeCwgeSkge1xuICAgICAgICB0aGlzLnggPSAreCB8fCAwO1xuICAgICAgICB0aGlzLnkgPSAreSB8fCAwO1xuICAgICAgICByZXR1cm4gdGhpczsgLy8gZm9yIGNoYWluaW5nXG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIE5lZ2F0ZSB0aGlzIFBvaW50IGluc3RhbmNlLiAoY29tcG9uZW50LXdpc2UpXG4gICAgICovXG4gICAgUG9pbnQucHJvdG90eXBlLm5lZ2F0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLnggPSAtdGhpcy54O1xuICAgICAgICB0aGlzLnkgPSAtdGhpcy55O1xuICAgICAgICByZXR1cm4gdGhpczsgLy8gZm9yIGNoYWluaW5nXG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEFkZCBhbm90aGVyIFBvaW50IG9iamVjdCB0byB0aGlzIGluc3RhbmNlLiAoY29tcG9uZW50LXdpc2UpXG4gICAgICogQHBhcmFtICAgbiAgIFBvaW50IG9iamVjdC5cbiAgICAgKi9cbiAgICBQb2ludC5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24obikge1xuICAgICAgICB0aGlzLnggKz0gbi54O1xuICAgICAgICB0aGlzLnkgKz0gbi55O1xuICAgICAgICByZXR1cm4gdGhpczsgLy8gZm9yIGNoYWluaW5nXG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFN1YnRyYWN0IHRoaXMgUG9pbnQgaW5zdGFuY2Ugd2l0aCBhbm90aGVyIHBvaW50IGdpdmVuLiAoY29tcG9uZW50LXdpc2UpXG4gICAgICogQHBhcmFtICAgbiAgIFBvaW50IG9iamVjdC5cbiAgICAgKi9cbiAgICBQb2ludC5wcm90b3R5cGUuc3ViID0gZnVuY3Rpb24obikge1xuICAgICAgICB0aGlzLnggLT0gbi54O1xuICAgICAgICB0aGlzLnkgLT0gbi55O1xuICAgICAgICByZXR1cm4gdGhpczsgLy8gZm9yIGNoYWluaW5nXG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIE11bHRpcGx5IHRoaXMgUG9pbnQgaW5zdGFuY2UgYnkgYSBzY2FsYXIuIChjb21wb25lbnQtd2lzZSlcbiAgICAgKiBAcGFyYW0gICBzICAgc2NhbGFyLlxuICAgICAqL1xuICAgIFBvaW50LnByb3RvdHlwZS5tdWwgPSBmdW5jdGlvbihzKSB7XG4gICAgICAgIHRoaXMueCAqPSBzO1xuICAgICAgICB0aGlzLnkgKj0gcztcbiAgICAgICAgcmV0dXJuIHRoaXM7IC8vIGZvciBjaGFpbmluZ1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm4gdGhlIGRpc3RhbmNlIG9mIHRoaXMgUG9pbnQgaW5zdGFuY2UgZnJvbSB0aGUgb3JpZ28uXG4gICAgICovXG4gICAgUG9pbnQucHJvdG90eXBlLmxlbmd0aCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gTWF0aC5zcXJ0KHRoaXMueCAqIHRoaXMueCArIHRoaXMueSAqIHRoaXMueSk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIE5vcm1hbGl6ZSB0aGlzIFBvaW50IGluc3RhbmNlIChhcyBhIHZlY3RvcikuXG4gICAgICogQHJldHVybiBUaGUgb3JpZ2luYWwgZGlzdGFuY2Ugb2YgdGhpcyBpbnN0YW5jZSBmcm9tIHRoZSBvcmlnby5cbiAgICAgKi9cbiAgICBQb2ludC5wcm90b3R5cGUubm9ybWFsaXplID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBsZW4gPSB0aGlzLmxlbmd0aCgpO1xuICAgICAgICB0aGlzLnggLz0gbGVuO1xuICAgICAgICB0aGlzLnkgLz0gbGVuO1xuICAgICAgICByZXR1cm4gbGVuO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBUZXN0IHRoaXMgUG9pbnQgb2JqZWN0IHdpdGggYW5vdGhlciBmb3IgZXF1YWxpdHkuXG4gICAgICogQHBhcmFtICAgcCAgIGFueSBcIlBvaW50IGxpa2VcIiBvYmplY3Qgd2l0aCB7eCx5fSAoZHVjayB0eXBpbmcpXG4gICAgICogQHJldHVybiA8Y29kZT5UcnVlPC9jb2RlPiBpZiA8Y29kZT50aGlzID09IHA8L2NvZGU+LCA8Y29kZT5mYWxzZTwvY29kZT4gb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIFBvaW50LnByb3RvdHlwZS5lcXVhbHMgPSBmdW5jdGlvbihwKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnggPT09IHAueCAmJiB0aGlzLnkgPT09IHAueTtcbiAgICB9O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVBvaW50IChcInN0YXRpY1wiIG1ldGhvZHMpXG5cbiAgICAvKipcbiAgICAgKiBOZWdhdGUgYSBwb2ludCBjb21wb25lbnQtd2lzZSBhbmQgcmV0dXJuIHRoZSByZXN1bHQgYXMgYSBuZXcgUG9pbnQgb2JqZWN0LlxuICAgICAqIEBwYXJhbSAgIHAgICBQb2ludCBvYmplY3QuXG4gICAgICogQHJldHVybiB0aGUgcmVzdWx0aW5nIFBvaW50IG9iamVjdC5cbiAgICAgKi9cbiAgICBQb2ludC5uZWdhdGUgPSBmdW5jdGlvbihwKSB7XG4gICAgICAgIHJldHVybiBuZXcgUG9pbnQoLXAueCwgLXAueSk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEFkZCB0d28gcG9pbnRzIGNvbXBvbmVudC13aXNlIGFuZCByZXR1cm4gdGhlIHJlc3VsdCBhcyBhIG5ldyBQb2ludCBvYmplY3QuXG4gICAgICogQHBhcmFtICAgYSAgIFBvaW50IG9iamVjdC5cbiAgICAgKiBAcGFyYW0gICBiICAgUG9pbnQgb2JqZWN0LlxuICAgICAqIEByZXR1cm4gdGhlIHJlc3VsdGluZyBQb2ludCBvYmplY3QuXG4gICAgICovXG4gICAgUG9pbnQuYWRkID0gZnVuY3Rpb24oYSwgYikge1xuICAgICAgICByZXR1cm4gbmV3IFBvaW50KGEueCArIGIueCwgYS55ICsgYi55KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogU3VidHJhY3QgdHdvIHBvaW50cyBjb21wb25lbnQtd2lzZSBhbmQgcmV0dXJuIHRoZSByZXN1bHQgYXMgYSBuZXcgUG9pbnQgb2JqZWN0LlxuICAgICAqIEBwYXJhbSAgIGEgICBQb2ludCBvYmplY3QuXG4gICAgICogQHBhcmFtICAgYiAgIFBvaW50IG9iamVjdC5cbiAgICAgKiBAcmV0dXJuIHRoZSByZXN1bHRpbmcgUG9pbnQgb2JqZWN0LlxuICAgICAqL1xuICAgIFBvaW50LnN1YiA9IGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQb2ludChhLnggLSBiLngsIGEueSAtIGIueSk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIE11bHRpcGx5IGEgcG9pbnQgYnkgYSBzY2FsYXIgYW5kIHJldHVybiB0aGUgcmVzdWx0IGFzIGEgbmV3IFBvaW50IG9iamVjdC5cbiAgICAgKiBAcGFyYW0gICBzICAgdGhlIHNjYWxhciAoYSBudW1iZXIpLlxuICAgICAqIEBwYXJhbSAgIHAgICBQb2ludCBvYmplY3QuXG4gICAgICogQHJldHVybiB0aGUgcmVzdWx0aW5nIFBvaW50IG9iamVjdC5cbiAgICAgKi9cbiAgICBQb2ludC5tdWwgPSBmdW5jdGlvbihzLCBwKSB7XG4gICAgICAgIHJldHVybiBuZXcgUG9pbnQocyAqIHAueCwgcyAqIHAueSk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFBlcmZvcm0gdGhlIGNyb3NzIHByb2R1Y3Qgb24gZWl0aGVyIHR3byBwb2ludHMgKHRoaXMgcHJvZHVjZXMgYSBzY2FsYXIpXG4gICAgICogb3IgYSBwb2ludCBhbmQgYSBzY2FsYXIgKHRoaXMgcHJvZHVjZXMgYSBwb2ludCkuXG4gICAgICogVGhpcyBmdW5jdGlvbiByZXF1aXJlcyB0d28gcGFyYW1ldGVycywgZWl0aGVyIG1heSBiZSBhIFBvaW50IG9iamVjdCBvciBhXG4gICAgICogbnVtYmVyLlxuICAgICAqIEBwYXJhbSAgIGEgICBQb2ludCBvYmplY3Qgb3Igc2NhbGFyLlxuICAgICAqIEBwYXJhbSAgIGIgICBQb2ludCBvYmplY3Qgb3Igc2NhbGFyLlxuICAgICAqIEByZXR1cm4gIGEgICBQb2ludCBvYmplY3Qgb3IgYSBudW1iZXIsIGRlcGVuZGluZyBvbiB0aGUgcGFyYW1ldGVycy5cbiAgICAgKi9cbiAgICBQb2ludC5jcm9zcyA9IGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgICAgaWYgKHR5cGVvZihhKSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YoYikgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGEgKiBiO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFBvaW50KC1hICogYi55LCBhICogYi54KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YoYikgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBQb2ludChiICogYS55LCAtYiAqIGEueCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBhLnggKiBiLnkgLSBhLnkgKiBiLng7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXCJQb2ludC1MaWtlXCJcbiAgICAvKlxuICAgICAqIFRoZSBmb2xsb3dpbmcgZnVuY3Rpb25zIG9wZXJhdGUgb24gXCJQb2ludFwiIG9yIGFueSBcIlBvaW50IGxpa2VcIiBvYmplY3QgXG4gICAgICogd2l0aCB7eCx5fSAoZHVjayB0eXBpbmcpLlxuICAgICAqL1xuXG5cbiAgICAvKipcbiAgICAgKiBQb2ludCBwcmV0dHkgcHJpbnRpbmcgZXguIDxpPlwiKDU7NDIpXCI8L2k+KVxuICAgICAqIEBwYXJhbSAgIHAgICBhbnkgXCJQb2ludCBsaWtlXCIgb2JqZWN0IHdpdGgge3gseX0gXG4gICAgICogQHJldHVybnMge1N0cmluZ31cbiAgICAgKi9cbiAgICBQb2ludC50b1N0cmluZyA9IGZ1bmN0aW9uKHApIHtcbiAgICAgICAgLy8gVHJ5IGEgY3VzdG9tIHRvU3RyaW5nIGZpcnN0LCBhbmQgZmFsbGJhY2sgdG8gUG9pbnQucHJvdG90eXBlLnRvU3RyaW5nIGlmIG5vbmVcbiAgICAgICAgdmFyIHMgPSBwLnRvU3RyaW5nKCk7XG4gICAgICAgIHJldHVybiAocyA9PT0gJ1tvYmplY3QgT2JqZWN0XScgPyBQb2ludC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChwKSA6IHMpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBDb21wYXJlIHR3byBwb2ludHMgY29tcG9uZW50LXdpc2UuXG4gICAgICogQHBhcmFtICAgYSxiICAgYW55IFwiUG9pbnQgbGlrZVwiIG9iamVjdHMgd2l0aCB7eCx5fSBcbiAgICAgKiBAcmV0dXJuIDxjb2RlPiZsdDsgMDwvY29kZT4gaWYgPGNvZGU+YSAmbHQ7IGI8L2NvZGU+LCBcbiAgICAgKiAgICAgICAgIDxjb2RlPiZndDsgMDwvY29kZT4gaWYgPGNvZGU+YSAmZ3Q7IGI8L2NvZGU+LCBcbiAgICAgKiAgICAgICAgIDxjb2RlPjA8L2NvZGU+IG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBQb2ludC5jb21wYXJlID0gZnVuY3Rpb24oYSwgYikge1xuICAgICAgICBpZiAoYS55ID09PSBiLnkpIHtcbiAgICAgICAgICAgIHJldHVybiBhLnggLSBiLng7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gYS55IC0gYi55O1xuICAgICAgICB9XG4gICAgfTtcbiAgICBQb2ludC5jbXAgPSBQb2ludC5jb21wYXJlOyAvLyBiYWNrd2FyZCBjb21wYXRpYmlsaXR5XG5cbiAgICAvKipcbiAgICAgKiBUZXN0IHR3byBQb2ludCBvYmplY3RzIGZvciBlcXVhbGl0eS5cbiAgICAgKiBAcGFyYW0gICBhLGIgICBhbnkgXCJQb2ludCBsaWtlXCIgb2JqZWN0cyB3aXRoIHt4LHl9IFxuICAgICAqIEByZXR1cm4gPGNvZGU+VHJ1ZTwvY29kZT4gaWYgPGNvZGU+YSA9PSBiPC9jb2RlPiwgPGNvZGU+ZmFsc2U8L2NvZGU+IG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBQb2ludC5lcXVhbHMgPSBmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgIHJldHVybiBhLnggPT09IGIueCAmJiBhLnkgPT09IGIueTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogUGVmb3JtIHRoZSBkb3QgcHJvZHVjdCBvbiB0d28gdmVjdG9ycy5cbiAgICAgKiBAcGFyYW0gICBhLGIgICBhbnkgXCJQb2ludCBsaWtlXCIgb2JqZWN0cyB3aXRoIHt4LHl9IFxuICAgICAqIEByZXR1cm4gVGhlIGRvdCBwcm9kdWN0IChhcyBhIG51bWJlcikuXG4gICAgICovXG4gICAgUG9pbnQuZG90ID0gZnVuY3Rpb24oYSwgYikge1xuICAgICAgICByZXR1cm4gYS54ICogYi54ICsgYS55ICogYi55O1xuICAgIH07XG5cblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLUVkZ2VcbiAgICAvKipcbiAgICAgKiBSZXByZXNlbnRzIGEgc2ltcGxlIHBvbHlnb24ncyBlZGdlXG4gICAgICogQHBhcmFtIHtQb2ludH0gcDFcbiAgICAgKiBAcGFyYW0ge1BvaW50fSBwMlxuICAgICAqL1xuICAgIHZhciBFZGdlID0gZnVuY3Rpb24ocDEsIHAyKSB7XG4gICAgICAgIHRoaXMucCA9IHAxO1xuICAgICAgICB0aGlzLnEgPSBwMjtcblxuICAgICAgICBpZiAocDEueSA+IHAyLnkpIHtcbiAgICAgICAgICAgIHRoaXMucSA9IHAxO1xuICAgICAgICAgICAgdGhpcy5wID0gcDI7XG4gICAgICAgIH0gZWxzZSBpZiAocDEueSA9PT0gcDIueSkge1xuICAgICAgICAgICAgaWYgKHAxLnggPiBwMi54KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5xID0gcDE7XG4gICAgICAgICAgICAgICAgdGhpcy5wID0gcDI7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHAxLnggPT09IHAyLngpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUG9pbnRFcnJvcigncG9seTJ0cmkgSW52YWxpZCBFZGdlIGNvbnN0cnVjdG9yOiByZXBlYXRlZCBwb2ludHMhJywgW3AxXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoISB0aGlzLnEuX3AydF9lZGdlX2xpc3QpIHtcbiAgICAgICAgICAgIHRoaXMucS5fcDJ0X2VkZ2VfbGlzdCA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMucS5fcDJ0X2VkZ2VfbGlzdC5wdXNoKHRoaXMpO1xuICAgIH07XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVRyaWFuZ2xlXG4gICAgLyoqXG4gICAgICogVHJpYW5nbGUgY2xhc3MuPGJyPlxuICAgICAqIFRyaWFuZ2xlLWJhc2VkIGRhdGEgc3RydWN0dXJlcyBhcmUga25vd24gdG8gaGF2ZSBiZXR0ZXIgcGVyZm9ybWFuY2UgdGhhblxuICAgICAqIHF1YWQtZWRnZSBzdHJ1Y3R1cmVzLlxuICAgICAqIFNlZTogSi4gU2hld2NodWssIFwiVHJpYW5nbGU6IEVuZ2luZWVyaW5nIGEgMkQgUXVhbGl0eSBNZXNoIEdlbmVyYXRvciBhbmRcbiAgICAgKiBEZWxhdW5heSBUcmlhbmd1bGF0b3JcIiwgXCJUcmlhbmd1bGF0aW9ucyBpbiBDR0FMXCJcbiAgICAgKiBcbiAgICAgKiBAcGFyYW0gICBhLGIsYyAgIGFueSBcIlBvaW50IGxpa2VcIiBvYmplY3RzIHdpdGgge3gseX0gKGR1Y2sgdHlwaW5nKVxuICAgICAqL1xuICAgIHZhciBUcmlhbmdsZSA9IGZ1bmN0aW9uKGEsIGIsIGMpIHtcbiAgICAgICAgLy8gVHJpYW5nbGUgcG9pbnRzXG4gICAgICAgIHRoaXMucG9pbnRzXyA9IFthLCBiLCBjXTtcbiAgICAgICAgLy8gTmVpZ2hib3IgbGlzdFxuICAgICAgICB0aGlzLm5laWdoYm9yc18gPSBbbnVsbCwgbnVsbCwgbnVsbF07XG4gICAgICAgIC8vIEhhcyB0aGlzIHRyaWFuZ2xlIGJlZW4gbWFya2VkIGFzIGFuIGludGVyaW9yIHRyaWFuZ2xlP1xuICAgICAgICB0aGlzLmludGVyaW9yXyA9IGZhbHNlO1xuICAgICAgICAvLyBGbGFncyB0byBkZXRlcm1pbmUgaWYgYW4gZWRnZSBpcyBhIENvbnN0cmFpbmVkIGVkZ2VcbiAgICAgICAgdGhpcy5jb25zdHJhaW5lZF9lZGdlID0gW2ZhbHNlLCBmYWxzZSwgZmFsc2VdO1xuICAgICAgICAvLyBGbGFncyB0byBkZXRlcm1pbmUgaWYgYW4gZWRnZSBpcyBhIERlbGF1bmV5IGVkZ2VcbiAgICAgICAgdGhpcy5kZWxhdW5heV9lZGdlID0gW2ZhbHNlLCBmYWxzZSwgZmFsc2VdO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBGb3IgcHJldHR5IHByaW50aW5nIGV4LiA8aT5cIlsoNTs0MikoMTA7MjApKDIxOzMwKV1cIjwvaT4pXG4gICAgICovXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBwMnMgPSBQb2ludC50b1N0cmluZztcbiAgICAgICAgcmV0dXJuIChcIltcIiArIHAycyh0aGlzLnBvaW50c19bMF0pICsgcDJzKHRoaXMucG9pbnRzX1sxXSkgKyBwMnModGhpcy5wb2ludHNfWzJdKSArIFwiXVwiKTtcbiAgICB9O1xuXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLmdldFBvaW50ID0gZnVuY3Rpb24oaW5kZXgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucG9pbnRzX1tpbmRleF07XG4gICAgfTtcbiAgICAvLyBmb3IgYmFja3dhcmQgY29tcGF0aWJpbGl0eVxuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5HZXRQb2ludCA9IFRyaWFuZ2xlLnByb3RvdHlwZS5nZXRQb2ludDtcblxuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5nZXROZWlnaGJvciA9IGZ1bmN0aW9uKGluZGV4KSB7XG4gICAgICAgIHJldHVybiB0aGlzLm5laWdoYm9yc19baW5kZXhdO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBUZXN0IGlmIHRoaXMgVHJpYW5nbGUgY29udGFpbnMgdGhlIFBvaW50IG9iamVjdCBnaXZlbiBhcyBwYXJhbWV0ZXJzIGFzIGl0c1xuICAgICAqIHZlcnRpY2VzLiBPbmx5IHBvaW50IHJlZmVyZW5jZXMgYXJlIGNvbXBhcmVkLCBub3QgdmFsdWVzLlxuICAgICAqIEByZXR1cm4gPGNvZGU+VHJ1ZTwvY29kZT4gaWYgdGhlIFBvaW50IG9iamVjdCBpcyBvZiB0aGUgVHJpYW5nbGUncyB2ZXJ0aWNlcyxcbiAgICAgKiAgICAgICAgIDxjb2RlPmZhbHNlPC9jb2RlPiBvdGhlcndpc2UuXG4gICAgICovXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLmNvbnRhaW5zUG9pbnQgPSBmdW5jdGlvbihwb2ludCkge1xuICAgICAgICB2YXIgcG9pbnRzID0gdGhpcy5wb2ludHNfO1xuICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlc1xuICAgICAgICByZXR1cm4gKHBvaW50ID09PSBwb2ludHNbMF0gfHwgcG9pbnQgPT09IHBvaW50c1sxXSB8fCBwb2ludCA9PT0gcG9pbnRzWzJdKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogVGVzdCBpZiB0aGlzIFRyaWFuZ2xlIGNvbnRhaW5zIHRoZSBFZGdlIG9iamVjdCBnaXZlbiBhcyBwYXJhbWV0ZXIgYXMgaXRzXG4gICAgICogYm91bmRpbmcgZWRnZXMuIE9ubHkgcG9pbnQgcmVmZXJlbmNlcyBhcmUgY29tcGFyZWQsIG5vdCB2YWx1ZXMuXG4gICAgICogQHJldHVybiA8Y29kZT5UcnVlPC9jb2RlPiBpZiB0aGUgRWRnZSBvYmplY3QgaXMgb2YgdGhlIFRyaWFuZ2xlJ3MgYm91bmRpbmdcbiAgICAgKiAgICAgICAgIGVkZ2VzLCA8Y29kZT5mYWxzZTwvY29kZT4gb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5jb250YWluc0VkZ2UgPSBmdW5jdGlvbihlZGdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNvbnRhaW5zUG9pbnQoZWRnZS5wKSAmJiB0aGlzLmNvbnRhaW5zUG9pbnQoZWRnZS5xKTtcbiAgICB9O1xuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5jb250YWluc1BvaW50cyA9IGZ1bmN0aW9uKHAxLCBwMikge1xuICAgICAgICByZXR1cm4gdGhpcy5jb250YWluc1BvaW50KHAxKSAmJiB0aGlzLmNvbnRhaW5zUG9pbnQocDIpO1xuICAgIH07XG5cblxuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5pc0ludGVyaW9yID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmludGVyaW9yXztcbiAgICB9O1xuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5zZXRJbnRlcmlvciA9IGZ1bmN0aW9uKGludGVyaW9yKSB7XG4gICAgICAgIHRoaXMuaW50ZXJpb3JfID0gaW50ZXJpb3I7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGUgbmVpZ2hib3IgcG9pbnRlcnMuXG4gICAgICogQHBhcmFtIHtQb2ludH0gcDEgUG9pbnQgb2JqZWN0LlxuICAgICAqIEBwYXJhbSB7UG9pbnR9IHAyIFBvaW50IG9iamVjdC5cbiAgICAgKiBAcGFyYW0ge1RyaWFuZ2xlfSB0IFRyaWFuZ2xlIG9iamVjdC5cbiAgICAgKi9cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUubWFya05laWdoYm9yUG9pbnRlcnMgPSBmdW5jdGlvbihwMSwgcDIsIHQpIHtcbiAgICAgICAgdmFyIHBvaW50cyA9IHRoaXMucG9pbnRzXztcbiAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcbiAgICAgICAgaWYgKChwMSA9PT0gcG9pbnRzWzJdICYmIHAyID09PSBwb2ludHNbMV0pIHx8IChwMSA9PT0gcG9pbnRzWzFdICYmIHAyID09PSBwb2ludHNbMl0pKSB7XG4gICAgICAgICAgICB0aGlzLm5laWdoYm9yc19bMF0gPSB0O1xuICAgICAgICB9IGVsc2UgaWYgKChwMSA9PT0gcG9pbnRzWzBdICYmIHAyID09PSBwb2ludHNbMl0pIHx8IChwMSA9PT0gcG9pbnRzWzJdICYmIHAyID09PSBwb2ludHNbMF0pKSB7XG4gICAgICAgICAgICB0aGlzLm5laWdoYm9yc19bMV0gPSB0O1xuICAgICAgICB9IGVsc2UgaWYgKChwMSA9PT0gcG9pbnRzWzBdICYmIHAyID09PSBwb2ludHNbMV0pIHx8IChwMSA9PT0gcG9pbnRzWzFdICYmIHAyID09PSBwb2ludHNbMF0pKSB7XG4gICAgICAgICAgICB0aGlzLm5laWdoYm9yc19bMl0gPSB0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdwb2x5MnRyaSBJbnZhbGlkIFRyaWFuZ2xlLm1hcmtOZWlnaGJvclBvaW50ZXJzKCkgY2FsbCcpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEV4aGF1c3RpdmUgc2VhcmNoIHRvIHVwZGF0ZSBuZWlnaGJvciBwb2ludGVyc1xuICAgICAqIEBwYXJhbSB7VHJpYW5nbGV9IHRcbiAgICAgKi9cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUubWFya05laWdoYm9yID0gZnVuY3Rpb24odCkge1xuICAgICAgICB2YXIgcG9pbnRzID0gdGhpcy5wb2ludHNfO1xuICAgICAgICBpZiAodC5jb250YWluc1BvaW50cyhwb2ludHNbMV0sIHBvaW50c1syXSkpIHtcbiAgICAgICAgICAgIHRoaXMubmVpZ2hib3JzX1swXSA9IHQ7XG4gICAgICAgICAgICB0Lm1hcmtOZWlnaGJvclBvaW50ZXJzKHBvaW50c1sxXSwgcG9pbnRzWzJdLCB0aGlzKTtcbiAgICAgICAgfSBlbHNlIGlmICh0LmNvbnRhaW5zUG9pbnRzKHBvaW50c1swXSwgcG9pbnRzWzJdKSkge1xuICAgICAgICAgICAgdGhpcy5uZWlnaGJvcnNfWzFdID0gdDtcbiAgICAgICAgICAgIHQubWFya05laWdoYm9yUG9pbnRlcnMocG9pbnRzWzBdLCBwb2ludHNbMl0sIHRoaXMpO1xuICAgICAgICB9IGVsc2UgaWYgKHQuY29udGFpbnNQb2ludHMocG9pbnRzWzBdLCBwb2ludHNbMV0pKSB7XG4gICAgICAgICAgICB0aGlzLm5laWdoYm9yc19bMl0gPSB0O1xuICAgICAgICAgICAgdC5tYXJrTmVpZ2hib3JQb2ludGVycyhwb2ludHNbMF0sIHBvaW50c1sxXSwgdGhpcyk7XG4gICAgICAgIH1cbiAgICB9O1xuXG5cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuY2xlYXJOZWlnYm9ycyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLm5laWdoYm9yc19bMF0gPSBudWxsO1xuICAgICAgICB0aGlzLm5laWdoYm9yc19bMV0gPSBudWxsO1xuICAgICAgICB0aGlzLm5laWdoYm9yc19bMl0gPSBudWxsO1xuICAgIH07XG5cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuY2xlYXJEZWx1bmF5RWRnZXMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5kZWxhdW5heV9lZGdlWzBdID0gZmFsc2U7XG4gICAgICAgIHRoaXMuZGVsYXVuYXlfZWRnZVsxXSA9IGZhbHNlO1xuICAgICAgICB0aGlzLmRlbGF1bmF5X2VkZ2VbMl0gPSBmYWxzZTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgcG9pbnQgY2xvY2t3aXNlIHRvIHRoZSBnaXZlbiBwb2ludC5cbiAgICAgKi9cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUucG9pbnRDVyA9IGZ1bmN0aW9uKHApIHtcbiAgICAgICAgdmFyIHBvaW50cyA9IHRoaXMucG9pbnRzXztcbiAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcbiAgICAgICAgaWYgKHAgPT09IHBvaW50c1swXSkge1xuICAgICAgICAgICAgcmV0dXJuIHBvaW50c1syXTtcbiAgICAgICAgfSBlbHNlIGlmIChwID09PSBwb2ludHNbMV0pIHtcbiAgICAgICAgICAgIHJldHVybiBwb2ludHNbMF07XG4gICAgICAgIH0gZWxzZSBpZiAocCA9PT0gcG9pbnRzWzJdKSB7XG4gICAgICAgICAgICByZXR1cm4gcG9pbnRzWzFdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgcG9pbnQgY291bnRlci1jbG9ja3dpc2UgdG8gdGhlIGdpdmVuIHBvaW50LlxuICAgICAqL1xuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5wb2ludENDVyA9IGZ1bmN0aW9uKHApIHtcbiAgICAgICAgdmFyIHBvaW50cyA9IHRoaXMucG9pbnRzXztcbiAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcbiAgICAgICAgaWYgKHAgPT09IHBvaW50c1swXSkge1xuICAgICAgICAgICAgcmV0dXJuIHBvaW50c1sxXTtcbiAgICAgICAgfSBlbHNlIGlmIChwID09PSBwb2ludHNbMV0pIHtcbiAgICAgICAgICAgIHJldHVybiBwb2ludHNbMl07XG4gICAgICAgIH0gZWxzZSBpZiAocCA9PT0gcG9pbnRzWzJdKSB7XG4gICAgICAgICAgICByZXR1cm4gcG9pbnRzWzBdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgbmVpZ2hib3IgY2xvY2t3aXNlIHRvIGdpdmVuIHBvaW50LlxuICAgICAqL1xuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5uZWlnaGJvckNXID0gZnVuY3Rpb24ocCkge1xuICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlc1xuICAgICAgICBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzBdKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5uZWlnaGJvcnNfWzFdO1xuICAgICAgICB9IGVsc2UgaWYgKHAgPT09IHRoaXMucG9pbnRzX1sxXSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubmVpZ2hib3JzX1syXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm5laWdoYm9yc19bMF07XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgbmVpZ2hib3IgY291bnRlci1jbG9ja3dpc2UgdG8gZ2l2ZW4gcG9pbnQuXG4gICAgICovXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLm5laWdoYm9yQ0NXID0gZnVuY3Rpb24ocCkge1xuICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlc1xuICAgICAgICBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzBdKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5uZWlnaGJvcnNfWzJdO1xuICAgICAgICB9IGVsc2UgaWYgKHAgPT09IHRoaXMucG9pbnRzX1sxXSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubmVpZ2hib3JzX1swXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm5laWdoYm9yc19bMV07XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLmdldENvbnN0cmFpbmVkRWRnZUNXID0gZnVuY3Rpb24ocCkge1xuICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlc1xuICAgICAgICBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzBdKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jb25zdHJhaW5lZF9lZGdlWzFdO1xuICAgICAgICB9IGVsc2UgaWYgKHAgPT09IHRoaXMucG9pbnRzX1sxXSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29uc3RyYWluZWRfZWRnZVsyXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbMF07XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLmdldENvbnN0cmFpbmVkRWRnZUNDVyA9IGZ1bmN0aW9uKHApIHtcbiAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcbiAgICAgICAgaWYgKHAgPT09IHRoaXMucG9pbnRzX1swXSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29uc3RyYWluZWRfZWRnZVsyXTtcbiAgICAgICAgfSBlbHNlIGlmIChwID09PSB0aGlzLnBvaW50c19bMV0pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbMF07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jb25zdHJhaW5lZF9lZGdlWzFdO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5zZXRDb25zdHJhaW5lZEVkZ2VDVyA9IGZ1bmN0aW9uKHAsIGNlKSB7XG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXG4gICAgICAgIGlmIChwID09PSB0aGlzLnBvaW50c19bMF0pIHtcbiAgICAgICAgICAgIHRoaXMuY29uc3RyYWluZWRfZWRnZVsxXSA9IGNlO1xuICAgICAgICB9IGVsc2UgaWYgKHAgPT09IHRoaXMucG9pbnRzX1sxXSkge1xuICAgICAgICAgICAgdGhpcy5jb25zdHJhaW5lZF9lZGdlWzJdID0gY2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbMF0gPSBjZTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuc2V0Q29uc3RyYWluZWRFZGdlQ0NXID0gZnVuY3Rpb24ocCwgY2UpIHtcbiAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcbiAgICAgICAgaWYgKHAgPT09IHRoaXMucG9pbnRzX1swXSkge1xuICAgICAgICAgICAgdGhpcy5jb25zdHJhaW5lZF9lZGdlWzJdID0gY2U7XG4gICAgICAgIH0gZWxzZSBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzFdKSB7XG4gICAgICAgICAgICB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbMF0gPSBjZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuY29uc3RyYWluZWRfZWRnZVsxXSA9IGNlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5nZXREZWxhdW5heUVkZ2VDVyA9IGZ1bmN0aW9uKHApIHtcbiAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcbiAgICAgICAgaWYgKHAgPT09IHRoaXMucG9pbnRzX1swXSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGVsYXVuYXlfZWRnZVsxXTtcbiAgICAgICAgfSBlbHNlIGlmIChwID09PSB0aGlzLnBvaW50c19bMV0pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmRlbGF1bmF5X2VkZ2VbMl07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5kZWxhdW5heV9lZGdlWzBdO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5nZXREZWxhdW5heUVkZ2VDQ1cgPSBmdW5jdGlvbihwKSB7XG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXG4gICAgICAgIGlmIChwID09PSB0aGlzLnBvaW50c19bMF0pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmRlbGF1bmF5X2VkZ2VbMl07XG4gICAgICAgIH0gZWxzZSBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzFdKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5kZWxhdW5heV9lZGdlWzBdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGVsYXVuYXlfZWRnZVsxXTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuc2V0RGVsYXVuYXlFZGdlQ1cgPSBmdW5jdGlvbihwLCBlKSB7XG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXG4gICAgICAgIGlmIChwID09PSB0aGlzLnBvaW50c19bMF0pIHtcbiAgICAgICAgICAgIHRoaXMuZGVsYXVuYXlfZWRnZVsxXSA9IGU7XG4gICAgICAgIH0gZWxzZSBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzFdKSB7XG4gICAgICAgICAgICB0aGlzLmRlbGF1bmF5X2VkZ2VbMl0gPSBlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5kZWxhdW5heV9lZGdlWzBdID0gZTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuc2V0RGVsYXVuYXlFZGdlQ0NXID0gZnVuY3Rpb24ocCwgZSkge1xuICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlc1xuICAgICAgICBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzBdKSB7XG4gICAgICAgICAgICB0aGlzLmRlbGF1bmF5X2VkZ2VbMl0gPSBlO1xuICAgICAgICB9IGVsc2UgaWYgKHAgPT09IHRoaXMucG9pbnRzX1sxXSkge1xuICAgICAgICAgICAgdGhpcy5kZWxhdW5heV9lZGdlWzBdID0gZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZGVsYXVuYXlfZWRnZVsxXSA9IGU7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogVGhlIG5laWdoYm9yIGFjcm9zcyB0byBnaXZlbiBwb2ludC5cbiAgICAgKi9cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUubmVpZ2hib3JBY3Jvc3MgPSBmdW5jdGlvbihwKSB7XG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXG4gICAgICAgIGlmIChwID09PSB0aGlzLnBvaW50c19bMF0pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm5laWdoYm9yc19bMF07XG4gICAgICAgIH0gZWxzZSBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzFdKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5uZWlnaGJvcnNfWzFdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubmVpZ2hib3JzX1syXTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUub3Bwb3NpdGVQb2ludCA9IGZ1bmN0aW9uKHQsIHApIHtcbiAgICAgICAgdmFyIGN3ID0gdC5wb2ludENXKHApO1xuICAgICAgICByZXR1cm4gdGhpcy5wb2ludENXKGN3KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogTGVnYWxpemUgdHJpYW5nbGUgYnkgcm90YXRpbmcgY2xvY2t3aXNlIGFyb3VuZCBvUG9pbnRcbiAgICAgKiBAcGFyYW0ge1BvaW50fSBvcG9pbnRcbiAgICAgKiBAcGFyYW0ge1BvaW50fSBucG9pbnRcbiAgICAgKi9cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUubGVnYWxpemUgPSBmdW5jdGlvbihvcG9pbnQsIG5wb2ludCkge1xuICAgICAgICB2YXIgcG9pbnRzID0gdGhpcy5wb2ludHNfO1xuICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlc1xuICAgICAgICBpZiAob3BvaW50ID09PSBwb2ludHNbMF0pIHtcbiAgICAgICAgICAgIHBvaW50c1sxXSA9IHBvaW50c1swXTtcbiAgICAgICAgICAgIHBvaW50c1swXSA9IHBvaW50c1syXTtcbiAgICAgICAgICAgIHBvaW50c1syXSA9IG5wb2ludDtcbiAgICAgICAgfSBlbHNlIGlmIChvcG9pbnQgPT09IHBvaW50c1sxXSkge1xuICAgICAgICAgICAgcG9pbnRzWzJdID0gcG9pbnRzWzFdO1xuICAgICAgICAgICAgcG9pbnRzWzFdID0gcG9pbnRzWzBdO1xuICAgICAgICAgICAgcG9pbnRzWzBdID0gbnBvaW50O1xuICAgICAgICB9IGVsc2UgaWYgKG9wb2ludCA9PT0gcG9pbnRzWzJdKSB7XG4gICAgICAgICAgICBwb2ludHNbMF0gPSBwb2ludHNbMl07XG4gICAgICAgICAgICBwb2ludHNbMl0gPSBwb2ludHNbMV07XG4gICAgICAgICAgICBwb2ludHNbMV0gPSBucG9pbnQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3BvbHkydHJpIEludmFsaWQgVHJpYW5nbGUubGVnYWxpemUoKSBjYWxsJyk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgaW5kZXggb2YgYSBwb2ludCBpbiB0aGUgdHJpYW5nbGUuIFxuICAgICAqIFRoZSBwb2ludCAqbXVzdCogYmUgYSByZWZlcmVuY2UgdG8gb25lIG9mIHRoZSB0cmlhbmdsZSdzIHZlcnRpY2VzLlxuICAgICAqIEBwYXJhbSB7UG9pbnR9IHAgUG9pbnQgb2JqZWN0XG4gICAgICogQHJldHVybnMge051bWJlcn0gaW5kZXggMCwgMSBvciAyXG4gICAgICovXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLmluZGV4ID0gZnVuY3Rpb24ocCkge1xuICAgICAgICB2YXIgcG9pbnRzID0gdGhpcy5wb2ludHNfO1xuICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlc1xuICAgICAgICBpZiAocCA9PT0gcG9pbnRzWzBdKSB7XG4gICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgfSBlbHNlIGlmIChwID09PSBwb2ludHNbMV0pIHtcbiAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9IGVsc2UgaWYgKHAgPT09IHBvaW50c1syXSkge1xuICAgICAgICAgICAgcmV0dXJuIDI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3BvbHkydHJpIEludmFsaWQgVHJpYW5nbGUuaW5kZXgoKSBjYWxsJyk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLmVkZ2VJbmRleCA9IGZ1bmN0aW9uKHAxLCBwMikge1xuICAgICAgICB2YXIgcG9pbnRzID0gdGhpcy5wb2ludHNfO1xuICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlc1xuICAgICAgICBpZiAocDEgPT09IHBvaW50c1swXSkge1xuICAgICAgICAgICAgaWYgKHAyID09PSBwb2ludHNbMV0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gMjtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocDIgPT09IHBvaW50c1syXSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHAxID09PSBwb2ludHNbMV0pIHtcbiAgICAgICAgICAgIGlmIChwMiA9PT0gcG9pbnRzWzJdKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHAyID09PSBwb2ludHNbMF0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gMjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChwMSA9PT0gcG9pbnRzWzJdKSB7XG4gICAgICAgICAgICBpZiAocDIgPT09IHBvaW50c1swXSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChwMiA9PT0gcG9pbnRzWzFdKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIC0xO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBNYXJrIGFuIGVkZ2Ugb2YgdGhpcyB0cmlhbmdsZSBhcyBjb25zdHJhaW5lZC48YnI+XG4gICAgICogVGhpcyBtZXRob2QgdGFrZXMgZWl0aGVyIDEgcGFyYW1ldGVyIChhbiBlZGdlIGluZGV4IG9yIGFuIEVkZ2UgaW5zdGFuY2UpIG9yXG4gICAgICogMiBwYXJhbWV0ZXJzICh0d28gUG9pbnQgaW5zdGFuY2VzIGRlZmluaW5nIHRoZSBlZGdlIG9mIHRoZSB0cmlhbmdsZSkuXG4gICAgICovXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLm1hcmtDb25zdHJhaW5lZEVkZ2VCeUluZGV4ID0gZnVuY3Rpb24oaW5kZXgpIHtcbiAgICAgICAgdGhpcy5jb25zdHJhaW5lZF9lZGdlW2luZGV4XSA9IHRydWU7XG4gICAgfTtcbiAgICBUcmlhbmdsZS5wcm90b3R5cGUubWFya0NvbnN0cmFpbmVkRWRnZUJ5RWRnZSA9IGZ1bmN0aW9uKGVkZ2UpIHtcbiAgICAgICAgdGhpcy5tYXJrQ29uc3RyYWluZWRFZGdlQnlQb2ludHMoZWRnZS5wLCBlZGdlLnEpO1xuICAgIH07XG4gICAgVHJpYW5nbGUucHJvdG90eXBlLm1hcmtDb25zdHJhaW5lZEVkZ2VCeVBvaW50cyA9IGZ1bmN0aW9uKHAsIHEpIHtcbiAgICAgICAgdmFyIHBvaW50cyA9IHRoaXMucG9pbnRzXztcbiAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXMgICAgICAgIFxuICAgICAgICBpZiAoKHEgPT09IHBvaW50c1swXSAmJiBwID09PSBwb2ludHNbMV0pIHx8IChxID09PSBwb2ludHNbMV0gJiYgcCA9PT0gcG9pbnRzWzBdKSkge1xuICAgICAgICAgICAgdGhpcy5jb25zdHJhaW5lZF9lZGdlWzJdID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIGlmICgocSA9PT0gcG9pbnRzWzBdICYmIHAgPT09IHBvaW50c1syXSkgfHwgKHEgPT09IHBvaW50c1syXSAmJiBwID09PSBwb2ludHNbMF0pKSB7XG4gICAgICAgICAgICB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbMV0gPSB0cnVlO1xuICAgICAgICB9IGVsc2UgaWYgKChxID09PSBwb2ludHNbMV0gJiYgcCA9PT0gcG9pbnRzWzJdKSB8fCAocSA9PT0gcG9pbnRzWzJdICYmIHAgPT09IHBvaW50c1sxXSkpIHtcbiAgICAgICAgICAgIHRoaXMuY29uc3RyYWluZWRfZWRnZVswXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS11dGlsc1xuICAgIHZhciBQSV8zZGl2NCA9IDMgKiBNYXRoLlBJIC8gNDtcbiAgICB2YXIgUElfMiA9IE1hdGguUEkgLyAyO1xuICAgIHZhciBFUFNJTE9OID0gMWUtMTI7XG5cbiAgICAvKiBcbiAgICAgKiBJbml0YWwgdHJpYW5nbGUgZmFjdG9yLCBzZWVkIHRyaWFuZ2xlIHdpbGwgZXh0ZW5kIDMwJSBvZlxuICAgICAqIFBvaW50U2V0IHdpZHRoIHRvIGJvdGggbGVmdCBhbmQgcmlnaHQuXG4gICAgICovXG4gICAgdmFyIGtBbHBoYSA9IDAuMztcblxuICAgIHZhciBPcmllbnRhdGlvbiA9IHtcbiAgICAgICAgXCJDV1wiOiAxLFxuICAgICAgICBcIkNDV1wiOiAtMSxcbiAgICAgICAgXCJDT0xMSU5FQVJcIjogMFxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBGb3J1bWxhIHRvIGNhbGN1bGF0ZSBzaWduZWQgYXJlYTxicj5cbiAgICAgKiBQb3NpdGl2ZSBpZiBDQ1c8YnI+XG4gICAgICogTmVnYXRpdmUgaWYgQ1c8YnI+XG4gICAgICogMCBpZiBjb2xsaW5lYXI8YnI+XG4gICAgICogPHByZT5cbiAgICAgKiBBW1AxLFAyLFAzXSAgPSAgKHgxKnkyIC0geTEqeDIpICsgKHgyKnkzIC0geTIqeDMpICsgKHgzKnkxIC0geTMqeDEpXG4gICAgICogICAgICAgICAgICAgID0gICh4MS14MykqKHkyLXkzKSAtICh5MS15MykqKHgyLXgzKVxuICAgICAqIDwvcHJlPlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIG9yaWVudDJkKHBhLCBwYiwgcGMpIHtcbiAgICAgICAgdmFyIGRldGxlZnQgPSAocGEueCAtIHBjLngpICogKHBiLnkgLSBwYy55KTtcbiAgICAgICAgdmFyIGRldHJpZ2h0ID0gKHBhLnkgLSBwYy55KSAqIChwYi54IC0gcGMueCk7XG4gICAgICAgIHZhciB2YWwgPSBkZXRsZWZ0IC0gZGV0cmlnaHQ7XG4gICAgICAgIGlmICh2YWwgPiAtKEVQU0lMT04pICYmIHZhbCA8IChFUFNJTE9OKSkge1xuICAgICAgICAgICAgcmV0dXJuIE9yaWVudGF0aW9uLkNPTExJTkVBUjtcbiAgICAgICAgfSBlbHNlIGlmICh2YWwgPiAwKSB7XG4gICAgICAgICAgICByZXR1cm4gT3JpZW50YXRpb24uQ0NXO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIE9yaWVudGF0aW9uLkNXO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaW5TY2FuQXJlYShwYSwgcGIsIHBjLCBwZCkge1xuICAgICAgICB2YXIgcGR4ID0gcGQueDtcbiAgICAgICAgdmFyIHBkeSA9IHBkLnk7XG4gICAgICAgIHZhciBhZHggPSBwYS54IC0gcGR4O1xuICAgICAgICB2YXIgYWR5ID0gcGEueSAtIHBkeTtcbiAgICAgICAgdmFyIGJkeCA9IHBiLnggLSBwZHg7XG4gICAgICAgIHZhciBiZHkgPSBwYi55IC0gcGR5O1xuXG4gICAgICAgIHZhciBhZHhiZHkgPSBhZHggKiBiZHk7XG4gICAgICAgIHZhciBiZHhhZHkgPSBiZHggKiBhZHk7XG4gICAgICAgIHZhciBvYWJkID0gYWR4YmR5IC0gYmR4YWR5O1xuXG4gICAgICAgIGlmIChvYWJkIDw9IChFUFNJTE9OKSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGNkeCA9IHBjLnggLSBwZHg7XG4gICAgICAgIHZhciBjZHkgPSBwYy55IC0gcGR5O1xuXG4gICAgICAgIHZhciBjZHhhZHkgPSBjZHggKiBhZHk7XG4gICAgICAgIHZhciBhZHhjZHkgPSBhZHggKiBjZHk7XG4gICAgICAgIHZhciBvY2FkID0gY2R4YWR5IC0gYWR4Y2R5O1xuXG4gICAgICAgIGlmIChvY2FkIDw9IChFUFNJTE9OKSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1BZHZhbmNpbmdGcm9udFxuICAgIC8qKlxuICAgICAqIEFkdmFuY2luZyBmcm9udCBub2RlXG4gICAgICogQHBhcmFtIHtQb2ludH0gcCBhbnkgXCJQb2ludCBsaWtlXCIgb2JqZWN0IHdpdGgge3gseX0gKGR1Y2sgdHlwaW5nKVxuICAgICAqIEBwYXJhbSB7VHJpYW5nbGV9IHQgdHJpYW5nbGUgKG9wdGlvbm5hbClcbiAgICAgKi9cbiAgICB2YXIgTm9kZSA9IGZ1bmN0aW9uKHAsIHQpIHtcbiAgICAgICAgdGhpcy5wb2ludCA9IHA7XG4gICAgICAgIHRoaXMudHJpYW5nbGUgPSB0IHx8IG51bGw7XG5cbiAgICAgICAgdGhpcy5uZXh0ID0gbnVsbDsgLy8gTm9kZVxuICAgICAgICB0aGlzLnByZXYgPSBudWxsOyAvLyBOb2RlXG5cbiAgICAgICAgdGhpcy52YWx1ZSA9IHAueDtcbiAgICB9O1xuXG4gICAgdmFyIEFkdmFuY2luZ0Zyb250ID0gZnVuY3Rpb24oaGVhZCwgdGFpbCkge1xuICAgICAgICB0aGlzLmhlYWRfID0gaGVhZDsgLy8gTm9kZVxuICAgICAgICB0aGlzLnRhaWxfID0gdGFpbDsgLy8gTm9kZVxuICAgICAgICB0aGlzLnNlYXJjaF9ub2RlXyA9IGhlYWQ7IC8vIE5vZGVcbiAgICB9O1xuXG4gICAgQWR2YW5jaW5nRnJvbnQucHJvdG90eXBlLmhlYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaGVhZF87XG4gICAgfTtcblxuICAgIEFkdmFuY2luZ0Zyb250LnByb3RvdHlwZS5zZXRIZWFkID0gZnVuY3Rpb24obm9kZSkge1xuICAgICAgICB0aGlzLmhlYWRfID0gbm9kZTtcbiAgICB9O1xuXG4gICAgQWR2YW5jaW5nRnJvbnQucHJvdG90eXBlLnRhaWwgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudGFpbF87XG4gICAgfTtcblxuICAgIEFkdmFuY2luZ0Zyb250LnByb3RvdHlwZS5zZXRUYWlsID0gZnVuY3Rpb24obm9kZSkge1xuICAgICAgICB0aGlzLnRhaWxfID0gbm9kZTtcbiAgICB9O1xuXG4gICAgQWR2YW5jaW5nRnJvbnQucHJvdG90eXBlLnNlYXJjaCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5zZWFyY2hfbm9kZV87XG4gICAgfTtcblxuICAgIEFkdmFuY2luZ0Zyb250LnByb3RvdHlwZS5zZXRTZWFyY2ggPSBmdW5jdGlvbihub2RlKSB7XG4gICAgICAgIHRoaXMuc2VhcmNoX25vZGVfID0gbm9kZTtcbiAgICB9O1xuXG4gICAgQWR2YW5jaW5nRnJvbnQucHJvdG90eXBlLmZpbmRTZWFyY2hOb2RlID0gZnVuY3Rpb24oLyp4Ki8pIHtcbiAgICAgICAgLy8gVE9ETzogaW1wbGVtZW50IEJTVCBpbmRleFxuICAgICAgICByZXR1cm4gdGhpcy5zZWFyY2hfbm9kZV87XG4gICAgfTtcblxuICAgIEFkdmFuY2luZ0Zyb250LnByb3RvdHlwZS5sb2NhdGVOb2RlID0gZnVuY3Rpb24oeCkge1xuICAgICAgICB2YXIgbm9kZSA9IHRoaXMuc2VhcmNoX25vZGVfO1xuXG4gICAgICAgIC8qIGpzaGludCBib3NzOnRydWUgKi9cbiAgICAgICAgaWYgKHggPCBub2RlLnZhbHVlKSB7XG4gICAgICAgICAgICB3aGlsZSAobm9kZSA9IG5vZGUucHJldikge1xuICAgICAgICAgICAgICAgIGlmICh4ID49IG5vZGUudmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZWFyY2hfbm9kZV8gPSBub2RlO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbm9kZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB3aGlsZSAobm9kZSA9IG5vZGUubmV4dCkge1xuICAgICAgICAgICAgICAgIGlmICh4IDwgbm9kZS52YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNlYXJjaF9ub2RlXyA9IG5vZGUucHJldjtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5vZGUucHJldjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfTtcblxuICAgIEFkdmFuY2luZ0Zyb250LnByb3RvdHlwZS5sb2NhdGVQb2ludCA9IGZ1bmN0aW9uKHBvaW50KSB7XG4gICAgICAgIHZhciBweCA9IHBvaW50Lng7XG4gICAgICAgIHZhciBub2RlID0gdGhpcy5maW5kU2VhcmNoTm9kZShweCk7XG4gICAgICAgIHZhciBueCA9IG5vZGUucG9pbnQueDtcblxuICAgICAgICBpZiAocHggPT09IG54KSB7XG4gICAgICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlc1xuICAgICAgICAgICAgaWYgKHBvaW50ICE9PSBub2RlLnBvaW50KSB7XG4gICAgICAgICAgICAgICAgLy8gV2UgbWlnaHQgaGF2ZSB0d28gbm9kZXMgd2l0aCBzYW1lIHggdmFsdWUgZm9yIGEgc2hvcnQgdGltZVxuICAgICAgICAgICAgICAgIGlmIChwb2ludCA9PT0gbm9kZS5wcmV2LnBvaW50KSB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGUgPSBub2RlLnByZXY7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChwb2ludCA9PT0gbm9kZS5uZXh0LnBvaW50KSB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGUgPSBub2RlLm5leHQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdwb2x5MnRyaSBJbnZhbGlkIEFkdmFuY2luZ0Zyb250LmxvY2F0ZVBvaW50KCkgY2FsbCcpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChweCA8IG54KSB7XG4gICAgICAgICAgICAvKiBqc2hpbnQgYm9zczp0cnVlICovXG4gICAgICAgICAgICB3aGlsZSAobm9kZSA9IG5vZGUucHJldikge1xuICAgICAgICAgICAgICAgIGlmIChwb2ludCA9PT0gbm9kZS5wb2ludCkge1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB3aGlsZSAobm9kZSA9IG5vZGUubmV4dCkge1xuICAgICAgICAgICAgICAgIGlmIChwb2ludCA9PT0gbm9kZS5wb2ludCkge1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobm9kZSkge1xuICAgICAgICAgICAgdGhpcy5zZWFyY2hfbm9kZV8gPSBub2RlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBub2RlO1xuICAgIH07XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLUJhc2luXG4gICAgdmFyIEJhc2luID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMubGVmdF9ub2RlID0gbnVsbDsgLy8gTm9kZVxuICAgICAgICB0aGlzLmJvdHRvbV9ub2RlID0gbnVsbDsgLy8gTm9kZVxuICAgICAgICB0aGlzLnJpZ2h0X25vZGUgPSBudWxsOyAvLyBOb2RlXG4gICAgICAgIHRoaXMud2lkdGggPSAwLjA7IC8vIG51bWJlclxuICAgICAgICB0aGlzLmxlZnRfaGlnaGVzdCA9IGZhbHNlO1xuICAgIH07XG5cbiAgICBCYXNpbi5wcm90b3R5cGUuY2xlYXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5sZWZ0X25vZGUgPSBudWxsO1xuICAgICAgICB0aGlzLmJvdHRvbV9ub2RlID0gbnVsbDtcbiAgICAgICAgdGhpcy5yaWdodF9ub2RlID0gbnVsbDtcbiAgICAgICAgdGhpcy53aWR0aCA9IDAuMDtcbiAgICAgICAgdGhpcy5sZWZ0X2hpZ2hlc3QgPSBmYWxzZTtcbiAgICB9O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLUVkZ2VFdmVudFxuICAgIHZhciBFZGdlRXZlbnQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5jb25zdHJhaW5lZF9lZGdlID0gbnVsbDsgLy8gRWRnZVxuICAgICAgICB0aGlzLnJpZ2h0ID0gZmFsc2U7XG4gICAgfTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVN3ZWVwQ29udGV4dCAocHVibGljIEFQSSlcbiAgICAvKipcbiAgICAgKiBDb25zdHJ1Y3RvciBmb3IgdGhlIHRyaWFuZ3VsYXRpb24gY29udGV4dC5cbiAgICAgKiBJdCBhY2NlcHRzIGEgc2ltcGxlIHBvbHlsaW5lLCB3aGljaCBkZWZpbmVzIHRoZSBjb25zdHJhaW5lZCBlZGdlcy5cbiAgICAgKiBQb3NzaWJsZSBvcHRpb25zIGFyZTpcbiAgICAgKiAgICBjbG9uZUFycmF5czogIGlmIHRydWUsIGRvIGEgc2hhbGxvdyBjb3B5IG9mIHRoZSBBcnJheSBwYXJhbWV0ZXJzIFxuICAgICAqICAgICAgICAgICAgICAgICAgKGNvbnRvdXIsIGhvbGVzKS4gUG9pbnRzIGluc2lkZSBhcnJheXMgYXJlIG5ldmVyIGNvcGllZC5cbiAgICAgKiAgICAgICAgICAgICAgICAgIERlZmF1bHQgaXMgZmFsc2UgOiBrZWVwIGEgcmVmZXJlbmNlIHRvIHRoZSBhcnJheSBhcmd1bWVudHMsXG4gICAgICogICAgICAgICAgICAgICAgICB3aG8gd2lsbCBiZSBtb2RpZmllZCBpbiBwbGFjZS5cbiAgICAgKiBAcGFyYW0ge0FycmF5fSBjb250b3VyICBhcnJheSBvZiBcIlBvaW50IGxpa2VcIiBvYmplY3RzIHdpdGgge3gseX0gKGR1Y2sgdHlwaW5nKVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zICBjb25zdHJ1Y3RvciBvcHRpb25zXG4gICAgICovXG4gICAgdmFyIFN3ZWVwQ29udGV4dCA9IGZ1bmN0aW9uKGNvbnRvdXIsIG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgICAgIHRoaXMudHJpYW5nbGVzXyA9IFtdO1xuICAgICAgICB0aGlzLm1hcF8gPSBbXTtcbiAgICAgICAgdGhpcy5wb2ludHNfID0gKG9wdGlvbnMuY2xvbmVBcnJheXMgPyBjb250b3VyLnNsaWNlKDApIDogY29udG91cik7XG4gICAgICAgIHRoaXMuZWRnZV9saXN0ID0gW107XG5cbiAgICAgICAgLy8gQm91bmRpbmcgYm94IG9mIGFsbCBwb2ludHMuIENvbXB1dGVkIGF0IHRoZSBzdGFydCBvZiB0aGUgdHJpYW5ndWxhdGlvbiwgXG4gICAgICAgIC8vIGl0IGlzIHN0b3JlZCBpbiBjYXNlIGl0IGlzIG5lZWRlZCBieSB0aGUgY2FsbGVyLlxuICAgICAgICB0aGlzLnBtaW5fID0gdGhpcy5wbWF4XyA9IG51bGw7XG5cbiAgICAgICAgLy8gQWR2YW5jaW5nIGZyb250XG4gICAgICAgIHRoaXMuZnJvbnRfID0gbnVsbDsgLy8gQWR2YW5jaW5nRnJvbnRcbiAgICAgICAgLy8gaGVhZCBwb2ludCB1c2VkIHdpdGggYWR2YW5jaW5nIGZyb250XG4gICAgICAgIHRoaXMuaGVhZF8gPSBudWxsOyAvLyBQb2ludFxuICAgICAgICAvLyB0YWlsIHBvaW50IHVzZWQgd2l0aCBhZHZhbmNpbmcgZnJvbnRcbiAgICAgICAgdGhpcy50YWlsXyA9IG51bGw7IC8vIFBvaW50XG5cbiAgICAgICAgdGhpcy5hZl9oZWFkXyA9IG51bGw7IC8vIE5vZGVcbiAgICAgICAgdGhpcy5hZl9taWRkbGVfID0gbnVsbDsgLy8gTm9kZVxuICAgICAgICB0aGlzLmFmX3RhaWxfID0gbnVsbDsgLy8gTm9kZVxuXG4gICAgICAgIHRoaXMuYmFzaW4gPSBuZXcgQmFzaW4oKTtcbiAgICAgICAgdGhpcy5lZGdlX2V2ZW50ID0gbmV3IEVkZ2VFdmVudCgpO1xuXG4gICAgICAgIHRoaXMuaW5pdEVkZ2VzKHRoaXMucG9pbnRzXyk7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogQWRkIGEgaG9sZSB0byB0aGUgY29uc3RyYWludHNcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBwb2x5bGluZSAgYXJyYXkgb2YgXCJQb2ludCBsaWtlXCIgb2JqZWN0cyB3aXRoIHt4LHl9IChkdWNrIHR5cGluZylcbiAgICAgKi9cbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLmFkZEhvbGUgPSBmdW5jdGlvbihwb2x5bGluZSkge1xuICAgICAgICB0aGlzLmluaXRFZGdlcyhwb2x5bGluZSk7XG4gICAgICAgIHZhciBpLCBsZW4gPSBwb2x5bGluZS5sZW5ndGg7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgdGhpcy5wb2ludHNfLnB1c2gocG9seWxpbmVbaV0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzOyAvLyBmb3IgY2hhaW5pbmdcbiAgICB9O1xuICAgIC8vIEJhY2t3YXJkIGNvbXBhdGliaWxpdHlcbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLkFkZEhvbGUgPSBTd2VlcENvbnRleHQucHJvdG90eXBlLmFkZEhvbGU7XG5cblxuICAgIC8qKlxuICAgICAqIEFkZCBhIFN0ZWluZXIgcG9pbnQgdG8gdGhlIGNvbnN0cmFpbnRzXG4gICAgICogQHBhcmFtIHtQb2ludH0gcG9pbnQgICAgIGFueSBcIlBvaW50IGxpa2VcIiBvYmplY3Qgd2l0aCB7eCx5fSAoZHVjayB0eXBpbmcpXG4gICAgICovXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5hZGRQb2ludCA9IGZ1bmN0aW9uKHBvaW50KSB7XG4gICAgICAgIHRoaXMucG9pbnRzXy5wdXNoKHBvaW50KTtcbiAgICAgICAgcmV0dXJuIHRoaXM7IC8vIGZvciBjaGFpbmluZ1xuICAgIH07XG4gICAgLy8gQmFja3dhcmQgY29tcGF0aWJpbGl0eVxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUuQWRkUG9pbnQgPSBTd2VlcENvbnRleHQucHJvdG90eXBlLmFkZFBvaW50O1xuXG5cbiAgICAvKipcbiAgICAgKiBBZGQgc2V2ZXJhbCBTdGVpbmVyIHBvaW50cyB0byB0aGUgY29uc3RyYWludHNcbiAgICAgKiBAcGFyYW0ge2FycmF5PFBvaW50Pn0gcG9pbnRzICAgICBhcnJheSBvZiBcIlBvaW50IGxpa2VcIiBvYmplY3Qgd2l0aCB7eCx5fSBcbiAgICAgKi9cbiAgICAvLyBNZXRob2QgYWRkZWQgaW4gdGhlIEphdmFTY3JpcHQgdmVyc2lvbiAod2FzIG5vdCBwcmVzZW50IGluIHRoZSBjKysgdmVyc2lvbilcbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLmFkZFBvaW50cyA9IGZ1bmN0aW9uKHBvaW50cykge1xuICAgICAgICB0aGlzLnBvaW50c18gPSB0aGlzLnBvaW50c18uY29uY2F0KHBvaW50cyk7XG4gICAgICAgIHJldHVybiB0aGlzOyAvLyBmb3IgY2hhaW5pbmdcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBUcmlhbmd1bGF0ZSB0aGUgcG9seWdvbiB3aXRoIGhvbGVzIGFuZCBTdGVpbmVyIHBvaW50cy5cbiAgICAgKi9cbiAgICAvLyBTaG9ydGN1dCBtZXRob2QgZm9yIFN3ZWVwLnRyaWFuZ3VsYXRlKFN3ZWVwQ29udGV4dCkuXG4gICAgLy8gTWV0aG9kIGFkZGVkIGluIHRoZSBKYXZhU2NyaXB0IHZlcnNpb24gKHdhcyBub3QgcHJlc2VudCBpbiB0aGUgYysrIHZlcnNpb24pXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS50cmlhbmd1bGF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBTd2VlcC50cmlhbmd1bGF0ZSh0aGlzKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7IC8vIGZvciBjaGFpbmluZ1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgYm91bmRpbmcgYm94IG9mIHRoZSBwcm92aWRlZCBjb25zdHJhaW50cyAoY29udG91ciwgaG9sZXMgYW5kIFxuICAgICAqIFN0ZWludGVyIHBvaW50cykuIFdhcm5pbmcgOiB0aGVzZSB2YWx1ZXMgYXJlIG5vdCBhdmFpbGFibGUgaWYgdGhlIHRyaWFuZ3VsYXRpb24gXG4gICAgICogaGFzIG5vdCBiZWVuIGRvbmUgeWV0LlxuICAgICAqIEByZXR1cm5zIHtPYmplY3R9IG9iamVjdCB3aXRoICdtaW4nIGFuZCAnbWF4JyBQb2ludFxuICAgICAqL1xuICAgIC8vIE1ldGhvZCBhZGRlZCBpbiB0aGUgSmF2YVNjcmlwdCB2ZXJzaW9uICh3YXMgbm90IHByZXNlbnQgaW4gdGhlIGMrKyB2ZXJzaW9uKVxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUuZ2V0Qm91bmRpbmdCb3ggPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHttaW46IHRoaXMucG1pbl8sIG1heDogdGhpcy5wbWF4X307XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEdldCByZXN1bHQgb2YgdHJpYW5ndWxhdGlvblxuICAgICAqIEByZXR1cm5zIHthcnJheTxUcmlhbmdsZT59ICAgYXJyYXkgb2YgdHJpYW5nbGVzXG4gICAgICovXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5nZXRUcmlhbmdsZXMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudHJpYW5nbGVzXztcbiAgICB9O1xuICAgIC8vIEJhY2t3YXJkIGNvbXBhdGliaWxpdHlcbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLkdldFRyaWFuZ2xlcyA9IFN3ZWVwQ29udGV4dC5wcm90b3R5cGUuZ2V0VHJpYW5nbGVzO1xuXG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVN3ZWVwQ29udGV4dCAocHJpdmF0ZSBBUEkpXG5cbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLmZyb250ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmZyb250XztcbiAgICB9O1xuXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5wb2ludENvdW50ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBvaW50c18ubGVuZ3RoO1xuICAgIH07XG5cbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLmhlYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaGVhZF87XG4gICAgfTtcblxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUuc2V0SGVhZCA9IGZ1bmN0aW9uKHAxKSB7XG4gICAgICAgIHRoaXMuaGVhZF8gPSBwMTtcbiAgICB9O1xuXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS50YWlsID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRhaWxfO1xuICAgIH07XG5cbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLnNldFRhaWwgPSBmdW5jdGlvbihwMSkge1xuICAgICAgICB0aGlzLnRhaWxfID0gcDE7XG4gICAgfTtcblxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUuZ2V0TWFwID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1hcF87XG4gICAgfTtcblxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUuaW5pdFRyaWFuZ3VsYXRpb24gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHhtYXggPSB0aGlzLnBvaW50c19bMF0ueDtcbiAgICAgICAgdmFyIHhtaW4gPSB0aGlzLnBvaW50c19bMF0ueDtcbiAgICAgICAgdmFyIHltYXggPSB0aGlzLnBvaW50c19bMF0ueTtcbiAgICAgICAgdmFyIHltaW4gPSB0aGlzLnBvaW50c19bMF0ueTtcblxuICAgICAgICAvLyBDYWxjdWxhdGUgYm91bmRzXG4gICAgICAgIHZhciBpLCBsZW4gPSB0aGlzLnBvaW50c18ubGVuZ3RoO1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBwID0gdGhpcy5wb2ludHNfW2ldO1xuICAgICAgICAgICAgLyoganNoaW50IGV4cHI6dHJ1ZSAqL1xuICAgICAgICAgICAgKHAueCA+IHhtYXgpICYmICh4bWF4ID0gcC54KTtcbiAgICAgICAgICAgIChwLnggPCB4bWluKSAmJiAoeG1pbiA9IHAueCk7XG4gICAgICAgICAgICAocC55ID4geW1heCkgJiYgKHltYXggPSBwLnkpO1xuICAgICAgICAgICAgKHAueSA8IHltaW4pICYmICh5bWluID0gcC55KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnBtaW5fID0gbmV3IFBvaW50KHhtaW4sIHltaW4pO1xuICAgICAgICB0aGlzLnBtYXhfID0gbmV3IFBvaW50KHhtYXgsIHltYXgpO1xuXG4gICAgICAgIHZhciBkeCA9IGtBbHBoYSAqICh4bWF4IC0geG1pbik7XG4gICAgICAgIHZhciBkeSA9IGtBbHBoYSAqICh5bWF4IC0geW1pbik7XG4gICAgICAgIHRoaXMuaGVhZF8gPSBuZXcgUG9pbnQoeG1heCArIGR4LCB5bWluIC0gZHkpO1xuICAgICAgICB0aGlzLnRhaWxfID0gbmV3IFBvaW50KHhtaW4gLSBkeCwgeW1pbiAtIGR5KTtcblxuICAgICAgICAvLyBTb3J0IHBvaW50cyBhbG9uZyB5LWF4aXNcbiAgICAgICAgdGhpcy5wb2ludHNfLnNvcnQoUG9pbnQuY29tcGFyZSk7XG4gICAgfTtcblxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUuaW5pdEVkZ2VzID0gZnVuY3Rpb24ocG9seWxpbmUpIHtcbiAgICAgICAgdmFyIGksIGxlbiA9IHBvbHlsaW5lLmxlbmd0aDtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgICAgICB0aGlzLmVkZ2VfbGlzdC5wdXNoKG5ldyBFZGdlKHBvbHlsaW5lW2ldLCBwb2x5bGluZVsoaSArIDEpICUgbGVuXSkpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUuZ2V0UG9pbnQgPSBmdW5jdGlvbihpbmRleCkge1xuICAgICAgICByZXR1cm4gdGhpcy5wb2ludHNfW2luZGV4XTtcbiAgICB9O1xuXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5hZGRUb01hcCA9IGZ1bmN0aW9uKHRyaWFuZ2xlKSB7XG4gICAgICAgIHRoaXMubWFwXy5wdXNoKHRyaWFuZ2xlKTtcbiAgICB9O1xuXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5sb2NhdGVOb2RlID0gZnVuY3Rpb24ocG9pbnQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZnJvbnRfLmxvY2F0ZU5vZGUocG9pbnQueCk7XG4gICAgfTtcblxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUuY3JlYXRlQWR2YW5jaW5nRnJvbnQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGhlYWQ7XG4gICAgICAgIHZhciBtaWRkbGU7XG4gICAgICAgIHZhciB0YWlsO1xuICAgICAgICAvLyBJbml0aWFsIHRyaWFuZ2xlXG4gICAgICAgIHZhciB0cmlhbmdsZSA9IG5ldyBUcmlhbmdsZSh0aGlzLnBvaW50c19bMF0sIHRoaXMudGFpbF8sIHRoaXMuaGVhZF8pO1xuXG4gICAgICAgIHRoaXMubWFwXy5wdXNoKHRyaWFuZ2xlKTtcblxuICAgICAgICBoZWFkID0gbmV3IE5vZGUodHJpYW5nbGUuZ2V0UG9pbnQoMSksIHRyaWFuZ2xlKTtcbiAgICAgICAgbWlkZGxlID0gbmV3IE5vZGUodHJpYW5nbGUuZ2V0UG9pbnQoMCksIHRyaWFuZ2xlKTtcbiAgICAgICAgdGFpbCA9IG5ldyBOb2RlKHRyaWFuZ2xlLmdldFBvaW50KDIpKTtcblxuICAgICAgICB0aGlzLmZyb250XyA9IG5ldyBBZHZhbmNpbmdGcm9udChoZWFkLCB0YWlsKTtcblxuICAgICAgICBoZWFkLm5leHQgPSBtaWRkbGU7XG4gICAgICAgIG1pZGRsZS5uZXh0ID0gdGFpbDtcbiAgICAgICAgbWlkZGxlLnByZXYgPSBoZWFkO1xuICAgICAgICB0YWlsLnByZXYgPSBtaWRkbGU7XG4gICAgfTtcblxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUucmVtb3ZlTm9kZSA9IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICAgICAgLy8gZG8gbm90aGluZ1xuICAgICAgICAvKiBqc2hpbnQgdW51c2VkOmZhbHNlICovXG4gICAgfTtcblxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUubWFwVHJpYW5nbGVUb05vZGVzID0gZnVuY3Rpb24odCkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IDM7ICsraSkge1xuICAgICAgICAgICAgaWYgKCEgdC5nZXROZWlnaGJvcihpKSkge1xuICAgICAgICAgICAgICAgIHZhciBuID0gdGhpcy5mcm9udF8ubG9jYXRlUG9pbnQodC5wb2ludENXKHQuZ2V0UG9pbnQoaSkpKTtcbiAgICAgICAgICAgICAgICBpZiAobikge1xuICAgICAgICAgICAgICAgICAgICBuLnRyaWFuZ2xlID0gdDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5yZW1vdmVGcm9tTWFwID0gZnVuY3Rpb24odHJpYW5nbGUpIHtcbiAgICAgICAgdmFyIGksIG1hcCA9IHRoaXMubWFwXywgbGVuID0gbWFwLmxlbmd0aDtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBpZiAobWFwW2ldID09PSB0cmlhbmdsZSkge1xuICAgICAgICAgICAgICAgIG1hcC5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogRG8gYSBkZXB0aCBmaXJzdCB0cmF2ZXJzYWwgdG8gY29sbGVjdCB0cmlhbmdsZXNcbiAgICAgKiBAcGFyYW0ge1RyaWFuZ2xlfSB0cmlhbmdsZSBzdGFydFxuICAgICAqL1xuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUubWVzaENsZWFuID0gZnVuY3Rpb24odHJpYW5nbGUpIHtcbiAgICAgICAgLy8gTmV3IGltcGxlbWVudGF0aW9uIGF2b2lkcyByZWN1cnNpdmUgY2FsbHMgYW5kIHVzZSBhIGxvb3AgaW5zdGVhZC5cbiAgICAgICAgLy8gQ2YuIGlzc3VlcyAjIDU3LCA2NSBhbmQgNjkuXG4gICAgICAgIHZhciB0cmlhbmdsZXMgPSBbdHJpYW5nbGVdLCB0LCBpO1xuICAgICAgICAvKiBqc2hpbnQgYm9zczp0cnVlICovXG4gICAgICAgIHdoaWxlICh0ID0gdHJpYW5nbGVzLnBvcCgpKSB7XG4gICAgICAgICAgICBpZiAoIXQuaXNJbnRlcmlvcigpKSB7XG4gICAgICAgICAgICAgICAgdC5zZXRJbnRlcmlvcih0cnVlKTtcbiAgICAgICAgICAgICAgICB0aGlzLnRyaWFuZ2xlc18ucHVzaCh0KTtcbiAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgMzsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdC5jb25zdHJhaW5lZF9lZGdlW2ldKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cmlhbmdsZXMucHVzaCh0LmdldE5laWdoYm9yKGkpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVN3ZWVwXG5cbiAgICAvKipcbiAgICAgKiBUaGUgJ1N3ZWVwJyBvYmplY3QgaXMgcHJlc2VudCBpbiBvcmRlciB0byBrZWVwIHRoaXMgSmF2YVNjcmlwdCB2ZXJzaW9uIFxuICAgICAqIGFzIGNsb3NlIGFzIHBvc3NpYmxlIHRvIHRoZSByZWZlcmVuY2UgQysrIHZlcnNpb24sIGV2ZW4gdGhvdWdoIGFsbW9zdFxuICAgICAqIGFsbCBTd2VlcCBtZXRob2RzIGNvdWxkIGJlIGRlY2xhcmVkIGFzIG1lbWJlcnMgb2YgdGhlIFN3ZWVwQ29udGV4dCBvYmplY3QuXG4gICAgICovXG4gICAgdmFyIFN3ZWVwID0ge307XG5cblxuICAgIC8qKlxuICAgICAqIFRyaWFuZ3VsYXRlIHRoZSBwb2x5Z29uIHdpdGggaG9sZXMgYW5kIFN0ZWluZXIgcG9pbnRzLlxuICAgICAqIEBwYXJhbSAgIHRjeCBTd2VlcENvbnRleHQgb2JqZWN0LlxuICAgICAqL1xuICAgIFN3ZWVwLnRyaWFuZ3VsYXRlID0gZnVuY3Rpb24odGN4KSB7XG4gICAgICAgIHRjeC5pbml0VHJpYW5ndWxhdGlvbigpO1xuICAgICAgICB0Y3guY3JlYXRlQWR2YW5jaW5nRnJvbnQoKTtcbiAgICAgICAgLy8gU3dlZXAgcG9pbnRzOyBidWlsZCBtZXNoXG4gICAgICAgIFN3ZWVwLnN3ZWVwUG9pbnRzKHRjeCk7XG4gICAgICAgIC8vIENsZWFuIHVwXG4gICAgICAgIFN3ZWVwLmZpbmFsaXphdGlvblBvbHlnb24odGN4KTtcbiAgICB9O1xuXG4gICAgU3dlZXAuc3dlZXBQb2ludHMgPSBmdW5jdGlvbih0Y3gpIHtcbiAgICAgICAgdmFyIGksIGxlbiA9IHRjeC5wb2ludENvdW50KCk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47ICsraSkge1xuICAgICAgICAgICAgdmFyIHBvaW50ID0gdGN4LmdldFBvaW50KGkpO1xuICAgICAgICAgICAgdmFyIG5vZGUgPSBTd2VlcC5wb2ludEV2ZW50KHRjeCwgcG9pbnQpO1xuICAgICAgICAgICAgdmFyIGVkZ2VzID0gcG9pbnQuX3AydF9lZGdlX2xpc3Q7XG4gICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgZWRnZXMgJiYgaiA8IGVkZ2VzLmxlbmd0aDsgKytqKSB7XG4gICAgICAgICAgICAgICAgU3dlZXAuZWRnZUV2ZW50QnlFZGdlKHRjeCwgZWRnZXNbal0sIG5vZGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIFN3ZWVwLmZpbmFsaXphdGlvblBvbHlnb24gPSBmdW5jdGlvbih0Y3gpIHtcbiAgICAgICAgLy8gR2V0IGFuIEludGVybmFsIHRyaWFuZ2xlIHRvIHN0YXJ0IHdpdGhcbiAgICAgICAgdmFyIHQgPSB0Y3guZnJvbnQoKS5oZWFkKCkubmV4dC50cmlhbmdsZTtcbiAgICAgICAgdmFyIHAgPSB0Y3guZnJvbnQoKS5oZWFkKCkubmV4dC5wb2ludDtcbiAgICAgICAgd2hpbGUgKCF0LmdldENvbnN0cmFpbmVkRWRnZUNXKHApKSB7XG4gICAgICAgICAgICB0ID0gdC5uZWlnaGJvckNDVyhwKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENvbGxlY3QgaW50ZXJpb3IgdHJpYW5nbGVzIGNvbnN0cmFpbmVkIGJ5IGVkZ2VzXG4gICAgICAgIHRjeC5tZXNoQ2xlYW4odCk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEZpbmQgY2xvc2VzIG5vZGUgdG8gdGhlIGxlZnQgb2YgdGhlIG5ldyBwb2ludCBhbmRcbiAgICAgKiBjcmVhdGUgYSBuZXcgdHJpYW5nbGUuIElmIG5lZWRlZCBuZXcgaG9sZXMgYW5kIGJhc2luc1xuICAgICAqIHdpbGwgYmUgZmlsbGVkIHRvLlxuICAgICAqL1xuICAgIFN3ZWVwLnBvaW50RXZlbnQgPSBmdW5jdGlvbih0Y3gsIHBvaW50KSB7XG4gICAgICAgIHZhciBub2RlID0gdGN4LmxvY2F0ZU5vZGUocG9pbnQpO1xuICAgICAgICB2YXIgbmV3X25vZGUgPSBTd2VlcC5uZXdGcm9udFRyaWFuZ2xlKHRjeCwgcG9pbnQsIG5vZGUpO1xuXG4gICAgICAgIC8vIE9ubHkgbmVlZCB0byBjaGVjayArZXBzaWxvbiBzaW5jZSBwb2ludCBuZXZlciBoYXZlIHNtYWxsZXJcbiAgICAgICAgLy8geCB2YWx1ZSB0aGFuIG5vZGUgZHVlIHRvIGhvdyB3ZSBmZXRjaCBub2RlcyBmcm9tIHRoZSBmcm9udFxuICAgICAgICBpZiAocG9pbnQueCA8PSBub2RlLnBvaW50LnggKyAoRVBTSUxPTikpIHtcbiAgICAgICAgICAgIFN3ZWVwLmZpbGwodGN4LCBub2RlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vdGN4LkFkZE5vZGUobmV3X25vZGUpO1xuXG4gICAgICAgIFN3ZWVwLmZpbGxBZHZhbmNpbmdGcm9udCh0Y3gsIG5ld19ub2RlKTtcbiAgICAgICAgcmV0dXJuIG5ld19ub2RlO1xuICAgIH07XG5cbiAgICBTd2VlcC5lZGdlRXZlbnRCeUVkZ2UgPSBmdW5jdGlvbih0Y3gsIGVkZ2UsIG5vZGUpIHtcbiAgICAgICAgdGN4LmVkZ2VfZXZlbnQuY29uc3RyYWluZWRfZWRnZSA9IGVkZ2U7XG4gICAgICAgIHRjeC5lZGdlX2V2ZW50LnJpZ2h0ID0gKGVkZ2UucC54ID4gZWRnZS5xLngpO1xuXG4gICAgICAgIGlmIChTd2VlcC5pc0VkZ2VTaWRlT2ZUcmlhbmdsZShub2RlLnRyaWFuZ2xlLCBlZGdlLnAsIGVkZ2UucSkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEZvciBub3cgd2Ugd2lsbCBkbyBhbGwgbmVlZGVkIGZpbGxpbmdcbiAgICAgICAgLy8gVE9ETzogaW50ZWdyYXRlIHdpdGggZmxpcCBwcm9jZXNzIG1pZ2h0IGdpdmUgc29tZSBiZXR0ZXIgcGVyZm9ybWFuY2VcbiAgICAgICAgLy8gICAgICAgYnV0IGZvciBub3cgdGhpcyBhdm9pZCB0aGUgaXNzdWUgd2l0aCBjYXNlcyB0aGF0IG5lZWRzIGJvdGggZmxpcHMgYW5kIGZpbGxzXG4gICAgICAgIFN3ZWVwLmZpbGxFZGdlRXZlbnQodGN4LCBlZGdlLCBub2RlKTtcbiAgICAgICAgU3dlZXAuZWRnZUV2ZW50QnlQb2ludHModGN4LCBlZGdlLnAsIGVkZ2UucSwgbm9kZS50cmlhbmdsZSwgZWRnZS5xKTtcbiAgICB9O1xuXG4gICAgU3dlZXAuZWRnZUV2ZW50QnlQb2ludHMgPSBmdW5jdGlvbih0Y3gsIGVwLCBlcSwgdHJpYW5nbGUsIHBvaW50KSB7XG4gICAgICAgIGlmIChTd2VlcC5pc0VkZ2VTaWRlT2ZUcmlhbmdsZSh0cmlhbmdsZSwgZXAsIGVxKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHAxID0gdHJpYW5nbGUucG9pbnRDQ1cocG9pbnQpO1xuICAgICAgICB2YXIgbzEgPSBvcmllbnQyZChlcSwgcDEsIGVwKTtcbiAgICAgICAgaWYgKG8xID09PSBPcmllbnRhdGlvbi5DT0xMSU5FQVIpIHtcbiAgICAgICAgICAgIC8vIFRPRE8gaW50ZWdyYXRlIGhlcmUgY2hhbmdlcyBmcm9tIEMrKyB2ZXJzaW9uXG4gICAgICAgICAgICB0aHJvdyBuZXcgUG9pbnRFcnJvcigncG9seTJ0cmkgRWRnZUV2ZW50OiBDb2xsaW5lYXIgbm90IHN1cHBvcnRlZCEnLCBbZXEsIHAxLCBlcF0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHAyID0gdHJpYW5nbGUucG9pbnRDVyhwb2ludCk7XG4gICAgICAgIHZhciBvMiA9IG9yaWVudDJkKGVxLCBwMiwgZXApO1xuICAgICAgICBpZiAobzIgPT09IE9yaWVudGF0aW9uLkNPTExJTkVBUikge1xuICAgICAgICAgICAgLy8gVE9ETyBpbnRlZ3JhdGUgaGVyZSBjaGFuZ2VzIGZyb20gQysrIHZlcnNpb25cbiAgICAgICAgICAgIHRocm93IG5ldyBQb2ludEVycm9yKCdwb2x5MnRyaSBFZGdlRXZlbnQ6IENvbGxpbmVhciBub3Qgc3VwcG9ydGVkIScsIFtlcSwgcDIsIGVwXSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobzEgPT09IG8yKSB7XG4gICAgICAgICAgICAvLyBOZWVkIHRvIGRlY2lkZSBpZiB3ZSBhcmUgcm90YXRpbmcgQ1cgb3IgQ0NXIHRvIGdldCB0byBhIHRyaWFuZ2xlXG4gICAgICAgICAgICAvLyB0aGF0IHdpbGwgY3Jvc3MgZWRnZVxuICAgICAgICAgICAgaWYgKG8xID09PSBPcmllbnRhdGlvbi5DVykge1xuICAgICAgICAgICAgICAgIHRyaWFuZ2xlID0gdHJpYW5nbGUubmVpZ2hib3JDQ1cocG9pbnQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0cmlhbmdsZSA9IHRyaWFuZ2xlLm5laWdoYm9yQ1cocG9pbnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgU3dlZXAuZWRnZUV2ZW50QnlQb2ludHModGN4LCBlcCwgZXEsIHRyaWFuZ2xlLCBwb2ludCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBUaGlzIHRyaWFuZ2xlIGNyb3NzZXMgY29uc3RyYWludCBzbyBsZXRzIGZsaXBwaW4gc3RhcnQhXG4gICAgICAgICAgICBTd2VlcC5mbGlwRWRnZUV2ZW50KHRjeCwgZXAsIGVxLCB0cmlhbmdsZSwgcG9pbnQpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIFN3ZWVwLmlzRWRnZVNpZGVPZlRyaWFuZ2xlID0gZnVuY3Rpb24odHJpYW5nbGUsIGVwLCBlcSkge1xuICAgICAgICB2YXIgaW5kZXggPSB0cmlhbmdsZS5lZGdlSW5kZXgoZXAsIGVxKTtcbiAgICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICAgICAgdHJpYW5nbGUubWFya0NvbnN0cmFpbmVkRWRnZUJ5SW5kZXgoaW5kZXgpO1xuICAgICAgICAgICAgdmFyIHQgPSB0cmlhbmdsZS5nZXROZWlnaGJvcihpbmRleCk7XG4gICAgICAgICAgICBpZiAodCkge1xuICAgICAgICAgICAgICAgIHQubWFya0NvbnN0cmFpbmVkRWRnZUJ5UG9pbnRzKGVwLCBlcSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfTtcblxuICAgIFN3ZWVwLm5ld0Zyb250VHJpYW5nbGUgPSBmdW5jdGlvbih0Y3gsIHBvaW50LCBub2RlKSB7XG4gICAgICAgIHZhciB0cmlhbmdsZSA9IG5ldyBUcmlhbmdsZShwb2ludCwgbm9kZS5wb2ludCwgbm9kZS5uZXh0LnBvaW50KTtcblxuICAgICAgICB0cmlhbmdsZS5tYXJrTmVpZ2hib3Iobm9kZS50cmlhbmdsZSk7XG4gICAgICAgIHRjeC5hZGRUb01hcCh0cmlhbmdsZSk7XG5cbiAgICAgICAgdmFyIG5ld19ub2RlID0gbmV3IE5vZGUocG9pbnQpO1xuICAgICAgICBuZXdfbm9kZS5uZXh0ID0gbm9kZS5uZXh0O1xuICAgICAgICBuZXdfbm9kZS5wcmV2ID0gbm9kZTtcbiAgICAgICAgbm9kZS5uZXh0LnByZXYgPSBuZXdfbm9kZTtcbiAgICAgICAgbm9kZS5uZXh0ID0gbmV3X25vZGU7XG5cbiAgICAgICAgaWYgKCFTd2VlcC5sZWdhbGl6ZSh0Y3gsIHRyaWFuZ2xlKSkge1xuICAgICAgICAgICAgdGN4Lm1hcFRyaWFuZ2xlVG9Ob2Rlcyh0cmlhbmdsZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbmV3X25vZGU7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEFkZHMgYSB0cmlhbmdsZSB0byB0aGUgYWR2YW5jaW5nIGZyb250IHRvIGZpbGwgYSBob2xlLlxuICAgICAqIEBwYXJhbSB0Y3hcbiAgICAgKiBAcGFyYW0gbm9kZSAtIG1pZGRsZSBub2RlLCB0aGF0IGlzIHRoZSBib3R0b20gb2YgdGhlIGhvbGVcbiAgICAgKi9cbiAgICBTd2VlcC5maWxsID0gZnVuY3Rpb24odGN4LCBub2RlKSB7XG4gICAgICAgIHZhciB0cmlhbmdsZSA9IG5ldyBUcmlhbmdsZShub2RlLnByZXYucG9pbnQsIG5vZGUucG9pbnQsIG5vZGUubmV4dC5wb2ludCk7XG5cbiAgICAgICAgLy8gVE9ETzogc2hvdWxkIGNvcHkgdGhlIGNvbnN0cmFpbmVkX2VkZ2UgdmFsdWUgZnJvbSBuZWlnaGJvciB0cmlhbmdsZXNcbiAgICAgICAgLy8gICAgICAgZm9yIG5vdyBjb25zdHJhaW5lZF9lZGdlIHZhbHVlcyBhcmUgY29waWVkIGR1cmluZyB0aGUgbGVnYWxpemVcbiAgICAgICAgdHJpYW5nbGUubWFya05laWdoYm9yKG5vZGUucHJldi50cmlhbmdsZSk7XG4gICAgICAgIHRyaWFuZ2xlLm1hcmtOZWlnaGJvcihub2RlLnRyaWFuZ2xlKTtcblxuICAgICAgICB0Y3guYWRkVG9NYXAodHJpYW5nbGUpO1xuXG4gICAgICAgIC8vIFVwZGF0ZSB0aGUgYWR2YW5jaW5nIGZyb250XG4gICAgICAgIG5vZGUucHJldi5uZXh0ID0gbm9kZS5uZXh0O1xuICAgICAgICBub2RlLm5leHQucHJldiA9IG5vZGUucHJldjtcblxuXG4gICAgICAgIC8vIElmIGl0IHdhcyBsZWdhbGl6ZWQgdGhlIHRyaWFuZ2xlIGhhcyBhbHJlYWR5IGJlZW4gbWFwcGVkXG4gICAgICAgIGlmICghU3dlZXAubGVnYWxpemUodGN4LCB0cmlhbmdsZSkpIHtcbiAgICAgICAgICAgIHRjeC5tYXBUcmlhbmdsZVRvTm9kZXModHJpYW5nbGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy90Y3gucmVtb3ZlTm9kZShub2RlKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogRmlsbHMgaG9sZXMgaW4gdGhlIEFkdmFuY2luZyBGcm9udFxuICAgICAqL1xuICAgIFN3ZWVwLmZpbGxBZHZhbmNpbmdGcm9udCA9IGZ1bmN0aW9uKHRjeCwgbikge1xuICAgICAgICAvLyBGaWxsIHJpZ2h0IGhvbGVzXG4gICAgICAgIHZhciBub2RlID0gbi5uZXh0O1xuICAgICAgICB2YXIgYW5nbGU7XG4gICAgICAgIHdoaWxlIChub2RlLm5leHQpIHtcbiAgICAgICAgICAgIGFuZ2xlID0gU3dlZXAuaG9sZUFuZ2xlKG5vZGUpO1xuICAgICAgICAgICAgaWYgKGFuZ2xlID4gUElfMiB8fCBhbmdsZSA8IC0oUElfMikpIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFN3ZWVwLmZpbGwodGN4LCBub2RlKTtcbiAgICAgICAgICAgIG5vZGUgPSBub2RlLm5leHQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGaWxsIGxlZnQgaG9sZXNcbiAgICAgICAgbm9kZSA9IG4ucHJldjtcbiAgICAgICAgd2hpbGUgKG5vZGUucHJldikge1xuICAgICAgICAgICAgYW5nbGUgPSBTd2VlcC5ob2xlQW5nbGUobm9kZSk7XG4gICAgICAgICAgICBpZiAoYW5nbGUgPiBQSV8yIHx8IGFuZ2xlIDwgLShQSV8yKSkge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgU3dlZXAuZmlsbCh0Y3gsIG5vZGUpO1xuICAgICAgICAgICAgbm9kZSA9IG5vZGUucHJldjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEZpbGwgcmlnaHQgYmFzaW5zXG4gICAgICAgIGlmIChuLm5leHQgJiYgbi5uZXh0Lm5leHQpIHtcbiAgICAgICAgICAgIGFuZ2xlID0gU3dlZXAuYmFzaW5BbmdsZShuKTtcbiAgICAgICAgICAgIGlmIChhbmdsZSA8IFBJXzNkaXY0KSB7XG4gICAgICAgICAgICAgICAgU3dlZXAuZmlsbEJhc2luKHRjeCwgbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgU3dlZXAuYmFzaW5BbmdsZSA9IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICAgICAgdmFyIGF4ID0gbm9kZS5wb2ludC54IC0gbm9kZS5uZXh0Lm5leHQucG9pbnQueDtcbiAgICAgICAgdmFyIGF5ID0gbm9kZS5wb2ludC55IC0gbm9kZS5uZXh0Lm5leHQucG9pbnQueTtcbiAgICAgICAgcmV0dXJuIE1hdGguYXRhbjIoYXksIGF4KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0gbm9kZSAtIG1pZGRsZSBub2RlXG4gICAgICogQHJldHVybiB0aGUgYW5nbGUgYmV0d2VlbiAzIGZyb250IG5vZGVzXG4gICAgICovXG4gICAgU3dlZXAuaG9sZUFuZ2xlID0gZnVuY3Rpb24obm9kZSkge1xuICAgICAgICAvKiBDb21wbGV4IHBsYW5lXG4gICAgICAgICAqIGFiID0gY29zQSAraSpzaW5BXG4gICAgICAgICAqIGFiID0gKGF4ICsgYXkqaSkoYnggKyBieSppKSA9IChheCpieCArIGF5KmJ5KSArIGkoYXgqYnktYXkqYngpXG4gICAgICAgICAqIGF0YW4yKHkseCkgY29tcHV0ZXMgdGhlIHByaW5jaXBhbCB2YWx1ZSBvZiB0aGUgYXJndW1lbnQgZnVuY3Rpb25cbiAgICAgICAgICogYXBwbGllZCB0byB0aGUgY29tcGxleCBudW1iZXIgeCtpeVxuICAgICAgICAgKiBXaGVyZSB4ID0gYXgqYnggKyBheSpieVxuICAgICAgICAgKiAgICAgICB5ID0gYXgqYnkgLSBheSpieFxuICAgICAgICAgKi9cbiAgICAgICAgdmFyIGF4ID0gbm9kZS5uZXh0LnBvaW50LnggLSBub2RlLnBvaW50Lng7XG4gICAgICAgIHZhciBheSA9IG5vZGUubmV4dC5wb2ludC55IC0gbm9kZS5wb2ludC55O1xuICAgICAgICB2YXIgYnggPSBub2RlLnByZXYucG9pbnQueCAtIG5vZGUucG9pbnQueDtcbiAgICAgICAgdmFyIGJ5ID0gbm9kZS5wcmV2LnBvaW50LnkgLSBub2RlLnBvaW50Lnk7XG4gICAgICAgIHJldHVybiBNYXRoLmF0YW4yKGF4ICogYnkgLSBheSAqIGJ4LCBheCAqIGJ4ICsgYXkgKiBieSk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0cmlhbmdsZSB3YXMgbGVnYWxpemVkXG4gICAgICovXG4gICAgU3dlZXAubGVnYWxpemUgPSBmdW5jdGlvbih0Y3gsIHQpIHtcbiAgICAgICAgLy8gVG8gbGVnYWxpemUgYSB0cmlhbmdsZSB3ZSBzdGFydCBieSBmaW5kaW5nIGlmIGFueSBvZiB0aGUgdGhyZWUgZWRnZXNcbiAgICAgICAgLy8gdmlvbGF0ZSB0aGUgRGVsYXVuYXkgY29uZGl0aW9uXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgMzsgKytpKSB7XG4gICAgICAgICAgICBpZiAodC5kZWxhdW5heV9lZGdlW2ldKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgb3QgPSB0LmdldE5laWdoYm9yKGkpO1xuICAgICAgICAgICAgaWYgKG90KSB7XG4gICAgICAgICAgICAgICAgdmFyIHAgPSB0LmdldFBvaW50KGkpO1xuICAgICAgICAgICAgICAgIHZhciBvcCA9IG90Lm9wcG9zaXRlUG9pbnQodCwgcCk7XG4gICAgICAgICAgICAgICAgdmFyIG9pID0gb3QuaW5kZXgob3ApO1xuXG4gICAgICAgICAgICAgICAgLy8gSWYgdGhpcyBpcyBhIENvbnN0cmFpbmVkIEVkZ2Ugb3IgYSBEZWxhdW5heSBFZGdlKG9ubHkgZHVyaW5nIHJlY3Vyc2l2ZSBsZWdhbGl6YXRpb24pXG4gICAgICAgICAgICAgICAgLy8gdGhlbiB3ZSBzaG91bGQgbm90IHRyeSB0byBsZWdhbGl6ZVxuICAgICAgICAgICAgICAgIGlmIChvdC5jb25zdHJhaW5lZF9lZGdlW29pXSB8fCBvdC5kZWxhdW5heV9lZGdlW29pXSkge1xuICAgICAgICAgICAgICAgICAgICB0LmNvbnN0cmFpbmVkX2VkZ2VbaV0gPSBvdC5jb25zdHJhaW5lZF9lZGdlW29pXTtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdmFyIGluc2lkZSA9IFN3ZWVwLmluQ2lyY2xlKHAsIHQucG9pbnRDQ1cocCksIHQucG9pbnRDVyhwKSwgb3ApO1xuICAgICAgICAgICAgICAgIGlmIChpbnNpZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gTGV0cyBtYXJrIHRoaXMgc2hhcmVkIGVkZ2UgYXMgRGVsYXVuYXlcbiAgICAgICAgICAgICAgICAgICAgdC5kZWxhdW5heV9lZGdlW2ldID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgb3QuZGVsYXVuYXlfZWRnZVtvaV0gPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIExldHMgcm90YXRlIHNoYXJlZCBlZGdlIG9uZSB2ZXJ0ZXggQ1cgdG8gbGVnYWxpemUgaXRcbiAgICAgICAgICAgICAgICAgICAgU3dlZXAucm90YXRlVHJpYW5nbGVQYWlyKHQsIHAsIG90LCBvcCk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gV2Ugbm93IGdvdCBvbmUgdmFsaWQgRGVsYXVuYXkgRWRnZSBzaGFyZWQgYnkgdHdvIHRyaWFuZ2xlc1xuICAgICAgICAgICAgICAgICAgICAvLyBUaGlzIGdpdmVzIHVzIDQgbmV3IGVkZ2VzIHRvIGNoZWNrIGZvciBEZWxhdW5heVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIE1ha2Ugc3VyZSB0aGF0IHRyaWFuZ2xlIHRvIG5vZGUgbWFwcGluZyBpcyBkb25lIG9ubHkgb25lIHRpbWUgZm9yIGEgc3BlY2lmaWMgdHJpYW5nbGVcbiAgICAgICAgICAgICAgICAgICAgdmFyIG5vdF9sZWdhbGl6ZWQgPSAhU3dlZXAubGVnYWxpemUodGN4LCB0KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5vdF9sZWdhbGl6ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRjeC5tYXBUcmlhbmdsZVRvTm9kZXModCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBub3RfbGVnYWxpemVkID0gIVN3ZWVwLmxlZ2FsaXplKHRjeCwgb3QpO1xuICAgICAgICAgICAgICAgICAgICBpZiAobm90X2xlZ2FsaXplZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGN4Lm1hcFRyaWFuZ2xlVG9Ob2RlcyhvdCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLy8gUmVzZXQgdGhlIERlbGF1bmF5IGVkZ2VzLCBzaW5jZSB0aGV5IG9ubHkgYXJlIHZhbGlkIERlbGF1bmF5IGVkZ2VzXG4gICAgICAgICAgICAgICAgICAgIC8vIHVudGlsIHdlIGFkZCBhIG5ldyB0cmlhbmdsZSBvciBwb2ludC5cbiAgICAgICAgICAgICAgICAgICAgLy8gWFhYOiBuZWVkIHRvIHRoaW5rIGFib3V0IHRoaXMuIENhbiB0aGVzZSBlZGdlcyBiZSB0cmllZCBhZnRlciB3ZVxuICAgICAgICAgICAgICAgICAgICAvLyAgICAgIHJldHVybiB0byBwcmV2aW91cyByZWN1cnNpdmUgbGV2ZWw/XG4gICAgICAgICAgICAgICAgICAgIHQuZGVsYXVuYXlfZWRnZVtpXSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBvdC5kZWxhdW5heV9lZGdlW29pXSA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIElmIHRyaWFuZ2xlIGhhdmUgYmVlbiBsZWdhbGl6ZWQgbm8gbmVlZCB0byBjaGVjayB0aGUgb3RoZXIgZWRnZXMgc2luY2VcbiAgICAgICAgICAgICAgICAgICAgLy8gdGhlIHJlY3Vyc2l2ZSBsZWdhbGl6YXRpb24gd2lsbCBoYW5kbGVzIHRob3NlIHNvIHdlIGNhbiBlbmQgaGVyZS5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogPGI+UmVxdWlyZW1lbnQ8L2I+Ojxicj5cbiAgICAgKiAxLiBhLGIgYW5kIGMgZm9ybSBhIHRyaWFuZ2xlLjxicj5cbiAgICAgKiAyLiBhIGFuZCBkIGlzIGtub3cgdG8gYmUgb24gb3Bwb3NpdGUgc2lkZSBvZiBiYzxicj5cbiAgICAgKiA8cHJlPlxuICAgICAqICAgICAgICAgICAgICAgIGFcbiAgICAgKiAgICAgICAgICAgICAgICArXG4gICAgICogICAgICAgICAgICAgICAvIFxcXG4gICAgICogICAgICAgICAgICAgIC8gICBcXFxuICAgICAqICAgICAgICAgICAgYi8gICAgIFxcY1xuICAgICAqICAgICAgICAgICAgKy0tLS0tLS0rXG4gICAgICogICAgICAgICAgIC8gICAgZCAgICBcXFxuICAgICAqICAgICAgICAgIC8gICAgICAgICAgIFxcXG4gICAgICogPC9wcmU+XG4gICAgICogPGI+RmFjdDwvYj46IGQgaGFzIHRvIGJlIGluIGFyZWEgQiB0byBoYXZlIGEgY2hhbmNlIHRvIGJlIGluc2lkZSB0aGUgY2lyY2xlIGZvcm1lZCBieVxuICAgICAqICBhLGIgYW5kIGM8YnI+XG4gICAgICogIGQgaXMgb3V0c2lkZSBCIGlmIG9yaWVudDJkKGEsYixkKSBvciBvcmllbnQyZChjLGEsZCkgaXMgQ1c8YnI+XG4gICAgICogIFRoaXMgcHJla25vd2xlZGdlIGdpdmVzIHVzIGEgd2F5IHRvIG9wdGltaXplIHRoZSBpbmNpcmNsZSB0ZXN0XG4gICAgICogQHBhcmFtIHBhIC0gdHJpYW5nbGUgcG9pbnQsIG9wcG9zaXRlIGRcbiAgICAgKiBAcGFyYW0gcGIgLSB0cmlhbmdsZSBwb2ludFxuICAgICAqIEBwYXJhbSBwYyAtIHRyaWFuZ2xlIHBvaW50XG4gICAgICogQHBhcmFtIHBkIC0gcG9pbnQgb3Bwb3NpdGUgYVxuICAgICAqIEByZXR1cm4gdHJ1ZSBpZiBkIGlzIGluc2lkZSBjaXJjbGUsIGZhbHNlIGlmIG9uIGNpcmNsZSBlZGdlXG4gICAgICovXG4gICAgU3dlZXAuaW5DaXJjbGUgPSBmdW5jdGlvbihwYSwgcGIsIHBjLCBwZCkge1xuICAgICAgICB2YXIgYWR4ID0gcGEueCAtIHBkLng7XG4gICAgICAgIHZhciBhZHkgPSBwYS55IC0gcGQueTtcbiAgICAgICAgdmFyIGJkeCA9IHBiLnggLSBwZC54O1xuICAgICAgICB2YXIgYmR5ID0gcGIueSAtIHBkLnk7XG5cbiAgICAgICAgdmFyIGFkeGJkeSA9IGFkeCAqIGJkeTtcbiAgICAgICAgdmFyIGJkeGFkeSA9IGJkeCAqIGFkeTtcbiAgICAgICAgdmFyIG9hYmQgPSBhZHhiZHkgLSBiZHhhZHk7XG4gICAgICAgIGlmIChvYWJkIDw9IDApIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBjZHggPSBwYy54IC0gcGQueDtcbiAgICAgICAgdmFyIGNkeSA9IHBjLnkgLSBwZC55O1xuXG4gICAgICAgIHZhciBjZHhhZHkgPSBjZHggKiBhZHk7XG4gICAgICAgIHZhciBhZHhjZHkgPSBhZHggKiBjZHk7XG4gICAgICAgIHZhciBvY2FkID0gY2R4YWR5IC0gYWR4Y2R5O1xuICAgICAgICBpZiAob2NhZCA8PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgYmR4Y2R5ID0gYmR4ICogY2R5O1xuICAgICAgICB2YXIgY2R4YmR5ID0gY2R4ICogYmR5O1xuXG4gICAgICAgIHZhciBhbGlmdCA9IGFkeCAqIGFkeCArIGFkeSAqIGFkeTtcbiAgICAgICAgdmFyIGJsaWZ0ID0gYmR4ICogYmR4ICsgYmR5ICogYmR5O1xuICAgICAgICB2YXIgY2xpZnQgPSBjZHggKiBjZHggKyBjZHkgKiBjZHk7XG5cbiAgICAgICAgdmFyIGRldCA9IGFsaWZ0ICogKGJkeGNkeSAtIGNkeGJkeSkgKyBibGlmdCAqIG9jYWQgKyBjbGlmdCAqIG9hYmQ7XG4gICAgICAgIHJldHVybiBkZXQgPiAwO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBSb3RhdGVzIGEgdHJpYW5nbGUgcGFpciBvbmUgdmVydGV4IENXXG4gICAgICo8cHJlPlxuICAgICAqICAgICAgIG4yICAgICAgICAgICAgICAgICAgICBuMlxuICAgICAqICBQICstLS0tLSsgICAgICAgICAgICAgUCArLS0tLS0rXG4gICAgICogICAgfCB0ICAvfCAgICAgICAgICAgICAgIHxcXCAgdCB8XG4gICAgICogICAgfCAgIC8gfCAgICAgICAgICAgICAgIHwgXFwgICB8XG4gICAgICogIG4xfCAgLyAgfG4zICAgICAgICAgICBuMXwgIFxcICB8bjNcbiAgICAgKiAgICB8IC8gICB8ICAgIGFmdGVyIENXICAgfCAgIFxcIHxcbiAgICAgKiAgICB8LyBvVCB8ICAgICAgICAgICAgICAgfCBvVCBcXHxcbiAgICAgKiAgICArLS0tLS0rIG9QICAgICAgICAgICAgKy0tLS0tK1xuICAgICAqICAgICAgIG40ICAgICAgICAgICAgICAgICAgICBuNFxuICAgICAqIDwvcHJlPlxuICAgICAqL1xuICAgIFN3ZWVwLnJvdGF0ZVRyaWFuZ2xlUGFpciA9IGZ1bmN0aW9uKHQsIHAsIG90LCBvcCkge1xuICAgICAgICB2YXIgbjEsIG4yLCBuMywgbjQ7XG4gICAgICAgIG4xID0gdC5uZWlnaGJvckNDVyhwKTtcbiAgICAgICAgbjIgPSB0Lm5laWdoYm9yQ1cocCk7XG4gICAgICAgIG4zID0gb3QubmVpZ2hib3JDQ1cob3ApO1xuICAgICAgICBuNCA9IG90Lm5laWdoYm9yQ1cob3ApO1xuXG4gICAgICAgIHZhciBjZTEsIGNlMiwgY2UzLCBjZTQ7XG4gICAgICAgIGNlMSA9IHQuZ2V0Q29uc3RyYWluZWRFZGdlQ0NXKHApO1xuICAgICAgICBjZTIgPSB0LmdldENvbnN0cmFpbmVkRWRnZUNXKHApO1xuICAgICAgICBjZTMgPSBvdC5nZXRDb25zdHJhaW5lZEVkZ2VDQ1cob3ApO1xuICAgICAgICBjZTQgPSBvdC5nZXRDb25zdHJhaW5lZEVkZ2VDVyhvcCk7XG5cbiAgICAgICAgdmFyIGRlMSwgZGUyLCBkZTMsIGRlNDtcbiAgICAgICAgZGUxID0gdC5nZXREZWxhdW5heUVkZ2VDQ1cocCk7XG4gICAgICAgIGRlMiA9IHQuZ2V0RGVsYXVuYXlFZGdlQ1cocCk7XG4gICAgICAgIGRlMyA9IG90LmdldERlbGF1bmF5RWRnZUNDVyhvcCk7XG4gICAgICAgIGRlNCA9IG90LmdldERlbGF1bmF5RWRnZUNXKG9wKTtcblxuICAgICAgICB0LmxlZ2FsaXplKHAsIG9wKTtcbiAgICAgICAgb3QubGVnYWxpemUob3AsIHApO1xuXG4gICAgICAgIC8vIFJlbWFwIGRlbGF1bmF5X2VkZ2VcbiAgICAgICAgb3Quc2V0RGVsYXVuYXlFZGdlQ0NXKHAsIGRlMSk7XG4gICAgICAgIHQuc2V0RGVsYXVuYXlFZGdlQ1cocCwgZGUyKTtcbiAgICAgICAgdC5zZXREZWxhdW5heUVkZ2VDQ1cob3AsIGRlMyk7XG4gICAgICAgIG90LnNldERlbGF1bmF5RWRnZUNXKG9wLCBkZTQpO1xuXG4gICAgICAgIC8vIFJlbWFwIGNvbnN0cmFpbmVkX2VkZ2VcbiAgICAgICAgb3Quc2V0Q29uc3RyYWluZWRFZGdlQ0NXKHAsIGNlMSk7XG4gICAgICAgIHQuc2V0Q29uc3RyYWluZWRFZGdlQ1cocCwgY2UyKTtcbiAgICAgICAgdC5zZXRDb25zdHJhaW5lZEVkZ2VDQ1cob3AsIGNlMyk7XG4gICAgICAgIG90LnNldENvbnN0cmFpbmVkRWRnZUNXKG9wLCBjZTQpO1xuXG4gICAgICAgIC8vIFJlbWFwIG5laWdoYm9yc1xuICAgICAgICAvLyBYWFg6IG1pZ2h0IG9wdGltaXplIHRoZSBtYXJrTmVpZ2hib3IgYnkga2VlcGluZyB0cmFjayBvZlxuICAgICAgICAvLyAgICAgIHdoYXQgc2lkZSBzaG91bGQgYmUgYXNzaWduZWQgdG8gd2hhdCBuZWlnaGJvciBhZnRlciB0aGVcbiAgICAgICAgLy8gICAgICByb3RhdGlvbi4gTm93IG1hcmsgbmVpZ2hib3IgZG9lcyBsb3RzIG9mIHRlc3RpbmcgdG8gZmluZFxuICAgICAgICAvLyAgICAgIHRoZSByaWdodCBzaWRlLlxuICAgICAgICB0LmNsZWFyTmVpZ2JvcnMoKTtcbiAgICAgICAgb3QuY2xlYXJOZWlnYm9ycygpO1xuICAgICAgICBpZiAobjEpIHtcbiAgICAgICAgICAgIG90Lm1hcmtOZWlnaGJvcihuMSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG4yKSB7XG4gICAgICAgICAgICB0Lm1hcmtOZWlnaGJvcihuMik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG4zKSB7XG4gICAgICAgICAgICB0Lm1hcmtOZWlnaGJvcihuMyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG40KSB7XG4gICAgICAgICAgICBvdC5tYXJrTmVpZ2hib3IobjQpO1xuICAgICAgICB9XG4gICAgICAgIHQubWFya05laWdoYm9yKG90KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogRmlsbHMgYSBiYXNpbiB0aGF0IGhhcyBmb3JtZWQgb24gdGhlIEFkdmFuY2luZyBGcm9udCB0byB0aGUgcmlnaHRcbiAgICAgKiBvZiBnaXZlbiBub2RlLjxicj5cbiAgICAgKiBGaXJzdCB3ZSBkZWNpZGUgYSBsZWZ0LGJvdHRvbSBhbmQgcmlnaHQgbm9kZSB0aGF0IGZvcm1zIHRoZVxuICAgICAqIGJvdW5kYXJpZXMgb2YgdGhlIGJhc2luLiBUaGVuIHdlIGRvIGEgcmVxdXJzaXZlIGZpbGwuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gdGN4XG4gICAgICogQHBhcmFtIG5vZGUgLSBzdGFydGluZyBub2RlLCB0aGlzIG9yIG5leHQgbm9kZSB3aWxsIGJlIGxlZnQgbm9kZVxuICAgICAqL1xuICAgIFN3ZWVwLmZpbGxCYXNpbiA9IGZ1bmN0aW9uKHRjeCwgbm9kZSkge1xuICAgICAgICBpZiAob3JpZW50MmQobm9kZS5wb2ludCwgbm9kZS5uZXh0LnBvaW50LCBub2RlLm5leHQubmV4dC5wb2ludCkgPT09IE9yaWVudGF0aW9uLkNDVykge1xuICAgICAgICAgICAgdGN4LmJhc2luLmxlZnRfbm9kZSA9IG5vZGUubmV4dC5uZXh0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGN4LmJhc2luLmxlZnRfbm9kZSA9IG5vZGUubmV4dDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEZpbmQgdGhlIGJvdHRvbSBhbmQgcmlnaHQgbm9kZVxuICAgICAgICB0Y3guYmFzaW4uYm90dG9tX25vZGUgPSB0Y3guYmFzaW4ubGVmdF9ub2RlO1xuICAgICAgICB3aGlsZSAodGN4LmJhc2luLmJvdHRvbV9ub2RlLm5leHQgJiYgdGN4LmJhc2luLmJvdHRvbV9ub2RlLnBvaW50LnkgPj0gdGN4LmJhc2luLmJvdHRvbV9ub2RlLm5leHQucG9pbnQueSkge1xuICAgICAgICAgICAgdGN4LmJhc2luLmJvdHRvbV9ub2RlID0gdGN4LmJhc2luLmJvdHRvbV9ub2RlLm5leHQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRjeC5iYXNpbi5ib3R0b21fbm9kZSA9PT0gdGN4LmJhc2luLmxlZnRfbm9kZSkge1xuICAgICAgICAgICAgLy8gTm8gdmFsaWQgYmFzaW5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRjeC5iYXNpbi5yaWdodF9ub2RlID0gdGN4LmJhc2luLmJvdHRvbV9ub2RlO1xuICAgICAgICB3aGlsZSAodGN4LmJhc2luLnJpZ2h0X25vZGUubmV4dCAmJiB0Y3guYmFzaW4ucmlnaHRfbm9kZS5wb2ludC55IDwgdGN4LmJhc2luLnJpZ2h0X25vZGUubmV4dC5wb2ludC55KSB7XG4gICAgICAgICAgICB0Y3guYmFzaW4ucmlnaHRfbm9kZSA9IHRjeC5iYXNpbi5yaWdodF9ub2RlLm5leHQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRjeC5iYXNpbi5yaWdodF9ub2RlID09PSB0Y3guYmFzaW4uYm90dG9tX25vZGUpIHtcbiAgICAgICAgICAgIC8vIE5vIHZhbGlkIGJhc2luc1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGN4LmJhc2luLndpZHRoID0gdGN4LmJhc2luLnJpZ2h0X25vZGUucG9pbnQueCAtIHRjeC5iYXNpbi5sZWZ0X25vZGUucG9pbnQueDtcbiAgICAgICAgdGN4LmJhc2luLmxlZnRfaGlnaGVzdCA9IHRjeC5iYXNpbi5sZWZ0X25vZGUucG9pbnQueSA+IHRjeC5iYXNpbi5yaWdodF9ub2RlLnBvaW50Lnk7XG5cbiAgICAgICAgU3dlZXAuZmlsbEJhc2luUmVxKHRjeCwgdGN4LmJhc2luLmJvdHRvbV9ub2RlKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogUmVjdXJzaXZlIGFsZ29yaXRobSB0byBmaWxsIGEgQmFzaW4gd2l0aCB0cmlhbmdsZXNcbiAgICAgKlxuICAgICAqIEBwYXJhbSB0Y3hcbiAgICAgKiBAcGFyYW0gbm9kZSAtIGJvdHRvbV9ub2RlXG4gICAgICovXG4gICAgU3dlZXAuZmlsbEJhc2luUmVxID0gZnVuY3Rpb24odGN4LCBub2RlKSB7XG4gICAgICAgIC8vIGlmIHNoYWxsb3cgc3RvcCBmaWxsaW5nXG4gICAgICAgIGlmIChTd2VlcC5pc1NoYWxsb3codGN4LCBub2RlKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgU3dlZXAuZmlsbCh0Y3gsIG5vZGUpO1xuXG4gICAgICAgIHZhciBvO1xuICAgICAgICBpZiAobm9kZS5wcmV2ID09PSB0Y3guYmFzaW4ubGVmdF9ub2RlICYmIG5vZGUubmV4dCA9PT0gdGN4LmJhc2luLnJpZ2h0X25vZGUpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfSBlbHNlIGlmIChub2RlLnByZXYgPT09IHRjeC5iYXNpbi5sZWZ0X25vZGUpIHtcbiAgICAgICAgICAgIG8gPSBvcmllbnQyZChub2RlLnBvaW50LCBub2RlLm5leHQucG9pbnQsIG5vZGUubmV4dC5uZXh0LnBvaW50KTtcbiAgICAgICAgICAgIGlmIChvID09PSBPcmllbnRhdGlvbi5DVykge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG5vZGUgPSBub2RlLm5leHQ7XG4gICAgICAgIH0gZWxzZSBpZiAobm9kZS5uZXh0ID09PSB0Y3guYmFzaW4ucmlnaHRfbm9kZSkge1xuICAgICAgICAgICAgbyA9IG9yaWVudDJkKG5vZGUucG9pbnQsIG5vZGUucHJldi5wb2ludCwgbm9kZS5wcmV2LnByZXYucG9pbnQpO1xuICAgICAgICAgICAgaWYgKG8gPT09IE9yaWVudGF0aW9uLkNDVykge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG5vZGUgPSBub2RlLnByZXY7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBDb250aW51ZSB3aXRoIHRoZSBuZWlnaGJvciBub2RlIHdpdGggbG93ZXN0IFkgdmFsdWVcbiAgICAgICAgICAgIGlmIChub2RlLnByZXYucG9pbnQueSA8IG5vZGUubmV4dC5wb2ludC55KSB7XG4gICAgICAgICAgICAgICAgbm9kZSA9IG5vZGUucHJldjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbm9kZSA9IG5vZGUubmV4dDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIFN3ZWVwLmZpbGxCYXNpblJlcSh0Y3gsIG5vZGUpO1xuICAgIH07XG5cbiAgICBTd2VlcC5pc1NoYWxsb3cgPSBmdW5jdGlvbih0Y3gsIG5vZGUpIHtcbiAgICAgICAgdmFyIGhlaWdodDtcbiAgICAgICAgaWYgKHRjeC5iYXNpbi5sZWZ0X2hpZ2hlc3QpIHtcbiAgICAgICAgICAgIGhlaWdodCA9IHRjeC5iYXNpbi5sZWZ0X25vZGUucG9pbnQueSAtIG5vZGUucG9pbnQueTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGhlaWdodCA9IHRjeC5iYXNpbi5yaWdodF9ub2RlLnBvaW50LnkgLSBub2RlLnBvaW50Lnk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiBzaGFsbG93IHN0b3AgZmlsbGluZ1xuICAgICAgICBpZiAodGN4LmJhc2luLndpZHRoID4gaGVpZ2h0KSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfTtcblxuICAgIFN3ZWVwLmZpbGxFZGdlRXZlbnQgPSBmdW5jdGlvbih0Y3gsIGVkZ2UsIG5vZGUpIHtcbiAgICAgICAgaWYgKHRjeC5lZGdlX2V2ZW50LnJpZ2h0KSB7XG4gICAgICAgICAgICBTd2VlcC5maWxsUmlnaHRBYm92ZUVkZ2VFdmVudCh0Y3gsIGVkZ2UsIG5vZGUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgU3dlZXAuZmlsbExlZnRBYm92ZUVkZ2VFdmVudCh0Y3gsIGVkZ2UsIG5vZGUpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIFN3ZWVwLmZpbGxSaWdodEFib3ZlRWRnZUV2ZW50ID0gZnVuY3Rpb24odGN4LCBlZGdlLCBub2RlKSB7XG4gICAgICAgIHdoaWxlIChub2RlLm5leHQucG9pbnQueCA8IGVkZ2UucC54KSB7XG4gICAgICAgICAgICAvLyBDaGVjayBpZiBuZXh0IG5vZGUgaXMgYmVsb3cgdGhlIGVkZ2VcbiAgICAgICAgICAgIGlmIChvcmllbnQyZChlZGdlLnEsIG5vZGUubmV4dC5wb2ludCwgZWRnZS5wKSA9PT0gT3JpZW50YXRpb24uQ0NXKSB7XG4gICAgICAgICAgICAgICAgU3dlZXAuZmlsbFJpZ2h0QmVsb3dFZGdlRXZlbnQodGN4LCBlZGdlLCBub2RlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbm9kZSA9IG5vZGUubmV4dDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBTd2VlcC5maWxsUmlnaHRCZWxvd0VkZ2VFdmVudCA9IGZ1bmN0aW9uKHRjeCwgZWRnZSwgbm9kZSkge1xuICAgICAgICBpZiAobm9kZS5wb2ludC54IDwgZWRnZS5wLngpIHtcbiAgICAgICAgICAgIGlmIChvcmllbnQyZChub2RlLnBvaW50LCBub2RlLm5leHQucG9pbnQsIG5vZGUubmV4dC5uZXh0LnBvaW50KSA9PT0gT3JpZW50YXRpb24uQ0NXKSB7XG4gICAgICAgICAgICAgICAgLy8gQ29uY2F2ZVxuICAgICAgICAgICAgICAgIFN3ZWVwLmZpbGxSaWdodENvbmNhdmVFZGdlRXZlbnQodGN4LCBlZGdlLCBub2RlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gQ29udmV4XG4gICAgICAgICAgICAgICAgU3dlZXAuZmlsbFJpZ2h0Q29udmV4RWRnZUV2ZW50KHRjeCwgZWRnZSwgbm9kZSk7XG4gICAgICAgICAgICAgICAgLy8gUmV0cnkgdGhpcyBvbmVcbiAgICAgICAgICAgICAgICBTd2VlcC5maWxsUmlnaHRCZWxvd0VkZ2VFdmVudCh0Y3gsIGVkZ2UsIG5vZGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIFN3ZWVwLmZpbGxSaWdodENvbmNhdmVFZGdlRXZlbnQgPSBmdW5jdGlvbih0Y3gsIGVkZ2UsIG5vZGUpIHtcbiAgICAgICAgU3dlZXAuZmlsbCh0Y3gsIG5vZGUubmV4dCk7XG4gICAgICAgIGlmIChub2RlLm5leHQucG9pbnQgIT09IGVkZ2UucCkge1xuICAgICAgICAgICAgLy8gTmV4dCBhYm92ZSBvciBiZWxvdyBlZGdlP1xuICAgICAgICAgICAgaWYgKG9yaWVudDJkKGVkZ2UucSwgbm9kZS5uZXh0LnBvaW50LCBlZGdlLnApID09PSBPcmllbnRhdGlvbi5DQ1cpIHtcbiAgICAgICAgICAgICAgICAvLyBCZWxvd1xuICAgICAgICAgICAgICAgIGlmIChvcmllbnQyZChub2RlLnBvaW50LCBub2RlLm5leHQucG9pbnQsIG5vZGUubmV4dC5uZXh0LnBvaW50KSA9PT0gT3JpZW50YXRpb24uQ0NXKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIE5leHQgaXMgY29uY2F2ZVxuICAgICAgICAgICAgICAgICAgICBTd2VlcC5maWxsUmlnaHRDb25jYXZlRWRnZUV2ZW50KHRjeCwgZWRnZSwgbm9kZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gTmV4dCBpcyBjb252ZXhcbiAgICAgICAgICAgICAgICAgICAgLyoganNoaW50IG5vZW1wdHk6ZmFsc2UgKi9cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgU3dlZXAuZmlsbFJpZ2h0Q29udmV4RWRnZUV2ZW50ID0gZnVuY3Rpb24odGN4LCBlZGdlLCBub2RlKSB7XG4gICAgICAgIC8vIE5leHQgY29uY2F2ZSBvciBjb252ZXg/XG4gICAgICAgIGlmIChvcmllbnQyZChub2RlLm5leHQucG9pbnQsIG5vZGUubmV4dC5uZXh0LnBvaW50LCBub2RlLm5leHQubmV4dC5uZXh0LnBvaW50KSA9PT0gT3JpZW50YXRpb24uQ0NXKSB7XG4gICAgICAgICAgICAvLyBDb25jYXZlXG4gICAgICAgICAgICBTd2VlcC5maWxsUmlnaHRDb25jYXZlRWRnZUV2ZW50KHRjeCwgZWRnZSwgbm9kZS5uZXh0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIENvbnZleFxuICAgICAgICAgICAgLy8gTmV4dCBhYm92ZSBvciBiZWxvdyBlZGdlP1xuICAgICAgICAgICAgaWYgKG9yaWVudDJkKGVkZ2UucSwgbm9kZS5uZXh0Lm5leHQucG9pbnQsIGVkZ2UucCkgPT09IE9yaWVudGF0aW9uLkNDVykge1xuICAgICAgICAgICAgICAgIC8vIEJlbG93XG4gICAgICAgICAgICAgICAgU3dlZXAuZmlsbFJpZ2h0Q29udmV4RWRnZUV2ZW50KHRjeCwgZWRnZSwgbm9kZS5uZXh0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gQWJvdmVcbiAgICAgICAgICAgICAgICAvKiBqc2hpbnQgbm9lbXB0eTpmYWxzZSAqL1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIFN3ZWVwLmZpbGxMZWZ0QWJvdmVFZGdlRXZlbnQgPSBmdW5jdGlvbih0Y3gsIGVkZ2UsIG5vZGUpIHtcbiAgICAgICAgd2hpbGUgKG5vZGUucHJldi5wb2ludC54ID4gZWRnZS5wLngpIHtcbiAgICAgICAgICAgIC8vIENoZWNrIGlmIG5leHQgbm9kZSBpcyBiZWxvdyB0aGUgZWRnZVxuICAgICAgICAgICAgaWYgKG9yaWVudDJkKGVkZ2UucSwgbm9kZS5wcmV2LnBvaW50LCBlZGdlLnApID09PSBPcmllbnRhdGlvbi5DVykge1xuICAgICAgICAgICAgICAgIFN3ZWVwLmZpbGxMZWZ0QmVsb3dFZGdlRXZlbnQodGN4LCBlZGdlLCBub2RlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbm9kZSA9IG5vZGUucHJldjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBTd2VlcC5maWxsTGVmdEJlbG93RWRnZUV2ZW50ID0gZnVuY3Rpb24odGN4LCBlZGdlLCBub2RlKSB7XG4gICAgICAgIGlmIChub2RlLnBvaW50LnggPiBlZGdlLnAueCkge1xuICAgICAgICAgICAgaWYgKG9yaWVudDJkKG5vZGUucG9pbnQsIG5vZGUucHJldi5wb2ludCwgbm9kZS5wcmV2LnByZXYucG9pbnQpID09PSBPcmllbnRhdGlvbi5DVykge1xuICAgICAgICAgICAgICAgIC8vIENvbmNhdmVcbiAgICAgICAgICAgICAgICBTd2VlcC5maWxsTGVmdENvbmNhdmVFZGdlRXZlbnQodGN4LCBlZGdlLCBub2RlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gQ29udmV4XG4gICAgICAgICAgICAgICAgU3dlZXAuZmlsbExlZnRDb252ZXhFZGdlRXZlbnQodGN4LCBlZGdlLCBub2RlKTtcbiAgICAgICAgICAgICAgICAvLyBSZXRyeSB0aGlzIG9uZVxuICAgICAgICAgICAgICAgIFN3ZWVwLmZpbGxMZWZ0QmVsb3dFZGdlRXZlbnQodGN4LCBlZGdlLCBub2RlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBTd2VlcC5maWxsTGVmdENvbnZleEVkZ2VFdmVudCA9IGZ1bmN0aW9uKHRjeCwgZWRnZSwgbm9kZSkge1xuICAgICAgICAvLyBOZXh0IGNvbmNhdmUgb3IgY29udmV4P1xuICAgICAgICBpZiAob3JpZW50MmQobm9kZS5wcmV2LnBvaW50LCBub2RlLnByZXYucHJldi5wb2ludCwgbm9kZS5wcmV2LnByZXYucHJldi5wb2ludCkgPT09IE9yaWVudGF0aW9uLkNXKSB7XG4gICAgICAgICAgICAvLyBDb25jYXZlXG4gICAgICAgICAgICBTd2VlcC5maWxsTGVmdENvbmNhdmVFZGdlRXZlbnQodGN4LCBlZGdlLCBub2RlLnByZXYpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gQ29udmV4XG4gICAgICAgICAgICAvLyBOZXh0IGFib3ZlIG9yIGJlbG93IGVkZ2U/XG4gICAgICAgICAgICBpZiAob3JpZW50MmQoZWRnZS5xLCBub2RlLnByZXYucHJldi5wb2ludCwgZWRnZS5wKSA9PT0gT3JpZW50YXRpb24uQ1cpIHtcbiAgICAgICAgICAgICAgICAvLyBCZWxvd1xuICAgICAgICAgICAgICAgIFN3ZWVwLmZpbGxMZWZ0Q29udmV4RWRnZUV2ZW50KHRjeCwgZWRnZSwgbm9kZS5wcmV2KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gQWJvdmVcbiAgICAgICAgICAgICAgICAvKiBqc2hpbnQgbm9lbXB0eTpmYWxzZSAqL1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIFN3ZWVwLmZpbGxMZWZ0Q29uY2F2ZUVkZ2VFdmVudCA9IGZ1bmN0aW9uKHRjeCwgZWRnZSwgbm9kZSkge1xuICAgICAgICBTd2VlcC5maWxsKHRjeCwgbm9kZS5wcmV2KTtcbiAgICAgICAgaWYgKG5vZGUucHJldi5wb2ludCAhPT0gZWRnZS5wKSB7XG4gICAgICAgICAgICAvLyBOZXh0IGFib3ZlIG9yIGJlbG93IGVkZ2U/XG4gICAgICAgICAgICBpZiAob3JpZW50MmQoZWRnZS5xLCBub2RlLnByZXYucG9pbnQsIGVkZ2UucCkgPT09IE9yaWVudGF0aW9uLkNXKSB7XG4gICAgICAgICAgICAgICAgLy8gQmVsb3dcbiAgICAgICAgICAgICAgICBpZiAob3JpZW50MmQobm9kZS5wb2ludCwgbm9kZS5wcmV2LnBvaW50LCBub2RlLnByZXYucHJldi5wb2ludCkgPT09IE9yaWVudGF0aW9uLkNXKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIE5leHQgaXMgY29uY2F2ZVxuICAgICAgICAgICAgICAgICAgICBTd2VlcC5maWxsTGVmdENvbmNhdmVFZGdlRXZlbnQodGN4LCBlZGdlLCBub2RlKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBOZXh0IGlzIGNvbnZleFxuICAgICAgICAgICAgICAgICAgICAvKiBqc2hpbnQgbm9lbXB0eTpmYWxzZSAqL1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBTd2VlcC5mbGlwRWRnZUV2ZW50ID0gZnVuY3Rpb24odGN4LCBlcCwgZXEsIHQsIHApIHtcbiAgICAgICAgdmFyIG90ID0gdC5uZWlnaGJvckFjcm9zcyhwKTtcbiAgICAgICAgaWYgKCFvdCkge1xuICAgICAgICAgICAgLy8gSWYgd2Ugd2FudCB0byBpbnRlZ3JhdGUgdGhlIGZpbGxFZGdlRXZlbnQgZG8gaXQgaGVyZVxuICAgICAgICAgICAgLy8gV2l0aCBjdXJyZW50IGltcGxlbWVudGF0aW9uIHdlIHNob3VsZCBuZXZlciBnZXQgaGVyZVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdwb2x5MnRyaSBbQlVHOkZJWE1FXSBGTElQIGZhaWxlZCBkdWUgdG8gbWlzc2luZyB0cmlhbmdsZSEnKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgb3AgPSBvdC5vcHBvc2l0ZVBvaW50KHQsIHApO1xuXG4gICAgICAgIGlmIChpblNjYW5BcmVhKHAsIHQucG9pbnRDQ1cocCksIHQucG9pbnRDVyhwKSwgb3ApKSB7XG4gICAgICAgICAgICAvLyBMZXRzIHJvdGF0ZSBzaGFyZWQgZWRnZSBvbmUgdmVydGV4IENXXG4gICAgICAgICAgICBTd2VlcC5yb3RhdGVUcmlhbmdsZVBhaXIodCwgcCwgb3QsIG9wKTtcbiAgICAgICAgICAgIHRjeC5tYXBUcmlhbmdsZVRvTm9kZXModCk7XG4gICAgICAgICAgICB0Y3gubWFwVHJpYW5nbGVUb05vZGVzKG90KTtcblxuICAgICAgICAgICAgLy8gWFhYOiBpbiB0aGUgb3JpZ2luYWwgQysrIGNvZGUgZm9yIHRoZSBuZXh0IDIgbGluZXMsIHdlIGFyZVxuICAgICAgICAgICAgLy8gY29tcGFyaW5nIHBvaW50IHZhbHVlcyAoYW5kIG5vdCBwb2ludGVycykuIEluIHRoaXMgSmF2YVNjcmlwdFxuICAgICAgICAgICAgLy8gY29kZSwgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzIChwb2ludGVycykuIFRoaXMgd29ya3NcbiAgICAgICAgICAgIC8vIGJlY2F1c2Ugd2UgY2FuJ3QgaGF2ZSAyIGRpZmZlcmVudCBwb2ludHMgd2l0aCB0aGUgc2FtZSB2YWx1ZXMuXG4gICAgICAgICAgICAvLyBCdXQgdG8gYmUgcmVhbGx5IGVxdWl2YWxlbnQsIHdlIHNob3VsZCB1c2UgXCJQb2ludC5lcXVhbHNcIiBoZXJlLlxuICAgICAgICAgICAgaWYgKHAgPT09IGVxICYmIG9wID09PSBlcCkge1xuICAgICAgICAgICAgICAgIGlmIChlcSA9PT0gdGN4LmVkZ2VfZXZlbnQuY29uc3RyYWluZWRfZWRnZS5xICYmIGVwID09PSB0Y3guZWRnZV9ldmVudC5jb25zdHJhaW5lZF9lZGdlLnApIHtcbiAgICAgICAgICAgICAgICAgICAgdC5tYXJrQ29uc3RyYWluZWRFZGdlQnlQb2ludHMoZXAsIGVxKTtcbiAgICAgICAgICAgICAgICAgICAgb3QubWFya0NvbnN0cmFpbmVkRWRnZUJ5UG9pbnRzKGVwLCBlcSk7XG4gICAgICAgICAgICAgICAgICAgIFN3ZWVwLmxlZ2FsaXplKHRjeCwgdCk7XG4gICAgICAgICAgICAgICAgICAgIFN3ZWVwLmxlZ2FsaXplKHRjeCwgb3QpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFhYWDogSSB0aGluayBvbmUgb2YgdGhlIHRyaWFuZ2xlcyBzaG91bGQgYmUgbGVnYWxpemVkIGhlcmU/XG4gICAgICAgICAgICAgICAgICAgIC8qIGpzaGludCBub2VtcHR5OmZhbHNlICovXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YXIgbyA9IG9yaWVudDJkKGVxLCBvcCwgZXApO1xuICAgICAgICAgICAgICAgIHQgPSBTd2VlcC5uZXh0RmxpcFRyaWFuZ2xlKHRjeCwgbywgdCwgb3QsIHAsIG9wKTtcbiAgICAgICAgICAgICAgICBTd2VlcC5mbGlwRWRnZUV2ZW50KHRjeCwgZXAsIGVxLCB0LCBwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciBuZXdQID0gU3dlZXAubmV4dEZsaXBQb2ludChlcCwgZXEsIG90LCBvcCk7XG4gICAgICAgICAgICBTd2VlcC5mbGlwU2NhbkVkZ2VFdmVudCh0Y3gsIGVwLCBlcSwgdCwgb3QsIG5ld1ApO1xuICAgICAgICAgICAgU3dlZXAuZWRnZUV2ZW50QnlQb2ludHModGN4LCBlcCwgZXEsIHQsIHApO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIFN3ZWVwLm5leHRGbGlwVHJpYW5nbGUgPSBmdW5jdGlvbih0Y3gsIG8sIHQsIG90LCBwLCBvcCkge1xuICAgICAgICB2YXIgZWRnZV9pbmRleDtcbiAgICAgICAgaWYgKG8gPT09IE9yaWVudGF0aW9uLkNDVykge1xuICAgICAgICAgICAgLy8gb3QgaXMgbm90IGNyb3NzaW5nIGVkZ2UgYWZ0ZXIgZmxpcFxuICAgICAgICAgICAgZWRnZV9pbmRleCA9IG90LmVkZ2VJbmRleChwLCBvcCk7XG4gICAgICAgICAgICBvdC5kZWxhdW5heV9lZGdlW2VkZ2VfaW5kZXhdID0gdHJ1ZTtcbiAgICAgICAgICAgIFN3ZWVwLmxlZ2FsaXplKHRjeCwgb3QpO1xuICAgICAgICAgICAgb3QuY2xlYXJEZWx1bmF5RWRnZXMoKTtcbiAgICAgICAgICAgIHJldHVybiB0O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdCBpcyBub3QgY3Jvc3NpbmcgZWRnZSBhZnRlciBmbGlwXG4gICAgICAgIGVkZ2VfaW5kZXggPSB0LmVkZ2VJbmRleChwLCBvcCk7XG5cbiAgICAgICAgdC5kZWxhdW5heV9lZGdlW2VkZ2VfaW5kZXhdID0gdHJ1ZTtcbiAgICAgICAgU3dlZXAubGVnYWxpemUodGN4LCB0KTtcbiAgICAgICAgdC5jbGVhckRlbHVuYXlFZGdlcygpO1xuICAgICAgICByZXR1cm4gb3Q7XG4gICAgfTtcblxuICAgIFN3ZWVwLm5leHRGbGlwUG9pbnQgPSBmdW5jdGlvbihlcCwgZXEsIG90LCBvcCkge1xuICAgICAgICB2YXIgbzJkID0gb3JpZW50MmQoZXEsIG9wLCBlcCk7XG4gICAgICAgIGlmIChvMmQgPT09IE9yaWVudGF0aW9uLkNXKSB7XG4gICAgICAgICAgICAvLyBSaWdodFxuICAgICAgICAgICAgcmV0dXJuIG90LnBvaW50Q0NXKG9wKTtcbiAgICAgICAgfSBlbHNlIGlmIChvMmQgPT09IE9yaWVudGF0aW9uLkNDVykge1xuICAgICAgICAgICAgLy8gTGVmdFxuICAgICAgICAgICAgcmV0dXJuIG90LnBvaW50Q1cob3ApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFBvaW50RXJyb3IoXCJwb2x5MnRyaSBbVW5zdXBwb3J0ZWRdIG5leHRGbGlwUG9pbnQ6IG9wcG9zaW5nIHBvaW50IG9uIGNvbnN0cmFpbmVkIGVkZ2UhXCIsIFtlcSwgb3AsIGVwXSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgU3dlZXAuZmxpcFNjYW5FZGdlRXZlbnQgPSBmdW5jdGlvbih0Y3gsIGVwLCBlcSwgZmxpcF90cmlhbmdsZSwgdCwgcCkge1xuICAgICAgICB2YXIgb3QgPSB0Lm5laWdoYm9yQWNyb3NzKHApO1xuICAgICAgICBpZiAoIW90KSB7XG4gICAgICAgICAgICAvLyBJZiB3ZSB3YW50IHRvIGludGVncmF0ZSB0aGUgZmlsbEVkZ2VFdmVudCBkbyBpdCBoZXJlXG4gICAgICAgICAgICAvLyBXaXRoIGN1cnJlbnQgaW1wbGVtZW50YXRpb24gd2Ugc2hvdWxkIG5ldmVyIGdldCBoZXJlXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3BvbHkydHJpIFtCVUc6RklYTUVdIEZMSVAgZmFpbGVkIGR1ZSB0byBtaXNzaW5nIHRyaWFuZ2xlJyk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIG9wID0gb3Qub3Bwb3NpdGVQb2ludCh0LCBwKTtcblxuICAgICAgICBpZiAoaW5TY2FuQXJlYShlcSwgZmxpcF90cmlhbmdsZS5wb2ludENDVyhlcSksIGZsaXBfdHJpYW5nbGUucG9pbnRDVyhlcSksIG9wKSkge1xuICAgICAgICAgICAgLy8gZmxpcCB3aXRoIG5ldyBlZGdlIG9wLmVxXG4gICAgICAgICAgICBTd2VlcC5mbGlwRWRnZUV2ZW50KHRjeCwgZXEsIG9wLCBvdCwgb3ApO1xuICAgICAgICAgICAgLy8gVE9ETzogQWN0dWFsbHkgSSBqdXN0IGZpZ3VyZWQgb3V0IHRoYXQgaXQgc2hvdWxkIGJlIHBvc3NpYmxlIHRvXG4gICAgICAgICAgICAvLyAgICAgICBpbXByb3ZlIHRoaXMgYnkgZ2V0dGluZyB0aGUgbmV4dCBvdCBhbmQgb3AgYmVmb3JlIHRoZSB0aGUgYWJvdmVcbiAgICAgICAgICAgIC8vICAgICAgIGZsaXAgYW5kIGNvbnRpbnVlIHRoZSBmbGlwU2NhbkVkZ2VFdmVudCBoZXJlXG4gICAgICAgICAgICAvLyBzZXQgbmV3IG90IGFuZCBvcCBoZXJlIGFuZCBsb29wIGJhY2sgdG8gaW5TY2FuQXJlYSB0ZXN0XG4gICAgICAgICAgICAvLyBhbHNvIG5lZWQgdG8gc2V0IGEgbmV3IGZsaXBfdHJpYW5nbGUgZmlyc3RcbiAgICAgICAgICAgIC8vIFR1cm5zIG91dCBhdCBmaXJzdCBnbGFuY2UgdGhhdCB0aGlzIGlzIHNvbWV3aGF0IGNvbXBsaWNhdGVkXG4gICAgICAgICAgICAvLyBzbyBpdCB3aWxsIGhhdmUgdG8gd2FpdC5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciBuZXdQID0gU3dlZXAubmV4dEZsaXBQb2ludChlcCwgZXEsIG90LCBvcCk7XG4gICAgICAgICAgICBTd2VlcC5mbGlwU2NhbkVkZ2VFdmVudCh0Y3gsIGVwLCBlcSwgZmxpcF90cmlhbmdsZSwgb3QsIG5ld1ApO1xuICAgICAgICB9XG4gICAgfTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tRXhwb3J0cyAocHVibGljIEFQSSlcblxuICAgIHBvbHkydHJpLlBvaW50RXJyb3IgICAgID0gUG9pbnRFcnJvcjtcbiAgICBwb2x5MnRyaS5Qb2ludCAgICAgICAgICA9IFBvaW50O1xuICAgIHBvbHkydHJpLlRyaWFuZ2xlICAgICAgID0gVHJpYW5nbGU7XG4gICAgcG9seTJ0cmkuU3dlZXBDb250ZXh0ICAgPSBTd2VlcENvbnRleHQ7XG5cbiAgICAvLyBCYWNrd2FyZCBjb21wYXRpYmlsaXR5XG4gICAgcG9seTJ0cmkudHJpYW5ndWxhdGUgICAgPSBTd2VlcC50cmlhbmd1bGF0ZTtcbiAgICBwb2x5MnRyaS5zd2VlcCA9IHtUcmlhbmd1bGF0ZTogU3dlZXAudHJpYW5ndWxhdGV9O1xuXG59KHRoaXMpKTsiLCJ2YXIgZ2xNYXRyaXggPSByZXF1aXJlKCcuLi9qcy9nbC1tYXRyaXgtbWluLmpzJyk7XG52YXIgdmVjMyA9IGdsTWF0cml4LnZlYzM7XG5cblxuKGZ1bmN0aW9uKF9nbG9iYWwpIHsgXG4gIFwidXNlIHN0cmljdFwiO1xuXG4gIHZhciBzaGltID0ge307XG4gIGlmICh0eXBlb2YoZXhwb3J0cykgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYodHlwZW9mIGRlZmluZSA9PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBkZWZpbmUuYW1kID09ICdvYmplY3QnICYmIGRlZmluZS5hbWQpIHtcbiAgICAgIHNoaW0uZXhwb3J0cyA9IHt9O1xuICAgICAgZGVmaW5lKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gc2hpbS5leHBvcnRzO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vdGhpcyB0aGluZyBsaXZlcyBpbiBhIGJyb3dzZXIsIGRlZmluZSBpdHMgbmFtZXNwYWNlcyBpbiBnbG9iYWxcbiAgICAgIHNoaW0uZXhwb3J0cyA9IHR5cGVvZih3aW5kb3cpICE9PSAndW5kZWZpbmVkJyA/IHdpbmRvdyA6IF9nbG9iYWw7XG4gICAgfVxuICB9XG4gIGVsc2Uge1xuICAgIC8vdGhpcyB0aGluZyBsaXZlcyBpbiBjb21tb25qcywgZGVmaW5lIGl0cyBuYW1lc3BhY2VzIGluIGV4cG9ydHNcbiAgICBzaGltLmV4cG9ydHMgPSBleHBvcnRzO1xuICB9XG4gIChmdW5jdGlvbihleHBvcnRzKSB7XG4gIFxudmFyIGdsO1xudmFyIHZib01lc2ggPSBleHBvcnRzO1xuXG52Ym9NZXNoLnNldEdMID0gZnVuY3Rpb24oX2dsKSB7XG4gIGdsID0gX2dsO1xufVxuXG52Ym9NZXNoLmNyZWF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciB2Ym8gPSB7fTtcbiAgICB2Ym8udmVydGV4RGF0YSA9IG5ldyBGbG9hdDMyQXJyYXkoMyoxMDApO1xuICAgIHZiby5udW1WZXJ0aWNlcyA9IDA7XG4gICAgdmJvLmluZGV4RGF0YSA9IG5ldyBVaW50MTZBcnJheSgzKjEwMCk7XG4gICAgdmJvLm51bUluZGljZXMgPSAwO1xuICAgIHZiby52ZXJ0ZXhCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgICB2Ym8uaW5kZXhCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgICB2Ym8ubnVtTm9ybWFscyA9IDA7XG4gICAgdmJvLm5vcm1hbHNFbmFibGVkID0gZmFsc2U7XG4gICAgdmJvLm5vcm1hbERhdGEgPSBudWxsO1xuICAgIHZiby5jb2xvckVuYWJsZWQgPSBmYWxzZTtcbiAgICB2Ym8uY29sb3JEYXRhPSBudWxsO1xuICAgIHZiby5ub3JtYWxCdWZmZXIgPSBudWxsO1xuICAgIHZiby5jb2xvckJ1ZmZlciA9IG51bGw7XG4gICAgcmV0dXJuIHZibztcbn07XG5cbnZib01lc2guY3JlYXRlMzIgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgdmJvID0ge307XG4gICAgdmJvLnZlcnRleERhdGEgPSBuZXcgRmxvYXQzMkFycmF5KDMqMTAwMCk7XG4gICAgdmJvLm51bVZlcnRpY2VzID0gMDtcbiAgICB2Ym8uaW5kZXhEYXRhID0gbmV3IFVpbnQzMkFycmF5KDMqMTAwMCk7XG4gICAgdmJvLm51bUluZGljZXMgPSAwO1xuICAgIHZiby52ZXJ0ZXhCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgICB2Ym8uaW5kZXhCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgICB2Ym8ubm9ybWFsc0VuYWJsZWQgPSBmYWxzZTtcbiAgICB2Ym8ubnVtTm9ybWFscyA9IDA7XG4gICAgdmJvLm5vcm1hbERhdGEgPSBudWxsO1xuICAgIHZiby5jb2xvckRhdGE9IG51bGw7XG4gICAgdmJvLm5vcm1hbEJ1ZmZlciA9IG51bGw7XG4gICAgdmJvLmNvbG9yQnVmZmVyID0gbnVsbDtcbiAgICByZXR1cm4gdmJvO1xufTtcblxudmJvTWVzaC5jbGVhciA9IGZ1bmN0aW9uKHZibykge1xuICAgIHZiby5udW1WZXJ0aWNlcyA9IDA7XG4gICAgdmJvLm51bUluZGljZXMgPSAwO1xuICAgIHZiby5udW1Ob3JtYWxzID0gMDtcbn1cblxudmJvTWVzaC5lbmFibGVOb3JtYWxzID0gZnVuY3Rpb24odmJvKSB7XG4gICAgaWYoIXZiby5ub3JtYWxzRW5hYmxlZCkge1xuICAgICAgICB2Ym8ubm9ybWFsRGF0YSA9IG5ldyBGbG9hdDMyQXJyYXkodmJvLnZlcnRleERhdGEubGVuZ3RoKTtcbiAgICAgICAgaWYodmJvLm5vcm1hbEJ1ZmZlciA9PT0gbnVsbCkgdmJvLm5vcm1hbEJ1ZmZlciA9IGdsLmNyZWF0ZUJ1ZmZlcigpO1xuICAgICAgICB2Ym8ubm9ybWFsc0VuYWJsZWQgPSB0cnVlO1xuICAgIH1cbn1cblxudmJvTWVzaC5kaXNhYmxlTm9ybWFscyA9IGZ1bmN0aW9uKHZibykge1xuICAgIHZiby5ub3JtYWxEYXRhID0gbnVsbDtcbiAgICBpZih2Ym8ubm9ybWFsQnVmZmVyICE9PSBudWxsKSBnbC5kZWxldGVCdWZmZXIodmJvLm5vcm1hbEJ1ZmZlcik7XG4gICAgdmJvLm5vcm1hbHNFbmFibGVkID0gZmFsc2U7XG59XG5cbnZib01lc2guZW5hYmxlQ29sb3IgPSBmdW5jdGlvbih2Ym8pIHtcbiAgaWYoIXZiby5jb2xvckVuYWJsZWQpIHtcbiAgICB2Ym8uY29sb3JEYXRhID0gbmV3IFVpbnQ4QXJyYXkodmJvLnZlcnRleERhdGEubGVuZ3RoLzMqNCk7XG4gICAgaWYodmJvLmNvbG9yQnVmZmVyID09PSBudWxsKSB2Ym8uY29sb3JCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgICB2Ym8uY29sb3JFbmFibGVkID0gdHJ1ZTtcbiAgfVxufVxuXG52Ym9NZXNoLmRpc2FibGVDb2xvciA9IGZ1bmN0aW9uKHZibykge1xuICAgIHZiby5jb2xvckRhdGEgPSBudWxsO1xuICAgIGlmKHZiby5jb2xvckJ1ZmZlciAhPT0gbnVsbCkgZ2wuZGVsZXRlQnVmZmVyKHZiby5jb2xvckJ1ZmZlcik7XG4gICAgdmJvLmNvbG9yRW5hYmxlZCA9IGZhbHNlO1xufVxuXG52Ym9NZXNoLmFkZFZlcnRleCA9IGZ1bmN0aW9uKHZibywgdixuKSB7XG4gICAgdmFyIGluZGV4ID0gdmJvLm51bVZlcnRpY2VzKjM7XG5cdGlmKGluZGV4ID49IHZiby52ZXJ0ZXhEYXRhLmxlbmd0aCkge1xuXHRcdHZhciBuZXdEYXRhID0gbmV3IEZsb2F0MzJBcnJheSh2Ym8udmVydGV4RGF0YS5sZW5ndGgqMik7XG5cdFx0bmV3RGF0YS5zZXQodmJvLnZlcnRleERhdGEpO1xuXHRcdC8vZG8gaSBuZWVkIHRvIGV4cGxpY2l0bHkga2lsbCB0aGUgb2xkIHZlcnRleERhdGE/XG5cdFx0dmJvLnZlcnRleERhdGEgPSBuZXdEYXRhO1xuICAgIGlmKHZiby5ub3JtYWxzRW5hYmxlZCkge1xuICAgICAgICB2YXIgbmV3RGF0YSA9IG5ldyBGbG9hdDMyQXJyYXkodmJvLnZlcnRleERhdGEubGVuZ3RoKTtcbiAgICAgICAgbmV3RGF0YS5zZXQodmJvLm5vcm1hbERhdGEpO1xuICAgICAgICAvL2RvIGkgbmVlZCB0byBleHBsaWNpdGx5IGtpbGwgdGhlIG9sZCB2ZXJ0ZXhEYXRhP1xuICAgICAgICB2Ym8ubm9ybWFsRGF0YSA9IG5ld0RhdGE7XG4gICAgfVxuICAgIGlmKHZiby5jb2xvckVuYWJsZWQpIHtcbiAgICAgIHZhciBuZXdEYXRhID0gbmV3IFVpbnQ4QXJyYXkodmJvLnZlcnRleERhdGEubGVuZ3RoLzMqNCk7XG4gICAgICBuZXdEYXRhLnNldCh2Ym8uY29sb3JEYXRhKTtcbiAgICAgIC8vZG8gaSBuZWVkIHRvIGV4cGxpY2l0bHkga2lsbCB0aGUgb2xkIHZlcnRleERhdGE/XG4gICAgICB2Ym8uY29sb3JEYXRhID0gbmV3RGF0YTtcbiAgICB9XG5cdH1cbiAgICB2Ym8udmVydGV4RGF0YVtpbmRleF0gPSB2WzBdO1xuICAgIHZiby52ZXJ0ZXhEYXRhW2luZGV4KzFdID0gdlsxXTtcbiAgICB2Ym8udmVydGV4RGF0YVtpbmRleCsyXSA9IHZbMl07XG4gICAgaWYobiAmJiB2Ym8ubm9ybWFsc0VuYWJsZWQpIHtcbiAgICAgICAgdmJvLm5vcm1hbERhdGFbaW5kZXhdID0gblswXTtcbiAgICAgICAgdmJvLm5vcm1hbERhdGFbaW5kZXgrMV0gPSBuWzFdO1xuICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpbmRleCsyXSA9IG5bMl07XG4gICAgfVxuICAgIHZiby5udW1WZXJ0aWNlcysrO1xufVxuXG52Ym9NZXNoLmdldFZlcnRleCA9IGZ1bmN0aW9uKG91dCwgdmJvLCBpKSB7XG4gIHZhciBpMyA9IGkqMztcbiAgb3V0WzBdID0gdmJvLnZlcnRleERhdGFbaTNdO1xuICBvdXRbMV0gPSB2Ym8udmVydGV4RGF0YVtpMysxXTtcbiAgb3V0WzJdID0gdmJvLnZlcnRleERhdGFbaTMrMl07XG59XG5cbnZib01lc2guc2V0VmVydGV4ID0gZnVuY3Rpb24odmJvLCBpLCBwdCkge1xuICB2YXIgaTMgPSBpKjM7XG4gIHZiby52ZXJ0ZXhEYXRhW2kzXSA9IHB0WzBdO1xuICB2Ym8udmVydGV4RGF0YVtpMysxXSA9IHB0WzFdO1xuICB2Ym8udmVydGV4RGF0YVtpMysyXSA9IHB0WzJdO1xufVxuXG52Ym9NZXNoLnNldE5vcm1hbCA9IGZ1bmN0aW9uKHZibywgaSwgcHQpIHtcbiAgdmFyIGkzID0gaSozO1xuICB2Ym8ubm9ybWFsRGF0YVtpM10gPSBwdFswXTtcbiAgdmJvLm5vcm1hbERhdGFbaTMrMV0gPSBwdFsxXTtcbiAgdmJvLm5vcm1hbERhdGFbaTMrMl0gPSBwdFsyXTtcbn1cblxudmJvTWVzaC5nZXROb3JtYWwgPSBmdW5jdGlvbihuLCB2Ym8sIGkpIHtcbiAgdmFyIGkzID0gaSozO1xuICBuWzBdID0gdmJvLm5vcm1hbERhdGFbaTNdO1xuICBuWzFdID0gdmJvLm5vcm1hbERhdGFbaTMrMV07XG4gIG5bMl0gPSB2Ym8ubm9ybWFsRGF0YVtpMysyXTtcbn1cbnZib01lc2guc2V0Q29sb3IgPSBmdW5jdGlvbih2Ym8sIGksIGMpIHtcbiAgdmFyIGk0ID0gaSo0O1xuICB2Ym8uY29sb3JEYXRhW2k0XSA9IGNbMF07XG4gIHZiby5jb2xvckRhdGFbaTQrMV0gPSBjWzFdO1xuICB2Ym8uY29sb3JEYXRhW2k0KzJdID0gY1syXTtcbiAgdmJvLmNvbG9yRGF0YVtpNCszXSA9IGNbM10gPT09IHVuZGVmaW5lZCA/IDI1NSA6IGNbM107XG59XG5cbnZib01lc2guYWRkVHJpYW5nbGUgPSBmdW5jdGlvbih2Ym8sIGkxLGkyLGkzKSB7XG5cdGlmKHZiby5udW1JbmRpY2VzID49IHZiby5pbmRleERhdGEubGVuZ3RoKSB7XG5cdFx0dmFyIG5ld0RhdGEgPSBuZXcgdmJvLmluZGV4RGF0YS5jb25zdHJ1Y3Rvcih2Ym8uaW5kZXhEYXRhLmxlbmd0aCoyKTtcblx0XHRuZXdEYXRhLnNldCh2Ym8uaW5kZXhEYXRhKTtcblx0XHQvL2RvIGkgbmVlZCB0byBleHBsaWNpdGx5IGtpbGwgdGhlIG9sZCB2ZXJ0ZXhEYXRhP1xuXHRcdHZiby5pbmRleERhdGEgPSBuZXdEYXRhO1xuXHR9XG4gICAgdmJvLmluZGV4RGF0YVt2Ym8ubnVtSW5kaWNlcysrXSA9IGkxO1xuICAgIHZiby5pbmRleERhdGFbdmJvLm51bUluZGljZXMrK10gPSBpMjtcbiAgICB2Ym8uaW5kZXhEYXRhW3Ziby5udW1JbmRpY2VzKytdID0gaTM7XG59XG5cbnZib01lc2guYWRkSW5kaWNlcyA9IGZ1bmN0aW9uKHZibywgaW5kaWNlcyxudW1JbmRpY2VzKSB7XG5cdGlmKHZiby5udW1JbmRpY2VzK251bUluZGljZXMgPj0gdmJvLmluZGV4RGF0YS5sZW5ndGgpIHtcblx0XHR2YXIgbmV3RGF0YSA9IG5ldyB2Ym8uaW5kZXhEYXRhLmNvbnN0cnVjdG9yKE1hdGgubWF4KHZiby5pbmRleERhdGEubGVuZ3RoKjIsdmJvLmluZGV4RGF0YS5sZW5ndGgrbnVtSW5kaWNlcykpO1xuXHRcdG5ld0RhdGEuc2V0KHZiby5pbmRleERhdGEpO1xuXHRcdC8vZG8gaSBuZWVkIHRvIGV4cGxpY2l0bHkga2lsbCB0aGUgb2xkIHZlcnRleERhdGE/XG5cdFx0dmJvLmluZGV4RGF0YSA9IG5ld0RhdGE7XG5cdH1cbiAgZm9yKHZhciBpPTA7aTxudW1JbmRpY2VzOysraSkge1xuICAgIHZiby5pbmRleERhdGFbdmJvLm51bUluZGljZXMrK10gPSBpbmRpY2VzW2ldO1xuICB9XG59XG5cbnZib01lc2guYWRkSW5kZXggPSBmdW5jdGlvbih2Ym8saW5kZXgpIHtcbiAgaWYodmJvLm51bUluZGljZXMgPj0gdmJvLmluZGV4RGF0YS5sZW5ndGgpIHtcblx0XHR2YXIgbmV3RGF0YSA9IG5ldyB2Ym8uaW5kZXhEYXRhLmNvbnN0cnVjdG9yKHZiby5pbmRleERhdGEubGVuZ3RoKjIpO1xuXHRcdG5ld0RhdGEuc2V0KHZiby5pbmRleERhdGEpO1xuXHRcdC8vZG8gaSBuZWVkIHRvIGV4cGxpY2l0bHkga2lsbCB0aGUgb2xkIHZlcnRleERhdGE/XG5cdFx0dmJvLmluZGV4RGF0YSA9IG5ld0RhdGE7XG5cdH1cbiAgdmJvLmluZGV4RGF0YVt2Ym8ubnVtSW5kaWNlcysrXSA9IGluZGV4O1xufVxuXG52Ym9NZXNoLmFkZExpbmUgPSBmdW5jdGlvbih2Ym8sIGkxLGkyKSB7XG5cdGlmKHZiby5udW1JbmRpY2VzID49IHZiby5pbmRleERhdGEubGVuZ3RoKSB7XG5cdFx0dmFyIG5ld0RhdGEgPSBuZXcgdmJvLmluZGV4RGF0YS5jb25zdHJ1Y3Rvcih2Ym8uaW5kZXhEYXRhLmxlbmd0aCoyKTtcblx0XHRuZXdEYXRhLnNldCh2Ym8uaW5kZXhEYXRhKTtcblx0XHQvL2RvIGkgbmVlZCB0byBleHBsaWNpdGx5IGtpbGwgdGhlIG9sZCB2ZXJ0ZXhEYXRhP1xuXHRcdHZiby5pbmRleERhdGEgPSBuZXdEYXRhO1xuXHR9XG4gIHZiby5pbmRleERhdGFbdmJvLm51bUluZGljZXMrK10gPSBpMTtcbiAgdmJvLmluZGV4RGF0YVt2Ym8ubnVtSW5kaWNlcysrXSA9IGkyO1xufVxuXG52Ym9NZXNoLmJ1ZmZlciA9IGZ1bmN0aW9uKHZibykge1xuICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCB2Ym8udmVydGV4QnVmZmVyKTtcbiAgICBnbC5idWZmZXJEYXRhKGdsLkFSUkFZX0JVRkZFUix2Ym8udmVydGV4RGF0YSxnbC5TVFJFQU1fRFJBVyk7XG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5FTEVNRU5UX0FSUkFZX0JVRkZFUiwgdmJvLmluZGV4QnVmZmVyKTtcbiAgICBnbC5idWZmZXJEYXRhKGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLHZiby5pbmRleERhdGEsZ2wuU1RSRUFNX0RSQVcpO1xuICAgIGlmKHZiby5ub3JtYWxzRW5hYmxlZCkge1xuICAgICAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgdmJvLm5vcm1hbEJ1ZmZlcik7XG4gICAgICAgIGdsLmJ1ZmZlckRhdGEoZ2wuQVJSQVlfQlVGRkVSLCB2Ym8ubm9ybWFsRGF0YSxnbC5TVFJFQU1fRFJBVyk7XG4gICAgfVxufVxuXG52Ym9NZXNoLmNvbXB1dGVTbW9vdGhOb3JtYWxzID0gKGZ1bmN0aW9uKCkge1xuICAgIHZhciBub3JtID0gdmVjMy5jcmVhdGUoKTtcbiAgICB2YXIgcDEgPSB2ZWMzLmNyZWF0ZSgpLFxuICAgICAgICBwMiA9IHZlYzMuY3JlYXRlKCksXG4gICAgICAgIHAzID0gdmVjMy5jcmVhdGUoKTtcbiAgICB2YXIgeD0wLjAseT0wLjAsej0wLjA7XG4gICAgdmFyIGludkxlbiA9IDAuMDtcbiAgICB2YXIgZGlyMSA9IHZlYzMuY3JlYXRlKCksXG4gICAgICAgIGRpcjIgPSB2ZWMzLmNyZWF0ZSgpO1xuICAgIGZ1bmN0aW9uIHBsYW5lTm9ybWFsKG91dCx2MSx2Mix2Mykge1xuICAgICAgdmVjMy5zdWIoZGlyMSwgdjEsdjIpO1xuICAgICAgdmVjMy5zdWIoZGlyMiwgdjMsdjIpO1xuICAgICAgdmVjMy5jcm9zcyhvdXQsZGlyMixkaXIxKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZnVuY3Rpb24gY29tcHV0ZVNtb290aE5vcm1hbHModmJvKSB7XG4gICAgICAgIHZib01lc2guZW5hYmxlTm9ybWFscyh2Ym8pO1xuICAgICAgICBmb3IodmFyIGk9MDtpPHZiby5udW1WZXJ0aWNlczsrK2kpIHtcbiAgICAgICAgICAgIHZhciBpMyA9IGkqMztcbiAgICAgICAgICAgIHZiby5ub3JtYWxEYXRhW2kzXSA9IDA7XG4gICAgICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpMysxXSA9IDA7XG4gICAgICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpMysyXSA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgZm9yKHZhciBpPTA7aTx2Ym8ubnVtSW5kaWNlczspIHtcbiAgICAgICAgICAgIHZhciBpMSA9IHZiby5pbmRleERhdGFbaSsrXSozO1xuICAgICAgICAgICAgdmFyIGkyID0gdmJvLmluZGV4RGF0YVtpKytdKjM7XG4gICAgICAgICAgICB2YXIgaTMgPSB2Ym8uaW5kZXhEYXRhW2krK10qMztcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdmVjMy5zZXQocDEsdmJvLnZlcnRleERhdGFbaTFdLHZiby52ZXJ0ZXhEYXRhW2kxKzFdLCB2Ym8udmVydGV4RGF0YVtpMSsyXSk7XG4gICAgICAgICAgICB2ZWMzLnNldChwMix2Ym8udmVydGV4RGF0YVtpMl0sdmJvLnZlcnRleERhdGFbaTIrMV0sIHZiby52ZXJ0ZXhEYXRhW2kyKzJdKTtcbiAgICAgICAgICAgIHZlYzMuc2V0KHAzLHZiby52ZXJ0ZXhEYXRhW2kzXSx2Ym8udmVydGV4RGF0YVtpMysxXSwgdmJvLnZlcnRleERhdGFbaTMrMl0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBwbGFuZU5vcm1hbChub3JtLCBwMSxwMixwMyk7XG4gICAgICAgICAgICB2ZWMzLm5vcm1hbGl6ZShub3JtLG5vcm0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpMV0gKz0gbm9ybVswXTtcbiAgICAgICAgICAgIHZiby5ub3JtYWxEYXRhW2kxKzFdICs9IG5vcm1bMV07XG4gICAgICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpMSsyXSArPSBub3JtWzJdO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpMl0gKz0gbm9ybVswXTtcbiAgICAgICAgICAgIHZiby5ub3JtYWxEYXRhW2kyKzFdICs9IG5vcm1bMV07XG4gICAgICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpMisyXSArPSBub3JtWzJdO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpM10gKz0gbm9ybVswXTtcbiAgICAgICAgICAgIHZiby5ub3JtYWxEYXRhW2kzKzFdICs9IG5vcm1bMV07XG4gICAgICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpMysyXSArPSBub3JtWzJdO1xuICAgICAgICB9XG4gICAgICAgIGZvcih2YXIgaT0wO2k8dmJvLm51bVZlcnRpY2VzOysraSkge1xuICAgICAgICAgICAgdmFyIGkzID0gaSozO1xuICAgICAgICAgICAgeCA9IHZiby5ub3JtYWxEYXRhW2kzXTtcbiAgICAgICAgICAgIHkgPSB2Ym8ubm9ybWFsRGF0YVtpMysxXTtcbiAgICAgICAgICAgIHogPSB2Ym8ubm9ybWFsRGF0YVtpMysyXTtcbiAgICAgICAgICAgIGludkxlbiA9IDEuMC9NYXRoLnNxcnQoeCp4K3kqeSt6KnopO1xuICAgICAgICAgICAgdmJvLm5vcm1hbERhdGFbaTNdICo9IGludkxlbjtcbiAgICAgICAgICAgIHZiby5ub3JtYWxEYXRhW2kzKzFdICo9IGludkxlbjtcbiAgICAgICAgICAgIHZiby5ub3JtYWxEYXRhW2kzKzJdICo9IGludkxlbjtcbiAgICAgICAgfVxuICAgIH07XG59KSgpO1xuXG52Ym9NZXNoLmNvbXB1dGVTbW9vdGhOb3JtYWxzVkJPID0gZnVuY3Rpb24odmJvKSB7XG4gICAgdmFyIHZlcnRleERhdGEgPSB2Ym8udmVydGV4RGF0YTtcbiAgICBmb3IodmFyIGk9MDtpPHZiby5udW1WZXJ0aWNlczsrK2kpIHtcbiAgICAgICAgdmFyIGk2ID0gaSo2O1xuICAgICAgICB2ZXJ0ZXhEYXRhW2k2KzNdID0gMDtcbiAgICAgICAgdmVydGV4RGF0YVtpNis0XSA9IDA7XG4gICAgICAgIHZlcnRleERhdGFbaTYrNV0gPSAwO1xuICAgIH1cbiAgICB2YXIgbm9ybSA9IHZlYzMuY3JlYXRlKCk7XG4gICAgdmFyIHAxID0gdmVjMy5jcmVhdGUoKSxcbiAgICAgICAgcDIgPSB2ZWMzLmNyZWF0ZSgpLFxuICAgICAgICBwMyA9IHZlYzMuY3JlYXRlKCk7XG4gICAgZm9yKHZhciBpPTA7aTx2Ym8ubnVtSW5kaWNlczspIHtcbiAgICAgICAgdmFyIGkxID0gdmJvLmluZGV4RGF0YVtpKytdO1xuICAgICAgICB2YXIgaTIgPSB2Ym8uaW5kZXhEYXRhW2krK107XG4gICAgICAgIHZhciBpMyA9IHZiby5pbmRleERhdGFbaSsrXTtcbiAgICAgICAgXG4gICAgICAgIHZlYzMuc2V0KHAxLHZlcnRleERhdGFbaTEqNl0sdmVydGV4RGF0YVtpMSo2KzFdLCB2ZXJ0ZXhEYXRhW2kxKjYrMl0pO1xuICAgICAgICB2ZWMzLnNldChwMix2ZXJ0ZXhEYXRhW2kyKjZdLHZlcnRleERhdGFbaTIqNisxXSwgdmVydGV4RGF0YVtpMio2KzJdKTtcbiAgICAgICAgdmVjMy5zZXQocDMsdmVydGV4RGF0YVtpMyo2XSx2ZXJ0ZXhEYXRhW2kzKjYrMV0sIHZlcnRleERhdGFbaTMqNisyXSk7XG4gICAgICAgIFxuICAgICAgICBwbGFuZU5vcm1hbChub3JtLCBwMSxwMixwMyk7XG4gICAgICAgIHZlYzMubm9ybWFsaXplKG5vcm0sbm9ybSk7XG4gICAgICAgIFxuICAgICAgICB2ZXJ0ZXhEYXRhW2kxKjMrM10gKz0gbm9ybVswXTtcbiAgICAgICAgdmVydGV4RGF0YVtpMSozKzRdICs9IG5vcm1bMV07XG4gICAgICAgIHZlcnRleERhdGFbaTEqMys1XSArPSBub3JtWzJdO1xuICAgICAgICBcbiAgICAgICAgdmVydGV4RGF0YVtpMio2KzNdICs9IG5vcm1bMF07XG4gICAgICAgIHZlcnRleERhdGFbaTIqNis0XSArPSBub3JtWzFdO1xuICAgICAgICB2ZXJ0ZXhEYXRhW2kyKjYrNV0gKz0gbm9ybVsyXTtcbiAgICAgICAgXG4gICAgICAgIHZlcnRleERhdGFbaTMqNiszXSArPSBub3JtWzBdO1xuICAgICAgICB2ZXJ0ZXhEYXRhW2kzKjYrNF0gKz0gbm9ybVsxXTtcbiAgICAgICAgdmVydGV4RGF0YVtpMyo2KzVdICs9IG5vcm1bMl07XG4gICAgfVxuICAgIGZvcih2YXIgaT0wO2k8dmJvLm51bVZlcnRpY2VzOysraSkge1xuICAgICAgICB2YXIgaTYgPSBpKjY7XG4gICAgICAgIHZhciBsZW4gPSBNYXRoLnNxcnQodmVydGV4RGF0YVtpNiszXSp2ZXJ0ZXhEYXRhW2k2KzNdK3ZlcnRleERhdGFbaTYrNF0qdmVydGV4RGF0YVtpNis0XSt2ZXJ0ZXhEYXRhW2k2KzVdKnZlcnRleERhdGFbaTYrNV0pO1xuICAgICAgICB2ZXJ0ZXhEYXRhW2k2KzNdIC89IGxlbjtcbiAgICAgICAgdmVydGV4RGF0YVtpNis0XSAvPSBsZW47XG4gICAgICAgIHZlcnRleERhdGFbaTYrNV0gLz0gbGVuO1xuICAgIH1cbn1cblxuXG59KShzaGltLmV4cG9ydHMpO1xufSkodGhpcyk7IiwidmFyIGdsTWF0cml4ID0gcmVxdWlyZSgnLi4vanMvZ2wtbWF0cml4LW1pbi5qcycpO1xyXG52YXIgcG9seTJ0cmkgPSByZXF1aXJlKCcuL3BvbHkydHJpLmpzJyk7XHJcbnZhciB2ZWMzID0gZ2xNYXRyaXgudmVjMztcclxudmFyIHZlYzIgPSBnbE1hdHJpeC52ZWMyO1xyXG5cclxudmFyIFN3ZWVwQ29udGV4dCA9IHBvbHkydHJpLlN3ZWVwQ29udGV4dDtcclxudmFyIHB0cyA9IFtdO1xyXG5cclxudmFyIG91dHNpZGVQdHMgPSBbXTtcclxudmFyIHRyaWFuZ2xlcyA9IFtdO1xyXG5cclxudmFyIHdpZHRoID0gMTIwMDtcclxudmFyIGhlaWdodCA9IDEyMDA7XHJcbmZ1bmN0aW9uIHJlc2V0KCkge1xyXG4gIC8vbWFrZSByZWd1bGFybHkgc3BhY2VkIHBvaW50c1xyXG4gIHB0cy5sZW5ndGggPSAwO1xyXG4gIFxyXG4gIGZvcih2YXIgaT0wO2k8NDsrK2kpIHtcclxuICAgIGZvcih2YXIgaj0wO2o8NDsrK2opIHtcclxuICAgICAgcHRzLnB1c2goe3g6aSoyNTAraiUyKjEyNSx5OmoqMjUwfSk7XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBpbml0KCkge1xyXG4gIG91dHNpZGVQdHMubGVuZ3RoID0gMDtcclxuICBvdXRzaWRlUHRzLnB1c2goe3g6LTEwLHk6LTEwLGZpeGVkOnRydWV9KTtcclxuICBvdXRzaWRlUHRzLnB1c2goe3g6d2lkdGgrMTAseTotMTAsZml4ZWQ6dHJ1ZX0pO1xyXG4gIG91dHNpZGVQdHMucHVzaCh7eDp3aWR0aCsxMCx5OmhlaWdodCsxMCxmaXhlZDp0cnVlfSk7XHJcbiAgb3V0c2lkZVB0cy5wdXNoKHt4Oi0xMCx5OmhlaWdodCsxMCxmaXhlZDp0cnVlfSk7XHJcbn1cclxuXHJcbnZhciB2b3Jvbm9pID0gKGZ1bmN0aW9uKCkge1xyXG4gIHZhciBwMSA9IHZlYzIuY3JlYXRlKCk7XHJcbiAgdmFyIHAyID0gdmVjMi5jcmVhdGUoKTtcclxuICB2YXIgcDMgPSB2ZWMyLmNyZWF0ZSgpO1xyXG4gIHJldHVybiBmdW5jdGlvbiB2b3Jvbm9pKCkge1xyXG4gICAgdmFyIHRyaWFuZ3VsYXRpb24gPSBuZXcgU3dlZXBDb250ZXh0KG91dHNpZGVQdHMpO1xyXG4gICAgdHJpYW5ndWxhdGlvbi5hZGRQb2ludHMocHRzKTtcclxuICAgIHRyaWFuZ3VsYXRpb24udHJpYW5ndWxhdGUoKTtcclxuICAgIFxyXG4gICAgdHJpYW5nbGVzID0gdHJpYW5ndWxhdGlvbi5nZXRUcmlhbmdsZXMoKTtcclxuICAgIGV4cG9ydHMudHJpYW5nbGVzID0gdHJpYW5nbGVzO1xyXG4gICAgXHJcbiAgICBmb3IodmFyIGk9MDtpPHRyaWFuZ2xlcy5sZW5ndGg7KytpKSB7XHJcbiAgICAgIHZhciB0cmkgPSB0cmlhbmdsZXNbaV07XHJcbiAgICAgIHRyaS5jaXJjdW1jZW50ZXIgPSB2ZWMzLmNyZWF0ZSgpO1xyXG4gICAgICB2ZWMyLnNldChwMSx0cmkucG9pbnRzX1swXS54LHRyaS5wb2ludHNfWzBdLnkpO1xyXG4gICAgICB2ZWMyLnNldChwMix0cmkucG9pbnRzX1sxXS54LHRyaS5wb2ludHNfWzFdLnkpO1xyXG4gICAgICB2ZWMyLnNldChwMyx0cmkucG9pbnRzX1syXS54LHRyaS5wb2ludHNfWzJdLnkpO1xyXG4gICAgICBjaXJjdW1jaXJjbGUodHJpLmNpcmN1bWNlbnRlcixwMSxwMixwMyk7XHJcbiAgICB9XHJcbiAgICBcclxuICB9XHJcbn0pKCk7XHJcblxyXG52YXIgY2lyY3VtY2lyY2xlID0gKGZ1bmN0aW9uKCkge1xyXG4gIHZhciB2MSA9IHZlYzIuY3JlYXRlKCk7XHJcbiAgdmFyIHYyID0gdmVjMi5jcmVhdGUoKTtcclxuICB2YXIgY3Jvc3M7XHJcbiAgcmV0dXJuIGZ1bmN0aW9uIGNpcmN1bWNpcmNsZShvdXQsIHAxLHAyLHAzKSB7XHJcbiAgICB2ZWMyLnN1Yih2MSxwMSxwMyk7XHJcbiAgICB2ZWMyLnN1Yih2MixwMixwMyk7XHJcbiAgICBjcm9zcyA9IHYxWzBdKnYyWzFdLXYxWzFdKnYyWzBdO1xyXG4gICAgdmFyIHYxTGVuID0gdmVjMi5zcXJMZW4odjEpO1xyXG4gICAgdmFyIHYyTGVuID0gdmVjMi5zcXJMZW4odjIpO1xyXG4gICAgdmFyIGNyb3NzTGVuID0gY3Jvc3MqY3Jvc3M7XHJcbiAgICB2ZWMyLnNjYWxlKHYyLHYyLHYxTGVuKTtcclxuICAgIHZlYzIuc2NhbGUodjEsdjEsdjJMZW4pO1xyXG4gICAgdmVjMi5zdWIodjIsdjIsdjEpO1xyXG4gICAgb3V0WzBdID0gdjJbMV0qY3Jvc3M7XHJcbiAgICBvdXRbMV0gPSAtdjJbMF0qY3Jvc3M7XHJcbiAgICB2ZWMyLnNjYWxlKG91dCxvdXQsMS4wLygyLjAqY3Jvc3NMZW4pKTtcclxuICAgIHZlYzIuYWRkKG91dCxvdXQscDMpO1xyXG4gICAgcmV0dXJuIG91dDtcclxuICB9XHJcbn0pKCk7XHJcblxyXG5leHBvcnRzLmluaXQgPSBpbml0O1xyXG5leHBvcnRzLnJlc2V0ID0gcmVzZXQ7XHJcbmV4cG9ydHMudm9yb25vaSA9IHZvcm9ub2k7XHJcbmV4cG9ydHMucHRzID0gcHRzO1xyXG5leHBvcnRzLnRyaWFuZ2xlcyA9IHRyaWFuZ2xlczsiLCIvKipcbiAqIEBmaWxlb3ZlcnZpZXcgZ2wtbWF0cml4IC0gSGlnaCBwZXJmb3JtYW5jZSBtYXRyaXggYW5kIHZlY3RvciBvcGVyYXRpb25zXG4gKiBAYXV0aG9yIEJyYW5kb24gSm9uZXNcbiAqIEBhdXRob3IgQ29saW4gTWFjS2VuemllIElWXG4gKiBAdmVyc2lvbiAyLjIuMFxuICovXG4vKiBDb3B5cmlnaHQgKGMpIDIwMTMsIEJyYW5kb24gSm9uZXMsIENvbGluIE1hY0tlbnppZSBJVi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cblxuUmVkaXN0cmlidXRpb24gYW5kIHVzZSBpbiBzb3VyY2UgYW5kIGJpbmFyeSBmb3Jtcywgd2l0aCBvciB3aXRob3V0IG1vZGlmaWNhdGlvbixcbmFyZSBwZXJtaXR0ZWQgcHJvdmlkZWQgdGhhdCB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnMgYXJlIG1ldDpcblxuICAqIFJlZGlzdHJpYnV0aW9ucyBvZiBzb3VyY2UgY29kZSBtdXN0IHJldGFpbiB0aGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSwgdGhpc1xuICAgIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyLlxuICAqIFJlZGlzdHJpYnV0aW9ucyBpbiBiaW5hcnkgZm9ybSBtdXN0IHJlcHJvZHVjZSB0aGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSxcbiAgICB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyIGluIHRoZSBkb2N1bWVudGF0aW9uIFxuICAgIGFuZC9vciBvdGhlciBtYXRlcmlhbHMgcHJvdmlkZWQgd2l0aCB0aGUgZGlzdHJpYnV0aW9uLlxuXG5USElTIFNPRlRXQVJFIElTIFBST1ZJREVEIEJZIFRIRSBDT1BZUklHSFQgSE9MREVSUyBBTkQgQ09OVFJJQlVUT1JTIFwiQVMgSVNcIiBBTkRcbkFOWSBFWFBSRVNTIE9SIElNUExJRUQgV0FSUkFOVElFUywgSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFRIRSBJTVBMSUVEXG5XQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSBBTkQgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQVJFIFxuRElTQ0xBSU1FRC4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFIENPUFlSSUdIVCBIT0xERVIgT1IgQ09OVFJJQlVUT1JTIEJFIExJQUJMRSBGT1JcbkFOWSBESVJFQ1QsIElORElSRUNULCBJTkNJREVOVEFMLCBTUEVDSUFMLCBFWEVNUExBUlksIE9SIENPTlNFUVVFTlRJQUwgREFNQUdFU1xuKElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBQUk9DVVJFTUVOVCBPRiBTVUJTVElUVVRFIEdPT0RTIE9SIFNFUlZJQ0VTO1xuTE9TUyBPRiBVU0UsIERBVEEsIE9SIFBST0ZJVFM7IE9SIEJVU0lORVNTIElOVEVSUlVQVElPTikgSE9XRVZFUiBDQVVTRUQgQU5EIE9OXG5BTlkgVEhFT1JZIE9GIExJQUJJTElUWSwgV0hFVEhFUiBJTiBDT05UUkFDVCwgU1RSSUNUIExJQUJJTElUWSwgT1IgVE9SVFxuKElOQ0xVRElORyBORUdMSUdFTkNFIE9SIE9USEVSV0lTRSkgQVJJU0lORyBJTiBBTlkgV0FZIE9VVCBPRiBUSEUgVVNFIE9GIFRISVNcblNPRlRXQVJFLCBFVkVOIElGIEFEVklTRUQgT0YgVEhFIFBPU1NJQklMSVRZIE9GIFNVQ0ggREFNQUdFLiAqL1xuKGZ1bmN0aW9uKGUpe1widXNlIHN0cmljdFwiO3ZhciB0PXt9O3R5cGVvZiBleHBvcnRzPT1cInVuZGVmaW5lZFwiP3R5cGVvZiBkZWZpbmU9PVwiZnVuY3Rpb25cIiYmdHlwZW9mIGRlZmluZS5hbWQ9PVwib2JqZWN0XCImJmRlZmluZS5hbWQ/KHQuZXhwb3J0cz17fSxkZWZpbmUoZnVuY3Rpb24oKXtyZXR1cm4gdC5leHBvcnRzfSkpOnQuZXhwb3J0cz10eXBlb2Ygd2luZG93IT1cInVuZGVmaW5lZFwiP3dpbmRvdzplOnQuZXhwb3J0cz1leHBvcnRzLGZ1bmN0aW9uKGUpe2lmKCF0KXZhciB0PTFlLTY7aWYoIW4pdmFyIG49dHlwZW9mIEZsb2F0MzJBcnJheSE9XCJ1bmRlZmluZWRcIj9GbG9hdDMyQXJyYXk6QXJyYXk7aWYoIXIpdmFyIHI9TWF0aC5yYW5kb207dmFyIGk9e307aS5zZXRNYXRyaXhBcnJheVR5cGU9ZnVuY3Rpb24oZSl7bj1lfSx0eXBlb2YgZSE9XCJ1bmRlZmluZWRcIiYmKGUuZ2xNYXRyaXg9aSk7dmFyIHM9e307cy5jcmVhdGU9ZnVuY3Rpb24oKXt2YXIgZT1uZXcgbigyKTtyZXR1cm4gZVswXT0wLGVbMV09MCxlfSxzLmNsb25lPWZ1bmN0aW9uKGUpe3ZhciB0PW5ldyBuKDIpO3JldHVybiB0WzBdPWVbMF0sdFsxXT1lWzFdLHR9LHMuZnJvbVZhbHVlcz1mdW5jdGlvbihlLHQpe3ZhciByPW5ldyBuKDIpO3JldHVybiByWzBdPWUsclsxXT10LHJ9LHMuY29weT1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdPXRbMF0sZVsxXT10WzFdLGV9LHMuc2V0PWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10LGVbMV09bixlfSxzLmFkZD1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dFswXStuWzBdLGVbMV09dFsxXStuWzFdLGV9LHMuc3VidHJhY3Q9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0tblswXSxlWzFdPXRbMV0tblsxXSxlfSxzLnN1Yj1zLnN1YnRyYWN0LHMubXVsdGlwbHk9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0qblswXSxlWzFdPXRbMV0qblsxXSxlfSxzLm11bD1zLm11bHRpcGx5LHMuZGl2aWRlPWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10WzBdL25bMF0sZVsxXT10WzFdL25bMV0sZX0scy5kaXY9cy5kaXZpZGUscy5taW49ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPU1hdGgubWluKHRbMF0sblswXSksZVsxXT1NYXRoLm1pbih0WzFdLG5bMV0pLGV9LHMubWF4PWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT1NYXRoLm1heCh0WzBdLG5bMF0pLGVbMV09TWF0aC5tYXgodFsxXSxuWzFdKSxlfSxzLnNjYWxlPWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10WzBdKm4sZVsxXT10WzFdKm4sZX0scy5zY2FsZUFuZEFkZD1mdW5jdGlvbihlLHQsbixyKXtyZXR1cm4gZVswXT10WzBdK25bMF0qcixlWzFdPXRbMV0rblsxXSpyLGV9LHMuZGlzdGFuY2U9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLWVbMF0scj10WzFdLWVbMV07cmV0dXJuIE1hdGguc3FydChuKm4rcipyKX0scy5kaXN0PXMuZGlzdGFuY2Uscy5zcXVhcmVkRGlzdGFuY2U9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLWVbMF0scj10WzFdLWVbMV07cmV0dXJuIG4qbityKnJ9LHMuc3FyRGlzdD1zLnNxdWFyZWREaXN0YW5jZSxzLmxlbmd0aD1mdW5jdGlvbihlKXt2YXIgdD1lWzBdLG49ZVsxXTtyZXR1cm4gTWF0aC5zcXJ0KHQqdCtuKm4pfSxzLmxlbj1zLmxlbmd0aCxzLnNxdWFyZWRMZW5ndGg9ZnVuY3Rpb24oZSl7dmFyIHQ9ZVswXSxuPWVbMV07cmV0dXJuIHQqdCtuKm59LHMuc3FyTGVuPXMuc3F1YXJlZExlbmd0aCxzLm5lZ2F0ZT1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdPS10WzBdLGVbMV09LXRbMV0sZX0scy5ub3JtYWxpemU9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLHI9dFsxXSxpPW4qbityKnI7cmV0dXJuIGk+MCYmKGk9MS9NYXRoLnNxcnQoaSksZVswXT10WzBdKmksZVsxXT10WzFdKmkpLGV9LHMuZG90PWZ1bmN0aW9uKGUsdCl7cmV0dXJuIGVbMF0qdFswXStlWzFdKnRbMV19LHMuY3Jvc3M9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0qblsxXS10WzFdKm5bMF07cmV0dXJuIGVbMF09ZVsxXT0wLGVbMl09cixlfSxzLmxlcnA9ZnVuY3Rpb24oZSx0LG4scil7dmFyIGk9dFswXSxzPXRbMV07cmV0dXJuIGVbMF09aStyKihuWzBdLWkpLGVbMV09cytyKihuWzFdLXMpLGV9LHMucmFuZG9tPWZ1bmN0aW9uKGUsdCl7dD10fHwxO3ZhciBuPXIoKSoyKk1hdGguUEk7cmV0dXJuIGVbMF09TWF0aC5jb3MobikqdCxlWzFdPU1hdGguc2luKG4pKnQsZX0scy50cmFuc2Zvcm1NYXQyPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXTtyZXR1cm4gZVswXT1uWzBdKnIrblsyXSppLGVbMV09blsxXSpyK25bM10qaSxlfSxzLnRyYW5zZm9ybU1hdDJkPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXTtyZXR1cm4gZVswXT1uWzBdKnIrblsyXSppK25bNF0sZVsxXT1uWzFdKnIrblszXSppK25bNV0sZX0scy50cmFuc2Zvcm1NYXQzPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXTtyZXR1cm4gZVswXT1uWzBdKnIrblszXSppK25bNl0sZVsxXT1uWzFdKnIrbls0XSppK25bN10sZX0scy50cmFuc2Zvcm1NYXQ0PWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXTtyZXR1cm4gZVswXT1uWzBdKnIrbls0XSppK25bMTJdLGVbMV09blsxXSpyK25bNV0qaStuWzEzXSxlfSxzLmZvckVhY2g9ZnVuY3Rpb24oKXt2YXIgZT1zLmNyZWF0ZSgpO3JldHVybiBmdW5jdGlvbih0LG4scixpLHMsbyl7dmFyIHUsYTtufHwobj0yKSxyfHwocj0wKSxpP2E9TWF0aC5taW4oaSpuK3IsdC5sZW5ndGgpOmE9dC5sZW5ndGg7Zm9yKHU9cjt1PGE7dSs9billWzBdPXRbdV0sZVsxXT10W3UrMV0scyhlLGUsbyksdFt1XT1lWzBdLHRbdSsxXT1lWzFdO3JldHVybiB0fX0oKSxzLnN0cj1mdW5jdGlvbihlKXtyZXR1cm5cInZlYzIoXCIrZVswXStcIiwgXCIrZVsxXStcIilcIn0sdHlwZW9mIGUhPVwidW5kZWZpbmVkXCImJihlLnZlYzI9cyk7dmFyIG89e307by5jcmVhdGU9ZnVuY3Rpb24oKXt2YXIgZT1uZXcgbigzKTtyZXR1cm4gZVswXT0wLGVbMV09MCxlWzJdPTAsZX0sby5jbG9uZT1mdW5jdGlvbihlKXt2YXIgdD1uZXcgbigzKTtyZXR1cm4gdFswXT1lWzBdLHRbMV09ZVsxXSx0WzJdPWVbMl0sdH0sby5mcm9tVmFsdWVzPWZ1bmN0aW9uKGUsdCxyKXt2YXIgaT1uZXcgbigzKTtyZXR1cm4gaVswXT1lLGlbMV09dCxpWzJdPXIsaX0sby5jb3B5PWZ1bmN0aW9uKGUsdCl7cmV0dXJuIGVbMF09dFswXSxlWzFdPXRbMV0sZVsyXT10WzJdLGV9LG8uc2V0PWZ1bmN0aW9uKGUsdCxuLHIpe3JldHVybiBlWzBdPXQsZVsxXT1uLGVbMl09cixlfSxvLmFkZD1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dFswXStuWzBdLGVbMV09dFsxXStuWzFdLGVbMl09dFsyXStuWzJdLGV9LG8uc3VidHJhY3Q9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0tblswXSxlWzFdPXRbMV0tblsxXSxlWzJdPXRbMl0tblsyXSxlfSxvLnN1Yj1vLnN1YnRyYWN0LG8ubXVsdGlwbHk9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0qblswXSxlWzFdPXRbMV0qblsxXSxlWzJdPXRbMl0qblsyXSxlfSxvLm11bD1vLm11bHRpcGx5LG8uZGl2aWRlPWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10WzBdL25bMF0sZVsxXT10WzFdL25bMV0sZVsyXT10WzJdL25bMl0sZX0sby5kaXY9by5kaXZpZGUsby5taW49ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPU1hdGgubWluKHRbMF0sblswXSksZVsxXT1NYXRoLm1pbih0WzFdLG5bMV0pLGVbMl09TWF0aC5taW4odFsyXSxuWzJdKSxlfSxvLm1heD1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09TWF0aC5tYXgodFswXSxuWzBdKSxlWzFdPU1hdGgubWF4KHRbMV0sblsxXSksZVsyXT1NYXRoLm1heCh0WzJdLG5bMl0pLGV9LG8uc2NhbGU9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0qbixlWzFdPXRbMV0qbixlWzJdPXRbMl0qbixlfSxvLnNjYWxlQW5kQWRkPWZ1bmN0aW9uKGUsdCxuLHIpe3JldHVybiBlWzBdPXRbMF0rblswXSpyLGVbMV09dFsxXStuWzFdKnIsZVsyXT10WzJdK25bMl0qcixlfSxvLmRpc3RhbmNlPWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXS1lWzBdLHI9dFsxXS1lWzFdLGk9dFsyXS1lWzJdO3JldHVybiBNYXRoLnNxcnQobipuK3IqcitpKmkpfSxvLmRpc3Q9by5kaXN0YW5jZSxvLnNxdWFyZWREaXN0YW5jZT1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0tZVswXSxyPXRbMV0tZVsxXSxpPXRbMl0tZVsyXTtyZXR1cm4gbipuK3IqcitpKml9LG8uc3FyRGlzdD1vLnNxdWFyZWREaXN0YW5jZSxvLmxlbmd0aD1mdW5jdGlvbihlKXt2YXIgdD1lWzBdLG49ZVsxXSxyPWVbMl07cmV0dXJuIE1hdGguc3FydCh0KnQrbipuK3Iqcil9LG8ubGVuPW8ubGVuZ3RoLG8uc3F1YXJlZExlbmd0aD1mdW5jdGlvbihlKXt2YXIgdD1lWzBdLG49ZVsxXSxyPWVbMl07cmV0dXJuIHQqdCtuKm4rcipyfSxvLnNxckxlbj1vLnNxdWFyZWRMZW5ndGgsby5uZWdhdGU9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXT0tdFswXSxlWzFdPS10WzFdLGVbMl09LXRbMl0sZX0sby5ub3JtYWxpemU9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLHI9dFsxXSxpPXRbMl0scz1uKm4rcipyK2kqaTtyZXR1cm4gcz4wJiYocz0xL01hdGguc3FydChzKSxlWzBdPXRbMF0qcyxlWzFdPXRbMV0qcyxlWzJdPXRbMl0qcyksZX0sby5kb3Q9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXSp0WzBdK2VbMV0qdFsxXStlWzJdKnRbMl19LG8uY3Jvc3M9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPW5bMF0sdT1uWzFdLGE9blsyXTtyZXR1cm4gZVswXT1pKmEtcyp1LGVbMV09cypvLXIqYSxlWzJdPXIqdS1pKm8sZX0sby5sZXJwPWZ1bmN0aW9uKGUsdCxuLHIpe3ZhciBpPXRbMF0scz10WzFdLG89dFsyXTtyZXR1cm4gZVswXT1pK3IqKG5bMF0taSksZVsxXT1zK3IqKG5bMV0tcyksZVsyXT1vK3IqKG5bMl0tbyksZX0sby5yYW5kb209ZnVuY3Rpb24oZSx0KXt0PXR8fDE7dmFyIG49cigpKjIqTWF0aC5QSSxpPXIoKSoyLTEscz1NYXRoLnNxcnQoMS1pKmkpKnQ7cmV0dXJuIGVbMF09TWF0aC5jb3MobikqcyxlWzFdPU1hdGguc2luKG4pKnMsZVsyXT1pKnQsZX0sby50cmFuc2Zvcm1NYXQ0PWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl07cmV0dXJuIGVbMF09blswXSpyK25bNF0qaStuWzhdKnMrblsxMl0sZVsxXT1uWzFdKnIrbls1XSppK25bOV0qcytuWzEzXSxlWzJdPW5bMl0qcituWzZdKmkrblsxMF0qcytuWzE0XSxlfSxvLnRyYW5zZm9ybU1hdDM9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXTtyZXR1cm4gZVswXT1yKm5bMF0raSpuWzNdK3Mqbls2XSxlWzFdPXIqblsxXStpKm5bNF0rcypuWzddLGVbMl09cipuWzJdK2kqbls1XStzKm5bOF0sZX0sby50cmFuc2Zvcm1RdWF0PWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz1uWzBdLHU9blsxXSxhPW5bMl0sZj1uWzNdLGw9ZipyK3Uqcy1hKmksYz1mKmkrYSpyLW8qcyxoPWYqcytvKmktdSpyLHA9LW8qci11KmktYSpzO3JldHVybiBlWzBdPWwqZitwKi1vK2MqLWEtaCotdSxlWzFdPWMqZitwKi11K2gqLW8tbCotYSxlWzJdPWgqZitwKi1hK2wqLXUtYyotbyxlfSxvLmZvckVhY2g9ZnVuY3Rpb24oKXt2YXIgZT1vLmNyZWF0ZSgpO3JldHVybiBmdW5jdGlvbih0LG4scixpLHMsbyl7dmFyIHUsYTtufHwobj0zKSxyfHwocj0wKSxpP2E9TWF0aC5taW4oaSpuK3IsdC5sZW5ndGgpOmE9dC5sZW5ndGg7Zm9yKHU9cjt1PGE7dSs9billWzBdPXRbdV0sZVsxXT10W3UrMV0sZVsyXT10W3UrMl0scyhlLGUsbyksdFt1XT1lWzBdLHRbdSsxXT1lWzFdLHRbdSsyXT1lWzJdO3JldHVybiB0fX0oKSxvLnN0cj1mdW5jdGlvbihlKXtyZXR1cm5cInZlYzMoXCIrZVswXStcIiwgXCIrZVsxXStcIiwgXCIrZVsyXStcIilcIn0sdHlwZW9mIGUhPVwidW5kZWZpbmVkXCImJihlLnZlYzM9byk7dmFyIHU9e307dS5jcmVhdGU9ZnVuY3Rpb24oKXt2YXIgZT1uZXcgbig0KTtyZXR1cm4gZVswXT0wLGVbMV09MCxlWzJdPTAsZVszXT0wLGV9LHUuY2xvbmU9ZnVuY3Rpb24oZSl7dmFyIHQ9bmV3IG4oNCk7cmV0dXJuIHRbMF09ZVswXSx0WzFdPWVbMV0sdFsyXT1lWzJdLHRbM109ZVszXSx0fSx1LmZyb21WYWx1ZXM9ZnVuY3Rpb24oZSx0LHIsaSl7dmFyIHM9bmV3IG4oNCk7cmV0dXJuIHNbMF09ZSxzWzFdPXQsc1syXT1yLHNbM109aSxzfSx1LmNvcHk9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXT10WzBdLGVbMV09dFsxXSxlWzJdPXRbMl0sZVszXT10WzNdLGV9LHUuc2V0PWZ1bmN0aW9uKGUsdCxuLHIsaSl7cmV0dXJuIGVbMF09dCxlWzFdPW4sZVsyXT1yLGVbM109aSxlfSx1LmFkZD1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dFswXStuWzBdLGVbMV09dFsxXStuWzFdLGVbMl09dFsyXStuWzJdLGVbM109dFszXStuWzNdLGV9LHUuc3VidHJhY3Q9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0tblswXSxlWzFdPXRbMV0tblsxXSxlWzJdPXRbMl0tblsyXSxlWzNdPXRbM10tblszXSxlfSx1LnN1Yj11LnN1YnRyYWN0LHUubXVsdGlwbHk9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0qblswXSxlWzFdPXRbMV0qblsxXSxlWzJdPXRbMl0qblsyXSxlWzNdPXRbM10qblszXSxlfSx1Lm11bD11Lm11bHRpcGx5LHUuZGl2aWRlPWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10WzBdL25bMF0sZVsxXT10WzFdL25bMV0sZVsyXT10WzJdL25bMl0sZVszXT10WzNdL25bM10sZX0sdS5kaXY9dS5kaXZpZGUsdS5taW49ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPU1hdGgubWluKHRbMF0sblswXSksZVsxXT1NYXRoLm1pbih0WzFdLG5bMV0pLGVbMl09TWF0aC5taW4odFsyXSxuWzJdKSxlWzNdPU1hdGgubWluKHRbM10sblszXSksZX0sdS5tYXg9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPU1hdGgubWF4KHRbMF0sblswXSksZVsxXT1NYXRoLm1heCh0WzFdLG5bMV0pLGVbMl09TWF0aC5tYXgodFsyXSxuWzJdKSxlWzNdPU1hdGgubWF4KHRbM10sblszXSksZX0sdS5zY2FsZT1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dFswXSpuLGVbMV09dFsxXSpuLGVbMl09dFsyXSpuLGVbM109dFszXSpuLGV9LHUuc2NhbGVBbmRBZGQ9ZnVuY3Rpb24oZSx0LG4scil7cmV0dXJuIGVbMF09dFswXStuWzBdKnIsZVsxXT10WzFdK25bMV0qcixlWzJdPXRbMl0rblsyXSpyLGVbM109dFszXStuWzNdKnIsZX0sdS5kaXN0YW5jZT1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0tZVswXSxyPXRbMV0tZVsxXSxpPXRbMl0tZVsyXSxzPXRbM10tZVszXTtyZXR1cm4gTWF0aC5zcXJ0KG4qbityKnIraSppK3Mqcyl9LHUuZGlzdD11LmRpc3RhbmNlLHUuc3F1YXJlZERpc3RhbmNlPWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXS1lWzBdLHI9dFsxXS1lWzFdLGk9dFsyXS1lWzJdLHM9dFszXS1lWzNdO3JldHVybiBuKm4rcipyK2kqaStzKnN9LHUuc3FyRGlzdD11LnNxdWFyZWREaXN0YW5jZSx1Lmxlbmd0aD1mdW5jdGlvbihlKXt2YXIgdD1lWzBdLG49ZVsxXSxyPWVbMl0saT1lWzNdO3JldHVybiBNYXRoLnNxcnQodCp0K24qbityKnIraSppKX0sdS5sZW49dS5sZW5ndGgsdS5zcXVhcmVkTGVuZ3RoPWZ1bmN0aW9uKGUpe3ZhciB0PWVbMF0sbj1lWzFdLHI9ZVsyXSxpPWVbM107cmV0dXJuIHQqdCtuKm4rcipyK2kqaX0sdS5zcXJMZW49dS5zcXVhcmVkTGVuZ3RoLHUubmVnYXRlPWZ1bmN0aW9uKGUsdCl7cmV0dXJuIGVbMF09LXRbMF0sZVsxXT0tdFsxXSxlWzJdPS10WzJdLGVbM109LXRbM10sZX0sdS5ub3JtYWxpemU9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLHI9dFsxXSxpPXRbMl0scz10WzNdLG89bipuK3IqcitpKmkrcypzO3JldHVybiBvPjAmJihvPTEvTWF0aC5zcXJ0KG8pLGVbMF09dFswXSpvLGVbMV09dFsxXSpvLGVbMl09dFsyXSpvLGVbM109dFszXSpvKSxlfSx1LmRvdD1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdKnRbMF0rZVsxXSp0WzFdK2VbMl0qdFsyXStlWzNdKnRbM119LHUubGVycD1mdW5jdGlvbihlLHQsbixyKXt2YXIgaT10WzBdLHM9dFsxXSxvPXRbMl0sdT10WzNdO3JldHVybiBlWzBdPWkrciooblswXS1pKSxlWzFdPXMrciooblsxXS1zKSxlWzJdPW8rciooblsyXS1vKSxlWzNdPXUrciooblszXS11KSxlfSx1LnJhbmRvbT1mdW5jdGlvbihlLHQpe3JldHVybiB0PXR8fDEsZVswXT1yKCksZVsxXT1yKCksZVsyXT1yKCksZVszXT1yKCksdS5ub3JtYWxpemUoZSxlKSx1LnNjYWxlKGUsZSx0KSxlfSx1LnRyYW5zZm9ybU1hdDQ9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM107cmV0dXJuIGVbMF09blswXSpyK25bNF0qaStuWzhdKnMrblsxMl0qbyxlWzFdPW5bMV0qcituWzVdKmkrbls5XSpzK25bMTNdKm8sZVsyXT1uWzJdKnIrbls2XSppK25bMTBdKnMrblsxNF0qbyxlWzNdPW5bM10qcituWzddKmkrblsxMV0qcytuWzE1XSpvLGV9LHUudHJhbnNmb3JtUXVhdD1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89blswXSx1PW5bMV0sYT1uWzJdLGY9blszXSxsPWYqcit1KnMtYSppLGM9ZippK2Eqci1vKnMsaD1mKnMrbyppLXUqcixwPS1vKnItdSppLWEqcztyZXR1cm4gZVswXT1sKmYrcCotbytjKi1hLWgqLXUsZVsxXT1jKmYrcCotdStoKi1vLWwqLWEsZVsyXT1oKmYrcCotYStsKi11LWMqLW8sZX0sdS5mb3JFYWNoPWZ1bmN0aW9uKCl7dmFyIGU9dS5jcmVhdGUoKTtyZXR1cm4gZnVuY3Rpb24odCxuLHIsaSxzLG8pe3ZhciB1LGE7bnx8KG49NCkscnx8KHI9MCksaT9hPU1hdGgubWluKGkqbityLHQubGVuZ3RoKTphPXQubGVuZ3RoO2Zvcih1PXI7dTxhO3UrPW4pZVswXT10W3VdLGVbMV09dFt1KzFdLGVbMl09dFt1KzJdLGVbM109dFt1KzNdLHMoZSxlLG8pLHRbdV09ZVswXSx0W3UrMV09ZVsxXSx0W3UrMl09ZVsyXSx0W3UrM109ZVszXTtyZXR1cm4gdH19KCksdS5zdHI9ZnVuY3Rpb24oZSl7cmV0dXJuXCJ2ZWM0KFwiK2VbMF0rXCIsIFwiK2VbMV0rXCIsIFwiK2VbMl0rXCIsIFwiK2VbM10rXCIpXCJ9LHR5cGVvZiBlIT1cInVuZGVmaW5lZFwiJiYoZS52ZWM0PXUpO3ZhciBhPXt9O2EuY3JlYXRlPWZ1bmN0aW9uKCl7dmFyIGU9bmV3IG4oNCk7cmV0dXJuIGVbMF09MSxlWzFdPTAsZVsyXT0wLGVbM109MSxlfSxhLmNsb25lPWZ1bmN0aW9uKGUpe3ZhciB0PW5ldyBuKDQpO3JldHVybiB0WzBdPWVbMF0sdFsxXT1lWzFdLHRbMl09ZVsyXSx0WzNdPWVbM10sdH0sYS5jb3B5PWZ1bmN0aW9uKGUsdCl7cmV0dXJuIGVbMF09dFswXSxlWzFdPXRbMV0sZVsyXT10WzJdLGVbM109dFszXSxlfSxhLmlkZW50aXR5PWZ1bmN0aW9uKGUpe3JldHVybiBlWzBdPTEsZVsxXT0wLGVbMl09MCxlWzNdPTEsZX0sYS50cmFuc3Bvc2U9ZnVuY3Rpb24oZSx0KXtpZihlPT09dCl7dmFyIG49dFsxXTtlWzFdPXRbMl0sZVsyXT1ufWVsc2UgZVswXT10WzBdLGVbMV09dFsyXSxlWzJdPXRbMV0sZVszXT10WzNdO3JldHVybiBlfSxhLmludmVydD1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0scj10WzFdLGk9dFsyXSxzPXRbM10sbz1uKnMtaSpyO3JldHVybiBvPyhvPTEvbyxlWzBdPXMqbyxlWzFdPS1yKm8sZVsyXT0taSpvLGVbM109bipvLGUpOm51bGx9LGEuYWRqb2ludD1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF07cmV0dXJuIGVbMF09dFszXSxlWzFdPS10WzFdLGVbMl09LXRbMl0sZVszXT1uLGV9LGEuZGV0ZXJtaW5hbnQ9ZnVuY3Rpb24oZSl7cmV0dXJuIGVbMF0qZVszXS1lWzJdKmVbMV19LGEubXVsdGlwbHk9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM10sdT1uWzBdLGE9blsxXSxmPW5bMl0sbD1uWzNdO3JldHVybiBlWzBdPXIqdStpKmYsZVsxXT1yKmEraSpsLGVbMl09cyp1K28qZixlWzNdPXMqYStvKmwsZX0sYS5tdWw9YS5tdWx0aXBseSxhLnJvdGF0ZT1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXSx1PU1hdGguc2luKG4pLGE9TWF0aC5jb3Mobik7cmV0dXJuIGVbMF09ciphK2kqdSxlWzFdPXIqLXUraSphLGVbMl09cyphK28qdSxlWzNdPXMqLXUrbyphLGV9LGEuc2NhbGU9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM10sdT1uWzBdLGE9blsxXTtyZXR1cm4gZVswXT1yKnUsZVsxXT1pKmEsZVsyXT1zKnUsZVszXT1vKmEsZX0sYS5zdHI9ZnVuY3Rpb24oZSl7cmV0dXJuXCJtYXQyKFwiK2VbMF0rXCIsIFwiK2VbMV0rXCIsIFwiK2VbMl0rXCIsIFwiK2VbM10rXCIpXCJ9LHR5cGVvZiBlIT1cInVuZGVmaW5lZFwiJiYoZS5tYXQyPWEpO3ZhciBmPXt9O2YuY3JlYXRlPWZ1bmN0aW9uKCl7dmFyIGU9bmV3IG4oNik7cmV0dXJuIGVbMF09MSxlWzFdPTAsZVsyXT0wLGVbM109MSxlWzRdPTAsZVs1XT0wLGV9LGYuY2xvbmU9ZnVuY3Rpb24oZSl7dmFyIHQ9bmV3IG4oNik7cmV0dXJuIHRbMF09ZVswXSx0WzFdPWVbMV0sdFsyXT1lWzJdLHRbM109ZVszXSx0WzRdPWVbNF0sdFs1XT1lWzVdLHR9LGYuY29weT1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdPXRbMF0sZVsxXT10WzFdLGVbMl09dFsyXSxlWzNdPXRbM10sZVs0XT10WzRdLGVbNV09dFs1XSxlfSxmLmlkZW50aXR5PWZ1bmN0aW9uKGUpe3JldHVybiBlWzBdPTEsZVsxXT0wLGVbMl09MCxlWzNdPTEsZVs0XT0wLGVbNV09MCxlfSxmLmludmVydD1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0scj10WzFdLGk9dFsyXSxzPXRbM10sbz10WzRdLHU9dFs1XSxhPW4qcy1yKmk7cmV0dXJuIGE/KGE9MS9hLGVbMF09cyphLGVbMV09LXIqYSxlWzJdPS1pKmEsZVszXT1uKmEsZVs0XT0oaSp1LXMqbykqYSxlWzVdPShyKm8tbip1KSphLGUpOm51bGx9LGYuZGV0ZXJtaW5hbnQ9ZnVuY3Rpb24oZSl7cmV0dXJuIGVbMF0qZVszXS1lWzFdKmVbMl19LGYubXVsdGlwbHk9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM10sdT10WzRdLGE9dFs1XSxmPW5bMF0sbD1uWzFdLGM9blsyXSxoPW5bM10scD1uWzRdLGQ9bls1XTtyZXR1cm4gZVswXT1yKmYraSpjLGVbMV09cipsK2kqaCxlWzJdPXMqZitvKmMsZVszXT1zKmwrbypoLGVbNF09Zip1K2MqYStwLGVbNV09bCp1K2gqYStkLGV9LGYubXVsPWYubXVsdGlwbHksZi5yb3RhdGU9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM10sdT10WzRdLGE9dFs1XSxmPU1hdGguc2luKG4pLGw9TWF0aC5jb3Mobik7cmV0dXJuIGVbMF09cipsK2kqZixlWzFdPS1yKmYraSpsLGVbMl09cypsK28qZixlWzNdPS1zKmYrbCpvLGVbNF09bCp1K2YqYSxlWzVdPWwqYS1mKnUsZX0sZi5zY2FsZT1mdW5jdGlvbihlLHQsbil7dmFyIHI9blswXSxpPW5bMV07cmV0dXJuIGVbMF09dFswXSpyLGVbMV09dFsxXSppLGVbMl09dFsyXSpyLGVbM109dFszXSppLGVbNF09dFs0XSpyLGVbNV09dFs1XSppLGV9LGYudHJhbnNsYXRlPWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10WzBdLGVbMV09dFsxXSxlWzJdPXRbMl0sZVszXT10WzNdLGVbNF09dFs0XStuWzBdLGVbNV09dFs1XStuWzFdLGV9LGYuc3RyPWZ1bmN0aW9uKGUpe3JldHVyblwibWF0MmQoXCIrZVswXStcIiwgXCIrZVsxXStcIiwgXCIrZVsyXStcIiwgXCIrZVszXStcIiwgXCIrZVs0XStcIiwgXCIrZVs1XStcIilcIn0sdHlwZW9mIGUhPVwidW5kZWZpbmVkXCImJihlLm1hdDJkPWYpO3ZhciBsPXt9O2wuY3JlYXRlPWZ1bmN0aW9uKCl7dmFyIGU9bmV3IG4oOSk7cmV0dXJuIGVbMF09MSxlWzFdPTAsZVsyXT0wLGVbM109MCxlWzRdPTEsZVs1XT0wLGVbNl09MCxlWzddPTAsZVs4XT0xLGV9LGwuZnJvbU1hdDQ9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXT10WzBdLGVbMV09dFsxXSxlWzJdPXRbMl0sZVszXT10WzRdLGVbNF09dFs1XSxlWzVdPXRbNl0sZVs2XT10WzhdLGVbN109dFs5XSxlWzhdPXRbMTBdLGV9LGwuY2xvbmU9ZnVuY3Rpb24oZSl7dmFyIHQ9bmV3IG4oOSk7cmV0dXJuIHRbMF09ZVswXSx0WzFdPWVbMV0sdFsyXT1lWzJdLHRbM109ZVszXSx0WzRdPWVbNF0sdFs1XT1lWzVdLHRbNl09ZVs2XSx0WzddPWVbN10sdFs4XT1lWzhdLHR9LGwuY29weT1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdPXRbMF0sZVsxXT10WzFdLGVbMl09dFsyXSxlWzNdPXRbM10sZVs0XT10WzRdLGVbNV09dFs1XSxlWzZdPXRbNl0sZVs3XT10WzddLGVbOF09dFs4XSxlfSxsLmlkZW50aXR5PWZ1bmN0aW9uKGUpe3JldHVybiBlWzBdPTEsZVsxXT0wLGVbMl09MCxlWzNdPTAsZVs0XT0xLGVbNV09MCxlWzZdPTAsZVs3XT0wLGVbOF09MSxlfSxsLnRyYW5zcG9zZT1mdW5jdGlvbihlLHQpe2lmKGU9PT10KXt2YXIgbj10WzFdLHI9dFsyXSxpPXRbNV07ZVsxXT10WzNdLGVbMl09dFs2XSxlWzNdPW4sZVs1XT10WzddLGVbNl09cixlWzddPWl9ZWxzZSBlWzBdPXRbMF0sZVsxXT10WzNdLGVbMl09dFs2XSxlWzNdPXRbMV0sZVs0XT10WzRdLGVbNV09dFs3XSxlWzZdPXRbMl0sZVs3XT10WzVdLGVbOF09dFs4XTtyZXR1cm4gZX0sbC5pbnZlcnQ9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLHI9dFsxXSxpPXRbMl0scz10WzNdLG89dFs0XSx1PXRbNV0sYT10WzZdLGY9dFs3XSxsPXRbOF0sYz1sKm8tdSpmLGg9LWwqcyt1KmEscD1mKnMtbyphLGQ9bipjK3IqaCtpKnA7cmV0dXJuIGQ/KGQ9MS9kLGVbMF09YypkLGVbMV09KC1sKnIraSpmKSpkLGVbMl09KHUqci1pKm8pKmQsZVszXT1oKmQsZVs0XT0obCpuLWkqYSkqZCxlWzVdPSgtdSpuK2kqcykqZCxlWzZdPXAqZCxlWzddPSgtZipuK3IqYSkqZCxlWzhdPShvKm4tcipzKSpkLGUpOm51bGx9LGwuYWRqb2ludD1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0scj10WzFdLGk9dFsyXSxzPXRbM10sbz10WzRdLHU9dFs1XSxhPXRbNl0sZj10WzddLGw9dFs4XTtyZXR1cm4gZVswXT1vKmwtdSpmLGVbMV09aSpmLXIqbCxlWzJdPXIqdS1pKm8sZVszXT11KmEtcypsLGVbNF09bipsLWkqYSxlWzVdPWkqcy1uKnUsZVs2XT1zKmYtbyphLGVbN109ciphLW4qZixlWzhdPW4qby1yKnMsZX0sbC5kZXRlcm1pbmFudD1mdW5jdGlvbihlKXt2YXIgdD1lWzBdLG49ZVsxXSxyPWVbMl0saT1lWzNdLHM9ZVs0XSxvPWVbNV0sdT1lWzZdLGE9ZVs3XSxmPWVbOF07cmV0dXJuIHQqKGYqcy1vKmEpK24qKC1mKmkrbyp1KStyKihhKmktcyp1KX0sbC5tdWx0aXBseT1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXSx1PXRbNF0sYT10WzVdLGY9dFs2XSxsPXRbN10sYz10WzhdLGg9blswXSxwPW5bMV0sZD1uWzJdLHY9blszXSxtPW5bNF0sZz1uWzVdLHk9bls2XSxiPW5bN10sdz1uWzhdO3JldHVybiBlWzBdPWgqcitwKm8rZCpmLGVbMV09aCppK3AqdStkKmwsZVsyXT1oKnMrcCphK2QqYyxlWzNdPXYqcittKm8rZypmLGVbNF09dippK20qdStnKmwsZVs1XT12KnMrbSphK2cqYyxlWzZdPXkqcitiKm8rdypmLGVbN109eSppK2IqdSt3KmwsZVs4XT15KnMrYiphK3cqYyxlfSxsLm11bD1sLm11bHRpcGx5LGwudHJhbnNsYXRlPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz10WzNdLHU9dFs0XSxhPXRbNV0sZj10WzZdLGw9dFs3XSxjPXRbOF0saD1uWzBdLHA9blsxXTtyZXR1cm4gZVswXT1yLGVbMV09aSxlWzJdPXMsZVszXT1vLGVbNF09dSxlWzVdPWEsZVs2XT1oKnIrcCpvK2YsZVs3XT1oKmkrcCp1K2wsZVs4XT1oKnMrcCphK2MsZX0sbC5yb3RhdGU9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM10sdT10WzRdLGE9dFs1XSxmPXRbNl0sbD10WzddLGM9dFs4XSxoPU1hdGguc2luKG4pLHA9TWF0aC5jb3Mobik7cmV0dXJuIGVbMF09cCpyK2gqbyxlWzFdPXAqaStoKnUsZVsyXT1wKnMraCphLGVbM109cCpvLWgqcixlWzRdPXAqdS1oKmksZVs1XT1wKmEtaCpzLGVbNl09ZixlWzddPWwsZVs4XT1jLGV9LGwuc2NhbGU9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPW5bMF0saT1uWzFdO3JldHVybiBlWzBdPXIqdFswXSxlWzFdPXIqdFsxXSxlWzJdPXIqdFsyXSxlWzNdPWkqdFszXSxlWzRdPWkqdFs0XSxlWzVdPWkqdFs1XSxlWzZdPXRbNl0sZVs3XT10WzddLGVbOF09dFs4XSxlfSxsLmZyb21NYXQyZD1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdPXRbMF0sZVsxXT10WzFdLGVbMl09MCxlWzNdPXRbMl0sZVs0XT10WzNdLGVbNV09MCxlWzZdPXRbNF0sZVs3XT10WzVdLGVbOF09MSxlfSxsLmZyb21RdWF0PWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXSxyPXRbMV0saT10WzJdLHM9dFszXSxvPW4rbix1PXIrcixhPWkraSxmPW4qbyxsPW4qdSxjPW4qYSxoPXIqdSxwPXIqYSxkPWkqYSx2PXMqbyxtPXMqdSxnPXMqYTtyZXR1cm4gZVswXT0xLShoK2QpLGVbM109bCtnLGVbNl09Yy1tLGVbMV09bC1nLGVbNF09MS0oZitkKSxlWzddPXArdixlWzJdPWMrbSxlWzVdPXAtdixlWzhdPTEtKGYraCksZX0sbC5ub3JtYWxGcm9tTWF0ND1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0scj10WzFdLGk9dFsyXSxzPXRbM10sbz10WzRdLHU9dFs1XSxhPXRbNl0sZj10WzddLGw9dFs4XSxjPXRbOV0saD10WzEwXSxwPXRbMTFdLGQ9dFsxMl0sdj10WzEzXSxtPXRbMTRdLGc9dFsxNV0seT1uKnUtcipvLGI9biphLWkqbyx3PW4qZi1zKm8sRT1yKmEtaSp1LFM9cipmLXMqdSx4PWkqZi1zKmEsVD1sKnYtYypkLE49bCptLWgqZCxDPWwqZy1wKmQsaz1jKm0taCp2LEw9YypnLXAqdixBPWgqZy1wKm0sTz15KkEtYipMK3cqaytFKkMtUypOK3gqVDtyZXR1cm4gTz8oTz0xL08sZVswXT0odSpBLWEqTCtmKmspKk8sZVsxXT0oYSpDLW8qQS1mKk4pKk8sZVsyXT0obypMLXUqQytmKlQpKk8sZVszXT0oaSpMLXIqQS1zKmspKk8sZVs0XT0obipBLWkqQytzKk4pKk8sZVs1XT0ocipDLW4qTC1zKlQpKk8sZVs2XT0odip4LW0qUytnKkUpKk8sZVs3XT0obSp3LWQqeC1nKmIpKk8sZVs4XT0oZCpTLXYqdytnKnkpKk8sZSk6bnVsbH0sbC5zdHI9ZnVuY3Rpb24oZSl7cmV0dXJuXCJtYXQzKFwiK2VbMF0rXCIsIFwiK2VbMV0rXCIsIFwiK2VbMl0rXCIsIFwiK2VbM10rXCIsIFwiK2VbNF0rXCIsIFwiK2VbNV0rXCIsIFwiK2VbNl0rXCIsIFwiK2VbN10rXCIsIFwiK2VbOF0rXCIpXCJ9LHR5cGVvZiBlIT1cInVuZGVmaW5lZFwiJiYoZS5tYXQzPWwpO3ZhciBjPXt9O2MuY3JlYXRlPWZ1bmN0aW9uKCl7dmFyIGU9bmV3IG4oMTYpO3JldHVybiBlWzBdPTEsZVsxXT0wLGVbMl09MCxlWzNdPTAsZVs0XT0wLGVbNV09MSxlWzZdPTAsZVs3XT0wLGVbOF09MCxlWzldPTAsZVsxMF09MSxlWzExXT0wLGVbMTJdPTAsZVsxM109MCxlWzE0XT0wLGVbMTVdPTEsZX0sYy5jbG9uZT1mdW5jdGlvbihlKXt2YXIgdD1uZXcgbigxNik7cmV0dXJuIHRbMF09ZVswXSx0WzFdPWVbMV0sdFsyXT1lWzJdLHRbM109ZVszXSx0WzRdPWVbNF0sdFs1XT1lWzVdLHRbNl09ZVs2XSx0WzddPWVbN10sdFs4XT1lWzhdLHRbOV09ZVs5XSx0WzEwXT1lWzEwXSx0WzExXT1lWzExXSx0WzEyXT1lWzEyXSx0WzEzXT1lWzEzXSx0WzE0XT1lWzE0XSx0WzE1XT1lWzE1XSx0fSxjLmNvcHk9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXT10WzBdLGVbMV09dFsxXSxlWzJdPXRbMl0sZVszXT10WzNdLGVbNF09dFs0XSxlWzVdPXRbNV0sZVs2XT10WzZdLGVbN109dFs3XSxlWzhdPXRbOF0sZVs5XT10WzldLGVbMTBdPXRbMTBdLGVbMTFdPXRbMTFdLGVbMTJdPXRbMTJdLGVbMTNdPXRbMTNdLGVbMTRdPXRbMTRdLGVbMTVdPXRbMTVdLGV9LGMuaWRlbnRpdHk9ZnVuY3Rpb24oZSl7cmV0dXJuIGVbMF09MSxlWzFdPTAsZVsyXT0wLGVbM109MCxlWzRdPTAsZVs1XT0xLGVbNl09MCxlWzddPTAsZVs4XT0wLGVbOV09MCxlWzEwXT0xLGVbMTFdPTAsZVsxMl09MCxlWzEzXT0wLGVbMTRdPTAsZVsxNV09MSxlfSxjLnRyYW5zcG9zZT1mdW5jdGlvbihlLHQpe2lmKGU9PT10KXt2YXIgbj10WzFdLHI9dFsyXSxpPXRbM10scz10WzZdLG89dFs3XSx1PXRbMTFdO2VbMV09dFs0XSxlWzJdPXRbOF0sZVszXT10WzEyXSxlWzRdPW4sZVs2XT10WzldLGVbN109dFsxM10sZVs4XT1yLGVbOV09cyxlWzExXT10WzE0XSxlWzEyXT1pLGVbMTNdPW8sZVsxNF09dX1lbHNlIGVbMF09dFswXSxlWzFdPXRbNF0sZVsyXT10WzhdLGVbM109dFsxMl0sZVs0XT10WzFdLGVbNV09dFs1XSxlWzZdPXRbOV0sZVs3XT10WzEzXSxlWzhdPXRbMl0sZVs5XT10WzZdLGVbMTBdPXRbMTBdLGVbMTFdPXRbMTRdLGVbMTJdPXRbM10sZVsxM109dFs3XSxlWzE0XT10WzExXSxlWzE1XT10WzE1XTtyZXR1cm4gZX0sYy5pbnZlcnQ9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLHI9dFsxXSxpPXRbMl0scz10WzNdLG89dFs0XSx1PXRbNV0sYT10WzZdLGY9dFs3XSxsPXRbOF0sYz10WzldLGg9dFsxMF0scD10WzExXSxkPXRbMTJdLHY9dFsxM10sbT10WzE0XSxnPXRbMTVdLHk9bip1LXIqbyxiPW4qYS1pKm8sdz1uKmYtcypvLEU9ciphLWkqdSxTPXIqZi1zKnUseD1pKmYtcyphLFQ9bCp2LWMqZCxOPWwqbS1oKmQsQz1sKmctcCpkLGs9YyptLWgqdixMPWMqZy1wKnYsQT1oKmctcCptLE89eSpBLWIqTCt3KmsrRSpDLVMqTit4KlQ7cmV0dXJuIE8/KE89MS9PLGVbMF09KHUqQS1hKkwrZiprKSpPLGVbMV09KGkqTC1yKkEtcyprKSpPLGVbMl09KHYqeC1tKlMrZypFKSpPLGVbM109KGgqUy1jKngtcCpFKSpPLGVbNF09KGEqQy1vKkEtZipOKSpPLGVbNV09KG4qQS1pKkMrcypOKSpPLGVbNl09KG0qdy1kKngtZypiKSpPLGVbN109KGwqeC1oKncrcCpiKSpPLGVbOF09KG8qTC11KkMrZipUKSpPLGVbOV09KHIqQy1uKkwtcypUKSpPLGVbMTBdPShkKlMtdip3K2cqeSkqTyxlWzExXT0oYyp3LWwqUy1wKnkpKk8sZVsxMl09KHUqTi1vKmstYSpUKSpPLGVbMTNdPShuKmstcipOK2kqVCkqTyxlWzE0XT0odipiLWQqRS1tKnkpKk8sZVsxNV09KGwqRS1jKmIraCp5KSpPLGUpOm51bGx9LGMuYWRqb2ludD1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0scj10WzFdLGk9dFsyXSxzPXRbM10sbz10WzRdLHU9dFs1XSxhPXRbNl0sZj10WzddLGw9dFs4XSxjPXRbOV0saD10WzEwXSxwPXRbMTFdLGQ9dFsxMl0sdj10WzEzXSxtPXRbMTRdLGc9dFsxNV07cmV0dXJuIGVbMF09dSooaCpnLXAqbSktYyooYSpnLWYqbSkrdiooYSpwLWYqaCksZVsxXT0tKHIqKGgqZy1wKm0pLWMqKGkqZy1zKm0pK3YqKGkqcC1zKmgpKSxlWzJdPXIqKGEqZy1mKm0pLXUqKGkqZy1zKm0pK3YqKGkqZi1zKmEpLGVbM109LShyKihhKnAtZipoKS11KihpKnAtcypoKStjKihpKmYtcyphKSksZVs0XT0tKG8qKGgqZy1wKm0pLWwqKGEqZy1mKm0pK2QqKGEqcC1mKmgpKSxlWzVdPW4qKGgqZy1wKm0pLWwqKGkqZy1zKm0pK2QqKGkqcC1zKmgpLGVbNl09LShuKihhKmctZiptKS1vKihpKmctcyptKStkKihpKmYtcyphKSksZVs3XT1uKihhKnAtZipoKS1vKihpKnAtcypoKStsKihpKmYtcyphKSxlWzhdPW8qKGMqZy1wKnYpLWwqKHUqZy1mKnYpK2QqKHUqcC1mKmMpLGVbOV09LShuKihjKmctcCp2KS1sKihyKmctcyp2KStkKihyKnAtcypjKSksZVsxMF09bioodSpnLWYqdiktbyoocipnLXMqdikrZCoocipmLXMqdSksZVsxMV09LShuKih1KnAtZipjKS1vKihyKnAtcypjKStsKihyKmYtcyp1KSksZVsxMl09LShvKihjKm0taCp2KS1sKih1Km0tYSp2KStkKih1KmgtYSpjKSksZVsxM109biooYyptLWgqdiktbCoociptLWkqdikrZCoocipoLWkqYyksZVsxNF09LShuKih1Km0tYSp2KS1vKihyKm0taSp2KStkKihyKmEtaSp1KSksZVsxNV09bioodSpoLWEqYyktbyoocipoLWkqYykrbCoociphLWkqdSksZX0sYy5kZXRlcm1pbmFudD1mdW5jdGlvbihlKXt2YXIgdD1lWzBdLG49ZVsxXSxyPWVbMl0saT1lWzNdLHM9ZVs0XSxvPWVbNV0sdT1lWzZdLGE9ZVs3XSxmPWVbOF0sbD1lWzldLGM9ZVsxMF0saD1lWzExXSxwPWVbMTJdLGQ9ZVsxM10sdj1lWzE0XSxtPWVbMTVdLGc9dCpvLW4qcyx5PXQqdS1yKnMsYj10KmEtaSpzLHc9bip1LXIqbyxFPW4qYS1pKm8sUz1yKmEtaSp1LHg9ZipkLWwqcCxUPWYqdi1jKnAsTj1mKm0taCpwLEM9bCp2LWMqZCxrPWwqbS1oKmQsTD1jKm0taCp2O3JldHVybiBnKkwteSprK2IqQyt3Kk4tRSpUK1MqeH0sYy5tdWx0aXBseT1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXSx1PXRbNF0sYT10WzVdLGY9dFs2XSxsPXRbN10sYz10WzhdLGg9dFs5XSxwPXRbMTBdLGQ9dFsxMV0sdj10WzEyXSxtPXRbMTNdLGc9dFsxNF0seT10WzE1XSxiPW5bMF0sdz1uWzFdLEU9blsyXSxTPW5bM107cmV0dXJuIGVbMF09YipyK3cqdStFKmMrUyp2LGVbMV09YippK3cqYStFKmgrUyptLGVbMl09YipzK3cqZitFKnArUypnLGVbM109YipvK3cqbCtFKmQrUyp5LGI9bls0XSx3PW5bNV0sRT1uWzZdLFM9bls3XSxlWzRdPWIqcit3KnUrRSpjK1MqdixlWzVdPWIqaSt3KmErRSpoK1MqbSxlWzZdPWIqcyt3KmYrRSpwK1MqZyxlWzddPWIqbyt3KmwrRSpkK1MqeSxiPW5bOF0sdz1uWzldLEU9blsxMF0sUz1uWzExXSxlWzhdPWIqcit3KnUrRSpjK1MqdixlWzldPWIqaSt3KmErRSpoK1MqbSxlWzEwXT1iKnMrdypmK0UqcCtTKmcsZVsxMV09YipvK3cqbCtFKmQrUyp5LGI9blsxMl0sdz1uWzEzXSxFPW5bMTRdLFM9blsxNV0sZVsxMl09YipyK3cqdStFKmMrUyp2LGVbMTNdPWIqaSt3KmErRSpoK1MqbSxlWzE0XT1iKnMrdypmK0UqcCtTKmcsZVsxNV09YipvK3cqbCtFKmQrUyp5LGV9LGMubXVsPWMubXVsdGlwbHksYy50cmFuc2xhdGU9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPW5bMF0saT1uWzFdLHM9blsyXSxvLHUsYSxmLGwsYyxoLHAsZCx2LG0sZztyZXR1cm4gdD09PWU/KGVbMTJdPXRbMF0qcit0WzRdKmkrdFs4XSpzK3RbMTJdLGVbMTNdPXRbMV0qcit0WzVdKmkrdFs5XSpzK3RbMTNdLGVbMTRdPXRbMl0qcit0WzZdKmkrdFsxMF0qcyt0WzE0XSxlWzE1XT10WzNdKnIrdFs3XSppK3RbMTFdKnMrdFsxNV0pOihvPXRbMF0sdT10WzFdLGE9dFsyXSxmPXRbM10sbD10WzRdLGM9dFs1XSxoPXRbNl0scD10WzddLGQ9dFs4XSx2PXRbOV0sbT10WzEwXSxnPXRbMTFdLGVbMF09byxlWzFdPXUsZVsyXT1hLGVbM109ZixlWzRdPWwsZVs1XT1jLGVbNl09aCxlWzddPXAsZVs4XT1kLGVbOV09dixlWzEwXT1tLGVbMTFdPWcsZVsxMl09bypyK2wqaStkKnMrdFsxMl0sZVsxM109dSpyK2MqaSt2KnMrdFsxM10sZVsxNF09YSpyK2gqaSttKnMrdFsxNF0sZVsxNV09ZipyK3AqaStnKnMrdFsxNV0pLGV9LGMuc2NhbGU9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPW5bMF0saT1uWzFdLHM9blsyXTtyZXR1cm4gZVswXT10WzBdKnIsZVsxXT10WzFdKnIsZVsyXT10WzJdKnIsZVszXT10WzNdKnIsZVs0XT10WzRdKmksZVs1XT10WzVdKmksZVs2XT10WzZdKmksZVs3XT10WzddKmksZVs4XT10WzhdKnMsZVs5XT10WzldKnMsZVsxMF09dFsxMF0qcyxlWzExXT10WzExXSpzLGVbMTJdPXRbMTJdLGVbMTNdPXRbMTNdLGVbMTRdPXRbMTRdLGVbMTVdPXRbMTVdLGV9LGMucm90YXRlPWZ1bmN0aW9uKGUsbixyLGkpe3ZhciBzPWlbMF0sbz1pWzFdLHU9aVsyXSxhPU1hdGguc3FydChzKnMrbypvK3UqdSksZixsLGMsaCxwLGQsdixtLGcseSxiLHcsRSxTLHgsVCxOLEMsayxMLEEsTyxNLF87cmV0dXJuIE1hdGguYWJzKGEpPHQ/bnVsbDooYT0xL2Escyo9YSxvKj1hLHUqPWEsZj1NYXRoLnNpbihyKSxsPU1hdGguY29zKHIpLGM9MS1sLGg9blswXSxwPW5bMV0sZD1uWzJdLHY9blszXSxtPW5bNF0sZz1uWzVdLHk9bls2XSxiPW5bN10sdz1uWzhdLEU9bls5XSxTPW5bMTBdLHg9blsxMV0sVD1zKnMqYytsLE49bypzKmMrdSpmLEM9dSpzKmMtbypmLGs9cypvKmMtdSpmLEw9bypvKmMrbCxBPXUqbypjK3MqZixPPXMqdSpjK28qZixNPW8qdSpjLXMqZixfPXUqdSpjK2wsZVswXT1oKlQrbSpOK3cqQyxlWzFdPXAqVCtnKk4rRSpDLGVbMl09ZCpUK3kqTitTKkMsZVszXT12KlQrYipOK3gqQyxlWzRdPWgqayttKkwrdypBLGVbNV09cCprK2cqTCtFKkEsZVs2XT1kKmsreSpMK1MqQSxlWzddPXYqaytiKkwreCpBLGVbOF09aCpPK20qTSt3Kl8sZVs5XT1wKk8rZypNK0UqXyxlWzEwXT1kKk8reSpNK1MqXyxlWzExXT12Kk8rYipNK3gqXyxuIT09ZSYmKGVbMTJdPW5bMTJdLGVbMTNdPW5bMTNdLGVbMTRdPW5bMTRdLGVbMTVdPW5bMTVdKSxlKX0sYy5yb3RhdGVYPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj1NYXRoLnNpbihuKSxpPU1hdGguY29zKG4pLHM9dFs0XSxvPXRbNV0sdT10WzZdLGE9dFs3XSxmPXRbOF0sbD10WzldLGM9dFsxMF0saD10WzExXTtyZXR1cm4gdCE9PWUmJihlWzBdPXRbMF0sZVsxXT10WzFdLGVbMl09dFsyXSxlWzNdPXRbM10sZVsxMl09dFsxMl0sZVsxM109dFsxM10sZVsxNF09dFsxNF0sZVsxNV09dFsxNV0pLGVbNF09cyppK2YqcixlWzVdPW8qaStsKnIsZVs2XT11KmkrYypyLGVbN109YSppK2gqcixlWzhdPWYqaS1zKnIsZVs5XT1sKmktbypyLGVbMTBdPWMqaS11KnIsZVsxMV09aCppLWEqcixlfSxjLnJvdGF0ZVk9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPU1hdGguc2luKG4pLGk9TWF0aC5jb3Mobikscz10WzBdLG89dFsxXSx1PXRbMl0sYT10WzNdLGY9dFs4XSxsPXRbOV0sYz10WzEwXSxoPXRbMTFdO3JldHVybiB0IT09ZSYmKGVbNF09dFs0XSxlWzVdPXRbNV0sZVs2XT10WzZdLGVbN109dFs3XSxlWzEyXT10WzEyXSxlWzEzXT10WzEzXSxlWzE0XT10WzE0XSxlWzE1XT10WzE1XSksZVswXT1zKmktZipyLGVbMV09byppLWwqcixlWzJdPXUqaS1jKnIsZVszXT1hKmktaCpyLGVbOF09cypyK2YqaSxlWzldPW8qcitsKmksZVsxMF09dSpyK2MqaSxlWzExXT1hKnIraCppLGV9LGMucm90YXRlWj1mdW5jdGlvbihlLHQsbil7dmFyIHI9TWF0aC5zaW4obiksaT1NYXRoLmNvcyhuKSxzPXRbMF0sbz10WzFdLHU9dFsyXSxhPXRbM10sZj10WzRdLGw9dFs1XSxjPXRbNl0saD10WzddO3JldHVybiB0IT09ZSYmKGVbOF09dFs4XSxlWzldPXRbOV0sZVsxMF09dFsxMF0sZVsxMV09dFsxMV0sZVsxMl09dFsxMl0sZVsxM109dFsxM10sZVsxNF09dFsxNF0sZVsxNV09dFsxNV0pLGVbMF09cyppK2YqcixlWzFdPW8qaStsKnIsZVsyXT11KmkrYypyLGVbM109YSppK2gqcixlWzRdPWYqaS1zKnIsZVs1XT1sKmktbypyLGVbNl09YyppLXUqcixlWzddPWgqaS1hKnIsZX0sYy5mcm9tUm90YXRpb25UcmFuc2xhdGlvbj1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXSx1PXIrcixhPWkraSxmPXMrcyxsPXIqdSxjPXIqYSxoPXIqZixwPWkqYSxkPWkqZix2PXMqZixtPW8qdSxnPW8qYSx5PW8qZjtyZXR1cm4gZVswXT0xLShwK3YpLGVbMV09Yyt5LGVbMl09aC1nLGVbM109MCxlWzRdPWMteSxlWzVdPTEtKGwrdiksZVs2XT1kK20sZVs3XT0wLGVbOF09aCtnLGVbOV09ZC1tLGVbMTBdPTEtKGwrcCksZVsxMV09MCxlWzEyXT1uWzBdLGVbMTNdPW5bMV0sZVsxNF09blsyXSxlWzE1XT0xLGV9LGMuZnJvbVF1YXQ9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLHI9dFsxXSxpPXRbMl0scz10WzNdLG89bituLHU9cityLGE9aStpLGY9bipvLGw9bip1LGM9biphLGg9cip1LHA9ciphLGQ9aSphLHY9cypvLG09cyp1LGc9cyphO3JldHVybiBlWzBdPTEtKGgrZCksZVsxXT1sK2csZVsyXT1jLW0sZVszXT0wLGVbNF09bC1nLGVbNV09MS0oZitkKSxlWzZdPXArdixlWzddPTAsZVs4XT1jK20sZVs5XT1wLXYsZVsxMF09MS0oZitoKSxlWzExXT0wLGVbMTJdPTAsZVsxM109MCxlWzE0XT0wLGVbMTVdPTEsZX0sYy5mcnVzdHVtPWZ1bmN0aW9uKGUsdCxuLHIsaSxzLG8pe3ZhciB1PTEvKG4tdCksYT0xLyhpLXIpLGY9MS8ocy1vKTtyZXR1cm4gZVswXT1zKjIqdSxlWzFdPTAsZVsyXT0wLGVbM109MCxlWzRdPTAsZVs1XT1zKjIqYSxlWzZdPTAsZVs3XT0wLGVbOF09KG4rdCkqdSxlWzldPShpK3IpKmEsZVsxMF09KG8rcykqZixlWzExXT0tMSxlWzEyXT0wLGVbMTNdPTAsZVsxNF09bypzKjIqZixlWzE1XT0wLGV9LGMucGVyc3BlY3RpdmU9ZnVuY3Rpb24oZSx0LG4scixpKXt2YXIgcz0xL01hdGgudGFuKHQvMiksbz0xLyhyLWkpO3JldHVybiBlWzBdPXMvbixlWzFdPTAsZVsyXT0wLGVbM109MCxlWzRdPTAsZVs1XT1zLGVbNl09MCxlWzddPTAsZVs4XT0wLGVbOV09MCxlWzEwXT0oaStyKSpvLGVbMTFdPS0xLGVbMTJdPTAsZVsxM109MCxlWzE0XT0yKmkqcipvLGVbMTVdPTAsZX0sYy5vcnRobz1mdW5jdGlvbihlLHQsbixyLGkscyxvKXt2YXIgdT0xLyh0LW4pLGE9MS8oci1pKSxmPTEvKHMtbyk7cmV0dXJuIGVbMF09LTIqdSxlWzFdPTAsZVsyXT0wLGVbM109MCxlWzRdPTAsZVs1XT0tMiphLGVbNl09MCxlWzddPTAsZVs4XT0wLGVbOV09MCxlWzEwXT0yKmYsZVsxMV09MCxlWzEyXT0odCtuKSp1LGVbMTNdPShpK3IpKmEsZVsxNF09KG8rcykqZixlWzE1XT0xLGV9LGMubG9va0F0PWZ1bmN0aW9uKGUsbixyLGkpe3ZhciBzLG8sdSxhLGYsbCxoLHAsZCx2LG09blswXSxnPW5bMV0seT1uWzJdLGI9aVswXSx3PWlbMV0sRT1pWzJdLFM9clswXSx4PXJbMV0sVD1yWzJdO3JldHVybiBNYXRoLmFicyhtLVMpPHQmJk1hdGguYWJzKGcteCk8dCYmTWF0aC5hYnMoeS1UKTx0P2MuaWRlbnRpdHkoZSk6KGg9bS1TLHA9Zy14LGQ9eS1ULHY9MS9NYXRoLnNxcnQoaCpoK3AqcCtkKmQpLGgqPXYscCo9dixkKj12LHM9dypkLUUqcCxvPUUqaC1iKmQsdT1iKnAtdypoLHY9TWF0aC5zcXJ0KHMqcytvKm8rdSp1KSx2Pyh2PTEvdixzKj12LG8qPXYsdSo9dik6KHM9MCxvPTAsdT0wKSxhPXAqdS1kKm8sZj1kKnMtaCp1LGw9aCpvLXAqcyx2PU1hdGguc3FydChhKmErZipmK2wqbCksdj8odj0xL3YsYSo9dixmKj12LGwqPXYpOihhPTAsZj0wLGw9MCksZVswXT1zLGVbMV09YSxlWzJdPWgsZVszXT0wLGVbNF09byxlWzVdPWYsZVs2XT1wLGVbN109MCxlWzhdPXUsZVs5XT1sLGVbMTBdPWQsZVsxMV09MCxlWzEyXT0tKHMqbStvKmcrdSp5KSxlWzEzXT0tKGEqbStmKmcrbCp5KSxlWzE0XT0tKGgqbStwKmcrZCp5KSxlWzE1XT0xLGUpfSxjLnN0cj1mdW5jdGlvbihlKXtyZXR1cm5cIm1hdDQoXCIrZVswXStcIiwgXCIrZVsxXStcIiwgXCIrZVsyXStcIiwgXCIrZVszXStcIiwgXCIrZVs0XStcIiwgXCIrZVs1XStcIiwgXCIrZVs2XStcIiwgXCIrZVs3XStcIiwgXCIrZVs4XStcIiwgXCIrZVs5XStcIiwgXCIrZVsxMF0rXCIsIFwiK2VbMTFdK1wiLCBcIitlWzEyXStcIiwgXCIrZVsxM10rXCIsIFwiK2VbMTRdK1wiLCBcIitlWzE1XStcIilcIn0sdHlwZW9mIGUhPVwidW5kZWZpbmVkXCImJihlLm1hdDQ9Yyk7dmFyIGg9e307aC5jcmVhdGU9ZnVuY3Rpb24oKXt2YXIgZT1uZXcgbig0KTtyZXR1cm4gZVswXT0wLGVbMV09MCxlWzJdPTAsZVszXT0xLGV9LGgucm90YXRpb25Ubz1mdW5jdGlvbigpe3ZhciBlPW8uY3JlYXRlKCksdD1vLmZyb21WYWx1ZXMoMSwwLDApLG49by5mcm9tVmFsdWVzKDAsMSwwKTtyZXR1cm4gZnVuY3Rpb24ocixpLHMpe3ZhciB1PW8uZG90KGkscyk7cmV0dXJuIHU8LTAuOTk5OTk5PyhvLmNyb3NzKGUsdCxpKSxvLmxlbmd0aChlKTwxZS02JiZvLmNyb3NzKGUsbixpKSxvLm5vcm1hbGl6ZShlLGUpLGguc2V0QXhpc0FuZ2xlKHIsZSxNYXRoLlBJKSxyKTp1Pi45OTk5OTk/KHJbMF09MCxyWzFdPTAsclsyXT0wLHJbM109MSxyKTooby5jcm9zcyhlLGkscyksclswXT1lWzBdLHJbMV09ZVsxXSxyWzJdPWVbMl0sclszXT0xK3UsaC5ub3JtYWxpemUocixyKSl9fSgpLGguc2V0QXhlcz1mdW5jdGlvbigpe3ZhciBlPWwuY3JlYXRlKCk7cmV0dXJuIGZ1bmN0aW9uKHQsbixyLGkpe3JldHVybiBlWzBdPXJbMF0sZVszXT1yWzFdLGVbNl09clsyXSxlWzFdPWlbMF0sZVs0XT1pWzFdLGVbN109aVsyXSxlWzJdPW5bMF0sZVs1XT1uWzFdLGVbOF09blsyXSxoLm5vcm1hbGl6ZSh0LGguZnJvbU1hdDModCxlKSl9fSgpLGguY2xvbmU9dS5jbG9uZSxoLmZyb21WYWx1ZXM9dS5mcm9tVmFsdWVzLGguY29weT11LmNvcHksaC5zZXQ9dS5zZXQsaC5pZGVudGl0eT1mdW5jdGlvbihlKXtyZXR1cm4gZVswXT0wLGVbMV09MCxlWzJdPTAsZVszXT0xLGV9LGguc2V0QXhpc0FuZ2xlPWZ1bmN0aW9uKGUsdCxuKXtuKj0uNTt2YXIgcj1NYXRoLnNpbihuKTtyZXR1cm4gZVswXT1yKnRbMF0sZVsxXT1yKnRbMV0sZVsyXT1yKnRbMl0sZVszXT1NYXRoLmNvcyhuKSxlfSxoLmFkZD11LmFkZCxoLm11bHRpcGx5PWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz10WzNdLHU9blswXSxhPW5bMV0sZj1uWzJdLGw9blszXTtyZXR1cm4gZVswXT1yKmwrbyp1K2kqZi1zKmEsZVsxXT1pKmwrbyphK3MqdS1yKmYsZVsyXT1zKmwrbypmK3IqYS1pKnUsZVszXT1vKmwtcip1LWkqYS1zKmYsZX0saC5tdWw9aC5tdWx0aXBseSxoLnNjYWxlPXUuc2NhbGUsaC5yb3RhdGVYPWZ1bmN0aW9uKGUsdCxuKXtuKj0uNTt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz10WzNdLHU9TWF0aC5zaW4obiksYT1NYXRoLmNvcyhuKTtyZXR1cm4gZVswXT1yKmErbyp1LGVbMV09aSphK3MqdSxlWzJdPXMqYS1pKnUsZVszXT1vKmEtcip1LGV9LGgucm90YXRlWT1mdW5jdGlvbihlLHQsbil7bio9LjU7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXSx1PU1hdGguc2luKG4pLGE9TWF0aC5jb3Mobik7cmV0dXJuIGVbMF09ciphLXMqdSxlWzFdPWkqYStvKnUsZVsyXT1zKmErcip1LGVbM109byphLWkqdSxlfSxoLnJvdGF0ZVo9ZnVuY3Rpb24oZSx0LG4pe24qPS41O3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM10sdT1NYXRoLnNpbihuKSxhPU1hdGguY29zKG4pO3JldHVybiBlWzBdPXIqYStpKnUsZVsxXT1pKmEtcip1LGVbMl09cyphK28qdSxlWzNdPW8qYS1zKnUsZX0saC5jYWxjdWxhdGVXPWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXSxyPXRbMV0saT10WzJdO3JldHVybiBlWzBdPW4sZVsxXT1yLGVbMl09aSxlWzNdPS1NYXRoLnNxcnQoTWF0aC5hYnMoMS1uKm4tcipyLWkqaSkpLGV9LGguZG90PXUuZG90LGgubGVycD11LmxlcnAsaC5zbGVycD1mdW5jdGlvbihlLHQsbixyKXt2YXIgaT10WzBdLHM9dFsxXSxvPXRbMl0sdT10WzNdLGE9blswXSxmPW5bMV0sbD1uWzJdLGM9blszXSxoLHAsZCx2LG07cmV0dXJuIHA9aSphK3MqZitvKmwrdSpjLHA8MCYmKHA9LXAsYT0tYSxmPS1mLGw9LWwsYz0tYyksMS1wPjFlLTY/KGg9TWF0aC5hY29zKHApLGQ9TWF0aC5zaW4oaCksdj1NYXRoLnNpbigoMS1yKSpoKS9kLG09TWF0aC5zaW4ocipoKS9kKToodj0xLXIsbT1yKSxlWzBdPXYqaSttKmEsZVsxXT12KnMrbSpmLGVbMl09dipvK20qbCxlWzNdPXYqdSttKmMsZX0saC5pbnZlcnQ9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLHI9dFsxXSxpPXRbMl0scz10WzNdLG89bipuK3IqcitpKmkrcypzLHU9bz8xL286MDtyZXR1cm4gZVswXT0tbip1LGVbMV09LXIqdSxlWzJdPS1pKnUsZVszXT1zKnUsZX0saC5jb25qdWdhdGU9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXT0tdFswXSxlWzFdPS10WzFdLGVbMl09LXRbMl0sZVszXT10WzNdLGV9LGgubGVuZ3RoPXUubGVuZ3RoLGgubGVuPWgubGVuZ3RoLGguc3F1YXJlZExlbmd0aD11LnNxdWFyZWRMZW5ndGgsaC5zcXJMZW49aC5zcXVhcmVkTGVuZ3RoLGgubm9ybWFsaXplPXUubm9ybWFsaXplLGguZnJvbU1hdDM9ZnVuY3Rpb24oKXt2YXIgZT10eXBlb2YgSW50OEFycmF5IT1cInVuZGVmaW5lZFwiP25ldyBJbnQ4QXJyYXkoWzEsMiwwXSk6WzEsMiwwXTtyZXR1cm4gZnVuY3Rpb24odCxuKXt2YXIgcj1uWzBdK25bNF0rbls4XSxpO2lmKHI+MClpPU1hdGguc3FydChyKzEpLHRbM109LjUqaSxpPS41L2ksdFswXT0obls3XS1uWzVdKSppLHRbMV09KG5bMl0tbls2XSkqaSx0WzJdPShuWzNdLW5bMV0pKmk7ZWxzZXt2YXIgcz0wO25bNF0+blswXSYmKHM9MSksbls4XT5uW3MqMytzXSYmKHM9Mik7dmFyIG89ZVtzXSx1PWVbb107aT1NYXRoLnNxcnQobltzKjMrc10tbltvKjMrb10tblt1KjMrdV0rMSksdFtzXT0uNSppLGk9LjUvaSx0WzNdPShuW3UqMytvXS1uW28qMyt1XSkqaSx0W29dPShuW28qMytzXStuW3MqMytvXSkqaSx0W3VdPShuW3UqMytzXStuW3MqMyt1XSkqaX1yZXR1cm4gdH19KCksaC5zdHI9ZnVuY3Rpb24oZSl7cmV0dXJuXCJxdWF0KFwiK2VbMF0rXCIsIFwiK2VbMV0rXCIsIFwiK2VbMl0rXCIsIFwiK2VbM10rXCIpXCJ9LHR5cGVvZiBlIT1cInVuZGVmaW5lZFwiJiYoZS5xdWF0PWgpfSh0LmV4cG9ydHMpfSkodGhpcyk7XG4iLCIvKlxuXHRnbFNoYWRlclxuXHRDb3B5cmlnaHQgKGMpIDIwMTMsIE5lcnZvdXMgU3lzdGVtLCBpbmMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG5cdFxuXHRSZWRpc3RyaWJ1dGlvbiBhbmQgdXNlIGluIHNvdXJjZSBhbmQgYmluYXJ5IGZvcm1zLCB3aXRoIG9yIHdpdGhvdXQgbW9kaWZpY2F0aW9uLFxuYXJlIHBlcm1pdHRlZCBwcm92aWRlZCB0aGF0IHRoZSBmb2xsb3dpbmcgY29uZGl0aW9ucyBhcmUgbWV0OlxuXG4gICogUmVkaXN0cmlidXRpb25zIG9mIHNvdXJjZSBjb2RlIG11c3QgcmV0YWluIHRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlLCB0aGlzXG4gICAgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIuXG4gICogUmVkaXN0cmlidXRpb25zIGluIGJpbmFyeSBmb3JtIG11c3QgcmVwcm9kdWNlIHRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlLFxuICAgIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIgaW4gdGhlIGRvY3VtZW50YXRpb24gXG4gICAgYW5kL29yIG90aGVyIG1hdGVyaWFscyBwcm92aWRlZCB3aXRoIHRoZSBkaXN0cmlidXRpb24uXG5cblRISVMgU09GVFdBUkUgSVMgUFJPVklERUQgQlkgVEhFIENPUFlSSUdIVCBIT0xERVJTIEFORCBDT05UUklCVVRPUlMgXCJBUyBJU1wiIEFORFxuQU5ZIEVYUFJFU1MgT1IgSU1QTElFRCBXQVJSQU5USUVTLCBJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgVEhFIElNUExJRURcbldBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZIEFORCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBUkUgXG5ESVNDTEFJTUVELiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQ09QWVJJR0hUIEhPTERFUiBPUiBDT05UUklCVVRPUlMgQkUgTElBQkxFIEZPUlxuQU5ZIERJUkVDVCwgSU5ESVJFQ1QsIElOQ0lERU5UQUwsIFNQRUNJQUwsIEVYRU1QTEFSWSwgT1IgQ09OU0VRVUVOVElBTCBEQU1BR0VTXG4oSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFBST0NVUkVNRU5UIE9GIFNVQlNUSVRVVEUgR09PRFMgT1IgU0VSVklDRVM7XG5MT1NTIE9GIFVTRSwgREFUQSwgT1IgUFJPRklUUzsgT1IgQlVTSU5FU1MgSU5URVJSVVBUSU9OKSBIT1dFVkVSIENBVVNFRCBBTkQgT05cbkFOWSBUSEVPUlkgT0YgTElBQklMSVRZLCBXSEVUSEVSIElOIENPTlRSQUNULCBTVFJJQ1QgTElBQklMSVRZLCBPUiBUT1JUXG4oSU5DTFVESU5HIE5FR0xJR0VOQ0UgT1IgT1RIRVJXSVNFKSBBUklTSU5HIElOIEFOWSBXQVkgT1VUIE9GIFRIRSBVU0UgT0YgVEhJU1xuU09GVFdBUkUsIEVWRU4gSUYgQURWSVNFRCBPRiBUSEUgUE9TU0lCSUxJVFkgT0YgU1VDSCBEQU1BR0UuXG5cblx0dXNlcyBzb21lIGlkZWFzIChhbmQgY29kZSkgZnJvbSBnbC1zaGFkZXIgaHR0cHM6Ly9naXRodWIuY29tL21pa29sYWx5c2Vua28vZ2wtc2hhZGVyXG5cdGhvd2V2ZXIgc29tZSBkaWZmZXJlbmNlcyBpbmNsdWRlIHNhdmluZyB1bmlmb3JtIGxvY2F0aW9ucyBhbmQgcXVlcnlpbmcgZ2wgdG8gZ2V0IHVuaWZvcm1zIGFuZCBhdHRyaWJzIGluc3RlYWQgb2YgcGFyc2luZyBmaWxlcyBhbmQgdXNlcyBub3JtYWwgc3ludGF4IGluc3RlYWQgb2YgZmFrZSBvcGVyYXRvciBvdmVybG9hZGluZyB3aGljaCBpcyBhIGNvbmZ1c2luZyBwYXR0ZXJuIGluIEphdmFzY3JpcHQuXG4qL1xuXG4oZnVuY3Rpb24oX2dsb2JhbCkge1xuICBcInVzZSBzdHJpY3RcIjtcblxuICB2YXIgc2hpbSA9IHt9O1xuICBpZiAodHlwZW9mKGV4cG9ydHMpID09PSAndW5kZWZpbmVkJykge1xuICAgIGlmKHR5cGVvZiBkZWZpbmUgPT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PSAnb2JqZWN0JyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgICBzaGltLmV4cG9ydHMgPSB7fTtcbiAgICAgIGRlZmluZShmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHNoaW0uZXhwb3J0cztcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvL3RoaXMgdGhpbmcgbGl2ZXMgaW4gYSBicm93c2VyLCBkZWZpbmUgaXRzIG5hbWVzcGFjZXMgaW4gZ2xvYmFsXG4gICAgICBzaGltLmV4cG9ydHMgPSB0eXBlb2Yod2luZG93KSAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cgOiBfZ2xvYmFsO1xuICAgIH1cbiAgfVxuICBlbHNlIHtcbiAgICAvL3RoaXMgdGhpbmcgbGl2ZXMgaW4gY29tbW9uanMsIGRlZmluZSBpdHMgbmFtZXNwYWNlcyBpbiBleHBvcnRzXG4gICAgc2hpbS5leHBvcnRzID0gZXhwb3J0cztcbiAgfVxuICAoZnVuY3Rpb24oZXhwb3J0cykge1xuXG5cbiAgdmFyIGdsO1xuICBmdW5jdGlvbiBTaGFkZXIoZ2wsIHByb2cpIHtcbiAgICB0aGlzLmdsID0gZ2w7XG4gICAgdGhpcy5wcm9ncmFtID0gcHJvZztcbiAgICB0aGlzLnVuaWZvcm1zID0ge307XG4gICAgdGhpcy5hdHRyaWJzID0ge307XG4gICAgdGhpcy5pc1JlYWR5ID0gZmFsc2U7XG4gIH1cblxuICBTaGFkZXIucHJvdG90eXBlLmJlZ2luID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5nbC51c2VQcm9ncmFtKHRoaXMucHJvZ3JhbSk7XG4gICAgdGhpcy5lbmFibGVBdHRyaWJzKCk7XG4gIH1cblxuICBTaGFkZXIucHJvdG90eXBlLmVuZCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuZGlzYWJsZUF0dHJpYnMoKTtcbiAgfVxuXG4gIFNoYWRlci5wcm90b3R5cGUuZW5hYmxlQXR0cmlicyA9IGZ1bmN0aW9uKCkge1xuICAgIGZvcih2YXIgYXR0cmliIGluIHRoaXMuYXR0cmlicykge1xuICAgIHRoaXMuYXR0cmlic1thdHRyaWJdLmVuYWJsZSgpO1xuICAgIH1cbiAgfVxuICBTaGFkZXIucHJvdG90eXBlLmRpc2FibGVBdHRyaWJzID0gZnVuY3Rpb24oKSB7XG4gICAgZm9yKHZhciBhdHRyaWIgaW4gdGhpcy5hdHRyaWJzKSB7XG4gICAgdGhpcy5hdHRyaWJzW2F0dHJpYl0uZGlzYWJsZSgpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG1ha2VWZWN0b3JVbmlmb3JtKGdsLCBzaGFkZXIsIGxvY2F0aW9uLCBvYmosIHR5cGUsIGQsIG5hbWUpIHtcbiAgICB2YXIgdW5pZm9ybU9iaiA9IHt9O1xuICAgIHVuaWZvcm1PYmoubG9jYXRpb24gPSBsb2NhdGlvbjtcbiAgICBpZihkID4gMSkge1xuICAgICAgdHlwZSArPSBcInZcIjtcbiAgICB9XG4gICAgdmFyIHNldHRlciA9IG5ldyBGdW5jdGlvbihcImdsXCIsIFwicHJvZ1wiLCBcImxvY1wiLCBcInZcIiwgXCJnbC51bmlmb3JtXCIgKyBkICsgdHlwZSArIFwiKGxvYywgdilcIik7XG4gICAgdW5pZm9ybU9iai5zZXQgPSBzZXR0ZXIuYmluZCh1bmRlZmluZWQsIGdsLCBzaGFkZXIucHJvZ3JhbSxsb2NhdGlvbik7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgbmFtZSwge1xuICAgICAgdmFsdWU6dW5pZm9ybU9iaixcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG1ha2VNYXRyaXhVbmlmb3JtKGdsLCBzaGFkZXIsIGxvY2F0aW9uLCBvYmosIGQsIG5hbWUpIHtcbiAgICB2YXIgdW5pZm9ybU9iaiA9IHt9O1xuICAgIHVuaWZvcm1PYmoubG9jYXRpb24gPSBsb2NhdGlvbjtcbiAgICB2YXIgc2V0dGVyID0gbmV3IEZ1bmN0aW9uKFwiZ2xcIiwgXCJwcm9nXCIsIFwibG9jXCIsXCJ2XCIsIFwiZ2wudW5pZm9ybU1hdHJpeFwiICsgZCArIFwiZnYobG9jLCBmYWxzZSwgdilcIik7XG4gICAgdW5pZm9ybU9iai5zZXQgPSBzZXR0ZXIuYmluZCh1bmRlZmluZWQsIGdsLCBzaGFkZXIucHJvZ3JhbSxsb2NhdGlvbik7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgbmFtZSwge1xuICAgICAgdmFsdWU6dW5pZm9ybU9iaixcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG1ha2VWZWN0b3JBdHRyaWIoZ2wsIHNoYWRlciwgbG9jYXRpb24sIG9iaiwgZCwgbmFtZSkge1xuICAgIHZhciBvdXQgPSB7fTtcbiAgICBvdXQuc2V0ID0gZnVuY3Rpb24gc2V0QXR0cmliKGJ1ZmZlcix0eXBlKSB7XG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsYnVmZmVyKTtcbiAgICBnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKGxvY2F0aW9uLCBkLCB0eXBlfHxnbC5GTE9BVCwgZmFsc2UsIDAsIDApO1xuICAgIH1cbiAgICBvdXQucG9pbnRlciA9IGZ1bmN0aW9uIGF0dHJpYlBvaW50ZXIodHlwZSwgbm9ybWFsaXplZCwgc3RyaWRlLCBvZmZzZXQpIHtcbiAgICAgIGdsLnZlcnRleEF0dHJpYlBvaW50ZXIobG9jYXRpb24sIGQsIHR5cGV8fGdsLkZMT0FULCBub3JtYWxpemVkP3RydWU6ZmFsc2UsIHN0cmlkZXx8MCwgb2Zmc2V0fHwwKTtcbiAgICB9O1xuICAgIG91dC5lbmFibGUgPSBmdW5jdGlvbiBlbmFibGVBdHRyaWIoKSB7XG4gICAgICBnbC5lbmFibGVWZXJ0ZXhBdHRyaWJBcnJheShsb2NhdGlvbik7XG4gICAgfTtcbiAgICBvdXQuZGlzYWJsZSA9IGZ1bmN0aW9uIGRpc2FibGVBdHRyaWIoKSB7XG4gICAgICBnbC5kaXNhYmxlVmVydGV4QXR0cmliQXJyYXkobG9jYXRpb24pO1xuICAgIH07XG4gICAgb3V0LmxvY2F0aW9uID0gbG9jYXRpb247XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgbmFtZSwge1xuICAgIHZhbHVlOiBvdXQsXG4gICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gc2V0dXBVbmlmb3JtKGdsLHNoYWRlciwgdW5pZm9ybSxsb2MpIHtcbiAgICBzd2l0Y2godW5pZm9ybS50eXBlKSB7XG4gICAgICBjYXNlIGdsLklOVDpcbiAgICAgIGNhc2UgZ2wuQk9PTDpcbiAgICAgIGNhc2UgZ2wuU0FNUExFUl8yRDpcbiAgICAgIGNhc2UgZ2wuU0FNUExFUl9DVUJFOlxuICAgICAgICBtYWtlVmVjdG9yVW5pZm9ybShnbCxzaGFkZXIsbG9jLCBzaGFkZXIudW5pZm9ybXMsIFwiaVwiLDEsdW5pZm9ybS5uYW1lKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGdsLklOVF9WRUMyOlxuICAgICAgY2FzZSBnbC5CT09MX1ZFQzI6XG4gICAgICAgIG1ha2VWZWN0b3JVbmlmb3JtKGdsLHNoYWRlcixsb2MsIHNoYWRlci51bmlmb3JtcywgXCJpXCIsMix1bmlmb3JtLm5hbWUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgZ2wuSU5UX1ZFQzM6XG4gICAgICBjYXNlIGdsLkJPT0xfVkVDMzpcbiAgICAgICAgbWFrZVZlY3RvclVuaWZvcm0oZ2wsc2hhZGVyLGxvYywgc2hhZGVyLnVuaWZvcm1zLCBcImlcIiwzLHVuaWZvcm0ubmFtZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBnbC5JTlRfVkVDNDpcbiAgICAgIGNhc2UgZ2wuQk9PTF9WRUM0OlxuICAgICAgICBtYWtlVmVjdG9yVW5pZm9ybShnbCxzaGFkZXIsbG9jLCBzaGFkZXIudW5pZm9ybXMsIFwiaVwiLDQsdW5pZm9ybS5uYW1lKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGdsLkZMT0FUOlxuICAgICAgICBtYWtlVmVjdG9yVW5pZm9ybShnbCxzaGFkZXIsbG9jLCBzaGFkZXIudW5pZm9ybXMsIFwiZlwiLDEsdW5pZm9ybS5uYW1lKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGdsLkZMT0FUX1ZFQzI6XG4gICAgICAgIG1ha2VWZWN0b3JVbmlmb3JtKGdsLHNoYWRlcixsb2MsIHNoYWRlci51bmlmb3JtcywgXCJmXCIsMix1bmlmb3JtLm5hbWUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgZ2wuRkxPQVRfVkVDMzpcbiAgICAgICAgbWFrZVZlY3RvclVuaWZvcm0oZ2wsc2hhZGVyLGxvYywgc2hhZGVyLnVuaWZvcm1zLCBcImZcIiwzLHVuaWZvcm0ubmFtZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBnbC5GTE9BVF9WRUM0OlxuICAgICAgICBtYWtlVmVjdG9yVW5pZm9ybShnbCxzaGFkZXIsbG9jLCBzaGFkZXIudW5pZm9ybXMsIFwiZlwiLDQsdW5pZm9ybS5uYW1lKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGdsLkZMT0FUX01BVDI6XG4gICAgICAgIG1ha2VNYXRyaXhVbmlmb3JtKGdsLHNoYWRlcixsb2MsIHNoYWRlci51bmlmb3JtcywgMix1bmlmb3JtLm5hbWUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgZ2wuRkxPQVRfTUFUMzpcbiAgICAgICAgbWFrZU1hdHJpeFVuaWZvcm0oZ2wsc2hhZGVyLGxvYywgc2hhZGVyLnVuaWZvcm1zLCAzLHVuaWZvcm0ubmFtZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBnbC5GTE9BVF9NQVQ0OlxuICAgICAgICBtYWtlTWF0cml4VW5pZm9ybShnbCxzaGFkZXIsbG9jLCBzaGFkZXIudW5pZm9ybXMsIDQsdW5pZm9ybS5uYW1lKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIHVuaWZvcm0gdHlwZSBpbiBzaGFkZXI6IFwiICtzaGFkZXIpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBzZXR1cEF0dHJpYihnbCxzaGFkZXIsYXR0cmliLGxvY2F0aW9uKSB7XG4gICAgdmFyIGxlbiA9IDE7XG4gICAgc3dpdGNoKGF0dHJpYi50eXBlKSB7XG4gICAgICBjYXNlIGdsLkZMT0FUX1ZFQzI6XG4gICAgICAgIGxlbiA9IDI7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBnbC5GTE9BVF9WRUMzOlxuICAgICAgICBsZW4gPSAzO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgZ2wuRkxPQVRfVkVDNDpcbiAgICAgICAgbGVuID0gNDtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIG1ha2VWZWN0b3JBdHRyaWIoZ2wsIHNoYWRlciwgbG9jYXRpb24sc2hhZGVyLmF0dHJpYnMsIGxlbiwgYXR0cmliLm5hbWUpO1xuICB9XG5cblxuICBmdW5jdGlvbiBsb2FkWE1MRG9jKGZpbGVuYW1lLCBjYWxsYmFjaykge1xuICAgICAgdmFyIHhtbGh0dHA7XG4gICAgICB2YXIgdGV4dDtcbiAgICAgIHhtbGh0dHAgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblxuICAgICAgeG1saHR0cC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICBpZiAoeG1saHR0cC5yZWFkeVN0YXRlID09IDQgJiYgeG1saHR0cC5zdGF0dXMgPT0gMjAwKSBjYWxsYmFjayh4bWxodHRwLnJlc3BvbnNlVGV4dCk7XG4gICAgICB9XG5cbiAgICAgIHhtbGh0dHAub3BlbihcIkdFVFwiLCBmaWxlbmFtZSwgdHJ1ZSk7XG4gICAgICB4bWxodHRwLnNlbmQoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldFNoYWRlcihnbCwgc3JjLCB0eXBlKSB7XG4gICAgICB2YXIgc2hhZGVyO1xuICAgICAgLy9kZWNpZGVzIGlmIGl0J3MgYSBmcmFnbWVudCBvciB2ZXJ0ZXggc2hhZGVyXG5cbiAgICAgIGlmICh0eXBlID09IFwiZnJhZ21lbnRcIikge1xuICAgICAgICAgIHNoYWRlciA9IGdsLmNyZWF0ZVNoYWRlcihnbC5GUkFHTUVOVF9TSEFERVIpO1xuICAgICAgfVxuICAgICAgZWxzZSBpZiAodHlwZSA9PSBcInZlcnRleFwiKSB7XG4gICAgICAgICAgc2hhZGVyID0gZ2wuY3JlYXRlU2hhZGVyKGdsLlZFUlRFWF9TSEFERVIpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgICBnbC5zaGFkZXJTb3VyY2Uoc2hhZGVyLCBzcmMpO1xuICAgICAgZ2wuY29tcGlsZVNoYWRlcihzaGFkZXIpO1xuXG4gICAgICBpZiAoIWdsLmdldFNoYWRlclBhcmFtZXRlcihzaGFkZXIsIGdsLkNPTVBJTEVfU1RBVFVTKSkge1xuICAgICAgICAgIGFsZXJ0KGdsLmdldFNoYWRlckluZm9Mb2coc2hhZGVyKSk7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgICByZXR1cm4gc2hhZGVyO1xuICB9XG5cbiAgZnVuY3Rpb24gc2V0dXBTaGFkZXJQcm9ncmFtKGdsLHNoYWRlclByb2dyYW0sIHZlcnRleFNoYWRlciwgZnJhZ21lbnRTaGFkZXIsY2FsbGJhY2spIHtcbiAgICAgIGdsLmF0dGFjaFNoYWRlcihzaGFkZXJQcm9ncmFtLCB2ZXJ0ZXhTaGFkZXIpO1xuICAgICAgZ2wuYXR0YWNoU2hhZGVyKHNoYWRlclByb2dyYW0sIGZyYWdtZW50U2hhZGVyKTtcbiAgICAgIGdsLmxpbmtQcm9ncmFtKHNoYWRlclByb2dyYW0pO1xuXG4gICAgICBpZiAoIWdsLmdldFByb2dyYW1QYXJhbWV0ZXIoc2hhZGVyUHJvZ3JhbSwgZ2wuTElOS19TVEFUVVMpKSB7XG4gICAgICAgICAgYWxlcnQoXCJDb3VsZCBub3QgaW5pdGlhbGlzZSBzaGFkZXJzXCIpO1xuICAgICAgfVxuICAgICAgY2FsbGJhY2soc2hhZGVyUHJvZ3JhbSk7XG4gIH1cblxuICB2YXIgZ2xTaGFkZXIgPSBleHBvcnRzO1xuICBcbiAgZ2xTaGFkZXIuc2V0R0wgPSBmdW5jdGlvbihfZ2wpIHtcbiAgICBnbCA9IF9nbDtcbiAgfVxuICBcbiAgZ2xTaGFkZXIubWFrZVNoYWRlciA9IGZ1bmN0aW9uKGdsLHByb2dyYW0sc2hhZGVyKSB7XG4gICAgdmFyIHRvdGFsVW5pZm9ybXMgPSBnbC5nZXRQcm9ncmFtUGFyYW1ldGVyKHByb2dyYW0sIGdsLkFDVElWRV9VTklGT1JNUyk7XG4gICAgc2hhZGVyID0gc2hhZGVyIHx8IG5ldyBTaGFkZXIoZ2wscHJvZ3JhbSk7XG4gICAgZm9yKHZhciBpPTA7aTx0b3RhbFVuaWZvcm1zOysraSkge1xuICAgICAgdmFyIHVuaWZvcm0gPSBnbC5nZXRBY3RpdmVVbmlmb3JtKHByb2dyYW0sIGkpO1xuICAgICAgc2V0dXBVbmlmb3JtKGdsLHNoYWRlciwgdW5pZm9ybSxnbC5nZXRVbmlmb3JtTG9jYXRpb24ocHJvZ3JhbSwgdW5pZm9ybS5uYW1lKSk7XG4gICAgfVxuICAgIHZhciB0b3RhbEF0dHJpYnMgPSBnbC5nZXRQcm9ncmFtUGFyYW1ldGVyKHByb2dyYW0sZ2wuQUNUSVZFX0FUVFJJQlVURVMpO1xuICAgIGZvcih2YXIgaT0wO2k8dG90YWxBdHRyaWJzOysraSkge1xuICAgICAgdmFyIGF0dHJpYiA9IGdsLmdldEFjdGl2ZUF0dHJpYihwcm9ncmFtLCBpKTtcbiAgICAgIHNldHVwQXR0cmliKGdsLHNoYWRlcixhdHRyaWIsaSk7XG4gICAgfVxuICAgIHNoYWRlci5pc1JlYWR5ID0gdHJ1ZTtcbiAgICByZXR1cm4gc2hhZGVyO1xuICB9XG5cbiAgZ2xTaGFkZXIubG9hZFNoYWRlciA9IGZ1bmN0aW9uKGdsLCB2ZXJ0ZXhGaWxlLCBmcmFnbWVudEZpbGUpIHtcbiAgICAgIHZhciBzaGFkZXJQcm9ncmFtID0gZ2wuY3JlYXRlUHJvZ3JhbSgpO1xuICAgIHZhciBzaGFkZXIgPSBuZXcgU2hhZGVyKGdsLHNoYWRlclByb2dyYW0pO1xuICAgICAgdmFyIGZyYWdTaGFkZXIsIHZlcnRTaGFkZXI7XG4gICAgICB2YXIgbG9hZGVkID0gMDtcbiAgICAgIHZhciB4bWxodHRwO1xuICAgICAgeG1saHR0cCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgbG9hZFhNTERvYyh2ZXJ0ZXhGaWxlLCBmdW5jdGlvbih0eHQpIHt2ZXJ0U2hhZGVyID0gZ2V0U2hhZGVyKGdsLCB0eHQsIFwidmVydGV4XCIpO2lmKCsrbG9hZGVkID09IDIpIHNldHVwU2hhZGVyUHJvZ3JhbShnbCxzaGFkZXJQcm9ncmFtLCB2ZXJ0U2hhZGVyLGZyYWdTaGFkZXIsZnVuY3Rpb24ocHJvZykge2dsU2hhZGVyLm1ha2VTaGFkZXIoZ2wscHJvZyxzaGFkZXIpO30pfSk7XG4gICAgICBsb2FkWE1MRG9jKGZyYWdtZW50RmlsZSwgZnVuY3Rpb24odHh0KSB7ZnJhZ1NoYWRlciA9IGdldFNoYWRlcihnbCwgdHh0LCBcImZyYWdtZW50XCIpO2lmKCsrbG9hZGVkID09IDIpIHNldHVwU2hhZGVyUHJvZ3JhbShnbCxzaGFkZXJQcm9ncmFtLCB2ZXJ0U2hhZGVyLGZyYWdTaGFkZXIsZnVuY3Rpb24ocHJvZykge2dsU2hhZGVyLm1ha2VTaGFkZXIoZ2wscHJvZyxzaGFkZXIpO30pfSk7XG4gICAgICByZXR1cm4gc2hhZGVyO1xuICB9XG5cbiAgLy9pZih0eXBlb2YoZXhwb3J0cykgIT09ICd1bmRlZmluZWQnKSB7XG4gIC8vICAgIGV4cG9ydHMuZ2xTaGFkZXIgPSBnbFNoYWRlcjtcbiAgLy99XG5cbiAgfSkoc2hpbS5leHBvcnRzKTtcbn0pKHRoaXMpO1xuIl19
