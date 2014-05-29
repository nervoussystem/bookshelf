(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var glMatrix = require("../js/gl-matrix-min.js");
var vec3 = glMatrix.vec3;
var vec2 = glMatrix.vec2;
var nurbs = require("./nurbs.js");
var vboMesh = require("./vboMesh.js");
var woodWidth = 12;
var conLen = 50;
var conOffset = 12;
var conWidth = 12;
var shelfOffset = 12;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyJjOlxcVXNlcnNcXEplc3NlXFxBcHBEYXRhXFxSb2FtaW5nXFxucG1cXG5vZGVfbW9kdWxlc1xcd2F0Y2hpZnlcXG5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwiYzovVXNlcnMvSmVzc2UvRG9jdW1lbnRzL2h0ZG9jcy9ib29rc2hlbGYvY29ubmVjdG9yLmpzIiwiYzovVXNlcnMvSmVzc2UvRG9jdW1lbnRzL2h0ZG9jcy9ib29rc2hlbGYvZ2xVdGlscy5qcyIsImM6L1VzZXJzL0plc3NlL0RvY3VtZW50cy9odGRvY3MvYm9va3NoZWxmL21haW4uanMiLCJjOi9Vc2Vycy9KZXNzZS9Eb2N1bWVudHMvaHRkb2NzL2Jvb2tzaGVsZi9udXJicy5qcyIsImM6L1VzZXJzL0plc3NlL0RvY3VtZW50cy9odGRvY3MvYm9va3NoZWxmL3BvbHkydHJpLmpzIiwiYzovVXNlcnMvSmVzc2UvRG9jdW1lbnRzL2h0ZG9jcy9ib29rc2hlbGYvdmJvTWVzaC5qcyIsImM6L1VzZXJzL0plc3NlL0RvY3VtZW50cy9odGRvY3MvYm9va3NoZWxmL3Zvcm9ub2kuanMiLCJjOi9Vc2Vycy9KZXNzZS9Eb2N1bWVudHMvaHRkb2NzL2pzL2dsLW1hdHJpeC1taW4uanMiLCJjOi9Vc2Vycy9KZXNzZS9Eb2N1bWVudHMvaHRkb2NzL2pzL2dsU2hhZGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMWdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzc3REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMVVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBnbE1hdHJpeCA9IHJlcXVpcmUoXCIuLi9qcy9nbC1tYXRyaXgtbWluLmpzXCIpO1xyXG52YXIgdmVjMyA9IGdsTWF0cml4LnZlYzM7XHJcbnZhciB2ZWMyID0gZ2xNYXRyaXgudmVjMjtcclxudmFyIG51cmJzID0gcmVxdWlyZShcIi4vbnVyYnMuanNcIik7XHJcbnZhciB2Ym9NZXNoID0gcmVxdWlyZShcIi4vdmJvTWVzaC5qc1wiKTtcclxudmFyIHdvb2RXaWR0aCA9IDEyO1xyXG52YXIgY29uTGVuID0gNTA7XHJcbnZhciBjb25PZmZzZXQgPSAxMjtcclxudmFyIGNvbldpZHRoID0gMTI7XHJcbnZhciBzaGVsZk9mZnNldCA9IDEyO1xyXG52YXIgcHJpbnRUb2xlcmFuY2UgPSAwO1xyXG5cclxuZnVuY3Rpb24gaW5pdENvbm5lY3RvcigpIHtcclxuXHJcbn1cclxuXHJcbnZhciBjcmVhdGVDb25uZWN0b3IgPSAoZnVuY3Rpb24oKSB7XHJcbiAgdmFyIGRpcjEgPSB2ZWMzLmNyZWF0ZSgpO1xyXG4gIHZhciBkaXIyID0gdmVjMy5jcmVhdGUoKTtcclxuICB2YXIgZGlyMyA9IHZlYzMuY3JlYXRlKCk7XHJcbiAgdmFyIHB0ID0gdmVjMy5jcmVhdGUoKTtcclxuICB2YXIgcHQyID0gdmVjMy5jcmVhdGUoKTtcclxuICB2YXIgZGlycyA9IFtkaXIxLGRpcjIsZGlyM107XHJcbiAgdmFyIGRpciwgbkRpcjtcclxuICB2YXIgcGVycCA9IHZlYzMuY3JlYXRlKCk7XHJcbiAgdmFyIGJpc2VjdG9yID0gdmVjMy5jcmVhdGUoKTtcclxuICByZXR1cm4gZnVuY3Rpb24gY3JlYXRlQ29ubmVjdG9yKHRyaSx2Ym9PdXQpIHtcclxuICAgIHZhciBjZW50ZXIgPSB0cmkuY2lyY3VtY2VudGVyO1xyXG4gICAgdmFyIHAxID0gdHJpLm5laWdoYm9yc19bMF0uY2lyY3VtY2VudGVyO1xyXG4gICAgdmFyIHAyID0gdHJpLm5laWdoYm9yc19bMV0uY2lyY3VtY2VudGVyO1xyXG4gICAgdmFyIHAzID0gdHJpLm5laWdoYm9yc19bMl0uY2lyY3VtY2VudGVyO1xyXG4gICAgdmVjMy5zdWIoZGlyMSxwMSxjZW50ZXIpO1xyXG4gICAgdmVjMy5zdWIoZGlyMixwMixjZW50ZXIpO1xyXG4gICAgdmVjMy5zdWIoZGlyMyxwMyxjZW50ZXIpO1xyXG4gICAgXHJcbiAgICB2ZWMzLm5vcm1hbGl6ZShkaXIxLGRpcjEpO1xyXG4gICAgdmVjMy5ub3JtYWxpemUoZGlyMixkaXIyKTtcclxuICAgIHZlYzMubm9ybWFsaXplKGRpcjMsZGlyMyk7XHJcblxyXG4gICAgdmFyIGJhc2VJbmRleCA9IHZib091dC5udW1WZXJ0aWNlcztcclxuICAgIHZhciBudW1QdHMgPSAwO1xyXG4gICAgXHJcbiAgICBmb3IodmFyIGk9MDtpPDM7KytpKSB7XHJcbiAgICAgIC8vbWFrZSBwb2ludHNcclxuICAgICAgZGlyID0gZGlyc1tpXTtcclxuICAgICAgbkRpciA9IGRpcnNbKDE8PGkpJjNdO1xyXG4gICAgICB2ZWMyLnNldChwZXJwLGRpclsxXSwtZGlyWzBdKTtcclxuICAgICAgdmVjMy5zY2FsZUFuZEFkZChwdCxjZW50ZXIsIGRpciwgY29uTGVuK3NoZWxmT2Zmc2V0KTtcclxuICAgICAgdmVjMi5zY2FsZUFuZEFkZChwdCxwdCxwZXJwLHdvb2RXaWR0aCowLjUrcHJpbnRUb2xlcmFuY2UpOyAgICAgIFxyXG4gICAgICBhZGRDb25uZWN0b3JQdCh2Ym9PdXQscHQpO1xyXG4gICAgICBudW1QdHMrKztcclxuICAgICAgXHJcbiAgICAgIHZlYzIuc2NhbGVBbmRBZGQocHQscHQsZGlyLC1jb25MZW4pO1xyXG4gICAgICBhZGRDb25uZWN0b3JQdCh2Ym9PdXQscHQpO1xyXG4gICAgICBudW1QdHMrKztcclxuICAgICAgXHJcbiAgICAgIHZlYzIuc2NhbGVBbmRBZGQocHQscHQscGVycCwtKHdvb2RXaWR0aCtwcmludFRvbGVyYW5jZSoyKSk7XHJcbiAgICAgIGFkZENvbm5lY3RvclB0KHZib091dCxwdCk7XHJcbiAgICAgIG51bVB0cysrO1xyXG5cclxuICAgICAgXHJcbiAgICAgIC8vbWFrZSBjdXJ2ZVxyXG4gICAgICB2YXIgY3J2ID0gbnVyYnMuY3JlYXRlQ3J2KG51bGwsIDIpO1xyXG4gICAgICBcclxuICAgICAgdmVjMi5zY2FsZUFuZEFkZChwdCxwdCxkaXIsY29uTGVuKTtcclxuICAgICAgYWRkQ29ubmVjdG9yUHQodmJvT3V0LHB0KTtcclxuICAgICAgbnVtUHRzKys7XHJcbiAgICAgIFxyXG4gICAgICBudXJicy5hZGRQb2ludChjcnYscHQpO1xyXG5cclxuICAgICAgdmVjMi5zY2FsZUFuZEFkZChwdCxwdCxwZXJwLC1jb25PZmZzZXQpO1xyXG4gICAgICAvL2FkZENvbm5lY3RvclB0KHZib091dCxwdCk7XHJcbiAgICAgIC8vbnVtUHRzKys7XHJcblxyXG4gICAgICBudXJicy5hZGRQb2ludChjcnYscHQpO1xyXG4gICAgICBcclxuICAgICAgLy9nZXQgb2Zmc2V0XHJcbiAgICAgIHZlYzMuYWRkKGJpc2VjdG9yLCBkaXIsbkRpcik7XHJcbiAgICAgIHZlYzMubm9ybWFsaXplKGJpc2VjdG9yLGJpc2VjdG9yKTtcclxuICAgICAgdmFyIHNpbkEgPSBNYXRoLmFicyhiaXNlY3RvclswXSpkaXJbMV0tYmlzZWN0b3JbMV0qZGlyWzBdKTtcclxuICAgICAgdmVjMy5zY2FsZUFuZEFkZChwdCxjZW50ZXIsYmlzZWN0b3IsKHdvb2RXaWR0aCowLjUrY29uT2Zmc2V0KS9zaW5BKTtcclxuXHJcbiAgICAgIG51cmJzLmFkZFBvaW50KGNydixwdCk7XHJcbiAgICAgIFxyXG4gICAgICAvL2FkZENvbm5lY3RvclB0KHZib091dCxwdCk7XHJcbiAgICAgIC8vbnVtUHRzKys7XHJcbiAgICAgIFxyXG4gICAgICB2ZWMyLnNldChwZXJwLG5EaXJbMV0sLW5EaXJbMF0pO1xyXG4gICAgICB2ZWMzLnNjYWxlQW5kQWRkKHB0LGNlbnRlciwgbkRpciwgY29uTGVuK3NoZWxmT2Zmc2V0KTtcclxuICAgICAgdmVjMi5zY2FsZUFuZEFkZChwdCxwdCxwZXJwLHdvb2RXaWR0aCowLjUrcHJpbnRUb2xlcmFuY2UrY29uT2Zmc2V0KTsgICAgICBcclxuICAgICAgXHJcbiAgICAgIG51cmJzLmFkZFBvaW50KGNydixwdCk7XHJcbiAgICAgIHZlYzIuc2NhbGVBbmRBZGQocHQscHQscGVycCwtY29uT2Zmc2V0KTsgICAgICBcclxuICAgICAgbnVyYnMuYWRkUG9pbnQoY3J2LHB0KTtcclxuICAgICAgXHJcbiAgICAgIHZhciBkb21haW4gPSBudXJicy5kb21haW4oY3J2KTtcclxuICAgICAgZm9yKHZhciBqPTE7ajwyMDsrK2opIHtcclxuICAgICAgICB2YXIgdSA9IGovMjAuMCooZG9tYWluWzFdLWRvbWFpblswXSkrZG9tYWluWzBdO1xyXG4gICAgICAgIG51cmJzLmV2YWx1YXRlQ3J2KGNydix1LHB0KTtcclxuICAgICAgICBhZGRDb25uZWN0b3JQdCh2Ym9PdXQscHQpO1xyXG4gICAgICAgIG51bVB0cysrO1xyXG4gICAgICAgIFxyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvL3N0aXRjaCBzaWRlc1xyXG4gICAgZm9yKHZhciBpPTA7aTxudW1QdHM7KytpKSB7XHJcbiAgICAgIHZhciBpTmV4dCA9IChpKzEpJW51bVB0cztcclxuICAgICAgdmJvTWVzaC5hZGRUcmlhbmdsZSh2Ym9PdXQsYmFzZUluZGV4K2kqMixiYXNlSW5kZXgraU5leHQqMisxLGJhc2VJbmRleCtpKjIrMSk7XHJcbiAgICAgIHZib01lc2guYWRkVHJpYW5nbGUodmJvT3V0LGJhc2VJbmRleCtpKjIsYmFzZUluZGV4K2lOZXh0KjIsYmFzZUluZGV4K2lOZXh0KjIrMSk7XHJcbiAgICB9ICAgIFxyXG4gIH1cclxufSkoKTtcclxuXHJcbmZ1bmN0aW9uIGFkZENvbm5lY3RvclB0KHZib091dCxwdCkge1xyXG4gIHZib01lc2guYWRkVmVydGV4KHZib091dCxwdCk7XHJcbiAgcHRbMl0gPSBjb25XaWR0aDtcclxuICB2Ym9NZXNoLmFkZFZlcnRleCh2Ym9PdXQscHQpO1xyXG4gIHB0WzJdID0gMDtcclxufVxyXG5cclxuZXhwb3J0cy5jcmVhdGVDb25uZWN0b3IgPSBjcmVhdGVDb25uZWN0b3I7XHJcbmV4cG9ydHMuaW5pdENvbm5lY3RvciA9IGluaXRDb25uZWN0b3I7XHJcbiIsInZhciBnbDtcbnZhciBleHQgPSBudWxsO1xuZnVuY3Rpb24gaW5pdEdMKGNhbnZhcywgZHJhd0J1ZmZlcikge1xuICBkcmF3QnVmZmVyID0gZHJhd0J1ZmZlciA/IGRyYXdCdWZmZXIgOiBmYWxzZTtcbiAgICB0cnkge1xuICAgICAgICBnbCA9IGNhbnZhcy5nZXRDb250ZXh0KFwid2ViZ2xcIix7cHJlc2VydmVEcmF3aW5nQnVmZmVyOiBkcmF3QnVmZmVyfSk7XG4gICAgICAgIGdsLnZpZXdwb3J0V2lkdGggPSBjYW52YXMud2lkdGg7XG4gICAgICAgIGdsLnZpZXdwb3J0SGVpZ2h0ID0gY2FudmFzLmhlaWdodDtcbiAgICAgICAgZXh0ID0gZ2wuZ2V0RXh0ZW5zaW9uKFwiT0VTX2VsZW1lbnRfaW5kZXhfdWludFwiKTtcbiAgICAgICAgcmV0dXJuIGdsO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICB9XG4gICAgaWYgKCFnbCkge1xuICAgICAgICAvL2FsZXJ0KFwiQ291bGQgbm90IGluaXRpYWxpc2UgV2ViR0wsIHNvcnJ5IDotKFwiKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn1cblxuLypcbnBhc3MgY3ViZSBtYXAgb2JqZWN0XG5jdWJlbWFwIGhhcyBhbiBhcnJheSBvZiBzaXggY3ViZUltYWdlc1xuKi9cblxuZnVuY3Rpb24gaW5pdEN1YmVUZXh0dXJlKGN1YmVNYXBPYmopIHtcbiAgICBjdWJlTWFwT2JqLnRleHR1cmUgPSBnbC5jcmVhdGVUZXh0dXJlKCk7XG4gICAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV9DVUJFX01BUCwgY3ViZU1hcE9iai50ZXh0dXJlKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfQ1VCRV9NQVAsIGdsLlRFWFRVUkVfTUlOX0ZJTFRFUiwgZ2wuTkVBUkVTVCk7XG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFX0NVQkVfTUFQLCBnbC5URVhUVVJFX01BR19GSUxURVIsIGdsLk5FQVJFU1QpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV9DVUJFX01BUCwgZ2wuVEVYVFVSRV9XUkFQX1QsIGdsLkNMQU1QX1RPX0VER0UpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV9DVUJFX01BUCwgZ2wuVEVYVFVSRV9XUkFQX1MsIGdsLkNMQU1QX1RPX0VER0UpO1xuXG4gICAgZ2wudGV4SW1hZ2UyRChnbC5URVhUVVJFX0NVQkVfTUFQX1BPU0lUSVZFX1gsIDAsIGdsLlJHQiwgZ2wuUkdCLCBnbC5VTlNJR05FRF9CWVRFLCBjdWJlTWFwT2JqLmN1YmVJbWFnZXNbMF0pO1xuICAgIGdsLnRleEltYWdlMkQoZ2wuVEVYVFVSRV9DVUJFX01BUF9ORUdBVElWRV9YLCAwLCBnbC5SR0IsIGdsLlJHQiwgZ2wuVU5TSUdORURfQllURSwgY3ViZU1hcE9iai5jdWJlSW1hZ2VzWzFdKTtcbiAgICBnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfQ1VCRV9NQVBfUE9TSVRJVkVfWSwgMCwgZ2wuUkdCLCBnbC5SR0IsIGdsLlVOU0lHTkVEX0JZVEUsIGN1YmVNYXBPYmouY3ViZUltYWdlc1syXSk7XG4gICAgZ2wudGV4SW1hZ2UyRChnbC5URVhUVVJFX0NVQkVfTUFQX05FR0FUSVZFX1ksIDAsIGdsLlJHQiwgZ2wuUkdCLCBnbC5VTlNJR05FRF9CWVRFLCBjdWJlTWFwT2JqLmN1YmVJbWFnZXNbM10pO1xuICAgIGdsLnRleEltYWdlMkQoZ2wuVEVYVFVSRV9DVUJFX01BUF9QT1NJVElWRV9aLCAwLCBnbC5SR0IsIGdsLlJHQiwgZ2wuVU5TSUdORURfQllURSwgY3ViZU1hcE9iai5jdWJlSW1hZ2VzWzRdKTtcbiAgICBnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfQ1VCRV9NQVBfTkVHQVRJVkVfWiwgMCwgZ2wuUkdCLCBnbC5SR0IsIGdsLlVOU0lHTkVEX0JZVEUsIGN1YmVNYXBPYmouY3ViZUltYWdlc1s1XSk7XG59XG5cbmV4cG9ydHMuaW5pdCA9IGluaXRHTDtcbmV4cG9ydHMuaW5pdEN1YmVUZXh0dXJlID0gaW5pdEN1YmVUZXh0dXJlOyIsIlwidXNlIHN0cmljdFwiXHJcblxyXG52YXIgZ2xTaGFkZXIgPSByZXF1aXJlKCcuLi9qcy9nbFNoYWRlci5qcycpO1xyXG52YXIgZ2xNYXRyaXggPSByZXF1aXJlKCcuLi9qcy9nbC1tYXRyaXgtbWluLmpzJyk7XHJcbnZhciBwb2x5MnRyaSA9IHJlcXVpcmUoJy4vcG9seTJ0cmkuanMnKTtcclxudmFyIGdsVXRpbHMgPSByZXF1aXJlKCcuL2dsVXRpbHMuanMnKTtcclxudmFyIHZvcm9ub2kgPSByZXF1aXJlKCcuL3Zvcm9ub2kuanMnKTtcclxudmFyIHZib01lc2ggPSByZXF1aXJlKCcuL3Zib01lc2guanMnKTtcclxudmFyIGNvbm5lY3RvciA9IHJlcXVpcmUoJy4vY29ubmVjdG9yLmpzJyk7XHJcbnZhciB2ZWMzID0gZ2xNYXRyaXgudmVjMztcclxudmFyIG1hdDQgPSBnbE1hdHJpeC5tYXQ0O1xyXG52YXIgbWF0MyA9IGdsTWF0cml4Lm1hdDQ7XHJcblxyXG52YXIgY2FudmFzO1xyXG52YXIgZ2w7XHJcbnZhciBjb2xvclNoYWRlcjtcclxudmFyIHZvcm9ub2lFZGdlcztcclxudmFyIG12TWF0cml4ID0gbWF0NC5jcmVhdGUoKTtcclxudmFyIHBNYXRyaXggPSBtYXQ0LmNyZWF0ZSgpO1xyXG52YXIgbk1hdHJpeCA9IG1hdDMuY3JlYXRlKCk7XHJcbnZhciBjb25uZWN0b3JWYm87XHJcblxyXG5mdW5jdGlvbiBpbml0KCkge1xyXG4vL3N0dXBpZFxyXG5cdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoIFwia2V5ZG93blwiLGtleVByZXNzLGZhbHNlKTtcclxuXHJcbiAgY2FudmFzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJnbFwiKTtcclxuICBnbCA9IGdsVXRpbHMuaW5pdChjYW52YXMpO1xyXG4gIGNvbG9yU2hhZGVyID0gZ2xTaGFkZXIubG9hZFNoYWRlcihnbCxcIi4uL3NoYWRlcnMvc2ltcGxlQ29sb3IudmVydFwiLFwiLi4vc2hhZGVycy9zaW1wbGVDb2xvci5mcmFnXCIpO1xyXG4gIHZib01lc2guc2V0R0woZ2wpO1xyXG4gIGluaXRWb3Jvbm9pKCk7XHJcbiAgXHJcbiAgdm9yb25vaUVkZ2VzID0gdmJvTWVzaC5jcmVhdGUoKTtcclxuICBjb25uZWN0b3JWYm8gPSB2Ym9NZXNoLmNyZWF0ZTMyKCk7XHJcbiAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHN0ZXApO1xyXG59XHJcblxyXG5mdW5jdGlvbiBzdGVwKCkge1xyXG4gIHJlcXVlc3RBbmltYXRpb25GcmFtZShzdGVwKTtcclxuICB2Ym9NZXNoLmNsZWFyKGNvbm5lY3RvclZibyk7XHJcbiAgZ2V0Q29ubmVjdG9ycygpO1xyXG4gIGRyYXcoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gZHJhdygpIHtcclxuICBnbC5jbGVhcihnbC5DT0xPUl9CVUZGRVJfQklUIHwgZ2wuREVQVEhfQlVGRkVSX0JJVCk7XHJcbiAgaWYoIWNvbG9yU2hhZGVyLmlzUmVhZHkpIHJldHVybjtcclxuICBcclxuICBjb2xvclNoYWRlci5iZWdpbigpO1xyXG4gIG1hdDQuaWRlbnRpdHkobXZNYXRyaXgpO1xyXG4gIG1hdDQub3J0aG8ocE1hdHJpeCwtMTAwLDEwMDAsMTAwMCwtMTAwLC0xMCwxMDApO1xyXG4gIFxyXG4gIC8vc2V0IGNvbG9yXHJcbiAgY29sb3JTaGFkZXIudW5pZm9ybXMubWF0Q29sb3Iuc2V0KFswLDAsMCwxXSk7XHJcbiAgLy9zZXQgbWF0cmljZXNcclxuICBjb2xvclNoYWRlci51bmlmb3Jtcy5tdk1hdHJpeC5zZXQobXZNYXRyaXgpO1xyXG4gIGNvbG9yU2hhZGVyLnVuaWZvcm1zLnBNYXRyaXguc2V0KHBNYXRyaXgpO1xyXG4gIFxyXG4gIC8vbWFrZSB2b3Jvbm9pIGVkZ2VzIHZib1xyXG4gIHZvcm9ub2lUb0VkZ2VWQk8oKTtcclxuICBcclxuICAvL2RyYXcgZWRnZXMgdmJvXHJcbiAgY29sb3JTaGFkZXIuYXR0cmlicy52ZXJ0ZXhQb3NpdGlvbi5zZXQodm9yb25vaUVkZ2VzLnZlcnRleEJ1ZmZlcik7XHJcbiAgZ2wuZHJhd0FycmF5cyhnbC5MSU5FUywgMCx2b3Jvbm9pRWRnZXMubnVtVmVydGljZXMpO1xyXG5cclxuICAvL2RyYXcgY29ubmVjdG9yc1xyXG4gIGNvbG9yU2hhZGVyLmF0dHJpYnMudmVydGV4UG9zaXRpb24uc2V0KGNvbm5lY3RvclZiby52ZXJ0ZXhCdWZmZXIpO1xyXG4gIGdsLmJpbmRCdWZmZXIoZ2wuRUxFTUVOVF9BUlJBWV9CVUZGRVIsY29ubmVjdG9yVmJvLmluZGV4QnVmZmVyKTtcclxuICBnbC5kcmF3RWxlbWVudHMoZ2wuVFJJQU5HTEVTLGNvbm5lY3RvclZiby5udW1JbmRpY2VzLGdsLlVOU0lHTkVEX0lOVCwwKTtcclxuICBcclxuICBjb2xvclNoYWRlci5lbmQoKTtcclxufVxyXG5cclxuLy9wdXQgdm9yb25vaSBlZGdlcyBpbnRvIGEgdmJvXHJcbmZ1bmN0aW9uIHZvcm9ub2lUb0VkZ2VWQk8oKSB7XHJcbiAgdmJvTWVzaC5jbGVhcih2b3Jvbm9pRWRnZXMpO1xyXG4gIGZvcih2YXIgaT0wO2k8dm9yb25vaS50cmlhbmdsZXMubGVuZ3RoOysraSkge1xyXG4gICAgdmFyIHRyaSA9IHZvcm9ub2kudHJpYW5nbGVzW2ldO1xyXG4gICAgaWYodHJpLmludGVyaW9yXykge1xyXG4gICAgICBpZih0cmkubmVpZ2hib3JzX1swXSAmJiB0cmkubmVpZ2hib3JzX1swXS5pbnRlcmlvcl8pIHtcclxuICAgICAgICB2Ym9NZXNoLmFkZFZlcnRleCh2b3Jvbm9pRWRnZXMsdHJpLmNpcmN1bWNlbnRlcik7XHJcbiAgICAgICAgdmJvTWVzaC5hZGRWZXJ0ZXgodm9yb25vaUVkZ2VzLHRyaS5uZWlnaGJvcnNfWzBdLmNpcmN1bWNlbnRlcik7XHJcbiAgICAgIH1cclxuICAgICAgaWYodHJpLm5laWdoYm9yc19bMV0gJiYgdHJpLm5laWdoYm9yc19bMV0uaW50ZXJpb3JfKSB7XHJcbiAgICAgICAgdmJvTWVzaC5hZGRWZXJ0ZXgodm9yb25vaUVkZ2VzLHRyaS5jaXJjdW1jZW50ZXIpO1xyXG4gICAgICAgIHZib01lc2guYWRkVmVydGV4KHZvcm9ub2lFZGdlcyx0cmkubmVpZ2hib3JzX1sxXS5jaXJjdW1jZW50ZXIpO1xyXG4gICAgICB9XHJcbiAgICAgIGlmKHRyaS5uZWlnaGJvcnNfWzJdICYmIHRyaS5uZWlnaGJvcnNfWzJdLmludGVyaW9yXykge1xyXG4gICAgICAgIHZib01lc2guYWRkVmVydGV4KHZvcm9ub2lFZGdlcyx0cmkuY2lyY3VtY2VudGVyKTtcclxuICAgICAgICB2Ym9NZXNoLmFkZFZlcnRleCh2b3Jvbm9pRWRnZXMsdHJpLm5laWdoYm9yc19bMl0uY2lyY3VtY2VudGVyKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuICB2Ym9NZXNoLmJ1ZmZlcih2b3Jvbm9pRWRnZXMpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRDb25uZWN0b3JzKCkge1xyXG4gIGZvcih2YXIgaT0wO2k8dm9yb25vaS50cmlhbmdsZXMubGVuZ3RoOysraSkge1xyXG4gICAgdmFyIHRyaSA9IHZvcm9ub2kudHJpYW5nbGVzW2ldO1xyXG4gICAgaWYodHJpLmludGVyaW9yXykge1xyXG4gICAgICBpZih0cmkubmVpZ2hib3JzX1swXSAmJiB0cmkubmVpZ2hib3JzX1swXS5pbnRlcmlvcl8gJiZcclxuICAgICAgICB0cmkubmVpZ2hib3JzX1sxXSAmJiB0cmkubmVpZ2hib3JzX1sxXS5pbnRlcmlvcl8gJiZcclxuICAgICAgICB0cmkubmVpZ2hib3JzX1syXSAmJiB0cmkubmVpZ2hib3JzX1syXS5pbnRlcmlvcl8pIHtcclxuICAgICAgICBjb25uZWN0b3IuY3JlYXRlQ29ubmVjdG9yKHRyaSxjb25uZWN0b3JWYm8pO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG4gIHZib01lc2guYnVmZmVyKGNvbm5lY3RvclZibyk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGluaXRWb3Jvbm9pKCkge1xyXG4gIHZvcm9ub2kuaW5pdCgpO1xyXG4gIHZvcm9ub2kucmVzZXQoKTtcclxuICB2b3Jvbm9pLnZvcm9ub2koKTtcclxufVxyXG5cclxuZnVuY3Rpb24gZG93bmxvYWRWYm9Bc1NUTCh2Ym8pIHtcclxuICB2YXIgdHJpQ291bnQgPSB2Ym8ubnVtSW5kaWNlcy8zO1xyXG4gIHZhciBidWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoODArNCs1MCp0cmlDb3VudCk7XHJcbiAgdmFyIGRhdGFWaWV3ID0gbmV3IERhdGFWaWV3KGJ1ZmZlcik7XHJcbiAgZGF0YVZpZXcub2Zmc2V0ID0gODA7XHJcbiAgc2V0RFZVaW50MzIoZGF0YVZpZXcsIHRyaUNvdW50KTtcclxuICBcclxuICBzYXZlVkJPQmluYXJ5KHZibyxkYXRhVmlldyk7XHJcblxyXG4gIHZhciBhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xyXG4gIHZhciBibG9iID0gbmV3IEJsb2IoW2J1ZmZlcl0sIHsndHlwZSc6J2FwcGxpY2F0aW9uXFwvb2N0ZXQtc3RyZWFtJ30pO1xyXG4gIGEuaHJlZiA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IpO1xyXG4gIGEuZG93bmxvYWQgPSBcInZib1wiK25ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zdWJzdHJpbmcoMCwxNikrXCIuc3RsXCI7XHJcbiAgYS5jbGljaygpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBzYXZlVkJPQmluYXJ5KHZibywgZGF0YVZpZXcpIHtcclxuICBmb3IodmFyIGk9MDtpPHZiby5udW1JbmRpY2VzOykge1xyXG4gICAgc2V0RFZGbG9hdChkYXRhVmlldywwLjApO1xyXG4gICAgc2V0RFZGbG9hdChkYXRhVmlldywwLjApO1xyXG4gICAgc2V0RFZGbG9hdChkYXRhVmlldywwLjApO1xyXG4gICAgdmFyIGkxID0gdmJvLmluZGV4RGF0YVtpKytdKjM7XHJcbiAgICB2YXIgaTIgPSB2Ym8uaW5kZXhEYXRhW2krK10qMztcclxuICAgIHZhciBpMyA9IHZiby5pbmRleERhdGFbaSsrXSozO1xyXG5cclxuICAgIHNldERWRmxvYXQoZGF0YVZpZXcsdmJvLnZlcnRleERhdGFbaTFdKTtcclxuICAgIHNldERWRmxvYXQoZGF0YVZpZXcsdmJvLnZlcnRleERhdGFbaTErMV0pO1xyXG4gICAgc2V0RFZGbG9hdChkYXRhVmlldyx2Ym8udmVydGV4RGF0YVtpMSsyXSk7XHJcblxyXG4gICAgc2V0RFZGbG9hdChkYXRhVmlldyx2Ym8udmVydGV4RGF0YVtpMl0pO1xyXG4gICAgc2V0RFZGbG9hdChkYXRhVmlldyx2Ym8udmVydGV4RGF0YVtpMisxXSk7XHJcbiAgICBzZXREVkZsb2F0KGRhdGFWaWV3LHZiby52ZXJ0ZXhEYXRhW2kyKzJdKTtcclxuXHJcbiAgICBzZXREVkZsb2F0KGRhdGFWaWV3LHZiby52ZXJ0ZXhEYXRhW2kzXSk7XHJcbiAgICBzZXREVkZsb2F0KGRhdGFWaWV3LHZiby52ZXJ0ZXhEYXRhW2kzKzFdKTtcclxuICAgIHNldERWRmxvYXQoZGF0YVZpZXcsdmJvLnZlcnRleERhdGFbaTMrMl0pO1xyXG4gICAgXHJcbiAgICBzZXREVlVpbnQxNihkYXRhVmlldywwKTtcclxuICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNldERWRmxvYXQoZHYsIHZhbCkge1xyXG4gIGR2LnNldEZsb2F0MzIoZHYub2Zmc2V0LHZhbCx0cnVlKTtcclxuICBkdi5vZmZzZXQgKz0gNDtcclxufVxyXG5cclxuZnVuY3Rpb24gc2V0RFZVaW50MTYoZHYsIHZhbCkge1xyXG4gIGR2LnNldFVpbnQxNihkdi5vZmZzZXQsdmFsLHRydWUpO1xyXG4gIGR2Lm9mZnNldCArPSAyO1xyXG59XHJcblxyXG5mdW5jdGlvbiBzZXREVlVpbnQzMihkdiwgdmFsKSB7XHJcbiAgZHYuc2V0VWludDMyKGR2Lm9mZnNldCx2YWwsdHJ1ZSk7XHJcbiAgZHYub2Zmc2V0ICs9IDQ7XHJcbn1cclxuXHJcbmluaXQoKTtcclxuXHJcbmZ1bmN0aW9uIGtleVByZXNzKGV2ZW50KSB7XHJcbiAgc3dpdGNoKGV2ZW50LndoaWNoKSB7XHJcbiAgICBjYXNlIFwiRFwiLmNoYXJDb2RlQXQoMCk6XHJcbiAgICAgIGRvd25sb2FkVmJvQXNTVEwoY29ubmVjdG9yVmJvKTtcclxuICAgICAgYnJlYWs7XHJcbiAgfVxyXG59XHJcbiIsInZhciBnbE1hdHJpeCA9IHJlcXVpcmUoXCIuLi9qcy9nbC1tYXRyaXgtbWluLmpzXCIpO1xudmFyIHZlYzMgPSBnbE1hdHJpeC52ZWMzO1xudmFyIHZlYzQgPSBnbE1hdHJpeC52ZWM0O1xuLy9WRUM0IC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vL2NoZWNrIGZvciAwXG52ZWM0LnByb2plY3REb3duPWZ1bmN0aW9uKGEsYil7dmFyIGQ9MS4wL2FbM107aWYoIWIpIHtiPXZlYzMuY3JlYXRlKCk7fSBiWzBdPWFbMF0qZDtiWzFdPWFbMV0qZDtiWzJdPWFbMl0qZDtyZXR1cm4gYjt9O1xuLy9vcHRpbWl6ZSB0byBhdm9pZCBtdWx0aXBsaWNhdGlvbnMgd2l0aCBubyBiXG52ZWM0LmZyb21WZWMzPWZ1bmN0aW9uKGEsYil7aWYoIWIpIGI9MTt2YXIgYz1uZXcgRmxvYXQzMkFycmF5KDQpO2NbMF09YVswXSpiO2NbMV09YVsxXSpiO2NbMl09YVsyXSpiO2NbM109YjtyZXR1cm4gY307XG5cbi8vTlVSQlMgQ1VSVkVcbi8vYSBudXJicyBvYmplY3QgaGFzIGNvbnRyb2wgcHRzLGtub3RzLCBkZWdyZWVcbnZhciBudXJicyA9IGV4cG9ydHM7XG4vL3VzZWQgbG9jYWxseVxubnVyYnMuTUFYX0RFR1JFRSA9IDEwO1xubnVyYnMuYmFzaXNGdW5jcyA9IG5ldyBGbG9hdDMyQXJyYXkoMTApO1xubnVyYnMuYmFzaXNGdW5jc1UgPSBuZXcgRmxvYXQzMkFycmF5KDEwKTtcbm51cmJzLmJhc2lzRnVuY3NWID0gbmV3IEZsb2F0MzJBcnJheSgxMCk7XG5udXJicy5kZXJpdmVCYXNpc0Z1bmNzID0gbmV3IEFycmF5KDExKTtcbmZvcih2YXIgaT0wO2k8bnVyYnMuTUFYX0RFR1JFRSsxOysraSkgbnVyYnMuZGVyaXZlQmFzaXNGdW5jc1tpXSA9IG5ldyBGbG9hdDMyQXJyYXkobnVyYnMuTUFYX0RFR1JFRSsxKTtcbm51cmJzLm5kdSA9IG5ldyBBcnJheShudXJicy5NQVhfREVHUkVFKzEpO1xuZm9yKHZhciBpPTA7aTxudXJicy5NQVhfREVHUkVFKzE7KytpKSBudXJicy5uZHVbaV0gPSBuZXcgRmxvYXQzMkFycmF5KG51cmJzLk1BWF9ERUdSRUUrMSk7XG5cbm51cmJzLmJhbmcgPSBmdW5jdGlvbihhKSB7XG5cdHZhciB2YWw9MTtcblx0Zm9yKDthPjE7YS0tKSB7XG5cdFx0dmFsKj1hO1xuXHR9XG5cdHJldHVybiB2YWw7XG59O1xuXG4vL0kgYW0gYW4gaWRpb3Rcbm51cmJzLkIgPSBbbmV3IEZsb2F0MzJBcnJheSgxMCksbmV3IEZsb2F0MzJBcnJheSgxMCksbmV3IEZsb2F0MzJBcnJheSgxMCksbmV3IEZsb2F0MzJBcnJheSgxMCksbmV3IEZsb2F0MzJBcnJheSgxMCksbmV3IEZsb2F0MzJBcnJheSgxMCksbmV3IEZsb2F0MzJBcnJheSgxMCksbmV3IEZsb2F0MzJBcnJheSgxMCksbmV3IEZsb2F0MzJBcnJheSgxMCksbmV3IEZsb2F0MzJBcnJheSgxMCldO1xuZm9yKHZhciBpPTA7aTwxMDsrK2kpIHtcblx0Zm9yKHZhciBqPTA7ajwxMDsrK2opIHtcblx0XHRudXJicy5CW2ldW2pdID0gbnVyYnMuYmFuZyhpKS8obnVyYnMuYmFuZyhqKSpudXJicy5iYW5nKGktaikpO1xuXHR9XG59XG5cbi8vbWFrZSBhIG51cmJzIGNydiBvYmplY3Rcbi8vaW5pdGlhbGl6ZSB3aXRoIHBvaW50cz8/XG5udXJicy5jcmVhdGVDcnYgPSBmdW5jdGlvbihjcnYsZGVncmVlKSB7XG5cdGNydiA9IGNydiB8fCB7fTtcblx0Y3J2LmRlZ3JlZSA9IGRlZ3JlZSB8fCAzO1xuXHRjcnYua25vdHMgPSBuZXcgQXJyYXkoY3J2LmRlZ3JlZSsxKTtcblx0Zm9yKHZhciBpPTA7aTw9Y3J2LmRlZ3JlZTtpKyspIGNydi5rbm90c1tpXSA9IDA7XG5cdGNydi5jb250cm9sUHRzID0gW107XG5cdHJldHVybiBjcnY7XG59XG5cbm51cmJzLmNyZWF0ZUNsb3NlZENydiA9IGZ1bmN0aW9uKHB0cywgZGVncmVlKSB7XG5cdHZhciBjcnYgPSB7fTtcblx0Y3J2LmRlZ3JlZSA9IGRlZ3JlZSB8fCAzO1xuXHRjcnYua25vdHMgPSBuZXcgQXJyYXkocHRzLmxlbmd0aCtjcnYuZGVncmVlK2Nydi5kZWdyZWUrMSk7XG5cdGZvcih2YXIgaT0wO2k8Y3J2Lmtub3RzLmxlbmd0aDtpKyspIGNydi5rbm90c1tpXSA9IGktY3J2LmRlZ3JlZTtcblx0Y3J2LmNvbnRyb2xQdHMgPSBbXTtcblx0Zm9yKHZhciBpPTA7aTxwdHMubGVuZ3RoOysraSkge1xuXHRcdGNydi5jb250cm9sUHRzLnB1c2godmVjNC5jcmVhdGUocHRzW2ldKSk7XG5cdH1cblx0Zm9yKHZhciBpPTA7aTw9ZGVncmVlOysraSkge1xuXHRcdGNydi5jb250cm9sUHRzLnB1c2godmVjNC5jcmVhdGUocHRzW2ldKSk7XG5cdH1cblx0cmV0dXJuIGNydjtcbn1cblxubnVyYnMuY29weUNydiA9IGZ1bmN0aW9uKGNydikge1xuXHR2YXIgbmV3Q3J2ID0ge307XG5cdG5ld0Nydi5kZWdyZWUgPSBjcnYuZGVncmVlO1xuXHRuZXdDcnYua25vdHMgPSBjcnYua25vdHMuc2xpY2UoMCk7XG5cdG5ld0Nydi5jb250cm9sUHRzID0gY3J2LmNvbnRyb2xQdHMuc2xpY2UoMCk7XG5cdHJldHVybiBuZXdDcnY7XG59XG5cbi8vYmluYXJ5IHNlYXJjaFxubnVyYnMuZmluZEtub3QgPSBmdW5jdGlvbihrbm90cyx1LGRlZ3JlZSkge1xuXHRpZiAodT09a25vdHNba25vdHMubGVuZ3RoLWRlZ3JlZV0pIHJldHVybiBrbm90cy5sZW5ndGgtZGVncmVlLTI7XG5cdGlmKHUgPD0ga25vdHNbZGVncmVlXSkgcmV0dXJuIGRlZ3JlZTtcblx0dmFyIGxvdyA9IGRlZ3JlZTtcblx0dmFyIGhpZ2ggPSBrbm90cy5sZW5ndGgtZGVncmVlO1xuXHR2YXIgbWlkID0gTWF0aC5mbG9vcigoaGlnaCtsb3cpLzIpO1xuXHR3aGlsZShrbm90c1ttaWRdPnUgfHwgdSA+PSBrbm90c1ttaWQrMV0pIHtcblx0ICBpZih1PGtub3RzW21pZF0pIHtcblx0XHRoaWdoID0gbWlkO1xuXHQgIH0gZWxzZSB7XG5cdFx0bG93ID0gbWlkO1xuXHQgIH1cblx0ICBtaWQgPSBNYXRoLmZsb29yKChoaWdoK2xvdykvMik7XG5cdH1cblx0cmV0dXJuIG1pZDtcbn1cblxuIFxuLy9pbXBsZW1lbnQgZGVncmVlIGVsZXZhdGlvbiBhbmQgcmVkdWN0aW9uLCBuZWVkZWQgdG8gbG9mdCBjdXJ2ZSBvZiBkaWZmZXJlbnQgZGVncmVlcyBhcyB3ZWxsXG5udXJicy5zZXREZWdyZWUgPSBmdW5jdGlvbihkZWcpIHtcbn1cblx0XG5udXJicy5ldmFsdWF0ZUNydiA9IGZ1bmN0aW9uKGNydix1LHB0KSB7XG5cdHZhciBjdXJyS25vdCA9IG51cmJzLmZpbmRLbm90KGNydi5rbm90cyx1LGNydi5kZWdyZWUpO1xuXHRcblx0bnVyYnMuYmFzaXNGdW5jdGlvbnMoY3J2Lmtub3RzLGNydi5kZWdyZWUsY3Vycktub3QsIHUsbnVyYnMuYmFzaXNGdW5jcyk7XG5cdHZhciBldmFsUHQgPSB2ZWM0LmNyZWF0ZSgpO1xuXHRmb3IodmFyIGkgPSAwO2k8PWNydi5kZWdyZWU7KytpKSB7XG5cdCAgdmVjNC5zY2FsZUFuZEFkZChldmFsUHQsIGV2YWxQdCxjcnYuY29udHJvbFB0c1tjdXJyS25vdC1jcnYuZGVncmVlK2ldLCBudXJicy5iYXNpc0Z1bmNzW2ldKTtcblx0fVxuXHRyZXR1cm4gdmVjNC5wcm9qZWN0RG93bihldmFsUHQscHQpO1xufVxuLypcdCBcblx0IHB1YmxpYyBQVmVjdG9yIGRlcml2YXRpdmUoZmxvYXQgdSwgaW50IGspIHtcblx0XHQgVmVjdG9yNERbXSBkZXJpdmVzVyA9IG5ldyBWZWN0b3I0RFtrKzFdO1xuXHRcdCBpZihrPmRlZ3JlZSkgcmV0dXJuIG5ldyBQVmVjdG9yKCk7XG5cdFx0IGludCBjdXJyS25vdCA9IGZpbmRLbm90KHUpO1xuXHRcdCBWZWN0b3I0RFtdIGhQdHMgPSBuZXcgVmVjdG9yNERbZGVncmVlKzFdO1xuXHRcdCBmb3IoaW50IGk9MDtpPD1kZWdyZWU7KytpKSB7XG5cdCAgICAgIGhQdHNbaV0gPSBWZWN0b3I0RC5tdWx0aXBseShuZXcgVmVjdG9yNEQoY29udHJvbFB0c1tjdXJyS25vdC1kZWdyZWUraV0ueCxjb250cm9sUHRzW2N1cnJLbm90LWRlZ3JlZStpXS55LGNvbnRyb2xQdHNbY3Vycktub3QtZGVncmVlK2ldLnopLHdlaWdodHNbY3Vycktub3QtZGVncmVlK2ldKTtcblx0XHQgfVxuXHRcdCBmbG9hdFtdW10gYmFzRnVuYyA9IGRlcml2ZUJhc2lzRnVuY3Rpb25zKGN1cnJLbm90LHUsIGspO1xuXHRcdCBmb3IoaW50IGk9MDtpPD1rOysraSkge1xuXHRcdFx0IGRlcml2ZXNXW2ldID0gbmV3IFZlY3RvcjREKCk7XG5cdFx0XHQgZm9yKGludCBqPTA7ajw9ZGVncmVlOysraikge1xuXHRcdFx0XHQgZGVyaXZlc1dbaV0gPSBWZWN0b3I0RC5hZGQoZGVyaXZlc1dbaV0sVmVjdG9yNEQubXVsdGlwbHkoaFB0c1tqXSxiYXNGdW5jW2ldW2pdKSk7XG5cdFx0XHQgfVxuXHRcdCB9XG5cdFx0IFxuXHRcdCBQVmVjdG9yW10gZGVyaXZlcyA9IG5ldyBQVmVjdG9yW2Rlcml2ZXNXLmxlbmd0aF07XG5cdFx0IGRlcml2ZXNbMF0gPSBuZXcgUFZlY3RvcigpO1xuXHRcdCBmb3IoaW50IGk9MDtpPD1rOysraSkge1xuXHRcdFx0UFZlY3RvciBjdXJyUHQgPSBuZXcgUFZlY3RvcihkZXJpdmVzV1tpXS54LGRlcml2ZXNXW2ldLnksZGVyaXZlc1dbaV0ueik7XG5cdFx0XHRmb3IoaW50IGo9MTtqPD1pOysraikge1xuXHRcdFx0XHRjdXJyUHQgPSBQVmVjdG9yLnN1YihjdXJyUHQsUFZlY3Rvci5tdWx0KGRlcml2ZXNbaS1qXSxCW2ldW2pdKmRlcml2ZXNXW2pdLncpKTtcblx0XHRcdH1cblx0XHRcdGRlcml2ZXNbaV0gPSBuZXcgUFZlY3RvcihjdXJyUHQueC9kZXJpdmVzV1swXS53LGN1cnJQdC55L2Rlcml2ZXNXWzBdLncsY3VyclB0LnovZGVyaXZlc1dbMF0udyk7XG5cdFx0IH1cblx0XHQgcmV0dXJuIGRlcml2ZXNba107XG5cdFx0IFxuXHQgfVxuXHQgXG5cdCBwdWJsaWMgUFZlY3RvcltdIGFsbERlcml2YXRpdmVzKGZsb2F0IHUsIGludCBrKSB7XG5cdFx0IFZlY3RvcjREW10gZGVyaXZlc1cgPSBuZXcgVmVjdG9yNERbaysxXTtcblx0XHQgaW50IGN1cnJLbm90ID0gZmluZEtub3QodSk7XG5cdFx0IFZlY3RvcjREW10gaFB0cyA9IG5ldyBWZWN0b3I0RFtkZWdyZWUrMV07XG5cdFx0IGZvcihpbnQgaT0wO2k8PWRlZ3JlZTsrK2kpIHtcblx0ICAgICAgaFB0c1tpXSA9IFZlY3RvcjRELm11bHRpcGx5KG5ldyBWZWN0b3I0RChjb250cm9sUHRzW2N1cnJLbm90LWRlZ3JlZStpXS54LGNvbnRyb2xQdHNbY3Vycktub3QtZGVncmVlK2ldLnksY29udHJvbFB0c1tjdXJyS25vdC1kZWdyZWUraV0ueiksd2VpZ2h0c1tjdXJyS25vdC1kZWdyZWUraV0pO1xuXHRcdCB9XHRcdCBcblx0XHQgZmxvYXRbXVtdIGJhc0Z1bmMgPSBkZXJpdmVCYXNpc0Z1bmN0aW9ucyhjdXJyS25vdCx1LCBrKTtcblx0XHQgZm9yKGludCBpPTA7aTw9azsrK2kpIHtcblx0XHRcdCBkZXJpdmVzV1tpXSA9IG5ldyBWZWN0b3I0RCgpO1xuXHRcdFx0IGZvcihpbnQgaj0wO2o8PWRlZ3JlZTsrK2opXG5cdFx0XHRcdCBkZXJpdmVzV1tpXSA9IFZlY3RvcjRELmFkZChkZXJpdmVzV1tpXSxWZWN0b3I0RC5tdWx0aXBseShoUHRzW2pdLGJhc0Z1bmNbaV1bal0pKTtcblx0XHQgfVxuXHRcdCBcblx0XHQgUFZlY3RvcltdIGRlcml2ZXMgPSBuZXcgUFZlY3RvcltkZXJpdmVzVy5sZW5ndGhdO1xuXHRcdCBkZXJpdmVzWzBdID0gbmV3IFBWZWN0b3IoKTtcblx0XHQgZm9yKGludCBpPTA7aTw9azsrK2kpIHtcblx0XHRcdFBWZWN0b3IgY3VyclB0ID0gbmV3IFBWZWN0b3IoZGVyaXZlc1dbaV0ueCxkZXJpdmVzV1tpXS55LGRlcml2ZXNXW2ldLnopO1xuXHRcdFx0Zm9yKGludCBqPTE7ajw9aTsrK2opIHtcblx0XHRcdFx0Y3VyclB0ID0gUFZlY3Rvci5zdWIoY3VyclB0LFBWZWN0b3IubXVsdChkZXJpdmVzW2ktal0sQltpXVtqXSpkZXJpdmVzV1tqXS53KSk7XG5cdFx0XHR9XG5cdFx0XHRkZXJpdmVzW2ldID0gbmV3IFBWZWN0b3IoY3VyclB0LngvZGVyaXZlc1dbMF0udyxjdXJyUHQueS9kZXJpdmVzV1swXS53LGN1cnJQdC56L2Rlcml2ZXNXWzBdLncpO1xuXHRcdCB9XG5cdFx0IHJldHVybiBkZXJpdmVzO1xuXHRcdCBcblx0IH1cdCBcbiovXHQgIFxuXHQgIC8vYXBwcm94aW1hdGUgbGVuZ3RoLCB1bmltcGxlbWVudGVkXG5udXJicy5jcnZMZW5ndGg9ZnVuY3Rpb24oY3J2KSB7XG5cdHJldHVybiAxO1xufVx0XG5cdCAgXG5udXJicy5kb21haW4gPSBmdW5jdGlvbihjLGIpIHtcblx0YiA9IGIgfHwgbmV3IEFycmF5KDIpO1xuXHRiWzBdPWMua25vdHNbYy5kZWdyZWVdO1xuXHRiWzFdPWMua25vdHNbYy5rbm90cy5sZW5ndGgtMS1jLmRlZ3JlZV07XG5cdHJldHVybiBiO1xufVxuXHQgIFxubnVyYnMuYWRkUG9pbnQgPSBmdW5jdGlvbihjcnYsIHB0KSB7XG5cdGNydi5jb250cm9sUHRzLnB1c2godmVjNC5mcm9tVmVjMyhwdCwxKSk7XG5cdHZhciBpbmMgPSAxO1xuXHR2YXIgc3RhcnQgPSBjcnYua25vdHNbY3J2LmRlZ3JlZV07XG5cdHZhciBlbmQgPSBjcnYua25vdHNbY3J2Lmtub3RzLmxlbmd0aC0xXTtcblx0aWYoY3J2LmNvbnRyb2xQdHMubGVuZ3RoPD1jcnYuZGVncmVlKzEpIHtcblx0ICBjcnYua25vdHMucHVzaCgxKTtcblx0fSBlbHNlIHtcblx0ICB2YXIgaTtcblx0ICBmb3IoIGk9Y3J2LmRlZ3JlZSsxO2k8Y3J2Lmtub3RzLmxlbmd0aC1jcnYuZGVncmVlOysraSkge1xuXHRcdCAgaWYoY3J2Lmtub3RzW2ldICE9IHN0YXJ0KSB7XG5cdFx0XHQgIGluYyA9IGNydi5rbm90c1tpXS1zdGFydDtcblx0XHRcdCAgaSA9IGNydi5rbm90cy5sZW5ndGg7IC8vYnJlYWs/XG5cdFx0ICB9XG5cdCAgfVxuXHQgIGNydi5rbm90cy5wdXNoKGVuZCtpbmMpO1xuXHQgIGZvciggaT1jcnYua25vdHMubGVuZ3RoLTI7aT5jcnYua25vdHMubGVuZ3RoLWNydi5kZWdyZWUtMjstLWkpIFxuXHRcdGNydi5rbm90c1tpXSA9IGVuZCtpbmM7XHRcdFx0ICBcblx0ICBmb3IoIGk9MDtpPGNydi5rbm90cy5sZW5ndGg7KytpKSBcblx0XHRjcnYua25vdHNbaV0gLz0gZW5kK2luYztcblx0fVxufVxuXG4vL2luc2VydCBhIGtub3QgYSB1IHNvbWUgdGltZXNcbi8vdGhpcyBzaG91bGQgdXNlIG5hdGl2ZSBhcnJheSBtZXRob2RzIG5vdCB0aGlzIHdlaXJkIGNvcHlpbmdcbm51cmJzLmluc2VydEtub3QgPSBmdW5jdGlvbihjcnYsdSx0aW1lcykge1xuXHRpZighdGltZXMpIHRpbWVzID0gMTtcblx0dmFyIGN1cnJLbm90ID0gbnVyYnMuZmluZEtub3QoY3J2Lmtub3RzLHUsY3J2LmRlZ3JlZSk7XG5cdHZhciBtdWx0aXBsaWNpdHkgPSBudXJicy5maW5kTXVsdGlwbGljaXR5KGNydi5rbm90cyxjdXJyS25vdCk7XG5cdC8vdGltZXMgPSBNYXRoLm1pbihkZWdyZWUtdGltZXMtbXVsdGlwbGljaXR5LHRpbWVzKTtcblx0Ly90aW1lcyA9IE1hdGgubWF4KDAsdGltZXMpO1xuXHR2YXIgbmV3S25vdHMgPSBuZXcgRmxvYXQzMkFycmF5KGNydi5rbm90cy5sZW5ndGgrdGltZXMpO1xuXHR2YXIgbmV3UG9pbnRzID0gbmV3IEFycmF5KGNydi5jb250cm9sUHRzLmxlbmd0aCt0aW1lcyk7XG5cblx0dmFyIGk7XG5cdGZvcihpPTA7aTw9Y3Vycktub3Q7KytpKSBuZXdLbm90c1tpXSA9IGNydi5rbm90c1tpXTtcblx0Zm9yKGk9MTtpPD10aW1lczsrK2kpIG5ld0tub3RzW2N1cnJLbm90K2ldID0gdTtcblx0Zm9yKGk9Y3Vycktub3QrMTtpPGNydi5rbm90cy5sZW5ndGg7KytpKSBuZXdLbm90c1tpK3RpbWVzXSA9IGNydi5rbm90c1tpXTtcblx0Zm9yKGk9MDtpPD1jdXJyS25vdC1jcnYuZGVncmVlOysraSkgbmV3UG9pbnRzW2ldID0gY3J2LmNvbnRyb2xQdHNbaV07XG5cdGZvcihpPWN1cnJLbm90LW11bHRpcGxpY2l0eTsgaTxjcnYuY29udHJvbFB0cy5sZW5ndGg7KytpKSBuZXdQb2ludHNbaSt0aW1lc10gPSBjcnYuY29udHJvbFB0c1tpXTtcblx0dmFyIHRlbXAgPSBuZXcgQXJyYXkoZGVncmVlKzEpO1xuXHRmb3IoaT0wO2k8PSBjcnYuZGVncmVlLW11bHRpcGxpY2l0eTsrK2kpIHRlbXBbaV0gPSBjcnYuY29udHJvbFB0c1tjdXJyS25vdC1jcnYuZGVncmVlK2ldO1xuXHR2YXIgaiwgTCxhbHBoYTtcblx0Zm9yKGo9MTtqPD10aW1lczsrK2opIHtcblx0IEwgPSBjdXJyS25vdC1jcnYuZGVncmVlK2o7XG5cdCBmb3IoaT0wO2k8PWNydi5kZWdyZWUtai1tdWx0aXBsaWNpdHk7KytpKSB7XG5cdFx0IGFscGhhID0gKHUtY3J2Lmtub3RzW0wraV0pLyhjcnYua25vdHNbaStjdXJyS25vdCsxXS1jcnYua25vdHNbTCtpXSk7XG5cdFx0IHZlYzQuYWRkKHZlYzQuc2NhbGUodGVtcFtpKzFdLGFscGhhKSx2ZWM0LnNjYWxlKHRlbXBbaV0sMS4wLWFscGhhKSx0ZW1wW2ldKTtcblx0IH1cblx0IFxuXHQgbmV3UG9pbnRzW0xdID0gdGVtcFswXTtcblx0IG5ld1BvaW50c1tjdXJyS25vdCt0aW1lcy1qLW11bHRpcGxpY2l0eV0gPSB0ZW1wW2Nydi5kZWdyZWUtai1tdWx0aXBsaWNpdHldO1xuXHR9XG5cdGZvcihpPUwrMTtpPGN1cnJLbm90LW11bHRpcGxpY2l0eTsrK2kpIHtcblx0IG5ld1BvaW50c1tpXSA9IHRlbXBbaS1MXTtcblx0fVxuXHRjcnYuY29udHJvbFB0cyA9IG5ld1BvaW50cztcblx0Y3J2Lmtub3RzID0gbmV3S25vdHM7XG59XHQgIFxuXG5udXJicy5pbnNlcnRLbm90QXJyYXkgPSBmdW5jdGlvbihjcnYsdXMpIHtcblxufVxuXHQgIC8qXHQgXG5cdCBwdWJsaWMgdm9pZCBpbnNlcnRLbm90cyhmbG9hdFtdIGluc2VydEtub3RzKSB7XG5cdFx0IGludCBzdGFydEtub3QgPSBmaW5kS25vdChpbnNlcnRLbm90c1swXSk7XG5cdFx0IGludCBlbmRLbm90ID0gZmluZEtub3QoaW5zZXJ0S25vdHNbaW5zZXJ0S25vdHMubGVuZ3RoLTFdKSsxO1xuXHRcdCBmbG9hdFtdIG5ld0tub3RzID0gbmV3IGZsb2F0W2tub3RzLmxlbmd0aCtpbnNlcnRLbm90cy5sZW5ndGhdO1xuXHRcdCBWZWN0b3I0RFtdIG5ld1BvaW50cyA9IG5ldyBWZWN0b3I0RFtjb250cm9sUHRzLmxlbmd0aCtpbnNlcnRLbm90cy5sZW5ndGhdO1xuXHRcdCBmb3IoaW50IGo9MDtqPD1zdGFydEtub3QtZGVncmVlOysraikgbmV3UG9pbnRzW2pdID0gbmV3IFZlY3RvcjREKGNvbnRyb2xQdHNbal0sd2VpZ2h0c1tqXSk7XG5cdFx0IGZvcihpbnQgaj1lbmRLbm90LTE7ajxjb250cm9sUHRzLmxlbmd0aDsrK2opIG5ld1BvaW50c1tqK2luc2VydEtub3RzLmxlbmd0aF0gPSAgbmV3IFZlY3RvcjREKGNvbnRyb2xQdHNbal0sd2VpZ2h0c1tqXSk7XG5cdFx0IGZvcihpbnQgaj0wO2o8PXN0YXJ0S25vdDsrK2opIG5ld0tub3RzW2pdID0ga25vdHNbal07XG5cdFx0IGZvcihpbnQgaj1lbmRLbm90K2RlZ3JlZTtqPGtub3RzLmxlbmd0aDsrK2opIG5ld0tub3RzW2oraW5zZXJ0S25vdHMubGVuZ3RoXSA9IGtub3RzW2pdO1xuXHRcdCBpbnQgaT1lbmRLbm90K2RlZ3JlZS0xO1xuXHRcdCBpbnQgaz0gZW5kS25vdCtkZWdyZWUraW5zZXJ0S25vdHMubGVuZ3RoLTE7XG5cdFx0IGZvcihpbnQgaj1pbnNlcnRLbm90cy5sZW5ndGgtMTtqPj0wOy0taikge1xuXHRcdFx0IHdoaWxlKGluc2VydEtub3RzW2pdIDw9IGtub3RzW2ldICYmIGk+c3RhcnRLbm90KSB7XG5cdFx0XHRcdCBuZXdQb2ludHNbay1kZWdyZWUtMV0gPSBuZXcgVmVjdG9yNEQoY29udHJvbFB0c1tpLWRlZ3JlZS0xXSx3ZWlnaHRzW2ktZGVncmVlLTFdKTtcblx0XHRcdFx0IG5ld0tub3RzW2tdID0ga25vdHNbaV07XG5cdFx0XHRcdCAtLWs7XG5cdFx0XHRcdCAtLWk7XG5cdFx0XHQgfVxuXHRcdFx0IG5ld1BvaW50c1trLWRlZ3JlZS0xXSA9IG5ld1BvaW50c1trLWRlZ3JlZV07XG5cdFx0XHQgZm9yKGludCBsPTE7bDw9ZGVncmVlOysrbCkge1xuXHRcdFx0XHQgaW50IGluZCA9IGstZGVncmVlK2w7XG5cdFx0XHRcdCBsb2F0IGFscGhhID0gbmV3S25vdHNbaytsXS1pbnNlcnRLbm90c1tqXTtcblx0XHRcdFx0IGlmKE1hdGguYWJzKGFscGhhKSA9PSAwKSBuZXdQb2ludHNbaW5kLTFdID0gbmV3UG9pbnRzW2luZF07XG5cdFx0XHRcdCBlbHNlIHtcblx0XHRcdFx0XHQgYWxwaGEgPSBhbHBoYS8obmV3S25vdHNbaytsXS1rbm90c1tpLWRlZ3JlZStsXSk7XG5cdFx0XHRcdFx0IG5ld1BvaW50c1tpbmQtMV0gPSBWZWN0b3I0RC5hZGQoVmVjdG9yNEQubXVsdGlwbHkobmV3UG9pbnRzW2luZC0xXSxhbHBoYSksIFZlY3RvcjRELm11bHRpcGx5KG5ld1BvaW50c1tpbmRdLDEtYWxwaGEpKTtcblx0XHRcdFx0IH1cblx0XHRcdCB9XG5cdFx0XHQgbmV3S25vdHNba10gPSBpbnNlcnRLbm90c1tqXTtcblx0XHRcdCAtLWs7XG5cdFx0IH1cblx0XHQga25vdHMgPSBuZXdLbm90cztcblx0XHQgY29udHJvbFB0cyA9IG5ldyBQVmVjdG9yW25ld1BvaW50cy5sZW5ndGhdO1xuXHRcdCB3ZWlnaHRzID0gbmV3IGZsb2F0W25ld1BvaW50cy5sZW5ndGhdO1xuXHRcdCBmb3IoaW50IGo9MDtqPG5ld1BvaW50cy5sZW5ndGg7KytqKSB7XG5cdFx0XHQgXG5cdFx0XHQgaWYobmV3UG9pbnRzW2pdICE9IG51bGwpIHtcblx0XHRcdFx0IGNvbnRyb2xQdHNbal0gPSBuZXdQb2ludHNbal0ucHJvamVjdERvd24oKTtcblx0XHRcdFx0IHdlaWdodHNbal0gPSBuZXdQb2ludHNbal0udztcblx0XHRcdCB9XG5cdFx0IH1cblx0IH1cbiovXG4vL21ha2Uga25vdCB2YWx1ZXMgYmV0d2VlbiAwIGFuZCAxIGFrYSBldmFsdWF0ZSgwKSA9IHN0YXJ0IGFuZCBldmFsdWF0ZSgxKSA9IGVuZFxubnVyYnMubm9ybWFsaXplS25vdHM9ZnVuY3Rpb24oa25vdHMpIHtcblx0dmFyIHN0YXJ0ID0ga25vdHNbMF07XG5cdHZhciBlbmQgPSBrbm90c1trbm90cy5sZW5ndGgtMV07XG5cdGZvcih2YXIgaT0wO2k8a25vdHMubGVuZ3RoOysraSkge1xuXHRcdGtub3RzW2ldID0gKGtub3RzW2ldLXN0YXJ0KS8oZW5kLXN0YXJ0KTtcblx0fVxufVxuXG4vL2hvdyBtYW55IHRpbWVzIGRvZXMgYSBrbm90IGFwcGVhclxubnVyYnMuZmluZE11bHRpcGxpY2l0eSA9IGZ1bmN0aW9uKGtub3RzLGtub3QpIHtcblx0dmFyIG11bHQgPSAxO1xuXHR2YXIgaTtcblx0Zm9yKGk9a25vdCsxO2k8a25vdHMubGVuZ3RoICYmIGtub3RzW2ldID09IGtub3RzW2tub3RdOysraSkgKyttdWx0O1xuXHRmb3IoaT1rbm90LTE7aT49MCAmJiBrbm90c1tpXSA9PSBrbm90c1trbm90XTstLWkpICsrbXVsdDtcblxuXHRyZXR1cm4gbXVsdC0xO1xufVxuXHQgXG5udXJicy5iYXNpc0Z1bmN0aW9ucyA9IGZ1bmN0aW9uKGtub3RzLGRlZ3JlZSxrbm90LHUsZnVuY3MpIHtcblx0dmFyIGxlZnQgPSBuZXcgRmxvYXQzMkFycmF5KGRlZ3JlZSsxKTtcblx0dmFyIHJpZ2h0ID0gbmV3IEZsb2F0MzJBcnJheShkZWdyZWUrMSk7XG5cblx0ZnVuY3NbMF0gPSAxO1xuXHR2YXIgaiwgciwgc2F2ZWQsIHRlbXA7XG5cdGZvciggaj0xO2o8PWRlZ3JlZTsrK2opIHtcblx0ICBsZWZ0W2pdID0gdS1rbm90c1trbm90KzEtal07XG5cdCAgcmlnaHRbal0gPSBrbm90c1trbm90K2pdLXU7XG5cdCAgc2F2ZWQgPSAwO1xuXHQgIGZvciggciA9IDA7cjxqOysrcikge1xuXHRcdHRlbXAgPSBmdW5jc1tyXS8ocmlnaHRbcisxXStsZWZ0W2otcl0pO1xuXHRcdGZ1bmNzW3JdID0gc2F2ZWQrcmlnaHRbcisxXSp0ZW1wO1xuXHRcdHNhdmVkID0gbGVmdFtqLXJdKnRlbXA7XG5cdCAgfVxuXHQgIGZ1bmNzW2pdID0gc2F2ZWQ7XG5cdH1cblx0cmV0dXJuIGZ1bmNzO1xufVxuXHQgIFxuXHQgIFxubnVyYnMuZGVyaXZlQmFzaXNGdW5jdGlvbnMgPSBmdW5jdGlvbihrbm90cyxkZWdyZWUsa25vdCwgdSwgZGVyKSB7XG5cdHZhciBsZWZ0LHJpZ2h0O1xuXHRuZHVbMF1bMF0gPSAxO1xuXHR2YXIgaixyO1xuXHR2YXIgc2F2ZWQsdGVtcDtcblx0Zm9yKGo9MTtqPD1kZWdyZWU7KytqKSB7XG5cdCBsZWZ0W2pdID0gdS1rbm90c1trbm90KzEtal07XG5cdCByaWdodFtqXSA9IGtub3RzW2tub3Qral0tdTtcblx0IHNhdmVkID0gMDtcblx0IGZvcihyPTA7cjxqOysrcikge1xuXHRcdCBuZHVbal1bcl0gPSByaWdodFtyKzFdK2xlZnRbai1yXTtcblx0XHQgdGVtcCA9IG5kdVtyXVtqLTFdL25kdVtqXVtyXTtcblx0XHQgbmR1W3JdW2pdID0gc2F2ZWQrcmlnaHRbcisxXSp0ZW1wO1xuXHRcdCBzYXZlZCA9IGxlZnRbai1yXSp0ZW1wO1xuXHQgfVxuXHQgbmR1W2pdW2pdID0gc2F2ZWQ7XG5cdH1cblx0Zm9yKGo9MDtqPD1kZWdyZWU7KytqKVxuXHRcdG51cmJzLmRlcml2ZUJhc2lzRnVuY3NbMF1bal0gPSBuZHVbal1bZGVncmVlXTtcblx0XG5cdHZhciBzMSwgczIsIGssZCxyayxwayxqMSxqMjtcblx0dmFyIGE9bmV3IEFycmF5KGRlZ3JlZSsxKTtcblx0Zm9yKGo9MDtqPGRlZ3JlZSsxOysraikgYVtqXSA9IG5ldyBBcnJheShkZWdyZWUrMSk7XG5cdGZvcihyPTA7cjw9ZGVncmVlOysrcikge1xuXHQgczEgPSAwO1xuXHQgczIgPSAxO1xuXHQgYVswXVswXSA9IDE7XG5cdCBmb3IoIGs9MTtrPD1kZXI7KytrKSB7XG5cdFx0IGQgPSAwO1xuXHRcdCByayA9IHItaztcblx0XHQgcGsgPSBkZWdyZWUtaztcblx0XHQgaWYocj49aykge1xuXHRcdFx0IGFbczJdWzBdID0gYVtzMV1bMF0vbmR1W3BrKzFdW3JrXTtcblx0XHRcdCBkID0gYVtzMl1bMF0qbmR1W3JrXVtwa107XG5cdFx0IH1cblx0XHQgajEgPSAtcms7XG5cdFx0IGlmKHJrPj0tMSkgajEgPSAxO1xuXHRcdCBqMj1kZWdyZWUtcjtcblx0XHQgaWYoci0xIDw9cGspIGoyID0gay0xO1xuXHRcdCBcblx0XHQgZm9yKGo9ajE7ajw9ajI7KytqKSB7XG5cdFx0XHQgYVtzMl1bal0gPSAoYVtzMV1bal0tYVtzMV1bai0xXSkvbmR1W3BrKzFdW3JrK2pdO1xuXHRcdFx0IGQgKz0gYVtzMl1bal0qbmR1W3JrK2pdW3BrXTtcblx0XHQgfVxuXHRcdCBpZihyPD1waykge1xuXHRcdFx0IGFbczJdW2tdID0gLWFbczFdW2stMV0vbmR1W3BrKzFdW3JdO1xuXHRcdFx0IGQgKz0gYVtzMl1ba10qbmR1W3JdW3BrXTtcblx0XHQgfVxuXHRcdCBudXJicy5kZXJpdmVCYXNpc0Z1bmNzW2tdW3JdID0gZDtcblx0XHQgdGVtcCA9czE7XG5cdFx0IHMxID0gczI7XG5cdFx0IHMyID0gdGVtcDtcdCBcblx0IH1cblx0fVxuXHRyID0gZGVncmVlO1xuXHRmb3Ioaz0xO2s8PWRlcjsrK2spIHtcblx0IGZvcihqPTA7ajw9ZGVncmVlOysraikgbnVyYnMuZGVyaXZlQmFzaXNGdW5jc1trXVtqXSAqPSByOyBcblx0IHIgKj0gKGRlZ3JlZS1rKTtcblx0fVxuXHRyZXR1cm4gbnVyYnMuZGVyaXZlQmFzaXNGdW5jcztcbn1cblxubnVyYnMuY2lyY2xlUHQgPSBmdW5jdGlvbihjZW4scmFkaXVzKSB7XG5cblx0dmFyIGNydiA9IG51cmJzLmNyZWF0ZUNydigpO1xuXHRjcnYuY29udHJvbFB0cyA9IFtdO1xuXHRjcnYuZGVncmVlID0gMjtcblx0Y3J2Lmtub3RzID0gWzAsMCwwLE1hdGguUEkqMC41LE1hdGguUEkqMC41LCBNYXRoLlBJLCBNYXRoLlBJLCBNYXRoLlBJKjEuNSwgTWF0aC5QSSoxLjUsIE1hdGguUEkqMiwgTWF0aC5QSSoyLE1hdGguUEkqMl07XG5cdHZhciBTUVJUMiA9IE1hdGguc3FydCgyLjApKjAuNTtcblx0Y3J2LmNvbnRyb2xQdHMgPSBbIHZlYzQuY3JlYXRlKFtjZW5bMF0rcmFkaXVzLGNlblsxXSxjZW5bMl0sMV0pLFxuXHRcdHZlYzQuY3JlYXRlKFsoY2VuWzBdK3JhZGl1cykqU1FSVDIsKGNlblsxXStyYWRpdXMpKlNRUlQyLGNlblsyXSpTUVJUMixTUVJUMl0pLFxuXHRcdHZlYzQuY3JlYXRlKFtjZW5bMF0sY2VuWzFdK3JhZGl1cyxjZW5bMl0sMV0pLFxuXHRcdHZlYzQuY3JlYXRlKFsoY2VuWzBdLXJhZGl1cykqU1FSVDIsKGNlblsxXStyYWRpdXMpKlNRUlQyLGNlblsyXSpTUVJUMixTUVJUMl0pLFxuXHRcdHZlYzQuY3JlYXRlKFtjZW5bMF0tcmFkaXVzLGNlblsxXSxjZW5bMl0sMV0pLFxuXHRcdHZlYzQuY3JlYXRlKFsoY2VuWzBdLXJhZGl1cykqU1FSVDIsKGNlblsxXS1yYWRpdXMpKlNRUlQyLGNlblsyXSpTUVJUMixTUVJUMl0pLFxuXHRcdHZlYzQuY3JlYXRlKFtjZW5bMF0sY2VuWzFdLXJhZGl1cyxjZW5bMl0sMV0pLFxuXHRcdHZlYzQuY3JlYXRlKFsoY2VuWzBdK3JhZGl1cykqU1FSVDIsKGNlblsxXS1yYWRpdXMpKlNRUlQyLGNlblsyXSpTUVJUMixTUVJUMl0pLFxuXHRcdHZlYzQuY3JlYXRlKFtjZW5bMF0rcmFkaXVzLGNlblsxXSxjZW5bMl0sMV0pIF07XG5cdHJldHVybiBjcnY7XG59XHRcblxuXG4vLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vL05VUkJTIFNVUkZBQ0VTXG4vL1xubnVyYnMuY3JlYXRlU3JmID0gZnVuY3Rpb24oKSB7XG5cdHZhciBzcmYgPSB7fTtcblx0c3JmLmtub3RzVSA9IFtdO1xuXHRzcmYua25vdHNWID0gW107XG5cdHNyZi5jb250cm9sUHRzID0gW107XG5cdHNyZi5kZWdyZWVVID0gW107XG5cdHNyZi5kZWdyZWVWID0gW107XG5cdHJldHVybiBzcmY7XG59XG5cblxubnVyYnMuZXZhbHVhdGVTcmYgPSBmdW5jdGlvbihzcmYsdSx2LHB0KSB7XG5cdHB0ID0gcHQgfHwgdmVjMy5jcmVhdGUoKTtcblx0Ly9pZihjb250cm9sUHRzLmxlbmd0aCA9PSAwKSByZXR1cm4gbmV3IFBWZWN0b3IoKTtcblx0dmFyIHVLbm90ID0gbnVyYnMuZmluZEtub3Qoc3JmLmtub3RzVSx1LHNyZi5kZWdyZWVVKTtcblx0dmFyIHZLbm90ID0gbnVyYnMuZmluZEtub3Qoc3JmLmtub3RzVix2LHNyZi5kZWdyZWVWKTtcblx0bnVyYnMuYmFzaXNGdW5jdGlvbnMoc3JmLmtub3RzVSwgc3JmLmRlZ3JlZVUsIHVLbm90LHUsbnVyYnMuYmFzaXNGdW5jc1UpO1xuXHRudXJicy5iYXNpc0Z1bmN0aW9ucyhzcmYua25vdHNWLCBzcmYuZGVncmVlViwgdktub3QsdixudXJicy5iYXNpc0Z1bmNzVik7XG5cdFxuXHR2YXIgZXZhbFB0ID0gdmVjNC5jcmVhdGUoKTtcblx0dmFyIHRlbXAgPSBbXTtcblx0dmFyIGksajtcblx0Ly9hdm9pZCBjcmVhdGUgY29tbWFuZHNcblx0Zm9yKGk9MDtpPD1zcmYuZGVncmVlVjsrK2kpIHtcblx0XHR0ZW1wW2ldID0gdmVjNC5jcmVhdGUoKTtcblx0XHRmb3Ioaj0wO2o8PXNyZi5kZWdyZWVVOysraikge1xuXHRcdFx0dmVjNC5hZGQodGVtcFtpXSx2ZWM0LnNjYWxlKHNyZi5jb250cm9sUHRzW3VLbm90LXNyZi5kZWdyZWVVK2pdW3ZLbm90LXNyZi5kZWdyZWVWK2ldLCBudXJicy5iYXNpc0Z1bmNzVVtqXSxldmFsUHQpKTtcblx0XHR9XG5cdH1cblx0XG5cdHZlYzQuc2V0KFswLDAsMCwwXSxldmFsUHQpO1xuXHRmb3IoaT0wO2k8PXNyZi5kZWdyZWVWOysraSkge1xuXHRcdHZlYzQuYWRkKGV2YWxQdCwgdmVjNC5zY2FsZSh0ZW1wW2ldLG51cmJzLmJhc2lzRnVuY3NWW2ldKSk7XG5cdH1cblx0cmV0dXJuIHZlYzQucHJvamVjdERvd24oZXZhbFB0LHB0KTtcbn1cblx0LypcblxuXHROdXJic0N1cnZlIGlzb2N1cnZlKGZsb2F0IHUsIGJvb2xlYW4gZGlyKSB7XG5cdFx0aW50IHVLbm90ID0gZmluZEtub3QodSxrbm90c1UsZGVncmVlVSk7XG5cdFx0ZmxvYXRbXSBiYXNGdW5jID0gYmFzaXNGdW5jdGlvbnModUtub3QsdSxrbm90c1UsZGVncmVlVSk7XG5cdFx0VmVjdG9yNERbXVtdIGhQdHMgPSBuZXcgVmVjdG9yNERbZGVncmVlVSsxXVtkZWdyZWVWKzFdO1xuXHRcdGZvcihpbnQgaT0wO2k8Y29udHJvbFB0cy5sZW5ndGg7KytpKSB7XG5cdFx0XHRmb3IoaW50IGo9MDtqPGNvbnRyb2xQdHNbMF0ubGVuZ3RoOysraikge1xuXHRcdFx0XHRQVmVjdG9yIGN0cmxQdCA9IGNvbnRyb2xQdHNbaV1bal07XG5cdFx0XHRcdGZsb2F0IHcgPSB3ZWlnaHRzW2ldW2pdO1xuXHRcdFx0XHRoUHRzW2ldW2pdID0gbmV3IFZlY3RvcjREKGN0cmxQdC54KncsIGN0cmxQdC55KncsY3RybFB0Lnoqdyx3KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0VmVjdG9yNERbXSBuZXdQdHMgPSBuZXcgVmVjdG9yNERbY29udHJvbFB0c1swXS5sZW5ndGhdO1xuXHRcdGZvcihpbnQgaT0wO2k8Y29udHJvbFB0c1swXS5sZW5ndGg7KytpKSB7XG5cdFx0XHRmb3IoaW50IGo9MDtqPD1kZWdyZWVVOysraikge1xuXHRcdFx0XHRuZXdQdHNbaV0gPSBWZWN0b3I0RC5hZGQobmV3UHRzW2ldLFZlY3RvcjRELm11bHRpcGx5KGhQdHNbdUtub3QtZGVncmVlVStqXVtpXSwgYmFzRnVuY1tqXSkpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRcblx0XHRQVmVjdG9yW10gbmV3Q1B0cyA9IG5ldyBQVmVjdG9yW25ld1B0cy5sZW5ndGhdO1xuXHRcdGZsb2F0W10gbmV3V2VpZ2h0cyA9IG5ldyBmbG9hdFtuZXdQdHMubGVuZ3RoXTtcblx0XHRmb3IoaW50IGk9MDtpPG5ld1B0cy5sZW5ndGg7KytpKSB7XG5cdFx0XHRuZXdDUHRzW2ldID0gbmV3IFBWZWN0b3IobmV3UHRzW2ldLngqbmV3UHRzW2ldLncsbmV3UHRzW2ldLnkqbmV3UHRzW2ldLncsbmV3UHRzW2ldLnoqbmV3UHRzW2ldLncpO1xuXHRcdFx0bmV3V2VpZ2h0c1tpXSA9IG5ld1B0c1tpXS53O1xuXHRcdH1cblx0XHRyZXR1cm4gbmV3IE51cmJzQ3VydmUobmV3Q1B0cywga25vdHNWLCBuZXdXZWlnaHRzLCBkZWdyZWVWKTtcblx0fVxuXHRcblx0Ki9cblx0XG5udXJicy5sb2Z0ID0gZnVuY3Rpb24oY3J2MSxjcnYyKSB7XG5cdC8vZG8gZGVncmVlIGVsZXZhdGlvblxuXHRpZihjcnYxLmRlZ3JlZSAhPSBjcnYyLmRlZ3JlZSkgcmV0dXJuIG51bGw7XG5cdHZhciB0ZW1wMSA9IG51cmJzLmNvcHlDcnYoY3J2MSk7XG5cdHZhciB0ZW1wMiA9IG51cmJzLmNvcHlDcnYoY3J2Mik7XG5cdG51cmJzLm5vcm1hbGl6ZUtub3RzKHRlbXAxKTtcblx0bnVyYnMubm9ybWFsaXplS25vdHModGVtcDIpO1xuXHQvL2ZpbmQgZGlmZmVyZW5jZVxuXHR2YXIgayA9IDAsaTtcblx0dmFyIGluc2VydFRlbXAxID0gW107XG5cdHZhciBpbnNlcnRUZW1wMiA9IFtdO1xuXHRmb3IoaT0wO2k8dGVtcDEua25vdHMubGVuZ3RoOysraSkge1xuXHRcdHdoaWxlKGsgPCB0ZW1wMi5rbm90cy5sZW5ndGggJiYgdGVtcDIua25vdHNba10gPCB0ZW1wMS5rbm90c1tpXSApIHtcblx0XHRcdGluc2VydFRlbXAxLnB1c2godGVtcDIua25vdHNba10pO1xuXHRcdFx0KytrO1xuXHRcdH1cblx0XHRpZih0ZW1wMi5rbm90c1trXSA+IHRlbXAxLmtub3RzW2ldKSBpbnNlcnRUZW1wMi5wdXNoKHRlbXAxLmtub3RzW2ldKTtcblx0XHRpZih0ZW1wMi5rbm90c1trXSA9PSB0ZW1wMS5rbm90c1tpXSkgKytrO1xuXHR9XG5cdHdoaWxlKGs8dGVtcDIua25vdHMubGVuZ3RoKSB7XG5cdFx0aW5zZXJ0VGVtcDEucHVzaCh0ZW1wMi5rbm90c1trXSk7XG5cdFx0KytrO1xuXHR9XG5cdGlmKGluc2VydFRlbXAxLmxlbmd0aCA+IDApIG51cmJzLmluc2VydEtub3RzKHRlbXAxLGluc2VydFRlbXAxKTtcblx0aWYoaW5zZXJ0VGVtcDIubGVuZ3RoID4gMCkgbnVyYnMuaW5zZXJ0S25vdHModGVtcDIsaW5zZXJ0VGVtcDIpO1xuXHRcblx0dmFyIHB0cyA9IG5ldyBBcnJheSh0ZW1wMS5jb250cm9sUHRzLmxlbmd0aCk7XG5cdGZvcihpPTA7aTxwdHMubGVuZ3RoOysraSkge1xuXHRcdHB0c1tpXSA9IFt0ZW1wMS5jb250cm9sUHRzW2ldLCB0ZW1wMi5jb250cm9sUHRzW2ldXTtcblx0fVxuXHRcblx0dmFyIHRvUmV0dXJuID0gbnVyYnMuY3JlYXRlU3JmKCk7XG5cdHRvUmV0dXJuLmNvbnRyb2xQdHMgPSBwdHM7XG5cdHRvUmV0dXJuLmRlZ3JlZVUgPSB0ZW1wMS5kZWdyZWU7XG5cdHRvUmV0dXJuLmRlZ3JlZVYgPSAxO1xuXHR0b1JldHVybi5rbm90c1YgPSBbMCwwLDEsMV07IC8vdGhpcyBtaWdodCBiZSB3cm9uZ1xuXHRmb3IoaT0wO2k8dGVtcDEua25vdHMubGVuZ3RoOysraSkge1xuXHRcdHRvUmV0dXJuLmtub3RzVVtpXSA9IHRlbXAxLmtub3RzW2ldO1xuXHR9XG5cdHJldHVybiB0b1JldHVybjtcbn1cblxuLy9yZXZvbHZlXG5udXJicy5yZXZvbHZlID0gZnVuY3Rpb24oY3J2LCBheGlzKSB7XG5cbn1cblxubnVyYnMuc3dlZXAgPSBmdW5jdGlvbihjcnYxLGNydjIpIHtcblxufSIsIi8qXG4gKiBQb2x5MlRyaSBDb3B5cmlnaHQgKGMpIDIwMDktMjAxMywgUG9seTJUcmkgQ29udHJpYnV0b3JzXG4gKiBodHRwOi8vY29kZS5nb29nbGUuY29tL3AvcG9seTJ0cmkvXG4gKlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBSZWRpc3RyaWJ1dGlvbiBhbmQgdXNlIGluIHNvdXJjZSBhbmQgYmluYXJ5IGZvcm1zLCB3aXRoIG9yIHdpdGhvdXQgbW9kaWZpY2F0aW9uLFxuICogYXJlIHBlcm1pdHRlZCBwcm92aWRlZCB0aGF0IHRoZSBmb2xsb3dpbmcgY29uZGl0aW9ucyBhcmUgbWV0OlxuICpcbiAqICogUmVkaXN0cmlidXRpb25zIG9mIHNvdXJjZSBjb2RlIG11c3QgcmV0YWluIHRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlLFxuICogICB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyLlxuICogKiBSZWRpc3RyaWJ1dGlvbnMgaW4gYmluYXJ5IGZvcm0gbXVzdCByZXByb2R1Y2UgdGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UsXG4gKiAgIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIgaW4gdGhlIGRvY3VtZW50YXRpb25cbiAqICAgYW5kL29yIG90aGVyIG1hdGVyaWFscyBwcm92aWRlZCB3aXRoIHRoZSBkaXN0cmlidXRpb24uXG4gKiAqIE5laXRoZXIgdGhlIG5hbWUgb2YgUG9seTJUcmkgbm9yIHRoZSBuYW1lcyBvZiBpdHMgY29udHJpYnV0b3JzIG1heSBiZVxuICogICB1c2VkIHRvIGVuZG9yc2Ugb3IgcHJvbW90ZSBwcm9kdWN0cyBkZXJpdmVkIGZyb20gdGhpcyBzb2Z0d2FyZSB3aXRob3V0IHNwZWNpZmljXG4gKiAgIHByaW9yIHdyaXR0ZW4gcGVybWlzc2lvbi5cbiAqXG4gKiBUSElTIFNPRlRXQVJFIElTIFBST1ZJREVEIEJZIFRIRSBDT1BZUklHSFQgSE9MREVSUyBBTkQgQ09OVFJJQlVUT1JTXG4gKiBcIkFTIElTXCIgQU5EIEFOWSBFWFBSRVNTIE9SIElNUExJRUQgV0FSUkFOVElFUywgSU5DTFVESU5HLCBCVVQgTk9UXG4gKiBMSU1JVEVEIFRPLCBUSEUgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSBBTkQgRklUTkVTUyBGT1JcbiAqIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFSRSBESVNDTEFJTUVELiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQ09QWVJJR0hUIE9XTkVSIE9SXG4gKiBDT05UUklCVVRPUlMgQkUgTElBQkxFIEZPUiBBTlkgRElSRUNULCBJTkRJUkVDVCwgSU5DSURFTlRBTCwgU1BFQ0lBTCxcbiAqIEVYRU1QTEFSWSwgT1IgQ09OU0VRVUVOVElBTCBEQU1BR0VTIChJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTyxcbiAqIFBST0NVUkVNRU5UIE9GIFNVQlNUSVRVVEUgR09PRFMgT1IgU0VSVklDRVM7IExPU1MgT0YgVVNFLCBEQVRBLCBPUlxuICogUFJPRklUUzsgT1IgQlVTSU5FU1MgSU5URVJSVVBUSU9OKSBIT1dFVkVSIENBVVNFRCBBTkQgT04gQU5ZIFRIRU9SWSBPRlxuICogTElBQklMSVRZLCBXSEVUSEVSIElOIENPTlRSQUNULCBTVFJJQ1QgTElBQklMSVRZLCBPUiBUT1JUIChJTkNMVURJTkdcbiAqIE5FR0xJR0VOQ0UgT1IgT1RIRVJXSVNFKSBBUklTSU5HIElOIEFOWSBXQVkgT1VUIE9GIFRIRSBVU0UgT0YgVEhJU1xuICogU09GVFdBUkUsIEVWRU4gSUYgQURWSVNFRCBPRiBUSEUgUE9TU0lCSUxJVFkgT0YgU1VDSCBEQU1BR0UuXG4gKi9cblxuLyoganNoaW50IGJyb3dzZXI6ZmFsc2UsIGZvcmluOnRydWUsIG5vYXJnOnRydWUsIG5vZW1wdHk6dHJ1ZSwgZXFlcWVxOnRydWUsIGJpdHdpc2U6dHJ1ZSwgXG4gICBzdHJpY3Q6dHJ1ZSwgdW5kZWY6dHJ1ZSwgdW51c2VkOnRydWUsIGN1cmx5OnRydWUsIGltbWVkOnRydWUsIGxhdGVkZWY6dHJ1ZSwgXG4gICBuZXdjYXA6dHJ1ZSwgdHJhaWxpbmc6dHJ1ZSwgbWF4Y29tcGxleGl0eToxMSwgaW5kZW50OjQgXG4gKi9cblxuXG4vKlxuICogTm90ZVxuICogPT09PVxuICogdGhlIHN0cnVjdHVyZSBvZiB0aGlzIEphdmFTY3JpcHQgdmVyc2lvbiBvZiBwb2x5MnRyaSBpbnRlbnRpb25uYWx5IGZvbGxvd3NcbiAqIGFzIGNsb3NlbHkgYXMgcG9zc2libGUgdGhlIHN0cnVjdHVyZSBvZiB0aGUgcmVmZXJlbmNlIEMrKyB2ZXJzaW9uLCB0byBtYWtlIGl0IFxuICogZWFzaWVyIHRvIGtlZXAgdGhlIDIgdmVyc2lvbnMgaW4gc3luYy5cbiAqL1xuXG5cbi8qKlxuICogTW9kdWxlIGVuY2Fwc3VsYXRpb25cbiAqIEBwYXJhbSB7T2JqZWN0fSBnbG9iYWwgYSByZWZlcmVuY2UgdG8gdGhlIGdsb2JhbCBvYmplY3QgOlxuICogICAgICAgICAgICAgICAgICAgICAgd2luZG93IGluIHRoZSBicm93c2VyLCBnbG9iYWwgb24gdGhlIHNlcnZlclxuICovXG4oZnVuY3Rpb24oZ2xvYmFsKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tcG9seTJ0cmkgbW9kdWxlXG5cbiAgICAvLyBTYXZlIHRoZSBwcmV2aW91cyB2YWx1ZSBvZiB0aGUgcG9seTJ0cmkgdmFyaWFibGUsIFxuICAgIC8vIHNvIHRoYXQgaXQgY2FuIGJlIHJlc3RvcmVkIGxhdGVyIG9uLCBpZiBub0NvbmZsaWN0IGlzIHVzZWQuXG4gICAgXG4gICAgdmFyIHByZXZpb3VzUG9seTJ0cmkgPSBnbG9iYWwucG9seTJ0cmk7XG5cbiAgICAvLyBUaGUgdG9wLWxldmVsIG5hbWVzcGFjZS4gQWxsIHB1YmxpYyBwb2x5MnRyaSBjbGFzc2VzIGFuZCBmdW5jdGlvbnMgd2lsbFxuICAgIC8vIGJlIGF0dGFjaGVkIHRvIGl0LiBFeHBvcnRlZCBmb3IgYm90aCB0aGUgYnJvd3NlciBhbmQgdGhlIHNlcnZlciAoTm9kZS5qcykuXG4gICAgdmFyIHBvbHkydHJpO1xuICAgIC8qIGdsb2JhbCBleHBvcnRzICovXG4gICAgXG4gICAgaWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBwb2x5MnRyaSA9IGV4cG9ydHM7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcG9seTJ0cmkgPSBnbG9iYWwucG9seTJ0cmkgPSB7fTtcbiAgICB9XG5cbiAgICAvLyBSdW5zIHRoZSBsaWJyYXJ5IGluIG5vQ29uZmxpY3QgbW9kZSwgcmV0dXJuaW5nIHRoZSBwb2x5MnRyaSB2YXJpYWJsZSBcbiAgICAvLyB0byBpdHMgcHJldmlvdXMgb3duZXIuIFJldHVybnMgYSByZWZlcmVuY2UgdG8gdGhpcyBsaWJyYXJ5IG9iamVjdC5cbiAgICBwb2x5MnRyaS5ub0NvbmZsaWN0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGdsb2JhbC5wb2x5MnRyaSA9IHByZXZpb3VzUG9seTJ0cmk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1Qb2ludEVycm9yXG5cbiAgICAvKipcbiAgICAgKiBDdXN0b20gZXhjZXB0aW9uIGNsYXNzIHRvIGluZGljYXRlIGludmFsaWQgUG9pbnQgdmFsdWVzXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgICAgICAgICAgZXJyb3IgbWVzc2FnZVxuICAgICAqIEBwYXJhbSB7YXJyYXk8UG9pbnQ+fSBwb2ludHMgICAgIGludmFsaWQgcG9pbnRzXG4gICAgICovXG4gICAgLy8gQ2xhc3MgYWRkZWQgaW4gdGhlIEphdmFTY3JpcHQgdmVyc2lvbiAod2FzIG5vdCBwcmVzZW50IGluIHRoZSBjKysgdmVyc2lvbilcbiAgICB2YXIgUG9pbnRFcnJvciA9IGZ1bmN0aW9uIChtZXNzYWdlLCBwb2ludHMpIHtcbiAgICAgICAgdGhpcy5uYW1lICAgID0gXCJQb2ludEVycm9yXCI7XG4gICAgICAgIHRoaXMucG9pbnRzICA9IHBvaW50cyA9IHBvaW50cyB8fCBbXTtcbiAgICAgICAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZSB8fCBcIkludmFsaWQgUG9pbnRzIVwiO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5tZXNzYWdlICs9IFwiIFwiICsgUG9pbnQudG9TdHJpbmcocG9pbnRzW2ldKTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgUG9pbnRFcnJvci5wcm90b3R5cGUgPSBuZXcgRXJyb3IoKTtcbiAgICBQb2ludEVycm9yLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IFBvaW50RXJyb3I7XG5cblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tUG9pbnRcbiAgICAvKipcbiAgICAgKiBDb25zdHJ1Y3QgYSBwb2ludFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB4ICAgIGNvb3JkaW5hdGUgKDAgaWYgdW5kZWZpbmVkKVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB5ICAgIGNvb3JkaW5hdGUgKDAgaWYgdW5kZWZpbmVkKVxuICAgICAqL1xuICAgIHZhciBQb2ludCA9IGZ1bmN0aW9uKHgsIHkpIHtcbiAgICAgICAgdGhpcy54ID0gK3ggfHwgMDtcbiAgICAgICAgdGhpcy55ID0gK3kgfHwgMDtcblxuICAgICAgICAvLyBBbGwgZXh0cmEgZmllbGRzIGFkZGVkIHRvIFBvaW50IGFyZSBwcmVmaXhlZCB3aXRoIF9wMnRfXG4gICAgICAgIC8vIHRvIGF2b2lkIGNvbGxpc2lvbnMgaWYgY3VzdG9tIFBvaW50IGNsYXNzIGlzIHVzZWQuXG5cbiAgICAgICAgLy8gVGhlIGVkZ2VzIHRoaXMgcG9pbnQgY29uc3RpdHV0ZXMgYW4gdXBwZXIgZW5kaW5nIHBvaW50XG4gICAgICAgIHRoaXMuX3AydF9lZGdlX2xpc3QgPSBudWxsO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBGb3IgcHJldHR5IHByaW50aW5nIGV4LiA8aT5cIig1OzQyKVwiPC9pPilcbiAgICAgKi9cbiAgICBQb2ludC5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChcIihcIiArIHRoaXMueCArIFwiO1wiICsgdGhpcy55ICsgXCIpXCIpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgY29weSBvZiB0aGlzIFBvaW50IG9iamVjdC5cbiAgICAgKiBAcmV0dXJucyBQb2ludFxuICAgICAqL1xuICAgIFBvaW50LnByb3RvdHlwZS5jbG9uZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gbmV3IFBvaW50KHRoaXMueCwgdGhpcy55KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogU2V0IHRoaXMgUG9pbnQgaW5zdGFuY2UgdG8gdGhlIG9yaWdvLiA8Y29kZT4oMDsgMCk8L2NvZGU+XG4gICAgICovXG4gICAgUG9pbnQucHJvdG90eXBlLnNldF96ZXJvID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMueCA9IDAuMDtcbiAgICAgICAgdGhpcy55ID0gMC4wO1xuICAgICAgICByZXR1cm4gdGhpczsgLy8gZm9yIGNoYWluaW5nXG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgY29vcmRpbmF0ZXMgb2YgdGhpcyBpbnN0YW5jZS5cbiAgICAgKiBAcGFyYW0gICB4ICAgbnVtYmVyLlxuICAgICAqIEBwYXJhbSAgIHkgICBudW1iZXI7XG4gICAgICovXG4gICAgUG9pbnQucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uKHgsIHkpIHtcbiAgICAgICAgdGhpcy54ID0gK3ggfHwgMDtcbiAgICAgICAgdGhpcy55ID0gK3kgfHwgMDtcbiAgICAgICAgcmV0dXJuIHRoaXM7IC8vIGZvciBjaGFpbmluZ1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBOZWdhdGUgdGhpcyBQb2ludCBpbnN0YW5jZS4gKGNvbXBvbmVudC13aXNlKVxuICAgICAqL1xuICAgIFBvaW50LnByb3RvdHlwZS5uZWdhdGUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy54ID0gLXRoaXMueDtcbiAgICAgICAgdGhpcy55ID0gLXRoaXMueTtcbiAgICAgICAgcmV0dXJuIHRoaXM7IC8vIGZvciBjaGFpbmluZ1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBBZGQgYW5vdGhlciBQb2ludCBvYmplY3QgdG8gdGhpcyBpbnN0YW5jZS4gKGNvbXBvbmVudC13aXNlKVxuICAgICAqIEBwYXJhbSAgIG4gICBQb2ludCBvYmplY3QuXG4gICAgICovXG4gICAgUG9pbnQucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKG4pIHtcbiAgICAgICAgdGhpcy54ICs9IG4ueDtcbiAgICAgICAgdGhpcy55ICs9IG4ueTtcbiAgICAgICAgcmV0dXJuIHRoaXM7IC8vIGZvciBjaGFpbmluZ1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBTdWJ0cmFjdCB0aGlzIFBvaW50IGluc3RhbmNlIHdpdGggYW5vdGhlciBwb2ludCBnaXZlbi4gKGNvbXBvbmVudC13aXNlKVxuICAgICAqIEBwYXJhbSAgIG4gICBQb2ludCBvYmplY3QuXG4gICAgICovXG4gICAgUG9pbnQucHJvdG90eXBlLnN1YiA9IGZ1bmN0aW9uKG4pIHtcbiAgICAgICAgdGhpcy54IC09IG4ueDtcbiAgICAgICAgdGhpcy55IC09IG4ueTtcbiAgICAgICAgcmV0dXJuIHRoaXM7IC8vIGZvciBjaGFpbmluZ1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBNdWx0aXBseSB0aGlzIFBvaW50IGluc3RhbmNlIGJ5IGEgc2NhbGFyLiAoY29tcG9uZW50LXdpc2UpXG4gICAgICogQHBhcmFtICAgcyAgIHNjYWxhci5cbiAgICAgKi9cbiAgICBQb2ludC5wcm90b3R5cGUubXVsID0gZnVuY3Rpb24ocykge1xuICAgICAgICB0aGlzLnggKj0gcztcbiAgICAgICAgdGhpcy55ICo9IHM7XG4gICAgICAgIHJldHVybiB0aGlzOyAvLyBmb3IgY2hhaW5pbmdcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogUmV0dXJuIHRoZSBkaXN0YW5jZSBvZiB0aGlzIFBvaW50IGluc3RhbmNlIGZyb20gdGhlIG9yaWdvLlxuICAgICAqL1xuICAgIFBvaW50LnByb3RvdHlwZS5sZW5ndGggPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIE1hdGguc3FydCh0aGlzLnggKiB0aGlzLnggKyB0aGlzLnkgKiB0aGlzLnkpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBOb3JtYWxpemUgdGhpcyBQb2ludCBpbnN0YW5jZSAoYXMgYSB2ZWN0b3IpLlxuICAgICAqIEByZXR1cm4gVGhlIG9yaWdpbmFsIGRpc3RhbmNlIG9mIHRoaXMgaW5zdGFuY2UgZnJvbSB0aGUgb3JpZ28uXG4gICAgICovXG4gICAgUG9pbnQucHJvdG90eXBlLm5vcm1hbGl6ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgbGVuID0gdGhpcy5sZW5ndGgoKTtcbiAgICAgICAgdGhpcy54IC89IGxlbjtcbiAgICAgICAgdGhpcy55IC89IGxlbjtcbiAgICAgICAgcmV0dXJuIGxlbjtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogVGVzdCB0aGlzIFBvaW50IG9iamVjdCB3aXRoIGFub3RoZXIgZm9yIGVxdWFsaXR5LlxuICAgICAqIEBwYXJhbSAgIHAgICBhbnkgXCJQb2ludCBsaWtlXCIgb2JqZWN0IHdpdGgge3gseX0gKGR1Y2sgdHlwaW5nKVxuICAgICAqIEByZXR1cm4gPGNvZGU+VHJ1ZTwvY29kZT4gaWYgPGNvZGU+dGhpcyA9PSBwPC9jb2RlPiwgPGNvZGU+ZmFsc2U8L2NvZGU+IG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBQb2ludC5wcm90b3R5cGUuZXF1YWxzID0gZnVuY3Rpb24ocCkge1xuICAgICAgICByZXR1cm4gdGhpcy54ID09PSBwLnggJiYgdGhpcy55ID09PSBwLnk7XG4gICAgfTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1Qb2ludCAoXCJzdGF0aWNcIiBtZXRob2RzKVxuXG4gICAgLyoqXG4gICAgICogTmVnYXRlIGEgcG9pbnQgY29tcG9uZW50LXdpc2UgYW5kIHJldHVybiB0aGUgcmVzdWx0IGFzIGEgbmV3IFBvaW50IG9iamVjdC5cbiAgICAgKiBAcGFyYW0gICBwICAgUG9pbnQgb2JqZWN0LlxuICAgICAqIEByZXR1cm4gdGhlIHJlc3VsdGluZyBQb2ludCBvYmplY3QuXG4gICAgICovXG4gICAgUG9pbnQubmVnYXRlID0gZnVuY3Rpb24ocCkge1xuICAgICAgICByZXR1cm4gbmV3IFBvaW50KC1wLngsIC1wLnkpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBBZGQgdHdvIHBvaW50cyBjb21wb25lbnQtd2lzZSBhbmQgcmV0dXJuIHRoZSByZXN1bHQgYXMgYSBuZXcgUG9pbnQgb2JqZWN0LlxuICAgICAqIEBwYXJhbSAgIGEgICBQb2ludCBvYmplY3QuXG4gICAgICogQHBhcmFtICAgYiAgIFBvaW50IG9iamVjdC5cbiAgICAgKiBAcmV0dXJuIHRoZSByZXN1bHRpbmcgUG9pbnQgb2JqZWN0LlxuICAgICAqL1xuICAgIFBvaW50LmFkZCA9IGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQb2ludChhLnggKyBiLngsIGEueSArIGIueSk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFN1YnRyYWN0IHR3byBwb2ludHMgY29tcG9uZW50LXdpc2UgYW5kIHJldHVybiB0aGUgcmVzdWx0IGFzIGEgbmV3IFBvaW50IG9iamVjdC5cbiAgICAgKiBAcGFyYW0gICBhICAgUG9pbnQgb2JqZWN0LlxuICAgICAqIEBwYXJhbSAgIGIgICBQb2ludCBvYmplY3QuXG4gICAgICogQHJldHVybiB0aGUgcmVzdWx0aW5nIFBvaW50IG9iamVjdC5cbiAgICAgKi9cbiAgICBQb2ludC5zdWIgPSBmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgIHJldHVybiBuZXcgUG9pbnQoYS54IC0gYi54LCBhLnkgLSBiLnkpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBNdWx0aXBseSBhIHBvaW50IGJ5IGEgc2NhbGFyIGFuZCByZXR1cm4gdGhlIHJlc3VsdCBhcyBhIG5ldyBQb2ludCBvYmplY3QuXG4gICAgICogQHBhcmFtICAgcyAgIHRoZSBzY2FsYXIgKGEgbnVtYmVyKS5cbiAgICAgKiBAcGFyYW0gICBwICAgUG9pbnQgb2JqZWN0LlxuICAgICAqIEByZXR1cm4gdGhlIHJlc3VsdGluZyBQb2ludCBvYmplY3QuXG4gICAgICovXG4gICAgUG9pbnQubXVsID0gZnVuY3Rpb24ocywgcCkge1xuICAgICAgICByZXR1cm4gbmV3IFBvaW50KHMgKiBwLngsIHMgKiBwLnkpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBQZXJmb3JtIHRoZSBjcm9zcyBwcm9kdWN0IG9uIGVpdGhlciB0d28gcG9pbnRzICh0aGlzIHByb2R1Y2VzIGEgc2NhbGFyKVxuICAgICAqIG9yIGEgcG9pbnQgYW5kIGEgc2NhbGFyICh0aGlzIHByb2R1Y2VzIGEgcG9pbnQpLlxuICAgICAqIFRoaXMgZnVuY3Rpb24gcmVxdWlyZXMgdHdvIHBhcmFtZXRlcnMsIGVpdGhlciBtYXkgYmUgYSBQb2ludCBvYmplY3Qgb3IgYVxuICAgICAqIG51bWJlci5cbiAgICAgKiBAcGFyYW0gICBhICAgUG9pbnQgb2JqZWN0IG9yIHNjYWxhci5cbiAgICAgKiBAcGFyYW0gICBiICAgUG9pbnQgb2JqZWN0IG9yIHNjYWxhci5cbiAgICAgKiBAcmV0dXJuICBhICAgUG9pbnQgb2JqZWN0IG9yIGEgbnVtYmVyLCBkZXBlbmRpbmcgb24gdGhlIHBhcmFtZXRlcnMuXG4gICAgICovXG4gICAgUG9pbnQuY3Jvc3MgPSBmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgIGlmICh0eXBlb2YoYSkgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mKGIpID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBhICogYjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBQb2ludCgtYSAqIGIueSwgYSAqIGIueCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mKGIpID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUG9pbnQoYiAqIGEueSwgLWIgKiBhLngpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYS54ICogYi55IC0gYS55ICogYi54O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVwiUG9pbnQtTGlrZVwiXG4gICAgLypcbiAgICAgKiBUaGUgZm9sbG93aW5nIGZ1bmN0aW9ucyBvcGVyYXRlIG9uIFwiUG9pbnRcIiBvciBhbnkgXCJQb2ludCBsaWtlXCIgb2JqZWN0IFxuICAgICAqIHdpdGgge3gseX0gKGR1Y2sgdHlwaW5nKS5cbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogUG9pbnQgcHJldHR5IHByaW50aW5nIGV4LiA8aT5cIig1OzQyKVwiPC9pPilcbiAgICAgKiBAcGFyYW0gICBwICAgYW55IFwiUG9pbnQgbGlrZVwiIG9iamVjdCB3aXRoIHt4LHl9IFxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9XG4gICAgICovXG4gICAgUG9pbnQudG9TdHJpbmcgPSBmdW5jdGlvbihwKSB7XG4gICAgICAgIC8vIFRyeSBhIGN1c3RvbSB0b1N0cmluZyBmaXJzdCwgYW5kIGZhbGxiYWNrIHRvIFBvaW50LnByb3RvdHlwZS50b1N0cmluZyBpZiBub25lXG4gICAgICAgIHZhciBzID0gcC50b1N0cmluZygpO1xuICAgICAgICByZXR1cm4gKHMgPT09ICdbb2JqZWN0IE9iamVjdF0nID8gUG9pbnQucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwocCkgOiBzKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQ29tcGFyZSB0d28gcG9pbnRzIGNvbXBvbmVudC13aXNlLlxuICAgICAqIEBwYXJhbSAgIGEsYiAgIGFueSBcIlBvaW50IGxpa2VcIiBvYmplY3RzIHdpdGgge3gseX0gXG4gICAgICogQHJldHVybiA8Y29kZT4mbHQ7IDA8L2NvZGU+IGlmIDxjb2RlPmEgJmx0OyBiPC9jb2RlPiwgXG4gICAgICogICAgICAgICA8Y29kZT4mZ3Q7IDA8L2NvZGU+IGlmIDxjb2RlPmEgJmd0OyBiPC9jb2RlPiwgXG4gICAgICogICAgICAgICA8Y29kZT4wPC9jb2RlPiBvdGhlcndpc2UuXG4gICAgICovXG4gICAgUG9pbnQuY29tcGFyZSA9IGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgICAgaWYgKGEueSA9PT0gYi55KSB7XG4gICAgICAgICAgICByZXR1cm4gYS54IC0gYi54O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGEueSAtIGIueTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgUG9pbnQuY21wID0gUG9pbnQuY29tcGFyZTsgLy8gYmFja3dhcmQgY29tcGF0aWJpbGl0eVxuXG4gICAgLyoqXG4gICAgICogVGVzdCB0d28gUG9pbnQgb2JqZWN0cyBmb3IgZXF1YWxpdHkuXG4gICAgICogQHBhcmFtICAgYSxiICAgYW55IFwiUG9pbnQgbGlrZVwiIG9iamVjdHMgd2l0aCB7eCx5fSBcbiAgICAgKiBAcmV0dXJuIDxjb2RlPlRydWU8L2NvZGU+IGlmIDxjb2RlPmEgPT0gYjwvY29kZT4sIDxjb2RlPmZhbHNlPC9jb2RlPiBvdGhlcndpc2UuXG4gICAgICovXG4gICAgUG9pbnQuZXF1YWxzID0gZnVuY3Rpb24oYSwgYikge1xuICAgICAgICByZXR1cm4gYS54ID09PSBiLnggJiYgYS55ID09PSBiLnk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFBlZm9ybSB0aGUgZG90IHByb2R1Y3Qgb24gdHdvIHZlY3RvcnMuXG4gICAgICogQHBhcmFtICAgYSxiICAgYW55IFwiUG9pbnQgbGlrZVwiIG9iamVjdHMgd2l0aCB7eCx5fSBcbiAgICAgKiBAcmV0dXJuIFRoZSBkb3QgcHJvZHVjdCAoYXMgYSBudW1iZXIpLlxuICAgICAqL1xuICAgIFBvaW50LmRvdCA9IGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgICAgcmV0dXJuIGEueCAqIGIueCArIGEueSAqIGIueTtcbiAgICB9O1xuXG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1FZGdlXG4gICAgLyoqXG4gICAgICogUmVwcmVzZW50cyBhIHNpbXBsZSBwb2x5Z29uJ3MgZWRnZVxuICAgICAqIEBwYXJhbSB7UG9pbnR9IHAxXG4gICAgICogQHBhcmFtIHtQb2ludH0gcDJcbiAgICAgKi9cbiAgICB2YXIgRWRnZSA9IGZ1bmN0aW9uKHAxLCBwMikge1xuICAgICAgICB0aGlzLnAgPSBwMTtcbiAgICAgICAgdGhpcy5xID0gcDI7XG5cbiAgICAgICAgaWYgKHAxLnkgPiBwMi55KSB7XG4gICAgICAgICAgICB0aGlzLnEgPSBwMTtcbiAgICAgICAgICAgIHRoaXMucCA9IHAyO1xuICAgICAgICB9IGVsc2UgaWYgKHAxLnkgPT09IHAyLnkpIHtcbiAgICAgICAgICAgIGlmIChwMS54ID4gcDIueCkge1xuICAgICAgICAgICAgICAgIHRoaXMucSA9IHAxO1xuICAgICAgICAgICAgICAgIHRoaXMucCA9IHAyO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChwMS54ID09PSBwMi54KSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFBvaW50RXJyb3IoJ3BvbHkydHJpIEludmFsaWQgRWRnZSBjb25zdHJ1Y3RvcjogcmVwZWF0ZWQgcG9pbnRzIScsIFtwMV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCEgdGhpcy5xLl9wMnRfZWRnZV9saXN0KSB7XG4gICAgICAgICAgICB0aGlzLnEuX3AydF9lZGdlX2xpc3QgPSBbXTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnEuX3AydF9lZGdlX2xpc3QucHVzaCh0aGlzKTtcbiAgICB9O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1UcmlhbmdsZVxuICAgIC8qKlxuICAgICAqIFRyaWFuZ2xlIGNsYXNzLjxicj5cbiAgICAgKiBUcmlhbmdsZS1iYXNlZCBkYXRhIHN0cnVjdHVyZXMgYXJlIGtub3duIHRvIGhhdmUgYmV0dGVyIHBlcmZvcm1hbmNlIHRoYW5cbiAgICAgKiBxdWFkLWVkZ2Ugc3RydWN0dXJlcy5cbiAgICAgKiBTZWU6IEouIFNoZXdjaHVrLCBcIlRyaWFuZ2xlOiBFbmdpbmVlcmluZyBhIDJEIFF1YWxpdHkgTWVzaCBHZW5lcmF0b3IgYW5kXG4gICAgICogRGVsYXVuYXkgVHJpYW5ndWxhdG9yXCIsIFwiVHJpYW5ndWxhdGlvbnMgaW4gQ0dBTFwiXG4gICAgICogXG4gICAgICogQHBhcmFtICAgYSxiLGMgICBhbnkgXCJQb2ludCBsaWtlXCIgb2JqZWN0cyB3aXRoIHt4LHl9IChkdWNrIHR5cGluZylcbiAgICAgKi9cbiAgICB2YXIgVHJpYW5nbGUgPSBmdW5jdGlvbihhLCBiLCBjKSB7XG4gICAgICAgIC8vIFRyaWFuZ2xlIHBvaW50c1xuICAgICAgICB0aGlzLnBvaW50c18gPSBbYSwgYiwgY107XG4gICAgICAgIC8vIE5laWdoYm9yIGxpc3RcbiAgICAgICAgdGhpcy5uZWlnaGJvcnNfID0gW251bGwsIG51bGwsIG51bGxdO1xuICAgICAgICAvLyBIYXMgdGhpcyB0cmlhbmdsZSBiZWVuIG1hcmtlZCBhcyBhbiBpbnRlcmlvciB0cmlhbmdsZT9cbiAgICAgICAgdGhpcy5pbnRlcmlvcl8gPSBmYWxzZTtcbiAgICAgICAgLy8gRmxhZ3MgdG8gZGV0ZXJtaW5lIGlmIGFuIGVkZ2UgaXMgYSBDb25zdHJhaW5lZCBlZGdlXG4gICAgICAgIHRoaXMuY29uc3RyYWluZWRfZWRnZSA9IFtmYWxzZSwgZmFsc2UsIGZhbHNlXTtcbiAgICAgICAgLy8gRmxhZ3MgdG8gZGV0ZXJtaW5lIGlmIGFuIGVkZ2UgaXMgYSBEZWxhdW5leSBlZGdlXG4gICAgICAgIHRoaXMuZGVsYXVuYXlfZWRnZSA9IFtmYWxzZSwgZmFsc2UsIGZhbHNlXTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogRm9yIHByZXR0eSBwcmludGluZyBleC4gPGk+XCJbKDU7NDIpKDEwOzIwKSgyMTszMCldXCI8L2k+KVxuICAgICAqL1xuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgcDJzID0gUG9pbnQudG9TdHJpbmc7XG4gICAgICAgIHJldHVybiAoXCJbXCIgKyBwMnModGhpcy5wb2ludHNfWzBdKSArIHAycyh0aGlzLnBvaW50c19bMV0pICsgcDJzKHRoaXMucG9pbnRzX1syXSkgKyBcIl1cIik7XG4gICAgfTtcblxuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5nZXRQb2ludCA9IGZ1bmN0aW9uKGluZGV4KSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBvaW50c19baW5kZXhdO1xuICAgIH07XG4gICAgLy8gZm9yIGJhY2t3YXJkIGNvbXBhdGliaWxpdHlcbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuR2V0UG9pbnQgPSBUcmlhbmdsZS5wcm90b3R5cGUuZ2V0UG9pbnQ7XG5cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuZ2V0TmVpZ2hib3IgPSBmdW5jdGlvbihpbmRleCkge1xuICAgICAgICByZXR1cm4gdGhpcy5uZWlnaGJvcnNfW2luZGV4XTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogVGVzdCBpZiB0aGlzIFRyaWFuZ2xlIGNvbnRhaW5zIHRoZSBQb2ludCBvYmplY3QgZ2l2ZW4gYXMgcGFyYW1ldGVycyBhcyBpdHNcbiAgICAgKiB2ZXJ0aWNlcy4gT25seSBwb2ludCByZWZlcmVuY2VzIGFyZSBjb21wYXJlZCwgbm90IHZhbHVlcy5cbiAgICAgKiBAcmV0dXJuIDxjb2RlPlRydWU8L2NvZGU+IGlmIHRoZSBQb2ludCBvYmplY3QgaXMgb2YgdGhlIFRyaWFuZ2xlJ3MgdmVydGljZXMsXG4gICAgICogICAgICAgICA8Y29kZT5mYWxzZTwvY29kZT4gb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5jb250YWluc1BvaW50ID0gZnVuY3Rpb24ocG9pbnQpIHtcbiAgICAgICAgdmFyIHBvaW50cyA9IHRoaXMucG9pbnRzXztcbiAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcbiAgICAgICAgcmV0dXJuIChwb2ludCA9PT0gcG9pbnRzWzBdIHx8IHBvaW50ID09PSBwb2ludHNbMV0gfHwgcG9pbnQgPT09IHBvaW50c1syXSk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFRlc3QgaWYgdGhpcyBUcmlhbmdsZSBjb250YWlucyB0aGUgRWRnZSBvYmplY3QgZ2l2ZW4gYXMgcGFyYW1ldGVyIGFzIGl0c1xuICAgICAqIGJvdW5kaW5nIGVkZ2VzLiBPbmx5IHBvaW50IHJlZmVyZW5jZXMgYXJlIGNvbXBhcmVkLCBub3QgdmFsdWVzLlxuICAgICAqIEByZXR1cm4gPGNvZGU+VHJ1ZTwvY29kZT4gaWYgdGhlIEVkZ2Ugb2JqZWN0IGlzIG9mIHRoZSBUcmlhbmdsZSdzIGJvdW5kaW5nXG4gICAgICogICAgICAgICBlZGdlcywgPGNvZGU+ZmFsc2U8L2NvZGU+IG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuY29udGFpbnNFZGdlID0gZnVuY3Rpb24oZWRnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5jb250YWluc1BvaW50KGVkZ2UucCkgJiYgdGhpcy5jb250YWluc1BvaW50KGVkZ2UucSk7XG4gICAgfTtcbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuY29udGFpbnNQb2ludHMgPSBmdW5jdGlvbihwMSwgcDIpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29udGFpbnNQb2ludChwMSkgJiYgdGhpcy5jb250YWluc1BvaW50KHAyKTtcbiAgICB9O1xuXG5cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuaXNJbnRlcmlvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5pbnRlcmlvcl87XG4gICAgfTtcbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuc2V0SW50ZXJpb3IgPSBmdW5jdGlvbihpbnRlcmlvcikge1xuICAgICAgICB0aGlzLmludGVyaW9yXyA9IGludGVyaW9yO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogVXBkYXRlIG5laWdoYm9yIHBvaW50ZXJzLlxuICAgICAqIEBwYXJhbSB7UG9pbnR9IHAxIFBvaW50IG9iamVjdC5cbiAgICAgKiBAcGFyYW0ge1BvaW50fSBwMiBQb2ludCBvYmplY3QuXG4gICAgICogQHBhcmFtIHtUcmlhbmdsZX0gdCBUcmlhbmdsZSBvYmplY3QuXG4gICAgICovXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLm1hcmtOZWlnaGJvclBvaW50ZXJzID0gZnVuY3Rpb24ocDEsIHAyLCB0KSB7XG4gICAgICAgIHZhciBwb2ludHMgPSB0aGlzLnBvaW50c187XG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXG4gICAgICAgIGlmICgocDEgPT09IHBvaW50c1syXSAmJiBwMiA9PT0gcG9pbnRzWzFdKSB8fCAocDEgPT09IHBvaW50c1sxXSAmJiBwMiA9PT0gcG9pbnRzWzJdKSkge1xuICAgICAgICAgICAgdGhpcy5uZWlnaGJvcnNfWzBdID0gdDtcbiAgICAgICAgfSBlbHNlIGlmICgocDEgPT09IHBvaW50c1swXSAmJiBwMiA9PT0gcG9pbnRzWzJdKSB8fCAocDEgPT09IHBvaW50c1syXSAmJiBwMiA9PT0gcG9pbnRzWzBdKSkge1xuICAgICAgICAgICAgdGhpcy5uZWlnaGJvcnNfWzFdID0gdDtcbiAgICAgICAgfSBlbHNlIGlmICgocDEgPT09IHBvaW50c1swXSAmJiBwMiA9PT0gcG9pbnRzWzFdKSB8fCAocDEgPT09IHBvaW50c1sxXSAmJiBwMiA9PT0gcG9pbnRzWzBdKSkge1xuICAgICAgICAgICAgdGhpcy5uZWlnaGJvcnNfWzJdID0gdDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigncG9seTJ0cmkgSW52YWxpZCBUcmlhbmdsZS5tYXJrTmVpZ2hib3JQb2ludGVycygpIGNhbGwnKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBFeGhhdXN0aXZlIHNlYXJjaCB0byB1cGRhdGUgbmVpZ2hib3IgcG9pbnRlcnNcbiAgICAgKiBAcGFyYW0ge1RyaWFuZ2xlfSB0XG4gICAgICovXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLm1hcmtOZWlnaGJvciA9IGZ1bmN0aW9uKHQpIHtcbiAgICAgICAgdmFyIHBvaW50cyA9IHRoaXMucG9pbnRzXztcbiAgICAgICAgaWYgKHQuY29udGFpbnNQb2ludHMocG9pbnRzWzFdLCBwb2ludHNbMl0pKSB7XG4gICAgICAgICAgICB0aGlzLm5laWdoYm9yc19bMF0gPSB0O1xuICAgICAgICAgICAgdC5tYXJrTmVpZ2hib3JQb2ludGVycyhwb2ludHNbMV0sIHBvaW50c1syXSwgdGhpcyk7XG4gICAgICAgIH0gZWxzZSBpZiAodC5jb250YWluc1BvaW50cyhwb2ludHNbMF0sIHBvaW50c1syXSkpIHtcbiAgICAgICAgICAgIHRoaXMubmVpZ2hib3JzX1sxXSA9IHQ7XG4gICAgICAgICAgICB0Lm1hcmtOZWlnaGJvclBvaW50ZXJzKHBvaW50c1swXSwgcG9pbnRzWzJdLCB0aGlzKTtcbiAgICAgICAgfSBlbHNlIGlmICh0LmNvbnRhaW5zUG9pbnRzKHBvaW50c1swXSwgcG9pbnRzWzFdKSkge1xuICAgICAgICAgICAgdGhpcy5uZWlnaGJvcnNfWzJdID0gdDtcbiAgICAgICAgICAgIHQubWFya05laWdoYm9yUG9pbnRlcnMocG9pbnRzWzBdLCBwb2ludHNbMV0sIHRoaXMpO1xuICAgICAgICB9XG4gICAgfTtcblxuXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLmNsZWFyTmVpZ2JvcnMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5uZWlnaGJvcnNfWzBdID0gbnVsbDtcbiAgICAgICAgdGhpcy5uZWlnaGJvcnNfWzFdID0gbnVsbDtcbiAgICAgICAgdGhpcy5uZWlnaGJvcnNfWzJdID0gbnVsbDtcbiAgICB9O1xuXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLmNsZWFyRGVsdW5heUVkZ2VzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuZGVsYXVuYXlfZWRnZVswXSA9IGZhbHNlO1xuICAgICAgICB0aGlzLmRlbGF1bmF5X2VkZ2VbMV0gPSBmYWxzZTtcbiAgICAgICAgdGhpcy5kZWxhdW5heV9lZGdlWzJdID0gZmFsc2U7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIHBvaW50IGNsb2Nrd2lzZSB0byB0aGUgZ2l2ZW4gcG9pbnQuXG4gICAgICovXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLnBvaW50Q1cgPSBmdW5jdGlvbihwKSB7XG4gICAgICAgIHZhciBwb2ludHMgPSB0aGlzLnBvaW50c187XG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXG4gICAgICAgIGlmIChwID09PSBwb2ludHNbMF0pIHtcbiAgICAgICAgICAgIHJldHVybiBwb2ludHNbMl07XG4gICAgICAgIH0gZWxzZSBpZiAocCA9PT0gcG9pbnRzWzFdKSB7XG4gICAgICAgICAgICByZXR1cm4gcG9pbnRzWzBdO1xuICAgICAgICB9IGVsc2UgaWYgKHAgPT09IHBvaW50c1syXSkge1xuICAgICAgICAgICAgcmV0dXJuIHBvaW50c1sxXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIHBvaW50IGNvdW50ZXItY2xvY2t3aXNlIHRvIHRoZSBnaXZlbiBwb2ludC5cbiAgICAgKi9cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUucG9pbnRDQ1cgPSBmdW5jdGlvbihwKSB7XG4gICAgICAgIHZhciBwb2ludHMgPSB0aGlzLnBvaW50c187XG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXG4gICAgICAgIGlmIChwID09PSBwb2ludHNbMF0pIHtcbiAgICAgICAgICAgIHJldHVybiBwb2ludHNbMV07XG4gICAgICAgIH0gZWxzZSBpZiAocCA9PT0gcG9pbnRzWzFdKSB7XG4gICAgICAgICAgICByZXR1cm4gcG9pbnRzWzJdO1xuICAgICAgICB9IGVsc2UgaWYgKHAgPT09IHBvaW50c1syXSkge1xuICAgICAgICAgICAgcmV0dXJuIHBvaW50c1swXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIG5laWdoYm9yIGNsb2Nrd2lzZSB0byBnaXZlbiBwb2ludC5cbiAgICAgKi9cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUubmVpZ2hib3JDVyA9IGZ1bmN0aW9uKHApIHtcbiAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcbiAgICAgICAgaWYgKHAgPT09IHRoaXMucG9pbnRzX1swXSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubmVpZ2hib3JzX1sxXTtcbiAgICAgICAgfSBlbHNlIGlmIChwID09PSB0aGlzLnBvaW50c19bMV0pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm5laWdoYm9yc19bMl07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5uZWlnaGJvcnNfWzBdO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIG5laWdoYm9yIGNvdW50ZXItY2xvY2t3aXNlIHRvIGdpdmVuIHBvaW50LlxuICAgICAqL1xuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5uZWlnaGJvckNDVyA9IGZ1bmN0aW9uKHApIHtcbiAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcbiAgICAgICAgaWYgKHAgPT09IHRoaXMucG9pbnRzX1swXSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubmVpZ2hib3JzX1syXTtcbiAgICAgICAgfSBlbHNlIGlmIChwID09PSB0aGlzLnBvaW50c19bMV0pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm5laWdoYm9yc19bMF07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5uZWlnaGJvcnNfWzFdO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5nZXRDb25zdHJhaW5lZEVkZ2VDVyA9IGZ1bmN0aW9uKHApIHtcbiAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcbiAgICAgICAgaWYgKHAgPT09IHRoaXMucG9pbnRzX1swXSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29uc3RyYWluZWRfZWRnZVsxXTtcbiAgICAgICAgfSBlbHNlIGlmIChwID09PSB0aGlzLnBvaW50c19bMV0pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbMl07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jb25zdHJhaW5lZF9lZGdlWzBdO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5nZXRDb25zdHJhaW5lZEVkZ2VDQ1cgPSBmdW5jdGlvbihwKSB7XG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXG4gICAgICAgIGlmIChwID09PSB0aGlzLnBvaW50c19bMF0pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbMl07XG4gICAgICAgIH0gZWxzZSBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzFdKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jb25zdHJhaW5lZF9lZGdlWzBdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29uc3RyYWluZWRfZWRnZVsxXTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuc2V0Q29uc3RyYWluZWRFZGdlQ1cgPSBmdW5jdGlvbihwLCBjZSkge1xuICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlc1xuICAgICAgICBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzBdKSB7XG4gICAgICAgICAgICB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbMV0gPSBjZTtcbiAgICAgICAgfSBlbHNlIGlmIChwID09PSB0aGlzLnBvaW50c19bMV0pIHtcbiAgICAgICAgICAgIHRoaXMuY29uc3RyYWluZWRfZWRnZVsyXSA9IGNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5jb25zdHJhaW5lZF9lZGdlWzBdID0gY2U7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLnNldENvbnN0cmFpbmVkRWRnZUNDVyA9IGZ1bmN0aW9uKHAsIGNlKSB7XG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXG4gICAgICAgIGlmIChwID09PSB0aGlzLnBvaW50c19bMF0pIHtcbiAgICAgICAgICAgIHRoaXMuY29uc3RyYWluZWRfZWRnZVsyXSA9IGNlO1xuICAgICAgICB9IGVsc2UgaWYgKHAgPT09IHRoaXMucG9pbnRzX1sxXSkge1xuICAgICAgICAgICAgdGhpcy5jb25zdHJhaW5lZF9lZGdlWzBdID0gY2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbMV0gPSBjZTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuZ2V0RGVsYXVuYXlFZGdlQ1cgPSBmdW5jdGlvbihwKSB7XG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXG4gICAgICAgIGlmIChwID09PSB0aGlzLnBvaW50c19bMF0pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmRlbGF1bmF5X2VkZ2VbMV07XG4gICAgICAgIH0gZWxzZSBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzFdKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5kZWxhdW5heV9lZGdlWzJdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGVsYXVuYXlfZWRnZVswXTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuZ2V0RGVsYXVuYXlFZGdlQ0NXID0gZnVuY3Rpb24ocCkge1xuICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlc1xuICAgICAgICBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzBdKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5kZWxhdW5heV9lZGdlWzJdO1xuICAgICAgICB9IGVsc2UgaWYgKHAgPT09IHRoaXMucG9pbnRzX1sxXSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGVsYXVuYXlfZWRnZVswXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmRlbGF1bmF5X2VkZ2VbMV07XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLnNldERlbGF1bmF5RWRnZUNXID0gZnVuY3Rpb24ocCwgZSkge1xuICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlc1xuICAgICAgICBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzBdKSB7XG4gICAgICAgICAgICB0aGlzLmRlbGF1bmF5X2VkZ2VbMV0gPSBlO1xuICAgICAgICB9IGVsc2UgaWYgKHAgPT09IHRoaXMucG9pbnRzX1sxXSkge1xuICAgICAgICAgICAgdGhpcy5kZWxhdW5heV9lZGdlWzJdID0gZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZGVsYXVuYXlfZWRnZVswXSA9IGU7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLnNldERlbGF1bmF5RWRnZUNDVyA9IGZ1bmN0aW9uKHAsIGUpIHtcbiAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcbiAgICAgICAgaWYgKHAgPT09IHRoaXMucG9pbnRzX1swXSkge1xuICAgICAgICAgICAgdGhpcy5kZWxhdW5heV9lZGdlWzJdID0gZTtcbiAgICAgICAgfSBlbHNlIGlmIChwID09PSB0aGlzLnBvaW50c19bMV0pIHtcbiAgICAgICAgICAgIHRoaXMuZGVsYXVuYXlfZWRnZVswXSA9IGU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmRlbGF1bmF5X2VkZ2VbMV0gPSBlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBuZWlnaGJvciBhY3Jvc3MgdG8gZ2l2ZW4gcG9pbnQuXG4gICAgICovXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLm5laWdoYm9yQWNyb3NzID0gZnVuY3Rpb24ocCkge1xuICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlc1xuICAgICAgICBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzBdKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5uZWlnaGJvcnNfWzBdO1xuICAgICAgICB9IGVsc2UgaWYgKHAgPT09IHRoaXMucG9pbnRzX1sxXSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubmVpZ2hib3JzX1sxXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm5laWdoYm9yc19bMl07XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLm9wcG9zaXRlUG9pbnQgPSBmdW5jdGlvbih0LCBwKSB7XG4gICAgICAgIHZhciBjdyA9IHQucG9pbnRDVyhwKTtcbiAgICAgICAgcmV0dXJuIHRoaXMucG9pbnRDVyhjdyk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIExlZ2FsaXplIHRyaWFuZ2xlIGJ5IHJvdGF0aW5nIGNsb2Nrd2lzZSBhcm91bmQgb1BvaW50XG4gICAgICogQHBhcmFtIHtQb2ludH0gb3BvaW50XG4gICAgICogQHBhcmFtIHtQb2ludH0gbnBvaW50XG4gICAgICovXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLmxlZ2FsaXplID0gZnVuY3Rpb24ob3BvaW50LCBucG9pbnQpIHtcbiAgICAgICAgdmFyIHBvaW50cyA9IHRoaXMucG9pbnRzXztcbiAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcbiAgICAgICAgaWYgKG9wb2ludCA9PT0gcG9pbnRzWzBdKSB7XG4gICAgICAgICAgICBwb2ludHNbMV0gPSBwb2ludHNbMF07XG4gICAgICAgICAgICBwb2ludHNbMF0gPSBwb2ludHNbMl07XG4gICAgICAgICAgICBwb2ludHNbMl0gPSBucG9pbnQ7XG4gICAgICAgIH0gZWxzZSBpZiAob3BvaW50ID09PSBwb2ludHNbMV0pIHtcbiAgICAgICAgICAgIHBvaW50c1syXSA9IHBvaW50c1sxXTtcbiAgICAgICAgICAgIHBvaW50c1sxXSA9IHBvaW50c1swXTtcbiAgICAgICAgICAgIHBvaW50c1swXSA9IG5wb2ludDtcbiAgICAgICAgfSBlbHNlIGlmIChvcG9pbnQgPT09IHBvaW50c1syXSkge1xuICAgICAgICAgICAgcG9pbnRzWzBdID0gcG9pbnRzWzJdO1xuICAgICAgICAgICAgcG9pbnRzWzJdID0gcG9pbnRzWzFdO1xuICAgICAgICAgICAgcG9pbnRzWzFdID0gbnBvaW50O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdwb2x5MnRyaSBJbnZhbGlkIFRyaWFuZ2xlLmxlZ2FsaXplKCkgY2FsbCcpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIGluZGV4IG9mIGEgcG9pbnQgaW4gdGhlIHRyaWFuZ2xlLiBcbiAgICAgKiBUaGUgcG9pbnQgKm11c3QqIGJlIGEgcmVmZXJlbmNlIHRvIG9uZSBvZiB0aGUgdHJpYW5nbGUncyB2ZXJ0aWNlcy5cbiAgICAgKiBAcGFyYW0ge1BvaW50fSBwIFBvaW50IG9iamVjdFxuICAgICAqIEByZXR1cm5zIHtOdW1iZXJ9IGluZGV4IDAsIDEgb3IgMlxuICAgICAqL1xuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5pbmRleCA9IGZ1bmN0aW9uKHApIHtcbiAgICAgICAgdmFyIHBvaW50cyA9IHRoaXMucG9pbnRzXztcbiAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcbiAgICAgICAgaWYgKHAgPT09IHBvaW50c1swXSkge1xuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIH0gZWxzZSBpZiAocCA9PT0gcG9pbnRzWzFdKSB7XG4gICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfSBlbHNlIGlmIChwID09PSBwb2ludHNbMl0pIHtcbiAgICAgICAgICAgIHJldHVybiAyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdwb2x5MnRyaSBJbnZhbGlkIFRyaWFuZ2xlLmluZGV4KCkgY2FsbCcpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5lZGdlSW5kZXggPSBmdW5jdGlvbihwMSwgcDIpIHtcbiAgICAgICAgdmFyIHBvaW50cyA9IHRoaXMucG9pbnRzXztcbiAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcbiAgICAgICAgaWYgKHAxID09PSBwb2ludHNbMF0pIHtcbiAgICAgICAgICAgIGlmIChwMiA9PT0gcG9pbnRzWzFdKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIDI7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHAyID09PSBwb2ludHNbMl0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChwMSA9PT0gcG9pbnRzWzFdKSB7XG4gICAgICAgICAgICBpZiAocDIgPT09IHBvaW50c1syXSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChwMiA9PT0gcG9pbnRzWzBdKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIDI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAocDEgPT09IHBvaW50c1syXSkge1xuICAgICAgICAgICAgaWYgKHAyID09PSBwb2ludHNbMF0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocDIgPT09IHBvaW50c1sxXSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiAtMTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogTWFyayBhbiBlZGdlIG9mIHRoaXMgdHJpYW5nbGUgYXMgY29uc3RyYWluZWQuPGJyPlxuICAgICAqIFRoaXMgbWV0aG9kIHRha2VzIGVpdGhlciAxIHBhcmFtZXRlciAoYW4gZWRnZSBpbmRleCBvciBhbiBFZGdlIGluc3RhbmNlKSBvclxuICAgICAqIDIgcGFyYW1ldGVycyAodHdvIFBvaW50IGluc3RhbmNlcyBkZWZpbmluZyB0aGUgZWRnZSBvZiB0aGUgdHJpYW5nbGUpLlxuICAgICAqL1xuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5tYXJrQ29uc3RyYWluZWRFZGdlQnlJbmRleCA9IGZ1bmN0aW9uKGluZGV4KSB7XG4gICAgICAgIHRoaXMuY29uc3RyYWluZWRfZWRnZVtpbmRleF0gPSB0cnVlO1xuICAgIH07XG4gICAgVHJpYW5nbGUucHJvdG90eXBlLm1hcmtDb25zdHJhaW5lZEVkZ2VCeUVkZ2UgPSBmdW5jdGlvbihlZGdlKSB7XG4gICAgICAgIHRoaXMubWFya0NvbnN0cmFpbmVkRWRnZUJ5UG9pbnRzKGVkZ2UucCwgZWRnZS5xKTtcbiAgICB9O1xuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5tYXJrQ29uc3RyYWluZWRFZGdlQnlQb2ludHMgPSBmdW5jdGlvbihwLCBxKSB7XG4gICAgICAgIHZhciBwb2ludHMgPSB0aGlzLnBvaW50c187XG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzICAgICAgICBcbiAgICAgICAgaWYgKChxID09PSBwb2ludHNbMF0gJiYgcCA9PT0gcG9pbnRzWzFdKSB8fCAocSA9PT0gcG9pbnRzWzFdICYmIHAgPT09IHBvaW50c1swXSkpIHtcbiAgICAgICAgICAgIHRoaXMuY29uc3RyYWluZWRfZWRnZVsyXSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSBpZiAoKHEgPT09IHBvaW50c1swXSAmJiBwID09PSBwb2ludHNbMl0pIHx8IChxID09PSBwb2ludHNbMl0gJiYgcCA9PT0gcG9pbnRzWzBdKSkge1xuICAgICAgICAgICAgdGhpcy5jb25zdHJhaW5lZF9lZGdlWzFdID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIGlmICgocSA9PT0gcG9pbnRzWzFdICYmIHAgPT09IHBvaW50c1syXSkgfHwgKHEgPT09IHBvaW50c1syXSAmJiBwID09PSBwb2ludHNbMV0pKSB7XG4gICAgICAgICAgICB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbMF0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgfTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tdXRpbHNcbiAgICB2YXIgUElfM2RpdjQgPSAzICogTWF0aC5QSSAvIDQ7XG4gICAgdmFyIFBJXzIgPSBNYXRoLlBJIC8gMjtcbiAgICB2YXIgRVBTSUxPTiA9IDFlLTEyO1xuXG4gICAgLyogXG4gICAgICogSW5pdGFsIHRyaWFuZ2xlIGZhY3Rvciwgc2VlZCB0cmlhbmdsZSB3aWxsIGV4dGVuZCAzMCUgb2ZcbiAgICAgKiBQb2ludFNldCB3aWR0aCB0byBib3RoIGxlZnQgYW5kIHJpZ2h0LlxuICAgICAqL1xuICAgIHZhciBrQWxwaGEgPSAwLjM7XG5cbiAgICB2YXIgT3JpZW50YXRpb24gPSB7XG4gICAgICAgIFwiQ1dcIjogMSxcbiAgICAgICAgXCJDQ1dcIjogLTEsXG4gICAgICAgIFwiQ09MTElORUFSXCI6IDBcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogRm9ydW1sYSB0byBjYWxjdWxhdGUgc2lnbmVkIGFyZWE8YnI+XG4gICAgICogUG9zaXRpdmUgaWYgQ0NXPGJyPlxuICAgICAqIE5lZ2F0aXZlIGlmIENXPGJyPlxuICAgICAqIDAgaWYgY29sbGluZWFyPGJyPlxuICAgICAqIDxwcmU+XG4gICAgICogQVtQMSxQMixQM10gID0gICh4MSp5MiAtIHkxKngyKSArICh4Mip5MyAtIHkyKngzKSArICh4Myp5MSAtIHkzKngxKVxuICAgICAqICAgICAgICAgICAgICA9ICAoeDEteDMpKih5Mi15MykgLSAoeTEteTMpKih4Mi14MylcbiAgICAgKiA8L3ByZT5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBvcmllbnQyZChwYSwgcGIsIHBjKSB7XG4gICAgICAgIHZhciBkZXRsZWZ0ID0gKHBhLnggLSBwYy54KSAqIChwYi55IC0gcGMueSk7XG4gICAgICAgIHZhciBkZXRyaWdodCA9IChwYS55IC0gcGMueSkgKiAocGIueCAtIHBjLngpO1xuICAgICAgICB2YXIgdmFsID0gZGV0bGVmdCAtIGRldHJpZ2h0O1xuICAgICAgICBpZiAodmFsID4gLShFUFNJTE9OKSAmJiB2YWwgPCAoRVBTSUxPTikpIHtcbiAgICAgICAgICAgIHJldHVybiBPcmllbnRhdGlvbi5DT0xMSU5FQVI7XG4gICAgICAgIH0gZWxzZSBpZiAodmFsID4gMCkge1xuICAgICAgICAgICAgcmV0dXJuIE9yaWVudGF0aW9uLkNDVztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBPcmllbnRhdGlvbi5DVztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGluU2NhbkFyZWEocGEsIHBiLCBwYywgcGQpIHtcbiAgICAgICAgdmFyIHBkeCA9IHBkLng7XG4gICAgICAgIHZhciBwZHkgPSBwZC55O1xuICAgICAgICB2YXIgYWR4ID0gcGEueCAtIHBkeDtcbiAgICAgICAgdmFyIGFkeSA9IHBhLnkgLSBwZHk7XG4gICAgICAgIHZhciBiZHggPSBwYi54IC0gcGR4O1xuICAgICAgICB2YXIgYmR5ID0gcGIueSAtIHBkeTtcblxuICAgICAgICB2YXIgYWR4YmR5ID0gYWR4ICogYmR5O1xuICAgICAgICB2YXIgYmR4YWR5ID0gYmR4ICogYWR5O1xuICAgICAgICB2YXIgb2FiZCA9IGFkeGJkeSAtIGJkeGFkeTtcblxuICAgICAgICBpZiAob2FiZCA8PSAoRVBTSUxPTikpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBjZHggPSBwYy54IC0gcGR4O1xuICAgICAgICB2YXIgY2R5ID0gcGMueSAtIHBkeTtcblxuICAgICAgICB2YXIgY2R4YWR5ID0gY2R4ICogYWR5O1xuICAgICAgICB2YXIgYWR4Y2R5ID0gYWR4ICogY2R5O1xuICAgICAgICB2YXIgb2NhZCA9IGNkeGFkeSAtIGFkeGNkeTtcblxuICAgICAgICBpZiAob2NhZCA8PSAoRVBTSUxPTikpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tQWR2YW5jaW5nRnJvbnRcbiAgICAvKipcbiAgICAgKiBBZHZhbmNpbmcgZnJvbnQgbm9kZVxuICAgICAqIEBwYXJhbSB7UG9pbnR9IHAgYW55IFwiUG9pbnQgbGlrZVwiIG9iamVjdCB3aXRoIHt4LHl9IChkdWNrIHR5cGluZylcbiAgICAgKiBAcGFyYW0ge1RyaWFuZ2xlfSB0IHRyaWFuZ2xlIChvcHRpb25uYWwpXG4gICAgICovXG4gICAgdmFyIE5vZGUgPSBmdW5jdGlvbihwLCB0KSB7XG4gICAgICAgIHRoaXMucG9pbnQgPSBwO1xuICAgICAgICB0aGlzLnRyaWFuZ2xlID0gdCB8fCBudWxsO1xuXG4gICAgICAgIHRoaXMubmV4dCA9IG51bGw7IC8vIE5vZGVcbiAgICAgICAgdGhpcy5wcmV2ID0gbnVsbDsgLy8gTm9kZVxuXG4gICAgICAgIHRoaXMudmFsdWUgPSBwLng7XG4gICAgfTtcblxuICAgIHZhciBBZHZhbmNpbmdGcm9udCA9IGZ1bmN0aW9uKGhlYWQsIHRhaWwpIHtcbiAgICAgICAgdGhpcy5oZWFkXyA9IGhlYWQ7IC8vIE5vZGVcbiAgICAgICAgdGhpcy50YWlsXyA9IHRhaWw7IC8vIE5vZGVcbiAgICAgICAgdGhpcy5zZWFyY2hfbm9kZV8gPSBoZWFkOyAvLyBOb2RlXG4gICAgfTtcblxuICAgIEFkdmFuY2luZ0Zyb250LnByb3RvdHlwZS5oZWFkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmhlYWRfO1xuICAgIH07XG5cbiAgICBBZHZhbmNpbmdGcm9udC5wcm90b3R5cGUuc2V0SGVhZCA9IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICAgICAgdGhpcy5oZWFkXyA9IG5vZGU7XG4gICAgfTtcblxuICAgIEFkdmFuY2luZ0Zyb250LnByb3RvdHlwZS50YWlsID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRhaWxfO1xuICAgIH07XG5cbiAgICBBZHZhbmNpbmdGcm9udC5wcm90b3R5cGUuc2V0VGFpbCA9IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICAgICAgdGhpcy50YWlsXyA9IG5vZGU7XG4gICAgfTtcblxuICAgIEFkdmFuY2luZ0Zyb250LnByb3RvdHlwZS5zZWFyY2ggPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2VhcmNoX25vZGVfO1xuICAgIH07XG5cbiAgICBBZHZhbmNpbmdGcm9udC5wcm90b3R5cGUuc2V0U2VhcmNoID0gZnVuY3Rpb24obm9kZSkge1xuICAgICAgICB0aGlzLnNlYXJjaF9ub2RlXyA9IG5vZGU7XG4gICAgfTtcblxuICAgIEFkdmFuY2luZ0Zyb250LnByb3RvdHlwZS5maW5kU2VhcmNoTm9kZSA9IGZ1bmN0aW9uKC8qeCovKSB7XG4gICAgICAgIC8vIFRPRE86IGltcGxlbWVudCBCU1QgaW5kZXhcbiAgICAgICAgcmV0dXJuIHRoaXMuc2VhcmNoX25vZGVfO1xuICAgIH07XG5cbiAgICBBZHZhbmNpbmdGcm9udC5wcm90b3R5cGUubG9jYXRlTm9kZSA9IGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgdmFyIG5vZGUgPSB0aGlzLnNlYXJjaF9ub2RlXztcblxuICAgICAgICAvKiBqc2hpbnQgYm9zczp0cnVlICovXG4gICAgICAgIGlmICh4IDwgbm9kZS52YWx1ZSkge1xuICAgICAgICAgICAgd2hpbGUgKG5vZGUgPSBub2RlLnByZXYpIHtcbiAgICAgICAgICAgICAgICBpZiAoeCA+PSBub2RlLnZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2VhcmNoX25vZGVfID0gbm9kZTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgd2hpbGUgKG5vZGUgPSBub2RlLm5leHQpIHtcbiAgICAgICAgICAgICAgICBpZiAoeCA8IG5vZGUudmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZWFyY2hfbm9kZV8gPSBub2RlLnByZXY7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBub2RlLnByZXY7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH07XG5cbiAgICBBZHZhbmNpbmdGcm9udC5wcm90b3R5cGUubG9jYXRlUG9pbnQgPSBmdW5jdGlvbihwb2ludCkge1xuICAgICAgICB2YXIgcHggPSBwb2ludC54O1xuICAgICAgICB2YXIgbm9kZSA9IHRoaXMuZmluZFNlYXJjaE5vZGUocHgpO1xuICAgICAgICB2YXIgbnggPSBub2RlLnBvaW50Lng7XG5cbiAgICAgICAgaWYgKHB4ID09PSBueCkge1xuICAgICAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcbiAgICAgICAgICAgIGlmIChwb2ludCAhPT0gbm9kZS5wb2ludCkge1xuICAgICAgICAgICAgICAgIC8vIFdlIG1pZ2h0IGhhdmUgdHdvIG5vZGVzIHdpdGggc2FtZSB4IHZhbHVlIGZvciBhIHNob3J0IHRpbWVcbiAgICAgICAgICAgICAgICBpZiAocG9pbnQgPT09IG5vZGUucHJldi5wb2ludCkge1xuICAgICAgICAgICAgICAgICAgICBub2RlID0gbm9kZS5wcmV2O1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAocG9pbnQgPT09IG5vZGUubmV4dC5wb2ludCkge1xuICAgICAgICAgICAgICAgICAgICBub2RlID0gbm9kZS5uZXh0O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigncG9seTJ0cmkgSW52YWxpZCBBZHZhbmNpbmdGcm9udC5sb2NhdGVQb2ludCgpIGNhbGwnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAocHggPCBueCkge1xuICAgICAgICAgICAgLyoganNoaW50IGJvc3M6dHJ1ZSAqL1xuICAgICAgICAgICAgd2hpbGUgKG5vZGUgPSBub2RlLnByZXYpIHtcbiAgICAgICAgICAgICAgICBpZiAocG9pbnQgPT09IG5vZGUucG9pbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgd2hpbGUgKG5vZGUgPSBub2RlLm5leHQpIHtcbiAgICAgICAgICAgICAgICBpZiAocG9pbnQgPT09IG5vZGUucG9pbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5vZGUpIHtcbiAgICAgICAgICAgIHRoaXMuc2VhcmNoX25vZGVfID0gbm9kZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbm9kZTtcbiAgICB9O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1CYXNpblxuICAgIHZhciBCYXNpbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmxlZnRfbm9kZSA9IG51bGw7IC8vIE5vZGVcbiAgICAgICAgdGhpcy5ib3R0b21fbm9kZSA9IG51bGw7IC8vIE5vZGVcbiAgICAgICAgdGhpcy5yaWdodF9ub2RlID0gbnVsbDsgLy8gTm9kZVxuICAgICAgICB0aGlzLndpZHRoID0gMC4wOyAvLyBudW1iZXJcbiAgICAgICAgdGhpcy5sZWZ0X2hpZ2hlc3QgPSBmYWxzZTtcbiAgICB9O1xuXG4gICAgQmFzaW4ucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMubGVmdF9ub2RlID0gbnVsbDtcbiAgICAgICAgdGhpcy5ib3R0b21fbm9kZSA9IG51bGw7XG4gICAgICAgIHRoaXMucmlnaHRfbm9kZSA9IG51bGw7XG4gICAgICAgIHRoaXMud2lkdGggPSAwLjA7XG4gICAgICAgIHRoaXMubGVmdF9oaWdoZXN0ID0gZmFsc2U7XG4gICAgfTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1FZGdlRXZlbnRcbiAgICB2YXIgRWRnZUV2ZW50ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuY29uc3RyYWluZWRfZWRnZSA9IG51bGw7IC8vIEVkZ2VcbiAgICAgICAgdGhpcy5yaWdodCA9IGZhbHNlO1xuICAgIH07XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1Td2VlcENvbnRleHQgKHB1YmxpYyBBUEkpXG4gICAgLyoqXG4gICAgICogQ29uc3RydWN0b3IgZm9yIHRoZSB0cmlhbmd1bGF0aW9uIGNvbnRleHQuXG4gICAgICogSXQgYWNjZXB0cyBhIHNpbXBsZSBwb2x5bGluZSwgd2hpY2ggZGVmaW5lcyB0aGUgY29uc3RyYWluZWQgZWRnZXMuXG4gICAgICogUG9zc2libGUgb3B0aW9ucyBhcmU6XG4gICAgICogICAgY2xvbmVBcnJheXM6ICBpZiB0cnVlLCBkbyBhIHNoYWxsb3cgY29weSBvZiB0aGUgQXJyYXkgcGFyYW1ldGVycyBcbiAgICAgKiAgICAgICAgICAgICAgICAgIChjb250b3VyLCBob2xlcykuIFBvaW50cyBpbnNpZGUgYXJyYXlzIGFyZSBuZXZlciBjb3BpZWQuXG4gICAgICogICAgICAgICAgICAgICAgICBEZWZhdWx0IGlzIGZhbHNlIDoga2VlcCBhIHJlZmVyZW5jZSB0byB0aGUgYXJyYXkgYXJndW1lbnRzLFxuICAgICAqICAgICAgICAgICAgICAgICAgd2hvIHdpbGwgYmUgbW9kaWZpZWQgaW4gcGxhY2UuXG4gICAgICogQHBhcmFtIHtBcnJheX0gY29udG91ciAgYXJyYXkgb2YgXCJQb2ludCBsaWtlXCIgb2JqZWN0cyB3aXRoIHt4LHl9IChkdWNrIHR5cGluZylcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyAgY29uc3RydWN0b3Igb3B0aW9uc1xuICAgICAqL1xuICAgIHZhciBTd2VlcENvbnRleHQgPSBmdW5jdGlvbihjb250b3VyLCBvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgICAgICB0aGlzLnRyaWFuZ2xlc18gPSBbXTtcbiAgICAgICAgdGhpcy5tYXBfID0gW107XG4gICAgICAgIHRoaXMucG9pbnRzXyA9IChvcHRpb25zLmNsb25lQXJyYXlzID8gY29udG91ci5zbGljZSgwKSA6IGNvbnRvdXIpO1xuICAgICAgICB0aGlzLmVkZ2VfbGlzdCA9IFtdO1xuXG4gICAgICAgIC8vIEJvdW5kaW5nIGJveCBvZiBhbGwgcG9pbnRzLiBDb21wdXRlZCBhdCB0aGUgc3RhcnQgb2YgdGhlIHRyaWFuZ3VsYXRpb24sIFxuICAgICAgICAvLyBpdCBpcyBzdG9yZWQgaW4gY2FzZSBpdCBpcyBuZWVkZWQgYnkgdGhlIGNhbGxlci5cbiAgICAgICAgdGhpcy5wbWluXyA9IHRoaXMucG1heF8gPSBudWxsO1xuXG4gICAgICAgIC8vIEFkdmFuY2luZyBmcm9udFxuICAgICAgICB0aGlzLmZyb250XyA9IG51bGw7IC8vIEFkdmFuY2luZ0Zyb250XG4gICAgICAgIC8vIGhlYWQgcG9pbnQgdXNlZCB3aXRoIGFkdmFuY2luZyBmcm9udFxuICAgICAgICB0aGlzLmhlYWRfID0gbnVsbDsgLy8gUG9pbnRcbiAgICAgICAgLy8gdGFpbCBwb2ludCB1c2VkIHdpdGggYWR2YW5jaW5nIGZyb250XG4gICAgICAgIHRoaXMudGFpbF8gPSBudWxsOyAvLyBQb2ludFxuXG4gICAgICAgIHRoaXMuYWZfaGVhZF8gPSBudWxsOyAvLyBOb2RlXG4gICAgICAgIHRoaXMuYWZfbWlkZGxlXyA9IG51bGw7IC8vIE5vZGVcbiAgICAgICAgdGhpcy5hZl90YWlsXyA9IG51bGw7IC8vIE5vZGVcblxuICAgICAgICB0aGlzLmJhc2luID0gbmV3IEJhc2luKCk7XG4gICAgICAgIHRoaXMuZWRnZV9ldmVudCA9IG5ldyBFZGdlRXZlbnQoKTtcblxuICAgICAgICB0aGlzLmluaXRFZGdlcyh0aGlzLnBvaW50c18pO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIEFkZCBhIGhvbGUgdG8gdGhlIGNvbnN0cmFpbnRzXG4gICAgICogQHBhcmFtIHtBcnJheX0gcG9seWxpbmUgIGFycmF5IG9mIFwiUG9pbnQgbGlrZVwiIG9iamVjdHMgd2l0aCB7eCx5fSAoZHVjayB0eXBpbmcpXG4gICAgICovXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5hZGRIb2xlID0gZnVuY3Rpb24ocG9seWxpbmUpIHtcbiAgICAgICAgdGhpcy5pbml0RWRnZXMocG9seWxpbmUpO1xuICAgICAgICB2YXIgaSwgbGVuID0gcG9seWxpbmUubGVuZ3RoO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMucG9pbnRzXy5wdXNoKHBvbHlsaW5lW2ldKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpczsgLy8gZm9yIGNoYWluaW5nXG4gICAgfTtcbiAgICAvLyBCYWNrd2FyZCBjb21wYXRpYmlsaXR5XG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5BZGRIb2xlID0gU3dlZXBDb250ZXh0LnByb3RvdHlwZS5hZGRIb2xlO1xuXG5cbiAgICAvKipcbiAgICAgKiBBZGQgYSBTdGVpbmVyIHBvaW50IHRvIHRoZSBjb25zdHJhaW50c1xuICAgICAqIEBwYXJhbSB7UG9pbnR9IHBvaW50ICAgICBhbnkgXCJQb2ludCBsaWtlXCIgb2JqZWN0IHdpdGgge3gseX0gKGR1Y2sgdHlwaW5nKVxuICAgICAqL1xuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUuYWRkUG9pbnQgPSBmdW5jdGlvbihwb2ludCkge1xuICAgICAgICB0aGlzLnBvaW50c18ucHVzaChwb2ludCk7XG4gICAgICAgIHJldHVybiB0aGlzOyAvLyBmb3IgY2hhaW5pbmdcbiAgICB9O1xuICAgIC8vIEJhY2t3YXJkIGNvbXBhdGliaWxpdHlcbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLkFkZFBvaW50ID0gU3dlZXBDb250ZXh0LnByb3RvdHlwZS5hZGRQb2ludDtcblxuXG4gICAgLyoqXG4gICAgICogQWRkIHNldmVyYWwgU3RlaW5lciBwb2ludHMgdG8gdGhlIGNvbnN0cmFpbnRzXG4gICAgICogQHBhcmFtIHthcnJheTxQb2ludD59IHBvaW50cyAgICAgYXJyYXkgb2YgXCJQb2ludCBsaWtlXCIgb2JqZWN0IHdpdGgge3gseX0gXG4gICAgICovXG4gICAgLy8gTWV0aG9kIGFkZGVkIGluIHRoZSBKYXZhU2NyaXB0IHZlcnNpb24gKHdhcyBub3QgcHJlc2VudCBpbiB0aGUgYysrIHZlcnNpb24pXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5hZGRQb2ludHMgPSBmdW5jdGlvbihwb2ludHMpIHtcbiAgICAgICAgdGhpcy5wb2ludHNfID0gdGhpcy5wb2ludHNfLmNvbmNhdChwb2ludHMpO1xuICAgICAgICByZXR1cm4gdGhpczsgLy8gZm9yIGNoYWluaW5nXG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogVHJpYW5ndWxhdGUgdGhlIHBvbHlnb24gd2l0aCBob2xlcyBhbmQgU3RlaW5lciBwb2ludHMuXG4gICAgICovXG4gICAgLy8gU2hvcnRjdXQgbWV0aG9kIGZvciBTd2VlcC50cmlhbmd1bGF0ZShTd2VlcENvbnRleHQpLlxuICAgIC8vIE1ldGhvZCBhZGRlZCBpbiB0aGUgSmF2YVNjcmlwdCB2ZXJzaW9uICh3YXMgbm90IHByZXNlbnQgaW4gdGhlIGMrKyB2ZXJzaW9uKVxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUudHJpYW5ndWxhdGUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgU3dlZXAudHJpYW5ndWxhdGUodGhpcyk7XG4gICAgICAgIHJldHVybiB0aGlzOyAvLyBmb3IgY2hhaW5pbmdcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIGJvdW5kaW5nIGJveCBvZiB0aGUgcHJvdmlkZWQgY29uc3RyYWludHMgKGNvbnRvdXIsIGhvbGVzIGFuZCBcbiAgICAgKiBTdGVpbnRlciBwb2ludHMpLiBXYXJuaW5nIDogdGhlc2UgdmFsdWVzIGFyZSBub3QgYXZhaWxhYmxlIGlmIHRoZSB0cmlhbmd1bGF0aW9uIFxuICAgICAqIGhhcyBub3QgYmVlbiBkb25lIHlldC5cbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBvYmplY3Qgd2l0aCAnbWluJyBhbmQgJ21heCcgUG9pbnRcbiAgICAgKi9cbiAgICAvLyBNZXRob2QgYWRkZWQgaW4gdGhlIEphdmFTY3JpcHQgdmVyc2lvbiAod2FzIG5vdCBwcmVzZW50IGluIHRoZSBjKysgdmVyc2lvbilcbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLmdldEJvdW5kaW5nQm94ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB7bWluOiB0aGlzLnBtaW5fLCBtYXg6IHRoaXMucG1heF99O1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBHZXQgcmVzdWx0IG9mIHRyaWFuZ3VsYXRpb25cbiAgICAgKiBAcmV0dXJucyB7YXJyYXk8VHJpYW5nbGU+fSAgIGFycmF5IG9mIHRyaWFuZ2xlc1xuICAgICAqL1xuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUuZ2V0VHJpYW5nbGVzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRyaWFuZ2xlc187XG4gICAgfTtcbiAgICAvLyBCYWNrd2FyZCBjb21wYXRpYmlsaXR5XG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5HZXRUcmlhbmdsZXMgPSBTd2VlcENvbnRleHQucHJvdG90eXBlLmdldFRyaWFuZ2xlcztcblxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1Td2VlcENvbnRleHQgKHByaXZhdGUgQVBJKVxuXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5mcm9udCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5mcm9udF87XG4gICAgfTtcblxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUucG9pbnRDb3VudCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5wb2ludHNfLmxlbmd0aDtcbiAgICB9O1xuXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5oZWFkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmhlYWRfO1xuICAgIH07XG5cbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLnNldEhlYWQgPSBmdW5jdGlvbihwMSkge1xuICAgICAgICB0aGlzLmhlYWRfID0gcDE7XG4gICAgfTtcblxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUudGFpbCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy50YWlsXztcbiAgICB9O1xuXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5zZXRUYWlsID0gZnVuY3Rpb24ocDEpIHtcbiAgICAgICAgdGhpcy50YWlsXyA9IHAxO1xuICAgIH07XG5cbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLmdldE1hcCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5tYXBfO1xuICAgIH07XG5cbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLmluaXRUcmlhbmd1bGF0aW9uID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciB4bWF4ID0gdGhpcy5wb2ludHNfWzBdLng7XG4gICAgICAgIHZhciB4bWluID0gdGhpcy5wb2ludHNfWzBdLng7XG4gICAgICAgIHZhciB5bWF4ID0gdGhpcy5wb2ludHNfWzBdLnk7XG4gICAgICAgIHZhciB5bWluID0gdGhpcy5wb2ludHNfWzBdLnk7XG5cbiAgICAgICAgLy8gQ2FsY3VsYXRlIGJvdW5kc1xuICAgICAgICB2YXIgaSwgbGVuID0gdGhpcy5wb2ludHNfLmxlbmd0aDtcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgcCA9IHRoaXMucG9pbnRzX1tpXTtcbiAgICAgICAgICAgIC8qIGpzaGludCBleHByOnRydWUgKi9cbiAgICAgICAgICAgIChwLnggPiB4bWF4KSAmJiAoeG1heCA9IHAueCk7XG4gICAgICAgICAgICAocC54IDwgeG1pbikgJiYgKHhtaW4gPSBwLngpO1xuICAgICAgICAgICAgKHAueSA+IHltYXgpICYmICh5bWF4ID0gcC55KTtcbiAgICAgICAgICAgIChwLnkgPCB5bWluKSAmJiAoeW1pbiA9IHAueSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5wbWluXyA9IG5ldyBQb2ludCh4bWluLCB5bWluKTtcbiAgICAgICAgdGhpcy5wbWF4XyA9IG5ldyBQb2ludCh4bWF4LCB5bWF4KTtcblxuICAgICAgICB2YXIgZHggPSBrQWxwaGEgKiAoeG1heCAtIHhtaW4pO1xuICAgICAgICB2YXIgZHkgPSBrQWxwaGEgKiAoeW1heCAtIHltaW4pO1xuICAgICAgICB0aGlzLmhlYWRfID0gbmV3IFBvaW50KHhtYXggKyBkeCwgeW1pbiAtIGR5KTtcbiAgICAgICAgdGhpcy50YWlsXyA9IG5ldyBQb2ludCh4bWluIC0gZHgsIHltaW4gLSBkeSk7XG5cbiAgICAgICAgLy8gU29ydCBwb2ludHMgYWxvbmcgeS1heGlzXG4gICAgICAgIHRoaXMucG9pbnRzXy5zb3J0KFBvaW50LmNvbXBhcmUpO1xuICAgIH07XG5cbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLmluaXRFZGdlcyA9IGZ1bmN0aW9uKHBvbHlsaW5lKSB7XG4gICAgICAgIHZhciBpLCBsZW4gPSBwb2x5bGluZS5sZW5ndGg7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgICAgICAgICAgdGhpcy5lZGdlX2xpc3QucHVzaChuZXcgRWRnZShwb2x5bGluZVtpXSwgcG9seWxpbmVbKGkgKyAxKSAlIGxlbl0pKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLmdldFBvaW50ID0gZnVuY3Rpb24oaW5kZXgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucG9pbnRzX1tpbmRleF07XG4gICAgfTtcblxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUuYWRkVG9NYXAgPSBmdW5jdGlvbih0cmlhbmdsZSkge1xuICAgICAgICB0aGlzLm1hcF8ucHVzaCh0cmlhbmdsZSk7XG4gICAgfTtcblxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUubG9jYXRlTm9kZSA9IGZ1bmN0aW9uKHBvaW50KSB7XG4gICAgICAgIHJldHVybiB0aGlzLmZyb250Xy5sb2NhdGVOb2RlKHBvaW50LngpO1xuICAgIH07XG5cbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLmNyZWF0ZUFkdmFuY2luZ0Zyb250ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBoZWFkO1xuICAgICAgICB2YXIgbWlkZGxlO1xuICAgICAgICB2YXIgdGFpbDtcbiAgICAgICAgLy8gSW5pdGlhbCB0cmlhbmdsZVxuICAgICAgICB2YXIgdHJpYW5nbGUgPSBuZXcgVHJpYW5nbGUodGhpcy5wb2ludHNfWzBdLCB0aGlzLnRhaWxfLCB0aGlzLmhlYWRfKTtcblxuICAgICAgICB0aGlzLm1hcF8ucHVzaCh0cmlhbmdsZSk7XG5cbiAgICAgICAgaGVhZCA9IG5ldyBOb2RlKHRyaWFuZ2xlLmdldFBvaW50KDEpLCB0cmlhbmdsZSk7XG4gICAgICAgIG1pZGRsZSA9IG5ldyBOb2RlKHRyaWFuZ2xlLmdldFBvaW50KDApLCB0cmlhbmdsZSk7XG4gICAgICAgIHRhaWwgPSBuZXcgTm9kZSh0cmlhbmdsZS5nZXRQb2ludCgyKSk7XG5cbiAgICAgICAgdGhpcy5mcm9udF8gPSBuZXcgQWR2YW5jaW5nRnJvbnQoaGVhZCwgdGFpbCk7XG5cbiAgICAgICAgaGVhZC5uZXh0ID0gbWlkZGxlO1xuICAgICAgICBtaWRkbGUubmV4dCA9IHRhaWw7XG4gICAgICAgIG1pZGRsZS5wcmV2ID0gaGVhZDtcbiAgICAgICAgdGFpbC5wcmV2ID0gbWlkZGxlO1xuICAgIH07XG5cbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLnJlbW92ZU5vZGUgPSBmdW5jdGlvbihub2RlKSB7XG4gICAgICAgIC8vIGRvIG5vdGhpbmdcbiAgICAgICAgLyoganNoaW50IHVudXNlZDpmYWxzZSAqL1xuICAgIH07XG5cbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLm1hcFRyaWFuZ2xlVG9Ob2RlcyA9IGZ1bmN0aW9uKHQpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCAzOyArK2kpIHtcbiAgICAgICAgICAgIGlmICghIHQuZ2V0TmVpZ2hib3IoaSkpIHtcbiAgICAgICAgICAgICAgICB2YXIgbiA9IHRoaXMuZnJvbnRfLmxvY2F0ZVBvaW50KHQucG9pbnRDVyh0LmdldFBvaW50KGkpKSk7XG4gICAgICAgICAgICAgICAgaWYgKG4pIHtcbiAgICAgICAgICAgICAgICAgICAgbi50cmlhbmdsZSA9IHQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUucmVtb3ZlRnJvbU1hcCA9IGZ1bmN0aW9uKHRyaWFuZ2xlKSB7XG4gICAgICAgIHZhciBpLCBtYXAgPSB0aGlzLm1hcF8sIGxlbiA9IG1hcC5sZW5ndGg7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgaWYgKG1hcFtpXSA9PT0gdHJpYW5nbGUpIHtcbiAgICAgICAgICAgICAgICBtYXAuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIERvIGEgZGVwdGggZmlyc3QgdHJhdmVyc2FsIHRvIGNvbGxlY3QgdHJpYW5nbGVzXG4gICAgICogQHBhcmFtIHtUcmlhbmdsZX0gdHJpYW5nbGUgc3RhcnRcbiAgICAgKi9cbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLm1lc2hDbGVhbiA9IGZ1bmN0aW9uKHRyaWFuZ2xlKSB7XG4gICAgICAgIC8vIE5ldyBpbXBsZW1lbnRhdGlvbiBhdm9pZHMgcmVjdXJzaXZlIGNhbGxzIGFuZCB1c2UgYSBsb29wIGluc3RlYWQuXG4gICAgICAgIC8vIENmLiBpc3N1ZXMgIyA1NywgNjUgYW5kIDY5LlxuICAgICAgICB2YXIgdHJpYW5nbGVzID0gW3RyaWFuZ2xlXSwgdCwgaTtcbiAgICAgICAgLyoganNoaW50IGJvc3M6dHJ1ZSAqL1xuICAgICAgICB3aGlsZSAodCA9IHRyaWFuZ2xlcy5wb3AoKSkge1xuICAgICAgICAgICAgaWYgKCF0LmlzSW50ZXJpb3IoKSkge1xuICAgICAgICAgICAgICAgIHQuc2V0SW50ZXJpb3IodHJ1ZSk7XG4gICAgICAgICAgICAgICAgdGhpcy50cmlhbmdsZXNfLnB1c2godCk7XG4gICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IDM7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXQuY29uc3RyYWluZWRfZWRnZVtpXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJpYW5nbGVzLnB1c2godC5nZXROZWlnaGJvcihpKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1Td2VlcFxuXG4gICAgLyoqXG4gICAgICogVGhlICdTd2VlcCcgb2JqZWN0IGlzIHByZXNlbnQgaW4gb3JkZXIgdG8ga2VlcCB0aGlzIEphdmFTY3JpcHQgdmVyc2lvbiBcbiAgICAgKiBhcyBjbG9zZSBhcyBwb3NzaWJsZSB0byB0aGUgcmVmZXJlbmNlIEMrKyB2ZXJzaW9uLCBldmVuIHRob3VnaCBhbG1vc3RcbiAgICAgKiBhbGwgU3dlZXAgbWV0aG9kcyBjb3VsZCBiZSBkZWNsYXJlZCBhcyBtZW1iZXJzIG9mIHRoZSBTd2VlcENvbnRleHQgb2JqZWN0LlxuICAgICAqL1xuICAgIHZhciBTd2VlcCA9IHt9O1xuXG5cbiAgICAvKipcbiAgICAgKiBUcmlhbmd1bGF0ZSB0aGUgcG9seWdvbiB3aXRoIGhvbGVzIGFuZCBTdGVpbmVyIHBvaW50cy5cbiAgICAgKiBAcGFyYW0gICB0Y3ggU3dlZXBDb250ZXh0IG9iamVjdC5cbiAgICAgKi9cbiAgICBTd2VlcC50cmlhbmd1bGF0ZSA9IGZ1bmN0aW9uKHRjeCkge1xuICAgICAgICB0Y3guaW5pdFRyaWFuZ3VsYXRpb24oKTtcbiAgICAgICAgdGN4LmNyZWF0ZUFkdmFuY2luZ0Zyb250KCk7XG4gICAgICAgIC8vIFN3ZWVwIHBvaW50czsgYnVpbGQgbWVzaFxuICAgICAgICBTd2VlcC5zd2VlcFBvaW50cyh0Y3gpO1xuICAgICAgICAvLyBDbGVhbiB1cFxuICAgICAgICBTd2VlcC5maW5hbGl6YXRpb25Qb2x5Z29uKHRjeCk7XG4gICAgfTtcblxuICAgIFN3ZWVwLnN3ZWVwUG9pbnRzID0gZnVuY3Rpb24odGN4KSB7XG4gICAgICAgIHZhciBpLCBsZW4gPSB0Y3gucG9pbnRDb3VudCgpO1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgICAgICAgIHZhciBwb2ludCA9IHRjeC5nZXRQb2ludChpKTtcbiAgICAgICAgICAgIHZhciBub2RlID0gU3dlZXAucG9pbnRFdmVudCh0Y3gsIHBvaW50KTtcbiAgICAgICAgICAgIHZhciBlZGdlcyA9IHBvaW50Ll9wMnRfZWRnZV9saXN0O1xuICAgICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGVkZ2VzICYmIGogPCBlZGdlcy5sZW5ndGg7ICsraikge1xuICAgICAgICAgICAgICAgIFN3ZWVwLmVkZ2VFdmVudEJ5RWRnZSh0Y3gsIGVkZ2VzW2pdLCBub2RlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBTd2VlcC5maW5hbGl6YXRpb25Qb2x5Z29uID0gZnVuY3Rpb24odGN4KSB7XG4gICAgICAgIC8vIEdldCBhbiBJbnRlcm5hbCB0cmlhbmdsZSB0byBzdGFydCB3aXRoXG4gICAgICAgIHZhciB0ID0gdGN4LmZyb250KCkuaGVhZCgpLm5leHQudHJpYW5nbGU7XG4gICAgICAgIHZhciBwID0gdGN4LmZyb250KCkuaGVhZCgpLm5leHQucG9pbnQ7XG4gICAgICAgIHdoaWxlICghdC5nZXRDb25zdHJhaW5lZEVkZ2VDVyhwKSkge1xuICAgICAgICAgICAgdCA9IHQubmVpZ2hib3JDQ1cocCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDb2xsZWN0IGludGVyaW9yIHRyaWFuZ2xlcyBjb25zdHJhaW5lZCBieSBlZGdlc1xuICAgICAgICB0Y3gubWVzaENsZWFuKHQpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBGaW5kIGNsb3NlcyBub2RlIHRvIHRoZSBsZWZ0IG9mIHRoZSBuZXcgcG9pbnQgYW5kXG4gICAgICogY3JlYXRlIGEgbmV3IHRyaWFuZ2xlLiBJZiBuZWVkZWQgbmV3IGhvbGVzIGFuZCBiYXNpbnNcbiAgICAgKiB3aWxsIGJlIGZpbGxlZCB0by5cbiAgICAgKi9cbiAgICBTd2VlcC5wb2ludEV2ZW50ID0gZnVuY3Rpb24odGN4LCBwb2ludCkge1xuICAgICAgICB2YXIgbm9kZSA9IHRjeC5sb2NhdGVOb2RlKHBvaW50KTtcbiAgICAgICAgdmFyIG5ld19ub2RlID0gU3dlZXAubmV3RnJvbnRUcmlhbmdsZSh0Y3gsIHBvaW50LCBub2RlKTtcblxuICAgICAgICAvLyBPbmx5IG5lZWQgdG8gY2hlY2sgK2Vwc2lsb24gc2luY2UgcG9pbnQgbmV2ZXIgaGF2ZSBzbWFsbGVyXG4gICAgICAgIC8vIHggdmFsdWUgdGhhbiBub2RlIGR1ZSB0byBob3cgd2UgZmV0Y2ggbm9kZXMgZnJvbSB0aGUgZnJvbnRcbiAgICAgICAgaWYgKHBvaW50LnggPD0gbm9kZS5wb2ludC54ICsgKEVQU0lMT04pKSB7XG4gICAgICAgICAgICBTd2VlcC5maWxsKHRjeCwgbm9kZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvL3RjeC5BZGROb2RlKG5ld19ub2RlKTtcblxuICAgICAgICBTd2VlcC5maWxsQWR2YW5jaW5nRnJvbnQodGN4LCBuZXdfbm9kZSk7XG4gICAgICAgIHJldHVybiBuZXdfbm9kZTtcbiAgICB9O1xuXG4gICAgU3dlZXAuZWRnZUV2ZW50QnlFZGdlID0gZnVuY3Rpb24odGN4LCBlZGdlLCBub2RlKSB7XG4gICAgICAgIHRjeC5lZGdlX2V2ZW50LmNvbnN0cmFpbmVkX2VkZ2UgPSBlZGdlO1xuICAgICAgICB0Y3guZWRnZV9ldmVudC5yaWdodCA9IChlZGdlLnAueCA+IGVkZ2UucS54KTtcblxuICAgICAgICBpZiAoU3dlZXAuaXNFZGdlU2lkZU9mVHJpYW5nbGUobm9kZS50cmlhbmdsZSwgZWRnZS5wLCBlZGdlLnEpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGb3Igbm93IHdlIHdpbGwgZG8gYWxsIG5lZWRlZCBmaWxsaW5nXG4gICAgICAgIC8vIFRPRE86IGludGVncmF0ZSB3aXRoIGZsaXAgcHJvY2VzcyBtaWdodCBnaXZlIHNvbWUgYmV0dGVyIHBlcmZvcm1hbmNlXG4gICAgICAgIC8vICAgICAgIGJ1dCBmb3Igbm93IHRoaXMgYXZvaWQgdGhlIGlzc3VlIHdpdGggY2FzZXMgdGhhdCBuZWVkcyBib3RoIGZsaXBzIGFuZCBmaWxsc1xuICAgICAgICBTd2VlcC5maWxsRWRnZUV2ZW50KHRjeCwgZWRnZSwgbm9kZSk7XG4gICAgICAgIFN3ZWVwLmVkZ2VFdmVudEJ5UG9pbnRzKHRjeCwgZWRnZS5wLCBlZGdlLnEsIG5vZGUudHJpYW5nbGUsIGVkZ2UucSk7XG4gICAgfTtcblxuICAgIFN3ZWVwLmVkZ2VFdmVudEJ5UG9pbnRzID0gZnVuY3Rpb24odGN4LCBlcCwgZXEsIHRyaWFuZ2xlLCBwb2ludCkge1xuICAgICAgICBpZiAoU3dlZXAuaXNFZGdlU2lkZU9mVHJpYW5nbGUodHJpYW5nbGUsIGVwLCBlcSkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBwMSA9IHRyaWFuZ2xlLnBvaW50Q0NXKHBvaW50KTtcbiAgICAgICAgdmFyIG8xID0gb3JpZW50MmQoZXEsIHAxLCBlcCk7XG4gICAgICAgIGlmIChvMSA9PT0gT3JpZW50YXRpb24uQ09MTElORUFSKSB7XG4gICAgICAgICAgICAvLyBUT0RPIGludGVncmF0ZSBoZXJlIGNoYW5nZXMgZnJvbSBDKysgdmVyc2lvblxuICAgICAgICAgICAgdGhyb3cgbmV3IFBvaW50RXJyb3IoJ3BvbHkydHJpIEVkZ2VFdmVudDogQ29sbGluZWFyIG5vdCBzdXBwb3J0ZWQhJywgW2VxLCBwMSwgZXBdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBwMiA9IHRyaWFuZ2xlLnBvaW50Q1cocG9pbnQpO1xuICAgICAgICB2YXIgbzIgPSBvcmllbnQyZChlcSwgcDIsIGVwKTtcbiAgICAgICAgaWYgKG8yID09PSBPcmllbnRhdGlvbi5DT0xMSU5FQVIpIHtcbiAgICAgICAgICAgIC8vIFRPRE8gaW50ZWdyYXRlIGhlcmUgY2hhbmdlcyBmcm9tIEMrKyB2ZXJzaW9uXG4gICAgICAgICAgICB0aHJvdyBuZXcgUG9pbnRFcnJvcigncG9seTJ0cmkgRWRnZUV2ZW50OiBDb2xsaW5lYXIgbm90IHN1cHBvcnRlZCEnLCBbZXEsIHAyLCBlcF0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG8xID09PSBvMikge1xuICAgICAgICAgICAgLy8gTmVlZCB0byBkZWNpZGUgaWYgd2UgYXJlIHJvdGF0aW5nIENXIG9yIENDVyB0byBnZXQgdG8gYSB0cmlhbmdsZVxuICAgICAgICAgICAgLy8gdGhhdCB3aWxsIGNyb3NzIGVkZ2VcbiAgICAgICAgICAgIGlmIChvMSA9PT0gT3JpZW50YXRpb24uQ1cpIHtcbiAgICAgICAgICAgICAgICB0cmlhbmdsZSA9IHRyaWFuZ2xlLm5laWdoYm9yQ0NXKHBvaW50KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdHJpYW5nbGUgPSB0cmlhbmdsZS5uZWlnaGJvckNXKHBvaW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFN3ZWVwLmVkZ2VFdmVudEJ5UG9pbnRzKHRjeCwgZXAsIGVxLCB0cmlhbmdsZSwgcG9pbnQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gVGhpcyB0cmlhbmdsZSBjcm9zc2VzIGNvbnN0cmFpbnQgc28gbGV0cyBmbGlwcGluIHN0YXJ0IVxuICAgICAgICAgICAgU3dlZXAuZmxpcEVkZ2VFdmVudCh0Y3gsIGVwLCBlcSwgdHJpYW5nbGUsIHBvaW50KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBTd2VlcC5pc0VkZ2VTaWRlT2ZUcmlhbmdsZSA9IGZ1bmN0aW9uKHRyaWFuZ2xlLCBlcCwgZXEpIHtcbiAgICAgICAgdmFyIGluZGV4ID0gdHJpYW5nbGUuZWRnZUluZGV4KGVwLCBlcSk7XG4gICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICAgIHRyaWFuZ2xlLm1hcmtDb25zdHJhaW5lZEVkZ2VCeUluZGV4KGluZGV4KTtcbiAgICAgICAgICAgIHZhciB0ID0gdHJpYW5nbGUuZ2V0TmVpZ2hib3IoaW5kZXgpO1xuICAgICAgICAgICAgaWYgKHQpIHtcbiAgICAgICAgICAgICAgICB0Lm1hcmtDb25zdHJhaW5lZEVkZ2VCeVBvaW50cyhlcCwgZXEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH07XG5cbiAgICBTd2VlcC5uZXdGcm9udFRyaWFuZ2xlID0gZnVuY3Rpb24odGN4LCBwb2ludCwgbm9kZSkge1xuICAgICAgICB2YXIgdHJpYW5nbGUgPSBuZXcgVHJpYW5nbGUocG9pbnQsIG5vZGUucG9pbnQsIG5vZGUubmV4dC5wb2ludCk7XG5cbiAgICAgICAgdHJpYW5nbGUubWFya05laWdoYm9yKG5vZGUudHJpYW5nbGUpO1xuICAgICAgICB0Y3guYWRkVG9NYXAodHJpYW5nbGUpO1xuXG4gICAgICAgIHZhciBuZXdfbm9kZSA9IG5ldyBOb2RlKHBvaW50KTtcbiAgICAgICAgbmV3X25vZGUubmV4dCA9IG5vZGUubmV4dDtcbiAgICAgICAgbmV3X25vZGUucHJldiA9IG5vZGU7XG4gICAgICAgIG5vZGUubmV4dC5wcmV2ID0gbmV3X25vZGU7XG4gICAgICAgIG5vZGUubmV4dCA9IG5ld19ub2RlO1xuXG4gICAgICAgIGlmICghU3dlZXAubGVnYWxpemUodGN4LCB0cmlhbmdsZSkpIHtcbiAgICAgICAgICAgIHRjeC5tYXBUcmlhbmdsZVRvTm9kZXModHJpYW5nbGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5ld19ub2RlO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgdHJpYW5nbGUgdG8gdGhlIGFkdmFuY2luZyBmcm9udCB0byBmaWxsIGEgaG9sZS5cbiAgICAgKiBAcGFyYW0gdGN4XG4gICAgICogQHBhcmFtIG5vZGUgLSBtaWRkbGUgbm9kZSwgdGhhdCBpcyB0aGUgYm90dG9tIG9mIHRoZSBob2xlXG4gICAgICovXG4gICAgU3dlZXAuZmlsbCA9IGZ1bmN0aW9uKHRjeCwgbm9kZSkge1xuICAgICAgICB2YXIgdHJpYW5nbGUgPSBuZXcgVHJpYW5nbGUobm9kZS5wcmV2LnBvaW50LCBub2RlLnBvaW50LCBub2RlLm5leHQucG9pbnQpO1xuXG4gICAgICAgIC8vIFRPRE86IHNob3VsZCBjb3B5IHRoZSBjb25zdHJhaW5lZF9lZGdlIHZhbHVlIGZyb20gbmVpZ2hib3IgdHJpYW5nbGVzXG4gICAgICAgIC8vICAgICAgIGZvciBub3cgY29uc3RyYWluZWRfZWRnZSB2YWx1ZXMgYXJlIGNvcGllZCBkdXJpbmcgdGhlIGxlZ2FsaXplXG4gICAgICAgIHRyaWFuZ2xlLm1hcmtOZWlnaGJvcihub2RlLnByZXYudHJpYW5nbGUpO1xuICAgICAgICB0cmlhbmdsZS5tYXJrTmVpZ2hib3Iobm9kZS50cmlhbmdsZSk7XG5cbiAgICAgICAgdGN4LmFkZFRvTWFwKHRyaWFuZ2xlKTtcblxuICAgICAgICAvLyBVcGRhdGUgdGhlIGFkdmFuY2luZyBmcm9udFxuICAgICAgICBub2RlLnByZXYubmV4dCA9IG5vZGUubmV4dDtcbiAgICAgICAgbm9kZS5uZXh0LnByZXYgPSBub2RlLnByZXY7XG5cblxuICAgICAgICAvLyBJZiBpdCB3YXMgbGVnYWxpemVkIHRoZSB0cmlhbmdsZSBoYXMgYWxyZWFkeSBiZWVuIG1hcHBlZFxuICAgICAgICBpZiAoIVN3ZWVwLmxlZ2FsaXplKHRjeCwgdHJpYW5nbGUpKSB7XG4gICAgICAgICAgICB0Y3gubWFwVHJpYW5nbGVUb05vZGVzKHRyaWFuZ2xlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vdGN4LnJlbW92ZU5vZGUobm9kZSk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEZpbGxzIGhvbGVzIGluIHRoZSBBZHZhbmNpbmcgRnJvbnRcbiAgICAgKi9cbiAgICBTd2VlcC5maWxsQWR2YW5jaW5nRnJvbnQgPSBmdW5jdGlvbih0Y3gsIG4pIHtcbiAgICAgICAgLy8gRmlsbCByaWdodCBob2xlc1xuICAgICAgICB2YXIgbm9kZSA9IG4ubmV4dDtcbiAgICAgICAgdmFyIGFuZ2xlO1xuICAgICAgICB3aGlsZSAobm9kZS5uZXh0KSB7XG4gICAgICAgICAgICBhbmdsZSA9IFN3ZWVwLmhvbGVBbmdsZShub2RlKTtcbiAgICAgICAgICAgIGlmIChhbmdsZSA+IFBJXzIgfHwgYW5nbGUgPCAtKFBJXzIpKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBTd2VlcC5maWxsKHRjeCwgbm9kZSk7XG4gICAgICAgICAgICBub2RlID0gbm9kZS5uZXh0O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRmlsbCBsZWZ0IGhvbGVzXG4gICAgICAgIG5vZGUgPSBuLnByZXY7XG4gICAgICAgIHdoaWxlIChub2RlLnByZXYpIHtcbiAgICAgICAgICAgIGFuZ2xlID0gU3dlZXAuaG9sZUFuZ2xlKG5vZGUpO1xuICAgICAgICAgICAgaWYgKGFuZ2xlID4gUElfMiB8fCBhbmdsZSA8IC0oUElfMikpIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFN3ZWVwLmZpbGwodGN4LCBub2RlKTtcbiAgICAgICAgICAgIG5vZGUgPSBub2RlLnByZXY7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGaWxsIHJpZ2h0IGJhc2luc1xuICAgICAgICBpZiAobi5uZXh0ICYmIG4ubmV4dC5uZXh0KSB7XG4gICAgICAgICAgICBhbmdsZSA9IFN3ZWVwLmJhc2luQW5nbGUobik7XG4gICAgICAgICAgICBpZiAoYW5nbGUgPCBQSV8zZGl2NCkge1xuICAgICAgICAgICAgICAgIFN3ZWVwLmZpbGxCYXNpbih0Y3gsIG4pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIFN3ZWVwLmJhc2luQW5nbGUgPSBmdW5jdGlvbihub2RlKSB7XG4gICAgICAgIHZhciBheCA9IG5vZGUucG9pbnQueCAtIG5vZGUubmV4dC5uZXh0LnBvaW50Lng7XG4gICAgICAgIHZhciBheSA9IG5vZGUucG9pbnQueSAtIG5vZGUubmV4dC5uZXh0LnBvaW50Lnk7XG4gICAgICAgIHJldHVybiBNYXRoLmF0YW4yKGF5LCBheCk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIG5vZGUgLSBtaWRkbGUgbm9kZVxuICAgICAqIEByZXR1cm4gdGhlIGFuZ2xlIGJldHdlZW4gMyBmcm9udCBub2Rlc1xuICAgICAqL1xuICAgIFN3ZWVwLmhvbGVBbmdsZSA9IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICAgICAgLyogQ29tcGxleCBwbGFuZVxuICAgICAgICAgKiBhYiA9IGNvc0EgK2kqc2luQVxuICAgICAgICAgKiBhYiA9IChheCArIGF5KmkpKGJ4ICsgYnkqaSkgPSAoYXgqYnggKyBheSpieSkgKyBpKGF4KmJ5LWF5KmJ4KVxuICAgICAgICAgKiBhdGFuMih5LHgpIGNvbXB1dGVzIHRoZSBwcmluY2lwYWwgdmFsdWUgb2YgdGhlIGFyZ3VtZW50IGZ1bmN0aW9uXG4gICAgICAgICAqIGFwcGxpZWQgdG8gdGhlIGNvbXBsZXggbnVtYmVyIHgraXlcbiAgICAgICAgICogV2hlcmUgeCA9IGF4KmJ4ICsgYXkqYnlcbiAgICAgICAgICogICAgICAgeSA9IGF4KmJ5IC0gYXkqYnhcbiAgICAgICAgICovXG4gICAgICAgIHZhciBheCA9IG5vZGUubmV4dC5wb2ludC54IC0gbm9kZS5wb2ludC54O1xuICAgICAgICB2YXIgYXkgPSBub2RlLm5leHQucG9pbnQueSAtIG5vZGUucG9pbnQueTtcbiAgICAgICAgdmFyIGJ4ID0gbm9kZS5wcmV2LnBvaW50LnggLSBub2RlLnBvaW50Lng7XG4gICAgICAgIHZhciBieSA9IG5vZGUucHJldi5wb2ludC55IC0gbm9kZS5wb2ludC55O1xuICAgICAgICByZXR1cm4gTWF0aC5hdGFuMihheCAqIGJ5IC0gYXkgKiBieCwgYXggKiBieCArIGF5ICogYnkpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdHJpYW5nbGUgd2FzIGxlZ2FsaXplZFxuICAgICAqL1xuICAgIFN3ZWVwLmxlZ2FsaXplID0gZnVuY3Rpb24odGN4LCB0KSB7XG4gICAgICAgIC8vIFRvIGxlZ2FsaXplIGEgdHJpYW5nbGUgd2Ugc3RhcnQgYnkgZmluZGluZyBpZiBhbnkgb2YgdGhlIHRocmVlIGVkZ2VzXG4gICAgICAgIC8vIHZpb2xhdGUgdGhlIERlbGF1bmF5IGNvbmRpdGlvblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IDM7ICsraSkge1xuICAgICAgICAgICAgaWYgKHQuZGVsYXVuYXlfZWRnZVtpXSkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIG90ID0gdC5nZXROZWlnaGJvcihpKTtcbiAgICAgICAgICAgIGlmIChvdCkge1xuICAgICAgICAgICAgICAgIHZhciBwID0gdC5nZXRQb2ludChpKTtcbiAgICAgICAgICAgICAgICB2YXIgb3AgPSBvdC5vcHBvc2l0ZVBvaW50KHQsIHApO1xuICAgICAgICAgICAgICAgIHZhciBvaSA9IG90LmluZGV4KG9wKTtcblxuICAgICAgICAgICAgICAgIC8vIElmIHRoaXMgaXMgYSBDb25zdHJhaW5lZCBFZGdlIG9yIGEgRGVsYXVuYXkgRWRnZShvbmx5IGR1cmluZyByZWN1cnNpdmUgbGVnYWxpemF0aW9uKVxuICAgICAgICAgICAgICAgIC8vIHRoZW4gd2Ugc2hvdWxkIG5vdCB0cnkgdG8gbGVnYWxpemVcbiAgICAgICAgICAgICAgICBpZiAob3QuY29uc3RyYWluZWRfZWRnZVtvaV0gfHwgb3QuZGVsYXVuYXlfZWRnZVtvaV0pIHtcbiAgICAgICAgICAgICAgICAgICAgdC5jb25zdHJhaW5lZF9lZGdlW2ldID0gb3QuY29uc3RyYWluZWRfZWRnZVtvaV07XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZhciBpbnNpZGUgPSBTd2VlcC5pbkNpcmNsZShwLCB0LnBvaW50Q0NXKHApLCB0LnBvaW50Q1cocCksIG9wKTtcbiAgICAgICAgICAgICAgICBpZiAoaW5zaWRlKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIExldHMgbWFyayB0aGlzIHNoYXJlZCBlZGdlIGFzIERlbGF1bmF5XG4gICAgICAgICAgICAgICAgICAgIHQuZGVsYXVuYXlfZWRnZVtpXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIG90LmRlbGF1bmF5X2VkZ2Vbb2ldID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBMZXRzIHJvdGF0ZSBzaGFyZWQgZWRnZSBvbmUgdmVydGV4IENXIHRvIGxlZ2FsaXplIGl0XG4gICAgICAgICAgICAgICAgICAgIFN3ZWVwLnJvdGF0ZVRyaWFuZ2xlUGFpcih0LCBwLCBvdCwgb3ApO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFdlIG5vdyBnb3Qgb25lIHZhbGlkIERlbGF1bmF5IEVkZ2Ugc2hhcmVkIGJ5IHR3byB0cmlhbmdsZXNcbiAgICAgICAgICAgICAgICAgICAgLy8gVGhpcyBnaXZlcyB1cyA0IG5ldyBlZGdlcyB0byBjaGVjayBmb3IgRGVsYXVuYXlcblxuICAgICAgICAgICAgICAgICAgICAvLyBNYWtlIHN1cmUgdGhhdCB0cmlhbmdsZSB0byBub2RlIG1hcHBpbmcgaXMgZG9uZSBvbmx5IG9uZSB0aW1lIGZvciBhIHNwZWNpZmljIHRyaWFuZ2xlXG4gICAgICAgICAgICAgICAgICAgIHZhciBub3RfbGVnYWxpemVkID0gIVN3ZWVwLmxlZ2FsaXplKHRjeCwgdCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChub3RfbGVnYWxpemVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0Y3gubWFwVHJpYW5nbGVUb05vZGVzKHQpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgbm90X2xlZ2FsaXplZCA9ICFTd2VlcC5sZWdhbGl6ZSh0Y3gsIG90KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5vdF9sZWdhbGl6ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRjeC5tYXBUcmlhbmdsZVRvTm9kZXMob3QpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIC8vIFJlc2V0IHRoZSBEZWxhdW5heSBlZGdlcywgc2luY2UgdGhleSBvbmx5IGFyZSB2YWxpZCBEZWxhdW5heSBlZGdlc1xuICAgICAgICAgICAgICAgICAgICAvLyB1bnRpbCB3ZSBhZGQgYSBuZXcgdHJpYW5nbGUgb3IgcG9pbnQuXG4gICAgICAgICAgICAgICAgICAgIC8vIFhYWDogbmVlZCB0byB0aGluayBhYm91dCB0aGlzLiBDYW4gdGhlc2UgZWRnZXMgYmUgdHJpZWQgYWZ0ZXIgd2VcbiAgICAgICAgICAgICAgICAgICAgLy8gICAgICByZXR1cm4gdG8gcHJldmlvdXMgcmVjdXJzaXZlIGxldmVsP1xuICAgICAgICAgICAgICAgICAgICB0LmRlbGF1bmF5X2VkZ2VbaV0gPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgb3QuZGVsYXVuYXlfZWRnZVtvaV0gPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBJZiB0cmlhbmdsZSBoYXZlIGJlZW4gbGVnYWxpemVkIG5vIG5lZWQgdG8gY2hlY2sgdGhlIG90aGVyIGVkZ2VzIHNpbmNlXG4gICAgICAgICAgICAgICAgICAgIC8vIHRoZSByZWN1cnNpdmUgbGVnYWxpemF0aW9uIHdpbGwgaGFuZGxlcyB0aG9zZSBzbyB3ZSBjYW4gZW5kIGhlcmUuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIDxiPlJlcXVpcmVtZW50PC9iPjo8YnI+XG4gICAgICogMS4gYSxiIGFuZCBjIGZvcm0gYSB0cmlhbmdsZS48YnI+XG4gICAgICogMi4gYSBhbmQgZCBpcyBrbm93IHRvIGJlIG9uIG9wcG9zaXRlIHNpZGUgb2YgYmM8YnI+XG4gICAgICogPHByZT5cbiAgICAgKiAgICAgICAgICAgICAgICBhXG4gICAgICogICAgICAgICAgICAgICAgK1xuICAgICAqICAgICAgICAgICAgICAgLyBcXFxuICAgICAqICAgICAgICAgICAgICAvICAgXFxcbiAgICAgKiAgICAgICAgICAgIGIvICAgICBcXGNcbiAgICAgKiAgICAgICAgICAgICstLS0tLS0tK1xuICAgICAqICAgICAgICAgICAvICAgIGQgICAgXFxcbiAgICAgKiAgICAgICAgICAvICAgICAgICAgICBcXFxuICAgICAqIDwvcHJlPlxuICAgICAqIDxiPkZhY3Q8L2I+OiBkIGhhcyB0byBiZSBpbiBhcmVhIEIgdG8gaGF2ZSBhIGNoYW5jZSB0byBiZSBpbnNpZGUgdGhlIGNpcmNsZSBmb3JtZWQgYnlcbiAgICAgKiAgYSxiIGFuZCBjPGJyPlxuICAgICAqICBkIGlzIG91dHNpZGUgQiBpZiBvcmllbnQyZChhLGIsZCkgb3Igb3JpZW50MmQoYyxhLGQpIGlzIENXPGJyPlxuICAgICAqICBUaGlzIHByZWtub3dsZWRnZSBnaXZlcyB1cyBhIHdheSB0byBvcHRpbWl6ZSB0aGUgaW5jaXJjbGUgdGVzdFxuICAgICAqIEBwYXJhbSBwYSAtIHRyaWFuZ2xlIHBvaW50LCBvcHBvc2l0ZSBkXG4gICAgICogQHBhcmFtIHBiIC0gdHJpYW5nbGUgcG9pbnRcbiAgICAgKiBAcGFyYW0gcGMgLSB0cmlhbmdsZSBwb2ludFxuICAgICAqIEBwYXJhbSBwZCAtIHBvaW50IG9wcG9zaXRlIGFcbiAgICAgKiBAcmV0dXJuIHRydWUgaWYgZCBpcyBpbnNpZGUgY2lyY2xlLCBmYWxzZSBpZiBvbiBjaXJjbGUgZWRnZVxuICAgICAqL1xuICAgIFN3ZWVwLmluQ2lyY2xlID0gZnVuY3Rpb24ocGEsIHBiLCBwYywgcGQpIHtcbiAgICAgICAgdmFyIGFkeCA9IHBhLnggLSBwZC54O1xuICAgICAgICB2YXIgYWR5ID0gcGEueSAtIHBkLnk7XG4gICAgICAgIHZhciBiZHggPSBwYi54IC0gcGQueDtcbiAgICAgICAgdmFyIGJkeSA9IHBiLnkgLSBwZC55O1xuXG4gICAgICAgIHZhciBhZHhiZHkgPSBhZHggKiBiZHk7XG4gICAgICAgIHZhciBiZHhhZHkgPSBiZHggKiBhZHk7XG4gICAgICAgIHZhciBvYWJkID0gYWR4YmR5IC0gYmR4YWR5O1xuICAgICAgICBpZiAob2FiZCA8PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgY2R4ID0gcGMueCAtIHBkLng7XG4gICAgICAgIHZhciBjZHkgPSBwYy55IC0gcGQueTtcblxuICAgICAgICB2YXIgY2R4YWR5ID0gY2R4ICogYWR5O1xuICAgICAgICB2YXIgYWR4Y2R5ID0gYWR4ICogY2R5O1xuICAgICAgICB2YXIgb2NhZCA9IGNkeGFkeSAtIGFkeGNkeTtcbiAgICAgICAgaWYgKG9jYWQgPD0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGJkeGNkeSA9IGJkeCAqIGNkeTtcbiAgICAgICAgdmFyIGNkeGJkeSA9IGNkeCAqIGJkeTtcblxuICAgICAgICB2YXIgYWxpZnQgPSBhZHggKiBhZHggKyBhZHkgKiBhZHk7XG4gICAgICAgIHZhciBibGlmdCA9IGJkeCAqIGJkeCArIGJkeSAqIGJkeTtcbiAgICAgICAgdmFyIGNsaWZ0ID0gY2R4ICogY2R4ICsgY2R5ICogY2R5O1xuXG4gICAgICAgIHZhciBkZXQgPSBhbGlmdCAqIChiZHhjZHkgLSBjZHhiZHkpICsgYmxpZnQgKiBvY2FkICsgY2xpZnQgKiBvYWJkO1xuICAgICAgICByZXR1cm4gZGV0ID4gMDtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogUm90YXRlcyBhIHRyaWFuZ2xlIHBhaXIgb25lIHZlcnRleCBDV1xuICAgICAqPHByZT5cbiAgICAgKiAgICAgICBuMiAgICAgICAgICAgICAgICAgICAgbjJcbiAgICAgKiAgUCArLS0tLS0rICAgICAgICAgICAgIFAgKy0tLS0tK1xuICAgICAqICAgIHwgdCAgL3wgICAgICAgICAgICAgICB8XFwgIHQgfFxuICAgICAqICAgIHwgICAvIHwgICAgICAgICAgICAgICB8IFxcICAgfFxuICAgICAqICBuMXwgIC8gIHxuMyAgICAgICAgICAgbjF8ICBcXCAgfG4zXG4gICAgICogICAgfCAvICAgfCAgICBhZnRlciBDVyAgIHwgICBcXCB8XG4gICAgICogICAgfC8gb1QgfCAgICAgICAgICAgICAgIHwgb1QgXFx8XG4gICAgICogICAgKy0tLS0tKyBvUCAgICAgICAgICAgICstLS0tLStcbiAgICAgKiAgICAgICBuNCAgICAgICAgICAgICAgICAgICAgbjRcbiAgICAgKiA8L3ByZT5cbiAgICAgKi9cbiAgICBTd2VlcC5yb3RhdGVUcmlhbmdsZVBhaXIgPSBmdW5jdGlvbih0LCBwLCBvdCwgb3ApIHtcbiAgICAgICAgdmFyIG4xLCBuMiwgbjMsIG40O1xuICAgICAgICBuMSA9IHQubmVpZ2hib3JDQ1cocCk7XG4gICAgICAgIG4yID0gdC5uZWlnaGJvckNXKHApO1xuICAgICAgICBuMyA9IG90Lm5laWdoYm9yQ0NXKG9wKTtcbiAgICAgICAgbjQgPSBvdC5uZWlnaGJvckNXKG9wKTtcblxuICAgICAgICB2YXIgY2UxLCBjZTIsIGNlMywgY2U0O1xuICAgICAgICBjZTEgPSB0LmdldENvbnN0cmFpbmVkRWRnZUNDVyhwKTtcbiAgICAgICAgY2UyID0gdC5nZXRDb25zdHJhaW5lZEVkZ2VDVyhwKTtcbiAgICAgICAgY2UzID0gb3QuZ2V0Q29uc3RyYWluZWRFZGdlQ0NXKG9wKTtcbiAgICAgICAgY2U0ID0gb3QuZ2V0Q29uc3RyYWluZWRFZGdlQ1cob3ApO1xuXG4gICAgICAgIHZhciBkZTEsIGRlMiwgZGUzLCBkZTQ7XG4gICAgICAgIGRlMSA9IHQuZ2V0RGVsYXVuYXlFZGdlQ0NXKHApO1xuICAgICAgICBkZTIgPSB0LmdldERlbGF1bmF5RWRnZUNXKHApO1xuICAgICAgICBkZTMgPSBvdC5nZXREZWxhdW5heUVkZ2VDQ1cob3ApO1xuICAgICAgICBkZTQgPSBvdC5nZXREZWxhdW5heUVkZ2VDVyhvcCk7XG5cbiAgICAgICAgdC5sZWdhbGl6ZShwLCBvcCk7XG4gICAgICAgIG90LmxlZ2FsaXplKG9wLCBwKTtcblxuICAgICAgICAvLyBSZW1hcCBkZWxhdW5heV9lZGdlXG4gICAgICAgIG90LnNldERlbGF1bmF5RWRnZUNDVyhwLCBkZTEpO1xuICAgICAgICB0LnNldERlbGF1bmF5RWRnZUNXKHAsIGRlMik7XG4gICAgICAgIHQuc2V0RGVsYXVuYXlFZGdlQ0NXKG9wLCBkZTMpO1xuICAgICAgICBvdC5zZXREZWxhdW5heUVkZ2VDVyhvcCwgZGU0KTtcblxuICAgICAgICAvLyBSZW1hcCBjb25zdHJhaW5lZF9lZGdlXG4gICAgICAgIG90LnNldENvbnN0cmFpbmVkRWRnZUNDVyhwLCBjZTEpO1xuICAgICAgICB0LnNldENvbnN0cmFpbmVkRWRnZUNXKHAsIGNlMik7XG4gICAgICAgIHQuc2V0Q29uc3RyYWluZWRFZGdlQ0NXKG9wLCBjZTMpO1xuICAgICAgICBvdC5zZXRDb25zdHJhaW5lZEVkZ2VDVyhvcCwgY2U0KTtcblxuICAgICAgICAvLyBSZW1hcCBuZWlnaGJvcnNcbiAgICAgICAgLy8gWFhYOiBtaWdodCBvcHRpbWl6ZSB0aGUgbWFya05laWdoYm9yIGJ5IGtlZXBpbmcgdHJhY2sgb2ZcbiAgICAgICAgLy8gICAgICB3aGF0IHNpZGUgc2hvdWxkIGJlIGFzc2lnbmVkIHRvIHdoYXQgbmVpZ2hib3IgYWZ0ZXIgdGhlXG4gICAgICAgIC8vICAgICAgcm90YXRpb24uIE5vdyBtYXJrIG5laWdoYm9yIGRvZXMgbG90cyBvZiB0ZXN0aW5nIHRvIGZpbmRcbiAgICAgICAgLy8gICAgICB0aGUgcmlnaHQgc2lkZS5cbiAgICAgICAgdC5jbGVhck5laWdib3JzKCk7XG4gICAgICAgIG90LmNsZWFyTmVpZ2JvcnMoKTtcbiAgICAgICAgaWYgKG4xKSB7XG4gICAgICAgICAgICBvdC5tYXJrTmVpZ2hib3IobjEpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChuMikge1xuICAgICAgICAgICAgdC5tYXJrTmVpZ2hib3IobjIpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChuMykge1xuICAgICAgICAgICAgdC5tYXJrTmVpZ2hib3IobjMpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChuNCkge1xuICAgICAgICAgICAgb3QubWFya05laWdoYm9yKG40KTtcbiAgICAgICAgfVxuICAgICAgICB0Lm1hcmtOZWlnaGJvcihvdCk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEZpbGxzIGEgYmFzaW4gdGhhdCBoYXMgZm9ybWVkIG9uIHRoZSBBZHZhbmNpbmcgRnJvbnQgdG8gdGhlIHJpZ2h0XG4gICAgICogb2YgZ2l2ZW4gbm9kZS48YnI+XG4gICAgICogRmlyc3Qgd2UgZGVjaWRlIGEgbGVmdCxib3R0b20gYW5kIHJpZ2h0IG5vZGUgdGhhdCBmb3JtcyB0aGVcbiAgICAgKiBib3VuZGFyaWVzIG9mIHRoZSBiYXNpbi4gVGhlbiB3ZSBkbyBhIHJlcXVyc2l2ZSBmaWxsLlxuICAgICAqXG4gICAgICogQHBhcmFtIHRjeFxuICAgICAqIEBwYXJhbSBub2RlIC0gc3RhcnRpbmcgbm9kZSwgdGhpcyBvciBuZXh0IG5vZGUgd2lsbCBiZSBsZWZ0IG5vZGVcbiAgICAgKi9cbiAgICBTd2VlcC5maWxsQmFzaW4gPSBmdW5jdGlvbih0Y3gsIG5vZGUpIHtcbiAgICAgICAgaWYgKG9yaWVudDJkKG5vZGUucG9pbnQsIG5vZGUubmV4dC5wb2ludCwgbm9kZS5uZXh0Lm5leHQucG9pbnQpID09PSBPcmllbnRhdGlvbi5DQ1cpIHtcbiAgICAgICAgICAgIHRjeC5iYXNpbi5sZWZ0X25vZGUgPSBub2RlLm5leHQubmV4dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRjeC5iYXNpbi5sZWZ0X25vZGUgPSBub2RlLm5leHQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGaW5kIHRoZSBib3R0b20gYW5kIHJpZ2h0IG5vZGVcbiAgICAgICAgdGN4LmJhc2luLmJvdHRvbV9ub2RlID0gdGN4LmJhc2luLmxlZnRfbm9kZTtcbiAgICAgICAgd2hpbGUgKHRjeC5iYXNpbi5ib3R0b21fbm9kZS5uZXh0ICYmIHRjeC5iYXNpbi5ib3R0b21fbm9kZS5wb2ludC55ID49IHRjeC5iYXNpbi5ib3R0b21fbm9kZS5uZXh0LnBvaW50LnkpIHtcbiAgICAgICAgICAgIHRjeC5iYXNpbi5ib3R0b21fbm9kZSA9IHRjeC5iYXNpbi5ib3R0b21fbm9kZS5uZXh0O1xuICAgICAgICB9XG4gICAgICAgIGlmICh0Y3guYmFzaW4uYm90dG9tX25vZGUgPT09IHRjeC5iYXNpbi5sZWZ0X25vZGUpIHtcbiAgICAgICAgICAgIC8vIE5vIHZhbGlkIGJhc2luXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0Y3guYmFzaW4ucmlnaHRfbm9kZSA9IHRjeC5iYXNpbi5ib3R0b21fbm9kZTtcbiAgICAgICAgd2hpbGUgKHRjeC5iYXNpbi5yaWdodF9ub2RlLm5leHQgJiYgdGN4LmJhc2luLnJpZ2h0X25vZGUucG9pbnQueSA8IHRjeC5iYXNpbi5yaWdodF9ub2RlLm5leHQucG9pbnQueSkge1xuICAgICAgICAgICAgdGN4LmJhc2luLnJpZ2h0X25vZGUgPSB0Y3guYmFzaW4ucmlnaHRfbm9kZS5uZXh0O1xuICAgICAgICB9XG4gICAgICAgIGlmICh0Y3guYmFzaW4ucmlnaHRfbm9kZSA9PT0gdGN4LmJhc2luLmJvdHRvbV9ub2RlKSB7XG4gICAgICAgICAgICAvLyBObyB2YWxpZCBiYXNpbnNcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRjeC5iYXNpbi53aWR0aCA9IHRjeC5iYXNpbi5yaWdodF9ub2RlLnBvaW50LnggLSB0Y3guYmFzaW4ubGVmdF9ub2RlLnBvaW50Lng7XG4gICAgICAgIHRjeC5iYXNpbi5sZWZ0X2hpZ2hlc3QgPSB0Y3guYmFzaW4ubGVmdF9ub2RlLnBvaW50LnkgPiB0Y3guYmFzaW4ucmlnaHRfbm9kZS5wb2ludC55O1xuXG4gICAgICAgIFN3ZWVwLmZpbGxCYXNpblJlcSh0Y3gsIHRjeC5iYXNpbi5ib3R0b21fbm9kZSk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFJlY3Vyc2l2ZSBhbGdvcml0aG0gdG8gZmlsbCBhIEJhc2luIHdpdGggdHJpYW5nbGVzXG4gICAgICpcbiAgICAgKiBAcGFyYW0gdGN4XG4gICAgICogQHBhcmFtIG5vZGUgLSBib3R0b21fbm9kZVxuICAgICAqL1xuICAgIFN3ZWVwLmZpbGxCYXNpblJlcSA9IGZ1bmN0aW9uKHRjeCwgbm9kZSkge1xuICAgICAgICAvLyBpZiBzaGFsbG93IHN0b3AgZmlsbGluZ1xuICAgICAgICBpZiAoU3dlZXAuaXNTaGFsbG93KHRjeCwgbm9kZSkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIFN3ZWVwLmZpbGwodGN4LCBub2RlKTtcblxuICAgICAgICB2YXIgbztcbiAgICAgICAgaWYgKG5vZGUucHJldiA9PT0gdGN4LmJhc2luLmxlZnRfbm9kZSAmJiBub2RlLm5leHQgPT09IHRjeC5iYXNpbi5yaWdodF9ub2RlKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0gZWxzZSBpZiAobm9kZS5wcmV2ID09PSB0Y3guYmFzaW4ubGVmdF9ub2RlKSB7XG4gICAgICAgICAgICBvID0gb3JpZW50MmQobm9kZS5wb2ludCwgbm9kZS5uZXh0LnBvaW50LCBub2RlLm5leHQubmV4dC5wb2ludCk7XG4gICAgICAgICAgICBpZiAobyA9PT0gT3JpZW50YXRpb24uQ1cpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBub2RlID0gbm9kZS5uZXh0O1xuICAgICAgICB9IGVsc2UgaWYgKG5vZGUubmV4dCA9PT0gdGN4LmJhc2luLnJpZ2h0X25vZGUpIHtcbiAgICAgICAgICAgIG8gPSBvcmllbnQyZChub2RlLnBvaW50LCBub2RlLnByZXYucG9pbnQsIG5vZGUucHJldi5wcmV2LnBvaW50KTtcbiAgICAgICAgICAgIGlmIChvID09PSBPcmllbnRhdGlvbi5DQ1cpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBub2RlID0gbm9kZS5wcmV2O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gQ29udGludWUgd2l0aCB0aGUgbmVpZ2hib3Igbm9kZSB3aXRoIGxvd2VzdCBZIHZhbHVlXG4gICAgICAgICAgICBpZiAobm9kZS5wcmV2LnBvaW50LnkgPCBub2RlLm5leHQucG9pbnQueSkge1xuICAgICAgICAgICAgICAgIG5vZGUgPSBub2RlLnByZXY7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5vZGUgPSBub2RlLm5leHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBTd2VlcC5maWxsQmFzaW5SZXEodGN4LCBub2RlKTtcbiAgICB9O1xuXG4gICAgU3dlZXAuaXNTaGFsbG93ID0gZnVuY3Rpb24odGN4LCBub2RlKSB7XG4gICAgICAgIHZhciBoZWlnaHQ7XG4gICAgICAgIGlmICh0Y3guYmFzaW4ubGVmdF9oaWdoZXN0KSB7XG4gICAgICAgICAgICBoZWlnaHQgPSB0Y3guYmFzaW4ubGVmdF9ub2RlLnBvaW50LnkgLSBub2RlLnBvaW50Lnk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBoZWlnaHQgPSB0Y3guYmFzaW4ucmlnaHRfbm9kZS5wb2ludC55IC0gbm9kZS5wb2ludC55O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgc2hhbGxvdyBzdG9wIGZpbGxpbmdcbiAgICAgICAgaWYgKHRjeC5iYXNpbi53aWR0aCA+IGhlaWdodCkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH07XG5cbiAgICBTd2VlcC5maWxsRWRnZUV2ZW50ID0gZnVuY3Rpb24odGN4LCBlZGdlLCBub2RlKSB7XG4gICAgICAgIGlmICh0Y3guZWRnZV9ldmVudC5yaWdodCkge1xuICAgICAgICAgICAgU3dlZXAuZmlsbFJpZ2h0QWJvdmVFZGdlRXZlbnQodGN4LCBlZGdlLCBub2RlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIFN3ZWVwLmZpbGxMZWZ0QWJvdmVFZGdlRXZlbnQodGN4LCBlZGdlLCBub2RlKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBTd2VlcC5maWxsUmlnaHRBYm92ZUVkZ2VFdmVudCA9IGZ1bmN0aW9uKHRjeCwgZWRnZSwgbm9kZSkge1xuICAgICAgICB3aGlsZSAobm9kZS5uZXh0LnBvaW50LnggPCBlZGdlLnAueCkge1xuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgbmV4dCBub2RlIGlzIGJlbG93IHRoZSBlZGdlXG4gICAgICAgICAgICBpZiAob3JpZW50MmQoZWRnZS5xLCBub2RlLm5leHQucG9pbnQsIGVkZ2UucCkgPT09IE9yaWVudGF0aW9uLkNDVykge1xuICAgICAgICAgICAgICAgIFN3ZWVwLmZpbGxSaWdodEJlbG93RWRnZUV2ZW50KHRjeCwgZWRnZSwgbm9kZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5vZGUgPSBub2RlLm5leHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgU3dlZXAuZmlsbFJpZ2h0QmVsb3dFZGdlRXZlbnQgPSBmdW5jdGlvbih0Y3gsIGVkZ2UsIG5vZGUpIHtcbiAgICAgICAgaWYgKG5vZGUucG9pbnQueCA8IGVkZ2UucC54KSB7XG4gICAgICAgICAgICBpZiAob3JpZW50MmQobm9kZS5wb2ludCwgbm9kZS5uZXh0LnBvaW50LCBub2RlLm5leHQubmV4dC5wb2ludCkgPT09IE9yaWVudGF0aW9uLkNDVykge1xuICAgICAgICAgICAgICAgIC8vIENvbmNhdmVcbiAgICAgICAgICAgICAgICBTd2VlcC5maWxsUmlnaHRDb25jYXZlRWRnZUV2ZW50KHRjeCwgZWRnZSwgbm9kZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIENvbnZleFxuICAgICAgICAgICAgICAgIFN3ZWVwLmZpbGxSaWdodENvbnZleEVkZ2VFdmVudCh0Y3gsIGVkZ2UsIG5vZGUpO1xuICAgICAgICAgICAgICAgIC8vIFJldHJ5IHRoaXMgb25lXG4gICAgICAgICAgICAgICAgU3dlZXAuZmlsbFJpZ2h0QmVsb3dFZGdlRXZlbnQodGN4LCBlZGdlLCBub2RlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBTd2VlcC5maWxsUmlnaHRDb25jYXZlRWRnZUV2ZW50ID0gZnVuY3Rpb24odGN4LCBlZGdlLCBub2RlKSB7XG4gICAgICAgIFN3ZWVwLmZpbGwodGN4LCBub2RlLm5leHQpO1xuICAgICAgICBpZiAobm9kZS5uZXh0LnBvaW50ICE9PSBlZGdlLnApIHtcbiAgICAgICAgICAgIC8vIE5leHQgYWJvdmUgb3IgYmVsb3cgZWRnZT9cbiAgICAgICAgICAgIGlmIChvcmllbnQyZChlZGdlLnEsIG5vZGUubmV4dC5wb2ludCwgZWRnZS5wKSA9PT0gT3JpZW50YXRpb24uQ0NXKSB7XG4gICAgICAgICAgICAgICAgLy8gQmVsb3dcbiAgICAgICAgICAgICAgICBpZiAob3JpZW50MmQobm9kZS5wb2ludCwgbm9kZS5uZXh0LnBvaW50LCBub2RlLm5leHQubmV4dC5wb2ludCkgPT09IE9yaWVudGF0aW9uLkNDVykge1xuICAgICAgICAgICAgICAgICAgICAvLyBOZXh0IGlzIGNvbmNhdmVcbiAgICAgICAgICAgICAgICAgICAgU3dlZXAuZmlsbFJpZ2h0Q29uY2F2ZUVkZ2VFdmVudCh0Y3gsIGVkZ2UsIG5vZGUpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIE5leHQgaXMgY29udmV4XG4gICAgICAgICAgICAgICAgICAgIC8qIGpzaGludCBub2VtcHR5OmZhbHNlICovXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIFN3ZWVwLmZpbGxSaWdodENvbnZleEVkZ2VFdmVudCA9IGZ1bmN0aW9uKHRjeCwgZWRnZSwgbm9kZSkge1xuICAgICAgICAvLyBOZXh0IGNvbmNhdmUgb3IgY29udmV4P1xuICAgICAgICBpZiAob3JpZW50MmQobm9kZS5uZXh0LnBvaW50LCBub2RlLm5leHQubmV4dC5wb2ludCwgbm9kZS5uZXh0Lm5leHQubmV4dC5wb2ludCkgPT09IE9yaWVudGF0aW9uLkNDVykge1xuICAgICAgICAgICAgLy8gQ29uY2F2ZVxuICAgICAgICAgICAgU3dlZXAuZmlsbFJpZ2h0Q29uY2F2ZUVkZ2VFdmVudCh0Y3gsIGVkZ2UsIG5vZGUubmV4dCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBDb252ZXhcbiAgICAgICAgICAgIC8vIE5leHQgYWJvdmUgb3IgYmVsb3cgZWRnZT9cbiAgICAgICAgICAgIGlmIChvcmllbnQyZChlZGdlLnEsIG5vZGUubmV4dC5uZXh0LnBvaW50LCBlZGdlLnApID09PSBPcmllbnRhdGlvbi5DQ1cpIHtcbiAgICAgICAgICAgICAgICAvLyBCZWxvd1xuICAgICAgICAgICAgICAgIFN3ZWVwLmZpbGxSaWdodENvbnZleEVkZ2VFdmVudCh0Y3gsIGVkZ2UsIG5vZGUubmV4dCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIEFib3ZlXG4gICAgICAgICAgICAgICAgLyoganNoaW50IG5vZW1wdHk6ZmFsc2UgKi9cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBTd2VlcC5maWxsTGVmdEFib3ZlRWRnZUV2ZW50ID0gZnVuY3Rpb24odGN4LCBlZGdlLCBub2RlKSB7XG4gICAgICAgIHdoaWxlIChub2RlLnByZXYucG9pbnQueCA+IGVkZ2UucC54KSB7XG4gICAgICAgICAgICAvLyBDaGVjayBpZiBuZXh0IG5vZGUgaXMgYmVsb3cgdGhlIGVkZ2VcbiAgICAgICAgICAgIGlmIChvcmllbnQyZChlZGdlLnEsIG5vZGUucHJldi5wb2ludCwgZWRnZS5wKSA9PT0gT3JpZW50YXRpb24uQ1cpIHtcbiAgICAgICAgICAgICAgICBTd2VlcC5maWxsTGVmdEJlbG93RWRnZUV2ZW50KHRjeCwgZWRnZSwgbm9kZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5vZGUgPSBub2RlLnByZXY7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgU3dlZXAuZmlsbExlZnRCZWxvd0VkZ2VFdmVudCA9IGZ1bmN0aW9uKHRjeCwgZWRnZSwgbm9kZSkge1xuICAgICAgICBpZiAobm9kZS5wb2ludC54ID4gZWRnZS5wLngpIHtcbiAgICAgICAgICAgIGlmIChvcmllbnQyZChub2RlLnBvaW50LCBub2RlLnByZXYucG9pbnQsIG5vZGUucHJldi5wcmV2LnBvaW50KSA9PT0gT3JpZW50YXRpb24uQ1cpIHtcbiAgICAgICAgICAgICAgICAvLyBDb25jYXZlXG4gICAgICAgICAgICAgICAgU3dlZXAuZmlsbExlZnRDb25jYXZlRWRnZUV2ZW50KHRjeCwgZWRnZSwgbm9kZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIENvbnZleFxuICAgICAgICAgICAgICAgIFN3ZWVwLmZpbGxMZWZ0Q29udmV4RWRnZUV2ZW50KHRjeCwgZWRnZSwgbm9kZSk7XG4gICAgICAgICAgICAgICAgLy8gUmV0cnkgdGhpcyBvbmVcbiAgICAgICAgICAgICAgICBTd2VlcC5maWxsTGVmdEJlbG93RWRnZUV2ZW50KHRjeCwgZWRnZSwgbm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgU3dlZXAuZmlsbExlZnRDb252ZXhFZGdlRXZlbnQgPSBmdW5jdGlvbih0Y3gsIGVkZ2UsIG5vZGUpIHtcbiAgICAgICAgLy8gTmV4dCBjb25jYXZlIG9yIGNvbnZleD9cbiAgICAgICAgaWYgKG9yaWVudDJkKG5vZGUucHJldi5wb2ludCwgbm9kZS5wcmV2LnByZXYucG9pbnQsIG5vZGUucHJldi5wcmV2LnByZXYucG9pbnQpID09PSBPcmllbnRhdGlvbi5DVykge1xuICAgICAgICAgICAgLy8gQ29uY2F2ZVxuICAgICAgICAgICAgU3dlZXAuZmlsbExlZnRDb25jYXZlRWRnZUV2ZW50KHRjeCwgZWRnZSwgbm9kZS5wcmV2KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIENvbnZleFxuICAgICAgICAgICAgLy8gTmV4dCBhYm92ZSBvciBiZWxvdyBlZGdlP1xuICAgICAgICAgICAgaWYgKG9yaWVudDJkKGVkZ2UucSwgbm9kZS5wcmV2LnByZXYucG9pbnQsIGVkZ2UucCkgPT09IE9yaWVudGF0aW9uLkNXKSB7XG4gICAgICAgICAgICAgICAgLy8gQmVsb3dcbiAgICAgICAgICAgICAgICBTd2VlcC5maWxsTGVmdENvbnZleEVkZ2VFdmVudCh0Y3gsIGVkZ2UsIG5vZGUucHJldik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIEFib3ZlXG4gICAgICAgICAgICAgICAgLyoganNoaW50IG5vZW1wdHk6ZmFsc2UgKi9cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBTd2VlcC5maWxsTGVmdENvbmNhdmVFZGdlRXZlbnQgPSBmdW5jdGlvbih0Y3gsIGVkZ2UsIG5vZGUpIHtcbiAgICAgICAgU3dlZXAuZmlsbCh0Y3gsIG5vZGUucHJldik7XG4gICAgICAgIGlmIChub2RlLnByZXYucG9pbnQgIT09IGVkZ2UucCkge1xuICAgICAgICAgICAgLy8gTmV4dCBhYm92ZSBvciBiZWxvdyBlZGdlP1xuICAgICAgICAgICAgaWYgKG9yaWVudDJkKGVkZ2UucSwgbm9kZS5wcmV2LnBvaW50LCBlZGdlLnApID09PSBPcmllbnRhdGlvbi5DVykge1xuICAgICAgICAgICAgICAgIC8vIEJlbG93XG4gICAgICAgICAgICAgICAgaWYgKG9yaWVudDJkKG5vZGUucG9pbnQsIG5vZGUucHJldi5wb2ludCwgbm9kZS5wcmV2LnByZXYucG9pbnQpID09PSBPcmllbnRhdGlvbi5DVykge1xuICAgICAgICAgICAgICAgICAgICAvLyBOZXh0IGlzIGNvbmNhdmVcbiAgICAgICAgICAgICAgICAgICAgU3dlZXAuZmlsbExlZnRDb25jYXZlRWRnZUV2ZW50KHRjeCwgZWRnZSwgbm9kZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gTmV4dCBpcyBjb252ZXhcbiAgICAgICAgICAgICAgICAgICAgLyoganNoaW50IG5vZW1wdHk6ZmFsc2UgKi9cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgU3dlZXAuZmxpcEVkZ2VFdmVudCA9IGZ1bmN0aW9uKHRjeCwgZXAsIGVxLCB0LCBwKSB7XG4gICAgICAgIHZhciBvdCA9IHQubmVpZ2hib3JBY3Jvc3MocCk7XG4gICAgICAgIGlmICghb3QpIHtcbiAgICAgICAgICAgIC8vIElmIHdlIHdhbnQgdG8gaW50ZWdyYXRlIHRoZSBmaWxsRWRnZUV2ZW50IGRvIGl0IGhlcmVcbiAgICAgICAgICAgIC8vIFdpdGggY3VycmVudCBpbXBsZW1lbnRhdGlvbiB3ZSBzaG91bGQgbmV2ZXIgZ2V0IGhlcmVcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigncG9seTJ0cmkgW0JVRzpGSVhNRV0gRkxJUCBmYWlsZWQgZHVlIHRvIG1pc3NpbmcgdHJpYW5nbGUhJyk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIG9wID0gb3Qub3Bwb3NpdGVQb2ludCh0LCBwKTtcblxuICAgICAgICBpZiAoaW5TY2FuQXJlYShwLCB0LnBvaW50Q0NXKHApLCB0LnBvaW50Q1cocCksIG9wKSkge1xuICAgICAgICAgICAgLy8gTGV0cyByb3RhdGUgc2hhcmVkIGVkZ2Ugb25lIHZlcnRleCBDV1xuICAgICAgICAgICAgU3dlZXAucm90YXRlVHJpYW5nbGVQYWlyKHQsIHAsIG90LCBvcCk7XG4gICAgICAgICAgICB0Y3gubWFwVHJpYW5nbGVUb05vZGVzKHQpO1xuICAgICAgICAgICAgdGN4Lm1hcFRyaWFuZ2xlVG9Ob2RlcyhvdCk7XG5cbiAgICAgICAgICAgIC8vIFhYWDogaW4gdGhlIG9yaWdpbmFsIEMrKyBjb2RlIGZvciB0aGUgbmV4dCAyIGxpbmVzLCB3ZSBhcmVcbiAgICAgICAgICAgIC8vIGNvbXBhcmluZyBwb2ludCB2YWx1ZXMgKGFuZCBub3QgcG9pbnRlcnMpLiBJbiB0aGlzIEphdmFTY3JpcHRcbiAgICAgICAgICAgIC8vIGNvZGUsIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcyAocG9pbnRlcnMpLiBUaGlzIHdvcmtzXG4gICAgICAgICAgICAvLyBiZWNhdXNlIHdlIGNhbid0IGhhdmUgMiBkaWZmZXJlbnQgcG9pbnRzIHdpdGggdGhlIHNhbWUgdmFsdWVzLlxuICAgICAgICAgICAgLy8gQnV0IHRvIGJlIHJlYWxseSBlcXVpdmFsZW50LCB3ZSBzaG91bGQgdXNlIFwiUG9pbnQuZXF1YWxzXCIgaGVyZS5cbiAgICAgICAgICAgIGlmIChwID09PSBlcSAmJiBvcCA9PT0gZXApIHtcbiAgICAgICAgICAgICAgICBpZiAoZXEgPT09IHRjeC5lZGdlX2V2ZW50LmNvbnN0cmFpbmVkX2VkZ2UucSAmJiBlcCA9PT0gdGN4LmVkZ2VfZXZlbnQuY29uc3RyYWluZWRfZWRnZS5wKSB7XG4gICAgICAgICAgICAgICAgICAgIHQubWFya0NvbnN0cmFpbmVkRWRnZUJ5UG9pbnRzKGVwLCBlcSk7XG4gICAgICAgICAgICAgICAgICAgIG90Lm1hcmtDb25zdHJhaW5lZEVkZ2VCeVBvaW50cyhlcCwgZXEpO1xuICAgICAgICAgICAgICAgICAgICBTd2VlcC5sZWdhbGl6ZSh0Y3gsIHQpO1xuICAgICAgICAgICAgICAgICAgICBTd2VlcC5sZWdhbGl6ZSh0Y3gsIG90KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBYWFg6IEkgdGhpbmsgb25lIG9mIHRoZSB0cmlhbmdsZXMgc2hvdWxkIGJlIGxlZ2FsaXplZCBoZXJlP1xuICAgICAgICAgICAgICAgICAgICAvKiBqc2hpbnQgbm9lbXB0eTpmYWxzZSAqL1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIG8gPSBvcmllbnQyZChlcSwgb3AsIGVwKTtcbiAgICAgICAgICAgICAgICB0ID0gU3dlZXAubmV4dEZsaXBUcmlhbmdsZSh0Y3gsIG8sIHQsIG90LCBwLCBvcCk7XG4gICAgICAgICAgICAgICAgU3dlZXAuZmxpcEVkZ2VFdmVudCh0Y3gsIGVwLCBlcSwgdCwgcCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgbmV3UCA9IFN3ZWVwLm5leHRGbGlwUG9pbnQoZXAsIGVxLCBvdCwgb3ApO1xuICAgICAgICAgICAgU3dlZXAuZmxpcFNjYW5FZGdlRXZlbnQodGN4LCBlcCwgZXEsIHQsIG90LCBuZXdQKTtcbiAgICAgICAgICAgIFN3ZWVwLmVkZ2VFdmVudEJ5UG9pbnRzKHRjeCwgZXAsIGVxLCB0LCBwKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBTd2VlcC5uZXh0RmxpcFRyaWFuZ2xlID0gZnVuY3Rpb24odGN4LCBvLCB0LCBvdCwgcCwgb3ApIHtcbiAgICAgICAgdmFyIGVkZ2VfaW5kZXg7XG4gICAgICAgIGlmIChvID09PSBPcmllbnRhdGlvbi5DQ1cpIHtcbiAgICAgICAgICAgIC8vIG90IGlzIG5vdCBjcm9zc2luZyBlZGdlIGFmdGVyIGZsaXBcbiAgICAgICAgICAgIGVkZ2VfaW5kZXggPSBvdC5lZGdlSW5kZXgocCwgb3ApO1xuICAgICAgICAgICAgb3QuZGVsYXVuYXlfZWRnZVtlZGdlX2luZGV4XSA9IHRydWU7XG4gICAgICAgICAgICBTd2VlcC5sZWdhbGl6ZSh0Y3gsIG90KTtcbiAgICAgICAgICAgIG90LmNsZWFyRGVsdW5heUVkZ2VzKCk7XG4gICAgICAgICAgICByZXR1cm4gdDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHQgaXMgbm90IGNyb3NzaW5nIGVkZ2UgYWZ0ZXIgZmxpcFxuICAgICAgICBlZGdlX2luZGV4ID0gdC5lZGdlSW5kZXgocCwgb3ApO1xuXG4gICAgICAgIHQuZGVsYXVuYXlfZWRnZVtlZGdlX2luZGV4XSA9IHRydWU7XG4gICAgICAgIFN3ZWVwLmxlZ2FsaXplKHRjeCwgdCk7XG4gICAgICAgIHQuY2xlYXJEZWx1bmF5RWRnZXMoKTtcbiAgICAgICAgcmV0dXJuIG90O1xuICAgIH07XG5cbiAgICBTd2VlcC5uZXh0RmxpcFBvaW50ID0gZnVuY3Rpb24oZXAsIGVxLCBvdCwgb3ApIHtcbiAgICAgICAgdmFyIG8yZCA9IG9yaWVudDJkKGVxLCBvcCwgZXApO1xuICAgICAgICBpZiAobzJkID09PSBPcmllbnRhdGlvbi5DVykge1xuICAgICAgICAgICAgLy8gUmlnaHRcbiAgICAgICAgICAgIHJldHVybiBvdC5wb2ludENDVyhvcCk7XG4gICAgICAgIH0gZWxzZSBpZiAobzJkID09PSBPcmllbnRhdGlvbi5DQ1cpIHtcbiAgICAgICAgICAgIC8vIExlZnRcbiAgICAgICAgICAgIHJldHVybiBvdC5wb2ludENXKG9wKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBQb2ludEVycm9yKFwicG9seTJ0cmkgW1Vuc3VwcG9ydGVkXSBuZXh0RmxpcFBvaW50OiBvcHBvc2luZyBwb2ludCBvbiBjb25zdHJhaW5lZCBlZGdlIVwiLCBbZXEsIG9wLCBlcF0pO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIFN3ZWVwLmZsaXBTY2FuRWRnZUV2ZW50ID0gZnVuY3Rpb24odGN4LCBlcCwgZXEsIGZsaXBfdHJpYW5nbGUsIHQsIHApIHtcbiAgICAgICAgdmFyIG90ID0gdC5uZWlnaGJvckFjcm9zcyhwKTtcbiAgICAgICAgaWYgKCFvdCkge1xuICAgICAgICAgICAgLy8gSWYgd2Ugd2FudCB0byBpbnRlZ3JhdGUgdGhlIGZpbGxFZGdlRXZlbnQgZG8gaXQgaGVyZVxuICAgICAgICAgICAgLy8gV2l0aCBjdXJyZW50IGltcGxlbWVudGF0aW9uIHdlIHNob3VsZCBuZXZlciBnZXQgaGVyZVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdwb2x5MnRyaSBbQlVHOkZJWE1FXSBGTElQIGZhaWxlZCBkdWUgdG8gbWlzc2luZyB0cmlhbmdsZScpO1xuICAgICAgICB9XG4gICAgICAgIHZhciBvcCA9IG90Lm9wcG9zaXRlUG9pbnQodCwgcCk7XG5cbiAgICAgICAgaWYgKGluU2NhbkFyZWEoZXEsIGZsaXBfdHJpYW5nbGUucG9pbnRDQ1coZXEpLCBmbGlwX3RyaWFuZ2xlLnBvaW50Q1coZXEpLCBvcCkpIHtcbiAgICAgICAgICAgIC8vIGZsaXAgd2l0aCBuZXcgZWRnZSBvcC5lcVxuICAgICAgICAgICAgU3dlZXAuZmxpcEVkZ2VFdmVudCh0Y3gsIGVxLCBvcCwgb3QsIG9wKTtcbiAgICAgICAgICAgIC8vIFRPRE86IEFjdHVhbGx5IEkganVzdCBmaWd1cmVkIG91dCB0aGF0IGl0IHNob3VsZCBiZSBwb3NzaWJsZSB0b1xuICAgICAgICAgICAgLy8gICAgICAgaW1wcm92ZSB0aGlzIGJ5IGdldHRpbmcgdGhlIG5leHQgb3QgYW5kIG9wIGJlZm9yZSB0aGUgdGhlIGFib3ZlXG4gICAgICAgICAgICAvLyAgICAgICBmbGlwIGFuZCBjb250aW51ZSB0aGUgZmxpcFNjYW5FZGdlRXZlbnQgaGVyZVxuICAgICAgICAgICAgLy8gc2V0IG5ldyBvdCBhbmQgb3AgaGVyZSBhbmQgbG9vcCBiYWNrIHRvIGluU2NhbkFyZWEgdGVzdFxuICAgICAgICAgICAgLy8gYWxzbyBuZWVkIHRvIHNldCBhIG5ldyBmbGlwX3RyaWFuZ2xlIGZpcnN0XG4gICAgICAgICAgICAvLyBUdXJucyBvdXQgYXQgZmlyc3QgZ2xhbmNlIHRoYXQgdGhpcyBpcyBzb21ld2hhdCBjb21wbGljYXRlZFxuICAgICAgICAgICAgLy8gc28gaXQgd2lsbCBoYXZlIHRvIHdhaXQuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgbmV3UCA9IFN3ZWVwLm5leHRGbGlwUG9pbnQoZXAsIGVxLCBvdCwgb3ApO1xuICAgICAgICAgICAgU3dlZXAuZmxpcFNjYW5FZGdlRXZlbnQodGN4LCBlcCwgZXEsIGZsaXBfdHJpYW5nbGUsIG90LCBuZXdQKTtcbiAgICAgICAgfVxuICAgIH07XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLUV4cG9ydHMgKHB1YmxpYyBBUEkpXG5cbiAgICBwb2x5MnRyaS5Qb2ludEVycm9yICAgICA9IFBvaW50RXJyb3I7XG4gICAgcG9seTJ0cmkuUG9pbnQgICAgICAgICAgPSBQb2ludDtcbiAgICBwb2x5MnRyaS5UcmlhbmdsZSAgICAgICA9IFRyaWFuZ2xlO1xuICAgIHBvbHkydHJpLlN3ZWVwQ29udGV4dCAgID0gU3dlZXBDb250ZXh0O1xuXG4gICAgLy8gQmFja3dhcmQgY29tcGF0aWJpbGl0eVxuICAgIHBvbHkydHJpLnRyaWFuZ3VsYXRlICAgID0gU3dlZXAudHJpYW5ndWxhdGU7XG4gICAgcG9seTJ0cmkuc3dlZXAgPSB7VHJpYW5ndWxhdGU6IFN3ZWVwLnRyaWFuZ3VsYXRlfTtcblxufSh0aGlzKSk7IiwidmFyIGdsTWF0cml4ID0gcmVxdWlyZSgnLi4vanMvZ2wtbWF0cml4LW1pbi5qcycpO1xudmFyIHZlYzMgPSBnbE1hdHJpeC52ZWMzO1xuXG5cbihmdW5jdGlvbihfZ2xvYmFsKSB7IFxuICBcInVzZSBzdHJpY3RcIjtcblxuICB2YXIgc2hpbSA9IHt9O1xuICBpZiAodHlwZW9mKGV4cG9ydHMpID09PSAndW5kZWZpbmVkJykge1xuICAgIGlmKHR5cGVvZiBkZWZpbmUgPT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PSAnb2JqZWN0JyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgICBzaGltLmV4cG9ydHMgPSB7fTtcbiAgICAgIGRlZmluZShmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHNoaW0uZXhwb3J0cztcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvL3RoaXMgdGhpbmcgbGl2ZXMgaW4gYSBicm93c2VyLCBkZWZpbmUgaXRzIG5hbWVzcGFjZXMgaW4gZ2xvYmFsXG4gICAgICBzaGltLmV4cG9ydHMgPSB0eXBlb2Yod2luZG93KSAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cgOiBfZ2xvYmFsO1xuICAgIH1cbiAgfVxuICBlbHNlIHtcbiAgICAvL3RoaXMgdGhpbmcgbGl2ZXMgaW4gY29tbW9uanMsIGRlZmluZSBpdHMgbmFtZXNwYWNlcyBpbiBleHBvcnRzXG4gICAgc2hpbS5leHBvcnRzID0gZXhwb3J0cztcbiAgfVxuICAoZnVuY3Rpb24oZXhwb3J0cykge1xuICBcbnZhciBnbDtcbnZhciB2Ym9NZXNoID0gZXhwb3J0cztcblxudmJvTWVzaC5zZXRHTCA9IGZ1bmN0aW9uKF9nbCkge1xuICBnbCA9IF9nbDtcbn1cblxudmJvTWVzaC5jcmVhdGUgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgdmJvID0ge307XG4gICAgdmJvLnZlcnRleERhdGEgPSBuZXcgRmxvYXQzMkFycmF5KDMqMTAwKTtcbiAgICB2Ym8ubnVtVmVydGljZXMgPSAwO1xuICAgIHZiby5pbmRleERhdGEgPSBuZXcgVWludDE2QXJyYXkoMyoxMDApO1xuICAgIHZiby5udW1JbmRpY2VzID0gMDtcbiAgICB2Ym8udmVydGV4QnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKCk7XG4gICAgdmJvLmluZGV4QnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKCk7XG4gICAgdmJvLm51bU5vcm1hbHMgPSAwO1xuICAgIHZiby5ub3JtYWxzRW5hYmxlZCA9IGZhbHNlO1xuICAgIHZiby5ub3JtYWxEYXRhID0gbnVsbDtcbiAgICB2Ym8uY29sb3JFbmFibGVkID0gZmFsc2U7XG4gICAgdmJvLmNvbG9yRGF0YT0gbnVsbDtcbiAgICB2Ym8ubm9ybWFsQnVmZmVyID0gbnVsbDtcbiAgICB2Ym8uY29sb3JCdWZmZXIgPSBudWxsO1xuICAgIHJldHVybiB2Ym87XG59O1xuXG52Ym9NZXNoLmNyZWF0ZTMyID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHZibyA9IHt9O1xuICAgIHZiby52ZXJ0ZXhEYXRhID0gbmV3IEZsb2F0MzJBcnJheSgzKjEwMDApO1xuICAgIHZiby5udW1WZXJ0aWNlcyA9IDA7XG4gICAgdmJvLmluZGV4RGF0YSA9IG5ldyBVaW50MzJBcnJheSgzKjEwMDApO1xuICAgIHZiby5udW1JbmRpY2VzID0gMDtcbiAgICB2Ym8udmVydGV4QnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKCk7XG4gICAgdmJvLmluZGV4QnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKCk7XG4gICAgdmJvLm5vcm1hbHNFbmFibGVkID0gZmFsc2U7XG4gICAgdmJvLm51bU5vcm1hbHMgPSAwO1xuICAgIHZiby5ub3JtYWxEYXRhID0gbnVsbDtcbiAgICB2Ym8uY29sb3JEYXRhPSBudWxsO1xuICAgIHZiby5ub3JtYWxCdWZmZXIgPSBudWxsO1xuICAgIHZiby5jb2xvckJ1ZmZlciA9IG51bGw7XG4gICAgcmV0dXJuIHZibztcbn07XG5cbnZib01lc2guY2xlYXIgPSBmdW5jdGlvbih2Ym8pIHtcbiAgICB2Ym8ubnVtVmVydGljZXMgPSAwO1xuICAgIHZiby5udW1JbmRpY2VzID0gMDtcbiAgICB2Ym8ubnVtTm9ybWFscyA9IDA7XG59XG5cbnZib01lc2guZW5hYmxlTm9ybWFscyA9IGZ1bmN0aW9uKHZibykge1xuICAgIGlmKCF2Ym8ubm9ybWFsc0VuYWJsZWQpIHtcbiAgICAgICAgdmJvLm5vcm1hbERhdGEgPSBuZXcgRmxvYXQzMkFycmF5KHZiby52ZXJ0ZXhEYXRhLmxlbmd0aCk7XG4gICAgICAgIGlmKHZiby5ub3JtYWxCdWZmZXIgPT09IG51bGwpIHZiby5ub3JtYWxCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgICAgICAgdmJvLm5vcm1hbHNFbmFibGVkID0gdHJ1ZTtcbiAgICB9XG59XG5cbnZib01lc2guZGlzYWJsZU5vcm1hbHMgPSBmdW5jdGlvbih2Ym8pIHtcbiAgICB2Ym8ubm9ybWFsRGF0YSA9IG51bGw7XG4gICAgaWYodmJvLm5vcm1hbEJ1ZmZlciAhPT0gbnVsbCkgZ2wuZGVsZXRlQnVmZmVyKHZiby5ub3JtYWxCdWZmZXIpO1xuICAgIHZiby5ub3JtYWxzRW5hYmxlZCA9IGZhbHNlO1xufVxuXG52Ym9NZXNoLmVuYWJsZUNvbG9yID0gZnVuY3Rpb24odmJvKSB7XG4gIGlmKCF2Ym8uY29sb3JFbmFibGVkKSB7XG4gICAgdmJvLmNvbG9yRGF0YSA9IG5ldyBVaW50OEFycmF5KHZiby52ZXJ0ZXhEYXRhLmxlbmd0aC8zKjQpO1xuICAgIGlmKHZiby5jb2xvckJ1ZmZlciA9PT0gbnVsbCkgdmJvLmNvbG9yQnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKCk7XG4gICAgdmJvLmNvbG9yRW5hYmxlZCA9IHRydWU7XG4gIH1cbn1cblxudmJvTWVzaC5kaXNhYmxlQ29sb3IgPSBmdW5jdGlvbih2Ym8pIHtcbiAgICB2Ym8uY29sb3JEYXRhID0gbnVsbDtcbiAgICBpZih2Ym8uY29sb3JCdWZmZXIgIT09IG51bGwpIGdsLmRlbGV0ZUJ1ZmZlcih2Ym8uY29sb3JCdWZmZXIpO1xuICAgIHZiby5jb2xvckVuYWJsZWQgPSBmYWxzZTtcbn1cblxudmJvTWVzaC5hZGRWZXJ0ZXggPSBmdW5jdGlvbih2Ym8sIHYsbikge1xuICAgIHZhciBpbmRleCA9IHZiby5udW1WZXJ0aWNlcyozO1xuXHRpZihpbmRleCA+PSB2Ym8udmVydGV4RGF0YS5sZW5ndGgpIHtcblx0XHR2YXIgbmV3RGF0YSA9IG5ldyBGbG9hdDMyQXJyYXkodmJvLnZlcnRleERhdGEubGVuZ3RoKjIpO1xuXHRcdG5ld0RhdGEuc2V0KHZiby52ZXJ0ZXhEYXRhKTtcblx0XHQvL2RvIGkgbmVlZCB0byBleHBsaWNpdGx5IGtpbGwgdGhlIG9sZCB2ZXJ0ZXhEYXRhP1xuXHRcdHZiby52ZXJ0ZXhEYXRhID0gbmV3RGF0YTtcbiAgICBpZih2Ym8ubm9ybWFsc0VuYWJsZWQpIHtcbiAgICAgICAgdmFyIG5ld0RhdGEgPSBuZXcgRmxvYXQzMkFycmF5KHZiby52ZXJ0ZXhEYXRhLmxlbmd0aCk7XG4gICAgICAgIG5ld0RhdGEuc2V0KHZiby5ub3JtYWxEYXRhKTtcbiAgICAgICAgLy9kbyBpIG5lZWQgdG8gZXhwbGljaXRseSBraWxsIHRoZSBvbGQgdmVydGV4RGF0YT9cbiAgICAgICAgdmJvLm5vcm1hbERhdGEgPSBuZXdEYXRhO1xuICAgIH1cbiAgICBpZih2Ym8uY29sb3JFbmFibGVkKSB7XG4gICAgICB2YXIgbmV3RGF0YSA9IG5ldyBVaW50OEFycmF5KHZiby52ZXJ0ZXhEYXRhLmxlbmd0aC8zKjQpO1xuICAgICAgbmV3RGF0YS5zZXQodmJvLmNvbG9yRGF0YSk7XG4gICAgICAvL2RvIGkgbmVlZCB0byBleHBsaWNpdGx5IGtpbGwgdGhlIG9sZCB2ZXJ0ZXhEYXRhP1xuICAgICAgdmJvLmNvbG9yRGF0YSA9IG5ld0RhdGE7XG4gICAgfVxuXHR9XG4gICAgdmJvLnZlcnRleERhdGFbaW5kZXhdID0gdlswXTtcbiAgICB2Ym8udmVydGV4RGF0YVtpbmRleCsxXSA9IHZbMV07XG4gICAgdmJvLnZlcnRleERhdGFbaW5kZXgrMl0gPSB2WzJdO1xuICAgIGlmKG4gJiYgdmJvLm5vcm1hbHNFbmFibGVkKSB7XG4gICAgICAgIHZiby5ub3JtYWxEYXRhW2luZGV4XSA9IG5bMF07XG4gICAgICAgIHZiby5ub3JtYWxEYXRhW2luZGV4KzFdID0gblsxXTtcbiAgICAgICAgdmJvLm5vcm1hbERhdGFbaW5kZXgrMl0gPSBuWzJdO1xuICAgIH1cbiAgICB2Ym8ubnVtVmVydGljZXMrKztcbn1cblxudmJvTWVzaC5nZXRWZXJ0ZXggPSBmdW5jdGlvbihvdXQsIHZibywgaSkge1xuICB2YXIgaTMgPSBpKjM7XG4gIG91dFswXSA9IHZiby52ZXJ0ZXhEYXRhW2kzXTtcbiAgb3V0WzFdID0gdmJvLnZlcnRleERhdGFbaTMrMV07XG4gIG91dFsyXSA9IHZiby52ZXJ0ZXhEYXRhW2kzKzJdO1xufVxuXG52Ym9NZXNoLnNldFZlcnRleCA9IGZ1bmN0aW9uKHZibywgaSwgcHQpIHtcbiAgdmFyIGkzID0gaSozO1xuICB2Ym8udmVydGV4RGF0YVtpM10gPSBwdFswXTtcbiAgdmJvLnZlcnRleERhdGFbaTMrMV0gPSBwdFsxXTtcbiAgdmJvLnZlcnRleERhdGFbaTMrMl0gPSBwdFsyXTtcbn1cblxudmJvTWVzaC5zZXROb3JtYWwgPSBmdW5jdGlvbih2Ym8sIGksIHB0KSB7XG4gIHZhciBpMyA9IGkqMztcbiAgdmJvLm5vcm1hbERhdGFbaTNdID0gcHRbMF07XG4gIHZiby5ub3JtYWxEYXRhW2kzKzFdID0gcHRbMV07XG4gIHZiby5ub3JtYWxEYXRhW2kzKzJdID0gcHRbMl07XG59XG5cbnZib01lc2guZ2V0Tm9ybWFsID0gZnVuY3Rpb24obiwgdmJvLCBpKSB7XG4gIHZhciBpMyA9IGkqMztcbiAgblswXSA9IHZiby5ub3JtYWxEYXRhW2kzXTtcbiAgblsxXSA9IHZiby5ub3JtYWxEYXRhW2kzKzFdO1xuICBuWzJdID0gdmJvLm5vcm1hbERhdGFbaTMrMl07XG59XG52Ym9NZXNoLnNldENvbG9yID0gZnVuY3Rpb24odmJvLCBpLCBjKSB7XG4gIHZhciBpNCA9IGkqNDtcbiAgdmJvLmNvbG9yRGF0YVtpNF0gPSBjWzBdO1xuICB2Ym8uY29sb3JEYXRhW2k0KzFdID0gY1sxXTtcbiAgdmJvLmNvbG9yRGF0YVtpNCsyXSA9IGNbMl07XG4gIHZiby5jb2xvckRhdGFbaTQrM10gPSBjWzNdID09PSB1bmRlZmluZWQgPyAyNTUgOiBjWzNdO1xufVxuXG52Ym9NZXNoLmFkZFRyaWFuZ2xlID0gZnVuY3Rpb24odmJvLCBpMSxpMixpMykge1xuXHRpZih2Ym8ubnVtSW5kaWNlcyA+PSB2Ym8uaW5kZXhEYXRhLmxlbmd0aCkge1xuXHRcdHZhciBuZXdEYXRhID0gbmV3IHZiby5pbmRleERhdGEuY29uc3RydWN0b3IodmJvLmluZGV4RGF0YS5sZW5ndGgqMik7XG5cdFx0bmV3RGF0YS5zZXQodmJvLmluZGV4RGF0YSk7XG5cdFx0Ly9kbyBpIG5lZWQgdG8gZXhwbGljaXRseSBraWxsIHRoZSBvbGQgdmVydGV4RGF0YT9cblx0XHR2Ym8uaW5kZXhEYXRhID0gbmV3RGF0YTtcblx0fVxuICAgIHZiby5pbmRleERhdGFbdmJvLm51bUluZGljZXMrK10gPSBpMTtcbiAgICB2Ym8uaW5kZXhEYXRhW3Ziby5udW1JbmRpY2VzKytdID0gaTI7XG4gICAgdmJvLmluZGV4RGF0YVt2Ym8ubnVtSW5kaWNlcysrXSA9IGkzO1xufVxuXG52Ym9NZXNoLmFkZEluZGljZXMgPSBmdW5jdGlvbih2Ym8sIGluZGljZXMsbnVtSW5kaWNlcykge1xuXHRpZih2Ym8ubnVtSW5kaWNlcytudW1JbmRpY2VzID49IHZiby5pbmRleERhdGEubGVuZ3RoKSB7XG5cdFx0dmFyIG5ld0RhdGEgPSBuZXcgdmJvLmluZGV4RGF0YS5jb25zdHJ1Y3RvcihNYXRoLm1heCh2Ym8uaW5kZXhEYXRhLmxlbmd0aCoyLHZiby5pbmRleERhdGEubGVuZ3RoK251bUluZGljZXMpKTtcblx0XHRuZXdEYXRhLnNldCh2Ym8uaW5kZXhEYXRhKTtcblx0XHQvL2RvIGkgbmVlZCB0byBleHBsaWNpdGx5IGtpbGwgdGhlIG9sZCB2ZXJ0ZXhEYXRhP1xuXHRcdHZiby5pbmRleERhdGEgPSBuZXdEYXRhO1xuXHR9XG4gIGZvcih2YXIgaT0wO2k8bnVtSW5kaWNlczsrK2kpIHtcbiAgICB2Ym8uaW5kZXhEYXRhW3Ziby5udW1JbmRpY2VzKytdID0gaW5kaWNlc1tpXTtcbiAgfVxufVxuXG52Ym9NZXNoLmFkZEluZGV4ID0gZnVuY3Rpb24odmJvLGluZGV4KSB7XG4gIGlmKHZiby5udW1JbmRpY2VzID49IHZiby5pbmRleERhdGEubGVuZ3RoKSB7XG5cdFx0dmFyIG5ld0RhdGEgPSBuZXcgdmJvLmluZGV4RGF0YS5jb25zdHJ1Y3Rvcih2Ym8uaW5kZXhEYXRhLmxlbmd0aCoyKTtcblx0XHRuZXdEYXRhLnNldCh2Ym8uaW5kZXhEYXRhKTtcblx0XHQvL2RvIGkgbmVlZCB0byBleHBsaWNpdGx5IGtpbGwgdGhlIG9sZCB2ZXJ0ZXhEYXRhP1xuXHRcdHZiby5pbmRleERhdGEgPSBuZXdEYXRhO1xuXHR9XG4gIHZiby5pbmRleERhdGFbdmJvLm51bUluZGljZXMrK10gPSBpbmRleDtcbn1cblxudmJvTWVzaC5hZGRMaW5lID0gZnVuY3Rpb24odmJvLCBpMSxpMikge1xuXHRpZih2Ym8ubnVtSW5kaWNlcyA+PSB2Ym8uaW5kZXhEYXRhLmxlbmd0aCkge1xuXHRcdHZhciBuZXdEYXRhID0gbmV3IHZiby5pbmRleERhdGEuY29uc3RydWN0b3IodmJvLmluZGV4RGF0YS5sZW5ndGgqMik7XG5cdFx0bmV3RGF0YS5zZXQodmJvLmluZGV4RGF0YSk7XG5cdFx0Ly9kbyBpIG5lZWQgdG8gZXhwbGljaXRseSBraWxsIHRoZSBvbGQgdmVydGV4RGF0YT9cblx0XHR2Ym8uaW5kZXhEYXRhID0gbmV3RGF0YTtcblx0fVxuICB2Ym8uaW5kZXhEYXRhW3Ziby5udW1JbmRpY2VzKytdID0gaTE7XG4gIHZiby5pbmRleERhdGFbdmJvLm51bUluZGljZXMrK10gPSBpMjtcbn1cblxudmJvTWVzaC5idWZmZXIgPSBmdW5jdGlvbih2Ym8pIHtcbiAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgdmJvLnZlcnRleEJ1ZmZlcik7XG4gICAgZ2wuYnVmZmVyRGF0YShnbC5BUlJBWV9CVUZGRVIsdmJvLnZlcnRleERhdGEsZ2wuU1RSRUFNX0RSQVcpO1xuICAgIGdsLmJpbmRCdWZmZXIoZ2wuRUxFTUVOVF9BUlJBWV9CVUZGRVIsIHZiby5pbmRleEJ1ZmZlcik7XG4gICAgZ2wuYnVmZmVyRGF0YShnbC5FTEVNRU5UX0FSUkFZX0JVRkZFUix2Ym8uaW5kZXhEYXRhLGdsLlNUUkVBTV9EUkFXKTtcbiAgICBpZih2Ym8ubm9ybWFsc0VuYWJsZWQpIHtcbiAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHZiby5ub3JtYWxCdWZmZXIpO1xuICAgICAgICBnbC5idWZmZXJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgdmJvLm5vcm1hbERhdGEsZ2wuU1RSRUFNX0RSQVcpO1xuICAgIH1cbn1cblxudmJvTWVzaC5jb21wdXRlU21vb3RoTm9ybWFscyA9IChmdW5jdGlvbigpIHtcbiAgICB2YXIgbm9ybSA9IHZlYzMuY3JlYXRlKCk7XG4gICAgdmFyIHAxID0gdmVjMy5jcmVhdGUoKSxcbiAgICAgICAgcDIgPSB2ZWMzLmNyZWF0ZSgpLFxuICAgICAgICBwMyA9IHZlYzMuY3JlYXRlKCk7XG4gICAgdmFyIHg9MC4wLHk9MC4wLHo9MC4wO1xuICAgIHZhciBpbnZMZW4gPSAwLjA7XG4gICAgdmFyIGRpcjEgPSB2ZWMzLmNyZWF0ZSgpLFxuICAgICAgICBkaXIyID0gdmVjMy5jcmVhdGUoKTtcbiAgICBmdW5jdGlvbiBwbGFuZU5vcm1hbChvdXQsdjEsdjIsdjMpIHtcbiAgICAgIHZlYzMuc3ViKGRpcjEsIHYxLHYyKTtcbiAgICAgIHZlYzMuc3ViKGRpcjIsIHYzLHYyKTtcbiAgICAgIHZlYzMuY3Jvc3Mob3V0LGRpcjIsZGlyMSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZ1bmN0aW9uIGNvbXB1dGVTbW9vdGhOb3JtYWxzKHZibykge1xuICAgICAgICB2Ym9NZXNoLmVuYWJsZU5vcm1hbHModmJvKTtcbiAgICAgICAgZm9yKHZhciBpPTA7aTx2Ym8ubnVtVmVydGljZXM7KytpKSB7XG4gICAgICAgICAgICB2YXIgaTMgPSBpKjM7XG4gICAgICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpM10gPSAwO1xuICAgICAgICAgICAgdmJvLm5vcm1hbERhdGFbaTMrMV0gPSAwO1xuICAgICAgICAgICAgdmJvLm5vcm1hbERhdGFbaTMrMl0gPSAwO1xuICAgICAgICB9XG4gICAgICAgIGZvcih2YXIgaT0wO2k8dmJvLm51bUluZGljZXM7KSB7XG4gICAgICAgICAgICB2YXIgaTEgPSB2Ym8uaW5kZXhEYXRhW2krK10qMztcbiAgICAgICAgICAgIHZhciBpMiA9IHZiby5pbmRleERhdGFbaSsrXSozO1xuICAgICAgICAgICAgdmFyIGkzID0gdmJvLmluZGV4RGF0YVtpKytdKjM7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZlYzMuc2V0KHAxLHZiby52ZXJ0ZXhEYXRhW2kxXSx2Ym8udmVydGV4RGF0YVtpMSsxXSwgdmJvLnZlcnRleERhdGFbaTErMl0pO1xuICAgICAgICAgICAgdmVjMy5zZXQocDIsdmJvLnZlcnRleERhdGFbaTJdLHZiby52ZXJ0ZXhEYXRhW2kyKzFdLCB2Ym8udmVydGV4RGF0YVtpMisyXSk7XG4gICAgICAgICAgICB2ZWMzLnNldChwMyx2Ym8udmVydGV4RGF0YVtpM10sdmJvLnZlcnRleERhdGFbaTMrMV0sIHZiby52ZXJ0ZXhEYXRhW2kzKzJdKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcGxhbmVOb3JtYWwobm9ybSwgcDEscDIscDMpO1xuICAgICAgICAgICAgdmVjMy5ub3JtYWxpemUobm9ybSxub3JtKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdmJvLm5vcm1hbERhdGFbaTFdICs9IG5vcm1bMF07XG4gICAgICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpMSsxXSArPSBub3JtWzFdO1xuICAgICAgICAgICAgdmJvLm5vcm1hbERhdGFbaTErMl0gKz0gbm9ybVsyXTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdmJvLm5vcm1hbERhdGFbaTJdICs9IG5vcm1bMF07XG4gICAgICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpMisxXSArPSBub3JtWzFdO1xuICAgICAgICAgICAgdmJvLm5vcm1hbERhdGFbaTIrMl0gKz0gbm9ybVsyXTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdmJvLm5vcm1hbERhdGFbaTNdICs9IG5vcm1bMF07XG4gICAgICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpMysxXSArPSBub3JtWzFdO1xuICAgICAgICAgICAgdmJvLm5vcm1hbERhdGFbaTMrMl0gKz0gbm9ybVsyXTtcbiAgICAgICAgfVxuICAgICAgICBmb3IodmFyIGk9MDtpPHZiby5udW1WZXJ0aWNlczsrK2kpIHtcbiAgICAgICAgICAgIHZhciBpMyA9IGkqMztcbiAgICAgICAgICAgIHggPSB2Ym8ubm9ybWFsRGF0YVtpM107XG4gICAgICAgICAgICB5ID0gdmJvLm5vcm1hbERhdGFbaTMrMV07XG4gICAgICAgICAgICB6ID0gdmJvLm5vcm1hbERhdGFbaTMrMl07XG4gICAgICAgICAgICBpbnZMZW4gPSAxLjAvTWF0aC5zcXJ0KHgqeCt5Knkreip6KTtcbiAgICAgICAgICAgIHZiby5ub3JtYWxEYXRhW2kzXSAqPSBpbnZMZW47XG4gICAgICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpMysxXSAqPSBpbnZMZW47XG4gICAgICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpMysyXSAqPSBpbnZMZW47XG4gICAgICAgIH1cbiAgICB9O1xufSkoKTtcblxudmJvTWVzaC5jb21wdXRlU21vb3RoTm9ybWFsc1ZCTyA9IGZ1bmN0aW9uKHZibykge1xuICAgIHZhciB2ZXJ0ZXhEYXRhID0gdmJvLnZlcnRleERhdGE7XG4gICAgZm9yKHZhciBpPTA7aTx2Ym8ubnVtVmVydGljZXM7KytpKSB7XG4gICAgICAgIHZhciBpNiA9IGkqNjtcbiAgICAgICAgdmVydGV4RGF0YVtpNiszXSA9IDA7XG4gICAgICAgIHZlcnRleERhdGFbaTYrNF0gPSAwO1xuICAgICAgICB2ZXJ0ZXhEYXRhW2k2KzVdID0gMDtcbiAgICB9XG4gICAgdmFyIG5vcm0gPSB2ZWMzLmNyZWF0ZSgpO1xuICAgIHZhciBwMSA9IHZlYzMuY3JlYXRlKCksXG4gICAgICAgIHAyID0gdmVjMy5jcmVhdGUoKSxcbiAgICAgICAgcDMgPSB2ZWMzLmNyZWF0ZSgpO1xuICAgIGZvcih2YXIgaT0wO2k8dmJvLm51bUluZGljZXM7KSB7XG4gICAgICAgIHZhciBpMSA9IHZiby5pbmRleERhdGFbaSsrXTtcbiAgICAgICAgdmFyIGkyID0gdmJvLmluZGV4RGF0YVtpKytdO1xuICAgICAgICB2YXIgaTMgPSB2Ym8uaW5kZXhEYXRhW2krK107XG4gICAgICAgIFxuICAgICAgICB2ZWMzLnNldChwMSx2ZXJ0ZXhEYXRhW2kxKjZdLHZlcnRleERhdGFbaTEqNisxXSwgdmVydGV4RGF0YVtpMSo2KzJdKTtcbiAgICAgICAgdmVjMy5zZXQocDIsdmVydGV4RGF0YVtpMio2XSx2ZXJ0ZXhEYXRhW2kyKjYrMV0sIHZlcnRleERhdGFbaTIqNisyXSk7XG4gICAgICAgIHZlYzMuc2V0KHAzLHZlcnRleERhdGFbaTMqNl0sdmVydGV4RGF0YVtpMyo2KzFdLCB2ZXJ0ZXhEYXRhW2kzKjYrMl0pO1xuICAgICAgICBcbiAgICAgICAgcGxhbmVOb3JtYWwobm9ybSwgcDEscDIscDMpO1xuICAgICAgICB2ZWMzLm5vcm1hbGl6ZShub3JtLG5vcm0pO1xuICAgICAgICBcbiAgICAgICAgdmVydGV4RGF0YVtpMSozKzNdICs9IG5vcm1bMF07XG4gICAgICAgIHZlcnRleERhdGFbaTEqMys0XSArPSBub3JtWzFdO1xuICAgICAgICB2ZXJ0ZXhEYXRhW2kxKjMrNV0gKz0gbm9ybVsyXTtcbiAgICAgICAgXG4gICAgICAgIHZlcnRleERhdGFbaTIqNiszXSArPSBub3JtWzBdO1xuICAgICAgICB2ZXJ0ZXhEYXRhW2kyKjYrNF0gKz0gbm9ybVsxXTtcbiAgICAgICAgdmVydGV4RGF0YVtpMio2KzVdICs9IG5vcm1bMl07XG4gICAgICAgIFxuICAgICAgICB2ZXJ0ZXhEYXRhW2kzKjYrM10gKz0gbm9ybVswXTtcbiAgICAgICAgdmVydGV4RGF0YVtpMyo2KzRdICs9IG5vcm1bMV07XG4gICAgICAgIHZlcnRleERhdGFbaTMqNis1XSArPSBub3JtWzJdO1xuICAgIH1cbiAgICBmb3IodmFyIGk9MDtpPHZiby5udW1WZXJ0aWNlczsrK2kpIHtcbiAgICAgICAgdmFyIGk2ID0gaSo2O1xuICAgICAgICB2YXIgbGVuID0gTWF0aC5zcXJ0KHZlcnRleERhdGFbaTYrM10qdmVydGV4RGF0YVtpNiszXSt2ZXJ0ZXhEYXRhW2k2KzRdKnZlcnRleERhdGFbaTYrNF0rdmVydGV4RGF0YVtpNis1XSp2ZXJ0ZXhEYXRhW2k2KzVdKTtcbiAgICAgICAgdmVydGV4RGF0YVtpNiszXSAvPSBsZW47XG4gICAgICAgIHZlcnRleERhdGFbaTYrNF0gLz0gbGVuO1xuICAgICAgICB2ZXJ0ZXhEYXRhW2k2KzVdIC89IGxlbjtcbiAgICB9XG59XG5cblxufSkoc2hpbS5leHBvcnRzKTtcbn0pKHRoaXMpOyIsInZhciBnbE1hdHJpeCA9IHJlcXVpcmUoJy4uL2pzL2dsLW1hdHJpeC1taW4uanMnKTtcclxudmFyIHBvbHkydHJpID0gcmVxdWlyZSgnLi9wb2x5MnRyaS5qcycpO1xyXG52YXIgdmVjMyA9IGdsTWF0cml4LnZlYzM7XHJcbnZhciB2ZWMyID0gZ2xNYXRyaXgudmVjMjtcclxuXHJcbnZhciBTd2VlcENvbnRleHQgPSBwb2x5MnRyaS5Td2VlcENvbnRleHQ7XHJcbnZhciBwdHMgPSBbXTtcclxuXHJcbnZhciBvdXRzaWRlUHRzID0gW107XHJcbnZhciB0cmlhbmdsZXMgPSBbXTtcclxuXHJcbnZhciB3aWR0aCA9IDEyMDA7XHJcbnZhciBoZWlnaHQgPSAxMjAwO1xyXG5mdW5jdGlvbiByZXNldCgpIHtcclxuICAvL21ha2UgcmVndWxhcmx5IHNwYWNlZCBwb2ludHNcclxuICBwdHMubGVuZ3RoID0gMDtcclxuICBcclxuICBmb3IodmFyIGk9MDtpPDQ7KytpKSB7XHJcbiAgICBmb3IodmFyIGo9MDtqPDQ7KytqKSB7XHJcbiAgICAgIHB0cy5wdXNoKHt4OmkqMjUwK2olMioxMjUseTpqKjI1MH0pO1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gaW5pdCgpIHtcclxuICBvdXRzaWRlUHRzLmxlbmd0aCA9IDA7XHJcbiAgb3V0c2lkZVB0cy5wdXNoKHt4Oi0xMCx5Oi0xMCxmaXhlZDp0cnVlfSk7XHJcbiAgb3V0c2lkZVB0cy5wdXNoKHt4OndpZHRoKzEwLHk6LTEwLGZpeGVkOnRydWV9KTtcclxuICBvdXRzaWRlUHRzLnB1c2goe3g6d2lkdGgrMTAseTpoZWlnaHQrMTAsZml4ZWQ6dHJ1ZX0pO1xyXG4gIG91dHNpZGVQdHMucHVzaCh7eDotMTAseTpoZWlnaHQrMTAsZml4ZWQ6dHJ1ZX0pO1xyXG59XHJcblxyXG52YXIgdm9yb25vaSA9IChmdW5jdGlvbigpIHtcclxuICB2YXIgcDEgPSB2ZWMyLmNyZWF0ZSgpO1xyXG4gIHZhciBwMiA9IHZlYzIuY3JlYXRlKCk7XHJcbiAgdmFyIHAzID0gdmVjMi5jcmVhdGUoKTtcclxuICByZXR1cm4gZnVuY3Rpb24gdm9yb25vaSgpIHtcclxuICAgIHZhciB0cmlhbmd1bGF0aW9uID0gbmV3IFN3ZWVwQ29udGV4dChvdXRzaWRlUHRzKTtcclxuICAgIHRyaWFuZ3VsYXRpb24uYWRkUG9pbnRzKHB0cyk7XHJcbiAgICB0cmlhbmd1bGF0aW9uLnRyaWFuZ3VsYXRlKCk7XHJcbiAgICBcclxuICAgIHRyaWFuZ2xlcyA9IHRyaWFuZ3VsYXRpb24uZ2V0VHJpYW5nbGVzKCk7XHJcbiAgICBleHBvcnRzLnRyaWFuZ2xlcyA9IHRyaWFuZ2xlcztcclxuICAgIFxyXG4gICAgZm9yKHZhciBpPTA7aTx0cmlhbmdsZXMubGVuZ3RoOysraSkge1xyXG4gICAgICB2YXIgdHJpID0gdHJpYW5nbGVzW2ldO1xyXG4gICAgICB0cmkuY2lyY3VtY2VudGVyID0gdmVjMy5jcmVhdGUoKTtcclxuICAgICAgdmVjMi5zZXQocDEsdHJpLnBvaW50c19bMF0ueCx0cmkucG9pbnRzX1swXS55KTtcclxuICAgICAgdmVjMi5zZXQocDIsdHJpLnBvaW50c19bMV0ueCx0cmkucG9pbnRzX1sxXS55KTtcclxuICAgICAgdmVjMi5zZXQocDMsdHJpLnBvaW50c19bMl0ueCx0cmkucG9pbnRzX1syXS55KTtcclxuICAgICAgY2lyY3VtY2lyY2xlKHRyaS5jaXJjdW1jZW50ZXIscDEscDIscDMpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgfVxyXG59KSgpO1xyXG5cclxudmFyIGNpcmN1bWNpcmNsZSA9IChmdW5jdGlvbigpIHtcclxuICB2YXIgdjEgPSB2ZWMyLmNyZWF0ZSgpO1xyXG4gIHZhciB2MiA9IHZlYzIuY3JlYXRlKCk7XHJcbiAgdmFyIGNyb3NzO1xyXG4gIHJldHVybiBmdW5jdGlvbiBjaXJjdW1jaXJjbGUob3V0LCBwMSxwMixwMykge1xyXG4gICAgdmVjMi5zdWIodjEscDEscDMpO1xyXG4gICAgdmVjMi5zdWIodjIscDIscDMpO1xyXG4gICAgY3Jvc3MgPSB2MVswXSp2MlsxXS12MVsxXSp2MlswXTtcclxuICAgIHZhciB2MUxlbiA9IHZlYzIuc3FyTGVuKHYxKTtcclxuICAgIHZhciB2MkxlbiA9IHZlYzIuc3FyTGVuKHYyKTtcclxuICAgIHZhciBjcm9zc0xlbiA9IGNyb3NzKmNyb3NzO1xyXG4gICAgdmVjMi5zY2FsZSh2Mix2Mix2MUxlbik7XHJcbiAgICB2ZWMyLnNjYWxlKHYxLHYxLHYyTGVuKTtcclxuICAgIHZlYzIuc3ViKHYyLHYyLHYxKTtcclxuICAgIG91dFswXSA9IHYyWzFdKmNyb3NzO1xyXG4gICAgb3V0WzFdID0gLXYyWzBdKmNyb3NzO1xyXG4gICAgdmVjMi5zY2FsZShvdXQsb3V0LDEuMC8oMi4wKmNyb3NzTGVuKSk7XHJcbiAgICB2ZWMyLmFkZChvdXQsb3V0LHAzKTtcclxuICAgIHJldHVybiBvdXQ7XHJcbiAgfVxyXG59KSgpO1xyXG5cclxuZXhwb3J0cy5pbml0ID0gaW5pdDtcclxuZXhwb3J0cy5yZXNldCA9IHJlc2V0O1xyXG5leHBvcnRzLnZvcm9ub2kgPSB2b3Jvbm9pO1xyXG5leHBvcnRzLnB0cyA9IHB0cztcclxuZXhwb3J0cy50cmlhbmdsZXMgPSB0cmlhbmdsZXM7IiwiLyoqXG4gKiBAZmlsZW92ZXJ2aWV3IGdsLW1hdHJpeCAtIEhpZ2ggcGVyZm9ybWFuY2UgbWF0cml4IGFuZCB2ZWN0b3Igb3BlcmF0aW9uc1xuICogQGF1dGhvciBCcmFuZG9uIEpvbmVzXG4gKiBAYXV0aG9yIENvbGluIE1hY0tlbnppZSBJVlxuICogQHZlcnNpb24gMi4yLjBcbiAqL1xuLyogQ29weXJpZ2h0IChjKSAyMDEzLCBCcmFuZG9uIEpvbmVzLCBDb2xpbiBNYWNLZW56aWUgSVYuIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG5cblJlZGlzdHJpYnV0aW9uIGFuZCB1c2UgaW4gc291cmNlIGFuZCBiaW5hcnkgZm9ybXMsIHdpdGggb3Igd2l0aG91dCBtb2RpZmljYXRpb24sXG5hcmUgcGVybWl0dGVkIHByb3ZpZGVkIHRoYXQgdGhlIGZvbGxvd2luZyBjb25kaXRpb25zIGFyZSBtZXQ6XG5cbiAgKiBSZWRpc3RyaWJ1dGlvbnMgb2Ygc291cmNlIGNvZGUgbXVzdCByZXRhaW4gdGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UsIHRoaXNcbiAgICBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lci5cbiAgKiBSZWRpc3RyaWJ1dGlvbnMgaW4gYmluYXJ5IGZvcm0gbXVzdCByZXByb2R1Y2UgdGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UsXG4gICAgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lciBpbiB0aGUgZG9jdW1lbnRhdGlvbiBcbiAgICBhbmQvb3Igb3RoZXIgbWF0ZXJpYWxzIHByb3ZpZGVkIHdpdGggdGhlIGRpc3RyaWJ1dGlvbi5cblxuVEhJUyBTT0ZUV0FSRSBJUyBQUk9WSURFRCBCWSBUSEUgQ09QWVJJR0hUIEhPTERFUlMgQU5EIENPTlRSSUJVVE9SUyBcIkFTIElTXCIgQU5EXG5BTlkgRVhQUkVTUyBPUiBJTVBMSUVEIFdBUlJBTlRJRVMsIElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBUSEUgSU1QTElFRFxuV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFkgQU5EIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFSRSBcbkRJU0NMQUlNRUQuIElOIE5PIEVWRU5UIFNIQUxMIFRIRSBDT1BZUklHSFQgSE9MREVSIE9SIENPTlRSSUJVVE9SUyBCRSBMSUFCTEUgRk9SXG5BTlkgRElSRUNULCBJTkRJUkVDVCwgSU5DSURFTlRBTCwgU1BFQ0lBTCwgRVhFTVBMQVJZLCBPUiBDT05TRVFVRU5USUFMIERBTUFHRVNcbihJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgUFJPQ1VSRU1FTlQgT0YgU1VCU1RJVFVURSBHT09EUyBPUiBTRVJWSUNFUztcbkxPU1MgT0YgVVNFLCBEQVRBLCBPUiBQUk9GSVRTOyBPUiBCVVNJTkVTUyBJTlRFUlJVUFRJT04pIEhPV0VWRVIgQ0FVU0VEIEFORCBPTlxuQU5ZIFRIRU9SWSBPRiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQ09OVFJBQ1QsIFNUUklDVCBMSUFCSUxJVFksIE9SIFRPUlRcbihJTkNMVURJTkcgTkVHTElHRU5DRSBPUiBPVEhFUldJU0UpIEFSSVNJTkcgSU4gQU5ZIFdBWSBPVVQgT0YgVEhFIFVTRSBPRiBUSElTXG5TT0ZUV0FSRSwgRVZFTiBJRiBBRFZJU0VEIE9GIFRIRSBQT1NTSUJJTElUWSBPRiBTVUNIIERBTUFHRS4gKi9cbihmdW5jdGlvbihlKXtcInVzZSBzdHJpY3RcIjt2YXIgdD17fTt0eXBlb2YgZXhwb3J0cz09XCJ1bmRlZmluZWRcIj90eXBlb2YgZGVmaW5lPT1cImZ1bmN0aW9uXCImJnR5cGVvZiBkZWZpbmUuYW1kPT1cIm9iamVjdFwiJiZkZWZpbmUuYW1kPyh0LmV4cG9ydHM9e30sZGVmaW5lKGZ1bmN0aW9uKCl7cmV0dXJuIHQuZXhwb3J0c30pKTp0LmV4cG9ydHM9dHlwZW9mIHdpbmRvdyE9XCJ1bmRlZmluZWRcIj93aW5kb3c6ZTp0LmV4cG9ydHM9ZXhwb3J0cyxmdW5jdGlvbihlKXtpZighdCl2YXIgdD0xZS02O2lmKCFuKXZhciBuPXR5cGVvZiBGbG9hdDMyQXJyYXkhPVwidW5kZWZpbmVkXCI/RmxvYXQzMkFycmF5OkFycmF5O2lmKCFyKXZhciByPU1hdGgucmFuZG9tO3ZhciBpPXt9O2kuc2V0TWF0cml4QXJyYXlUeXBlPWZ1bmN0aW9uKGUpe249ZX0sdHlwZW9mIGUhPVwidW5kZWZpbmVkXCImJihlLmdsTWF0cml4PWkpO3ZhciBzPXt9O3MuY3JlYXRlPWZ1bmN0aW9uKCl7dmFyIGU9bmV3IG4oMik7cmV0dXJuIGVbMF09MCxlWzFdPTAsZX0scy5jbG9uZT1mdW5jdGlvbihlKXt2YXIgdD1uZXcgbigyKTtyZXR1cm4gdFswXT1lWzBdLHRbMV09ZVsxXSx0fSxzLmZyb21WYWx1ZXM9ZnVuY3Rpb24oZSx0KXt2YXIgcj1uZXcgbigyKTtyZXR1cm4gclswXT1lLHJbMV09dCxyfSxzLmNvcHk9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXT10WzBdLGVbMV09dFsxXSxlfSxzLnNldD1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dCxlWzFdPW4sZX0scy5hZGQ9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0rblswXSxlWzFdPXRbMV0rblsxXSxlfSxzLnN1YnRyYWN0PWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10WzBdLW5bMF0sZVsxXT10WzFdLW5bMV0sZX0scy5zdWI9cy5zdWJ0cmFjdCxzLm11bHRpcGx5PWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10WzBdKm5bMF0sZVsxXT10WzFdKm5bMV0sZX0scy5tdWw9cy5tdWx0aXBseSxzLmRpdmlkZT1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dFswXS9uWzBdLGVbMV09dFsxXS9uWzFdLGV9LHMuZGl2PXMuZGl2aWRlLHMubWluPWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT1NYXRoLm1pbih0WzBdLG5bMF0pLGVbMV09TWF0aC5taW4odFsxXSxuWzFdKSxlfSxzLm1heD1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09TWF0aC5tYXgodFswXSxuWzBdKSxlWzFdPU1hdGgubWF4KHRbMV0sblsxXSksZX0scy5zY2FsZT1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dFswXSpuLGVbMV09dFsxXSpuLGV9LHMuc2NhbGVBbmRBZGQ9ZnVuY3Rpb24oZSx0LG4scil7cmV0dXJuIGVbMF09dFswXStuWzBdKnIsZVsxXT10WzFdK25bMV0qcixlfSxzLmRpc3RhbmNlPWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXS1lWzBdLHI9dFsxXS1lWzFdO3JldHVybiBNYXRoLnNxcnQobipuK3Iqcil9LHMuZGlzdD1zLmRpc3RhbmNlLHMuc3F1YXJlZERpc3RhbmNlPWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXS1lWzBdLHI9dFsxXS1lWzFdO3JldHVybiBuKm4rcipyfSxzLnNxckRpc3Q9cy5zcXVhcmVkRGlzdGFuY2Uscy5sZW5ndGg9ZnVuY3Rpb24oZSl7dmFyIHQ9ZVswXSxuPWVbMV07cmV0dXJuIE1hdGguc3FydCh0KnQrbipuKX0scy5sZW49cy5sZW5ndGgscy5zcXVhcmVkTGVuZ3RoPWZ1bmN0aW9uKGUpe3ZhciB0PWVbMF0sbj1lWzFdO3JldHVybiB0KnQrbipufSxzLnNxckxlbj1zLnNxdWFyZWRMZW5ndGgscy5uZWdhdGU9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXT0tdFswXSxlWzFdPS10WzFdLGV9LHMubm9ybWFsaXplPWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXSxyPXRbMV0saT1uKm4rcipyO3JldHVybiBpPjAmJihpPTEvTWF0aC5zcXJ0KGkpLGVbMF09dFswXSppLGVbMV09dFsxXSppKSxlfSxzLmRvdD1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdKnRbMF0rZVsxXSp0WzFdfSxzLmNyb3NzPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdKm5bMV0tdFsxXSpuWzBdO3JldHVybiBlWzBdPWVbMV09MCxlWzJdPXIsZX0scy5sZXJwPWZ1bmN0aW9uKGUsdCxuLHIpe3ZhciBpPXRbMF0scz10WzFdO3JldHVybiBlWzBdPWkrciooblswXS1pKSxlWzFdPXMrciooblsxXS1zKSxlfSxzLnJhbmRvbT1mdW5jdGlvbihlLHQpe3Q9dHx8MTt2YXIgbj1yKCkqMipNYXRoLlBJO3JldHVybiBlWzBdPU1hdGguY29zKG4pKnQsZVsxXT1NYXRoLnNpbihuKSp0LGV9LHMudHJhbnNmb3JtTWF0Mj1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV07cmV0dXJuIGVbMF09blswXSpyK25bMl0qaSxlWzFdPW5bMV0qcituWzNdKmksZX0scy50cmFuc2Zvcm1NYXQyZD1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV07cmV0dXJuIGVbMF09blswXSpyK25bMl0qaStuWzRdLGVbMV09blsxXSpyK25bM10qaStuWzVdLGV9LHMudHJhbnNmb3JtTWF0Mz1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV07cmV0dXJuIGVbMF09blswXSpyK25bM10qaStuWzZdLGVbMV09blsxXSpyK25bNF0qaStuWzddLGV9LHMudHJhbnNmb3JtTWF0ND1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV07cmV0dXJuIGVbMF09blswXSpyK25bNF0qaStuWzEyXSxlWzFdPW5bMV0qcituWzVdKmkrblsxM10sZX0scy5mb3JFYWNoPWZ1bmN0aW9uKCl7dmFyIGU9cy5jcmVhdGUoKTtyZXR1cm4gZnVuY3Rpb24odCxuLHIsaSxzLG8pe3ZhciB1LGE7bnx8KG49Mikscnx8KHI9MCksaT9hPU1hdGgubWluKGkqbityLHQubGVuZ3RoKTphPXQubGVuZ3RoO2Zvcih1PXI7dTxhO3UrPW4pZVswXT10W3VdLGVbMV09dFt1KzFdLHMoZSxlLG8pLHRbdV09ZVswXSx0W3UrMV09ZVsxXTtyZXR1cm4gdH19KCkscy5zdHI9ZnVuY3Rpb24oZSl7cmV0dXJuXCJ2ZWMyKFwiK2VbMF0rXCIsIFwiK2VbMV0rXCIpXCJ9LHR5cGVvZiBlIT1cInVuZGVmaW5lZFwiJiYoZS52ZWMyPXMpO3ZhciBvPXt9O28uY3JlYXRlPWZ1bmN0aW9uKCl7dmFyIGU9bmV3IG4oMyk7cmV0dXJuIGVbMF09MCxlWzFdPTAsZVsyXT0wLGV9LG8uY2xvbmU9ZnVuY3Rpb24oZSl7dmFyIHQ9bmV3IG4oMyk7cmV0dXJuIHRbMF09ZVswXSx0WzFdPWVbMV0sdFsyXT1lWzJdLHR9LG8uZnJvbVZhbHVlcz1mdW5jdGlvbihlLHQscil7dmFyIGk9bmV3IG4oMyk7cmV0dXJuIGlbMF09ZSxpWzFdPXQsaVsyXT1yLGl9LG8uY29weT1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdPXRbMF0sZVsxXT10WzFdLGVbMl09dFsyXSxlfSxvLnNldD1mdW5jdGlvbihlLHQsbixyKXtyZXR1cm4gZVswXT10LGVbMV09bixlWzJdPXIsZX0sby5hZGQ9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0rblswXSxlWzFdPXRbMV0rblsxXSxlWzJdPXRbMl0rblsyXSxlfSxvLnN1YnRyYWN0PWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10WzBdLW5bMF0sZVsxXT10WzFdLW5bMV0sZVsyXT10WzJdLW5bMl0sZX0sby5zdWI9by5zdWJ0cmFjdCxvLm11bHRpcGx5PWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10WzBdKm5bMF0sZVsxXT10WzFdKm5bMV0sZVsyXT10WzJdKm5bMl0sZX0sby5tdWw9by5tdWx0aXBseSxvLmRpdmlkZT1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dFswXS9uWzBdLGVbMV09dFsxXS9uWzFdLGVbMl09dFsyXS9uWzJdLGV9LG8uZGl2PW8uZGl2aWRlLG8ubWluPWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT1NYXRoLm1pbih0WzBdLG5bMF0pLGVbMV09TWF0aC5taW4odFsxXSxuWzFdKSxlWzJdPU1hdGgubWluKHRbMl0sblsyXSksZX0sby5tYXg9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPU1hdGgubWF4KHRbMF0sblswXSksZVsxXT1NYXRoLm1heCh0WzFdLG5bMV0pLGVbMl09TWF0aC5tYXgodFsyXSxuWzJdKSxlfSxvLnNjYWxlPWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10WzBdKm4sZVsxXT10WzFdKm4sZVsyXT10WzJdKm4sZX0sby5zY2FsZUFuZEFkZD1mdW5jdGlvbihlLHQsbixyKXtyZXR1cm4gZVswXT10WzBdK25bMF0qcixlWzFdPXRbMV0rblsxXSpyLGVbMl09dFsyXStuWzJdKnIsZX0sby5kaXN0YW5jZT1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0tZVswXSxyPXRbMV0tZVsxXSxpPXRbMl0tZVsyXTtyZXR1cm4gTWF0aC5zcXJ0KG4qbityKnIraSppKX0sby5kaXN0PW8uZGlzdGFuY2Usby5zcXVhcmVkRGlzdGFuY2U9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLWVbMF0scj10WzFdLWVbMV0saT10WzJdLWVbMl07cmV0dXJuIG4qbityKnIraSppfSxvLnNxckRpc3Q9by5zcXVhcmVkRGlzdGFuY2Usby5sZW5ndGg9ZnVuY3Rpb24oZSl7dmFyIHQ9ZVswXSxuPWVbMV0scj1lWzJdO3JldHVybiBNYXRoLnNxcnQodCp0K24qbityKnIpfSxvLmxlbj1vLmxlbmd0aCxvLnNxdWFyZWRMZW5ndGg9ZnVuY3Rpb24oZSl7dmFyIHQ9ZVswXSxuPWVbMV0scj1lWzJdO3JldHVybiB0KnQrbipuK3Iqcn0sby5zcXJMZW49by5zcXVhcmVkTGVuZ3RoLG8ubmVnYXRlPWZ1bmN0aW9uKGUsdCl7cmV0dXJuIGVbMF09LXRbMF0sZVsxXT0tdFsxXSxlWzJdPS10WzJdLGV9LG8ubm9ybWFsaXplPWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXSxyPXRbMV0saT10WzJdLHM9bipuK3IqcitpKmk7cmV0dXJuIHM+MCYmKHM9MS9NYXRoLnNxcnQocyksZVswXT10WzBdKnMsZVsxXT10WzFdKnMsZVsyXT10WzJdKnMpLGV9LG8uZG90PWZ1bmN0aW9uKGUsdCl7cmV0dXJuIGVbMF0qdFswXStlWzFdKnRbMV0rZVsyXSp0WzJdfSxvLmNyb3NzPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz1uWzBdLHU9blsxXSxhPW5bMl07cmV0dXJuIGVbMF09aSphLXMqdSxlWzFdPXMqby1yKmEsZVsyXT1yKnUtaSpvLGV9LG8ubGVycD1mdW5jdGlvbihlLHQsbixyKXt2YXIgaT10WzBdLHM9dFsxXSxvPXRbMl07cmV0dXJuIGVbMF09aStyKihuWzBdLWkpLGVbMV09cytyKihuWzFdLXMpLGVbMl09bytyKihuWzJdLW8pLGV9LG8ucmFuZG9tPWZ1bmN0aW9uKGUsdCl7dD10fHwxO3ZhciBuPXIoKSoyKk1hdGguUEksaT1yKCkqMi0xLHM9TWF0aC5zcXJ0KDEtaSppKSp0O3JldHVybiBlWzBdPU1hdGguY29zKG4pKnMsZVsxXT1NYXRoLnNpbihuKSpzLGVbMl09aSp0LGV9LG8udHJhbnNmb3JtTWF0ND1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdO3JldHVybiBlWzBdPW5bMF0qcituWzRdKmkrbls4XSpzK25bMTJdLGVbMV09blsxXSpyK25bNV0qaStuWzldKnMrblsxM10sZVsyXT1uWzJdKnIrbls2XSppK25bMTBdKnMrblsxNF0sZX0sby50cmFuc2Zvcm1NYXQzPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl07cmV0dXJuIGVbMF09cipuWzBdK2kqblszXStzKm5bNl0sZVsxXT1yKm5bMV0raSpuWzRdK3Mqbls3XSxlWzJdPXIqblsyXStpKm5bNV0rcypuWzhdLGV9LG8udHJhbnNmb3JtUXVhdD1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89blswXSx1PW5bMV0sYT1uWzJdLGY9blszXSxsPWYqcit1KnMtYSppLGM9ZippK2Eqci1vKnMsaD1mKnMrbyppLXUqcixwPS1vKnItdSppLWEqcztyZXR1cm4gZVswXT1sKmYrcCotbytjKi1hLWgqLXUsZVsxXT1jKmYrcCotdStoKi1vLWwqLWEsZVsyXT1oKmYrcCotYStsKi11LWMqLW8sZX0sby5mb3JFYWNoPWZ1bmN0aW9uKCl7dmFyIGU9by5jcmVhdGUoKTtyZXR1cm4gZnVuY3Rpb24odCxuLHIsaSxzLG8pe3ZhciB1LGE7bnx8KG49Mykscnx8KHI9MCksaT9hPU1hdGgubWluKGkqbityLHQubGVuZ3RoKTphPXQubGVuZ3RoO2Zvcih1PXI7dTxhO3UrPW4pZVswXT10W3VdLGVbMV09dFt1KzFdLGVbMl09dFt1KzJdLHMoZSxlLG8pLHRbdV09ZVswXSx0W3UrMV09ZVsxXSx0W3UrMl09ZVsyXTtyZXR1cm4gdH19KCksby5zdHI9ZnVuY3Rpb24oZSl7cmV0dXJuXCJ2ZWMzKFwiK2VbMF0rXCIsIFwiK2VbMV0rXCIsIFwiK2VbMl0rXCIpXCJ9LHR5cGVvZiBlIT1cInVuZGVmaW5lZFwiJiYoZS52ZWMzPW8pO3ZhciB1PXt9O3UuY3JlYXRlPWZ1bmN0aW9uKCl7dmFyIGU9bmV3IG4oNCk7cmV0dXJuIGVbMF09MCxlWzFdPTAsZVsyXT0wLGVbM109MCxlfSx1LmNsb25lPWZ1bmN0aW9uKGUpe3ZhciB0PW5ldyBuKDQpO3JldHVybiB0WzBdPWVbMF0sdFsxXT1lWzFdLHRbMl09ZVsyXSx0WzNdPWVbM10sdH0sdS5mcm9tVmFsdWVzPWZ1bmN0aW9uKGUsdCxyLGkpe3ZhciBzPW5ldyBuKDQpO3JldHVybiBzWzBdPWUsc1sxXT10LHNbMl09cixzWzNdPWksc30sdS5jb3B5PWZ1bmN0aW9uKGUsdCl7cmV0dXJuIGVbMF09dFswXSxlWzFdPXRbMV0sZVsyXT10WzJdLGVbM109dFszXSxlfSx1LnNldD1mdW5jdGlvbihlLHQsbixyLGkpe3JldHVybiBlWzBdPXQsZVsxXT1uLGVbMl09cixlWzNdPWksZX0sdS5hZGQ9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0rblswXSxlWzFdPXRbMV0rblsxXSxlWzJdPXRbMl0rblsyXSxlWzNdPXRbM10rblszXSxlfSx1LnN1YnRyYWN0PWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10WzBdLW5bMF0sZVsxXT10WzFdLW5bMV0sZVsyXT10WzJdLW5bMl0sZVszXT10WzNdLW5bM10sZX0sdS5zdWI9dS5zdWJ0cmFjdCx1Lm11bHRpcGx5PWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10WzBdKm5bMF0sZVsxXT10WzFdKm5bMV0sZVsyXT10WzJdKm5bMl0sZVszXT10WzNdKm5bM10sZX0sdS5tdWw9dS5tdWx0aXBseSx1LmRpdmlkZT1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dFswXS9uWzBdLGVbMV09dFsxXS9uWzFdLGVbMl09dFsyXS9uWzJdLGVbM109dFszXS9uWzNdLGV9LHUuZGl2PXUuZGl2aWRlLHUubWluPWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT1NYXRoLm1pbih0WzBdLG5bMF0pLGVbMV09TWF0aC5taW4odFsxXSxuWzFdKSxlWzJdPU1hdGgubWluKHRbMl0sblsyXSksZVszXT1NYXRoLm1pbih0WzNdLG5bM10pLGV9LHUubWF4PWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT1NYXRoLm1heCh0WzBdLG5bMF0pLGVbMV09TWF0aC5tYXgodFsxXSxuWzFdKSxlWzJdPU1hdGgubWF4KHRbMl0sblsyXSksZVszXT1NYXRoLm1heCh0WzNdLG5bM10pLGV9LHUuc2NhbGU9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0qbixlWzFdPXRbMV0qbixlWzJdPXRbMl0qbixlWzNdPXRbM10qbixlfSx1LnNjYWxlQW5kQWRkPWZ1bmN0aW9uKGUsdCxuLHIpe3JldHVybiBlWzBdPXRbMF0rblswXSpyLGVbMV09dFsxXStuWzFdKnIsZVsyXT10WzJdK25bMl0qcixlWzNdPXRbM10rblszXSpyLGV9LHUuZGlzdGFuY2U9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLWVbMF0scj10WzFdLWVbMV0saT10WzJdLWVbMl0scz10WzNdLWVbM107cmV0dXJuIE1hdGguc3FydChuKm4rcipyK2kqaStzKnMpfSx1LmRpc3Q9dS5kaXN0YW5jZSx1LnNxdWFyZWREaXN0YW5jZT1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0tZVswXSxyPXRbMV0tZVsxXSxpPXRbMl0tZVsyXSxzPXRbM10tZVszXTtyZXR1cm4gbipuK3IqcitpKmkrcypzfSx1LnNxckRpc3Q9dS5zcXVhcmVkRGlzdGFuY2UsdS5sZW5ndGg9ZnVuY3Rpb24oZSl7dmFyIHQ9ZVswXSxuPWVbMV0scj1lWzJdLGk9ZVszXTtyZXR1cm4gTWF0aC5zcXJ0KHQqdCtuKm4rcipyK2kqaSl9LHUubGVuPXUubGVuZ3RoLHUuc3F1YXJlZExlbmd0aD1mdW5jdGlvbihlKXt2YXIgdD1lWzBdLG49ZVsxXSxyPWVbMl0saT1lWzNdO3JldHVybiB0KnQrbipuK3IqcitpKml9LHUuc3FyTGVuPXUuc3F1YXJlZExlbmd0aCx1Lm5lZ2F0ZT1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdPS10WzBdLGVbMV09LXRbMV0sZVsyXT0tdFsyXSxlWzNdPS10WzNdLGV9LHUubm9ybWFsaXplPWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXSxyPXRbMV0saT10WzJdLHM9dFszXSxvPW4qbityKnIraSppK3MqcztyZXR1cm4gbz4wJiYobz0xL01hdGguc3FydChvKSxlWzBdPXRbMF0qbyxlWzFdPXRbMV0qbyxlWzJdPXRbMl0qbyxlWzNdPXRbM10qbyksZX0sdS5kb3Q9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXSp0WzBdK2VbMV0qdFsxXStlWzJdKnRbMl0rZVszXSp0WzNdfSx1LmxlcnA9ZnVuY3Rpb24oZSx0LG4scil7dmFyIGk9dFswXSxzPXRbMV0sbz10WzJdLHU9dFszXTtyZXR1cm4gZVswXT1pK3IqKG5bMF0taSksZVsxXT1zK3IqKG5bMV0tcyksZVsyXT1vK3IqKG5bMl0tbyksZVszXT11K3IqKG5bM10tdSksZX0sdS5yYW5kb209ZnVuY3Rpb24oZSx0KXtyZXR1cm4gdD10fHwxLGVbMF09cigpLGVbMV09cigpLGVbMl09cigpLGVbM109cigpLHUubm9ybWFsaXplKGUsZSksdS5zY2FsZShlLGUsdCksZX0sdS50cmFuc2Zvcm1NYXQ0PWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz10WzNdO3JldHVybiBlWzBdPW5bMF0qcituWzRdKmkrbls4XSpzK25bMTJdKm8sZVsxXT1uWzFdKnIrbls1XSppK25bOV0qcytuWzEzXSpvLGVbMl09blsyXSpyK25bNl0qaStuWzEwXSpzK25bMTRdKm8sZVszXT1uWzNdKnIrbls3XSppK25bMTFdKnMrblsxNV0qbyxlfSx1LnRyYW5zZm9ybVF1YXQ9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPW5bMF0sdT1uWzFdLGE9blsyXSxmPW5bM10sbD1mKnIrdSpzLWEqaSxjPWYqaSthKnItbypzLGg9ZipzK28qaS11KnIscD0tbypyLXUqaS1hKnM7cmV0dXJuIGVbMF09bCpmK3AqLW8rYyotYS1oKi11LGVbMV09YypmK3AqLXUraCotby1sKi1hLGVbMl09aCpmK3AqLWErbCotdS1jKi1vLGV9LHUuZm9yRWFjaD1mdW5jdGlvbigpe3ZhciBlPXUuY3JlYXRlKCk7cmV0dXJuIGZ1bmN0aW9uKHQsbixyLGkscyxvKXt2YXIgdSxhO258fChuPTQpLHJ8fChyPTApLGk/YT1NYXRoLm1pbihpKm4rcix0Lmxlbmd0aCk6YT10Lmxlbmd0aDtmb3IodT1yO3U8YTt1Kz1uKWVbMF09dFt1XSxlWzFdPXRbdSsxXSxlWzJdPXRbdSsyXSxlWzNdPXRbdSszXSxzKGUsZSxvKSx0W3VdPWVbMF0sdFt1KzFdPWVbMV0sdFt1KzJdPWVbMl0sdFt1KzNdPWVbM107cmV0dXJuIHR9fSgpLHUuc3RyPWZ1bmN0aW9uKGUpe3JldHVyblwidmVjNChcIitlWzBdK1wiLCBcIitlWzFdK1wiLCBcIitlWzJdK1wiLCBcIitlWzNdK1wiKVwifSx0eXBlb2YgZSE9XCJ1bmRlZmluZWRcIiYmKGUudmVjND11KTt2YXIgYT17fTthLmNyZWF0ZT1mdW5jdGlvbigpe3ZhciBlPW5ldyBuKDQpO3JldHVybiBlWzBdPTEsZVsxXT0wLGVbMl09MCxlWzNdPTEsZX0sYS5jbG9uZT1mdW5jdGlvbihlKXt2YXIgdD1uZXcgbig0KTtyZXR1cm4gdFswXT1lWzBdLHRbMV09ZVsxXSx0WzJdPWVbMl0sdFszXT1lWzNdLHR9LGEuY29weT1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdPXRbMF0sZVsxXT10WzFdLGVbMl09dFsyXSxlWzNdPXRbM10sZX0sYS5pZGVudGl0eT1mdW5jdGlvbihlKXtyZXR1cm4gZVswXT0xLGVbMV09MCxlWzJdPTAsZVszXT0xLGV9LGEudHJhbnNwb3NlPWZ1bmN0aW9uKGUsdCl7aWYoZT09PXQpe3ZhciBuPXRbMV07ZVsxXT10WzJdLGVbMl09bn1lbHNlIGVbMF09dFswXSxlWzFdPXRbMl0sZVsyXT10WzFdLGVbM109dFszXTtyZXR1cm4gZX0sYS5pbnZlcnQ9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLHI9dFsxXSxpPXRbMl0scz10WzNdLG89bipzLWkqcjtyZXR1cm4gbz8obz0xL28sZVswXT1zKm8sZVsxXT0tcipvLGVbMl09LWkqbyxlWzNdPW4qbyxlKTpudWxsfSxhLmFkam9pbnQ9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdO3JldHVybiBlWzBdPXRbM10sZVsxXT0tdFsxXSxlWzJdPS10WzJdLGVbM109bixlfSxhLmRldGVybWluYW50PWZ1bmN0aW9uKGUpe3JldHVybiBlWzBdKmVbM10tZVsyXSplWzFdfSxhLm11bHRpcGx5PWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz10WzNdLHU9blswXSxhPW5bMV0sZj1uWzJdLGw9blszXTtyZXR1cm4gZVswXT1yKnUraSpmLGVbMV09ciphK2kqbCxlWzJdPXMqdStvKmYsZVszXT1zKmErbypsLGV9LGEubXVsPWEubXVsdGlwbHksYS5yb3RhdGU9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM10sdT1NYXRoLnNpbihuKSxhPU1hdGguY29zKG4pO3JldHVybiBlWzBdPXIqYStpKnUsZVsxXT1yKi11K2kqYSxlWzJdPXMqYStvKnUsZVszXT1zKi11K28qYSxlfSxhLnNjYWxlPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz10WzNdLHU9blswXSxhPW5bMV07cmV0dXJuIGVbMF09cip1LGVbMV09aSphLGVbMl09cyp1LGVbM109byphLGV9LGEuc3RyPWZ1bmN0aW9uKGUpe3JldHVyblwibWF0MihcIitlWzBdK1wiLCBcIitlWzFdK1wiLCBcIitlWzJdK1wiLCBcIitlWzNdK1wiKVwifSx0eXBlb2YgZSE9XCJ1bmRlZmluZWRcIiYmKGUubWF0Mj1hKTt2YXIgZj17fTtmLmNyZWF0ZT1mdW5jdGlvbigpe3ZhciBlPW5ldyBuKDYpO3JldHVybiBlWzBdPTEsZVsxXT0wLGVbMl09MCxlWzNdPTEsZVs0XT0wLGVbNV09MCxlfSxmLmNsb25lPWZ1bmN0aW9uKGUpe3ZhciB0PW5ldyBuKDYpO3JldHVybiB0WzBdPWVbMF0sdFsxXT1lWzFdLHRbMl09ZVsyXSx0WzNdPWVbM10sdFs0XT1lWzRdLHRbNV09ZVs1XSx0fSxmLmNvcHk9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXT10WzBdLGVbMV09dFsxXSxlWzJdPXRbMl0sZVszXT10WzNdLGVbNF09dFs0XSxlWzVdPXRbNV0sZX0sZi5pZGVudGl0eT1mdW5jdGlvbihlKXtyZXR1cm4gZVswXT0xLGVbMV09MCxlWzJdPTAsZVszXT0xLGVbNF09MCxlWzVdPTAsZX0sZi5pbnZlcnQ9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLHI9dFsxXSxpPXRbMl0scz10WzNdLG89dFs0XSx1PXRbNV0sYT1uKnMtcippO3JldHVybiBhPyhhPTEvYSxlWzBdPXMqYSxlWzFdPS1yKmEsZVsyXT0taSphLGVbM109biphLGVbNF09KGkqdS1zKm8pKmEsZVs1XT0ocipvLW4qdSkqYSxlKTpudWxsfSxmLmRldGVybWluYW50PWZ1bmN0aW9uKGUpe3JldHVybiBlWzBdKmVbM10tZVsxXSplWzJdfSxmLm11bHRpcGx5PWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz10WzNdLHU9dFs0XSxhPXRbNV0sZj1uWzBdLGw9blsxXSxjPW5bMl0saD1uWzNdLHA9bls0XSxkPW5bNV07cmV0dXJuIGVbMF09cipmK2kqYyxlWzFdPXIqbCtpKmgsZVsyXT1zKmYrbypjLGVbM109cypsK28qaCxlWzRdPWYqdStjKmErcCxlWzVdPWwqdStoKmErZCxlfSxmLm11bD1mLm11bHRpcGx5LGYucm90YXRlPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz10WzNdLHU9dFs0XSxhPXRbNV0sZj1NYXRoLnNpbihuKSxsPU1hdGguY29zKG4pO3JldHVybiBlWzBdPXIqbCtpKmYsZVsxXT0tcipmK2kqbCxlWzJdPXMqbCtvKmYsZVszXT0tcypmK2wqbyxlWzRdPWwqdStmKmEsZVs1XT1sKmEtZip1LGV9LGYuc2NhbGU9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPW5bMF0saT1uWzFdO3JldHVybiBlWzBdPXRbMF0qcixlWzFdPXRbMV0qaSxlWzJdPXRbMl0qcixlWzNdPXRbM10qaSxlWzRdPXRbNF0qcixlWzVdPXRbNV0qaSxlfSxmLnRyYW5zbGF0ZT1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dFswXSxlWzFdPXRbMV0sZVsyXT10WzJdLGVbM109dFszXSxlWzRdPXRbNF0rblswXSxlWzVdPXRbNV0rblsxXSxlfSxmLnN0cj1mdW5jdGlvbihlKXtyZXR1cm5cIm1hdDJkKFwiK2VbMF0rXCIsIFwiK2VbMV0rXCIsIFwiK2VbMl0rXCIsIFwiK2VbM10rXCIsIFwiK2VbNF0rXCIsIFwiK2VbNV0rXCIpXCJ9LHR5cGVvZiBlIT1cInVuZGVmaW5lZFwiJiYoZS5tYXQyZD1mKTt2YXIgbD17fTtsLmNyZWF0ZT1mdW5jdGlvbigpe3ZhciBlPW5ldyBuKDkpO3JldHVybiBlWzBdPTEsZVsxXT0wLGVbMl09MCxlWzNdPTAsZVs0XT0xLGVbNV09MCxlWzZdPTAsZVs3XT0wLGVbOF09MSxlfSxsLmZyb21NYXQ0PWZ1bmN0aW9uKGUsdCl7cmV0dXJuIGVbMF09dFswXSxlWzFdPXRbMV0sZVsyXT10WzJdLGVbM109dFs0XSxlWzRdPXRbNV0sZVs1XT10WzZdLGVbNl09dFs4XSxlWzddPXRbOV0sZVs4XT10WzEwXSxlfSxsLmNsb25lPWZ1bmN0aW9uKGUpe3ZhciB0PW5ldyBuKDkpO3JldHVybiB0WzBdPWVbMF0sdFsxXT1lWzFdLHRbMl09ZVsyXSx0WzNdPWVbM10sdFs0XT1lWzRdLHRbNV09ZVs1XSx0WzZdPWVbNl0sdFs3XT1lWzddLHRbOF09ZVs4XSx0fSxsLmNvcHk9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXT10WzBdLGVbMV09dFsxXSxlWzJdPXRbMl0sZVszXT10WzNdLGVbNF09dFs0XSxlWzVdPXRbNV0sZVs2XT10WzZdLGVbN109dFs3XSxlWzhdPXRbOF0sZX0sbC5pZGVudGl0eT1mdW5jdGlvbihlKXtyZXR1cm4gZVswXT0xLGVbMV09MCxlWzJdPTAsZVszXT0wLGVbNF09MSxlWzVdPTAsZVs2XT0wLGVbN109MCxlWzhdPTEsZX0sbC50cmFuc3Bvc2U9ZnVuY3Rpb24oZSx0KXtpZihlPT09dCl7dmFyIG49dFsxXSxyPXRbMl0saT10WzVdO2VbMV09dFszXSxlWzJdPXRbNl0sZVszXT1uLGVbNV09dFs3XSxlWzZdPXIsZVs3XT1pfWVsc2UgZVswXT10WzBdLGVbMV09dFszXSxlWzJdPXRbNl0sZVszXT10WzFdLGVbNF09dFs0XSxlWzVdPXRbN10sZVs2XT10WzJdLGVbN109dFs1XSxlWzhdPXRbOF07cmV0dXJuIGV9LGwuaW52ZXJ0PWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXSxyPXRbMV0saT10WzJdLHM9dFszXSxvPXRbNF0sdT10WzVdLGE9dFs2XSxmPXRbN10sbD10WzhdLGM9bCpvLXUqZixoPS1sKnMrdSphLHA9ZipzLW8qYSxkPW4qYytyKmgraSpwO3JldHVybiBkPyhkPTEvZCxlWzBdPWMqZCxlWzFdPSgtbCpyK2kqZikqZCxlWzJdPSh1KnItaSpvKSpkLGVbM109aCpkLGVbNF09KGwqbi1pKmEpKmQsZVs1XT0oLXUqbitpKnMpKmQsZVs2XT1wKmQsZVs3XT0oLWYqbityKmEpKmQsZVs4XT0obypuLXIqcykqZCxlKTpudWxsfSxsLmFkam9pbnQ9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLHI9dFsxXSxpPXRbMl0scz10WzNdLG89dFs0XSx1PXRbNV0sYT10WzZdLGY9dFs3XSxsPXRbOF07cmV0dXJuIGVbMF09bypsLXUqZixlWzFdPWkqZi1yKmwsZVsyXT1yKnUtaSpvLGVbM109dSphLXMqbCxlWzRdPW4qbC1pKmEsZVs1XT1pKnMtbip1LGVbNl09cypmLW8qYSxlWzddPXIqYS1uKmYsZVs4XT1uKm8tcipzLGV9LGwuZGV0ZXJtaW5hbnQ9ZnVuY3Rpb24oZSl7dmFyIHQ9ZVswXSxuPWVbMV0scj1lWzJdLGk9ZVszXSxzPWVbNF0sbz1lWzVdLHU9ZVs2XSxhPWVbN10sZj1lWzhdO3JldHVybiB0KihmKnMtbyphKStuKigtZippK28qdSkrciooYSppLXMqdSl9LGwubXVsdGlwbHk9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM10sdT10WzRdLGE9dFs1XSxmPXRbNl0sbD10WzddLGM9dFs4XSxoPW5bMF0scD1uWzFdLGQ9blsyXSx2PW5bM10sbT1uWzRdLGc9bls1XSx5PW5bNl0sYj1uWzddLHc9bls4XTtyZXR1cm4gZVswXT1oKnIrcCpvK2QqZixlWzFdPWgqaStwKnUrZCpsLGVbMl09aCpzK3AqYStkKmMsZVszXT12KnIrbSpvK2cqZixlWzRdPXYqaSttKnUrZypsLGVbNV09dipzK20qYStnKmMsZVs2XT15KnIrYipvK3cqZixlWzddPXkqaStiKnUrdypsLGVbOF09eSpzK2IqYSt3KmMsZX0sbC5tdWw9bC5tdWx0aXBseSxsLnRyYW5zbGF0ZT1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXSx1PXRbNF0sYT10WzVdLGY9dFs2XSxsPXRbN10sYz10WzhdLGg9blswXSxwPW5bMV07cmV0dXJuIGVbMF09cixlWzFdPWksZVsyXT1zLGVbM109byxlWzRdPXUsZVs1XT1hLGVbNl09aCpyK3AqbytmLGVbN109aCppK3AqdStsLGVbOF09aCpzK3AqYStjLGV9LGwucm90YXRlPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz10WzNdLHU9dFs0XSxhPXRbNV0sZj10WzZdLGw9dFs3XSxjPXRbOF0saD1NYXRoLnNpbihuKSxwPU1hdGguY29zKG4pO3JldHVybiBlWzBdPXAqcitoKm8sZVsxXT1wKmkraCp1LGVbMl09cCpzK2gqYSxlWzNdPXAqby1oKnIsZVs0XT1wKnUtaCppLGVbNV09cCphLWgqcyxlWzZdPWYsZVs3XT1sLGVbOF09YyxlfSxsLnNjYWxlPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj1uWzBdLGk9blsxXTtyZXR1cm4gZVswXT1yKnRbMF0sZVsxXT1yKnRbMV0sZVsyXT1yKnRbMl0sZVszXT1pKnRbM10sZVs0XT1pKnRbNF0sZVs1XT1pKnRbNV0sZVs2XT10WzZdLGVbN109dFs3XSxlWzhdPXRbOF0sZX0sbC5mcm9tTWF0MmQ9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXT10WzBdLGVbMV09dFsxXSxlWzJdPTAsZVszXT10WzJdLGVbNF09dFszXSxlWzVdPTAsZVs2XT10WzRdLGVbN109dFs1XSxlWzhdPTEsZX0sbC5mcm9tUXVhdD1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0scj10WzFdLGk9dFsyXSxzPXRbM10sbz1uK24sdT1yK3IsYT1pK2ksZj1uKm8sbD1uKnUsYz1uKmEsaD1yKnUscD1yKmEsZD1pKmEsdj1zKm8sbT1zKnUsZz1zKmE7cmV0dXJuIGVbMF09MS0oaCtkKSxlWzNdPWwrZyxlWzZdPWMtbSxlWzFdPWwtZyxlWzRdPTEtKGYrZCksZVs3XT1wK3YsZVsyXT1jK20sZVs1XT1wLXYsZVs4XT0xLShmK2gpLGV9LGwubm9ybWFsRnJvbU1hdDQ9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLHI9dFsxXSxpPXRbMl0scz10WzNdLG89dFs0XSx1PXRbNV0sYT10WzZdLGY9dFs3XSxsPXRbOF0sYz10WzldLGg9dFsxMF0scD10WzExXSxkPXRbMTJdLHY9dFsxM10sbT10WzE0XSxnPXRbMTVdLHk9bip1LXIqbyxiPW4qYS1pKm8sdz1uKmYtcypvLEU9ciphLWkqdSxTPXIqZi1zKnUseD1pKmYtcyphLFQ9bCp2LWMqZCxOPWwqbS1oKmQsQz1sKmctcCpkLGs9YyptLWgqdixMPWMqZy1wKnYsQT1oKmctcCptLE89eSpBLWIqTCt3KmsrRSpDLVMqTit4KlQ7cmV0dXJuIE8/KE89MS9PLGVbMF09KHUqQS1hKkwrZiprKSpPLGVbMV09KGEqQy1vKkEtZipOKSpPLGVbMl09KG8qTC11KkMrZipUKSpPLGVbM109KGkqTC1yKkEtcyprKSpPLGVbNF09KG4qQS1pKkMrcypOKSpPLGVbNV09KHIqQy1uKkwtcypUKSpPLGVbNl09KHYqeC1tKlMrZypFKSpPLGVbN109KG0qdy1kKngtZypiKSpPLGVbOF09KGQqUy12KncrZyp5KSpPLGUpOm51bGx9LGwuc3RyPWZ1bmN0aW9uKGUpe3JldHVyblwibWF0MyhcIitlWzBdK1wiLCBcIitlWzFdK1wiLCBcIitlWzJdK1wiLCBcIitlWzNdK1wiLCBcIitlWzRdK1wiLCBcIitlWzVdK1wiLCBcIitlWzZdK1wiLCBcIitlWzddK1wiLCBcIitlWzhdK1wiKVwifSx0eXBlb2YgZSE9XCJ1bmRlZmluZWRcIiYmKGUubWF0Mz1sKTt2YXIgYz17fTtjLmNyZWF0ZT1mdW5jdGlvbigpe3ZhciBlPW5ldyBuKDE2KTtyZXR1cm4gZVswXT0xLGVbMV09MCxlWzJdPTAsZVszXT0wLGVbNF09MCxlWzVdPTEsZVs2XT0wLGVbN109MCxlWzhdPTAsZVs5XT0wLGVbMTBdPTEsZVsxMV09MCxlWzEyXT0wLGVbMTNdPTAsZVsxNF09MCxlWzE1XT0xLGV9LGMuY2xvbmU9ZnVuY3Rpb24oZSl7dmFyIHQ9bmV3IG4oMTYpO3JldHVybiB0WzBdPWVbMF0sdFsxXT1lWzFdLHRbMl09ZVsyXSx0WzNdPWVbM10sdFs0XT1lWzRdLHRbNV09ZVs1XSx0WzZdPWVbNl0sdFs3XT1lWzddLHRbOF09ZVs4XSx0WzldPWVbOV0sdFsxMF09ZVsxMF0sdFsxMV09ZVsxMV0sdFsxMl09ZVsxMl0sdFsxM109ZVsxM10sdFsxNF09ZVsxNF0sdFsxNV09ZVsxNV0sdH0sYy5jb3B5PWZ1bmN0aW9uKGUsdCl7cmV0dXJuIGVbMF09dFswXSxlWzFdPXRbMV0sZVsyXT10WzJdLGVbM109dFszXSxlWzRdPXRbNF0sZVs1XT10WzVdLGVbNl09dFs2XSxlWzddPXRbN10sZVs4XT10WzhdLGVbOV09dFs5XSxlWzEwXT10WzEwXSxlWzExXT10WzExXSxlWzEyXT10WzEyXSxlWzEzXT10WzEzXSxlWzE0XT10WzE0XSxlWzE1XT10WzE1XSxlfSxjLmlkZW50aXR5PWZ1bmN0aW9uKGUpe3JldHVybiBlWzBdPTEsZVsxXT0wLGVbMl09MCxlWzNdPTAsZVs0XT0wLGVbNV09MSxlWzZdPTAsZVs3XT0wLGVbOF09MCxlWzldPTAsZVsxMF09MSxlWzExXT0wLGVbMTJdPTAsZVsxM109MCxlWzE0XT0wLGVbMTVdPTEsZX0sYy50cmFuc3Bvc2U9ZnVuY3Rpb24oZSx0KXtpZihlPT09dCl7dmFyIG49dFsxXSxyPXRbMl0saT10WzNdLHM9dFs2XSxvPXRbN10sdT10WzExXTtlWzFdPXRbNF0sZVsyXT10WzhdLGVbM109dFsxMl0sZVs0XT1uLGVbNl09dFs5XSxlWzddPXRbMTNdLGVbOF09cixlWzldPXMsZVsxMV09dFsxNF0sZVsxMl09aSxlWzEzXT1vLGVbMTRdPXV9ZWxzZSBlWzBdPXRbMF0sZVsxXT10WzRdLGVbMl09dFs4XSxlWzNdPXRbMTJdLGVbNF09dFsxXSxlWzVdPXRbNV0sZVs2XT10WzldLGVbN109dFsxM10sZVs4XT10WzJdLGVbOV09dFs2XSxlWzEwXT10WzEwXSxlWzExXT10WzE0XSxlWzEyXT10WzNdLGVbMTNdPXRbN10sZVsxNF09dFsxMV0sZVsxNV09dFsxNV07cmV0dXJuIGV9LGMuaW52ZXJ0PWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXSxyPXRbMV0saT10WzJdLHM9dFszXSxvPXRbNF0sdT10WzVdLGE9dFs2XSxmPXRbN10sbD10WzhdLGM9dFs5XSxoPXRbMTBdLHA9dFsxMV0sZD10WzEyXSx2PXRbMTNdLG09dFsxNF0sZz10WzE1XSx5PW4qdS1yKm8sYj1uKmEtaSpvLHc9bipmLXMqbyxFPXIqYS1pKnUsUz1yKmYtcyp1LHg9aSpmLXMqYSxUPWwqdi1jKmQsTj1sKm0taCpkLEM9bCpnLXAqZCxrPWMqbS1oKnYsTD1jKmctcCp2LEE9aCpnLXAqbSxPPXkqQS1iKkwrdyprK0UqQy1TKk4reCpUO3JldHVybiBPPyhPPTEvTyxlWzBdPSh1KkEtYSpMK2YqaykqTyxlWzFdPShpKkwtcipBLXMqaykqTyxlWzJdPSh2KngtbSpTK2cqRSkqTyxlWzNdPShoKlMtYyp4LXAqRSkqTyxlWzRdPShhKkMtbypBLWYqTikqTyxlWzVdPShuKkEtaSpDK3MqTikqTyxlWzZdPShtKnctZCp4LWcqYikqTyxlWzddPShsKngtaCp3K3AqYikqTyxlWzhdPShvKkwtdSpDK2YqVCkqTyxlWzldPShyKkMtbipMLXMqVCkqTyxlWzEwXT0oZCpTLXYqdytnKnkpKk8sZVsxMV09KGMqdy1sKlMtcCp5KSpPLGVbMTJdPSh1Kk4tbyprLWEqVCkqTyxlWzEzXT0obiprLXIqTitpKlQpKk8sZVsxNF09KHYqYi1kKkUtbSp5KSpPLGVbMTVdPShsKkUtYypiK2gqeSkqTyxlKTpudWxsfSxjLmFkam9pbnQ9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLHI9dFsxXSxpPXRbMl0scz10WzNdLG89dFs0XSx1PXRbNV0sYT10WzZdLGY9dFs3XSxsPXRbOF0sYz10WzldLGg9dFsxMF0scD10WzExXSxkPXRbMTJdLHY9dFsxM10sbT10WzE0XSxnPXRbMTVdO3JldHVybiBlWzBdPXUqKGgqZy1wKm0pLWMqKGEqZy1mKm0pK3YqKGEqcC1mKmgpLGVbMV09LShyKihoKmctcCptKS1jKihpKmctcyptKSt2KihpKnAtcypoKSksZVsyXT1yKihhKmctZiptKS11KihpKmctcyptKSt2KihpKmYtcyphKSxlWzNdPS0ociooYSpwLWYqaCktdSooaSpwLXMqaCkrYyooaSpmLXMqYSkpLGVbNF09LShvKihoKmctcCptKS1sKihhKmctZiptKStkKihhKnAtZipoKSksZVs1XT1uKihoKmctcCptKS1sKihpKmctcyptKStkKihpKnAtcypoKSxlWzZdPS0obiooYSpnLWYqbSktbyooaSpnLXMqbSkrZCooaSpmLXMqYSkpLGVbN109biooYSpwLWYqaCktbyooaSpwLXMqaCkrbCooaSpmLXMqYSksZVs4XT1vKihjKmctcCp2KS1sKih1KmctZip2KStkKih1KnAtZipjKSxlWzldPS0obiooYypnLXAqdiktbCoocipnLXMqdikrZCoocipwLXMqYykpLGVbMTBdPW4qKHUqZy1mKnYpLW8qKHIqZy1zKnYpK2QqKHIqZi1zKnUpLGVbMTFdPS0obioodSpwLWYqYyktbyoocipwLXMqYykrbCoocipmLXMqdSkpLGVbMTJdPS0obyooYyptLWgqdiktbCoodSptLWEqdikrZCoodSpoLWEqYykpLGVbMTNdPW4qKGMqbS1oKnYpLWwqKHIqbS1pKnYpK2QqKHIqaC1pKmMpLGVbMTRdPS0obioodSptLWEqdiktbyoociptLWkqdikrZCoociphLWkqdSkpLGVbMTVdPW4qKHUqaC1hKmMpLW8qKHIqaC1pKmMpK2wqKHIqYS1pKnUpLGV9LGMuZGV0ZXJtaW5hbnQ9ZnVuY3Rpb24oZSl7dmFyIHQ9ZVswXSxuPWVbMV0scj1lWzJdLGk9ZVszXSxzPWVbNF0sbz1lWzVdLHU9ZVs2XSxhPWVbN10sZj1lWzhdLGw9ZVs5XSxjPWVbMTBdLGg9ZVsxMV0scD1lWzEyXSxkPWVbMTNdLHY9ZVsxNF0sbT1lWzE1XSxnPXQqby1uKnMseT10KnUtcipzLGI9dCphLWkqcyx3PW4qdS1yKm8sRT1uKmEtaSpvLFM9ciphLWkqdSx4PWYqZC1sKnAsVD1mKnYtYypwLE49ZiptLWgqcCxDPWwqdi1jKmQsaz1sKm0taCpkLEw9YyptLWgqdjtyZXR1cm4gZypMLXkqaytiKkMrdypOLUUqVCtTKnh9LGMubXVsdGlwbHk9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM10sdT10WzRdLGE9dFs1XSxmPXRbNl0sbD10WzddLGM9dFs4XSxoPXRbOV0scD10WzEwXSxkPXRbMTFdLHY9dFsxMl0sbT10WzEzXSxnPXRbMTRdLHk9dFsxNV0sYj1uWzBdLHc9blsxXSxFPW5bMl0sUz1uWzNdO3JldHVybiBlWzBdPWIqcit3KnUrRSpjK1MqdixlWzFdPWIqaSt3KmErRSpoK1MqbSxlWzJdPWIqcyt3KmYrRSpwK1MqZyxlWzNdPWIqbyt3KmwrRSpkK1MqeSxiPW5bNF0sdz1uWzVdLEU9bls2XSxTPW5bN10sZVs0XT1iKnIrdyp1K0UqYytTKnYsZVs1XT1iKmkrdyphK0UqaCtTKm0sZVs2XT1iKnMrdypmK0UqcCtTKmcsZVs3XT1iKm8rdypsK0UqZCtTKnksYj1uWzhdLHc9bls5XSxFPW5bMTBdLFM9blsxMV0sZVs4XT1iKnIrdyp1K0UqYytTKnYsZVs5XT1iKmkrdyphK0UqaCtTKm0sZVsxMF09YipzK3cqZitFKnArUypnLGVbMTFdPWIqbyt3KmwrRSpkK1MqeSxiPW5bMTJdLHc9blsxM10sRT1uWzE0XSxTPW5bMTVdLGVbMTJdPWIqcit3KnUrRSpjK1MqdixlWzEzXT1iKmkrdyphK0UqaCtTKm0sZVsxNF09YipzK3cqZitFKnArUypnLGVbMTVdPWIqbyt3KmwrRSpkK1MqeSxlfSxjLm11bD1jLm11bHRpcGx5LGMudHJhbnNsYXRlPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj1uWzBdLGk9blsxXSxzPW5bMl0sbyx1LGEsZixsLGMsaCxwLGQsdixtLGc7cmV0dXJuIHQ9PT1lPyhlWzEyXT10WzBdKnIrdFs0XSppK3RbOF0qcyt0WzEyXSxlWzEzXT10WzFdKnIrdFs1XSppK3RbOV0qcyt0WzEzXSxlWzE0XT10WzJdKnIrdFs2XSppK3RbMTBdKnMrdFsxNF0sZVsxNV09dFszXSpyK3RbN10qaSt0WzExXSpzK3RbMTVdKToobz10WzBdLHU9dFsxXSxhPXRbMl0sZj10WzNdLGw9dFs0XSxjPXRbNV0saD10WzZdLHA9dFs3XSxkPXRbOF0sdj10WzldLG09dFsxMF0sZz10WzExXSxlWzBdPW8sZVsxXT11LGVbMl09YSxlWzNdPWYsZVs0XT1sLGVbNV09YyxlWzZdPWgsZVs3XT1wLGVbOF09ZCxlWzldPXYsZVsxMF09bSxlWzExXT1nLGVbMTJdPW8qcitsKmkrZCpzK3RbMTJdLGVbMTNdPXUqcitjKmkrdipzK3RbMTNdLGVbMTRdPWEqcitoKmkrbSpzK3RbMTRdLGVbMTVdPWYqcitwKmkrZypzK3RbMTVdKSxlfSxjLnNjYWxlPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj1uWzBdLGk9blsxXSxzPW5bMl07cmV0dXJuIGVbMF09dFswXSpyLGVbMV09dFsxXSpyLGVbMl09dFsyXSpyLGVbM109dFszXSpyLGVbNF09dFs0XSppLGVbNV09dFs1XSppLGVbNl09dFs2XSppLGVbN109dFs3XSppLGVbOF09dFs4XSpzLGVbOV09dFs5XSpzLGVbMTBdPXRbMTBdKnMsZVsxMV09dFsxMV0qcyxlWzEyXT10WzEyXSxlWzEzXT10WzEzXSxlWzE0XT10WzE0XSxlWzE1XT10WzE1XSxlfSxjLnJvdGF0ZT1mdW5jdGlvbihlLG4scixpKXt2YXIgcz1pWzBdLG89aVsxXSx1PWlbMl0sYT1NYXRoLnNxcnQocypzK28qbyt1KnUpLGYsbCxjLGgscCxkLHYsbSxnLHksYix3LEUsUyx4LFQsTixDLGssTCxBLE8sTSxfO3JldHVybiBNYXRoLmFicyhhKTx0P251bGw6KGE9MS9hLHMqPWEsbyo9YSx1Kj1hLGY9TWF0aC5zaW4ociksbD1NYXRoLmNvcyhyKSxjPTEtbCxoPW5bMF0scD1uWzFdLGQ9blsyXSx2PW5bM10sbT1uWzRdLGc9bls1XSx5PW5bNl0sYj1uWzddLHc9bls4XSxFPW5bOV0sUz1uWzEwXSx4PW5bMTFdLFQ9cypzKmMrbCxOPW8qcypjK3UqZixDPXUqcypjLW8qZixrPXMqbypjLXUqZixMPW8qbypjK2wsQT11Km8qYytzKmYsTz1zKnUqYytvKmYsTT1vKnUqYy1zKmYsXz11KnUqYytsLGVbMF09aCpUK20qTit3KkMsZVsxXT1wKlQrZypOK0UqQyxlWzJdPWQqVCt5Kk4rUypDLGVbM109dipUK2IqTit4KkMsZVs0XT1oKmsrbSpMK3cqQSxlWzVdPXAqaytnKkwrRSpBLGVbNl09ZCprK3kqTCtTKkEsZVs3XT12KmsrYipMK3gqQSxlWzhdPWgqTyttKk0rdypfLGVbOV09cCpPK2cqTStFKl8sZVsxMF09ZCpPK3kqTStTKl8sZVsxMV09dipPK2IqTSt4Kl8sbiE9PWUmJihlWzEyXT1uWzEyXSxlWzEzXT1uWzEzXSxlWzE0XT1uWzE0XSxlWzE1XT1uWzE1XSksZSl9LGMucm90YXRlWD1mdW5jdGlvbihlLHQsbil7dmFyIHI9TWF0aC5zaW4obiksaT1NYXRoLmNvcyhuKSxzPXRbNF0sbz10WzVdLHU9dFs2XSxhPXRbN10sZj10WzhdLGw9dFs5XSxjPXRbMTBdLGg9dFsxMV07cmV0dXJuIHQhPT1lJiYoZVswXT10WzBdLGVbMV09dFsxXSxlWzJdPXRbMl0sZVszXT10WzNdLGVbMTJdPXRbMTJdLGVbMTNdPXRbMTNdLGVbMTRdPXRbMTRdLGVbMTVdPXRbMTVdKSxlWzRdPXMqaStmKnIsZVs1XT1vKmkrbCpyLGVbNl09dSppK2MqcixlWzddPWEqaStoKnIsZVs4XT1mKmktcypyLGVbOV09bCppLW8qcixlWzEwXT1jKmktdSpyLGVbMTFdPWgqaS1hKnIsZX0sYy5yb3RhdGVZPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj1NYXRoLnNpbihuKSxpPU1hdGguY29zKG4pLHM9dFswXSxvPXRbMV0sdT10WzJdLGE9dFszXSxmPXRbOF0sbD10WzldLGM9dFsxMF0saD10WzExXTtyZXR1cm4gdCE9PWUmJihlWzRdPXRbNF0sZVs1XT10WzVdLGVbNl09dFs2XSxlWzddPXRbN10sZVsxMl09dFsxMl0sZVsxM109dFsxM10sZVsxNF09dFsxNF0sZVsxNV09dFsxNV0pLGVbMF09cyppLWYqcixlWzFdPW8qaS1sKnIsZVsyXT11KmktYypyLGVbM109YSppLWgqcixlWzhdPXMqcitmKmksZVs5XT1vKnIrbCppLGVbMTBdPXUqcitjKmksZVsxMV09YSpyK2gqaSxlfSxjLnJvdGF0ZVo9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPU1hdGguc2luKG4pLGk9TWF0aC5jb3Mobikscz10WzBdLG89dFsxXSx1PXRbMl0sYT10WzNdLGY9dFs0XSxsPXRbNV0sYz10WzZdLGg9dFs3XTtyZXR1cm4gdCE9PWUmJihlWzhdPXRbOF0sZVs5XT10WzldLGVbMTBdPXRbMTBdLGVbMTFdPXRbMTFdLGVbMTJdPXRbMTJdLGVbMTNdPXRbMTNdLGVbMTRdPXRbMTRdLGVbMTVdPXRbMTVdKSxlWzBdPXMqaStmKnIsZVsxXT1vKmkrbCpyLGVbMl09dSppK2MqcixlWzNdPWEqaStoKnIsZVs0XT1mKmktcypyLGVbNV09bCppLW8qcixlWzZdPWMqaS11KnIsZVs3XT1oKmktYSpyLGV9LGMuZnJvbVJvdGF0aW9uVHJhbnNsYXRpb249ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM10sdT1yK3IsYT1pK2ksZj1zK3MsbD1yKnUsYz1yKmEsaD1yKmYscD1pKmEsZD1pKmYsdj1zKmYsbT1vKnUsZz1vKmEseT1vKmY7cmV0dXJuIGVbMF09MS0ocCt2KSxlWzFdPWMreSxlWzJdPWgtZyxlWzNdPTAsZVs0XT1jLXksZVs1XT0xLShsK3YpLGVbNl09ZCttLGVbN109MCxlWzhdPWgrZyxlWzldPWQtbSxlWzEwXT0xLShsK3ApLGVbMTFdPTAsZVsxMl09blswXSxlWzEzXT1uWzFdLGVbMTRdPW5bMl0sZVsxNV09MSxlfSxjLmZyb21RdWF0PWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXSxyPXRbMV0saT10WzJdLHM9dFszXSxvPW4rbix1PXIrcixhPWkraSxmPW4qbyxsPW4qdSxjPW4qYSxoPXIqdSxwPXIqYSxkPWkqYSx2PXMqbyxtPXMqdSxnPXMqYTtyZXR1cm4gZVswXT0xLShoK2QpLGVbMV09bCtnLGVbMl09Yy1tLGVbM109MCxlWzRdPWwtZyxlWzVdPTEtKGYrZCksZVs2XT1wK3YsZVs3XT0wLGVbOF09YyttLGVbOV09cC12LGVbMTBdPTEtKGYraCksZVsxMV09MCxlWzEyXT0wLGVbMTNdPTAsZVsxNF09MCxlWzE1XT0xLGV9LGMuZnJ1c3R1bT1mdW5jdGlvbihlLHQsbixyLGkscyxvKXt2YXIgdT0xLyhuLXQpLGE9MS8oaS1yKSxmPTEvKHMtbyk7cmV0dXJuIGVbMF09cyoyKnUsZVsxXT0wLGVbMl09MCxlWzNdPTAsZVs0XT0wLGVbNV09cyoyKmEsZVs2XT0wLGVbN109MCxlWzhdPShuK3QpKnUsZVs5XT0oaStyKSphLGVbMTBdPShvK3MpKmYsZVsxMV09LTEsZVsxMl09MCxlWzEzXT0wLGVbMTRdPW8qcyoyKmYsZVsxNV09MCxlfSxjLnBlcnNwZWN0aXZlPWZ1bmN0aW9uKGUsdCxuLHIsaSl7dmFyIHM9MS9NYXRoLnRhbih0LzIpLG89MS8oci1pKTtyZXR1cm4gZVswXT1zL24sZVsxXT0wLGVbMl09MCxlWzNdPTAsZVs0XT0wLGVbNV09cyxlWzZdPTAsZVs3XT0wLGVbOF09MCxlWzldPTAsZVsxMF09KGkrcikqbyxlWzExXT0tMSxlWzEyXT0wLGVbMTNdPTAsZVsxNF09MippKnIqbyxlWzE1XT0wLGV9LGMub3J0aG89ZnVuY3Rpb24oZSx0LG4scixpLHMsbyl7dmFyIHU9MS8odC1uKSxhPTEvKHItaSksZj0xLyhzLW8pO3JldHVybiBlWzBdPS0yKnUsZVsxXT0wLGVbMl09MCxlWzNdPTAsZVs0XT0wLGVbNV09LTIqYSxlWzZdPTAsZVs3XT0wLGVbOF09MCxlWzldPTAsZVsxMF09MipmLGVbMTFdPTAsZVsxMl09KHQrbikqdSxlWzEzXT0oaStyKSphLGVbMTRdPShvK3MpKmYsZVsxNV09MSxlfSxjLmxvb2tBdD1mdW5jdGlvbihlLG4scixpKXt2YXIgcyxvLHUsYSxmLGwsaCxwLGQsdixtPW5bMF0sZz1uWzFdLHk9blsyXSxiPWlbMF0sdz1pWzFdLEU9aVsyXSxTPXJbMF0seD1yWzFdLFQ9clsyXTtyZXR1cm4gTWF0aC5hYnMobS1TKTx0JiZNYXRoLmFicyhnLXgpPHQmJk1hdGguYWJzKHktVCk8dD9jLmlkZW50aXR5KGUpOihoPW0tUyxwPWcteCxkPXktVCx2PTEvTWF0aC5zcXJ0KGgqaCtwKnArZCpkKSxoKj12LHAqPXYsZCo9dixzPXcqZC1FKnAsbz1FKmgtYipkLHU9YipwLXcqaCx2PU1hdGguc3FydChzKnMrbypvK3UqdSksdj8odj0xL3Yscyo9dixvKj12LHUqPXYpOihzPTAsbz0wLHU9MCksYT1wKnUtZCpvLGY9ZCpzLWgqdSxsPWgqby1wKnMsdj1NYXRoLnNxcnQoYSphK2YqZitsKmwpLHY/KHY9MS92LGEqPXYsZio9dixsKj12KTooYT0wLGY9MCxsPTApLGVbMF09cyxlWzFdPWEsZVsyXT1oLGVbM109MCxlWzRdPW8sZVs1XT1mLGVbNl09cCxlWzddPTAsZVs4XT11LGVbOV09bCxlWzEwXT1kLGVbMTFdPTAsZVsxMl09LShzKm0rbypnK3UqeSksZVsxM109LShhKm0rZipnK2wqeSksZVsxNF09LShoKm0rcCpnK2QqeSksZVsxNV09MSxlKX0sYy5zdHI9ZnVuY3Rpb24oZSl7cmV0dXJuXCJtYXQ0KFwiK2VbMF0rXCIsIFwiK2VbMV0rXCIsIFwiK2VbMl0rXCIsIFwiK2VbM10rXCIsIFwiK2VbNF0rXCIsIFwiK2VbNV0rXCIsIFwiK2VbNl0rXCIsIFwiK2VbN10rXCIsIFwiK2VbOF0rXCIsIFwiK2VbOV0rXCIsIFwiK2VbMTBdK1wiLCBcIitlWzExXStcIiwgXCIrZVsxMl0rXCIsIFwiK2VbMTNdK1wiLCBcIitlWzE0XStcIiwgXCIrZVsxNV0rXCIpXCJ9LHR5cGVvZiBlIT1cInVuZGVmaW5lZFwiJiYoZS5tYXQ0PWMpO3ZhciBoPXt9O2guY3JlYXRlPWZ1bmN0aW9uKCl7dmFyIGU9bmV3IG4oNCk7cmV0dXJuIGVbMF09MCxlWzFdPTAsZVsyXT0wLGVbM109MSxlfSxoLnJvdGF0aW9uVG89ZnVuY3Rpb24oKXt2YXIgZT1vLmNyZWF0ZSgpLHQ9by5mcm9tVmFsdWVzKDEsMCwwKSxuPW8uZnJvbVZhbHVlcygwLDEsMCk7cmV0dXJuIGZ1bmN0aW9uKHIsaSxzKXt2YXIgdT1vLmRvdChpLHMpO3JldHVybiB1PC0wLjk5OTk5OT8oby5jcm9zcyhlLHQsaSksby5sZW5ndGgoZSk8MWUtNiYmby5jcm9zcyhlLG4saSksby5ub3JtYWxpemUoZSxlKSxoLnNldEF4aXNBbmdsZShyLGUsTWF0aC5QSSkscik6dT4uOTk5OTk5PyhyWzBdPTAsclsxXT0wLHJbMl09MCxyWzNdPTEscik6KG8uY3Jvc3MoZSxpLHMpLHJbMF09ZVswXSxyWzFdPWVbMV0sclsyXT1lWzJdLHJbM109MSt1LGgubm9ybWFsaXplKHIscikpfX0oKSxoLnNldEF4ZXM9ZnVuY3Rpb24oKXt2YXIgZT1sLmNyZWF0ZSgpO3JldHVybiBmdW5jdGlvbih0LG4scixpKXtyZXR1cm4gZVswXT1yWzBdLGVbM109clsxXSxlWzZdPXJbMl0sZVsxXT1pWzBdLGVbNF09aVsxXSxlWzddPWlbMl0sZVsyXT1uWzBdLGVbNV09blsxXSxlWzhdPW5bMl0saC5ub3JtYWxpemUodCxoLmZyb21NYXQzKHQsZSkpfX0oKSxoLmNsb25lPXUuY2xvbmUsaC5mcm9tVmFsdWVzPXUuZnJvbVZhbHVlcyxoLmNvcHk9dS5jb3B5LGguc2V0PXUuc2V0LGguaWRlbnRpdHk9ZnVuY3Rpb24oZSl7cmV0dXJuIGVbMF09MCxlWzFdPTAsZVsyXT0wLGVbM109MSxlfSxoLnNldEF4aXNBbmdsZT1mdW5jdGlvbihlLHQsbil7bio9LjU7dmFyIHI9TWF0aC5zaW4obik7cmV0dXJuIGVbMF09cip0WzBdLGVbMV09cip0WzFdLGVbMl09cip0WzJdLGVbM109TWF0aC5jb3MobiksZX0saC5hZGQ9dS5hZGQsaC5tdWx0aXBseT1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXSx1PW5bMF0sYT1uWzFdLGY9blsyXSxsPW5bM107cmV0dXJuIGVbMF09cipsK28qdStpKmYtcyphLGVbMV09aSpsK28qYStzKnUtcipmLGVbMl09cypsK28qZityKmEtaSp1LGVbM109bypsLXIqdS1pKmEtcypmLGV9LGgubXVsPWgubXVsdGlwbHksaC5zY2FsZT11LnNjYWxlLGgucm90YXRlWD1mdW5jdGlvbihlLHQsbil7bio9LjU7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXSx1PU1hdGguc2luKG4pLGE9TWF0aC5jb3Mobik7cmV0dXJuIGVbMF09ciphK28qdSxlWzFdPWkqYStzKnUsZVsyXT1zKmEtaSp1LGVbM109byphLXIqdSxlfSxoLnJvdGF0ZVk9ZnVuY3Rpb24oZSx0LG4pe24qPS41O3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM10sdT1NYXRoLnNpbihuKSxhPU1hdGguY29zKG4pO3JldHVybiBlWzBdPXIqYS1zKnUsZVsxXT1pKmErbyp1LGVbMl09cyphK3IqdSxlWzNdPW8qYS1pKnUsZX0saC5yb3RhdGVaPWZ1bmN0aW9uKGUsdCxuKXtuKj0uNTt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz10WzNdLHU9TWF0aC5zaW4obiksYT1NYXRoLmNvcyhuKTtyZXR1cm4gZVswXT1yKmEraSp1LGVbMV09aSphLXIqdSxlWzJdPXMqYStvKnUsZVszXT1vKmEtcyp1LGV9LGguY2FsY3VsYXRlVz1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0scj10WzFdLGk9dFsyXTtyZXR1cm4gZVswXT1uLGVbMV09cixlWzJdPWksZVszXT0tTWF0aC5zcXJ0KE1hdGguYWJzKDEtbipuLXIqci1pKmkpKSxlfSxoLmRvdD11LmRvdCxoLmxlcnA9dS5sZXJwLGguc2xlcnA9ZnVuY3Rpb24oZSx0LG4scil7dmFyIGk9dFswXSxzPXRbMV0sbz10WzJdLHU9dFszXSxhPW5bMF0sZj1uWzFdLGw9blsyXSxjPW5bM10saCxwLGQsdixtO3JldHVybiBwPWkqYStzKmYrbypsK3UqYyxwPDAmJihwPS1wLGE9LWEsZj0tZixsPS1sLGM9LWMpLDEtcD4xZS02PyhoPU1hdGguYWNvcyhwKSxkPU1hdGguc2luKGgpLHY9TWF0aC5zaW4oKDEtcikqaCkvZCxtPU1hdGguc2luKHIqaCkvZCk6KHY9MS1yLG09ciksZVswXT12KmkrbSphLGVbMV09dipzK20qZixlWzJdPXYqbyttKmwsZVszXT12KnUrbSpjLGV9LGguaW52ZXJ0PWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXSxyPXRbMV0saT10WzJdLHM9dFszXSxvPW4qbityKnIraSppK3Mqcyx1PW8/MS9vOjA7cmV0dXJuIGVbMF09LW4qdSxlWzFdPS1yKnUsZVsyXT0taSp1LGVbM109cyp1LGV9LGguY29uanVnYXRlPWZ1bmN0aW9uKGUsdCl7cmV0dXJuIGVbMF09LXRbMF0sZVsxXT0tdFsxXSxlWzJdPS10WzJdLGVbM109dFszXSxlfSxoLmxlbmd0aD11Lmxlbmd0aCxoLmxlbj1oLmxlbmd0aCxoLnNxdWFyZWRMZW5ndGg9dS5zcXVhcmVkTGVuZ3RoLGguc3FyTGVuPWguc3F1YXJlZExlbmd0aCxoLm5vcm1hbGl6ZT11Lm5vcm1hbGl6ZSxoLmZyb21NYXQzPWZ1bmN0aW9uKCl7dmFyIGU9dHlwZW9mIEludDhBcnJheSE9XCJ1bmRlZmluZWRcIj9uZXcgSW50OEFycmF5KFsxLDIsMF0pOlsxLDIsMF07cmV0dXJuIGZ1bmN0aW9uKHQsbil7dmFyIHI9blswXStuWzRdK25bOF0saTtpZihyPjApaT1NYXRoLnNxcnQocisxKSx0WzNdPS41KmksaT0uNS9pLHRbMF09KG5bN10tbls1XSkqaSx0WzFdPShuWzJdLW5bNl0pKmksdFsyXT0oblszXS1uWzFdKSppO2Vsc2V7dmFyIHM9MDtuWzRdPm5bMF0mJihzPTEpLG5bOF0+bltzKjMrc10mJihzPTIpO3ZhciBvPWVbc10sdT1lW29dO2k9TWF0aC5zcXJ0KG5bcyozK3NdLW5bbyozK29dLW5bdSozK3VdKzEpLHRbc109LjUqaSxpPS41L2ksdFszXT0oblt1KjMrb10tbltvKjMrdV0pKmksdFtvXT0obltvKjMrc10rbltzKjMrb10pKmksdFt1XT0oblt1KjMrc10rbltzKjMrdV0pKml9cmV0dXJuIHR9fSgpLGguc3RyPWZ1bmN0aW9uKGUpe3JldHVyblwicXVhdChcIitlWzBdK1wiLCBcIitlWzFdK1wiLCBcIitlWzJdK1wiLCBcIitlWzNdK1wiKVwifSx0eXBlb2YgZSE9XCJ1bmRlZmluZWRcIiYmKGUucXVhdD1oKX0odC5leHBvcnRzKX0pKHRoaXMpO1xuIiwiLypcblx0Z2xTaGFkZXJcblx0Q29weXJpZ2h0IChjKSAyMDEzLCBOZXJ2b3VzIFN5c3RlbSwgaW5jLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuXHRcblx0UmVkaXN0cmlidXRpb24gYW5kIHVzZSBpbiBzb3VyY2UgYW5kIGJpbmFyeSBmb3Jtcywgd2l0aCBvciB3aXRob3V0IG1vZGlmaWNhdGlvbixcbmFyZSBwZXJtaXR0ZWQgcHJvdmlkZWQgdGhhdCB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnMgYXJlIG1ldDpcblxuICAqIFJlZGlzdHJpYnV0aW9ucyBvZiBzb3VyY2UgY29kZSBtdXN0IHJldGFpbiB0aGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSwgdGhpc1xuICAgIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyLlxuICAqIFJlZGlzdHJpYnV0aW9ucyBpbiBiaW5hcnkgZm9ybSBtdXN0IHJlcHJvZHVjZSB0aGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSxcbiAgICB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyIGluIHRoZSBkb2N1bWVudGF0aW9uIFxuICAgIGFuZC9vciBvdGhlciBtYXRlcmlhbHMgcHJvdmlkZWQgd2l0aCB0aGUgZGlzdHJpYnV0aW9uLlxuXG5USElTIFNPRlRXQVJFIElTIFBST1ZJREVEIEJZIFRIRSBDT1BZUklHSFQgSE9MREVSUyBBTkQgQ09OVFJJQlVUT1JTIFwiQVMgSVNcIiBBTkRcbkFOWSBFWFBSRVNTIE9SIElNUExJRUQgV0FSUkFOVElFUywgSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFRIRSBJTVBMSUVEXG5XQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSBBTkQgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQVJFIFxuRElTQ0xBSU1FRC4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFIENPUFlSSUdIVCBIT0xERVIgT1IgQ09OVFJJQlVUT1JTIEJFIExJQUJMRSBGT1JcbkFOWSBESVJFQ1QsIElORElSRUNULCBJTkNJREVOVEFMLCBTUEVDSUFMLCBFWEVNUExBUlksIE9SIENPTlNFUVVFTlRJQUwgREFNQUdFU1xuKElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBQUk9DVVJFTUVOVCBPRiBTVUJTVElUVVRFIEdPT0RTIE9SIFNFUlZJQ0VTO1xuTE9TUyBPRiBVU0UsIERBVEEsIE9SIFBST0ZJVFM7IE9SIEJVU0lORVNTIElOVEVSUlVQVElPTikgSE9XRVZFUiBDQVVTRUQgQU5EIE9OXG5BTlkgVEhFT1JZIE9GIExJQUJJTElUWSwgV0hFVEhFUiBJTiBDT05UUkFDVCwgU1RSSUNUIExJQUJJTElUWSwgT1IgVE9SVFxuKElOQ0xVRElORyBORUdMSUdFTkNFIE9SIE9USEVSV0lTRSkgQVJJU0lORyBJTiBBTlkgV0FZIE9VVCBPRiBUSEUgVVNFIE9GIFRISVNcblNPRlRXQVJFLCBFVkVOIElGIEFEVklTRUQgT0YgVEhFIFBPU1NJQklMSVRZIE9GIFNVQ0ggREFNQUdFLlxuXG5cdHVzZXMgc29tZSBpZGVhcyAoYW5kIGNvZGUpIGZyb20gZ2wtc2hhZGVyIGh0dHBzOi8vZ2l0aHViLmNvbS9taWtvbGFseXNlbmtvL2dsLXNoYWRlclxuXHRob3dldmVyIHNvbWUgZGlmZmVyZW5jZXMgaW5jbHVkZSBzYXZpbmcgdW5pZm9ybSBsb2NhdGlvbnMgYW5kIHF1ZXJ5aW5nIGdsIHRvIGdldCB1bmlmb3JtcyBhbmQgYXR0cmlicyBpbnN0ZWFkIG9mIHBhcnNpbmcgZmlsZXMgYW5kIHVzZXMgbm9ybWFsIHN5bnRheCBpbnN0ZWFkIG9mIGZha2Ugb3BlcmF0b3Igb3ZlcmxvYWRpbmcgd2hpY2ggaXMgYSBjb25mdXNpbmcgcGF0dGVybiBpbiBKYXZhc2NyaXB0LlxuKi9cblxuKGZ1bmN0aW9uKF9nbG9iYWwpIHtcbiAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgdmFyIHNoaW0gPSB7fTtcbiAgaWYgKHR5cGVvZihleHBvcnRzKSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZih0eXBlb2YgZGVmaW5lID09ICdmdW5jdGlvbicgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT0gJ29iamVjdCcgJiYgZGVmaW5lLmFtZCkge1xuICAgICAgc2hpbS5leHBvcnRzID0ge307XG4gICAgICBkZWZpbmUoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBzaGltLmV4cG9ydHM7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy90aGlzIHRoaW5nIGxpdmVzIGluIGEgYnJvd3NlciwgZGVmaW5lIGl0cyBuYW1lc3BhY2VzIGluIGdsb2JhbFxuICAgICAgc2hpbS5leHBvcnRzID0gdHlwZW9mKHdpbmRvdykgIT09ICd1bmRlZmluZWQnID8gd2luZG93IDogX2dsb2JhbDtcbiAgICB9XG4gIH1cbiAgZWxzZSB7XG4gICAgLy90aGlzIHRoaW5nIGxpdmVzIGluIGNvbW1vbmpzLCBkZWZpbmUgaXRzIG5hbWVzcGFjZXMgaW4gZXhwb3J0c1xuICAgIHNoaW0uZXhwb3J0cyA9IGV4cG9ydHM7XG4gIH1cbiAgKGZ1bmN0aW9uKGV4cG9ydHMpIHtcblxuXG4gIHZhciBnbDtcbiAgZnVuY3Rpb24gU2hhZGVyKGdsLCBwcm9nKSB7XG4gICAgdGhpcy5nbCA9IGdsO1xuICAgIHRoaXMucHJvZ3JhbSA9IHByb2c7XG4gICAgdGhpcy51bmlmb3JtcyA9IHt9O1xuICAgIHRoaXMuYXR0cmlicyA9IHt9O1xuICAgIHRoaXMuaXNSZWFkeSA9IGZhbHNlO1xuICB9XG5cbiAgU2hhZGVyLnByb3RvdHlwZS5iZWdpbiA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuZ2wudXNlUHJvZ3JhbSh0aGlzLnByb2dyYW0pO1xuICAgIHRoaXMuZW5hYmxlQXR0cmlicygpO1xuICB9XG5cbiAgU2hhZGVyLnByb3RvdHlwZS5lbmQgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmRpc2FibGVBdHRyaWJzKCk7XG4gIH1cblxuICBTaGFkZXIucHJvdG90eXBlLmVuYWJsZUF0dHJpYnMgPSBmdW5jdGlvbigpIHtcbiAgICBmb3IodmFyIGF0dHJpYiBpbiB0aGlzLmF0dHJpYnMpIHtcbiAgICB0aGlzLmF0dHJpYnNbYXR0cmliXS5lbmFibGUoKTtcbiAgICB9XG4gIH1cbiAgU2hhZGVyLnByb3RvdHlwZS5kaXNhYmxlQXR0cmlicyA9IGZ1bmN0aW9uKCkge1xuICAgIGZvcih2YXIgYXR0cmliIGluIHRoaXMuYXR0cmlicykge1xuICAgIHRoaXMuYXR0cmlic1thdHRyaWJdLmRpc2FibGUoKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBtYWtlVmVjdG9yVW5pZm9ybShnbCwgc2hhZGVyLCBsb2NhdGlvbiwgb2JqLCB0eXBlLCBkLCBuYW1lKSB7XG4gICAgdmFyIHVuaWZvcm1PYmogPSB7fTtcbiAgICB1bmlmb3JtT2JqLmxvY2F0aW9uID0gbG9jYXRpb247XG4gICAgaWYoZCA+IDEpIHtcbiAgICAgIHR5cGUgKz0gXCJ2XCI7XG4gICAgfVxuICAgIHZhciBzZXR0ZXIgPSBuZXcgRnVuY3Rpb24oXCJnbFwiLCBcInByb2dcIiwgXCJsb2NcIiwgXCJ2XCIsIFwiZ2wudW5pZm9ybVwiICsgZCArIHR5cGUgKyBcIihsb2MsIHYpXCIpO1xuICAgIHVuaWZvcm1PYmouc2V0ID0gc2V0dGVyLmJpbmQodW5kZWZpbmVkLCBnbCwgc2hhZGVyLnByb2dyYW0sbG9jYXRpb24pO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIG5hbWUsIHtcbiAgICAgIHZhbHVlOnVuaWZvcm1PYmosXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBtYWtlTWF0cml4VW5pZm9ybShnbCwgc2hhZGVyLCBsb2NhdGlvbiwgb2JqLCBkLCBuYW1lKSB7XG4gICAgdmFyIHVuaWZvcm1PYmogPSB7fTtcbiAgICB1bmlmb3JtT2JqLmxvY2F0aW9uID0gbG9jYXRpb247XG4gICAgdmFyIHNldHRlciA9IG5ldyBGdW5jdGlvbihcImdsXCIsIFwicHJvZ1wiLCBcImxvY1wiLFwidlwiLCBcImdsLnVuaWZvcm1NYXRyaXhcIiArIGQgKyBcImZ2KGxvYywgZmFsc2UsIHYpXCIpO1xuICAgIHVuaWZvcm1PYmouc2V0ID0gc2V0dGVyLmJpbmQodW5kZWZpbmVkLCBnbCwgc2hhZGVyLnByb2dyYW0sbG9jYXRpb24pO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIG5hbWUsIHtcbiAgICAgIHZhbHVlOnVuaWZvcm1PYmosXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBtYWtlVmVjdG9yQXR0cmliKGdsLCBzaGFkZXIsIGxvY2F0aW9uLCBvYmosIGQsIG5hbWUpIHtcbiAgICB2YXIgb3V0ID0ge307XG4gICAgb3V0LnNldCA9IGZ1bmN0aW9uIHNldEF0dHJpYihidWZmZXIsdHlwZSkge1xuICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLGJ1ZmZlcik7XG4gICAgZ2wudmVydGV4QXR0cmliUG9pbnRlcihsb2NhdGlvbiwgZCwgdHlwZXx8Z2wuRkxPQVQsIGZhbHNlLCAwLCAwKTtcbiAgICB9XG4gICAgb3V0LnBvaW50ZXIgPSBmdW5jdGlvbiBhdHRyaWJQb2ludGVyKHR5cGUsIG5vcm1hbGl6ZWQsIHN0cmlkZSwgb2Zmc2V0KSB7XG4gICAgICBnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKGxvY2F0aW9uLCBkLCB0eXBlfHxnbC5GTE9BVCwgbm9ybWFsaXplZD90cnVlOmZhbHNlLCBzdHJpZGV8fDAsIG9mZnNldHx8MCk7XG4gICAgfTtcbiAgICBvdXQuZW5hYmxlID0gZnVuY3Rpb24gZW5hYmxlQXR0cmliKCkge1xuICAgICAgZ2wuZW5hYmxlVmVydGV4QXR0cmliQXJyYXkobG9jYXRpb24pO1xuICAgIH07XG4gICAgb3V0LmRpc2FibGUgPSBmdW5jdGlvbiBkaXNhYmxlQXR0cmliKCkge1xuICAgICAgZ2wuZGlzYWJsZVZlcnRleEF0dHJpYkFycmF5KGxvY2F0aW9uKTtcbiAgICB9O1xuICAgIG91dC5sb2NhdGlvbiA9IGxvY2F0aW9uO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIG5hbWUsIHtcbiAgICB2YWx1ZTogb3V0LFxuICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldHVwVW5pZm9ybShnbCxzaGFkZXIsIHVuaWZvcm0sbG9jKSB7XG4gICAgc3dpdGNoKHVuaWZvcm0udHlwZSkge1xuICAgICAgY2FzZSBnbC5JTlQ6XG4gICAgICBjYXNlIGdsLkJPT0w6XG4gICAgICBjYXNlIGdsLlNBTVBMRVJfMkQ6XG4gICAgICBjYXNlIGdsLlNBTVBMRVJfQ1VCRTpcbiAgICAgICAgbWFrZVZlY3RvclVuaWZvcm0oZ2wsc2hhZGVyLGxvYywgc2hhZGVyLnVuaWZvcm1zLCBcImlcIiwxLHVuaWZvcm0ubmFtZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBnbC5JTlRfVkVDMjpcbiAgICAgIGNhc2UgZ2wuQk9PTF9WRUMyOlxuICAgICAgICBtYWtlVmVjdG9yVW5pZm9ybShnbCxzaGFkZXIsbG9jLCBzaGFkZXIudW5pZm9ybXMsIFwiaVwiLDIsdW5pZm9ybS5uYW1lKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGdsLklOVF9WRUMzOlxuICAgICAgY2FzZSBnbC5CT09MX1ZFQzM6XG4gICAgICAgIG1ha2VWZWN0b3JVbmlmb3JtKGdsLHNoYWRlcixsb2MsIHNoYWRlci51bmlmb3JtcywgXCJpXCIsMyx1bmlmb3JtLm5hbWUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgZ2wuSU5UX1ZFQzQ6XG4gICAgICBjYXNlIGdsLkJPT0xfVkVDNDpcbiAgICAgICAgbWFrZVZlY3RvclVuaWZvcm0oZ2wsc2hhZGVyLGxvYywgc2hhZGVyLnVuaWZvcm1zLCBcImlcIiw0LHVuaWZvcm0ubmFtZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBnbC5GTE9BVDpcbiAgICAgICAgbWFrZVZlY3RvclVuaWZvcm0oZ2wsc2hhZGVyLGxvYywgc2hhZGVyLnVuaWZvcm1zLCBcImZcIiwxLHVuaWZvcm0ubmFtZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBnbC5GTE9BVF9WRUMyOlxuICAgICAgICBtYWtlVmVjdG9yVW5pZm9ybShnbCxzaGFkZXIsbG9jLCBzaGFkZXIudW5pZm9ybXMsIFwiZlwiLDIsdW5pZm9ybS5uYW1lKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGdsLkZMT0FUX1ZFQzM6XG4gICAgICAgIG1ha2VWZWN0b3JVbmlmb3JtKGdsLHNoYWRlcixsb2MsIHNoYWRlci51bmlmb3JtcywgXCJmXCIsMyx1bmlmb3JtLm5hbWUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgZ2wuRkxPQVRfVkVDNDpcbiAgICAgICAgbWFrZVZlY3RvclVuaWZvcm0oZ2wsc2hhZGVyLGxvYywgc2hhZGVyLnVuaWZvcm1zLCBcImZcIiw0LHVuaWZvcm0ubmFtZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBnbC5GTE9BVF9NQVQyOlxuICAgICAgICBtYWtlTWF0cml4VW5pZm9ybShnbCxzaGFkZXIsbG9jLCBzaGFkZXIudW5pZm9ybXMsIDIsdW5pZm9ybS5uYW1lKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGdsLkZMT0FUX01BVDM6XG4gICAgICAgIG1ha2VNYXRyaXhVbmlmb3JtKGdsLHNoYWRlcixsb2MsIHNoYWRlci51bmlmb3JtcywgMyx1bmlmb3JtLm5hbWUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgZ2wuRkxPQVRfTUFUNDpcbiAgICAgICAgbWFrZU1hdHJpeFVuaWZvcm0oZ2wsc2hhZGVyLGxvYywgc2hhZGVyLnVuaWZvcm1zLCA0LHVuaWZvcm0ubmFtZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCB1bmlmb3JtIHR5cGUgaW4gc2hhZGVyOiBcIiArc2hhZGVyKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gc2V0dXBBdHRyaWIoZ2wsc2hhZGVyLGF0dHJpYixsb2NhdGlvbikge1xuICAgIHZhciBsZW4gPSAxO1xuICAgIHN3aXRjaChhdHRyaWIudHlwZSkge1xuICAgICAgY2FzZSBnbC5GTE9BVF9WRUMyOlxuICAgICAgICBsZW4gPSAyO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgZ2wuRkxPQVRfVkVDMzpcbiAgICAgICAgbGVuID0gMztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGdsLkZMT0FUX1ZFQzQ6XG4gICAgICAgIGxlbiA9IDQ7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBtYWtlVmVjdG9yQXR0cmliKGdsLCBzaGFkZXIsIGxvY2F0aW9uLHNoYWRlci5hdHRyaWJzLCBsZW4sIGF0dHJpYi5uYW1lKTtcbiAgfVxuXG5cbiAgZnVuY3Rpb24gbG9hZFhNTERvYyhmaWxlbmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIHZhciB4bWxodHRwO1xuICAgICAgdmFyIHRleHQ7XG4gICAgICB4bWxodHRwID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICAgIHhtbGh0dHAub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKHhtbGh0dHAucmVhZHlTdGF0ZSA9PSA0ICYmIHhtbGh0dHAuc3RhdHVzID09IDIwMCkgY2FsbGJhY2soeG1saHR0cC5yZXNwb25zZVRleHQpO1xuICAgICAgfVxuXG4gICAgICB4bWxodHRwLm9wZW4oXCJHRVRcIiwgZmlsZW5hbWUsIHRydWUpO1xuICAgICAgeG1saHR0cC5zZW5kKCk7XG4gIH1cblxuICBmdW5jdGlvbiBnZXRTaGFkZXIoZ2wsIHNyYywgdHlwZSkge1xuICAgICAgdmFyIHNoYWRlcjtcbiAgICAgIC8vZGVjaWRlcyBpZiBpdCdzIGEgZnJhZ21lbnQgb3IgdmVydGV4IHNoYWRlclxuXG4gICAgICBpZiAodHlwZSA9PSBcImZyYWdtZW50XCIpIHtcbiAgICAgICAgICBzaGFkZXIgPSBnbC5jcmVhdGVTaGFkZXIoZ2wuRlJBR01FTlRfU0hBREVSKTtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKHR5cGUgPT0gXCJ2ZXJ0ZXhcIikge1xuICAgICAgICAgIHNoYWRlciA9IGdsLmNyZWF0ZVNoYWRlcihnbC5WRVJURVhfU0hBREVSKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgICAgZ2wuc2hhZGVyU291cmNlKHNoYWRlciwgc3JjKTtcbiAgICAgIGdsLmNvbXBpbGVTaGFkZXIoc2hhZGVyKTtcblxuICAgICAgaWYgKCFnbC5nZXRTaGFkZXJQYXJhbWV0ZXIoc2hhZGVyLCBnbC5DT01QSUxFX1NUQVRVUykpIHtcbiAgICAgICAgICBhbGVydChnbC5nZXRTaGFkZXJJbmZvTG9nKHNoYWRlcikpO1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHNoYWRlcjtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldHVwU2hhZGVyUHJvZ3JhbShnbCxzaGFkZXJQcm9ncmFtLCB2ZXJ0ZXhTaGFkZXIsIGZyYWdtZW50U2hhZGVyLGNhbGxiYWNrKSB7XG4gICAgICBnbC5hdHRhY2hTaGFkZXIoc2hhZGVyUHJvZ3JhbSwgdmVydGV4U2hhZGVyKTtcbiAgICAgIGdsLmF0dGFjaFNoYWRlcihzaGFkZXJQcm9ncmFtLCBmcmFnbWVudFNoYWRlcik7XG4gICAgICBnbC5saW5rUHJvZ3JhbShzaGFkZXJQcm9ncmFtKTtcblxuICAgICAgaWYgKCFnbC5nZXRQcm9ncmFtUGFyYW1ldGVyKHNoYWRlclByb2dyYW0sIGdsLkxJTktfU1RBVFVTKSkge1xuICAgICAgICAgIGFsZXJ0KFwiQ291bGQgbm90IGluaXRpYWxpc2Ugc2hhZGVyc1wiKTtcbiAgICAgIH1cbiAgICAgIGNhbGxiYWNrKHNoYWRlclByb2dyYW0pO1xuICB9XG5cbiAgdmFyIGdsU2hhZGVyID0gZXhwb3J0cztcbiAgXG4gIGdsU2hhZGVyLnNldEdMID0gZnVuY3Rpb24oX2dsKSB7XG4gICAgZ2wgPSBfZ2w7XG4gIH1cbiAgXG4gIGdsU2hhZGVyLm1ha2VTaGFkZXIgPSBmdW5jdGlvbihnbCxwcm9ncmFtLHNoYWRlcikge1xuICAgIHZhciB0b3RhbFVuaWZvcm1zID0gZ2wuZ2V0UHJvZ3JhbVBhcmFtZXRlcihwcm9ncmFtLCBnbC5BQ1RJVkVfVU5JRk9STVMpO1xuICAgIHNoYWRlciA9IHNoYWRlciB8fCBuZXcgU2hhZGVyKGdsLHByb2dyYW0pO1xuICAgIGZvcih2YXIgaT0wO2k8dG90YWxVbmlmb3JtczsrK2kpIHtcbiAgICAgIHZhciB1bmlmb3JtID0gZ2wuZ2V0QWN0aXZlVW5pZm9ybShwcm9ncmFtLCBpKTtcbiAgICAgIHNldHVwVW5pZm9ybShnbCxzaGFkZXIsIHVuaWZvcm0sZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHByb2dyYW0sIHVuaWZvcm0ubmFtZSkpO1xuICAgIH1cbiAgICB2YXIgdG90YWxBdHRyaWJzID0gZ2wuZ2V0UHJvZ3JhbVBhcmFtZXRlcihwcm9ncmFtLGdsLkFDVElWRV9BVFRSSUJVVEVTKTtcbiAgICBmb3IodmFyIGk9MDtpPHRvdGFsQXR0cmliczsrK2kpIHtcbiAgICAgIHZhciBhdHRyaWIgPSBnbC5nZXRBY3RpdmVBdHRyaWIocHJvZ3JhbSwgaSk7XG4gICAgICBzZXR1cEF0dHJpYihnbCxzaGFkZXIsYXR0cmliLGkpO1xuICAgIH1cbiAgICBzaGFkZXIuaXNSZWFkeSA9IHRydWU7XG4gICAgcmV0dXJuIHNoYWRlcjtcbiAgfVxuXG4gIGdsU2hhZGVyLmxvYWRTaGFkZXIgPSBmdW5jdGlvbihnbCwgdmVydGV4RmlsZSwgZnJhZ21lbnRGaWxlKSB7XG4gICAgICB2YXIgc2hhZGVyUHJvZ3JhbSA9IGdsLmNyZWF0ZVByb2dyYW0oKTtcbiAgICB2YXIgc2hhZGVyID0gbmV3IFNoYWRlcihnbCxzaGFkZXJQcm9ncmFtKTtcbiAgICAgIHZhciBmcmFnU2hhZGVyLCB2ZXJ0U2hhZGVyO1xuICAgICAgdmFyIGxvYWRlZCA9IDA7XG4gICAgICB2YXIgeG1saHR0cDtcbiAgICAgIHhtbGh0dHAgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAgIGxvYWRYTUxEb2ModmVydGV4RmlsZSwgZnVuY3Rpb24odHh0KSB7dmVydFNoYWRlciA9IGdldFNoYWRlcihnbCwgdHh0LCBcInZlcnRleFwiKTtpZigrK2xvYWRlZCA9PSAyKSBzZXR1cFNoYWRlclByb2dyYW0oZ2wsc2hhZGVyUHJvZ3JhbSwgdmVydFNoYWRlcixmcmFnU2hhZGVyLGZ1bmN0aW9uKHByb2cpIHtnbFNoYWRlci5tYWtlU2hhZGVyKGdsLHByb2csc2hhZGVyKTt9KX0pO1xuICAgICAgbG9hZFhNTERvYyhmcmFnbWVudEZpbGUsIGZ1bmN0aW9uKHR4dCkge2ZyYWdTaGFkZXIgPSBnZXRTaGFkZXIoZ2wsIHR4dCwgXCJmcmFnbWVudFwiKTtpZigrK2xvYWRlZCA9PSAyKSBzZXR1cFNoYWRlclByb2dyYW0oZ2wsc2hhZGVyUHJvZ3JhbSwgdmVydFNoYWRlcixmcmFnU2hhZGVyLGZ1bmN0aW9uKHByb2cpIHtnbFNoYWRlci5tYWtlU2hhZGVyKGdsLHByb2csc2hhZGVyKTt9KX0pO1xuICAgICAgcmV0dXJuIHNoYWRlcjtcbiAgfVxuXG4gIC8vaWYodHlwZW9mKGV4cG9ydHMpICE9PSAndW5kZWZpbmVkJykge1xuICAvLyAgICBleHBvcnRzLmdsU2hhZGVyID0gZ2xTaGFkZXI7XG4gIC8vfVxuXG4gIH0pKHNoaW0uZXhwb3J0cyk7XG59KSh0aGlzKTtcbiJdfQ==
