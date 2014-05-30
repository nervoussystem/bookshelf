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
  mat4.ortho(pMatrix,-200,1500,1500,-200,-10,100);
  
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
  var area;
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
        if(e2.face == hemesh.HEMESH_NULLFACE) {
          e.next = e2;
        }
      }
    }
  }
}

var trimCells = (function() {
  return function trimCells() {
    
  }
})();

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

exports.HEMESH_NULLFACE = HEMESH_NULLFACE;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyJjOlxcVXNlcnNcXG5lcnZvdXMgc3lzdGVtXFxBcHBEYXRhXFxSb2FtaW5nXFxucG1cXG5vZGVfbW9kdWxlc1xcd2F0Y2hpZnlcXG5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwiYzovVXNlcnMvbmVydm91cyBzeXN0ZW0vaHRkb2NzL2Jvb2tzaGVsZi9jb25uZWN0b3IuanMiLCJjOi9Vc2Vycy9uZXJ2b3VzIHN5c3RlbS9odGRvY3MvYm9va3NoZWxmL2dsVXRpbHMuanMiLCJjOi9Vc2Vycy9uZXJ2b3VzIHN5c3RlbS9odGRvY3MvYm9va3NoZWxmL21haW4uanMiLCJjOi9Vc2Vycy9uZXJ2b3VzIHN5c3RlbS9odGRvY3MvYm9va3NoZWxmL251cmJzLmpzIiwiYzovVXNlcnMvbmVydm91cyBzeXN0ZW0vaHRkb2NzL2Jvb2tzaGVsZi9wb2x5MnRyaS5qcyIsImM6L1VzZXJzL25lcnZvdXMgc3lzdGVtL2h0ZG9jcy9ib29rc2hlbGYvdmJvTWVzaC5qcyIsImM6L1VzZXJzL25lcnZvdXMgc3lzdGVtL2h0ZG9jcy9ib29rc2hlbGYvdm9yb25vaS5qcyIsImM6L1VzZXJzL25lcnZvdXMgc3lzdGVtL2h0ZG9jcy9qcy9nbC1tYXRyaXgtbWluLmpzIiwiYzovVXNlcnMvbmVydm91cyBzeXN0ZW0vaHRkb2NzL2pzL2dsU2hhZGVyLmpzIiwiYzovVXNlcnMvbmVydm91cyBzeXN0ZW0vaHRkb2NzL2pzL2hlbWVzaC5qcyIsImM6L1VzZXJzL25lcnZvdXMgc3lzdGVtL2h0ZG9jcy9qcy9wb2ludGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1V0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5Z0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaDhEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxVUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVpQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgZ2xNYXRyaXggPSByZXF1aXJlKFwiLi4vanMvZ2wtbWF0cml4LW1pbi5qc1wiKTtcbnZhciB2ZWMzID0gZ2xNYXRyaXgudmVjMztcbnZhciB2ZWMyID0gZ2xNYXRyaXgudmVjMjtcbnZhciBudXJicyA9IHJlcXVpcmUoXCIuL251cmJzLmpzXCIpO1xudmFyIHZib01lc2ggPSByZXF1aXJlKFwiLi92Ym9NZXNoLmpzXCIpO1xudmFyIHdvb2RXaWR0aCA9IDEyLjI7XG52YXIgY29uTGVuID0gMzU7IC8vNDVcbnZhciBjb25PZmZzZXQgPSAxMjtcbnZhciBjb25XaWR0aCA9IDEyOy8vMjBcbnZhciBzaGVsZk9mZnNldCA9IDE1O1xudmFyIHByaW50VG9sZXJhbmNlID0gMDtcblxuZnVuY3Rpb24gaW5pdENvbm5lY3RvcigpIHtcblxufVxuXG52YXIgY3JlYXRlQ29ubmVjdG9yID0gKGZ1bmN0aW9uKCkge1xuICB2YXIgZGlyMSA9IHZlYzMuY3JlYXRlKCk7XG4gIHZhciBkaXIyID0gdmVjMy5jcmVhdGUoKTtcbiAgdmFyIGRpcjMgPSB2ZWMzLmNyZWF0ZSgpO1xuICB2YXIgcHQgPSB2ZWMzLmNyZWF0ZSgpO1xuICB2YXIgcHQyID0gdmVjMy5jcmVhdGUoKTtcbiAgdmFyIGRpcnMgPSBbZGlyMSxkaXIyLGRpcjNdO1xuICB2YXIgZGlyLCBuRGlyO1xuICB2YXIgcGVycCA9IHZlYzMuY3JlYXRlKCk7XG4gIHZhciBiaXNlY3RvciA9IHZlYzMuY3JlYXRlKCk7XG4gIHJldHVybiBmdW5jdGlvbiBjcmVhdGVDb25uZWN0b3IodHJpLHZib091dCkge1xuICAgIHZhciBjZW50ZXIgPSB0cmkuY2lyY3VtY2VudGVyO1xuICAgIHZhciBwMSA9IHRyaS5uZWlnaGJvcnNfWzBdLmNpcmN1bWNlbnRlcjtcbiAgICB2YXIgcDIgPSB0cmkubmVpZ2hib3JzX1sxXS5jaXJjdW1jZW50ZXI7XG4gICAgdmFyIHAzID0gdHJpLm5laWdoYm9yc19bMl0uY2lyY3VtY2VudGVyO1xuICAgIHZlYzMuc3ViKGRpcjEscDEsY2VudGVyKTtcbiAgICB2ZWMzLnN1YihkaXIyLHAyLGNlbnRlcik7XG4gICAgdmVjMy5zdWIoZGlyMyxwMyxjZW50ZXIpO1xuICAgIFxuICAgIHZlYzMubm9ybWFsaXplKGRpcjEsZGlyMSk7XG4gICAgdmVjMy5ub3JtYWxpemUoZGlyMixkaXIyKTtcbiAgICB2ZWMzLm5vcm1hbGl6ZShkaXIzLGRpcjMpO1xuXG4gICAgdmFyIGJhc2VJbmRleCA9IHZib091dC5udW1WZXJ0aWNlcztcbiAgICB2YXIgbnVtUHRzID0gMDtcbiAgICBcbiAgICBmb3IodmFyIGk9MDtpPDM7KytpKSB7XG4gICAgICAvL21ha2UgcG9pbnRzXG4gICAgICBkaXIgPSBkaXJzW2ldO1xuICAgICAgbkRpciA9IGRpcnNbKDE8PGkpJjNdO1xuICAgICAgdmVjMi5zZXQocGVycCxkaXJbMV0sLWRpclswXSk7XG4gICAgICB2ZWMzLnNjYWxlQW5kQWRkKHB0LGNlbnRlciwgZGlyLCBjb25MZW4rc2hlbGZPZmZzZXQpO1xuICAgICAgdmVjMi5zY2FsZUFuZEFkZChwdCxwdCxwZXJwLHdvb2RXaWR0aCowLjUrcHJpbnRUb2xlcmFuY2UpOyAgICAgIFxuICAgICAgYWRkQ29ubmVjdG9yUHQodmJvT3V0LHB0KTtcbiAgICAgIG51bVB0cysrO1xuICAgICAgXG4gICAgICB2ZWMyLnNjYWxlQW5kQWRkKHB0LHB0LGRpciwtY29uTGVuKTtcbiAgICAgIGFkZENvbm5lY3RvclB0KHZib091dCxwdCk7XG4gICAgICBudW1QdHMrKztcbiAgICAgIFxuICAgICAgdmVjMi5zY2FsZUFuZEFkZChwdCxwdCxwZXJwLC0od29vZFdpZHRoK3ByaW50VG9sZXJhbmNlKjIpKTtcbiAgICAgIGFkZENvbm5lY3RvclB0KHZib091dCxwdCk7XG4gICAgICBudW1QdHMrKztcblxuICAgICAgXG4gICAgICAvL21ha2UgY3VydmVcbiAgICAgIHZhciBjcnYgPSBudXJicy5jcmVhdGVDcnYobnVsbCwgMik7XG4gICAgICBcbiAgICAgIHZlYzIuc2NhbGVBbmRBZGQocHQscHQsZGlyLGNvbkxlbik7XG4gICAgICBhZGRDb25uZWN0b3JQdCh2Ym9PdXQscHQpO1xuICAgICAgbnVtUHRzKys7XG4gICAgICBcbiAgICAgIG51cmJzLmFkZFBvaW50KGNydixwdCk7XG5cbiAgICAgIHZlYzIuc2NhbGVBbmRBZGQocHQscHQscGVycCwtY29uT2Zmc2V0KTtcbiAgICAgIC8vYWRkQ29ubmVjdG9yUHQodmJvT3V0LHB0KTtcbiAgICAgIC8vbnVtUHRzKys7XG5cbiAgICAgIG51cmJzLmFkZFBvaW50KGNydixwdCk7XG4gICAgICBcbiAgICAgIC8vZ2V0IG9mZnNldFxuICAgICAgdmVjMy5hZGQoYmlzZWN0b3IsIGRpcixuRGlyKTtcbiAgICAgIHZlYzMubm9ybWFsaXplKGJpc2VjdG9yLGJpc2VjdG9yKTtcbiAgICAgIHZhciBzaW5BID0gTWF0aC5hYnMoYmlzZWN0b3JbMF0qZGlyWzFdLWJpc2VjdG9yWzFdKmRpclswXSk7XG4gICAgICB2ZWMzLnNjYWxlQW5kQWRkKHB0LGNlbnRlcixiaXNlY3Rvciwod29vZFdpZHRoKjAuNStjb25PZmZzZXQpL3NpbkEpO1xuXG4gICAgICBudXJicy5hZGRQb2ludChjcnYscHQpO1xuICAgICAgXG4gICAgICAvL2FkZENvbm5lY3RvclB0KHZib091dCxwdCk7XG4gICAgICAvL251bVB0cysrO1xuICAgICAgXG4gICAgICB2ZWMyLnNldChwZXJwLG5EaXJbMV0sLW5EaXJbMF0pO1xuICAgICAgdmVjMy5zY2FsZUFuZEFkZChwdCxjZW50ZXIsIG5EaXIsIGNvbkxlbitzaGVsZk9mZnNldCk7XG4gICAgICB2ZWMyLnNjYWxlQW5kQWRkKHB0LHB0LHBlcnAsd29vZFdpZHRoKjAuNStwcmludFRvbGVyYW5jZStjb25PZmZzZXQpOyAgICAgIFxuICAgICAgXG4gICAgICBudXJicy5hZGRQb2ludChjcnYscHQpO1xuICAgICAgdmVjMi5zY2FsZUFuZEFkZChwdCxwdCxwZXJwLC1jb25PZmZzZXQpOyAgICAgIFxuICAgICAgbnVyYnMuYWRkUG9pbnQoY3J2LHB0KTtcbiAgICAgIFxuICAgICAgdmFyIGRvbWFpbiA9IG51cmJzLmRvbWFpbihjcnYpO1xuICAgICAgZm9yKHZhciBqPTE7ajwyMDsrK2opIHtcbiAgICAgICAgdmFyIHUgPSBqLzIwLjAqKGRvbWFpblsxXS1kb21haW5bMF0pK2RvbWFpblswXTtcbiAgICAgICAgbnVyYnMuZXZhbHVhdGVDcnYoY3J2LHUscHQpO1xuICAgICAgICBhZGRDb25uZWN0b3JQdCh2Ym9PdXQscHQpO1xuICAgICAgICBudW1QdHMrKztcbiAgICAgICAgXG4gICAgICB9XG4gICAgICBcbiAgICB9XG4gICAgXG4gICAgLy9zdGl0Y2ggc2lkZXNcbiAgICBmb3IodmFyIGk9MDtpPG51bVB0czsrK2kpIHtcbiAgICAgIHZhciBpTmV4dCA9IChpKzEpJW51bVB0cztcbiAgICAgIHZib01lc2guYWRkVHJpYW5nbGUodmJvT3V0LGJhc2VJbmRleCtpKjIsYmFzZUluZGV4K2lOZXh0KjIrMSxiYXNlSW5kZXgraSoyKzEpO1xuICAgICAgdmJvTWVzaC5hZGRUcmlhbmdsZSh2Ym9PdXQsYmFzZUluZGV4K2kqMixiYXNlSW5kZXgraU5leHQqMixiYXNlSW5kZXgraU5leHQqMisxKTtcbiAgICB9ICAgIFxuICB9XG59KSgpO1xuXG5mdW5jdGlvbiBhZGRDb25uZWN0b3JQdCh2Ym9PdXQscHQpIHtcbiAgdmJvTWVzaC5hZGRWZXJ0ZXgodmJvT3V0LHB0KTtcbiAgcHRbMl0gPSBjb25XaWR0aDtcbiAgdmJvTWVzaC5hZGRWZXJ0ZXgodmJvT3V0LHB0KTtcbiAgcHRbMl0gPSAwO1xufVxuXG5leHBvcnRzLmNyZWF0ZUNvbm5lY3RvciA9IGNyZWF0ZUNvbm5lY3RvcjtcbmV4cG9ydHMuaW5pdENvbm5lY3RvciA9IGluaXRDb25uZWN0b3I7XG4iLCJ2YXIgZ2w7XG52YXIgZXh0ID0gbnVsbDtcbmZ1bmN0aW9uIGluaXRHTChjYW52YXMsIGRyYXdCdWZmZXIpIHtcbiAgZHJhd0J1ZmZlciA9IGRyYXdCdWZmZXIgPyBkcmF3QnVmZmVyIDogZmFsc2U7XG4gICAgdHJ5IHtcbiAgICAgICAgZ2wgPSBjYW52YXMuZ2V0Q29udGV4dChcIndlYmdsXCIse3ByZXNlcnZlRHJhd2luZ0J1ZmZlcjogZHJhd0J1ZmZlcn0pO1xuICAgICAgICBnbC52aWV3cG9ydFdpZHRoID0gY2FudmFzLndpZHRoO1xuICAgICAgICBnbC52aWV3cG9ydEhlaWdodCA9IGNhbnZhcy5oZWlnaHQ7XG4gICAgICAgIGV4dCA9IGdsLmdldEV4dGVuc2lvbihcIk9FU19lbGVtZW50X2luZGV4X3VpbnRcIik7XG4gICAgICAgIHJldHVybiBnbDtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgfVxuICAgIGlmICghZ2wpIHtcbiAgICAgICAgLy9hbGVydChcIkNvdWxkIG5vdCBpbml0aWFsaXNlIFdlYkdMLCBzb3JyeSA6LShcIik7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59XG5cbi8qXG5wYXNzIGN1YmUgbWFwIG9iamVjdFxuY3ViZW1hcCBoYXMgYW4gYXJyYXkgb2Ygc2l4IGN1YmVJbWFnZXNcbiovXG5cbmZ1bmN0aW9uIGluaXRDdWJlVGV4dHVyZShjdWJlTWFwT2JqKSB7XG4gICAgY3ViZU1hcE9iai50ZXh0dXJlID0gZ2wuY3JlYXRlVGV4dHVyZSgpO1xuICAgIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfQ1VCRV9NQVAsIGN1YmVNYXBPYmoudGV4dHVyZSk7XG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFX0NVQkVfTUFQLCBnbC5URVhUVVJFX01JTl9GSUxURVIsIGdsLk5FQVJFU1QpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV9DVUJFX01BUCwgZ2wuVEVYVFVSRV9NQUdfRklMVEVSLCBnbC5ORUFSRVNUKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfQ1VCRV9NQVAsIGdsLlRFWFRVUkVfV1JBUF9ULCBnbC5DTEFNUF9UT19FREdFKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfQ1VCRV9NQVAsIGdsLlRFWFRVUkVfV1JBUF9TLCBnbC5DTEFNUF9UT19FREdFKTtcblxuICAgIGdsLnRleEltYWdlMkQoZ2wuVEVYVFVSRV9DVUJFX01BUF9QT1NJVElWRV9YLCAwLCBnbC5SR0IsIGdsLlJHQiwgZ2wuVU5TSUdORURfQllURSwgY3ViZU1hcE9iai5jdWJlSW1hZ2VzWzBdKTtcbiAgICBnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfQ1VCRV9NQVBfTkVHQVRJVkVfWCwgMCwgZ2wuUkdCLCBnbC5SR0IsIGdsLlVOU0lHTkVEX0JZVEUsIGN1YmVNYXBPYmouY3ViZUltYWdlc1sxXSk7XG4gICAgZ2wudGV4SW1hZ2UyRChnbC5URVhUVVJFX0NVQkVfTUFQX1BPU0lUSVZFX1ksIDAsIGdsLlJHQiwgZ2wuUkdCLCBnbC5VTlNJR05FRF9CWVRFLCBjdWJlTWFwT2JqLmN1YmVJbWFnZXNbMl0pO1xuICAgIGdsLnRleEltYWdlMkQoZ2wuVEVYVFVSRV9DVUJFX01BUF9ORUdBVElWRV9ZLCAwLCBnbC5SR0IsIGdsLlJHQiwgZ2wuVU5TSUdORURfQllURSwgY3ViZU1hcE9iai5jdWJlSW1hZ2VzWzNdKTtcbiAgICBnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfQ1VCRV9NQVBfUE9TSVRJVkVfWiwgMCwgZ2wuUkdCLCBnbC5SR0IsIGdsLlVOU0lHTkVEX0JZVEUsIGN1YmVNYXBPYmouY3ViZUltYWdlc1s0XSk7XG4gICAgZ2wudGV4SW1hZ2UyRChnbC5URVhUVVJFX0NVQkVfTUFQX05FR0FUSVZFX1osIDAsIGdsLlJHQiwgZ2wuUkdCLCBnbC5VTlNJR05FRF9CWVRFLCBjdWJlTWFwT2JqLmN1YmVJbWFnZXNbNV0pO1xufVxuXG5leHBvcnRzLmluaXQgPSBpbml0R0w7XG5leHBvcnRzLmluaXRDdWJlVGV4dHVyZSA9IGluaXRDdWJlVGV4dHVyZTsiLCJcInVzZSBzdHJpY3RcIlxuXG52YXIgZ2xTaGFkZXIgPSByZXF1aXJlKCcuLi9qcy9nbFNoYWRlci5qcycpO1xudmFyIGdsTWF0cml4ID0gcmVxdWlyZSgnLi4vanMvZ2wtbWF0cml4LW1pbi5qcycpO1xudmFyIHBvbHkydHJpID0gcmVxdWlyZSgnLi9wb2x5MnRyaS5qcycpO1xudmFyIGdsVXRpbHMgPSByZXF1aXJlKCcuL2dsVXRpbHMuanMnKTtcbnZhciB2b3Jvbm9pID0gcmVxdWlyZSgnLi92b3Jvbm9pLmpzJyk7XG52YXIgdmJvTWVzaCA9IHJlcXVpcmUoJy4vdmJvTWVzaC5qcycpO1xudmFyIGNvbm5lY3RvciA9IHJlcXVpcmUoJy4vY29ubmVjdG9yLmpzJyk7XG52YXIgcG9pbnRlciA9IHJlcXVpcmUoJy4uL2pzL3BvaW50ZXIuanMnKTtcbnZhciB2ZWMyID0gZ2xNYXRyaXgudmVjMjtcbnZhciB2ZWMzID0gZ2xNYXRyaXgudmVjMztcbnZhciBtYXQ0ID0gZ2xNYXRyaXgubWF0NDtcbnZhciBtYXQzID0gZ2xNYXRyaXgubWF0NDtcblxudmFyIGNhbnZhcztcbnZhciBjYW52YXMyZDtcbnZhciBjdHg7XG52YXIgZ2w7XG52YXIgY29sb3JTaGFkZXI7XG52YXIgdm9yb25vaUVkZ2VzO1xudmFyIG12TWF0cml4ID0gbWF0NC5jcmVhdGUoKTtcbnZhciBwTWF0cml4ID0gbWF0NC5jcmVhdGUoKTtcbnZhciBuTWF0cml4ID0gbWF0My5jcmVhdGUoKTtcbnZhciBjb25uZWN0b3JWYm87XG5cbnZhciBzaGVsZldpZHRoID0gMTIwMDtcbnZhciBzaGVsZkhlaWdodCA9IDEyMDA7XG5cbnZhciBzZWxlY3RlZFB0ID0gLTE7XG5cbmZ1bmN0aW9uIGluaXQoKSB7XG4vL3N0dXBpZFxuXHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCBcImtleWRvd25cIixrZXlQcmVzcyxmYWxzZSk7XG5cbiAgY2FudmFzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJnbFwiKTtcbiAgY2FudmFzMmQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcIjJkXCIpO1xuICBwb2ludGVyLnNldHVwTW91c2VFdmVudHMoY2FudmFzMmQpO1xuICBjdHggPSBjYW52YXMyZC5nZXRDb250ZXh0KCcyZCcpO1xuICBnbCA9IGdsVXRpbHMuaW5pdChjYW52YXMpO1xuICBjb2xvclNoYWRlciA9IGdsU2hhZGVyLmxvYWRTaGFkZXIoZ2wsXCIuLi9zaGFkZXJzL3NpbXBsZUNvbG9yLnZlcnRcIixcIi4uL3NoYWRlcnMvc2ltcGxlQ29sb3IuZnJhZ1wiKTtcbiAgdmJvTWVzaC5zZXRHTChnbCk7XG4gIGluaXRWb3Jvbm9pKCk7XG4gIFxuICB2b3Jvbm9pRWRnZXMgPSB2Ym9NZXNoLmNyZWF0ZSgpO1xuICBjb25uZWN0b3JWYm8gPSB2Ym9NZXNoLmNyZWF0ZTMyKCk7XG4gIHJlcXVlc3RBbmltYXRpb25GcmFtZShzdGVwKTtcbn1cblxuaW5pdCgpO1xuXG5cbmZ1bmN0aW9uIHN0ZXAoKSB7XG4gIHJlcXVlc3RBbmltYXRpb25GcmFtZShzdGVwKTtcbiAgY2hlY2tIb3ZlcigpO1xuICBkcmFnSG92ZXIoKTtcbiAgdmJvTWVzaC5jbGVhcihjb25uZWN0b3JWYm8pO1xuICB2b3Jvbm9pLnZvcm9ub2koKTtcbiAgdm9yb25vaS5jZW50cm9pZGFsKCk7XG4gIGdldENvbm5lY3RvcnMoKTtcbiAgZHJhdygpO1xufVxuXG5mdW5jdGlvbiBkcmF3KCkge1xuICBkcmF3MmQoKTtcbiAgZHJhdzNkKCk7XG59XG5cbmZ1bmN0aW9uIGRyYXcyZCgpIHtcbiAgY3R4LmNsZWFyUmVjdCgwLDAsY2FudmFzLm9mZnNldFdpZHRoLGNhbnZhcy5vZmZzZXRIZWlnaHQpO1xuICB2YXIgc2NhbGluZyA9IE1hdGgubWluKGNhbnZhcy5vZmZzZXRXaWR0aC9zaGVsZldpZHRoLGNhbnZhcy5vZmZzZXRIZWlnaHQvc2hlbGZIZWlnaHQpO1xuICBjdHguc2F2ZSgpO1xuICBjdHguc2NhbGUoc2NhbGluZyxzY2FsaW5nKTtcbiAgZHJhd0NlbGxzMmQoKTtcbiAgLy9kcmF3RWRnZXMyZCgpO1xuICBkcmF3Tm9kZXMyZCgpO1xuICBjdHgucmVzdG9yZSgpO1xuICBcbn1cblxuZnVuY3Rpb24gZHJhd0VkZ2VzMmQoKSB7XG4gIFxuICBjdHguc3Ryb2tlU3R5bGUgPSBcImJsYWNrXCI7XG4gIGN0eC5iZWdpblBhdGgoKTtcbiAgZm9yKHZhciBpPTA7aTx2b3Jvbm9pLnRyaWFuZ2xlcy5sZW5ndGg7KytpKSB7XG4gICAgdmFyIHRyaSA9IHZvcm9ub2kudHJpYW5nbGVzW2ldO1xuICAgIGlmKHRyaS5pbnRlcmlvcl8pIHtcbiAgICAgIGlmKHRyaS5uZWlnaGJvcnNfWzBdICYmIHRyaS5uZWlnaGJvcnNfWzBdLmludGVyaW9yXykge1xuICAgICAgICBjdHgubW92ZVRvKHRyaS5jaXJjdW1jZW50ZXJbMF0sdHJpLmNpcmN1bWNlbnRlclsxXSk7XG4gICAgICAgIGN0eC5saW5lVG8odHJpLm5laWdoYm9yc19bMF0uY2lyY3VtY2VudGVyWzBdLHRyaS5uZWlnaGJvcnNfWzBdLmNpcmN1bWNlbnRlclsxXSk7XG4gICAgICB9XG4gICAgICBpZih0cmkubmVpZ2hib3JzX1sxXSAmJiB0cmkubmVpZ2hib3JzX1sxXS5pbnRlcmlvcl8pIHtcbiAgICAgICAgY3R4Lm1vdmVUbyh0cmkuY2lyY3VtY2VudGVyWzBdLHRyaS5jaXJjdW1jZW50ZXJbMV0pO1xuICAgICAgICBjdHgubGluZVRvKHRyaS5uZWlnaGJvcnNfWzFdLmNpcmN1bWNlbnRlclswXSx0cmkubmVpZ2hib3JzX1sxXS5jaXJjdW1jZW50ZXJbMV0pOyAgICAgICAgXG4gICAgICB9XG4gICAgICBpZih0cmkubmVpZ2hib3JzX1syXSAmJiB0cmkubmVpZ2hib3JzX1syXS5pbnRlcmlvcl8pIHtcbiAgICAgICAgY3R4Lm1vdmVUbyh0cmkuY2lyY3VtY2VudGVyWzBdLHRyaS5jaXJjdW1jZW50ZXJbMV0pO1xuICAgICAgICBjdHgubGluZVRvKHRyaS5uZWlnaGJvcnNfWzJdLmNpcmN1bWNlbnRlclswXSx0cmkubmVpZ2hib3JzX1syXS5jaXJjdW1jZW50ZXJbMV0pOyAgICAgICAgXG4gICAgICB9XG4gICAgfVxuICB9XG4gIGN0eC5zdHJva2UoKTtcbn1cblxuZnVuY3Rpb24gZHJhd0NlbGxzMmQoKSB7XG4gIFxuICBjdHguc3Ryb2tlU3R5bGUgPSBcImJsYWNrXCI7XG4gIC8qXG4gIHZhciB2O1xuICBmb3IodmFyIGk9MDtpPHZvcm9ub2kucHRzLmxlbmd0aDsrK2kpIHtcbiAgICB2YXIgcHQgPSB2b3Jvbm9pLnB0c1tpXTtcbiAgICBjdHguYmVnaW5QYXRoKCk7XG4gICAgdiA9IHB0LmNlbGxbMF07XG4gICAgY3R4Lm1vdmVUbyh2WzBdLHZbMV0pO1xuICAgIGZvcih2YXIgaj0xO2o8cHQuY2VsbC5sZW5ndGg7KytqKSB7XG4gICAgICB2ID0gcHQuY2VsbFtqXTtcbiAgICAgIGN0eC5saW5lVG8odlswXSx2WzFdKTtcbiAgICB9XG4gICAgY3R4LmNsb3NlUGF0aCgpO1xuICAgIGN0eC5zdHJva2UoKTtcbiAgfVxuICAqL1xuICBmb3IodmFyIGk9MDtpPHZvcm9ub2kubWVzaC5mYWNlcy5sZW5ndGg7KytpKSB7XG4gICAgdmFyIGYgPSB2b3Jvbm9pLm1lc2guZmFjZXNbaV07XG4gICAgdmFyIGUgPSBmLmU7XG4gICAgdmFyIHN0YXJ0RSA9IGU7XG4gICAgY3R4LmJlZ2luUGF0aCgpO1xuICAgIFxuICAgIGN0eC5tb3ZlVG8oZS52LnBvc1swXSxlLnYucG9zWzFdKTtcbiAgICBlID0gZS5uZXh0O1xuICAgIGRvIHtcbiAgICAgIGN0eC5saW5lVG8oZS52LnBvc1swXSxlLnYucG9zWzFdKTtcbiAgICAgIGUgPSBlLm5leHQ7XG4gICAgfSB3aGlsZShlICE9IHN0YXJ0RSk7XG4gICAgY3R4LmNsb3NlUGF0aCgpO1xuICAgIGN0eC5zdHJva2UoKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBkcmF3Tm9kZXMyZCgpIHtcbiAgY3R4LmZpbGxTdHlsZSA9IFwiYmxhY2tcIjtcbiAgZm9yKHZhciBpPTA7aTx2b3Jvbm9pLnB0cy5sZW5ndGg7KytpKSB7XG4gICAgdmFyIHB0ID0gdm9yb25vaS5wdHNbaV07XG4gICAgaWYoc2VsZWN0ZWRQdCA9PSBpKSB7XG4gICAgICBjdHguZmlsbFN0eWxlID0gXCJyZWRcIjtcbiAgICB9IGVsc2Uge1xuICAgICAgY3R4LmZpbGxTdHlsZSA9IFwiYmxhY2tcIjsgICAgXG4gICAgfVxuICAgIGN0eC5iZWdpblBhdGgoKTtcbiAgICBjdHguYXJjKHB0LngscHQueSw1LDAsMipNYXRoLlBJKTtcbiAgICBjdHguZmlsbCgpO1xuICAgIFxuICB9XG4gIFxufVxuXG5mdW5jdGlvbiBkcmF3M2QoKSB7XG4gIGdsLmNsZWFyKGdsLkNPTE9SX0JVRkZFUl9CSVQgfCBnbC5ERVBUSF9CVUZGRVJfQklUKTtcbiAgaWYoIWNvbG9yU2hhZGVyLmlzUmVhZHkpIHJldHVybjtcbiAgXG4gIGNvbG9yU2hhZGVyLmJlZ2luKCk7XG4gIG1hdDQuaWRlbnRpdHkobXZNYXRyaXgpO1xuICBtYXQ0Lm9ydGhvKHBNYXRyaXgsLTIwMCwxNTAwLDE1MDAsLTIwMCwtMTAsMTAwKTtcbiAgXG4gIC8vc2V0IGNvbG9yXG4gIGNvbG9yU2hhZGVyLnVuaWZvcm1zLm1hdENvbG9yLnNldChbMCwwLDAsMV0pO1xuICAvL3NldCBtYXRyaWNlc1xuICBjb2xvclNoYWRlci51bmlmb3Jtcy5tdk1hdHJpeC5zZXQobXZNYXRyaXgpO1xuICBjb2xvclNoYWRlci51bmlmb3Jtcy5wTWF0cml4LnNldChwTWF0cml4KTtcbiAgXG4gIC8vbWFrZSB2b3Jvbm9pIGVkZ2VzIHZib1xuICB2b3Jvbm9pVG9FZGdlVkJPKCk7XG4gIFxuICAvL2RyYXcgZWRnZXMgdmJvXG4gIGNvbG9yU2hhZGVyLmF0dHJpYnMudmVydGV4UG9zaXRpb24uc2V0KHZvcm9ub2lFZGdlcy52ZXJ0ZXhCdWZmZXIpO1xuICBnbC5kcmF3QXJyYXlzKGdsLkxJTkVTLCAwLHZvcm9ub2lFZGdlcy5udW1WZXJ0aWNlcyk7XG5cbiAgLy9kcmF3IGNvbm5lY3RvcnNcbiAgY29sb3JTaGFkZXIuYXR0cmlicy52ZXJ0ZXhQb3NpdGlvbi5zZXQoY29ubmVjdG9yVmJvLnZlcnRleEJ1ZmZlcik7XG4gIGdsLmJpbmRCdWZmZXIoZ2wuRUxFTUVOVF9BUlJBWV9CVUZGRVIsY29ubmVjdG9yVmJvLmluZGV4QnVmZmVyKTtcbiAgZ2wuZHJhd0VsZW1lbnRzKGdsLlRSSUFOR0xFUyxjb25uZWN0b3JWYm8ubnVtSW5kaWNlcyxnbC5VTlNJR05FRF9JTlQsMCk7XG4gIFxuICBjb2xvclNoYWRlci5lbmQoKTtcbn1cblxuLy9wdXQgdm9yb25vaSBlZGdlcyBpbnRvIGEgdmJvXG5mdW5jdGlvbiB2b3Jvbm9pVG9FZGdlVkJPKCkge1xuICB2Ym9NZXNoLmNsZWFyKHZvcm9ub2lFZGdlcyk7XG4gIGZvcih2YXIgaT0wO2k8dm9yb25vaS50cmlhbmdsZXMubGVuZ3RoOysraSkge1xuICAgIHZhciB0cmkgPSB2b3Jvbm9pLnRyaWFuZ2xlc1tpXTtcbiAgICBpZih0cmkuaW50ZXJpb3JfKSB7XG4gICAgICBpZih0cmkubmVpZ2hib3JzX1swXSAmJiB0cmkubmVpZ2hib3JzX1swXS5pbnRlcmlvcl8pIHtcbiAgICAgICAgdmJvTWVzaC5hZGRWZXJ0ZXgodm9yb25vaUVkZ2VzLHRyaS5jaXJjdW1jZW50ZXIpO1xuICAgICAgICB2Ym9NZXNoLmFkZFZlcnRleCh2b3Jvbm9pRWRnZXMsdHJpLm5laWdoYm9yc19bMF0uY2lyY3VtY2VudGVyKTtcbiAgICAgIH1cbiAgICAgIGlmKHRyaS5uZWlnaGJvcnNfWzFdICYmIHRyaS5uZWlnaGJvcnNfWzFdLmludGVyaW9yXykge1xuICAgICAgICB2Ym9NZXNoLmFkZFZlcnRleCh2b3Jvbm9pRWRnZXMsdHJpLmNpcmN1bWNlbnRlcik7XG4gICAgICAgIHZib01lc2guYWRkVmVydGV4KHZvcm9ub2lFZGdlcyx0cmkubmVpZ2hib3JzX1sxXS5jaXJjdW1jZW50ZXIpO1xuICAgICAgfVxuICAgICAgaWYodHJpLm5laWdoYm9yc19bMl0gJiYgdHJpLm5laWdoYm9yc19bMl0uaW50ZXJpb3JfKSB7XG4gICAgICAgIHZib01lc2guYWRkVmVydGV4KHZvcm9ub2lFZGdlcyx0cmkuY2lyY3VtY2VudGVyKTtcbiAgICAgICAgdmJvTWVzaC5hZGRWZXJ0ZXgodm9yb25vaUVkZ2VzLHRyaS5uZWlnaGJvcnNfWzJdLmNpcmN1bWNlbnRlcik7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHZib01lc2guYnVmZmVyKHZvcm9ub2lFZGdlcyk7XG59XG5cbmZ1bmN0aW9uIGdldENvbm5lY3RvcnMoKSB7XG4gIGZvcih2YXIgaT0wO2k8dm9yb25vaS50cmlhbmdsZXMubGVuZ3RoOysraSkge1xuICAgIHZhciB0cmkgPSB2b3Jvbm9pLnRyaWFuZ2xlc1tpXTtcbiAgICBpZih0cmkuaW50ZXJpb3JfKSB7XG4gICAgICBpZih0cmkubmVpZ2hib3JzX1swXSAmJiB0cmkubmVpZ2hib3JzX1swXS5pbnRlcmlvcl8gJiZcbiAgICAgICAgdHJpLm5laWdoYm9yc19bMV0gJiYgdHJpLm5laWdoYm9yc19bMV0uaW50ZXJpb3JfICYmXG4gICAgICAgIHRyaS5uZWlnaGJvcnNfWzJdICYmIHRyaS5uZWlnaGJvcnNfWzJdLmludGVyaW9yXykge1xuICAgICAgICBjb25uZWN0b3IuY3JlYXRlQ29ubmVjdG9yKHRyaSxjb25uZWN0b3JWYm8pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICB2Ym9NZXNoLmJ1ZmZlcihjb25uZWN0b3JWYm8pO1xufVxuXG5mdW5jdGlvbiBpbml0Vm9yb25vaSgpIHtcbiAgdm9yb25vaS5zZXREaW1lbnNpb25zKHNoZWxmV2lkdGgsc2hlbGZIZWlnaHQpO1xuICB2b3Jvbm9pLmluaXQoKTtcbiAgdm9yb25vaS5yZXNldCgpO1xuICB2b3Jvbm9pLnZvcm9ub2koKTtcbn1cblxuXG5mdW5jdGlvbiBrZXlQcmVzcyhldmVudCkge1xuICBzd2l0Y2goZXZlbnQud2hpY2gpIHtcbiAgICBjYXNlIFwiRFwiLmNoYXJDb2RlQXQoMCk6XG4gICAgICBkb3dubG9hZFZib0FzU1RMKGNvbm5lY3RvclZibyk7XG4gICAgICBicmVhaztcbiAgfVxufVxuXG5mdW5jdGlvbiBzY3JlZW5Ub1JlYWwoeCx5LG91dCkge1xuICB2YXIgc2NhbGluZyA9IE1hdGgubWluKGNhbnZhcy5vZmZzZXRXaWR0aC9zaGVsZldpZHRoLGNhbnZhcy5vZmZzZXRIZWlnaHQvc2hlbGZIZWlnaHQpO1xuICBvdXRbMF0gPSB4L3NjYWxpbmc7XG4gIG91dFsxXSA9IHkvc2NhbGluZztcbn1cblxuZnVuY3Rpb24gcmVhbFRvU2NyZWVuKHgseSxvdXQpIHtcbiAgdmFyIHNjYWxpbmcgPSBNYXRoLm1pbihjYW52YXMub2Zmc2V0V2lkdGgvc2hlbGZXaWR0aCxjYW52YXMub2Zmc2V0SGVpZ2h0L3NoZWxmSGVpZ2h0KTtcbiAgb3V0WzBdID0geCpzY2FsaW5nO1xuICBvdXRbMV0gPSB5KnNjYWxpbmc7XG59XG5cbi8vcG9pbnRlci5tb3VzZU1vdmVkID0gY2hlY2tIb3ZlcjtcblxudmFyIGRyYWdIb3ZlciA9IChmdW5jdGlvbigpIHtcbiAgdmFyIGNvb3JkID0gdmVjMi5jcmVhdGUoKTtcbiAgcmV0dXJuIGZ1bmN0aW9uIGRyYWdIb3ZlcigpIHtcbiAgICBpZihwb2ludGVyLmlzTW91c2VEb3duICYmIHNlbGVjdGVkUHQgPiAtMSkge1xuICAgICAgdmFyIHB0ID0gdm9yb25vaS5wdHNbc2VsZWN0ZWRQdF07XG4gICAgICBzY3JlZW5Ub1JlYWwocG9pbnRlci5tb3VzZVgscG9pbnRlci5tb3VzZVksY29vcmQpO1xuICAgICAgcHQueCA9IGNvb3JkWzBdO1xuICAgICAgcHQueSA9IGNvb3JkWzFdO1xuICAgIH1cbiAgfVxuICBcbn0pKCk7XG5cbnZhciBjaGVja0hvdmVyID0gKGZ1bmN0aW9uKCkge1xuICB2YXIgY29vcmQgPSB2ZWMyLmNyZWF0ZSgpO1xuICByZXR1cm4gZnVuY3Rpb24gY2hlY2tIb3ZlcigpIHtcbiAgICBpZighcG9pbnRlci5pc01vdXNlRG93bikge1xuICAgICAgc2VsZWN0ZWRQdCA9IC0xO1xuICAgICAgZm9yKHZhciBpPTA7aTx2b3Jvbm9pLnB0cy5sZW5ndGg7KytpKSB7XG4gICAgICAgIHZhciBwdCA9IHZvcm9ub2kucHRzW2ldO1xuICAgICAgICByZWFsVG9TY3JlZW4ocHQueCxwdC55LGNvb3JkKTtcbiAgICAgICAgdmFyIGR4ID0gcG9pbnRlci5tb3VzZVgtY29vcmRbMF07XG4gICAgICAgIHZhciBkeSA9IHBvaW50ZXIubW91c2VZLWNvb3JkWzFdO1xuICAgICAgICBpZihkeCpkeCtkeSpkeSA8IDEwKjEwKSB7XG4gICAgICAgICAgc2VsZWN0ZWRQdCA9IGk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn0pKCk7XG5cbnBvaW50ZXIubW91c2VEcmFnZ2VkID0gKGZ1bmN0aW9uKCkge1xuICB2YXIgY29vcmQgPSB2ZWMyLmNyZWF0ZSgpO1xuICByZXR1cm4gZnVuY3Rpb24gbW91c2VEcmFnZ2VkKCkge1xuICAgIFxuICB9XG59KSgpO1xuXG5wb2ludGVyLm1vdXNlQ2xpY2tlZCA9IChmdW5jdGlvbigpIHtcbiAgdmFyIGNvb3JkcyA9IHZlYzIuY3JlYXRlKCk7XG4gIHJldHVybiBmdW5jdGlvbiBtb3VzZUNsaWNrZWQoKSB7XG4gICAgaWYoc2VsZWN0ZWRQdCA9PSAtMSkge1xuICAgICAgdmFyIHB0ID0ge3g6MCx5OjB9O1xuICAgICAgc2NyZWVuVG9SZWFsKHBvaW50ZXIubW91c2VYLHBvaW50ZXIubW91c2VZLGNvb3Jkcyk7XG4gICAgICBwdC54ID0gY29vcmRzWzBdO1xuICAgICAgcHQueSA9IGNvb3Jkc1sxXTtcbiAgICAgIHZvcm9ub2kucHRzLnB1c2gocHQpO1xuICAgICAgc2VsZWN0ZWRQdCA9IHZvcm9ub2kucHRzLmxlbmd0aC0xO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZihwb2ludGVyLm1vdXNlQnV0dG9uID09IDMpIHtcbiAgICAgICAgdm9yb25vaS5wdHMuc3BsaWNlKHNlbGVjdGVkUHQsMSk7XG4gICAgICAgIHNlbGVjdGVkUHQgPSAtMTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn0pKCk7XG5cbmZ1bmN0aW9uIGRvd25sb2FkVmJvQXNTVEwodmJvKSB7XG4gIHZhciB0cmlDb3VudCA9IHZiby5udW1JbmRpY2VzLzM7XG4gIHZhciBidWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoODArNCs1MCp0cmlDb3VudCk7XG4gIHZhciBkYXRhVmlldyA9IG5ldyBEYXRhVmlldyhidWZmZXIpO1xuICBkYXRhVmlldy5vZmZzZXQgPSA4MDtcbiAgc2V0RFZVaW50MzIoZGF0YVZpZXcsIHRyaUNvdW50KTtcbiAgXG4gIHNhdmVWQk9CaW5hcnkodmJvLGRhdGFWaWV3KTtcblxuICB2YXIgYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcbiAgdmFyIGJsb2IgPSBuZXcgQmxvYihbYnVmZmVyXSwgeyd0eXBlJzonYXBwbGljYXRpb25cXC9vY3RldC1zdHJlYW0nfSk7XG4gIGEuaHJlZiA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IpO1xuICBhLmRvd25sb2FkID0gXCJ2Ym9cIituZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkuc3Vic3RyaW5nKDAsMTYpK1wiLnN0bFwiO1xuICBhLmNsaWNrKCk7XG59XG5cbmZ1bmN0aW9uIHNhdmVWQk9CaW5hcnkodmJvLCBkYXRhVmlldykge1xuICBmb3IodmFyIGk9MDtpPHZiby5udW1JbmRpY2VzOykge1xuICAgIHNldERWRmxvYXQoZGF0YVZpZXcsMC4wKTtcbiAgICBzZXREVkZsb2F0KGRhdGFWaWV3LDAuMCk7XG4gICAgc2V0RFZGbG9hdChkYXRhVmlldywwLjApO1xuICAgIHZhciBpMSA9IHZiby5pbmRleERhdGFbaSsrXSozO1xuICAgIHZhciBpMiA9IHZiby5pbmRleERhdGFbaSsrXSozO1xuICAgIHZhciBpMyA9IHZiby5pbmRleERhdGFbaSsrXSozO1xuXG4gICAgc2V0RFZGbG9hdChkYXRhVmlldyx2Ym8udmVydGV4RGF0YVtpMV0pO1xuICAgIHNldERWRmxvYXQoZGF0YVZpZXcsdmJvLnZlcnRleERhdGFbaTErMV0pO1xuICAgIHNldERWRmxvYXQoZGF0YVZpZXcsdmJvLnZlcnRleERhdGFbaTErMl0pO1xuXG4gICAgc2V0RFZGbG9hdChkYXRhVmlldyx2Ym8udmVydGV4RGF0YVtpMl0pO1xuICAgIHNldERWRmxvYXQoZGF0YVZpZXcsdmJvLnZlcnRleERhdGFbaTIrMV0pO1xuICAgIHNldERWRmxvYXQoZGF0YVZpZXcsdmJvLnZlcnRleERhdGFbaTIrMl0pO1xuXG4gICAgc2V0RFZGbG9hdChkYXRhVmlldyx2Ym8udmVydGV4RGF0YVtpM10pO1xuICAgIHNldERWRmxvYXQoZGF0YVZpZXcsdmJvLnZlcnRleERhdGFbaTMrMV0pO1xuICAgIHNldERWRmxvYXQoZGF0YVZpZXcsdmJvLnZlcnRleERhdGFbaTMrMl0pO1xuICAgIFxuICAgIHNldERWVWludDE2KGRhdGFWaWV3LDApO1xuICB9XG59XG5cbmZ1bmN0aW9uIHNldERWRmxvYXQoZHYsIHZhbCkge1xuICBkdi5zZXRGbG9hdDMyKGR2Lm9mZnNldCx2YWwsdHJ1ZSk7XG4gIGR2Lm9mZnNldCArPSA0O1xufVxuXG5mdW5jdGlvbiBzZXREVlVpbnQxNihkdiwgdmFsKSB7XG4gIGR2LnNldFVpbnQxNihkdi5vZmZzZXQsdmFsLHRydWUpO1xuICBkdi5vZmZzZXQgKz0gMjtcbn1cblxuZnVuY3Rpb24gc2V0RFZVaW50MzIoZHYsIHZhbCkge1xuICBkdi5zZXRVaW50MzIoZHYub2Zmc2V0LHZhbCx0cnVlKTtcbiAgZHYub2Zmc2V0ICs9IDQ7XG59XG4iLCJ2YXIgZ2xNYXRyaXggPSByZXF1aXJlKFwiLi4vanMvZ2wtbWF0cml4LW1pbi5qc1wiKTtcbnZhciB2ZWMzID0gZ2xNYXRyaXgudmVjMztcbnZhciB2ZWM0ID0gZ2xNYXRyaXgudmVjNDtcbi8vVkVDNCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy9jaGVjayBmb3IgMFxudmVjNC5wcm9qZWN0RG93bj1mdW5jdGlvbihhLGIpe3ZhciBkPTEuMC9hWzNdO2lmKCFiKSB7Yj12ZWMzLmNyZWF0ZSgpO30gYlswXT1hWzBdKmQ7YlsxXT1hWzFdKmQ7YlsyXT1hWzJdKmQ7cmV0dXJuIGI7fTtcbi8vb3B0aW1pemUgdG8gYXZvaWQgbXVsdGlwbGljYXRpb25zIHdpdGggbm8gYlxudmVjNC5mcm9tVmVjMz1mdW5jdGlvbihhLGIpe2lmKCFiKSBiPTE7dmFyIGM9bmV3IEZsb2F0MzJBcnJheSg0KTtjWzBdPWFbMF0qYjtjWzFdPWFbMV0qYjtjWzJdPWFbMl0qYjtjWzNdPWI7cmV0dXJuIGN9O1xuXG4vL05VUkJTIENVUlZFXG4vL2EgbnVyYnMgb2JqZWN0IGhhcyBjb250cm9sIHB0cyxrbm90cywgZGVncmVlXG52YXIgbnVyYnMgPSBleHBvcnRzO1xuLy91c2VkIGxvY2FsbHlcbm51cmJzLk1BWF9ERUdSRUUgPSAxMDtcbm51cmJzLmJhc2lzRnVuY3MgPSBuZXcgRmxvYXQzMkFycmF5KDEwKTtcbm51cmJzLmJhc2lzRnVuY3NVID0gbmV3IEZsb2F0MzJBcnJheSgxMCk7XG5udXJicy5iYXNpc0Z1bmNzViA9IG5ldyBGbG9hdDMyQXJyYXkoMTApO1xubnVyYnMuZGVyaXZlQmFzaXNGdW5jcyA9IG5ldyBBcnJheSgxMSk7XG5mb3IodmFyIGk9MDtpPG51cmJzLk1BWF9ERUdSRUUrMTsrK2kpIG51cmJzLmRlcml2ZUJhc2lzRnVuY3NbaV0gPSBuZXcgRmxvYXQzMkFycmF5KG51cmJzLk1BWF9ERUdSRUUrMSk7XG5udXJicy5uZHUgPSBuZXcgQXJyYXkobnVyYnMuTUFYX0RFR1JFRSsxKTtcbmZvcih2YXIgaT0wO2k8bnVyYnMuTUFYX0RFR1JFRSsxOysraSkgbnVyYnMubmR1W2ldID0gbmV3IEZsb2F0MzJBcnJheShudXJicy5NQVhfREVHUkVFKzEpO1xuXG5udXJicy5iYW5nID0gZnVuY3Rpb24oYSkge1xuXHR2YXIgdmFsPTE7XG5cdGZvcig7YT4xO2EtLSkge1xuXHRcdHZhbCo9YTtcblx0fVxuXHRyZXR1cm4gdmFsO1xufTtcblxuLy9JIGFtIGFuIGlkaW90XG5udXJicy5CID0gW25ldyBGbG9hdDMyQXJyYXkoMTApLG5ldyBGbG9hdDMyQXJyYXkoMTApLG5ldyBGbG9hdDMyQXJyYXkoMTApLG5ldyBGbG9hdDMyQXJyYXkoMTApLG5ldyBGbG9hdDMyQXJyYXkoMTApLG5ldyBGbG9hdDMyQXJyYXkoMTApLG5ldyBGbG9hdDMyQXJyYXkoMTApLG5ldyBGbG9hdDMyQXJyYXkoMTApLG5ldyBGbG9hdDMyQXJyYXkoMTApLG5ldyBGbG9hdDMyQXJyYXkoMTApXTtcbmZvcih2YXIgaT0wO2k8MTA7KytpKSB7XG5cdGZvcih2YXIgaj0wO2o8MTA7KytqKSB7XG5cdFx0bnVyYnMuQltpXVtqXSA9IG51cmJzLmJhbmcoaSkvKG51cmJzLmJhbmcoaikqbnVyYnMuYmFuZyhpLWopKTtcblx0fVxufVxuXG4vL21ha2UgYSBudXJicyBjcnYgb2JqZWN0XG4vL2luaXRpYWxpemUgd2l0aCBwb2ludHM/P1xubnVyYnMuY3JlYXRlQ3J2ID0gZnVuY3Rpb24oY3J2LGRlZ3JlZSkge1xuXHRjcnYgPSBjcnYgfHwge307XG5cdGNydi5kZWdyZWUgPSBkZWdyZWUgfHwgMztcblx0Y3J2Lmtub3RzID0gbmV3IEFycmF5KGNydi5kZWdyZWUrMSk7XG5cdGZvcih2YXIgaT0wO2k8PWNydi5kZWdyZWU7aSsrKSBjcnYua25vdHNbaV0gPSAwO1xuXHRjcnYuY29udHJvbFB0cyA9IFtdO1xuXHRyZXR1cm4gY3J2O1xufVxuXG5udXJicy5jcmVhdGVDbG9zZWRDcnYgPSBmdW5jdGlvbihwdHMsIGRlZ3JlZSkge1xuXHR2YXIgY3J2ID0ge307XG5cdGNydi5kZWdyZWUgPSBkZWdyZWUgfHwgMztcblx0Y3J2Lmtub3RzID0gbmV3IEFycmF5KHB0cy5sZW5ndGgrY3J2LmRlZ3JlZStjcnYuZGVncmVlKzEpO1xuXHRmb3IodmFyIGk9MDtpPGNydi5rbm90cy5sZW5ndGg7aSsrKSBjcnYua25vdHNbaV0gPSBpLWNydi5kZWdyZWU7XG5cdGNydi5jb250cm9sUHRzID0gW107XG5cdGZvcih2YXIgaT0wO2k8cHRzLmxlbmd0aDsrK2kpIHtcblx0XHRjcnYuY29udHJvbFB0cy5wdXNoKHZlYzQuY3JlYXRlKHB0c1tpXSkpO1xuXHR9XG5cdGZvcih2YXIgaT0wO2k8PWRlZ3JlZTsrK2kpIHtcblx0XHRjcnYuY29udHJvbFB0cy5wdXNoKHZlYzQuY3JlYXRlKHB0c1tpXSkpO1xuXHR9XG5cdHJldHVybiBjcnY7XG59XG5cbm51cmJzLmNvcHlDcnYgPSBmdW5jdGlvbihjcnYpIHtcblx0dmFyIG5ld0NydiA9IHt9O1xuXHRuZXdDcnYuZGVncmVlID0gY3J2LmRlZ3JlZTtcblx0bmV3Q3J2Lmtub3RzID0gY3J2Lmtub3RzLnNsaWNlKDApO1xuXHRuZXdDcnYuY29udHJvbFB0cyA9IGNydi5jb250cm9sUHRzLnNsaWNlKDApO1xuXHRyZXR1cm4gbmV3Q3J2O1xufVxuXG4vL2JpbmFyeSBzZWFyY2hcbm51cmJzLmZpbmRLbm90ID0gZnVuY3Rpb24oa25vdHMsdSxkZWdyZWUpIHtcblx0aWYgKHU9PWtub3RzW2tub3RzLmxlbmd0aC1kZWdyZWVdKSByZXR1cm4ga25vdHMubGVuZ3RoLWRlZ3JlZS0yO1xuXHRpZih1IDw9IGtub3RzW2RlZ3JlZV0pIHJldHVybiBkZWdyZWU7XG5cdHZhciBsb3cgPSBkZWdyZWU7XG5cdHZhciBoaWdoID0ga25vdHMubGVuZ3RoLWRlZ3JlZTtcblx0dmFyIG1pZCA9IE1hdGguZmxvb3IoKGhpZ2grbG93KS8yKTtcblx0d2hpbGUoa25vdHNbbWlkXT51IHx8IHUgPj0ga25vdHNbbWlkKzFdKSB7XG5cdCAgaWYodTxrbm90c1ttaWRdKSB7XG5cdFx0aGlnaCA9IG1pZDtcblx0ICB9IGVsc2Uge1xuXHRcdGxvdyA9IG1pZDtcblx0ICB9XG5cdCAgbWlkID0gTWF0aC5mbG9vcigoaGlnaCtsb3cpLzIpO1xuXHR9XG5cdHJldHVybiBtaWQ7XG59XG5cbiBcbi8vaW1wbGVtZW50IGRlZ3JlZSBlbGV2YXRpb24gYW5kIHJlZHVjdGlvbiwgbmVlZGVkIHRvIGxvZnQgY3VydmUgb2YgZGlmZmVyZW50IGRlZ3JlZXMgYXMgd2VsbFxubnVyYnMuc2V0RGVncmVlID0gZnVuY3Rpb24oZGVnKSB7XG59XG5cdFxubnVyYnMuZXZhbHVhdGVDcnYgPSAoZnVuY3Rpb24oKSB7XG4gIHZhciBldmFsUHQgPSB2ZWM0LmNyZWF0ZSgpO1xuICByZXR1cm4gZnVuY3Rpb24gZXZhbHVhdGVDcnYoY3J2LHUscHQpIHtcbiAgICB2YXIgY3Vycktub3QgPSBudXJicy5maW5kS25vdChjcnYua25vdHMsdSxjcnYuZGVncmVlKTtcbiAgICBcbiAgICBudXJicy5iYXNpc0Z1bmN0aW9ucyhjcnYua25vdHMsY3J2LmRlZ3JlZSxjdXJyS25vdCwgdSxudXJicy5iYXNpc0Z1bmNzKTtcbiAgICB2ZWM0LnNldChldmFsUHQsMCwwLDAsMCk7XG4gICAgZm9yKHZhciBpID0gMDtpPD1jcnYuZGVncmVlOysraSkge1xuICAgICAgdmVjNC5zY2FsZUFuZEFkZChldmFsUHQsIGV2YWxQdCxjcnYuY29udHJvbFB0c1tjdXJyS25vdC1jcnYuZGVncmVlK2ldLCBudXJicy5iYXNpc0Z1bmNzW2ldKTtcbiAgICB9XG4gICAgcmV0dXJuIHZlYzQucHJvamVjdERvd24oZXZhbFB0LHB0KTsgIFxuICB9XG59KSgpO1xuLypcdCBcblx0IHB1YmxpYyBQVmVjdG9yIGRlcml2YXRpdmUoZmxvYXQgdSwgaW50IGspIHtcblx0XHQgVmVjdG9yNERbXSBkZXJpdmVzVyA9IG5ldyBWZWN0b3I0RFtrKzFdO1xuXHRcdCBpZihrPmRlZ3JlZSkgcmV0dXJuIG5ldyBQVmVjdG9yKCk7XG5cdFx0IGludCBjdXJyS25vdCA9IGZpbmRLbm90KHUpO1xuXHRcdCBWZWN0b3I0RFtdIGhQdHMgPSBuZXcgVmVjdG9yNERbZGVncmVlKzFdO1xuXHRcdCBmb3IoaW50IGk9MDtpPD1kZWdyZWU7KytpKSB7XG5cdCAgICAgIGhQdHNbaV0gPSBWZWN0b3I0RC5tdWx0aXBseShuZXcgVmVjdG9yNEQoY29udHJvbFB0c1tjdXJyS25vdC1kZWdyZWUraV0ueCxjb250cm9sUHRzW2N1cnJLbm90LWRlZ3JlZStpXS55LGNvbnRyb2xQdHNbY3Vycktub3QtZGVncmVlK2ldLnopLHdlaWdodHNbY3Vycktub3QtZGVncmVlK2ldKTtcblx0XHQgfVxuXHRcdCBmbG9hdFtdW10gYmFzRnVuYyA9IGRlcml2ZUJhc2lzRnVuY3Rpb25zKGN1cnJLbm90LHUsIGspO1xuXHRcdCBmb3IoaW50IGk9MDtpPD1rOysraSkge1xuXHRcdFx0IGRlcml2ZXNXW2ldID0gbmV3IFZlY3RvcjREKCk7XG5cdFx0XHQgZm9yKGludCBqPTA7ajw9ZGVncmVlOysraikge1xuXHRcdFx0XHQgZGVyaXZlc1dbaV0gPSBWZWN0b3I0RC5hZGQoZGVyaXZlc1dbaV0sVmVjdG9yNEQubXVsdGlwbHkoaFB0c1tqXSxiYXNGdW5jW2ldW2pdKSk7XG5cdFx0XHQgfVxuXHRcdCB9XG5cdFx0IFxuXHRcdCBQVmVjdG9yW10gZGVyaXZlcyA9IG5ldyBQVmVjdG9yW2Rlcml2ZXNXLmxlbmd0aF07XG5cdFx0IGRlcml2ZXNbMF0gPSBuZXcgUFZlY3RvcigpO1xuXHRcdCBmb3IoaW50IGk9MDtpPD1rOysraSkge1xuXHRcdFx0UFZlY3RvciBjdXJyUHQgPSBuZXcgUFZlY3RvcihkZXJpdmVzV1tpXS54LGRlcml2ZXNXW2ldLnksZGVyaXZlc1dbaV0ueik7XG5cdFx0XHRmb3IoaW50IGo9MTtqPD1pOysraikge1xuXHRcdFx0XHRjdXJyUHQgPSBQVmVjdG9yLnN1YihjdXJyUHQsUFZlY3Rvci5tdWx0KGRlcml2ZXNbaS1qXSxCW2ldW2pdKmRlcml2ZXNXW2pdLncpKTtcblx0XHRcdH1cblx0XHRcdGRlcml2ZXNbaV0gPSBuZXcgUFZlY3RvcihjdXJyUHQueC9kZXJpdmVzV1swXS53LGN1cnJQdC55L2Rlcml2ZXNXWzBdLncsY3VyclB0LnovZGVyaXZlc1dbMF0udyk7XG5cdFx0IH1cblx0XHQgcmV0dXJuIGRlcml2ZXNba107XG5cdFx0IFxuXHQgfVxuXHQgXG5cdCBwdWJsaWMgUFZlY3RvcltdIGFsbERlcml2YXRpdmVzKGZsb2F0IHUsIGludCBrKSB7XG5cdFx0IFZlY3RvcjREW10gZGVyaXZlc1cgPSBuZXcgVmVjdG9yNERbaysxXTtcblx0XHQgaW50IGN1cnJLbm90ID0gZmluZEtub3QodSk7XG5cdFx0IFZlY3RvcjREW10gaFB0cyA9IG5ldyBWZWN0b3I0RFtkZWdyZWUrMV07XG5cdFx0IGZvcihpbnQgaT0wO2k8PWRlZ3JlZTsrK2kpIHtcblx0ICAgICAgaFB0c1tpXSA9IFZlY3RvcjRELm11bHRpcGx5KG5ldyBWZWN0b3I0RChjb250cm9sUHRzW2N1cnJLbm90LWRlZ3JlZStpXS54LGNvbnRyb2xQdHNbY3Vycktub3QtZGVncmVlK2ldLnksY29udHJvbFB0c1tjdXJyS25vdC1kZWdyZWUraV0ueiksd2VpZ2h0c1tjdXJyS25vdC1kZWdyZWUraV0pO1xuXHRcdCB9XHRcdCBcblx0XHQgZmxvYXRbXVtdIGJhc0Z1bmMgPSBkZXJpdmVCYXNpc0Z1bmN0aW9ucyhjdXJyS25vdCx1LCBrKTtcblx0XHQgZm9yKGludCBpPTA7aTw9azsrK2kpIHtcblx0XHRcdCBkZXJpdmVzV1tpXSA9IG5ldyBWZWN0b3I0RCgpO1xuXHRcdFx0IGZvcihpbnQgaj0wO2o8PWRlZ3JlZTsrK2opXG5cdFx0XHRcdCBkZXJpdmVzV1tpXSA9IFZlY3RvcjRELmFkZChkZXJpdmVzV1tpXSxWZWN0b3I0RC5tdWx0aXBseShoUHRzW2pdLGJhc0Z1bmNbaV1bal0pKTtcblx0XHQgfVxuXHRcdCBcblx0XHQgUFZlY3RvcltdIGRlcml2ZXMgPSBuZXcgUFZlY3RvcltkZXJpdmVzVy5sZW5ndGhdO1xuXHRcdCBkZXJpdmVzWzBdID0gbmV3IFBWZWN0b3IoKTtcblx0XHQgZm9yKGludCBpPTA7aTw9azsrK2kpIHtcblx0XHRcdFBWZWN0b3IgY3VyclB0ID0gbmV3IFBWZWN0b3IoZGVyaXZlc1dbaV0ueCxkZXJpdmVzV1tpXS55LGRlcml2ZXNXW2ldLnopO1xuXHRcdFx0Zm9yKGludCBqPTE7ajw9aTsrK2opIHtcblx0XHRcdFx0Y3VyclB0ID0gUFZlY3Rvci5zdWIoY3VyclB0LFBWZWN0b3IubXVsdChkZXJpdmVzW2ktal0sQltpXVtqXSpkZXJpdmVzV1tqXS53KSk7XG5cdFx0XHR9XG5cdFx0XHRkZXJpdmVzW2ldID0gbmV3IFBWZWN0b3IoY3VyclB0LngvZGVyaXZlc1dbMF0udyxjdXJyUHQueS9kZXJpdmVzV1swXS53LGN1cnJQdC56L2Rlcml2ZXNXWzBdLncpO1xuXHRcdCB9XG5cdFx0IHJldHVybiBkZXJpdmVzO1xuXHRcdCBcblx0IH1cdCBcbiovXHQgIFxuXHQgIC8vYXBwcm94aW1hdGUgbGVuZ3RoLCB1bmltcGxlbWVudGVkXG5udXJicy5jcnZMZW5ndGg9ZnVuY3Rpb24oY3J2KSB7XG5cdHJldHVybiAxO1xufVx0XG5cdCAgXG5udXJicy5kb21haW4gPSBmdW5jdGlvbihjLGIpIHtcblx0YiA9IGIgfHwgbmV3IEFycmF5KDIpO1xuXHRiWzBdPWMua25vdHNbYy5kZWdyZWVdO1xuXHRiWzFdPWMua25vdHNbYy5rbm90cy5sZW5ndGgtMS1jLmRlZ3JlZV07XG5cdHJldHVybiBiO1xufVxuXHQgIFxubnVyYnMuYWRkUG9pbnQgPSBmdW5jdGlvbihjcnYsIHB0KSB7XG5cdGNydi5jb250cm9sUHRzLnB1c2godmVjNC5mcm9tVmVjMyhwdCwxKSk7XG5cdHZhciBpbmMgPSAxO1xuXHR2YXIgc3RhcnQgPSBjcnYua25vdHNbY3J2LmRlZ3JlZV07XG5cdHZhciBlbmQgPSBjcnYua25vdHNbY3J2Lmtub3RzLmxlbmd0aC0xXTtcblx0aWYoY3J2LmNvbnRyb2xQdHMubGVuZ3RoPD1jcnYuZGVncmVlKzEpIHtcblx0ICBjcnYua25vdHMucHVzaCgxKTtcblx0fSBlbHNlIHtcblx0ICB2YXIgaTtcblx0ICBmb3IoIGk9Y3J2LmRlZ3JlZSsxO2k8Y3J2Lmtub3RzLmxlbmd0aC1jcnYuZGVncmVlOysraSkge1xuXHRcdCAgaWYoY3J2Lmtub3RzW2ldICE9IHN0YXJ0KSB7XG5cdFx0XHQgIGluYyA9IGNydi5rbm90c1tpXS1zdGFydDtcblx0XHRcdCAgaSA9IGNydi5rbm90cy5sZW5ndGg7IC8vYnJlYWs/XG5cdFx0ICB9XG5cdCAgfVxuXHQgIGNydi5rbm90cy5wdXNoKGVuZCtpbmMpO1xuXHQgIGZvciggaT1jcnYua25vdHMubGVuZ3RoLTI7aT5jcnYua25vdHMubGVuZ3RoLWNydi5kZWdyZWUtMjstLWkpIFxuXHRcdGNydi5rbm90c1tpXSA9IGVuZCtpbmM7XHRcdFx0ICBcblx0ICBmb3IoIGk9MDtpPGNydi5rbm90cy5sZW5ndGg7KytpKSBcblx0XHRjcnYua25vdHNbaV0gLz0gZW5kK2luYztcblx0fVxufVxuXG4vL2luc2VydCBhIGtub3QgYSB1IHNvbWUgdGltZXNcbi8vdGhpcyBzaG91bGQgdXNlIG5hdGl2ZSBhcnJheSBtZXRob2RzIG5vdCB0aGlzIHdlaXJkIGNvcHlpbmdcbm51cmJzLmluc2VydEtub3QgPSBmdW5jdGlvbihjcnYsdSx0aW1lcykge1xuXHRpZighdGltZXMpIHRpbWVzID0gMTtcblx0dmFyIGN1cnJLbm90ID0gbnVyYnMuZmluZEtub3QoY3J2Lmtub3RzLHUsY3J2LmRlZ3JlZSk7XG5cdHZhciBtdWx0aXBsaWNpdHkgPSBudXJicy5maW5kTXVsdGlwbGljaXR5KGNydi5rbm90cyxjdXJyS25vdCk7XG5cdC8vdGltZXMgPSBNYXRoLm1pbihkZWdyZWUtdGltZXMtbXVsdGlwbGljaXR5LHRpbWVzKTtcblx0Ly90aW1lcyA9IE1hdGgubWF4KDAsdGltZXMpO1xuXHR2YXIgbmV3S25vdHMgPSBuZXcgRmxvYXQzMkFycmF5KGNydi5rbm90cy5sZW5ndGgrdGltZXMpO1xuXHR2YXIgbmV3UG9pbnRzID0gbmV3IEFycmF5KGNydi5jb250cm9sUHRzLmxlbmd0aCt0aW1lcyk7XG5cblx0dmFyIGk7XG5cdGZvcihpPTA7aTw9Y3Vycktub3Q7KytpKSBuZXdLbm90c1tpXSA9IGNydi5rbm90c1tpXTtcblx0Zm9yKGk9MTtpPD10aW1lczsrK2kpIG5ld0tub3RzW2N1cnJLbm90K2ldID0gdTtcblx0Zm9yKGk9Y3Vycktub3QrMTtpPGNydi5rbm90cy5sZW5ndGg7KytpKSBuZXdLbm90c1tpK3RpbWVzXSA9IGNydi5rbm90c1tpXTtcblx0Zm9yKGk9MDtpPD1jdXJyS25vdC1jcnYuZGVncmVlOysraSkgbmV3UG9pbnRzW2ldID0gY3J2LmNvbnRyb2xQdHNbaV07XG5cdGZvcihpPWN1cnJLbm90LW11bHRpcGxpY2l0eTsgaTxjcnYuY29udHJvbFB0cy5sZW5ndGg7KytpKSBuZXdQb2ludHNbaSt0aW1lc10gPSBjcnYuY29udHJvbFB0c1tpXTtcblx0dmFyIHRlbXAgPSBuZXcgQXJyYXkoZGVncmVlKzEpO1xuXHRmb3IoaT0wO2k8PSBjcnYuZGVncmVlLW11bHRpcGxpY2l0eTsrK2kpIHRlbXBbaV0gPSBjcnYuY29udHJvbFB0c1tjdXJyS25vdC1jcnYuZGVncmVlK2ldO1xuXHR2YXIgaiwgTCxhbHBoYTtcblx0Zm9yKGo9MTtqPD10aW1lczsrK2opIHtcblx0IEwgPSBjdXJyS25vdC1jcnYuZGVncmVlK2o7XG5cdCBmb3IoaT0wO2k8PWNydi5kZWdyZWUtai1tdWx0aXBsaWNpdHk7KytpKSB7XG5cdFx0IGFscGhhID0gKHUtY3J2Lmtub3RzW0wraV0pLyhjcnYua25vdHNbaStjdXJyS25vdCsxXS1jcnYua25vdHNbTCtpXSk7XG5cdFx0IHZlYzQuYWRkKHZlYzQuc2NhbGUodGVtcFtpKzFdLGFscGhhKSx2ZWM0LnNjYWxlKHRlbXBbaV0sMS4wLWFscGhhKSx0ZW1wW2ldKTtcblx0IH1cblx0IFxuXHQgbmV3UG9pbnRzW0xdID0gdGVtcFswXTtcblx0IG5ld1BvaW50c1tjdXJyS25vdCt0aW1lcy1qLW11bHRpcGxpY2l0eV0gPSB0ZW1wW2Nydi5kZWdyZWUtai1tdWx0aXBsaWNpdHldO1xuXHR9XG5cdGZvcihpPUwrMTtpPGN1cnJLbm90LW11bHRpcGxpY2l0eTsrK2kpIHtcblx0IG5ld1BvaW50c1tpXSA9IHRlbXBbaS1MXTtcblx0fVxuXHRjcnYuY29udHJvbFB0cyA9IG5ld1BvaW50cztcblx0Y3J2Lmtub3RzID0gbmV3S25vdHM7XG59XHQgIFxuXG5udXJicy5pbnNlcnRLbm90QXJyYXkgPSBmdW5jdGlvbihjcnYsdXMpIHtcblxufVxuXHQgIC8qXHQgXG5cdCBwdWJsaWMgdm9pZCBpbnNlcnRLbm90cyhmbG9hdFtdIGluc2VydEtub3RzKSB7XG5cdFx0IGludCBzdGFydEtub3QgPSBmaW5kS25vdChpbnNlcnRLbm90c1swXSk7XG5cdFx0IGludCBlbmRLbm90ID0gZmluZEtub3QoaW5zZXJ0S25vdHNbaW5zZXJ0S25vdHMubGVuZ3RoLTFdKSsxO1xuXHRcdCBmbG9hdFtdIG5ld0tub3RzID0gbmV3IGZsb2F0W2tub3RzLmxlbmd0aCtpbnNlcnRLbm90cy5sZW5ndGhdO1xuXHRcdCBWZWN0b3I0RFtdIG5ld1BvaW50cyA9IG5ldyBWZWN0b3I0RFtjb250cm9sUHRzLmxlbmd0aCtpbnNlcnRLbm90cy5sZW5ndGhdO1xuXHRcdCBmb3IoaW50IGo9MDtqPD1zdGFydEtub3QtZGVncmVlOysraikgbmV3UG9pbnRzW2pdID0gbmV3IFZlY3RvcjREKGNvbnRyb2xQdHNbal0sd2VpZ2h0c1tqXSk7XG5cdFx0IGZvcihpbnQgaj1lbmRLbm90LTE7ajxjb250cm9sUHRzLmxlbmd0aDsrK2opIG5ld1BvaW50c1tqK2luc2VydEtub3RzLmxlbmd0aF0gPSAgbmV3IFZlY3RvcjREKGNvbnRyb2xQdHNbal0sd2VpZ2h0c1tqXSk7XG5cdFx0IGZvcihpbnQgaj0wO2o8PXN0YXJ0S25vdDsrK2opIG5ld0tub3RzW2pdID0ga25vdHNbal07XG5cdFx0IGZvcihpbnQgaj1lbmRLbm90K2RlZ3JlZTtqPGtub3RzLmxlbmd0aDsrK2opIG5ld0tub3RzW2oraW5zZXJ0S25vdHMubGVuZ3RoXSA9IGtub3RzW2pdO1xuXHRcdCBpbnQgaT1lbmRLbm90K2RlZ3JlZS0xO1xuXHRcdCBpbnQgaz0gZW5kS25vdCtkZWdyZWUraW5zZXJ0S25vdHMubGVuZ3RoLTE7XG5cdFx0IGZvcihpbnQgaj1pbnNlcnRLbm90cy5sZW5ndGgtMTtqPj0wOy0taikge1xuXHRcdFx0IHdoaWxlKGluc2VydEtub3RzW2pdIDw9IGtub3RzW2ldICYmIGk+c3RhcnRLbm90KSB7XG5cdFx0XHRcdCBuZXdQb2ludHNbay1kZWdyZWUtMV0gPSBuZXcgVmVjdG9yNEQoY29udHJvbFB0c1tpLWRlZ3JlZS0xXSx3ZWlnaHRzW2ktZGVncmVlLTFdKTtcblx0XHRcdFx0IG5ld0tub3RzW2tdID0ga25vdHNbaV07XG5cdFx0XHRcdCAtLWs7XG5cdFx0XHRcdCAtLWk7XG5cdFx0XHQgfVxuXHRcdFx0IG5ld1BvaW50c1trLWRlZ3JlZS0xXSA9IG5ld1BvaW50c1trLWRlZ3JlZV07XG5cdFx0XHQgZm9yKGludCBsPTE7bDw9ZGVncmVlOysrbCkge1xuXHRcdFx0XHQgaW50IGluZCA9IGstZGVncmVlK2w7XG5cdFx0XHRcdCBsb2F0IGFscGhhID0gbmV3S25vdHNbaytsXS1pbnNlcnRLbm90c1tqXTtcblx0XHRcdFx0IGlmKE1hdGguYWJzKGFscGhhKSA9PSAwKSBuZXdQb2ludHNbaW5kLTFdID0gbmV3UG9pbnRzW2luZF07XG5cdFx0XHRcdCBlbHNlIHtcblx0XHRcdFx0XHQgYWxwaGEgPSBhbHBoYS8obmV3S25vdHNbaytsXS1rbm90c1tpLWRlZ3JlZStsXSk7XG5cdFx0XHRcdFx0IG5ld1BvaW50c1tpbmQtMV0gPSBWZWN0b3I0RC5hZGQoVmVjdG9yNEQubXVsdGlwbHkobmV3UG9pbnRzW2luZC0xXSxhbHBoYSksIFZlY3RvcjRELm11bHRpcGx5KG5ld1BvaW50c1tpbmRdLDEtYWxwaGEpKTtcblx0XHRcdFx0IH1cblx0XHRcdCB9XG5cdFx0XHQgbmV3S25vdHNba10gPSBpbnNlcnRLbm90c1tqXTtcblx0XHRcdCAtLWs7XG5cdFx0IH1cblx0XHQga25vdHMgPSBuZXdLbm90cztcblx0XHQgY29udHJvbFB0cyA9IG5ldyBQVmVjdG9yW25ld1BvaW50cy5sZW5ndGhdO1xuXHRcdCB3ZWlnaHRzID0gbmV3IGZsb2F0W25ld1BvaW50cy5sZW5ndGhdO1xuXHRcdCBmb3IoaW50IGo9MDtqPG5ld1BvaW50cy5sZW5ndGg7KytqKSB7XG5cdFx0XHQgXG5cdFx0XHQgaWYobmV3UG9pbnRzW2pdICE9IG51bGwpIHtcblx0XHRcdFx0IGNvbnRyb2xQdHNbal0gPSBuZXdQb2ludHNbal0ucHJvamVjdERvd24oKTtcblx0XHRcdFx0IHdlaWdodHNbal0gPSBuZXdQb2ludHNbal0udztcblx0XHRcdCB9XG5cdFx0IH1cblx0IH1cbiovXG4vL21ha2Uga25vdCB2YWx1ZXMgYmV0d2VlbiAwIGFuZCAxIGFrYSBldmFsdWF0ZSgwKSA9IHN0YXJ0IGFuZCBldmFsdWF0ZSgxKSA9IGVuZFxubnVyYnMubm9ybWFsaXplS25vdHM9ZnVuY3Rpb24oa25vdHMpIHtcblx0dmFyIHN0YXJ0ID0ga25vdHNbMF07XG5cdHZhciBlbmQgPSBrbm90c1trbm90cy5sZW5ndGgtMV07XG5cdGZvcih2YXIgaT0wO2k8a25vdHMubGVuZ3RoOysraSkge1xuXHRcdGtub3RzW2ldID0gKGtub3RzW2ldLXN0YXJ0KS8oZW5kLXN0YXJ0KTtcblx0fVxufVxuXG4vL2hvdyBtYW55IHRpbWVzIGRvZXMgYSBrbm90IGFwcGVhclxubnVyYnMuZmluZE11bHRpcGxpY2l0eSA9IGZ1bmN0aW9uKGtub3RzLGtub3QpIHtcblx0dmFyIG11bHQgPSAxO1xuXHR2YXIgaTtcblx0Zm9yKGk9a25vdCsxO2k8a25vdHMubGVuZ3RoICYmIGtub3RzW2ldID09IGtub3RzW2tub3RdOysraSkgKyttdWx0O1xuXHRmb3IoaT1rbm90LTE7aT49MCAmJiBrbm90c1tpXSA9PSBrbm90c1trbm90XTstLWkpICsrbXVsdDtcblxuXHRyZXR1cm4gbXVsdC0xO1xufVxuXHQgXG5udXJicy5iYXNpc0Z1bmN0aW9ucyA9IChmdW5jdGlvbigpIHtcbiAgdmFyIGxlZnQgPSBuZXcgRmxvYXQzMkFycmF5KG51cmJzLk1BWF9ERUdSRUUrMSk7XG4gIHZhciByaWdodCA9IG5ldyBGbG9hdDMyQXJyYXkobnVyYnMuTUFYX0RFR1JFRSsxKTtcbiAgcmV0dXJuIGZ1bmN0aW9uIGJhc2lzRnVuY3Rpb25zKGtub3RzLGRlZ3JlZSxrbm90LHUsZnVuY3MpIHtcblxuICAgIGZ1bmNzWzBdID0gMTtcbiAgICB2YXIgaiwgciwgc2F2ZWQsIHRlbXA7XG4gICAgZm9yKCBqPTE7ajw9ZGVncmVlOysraikge1xuICAgICAgbGVmdFtqXSA9IHUta25vdHNba25vdCsxLWpdO1xuICAgICAgcmlnaHRbal0gPSBrbm90c1trbm90K2pdLXU7XG4gICAgICBzYXZlZCA9IDA7XG4gICAgICBmb3IoIHIgPSAwO3I8ajsrK3IpIHtcbiAgICAgIHRlbXAgPSBmdW5jc1tyXS8ocmlnaHRbcisxXStsZWZ0W2otcl0pO1xuICAgICAgZnVuY3Nbcl0gPSBzYXZlZCtyaWdodFtyKzFdKnRlbXA7XG4gICAgICBzYXZlZCA9IGxlZnRbai1yXSp0ZW1wO1xuICAgICAgfVxuICAgICAgZnVuY3Nbal0gPSBzYXZlZDtcbiAgICB9XG4gICAgcmV0dXJuIGZ1bmNzO1xuICB9XG59KSgpO1xuXHQgIFxubnVyYnMuZGVyaXZlQmFzaXNGdW5jdGlvbnMgPSBmdW5jdGlvbihrbm90cyxkZWdyZWUsa25vdCwgdSwgZGVyKSB7XG5cdHZhciBsZWZ0LHJpZ2h0O1xuXHRuZHVbMF1bMF0gPSAxO1xuXHR2YXIgaixyO1xuXHR2YXIgc2F2ZWQsdGVtcDtcblx0Zm9yKGo9MTtqPD1kZWdyZWU7KytqKSB7XG5cdCBsZWZ0W2pdID0gdS1rbm90c1trbm90KzEtal07XG5cdCByaWdodFtqXSA9IGtub3RzW2tub3Qral0tdTtcblx0IHNhdmVkID0gMDtcblx0IGZvcihyPTA7cjxqOysrcikge1xuXHRcdCBuZHVbal1bcl0gPSByaWdodFtyKzFdK2xlZnRbai1yXTtcblx0XHQgdGVtcCA9IG5kdVtyXVtqLTFdL25kdVtqXVtyXTtcblx0XHQgbmR1W3JdW2pdID0gc2F2ZWQrcmlnaHRbcisxXSp0ZW1wO1xuXHRcdCBzYXZlZCA9IGxlZnRbai1yXSp0ZW1wO1xuXHQgfVxuXHQgbmR1W2pdW2pdID0gc2F2ZWQ7XG5cdH1cblx0Zm9yKGo9MDtqPD1kZWdyZWU7KytqKVxuXHRcdG51cmJzLmRlcml2ZUJhc2lzRnVuY3NbMF1bal0gPSBuZHVbal1bZGVncmVlXTtcblx0XG5cdHZhciBzMSwgczIsIGssZCxyayxwayxqMSxqMjtcblx0dmFyIGE9bmV3IEFycmF5KGRlZ3JlZSsxKTtcblx0Zm9yKGo9MDtqPGRlZ3JlZSsxOysraikgYVtqXSA9IG5ldyBBcnJheShkZWdyZWUrMSk7XG5cdGZvcihyPTA7cjw9ZGVncmVlOysrcikge1xuXHQgczEgPSAwO1xuXHQgczIgPSAxO1xuXHQgYVswXVswXSA9IDE7XG5cdCBmb3IoIGs9MTtrPD1kZXI7KytrKSB7XG5cdFx0IGQgPSAwO1xuXHRcdCByayA9IHItaztcblx0XHQgcGsgPSBkZWdyZWUtaztcblx0XHQgaWYocj49aykge1xuXHRcdFx0IGFbczJdWzBdID0gYVtzMV1bMF0vbmR1W3BrKzFdW3JrXTtcblx0XHRcdCBkID0gYVtzMl1bMF0qbmR1W3JrXVtwa107XG5cdFx0IH1cblx0XHQgajEgPSAtcms7XG5cdFx0IGlmKHJrPj0tMSkgajEgPSAxO1xuXHRcdCBqMj1kZWdyZWUtcjtcblx0XHQgaWYoci0xIDw9cGspIGoyID0gay0xO1xuXHRcdCBcblx0XHQgZm9yKGo9ajE7ajw9ajI7KytqKSB7XG5cdFx0XHQgYVtzMl1bal0gPSAoYVtzMV1bal0tYVtzMV1bai0xXSkvbmR1W3BrKzFdW3JrK2pdO1xuXHRcdFx0IGQgKz0gYVtzMl1bal0qbmR1W3JrK2pdW3BrXTtcblx0XHQgfVxuXHRcdCBpZihyPD1waykge1xuXHRcdFx0IGFbczJdW2tdID0gLWFbczFdW2stMV0vbmR1W3BrKzFdW3JdO1xuXHRcdFx0IGQgKz0gYVtzMl1ba10qbmR1W3JdW3BrXTtcblx0XHQgfVxuXHRcdCBudXJicy5kZXJpdmVCYXNpc0Z1bmNzW2tdW3JdID0gZDtcblx0XHQgdGVtcCA9czE7XG5cdFx0IHMxID0gczI7XG5cdFx0IHMyID0gdGVtcDtcdCBcblx0IH1cblx0fVxuXHRyID0gZGVncmVlO1xuXHRmb3Ioaz0xO2s8PWRlcjsrK2spIHtcblx0IGZvcihqPTA7ajw9ZGVncmVlOysraikgbnVyYnMuZGVyaXZlQmFzaXNGdW5jc1trXVtqXSAqPSByOyBcblx0IHIgKj0gKGRlZ3JlZS1rKTtcblx0fVxuXHRyZXR1cm4gbnVyYnMuZGVyaXZlQmFzaXNGdW5jcztcbn1cblxubnVyYnMuY2lyY2xlUHQgPSBmdW5jdGlvbihjZW4scmFkaXVzKSB7XG5cblx0dmFyIGNydiA9IG51cmJzLmNyZWF0ZUNydigpO1xuXHRjcnYuY29udHJvbFB0cyA9IFtdO1xuXHRjcnYuZGVncmVlID0gMjtcblx0Y3J2Lmtub3RzID0gWzAsMCwwLE1hdGguUEkqMC41LE1hdGguUEkqMC41LCBNYXRoLlBJLCBNYXRoLlBJLCBNYXRoLlBJKjEuNSwgTWF0aC5QSSoxLjUsIE1hdGguUEkqMiwgTWF0aC5QSSoyLE1hdGguUEkqMl07XG5cdHZhciBTUVJUMiA9IE1hdGguc3FydCgyLjApKjAuNTtcblx0Y3J2LmNvbnRyb2xQdHMgPSBbIHZlYzQuY3JlYXRlKFtjZW5bMF0rcmFkaXVzLGNlblsxXSxjZW5bMl0sMV0pLFxuXHRcdHZlYzQuY3JlYXRlKFsoY2VuWzBdK3JhZGl1cykqU1FSVDIsKGNlblsxXStyYWRpdXMpKlNRUlQyLGNlblsyXSpTUVJUMixTUVJUMl0pLFxuXHRcdHZlYzQuY3JlYXRlKFtjZW5bMF0sY2VuWzFdK3JhZGl1cyxjZW5bMl0sMV0pLFxuXHRcdHZlYzQuY3JlYXRlKFsoY2VuWzBdLXJhZGl1cykqU1FSVDIsKGNlblsxXStyYWRpdXMpKlNRUlQyLGNlblsyXSpTUVJUMixTUVJUMl0pLFxuXHRcdHZlYzQuY3JlYXRlKFtjZW5bMF0tcmFkaXVzLGNlblsxXSxjZW5bMl0sMV0pLFxuXHRcdHZlYzQuY3JlYXRlKFsoY2VuWzBdLXJhZGl1cykqU1FSVDIsKGNlblsxXS1yYWRpdXMpKlNRUlQyLGNlblsyXSpTUVJUMixTUVJUMl0pLFxuXHRcdHZlYzQuY3JlYXRlKFtjZW5bMF0sY2VuWzFdLXJhZGl1cyxjZW5bMl0sMV0pLFxuXHRcdHZlYzQuY3JlYXRlKFsoY2VuWzBdK3JhZGl1cykqU1FSVDIsKGNlblsxXS1yYWRpdXMpKlNRUlQyLGNlblsyXSpTUVJUMixTUVJUMl0pLFxuXHRcdHZlYzQuY3JlYXRlKFtjZW5bMF0rcmFkaXVzLGNlblsxXSxjZW5bMl0sMV0pIF07XG5cdHJldHVybiBjcnY7XG59XHRcblxuXG4vLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vL05VUkJTIFNVUkZBQ0VTXG4vL1xubnVyYnMuY3JlYXRlU3JmID0gZnVuY3Rpb24oKSB7XG5cdHZhciBzcmYgPSB7fTtcblx0c3JmLmtub3RzVSA9IFtdO1xuXHRzcmYua25vdHNWID0gW107XG5cdHNyZi5jb250cm9sUHRzID0gW107XG5cdHNyZi5kZWdyZWVVID0gW107XG5cdHNyZi5kZWdyZWVWID0gW107XG5cdHJldHVybiBzcmY7XG59XG5cblxubnVyYnMuZXZhbHVhdGVTcmYgPSBmdW5jdGlvbihzcmYsdSx2LHB0KSB7XG5cdHB0ID0gcHQgfHwgdmVjMy5jcmVhdGUoKTtcblx0Ly9pZihjb250cm9sUHRzLmxlbmd0aCA9PSAwKSByZXR1cm4gbmV3IFBWZWN0b3IoKTtcblx0dmFyIHVLbm90ID0gbnVyYnMuZmluZEtub3Qoc3JmLmtub3RzVSx1LHNyZi5kZWdyZWVVKTtcblx0dmFyIHZLbm90ID0gbnVyYnMuZmluZEtub3Qoc3JmLmtub3RzVix2LHNyZi5kZWdyZWVWKTtcblx0bnVyYnMuYmFzaXNGdW5jdGlvbnMoc3JmLmtub3RzVSwgc3JmLmRlZ3JlZVUsIHVLbm90LHUsbnVyYnMuYmFzaXNGdW5jc1UpO1xuXHRudXJicy5iYXNpc0Z1bmN0aW9ucyhzcmYua25vdHNWLCBzcmYuZGVncmVlViwgdktub3QsdixudXJicy5iYXNpc0Z1bmNzVik7XG5cdFxuXHR2YXIgZXZhbFB0ID0gdmVjNC5jcmVhdGUoKTtcblx0dmFyIHRlbXAgPSBbXTtcblx0dmFyIGksajtcblx0Ly9hdm9pZCBjcmVhdGUgY29tbWFuZHNcblx0Zm9yKGk9MDtpPD1zcmYuZGVncmVlVjsrK2kpIHtcblx0XHR0ZW1wW2ldID0gdmVjNC5jcmVhdGUoKTtcblx0XHRmb3Ioaj0wO2o8PXNyZi5kZWdyZWVVOysraikge1xuXHRcdFx0dmVjNC5hZGQodGVtcFtpXSx2ZWM0LnNjYWxlKHNyZi5jb250cm9sUHRzW3VLbm90LXNyZi5kZWdyZWVVK2pdW3ZLbm90LXNyZi5kZWdyZWVWK2ldLCBudXJicy5iYXNpc0Z1bmNzVVtqXSxldmFsUHQpKTtcblx0XHR9XG5cdH1cblx0XG5cdHZlYzQuc2V0KFswLDAsMCwwXSxldmFsUHQpO1xuXHRmb3IoaT0wO2k8PXNyZi5kZWdyZWVWOysraSkge1xuXHRcdHZlYzQuYWRkKGV2YWxQdCwgdmVjNC5zY2FsZSh0ZW1wW2ldLG51cmJzLmJhc2lzRnVuY3NWW2ldKSk7XG5cdH1cblx0cmV0dXJuIHZlYzQucHJvamVjdERvd24oZXZhbFB0LHB0KTtcbn1cblx0LypcblxuXHROdXJic0N1cnZlIGlzb2N1cnZlKGZsb2F0IHUsIGJvb2xlYW4gZGlyKSB7XG5cdFx0aW50IHVLbm90ID0gZmluZEtub3QodSxrbm90c1UsZGVncmVlVSk7XG5cdFx0ZmxvYXRbXSBiYXNGdW5jID0gYmFzaXNGdW5jdGlvbnModUtub3QsdSxrbm90c1UsZGVncmVlVSk7XG5cdFx0VmVjdG9yNERbXVtdIGhQdHMgPSBuZXcgVmVjdG9yNERbZGVncmVlVSsxXVtkZWdyZWVWKzFdO1xuXHRcdGZvcihpbnQgaT0wO2k8Y29udHJvbFB0cy5sZW5ndGg7KytpKSB7XG5cdFx0XHRmb3IoaW50IGo9MDtqPGNvbnRyb2xQdHNbMF0ubGVuZ3RoOysraikge1xuXHRcdFx0XHRQVmVjdG9yIGN0cmxQdCA9IGNvbnRyb2xQdHNbaV1bal07XG5cdFx0XHRcdGZsb2F0IHcgPSB3ZWlnaHRzW2ldW2pdO1xuXHRcdFx0XHRoUHRzW2ldW2pdID0gbmV3IFZlY3RvcjREKGN0cmxQdC54KncsIGN0cmxQdC55KncsY3RybFB0Lnoqdyx3KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0VmVjdG9yNERbXSBuZXdQdHMgPSBuZXcgVmVjdG9yNERbY29udHJvbFB0c1swXS5sZW5ndGhdO1xuXHRcdGZvcihpbnQgaT0wO2k8Y29udHJvbFB0c1swXS5sZW5ndGg7KytpKSB7XG5cdFx0XHRmb3IoaW50IGo9MDtqPD1kZWdyZWVVOysraikge1xuXHRcdFx0XHRuZXdQdHNbaV0gPSBWZWN0b3I0RC5hZGQobmV3UHRzW2ldLFZlY3RvcjRELm11bHRpcGx5KGhQdHNbdUtub3QtZGVncmVlVStqXVtpXSwgYmFzRnVuY1tqXSkpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRcblx0XHRQVmVjdG9yW10gbmV3Q1B0cyA9IG5ldyBQVmVjdG9yW25ld1B0cy5sZW5ndGhdO1xuXHRcdGZsb2F0W10gbmV3V2VpZ2h0cyA9IG5ldyBmbG9hdFtuZXdQdHMubGVuZ3RoXTtcblx0XHRmb3IoaW50IGk9MDtpPG5ld1B0cy5sZW5ndGg7KytpKSB7XG5cdFx0XHRuZXdDUHRzW2ldID0gbmV3IFBWZWN0b3IobmV3UHRzW2ldLngqbmV3UHRzW2ldLncsbmV3UHRzW2ldLnkqbmV3UHRzW2ldLncsbmV3UHRzW2ldLnoqbmV3UHRzW2ldLncpO1xuXHRcdFx0bmV3V2VpZ2h0c1tpXSA9IG5ld1B0c1tpXS53O1xuXHRcdH1cblx0XHRyZXR1cm4gbmV3IE51cmJzQ3VydmUobmV3Q1B0cywga25vdHNWLCBuZXdXZWlnaHRzLCBkZWdyZWVWKTtcblx0fVxuXHRcblx0Ki9cblx0XG5udXJicy5sb2Z0ID0gZnVuY3Rpb24oY3J2MSxjcnYyKSB7XG5cdC8vZG8gZGVncmVlIGVsZXZhdGlvblxuXHRpZihjcnYxLmRlZ3JlZSAhPSBjcnYyLmRlZ3JlZSkgcmV0dXJuIG51bGw7XG5cdHZhciB0ZW1wMSA9IG51cmJzLmNvcHlDcnYoY3J2MSk7XG5cdHZhciB0ZW1wMiA9IG51cmJzLmNvcHlDcnYoY3J2Mik7XG5cdG51cmJzLm5vcm1hbGl6ZUtub3RzKHRlbXAxKTtcblx0bnVyYnMubm9ybWFsaXplS25vdHModGVtcDIpO1xuXHQvL2ZpbmQgZGlmZmVyZW5jZVxuXHR2YXIgayA9IDAsaTtcblx0dmFyIGluc2VydFRlbXAxID0gW107XG5cdHZhciBpbnNlcnRUZW1wMiA9IFtdO1xuXHRmb3IoaT0wO2k8dGVtcDEua25vdHMubGVuZ3RoOysraSkge1xuXHRcdHdoaWxlKGsgPCB0ZW1wMi5rbm90cy5sZW5ndGggJiYgdGVtcDIua25vdHNba10gPCB0ZW1wMS5rbm90c1tpXSApIHtcblx0XHRcdGluc2VydFRlbXAxLnB1c2godGVtcDIua25vdHNba10pO1xuXHRcdFx0KytrO1xuXHRcdH1cblx0XHRpZih0ZW1wMi5rbm90c1trXSA+IHRlbXAxLmtub3RzW2ldKSBpbnNlcnRUZW1wMi5wdXNoKHRlbXAxLmtub3RzW2ldKTtcblx0XHRpZih0ZW1wMi5rbm90c1trXSA9PSB0ZW1wMS5rbm90c1tpXSkgKytrO1xuXHR9XG5cdHdoaWxlKGs8dGVtcDIua25vdHMubGVuZ3RoKSB7XG5cdFx0aW5zZXJ0VGVtcDEucHVzaCh0ZW1wMi5rbm90c1trXSk7XG5cdFx0KytrO1xuXHR9XG5cdGlmKGluc2VydFRlbXAxLmxlbmd0aCA+IDApIG51cmJzLmluc2VydEtub3RzKHRlbXAxLGluc2VydFRlbXAxKTtcblx0aWYoaW5zZXJ0VGVtcDIubGVuZ3RoID4gMCkgbnVyYnMuaW5zZXJ0S25vdHModGVtcDIsaW5zZXJ0VGVtcDIpO1xuXHRcblx0dmFyIHB0cyA9IG5ldyBBcnJheSh0ZW1wMS5jb250cm9sUHRzLmxlbmd0aCk7XG5cdGZvcihpPTA7aTxwdHMubGVuZ3RoOysraSkge1xuXHRcdHB0c1tpXSA9IFt0ZW1wMS5jb250cm9sUHRzW2ldLCB0ZW1wMi5jb250cm9sUHRzW2ldXTtcblx0fVxuXHRcblx0dmFyIHRvUmV0dXJuID0gbnVyYnMuY3JlYXRlU3JmKCk7XG5cdHRvUmV0dXJuLmNvbnRyb2xQdHMgPSBwdHM7XG5cdHRvUmV0dXJuLmRlZ3JlZVUgPSB0ZW1wMS5kZWdyZWU7XG5cdHRvUmV0dXJuLmRlZ3JlZVYgPSAxO1xuXHR0b1JldHVybi5rbm90c1YgPSBbMCwwLDEsMV07IC8vdGhpcyBtaWdodCBiZSB3cm9uZ1xuXHRmb3IoaT0wO2k8dGVtcDEua25vdHMubGVuZ3RoOysraSkge1xuXHRcdHRvUmV0dXJuLmtub3RzVVtpXSA9IHRlbXAxLmtub3RzW2ldO1xuXHR9XG5cdHJldHVybiB0b1JldHVybjtcbn1cblxuLy9yZXZvbHZlXG5udXJicy5yZXZvbHZlID0gZnVuY3Rpb24oY3J2LCBheGlzKSB7XG5cbn1cblxubnVyYnMuc3dlZXAgPSBmdW5jdGlvbihjcnYxLGNydjIpIHtcblxufSIsIi8qXG4gKiBQb2x5MlRyaSBDb3B5cmlnaHQgKGMpIDIwMDktMjAxMywgUG9seTJUcmkgQ29udHJpYnV0b3JzXG4gKiBodHRwOi8vY29kZS5nb29nbGUuY29tL3AvcG9seTJ0cmkvXG4gKlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBSZWRpc3RyaWJ1dGlvbiBhbmQgdXNlIGluIHNvdXJjZSBhbmQgYmluYXJ5IGZvcm1zLCB3aXRoIG9yIHdpdGhvdXQgbW9kaWZpY2F0aW9uLFxuICogYXJlIHBlcm1pdHRlZCBwcm92aWRlZCB0aGF0IHRoZSBmb2xsb3dpbmcgY29uZGl0aW9ucyBhcmUgbWV0OlxuICpcbiAqICogUmVkaXN0cmlidXRpb25zIG9mIHNvdXJjZSBjb2RlIG11c3QgcmV0YWluIHRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlLFxuICogICB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyLlxuICogKiBSZWRpc3RyaWJ1dGlvbnMgaW4gYmluYXJ5IGZvcm0gbXVzdCByZXByb2R1Y2UgdGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UsXG4gKiAgIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIgaW4gdGhlIGRvY3VtZW50YXRpb25cbiAqICAgYW5kL29yIG90aGVyIG1hdGVyaWFscyBwcm92aWRlZCB3aXRoIHRoZSBkaXN0cmlidXRpb24uXG4gKiAqIE5laXRoZXIgdGhlIG5hbWUgb2YgUG9seTJUcmkgbm9yIHRoZSBuYW1lcyBvZiBpdHMgY29udHJpYnV0b3JzIG1heSBiZVxuICogICB1c2VkIHRvIGVuZG9yc2Ugb3IgcHJvbW90ZSBwcm9kdWN0cyBkZXJpdmVkIGZyb20gdGhpcyBzb2Z0d2FyZSB3aXRob3V0IHNwZWNpZmljXG4gKiAgIHByaW9yIHdyaXR0ZW4gcGVybWlzc2lvbi5cbiAqXG4gKiBUSElTIFNPRlRXQVJFIElTIFBST1ZJREVEIEJZIFRIRSBDT1BZUklHSFQgSE9MREVSUyBBTkQgQ09OVFJJQlVUT1JTXG4gKiBcIkFTIElTXCIgQU5EIEFOWSBFWFBSRVNTIE9SIElNUExJRUQgV0FSUkFOVElFUywgSU5DTFVESU5HLCBCVVQgTk9UXG4gKiBMSU1JVEVEIFRPLCBUSEUgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSBBTkQgRklUTkVTUyBGT1JcbiAqIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFSRSBESVNDTEFJTUVELiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQ09QWVJJR0hUIE9XTkVSIE9SXG4gKiBDT05UUklCVVRPUlMgQkUgTElBQkxFIEZPUiBBTlkgRElSRUNULCBJTkRJUkVDVCwgSU5DSURFTlRBTCwgU1BFQ0lBTCxcbiAqIEVYRU1QTEFSWSwgT1IgQ09OU0VRVUVOVElBTCBEQU1BR0VTIChJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTyxcbiAqIFBST0NVUkVNRU5UIE9GIFNVQlNUSVRVVEUgR09PRFMgT1IgU0VSVklDRVM7IExPU1MgT0YgVVNFLCBEQVRBLCBPUlxuICogUFJPRklUUzsgT1IgQlVTSU5FU1MgSU5URVJSVVBUSU9OKSBIT1dFVkVSIENBVVNFRCBBTkQgT04gQU5ZIFRIRU9SWSBPRlxuICogTElBQklMSVRZLCBXSEVUSEVSIElOIENPTlRSQUNULCBTVFJJQ1QgTElBQklMSVRZLCBPUiBUT1JUIChJTkNMVURJTkdcbiAqIE5FR0xJR0VOQ0UgT1IgT1RIRVJXSVNFKSBBUklTSU5HIElOIEFOWSBXQVkgT1VUIE9GIFRIRSBVU0UgT0YgVEhJU1xuICogU09GVFdBUkUsIEVWRU4gSUYgQURWSVNFRCBPRiBUSEUgUE9TU0lCSUxJVFkgT0YgU1VDSCBEQU1BR0UuXG4gKi9cblxuLyoganNoaW50IGJyb3dzZXI6ZmFsc2UsIGZvcmluOnRydWUsIG5vYXJnOnRydWUsIG5vZW1wdHk6dHJ1ZSwgZXFlcWVxOnRydWUsIGJpdHdpc2U6dHJ1ZSwgXG4gICBzdHJpY3Q6dHJ1ZSwgdW5kZWY6dHJ1ZSwgdW51c2VkOnRydWUsIGN1cmx5OnRydWUsIGltbWVkOnRydWUsIGxhdGVkZWY6dHJ1ZSwgXG4gICBuZXdjYXA6dHJ1ZSwgdHJhaWxpbmc6dHJ1ZSwgbWF4Y29tcGxleGl0eToxMSwgaW5kZW50OjQgXG4gKi9cblxuLypcbiAgZWRpdGVkIGJ5IE5lcnZvdXMgU3lzdGVtLCAyMDE0XG4qL1xuXG4vKlxuICogTm90ZVxuICogPT09PVxuICogdGhlIHN0cnVjdHVyZSBvZiB0aGlzIEphdmFTY3JpcHQgdmVyc2lvbiBvZiBwb2x5MnRyaSBpbnRlbnRpb25uYWx5IGZvbGxvd3NcbiAqIGFzIGNsb3NlbHkgYXMgcG9zc2libGUgdGhlIHN0cnVjdHVyZSBvZiB0aGUgcmVmZXJlbmNlIEMrKyB2ZXJzaW9uLCB0byBtYWtlIGl0IFxuICogZWFzaWVyIHRvIGtlZXAgdGhlIDIgdmVyc2lvbnMgaW4gc3luYy5cbiAqL1xuXG5cbi8qKlxuICogTW9kdWxlIGVuY2Fwc3VsYXRpb25cbiAqIEBwYXJhbSB7T2JqZWN0fSBnbG9iYWwgYSByZWZlcmVuY2UgdG8gdGhlIGdsb2JhbCBvYmplY3QgOlxuICogICAgICAgICAgICAgICAgICAgICAgd2luZG93IGluIHRoZSBicm93c2VyLCBnbG9iYWwgb24gdGhlIHNlcnZlclxuICovXG4oZnVuY3Rpb24oZ2xvYmFsKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tcG9seTJ0cmkgbW9kdWxlXG5cbiAgICAvLyBTYXZlIHRoZSBwcmV2aW91cyB2YWx1ZSBvZiB0aGUgcG9seTJ0cmkgdmFyaWFibGUsIFxuICAgIC8vIHNvIHRoYXQgaXQgY2FuIGJlIHJlc3RvcmVkIGxhdGVyIG9uLCBpZiBub0NvbmZsaWN0IGlzIHVzZWQuXG4gICAgXG4gICAgdmFyIHByZXZpb3VzUG9seTJ0cmkgPSBnbG9iYWwucG9seTJ0cmk7XG5cbiAgICAvLyBUaGUgdG9wLWxldmVsIG5hbWVzcGFjZS4gQWxsIHB1YmxpYyBwb2x5MnRyaSBjbGFzc2VzIGFuZCBmdW5jdGlvbnMgd2lsbFxuICAgIC8vIGJlIGF0dGFjaGVkIHRvIGl0LiBFeHBvcnRlZCBmb3IgYm90aCB0aGUgYnJvd3NlciBhbmQgdGhlIHNlcnZlciAoTm9kZS5qcykuXG4gICAgdmFyIHBvbHkydHJpO1xuICAgIC8qIGdsb2JhbCBleHBvcnRzICovXG4gICAgXG4gICAgaWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBwb2x5MnRyaSA9IGV4cG9ydHM7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcG9seTJ0cmkgPSBnbG9iYWwucG9seTJ0cmkgPSB7fTtcbiAgICB9XG5cbiAgICAvLyBSdW5zIHRoZSBsaWJyYXJ5IGluIG5vQ29uZmxpY3QgbW9kZSwgcmV0dXJuaW5nIHRoZSBwb2x5MnRyaSB2YXJpYWJsZSBcbiAgICAvLyB0byBpdHMgcHJldmlvdXMgb3duZXIuIFJldHVybnMgYSByZWZlcmVuY2UgdG8gdGhpcyBsaWJyYXJ5IG9iamVjdC5cbiAgICBwb2x5MnRyaS5ub0NvbmZsaWN0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGdsb2JhbC5wb2x5MnRyaSA9IHByZXZpb3VzUG9seTJ0cmk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1Qb2ludEVycm9yXG5cbiAgICAvKipcbiAgICAgKiBDdXN0b20gZXhjZXB0aW9uIGNsYXNzIHRvIGluZGljYXRlIGludmFsaWQgUG9pbnQgdmFsdWVzXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgICAgICAgICAgZXJyb3IgbWVzc2FnZVxuICAgICAqIEBwYXJhbSB7YXJyYXk8UG9pbnQ+fSBwb2ludHMgICAgIGludmFsaWQgcG9pbnRzXG4gICAgICovXG4gICAgLy8gQ2xhc3MgYWRkZWQgaW4gdGhlIEphdmFTY3JpcHQgdmVyc2lvbiAod2FzIG5vdCBwcmVzZW50IGluIHRoZSBjKysgdmVyc2lvbilcbiAgICB2YXIgUG9pbnRFcnJvciA9IGZ1bmN0aW9uIChtZXNzYWdlLCBwb2ludHMpIHtcbiAgICAgICAgdGhpcy5uYW1lICAgID0gXCJQb2ludEVycm9yXCI7XG4gICAgICAgIHRoaXMucG9pbnRzICA9IHBvaW50cyA9IHBvaW50cyB8fCBbXTtcbiAgICAgICAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZSB8fCBcIkludmFsaWQgUG9pbnRzIVwiO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5tZXNzYWdlICs9IFwiIFwiICsgUG9pbnQudG9TdHJpbmcocG9pbnRzW2ldKTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgUG9pbnRFcnJvci5wcm90b3R5cGUgPSBuZXcgRXJyb3IoKTtcbiAgICBQb2ludEVycm9yLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IFBvaW50RXJyb3I7XG5cblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tUG9pbnRcbiAgICAvKipcbiAgICAgKiBDb25zdHJ1Y3QgYSBwb2ludFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB4ICAgIGNvb3JkaW5hdGUgKDAgaWYgdW5kZWZpbmVkKVxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSB5ICAgIGNvb3JkaW5hdGUgKDAgaWYgdW5kZWZpbmVkKVxuICAgICAqL1xuICAgIHZhciBQb2ludCA9IGZ1bmN0aW9uKHgsIHkpIHtcbiAgICAgICAgdGhpcy54ID0gK3ggfHwgMDtcbiAgICAgICAgdGhpcy55ID0gK3kgfHwgMDtcblxuICAgICAgICAvLyBBbGwgZXh0cmEgZmllbGRzIGFkZGVkIHRvIFBvaW50IGFyZSBwcmVmaXhlZCB3aXRoIF9wMnRfXG4gICAgICAgIC8vIHRvIGF2b2lkIGNvbGxpc2lvbnMgaWYgY3VzdG9tIFBvaW50IGNsYXNzIGlzIHVzZWQuXG5cbiAgICAgICAgLy8gVGhlIGVkZ2VzIHRoaXMgcG9pbnQgY29uc3RpdHV0ZXMgYW4gdXBwZXIgZW5kaW5nIHBvaW50XG4gICAgICAgIHRoaXMuX3AydF9lZGdlX2xpc3QgPSBudWxsO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBGb3IgcHJldHR5IHByaW50aW5nIGV4LiA8aT5cIig1OzQyKVwiPC9pPilcbiAgICAgKi9cbiAgICBQb2ludC5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIChcIihcIiArIHRoaXMueCArIFwiO1wiICsgdGhpcy55ICsgXCIpXCIpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgY29weSBvZiB0aGlzIFBvaW50IG9iamVjdC5cbiAgICAgKiBAcmV0dXJucyBQb2ludFxuICAgICAqL1xuICAgIFBvaW50LnByb3RvdHlwZS5jbG9uZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gbmV3IFBvaW50KHRoaXMueCwgdGhpcy55KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogU2V0IHRoaXMgUG9pbnQgaW5zdGFuY2UgdG8gdGhlIG9yaWdvLiA8Y29kZT4oMDsgMCk8L2NvZGU+XG4gICAgICovXG4gICAgUG9pbnQucHJvdG90eXBlLnNldF96ZXJvID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMueCA9IDAuMDtcbiAgICAgICAgdGhpcy55ID0gMC4wO1xuICAgICAgICByZXR1cm4gdGhpczsgLy8gZm9yIGNoYWluaW5nXG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgY29vcmRpbmF0ZXMgb2YgdGhpcyBpbnN0YW5jZS5cbiAgICAgKiBAcGFyYW0gICB4ICAgbnVtYmVyLlxuICAgICAqIEBwYXJhbSAgIHkgICBudW1iZXI7XG4gICAgICovXG4gICAgUG9pbnQucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uKHgsIHkpIHtcbiAgICAgICAgdGhpcy54ID0gK3ggfHwgMDtcbiAgICAgICAgdGhpcy55ID0gK3kgfHwgMDtcbiAgICAgICAgcmV0dXJuIHRoaXM7IC8vIGZvciBjaGFpbmluZ1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBOZWdhdGUgdGhpcyBQb2ludCBpbnN0YW5jZS4gKGNvbXBvbmVudC13aXNlKVxuICAgICAqL1xuICAgIFBvaW50LnByb3RvdHlwZS5uZWdhdGUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy54ID0gLXRoaXMueDtcbiAgICAgICAgdGhpcy55ID0gLXRoaXMueTtcbiAgICAgICAgcmV0dXJuIHRoaXM7IC8vIGZvciBjaGFpbmluZ1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBBZGQgYW5vdGhlciBQb2ludCBvYmplY3QgdG8gdGhpcyBpbnN0YW5jZS4gKGNvbXBvbmVudC13aXNlKVxuICAgICAqIEBwYXJhbSAgIG4gICBQb2ludCBvYmplY3QuXG4gICAgICovXG4gICAgUG9pbnQucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKG4pIHtcbiAgICAgICAgdGhpcy54ICs9IG4ueDtcbiAgICAgICAgdGhpcy55ICs9IG4ueTtcbiAgICAgICAgcmV0dXJuIHRoaXM7IC8vIGZvciBjaGFpbmluZ1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBTdWJ0cmFjdCB0aGlzIFBvaW50IGluc3RhbmNlIHdpdGggYW5vdGhlciBwb2ludCBnaXZlbi4gKGNvbXBvbmVudC13aXNlKVxuICAgICAqIEBwYXJhbSAgIG4gICBQb2ludCBvYmplY3QuXG4gICAgICovXG4gICAgUG9pbnQucHJvdG90eXBlLnN1YiA9IGZ1bmN0aW9uKG4pIHtcbiAgICAgICAgdGhpcy54IC09IG4ueDtcbiAgICAgICAgdGhpcy55IC09IG4ueTtcbiAgICAgICAgcmV0dXJuIHRoaXM7IC8vIGZvciBjaGFpbmluZ1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBNdWx0aXBseSB0aGlzIFBvaW50IGluc3RhbmNlIGJ5IGEgc2NhbGFyLiAoY29tcG9uZW50LXdpc2UpXG4gICAgICogQHBhcmFtICAgcyAgIHNjYWxhci5cbiAgICAgKi9cbiAgICBQb2ludC5wcm90b3R5cGUubXVsID0gZnVuY3Rpb24ocykge1xuICAgICAgICB0aGlzLnggKj0gcztcbiAgICAgICAgdGhpcy55ICo9IHM7XG4gICAgICAgIHJldHVybiB0aGlzOyAvLyBmb3IgY2hhaW5pbmdcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogUmV0dXJuIHRoZSBkaXN0YW5jZSBvZiB0aGlzIFBvaW50IGluc3RhbmNlIGZyb20gdGhlIG9yaWdvLlxuICAgICAqL1xuICAgIFBvaW50LnByb3RvdHlwZS5sZW5ndGggPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIE1hdGguc3FydCh0aGlzLnggKiB0aGlzLnggKyB0aGlzLnkgKiB0aGlzLnkpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBOb3JtYWxpemUgdGhpcyBQb2ludCBpbnN0YW5jZSAoYXMgYSB2ZWN0b3IpLlxuICAgICAqIEByZXR1cm4gVGhlIG9yaWdpbmFsIGRpc3RhbmNlIG9mIHRoaXMgaW5zdGFuY2UgZnJvbSB0aGUgb3JpZ28uXG4gICAgICovXG4gICAgUG9pbnQucHJvdG90eXBlLm5vcm1hbGl6ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgbGVuID0gdGhpcy5sZW5ndGgoKTtcbiAgICAgICAgdGhpcy54IC89IGxlbjtcbiAgICAgICAgdGhpcy55IC89IGxlbjtcbiAgICAgICAgcmV0dXJuIGxlbjtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogVGVzdCB0aGlzIFBvaW50IG9iamVjdCB3aXRoIGFub3RoZXIgZm9yIGVxdWFsaXR5LlxuICAgICAqIEBwYXJhbSAgIHAgICBhbnkgXCJQb2ludCBsaWtlXCIgb2JqZWN0IHdpdGgge3gseX0gKGR1Y2sgdHlwaW5nKVxuICAgICAqIEByZXR1cm4gPGNvZGU+VHJ1ZTwvY29kZT4gaWYgPGNvZGU+dGhpcyA9PSBwPC9jb2RlPiwgPGNvZGU+ZmFsc2U8L2NvZGU+IG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBQb2ludC5wcm90b3R5cGUuZXF1YWxzID0gZnVuY3Rpb24ocCkge1xuICAgICAgICByZXR1cm4gdGhpcy54ID09PSBwLnggJiYgdGhpcy55ID09PSBwLnk7XG4gICAgfTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1Qb2ludCAoXCJzdGF0aWNcIiBtZXRob2RzKVxuXG4gICAgLyoqXG4gICAgICogTmVnYXRlIGEgcG9pbnQgY29tcG9uZW50LXdpc2UgYW5kIHJldHVybiB0aGUgcmVzdWx0IGFzIGEgbmV3IFBvaW50IG9iamVjdC5cbiAgICAgKiBAcGFyYW0gICBwICAgUG9pbnQgb2JqZWN0LlxuICAgICAqIEByZXR1cm4gdGhlIHJlc3VsdGluZyBQb2ludCBvYmplY3QuXG4gICAgICovXG4gICAgUG9pbnQubmVnYXRlID0gZnVuY3Rpb24ocCkge1xuICAgICAgICByZXR1cm4gbmV3IFBvaW50KC1wLngsIC1wLnkpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBBZGQgdHdvIHBvaW50cyBjb21wb25lbnQtd2lzZSBhbmQgcmV0dXJuIHRoZSByZXN1bHQgYXMgYSBuZXcgUG9pbnQgb2JqZWN0LlxuICAgICAqIEBwYXJhbSAgIGEgICBQb2ludCBvYmplY3QuXG4gICAgICogQHBhcmFtICAgYiAgIFBvaW50IG9iamVjdC5cbiAgICAgKiBAcmV0dXJuIHRoZSByZXN1bHRpbmcgUG9pbnQgb2JqZWN0LlxuICAgICAqL1xuICAgIFBvaW50LmFkZCA9IGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQb2ludChhLnggKyBiLngsIGEueSArIGIueSk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFN1YnRyYWN0IHR3byBwb2ludHMgY29tcG9uZW50LXdpc2UgYW5kIHJldHVybiB0aGUgcmVzdWx0IGFzIGEgbmV3IFBvaW50IG9iamVjdC5cbiAgICAgKiBAcGFyYW0gICBhICAgUG9pbnQgb2JqZWN0LlxuICAgICAqIEBwYXJhbSAgIGIgICBQb2ludCBvYmplY3QuXG4gICAgICogQHJldHVybiB0aGUgcmVzdWx0aW5nIFBvaW50IG9iamVjdC5cbiAgICAgKi9cbiAgICBQb2ludC5zdWIgPSBmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgIHJldHVybiBuZXcgUG9pbnQoYS54IC0gYi54LCBhLnkgLSBiLnkpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBNdWx0aXBseSBhIHBvaW50IGJ5IGEgc2NhbGFyIGFuZCByZXR1cm4gdGhlIHJlc3VsdCBhcyBhIG5ldyBQb2ludCBvYmplY3QuXG4gICAgICogQHBhcmFtICAgcyAgIHRoZSBzY2FsYXIgKGEgbnVtYmVyKS5cbiAgICAgKiBAcGFyYW0gICBwICAgUG9pbnQgb2JqZWN0LlxuICAgICAqIEByZXR1cm4gdGhlIHJlc3VsdGluZyBQb2ludCBvYmplY3QuXG4gICAgICovXG4gICAgUG9pbnQubXVsID0gZnVuY3Rpb24ocywgcCkge1xuICAgICAgICByZXR1cm4gbmV3IFBvaW50KHMgKiBwLngsIHMgKiBwLnkpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBQZXJmb3JtIHRoZSBjcm9zcyBwcm9kdWN0IG9uIGVpdGhlciB0d28gcG9pbnRzICh0aGlzIHByb2R1Y2VzIGEgc2NhbGFyKVxuICAgICAqIG9yIGEgcG9pbnQgYW5kIGEgc2NhbGFyICh0aGlzIHByb2R1Y2VzIGEgcG9pbnQpLlxuICAgICAqIFRoaXMgZnVuY3Rpb24gcmVxdWlyZXMgdHdvIHBhcmFtZXRlcnMsIGVpdGhlciBtYXkgYmUgYSBQb2ludCBvYmplY3Qgb3IgYVxuICAgICAqIG51bWJlci5cbiAgICAgKiBAcGFyYW0gICBhICAgUG9pbnQgb2JqZWN0IG9yIHNjYWxhci5cbiAgICAgKiBAcGFyYW0gICBiICAgUG9pbnQgb2JqZWN0IG9yIHNjYWxhci5cbiAgICAgKiBAcmV0dXJuICBhICAgUG9pbnQgb2JqZWN0IG9yIGEgbnVtYmVyLCBkZXBlbmRpbmcgb24gdGhlIHBhcmFtZXRlcnMuXG4gICAgICovXG4gICAgUG9pbnQuY3Jvc3MgPSBmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgIGlmICh0eXBlb2YoYSkgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mKGIpID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBhICogYjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBQb2ludCgtYSAqIGIueSwgYSAqIGIueCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mKGIpID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUG9pbnQoYiAqIGEueSwgLWIgKiBhLngpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYS54ICogYi55IC0gYS55ICogYi54O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVwiUG9pbnQtTGlrZVwiXG4gICAgLypcbiAgICAgKiBUaGUgZm9sbG93aW5nIGZ1bmN0aW9ucyBvcGVyYXRlIG9uIFwiUG9pbnRcIiBvciBhbnkgXCJQb2ludCBsaWtlXCIgb2JqZWN0IFxuICAgICAqIHdpdGgge3gseX0gKGR1Y2sgdHlwaW5nKS5cbiAgICAgKi9cblxuXG4gICAgLyoqXG4gICAgICogUG9pbnQgcHJldHR5IHByaW50aW5nIGV4LiA8aT5cIig1OzQyKVwiPC9pPilcbiAgICAgKiBAcGFyYW0gICBwICAgYW55IFwiUG9pbnQgbGlrZVwiIG9iamVjdCB3aXRoIHt4LHl9IFxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9XG4gICAgICovXG4gICAgUG9pbnQudG9TdHJpbmcgPSBmdW5jdGlvbihwKSB7XG4gICAgICAgIC8vIFRyeSBhIGN1c3RvbSB0b1N0cmluZyBmaXJzdCwgYW5kIGZhbGxiYWNrIHRvIFBvaW50LnByb3RvdHlwZS50b1N0cmluZyBpZiBub25lXG4gICAgICAgIHZhciBzID0gcC50b1N0cmluZygpO1xuICAgICAgICByZXR1cm4gKHMgPT09ICdbb2JqZWN0IE9iamVjdF0nID8gUG9pbnQucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwocCkgOiBzKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQ29tcGFyZSB0d28gcG9pbnRzIGNvbXBvbmVudC13aXNlLlxuICAgICAqIEBwYXJhbSAgIGEsYiAgIGFueSBcIlBvaW50IGxpa2VcIiBvYmplY3RzIHdpdGgge3gseX0gXG4gICAgICogQHJldHVybiA8Y29kZT4mbHQ7IDA8L2NvZGU+IGlmIDxjb2RlPmEgJmx0OyBiPC9jb2RlPiwgXG4gICAgICogICAgICAgICA8Y29kZT4mZ3Q7IDA8L2NvZGU+IGlmIDxjb2RlPmEgJmd0OyBiPC9jb2RlPiwgXG4gICAgICogICAgICAgICA8Y29kZT4wPC9jb2RlPiBvdGhlcndpc2UuXG4gICAgICovXG4gICAgUG9pbnQuY29tcGFyZSA9IGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgICAgaWYgKGEueSA9PT0gYi55KSB7XG4gICAgICAgICAgICByZXR1cm4gYS54IC0gYi54O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGEueSAtIGIueTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgUG9pbnQuY21wID0gUG9pbnQuY29tcGFyZTsgLy8gYmFja3dhcmQgY29tcGF0aWJpbGl0eVxuXG4gICAgLyoqXG4gICAgICogVGVzdCB0d28gUG9pbnQgb2JqZWN0cyBmb3IgZXF1YWxpdHkuXG4gICAgICogQHBhcmFtICAgYSxiICAgYW55IFwiUG9pbnQgbGlrZVwiIG9iamVjdHMgd2l0aCB7eCx5fSBcbiAgICAgKiBAcmV0dXJuIDxjb2RlPlRydWU8L2NvZGU+IGlmIDxjb2RlPmEgPT0gYjwvY29kZT4sIDxjb2RlPmZhbHNlPC9jb2RlPiBvdGhlcndpc2UuXG4gICAgICovXG4gICAgUG9pbnQuZXF1YWxzID0gZnVuY3Rpb24oYSwgYikge1xuICAgICAgICByZXR1cm4gYS54ID09PSBiLnggJiYgYS55ID09PSBiLnk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFBlZm9ybSB0aGUgZG90IHByb2R1Y3Qgb24gdHdvIHZlY3RvcnMuXG4gICAgICogQHBhcmFtICAgYSxiICAgYW55IFwiUG9pbnQgbGlrZVwiIG9iamVjdHMgd2l0aCB7eCx5fSBcbiAgICAgKiBAcmV0dXJuIFRoZSBkb3QgcHJvZHVjdCAoYXMgYSBudW1iZXIpLlxuICAgICAqL1xuICAgIFBvaW50LmRvdCA9IGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgICAgcmV0dXJuIGEueCAqIGIueCArIGEueSAqIGIueTtcbiAgICB9O1xuXG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1FZGdlXG4gICAgLyoqXG4gICAgICogUmVwcmVzZW50cyBhIHNpbXBsZSBwb2x5Z29uJ3MgZWRnZVxuICAgICAqIEBwYXJhbSB7UG9pbnR9IHAxXG4gICAgICogQHBhcmFtIHtQb2ludH0gcDJcbiAgICAgKi9cbiAgICB2YXIgRWRnZSA9IGZ1bmN0aW9uKHAxLCBwMikge1xuICAgICAgICB0aGlzLnAgPSBwMTtcbiAgICAgICAgdGhpcy5xID0gcDI7XG5cbiAgICAgICAgaWYgKHAxLnkgPiBwMi55KSB7XG4gICAgICAgICAgICB0aGlzLnEgPSBwMTtcbiAgICAgICAgICAgIHRoaXMucCA9IHAyO1xuICAgICAgICB9IGVsc2UgaWYgKHAxLnkgPT09IHAyLnkpIHtcbiAgICAgICAgICAgIGlmIChwMS54ID4gcDIueCkge1xuICAgICAgICAgICAgICAgIHRoaXMucSA9IHAxO1xuICAgICAgICAgICAgICAgIHRoaXMucCA9IHAyO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChwMS54ID09PSBwMi54KSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFBvaW50RXJyb3IoJ3BvbHkydHJpIEludmFsaWQgRWRnZSBjb25zdHJ1Y3RvcjogcmVwZWF0ZWQgcG9pbnRzIScsIFtwMV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCEgdGhpcy5xLl9wMnRfZWRnZV9saXN0KSB7XG4gICAgICAgICAgICB0aGlzLnEuX3AydF9lZGdlX2xpc3QgPSBbXTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnEuX3AydF9lZGdlX2xpc3QucHVzaCh0aGlzKTtcbiAgICB9O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1UcmlhbmdsZVxuICAgIC8qKlxuICAgICAqIFRyaWFuZ2xlIGNsYXNzLjxicj5cbiAgICAgKiBUcmlhbmdsZS1iYXNlZCBkYXRhIHN0cnVjdHVyZXMgYXJlIGtub3duIHRvIGhhdmUgYmV0dGVyIHBlcmZvcm1hbmNlIHRoYW5cbiAgICAgKiBxdWFkLWVkZ2Ugc3RydWN0dXJlcy5cbiAgICAgKiBTZWU6IEouIFNoZXdjaHVrLCBcIlRyaWFuZ2xlOiBFbmdpbmVlcmluZyBhIDJEIFF1YWxpdHkgTWVzaCBHZW5lcmF0b3IgYW5kXG4gICAgICogRGVsYXVuYXkgVHJpYW5ndWxhdG9yXCIsIFwiVHJpYW5ndWxhdGlvbnMgaW4gQ0dBTFwiXG4gICAgICogXG4gICAgICogQHBhcmFtICAgYSxiLGMgICBhbnkgXCJQb2ludCBsaWtlXCIgb2JqZWN0cyB3aXRoIHt4LHl9IChkdWNrIHR5cGluZylcbiAgICAgKi9cbiAgICB2YXIgVHJpYW5nbGUgPSBmdW5jdGlvbihhLCBiLCBjKSB7XG4gICAgICAgIC8vIFRyaWFuZ2xlIHBvaW50c1xuICAgICAgICB0aGlzLnBvaW50c18gPSBbYSwgYiwgY107XG4gICAgICAgIC8vIE5laWdoYm9yIGxpc3RcbiAgICAgICAgdGhpcy5uZWlnaGJvcnNfID0gW251bGwsIG51bGwsIG51bGxdO1xuICAgICAgICAvLyBIYXMgdGhpcyB0cmlhbmdsZSBiZWVuIG1hcmtlZCBhcyBhbiBpbnRlcmlvciB0cmlhbmdsZT9cbiAgICAgICAgdGhpcy5pbnRlcmlvcl8gPSBmYWxzZTtcbiAgICAgICAgLy8gRmxhZ3MgdG8gZGV0ZXJtaW5lIGlmIGFuIGVkZ2UgaXMgYSBDb25zdHJhaW5lZCBlZGdlXG4gICAgICAgIHRoaXMuY29uc3RyYWluZWRfZWRnZSA9IFtmYWxzZSwgZmFsc2UsIGZhbHNlXTtcbiAgICAgICAgLy8gRmxhZ3MgdG8gZGV0ZXJtaW5lIGlmIGFuIGVkZ2UgaXMgYSBEZWxhdW5leSBlZGdlXG4gICAgICAgIHRoaXMuZGVsYXVuYXlfZWRnZSA9IFtmYWxzZSwgZmFsc2UsIGZhbHNlXTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogRm9yIHByZXR0eSBwcmludGluZyBleC4gPGk+XCJbKDU7NDIpKDEwOzIwKSgyMTszMCldXCI8L2k+KVxuICAgICAqL1xuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgcDJzID0gUG9pbnQudG9TdHJpbmc7XG4gICAgICAgIHJldHVybiAoXCJbXCIgKyBwMnModGhpcy5wb2ludHNfWzBdKSArIHAycyh0aGlzLnBvaW50c19bMV0pICsgcDJzKHRoaXMucG9pbnRzX1syXSkgKyBcIl1cIik7XG4gICAgfTtcblxuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5nZXRQb2ludCA9IGZ1bmN0aW9uKGluZGV4KSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBvaW50c19baW5kZXhdO1xuICAgIH07XG4gICAgLy8gZm9yIGJhY2t3YXJkIGNvbXBhdGliaWxpdHlcbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuR2V0UG9pbnQgPSBUcmlhbmdsZS5wcm90b3R5cGUuZ2V0UG9pbnQ7XG5cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuZ2V0TmVpZ2hib3IgPSBmdW5jdGlvbihpbmRleCkge1xuICAgICAgICByZXR1cm4gdGhpcy5uZWlnaGJvcnNfW2luZGV4XTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogVGVzdCBpZiB0aGlzIFRyaWFuZ2xlIGNvbnRhaW5zIHRoZSBQb2ludCBvYmplY3QgZ2l2ZW4gYXMgcGFyYW1ldGVycyBhcyBpdHNcbiAgICAgKiB2ZXJ0aWNlcy4gT25seSBwb2ludCByZWZlcmVuY2VzIGFyZSBjb21wYXJlZCwgbm90IHZhbHVlcy5cbiAgICAgKiBAcmV0dXJuIDxjb2RlPlRydWU8L2NvZGU+IGlmIHRoZSBQb2ludCBvYmplY3QgaXMgb2YgdGhlIFRyaWFuZ2xlJ3MgdmVydGljZXMsXG4gICAgICogICAgICAgICA8Y29kZT5mYWxzZTwvY29kZT4gb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5jb250YWluc1BvaW50ID0gZnVuY3Rpb24ocG9pbnQpIHtcbiAgICAgICAgdmFyIHBvaW50cyA9IHRoaXMucG9pbnRzXztcbiAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcbiAgICAgICAgcmV0dXJuIChwb2ludCA9PT0gcG9pbnRzWzBdIHx8IHBvaW50ID09PSBwb2ludHNbMV0gfHwgcG9pbnQgPT09IHBvaW50c1syXSk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFRlc3QgaWYgdGhpcyBUcmlhbmdsZSBjb250YWlucyB0aGUgRWRnZSBvYmplY3QgZ2l2ZW4gYXMgcGFyYW1ldGVyIGFzIGl0c1xuICAgICAqIGJvdW5kaW5nIGVkZ2VzLiBPbmx5IHBvaW50IHJlZmVyZW5jZXMgYXJlIGNvbXBhcmVkLCBub3QgdmFsdWVzLlxuICAgICAqIEByZXR1cm4gPGNvZGU+VHJ1ZTwvY29kZT4gaWYgdGhlIEVkZ2Ugb2JqZWN0IGlzIG9mIHRoZSBUcmlhbmdsZSdzIGJvdW5kaW5nXG4gICAgICogICAgICAgICBlZGdlcywgPGNvZGU+ZmFsc2U8L2NvZGU+IG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuY29udGFpbnNFZGdlID0gZnVuY3Rpb24oZWRnZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5jb250YWluc1BvaW50KGVkZ2UucCkgJiYgdGhpcy5jb250YWluc1BvaW50KGVkZ2UucSk7XG4gICAgfTtcbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuY29udGFpbnNQb2ludHMgPSBmdW5jdGlvbihwMSwgcDIpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29udGFpbnNQb2ludChwMSkgJiYgdGhpcy5jb250YWluc1BvaW50KHAyKTtcbiAgICB9O1xuXG5cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuaXNJbnRlcmlvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5pbnRlcmlvcl87XG4gICAgfTtcbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuc2V0SW50ZXJpb3IgPSBmdW5jdGlvbihpbnRlcmlvcikge1xuICAgICAgICB0aGlzLmludGVyaW9yXyA9IGludGVyaW9yO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogVXBkYXRlIG5laWdoYm9yIHBvaW50ZXJzLlxuICAgICAqIEBwYXJhbSB7UG9pbnR9IHAxIFBvaW50IG9iamVjdC5cbiAgICAgKiBAcGFyYW0ge1BvaW50fSBwMiBQb2ludCBvYmplY3QuXG4gICAgICogQHBhcmFtIHtUcmlhbmdsZX0gdCBUcmlhbmdsZSBvYmplY3QuXG4gICAgICovXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLm1hcmtOZWlnaGJvclBvaW50ZXJzID0gZnVuY3Rpb24ocDEsIHAyLCB0KSB7XG4gICAgICAgIHZhciBwb2ludHMgPSB0aGlzLnBvaW50c187XG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXG4gICAgICAgIGlmICgocDEgPT09IHBvaW50c1syXSAmJiBwMiA9PT0gcG9pbnRzWzFdKSB8fCAocDEgPT09IHBvaW50c1sxXSAmJiBwMiA9PT0gcG9pbnRzWzJdKSkge1xuICAgICAgICAgICAgdGhpcy5uZWlnaGJvcnNfWzBdID0gdDtcbiAgICAgICAgfSBlbHNlIGlmICgocDEgPT09IHBvaW50c1swXSAmJiBwMiA9PT0gcG9pbnRzWzJdKSB8fCAocDEgPT09IHBvaW50c1syXSAmJiBwMiA9PT0gcG9pbnRzWzBdKSkge1xuICAgICAgICAgICAgdGhpcy5uZWlnaGJvcnNfWzFdID0gdDtcbiAgICAgICAgfSBlbHNlIGlmICgocDEgPT09IHBvaW50c1swXSAmJiBwMiA9PT0gcG9pbnRzWzFdKSB8fCAocDEgPT09IHBvaW50c1sxXSAmJiBwMiA9PT0gcG9pbnRzWzBdKSkge1xuICAgICAgICAgICAgdGhpcy5uZWlnaGJvcnNfWzJdID0gdDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigncG9seTJ0cmkgSW52YWxpZCBUcmlhbmdsZS5tYXJrTmVpZ2hib3JQb2ludGVycygpIGNhbGwnKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBFeGhhdXN0aXZlIHNlYXJjaCB0byB1cGRhdGUgbmVpZ2hib3IgcG9pbnRlcnNcbiAgICAgKiBAcGFyYW0ge1RyaWFuZ2xlfSB0XG4gICAgICovXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLm1hcmtOZWlnaGJvciA9IGZ1bmN0aW9uKHQpIHtcbiAgICAgICAgdmFyIHBvaW50cyA9IHRoaXMucG9pbnRzXztcbiAgICAgICAgaWYgKHQuY29udGFpbnNQb2ludHMocG9pbnRzWzFdLCBwb2ludHNbMl0pKSB7XG4gICAgICAgICAgICB0aGlzLm5laWdoYm9yc19bMF0gPSB0O1xuICAgICAgICAgICAgdC5tYXJrTmVpZ2hib3JQb2ludGVycyhwb2ludHNbMV0sIHBvaW50c1syXSwgdGhpcyk7XG4gICAgICAgIH0gZWxzZSBpZiAodC5jb250YWluc1BvaW50cyhwb2ludHNbMF0sIHBvaW50c1syXSkpIHtcbiAgICAgICAgICAgIHRoaXMubmVpZ2hib3JzX1sxXSA9IHQ7XG4gICAgICAgICAgICB0Lm1hcmtOZWlnaGJvclBvaW50ZXJzKHBvaW50c1swXSwgcG9pbnRzWzJdLCB0aGlzKTtcbiAgICAgICAgfSBlbHNlIGlmICh0LmNvbnRhaW5zUG9pbnRzKHBvaW50c1swXSwgcG9pbnRzWzFdKSkge1xuICAgICAgICAgICAgdGhpcy5uZWlnaGJvcnNfWzJdID0gdDtcbiAgICAgICAgICAgIHQubWFya05laWdoYm9yUG9pbnRlcnMocG9pbnRzWzBdLCBwb2ludHNbMV0sIHRoaXMpO1xuICAgICAgICB9XG4gICAgfTtcblxuXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLmNsZWFyTmVpZ2JvcnMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5uZWlnaGJvcnNfWzBdID0gbnVsbDtcbiAgICAgICAgdGhpcy5uZWlnaGJvcnNfWzFdID0gbnVsbDtcbiAgICAgICAgdGhpcy5uZWlnaGJvcnNfWzJdID0gbnVsbDtcbiAgICB9O1xuXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLmNsZWFyRGVsdW5heUVkZ2VzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuZGVsYXVuYXlfZWRnZVswXSA9IGZhbHNlO1xuICAgICAgICB0aGlzLmRlbGF1bmF5X2VkZ2VbMV0gPSBmYWxzZTtcbiAgICAgICAgdGhpcy5kZWxhdW5heV9lZGdlWzJdID0gZmFsc2U7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIHBvaW50IGNsb2Nrd2lzZSB0byB0aGUgZ2l2ZW4gcG9pbnQuXG4gICAgICovXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLnBvaW50Q1cgPSBmdW5jdGlvbihwKSB7XG4gICAgICAgIHZhciBwb2ludHMgPSB0aGlzLnBvaW50c187XG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXG4gICAgICAgIGlmIChwID09PSBwb2ludHNbMF0pIHtcbiAgICAgICAgICAgIHJldHVybiBwb2ludHNbMl07XG4gICAgICAgIH0gZWxzZSBpZiAocCA9PT0gcG9pbnRzWzFdKSB7XG4gICAgICAgICAgICByZXR1cm4gcG9pbnRzWzBdO1xuICAgICAgICB9IGVsc2UgaWYgKHAgPT09IHBvaW50c1syXSkge1xuICAgICAgICAgICAgcmV0dXJuIHBvaW50c1sxXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIHBvaW50IGNvdW50ZXItY2xvY2t3aXNlIHRvIHRoZSBnaXZlbiBwb2ludC5cbiAgICAgKi9cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUucG9pbnRDQ1cgPSBmdW5jdGlvbihwKSB7XG4gICAgICAgIHZhciBwb2ludHMgPSB0aGlzLnBvaW50c187XG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXG4gICAgICAgIGlmIChwID09PSBwb2ludHNbMF0pIHtcbiAgICAgICAgICAgIHJldHVybiBwb2ludHNbMV07XG4gICAgICAgIH0gZWxzZSBpZiAocCA9PT0gcG9pbnRzWzFdKSB7XG4gICAgICAgICAgICByZXR1cm4gcG9pbnRzWzJdO1xuICAgICAgICB9IGVsc2UgaWYgKHAgPT09IHBvaW50c1syXSkge1xuICAgICAgICAgICAgcmV0dXJuIHBvaW50c1swXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIG5laWdoYm9yIGNsb2Nrd2lzZSB0byBnaXZlbiBwb2ludC5cbiAgICAgKi9cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUubmVpZ2hib3JDVyA9IGZ1bmN0aW9uKHApIHtcbiAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcbiAgICAgICAgaWYgKHAgPT09IHRoaXMucG9pbnRzX1swXSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubmVpZ2hib3JzX1sxXTtcbiAgICAgICAgfSBlbHNlIGlmIChwID09PSB0aGlzLnBvaW50c19bMV0pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm5laWdoYm9yc19bMl07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5uZWlnaGJvcnNfWzBdO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIG5laWdoYm9yIGNvdW50ZXItY2xvY2t3aXNlIHRvIGdpdmVuIHBvaW50LlxuICAgICAqL1xuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5uZWlnaGJvckNDVyA9IGZ1bmN0aW9uKHApIHtcbiAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcbiAgICAgICAgaWYgKHAgPT09IHRoaXMucG9pbnRzX1swXSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubmVpZ2hib3JzX1syXTtcbiAgICAgICAgfSBlbHNlIGlmIChwID09PSB0aGlzLnBvaW50c19bMV0pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm5laWdoYm9yc19bMF07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5uZWlnaGJvcnNfWzFdO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5nZXRDb25zdHJhaW5lZEVkZ2VDVyA9IGZ1bmN0aW9uKHApIHtcbiAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcbiAgICAgICAgaWYgKHAgPT09IHRoaXMucG9pbnRzX1swXSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29uc3RyYWluZWRfZWRnZVsxXTtcbiAgICAgICAgfSBlbHNlIGlmIChwID09PSB0aGlzLnBvaW50c19bMV0pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbMl07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jb25zdHJhaW5lZF9lZGdlWzBdO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5nZXRDb25zdHJhaW5lZEVkZ2VDQ1cgPSBmdW5jdGlvbihwKSB7XG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXG4gICAgICAgIGlmIChwID09PSB0aGlzLnBvaW50c19bMF0pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbMl07XG4gICAgICAgIH0gZWxzZSBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzFdKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jb25zdHJhaW5lZF9lZGdlWzBdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29uc3RyYWluZWRfZWRnZVsxXTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuc2V0Q29uc3RyYWluZWRFZGdlQ1cgPSBmdW5jdGlvbihwLCBjZSkge1xuICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlc1xuICAgICAgICBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzBdKSB7XG4gICAgICAgICAgICB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbMV0gPSBjZTtcbiAgICAgICAgfSBlbHNlIGlmIChwID09PSB0aGlzLnBvaW50c19bMV0pIHtcbiAgICAgICAgICAgIHRoaXMuY29uc3RyYWluZWRfZWRnZVsyXSA9IGNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5jb25zdHJhaW5lZF9lZGdlWzBdID0gY2U7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLnNldENvbnN0cmFpbmVkRWRnZUNDVyA9IGZ1bmN0aW9uKHAsIGNlKSB7XG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXG4gICAgICAgIGlmIChwID09PSB0aGlzLnBvaW50c19bMF0pIHtcbiAgICAgICAgICAgIHRoaXMuY29uc3RyYWluZWRfZWRnZVsyXSA9IGNlO1xuICAgICAgICB9IGVsc2UgaWYgKHAgPT09IHRoaXMucG9pbnRzX1sxXSkge1xuICAgICAgICAgICAgdGhpcy5jb25zdHJhaW5lZF9lZGdlWzBdID0gY2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbMV0gPSBjZTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuZ2V0RGVsYXVuYXlFZGdlQ1cgPSBmdW5jdGlvbihwKSB7XG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXG4gICAgICAgIGlmIChwID09PSB0aGlzLnBvaW50c19bMF0pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmRlbGF1bmF5X2VkZ2VbMV07XG4gICAgICAgIH0gZWxzZSBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzFdKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5kZWxhdW5heV9lZGdlWzJdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGVsYXVuYXlfZWRnZVswXTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuZ2V0RGVsYXVuYXlFZGdlQ0NXID0gZnVuY3Rpb24ocCkge1xuICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlc1xuICAgICAgICBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzBdKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5kZWxhdW5heV9lZGdlWzJdO1xuICAgICAgICB9IGVsc2UgaWYgKHAgPT09IHRoaXMucG9pbnRzX1sxXSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGVsYXVuYXlfZWRnZVswXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmRlbGF1bmF5X2VkZ2VbMV07XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLnNldERlbGF1bmF5RWRnZUNXID0gZnVuY3Rpb24ocCwgZSkge1xuICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlc1xuICAgICAgICBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzBdKSB7XG4gICAgICAgICAgICB0aGlzLmRlbGF1bmF5X2VkZ2VbMV0gPSBlO1xuICAgICAgICB9IGVsc2UgaWYgKHAgPT09IHRoaXMucG9pbnRzX1sxXSkge1xuICAgICAgICAgICAgdGhpcy5kZWxhdW5heV9lZGdlWzJdID0gZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZGVsYXVuYXlfZWRnZVswXSA9IGU7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLnNldERlbGF1bmF5RWRnZUNDVyA9IGZ1bmN0aW9uKHAsIGUpIHtcbiAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcbiAgICAgICAgaWYgKHAgPT09IHRoaXMucG9pbnRzX1swXSkge1xuICAgICAgICAgICAgdGhpcy5kZWxhdW5heV9lZGdlWzJdID0gZTtcbiAgICAgICAgfSBlbHNlIGlmIChwID09PSB0aGlzLnBvaW50c19bMV0pIHtcbiAgICAgICAgICAgIHRoaXMuZGVsYXVuYXlfZWRnZVswXSA9IGU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmRlbGF1bmF5X2VkZ2VbMV0gPSBlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBuZWlnaGJvciBhY3Jvc3MgdG8gZ2l2ZW4gcG9pbnQuXG4gICAgICovXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLm5laWdoYm9yQWNyb3NzID0gZnVuY3Rpb24ocCkge1xuICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlc1xuICAgICAgICBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzBdKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5uZWlnaGJvcnNfWzBdO1xuICAgICAgICB9IGVsc2UgaWYgKHAgPT09IHRoaXMucG9pbnRzX1sxXSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubmVpZ2hib3JzX1sxXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm5laWdoYm9yc19bMl07XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLm9wcG9zaXRlUG9pbnQgPSBmdW5jdGlvbih0LCBwKSB7XG4gICAgICAgIHZhciBjdyA9IHQucG9pbnRDVyhwKTtcbiAgICAgICAgcmV0dXJuIHRoaXMucG9pbnRDVyhjdyk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIExlZ2FsaXplIHRyaWFuZ2xlIGJ5IHJvdGF0aW5nIGNsb2Nrd2lzZSBhcm91bmQgb1BvaW50XG4gICAgICogQHBhcmFtIHtQb2ludH0gb3BvaW50XG4gICAgICogQHBhcmFtIHtQb2ludH0gbnBvaW50XG4gICAgICovXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLmxlZ2FsaXplID0gZnVuY3Rpb24ob3BvaW50LCBucG9pbnQpIHtcbiAgICAgICAgdmFyIHBvaW50cyA9IHRoaXMucG9pbnRzXztcbiAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcbiAgICAgICAgaWYgKG9wb2ludCA9PT0gcG9pbnRzWzBdKSB7XG4gICAgICAgICAgICBwb2ludHNbMV0gPSBwb2ludHNbMF07XG4gICAgICAgICAgICBwb2ludHNbMF0gPSBwb2ludHNbMl07XG4gICAgICAgICAgICBwb2ludHNbMl0gPSBucG9pbnQ7XG4gICAgICAgIH0gZWxzZSBpZiAob3BvaW50ID09PSBwb2ludHNbMV0pIHtcbiAgICAgICAgICAgIHBvaW50c1syXSA9IHBvaW50c1sxXTtcbiAgICAgICAgICAgIHBvaW50c1sxXSA9IHBvaW50c1swXTtcbiAgICAgICAgICAgIHBvaW50c1swXSA9IG5wb2ludDtcbiAgICAgICAgfSBlbHNlIGlmIChvcG9pbnQgPT09IHBvaW50c1syXSkge1xuICAgICAgICAgICAgcG9pbnRzWzBdID0gcG9pbnRzWzJdO1xuICAgICAgICAgICAgcG9pbnRzWzJdID0gcG9pbnRzWzFdO1xuICAgICAgICAgICAgcG9pbnRzWzFdID0gbnBvaW50O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdwb2x5MnRyaSBJbnZhbGlkIFRyaWFuZ2xlLmxlZ2FsaXplKCkgY2FsbCcpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIGluZGV4IG9mIGEgcG9pbnQgaW4gdGhlIHRyaWFuZ2xlLiBcbiAgICAgKiBUaGUgcG9pbnQgKm11c3QqIGJlIGEgcmVmZXJlbmNlIHRvIG9uZSBvZiB0aGUgdHJpYW5nbGUncyB2ZXJ0aWNlcy5cbiAgICAgKiBAcGFyYW0ge1BvaW50fSBwIFBvaW50IG9iamVjdFxuICAgICAqIEByZXR1cm5zIHtOdW1iZXJ9IGluZGV4IDAsIDEgb3IgMlxuICAgICAqL1xuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5pbmRleCA9IGZ1bmN0aW9uKHApIHtcbiAgICAgICAgdmFyIHBvaW50cyA9IHRoaXMucG9pbnRzXztcbiAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcbiAgICAgICAgaWYgKHAgPT09IHBvaW50c1swXSkge1xuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIH0gZWxzZSBpZiAocCA9PT0gcG9pbnRzWzFdKSB7XG4gICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfSBlbHNlIGlmIChwID09PSBwb2ludHNbMl0pIHtcbiAgICAgICAgICAgIHJldHVybiAyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdwb2x5MnRyaSBJbnZhbGlkIFRyaWFuZ2xlLmluZGV4KCkgY2FsbCcpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5lZGdlSW5kZXggPSBmdW5jdGlvbihwMSwgcDIpIHtcbiAgICAgICAgdmFyIHBvaW50cyA9IHRoaXMucG9pbnRzXztcbiAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcbiAgICAgICAgaWYgKHAxID09PSBwb2ludHNbMF0pIHtcbiAgICAgICAgICAgIGlmIChwMiA9PT0gcG9pbnRzWzFdKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIDI7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHAyID09PSBwb2ludHNbMl0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChwMSA9PT0gcG9pbnRzWzFdKSB7XG4gICAgICAgICAgICBpZiAocDIgPT09IHBvaW50c1syXSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChwMiA9PT0gcG9pbnRzWzBdKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIDI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAocDEgPT09IHBvaW50c1syXSkge1xuICAgICAgICAgICAgaWYgKHAyID09PSBwb2ludHNbMF0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocDIgPT09IHBvaW50c1sxXSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiAtMTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogTWFyayBhbiBlZGdlIG9mIHRoaXMgdHJpYW5nbGUgYXMgY29uc3RyYWluZWQuPGJyPlxuICAgICAqIFRoaXMgbWV0aG9kIHRha2VzIGVpdGhlciAxIHBhcmFtZXRlciAoYW4gZWRnZSBpbmRleCBvciBhbiBFZGdlIGluc3RhbmNlKSBvclxuICAgICAqIDIgcGFyYW1ldGVycyAodHdvIFBvaW50IGluc3RhbmNlcyBkZWZpbmluZyB0aGUgZWRnZSBvZiB0aGUgdHJpYW5nbGUpLlxuICAgICAqL1xuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5tYXJrQ29uc3RyYWluZWRFZGdlQnlJbmRleCA9IGZ1bmN0aW9uKGluZGV4KSB7XG4gICAgICAgIHRoaXMuY29uc3RyYWluZWRfZWRnZVtpbmRleF0gPSB0cnVlO1xuICAgIH07XG4gICAgVHJpYW5nbGUucHJvdG90eXBlLm1hcmtDb25zdHJhaW5lZEVkZ2VCeUVkZ2UgPSBmdW5jdGlvbihlZGdlKSB7XG4gICAgICAgIHRoaXMubWFya0NvbnN0cmFpbmVkRWRnZUJ5UG9pbnRzKGVkZ2UucCwgZWRnZS5xKTtcbiAgICB9O1xuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5tYXJrQ29uc3RyYWluZWRFZGdlQnlQb2ludHMgPSBmdW5jdGlvbihwLCBxKSB7XG4gICAgICAgIHZhciBwb2ludHMgPSB0aGlzLnBvaW50c187XG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzICAgICAgICBcbiAgICAgICAgaWYgKChxID09PSBwb2ludHNbMF0gJiYgcCA9PT0gcG9pbnRzWzFdKSB8fCAocSA9PT0gcG9pbnRzWzFdICYmIHAgPT09IHBvaW50c1swXSkpIHtcbiAgICAgICAgICAgIHRoaXMuY29uc3RyYWluZWRfZWRnZVsyXSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSBpZiAoKHEgPT09IHBvaW50c1swXSAmJiBwID09PSBwb2ludHNbMl0pIHx8IChxID09PSBwb2ludHNbMl0gJiYgcCA9PT0gcG9pbnRzWzBdKSkge1xuICAgICAgICAgICAgdGhpcy5jb25zdHJhaW5lZF9lZGdlWzFdID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIGlmICgocSA9PT0gcG9pbnRzWzFdICYmIHAgPT09IHBvaW50c1syXSkgfHwgKHEgPT09IHBvaW50c1syXSAmJiBwID09PSBwb2ludHNbMV0pKSB7XG4gICAgICAgICAgICB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbMF0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgfTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tdXRpbHNcbiAgICB2YXIgUElfM2RpdjQgPSAzICogTWF0aC5QSSAvIDQ7XG4gICAgdmFyIFBJXzIgPSBNYXRoLlBJIC8gMjtcbiAgICB2YXIgRVBTSUxPTiA9IDFlLTEyO1xuXG4gICAgLyogXG4gICAgICogSW5pdGFsIHRyaWFuZ2xlIGZhY3Rvciwgc2VlZCB0cmlhbmdsZSB3aWxsIGV4dGVuZCAzMCUgb2ZcbiAgICAgKiBQb2ludFNldCB3aWR0aCB0byBib3RoIGxlZnQgYW5kIHJpZ2h0LlxuICAgICAqL1xuICAgIHZhciBrQWxwaGEgPSAwLjM7XG5cbiAgICB2YXIgT3JpZW50YXRpb24gPSB7XG4gICAgICAgIFwiQ1dcIjogMSxcbiAgICAgICAgXCJDQ1dcIjogLTEsXG4gICAgICAgIFwiQ09MTElORUFSXCI6IDBcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogRm9ydW1sYSB0byBjYWxjdWxhdGUgc2lnbmVkIGFyZWE8YnI+XG4gICAgICogUG9zaXRpdmUgaWYgQ0NXPGJyPlxuICAgICAqIE5lZ2F0aXZlIGlmIENXPGJyPlxuICAgICAqIDAgaWYgY29sbGluZWFyPGJyPlxuICAgICAqIDxwcmU+XG4gICAgICogQVtQMSxQMixQM10gID0gICh4MSp5MiAtIHkxKngyKSArICh4Mip5MyAtIHkyKngzKSArICh4Myp5MSAtIHkzKngxKVxuICAgICAqICAgICAgICAgICAgICA9ICAoeDEteDMpKih5Mi15MykgLSAoeTEteTMpKih4Mi14MylcbiAgICAgKiA8L3ByZT5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBvcmllbnQyZChwYSwgcGIsIHBjKSB7XG4gICAgICAgIHZhciBkZXRsZWZ0ID0gKHBhLnggLSBwYy54KSAqIChwYi55IC0gcGMueSk7XG4gICAgICAgIHZhciBkZXRyaWdodCA9IChwYS55IC0gcGMueSkgKiAocGIueCAtIHBjLngpO1xuICAgICAgICB2YXIgdmFsID0gZGV0bGVmdCAtIGRldHJpZ2h0O1xuICAgICAgICBpZiAodmFsID4gLShFUFNJTE9OKSAmJiB2YWwgPCAoRVBTSUxPTikpIHtcbiAgICAgICAgICAgIHJldHVybiBPcmllbnRhdGlvbi5DT0xMSU5FQVI7XG4gICAgICAgIH0gZWxzZSBpZiAodmFsID4gMCkge1xuICAgICAgICAgICAgcmV0dXJuIE9yaWVudGF0aW9uLkNDVztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBPcmllbnRhdGlvbi5DVztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGluU2NhbkFyZWEocGEsIHBiLCBwYywgcGQpIHtcbiAgICAgICAgdmFyIHBkeCA9IHBkLng7XG4gICAgICAgIHZhciBwZHkgPSBwZC55O1xuICAgICAgICB2YXIgYWR4ID0gcGEueCAtIHBkeDtcbiAgICAgICAgdmFyIGFkeSA9IHBhLnkgLSBwZHk7XG4gICAgICAgIHZhciBiZHggPSBwYi54IC0gcGR4O1xuICAgICAgICB2YXIgYmR5ID0gcGIueSAtIHBkeTtcblxuICAgICAgICB2YXIgYWR4YmR5ID0gYWR4ICogYmR5O1xuICAgICAgICB2YXIgYmR4YWR5ID0gYmR4ICogYWR5O1xuICAgICAgICB2YXIgb2FiZCA9IGFkeGJkeSAtIGJkeGFkeTtcblxuICAgICAgICBpZiAob2FiZCA8PSAoRVBTSUxPTikpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBjZHggPSBwYy54IC0gcGR4O1xuICAgICAgICB2YXIgY2R5ID0gcGMueSAtIHBkeTtcblxuICAgICAgICB2YXIgY2R4YWR5ID0gY2R4ICogYWR5O1xuICAgICAgICB2YXIgYWR4Y2R5ID0gYWR4ICogY2R5O1xuICAgICAgICB2YXIgb2NhZCA9IGNkeGFkeSAtIGFkeGNkeTtcblxuICAgICAgICBpZiAob2NhZCA8PSAoRVBTSUxPTikpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tQWR2YW5jaW5nRnJvbnRcbiAgICAvKipcbiAgICAgKiBBZHZhbmNpbmcgZnJvbnQgbm9kZVxuICAgICAqIEBwYXJhbSB7UG9pbnR9IHAgYW55IFwiUG9pbnQgbGlrZVwiIG9iamVjdCB3aXRoIHt4LHl9IChkdWNrIHR5cGluZylcbiAgICAgKiBAcGFyYW0ge1RyaWFuZ2xlfSB0IHRyaWFuZ2xlIChvcHRpb25uYWwpXG4gICAgICovXG4gICAgdmFyIE5vZGUgPSBmdW5jdGlvbihwLCB0KSB7XG4gICAgICAgIHRoaXMucG9pbnQgPSBwO1xuICAgICAgICB0aGlzLnRyaWFuZ2xlID0gdCB8fCBudWxsO1xuXG4gICAgICAgIHRoaXMubmV4dCA9IG51bGw7IC8vIE5vZGVcbiAgICAgICAgdGhpcy5wcmV2ID0gbnVsbDsgLy8gTm9kZVxuXG4gICAgICAgIHRoaXMudmFsdWUgPSBwLng7XG4gICAgfTtcblxuICAgIHZhciBBZHZhbmNpbmdGcm9udCA9IGZ1bmN0aW9uKGhlYWQsIHRhaWwpIHtcbiAgICAgICAgdGhpcy5oZWFkXyA9IGhlYWQ7IC8vIE5vZGVcbiAgICAgICAgdGhpcy50YWlsXyA9IHRhaWw7IC8vIE5vZGVcbiAgICAgICAgdGhpcy5zZWFyY2hfbm9kZV8gPSBoZWFkOyAvLyBOb2RlXG4gICAgfTtcblxuICAgIEFkdmFuY2luZ0Zyb250LnByb3RvdHlwZS5oZWFkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmhlYWRfO1xuICAgIH07XG5cbiAgICBBZHZhbmNpbmdGcm9udC5wcm90b3R5cGUuc2V0SGVhZCA9IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICAgICAgdGhpcy5oZWFkXyA9IG5vZGU7XG4gICAgfTtcblxuICAgIEFkdmFuY2luZ0Zyb250LnByb3RvdHlwZS50YWlsID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRhaWxfO1xuICAgIH07XG5cbiAgICBBZHZhbmNpbmdGcm9udC5wcm90b3R5cGUuc2V0VGFpbCA9IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICAgICAgdGhpcy50YWlsXyA9IG5vZGU7XG4gICAgfTtcblxuICAgIEFkdmFuY2luZ0Zyb250LnByb3RvdHlwZS5zZWFyY2ggPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2VhcmNoX25vZGVfO1xuICAgIH07XG5cbiAgICBBZHZhbmNpbmdGcm9udC5wcm90b3R5cGUuc2V0U2VhcmNoID0gZnVuY3Rpb24obm9kZSkge1xuICAgICAgICB0aGlzLnNlYXJjaF9ub2RlXyA9IG5vZGU7XG4gICAgfTtcblxuICAgIEFkdmFuY2luZ0Zyb250LnByb3RvdHlwZS5maW5kU2VhcmNoTm9kZSA9IGZ1bmN0aW9uKC8qeCovKSB7XG4gICAgICAgIC8vIFRPRE86IGltcGxlbWVudCBCU1QgaW5kZXhcbiAgICAgICAgcmV0dXJuIHRoaXMuc2VhcmNoX25vZGVfO1xuICAgIH07XG5cbiAgICBBZHZhbmNpbmdGcm9udC5wcm90b3R5cGUubG9jYXRlTm9kZSA9IGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgdmFyIG5vZGUgPSB0aGlzLnNlYXJjaF9ub2RlXztcblxuICAgICAgICAvKiBqc2hpbnQgYm9zczp0cnVlICovXG4gICAgICAgIGlmICh4IDwgbm9kZS52YWx1ZSkge1xuICAgICAgICAgICAgd2hpbGUgKG5vZGUgPSBub2RlLnByZXYpIHtcbiAgICAgICAgICAgICAgICBpZiAoeCA+PSBub2RlLnZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2VhcmNoX25vZGVfID0gbm9kZTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgd2hpbGUgKG5vZGUgPSBub2RlLm5leHQpIHtcbiAgICAgICAgICAgICAgICBpZiAoeCA8IG5vZGUudmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZWFyY2hfbm9kZV8gPSBub2RlLnByZXY7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBub2RlLnByZXY7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH07XG5cbiAgICBBZHZhbmNpbmdGcm9udC5wcm90b3R5cGUubG9jYXRlUG9pbnQgPSBmdW5jdGlvbihwb2ludCkge1xuICAgICAgICB2YXIgcHggPSBwb2ludC54O1xuICAgICAgICB2YXIgbm9kZSA9IHRoaXMuZmluZFNlYXJjaE5vZGUocHgpO1xuICAgICAgICB2YXIgbnggPSBub2RlLnBvaW50Lng7XG5cbiAgICAgICAgaWYgKHB4ID09PSBueCkge1xuICAgICAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcbiAgICAgICAgICAgIGlmIChwb2ludCAhPT0gbm9kZS5wb2ludCkge1xuICAgICAgICAgICAgICAgIC8vIFdlIG1pZ2h0IGhhdmUgdHdvIG5vZGVzIHdpdGggc2FtZSB4IHZhbHVlIGZvciBhIHNob3J0IHRpbWVcbiAgICAgICAgICAgICAgICBpZiAocG9pbnQgPT09IG5vZGUucHJldi5wb2ludCkge1xuICAgICAgICAgICAgICAgICAgICBub2RlID0gbm9kZS5wcmV2O1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAocG9pbnQgPT09IG5vZGUubmV4dC5wb2ludCkge1xuICAgICAgICAgICAgICAgICAgICBub2RlID0gbm9kZS5uZXh0O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigncG9seTJ0cmkgSW52YWxpZCBBZHZhbmNpbmdGcm9udC5sb2NhdGVQb2ludCgpIGNhbGwnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAocHggPCBueCkge1xuICAgICAgICAgICAgLyoganNoaW50IGJvc3M6dHJ1ZSAqL1xuICAgICAgICAgICAgd2hpbGUgKG5vZGUgPSBub2RlLnByZXYpIHtcbiAgICAgICAgICAgICAgICBpZiAocG9pbnQgPT09IG5vZGUucG9pbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgd2hpbGUgKG5vZGUgPSBub2RlLm5leHQpIHtcbiAgICAgICAgICAgICAgICBpZiAocG9pbnQgPT09IG5vZGUucG9pbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5vZGUpIHtcbiAgICAgICAgICAgIHRoaXMuc2VhcmNoX25vZGVfID0gbm9kZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbm9kZTtcbiAgICB9O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1CYXNpblxuICAgIHZhciBCYXNpbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmxlZnRfbm9kZSA9IG51bGw7IC8vIE5vZGVcbiAgICAgICAgdGhpcy5ib3R0b21fbm9kZSA9IG51bGw7IC8vIE5vZGVcbiAgICAgICAgdGhpcy5yaWdodF9ub2RlID0gbnVsbDsgLy8gTm9kZVxuICAgICAgICB0aGlzLndpZHRoID0gMC4wOyAvLyBudW1iZXJcbiAgICAgICAgdGhpcy5sZWZ0X2hpZ2hlc3QgPSBmYWxzZTtcbiAgICB9O1xuXG4gICAgQmFzaW4ucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMubGVmdF9ub2RlID0gbnVsbDtcbiAgICAgICAgdGhpcy5ib3R0b21fbm9kZSA9IG51bGw7XG4gICAgICAgIHRoaXMucmlnaHRfbm9kZSA9IG51bGw7XG4gICAgICAgIHRoaXMud2lkdGggPSAwLjA7XG4gICAgICAgIHRoaXMubGVmdF9oaWdoZXN0ID0gZmFsc2U7XG4gICAgfTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1FZGdlRXZlbnRcbiAgICB2YXIgRWRnZUV2ZW50ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuY29uc3RyYWluZWRfZWRnZSA9IG51bGw7IC8vIEVkZ2VcbiAgICAgICAgdGhpcy5yaWdodCA9IGZhbHNlO1xuICAgIH07XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1Td2VlcENvbnRleHQgKHB1YmxpYyBBUEkpXG4gICAgLyoqXG4gICAgICogQ29uc3RydWN0b3IgZm9yIHRoZSB0cmlhbmd1bGF0aW9uIGNvbnRleHQuXG4gICAgICogSXQgYWNjZXB0cyBhIHNpbXBsZSBwb2x5bGluZSwgd2hpY2ggZGVmaW5lcyB0aGUgY29uc3RyYWluZWQgZWRnZXMuXG4gICAgICogUG9zc2libGUgb3B0aW9ucyBhcmU6XG4gICAgICogICAgY2xvbmVBcnJheXM6ICBpZiB0cnVlLCBkbyBhIHNoYWxsb3cgY29weSBvZiB0aGUgQXJyYXkgcGFyYW1ldGVycyBcbiAgICAgKiAgICAgICAgICAgICAgICAgIChjb250b3VyLCBob2xlcykuIFBvaW50cyBpbnNpZGUgYXJyYXlzIGFyZSBuZXZlciBjb3BpZWQuXG4gICAgICogICAgICAgICAgICAgICAgICBEZWZhdWx0IGlzIGZhbHNlIDoga2VlcCBhIHJlZmVyZW5jZSB0byB0aGUgYXJyYXkgYXJndW1lbnRzLFxuICAgICAqICAgICAgICAgICAgICAgICAgd2hvIHdpbGwgYmUgbW9kaWZpZWQgaW4gcGxhY2UuXG4gICAgICogQHBhcmFtIHtBcnJheX0gY29udG91ciAgYXJyYXkgb2YgXCJQb2ludCBsaWtlXCIgb2JqZWN0cyB3aXRoIHt4LHl9IChkdWNrIHR5cGluZylcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyAgY29uc3RydWN0b3Igb3B0aW9uc1xuICAgICAqL1xuICAgIHZhciBTd2VlcENvbnRleHQgPSBmdW5jdGlvbihjb250b3VyLCBvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgICAgICB0aGlzLnRyaWFuZ2xlc18gPSBbXTtcbiAgICAgICAgdGhpcy5tYXBfID0gW107XG4gICAgICAgIHRoaXMucG9pbnRzXyA9IChvcHRpb25zLmNsb25lQXJyYXlzID8gY29udG91ci5zbGljZSgwKSA6IGNvbnRvdXIpO1xuICAgICAgICB0aGlzLmVkZ2VfbGlzdCA9IFtdO1xuXG4gICAgICAgIC8vIEJvdW5kaW5nIGJveCBvZiBhbGwgcG9pbnRzLiBDb21wdXRlZCBhdCB0aGUgc3RhcnQgb2YgdGhlIHRyaWFuZ3VsYXRpb24sIFxuICAgICAgICAvLyBpdCBpcyBzdG9yZWQgaW4gY2FzZSBpdCBpcyBuZWVkZWQgYnkgdGhlIGNhbGxlci5cbiAgICAgICAgdGhpcy5wbWluXyA9IHRoaXMucG1heF8gPSBudWxsO1xuXG4gICAgICAgIC8vIEFkdmFuY2luZyBmcm9udFxuICAgICAgICB0aGlzLmZyb250XyA9IG51bGw7IC8vIEFkdmFuY2luZ0Zyb250XG4gICAgICAgIC8vIGhlYWQgcG9pbnQgdXNlZCB3aXRoIGFkdmFuY2luZyBmcm9udFxuICAgICAgICB0aGlzLmhlYWRfID0gbnVsbDsgLy8gUG9pbnRcbiAgICAgICAgLy8gdGFpbCBwb2ludCB1c2VkIHdpdGggYWR2YW5jaW5nIGZyb250XG4gICAgICAgIHRoaXMudGFpbF8gPSBudWxsOyAvLyBQb2ludFxuXG4gICAgICAgIHRoaXMuYWZfaGVhZF8gPSBudWxsOyAvLyBOb2RlXG4gICAgICAgIHRoaXMuYWZfbWlkZGxlXyA9IG51bGw7IC8vIE5vZGVcbiAgICAgICAgdGhpcy5hZl90YWlsXyA9IG51bGw7IC8vIE5vZGVcblxuICAgICAgICB0aGlzLmJhc2luID0gbmV3IEJhc2luKCk7XG4gICAgICAgIHRoaXMuZWRnZV9ldmVudCA9IG5ldyBFZGdlRXZlbnQoKTtcblxuICAgICAgICB0aGlzLmluaXRFZGdlcyh0aGlzLnBvaW50c18pO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIEFkZCBhIGhvbGUgdG8gdGhlIGNvbnN0cmFpbnRzXG4gICAgICogQHBhcmFtIHtBcnJheX0gcG9seWxpbmUgIGFycmF5IG9mIFwiUG9pbnQgbGlrZVwiIG9iamVjdHMgd2l0aCB7eCx5fSAoZHVjayB0eXBpbmcpXG4gICAgICovXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5hZGRIb2xlID0gZnVuY3Rpb24ocG9seWxpbmUpIHtcbiAgICAgICAgdGhpcy5pbml0RWRnZXMocG9seWxpbmUpO1xuICAgICAgICB2YXIgaSwgbGVuID0gcG9seWxpbmUubGVuZ3RoO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMucG9pbnRzXy5wdXNoKHBvbHlsaW5lW2ldKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpczsgLy8gZm9yIGNoYWluaW5nXG4gICAgfTtcbiAgICAvLyBCYWNrd2FyZCBjb21wYXRpYmlsaXR5XG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5BZGRIb2xlID0gU3dlZXBDb250ZXh0LnByb3RvdHlwZS5hZGRIb2xlO1xuXG5cbiAgICAvKipcbiAgICAgKiBBZGQgYSBTdGVpbmVyIHBvaW50IHRvIHRoZSBjb25zdHJhaW50c1xuICAgICAqIEBwYXJhbSB7UG9pbnR9IHBvaW50ICAgICBhbnkgXCJQb2ludCBsaWtlXCIgb2JqZWN0IHdpdGgge3gseX0gKGR1Y2sgdHlwaW5nKVxuICAgICAqL1xuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUuYWRkUG9pbnQgPSBmdW5jdGlvbihwb2ludCkge1xuICAgICAgICB0aGlzLnBvaW50c18ucHVzaChwb2ludCk7XG4gICAgICAgIHJldHVybiB0aGlzOyAvLyBmb3IgY2hhaW5pbmdcbiAgICB9O1xuICAgIC8vIEJhY2t3YXJkIGNvbXBhdGliaWxpdHlcbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLkFkZFBvaW50ID0gU3dlZXBDb250ZXh0LnByb3RvdHlwZS5hZGRQb2ludDtcblxuXG4gICAgLyoqXG4gICAgICogQWRkIHNldmVyYWwgU3RlaW5lciBwb2ludHMgdG8gdGhlIGNvbnN0cmFpbnRzXG4gICAgICogQHBhcmFtIHthcnJheTxQb2ludD59IHBvaW50cyAgICAgYXJyYXkgb2YgXCJQb2ludCBsaWtlXCIgb2JqZWN0IHdpdGgge3gseX0gXG4gICAgICovXG4gICAgLy8gTWV0aG9kIGFkZGVkIGluIHRoZSBKYXZhU2NyaXB0IHZlcnNpb24gKHdhcyBub3QgcHJlc2VudCBpbiB0aGUgYysrIHZlcnNpb24pXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5hZGRQb2ludHMgPSBmdW5jdGlvbihwb2ludHMpIHtcbiAgICAgICAgdGhpcy5wb2ludHNfID0gdGhpcy5wb2ludHNfLmNvbmNhdChwb2ludHMpO1xuICAgICAgICByZXR1cm4gdGhpczsgLy8gZm9yIGNoYWluaW5nXG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogVHJpYW5ndWxhdGUgdGhlIHBvbHlnb24gd2l0aCBob2xlcyBhbmQgU3RlaW5lciBwb2ludHMuXG4gICAgICovXG4gICAgLy8gU2hvcnRjdXQgbWV0aG9kIGZvciBTd2VlcC50cmlhbmd1bGF0ZShTd2VlcENvbnRleHQpLlxuICAgIC8vIE1ldGhvZCBhZGRlZCBpbiB0aGUgSmF2YVNjcmlwdCB2ZXJzaW9uICh3YXMgbm90IHByZXNlbnQgaW4gdGhlIGMrKyB2ZXJzaW9uKVxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUudHJpYW5ndWxhdGUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgU3dlZXAudHJpYW5ndWxhdGUodGhpcyk7XG4gICAgICAgIHJldHVybiB0aGlzOyAvLyBmb3IgY2hhaW5pbmdcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIGJvdW5kaW5nIGJveCBvZiB0aGUgcHJvdmlkZWQgY29uc3RyYWludHMgKGNvbnRvdXIsIGhvbGVzIGFuZCBcbiAgICAgKiBTdGVpbnRlciBwb2ludHMpLiBXYXJuaW5nIDogdGhlc2UgdmFsdWVzIGFyZSBub3QgYXZhaWxhYmxlIGlmIHRoZSB0cmlhbmd1bGF0aW9uIFxuICAgICAqIGhhcyBub3QgYmVlbiBkb25lIHlldC5cbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBvYmplY3Qgd2l0aCAnbWluJyBhbmQgJ21heCcgUG9pbnRcbiAgICAgKi9cbiAgICAvLyBNZXRob2QgYWRkZWQgaW4gdGhlIEphdmFTY3JpcHQgdmVyc2lvbiAod2FzIG5vdCBwcmVzZW50IGluIHRoZSBjKysgdmVyc2lvbilcbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLmdldEJvdW5kaW5nQm94ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB7bWluOiB0aGlzLnBtaW5fLCBtYXg6IHRoaXMucG1heF99O1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBHZXQgcmVzdWx0IG9mIHRyaWFuZ3VsYXRpb25cbiAgICAgKiBAcmV0dXJucyB7YXJyYXk8VHJpYW5nbGU+fSAgIGFycmF5IG9mIHRyaWFuZ2xlc1xuICAgICAqL1xuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUuZ2V0VHJpYW5nbGVzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRyaWFuZ2xlc187XG4gICAgfTtcbiAgICAvLyBCYWNrd2FyZCBjb21wYXRpYmlsaXR5XG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5HZXRUcmlhbmdsZXMgPSBTd2VlcENvbnRleHQucHJvdG90eXBlLmdldFRyaWFuZ2xlcztcblxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1Td2VlcENvbnRleHQgKHByaXZhdGUgQVBJKVxuXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5mcm9udCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5mcm9udF87XG4gICAgfTtcblxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUucG9pbnRDb3VudCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5wb2ludHNfLmxlbmd0aDtcbiAgICB9O1xuXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5oZWFkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmhlYWRfO1xuICAgIH07XG5cbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLnNldEhlYWQgPSBmdW5jdGlvbihwMSkge1xuICAgICAgICB0aGlzLmhlYWRfID0gcDE7XG4gICAgfTtcblxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUudGFpbCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy50YWlsXztcbiAgICB9O1xuXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5zZXRUYWlsID0gZnVuY3Rpb24ocDEpIHtcbiAgICAgICAgdGhpcy50YWlsXyA9IHAxO1xuICAgIH07XG5cbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLmdldE1hcCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5tYXBfO1xuICAgIH07XG5cbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLmluaXRUcmlhbmd1bGF0aW9uID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciB4bWF4ID0gdGhpcy5wb2ludHNfWzBdLng7XG4gICAgICAgIHZhciB4bWluID0gdGhpcy5wb2ludHNfWzBdLng7XG4gICAgICAgIHZhciB5bWF4ID0gdGhpcy5wb2ludHNfWzBdLnk7XG4gICAgICAgIHZhciB5bWluID0gdGhpcy5wb2ludHNfWzBdLnk7XG5cbiAgICAgICAgLy8gQ2FsY3VsYXRlIGJvdW5kc1xuICAgICAgICB2YXIgaSwgbGVuID0gdGhpcy5wb2ludHNfLmxlbmd0aDtcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgcCA9IHRoaXMucG9pbnRzX1tpXTtcbiAgICAgICAgICAgIC8qIGpzaGludCBleHByOnRydWUgKi9cbiAgICAgICAgICAgIChwLnggPiB4bWF4KSAmJiAoeG1heCA9IHAueCk7XG4gICAgICAgICAgICAocC54IDwgeG1pbikgJiYgKHhtaW4gPSBwLngpO1xuICAgICAgICAgICAgKHAueSA+IHltYXgpICYmICh5bWF4ID0gcC55KTtcbiAgICAgICAgICAgIChwLnkgPCB5bWluKSAmJiAoeW1pbiA9IHAueSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5wbWluXyA9IG5ldyBQb2ludCh4bWluLCB5bWluKTtcbiAgICAgICAgdGhpcy5wbWF4XyA9IG5ldyBQb2ludCh4bWF4LCB5bWF4KTtcblxuICAgICAgICB2YXIgZHggPSBrQWxwaGEgKiAoeG1heCAtIHhtaW4pO1xuICAgICAgICB2YXIgZHkgPSBrQWxwaGEgKiAoeW1heCAtIHltaW4pO1xuICAgICAgICB0aGlzLmhlYWRfID0gbmV3IFBvaW50KHhtYXggKyBkeCwgeW1pbiAtIGR5KTtcbiAgICAgICAgdGhpcy50YWlsXyA9IG5ldyBQb2ludCh4bWluIC0gZHgsIHltaW4gLSBkeSk7XG5cbiAgICAgICAgLy8gU29ydCBwb2ludHMgYWxvbmcgeS1heGlzXG4gICAgICAgIHRoaXMucG9pbnRzXy5zb3J0KFBvaW50LmNvbXBhcmUpO1xuICAgIH07XG5cbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLmluaXRFZGdlcyA9IGZ1bmN0aW9uKHBvbHlsaW5lKSB7XG4gICAgICAgIHZhciBpLCBsZW4gPSBwb2x5bGluZS5sZW5ndGg7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgICAgICAgICAgdGhpcy5lZGdlX2xpc3QucHVzaChuZXcgRWRnZShwb2x5bGluZVtpXSwgcG9seWxpbmVbKGkgKyAxKSAlIGxlbl0pKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLmdldFBvaW50ID0gZnVuY3Rpb24oaW5kZXgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucG9pbnRzX1tpbmRleF07XG4gICAgfTtcblxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUuYWRkVG9NYXAgPSBmdW5jdGlvbih0cmlhbmdsZSkge1xuICAgICAgICB0aGlzLm1hcF8ucHVzaCh0cmlhbmdsZSk7XG4gICAgfTtcblxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUubG9jYXRlTm9kZSA9IGZ1bmN0aW9uKHBvaW50KSB7XG4gICAgICAgIHJldHVybiB0aGlzLmZyb250Xy5sb2NhdGVOb2RlKHBvaW50LngpO1xuICAgIH07XG5cbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLmNyZWF0ZUFkdmFuY2luZ0Zyb250ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBoZWFkO1xuICAgICAgICB2YXIgbWlkZGxlO1xuICAgICAgICB2YXIgdGFpbDtcbiAgICAgICAgLy8gSW5pdGlhbCB0cmlhbmdsZVxuICAgICAgICB2YXIgdHJpYW5nbGUgPSBuZXcgVHJpYW5nbGUodGhpcy5wb2ludHNfWzBdLCB0aGlzLnRhaWxfLCB0aGlzLmhlYWRfKTtcblxuICAgICAgICB0aGlzLm1hcF8ucHVzaCh0cmlhbmdsZSk7XG5cbiAgICAgICAgaGVhZCA9IG5ldyBOb2RlKHRyaWFuZ2xlLmdldFBvaW50KDEpLCB0cmlhbmdsZSk7XG4gICAgICAgIG1pZGRsZSA9IG5ldyBOb2RlKHRyaWFuZ2xlLmdldFBvaW50KDApLCB0cmlhbmdsZSk7XG4gICAgICAgIHRhaWwgPSBuZXcgTm9kZSh0cmlhbmdsZS5nZXRQb2ludCgyKSk7XG5cbiAgICAgICAgdGhpcy5mcm9udF8gPSBuZXcgQWR2YW5jaW5nRnJvbnQoaGVhZCwgdGFpbCk7XG5cbiAgICAgICAgaGVhZC5uZXh0ID0gbWlkZGxlO1xuICAgICAgICBtaWRkbGUubmV4dCA9IHRhaWw7XG4gICAgICAgIG1pZGRsZS5wcmV2ID0gaGVhZDtcbiAgICAgICAgdGFpbC5wcmV2ID0gbWlkZGxlO1xuICAgIH07XG5cbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLnJlbW92ZU5vZGUgPSBmdW5jdGlvbihub2RlKSB7XG4gICAgICAgIC8vIGRvIG5vdGhpbmdcbiAgICAgICAgLyoganNoaW50IHVudXNlZDpmYWxzZSAqL1xuICAgIH07XG5cbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLm1hcFRyaWFuZ2xlVG9Ob2RlcyA9IGZ1bmN0aW9uKHQpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCAzOyArK2kpIHtcbiAgICAgICAgICAgIGlmICghIHQuZ2V0TmVpZ2hib3IoaSkpIHtcbiAgICAgICAgICAgICAgICB2YXIgbiA9IHRoaXMuZnJvbnRfLmxvY2F0ZVBvaW50KHQucG9pbnRDVyh0LmdldFBvaW50KGkpKSk7XG4gICAgICAgICAgICAgICAgaWYgKG4pIHtcbiAgICAgICAgICAgICAgICAgICAgbi50cmlhbmdsZSA9IHQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUucmVtb3ZlRnJvbU1hcCA9IGZ1bmN0aW9uKHRyaWFuZ2xlKSB7XG4gICAgICAgIHZhciBpLCBtYXAgPSB0aGlzLm1hcF8sIGxlbiA9IG1hcC5sZW5ndGg7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgaWYgKG1hcFtpXSA9PT0gdHJpYW5nbGUpIHtcbiAgICAgICAgICAgICAgICBtYXAuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIERvIGEgZGVwdGggZmlyc3QgdHJhdmVyc2FsIHRvIGNvbGxlY3QgdHJpYW5nbGVzXG4gICAgICogQHBhcmFtIHtUcmlhbmdsZX0gdHJpYW5nbGUgc3RhcnRcbiAgICAgKi9cbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLm1lc2hDbGVhbiA9IGZ1bmN0aW9uKHRyaWFuZ2xlKSB7XG4gICAgICAgIC8vIE5ldyBpbXBsZW1lbnRhdGlvbiBhdm9pZHMgcmVjdXJzaXZlIGNhbGxzIGFuZCB1c2UgYSBsb29wIGluc3RlYWQuXG4gICAgICAgIC8vIENmLiBpc3N1ZXMgIyA1NywgNjUgYW5kIDY5LlxuICAgICAgICB2YXIgdHJpYW5nbGVzID0gW3RyaWFuZ2xlXSwgdCwgaTtcbiAgICAgICAgLyoganNoaW50IGJvc3M6dHJ1ZSAqL1xuICAgICAgICB3aGlsZSAodCA9IHRyaWFuZ2xlcy5wb3AoKSkge1xuICAgICAgICAgICAgaWYgKCF0LmlzSW50ZXJpb3IoKSkge1xuICAgICAgICAgICAgICAgIHQuc2V0SW50ZXJpb3IodHJ1ZSk7XG4gICAgICAgICAgICAgICAgdGhpcy50cmlhbmdsZXNfLnB1c2godCk7XG4gICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IDM7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXQuY29uc3RyYWluZWRfZWRnZVtpXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJpYW5nbGVzLnB1c2godC5nZXROZWlnaGJvcihpKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1Td2VlcFxuXG4gICAgLyoqXG4gICAgICogVGhlICdTd2VlcCcgb2JqZWN0IGlzIHByZXNlbnQgaW4gb3JkZXIgdG8ga2VlcCB0aGlzIEphdmFTY3JpcHQgdmVyc2lvbiBcbiAgICAgKiBhcyBjbG9zZSBhcyBwb3NzaWJsZSB0byB0aGUgcmVmZXJlbmNlIEMrKyB2ZXJzaW9uLCBldmVuIHRob3VnaCBhbG1vc3RcbiAgICAgKiBhbGwgU3dlZXAgbWV0aG9kcyBjb3VsZCBiZSBkZWNsYXJlZCBhcyBtZW1iZXJzIG9mIHRoZSBTd2VlcENvbnRleHQgb2JqZWN0LlxuICAgICAqL1xuICAgIHZhciBTd2VlcCA9IHt9O1xuXG5cbiAgICAvKipcbiAgICAgKiBUcmlhbmd1bGF0ZSB0aGUgcG9seWdvbiB3aXRoIGhvbGVzIGFuZCBTdGVpbmVyIHBvaW50cy5cbiAgICAgKiBAcGFyYW0gICB0Y3ggU3dlZXBDb250ZXh0IG9iamVjdC5cbiAgICAgKi9cbiAgICBTd2VlcC50cmlhbmd1bGF0ZSA9IGZ1bmN0aW9uKHRjeCkge1xuICAgICAgICB0Y3guaW5pdFRyaWFuZ3VsYXRpb24oKTtcbiAgICAgICAgdGN4LmNyZWF0ZUFkdmFuY2luZ0Zyb250KCk7XG4gICAgICAgIC8vIFN3ZWVwIHBvaW50czsgYnVpbGQgbWVzaFxuICAgICAgICBTd2VlcC5zd2VlcFBvaW50cyh0Y3gpO1xuICAgICAgICAvLyBDbGVhbiB1cFxuICAgICAgICBTd2VlcC5maW5hbGl6YXRpb25Qb2x5Z29uKHRjeCk7XG4gICAgfTtcblxuICAgIFN3ZWVwLnN3ZWVwUG9pbnRzID0gZnVuY3Rpb24odGN4KSB7XG4gICAgICAgIHZhciBpLCBsZW4gPSB0Y3gucG9pbnRDb3VudCgpO1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgICAgICAgIHZhciBwb2ludCA9IHRjeC5nZXRQb2ludChpKTtcbiAgICAgICAgICAgIHZhciBub2RlID0gU3dlZXAucG9pbnRFdmVudCh0Y3gsIHBvaW50KTtcbiAgICAgICAgICAgIHZhciBlZGdlcyA9IHBvaW50Ll9wMnRfZWRnZV9saXN0O1xuICAgICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGVkZ2VzICYmIGogPCBlZGdlcy5sZW5ndGg7ICsraikge1xuICAgICAgICAgICAgICAgIFN3ZWVwLmVkZ2VFdmVudEJ5RWRnZSh0Y3gsIGVkZ2VzW2pdLCBub2RlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBTd2VlcC5maW5hbGl6YXRpb25Qb2x5Z29uID0gZnVuY3Rpb24odGN4KSB7XG4gICAgICAgIC8vIEdldCBhbiBJbnRlcm5hbCB0cmlhbmdsZSB0byBzdGFydCB3aXRoXG4gICAgICAgIHZhciB0ID0gdGN4LmZyb250KCkuaGVhZCgpLm5leHQudHJpYW5nbGU7XG4gICAgICAgIHZhciBwID0gdGN4LmZyb250KCkuaGVhZCgpLm5leHQucG9pbnQ7XG4gICAgICAgIHdoaWxlICghdC5nZXRDb25zdHJhaW5lZEVkZ2VDVyhwKSkge1xuICAgICAgICAgICAgdCA9IHQubmVpZ2hib3JDQ1cocCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDb2xsZWN0IGludGVyaW9yIHRyaWFuZ2xlcyBjb25zdHJhaW5lZCBieSBlZGdlc1xuICAgICAgICB0Y3gubWVzaENsZWFuKHQpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBGaW5kIGNsb3NlcyBub2RlIHRvIHRoZSBsZWZ0IG9mIHRoZSBuZXcgcG9pbnQgYW5kXG4gICAgICogY3JlYXRlIGEgbmV3IHRyaWFuZ2xlLiBJZiBuZWVkZWQgbmV3IGhvbGVzIGFuZCBiYXNpbnNcbiAgICAgKiB3aWxsIGJlIGZpbGxlZCB0by5cbiAgICAgKi9cbiAgICBTd2VlcC5wb2ludEV2ZW50ID0gZnVuY3Rpb24odGN4LCBwb2ludCkge1xuICAgICAgICB2YXIgbm9kZSA9IHRjeC5sb2NhdGVOb2RlKHBvaW50KTtcbiAgICAgICAgdmFyIG5ld19ub2RlID0gU3dlZXAubmV3RnJvbnRUcmlhbmdsZSh0Y3gsIHBvaW50LCBub2RlKTtcblxuICAgICAgICAvLyBPbmx5IG5lZWQgdG8gY2hlY2sgK2Vwc2lsb24gc2luY2UgcG9pbnQgbmV2ZXIgaGF2ZSBzbWFsbGVyXG4gICAgICAgIC8vIHggdmFsdWUgdGhhbiBub2RlIGR1ZSB0byBob3cgd2UgZmV0Y2ggbm9kZXMgZnJvbSB0aGUgZnJvbnRcbiAgICAgICAgaWYgKHBvaW50LnggPD0gbm9kZS5wb2ludC54ICsgKEVQU0lMT04pKSB7XG4gICAgICAgICAgICBTd2VlcC5maWxsKHRjeCwgbm9kZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvL3RjeC5BZGROb2RlKG5ld19ub2RlKTtcblxuICAgICAgICBTd2VlcC5maWxsQWR2YW5jaW5nRnJvbnQodGN4LCBuZXdfbm9kZSk7XG4gICAgICAgIHJldHVybiBuZXdfbm9kZTtcbiAgICB9O1xuXG4gICAgU3dlZXAuZWRnZUV2ZW50QnlFZGdlID0gZnVuY3Rpb24odGN4LCBlZGdlLCBub2RlKSB7XG4gICAgICAgIHRjeC5lZGdlX2V2ZW50LmNvbnN0cmFpbmVkX2VkZ2UgPSBlZGdlO1xuICAgICAgICB0Y3guZWRnZV9ldmVudC5yaWdodCA9IChlZGdlLnAueCA+IGVkZ2UucS54KTtcblxuICAgICAgICBpZiAoU3dlZXAuaXNFZGdlU2lkZU9mVHJpYW5nbGUobm9kZS50cmlhbmdsZSwgZWRnZS5wLCBlZGdlLnEpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGb3Igbm93IHdlIHdpbGwgZG8gYWxsIG5lZWRlZCBmaWxsaW5nXG4gICAgICAgIC8vIFRPRE86IGludGVncmF0ZSB3aXRoIGZsaXAgcHJvY2VzcyBtaWdodCBnaXZlIHNvbWUgYmV0dGVyIHBlcmZvcm1hbmNlXG4gICAgICAgIC8vICAgICAgIGJ1dCBmb3Igbm93IHRoaXMgYXZvaWQgdGhlIGlzc3VlIHdpdGggY2FzZXMgdGhhdCBuZWVkcyBib3RoIGZsaXBzIGFuZCBmaWxsc1xuICAgICAgICBTd2VlcC5maWxsRWRnZUV2ZW50KHRjeCwgZWRnZSwgbm9kZSk7XG4gICAgICAgIFN3ZWVwLmVkZ2VFdmVudEJ5UG9pbnRzKHRjeCwgZWRnZS5wLCBlZGdlLnEsIG5vZGUudHJpYW5nbGUsIGVkZ2UucSk7XG4gICAgfTtcblxuICAgIFN3ZWVwLmVkZ2VFdmVudEJ5UG9pbnRzID0gZnVuY3Rpb24odGN4LCBlcCwgZXEsIHRyaWFuZ2xlLCBwb2ludCkge1xuICAgICAgICBpZiAoU3dlZXAuaXNFZGdlU2lkZU9mVHJpYW5nbGUodHJpYW5nbGUsIGVwLCBlcSkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBwMSA9IHRyaWFuZ2xlLnBvaW50Q0NXKHBvaW50KTtcbiAgICAgICAgdmFyIG8xID0gb3JpZW50MmQoZXEsIHAxLCBlcCk7XG4gICAgICAgIGlmIChvMSA9PT0gT3JpZW50YXRpb24uQ09MTElORUFSKSB7XG4gICAgICAgICAgICAvLyBUT0RPIGludGVncmF0ZSBoZXJlIGNoYW5nZXMgZnJvbSBDKysgdmVyc2lvblxuICAgICAgICAgICAgdGhyb3cgbmV3IFBvaW50RXJyb3IoJ3BvbHkydHJpIEVkZ2VFdmVudDogQ29sbGluZWFyIG5vdCBzdXBwb3J0ZWQhJywgW2VxLCBwMSwgZXBdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBwMiA9IHRyaWFuZ2xlLnBvaW50Q1cocG9pbnQpO1xuICAgICAgICB2YXIgbzIgPSBvcmllbnQyZChlcSwgcDIsIGVwKTtcbiAgICAgICAgaWYgKG8yID09PSBPcmllbnRhdGlvbi5DT0xMSU5FQVIpIHtcbiAgICAgICAgICAgIC8vIFRPRE8gaW50ZWdyYXRlIGhlcmUgY2hhbmdlcyBmcm9tIEMrKyB2ZXJzaW9uXG4gICAgICAgICAgICB0aHJvdyBuZXcgUG9pbnRFcnJvcigncG9seTJ0cmkgRWRnZUV2ZW50OiBDb2xsaW5lYXIgbm90IHN1cHBvcnRlZCEnLCBbZXEsIHAyLCBlcF0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG8xID09PSBvMikge1xuICAgICAgICAgICAgLy8gTmVlZCB0byBkZWNpZGUgaWYgd2UgYXJlIHJvdGF0aW5nIENXIG9yIENDVyB0byBnZXQgdG8gYSB0cmlhbmdsZVxuICAgICAgICAgICAgLy8gdGhhdCB3aWxsIGNyb3NzIGVkZ2VcbiAgICAgICAgICAgIGlmIChvMSA9PT0gT3JpZW50YXRpb24uQ1cpIHtcbiAgICAgICAgICAgICAgICB0cmlhbmdsZSA9IHRyaWFuZ2xlLm5laWdoYm9yQ0NXKHBvaW50KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdHJpYW5nbGUgPSB0cmlhbmdsZS5uZWlnaGJvckNXKHBvaW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFN3ZWVwLmVkZ2VFdmVudEJ5UG9pbnRzKHRjeCwgZXAsIGVxLCB0cmlhbmdsZSwgcG9pbnQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gVGhpcyB0cmlhbmdsZSBjcm9zc2VzIGNvbnN0cmFpbnQgc28gbGV0cyBmbGlwcGluIHN0YXJ0IVxuICAgICAgICAgICAgU3dlZXAuZmxpcEVkZ2VFdmVudCh0Y3gsIGVwLCBlcSwgdHJpYW5nbGUsIHBvaW50KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBTd2VlcC5pc0VkZ2VTaWRlT2ZUcmlhbmdsZSA9IGZ1bmN0aW9uKHRyaWFuZ2xlLCBlcCwgZXEpIHtcbiAgICAgICAgdmFyIGluZGV4ID0gdHJpYW5nbGUuZWRnZUluZGV4KGVwLCBlcSk7XG4gICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICAgIHRyaWFuZ2xlLm1hcmtDb25zdHJhaW5lZEVkZ2VCeUluZGV4KGluZGV4KTtcbiAgICAgICAgICAgIHZhciB0ID0gdHJpYW5nbGUuZ2V0TmVpZ2hib3IoaW5kZXgpO1xuICAgICAgICAgICAgaWYgKHQpIHtcbiAgICAgICAgICAgICAgICB0Lm1hcmtDb25zdHJhaW5lZEVkZ2VCeVBvaW50cyhlcCwgZXEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH07XG5cbiAgICBTd2VlcC5uZXdGcm9udFRyaWFuZ2xlID0gZnVuY3Rpb24odGN4LCBwb2ludCwgbm9kZSkge1xuICAgICAgICB2YXIgdHJpYW5nbGUgPSBuZXcgVHJpYW5nbGUocG9pbnQsIG5vZGUucG9pbnQsIG5vZGUubmV4dC5wb2ludCk7XG5cbiAgICAgICAgdHJpYW5nbGUubWFya05laWdoYm9yKG5vZGUudHJpYW5nbGUpO1xuICAgICAgICB0Y3guYWRkVG9NYXAodHJpYW5nbGUpO1xuXG4gICAgICAgIHZhciBuZXdfbm9kZSA9IG5ldyBOb2RlKHBvaW50KTtcbiAgICAgICAgbmV3X25vZGUubmV4dCA9IG5vZGUubmV4dDtcbiAgICAgICAgbmV3X25vZGUucHJldiA9IG5vZGU7XG4gICAgICAgIG5vZGUubmV4dC5wcmV2ID0gbmV3X25vZGU7XG4gICAgICAgIG5vZGUubmV4dCA9IG5ld19ub2RlO1xuXG4gICAgICAgIGlmICghU3dlZXAubGVnYWxpemUodGN4LCB0cmlhbmdsZSkpIHtcbiAgICAgICAgICAgIHRjeC5tYXBUcmlhbmdsZVRvTm9kZXModHJpYW5nbGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5ld19ub2RlO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgdHJpYW5nbGUgdG8gdGhlIGFkdmFuY2luZyBmcm9udCB0byBmaWxsIGEgaG9sZS5cbiAgICAgKiBAcGFyYW0gdGN4XG4gICAgICogQHBhcmFtIG5vZGUgLSBtaWRkbGUgbm9kZSwgdGhhdCBpcyB0aGUgYm90dG9tIG9mIHRoZSBob2xlXG4gICAgICovXG4gICAgU3dlZXAuZmlsbCA9IGZ1bmN0aW9uKHRjeCwgbm9kZSkge1xuICAgICAgICB2YXIgdHJpYW5nbGUgPSBuZXcgVHJpYW5nbGUobm9kZS5wcmV2LnBvaW50LCBub2RlLnBvaW50LCBub2RlLm5leHQucG9pbnQpO1xuXG4gICAgICAgIC8vIFRPRE86IHNob3VsZCBjb3B5IHRoZSBjb25zdHJhaW5lZF9lZGdlIHZhbHVlIGZyb20gbmVpZ2hib3IgdHJpYW5nbGVzXG4gICAgICAgIC8vICAgICAgIGZvciBub3cgY29uc3RyYWluZWRfZWRnZSB2YWx1ZXMgYXJlIGNvcGllZCBkdXJpbmcgdGhlIGxlZ2FsaXplXG4gICAgICAgIHRyaWFuZ2xlLm1hcmtOZWlnaGJvcihub2RlLnByZXYudHJpYW5nbGUpO1xuICAgICAgICB0cmlhbmdsZS5tYXJrTmVpZ2hib3Iobm9kZS50cmlhbmdsZSk7XG5cbiAgICAgICAgdGN4LmFkZFRvTWFwKHRyaWFuZ2xlKTtcblxuICAgICAgICAvLyBVcGRhdGUgdGhlIGFkdmFuY2luZyBmcm9udFxuICAgICAgICBub2RlLnByZXYubmV4dCA9IG5vZGUubmV4dDtcbiAgICAgICAgbm9kZS5uZXh0LnByZXYgPSBub2RlLnByZXY7XG5cblxuICAgICAgICAvLyBJZiBpdCB3YXMgbGVnYWxpemVkIHRoZSB0cmlhbmdsZSBoYXMgYWxyZWFkeSBiZWVuIG1hcHBlZFxuICAgICAgICBpZiAoIVN3ZWVwLmxlZ2FsaXplKHRjeCwgdHJpYW5nbGUpKSB7XG4gICAgICAgICAgICB0Y3gubWFwVHJpYW5nbGVUb05vZGVzKHRyaWFuZ2xlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vdGN4LnJlbW92ZU5vZGUobm9kZSk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEZpbGxzIGhvbGVzIGluIHRoZSBBZHZhbmNpbmcgRnJvbnRcbiAgICAgKi9cbiAgICBTd2VlcC5maWxsQWR2YW5jaW5nRnJvbnQgPSBmdW5jdGlvbih0Y3gsIG4pIHtcbiAgICAgICAgLy8gRmlsbCByaWdodCBob2xlc1xuICAgICAgICB2YXIgbm9kZSA9IG4ubmV4dDtcbiAgICAgICAgdmFyIGFuZ2xlO1xuICAgICAgICB3aGlsZSAobm9kZS5uZXh0KSB7XG4gICAgICAgICAgICBhbmdsZSA9IFN3ZWVwLmhvbGVBbmdsZShub2RlKTtcbiAgICAgICAgICAgIGlmIChhbmdsZSA+IFBJXzIgfHwgYW5nbGUgPCAtKFBJXzIpKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBTd2VlcC5maWxsKHRjeCwgbm9kZSk7XG4gICAgICAgICAgICBub2RlID0gbm9kZS5uZXh0O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRmlsbCBsZWZ0IGhvbGVzXG4gICAgICAgIG5vZGUgPSBuLnByZXY7XG4gICAgICAgIHdoaWxlIChub2RlLnByZXYpIHtcbiAgICAgICAgICAgIGFuZ2xlID0gU3dlZXAuaG9sZUFuZ2xlKG5vZGUpO1xuICAgICAgICAgICAgaWYgKGFuZ2xlID4gUElfMiB8fCBhbmdsZSA8IC0oUElfMikpIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFN3ZWVwLmZpbGwodGN4LCBub2RlKTtcbiAgICAgICAgICAgIG5vZGUgPSBub2RlLnByZXY7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGaWxsIHJpZ2h0IGJhc2luc1xuICAgICAgICBpZiAobi5uZXh0ICYmIG4ubmV4dC5uZXh0KSB7XG4gICAgICAgICAgICBhbmdsZSA9IFN3ZWVwLmJhc2luQW5nbGUobik7XG4gICAgICAgICAgICBpZiAoYW5nbGUgPCBQSV8zZGl2NCkge1xuICAgICAgICAgICAgICAgIFN3ZWVwLmZpbGxCYXNpbih0Y3gsIG4pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIFN3ZWVwLmJhc2luQW5nbGUgPSBmdW5jdGlvbihub2RlKSB7XG4gICAgICAgIHZhciBheCA9IG5vZGUucG9pbnQueCAtIG5vZGUubmV4dC5uZXh0LnBvaW50Lng7XG4gICAgICAgIHZhciBheSA9IG5vZGUucG9pbnQueSAtIG5vZGUubmV4dC5uZXh0LnBvaW50Lnk7XG4gICAgICAgIHJldHVybiBNYXRoLmF0YW4yKGF5LCBheCk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIG5vZGUgLSBtaWRkbGUgbm9kZVxuICAgICAqIEByZXR1cm4gdGhlIGFuZ2xlIGJldHdlZW4gMyBmcm9udCBub2Rlc1xuICAgICAqL1xuICAgIFN3ZWVwLmhvbGVBbmdsZSA9IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICAgICAgLyogQ29tcGxleCBwbGFuZVxuICAgICAgICAgKiBhYiA9IGNvc0EgK2kqc2luQVxuICAgICAgICAgKiBhYiA9IChheCArIGF5KmkpKGJ4ICsgYnkqaSkgPSAoYXgqYnggKyBheSpieSkgKyBpKGF4KmJ5LWF5KmJ4KVxuICAgICAgICAgKiBhdGFuMih5LHgpIGNvbXB1dGVzIHRoZSBwcmluY2lwYWwgdmFsdWUgb2YgdGhlIGFyZ3VtZW50IGZ1bmN0aW9uXG4gICAgICAgICAqIGFwcGxpZWQgdG8gdGhlIGNvbXBsZXggbnVtYmVyIHgraXlcbiAgICAgICAgICogV2hlcmUgeCA9IGF4KmJ4ICsgYXkqYnlcbiAgICAgICAgICogICAgICAgeSA9IGF4KmJ5IC0gYXkqYnhcbiAgICAgICAgICovXG4gICAgICAgIHZhciBheCA9IG5vZGUubmV4dC5wb2ludC54IC0gbm9kZS5wb2ludC54O1xuICAgICAgICB2YXIgYXkgPSBub2RlLm5leHQucG9pbnQueSAtIG5vZGUucG9pbnQueTtcbiAgICAgICAgdmFyIGJ4ID0gbm9kZS5wcmV2LnBvaW50LnggLSBub2RlLnBvaW50Lng7XG4gICAgICAgIHZhciBieSA9IG5vZGUucHJldi5wb2ludC55IC0gbm9kZS5wb2ludC55O1xuICAgICAgICByZXR1cm4gTWF0aC5hdGFuMihheCAqIGJ5IC0gYXkgKiBieCwgYXggKiBieCArIGF5ICogYnkpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdHJpYW5nbGUgd2FzIGxlZ2FsaXplZFxuICAgICAqL1xuICAgIFN3ZWVwLmxlZ2FsaXplID0gZnVuY3Rpb24odGN4LCB0KSB7XG4gICAgICAgIC8vIFRvIGxlZ2FsaXplIGEgdHJpYW5nbGUgd2Ugc3RhcnQgYnkgZmluZGluZyBpZiBhbnkgb2YgdGhlIHRocmVlIGVkZ2VzXG4gICAgICAgIC8vIHZpb2xhdGUgdGhlIERlbGF1bmF5IGNvbmRpdGlvblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IDM7ICsraSkge1xuICAgICAgICAgICAgaWYgKHQuZGVsYXVuYXlfZWRnZVtpXSkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIG90ID0gdC5nZXROZWlnaGJvcihpKTtcbiAgICAgICAgICAgIGlmIChvdCkge1xuICAgICAgICAgICAgICAgIHZhciBwID0gdC5nZXRQb2ludChpKTtcbiAgICAgICAgICAgICAgICB2YXIgb3AgPSBvdC5vcHBvc2l0ZVBvaW50KHQsIHApO1xuICAgICAgICAgICAgICAgIHZhciBvaSA9IG90LmluZGV4KG9wKTtcblxuICAgICAgICAgICAgICAgIC8vIElmIHRoaXMgaXMgYSBDb25zdHJhaW5lZCBFZGdlIG9yIGEgRGVsYXVuYXkgRWRnZShvbmx5IGR1cmluZyByZWN1cnNpdmUgbGVnYWxpemF0aW9uKVxuICAgICAgICAgICAgICAgIC8vIHRoZW4gd2Ugc2hvdWxkIG5vdCB0cnkgdG8gbGVnYWxpemVcbiAgICAgICAgICAgICAgICBpZiAob3QuY29uc3RyYWluZWRfZWRnZVtvaV0gfHwgb3QuZGVsYXVuYXlfZWRnZVtvaV0pIHtcbiAgICAgICAgICAgICAgICAgICAgdC5jb25zdHJhaW5lZF9lZGdlW2ldID0gb3QuY29uc3RyYWluZWRfZWRnZVtvaV07XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZhciBpbnNpZGUgPSBTd2VlcC5pbkNpcmNsZShwLCB0LnBvaW50Q0NXKHApLCB0LnBvaW50Q1cocCksIG9wKTtcbiAgICAgICAgICAgICAgICBpZiAoaW5zaWRlKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIExldHMgbWFyayB0aGlzIHNoYXJlZCBlZGdlIGFzIERlbGF1bmF5XG4gICAgICAgICAgICAgICAgICAgIHQuZGVsYXVuYXlfZWRnZVtpXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIG90LmRlbGF1bmF5X2VkZ2Vbb2ldID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBMZXRzIHJvdGF0ZSBzaGFyZWQgZWRnZSBvbmUgdmVydGV4IENXIHRvIGxlZ2FsaXplIGl0XG4gICAgICAgICAgICAgICAgICAgIFN3ZWVwLnJvdGF0ZVRyaWFuZ2xlUGFpcih0LCBwLCBvdCwgb3ApO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFdlIG5vdyBnb3Qgb25lIHZhbGlkIERlbGF1bmF5IEVkZ2Ugc2hhcmVkIGJ5IHR3byB0cmlhbmdsZXNcbiAgICAgICAgICAgICAgICAgICAgLy8gVGhpcyBnaXZlcyB1cyA0IG5ldyBlZGdlcyB0byBjaGVjayBmb3IgRGVsYXVuYXlcblxuICAgICAgICAgICAgICAgICAgICAvLyBNYWtlIHN1cmUgdGhhdCB0cmlhbmdsZSB0byBub2RlIG1hcHBpbmcgaXMgZG9uZSBvbmx5IG9uZSB0aW1lIGZvciBhIHNwZWNpZmljIHRyaWFuZ2xlXG4gICAgICAgICAgICAgICAgICAgIHZhciBub3RfbGVnYWxpemVkID0gIVN3ZWVwLmxlZ2FsaXplKHRjeCwgdCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChub3RfbGVnYWxpemVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0Y3gubWFwVHJpYW5nbGVUb05vZGVzKHQpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgbm90X2xlZ2FsaXplZCA9ICFTd2VlcC5sZWdhbGl6ZSh0Y3gsIG90KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5vdF9sZWdhbGl6ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRjeC5tYXBUcmlhbmdsZVRvTm9kZXMob3QpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIC8vIFJlc2V0IHRoZSBEZWxhdW5heSBlZGdlcywgc2luY2UgdGhleSBvbmx5IGFyZSB2YWxpZCBEZWxhdW5heSBlZGdlc1xuICAgICAgICAgICAgICAgICAgICAvLyB1bnRpbCB3ZSBhZGQgYSBuZXcgdHJpYW5nbGUgb3IgcG9pbnQuXG4gICAgICAgICAgICAgICAgICAgIC8vIFhYWDogbmVlZCB0byB0aGluayBhYm91dCB0aGlzLiBDYW4gdGhlc2UgZWRnZXMgYmUgdHJpZWQgYWZ0ZXIgd2VcbiAgICAgICAgICAgICAgICAgICAgLy8gICAgICByZXR1cm4gdG8gcHJldmlvdXMgcmVjdXJzaXZlIGxldmVsP1xuICAgICAgICAgICAgICAgICAgICB0LmRlbGF1bmF5X2VkZ2VbaV0gPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgb3QuZGVsYXVuYXlfZWRnZVtvaV0gPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBJZiB0cmlhbmdsZSBoYXZlIGJlZW4gbGVnYWxpemVkIG5vIG5lZWQgdG8gY2hlY2sgdGhlIG90aGVyIGVkZ2VzIHNpbmNlXG4gICAgICAgICAgICAgICAgICAgIC8vIHRoZSByZWN1cnNpdmUgbGVnYWxpemF0aW9uIHdpbGwgaGFuZGxlcyB0aG9zZSBzbyB3ZSBjYW4gZW5kIGhlcmUuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIDxiPlJlcXVpcmVtZW50PC9iPjo8YnI+XG4gICAgICogMS4gYSxiIGFuZCBjIGZvcm0gYSB0cmlhbmdsZS48YnI+XG4gICAgICogMi4gYSBhbmQgZCBpcyBrbm93IHRvIGJlIG9uIG9wcG9zaXRlIHNpZGUgb2YgYmM8YnI+XG4gICAgICogPHByZT5cbiAgICAgKiAgICAgICAgICAgICAgICBhXG4gICAgICogICAgICAgICAgICAgICAgK1xuICAgICAqICAgICAgICAgICAgICAgLyBcXFxuICAgICAqICAgICAgICAgICAgICAvICAgXFxcbiAgICAgKiAgICAgICAgICAgIGIvICAgICBcXGNcbiAgICAgKiAgICAgICAgICAgICstLS0tLS0tK1xuICAgICAqICAgICAgICAgICAvICAgIGQgICAgXFxcbiAgICAgKiAgICAgICAgICAvICAgICAgICAgICBcXFxuICAgICAqIDwvcHJlPlxuICAgICAqIDxiPkZhY3Q8L2I+OiBkIGhhcyB0byBiZSBpbiBhcmVhIEIgdG8gaGF2ZSBhIGNoYW5jZSB0byBiZSBpbnNpZGUgdGhlIGNpcmNsZSBmb3JtZWQgYnlcbiAgICAgKiAgYSxiIGFuZCBjPGJyPlxuICAgICAqICBkIGlzIG91dHNpZGUgQiBpZiBvcmllbnQyZChhLGIsZCkgb3Igb3JpZW50MmQoYyxhLGQpIGlzIENXPGJyPlxuICAgICAqICBUaGlzIHByZWtub3dsZWRnZSBnaXZlcyB1cyBhIHdheSB0byBvcHRpbWl6ZSB0aGUgaW5jaXJjbGUgdGVzdFxuICAgICAqIEBwYXJhbSBwYSAtIHRyaWFuZ2xlIHBvaW50LCBvcHBvc2l0ZSBkXG4gICAgICogQHBhcmFtIHBiIC0gdHJpYW5nbGUgcG9pbnRcbiAgICAgKiBAcGFyYW0gcGMgLSB0cmlhbmdsZSBwb2ludFxuICAgICAqIEBwYXJhbSBwZCAtIHBvaW50IG9wcG9zaXRlIGFcbiAgICAgKiBAcmV0dXJuIHRydWUgaWYgZCBpcyBpbnNpZGUgY2lyY2xlLCBmYWxzZSBpZiBvbiBjaXJjbGUgZWRnZVxuICAgICAqL1xuICAgIFN3ZWVwLmluQ2lyY2xlID0gZnVuY3Rpb24ocGEsIHBiLCBwYywgcGQpIHtcbiAgICAgICAgdmFyIGFkeCA9IHBhLnggLSBwZC54O1xuICAgICAgICB2YXIgYWR5ID0gcGEueSAtIHBkLnk7XG4gICAgICAgIHZhciBiZHggPSBwYi54IC0gcGQueDtcbiAgICAgICAgdmFyIGJkeSA9IHBiLnkgLSBwZC55O1xuXG4gICAgICAgIHZhciBhZHhiZHkgPSBhZHggKiBiZHk7XG4gICAgICAgIHZhciBiZHhhZHkgPSBiZHggKiBhZHk7XG4gICAgICAgIHZhciBvYWJkID0gYWR4YmR5IC0gYmR4YWR5O1xuICAgICAgICBpZiAob2FiZCA8PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgY2R4ID0gcGMueCAtIHBkLng7XG4gICAgICAgIHZhciBjZHkgPSBwYy55IC0gcGQueTtcblxuICAgICAgICB2YXIgY2R4YWR5ID0gY2R4ICogYWR5O1xuICAgICAgICB2YXIgYWR4Y2R5ID0gYWR4ICogY2R5O1xuICAgICAgICB2YXIgb2NhZCA9IGNkeGFkeSAtIGFkeGNkeTtcbiAgICAgICAgaWYgKG9jYWQgPD0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGJkeGNkeSA9IGJkeCAqIGNkeTtcbiAgICAgICAgdmFyIGNkeGJkeSA9IGNkeCAqIGJkeTtcblxuICAgICAgICB2YXIgYWxpZnQgPSBhZHggKiBhZHggKyBhZHkgKiBhZHk7XG4gICAgICAgIHZhciBibGlmdCA9IGJkeCAqIGJkeCArIGJkeSAqIGJkeTtcbiAgICAgICAgdmFyIGNsaWZ0ID0gY2R4ICogY2R4ICsgY2R5ICogY2R5O1xuXG4gICAgICAgIHZhciBkZXQgPSBhbGlmdCAqIChiZHhjZHkgLSBjZHhiZHkpICsgYmxpZnQgKiBvY2FkICsgY2xpZnQgKiBvYWJkO1xuICAgICAgICByZXR1cm4gZGV0ID4gMDtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogUm90YXRlcyBhIHRyaWFuZ2xlIHBhaXIgb25lIHZlcnRleCBDV1xuICAgICAqPHByZT5cbiAgICAgKiAgICAgICBuMiAgICAgICAgICAgICAgICAgICAgbjJcbiAgICAgKiAgUCArLS0tLS0rICAgICAgICAgICAgIFAgKy0tLS0tK1xuICAgICAqICAgIHwgdCAgL3wgICAgICAgICAgICAgICB8XFwgIHQgfFxuICAgICAqICAgIHwgICAvIHwgICAgICAgICAgICAgICB8IFxcICAgfFxuICAgICAqICBuMXwgIC8gIHxuMyAgICAgICAgICAgbjF8ICBcXCAgfG4zXG4gICAgICogICAgfCAvICAgfCAgICBhZnRlciBDVyAgIHwgICBcXCB8XG4gICAgICogICAgfC8gb1QgfCAgICAgICAgICAgICAgIHwgb1QgXFx8XG4gICAgICogICAgKy0tLS0tKyBvUCAgICAgICAgICAgICstLS0tLStcbiAgICAgKiAgICAgICBuNCAgICAgICAgICAgICAgICAgICAgbjRcbiAgICAgKiA8L3ByZT5cbiAgICAgKi9cbiAgICBTd2VlcC5yb3RhdGVUcmlhbmdsZVBhaXIgPSBmdW5jdGlvbih0LCBwLCBvdCwgb3ApIHtcbiAgICAgICAgdmFyIG4xLCBuMiwgbjMsIG40O1xuICAgICAgICBuMSA9IHQubmVpZ2hib3JDQ1cocCk7XG4gICAgICAgIG4yID0gdC5uZWlnaGJvckNXKHApO1xuICAgICAgICBuMyA9IG90Lm5laWdoYm9yQ0NXKG9wKTtcbiAgICAgICAgbjQgPSBvdC5uZWlnaGJvckNXKG9wKTtcblxuICAgICAgICB2YXIgY2UxLCBjZTIsIGNlMywgY2U0O1xuICAgICAgICBjZTEgPSB0LmdldENvbnN0cmFpbmVkRWRnZUNDVyhwKTtcbiAgICAgICAgY2UyID0gdC5nZXRDb25zdHJhaW5lZEVkZ2VDVyhwKTtcbiAgICAgICAgY2UzID0gb3QuZ2V0Q29uc3RyYWluZWRFZGdlQ0NXKG9wKTtcbiAgICAgICAgY2U0ID0gb3QuZ2V0Q29uc3RyYWluZWRFZGdlQ1cob3ApO1xuXG4gICAgICAgIHZhciBkZTEsIGRlMiwgZGUzLCBkZTQ7XG4gICAgICAgIGRlMSA9IHQuZ2V0RGVsYXVuYXlFZGdlQ0NXKHApO1xuICAgICAgICBkZTIgPSB0LmdldERlbGF1bmF5RWRnZUNXKHApO1xuICAgICAgICBkZTMgPSBvdC5nZXREZWxhdW5heUVkZ2VDQ1cob3ApO1xuICAgICAgICBkZTQgPSBvdC5nZXREZWxhdW5heUVkZ2VDVyhvcCk7XG5cbiAgICAgICAgdC5sZWdhbGl6ZShwLCBvcCk7XG4gICAgICAgIG90LmxlZ2FsaXplKG9wLCBwKTtcblxuICAgICAgICAvLyBSZW1hcCBkZWxhdW5heV9lZGdlXG4gICAgICAgIG90LnNldERlbGF1bmF5RWRnZUNDVyhwLCBkZTEpO1xuICAgICAgICB0LnNldERlbGF1bmF5RWRnZUNXKHAsIGRlMik7XG4gICAgICAgIHQuc2V0RGVsYXVuYXlFZGdlQ0NXKG9wLCBkZTMpO1xuICAgICAgICBvdC5zZXREZWxhdW5heUVkZ2VDVyhvcCwgZGU0KTtcblxuICAgICAgICAvLyBSZW1hcCBjb25zdHJhaW5lZF9lZGdlXG4gICAgICAgIG90LnNldENvbnN0cmFpbmVkRWRnZUNDVyhwLCBjZTEpO1xuICAgICAgICB0LnNldENvbnN0cmFpbmVkRWRnZUNXKHAsIGNlMik7XG4gICAgICAgIHQuc2V0Q29uc3RyYWluZWRFZGdlQ0NXKG9wLCBjZTMpO1xuICAgICAgICBvdC5zZXRDb25zdHJhaW5lZEVkZ2VDVyhvcCwgY2U0KTtcblxuICAgICAgICAvLyBSZW1hcCBuZWlnaGJvcnNcbiAgICAgICAgLy8gWFhYOiBtaWdodCBvcHRpbWl6ZSB0aGUgbWFya05laWdoYm9yIGJ5IGtlZXBpbmcgdHJhY2sgb2ZcbiAgICAgICAgLy8gICAgICB3aGF0IHNpZGUgc2hvdWxkIGJlIGFzc2lnbmVkIHRvIHdoYXQgbmVpZ2hib3IgYWZ0ZXIgdGhlXG4gICAgICAgIC8vICAgICAgcm90YXRpb24uIE5vdyBtYXJrIG5laWdoYm9yIGRvZXMgbG90cyBvZiB0ZXN0aW5nIHRvIGZpbmRcbiAgICAgICAgLy8gICAgICB0aGUgcmlnaHQgc2lkZS5cbiAgICAgICAgdC5jbGVhck5laWdib3JzKCk7XG4gICAgICAgIG90LmNsZWFyTmVpZ2JvcnMoKTtcbiAgICAgICAgaWYgKG4xKSB7XG4gICAgICAgICAgICBvdC5tYXJrTmVpZ2hib3IobjEpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChuMikge1xuICAgICAgICAgICAgdC5tYXJrTmVpZ2hib3IobjIpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChuMykge1xuICAgICAgICAgICAgdC5tYXJrTmVpZ2hib3IobjMpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChuNCkge1xuICAgICAgICAgICAgb3QubWFya05laWdoYm9yKG40KTtcbiAgICAgICAgfVxuICAgICAgICB0Lm1hcmtOZWlnaGJvcihvdCk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEZpbGxzIGEgYmFzaW4gdGhhdCBoYXMgZm9ybWVkIG9uIHRoZSBBZHZhbmNpbmcgRnJvbnQgdG8gdGhlIHJpZ2h0XG4gICAgICogb2YgZ2l2ZW4gbm9kZS48YnI+XG4gICAgICogRmlyc3Qgd2UgZGVjaWRlIGEgbGVmdCxib3R0b20gYW5kIHJpZ2h0IG5vZGUgdGhhdCBmb3JtcyB0aGVcbiAgICAgKiBib3VuZGFyaWVzIG9mIHRoZSBiYXNpbi4gVGhlbiB3ZSBkbyBhIHJlcXVyc2l2ZSBmaWxsLlxuICAgICAqXG4gICAgICogQHBhcmFtIHRjeFxuICAgICAqIEBwYXJhbSBub2RlIC0gc3RhcnRpbmcgbm9kZSwgdGhpcyBvciBuZXh0IG5vZGUgd2lsbCBiZSBsZWZ0IG5vZGVcbiAgICAgKi9cbiAgICBTd2VlcC5maWxsQmFzaW4gPSBmdW5jdGlvbih0Y3gsIG5vZGUpIHtcbiAgICAgICAgaWYgKG9yaWVudDJkKG5vZGUucG9pbnQsIG5vZGUubmV4dC5wb2ludCwgbm9kZS5uZXh0Lm5leHQucG9pbnQpID09PSBPcmllbnRhdGlvbi5DQ1cpIHtcbiAgICAgICAgICAgIHRjeC5iYXNpbi5sZWZ0X25vZGUgPSBub2RlLm5leHQubmV4dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRjeC5iYXNpbi5sZWZ0X25vZGUgPSBub2RlLm5leHQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGaW5kIHRoZSBib3R0b20gYW5kIHJpZ2h0IG5vZGVcbiAgICAgICAgdGN4LmJhc2luLmJvdHRvbV9ub2RlID0gdGN4LmJhc2luLmxlZnRfbm9kZTtcbiAgICAgICAgd2hpbGUgKHRjeC5iYXNpbi5ib3R0b21fbm9kZS5uZXh0ICYmIHRjeC5iYXNpbi5ib3R0b21fbm9kZS5wb2ludC55ID49IHRjeC5iYXNpbi5ib3R0b21fbm9kZS5uZXh0LnBvaW50LnkpIHtcbiAgICAgICAgICAgIHRjeC5iYXNpbi5ib3R0b21fbm9kZSA9IHRjeC5iYXNpbi5ib3R0b21fbm9kZS5uZXh0O1xuICAgICAgICB9XG4gICAgICAgIGlmICh0Y3guYmFzaW4uYm90dG9tX25vZGUgPT09IHRjeC5iYXNpbi5sZWZ0X25vZGUpIHtcbiAgICAgICAgICAgIC8vIE5vIHZhbGlkIGJhc2luXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0Y3guYmFzaW4ucmlnaHRfbm9kZSA9IHRjeC5iYXNpbi5ib3R0b21fbm9kZTtcbiAgICAgICAgd2hpbGUgKHRjeC5iYXNpbi5yaWdodF9ub2RlLm5leHQgJiYgdGN4LmJhc2luLnJpZ2h0X25vZGUucG9pbnQueSA8IHRjeC5iYXNpbi5yaWdodF9ub2RlLm5leHQucG9pbnQueSkge1xuICAgICAgICAgICAgdGN4LmJhc2luLnJpZ2h0X25vZGUgPSB0Y3guYmFzaW4ucmlnaHRfbm9kZS5uZXh0O1xuICAgICAgICB9XG4gICAgICAgIGlmICh0Y3guYmFzaW4ucmlnaHRfbm9kZSA9PT0gdGN4LmJhc2luLmJvdHRvbV9ub2RlKSB7XG4gICAgICAgICAgICAvLyBObyB2YWxpZCBiYXNpbnNcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRjeC5iYXNpbi53aWR0aCA9IHRjeC5iYXNpbi5yaWdodF9ub2RlLnBvaW50LnggLSB0Y3guYmFzaW4ubGVmdF9ub2RlLnBvaW50Lng7XG4gICAgICAgIHRjeC5iYXNpbi5sZWZ0X2hpZ2hlc3QgPSB0Y3guYmFzaW4ubGVmdF9ub2RlLnBvaW50LnkgPiB0Y3guYmFzaW4ucmlnaHRfbm9kZS5wb2ludC55O1xuXG4gICAgICAgIFN3ZWVwLmZpbGxCYXNpblJlcSh0Y3gsIHRjeC5iYXNpbi5ib3R0b21fbm9kZSk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFJlY3Vyc2l2ZSBhbGdvcml0aG0gdG8gZmlsbCBhIEJhc2luIHdpdGggdHJpYW5nbGVzXG4gICAgICpcbiAgICAgKiBAcGFyYW0gdGN4XG4gICAgICogQHBhcmFtIG5vZGUgLSBib3R0b21fbm9kZVxuICAgICAqL1xuICAgIFN3ZWVwLmZpbGxCYXNpblJlcSA9IGZ1bmN0aW9uKHRjeCwgbm9kZSkge1xuICAgICAgICAvLyBpZiBzaGFsbG93IHN0b3AgZmlsbGluZ1xuICAgICAgICBpZiAoU3dlZXAuaXNTaGFsbG93KHRjeCwgbm9kZSkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIFN3ZWVwLmZpbGwodGN4LCBub2RlKTtcblxuICAgICAgICB2YXIgbztcbiAgICAgICAgaWYgKG5vZGUucHJldiA9PT0gdGN4LmJhc2luLmxlZnRfbm9kZSAmJiBub2RlLm5leHQgPT09IHRjeC5iYXNpbi5yaWdodF9ub2RlKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0gZWxzZSBpZiAobm9kZS5wcmV2ID09PSB0Y3guYmFzaW4ubGVmdF9ub2RlKSB7XG4gICAgICAgICAgICBvID0gb3JpZW50MmQobm9kZS5wb2ludCwgbm9kZS5uZXh0LnBvaW50LCBub2RlLm5leHQubmV4dC5wb2ludCk7XG4gICAgICAgICAgICBpZiAobyA9PT0gT3JpZW50YXRpb24uQ1cpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBub2RlID0gbm9kZS5uZXh0O1xuICAgICAgICB9IGVsc2UgaWYgKG5vZGUubmV4dCA9PT0gdGN4LmJhc2luLnJpZ2h0X25vZGUpIHtcbiAgICAgICAgICAgIG8gPSBvcmllbnQyZChub2RlLnBvaW50LCBub2RlLnByZXYucG9pbnQsIG5vZGUucHJldi5wcmV2LnBvaW50KTtcbiAgICAgICAgICAgIGlmIChvID09PSBPcmllbnRhdGlvbi5DQ1cpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBub2RlID0gbm9kZS5wcmV2O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gQ29udGludWUgd2l0aCB0aGUgbmVpZ2hib3Igbm9kZSB3aXRoIGxvd2VzdCBZIHZhbHVlXG4gICAgICAgICAgICBpZiAobm9kZS5wcmV2LnBvaW50LnkgPCBub2RlLm5leHQucG9pbnQueSkge1xuICAgICAgICAgICAgICAgIG5vZGUgPSBub2RlLnByZXY7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5vZGUgPSBub2RlLm5leHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBTd2VlcC5maWxsQmFzaW5SZXEodGN4LCBub2RlKTtcbiAgICB9O1xuXG4gICAgU3dlZXAuaXNTaGFsbG93ID0gZnVuY3Rpb24odGN4LCBub2RlKSB7XG4gICAgICAgIHZhciBoZWlnaHQ7XG4gICAgICAgIGlmICh0Y3guYmFzaW4ubGVmdF9oaWdoZXN0KSB7XG4gICAgICAgICAgICBoZWlnaHQgPSB0Y3guYmFzaW4ubGVmdF9ub2RlLnBvaW50LnkgLSBub2RlLnBvaW50Lnk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBoZWlnaHQgPSB0Y3guYmFzaW4ucmlnaHRfbm9kZS5wb2ludC55IC0gbm9kZS5wb2ludC55O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgc2hhbGxvdyBzdG9wIGZpbGxpbmdcbiAgICAgICAgaWYgKHRjeC5iYXNpbi53aWR0aCA+IGhlaWdodCkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH07XG5cbiAgICBTd2VlcC5maWxsRWRnZUV2ZW50ID0gZnVuY3Rpb24odGN4LCBlZGdlLCBub2RlKSB7XG4gICAgICAgIGlmICh0Y3guZWRnZV9ldmVudC5yaWdodCkge1xuICAgICAgICAgICAgU3dlZXAuZmlsbFJpZ2h0QWJvdmVFZGdlRXZlbnQodGN4LCBlZGdlLCBub2RlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIFN3ZWVwLmZpbGxMZWZ0QWJvdmVFZGdlRXZlbnQodGN4LCBlZGdlLCBub2RlKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBTd2VlcC5maWxsUmlnaHRBYm92ZUVkZ2VFdmVudCA9IGZ1bmN0aW9uKHRjeCwgZWRnZSwgbm9kZSkge1xuICAgICAgICB3aGlsZSAobm9kZS5uZXh0LnBvaW50LnggPCBlZGdlLnAueCkge1xuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgbmV4dCBub2RlIGlzIGJlbG93IHRoZSBlZGdlXG4gICAgICAgICAgICBpZiAob3JpZW50MmQoZWRnZS5xLCBub2RlLm5leHQucG9pbnQsIGVkZ2UucCkgPT09IE9yaWVudGF0aW9uLkNDVykge1xuICAgICAgICAgICAgICAgIFN3ZWVwLmZpbGxSaWdodEJlbG93RWRnZUV2ZW50KHRjeCwgZWRnZSwgbm9kZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5vZGUgPSBub2RlLm5leHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgU3dlZXAuZmlsbFJpZ2h0QmVsb3dFZGdlRXZlbnQgPSBmdW5jdGlvbih0Y3gsIGVkZ2UsIG5vZGUpIHtcbiAgICAgICAgaWYgKG5vZGUucG9pbnQueCA8IGVkZ2UucC54KSB7XG4gICAgICAgICAgICBpZiAob3JpZW50MmQobm9kZS5wb2ludCwgbm9kZS5uZXh0LnBvaW50LCBub2RlLm5leHQubmV4dC5wb2ludCkgPT09IE9yaWVudGF0aW9uLkNDVykge1xuICAgICAgICAgICAgICAgIC8vIENvbmNhdmVcbiAgICAgICAgICAgICAgICBTd2VlcC5maWxsUmlnaHRDb25jYXZlRWRnZUV2ZW50KHRjeCwgZWRnZSwgbm9kZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIENvbnZleFxuICAgICAgICAgICAgICAgIFN3ZWVwLmZpbGxSaWdodENvbnZleEVkZ2VFdmVudCh0Y3gsIGVkZ2UsIG5vZGUpO1xuICAgICAgICAgICAgICAgIC8vIFJldHJ5IHRoaXMgb25lXG4gICAgICAgICAgICAgICAgU3dlZXAuZmlsbFJpZ2h0QmVsb3dFZGdlRXZlbnQodGN4LCBlZGdlLCBub2RlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBTd2VlcC5maWxsUmlnaHRDb25jYXZlRWRnZUV2ZW50ID0gZnVuY3Rpb24odGN4LCBlZGdlLCBub2RlKSB7XG4gICAgICAgIFN3ZWVwLmZpbGwodGN4LCBub2RlLm5leHQpO1xuICAgICAgICBpZiAobm9kZS5uZXh0LnBvaW50ICE9PSBlZGdlLnApIHtcbiAgICAgICAgICAgIC8vIE5leHQgYWJvdmUgb3IgYmVsb3cgZWRnZT9cbiAgICAgICAgICAgIGlmIChvcmllbnQyZChlZGdlLnEsIG5vZGUubmV4dC5wb2ludCwgZWRnZS5wKSA9PT0gT3JpZW50YXRpb24uQ0NXKSB7XG4gICAgICAgICAgICAgICAgLy8gQmVsb3dcbiAgICAgICAgICAgICAgICBpZiAob3JpZW50MmQobm9kZS5wb2ludCwgbm9kZS5uZXh0LnBvaW50LCBub2RlLm5leHQubmV4dC5wb2ludCkgPT09IE9yaWVudGF0aW9uLkNDVykge1xuICAgICAgICAgICAgICAgICAgICAvLyBOZXh0IGlzIGNvbmNhdmVcbiAgICAgICAgICAgICAgICAgICAgU3dlZXAuZmlsbFJpZ2h0Q29uY2F2ZUVkZ2VFdmVudCh0Y3gsIGVkZ2UsIG5vZGUpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIE5leHQgaXMgY29udmV4XG4gICAgICAgICAgICAgICAgICAgIC8qIGpzaGludCBub2VtcHR5OmZhbHNlICovXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIFN3ZWVwLmZpbGxSaWdodENvbnZleEVkZ2VFdmVudCA9IGZ1bmN0aW9uKHRjeCwgZWRnZSwgbm9kZSkge1xuICAgICAgICAvLyBOZXh0IGNvbmNhdmUgb3IgY29udmV4P1xuICAgICAgICBpZiAob3JpZW50MmQobm9kZS5uZXh0LnBvaW50LCBub2RlLm5leHQubmV4dC5wb2ludCwgbm9kZS5uZXh0Lm5leHQubmV4dC5wb2ludCkgPT09IE9yaWVudGF0aW9uLkNDVykge1xuICAgICAgICAgICAgLy8gQ29uY2F2ZVxuICAgICAgICAgICAgU3dlZXAuZmlsbFJpZ2h0Q29uY2F2ZUVkZ2VFdmVudCh0Y3gsIGVkZ2UsIG5vZGUubmV4dCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBDb252ZXhcbiAgICAgICAgICAgIC8vIE5leHQgYWJvdmUgb3IgYmVsb3cgZWRnZT9cbiAgICAgICAgICAgIGlmIChvcmllbnQyZChlZGdlLnEsIG5vZGUubmV4dC5uZXh0LnBvaW50LCBlZGdlLnApID09PSBPcmllbnRhdGlvbi5DQ1cpIHtcbiAgICAgICAgICAgICAgICAvLyBCZWxvd1xuICAgICAgICAgICAgICAgIFN3ZWVwLmZpbGxSaWdodENvbnZleEVkZ2VFdmVudCh0Y3gsIGVkZ2UsIG5vZGUubmV4dCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIEFib3ZlXG4gICAgICAgICAgICAgICAgLyoganNoaW50IG5vZW1wdHk6ZmFsc2UgKi9cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBTd2VlcC5maWxsTGVmdEFib3ZlRWRnZUV2ZW50ID0gZnVuY3Rpb24odGN4LCBlZGdlLCBub2RlKSB7XG4gICAgICAgIHdoaWxlIChub2RlLnByZXYucG9pbnQueCA+IGVkZ2UucC54KSB7XG4gICAgICAgICAgICAvLyBDaGVjayBpZiBuZXh0IG5vZGUgaXMgYmVsb3cgdGhlIGVkZ2VcbiAgICAgICAgICAgIGlmIChvcmllbnQyZChlZGdlLnEsIG5vZGUucHJldi5wb2ludCwgZWRnZS5wKSA9PT0gT3JpZW50YXRpb24uQ1cpIHtcbiAgICAgICAgICAgICAgICBTd2VlcC5maWxsTGVmdEJlbG93RWRnZUV2ZW50KHRjeCwgZWRnZSwgbm9kZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5vZGUgPSBub2RlLnByZXY7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgU3dlZXAuZmlsbExlZnRCZWxvd0VkZ2VFdmVudCA9IGZ1bmN0aW9uKHRjeCwgZWRnZSwgbm9kZSkge1xuICAgICAgICBpZiAobm9kZS5wb2ludC54ID4gZWRnZS5wLngpIHtcbiAgICAgICAgICAgIGlmIChvcmllbnQyZChub2RlLnBvaW50LCBub2RlLnByZXYucG9pbnQsIG5vZGUucHJldi5wcmV2LnBvaW50KSA9PT0gT3JpZW50YXRpb24uQ1cpIHtcbiAgICAgICAgICAgICAgICAvLyBDb25jYXZlXG4gICAgICAgICAgICAgICAgU3dlZXAuZmlsbExlZnRDb25jYXZlRWRnZUV2ZW50KHRjeCwgZWRnZSwgbm9kZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIENvbnZleFxuICAgICAgICAgICAgICAgIFN3ZWVwLmZpbGxMZWZ0Q29udmV4RWRnZUV2ZW50KHRjeCwgZWRnZSwgbm9kZSk7XG4gICAgICAgICAgICAgICAgLy8gUmV0cnkgdGhpcyBvbmVcbiAgICAgICAgICAgICAgICBTd2VlcC5maWxsTGVmdEJlbG93RWRnZUV2ZW50KHRjeCwgZWRnZSwgbm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgU3dlZXAuZmlsbExlZnRDb252ZXhFZGdlRXZlbnQgPSBmdW5jdGlvbih0Y3gsIGVkZ2UsIG5vZGUpIHtcbiAgICAgICAgLy8gTmV4dCBjb25jYXZlIG9yIGNvbnZleD9cbiAgICAgICAgaWYgKG9yaWVudDJkKG5vZGUucHJldi5wb2ludCwgbm9kZS5wcmV2LnByZXYucG9pbnQsIG5vZGUucHJldi5wcmV2LnByZXYucG9pbnQpID09PSBPcmllbnRhdGlvbi5DVykge1xuICAgICAgICAgICAgLy8gQ29uY2F2ZVxuICAgICAgICAgICAgU3dlZXAuZmlsbExlZnRDb25jYXZlRWRnZUV2ZW50KHRjeCwgZWRnZSwgbm9kZS5wcmV2KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIENvbnZleFxuICAgICAgICAgICAgLy8gTmV4dCBhYm92ZSBvciBiZWxvdyBlZGdlP1xuICAgICAgICAgICAgaWYgKG9yaWVudDJkKGVkZ2UucSwgbm9kZS5wcmV2LnByZXYucG9pbnQsIGVkZ2UucCkgPT09IE9yaWVudGF0aW9uLkNXKSB7XG4gICAgICAgICAgICAgICAgLy8gQmVsb3dcbiAgICAgICAgICAgICAgICBTd2VlcC5maWxsTGVmdENvbnZleEVkZ2VFdmVudCh0Y3gsIGVkZ2UsIG5vZGUucHJldik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIEFib3ZlXG4gICAgICAgICAgICAgICAgLyoganNoaW50IG5vZW1wdHk6ZmFsc2UgKi9cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBTd2VlcC5maWxsTGVmdENvbmNhdmVFZGdlRXZlbnQgPSBmdW5jdGlvbih0Y3gsIGVkZ2UsIG5vZGUpIHtcbiAgICAgICAgU3dlZXAuZmlsbCh0Y3gsIG5vZGUucHJldik7XG4gICAgICAgIGlmIChub2RlLnByZXYucG9pbnQgIT09IGVkZ2UucCkge1xuICAgICAgICAgICAgLy8gTmV4dCBhYm92ZSBvciBiZWxvdyBlZGdlP1xuICAgICAgICAgICAgaWYgKG9yaWVudDJkKGVkZ2UucSwgbm9kZS5wcmV2LnBvaW50LCBlZGdlLnApID09PSBPcmllbnRhdGlvbi5DVykge1xuICAgICAgICAgICAgICAgIC8vIEJlbG93XG4gICAgICAgICAgICAgICAgaWYgKG9yaWVudDJkKG5vZGUucG9pbnQsIG5vZGUucHJldi5wb2ludCwgbm9kZS5wcmV2LnByZXYucG9pbnQpID09PSBPcmllbnRhdGlvbi5DVykge1xuICAgICAgICAgICAgICAgICAgICAvLyBOZXh0IGlzIGNvbmNhdmVcbiAgICAgICAgICAgICAgICAgICAgU3dlZXAuZmlsbExlZnRDb25jYXZlRWRnZUV2ZW50KHRjeCwgZWRnZSwgbm9kZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gTmV4dCBpcyBjb252ZXhcbiAgICAgICAgICAgICAgICAgICAgLyoganNoaW50IG5vZW1wdHk6ZmFsc2UgKi9cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgU3dlZXAuZmxpcEVkZ2VFdmVudCA9IGZ1bmN0aW9uKHRjeCwgZXAsIGVxLCB0LCBwKSB7XG4gICAgICAgIHZhciBvdCA9IHQubmVpZ2hib3JBY3Jvc3MocCk7XG4gICAgICAgIGlmICghb3QpIHtcbiAgICAgICAgICAgIC8vIElmIHdlIHdhbnQgdG8gaW50ZWdyYXRlIHRoZSBmaWxsRWRnZUV2ZW50IGRvIGl0IGhlcmVcbiAgICAgICAgICAgIC8vIFdpdGggY3VycmVudCBpbXBsZW1lbnRhdGlvbiB3ZSBzaG91bGQgbmV2ZXIgZ2V0IGhlcmVcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigncG9seTJ0cmkgW0JVRzpGSVhNRV0gRkxJUCBmYWlsZWQgZHVlIHRvIG1pc3NpbmcgdHJpYW5nbGUhJyk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIG9wID0gb3Qub3Bwb3NpdGVQb2ludCh0LCBwKTtcblxuICAgICAgICBpZiAoaW5TY2FuQXJlYShwLCB0LnBvaW50Q0NXKHApLCB0LnBvaW50Q1cocCksIG9wKSkge1xuICAgICAgICAgICAgLy8gTGV0cyByb3RhdGUgc2hhcmVkIGVkZ2Ugb25lIHZlcnRleCBDV1xuICAgICAgICAgICAgU3dlZXAucm90YXRlVHJpYW5nbGVQYWlyKHQsIHAsIG90LCBvcCk7XG4gICAgICAgICAgICB0Y3gubWFwVHJpYW5nbGVUb05vZGVzKHQpO1xuICAgICAgICAgICAgdGN4Lm1hcFRyaWFuZ2xlVG9Ob2RlcyhvdCk7XG5cbiAgICAgICAgICAgIC8vIFhYWDogaW4gdGhlIG9yaWdpbmFsIEMrKyBjb2RlIGZvciB0aGUgbmV4dCAyIGxpbmVzLCB3ZSBhcmVcbiAgICAgICAgICAgIC8vIGNvbXBhcmluZyBwb2ludCB2YWx1ZXMgKGFuZCBub3QgcG9pbnRlcnMpLiBJbiB0aGlzIEphdmFTY3JpcHRcbiAgICAgICAgICAgIC8vIGNvZGUsIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcyAocG9pbnRlcnMpLiBUaGlzIHdvcmtzXG4gICAgICAgICAgICAvLyBiZWNhdXNlIHdlIGNhbid0IGhhdmUgMiBkaWZmZXJlbnQgcG9pbnRzIHdpdGggdGhlIHNhbWUgdmFsdWVzLlxuICAgICAgICAgICAgLy8gQnV0IHRvIGJlIHJlYWxseSBlcXVpdmFsZW50LCB3ZSBzaG91bGQgdXNlIFwiUG9pbnQuZXF1YWxzXCIgaGVyZS5cbiAgICAgICAgICAgIGlmIChwID09PSBlcSAmJiBvcCA9PT0gZXApIHtcbiAgICAgICAgICAgICAgICBpZiAoZXEgPT09IHRjeC5lZGdlX2V2ZW50LmNvbnN0cmFpbmVkX2VkZ2UucSAmJiBlcCA9PT0gdGN4LmVkZ2VfZXZlbnQuY29uc3RyYWluZWRfZWRnZS5wKSB7XG4gICAgICAgICAgICAgICAgICAgIHQubWFya0NvbnN0cmFpbmVkRWRnZUJ5UG9pbnRzKGVwLCBlcSk7XG4gICAgICAgICAgICAgICAgICAgIG90Lm1hcmtDb25zdHJhaW5lZEVkZ2VCeVBvaW50cyhlcCwgZXEpO1xuICAgICAgICAgICAgICAgICAgICBTd2VlcC5sZWdhbGl6ZSh0Y3gsIHQpO1xuICAgICAgICAgICAgICAgICAgICBTd2VlcC5sZWdhbGl6ZSh0Y3gsIG90KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBYWFg6IEkgdGhpbmsgb25lIG9mIHRoZSB0cmlhbmdsZXMgc2hvdWxkIGJlIGxlZ2FsaXplZCBoZXJlP1xuICAgICAgICAgICAgICAgICAgICAvKiBqc2hpbnQgbm9lbXB0eTpmYWxzZSAqL1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIG8gPSBvcmllbnQyZChlcSwgb3AsIGVwKTtcbiAgICAgICAgICAgICAgICB0ID0gU3dlZXAubmV4dEZsaXBUcmlhbmdsZSh0Y3gsIG8sIHQsIG90LCBwLCBvcCk7XG4gICAgICAgICAgICAgICAgU3dlZXAuZmxpcEVkZ2VFdmVudCh0Y3gsIGVwLCBlcSwgdCwgcCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgbmV3UCA9IFN3ZWVwLm5leHRGbGlwUG9pbnQoZXAsIGVxLCBvdCwgb3ApO1xuICAgICAgICAgICAgU3dlZXAuZmxpcFNjYW5FZGdlRXZlbnQodGN4LCBlcCwgZXEsIHQsIG90LCBuZXdQKTtcbiAgICAgICAgICAgIFN3ZWVwLmVkZ2VFdmVudEJ5UG9pbnRzKHRjeCwgZXAsIGVxLCB0LCBwKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBTd2VlcC5uZXh0RmxpcFRyaWFuZ2xlID0gZnVuY3Rpb24odGN4LCBvLCB0LCBvdCwgcCwgb3ApIHtcbiAgICAgICAgdmFyIGVkZ2VfaW5kZXg7XG4gICAgICAgIGlmIChvID09PSBPcmllbnRhdGlvbi5DQ1cpIHtcbiAgICAgICAgICAgIC8vIG90IGlzIG5vdCBjcm9zc2luZyBlZGdlIGFmdGVyIGZsaXBcbiAgICAgICAgICAgIGVkZ2VfaW5kZXggPSBvdC5lZGdlSW5kZXgocCwgb3ApO1xuICAgICAgICAgICAgb3QuZGVsYXVuYXlfZWRnZVtlZGdlX2luZGV4XSA9IHRydWU7XG4gICAgICAgICAgICBTd2VlcC5sZWdhbGl6ZSh0Y3gsIG90KTtcbiAgICAgICAgICAgIG90LmNsZWFyRGVsdW5heUVkZ2VzKCk7XG4gICAgICAgICAgICByZXR1cm4gdDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHQgaXMgbm90IGNyb3NzaW5nIGVkZ2UgYWZ0ZXIgZmxpcFxuICAgICAgICBlZGdlX2luZGV4ID0gdC5lZGdlSW5kZXgocCwgb3ApO1xuXG4gICAgICAgIHQuZGVsYXVuYXlfZWRnZVtlZGdlX2luZGV4XSA9IHRydWU7XG4gICAgICAgIFN3ZWVwLmxlZ2FsaXplKHRjeCwgdCk7XG4gICAgICAgIHQuY2xlYXJEZWx1bmF5RWRnZXMoKTtcbiAgICAgICAgcmV0dXJuIG90O1xuICAgIH07XG5cbiAgICBTd2VlcC5uZXh0RmxpcFBvaW50ID0gZnVuY3Rpb24oZXAsIGVxLCBvdCwgb3ApIHtcbiAgICAgICAgdmFyIG8yZCA9IG9yaWVudDJkKGVxLCBvcCwgZXApO1xuICAgICAgICBpZiAobzJkID09PSBPcmllbnRhdGlvbi5DVykge1xuICAgICAgICAgICAgLy8gUmlnaHRcbiAgICAgICAgICAgIHJldHVybiBvdC5wb2ludENDVyhvcCk7XG4gICAgICAgIH0gZWxzZSBpZiAobzJkID09PSBPcmllbnRhdGlvbi5DQ1cpIHtcbiAgICAgICAgICAgIC8vIExlZnRcbiAgICAgICAgICAgIHJldHVybiBvdC5wb2ludENXKG9wKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBQb2ludEVycm9yKFwicG9seTJ0cmkgW1Vuc3VwcG9ydGVkXSBuZXh0RmxpcFBvaW50OiBvcHBvc2luZyBwb2ludCBvbiBjb25zdHJhaW5lZCBlZGdlIVwiLCBbZXEsIG9wLCBlcF0pO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIFN3ZWVwLmZsaXBTY2FuRWRnZUV2ZW50ID0gZnVuY3Rpb24odGN4LCBlcCwgZXEsIGZsaXBfdHJpYW5nbGUsIHQsIHApIHtcbiAgICAgICAgdmFyIG90ID0gdC5uZWlnaGJvckFjcm9zcyhwKTtcbiAgICAgICAgaWYgKCFvdCkge1xuICAgICAgICAgICAgLy8gSWYgd2Ugd2FudCB0byBpbnRlZ3JhdGUgdGhlIGZpbGxFZGdlRXZlbnQgZG8gaXQgaGVyZVxuICAgICAgICAgICAgLy8gV2l0aCBjdXJyZW50IGltcGxlbWVudGF0aW9uIHdlIHNob3VsZCBuZXZlciBnZXQgaGVyZVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdwb2x5MnRyaSBbQlVHOkZJWE1FXSBGTElQIGZhaWxlZCBkdWUgdG8gbWlzc2luZyB0cmlhbmdsZScpO1xuICAgICAgICB9XG4gICAgICAgIHZhciBvcCA9IG90Lm9wcG9zaXRlUG9pbnQodCwgcCk7XG5cbiAgICAgICAgaWYgKGluU2NhbkFyZWEoZXEsIGZsaXBfdHJpYW5nbGUucG9pbnRDQ1coZXEpLCBmbGlwX3RyaWFuZ2xlLnBvaW50Q1coZXEpLCBvcCkpIHtcbiAgICAgICAgICAgIC8vIGZsaXAgd2l0aCBuZXcgZWRnZSBvcC5lcVxuICAgICAgICAgICAgU3dlZXAuZmxpcEVkZ2VFdmVudCh0Y3gsIGVxLCBvcCwgb3QsIG9wKTtcbiAgICAgICAgICAgIC8vIFRPRE86IEFjdHVhbGx5IEkganVzdCBmaWd1cmVkIG91dCB0aGF0IGl0IHNob3VsZCBiZSBwb3NzaWJsZSB0b1xuICAgICAgICAgICAgLy8gICAgICAgaW1wcm92ZSB0aGlzIGJ5IGdldHRpbmcgdGhlIG5leHQgb3QgYW5kIG9wIGJlZm9yZSB0aGUgdGhlIGFib3ZlXG4gICAgICAgICAgICAvLyAgICAgICBmbGlwIGFuZCBjb250aW51ZSB0aGUgZmxpcFNjYW5FZGdlRXZlbnQgaGVyZVxuICAgICAgICAgICAgLy8gc2V0IG5ldyBvdCBhbmQgb3AgaGVyZSBhbmQgbG9vcCBiYWNrIHRvIGluU2NhbkFyZWEgdGVzdFxuICAgICAgICAgICAgLy8gYWxzbyBuZWVkIHRvIHNldCBhIG5ldyBmbGlwX3RyaWFuZ2xlIGZpcnN0XG4gICAgICAgICAgICAvLyBUdXJucyBvdXQgYXQgZmlyc3QgZ2xhbmNlIHRoYXQgdGhpcyBpcyBzb21ld2hhdCBjb21wbGljYXRlZFxuICAgICAgICAgICAgLy8gc28gaXQgd2lsbCBoYXZlIHRvIHdhaXQuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgbmV3UCA9IFN3ZWVwLm5leHRGbGlwUG9pbnQoZXAsIGVxLCBvdCwgb3ApO1xuICAgICAgICAgICAgU3dlZXAuZmxpcFNjYW5FZGdlRXZlbnQodGN4LCBlcCwgZXEsIGZsaXBfdHJpYW5nbGUsIG90LCBuZXdQKTtcbiAgICAgICAgfVxuICAgIH07XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLUV4cG9ydHMgKHB1YmxpYyBBUEkpXG5cbiAgICBwb2x5MnRyaS5Qb2ludEVycm9yICAgICA9IFBvaW50RXJyb3I7XG4gICAgcG9seTJ0cmkuUG9pbnQgICAgICAgICAgPSBQb2ludDtcbiAgICBwb2x5MnRyaS5UcmlhbmdsZSAgICAgICA9IFRyaWFuZ2xlO1xuICAgIHBvbHkydHJpLlN3ZWVwQ29udGV4dCAgID0gU3dlZXBDb250ZXh0O1xuXG4gICAgLy8gQmFja3dhcmQgY29tcGF0aWJpbGl0eVxuICAgIHBvbHkydHJpLnRyaWFuZ3VsYXRlICAgID0gU3dlZXAudHJpYW5ndWxhdGU7XG4gICAgcG9seTJ0cmkuc3dlZXAgPSB7VHJpYW5ndWxhdGU6IFN3ZWVwLnRyaWFuZ3VsYXRlfTtcblxufSh0aGlzKSk7IiwidmFyIGdsTWF0cml4ID0gcmVxdWlyZSgnLi4vanMvZ2wtbWF0cml4LW1pbi5qcycpO1xudmFyIHZlYzMgPSBnbE1hdHJpeC52ZWMzO1xuXG5cbihmdW5jdGlvbihfZ2xvYmFsKSB7IFxuICBcInVzZSBzdHJpY3RcIjtcblxuICB2YXIgc2hpbSA9IHt9O1xuICBpZiAodHlwZW9mKGV4cG9ydHMpID09PSAndW5kZWZpbmVkJykge1xuICAgIGlmKHR5cGVvZiBkZWZpbmUgPT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PSAnb2JqZWN0JyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgICBzaGltLmV4cG9ydHMgPSB7fTtcbiAgICAgIGRlZmluZShmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHNoaW0uZXhwb3J0cztcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvL3RoaXMgdGhpbmcgbGl2ZXMgaW4gYSBicm93c2VyLCBkZWZpbmUgaXRzIG5hbWVzcGFjZXMgaW4gZ2xvYmFsXG4gICAgICBzaGltLmV4cG9ydHMgPSB0eXBlb2Yod2luZG93KSAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cgOiBfZ2xvYmFsO1xuICAgIH1cbiAgfVxuICBlbHNlIHtcbiAgICAvL3RoaXMgdGhpbmcgbGl2ZXMgaW4gY29tbW9uanMsIGRlZmluZSBpdHMgbmFtZXNwYWNlcyBpbiBleHBvcnRzXG4gICAgc2hpbS5leHBvcnRzID0gZXhwb3J0cztcbiAgfVxuICAoZnVuY3Rpb24oZXhwb3J0cykge1xuICBcbnZhciBnbDtcbnZhciB2Ym9NZXNoID0gZXhwb3J0cztcblxudmJvTWVzaC5zZXRHTCA9IGZ1bmN0aW9uKF9nbCkge1xuICBnbCA9IF9nbDtcbn1cblxudmJvTWVzaC5jcmVhdGUgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgdmJvID0ge307XG4gICAgdmJvLnZlcnRleERhdGEgPSBuZXcgRmxvYXQzMkFycmF5KDMqMTAwKTtcbiAgICB2Ym8ubnVtVmVydGljZXMgPSAwO1xuICAgIHZiby5pbmRleERhdGEgPSBuZXcgVWludDE2QXJyYXkoMyoxMDApO1xuICAgIHZiby5udW1JbmRpY2VzID0gMDtcbiAgICB2Ym8udmVydGV4QnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKCk7XG4gICAgdmJvLmluZGV4QnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKCk7XG4gICAgdmJvLm51bU5vcm1hbHMgPSAwO1xuICAgIHZiby5ub3JtYWxzRW5hYmxlZCA9IGZhbHNlO1xuICAgIHZiby5ub3JtYWxEYXRhID0gbnVsbDtcbiAgICB2Ym8uY29sb3JFbmFibGVkID0gZmFsc2U7XG4gICAgdmJvLmNvbG9yRGF0YT0gbnVsbDtcbiAgICB2Ym8ubm9ybWFsQnVmZmVyID0gbnVsbDtcbiAgICB2Ym8uY29sb3JCdWZmZXIgPSBudWxsO1xuICAgIHJldHVybiB2Ym87XG59O1xuXG52Ym9NZXNoLmNyZWF0ZTMyID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHZibyA9IHt9O1xuICAgIHZiby52ZXJ0ZXhEYXRhID0gbmV3IEZsb2F0MzJBcnJheSgzKjEwMDApO1xuICAgIHZiby5udW1WZXJ0aWNlcyA9IDA7XG4gICAgdmJvLmluZGV4RGF0YSA9IG5ldyBVaW50MzJBcnJheSgzKjEwMDApO1xuICAgIHZiby5udW1JbmRpY2VzID0gMDtcbiAgICB2Ym8udmVydGV4QnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKCk7XG4gICAgdmJvLmluZGV4QnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKCk7XG4gICAgdmJvLm5vcm1hbHNFbmFibGVkID0gZmFsc2U7XG4gICAgdmJvLm51bU5vcm1hbHMgPSAwO1xuICAgIHZiby5ub3JtYWxEYXRhID0gbnVsbDtcbiAgICB2Ym8uY29sb3JEYXRhPSBudWxsO1xuICAgIHZiby5ub3JtYWxCdWZmZXIgPSBudWxsO1xuICAgIHZiby5jb2xvckJ1ZmZlciA9IG51bGw7XG4gICAgcmV0dXJuIHZibztcbn07XG5cbnZib01lc2guY2xlYXIgPSBmdW5jdGlvbih2Ym8pIHtcbiAgICB2Ym8ubnVtVmVydGljZXMgPSAwO1xuICAgIHZiby5udW1JbmRpY2VzID0gMDtcbiAgICB2Ym8ubnVtTm9ybWFscyA9IDA7XG59XG5cbnZib01lc2guZW5hYmxlTm9ybWFscyA9IGZ1bmN0aW9uKHZibykge1xuICAgIGlmKCF2Ym8ubm9ybWFsc0VuYWJsZWQpIHtcbiAgICAgICAgdmJvLm5vcm1hbERhdGEgPSBuZXcgRmxvYXQzMkFycmF5KHZiby52ZXJ0ZXhEYXRhLmxlbmd0aCk7XG4gICAgICAgIGlmKHZiby5ub3JtYWxCdWZmZXIgPT09IG51bGwpIHZiby5ub3JtYWxCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgICAgICAgdmJvLm5vcm1hbHNFbmFibGVkID0gdHJ1ZTtcbiAgICB9XG59XG5cbnZib01lc2guZGlzYWJsZU5vcm1hbHMgPSBmdW5jdGlvbih2Ym8pIHtcbiAgICB2Ym8ubm9ybWFsRGF0YSA9IG51bGw7XG4gICAgaWYodmJvLm5vcm1hbEJ1ZmZlciAhPT0gbnVsbCkgZ2wuZGVsZXRlQnVmZmVyKHZiby5ub3JtYWxCdWZmZXIpO1xuICAgIHZiby5ub3JtYWxzRW5hYmxlZCA9IGZhbHNlO1xufVxuXG52Ym9NZXNoLmVuYWJsZUNvbG9yID0gZnVuY3Rpb24odmJvKSB7XG4gIGlmKCF2Ym8uY29sb3JFbmFibGVkKSB7XG4gICAgdmJvLmNvbG9yRGF0YSA9IG5ldyBVaW50OEFycmF5KHZiby52ZXJ0ZXhEYXRhLmxlbmd0aC8zKjQpO1xuICAgIGlmKHZiby5jb2xvckJ1ZmZlciA9PT0gbnVsbCkgdmJvLmNvbG9yQnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKCk7XG4gICAgdmJvLmNvbG9yRW5hYmxlZCA9IHRydWU7XG4gIH1cbn1cblxudmJvTWVzaC5kaXNhYmxlQ29sb3IgPSBmdW5jdGlvbih2Ym8pIHtcbiAgICB2Ym8uY29sb3JEYXRhID0gbnVsbDtcbiAgICBpZih2Ym8uY29sb3JCdWZmZXIgIT09IG51bGwpIGdsLmRlbGV0ZUJ1ZmZlcih2Ym8uY29sb3JCdWZmZXIpO1xuICAgIHZiby5jb2xvckVuYWJsZWQgPSBmYWxzZTtcbn1cblxudmJvTWVzaC5hZGRWZXJ0ZXggPSBmdW5jdGlvbih2Ym8sIHYsbikge1xuICAgIHZhciBpbmRleCA9IHZiby5udW1WZXJ0aWNlcyozO1xuXHRpZihpbmRleCA+PSB2Ym8udmVydGV4RGF0YS5sZW5ndGgpIHtcblx0XHR2YXIgbmV3RGF0YSA9IG5ldyBGbG9hdDMyQXJyYXkodmJvLnZlcnRleERhdGEubGVuZ3RoKjIpO1xuXHRcdG5ld0RhdGEuc2V0KHZiby52ZXJ0ZXhEYXRhKTtcblx0XHQvL2RvIGkgbmVlZCB0byBleHBsaWNpdGx5IGtpbGwgdGhlIG9sZCB2ZXJ0ZXhEYXRhP1xuXHRcdHZiby52ZXJ0ZXhEYXRhID0gbmV3RGF0YTtcbiAgICBpZih2Ym8ubm9ybWFsc0VuYWJsZWQpIHtcbiAgICAgICAgdmFyIG5ld0RhdGEgPSBuZXcgRmxvYXQzMkFycmF5KHZiby52ZXJ0ZXhEYXRhLmxlbmd0aCk7XG4gICAgICAgIG5ld0RhdGEuc2V0KHZiby5ub3JtYWxEYXRhKTtcbiAgICAgICAgLy9kbyBpIG5lZWQgdG8gZXhwbGljaXRseSBraWxsIHRoZSBvbGQgdmVydGV4RGF0YT9cbiAgICAgICAgdmJvLm5vcm1hbERhdGEgPSBuZXdEYXRhO1xuICAgIH1cbiAgICBpZih2Ym8uY29sb3JFbmFibGVkKSB7XG4gICAgICB2YXIgbmV3RGF0YSA9IG5ldyBVaW50OEFycmF5KHZiby52ZXJ0ZXhEYXRhLmxlbmd0aC8zKjQpO1xuICAgICAgbmV3RGF0YS5zZXQodmJvLmNvbG9yRGF0YSk7XG4gICAgICAvL2RvIGkgbmVlZCB0byBleHBsaWNpdGx5IGtpbGwgdGhlIG9sZCB2ZXJ0ZXhEYXRhP1xuICAgICAgdmJvLmNvbG9yRGF0YSA9IG5ld0RhdGE7XG4gICAgfVxuXHR9XG4gICAgdmJvLnZlcnRleERhdGFbaW5kZXhdID0gdlswXTtcbiAgICB2Ym8udmVydGV4RGF0YVtpbmRleCsxXSA9IHZbMV07XG4gICAgdmJvLnZlcnRleERhdGFbaW5kZXgrMl0gPSB2WzJdO1xuICAgIGlmKG4gJiYgdmJvLm5vcm1hbHNFbmFibGVkKSB7XG4gICAgICAgIHZiby5ub3JtYWxEYXRhW2luZGV4XSA9IG5bMF07XG4gICAgICAgIHZiby5ub3JtYWxEYXRhW2luZGV4KzFdID0gblsxXTtcbiAgICAgICAgdmJvLm5vcm1hbERhdGFbaW5kZXgrMl0gPSBuWzJdO1xuICAgIH1cbiAgICB2Ym8ubnVtVmVydGljZXMrKztcbn1cblxudmJvTWVzaC5nZXRWZXJ0ZXggPSBmdW5jdGlvbihvdXQsIHZibywgaSkge1xuICB2YXIgaTMgPSBpKjM7XG4gIG91dFswXSA9IHZiby52ZXJ0ZXhEYXRhW2kzXTtcbiAgb3V0WzFdID0gdmJvLnZlcnRleERhdGFbaTMrMV07XG4gIG91dFsyXSA9IHZiby52ZXJ0ZXhEYXRhW2kzKzJdO1xufVxuXG52Ym9NZXNoLnNldFZlcnRleCA9IGZ1bmN0aW9uKHZibywgaSwgcHQpIHtcbiAgdmFyIGkzID0gaSozO1xuICB2Ym8udmVydGV4RGF0YVtpM10gPSBwdFswXTtcbiAgdmJvLnZlcnRleERhdGFbaTMrMV0gPSBwdFsxXTtcbiAgdmJvLnZlcnRleERhdGFbaTMrMl0gPSBwdFsyXTtcbn1cblxudmJvTWVzaC5zZXROb3JtYWwgPSBmdW5jdGlvbih2Ym8sIGksIHB0KSB7XG4gIHZhciBpMyA9IGkqMztcbiAgdmJvLm5vcm1hbERhdGFbaTNdID0gcHRbMF07XG4gIHZiby5ub3JtYWxEYXRhW2kzKzFdID0gcHRbMV07XG4gIHZiby5ub3JtYWxEYXRhW2kzKzJdID0gcHRbMl07XG59XG5cbnZib01lc2guZ2V0Tm9ybWFsID0gZnVuY3Rpb24obiwgdmJvLCBpKSB7XG4gIHZhciBpMyA9IGkqMztcbiAgblswXSA9IHZiby5ub3JtYWxEYXRhW2kzXTtcbiAgblsxXSA9IHZiby5ub3JtYWxEYXRhW2kzKzFdO1xuICBuWzJdID0gdmJvLm5vcm1hbERhdGFbaTMrMl07XG59XG52Ym9NZXNoLnNldENvbG9yID0gZnVuY3Rpb24odmJvLCBpLCBjKSB7XG4gIHZhciBpNCA9IGkqNDtcbiAgdmJvLmNvbG9yRGF0YVtpNF0gPSBjWzBdO1xuICB2Ym8uY29sb3JEYXRhW2k0KzFdID0gY1sxXTtcbiAgdmJvLmNvbG9yRGF0YVtpNCsyXSA9IGNbMl07XG4gIHZiby5jb2xvckRhdGFbaTQrM10gPSBjWzNdID09PSB1bmRlZmluZWQgPyAyNTUgOiBjWzNdO1xufVxuXG52Ym9NZXNoLmFkZFRyaWFuZ2xlID0gZnVuY3Rpb24odmJvLCBpMSxpMixpMykge1xuXHRpZih2Ym8ubnVtSW5kaWNlcyA+PSB2Ym8uaW5kZXhEYXRhLmxlbmd0aCkge1xuXHRcdHZhciBuZXdEYXRhID0gbmV3IHZiby5pbmRleERhdGEuY29uc3RydWN0b3IodmJvLmluZGV4RGF0YS5sZW5ndGgqMik7XG5cdFx0bmV3RGF0YS5zZXQodmJvLmluZGV4RGF0YSk7XG5cdFx0Ly9kbyBpIG5lZWQgdG8gZXhwbGljaXRseSBraWxsIHRoZSBvbGQgdmVydGV4RGF0YT9cblx0XHR2Ym8uaW5kZXhEYXRhID0gbmV3RGF0YTtcblx0fVxuICAgIHZiby5pbmRleERhdGFbdmJvLm51bUluZGljZXMrK10gPSBpMTtcbiAgICB2Ym8uaW5kZXhEYXRhW3Ziby5udW1JbmRpY2VzKytdID0gaTI7XG4gICAgdmJvLmluZGV4RGF0YVt2Ym8ubnVtSW5kaWNlcysrXSA9IGkzO1xufVxuXG52Ym9NZXNoLmFkZEluZGljZXMgPSBmdW5jdGlvbih2Ym8sIGluZGljZXMsbnVtSW5kaWNlcykge1xuXHRpZih2Ym8ubnVtSW5kaWNlcytudW1JbmRpY2VzID49IHZiby5pbmRleERhdGEubGVuZ3RoKSB7XG5cdFx0dmFyIG5ld0RhdGEgPSBuZXcgdmJvLmluZGV4RGF0YS5jb25zdHJ1Y3RvcihNYXRoLm1heCh2Ym8uaW5kZXhEYXRhLmxlbmd0aCoyLHZiby5pbmRleERhdGEubGVuZ3RoK251bUluZGljZXMpKTtcblx0XHRuZXdEYXRhLnNldCh2Ym8uaW5kZXhEYXRhKTtcblx0XHQvL2RvIGkgbmVlZCB0byBleHBsaWNpdGx5IGtpbGwgdGhlIG9sZCB2ZXJ0ZXhEYXRhP1xuXHRcdHZiby5pbmRleERhdGEgPSBuZXdEYXRhO1xuXHR9XG4gIGZvcih2YXIgaT0wO2k8bnVtSW5kaWNlczsrK2kpIHtcbiAgICB2Ym8uaW5kZXhEYXRhW3Ziby5udW1JbmRpY2VzKytdID0gaW5kaWNlc1tpXTtcbiAgfVxufVxuXG52Ym9NZXNoLmFkZEluZGV4ID0gZnVuY3Rpb24odmJvLGluZGV4KSB7XG4gIGlmKHZiby5udW1JbmRpY2VzID49IHZiby5pbmRleERhdGEubGVuZ3RoKSB7XG5cdFx0dmFyIG5ld0RhdGEgPSBuZXcgdmJvLmluZGV4RGF0YS5jb25zdHJ1Y3Rvcih2Ym8uaW5kZXhEYXRhLmxlbmd0aCoyKTtcblx0XHRuZXdEYXRhLnNldCh2Ym8uaW5kZXhEYXRhKTtcblx0XHQvL2RvIGkgbmVlZCB0byBleHBsaWNpdGx5IGtpbGwgdGhlIG9sZCB2ZXJ0ZXhEYXRhP1xuXHRcdHZiby5pbmRleERhdGEgPSBuZXdEYXRhO1xuXHR9XG4gIHZiby5pbmRleERhdGFbdmJvLm51bUluZGljZXMrK10gPSBpbmRleDtcbn1cblxudmJvTWVzaC5hZGRMaW5lID0gZnVuY3Rpb24odmJvLCBpMSxpMikge1xuXHRpZih2Ym8ubnVtSW5kaWNlcyA+PSB2Ym8uaW5kZXhEYXRhLmxlbmd0aCkge1xuXHRcdHZhciBuZXdEYXRhID0gbmV3IHZiby5pbmRleERhdGEuY29uc3RydWN0b3IodmJvLmluZGV4RGF0YS5sZW5ndGgqMik7XG5cdFx0bmV3RGF0YS5zZXQodmJvLmluZGV4RGF0YSk7XG5cdFx0Ly9kbyBpIG5lZWQgdG8gZXhwbGljaXRseSBraWxsIHRoZSBvbGQgdmVydGV4RGF0YT9cblx0XHR2Ym8uaW5kZXhEYXRhID0gbmV3RGF0YTtcblx0fVxuICB2Ym8uaW5kZXhEYXRhW3Ziby5udW1JbmRpY2VzKytdID0gaTE7XG4gIHZiby5pbmRleERhdGFbdmJvLm51bUluZGljZXMrK10gPSBpMjtcbn1cblxudmJvTWVzaC5idWZmZXIgPSBmdW5jdGlvbih2Ym8pIHtcbiAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgdmJvLnZlcnRleEJ1ZmZlcik7XG4gICAgZ2wuYnVmZmVyRGF0YShnbC5BUlJBWV9CVUZGRVIsdmJvLnZlcnRleERhdGEsZ2wuU1RSRUFNX0RSQVcpO1xuICAgIGdsLmJpbmRCdWZmZXIoZ2wuRUxFTUVOVF9BUlJBWV9CVUZGRVIsIHZiby5pbmRleEJ1ZmZlcik7XG4gICAgZ2wuYnVmZmVyRGF0YShnbC5FTEVNRU5UX0FSUkFZX0JVRkZFUix2Ym8uaW5kZXhEYXRhLGdsLlNUUkVBTV9EUkFXKTtcbiAgICBpZih2Ym8ubm9ybWFsc0VuYWJsZWQpIHtcbiAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHZiby5ub3JtYWxCdWZmZXIpO1xuICAgICAgICBnbC5idWZmZXJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgdmJvLm5vcm1hbERhdGEsZ2wuU1RSRUFNX0RSQVcpO1xuICAgIH1cbn1cblxudmJvTWVzaC5jb21wdXRlU21vb3RoTm9ybWFscyA9IChmdW5jdGlvbigpIHtcbiAgICB2YXIgbm9ybSA9IHZlYzMuY3JlYXRlKCk7XG4gICAgdmFyIHAxID0gdmVjMy5jcmVhdGUoKSxcbiAgICAgICAgcDIgPSB2ZWMzLmNyZWF0ZSgpLFxuICAgICAgICBwMyA9IHZlYzMuY3JlYXRlKCk7XG4gICAgdmFyIHg9MC4wLHk9MC4wLHo9MC4wO1xuICAgIHZhciBpbnZMZW4gPSAwLjA7XG4gICAgdmFyIGRpcjEgPSB2ZWMzLmNyZWF0ZSgpLFxuICAgICAgICBkaXIyID0gdmVjMy5jcmVhdGUoKTtcbiAgICBmdW5jdGlvbiBwbGFuZU5vcm1hbChvdXQsdjEsdjIsdjMpIHtcbiAgICAgIHZlYzMuc3ViKGRpcjEsIHYxLHYyKTtcbiAgICAgIHZlYzMuc3ViKGRpcjIsIHYzLHYyKTtcbiAgICAgIHZlYzMuY3Jvc3Mob3V0LGRpcjIsZGlyMSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZ1bmN0aW9uIGNvbXB1dGVTbW9vdGhOb3JtYWxzKHZibykge1xuICAgICAgICB2Ym9NZXNoLmVuYWJsZU5vcm1hbHModmJvKTtcbiAgICAgICAgZm9yKHZhciBpPTA7aTx2Ym8ubnVtVmVydGljZXM7KytpKSB7XG4gICAgICAgICAgICB2YXIgaTMgPSBpKjM7XG4gICAgICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpM10gPSAwO1xuICAgICAgICAgICAgdmJvLm5vcm1hbERhdGFbaTMrMV0gPSAwO1xuICAgICAgICAgICAgdmJvLm5vcm1hbERhdGFbaTMrMl0gPSAwO1xuICAgICAgICB9XG4gICAgICAgIGZvcih2YXIgaT0wO2k8dmJvLm51bUluZGljZXM7KSB7XG4gICAgICAgICAgICB2YXIgaTEgPSB2Ym8uaW5kZXhEYXRhW2krK10qMztcbiAgICAgICAgICAgIHZhciBpMiA9IHZiby5pbmRleERhdGFbaSsrXSozO1xuICAgICAgICAgICAgdmFyIGkzID0gdmJvLmluZGV4RGF0YVtpKytdKjM7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZlYzMuc2V0KHAxLHZiby52ZXJ0ZXhEYXRhW2kxXSx2Ym8udmVydGV4RGF0YVtpMSsxXSwgdmJvLnZlcnRleERhdGFbaTErMl0pO1xuICAgICAgICAgICAgdmVjMy5zZXQocDIsdmJvLnZlcnRleERhdGFbaTJdLHZiby52ZXJ0ZXhEYXRhW2kyKzFdLCB2Ym8udmVydGV4RGF0YVtpMisyXSk7XG4gICAgICAgICAgICB2ZWMzLnNldChwMyx2Ym8udmVydGV4RGF0YVtpM10sdmJvLnZlcnRleERhdGFbaTMrMV0sIHZiby52ZXJ0ZXhEYXRhW2kzKzJdKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcGxhbmVOb3JtYWwobm9ybSwgcDEscDIscDMpO1xuICAgICAgICAgICAgdmVjMy5ub3JtYWxpemUobm9ybSxub3JtKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdmJvLm5vcm1hbERhdGFbaTFdICs9IG5vcm1bMF07XG4gICAgICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpMSsxXSArPSBub3JtWzFdO1xuICAgICAgICAgICAgdmJvLm5vcm1hbERhdGFbaTErMl0gKz0gbm9ybVsyXTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdmJvLm5vcm1hbERhdGFbaTJdICs9IG5vcm1bMF07XG4gICAgICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpMisxXSArPSBub3JtWzFdO1xuICAgICAgICAgICAgdmJvLm5vcm1hbERhdGFbaTIrMl0gKz0gbm9ybVsyXTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdmJvLm5vcm1hbERhdGFbaTNdICs9IG5vcm1bMF07XG4gICAgICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpMysxXSArPSBub3JtWzFdO1xuICAgICAgICAgICAgdmJvLm5vcm1hbERhdGFbaTMrMl0gKz0gbm9ybVsyXTtcbiAgICAgICAgfVxuICAgICAgICBmb3IodmFyIGk9MDtpPHZiby5udW1WZXJ0aWNlczsrK2kpIHtcbiAgICAgICAgICAgIHZhciBpMyA9IGkqMztcbiAgICAgICAgICAgIHggPSB2Ym8ubm9ybWFsRGF0YVtpM107XG4gICAgICAgICAgICB5ID0gdmJvLm5vcm1hbERhdGFbaTMrMV07XG4gICAgICAgICAgICB6ID0gdmJvLm5vcm1hbERhdGFbaTMrMl07XG4gICAgICAgICAgICBpbnZMZW4gPSAxLjAvTWF0aC5zcXJ0KHgqeCt5Knkreip6KTtcbiAgICAgICAgICAgIHZiby5ub3JtYWxEYXRhW2kzXSAqPSBpbnZMZW47XG4gICAgICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpMysxXSAqPSBpbnZMZW47XG4gICAgICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpMysyXSAqPSBpbnZMZW47XG4gICAgICAgIH1cbiAgICB9O1xufSkoKTtcblxudmJvTWVzaC5jb21wdXRlU21vb3RoTm9ybWFsc1ZCTyA9IGZ1bmN0aW9uKHZibykge1xuICAgIHZhciB2ZXJ0ZXhEYXRhID0gdmJvLnZlcnRleERhdGE7XG4gICAgZm9yKHZhciBpPTA7aTx2Ym8ubnVtVmVydGljZXM7KytpKSB7XG4gICAgICAgIHZhciBpNiA9IGkqNjtcbiAgICAgICAgdmVydGV4RGF0YVtpNiszXSA9IDA7XG4gICAgICAgIHZlcnRleERhdGFbaTYrNF0gPSAwO1xuICAgICAgICB2ZXJ0ZXhEYXRhW2k2KzVdID0gMDtcbiAgICB9XG4gICAgdmFyIG5vcm0gPSB2ZWMzLmNyZWF0ZSgpO1xuICAgIHZhciBwMSA9IHZlYzMuY3JlYXRlKCksXG4gICAgICAgIHAyID0gdmVjMy5jcmVhdGUoKSxcbiAgICAgICAgcDMgPSB2ZWMzLmNyZWF0ZSgpO1xuICAgIGZvcih2YXIgaT0wO2k8dmJvLm51bUluZGljZXM7KSB7XG4gICAgICAgIHZhciBpMSA9IHZiby5pbmRleERhdGFbaSsrXTtcbiAgICAgICAgdmFyIGkyID0gdmJvLmluZGV4RGF0YVtpKytdO1xuICAgICAgICB2YXIgaTMgPSB2Ym8uaW5kZXhEYXRhW2krK107XG4gICAgICAgIFxuICAgICAgICB2ZWMzLnNldChwMSx2ZXJ0ZXhEYXRhW2kxKjZdLHZlcnRleERhdGFbaTEqNisxXSwgdmVydGV4RGF0YVtpMSo2KzJdKTtcbiAgICAgICAgdmVjMy5zZXQocDIsdmVydGV4RGF0YVtpMio2XSx2ZXJ0ZXhEYXRhW2kyKjYrMV0sIHZlcnRleERhdGFbaTIqNisyXSk7XG4gICAgICAgIHZlYzMuc2V0KHAzLHZlcnRleERhdGFbaTMqNl0sdmVydGV4RGF0YVtpMyo2KzFdLCB2ZXJ0ZXhEYXRhW2kzKjYrMl0pO1xuICAgICAgICBcbiAgICAgICAgcGxhbmVOb3JtYWwobm9ybSwgcDEscDIscDMpO1xuICAgICAgICB2ZWMzLm5vcm1hbGl6ZShub3JtLG5vcm0pO1xuICAgICAgICBcbiAgICAgICAgdmVydGV4RGF0YVtpMSozKzNdICs9IG5vcm1bMF07XG4gICAgICAgIHZlcnRleERhdGFbaTEqMys0XSArPSBub3JtWzFdO1xuICAgICAgICB2ZXJ0ZXhEYXRhW2kxKjMrNV0gKz0gbm9ybVsyXTtcbiAgICAgICAgXG4gICAgICAgIHZlcnRleERhdGFbaTIqNiszXSArPSBub3JtWzBdO1xuICAgICAgICB2ZXJ0ZXhEYXRhW2kyKjYrNF0gKz0gbm9ybVsxXTtcbiAgICAgICAgdmVydGV4RGF0YVtpMio2KzVdICs9IG5vcm1bMl07XG4gICAgICAgIFxuICAgICAgICB2ZXJ0ZXhEYXRhW2kzKjYrM10gKz0gbm9ybVswXTtcbiAgICAgICAgdmVydGV4RGF0YVtpMyo2KzRdICs9IG5vcm1bMV07XG4gICAgICAgIHZlcnRleERhdGFbaTMqNis1XSArPSBub3JtWzJdO1xuICAgIH1cbiAgICBmb3IodmFyIGk9MDtpPHZiby5udW1WZXJ0aWNlczsrK2kpIHtcbiAgICAgICAgdmFyIGk2ID0gaSo2O1xuICAgICAgICB2YXIgbGVuID0gTWF0aC5zcXJ0KHZlcnRleERhdGFbaTYrM10qdmVydGV4RGF0YVtpNiszXSt2ZXJ0ZXhEYXRhW2k2KzRdKnZlcnRleERhdGFbaTYrNF0rdmVydGV4RGF0YVtpNis1XSp2ZXJ0ZXhEYXRhW2k2KzVdKTtcbiAgICAgICAgdmVydGV4RGF0YVtpNiszXSAvPSBsZW47XG4gICAgICAgIHZlcnRleERhdGFbaTYrNF0gLz0gbGVuO1xuICAgICAgICB2ZXJ0ZXhEYXRhW2k2KzVdIC89IGxlbjtcbiAgICB9XG59XG5cblxufSkoc2hpbS5leHBvcnRzKTtcbn0pKHRoaXMpOyIsInZhciBnbE1hdHJpeCA9IHJlcXVpcmUoJy4uL2pzL2dsLW1hdHJpeC1taW4uanMnKTtcbnZhciBwb2x5MnRyaSA9IHJlcXVpcmUoJy4vcG9seTJ0cmkuanMnKTtcbnZhciBoZW1lc2hlciA9IHJlcXVpcmUoJy4uL2pzL2hlbWVzaC5qcycpO1xudmFyIGhlbWVzaCA9IGhlbWVzaGVyLmhlbWVzaDtcbnZhciB2ZWMzID0gZ2xNYXRyaXgudmVjMztcbnZhciB2ZWMyID0gZ2xNYXRyaXgudmVjMjtcblxudmFyIFN3ZWVwQ29udGV4dCA9IHBvbHkydHJpLlN3ZWVwQ29udGV4dDtcbnZhciBwdHMgPSBbXTtcblxudmFyIG91dHNpZGVQdHMgPSBbXTtcbnZhciB0cmlhbmdsZXMgPSBbXTtcbnZhciB2b3JvTWVzaCA9IG5ldyBoZW1lc2goKTtcbnZhciB3aWR0aCA9IDEyMDA7XG52YXIgaGVpZ2h0ID0gMTIwMDtcbmZ1bmN0aW9uIHJlc2V0KCkge1xuICAvL21ha2UgcmVndWxhcmx5IHNwYWNlZCBwb2ludHNcbiAgcHRzLmxlbmd0aCA9IDA7XG4gIFxuICB2YXIgc3BhY2luZyA9IHdpZHRoLzQ7XG4gIGZvcih2YXIgaT0wO2k8NDsrK2kpIHtcbiAgICBmb3IodmFyIGo9MDtqPDQ7KytqKSB7XG4gICAgICBwdHMucHVzaCh7eDppKnNwYWNpbmcraiUyKnNwYWNpbmcqMC41LHk6aipzcGFjaW5nK3NwYWNpbmcqMC41fSk7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGluaXQoKSB7XG4gIG91dHNpZGVQdHMubGVuZ3RoID0gMDtcbiAgdmFyIGQgPSA1MDA7XG4gIG91dHNpZGVQdHMucHVzaCh7eDotZCx5Oi1kLGZpeGVkOnRydWV9KTtcbiAgb3V0c2lkZVB0cy5wdXNoKHt4OndpZHRoKjAuNSx5Oi1kLGZpeGVkOnRydWV9KTtcbiAgb3V0c2lkZVB0cy5wdXNoKHt4OndpZHRoK2QseTotZCxmaXhlZDp0cnVlfSk7XG4gIG91dHNpZGVQdHMucHVzaCh7eDp3aWR0aCtkLHk6aGVpZ2h0KjAuNSxmaXhlZDp0cnVlfSk7XG4gIG91dHNpZGVQdHMucHVzaCh7eDp3aWR0aCtkLHk6aGVpZ2h0K2QsZml4ZWQ6dHJ1ZX0pO1xuICBvdXRzaWRlUHRzLnB1c2goe3g6d2lkdGgqMC41LHk6aGVpZ2h0K2QsZml4ZWQ6dHJ1ZX0pO1xuICBvdXRzaWRlUHRzLnB1c2goe3g6LWQseTpoZWlnaHQrZCxmaXhlZDp0cnVlfSk7XG4gIG91dHNpZGVQdHMucHVzaCh7eDotZCx5OmhlaWdodCowLjUsZml4ZWQ6dHJ1ZX0pO1xufVxuXG52YXIgdm9yb25vaSA9IChmdW5jdGlvbigpIHtcbiAgdmFyIHAxID0gdmVjMi5jcmVhdGUoKTtcbiAgdmFyIHAyID0gdmVjMi5jcmVhdGUoKTtcbiAgdmFyIHAzID0gdmVjMi5jcmVhdGUoKTtcbiAgcmV0dXJuIGZ1bmN0aW9uIHZvcm9ub2koKSB7XG4gICAgdmFyIHRyaWFuZ3VsYXRpb24gPSBuZXcgU3dlZXBDb250ZXh0KG91dHNpZGVQdHMpO1xuICAgIHRyaWFuZ3VsYXRpb24uYWRkUG9pbnRzKHB0cyk7XG4gICAgdHJpYW5ndWxhdGlvbi50cmlhbmd1bGF0ZSgpO1xuICAgIFxuICAgIGZvcih2YXIgaT0wO2k8cHRzLmxlbmd0aDsrK2kpIHtcbiAgICAgIHB0c1tpXS5fcDJ0X2VkZ2VfbGlzdCA9IG51bGw7XG4gICAgICBwdHNbaV0uY2VsbCA9IG51bGw7XG4gICAgfVxuICAgIFxuICAgIHRyaWFuZ2xlcyA9IHRyaWFuZ3VsYXRpb24uZ2V0VHJpYW5nbGVzKCk7XG4gICAgZXhwb3J0cy50cmlhbmdsZXMgPSB0cmlhbmdsZXM7XG4gICAgXG4gICAgZm9yKHZhciBpPTA7aTx0cmlhbmdsZXMubGVuZ3RoOysraSkge1xuICAgICAgdmFyIHRyaSA9IHRyaWFuZ2xlc1tpXTtcbiAgICAgIHRyaS5jaXJjdW1jZW50ZXIgPSB2ZWMzLmNyZWF0ZSgpO1xuICAgICAgdmVjMi5zZXQocDEsdHJpLnBvaW50c19bMF0ueCx0cmkucG9pbnRzX1swXS55KTtcbiAgICAgIHZlYzIuc2V0KHAyLHRyaS5wb2ludHNfWzFdLngsdHJpLnBvaW50c19bMV0ueSk7XG4gICAgICB2ZWMyLnNldChwMyx0cmkucG9pbnRzX1syXS54LHRyaS5wb2ludHNfWzJdLnkpO1xuICAgICAgY2lyY3VtY2lyY2xlKHRyaS5jaXJjdW1jZW50ZXIscDEscDIscDMpO1xuICAgIH1cbiAgICBcbiAgICBidWlsZENlbGxzKCk7XG4gIH1cbn0pKCk7XG5cbnZhciBjaXJjdW1jaXJjbGUgPSAoZnVuY3Rpb24oKSB7XG4gIHZhciB2MSA9IHZlYzIuY3JlYXRlKCk7XG4gIHZhciB2MiA9IHZlYzIuY3JlYXRlKCk7XG4gIHZhciBkZW5vbTtcbiAgcmV0dXJuIGZ1bmN0aW9uIGNpcmN1bWNpcmNsZShvdXQsIHAxLHAyLHAzKSB7XG4gICAgdmVjMi5zdWIodjEscDEscDMpO1xuICAgIHZlYzIuc3ViKHYyLHAyLHAzKTtcbiAgICBkZW5vbSA9IHYxWzBdKnYyWzFdLXYxWzFdKnYyWzBdO1xuICAgIC8vZGVub20gPSBvcmllbnQyZChwMSxwMixwMyk7XG4gICAgdmFyIHYxTGVuID0gdmVjMi5zcXJMZW4odjEpO1xuICAgIHZhciB2MkxlbiA9IHZlYzIuc3FyTGVuKHYyKTtcbiAgICAvL3ZhciBjcm9zc0xlbiA9IGNyb3NzKmNyb3NzO1xuICAgIHZlYzIuc2NhbGUodjIsdjIsdjFMZW4pO1xuICAgIHZlYzIuc2NhbGUodjEsdjEsdjJMZW4pO1xuICAgIHZlYzIuc3ViKHYyLHYyLHYxKTtcbiAgICBvdXRbMF0gPSB2MlsxXTtcbiAgICBvdXRbMV0gPSAtdjJbMF07XG4gICAgdmVjMi5zY2FsZShvdXQsb3V0LDAuNS9kZW5vbSk7XG4gICAgdmVjMi5hZGQob3V0LG91dCxwMyk7XG4gICAgcmV0dXJuIG91dDtcbiAgfVxufSkoKTtcblxudmFyIG9yaWVudDJkID0gKGZ1bmN0aW9uKCkge1xuICB2YXIgZGV0bGVmdCwgZGV0cmlnaHQsIGRldDtcbiAgdmFyIGRldHN1bSwgZXJyYm91bmQ7XG4gIHJldHVybiBmdW5jdGlvbiBvcmllbnQyZChwYSxwYixwYykge1xuICAgIFxuXG4gICAgZGV0bGVmdCA9IChwYVswXSAtIHBjWzBdKSAqIChwYlsxXSAtIHBjWzFdKTtcbiAgICBkZXRyaWdodCA9IChwYVsxXSAtIHBjWzFdKSAqIChwYlswXSAtIHBjWzBdKTtcbiAgICBkZXQgPSBkZXRsZWZ0IC0gZGV0cmlnaHQ7XG5cbiAgICBpZiAoZGV0bGVmdCA+IDAuMCkge1xuICAgICAgaWYgKGRldHJpZ2h0IDw9IDAuMCkge1xuICAgICAgICByZXR1cm4gZGV0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGV0c3VtID0gZGV0bGVmdCArIGRldHJpZ2h0O1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZGV0bGVmdCA8IDAuMCkge1xuICAgICAgaWYgKGRldHJpZ2h0ID49IDAuMCkge1xuICAgICAgICByZXR1cm4gZGV0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGV0c3VtID0gLWRldGxlZnQgLSBkZXRyaWdodDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGRldDtcbiAgICB9XG5cbiAgICBlcnJib3VuZCA9IGNjd2VycmJvdW5kQSAqIGRldHN1bTtcbiAgICBpZiAoKGRldCA+PSBlcnJib3VuZCkgfHwgKC1kZXQgPj0gZXJyYm91bmQpKSB7XG4gICAgICByZXR1cm4gZGV0O1xuICAgIH1cblxuICAgIHJldHVybiBvcmllbnQyZGFkYXB0KHBhLCBwYiwgcGMsIGRldHN1bSk7XG4gIH1cbn0pKCk7XG5cblxuZnVuY3Rpb24gc2V0RGltZW5zaW9ucyh3LGgpIHtcbiAgd2lkdGggPSB3O1xuICBoZWlnaHQgPSBoO1xufVxuXG52YXIgY2VudHJvaWRhbCA9IChmdW5jdGlvbigpIHtcbiAgdmFyIGNlbnRyb2lkID0gdmVjMi5jcmVhdGUoKTtcbiAgdmFyIGNlbnRlciA9IHZlYzIuY3JlYXRlKCk7XG4gIHZhciBhcmVhO1xuICB2YXIgdjEsdjI7XG4gIHJldHVybiBmdW5jdGlvbiBjZW50cm9pZGFsKCkge1xuICAgIGZvcih2YXIgaT0wO2k8cHRzLmxlbmd0aDsrK2kpIHtcbiAgICAgIHZhciBwdCA9IHB0c1tpXTtcbiAgICAgIGlmKCFwdC5maXhlZCkge1xuICAgICAgICB0b3RhbEFyZWEgPSAwO1xuICAgICAgICB2ZWMyLnNldChjZW50cm9pZCwwLDApO1xuICAgICAgICB2YXIgZSA9IHB0LmNlbGwuZTtcbiAgICAgICAgZG8ge1xuICAgICAgICAgIHYxID0gZS52LnBvcztcbiAgICAgICAgICBlID0gZS5uZXh0O1xuICAgICAgICAgIHYyID0gZS52LnBvcztcbiAgICAgICAgICBhcmVhID0gdjFbMF0qdjJbMV0tdjFbMV0qdjJbMF07XG4gICAgICAgICAgdG90YWxBcmVhICs9IHYxWzBdKnYyWzFdLXYxWzFdKnYyWzBdO1xuICAgICAgICAgIGNlbnRyb2lkWzBdICs9ICh2MVswXSt2MlswXSkqYXJlYTtcbiAgICAgICAgICBjZW50cm9pZFsxXSArPSAodjFbMV0rdjJbMV0pKmFyZWE7XG4gICAgICAgIH0gd2hpbGUoZSAhPSBwdC5jZWxsLmUpO1xuICAgICAgICAvKlxuICAgICAgICBmb3IodmFyIGo9MCxsPXB0LmNlbGwubGVuZ3RoO2o8bDsrK2opIHtcbiAgICAgICAgICB2YXIgak5leHQgPSAoaisxKSVsO1xuICAgICAgICAgIHYxID0gcHQuY2VsbFtqXTtcbiAgICAgICAgICB2MiA9IHB0LmNlbGxbak5leHRdO1xuICAgICAgICAgIGFyZWEgPSB2MVswXSp2MlsxXS12MVsxXSp2MlswXTtcbiAgICAgICAgICB0b3RhbEFyZWEgKz0gdjFbMF0qdjJbMV0tdjFbMV0qdjJbMF07XG4gICAgICAgICAgY2VudHJvaWRbMF0gKz0gKHYxWzBdK3YyWzBdKSphcmVhO1xuICAgICAgICAgIGNlbnRyb2lkWzFdICs9ICh2MVsxXSt2MlsxXSkqYXJlYTtcbiAgICAgICAgfVxuICAgICAgICAqL1xuICAgICAgICB2ZWMyLnNjYWxlKGNlbnRyb2lkLGNlbnRyb2lkLDEuMC90b3RhbEFyZWEvMy4wKTtcbiAgICAgICAgdmFyIGR4ID0gTWF0aC5taW4oTWF0aC5tYXgoTWF0aC5yYW5kb20oLjEpLGNlbnRyb2lkWzBdKSx3aWR0aC1NYXRoLnJhbmRvbSguMSkpLXB0Lng7XG4gICAgICAgIHZhciBkeSA9IE1hdGgubWluKE1hdGgubWF4KE1hdGgucmFuZG9tKC4xKSxjZW50cm9pZFsxXSksaGVpZ2h0LU1hdGgucmFuZG9tKC4xKSktcHQueTtcbiAgICAgICAgaWYoZHgqZHgrZHkqZHkgPiA0KSB7XG4gICAgICAgICAgcHQueCArPSAuMjUqZHg7XG4gICAgICAgICAgcHQueSArPSAuMjUqZHk7XG4gICAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufSkoKTtcblxudmFyIHB0VG9FZGdlID0gW107XG52YXIgYnVpbGRDZWxscyA9IGZ1bmN0aW9uKCkge1xuICB2b3JvTWVzaC5jbGVhcigpO1xuICBwdFRvRWRnZS5sZW5ndGggPSAwO1xuICBmb3IodmFyIGk9MDtpPHRyaWFuZ2xlcy5sZW5ndGg7KytpKSB7XG4gICAgdmFyIHQgPSB0cmlhbmdsZXNbaV07XG4gICAgdmFyIHYgPSB2b3JvTWVzaC5hZGRWZXJ0ZXgodC5jaXJjdW1jZW50ZXIpO1xuICAgIHQudiA9IHY7XG4gIH1cbiAgZm9yKHZhciBpPTA7aTx0cmlhbmdsZXMubGVuZ3RoOysraSkge1xuICAgIHZhciB0ID0gdHJpYW5nbGVzW2ldO1xuICAgIGZvcih2YXIgaj0wO2o8MzsrK2opIHtcbiAgICAgIHZhciBwdCA9IHQucG9pbnRzX1tqXTtcbiAgICAgIGlmKCFwdC5maXhlZCkge1xuICAgICAgICBpZighcHQuY2VsbCl7XG4gICAgICAgICAgYnVpbGRDZWxsKHB0LHQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIG1ha2VCb3VuZGFyeUVkZ2VzKHZvcm9NZXNoLCBwdFRvRWRnZSk7XG59XG5cbmZ1bmN0aW9uIGJ1aWxkQ2VsbChwdCx0KSB7XG4gIHB0LmNlbGwgPSB2b3JvTWVzaC5hZGRGYWNlKCk7XG4gIHZhciBwcmV2ViA9IHQudjtcbiAgdCA9IHQubmVpZ2hib3JDQ1cocHQpO1xuICB2YXIgc3RhcnRUID0gdDtcbiAgdmFyIGUsIHByZXZFID0gbnVsbDtcbiAgZG8ge1xuICAgIC8vcHQuY2VsbC5wdXNoKHQuY2lyY3VtY2VudGVyKTtcbiAgICBlID0gdm9yb01lc2guYWRkRWRnZSgpO1xuICAgIFxuICAgIGUudiA9IHQudjtcbiAgICBlLnYuZSA9IGU7XG4gICAgaWYocHJldkUpIHtcbiAgICAgIHByZXZFLm5leHQgPSBlO1xuICAgIH0gZWxzZSB7XG4gICAgICBwdC5jZWxsLmUgPSBlO1xuICAgIH1cbiAgICBlLmZhY2UgPSBwdC5jZWxsO1xuICAgIGZpbmRQYWlyKGUscHRUb0VkZ2UscHJldlYuaW5kZXgsIGUudi5pbmRleCk7XG4gICAgcHJldlYgPSB0LnY7XG4gICAgcHJldkUgPSBlO1xuICAgIHQgPSB0Lm5laWdoYm9yQ0NXKHB0KTtcbiAgfSB3aGlsZSh0ICE9IHN0YXJ0VCk7XG4gIHByZXZFLm5leHQgPSBwdC5jZWxsLmU7XG59XG5cbi8vYnVpbGQgaGVkZ2Ugc3RydWN0dXJlXG5mdW5jdGlvbiBmaW5kUGFpcihlLHB0VG9FZGdlLGkxLGkyKSB7XG4gIHZhciBwdEVkZ2UgPSBwdFRvRWRnZVtpMl07XG4gIGlmKHB0RWRnZSkge1xuICAgIGZvcih2YXIgaT0wO2k8cHRFZGdlLmxlbmd0aDsrK2kpIHtcbiAgICAgIHZhciBlMiA9IHB0RWRnZVtpXTtcbiAgICAgIGlmKGUyLnYuaW5kZXggPT0gaTEpIHtcbiAgICAgICAgZTIucGFpciA9IGU7XG4gICAgICAgIGUucGFpciA9IGUyO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHB0RWRnZSA9IHB0VG9FZGdlW2kxXTtcbiAgaWYocHRFZGdlKSB7XG4gICAgcHRFZGdlLnB1c2goZSk7XG4gIH0gZWxzZSB7XG4gICAgcHRFZGdlID0gW2VdO1xuICAgIHB0VG9FZGdlW2kxXSA9IHB0RWRnZTtcbiAgfVxufVxuXG5mdW5jdGlvbiBtYWtlQm91bmRhcnlFZGdlcyhtZXNoLHB0VG9FZGdlKSB7XG4gIC8vYWRkIGJvdW5kYXJ5IGVkZ2VzIGFuZCB1bnN1cmUgZXZlcnkgZWRnZSBoYXMgYSBwYWlyXG4gIHZhciBudW1FZGdlcyA9IG1lc2guZWRnZXMubGVuZ3RoO1xuICB2YXIgZSx2LHN0YXJ0VjtcbiAgZm9yKHZhciBpPTA7aTxudW1FZGdlczsrK2kpIHtcbiAgICAgZSA9IG1lc2guZWRnZXNbaV07XG4gICAgaWYoZS5wYWlyID09IG51bGwpIHtcbiAgICAgIHZhciBuZXdFZGdlID0gbWVzaC5hZGRFZGdlKCk7XG4gICAgICBuZXdFZGdlLnBhaXIgPSBlO1xuICAgICAgZS5wYWlyID0gbmV3RWRnZTtcbiAgICAgIFxuICAgICAgLy9sZXRzIHRyeSB0aGUgaW5lZmZpY2llbnQgcm91dGVcbiAgICAgIHN0YXJ0ViA9IGUudjtcbiAgICAgIGRvIHtcbiAgICAgICAgdiA9IGUudjtcbiAgICAgICAgZSA9IGUubmV4dDtcbiAgICAgIH0gd2hpbGUoZS52ICE9IHN0YXJ0Vik7XG4gICAgICBuZXdFZGdlLnYgPSB2O1xuICAgICAgbmV3RWRnZS52LmIgPSB0cnVlO1xuICAgICAgdmFyIHB0RWRnZSA9IHB0VG9FZGdlW3N0YXJ0Vi5pbmRleF07XG4gICAgICBwdEVkZ2UucHVzaChuZXdFZGdlKTtcbiAgICB9XG4gIH1cbiAgZm9yKHZhciBpPW51bUVkZ2VzO2k8bWVzaC5lZGdlcy5sZW5ndGg7KytpKSB7XG4gICAgZSA9IG1lc2guZWRnZXNbaV07XG4gICAgdmFyIHB0RWRnZSA9IHB0VG9FZGdlW2Uudi5pbmRleF07XG4gICAgaWYocHRFZGdlKSB7XG4gICAgICBmb3IodmFyIGo9MDtqPHB0RWRnZS5sZW5ndGg7KytqKSB7XG4gICAgICAgIHZhciBlMiA9IHB0RWRnZVtqXTtcbiAgICAgICAgaWYoZTIuZmFjZSA9PSBoZW1lc2guSEVNRVNIX05VTExGQUNFKSB7XG4gICAgICAgICAgZS5uZXh0ID0gZTI7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxudmFyIHRyaW1DZWxscyA9IChmdW5jdGlvbigpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHRyaW1DZWxscygpIHtcbiAgICBcbiAgfVxufSkoKTtcblxuZXhwb3J0cy5pbml0ID0gaW5pdDtcbmV4cG9ydHMucmVzZXQgPSByZXNldDtcbmV4cG9ydHMudm9yb25vaSA9IHZvcm9ub2k7XG5leHBvcnRzLnB0cyA9IHB0cztcbmV4cG9ydHMudHJpYW5nbGVzID0gdHJpYW5nbGVzO1xuZXhwb3J0cy5zZXREaW1lbnNpb25zID0gc2V0RGltZW5zaW9ucztcbmV4cG9ydHMuY2VudHJvaWRhbCA9IGNlbnRyb2lkYWw7XG5leHBvcnRzLm1lc2ggPSB2b3JvTWVzaDsiLCIvKipcbiAqIEBmaWxlb3ZlcnZpZXcgZ2wtbWF0cml4IC0gSGlnaCBwZXJmb3JtYW5jZSBtYXRyaXggYW5kIHZlY3RvciBvcGVyYXRpb25zXG4gKiBAYXV0aG9yIEJyYW5kb24gSm9uZXNcbiAqIEBhdXRob3IgQ29saW4gTWFjS2VuemllIElWXG4gKiBAdmVyc2lvbiAyLjIuMFxuICovXG4vKiBDb3B5cmlnaHQgKGMpIDIwMTMsIEJyYW5kb24gSm9uZXMsIENvbGluIE1hY0tlbnppZSBJVi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cblxuUmVkaXN0cmlidXRpb24gYW5kIHVzZSBpbiBzb3VyY2UgYW5kIGJpbmFyeSBmb3Jtcywgd2l0aCBvciB3aXRob3V0IG1vZGlmaWNhdGlvbixcbmFyZSBwZXJtaXR0ZWQgcHJvdmlkZWQgdGhhdCB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnMgYXJlIG1ldDpcblxuICAqIFJlZGlzdHJpYnV0aW9ucyBvZiBzb3VyY2UgY29kZSBtdXN0IHJldGFpbiB0aGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSwgdGhpc1xuICAgIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyLlxuICAqIFJlZGlzdHJpYnV0aW9ucyBpbiBiaW5hcnkgZm9ybSBtdXN0IHJlcHJvZHVjZSB0aGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSxcbiAgICB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyIGluIHRoZSBkb2N1bWVudGF0aW9uIFxuICAgIGFuZC9vciBvdGhlciBtYXRlcmlhbHMgcHJvdmlkZWQgd2l0aCB0aGUgZGlzdHJpYnV0aW9uLlxuXG5USElTIFNPRlRXQVJFIElTIFBST1ZJREVEIEJZIFRIRSBDT1BZUklHSFQgSE9MREVSUyBBTkQgQ09OVFJJQlVUT1JTIFwiQVMgSVNcIiBBTkRcbkFOWSBFWFBSRVNTIE9SIElNUExJRUQgV0FSUkFOVElFUywgSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFRIRSBJTVBMSUVEXG5XQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSBBTkQgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQVJFIFxuRElTQ0xBSU1FRC4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFIENPUFlSSUdIVCBIT0xERVIgT1IgQ09OVFJJQlVUT1JTIEJFIExJQUJMRSBGT1JcbkFOWSBESVJFQ1QsIElORElSRUNULCBJTkNJREVOVEFMLCBTUEVDSUFMLCBFWEVNUExBUlksIE9SIENPTlNFUVVFTlRJQUwgREFNQUdFU1xuKElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBQUk9DVVJFTUVOVCBPRiBTVUJTVElUVVRFIEdPT0RTIE9SIFNFUlZJQ0VTO1xuTE9TUyBPRiBVU0UsIERBVEEsIE9SIFBST0ZJVFM7IE9SIEJVU0lORVNTIElOVEVSUlVQVElPTikgSE9XRVZFUiBDQVVTRUQgQU5EIE9OXG5BTlkgVEhFT1JZIE9GIExJQUJJTElUWSwgV0hFVEhFUiBJTiBDT05UUkFDVCwgU1RSSUNUIExJQUJJTElUWSwgT1IgVE9SVFxuKElOQ0xVRElORyBORUdMSUdFTkNFIE9SIE9USEVSV0lTRSkgQVJJU0lORyBJTiBBTlkgV0FZIE9VVCBPRiBUSEUgVVNFIE9GIFRISVNcblNPRlRXQVJFLCBFVkVOIElGIEFEVklTRUQgT0YgVEhFIFBPU1NJQklMSVRZIE9GIFNVQ0ggREFNQUdFLiAqL1xuKGZ1bmN0aW9uKGUpe1widXNlIHN0cmljdFwiO3ZhciB0PXt9O3R5cGVvZiBleHBvcnRzPT1cInVuZGVmaW5lZFwiP3R5cGVvZiBkZWZpbmU9PVwiZnVuY3Rpb25cIiYmdHlwZW9mIGRlZmluZS5hbWQ9PVwib2JqZWN0XCImJmRlZmluZS5hbWQ/KHQuZXhwb3J0cz17fSxkZWZpbmUoZnVuY3Rpb24oKXtyZXR1cm4gdC5leHBvcnRzfSkpOnQuZXhwb3J0cz10eXBlb2Ygd2luZG93IT1cInVuZGVmaW5lZFwiP3dpbmRvdzplOnQuZXhwb3J0cz1leHBvcnRzLGZ1bmN0aW9uKGUpe2lmKCF0KXZhciB0PTFlLTY7aWYoIW4pdmFyIG49dHlwZW9mIEZsb2F0MzJBcnJheSE9XCJ1bmRlZmluZWRcIj9GbG9hdDMyQXJyYXk6QXJyYXk7aWYoIXIpdmFyIHI9TWF0aC5yYW5kb207dmFyIGk9e307aS5zZXRNYXRyaXhBcnJheVR5cGU9ZnVuY3Rpb24oZSl7bj1lfSx0eXBlb2YgZSE9XCJ1bmRlZmluZWRcIiYmKGUuZ2xNYXRyaXg9aSk7dmFyIHM9e307cy5jcmVhdGU9ZnVuY3Rpb24oKXt2YXIgZT1uZXcgbigyKTtyZXR1cm4gZVswXT0wLGVbMV09MCxlfSxzLmNsb25lPWZ1bmN0aW9uKGUpe3ZhciB0PW5ldyBuKDIpO3JldHVybiB0WzBdPWVbMF0sdFsxXT1lWzFdLHR9LHMuZnJvbVZhbHVlcz1mdW5jdGlvbihlLHQpe3ZhciByPW5ldyBuKDIpO3JldHVybiByWzBdPWUsclsxXT10LHJ9LHMuY29weT1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdPXRbMF0sZVsxXT10WzFdLGV9LHMuc2V0PWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10LGVbMV09bixlfSxzLmFkZD1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dFswXStuWzBdLGVbMV09dFsxXStuWzFdLGV9LHMuc3VidHJhY3Q9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0tblswXSxlWzFdPXRbMV0tblsxXSxlfSxzLnN1Yj1zLnN1YnRyYWN0LHMubXVsdGlwbHk9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0qblswXSxlWzFdPXRbMV0qblsxXSxlfSxzLm11bD1zLm11bHRpcGx5LHMuZGl2aWRlPWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10WzBdL25bMF0sZVsxXT10WzFdL25bMV0sZX0scy5kaXY9cy5kaXZpZGUscy5taW49ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPU1hdGgubWluKHRbMF0sblswXSksZVsxXT1NYXRoLm1pbih0WzFdLG5bMV0pLGV9LHMubWF4PWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT1NYXRoLm1heCh0WzBdLG5bMF0pLGVbMV09TWF0aC5tYXgodFsxXSxuWzFdKSxlfSxzLnNjYWxlPWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10WzBdKm4sZVsxXT10WzFdKm4sZX0scy5zY2FsZUFuZEFkZD1mdW5jdGlvbihlLHQsbixyKXtyZXR1cm4gZVswXT10WzBdK25bMF0qcixlWzFdPXRbMV0rblsxXSpyLGV9LHMuZGlzdGFuY2U9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLWVbMF0scj10WzFdLWVbMV07cmV0dXJuIE1hdGguc3FydChuKm4rcipyKX0scy5kaXN0PXMuZGlzdGFuY2Uscy5zcXVhcmVkRGlzdGFuY2U9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLWVbMF0scj10WzFdLWVbMV07cmV0dXJuIG4qbityKnJ9LHMuc3FyRGlzdD1zLnNxdWFyZWREaXN0YW5jZSxzLmxlbmd0aD1mdW5jdGlvbihlKXt2YXIgdD1lWzBdLG49ZVsxXTtyZXR1cm4gTWF0aC5zcXJ0KHQqdCtuKm4pfSxzLmxlbj1zLmxlbmd0aCxzLnNxdWFyZWRMZW5ndGg9ZnVuY3Rpb24oZSl7dmFyIHQ9ZVswXSxuPWVbMV07cmV0dXJuIHQqdCtuKm59LHMuc3FyTGVuPXMuc3F1YXJlZExlbmd0aCxzLm5lZ2F0ZT1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdPS10WzBdLGVbMV09LXRbMV0sZX0scy5ub3JtYWxpemU9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLHI9dFsxXSxpPW4qbityKnI7cmV0dXJuIGk+MCYmKGk9MS9NYXRoLnNxcnQoaSksZVswXT10WzBdKmksZVsxXT10WzFdKmkpLGV9LHMuZG90PWZ1bmN0aW9uKGUsdCl7cmV0dXJuIGVbMF0qdFswXStlWzFdKnRbMV19LHMuY3Jvc3M9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0qblsxXS10WzFdKm5bMF07cmV0dXJuIGVbMF09ZVsxXT0wLGVbMl09cixlfSxzLmxlcnA9ZnVuY3Rpb24oZSx0LG4scil7dmFyIGk9dFswXSxzPXRbMV07cmV0dXJuIGVbMF09aStyKihuWzBdLWkpLGVbMV09cytyKihuWzFdLXMpLGV9LHMucmFuZG9tPWZ1bmN0aW9uKGUsdCl7dD10fHwxO3ZhciBuPXIoKSoyKk1hdGguUEk7cmV0dXJuIGVbMF09TWF0aC5jb3MobikqdCxlWzFdPU1hdGguc2luKG4pKnQsZX0scy50cmFuc2Zvcm1NYXQyPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXTtyZXR1cm4gZVswXT1uWzBdKnIrblsyXSppLGVbMV09blsxXSpyK25bM10qaSxlfSxzLnRyYW5zZm9ybU1hdDJkPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXTtyZXR1cm4gZVswXT1uWzBdKnIrblsyXSppK25bNF0sZVsxXT1uWzFdKnIrblszXSppK25bNV0sZX0scy50cmFuc2Zvcm1NYXQzPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXTtyZXR1cm4gZVswXT1uWzBdKnIrblszXSppK25bNl0sZVsxXT1uWzFdKnIrbls0XSppK25bN10sZX0scy50cmFuc2Zvcm1NYXQ0PWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXTtyZXR1cm4gZVswXT1uWzBdKnIrbls0XSppK25bMTJdLGVbMV09blsxXSpyK25bNV0qaStuWzEzXSxlfSxzLmZvckVhY2g9ZnVuY3Rpb24oKXt2YXIgZT1zLmNyZWF0ZSgpO3JldHVybiBmdW5jdGlvbih0LG4scixpLHMsbyl7dmFyIHUsYTtufHwobj0yKSxyfHwocj0wKSxpP2E9TWF0aC5taW4oaSpuK3IsdC5sZW5ndGgpOmE9dC5sZW5ndGg7Zm9yKHU9cjt1PGE7dSs9billWzBdPXRbdV0sZVsxXT10W3UrMV0scyhlLGUsbyksdFt1XT1lWzBdLHRbdSsxXT1lWzFdO3JldHVybiB0fX0oKSxzLnN0cj1mdW5jdGlvbihlKXtyZXR1cm5cInZlYzIoXCIrZVswXStcIiwgXCIrZVsxXStcIilcIn0sdHlwZW9mIGUhPVwidW5kZWZpbmVkXCImJihlLnZlYzI9cyk7dmFyIG89e307by5jcmVhdGU9ZnVuY3Rpb24oKXt2YXIgZT1uZXcgbigzKTtyZXR1cm4gZVswXT0wLGVbMV09MCxlWzJdPTAsZX0sby5jbG9uZT1mdW5jdGlvbihlKXt2YXIgdD1uZXcgbigzKTtyZXR1cm4gdFswXT1lWzBdLHRbMV09ZVsxXSx0WzJdPWVbMl0sdH0sby5mcm9tVmFsdWVzPWZ1bmN0aW9uKGUsdCxyKXt2YXIgaT1uZXcgbigzKTtyZXR1cm4gaVswXT1lLGlbMV09dCxpWzJdPXIsaX0sby5jb3B5PWZ1bmN0aW9uKGUsdCl7cmV0dXJuIGVbMF09dFswXSxlWzFdPXRbMV0sZVsyXT10WzJdLGV9LG8uc2V0PWZ1bmN0aW9uKGUsdCxuLHIpe3JldHVybiBlWzBdPXQsZVsxXT1uLGVbMl09cixlfSxvLmFkZD1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dFswXStuWzBdLGVbMV09dFsxXStuWzFdLGVbMl09dFsyXStuWzJdLGV9LG8uc3VidHJhY3Q9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0tblswXSxlWzFdPXRbMV0tblsxXSxlWzJdPXRbMl0tblsyXSxlfSxvLnN1Yj1vLnN1YnRyYWN0LG8ubXVsdGlwbHk9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0qblswXSxlWzFdPXRbMV0qblsxXSxlWzJdPXRbMl0qblsyXSxlfSxvLm11bD1vLm11bHRpcGx5LG8uZGl2aWRlPWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10WzBdL25bMF0sZVsxXT10WzFdL25bMV0sZVsyXT10WzJdL25bMl0sZX0sby5kaXY9by5kaXZpZGUsby5taW49ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPU1hdGgubWluKHRbMF0sblswXSksZVsxXT1NYXRoLm1pbih0WzFdLG5bMV0pLGVbMl09TWF0aC5taW4odFsyXSxuWzJdKSxlfSxvLm1heD1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09TWF0aC5tYXgodFswXSxuWzBdKSxlWzFdPU1hdGgubWF4KHRbMV0sblsxXSksZVsyXT1NYXRoLm1heCh0WzJdLG5bMl0pLGV9LG8uc2NhbGU9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0qbixlWzFdPXRbMV0qbixlWzJdPXRbMl0qbixlfSxvLnNjYWxlQW5kQWRkPWZ1bmN0aW9uKGUsdCxuLHIpe3JldHVybiBlWzBdPXRbMF0rblswXSpyLGVbMV09dFsxXStuWzFdKnIsZVsyXT10WzJdK25bMl0qcixlfSxvLmRpc3RhbmNlPWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXS1lWzBdLHI9dFsxXS1lWzFdLGk9dFsyXS1lWzJdO3JldHVybiBNYXRoLnNxcnQobipuK3IqcitpKmkpfSxvLmRpc3Q9by5kaXN0YW5jZSxvLnNxdWFyZWREaXN0YW5jZT1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0tZVswXSxyPXRbMV0tZVsxXSxpPXRbMl0tZVsyXTtyZXR1cm4gbipuK3IqcitpKml9LG8uc3FyRGlzdD1vLnNxdWFyZWREaXN0YW5jZSxvLmxlbmd0aD1mdW5jdGlvbihlKXt2YXIgdD1lWzBdLG49ZVsxXSxyPWVbMl07cmV0dXJuIE1hdGguc3FydCh0KnQrbipuK3Iqcil9LG8ubGVuPW8ubGVuZ3RoLG8uc3F1YXJlZExlbmd0aD1mdW5jdGlvbihlKXt2YXIgdD1lWzBdLG49ZVsxXSxyPWVbMl07cmV0dXJuIHQqdCtuKm4rcipyfSxvLnNxckxlbj1vLnNxdWFyZWRMZW5ndGgsby5uZWdhdGU9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXT0tdFswXSxlWzFdPS10WzFdLGVbMl09LXRbMl0sZX0sby5ub3JtYWxpemU9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLHI9dFsxXSxpPXRbMl0scz1uKm4rcipyK2kqaTtyZXR1cm4gcz4wJiYocz0xL01hdGguc3FydChzKSxlWzBdPXRbMF0qcyxlWzFdPXRbMV0qcyxlWzJdPXRbMl0qcyksZX0sby5kb3Q9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXSp0WzBdK2VbMV0qdFsxXStlWzJdKnRbMl19LG8uY3Jvc3M9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPW5bMF0sdT1uWzFdLGE9blsyXTtyZXR1cm4gZVswXT1pKmEtcyp1LGVbMV09cypvLXIqYSxlWzJdPXIqdS1pKm8sZX0sby5sZXJwPWZ1bmN0aW9uKGUsdCxuLHIpe3ZhciBpPXRbMF0scz10WzFdLG89dFsyXTtyZXR1cm4gZVswXT1pK3IqKG5bMF0taSksZVsxXT1zK3IqKG5bMV0tcyksZVsyXT1vK3IqKG5bMl0tbyksZX0sby5yYW5kb209ZnVuY3Rpb24oZSx0KXt0PXR8fDE7dmFyIG49cigpKjIqTWF0aC5QSSxpPXIoKSoyLTEscz1NYXRoLnNxcnQoMS1pKmkpKnQ7cmV0dXJuIGVbMF09TWF0aC5jb3MobikqcyxlWzFdPU1hdGguc2luKG4pKnMsZVsyXT1pKnQsZX0sby50cmFuc2Zvcm1NYXQ0PWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl07cmV0dXJuIGVbMF09blswXSpyK25bNF0qaStuWzhdKnMrblsxMl0sZVsxXT1uWzFdKnIrbls1XSppK25bOV0qcytuWzEzXSxlWzJdPW5bMl0qcituWzZdKmkrblsxMF0qcytuWzE0XSxlfSxvLnRyYW5zZm9ybU1hdDM9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXTtyZXR1cm4gZVswXT1yKm5bMF0raSpuWzNdK3Mqbls2XSxlWzFdPXIqblsxXStpKm5bNF0rcypuWzddLGVbMl09cipuWzJdK2kqbls1XStzKm5bOF0sZX0sby50cmFuc2Zvcm1RdWF0PWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz1uWzBdLHU9blsxXSxhPW5bMl0sZj1uWzNdLGw9ZipyK3Uqcy1hKmksYz1mKmkrYSpyLW8qcyxoPWYqcytvKmktdSpyLHA9LW8qci11KmktYSpzO3JldHVybiBlWzBdPWwqZitwKi1vK2MqLWEtaCotdSxlWzFdPWMqZitwKi11K2gqLW8tbCotYSxlWzJdPWgqZitwKi1hK2wqLXUtYyotbyxlfSxvLmZvckVhY2g9ZnVuY3Rpb24oKXt2YXIgZT1vLmNyZWF0ZSgpO3JldHVybiBmdW5jdGlvbih0LG4scixpLHMsbyl7dmFyIHUsYTtufHwobj0zKSxyfHwocj0wKSxpP2E9TWF0aC5taW4oaSpuK3IsdC5sZW5ndGgpOmE9dC5sZW5ndGg7Zm9yKHU9cjt1PGE7dSs9billWzBdPXRbdV0sZVsxXT10W3UrMV0sZVsyXT10W3UrMl0scyhlLGUsbyksdFt1XT1lWzBdLHRbdSsxXT1lWzFdLHRbdSsyXT1lWzJdO3JldHVybiB0fX0oKSxvLnN0cj1mdW5jdGlvbihlKXtyZXR1cm5cInZlYzMoXCIrZVswXStcIiwgXCIrZVsxXStcIiwgXCIrZVsyXStcIilcIn0sdHlwZW9mIGUhPVwidW5kZWZpbmVkXCImJihlLnZlYzM9byk7dmFyIHU9e307dS5jcmVhdGU9ZnVuY3Rpb24oKXt2YXIgZT1uZXcgbig0KTtyZXR1cm4gZVswXT0wLGVbMV09MCxlWzJdPTAsZVszXT0wLGV9LHUuY2xvbmU9ZnVuY3Rpb24oZSl7dmFyIHQ9bmV3IG4oNCk7cmV0dXJuIHRbMF09ZVswXSx0WzFdPWVbMV0sdFsyXT1lWzJdLHRbM109ZVszXSx0fSx1LmZyb21WYWx1ZXM9ZnVuY3Rpb24oZSx0LHIsaSl7dmFyIHM9bmV3IG4oNCk7cmV0dXJuIHNbMF09ZSxzWzFdPXQsc1syXT1yLHNbM109aSxzfSx1LmNvcHk9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXT10WzBdLGVbMV09dFsxXSxlWzJdPXRbMl0sZVszXT10WzNdLGV9LHUuc2V0PWZ1bmN0aW9uKGUsdCxuLHIsaSl7cmV0dXJuIGVbMF09dCxlWzFdPW4sZVsyXT1yLGVbM109aSxlfSx1LmFkZD1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dFswXStuWzBdLGVbMV09dFsxXStuWzFdLGVbMl09dFsyXStuWzJdLGVbM109dFszXStuWzNdLGV9LHUuc3VidHJhY3Q9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0tblswXSxlWzFdPXRbMV0tblsxXSxlWzJdPXRbMl0tblsyXSxlWzNdPXRbM10tblszXSxlfSx1LnN1Yj11LnN1YnRyYWN0LHUubXVsdGlwbHk9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0qblswXSxlWzFdPXRbMV0qblsxXSxlWzJdPXRbMl0qblsyXSxlWzNdPXRbM10qblszXSxlfSx1Lm11bD11Lm11bHRpcGx5LHUuZGl2aWRlPWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10WzBdL25bMF0sZVsxXT10WzFdL25bMV0sZVsyXT10WzJdL25bMl0sZVszXT10WzNdL25bM10sZX0sdS5kaXY9dS5kaXZpZGUsdS5taW49ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPU1hdGgubWluKHRbMF0sblswXSksZVsxXT1NYXRoLm1pbih0WzFdLG5bMV0pLGVbMl09TWF0aC5taW4odFsyXSxuWzJdKSxlWzNdPU1hdGgubWluKHRbM10sblszXSksZX0sdS5tYXg9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPU1hdGgubWF4KHRbMF0sblswXSksZVsxXT1NYXRoLm1heCh0WzFdLG5bMV0pLGVbMl09TWF0aC5tYXgodFsyXSxuWzJdKSxlWzNdPU1hdGgubWF4KHRbM10sblszXSksZX0sdS5zY2FsZT1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dFswXSpuLGVbMV09dFsxXSpuLGVbMl09dFsyXSpuLGVbM109dFszXSpuLGV9LHUuc2NhbGVBbmRBZGQ9ZnVuY3Rpb24oZSx0LG4scil7cmV0dXJuIGVbMF09dFswXStuWzBdKnIsZVsxXT10WzFdK25bMV0qcixlWzJdPXRbMl0rblsyXSpyLGVbM109dFszXStuWzNdKnIsZX0sdS5kaXN0YW5jZT1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0tZVswXSxyPXRbMV0tZVsxXSxpPXRbMl0tZVsyXSxzPXRbM10tZVszXTtyZXR1cm4gTWF0aC5zcXJ0KG4qbityKnIraSppK3Mqcyl9LHUuZGlzdD11LmRpc3RhbmNlLHUuc3F1YXJlZERpc3RhbmNlPWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXS1lWzBdLHI9dFsxXS1lWzFdLGk9dFsyXS1lWzJdLHM9dFszXS1lWzNdO3JldHVybiBuKm4rcipyK2kqaStzKnN9LHUuc3FyRGlzdD11LnNxdWFyZWREaXN0YW5jZSx1Lmxlbmd0aD1mdW5jdGlvbihlKXt2YXIgdD1lWzBdLG49ZVsxXSxyPWVbMl0saT1lWzNdO3JldHVybiBNYXRoLnNxcnQodCp0K24qbityKnIraSppKX0sdS5sZW49dS5sZW5ndGgsdS5zcXVhcmVkTGVuZ3RoPWZ1bmN0aW9uKGUpe3ZhciB0PWVbMF0sbj1lWzFdLHI9ZVsyXSxpPWVbM107cmV0dXJuIHQqdCtuKm4rcipyK2kqaX0sdS5zcXJMZW49dS5zcXVhcmVkTGVuZ3RoLHUubmVnYXRlPWZ1bmN0aW9uKGUsdCl7cmV0dXJuIGVbMF09LXRbMF0sZVsxXT0tdFsxXSxlWzJdPS10WzJdLGVbM109LXRbM10sZX0sdS5ub3JtYWxpemU9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLHI9dFsxXSxpPXRbMl0scz10WzNdLG89bipuK3IqcitpKmkrcypzO3JldHVybiBvPjAmJihvPTEvTWF0aC5zcXJ0KG8pLGVbMF09dFswXSpvLGVbMV09dFsxXSpvLGVbMl09dFsyXSpvLGVbM109dFszXSpvKSxlfSx1LmRvdD1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdKnRbMF0rZVsxXSp0WzFdK2VbMl0qdFsyXStlWzNdKnRbM119LHUubGVycD1mdW5jdGlvbihlLHQsbixyKXt2YXIgaT10WzBdLHM9dFsxXSxvPXRbMl0sdT10WzNdO3JldHVybiBlWzBdPWkrciooblswXS1pKSxlWzFdPXMrciooblsxXS1zKSxlWzJdPW8rciooblsyXS1vKSxlWzNdPXUrciooblszXS11KSxlfSx1LnJhbmRvbT1mdW5jdGlvbihlLHQpe3JldHVybiB0PXR8fDEsZVswXT1yKCksZVsxXT1yKCksZVsyXT1yKCksZVszXT1yKCksdS5ub3JtYWxpemUoZSxlKSx1LnNjYWxlKGUsZSx0KSxlfSx1LnRyYW5zZm9ybU1hdDQ9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM107cmV0dXJuIGVbMF09blswXSpyK25bNF0qaStuWzhdKnMrblsxMl0qbyxlWzFdPW5bMV0qcituWzVdKmkrbls5XSpzK25bMTNdKm8sZVsyXT1uWzJdKnIrbls2XSppK25bMTBdKnMrblsxNF0qbyxlWzNdPW5bM10qcituWzddKmkrblsxMV0qcytuWzE1XSpvLGV9LHUudHJhbnNmb3JtUXVhdD1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89blswXSx1PW5bMV0sYT1uWzJdLGY9blszXSxsPWYqcit1KnMtYSppLGM9ZippK2Eqci1vKnMsaD1mKnMrbyppLXUqcixwPS1vKnItdSppLWEqcztyZXR1cm4gZVswXT1sKmYrcCotbytjKi1hLWgqLXUsZVsxXT1jKmYrcCotdStoKi1vLWwqLWEsZVsyXT1oKmYrcCotYStsKi11LWMqLW8sZX0sdS5mb3JFYWNoPWZ1bmN0aW9uKCl7dmFyIGU9dS5jcmVhdGUoKTtyZXR1cm4gZnVuY3Rpb24odCxuLHIsaSxzLG8pe3ZhciB1LGE7bnx8KG49NCkscnx8KHI9MCksaT9hPU1hdGgubWluKGkqbityLHQubGVuZ3RoKTphPXQubGVuZ3RoO2Zvcih1PXI7dTxhO3UrPW4pZVswXT10W3VdLGVbMV09dFt1KzFdLGVbMl09dFt1KzJdLGVbM109dFt1KzNdLHMoZSxlLG8pLHRbdV09ZVswXSx0W3UrMV09ZVsxXSx0W3UrMl09ZVsyXSx0W3UrM109ZVszXTtyZXR1cm4gdH19KCksdS5zdHI9ZnVuY3Rpb24oZSl7cmV0dXJuXCJ2ZWM0KFwiK2VbMF0rXCIsIFwiK2VbMV0rXCIsIFwiK2VbMl0rXCIsIFwiK2VbM10rXCIpXCJ9LHR5cGVvZiBlIT1cInVuZGVmaW5lZFwiJiYoZS52ZWM0PXUpO3ZhciBhPXt9O2EuY3JlYXRlPWZ1bmN0aW9uKCl7dmFyIGU9bmV3IG4oNCk7cmV0dXJuIGVbMF09MSxlWzFdPTAsZVsyXT0wLGVbM109MSxlfSxhLmNsb25lPWZ1bmN0aW9uKGUpe3ZhciB0PW5ldyBuKDQpO3JldHVybiB0WzBdPWVbMF0sdFsxXT1lWzFdLHRbMl09ZVsyXSx0WzNdPWVbM10sdH0sYS5jb3B5PWZ1bmN0aW9uKGUsdCl7cmV0dXJuIGVbMF09dFswXSxlWzFdPXRbMV0sZVsyXT10WzJdLGVbM109dFszXSxlfSxhLmlkZW50aXR5PWZ1bmN0aW9uKGUpe3JldHVybiBlWzBdPTEsZVsxXT0wLGVbMl09MCxlWzNdPTEsZX0sYS50cmFuc3Bvc2U9ZnVuY3Rpb24oZSx0KXtpZihlPT09dCl7dmFyIG49dFsxXTtlWzFdPXRbMl0sZVsyXT1ufWVsc2UgZVswXT10WzBdLGVbMV09dFsyXSxlWzJdPXRbMV0sZVszXT10WzNdO3JldHVybiBlfSxhLmludmVydD1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0scj10WzFdLGk9dFsyXSxzPXRbM10sbz1uKnMtaSpyO3JldHVybiBvPyhvPTEvbyxlWzBdPXMqbyxlWzFdPS1yKm8sZVsyXT0taSpvLGVbM109bipvLGUpOm51bGx9LGEuYWRqb2ludD1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF07cmV0dXJuIGVbMF09dFszXSxlWzFdPS10WzFdLGVbMl09LXRbMl0sZVszXT1uLGV9LGEuZGV0ZXJtaW5hbnQ9ZnVuY3Rpb24oZSl7cmV0dXJuIGVbMF0qZVszXS1lWzJdKmVbMV19LGEubXVsdGlwbHk9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM10sdT1uWzBdLGE9blsxXSxmPW5bMl0sbD1uWzNdO3JldHVybiBlWzBdPXIqdStpKmYsZVsxXT1yKmEraSpsLGVbMl09cyp1K28qZixlWzNdPXMqYStvKmwsZX0sYS5tdWw9YS5tdWx0aXBseSxhLnJvdGF0ZT1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXSx1PU1hdGguc2luKG4pLGE9TWF0aC5jb3Mobik7cmV0dXJuIGVbMF09ciphK2kqdSxlWzFdPXIqLXUraSphLGVbMl09cyphK28qdSxlWzNdPXMqLXUrbyphLGV9LGEuc2NhbGU9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM10sdT1uWzBdLGE9blsxXTtyZXR1cm4gZVswXT1yKnUsZVsxXT1pKmEsZVsyXT1zKnUsZVszXT1vKmEsZX0sYS5zdHI9ZnVuY3Rpb24oZSl7cmV0dXJuXCJtYXQyKFwiK2VbMF0rXCIsIFwiK2VbMV0rXCIsIFwiK2VbMl0rXCIsIFwiK2VbM10rXCIpXCJ9LHR5cGVvZiBlIT1cInVuZGVmaW5lZFwiJiYoZS5tYXQyPWEpO3ZhciBmPXt9O2YuY3JlYXRlPWZ1bmN0aW9uKCl7dmFyIGU9bmV3IG4oNik7cmV0dXJuIGVbMF09MSxlWzFdPTAsZVsyXT0wLGVbM109MSxlWzRdPTAsZVs1XT0wLGV9LGYuY2xvbmU9ZnVuY3Rpb24oZSl7dmFyIHQ9bmV3IG4oNik7cmV0dXJuIHRbMF09ZVswXSx0WzFdPWVbMV0sdFsyXT1lWzJdLHRbM109ZVszXSx0WzRdPWVbNF0sdFs1XT1lWzVdLHR9LGYuY29weT1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdPXRbMF0sZVsxXT10WzFdLGVbMl09dFsyXSxlWzNdPXRbM10sZVs0XT10WzRdLGVbNV09dFs1XSxlfSxmLmlkZW50aXR5PWZ1bmN0aW9uKGUpe3JldHVybiBlWzBdPTEsZVsxXT0wLGVbMl09MCxlWzNdPTEsZVs0XT0wLGVbNV09MCxlfSxmLmludmVydD1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0scj10WzFdLGk9dFsyXSxzPXRbM10sbz10WzRdLHU9dFs1XSxhPW4qcy1yKmk7cmV0dXJuIGE/KGE9MS9hLGVbMF09cyphLGVbMV09LXIqYSxlWzJdPS1pKmEsZVszXT1uKmEsZVs0XT0oaSp1LXMqbykqYSxlWzVdPShyKm8tbip1KSphLGUpOm51bGx9LGYuZGV0ZXJtaW5hbnQ9ZnVuY3Rpb24oZSl7cmV0dXJuIGVbMF0qZVszXS1lWzFdKmVbMl19LGYubXVsdGlwbHk9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM10sdT10WzRdLGE9dFs1XSxmPW5bMF0sbD1uWzFdLGM9blsyXSxoPW5bM10scD1uWzRdLGQ9bls1XTtyZXR1cm4gZVswXT1yKmYraSpjLGVbMV09cipsK2kqaCxlWzJdPXMqZitvKmMsZVszXT1zKmwrbypoLGVbNF09Zip1K2MqYStwLGVbNV09bCp1K2gqYStkLGV9LGYubXVsPWYubXVsdGlwbHksZi5yb3RhdGU9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM10sdT10WzRdLGE9dFs1XSxmPU1hdGguc2luKG4pLGw9TWF0aC5jb3Mobik7cmV0dXJuIGVbMF09cipsK2kqZixlWzFdPS1yKmYraSpsLGVbMl09cypsK28qZixlWzNdPS1zKmYrbCpvLGVbNF09bCp1K2YqYSxlWzVdPWwqYS1mKnUsZX0sZi5zY2FsZT1mdW5jdGlvbihlLHQsbil7dmFyIHI9blswXSxpPW5bMV07cmV0dXJuIGVbMF09dFswXSpyLGVbMV09dFsxXSppLGVbMl09dFsyXSpyLGVbM109dFszXSppLGVbNF09dFs0XSpyLGVbNV09dFs1XSppLGV9LGYudHJhbnNsYXRlPWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10WzBdLGVbMV09dFsxXSxlWzJdPXRbMl0sZVszXT10WzNdLGVbNF09dFs0XStuWzBdLGVbNV09dFs1XStuWzFdLGV9LGYuc3RyPWZ1bmN0aW9uKGUpe3JldHVyblwibWF0MmQoXCIrZVswXStcIiwgXCIrZVsxXStcIiwgXCIrZVsyXStcIiwgXCIrZVszXStcIiwgXCIrZVs0XStcIiwgXCIrZVs1XStcIilcIn0sdHlwZW9mIGUhPVwidW5kZWZpbmVkXCImJihlLm1hdDJkPWYpO3ZhciBsPXt9O2wuY3JlYXRlPWZ1bmN0aW9uKCl7dmFyIGU9bmV3IG4oOSk7cmV0dXJuIGVbMF09MSxlWzFdPTAsZVsyXT0wLGVbM109MCxlWzRdPTEsZVs1XT0wLGVbNl09MCxlWzddPTAsZVs4XT0xLGV9LGwuZnJvbU1hdDQ9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXT10WzBdLGVbMV09dFsxXSxlWzJdPXRbMl0sZVszXT10WzRdLGVbNF09dFs1XSxlWzVdPXRbNl0sZVs2XT10WzhdLGVbN109dFs5XSxlWzhdPXRbMTBdLGV9LGwuY2xvbmU9ZnVuY3Rpb24oZSl7dmFyIHQ9bmV3IG4oOSk7cmV0dXJuIHRbMF09ZVswXSx0WzFdPWVbMV0sdFsyXT1lWzJdLHRbM109ZVszXSx0WzRdPWVbNF0sdFs1XT1lWzVdLHRbNl09ZVs2XSx0WzddPWVbN10sdFs4XT1lWzhdLHR9LGwuY29weT1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdPXRbMF0sZVsxXT10WzFdLGVbMl09dFsyXSxlWzNdPXRbM10sZVs0XT10WzRdLGVbNV09dFs1XSxlWzZdPXRbNl0sZVs3XT10WzddLGVbOF09dFs4XSxlfSxsLmlkZW50aXR5PWZ1bmN0aW9uKGUpe3JldHVybiBlWzBdPTEsZVsxXT0wLGVbMl09MCxlWzNdPTAsZVs0XT0xLGVbNV09MCxlWzZdPTAsZVs3XT0wLGVbOF09MSxlfSxsLnRyYW5zcG9zZT1mdW5jdGlvbihlLHQpe2lmKGU9PT10KXt2YXIgbj10WzFdLHI9dFsyXSxpPXRbNV07ZVsxXT10WzNdLGVbMl09dFs2XSxlWzNdPW4sZVs1XT10WzddLGVbNl09cixlWzddPWl9ZWxzZSBlWzBdPXRbMF0sZVsxXT10WzNdLGVbMl09dFs2XSxlWzNdPXRbMV0sZVs0XT10WzRdLGVbNV09dFs3XSxlWzZdPXRbMl0sZVs3XT10WzVdLGVbOF09dFs4XTtyZXR1cm4gZX0sbC5pbnZlcnQ9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLHI9dFsxXSxpPXRbMl0scz10WzNdLG89dFs0XSx1PXRbNV0sYT10WzZdLGY9dFs3XSxsPXRbOF0sYz1sKm8tdSpmLGg9LWwqcyt1KmEscD1mKnMtbyphLGQ9bipjK3IqaCtpKnA7cmV0dXJuIGQ/KGQ9MS9kLGVbMF09YypkLGVbMV09KC1sKnIraSpmKSpkLGVbMl09KHUqci1pKm8pKmQsZVszXT1oKmQsZVs0XT0obCpuLWkqYSkqZCxlWzVdPSgtdSpuK2kqcykqZCxlWzZdPXAqZCxlWzddPSgtZipuK3IqYSkqZCxlWzhdPShvKm4tcipzKSpkLGUpOm51bGx9LGwuYWRqb2ludD1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0scj10WzFdLGk9dFsyXSxzPXRbM10sbz10WzRdLHU9dFs1XSxhPXRbNl0sZj10WzddLGw9dFs4XTtyZXR1cm4gZVswXT1vKmwtdSpmLGVbMV09aSpmLXIqbCxlWzJdPXIqdS1pKm8sZVszXT11KmEtcypsLGVbNF09bipsLWkqYSxlWzVdPWkqcy1uKnUsZVs2XT1zKmYtbyphLGVbN109ciphLW4qZixlWzhdPW4qby1yKnMsZX0sbC5kZXRlcm1pbmFudD1mdW5jdGlvbihlKXt2YXIgdD1lWzBdLG49ZVsxXSxyPWVbMl0saT1lWzNdLHM9ZVs0XSxvPWVbNV0sdT1lWzZdLGE9ZVs3XSxmPWVbOF07cmV0dXJuIHQqKGYqcy1vKmEpK24qKC1mKmkrbyp1KStyKihhKmktcyp1KX0sbC5tdWx0aXBseT1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXSx1PXRbNF0sYT10WzVdLGY9dFs2XSxsPXRbN10sYz10WzhdLGg9blswXSxwPW5bMV0sZD1uWzJdLHY9blszXSxtPW5bNF0sZz1uWzVdLHk9bls2XSxiPW5bN10sdz1uWzhdO3JldHVybiBlWzBdPWgqcitwKm8rZCpmLGVbMV09aCppK3AqdStkKmwsZVsyXT1oKnMrcCphK2QqYyxlWzNdPXYqcittKm8rZypmLGVbNF09dippK20qdStnKmwsZVs1XT12KnMrbSphK2cqYyxlWzZdPXkqcitiKm8rdypmLGVbN109eSppK2IqdSt3KmwsZVs4XT15KnMrYiphK3cqYyxlfSxsLm11bD1sLm11bHRpcGx5LGwudHJhbnNsYXRlPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz10WzNdLHU9dFs0XSxhPXRbNV0sZj10WzZdLGw9dFs3XSxjPXRbOF0saD1uWzBdLHA9blsxXTtyZXR1cm4gZVswXT1yLGVbMV09aSxlWzJdPXMsZVszXT1vLGVbNF09dSxlWzVdPWEsZVs2XT1oKnIrcCpvK2YsZVs3XT1oKmkrcCp1K2wsZVs4XT1oKnMrcCphK2MsZX0sbC5yb3RhdGU9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM10sdT10WzRdLGE9dFs1XSxmPXRbNl0sbD10WzddLGM9dFs4XSxoPU1hdGguc2luKG4pLHA9TWF0aC5jb3Mobik7cmV0dXJuIGVbMF09cCpyK2gqbyxlWzFdPXAqaStoKnUsZVsyXT1wKnMraCphLGVbM109cCpvLWgqcixlWzRdPXAqdS1oKmksZVs1XT1wKmEtaCpzLGVbNl09ZixlWzddPWwsZVs4XT1jLGV9LGwuc2NhbGU9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPW5bMF0saT1uWzFdO3JldHVybiBlWzBdPXIqdFswXSxlWzFdPXIqdFsxXSxlWzJdPXIqdFsyXSxlWzNdPWkqdFszXSxlWzRdPWkqdFs0XSxlWzVdPWkqdFs1XSxlWzZdPXRbNl0sZVs3XT10WzddLGVbOF09dFs4XSxlfSxsLmZyb21NYXQyZD1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdPXRbMF0sZVsxXT10WzFdLGVbMl09MCxlWzNdPXRbMl0sZVs0XT10WzNdLGVbNV09MCxlWzZdPXRbNF0sZVs3XT10WzVdLGVbOF09MSxlfSxsLmZyb21RdWF0PWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXSxyPXRbMV0saT10WzJdLHM9dFszXSxvPW4rbix1PXIrcixhPWkraSxmPW4qbyxsPW4qdSxjPW4qYSxoPXIqdSxwPXIqYSxkPWkqYSx2PXMqbyxtPXMqdSxnPXMqYTtyZXR1cm4gZVswXT0xLShoK2QpLGVbM109bCtnLGVbNl09Yy1tLGVbMV09bC1nLGVbNF09MS0oZitkKSxlWzddPXArdixlWzJdPWMrbSxlWzVdPXAtdixlWzhdPTEtKGYraCksZX0sbC5ub3JtYWxGcm9tTWF0ND1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0scj10WzFdLGk9dFsyXSxzPXRbM10sbz10WzRdLHU9dFs1XSxhPXRbNl0sZj10WzddLGw9dFs4XSxjPXRbOV0saD10WzEwXSxwPXRbMTFdLGQ9dFsxMl0sdj10WzEzXSxtPXRbMTRdLGc9dFsxNV0seT1uKnUtcipvLGI9biphLWkqbyx3PW4qZi1zKm8sRT1yKmEtaSp1LFM9cipmLXMqdSx4PWkqZi1zKmEsVD1sKnYtYypkLE49bCptLWgqZCxDPWwqZy1wKmQsaz1jKm0taCp2LEw9YypnLXAqdixBPWgqZy1wKm0sTz15KkEtYipMK3cqaytFKkMtUypOK3gqVDtyZXR1cm4gTz8oTz0xL08sZVswXT0odSpBLWEqTCtmKmspKk8sZVsxXT0oYSpDLW8qQS1mKk4pKk8sZVsyXT0obypMLXUqQytmKlQpKk8sZVszXT0oaSpMLXIqQS1zKmspKk8sZVs0XT0obipBLWkqQytzKk4pKk8sZVs1XT0ocipDLW4qTC1zKlQpKk8sZVs2XT0odip4LW0qUytnKkUpKk8sZVs3XT0obSp3LWQqeC1nKmIpKk8sZVs4XT0oZCpTLXYqdytnKnkpKk8sZSk6bnVsbH0sbC5zdHI9ZnVuY3Rpb24oZSl7cmV0dXJuXCJtYXQzKFwiK2VbMF0rXCIsIFwiK2VbMV0rXCIsIFwiK2VbMl0rXCIsIFwiK2VbM10rXCIsIFwiK2VbNF0rXCIsIFwiK2VbNV0rXCIsIFwiK2VbNl0rXCIsIFwiK2VbN10rXCIsIFwiK2VbOF0rXCIpXCJ9LHR5cGVvZiBlIT1cInVuZGVmaW5lZFwiJiYoZS5tYXQzPWwpO3ZhciBjPXt9O2MuY3JlYXRlPWZ1bmN0aW9uKCl7dmFyIGU9bmV3IG4oMTYpO3JldHVybiBlWzBdPTEsZVsxXT0wLGVbMl09MCxlWzNdPTAsZVs0XT0wLGVbNV09MSxlWzZdPTAsZVs3XT0wLGVbOF09MCxlWzldPTAsZVsxMF09MSxlWzExXT0wLGVbMTJdPTAsZVsxM109MCxlWzE0XT0wLGVbMTVdPTEsZX0sYy5jbG9uZT1mdW5jdGlvbihlKXt2YXIgdD1uZXcgbigxNik7cmV0dXJuIHRbMF09ZVswXSx0WzFdPWVbMV0sdFsyXT1lWzJdLHRbM109ZVszXSx0WzRdPWVbNF0sdFs1XT1lWzVdLHRbNl09ZVs2XSx0WzddPWVbN10sdFs4XT1lWzhdLHRbOV09ZVs5XSx0WzEwXT1lWzEwXSx0WzExXT1lWzExXSx0WzEyXT1lWzEyXSx0WzEzXT1lWzEzXSx0WzE0XT1lWzE0XSx0WzE1XT1lWzE1XSx0fSxjLmNvcHk9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXT10WzBdLGVbMV09dFsxXSxlWzJdPXRbMl0sZVszXT10WzNdLGVbNF09dFs0XSxlWzVdPXRbNV0sZVs2XT10WzZdLGVbN109dFs3XSxlWzhdPXRbOF0sZVs5XT10WzldLGVbMTBdPXRbMTBdLGVbMTFdPXRbMTFdLGVbMTJdPXRbMTJdLGVbMTNdPXRbMTNdLGVbMTRdPXRbMTRdLGVbMTVdPXRbMTVdLGV9LGMuaWRlbnRpdHk9ZnVuY3Rpb24oZSl7cmV0dXJuIGVbMF09MSxlWzFdPTAsZVsyXT0wLGVbM109MCxlWzRdPTAsZVs1XT0xLGVbNl09MCxlWzddPTAsZVs4XT0wLGVbOV09MCxlWzEwXT0xLGVbMTFdPTAsZVsxMl09MCxlWzEzXT0wLGVbMTRdPTAsZVsxNV09MSxlfSxjLnRyYW5zcG9zZT1mdW5jdGlvbihlLHQpe2lmKGU9PT10KXt2YXIgbj10WzFdLHI9dFsyXSxpPXRbM10scz10WzZdLG89dFs3XSx1PXRbMTFdO2VbMV09dFs0XSxlWzJdPXRbOF0sZVszXT10WzEyXSxlWzRdPW4sZVs2XT10WzldLGVbN109dFsxM10sZVs4XT1yLGVbOV09cyxlWzExXT10WzE0XSxlWzEyXT1pLGVbMTNdPW8sZVsxNF09dX1lbHNlIGVbMF09dFswXSxlWzFdPXRbNF0sZVsyXT10WzhdLGVbM109dFsxMl0sZVs0XT10WzFdLGVbNV09dFs1XSxlWzZdPXRbOV0sZVs3XT10WzEzXSxlWzhdPXRbMl0sZVs5XT10WzZdLGVbMTBdPXRbMTBdLGVbMTFdPXRbMTRdLGVbMTJdPXRbM10sZVsxM109dFs3XSxlWzE0XT10WzExXSxlWzE1XT10WzE1XTtyZXR1cm4gZX0sYy5pbnZlcnQ9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLHI9dFsxXSxpPXRbMl0scz10WzNdLG89dFs0XSx1PXRbNV0sYT10WzZdLGY9dFs3XSxsPXRbOF0sYz10WzldLGg9dFsxMF0scD10WzExXSxkPXRbMTJdLHY9dFsxM10sbT10WzE0XSxnPXRbMTVdLHk9bip1LXIqbyxiPW4qYS1pKm8sdz1uKmYtcypvLEU9ciphLWkqdSxTPXIqZi1zKnUseD1pKmYtcyphLFQ9bCp2LWMqZCxOPWwqbS1oKmQsQz1sKmctcCpkLGs9YyptLWgqdixMPWMqZy1wKnYsQT1oKmctcCptLE89eSpBLWIqTCt3KmsrRSpDLVMqTit4KlQ7cmV0dXJuIE8/KE89MS9PLGVbMF09KHUqQS1hKkwrZiprKSpPLGVbMV09KGkqTC1yKkEtcyprKSpPLGVbMl09KHYqeC1tKlMrZypFKSpPLGVbM109KGgqUy1jKngtcCpFKSpPLGVbNF09KGEqQy1vKkEtZipOKSpPLGVbNV09KG4qQS1pKkMrcypOKSpPLGVbNl09KG0qdy1kKngtZypiKSpPLGVbN109KGwqeC1oKncrcCpiKSpPLGVbOF09KG8qTC11KkMrZipUKSpPLGVbOV09KHIqQy1uKkwtcypUKSpPLGVbMTBdPShkKlMtdip3K2cqeSkqTyxlWzExXT0oYyp3LWwqUy1wKnkpKk8sZVsxMl09KHUqTi1vKmstYSpUKSpPLGVbMTNdPShuKmstcipOK2kqVCkqTyxlWzE0XT0odipiLWQqRS1tKnkpKk8sZVsxNV09KGwqRS1jKmIraCp5KSpPLGUpOm51bGx9LGMuYWRqb2ludD1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0scj10WzFdLGk9dFsyXSxzPXRbM10sbz10WzRdLHU9dFs1XSxhPXRbNl0sZj10WzddLGw9dFs4XSxjPXRbOV0saD10WzEwXSxwPXRbMTFdLGQ9dFsxMl0sdj10WzEzXSxtPXRbMTRdLGc9dFsxNV07cmV0dXJuIGVbMF09dSooaCpnLXAqbSktYyooYSpnLWYqbSkrdiooYSpwLWYqaCksZVsxXT0tKHIqKGgqZy1wKm0pLWMqKGkqZy1zKm0pK3YqKGkqcC1zKmgpKSxlWzJdPXIqKGEqZy1mKm0pLXUqKGkqZy1zKm0pK3YqKGkqZi1zKmEpLGVbM109LShyKihhKnAtZipoKS11KihpKnAtcypoKStjKihpKmYtcyphKSksZVs0XT0tKG8qKGgqZy1wKm0pLWwqKGEqZy1mKm0pK2QqKGEqcC1mKmgpKSxlWzVdPW4qKGgqZy1wKm0pLWwqKGkqZy1zKm0pK2QqKGkqcC1zKmgpLGVbNl09LShuKihhKmctZiptKS1vKihpKmctcyptKStkKihpKmYtcyphKSksZVs3XT1uKihhKnAtZipoKS1vKihpKnAtcypoKStsKihpKmYtcyphKSxlWzhdPW8qKGMqZy1wKnYpLWwqKHUqZy1mKnYpK2QqKHUqcC1mKmMpLGVbOV09LShuKihjKmctcCp2KS1sKihyKmctcyp2KStkKihyKnAtcypjKSksZVsxMF09bioodSpnLWYqdiktbyoocipnLXMqdikrZCoocipmLXMqdSksZVsxMV09LShuKih1KnAtZipjKS1vKihyKnAtcypjKStsKihyKmYtcyp1KSksZVsxMl09LShvKihjKm0taCp2KS1sKih1Km0tYSp2KStkKih1KmgtYSpjKSksZVsxM109biooYyptLWgqdiktbCoociptLWkqdikrZCoocipoLWkqYyksZVsxNF09LShuKih1Km0tYSp2KS1vKihyKm0taSp2KStkKihyKmEtaSp1KSksZVsxNV09bioodSpoLWEqYyktbyoocipoLWkqYykrbCoociphLWkqdSksZX0sYy5kZXRlcm1pbmFudD1mdW5jdGlvbihlKXt2YXIgdD1lWzBdLG49ZVsxXSxyPWVbMl0saT1lWzNdLHM9ZVs0XSxvPWVbNV0sdT1lWzZdLGE9ZVs3XSxmPWVbOF0sbD1lWzldLGM9ZVsxMF0saD1lWzExXSxwPWVbMTJdLGQ9ZVsxM10sdj1lWzE0XSxtPWVbMTVdLGc9dCpvLW4qcyx5PXQqdS1yKnMsYj10KmEtaSpzLHc9bip1LXIqbyxFPW4qYS1pKm8sUz1yKmEtaSp1LHg9ZipkLWwqcCxUPWYqdi1jKnAsTj1mKm0taCpwLEM9bCp2LWMqZCxrPWwqbS1oKmQsTD1jKm0taCp2O3JldHVybiBnKkwteSprK2IqQyt3Kk4tRSpUK1MqeH0sYy5tdWx0aXBseT1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXSx1PXRbNF0sYT10WzVdLGY9dFs2XSxsPXRbN10sYz10WzhdLGg9dFs5XSxwPXRbMTBdLGQ9dFsxMV0sdj10WzEyXSxtPXRbMTNdLGc9dFsxNF0seT10WzE1XSxiPW5bMF0sdz1uWzFdLEU9blsyXSxTPW5bM107cmV0dXJuIGVbMF09YipyK3cqdStFKmMrUyp2LGVbMV09YippK3cqYStFKmgrUyptLGVbMl09YipzK3cqZitFKnArUypnLGVbM109YipvK3cqbCtFKmQrUyp5LGI9bls0XSx3PW5bNV0sRT1uWzZdLFM9bls3XSxlWzRdPWIqcit3KnUrRSpjK1MqdixlWzVdPWIqaSt3KmErRSpoK1MqbSxlWzZdPWIqcyt3KmYrRSpwK1MqZyxlWzddPWIqbyt3KmwrRSpkK1MqeSxiPW5bOF0sdz1uWzldLEU9blsxMF0sUz1uWzExXSxlWzhdPWIqcit3KnUrRSpjK1MqdixlWzldPWIqaSt3KmErRSpoK1MqbSxlWzEwXT1iKnMrdypmK0UqcCtTKmcsZVsxMV09YipvK3cqbCtFKmQrUyp5LGI9blsxMl0sdz1uWzEzXSxFPW5bMTRdLFM9blsxNV0sZVsxMl09YipyK3cqdStFKmMrUyp2LGVbMTNdPWIqaSt3KmErRSpoK1MqbSxlWzE0XT1iKnMrdypmK0UqcCtTKmcsZVsxNV09YipvK3cqbCtFKmQrUyp5LGV9LGMubXVsPWMubXVsdGlwbHksYy50cmFuc2xhdGU9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPW5bMF0saT1uWzFdLHM9blsyXSxvLHUsYSxmLGwsYyxoLHAsZCx2LG0sZztyZXR1cm4gdD09PWU/KGVbMTJdPXRbMF0qcit0WzRdKmkrdFs4XSpzK3RbMTJdLGVbMTNdPXRbMV0qcit0WzVdKmkrdFs5XSpzK3RbMTNdLGVbMTRdPXRbMl0qcit0WzZdKmkrdFsxMF0qcyt0WzE0XSxlWzE1XT10WzNdKnIrdFs3XSppK3RbMTFdKnMrdFsxNV0pOihvPXRbMF0sdT10WzFdLGE9dFsyXSxmPXRbM10sbD10WzRdLGM9dFs1XSxoPXRbNl0scD10WzddLGQ9dFs4XSx2PXRbOV0sbT10WzEwXSxnPXRbMTFdLGVbMF09byxlWzFdPXUsZVsyXT1hLGVbM109ZixlWzRdPWwsZVs1XT1jLGVbNl09aCxlWzddPXAsZVs4XT1kLGVbOV09dixlWzEwXT1tLGVbMTFdPWcsZVsxMl09bypyK2wqaStkKnMrdFsxMl0sZVsxM109dSpyK2MqaSt2KnMrdFsxM10sZVsxNF09YSpyK2gqaSttKnMrdFsxNF0sZVsxNV09ZipyK3AqaStnKnMrdFsxNV0pLGV9LGMuc2NhbGU9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPW5bMF0saT1uWzFdLHM9blsyXTtyZXR1cm4gZVswXT10WzBdKnIsZVsxXT10WzFdKnIsZVsyXT10WzJdKnIsZVszXT10WzNdKnIsZVs0XT10WzRdKmksZVs1XT10WzVdKmksZVs2XT10WzZdKmksZVs3XT10WzddKmksZVs4XT10WzhdKnMsZVs5XT10WzldKnMsZVsxMF09dFsxMF0qcyxlWzExXT10WzExXSpzLGVbMTJdPXRbMTJdLGVbMTNdPXRbMTNdLGVbMTRdPXRbMTRdLGVbMTVdPXRbMTVdLGV9LGMucm90YXRlPWZ1bmN0aW9uKGUsbixyLGkpe3ZhciBzPWlbMF0sbz1pWzFdLHU9aVsyXSxhPU1hdGguc3FydChzKnMrbypvK3UqdSksZixsLGMsaCxwLGQsdixtLGcseSxiLHcsRSxTLHgsVCxOLEMsayxMLEEsTyxNLF87cmV0dXJuIE1hdGguYWJzKGEpPHQ/bnVsbDooYT0xL2Escyo9YSxvKj1hLHUqPWEsZj1NYXRoLnNpbihyKSxsPU1hdGguY29zKHIpLGM9MS1sLGg9blswXSxwPW5bMV0sZD1uWzJdLHY9blszXSxtPW5bNF0sZz1uWzVdLHk9bls2XSxiPW5bN10sdz1uWzhdLEU9bls5XSxTPW5bMTBdLHg9blsxMV0sVD1zKnMqYytsLE49bypzKmMrdSpmLEM9dSpzKmMtbypmLGs9cypvKmMtdSpmLEw9bypvKmMrbCxBPXUqbypjK3MqZixPPXMqdSpjK28qZixNPW8qdSpjLXMqZixfPXUqdSpjK2wsZVswXT1oKlQrbSpOK3cqQyxlWzFdPXAqVCtnKk4rRSpDLGVbMl09ZCpUK3kqTitTKkMsZVszXT12KlQrYipOK3gqQyxlWzRdPWgqayttKkwrdypBLGVbNV09cCprK2cqTCtFKkEsZVs2XT1kKmsreSpMK1MqQSxlWzddPXYqaytiKkwreCpBLGVbOF09aCpPK20qTSt3Kl8sZVs5XT1wKk8rZypNK0UqXyxlWzEwXT1kKk8reSpNK1MqXyxlWzExXT12Kk8rYipNK3gqXyxuIT09ZSYmKGVbMTJdPW5bMTJdLGVbMTNdPW5bMTNdLGVbMTRdPW5bMTRdLGVbMTVdPW5bMTVdKSxlKX0sYy5yb3RhdGVYPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj1NYXRoLnNpbihuKSxpPU1hdGguY29zKG4pLHM9dFs0XSxvPXRbNV0sdT10WzZdLGE9dFs3XSxmPXRbOF0sbD10WzldLGM9dFsxMF0saD10WzExXTtyZXR1cm4gdCE9PWUmJihlWzBdPXRbMF0sZVsxXT10WzFdLGVbMl09dFsyXSxlWzNdPXRbM10sZVsxMl09dFsxMl0sZVsxM109dFsxM10sZVsxNF09dFsxNF0sZVsxNV09dFsxNV0pLGVbNF09cyppK2YqcixlWzVdPW8qaStsKnIsZVs2XT11KmkrYypyLGVbN109YSppK2gqcixlWzhdPWYqaS1zKnIsZVs5XT1sKmktbypyLGVbMTBdPWMqaS11KnIsZVsxMV09aCppLWEqcixlfSxjLnJvdGF0ZVk9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPU1hdGguc2luKG4pLGk9TWF0aC5jb3Mobikscz10WzBdLG89dFsxXSx1PXRbMl0sYT10WzNdLGY9dFs4XSxsPXRbOV0sYz10WzEwXSxoPXRbMTFdO3JldHVybiB0IT09ZSYmKGVbNF09dFs0XSxlWzVdPXRbNV0sZVs2XT10WzZdLGVbN109dFs3XSxlWzEyXT10WzEyXSxlWzEzXT10WzEzXSxlWzE0XT10WzE0XSxlWzE1XT10WzE1XSksZVswXT1zKmktZipyLGVbMV09byppLWwqcixlWzJdPXUqaS1jKnIsZVszXT1hKmktaCpyLGVbOF09cypyK2YqaSxlWzldPW8qcitsKmksZVsxMF09dSpyK2MqaSxlWzExXT1hKnIraCppLGV9LGMucm90YXRlWj1mdW5jdGlvbihlLHQsbil7dmFyIHI9TWF0aC5zaW4obiksaT1NYXRoLmNvcyhuKSxzPXRbMF0sbz10WzFdLHU9dFsyXSxhPXRbM10sZj10WzRdLGw9dFs1XSxjPXRbNl0saD10WzddO3JldHVybiB0IT09ZSYmKGVbOF09dFs4XSxlWzldPXRbOV0sZVsxMF09dFsxMF0sZVsxMV09dFsxMV0sZVsxMl09dFsxMl0sZVsxM109dFsxM10sZVsxNF09dFsxNF0sZVsxNV09dFsxNV0pLGVbMF09cyppK2YqcixlWzFdPW8qaStsKnIsZVsyXT11KmkrYypyLGVbM109YSppK2gqcixlWzRdPWYqaS1zKnIsZVs1XT1sKmktbypyLGVbNl09YyppLXUqcixlWzddPWgqaS1hKnIsZX0sYy5mcm9tUm90YXRpb25UcmFuc2xhdGlvbj1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXSx1PXIrcixhPWkraSxmPXMrcyxsPXIqdSxjPXIqYSxoPXIqZixwPWkqYSxkPWkqZix2PXMqZixtPW8qdSxnPW8qYSx5PW8qZjtyZXR1cm4gZVswXT0xLShwK3YpLGVbMV09Yyt5LGVbMl09aC1nLGVbM109MCxlWzRdPWMteSxlWzVdPTEtKGwrdiksZVs2XT1kK20sZVs3XT0wLGVbOF09aCtnLGVbOV09ZC1tLGVbMTBdPTEtKGwrcCksZVsxMV09MCxlWzEyXT1uWzBdLGVbMTNdPW5bMV0sZVsxNF09blsyXSxlWzE1XT0xLGV9LGMuZnJvbVF1YXQ9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLHI9dFsxXSxpPXRbMl0scz10WzNdLG89bituLHU9cityLGE9aStpLGY9bipvLGw9bip1LGM9biphLGg9cip1LHA9ciphLGQ9aSphLHY9cypvLG09cyp1LGc9cyphO3JldHVybiBlWzBdPTEtKGgrZCksZVsxXT1sK2csZVsyXT1jLW0sZVszXT0wLGVbNF09bC1nLGVbNV09MS0oZitkKSxlWzZdPXArdixlWzddPTAsZVs4XT1jK20sZVs5XT1wLXYsZVsxMF09MS0oZitoKSxlWzExXT0wLGVbMTJdPTAsZVsxM109MCxlWzE0XT0wLGVbMTVdPTEsZX0sYy5mcnVzdHVtPWZ1bmN0aW9uKGUsdCxuLHIsaSxzLG8pe3ZhciB1PTEvKG4tdCksYT0xLyhpLXIpLGY9MS8ocy1vKTtyZXR1cm4gZVswXT1zKjIqdSxlWzFdPTAsZVsyXT0wLGVbM109MCxlWzRdPTAsZVs1XT1zKjIqYSxlWzZdPTAsZVs3XT0wLGVbOF09KG4rdCkqdSxlWzldPShpK3IpKmEsZVsxMF09KG8rcykqZixlWzExXT0tMSxlWzEyXT0wLGVbMTNdPTAsZVsxNF09bypzKjIqZixlWzE1XT0wLGV9LGMucGVyc3BlY3RpdmU9ZnVuY3Rpb24oZSx0LG4scixpKXt2YXIgcz0xL01hdGgudGFuKHQvMiksbz0xLyhyLWkpO3JldHVybiBlWzBdPXMvbixlWzFdPTAsZVsyXT0wLGVbM109MCxlWzRdPTAsZVs1XT1zLGVbNl09MCxlWzddPTAsZVs4XT0wLGVbOV09MCxlWzEwXT0oaStyKSpvLGVbMTFdPS0xLGVbMTJdPTAsZVsxM109MCxlWzE0XT0yKmkqcipvLGVbMTVdPTAsZX0sYy5vcnRobz1mdW5jdGlvbihlLHQsbixyLGkscyxvKXt2YXIgdT0xLyh0LW4pLGE9MS8oci1pKSxmPTEvKHMtbyk7cmV0dXJuIGVbMF09LTIqdSxlWzFdPTAsZVsyXT0wLGVbM109MCxlWzRdPTAsZVs1XT0tMiphLGVbNl09MCxlWzddPTAsZVs4XT0wLGVbOV09MCxlWzEwXT0yKmYsZVsxMV09MCxlWzEyXT0odCtuKSp1LGVbMTNdPShpK3IpKmEsZVsxNF09KG8rcykqZixlWzE1XT0xLGV9LGMubG9va0F0PWZ1bmN0aW9uKGUsbixyLGkpe3ZhciBzLG8sdSxhLGYsbCxoLHAsZCx2LG09blswXSxnPW5bMV0seT1uWzJdLGI9aVswXSx3PWlbMV0sRT1pWzJdLFM9clswXSx4PXJbMV0sVD1yWzJdO3JldHVybiBNYXRoLmFicyhtLVMpPHQmJk1hdGguYWJzKGcteCk8dCYmTWF0aC5hYnMoeS1UKTx0P2MuaWRlbnRpdHkoZSk6KGg9bS1TLHA9Zy14LGQ9eS1ULHY9MS9NYXRoLnNxcnQoaCpoK3AqcCtkKmQpLGgqPXYscCo9dixkKj12LHM9dypkLUUqcCxvPUUqaC1iKmQsdT1iKnAtdypoLHY9TWF0aC5zcXJ0KHMqcytvKm8rdSp1KSx2Pyh2PTEvdixzKj12LG8qPXYsdSo9dik6KHM9MCxvPTAsdT0wKSxhPXAqdS1kKm8sZj1kKnMtaCp1LGw9aCpvLXAqcyx2PU1hdGguc3FydChhKmErZipmK2wqbCksdj8odj0xL3YsYSo9dixmKj12LGwqPXYpOihhPTAsZj0wLGw9MCksZVswXT1zLGVbMV09YSxlWzJdPWgsZVszXT0wLGVbNF09byxlWzVdPWYsZVs2XT1wLGVbN109MCxlWzhdPXUsZVs5XT1sLGVbMTBdPWQsZVsxMV09MCxlWzEyXT0tKHMqbStvKmcrdSp5KSxlWzEzXT0tKGEqbStmKmcrbCp5KSxlWzE0XT0tKGgqbStwKmcrZCp5KSxlWzE1XT0xLGUpfSxjLnN0cj1mdW5jdGlvbihlKXtyZXR1cm5cIm1hdDQoXCIrZVswXStcIiwgXCIrZVsxXStcIiwgXCIrZVsyXStcIiwgXCIrZVszXStcIiwgXCIrZVs0XStcIiwgXCIrZVs1XStcIiwgXCIrZVs2XStcIiwgXCIrZVs3XStcIiwgXCIrZVs4XStcIiwgXCIrZVs5XStcIiwgXCIrZVsxMF0rXCIsIFwiK2VbMTFdK1wiLCBcIitlWzEyXStcIiwgXCIrZVsxM10rXCIsIFwiK2VbMTRdK1wiLCBcIitlWzE1XStcIilcIn0sdHlwZW9mIGUhPVwidW5kZWZpbmVkXCImJihlLm1hdDQ9Yyk7dmFyIGg9e307aC5jcmVhdGU9ZnVuY3Rpb24oKXt2YXIgZT1uZXcgbig0KTtyZXR1cm4gZVswXT0wLGVbMV09MCxlWzJdPTAsZVszXT0xLGV9LGgucm90YXRpb25Ubz1mdW5jdGlvbigpe3ZhciBlPW8uY3JlYXRlKCksdD1vLmZyb21WYWx1ZXMoMSwwLDApLG49by5mcm9tVmFsdWVzKDAsMSwwKTtyZXR1cm4gZnVuY3Rpb24ocixpLHMpe3ZhciB1PW8uZG90KGkscyk7cmV0dXJuIHU8LTAuOTk5OTk5PyhvLmNyb3NzKGUsdCxpKSxvLmxlbmd0aChlKTwxZS02JiZvLmNyb3NzKGUsbixpKSxvLm5vcm1hbGl6ZShlLGUpLGguc2V0QXhpc0FuZ2xlKHIsZSxNYXRoLlBJKSxyKTp1Pi45OTk5OTk/KHJbMF09MCxyWzFdPTAsclsyXT0wLHJbM109MSxyKTooby5jcm9zcyhlLGkscyksclswXT1lWzBdLHJbMV09ZVsxXSxyWzJdPWVbMl0sclszXT0xK3UsaC5ub3JtYWxpemUocixyKSl9fSgpLGguc2V0QXhlcz1mdW5jdGlvbigpe3ZhciBlPWwuY3JlYXRlKCk7cmV0dXJuIGZ1bmN0aW9uKHQsbixyLGkpe3JldHVybiBlWzBdPXJbMF0sZVszXT1yWzFdLGVbNl09clsyXSxlWzFdPWlbMF0sZVs0XT1pWzFdLGVbN109aVsyXSxlWzJdPW5bMF0sZVs1XT1uWzFdLGVbOF09blsyXSxoLm5vcm1hbGl6ZSh0LGguZnJvbU1hdDModCxlKSl9fSgpLGguY2xvbmU9dS5jbG9uZSxoLmZyb21WYWx1ZXM9dS5mcm9tVmFsdWVzLGguY29weT11LmNvcHksaC5zZXQ9dS5zZXQsaC5pZGVudGl0eT1mdW5jdGlvbihlKXtyZXR1cm4gZVswXT0wLGVbMV09MCxlWzJdPTAsZVszXT0xLGV9LGguc2V0QXhpc0FuZ2xlPWZ1bmN0aW9uKGUsdCxuKXtuKj0uNTt2YXIgcj1NYXRoLnNpbihuKTtyZXR1cm4gZVswXT1yKnRbMF0sZVsxXT1yKnRbMV0sZVsyXT1yKnRbMl0sZVszXT1NYXRoLmNvcyhuKSxlfSxoLmFkZD11LmFkZCxoLm11bHRpcGx5PWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz10WzNdLHU9blswXSxhPW5bMV0sZj1uWzJdLGw9blszXTtyZXR1cm4gZVswXT1yKmwrbyp1K2kqZi1zKmEsZVsxXT1pKmwrbyphK3MqdS1yKmYsZVsyXT1zKmwrbypmK3IqYS1pKnUsZVszXT1vKmwtcip1LWkqYS1zKmYsZX0saC5tdWw9aC5tdWx0aXBseSxoLnNjYWxlPXUuc2NhbGUsaC5yb3RhdGVYPWZ1bmN0aW9uKGUsdCxuKXtuKj0uNTt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz10WzNdLHU9TWF0aC5zaW4obiksYT1NYXRoLmNvcyhuKTtyZXR1cm4gZVswXT1yKmErbyp1LGVbMV09aSphK3MqdSxlWzJdPXMqYS1pKnUsZVszXT1vKmEtcip1LGV9LGgucm90YXRlWT1mdW5jdGlvbihlLHQsbil7bio9LjU7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXSx1PU1hdGguc2luKG4pLGE9TWF0aC5jb3Mobik7cmV0dXJuIGVbMF09ciphLXMqdSxlWzFdPWkqYStvKnUsZVsyXT1zKmErcip1LGVbM109byphLWkqdSxlfSxoLnJvdGF0ZVo9ZnVuY3Rpb24oZSx0LG4pe24qPS41O3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM10sdT1NYXRoLnNpbihuKSxhPU1hdGguY29zKG4pO3JldHVybiBlWzBdPXIqYStpKnUsZVsxXT1pKmEtcip1LGVbMl09cyphK28qdSxlWzNdPW8qYS1zKnUsZX0saC5jYWxjdWxhdGVXPWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXSxyPXRbMV0saT10WzJdO3JldHVybiBlWzBdPW4sZVsxXT1yLGVbMl09aSxlWzNdPS1NYXRoLnNxcnQoTWF0aC5hYnMoMS1uKm4tcipyLWkqaSkpLGV9LGguZG90PXUuZG90LGgubGVycD11LmxlcnAsaC5zbGVycD1mdW5jdGlvbihlLHQsbixyKXt2YXIgaT10WzBdLHM9dFsxXSxvPXRbMl0sdT10WzNdLGE9blswXSxmPW5bMV0sbD1uWzJdLGM9blszXSxoLHAsZCx2LG07cmV0dXJuIHA9aSphK3MqZitvKmwrdSpjLHA8MCYmKHA9LXAsYT0tYSxmPS1mLGw9LWwsYz0tYyksMS1wPjFlLTY/KGg9TWF0aC5hY29zKHApLGQ9TWF0aC5zaW4oaCksdj1NYXRoLnNpbigoMS1yKSpoKS9kLG09TWF0aC5zaW4ocipoKS9kKToodj0xLXIsbT1yKSxlWzBdPXYqaSttKmEsZVsxXT12KnMrbSpmLGVbMl09dipvK20qbCxlWzNdPXYqdSttKmMsZX0saC5pbnZlcnQ9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLHI9dFsxXSxpPXRbMl0scz10WzNdLG89bipuK3IqcitpKmkrcypzLHU9bz8xL286MDtyZXR1cm4gZVswXT0tbip1LGVbMV09LXIqdSxlWzJdPS1pKnUsZVszXT1zKnUsZX0saC5jb25qdWdhdGU9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXT0tdFswXSxlWzFdPS10WzFdLGVbMl09LXRbMl0sZVszXT10WzNdLGV9LGgubGVuZ3RoPXUubGVuZ3RoLGgubGVuPWgubGVuZ3RoLGguc3F1YXJlZExlbmd0aD11LnNxdWFyZWRMZW5ndGgsaC5zcXJMZW49aC5zcXVhcmVkTGVuZ3RoLGgubm9ybWFsaXplPXUubm9ybWFsaXplLGguZnJvbU1hdDM9ZnVuY3Rpb24oKXt2YXIgZT10eXBlb2YgSW50OEFycmF5IT1cInVuZGVmaW5lZFwiP25ldyBJbnQ4QXJyYXkoWzEsMiwwXSk6WzEsMiwwXTtyZXR1cm4gZnVuY3Rpb24odCxuKXt2YXIgcj1uWzBdK25bNF0rbls4XSxpO2lmKHI+MClpPU1hdGguc3FydChyKzEpLHRbM109LjUqaSxpPS41L2ksdFswXT0obls3XS1uWzVdKSppLHRbMV09KG5bMl0tbls2XSkqaSx0WzJdPShuWzNdLW5bMV0pKmk7ZWxzZXt2YXIgcz0wO25bNF0+blswXSYmKHM9MSksbls4XT5uW3MqMytzXSYmKHM9Mik7dmFyIG89ZVtzXSx1PWVbb107aT1NYXRoLnNxcnQobltzKjMrc10tbltvKjMrb10tblt1KjMrdV0rMSksdFtzXT0uNSppLGk9LjUvaSx0WzNdPShuW3UqMytvXS1uW28qMyt1XSkqaSx0W29dPShuW28qMytzXStuW3MqMytvXSkqaSx0W3VdPShuW3UqMytzXStuW3MqMyt1XSkqaX1yZXR1cm4gdH19KCksaC5zdHI9ZnVuY3Rpb24oZSl7cmV0dXJuXCJxdWF0KFwiK2VbMF0rXCIsIFwiK2VbMV0rXCIsIFwiK2VbMl0rXCIsIFwiK2VbM10rXCIpXCJ9LHR5cGVvZiBlIT1cInVuZGVmaW5lZFwiJiYoZS5xdWF0PWgpfSh0LmV4cG9ydHMpfSkodGhpcyk7XG4iLCIvKlxuXHRnbFNoYWRlclxuXHRDb3B5cmlnaHQgKGMpIDIwMTMsIE5lcnZvdXMgU3lzdGVtLCBpbmMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG5cdFxuXHRSZWRpc3RyaWJ1dGlvbiBhbmQgdXNlIGluIHNvdXJjZSBhbmQgYmluYXJ5IGZvcm1zLCB3aXRoIG9yIHdpdGhvdXQgbW9kaWZpY2F0aW9uLFxuYXJlIHBlcm1pdHRlZCBwcm92aWRlZCB0aGF0IHRoZSBmb2xsb3dpbmcgY29uZGl0aW9ucyBhcmUgbWV0OlxuXG4gICogUmVkaXN0cmlidXRpb25zIG9mIHNvdXJjZSBjb2RlIG11c3QgcmV0YWluIHRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlLCB0aGlzXG4gICAgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIuXG4gICogUmVkaXN0cmlidXRpb25zIGluIGJpbmFyeSBmb3JtIG11c3QgcmVwcm9kdWNlIHRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlLFxuICAgIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIgaW4gdGhlIGRvY3VtZW50YXRpb24gXG4gICAgYW5kL29yIG90aGVyIG1hdGVyaWFscyBwcm92aWRlZCB3aXRoIHRoZSBkaXN0cmlidXRpb24uXG5cblRISVMgU09GVFdBUkUgSVMgUFJPVklERUQgQlkgVEhFIENPUFlSSUdIVCBIT0xERVJTIEFORCBDT05UUklCVVRPUlMgXCJBUyBJU1wiIEFORFxuQU5ZIEVYUFJFU1MgT1IgSU1QTElFRCBXQVJSQU5USUVTLCBJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgVEhFIElNUExJRURcbldBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZIEFORCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBUkUgXG5ESVNDTEFJTUVELiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQ09QWVJJR0hUIEhPTERFUiBPUiBDT05UUklCVVRPUlMgQkUgTElBQkxFIEZPUlxuQU5ZIERJUkVDVCwgSU5ESVJFQ1QsIElOQ0lERU5UQUwsIFNQRUNJQUwsIEVYRU1QTEFSWSwgT1IgQ09OU0VRVUVOVElBTCBEQU1BR0VTXG4oSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFBST0NVUkVNRU5UIE9GIFNVQlNUSVRVVEUgR09PRFMgT1IgU0VSVklDRVM7XG5MT1NTIE9GIFVTRSwgREFUQSwgT1IgUFJPRklUUzsgT1IgQlVTSU5FU1MgSU5URVJSVVBUSU9OKSBIT1dFVkVSIENBVVNFRCBBTkQgT05cbkFOWSBUSEVPUlkgT0YgTElBQklMSVRZLCBXSEVUSEVSIElOIENPTlRSQUNULCBTVFJJQ1QgTElBQklMSVRZLCBPUiBUT1JUXG4oSU5DTFVESU5HIE5FR0xJR0VOQ0UgT1IgT1RIRVJXSVNFKSBBUklTSU5HIElOIEFOWSBXQVkgT1VUIE9GIFRIRSBVU0UgT0YgVEhJU1xuU09GVFdBUkUsIEVWRU4gSUYgQURWSVNFRCBPRiBUSEUgUE9TU0lCSUxJVFkgT0YgU1VDSCBEQU1BR0UuXG5cblx0dXNlcyBzb21lIGlkZWFzIChhbmQgY29kZSkgZnJvbSBnbC1zaGFkZXIgaHR0cHM6Ly9naXRodWIuY29tL21pa29sYWx5c2Vua28vZ2wtc2hhZGVyXG5cdGhvd2V2ZXIgc29tZSBkaWZmZXJlbmNlcyBpbmNsdWRlIHNhdmluZyB1bmlmb3JtIGxvY2F0aW9ucyBhbmQgcXVlcnlpbmcgZ2wgdG8gZ2V0IHVuaWZvcm1zIGFuZCBhdHRyaWJzIGluc3RlYWQgb2YgcGFyc2luZyBmaWxlcyBhbmQgdXNlcyBub3JtYWwgc3ludGF4IGluc3RlYWQgb2YgZmFrZSBvcGVyYXRvciBvdmVybG9hZGluZyB3aGljaCBpcyBhIGNvbmZ1c2luZyBwYXR0ZXJuIGluIEphdmFzY3JpcHQuXG4qL1xuXG4oZnVuY3Rpb24oX2dsb2JhbCkge1xuICBcInVzZSBzdHJpY3RcIjtcblxuICB2YXIgc2hpbSA9IHt9O1xuICBpZiAodHlwZW9mKGV4cG9ydHMpID09PSAndW5kZWZpbmVkJykge1xuICAgIGlmKHR5cGVvZiBkZWZpbmUgPT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PSAnb2JqZWN0JyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgICBzaGltLmV4cG9ydHMgPSB7fTtcbiAgICAgIGRlZmluZShmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHNoaW0uZXhwb3J0cztcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvL3RoaXMgdGhpbmcgbGl2ZXMgaW4gYSBicm93c2VyLCBkZWZpbmUgaXRzIG5hbWVzcGFjZXMgaW4gZ2xvYmFsXG4gICAgICBzaGltLmV4cG9ydHMgPSB0eXBlb2Yod2luZG93KSAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cgOiBfZ2xvYmFsO1xuICAgIH1cbiAgfVxuICBlbHNlIHtcbiAgICAvL3RoaXMgdGhpbmcgbGl2ZXMgaW4gY29tbW9uanMsIGRlZmluZSBpdHMgbmFtZXNwYWNlcyBpbiBleHBvcnRzXG4gICAgc2hpbS5leHBvcnRzID0gZXhwb3J0cztcbiAgfVxuICAoZnVuY3Rpb24oZXhwb3J0cykge1xuXG5cbiAgdmFyIGdsO1xuICBmdW5jdGlvbiBTaGFkZXIoZ2wsIHByb2cpIHtcbiAgICB0aGlzLmdsID0gZ2w7XG4gICAgdGhpcy5wcm9ncmFtID0gcHJvZztcbiAgICB0aGlzLnVuaWZvcm1zID0ge307XG4gICAgdGhpcy5hdHRyaWJzID0ge307XG4gICAgdGhpcy5pc1JlYWR5ID0gZmFsc2U7XG4gIH1cblxuICBTaGFkZXIucHJvdG90eXBlLmJlZ2luID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5nbC51c2VQcm9ncmFtKHRoaXMucHJvZ3JhbSk7XG4gICAgdGhpcy5lbmFibGVBdHRyaWJzKCk7XG4gIH1cblxuICBTaGFkZXIucHJvdG90eXBlLmVuZCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuZGlzYWJsZUF0dHJpYnMoKTtcbiAgfVxuXG4gIFNoYWRlci5wcm90b3R5cGUuZW5hYmxlQXR0cmlicyA9IGZ1bmN0aW9uKCkge1xuICAgIGZvcih2YXIgYXR0cmliIGluIHRoaXMuYXR0cmlicykge1xuICAgIHRoaXMuYXR0cmlic1thdHRyaWJdLmVuYWJsZSgpO1xuICAgIH1cbiAgfVxuICBTaGFkZXIucHJvdG90eXBlLmRpc2FibGVBdHRyaWJzID0gZnVuY3Rpb24oKSB7XG4gICAgZm9yKHZhciBhdHRyaWIgaW4gdGhpcy5hdHRyaWJzKSB7XG4gICAgdGhpcy5hdHRyaWJzW2F0dHJpYl0uZGlzYWJsZSgpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG1ha2VWZWN0b3JVbmlmb3JtKGdsLCBzaGFkZXIsIGxvY2F0aW9uLCBvYmosIHR5cGUsIGQsIG5hbWUpIHtcbiAgICB2YXIgdW5pZm9ybU9iaiA9IHt9O1xuICAgIHVuaWZvcm1PYmoubG9jYXRpb24gPSBsb2NhdGlvbjtcbiAgICBpZihkID4gMSkge1xuICAgICAgdHlwZSArPSBcInZcIjtcbiAgICB9XG4gICAgdmFyIHNldHRlciA9IG5ldyBGdW5jdGlvbihcImdsXCIsIFwicHJvZ1wiLCBcImxvY1wiLCBcInZcIiwgXCJnbC51bmlmb3JtXCIgKyBkICsgdHlwZSArIFwiKGxvYywgdilcIik7XG4gICAgdW5pZm9ybU9iai5zZXQgPSBzZXR0ZXIuYmluZCh1bmRlZmluZWQsIGdsLCBzaGFkZXIucHJvZ3JhbSxsb2NhdGlvbik7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgbmFtZSwge1xuICAgICAgdmFsdWU6dW5pZm9ybU9iaixcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG1ha2VNYXRyaXhVbmlmb3JtKGdsLCBzaGFkZXIsIGxvY2F0aW9uLCBvYmosIGQsIG5hbWUpIHtcbiAgICB2YXIgdW5pZm9ybU9iaiA9IHt9O1xuICAgIHVuaWZvcm1PYmoubG9jYXRpb24gPSBsb2NhdGlvbjtcbiAgICB2YXIgc2V0dGVyID0gbmV3IEZ1bmN0aW9uKFwiZ2xcIiwgXCJwcm9nXCIsIFwibG9jXCIsXCJ2XCIsIFwiZ2wudW5pZm9ybU1hdHJpeFwiICsgZCArIFwiZnYobG9jLCBmYWxzZSwgdilcIik7XG4gICAgdW5pZm9ybU9iai5zZXQgPSBzZXR0ZXIuYmluZCh1bmRlZmluZWQsIGdsLCBzaGFkZXIucHJvZ3JhbSxsb2NhdGlvbik7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgbmFtZSwge1xuICAgICAgdmFsdWU6dW5pZm9ybU9iaixcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG1ha2VWZWN0b3JBdHRyaWIoZ2wsIHNoYWRlciwgbG9jYXRpb24sIG9iaiwgZCwgbmFtZSkge1xuICAgIHZhciBvdXQgPSB7fTtcbiAgICBvdXQuc2V0ID0gZnVuY3Rpb24gc2V0QXR0cmliKGJ1ZmZlcix0eXBlKSB7XG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsYnVmZmVyKTtcbiAgICBnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKGxvY2F0aW9uLCBkLCB0eXBlfHxnbC5GTE9BVCwgZmFsc2UsIDAsIDApO1xuICAgIH1cbiAgICBvdXQucG9pbnRlciA9IGZ1bmN0aW9uIGF0dHJpYlBvaW50ZXIodHlwZSwgbm9ybWFsaXplZCwgc3RyaWRlLCBvZmZzZXQpIHtcbiAgICAgIGdsLnZlcnRleEF0dHJpYlBvaW50ZXIobG9jYXRpb24sIGQsIHR5cGV8fGdsLkZMT0FULCBub3JtYWxpemVkP3RydWU6ZmFsc2UsIHN0cmlkZXx8MCwgb2Zmc2V0fHwwKTtcbiAgICB9O1xuICAgIG91dC5lbmFibGUgPSBmdW5jdGlvbiBlbmFibGVBdHRyaWIoKSB7XG4gICAgICBnbC5lbmFibGVWZXJ0ZXhBdHRyaWJBcnJheShsb2NhdGlvbik7XG4gICAgfTtcbiAgICBvdXQuZGlzYWJsZSA9IGZ1bmN0aW9uIGRpc2FibGVBdHRyaWIoKSB7XG4gICAgICBnbC5kaXNhYmxlVmVydGV4QXR0cmliQXJyYXkobG9jYXRpb24pO1xuICAgIH07XG4gICAgb3V0LmxvY2F0aW9uID0gbG9jYXRpb247XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgbmFtZSwge1xuICAgIHZhbHVlOiBvdXQsXG4gICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gc2V0dXBVbmlmb3JtKGdsLHNoYWRlciwgdW5pZm9ybSxsb2MpIHtcbiAgICBzd2l0Y2godW5pZm9ybS50eXBlKSB7XG4gICAgICBjYXNlIGdsLklOVDpcbiAgICAgIGNhc2UgZ2wuQk9PTDpcbiAgICAgIGNhc2UgZ2wuU0FNUExFUl8yRDpcbiAgICAgIGNhc2UgZ2wuU0FNUExFUl9DVUJFOlxuICAgICAgICBtYWtlVmVjdG9yVW5pZm9ybShnbCxzaGFkZXIsbG9jLCBzaGFkZXIudW5pZm9ybXMsIFwiaVwiLDEsdW5pZm9ybS5uYW1lKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGdsLklOVF9WRUMyOlxuICAgICAgY2FzZSBnbC5CT09MX1ZFQzI6XG4gICAgICAgIG1ha2VWZWN0b3JVbmlmb3JtKGdsLHNoYWRlcixsb2MsIHNoYWRlci51bmlmb3JtcywgXCJpXCIsMix1bmlmb3JtLm5hbWUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgZ2wuSU5UX1ZFQzM6XG4gICAgICBjYXNlIGdsLkJPT0xfVkVDMzpcbiAgICAgICAgbWFrZVZlY3RvclVuaWZvcm0oZ2wsc2hhZGVyLGxvYywgc2hhZGVyLnVuaWZvcm1zLCBcImlcIiwzLHVuaWZvcm0ubmFtZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBnbC5JTlRfVkVDNDpcbiAgICAgIGNhc2UgZ2wuQk9PTF9WRUM0OlxuICAgICAgICBtYWtlVmVjdG9yVW5pZm9ybShnbCxzaGFkZXIsbG9jLCBzaGFkZXIudW5pZm9ybXMsIFwiaVwiLDQsdW5pZm9ybS5uYW1lKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGdsLkZMT0FUOlxuICAgICAgICBtYWtlVmVjdG9yVW5pZm9ybShnbCxzaGFkZXIsbG9jLCBzaGFkZXIudW5pZm9ybXMsIFwiZlwiLDEsdW5pZm9ybS5uYW1lKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGdsLkZMT0FUX1ZFQzI6XG4gICAgICAgIG1ha2VWZWN0b3JVbmlmb3JtKGdsLHNoYWRlcixsb2MsIHNoYWRlci51bmlmb3JtcywgXCJmXCIsMix1bmlmb3JtLm5hbWUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgZ2wuRkxPQVRfVkVDMzpcbiAgICAgICAgbWFrZVZlY3RvclVuaWZvcm0oZ2wsc2hhZGVyLGxvYywgc2hhZGVyLnVuaWZvcm1zLCBcImZcIiwzLHVuaWZvcm0ubmFtZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBnbC5GTE9BVF9WRUM0OlxuICAgICAgICBtYWtlVmVjdG9yVW5pZm9ybShnbCxzaGFkZXIsbG9jLCBzaGFkZXIudW5pZm9ybXMsIFwiZlwiLDQsdW5pZm9ybS5uYW1lKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGdsLkZMT0FUX01BVDI6XG4gICAgICAgIG1ha2VNYXRyaXhVbmlmb3JtKGdsLHNoYWRlcixsb2MsIHNoYWRlci51bmlmb3JtcywgMix1bmlmb3JtLm5hbWUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgZ2wuRkxPQVRfTUFUMzpcbiAgICAgICAgbWFrZU1hdHJpeFVuaWZvcm0oZ2wsc2hhZGVyLGxvYywgc2hhZGVyLnVuaWZvcm1zLCAzLHVuaWZvcm0ubmFtZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBnbC5GTE9BVF9NQVQ0OlxuICAgICAgICBtYWtlTWF0cml4VW5pZm9ybShnbCxzaGFkZXIsbG9jLCBzaGFkZXIudW5pZm9ybXMsIDQsdW5pZm9ybS5uYW1lKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIHVuaWZvcm0gdHlwZSBpbiBzaGFkZXI6IFwiICtzaGFkZXIpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBzZXR1cEF0dHJpYihnbCxzaGFkZXIsYXR0cmliLGxvY2F0aW9uKSB7XG4gICAgdmFyIGxlbiA9IDE7XG4gICAgc3dpdGNoKGF0dHJpYi50eXBlKSB7XG4gICAgICBjYXNlIGdsLkZMT0FUX1ZFQzI6XG4gICAgICAgIGxlbiA9IDI7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBnbC5GTE9BVF9WRUMzOlxuICAgICAgICBsZW4gPSAzO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgZ2wuRkxPQVRfVkVDNDpcbiAgICAgICAgbGVuID0gNDtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIG1ha2VWZWN0b3JBdHRyaWIoZ2wsIHNoYWRlciwgbG9jYXRpb24sc2hhZGVyLmF0dHJpYnMsIGxlbiwgYXR0cmliLm5hbWUpO1xuICB9XG5cblxuICBmdW5jdGlvbiBsb2FkWE1MRG9jKGZpbGVuYW1lLCBjYWxsYmFjaykge1xuICAgICAgdmFyIHhtbGh0dHA7XG4gICAgICB2YXIgdGV4dDtcbiAgICAgIHhtbGh0dHAgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblxuICAgICAgeG1saHR0cC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICBpZiAoeG1saHR0cC5yZWFkeVN0YXRlID09IDQgJiYgeG1saHR0cC5zdGF0dXMgPT0gMjAwKSBjYWxsYmFjayh4bWxodHRwLnJlc3BvbnNlVGV4dCk7XG4gICAgICB9XG5cbiAgICAgIHhtbGh0dHAub3BlbihcIkdFVFwiLCBmaWxlbmFtZSwgdHJ1ZSk7XG4gICAgICB4bWxodHRwLnNlbmQoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldFNoYWRlcihnbCwgc3JjLCB0eXBlKSB7XG4gICAgICB2YXIgc2hhZGVyO1xuICAgICAgLy9kZWNpZGVzIGlmIGl0J3MgYSBmcmFnbWVudCBvciB2ZXJ0ZXggc2hhZGVyXG5cbiAgICAgIGlmICh0eXBlID09IFwiZnJhZ21lbnRcIikge1xuICAgICAgICAgIHNoYWRlciA9IGdsLmNyZWF0ZVNoYWRlcihnbC5GUkFHTUVOVF9TSEFERVIpO1xuICAgICAgfVxuICAgICAgZWxzZSBpZiAodHlwZSA9PSBcInZlcnRleFwiKSB7XG4gICAgICAgICAgc2hhZGVyID0gZ2wuY3JlYXRlU2hhZGVyKGdsLlZFUlRFWF9TSEFERVIpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgICBnbC5zaGFkZXJTb3VyY2Uoc2hhZGVyLCBzcmMpO1xuICAgICAgZ2wuY29tcGlsZVNoYWRlcihzaGFkZXIpO1xuXG4gICAgICBpZiAoIWdsLmdldFNoYWRlclBhcmFtZXRlcihzaGFkZXIsIGdsLkNPTVBJTEVfU1RBVFVTKSkge1xuICAgICAgICAgIGFsZXJ0KGdsLmdldFNoYWRlckluZm9Mb2coc2hhZGVyKSk7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgICByZXR1cm4gc2hhZGVyO1xuICB9XG5cbiAgZnVuY3Rpb24gc2V0dXBTaGFkZXJQcm9ncmFtKGdsLHNoYWRlclByb2dyYW0sIHZlcnRleFNoYWRlciwgZnJhZ21lbnRTaGFkZXIsY2FsbGJhY2spIHtcbiAgICAgIGdsLmF0dGFjaFNoYWRlcihzaGFkZXJQcm9ncmFtLCB2ZXJ0ZXhTaGFkZXIpO1xuICAgICAgZ2wuYXR0YWNoU2hhZGVyKHNoYWRlclByb2dyYW0sIGZyYWdtZW50U2hhZGVyKTtcbiAgICAgIGdsLmxpbmtQcm9ncmFtKHNoYWRlclByb2dyYW0pO1xuXG4gICAgICBpZiAoIWdsLmdldFByb2dyYW1QYXJhbWV0ZXIoc2hhZGVyUHJvZ3JhbSwgZ2wuTElOS19TVEFUVVMpKSB7XG4gICAgICAgICAgYWxlcnQoXCJDb3VsZCBub3QgaW5pdGlhbGlzZSBzaGFkZXJzXCIpO1xuICAgICAgfVxuICAgICAgY2FsbGJhY2soc2hhZGVyUHJvZ3JhbSk7XG4gIH1cblxuICB2YXIgZ2xTaGFkZXIgPSBleHBvcnRzO1xuICBcbiAgZ2xTaGFkZXIuc2V0R0wgPSBmdW5jdGlvbihfZ2wpIHtcbiAgICBnbCA9IF9nbDtcbiAgfVxuICBcbiAgZ2xTaGFkZXIubWFrZVNoYWRlciA9IGZ1bmN0aW9uKGdsLHByb2dyYW0sc2hhZGVyKSB7XG4gICAgdmFyIHRvdGFsVW5pZm9ybXMgPSBnbC5nZXRQcm9ncmFtUGFyYW1ldGVyKHByb2dyYW0sIGdsLkFDVElWRV9VTklGT1JNUyk7XG4gICAgc2hhZGVyID0gc2hhZGVyIHx8IG5ldyBTaGFkZXIoZ2wscHJvZ3JhbSk7XG4gICAgZm9yKHZhciBpPTA7aTx0b3RhbFVuaWZvcm1zOysraSkge1xuICAgICAgdmFyIHVuaWZvcm0gPSBnbC5nZXRBY3RpdmVVbmlmb3JtKHByb2dyYW0sIGkpO1xuICAgICAgc2V0dXBVbmlmb3JtKGdsLHNoYWRlciwgdW5pZm9ybSxnbC5nZXRVbmlmb3JtTG9jYXRpb24ocHJvZ3JhbSwgdW5pZm9ybS5uYW1lKSk7XG4gICAgfVxuICAgIHZhciB0b3RhbEF0dHJpYnMgPSBnbC5nZXRQcm9ncmFtUGFyYW1ldGVyKHByb2dyYW0sZ2wuQUNUSVZFX0FUVFJJQlVURVMpO1xuICAgIGZvcih2YXIgaT0wO2k8dG90YWxBdHRyaWJzOysraSkge1xuICAgICAgdmFyIGF0dHJpYiA9IGdsLmdldEFjdGl2ZUF0dHJpYihwcm9ncmFtLCBpKTtcbiAgICAgIHNldHVwQXR0cmliKGdsLHNoYWRlcixhdHRyaWIsaSk7XG4gICAgfVxuICAgIHNoYWRlci5pc1JlYWR5ID0gdHJ1ZTtcbiAgICByZXR1cm4gc2hhZGVyO1xuICB9XG5cbiAgZ2xTaGFkZXIubG9hZFNoYWRlciA9IGZ1bmN0aW9uKGdsLCB2ZXJ0ZXhGaWxlLCBmcmFnbWVudEZpbGUpIHtcbiAgICAgIHZhciBzaGFkZXJQcm9ncmFtID0gZ2wuY3JlYXRlUHJvZ3JhbSgpO1xuICAgIHZhciBzaGFkZXIgPSBuZXcgU2hhZGVyKGdsLHNoYWRlclByb2dyYW0pO1xuICAgICAgdmFyIGZyYWdTaGFkZXIsIHZlcnRTaGFkZXI7XG4gICAgICB2YXIgbG9hZGVkID0gMDtcbiAgICAgIHZhciB4bWxodHRwO1xuICAgICAgeG1saHR0cCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgbG9hZFhNTERvYyh2ZXJ0ZXhGaWxlLCBmdW5jdGlvbih0eHQpIHt2ZXJ0U2hhZGVyID0gZ2V0U2hhZGVyKGdsLCB0eHQsIFwidmVydGV4XCIpO2lmKCsrbG9hZGVkID09IDIpIHNldHVwU2hhZGVyUHJvZ3JhbShnbCxzaGFkZXJQcm9ncmFtLCB2ZXJ0U2hhZGVyLGZyYWdTaGFkZXIsZnVuY3Rpb24ocHJvZykge2dsU2hhZGVyLm1ha2VTaGFkZXIoZ2wscHJvZyxzaGFkZXIpO30pfSk7XG4gICAgICBsb2FkWE1MRG9jKGZyYWdtZW50RmlsZSwgZnVuY3Rpb24odHh0KSB7ZnJhZ1NoYWRlciA9IGdldFNoYWRlcihnbCwgdHh0LCBcImZyYWdtZW50XCIpO2lmKCsrbG9hZGVkID09IDIpIHNldHVwU2hhZGVyUHJvZ3JhbShnbCxzaGFkZXJQcm9ncmFtLCB2ZXJ0U2hhZGVyLGZyYWdTaGFkZXIsZnVuY3Rpb24ocHJvZykge2dsU2hhZGVyLm1ha2VTaGFkZXIoZ2wscHJvZyxzaGFkZXIpO30pfSk7XG4gICAgICByZXR1cm4gc2hhZGVyO1xuICB9XG5cbiAgLy9pZih0eXBlb2YoZXhwb3J0cykgIT09ICd1bmRlZmluZWQnKSB7XG4gIC8vICAgIGV4cG9ydHMuZ2xTaGFkZXIgPSBnbFNoYWRlcjtcbiAgLy99XG5cbiAgfSkoc2hpbS5leHBvcnRzKTtcbn0pKHRoaXMpO1xuIiwidmFyIGdsTWF0cml4ID0gcmVxdWlyZSgnLi4vanMvZ2wtbWF0cml4LW1pbi5qcycpO1xudmFyIHZlYzMgPSBnbE1hdHJpeC52ZWMzO1xuXG52YXIgSEVNRVNIX05VTExGQUNFID0gbnVsbDtcblxudmFyIGhlbWVzaCA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLnZlcnRpY2VzID0gW107XG4gIHRoaXMuZWRnZXMgPSBbXTtcbiAgdGhpcy5mYWNlcyA9IFtdO1xufVxuXG52YXIgaGVkZ2UgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5mYWNlID0gSEVNRVNIX05VTExGQUNFO1xuICB0aGlzLm5leHQgPSBudWxsO1xuICB0aGlzLnBhaXIgPSBudWxsO1xuICB0aGlzLnYgPSBudWxsO1xuICB0aGlzLmluZGV4ID0gMDtcbiAgdGhpcy5pbmZvID0ge307XG59XG5cbnZhciBoZWZhY2UgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5lID0gbnVsbDtcbiAgdGhpcy5pbmRleCA9IDA7XG4gIHRoaXMuaW5mbyA9IHt9O1xufVxuXG52YXIgaGV2ZXJ0ZXggPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5lID0gbnVsbDtcbiAgdGhpcy5wb3MgPSB2ZWMzLmNyZWF0ZSgpO1xuICB0aGlzLmluZGV4ID0gMDtcbiAgdGhpcy5iID0gMDtcbiAgdGhpcy50YWdnZWQgPSAwO1xuICB0aGlzLmluZm8gPSB7fTtcbn1cblxuaGVtZXNoLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uKCkge1xuICB2YXIgZSx2LGY7XG4gIGZvcih2YXIgaT0wLGw9dGhpcy5lZGdlcy5sZW5ndGg7aTxsOysraSkge1xuICAgIGUgPSB0aGlzLmVkZ2VzW2ldO1xuICAgIGUubmV4dCA9IG51bGw7XG4gICAgZS5wYWlyID0gbnVsbDtcbiAgICBlLnYgPSBudWxsO1xuICAgIGUuZmFjZSA9IG51bGw7XG4gIH1cbiAgZm9yKHZhciBpPTAsbD10aGlzLmZhY2VzLmxlbmd0aDtpPGw7KytpKSB7XG4gICAgZiA9IHRoaXMuZmFjZXNbaV07XG4gICAgZi5lID0gbnVsbDtcbiAgICBcbiAgfVxuICBmb3IodmFyIGk9MCxsPXRoaXMudmVydGljZXMubGVuZ3RoO2k8bDsrK2kpIHtcbiAgICB2ID0gdGhpcy52ZXJ0aWNlc1tpXTtcbiAgICB2LmUgPSBudWxsO1xuICB9XG4gIHRoaXMuZmFjZXMubGVuZ3RoID0gMDtcbiAgdGhpcy5lZGdlcy5sZW5ndGggPSAwO1xuICB0aGlzLnZlcnRpY2VzLmxlbmd0aCA9IDA7XG59XG5cbmhlbWVzaC5wcm90b3R5cGUuYWRkRWRnZSA9IGZ1bmN0aW9uKCkge1xuICB2YXIgbmV3RWRnZSA9IG5ldyBoZWRnZSgpO1xuICBuZXdFZGdlLmluZGV4ID0gdGhpcy5lZGdlcy5sZW5ndGg7XG4gIHRoaXMuZWRnZXMucHVzaChuZXdFZGdlKTtcbiAgcmV0dXJuIG5ld0VkZ2U7XG59XG5cbmhlbWVzaC5wcm90b3R5cGUuYWRkVmVydGV4ID0gZnVuY3Rpb24ocG9zKSB7XG4gIHZhciBuZXdWZXJ0ZXggPSBuZXcgaGV2ZXJ0ZXgoKTtcbiAgdmVjMy5jb3B5KG5ld1ZlcnRleC5wb3MscG9zKTtcbiAgbmV3VmVydGV4LmluZGV4ID0gdGhpcy52ZXJ0aWNlcy5sZW5ndGg7XG4gIHRoaXMudmVydGljZXMucHVzaChuZXdWZXJ0ZXgpO1xuICByZXR1cm4gbmV3VmVydGV4O1xufVxuXG5oZW1lc2gucHJvdG90eXBlLmFkZEZhY2UgPSBmdW5jdGlvbigpIHtcbiAgdmFyIG5ld0ZhY2UgPSBuZXcgaGVmYWNlKCk7XG4gIG5ld0ZhY2UuaW5kZXggPSB0aGlzLmZhY2VzLmxlbmd0aDtcbiAgdGhpcy5mYWNlcy5wdXNoKG5ld0ZhY2UpO1xuICByZXR1cm4gbmV3RmFjZTtcbn1cblxuaGVtZXNoLnByb3RvdHlwZS5yZW1vdmVFZGdlID0gZnVuY3Rpb24oZSkge1xuICBlLm5leHQgPSBudWxsO1xuICBlLnBhaXIgPSBudWxsO1xuICBlLmZhY2UgPSBudWxsO1xuICBlLnYgPSBudWxsO1xuICBpZihlLmluZGV4ID09IHRoaXMuZWRnZXMubGVuZ3RoLTEpIHtcbiAgICB0aGlzLmVkZ2VzLnBvcCgpO1xuICB9IGVsc2UgaWYoZS5pbmRleCA+PSB0aGlzLmVkZ2VzLmxlbmd0aCkge1xuICAgIFxuICB9IGVsc2Uge1xuICAgIHZhciB0ZW1wID0gdGhpcy5lZGdlcy5wb3AoKTtcbiAgICB0ZW1wLmluZGV4ID0gZS5pbmRleDtcbiAgICB0aGlzLmVkZ2VzW2UuaW5kZXhdID0gdGVtcDtcbiAgfVxufVxuXG5oZW1lc2gucHJvdG90eXBlLnJlbW92ZUZhY2UgPSBmdW5jdGlvbihmKSB7XG4gIGYuZSA9IG51bGw7XG4gIGlmKGYuaW5kZXggPT0gdGhpcy5mYWNlcy5sZW5ndGgtMSkge1xuICAgIHRoaXMuZmFjZXMucG9wKCk7XG4gIH0gZWxzZSBpZiAoZi5pbmRleCA+PSB0aGlzLmZhY2VzLmxlbmd0aCkge1xuICAgIFxuICB9ZWxzZSB7XG4gICAgdmFyIHRlbXAgPSB0aGlzLmZhY2VzLnBvcCgpO1xuICAgIHRlbXAuaW5kZXggPSBmLmluZGV4O1xuICAgIHRoaXMuZmFjZXNbZi5pbmRleF0gPSB0ZW1wO1xuICB9XG59XG5cbmhlbWVzaC5wcm90b3R5cGUucmVtb3ZlVmVydGV4ID0gZnVuY3Rpb24odikge1xuICB2LmUgPSBudWxsO1xuICBpZih2LmluZGV4ID09IHRoaXMudmVydGljZXMubGVuZ3RoLTEpIHtcbiAgICB0aGlzLnZlcnRpY2VzLnBvcCgpO1xuICB9IGVsc2UgaWYodi5pbmRleCA+PSB0aGlzLnZlcnRpY2VzLmxlbmd0aCkge1xuICAgIFxuICB9IGVsc2Uge1xuICAgIHZhciB0ZW1wID0gdGhpcy52ZXJ0aWNlcy5wb3AoKTtcbiAgICB0ZW1wLmluZGV4ID0gdi5pbmRleDtcbiAgICB0aGlzLnZlcnRpY2VzW3YuaW5kZXhdID0gdGVtcDtcbiAgfVxufVxuXG5oZW1lc2gucHJvdG90eXBlLmlzQm91bmRhcnkgPSBmdW5jdGlvbihlKSB7XG4gIHJldHVybiAoZS5mYWNlID09IEhFTUVTSF9OVUxMRkFDRSB8fCBlLnBhaXIuZmFjZSA9PSBIRU1FU0hfTlVMTEZBQ0UpO1xufVxuXG5oZW1lc2gucHJvdG90eXBlLmlzQ29sbGFwc2FibGUgPSBmdW5jdGlvbihlKSB7XG4gIC8vc2hvdWxkIEkgdGVzdCBpZiB0aGUgZWRnZXMsdmVydGljZXMsIG9yIGZhY2VzIGhhdmUgYmVlbiBkZWxldGVkIHlldD9cbiAgdmFyIGVwYWlyID0gZS5wYWlyO1xuICB2YXIgcDEgPSBlLnY7XG4gIHZhciBwMiA9IGVwYWlyLnY7XG4gIFxuICAvL2dldCBvcHBvc2l0ZSBwb2ludHMsIGlmIGJvdW5kYXJ5IGVkZ2Ugb3Bwb3NpdGUgaXMgbnVsbFxuICB2YXIgb3BwMSA9IGUuZmFjZSA9PSBIRU1FU0hfTlVMTEZBQ0UgPyBudWxsIDogZS5uZXh0LnY7XG4gIHZhciBvcHAyID0gZXBhaXIuZmFjZSA9PSBIRU1FU0hfTlVMTEZBQ0UgPyBudWxsIDogZXBhaXIubmV4dC52O1xuICBcbiAgLy9pZiBlbmQgcG9pbnRzIGFyZSBvbiB0aGUgYm91bmRhcnkgYnV0IHRoZSBlZGdlIGlzIG5vdFxuICBpZihwMS5iICYmIHAyLmIgJiYgZS5mYWNlICE9IEhFTUVTSF9OVUxMRkFDRSAmJiBlcGFpci5mYWNlICE9IEhFTUVTSF9OVUxMRkFDRSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBcbiAgaWYob3BwMSA9PSBvcHAyKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIC8vbWlnaHQgbmVlZCBhIGNoZWNrIHRvIHNlZSBpZiBvcHBvc2l0ZSBlZGdlcyBhcmUgYm90aCBib3VuZGFyeSBidXQgdGhhdCBzZWVtcyBjb3ZlcmVkIGJ5IHRoZSBwcmV2aW91cyBjaGVja1xuICBcbiAgXG4gIC8vdGVzdCB0byBzZWUgaWYgZW5kIHBvaW50cyBzaGFyZSBhbnkgbmVpZ2hib3JzIGJlc2lkZSBvcHAxIGFuZCBvcHAyXG4gIC8vbWFyayBhbGwgbmVpZ2hib3JzIG9mIHAxIGFzIDBcbiAgdmFyIGN1cnJFID0gZTtcbiAgZG8ge1xuICAgIGN1cnJFID0gY3VyckUubmV4dDtcbiAgICBjdXJyRS52LnRhZ2dlZCA9IDA7XG4gICAgY3VyckUgPSBjdXJyRS5wYWlyO1xuICB9IHdoaWxlKGN1cnJFICE9IGUpO1xuICAvL21hcmsgYWxsIG5laWdoYm9ycyBvZiBwMiBhcyAxXG4gIGN1cnJFID0gZXBhaXI7XG4gIGRvIHtcbiAgICBjdXJyRSA9IGN1cnJFLm5leHQ7XG4gICAgY3VyckUudi50YWdnZWQgPSAxO1xuICAgIGN1cnJFID0gY3VyckUucGFpcjtcbiAgfSB3aGlsZShjdXJyRSAhPSBlcGFpcik7XG4gIC8vdW50YWcgb3Bwb3NpdGVcbiAgaWYob3BwMSAhPSBudWxsKSB7b3BwMS50YWdnZWQgPSAwO31cbiAgaWYob3BwMiAhPSBudWxsKSB7b3BwMi50YWdnZWQgPSAwO31cbiAgXG4gIC8vY2hlY2sgbmVpZ2hib3JzIG9mIHAxLCBpZiBhbnkgYXJlIG1hcmtlZCBhcyAxIHJldHVybiBmYWxzZVxuICBjdXJyRSA9IGU7XG4gIGRvIHtcbiAgICBjdXJyRSA9IGN1cnJFLm5leHQ7XG4gICAgaWYoY3VyckUudi50YWdnZWQgPT0gMSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBjdXJyRSA9IGN1cnJFLnBhaXI7XG4gIH0gd2hpbGUoY3VyckUgIT0gZSk7XG4gICBcbiAgLy90ZXN0IGZvciBhIGZhY2Ugb24gdGhlIGJhY2tzaWRlL290aGVyIHNpZGUgdGhhdCBtaWdodCBkZWdlbmVyYXRlXG4gIGlmKGUuZmFjZSAhPSBIRU1FU0hfTlVMTEZBQ0UpIHtcbiAgICB2YXIgZW5leHQsIGVuZXh0MjtcbiAgICBlbmV4dCA9IGUubmV4dDtcbiAgICBlbmV4dDIgPSBlbmV4dC5uZXh0O1xuICAgIFxuICAgIGVuZXh0ID0gZW5leHQucGFpcjtcbiAgICBlbmV4dDIgPSBlbmV4dDIucGFpcjtcbiAgICBpZihlbmV4dC5mYWNlID09IGVuZXh0Mi5mYWNlKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIGlmKGVwYWlyLmZhY2UgIT0gSEVNRVNIX05VTExGQUNFKSB7XG4gICAgdmFyIGVuZXh0LCBlbmV4dDI7XG4gICAgZW5leHQgPSBlcGFpci5uZXh0O1xuICAgIGVuZXh0MiA9IGVuZXh0Lm5leHQ7XG4gICAgXG4gICAgZW5leHQgPSBlbmV4dC5wYWlyO1xuICAgIGVuZXh0MiA9IGVuZXh0Mi5wYWlyO1xuICAgIGlmKGVuZXh0LmZhY2UgPT0gZW5leHQyLmZhY2UpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgXG4gIHJldHVybiB0cnVlO1xuICAvKlxuICBpZiAodjB2MV90cmlhbmdsZSlcbiAge1xuICAgIEhhbGZlZGdlSGFuZGxlIG9uZSwgdHdvO1xuICAgIG9uZSA9IG5leHRfaGFsZmVkZ2VfaGFuZGxlKHYwdjEpO1xuICAgIHR3byA9IG5leHRfaGFsZmVkZ2VfaGFuZGxlKG9uZSk7XG4gICAgXG4gICAgb25lID0gb3Bwb3NpdGVfaGFsZmVkZ2VfaGFuZGxlKG9uZSk7XG4gICAgdHdvID0gb3Bwb3NpdGVfaGFsZmVkZ2VfaGFuZGxlKHR3byk7XG4gICAgXG4gICAgaWYgKGZhY2VfaGFuZGxlKG9uZSkgPT0gZmFjZV9oYW5kbGUodHdvKSAmJiB2YWxlbmNlKGZhY2VfaGFuZGxlKG9uZSkpICE9IDMpXG4gICAge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgXG4gICovXG4gIFxufVxuXG5oZW1lc2gucHJvdG90eXBlLmVkZ2VDb2xsYXBzZSA9IGZ1bmN0aW9uKGUpIHtcbiAgaWYoIXRoaXMuaXNDb2xsYXBzYWJsZShlKSkgcmV0dXJuO1xuICBcbiAgdmFyIGVwYWlyID0gZS5wYWlyO1xuICB2YXIgZW5leHQsIGVuZXh0MiwgZW5leHRwLCBlbmV4dHAyO1xuICB2YXIgcDEgPSBlLnY7XG4gIHZhciBwMiA9IGVwYWlyLnY7XG4gIHAyLmUgPSBudWxsO1xuICAvL25lZWQgdG8gY2hlY2sgZm9yIGVkZ2UgdmVydGljZXMgZWl0aGVyIHRocm91Z2ggbWFya2luZyBvciBjaGVja2luZyBlZGdlc1xuICBpZihwMS5iKSB7XG4gICAgaWYoIXAyLmIpIHtcbiAgICBcbiAgICB9IGVsc2UgeyAgICBcbiAgICAgIHZlYzMuYWRkKHAxLnBvcyxwMS5wb3MscDIucG9zKTtcbiAgICAgIHZlYzMuc2NhbGUocDEucG9zLHAxLnBvcywwLjUpO1xuICAgICAgcDEuYiA9IHAyLmI7XG4gICAgfVxuICB9IGVsc2UgaWYocDIuYikge1xuICAgIHZlYzMuY29weShwMS5wb3MscDIucG9zKTtcbiAgICBwMS5iID0gcDIuYjtcbiAgfSBlbHNlIHtcbiAgICB2ZWMzLmFkZChwMS5wb3MscDEucG9zLHAyLnBvcyk7XG4gICAgdmVjMy5zY2FsZShwMS5wb3MscDEucG9zLDAuNSk7XG4gIH1cbiAgLy9yZW1vdmUgcDJcbiAgdmFyIHN0YXJ0RSA9IGVwYWlyO1xuICAvL3NsaWdodCBpbmVmZmljaWVuY3ksIG5vIG5lZWQgdG8gcmVwb2ludCBlZGdlcyB0aGF0IGFyZSBhYm91dCB0byBiZSByZW1vdmVkXG4gIGVuZXh0ID0gZXBhaXI7XG4gIGRvIHtcbiAgICBlbmV4dC52ID0gcDE7XG4gICAgZW5leHQgPSBlbmV4dC5uZXh0LnBhaXI7XG4gIH0gd2hpbGUoZW5leHQgIT0gc3RhcnRFKTtcblxuICB0aGlzLnJlbW92ZVZlcnRleChwMik7XG4gIFxuICB2YXIgcHJldkUsIHByZXZFUDtcbiAgaWYoZS5mYWNlID09IG51bGwpIHtcbiAgICB2YXIgY3VyckUgPSBlcGFpcjtcbiAgICB3aGlsZShjdXJyRS5uZXh0ICE9IGUpIHtcbiAgICAgIGN1cnJFID0gY3VyckUubmV4dC5wYWlyO1xuICAgIH1cbiAgICBwcmV2RSA9IGN1cnJFO1xuICB9XG4gIGlmKGVwYWlyLmZhY2UgPT0gbnVsbCkge1xuICAgIHZhciBjdXJyRSA9IGU7XG4gICAgd2hpbGUoY3VyckUubmV4dCAhPSBlcGFpcikge1xuICAgICAgY3VyckUgPSBjdXJyRS5uZXh0LnBhaXI7XG4gICAgfVxuICAgIHByZXZFUCA9IGN1cnJFO1xuICB9XG4gIC8vcmVtb3ZlIGZhY2VcbiAgaWYoZS5mYWNlICE9IG51bGwpIHtcbiAgICBlbmV4dCA9IGUubmV4dDtcbiAgICBlbmV4dDIgPSBlbmV4dC5uZXh0O1xuICAgIFxuICAgIC8vcmVtb3ZlIGVuZXh0IGFuZCBlbmV4dDI7XG4gICAgZW5leHRwID0gZW5leHQucGFpcjtcbiAgICBlbmV4dHAyID0gZW5leHQyLnBhaXI7XG4gICAgXG4gICAgLypcbiAgICBpZihlbmV4dHAuZmFjZSA9PSBudWxsICYmIGVuZXh0cDIuZmFjZSA9PSBudWxsKSB7XG4gICAgICAvL3BpbmNoZWQgb2ZmLCByZW1vdmUgZW5leHRwIGFuZCBlbmV4dHAyLCBjb25uZWN0IGFjcm9zc1xuICAgICAgdmFyIGN1cnJFID0gZW5leHQyO1xuICAgICAgd2hpbGUoY3VyckUubmV4dCAhPSBlbmV4dHAyKSB7XG4gICAgICAgIGN1cnJFID0gY3VyckUubmV4dC5wYWlyO1xuICAgICAgfVxuICAgICAgY3VyckUubmV4dCA9IGVuZXh0cC5uZXh0O1xuICAgICAgcDEuZSA9IGN1cnJFO1xuICAgICAgXG4gICAgICB0aGlzLnJlbW92ZVZlcnRleChlbmV4dC52KTtcbiAgICAgIHRoaXMucmVtb3ZlRWRnZShlbmV4dHApO1xuICAgICAgdGhpcy5yZW1vdmVFZGdlKGVuZXh0cDIpO1xuICAgIH0gZWxzZSB7XG4gICAgKi9cbiAgICAgIGVuZXh0cC5wYWlyID0gZW5leHRwMjtcbiAgICAgIGVuZXh0cDIucGFpciA9IGVuZXh0cDsgICAgXG4gICAgICAvL3AxLmUgPSBlbmV4dHA7XG4gICAgICBlbmV4dHAudi5lID0gZW5leHRwO1xuICAgICAgZW5leHRwMi52LmUgPSBlbmV4dHAyOyAgIFxuICAgIC8vfVxuICAgIFxuICAgIHRoaXMucmVtb3ZlRWRnZShlbmV4dCk7XG4gICAgdGhpcy5yZW1vdmVFZGdlKGVuZXh0Mik7XG5cbiBcbiAgICBcbiAgICB0aGlzLnJlbW92ZUZhY2UoZS5mYWNlKTtcbiAgfSBlbHNlIHtcbiAgICBcbiAgICBwcmV2RS5uZXh0ID0gZS5uZXh0O1xuICAgIHAxLmUgPSBwcmV2RTtcbiAgfVxuICBcbiAgaWYoZXBhaXIuZmFjZSAhPSBudWxsKSB7XG4gICAgZW5leHQgPSBlcGFpci5uZXh0O1xuICAgIGVuZXh0MiA9IGVuZXh0Lm5leHQ7XG4gICAgXG4gICAgLy9yZW1vdmUgZW5leHQgYW5kIGVuZXh0MjtcblxuICAgIGVuZXh0cCA9IGVuZXh0LnBhaXI7XG4gICAgZW5leHRwMiA9IGVuZXh0Mi5wYWlyO1xuICAgIC8qXG4gICAgaWYoZW5leHRwLmZhY2UgPT0gbnVsbCAmJiBlbmV4dHAyLmZhY2UgPT0gbnVsbCkge1xuICAgICAgLy9waW5jaGVkIG9mZiwgcmVtb3ZlIGVuZXh0cCBhbmQgZW5leHRwMiwgY29ubmVjdCBhY3Jvc3NcbiAgICAgIC8vaW5lZmZpY2llbnRseSBnZXQgcHJldmlvdXMgZWRnZVxuICAgICAgdmFyIGN1cnJFO1xuICAgICAgZm9yKHZhciBpPTA7aTx0aGlzLmVkZ2VzLmxlbmd0aDsrK2kpIHtcbiAgICAgICAgY3VyckUgPSB0aGlzLmVkZ2VzW2ldO1xuICAgICAgICBpZihjdXJyRS5uZXh0ID09IGVuZXh0cDIpIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgY3VyckUubmV4dCA9IGVuZXh0cC5uZXh0O1xuICAgICAgcDEuZSA9IGN1cnJFO1xuICAgICAgXG4gICAgICB0aGlzLnJlbW92ZVZlcnRleChlbmV4dC52KTtcbiAgICAgIHRoaXMucmVtb3ZlRWRnZShlbmV4dHApO1xuICAgICAgdGhpcy5yZW1vdmVFZGdlKGVuZXh0cDIpO1xuICAgIH0gZWxzZSB7XG4gICAgKi9cbiAgICAgIGVuZXh0cC5wYWlyID0gZW5leHRwMjtcbiAgICAgIGVuZXh0cDIucGFpciA9IGVuZXh0cDsgICAgXG4gICAgICBlbmV4dHAudi5lID0gZW5leHRwO1xuICAgICAgZW5leHRwMi52LmUgPSBlbmV4dHAyOyAgIFxuICAgIC8vfVxuICAgIHRoaXMucmVtb3ZlRWRnZShlbmV4dCk7XG4gICAgdGhpcy5yZW1vdmVFZGdlKGVuZXh0Mik7XG5cbiAgICB0aGlzLnJlbW92ZUZhY2UoZXBhaXIuZmFjZSk7XG4gIH0gZWxzZSB7XG4gICAgcHJldkVQLm5leHQgPSBlcGFpci5uZXh0O1xuICAgIHAxLmUgPSBwcmV2RVA7XG4gIH1cbiAgXG4gIC8vcmVtb3ZlIGUgYW5kIGVwYWlyXG4gIHRoaXMucmVtb3ZlRWRnZShlKTtcbiAgdGhpcy5yZW1vdmVFZGdlKGVwYWlyKTtcblxuICByZXR1cm4gcDE7XG59XG5cbmhlbWVzaC5wcm90b3R5cGUuZWRnZVNwbGl0ID0gKGZ1bmN0aW9uKCkgeyBcbiAgdmFyIHBvcyA9IHZlYzMuY3JlYXRlKCk7XG4gIC8vYXNzdW1lcyBlLmZhY2UgIT0gbnVsbCBidXQgZXBhaXIuZmFjZSBjYW4gPT0gbnVsbFxuICByZXR1cm4gZnVuY3Rpb24oZSkge1xuICAgIC8vbmVlZCB0byBjaGVjayBmb3IgYm91bmRhcnkgZWRnZVxuICAgIC8vbm90IGRvbmVcbiAgICBcbiAgICAvL25ldyBwdFxuICAgIHZhciBlcGFpciA9IGUucGFpcjtcbiAgICB2YXIgcDEgPSBlLnY7ICAgIFxuICAgIHZhciBwMiA9IGVwYWlyLnY7XG4gICAgdmFyIGVuZXh0ID0gZS5uZXh0O1xuICAgIHZhciBlcG5leHQgPSBlcGFpci5uZXh0O1xuICAgIFxuICAgIHZlYzMuYWRkKHBvcyxwMS5wb3MscDIucG9zKTtcbiAgICB2ZWMzLnNjYWxlKHBvcyxwb3MsMC41KTtcbiAgICB2YXIgbmV3VmVydGV4ID0gdGhpcy5hZGRWZXJ0ZXgocG9zKTtcbiAgICBcbiAgICB2YXIgbmV3RWRnZSwgbmV3RWRnZVBhaXIsIG5ld0ZhY2UsIHNwbGl0RWRnZTEsIHNwbGl0RWRnZTI7XG4gICAgXG4gICAgLy9kbyBlIGZpcnN0XG4gICAgbmV3RWRnZSA9IHRoaXMuYWRkRWRnZSgpO1xuICAgIG5ld0VkZ2UudiA9IHAxO1xuICAgIHAxLmUgPSBuZXdFZGdlO1xuICAgIGUudiA9IG5ld1ZlcnRleDtcbiAgICBuZXdFZGdlLm5leHQgPSBlbmV4dDtcbiAgICBuZXdFZGdlLnBhaXIgPSBlcGFpcjtcbiAgICBlcGFpci5wYWlyID0gbmV3RWRnZTtcbiAgICBcbiAgICBuZXdFZGdlUGFpciA9IHRoaXMuYWRkRWRnZSgpO1xuICAgIG5ld0VkZ2VQYWlyLnYgPSBwMjtcbiAgICBuZXdFZGdlUGFpci5lID0gcDI7XG4gICAgZXBhaXIudiA9IG5ld1ZlcnRleDtcbiAgICBuZXdFZGdlUGFpci5uZXh0ID0gZXBuZXh0O1xuICAgIG5ld0VkZ2VQYWlyLnBhaXIgPSBlO1xuICAgIGUucGFpciA9IG5ld0VkZ2VQYWlyO1xuICAgIG5ld1ZlcnRleC5lID0gZTtcbiAgICBcbiAgICAvL3NldCBiIHRvIG5laWdoYm9yaW5nIGIsIGl0IHAxLmIgc2hvdWxkIGVxdWFsIHAyLmJcbiAgICBpZihlLmZhY2UgPT0gbnVsbCB8fCBlcGFpci5mYWNlID09IG51bGwpIHsgbmV3VmVydGV4LmIgPSBwMS5iO31cbiAgICBcbiAgICBpZihlLmZhY2UgIT0gbnVsbCkge1xuICAgICAgLy9mYWNlIDFcbiAgICAgIG5ld0ZhY2UgPSB0aGlzLmFkZEZhY2UoKTtcbiAgICAgIHNwbGl0RWRnZTEgPSB0aGlzLmFkZEVkZ2UoKTtcbiAgICAgIHNwbGl0RWRnZTIgPSB0aGlzLmFkZEVkZ2UoKTtcbiAgICAgIHNwbGl0RWRnZTEucGFpciA9IHNwbGl0RWRnZTI7XG4gICAgICBzcGxpdEVkZ2UyLnBhaXIgPSBzcGxpdEVkZ2UxO1xuICAgICAgc3BsaXRFZGdlMS52ID0gZW5leHQudjtcbiAgICAgIHNwbGl0RWRnZTIudiA9IG5ld1ZlcnRleDtcbiAgICAgIFxuICAgICAgLy9lLmZcbiAgICAgIGUubmV4dCA9IHNwbGl0RWRnZTE7XG4gICAgICBzcGxpdEVkZ2UxLm5leHQgPSBlbmV4dC5uZXh0O1xuICAgICAgZS5mYWNlLmUgPSBlO1xuICAgICAgc3BsaXRFZGdlMS5mYWNlID0gZS5mYWNlO1xuICAgICAgLy9uZXdGYWNlXG4gICAgICBuZXdFZGdlLmZhY2UgPSBuZXdGYWNlO1xuICAgICAgc3BsaXRFZGdlMi5mYWNlID0gbmV3RmFjZTtcbiAgICAgIGVuZXh0LmZhY2UgPSBuZXdGYWNlO1xuICAgICAgbmV3RmFjZS5lID0gbmV3RWRnZTtcbiAgICAgIGVuZXh0Lm5leHQgPSBzcGxpdEVkZ2UyO1xuICAgICAgc3BsaXRFZGdlMi5uZXh0ID0gbmV3RWRnZTtcbiAgICB9IGVsc2Uge1xuICAgICAgZS5uZXh0ID0gbmV3RWRnZTtcbiAgICB9XG4gICAgXG4gICAgaWYoZXBhaXIuZmFjZSAhPSBudWxsKSB7XG4gICAgICBuZXdGYWNlID0gdGhpcy5hZGRGYWNlKCk7XG4gICAgICBzcGxpdEVkZ2UxID0gdGhpcy5hZGRFZGdlKCk7XG4gICAgICBzcGxpdEVkZ2UyID0gdGhpcy5hZGRFZGdlKCk7XG4gICAgICBzcGxpdEVkZ2UxLnBhaXIgPSBzcGxpdEVkZ2UyO1xuICAgICAgc3BsaXRFZGdlMi5wYWlyID0gc3BsaXRFZGdlMTtcbiAgICAgIHNwbGl0RWRnZTEudiA9IGVwbmV4dC52O1xuICAgICAgc3BsaXRFZGdlMi52ID0gbmV3VmVydGV4O1xuICAgICAgXG4gICAgICAvL2VwYWlyLmZcbiAgICAgIGVwYWlyLm5leHQgPSBzcGxpdEVkZ2UxO1xuICAgICAgc3BsaXRFZGdlMS5uZXh0ID0gZXBuZXh0Lm5leHQ7XG4gICAgICBlcGFpci5mYWNlLmUgPSBlcGFpcjtcbiAgICAgIHNwbGl0RWRnZTEuZmFjZSA9IGVwYWlyLmZhY2U7XG4gICAgICBcbiAgICAgIC8vbmV3RmFjZVxuICAgICAgbmV3RWRnZVBhaXIuZmFjZSA9IG5ld0ZhY2U7XG4gICAgICBzcGxpdEVkZ2UyLmZhY2UgPSBuZXdGYWNlO1xuICAgICAgZXBuZXh0LmZhY2UgPSBuZXdGYWNlO1xuICAgICAgbmV3RmFjZS5lID0gbmV3RWRnZVBhaXI7XG4gICAgICBlcG5leHQubmV4dCA9IHNwbGl0RWRnZTI7XG4gICAgICBzcGxpdEVkZ2UyLm5leHQgPSBuZXdFZGdlUGFpcjtcbiAgICB9IGVsc2Uge1xuICAgICAgZXBhaXIubmV4dCA9IG5ld0VkZ2VQYWlyO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gbmV3VmVydGV4O1xuICB9XG59KSgpO1xuXG5oZW1lc2gucHJvdG90eXBlLnNwbGl0TGFyZ2VzdCA9IGZ1bmN0aW9uKGUpIHtcbiAgdmFyIGxhcmdlc3RFZGdlID0gdGhpcy5sb25nZXN0RWRnZShlKTtcbiAgd2hpbGUobGFyZ2VzdEVkZ2UgIT0gZSkge1xuICAgIHRoaXMuc3BsaXRMYXJnZXN0KGxhcmdlc3RFZGdlKTtcbiAgICBsYXJnZXN0RWRnZSA9IHRoaXMubG9uZ2VzdEVkZ2UoZSk7XG4gIH1cbiAgdmFyIHBhaXIgPSBlLnBhaXI7XG4gIFxuICBsYXJnZXN0RWRnZSA9IHRoaXMubG9uZ2VzdEVkZ2UocGFpcik7XG4gIHdoaWxlKGxhcmdlc3RFZGdlICE9IHBhaXIpIHtcbiAgICB0aGlzLnNwbGl0TGFyZ2VzdChsYXJnZXN0RWRnZSk7XG4gICAgbGFyZ2VzdEVkZ2UgPSB0aGlzLmxvbmdlc3RFZGdlKHBhaXIpO1xuICB9XG4gIHRoaXMuZWRnZVNwbGl0KGUpO1xufVxuXG5oZW1lc2gucHJvdG90eXBlLmxvbmdlc3RFZGdlID0gZnVuY3Rpb24oZSkge1xuICBpZihlLmZhY2UgPT0gbnVsbCkge1xuICAgIHJldHVybiBlO1xuICB9IGVsc2Uge1xuICAgIHZhciBsb25nZXN0TGVuID0gdGhpcy5zcXJMZW4oZSk7XG4gICAgdmFyIGxvbmdFZGdlID0gZTtcbiAgICB2YXIgc3RhcnRFID0gZTtcbiAgICBlID0gZS5uZXh0O1xuICAgIGRvIHsgICAgICBcbiAgICAgIHZhciBsZW4gPSB0aGlzLnNxckxlbihlKTtcbiAgICAgIGlmKGxlbiA+IGxvbmdlc3RMZW4pIHtcbiAgICAgICAgbG9uZ2VzdExlbiA9IGxlbjtcbiAgICAgICAgbG9uZ0VkZ2UgPSBlO1xuICAgICAgfVxuICAgICAgZSA9IGUubmV4dDtcbiAgICB9IHdoaWxlKGUgIT0gc3RhcnRFKTtcbiAgICByZXR1cm4gbG9uZ0VkZ2U7XG4gIH1cbn1cblxuaGVtZXNoLnByb3RvdHlwZS5zcXJMZW4gPSBmdW5jdGlvbihlKSB7XG4gIHJldHVybiB2ZWMzLnNxckRpc3QoZS52LnBvcyxlLnBhaXIudi5wb3MpO1xufVxuXG5oZW1lc2gucHJvdG90eXBlLmVkZ2VGbGlwID0gZnVuY3Rpb24oZSkge1xuICB2YXIgZXBhaXIgPSBlLnBhaXI7XG4gIFxuICBpZihlcGFpci5mYWNlICE9IG51bGwgJiYgZS5mYWNlICE9IG51bGwpIHtcbiAgICB2YXIgZW5leHQgPSBlLm5leHQ7XG4gICAgdmFyIGVuZXh0MiA9IGVuZXh0Lm5leHQ7XG4gICAgdmFyIGVwbmV4dCA9IGVwYWlyLm5leHQ7XG4gICAgdmFyIGVwbmV4dDIgPSBlcG5leHQubmV4dDtcbiAgICB2YXIgcDEgPSBlLnY7XG4gICAgdmFyIHAyID0gZXBhaXIudjtcbiAgICBlLnYgPSBlbmV4dC52O1xuICAgIGVuZXh0LmZhY2UgPSBlcGFpci5mYWNlO1xuICAgIGVwYWlyLnYgPSBlcG5leHQudjtcbiAgICBlcG5leHQuZmFjZSA9IGUuZmFjZTtcbiAgICAvL25ldyBmYWNlc1xuICAgIGUubmV4dCA9IGVuZXh0MjtcbiAgICBlbmV4dDIubmV4dCA9IGVwbmV4dDtcbiAgICBlcG5leHQubmV4dCA9IGU7XG4gICAgXG4gICAgZXBhaXIubmV4dCA9IGVwbmV4dDI7XG4gICAgZXBuZXh0Mi5uZXh0ID0gZW5leHQ7XG4gICAgZW5leHQubmV4dCA9IGVwYWlyO1xuICAgIFxuICAgIC8vanVzdCBpbiBjYXNlIGZhY2UgcG9pbnRzIHRvIGUubmV4dCwgbm90IHRoYXQgaXQgc3RyaWN0bHkgbWF0dGVyc1xuICAgIGUuZmFjZS5lID0gZTtcbiAgICBlcGFpci5mYWNlLmUgPSBlcGFpcjtcbiAgICBcbiAgICAvL2RlYWwgd2l0aCB2ZXJ0ZXggcG9pbnRlcnNcbiAgICBwMi5lID0gZS5uZXh0O1xuICAgIHAxLmUgPSBlcGFpci5uZXh0O1xuICB9XG59XG5cbmhlbWVzaC5wcm90b3R5cGUuZ2V0VmFsZW5jZSA9IGZ1bmN0aW9uKHApIHtcbiAgdmFyIGUgPSBwLmU7XG4gIHZhciBjb3VudCA9IDA7XG4gIGRvIHtcbiAgICBjb3VudCsrO1xuICAgIGUgPSBlLm5leHQucGFpcjtcbiAgfSB3aGlsZShlICE9IHAuZSk7XG4gIHJldHVybiBjb3VudDtcbn1cblxuaGVtZXNoLnByb3RvdHlwZS5nZXRWYWxlbmNlRSA9IGZ1bmN0aW9uKGUpIHtcbiAgdmFyIHN0YXJ0RSA9IGU7XG4gIHZhciBjb3VudCA9IDA7XG4gIGRvIHtcbiAgICBjb3VudCsrO1xuICAgIGUgPSBlLm5leHQucGFpcjtcbiAgfSB3aGlsZShlICE9IHN0YXJ0RSk7XG4gIHJldHVybiBjb3VudDtcbn1cblxuZXhwb3J0cy5IRU1FU0hfTlVMTEZBQ0UgPSBIRU1FU0hfTlVMTEZBQ0U7XG5leHBvcnRzLmhlbWVzaCA9IGhlbWVzaDtcbmV4cG9ydHMuaGVkZ2UgPSBoZWRnZTtcbmV4cG9ydHMuaGVmYWNlID0gaGVmYWNlO1xuZXhwb3J0cy5oZXZlcnRleCA9IGhldmVydGV4O1xuIiwidmFyIHBtb3VzZVgscG1vdXNlWSxtb3VzZVgsbW91c2VZLHN0YXJ0TW91c2VYLHN0YXJ0TW91c2VZLCBtb3VzZUJ1dHRvbjtcbnZhciBzdGFydE1vdXNlVGltZTtcbmV4cG9ydHMuaXNNb3VzZURvd24gPSBmYWxzZTtcbmV4cG9ydHMubW91c2VEcmFnZ2luZyA9IGZhbHNlO1xuXG5mdW5jdGlvbiBzZXR1cE1vdXNlRXZlbnRzKGNhbnZhcykge1xuICAgIGNhbnZhcy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBvbk1vdXNlTW92ZSk7XG4gICAgY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIG9uTW91c2VEb3duKTtcbiAgICBjYW52YXMuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIG9uTW91c2VVcCk7XG4gICAgY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoJ2NvbnRleHRtZW51JywgZnVuY3Rpb24oZXZlbnQpe2V2ZW50LnByZXZlbnREZWZhdWx0KCk7fSk7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIG9uTW91c2VVcERvYyk7XG4gICAgXG4gICAgc2V0dXBUb3VjaEV2ZW50cyhjYW52YXMpO1xufVxuXG5leHBvcnRzLnNldHVwTW91c2VFdmVudHMgPSBzZXR1cE1vdXNlRXZlbnRzO1xuXG5mdW5jdGlvbiBzZXR1cFRvdWNoRXZlbnRzKGNhbnZhcykge1xuICAgIGlmKGlzVG91Y2hEZXZpY2UoKSkge1xuICAgICAgICBjYW52YXMuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgb25Ub3VjaE1vdmUpO1xuICAgICAgICBjYW52YXMuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIG9uVG91Y2hTdGFydCk7XG4gICAgICAgIGNhbnZhcy5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIG9uVG91Y2hFbmQpO1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIG9uTW91c2VVcERvYyk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBpc1RvdWNoRGV2aWNlKCkge1xuICByZXR1cm4gJ29udG91Y2hzdGFydCcgaW4gd2luZG93IC8vIHdvcmtzIG9uIG1vc3QgYnJvd3NlcnMgXG4gICAgICB8fCAnb25tc2dlc3R1cmVjaGFuZ2UnIGluIHdpbmRvdzsgLy8gd29ya3Mgb24gaWUxMFxufTtcblxuZnVuY3Rpb24gb25Nb3VzZURvd24oZXZlbnQpIHtcbiAgICAvLyBDYW5jZWwgdGhlIGRlZmF1bHQgZXZlbnQgaGFuZGxlclxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICBleHBvcnRzLm1vdXNlRHJhZ2dpbmcgPSBmYWxzZTtcbiAgICB2YXIgcmVjdCA9IGV2ZW50LnRhcmdldC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblxuICAgIHZhciBjdXJyZW50WCA9IGV2ZW50LmNsaWVudFgtcmVjdC5sZWZ0O1xuICAgIHZhciBjdXJyZW50WSA9IGV2ZW50LmNsaWVudFktcmVjdC50b3A7XG4gICAgXG4gICAgZXhwb3J0cy5wbW91c2VYID0gZXhwb3J0cy5tb3VzZVggPSBleHBvcnRzLnN0YXJ0TW91c2VYID0gY3VycmVudFg7XG4gICAgZXhwb3J0cy5wbW91c2VZID0gZXhwb3J0cy5tb3VzZVkgPSBleHBvcnRzLnN0YXJ0TW91c2VZID0gY3VycmVudFk7XG5cbiAgICBleHBvcnRzLmlzTW91c2VEb3duID0gdHJ1ZTtcbiAgICBleHBvcnRzLm1vdXNlQnV0dG9uID0gZXZlbnQud2hpY2g7XG4gICAgZXhwb3J0cy5zdGFydE1vdXNlVGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgIGlmKHR5cGVvZiBleHBvcnRzLm1vdXNlRG93biAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgZXhwb3J0cy5tb3VzZURvd24oKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIG9uTW91c2VNb3ZlKGV2ZW50KSB7XG4gICAgLy8gQ2FuY2VsIHRoZSBkZWZhdWx0IGV2ZW50IGhhbmRsZXJcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIFxuICAgIHZhciByZWN0ID0gZXZlbnQudGFyZ2V0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXG4gICAgdmFyIGN1cnJlbnRYID0gZXZlbnQuY2xpZW50WC1yZWN0LmxlZnQ7XG4gICAgdmFyIGN1cnJlbnRZID0gZXZlbnQuY2xpZW50WS1yZWN0LnRvcDtcbiAgICBcbiAgICBleHBvcnRzLnBtb3VzZVggPSBleHBvcnRzLm1vdXNlWDtcbiAgICBleHBvcnRzLnBtb3VzZVkgPSBleHBvcnRzLm1vdXNlWTtcbiAgICBcbiAgICBleHBvcnRzLm1vdXNlWCA9IGN1cnJlbnRYO1xuICAgIGV4cG9ydHMubW91c2VZID0gY3VycmVudFk7XG4gICAgaWYoZXhwb3J0cy5tb3VzZVggIT0gZXhwb3J0cy5wbW91c2VYIHx8IGV4cG9ydHMubW91c2VZICE9IGV4cG9ydHMucG1vdXNlWSkge1xuICAgICAgICBpZih0eXBlb2YgZXhwb3J0cy5tb3VzZU1vdmVkICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgZXhwb3J0cy5tb3VzZU1vdmVkKGV2ZW50KTtcbiAgICAgICAgfVxuICAgICAgICBpZihleHBvcnRzLmlzTW91c2VEb3duKSB7XG4gICAgICAgICAgICBleHBvcnRzLm1vdXNlRHJhZ2dpbmcgPSB0cnVlO1xuICAgICAgICAgICAgaWYodHlwZW9mIGV4cG9ydHMubW91c2VEcmFnZ2VkICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIGV4cG9ydHMubW91c2VEcmFnZ2VkKGV2ZW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gb25Nb3VzZVVwKGV2ZW50KSB7XG4gICAgLy8gQ2FuY2VsIHRoZSBkZWZhdWx0IGV2ZW50IGhhbmRsZXJcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGV4cG9ydHMuaXNNb3VzZURvd24gPSBmYWxzZTtcbiAgICBpZih0eXBlb2YgZXhwb3J0cy5tb3VzZVVwICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBleHBvcnRzLm1vdXNlVXAoZXZlbnQpO1xuICAgIH1cbiAgICBpZighZXhwb3J0cy5tb3VzZURyYWdnaW5nICYmICh0eXBlb2YgZXhwb3J0cy5tb3VzZUNsaWNrZWQgIT09ICd1bmRlZmluZWQnKSkge1xuICAgICAgICBleHBvcnRzLm1vdXNlQ2xpY2tlZChldmVudCk7XG4gICAgfVxuICAgIGV4cG9ydHMubW91c2VEcmFnZ2luZyA9IGZhbHNlO1xufVxuXG5mdW5jdGlvbiBvbk1vdXNlVXBEb2MoZXZlbnQpIHtcbiAgICBleHBvcnRzLmlzTW91c2VEb3duID0gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIG9uVG91Y2hTdGFydChldmVudCkge1xuICAgIC8vIENhbmNlbCB0aGUgZGVmYXVsdCBldmVudCBoYW5kbGVyXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgIG1vdXNlRHJhZ2dpbmcgPSBmYWxzZTtcbiAgICB2YXIgcmVjdCA9IGV2ZW50LnRhcmdldFRvdWNoZXNbMF0udGFyZ2V0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXG4gICAgdmFyIGN1cnJlbnRYID0gZXZlbnQudGFyZ2V0VG91Y2hlc1swXS5jbGllbnRYLXJlY3QubGVmdDtcbiAgICB2YXIgY3VycmVudFkgPSBldmVudC50YXJnZXRUb3VjaGVzWzBdLmNsaWVudFktcmVjdC50b3A7XG4gICAgXG4gICAgcG1vdXNlWCA9IG1vdXNlWCA9IHN0YXJ0TW91c2VYID0gY3VycmVudFg7XG4gICAgcG1vdXNlWSA9IG1vdXNlWSA9IHN0YXJ0TW91c2VZID0gY3VycmVudFk7XG4gICAgY29uc29sZS5sb2coXCJ0b3VjaCBzdGFydFwiKTtcbiAgICBpc01vdXNlRG93biA9IHRydWU7XG4gICAgLy9tb3VzZUJ1dHRvbiA9IGV2ZW50LmJ1dHRvbjtcbiAgICBtb3VzZUJ1dHRvbiA9IDA7XG4gICAgc3RhcnRNb3VzZVRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICBpZih0eXBlb2YgbW91c2VEb3duICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBtb3VzZURvd24oKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIG9uVG91Y2hNb3ZlKGV2ZW50KSB7XG4gICAgLy8gQ2FuY2VsIHRoZSBkZWZhdWx0IGV2ZW50IGhhbmRsZXJcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIFxuICAgIHZhciByZWN0ID0gZXZlbnQudGFyZ2V0VG91Y2hlc1swXS50YXJnZXQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cbiAgICB2YXIgY3VycmVudFggPSBldmVudC50YXJnZXRUb3VjaGVzWzBdLmNsaWVudFgtcmVjdC5sZWZ0O1xuICAgIHZhciBjdXJyZW50WSA9IGV2ZW50LnRhcmdldFRvdWNoZXNbMF0uY2xpZW50WS1yZWN0LnRvcDtcbiAgICBcbiAgICBwbW91c2VYID0gbW91c2VYO1xuICAgIHBtb3VzZVkgPSBtb3VzZVk7XG4gICAgXG4gICAgbW91c2VYID0gY3VycmVudFg7XG4gICAgbW91c2VZID0gY3VycmVudFk7XG4gICAgaWYodHlwZW9mIG1vdXNlTW92ZWQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIG1vdXNlTW92ZWQoKTtcbiAgICB9XG4gICAgaWYoaXNNb3VzZURvd24pIHtcbiAgICAgICAgbW91c2VEcmFnZ2luZyA9IHRydWU7XG4gICAgICAgIGlmKHR5cGVvZiBtb3VzZURyYWdnZWQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBtb3VzZURyYWdnZWQoKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gb25Ub3VjaEVuZChldmVudCkge1xuICAgIC8vIENhbmNlbCB0aGUgZGVmYXVsdCBldmVudCBoYW5kbGVyXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICBpc01vdXNlRG93biA9IGZhbHNlO1xuICAgIGlmKHR5cGVvZiBtb3VzZVVwICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBtb3VzZVVwKCk7XG4gICAgfVxuICAgIGlmKCFtb3VzZURyYWdnaW5nICYmICh0eXBlb2YgbW91c2VDbGlja2VkICE9PSAndW5kZWZpbmVkJykpIHtcbiAgICAgICAgbW91c2VDbGlja2VkKCk7XG4gICAgfVxuICAgIG1vdXNlRHJhZ2dpbmcgPSBmYWxzZTtcbn1cbiJdfQ==
