(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var glMatrix = require("../js/gl-matrix-min.js");
var vec3 = glMatrix.vec3;
var vec2 = glMatrix.vec2;
var mat4 = glMatrix.mat4;
var nurbs = require("./nurbs.js");
var vboMesh = require("./vboMesh.js");
var text = require("./text.js");
var poly2tri = require("./poly2tri.js");
var SweepContext = poly2tri.SweepContext;

var woodWidth = 12.2;
var conLen = 35; //45
var conOffset = 12;
var conWidth = 12;//20
var shelfOffset = 12;
var printTolerance = 0;
var labelHeight = 5;
var filletRadius = 9;

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
  var dir, nDir;
  var perp = vec3.create();
  var bisector = vec3.create();
  var e,startE;
  var trans = mat4.create();
  var cLen, aLen, lenDiff;
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
      
      vec2.scaleAndAdd(pt,pt,dir,-cConLen);
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
      addConnectorPt(vboOut,pt);
      
      vec2.scaleAndAdd(pt,pt,perp,-labelHeight);
      addConnectorPt(vboOut,pt);

      vec2.scaleAndAdd(pt,pt,perp,-labelHeight);
      addConnectorPt(vboOut,pt);
      
      vec2.scaleAndAdd(pt,pt,dir,-labelHeight);
      addConnectorPt(vboOut,pt);
      
      vec2.scaleAndAdd(pt,pt,perp,labelHeight);
      addConnectorPt(vboOut,pt);

      vec2.scaleAndAdd(pt,pt,perp,labelHeight);
      addConnectorPt(vboOut,pt);
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
      vboMesh.addTriangle(vboOut, baseIndex+i1*2, baseIndex+i3*2, baseIndex+i2*2);
      vboMesh.addTriangle(vboOut, baseIndex+i1*2+1, baseIndex+i2*2+1, baseIndex+i3*2+1);      
    }
    
    //add labels
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
      
      vec2.scaleAndAdd(pt,pt,dir,-conLen);
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

exports.createConnector = createConnector;
exports.initConnector = initConnector;
exports.shelfOffset = shelfOffset;
},{"../js/gl-matrix-min.js":9,"./nurbs.js":4,"./poly2tri.js":5,"./text.js":6,"./vboMesh.js":7}],2:[function(require,module,exports){
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
var shelfHeight = 1800;

var minimumShelf = 85;//105;
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
  connector.initConnector(gl);
  
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
  fixShelves();
  fixShelves();
  fixShelves();
  fixShelves();
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

function initVoronoi() {
  voronoi.setDimensions(shelfWidth,shelfHeight);
  voronoi.init();
  voronoi.reset();
  voronoi.voronoi();
}


function keyPress(event) {
  switch(event.which) {
    case "D".charCodeAt(0):
      download();
      break;
  }
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
  for(var i=0;i<lens.length;++i) {
    if(lens[i]) {
      lenStr += i + " " + (lens[i]/25.4).toFixed(3) + "\n";
    }
  }
  
  var a = document.createElement('a');
  var blob = new Blob([lenStr]);
  a.href = window.URL.createObjectURL(blob);
  a.download = "lengths"+new Date().toISOString().substring(0,16)+".txt";
  a.click();
  
  downloadVboAsSTL(connectorVbo);
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
  return function mouseClicked(event) {
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

},{"../js/gl-matrix-min.js":9,"../js/glShader.js":10,"../js/pointer.js":12,"./connector.js":1,"./glUtils.js":2,"./poly2tri.js":5,"./vboMesh.js":7,"./voronoi.js":8}],4:[function(require,module,exports){
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
},{"../js/gl-matrix-min.js":9}],5:[function(require,module,exports){
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
},{"../js/gl-matrix-min.js":9,"./poly2tri.js":5,"./vboMesh.js":7}],7:[function(require,module,exports){
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
},{"../js/gl-matrix-min.js":9}],8:[function(require,module,exports){
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
function reset() {
  //make regularly spaced points
  pts.length = 0;
  
  var defaultSpacing = 310;
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
  outsidePts.length = 0;
  var d = 5000;
  outsidePts.push({x:0,y:-d,fixed:true,bottom:true});
  outsidePts.push({x:width*0.5,y:-d,fixed:true,bottom:true});
  outsidePts.push({x:width,y:-d,fixed:true,bottom:true});

  outsidePts.push({x:width+d,y:0,fixed:true,right:true});
  outsidePts.push({x:width+d,y:height*0.5,fixed:true,right:true});
  outsidePts.push({x:width+d,y:height,fixed:true,right:true});

  outsidePts.push({x:width,y:height+d,fixed:true,top:true});
  outsidePts.push({x:width*0.5,y:height+d,fixed:true,top:true});
  outsidePts.push({x:0,y:height+d,fixed:true,top:true});

  outsidePts.push({x:-d,y:height,fixed:true,left:true});
  outsidePts.push({x:-d,y:height*0.5,fixed:true,left:true});
  outsidePts.push({x:-d,y:0,fixed:true,left:true});
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
  /*
  for(var i=0,len=triangles.length;i<len;++i) {
    var t = triangles[i];
    var bPtCount = 0;
    var bPts = [];
    var inPt;
    for(var j=0;j<3;++j) {
      if(t.points_[j].boundary) {
        bPts[bPtCount] = t.points_[j];
        bPtCount++;
        
      } else {
        inPt = j;
      }
    }
    
    if(bPtCount==2) {
      if(inPt == 1) {
        var temp = bPts[0];
        bPts[0] = bPts[1];
        bPts[1] = temp;
      }
      inPt = t.points_[inPt];
      //mirror in pt
      vec2.set(dir1,bPts[1].x-bPts[0].x,bPts[1].y-bPts[0].y);
      vec2.set(dir2,inPt.x-bPts[0].x,inPt.y-bPts[0].y);
      console.log(dir1[0]*dir2[1]-dir1[1]*dir2[0]);
      vec2.normalize(dir1,dir1);
      var dot = vec2.dot(dir1,dir2);
      vec2.scale(dir1,dir1,dot);
      vec2.sub(dir2,dir1,dir2);
      vec2.add(dir1,dir1,dir2);
      var newPt = new poly2tri.Point(dir1[0]+bPts[0].x,dir1[1]+bPts[0].y);
      newPt.fixed = true;
      //new triangle
      var newT = new poly2tri.Triangle(bPts[0],bPts[1],newPt);
      newT.interior_ = true;
      newT.new1 = true;
      newT.markNeighbor(t);
      triangles.push(newT);
      
      bPts[0].newPts.push(newPt);
      bPts[0].newTris.push(newT);
      bPts[1].newPts.push(newPt);
      bPts[1].newTris.push(newT);
    }
  }
  vec2.set(dir1,t.points_[1].x-t.points_[0].x,t.points_[1].y-t.points_[0].y);
  vec2.set(dir2,t.points_[2].x-t.points_[0].x,t.points_[2].y-t.points_[0].y);
  console.log(dir1[0]*dir2[1]-dir1[1]*dir2[0]);
  
  for(var i=0;i<pts.length;++i) {
    var pt = pts[i];
    if(pt.boundary && pt.newPts.length == 2) {
      var newT = new poly2tri.Triangle(pt,pt.newPts[0],pt.newPts[1]);
      newT.new2 = true;
      newT.interior_ = true;
      newT.markNeighbor(pt.newTris[0]);
      newT.markNeighbor(pt.newTris[1]);
      triangles.push(newT);
    }
  }
  */
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
          pt.x += dx*.25;
          pt.y += dy*.25;
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
        if(!pt.cell){
          buildCell(pt,t);
        }
      }
    }
  }
  makeBoundaryEdges(voroMesh, ptToEdge);
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
  var insideVal = 1;
  if(pt[0] >= width) {
    insideVal = Math.min(insideVal, rightOn ? 0 : -1);
  }
  if(pt[0] <= 0) {
    insideVal = Math.min(insideVal, leftOn ? 0 : -1);
  }
  if(pt[1] >= height) {
    insideVal = Math.min(insideVal, topOn ? 0 : -1);
  }
  if(pt[1] <= 0) {
    insideVal = Math.min(insideVal, bottomOn ? 0 : -1);
  }
  return insideVal;
  //return pt[0] > 0 && pt[0] < width && pt[1] > 0 && pt[1] < height;
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

var EPSILON = .00001;

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
    do {
      e = e.next;
    } while(isInside(e.v.pos) <= 0 && e != startE);
    startE = e;
    //find first outside pt
    do {
      
      prevE = e;
      e = e.next;
    } while(isInside(e.v.pos) > 0 && e != startE);
    
    if(isInside(e.v.pos) > 0) { return; }
    
    if(isInside(e.v.pos) < 0) f.on = false;
    
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
    while(isInside(e.v.pos) <= 0 && e != startE) {
      if(isInside(e.v.pos) < 0) f.on = false;
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
    if(Math.abs(startE.v.pos[0]-newV.pos[0]) > EPSILON && Math.abs(startE.v.pos[0]-newV.pos[0]) > EPSILON) {
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

exports.init = init;
exports.reset = reset;
exports.voronoi = voronoi;
exports.pts = pts;
exports.triangles = triangles;
exports.setDimensions = setDimensions;
exports.centroidal = centroidal;
exports.mesh = voroMesh;
},{"../js/gl-matrix-min.js":9,"../js/hemesh.js":11,"./poly2tri.js":5}],9:[function(require,module,exports){
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

},{}],10:[function(require,module,exports){
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

},{}],11:[function(require,module,exports){
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

},{"../js/gl-matrix-min.js":9}],12:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyJjOlxcVXNlcnNcXEplc3NlXFxBcHBEYXRhXFxSb2FtaW5nXFxucG1cXG5vZGVfbW9kdWxlc1xcd2F0Y2hpZnlcXG5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwiYzovVXNlcnMvSmVzc2UvRG9jdW1lbnRzL2h0ZG9jcy9ib29rc2hlbGYvY29ubmVjdG9yLmpzIiwiYzovVXNlcnMvSmVzc2UvRG9jdW1lbnRzL2h0ZG9jcy9ib29rc2hlbGYvZ2xVdGlscy5qcyIsImM6L1VzZXJzL0plc3NlL0RvY3VtZW50cy9odGRvY3MvYm9va3NoZWxmL21haW4uanMiLCJjOi9Vc2Vycy9KZXNzZS9Eb2N1bWVudHMvaHRkb2NzL2Jvb2tzaGVsZi9udXJicy5qcyIsImM6L1VzZXJzL0plc3NlL0RvY3VtZW50cy9odGRvY3MvYm9va3NoZWxmL3BvbHkydHJpLmpzIiwiYzovVXNlcnMvSmVzc2UvRG9jdW1lbnRzL2h0ZG9jcy9ib29rc2hlbGYvdGV4dC5qcyIsImM6L1VzZXJzL0plc3NlL0RvY3VtZW50cy9odGRvY3MvYm9va3NoZWxmL3Zib01lc2guanMiLCJjOi9Vc2Vycy9KZXNzZS9Eb2N1bWVudHMvaHRkb2NzL2Jvb2tzaGVsZi92b3Jvbm9pLmpzIiwiYzovVXNlcnMvSmVzc2UvRG9jdW1lbnRzL2h0ZG9jcy9qcy9nbC1tYXRyaXgtbWluLmpzIiwiYzovVXNlcnMvSmVzc2UvRG9jdW1lbnRzL2h0ZG9jcy9qcy9nbFNoYWRlci5qcyIsImM6L1VzZXJzL0plc3NlL0RvY3VtZW50cy9odGRvY3MvanMvaGVtZXNoLmpzIiwiYzovVXNlcnMvSmVzc2UvRG9jdW1lbnRzL2h0ZG9jcy9qcy9wb2ludGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcmNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOWdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2g4REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6V0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzl0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcFJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFtQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgZ2xNYXRyaXggPSByZXF1aXJlKFwiLi4vanMvZ2wtbWF0cml4LW1pbi5qc1wiKTtcclxudmFyIHZlYzMgPSBnbE1hdHJpeC52ZWMzO1xyXG52YXIgdmVjMiA9IGdsTWF0cml4LnZlYzI7XHJcbnZhciBtYXQ0ID0gZ2xNYXRyaXgubWF0NDtcclxudmFyIG51cmJzID0gcmVxdWlyZShcIi4vbnVyYnMuanNcIik7XHJcbnZhciB2Ym9NZXNoID0gcmVxdWlyZShcIi4vdmJvTWVzaC5qc1wiKTtcclxudmFyIHRleHQgPSByZXF1aXJlKFwiLi90ZXh0LmpzXCIpO1xyXG52YXIgcG9seTJ0cmkgPSByZXF1aXJlKFwiLi9wb2x5MnRyaS5qc1wiKTtcclxudmFyIFN3ZWVwQ29udGV4dCA9IHBvbHkydHJpLlN3ZWVwQ29udGV4dDtcclxuXHJcbnZhciB3b29kV2lkdGggPSAxMi4yO1xyXG52YXIgY29uTGVuID0gMzU7IC8vNDVcclxudmFyIGNvbk9mZnNldCA9IDEyO1xyXG52YXIgY29uV2lkdGggPSAxMjsvLzIwXHJcbnZhciBzaGVsZk9mZnNldCA9IDEyO1xyXG52YXIgcHJpbnRUb2xlcmFuY2UgPSAwO1xyXG52YXIgbGFiZWxIZWlnaHQgPSA1O1xyXG52YXIgZmlsbGV0UmFkaXVzID0gOTtcclxuXHJcbnZhciBjb25uZWN0b3JUcmlzID0gW107XHJcbmZ1bmN0aW9uIGluaXRDb25uZWN0b3IoZ2wpIHtcclxuICB0ZXh0LmluaXQoZ2wpO1xyXG4gIC8vZ2V0IGNvbm5lY3RvciB0cmlzXHJcbiAgZm9yKHZhciBpPTI7aTw2OysraSkge1xyXG4gICAgY29ubmVjdG9yVHJpc1tpXSA9IHZib01lc2guY3JlYXRlKCk7XHJcbiAgICBtYWtlQ29ubmVjdG9yU2tlbGV0b24oaSxjb25uZWN0b3JUcmlzW2ldKTtcclxuICB9XHJcbn1cclxuXHJcbnZhciBhY2N1cmFjeSA9IDMuMTc1O1xyXG5cclxudmFyIGNyZWF0ZUNvbm5lY3RvciA9IChmdW5jdGlvbigpIHtcclxuICB2YXIgbWF4VmFsZW5jZSA9IDc7XHJcbiAgdmFyIGRpcnMgPSBbXTtcclxuICB2YXIgbGFiZWxzUHQgPSBuZXcgQXJyYXkobWF4VmFsZW5jZSk7XHJcbiAgZm9yKHZhciBpPTA7aTxtYXhWYWxlbmNlOysraSkge1xyXG4gICAgZGlyc1tpXSA9IHZlYzMuY3JlYXRlKCk7XHJcbiAgICBsYWJlbHNQdFtpXSA9IHZlYzMuY3JlYXRlKCk7XHJcbiAgfVxyXG4gIHZhciBsZW5ndGhzID0gbmV3IEFycmF5KG1heFZhbGVuY2UpO1xyXG4gIHZhciBsYWJlbHMgPSBuZXcgQXJyYXkobWF4VmFsZW5jZSk7XHJcbiAgdmFyIHB0ID0gdmVjMy5jcmVhdGUoKTtcclxuICB2YXIgcHQyID0gdmVjMy5jcmVhdGUoKTtcclxuICB2YXIgZGlyLCBuRGlyO1xyXG4gIHZhciBwZXJwID0gdmVjMy5jcmVhdGUoKTtcclxuICB2YXIgYmlzZWN0b3IgPSB2ZWMzLmNyZWF0ZSgpO1xyXG4gIHZhciBlLHN0YXJ0RTtcclxuICB2YXIgdHJhbnMgPSBtYXQ0LmNyZWF0ZSgpO1xyXG4gIHZhciBjTGVuLCBhTGVuLCBsZW5EaWZmO1xyXG4gIHJldHVybiBmdW5jdGlvbiBjcmVhdGVDb25uZWN0b3Iodix2Ym9PdXQpIHtcclxuICAgIHN0YXJ0RSA9IHYuZTtcclxuICAgIGUgPSBzdGFydEU7XHJcbiAgICB2YXIgY2VudGVyID0gdi5wb3M7XHJcbiAgICB2YXIgaW5kZXggPSAwO1xyXG4gICAgZG8ge1xyXG4gICAgICBlID0gZS5uZXh0O1xyXG4gICAgICBpZigoZS5mYWNlICYmIGUuZmFjZS5vbikgfHwgKGUucGFpci5mYWNlICYmIGUucGFpci5mYWNlLm9uKSkge1xyXG4gICAgICAgIHZlYzMuc3ViKGRpcnNbaW5kZXhdLGUudi5wb3MsY2VudGVyKTtcclxuICAgICAgICBsZW4gPSB2ZWMzLmxlbihkaXJzW2luZGV4XSk7XHJcbiAgICAgICAgdmVjMy5zY2FsZShkaXJzW2luZGV4XSxkaXJzW2luZGV4XSwxLjAvbGVuKTtcclxuICAgICAgICBsYWJlbHNbaW5kZXhdID0gZS5pbmZvLmxhYmVsO1xyXG4gICAgICAgIC8vY29uc29sZS5sb2coZS5pbmZvLmxhYmVsKTtcclxuICAgICAgICBsZW5ndGhzW2luZGV4XSA9IGxlbjtcclxuICAgICAgICBpbmRleCsrO1xyXG4gICAgICB9XHJcbiAgICAgIGUgPSBlLnBhaXI7XHJcbiAgICB9IHdoaWxlKGUgIT0gc3RhcnRFKTtcclxuICAgIGlmKGluZGV4IDwgMikgcmV0dXJuO1xyXG4gICAgdmFyIG51bUxlZ3MgPSBpbmRleDtcclxuICAgIFxyXG4gICAgdmFyIGJhc2VJbmRleCA9IHZib091dC5udW1WZXJ0aWNlcztcclxuICAgIHZhciBudW1QdHMgPSAwO1xyXG4gICAgXHJcbiAgICBmb3IodmFyIGk9MDtpPG51bUxlZ3M7KytpKSB7XHJcbiAgICAgIC8vbWFrZSBwb2ludHNcclxuICAgICAgZGlyID0gZGlyc1tpXTtcclxuICAgICAgdmFyIGlOZXh0ID0gKGkrMSklbnVtTGVncztcclxuICAgICAgbkRpciA9IGRpcnNbaU5leHRdO1xyXG4gICAgICBcclxuICAgICAgY0xlbiA9IGxlbmd0aHNbaV0tc2hlbGZPZmZzZXQqMjtcclxuICAgICAgYUxlbiA9IGFjY3VyYWN5ICogTWF0aC5mbG9vcihjTGVuIC8gYWNjdXJhY3kpO1xyXG4gICAgICBsZW5EaWZmID0gKGNMZW4tYUxlbikqMC41O1xyXG4gICAgICB2YXIgY0NvbkxlbiA9IGNvbkxlbjtcclxuICAgICAgY0NvbkxlbiA9IE1hdGgubWluKGNDb25MZW4sIGFMZW4qMC45KjAuNSk7XHJcbiAgICAgIFxyXG4gICAgICB2ZWMyLnNldChwZXJwLGRpclsxXSwtZGlyWzBdKTtcclxuICAgICAgdmVjMy5zY2FsZUFuZEFkZChwdCxjZW50ZXIsIGRpciwgY0NvbkxlbitzaGVsZk9mZnNldCtsZW5EaWZmKTtcclxuICAgICAgdmVjMi5zY2FsZUFuZEFkZChwdCxwdCxwZXJwLHdvb2RXaWR0aCowLjUrcHJpbnRUb2xlcmFuY2UpOyAgICAgIFxyXG4gICAgICAvL2FkZENvbm5lY3RvclB0KHZib091dCxwdCk7XHJcbiAgICAgIHZib01lc2guYWRkVmVydGV4KHZib091dCxwdCk7XHJcbiAgICAgIHZlYzIuc2NhbGVBbmRBZGQocHQyLHB0LGRpciwtZmlsbGV0UmFkaXVzKTtcclxuICAgICAgcHQyWzJdID0gY29uV2lkdGg7XHJcbiAgICAgIHZib01lc2guYWRkVmVydGV4KHZib091dCxwdDIpO1xyXG4gICAgICBudW1QdHMrKztcclxuICAgICAgXHJcbiAgICAgIHZlYzIuc2NhbGVBbmRBZGQocHQscHQsZGlyLC1jQ29uTGVuKTtcclxuICAgICAgYWRkQ29ubmVjdG9yUHQodmJvT3V0LHB0KTtcclxuICAgICAgbnVtUHRzKys7XHJcbiAgICAgIFxyXG4gICAgICB2ZWMyLnNjYWxlQW5kQWRkKHB0LHB0LHBlcnAsLSh3b29kV2lkdGgrcHJpbnRUb2xlcmFuY2UqMikpO1xyXG4gICAgICBhZGRDb25uZWN0b3JQdCh2Ym9PdXQscHQpO1xyXG4gICAgICBudW1QdHMrKztcclxuXHJcbiAgICAgIFxyXG4gICAgICAvL21ha2UgY3VydmVcclxuICAgICAgdmFyIGNydiA9IG51cmJzLmNyZWF0ZUNydihudWxsLCAyKTtcclxuICAgICAgdmFyIGNydlRvcCA9IG51cmJzLmNyZWF0ZUNydihudWxsLCAyKTtcclxuICAgICAgXHJcbiAgICAgIHZlYzIuc2NhbGVBbmRBZGQocHQscHQsZGlyLGNDb25MZW4pO1xyXG4gICAgICAvL2FkZENvbm5lY3RvclB0KHZib091dCxwdCk7XHJcbiAgICAgIHZib01lc2guYWRkVmVydGV4KHZib091dCxwdCk7XHJcbiAgICAgIHZlYzIuc2NhbGVBbmRBZGQocHQyLHB0LGRpciwtZmlsbGV0UmFkaXVzKTtcclxuICAgICAgcHQyWzJdID0gY29uV2lkdGg7XHJcbiAgICAgIHZib01lc2guYWRkVmVydGV4KHZib091dCxwdDIpO1xyXG5cclxuICAgICAgXHJcbiAgICAgIG51bVB0cysrO1xyXG4gICAgICBcclxuICAgICAgbnVyYnMuYWRkUG9pbnQoY3J2LHB0KTtcclxuICAgICAgbnVyYnMuYWRkUG9pbnQoY3J2VG9wLHB0Mik7XHJcblxyXG4gICAgICB2ZWMyLnNjYWxlQW5kQWRkKHB0LHB0LHBlcnAsLWNvbk9mZnNldCk7XHJcbiAgICAgIHZlYzIuc2NhbGVBbmRBZGQocHQyLHB0MixwZXJwLC1jb25PZmZzZXQrZmlsbGV0UmFkaXVzKTtcclxuICAgICAgLy9hZGRDb25uZWN0b3JQdCh2Ym9PdXQscHQpO1xyXG4gICAgICAvL251bVB0cysrO1xyXG5cclxuICAgICAgbnVyYnMuYWRkUG9pbnQoY3J2LHB0KTtcclxuICAgICAgbnVyYnMuYWRkUG9pbnQoY3J2VG9wLHB0Mik7XHJcbiAgICAgIFxyXG4gICAgICAvL2dldCBvZmZzZXRcclxuICAgICAgYmlzZWN0b3JbMF0gPSBkaXJbMF0tbkRpclswXTtcclxuICAgICAgYmlzZWN0b3JbMV0gPSBkaXJbMV0tbkRpclsxXTtcclxuICAgICAgdmVjMi5ub3JtYWxpemUoYmlzZWN0b3IsYmlzZWN0b3IpO1xyXG4gICAgICAvL3JvdGF0ZSA5MFxyXG4gICAgICB2YXIgdGVtcCA9IGJpc2VjdG9yWzBdO1xyXG4gICAgICBiaXNlY3RvclswXSA9IC1iaXNlY3RvclsxXTtcclxuICAgICAgYmlzZWN0b3JbMV0gPSB0ZW1wO1xyXG4gICAgICB2YXIgc2luQSA9IE1hdGguYWJzKGJpc2VjdG9yWzBdKmRpclsxXS1iaXNlY3RvclsxXSpkaXJbMF0pO1xyXG4gICAgICB2ZWMzLnNjYWxlQW5kQWRkKHB0LGNlbnRlcixiaXNlY3Rvciwod29vZFdpZHRoKjAuNStjb25PZmZzZXQpL3NpbkEpO1xyXG4gICAgICB2ZWMyLnNjYWxlQW5kQWRkKHB0MixjZW50ZXIsYmlzZWN0b3IsKHdvb2RXaWR0aCowLjUrKGNvbk9mZnNldC1maWxsZXRSYWRpdXMpKS9zaW5BKTtcclxuXHJcbiAgICAgIG51cmJzLmFkZFBvaW50KGNydixwdCk7XHJcbiAgICAgIG51cmJzLmFkZFBvaW50KGNydlRvcCxwdDIpO1xyXG4gICAgICBcclxuICAgICAgLy9hZGRDb25uZWN0b3JQdCh2Ym9PdXQscHQpO1xyXG4gICAgICAvL251bVB0cysrO1xyXG4gICAgICBcclxuICAgICAgLy9kZWFsIHdpdGggbmV4dCBsZWdcclxuICAgICAgY0xlbiA9IGxlbmd0aHNbaU5leHRdLXNoZWxmT2Zmc2V0KjI7XHJcbiAgICAgIGFMZW4gPSBhY2N1cmFjeSAqIE1hdGguZmxvb3IoY0xlbiAvIGFjY3VyYWN5KTtcclxuICAgICAgbGVuRGlmZiA9IChjTGVuLWFMZW4pKjAuNTtcclxuICAgICAgY0NvbkxlbiA9IE1hdGgubWluKGNvbkxlbiwgYUxlbiowLjkqMC41KTtcclxuXHJcbiAgICAgIHZlYzIuc2V0KHBlcnAsbkRpclsxXSwtbkRpclswXSk7XHJcbiAgICAgIHZlYzMuc2NhbGVBbmRBZGQocHQsY2VudGVyLCBuRGlyLCBjQ29uTGVuK3NoZWxmT2Zmc2V0K2xlbkRpZmYpO1xyXG4gICAgICB2ZWMyLnNjYWxlQW5kQWRkKHB0LHB0LHBlcnAsd29vZFdpZHRoKjAuNStwcmludFRvbGVyYW5jZStjb25PZmZzZXQpOyAgICAgIFxyXG4gICAgICB2ZWMyLnNjYWxlQW5kQWRkKHB0MixwdCxwZXJwLC1maWxsZXRSYWRpdXMpO1xyXG4gICAgICB2ZWMyLnNjYWxlQW5kQWRkKHB0MixwdDIsbkRpciwtZmlsbGV0UmFkaXVzKTtcclxuICAgICAgXHJcbiAgICAgIG51cmJzLmFkZFBvaW50KGNydixwdCk7XHJcbiAgICAgIG51cmJzLmFkZFBvaW50KGNydlRvcCxwdDIpO1xyXG4gICAgICB2ZWMyLnNjYWxlQW5kQWRkKHB0LHB0LHBlcnAsLWNvbk9mZnNldCk7ICAgICAgXHJcbiAgICAgIHZlYzIuc2NhbGVBbmRBZGQocHQyLHB0MixwZXJwLC0oY29uT2Zmc2V0LWZpbGxldFJhZGl1cykpOyAgICAgIFxyXG4gICAgICBudXJicy5hZGRQb2ludChjcnYscHQpO1xyXG4gICAgICBudXJicy5hZGRQb2ludChjcnZUb3AscHQyKTtcclxuICAgICAgXHJcbiAgICAgIHZhciBkb21haW4gPSBudXJicy5kb21haW4oY3J2KTtcclxuICAgICAgZm9yKHZhciBqPTE7ajwyMDsrK2opIHtcclxuICAgICAgICB2YXIgdSA9IGovMjAuMCooZG9tYWluWzFdLWRvbWFpblswXSkrZG9tYWluWzBdO1xyXG4gICAgICAgIG51cmJzLmV2YWx1YXRlQ3J2KGNydix1LHB0KTtcclxuICAgICAgICBudXJicy5ldmFsdWF0ZUNydihjcnZUb3AsdSxwdDIpO1xyXG4gICAgICAgIC8vYWRkQ29ubmVjdG9yUHQodmJvT3V0LHB0KTtcclxuICAgICAgICB2Ym9NZXNoLmFkZFZlcnRleCh2Ym9PdXQscHQpO1xyXG4gICAgICAgIHZib01lc2guYWRkVmVydGV4KHZib091dCxwdDIpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIG51bVB0cysrO1xyXG4gICAgICAgIFxyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgfVxyXG4gICAgdmFyIGJhc2VJbmRleDIgPSB2Ym9PdXQubnVtVmVydGljZXM7XHJcblxyXG4gICAgLy9hZGQgbGFiZWwgaG9sZXNcclxuICAgIHZhciBsYWJlbFNwYWNlID0gMTtcclxuICAgIGZvcih2YXIgaT0wO2k8bnVtTGVnczsrK2kpIHtcclxuICAgICAgLy9tYWtlIHBvaW50c1xyXG4gICAgICBkaXIgPSBkaXJzW2ldO1xyXG4gICAgICB2ZWMyLnNldChwZXJwLGRpclsxXSwtZGlyWzBdKTtcclxuICAgICAgdmVjMy5zY2FsZUFuZEFkZChwdCxjZW50ZXIsIGRpciwgc2hlbGZPZmZzZXQtbGFiZWxTcGFjZSk7XHJcbiAgICAgIHZlYzIuc2NhbGVBbmRBZGQocHQscHQscGVycCxsYWJlbEhlaWdodCk7XHJcbiAgICAgIGFkZENvbm5lY3RvclB0KHZib091dCxwdCk7XHJcbiAgICAgIFxyXG4gICAgICB2ZWMyLnNjYWxlQW5kQWRkKHB0LHB0LHBlcnAsLWxhYmVsSGVpZ2h0KTtcclxuICAgICAgYWRkQ29ubmVjdG9yUHQodmJvT3V0LHB0KTtcclxuXHJcbiAgICAgIHZlYzIuc2NhbGVBbmRBZGQocHQscHQscGVycCwtbGFiZWxIZWlnaHQpO1xyXG4gICAgICBhZGRDb25uZWN0b3JQdCh2Ym9PdXQscHQpO1xyXG4gICAgICBcclxuICAgICAgdmVjMi5zY2FsZUFuZEFkZChwdCxwdCxkaXIsLWxhYmVsSGVpZ2h0KTtcclxuICAgICAgYWRkQ29ubmVjdG9yUHQodmJvT3V0LHB0KTtcclxuICAgICAgXHJcbiAgICAgIHZlYzIuc2NhbGVBbmRBZGQocHQscHQscGVycCxsYWJlbEhlaWdodCk7XHJcbiAgICAgIGFkZENvbm5lY3RvclB0KHZib091dCxwdCk7XHJcblxyXG4gICAgICB2ZWMyLnNjYWxlQW5kQWRkKHB0LHB0LHBlcnAsbGFiZWxIZWlnaHQpO1xyXG4gICAgICBhZGRDb25uZWN0b3JQdCh2Ym9PdXQscHQpO1xyXG4gICAgICB2ZWMzLmNvcHkobGFiZWxzUHRbaV0scHQpOyAgXHJcbiAgICB9XHJcbiAgICBcclxuICAgIHZhciBiYXNlSW5kZXgzID0gdmJvT3V0Lm51bVZlcnRpY2VzO1xyXG4gICAgLy9zdGl0Y2ggc2lkZXNcclxuICAgIC8qXHJcbiAgICBmb3IodmFyIGk9MDtpPG51bVB0czsrK2kpIHtcclxuICAgICAgdmFyIGlOZXh0ID0gKGkrMSklbnVtUHRzO1xyXG4gICAgICB2Ym9NZXNoLmFkZFRyaWFuZ2xlKHZib091dCxiYXNlSW5kZXgraSoyLGJhc2VJbmRleCtpTmV4dCoyKzEsYmFzZUluZGV4K2kqMisxKTtcclxuICAgICAgdmJvTWVzaC5hZGRUcmlhbmdsZSh2Ym9PdXQsYmFzZUluZGV4K2kqMixiYXNlSW5kZXgraU5leHQqMixiYXNlSW5kZXgraU5leHQqMisxKTtcclxuICAgIH1cclxuICAgICovXHJcbiAgICB2YXIgZGl2cyA9IDQ7XHJcbiAgICBmb3IodmFyIGk9MDtpPG51bVB0czsrK2kpIHtcclxuICAgICAgdmFyIGlOZXh0ID0gKGkrMSklbnVtUHRzO1xyXG4gICAgICB2Ym9NZXNoLmdldFZlcnRleChwdCx2Ym9PdXQsYmFzZUluZGV4K2kqMik7XHJcbiAgICAgIHZib01lc2guZ2V0VmVydGV4KHB0Mix2Ym9PdXQsYmFzZUluZGV4K2kqMisxKTtcclxuICAgICAgdmVjMi5zdWIocGVycCxwdCxwdDIpO1xyXG4gICAgICBcclxuICAgICAgdmJvTWVzaC5hZGRUcmlhbmdsZSh2Ym9PdXQsYmFzZUluZGV4K2kqMixiYXNlSW5kZXgzK2lOZXh0KmRpdnMsYmFzZUluZGV4MytpKmRpdnMpO1xyXG4gICAgICB2Ym9NZXNoLmFkZFRyaWFuZ2xlKHZib091dCxiYXNlSW5kZXgraSoyLGJhc2VJbmRleCtpTmV4dCoyLGJhc2VJbmRleDMraU5leHQqZGl2cyk7XHJcbiAgICAgIGZvcih2YXIgaj0wO2o8ZGl2czsrK2opIHtcclxuICAgICAgICB2YXIgYW5nbGUgPSAoaisxKSpNYXRoLlBJKjAuNS8oZGl2cysxKTtcclxuICAgICAgICAvL3JlZHVuZGFudCBjb3VsZCBwcmVjb21wdXRlXHJcbiAgICAgICAgdmFyIGNvc0EgPSBNYXRoLmNvcyhhbmdsZSk7XHJcbiAgICAgICAgdmFyIHNpbkEgPSBNYXRoLnNpbihhbmdsZSk7XHJcbiAgICAgICAgdmVjMi5zY2FsZUFuZEFkZChwdCxwdDIscGVycCxjb3NBKTtcclxuICAgICAgICBwdFsyXSA9IHNpbkEqcHQyWzJdO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZib01lc2guYWRkVmVydGV4KHZib091dCxwdCk7XHJcbiAgICAgICAgaWYoajxkaXZzLTEpIHtcclxuICAgICAgICAgIHZib01lc2guYWRkVHJpYW5nbGUodmJvT3V0LGJhc2VJbmRleDMraSpkaXZzK2osYmFzZUluZGV4MytpTmV4dCpkaXZzK2orMSxiYXNlSW5kZXgzK2kqZGl2cytqKzEpO1xyXG4gICAgICAgICAgdmJvTWVzaC5hZGRUcmlhbmdsZSh2Ym9PdXQsYmFzZUluZGV4MytpKmRpdnMraixiYXNlSW5kZXgzK2lOZXh0KmRpdnMraixiYXNlSW5kZXgzK2lOZXh0KmRpdnMraisxKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICB9XHJcbiAgICAgIHZib01lc2guYWRkVHJpYW5nbGUodmJvT3V0LGJhc2VJbmRleDMraSpkaXZzK2RpdnMtMSxiYXNlSW5kZXgraU5leHQqMisxLGJhc2VJbmRleCtpKjIrMSk7XHJcbiAgICAgIHZib01lc2guYWRkVHJpYW5nbGUodmJvT3V0LGJhc2VJbmRleDMraSpkaXZzK2RpdnMtMSxiYXNlSW5kZXgzK2lOZXh0KmRpdnMrZGl2cy0xLGJhc2VJbmRleCtpTmV4dCoyKzEpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvL2NvdmVyIHRvcCBob2xlXHJcbiAgICBmb3IodmFyIGk9MDtpPG51bUxlZ3M7KytpKSB7XHJcbiAgICAgIHZib01lc2guYWRkVHJpYW5nbGUodmJvT3V0LCBiYXNlSW5kZXgyK2kqMTIrMSxiYXNlSW5kZXgyK2kqMTIrMyxiYXNlSW5kZXgyK2kqMTIrOSk7XHJcbiAgICAgIHZib01lc2guYWRkVHJpYW5nbGUodmJvT3V0LCBiYXNlSW5kZXgyK2kqMTIrMSxiYXNlSW5kZXgyK2kqMTIrOSxiYXNlSW5kZXgyK2kqMTIrMTEpO1xyXG5cclxuICAgICAgdmJvTWVzaC5hZGRUcmlhbmdsZSh2Ym9PdXQsIGJhc2VJbmRleDIraSoxMiszLGJhc2VJbmRleDIraSoxMis1LGJhc2VJbmRleDIraSoxMis3KTtcclxuICAgICAgdmJvTWVzaC5hZGRUcmlhbmdsZSh2Ym9PdXQsIGJhc2VJbmRleDIraSoxMiszLGJhc2VJbmRleDIraSoxMis3LGJhc2VJbmRleDIraSoxMis5KTtcclxuXHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vc3RpdGNoIGZhY2VzXHJcbiAgICB2YXIgZmFjZVZibyA9IGNvbm5lY3RvclRyaXNbbnVtTGVnc107XHJcbiAgICBmb3IodmFyIGk9MDtpPGZhY2VWYm8ubnVtSW5kaWNlczspIHtcclxuICAgICAgdmFyIGkxID0gZmFjZVZiby5pbmRleERhdGFbaSsrXTtcclxuICAgICAgdmFyIGkyID0gZmFjZVZiby5pbmRleERhdGFbaSsrXTtcclxuICAgICAgdmFyIGkzID0gZmFjZVZiby5pbmRleERhdGFbaSsrXTtcclxuICAgICAgdmJvTWVzaC5hZGRUcmlhbmdsZSh2Ym9PdXQsIGJhc2VJbmRleCtpMSoyLCBiYXNlSW5kZXgraTMqMiwgYmFzZUluZGV4K2kyKjIpO1xyXG4gICAgICB2Ym9NZXNoLmFkZFRyaWFuZ2xlKHZib091dCwgYmFzZUluZGV4K2kxKjIrMSwgYmFzZUluZGV4K2kyKjIrMSwgYmFzZUluZGV4K2kzKjIrMSk7ICAgICAgXHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vYWRkIGxhYmVsc1xyXG4gICAgZm9yKHZhciBpPTA7aTxudW1MZWdzOysraSkge1xyXG4gICAgICBkaXIgPSBkaXJzW2ldO1xyXG4gICAgICB2YXIgdGVucyA9IE1hdGguZmxvb3IobGFiZWxzW2ldLzEwKSUxMDtcclxuICAgICAgdmFyIG9uZXMgPSBsYWJlbHNbaV0lMTA7XHJcbiAgICAgIG1hdDQuaWRlbnRpdHkodHJhbnMpO1xyXG4gICAgICBtYXQ0LnRyYW5zbGF0ZSh0cmFucyx0cmFucyxsYWJlbHNQdFtpXSk7XHJcbiAgICAgIHZhciBhbmdsZSA9IE1hdGguYXRhbjIoLWRpclswXSxkaXJbMV0pO1xyXG4gICAgICBtYXQ0LnJvdGF0ZVoodHJhbnMsdHJhbnMsYW5nbGUpO1xyXG4gICAgICBtYXQ0LnNjYWxlKHRyYW5zLHRyYW5zLFstbGFiZWxIZWlnaHQsbGFiZWxIZWlnaHQsMV0pO1xyXG4gICAgICB2ZWMyLnNldChwZXJwLGRpclsxXSwtZGlyWzBdKTtcclxuICAgICAgXHJcbiAgICAgIHZib01lc2guYWRkTWVzaFRyYW5zZm9ybSh2Ym9PdXQsdGV4dC5udW1WYm9zW3RlbnNdLCB0cmFucyk7XHJcbiAgICAgIFxyXG4gICAgICB2ZWMyLnNjYWxlQW5kQWRkKGxhYmVsc1B0W2ldLGxhYmVsc1B0W2ldLCBwZXJwLC1sYWJlbEhlaWdodCk7XHJcbiAgICAgIG1hdDQuaWRlbnRpdHkodHJhbnMpO1xyXG4gICAgICBtYXQ0LnRyYW5zbGF0ZSh0cmFucyx0cmFucyxsYWJlbHNQdFtpXSk7XHJcbiAgICAgIG1hdDQucm90YXRlWih0cmFucyx0cmFucyxhbmdsZSk7XHJcbiAgICAgIG1hdDQuc2NhbGUodHJhbnMsdHJhbnMsWy1sYWJlbEhlaWdodCxsYWJlbEhlaWdodCwxXSk7XHJcbiAgICAgIHZib01lc2guYWRkTWVzaFRyYW5zZm9ybSh2Ym9PdXQsdGV4dC5udW1WYm9zW29uZXNdLCB0cmFucyk7XHJcbiAgICB9XHJcbiAgfVxyXG59KSgpO1xyXG5cclxudmFyIG1ha2VDb25uZWN0b3JTa2VsZXRvbiA9IChmdW5jdGlvbigpIHtcclxuICB2YXIgbWF4VmFsZW5jZSA9IDc7XHJcbiAgdmFyIGRpcnMgPSBbXTtcclxuICBmb3IodmFyIGk9MDtpPG1heFZhbGVuY2U7KytpKSB7XHJcbiAgICBkaXJzW2ldID0gdmVjMy5jcmVhdGUoKTtcclxuICB9XHJcbiAgdmFyIHB0ID0gdmVjMy5jcmVhdGUoKTtcclxuICB2YXIgcHQyID0gdmVjMy5jcmVhdGUoKTtcclxuICB2YXIgZGlyLCBuRGlyO1xyXG4gIHZhciBwZXJwID0gdmVjMy5jcmVhdGUoKTtcclxuICB2YXIgYmlzZWN0b3IgPSB2ZWMzLmNyZWF0ZSgpO1xyXG4gIHZhciBlLHN0YXJ0RTtcclxuICB2YXIgY2VudGVyID0gdmVjMy5jcmVhdGUoKTtcclxuICByZXR1cm4gZnVuY3Rpb24gbWFrZUNvbm5lY3RvclNrZWxldG9uKG51bUxlZ3MsdmJvT3V0KSB7XHJcbiAgICB2YXIgaW5kZXggPSAwO1xyXG4gICAgZm9yKHZhciBpPTA7aTxudW1MZWdzOysraSkge1xyXG4gICAgICB2YXIgYW5nbGUgPSBpL251bUxlZ3MqTWF0aC5QSSoyLjA7XHJcbiAgICAgIHZlYzIuc2V0KGRpcnNbaV0sIE1hdGguY29zKGFuZ2xlKSxNYXRoLnNpbihhbmdsZSkpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB2YXIgYmFzZUluZGV4ID0gdmJvT3V0Lm51bVZlcnRpY2VzO1xyXG4gICAgdmFyIG51bVB0cyA9IDA7XHJcbiAgICB2YXIgb3V0c2lkZVB0cyA9IFtdO1xyXG4gICAgdmFyIGlubmVyQ3J2cyA9IFtdO1xyXG4gICAgdmFyIGxhYmVsU3BhY2UgPSAxO1xyXG4gICAgZm9yKHZhciBpPTA7aTxudW1MZWdzOysraSkge1xyXG4gICAgICAvL21ha2UgcG9pbnRzXHJcbiAgICAgIGRpciA9IGRpcnNbaV07XHJcbiAgICAgIG5EaXIgPSBkaXJzWyhpKzEpJW51bUxlZ3NdO1xyXG4gICAgICB2ZWMyLnNldChwZXJwLGRpclsxXSwtZGlyWzBdKTtcclxuICAgICAgdmVjMy5zY2FsZUFuZEFkZChwdCxjZW50ZXIsIGRpciwgY29uTGVuK3NoZWxmT2Zmc2V0KTtcclxuICAgICAgdmVjMi5zY2FsZUFuZEFkZChwdCxwdCxwZXJwLHdvb2RXaWR0aCowLjUrcHJpbnRUb2xlcmFuY2UpO1xyXG4gICAgICBvdXRzaWRlUHRzLnB1c2goe3g6cHRbMF0seTpwdFsxXSxpbmRleDpudW1QdHN9KTtcclxuICAgICAgdmJvTWVzaC5hZGRWZXJ0ZXgodmJvT3V0LHB0KTtcclxuICAgICAgbnVtUHRzKys7XHJcbiAgICAgIFxyXG4gICAgICB2ZWMyLnNjYWxlQW5kQWRkKHB0LHB0LGRpciwtY29uTGVuKTtcclxuICAgICAgb3V0c2lkZVB0cy5wdXNoKHt4OnB0WzBdLHk6cHRbMV0saW5kZXg6bnVtUHRzfSk7XHJcbiAgICAgIHZib01lc2guYWRkVmVydGV4KHZib091dCxwdCk7XHJcbiAgICAgIG51bVB0cysrO1xyXG4gICAgICBcclxuICAgICAgdmVjMi5zY2FsZUFuZEFkZChwdCxwdCxwZXJwLC0od29vZFdpZHRoK3ByaW50VG9sZXJhbmNlKjIpKTtcclxuICAgICAgb3V0c2lkZVB0cy5wdXNoKHt4OnB0WzBdLHk6cHRbMV0saW5kZXg6bnVtUHRzfSk7XHJcbiAgICAgIHZib01lc2guYWRkVmVydGV4KHZib091dCxwdCk7XHJcbiAgICAgIG51bVB0cysrO1xyXG5cclxuICAgICAgXHJcbiAgICAgIC8vbWFrZSBjdXJ2ZVxyXG4gICAgICB2YXIgY3J2ID0gbnVyYnMuY3JlYXRlQ3J2KG51bGwsIDIpO1xyXG4gICAgICBcclxuICAgICAgdmVjMi5zY2FsZUFuZEFkZChwdCxwdCxkaXIsY29uTGVuKTtcclxuICAgICAgb3V0c2lkZVB0cy5wdXNoKHt4OnB0WzBdLHk6cHRbMV0saW5kZXg6bnVtUHRzfSk7XHJcbiAgICAgIHZib01lc2guYWRkVmVydGV4KHZib091dCxwdCk7XHJcbiAgICAgIG51bVB0cysrO1xyXG4gICAgICBcclxuICAgICAgbnVyYnMuYWRkUG9pbnQoY3J2LHB0KTtcclxuXHJcbiAgICAgIHZlYzIuc2NhbGVBbmRBZGQocHQscHQscGVycCwtY29uT2Zmc2V0KTtcclxuICAgICAgLy9hZGRDb25uZWN0b3JQdCh2Ym9PdXQscHQpO1xyXG4gICAgICAvL251bVB0cysrO1xyXG5cclxuICAgICAgbnVyYnMuYWRkUG9pbnQoY3J2LHB0KTtcclxuICAgICAgXHJcbiAgICAgIC8vZ2V0IG9mZnNldFxyXG4gICAgICBiaXNlY3RvclswXSA9IGRpclswXS1uRGlyWzBdO1xyXG4gICAgICBiaXNlY3RvclsxXSA9IGRpclsxXS1uRGlyWzFdO1xyXG4gICAgICB2ZWMyLm5vcm1hbGl6ZShiaXNlY3RvcixiaXNlY3Rvcik7XHJcbiAgICAgIC8vcm90YXRlIDkwXHJcbiAgICAgIHZhciB0ZW1wID0gYmlzZWN0b3JbMF07XHJcbiAgICAgIGJpc2VjdG9yWzBdID0gLWJpc2VjdG9yWzFdO1xyXG4gICAgICBiaXNlY3RvclsxXSA9IHRlbXA7XHJcbiAgICAgIHZhciBzaW5BID0gTWF0aC5hYnMoYmlzZWN0b3JbMF0qZGlyWzFdLWJpc2VjdG9yWzFdKmRpclswXSk7XHJcbiAgICAgIHZlYzMuc2NhbGVBbmRBZGQocHQsY2VudGVyLGJpc2VjdG9yLCh3b29kV2lkdGgqMC41K2Nvbk9mZnNldCkvc2luQSk7XHJcblxyXG4gICAgICBudXJicy5hZGRQb2ludChjcnYscHQpO1xyXG4gICAgICBcclxuICAgICAgLy9hZGRDb25uZWN0b3JQdCh2Ym9PdXQscHQpO1xyXG4gICAgICAvL251bVB0cysrO1xyXG4gICAgICBcclxuICAgICAgdmVjMi5zZXQocGVycCxuRGlyWzFdLC1uRGlyWzBdKTtcclxuICAgICAgdmVjMy5zY2FsZUFuZEFkZChwdCxjZW50ZXIsIG5EaXIsIGNvbkxlbitzaGVsZk9mZnNldCk7XHJcbiAgICAgIHZlYzIuc2NhbGVBbmRBZGQocHQscHQscGVycCx3b29kV2lkdGgqMC41K3ByaW50VG9sZXJhbmNlK2Nvbk9mZnNldCk7ICAgICAgXHJcbiAgICAgIFxyXG4gICAgICBudXJicy5hZGRQb2ludChjcnYscHQpO1xyXG4gICAgICB2ZWMyLnNjYWxlQW5kQWRkKHB0LHB0LHBlcnAsLWNvbk9mZnNldCk7ICAgICAgXHJcbiAgICAgIG51cmJzLmFkZFBvaW50KGNydixwdCk7XHJcbiAgICAgIFxyXG4gICAgICB2YXIgZG9tYWluID0gbnVyYnMuZG9tYWluKGNydik7XHJcbiAgICAgIGZvcih2YXIgaj0xO2o8MjA7KytqKSB7XHJcbiAgICAgICAgdmFyIHUgPSBqLzIwLjAqKGRvbWFpblsxXS1kb21haW5bMF0pK2RvbWFpblswXTtcclxuICAgICAgICBudXJicy5ldmFsdWF0ZUNydihjcnYsdSxwdCk7XHJcbiAgICAgICAgb3V0c2lkZVB0cy5wdXNoKHt4OnB0WzBdLHk6cHRbMV0saW5kZXg6bnVtUHRzfSk7XHJcbiAgICAgICAgdmJvTWVzaC5hZGRWZXJ0ZXgodmJvT3V0LHB0KTtcclxuICAgICAgICBudW1QdHMrKztcclxuICAgICAgICBcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgLy9sYWJlbEhvbGVcclxuICAgICAgXHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vaG9sZXMgICAgXHJcbiAgICBmb3IodmFyIGk9MDtpPG51bUxlZ3M7KytpKSB7XHJcbiAgICAgIC8vbWFrZSBwb2ludHNcclxuICAgICAgaW5uZXJDcnZzW2ldID0gW107XHJcbiAgICAgIGRpciA9IGRpcnNbaV07XHJcbiAgICAgIHZlYzIuc2V0KHBlcnAsZGlyWzFdLC1kaXJbMF0pO1xyXG4gICAgICB2ZWMzLnNjYWxlQW5kQWRkKHB0LGNlbnRlciwgZGlyLCBzaGVsZk9mZnNldC1sYWJlbFNwYWNlKTtcclxuICAgICAgdmVjMi5zY2FsZUFuZEFkZChwdCxwdCxwZXJwLGxhYmVsSGVpZ2h0KTtcclxuICAgICAgaW5uZXJDcnZzW2ldLnB1c2goe3g6cHRbMF0seTpwdFsxXSxpbmRleDpudW1QdHN9KTtcclxuICAgICAgdmJvTWVzaC5hZGRWZXJ0ZXgodmJvT3V0LHB0KTtcclxuICAgICAgbnVtUHRzKys7XHJcbiAgICAgIFxyXG4gICAgICB2ZWMyLnNjYWxlQW5kQWRkKHB0LHB0LHBlcnAsLWxhYmVsSGVpZ2h0KTtcclxuICAgICAgaW5uZXJDcnZzW2ldLnB1c2goe3g6cHRbMF0seTpwdFsxXSxpbmRleDpudW1QdHN9KTtcclxuICAgICAgdmJvTWVzaC5hZGRWZXJ0ZXgodmJvT3V0LHB0KTtcclxuICAgICAgbnVtUHRzKys7XHJcblxyXG4gICAgICB2ZWMyLnNjYWxlQW5kQWRkKHB0LHB0LHBlcnAsLWxhYmVsSGVpZ2h0KTtcclxuICAgICAgaW5uZXJDcnZzW2ldLnB1c2goe3g6cHRbMF0seTpwdFsxXSxpbmRleDpudW1QdHN9KTtcclxuICAgICAgdmJvTWVzaC5hZGRWZXJ0ZXgodmJvT3V0LHB0KTtcclxuICAgICAgbnVtUHRzKys7XHJcbiAgICAgIFxyXG4gICAgICB2ZWMyLnNjYWxlQW5kQWRkKHB0LHB0LGRpciwtbGFiZWxIZWlnaHQpO1xyXG4gICAgICBpbm5lckNydnNbaV0ucHVzaCh7eDpwdFswXSx5OnB0WzFdLGluZGV4Om51bVB0c30pO1xyXG4gICAgICB2Ym9NZXNoLmFkZFZlcnRleCh2Ym9PdXQscHQpO1xyXG4gICAgICBudW1QdHMrKztcclxuICAgICAgXHJcbiAgICAgIHZlYzIuc2NhbGVBbmRBZGQocHQscHQscGVycCxsYWJlbEhlaWdodCk7XHJcbiAgICAgIGlubmVyQ3J2c1tpXS5wdXNoKHt4OnB0WzBdLHk6cHRbMV0saW5kZXg6bnVtUHRzfSk7XHJcbiAgICAgIHZib01lc2guYWRkVmVydGV4KHZib091dCxwdCk7XHJcbiAgICAgIG51bVB0cysrO1xyXG5cclxuICAgICAgdmVjMi5zY2FsZUFuZEFkZChwdCxwdCxwZXJwLGxhYmVsSGVpZ2h0KTtcclxuICAgICAgaW5uZXJDcnZzW2ldLnB1c2goe3g6cHRbMF0seTpwdFsxXSxpbmRleDpudW1QdHN9KTtcclxuICAgICAgdmJvTWVzaC5hZGRWZXJ0ZXgodmJvT3V0LHB0KTtcclxuICAgICAgbnVtUHRzKys7XHJcbiAgICB9XHJcbiAgICB2YXIgdHJpYW5ndWxhdGlvbiA9IG5ldyBTd2VlcENvbnRleHQob3V0c2lkZVB0cyk7XHJcbiAgICBmb3IodmFyIGk9MDtpPGlubmVyQ3J2cy5sZW5ndGg7KytpKSB7XHJcbiAgICAgIHRyaWFuZ3VsYXRpb24uYWRkSG9sZShpbm5lckNydnNbaV0pO1xyXG4gICAgfVxyXG4gICAgdHJpYW5ndWxhdGlvbi50cmlhbmd1bGF0ZSgpO1xyXG4gICAgdmFyIHRyaWFuZ2xlcyA9IHRyaWFuZ3VsYXRpb24uZ2V0VHJpYW5nbGVzKCk7XHJcbiAgICBmb3IodmFyIGk9MDtpPHRyaWFuZ2xlcy5sZW5ndGg7KytpKSB7XHJcbiAgICAgIHZhciB0ID0gdHJpYW5nbGVzW2ldO1xyXG4gICAgICB2Ym9NZXNoLmFkZFRyaWFuZ2xlKHZib091dCx0LnBvaW50c19bMF0uaW5kZXgsdC5wb2ludHNfWzFdLmluZGV4LHQucG9pbnRzX1syXS5pbmRleCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vYWRkIGxhYmVsc1xyXG4gICAgXHJcbiAgfVxyXG59KSgpO1xyXG5cclxuZnVuY3Rpb24gYWRkQ29ubmVjdG9yUHQodmJvT3V0LHB0KSB7XHJcbiAgdmJvTWVzaC5hZGRWZXJ0ZXgodmJvT3V0LHB0KTtcclxuICBwdFsyXSA9IGNvbldpZHRoO1xyXG4gIHZib01lc2guYWRkVmVydGV4KHZib091dCxwdCk7XHJcbiAgcHRbMl0gPSAwO1xyXG59XHJcblxyXG5leHBvcnRzLmNyZWF0ZUNvbm5lY3RvciA9IGNyZWF0ZUNvbm5lY3RvcjtcclxuZXhwb3J0cy5pbml0Q29ubmVjdG9yID0gaW5pdENvbm5lY3RvcjtcclxuZXhwb3J0cy5zaGVsZk9mZnNldCA9IHNoZWxmT2Zmc2V0OyIsInZhciBnbDtcbnZhciBleHQgPSBudWxsO1xuZnVuY3Rpb24gaW5pdEdMKGNhbnZhcywgZHJhd0J1ZmZlcikge1xuICBkcmF3QnVmZmVyID0gZHJhd0J1ZmZlciA/IGRyYXdCdWZmZXIgOiBmYWxzZTtcbiAgICB0cnkge1xuICAgICAgICBnbCA9IGNhbnZhcy5nZXRDb250ZXh0KFwid2ViZ2xcIix7cHJlc2VydmVEcmF3aW5nQnVmZmVyOiBkcmF3QnVmZmVyfSk7XG4gICAgICAgIGdsLnZpZXdwb3J0V2lkdGggPSBjYW52YXMud2lkdGg7XG4gICAgICAgIGdsLnZpZXdwb3J0SGVpZ2h0ID0gY2FudmFzLmhlaWdodDtcbiAgICAgICAgZXh0ID0gZ2wuZ2V0RXh0ZW5zaW9uKFwiT0VTX2VsZW1lbnRfaW5kZXhfdWludFwiKTtcbiAgICAgICAgcmV0dXJuIGdsO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICB9XG4gICAgaWYgKCFnbCkge1xuICAgICAgICAvL2FsZXJ0KFwiQ291bGQgbm90IGluaXRpYWxpc2UgV2ViR0wsIHNvcnJ5IDotKFwiKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn1cblxuLypcbnBhc3MgY3ViZSBtYXAgb2JqZWN0XG5jdWJlbWFwIGhhcyBhbiBhcnJheSBvZiBzaXggY3ViZUltYWdlc1xuKi9cblxuZnVuY3Rpb24gaW5pdEN1YmVUZXh0dXJlKGN1YmVNYXBPYmopIHtcbiAgICBjdWJlTWFwT2JqLnRleHR1cmUgPSBnbC5jcmVhdGVUZXh0dXJlKCk7XG4gICAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV9DVUJFX01BUCwgY3ViZU1hcE9iai50ZXh0dXJlKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfQ1VCRV9NQVAsIGdsLlRFWFRVUkVfTUlOX0ZJTFRFUiwgZ2wuTkVBUkVTVCk7XG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFX0NVQkVfTUFQLCBnbC5URVhUVVJFX01BR19GSUxURVIsIGdsLk5FQVJFU1QpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV9DVUJFX01BUCwgZ2wuVEVYVFVSRV9XUkFQX1QsIGdsLkNMQU1QX1RPX0VER0UpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV9DVUJFX01BUCwgZ2wuVEVYVFVSRV9XUkFQX1MsIGdsLkNMQU1QX1RPX0VER0UpO1xuXG4gICAgZ2wudGV4SW1hZ2UyRChnbC5URVhUVVJFX0NVQkVfTUFQX1BPU0lUSVZFX1gsIDAsIGdsLlJHQiwgZ2wuUkdCLCBnbC5VTlNJR05FRF9CWVRFLCBjdWJlTWFwT2JqLmN1YmVJbWFnZXNbMF0pO1xuICAgIGdsLnRleEltYWdlMkQoZ2wuVEVYVFVSRV9DVUJFX01BUF9ORUdBVElWRV9YLCAwLCBnbC5SR0IsIGdsLlJHQiwgZ2wuVU5TSUdORURfQllURSwgY3ViZU1hcE9iai5jdWJlSW1hZ2VzWzFdKTtcbiAgICBnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfQ1VCRV9NQVBfUE9TSVRJVkVfWSwgMCwgZ2wuUkdCLCBnbC5SR0IsIGdsLlVOU0lHTkVEX0JZVEUsIGN1YmVNYXBPYmouY3ViZUltYWdlc1syXSk7XG4gICAgZ2wudGV4SW1hZ2UyRChnbC5URVhUVVJFX0NVQkVfTUFQX05FR0FUSVZFX1ksIDAsIGdsLlJHQiwgZ2wuUkdCLCBnbC5VTlNJR05FRF9CWVRFLCBjdWJlTWFwT2JqLmN1YmVJbWFnZXNbM10pO1xuICAgIGdsLnRleEltYWdlMkQoZ2wuVEVYVFVSRV9DVUJFX01BUF9QT1NJVElWRV9aLCAwLCBnbC5SR0IsIGdsLlJHQiwgZ2wuVU5TSUdORURfQllURSwgY3ViZU1hcE9iai5jdWJlSW1hZ2VzWzRdKTtcbiAgICBnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfQ1VCRV9NQVBfTkVHQVRJVkVfWiwgMCwgZ2wuUkdCLCBnbC5SR0IsIGdsLlVOU0lHTkVEX0JZVEUsIGN1YmVNYXBPYmouY3ViZUltYWdlc1s1XSk7XG59XG5cbmV4cG9ydHMuaW5pdCA9IGluaXRHTDtcbmV4cG9ydHMuaW5pdEN1YmVUZXh0dXJlID0gaW5pdEN1YmVUZXh0dXJlOyIsIlwidXNlIHN0cmljdFwiXHJcblxyXG52YXIgZ2xTaGFkZXIgPSByZXF1aXJlKCcuLi9qcy9nbFNoYWRlci5qcycpO1xyXG52YXIgZ2xNYXRyaXggPSByZXF1aXJlKCcuLi9qcy9nbC1tYXRyaXgtbWluLmpzJyk7XHJcbnZhciBwb2x5MnRyaSA9IHJlcXVpcmUoJy4vcG9seTJ0cmkuanMnKTtcclxudmFyIGdsVXRpbHMgPSByZXF1aXJlKCcuL2dsVXRpbHMuanMnKTtcclxudmFyIHZvcm9ub2kgPSByZXF1aXJlKCcuL3Zvcm9ub2kuanMnKTtcclxudmFyIHZib01lc2ggPSByZXF1aXJlKCcuL3Zib01lc2guanMnKTtcclxudmFyIGNvbm5lY3RvciA9IHJlcXVpcmUoJy4vY29ubmVjdG9yLmpzJyk7XHJcbnZhciBwb2ludGVyID0gcmVxdWlyZSgnLi4vanMvcG9pbnRlci5qcycpO1xyXG52YXIgdmVjMiA9IGdsTWF0cml4LnZlYzI7XHJcbnZhciB2ZWMzID0gZ2xNYXRyaXgudmVjMztcclxudmFyIG1hdDQgPSBnbE1hdHJpeC5tYXQ0O1xyXG52YXIgbWF0MyA9IGdsTWF0cml4Lm1hdDQ7XHJcblxyXG52YXIgY2FudmFzO1xyXG52YXIgY2FudmFzMmQ7XHJcbnZhciBjdHg7XHJcbnZhciBnbDtcclxudmFyIGNvbG9yU2hhZGVyO1xyXG52YXIgdm9yb25vaUVkZ2VzO1xyXG52YXIgbXZNYXRyaXggPSBtYXQ0LmNyZWF0ZSgpO1xyXG52YXIgcE1hdHJpeCA9IG1hdDQuY3JlYXRlKCk7XHJcbnZhciBuTWF0cml4ID0gbWF0My5jcmVhdGUoKTtcclxudmFyIGNvbm5lY3RvclZibztcclxuXHJcbnZhciBzaGVsZldpZHRoID0gMTIwMDtcclxudmFyIHNoZWxmSGVpZ2h0ID0gMTgwMDtcclxuXHJcbnZhciBtaW5pbXVtU2hlbGYgPSA4NTsvLzEwNTtcclxudmFyIHNlbGVjdGVkUHQgPSAtMTtcclxuXHJcbmZ1bmN0aW9uIGluaXQoKSB7XHJcbi8vc3R1cGlkXHJcblx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggXCJrZXlkb3duXCIsa2V5UHJlc3MsZmFsc2UpO1xyXG5cclxuICBjYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImdsXCIpO1xyXG4gIGNhbnZhczJkID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCIyZFwiKTtcclxuICBwb2ludGVyLnNldHVwTW91c2VFdmVudHMoY2FudmFzMmQpO1xyXG4gIGN0eCA9IGNhbnZhczJkLmdldENvbnRleHQoJzJkJyk7XHJcbiAgZ2wgPSBnbFV0aWxzLmluaXQoY2FudmFzKTtcclxuICBjb2xvclNoYWRlciA9IGdsU2hhZGVyLmxvYWRTaGFkZXIoZ2wsXCIuLi9zaGFkZXJzL3NpbXBsZUNvbG9yLnZlcnRcIixcIi4uL3NoYWRlcnMvc2ltcGxlQ29sb3IuZnJhZ1wiKTtcclxuICB2Ym9NZXNoLnNldEdMKGdsKTtcclxuICBpbml0Vm9yb25vaSgpO1xyXG4gIGNvbm5lY3Rvci5pbml0Q29ubmVjdG9yKGdsKTtcclxuICBcclxuICB2b3Jvbm9pRWRnZXMgPSB2Ym9NZXNoLmNyZWF0ZSgpO1xyXG4gIGNvbm5lY3RvclZibyA9IHZib01lc2guY3JlYXRlMzIoKTtcclxuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoc3RlcCk7XHJcbn1cclxuXHJcbmluaXQoKTtcclxuXHJcblxyXG5mdW5jdGlvbiBzdGVwKCkge1xyXG4gIHJlcXVlc3RBbmltYXRpb25GcmFtZShzdGVwKTtcclxuICBjaGVja0hvdmVyKCk7XHJcbiAgZHJhZ0hvdmVyKCk7XHJcbiAgdmJvTWVzaC5jbGVhcihjb25uZWN0b3JWYm8pO1xyXG4gIHZvcm9ub2kudm9yb25vaSgpO1xyXG4gIHZvcm9ub2kuY2VudHJvaWRhbCgpO1xyXG4gIGZpeFNoZWx2ZXMoKTtcclxuICBmaXhTaGVsdmVzKCk7XHJcbiAgZml4U2hlbHZlcygpO1xyXG4gIGZpeFNoZWx2ZXMoKTtcclxuICBnZXRDb25uZWN0b3JzKCk7XHJcbiAgZHJhdygpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBkcmF3KCkge1xyXG4gIGRyYXcyZCgpO1xyXG4gIGRyYXczZCgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBkcmF3MmQoKSB7XHJcbiAgY3R4LmNsZWFyUmVjdCgwLDAsY2FudmFzLm9mZnNldFdpZHRoLGNhbnZhcy5vZmZzZXRIZWlnaHQpO1xyXG4gIHZhciBzY2FsaW5nID0gTWF0aC5taW4oY2FudmFzLm9mZnNldFdpZHRoL3NoZWxmV2lkdGgsY2FudmFzLm9mZnNldEhlaWdodC9zaGVsZkhlaWdodCk7XHJcbiAgY3R4LnNhdmUoKTtcclxuICBjdHguc2NhbGUoc2NhbGluZyxzY2FsaW5nKTtcclxuICBkcmF3Q2VsbHMyZCgpO1xyXG4gIC8vZHJhd0VkZ2VzMmQoKTtcclxuICAvL2RyYXdUcmlhbmdsZXMyZCgpO1xyXG4gIGRyYXdOb2RlczJkKCk7XHJcbiAgY3R4LnJlc3RvcmUoKTtcclxuICBcclxufVxyXG5cclxuZnVuY3Rpb24gZHJhd0VkZ2VzMmQoKSB7XHJcbiAgXHJcbiAgY3R4LnN0cm9rZVN0eWxlID0gXCJibGFja1wiO1xyXG4gIGN0eC5iZWdpblBhdGgoKTtcclxuICBmb3IodmFyIGk9MDtpPHZvcm9ub2kudHJpYW5nbGVzLmxlbmd0aDsrK2kpIHtcclxuICAgIHZhciB0cmkgPSB2b3Jvbm9pLnRyaWFuZ2xlc1tpXTtcclxuICAgIGlmKHRyaS5pbnRlcmlvcl8pIHtcclxuICAgICAgaWYodHJpLm5laWdoYm9yc19bMF0gJiYgdHJpLm5laWdoYm9yc19bMF0uaW50ZXJpb3JfKSB7XHJcbiAgICAgICAgY3R4Lm1vdmVUbyh0cmkuY2lyY3VtY2VudGVyWzBdLHRyaS5jaXJjdW1jZW50ZXJbMV0pO1xyXG4gICAgICAgIGN0eC5saW5lVG8odHJpLm5laWdoYm9yc19bMF0uY2lyY3VtY2VudGVyWzBdLHRyaS5uZWlnaGJvcnNfWzBdLmNpcmN1bWNlbnRlclsxXSk7XHJcbiAgICAgIH1cclxuICAgICAgaWYodHJpLm5laWdoYm9yc19bMV0gJiYgdHJpLm5laWdoYm9yc19bMV0uaW50ZXJpb3JfKSB7XHJcbiAgICAgICAgY3R4Lm1vdmVUbyh0cmkuY2lyY3VtY2VudGVyWzBdLHRyaS5jaXJjdW1jZW50ZXJbMV0pO1xyXG4gICAgICAgIGN0eC5saW5lVG8odHJpLm5laWdoYm9yc19bMV0uY2lyY3VtY2VudGVyWzBdLHRyaS5uZWlnaGJvcnNfWzFdLmNpcmN1bWNlbnRlclsxXSk7ICAgICAgICBcclxuICAgICAgfVxyXG4gICAgICBpZih0cmkubmVpZ2hib3JzX1syXSAmJiB0cmkubmVpZ2hib3JzX1syXS5pbnRlcmlvcl8pIHtcclxuICAgICAgICBjdHgubW92ZVRvKHRyaS5jaXJjdW1jZW50ZXJbMF0sdHJpLmNpcmN1bWNlbnRlclsxXSk7XHJcbiAgICAgICAgY3R4LmxpbmVUbyh0cmkubmVpZ2hib3JzX1syXS5jaXJjdW1jZW50ZXJbMF0sdHJpLm5laWdoYm9yc19bMl0uY2lyY3VtY2VudGVyWzFdKTsgICAgICAgIFxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG4gIGN0eC5zdHJva2UoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gZHJhd1RyaWFuZ2xlczJkKCkge1xyXG4gIFxyXG4gIGN0eC5zdHJva2VTdHlsZSA9IFwiYmxhY2tcIjtcclxuICBmb3IodmFyIGk9MDtpPHZvcm9ub2kudHJpYW5nbGVzLmxlbmd0aDsrK2kpIHtcclxuICBjdHguYmVnaW5QYXRoKCk7XHJcbiAgICB2YXIgdHJpID0gdm9yb25vaS50cmlhbmdsZXNbaV07XHJcbiAgICBpZih0cmkubmV3MSkgICBjdHguc3Ryb2tlU3R5bGUgPSBcInJlZFwiO1xyXG4gICAgZWxzZSBpZih0cmkubmV3MikgICBjdHguc3Ryb2tlU3R5bGUgPSBcImdyZWVuXCI7XHJcbiAgICBlbHNlIGN0eC5zdHJva2VTdHlsZSA9IFwiYmxhY2tcIjtcclxuICAgIFxyXG4gICAgY3R4Lm1vdmVUbyh0cmkucG9pbnRzX1swXS54LHRyaS5wb2ludHNfWzBdLnkpO1xyXG4gICAgY3R4LmxpbmVUbyh0cmkucG9pbnRzX1sxXS54LHRyaS5wb2ludHNfWzFdLnkpO1xyXG4gICAgY3R4LmxpbmVUbyh0cmkucG9pbnRzX1syXS54LHRyaS5wb2ludHNfWzJdLnkpO1xyXG4gICAgY3R4LmxpbmVUbyh0cmkucG9pbnRzX1swXS54LHRyaS5wb2ludHNfWzBdLnkpO1xyXG5cclxuICBjdHguc3Ryb2tlKCk7XHJcbiAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBkcmF3Q2VsbHMyZCgpIHtcclxuICBcclxuICBjdHguc3Ryb2tlU3R5bGUgPSBcImJsYWNrXCI7XHJcbiAgLypcclxuICB2YXIgdjtcclxuICBmb3IodmFyIGk9MDtpPHZvcm9ub2kucHRzLmxlbmd0aDsrK2kpIHtcclxuICAgIHZhciBwdCA9IHZvcm9ub2kucHRzW2ldO1xyXG4gICAgY3R4LmJlZ2luUGF0aCgpO1xyXG4gICAgdiA9IHB0LmNlbGxbMF07XHJcbiAgICBjdHgubW92ZVRvKHZbMF0sdlsxXSk7XHJcbiAgICBmb3IodmFyIGo9MTtqPHB0LmNlbGwubGVuZ3RoOysraikge1xyXG4gICAgICB2ID0gcHQuY2VsbFtqXTtcclxuICAgICAgY3R4LmxpbmVUbyh2WzBdLHZbMV0pO1xyXG4gICAgfVxyXG4gICAgY3R4LmNsb3NlUGF0aCgpO1xyXG4gICAgY3R4LnN0cm9rZSgpO1xyXG4gIH1cclxuICAqL1xyXG4gIGZvcih2YXIgaT0wO2k8dm9yb25vaS5tZXNoLmZhY2VzLmxlbmd0aDsrK2kpIHtcclxuICAgIHZhciBmID0gdm9yb25vaS5tZXNoLmZhY2VzW2ldO1xyXG4gICAgaWYoZi5vbikge1xyXG4gICAgICB2YXIgZSA9IGYuZTtcclxuICAgICAgdmFyIHN0YXJ0RSA9IGU7XHJcbiAgICAgIGN0eC5iZWdpblBhdGgoKTtcclxuICAgICAgXHJcbiAgICAgIGN0eC5tb3ZlVG8oZS52LnBvc1swXSxlLnYucG9zWzFdKTtcclxuICAgICAgZSA9IGUubmV4dDtcclxuICAgICAgZG8ge1xyXG4gICAgICAgIGN0eC5saW5lVG8oZS52LnBvc1swXSxlLnYucG9zWzFdKTtcclxuICAgICAgICBlID0gZS5uZXh0O1xyXG4gICAgICB9IHdoaWxlKGUgIT0gc3RhcnRFKTtcclxuICAgICAgY3R4LmNsb3NlUGF0aCgpO1xyXG4gICAgICBjdHguc3Ryb2tlKCk7XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBkcmF3Tm9kZXMyZCgpIHtcclxuICBjdHguZmlsbFN0eWxlID0gXCJibGFja1wiO1xyXG4gIGZvcih2YXIgaT0wO2k8dm9yb25vaS5wdHMubGVuZ3RoOysraSkge1xyXG4gICAgdmFyIHB0ID0gdm9yb25vaS5wdHNbaV07XHJcbiAgICBpZihzZWxlY3RlZFB0ID09IGkpIHtcclxuICAgICAgY3R4LmZpbGxTdHlsZSA9IFwicmVkXCI7XHJcbiAgICB9IGVsc2UgaWYocHQuYm91bmRhcnkpIHtcclxuICAgICAgY3R4LmZpbGxTdHlsZSA9IFwiYmx1ZVwiOyAgICAgICAgXHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBjdHguZmlsbFN0eWxlID0gXCJibGFja1wiOyAgICBcclxuICAgIH1cclxuICAgIGN0eC5iZWdpblBhdGgoKTtcclxuICAgIGN0eC5hcmMocHQueCxwdC55LDUsMCwyKk1hdGguUEkpO1xyXG4gICAgY3R4LmZpbGwoKTtcclxuICAgIFxyXG4gIH1cclxuICBcclxufVxyXG5cclxuZnVuY3Rpb24gZHJhdzNkKCkge1xyXG4gIGdsLmNsZWFyKGdsLkNPTE9SX0JVRkZFUl9CSVQgfCBnbC5ERVBUSF9CVUZGRVJfQklUKTtcclxuICBpZighY29sb3JTaGFkZXIuaXNSZWFkeSkgcmV0dXJuO1xyXG4gIFxyXG4gIGNvbG9yU2hhZGVyLmJlZ2luKCk7XHJcbiAgbWF0NC5pZGVudGl0eShtdk1hdHJpeCk7XHJcbiAgbWF0NC5vcnRobyhwTWF0cml4LC01MDAsMjAwMCwyMDAwLC01MDAsLTEwLDEwMCk7XHJcbiAgXHJcbiAgLy9zZXQgY29sb3JcclxuICBjb2xvclNoYWRlci51bmlmb3Jtcy5tYXRDb2xvci5zZXQoWzAsMCwwLDFdKTtcclxuICAvL3NldCBtYXRyaWNlc1xyXG4gIGNvbG9yU2hhZGVyLnVuaWZvcm1zLm12TWF0cml4LnNldChtdk1hdHJpeCk7XHJcbiAgY29sb3JTaGFkZXIudW5pZm9ybXMucE1hdHJpeC5zZXQocE1hdHJpeCk7XHJcbiAgXHJcbiAgLy9tYWtlIHZvcm9ub2kgZWRnZXMgdmJvXHJcbiAgdm9yb25vaVRvRWRnZVZCTygpO1xyXG4gIFxyXG4gIC8vZHJhdyBlZGdlcyB2Ym9cclxuICBjb2xvclNoYWRlci5hdHRyaWJzLnZlcnRleFBvc2l0aW9uLnNldCh2b3Jvbm9pRWRnZXMudmVydGV4QnVmZmVyKTtcclxuICBnbC5kcmF3QXJyYXlzKGdsLkxJTkVTLCAwLHZvcm9ub2lFZGdlcy5udW1WZXJ0aWNlcyk7XHJcblxyXG4gIC8vZHJhdyBjb25uZWN0b3JzXHJcbiAgY29sb3JTaGFkZXIuYXR0cmlicy52ZXJ0ZXhQb3NpdGlvbi5zZXQoY29ubmVjdG9yVmJvLnZlcnRleEJ1ZmZlcik7XHJcbiAgZ2wuYmluZEJ1ZmZlcihnbC5FTEVNRU5UX0FSUkFZX0JVRkZFUixjb25uZWN0b3JWYm8uaW5kZXhCdWZmZXIpO1xyXG4gIGdsLmRyYXdFbGVtZW50cyhnbC5UUklBTkdMRVMsY29ubmVjdG9yVmJvLm51bUluZGljZXMsZ2wuVU5TSUdORURfSU5ULDApO1xyXG4gIFxyXG4gIGNvbG9yU2hhZGVyLmVuZCgpO1xyXG59XHJcblxyXG4vL3B1dCB2b3Jvbm9pIGVkZ2VzIGludG8gYSB2Ym9cclxuZnVuY3Rpb24gdm9yb25vaVRvRWRnZVZCTygpIHtcclxuICB2Ym9NZXNoLmNsZWFyKHZvcm9ub2lFZGdlcyk7XHJcbiAgZm9yKHZhciBpPTA7aTx2b3Jvbm9pLnRyaWFuZ2xlcy5sZW5ndGg7KytpKSB7XHJcbiAgICB2YXIgdHJpID0gdm9yb25vaS50cmlhbmdsZXNbaV07XHJcbiAgICBpZihmYWxzZSB8fCB0cmkuaW50ZXJpb3JfKSB7XHJcbiAgICAgIGlmKHRyaS5uZWlnaGJvcnNfWzBdICYmIChmYWxzZSB8fCB0cmkubmVpZ2hib3JzX1swXS5pbnRlcmlvcl8pKSB7XHJcbiAgICAgICAgdmJvTWVzaC5hZGRWZXJ0ZXgodm9yb25vaUVkZ2VzLHRyaS5jaXJjdW1jZW50ZXIpO1xyXG4gICAgICAgIHZib01lc2guYWRkVmVydGV4KHZvcm9ub2lFZGdlcyx0cmkubmVpZ2hib3JzX1swXS5jaXJjdW1jZW50ZXIpO1xyXG4gICAgICB9XHJcbiAgICAgIGlmKHRyaS5uZWlnaGJvcnNfWzFdICYmIChmYWxzZSB8fCB0cmkubmVpZ2hib3JzX1sxXS5pbnRlcmlvcl8pKSB7XHJcbiAgICAgICAgdmJvTWVzaC5hZGRWZXJ0ZXgodm9yb25vaUVkZ2VzLHRyaS5jaXJjdW1jZW50ZXIpO1xyXG4gICAgICAgIHZib01lc2guYWRkVmVydGV4KHZvcm9ub2lFZGdlcyx0cmkubmVpZ2hib3JzX1sxXS5jaXJjdW1jZW50ZXIpO1xyXG4gICAgICB9XHJcbiAgICAgIGlmKHRyaS5uZWlnaGJvcnNfWzJdICYmIChmYWxzZSB8fCB0cmkubmVpZ2hib3JzX1syXS5pbnRlcmlvcl8pKSB7XHJcbiAgICAgICAgdmJvTWVzaC5hZGRWZXJ0ZXgodm9yb25vaUVkZ2VzLHRyaS5jaXJjdW1jZW50ZXIpO1xyXG4gICAgICAgIHZib01lc2guYWRkVmVydGV4KHZvcm9ub2lFZGdlcyx0cmkubmVpZ2hib3JzX1syXS5jaXJjdW1jZW50ZXIpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG4gIHZib01lc2guYnVmZmVyKHZvcm9ub2lFZGdlcyk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldENvbm5lY3RvcnMoKSB7XHJcbiAgLy9mb3IodmFyIGk9MDtpPHZvcm9ub2kudHJpYW5nbGVzLmxlbmd0aDsrK2kpIHtcclxuICAvLyAgdmFyIHRyaSA9IHZvcm9ub2kudHJpYW5nbGVzW2ldO1xyXG4gIC8vICBpZih0cmkuaW50ZXJpb3JfKSB7XHJcbiAgLy8gICAgaWYodHJpLm5laWdoYm9yc19bMF0gJiYgdHJpLm5laWdoYm9yc19bMF0uaW50ZXJpb3JfICYmXHJcbiAgLy8gICAgICB0cmkubmVpZ2hib3JzX1sxXSAmJiB0cmkubmVpZ2hib3JzX1sxXS5pbnRlcmlvcl8gJiZcclxuICAvLyAgICAgIHRyaS5uZWlnaGJvcnNfWzJdICYmIHRyaS5uZWlnaGJvcnNfWzJdLmludGVyaW9yXykge1xyXG4gIC8vICAgICAgY29ubmVjdG9yLmNyZWF0ZUNvbm5lY3Rvcih0cmksY29ubmVjdG9yVmJvKTtcclxuICAvLyAgICB9XHJcbiAgLy8gIH1cclxuICAvL31cclxuICAvL2xhYmVsIGVkZ2VzXHJcbiAgdmFyIGxhYmVsID0gMDtcclxuICBmb3IodmFyIGk9MDtpPHZvcm9ub2kubWVzaC5lZGdlcy5sZW5ndGg7KytpKSB7XHJcbiAgICB2YXIgZSA9IHZvcm9ub2kubWVzaC5lZGdlc1tpXTtcclxuICAgIGlmKGUudi5lKSB7XHJcbiAgICAgIGlmKHR5cGVvZiBlLmluZm8ubGFiZWwgPT0gXCJ1bmRlZmluZWRcIikge1xyXG4gICAgICAgIGUuaW5mby5sYWJlbCA9IGxhYmVsKys7XHJcbiAgICAgICAgZS5wYWlyLmluZm8ubGFiZWwgPSBlLmluZm8ubGFiZWw7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcbiAgXHJcbiAgZm9yKHZhciBpPTA7aTx2b3Jvbm9pLm1lc2gudmVydGljZXMubGVuZ3RoOysraSkge1xyXG4gICAgdmFyIHYgPSB2b3Jvbm9pLm1lc2gudmVydGljZXNbaV07XHJcbiAgICBpZih2LmUpIHtcclxuICAgICAgY29ubmVjdG9yLmNyZWF0ZUNvbm5lY3Rvcih2LGNvbm5lY3RvclZibyk7XHJcbiAgICB9XHJcbiAgfVxyXG4gIHZib01lc2guYnVmZmVyKGNvbm5lY3RvclZibyk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGZpeFNoZWx2ZXMoKSB7XHJcbiAgdmFyIGRpciA9IHZlYzIuY3JlYXRlKCk7XHJcbiAgZm9yKHZhciBpPTA7aTx2b3Jvbm9pLm1lc2guZWRnZXMubGVuZ3RoOysraSkge1xyXG4gICAgdmFyIGUgPSB2b3Jvbm9pLm1lc2guZWRnZXNbaV07XHJcbiAgICBpZihlLnYuZSAhPSBudWxsKSB7XHJcbiAgICAgIHZhciB2MSA9IGUudjtcclxuICAgICAgdmFyIHYyID0gZS5wYWlyLnY7XHJcbiAgICAgIC8vY2hlY2sgbGVuZ3RoO1xyXG4gICAgICB2YXIgbGVuID0gdmVjMi5zcXJEaXN0KHYxLnBvcyx2Mi5wb3MpO1xyXG4gICAgICAvL2NvbGxhcHNlIGVkZ2VcclxuICAgICAgaWYobGVuIDwgbWluaW11bVNoZWxmKm1pbmltdW1TaGVsZiowLjA0KSB7XHJcbiAgICAgICAgdm9yb25vaS5tZXNoLnNpbXBsZUNvbGxhcHNlKGUpO1xyXG4gICAgICAgIC8vaS0tO1xyXG4gICAgICAvL2V4cGFuZFxyXG4gICAgICB9IGVsc2UgaWYobGVuIDwgbWluaW11bVNoZWxmKm1pbmltdW1TaGVsZiouOTUpIHtcclxuICAgICAgICB2ZWMyLnN1YihkaXIsIHYyLnBvcywgdjEucG9zKTtcclxuICAgICAgICAvL3ZlYzIubm9ybWFsaXplKGRpcixkaXIpO1xyXG4gICAgICAgIGxlbiA9IE1hdGguc3FydChsZW4pO1xyXG4gICAgICAgIHZlYzIuc2NhbGUoZGlyLCBkaXIsIChtaW5pbXVtU2hlbGYtbGVuKSowLjUvbGVuKTtcclxuICAgICAgICBpZighdjIuYikge1xyXG4gICAgICAgICAgdmVjMi5zY2FsZUFuZEFkZCh2Mi5wb3MsdjIucG9zLGRpciwuNSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmKCF2MS5iKSB7XHJcbiAgICAgICAgICB2ZWMyLnNjYWxlQW5kQWRkKHYxLnBvcyx2MS5wb3MsZGlyLC0uNSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBpbml0Vm9yb25vaSgpIHtcclxuICB2b3Jvbm9pLnNldERpbWVuc2lvbnMoc2hlbGZXaWR0aCxzaGVsZkhlaWdodCk7XHJcbiAgdm9yb25vaS5pbml0KCk7XHJcbiAgdm9yb25vaS5yZXNldCgpO1xyXG4gIHZvcm9ub2kudm9yb25vaSgpO1xyXG59XHJcblxyXG5cclxuZnVuY3Rpb24ga2V5UHJlc3MoZXZlbnQpIHtcclxuICBzd2l0Y2goZXZlbnQud2hpY2gpIHtcclxuICAgIGNhc2UgXCJEXCIuY2hhckNvZGVBdCgwKTpcclxuICAgICAgZG93bmxvYWQoKTtcclxuICAgICAgYnJlYWs7XHJcbiAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBkb3dubG9hZCgpIHtcclxuICB2YXIgbGVuU3RyID0gXCJcIjtcclxuICB2YXIgbGVucyA9IFtdO1xyXG4gIHZhciBhY2N1cmFjeSA9IDMuMTc1O1xyXG4gIGZvcih2YXIgaT0wO2k8dm9yb25vaS5tZXNoLmVkZ2VzLmxlbmd0aDsrK2kpIHtcclxuICAgIHZhciBlID0gdm9yb25vaS5tZXNoLmVkZ2VzW2ldO1xyXG4gICAgaWYoZS52LmUpIHtcclxuICAgICAgdmFyIGxlbiA9IHZlYzIuZGlzdChlLnYucG9zLGUucGFpci52LnBvcyktY29ubmVjdG9yLnNoZWxmT2Zmc2V0KjI7XHJcbiAgICAgIGxlbiAvPSBhY2N1cmFjeTtcclxuICAgICAgbGVuID0gTWF0aC5mbG9vcihsZW4pO1xyXG4gICAgICBsZW4gKj0gYWNjdXJhY3k7XHJcbiAgICAgIGxlbnNbZS5pbmZvLmxhYmVsXSA9IGxlbjtcclxuICAgIH1cclxuICB9XHJcbiAgZm9yKHZhciBpPTA7aTxsZW5zLmxlbmd0aDsrK2kpIHtcclxuICAgIGlmKGxlbnNbaV0pIHtcclxuICAgICAgbGVuU3RyICs9IGkgKyBcIiBcIiArIChsZW5zW2ldLzI1LjQpLnRvRml4ZWQoMykgKyBcIlxcblwiO1xyXG4gICAgfVxyXG4gIH1cclxuICBcclxuICB2YXIgYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcclxuICB2YXIgYmxvYiA9IG5ldyBCbG9iKFtsZW5TdHJdKTtcclxuICBhLmhyZWYgPSB3aW5kb3cuVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcclxuICBhLmRvd25sb2FkID0gXCJsZW5ndGhzXCIrbmV3IERhdGUoKS50b0lTT1N0cmluZygpLnN1YnN0cmluZygwLDE2KStcIi50eHRcIjtcclxuICBhLmNsaWNrKCk7XHJcbiAgXHJcbiAgZG93bmxvYWRWYm9Bc1NUTChjb25uZWN0b3JWYm8pO1xyXG59XHJcbmZ1bmN0aW9uIHNjcmVlblRvUmVhbCh4LHksb3V0KSB7XHJcbiAgdmFyIHNjYWxpbmcgPSBNYXRoLm1pbihjYW52YXMub2Zmc2V0V2lkdGgvc2hlbGZXaWR0aCxjYW52YXMub2Zmc2V0SGVpZ2h0L3NoZWxmSGVpZ2h0KTtcclxuICBvdXRbMF0gPSB4L3NjYWxpbmc7XHJcbiAgb3V0WzFdID0geS9zY2FsaW5nO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZWFsVG9TY3JlZW4oeCx5LG91dCkge1xyXG4gIHZhciBzY2FsaW5nID0gTWF0aC5taW4oY2FudmFzLm9mZnNldFdpZHRoL3NoZWxmV2lkdGgsY2FudmFzLm9mZnNldEhlaWdodC9zaGVsZkhlaWdodCk7XHJcbiAgb3V0WzBdID0geCpzY2FsaW5nO1xyXG4gIG91dFsxXSA9IHkqc2NhbGluZztcclxufVxyXG5cclxuLy9wb2ludGVyLm1vdXNlTW92ZWQgPSBjaGVja0hvdmVyO1xyXG5cclxudmFyIGRyYWdIb3ZlciA9IChmdW5jdGlvbigpIHtcclxuICB2YXIgY29vcmQgPSB2ZWMyLmNyZWF0ZSgpO1xyXG4gIHJldHVybiBmdW5jdGlvbiBkcmFnSG92ZXIoKSB7XHJcbiAgICBpZihwb2ludGVyLmlzTW91c2VEb3duICYmIHNlbGVjdGVkUHQgPiAtMSkge1xyXG4gICAgICB2YXIgcHQgPSB2b3Jvbm9pLnB0c1tzZWxlY3RlZFB0XTtcclxuICAgICAgc2NyZWVuVG9SZWFsKHBvaW50ZXIubW91c2VYLHBvaW50ZXIubW91c2VZLGNvb3JkKTtcclxuICAgICAgcHQueCA9IGNvb3JkWzBdO1xyXG4gICAgICBwdC55ID0gY29vcmRbMV07XHJcbiAgICB9XHJcbiAgfVxyXG4gIFxyXG59KSgpO1xyXG5cclxudmFyIGNoZWNrSG92ZXIgPSAoZnVuY3Rpb24oKSB7XHJcbiAgdmFyIGNvb3JkID0gdmVjMi5jcmVhdGUoKTtcclxuICByZXR1cm4gZnVuY3Rpb24gY2hlY2tIb3ZlcigpIHtcclxuICAgIGlmKCFwb2ludGVyLmlzTW91c2VEb3duKSB7XHJcbiAgICAgIHNlbGVjdGVkUHQgPSAtMTtcclxuICAgICAgZm9yKHZhciBpPTA7aTx2b3Jvbm9pLnB0cy5sZW5ndGg7KytpKSB7XHJcbiAgICAgICAgdmFyIHB0ID0gdm9yb25vaS5wdHNbaV07XHJcbiAgICAgICAgcmVhbFRvU2NyZWVuKHB0LngscHQueSxjb29yZCk7XHJcbiAgICAgICAgdmFyIGR4ID0gcG9pbnRlci5tb3VzZVgtY29vcmRbMF07XHJcbiAgICAgICAgdmFyIGR5ID0gcG9pbnRlci5tb3VzZVktY29vcmRbMV07XHJcbiAgICAgICAgaWYoZHgqZHgrZHkqZHkgPCAxMCoxMCkge1xyXG4gICAgICAgICAgc2VsZWN0ZWRQdCA9IGk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG59KSgpO1xyXG5cclxucG9pbnRlci5tb3VzZURyYWdnZWQgPSAoZnVuY3Rpb24oKSB7XHJcbiAgdmFyIGNvb3JkID0gdmVjMi5jcmVhdGUoKTtcclxuICByZXR1cm4gZnVuY3Rpb24gbW91c2VEcmFnZ2VkKCkge1xyXG4gICAgXHJcbiAgfVxyXG59KSgpO1xyXG5cclxucG9pbnRlci5tb3VzZUNsaWNrZWQgPSAoZnVuY3Rpb24oKSB7XHJcbiAgdmFyIGNvb3JkcyA9IHZlYzIuY3JlYXRlKCk7XHJcbiAgcmV0dXJuIGZ1bmN0aW9uIG1vdXNlQ2xpY2tlZChldmVudCkge1xyXG4gICAgaWYoc2VsZWN0ZWRQdCA9PSAtMSAmJiBwb2ludGVyLm1vdXNlQnV0dG9uID09IDEpIHtcclxuICAgICAgdmFyIHB0ID0ge3g6MCx5OjAsb246dHJ1ZX07XHJcbiAgICAgIHNjcmVlblRvUmVhbChwb2ludGVyLm1vdXNlWCxwb2ludGVyLm1vdXNlWSxjb29yZHMpO1xyXG4gICAgICBwdC54ID0gY29vcmRzWzBdO1xyXG4gICAgICBwdC55ID0gY29vcmRzWzFdO1xyXG4gICAgICB2b3Jvbm9pLnB0cy5wdXNoKHB0KTtcclxuICAgICAgc2VsZWN0ZWRQdCA9IHZvcm9ub2kucHRzLmxlbmd0aC0xO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgaWYocG9pbnRlci5tb3VzZUJ1dHRvbiA9PSAzKSB7XHJcbiAgICAgICAgdm9yb25vaS5wdHMuc3BsaWNlKHNlbGVjdGVkUHQsMSk7XHJcbiAgICAgICAgc2VsZWN0ZWRQdCA9IC0xO1xyXG4gICAgICB9IGVsc2UgaWYocG9pbnRlci5tb3VzZUJ1dHRvbiA9PSAxKSB7XHJcbiAgICAgICAgaWYoZXZlbnQuY3RybEtleSkge1xyXG4gICAgICAgICAgdm9yb25vaS5wdHNbc2VsZWN0ZWRQdF0ub24gPSAhdm9yb25vaS5wdHNbc2VsZWN0ZWRQdF0ub247XHJcblxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxufSkoKTtcclxuXHJcbmZ1bmN0aW9uIGRvd25sb2FkVmJvQXNTVEwodmJvKSB7XHJcbiAgdmFyIHRyaUNvdW50ID0gdmJvLm51bUluZGljZXMvMztcclxuICB2YXIgYnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKDgwKzQrNTAqdHJpQ291bnQpO1xyXG4gIHZhciBkYXRhVmlldyA9IG5ldyBEYXRhVmlldyhidWZmZXIpO1xyXG4gIGRhdGFWaWV3Lm9mZnNldCA9IDgwO1xyXG4gIHNldERWVWludDMyKGRhdGFWaWV3LCB0cmlDb3VudCk7XHJcbiAgXHJcbiAgc2F2ZVZCT0JpbmFyeSh2Ym8sZGF0YVZpZXcpO1xyXG5cclxuICB2YXIgYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcclxuICB2YXIgYmxvYiA9IG5ldyBCbG9iKFtidWZmZXJdLCB7J3R5cGUnOidhcHBsaWNhdGlvblxcL29jdGV0LXN0cmVhbSd9KTtcclxuICBhLmhyZWYgPSB3aW5kb3cuVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcclxuICBhLmRvd25sb2FkID0gXCJjb25uZWN0b3JzXCIrbmV3IERhdGUoKS50b0lTT1N0cmluZygpLnN1YnN0cmluZygwLDE2KStcIi5zdGxcIjtcclxuICBhLmNsaWNrKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNhdmVWQk9CaW5hcnkodmJvLCBkYXRhVmlldykge1xyXG4gIGZvcih2YXIgaT0wO2k8dmJvLm51bUluZGljZXM7KSB7XHJcbiAgICBzZXREVkZsb2F0KGRhdGFWaWV3LDAuMCk7XHJcbiAgICBzZXREVkZsb2F0KGRhdGFWaWV3LDAuMCk7XHJcbiAgICBzZXREVkZsb2F0KGRhdGFWaWV3LDAuMCk7XHJcbiAgICB2YXIgaTEgPSB2Ym8uaW5kZXhEYXRhW2krK10qMztcclxuICAgIHZhciBpMiA9IHZiby5pbmRleERhdGFbaSsrXSozO1xyXG4gICAgdmFyIGkzID0gdmJvLmluZGV4RGF0YVtpKytdKjM7XHJcblxyXG4gICAgc2V0RFZGbG9hdChkYXRhVmlldyx2Ym8udmVydGV4RGF0YVtpMV0pO1xyXG4gICAgc2V0RFZGbG9hdChkYXRhVmlldyx2Ym8udmVydGV4RGF0YVtpMSsxXSk7XHJcbiAgICBzZXREVkZsb2F0KGRhdGFWaWV3LHZiby52ZXJ0ZXhEYXRhW2kxKzJdKTtcclxuXHJcbiAgICBzZXREVkZsb2F0KGRhdGFWaWV3LHZiby52ZXJ0ZXhEYXRhW2kyXSk7XHJcbiAgICBzZXREVkZsb2F0KGRhdGFWaWV3LHZiby52ZXJ0ZXhEYXRhW2kyKzFdKTtcclxuICAgIHNldERWRmxvYXQoZGF0YVZpZXcsdmJvLnZlcnRleERhdGFbaTIrMl0pO1xyXG5cclxuICAgIHNldERWRmxvYXQoZGF0YVZpZXcsdmJvLnZlcnRleERhdGFbaTNdKTtcclxuICAgIHNldERWRmxvYXQoZGF0YVZpZXcsdmJvLnZlcnRleERhdGFbaTMrMV0pO1xyXG4gICAgc2V0RFZGbG9hdChkYXRhVmlldyx2Ym8udmVydGV4RGF0YVtpMysyXSk7XHJcbiAgICBcclxuICAgIHNldERWVWludDE2KGRhdGFWaWV3LDApO1xyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gc2V0RFZGbG9hdChkdiwgdmFsKSB7XHJcbiAgZHYuc2V0RmxvYXQzMihkdi5vZmZzZXQsdmFsLHRydWUpO1xyXG4gIGR2Lm9mZnNldCArPSA0O1xyXG59XHJcblxyXG5mdW5jdGlvbiBzZXREVlVpbnQxNihkdiwgdmFsKSB7XHJcbiAgZHYuc2V0VWludDE2KGR2Lm9mZnNldCx2YWwsdHJ1ZSk7XHJcbiAgZHYub2Zmc2V0ICs9IDI7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNldERWVWludDMyKGR2LCB2YWwpIHtcclxuICBkdi5zZXRVaW50MzIoZHYub2Zmc2V0LHZhbCx0cnVlKTtcclxuICBkdi5vZmZzZXQgKz0gNDtcclxufVxyXG4iLCJ2YXIgZ2xNYXRyaXggPSByZXF1aXJlKFwiLi4vanMvZ2wtbWF0cml4LW1pbi5qc1wiKTtcclxudmFyIHZlYzMgPSBnbE1hdHJpeC52ZWMzO1xyXG52YXIgdmVjNCA9IGdsTWF0cml4LnZlYzQ7XHJcbi8vVkVDNCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vL2NoZWNrIGZvciAwXHJcbnZlYzQucHJvamVjdERvd249ZnVuY3Rpb24oYSxiKXt2YXIgZD0xLjAvYVszXTtpZighYikge2I9dmVjMy5jcmVhdGUoKTt9IGJbMF09YVswXSpkO2JbMV09YVsxXSpkO2JbMl09YVsyXSpkO3JldHVybiBiO307XHJcbi8vb3B0aW1pemUgdG8gYXZvaWQgbXVsdGlwbGljYXRpb25zIHdpdGggbm8gYlxyXG52ZWM0LmZyb21WZWMzPWZ1bmN0aW9uKGEsYil7aWYoIWIpIGI9MTt2YXIgYz1uZXcgRmxvYXQzMkFycmF5KDQpO2NbMF09YVswXSpiO2NbMV09YVsxXSpiO2NbMl09YVsyXSpiO2NbM109YjtyZXR1cm4gY307XHJcblxyXG4vL05VUkJTIENVUlZFXHJcbi8vYSBudXJicyBvYmplY3QgaGFzIGNvbnRyb2wgcHRzLGtub3RzLCBkZWdyZWVcclxudmFyIG51cmJzID0gZXhwb3J0cztcclxuLy91c2VkIGxvY2FsbHlcclxubnVyYnMuTUFYX0RFR1JFRSA9IDEwO1xyXG5udXJicy5iYXNpc0Z1bmNzID0gbmV3IEZsb2F0MzJBcnJheSgxMCk7XHJcbm51cmJzLmJhc2lzRnVuY3NVID0gbmV3IEZsb2F0MzJBcnJheSgxMCk7XHJcbm51cmJzLmJhc2lzRnVuY3NWID0gbmV3IEZsb2F0MzJBcnJheSgxMCk7XHJcbm51cmJzLmRlcml2ZUJhc2lzRnVuY3MgPSBuZXcgQXJyYXkoMTEpO1xyXG5mb3IodmFyIGk9MDtpPG51cmJzLk1BWF9ERUdSRUUrMTsrK2kpIG51cmJzLmRlcml2ZUJhc2lzRnVuY3NbaV0gPSBuZXcgRmxvYXQzMkFycmF5KG51cmJzLk1BWF9ERUdSRUUrMSk7XHJcbm51cmJzLm5kdSA9IG5ldyBBcnJheShudXJicy5NQVhfREVHUkVFKzEpO1xyXG5mb3IodmFyIGk9MDtpPG51cmJzLk1BWF9ERUdSRUUrMTsrK2kpIG51cmJzLm5kdVtpXSA9IG5ldyBGbG9hdDMyQXJyYXkobnVyYnMuTUFYX0RFR1JFRSsxKTtcclxuXHJcbm51cmJzLmJhbmcgPSBmdW5jdGlvbihhKSB7XHJcblx0dmFyIHZhbD0xO1xyXG5cdGZvcig7YT4xO2EtLSkge1xyXG5cdFx0dmFsKj1hO1xyXG5cdH1cclxuXHRyZXR1cm4gdmFsO1xyXG59O1xyXG5cclxuLy9JIGFtIGFuIGlkaW90XHJcbm51cmJzLkIgPSBbbmV3IEZsb2F0MzJBcnJheSgxMCksbmV3IEZsb2F0MzJBcnJheSgxMCksbmV3IEZsb2F0MzJBcnJheSgxMCksbmV3IEZsb2F0MzJBcnJheSgxMCksbmV3IEZsb2F0MzJBcnJheSgxMCksbmV3IEZsb2F0MzJBcnJheSgxMCksbmV3IEZsb2F0MzJBcnJheSgxMCksbmV3IEZsb2F0MzJBcnJheSgxMCksbmV3IEZsb2F0MzJBcnJheSgxMCksbmV3IEZsb2F0MzJBcnJheSgxMCldO1xyXG5mb3IodmFyIGk9MDtpPDEwOysraSkge1xyXG5cdGZvcih2YXIgaj0wO2o8MTA7KytqKSB7XHJcblx0XHRudXJicy5CW2ldW2pdID0gbnVyYnMuYmFuZyhpKS8obnVyYnMuYmFuZyhqKSpudXJicy5iYW5nKGktaikpO1xyXG5cdH1cclxufVxyXG5cclxuLy9tYWtlIGEgbnVyYnMgY3J2IG9iamVjdFxyXG4vL2luaXRpYWxpemUgd2l0aCBwb2ludHM/P1xyXG5udXJicy5jcmVhdGVDcnYgPSBmdW5jdGlvbihjcnYsZGVncmVlKSB7XHJcblx0Y3J2ID0gY3J2IHx8IHt9O1xyXG5cdGNydi5kZWdyZWUgPSBkZWdyZWUgfHwgMztcclxuXHRjcnYua25vdHMgPSBuZXcgQXJyYXkoY3J2LmRlZ3JlZSsxKTtcclxuXHRmb3IodmFyIGk9MDtpPD1jcnYuZGVncmVlO2krKykgY3J2Lmtub3RzW2ldID0gMDtcclxuXHRjcnYuY29udHJvbFB0cyA9IFtdO1xyXG5cdHJldHVybiBjcnY7XHJcbn1cclxuXHJcbm51cmJzLmNyZWF0ZUNsb3NlZENydiA9IGZ1bmN0aW9uKHB0cywgZGVncmVlKSB7XHJcblx0dmFyIGNydiA9IHt9O1xyXG5cdGNydi5kZWdyZWUgPSBkZWdyZWUgfHwgMztcclxuXHRjcnYua25vdHMgPSBuZXcgQXJyYXkocHRzLmxlbmd0aCtjcnYuZGVncmVlK2Nydi5kZWdyZWUrMSk7XHJcblx0Zm9yKHZhciBpPTA7aTxjcnYua25vdHMubGVuZ3RoO2krKykgY3J2Lmtub3RzW2ldID0gaS1jcnYuZGVncmVlO1xyXG5cdGNydi5jb250cm9sUHRzID0gW107XHJcblx0Zm9yKHZhciBpPTA7aTxwdHMubGVuZ3RoOysraSkge1xyXG5cdFx0Y3J2LmNvbnRyb2xQdHMucHVzaCh2ZWM0LmNyZWF0ZShwdHNbaV0pKTtcclxuXHR9XHJcblx0Zm9yKHZhciBpPTA7aTw9ZGVncmVlOysraSkge1xyXG5cdFx0Y3J2LmNvbnRyb2xQdHMucHVzaCh2ZWM0LmNyZWF0ZShwdHNbaV0pKTtcclxuXHR9XHJcblx0cmV0dXJuIGNydjtcclxufVxyXG5cclxubnVyYnMuY29weUNydiA9IGZ1bmN0aW9uKGNydikge1xyXG5cdHZhciBuZXdDcnYgPSB7fTtcclxuXHRuZXdDcnYuZGVncmVlID0gY3J2LmRlZ3JlZTtcclxuXHRuZXdDcnYua25vdHMgPSBjcnYua25vdHMuc2xpY2UoMCk7XHJcblx0bmV3Q3J2LmNvbnRyb2xQdHMgPSBjcnYuY29udHJvbFB0cy5zbGljZSgwKTtcclxuXHRyZXR1cm4gbmV3Q3J2O1xyXG59XHJcblxyXG4vL2JpbmFyeSBzZWFyY2hcclxubnVyYnMuZmluZEtub3QgPSBmdW5jdGlvbihrbm90cyx1LGRlZ3JlZSkge1xyXG5cdGlmICh1PT1rbm90c1trbm90cy5sZW5ndGgtZGVncmVlXSkgcmV0dXJuIGtub3RzLmxlbmd0aC1kZWdyZWUtMjtcclxuXHRpZih1IDw9IGtub3RzW2RlZ3JlZV0pIHJldHVybiBkZWdyZWU7XHJcblx0dmFyIGxvdyA9IGRlZ3JlZTtcclxuXHR2YXIgaGlnaCA9IGtub3RzLmxlbmd0aC1kZWdyZWU7XHJcblx0dmFyIG1pZCA9IE1hdGguZmxvb3IoKGhpZ2grbG93KS8yKTtcclxuXHR3aGlsZShrbm90c1ttaWRdPnUgfHwgdSA+PSBrbm90c1ttaWQrMV0pIHtcclxuXHQgIGlmKHU8a25vdHNbbWlkXSkge1xyXG5cdFx0aGlnaCA9IG1pZDtcclxuXHQgIH0gZWxzZSB7XHJcblx0XHRsb3cgPSBtaWQ7XHJcblx0ICB9XHJcblx0ICBtaWQgPSBNYXRoLmZsb29yKChoaWdoK2xvdykvMik7XHJcblx0fVxyXG5cdHJldHVybiBtaWQ7XHJcbn1cclxuXHJcbiBcclxuLy9pbXBsZW1lbnQgZGVncmVlIGVsZXZhdGlvbiBhbmQgcmVkdWN0aW9uLCBuZWVkZWQgdG8gbG9mdCBjdXJ2ZSBvZiBkaWZmZXJlbnQgZGVncmVlcyBhcyB3ZWxsXHJcbm51cmJzLnNldERlZ3JlZSA9IGZ1bmN0aW9uKGRlZykge1xyXG59XHJcblx0XHJcbm51cmJzLmV2YWx1YXRlQ3J2ID0gKGZ1bmN0aW9uKCkge1xyXG4gIHZhciBldmFsUHQgPSB2ZWM0LmNyZWF0ZSgpO1xyXG4gIHJldHVybiBmdW5jdGlvbiBldmFsdWF0ZUNydihjcnYsdSxwdCkge1xyXG4gICAgdmFyIGN1cnJLbm90ID0gbnVyYnMuZmluZEtub3QoY3J2Lmtub3RzLHUsY3J2LmRlZ3JlZSk7XHJcbiAgICBcclxuICAgIG51cmJzLmJhc2lzRnVuY3Rpb25zKGNydi5rbm90cyxjcnYuZGVncmVlLGN1cnJLbm90LCB1LG51cmJzLmJhc2lzRnVuY3MpO1xyXG4gICAgdmVjNC5zZXQoZXZhbFB0LDAsMCwwLDApO1xyXG4gICAgZm9yKHZhciBpID0gMDtpPD1jcnYuZGVncmVlOysraSkge1xyXG4gICAgICB2ZWM0LnNjYWxlQW5kQWRkKGV2YWxQdCwgZXZhbFB0LGNydi5jb250cm9sUHRzW2N1cnJLbm90LWNydi5kZWdyZWUraV0sIG51cmJzLmJhc2lzRnVuY3NbaV0pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHZlYzQucHJvamVjdERvd24oZXZhbFB0LHB0KTsgIFxyXG4gIH1cclxufSkoKTtcclxuLypcdCBcclxuXHQgcHVibGljIFBWZWN0b3IgZGVyaXZhdGl2ZShmbG9hdCB1LCBpbnQgaykge1xyXG5cdFx0IFZlY3RvcjREW10gZGVyaXZlc1cgPSBuZXcgVmVjdG9yNERbaysxXTtcclxuXHRcdCBpZihrPmRlZ3JlZSkgcmV0dXJuIG5ldyBQVmVjdG9yKCk7XHJcblx0XHQgaW50IGN1cnJLbm90ID0gZmluZEtub3QodSk7XHJcblx0XHQgVmVjdG9yNERbXSBoUHRzID0gbmV3IFZlY3RvcjREW2RlZ3JlZSsxXTtcclxuXHRcdCBmb3IoaW50IGk9MDtpPD1kZWdyZWU7KytpKSB7XHJcblx0ICAgICAgaFB0c1tpXSA9IFZlY3RvcjRELm11bHRpcGx5KG5ldyBWZWN0b3I0RChjb250cm9sUHRzW2N1cnJLbm90LWRlZ3JlZStpXS54LGNvbnRyb2xQdHNbY3Vycktub3QtZGVncmVlK2ldLnksY29udHJvbFB0c1tjdXJyS25vdC1kZWdyZWUraV0ueiksd2VpZ2h0c1tjdXJyS25vdC1kZWdyZWUraV0pO1xyXG5cdFx0IH1cclxuXHRcdCBmbG9hdFtdW10gYmFzRnVuYyA9IGRlcml2ZUJhc2lzRnVuY3Rpb25zKGN1cnJLbm90LHUsIGspO1xyXG5cdFx0IGZvcihpbnQgaT0wO2k8PWs7KytpKSB7XHJcblx0XHRcdCBkZXJpdmVzV1tpXSA9IG5ldyBWZWN0b3I0RCgpO1xyXG5cdFx0XHQgZm9yKGludCBqPTA7ajw9ZGVncmVlOysraikge1xyXG5cdFx0XHRcdCBkZXJpdmVzV1tpXSA9IFZlY3RvcjRELmFkZChkZXJpdmVzV1tpXSxWZWN0b3I0RC5tdWx0aXBseShoUHRzW2pdLGJhc0Z1bmNbaV1bal0pKTtcclxuXHRcdFx0IH1cclxuXHRcdCB9XHJcblx0XHQgXHJcblx0XHQgUFZlY3RvcltdIGRlcml2ZXMgPSBuZXcgUFZlY3RvcltkZXJpdmVzVy5sZW5ndGhdO1xyXG5cdFx0IGRlcml2ZXNbMF0gPSBuZXcgUFZlY3RvcigpO1xyXG5cdFx0IGZvcihpbnQgaT0wO2k8PWs7KytpKSB7XHJcblx0XHRcdFBWZWN0b3IgY3VyclB0ID0gbmV3IFBWZWN0b3IoZGVyaXZlc1dbaV0ueCxkZXJpdmVzV1tpXS55LGRlcml2ZXNXW2ldLnopO1xyXG5cdFx0XHRmb3IoaW50IGo9MTtqPD1pOysraikge1xyXG5cdFx0XHRcdGN1cnJQdCA9IFBWZWN0b3Iuc3ViKGN1cnJQdCxQVmVjdG9yLm11bHQoZGVyaXZlc1tpLWpdLEJbaV1bal0qZGVyaXZlc1dbal0udykpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGRlcml2ZXNbaV0gPSBuZXcgUFZlY3RvcihjdXJyUHQueC9kZXJpdmVzV1swXS53LGN1cnJQdC55L2Rlcml2ZXNXWzBdLncsY3VyclB0LnovZGVyaXZlc1dbMF0udyk7XHJcblx0XHQgfVxyXG5cdFx0IHJldHVybiBkZXJpdmVzW2tdO1xyXG5cdFx0IFxyXG5cdCB9XHJcblx0IFxyXG5cdCBwdWJsaWMgUFZlY3RvcltdIGFsbERlcml2YXRpdmVzKGZsb2F0IHUsIGludCBrKSB7XHJcblx0XHQgVmVjdG9yNERbXSBkZXJpdmVzVyA9IG5ldyBWZWN0b3I0RFtrKzFdO1xyXG5cdFx0IGludCBjdXJyS25vdCA9IGZpbmRLbm90KHUpO1xyXG5cdFx0IFZlY3RvcjREW10gaFB0cyA9IG5ldyBWZWN0b3I0RFtkZWdyZWUrMV07XHJcblx0XHQgZm9yKGludCBpPTA7aTw9ZGVncmVlOysraSkge1xyXG5cdCAgICAgIGhQdHNbaV0gPSBWZWN0b3I0RC5tdWx0aXBseShuZXcgVmVjdG9yNEQoY29udHJvbFB0c1tjdXJyS25vdC1kZWdyZWUraV0ueCxjb250cm9sUHRzW2N1cnJLbm90LWRlZ3JlZStpXS55LGNvbnRyb2xQdHNbY3Vycktub3QtZGVncmVlK2ldLnopLHdlaWdodHNbY3Vycktub3QtZGVncmVlK2ldKTtcclxuXHRcdCB9XHRcdCBcclxuXHRcdCBmbG9hdFtdW10gYmFzRnVuYyA9IGRlcml2ZUJhc2lzRnVuY3Rpb25zKGN1cnJLbm90LHUsIGspO1xyXG5cdFx0IGZvcihpbnQgaT0wO2k8PWs7KytpKSB7XHJcblx0XHRcdCBkZXJpdmVzV1tpXSA9IG5ldyBWZWN0b3I0RCgpO1xyXG5cdFx0XHQgZm9yKGludCBqPTA7ajw9ZGVncmVlOysrailcclxuXHRcdFx0XHQgZGVyaXZlc1dbaV0gPSBWZWN0b3I0RC5hZGQoZGVyaXZlc1dbaV0sVmVjdG9yNEQubXVsdGlwbHkoaFB0c1tqXSxiYXNGdW5jW2ldW2pdKSk7XHJcblx0XHQgfVxyXG5cdFx0IFxyXG5cdFx0IFBWZWN0b3JbXSBkZXJpdmVzID0gbmV3IFBWZWN0b3JbZGVyaXZlc1cubGVuZ3RoXTtcclxuXHRcdCBkZXJpdmVzWzBdID0gbmV3IFBWZWN0b3IoKTtcclxuXHRcdCBmb3IoaW50IGk9MDtpPD1rOysraSkge1xyXG5cdFx0XHRQVmVjdG9yIGN1cnJQdCA9IG5ldyBQVmVjdG9yKGRlcml2ZXNXW2ldLngsZGVyaXZlc1dbaV0ueSxkZXJpdmVzV1tpXS56KTtcclxuXHRcdFx0Zm9yKGludCBqPTE7ajw9aTsrK2opIHtcclxuXHRcdFx0XHRjdXJyUHQgPSBQVmVjdG9yLnN1YihjdXJyUHQsUFZlY3Rvci5tdWx0KGRlcml2ZXNbaS1qXSxCW2ldW2pdKmRlcml2ZXNXW2pdLncpKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRkZXJpdmVzW2ldID0gbmV3IFBWZWN0b3IoY3VyclB0LngvZGVyaXZlc1dbMF0udyxjdXJyUHQueS9kZXJpdmVzV1swXS53LGN1cnJQdC56L2Rlcml2ZXNXWzBdLncpO1xyXG5cdFx0IH1cclxuXHRcdCByZXR1cm4gZGVyaXZlcztcclxuXHRcdCBcclxuXHQgfVx0IFxyXG4qL1x0ICBcclxuXHQgIC8vYXBwcm94aW1hdGUgbGVuZ3RoLCB1bmltcGxlbWVudGVkXHJcbm51cmJzLmNydkxlbmd0aD1mdW5jdGlvbihjcnYpIHtcclxuXHRyZXR1cm4gMTtcclxufVx0XHJcblx0ICBcclxubnVyYnMuZG9tYWluID0gZnVuY3Rpb24oYyxiKSB7XHJcblx0YiA9IGIgfHwgbmV3IEFycmF5KDIpO1xyXG5cdGJbMF09Yy5rbm90c1tjLmRlZ3JlZV07XHJcblx0YlsxXT1jLmtub3RzW2Mua25vdHMubGVuZ3RoLTEtYy5kZWdyZWVdO1xyXG5cdHJldHVybiBiO1xyXG59XHJcblx0ICBcclxubnVyYnMuYWRkUG9pbnQgPSBmdW5jdGlvbihjcnYsIHB0KSB7XHJcblx0Y3J2LmNvbnRyb2xQdHMucHVzaCh2ZWM0LmZyb21WZWMzKHB0LDEpKTtcclxuXHR2YXIgaW5jID0gMTtcclxuXHR2YXIgc3RhcnQgPSBjcnYua25vdHNbY3J2LmRlZ3JlZV07XHJcblx0dmFyIGVuZCA9IGNydi5rbm90c1tjcnYua25vdHMubGVuZ3RoLTFdO1xyXG5cdGlmKGNydi5jb250cm9sUHRzLmxlbmd0aDw9Y3J2LmRlZ3JlZSsxKSB7XHJcblx0ICBjcnYua25vdHMucHVzaCgxKTtcclxuXHR9IGVsc2Uge1xyXG5cdCAgdmFyIGk7XHJcblx0ICBmb3IoIGk9Y3J2LmRlZ3JlZSsxO2k8Y3J2Lmtub3RzLmxlbmd0aC1jcnYuZGVncmVlOysraSkge1xyXG5cdFx0ICBpZihjcnYua25vdHNbaV0gIT0gc3RhcnQpIHtcclxuXHRcdFx0ICBpbmMgPSBjcnYua25vdHNbaV0tc3RhcnQ7XHJcblx0XHRcdCAgaSA9IGNydi5rbm90cy5sZW5ndGg7IC8vYnJlYWs/XHJcblx0XHQgIH1cclxuXHQgIH1cclxuXHQgIGNydi5rbm90cy5wdXNoKGVuZCtpbmMpO1xyXG5cdCAgZm9yKCBpPWNydi5rbm90cy5sZW5ndGgtMjtpPmNydi5rbm90cy5sZW5ndGgtY3J2LmRlZ3JlZS0yOy0taSkgXHJcblx0XHRjcnYua25vdHNbaV0gPSBlbmQraW5jO1x0XHRcdCAgXHJcblx0ICBmb3IoIGk9MDtpPGNydi5rbm90cy5sZW5ndGg7KytpKSBcclxuXHRcdGNydi5rbm90c1tpXSAvPSBlbmQraW5jO1xyXG5cdH1cclxufVxyXG5cclxuLy9pbnNlcnQgYSBrbm90IGEgdSBzb21lIHRpbWVzXHJcbi8vdGhpcyBzaG91bGQgdXNlIG5hdGl2ZSBhcnJheSBtZXRob2RzIG5vdCB0aGlzIHdlaXJkIGNvcHlpbmdcclxubnVyYnMuaW5zZXJ0S25vdCA9IGZ1bmN0aW9uKGNydix1LHRpbWVzKSB7XHJcblx0aWYoIXRpbWVzKSB0aW1lcyA9IDE7XHJcblx0dmFyIGN1cnJLbm90ID0gbnVyYnMuZmluZEtub3QoY3J2Lmtub3RzLHUsY3J2LmRlZ3JlZSk7XHJcblx0dmFyIG11bHRpcGxpY2l0eSA9IG51cmJzLmZpbmRNdWx0aXBsaWNpdHkoY3J2Lmtub3RzLGN1cnJLbm90KTtcclxuXHQvL3RpbWVzID0gTWF0aC5taW4oZGVncmVlLXRpbWVzLW11bHRpcGxpY2l0eSx0aW1lcyk7XHJcblx0Ly90aW1lcyA9IE1hdGgubWF4KDAsdGltZXMpO1xyXG5cdHZhciBuZXdLbm90cyA9IG5ldyBGbG9hdDMyQXJyYXkoY3J2Lmtub3RzLmxlbmd0aCt0aW1lcyk7XHJcblx0dmFyIG5ld1BvaW50cyA9IG5ldyBBcnJheShjcnYuY29udHJvbFB0cy5sZW5ndGgrdGltZXMpO1xyXG5cclxuXHR2YXIgaTtcclxuXHRmb3IoaT0wO2k8PWN1cnJLbm90OysraSkgbmV3S25vdHNbaV0gPSBjcnYua25vdHNbaV07XHJcblx0Zm9yKGk9MTtpPD10aW1lczsrK2kpIG5ld0tub3RzW2N1cnJLbm90K2ldID0gdTtcclxuXHRmb3IoaT1jdXJyS25vdCsxO2k8Y3J2Lmtub3RzLmxlbmd0aDsrK2kpIG5ld0tub3RzW2krdGltZXNdID0gY3J2Lmtub3RzW2ldO1xyXG5cdGZvcihpPTA7aTw9Y3Vycktub3QtY3J2LmRlZ3JlZTsrK2kpIG5ld1BvaW50c1tpXSA9IGNydi5jb250cm9sUHRzW2ldO1xyXG5cdGZvcihpPWN1cnJLbm90LW11bHRpcGxpY2l0eTsgaTxjcnYuY29udHJvbFB0cy5sZW5ndGg7KytpKSBuZXdQb2ludHNbaSt0aW1lc10gPSBjcnYuY29udHJvbFB0c1tpXTtcclxuXHR2YXIgdGVtcCA9IG5ldyBBcnJheShkZWdyZWUrMSk7XHJcblx0Zm9yKGk9MDtpPD0gY3J2LmRlZ3JlZS1tdWx0aXBsaWNpdHk7KytpKSB0ZW1wW2ldID0gY3J2LmNvbnRyb2xQdHNbY3Vycktub3QtY3J2LmRlZ3JlZStpXTtcclxuXHR2YXIgaiwgTCxhbHBoYTtcclxuXHRmb3Ioaj0xO2o8PXRpbWVzOysraikge1xyXG5cdCBMID0gY3Vycktub3QtY3J2LmRlZ3JlZStqO1xyXG5cdCBmb3IoaT0wO2k8PWNydi5kZWdyZWUtai1tdWx0aXBsaWNpdHk7KytpKSB7XHJcblx0XHQgYWxwaGEgPSAodS1jcnYua25vdHNbTCtpXSkvKGNydi5rbm90c1tpK2N1cnJLbm90KzFdLWNydi5rbm90c1tMK2ldKTtcclxuXHRcdCB2ZWM0LmFkZCh2ZWM0LnNjYWxlKHRlbXBbaSsxXSxhbHBoYSksdmVjNC5zY2FsZSh0ZW1wW2ldLDEuMC1hbHBoYSksdGVtcFtpXSk7XHJcblx0IH1cclxuXHQgXHJcblx0IG5ld1BvaW50c1tMXSA9IHRlbXBbMF07XHJcblx0IG5ld1BvaW50c1tjdXJyS25vdCt0aW1lcy1qLW11bHRpcGxpY2l0eV0gPSB0ZW1wW2Nydi5kZWdyZWUtai1tdWx0aXBsaWNpdHldO1xyXG5cdH1cclxuXHRmb3IoaT1MKzE7aTxjdXJyS25vdC1tdWx0aXBsaWNpdHk7KytpKSB7XHJcblx0IG5ld1BvaW50c1tpXSA9IHRlbXBbaS1MXTtcclxuXHR9XHJcblx0Y3J2LmNvbnRyb2xQdHMgPSBuZXdQb2ludHM7XHJcblx0Y3J2Lmtub3RzID0gbmV3S25vdHM7XHJcbn1cdCAgXHJcblxyXG5udXJicy5pbnNlcnRLbm90QXJyYXkgPSBmdW5jdGlvbihjcnYsdXMpIHtcclxuXHJcbn1cclxuXHQgIC8qXHQgXHJcblx0IHB1YmxpYyB2b2lkIGluc2VydEtub3RzKGZsb2F0W10gaW5zZXJ0S25vdHMpIHtcclxuXHRcdCBpbnQgc3RhcnRLbm90ID0gZmluZEtub3QoaW5zZXJ0S25vdHNbMF0pO1xyXG5cdFx0IGludCBlbmRLbm90ID0gZmluZEtub3QoaW5zZXJ0S25vdHNbaW5zZXJ0S25vdHMubGVuZ3RoLTFdKSsxO1xyXG5cdFx0IGZsb2F0W10gbmV3S25vdHMgPSBuZXcgZmxvYXRba25vdHMubGVuZ3RoK2luc2VydEtub3RzLmxlbmd0aF07XHJcblx0XHQgVmVjdG9yNERbXSBuZXdQb2ludHMgPSBuZXcgVmVjdG9yNERbY29udHJvbFB0cy5sZW5ndGgraW5zZXJ0S25vdHMubGVuZ3RoXTtcclxuXHRcdCBmb3IoaW50IGo9MDtqPD1zdGFydEtub3QtZGVncmVlOysraikgbmV3UG9pbnRzW2pdID0gbmV3IFZlY3RvcjREKGNvbnRyb2xQdHNbal0sd2VpZ2h0c1tqXSk7XHJcblx0XHQgZm9yKGludCBqPWVuZEtub3QtMTtqPGNvbnRyb2xQdHMubGVuZ3RoOysraikgbmV3UG9pbnRzW2oraW5zZXJ0S25vdHMubGVuZ3RoXSA9ICBuZXcgVmVjdG9yNEQoY29udHJvbFB0c1tqXSx3ZWlnaHRzW2pdKTtcclxuXHRcdCBmb3IoaW50IGo9MDtqPD1zdGFydEtub3Q7KytqKSBuZXdLbm90c1tqXSA9IGtub3RzW2pdO1xyXG5cdFx0IGZvcihpbnQgaj1lbmRLbm90K2RlZ3JlZTtqPGtub3RzLmxlbmd0aDsrK2opIG5ld0tub3RzW2oraW5zZXJ0S25vdHMubGVuZ3RoXSA9IGtub3RzW2pdO1xyXG5cdFx0IGludCBpPWVuZEtub3QrZGVncmVlLTE7XHJcblx0XHQgaW50IGs9IGVuZEtub3QrZGVncmVlK2luc2VydEtub3RzLmxlbmd0aC0xO1xyXG5cdFx0IGZvcihpbnQgaj1pbnNlcnRLbm90cy5sZW5ndGgtMTtqPj0wOy0taikge1xyXG5cdFx0XHQgd2hpbGUoaW5zZXJ0S25vdHNbal0gPD0ga25vdHNbaV0gJiYgaT5zdGFydEtub3QpIHtcclxuXHRcdFx0XHQgbmV3UG9pbnRzW2stZGVncmVlLTFdID0gbmV3IFZlY3RvcjREKGNvbnRyb2xQdHNbaS1kZWdyZWUtMV0sd2VpZ2h0c1tpLWRlZ3JlZS0xXSk7XHJcblx0XHRcdFx0IG5ld0tub3RzW2tdID0ga25vdHNbaV07XHJcblx0XHRcdFx0IC0taztcclxuXHRcdFx0XHQgLS1pO1xyXG5cdFx0XHQgfVxyXG5cdFx0XHQgbmV3UG9pbnRzW2stZGVncmVlLTFdID0gbmV3UG9pbnRzW2stZGVncmVlXTtcclxuXHRcdFx0IGZvcihpbnQgbD0xO2w8PWRlZ3JlZTsrK2wpIHtcclxuXHRcdFx0XHQgaW50IGluZCA9IGstZGVncmVlK2w7XHJcblx0XHRcdFx0IGxvYXQgYWxwaGEgPSBuZXdLbm90c1trK2xdLWluc2VydEtub3RzW2pdO1xyXG5cdFx0XHRcdCBpZihNYXRoLmFicyhhbHBoYSkgPT0gMCkgbmV3UG9pbnRzW2luZC0xXSA9IG5ld1BvaW50c1tpbmRdO1xyXG5cdFx0XHRcdCBlbHNlIHtcclxuXHRcdFx0XHRcdCBhbHBoYSA9IGFscGhhLyhuZXdLbm90c1trK2xdLWtub3RzW2ktZGVncmVlK2xdKTtcclxuXHRcdFx0XHRcdCBuZXdQb2ludHNbaW5kLTFdID0gVmVjdG9yNEQuYWRkKFZlY3RvcjRELm11bHRpcGx5KG5ld1BvaW50c1tpbmQtMV0sYWxwaGEpLCBWZWN0b3I0RC5tdWx0aXBseShuZXdQb2ludHNbaW5kXSwxLWFscGhhKSk7XHJcblx0XHRcdFx0IH1cclxuXHRcdFx0IH1cclxuXHRcdFx0IG5ld0tub3RzW2tdID0gaW5zZXJ0S25vdHNbal07XHJcblx0XHRcdCAtLWs7XHJcblx0XHQgfVxyXG5cdFx0IGtub3RzID0gbmV3S25vdHM7XHJcblx0XHQgY29udHJvbFB0cyA9IG5ldyBQVmVjdG9yW25ld1BvaW50cy5sZW5ndGhdO1xyXG5cdFx0IHdlaWdodHMgPSBuZXcgZmxvYXRbbmV3UG9pbnRzLmxlbmd0aF07XHJcblx0XHQgZm9yKGludCBqPTA7ajxuZXdQb2ludHMubGVuZ3RoOysraikge1xyXG5cdFx0XHQgXHJcblx0XHRcdCBpZihuZXdQb2ludHNbal0gIT0gbnVsbCkge1xyXG5cdFx0XHRcdCBjb250cm9sUHRzW2pdID0gbmV3UG9pbnRzW2pdLnByb2plY3REb3duKCk7XHJcblx0XHRcdFx0IHdlaWdodHNbal0gPSBuZXdQb2ludHNbal0udztcclxuXHRcdFx0IH1cclxuXHRcdCB9XHJcblx0IH1cclxuKi9cclxuLy9tYWtlIGtub3QgdmFsdWVzIGJldHdlZW4gMCBhbmQgMSBha2EgZXZhbHVhdGUoMCkgPSBzdGFydCBhbmQgZXZhbHVhdGUoMSkgPSBlbmRcclxubnVyYnMubm9ybWFsaXplS25vdHM9ZnVuY3Rpb24oa25vdHMpIHtcclxuXHR2YXIgc3RhcnQgPSBrbm90c1swXTtcclxuXHR2YXIgZW5kID0ga25vdHNba25vdHMubGVuZ3RoLTFdO1xyXG5cdGZvcih2YXIgaT0wO2k8a25vdHMubGVuZ3RoOysraSkge1xyXG5cdFx0a25vdHNbaV0gPSAoa25vdHNbaV0tc3RhcnQpLyhlbmQtc3RhcnQpO1xyXG5cdH1cclxufVxyXG5cclxuLy9ob3cgbWFueSB0aW1lcyBkb2VzIGEga25vdCBhcHBlYXJcclxubnVyYnMuZmluZE11bHRpcGxpY2l0eSA9IGZ1bmN0aW9uKGtub3RzLGtub3QpIHtcclxuXHR2YXIgbXVsdCA9IDE7XHJcblx0dmFyIGk7XHJcblx0Zm9yKGk9a25vdCsxO2k8a25vdHMubGVuZ3RoICYmIGtub3RzW2ldID09IGtub3RzW2tub3RdOysraSkgKyttdWx0O1xyXG5cdGZvcihpPWtub3QtMTtpPj0wICYmIGtub3RzW2ldID09IGtub3RzW2tub3RdOy0taSkgKyttdWx0O1xyXG5cclxuXHRyZXR1cm4gbXVsdC0xO1xyXG59XHJcblx0IFxyXG5udXJicy5iYXNpc0Z1bmN0aW9ucyA9IChmdW5jdGlvbigpIHtcclxuICB2YXIgbGVmdCA9IG5ldyBGbG9hdDMyQXJyYXkobnVyYnMuTUFYX0RFR1JFRSsxKTtcclxuICB2YXIgcmlnaHQgPSBuZXcgRmxvYXQzMkFycmF5KG51cmJzLk1BWF9ERUdSRUUrMSk7XHJcbiAgcmV0dXJuIGZ1bmN0aW9uIGJhc2lzRnVuY3Rpb25zKGtub3RzLGRlZ3JlZSxrbm90LHUsZnVuY3MpIHtcclxuXHJcbiAgICBmdW5jc1swXSA9IDE7XHJcbiAgICB2YXIgaiwgciwgc2F2ZWQsIHRlbXA7XHJcbiAgICBmb3IoIGo9MTtqPD1kZWdyZWU7KytqKSB7XHJcbiAgICAgIGxlZnRbal0gPSB1LWtub3RzW2tub3QrMS1qXTtcclxuICAgICAgcmlnaHRbal0gPSBrbm90c1trbm90K2pdLXU7XHJcbiAgICAgIHNhdmVkID0gMDtcclxuICAgICAgZm9yKCByID0gMDtyPGo7KytyKSB7XHJcbiAgICAgIHRlbXAgPSBmdW5jc1tyXS8ocmlnaHRbcisxXStsZWZ0W2otcl0pO1xyXG4gICAgICBmdW5jc1tyXSA9IHNhdmVkK3JpZ2h0W3IrMV0qdGVtcDtcclxuICAgICAgc2F2ZWQgPSBsZWZ0W2otcl0qdGVtcDtcclxuICAgICAgfVxyXG4gICAgICBmdW5jc1tqXSA9IHNhdmVkO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGZ1bmNzO1xyXG4gIH1cclxufSkoKTtcclxuXHQgIFxyXG5udXJicy5kZXJpdmVCYXNpc0Z1bmN0aW9ucyA9IGZ1bmN0aW9uKGtub3RzLGRlZ3JlZSxrbm90LCB1LCBkZXIpIHtcclxuXHR2YXIgbGVmdCxyaWdodDtcclxuXHRuZHVbMF1bMF0gPSAxO1xyXG5cdHZhciBqLHI7XHJcblx0dmFyIHNhdmVkLHRlbXA7XHJcblx0Zm9yKGo9MTtqPD1kZWdyZWU7KytqKSB7XHJcblx0IGxlZnRbal0gPSB1LWtub3RzW2tub3QrMS1qXTtcclxuXHQgcmlnaHRbal0gPSBrbm90c1trbm90K2pdLXU7XHJcblx0IHNhdmVkID0gMDtcclxuXHQgZm9yKHI9MDtyPGo7KytyKSB7XHJcblx0XHQgbmR1W2pdW3JdID0gcmlnaHRbcisxXStsZWZ0W2otcl07XHJcblx0XHQgdGVtcCA9IG5kdVtyXVtqLTFdL25kdVtqXVtyXTtcclxuXHRcdCBuZHVbcl1bal0gPSBzYXZlZCtyaWdodFtyKzFdKnRlbXA7XHJcblx0XHQgc2F2ZWQgPSBsZWZ0W2otcl0qdGVtcDtcclxuXHQgfVxyXG5cdCBuZHVbal1bal0gPSBzYXZlZDtcclxuXHR9XHJcblx0Zm9yKGo9MDtqPD1kZWdyZWU7KytqKVxyXG5cdFx0bnVyYnMuZGVyaXZlQmFzaXNGdW5jc1swXVtqXSA9IG5kdVtqXVtkZWdyZWVdO1xyXG5cdFxyXG5cdHZhciBzMSwgczIsIGssZCxyayxwayxqMSxqMjtcclxuXHR2YXIgYT1uZXcgQXJyYXkoZGVncmVlKzEpO1xyXG5cdGZvcihqPTA7ajxkZWdyZWUrMTsrK2opIGFbal0gPSBuZXcgQXJyYXkoZGVncmVlKzEpO1xyXG5cdGZvcihyPTA7cjw9ZGVncmVlOysrcikge1xyXG5cdCBzMSA9IDA7XHJcblx0IHMyID0gMTtcclxuXHQgYVswXVswXSA9IDE7XHJcblx0IGZvciggaz0xO2s8PWRlcjsrK2spIHtcclxuXHRcdCBkID0gMDtcclxuXHRcdCByayA9IHItaztcclxuXHRcdCBwayA9IGRlZ3JlZS1rO1xyXG5cdFx0IGlmKHI+PWspIHtcclxuXHRcdFx0IGFbczJdWzBdID0gYVtzMV1bMF0vbmR1W3BrKzFdW3JrXTtcclxuXHRcdFx0IGQgPSBhW3MyXVswXSpuZHVbcmtdW3BrXTtcclxuXHRcdCB9XHJcblx0XHQgajEgPSAtcms7XHJcblx0XHQgaWYocms+PS0xKSBqMSA9IDE7XHJcblx0XHQgajI9ZGVncmVlLXI7XHJcblx0XHQgaWYoci0xIDw9cGspIGoyID0gay0xO1xyXG5cdFx0IFxyXG5cdFx0IGZvcihqPWoxO2o8PWoyOysraikge1xyXG5cdFx0XHQgYVtzMl1bal0gPSAoYVtzMV1bal0tYVtzMV1bai0xXSkvbmR1W3BrKzFdW3JrK2pdO1xyXG5cdFx0XHQgZCArPSBhW3MyXVtqXSpuZHVbcmsral1bcGtdO1xyXG5cdFx0IH1cclxuXHRcdCBpZihyPD1waykge1xyXG5cdFx0XHQgYVtzMl1ba10gPSAtYVtzMV1bay0xXS9uZHVbcGsrMV1bcl07XHJcblx0XHRcdCBkICs9IGFbczJdW2tdKm5kdVtyXVtwa107XHJcblx0XHQgfVxyXG5cdFx0IG51cmJzLmRlcml2ZUJhc2lzRnVuY3Nba11bcl0gPSBkO1xyXG5cdFx0IHRlbXAgPXMxO1xyXG5cdFx0IHMxID0gczI7XHJcblx0XHQgczIgPSB0ZW1wO1x0IFxyXG5cdCB9XHJcblx0fVxyXG5cdHIgPSBkZWdyZWU7XHJcblx0Zm9yKGs9MTtrPD1kZXI7KytrKSB7XHJcblx0IGZvcihqPTA7ajw9ZGVncmVlOysraikgbnVyYnMuZGVyaXZlQmFzaXNGdW5jc1trXVtqXSAqPSByOyBcclxuXHQgciAqPSAoZGVncmVlLWspO1xyXG5cdH1cclxuXHRyZXR1cm4gbnVyYnMuZGVyaXZlQmFzaXNGdW5jcztcclxufVxyXG5cclxubnVyYnMuY2lyY2xlUHQgPSBmdW5jdGlvbihjZW4scmFkaXVzKSB7XHJcblxyXG5cdHZhciBjcnYgPSBudXJicy5jcmVhdGVDcnYoKTtcclxuXHRjcnYuY29udHJvbFB0cyA9IFtdO1xyXG5cdGNydi5kZWdyZWUgPSAyO1xyXG5cdGNydi5rbm90cyA9IFswLDAsMCxNYXRoLlBJKjAuNSxNYXRoLlBJKjAuNSwgTWF0aC5QSSwgTWF0aC5QSSwgTWF0aC5QSSoxLjUsIE1hdGguUEkqMS41LCBNYXRoLlBJKjIsIE1hdGguUEkqMixNYXRoLlBJKjJdO1xyXG5cdHZhciBTUVJUMiA9IE1hdGguc3FydCgyLjApKjAuNTtcclxuXHRjcnYuY29udHJvbFB0cyA9IFsgdmVjNC5jcmVhdGUoW2NlblswXStyYWRpdXMsY2VuWzFdLGNlblsyXSwxXSksXHJcblx0XHR2ZWM0LmNyZWF0ZShbKGNlblswXStyYWRpdXMpKlNRUlQyLChjZW5bMV0rcmFkaXVzKSpTUVJUMixjZW5bMl0qU1FSVDIsU1FSVDJdKSxcclxuXHRcdHZlYzQuY3JlYXRlKFtjZW5bMF0sY2VuWzFdK3JhZGl1cyxjZW5bMl0sMV0pLFxyXG5cdFx0dmVjNC5jcmVhdGUoWyhjZW5bMF0tcmFkaXVzKSpTUVJUMiwoY2VuWzFdK3JhZGl1cykqU1FSVDIsY2VuWzJdKlNRUlQyLFNRUlQyXSksXHJcblx0XHR2ZWM0LmNyZWF0ZShbY2VuWzBdLXJhZGl1cyxjZW5bMV0sY2VuWzJdLDFdKSxcclxuXHRcdHZlYzQuY3JlYXRlKFsoY2VuWzBdLXJhZGl1cykqU1FSVDIsKGNlblsxXS1yYWRpdXMpKlNRUlQyLGNlblsyXSpTUVJUMixTUVJUMl0pLFxyXG5cdFx0dmVjNC5jcmVhdGUoW2NlblswXSxjZW5bMV0tcmFkaXVzLGNlblsyXSwxXSksXHJcblx0XHR2ZWM0LmNyZWF0ZShbKGNlblswXStyYWRpdXMpKlNRUlQyLChjZW5bMV0tcmFkaXVzKSpTUVJUMixjZW5bMl0qU1FSVDIsU1FSVDJdKSxcclxuXHRcdHZlYzQuY3JlYXRlKFtjZW5bMF0rcmFkaXVzLGNlblsxXSxjZW5bMl0sMV0pIF07XHJcblx0cmV0dXJuIGNydjtcclxufVx0XHJcblxyXG5cclxuLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vL05VUkJTIFNVUkZBQ0VTXHJcbi8vXHJcbm51cmJzLmNyZWF0ZVNyZiA9IGZ1bmN0aW9uKCkge1xyXG5cdHZhciBzcmYgPSB7fTtcclxuXHRzcmYua25vdHNVID0gW107XHJcblx0c3JmLmtub3RzViA9IFtdO1xyXG5cdHNyZi5jb250cm9sUHRzID0gW107XHJcblx0c3JmLmRlZ3JlZVUgPSBbXTtcclxuXHRzcmYuZGVncmVlViA9IFtdO1xyXG5cdHJldHVybiBzcmY7XHJcbn1cclxuXHJcblxyXG5udXJicy5ldmFsdWF0ZVNyZiA9IGZ1bmN0aW9uKHNyZix1LHYscHQpIHtcclxuXHRwdCA9IHB0IHx8IHZlYzMuY3JlYXRlKCk7XHJcblx0Ly9pZihjb250cm9sUHRzLmxlbmd0aCA9PSAwKSByZXR1cm4gbmV3IFBWZWN0b3IoKTtcclxuXHR2YXIgdUtub3QgPSBudXJicy5maW5kS25vdChzcmYua25vdHNVLHUsc3JmLmRlZ3JlZVUpO1xyXG5cdHZhciB2S25vdCA9IG51cmJzLmZpbmRLbm90KHNyZi5rbm90c1YsdixzcmYuZGVncmVlVik7XHJcblx0bnVyYnMuYmFzaXNGdW5jdGlvbnMoc3JmLmtub3RzVSwgc3JmLmRlZ3JlZVUsIHVLbm90LHUsbnVyYnMuYmFzaXNGdW5jc1UpO1xyXG5cdG51cmJzLmJhc2lzRnVuY3Rpb25zKHNyZi5rbm90c1YsIHNyZi5kZWdyZWVWLCB2S25vdCx2LG51cmJzLmJhc2lzRnVuY3NWKTtcclxuXHRcclxuXHR2YXIgZXZhbFB0ID0gdmVjNC5jcmVhdGUoKTtcclxuXHR2YXIgdGVtcCA9IFtdO1xyXG5cdHZhciBpLGo7XHJcblx0Ly9hdm9pZCBjcmVhdGUgY29tbWFuZHNcclxuXHRmb3IoaT0wO2k8PXNyZi5kZWdyZWVWOysraSkge1xyXG5cdFx0dGVtcFtpXSA9IHZlYzQuY3JlYXRlKCk7XHJcblx0XHRmb3Ioaj0wO2o8PXNyZi5kZWdyZWVVOysraikge1xyXG5cdFx0XHR2ZWM0LmFkZCh0ZW1wW2ldLHZlYzQuc2NhbGUoc3JmLmNvbnRyb2xQdHNbdUtub3Qtc3JmLmRlZ3JlZVUral1bdktub3Qtc3JmLmRlZ3JlZVYraV0sIG51cmJzLmJhc2lzRnVuY3NVW2pdLGV2YWxQdCkpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRcclxuXHR2ZWM0LnNldChbMCwwLDAsMF0sZXZhbFB0KTtcclxuXHRmb3IoaT0wO2k8PXNyZi5kZWdyZWVWOysraSkge1xyXG5cdFx0dmVjNC5hZGQoZXZhbFB0LCB2ZWM0LnNjYWxlKHRlbXBbaV0sbnVyYnMuYmFzaXNGdW5jc1ZbaV0pKTtcclxuXHR9XHJcblx0cmV0dXJuIHZlYzQucHJvamVjdERvd24oZXZhbFB0LHB0KTtcclxufVxyXG5cdC8qXHJcblxyXG5cdE51cmJzQ3VydmUgaXNvY3VydmUoZmxvYXQgdSwgYm9vbGVhbiBkaXIpIHtcclxuXHRcdGludCB1S25vdCA9IGZpbmRLbm90KHUsa25vdHNVLGRlZ3JlZVUpO1xyXG5cdFx0ZmxvYXRbXSBiYXNGdW5jID0gYmFzaXNGdW5jdGlvbnModUtub3QsdSxrbm90c1UsZGVncmVlVSk7XHJcblx0XHRWZWN0b3I0RFtdW10gaFB0cyA9IG5ldyBWZWN0b3I0RFtkZWdyZWVVKzFdW2RlZ3JlZVYrMV07XHJcblx0XHRmb3IoaW50IGk9MDtpPGNvbnRyb2xQdHMubGVuZ3RoOysraSkge1xyXG5cdFx0XHRmb3IoaW50IGo9MDtqPGNvbnRyb2xQdHNbMF0ubGVuZ3RoOysraikge1xyXG5cdFx0XHRcdFBWZWN0b3IgY3RybFB0ID0gY29udHJvbFB0c1tpXVtqXTtcclxuXHRcdFx0XHRmbG9hdCB3ID0gd2VpZ2h0c1tpXVtqXTtcclxuXHRcdFx0XHRoUHRzW2ldW2pdID0gbmV3IFZlY3RvcjREKGN0cmxQdC54KncsIGN0cmxQdC55KncsY3RybFB0Lnoqdyx3KTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0VmVjdG9yNERbXSBuZXdQdHMgPSBuZXcgVmVjdG9yNERbY29udHJvbFB0c1swXS5sZW5ndGhdO1xyXG5cdFx0Zm9yKGludCBpPTA7aTxjb250cm9sUHRzWzBdLmxlbmd0aDsrK2kpIHtcclxuXHRcdFx0Zm9yKGludCBqPTA7ajw9ZGVncmVlVTsrK2opIHtcclxuXHRcdFx0XHRuZXdQdHNbaV0gPSBWZWN0b3I0RC5hZGQobmV3UHRzW2ldLFZlY3RvcjRELm11bHRpcGx5KGhQdHNbdUtub3QtZGVncmVlVStqXVtpXSwgYmFzRnVuY1tqXSkpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRcclxuXHRcdFBWZWN0b3JbXSBuZXdDUHRzID0gbmV3IFBWZWN0b3JbbmV3UHRzLmxlbmd0aF07XHJcblx0XHRmbG9hdFtdIG5ld1dlaWdodHMgPSBuZXcgZmxvYXRbbmV3UHRzLmxlbmd0aF07XHJcblx0XHRmb3IoaW50IGk9MDtpPG5ld1B0cy5sZW5ndGg7KytpKSB7XHJcblx0XHRcdG5ld0NQdHNbaV0gPSBuZXcgUFZlY3RvcihuZXdQdHNbaV0ueCpuZXdQdHNbaV0udyxuZXdQdHNbaV0ueSpuZXdQdHNbaV0udyxuZXdQdHNbaV0ueipuZXdQdHNbaV0udyk7XHJcblx0XHRcdG5ld1dlaWdodHNbaV0gPSBuZXdQdHNbaV0udztcclxuXHRcdH1cclxuXHRcdHJldHVybiBuZXcgTnVyYnNDdXJ2ZShuZXdDUHRzLCBrbm90c1YsIG5ld1dlaWdodHMsIGRlZ3JlZVYpO1xyXG5cdH1cclxuXHRcclxuXHQqL1xyXG5cdFxyXG5udXJicy5sb2Z0ID0gZnVuY3Rpb24oY3J2MSxjcnYyKSB7XHJcblx0Ly9kbyBkZWdyZWUgZWxldmF0aW9uXHJcblx0aWYoY3J2MS5kZWdyZWUgIT0gY3J2Mi5kZWdyZWUpIHJldHVybiBudWxsO1xyXG5cdHZhciB0ZW1wMSA9IG51cmJzLmNvcHlDcnYoY3J2MSk7XHJcblx0dmFyIHRlbXAyID0gbnVyYnMuY29weUNydihjcnYyKTtcclxuXHRudXJicy5ub3JtYWxpemVLbm90cyh0ZW1wMSk7XHJcblx0bnVyYnMubm9ybWFsaXplS25vdHModGVtcDIpO1xyXG5cdC8vZmluZCBkaWZmZXJlbmNlXHJcblx0dmFyIGsgPSAwLGk7XHJcblx0dmFyIGluc2VydFRlbXAxID0gW107XHJcblx0dmFyIGluc2VydFRlbXAyID0gW107XHJcblx0Zm9yKGk9MDtpPHRlbXAxLmtub3RzLmxlbmd0aDsrK2kpIHtcclxuXHRcdHdoaWxlKGsgPCB0ZW1wMi5rbm90cy5sZW5ndGggJiYgdGVtcDIua25vdHNba10gPCB0ZW1wMS5rbm90c1tpXSApIHtcclxuXHRcdFx0aW5zZXJ0VGVtcDEucHVzaCh0ZW1wMi5rbm90c1trXSk7XHJcblx0XHRcdCsraztcclxuXHRcdH1cclxuXHRcdGlmKHRlbXAyLmtub3RzW2tdID4gdGVtcDEua25vdHNbaV0pIGluc2VydFRlbXAyLnB1c2godGVtcDEua25vdHNbaV0pO1xyXG5cdFx0aWYodGVtcDIua25vdHNba10gPT0gdGVtcDEua25vdHNbaV0pICsraztcclxuXHR9XHJcblx0d2hpbGUoazx0ZW1wMi5rbm90cy5sZW5ndGgpIHtcclxuXHRcdGluc2VydFRlbXAxLnB1c2godGVtcDIua25vdHNba10pO1xyXG5cdFx0KytrO1xyXG5cdH1cclxuXHRpZihpbnNlcnRUZW1wMS5sZW5ndGggPiAwKSBudXJicy5pbnNlcnRLbm90cyh0ZW1wMSxpbnNlcnRUZW1wMSk7XHJcblx0aWYoaW5zZXJ0VGVtcDIubGVuZ3RoID4gMCkgbnVyYnMuaW5zZXJ0S25vdHModGVtcDIsaW5zZXJ0VGVtcDIpO1xyXG5cdFxyXG5cdHZhciBwdHMgPSBuZXcgQXJyYXkodGVtcDEuY29udHJvbFB0cy5sZW5ndGgpO1xyXG5cdGZvcihpPTA7aTxwdHMubGVuZ3RoOysraSkge1xyXG5cdFx0cHRzW2ldID0gW3RlbXAxLmNvbnRyb2xQdHNbaV0sIHRlbXAyLmNvbnRyb2xQdHNbaV1dO1xyXG5cdH1cclxuXHRcclxuXHR2YXIgdG9SZXR1cm4gPSBudXJicy5jcmVhdGVTcmYoKTtcclxuXHR0b1JldHVybi5jb250cm9sUHRzID0gcHRzO1xyXG5cdHRvUmV0dXJuLmRlZ3JlZVUgPSB0ZW1wMS5kZWdyZWU7XHJcblx0dG9SZXR1cm4uZGVncmVlViA9IDE7XHJcblx0dG9SZXR1cm4ua25vdHNWID0gWzAsMCwxLDFdOyAvL3RoaXMgbWlnaHQgYmUgd3JvbmdcclxuXHRmb3IoaT0wO2k8dGVtcDEua25vdHMubGVuZ3RoOysraSkge1xyXG5cdFx0dG9SZXR1cm4ua25vdHNVW2ldID0gdGVtcDEua25vdHNbaV07XHJcblx0fVxyXG5cdHJldHVybiB0b1JldHVybjtcclxufVxyXG5cclxuLy9yZXZvbHZlXHJcbm51cmJzLnJldm9sdmUgPSBmdW5jdGlvbihjcnYsIGF4aXMpIHtcclxuXHJcbn1cclxuXHJcbm51cmJzLnN3ZWVwID0gZnVuY3Rpb24oY3J2MSxjcnYyKSB7XHJcblxyXG59IiwiLypcclxuICogUG9seTJUcmkgQ29weXJpZ2h0IChjKSAyMDA5LTIwMTMsIFBvbHkyVHJpIENvbnRyaWJ1dG9yc1xyXG4gKiBodHRwOi8vY29kZS5nb29nbGUuY29tL3AvcG9seTJ0cmkvXHJcbiAqXHJcbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXHJcbiAqXHJcbiAqIFJlZGlzdHJpYnV0aW9uIGFuZCB1c2UgaW4gc291cmNlIGFuZCBiaW5hcnkgZm9ybXMsIHdpdGggb3Igd2l0aG91dCBtb2RpZmljYXRpb24sXHJcbiAqIGFyZSBwZXJtaXR0ZWQgcHJvdmlkZWQgdGhhdCB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnMgYXJlIG1ldDpcclxuICpcclxuICogKiBSZWRpc3RyaWJ1dGlvbnMgb2Ygc291cmNlIGNvZGUgbXVzdCByZXRhaW4gdGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UsXHJcbiAqICAgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lci5cclxuICogKiBSZWRpc3RyaWJ1dGlvbnMgaW4gYmluYXJ5IGZvcm0gbXVzdCByZXByb2R1Y2UgdGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UsXHJcbiAqICAgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lciBpbiB0aGUgZG9jdW1lbnRhdGlvblxyXG4gKiAgIGFuZC9vciBvdGhlciBtYXRlcmlhbHMgcHJvdmlkZWQgd2l0aCB0aGUgZGlzdHJpYnV0aW9uLlxyXG4gKiAqIE5laXRoZXIgdGhlIG5hbWUgb2YgUG9seTJUcmkgbm9yIHRoZSBuYW1lcyBvZiBpdHMgY29udHJpYnV0b3JzIG1heSBiZVxyXG4gKiAgIHVzZWQgdG8gZW5kb3JzZSBvciBwcm9tb3RlIHByb2R1Y3RzIGRlcml2ZWQgZnJvbSB0aGlzIHNvZnR3YXJlIHdpdGhvdXQgc3BlY2lmaWNcclxuICogICBwcmlvciB3cml0dGVuIHBlcm1pc3Npb24uXHJcbiAqXHJcbiAqIFRISVMgU09GVFdBUkUgSVMgUFJPVklERUQgQlkgVEhFIENPUFlSSUdIVCBIT0xERVJTIEFORCBDT05UUklCVVRPUlNcclxuICogXCJBUyBJU1wiIEFORCBBTlkgRVhQUkVTUyBPUiBJTVBMSUVEIFdBUlJBTlRJRVMsIElOQ0xVRElORywgQlVUIE5PVFxyXG4gKiBMSU1JVEVEIFRPLCBUSEUgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSBBTkQgRklUTkVTUyBGT1JcclxuICogQSBQQVJUSUNVTEFSIFBVUlBPU0UgQVJFIERJU0NMQUlNRUQuIElOIE5PIEVWRU5UIFNIQUxMIFRIRSBDT1BZUklHSFQgT1dORVIgT1JcclxuICogQ09OVFJJQlVUT1JTIEJFIExJQUJMRSBGT1IgQU5ZIERJUkVDVCwgSU5ESVJFQ1QsIElOQ0lERU5UQUwsIFNQRUNJQUwsXHJcbiAqIEVYRU1QTEFSWSwgT1IgQ09OU0VRVUVOVElBTCBEQU1BR0VTIChJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTyxcclxuICogUFJPQ1VSRU1FTlQgT0YgU1VCU1RJVFVURSBHT09EUyBPUiBTRVJWSUNFUzsgTE9TUyBPRiBVU0UsIERBVEEsIE9SXHJcbiAqIFBST0ZJVFM7IE9SIEJVU0lORVNTIElOVEVSUlVQVElPTikgSE9XRVZFUiBDQVVTRUQgQU5EIE9OIEFOWSBUSEVPUlkgT0ZcclxuICogTElBQklMSVRZLCBXSEVUSEVSIElOIENPTlRSQUNULCBTVFJJQ1QgTElBQklMSVRZLCBPUiBUT1JUIChJTkNMVURJTkdcclxuICogTkVHTElHRU5DRSBPUiBPVEhFUldJU0UpIEFSSVNJTkcgSU4gQU5ZIFdBWSBPVVQgT0YgVEhFIFVTRSBPRiBUSElTXHJcbiAqIFNPRlRXQVJFLCBFVkVOIElGIEFEVklTRUQgT0YgVEhFIFBPU1NJQklMSVRZIE9GIFNVQ0ggREFNQUdFLlxyXG4gKi9cclxuXHJcbi8qIGpzaGludCBicm93c2VyOmZhbHNlLCBmb3Jpbjp0cnVlLCBub2FyZzp0cnVlLCBub2VtcHR5OnRydWUsIGVxZXFlcTp0cnVlLCBiaXR3aXNlOnRydWUsIFxyXG4gICBzdHJpY3Q6dHJ1ZSwgdW5kZWY6dHJ1ZSwgdW51c2VkOnRydWUsIGN1cmx5OnRydWUsIGltbWVkOnRydWUsIGxhdGVkZWY6dHJ1ZSwgXHJcbiAgIG5ld2NhcDp0cnVlLCB0cmFpbGluZzp0cnVlLCBtYXhjb21wbGV4aXR5OjExLCBpbmRlbnQ6NCBcclxuICovXHJcblxyXG4vKlxyXG4gIGVkaXRlZCBieSBOZXJ2b3VzIFN5c3RlbSwgMjAxNFxyXG4qL1xyXG5cclxuLypcclxuICogTm90ZVxyXG4gKiA9PT09XHJcbiAqIHRoZSBzdHJ1Y3R1cmUgb2YgdGhpcyBKYXZhU2NyaXB0IHZlcnNpb24gb2YgcG9seTJ0cmkgaW50ZW50aW9ubmFseSBmb2xsb3dzXHJcbiAqIGFzIGNsb3NlbHkgYXMgcG9zc2libGUgdGhlIHN0cnVjdHVyZSBvZiB0aGUgcmVmZXJlbmNlIEMrKyB2ZXJzaW9uLCB0byBtYWtlIGl0IFxyXG4gKiBlYXNpZXIgdG8ga2VlcCB0aGUgMiB2ZXJzaW9ucyBpbiBzeW5jLlxyXG4gKi9cclxuXHJcblxyXG4vKipcclxuICogTW9kdWxlIGVuY2Fwc3VsYXRpb25cclxuICogQHBhcmFtIHtPYmplY3R9IGdsb2JhbCBhIHJlZmVyZW5jZSB0byB0aGUgZ2xvYmFsIG9iamVjdCA6XHJcbiAqICAgICAgICAgICAgICAgICAgICAgIHdpbmRvdyBpbiB0aGUgYnJvd3NlciwgZ2xvYmFsIG9uIHRoZSBzZXJ2ZXJcclxuICovXHJcbihmdW5jdGlvbihnbG9iYWwpIHtcclxuICAgIFwidXNlIHN0cmljdFwiO1xyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1wb2x5MnRyaSBtb2R1bGVcclxuXHJcbiAgICAvLyBTYXZlIHRoZSBwcmV2aW91cyB2YWx1ZSBvZiB0aGUgcG9seTJ0cmkgdmFyaWFibGUsIFxyXG4gICAgLy8gc28gdGhhdCBpdCBjYW4gYmUgcmVzdG9yZWQgbGF0ZXIgb24sIGlmIG5vQ29uZmxpY3QgaXMgdXNlZC5cclxuICAgIFxyXG4gICAgdmFyIHByZXZpb3VzUG9seTJ0cmkgPSBnbG9iYWwucG9seTJ0cmk7XHJcblxyXG4gICAgLy8gVGhlIHRvcC1sZXZlbCBuYW1lc3BhY2UuIEFsbCBwdWJsaWMgcG9seTJ0cmkgY2xhc3NlcyBhbmQgZnVuY3Rpb25zIHdpbGxcclxuICAgIC8vIGJlIGF0dGFjaGVkIHRvIGl0LiBFeHBvcnRlZCBmb3IgYm90aCB0aGUgYnJvd3NlciBhbmQgdGhlIHNlcnZlciAoTm9kZS5qcykuXHJcbiAgICB2YXIgcG9seTJ0cmk7XHJcbiAgICAvKiBnbG9iYWwgZXhwb3J0cyAqL1xyXG4gICAgXHJcbiAgICBpZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgcG9seTJ0cmkgPSBleHBvcnRzO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBwb2x5MnRyaSA9IGdsb2JhbC5wb2x5MnRyaSA9IHt9O1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFJ1bnMgdGhlIGxpYnJhcnkgaW4gbm9Db25mbGljdCBtb2RlLCByZXR1cm5pbmcgdGhlIHBvbHkydHJpIHZhcmlhYmxlIFxyXG4gICAgLy8gdG8gaXRzIHByZXZpb3VzIG93bmVyLiBSZXR1cm5zIGEgcmVmZXJlbmNlIHRvIHRoaXMgbGlicmFyeSBvYmplY3QuXHJcbiAgICBwb2x5MnRyaS5ub0NvbmZsaWN0ID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgZ2xvYmFsLnBvbHkydHJpID0gcHJldmlvdXNQb2x5MnRyaTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH07XHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tUG9pbnRFcnJvclxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3VzdG9tIGV4Y2VwdGlvbiBjbGFzcyB0byBpbmRpY2F0ZSBpbnZhbGlkIFBvaW50IHZhbHVlc1xyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UgICAgICAgICAgZXJyb3IgbWVzc2FnZVxyXG4gICAgICogQHBhcmFtIHthcnJheTxQb2ludD59IHBvaW50cyAgICAgaW52YWxpZCBwb2ludHNcclxuICAgICAqL1xyXG4gICAgLy8gQ2xhc3MgYWRkZWQgaW4gdGhlIEphdmFTY3JpcHQgdmVyc2lvbiAod2FzIG5vdCBwcmVzZW50IGluIHRoZSBjKysgdmVyc2lvbilcclxuICAgIHZhciBQb2ludEVycm9yID0gZnVuY3Rpb24gKG1lc3NhZ2UsIHBvaW50cykge1xyXG4gICAgICAgIHRoaXMubmFtZSAgICA9IFwiUG9pbnRFcnJvclwiO1xyXG4gICAgICAgIHRoaXMucG9pbnRzICA9IHBvaW50cyA9IHBvaW50cyB8fCBbXTtcclxuICAgICAgICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlIHx8IFwiSW52YWxpZCBQb2ludHMhXCI7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwb2ludHMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgdGhpcy5tZXNzYWdlICs9IFwiIFwiICsgUG9pbnQudG9TdHJpbmcocG9pbnRzW2ldKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgUG9pbnRFcnJvci5wcm90b3R5cGUgPSBuZXcgRXJyb3IoKTtcclxuICAgIFBvaW50RXJyb3IucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gUG9pbnRFcnJvcjtcclxuXHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1Qb2ludFxyXG4gICAgLyoqXHJcbiAgICAgKiBDb25zdHJ1Y3QgYSBwb2ludFxyXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHggICAgY29vcmRpbmF0ZSAoMCBpZiB1bmRlZmluZWQpXHJcbiAgICAgKiBAcGFyYW0ge051bWJlcn0geSAgICBjb29yZGluYXRlICgwIGlmIHVuZGVmaW5lZClcclxuICAgICAqL1xyXG4gICAgdmFyIFBvaW50ID0gZnVuY3Rpb24oeCwgeSkge1xyXG4gICAgICAgIHRoaXMueCA9ICt4IHx8IDA7XHJcbiAgICAgICAgdGhpcy55ID0gK3kgfHwgMDtcclxuXHJcbiAgICAgICAgLy8gQWxsIGV4dHJhIGZpZWxkcyBhZGRlZCB0byBQb2ludCBhcmUgcHJlZml4ZWQgd2l0aCBfcDJ0X1xyXG4gICAgICAgIC8vIHRvIGF2b2lkIGNvbGxpc2lvbnMgaWYgY3VzdG9tIFBvaW50IGNsYXNzIGlzIHVzZWQuXHJcblxyXG4gICAgICAgIC8vIFRoZSBlZGdlcyB0aGlzIHBvaW50IGNvbnN0aXR1dGVzIGFuIHVwcGVyIGVuZGluZyBwb2ludFxyXG4gICAgICAgIHRoaXMuX3AydF9lZGdlX2xpc3QgPSBudWxsO1xyXG4gICAgfTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIEZvciBwcmV0dHkgcHJpbnRpbmcgZXguIDxpPlwiKDU7NDIpXCI8L2k+KVxyXG4gICAgICovXHJcbiAgICBQb2ludC5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gKFwiKFwiICsgdGhpcy54ICsgXCI7XCIgKyB0aGlzLnkgKyBcIilcIik7XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhIGNvcHkgb2YgdGhpcyBQb2ludCBvYmplY3QuXHJcbiAgICAgKiBAcmV0dXJucyBQb2ludFxyXG4gICAgICovXHJcbiAgICBQb2ludC5wcm90b3R5cGUuY2xvbmUgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gbmV3IFBvaW50KHRoaXMueCwgdGhpcy55KTtcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTZXQgdGhpcyBQb2ludCBpbnN0YW5jZSB0byB0aGUgb3JpZ28uIDxjb2RlPigwOyAwKTwvY29kZT5cclxuICAgICAqL1xyXG4gICAgUG9pbnQucHJvdG90eXBlLnNldF96ZXJvID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdGhpcy54ID0gMC4wO1xyXG4gICAgICAgIHRoaXMueSA9IDAuMDtcclxuICAgICAgICByZXR1cm4gdGhpczsgLy8gZm9yIGNoYWluaW5nXHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogU2V0IHRoZSBjb29yZGluYXRlcyBvZiB0aGlzIGluc3RhbmNlLlxyXG4gICAgICogQHBhcmFtICAgeCAgIG51bWJlci5cclxuICAgICAqIEBwYXJhbSAgIHkgICBudW1iZXI7XHJcbiAgICAgKi9cclxuICAgIFBvaW50LnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbih4LCB5KSB7XHJcbiAgICAgICAgdGhpcy54ID0gK3ggfHwgMDtcclxuICAgICAgICB0aGlzLnkgPSAreSB8fCAwO1xyXG4gICAgICAgIHJldHVybiB0aGlzOyAvLyBmb3IgY2hhaW5pbmdcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBOZWdhdGUgdGhpcyBQb2ludCBpbnN0YW5jZS4gKGNvbXBvbmVudC13aXNlKVxyXG4gICAgICovXHJcbiAgICBQb2ludC5wcm90b3R5cGUubmVnYXRlID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdGhpcy54ID0gLXRoaXMueDtcclxuICAgICAgICB0aGlzLnkgPSAtdGhpcy55O1xyXG4gICAgICAgIHJldHVybiB0aGlzOyAvLyBmb3IgY2hhaW5pbmdcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBZGQgYW5vdGhlciBQb2ludCBvYmplY3QgdG8gdGhpcyBpbnN0YW5jZS4gKGNvbXBvbmVudC13aXNlKVxyXG4gICAgICogQHBhcmFtICAgbiAgIFBvaW50IG9iamVjdC5cclxuICAgICAqL1xyXG4gICAgUG9pbnQucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKG4pIHtcclxuICAgICAgICB0aGlzLnggKz0gbi54O1xyXG4gICAgICAgIHRoaXMueSArPSBuLnk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7IC8vIGZvciBjaGFpbmluZ1xyXG4gICAgfTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFN1YnRyYWN0IHRoaXMgUG9pbnQgaW5zdGFuY2Ugd2l0aCBhbm90aGVyIHBvaW50IGdpdmVuLiAoY29tcG9uZW50LXdpc2UpXHJcbiAgICAgKiBAcGFyYW0gICBuICAgUG9pbnQgb2JqZWN0LlxyXG4gICAgICovXHJcbiAgICBQb2ludC5wcm90b3R5cGUuc3ViID0gZnVuY3Rpb24obikge1xyXG4gICAgICAgIHRoaXMueCAtPSBuLng7XHJcbiAgICAgICAgdGhpcy55IC09IG4ueTtcclxuICAgICAgICByZXR1cm4gdGhpczsgLy8gZm9yIGNoYWluaW5nXHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogTXVsdGlwbHkgdGhpcyBQb2ludCBpbnN0YW5jZSBieSBhIHNjYWxhci4gKGNvbXBvbmVudC13aXNlKVxyXG4gICAgICogQHBhcmFtICAgcyAgIHNjYWxhci5cclxuICAgICAqL1xyXG4gICAgUG9pbnQucHJvdG90eXBlLm11bCA9IGZ1bmN0aW9uKHMpIHtcclxuICAgICAgICB0aGlzLnggKj0gcztcclxuICAgICAgICB0aGlzLnkgKj0gcztcclxuICAgICAgICByZXR1cm4gdGhpczsgLy8gZm9yIGNoYWluaW5nXHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmV0dXJuIHRoZSBkaXN0YW5jZSBvZiB0aGlzIFBvaW50IGluc3RhbmNlIGZyb20gdGhlIG9yaWdvLlxyXG4gICAgICovXHJcbiAgICBQb2ludC5wcm90b3R5cGUubGVuZ3RoID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcmV0dXJuIE1hdGguc3FydCh0aGlzLnggKiB0aGlzLnggKyB0aGlzLnkgKiB0aGlzLnkpO1xyXG4gICAgfTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIE5vcm1hbGl6ZSB0aGlzIFBvaW50IGluc3RhbmNlIChhcyBhIHZlY3RvcikuXHJcbiAgICAgKiBAcmV0dXJuIFRoZSBvcmlnaW5hbCBkaXN0YW5jZSBvZiB0aGlzIGluc3RhbmNlIGZyb20gdGhlIG9yaWdvLlxyXG4gICAgICovXHJcbiAgICBQb2ludC5wcm90b3R5cGUubm9ybWFsaXplID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoKCk7XHJcbiAgICAgICAgdGhpcy54IC89IGxlbjtcclxuICAgICAgICB0aGlzLnkgLz0gbGVuO1xyXG4gICAgICAgIHJldHVybiBsZW47XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogVGVzdCB0aGlzIFBvaW50IG9iamVjdCB3aXRoIGFub3RoZXIgZm9yIGVxdWFsaXR5LlxyXG4gICAgICogQHBhcmFtICAgcCAgIGFueSBcIlBvaW50IGxpa2VcIiBvYmplY3Qgd2l0aCB7eCx5fSAoZHVjayB0eXBpbmcpXHJcbiAgICAgKiBAcmV0dXJuIDxjb2RlPlRydWU8L2NvZGU+IGlmIDxjb2RlPnRoaXMgPT0gcDwvY29kZT4sIDxjb2RlPmZhbHNlPC9jb2RlPiBvdGhlcndpc2UuXHJcbiAgICAgKi9cclxuICAgIFBvaW50LnByb3RvdHlwZS5lcXVhbHMgPSBmdW5jdGlvbihwKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMueCA9PT0gcC54ICYmIHRoaXMueSA9PT0gcC55O1xyXG4gICAgfTtcclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tUG9pbnQgKFwic3RhdGljXCIgbWV0aG9kcylcclxuXHJcbiAgICAvKipcclxuICAgICAqIE5lZ2F0ZSBhIHBvaW50IGNvbXBvbmVudC13aXNlIGFuZCByZXR1cm4gdGhlIHJlc3VsdCBhcyBhIG5ldyBQb2ludCBvYmplY3QuXHJcbiAgICAgKiBAcGFyYW0gICBwICAgUG9pbnQgb2JqZWN0LlxyXG4gICAgICogQHJldHVybiB0aGUgcmVzdWx0aW5nIFBvaW50IG9iamVjdC5cclxuICAgICAqL1xyXG4gICAgUG9pbnQubmVnYXRlID0gZnVuY3Rpb24ocCkge1xyXG4gICAgICAgIHJldHVybiBuZXcgUG9pbnQoLXAueCwgLXAueSk7XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQWRkIHR3byBwb2ludHMgY29tcG9uZW50LXdpc2UgYW5kIHJldHVybiB0aGUgcmVzdWx0IGFzIGEgbmV3IFBvaW50IG9iamVjdC5cclxuICAgICAqIEBwYXJhbSAgIGEgICBQb2ludCBvYmplY3QuXHJcbiAgICAgKiBAcGFyYW0gICBiICAgUG9pbnQgb2JqZWN0LlxyXG4gICAgICogQHJldHVybiB0aGUgcmVzdWx0aW5nIFBvaW50IG9iamVjdC5cclxuICAgICAqL1xyXG4gICAgUG9pbnQuYWRkID0gZnVuY3Rpb24oYSwgYikge1xyXG4gICAgICAgIHJldHVybiBuZXcgUG9pbnQoYS54ICsgYi54LCBhLnkgKyBiLnkpO1xyXG4gICAgfTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFN1YnRyYWN0IHR3byBwb2ludHMgY29tcG9uZW50LXdpc2UgYW5kIHJldHVybiB0aGUgcmVzdWx0IGFzIGEgbmV3IFBvaW50IG9iamVjdC5cclxuICAgICAqIEBwYXJhbSAgIGEgICBQb2ludCBvYmplY3QuXHJcbiAgICAgKiBAcGFyYW0gICBiICAgUG9pbnQgb2JqZWN0LlxyXG4gICAgICogQHJldHVybiB0aGUgcmVzdWx0aW5nIFBvaW50IG9iamVjdC5cclxuICAgICAqL1xyXG4gICAgUG9pbnQuc3ViID0gZnVuY3Rpb24oYSwgYikge1xyXG4gICAgICAgIHJldHVybiBuZXcgUG9pbnQoYS54IC0gYi54LCBhLnkgLSBiLnkpO1xyXG4gICAgfTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIE11bHRpcGx5IGEgcG9pbnQgYnkgYSBzY2FsYXIgYW5kIHJldHVybiB0aGUgcmVzdWx0IGFzIGEgbmV3IFBvaW50IG9iamVjdC5cclxuICAgICAqIEBwYXJhbSAgIHMgICB0aGUgc2NhbGFyIChhIG51bWJlcikuXHJcbiAgICAgKiBAcGFyYW0gICBwICAgUG9pbnQgb2JqZWN0LlxyXG4gICAgICogQHJldHVybiB0aGUgcmVzdWx0aW5nIFBvaW50IG9iamVjdC5cclxuICAgICAqL1xyXG4gICAgUG9pbnQubXVsID0gZnVuY3Rpb24ocywgcCkge1xyXG4gICAgICAgIHJldHVybiBuZXcgUG9pbnQocyAqIHAueCwgcyAqIHAueSk7XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogUGVyZm9ybSB0aGUgY3Jvc3MgcHJvZHVjdCBvbiBlaXRoZXIgdHdvIHBvaW50cyAodGhpcyBwcm9kdWNlcyBhIHNjYWxhcilcclxuICAgICAqIG9yIGEgcG9pbnQgYW5kIGEgc2NhbGFyICh0aGlzIHByb2R1Y2VzIGEgcG9pbnQpLlxyXG4gICAgICogVGhpcyBmdW5jdGlvbiByZXF1aXJlcyB0d28gcGFyYW1ldGVycywgZWl0aGVyIG1heSBiZSBhIFBvaW50IG9iamVjdCBvciBhXHJcbiAgICAgKiBudW1iZXIuXHJcbiAgICAgKiBAcGFyYW0gICBhICAgUG9pbnQgb2JqZWN0IG9yIHNjYWxhci5cclxuICAgICAqIEBwYXJhbSAgIGIgICBQb2ludCBvYmplY3Qgb3Igc2NhbGFyLlxyXG4gICAgICogQHJldHVybiAgYSAgIFBvaW50IG9iamVjdCBvciBhIG51bWJlciwgZGVwZW5kaW5nIG9uIHRoZSBwYXJhbWV0ZXJzLlxyXG4gICAgICovXHJcbiAgICBQb2ludC5jcm9zcyA9IGZ1bmN0aW9uKGEsIGIpIHtcclxuICAgICAgICBpZiAodHlwZW9mKGEpID09PSAnbnVtYmVyJykge1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mKGIpID09PSAnbnVtYmVyJykge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGEgKiBiO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBQb2ludCgtYSAqIGIueSwgYSAqIGIueCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mKGIpID09PSAnbnVtYmVyJykge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBQb2ludChiICogYS55LCAtYiAqIGEueCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYS54ICogYi55IC0gYS55ICogYi54O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVwiUG9pbnQtTGlrZVwiXHJcbiAgICAvKlxyXG4gICAgICogVGhlIGZvbGxvd2luZyBmdW5jdGlvbnMgb3BlcmF0ZSBvbiBcIlBvaW50XCIgb3IgYW55IFwiUG9pbnQgbGlrZVwiIG9iamVjdCBcclxuICAgICAqIHdpdGgge3gseX0gKGR1Y2sgdHlwaW5nKS5cclxuICAgICAqL1xyXG5cclxuXHJcbiAgICAvKipcclxuICAgICAqIFBvaW50IHByZXR0eSBwcmludGluZyBleC4gPGk+XCIoNTs0MilcIjwvaT4pXHJcbiAgICAgKiBAcGFyYW0gICBwICAgYW55IFwiUG9pbnQgbGlrZVwiIG9iamVjdCB3aXRoIHt4LHl9IFxyXG4gICAgICogQHJldHVybnMge1N0cmluZ31cclxuICAgICAqL1xyXG4gICAgUG9pbnQudG9TdHJpbmcgPSBmdW5jdGlvbihwKSB7XHJcbiAgICAgICAgLy8gVHJ5IGEgY3VzdG9tIHRvU3RyaW5nIGZpcnN0LCBhbmQgZmFsbGJhY2sgdG8gUG9pbnQucHJvdG90eXBlLnRvU3RyaW5nIGlmIG5vbmVcclxuICAgICAgICB2YXIgcyA9IHAudG9TdHJpbmcoKTtcclxuICAgICAgICByZXR1cm4gKHMgPT09ICdbb2JqZWN0IE9iamVjdF0nID8gUG9pbnQucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwocCkgOiBzKTtcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDb21wYXJlIHR3byBwb2ludHMgY29tcG9uZW50LXdpc2UuXHJcbiAgICAgKiBAcGFyYW0gICBhLGIgICBhbnkgXCJQb2ludCBsaWtlXCIgb2JqZWN0cyB3aXRoIHt4LHl9IFxyXG4gICAgICogQHJldHVybiA8Y29kZT4mbHQ7IDA8L2NvZGU+IGlmIDxjb2RlPmEgJmx0OyBiPC9jb2RlPiwgXHJcbiAgICAgKiAgICAgICAgIDxjb2RlPiZndDsgMDwvY29kZT4gaWYgPGNvZGU+YSAmZ3Q7IGI8L2NvZGU+LCBcclxuICAgICAqICAgICAgICAgPGNvZGU+MDwvY29kZT4gb3RoZXJ3aXNlLlxyXG4gICAgICovXHJcbiAgICBQb2ludC5jb21wYXJlID0gZnVuY3Rpb24oYSwgYikge1xyXG4gICAgICAgIGlmIChhLnkgPT09IGIueSkge1xyXG4gICAgICAgICAgICByZXR1cm4gYS54IC0gYi54O1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHJldHVybiBhLnkgLSBiLnk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIFBvaW50LmNtcCA9IFBvaW50LmNvbXBhcmU7IC8vIGJhY2t3YXJkIGNvbXBhdGliaWxpdHlcclxuXHJcbiAgICAvKipcclxuICAgICAqIFRlc3QgdHdvIFBvaW50IG9iamVjdHMgZm9yIGVxdWFsaXR5LlxyXG4gICAgICogQHBhcmFtICAgYSxiICAgYW55IFwiUG9pbnQgbGlrZVwiIG9iamVjdHMgd2l0aCB7eCx5fSBcclxuICAgICAqIEByZXR1cm4gPGNvZGU+VHJ1ZTwvY29kZT4gaWYgPGNvZGU+YSA9PSBiPC9jb2RlPiwgPGNvZGU+ZmFsc2U8L2NvZGU+IG90aGVyd2lzZS5cclxuICAgICAqL1xyXG4gICAgUG9pbnQuZXF1YWxzID0gZnVuY3Rpb24oYSwgYikge1xyXG4gICAgICAgIHJldHVybiBhLnggPT09IGIueCAmJiBhLnkgPT09IGIueTtcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBQZWZvcm0gdGhlIGRvdCBwcm9kdWN0IG9uIHR3byB2ZWN0b3JzLlxyXG4gICAgICogQHBhcmFtICAgYSxiICAgYW55IFwiUG9pbnQgbGlrZVwiIG9iamVjdHMgd2l0aCB7eCx5fSBcclxuICAgICAqIEByZXR1cm4gVGhlIGRvdCBwcm9kdWN0IChhcyBhIG51bWJlcikuXHJcbiAgICAgKi9cclxuICAgIFBvaW50LmRvdCA9IGZ1bmN0aW9uKGEsIGIpIHtcclxuICAgICAgICByZXR1cm4gYS54ICogYi54ICsgYS55ICogYi55O1xyXG4gICAgfTtcclxuXHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tRWRnZVxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXByZXNlbnRzIGEgc2ltcGxlIHBvbHlnb24ncyBlZGdlXHJcbiAgICAgKiBAcGFyYW0ge1BvaW50fSBwMVxyXG4gICAgICogQHBhcmFtIHtQb2ludH0gcDJcclxuICAgICAqL1xyXG4gICAgdmFyIEVkZ2UgPSBmdW5jdGlvbihwMSwgcDIpIHtcclxuICAgICAgICB0aGlzLnAgPSBwMTtcclxuICAgICAgICB0aGlzLnEgPSBwMjtcclxuXHJcbiAgICAgICAgaWYgKHAxLnkgPiBwMi55KSB7XHJcbiAgICAgICAgICAgIHRoaXMucSA9IHAxO1xyXG4gICAgICAgICAgICB0aGlzLnAgPSBwMjtcclxuICAgICAgICB9IGVsc2UgaWYgKHAxLnkgPT09IHAyLnkpIHtcclxuICAgICAgICAgICAgaWYgKHAxLnggPiBwMi54KSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnEgPSBwMTtcclxuICAgICAgICAgICAgICAgIHRoaXMucCA9IHAyO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHAxLnggPT09IHAyLngpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBQb2ludEVycm9yKCdwb2x5MnRyaSBJbnZhbGlkIEVkZ2UgY29uc3RydWN0b3I6IHJlcGVhdGVkIHBvaW50cyEnLCBbcDFdKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKCEgdGhpcy5xLl9wMnRfZWRnZV9saXN0KSB7XHJcbiAgICAgICAgICAgIHRoaXMucS5fcDJ0X2VkZ2VfbGlzdCA9IFtdO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLnEuX3AydF9lZGdlX2xpc3QucHVzaCh0aGlzKTtcclxuICAgIH07XHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1UcmlhbmdsZVxyXG4gICAgLyoqXHJcbiAgICAgKiBUcmlhbmdsZSBjbGFzcy48YnI+XHJcbiAgICAgKiBUcmlhbmdsZS1iYXNlZCBkYXRhIHN0cnVjdHVyZXMgYXJlIGtub3duIHRvIGhhdmUgYmV0dGVyIHBlcmZvcm1hbmNlIHRoYW5cclxuICAgICAqIHF1YWQtZWRnZSBzdHJ1Y3R1cmVzLlxyXG4gICAgICogU2VlOiBKLiBTaGV3Y2h1aywgXCJUcmlhbmdsZTogRW5naW5lZXJpbmcgYSAyRCBRdWFsaXR5IE1lc2ggR2VuZXJhdG9yIGFuZFxyXG4gICAgICogRGVsYXVuYXkgVHJpYW5ndWxhdG9yXCIsIFwiVHJpYW5ndWxhdGlvbnMgaW4gQ0dBTFwiXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSAgIGEsYixjICAgYW55IFwiUG9pbnQgbGlrZVwiIG9iamVjdHMgd2l0aCB7eCx5fSAoZHVjayB0eXBpbmcpXHJcbiAgICAgKi9cclxuICAgIHZhciBUcmlhbmdsZSA9IGZ1bmN0aW9uKGEsIGIsIGMpIHtcclxuICAgICAgICAvLyBUcmlhbmdsZSBwb2ludHNcclxuICAgICAgICB0aGlzLnBvaW50c18gPSBbYSwgYiwgY107XHJcbiAgICAgICAgLy8gTmVpZ2hib3IgbGlzdFxyXG4gICAgICAgIHRoaXMubmVpZ2hib3JzXyA9IFtudWxsLCBudWxsLCBudWxsXTtcclxuICAgICAgICAvLyBIYXMgdGhpcyB0cmlhbmdsZSBiZWVuIG1hcmtlZCBhcyBhbiBpbnRlcmlvciB0cmlhbmdsZT9cclxuICAgICAgICB0aGlzLmludGVyaW9yXyA9IGZhbHNlO1xyXG4gICAgICAgIC8vIEZsYWdzIHRvIGRldGVybWluZSBpZiBhbiBlZGdlIGlzIGEgQ29uc3RyYWluZWQgZWRnZVxyXG4gICAgICAgIHRoaXMuY29uc3RyYWluZWRfZWRnZSA9IFtmYWxzZSwgZmFsc2UsIGZhbHNlXTtcclxuICAgICAgICAvLyBGbGFncyB0byBkZXRlcm1pbmUgaWYgYW4gZWRnZSBpcyBhIERlbGF1bmV5IGVkZ2VcclxuICAgICAgICB0aGlzLmRlbGF1bmF5X2VkZ2UgPSBbZmFsc2UsIGZhbHNlLCBmYWxzZV07XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogRm9yIHByZXR0eSBwcmludGluZyBleC4gPGk+XCJbKDU7NDIpKDEwOzIwKSgyMTszMCldXCI8L2k+KVxyXG4gICAgICovXHJcbiAgICBUcmlhbmdsZS5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICB2YXIgcDJzID0gUG9pbnQudG9TdHJpbmc7XHJcbiAgICAgICAgcmV0dXJuIChcIltcIiArIHAycyh0aGlzLnBvaW50c19bMF0pICsgcDJzKHRoaXMucG9pbnRzX1sxXSkgKyBwMnModGhpcy5wb2ludHNfWzJdKSArIFwiXVwiKTtcclxuICAgIH07XHJcblxyXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLmdldFBvaW50ID0gZnVuY3Rpb24oaW5kZXgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5wb2ludHNfW2luZGV4XTtcclxuICAgIH07XHJcbiAgICAvLyBmb3IgYmFja3dhcmQgY29tcGF0aWJpbGl0eVxyXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLkdldFBvaW50ID0gVHJpYW5nbGUucHJvdG90eXBlLmdldFBvaW50O1xyXG5cclxuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5nZXROZWlnaGJvciA9IGZ1bmN0aW9uKGluZGV4KSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMubmVpZ2hib3JzX1tpbmRleF07XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogVGVzdCBpZiB0aGlzIFRyaWFuZ2xlIGNvbnRhaW5zIHRoZSBQb2ludCBvYmplY3QgZ2l2ZW4gYXMgcGFyYW1ldGVycyBhcyBpdHNcclxuICAgICAqIHZlcnRpY2VzLiBPbmx5IHBvaW50IHJlZmVyZW5jZXMgYXJlIGNvbXBhcmVkLCBub3QgdmFsdWVzLlxyXG4gICAgICogQHJldHVybiA8Y29kZT5UcnVlPC9jb2RlPiBpZiB0aGUgUG9pbnQgb2JqZWN0IGlzIG9mIHRoZSBUcmlhbmdsZSdzIHZlcnRpY2VzLFxyXG4gICAgICogICAgICAgICA8Y29kZT5mYWxzZTwvY29kZT4gb3RoZXJ3aXNlLlxyXG4gICAgICovXHJcbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuY29udGFpbnNQb2ludCA9IGZ1bmN0aW9uKHBvaW50KSB7XHJcbiAgICAgICAgdmFyIHBvaW50cyA9IHRoaXMucG9pbnRzXztcclxuICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlc1xyXG4gICAgICAgIHJldHVybiAocG9pbnQgPT09IHBvaW50c1swXSB8fCBwb2ludCA9PT0gcG9pbnRzWzFdIHx8IHBvaW50ID09PSBwb2ludHNbMl0pO1xyXG4gICAgfTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFRlc3QgaWYgdGhpcyBUcmlhbmdsZSBjb250YWlucyB0aGUgRWRnZSBvYmplY3QgZ2l2ZW4gYXMgcGFyYW1ldGVyIGFzIGl0c1xyXG4gICAgICogYm91bmRpbmcgZWRnZXMuIE9ubHkgcG9pbnQgcmVmZXJlbmNlcyBhcmUgY29tcGFyZWQsIG5vdCB2YWx1ZXMuXHJcbiAgICAgKiBAcmV0dXJuIDxjb2RlPlRydWU8L2NvZGU+IGlmIHRoZSBFZGdlIG9iamVjdCBpcyBvZiB0aGUgVHJpYW5nbGUncyBib3VuZGluZ1xyXG4gICAgICogICAgICAgICBlZGdlcywgPGNvZGU+ZmFsc2U8L2NvZGU+IG90aGVyd2lzZS5cclxuICAgICAqL1xyXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLmNvbnRhaW5zRWRnZSA9IGZ1bmN0aW9uKGVkZ2UpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5jb250YWluc1BvaW50KGVkZ2UucCkgJiYgdGhpcy5jb250YWluc1BvaW50KGVkZ2UucSk7XHJcbiAgICB9O1xyXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLmNvbnRhaW5zUG9pbnRzID0gZnVuY3Rpb24ocDEsIHAyKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuY29udGFpbnNQb2ludChwMSkgJiYgdGhpcy5jb250YWluc1BvaW50KHAyKTtcclxuICAgIH07XHJcblxyXG5cclxuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5pc0ludGVyaW9yID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuaW50ZXJpb3JfO1xyXG4gICAgfTtcclxuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5zZXRJbnRlcmlvciA9IGZ1bmN0aW9uKGludGVyaW9yKSB7XHJcbiAgICAgICAgdGhpcy5pbnRlcmlvcl8gPSBpbnRlcmlvcjtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBVcGRhdGUgbmVpZ2hib3IgcG9pbnRlcnMuXHJcbiAgICAgKiBAcGFyYW0ge1BvaW50fSBwMSBQb2ludCBvYmplY3QuXHJcbiAgICAgKiBAcGFyYW0ge1BvaW50fSBwMiBQb2ludCBvYmplY3QuXHJcbiAgICAgKiBAcGFyYW0ge1RyaWFuZ2xlfSB0IFRyaWFuZ2xlIG9iamVjdC5cclxuICAgICAqL1xyXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLm1hcmtOZWlnaGJvclBvaW50ZXJzID0gZnVuY3Rpb24ocDEsIHAyLCB0KSB7XHJcbiAgICAgICAgdmFyIHBvaW50cyA9IHRoaXMucG9pbnRzXztcclxuICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlc1xyXG4gICAgICAgIGlmICgocDEgPT09IHBvaW50c1syXSAmJiBwMiA9PT0gcG9pbnRzWzFdKSB8fCAocDEgPT09IHBvaW50c1sxXSAmJiBwMiA9PT0gcG9pbnRzWzJdKSkge1xyXG4gICAgICAgICAgICB0aGlzLm5laWdoYm9yc19bMF0gPSB0O1xyXG4gICAgICAgIH0gZWxzZSBpZiAoKHAxID09PSBwb2ludHNbMF0gJiYgcDIgPT09IHBvaW50c1syXSkgfHwgKHAxID09PSBwb2ludHNbMl0gJiYgcDIgPT09IHBvaW50c1swXSkpIHtcclxuICAgICAgICAgICAgdGhpcy5uZWlnaGJvcnNfWzFdID0gdDtcclxuICAgICAgICB9IGVsc2UgaWYgKChwMSA9PT0gcG9pbnRzWzBdICYmIHAyID09PSBwb2ludHNbMV0pIHx8IChwMSA9PT0gcG9pbnRzWzFdICYmIHAyID09PSBwb2ludHNbMF0pKSB7XHJcbiAgICAgICAgICAgIHRoaXMubmVpZ2hib3JzX1syXSA9IHQ7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdwb2x5MnRyaSBJbnZhbGlkIFRyaWFuZ2xlLm1hcmtOZWlnaGJvclBvaW50ZXJzKCkgY2FsbCcpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBFeGhhdXN0aXZlIHNlYXJjaCB0byB1cGRhdGUgbmVpZ2hib3IgcG9pbnRlcnNcclxuICAgICAqIEBwYXJhbSB7VHJpYW5nbGV9IHRcclxuICAgICAqL1xyXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLm1hcmtOZWlnaGJvciA9IGZ1bmN0aW9uKHQpIHtcclxuICAgICAgICB2YXIgcG9pbnRzID0gdGhpcy5wb2ludHNfO1xyXG4gICAgICAgIGlmICh0LmNvbnRhaW5zUG9pbnRzKHBvaW50c1sxXSwgcG9pbnRzWzJdKSkge1xyXG4gICAgICAgICAgICB0aGlzLm5laWdoYm9yc19bMF0gPSB0O1xyXG4gICAgICAgICAgICB0Lm1hcmtOZWlnaGJvclBvaW50ZXJzKHBvaW50c1sxXSwgcG9pbnRzWzJdLCB0aGlzKTtcclxuICAgICAgICB9IGVsc2UgaWYgKHQuY29udGFpbnNQb2ludHMocG9pbnRzWzBdLCBwb2ludHNbMl0pKSB7XHJcbiAgICAgICAgICAgIHRoaXMubmVpZ2hib3JzX1sxXSA9IHQ7XHJcbiAgICAgICAgICAgIHQubWFya05laWdoYm9yUG9pbnRlcnMocG9pbnRzWzBdLCBwb2ludHNbMl0sIHRoaXMpO1xyXG4gICAgICAgIH0gZWxzZSBpZiAodC5jb250YWluc1BvaW50cyhwb2ludHNbMF0sIHBvaW50c1sxXSkpIHtcclxuICAgICAgICAgICAgdGhpcy5uZWlnaGJvcnNfWzJdID0gdDtcclxuICAgICAgICAgICAgdC5tYXJrTmVpZ2hib3JQb2ludGVycyhwb2ludHNbMF0sIHBvaW50c1sxXSwgdGhpcyk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcblxyXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLmNsZWFyTmVpZ2JvcnMgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICB0aGlzLm5laWdoYm9yc19bMF0gPSBudWxsO1xyXG4gICAgICAgIHRoaXMubmVpZ2hib3JzX1sxXSA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5uZWlnaGJvcnNfWzJdID0gbnVsbDtcclxuICAgIH07XHJcblxyXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLmNsZWFyRGVsdW5heUVkZ2VzID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdGhpcy5kZWxhdW5heV9lZGdlWzBdID0gZmFsc2U7XHJcbiAgICAgICAgdGhpcy5kZWxhdW5heV9lZGdlWzFdID0gZmFsc2U7XHJcbiAgICAgICAgdGhpcy5kZWxhdW5heV9lZGdlWzJdID0gZmFsc2U7XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmV0dXJucyB0aGUgcG9pbnQgY2xvY2t3aXNlIHRvIHRoZSBnaXZlbiBwb2ludC5cclxuICAgICAqL1xyXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLnBvaW50Q1cgPSBmdW5jdGlvbihwKSB7XHJcbiAgICAgICAgdmFyIHBvaW50cyA9IHRoaXMucG9pbnRzXztcclxuICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlc1xyXG4gICAgICAgIGlmIChwID09PSBwb2ludHNbMF0pIHtcclxuICAgICAgICAgICAgcmV0dXJuIHBvaW50c1syXTtcclxuICAgICAgICB9IGVsc2UgaWYgKHAgPT09IHBvaW50c1sxXSkge1xyXG4gICAgICAgICAgICByZXR1cm4gcG9pbnRzWzBdO1xyXG4gICAgICAgIH0gZWxzZSBpZiAocCA9PT0gcG9pbnRzWzJdKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBwb2ludHNbMV07XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFJldHVybnMgdGhlIHBvaW50IGNvdW50ZXItY2xvY2t3aXNlIHRvIHRoZSBnaXZlbiBwb2ludC5cclxuICAgICAqL1xyXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLnBvaW50Q0NXID0gZnVuY3Rpb24ocCkge1xyXG4gICAgICAgIHZhciBwb2ludHMgPSB0aGlzLnBvaW50c187XHJcbiAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcclxuICAgICAgICBpZiAocCA9PT0gcG9pbnRzWzBdKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBwb2ludHNbMV07XHJcbiAgICAgICAgfSBlbHNlIGlmIChwID09PSBwb2ludHNbMV0pIHtcclxuICAgICAgICAgICAgcmV0dXJuIHBvaW50c1syXTtcclxuICAgICAgICB9IGVsc2UgaWYgKHAgPT09IHBvaW50c1syXSkge1xyXG4gICAgICAgICAgICByZXR1cm4gcG9pbnRzWzBdO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXR1cm5zIHRoZSBuZWlnaGJvciBjbG9ja3dpc2UgdG8gZ2l2ZW4gcG9pbnQuXHJcbiAgICAgKi9cclxuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5uZWlnaGJvckNXID0gZnVuY3Rpb24ocCkge1xyXG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXHJcbiAgICAgICAgaWYgKHAgPT09IHRoaXMucG9pbnRzX1swXSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5uZWlnaGJvcnNfWzFdO1xyXG4gICAgICAgIH0gZWxzZSBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzFdKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm5laWdoYm9yc19bMl07XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMubmVpZ2hib3JzX1swXTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmV0dXJucyB0aGUgbmVpZ2hib3IgY291bnRlci1jbG9ja3dpc2UgdG8gZ2l2ZW4gcG9pbnQuXHJcbiAgICAgKi9cclxuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5uZWlnaGJvckNDVyA9IGZ1bmN0aW9uKHApIHtcclxuICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlc1xyXG4gICAgICAgIGlmIChwID09PSB0aGlzLnBvaW50c19bMF0pIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMubmVpZ2hib3JzX1syXTtcclxuICAgICAgICB9IGVsc2UgaWYgKHAgPT09IHRoaXMucG9pbnRzX1sxXSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5uZWlnaGJvcnNfWzBdO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm5laWdoYm9yc19bMV07XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuZ2V0Q29uc3RyYWluZWRFZGdlQ1cgPSBmdW5jdGlvbihwKSB7XHJcbiAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcclxuICAgICAgICBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzBdKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbMV07XHJcbiAgICAgICAgfSBlbHNlIGlmIChwID09PSB0aGlzLnBvaW50c19bMV0pIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29uc3RyYWluZWRfZWRnZVsyXTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jb25zdHJhaW5lZF9lZGdlWzBdO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLmdldENvbnN0cmFpbmVkRWRnZUNDVyA9IGZ1bmN0aW9uKHApIHtcclxuICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlc1xyXG4gICAgICAgIGlmIChwID09PSB0aGlzLnBvaW50c19bMF0pIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29uc3RyYWluZWRfZWRnZVsyXTtcclxuICAgICAgICB9IGVsc2UgaWYgKHAgPT09IHRoaXMucG9pbnRzX1sxXSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jb25zdHJhaW5lZF9lZGdlWzBdO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbMV07XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuc2V0Q29uc3RyYWluZWRFZGdlQ1cgPSBmdW5jdGlvbihwLCBjZSkge1xyXG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXHJcbiAgICAgICAgaWYgKHAgPT09IHRoaXMucG9pbnRzX1swXSkge1xyXG4gICAgICAgICAgICB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbMV0gPSBjZTtcclxuICAgICAgICB9IGVsc2UgaWYgKHAgPT09IHRoaXMucG9pbnRzX1sxXSkge1xyXG4gICAgICAgICAgICB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbMl0gPSBjZTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbMF0gPSBjZTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5zZXRDb25zdHJhaW5lZEVkZ2VDQ1cgPSBmdW5jdGlvbihwLCBjZSkge1xyXG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXHJcbiAgICAgICAgaWYgKHAgPT09IHRoaXMucG9pbnRzX1swXSkge1xyXG4gICAgICAgICAgICB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbMl0gPSBjZTtcclxuICAgICAgICB9IGVsc2UgaWYgKHAgPT09IHRoaXMucG9pbnRzX1sxXSkge1xyXG4gICAgICAgICAgICB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbMF0gPSBjZTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbMV0gPSBjZTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5nZXREZWxhdW5heUVkZ2VDVyA9IGZ1bmN0aW9uKHApIHtcclxuICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlc1xyXG4gICAgICAgIGlmIChwID09PSB0aGlzLnBvaW50c19bMF0pIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGVsYXVuYXlfZWRnZVsxXTtcclxuICAgICAgICB9IGVsc2UgaWYgKHAgPT09IHRoaXMucG9pbnRzX1sxXSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5kZWxhdW5heV9lZGdlWzJdO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmRlbGF1bmF5X2VkZ2VbMF07XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuZ2V0RGVsYXVuYXlFZGdlQ0NXID0gZnVuY3Rpb24ocCkge1xyXG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXHJcbiAgICAgICAgaWYgKHAgPT09IHRoaXMucG9pbnRzX1swXSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5kZWxhdW5heV9lZGdlWzJdO1xyXG4gICAgICAgIH0gZWxzZSBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzFdKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmRlbGF1bmF5X2VkZ2VbMF07XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGVsYXVuYXlfZWRnZVsxXTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5zZXREZWxhdW5heUVkZ2VDVyA9IGZ1bmN0aW9uKHAsIGUpIHtcclxuICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlc1xyXG4gICAgICAgIGlmIChwID09PSB0aGlzLnBvaW50c19bMF0pIHtcclxuICAgICAgICAgICAgdGhpcy5kZWxhdW5heV9lZGdlWzFdID0gZTtcclxuICAgICAgICB9IGVsc2UgaWYgKHAgPT09IHRoaXMucG9pbnRzX1sxXSkge1xyXG4gICAgICAgICAgICB0aGlzLmRlbGF1bmF5X2VkZ2VbMl0gPSBlO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuZGVsYXVuYXlfZWRnZVswXSA9IGU7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuc2V0RGVsYXVuYXlFZGdlQ0NXID0gZnVuY3Rpb24ocCwgZSkge1xyXG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXHJcbiAgICAgICAgaWYgKHAgPT09IHRoaXMucG9pbnRzX1swXSkge1xyXG4gICAgICAgICAgICB0aGlzLmRlbGF1bmF5X2VkZ2VbMl0gPSBlO1xyXG4gICAgICAgIH0gZWxzZSBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzFdKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZGVsYXVuYXlfZWRnZVswXSA9IGU7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5kZWxhdW5heV9lZGdlWzFdID0gZTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogVGhlIG5laWdoYm9yIGFjcm9zcyB0byBnaXZlbiBwb2ludC5cclxuICAgICAqL1xyXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLm5laWdoYm9yQWNyb3NzID0gZnVuY3Rpb24ocCkge1xyXG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXHJcbiAgICAgICAgaWYgKHAgPT09IHRoaXMucG9pbnRzX1swXSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5uZWlnaGJvcnNfWzBdO1xyXG4gICAgICAgIH0gZWxzZSBpZiAocCA9PT0gdGhpcy5wb2ludHNfWzFdKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm5laWdoYm9yc19bMV07XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMubmVpZ2hib3JzX1syXTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIFRyaWFuZ2xlLnByb3RvdHlwZS5vcHBvc2l0ZVBvaW50ID0gZnVuY3Rpb24odCwgcCkge1xyXG4gICAgICAgIHZhciBjdyA9IHQucG9pbnRDVyhwKTtcclxuICAgICAgICByZXR1cm4gdGhpcy5wb2ludENXKGN3KTtcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBMZWdhbGl6ZSB0cmlhbmdsZSBieSByb3RhdGluZyBjbG9ja3dpc2UgYXJvdW5kIG9Qb2ludFxyXG4gICAgICogQHBhcmFtIHtQb2ludH0gb3BvaW50XHJcbiAgICAgKiBAcGFyYW0ge1BvaW50fSBucG9pbnRcclxuICAgICAqL1xyXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLmxlZ2FsaXplID0gZnVuY3Rpb24ob3BvaW50LCBucG9pbnQpIHtcclxuICAgICAgICB2YXIgcG9pbnRzID0gdGhpcy5wb2ludHNfO1xyXG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzXHJcbiAgICAgICAgaWYgKG9wb2ludCA9PT0gcG9pbnRzWzBdKSB7XHJcbiAgICAgICAgICAgIHBvaW50c1sxXSA9IHBvaW50c1swXTtcclxuICAgICAgICAgICAgcG9pbnRzWzBdID0gcG9pbnRzWzJdO1xyXG4gICAgICAgICAgICBwb2ludHNbMl0gPSBucG9pbnQ7XHJcbiAgICAgICAgfSBlbHNlIGlmIChvcG9pbnQgPT09IHBvaW50c1sxXSkge1xyXG4gICAgICAgICAgICBwb2ludHNbMl0gPSBwb2ludHNbMV07XHJcbiAgICAgICAgICAgIHBvaW50c1sxXSA9IHBvaW50c1swXTtcclxuICAgICAgICAgICAgcG9pbnRzWzBdID0gbnBvaW50O1xyXG4gICAgICAgIH0gZWxzZSBpZiAob3BvaW50ID09PSBwb2ludHNbMl0pIHtcclxuICAgICAgICAgICAgcG9pbnRzWzBdID0gcG9pbnRzWzJdO1xyXG4gICAgICAgICAgICBwb2ludHNbMl0gPSBwb2ludHNbMV07XHJcbiAgICAgICAgICAgIHBvaW50c1sxXSA9IG5wb2ludDtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3BvbHkydHJpIEludmFsaWQgVHJpYW5nbGUubGVnYWxpemUoKSBjYWxsJyk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFJldHVybnMgdGhlIGluZGV4IG9mIGEgcG9pbnQgaW4gdGhlIHRyaWFuZ2xlLiBcclxuICAgICAqIFRoZSBwb2ludCAqbXVzdCogYmUgYSByZWZlcmVuY2UgdG8gb25lIG9mIHRoZSB0cmlhbmdsZSdzIHZlcnRpY2VzLlxyXG4gICAgICogQHBhcmFtIHtQb2ludH0gcCBQb2ludCBvYmplY3RcclxuICAgICAqIEByZXR1cm5zIHtOdW1iZXJ9IGluZGV4IDAsIDEgb3IgMlxyXG4gICAgICovXHJcbiAgICBUcmlhbmdsZS5wcm90b3R5cGUuaW5kZXggPSBmdW5jdGlvbihwKSB7XHJcbiAgICAgICAgdmFyIHBvaW50cyA9IHRoaXMucG9pbnRzXztcclxuICAgICAgICAvLyBIZXJlIHdlIGFyZSBjb21wYXJpbmcgcG9pbnQgcmVmZXJlbmNlcywgbm90IHZhbHVlc1xyXG4gICAgICAgIGlmIChwID09PSBwb2ludHNbMF0pIHtcclxuICAgICAgICAgICAgcmV0dXJuIDA7XHJcbiAgICAgICAgfSBlbHNlIGlmIChwID09PSBwb2ludHNbMV0pIHtcclxuICAgICAgICAgICAgcmV0dXJuIDE7XHJcbiAgICAgICAgfSBlbHNlIGlmIChwID09PSBwb2ludHNbMl0pIHtcclxuICAgICAgICAgICAgcmV0dXJuIDI7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdwb2x5MnRyaSBJbnZhbGlkIFRyaWFuZ2xlLmluZGV4KCkgY2FsbCcpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLmVkZ2VJbmRleCA9IGZ1bmN0aW9uKHAxLCBwMikge1xyXG4gICAgICAgIHZhciBwb2ludHMgPSB0aGlzLnBvaW50c187XHJcbiAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcclxuICAgICAgICBpZiAocDEgPT09IHBvaW50c1swXSkge1xyXG4gICAgICAgICAgICBpZiAocDIgPT09IHBvaW50c1sxXSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIDI7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocDIgPT09IHBvaW50c1syXSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIDE7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2UgaWYgKHAxID09PSBwb2ludHNbMV0pIHtcclxuICAgICAgICAgICAgaWYgKHAyID09PSBwb2ludHNbMl0pIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiAwO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHAyID09PSBwb2ludHNbMF0pIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiAyO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIGlmIChwMSA9PT0gcG9pbnRzWzJdKSB7XHJcbiAgICAgICAgICAgIGlmIChwMiA9PT0gcG9pbnRzWzBdKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gMTtcclxuICAgICAgICAgICAgfSBlbHNlIGlmIChwMiA9PT0gcG9pbnRzWzFdKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gMDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gLTE7XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogTWFyayBhbiBlZGdlIG9mIHRoaXMgdHJpYW5nbGUgYXMgY29uc3RyYWluZWQuPGJyPlxyXG4gICAgICogVGhpcyBtZXRob2QgdGFrZXMgZWl0aGVyIDEgcGFyYW1ldGVyIChhbiBlZGdlIGluZGV4IG9yIGFuIEVkZ2UgaW5zdGFuY2UpIG9yXHJcbiAgICAgKiAyIHBhcmFtZXRlcnMgKHR3byBQb2ludCBpbnN0YW5jZXMgZGVmaW5pbmcgdGhlIGVkZ2Ugb2YgdGhlIHRyaWFuZ2xlKS5cclxuICAgICAqL1xyXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLm1hcmtDb25zdHJhaW5lZEVkZ2VCeUluZGV4ID0gZnVuY3Rpb24oaW5kZXgpIHtcclxuICAgICAgICB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbaW5kZXhdID0gdHJ1ZTtcclxuICAgIH07XHJcbiAgICBUcmlhbmdsZS5wcm90b3R5cGUubWFya0NvbnN0cmFpbmVkRWRnZUJ5RWRnZSA9IGZ1bmN0aW9uKGVkZ2UpIHtcclxuICAgICAgICB0aGlzLm1hcmtDb25zdHJhaW5lZEVkZ2VCeVBvaW50cyhlZGdlLnAsIGVkZ2UucSk7XHJcbiAgICB9O1xyXG4gICAgVHJpYW5nbGUucHJvdG90eXBlLm1hcmtDb25zdHJhaW5lZEVkZ2VCeVBvaW50cyA9IGZ1bmN0aW9uKHAsIHEpIHtcclxuICAgICAgICB2YXIgcG9pbnRzID0gdGhpcy5wb2ludHNfO1xyXG4gICAgICAgIC8vIEhlcmUgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzLCBub3QgdmFsdWVzICAgICAgICBcclxuICAgICAgICBpZiAoKHEgPT09IHBvaW50c1swXSAmJiBwID09PSBwb2ludHNbMV0pIHx8IChxID09PSBwb2ludHNbMV0gJiYgcCA9PT0gcG9pbnRzWzBdKSkge1xyXG4gICAgICAgICAgICB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbMl0gPSB0cnVlO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoKHEgPT09IHBvaW50c1swXSAmJiBwID09PSBwb2ludHNbMl0pIHx8IChxID09PSBwb2ludHNbMl0gJiYgcCA9PT0gcG9pbnRzWzBdKSkge1xyXG4gICAgICAgICAgICB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbMV0gPSB0cnVlO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoKHEgPT09IHBvaW50c1sxXSAmJiBwID09PSBwb2ludHNbMl0pIHx8IChxID09PSBwb2ludHNbMl0gJiYgcCA9PT0gcG9pbnRzWzFdKSkge1xyXG4gICAgICAgICAgICB0aGlzLmNvbnN0cmFpbmVkX2VkZ2VbMF0gPSB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS11dGlsc1xyXG4gICAgdmFyIFBJXzNkaXY0ID0gMyAqIE1hdGguUEkgLyA0O1xyXG4gICAgdmFyIFBJXzIgPSBNYXRoLlBJIC8gMjtcclxuICAgIHZhciBFUFNJTE9OID0gMWUtMTI7XHJcblxyXG4gICAgLyogXHJcbiAgICAgKiBJbml0YWwgdHJpYW5nbGUgZmFjdG9yLCBzZWVkIHRyaWFuZ2xlIHdpbGwgZXh0ZW5kIDMwJSBvZlxyXG4gICAgICogUG9pbnRTZXQgd2lkdGggdG8gYm90aCBsZWZ0IGFuZCByaWdodC5cclxuICAgICAqL1xyXG4gICAgdmFyIGtBbHBoYSA9IDAuMztcclxuXHJcbiAgICB2YXIgT3JpZW50YXRpb24gPSB7XHJcbiAgICAgICAgXCJDV1wiOiAxLFxyXG4gICAgICAgIFwiQ0NXXCI6IC0xLFxyXG4gICAgICAgIFwiQ09MTElORUFSXCI6IDBcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBGb3J1bWxhIHRvIGNhbGN1bGF0ZSBzaWduZWQgYXJlYTxicj5cclxuICAgICAqIFBvc2l0aXZlIGlmIENDVzxicj5cclxuICAgICAqIE5lZ2F0aXZlIGlmIENXPGJyPlxyXG4gICAgICogMCBpZiBjb2xsaW5lYXI8YnI+XHJcbiAgICAgKiA8cHJlPlxyXG4gICAgICogQVtQMSxQMixQM10gID0gICh4MSp5MiAtIHkxKngyKSArICh4Mip5MyAtIHkyKngzKSArICh4Myp5MSAtIHkzKngxKVxyXG4gICAgICogICAgICAgICAgICAgID0gICh4MS14MykqKHkyLXkzKSAtICh5MS15MykqKHgyLXgzKVxyXG4gICAgICogPC9wcmU+XHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIG9yaWVudDJkKHBhLCBwYiwgcGMpIHtcclxuICAgICAgICB2YXIgZGV0bGVmdCA9IChwYS54IC0gcGMueCkgKiAocGIueSAtIHBjLnkpO1xyXG4gICAgICAgIHZhciBkZXRyaWdodCA9IChwYS55IC0gcGMueSkgKiAocGIueCAtIHBjLngpO1xyXG4gICAgICAgIHZhciB2YWwgPSBkZXRsZWZ0IC0gZGV0cmlnaHQ7XHJcbiAgICAgICAgaWYgKHZhbCA+IC0oRVBTSUxPTikgJiYgdmFsIDwgKEVQU0lMT04pKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBPcmllbnRhdGlvbi5DT0xMSU5FQVI7XHJcbiAgICAgICAgfSBlbHNlIGlmICh2YWwgPiAwKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBPcmllbnRhdGlvbi5DQ1c7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcmV0dXJuIE9yaWVudGF0aW9uLkNXO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBpblNjYW5BcmVhKHBhLCBwYiwgcGMsIHBkKSB7XHJcbiAgICAgICAgdmFyIHBkeCA9IHBkLng7XHJcbiAgICAgICAgdmFyIHBkeSA9IHBkLnk7XHJcbiAgICAgICAgdmFyIGFkeCA9IHBhLnggLSBwZHg7XHJcbiAgICAgICAgdmFyIGFkeSA9IHBhLnkgLSBwZHk7XHJcbiAgICAgICAgdmFyIGJkeCA9IHBiLnggLSBwZHg7XHJcbiAgICAgICAgdmFyIGJkeSA9IHBiLnkgLSBwZHk7XHJcblxyXG4gICAgICAgIHZhciBhZHhiZHkgPSBhZHggKiBiZHk7XHJcbiAgICAgICAgdmFyIGJkeGFkeSA9IGJkeCAqIGFkeTtcclxuICAgICAgICB2YXIgb2FiZCA9IGFkeGJkeSAtIGJkeGFkeTtcclxuXHJcbiAgICAgICAgaWYgKG9hYmQgPD0gKEVQU0lMT04pKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciBjZHggPSBwYy54IC0gcGR4O1xyXG4gICAgICAgIHZhciBjZHkgPSBwYy55IC0gcGR5O1xyXG5cclxuICAgICAgICB2YXIgY2R4YWR5ID0gY2R4ICogYWR5O1xyXG4gICAgICAgIHZhciBhZHhjZHkgPSBhZHggKiBjZHk7XHJcbiAgICAgICAgdmFyIG9jYWQgPSBjZHhhZHkgLSBhZHhjZHk7XHJcblxyXG4gICAgICAgIGlmIChvY2FkIDw9IChFUFNJTE9OKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLUFkdmFuY2luZ0Zyb250XHJcbiAgICAvKipcclxuICAgICAqIEFkdmFuY2luZyBmcm9udCBub2RlXHJcbiAgICAgKiBAcGFyYW0ge1BvaW50fSBwIGFueSBcIlBvaW50IGxpa2VcIiBvYmplY3Qgd2l0aCB7eCx5fSAoZHVjayB0eXBpbmcpXHJcbiAgICAgKiBAcGFyYW0ge1RyaWFuZ2xlfSB0IHRyaWFuZ2xlIChvcHRpb25uYWwpXHJcbiAgICAgKi9cclxuICAgIHZhciBOb2RlID0gZnVuY3Rpb24ocCwgdCkge1xyXG4gICAgICAgIHRoaXMucG9pbnQgPSBwO1xyXG4gICAgICAgIHRoaXMudHJpYW5nbGUgPSB0IHx8IG51bGw7XHJcblxyXG4gICAgICAgIHRoaXMubmV4dCA9IG51bGw7IC8vIE5vZGVcclxuICAgICAgICB0aGlzLnByZXYgPSBudWxsOyAvLyBOb2RlXHJcblxyXG4gICAgICAgIHRoaXMudmFsdWUgPSBwLng7XHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBBZHZhbmNpbmdGcm9udCA9IGZ1bmN0aW9uKGhlYWQsIHRhaWwpIHtcclxuICAgICAgICB0aGlzLmhlYWRfID0gaGVhZDsgLy8gTm9kZVxyXG4gICAgICAgIHRoaXMudGFpbF8gPSB0YWlsOyAvLyBOb2RlXHJcbiAgICAgICAgdGhpcy5zZWFyY2hfbm9kZV8gPSBoZWFkOyAvLyBOb2RlXHJcbiAgICB9O1xyXG5cclxuICAgIEFkdmFuY2luZ0Zyb250LnByb3RvdHlwZS5oZWFkID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuaGVhZF87XHJcbiAgICB9O1xyXG5cclxuICAgIEFkdmFuY2luZ0Zyb250LnByb3RvdHlwZS5zZXRIZWFkID0gZnVuY3Rpb24obm9kZSkge1xyXG4gICAgICAgIHRoaXMuaGVhZF8gPSBub2RlO1xyXG4gICAgfTtcclxuXHJcbiAgICBBZHZhbmNpbmdGcm9udC5wcm90b3R5cGUudGFpbCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnRhaWxfO1xyXG4gICAgfTtcclxuXHJcbiAgICBBZHZhbmNpbmdGcm9udC5wcm90b3R5cGUuc2V0VGFpbCA9IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgICAgICB0aGlzLnRhaWxfID0gbm9kZTtcclxuICAgIH07XHJcblxyXG4gICAgQWR2YW5jaW5nRnJvbnQucHJvdG90eXBlLnNlYXJjaCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnNlYXJjaF9ub2RlXztcclxuICAgIH07XHJcblxyXG4gICAgQWR2YW5jaW5nRnJvbnQucHJvdG90eXBlLnNldFNlYXJjaCA9IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgICAgICB0aGlzLnNlYXJjaF9ub2RlXyA9IG5vZGU7XHJcbiAgICB9O1xyXG5cclxuICAgIEFkdmFuY2luZ0Zyb250LnByb3RvdHlwZS5maW5kU2VhcmNoTm9kZSA9IGZ1bmN0aW9uKC8qeCovKSB7XHJcbiAgICAgICAgLy8gVE9ETzogaW1wbGVtZW50IEJTVCBpbmRleFxyXG4gICAgICAgIHJldHVybiB0aGlzLnNlYXJjaF9ub2RlXztcclxuICAgIH07XHJcblxyXG4gICAgQWR2YW5jaW5nRnJvbnQucHJvdG90eXBlLmxvY2F0ZU5vZGUgPSBmdW5jdGlvbih4KSB7XHJcbiAgICAgICAgdmFyIG5vZGUgPSB0aGlzLnNlYXJjaF9ub2RlXztcclxuXHJcbiAgICAgICAgLyoganNoaW50IGJvc3M6dHJ1ZSAqL1xyXG4gICAgICAgIGlmICh4IDwgbm9kZS52YWx1ZSkge1xyXG4gICAgICAgICAgICB3aGlsZSAobm9kZSA9IG5vZGUucHJldikge1xyXG4gICAgICAgICAgICAgICAgaWYgKHggPj0gbm9kZS52YWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2VhcmNoX25vZGVfID0gbm9kZTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbm9kZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHdoaWxlIChub2RlID0gbm9kZS5uZXh0KSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoeCA8IG5vZGUudmFsdWUpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnNlYXJjaF9ub2RlXyA9IG5vZGUucHJldjtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbm9kZS5wcmV2O1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfTtcclxuXHJcbiAgICBBZHZhbmNpbmdGcm9udC5wcm90b3R5cGUubG9jYXRlUG9pbnQgPSBmdW5jdGlvbihwb2ludCkge1xyXG4gICAgICAgIHZhciBweCA9IHBvaW50Lng7XHJcbiAgICAgICAgdmFyIG5vZGUgPSB0aGlzLmZpbmRTZWFyY2hOb2RlKHB4KTtcclxuICAgICAgICB2YXIgbnggPSBub2RlLnBvaW50Lng7XHJcblxyXG4gICAgICAgIGlmIChweCA9PT0gbngpIHtcclxuICAgICAgICAgICAgLy8gSGVyZSB3ZSBhcmUgY29tcGFyaW5nIHBvaW50IHJlZmVyZW5jZXMsIG5vdCB2YWx1ZXNcclxuICAgICAgICAgICAgaWYgKHBvaW50ICE9PSBub2RlLnBvaW50KSB7XHJcbiAgICAgICAgICAgICAgICAvLyBXZSBtaWdodCBoYXZlIHR3byBub2RlcyB3aXRoIHNhbWUgeCB2YWx1ZSBmb3IgYSBzaG9ydCB0aW1lXHJcbiAgICAgICAgICAgICAgICBpZiAocG9pbnQgPT09IG5vZGUucHJldi5wb2ludCkge1xyXG4gICAgICAgICAgICAgICAgICAgIG5vZGUgPSBub2RlLnByZXY7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHBvaW50ID09PSBub2RlLm5leHQucG9pbnQpIHtcclxuICAgICAgICAgICAgICAgICAgICBub2RlID0gbm9kZS5uZXh0O1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3BvbHkydHJpIEludmFsaWQgQWR2YW5jaW5nRnJvbnQubG9jYXRlUG9pbnQoKSBjYWxsJyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2UgaWYgKHB4IDwgbngpIHtcclxuICAgICAgICAgICAgLyoganNoaW50IGJvc3M6dHJ1ZSAqL1xyXG4gICAgICAgICAgICB3aGlsZSAobm9kZSA9IG5vZGUucHJldikge1xyXG4gICAgICAgICAgICAgICAgaWYgKHBvaW50ID09PSBub2RlLnBvaW50KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB3aGlsZSAobm9kZSA9IG5vZGUubmV4dCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHBvaW50ID09PSBub2RlLnBvaW50KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChub2RlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2VhcmNoX25vZGVfID0gbm9kZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIG5vZGU7XHJcbiAgICB9O1xyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tQmFzaW5cclxuICAgIHZhciBCYXNpbiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHRoaXMubGVmdF9ub2RlID0gbnVsbDsgLy8gTm9kZVxyXG4gICAgICAgIHRoaXMuYm90dG9tX25vZGUgPSBudWxsOyAvLyBOb2RlXHJcbiAgICAgICAgdGhpcy5yaWdodF9ub2RlID0gbnVsbDsgLy8gTm9kZVxyXG4gICAgICAgIHRoaXMud2lkdGggPSAwLjA7IC8vIG51bWJlclxyXG4gICAgICAgIHRoaXMubGVmdF9oaWdoZXN0ID0gZmFsc2U7XHJcbiAgICB9O1xyXG5cclxuICAgIEJhc2luLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHRoaXMubGVmdF9ub2RlID0gbnVsbDtcclxuICAgICAgICB0aGlzLmJvdHRvbV9ub2RlID0gbnVsbDtcclxuICAgICAgICB0aGlzLnJpZ2h0X25vZGUgPSBudWxsO1xyXG4gICAgICAgIHRoaXMud2lkdGggPSAwLjA7XHJcbiAgICAgICAgdGhpcy5sZWZ0X2hpZ2hlc3QgPSBmYWxzZTtcclxuICAgIH07XHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLUVkZ2VFdmVudFxyXG4gICAgdmFyIEVkZ2VFdmVudCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHRoaXMuY29uc3RyYWluZWRfZWRnZSA9IG51bGw7IC8vIEVkZ2VcclxuICAgICAgICB0aGlzLnJpZ2h0ID0gZmFsc2U7XHJcbiAgICB9O1xyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVN3ZWVwQ29udGV4dCAocHVibGljIEFQSSlcclxuICAgIC8qKlxyXG4gICAgICogQ29uc3RydWN0b3IgZm9yIHRoZSB0cmlhbmd1bGF0aW9uIGNvbnRleHQuXHJcbiAgICAgKiBJdCBhY2NlcHRzIGEgc2ltcGxlIHBvbHlsaW5lLCB3aGljaCBkZWZpbmVzIHRoZSBjb25zdHJhaW5lZCBlZGdlcy5cclxuICAgICAqIFBvc3NpYmxlIG9wdGlvbnMgYXJlOlxyXG4gICAgICogICAgY2xvbmVBcnJheXM6ICBpZiB0cnVlLCBkbyBhIHNoYWxsb3cgY29weSBvZiB0aGUgQXJyYXkgcGFyYW1ldGVycyBcclxuICAgICAqICAgICAgICAgICAgICAgICAgKGNvbnRvdXIsIGhvbGVzKS4gUG9pbnRzIGluc2lkZSBhcnJheXMgYXJlIG5ldmVyIGNvcGllZC5cclxuICAgICAqICAgICAgICAgICAgICAgICAgRGVmYXVsdCBpcyBmYWxzZSA6IGtlZXAgYSByZWZlcmVuY2UgdG8gdGhlIGFycmF5IGFyZ3VtZW50cyxcclxuICAgICAqICAgICAgICAgICAgICAgICAgd2hvIHdpbGwgYmUgbW9kaWZpZWQgaW4gcGxhY2UuXHJcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBjb250b3VyICBhcnJheSBvZiBcIlBvaW50IGxpa2VcIiBvYmplY3RzIHdpdGgge3gseX0gKGR1Y2sgdHlwaW5nKVxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgIGNvbnN0cnVjdG9yIG9wdGlvbnNcclxuICAgICAqL1xyXG4gICAgdmFyIFN3ZWVwQ29udGV4dCA9IGZ1bmN0aW9uKGNvbnRvdXIsIG9wdGlvbnMpIHtcclxuICAgICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcclxuICAgICAgICB0aGlzLnRyaWFuZ2xlc18gPSBbXTtcclxuICAgICAgICB0aGlzLm1hcF8gPSBbXTtcclxuICAgICAgICB0aGlzLnBvaW50c18gPSAob3B0aW9ucy5jbG9uZUFycmF5cyA/IGNvbnRvdXIuc2xpY2UoMCkgOiBjb250b3VyKTtcclxuICAgICAgICB0aGlzLmVkZ2VfbGlzdCA9IFtdO1xyXG5cclxuICAgICAgICAvLyBCb3VuZGluZyBib3ggb2YgYWxsIHBvaW50cy4gQ29tcHV0ZWQgYXQgdGhlIHN0YXJ0IG9mIHRoZSB0cmlhbmd1bGF0aW9uLCBcclxuICAgICAgICAvLyBpdCBpcyBzdG9yZWQgaW4gY2FzZSBpdCBpcyBuZWVkZWQgYnkgdGhlIGNhbGxlci5cclxuICAgICAgICB0aGlzLnBtaW5fID0gdGhpcy5wbWF4XyA9IG51bGw7XHJcblxyXG4gICAgICAgIC8vIEFkdmFuY2luZyBmcm9udFxyXG4gICAgICAgIHRoaXMuZnJvbnRfID0gbnVsbDsgLy8gQWR2YW5jaW5nRnJvbnRcclxuICAgICAgICAvLyBoZWFkIHBvaW50IHVzZWQgd2l0aCBhZHZhbmNpbmcgZnJvbnRcclxuICAgICAgICB0aGlzLmhlYWRfID0gbnVsbDsgLy8gUG9pbnRcclxuICAgICAgICAvLyB0YWlsIHBvaW50IHVzZWQgd2l0aCBhZHZhbmNpbmcgZnJvbnRcclxuICAgICAgICB0aGlzLnRhaWxfID0gbnVsbDsgLy8gUG9pbnRcclxuXHJcbiAgICAgICAgdGhpcy5hZl9oZWFkXyA9IG51bGw7IC8vIE5vZGVcclxuICAgICAgICB0aGlzLmFmX21pZGRsZV8gPSBudWxsOyAvLyBOb2RlXHJcbiAgICAgICAgdGhpcy5hZl90YWlsXyA9IG51bGw7IC8vIE5vZGVcclxuXHJcbiAgICAgICAgdGhpcy5iYXNpbiA9IG5ldyBCYXNpbigpO1xyXG4gICAgICAgIHRoaXMuZWRnZV9ldmVudCA9IG5ldyBFZGdlRXZlbnQoKTtcclxuXHJcbiAgICAgICAgdGhpcy5pbml0RWRnZXModGhpcy5wb2ludHNfKTtcclxuICAgIH07XHJcblxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQWRkIGEgaG9sZSB0byB0aGUgY29uc3RyYWludHNcclxuICAgICAqIEBwYXJhbSB7QXJyYXl9IHBvbHlsaW5lICBhcnJheSBvZiBcIlBvaW50IGxpa2VcIiBvYmplY3RzIHdpdGgge3gseX0gKGR1Y2sgdHlwaW5nKVxyXG4gICAgICovXHJcbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLmFkZEhvbGUgPSBmdW5jdGlvbihwb2x5bGluZSkge1xyXG4gICAgICAgIHRoaXMuaW5pdEVkZ2VzKHBvbHlsaW5lKTtcclxuICAgICAgICB2YXIgaSwgbGVuID0gcG9seWxpbmUubGVuZ3RoO1xyXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICB0aGlzLnBvaW50c18ucHVzaChwb2x5bGluZVtpXSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0aGlzOyAvLyBmb3IgY2hhaW5pbmdcclxuICAgIH07XHJcbiAgICAvLyBCYWNrd2FyZCBjb21wYXRpYmlsaXR5XHJcbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLkFkZEhvbGUgPSBTd2VlcENvbnRleHQucHJvdG90eXBlLmFkZEhvbGU7XHJcblxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQWRkIGEgU3RlaW5lciBwb2ludCB0byB0aGUgY29uc3RyYWludHNcclxuICAgICAqIEBwYXJhbSB7UG9pbnR9IHBvaW50ICAgICBhbnkgXCJQb2ludCBsaWtlXCIgb2JqZWN0IHdpdGgge3gseX0gKGR1Y2sgdHlwaW5nKVxyXG4gICAgICovXHJcbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLmFkZFBvaW50ID0gZnVuY3Rpb24ocG9pbnQpIHtcclxuICAgICAgICB0aGlzLnBvaW50c18ucHVzaChwb2ludCk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7IC8vIGZvciBjaGFpbmluZ1xyXG4gICAgfTtcclxuICAgIC8vIEJhY2t3YXJkIGNvbXBhdGliaWxpdHlcclxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUuQWRkUG9pbnQgPSBTd2VlcENvbnRleHQucHJvdG90eXBlLmFkZFBvaW50O1xyXG5cclxuXHJcbiAgICAvKipcclxuICAgICAqIEFkZCBzZXZlcmFsIFN0ZWluZXIgcG9pbnRzIHRvIHRoZSBjb25zdHJhaW50c1xyXG4gICAgICogQHBhcmFtIHthcnJheTxQb2ludD59IHBvaW50cyAgICAgYXJyYXkgb2YgXCJQb2ludCBsaWtlXCIgb2JqZWN0IHdpdGgge3gseX0gXHJcbiAgICAgKi9cclxuICAgIC8vIE1ldGhvZCBhZGRlZCBpbiB0aGUgSmF2YVNjcmlwdCB2ZXJzaW9uICh3YXMgbm90IHByZXNlbnQgaW4gdGhlIGMrKyB2ZXJzaW9uKVxyXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5hZGRQb2ludHMgPSBmdW5jdGlvbihwb2ludHMpIHtcclxuICAgICAgICB0aGlzLnBvaW50c18gPSB0aGlzLnBvaW50c18uY29uY2F0KHBvaW50cyk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7IC8vIGZvciBjaGFpbmluZ1xyXG4gICAgfTtcclxuXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUcmlhbmd1bGF0ZSB0aGUgcG9seWdvbiB3aXRoIGhvbGVzIGFuZCBTdGVpbmVyIHBvaW50cy5cclxuICAgICAqL1xyXG4gICAgLy8gU2hvcnRjdXQgbWV0aG9kIGZvciBTd2VlcC50cmlhbmd1bGF0ZShTd2VlcENvbnRleHQpLlxyXG4gICAgLy8gTWV0aG9kIGFkZGVkIGluIHRoZSBKYXZhU2NyaXB0IHZlcnNpb24gKHdhcyBub3QgcHJlc2VudCBpbiB0aGUgYysrIHZlcnNpb24pXHJcbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLnRyaWFuZ3VsYXRlID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgU3dlZXAudHJpYW5ndWxhdGUodGhpcyk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7IC8vIGZvciBjaGFpbmluZ1xyXG4gICAgfTtcclxuXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBHZXQgdGhlIGJvdW5kaW5nIGJveCBvZiB0aGUgcHJvdmlkZWQgY29uc3RyYWludHMgKGNvbnRvdXIsIGhvbGVzIGFuZCBcclxuICAgICAqIFN0ZWludGVyIHBvaW50cykuIFdhcm5pbmcgOiB0aGVzZSB2YWx1ZXMgYXJlIG5vdCBhdmFpbGFibGUgaWYgdGhlIHRyaWFuZ3VsYXRpb24gXHJcbiAgICAgKiBoYXMgbm90IGJlZW4gZG9uZSB5ZXQuXHJcbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBvYmplY3Qgd2l0aCAnbWluJyBhbmQgJ21heCcgUG9pbnRcclxuICAgICAqL1xyXG4gICAgLy8gTWV0aG9kIGFkZGVkIGluIHRoZSBKYXZhU2NyaXB0IHZlcnNpb24gKHdhcyBub3QgcHJlc2VudCBpbiB0aGUgYysrIHZlcnNpb24pXHJcbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLmdldEJvdW5kaW5nQm94ID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcmV0dXJuIHttaW46IHRoaXMucG1pbl8sIG1heDogdGhpcy5wbWF4X307XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogR2V0IHJlc3VsdCBvZiB0cmlhbmd1bGF0aW9uXHJcbiAgICAgKiBAcmV0dXJucyB7YXJyYXk8VHJpYW5nbGU+fSAgIGFycmF5IG9mIHRyaWFuZ2xlc1xyXG4gICAgICovXHJcbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLmdldFRyaWFuZ2xlcyA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnRyaWFuZ2xlc187XHJcbiAgICB9O1xyXG4gICAgLy8gQmFja3dhcmQgY29tcGF0aWJpbGl0eVxyXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5HZXRUcmlhbmdsZXMgPSBTd2VlcENvbnRleHQucHJvdG90eXBlLmdldFRyaWFuZ2xlcztcclxuXHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1Td2VlcENvbnRleHQgKHByaXZhdGUgQVBJKVxyXG5cclxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUuZnJvbnQgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5mcm9udF87XHJcbiAgICB9O1xyXG5cclxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUucG9pbnRDb3VudCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnBvaW50c18ubGVuZ3RoO1xyXG4gICAgfTtcclxuXHJcbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLmhlYWQgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5oZWFkXztcclxuICAgIH07XHJcblxyXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5zZXRIZWFkID0gZnVuY3Rpb24ocDEpIHtcclxuICAgICAgICB0aGlzLmhlYWRfID0gcDE7XHJcbiAgICB9O1xyXG5cclxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUudGFpbCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnRhaWxfO1xyXG4gICAgfTtcclxuXHJcbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLnNldFRhaWwgPSBmdW5jdGlvbihwMSkge1xyXG4gICAgICAgIHRoaXMudGFpbF8gPSBwMTtcclxuICAgIH07XHJcblxyXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5nZXRNYXAgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5tYXBfO1xyXG4gICAgfTtcclxuXHJcbiAgICBTd2VlcENvbnRleHQucHJvdG90eXBlLmluaXRUcmlhbmd1bGF0aW9uID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdmFyIHhtYXggPSB0aGlzLnBvaW50c19bMF0ueDtcclxuICAgICAgICB2YXIgeG1pbiA9IHRoaXMucG9pbnRzX1swXS54O1xyXG4gICAgICAgIHZhciB5bWF4ID0gdGhpcy5wb2ludHNfWzBdLnk7XHJcbiAgICAgICAgdmFyIHltaW4gPSB0aGlzLnBvaW50c19bMF0ueTtcclxuXHJcbiAgICAgICAgLy8gQ2FsY3VsYXRlIGJvdW5kc1xyXG4gICAgICAgIHZhciBpLCBsZW4gPSB0aGlzLnBvaW50c18ubGVuZ3RoO1xyXG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICB2YXIgcCA9IHRoaXMucG9pbnRzX1tpXTtcclxuICAgICAgICAgICAgLyoganNoaW50IGV4cHI6dHJ1ZSAqL1xyXG4gICAgICAgICAgICAocC54ID4geG1heCkgJiYgKHhtYXggPSBwLngpO1xyXG4gICAgICAgICAgICAocC54IDwgeG1pbikgJiYgKHhtaW4gPSBwLngpO1xyXG4gICAgICAgICAgICAocC55ID4geW1heCkgJiYgKHltYXggPSBwLnkpO1xyXG4gICAgICAgICAgICAocC55IDwgeW1pbikgJiYgKHltaW4gPSBwLnkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLnBtaW5fID0gbmV3IFBvaW50KHhtaW4sIHltaW4pO1xyXG4gICAgICAgIHRoaXMucG1heF8gPSBuZXcgUG9pbnQoeG1heCwgeW1heCk7XHJcblxyXG4gICAgICAgIHZhciBkeCA9IGtBbHBoYSAqICh4bWF4IC0geG1pbik7XHJcbiAgICAgICAgdmFyIGR5ID0ga0FscGhhICogKHltYXggLSB5bWluKTtcclxuICAgICAgICB0aGlzLmhlYWRfID0gbmV3IFBvaW50KHhtYXggKyBkeCwgeW1pbiAtIGR5KTtcclxuICAgICAgICB0aGlzLnRhaWxfID0gbmV3IFBvaW50KHhtaW4gLSBkeCwgeW1pbiAtIGR5KTtcclxuXHJcbiAgICAgICAgLy8gU29ydCBwb2ludHMgYWxvbmcgeS1heGlzXHJcbiAgICAgICAgdGhpcy5wb2ludHNfLnNvcnQoUG9pbnQuY29tcGFyZSk7XHJcbiAgICB9O1xyXG5cclxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUuaW5pdEVkZ2VzID0gZnVuY3Rpb24ocG9seWxpbmUpIHtcclxuICAgICAgICB2YXIgaSwgbGVuID0gcG9seWxpbmUubGVuZ3RoO1xyXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW47ICsraSkge1xyXG4gICAgICAgICAgICB0aGlzLmVkZ2VfbGlzdC5wdXNoKG5ldyBFZGdlKHBvbHlsaW5lW2ldLCBwb2x5bGluZVsoaSArIDEpICUgbGVuXSkpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5nZXRQb2ludCA9IGZ1bmN0aW9uKGluZGV4KSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMucG9pbnRzX1tpbmRleF07XHJcbiAgICB9O1xyXG5cclxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUuYWRkVG9NYXAgPSBmdW5jdGlvbih0cmlhbmdsZSkge1xyXG4gICAgICAgIHRoaXMubWFwXy5wdXNoKHRyaWFuZ2xlKTtcclxuICAgIH07XHJcblxyXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5sb2NhdGVOb2RlID0gZnVuY3Rpb24ocG9pbnQpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5mcm9udF8ubG9jYXRlTm9kZShwb2ludC54KTtcclxuICAgIH07XHJcblxyXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5jcmVhdGVBZHZhbmNpbmdGcm9udCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHZhciBoZWFkO1xyXG4gICAgICAgIHZhciBtaWRkbGU7XHJcbiAgICAgICAgdmFyIHRhaWw7XHJcbiAgICAgICAgLy8gSW5pdGlhbCB0cmlhbmdsZVxyXG4gICAgICAgIHZhciB0cmlhbmdsZSA9IG5ldyBUcmlhbmdsZSh0aGlzLnBvaW50c19bMF0sIHRoaXMudGFpbF8sIHRoaXMuaGVhZF8pO1xyXG5cclxuICAgICAgICB0aGlzLm1hcF8ucHVzaCh0cmlhbmdsZSk7XHJcblxyXG4gICAgICAgIGhlYWQgPSBuZXcgTm9kZSh0cmlhbmdsZS5nZXRQb2ludCgxKSwgdHJpYW5nbGUpO1xyXG4gICAgICAgIG1pZGRsZSA9IG5ldyBOb2RlKHRyaWFuZ2xlLmdldFBvaW50KDApLCB0cmlhbmdsZSk7XHJcbiAgICAgICAgdGFpbCA9IG5ldyBOb2RlKHRyaWFuZ2xlLmdldFBvaW50KDIpKTtcclxuXHJcbiAgICAgICAgdGhpcy5mcm9udF8gPSBuZXcgQWR2YW5jaW5nRnJvbnQoaGVhZCwgdGFpbCk7XHJcblxyXG4gICAgICAgIGhlYWQubmV4dCA9IG1pZGRsZTtcclxuICAgICAgICBtaWRkbGUubmV4dCA9IHRhaWw7XHJcbiAgICAgICAgbWlkZGxlLnByZXYgPSBoZWFkO1xyXG4gICAgICAgIHRhaWwucHJldiA9IG1pZGRsZTtcclxuICAgIH07XHJcblxyXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5yZW1vdmVOb2RlID0gZnVuY3Rpb24obm9kZSkge1xyXG4gICAgICAgIC8vIGRvIG5vdGhpbmdcclxuICAgICAgICAvKiBqc2hpbnQgdW51c2VkOmZhbHNlICovXHJcbiAgICB9O1xyXG5cclxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUubWFwVHJpYW5nbGVUb05vZGVzID0gZnVuY3Rpb24odCkge1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgMzsgKytpKSB7XHJcbiAgICAgICAgICAgIGlmICghIHQuZ2V0TmVpZ2hib3IoaSkpIHtcclxuICAgICAgICAgICAgICAgIHZhciBuID0gdGhpcy5mcm9udF8ubG9jYXRlUG9pbnQodC5wb2ludENXKHQuZ2V0UG9pbnQoaSkpKTtcclxuICAgICAgICAgICAgICAgIGlmIChuKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbi50cmlhbmdsZSA9IHQ7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIFN3ZWVwQ29udGV4dC5wcm90b3R5cGUucmVtb3ZlRnJvbU1hcCA9IGZ1bmN0aW9uKHRyaWFuZ2xlKSB7XHJcbiAgICAgICAgdmFyIGksIG1hcCA9IHRoaXMubWFwXywgbGVuID0gbWFwLmxlbmd0aDtcclxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcclxuICAgICAgICAgICAgaWYgKG1hcFtpXSA9PT0gdHJpYW5nbGUpIHtcclxuICAgICAgICAgICAgICAgIG1hcC5zcGxpY2UoaSwgMSk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBEbyBhIGRlcHRoIGZpcnN0IHRyYXZlcnNhbCB0byBjb2xsZWN0IHRyaWFuZ2xlc1xyXG4gICAgICogQHBhcmFtIHtUcmlhbmdsZX0gdHJpYW5nbGUgc3RhcnRcclxuICAgICAqL1xyXG4gICAgU3dlZXBDb250ZXh0LnByb3RvdHlwZS5tZXNoQ2xlYW4gPSBmdW5jdGlvbih0cmlhbmdsZSkge1xyXG4gICAgICAgIC8vIE5ldyBpbXBsZW1lbnRhdGlvbiBhdm9pZHMgcmVjdXJzaXZlIGNhbGxzIGFuZCB1c2UgYSBsb29wIGluc3RlYWQuXHJcbiAgICAgICAgLy8gQ2YuIGlzc3VlcyAjIDU3LCA2NSBhbmQgNjkuXHJcbiAgICAgICAgdmFyIHRyaWFuZ2xlcyA9IFt0cmlhbmdsZV0sIHQsIGk7XHJcbiAgICAgICAgLyoganNoaW50IGJvc3M6dHJ1ZSAqL1xyXG4gICAgICAgIHdoaWxlICh0ID0gdHJpYW5nbGVzLnBvcCgpKSB7XHJcbiAgICAgICAgICAgIGlmICghdC5pc0ludGVyaW9yKCkpIHtcclxuICAgICAgICAgICAgICAgIHQuc2V0SW50ZXJpb3IodHJ1ZSk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnRyaWFuZ2xlc18ucHVzaCh0KTtcclxuICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCAzOyBpKyspIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoIXQuY29uc3RyYWluZWRfZWRnZVtpXSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0cmlhbmdsZXMucHVzaCh0LmdldE5laWdoYm9yKGkpKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tU3dlZXBcclxuXHJcbiAgICAvKipcclxuICAgICAqIFRoZSAnU3dlZXAnIG9iamVjdCBpcyBwcmVzZW50IGluIG9yZGVyIHRvIGtlZXAgdGhpcyBKYXZhU2NyaXB0IHZlcnNpb24gXHJcbiAgICAgKiBhcyBjbG9zZSBhcyBwb3NzaWJsZSB0byB0aGUgcmVmZXJlbmNlIEMrKyB2ZXJzaW9uLCBldmVuIHRob3VnaCBhbG1vc3RcclxuICAgICAqIGFsbCBTd2VlcCBtZXRob2RzIGNvdWxkIGJlIGRlY2xhcmVkIGFzIG1lbWJlcnMgb2YgdGhlIFN3ZWVwQ29udGV4dCBvYmplY3QuXHJcbiAgICAgKi9cclxuICAgIHZhciBTd2VlcCA9IHt9O1xyXG5cclxuXHJcbiAgICAvKipcclxuICAgICAqIFRyaWFuZ3VsYXRlIHRoZSBwb2x5Z29uIHdpdGggaG9sZXMgYW5kIFN0ZWluZXIgcG9pbnRzLlxyXG4gICAgICogQHBhcmFtICAgdGN4IFN3ZWVwQ29udGV4dCBvYmplY3QuXHJcbiAgICAgKi9cclxuICAgIFN3ZWVwLnRyaWFuZ3VsYXRlID0gZnVuY3Rpb24odGN4KSB7XHJcbiAgICAgICAgdGN4LmluaXRUcmlhbmd1bGF0aW9uKCk7XHJcbiAgICAgICAgdGN4LmNyZWF0ZUFkdmFuY2luZ0Zyb250KCk7XHJcbiAgICAgICAgLy8gU3dlZXAgcG9pbnRzOyBidWlsZCBtZXNoXHJcbiAgICAgICAgU3dlZXAuc3dlZXBQb2ludHModGN4KTtcclxuICAgICAgICAvLyBDbGVhbiB1cFxyXG4gICAgICAgIFN3ZWVwLmZpbmFsaXphdGlvblBvbHlnb24odGN4KTtcclxuICAgIH07XHJcblxyXG4gICAgU3dlZXAuc3dlZXBQb2ludHMgPSBmdW5jdGlvbih0Y3gpIHtcclxuICAgICAgICB2YXIgaSwgbGVuID0gdGN4LnBvaW50Q291bnQoKTtcclxuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyArK2kpIHtcclxuICAgICAgICAgICAgdmFyIHBvaW50ID0gdGN4LmdldFBvaW50KGkpO1xyXG4gICAgICAgICAgICB2YXIgbm9kZSA9IFN3ZWVwLnBvaW50RXZlbnQodGN4LCBwb2ludCk7XHJcbiAgICAgICAgICAgIHZhciBlZGdlcyA9IHBvaW50Ll9wMnRfZWRnZV9saXN0O1xyXG4gICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgZWRnZXMgJiYgaiA8IGVkZ2VzLmxlbmd0aDsgKytqKSB7XHJcbiAgICAgICAgICAgICAgICBTd2VlcC5lZGdlRXZlbnRCeUVkZ2UodGN4LCBlZGdlc1tqXSwgbm9kZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIFN3ZWVwLmZpbmFsaXphdGlvblBvbHlnb24gPSBmdW5jdGlvbih0Y3gpIHtcclxuICAgICAgICAvLyBHZXQgYW4gSW50ZXJuYWwgdHJpYW5nbGUgdG8gc3RhcnQgd2l0aFxyXG4gICAgICAgIHZhciB0ID0gdGN4LmZyb250KCkuaGVhZCgpLm5leHQudHJpYW5nbGU7XHJcbiAgICAgICAgdmFyIHAgPSB0Y3guZnJvbnQoKS5oZWFkKCkubmV4dC5wb2ludDtcclxuICAgICAgICB3aGlsZSAoIXQuZ2V0Q29uc3RyYWluZWRFZGdlQ1cocCkpIHtcclxuICAgICAgICAgICAgdCA9IHQubmVpZ2hib3JDQ1cocCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBDb2xsZWN0IGludGVyaW9yIHRyaWFuZ2xlcyBjb25zdHJhaW5lZCBieSBlZGdlc1xyXG4gICAgICAgIHRjeC5tZXNoQ2xlYW4odCk7XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogRmluZCBjbG9zZXMgbm9kZSB0byB0aGUgbGVmdCBvZiB0aGUgbmV3IHBvaW50IGFuZFxyXG4gICAgICogY3JlYXRlIGEgbmV3IHRyaWFuZ2xlLiBJZiBuZWVkZWQgbmV3IGhvbGVzIGFuZCBiYXNpbnNcclxuICAgICAqIHdpbGwgYmUgZmlsbGVkIHRvLlxyXG4gICAgICovXHJcbiAgICBTd2VlcC5wb2ludEV2ZW50ID0gZnVuY3Rpb24odGN4LCBwb2ludCkge1xyXG4gICAgICAgIHZhciBub2RlID0gdGN4LmxvY2F0ZU5vZGUocG9pbnQpO1xyXG4gICAgICAgIHZhciBuZXdfbm9kZSA9IFN3ZWVwLm5ld0Zyb250VHJpYW5nbGUodGN4LCBwb2ludCwgbm9kZSk7XHJcblxyXG4gICAgICAgIC8vIE9ubHkgbmVlZCB0byBjaGVjayArZXBzaWxvbiBzaW5jZSBwb2ludCBuZXZlciBoYXZlIHNtYWxsZXJcclxuICAgICAgICAvLyB4IHZhbHVlIHRoYW4gbm9kZSBkdWUgdG8gaG93IHdlIGZldGNoIG5vZGVzIGZyb20gdGhlIGZyb250XHJcbiAgICAgICAgaWYgKHBvaW50LnggPD0gbm9kZS5wb2ludC54ICsgKEVQU0lMT04pKSB7XHJcbiAgICAgICAgICAgIFN3ZWVwLmZpbGwodGN4LCBub2RlKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vdGN4LkFkZE5vZGUobmV3X25vZGUpO1xyXG5cclxuICAgICAgICBTd2VlcC5maWxsQWR2YW5jaW5nRnJvbnQodGN4LCBuZXdfbm9kZSk7XHJcbiAgICAgICAgcmV0dXJuIG5ld19ub2RlO1xyXG4gICAgfTtcclxuXHJcbiAgICBTd2VlcC5lZGdlRXZlbnRCeUVkZ2UgPSBmdW5jdGlvbih0Y3gsIGVkZ2UsIG5vZGUpIHtcclxuICAgICAgICB0Y3guZWRnZV9ldmVudC5jb25zdHJhaW5lZF9lZGdlID0gZWRnZTtcclxuICAgICAgICB0Y3guZWRnZV9ldmVudC5yaWdodCA9IChlZGdlLnAueCA+IGVkZ2UucS54KTtcclxuXHJcbiAgICAgICAgaWYgKFN3ZWVwLmlzRWRnZVNpZGVPZlRyaWFuZ2xlKG5vZGUudHJpYW5nbGUsIGVkZ2UucCwgZWRnZS5xKSkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBGb3Igbm93IHdlIHdpbGwgZG8gYWxsIG5lZWRlZCBmaWxsaW5nXHJcbiAgICAgICAgLy8gVE9ETzogaW50ZWdyYXRlIHdpdGggZmxpcCBwcm9jZXNzIG1pZ2h0IGdpdmUgc29tZSBiZXR0ZXIgcGVyZm9ybWFuY2VcclxuICAgICAgICAvLyAgICAgICBidXQgZm9yIG5vdyB0aGlzIGF2b2lkIHRoZSBpc3N1ZSB3aXRoIGNhc2VzIHRoYXQgbmVlZHMgYm90aCBmbGlwcyBhbmQgZmlsbHNcclxuICAgICAgICBTd2VlcC5maWxsRWRnZUV2ZW50KHRjeCwgZWRnZSwgbm9kZSk7XHJcbiAgICAgICAgU3dlZXAuZWRnZUV2ZW50QnlQb2ludHModGN4LCBlZGdlLnAsIGVkZ2UucSwgbm9kZS50cmlhbmdsZSwgZWRnZS5xKTtcclxuICAgIH07XHJcblxyXG4gICAgU3dlZXAuZWRnZUV2ZW50QnlQb2ludHMgPSBmdW5jdGlvbih0Y3gsIGVwLCBlcSwgdHJpYW5nbGUsIHBvaW50KSB7XHJcbiAgICAgICAgaWYgKFN3ZWVwLmlzRWRnZVNpZGVPZlRyaWFuZ2xlKHRyaWFuZ2xlLCBlcCwgZXEpKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciBwMSA9IHRyaWFuZ2xlLnBvaW50Q0NXKHBvaW50KTtcclxuICAgICAgICB2YXIgbzEgPSBvcmllbnQyZChlcSwgcDEsIGVwKTtcclxuICAgICAgICBpZiAobzEgPT09IE9yaWVudGF0aW9uLkNPTExJTkVBUikge1xyXG4gICAgICAgICAgICAvLyBUT0RPIGludGVncmF0ZSBoZXJlIGNoYW5nZXMgZnJvbSBDKysgdmVyc2lvblxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgUG9pbnRFcnJvcigncG9seTJ0cmkgRWRnZUV2ZW50OiBDb2xsaW5lYXIgbm90IHN1cHBvcnRlZCEnLCBbZXEsIHAxLCBlcF0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdmFyIHAyID0gdHJpYW5nbGUucG9pbnRDVyhwb2ludCk7XHJcbiAgICAgICAgdmFyIG8yID0gb3JpZW50MmQoZXEsIHAyLCBlcCk7XHJcbiAgICAgICAgaWYgKG8yID09PSBPcmllbnRhdGlvbi5DT0xMSU5FQVIpIHtcclxuICAgICAgICAgICAgLy8gVE9ETyBpbnRlZ3JhdGUgaGVyZSBjaGFuZ2VzIGZyb20gQysrIHZlcnNpb25cclxuICAgICAgICAgICAgdGhyb3cgbmV3IFBvaW50RXJyb3IoJ3BvbHkydHJpIEVkZ2VFdmVudDogQ29sbGluZWFyIG5vdCBzdXBwb3J0ZWQhJywgW2VxLCBwMiwgZXBdKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChvMSA9PT0gbzIpIHtcclxuICAgICAgICAgICAgLy8gTmVlZCB0byBkZWNpZGUgaWYgd2UgYXJlIHJvdGF0aW5nIENXIG9yIENDVyB0byBnZXQgdG8gYSB0cmlhbmdsZVxyXG4gICAgICAgICAgICAvLyB0aGF0IHdpbGwgY3Jvc3MgZWRnZVxyXG4gICAgICAgICAgICBpZiAobzEgPT09IE9yaWVudGF0aW9uLkNXKSB7XHJcbiAgICAgICAgICAgICAgICB0cmlhbmdsZSA9IHRyaWFuZ2xlLm5laWdoYm9yQ0NXKHBvaW50KTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRyaWFuZ2xlID0gdHJpYW5nbGUubmVpZ2hib3JDVyhwb2ludCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgU3dlZXAuZWRnZUV2ZW50QnlQb2ludHModGN4LCBlcCwgZXEsIHRyaWFuZ2xlLCBwb2ludCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgLy8gVGhpcyB0cmlhbmdsZSBjcm9zc2VzIGNvbnN0cmFpbnQgc28gbGV0cyBmbGlwcGluIHN0YXJ0IVxyXG4gICAgICAgICAgICBTd2VlcC5mbGlwRWRnZUV2ZW50KHRjeCwgZXAsIGVxLCB0cmlhbmdsZSwgcG9pbnQpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgU3dlZXAuaXNFZGdlU2lkZU9mVHJpYW5nbGUgPSBmdW5jdGlvbih0cmlhbmdsZSwgZXAsIGVxKSB7XHJcbiAgICAgICAgdmFyIGluZGV4ID0gdHJpYW5nbGUuZWRnZUluZGV4KGVwLCBlcSk7XHJcbiAgICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xyXG4gICAgICAgICAgICB0cmlhbmdsZS5tYXJrQ29uc3RyYWluZWRFZGdlQnlJbmRleChpbmRleCk7XHJcbiAgICAgICAgICAgIHZhciB0ID0gdHJpYW5nbGUuZ2V0TmVpZ2hib3IoaW5kZXgpO1xyXG4gICAgICAgICAgICBpZiAodCkge1xyXG4gICAgICAgICAgICAgICAgdC5tYXJrQ29uc3RyYWluZWRFZGdlQnlQb2ludHMoZXAsIGVxKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfTtcclxuXHJcbiAgICBTd2VlcC5uZXdGcm9udFRyaWFuZ2xlID0gZnVuY3Rpb24odGN4LCBwb2ludCwgbm9kZSkge1xyXG4gICAgICAgIHZhciB0cmlhbmdsZSA9IG5ldyBUcmlhbmdsZShwb2ludCwgbm9kZS5wb2ludCwgbm9kZS5uZXh0LnBvaW50KTtcclxuXHJcbiAgICAgICAgdHJpYW5nbGUubWFya05laWdoYm9yKG5vZGUudHJpYW5nbGUpO1xyXG4gICAgICAgIHRjeC5hZGRUb01hcCh0cmlhbmdsZSk7XHJcblxyXG4gICAgICAgIHZhciBuZXdfbm9kZSA9IG5ldyBOb2RlKHBvaW50KTtcclxuICAgICAgICBuZXdfbm9kZS5uZXh0ID0gbm9kZS5uZXh0O1xyXG4gICAgICAgIG5ld19ub2RlLnByZXYgPSBub2RlO1xyXG4gICAgICAgIG5vZGUubmV4dC5wcmV2ID0gbmV3X25vZGU7XHJcbiAgICAgICAgbm9kZS5uZXh0ID0gbmV3X25vZGU7XHJcblxyXG4gICAgICAgIGlmICghU3dlZXAubGVnYWxpemUodGN4LCB0cmlhbmdsZSkpIHtcclxuICAgICAgICAgICAgdGN4Lm1hcFRyaWFuZ2xlVG9Ob2Rlcyh0cmlhbmdsZSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gbmV3X25vZGU7XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQWRkcyBhIHRyaWFuZ2xlIHRvIHRoZSBhZHZhbmNpbmcgZnJvbnQgdG8gZmlsbCBhIGhvbGUuXHJcbiAgICAgKiBAcGFyYW0gdGN4XHJcbiAgICAgKiBAcGFyYW0gbm9kZSAtIG1pZGRsZSBub2RlLCB0aGF0IGlzIHRoZSBib3R0b20gb2YgdGhlIGhvbGVcclxuICAgICAqL1xyXG4gICAgU3dlZXAuZmlsbCA9IGZ1bmN0aW9uKHRjeCwgbm9kZSkge1xyXG4gICAgICAgIHZhciB0cmlhbmdsZSA9IG5ldyBUcmlhbmdsZShub2RlLnByZXYucG9pbnQsIG5vZGUucG9pbnQsIG5vZGUubmV4dC5wb2ludCk7XHJcblxyXG4gICAgICAgIC8vIFRPRE86IHNob3VsZCBjb3B5IHRoZSBjb25zdHJhaW5lZF9lZGdlIHZhbHVlIGZyb20gbmVpZ2hib3IgdHJpYW5nbGVzXHJcbiAgICAgICAgLy8gICAgICAgZm9yIG5vdyBjb25zdHJhaW5lZF9lZGdlIHZhbHVlcyBhcmUgY29waWVkIGR1cmluZyB0aGUgbGVnYWxpemVcclxuICAgICAgICB0cmlhbmdsZS5tYXJrTmVpZ2hib3Iobm9kZS5wcmV2LnRyaWFuZ2xlKTtcclxuICAgICAgICB0cmlhbmdsZS5tYXJrTmVpZ2hib3Iobm9kZS50cmlhbmdsZSk7XHJcblxyXG4gICAgICAgIHRjeC5hZGRUb01hcCh0cmlhbmdsZSk7XHJcblxyXG4gICAgICAgIC8vIFVwZGF0ZSB0aGUgYWR2YW5jaW5nIGZyb250XHJcbiAgICAgICAgbm9kZS5wcmV2Lm5leHQgPSBub2RlLm5leHQ7XHJcbiAgICAgICAgbm9kZS5uZXh0LnByZXYgPSBub2RlLnByZXY7XHJcblxyXG5cclxuICAgICAgICAvLyBJZiBpdCB3YXMgbGVnYWxpemVkIHRoZSB0cmlhbmdsZSBoYXMgYWxyZWFkeSBiZWVuIG1hcHBlZFxyXG4gICAgICAgIGlmICghU3dlZXAubGVnYWxpemUodGN4LCB0cmlhbmdsZSkpIHtcclxuICAgICAgICAgICAgdGN4Lm1hcFRyaWFuZ2xlVG9Ob2Rlcyh0cmlhbmdsZSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvL3RjeC5yZW1vdmVOb2RlKG5vZGUpO1xyXG4gICAgfTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIEZpbGxzIGhvbGVzIGluIHRoZSBBZHZhbmNpbmcgRnJvbnRcclxuICAgICAqL1xyXG4gICAgU3dlZXAuZmlsbEFkdmFuY2luZ0Zyb250ID0gZnVuY3Rpb24odGN4LCBuKSB7XHJcbiAgICAgICAgLy8gRmlsbCByaWdodCBob2xlc1xyXG4gICAgICAgIHZhciBub2RlID0gbi5uZXh0O1xyXG4gICAgICAgIHZhciBhbmdsZTtcclxuICAgICAgICB3aGlsZSAobm9kZS5uZXh0KSB7XHJcbiAgICAgICAgICAgIGFuZ2xlID0gU3dlZXAuaG9sZUFuZ2xlKG5vZGUpO1xyXG4gICAgICAgICAgICBpZiAoYW5nbGUgPiBQSV8yIHx8IGFuZ2xlIDwgLShQSV8yKSkge1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgU3dlZXAuZmlsbCh0Y3gsIG5vZGUpO1xyXG4gICAgICAgICAgICBub2RlID0gbm9kZS5uZXh0O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gRmlsbCBsZWZ0IGhvbGVzXHJcbiAgICAgICAgbm9kZSA9IG4ucHJldjtcclxuICAgICAgICB3aGlsZSAobm9kZS5wcmV2KSB7XHJcbiAgICAgICAgICAgIGFuZ2xlID0gU3dlZXAuaG9sZUFuZ2xlKG5vZGUpO1xyXG4gICAgICAgICAgICBpZiAoYW5nbGUgPiBQSV8yIHx8IGFuZ2xlIDwgLShQSV8yKSkge1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgU3dlZXAuZmlsbCh0Y3gsIG5vZGUpO1xyXG4gICAgICAgICAgICBub2RlID0gbm9kZS5wcmV2O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gRmlsbCByaWdodCBiYXNpbnNcclxuICAgICAgICBpZiAobi5uZXh0ICYmIG4ubmV4dC5uZXh0KSB7XHJcbiAgICAgICAgICAgIGFuZ2xlID0gU3dlZXAuYmFzaW5BbmdsZShuKTtcclxuICAgICAgICAgICAgaWYgKGFuZ2xlIDwgUElfM2RpdjQpIHtcclxuICAgICAgICAgICAgICAgIFN3ZWVwLmZpbGxCYXNpbih0Y3gsIG4pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBTd2VlcC5iYXNpbkFuZ2xlID0gZnVuY3Rpb24obm9kZSkge1xyXG4gICAgICAgIHZhciBheCA9IG5vZGUucG9pbnQueCAtIG5vZGUubmV4dC5uZXh0LnBvaW50Lng7XHJcbiAgICAgICAgdmFyIGF5ID0gbm9kZS5wb2ludC55IC0gbm9kZS5uZXh0Lm5leHQucG9pbnQueTtcclxuICAgICAgICByZXR1cm4gTWF0aC5hdGFuMihheSwgYXgpO1xyXG4gICAgfTtcclxuXHJcbiAgICAvKipcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0gbm9kZSAtIG1pZGRsZSBub2RlXHJcbiAgICAgKiBAcmV0dXJuIHRoZSBhbmdsZSBiZXR3ZWVuIDMgZnJvbnQgbm9kZXNcclxuICAgICAqL1xyXG4gICAgU3dlZXAuaG9sZUFuZ2xlID0gZnVuY3Rpb24obm9kZSkge1xyXG4gICAgICAgIC8qIENvbXBsZXggcGxhbmVcclxuICAgICAgICAgKiBhYiA9IGNvc0EgK2kqc2luQVxyXG4gICAgICAgICAqIGFiID0gKGF4ICsgYXkqaSkoYnggKyBieSppKSA9IChheCpieCArIGF5KmJ5KSArIGkoYXgqYnktYXkqYngpXHJcbiAgICAgICAgICogYXRhbjIoeSx4KSBjb21wdXRlcyB0aGUgcHJpbmNpcGFsIHZhbHVlIG9mIHRoZSBhcmd1bWVudCBmdW5jdGlvblxyXG4gICAgICAgICAqIGFwcGxpZWQgdG8gdGhlIGNvbXBsZXggbnVtYmVyIHgraXlcclxuICAgICAgICAgKiBXaGVyZSB4ID0gYXgqYnggKyBheSpieVxyXG4gICAgICAgICAqICAgICAgIHkgPSBheCpieSAtIGF5KmJ4XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdmFyIGF4ID0gbm9kZS5uZXh0LnBvaW50LnggLSBub2RlLnBvaW50Lng7XHJcbiAgICAgICAgdmFyIGF5ID0gbm9kZS5uZXh0LnBvaW50LnkgLSBub2RlLnBvaW50Lnk7XHJcbiAgICAgICAgdmFyIGJ4ID0gbm9kZS5wcmV2LnBvaW50LnggLSBub2RlLnBvaW50Lng7XHJcbiAgICAgICAgdmFyIGJ5ID0gbm9kZS5wcmV2LnBvaW50LnkgLSBub2RlLnBvaW50Lnk7XHJcbiAgICAgICAgcmV0dXJuIE1hdGguYXRhbjIoYXggKiBieSAtIGF5ICogYngsIGF4ICogYnggKyBheSAqIGJ5KTtcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdHJpYW5nbGUgd2FzIGxlZ2FsaXplZFxyXG4gICAgICovXHJcbiAgICBTd2VlcC5sZWdhbGl6ZSA9IGZ1bmN0aW9uKHRjeCwgdCkge1xyXG4gICAgICAgIC8vIFRvIGxlZ2FsaXplIGEgdHJpYW5nbGUgd2Ugc3RhcnQgYnkgZmluZGluZyBpZiBhbnkgb2YgdGhlIHRocmVlIGVkZ2VzXHJcbiAgICAgICAgLy8gdmlvbGF0ZSB0aGUgRGVsYXVuYXkgY29uZGl0aW9uXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCAzOyArK2kpIHtcclxuICAgICAgICAgICAgaWYgKHQuZGVsYXVuYXlfZWRnZVtpXSkge1xyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdmFyIG90ID0gdC5nZXROZWlnaGJvcihpKTtcclxuICAgICAgICAgICAgaWYgKG90KSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgcCA9IHQuZ2V0UG9pbnQoaSk7XHJcbiAgICAgICAgICAgICAgICB2YXIgb3AgPSBvdC5vcHBvc2l0ZVBvaW50KHQsIHApO1xyXG4gICAgICAgICAgICAgICAgdmFyIG9pID0gb3QuaW5kZXgob3ApO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIElmIHRoaXMgaXMgYSBDb25zdHJhaW5lZCBFZGdlIG9yIGEgRGVsYXVuYXkgRWRnZShvbmx5IGR1cmluZyByZWN1cnNpdmUgbGVnYWxpemF0aW9uKVxyXG4gICAgICAgICAgICAgICAgLy8gdGhlbiB3ZSBzaG91bGQgbm90IHRyeSB0byBsZWdhbGl6ZVxyXG4gICAgICAgICAgICAgICAgaWYgKG90LmNvbnN0cmFpbmVkX2VkZ2Vbb2ldIHx8IG90LmRlbGF1bmF5X2VkZ2Vbb2ldKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdC5jb25zdHJhaW5lZF9lZGdlW2ldID0gb3QuY29uc3RyYWluZWRfZWRnZVtvaV07XHJcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgdmFyIGluc2lkZSA9IFN3ZWVwLmluQ2lyY2xlKHAsIHQucG9pbnRDQ1cocCksIHQucG9pbnRDVyhwKSwgb3ApO1xyXG4gICAgICAgICAgICAgICAgaWYgKGluc2lkZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIExldHMgbWFyayB0aGlzIHNoYXJlZCBlZGdlIGFzIERlbGF1bmF5XHJcbiAgICAgICAgICAgICAgICAgICAgdC5kZWxhdW5heV9lZGdlW2ldID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgICAgICBvdC5kZWxhdW5heV9lZGdlW29pXSA9IHRydWU7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vIExldHMgcm90YXRlIHNoYXJlZCBlZGdlIG9uZSB2ZXJ0ZXggQ1cgdG8gbGVnYWxpemUgaXRcclxuICAgICAgICAgICAgICAgICAgICBTd2VlcC5yb3RhdGVUcmlhbmdsZVBhaXIodCwgcCwgb3QsIG9wKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gV2Ugbm93IGdvdCBvbmUgdmFsaWQgRGVsYXVuYXkgRWRnZSBzaGFyZWQgYnkgdHdvIHRyaWFuZ2xlc1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIFRoaXMgZ2l2ZXMgdXMgNCBuZXcgZWRnZXMgdG8gY2hlY2sgZm9yIERlbGF1bmF5XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vIE1ha2Ugc3VyZSB0aGF0IHRyaWFuZ2xlIHRvIG5vZGUgbWFwcGluZyBpcyBkb25lIG9ubHkgb25lIHRpbWUgZm9yIGEgc3BlY2lmaWMgdHJpYW5nbGVcclxuICAgICAgICAgICAgICAgICAgICB2YXIgbm90X2xlZ2FsaXplZCA9ICFTd2VlcC5sZWdhbGl6ZSh0Y3gsIHQpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChub3RfbGVnYWxpemVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRjeC5tYXBUcmlhbmdsZVRvTm9kZXModCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICBub3RfbGVnYWxpemVkID0gIVN3ZWVwLmxlZ2FsaXplKHRjeCwgb3QpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChub3RfbGVnYWxpemVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRjeC5tYXBUcmlhbmdsZVRvTm9kZXMob3QpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAvLyBSZXNldCB0aGUgRGVsYXVuYXkgZWRnZXMsIHNpbmNlIHRoZXkgb25seSBhcmUgdmFsaWQgRGVsYXVuYXkgZWRnZXNcclxuICAgICAgICAgICAgICAgICAgICAvLyB1bnRpbCB3ZSBhZGQgYSBuZXcgdHJpYW5nbGUgb3IgcG9pbnQuXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gWFhYOiBuZWVkIHRvIHRoaW5rIGFib3V0IHRoaXMuIENhbiB0aGVzZSBlZGdlcyBiZSB0cmllZCBhZnRlciB3ZVxyXG4gICAgICAgICAgICAgICAgICAgIC8vICAgICAgcmV0dXJuIHRvIHByZXZpb3VzIHJlY3Vyc2l2ZSBsZXZlbD9cclxuICAgICAgICAgICAgICAgICAgICB0LmRlbGF1bmF5X2VkZ2VbaV0gPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICBvdC5kZWxhdW5heV9lZGdlW29pXSA9IGZhbHNlO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyBJZiB0cmlhbmdsZSBoYXZlIGJlZW4gbGVnYWxpemVkIG5vIG5lZWQgdG8gY2hlY2sgdGhlIG90aGVyIGVkZ2VzIHNpbmNlXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gdGhlIHJlY3Vyc2l2ZSBsZWdhbGl6YXRpb24gd2lsbCBoYW5kbGVzIHRob3NlIHNvIHdlIGNhbiBlbmQgaGVyZS5cclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogPGI+UmVxdWlyZW1lbnQ8L2I+Ojxicj5cclxuICAgICAqIDEuIGEsYiBhbmQgYyBmb3JtIGEgdHJpYW5nbGUuPGJyPlxyXG4gICAgICogMi4gYSBhbmQgZCBpcyBrbm93IHRvIGJlIG9uIG9wcG9zaXRlIHNpZGUgb2YgYmM8YnI+XHJcbiAgICAgKiA8cHJlPlxyXG4gICAgICogICAgICAgICAgICAgICAgYVxyXG4gICAgICogICAgICAgICAgICAgICAgK1xyXG4gICAgICogICAgICAgICAgICAgICAvIFxcXHJcbiAgICAgKiAgICAgICAgICAgICAgLyAgIFxcXHJcbiAgICAgKiAgICAgICAgICAgIGIvICAgICBcXGNcclxuICAgICAqICAgICAgICAgICAgKy0tLS0tLS0rXHJcbiAgICAgKiAgICAgICAgICAgLyAgICBkICAgIFxcXHJcbiAgICAgKiAgICAgICAgICAvICAgICAgICAgICBcXFxyXG4gICAgICogPC9wcmU+XHJcbiAgICAgKiA8Yj5GYWN0PC9iPjogZCBoYXMgdG8gYmUgaW4gYXJlYSBCIHRvIGhhdmUgYSBjaGFuY2UgdG8gYmUgaW5zaWRlIHRoZSBjaXJjbGUgZm9ybWVkIGJ5XHJcbiAgICAgKiAgYSxiIGFuZCBjPGJyPlxyXG4gICAgICogIGQgaXMgb3V0c2lkZSBCIGlmIG9yaWVudDJkKGEsYixkKSBvciBvcmllbnQyZChjLGEsZCkgaXMgQ1c8YnI+XHJcbiAgICAgKiAgVGhpcyBwcmVrbm93bGVkZ2UgZ2l2ZXMgdXMgYSB3YXkgdG8gb3B0aW1pemUgdGhlIGluY2lyY2xlIHRlc3RcclxuICAgICAqIEBwYXJhbSBwYSAtIHRyaWFuZ2xlIHBvaW50LCBvcHBvc2l0ZSBkXHJcbiAgICAgKiBAcGFyYW0gcGIgLSB0cmlhbmdsZSBwb2ludFxyXG4gICAgICogQHBhcmFtIHBjIC0gdHJpYW5nbGUgcG9pbnRcclxuICAgICAqIEBwYXJhbSBwZCAtIHBvaW50IG9wcG9zaXRlIGFcclxuICAgICAqIEByZXR1cm4gdHJ1ZSBpZiBkIGlzIGluc2lkZSBjaXJjbGUsIGZhbHNlIGlmIG9uIGNpcmNsZSBlZGdlXHJcbiAgICAgKi9cclxuICAgIFN3ZWVwLmluQ2lyY2xlID0gZnVuY3Rpb24ocGEsIHBiLCBwYywgcGQpIHtcclxuICAgICAgICB2YXIgYWR4ID0gcGEueCAtIHBkLng7XHJcbiAgICAgICAgdmFyIGFkeSA9IHBhLnkgLSBwZC55O1xyXG4gICAgICAgIHZhciBiZHggPSBwYi54IC0gcGQueDtcclxuICAgICAgICB2YXIgYmR5ID0gcGIueSAtIHBkLnk7XHJcblxyXG4gICAgICAgIHZhciBhZHhiZHkgPSBhZHggKiBiZHk7XHJcbiAgICAgICAgdmFyIGJkeGFkeSA9IGJkeCAqIGFkeTtcclxuICAgICAgICB2YXIgb2FiZCA9IGFkeGJkeSAtIGJkeGFkeTtcclxuICAgICAgICBpZiAob2FiZCA8PSAwKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciBjZHggPSBwYy54IC0gcGQueDtcclxuICAgICAgICB2YXIgY2R5ID0gcGMueSAtIHBkLnk7XHJcblxyXG4gICAgICAgIHZhciBjZHhhZHkgPSBjZHggKiBhZHk7XHJcbiAgICAgICAgdmFyIGFkeGNkeSA9IGFkeCAqIGNkeTtcclxuICAgICAgICB2YXIgb2NhZCA9IGNkeGFkeSAtIGFkeGNkeTtcclxuICAgICAgICBpZiAob2NhZCA8PSAwKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciBiZHhjZHkgPSBiZHggKiBjZHk7XHJcbiAgICAgICAgdmFyIGNkeGJkeSA9IGNkeCAqIGJkeTtcclxuXHJcbiAgICAgICAgdmFyIGFsaWZ0ID0gYWR4ICogYWR4ICsgYWR5ICogYWR5O1xyXG4gICAgICAgIHZhciBibGlmdCA9IGJkeCAqIGJkeCArIGJkeSAqIGJkeTtcclxuICAgICAgICB2YXIgY2xpZnQgPSBjZHggKiBjZHggKyBjZHkgKiBjZHk7XHJcblxyXG4gICAgICAgIHZhciBkZXQgPSBhbGlmdCAqIChiZHhjZHkgLSBjZHhiZHkpICsgYmxpZnQgKiBvY2FkICsgY2xpZnQgKiBvYWJkO1xyXG4gICAgICAgIHJldHVybiBkZXQgPiAwO1xyXG4gICAgfTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFJvdGF0ZXMgYSB0cmlhbmdsZSBwYWlyIG9uZSB2ZXJ0ZXggQ1dcclxuICAgICAqPHByZT5cclxuICAgICAqICAgICAgIG4yICAgICAgICAgICAgICAgICAgICBuMlxyXG4gICAgICogIFAgKy0tLS0tKyAgICAgICAgICAgICBQICstLS0tLStcclxuICAgICAqICAgIHwgdCAgL3wgICAgICAgICAgICAgICB8XFwgIHQgfFxyXG4gICAgICogICAgfCAgIC8gfCAgICAgICAgICAgICAgIHwgXFwgICB8XHJcbiAgICAgKiAgbjF8ICAvICB8bjMgICAgICAgICAgIG4xfCAgXFwgIHxuM1xyXG4gICAgICogICAgfCAvICAgfCAgICBhZnRlciBDVyAgIHwgICBcXCB8XHJcbiAgICAgKiAgICB8LyBvVCB8ICAgICAgICAgICAgICAgfCBvVCBcXHxcclxuICAgICAqICAgICstLS0tLSsgb1AgICAgICAgICAgICArLS0tLS0rXHJcbiAgICAgKiAgICAgICBuNCAgICAgICAgICAgICAgICAgICAgbjRcclxuICAgICAqIDwvcHJlPlxyXG4gICAgICovXHJcbiAgICBTd2VlcC5yb3RhdGVUcmlhbmdsZVBhaXIgPSBmdW5jdGlvbih0LCBwLCBvdCwgb3ApIHtcclxuICAgICAgICB2YXIgbjEsIG4yLCBuMywgbjQ7XHJcbiAgICAgICAgbjEgPSB0Lm5laWdoYm9yQ0NXKHApO1xyXG4gICAgICAgIG4yID0gdC5uZWlnaGJvckNXKHApO1xyXG4gICAgICAgIG4zID0gb3QubmVpZ2hib3JDQ1cob3ApO1xyXG4gICAgICAgIG40ID0gb3QubmVpZ2hib3JDVyhvcCk7XHJcblxyXG4gICAgICAgIHZhciBjZTEsIGNlMiwgY2UzLCBjZTQ7XHJcbiAgICAgICAgY2UxID0gdC5nZXRDb25zdHJhaW5lZEVkZ2VDQ1cocCk7XHJcbiAgICAgICAgY2UyID0gdC5nZXRDb25zdHJhaW5lZEVkZ2VDVyhwKTtcclxuICAgICAgICBjZTMgPSBvdC5nZXRDb25zdHJhaW5lZEVkZ2VDQ1cob3ApO1xyXG4gICAgICAgIGNlNCA9IG90LmdldENvbnN0cmFpbmVkRWRnZUNXKG9wKTtcclxuXHJcbiAgICAgICAgdmFyIGRlMSwgZGUyLCBkZTMsIGRlNDtcclxuICAgICAgICBkZTEgPSB0LmdldERlbGF1bmF5RWRnZUNDVyhwKTtcclxuICAgICAgICBkZTIgPSB0LmdldERlbGF1bmF5RWRnZUNXKHApO1xyXG4gICAgICAgIGRlMyA9IG90LmdldERlbGF1bmF5RWRnZUNDVyhvcCk7XHJcbiAgICAgICAgZGU0ID0gb3QuZ2V0RGVsYXVuYXlFZGdlQ1cob3ApO1xyXG5cclxuICAgICAgICB0LmxlZ2FsaXplKHAsIG9wKTtcclxuICAgICAgICBvdC5sZWdhbGl6ZShvcCwgcCk7XHJcblxyXG4gICAgICAgIC8vIFJlbWFwIGRlbGF1bmF5X2VkZ2VcclxuICAgICAgICBvdC5zZXREZWxhdW5heUVkZ2VDQ1cocCwgZGUxKTtcclxuICAgICAgICB0LnNldERlbGF1bmF5RWRnZUNXKHAsIGRlMik7XHJcbiAgICAgICAgdC5zZXREZWxhdW5heUVkZ2VDQ1cob3AsIGRlMyk7XHJcbiAgICAgICAgb3Quc2V0RGVsYXVuYXlFZGdlQ1cob3AsIGRlNCk7XHJcblxyXG4gICAgICAgIC8vIFJlbWFwIGNvbnN0cmFpbmVkX2VkZ2VcclxuICAgICAgICBvdC5zZXRDb25zdHJhaW5lZEVkZ2VDQ1cocCwgY2UxKTtcclxuICAgICAgICB0LnNldENvbnN0cmFpbmVkRWRnZUNXKHAsIGNlMik7XHJcbiAgICAgICAgdC5zZXRDb25zdHJhaW5lZEVkZ2VDQ1cob3AsIGNlMyk7XHJcbiAgICAgICAgb3Quc2V0Q29uc3RyYWluZWRFZGdlQ1cob3AsIGNlNCk7XHJcblxyXG4gICAgICAgIC8vIFJlbWFwIG5laWdoYm9yc1xyXG4gICAgICAgIC8vIFhYWDogbWlnaHQgb3B0aW1pemUgdGhlIG1hcmtOZWlnaGJvciBieSBrZWVwaW5nIHRyYWNrIG9mXHJcbiAgICAgICAgLy8gICAgICB3aGF0IHNpZGUgc2hvdWxkIGJlIGFzc2lnbmVkIHRvIHdoYXQgbmVpZ2hib3IgYWZ0ZXIgdGhlXHJcbiAgICAgICAgLy8gICAgICByb3RhdGlvbi4gTm93IG1hcmsgbmVpZ2hib3IgZG9lcyBsb3RzIG9mIHRlc3RpbmcgdG8gZmluZFxyXG4gICAgICAgIC8vICAgICAgdGhlIHJpZ2h0IHNpZGUuXHJcbiAgICAgICAgdC5jbGVhck5laWdib3JzKCk7XHJcbiAgICAgICAgb3QuY2xlYXJOZWlnYm9ycygpO1xyXG4gICAgICAgIGlmIChuMSkge1xyXG4gICAgICAgICAgICBvdC5tYXJrTmVpZ2hib3IobjEpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAobjIpIHtcclxuICAgICAgICAgICAgdC5tYXJrTmVpZ2hib3IobjIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAobjMpIHtcclxuICAgICAgICAgICAgdC5tYXJrTmVpZ2hib3IobjMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAobjQpIHtcclxuICAgICAgICAgICAgb3QubWFya05laWdoYm9yKG40KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdC5tYXJrTmVpZ2hib3Iob3QpO1xyXG4gICAgfTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIEZpbGxzIGEgYmFzaW4gdGhhdCBoYXMgZm9ybWVkIG9uIHRoZSBBZHZhbmNpbmcgRnJvbnQgdG8gdGhlIHJpZ2h0XHJcbiAgICAgKiBvZiBnaXZlbiBub2RlLjxicj5cclxuICAgICAqIEZpcnN0IHdlIGRlY2lkZSBhIGxlZnQsYm90dG9tIGFuZCByaWdodCBub2RlIHRoYXQgZm9ybXMgdGhlXHJcbiAgICAgKiBib3VuZGFyaWVzIG9mIHRoZSBiYXNpbi4gVGhlbiB3ZSBkbyBhIHJlcXVyc2l2ZSBmaWxsLlxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSB0Y3hcclxuICAgICAqIEBwYXJhbSBub2RlIC0gc3RhcnRpbmcgbm9kZSwgdGhpcyBvciBuZXh0IG5vZGUgd2lsbCBiZSBsZWZ0IG5vZGVcclxuICAgICAqL1xyXG4gICAgU3dlZXAuZmlsbEJhc2luID0gZnVuY3Rpb24odGN4LCBub2RlKSB7XHJcbiAgICAgICAgaWYgKG9yaWVudDJkKG5vZGUucG9pbnQsIG5vZGUubmV4dC5wb2ludCwgbm9kZS5uZXh0Lm5leHQucG9pbnQpID09PSBPcmllbnRhdGlvbi5DQ1cpIHtcclxuICAgICAgICAgICAgdGN4LmJhc2luLmxlZnRfbm9kZSA9IG5vZGUubmV4dC5uZXh0O1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRjeC5iYXNpbi5sZWZ0X25vZGUgPSBub2RlLm5leHQ7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBGaW5kIHRoZSBib3R0b20gYW5kIHJpZ2h0IG5vZGVcclxuICAgICAgICB0Y3guYmFzaW4uYm90dG9tX25vZGUgPSB0Y3guYmFzaW4ubGVmdF9ub2RlO1xyXG4gICAgICAgIHdoaWxlICh0Y3guYmFzaW4uYm90dG9tX25vZGUubmV4dCAmJiB0Y3guYmFzaW4uYm90dG9tX25vZGUucG9pbnQueSA+PSB0Y3guYmFzaW4uYm90dG9tX25vZGUubmV4dC5wb2ludC55KSB7XHJcbiAgICAgICAgICAgIHRjeC5iYXNpbi5ib3R0b21fbm9kZSA9IHRjeC5iYXNpbi5ib3R0b21fbm9kZS5uZXh0O1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGN4LmJhc2luLmJvdHRvbV9ub2RlID09PSB0Y3guYmFzaW4ubGVmdF9ub2RlKSB7XHJcbiAgICAgICAgICAgIC8vIE5vIHZhbGlkIGJhc2luXHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRjeC5iYXNpbi5yaWdodF9ub2RlID0gdGN4LmJhc2luLmJvdHRvbV9ub2RlO1xyXG4gICAgICAgIHdoaWxlICh0Y3guYmFzaW4ucmlnaHRfbm9kZS5uZXh0ICYmIHRjeC5iYXNpbi5yaWdodF9ub2RlLnBvaW50LnkgPCB0Y3guYmFzaW4ucmlnaHRfbm9kZS5uZXh0LnBvaW50LnkpIHtcclxuICAgICAgICAgICAgdGN4LmJhc2luLnJpZ2h0X25vZGUgPSB0Y3guYmFzaW4ucmlnaHRfbm9kZS5uZXh0O1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGN4LmJhc2luLnJpZ2h0X25vZGUgPT09IHRjeC5iYXNpbi5ib3R0b21fbm9kZSkge1xyXG4gICAgICAgICAgICAvLyBObyB2YWxpZCBiYXNpbnNcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGN4LmJhc2luLndpZHRoID0gdGN4LmJhc2luLnJpZ2h0X25vZGUucG9pbnQueCAtIHRjeC5iYXNpbi5sZWZ0X25vZGUucG9pbnQueDtcclxuICAgICAgICB0Y3guYmFzaW4ubGVmdF9oaWdoZXN0ID0gdGN4LmJhc2luLmxlZnRfbm9kZS5wb2ludC55ID4gdGN4LmJhc2luLnJpZ2h0X25vZGUucG9pbnQueTtcclxuXHJcbiAgICAgICAgU3dlZXAuZmlsbEJhc2luUmVxKHRjeCwgdGN4LmJhc2luLmJvdHRvbV9ub2RlKTtcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZWN1cnNpdmUgYWxnb3JpdGhtIHRvIGZpbGwgYSBCYXNpbiB3aXRoIHRyaWFuZ2xlc1xyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSB0Y3hcclxuICAgICAqIEBwYXJhbSBub2RlIC0gYm90dG9tX25vZGVcclxuICAgICAqL1xyXG4gICAgU3dlZXAuZmlsbEJhc2luUmVxID0gZnVuY3Rpb24odGN4LCBub2RlKSB7XHJcbiAgICAgICAgLy8gaWYgc2hhbGxvdyBzdG9wIGZpbGxpbmdcclxuICAgICAgICBpZiAoU3dlZXAuaXNTaGFsbG93KHRjeCwgbm9kZSkpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgU3dlZXAuZmlsbCh0Y3gsIG5vZGUpO1xyXG5cclxuICAgICAgICB2YXIgbztcclxuICAgICAgICBpZiAobm9kZS5wcmV2ID09PSB0Y3guYmFzaW4ubGVmdF9ub2RlICYmIG5vZGUubmV4dCA9PT0gdGN4LmJhc2luLnJpZ2h0X25vZGUpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH0gZWxzZSBpZiAobm9kZS5wcmV2ID09PSB0Y3guYmFzaW4ubGVmdF9ub2RlKSB7XHJcbiAgICAgICAgICAgIG8gPSBvcmllbnQyZChub2RlLnBvaW50LCBub2RlLm5leHQucG9pbnQsIG5vZGUubmV4dC5uZXh0LnBvaW50KTtcclxuICAgICAgICAgICAgaWYgKG8gPT09IE9yaWVudGF0aW9uLkNXKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgbm9kZSA9IG5vZGUubmV4dDtcclxuICAgICAgICB9IGVsc2UgaWYgKG5vZGUubmV4dCA9PT0gdGN4LmJhc2luLnJpZ2h0X25vZGUpIHtcclxuICAgICAgICAgICAgbyA9IG9yaWVudDJkKG5vZGUucG9pbnQsIG5vZGUucHJldi5wb2ludCwgbm9kZS5wcmV2LnByZXYucG9pbnQpO1xyXG4gICAgICAgICAgICBpZiAobyA9PT0gT3JpZW50YXRpb24uQ0NXKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgbm9kZSA9IG5vZGUucHJldjtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBDb250aW51ZSB3aXRoIHRoZSBuZWlnaGJvciBub2RlIHdpdGggbG93ZXN0IFkgdmFsdWVcclxuICAgICAgICAgICAgaWYgKG5vZGUucHJldi5wb2ludC55IDwgbm9kZS5uZXh0LnBvaW50LnkpIHtcclxuICAgICAgICAgICAgICAgIG5vZGUgPSBub2RlLnByZXY7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBub2RlID0gbm9kZS5uZXh0O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBTd2VlcC5maWxsQmFzaW5SZXEodGN4LCBub2RlKTtcclxuICAgIH07XHJcblxyXG4gICAgU3dlZXAuaXNTaGFsbG93ID0gZnVuY3Rpb24odGN4LCBub2RlKSB7XHJcbiAgICAgICAgdmFyIGhlaWdodDtcclxuICAgICAgICBpZiAodGN4LmJhc2luLmxlZnRfaGlnaGVzdCkge1xyXG4gICAgICAgICAgICBoZWlnaHQgPSB0Y3guYmFzaW4ubGVmdF9ub2RlLnBvaW50LnkgLSBub2RlLnBvaW50Lnk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgaGVpZ2h0ID0gdGN4LmJhc2luLnJpZ2h0X25vZGUucG9pbnQueSAtIG5vZGUucG9pbnQueTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIGlmIHNoYWxsb3cgc3RvcCBmaWxsaW5nXHJcbiAgICAgICAgaWYgKHRjeC5iYXNpbi53aWR0aCA+IGhlaWdodCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfTtcclxuXHJcbiAgICBTd2VlcC5maWxsRWRnZUV2ZW50ID0gZnVuY3Rpb24odGN4LCBlZGdlLCBub2RlKSB7XHJcbiAgICAgICAgaWYgKHRjeC5lZGdlX2V2ZW50LnJpZ2h0KSB7XHJcbiAgICAgICAgICAgIFN3ZWVwLmZpbGxSaWdodEFib3ZlRWRnZUV2ZW50KHRjeCwgZWRnZSwgbm9kZSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgU3dlZXAuZmlsbExlZnRBYm92ZUVkZ2VFdmVudCh0Y3gsIGVkZ2UsIG5vZGUpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgU3dlZXAuZmlsbFJpZ2h0QWJvdmVFZGdlRXZlbnQgPSBmdW5jdGlvbih0Y3gsIGVkZ2UsIG5vZGUpIHtcclxuICAgICAgICB3aGlsZSAobm9kZS5uZXh0LnBvaW50LnggPCBlZGdlLnAueCkge1xyXG4gICAgICAgICAgICAvLyBDaGVjayBpZiBuZXh0IG5vZGUgaXMgYmVsb3cgdGhlIGVkZ2VcclxuICAgICAgICAgICAgaWYgKG9yaWVudDJkKGVkZ2UucSwgbm9kZS5uZXh0LnBvaW50LCBlZGdlLnApID09PSBPcmllbnRhdGlvbi5DQ1cpIHtcclxuICAgICAgICAgICAgICAgIFN3ZWVwLmZpbGxSaWdodEJlbG93RWRnZUV2ZW50KHRjeCwgZWRnZSwgbm9kZSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBub2RlID0gbm9kZS5uZXh0O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBTd2VlcC5maWxsUmlnaHRCZWxvd0VkZ2VFdmVudCA9IGZ1bmN0aW9uKHRjeCwgZWRnZSwgbm9kZSkge1xyXG4gICAgICAgIGlmIChub2RlLnBvaW50LnggPCBlZGdlLnAueCkge1xyXG4gICAgICAgICAgICBpZiAob3JpZW50MmQobm9kZS5wb2ludCwgbm9kZS5uZXh0LnBvaW50LCBub2RlLm5leHQubmV4dC5wb2ludCkgPT09IE9yaWVudGF0aW9uLkNDVykge1xyXG4gICAgICAgICAgICAgICAgLy8gQ29uY2F2ZVxyXG4gICAgICAgICAgICAgICAgU3dlZXAuZmlsbFJpZ2h0Q29uY2F2ZUVkZ2VFdmVudCh0Y3gsIGVkZ2UsIG5vZGUpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgLy8gQ29udmV4XHJcbiAgICAgICAgICAgICAgICBTd2VlcC5maWxsUmlnaHRDb252ZXhFZGdlRXZlbnQodGN4LCBlZGdlLCBub2RlKTtcclxuICAgICAgICAgICAgICAgIC8vIFJldHJ5IHRoaXMgb25lXHJcbiAgICAgICAgICAgICAgICBTd2VlcC5maWxsUmlnaHRCZWxvd0VkZ2VFdmVudCh0Y3gsIGVkZ2UsIG5vZGUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBTd2VlcC5maWxsUmlnaHRDb25jYXZlRWRnZUV2ZW50ID0gZnVuY3Rpb24odGN4LCBlZGdlLCBub2RlKSB7XHJcbiAgICAgICAgU3dlZXAuZmlsbCh0Y3gsIG5vZGUubmV4dCk7XHJcbiAgICAgICAgaWYgKG5vZGUubmV4dC5wb2ludCAhPT0gZWRnZS5wKSB7XHJcbiAgICAgICAgICAgIC8vIE5leHQgYWJvdmUgb3IgYmVsb3cgZWRnZT9cclxuICAgICAgICAgICAgaWYgKG9yaWVudDJkKGVkZ2UucSwgbm9kZS5uZXh0LnBvaW50LCBlZGdlLnApID09PSBPcmllbnRhdGlvbi5DQ1cpIHtcclxuICAgICAgICAgICAgICAgIC8vIEJlbG93XHJcbiAgICAgICAgICAgICAgICBpZiAob3JpZW50MmQobm9kZS5wb2ludCwgbm9kZS5uZXh0LnBvaW50LCBub2RlLm5leHQubmV4dC5wb2ludCkgPT09IE9yaWVudGF0aW9uLkNDVykge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIE5leHQgaXMgY29uY2F2ZVxyXG4gICAgICAgICAgICAgICAgICAgIFN3ZWVwLmZpbGxSaWdodENvbmNhdmVFZGdlRXZlbnQodGN4LCBlZGdlLCBub2RlKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gTmV4dCBpcyBjb252ZXhcclxuICAgICAgICAgICAgICAgICAgICAvKiBqc2hpbnQgbm9lbXB0eTpmYWxzZSAqL1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBTd2VlcC5maWxsUmlnaHRDb252ZXhFZGdlRXZlbnQgPSBmdW5jdGlvbih0Y3gsIGVkZ2UsIG5vZGUpIHtcclxuICAgICAgICAvLyBOZXh0IGNvbmNhdmUgb3IgY29udmV4P1xyXG4gICAgICAgIGlmIChvcmllbnQyZChub2RlLm5leHQucG9pbnQsIG5vZGUubmV4dC5uZXh0LnBvaW50LCBub2RlLm5leHQubmV4dC5uZXh0LnBvaW50KSA9PT0gT3JpZW50YXRpb24uQ0NXKSB7XHJcbiAgICAgICAgICAgIC8vIENvbmNhdmVcclxuICAgICAgICAgICAgU3dlZXAuZmlsbFJpZ2h0Q29uY2F2ZUVkZ2VFdmVudCh0Y3gsIGVkZ2UsIG5vZGUubmV4dCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgLy8gQ29udmV4XHJcbiAgICAgICAgICAgIC8vIE5leHQgYWJvdmUgb3IgYmVsb3cgZWRnZT9cclxuICAgICAgICAgICAgaWYgKG9yaWVudDJkKGVkZ2UucSwgbm9kZS5uZXh0Lm5leHQucG9pbnQsIGVkZ2UucCkgPT09IE9yaWVudGF0aW9uLkNDVykge1xyXG4gICAgICAgICAgICAgICAgLy8gQmVsb3dcclxuICAgICAgICAgICAgICAgIFN3ZWVwLmZpbGxSaWdodENvbnZleEVkZ2VFdmVudCh0Y3gsIGVkZ2UsIG5vZGUubmV4dCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAvLyBBYm92ZVxyXG4gICAgICAgICAgICAgICAgLyoganNoaW50IG5vZW1wdHk6ZmFsc2UgKi9cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgU3dlZXAuZmlsbExlZnRBYm92ZUVkZ2VFdmVudCA9IGZ1bmN0aW9uKHRjeCwgZWRnZSwgbm9kZSkge1xyXG4gICAgICAgIHdoaWxlIChub2RlLnByZXYucG9pbnQueCA+IGVkZ2UucC54KSB7XHJcbiAgICAgICAgICAgIC8vIENoZWNrIGlmIG5leHQgbm9kZSBpcyBiZWxvdyB0aGUgZWRnZVxyXG4gICAgICAgICAgICBpZiAob3JpZW50MmQoZWRnZS5xLCBub2RlLnByZXYucG9pbnQsIGVkZ2UucCkgPT09IE9yaWVudGF0aW9uLkNXKSB7XHJcbiAgICAgICAgICAgICAgICBTd2VlcC5maWxsTGVmdEJlbG93RWRnZUV2ZW50KHRjeCwgZWRnZSwgbm9kZSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBub2RlID0gbm9kZS5wcmV2O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBTd2VlcC5maWxsTGVmdEJlbG93RWRnZUV2ZW50ID0gZnVuY3Rpb24odGN4LCBlZGdlLCBub2RlKSB7XHJcbiAgICAgICAgaWYgKG5vZGUucG9pbnQueCA+IGVkZ2UucC54KSB7XHJcbiAgICAgICAgICAgIGlmIChvcmllbnQyZChub2RlLnBvaW50LCBub2RlLnByZXYucG9pbnQsIG5vZGUucHJldi5wcmV2LnBvaW50KSA9PT0gT3JpZW50YXRpb24uQ1cpIHtcclxuICAgICAgICAgICAgICAgIC8vIENvbmNhdmVcclxuICAgICAgICAgICAgICAgIFN3ZWVwLmZpbGxMZWZ0Q29uY2F2ZUVkZ2VFdmVudCh0Y3gsIGVkZ2UsIG5vZGUpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgLy8gQ29udmV4XHJcbiAgICAgICAgICAgICAgICBTd2VlcC5maWxsTGVmdENvbnZleEVkZ2VFdmVudCh0Y3gsIGVkZ2UsIG5vZGUpO1xyXG4gICAgICAgICAgICAgICAgLy8gUmV0cnkgdGhpcyBvbmVcclxuICAgICAgICAgICAgICAgIFN3ZWVwLmZpbGxMZWZ0QmVsb3dFZGdlRXZlbnQodGN4LCBlZGdlLCBub2RlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgU3dlZXAuZmlsbExlZnRDb252ZXhFZGdlRXZlbnQgPSBmdW5jdGlvbih0Y3gsIGVkZ2UsIG5vZGUpIHtcclxuICAgICAgICAvLyBOZXh0IGNvbmNhdmUgb3IgY29udmV4P1xyXG4gICAgICAgIGlmIChvcmllbnQyZChub2RlLnByZXYucG9pbnQsIG5vZGUucHJldi5wcmV2LnBvaW50LCBub2RlLnByZXYucHJldi5wcmV2LnBvaW50KSA9PT0gT3JpZW50YXRpb24uQ1cpIHtcclxuICAgICAgICAgICAgLy8gQ29uY2F2ZVxyXG4gICAgICAgICAgICBTd2VlcC5maWxsTGVmdENvbmNhdmVFZGdlRXZlbnQodGN4LCBlZGdlLCBub2RlLnByZXYpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIC8vIENvbnZleFxyXG4gICAgICAgICAgICAvLyBOZXh0IGFib3ZlIG9yIGJlbG93IGVkZ2U/XHJcbiAgICAgICAgICAgIGlmIChvcmllbnQyZChlZGdlLnEsIG5vZGUucHJldi5wcmV2LnBvaW50LCBlZGdlLnApID09PSBPcmllbnRhdGlvbi5DVykge1xyXG4gICAgICAgICAgICAgICAgLy8gQmVsb3dcclxuICAgICAgICAgICAgICAgIFN3ZWVwLmZpbGxMZWZ0Q29udmV4RWRnZUV2ZW50KHRjeCwgZWRnZSwgbm9kZS5wcmV2KTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIC8vIEFib3ZlXHJcbiAgICAgICAgICAgICAgICAvKiBqc2hpbnQgbm9lbXB0eTpmYWxzZSAqL1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBTd2VlcC5maWxsTGVmdENvbmNhdmVFZGdlRXZlbnQgPSBmdW5jdGlvbih0Y3gsIGVkZ2UsIG5vZGUpIHtcclxuICAgICAgICBTd2VlcC5maWxsKHRjeCwgbm9kZS5wcmV2KTtcclxuICAgICAgICBpZiAobm9kZS5wcmV2LnBvaW50ICE9PSBlZGdlLnApIHtcclxuICAgICAgICAgICAgLy8gTmV4dCBhYm92ZSBvciBiZWxvdyBlZGdlP1xyXG4gICAgICAgICAgICBpZiAob3JpZW50MmQoZWRnZS5xLCBub2RlLnByZXYucG9pbnQsIGVkZ2UucCkgPT09IE9yaWVudGF0aW9uLkNXKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBCZWxvd1xyXG4gICAgICAgICAgICAgICAgaWYgKG9yaWVudDJkKG5vZGUucG9pbnQsIG5vZGUucHJldi5wb2ludCwgbm9kZS5wcmV2LnByZXYucG9pbnQpID09PSBPcmllbnRhdGlvbi5DVykge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIE5leHQgaXMgY29uY2F2ZVxyXG4gICAgICAgICAgICAgICAgICAgIFN3ZWVwLmZpbGxMZWZ0Q29uY2F2ZUVkZ2VFdmVudCh0Y3gsIGVkZ2UsIG5vZGUpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBOZXh0IGlzIGNvbnZleFxyXG4gICAgICAgICAgICAgICAgICAgIC8qIGpzaGludCBub2VtcHR5OmZhbHNlICovXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIFN3ZWVwLmZsaXBFZGdlRXZlbnQgPSBmdW5jdGlvbih0Y3gsIGVwLCBlcSwgdCwgcCkge1xyXG4gICAgICAgIHZhciBvdCA9IHQubmVpZ2hib3JBY3Jvc3MocCk7XHJcbiAgICAgICAgaWYgKCFvdCkge1xyXG4gICAgICAgICAgICAvLyBJZiB3ZSB3YW50IHRvIGludGVncmF0ZSB0aGUgZmlsbEVkZ2VFdmVudCBkbyBpdCBoZXJlXHJcbiAgICAgICAgICAgIC8vIFdpdGggY3VycmVudCBpbXBsZW1lbnRhdGlvbiB3ZSBzaG91bGQgbmV2ZXIgZ2V0IGhlcmVcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdwb2x5MnRyaSBbQlVHOkZJWE1FXSBGTElQIGZhaWxlZCBkdWUgdG8gbWlzc2luZyB0cmlhbmdsZSEnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyIG9wID0gb3Qub3Bwb3NpdGVQb2ludCh0LCBwKTtcclxuXHJcbiAgICAgICAgaWYgKGluU2NhbkFyZWEocCwgdC5wb2ludENDVyhwKSwgdC5wb2ludENXKHApLCBvcCkpIHtcclxuICAgICAgICAgICAgLy8gTGV0cyByb3RhdGUgc2hhcmVkIGVkZ2Ugb25lIHZlcnRleCBDV1xyXG4gICAgICAgICAgICBTd2VlcC5yb3RhdGVUcmlhbmdsZVBhaXIodCwgcCwgb3QsIG9wKTtcclxuICAgICAgICAgICAgdGN4Lm1hcFRyaWFuZ2xlVG9Ob2Rlcyh0KTtcclxuICAgICAgICAgICAgdGN4Lm1hcFRyaWFuZ2xlVG9Ob2RlcyhvdCk7XHJcblxyXG4gICAgICAgICAgICAvLyBYWFg6IGluIHRoZSBvcmlnaW5hbCBDKysgY29kZSBmb3IgdGhlIG5leHQgMiBsaW5lcywgd2UgYXJlXHJcbiAgICAgICAgICAgIC8vIGNvbXBhcmluZyBwb2ludCB2YWx1ZXMgKGFuZCBub3QgcG9pbnRlcnMpLiBJbiB0aGlzIEphdmFTY3JpcHRcclxuICAgICAgICAgICAgLy8gY29kZSwgd2UgYXJlIGNvbXBhcmluZyBwb2ludCByZWZlcmVuY2VzIChwb2ludGVycykuIFRoaXMgd29ya3NcclxuICAgICAgICAgICAgLy8gYmVjYXVzZSB3ZSBjYW4ndCBoYXZlIDIgZGlmZmVyZW50IHBvaW50cyB3aXRoIHRoZSBzYW1lIHZhbHVlcy5cclxuICAgICAgICAgICAgLy8gQnV0IHRvIGJlIHJlYWxseSBlcXVpdmFsZW50LCB3ZSBzaG91bGQgdXNlIFwiUG9pbnQuZXF1YWxzXCIgaGVyZS5cclxuICAgICAgICAgICAgaWYgKHAgPT09IGVxICYmIG9wID09PSBlcCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKGVxID09PSB0Y3guZWRnZV9ldmVudC5jb25zdHJhaW5lZF9lZGdlLnEgJiYgZXAgPT09IHRjeC5lZGdlX2V2ZW50LmNvbnN0cmFpbmVkX2VkZ2UucCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHQubWFya0NvbnN0cmFpbmVkRWRnZUJ5UG9pbnRzKGVwLCBlcSk7XHJcbiAgICAgICAgICAgICAgICAgICAgb3QubWFya0NvbnN0cmFpbmVkRWRnZUJ5UG9pbnRzKGVwLCBlcSk7XHJcbiAgICAgICAgICAgICAgICAgICAgU3dlZXAubGVnYWxpemUodGN4LCB0KTtcclxuICAgICAgICAgICAgICAgICAgICBTd2VlcC5sZWdhbGl6ZSh0Y3gsIG90KTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gWFhYOiBJIHRoaW5rIG9uZSBvZiB0aGUgdHJpYW5nbGVzIHNob3VsZCBiZSBsZWdhbGl6ZWQgaGVyZT9cclxuICAgICAgICAgICAgICAgICAgICAvKiBqc2hpbnQgbm9lbXB0eTpmYWxzZSAqL1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdmFyIG8gPSBvcmllbnQyZChlcSwgb3AsIGVwKTtcclxuICAgICAgICAgICAgICAgIHQgPSBTd2VlcC5uZXh0RmxpcFRyaWFuZ2xlKHRjeCwgbywgdCwgb3QsIHAsIG9wKTtcclxuICAgICAgICAgICAgICAgIFN3ZWVwLmZsaXBFZGdlRXZlbnQodGN4LCBlcCwgZXEsIHQsIHApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdmFyIG5ld1AgPSBTd2VlcC5uZXh0RmxpcFBvaW50KGVwLCBlcSwgb3QsIG9wKTtcclxuICAgICAgICAgICAgU3dlZXAuZmxpcFNjYW5FZGdlRXZlbnQodGN4LCBlcCwgZXEsIHQsIG90LCBuZXdQKTtcclxuICAgICAgICAgICAgU3dlZXAuZWRnZUV2ZW50QnlQb2ludHModGN4LCBlcCwgZXEsIHQsIHApO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgU3dlZXAubmV4dEZsaXBUcmlhbmdsZSA9IGZ1bmN0aW9uKHRjeCwgbywgdCwgb3QsIHAsIG9wKSB7XHJcbiAgICAgICAgdmFyIGVkZ2VfaW5kZXg7XHJcbiAgICAgICAgaWYgKG8gPT09IE9yaWVudGF0aW9uLkNDVykge1xyXG4gICAgICAgICAgICAvLyBvdCBpcyBub3QgY3Jvc3NpbmcgZWRnZSBhZnRlciBmbGlwXHJcbiAgICAgICAgICAgIGVkZ2VfaW5kZXggPSBvdC5lZGdlSW5kZXgocCwgb3ApO1xyXG4gICAgICAgICAgICBvdC5kZWxhdW5heV9lZGdlW2VkZ2VfaW5kZXhdID0gdHJ1ZTtcclxuICAgICAgICAgICAgU3dlZXAubGVnYWxpemUodGN4LCBvdCk7XHJcbiAgICAgICAgICAgIG90LmNsZWFyRGVsdW5heUVkZ2VzKCk7XHJcbiAgICAgICAgICAgIHJldHVybiB0O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gdCBpcyBub3QgY3Jvc3NpbmcgZWRnZSBhZnRlciBmbGlwXHJcbiAgICAgICAgZWRnZV9pbmRleCA9IHQuZWRnZUluZGV4KHAsIG9wKTtcclxuXHJcbiAgICAgICAgdC5kZWxhdW5heV9lZGdlW2VkZ2VfaW5kZXhdID0gdHJ1ZTtcclxuICAgICAgICBTd2VlcC5sZWdhbGl6ZSh0Y3gsIHQpO1xyXG4gICAgICAgIHQuY2xlYXJEZWx1bmF5RWRnZXMoKTtcclxuICAgICAgICByZXR1cm4gb3Q7XHJcbiAgICB9O1xyXG5cclxuICAgIFN3ZWVwLm5leHRGbGlwUG9pbnQgPSBmdW5jdGlvbihlcCwgZXEsIG90LCBvcCkge1xyXG4gICAgICAgIHZhciBvMmQgPSBvcmllbnQyZChlcSwgb3AsIGVwKTtcclxuICAgICAgICBpZiAobzJkID09PSBPcmllbnRhdGlvbi5DVykge1xyXG4gICAgICAgICAgICAvLyBSaWdodFxyXG4gICAgICAgICAgICByZXR1cm4gb3QucG9pbnRDQ1cob3ApO1xyXG4gICAgICAgIH0gZWxzZSBpZiAobzJkID09PSBPcmllbnRhdGlvbi5DQ1cpIHtcclxuICAgICAgICAgICAgLy8gTGVmdFxyXG4gICAgICAgICAgICByZXR1cm4gb3QucG9pbnRDVyhvcCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IFBvaW50RXJyb3IoXCJwb2x5MnRyaSBbVW5zdXBwb3J0ZWRdIG5leHRGbGlwUG9pbnQ6IG9wcG9zaW5nIHBvaW50IG9uIGNvbnN0cmFpbmVkIGVkZ2UhXCIsIFtlcSwgb3AsIGVwXSk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBTd2VlcC5mbGlwU2NhbkVkZ2VFdmVudCA9IGZ1bmN0aW9uKHRjeCwgZXAsIGVxLCBmbGlwX3RyaWFuZ2xlLCB0LCBwKSB7XHJcbiAgICAgICAgdmFyIG90ID0gdC5uZWlnaGJvckFjcm9zcyhwKTtcclxuICAgICAgICBpZiAoIW90KSB7XHJcbiAgICAgICAgICAgIC8vIElmIHdlIHdhbnQgdG8gaW50ZWdyYXRlIHRoZSBmaWxsRWRnZUV2ZW50IGRvIGl0IGhlcmVcclxuICAgICAgICAgICAgLy8gV2l0aCBjdXJyZW50IGltcGxlbWVudGF0aW9uIHdlIHNob3VsZCBuZXZlciBnZXQgaGVyZVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3BvbHkydHJpIFtCVUc6RklYTUVdIEZMSVAgZmFpbGVkIGR1ZSB0byBtaXNzaW5nIHRyaWFuZ2xlJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhciBvcCA9IG90Lm9wcG9zaXRlUG9pbnQodCwgcCk7XHJcblxyXG4gICAgICAgIGlmIChpblNjYW5BcmVhKGVxLCBmbGlwX3RyaWFuZ2xlLnBvaW50Q0NXKGVxKSwgZmxpcF90cmlhbmdsZS5wb2ludENXKGVxKSwgb3ApKSB7XHJcbiAgICAgICAgICAgIC8vIGZsaXAgd2l0aCBuZXcgZWRnZSBvcC5lcVxyXG4gICAgICAgICAgICBTd2VlcC5mbGlwRWRnZUV2ZW50KHRjeCwgZXEsIG9wLCBvdCwgb3ApO1xyXG4gICAgICAgICAgICAvLyBUT0RPOiBBY3R1YWxseSBJIGp1c3QgZmlndXJlZCBvdXQgdGhhdCBpdCBzaG91bGQgYmUgcG9zc2libGUgdG9cclxuICAgICAgICAgICAgLy8gICAgICAgaW1wcm92ZSB0aGlzIGJ5IGdldHRpbmcgdGhlIG5leHQgb3QgYW5kIG9wIGJlZm9yZSB0aGUgdGhlIGFib3ZlXHJcbiAgICAgICAgICAgIC8vICAgICAgIGZsaXAgYW5kIGNvbnRpbnVlIHRoZSBmbGlwU2NhbkVkZ2VFdmVudCBoZXJlXHJcbiAgICAgICAgICAgIC8vIHNldCBuZXcgb3QgYW5kIG9wIGhlcmUgYW5kIGxvb3AgYmFjayB0byBpblNjYW5BcmVhIHRlc3RcclxuICAgICAgICAgICAgLy8gYWxzbyBuZWVkIHRvIHNldCBhIG5ldyBmbGlwX3RyaWFuZ2xlIGZpcnN0XHJcbiAgICAgICAgICAgIC8vIFR1cm5zIG91dCBhdCBmaXJzdCBnbGFuY2UgdGhhdCB0aGlzIGlzIHNvbWV3aGF0IGNvbXBsaWNhdGVkXHJcbiAgICAgICAgICAgIC8vIHNvIGl0IHdpbGwgaGF2ZSB0byB3YWl0LlxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHZhciBuZXdQID0gU3dlZXAubmV4dEZsaXBQb2ludChlcCwgZXEsIG90LCBvcCk7XHJcbiAgICAgICAgICAgIFN3ZWVwLmZsaXBTY2FuRWRnZUV2ZW50KHRjeCwgZXAsIGVxLCBmbGlwX3RyaWFuZ2xlLCBvdCwgbmV3UCk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLUV4cG9ydHMgKHB1YmxpYyBBUEkpXHJcblxyXG4gICAgcG9seTJ0cmkuUG9pbnRFcnJvciAgICAgPSBQb2ludEVycm9yO1xyXG4gICAgcG9seTJ0cmkuUG9pbnQgICAgICAgICAgPSBQb2ludDtcclxuICAgIHBvbHkydHJpLlRyaWFuZ2xlICAgICAgID0gVHJpYW5nbGU7XHJcbiAgICBwb2x5MnRyaS5Td2VlcENvbnRleHQgICA9IFN3ZWVwQ29udGV4dDtcclxuXHJcbiAgICAvLyBCYWNrd2FyZCBjb21wYXRpYmlsaXR5XHJcbiAgICBwb2x5MnRyaS50cmlhbmd1bGF0ZSAgICA9IFN3ZWVwLnRyaWFuZ3VsYXRlO1xyXG4gICAgcG9seTJ0cmkuc3dlZXAgPSB7VHJpYW5ndWxhdGU6IFN3ZWVwLnRyaWFuZ3VsYXRlfTtcclxuXHJcbn0odGhpcykpOyIsIlwidXNlIHN0cmljdFwiXHJcblxyXG52YXIgcG9seTJ0cmkgPSByZXF1aXJlKCcuL3BvbHkydHJpLmpzJyk7XHJcbnZhciBTd2VlcENvbnRleHQgPSBwb2x5MnRyaS5Td2VlcENvbnRleHQ7XHJcbnZhciB2Ym9NZXNoID0gcmVxdWlyZSgnLi92Ym9NZXNoLmpzJyk7XHJcbnZhciBnbE1hdHJpeCA9IHJlcXVpcmUoJy4uL2pzL2dsLW1hdHJpeC1taW4uanMnKTtcclxudmFyIHZlYzIgPSBnbE1hdHJpeC52ZWMyO1xyXG5cclxudmFyIG51bVZib3MgPSBbXTtcclxuXHJcbmZ1bmN0aW9uIGluaXQoZ2wpIHtcclxuICB2Ym9NZXNoLnNldEdMKGdsKTtcclxuICBmb3IodmFyIGk9MDtpPDEwOysraSkge1xyXG4gICAgbnVtVmJvc1tpXSA9IHZib01lc2guY3JlYXRlKCk7XHJcbiAgICBsb2FkVGV4dChcImdlb21ldHJ5L1wiK2krXCIudHh0XCIsbnVtVmJvc1tpXSk7XHJcbiAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBsb2FkVGV4dChmaWxlbmFtZSwgdmJvKSB7XHJcbiAgdmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xyXG4gIHhoci5vcGVuKFwiR0VUXCIsZmlsZW5hbWUpO1xyXG4gIHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBcclxuICBmdW5jdGlvbigpIHtcclxuICAgIGlmKHhoci5yZWFkeVN0YXRlID09IDQgJiYgeGhyLnN0YXR1cyA9PSAyMDApIHtcclxuICAgICAgdmFyIG91dGxpbmUgPSBKU09OLnBhcnNlKHhoci5yZXNwb25zZVRleHQpO1xyXG4gICAgICBtYWtlVGV4dFZibyh2Ym8sb3V0bGluZSk7XHJcbiAgICB9XHJcbiAgfVxyXG4gIHhoci5zZW5kKCk7XHJcbn1cclxuXHJcbnZhciBtYWtlVGV4dFZibyA9IGZ1bmN0aW9uKHZibyxvdXRsaW5lKSB7XHJcbiAgdmJvTWVzaC5jbGVhcih2Ym8pO1xyXG4gIHZhciBtaW4gPSB2ZWMyLmNyZWF0ZSgpO1xyXG4gIHZhciBtYXggPSB2ZWMyLmNyZWF0ZSgpO1xyXG4gIHZlYzIuY29weShtaW4sb3V0bGluZVswXSk7XHJcbiAgdmVjMi5jb3B5KG1heCxvdXRsaW5lWzBdKTtcclxuICBmb3IodmFyIGk9MTtpPG91dGxpbmUubGVuZ3RoLTE7KytpKSB7XHJcbiAgICB2YXIgcHQgPSBvdXRsaW5lW2ldO1xyXG4gICAgbWluID0gdmVjMi5taW4obWluLG1pbixwdCk7XHJcbiAgICBtYXggPSB2ZWMyLm1heChtYXgsbWF4LHB0KTtcclxuICB9XHJcbiAgLy9hZGQgYm91bmRpbmcgYm94XHJcbiAgdmJvTWVzaC5hZGRWZXJ0ZXgodmJvLFswLDAsMF0pO1xyXG4gIHZib01lc2guYWRkVmVydGV4KHZibyxbMCwxLDBdKTtcclxuICB2Ym9NZXNoLmFkZFZlcnRleCh2Ym8sWzEsMSwwXSk7XHJcbiAgdmJvTWVzaC5hZGRWZXJ0ZXgodmJvLFsxLDAsMF0pO1xyXG5cclxuICB2YXIgc2NhbGluZyA9IDAuOS8obWF4WzFdLW1pblsxXSk7XHJcbiAgdmFyIHRyaVB0cyA9IFtdO1xyXG4gIHZhciB0cmlQdHMyID0gW107XHJcbiAgZm9yKHZhciBpPTA7aTxvdXRsaW5lLmxlbmd0aC0xOysraSkge1xyXG4gICAgdmFyIHB0ID0gb3V0bGluZVtpXTtcclxuICAgIHZlYzIuc3ViKHB0LHB0LG1pbik7XHJcbiAgICB2ZWMyLnNjYWxlKHB0LHB0LHNjYWxpbmcpO1xyXG4gICAgcHRbMV0gKz0gLjA1O1xyXG4gICAgcHRbMF0gKz0gLjE7XHJcbiAgICBwdFsyXSA9IDA7XHJcbiAgICB0cmlQdHMucHVzaCh7eDpwdFswXSx5OnB0WzFdLGluZGV4OmkrNH0pO1xyXG4gICAgdHJpUHRzMi5wdXNoKHt4OnB0WzBdLHk6cHRbMV0saW5kZXg6aSs0fSk7XHJcbiAgICB2Ym9NZXNoLmFkZFZlcnRleCh2Ym8scHQpO1xyXG4gICAgcHRbMl0gPSAxLjA7XHJcbiAgICB2Ym9NZXNoLmFkZFZlcnRleCh2Ym8scHQpO1xyXG4gIH1cclxuICB2YXIgdHJpYW5ndWxhdGlvbiA9IG5ldyBTd2VlcENvbnRleHQodHJpUHRzKTtcclxuICB0cmlhbmd1bGF0aW9uLnRyaWFuZ3VsYXRlKCk7XHJcbiAgdmFyIHRyaWFuZ2xlcyA9IHRyaWFuZ3VsYXRpb24uZ2V0VHJpYW5nbGVzKCk7XHJcbiAgXHJcbiAgXHJcbiAgdHJpUHRzMi5yZXZlcnNlKCk7XHJcbiAgZm9yKHZhciBpPTA7aTx0cmlQdHMyLmxlbmd0aDsrK2kpIHtcclxuICAgIHRyaVB0czJbaV0uX3AydF9lZGdlX2xpc3QgPSBudWxsO1xyXG4gIH1cclxuICB2YXIgdHJpYW5ndWxhdGlvbjIgPSBuZXcgU3dlZXBDb250ZXh0KFt7eDowLHk6MCxpbmRleDowfSx7eDowLHk6MSxpbmRleDoxfSx7eDoxLHk6MSxpbmRleDoyfSx7eDoxLHk6MCxpbmRleDozfV0pO1xyXG4gIHRyaWFuZ3VsYXRpb24yLmFkZEhvbGUodHJpUHRzMik7XHJcbiAgdHJpYW5ndWxhdGlvbjIudHJpYW5ndWxhdGUoKTtcclxuICB2YXIgdHJpYW5nbGVzMiA9IHRyaWFuZ3VsYXRpb24yLmdldFRyaWFuZ2xlcygpO1xyXG4gIFxyXG4gIC8vd2FsbHNcclxuICBmb3IodmFyIGk9MDtpPG91dGxpbmUubGVuZ3RoLTE7KytpKSB7XHJcbiAgICB2YXIgaU5leHQgPSAoaSsxKSUob3V0bGluZS5sZW5ndGgtMSk7XHJcbiAgICB2Ym9NZXNoLmFkZFRyaWFuZ2xlKHZibyxpKjIrNCxpKjIrMSs0LGlOZXh0KjIrMSs0KTtcclxuICAgIHZib01lc2guYWRkVHJpYW5nbGUodmJvLGkqMis0LGlOZXh0KjIrMSs0LGlOZXh0KjIrNCk7XHJcbiAgfVxyXG4gIFxyXG4gIC8vdG9wXHJcbiAgZm9yKHZhciBpPTA7aTx0cmlhbmdsZXMubGVuZ3RoOysraSkge1xyXG4gICAgdmFyIHRyaSA9IHRyaWFuZ2xlc1tpXTtcclxuICAgIHZib01lc2guYWRkVHJpYW5nbGUodmJvLGdldEluZGV4KHRyaS5wb2ludHNfWzBdLmluZGV4KSsxLGdldEluZGV4KHRyaS5wb2ludHNfWzFdLmluZGV4KSsxLGdldEluZGV4KHRyaS5wb2ludHNfWzJdLmluZGV4KSsxKTtcclxuICB9XHJcbiAgLy9ib3R0b21cclxuICBmb3IodmFyIGk9MDtpPHRyaWFuZ2xlczIubGVuZ3RoOysraSkge1xyXG4gICAgdmFyIHRyaSA9IHRyaWFuZ2xlczJbaV07XHJcbiAgICB2Ym9NZXNoLmFkZFRyaWFuZ2xlKHZibyxnZXRJbmRleCh0cmkucG9pbnRzX1swXS5pbmRleCksZ2V0SW5kZXgodHJpLnBvaW50c19bMV0uaW5kZXgpLGdldEluZGV4KHRyaS5wb2ludHNfWzJdLmluZGV4KSk7XHJcbiAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRJbmRleChpKSB7XHJcbiAgaWYoaSA8IDQpIHJldHVybiBpO1xyXG4gIHJldHVybiAoaS00KSoyKzQ7XHJcbn1cclxuXHJcbmV4cG9ydHMuaW5pdCA9IGluaXQ7XHJcbmV4cG9ydHMubnVtVmJvcyA9IG51bVZib3M7IiwidmFyIGdsTWF0cml4ID0gcmVxdWlyZSgnLi4vanMvZ2wtbWF0cml4LW1pbi5qcycpO1xyXG52YXIgdmVjMyA9IGdsTWF0cml4LnZlYzM7XHJcblxyXG5cclxuKGZ1bmN0aW9uKF9nbG9iYWwpIHsgXHJcbiAgXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4gIHZhciBzaGltID0ge307XHJcbiAgaWYgKHR5cGVvZihleHBvcnRzKSA9PT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgIGlmKHR5cGVvZiBkZWZpbmUgPT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PSAnb2JqZWN0JyAmJiBkZWZpbmUuYW1kKSB7XHJcbiAgICAgIHNoaW0uZXhwb3J0cyA9IHt9O1xyXG4gICAgICBkZWZpbmUoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcmV0dXJuIHNoaW0uZXhwb3J0cztcclxuICAgICAgfSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAvL3RoaXMgdGhpbmcgbGl2ZXMgaW4gYSBicm93c2VyLCBkZWZpbmUgaXRzIG5hbWVzcGFjZXMgaW4gZ2xvYmFsXHJcbiAgICAgIHNoaW0uZXhwb3J0cyA9IHR5cGVvZih3aW5kb3cpICE9PSAndW5kZWZpbmVkJyA/IHdpbmRvdyA6IF9nbG9iYWw7XHJcbiAgICB9XHJcbiAgfVxyXG4gIGVsc2Uge1xyXG4gICAgLy90aGlzIHRoaW5nIGxpdmVzIGluIGNvbW1vbmpzLCBkZWZpbmUgaXRzIG5hbWVzcGFjZXMgaW4gZXhwb3J0c1xyXG4gICAgc2hpbS5leHBvcnRzID0gZXhwb3J0cztcclxuICB9XHJcbiAgKGZ1bmN0aW9uKGV4cG9ydHMpIHtcclxuICBcclxudmFyIGdsO1xyXG52YXIgdmJvTWVzaCA9IGV4cG9ydHM7XHJcblxyXG52Ym9NZXNoLnNldEdMID0gZnVuY3Rpb24oX2dsKSB7XHJcbiAgZ2wgPSBfZ2w7XHJcbn1cclxuXHJcbnZib01lc2guY3JlYXRlID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgdmJvID0ge307XHJcbiAgICB2Ym8udmVydGV4RGF0YSA9IG5ldyBGbG9hdDMyQXJyYXkoMyoxMDApO1xyXG4gICAgdmJvLm51bVZlcnRpY2VzID0gMDtcclxuICAgIHZiby5pbmRleERhdGEgPSBuZXcgVWludDE2QXJyYXkoMyoxMDApO1xyXG4gICAgdmJvLm51bUluZGljZXMgPSAwO1xyXG4gICAgdmJvLnZlcnRleEJ1ZmZlciA9IGdsLmNyZWF0ZUJ1ZmZlcigpO1xyXG4gICAgdmJvLmluZGV4QnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKCk7XHJcbiAgICB2Ym8ubnVtTm9ybWFscyA9IDA7XHJcbiAgICB2Ym8ubm9ybWFsc0VuYWJsZWQgPSBmYWxzZTtcclxuICAgIHZiby5ub3JtYWxEYXRhID0gbnVsbDtcclxuICAgIHZiby5jb2xvckVuYWJsZWQgPSBmYWxzZTtcclxuICAgIHZiby5jb2xvckRhdGE9IG51bGw7XHJcbiAgICB2Ym8ubm9ybWFsQnVmZmVyID0gbnVsbDtcclxuICAgIHZiby5jb2xvckJ1ZmZlciA9IG51bGw7XHJcbiAgICByZXR1cm4gdmJvO1xyXG59O1xyXG5cclxudmJvTWVzaC5jcmVhdGUzMiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHZibyA9IHt9O1xyXG4gICAgdmJvLnZlcnRleERhdGEgPSBuZXcgRmxvYXQzMkFycmF5KDMqMTAwMCk7XHJcbiAgICB2Ym8ubnVtVmVydGljZXMgPSAwO1xyXG4gICAgdmJvLmluZGV4RGF0YSA9IG5ldyBVaW50MzJBcnJheSgzKjEwMDApO1xyXG4gICAgdmJvLm51bUluZGljZXMgPSAwO1xyXG4gICAgdmJvLnZlcnRleEJ1ZmZlciA9IGdsLmNyZWF0ZUJ1ZmZlcigpO1xyXG4gICAgdmJvLmluZGV4QnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKCk7XHJcbiAgICB2Ym8ubm9ybWFsc0VuYWJsZWQgPSBmYWxzZTtcclxuICAgIHZiby5udW1Ob3JtYWxzID0gMDtcclxuICAgIHZiby5ub3JtYWxEYXRhID0gbnVsbDtcclxuICAgIHZiby5jb2xvckRhdGE9IG51bGw7XHJcbiAgICB2Ym8ubm9ybWFsQnVmZmVyID0gbnVsbDtcclxuICAgIHZiby5jb2xvckJ1ZmZlciA9IG51bGw7XHJcbiAgICByZXR1cm4gdmJvO1xyXG59O1xyXG5cclxudmJvTWVzaC5jbGVhciA9IGZ1bmN0aW9uKHZibykge1xyXG4gICAgdmJvLm51bVZlcnRpY2VzID0gMDtcclxuICAgIHZiby5udW1JbmRpY2VzID0gMDtcclxuICAgIHZiby5udW1Ob3JtYWxzID0gMDtcclxufVxyXG5cclxudmJvTWVzaC5lbmFibGVOb3JtYWxzID0gZnVuY3Rpb24odmJvKSB7XHJcbiAgICBpZighdmJvLm5vcm1hbHNFbmFibGVkKSB7XHJcbiAgICAgICAgdmJvLm5vcm1hbERhdGEgPSBuZXcgRmxvYXQzMkFycmF5KHZiby52ZXJ0ZXhEYXRhLmxlbmd0aCk7XHJcbiAgICAgICAgaWYodmJvLm5vcm1hbEJ1ZmZlciA9PT0gbnVsbCkgdmJvLm5vcm1hbEJ1ZmZlciA9IGdsLmNyZWF0ZUJ1ZmZlcigpO1xyXG4gICAgICAgIHZiby5ub3JtYWxzRW5hYmxlZCA9IHRydWU7XHJcbiAgICB9XHJcbn1cclxuXHJcbnZib01lc2guZGlzYWJsZU5vcm1hbHMgPSBmdW5jdGlvbih2Ym8pIHtcclxuICAgIHZiby5ub3JtYWxEYXRhID0gbnVsbDtcclxuICAgIGlmKHZiby5ub3JtYWxCdWZmZXIgIT09IG51bGwpIGdsLmRlbGV0ZUJ1ZmZlcih2Ym8ubm9ybWFsQnVmZmVyKTtcclxuICAgIHZiby5ub3JtYWxzRW5hYmxlZCA9IGZhbHNlO1xyXG59XHJcblxyXG52Ym9NZXNoLmVuYWJsZUNvbG9yID0gZnVuY3Rpb24odmJvKSB7XHJcbiAgaWYoIXZiby5jb2xvckVuYWJsZWQpIHtcclxuICAgIHZiby5jb2xvckRhdGEgPSBuZXcgVWludDhBcnJheSh2Ym8udmVydGV4RGF0YS5sZW5ndGgvMyo0KTtcclxuICAgIGlmKHZiby5jb2xvckJ1ZmZlciA9PT0gbnVsbCkgdmJvLmNvbG9yQnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKCk7XHJcbiAgICB2Ym8uY29sb3JFbmFibGVkID0gdHJ1ZTtcclxuICB9XHJcbn1cclxuXHJcbnZib01lc2guZGlzYWJsZUNvbG9yID0gZnVuY3Rpb24odmJvKSB7XHJcbiAgICB2Ym8uY29sb3JEYXRhID0gbnVsbDtcclxuICAgIGlmKHZiby5jb2xvckJ1ZmZlciAhPT0gbnVsbCkgZ2wuZGVsZXRlQnVmZmVyKHZiby5jb2xvckJ1ZmZlcik7XHJcbiAgICB2Ym8uY29sb3JFbmFibGVkID0gZmFsc2U7XHJcbn1cclxuXHJcbnZib01lc2guYWRkVmVydGV4ID0gZnVuY3Rpb24odmJvLCB2LG4pIHtcclxuICAgIHZhciBpbmRleCA9IHZiby5udW1WZXJ0aWNlcyozO1xyXG5cdGlmKGluZGV4ID49IHZiby52ZXJ0ZXhEYXRhLmxlbmd0aCkge1xyXG5cdFx0dmFyIG5ld0RhdGEgPSBuZXcgRmxvYXQzMkFycmF5KHZiby52ZXJ0ZXhEYXRhLmxlbmd0aCoyKTtcclxuXHRcdG5ld0RhdGEuc2V0KHZiby52ZXJ0ZXhEYXRhKTtcclxuXHRcdC8vZG8gaSBuZWVkIHRvIGV4cGxpY2l0bHkga2lsbCB0aGUgb2xkIHZlcnRleERhdGE/XHJcblx0XHR2Ym8udmVydGV4RGF0YSA9IG5ld0RhdGE7XHJcbiAgICBpZih2Ym8ubm9ybWFsc0VuYWJsZWQpIHtcclxuICAgICAgICB2YXIgbmV3RGF0YSA9IG5ldyBGbG9hdDMyQXJyYXkodmJvLnZlcnRleERhdGEubGVuZ3RoKTtcclxuICAgICAgICBuZXdEYXRhLnNldCh2Ym8ubm9ybWFsRGF0YSk7XHJcbiAgICAgICAgLy9kbyBpIG5lZWQgdG8gZXhwbGljaXRseSBraWxsIHRoZSBvbGQgdmVydGV4RGF0YT9cclxuICAgICAgICB2Ym8ubm9ybWFsRGF0YSA9IG5ld0RhdGE7XHJcbiAgICB9XHJcbiAgICBpZih2Ym8uY29sb3JFbmFibGVkKSB7XHJcbiAgICAgIHZhciBuZXdEYXRhID0gbmV3IFVpbnQ4QXJyYXkodmJvLnZlcnRleERhdGEubGVuZ3RoLzMqNCk7XHJcbiAgICAgIG5ld0RhdGEuc2V0KHZiby5jb2xvckRhdGEpO1xyXG4gICAgICAvL2RvIGkgbmVlZCB0byBleHBsaWNpdGx5IGtpbGwgdGhlIG9sZCB2ZXJ0ZXhEYXRhP1xyXG4gICAgICB2Ym8uY29sb3JEYXRhID0gbmV3RGF0YTtcclxuICAgIH1cclxuXHR9XHJcbiAgICB2Ym8udmVydGV4RGF0YVtpbmRleF0gPSB2WzBdO1xyXG4gICAgdmJvLnZlcnRleERhdGFbaW5kZXgrMV0gPSB2WzFdO1xyXG4gICAgdmJvLnZlcnRleERhdGFbaW5kZXgrMl0gPSB2WzJdO1xyXG4gICAgaWYobiAmJiB2Ym8ubm9ybWFsc0VuYWJsZWQpIHtcclxuICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpbmRleF0gPSBuWzBdO1xyXG4gICAgICAgIHZiby5ub3JtYWxEYXRhW2luZGV4KzFdID0gblsxXTtcclxuICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpbmRleCsyXSA9IG5bMl07XHJcbiAgICB9XHJcbiAgICB2Ym8ubnVtVmVydGljZXMrKztcclxufVxyXG5cclxudmJvTWVzaC5nZXRWZXJ0ZXggPSBmdW5jdGlvbihvdXQsIHZibywgaSkge1xyXG4gIHZhciBpMyA9IGkqMztcclxuICBvdXRbMF0gPSB2Ym8udmVydGV4RGF0YVtpM107XHJcbiAgb3V0WzFdID0gdmJvLnZlcnRleERhdGFbaTMrMV07XHJcbiAgb3V0WzJdID0gdmJvLnZlcnRleERhdGFbaTMrMl07XHJcbn1cclxuXHJcbnZib01lc2guc2V0VmVydGV4ID0gZnVuY3Rpb24odmJvLCBpLCBwdCkge1xyXG4gIHZhciBpMyA9IGkqMztcclxuICB2Ym8udmVydGV4RGF0YVtpM10gPSBwdFswXTtcclxuICB2Ym8udmVydGV4RGF0YVtpMysxXSA9IHB0WzFdO1xyXG4gIHZiby52ZXJ0ZXhEYXRhW2kzKzJdID0gcHRbMl07XHJcbn1cclxuXHJcbnZib01lc2guc2V0Tm9ybWFsID0gZnVuY3Rpb24odmJvLCBpLCBwdCkge1xyXG4gIHZhciBpMyA9IGkqMztcclxuICB2Ym8ubm9ybWFsRGF0YVtpM10gPSBwdFswXTtcclxuICB2Ym8ubm9ybWFsRGF0YVtpMysxXSA9IHB0WzFdO1xyXG4gIHZiby5ub3JtYWxEYXRhW2kzKzJdID0gcHRbMl07XHJcbn1cclxuXHJcbnZib01lc2guZ2V0Tm9ybWFsID0gZnVuY3Rpb24obiwgdmJvLCBpKSB7XHJcbiAgdmFyIGkzID0gaSozO1xyXG4gIG5bMF0gPSB2Ym8ubm9ybWFsRGF0YVtpM107XHJcbiAgblsxXSA9IHZiby5ub3JtYWxEYXRhW2kzKzFdO1xyXG4gIG5bMl0gPSB2Ym8ubm9ybWFsRGF0YVtpMysyXTtcclxufVxyXG52Ym9NZXNoLnNldENvbG9yID0gZnVuY3Rpb24odmJvLCBpLCBjKSB7XHJcbiAgdmFyIGk0ID0gaSo0O1xyXG4gIHZiby5jb2xvckRhdGFbaTRdID0gY1swXTtcclxuICB2Ym8uY29sb3JEYXRhW2k0KzFdID0gY1sxXTtcclxuICB2Ym8uY29sb3JEYXRhW2k0KzJdID0gY1syXTtcclxuICB2Ym8uY29sb3JEYXRhW2k0KzNdID0gY1szXSA9PT0gdW5kZWZpbmVkID8gMjU1IDogY1szXTtcclxufVxyXG5cclxudmJvTWVzaC5hZGRUcmlhbmdsZSA9IGZ1bmN0aW9uKHZibywgaTEsaTIsaTMpIHtcclxuXHRpZih2Ym8ubnVtSW5kaWNlcyA+PSB2Ym8uaW5kZXhEYXRhLmxlbmd0aCkge1xyXG5cdFx0dmFyIG5ld0RhdGEgPSBuZXcgdmJvLmluZGV4RGF0YS5jb25zdHJ1Y3Rvcih2Ym8uaW5kZXhEYXRhLmxlbmd0aCoyKTtcclxuXHRcdG5ld0RhdGEuc2V0KHZiby5pbmRleERhdGEpO1xyXG5cdFx0Ly9kbyBpIG5lZWQgdG8gZXhwbGljaXRseSBraWxsIHRoZSBvbGQgdmVydGV4RGF0YT9cclxuXHRcdHZiby5pbmRleERhdGEgPSBuZXdEYXRhO1xyXG5cdH1cclxuICAgIHZiby5pbmRleERhdGFbdmJvLm51bUluZGljZXMrK10gPSBpMTtcclxuICAgIHZiby5pbmRleERhdGFbdmJvLm51bUluZGljZXMrK10gPSBpMjtcclxuICAgIHZiby5pbmRleERhdGFbdmJvLm51bUluZGljZXMrK10gPSBpMztcclxufVxyXG5cclxudmJvTWVzaC5hZGRJbmRpY2VzID0gZnVuY3Rpb24odmJvLCBpbmRpY2VzLG51bUluZGljZXMpIHtcclxuXHRpZih2Ym8ubnVtSW5kaWNlcytudW1JbmRpY2VzID49IHZiby5pbmRleERhdGEubGVuZ3RoKSB7XHJcblx0XHR2YXIgbmV3RGF0YSA9IG5ldyB2Ym8uaW5kZXhEYXRhLmNvbnN0cnVjdG9yKE1hdGgubWF4KHZiby5pbmRleERhdGEubGVuZ3RoKjIsdmJvLmluZGV4RGF0YS5sZW5ndGgrbnVtSW5kaWNlcykpO1xyXG5cdFx0bmV3RGF0YS5zZXQodmJvLmluZGV4RGF0YSk7XHJcblx0XHQvL2RvIGkgbmVlZCB0byBleHBsaWNpdGx5IGtpbGwgdGhlIG9sZCB2ZXJ0ZXhEYXRhP1xyXG5cdFx0dmJvLmluZGV4RGF0YSA9IG5ld0RhdGE7XHJcblx0fVxyXG4gIGZvcih2YXIgaT0wO2k8bnVtSW5kaWNlczsrK2kpIHtcclxuICAgIHZiby5pbmRleERhdGFbdmJvLm51bUluZGljZXMrK10gPSBpbmRpY2VzW2ldO1xyXG4gIH1cclxufVxyXG5cclxudmJvTWVzaC5hZGRJbmRleCA9IGZ1bmN0aW9uKHZibyxpbmRleCkge1xyXG4gIGlmKHZiby5udW1JbmRpY2VzID49IHZiby5pbmRleERhdGEubGVuZ3RoKSB7XHJcblx0XHR2YXIgbmV3RGF0YSA9IG5ldyB2Ym8uaW5kZXhEYXRhLmNvbnN0cnVjdG9yKHZiby5pbmRleERhdGEubGVuZ3RoKjIpO1xyXG5cdFx0bmV3RGF0YS5zZXQodmJvLmluZGV4RGF0YSk7XHJcblx0XHQvL2RvIGkgbmVlZCB0byBleHBsaWNpdGx5IGtpbGwgdGhlIG9sZCB2ZXJ0ZXhEYXRhP1xyXG5cdFx0dmJvLmluZGV4RGF0YSA9IG5ld0RhdGE7XHJcblx0fVxyXG4gIHZiby5pbmRleERhdGFbdmJvLm51bUluZGljZXMrK10gPSBpbmRleDtcclxufVxyXG5cclxudmJvTWVzaC5hZGRMaW5lID0gZnVuY3Rpb24odmJvLCBpMSxpMikge1xyXG5cdGlmKHZiby5udW1JbmRpY2VzID49IHZiby5pbmRleERhdGEubGVuZ3RoKSB7XHJcblx0XHR2YXIgbmV3RGF0YSA9IG5ldyB2Ym8uaW5kZXhEYXRhLmNvbnN0cnVjdG9yKHZiby5pbmRleERhdGEubGVuZ3RoKjIpO1xyXG5cdFx0bmV3RGF0YS5zZXQodmJvLmluZGV4RGF0YSk7XHJcblx0XHQvL2RvIGkgbmVlZCB0byBleHBsaWNpdGx5IGtpbGwgdGhlIG9sZCB2ZXJ0ZXhEYXRhP1xyXG5cdFx0dmJvLmluZGV4RGF0YSA9IG5ld0RhdGE7XHJcblx0fVxyXG4gIHZiby5pbmRleERhdGFbdmJvLm51bUluZGljZXMrK10gPSBpMTtcclxuICB2Ym8uaW5kZXhEYXRhW3Ziby5udW1JbmRpY2VzKytdID0gaTI7XHJcbn1cclxuXHJcbnZib01lc2guYWRkTWVzaCA9IChmdW5jdGlvbigpIHtcclxuICB2YXIgcHQgPSB2ZWMzLmNyZWF0ZSgpO1xyXG4gIHJldHVybiBmdW5jdGlvbiBhZGRNZXNoKHZibywgdmJvMikge1xyXG4gICAgdmFyIGJhc2VJbmRleCA9IHZiby5udW1WZXJ0aWNlcztcclxuICAgIGZvcih2YXIgaT0wO2k8dmJvMi5udW1WZXJ0aWNlczsrK2kpIHtcclxuICAgICAgdmJvTWVzaC5nZXRWZXJ0ZXgocHQsdmJvMixpKTtcclxuICAgICAgdmJvTWVzaC5hZGRWZXJ0ZXgodmJvLHB0KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZm9yKHZhciBpPTA7aTx2Ym8yLm51bUluZGljZXM7KytpKSB7XHJcbiAgICAgIHZib01lc2guYWRkSW5kZXgodmJvLHZibzIuaW5kZXhEYXRhW2ldK2Jhc2VJbmRleCk7XHJcbiAgICB9XHJcbiAgfVxyXG59KSgpO1xyXG5cclxudmJvTWVzaC5hZGRNZXNoVHJhbnNmb3JtID0gKGZ1bmN0aW9uKCkge1xyXG4gIHZhciBwdCA9IHZlYzMuY3JlYXRlKCk7XHJcbiAgcmV0dXJuIGZ1bmN0aW9uIGFkZE1lc2godmJvLCB2Ym8yLCB0cmFucykge1xyXG4gICAgdmFyIGJhc2VJbmRleCA9IHZiby5udW1WZXJ0aWNlcztcclxuICAgIGZvcih2YXIgaT0wO2k8dmJvMi5udW1WZXJ0aWNlczsrK2kpIHtcclxuICAgICAgdmJvTWVzaC5nZXRWZXJ0ZXgocHQsdmJvMixpKTtcclxuICAgICAgdmVjMy50cmFuc2Zvcm1NYXQ0KHB0LHB0LHRyYW5zKTtcclxuICAgICAgdmJvTWVzaC5hZGRWZXJ0ZXgodmJvLHB0KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZm9yKHZhciBpPTA7aTx2Ym8yLm51bUluZGljZXM7KytpKSB7XHJcbiAgICAgIHZib01lc2guYWRkSW5kZXgodmJvLHZibzIuaW5kZXhEYXRhW2ldK2Jhc2VJbmRleCk7XHJcbiAgICB9XHJcbiAgfVxyXG59KSgpO1xyXG5cclxudmJvTWVzaC5idWZmZXIgPSBmdW5jdGlvbih2Ym8pIHtcclxuICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCB2Ym8udmVydGV4QnVmZmVyKTtcclxuICAgIGdsLmJ1ZmZlckRhdGEoZ2wuQVJSQVlfQlVGRkVSLHZiby52ZXJ0ZXhEYXRhLGdsLlNUUkVBTV9EUkFXKTtcclxuICAgIGdsLmJpbmRCdWZmZXIoZ2wuRUxFTUVOVF9BUlJBWV9CVUZGRVIsIHZiby5pbmRleEJ1ZmZlcik7XHJcbiAgICBnbC5idWZmZXJEYXRhKGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLHZiby5pbmRleERhdGEsZ2wuU1RSRUFNX0RSQVcpO1xyXG4gICAgaWYodmJvLm5vcm1hbHNFbmFibGVkKSB7XHJcbiAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHZiby5ub3JtYWxCdWZmZXIpO1xyXG4gICAgICAgIGdsLmJ1ZmZlckRhdGEoZ2wuQVJSQVlfQlVGRkVSLCB2Ym8ubm9ybWFsRGF0YSxnbC5TVFJFQU1fRFJBVyk7XHJcbiAgICB9XHJcbn1cclxuXHJcbnZib01lc2guY29tcHV0ZVNtb290aE5vcm1hbHMgPSAoZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgbm9ybSA9IHZlYzMuY3JlYXRlKCk7XHJcbiAgICB2YXIgcDEgPSB2ZWMzLmNyZWF0ZSgpLFxyXG4gICAgICAgIHAyID0gdmVjMy5jcmVhdGUoKSxcclxuICAgICAgICBwMyA9IHZlYzMuY3JlYXRlKCk7XHJcbiAgICB2YXIgeD0wLjAseT0wLjAsej0wLjA7XHJcbiAgICB2YXIgaW52TGVuID0gMC4wO1xyXG4gICAgdmFyIGRpcjEgPSB2ZWMzLmNyZWF0ZSgpLFxyXG4gICAgICAgIGRpcjIgPSB2ZWMzLmNyZWF0ZSgpO1xyXG4gICAgZnVuY3Rpb24gcGxhbmVOb3JtYWwob3V0LHYxLHYyLHYzKSB7XHJcbiAgICAgIHZlYzMuc3ViKGRpcjEsIHYxLHYyKTtcclxuICAgICAgdmVjMy5zdWIoZGlyMiwgdjMsdjIpO1xyXG4gICAgICB2ZWMzLmNyb3NzKG91dCxkaXIyLGRpcjEpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBmdW5jdGlvbiBjb21wdXRlU21vb3RoTm9ybWFscyh2Ym8pIHtcclxuICAgICAgICB2Ym9NZXNoLmVuYWJsZU5vcm1hbHModmJvKTtcclxuICAgICAgICBmb3IodmFyIGk9MDtpPHZiby5udW1WZXJ0aWNlczsrK2kpIHtcclxuICAgICAgICAgICAgdmFyIGkzID0gaSozO1xyXG4gICAgICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpM10gPSAwO1xyXG4gICAgICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpMysxXSA9IDA7XHJcbiAgICAgICAgICAgIHZiby5ub3JtYWxEYXRhW2kzKzJdID0gMDtcclxuICAgICAgICB9XHJcbiAgICAgICAgZm9yKHZhciBpPTA7aTx2Ym8ubnVtSW5kaWNlczspIHtcclxuICAgICAgICAgICAgdmFyIGkxID0gdmJvLmluZGV4RGF0YVtpKytdKjM7XHJcbiAgICAgICAgICAgIHZhciBpMiA9IHZiby5pbmRleERhdGFbaSsrXSozO1xyXG4gICAgICAgICAgICB2YXIgaTMgPSB2Ym8uaW5kZXhEYXRhW2krK10qMztcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZlYzMuc2V0KHAxLHZiby52ZXJ0ZXhEYXRhW2kxXSx2Ym8udmVydGV4RGF0YVtpMSsxXSwgdmJvLnZlcnRleERhdGFbaTErMl0pO1xyXG4gICAgICAgICAgICB2ZWMzLnNldChwMix2Ym8udmVydGV4RGF0YVtpMl0sdmJvLnZlcnRleERhdGFbaTIrMV0sIHZiby52ZXJ0ZXhEYXRhW2kyKzJdKTtcclxuICAgICAgICAgICAgdmVjMy5zZXQocDMsdmJvLnZlcnRleERhdGFbaTNdLHZiby52ZXJ0ZXhEYXRhW2kzKzFdLCB2Ym8udmVydGV4RGF0YVtpMysyXSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBwbGFuZU5vcm1hbChub3JtLCBwMSxwMixwMyk7XHJcbiAgICAgICAgICAgIHZlYzMubm9ybWFsaXplKG5vcm0sbm9ybSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpMV0gKz0gbm9ybVswXTtcclxuICAgICAgICAgICAgdmJvLm5vcm1hbERhdGFbaTErMV0gKz0gbm9ybVsxXTtcclxuICAgICAgICAgICAgdmJvLm5vcm1hbERhdGFbaTErMl0gKz0gbm9ybVsyXTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZiby5ub3JtYWxEYXRhW2kyXSArPSBub3JtWzBdO1xyXG4gICAgICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpMisxXSArPSBub3JtWzFdO1xyXG4gICAgICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpMisyXSArPSBub3JtWzJdO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmJvLm5vcm1hbERhdGFbaTNdICs9IG5vcm1bMF07XHJcbiAgICAgICAgICAgIHZiby5ub3JtYWxEYXRhW2kzKzFdICs9IG5vcm1bMV07XHJcbiAgICAgICAgICAgIHZiby5ub3JtYWxEYXRhW2kzKzJdICs9IG5vcm1bMl07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGZvcih2YXIgaT0wO2k8dmJvLm51bVZlcnRpY2VzOysraSkge1xyXG4gICAgICAgICAgICB2YXIgaTMgPSBpKjM7XHJcbiAgICAgICAgICAgIHggPSB2Ym8ubm9ybWFsRGF0YVtpM107XHJcbiAgICAgICAgICAgIHkgPSB2Ym8ubm9ybWFsRGF0YVtpMysxXTtcclxuICAgICAgICAgICAgeiA9IHZiby5ub3JtYWxEYXRhW2kzKzJdO1xyXG4gICAgICAgICAgICBpbnZMZW4gPSAxLjAvTWF0aC5zcXJ0KHgqeCt5Knkreip6KTtcclxuICAgICAgICAgICAgdmJvLm5vcm1hbERhdGFbaTNdICo9IGludkxlbjtcclxuICAgICAgICAgICAgdmJvLm5vcm1hbERhdGFbaTMrMV0gKj0gaW52TGVuO1xyXG4gICAgICAgICAgICB2Ym8ubm9ybWFsRGF0YVtpMysyXSAqPSBpbnZMZW47XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxufSkoKTtcclxuXHJcbnZib01lc2guY29tcHV0ZVNtb290aE5vcm1hbHNWQk8gPSBmdW5jdGlvbih2Ym8pIHtcclxuICAgIHZhciB2ZXJ0ZXhEYXRhID0gdmJvLnZlcnRleERhdGE7XHJcbiAgICBmb3IodmFyIGk9MDtpPHZiby5udW1WZXJ0aWNlczsrK2kpIHtcclxuICAgICAgICB2YXIgaTYgPSBpKjY7XHJcbiAgICAgICAgdmVydGV4RGF0YVtpNiszXSA9IDA7XHJcbiAgICAgICAgdmVydGV4RGF0YVtpNis0XSA9IDA7XHJcbiAgICAgICAgdmVydGV4RGF0YVtpNis1XSA9IDA7XHJcbiAgICB9XHJcbiAgICB2YXIgbm9ybSA9IHZlYzMuY3JlYXRlKCk7XHJcbiAgICB2YXIgcDEgPSB2ZWMzLmNyZWF0ZSgpLFxyXG4gICAgICAgIHAyID0gdmVjMy5jcmVhdGUoKSxcclxuICAgICAgICBwMyA9IHZlYzMuY3JlYXRlKCk7XHJcbiAgICBmb3IodmFyIGk9MDtpPHZiby5udW1JbmRpY2VzOykge1xyXG4gICAgICAgIHZhciBpMSA9IHZiby5pbmRleERhdGFbaSsrXTtcclxuICAgICAgICB2YXIgaTIgPSB2Ym8uaW5kZXhEYXRhW2krK107XHJcbiAgICAgICAgdmFyIGkzID0gdmJvLmluZGV4RGF0YVtpKytdO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZlYzMuc2V0KHAxLHZlcnRleERhdGFbaTEqNl0sdmVydGV4RGF0YVtpMSo2KzFdLCB2ZXJ0ZXhEYXRhW2kxKjYrMl0pO1xyXG4gICAgICAgIHZlYzMuc2V0KHAyLHZlcnRleERhdGFbaTIqNl0sdmVydGV4RGF0YVtpMio2KzFdLCB2ZXJ0ZXhEYXRhW2kyKjYrMl0pO1xyXG4gICAgICAgIHZlYzMuc2V0KHAzLHZlcnRleERhdGFbaTMqNl0sdmVydGV4RGF0YVtpMyo2KzFdLCB2ZXJ0ZXhEYXRhW2kzKjYrMl0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHBsYW5lTm9ybWFsKG5vcm0sIHAxLHAyLHAzKTtcclxuICAgICAgICB2ZWMzLm5vcm1hbGl6ZShub3JtLG5vcm0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZlcnRleERhdGFbaTEqMyszXSArPSBub3JtWzBdO1xyXG4gICAgICAgIHZlcnRleERhdGFbaTEqMys0XSArPSBub3JtWzFdO1xyXG4gICAgICAgIHZlcnRleERhdGFbaTEqMys1XSArPSBub3JtWzJdO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZlcnRleERhdGFbaTIqNiszXSArPSBub3JtWzBdO1xyXG4gICAgICAgIHZlcnRleERhdGFbaTIqNis0XSArPSBub3JtWzFdO1xyXG4gICAgICAgIHZlcnRleERhdGFbaTIqNis1XSArPSBub3JtWzJdO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZlcnRleERhdGFbaTMqNiszXSArPSBub3JtWzBdO1xyXG4gICAgICAgIHZlcnRleERhdGFbaTMqNis0XSArPSBub3JtWzFdO1xyXG4gICAgICAgIHZlcnRleERhdGFbaTMqNis1XSArPSBub3JtWzJdO1xyXG4gICAgfVxyXG4gICAgZm9yKHZhciBpPTA7aTx2Ym8ubnVtVmVydGljZXM7KytpKSB7XHJcbiAgICAgICAgdmFyIGk2ID0gaSo2O1xyXG4gICAgICAgIHZhciBsZW4gPSBNYXRoLnNxcnQodmVydGV4RGF0YVtpNiszXSp2ZXJ0ZXhEYXRhW2k2KzNdK3ZlcnRleERhdGFbaTYrNF0qdmVydGV4RGF0YVtpNis0XSt2ZXJ0ZXhEYXRhW2k2KzVdKnZlcnRleERhdGFbaTYrNV0pO1xyXG4gICAgICAgIHZlcnRleERhdGFbaTYrM10gLz0gbGVuO1xyXG4gICAgICAgIHZlcnRleERhdGFbaTYrNF0gLz0gbGVuO1xyXG4gICAgICAgIHZlcnRleERhdGFbaTYrNV0gLz0gbGVuO1xyXG4gICAgfVxyXG59XHJcblxyXG5cclxufSkoc2hpbS5leHBvcnRzKTtcclxufSkodGhpcyk7IiwiXCJ1c2Ugc3RyaWN0XCJcclxuXHJcbnZhciBnbE1hdHJpeCA9IHJlcXVpcmUoJy4uL2pzL2dsLW1hdHJpeC1taW4uanMnKTtcclxudmFyIHBvbHkydHJpID0gcmVxdWlyZSgnLi9wb2x5MnRyaS5qcycpO1xyXG52YXIgaGVtZXNoZXIgPSByZXF1aXJlKCcuLi9qcy9oZW1lc2guanMnKTtcclxudmFyIGhlbWVzaCA9IGhlbWVzaGVyLmhlbWVzaDtcclxudmFyIHZlYzMgPSBnbE1hdHJpeC52ZWMzO1xyXG52YXIgdmVjMiA9IGdsTWF0cml4LnZlYzI7XHJcblxyXG52YXIgU3dlZXBDb250ZXh0ID0gcG9seTJ0cmkuU3dlZXBDb250ZXh0O1xyXG52YXIgcHRzID0gW107XHJcblxyXG52YXIgb3V0c2lkZVB0cyA9IFtdO1xyXG52YXIgdHJpYW5nbGVzID0gW107XHJcbnZhciB2b3JvTWVzaCA9IG5ldyBoZW1lc2goKTtcclxudmFyIHdpZHRoID0gMTIwMDtcclxudmFyIGhlaWdodCA9IDEyMDA7XHJcbnZhciB0b3BPbiA9IHRydWU7XHJcbnZhciBsZWZ0T24gPSB0cnVlO1xyXG52YXIgYm90dG9tT24gPSB0cnVlO1xyXG52YXIgcmlnaHRPbiA9IHRydWU7XHJcbnZhciBlV2VpZ2h0ID0gMS4wO1xyXG5mdW5jdGlvbiByZXNldCgpIHtcclxuICAvL21ha2UgcmVndWxhcmx5IHNwYWNlZCBwb2ludHNcclxuICBwdHMubGVuZ3RoID0gMDtcclxuICBcclxuICB2YXIgZGVmYXVsdFNwYWNpbmcgPSAzMTA7XHJcbiAgdmFyIHhEaXZzID0gTWF0aC5mbG9vcih3aWR0aC8oZGVmYXVsdFNwYWNpbmcrMSkpO1xyXG4gIHZhciB5RGl2cyA9IE1hdGguZmxvb3IoaGVpZ2h0LyhkZWZhdWx0U3BhY2luZysxKSk7XHJcbiAgXHJcbiAgdmFyIHNwYWNpbmcgPSB3aWR0aC94RGl2cztcclxuICB2YXIgc3BhY2luZ1kgPSBoZWlnaHQveURpdnM7XHJcbiAgZm9yKHZhciBpPTA7aTx4RGl2czsrK2kpIHtcclxuICAgIGZvcih2YXIgaj0wO2o8eURpdnM7KytqKSB7XHJcbiAgICAgIHB0cy5wdXNoKHt4Omkqc3BhY2luZytqJTIqc3BhY2luZyowLjUrc3BhY2luZyowLjI1LHk6aipzcGFjaW5nWStzcGFjaW5nWSowLjUsb246dHJ1ZX0pO1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gaW5pdCgpIHtcclxuICBvdXRzaWRlUHRzLmxlbmd0aCA9IDA7XHJcbiAgdmFyIGQgPSA1MDAwO1xyXG4gIG91dHNpZGVQdHMucHVzaCh7eDowLHk6LWQsZml4ZWQ6dHJ1ZSxib3R0b206dHJ1ZX0pO1xyXG4gIG91dHNpZGVQdHMucHVzaCh7eDp3aWR0aCowLjUseTotZCxmaXhlZDp0cnVlLGJvdHRvbTp0cnVlfSk7XHJcbiAgb3V0c2lkZVB0cy5wdXNoKHt4OndpZHRoLHk6LWQsZml4ZWQ6dHJ1ZSxib3R0b206dHJ1ZX0pO1xyXG5cclxuICBvdXRzaWRlUHRzLnB1c2goe3g6d2lkdGgrZCx5OjAsZml4ZWQ6dHJ1ZSxyaWdodDp0cnVlfSk7XHJcbiAgb3V0c2lkZVB0cy5wdXNoKHt4OndpZHRoK2QseTpoZWlnaHQqMC41LGZpeGVkOnRydWUscmlnaHQ6dHJ1ZX0pO1xyXG4gIG91dHNpZGVQdHMucHVzaCh7eDp3aWR0aCtkLHk6aGVpZ2h0LGZpeGVkOnRydWUscmlnaHQ6dHJ1ZX0pO1xyXG5cclxuICBvdXRzaWRlUHRzLnB1c2goe3g6d2lkdGgseTpoZWlnaHQrZCxmaXhlZDp0cnVlLHRvcDp0cnVlfSk7XHJcbiAgb3V0c2lkZVB0cy5wdXNoKHt4OndpZHRoKjAuNSx5OmhlaWdodCtkLGZpeGVkOnRydWUsdG9wOnRydWV9KTtcclxuICBvdXRzaWRlUHRzLnB1c2goe3g6MCx5OmhlaWdodCtkLGZpeGVkOnRydWUsdG9wOnRydWV9KTtcclxuXHJcbiAgb3V0c2lkZVB0cy5wdXNoKHt4Oi1kLHk6aGVpZ2h0LGZpeGVkOnRydWUsbGVmdDp0cnVlfSk7XHJcbiAgb3V0c2lkZVB0cy5wdXNoKHt4Oi1kLHk6aGVpZ2h0KjAuNSxmaXhlZDp0cnVlLGxlZnQ6dHJ1ZX0pO1xyXG4gIG91dHNpZGVQdHMucHVzaCh7eDotZCx5OjAsZml4ZWQ6dHJ1ZSxsZWZ0OnRydWV9KTtcclxufVxyXG5cclxudmFyIHZvcm9ub2kgPSAoZnVuY3Rpb24oKSB7XHJcbiAgdmFyIHAxID0gdmVjMi5jcmVhdGUoKTtcclxuICB2YXIgcDIgPSB2ZWMyLmNyZWF0ZSgpO1xyXG4gIHZhciBwMyA9IHZlYzIuY3JlYXRlKCk7XHJcbiAgcmV0dXJuIGZ1bmN0aW9uIHZvcm9ub2koKSB7XHJcbiAgICB2YXIgdHJpYW5ndWxhdGlvbiA9IG5ldyBTd2VlcENvbnRleHQob3V0c2lkZVB0cyk7XHJcbiAgICB0cmlhbmd1bGF0aW9uLmFkZFBvaW50cyhwdHMpO1xyXG4gICAgdHJpYW5ndWxhdGlvbi50cmlhbmd1bGF0ZSgpO1xyXG4gICAgXHJcbiAgICBmb3IodmFyIGk9MDtpPG91dHNpZGVQdHMubGVuZ3RoOysraSkge1xyXG4gICAgICBvdXRzaWRlUHRzW2ldLl9wMnRfZWRnZV9saXN0ID0gbnVsbDtcclxuICAgIH1cclxuICAgIGZvcih2YXIgaT0wO2k8cHRzLmxlbmd0aDsrK2kpIHtcclxuICAgICAgcHRzW2ldLl9wMnRfZWRnZV9saXN0ID0gbnVsbDtcclxuICAgICAgcHRzW2ldLmNlbGwgPSBudWxsO1xyXG4gICAgICBwdHNbaV0uYm91bmRhcnkgPSBmYWxzZTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdHJpYW5nbGVzID0gdHJpYW5ndWxhdGlvbi5nZXRUcmlhbmdsZXMoKTtcclxuICAgIGV4cG9ydHMudHJpYW5nbGVzID0gdHJpYW5nbGVzO1xyXG4gICAgLy9lZGl0Qm91bmRhcnkoKTtcclxuICAgIGZvcih2YXIgaT0wO2k8dHJpYW5nbGVzLmxlbmd0aDsrK2kpIHtcclxuICAgICAgdmFyIHRyaSA9IHRyaWFuZ2xlc1tpXTtcclxuICAgICAgdHJpLmNpcmN1bWNlbnRlciA9IHZlYzMuY3JlYXRlKCk7XHJcbiAgICAgIHZlYzIuc2V0KHAxLHRyaS5wb2ludHNfWzBdLngsdHJpLnBvaW50c19bMF0ueSk7XHJcbiAgICAgIHZlYzIuc2V0KHAyLHRyaS5wb2ludHNfWzFdLngsdHJpLnBvaW50c19bMV0ueSk7XHJcbiAgICAgIHZlYzIuc2V0KHAzLHRyaS5wb2ludHNfWzJdLngsdHJpLnBvaW50c19bMl0ueSk7XHJcbiAgICAgIHRyaS5hcmVhID0gY2lyY3VtY2lyY2xlKHRyaS5jaXJjdW1jZW50ZXIscDEscDIscDMpOyAgICAgIFxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBidWlsZENlbGxzKCk7XHJcbiAgICB0cmltQ2VsbHMoKTtcclxuICB9XHJcbn0pKCk7XHJcblxyXG52YXIgY2lyY3VtY2lyY2xlID0gKGZ1bmN0aW9uKCkge1xyXG4gIHZhciB2MSA9IHZlYzIuY3JlYXRlKCk7XHJcbiAgdmFyIHYyID0gdmVjMi5jcmVhdGUoKTtcclxuICB2YXIgZGVub207XHJcbiAgcmV0dXJuIGZ1bmN0aW9uIGNpcmN1bWNpcmNsZShvdXQsIHAxLHAyLHAzKSB7XHJcbiAgICB2ZWMyLnN1Yih2MSxwMSxwMyk7XHJcbiAgICB2ZWMyLnN1Yih2MixwMixwMyk7XHJcbiAgICBkZW5vbSA9IHYxWzBdKnYyWzFdLXYxWzFdKnYyWzBdO1xyXG4gICAgLy9kZW5vbSA9IG9yaWVudDJkKHAxLHAyLHAzKTtcclxuICAgIHZhciB2MUxlbiA9IHZlYzIuc3FyTGVuKHYxKTtcclxuICAgIHZhciB2MkxlbiA9IHZlYzIuc3FyTGVuKHYyKTtcclxuICAgIC8vdmFyIGNyb3NzTGVuID0gY3Jvc3MqY3Jvc3M7XHJcbiAgICB2ZWMyLnNjYWxlKHYyLHYyLHYxTGVuKTtcclxuICAgIHZlYzIuc2NhbGUodjEsdjEsdjJMZW4pO1xyXG4gICAgdmVjMi5zdWIodjIsdjIsdjEpO1xyXG4gICAgb3V0WzBdID0gdjJbMV07XHJcbiAgICBvdXRbMV0gPSAtdjJbMF07XHJcbiAgICB2ZWMyLnNjYWxlKG91dCxvdXQsMC41L2Rlbm9tKTtcclxuICAgIHZlYzIuYWRkKG91dCxvdXQscDMpO1xyXG4gICAgcmV0dXJuIE1hdGguYWJzKGRlbm9tKTtcclxuICB9XHJcbn0pKCk7XHJcblxyXG52YXIgb3JpZW50MmQgPSAoZnVuY3Rpb24oKSB7XHJcbiAgdmFyIGRldGxlZnQsIGRldHJpZ2h0LCBkZXQ7XHJcbiAgdmFyIGRldHN1bSwgZXJyYm91bmQ7XHJcbiAgcmV0dXJuIGZ1bmN0aW9uIG9yaWVudDJkKHBhLHBiLHBjKSB7XHJcbiAgICBcclxuXHJcbiAgICBkZXRsZWZ0ID0gKHBhWzBdIC0gcGNbMF0pICogKHBiWzFdIC0gcGNbMV0pO1xyXG4gICAgZGV0cmlnaHQgPSAocGFbMV0gLSBwY1sxXSkgKiAocGJbMF0gLSBwY1swXSk7XHJcbiAgICBkZXQgPSBkZXRsZWZ0IC0gZGV0cmlnaHQ7XHJcblxyXG4gICAgaWYgKGRldGxlZnQgPiAwLjApIHtcclxuICAgICAgaWYgKGRldHJpZ2h0IDw9IDAuMCkge1xyXG4gICAgICAgIHJldHVybiBkZXQ7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgZGV0c3VtID0gZGV0bGVmdCArIGRldHJpZ2h0O1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2UgaWYgKGRldGxlZnQgPCAwLjApIHtcclxuICAgICAgaWYgKGRldHJpZ2h0ID49IDAuMCkge1xyXG4gICAgICAgIHJldHVybiBkZXQ7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgZGV0c3VtID0gLWRldGxlZnQgLSBkZXRyaWdodDtcclxuICAgICAgfVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgcmV0dXJuIGRldDtcclxuICAgIH1cclxuXHJcbiAgICBlcnJib3VuZCA9IGNjd2VycmJvdW5kQSAqIGRldHN1bTtcclxuICAgIGlmICgoZGV0ID49IGVycmJvdW5kKSB8fCAoLWRldCA+PSBlcnJib3VuZCkpIHtcclxuICAgICAgcmV0dXJuIGRldDtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gb3JpZW50MmRhZGFwdChwYSwgcGIsIHBjLCBkZXRzdW0pO1xyXG4gIH1cclxufSkoKTtcclxuXHJcblxyXG5mdW5jdGlvbiBzZXREaW1lbnNpb25zKHcsaCkge1xyXG4gIHdpZHRoID0gdztcclxuICBoZWlnaHQgPSBoO1xyXG59XHJcblxyXG5mdW5jdGlvbiBlZGl0Qm91bmRhcnkoKSB7XHJcbiAgdmFyIGRpcjEgPSB2ZWMyLmNyZWF0ZSgpO1xyXG4gIHZhciBkaXIyID0gdmVjMi5jcmVhdGUoKTtcclxuICBcclxuICBmb3IodmFyIGk9MDtpPHRyaWFuZ2xlcy5sZW5ndGg7KytpKSB7XHJcbiAgICB2YXIgdCA9IHRyaWFuZ2xlc1tpXTtcclxuICAgIHZhciBib3VuZGFyeSA9IHQucG9pbnRzX1swXS5ib3R0b20gfHwgdC5wb2ludHNfWzBdLmJvdHRvbSB8fCB0LnBvaW50c19bMl0uYm90dG9tIHx8XHJcbiAgICAgICAgICAgICAgICAgICAgdC5wb2ludHNfWzBdLmxlZnQgfHwgdC5wb2ludHNfWzBdLmxlZnQgfHwgdC5wb2ludHNfWzJdLmxlZnQ7XHJcbiAgICBpZihib3VuZGFyeSkge1xyXG4gICAgICB0LnBvaW50c19bMF0uYm91bmRhcnkgPSB0cnVlO1xyXG4gICAgICB0LnBvaW50c19bMV0uYm91bmRhcnkgPSB0cnVlO1xyXG4gICAgICB0LnBvaW50c19bMl0uYm91bmRhcnkgPSB0cnVlO1xyXG5cclxuICAgICAgLypcclxuICAgICAgdC5wb2ludHNfWzBdLm5ld1B0cyA9IFtdO1xyXG4gICAgICB0LnBvaW50c19bMV0ubmV3UHRzID0gW107XHJcbiAgICAgIHQucG9pbnRzX1syXS5uZXdQdHMgPSBbXTtcclxuICAgICAgdC5wb2ludHNfWzBdLm5ld1RyaXMgPSBbXTtcclxuICAgICAgdC5wb2ludHNfWzFdLm5ld1RyaXMgPSBbXTtcclxuICAgICAgdC5wb2ludHNfWzJdLm5ld1RyaXMgPSBbXTtcclxuXHJcbiAgICAgIC8vcmVtb3ZlIHRyaWFuZ2xlXHJcbiAgICAgIHRyaWFuZ2xlcy5zcGxpY2UoaSwxKTtcclxuICAgICAgaS0tO1xyXG4gICAgICAvL3VubWFyayBuZWlnaGJvcnNcclxuICAgICAgZm9yKHZhciBqPTA7ajwzOysraikge1xyXG4gICAgICAgIGlmKHQubmVpZ2hib3JzX1tqXSkge1xyXG4gICAgICAgICAgdW5tYXJrTmVpZ2hib3IodC5uZWlnaGJvcnNfW2pdLHQpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICAqL1xyXG4gICAgfVxyXG4gIH1cclxuICAvKlxyXG4gIGZvcih2YXIgaT0wLGxlbj10cmlhbmdsZXMubGVuZ3RoO2k8bGVuOysraSkge1xyXG4gICAgdmFyIHQgPSB0cmlhbmdsZXNbaV07XHJcbiAgICB2YXIgYlB0Q291bnQgPSAwO1xyXG4gICAgdmFyIGJQdHMgPSBbXTtcclxuICAgIHZhciBpblB0O1xyXG4gICAgZm9yKHZhciBqPTA7ajwzOysraikge1xyXG4gICAgICBpZih0LnBvaW50c19bal0uYm91bmRhcnkpIHtcclxuICAgICAgICBiUHRzW2JQdENvdW50XSA9IHQucG9pbnRzX1tqXTtcclxuICAgICAgICBiUHRDb3VudCsrO1xyXG4gICAgICAgIFxyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGluUHQgPSBqO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGlmKGJQdENvdW50PT0yKSB7XHJcbiAgICAgIGlmKGluUHQgPT0gMSkge1xyXG4gICAgICAgIHZhciB0ZW1wID0gYlB0c1swXTtcclxuICAgICAgICBiUHRzWzBdID0gYlB0c1sxXTtcclxuICAgICAgICBiUHRzWzFdID0gdGVtcDtcclxuICAgICAgfVxyXG4gICAgICBpblB0ID0gdC5wb2ludHNfW2luUHRdO1xyXG4gICAgICAvL21pcnJvciBpbiBwdFxyXG4gICAgICB2ZWMyLnNldChkaXIxLGJQdHNbMV0ueC1iUHRzWzBdLngsYlB0c1sxXS55LWJQdHNbMF0ueSk7XHJcbiAgICAgIHZlYzIuc2V0KGRpcjIsaW5QdC54LWJQdHNbMF0ueCxpblB0LnktYlB0c1swXS55KTtcclxuICAgICAgY29uc29sZS5sb2coZGlyMVswXSpkaXIyWzFdLWRpcjFbMV0qZGlyMlswXSk7XHJcbiAgICAgIHZlYzIubm9ybWFsaXplKGRpcjEsZGlyMSk7XHJcbiAgICAgIHZhciBkb3QgPSB2ZWMyLmRvdChkaXIxLGRpcjIpO1xyXG4gICAgICB2ZWMyLnNjYWxlKGRpcjEsZGlyMSxkb3QpO1xyXG4gICAgICB2ZWMyLnN1YihkaXIyLGRpcjEsZGlyMik7XHJcbiAgICAgIHZlYzIuYWRkKGRpcjEsZGlyMSxkaXIyKTtcclxuICAgICAgdmFyIG5ld1B0ID0gbmV3IHBvbHkydHJpLlBvaW50KGRpcjFbMF0rYlB0c1swXS54LGRpcjFbMV0rYlB0c1swXS55KTtcclxuICAgICAgbmV3UHQuZml4ZWQgPSB0cnVlO1xyXG4gICAgICAvL25ldyB0cmlhbmdsZVxyXG4gICAgICB2YXIgbmV3VCA9IG5ldyBwb2x5MnRyaS5UcmlhbmdsZShiUHRzWzBdLGJQdHNbMV0sbmV3UHQpO1xyXG4gICAgICBuZXdULmludGVyaW9yXyA9IHRydWU7XHJcbiAgICAgIG5ld1QubmV3MSA9IHRydWU7XHJcbiAgICAgIG5ld1QubWFya05laWdoYm9yKHQpO1xyXG4gICAgICB0cmlhbmdsZXMucHVzaChuZXdUKTtcclxuICAgICAgXHJcbiAgICAgIGJQdHNbMF0ubmV3UHRzLnB1c2gobmV3UHQpO1xyXG4gICAgICBiUHRzWzBdLm5ld1RyaXMucHVzaChuZXdUKTtcclxuICAgICAgYlB0c1sxXS5uZXdQdHMucHVzaChuZXdQdCk7XHJcbiAgICAgIGJQdHNbMV0ubmV3VHJpcy5wdXNoKG5ld1QpO1xyXG4gICAgfVxyXG4gIH1cclxuICB2ZWMyLnNldChkaXIxLHQucG9pbnRzX1sxXS54LXQucG9pbnRzX1swXS54LHQucG9pbnRzX1sxXS55LXQucG9pbnRzX1swXS55KTtcclxuICB2ZWMyLnNldChkaXIyLHQucG9pbnRzX1syXS54LXQucG9pbnRzX1swXS54LHQucG9pbnRzX1syXS55LXQucG9pbnRzX1swXS55KTtcclxuICBjb25zb2xlLmxvZyhkaXIxWzBdKmRpcjJbMV0tZGlyMVsxXSpkaXIyWzBdKTtcclxuICBcclxuICBmb3IodmFyIGk9MDtpPHB0cy5sZW5ndGg7KytpKSB7XHJcbiAgICB2YXIgcHQgPSBwdHNbaV07XHJcbiAgICBpZihwdC5ib3VuZGFyeSAmJiBwdC5uZXdQdHMubGVuZ3RoID09IDIpIHtcclxuICAgICAgdmFyIG5ld1QgPSBuZXcgcG9seTJ0cmkuVHJpYW5nbGUocHQscHQubmV3UHRzWzBdLHB0Lm5ld1B0c1sxXSk7XHJcbiAgICAgIG5ld1QubmV3MiA9IHRydWU7XHJcbiAgICAgIG5ld1QuaW50ZXJpb3JfID0gdHJ1ZTtcclxuICAgICAgbmV3VC5tYXJrTmVpZ2hib3IocHQubmV3VHJpc1swXSk7XHJcbiAgICAgIG5ld1QubWFya05laWdoYm9yKHB0Lm5ld1RyaXNbMV0pO1xyXG4gICAgICB0cmlhbmdsZXMucHVzaChuZXdUKTtcclxuICAgIH1cclxuICB9XHJcbiAgKi9cclxufVxyXG5cclxuZnVuY3Rpb24gdW5tYXJrTmVpZ2hib3IodDEsdDIpIHtcclxuICBmb3IodmFyIGk9MDtpPDM7KytpKSB7XHJcbiAgICBpZih0MS5uZWlnaGJvcnNfW2ldID09PSB0Mikge1xyXG4gICAgICB0MS5uZWlnaGJvcnNfW2ldID0gbnVsbDtcclxuICAgIH1cclxuICB9XHJcbn1cclxuXHJcblxyXG52YXIgY2VudHJvaWRhbCA9IChmdW5jdGlvbigpIHtcclxuICB2YXIgY2VudHJvaWQgPSB2ZWMyLmNyZWF0ZSgpO1xyXG4gIHZhciBjZW50cm9pZDIgPSB2ZWMyLmNyZWF0ZSgpO1xyXG4gIHZhciBjZW50ZXIgPSB2ZWMyLmNyZWF0ZSgpO1xyXG4gIHZhciBhcmVhLHRvdGFsQXJlYTtcclxuICB2YXIgYXJlYTIsdG90YWxBcmVhMjtcclxuICB2YXIgdjEsdjI7XHJcbiAgcmV0dXJuIGZ1bmN0aW9uIGNlbnRyb2lkYWwoKSB7XHJcbiAgICBmb3IodmFyIGk9MDtpPHB0cy5sZW5ndGg7KytpKSB7XHJcbiAgICAgIHZhciBwdCA9IHB0c1tpXTtcclxuICAgICAgaWYoIXB0LmZpeGVkKSB7XHJcbiAgICAgICAgdG90YWxBcmVhID0gMDtcclxuICAgICAgICB0b3RhbEFyZWEyID0gMDtcclxuICAgICAgICB2ZWMyLnNldChjZW50cm9pZCwwLDApO1xyXG4gICAgICAgIHZlYzIuc2V0KGNlbnRyb2lkMiwwLDApO1xyXG4gICAgICAgIHZhciBlID0gcHQuY2VsbC5lO1xyXG4gICAgICAgIGRvIHtcclxuICAgICAgICAgIHYxID0gZS52LnBvcztcclxuICAgICAgICAgIHZhciB3ID0gZS52Lnc7XHJcbiAgICAgICAgICBlID0gZS5uZXh0O1xyXG4gICAgICAgICAgdjIgPSBlLnYucG9zO1xyXG4gICAgICAgICAgLy93ICs9IGUudi53O1xyXG4gICAgICAgICAgYXJlYSA9IHc7Ly93KigodjFbMF0qdjJbMV0tdjFbMV0qdjJbMF0pKTtcclxuICAgICAgICAgIHRvdGFsQXJlYSArPSBhcmVhO1xyXG4gICAgICAgICAgY2VudHJvaWRbMF0gKz0gYXJlYSp2MVswXTsvLyh2MVswXSt2MlswXSkqYXJlYTtcclxuICAgICAgICAgIGNlbnRyb2lkWzFdICs9IGFyZWEqdjFbMV07Ly8odjFbMV0rdjJbMV0pKmFyZWE7XHJcbiAgICAgICAgICBcclxuICAgICAgICAgIGFyZWEyID0gKCh2MVswXSp2MlsxXS12MVsxXSp2MlswXSkpO1xyXG4gICAgICAgICAgdG90YWxBcmVhMiArPSBhcmVhMjtcclxuICAgICAgICAgIGNlbnRyb2lkMlswXSArPSAodjFbMF0rdjJbMF0pKmFyZWEyO1xyXG4gICAgICAgICAgY2VudHJvaWQyWzFdICs9ICh2MVsxXSt2MlsxXSkqYXJlYTI7XHJcbiAgICAgICAgfSB3aGlsZShlICE9IHB0LmNlbGwuZSk7XHJcbiAgICAgICAgLypcclxuICAgICAgICBmb3IodmFyIGo9MCxsPXB0LmNlbGwubGVuZ3RoO2o8bDsrK2opIHtcclxuICAgICAgICAgIHZhciBqTmV4dCA9IChqKzEpJWw7XHJcbiAgICAgICAgICB2MSA9IHB0LmNlbGxbal07XHJcbiAgICAgICAgICB2MiA9IHB0LmNlbGxbak5leHRdO1xyXG4gICAgICAgICAgYXJlYSA9IHYxWzBdKnYyWzFdLXYxWzFdKnYyWzBdO1xyXG4gICAgICAgICAgdG90YWxBcmVhICs9IHYxWzBdKnYyWzFdLXYxWzFdKnYyWzBdO1xyXG4gICAgICAgICAgY2VudHJvaWRbMF0gKz0gKHYxWzBdK3YyWzBdKSphcmVhO1xyXG4gICAgICAgICAgY2VudHJvaWRbMV0gKz0gKHYxWzFdK3YyWzFdKSphcmVhO1xyXG4gICAgICAgIH1cclxuICAgICAgICAqL1xyXG4gICAgICAgIHRvdGFsQXJlYTIgKj0gMztcclxuICAgICAgICB2ZWMyLnNjYWxlKGNlbnRyb2lkLGNlbnRyb2lkLDEuMC90b3RhbEFyZWEpO1xyXG4gICAgICAgIHZlYzIuc2NhbGUoY2VudHJvaWQyLGNlbnRyb2lkMiwxLjAvdG90YWxBcmVhMik7XHJcbiAgICAgICAgdmVjMi5sZXJwKGNlbnRyb2lkLGNlbnRyb2lkLGNlbnRyb2lkMiwwLjI1KTtcclxuICAgICAgICB2YXIgZHggPSBNYXRoLm1pbihNYXRoLm1heChNYXRoLnJhbmRvbSguMSksY2VudHJvaWRbMF0pLHdpZHRoLU1hdGgucmFuZG9tKC4xKSktcHQueDtcclxuICAgICAgICB2YXIgZHkgPSBNYXRoLm1pbihNYXRoLm1heChNYXRoLnJhbmRvbSguMSksY2VudHJvaWRbMV0pLGhlaWdodC1NYXRoLnJhbmRvbSguMSkpLXB0Lnk7XHJcbiAgICAgICAgaWYoZHgqZHgrZHkqZHkgPiAxNikge1xyXG4gICAgICAgICAgcHQueCArPSBkeCouMjU7XHJcbiAgICAgICAgICBwdC55ICs9IGR5Ki4yNTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcbn0pKCk7XHJcblxyXG5cclxudmFyIHB0VG9FZGdlID0gW107XHJcbnZhciBidWlsZENlbGxzID0gZnVuY3Rpb24oKSB7XHJcbiAgdm9yb01lc2guY2xlYXIoKTtcclxuICBwdFRvRWRnZS5sZW5ndGggPSAwO1xyXG4gIGZvcih2YXIgaT0wO2k8dHJpYW5nbGVzLmxlbmd0aDsrK2kpIHtcclxuICAgIHZhciB0ID0gdHJpYW5nbGVzW2ldO1xyXG4gICAgdmFyIHYgPSB2b3JvTWVzaC5hZGRWZXJ0ZXgodC5jaXJjdW1jZW50ZXIpO1xyXG4gICAgdi53ID0gMS4wOy8vMS4wKzEuMC9NYXRoLnNxcnQodC5hcmVhKTtcclxuICAgIHQudiA9IHY7XHJcbiAgICB0LmJvdHRvbSA9IHQucG9pbnRzX1swXS5ib3R0b20gfHwgdC5wb2ludHNfWzFdLmJvdHRvbSB8fCB0LnBvaW50c19bMl0uYm90dG9tO1xyXG4gICAgdC50b3AgPSB0LnBvaW50c19bMF0udG9wIHx8IHQucG9pbnRzX1sxXS50b3AgfHwgdC5wb2ludHNfWzJdLnRvcDtcclxuICAgIHQubGVmdCA9IHQucG9pbnRzX1swXS5sZWZ0IHx8IHQucG9pbnRzX1sxXS5sZWZ0IHx8IHQucG9pbnRzX1syXS5sZWZ0O1xyXG4gICAgdC5yaWdodCA9IHQucG9pbnRzX1swXS5yaWdodCB8fCB0LnBvaW50c19bMV0ucmlnaHQgfHwgdC5wb2ludHNfWzJdLnJpZ2h0O1xyXG4gIH1cclxuICBmb3IodmFyIGk9MDtpPHRyaWFuZ2xlcy5sZW5ndGg7KytpKSB7XHJcbiAgICB2YXIgdCA9IHRyaWFuZ2xlc1tpXTtcclxuICAgIGZvcih2YXIgaj0wO2o8MzsrK2opIHtcclxuICAgICAgdmFyIHB0ID0gdC5wb2ludHNfW2pdO1xyXG4gICAgICBpZighcHQuZml4ZWQgJiYgIXB0LmJvdW5kYXJ5KSB7XHJcbiAgICAgICAgaWYoIXB0LmNlbGwpe1xyXG4gICAgICAgICAgYnVpbGRDZWxsKHB0LHQpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuICBtYWtlQm91bmRhcnlFZGdlcyh2b3JvTWVzaCwgcHRUb0VkZ2UpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBidWlsZENlbGwocHQsdCkge1xyXG4gIHZhciBwcmV2ViA9IHQudjtcclxuICB0ID0gdC5uZWlnaGJvckNDVyhwdCk7XHJcbiAgdmFyIHN0YXJ0VCA9IHQ7XHJcbiAgdmFyIGUsIHByZXZFID0gbnVsbDtcclxuICB2YXIgbGVmdCxyaWdodCx0b3AsYm90dG9tO1xyXG4gIGxlZnQgPSByaWdodCA9IHRvcCA9IGJvdHRvbSA9IGZhbHNlO1xyXG4gIGRvIHtcclxuICAgIGlmKHQubGVmdCB8fCB0LmJvdHRvbSkgcmV0dXJuO1xyXG4gIH0gd2hpbGUodCAhPSBzdGFydFQpO1xyXG5cclxuICBwdC5jZWxsID0gdm9yb01lc2guYWRkRmFjZSgpO1xyXG4gIHB0LmNlbGwub24gPSBwdC5vbjtcclxuICBkbyB7XHJcbiAgICAvL3B0LmNlbGwucHVzaCh0LmNpcmN1bWNlbnRlcik7XHJcbiAgICBlID0gdm9yb01lc2guYWRkRWRnZSgpO1xyXG4gICAgXHJcbiAgICBlLnYgPSB0LnY7XHJcbiAgICBlLnYuZSA9IGU7XHJcbiAgICBpZihwcmV2RSkge1xyXG4gICAgICBwcmV2RS5uZXh0ID0gZTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHB0LmNlbGwuZSA9IGU7XHJcbiAgICB9XHJcbiAgICBlLmZhY2UgPSBwdC5jZWxsO1xyXG4gICAgZmluZFBhaXIoZSxwdFRvRWRnZSxwcmV2Vi5pbmRleCwgZS52LmluZGV4KTtcclxuICAgIHByZXZWID0gdC52O1xyXG4gICAgcHJldkUgPSBlO1xyXG4gICAgdCA9IHQubmVpZ2hib3JDQ1cocHQpO1xyXG4gIH0gd2hpbGUodCAhPSBzdGFydFQpO1xyXG4gIHByZXZFLm5leHQgPSBwdC5jZWxsLmU7XHJcbn1cclxuXHJcbi8vYnVpbGQgaGVkZ2Ugc3RydWN0dXJlXHJcbmZ1bmN0aW9uIGZpbmRQYWlyKGUscHRUb0VkZ2UsaTEsaTIpIHtcclxuICB2YXIgcHRFZGdlID0gcHRUb0VkZ2VbaTJdO1xyXG4gIGlmKHB0RWRnZSkge1xyXG4gICAgZm9yKHZhciBpPTA7aTxwdEVkZ2UubGVuZ3RoOysraSkge1xyXG4gICAgICB2YXIgZTIgPSBwdEVkZ2VbaV07XHJcbiAgICAgIGlmKGUyLnYuaW5kZXggPT0gaTEpIHtcclxuICAgICAgICBlMi5wYWlyID0gZTtcclxuICAgICAgICBlLnBhaXIgPSBlMjtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcbiAgcHRFZGdlID0gcHRUb0VkZ2VbaTFdO1xyXG4gIGlmKHB0RWRnZSkge1xyXG4gICAgcHRFZGdlLnB1c2goZSk7XHJcbiAgfSBlbHNlIHtcclxuICAgIHB0RWRnZSA9IFtlXTtcclxuICAgIHB0VG9FZGdlW2kxXSA9IHB0RWRnZTtcclxuICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG1ha2VCb3VuZGFyeUVkZ2VzKG1lc2gscHRUb0VkZ2UpIHtcclxuICAvL2FkZCBib3VuZGFyeSBlZGdlcyBhbmQgdW5zdXJlIGV2ZXJ5IGVkZ2UgaGFzIGEgcGFpclxyXG4gIHZhciBudW1FZGdlcyA9IG1lc2guZWRnZXMubGVuZ3RoO1xyXG4gIHZhciBlLHYsc3RhcnRWO1xyXG4gIGZvcih2YXIgaT0wO2k8bnVtRWRnZXM7KytpKSB7XHJcbiAgICAgZSA9IG1lc2guZWRnZXNbaV07XHJcbiAgICBpZihlLnBhaXIgPT0gbnVsbCkge1xyXG4gICAgICB2YXIgbmV3RWRnZSA9IG1lc2guYWRkRWRnZSgpO1xyXG4gICAgICBuZXdFZGdlLnBhaXIgPSBlO1xyXG4gICAgICBlLnBhaXIgPSBuZXdFZGdlO1xyXG4gICAgICBcclxuICAgICAgLy9sZXRzIHRyeSB0aGUgaW5lZmZpY2llbnQgcm91dGVcclxuICAgICAgc3RhcnRWID0gZS52O1xyXG4gICAgICBkbyB7XHJcbiAgICAgICAgdiA9IGUudjtcclxuICAgICAgICBlID0gZS5uZXh0O1xyXG4gICAgICB9IHdoaWxlKGUudiAhPSBzdGFydFYpO1xyXG4gICAgICBuZXdFZGdlLnYgPSB2O1xyXG4gICAgICBuZXdFZGdlLnYuYiA9IHRydWU7XHJcbiAgICAgIHZhciBwdEVkZ2UgPSBwdFRvRWRnZVtzdGFydFYuaW5kZXhdO1xyXG4gICAgICBwdEVkZ2UucHVzaChuZXdFZGdlKTtcclxuICAgIH1cclxuICB9XHJcbiAgZm9yKHZhciBpPW51bUVkZ2VzO2k8bWVzaC5lZGdlcy5sZW5ndGg7KytpKSB7XHJcbiAgICBlID0gbWVzaC5lZGdlc1tpXTtcclxuICAgIHZhciBwdEVkZ2UgPSBwdFRvRWRnZVtlLnYuaW5kZXhdO1xyXG4gICAgaWYocHRFZGdlKSB7XHJcbiAgICAgIGZvcih2YXIgaj0wO2o8cHRFZGdlLmxlbmd0aDsrK2opIHtcclxuICAgICAgICB2YXIgZTIgPSBwdEVkZ2Vbal07XHJcbiAgICAgICAgaWYoZTIuZmFjZSA9PSBoZW1lc2guTlVMTEZBQ0UpIHtcclxuICAgICAgICAgIGUubmV4dCA9IGUyO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gaXNJbnNpZGUocHQpIHtcclxuICB2YXIgaW5zaWRlVmFsID0gMTtcclxuICBpZihwdFswXSA+PSB3aWR0aCkge1xyXG4gICAgaW5zaWRlVmFsID0gTWF0aC5taW4oaW5zaWRlVmFsLCByaWdodE9uID8gMCA6IC0xKTtcclxuICB9XHJcbiAgaWYocHRbMF0gPD0gMCkge1xyXG4gICAgaW5zaWRlVmFsID0gTWF0aC5taW4oaW5zaWRlVmFsLCBsZWZ0T24gPyAwIDogLTEpO1xyXG4gIH1cclxuICBpZihwdFsxXSA+PSBoZWlnaHQpIHtcclxuICAgIGluc2lkZVZhbCA9IE1hdGgubWluKGluc2lkZVZhbCwgdG9wT24gPyAwIDogLTEpO1xyXG4gIH1cclxuICBpZihwdFsxXSA8PSAwKSB7XHJcbiAgICBpbnNpZGVWYWwgPSBNYXRoLm1pbihpbnNpZGVWYWwsIGJvdHRvbU9uID8gMCA6IC0xKTtcclxuICB9XHJcbiAgcmV0dXJuIGluc2lkZVZhbDtcclxuICAvL3JldHVybiBwdFswXSA+IDAgJiYgcHRbMF0gPCB3aWR0aCAmJiBwdFsxXSA+IDAgJiYgcHRbMV0gPCBoZWlnaHQ7XHJcbn1cclxuXHJcbnZhciB0cmltRWRnZSA9IChmdW5jdGlvbigpIHsgIFxyXG4gIHZhciBkaXIgPSB2ZWMyLmNyZWF0ZSgpO1xyXG4gIHJldHVybiBmdW5jdGlvbiB0cmltRWRnZShvdXQsaW5QLG91dFApIHtcclxuICBcclxuICAgIHZlYzIuc3ViKGRpcixvdXRQLGluUCk7XHJcbiAgICBpZihvdXRQWzBdIDwgMCkge1xyXG4gICAgICBpZihvdXRQWzFdIDwwKSB7XHJcbiAgICAgICAgdmFyIGxlbiA9IE1hdGgubWluKC1pblBbMF0vZGlyWzBdLC1pblBbMV0vZGlyWzFdKTtcclxuICAgICAgICBvdXRbMF0gPSBpblBbMF0rZGlyWzBdKmxlbjtcclxuICAgICAgICBvdXRbMV0gPSBpblBbMV0rZGlyWzFdKmxlbjtcclxuICAgICAgXHJcbiAgICAgIH0gZWxzZSBpZihvdXRQWzFdID4gaGVpZ2h0KSB7XHJcbiAgICAgICAgdmFyIGxlbiA9IE1hdGgubWluKC1pblBbMF0vZGlyWzBdLChoZWlnaHQtaW5QWzFdKS9kaXJbMV0pO1xyXG4gICAgICAgIG91dFswXSA9IGluUFswXStkaXJbMF0qbGVuO1xyXG4gICAgICAgIG91dFsxXSA9IGluUFsxXStkaXJbMV0qbGVuO1xyXG4gICAgICBcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBvdXRbMF0gPSAwO1xyXG4gICAgICAgIG91dFsxXSA9IGluUFsxXStkaXJbMV0qKC1pblBbMF0vZGlyWzBdKTtcclxuICAgICAgfVxyXG4gICAgfSBlbHNlIGlmKG91dFBbMF0gPiB3aWR0aCkge1xyXG4gICAgICBpZihvdXRQWzFdIDwwKSB7XHJcbiAgICAgICAgdmFyIGxlbiA9IE1hdGgubWluKCh3aWR0aC1pblBbMF0pL2RpclswXSwtaW5QWzFdL2RpclsxXSk7XHJcbiAgICAgICAgb3V0WzBdID0gaW5QWzBdK2RpclswXSpsZW47XHJcbiAgICAgICAgb3V0WzFdID0gaW5QWzFdK2RpclsxXSpsZW47ICAgICAgXHJcbiAgICAgIH0gZWxzZSBpZihvdXRQWzFdID4gaGVpZ2h0KSB7XHJcbiAgICAgICAgdmFyIGxlbiA9IE1hdGgubWluKCh3aWR0aC1pblBbMF0pL2RpclswXSwoaGVpZ2h0LWluUFsxXSkvZGlyWzFdKTtcclxuICAgICAgICBvdXRbMF0gPSBpblBbMF0rZGlyWzBdKmxlbjtcclxuICAgICAgICBvdXRbMV0gPSBpblBbMV0rZGlyWzFdKmxlbjsgICAgICBcclxuICAgICAgXHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgb3V0WzBdID0gd2lkdGg7XHJcbiAgICAgICAgb3V0WzFdID0gaW5QWzFdK2RpclsxXSooKHdpZHRoLWluUFswXSkvZGlyWzBdKTsgICAgICBcclxuICAgICAgfVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgaWYob3V0UFsxXSA8IDApIHtcclxuICAgICAgICBvdXRbMV0gPSAwO1xyXG4gICAgICAgIG91dFswXSA9IGluUFswXStkaXJbMF0qKC1pblBbMV0vZGlyWzFdKTtcclxuICAgICAgfSBlbHNlIGlmKG91dFBbMV0gPiBoZWlnaHQpIHtcclxuICAgICAgICBvdXRbMV0gPSBoZWlnaHQ7XHJcbiAgICAgICAgb3V0WzBdID0gaW5QWzBdK2RpclswXSooKGhlaWdodC1pblBbMV0pL2RpclsxXSk7XHJcbiAgICAgIFxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG59KSgpO1xyXG5cclxudmFyIEVQU0lMT04gPSAuMDAwMDE7XHJcblxyXG52YXIgdHJpbUNlbGxzID0gKGZ1bmN0aW9uKCkge1xyXG4gIHZhciBmO1xyXG4gIHJldHVybiBmdW5jdGlvbiB0cmltQ2VsbHMoKSB7XHJcbiAgICBmb3IodmFyIGk9MCxsID0gdm9yb01lc2guZmFjZXMubGVuZ3RoO2k8bDsgKytpKSB7XHJcbiAgICAgIGYgPSB2b3JvTWVzaC5mYWNlc1tpXTtcclxuICAgICAgdHJpbUZhY2UoZik7XHJcbiAgICB9XHJcbiAgfVxyXG59KSgpO1xyXG5cclxudmFyIHRyaW1GYWNlID0gKGZ1bmN0aW9uKCkge1xyXG4gIHZhciB0cmltUHQgPSB2ZWMzLmNyZWF0ZSgpO1xyXG4gIHZhciB2LGUsIHN0YXJ0RSwgcHJldkU7XHJcbiAgdmFyIG5ld1Y7XHJcbiAgcmV0dXJuIGZ1bmN0aW9uIHRyaW1GYWNlKGYpIHtcclxuICAgIHN0YXJ0RSA9IGYuZTtcclxuICAgIGUgPSBzdGFydEU7XHJcbiAgICAvL2dldCB0byBhbiBpbnNpZGUgcG9pbnRcclxuICAgIC8vd2F0Y2hvdXQgZm9yIGluZmluaXRlIGxvb3AgKG5vdCBkb25lKVxyXG4gICAgZG8ge1xyXG4gICAgICBlID0gZS5uZXh0O1xyXG4gICAgfSB3aGlsZShpc0luc2lkZShlLnYucG9zKSA8PSAwICYmIGUgIT0gc3RhcnRFKTtcclxuICAgIHN0YXJ0RSA9IGU7XHJcbiAgICAvL2ZpbmQgZmlyc3Qgb3V0c2lkZSBwdFxyXG4gICAgZG8ge1xyXG4gICAgICBcclxuICAgICAgcHJldkUgPSBlO1xyXG4gICAgICBlID0gZS5uZXh0O1xyXG4gICAgfSB3aGlsZShpc0luc2lkZShlLnYucG9zKSA+IDAgJiYgZSAhPSBzdGFydEUpO1xyXG4gICAgXHJcbiAgICBpZihpc0luc2lkZShlLnYucG9zKSA+IDApIHsgcmV0dXJuOyB9XHJcbiAgICBcclxuICAgIGlmKGlzSW5zaWRlKGUudi5wb3MpIDwgMCkgZi5vbiA9IGZhbHNlO1xyXG4gICAgXHJcbiAgICBzdGFydEUgPSBlO1xyXG4gICAgZi5lID0gZTsgICAgICBcclxuICAgIC8vaGFzIHRoaXMgZWRnZSBhbHJlYWR5IGJlZW4gdHJpbW1lZFxyXG4gICAgaWYoZS5wYWlyLmluZm8udHJpbW1lZCkge1xyXG4gICAgICAvL3BvaW50IGUgdG8gdHJpbW1lZDtcclxuICAgICAgbmV3ViA9IGUucGFpci5pbmZvLnRyaW1tZWQ7XHJcbiAgICAgIGUudiA9IG5ld1Y7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAvL21ha2UgbmV3IHRyaW1tZWQgdmVydGV4IGFuZCBwb2ludCB0byB0aGF0XHJcbiAgICAgIHRyaW1FZGdlKHRyaW1QdCwgZS5wYWlyLnYucG9zLCBlLnYucG9zKTtcclxuICAgICAgbmV3ViA9IHZvcm9NZXNoLmFkZFZlcnRleCh0cmltUHQpO1xyXG4gICAgICBuZXdWLncgPSBlV2VpZ2h0Oy8vMC41O1xyXG4gICAgICBuZXdWLmIgPSB0cnVlO1xyXG4gICAgICBuZXdWLmUgPSBlO1xyXG4gICAgICBlLnYuZSA9IG51bGw7XHJcbiAgICAgIGUudiA9IG5ld1Y7XHJcbiAgICAgIGUuaW5mby50cmltbWVkID0gbmV3VjtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZSA9IGUubmV4dDtcclxuICAgIHdoaWxlKGlzSW5zaWRlKGUudi5wb3MpIDw9IDAgJiYgZSAhPSBzdGFydEUpIHtcclxuICAgICAgaWYoaXNJbnNpZGUoZS52LnBvcykgPCAwKSBmLm9uID0gZmFsc2U7XHJcbiAgICAgIGUudi5lID0gbnVsbDtcclxuICAgICAgZSA9IGUubmV4dDtcclxuICAgIH0gICAgXHJcbiAgICAvL2hhcyB0aGlzIGVkZ2UgYWxyZWFkeSBiZWVuIHRyaW1tZWRcclxuICAgIGlmKGUucGFpci5pbmZvLnRyaW1tZWQpIHtcclxuICAgICAgLy9wb2ludCBlIHRvIHRyaW1tZWQ7XHJcbiAgICAgIG5ld1YgPSBlLnBhaXIuaW5mby50cmltbWVkO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgLy9tYWtlIG5ldyB0cmltbWVkIHZlcnRleCBhbmQgcG9pbnQgdG8gdGhhdFxyXG4gICAgICB0cmltRWRnZSh0cmltUHQsICBlLnYucG9zLGUucGFpci52LnBvcyk7XHJcbiAgICAgIG5ld1YgPSB2b3JvTWVzaC5hZGRWZXJ0ZXgodHJpbVB0KTtcclxuICAgICAgbmV3Vi53ID0gZVdlaWdodDsvLzAuNTtcclxuICAgICAgbmV3Vi5iID0gdHJ1ZTtcclxuICAgICAgZS5pbmZvLnRyaW1tZWQgPSBuZXdWO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBjb3JuZXJcclxuICAgIC8vbWF5IG5lZWQgdG8gY2hlY2sgZm9yIGZsb2F0aW5nIHBvaW50IGVycm9yc1xyXG4gICAgaWYoTWF0aC5hYnMoc3RhcnRFLnYucG9zWzBdLW5ld1YucG9zWzBdKSA+IEVQU0lMT04gJiYgTWF0aC5hYnMoc3RhcnRFLnYucG9zWzBdLW5ld1YucG9zWzBdKSA+IEVQU0lMT04pIHtcclxuICAgICAgLy93aGljaCBjb3JuZXJcclxuICAgICAgaWYoc3RhcnRFLnYucG9zWzBdIDwgRVBTSUxPTiB8fCBuZXdWLnBvc1swXSA8IEVQU0lMT04pIHtcclxuICAgICAgICB0cmltUHRbMF0gPSAwO1xyXG4gICAgICB9IGVsc2UgaWYoc3RhcnRFLnYucG9zWzBdID4gd2lkdGgtRVBTSUxPTiB8fCBuZXdWLnBvc1swXSA+IHdpZHRoLUVQU0lMT04pIHtcclxuICAgICAgICB0cmltUHRbMF0gPSB3aWR0aDtcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgaWYoc3RhcnRFLnYucG9zWzFdIDwgRVBTSUxPTiB8fCBuZXdWLnBvc1sxXSA8IEVQU0lMT04pIHtcclxuICAgICAgICB0cmltUHRbMV0gPSAwO1xyXG4gICAgICB9IGVsc2UgaWYoc3RhcnRFLnYucG9zWzFdID4gaGVpZ2h0LUVQU0lMT04gfHwgbmV3Vi5wb3NbMV0gPiBoZWlnaHQtRVBTSUxPTikge1xyXG4gICAgICAgIHRyaW1QdFsxXSA9IGhlaWdodDtcclxuICAgICAgfVxyXG4gICAgICAvL2FkZCBjb3JuZXJcclxuICAgICAgdmFyIGNvcm5lclYgPSB2b3JvTWVzaC5hZGRWZXJ0ZXgodHJpbVB0KTtcclxuICAgICAgY29ybmVyVi53ID0gZVdlaWdodDsvLzAuNTtcclxuICAgICAgdmFyIG5ld0UgPSB2b3JvTWVzaC5hZGRFZGdlKCk7XHJcbiAgICAgIHZhciBuZXdFUCA9IHZvcm9NZXNoLmFkZEVkZ2UoKTtcclxuICAgICAgdmFyIG5ld0UyID0gdm9yb01lc2guYWRkRWRnZSgpO1xyXG4gICAgICB2YXIgbmV3RVAyID0gdm9yb01lc2guYWRkRWRnZSgpO1xyXG4gICAgICBcclxuICAgICAgbmV3RS5mYWNlID0gZjtcclxuICAgICAgbmV3RTIuZmFjZSA9IGY7XHJcbiAgICAgIG5ld0UudiA9IGNvcm5lclY7XHJcbiAgICAgIG5ld0UyLnYgPSBuZXdWO1xyXG4gICAgICBjb3JuZXJWLmUgPSBuZXdFO1xyXG4gICAgICBuZXdWLmUgPSBuZXdFMjtcclxuICAgICAgbmV3RS5wYWlyID0gbmV3RVA7XHJcbiAgICAgIG5ld0VQLnBhaXIgPSBuZXdFO1xyXG4gICAgICBuZXdFMi5wYWlyID0gbmV3RVAyO1xyXG4gICAgICBuZXdFUDIucGFpciA9IG5ld0UyO1xyXG4gICAgICBuZXdFUDIudiA9IGNvcm5lclY7XHJcbiAgICAgIG5ld0VQLnYgPSBzdGFydEUudjtcclxuICAgICAgbmV3RS5uZXh0ID0gbmV3RTI7XHJcbiAgICAgIG5ld0VQMi5uZXh0ID0gbmV3RVA7XHJcbiAgICAgIHN0YXJ0RS5uZXh0ID0gbmV3RTtcclxuICAgICAgbmV3RTIubmV4dCA9IGU7XHJcbiAgICAgIFxyXG4gICAgICBpZihzdGFydEUucGFpci5pbmZvLnRyaW1CKSB7XHJcbiAgICAgICAgbmV3RVAubmV4dCA9IHN0YXJ0RS5wYWlyLmluZm8udHJpbUI7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgc3RhcnRFLmluZm8udHJpbUIgPSBuZXdFUDtcclxuICAgICAgfVxyXG4gICAgICBpZihlLnBhaXIuaW5mby50cmltQikge1xyXG4gICAgICAgIGUucGFpci5pbmZvLnRyaW1CLm5leHQgPSBuZXdFUDI7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgZS5pbmZvLnRyaW1CID0gbmV3RVAyO1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAvL2Nvbm5lY3QgdGhlIGVkZ2VzXHJcbiAgICAgIHZhciBuZXdFID0gdm9yb01lc2guYWRkRWRnZSgpO1xyXG4gICAgICB2YXIgbmV3RVAgPSB2b3JvTWVzaC5hZGRFZGdlKCk7XHJcbiAgICAgIG5ld0UudiA9IG5ld1Y7XHJcbiAgICAgIG5ld1YuZSA9IG5ld0U7XHJcbiAgICAgIG5ld0UuZmFjZSA9IGY7XHJcbiAgICAgIG5ld0UucGFpciA9IG5ld0VQO1xyXG4gICAgICBuZXdFUC5wYWlyID0gbmV3RTtcclxuICAgICAgbmV3RVAudiA9IHN0YXJ0RS52O1xyXG4gICAgICBuZXdFLm5leHQgPSBlO1xyXG4gICAgICBzdGFydEUubmV4dCA9IG5ld0U7XHJcbiAgICAgIGlmKHN0YXJ0RS5wYWlyLmluZm8udHJpbUIpIHtcclxuICAgICAgICBuZXdFUC5uZXh0ID0gc3RhcnRFLnBhaXIuaW5mby50cmltQjtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBzdGFydEUuaW5mby50cmltQiA9IG5ld0VQO1xyXG4gICAgICB9XHJcbiAgICAgIGlmKGUucGFpci5pbmZvLnRyaW1CKSB7XHJcbiAgICAgICAgZS5wYWlyLmluZm8udHJpbUIubmV4dCA9IG5ld0VQO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGUuaW5mby50cmltQiA9IG5ld0VQO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG59KSgpO1xyXG4vKlxyXG4gICAgdmFyIHYsIHYyLCBzdGFydEUsZSxjdiwgcHJldkUsIHByZXZFUCwgZVBhaXIsIGVOZXh0OztcclxuICAgIGZvcih2YXIgaT0wLGw9dm9yb01lc2gudmVydGljZXMubGVuZ3RoO2k8bDsrK2kpIHtcclxuICAgICAgdiA9IHZvcm9NZXNoLnZlcnRpY2VzW2ldO1xyXG4gICAgICBpZih2LmUgJiYgdi5iKSB7XHJcbiAgICAgICAgLy90cmltIHB0XHJcbiAgICAgICAgaWYoIWlzSW5zaWRlKHYucG9zKSkge1xyXG4gICAgICAgICAgc3RhcnRFID0gdi5lO1xyXG4gICAgICAgICAgZSA9IHN0YXJ0RTtcclxuICAgICAgICAgIHByZXZFID0gbnVsbDtcclxuICAgICAgICAgIGRvIHtcclxuICAgICAgICAgICAgZVBhaXIgPSBlLnBhaXI7XHJcbiAgICAgICAgICAgIGVOZXh0ID0gZS5uZXh0LnBhaXI7XHJcbiAgICAgICAgICAgIHYyID0gZVBhaXIudjtcclxuICAgICAgICAgICAgLy90cmltIGVkZ2VcclxuICAgICAgICAgICAgY3YgPSB2O1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYoaXNJbnNpZGUodjIucG9zKSkge1xyXG4gICAgICAgICAgICAgIHRyaW1FZGdlKHRyaW1QdCx2Mi5wb3Msdi5wb3MpO1xyXG4gICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgIGN2ID0gdm9yb01lc2guYWRkVmVydGV4KHRyaW1QdCk7XHJcbiAgICAgICAgICAgICAgY3YuYiA9IHRydWU7XHJcbiAgICAgICAgICAgICAgY3YuZSA9IGU7XHJcbiAgICAgICAgICAgICAgZS52ID0gY3Y7XHJcbiAgICAgICAgICAgICAgdmFyIG5ld0UgPSB2b3JvTWVzaC5hZGRFZGdlKCk7XHJcbiAgICAgICAgICAgICAgbmV3RS5mYWNlID0gZS5mYWNlO1xyXG4gICAgICAgICAgICAgIG5ld0UubmV4dCA9IGUubmV4dDtcclxuICAgICAgICAgICAgICBuZXdFLnYgPSB2O1xyXG4gICAgICAgICAgICAgIGUgPSBuZXdFO1xyXG4gICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgIGlmKHByZXZFKSB7XHJcbiAgICAgICAgICAgICAgICBwcmV2RS5uZXh0ID0gZVBhaXI7XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZihwcmV2RSkge1xyXG4gICAgICAgICAgICAgIHByZXZFLnYgPSBjdjtcclxuICAgICAgICAgICAgICBwcmV2RS5uZXh0ID0gZVBhaXIubmV4dDtcclxuICAgICAgICAgICAgICBwcmV2RS5mYWNlLmUgPSBwcmV2RTtcclxuICAgICAgICAgICAgICBwcmV2RS52LmUgPSBwcmV2RTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZihlLmZhY2UgIT0gaGVtZXNoLk5VTExGQUNFKSB7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgIHZhciBuZXdFUCA9IHZvcm9NZXNoLmFkZEVkZ2UoKTtcclxuICAgICAgICAgICAgICBuZXdFUC52ID0gY3Y7XHJcbiAgICAgICAgICAgICAgbmV3RVAucGFpciA9IHByZXZFO1xyXG4gICAgICAgICAgICAgIG5ld0VQLm5leHQgPSBwcmV2RVA7XHJcbiAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgcHJldkVQID0gbmV3RVA7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgZS5wYWlyID0gcHJldkU7XHJcbiAgICAgICAgICAgICAgZS5uZXh0ID0gcHJldkVQO1xyXG4gICAgICAgICAgICAgIGUudiA9IF87Ly8/P1xyXG4gICAgICAgICAgICAgIHByZXZFUCA9IGU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHByZXZFID0gZTtcclxuICAgICAgICAgICAgZSA9IGVOZXh0O1xyXG4gICAgICAgICAgfSB3aGlsZShlICE9IHN0YXJ0RSk7XHJcbiAgICAgICAgICBcclxuICAgICAgICAgIFxyXG4gICAgICAgICAgXHJcbiAgICAgICAgICB2LmUgPSBudWxsO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuKi9cclxuXHJcbmV4cG9ydHMuaW5pdCA9IGluaXQ7XHJcbmV4cG9ydHMucmVzZXQgPSByZXNldDtcclxuZXhwb3J0cy52b3Jvbm9pID0gdm9yb25vaTtcclxuZXhwb3J0cy5wdHMgPSBwdHM7XHJcbmV4cG9ydHMudHJpYW5nbGVzID0gdHJpYW5nbGVzO1xyXG5leHBvcnRzLnNldERpbWVuc2lvbnMgPSBzZXREaW1lbnNpb25zO1xyXG5leHBvcnRzLmNlbnRyb2lkYWwgPSBjZW50cm9pZGFsO1xyXG5leHBvcnRzLm1lc2ggPSB2b3JvTWVzaDsiLCIvKipcbiAqIEBmaWxlb3ZlcnZpZXcgZ2wtbWF0cml4IC0gSGlnaCBwZXJmb3JtYW5jZSBtYXRyaXggYW5kIHZlY3RvciBvcGVyYXRpb25zXG4gKiBAYXV0aG9yIEJyYW5kb24gSm9uZXNcbiAqIEBhdXRob3IgQ29saW4gTWFjS2VuemllIElWXG4gKiBAdmVyc2lvbiAyLjIuMFxuICovXG4vKiBDb3B5cmlnaHQgKGMpIDIwMTMsIEJyYW5kb24gSm9uZXMsIENvbGluIE1hY0tlbnppZSBJVi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cblxuUmVkaXN0cmlidXRpb24gYW5kIHVzZSBpbiBzb3VyY2UgYW5kIGJpbmFyeSBmb3Jtcywgd2l0aCBvciB3aXRob3V0IG1vZGlmaWNhdGlvbixcbmFyZSBwZXJtaXR0ZWQgcHJvdmlkZWQgdGhhdCB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnMgYXJlIG1ldDpcblxuICAqIFJlZGlzdHJpYnV0aW9ucyBvZiBzb3VyY2UgY29kZSBtdXN0IHJldGFpbiB0aGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSwgdGhpc1xuICAgIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyLlxuICAqIFJlZGlzdHJpYnV0aW9ucyBpbiBiaW5hcnkgZm9ybSBtdXN0IHJlcHJvZHVjZSB0aGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSxcbiAgICB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyIGluIHRoZSBkb2N1bWVudGF0aW9uIFxuICAgIGFuZC9vciBvdGhlciBtYXRlcmlhbHMgcHJvdmlkZWQgd2l0aCB0aGUgZGlzdHJpYnV0aW9uLlxuXG5USElTIFNPRlRXQVJFIElTIFBST1ZJREVEIEJZIFRIRSBDT1BZUklHSFQgSE9MREVSUyBBTkQgQ09OVFJJQlVUT1JTIFwiQVMgSVNcIiBBTkRcbkFOWSBFWFBSRVNTIE9SIElNUExJRUQgV0FSUkFOVElFUywgSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFRIRSBJTVBMSUVEXG5XQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSBBTkQgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQVJFIFxuRElTQ0xBSU1FRC4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFIENPUFlSSUdIVCBIT0xERVIgT1IgQ09OVFJJQlVUT1JTIEJFIExJQUJMRSBGT1JcbkFOWSBESVJFQ1QsIElORElSRUNULCBJTkNJREVOVEFMLCBTUEVDSUFMLCBFWEVNUExBUlksIE9SIENPTlNFUVVFTlRJQUwgREFNQUdFU1xuKElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBQUk9DVVJFTUVOVCBPRiBTVUJTVElUVVRFIEdPT0RTIE9SIFNFUlZJQ0VTO1xuTE9TUyBPRiBVU0UsIERBVEEsIE9SIFBST0ZJVFM7IE9SIEJVU0lORVNTIElOVEVSUlVQVElPTikgSE9XRVZFUiBDQVVTRUQgQU5EIE9OXG5BTlkgVEhFT1JZIE9GIExJQUJJTElUWSwgV0hFVEhFUiBJTiBDT05UUkFDVCwgU1RSSUNUIExJQUJJTElUWSwgT1IgVE9SVFxuKElOQ0xVRElORyBORUdMSUdFTkNFIE9SIE9USEVSV0lTRSkgQVJJU0lORyBJTiBBTlkgV0FZIE9VVCBPRiBUSEUgVVNFIE9GIFRISVNcblNPRlRXQVJFLCBFVkVOIElGIEFEVklTRUQgT0YgVEhFIFBPU1NJQklMSVRZIE9GIFNVQ0ggREFNQUdFLiAqL1xuKGZ1bmN0aW9uKGUpe1widXNlIHN0cmljdFwiO3ZhciB0PXt9O3R5cGVvZiBleHBvcnRzPT1cInVuZGVmaW5lZFwiP3R5cGVvZiBkZWZpbmU9PVwiZnVuY3Rpb25cIiYmdHlwZW9mIGRlZmluZS5hbWQ9PVwib2JqZWN0XCImJmRlZmluZS5hbWQ/KHQuZXhwb3J0cz17fSxkZWZpbmUoZnVuY3Rpb24oKXtyZXR1cm4gdC5leHBvcnRzfSkpOnQuZXhwb3J0cz10eXBlb2Ygd2luZG93IT1cInVuZGVmaW5lZFwiP3dpbmRvdzplOnQuZXhwb3J0cz1leHBvcnRzLGZ1bmN0aW9uKGUpe2lmKCF0KXZhciB0PTFlLTY7aWYoIW4pdmFyIG49dHlwZW9mIEZsb2F0MzJBcnJheSE9XCJ1bmRlZmluZWRcIj9GbG9hdDMyQXJyYXk6QXJyYXk7aWYoIXIpdmFyIHI9TWF0aC5yYW5kb207dmFyIGk9e307aS5zZXRNYXRyaXhBcnJheVR5cGU9ZnVuY3Rpb24oZSl7bj1lfSx0eXBlb2YgZSE9XCJ1bmRlZmluZWRcIiYmKGUuZ2xNYXRyaXg9aSk7dmFyIHM9e307cy5jcmVhdGU9ZnVuY3Rpb24oKXt2YXIgZT1uZXcgbigyKTtyZXR1cm4gZVswXT0wLGVbMV09MCxlfSxzLmNsb25lPWZ1bmN0aW9uKGUpe3ZhciB0PW5ldyBuKDIpO3JldHVybiB0WzBdPWVbMF0sdFsxXT1lWzFdLHR9LHMuZnJvbVZhbHVlcz1mdW5jdGlvbihlLHQpe3ZhciByPW5ldyBuKDIpO3JldHVybiByWzBdPWUsclsxXT10LHJ9LHMuY29weT1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdPXRbMF0sZVsxXT10WzFdLGV9LHMuc2V0PWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10LGVbMV09bixlfSxzLmFkZD1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dFswXStuWzBdLGVbMV09dFsxXStuWzFdLGV9LHMuc3VidHJhY3Q9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0tblswXSxlWzFdPXRbMV0tblsxXSxlfSxzLnN1Yj1zLnN1YnRyYWN0LHMubXVsdGlwbHk9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0qblswXSxlWzFdPXRbMV0qblsxXSxlfSxzLm11bD1zLm11bHRpcGx5LHMuZGl2aWRlPWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10WzBdL25bMF0sZVsxXT10WzFdL25bMV0sZX0scy5kaXY9cy5kaXZpZGUscy5taW49ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPU1hdGgubWluKHRbMF0sblswXSksZVsxXT1NYXRoLm1pbih0WzFdLG5bMV0pLGV9LHMubWF4PWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT1NYXRoLm1heCh0WzBdLG5bMF0pLGVbMV09TWF0aC5tYXgodFsxXSxuWzFdKSxlfSxzLnNjYWxlPWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10WzBdKm4sZVsxXT10WzFdKm4sZX0scy5zY2FsZUFuZEFkZD1mdW5jdGlvbihlLHQsbixyKXtyZXR1cm4gZVswXT10WzBdK25bMF0qcixlWzFdPXRbMV0rblsxXSpyLGV9LHMuZGlzdGFuY2U9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLWVbMF0scj10WzFdLWVbMV07cmV0dXJuIE1hdGguc3FydChuKm4rcipyKX0scy5kaXN0PXMuZGlzdGFuY2Uscy5zcXVhcmVkRGlzdGFuY2U9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLWVbMF0scj10WzFdLWVbMV07cmV0dXJuIG4qbityKnJ9LHMuc3FyRGlzdD1zLnNxdWFyZWREaXN0YW5jZSxzLmxlbmd0aD1mdW5jdGlvbihlKXt2YXIgdD1lWzBdLG49ZVsxXTtyZXR1cm4gTWF0aC5zcXJ0KHQqdCtuKm4pfSxzLmxlbj1zLmxlbmd0aCxzLnNxdWFyZWRMZW5ndGg9ZnVuY3Rpb24oZSl7dmFyIHQ9ZVswXSxuPWVbMV07cmV0dXJuIHQqdCtuKm59LHMuc3FyTGVuPXMuc3F1YXJlZExlbmd0aCxzLm5lZ2F0ZT1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdPS10WzBdLGVbMV09LXRbMV0sZX0scy5ub3JtYWxpemU9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLHI9dFsxXSxpPW4qbityKnI7cmV0dXJuIGk+MCYmKGk9MS9NYXRoLnNxcnQoaSksZVswXT10WzBdKmksZVsxXT10WzFdKmkpLGV9LHMuZG90PWZ1bmN0aW9uKGUsdCl7cmV0dXJuIGVbMF0qdFswXStlWzFdKnRbMV19LHMuY3Jvc3M9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0qblsxXS10WzFdKm5bMF07cmV0dXJuIGVbMF09ZVsxXT0wLGVbMl09cixlfSxzLmxlcnA9ZnVuY3Rpb24oZSx0LG4scil7dmFyIGk9dFswXSxzPXRbMV07cmV0dXJuIGVbMF09aStyKihuWzBdLWkpLGVbMV09cytyKihuWzFdLXMpLGV9LHMucmFuZG9tPWZ1bmN0aW9uKGUsdCl7dD10fHwxO3ZhciBuPXIoKSoyKk1hdGguUEk7cmV0dXJuIGVbMF09TWF0aC5jb3MobikqdCxlWzFdPU1hdGguc2luKG4pKnQsZX0scy50cmFuc2Zvcm1NYXQyPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXTtyZXR1cm4gZVswXT1uWzBdKnIrblsyXSppLGVbMV09blsxXSpyK25bM10qaSxlfSxzLnRyYW5zZm9ybU1hdDJkPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXTtyZXR1cm4gZVswXT1uWzBdKnIrblsyXSppK25bNF0sZVsxXT1uWzFdKnIrblszXSppK25bNV0sZX0scy50cmFuc2Zvcm1NYXQzPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXTtyZXR1cm4gZVswXT1uWzBdKnIrblszXSppK25bNl0sZVsxXT1uWzFdKnIrbls0XSppK25bN10sZX0scy50cmFuc2Zvcm1NYXQ0PWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXTtyZXR1cm4gZVswXT1uWzBdKnIrbls0XSppK25bMTJdLGVbMV09blsxXSpyK25bNV0qaStuWzEzXSxlfSxzLmZvckVhY2g9ZnVuY3Rpb24oKXt2YXIgZT1zLmNyZWF0ZSgpO3JldHVybiBmdW5jdGlvbih0LG4scixpLHMsbyl7dmFyIHUsYTtufHwobj0yKSxyfHwocj0wKSxpP2E9TWF0aC5taW4oaSpuK3IsdC5sZW5ndGgpOmE9dC5sZW5ndGg7Zm9yKHU9cjt1PGE7dSs9billWzBdPXRbdV0sZVsxXT10W3UrMV0scyhlLGUsbyksdFt1XT1lWzBdLHRbdSsxXT1lWzFdO3JldHVybiB0fX0oKSxzLnN0cj1mdW5jdGlvbihlKXtyZXR1cm5cInZlYzIoXCIrZVswXStcIiwgXCIrZVsxXStcIilcIn0sdHlwZW9mIGUhPVwidW5kZWZpbmVkXCImJihlLnZlYzI9cyk7dmFyIG89e307by5jcmVhdGU9ZnVuY3Rpb24oKXt2YXIgZT1uZXcgbigzKTtyZXR1cm4gZVswXT0wLGVbMV09MCxlWzJdPTAsZX0sby5jbG9uZT1mdW5jdGlvbihlKXt2YXIgdD1uZXcgbigzKTtyZXR1cm4gdFswXT1lWzBdLHRbMV09ZVsxXSx0WzJdPWVbMl0sdH0sby5mcm9tVmFsdWVzPWZ1bmN0aW9uKGUsdCxyKXt2YXIgaT1uZXcgbigzKTtyZXR1cm4gaVswXT1lLGlbMV09dCxpWzJdPXIsaX0sby5jb3B5PWZ1bmN0aW9uKGUsdCl7cmV0dXJuIGVbMF09dFswXSxlWzFdPXRbMV0sZVsyXT10WzJdLGV9LG8uc2V0PWZ1bmN0aW9uKGUsdCxuLHIpe3JldHVybiBlWzBdPXQsZVsxXT1uLGVbMl09cixlfSxvLmFkZD1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dFswXStuWzBdLGVbMV09dFsxXStuWzFdLGVbMl09dFsyXStuWzJdLGV9LG8uc3VidHJhY3Q9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0tblswXSxlWzFdPXRbMV0tblsxXSxlWzJdPXRbMl0tblsyXSxlfSxvLnN1Yj1vLnN1YnRyYWN0LG8ubXVsdGlwbHk9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0qblswXSxlWzFdPXRbMV0qblsxXSxlWzJdPXRbMl0qblsyXSxlfSxvLm11bD1vLm11bHRpcGx5LG8uZGl2aWRlPWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10WzBdL25bMF0sZVsxXT10WzFdL25bMV0sZVsyXT10WzJdL25bMl0sZX0sby5kaXY9by5kaXZpZGUsby5taW49ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPU1hdGgubWluKHRbMF0sblswXSksZVsxXT1NYXRoLm1pbih0WzFdLG5bMV0pLGVbMl09TWF0aC5taW4odFsyXSxuWzJdKSxlfSxvLm1heD1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09TWF0aC5tYXgodFswXSxuWzBdKSxlWzFdPU1hdGgubWF4KHRbMV0sblsxXSksZVsyXT1NYXRoLm1heCh0WzJdLG5bMl0pLGV9LG8uc2NhbGU9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0qbixlWzFdPXRbMV0qbixlWzJdPXRbMl0qbixlfSxvLnNjYWxlQW5kQWRkPWZ1bmN0aW9uKGUsdCxuLHIpe3JldHVybiBlWzBdPXRbMF0rblswXSpyLGVbMV09dFsxXStuWzFdKnIsZVsyXT10WzJdK25bMl0qcixlfSxvLmRpc3RhbmNlPWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXS1lWzBdLHI9dFsxXS1lWzFdLGk9dFsyXS1lWzJdO3JldHVybiBNYXRoLnNxcnQobipuK3IqcitpKmkpfSxvLmRpc3Q9by5kaXN0YW5jZSxvLnNxdWFyZWREaXN0YW5jZT1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0tZVswXSxyPXRbMV0tZVsxXSxpPXRbMl0tZVsyXTtyZXR1cm4gbipuK3IqcitpKml9LG8uc3FyRGlzdD1vLnNxdWFyZWREaXN0YW5jZSxvLmxlbmd0aD1mdW5jdGlvbihlKXt2YXIgdD1lWzBdLG49ZVsxXSxyPWVbMl07cmV0dXJuIE1hdGguc3FydCh0KnQrbipuK3Iqcil9LG8ubGVuPW8ubGVuZ3RoLG8uc3F1YXJlZExlbmd0aD1mdW5jdGlvbihlKXt2YXIgdD1lWzBdLG49ZVsxXSxyPWVbMl07cmV0dXJuIHQqdCtuKm4rcipyfSxvLnNxckxlbj1vLnNxdWFyZWRMZW5ndGgsby5uZWdhdGU9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXT0tdFswXSxlWzFdPS10WzFdLGVbMl09LXRbMl0sZX0sby5ub3JtYWxpemU9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLHI9dFsxXSxpPXRbMl0scz1uKm4rcipyK2kqaTtyZXR1cm4gcz4wJiYocz0xL01hdGguc3FydChzKSxlWzBdPXRbMF0qcyxlWzFdPXRbMV0qcyxlWzJdPXRbMl0qcyksZX0sby5kb3Q9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXSp0WzBdK2VbMV0qdFsxXStlWzJdKnRbMl19LG8uY3Jvc3M9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPW5bMF0sdT1uWzFdLGE9blsyXTtyZXR1cm4gZVswXT1pKmEtcyp1LGVbMV09cypvLXIqYSxlWzJdPXIqdS1pKm8sZX0sby5sZXJwPWZ1bmN0aW9uKGUsdCxuLHIpe3ZhciBpPXRbMF0scz10WzFdLG89dFsyXTtyZXR1cm4gZVswXT1pK3IqKG5bMF0taSksZVsxXT1zK3IqKG5bMV0tcyksZVsyXT1vK3IqKG5bMl0tbyksZX0sby5yYW5kb209ZnVuY3Rpb24oZSx0KXt0PXR8fDE7dmFyIG49cigpKjIqTWF0aC5QSSxpPXIoKSoyLTEscz1NYXRoLnNxcnQoMS1pKmkpKnQ7cmV0dXJuIGVbMF09TWF0aC5jb3MobikqcyxlWzFdPU1hdGguc2luKG4pKnMsZVsyXT1pKnQsZX0sby50cmFuc2Zvcm1NYXQ0PWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl07cmV0dXJuIGVbMF09blswXSpyK25bNF0qaStuWzhdKnMrblsxMl0sZVsxXT1uWzFdKnIrbls1XSppK25bOV0qcytuWzEzXSxlWzJdPW5bMl0qcituWzZdKmkrblsxMF0qcytuWzE0XSxlfSxvLnRyYW5zZm9ybU1hdDM9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXTtyZXR1cm4gZVswXT1yKm5bMF0raSpuWzNdK3Mqbls2XSxlWzFdPXIqblsxXStpKm5bNF0rcypuWzddLGVbMl09cipuWzJdK2kqbls1XStzKm5bOF0sZX0sby50cmFuc2Zvcm1RdWF0PWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz1uWzBdLHU9blsxXSxhPW5bMl0sZj1uWzNdLGw9ZipyK3Uqcy1hKmksYz1mKmkrYSpyLW8qcyxoPWYqcytvKmktdSpyLHA9LW8qci11KmktYSpzO3JldHVybiBlWzBdPWwqZitwKi1vK2MqLWEtaCotdSxlWzFdPWMqZitwKi11K2gqLW8tbCotYSxlWzJdPWgqZitwKi1hK2wqLXUtYyotbyxlfSxvLmZvckVhY2g9ZnVuY3Rpb24oKXt2YXIgZT1vLmNyZWF0ZSgpO3JldHVybiBmdW5jdGlvbih0LG4scixpLHMsbyl7dmFyIHUsYTtufHwobj0zKSxyfHwocj0wKSxpP2E9TWF0aC5taW4oaSpuK3IsdC5sZW5ndGgpOmE9dC5sZW5ndGg7Zm9yKHU9cjt1PGE7dSs9billWzBdPXRbdV0sZVsxXT10W3UrMV0sZVsyXT10W3UrMl0scyhlLGUsbyksdFt1XT1lWzBdLHRbdSsxXT1lWzFdLHRbdSsyXT1lWzJdO3JldHVybiB0fX0oKSxvLnN0cj1mdW5jdGlvbihlKXtyZXR1cm5cInZlYzMoXCIrZVswXStcIiwgXCIrZVsxXStcIiwgXCIrZVsyXStcIilcIn0sdHlwZW9mIGUhPVwidW5kZWZpbmVkXCImJihlLnZlYzM9byk7dmFyIHU9e307dS5jcmVhdGU9ZnVuY3Rpb24oKXt2YXIgZT1uZXcgbig0KTtyZXR1cm4gZVswXT0wLGVbMV09MCxlWzJdPTAsZVszXT0wLGV9LHUuY2xvbmU9ZnVuY3Rpb24oZSl7dmFyIHQ9bmV3IG4oNCk7cmV0dXJuIHRbMF09ZVswXSx0WzFdPWVbMV0sdFsyXT1lWzJdLHRbM109ZVszXSx0fSx1LmZyb21WYWx1ZXM9ZnVuY3Rpb24oZSx0LHIsaSl7dmFyIHM9bmV3IG4oNCk7cmV0dXJuIHNbMF09ZSxzWzFdPXQsc1syXT1yLHNbM109aSxzfSx1LmNvcHk9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXT10WzBdLGVbMV09dFsxXSxlWzJdPXRbMl0sZVszXT10WzNdLGV9LHUuc2V0PWZ1bmN0aW9uKGUsdCxuLHIsaSl7cmV0dXJuIGVbMF09dCxlWzFdPW4sZVsyXT1yLGVbM109aSxlfSx1LmFkZD1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dFswXStuWzBdLGVbMV09dFsxXStuWzFdLGVbMl09dFsyXStuWzJdLGVbM109dFszXStuWzNdLGV9LHUuc3VidHJhY3Q9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0tblswXSxlWzFdPXRbMV0tblsxXSxlWzJdPXRbMl0tblsyXSxlWzNdPXRbM10tblszXSxlfSx1LnN1Yj11LnN1YnRyYWN0LHUubXVsdGlwbHk9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPXRbMF0qblswXSxlWzFdPXRbMV0qblsxXSxlWzJdPXRbMl0qblsyXSxlWzNdPXRbM10qblszXSxlfSx1Lm11bD11Lm11bHRpcGx5LHUuZGl2aWRlPWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10WzBdL25bMF0sZVsxXT10WzFdL25bMV0sZVsyXT10WzJdL25bMl0sZVszXT10WzNdL25bM10sZX0sdS5kaXY9dS5kaXZpZGUsdS5taW49ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPU1hdGgubWluKHRbMF0sblswXSksZVsxXT1NYXRoLm1pbih0WzFdLG5bMV0pLGVbMl09TWF0aC5taW4odFsyXSxuWzJdKSxlWzNdPU1hdGgubWluKHRbM10sblszXSksZX0sdS5tYXg9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBlWzBdPU1hdGgubWF4KHRbMF0sblswXSksZVsxXT1NYXRoLm1heCh0WzFdLG5bMV0pLGVbMl09TWF0aC5tYXgodFsyXSxuWzJdKSxlWzNdPU1hdGgubWF4KHRbM10sblszXSksZX0sdS5zY2FsZT1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGVbMF09dFswXSpuLGVbMV09dFsxXSpuLGVbMl09dFsyXSpuLGVbM109dFszXSpuLGV9LHUuc2NhbGVBbmRBZGQ9ZnVuY3Rpb24oZSx0LG4scil7cmV0dXJuIGVbMF09dFswXStuWzBdKnIsZVsxXT10WzFdK25bMV0qcixlWzJdPXRbMl0rblsyXSpyLGVbM109dFszXStuWzNdKnIsZX0sdS5kaXN0YW5jZT1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0tZVswXSxyPXRbMV0tZVsxXSxpPXRbMl0tZVsyXSxzPXRbM10tZVszXTtyZXR1cm4gTWF0aC5zcXJ0KG4qbityKnIraSppK3Mqcyl9LHUuZGlzdD11LmRpc3RhbmNlLHUuc3F1YXJlZERpc3RhbmNlPWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXS1lWzBdLHI9dFsxXS1lWzFdLGk9dFsyXS1lWzJdLHM9dFszXS1lWzNdO3JldHVybiBuKm4rcipyK2kqaStzKnN9LHUuc3FyRGlzdD11LnNxdWFyZWREaXN0YW5jZSx1Lmxlbmd0aD1mdW5jdGlvbihlKXt2YXIgdD1lWzBdLG49ZVsxXSxyPWVbMl0saT1lWzNdO3JldHVybiBNYXRoLnNxcnQodCp0K24qbityKnIraSppKX0sdS5sZW49dS5sZW5ndGgsdS5zcXVhcmVkTGVuZ3RoPWZ1bmN0aW9uKGUpe3ZhciB0PWVbMF0sbj1lWzFdLHI9ZVsyXSxpPWVbM107cmV0dXJuIHQqdCtuKm4rcipyK2kqaX0sdS5zcXJMZW49dS5zcXVhcmVkTGVuZ3RoLHUubmVnYXRlPWZ1bmN0aW9uKGUsdCl7cmV0dXJuIGVbMF09LXRbMF0sZVsxXT0tdFsxXSxlWzJdPS10WzJdLGVbM109LXRbM10sZX0sdS5ub3JtYWxpemU9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLHI9dFsxXSxpPXRbMl0scz10WzNdLG89bipuK3IqcitpKmkrcypzO3JldHVybiBvPjAmJihvPTEvTWF0aC5zcXJ0KG8pLGVbMF09dFswXSpvLGVbMV09dFsxXSpvLGVbMl09dFsyXSpvLGVbM109dFszXSpvKSxlfSx1LmRvdD1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdKnRbMF0rZVsxXSp0WzFdK2VbMl0qdFsyXStlWzNdKnRbM119LHUubGVycD1mdW5jdGlvbihlLHQsbixyKXt2YXIgaT10WzBdLHM9dFsxXSxvPXRbMl0sdT10WzNdO3JldHVybiBlWzBdPWkrciooblswXS1pKSxlWzFdPXMrciooblsxXS1zKSxlWzJdPW8rciooblsyXS1vKSxlWzNdPXUrciooblszXS11KSxlfSx1LnJhbmRvbT1mdW5jdGlvbihlLHQpe3JldHVybiB0PXR8fDEsZVswXT1yKCksZVsxXT1yKCksZVsyXT1yKCksZVszXT1yKCksdS5ub3JtYWxpemUoZSxlKSx1LnNjYWxlKGUsZSx0KSxlfSx1LnRyYW5zZm9ybU1hdDQ9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM107cmV0dXJuIGVbMF09blswXSpyK25bNF0qaStuWzhdKnMrblsxMl0qbyxlWzFdPW5bMV0qcituWzVdKmkrbls5XSpzK25bMTNdKm8sZVsyXT1uWzJdKnIrbls2XSppK25bMTBdKnMrblsxNF0qbyxlWzNdPW5bM10qcituWzddKmkrblsxMV0qcytuWzE1XSpvLGV9LHUudHJhbnNmb3JtUXVhdD1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89blswXSx1PW5bMV0sYT1uWzJdLGY9blszXSxsPWYqcit1KnMtYSppLGM9ZippK2Eqci1vKnMsaD1mKnMrbyppLXUqcixwPS1vKnItdSppLWEqcztyZXR1cm4gZVswXT1sKmYrcCotbytjKi1hLWgqLXUsZVsxXT1jKmYrcCotdStoKi1vLWwqLWEsZVsyXT1oKmYrcCotYStsKi11LWMqLW8sZX0sdS5mb3JFYWNoPWZ1bmN0aW9uKCl7dmFyIGU9dS5jcmVhdGUoKTtyZXR1cm4gZnVuY3Rpb24odCxuLHIsaSxzLG8pe3ZhciB1LGE7bnx8KG49NCkscnx8KHI9MCksaT9hPU1hdGgubWluKGkqbityLHQubGVuZ3RoKTphPXQubGVuZ3RoO2Zvcih1PXI7dTxhO3UrPW4pZVswXT10W3VdLGVbMV09dFt1KzFdLGVbMl09dFt1KzJdLGVbM109dFt1KzNdLHMoZSxlLG8pLHRbdV09ZVswXSx0W3UrMV09ZVsxXSx0W3UrMl09ZVsyXSx0W3UrM109ZVszXTtyZXR1cm4gdH19KCksdS5zdHI9ZnVuY3Rpb24oZSl7cmV0dXJuXCJ2ZWM0KFwiK2VbMF0rXCIsIFwiK2VbMV0rXCIsIFwiK2VbMl0rXCIsIFwiK2VbM10rXCIpXCJ9LHR5cGVvZiBlIT1cInVuZGVmaW5lZFwiJiYoZS52ZWM0PXUpO3ZhciBhPXt9O2EuY3JlYXRlPWZ1bmN0aW9uKCl7dmFyIGU9bmV3IG4oNCk7cmV0dXJuIGVbMF09MSxlWzFdPTAsZVsyXT0wLGVbM109MSxlfSxhLmNsb25lPWZ1bmN0aW9uKGUpe3ZhciB0PW5ldyBuKDQpO3JldHVybiB0WzBdPWVbMF0sdFsxXT1lWzFdLHRbMl09ZVsyXSx0WzNdPWVbM10sdH0sYS5jb3B5PWZ1bmN0aW9uKGUsdCl7cmV0dXJuIGVbMF09dFswXSxlWzFdPXRbMV0sZVsyXT10WzJdLGVbM109dFszXSxlfSxhLmlkZW50aXR5PWZ1bmN0aW9uKGUpe3JldHVybiBlWzBdPTEsZVsxXT0wLGVbMl09MCxlWzNdPTEsZX0sYS50cmFuc3Bvc2U9ZnVuY3Rpb24oZSx0KXtpZihlPT09dCl7dmFyIG49dFsxXTtlWzFdPXRbMl0sZVsyXT1ufWVsc2UgZVswXT10WzBdLGVbMV09dFsyXSxlWzJdPXRbMV0sZVszXT10WzNdO3JldHVybiBlfSxhLmludmVydD1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0scj10WzFdLGk9dFsyXSxzPXRbM10sbz1uKnMtaSpyO3JldHVybiBvPyhvPTEvbyxlWzBdPXMqbyxlWzFdPS1yKm8sZVsyXT0taSpvLGVbM109bipvLGUpOm51bGx9LGEuYWRqb2ludD1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF07cmV0dXJuIGVbMF09dFszXSxlWzFdPS10WzFdLGVbMl09LXRbMl0sZVszXT1uLGV9LGEuZGV0ZXJtaW5hbnQ9ZnVuY3Rpb24oZSl7cmV0dXJuIGVbMF0qZVszXS1lWzJdKmVbMV19LGEubXVsdGlwbHk9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM10sdT1uWzBdLGE9blsxXSxmPW5bMl0sbD1uWzNdO3JldHVybiBlWzBdPXIqdStpKmYsZVsxXT1yKmEraSpsLGVbMl09cyp1K28qZixlWzNdPXMqYStvKmwsZX0sYS5tdWw9YS5tdWx0aXBseSxhLnJvdGF0ZT1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXSx1PU1hdGguc2luKG4pLGE9TWF0aC5jb3Mobik7cmV0dXJuIGVbMF09ciphK2kqdSxlWzFdPXIqLXUraSphLGVbMl09cyphK28qdSxlWzNdPXMqLXUrbyphLGV9LGEuc2NhbGU9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM10sdT1uWzBdLGE9blsxXTtyZXR1cm4gZVswXT1yKnUsZVsxXT1pKmEsZVsyXT1zKnUsZVszXT1vKmEsZX0sYS5zdHI9ZnVuY3Rpb24oZSl7cmV0dXJuXCJtYXQyKFwiK2VbMF0rXCIsIFwiK2VbMV0rXCIsIFwiK2VbMl0rXCIsIFwiK2VbM10rXCIpXCJ9LHR5cGVvZiBlIT1cInVuZGVmaW5lZFwiJiYoZS5tYXQyPWEpO3ZhciBmPXt9O2YuY3JlYXRlPWZ1bmN0aW9uKCl7dmFyIGU9bmV3IG4oNik7cmV0dXJuIGVbMF09MSxlWzFdPTAsZVsyXT0wLGVbM109MSxlWzRdPTAsZVs1XT0wLGV9LGYuY2xvbmU9ZnVuY3Rpb24oZSl7dmFyIHQ9bmV3IG4oNik7cmV0dXJuIHRbMF09ZVswXSx0WzFdPWVbMV0sdFsyXT1lWzJdLHRbM109ZVszXSx0WzRdPWVbNF0sdFs1XT1lWzVdLHR9LGYuY29weT1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdPXRbMF0sZVsxXT10WzFdLGVbMl09dFsyXSxlWzNdPXRbM10sZVs0XT10WzRdLGVbNV09dFs1XSxlfSxmLmlkZW50aXR5PWZ1bmN0aW9uKGUpe3JldHVybiBlWzBdPTEsZVsxXT0wLGVbMl09MCxlWzNdPTEsZVs0XT0wLGVbNV09MCxlfSxmLmludmVydD1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0scj10WzFdLGk9dFsyXSxzPXRbM10sbz10WzRdLHU9dFs1XSxhPW4qcy1yKmk7cmV0dXJuIGE/KGE9MS9hLGVbMF09cyphLGVbMV09LXIqYSxlWzJdPS1pKmEsZVszXT1uKmEsZVs0XT0oaSp1LXMqbykqYSxlWzVdPShyKm8tbip1KSphLGUpOm51bGx9LGYuZGV0ZXJtaW5hbnQ9ZnVuY3Rpb24oZSl7cmV0dXJuIGVbMF0qZVszXS1lWzFdKmVbMl19LGYubXVsdGlwbHk9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM10sdT10WzRdLGE9dFs1XSxmPW5bMF0sbD1uWzFdLGM9blsyXSxoPW5bM10scD1uWzRdLGQ9bls1XTtyZXR1cm4gZVswXT1yKmYraSpjLGVbMV09cipsK2kqaCxlWzJdPXMqZitvKmMsZVszXT1zKmwrbypoLGVbNF09Zip1K2MqYStwLGVbNV09bCp1K2gqYStkLGV9LGYubXVsPWYubXVsdGlwbHksZi5yb3RhdGU9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM10sdT10WzRdLGE9dFs1XSxmPU1hdGguc2luKG4pLGw9TWF0aC5jb3Mobik7cmV0dXJuIGVbMF09cipsK2kqZixlWzFdPS1yKmYraSpsLGVbMl09cypsK28qZixlWzNdPS1zKmYrbCpvLGVbNF09bCp1K2YqYSxlWzVdPWwqYS1mKnUsZX0sZi5zY2FsZT1mdW5jdGlvbihlLHQsbil7dmFyIHI9blswXSxpPW5bMV07cmV0dXJuIGVbMF09dFswXSpyLGVbMV09dFsxXSppLGVbMl09dFsyXSpyLGVbM109dFszXSppLGVbNF09dFs0XSpyLGVbNV09dFs1XSppLGV9LGYudHJhbnNsYXRlPWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZVswXT10WzBdLGVbMV09dFsxXSxlWzJdPXRbMl0sZVszXT10WzNdLGVbNF09dFs0XStuWzBdLGVbNV09dFs1XStuWzFdLGV9LGYuc3RyPWZ1bmN0aW9uKGUpe3JldHVyblwibWF0MmQoXCIrZVswXStcIiwgXCIrZVsxXStcIiwgXCIrZVsyXStcIiwgXCIrZVszXStcIiwgXCIrZVs0XStcIiwgXCIrZVs1XStcIilcIn0sdHlwZW9mIGUhPVwidW5kZWZpbmVkXCImJihlLm1hdDJkPWYpO3ZhciBsPXt9O2wuY3JlYXRlPWZ1bmN0aW9uKCl7dmFyIGU9bmV3IG4oOSk7cmV0dXJuIGVbMF09MSxlWzFdPTAsZVsyXT0wLGVbM109MCxlWzRdPTEsZVs1XT0wLGVbNl09MCxlWzddPTAsZVs4XT0xLGV9LGwuZnJvbU1hdDQ9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXT10WzBdLGVbMV09dFsxXSxlWzJdPXRbMl0sZVszXT10WzRdLGVbNF09dFs1XSxlWzVdPXRbNl0sZVs2XT10WzhdLGVbN109dFs5XSxlWzhdPXRbMTBdLGV9LGwuY2xvbmU9ZnVuY3Rpb24oZSl7dmFyIHQ9bmV3IG4oOSk7cmV0dXJuIHRbMF09ZVswXSx0WzFdPWVbMV0sdFsyXT1lWzJdLHRbM109ZVszXSx0WzRdPWVbNF0sdFs1XT1lWzVdLHRbNl09ZVs2XSx0WzddPWVbN10sdFs4XT1lWzhdLHR9LGwuY29weT1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdPXRbMF0sZVsxXT10WzFdLGVbMl09dFsyXSxlWzNdPXRbM10sZVs0XT10WzRdLGVbNV09dFs1XSxlWzZdPXRbNl0sZVs3XT10WzddLGVbOF09dFs4XSxlfSxsLmlkZW50aXR5PWZ1bmN0aW9uKGUpe3JldHVybiBlWzBdPTEsZVsxXT0wLGVbMl09MCxlWzNdPTAsZVs0XT0xLGVbNV09MCxlWzZdPTAsZVs3XT0wLGVbOF09MSxlfSxsLnRyYW5zcG9zZT1mdW5jdGlvbihlLHQpe2lmKGU9PT10KXt2YXIgbj10WzFdLHI9dFsyXSxpPXRbNV07ZVsxXT10WzNdLGVbMl09dFs2XSxlWzNdPW4sZVs1XT10WzddLGVbNl09cixlWzddPWl9ZWxzZSBlWzBdPXRbMF0sZVsxXT10WzNdLGVbMl09dFs2XSxlWzNdPXRbMV0sZVs0XT10WzRdLGVbNV09dFs3XSxlWzZdPXRbMl0sZVs3XT10WzVdLGVbOF09dFs4XTtyZXR1cm4gZX0sbC5pbnZlcnQ9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLHI9dFsxXSxpPXRbMl0scz10WzNdLG89dFs0XSx1PXRbNV0sYT10WzZdLGY9dFs3XSxsPXRbOF0sYz1sKm8tdSpmLGg9LWwqcyt1KmEscD1mKnMtbyphLGQ9bipjK3IqaCtpKnA7cmV0dXJuIGQ/KGQ9MS9kLGVbMF09YypkLGVbMV09KC1sKnIraSpmKSpkLGVbMl09KHUqci1pKm8pKmQsZVszXT1oKmQsZVs0XT0obCpuLWkqYSkqZCxlWzVdPSgtdSpuK2kqcykqZCxlWzZdPXAqZCxlWzddPSgtZipuK3IqYSkqZCxlWzhdPShvKm4tcipzKSpkLGUpOm51bGx9LGwuYWRqb2ludD1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0scj10WzFdLGk9dFsyXSxzPXRbM10sbz10WzRdLHU9dFs1XSxhPXRbNl0sZj10WzddLGw9dFs4XTtyZXR1cm4gZVswXT1vKmwtdSpmLGVbMV09aSpmLXIqbCxlWzJdPXIqdS1pKm8sZVszXT11KmEtcypsLGVbNF09bipsLWkqYSxlWzVdPWkqcy1uKnUsZVs2XT1zKmYtbyphLGVbN109ciphLW4qZixlWzhdPW4qby1yKnMsZX0sbC5kZXRlcm1pbmFudD1mdW5jdGlvbihlKXt2YXIgdD1lWzBdLG49ZVsxXSxyPWVbMl0saT1lWzNdLHM9ZVs0XSxvPWVbNV0sdT1lWzZdLGE9ZVs3XSxmPWVbOF07cmV0dXJuIHQqKGYqcy1vKmEpK24qKC1mKmkrbyp1KStyKihhKmktcyp1KX0sbC5tdWx0aXBseT1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXSx1PXRbNF0sYT10WzVdLGY9dFs2XSxsPXRbN10sYz10WzhdLGg9blswXSxwPW5bMV0sZD1uWzJdLHY9blszXSxtPW5bNF0sZz1uWzVdLHk9bls2XSxiPW5bN10sdz1uWzhdO3JldHVybiBlWzBdPWgqcitwKm8rZCpmLGVbMV09aCppK3AqdStkKmwsZVsyXT1oKnMrcCphK2QqYyxlWzNdPXYqcittKm8rZypmLGVbNF09dippK20qdStnKmwsZVs1XT12KnMrbSphK2cqYyxlWzZdPXkqcitiKm8rdypmLGVbN109eSppK2IqdSt3KmwsZVs4XT15KnMrYiphK3cqYyxlfSxsLm11bD1sLm11bHRpcGx5LGwudHJhbnNsYXRlPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz10WzNdLHU9dFs0XSxhPXRbNV0sZj10WzZdLGw9dFs3XSxjPXRbOF0saD1uWzBdLHA9blsxXTtyZXR1cm4gZVswXT1yLGVbMV09aSxlWzJdPXMsZVszXT1vLGVbNF09dSxlWzVdPWEsZVs2XT1oKnIrcCpvK2YsZVs3XT1oKmkrcCp1K2wsZVs4XT1oKnMrcCphK2MsZX0sbC5yb3RhdGU9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM10sdT10WzRdLGE9dFs1XSxmPXRbNl0sbD10WzddLGM9dFs4XSxoPU1hdGguc2luKG4pLHA9TWF0aC5jb3Mobik7cmV0dXJuIGVbMF09cCpyK2gqbyxlWzFdPXAqaStoKnUsZVsyXT1wKnMraCphLGVbM109cCpvLWgqcixlWzRdPXAqdS1oKmksZVs1XT1wKmEtaCpzLGVbNl09ZixlWzddPWwsZVs4XT1jLGV9LGwuc2NhbGU9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPW5bMF0saT1uWzFdO3JldHVybiBlWzBdPXIqdFswXSxlWzFdPXIqdFsxXSxlWzJdPXIqdFsyXSxlWzNdPWkqdFszXSxlWzRdPWkqdFs0XSxlWzVdPWkqdFs1XSxlWzZdPXRbNl0sZVs3XT10WzddLGVbOF09dFs4XSxlfSxsLmZyb21NYXQyZD1mdW5jdGlvbihlLHQpe3JldHVybiBlWzBdPXRbMF0sZVsxXT10WzFdLGVbMl09MCxlWzNdPXRbMl0sZVs0XT10WzNdLGVbNV09MCxlWzZdPXRbNF0sZVs3XT10WzVdLGVbOF09MSxlfSxsLmZyb21RdWF0PWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXSxyPXRbMV0saT10WzJdLHM9dFszXSxvPW4rbix1PXIrcixhPWkraSxmPW4qbyxsPW4qdSxjPW4qYSxoPXIqdSxwPXIqYSxkPWkqYSx2PXMqbyxtPXMqdSxnPXMqYTtyZXR1cm4gZVswXT0xLShoK2QpLGVbM109bCtnLGVbNl09Yy1tLGVbMV09bC1nLGVbNF09MS0oZitkKSxlWzddPXArdixlWzJdPWMrbSxlWzVdPXAtdixlWzhdPTEtKGYraCksZX0sbC5ub3JtYWxGcm9tTWF0ND1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0scj10WzFdLGk9dFsyXSxzPXRbM10sbz10WzRdLHU9dFs1XSxhPXRbNl0sZj10WzddLGw9dFs4XSxjPXRbOV0saD10WzEwXSxwPXRbMTFdLGQ9dFsxMl0sdj10WzEzXSxtPXRbMTRdLGc9dFsxNV0seT1uKnUtcipvLGI9biphLWkqbyx3PW4qZi1zKm8sRT1yKmEtaSp1LFM9cipmLXMqdSx4PWkqZi1zKmEsVD1sKnYtYypkLE49bCptLWgqZCxDPWwqZy1wKmQsaz1jKm0taCp2LEw9YypnLXAqdixBPWgqZy1wKm0sTz15KkEtYipMK3cqaytFKkMtUypOK3gqVDtyZXR1cm4gTz8oTz0xL08sZVswXT0odSpBLWEqTCtmKmspKk8sZVsxXT0oYSpDLW8qQS1mKk4pKk8sZVsyXT0obypMLXUqQytmKlQpKk8sZVszXT0oaSpMLXIqQS1zKmspKk8sZVs0XT0obipBLWkqQytzKk4pKk8sZVs1XT0ocipDLW4qTC1zKlQpKk8sZVs2XT0odip4LW0qUytnKkUpKk8sZVs3XT0obSp3LWQqeC1nKmIpKk8sZVs4XT0oZCpTLXYqdytnKnkpKk8sZSk6bnVsbH0sbC5zdHI9ZnVuY3Rpb24oZSl7cmV0dXJuXCJtYXQzKFwiK2VbMF0rXCIsIFwiK2VbMV0rXCIsIFwiK2VbMl0rXCIsIFwiK2VbM10rXCIsIFwiK2VbNF0rXCIsIFwiK2VbNV0rXCIsIFwiK2VbNl0rXCIsIFwiK2VbN10rXCIsIFwiK2VbOF0rXCIpXCJ9LHR5cGVvZiBlIT1cInVuZGVmaW5lZFwiJiYoZS5tYXQzPWwpO3ZhciBjPXt9O2MuY3JlYXRlPWZ1bmN0aW9uKCl7dmFyIGU9bmV3IG4oMTYpO3JldHVybiBlWzBdPTEsZVsxXT0wLGVbMl09MCxlWzNdPTAsZVs0XT0wLGVbNV09MSxlWzZdPTAsZVs3XT0wLGVbOF09MCxlWzldPTAsZVsxMF09MSxlWzExXT0wLGVbMTJdPTAsZVsxM109MCxlWzE0XT0wLGVbMTVdPTEsZX0sYy5jbG9uZT1mdW5jdGlvbihlKXt2YXIgdD1uZXcgbigxNik7cmV0dXJuIHRbMF09ZVswXSx0WzFdPWVbMV0sdFsyXT1lWzJdLHRbM109ZVszXSx0WzRdPWVbNF0sdFs1XT1lWzVdLHRbNl09ZVs2XSx0WzddPWVbN10sdFs4XT1lWzhdLHRbOV09ZVs5XSx0WzEwXT1lWzEwXSx0WzExXT1lWzExXSx0WzEyXT1lWzEyXSx0WzEzXT1lWzEzXSx0WzE0XT1lWzE0XSx0WzE1XT1lWzE1XSx0fSxjLmNvcHk9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXT10WzBdLGVbMV09dFsxXSxlWzJdPXRbMl0sZVszXT10WzNdLGVbNF09dFs0XSxlWzVdPXRbNV0sZVs2XT10WzZdLGVbN109dFs3XSxlWzhdPXRbOF0sZVs5XT10WzldLGVbMTBdPXRbMTBdLGVbMTFdPXRbMTFdLGVbMTJdPXRbMTJdLGVbMTNdPXRbMTNdLGVbMTRdPXRbMTRdLGVbMTVdPXRbMTVdLGV9LGMuaWRlbnRpdHk9ZnVuY3Rpb24oZSl7cmV0dXJuIGVbMF09MSxlWzFdPTAsZVsyXT0wLGVbM109MCxlWzRdPTAsZVs1XT0xLGVbNl09MCxlWzddPTAsZVs4XT0wLGVbOV09MCxlWzEwXT0xLGVbMTFdPTAsZVsxMl09MCxlWzEzXT0wLGVbMTRdPTAsZVsxNV09MSxlfSxjLnRyYW5zcG9zZT1mdW5jdGlvbihlLHQpe2lmKGU9PT10KXt2YXIgbj10WzFdLHI9dFsyXSxpPXRbM10scz10WzZdLG89dFs3XSx1PXRbMTFdO2VbMV09dFs0XSxlWzJdPXRbOF0sZVszXT10WzEyXSxlWzRdPW4sZVs2XT10WzldLGVbN109dFsxM10sZVs4XT1yLGVbOV09cyxlWzExXT10WzE0XSxlWzEyXT1pLGVbMTNdPW8sZVsxNF09dX1lbHNlIGVbMF09dFswXSxlWzFdPXRbNF0sZVsyXT10WzhdLGVbM109dFsxMl0sZVs0XT10WzFdLGVbNV09dFs1XSxlWzZdPXRbOV0sZVs3XT10WzEzXSxlWzhdPXRbMl0sZVs5XT10WzZdLGVbMTBdPXRbMTBdLGVbMTFdPXRbMTRdLGVbMTJdPXRbM10sZVsxM109dFs3XSxlWzE0XT10WzExXSxlWzE1XT10WzE1XTtyZXR1cm4gZX0sYy5pbnZlcnQ9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLHI9dFsxXSxpPXRbMl0scz10WzNdLG89dFs0XSx1PXRbNV0sYT10WzZdLGY9dFs3XSxsPXRbOF0sYz10WzldLGg9dFsxMF0scD10WzExXSxkPXRbMTJdLHY9dFsxM10sbT10WzE0XSxnPXRbMTVdLHk9bip1LXIqbyxiPW4qYS1pKm8sdz1uKmYtcypvLEU9ciphLWkqdSxTPXIqZi1zKnUseD1pKmYtcyphLFQ9bCp2LWMqZCxOPWwqbS1oKmQsQz1sKmctcCpkLGs9YyptLWgqdixMPWMqZy1wKnYsQT1oKmctcCptLE89eSpBLWIqTCt3KmsrRSpDLVMqTit4KlQ7cmV0dXJuIE8/KE89MS9PLGVbMF09KHUqQS1hKkwrZiprKSpPLGVbMV09KGkqTC1yKkEtcyprKSpPLGVbMl09KHYqeC1tKlMrZypFKSpPLGVbM109KGgqUy1jKngtcCpFKSpPLGVbNF09KGEqQy1vKkEtZipOKSpPLGVbNV09KG4qQS1pKkMrcypOKSpPLGVbNl09KG0qdy1kKngtZypiKSpPLGVbN109KGwqeC1oKncrcCpiKSpPLGVbOF09KG8qTC11KkMrZipUKSpPLGVbOV09KHIqQy1uKkwtcypUKSpPLGVbMTBdPShkKlMtdip3K2cqeSkqTyxlWzExXT0oYyp3LWwqUy1wKnkpKk8sZVsxMl09KHUqTi1vKmstYSpUKSpPLGVbMTNdPShuKmstcipOK2kqVCkqTyxlWzE0XT0odipiLWQqRS1tKnkpKk8sZVsxNV09KGwqRS1jKmIraCp5KSpPLGUpOm51bGx9LGMuYWRqb2ludD1mdW5jdGlvbihlLHQpe3ZhciBuPXRbMF0scj10WzFdLGk9dFsyXSxzPXRbM10sbz10WzRdLHU9dFs1XSxhPXRbNl0sZj10WzddLGw9dFs4XSxjPXRbOV0saD10WzEwXSxwPXRbMTFdLGQ9dFsxMl0sdj10WzEzXSxtPXRbMTRdLGc9dFsxNV07cmV0dXJuIGVbMF09dSooaCpnLXAqbSktYyooYSpnLWYqbSkrdiooYSpwLWYqaCksZVsxXT0tKHIqKGgqZy1wKm0pLWMqKGkqZy1zKm0pK3YqKGkqcC1zKmgpKSxlWzJdPXIqKGEqZy1mKm0pLXUqKGkqZy1zKm0pK3YqKGkqZi1zKmEpLGVbM109LShyKihhKnAtZipoKS11KihpKnAtcypoKStjKihpKmYtcyphKSksZVs0XT0tKG8qKGgqZy1wKm0pLWwqKGEqZy1mKm0pK2QqKGEqcC1mKmgpKSxlWzVdPW4qKGgqZy1wKm0pLWwqKGkqZy1zKm0pK2QqKGkqcC1zKmgpLGVbNl09LShuKihhKmctZiptKS1vKihpKmctcyptKStkKihpKmYtcyphKSksZVs3XT1uKihhKnAtZipoKS1vKihpKnAtcypoKStsKihpKmYtcyphKSxlWzhdPW8qKGMqZy1wKnYpLWwqKHUqZy1mKnYpK2QqKHUqcC1mKmMpLGVbOV09LShuKihjKmctcCp2KS1sKihyKmctcyp2KStkKihyKnAtcypjKSksZVsxMF09bioodSpnLWYqdiktbyoocipnLXMqdikrZCoocipmLXMqdSksZVsxMV09LShuKih1KnAtZipjKS1vKihyKnAtcypjKStsKihyKmYtcyp1KSksZVsxMl09LShvKihjKm0taCp2KS1sKih1Km0tYSp2KStkKih1KmgtYSpjKSksZVsxM109biooYyptLWgqdiktbCoociptLWkqdikrZCoocipoLWkqYyksZVsxNF09LShuKih1Km0tYSp2KS1vKihyKm0taSp2KStkKihyKmEtaSp1KSksZVsxNV09bioodSpoLWEqYyktbyoocipoLWkqYykrbCoociphLWkqdSksZX0sYy5kZXRlcm1pbmFudD1mdW5jdGlvbihlKXt2YXIgdD1lWzBdLG49ZVsxXSxyPWVbMl0saT1lWzNdLHM9ZVs0XSxvPWVbNV0sdT1lWzZdLGE9ZVs3XSxmPWVbOF0sbD1lWzldLGM9ZVsxMF0saD1lWzExXSxwPWVbMTJdLGQ9ZVsxM10sdj1lWzE0XSxtPWVbMTVdLGc9dCpvLW4qcyx5PXQqdS1yKnMsYj10KmEtaSpzLHc9bip1LXIqbyxFPW4qYS1pKm8sUz1yKmEtaSp1LHg9ZipkLWwqcCxUPWYqdi1jKnAsTj1mKm0taCpwLEM9bCp2LWMqZCxrPWwqbS1oKmQsTD1jKm0taCp2O3JldHVybiBnKkwteSprK2IqQyt3Kk4tRSpUK1MqeH0sYy5tdWx0aXBseT1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXSx1PXRbNF0sYT10WzVdLGY9dFs2XSxsPXRbN10sYz10WzhdLGg9dFs5XSxwPXRbMTBdLGQ9dFsxMV0sdj10WzEyXSxtPXRbMTNdLGc9dFsxNF0seT10WzE1XSxiPW5bMF0sdz1uWzFdLEU9blsyXSxTPW5bM107cmV0dXJuIGVbMF09YipyK3cqdStFKmMrUyp2LGVbMV09YippK3cqYStFKmgrUyptLGVbMl09YipzK3cqZitFKnArUypnLGVbM109YipvK3cqbCtFKmQrUyp5LGI9bls0XSx3PW5bNV0sRT1uWzZdLFM9bls3XSxlWzRdPWIqcit3KnUrRSpjK1MqdixlWzVdPWIqaSt3KmErRSpoK1MqbSxlWzZdPWIqcyt3KmYrRSpwK1MqZyxlWzddPWIqbyt3KmwrRSpkK1MqeSxiPW5bOF0sdz1uWzldLEU9blsxMF0sUz1uWzExXSxlWzhdPWIqcit3KnUrRSpjK1MqdixlWzldPWIqaSt3KmErRSpoK1MqbSxlWzEwXT1iKnMrdypmK0UqcCtTKmcsZVsxMV09YipvK3cqbCtFKmQrUyp5LGI9blsxMl0sdz1uWzEzXSxFPW5bMTRdLFM9blsxNV0sZVsxMl09YipyK3cqdStFKmMrUyp2LGVbMTNdPWIqaSt3KmErRSpoK1MqbSxlWzE0XT1iKnMrdypmK0UqcCtTKmcsZVsxNV09YipvK3cqbCtFKmQrUyp5LGV9LGMubXVsPWMubXVsdGlwbHksYy50cmFuc2xhdGU9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPW5bMF0saT1uWzFdLHM9blsyXSxvLHUsYSxmLGwsYyxoLHAsZCx2LG0sZztyZXR1cm4gdD09PWU/KGVbMTJdPXRbMF0qcit0WzRdKmkrdFs4XSpzK3RbMTJdLGVbMTNdPXRbMV0qcit0WzVdKmkrdFs5XSpzK3RbMTNdLGVbMTRdPXRbMl0qcit0WzZdKmkrdFsxMF0qcyt0WzE0XSxlWzE1XT10WzNdKnIrdFs3XSppK3RbMTFdKnMrdFsxNV0pOihvPXRbMF0sdT10WzFdLGE9dFsyXSxmPXRbM10sbD10WzRdLGM9dFs1XSxoPXRbNl0scD10WzddLGQ9dFs4XSx2PXRbOV0sbT10WzEwXSxnPXRbMTFdLGVbMF09byxlWzFdPXUsZVsyXT1hLGVbM109ZixlWzRdPWwsZVs1XT1jLGVbNl09aCxlWzddPXAsZVs4XT1kLGVbOV09dixlWzEwXT1tLGVbMTFdPWcsZVsxMl09bypyK2wqaStkKnMrdFsxMl0sZVsxM109dSpyK2MqaSt2KnMrdFsxM10sZVsxNF09YSpyK2gqaSttKnMrdFsxNF0sZVsxNV09ZipyK3AqaStnKnMrdFsxNV0pLGV9LGMuc2NhbGU9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPW5bMF0saT1uWzFdLHM9blsyXTtyZXR1cm4gZVswXT10WzBdKnIsZVsxXT10WzFdKnIsZVsyXT10WzJdKnIsZVszXT10WzNdKnIsZVs0XT10WzRdKmksZVs1XT10WzVdKmksZVs2XT10WzZdKmksZVs3XT10WzddKmksZVs4XT10WzhdKnMsZVs5XT10WzldKnMsZVsxMF09dFsxMF0qcyxlWzExXT10WzExXSpzLGVbMTJdPXRbMTJdLGVbMTNdPXRbMTNdLGVbMTRdPXRbMTRdLGVbMTVdPXRbMTVdLGV9LGMucm90YXRlPWZ1bmN0aW9uKGUsbixyLGkpe3ZhciBzPWlbMF0sbz1pWzFdLHU9aVsyXSxhPU1hdGguc3FydChzKnMrbypvK3UqdSksZixsLGMsaCxwLGQsdixtLGcseSxiLHcsRSxTLHgsVCxOLEMsayxMLEEsTyxNLF87cmV0dXJuIE1hdGguYWJzKGEpPHQ/bnVsbDooYT0xL2Escyo9YSxvKj1hLHUqPWEsZj1NYXRoLnNpbihyKSxsPU1hdGguY29zKHIpLGM9MS1sLGg9blswXSxwPW5bMV0sZD1uWzJdLHY9blszXSxtPW5bNF0sZz1uWzVdLHk9bls2XSxiPW5bN10sdz1uWzhdLEU9bls5XSxTPW5bMTBdLHg9blsxMV0sVD1zKnMqYytsLE49bypzKmMrdSpmLEM9dSpzKmMtbypmLGs9cypvKmMtdSpmLEw9bypvKmMrbCxBPXUqbypjK3MqZixPPXMqdSpjK28qZixNPW8qdSpjLXMqZixfPXUqdSpjK2wsZVswXT1oKlQrbSpOK3cqQyxlWzFdPXAqVCtnKk4rRSpDLGVbMl09ZCpUK3kqTitTKkMsZVszXT12KlQrYipOK3gqQyxlWzRdPWgqayttKkwrdypBLGVbNV09cCprK2cqTCtFKkEsZVs2XT1kKmsreSpMK1MqQSxlWzddPXYqaytiKkwreCpBLGVbOF09aCpPK20qTSt3Kl8sZVs5XT1wKk8rZypNK0UqXyxlWzEwXT1kKk8reSpNK1MqXyxlWzExXT12Kk8rYipNK3gqXyxuIT09ZSYmKGVbMTJdPW5bMTJdLGVbMTNdPW5bMTNdLGVbMTRdPW5bMTRdLGVbMTVdPW5bMTVdKSxlKX0sYy5yb3RhdGVYPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj1NYXRoLnNpbihuKSxpPU1hdGguY29zKG4pLHM9dFs0XSxvPXRbNV0sdT10WzZdLGE9dFs3XSxmPXRbOF0sbD10WzldLGM9dFsxMF0saD10WzExXTtyZXR1cm4gdCE9PWUmJihlWzBdPXRbMF0sZVsxXT10WzFdLGVbMl09dFsyXSxlWzNdPXRbM10sZVsxMl09dFsxMl0sZVsxM109dFsxM10sZVsxNF09dFsxNF0sZVsxNV09dFsxNV0pLGVbNF09cyppK2YqcixlWzVdPW8qaStsKnIsZVs2XT11KmkrYypyLGVbN109YSppK2gqcixlWzhdPWYqaS1zKnIsZVs5XT1sKmktbypyLGVbMTBdPWMqaS11KnIsZVsxMV09aCppLWEqcixlfSxjLnJvdGF0ZVk9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPU1hdGguc2luKG4pLGk9TWF0aC5jb3Mobikscz10WzBdLG89dFsxXSx1PXRbMl0sYT10WzNdLGY9dFs4XSxsPXRbOV0sYz10WzEwXSxoPXRbMTFdO3JldHVybiB0IT09ZSYmKGVbNF09dFs0XSxlWzVdPXRbNV0sZVs2XT10WzZdLGVbN109dFs3XSxlWzEyXT10WzEyXSxlWzEzXT10WzEzXSxlWzE0XT10WzE0XSxlWzE1XT10WzE1XSksZVswXT1zKmktZipyLGVbMV09byppLWwqcixlWzJdPXUqaS1jKnIsZVszXT1hKmktaCpyLGVbOF09cypyK2YqaSxlWzldPW8qcitsKmksZVsxMF09dSpyK2MqaSxlWzExXT1hKnIraCppLGV9LGMucm90YXRlWj1mdW5jdGlvbihlLHQsbil7dmFyIHI9TWF0aC5zaW4obiksaT1NYXRoLmNvcyhuKSxzPXRbMF0sbz10WzFdLHU9dFsyXSxhPXRbM10sZj10WzRdLGw9dFs1XSxjPXRbNl0saD10WzddO3JldHVybiB0IT09ZSYmKGVbOF09dFs4XSxlWzldPXRbOV0sZVsxMF09dFsxMF0sZVsxMV09dFsxMV0sZVsxMl09dFsxMl0sZVsxM109dFsxM10sZVsxNF09dFsxNF0sZVsxNV09dFsxNV0pLGVbMF09cyppK2YqcixlWzFdPW8qaStsKnIsZVsyXT11KmkrYypyLGVbM109YSppK2gqcixlWzRdPWYqaS1zKnIsZVs1XT1sKmktbypyLGVbNl09YyppLXUqcixlWzddPWgqaS1hKnIsZX0sYy5mcm9tUm90YXRpb25UcmFuc2xhdGlvbj1mdW5jdGlvbihlLHQsbil7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXSx1PXIrcixhPWkraSxmPXMrcyxsPXIqdSxjPXIqYSxoPXIqZixwPWkqYSxkPWkqZix2PXMqZixtPW8qdSxnPW8qYSx5PW8qZjtyZXR1cm4gZVswXT0xLShwK3YpLGVbMV09Yyt5LGVbMl09aC1nLGVbM109MCxlWzRdPWMteSxlWzVdPTEtKGwrdiksZVs2XT1kK20sZVs3XT0wLGVbOF09aCtnLGVbOV09ZC1tLGVbMTBdPTEtKGwrcCksZVsxMV09MCxlWzEyXT1uWzBdLGVbMTNdPW5bMV0sZVsxNF09blsyXSxlWzE1XT0xLGV9LGMuZnJvbVF1YXQ9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLHI9dFsxXSxpPXRbMl0scz10WzNdLG89bituLHU9cityLGE9aStpLGY9bipvLGw9bip1LGM9biphLGg9cip1LHA9ciphLGQ9aSphLHY9cypvLG09cyp1LGc9cyphO3JldHVybiBlWzBdPTEtKGgrZCksZVsxXT1sK2csZVsyXT1jLW0sZVszXT0wLGVbNF09bC1nLGVbNV09MS0oZitkKSxlWzZdPXArdixlWzddPTAsZVs4XT1jK20sZVs5XT1wLXYsZVsxMF09MS0oZitoKSxlWzExXT0wLGVbMTJdPTAsZVsxM109MCxlWzE0XT0wLGVbMTVdPTEsZX0sYy5mcnVzdHVtPWZ1bmN0aW9uKGUsdCxuLHIsaSxzLG8pe3ZhciB1PTEvKG4tdCksYT0xLyhpLXIpLGY9MS8ocy1vKTtyZXR1cm4gZVswXT1zKjIqdSxlWzFdPTAsZVsyXT0wLGVbM109MCxlWzRdPTAsZVs1XT1zKjIqYSxlWzZdPTAsZVs3XT0wLGVbOF09KG4rdCkqdSxlWzldPShpK3IpKmEsZVsxMF09KG8rcykqZixlWzExXT0tMSxlWzEyXT0wLGVbMTNdPTAsZVsxNF09bypzKjIqZixlWzE1XT0wLGV9LGMucGVyc3BlY3RpdmU9ZnVuY3Rpb24oZSx0LG4scixpKXt2YXIgcz0xL01hdGgudGFuKHQvMiksbz0xLyhyLWkpO3JldHVybiBlWzBdPXMvbixlWzFdPTAsZVsyXT0wLGVbM109MCxlWzRdPTAsZVs1XT1zLGVbNl09MCxlWzddPTAsZVs4XT0wLGVbOV09MCxlWzEwXT0oaStyKSpvLGVbMTFdPS0xLGVbMTJdPTAsZVsxM109MCxlWzE0XT0yKmkqcipvLGVbMTVdPTAsZX0sYy5vcnRobz1mdW5jdGlvbihlLHQsbixyLGkscyxvKXt2YXIgdT0xLyh0LW4pLGE9MS8oci1pKSxmPTEvKHMtbyk7cmV0dXJuIGVbMF09LTIqdSxlWzFdPTAsZVsyXT0wLGVbM109MCxlWzRdPTAsZVs1XT0tMiphLGVbNl09MCxlWzddPTAsZVs4XT0wLGVbOV09MCxlWzEwXT0yKmYsZVsxMV09MCxlWzEyXT0odCtuKSp1LGVbMTNdPShpK3IpKmEsZVsxNF09KG8rcykqZixlWzE1XT0xLGV9LGMubG9va0F0PWZ1bmN0aW9uKGUsbixyLGkpe3ZhciBzLG8sdSxhLGYsbCxoLHAsZCx2LG09blswXSxnPW5bMV0seT1uWzJdLGI9aVswXSx3PWlbMV0sRT1pWzJdLFM9clswXSx4PXJbMV0sVD1yWzJdO3JldHVybiBNYXRoLmFicyhtLVMpPHQmJk1hdGguYWJzKGcteCk8dCYmTWF0aC5hYnMoeS1UKTx0P2MuaWRlbnRpdHkoZSk6KGg9bS1TLHA9Zy14LGQ9eS1ULHY9MS9NYXRoLnNxcnQoaCpoK3AqcCtkKmQpLGgqPXYscCo9dixkKj12LHM9dypkLUUqcCxvPUUqaC1iKmQsdT1iKnAtdypoLHY9TWF0aC5zcXJ0KHMqcytvKm8rdSp1KSx2Pyh2PTEvdixzKj12LG8qPXYsdSo9dik6KHM9MCxvPTAsdT0wKSxhPXAqdS1kKm8sZj1kKnMtaCp1LGw9aCpvLXAqcyx2PU1hdGguc3FydChhKmErZipmK2wqbCksdj8odj0xL3YsYSo9dixmKj12LGwqPXYpOihhPTAsZj0wLGw9MCksZVswXT1zLGVbMV09YSxlWzJdPWgsZVszXT0wLGVbNF09byxlWzVdPWYsZVs2XT1wLGVbN109MCxlWzhdPXUsZVs5XT1sLGVbMTBdPWQsZVsxMV09MCxlWzEyXT0tKHMqbStvKmcrdSp5KSxlWzEzXT0tKGEqbStmKmcrbCp5KSxlWzE0XT0tKGgqbStwKmcrZCp5KSxlWzE1XT0xLGUpfSxjLnN0cj1mdW5jdGlvbihlKXtyZXR1cm5cIm1hdDQoXCIrZVswXStcIiwgXCIrZVsxXStcIiwgXCIrZVsyXStcIiwgXCIrZVszXStcIiwgXCIrZVs0XStcIiwgXCIrZVs1XStcIiwgXCIrZVs2XStcIiwgXCIrZVs3XStcIiwgXCIrZVs4XStcIiwgXCIrZVs5XStcIiwgXCIrZVsxMF0rXCIsIFwiK2VbMTFdK1wiLCBcIitlWzEyXStcIiwgXCIrZVsxM10rXCIsIFwiK2VbMTRdK1wiLCBcIitlWzE1XStcIilcIn0sdHlwZW9mIGUhPVwidW5kZWZpbmVkXCImJihlLm1hdDQ9Yyk7dmFyIGg9e307aC5jcmVhdGU9ZnVuY3Rpb24oKXt2YXIgZT1uZXcgbig0KTtyZXR1cm4gZVswXT0wLGVbMV09MCxlWzJdPTAsZVszXT0xLGV9LGgucm90YXRpb25Ubz1mdW5jdGlvbigpe3ZhciBlPW8uY3JlYXRlKCksdD1vLmZyb21WYWx1ZXMoMSwwLDApLG49by5mcm9tVmFsdWVzKDAsMSwwKTtyZXR1cm4gZnVuY3Rpb24ocixpLHMpe3ZhciB1PW8uZG90KGkscyk7cmV0dXJuIHU8LTAuOTk5OTk5PyhvLmNyb3NzKGUsdCxpKSxvLmxlbmd0aChlKTwxZS02JiZvLmNyb3NzKGUsbixpKSxvLm5vcm1hbGl6ZShlLGUpLGguc2V0QXhpc0FuZ2xlKHIsZSxNYXRoLlBJKSxyKTp1Pi45OTk5OTk/KHJbMF09MCxyWzFdPTAsclsyXT0wLHJbM109MSxyKTooby5jcm9zcyhlLGkscyksclswXT1lWzBdLHJbMV09ZVsxXSxyWzJdPWVbMl0sclszXT0xK3UsaC5ub3JtYWxpemUocixyKSl9fSgpLGguc2V0QXhlcz1mdW5jdGlvbigpe3ZhciBlPWwuY3JlYXRlKCk7cmV0dXJuIGZ1bmN0aW9uKHQsbixyLGkpe3JldHVybiBlWzBdPXJbMF0sZVszXT1yWzFdLGVbNl09clsyXSxlWzFdPWlbMF0sZVs0XT1pWzFdLGVbN109aVsyXSxlWzJdPW5bMF0sZVs1XT1uWzFdLGVbOF09blsyXSxoLm5vcm1hbGl6ZSh0LGguZnJvbU1hdDModCxlKSl9fSgpLGguY2xvbmU9dS5jbG9uZSxoLmZyb21WYWx1ZXM9dS5mcm9tVmFsdWVzLGguY29weT11LmNvcHksaC5zZXQ9dS5zZXQsaC5pZGVudGl0eT1mdW5jdGlvbihlKXtyZXR1cm4gZVswXT0wLGVbMV09MCxlWzJdPTAsZVszXT0xLGV9LGguc2V0QXhpc0FuZ2xlPWZ1bmN0aW9uKGUsdCxuKXtuKj0uNTt2YXIgcj1NYXRoLnNpbihuKTtyZXR1cm4gZVswXT1yKnRbMF0sZVsxXT1yKnRbMV0sZVsyXT1yKnRbMl0sZVszXT1NYXRoLmNvcyhuKSxlfSxoLmFkZD11LmFkZCxoLm11bHRpcGx5PWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz10WzNdLHU9blswXSxhPW5bMV0sZj1uWzJdLGw9blszXTtyZXR1cm4gZVswXT1yKmwrbyp1K2kqZi1zKmEsZVsxXT1pKmwrbyphK3MqdS1yKmYsZVsyXT1zKmwrbypmK3IqYS1pKnUsZVszXT1vKmwtcip1LWkqYS1zKmYsZX0saC5tdWw9aC5tdWx0aXBseSxoLnNjYWxlPXUuc2NhbGUsaC5yb3RhdGVYPWZ1bmN0aW9uKGUsdCxuKXtuKj0uNTt2YXIgcj10WzBdLGk9dFsxXSxzPXRbMl0sbz10WzNdLHU9TWF0aC5zaW4obiksYT1NYXRoLmNvcyhuKTtyZXR1cm4gZVswXT1yKmErbyp1LGVbMV09aSphK3MqdSxlWzJdPXMqYS1pKnUsZVszXT1vKmEtcip1LGV9LGgucm90YXRlWT1mdW5jdGlvbihlLHQsbil7bio9LjU7dmFyIHI9dFswXSxpPXRbMV0scz10WzJdLG89dFszXSx1PU1hdGguc2luKG4pLGE9TWF0aC5jb3Mobik7cmV0dXJuIGVbMF09ciphLXMqdSxlWzFdPWkqYStvKnUsZVsyXT1zKmErcip1LGVbM109byphLWkqdSxlfSxoLnJvdGF0ZVo9ZnVuY3Rpb24oZSx0LG4pe24qPS41O3ZhciByPXRbMF0saT10WzFdLHM9dFsyXSxvPXRbM10sdT1NYXRoLnNpbihuKSxhPU1hdGguY29zKG4pO3JldHVybiBlWzBdPXIqYStpKnUsZVsxXT1pKmEtcip1LGVbMl09cyphK28qdSxlWzNdPW8qYS1zKnUsZX0saC5jYWxjdWxhdGVXPWZ1bmN0aW9uKGUsdCl7dmFyIG49dFswXSxyPXRbMV0saT10WzJdO3JldHVybiBlWzBdPW4sZVsxXT1yLGVbMl09aSxlWzNdPS1NYXRoLnNxcnQoTWF0aC5hYnMoMS1uKm4tcipyLWkqaSkpLGV9LGguZG90PXUuZG90LGgubGVycD11LmxlcnAsaC5zbGVycD1mdW5jdGlvbihlLHQsbixyKXt2YXIgaT10WzBdLHM9dFsxXSxvPXRbMl0sdT10WzNdLGE9blswXSxmPW5bMV0sbD1uWzJdLGM9blszXSxoLHAsZCx2LG07cmV0dXJuIHA9aSphK3MqZitvKmwrdSpjLHA8MCYmKHA9LXAsYT0tYSxmPS1mLGw9LWwsYz0tYyksMS1wPjFlLTY/KGg9TWF0aC5hY29zKHApLGQ9TWF0aC5zaW4oaCksdj1NYXRoLnNpbigoMS1yKSpoKS9kLG09TWF0aC5zaW4ocipoKS9kKToodj0xLXIsbT1yKSxlWzBdPXYqaSttKmEsZVsxXT12KnMrbSpmLGVbMl09dipvK20qbCxlWzNdPXYqdSttKmMsZX0saC5pbnZlcnQ9ZnVuY3Rpb24oZSx0KXt2YXIgbj10WzBdLHI9dFsxXSxpPXRbMl0scz10WzNdLG89bipuK3IqcitpKmkrcypzLHU9bz8xL286MDtyZXR1cm4gZVswXT0tbip1LGVbMV09LXIqdSxlWzJdPS1pKnUsZVszXT1zKnUsZX0saC5jb25qdWdhdGU9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZVswXT0tdFswXSxlWzFdPS10WzFdLGVbMl09LXRbMl0sZVszXT10WzNdLGV9LGgubGVuZ3RoPXUubGVuZ3RoLGgubGVuPWgubGVuZ3RoLGguc3F1YXJlZExlbmd0aD11LnNxdWFyZWRMZW5ndGgsaC5zcXJMZW49aC5zcXVhcmVkTGVuZ3RoLGgubm9ybWFsaXplPXUubm9ybWFsaXplLGguZnJvbU1hdDM9ZnVuY3Rpb24oKXt2YXIgZT10eXBlb2YgSW50OEFycmF5IT1cInVuZGVmaW5lZFwiP25ldyBJbnQ4QXJyYXkoWzEsMiwwXSk6WzEsMiwwXTtyZXR1cm4gZnVuY3Rpb24odCxuKXt2YXIgcj1uWzBdK25bNF0rbls4XSxpO2lmKHI+MClpPU1hdGguc3FydChyKzEpLHRbM109LjUqaSxpPS41L2ksdFswXT0obls3XS1uWzVdKSppLHRbMV09KG5bMl0tbls2XSkqaSx0WzJdPShuWzNdLW5bMV0pKmk7ZWxzZXt2YXIgcz0wO25bNF0+blswXSYmKHM9MSksbls4XT5uW3MqMytzXSYmKHM9Mik7dmFyIG89ZVtzXSx1PWVbb107aT1NYXRoLnNxcnQobltzKjMrc10tbltvKjMrb10tblt1KjMrdV0rMSksdFtzXT0uNSppLGk9LjUvaSx0WzNdPShuW3UqMytvXS1uW28qMyt1XSkqaSx0W29dPShuW28qMytzXStuW3MqMytvXSkqaSx0W3VdPShuW3UqMytzXStuW3MqMyt1XSkqaX1yZXR1cm4gdH19KCksaC5zdHI9ZnVuY3Rpb24oZSl7cmV0dXJuXCJxdWF0KFwiK2VbMF0rXCIsIFwiK2VbMV0rXCIsIFwiK2VbMl0rXCIsIFwiK2VbM10rXCIpXCJ9LHR5cGVvZiBlIT1cInVuZGVmaW5lZFwiJiYoZS5xdWF0PWgpfSh0LmV4cG9ydHMpfSkodGhpcyk7XG4iLCIvKlxuXHRnbFNoYWRlclxuXHRDb3B5cmlnaHQgKGMpIDIwMTMsIE5lcnZvdXMgU3lzdGVtLCBpbmMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG5cdFxuXHRSZWRpc3RyaWJ1dGlvbiBhbmQgdXNlIGluIHNvdXJjZSBhbmQgYmluYXJ5IGZvcm1zLCB3aXRoIG9yIHdpdGhvdXQgbW9kaWZpY2F0aW9uLFxuYXJlIHBlcm1pdHRlZCBwcm92aWRlZCB0aGF0IHRoZSBmb2xsb3dpbmcgY29uZGl0aW9ucyBhcmUgbWV0OlxuXG4gICogUmVkaXN0cmlidXRpb25zIG9mIHNvdXJjZSBjb2RlIG11c3QgcmV0YWluIHRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlLCB0aGlzXG4gICAgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIuXG4gICogUmVkaXN0cmlidXRpb25zIGluIGJpbmFyeSBmb3JtIG11c3QgcmVwcm9kdWNlIHRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlLFxuICAgIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIgaW4gdGhlIGRvY3VtZW50YXRpb24gXG4gICAgYW5kL29yIG90aGVyIG1hdGVyaWFscyBwcm92aWRlZCB3aXRoIHRoZSBkaXN0cmlidXRpb24uXG5cblRISVMgU09GVFdBUkUgSVMgUFJPVklERUQgQlkgVEhFIENPUFlSSUdIVCBIT0xERVJTIEFORCBDT05UUklCVVRPUlMgXCJBUyBJU1wiIEFORFxuQU5ZIEVYUFJFU1MgT1IgSU1QTElFRCBXQVJSQU5USUVTLCBJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgVEhFIElNUExJRURcbldBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZIEFORCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBUkUgXG5ESVNDTEFJTUVELiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQ09QWVJJR0hUIEhPTERFUiBPUiBDT05UUklCVVRPUlMgQkUgTElBQkxFIEZPUlxuQU5ZIERJUkVDVCwgSU5ESVJFQ1QsIElOQ0lERU5UQUwsIFNQRUNJQUwsIEVYRU1QTEFSWSwgT1IgQ09OU0VRVUVOVElBTCBEQU1BR0VTXG4oSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFBST0NVUkVNRU5UIE9GIFNVQlNUSVRVVEUgR09PRFMgT1IgU0VSVklDRVM7XG5MT1NTIE9GIFVTRSwgREFUQSwgT1IgUFJPRklUUzsgT1IgQlVTSU5FU1MgSU5URVJSVVBUSU9OKSBIT1dFVkVSIENBVVNFRCBBTkQgT05cbkFOWSBUSEVPUlkgT0YgTElBQklMSVRZLCBXSEVUSEVSIElOIENPTlRSQUNULCBTVFJJQ1QgTElBQklMSVRZLCBPUiBUT1JUXG4oSU5DTFVESU5HIE5FR0xJR0VOQ0UgT1IgT1RIRVJXSVNFKSBBUklTSU5HIElOIEFOWSBXQVkgT1VUIE9GIFRIRSBVU0UgT0YgVEhJU1xuU09GVFdBUkUsIEVWRU4gSUYgQURWSVNFRCBPRiBUSEUgUE9TU0lCSUxJVFkgT0YgU1VDSCBEQU1BR0UuXG5cblx0dXNlcyBzb21lIGlkZWFzIChhbmQgY29kZSkgZnJvbSBnbC1zaGFkZXIgaHR0cHM6Ly9naXRodWIuY29tL21pa29sYWx5c2Vua28vZ2wtc2hhZGVyXG5cdGhvd2V2ZXIgc29tZSBkaWZmZXJlbmNlcyBpbmNsdWRlIHNhdmluZyB1bmlmb3JtIGxvY2F0aW9ucyBhbmQgcXVlcnlpbmcgZ2wgdG8gZ2V0IHVuaWZvcm1zIGFuZCBhdHRyaWJzIGluc3RlYWQgb2YgcGFyc2luZyBmaWxlcyBhbmQgdXNlcyBub3JtYWwgc3ludGF4IGluc3RlYWQgb2YgZmFrZSBvcGVyYXRvciBvdmVybG9hZGluZyB3aGljaCBpcyBhIGNvbmZ1c2luZyBwYXR0ZXJuIGluIEphdmFzY3JpcHQuXG4qL1xuKGZ1bmN0aW9uKF9nbG9iYWwpIHtcbiAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgdmFyIHNoaW0gPSB7fTtcbiAgaWYgKHR5cGVvZihleHBvcnRzKSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZih0eXBlb2YgZGVmaW5lID09ICdmdW5jdGlvbicgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT0gJ29iamVjdCcgJiYgZGVmaW5lLmFtZCkge1xuICAgICAgc2hpbS5leHBvcnRzID0ge307XG4gICAgICBkZWZpbmUoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBzaGltLmV4cG9ydHM7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy90aGlzIHRoaW5nIGxpdmVzIGluIGEgYnJvd3NlciwgZGVmaW5lIGl0cyBuYW1lc3BhY2VzIGluIGdsb2JhbFxuICAgICAgc2hpbS5leHBvcnRzID0gdHlwZW9mKHdpbmRvdykgIT09ICd1bmRlZmluZWQnID8gd2luZG93IDogX2dsb2JhbDtcbiAgICB9XG4gIH1cbiAgZWxzZSB7XG4gICAgLy90aGlzIHRoaW5nIGxpdmVzIGluIGNvbW1vbmpzLCBkZWZpbmUgaXRzIG5hbWVzcGFjZXMgaW4gZXhwb3J0c1xuICAgIHNoaW0uZXhwb3J0cyA9IGV4cG9ydHM7XG4gIH1cbiAgKGZ1bmN0aW9uKGV4cG9ydHMpIHtcblxuXG4gIHZhciBnbDtcbiAgZnVuY3Rpb24gU2hhZGVyKGdsLCBwcm9nKSB7XG4gICAgdGhpcy5nbCA9IGdsO1xuICAgIHRoaXMucHJvZ3JhbSA9IHByb2c7XG4gICAgdGhpcy51bmlmb3JtcyA9IHt9O1xuICAgIHRoaXMuYXR0cmlicyA9IHt9O1xuICAgIHRoaXMuaXNSZWFkeSA9IGZhbHNlO1xuICB9XG5cbiAgU2hhZGVyLnByb3RvdHlwZS5iZWdpbiA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuZ2wudXNlUHJvZ3JhbSh0aGlzLnByb2dyYW0pO1xuICAgIHRoaXMuZW5hYmxlQXR0cmlicygpO1xuICB9XG5cbiAgU2hhZGVyLnByb3RvdHlwZS5lbmQgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmRpc2FibGVBdHRyaWJzKCk7XG4gIH1cblxuICBTaGFkZXIucHJvdG90eXBlLmVuYWJsZUF0dHJpYnMgPSBmdW5jdGlvbigpIHtcbiAgICBmb3IodmFyIGF0dHJpYiBpbiB0aGlzLmF0dHJpYnMpIHtcbiAgICB0aGlzLmF0dHJpYnNbYXR0cmliXS5lbmFibGUoKTtcbiAgICB9XG4gIH1cbiAgU2hhZGVyLnByb3RvdHlwZS5kaXNhYmxlQXR0cmlicyA9IGZ1bmN0aW9uKCkge1xuICAgIGZvcih2YXIgYXR0cmliIGluIHRoaXMuYXR0cmlicykge1xuICAgIHRoaXMuYXR0cmlic1thdHRyaWJdLmRpc2FibGUoKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBtYWtlVmVjdG9yVW5pZm9ybShnbCwgc2hhZGVyLCBsb2NhdGlvbiwgb2JqLCB0eXBlLCBkLCBuYW1lKSB7XG4gICAgdmFyIHVuaWZvcm1PYmogPSB7fTtcbiAgICB1bmlmb3JtT2JqLmxvY2F0aW9uID0gbG9jYXRpb247XG4gICAgaWYoZCA+IDEpIHtcbiAgICAgIHR5cGUgKz0gXCJ2XCI7XG4gICAgfVxuICAgIHZhciBzZXR0ZXIgPSBuZXcgRnVuY3Rpb24oXCJnbFwiLCBcInByb2dcIiwgXCJsb2NcIiwgXCJ2XCIsIFwiZ2wudW5pZm9ybVwiICsgZCArIHR5cGUgKyBcIihsb2MsIHYpXCIpO1xuICAgIHVuaWZvcm1PYmouc2V0ID0gc2V0dGVyLmJpbmQodW5kZWZpbmVkLCBnbCwgc2hhZGVyLnByb2dyYW0sbG9jYXRpb24pO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIG5hbWUsIHtcbiAgICAgIHZhbHVlOnVuaWZvcm1PYmosXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBtYWtlTWF0cml4VW5pZm9ybShnbCwgc2hhZGVyLCBsb2NhdGlvbiwgb2JqLCBkLCBuYW1lKSB7XG4gICAgdmFyIHVuaWZvcm1PYmogPSB7fTtcbiAgICB1bmlmb3JtT2JqLmxvY2F0aW9uID0gbG9jYXRpb247XG4gICAgdmFyIHNldHRlciA9IG5ldyBGdW5jdGlvbihcImdsXCIsIFwicHJvZ1wiLCBcImxvY1wiLFwidlwiLCBcImdsLnVuaWZvcm1NYXRyaXhcIiArIGQgKyBcImZ2KGxvYywgZmFsc2UsIHYpXCIpO1xuICAgIHVuaWZvcm1PYmouc2V0ID0gc2V0dGVyLmJpbmQodW5kZWZpbmVkLCBnbCwgc2hhZGVyLnByb2dyYW0sbG9jYXRpb24pO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIG5hbWUsIHtcbiAgICAgIHZhbHVlOnVuaWZvcm1PYmosXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBtYWtlVmVjdG9yQXR0cmliKGdsLCBzaGFkZXIsIGxvY2F0aW9uLCBvYmosIGQsIG5hbWUpIHtcbiAgICB2YXIgb3V0ID0ge307XG4gICAgb3V0LnNldCA9IGZ1bmN0aW9uIHNldEF0dHJpYihidWZmZXIsdHlwZSkge1xuICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLGJ1ZmZlcik7XG4gICAgZ2wudmVydGV4QXR0cmliUG9pbnRlcihsb2NhdGlvbiwgZCwgdHlwZXx8Z2wuRkxPQVQsIGZhbHNlLCAwLCAwKTtcbiAgICB9XG4gICAgb3V0LnBvaW50ZXIgPSBmdW5jdGlvbiBhdHRyaWJQb2ludGVyKHR5cGUsIG5vcm1hbGl6ZWQsIHN0cmlkZSwgb2Zmc2V0KSB7XG4gICAgICBnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKGxvY2F0aW9uLCBkLCB0eXBlfHxnbC5GTE9BVCwgbm9ybWFsaXplZD90cnVlOmZhbHNlLCBzdHJpZGV8fDAsIG9mZnNldHx8MCk7XG4gICAgfTtcbiAgICBvdXQuZW5hYmxlID0gZnVuY3Rpb24gZW5hYmxlQXR0cmliKCkge1xuICAgICAgZ2wuZW5hYmxlVmVydGV4QXR0cmliQXJyYXkobG9jYXRpb24pO1xuICAgIH07XG4gICAgb3V0LmRpc2FibGUgPSBmdW5jdGlvbiBkaXNhYmxlQXR0cmliKCkge1xuICAgICAgZ2wuZGlzYWJsZVZlcnRleEF0dHJpYkFycmF5KGxvY2F0aW9uKTtcbiAgICB9O1xuICAgIG91dC5sb2NhdGlvbiA9IGxvY2F0aW9uO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIG5hbWUsIHtcbiAgICB2YWx1ZTogb3V0LFxuICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldHVwVW5pZm9ybShnbCxzaGFkZXIsIHVuaWZvcm0sbG9jKSB7XG4gICAgc3dpdGNoKHVuaWZvcm0udHlwZSkge1xuICAgICAgY2FzZSBnbC5JTlQ6XG4gICAgICBjYXNlIGdsLkJPT0w6XG4gICAgICBjYXNlIGdsLlNBTVBMRVJfMkQ6XG4gICAgICBjYXNlIGdsLlNBTVBMRVJfQ1VCRTpcbiAgICAgICAgbWFrZVZlY3RvclVuaWZvcm0oZ2wsc2hhZGVyLGxvYywgc2hhZGVyLnVuaWZvcm1zLCBcImlcIiwxLHVuaWZvcm0ubmFtZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBnbC5JTlRfVkVDMjpcbiAgICAgIGNhc2UgZ2wuQk9PTF9WRUMyOlxuICAgICAgICBtYWtlVmVjdG9yVW5pZm9ybShnbCxzaGFkZXIsbG9jLCBzaGFkZXIudW5pZm9ybXMsIFwiaVwiLDIsdW5pZm9ybS5uYW1lKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGdsLklOVF9WRUMzOlxuICAgICAgY2FzZSBnbC5CT09MX1ZFQzM6XG4gICAgICAgIG1ha2VWZWN0b3JVbmlmb3JtKGdsLHNoYWRlcixsb2MsIHNoYWRlci51bmlmb3JtcywgXCJpXCIsMyx1bmlmb3JtLm5hbWUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgZ2wuSU5UX1ZFQzQ6XG4gICAgICBjYXNlIGdsLkJPT0xfVkVDNDpcbiAgICAgICAgbWFrZVZlY3RvclVuaWZvcm0oZ2wsc2hhZGVyLGxvYywgc2hhZGVyLnVuaWZvcm1zLCBcImlcIiw0LHVuaWZvcm0ubmFtZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBnbC5GTE9BVDpcbiAgICAgICAgbWFrZVZlY3RvclVuaWZvcm0oZ2wsc2hhZGVyLGxvYywgc2hhZGVyLnVuaWZvcm1zLCBcImZcIiwxLHVuaWZvcm0ubmFtZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBnbC5GTE9BVF9WRUMyOlxuICAgICAgICBtYWtlVmVjdG9yVW5pZm9ybShnbCxzaGFkZXIsbG9jLCBzaGFkZXIudW5pZm9ybXMsIFwiZlwiLDIsdW5pZm9ybS5uYW1lKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGdsLkZMT0FUX1ZFQzM6XG4gICAgICAgIG1ha2VWZWN0b3JVbmlmb3JtKGdsLHNoYWRlcixsb2MsIHNoYWRlci51bmlmb3JtcywgXCJmXCIsMyx1bmlmb3JtLm5hbWUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgZ2wuRkxPQVRfVkVDNDpcbiAgICAgICAgbWFrZVZlY3RvclVuaWZvcm0oZ2wsc2hhZGVyLGxvYywgc2hhZGVyLnVuaWZvcm1zLCBcImZcIiw0LHVuaWZvcm0ubmFtZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBnbC5GTE9BVF9NQVQyOlxuICAgICAgICBtYWtlTWF0cml4VW5pZm9ybShnbCxzaGFkZXIsbG9jLCBzaGFkZXIudW5pZm9ybXMsIDIsdW5pZm9ybS5uYW1lKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGdsLkZMT0FUX01BVDM6XG4gICAgICAgIG1ha2VNYXRyaXhVbmlmb3JtKGdsLHNoYWRlcixsb2MsIHNoYWRlci51bmlmb3JtcywgMyx1bmlmb3JtLm5hbWUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgZ2wuRkxPQVRfTUFUNDpcbiAgICAgICAgbWFrZU1hdHJpeFVuaWZvcm0oZ2wsc2hhZGVyLGxvYywgc2hhZGVyLnVuaWZvcm1zLCA0LHVuaWZvcm0ubmFtZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCB1bmlmb3JtIHR5cGUgaW4gc2hhZGVyOiBcIiArc2hhZGVyKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gc2V0dXBBdHRyaWIoZ2wsc2hhZGVyLGF0dHJpYixsb2NhdGlvbikge1xuICAgIHZhciBsZW4gPSAxO1xuICAgIHN3aXRjaChhdHRyaWIudHlwZSkge1xuICAgICAgY2FzZSBnbC5GTE9BVF9WRUMyOlxuICAgICAgICBsZW4gPSAyO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgZ2wuRkxPQVRfVkVDMzpcbiAgICAgICAgbGVuID0gMztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIGdsLkZMT0FUX1ZFQzQ6XG4gICAgICAgIGxlbiA9IDQ7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBtYWtlVmVjdG9yQXR0cmliKGdsLCBzaGFkZXIsIGxvY2F0aW9uLHNoYWRlci5hdHRyaWJzLCBsZW4sIGF0dHJpYi5uYW1lKTtcbiAgfVxuXG5cbiAgZnVuY3Rpb24gbG9hZFhNTERvYyhmaWxlbmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIHZhciB4bWxodHRwO1xuICAgICAgdmFyIHRleHQ7XG4gICAgICB4bWxodHRwID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICAgIHhtbGh0dHAub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKHhtbGh0dHAucmVhZHlTdGF0ZSA9PSA0ICYmIHhtbGh0dHAuc3RhdHVzID09IDIwMCkgY2FsbGJhY2soeG1saHR0cC5yZXNwb25zZVRleHQpO1xuICAgICAgfVxuXG4gICAgICB4bWxodHRwLm9wZW4oXCJHRVRcIiwgZmlsZW5hbWUsIHRydWUpO1xuICAgICAgeG1saHR0cC5zZW5kKCk7XG4gIH1cblxuICBmdW5jdGlvbiBnZXRTaGFkZXIoZ2wsIHNyYywgdHlwZSkge1xuICAgICAgdmFyIHNoYWRlcjtcbiAgICAgIC8vZGVjaWRlcyBpZiBpdCdzIGEgZnJhZ21lbnQgb3IgdmVydGV4IHNoYWRlclxuXG4gICAgICBpZiAodHlwZSA9PSBcImZyYWdtZW50XCIpIHtcbiAgICAgICAgICBzaGFkZXIgPSBnbC5jcmVhdGVTaGFkZXIoZ2wuRlJBR01FTlRfU0hBREVSKTtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKHR5cGUgPT0gXCJ2ZXJ0ZXhcIikge1xuICAgICAgICAgIHNoYWRlciA9IGdsLmNyZWF0ZVNoYWRlcihnbC5WRVJURVhfU0hBREVSKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgICAgZ2wuc2hhZGVyU291cmNlKHNoYWRlciwgc3JjKTtcbiAgICAgIGdsLmNvbXBpbGVTaGFkZXIoc2hhZGVyKTtcblxuICAgICAgaWYgKCFnbC5nZXRTaGFkZXJQYXJhbWV0ZXIoc2hhZGVyLCBnbC5DT01QSUxFX1NUQVRVUykpIHtcbiAgICAgICAgICBhbGVydChnbC5nZXRTaGFkZXJJbmZvTG9nKHNoYWRlcikpO1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHNoYWRlcjtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldHVwU2hhZGVyUHJvZ3JhbShnbCxzaGFkZXJQcm9ncmFtLCB2ZXJ0ZXhTaGFkZXIsIGZyYWdtZW50U2hhZGVyLGNhbGxiYWNrKSB7XG4gICAgICBnbC5hdHRhY2hTaGFkZXIoc2hhZGVyUHJvZ3JhbSwgdmVydGV4U2hhZGVyKTtcbiAgICAgIGdsLmF0dGFjaFNoYWRlcihzaGFkZXJQcm9ncmFtLCBmcmFnbWVudFNoYWRlcik7XG4gICAgICBnbC5saW5rUHJvZ3JhbShzaGFkZXJQcm9ncmFtKTtcblxuICAgICAgaWYgKCFnbC5nZXRQcm9ncmFtUGFyYW1ldGVyKHNoYWRlclByb2dyYW0sIGdsLkxJTktfU1RBVFVTKSkge1xuICAgICAgICAgIGFsZXJ0KFwiQ291bGQgbm90IGluaXRpYWxpc2Ugc2hhZGVyc1wiKTtcbiAgICAgIH1cbiAgICAgIGNhbGxiYWNrKHNoYWRlclByb2dyYW0pO1xuICB9XG5cbiAgdmFyIGdsU2hhZGVyID0gZXhwb3J0cztcbiAgXG4gIGdsU2hhZGVyLnNldEdMID0gZnVuY3Rpb24oX2dsKSB7XG4gICAgZ2wgPSBfZ2w7XG4gIH1cbiAgXG4gIGdsU2hhZGVyLm1ha2VTaGFkZXIgPSBmdW5jdGlvbihnbCxwcm9ncmFtLHNoYWRlcikge1xuICAgIHZhciB0b3RhbFVuaWZvcm1zID0gZ2wuZ2V0UHJvZ3JhbVBhcmFtZXRlcihwcm9ncmFtLCBnbC5BQ1RJVkVfVU5JRk9STVMpO1xuICAgIHNoYWRlciA9IHNoYWRlciB8fCBuZXcgU2hhZGVyKGdsLHByb2dyYW0pO1xuICAgIGZvcih2YXIgaT0wO2k8dG90YWxVbmlmb3JtczsrK2kpIHtcbiAgICAgIHZhciB1bmlmb3JtID0gZ2wuZ2V0QWN0aXZlVW5pZm9ybShwcm9ncmFtLCBpKTtcbiAgICAgIHNldHVwVW5pZm9ybShnbCxzaGFkZXIsIHVuaWZvcm0sZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHByb2dyYW0sIHVuaWZvcm0ubmFtZSkpO1xuICAgIH1cbiAgICB2YXIgdG90YWxBdHRyaWJzID0gZ2wuZ2V0UHJvZ3JhbVBhcmFtZXRlcihwcm9ncmFtLGdsLkFDVElWRV9BVFRSSUJVVEVTKTtcbiAgICBmb3IodmFyIGk9MDtpPHRvdGFsQXR0cmliczsrK2kpIHtcbiAgICAgIHZhciBhdHRyaWIgPSBnbC5nZXRBY3RpdmVBdHRyaWIocHJvZ3JhbSwgaSk7XG4gICAgICBzZXR1cEF0dHJpYihnbCxzaGFkZXIsYXR0cmliLGkpO1xuICAgIH1cbiAgICBzaGFkZXIuaXNSZWFkeSA9IHRydWU7XG4gICAgcmV0dXJuIHNoYWRlcjtcbiAgfVxuXG4gIGdsU2hhZGVyLmxvYWRTaGFkZXIgPSBmdW5jdGlvbihnbCwgdmVydGV4RmlsZSwgZnJhZ21lbnRGaWxlKSB7XG4gICAgICB2YXIgc2hhZGVyUHJvZ3JhbSA9IGdsLmNyZWF0ZVByb2dyYW0oKTtcbiAgICB2YXIgc2hhZGVyID0gbmV3IFNoYWRlcihnbCxzaGFkZXJQcm9ncmFtKTtcbiAgICAgIHZhciBmcmFnU2hhZGVyLCB2ZXJ0U2hhZGVyO1xuICAgICAgdmFyIGxvYWRlZCA9IDA7XG4gICAgICB2YXIgeG1saHR0cDtcbiAgICAgIHhtbGh0dHAgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAgIGxvYWRYTUxEb2ModmVydGV4RmlsZSwgZnVuY3Rpb24odHh0KSB7dmVydFNoYWRlciA9IGdldFNoYWRlcihnbCwgdHh0LCBcInZlcnRleFwiKTtpZigrK2xvYWRlZCA9PSAyKSBzZXR1cFNoYWRlclByb2dyYW0oZ2wsc2hhZGVyUHJvZ3JhbSwgdmVydFNoYWRlcixmcmFnU2hhZGVyLGZ1bmN0aW9uKHByb2cpIHtnbFNoYWRlci5tYWtlU2hhZGVyKGdsLHByb2csc2hhZGVyKTt9KX0pO1xuICAgICAgbG9hZFhNTERvYyhmcmFnbWVudEZpbGUsIGZ1bmN0aW9uKHR4dCkge2ZyYWdTaGFkZXIgPSBnZXRTaGFkZXIoZ2wsIHR4dCwgXCJmcmFnbWVudFwiKTtpZigrK2xvYWRlZCA9PSAyKSBzZXR1cFNoYWRlclByb2dyYW0oZ2wsc2hhZGVyUHJvZ3JhbSwgdmVydFNoYWRlcixmcmFnU2hhZGVyLGZ1bmN0aW9uKHByb2cpIHtnbFNoYWRlci5tYWtlU2hhZGVyKGdsLHByb2csc2hhZGVyKTt9KX0pO1xuICAgICAgcmV0dXJuIHNoYWRlcjtcbiAgfVxuXG4gIC8vaWYodHlwZW9mKGV4cG9ydHMpICE9PSAndW5kZWZpbmVkJykge1xuICAvLyAgICBleHBvcnRzLmdsU2hhZGVyID0gZ2xTaGFkZXI7XG4gIC8vfVxuXG4gIH0pKHNoaW0uZXhwb3J0cyk7XG59KSh0aGlzKTtcbiIsIlwidXNlIHN0cmljdFwiXG5cbnZhciBnbE1hdHJpeCA9IHJlcXVpcmUoJy4uL2pzL2dsLW1hdHJpeC1taW4uanMnKTtcbnZhciB2ZWMzID0gZ2xNYXRyaXgudmVjMztcbnZhciBIRU1FU0hfTlVMTEZBQ0UgPSBudWxsO1xuXG52YXIgaGVtZXNoID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMudmVydGljZXMgPSBbXTtcbiAgdGhpcy5lZGdlcyA9IFtdO1xuICB0aGlzLmZhY2VzID0gW107XG59XG5cbnZhciBoZWRnZSA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLmZhY2UgPSBIRU1FU0hfTlVMTEZBQ0U7XG4gIHRoaXMubmV4dCA9IG51bGw7XG4gIHRoaXMucGFpciA9IG51bGw7XG4gIHRoaXMudiA9IG51bGw7XG4gIHRoaXMuaW5kZXggPSAwO1xuICB0aGlzLmluZm8gPSB7fTtcbn1cblxudmFyIGhlZmFjZSA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLmUgPSBudWxsO1xuICB0aGlzLmluZGV4ID0gMDtcbiAgdGhpcy5pbmZvID0ge307XG59XG5cbnZhciBoZXZlcnRleCA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLmUgPSBudWxsO1xuICB0aGlzLnBvcyA9IHZlYzMuY3JlYXRlKCk7XG4gIHRoaXMuaW5kZXggPSAwO1xuICB0aGlzLmIgPSAwO1xuICB0aGlzLnRhZ2dlZCA9IDA7XG4gIHRoaXMuaW5mbyA9IHt9O1xufVxuXG5oZW1lc2gucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24oKSB7XG4gIHZhciBlLHYsZjtcbiAgZm9yKHZhciBpPTAsbD10aGlzLmVkZ2VzLmxlbmd0aDtpPGw7KytpKSB7XG4gICAgZSA9IHRoaXMuZWRnZXNbaV07XG4gICAgZS5uZXh0ID0gbnVsbDtcbiAgICBlLnBhaXIgPSBudWxsO1xuICAgIGUudiA9IG51bGw7XG4gICAgZS5mYWNlID0gbnVsbDtcbiAgfVxuICBmb3IodmFyIGk9MCxsPXRoaXMuZmFjZXMubGVuZ3RoO2k8bDsrK2kpIHtcbiAgICBmID0gdGhpcy5mYWNlc1tpXTtcbiAgICBmLmUgPSBudWxsO1xuICAgIFxuICB9XG4gIGZvcih2YXIgaT0wLGw9dGhpcy52ZXJ0aWNlcy5sZW5ndGg7aTxsOysraSkge1xuICAgIHYgPSB0aGlzLnZlcnRpY2VzW2ldO1xuICAgIHYuZSA9IG51bGw7XG4gIH1cbiAgdGhpcy5mYWNlcy5sZW5ndGggPSAwO1xuICB0aGlzLmVkZ2VzLmxlbmd0aCA9IDA7XG4gIHRoaXMudmVydGljZXMubGVuZ3RoID0gMDtcbn1cblxuaGVtZXNoLnByb3RvdHlwZS5hZGRFZGdlID0gZnVuY3Rpb24oKSB7XG4gIHZhciBuZXdFZGdlID0gbmV3IGhlZGdlKCk7XG4gIG5ld0VkZ2UuaW5kZXggPSB0aGlzLmVkZ2VzLmxlbmd0aDtcbiAgdGhpcy5lZGdlcy5wdXNoKG5ld0VkZ2UpO1xuICByZXR1cm4gbmV3RWRnZTtcbn1cblxuaGVtZXNoLnByb3RvdHlwZS5hZGRWZXJ0ZXggPSBmdW5jdGlvbihwb3MpIHtcbiAgdmFyIG5ld1ZlcnRleCA9IG5ldyBoZXZlcnRleCgpO1xuICB2ZWMzLmNvcHkobmV3VmVydGV4LnBvcyxwb3MpO1xuICBuZXdWZXJ0ZXguaW5kZXggPSB0aGlzLnZlcnRpY2VzLmxlbmd0aDtcbiAgdGhpcy52ZXJ0aWNlcy5wdXNoKG5ld1ZlcnRleCk7XG4gIHJldHVybiBuZXdWZXJ0ZXg7XG59XG5cbmhlbWVzaC5wcm90b3R5cGUuYWRkRmFjZSA9IGZ1bmN0aW9uKCkge1xuICB2YXIgbmV3RmFjZSA9IG5ldyBoZWZhY2UoKTtcbiAgbmV3RmFjZS5pbmRleCA9IHRoaXMuZmFjZXMubGVuZ3RoO1xuICB0aGlzLmZhY2VzLnB1c2gobmV3RmFjZSk7XG4gIHJldHVybiBuZXdGYWNlO1xufVxuXG5oZW1lc2gucHJvdG90eXBlLnJlbW92ZUVkZ2UgPSBmdW5jdGlvbihlKSB7XG4gIGUubmV4dCA9IG51bGw7XG4gIGUucGFpciA9IG51bGw7XG4gIGUuZmFjZSA9IG51bGw7XG4gIGUudiA9IG51bGw7XG4gIGlmKGUuaW5kZXggPT0gdGhpcy5lZGdlcy5sZW5ndGgtMSkge1xuICAgIHRoaXMuZWRnZXMucG9wKCk7XG4gIH0gZWxzZSBpZihlLmluZGV4ID49IHRoaXMuZWRnZXMubGVuZ3RoKSB7XG4gICAgXG4gIH0gZWxzZSB7XG4gICAgdmFyIHRlbXAgPSB0aGlzLmVkZ2VzLnBvcCgpO1xuICAgIHRlbXAuaW5kZXggPSBlLmluZGV4O1xuICAgIHRoaXMuZWRnZXNbZS5pbmRleF0gPSB0ZW1wO1xuICB9XG59XG5cbmhlbWVzaC5wcm90b3R5cGUucmVtb3ZlRmFjZSA9IGZ1bmN0aW9uKGYpIHtcbiAgZi5lID0gbnVsbDtcbiAgaWYoZi5pbmRleCA9PSB0aGlzLmZhY2VzLmxlbmd0aC0xKSB7XG4gICAgdGhpcy5mYWNlcy5wb3AoKTtcbiAgfSBlbHNlIGlmIChmLmluZGV4ID49IHRoaXMuZmFjZXMubGVuZ3RoKSB7XG4gICAgXG4gIH1lbHNlIHtcbiAgICB2YXIgdGVtcCA9IHRoaXMuZmFjZXMucG9wKCk7XG4gICAgdGVtcC5pbmRleCA9IGYuaW5kZXg7XG4gICAgdGhpcy5mYWNlc1tmLmluZGV4XSA9IHRlbXA7XG4gIH1cbn1cblxuaGVtZXNoLnByb3RvdHlwZS5yZW1vdmVWZXJ0ZXggPSBmdW5jdGlvbih2KSB7XG4gIHYuZSA9IG51bGw7XG4gIGlmKHYuaW5kZXggPT0gdGhpcy52ZXJ0aWNlcy5sZW5ndGgtMSkge1xuICAgIHRoaXMudmVydGljZXMucG9wKCk7XG4gIH0gZWxzZSBpZih2LmluZGV4ID49IHRoaXMudmVydGljZXMubGVuZ3RoKSB7XG4gICAgXG4gIH0gZWxzZSB7XG4gICAgdmFyIHRlbXAgPSB0aGlzLnZlcnRpY2VzLnBvcCgpO1xuICAgIHRlbXAuaW5kZXggPSB2LmluZGV4O1xuICAgIHRoaXMudmVydGljZXNbdi5pbmRleF0gPSB0ZW1wO1xuICB9XG59XG5cbmhlbWVzaC5wcm90b3R5cGUuaXNCb3VuZGFyeSA9IGZ1bmN0aW9uKGUpIHtcbiAgcmV0dXJuIChlLmZhY2UgPT0gSEVNRVNIX05VTExGQUNFIHx8IGUucGFpci5mYWNlID09IEhFTUVTSF9OVUxMRkFDRSk7XG59XG5cbmhlbWVzaC5wcm90b3R5cGUuaXNDb2xsYXBzYWJsZSA9IGZ1bmN0aW9uKGUpIHtcbiAgLy9zaG91bGQgSSB0ZXN0IGlmIHRoZSBlZGdlcyx2ZXJ0aWNlcywgb3IgZmFjZXMgaGF2ZSBiZWVuIGRlbGV0ZWQgeWV0P1xuICB2YXIgZXBhaXIgPSBlLnBhaXI7XG4gIHZhciBwMSA9IGUudjtcbiAgdmFyIHAyID0gZXBhaXIudjtcbiAgXG4gIC8vZ2V0IG9wcG9zaXRlIHBvaW50cywgaWYgYm91bmRhcnkgZWRnZSBvcHBvc2l0ZSBpcyBudWxsXG4gIHZhciBvcHAxID0gZS5mYWNlID09IEhFTUVTSF9OVUxMRkFDRSA/IG51bGwgOiBlLm5leHQudjtcbiAgdmFyIG9wcDIgPSBlcGFpci5mYWNlID09IEhFTUVTSF9OVUxMRkFDRSA/IG51bGwgOiBlcGFpci5uZXh0LnY7XG4gIFxuICAvL2lmIGVuZCBwb2ludHMgYXJlIG9uIHRoZSBib3VuZGFyeSBidXQgdGhlIGVkZ2UgaXMgbm90XG4gIGlmKHAxLmIgJiYgcDIuYiAmJiBlLmZhY2UgIT0gSEVNRVNIX05VTExGQUNFICYmIGVwYWlyLmZhY2UgIT0gSEVNRVNIX05VTExGQUNFKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIFxuICBpZihvcHAxID09IG9wcDIpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgLy9taWdodCBuZWVkIGEgY2hlY2sgdG8gc2VlIGlmIG9wcG9zaXRlIGVkZ2VzIGFyZSBib3RoIGJvdW5kYXJ5IGJ1dCB0aGF0IHNlZW1zIGNvdmVyZWQgYnkgdGhlIHByZXZpb3VzIGNoZWNrXG4gIFxuICBcbiAgLy90ZXN0IHRvIHNlZSBpZiBlbmQgcG9pbnRzIHNoYXJlIGFueSBuZWlnaGJvcnMgYmVzaWRlIG9wcDEgYW5kIG9wcDJcbiAgLy9tYXJrIGFsbCBuZWlnaGJvcnMgb2YgcDEgYXMgMFxuICB2YXIgY3VyckUgPSBlO1xuICBkbyB7XG4gICAgY3VyckUgPSBjdXJyRS5uZXh0O1xuICAgIGN1cnJFLnYudGFnZ2VkID0gMDtcbiAgICBjdXJyRSA9IGN1cnJFLnBhaXI7XG4gIH0gd2hpbGUoY3VyckUgIT0gZSk7XG4gIC8vbWFyayBhbGwgbmVpZ2hib3JzIG9mIHAyIGFzIDFcbiAgY3VyckUgPSBlcGFpcjtcbiAgZG8ge1xuICAgIGN1cnJFID0gY3VyckUubmV4dDtcbiAgICBjdXJyRS52LnRhZ2dlZCA9IDE7XG4gICAgY3VyckUgPSBjdXJyRS5wYWlyO1xuICB9IHdoaWxlKGN1cnJFICE9IGVwYWlyKTtcbiAgLy91bnRhZyBvcHBvc2l0ZVxuICBpZihvcHAxICE9IG51bGwpIHtvcHAxLnRhZ2dlZCA9IDA7fVxuICBpZihvcHAyICE9IG51bGwpIHtvcHAyLnRhZ2dlZCA9IDA7fVxuICBcbiAgLy9jaGVjayBuZWlnaGJvcnMgb2YgcDEsIGlmIGFueSBhcmUgbWFya2VkIGFzIDEgcmV0dXJuIGZhbHNlXG4gIGN1cnJFID0gZTtcbiAgZG8ge1xuICAgIGN1cnJFID0gY3VyckUubmV4dDtcbiAgICBpZihjdXJyRS52LnRhZ2dlZCA9PSAxKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGN1cnJFID0gY3VyckUucGFpcjtcbiAgfSB3aGlsZShjdXJyRSAhPSBlKTtcbiAgIFxuICAvL3Rlc3QgZm9yIGEgZmFjZSBvbiB0aGUgYmFja3NpZGUvb3RoZXIgc2lkZSB0aGF0IG1pZ2h0IGRlZ2VuZXJhdGVcbiAgaWYoZS5mYWNlICE9IEhFTUVTSF9OVUxMRkFDRSkge1xuICAgIHZhciBlbmV4dCwgZW5leHQyO1xuICAgIGVuZXh0ID0gZS5uZXh0O1xuICAgIGVuZXh0MiA9IGVuZXh0Lm5leHQ7XG4gICAgXG4gICAgZW5leHQgPSBlbmV4dC5wYWlyO1xuICAgIGVuZXh0MiA9IGVuZXh0Mi5wYWlyO1xuICAgIGlmKGVuZXh0LmZhY2UgPT0gZW5leHQyLmZhY2UpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgaWYoZXBhaXIuZmFjZSAhPSBIRU1FU0hfTlVMTEZBQ0UpIHtcbiAgICB2YXIgZW5leHQsIGVuZXh0MjtcbiAgICBlbmV4dCA9IGVwYWlyLm5leHQ7XG4gICAgZW5leHQyID0gZW5leHQubmV4dDtcbiAgICBcbiAgICBlbmV4dCA9IGVuZXh0LnBhaXI7XG4gICAgZW5leHQyID0gZW5leHQyLnBhaXI7XG4gICAgaWYoZW5leHQuZmFjZSA9PSBlbmV4dDIuZmFjZSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICBcbiAgcmV0dXJuIHRydWU7XG4gIC8qXG4gIGlmICh2MHYxX3RyaWFuZ2xlKVxuICB7XG4gICAgSGFsZmVkZ2VIYW5kbGUgb25lLCB0d287XG4gICAgb25lID0gbmV4dF9oYWxmZWRnZV9oYW5kbGUodjB2MSk7XG4gICAgdHdvID0gbmV4dF9oYWxmZWRnZV9oYW5kbGUob25lKTtcbiAgICBcbiAgICBvbmUgPSBvcHBvc2l0ZV9oYWxmZWRnZV9oYW5kbGUob25lKTtcbiAgICB0d28gPSBvcHBvc2l0ZV9oYWxmZWRnZV9oYW5kbGUodHdvKTtcbiAgICBcbiAgICBpZiAoZmFjZV9oYW5kbGUob25lKSA9PSBmYWNlX2hhbmRsZSh0d28pICYmIHZhbGVuY2UoZmFjZV9oYW5kbGUob25lKSkgIT0gMylcbiAgICB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICBcbiAgKi9cbiAgXG59XG5cbmhlbWVzaC5wcm90b3R5cGUuZWRnZUNvbGxhcHNlID0gZnVuY3Rpb24oZSkge1xuICBpZighdGhpcy5pc0NvbGxhcHNhYmxlKGUpKSByZXR1cm47XG4gIFxuICB2YXIgZXBhaXIgPSBlLnBhaXI7XG4gIHZhciBlbmV4dCwgZW5leHQyLCBlbmV4dHAsIGVuZXh0cDI7XG4gIHZhciBwMSA9IGUudjtcbiAgdmFyIHAyID0gZXBhaXIudjtcbiAgcDIuZSA9IG51bGw7XG4gIC8vbmVlZCB0byBjaGVjayBmb3IgZWRnZSB2ZXJ0aWNlcyBlaXRoZXIgdGhyb3VnaCBtYXJraW5nIG9yIGNoZWNraW5nIGVkZ2VzXG4gIGlmKHAxLmIpIHtcbiAgICBpZighcDIuYikge1xuICAgIFxuICAgIH0gZWxzZSB7ICAgIFxuICAgICAgdmVjMy5hZGQocDEucG9zLHAxLnBvcyxwMi5wb3MpO1xuICAgICAgdmVjMy5zY2FsZShwMS5wb3MscDEucG9zLDAuNSk7XG4gICAgICBwMS5iID0gcDIuYjtcbiAgICB9XG4gIH0gZWxzZSBpZihwMi5iKSB7XG4gICAgdmVjMy5jb3B5KHAxLnBvcyxwMi5wb3MpO1xuICAgIHAxLmIgPSBwMi5iO1xuICB9IGVsc2Uge1xuICAgIHZlYzMuYWRkKHAxLnBvcyxwMS5wb3MscDIucG9zKTtcbiAgICB2ZWMzLnNjYWxlKHAxLnBvcyxwMS5wb3MsMC41KTtcbiAgfVxuICAvL3JlbW92ZSBwMlxuICB2YXIgc3RhcnRFID0gZXBhaXI7XG4gIC8vc2xpZ2h0IGluZWZmaWNpZW5jeSwgbm8gbmVlZCB0byByZXBvaW50IGVkZ2VzIHRoYXQgYXJlIGFib3V0IHRvIGJlIHJlbW92ZWRcbiAgZW5leHQgPSBlcGFpcjtcbiAgZG8ge1xuICAgIGVuZXh0LnYgPSBwMTtcbiAgICBlbmV4dCA9IGVuZXh0Lm5leHQucGFpcjtcbiAgfSB3aGlsZShlbmV4dCAhPSBzdGFydEUpO1xuXG4gIHRoaXMucmVtb3ZlVmVydGV4KHAyKTtcbiAgXG4gIHZhciBwcmV2RSwgcHJldkVQO1xuICBpZihlLmZhY2UgPT0gbnVsbCkge1xuICAgIHZhciBjdXJyRSA9IGVwYWlyO1xuICAgIHdoaWxlKGN1cnJFLm5leHQgIT0gZSkge1xuICAgICAgY3VyckUgPSBjdXJyRS5uZXh0LnBhaXI7XG4gICAgfVxuICAgIHByZXZFID0gY3VyckU7XG4gIH1cbiAgaWYoZXBhaXIuZmFjZSA9PSBudWxsKSB7XG4gICAgdmFyIGN1cnJFID0gZTtcbiAgICB3aGlsZShjdXJyRS5uZXh0ICE9IGVwYWlyKSB7XG4gICAgICBjdXJyRSA9IGN1cnJFLm5leHQucGFpcjtcbiAgICB9XG4gICAgcHJldkVQID0gY3VyckU7XG4gIH1cbiAgLy9yZW1vdmUgZmFjZVxuICBpZihlLmZhY2UgIT0gbnVsbCkge1xuICAgIGVuZXh0ID0gZS5uZXh0O1xuICAgIGVuZXh0MiA9IGVuZXh0Lm5leHQ7XG4gICAgXG4gICAgLy9yZW1vdmUgZW5leHQgYW5kIGVuZXh0MjtcbiAgICBlbmV4dHAgPSBlbmV4dC5wYWlyO1xuICAgIGVuZXh0cDIgPSBlbmV4dDIucGFpcjtcbiAgICBcbiAgICAvKlxuICAgIGlmKGVuZXh0cC5mYWNlID09IG51bGwgJiYgZW5leHRwMi5mYWNlID09IG51bGwpIHtcbiAgICAgIC8vcGluY2hlZCBvZmYsIHJlbW92ZSBlbmV4dHAgYW5kIGVuZXh0cDIsIGNvbm5lY3QgYWNyb3NzXG4gICAgICB2YXIgY3VyckUgPSBlbmV4dDI7XG4gICAgICB3aGlsZShjdXJyRS5uZXh0ICE9IGVuZXh0cDIpIHtcbiAgICAgICAgY3VyckUgPSBjdXJyRS5uZXh0LnBhaXI7XG4gICAgICB9XG4gICAgICBjdXJyRS5uZXh0ID0gZW5leHRwLm5leHQ7XG4gICAgICBwMS5lID0gY3VyckU7XG4gICAgICBcbiAgICAgIHRoaXMucmVtb3ZlVmVydGV4KGVuZXh0LnYpO1xuICAgICAgdGhpcy5yZW1vdmVFZGdlKGVuZXh0cCk7XG4gICAgICB0aGlzLnJlbW92ZUVkZ2UoZW5leHRwMik7XG4gICAgfSBlbHNlIHtcbiAgICAqL1xuICAgICAgZW5leHRwLnBhaXIgPSBlbmV4dHAyO1xuICAgICAgZW5leHRwMi5wYWlyID0gZW5leHRwOyAgICBcbiAgICAgIC8vcDEuZSA9IGVuZXh0cDtcbiAgICAgIGVuZXh0cC52LmUgPSBlbmV4dHA7XG4gICAgICBlbmV4dHAyLnYuZSA9IGVuZXh0cDI7ICAgXG4gICAgLy99XG4gICAgXG4gICAgdGhpcy5yZW1vdmVFZGdlKGVuZXh0KTtcbiAgICB0aGlzLnJlbW92ZUVkZ2UoZW5leHQyKTtcblxuIFxuICAgIFxuICAgIHRoaXMucmVtb3ZlRmFjZShlLmZhY2UpO1xuICB9IGVsc2Uge1xuICAgIFxuICAgIHByZXZFLm5leHQgPSBlLm5leHQ7XG4gICAgcDEuZSA9IHByZXZFO1xuICB9XG4gIFxuICBpZihlcGFpci5mYWNlICE9IG51bGwpIHtcbiAgICBlbmV4dCA9IGVwYWlyLm5leHQ7XG4gICAgZW5leHQyID0gZW5leHQubmV4dDtcbiAgICBcbiAgICAvL3JlbW92ZSBlbmV4dCBhbmQgZW5leHQyO1xuXG4gICAgZW5leHRwID0gZW5leHQucGFpcjtcbiAgICBlbmV4dHAyID0gZW5leHQyLnBhaXI7XG4gICAgLypcbiAgICBpZihlbmV4dHAuZmFjZSA9PSBudWxsICYmIGVuZXh0cDIuZmFjZSA9PSBudWxsKSB7XG4gICAgICAvL3BpbmNoZWQgb2ZmLCByZW1vdmUgZW5leHRwIGFuZCBlbmV4dHAyLCBjb25uZWN0IGFjcm9zc1xuICAgICAgLy9pbmVmZmljaWVudGx5IGdldCBwcmV2aW91cyBlZGdlXG4gICAgICB2YXIgY3VyckU7XG4gICAgICBmb3IodmFyIGk9MDtpPHRoaXMuZWRnZXMubGVuZ3RoOysraSkge1xuICAgICAgICBjdXJyRSA9IHRoaXMuZWRnZXNbaV07XG4gICAgICAgIGlmKGN1cnJFLm5leHQgPT0gZW5leHRwMikge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjdXJyRS5uZXh0ID0gZW5leHRwLm5leHQ7XG4gICAgICBwMS5lID0gY3VyckU7XG4gICAgICBcbiAgICAgIHRoaXMucmVtb3ZlVmVydGV4KGVuZXh0LnYpO1xuICAgICAgdGhpcy5yZW1vdmVFZGdlKGVuZXh0cCk7XG4gICAgICB0aGlzLnJlbW92ZUVkZ2UoZW5leHRwMik7XG4gICAgfSBlbHNlIHtcbiAgICAqL1xuICAgICAgZW5leHRwLnBhaXIgPSBlbmV4dHAyO1xuICAgICAgZW5leHRwMi5wYWlyID0gZW5leHRwOyAgICBcbiAgICAgIGVuZXh0cC52LmUgPSBlbmV4dHA7XG4gICAgICBlbmV4dHAyLnYuZSA9IGVuZXh0cDI7ICAgXG4gICAgLy99XG4gICAgdGhpcy5yZW1vdmVFZGdlKGVuZXh0KTtcbiAgICB0aGlzLnJlbW92ZUVkZ2UoZW5leHQyKTtcblxuICAgIHRoaXMucmVtb3ZlRmFjZShlcGFpci5mYWNlKTtcbiAgfSBlbHNlIHtcbiAgICBwcmV2RVAubmV4dCA9IGVwYWlyLm5leHQ7XG4gICAgcDEuZSA9IHByZXZFUDtcbiAgfVxuICBcbiAgLy9yZW1vdmUgZSBhbmQgZXBhaXJcbiAgdGhpcy5yZW1vdmVFZGdlKGUpO1xuICB0aGlzLnJlbW92ZUVkZ2UoZXBhaXIpO1xuXG4gIHJldHVybiBwMTtcbn1cblxuaGVtZXNoLnByb3RvdHlwZS5lZGdlU3BsaXQgPSAoZnVuY3Rpb24oKSB7IFxuICB2YXIgcG9zID0gdmVjMy5jcmVhdGUoKTtcbiAgLy9hc3N1bWVzIGUuZmFjZSAhPSBudWxsIGJ1dCBlcGFpci5mYWNlIGNhbiA9PSBudWxsXG4gIHJldHVybiBmdW5jdGlvbihlKSB7XG4gICAgLy9uZWVkIHRvIGNoZWNrIGZvciBib3VuZGFyeSBlZGdlXG4gICAgLy9ub3QgZG9uZVxuICAgIFxuICAgIC8vbmV3IHB0XG4gICAgdmFyIGVwYWlyID0gZS5wYWlyO1xuICAgIHZhciBwMSA9IGUudjsgICAgXG4gICAgdmFyIHAyID0gZXBhaXIudjtcbiAgICB2YXIgZW5leHQgPSBlLm5leHQ7XG4gICAgdmFyIGVwbmV4dCA9IGVwYWlyLm5leHQ7XG4gICAgXG4gICAgdmVjMy5hZGQocG9zLHAxLnBvcyxwMi5wb3MpO1xuICAgIHZlYzMuc2NhbGUocG9zLHBvcywwLjUpO1xuICAgIHZhciBuZXdWZXJ0ZXggPSB0aGlzLmFkZFZlcnRleChwb3MpO1xuICAgIFxuICAgIHZhciBuZXdFZGdlLCBuZXdFZGdlUGFpciwgbmV3RmFjZSwgc3BsaXRFZGdlMSwgc3BsaXRFZGdlMjtcbiAgICBcbiAgICAvL2RvIGUgZmlyc3RcbiAgICBuZXdFZGdlID0gdGhpcy5hZGRFZGdlKCk7XG4gICAgbmV3RWRnZS52ID0gcDE7XG4gICAgcDEuZSA9IG5ld0VkZ2U7XG4gICAgZS52ID0gbmV3VmVydGV4O1xuICAgIG5ld0VkZ2UubmV4dCA9IGVuZXh0O1xuICAgIG5ld0VkZ2UucGFpciA9IGVwYWlyO1xuICAgIGVwYWlyLnBhaXIgPSBuZXdFZGdlO1xuICAgIFxuICAgIG5ld0VkZ2VQYWlyID0gdGhpcy5hZGRFZGdlKCk7XG4gICAgbmV3RWRnZVBhaXIudiA9IHAyO1xuICAgIG5ld0VkZ2VQYWlyLmUgPSBwMjtcbiAgICBlcGFpci52ID0gbmV3VmVydGV4O1xuICAgIG5ld0VkZ2VQYWlyLm5leHQgPSBlcG5leHQ7XG4gICAgbmV3RWRnZVBhaXIucGFpciA9IGU7XG4gICAgZS5wYWlyID0gbmV3RWRnZVBhaXI7XG4gICAgbmV3VmVydGV4LmUgPSBlO1xuICAgIFxuICAgIC8vc2V0IGIgdG8gbmVpZ2hib3JpbmcgYiwgaXQgcDEuYiBzaG91bGQgZXF1YWwgcDIuYlxuICAgIGlmKGUuZmFjZSA9PSBudWxsIHx8IGVwYWlyLmZhY2UgPT0gbnVsbCkgeyBuZXdWZXJ0ZXguYiA9IHAxLmI7fVxuICAgIFxuICAgIGlmKGUuZmFjZSAhPSBudWxsKSB7XG4gICAgICAvL2ZhY2UgMVxuICAgICAgbmV3RmFjZSA9IHRoaXMuYWRkRmFjZSgpO1xuICAgICAgc3BsaXRFZGdlMSA9IHRoaXMuYWRkRWRnZSgpO1xuICAgICAgc3BsaXRFZGdlMiA9IHRoaXMuYWRkRWRnZSgpO1xuICAgICAgc3BsaXRFZGdlMS5wYWlyID0gc3BsaXRFZGdlMjtcbiAgICAgIHNwbGl0RWRnZTIucGFpciA9IHNwbGl0RWRnZTE7XG4gICAgICBzcGxpdEVkZ2UxLnYgPSBlbmV4dC52O1xuICAgICAgc3BsaXRFZGdlMi52ID0gbmV3VmVydGV4O1xuICAgICAgXG4gICAgICAvL2UuZlxuICAgICAgZS5uZXh0ID0gc3BsaXRFZGdlMTtcbiAgICAgIHNwbGl0RWRnZTEubmV4dCA9IGVuZXh0Lm5leHQ7XG4gICAgICBlLmZhY2UuZSA9IGU7XG4gICAgICBzcGxpdEVkZ2UxLmZhY2UgPSBlLmZhY2U7XG4gICAgICAvL25ld0ZhY2VcbiAgICAgIG5ld0VkZ2UuZmFjZSA9IG5ld0ZhY2U7XG4gICAgICBzcGxpdEVkZ2UyLmZhY2UgPSBuZXdGYWNlO1xuICAgICAgZW5leHQuZmFjZSA9IG5ld0ZhY2U7XG4gICAgICBuZXdGYWNlLmUgPSBuZXdFZGdlO1xuICAgICAgZW5leHQubmV4dCA9IHNwbGl0RWRnZTI7XG4gICAgICBzcGxpdEVkZ2UyLm5leHQgPSBuZXdFZGdlO1xuICAgIH0gZWxzZSB7XG4gICAgICBlLm5leHQgPSBuZXdFZGdlO1xuICAgIH1cbiAgICBcbiAgICBpZihlcGFpci5mYWNlICE9IG51bGwpIHtcbiAgICAgIG5ld0ZhY2UgPSB0aGlzLmFkZEZhY2UoKTtcbiAgICAgIHNwbGl0RWRnZTEgPSB0aGlzLmFkZEVkZ2UoKTtcbiAgICAgIHNwbGl0RWRnZTIgPSB0aGlzLmFkZEVkZ2UoKTtcbiAgICAgIHNwbGl0RWRnZTEucGFpciA9IHNwbGl0RWRnZTI7XG4gICAgICBzcGxpdEVkZ2UyLnBhaXIgPSBzcGxpdEVkZ2UxO1xuICAgICAgc3BsaXRFZGdlMS52ID0gZXBuZXh0LnY7XG4gICAgICBzcGxpdEVkZ2UyLnYgPSBuZXdWZXJ0ZXg7XG4gICAgICBcbiAgICAgIC8vZXBhaXIuZlxuICAgICAgZXBhaXIubmV4dCA9IHNwbGl0RWRnZTE7XG4gICAgICBzcGxpdEVkZ2UxLm5leHQgPSBlcG5leHQubmV4dDtcbiAgICAgIGVwYWlyLmZhY2UuZSA9IGVwYWlyO1xuICAgICAgc3BsaXRFZGdlMS5mYWNlID0gZXBhaXIuZmFjZTtcbiAgICAgIFxuICAgICAgLy9uZXdGYWNlXG4gICAgICBuZXdFZGdlUGFpci5mYWNlID0gbmV3RmFjZTtcbiAgICAgIHNwbGl0RWRnZTIuZmFjZSA9IG5ld0ZhY2U7XG4gICAgICBlcG5leHQuZmFjZSA9IG5ld0ZhY2U7XG4gICAgICBuZXdGYWNlLmUgPSBuZXdFZGdlUGFpcjtcbiAgICAgIGVwbmV4dC5uZXh0ID0gc3BsaXRFZGdlMjtcbiAgICAgIHNwbGl0RWRnZTIubmV4dCA9IG5ld0VkZ2VQYWlyO1xuICAgIH0gZWxzZSB7XG4gICAgICBlcGFpci5uZXh0ID0gbmV3RWRnZVBhaXI7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBuZXdWZXJ0ZXg7XG4gIH1cbn0pKCk7XG5cbmhlbWVzaC5wcm90b3R5cGUuc3BsaXRMYXJnZXN0ID0gZnVuY3Rpb24oZSkge1xuICB2YXIgbGFyZ2VzdEVkZ2UgPSB0aGlzLmxvbmdlc3RFZGdlKGUpO1xuICB3aGlsZShsYXJnZXN0RWRnZSAhPSBlKSB7XG4gICAgdGhpcy5zcGxpdExhcmdlc3QobGFyZ2VzdEVkZ2UpO1xuICAgIGxhcmdlc3RFZGdlID0gdGhpcy5sb25nZXN0RWRnZShlKTtcbiAgfVxuICB2YXIgcGFpciA9IGUucGFpcjtcbiAgXG4gIGxhcmdlc3RFZGdlID0gdGhpcy5sb25nZXN0RWRnZShwYWlyKTtcbiAgd2hpbGUobGFyZ2VzdEVkZ2UgIT0gcGFpcikge1xuICAgIHRoaXMuc3BsaXRMYXJnZXN0KGxhcmdlc3RFZGdlKTtcbiAgICBsYXJnZXN0RWRnZSA9IHRoaXMubG9uZ2VzdEVkZ2UocGFpcik7XG4gIH1cbiAgdGhpcy5lZGdlU3BsaXQoZSk7XG59XG5cbmhlbWVzaC5wcm90b3R5cGUubG9uZ2VzdEVkZ2UgPSBmdW5jdGlvbihlKSB7XG4gIGlmKGUuZmFjZSA9PSBudWxsKSB7XG4gICAgcmV0dXJuIGU7XG4gIH0gZWxzZSB7XG4gICAgdmFyIGxvbmdlc3RMZW4gPSB0aGlzLnNxckxlbihlKTtcbiAgICB2YXIgbG9uZ0VkZ2UgPSBlO1xuICAgIHZhciBzdGFydEUgPSBlO1xuICAgIGUgPSBlLm5leHQ7XG4gICAgZG8geyAgICAgIFxuICAgICAgdmFyIGxlbiA9IHRoaXMuc3FyTGVuKGUpO1xuICAgICAgaWYobGVuID4gbG9uZ2VzdExlbikge1xuICAgICAgICBsb25nZXN0TGVuID0gbGVuO1xuICAgICAgICBsb25nRWRnZSA9IGU7XG4gICAgICB9XG4gICAgICBlID0gZS5uZXh0O1xuICAgIH0gd2hpbGUoZSAhPSBzdGFydEUpO1xuICAgIHJldHVybiBsb25nRWRnZTtcbiAgfVxufVxuXG5oZW1lc2gucHJvdG90eXBlLnNxckxlbiA9IGZ1bmN0aW9uKGUpIHtcbiAgcmV0dXJuIHZlYzMuc3FyRGlzdChlLnYucG9zLGUucGFpci52LnBvcyk7XG59XG5cbmhlbWVzaC5wcm90b3R5cGUuZWRnZUZsaXAgPSBmdW5jdGlvbihlKSB7XG4gIHZhciBlcGFpciA9IGUucGFpcjtcbiAgXG4gIGlmKGVwYWlyLmZhY2UgIT0gbnVsbCAmJiBlLmZhY2UgIT0gbnVsbCkge1xuICAgIHZhciBlbmV4dCA9IGUubmV4dDtcbiAgICB2YXIgZW5leHQyID0gZW5leHQubmV4dDtcbiAgICB2YXIgZXBuZXh0ID0gZXBhaXIubmV4dDtcbiAgICB2YXIgZXBuZXh0MiA9IGVwbmV4dC5uZXh0O1xuICAgIHZhciBwMSA9IGUudjtcbiAgICB2YXIgcDIgPSBlcGFpci52O1xuICAgIGUudiA9IGVuZXh0LnY7XG4gICAgZW5leHQuZmFjZSA9IGVwYWlyLmZhY2U7XG4gICAgZXBhaXIudiA9IGVwbmV4dC52O1xuICAgIGVwbmV4dC5mYWNlID0gZS5mYWNlO1xuICAgIC8vbmV3IGZhY2VzXG4gICAgZS5uZXh0ID0gZW5leHQyO1xuICAgIGVuZXh0Mi5uZXh0ID0gZXBuZXh0O1xuICAgIGVwbmV4dC5uZXh0ID0gZTtcbiAgICBcbiAgICBlcGFpci5uZXh0ID0gZXBuZXh0MjtcbiAgICBlcG5leHQyLm5leHQgPSBlbmV4dDtcbiAgICBlbmV4dC5uZXh0ID0gZXBhaXI7XG4gICAgXG4gICAgLy9qdXN0IGluIGNhc2UgZmFjZSBwb2ludHMgdG8gZS5uZXh0LCBub3QgdGhhdCBpdCBzdHJpY3RseSBtYXR0ZXJzXG4gICAgZS5mYWNlLmUgPSBlO1xuICAgIGVwYWlyLmZhY2UuZSA9IGVwYWlyO1xuICAgIFxuICAgIC8vZGVhbCB3aXRoIHZlcnRleCBwb2ludGVyc1xuICAgIHAyLmUgPSBlLm5leHQ7XG4gICAgcDEuZSA9IGVwYWlyLm5leHQ7XG4gIH1cbn1cblxuaGVtZXNoLnByb3RvdHlwZS5nZXRWYWxlbmNlID0gZnVuY3Rpb24ocCkge1xuICB2YXIgZSA9IHAuZTtcbiAgdmFyIGNvdW50ID0gMDtcbiAgZG8ge1xuICAgIGNvdW50Kys7XG4gICAgZSA9IGUubmV4dC5wYWlyO1xuICB9IHdoaWxlKGUgIT0gcC5lKTtcbiAgcmV0dXJuIGNvdW50O1xufVxuXG5oZW1lc2gucHJvdG90eXBlLmdldFZhbGVuY2VFID0gZnVuY3Rpb24oZSkge1xuICB2YXIgc3RhcnRFID0gZTtcbiAgdmFyIGNvdW50ID0gMDtcbiAgZG8ge1xuICAgIGNvdW50Kys7XG4gICAgZSA9IGUubmV4dC5wYWlyO1xuICB9IHdoaWxlKGUgIT0gc3RhcnRFKTtcbiAgcmV0dXJuIGNvdW50O1xufVxuXG4vL2dlbmVyYWwgY29sbGFwc2VcbmhlbWVzaC5wcm90b3R5cGUuc2ltcGxlQ29sbGFwc2UgPSBmdW5jdGlvbihlKSB7ICBcbiAgdmFyIGVwYWlyID0gZS5wYWlyO1xuICB2YXIgZW5leHQsIGVuZXh0MiwgZW5leHRwLCBlbmV4dHAyO1xuICB2YXIgdG9FLHRvRVBhaXI7XG4gIHZhciBwMSA9IGUudjtcbiAgdmFyIHAyID0gZXBhaXIudjtcbiAgcDIuZSA9IG51bGw7XG4gIC8vbmVlZCB0byBjaGVjayBmb3IgZWRnZSB2ZXJ0aWNlcyBlaXRoZXIgdGhyb3VnaCBtYXJraW5nIG9yIGNoZWNraW5nIGVkZ2VzXG4gIGlmKHAxLmIpIHtcbiAgICBpZighcDIuYikge1xuICAgIFxuICAgIH0gZWxzZSB7ICAgIFxuICAgICAgdmVjMy5hZGQocDEucG9zLHAxLnBvcyxwMi5wb3MpO1xuICAgICAgdmVjMy5zY2FsZShwMS5wb3MscDEucG9zLDAuNSk7XG4gICAgICBwMS5iID0gcDIuYjtcbiAgICB9XG4gIH0gZWxzZSBpZihwMi5iKSB7XG4gICAgdmVjMy5jb3B5KHAxLnBvcyxwMi5wb3MpO1xuICAgIHAxLmIgPSBwMi5iO1xuICB9IGVsc2Uge1xuICAgIHZlYzMuYWRkKHAxLnBvcyxwMS5wb3MscDIucG9zKTtcbiAgICB2ZWMzLnNjYWxlKHAxLnBvcyxwMS5wb3MsMC41KTtcbiAgfVxuICAvL3JlbW92ZSBwMlxuICB2YXIgc3RhcnRFID0gZXBhaXI7XG4gIC8vc2xpZ2h0IGluZWZmaWNpZW5jeSwgbm8gbmVlZCB0byByZXBvaW50IGVkZ2VzIHRoYXQgYXJlIGFib3V0IHRvIGJlIHJlbW92ZWRcbiAgZW5leHQgPSBlcGFpcjtcbiAgZG8ge1xuICAgIGVuZXh0LnYgPSBwMTtcbiAgICBpZihlbmV4dC5uZXh0ID09IGUpIHtcbiAgICAgIHRvRSA9IGVuZXh0O1xuICAgIH1cbiAgICBlbmV4dCA9IGVuZXh0Lm5leHQucGFpcjtcbiAgfSB3aGlsZShlbmV4dCAhPSBzdGFydEUpO1xuICBcbiAgdGhpcy5yZW1vdmVWZXJ0ZXgocDIpO1xuXG4gIHN0YXJ0RSA9IGU7XG4gIGVuZXh0ID0gZTtcbiAgZG8ge1xuICAgIGlmKGVuZXh0Lm5leHQgPT0gZXBhaXIpIHtcbiAgICAgIHRvRVBhaXIgPSBlbmV4dDtcbiAgICB9XG4gICAgZW5leHQgPSBlbmV4dC5uZXh0LnBhaXI7XG4gIH0gd2hpbGUoZW5leHQgIT0gc3RhcnRFKTtcbiAgXG4gIHRvRS5uZXh0ID0gZS5uZXh0O1xuICBpZihlLmZhY2UpIGUuZmFjZS5lID0gdG9FO1xuICB0b0Uudi5lID0gdG9FO1xuICBcbiAgdG9FUGFpci5uZXh0ID0gZXBhaXIubmV4dDtcbiAgaWYoZXBhaXIuZmFjZSkgZXBhaXIuZmFjZS5lID0gdG9FUGFpcjtcbiAgXG4gIC8vcmVtb3ZlIGUgYW5kIGVwYWlyXG4gIHRoaXMucmVtb3ZlRWRnZShlKTtcbiAgdGhpcy5yZW1vdmVFZGdlKGVwYWlyKTtcblxuICByZXR1cm4gcDE7XG59XG5cbmV4cG9ydHMuTlVMTEZBQ0UgPSBIRU1FU0hfTlVMTEZBQ0U7XG5leHBvcnRzLmhlbWVzaCA9IGhlbWVzaDtcbmV4cG9ydHMuaGVkZ2UgPSBoZWRnZTtcbmV4cG9ydHMuaGVmYWNlID0gaGVmYWNlO1xuZXhwb3J0cy5oZXZlcnRleCA9IGhldmVydGV4O1xuIiwidmFyIHBtb3VzZVgscG1vdXNlWSxtb3VzZVgsbW91c2VZLHN0YXJ0TW91c2VYLHN0YXJ0TW91c2VZLCBtb3VzZUJ1dHRvbjtcbnZhciBzdGFydE1vdXNlVGltZTtcbmV4cG9ydHMuaXNNb3VzZURvd24gPSBmYWxzZTtcbmV4cG9ydHMubW91c2VEcmFnZ2luZyA9IGZhbHNlO1xuXG5mdW5jdGlvbiBzZXR1cE1vdXNlRXZlbnRzKGNhbnZhcykge1xuICAgIGNhbnZhcy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBvbk1vdXNlTW92ZSk7XG4gICAgY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIG9uTW91c2VEb3duKTtcbiAgICBjYW52YXMuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIG9uTW91c2VVcCk7XG4gICAgY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoJ2NvbnRleHRtZW51JywgZnVuY3Rpb24oZXZlbnQpe2V2ZW50LnByZXZlbnREZWZhdWx0KCk7fSk7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIG9uTW91c2VVcERvYyk7XG4gICAgXG4gICAgc2V0dXBUb3VjaEV2ZW50cyhjYW52YXMpO1xufVxuXG5leHBvcnRzLnNldHVwTW91c2VFdmVudHMgPSBzZXR1cE1vdXNlRXZlbnRzO1xuXG5mdW5jdGlvbiBzZXR1cFRvdWNoRXZlbnRzKGNhbnZhcykge1xuICAgIGlmKGlzVG91Y2hEZXZpY2UoKSkge1xuICAgICAgICBjYW52YXMuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgb25Ub3VjaE1vdmUpO1xuICAgICAgICBjYW52YXMuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIG9uVG91Y2hTdGFydCk7XG4gICAgICAgIGNhbnZhcy5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIG9uVG91Y2hFbmQpO1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIG9uTW91c2VVcERvYyk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBpc1RvdWNoRGV2aWNlKCkge1xuICByZXR1cm4gJ29udG91Y2hzdGFydCcgaW4gd2luZG93IC8vIHdvcmtzIG9uIG1vc3QgYnJvd3NlcnMgXG4gICAgICB8fCAnb25tc2dlc3R1cmVjaGFuZ2UnIGluIHdpbmRvdzsgLy8gd29ya3Mgb24gaWUxMFxufTtcblxuZnVuY3Rpb24gb25Nb3VzZURvd24oZXZlbnQpIHtcbiAgICAvLyBDYW5jZWwgdGhlIGRlZmF1bHQgZXZlbnQgaGFuZGxlclxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICBleHBvcnRzLm1vdXNlRHJhZ2dpbmcgPSBmYWxzZTtcbiAgICB2YXIgcmVjdCA9IGV2ZW50LnRhcmdldC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblxuICAgIHZhciBjdXJyZW50WCA9IGV2ZW50LmNsaWVudFgtcmVjdC5sZWZ0O1xuICAgIHZhciBjdXJyZW50WSA9IGV2ZW50LmNsaWVudFktcmVjdC50b3A7XG4gICAgXG4gICAgZXhwb3J0cy5wbW91c2VYID0gZXhwb3J0cy5tb3VzZVggPSBleHBvcnRzLnN0YXJ0TW91c2VYID0gY3VycmVudFg7XG4gICAgZXhwb3J0cy5wbW91c2VZID0gZXhwb3J0cy5tb3VzZVkgPSBleHBvcnRzLnN0YXJ0TW91c2VZID0gY3VycmVudFk7XG5cbiAgICBleHBvcnRzLmlzTW91c2VEb3duID0gdHJ1ZTtcbiAgICBleHBvcnRzLm1vdXNlQnV0dG9uID0gZXZlbnQud2hpY2g7XG4gICAgZXhwb3J0cy5zdGFydE1vdXNlVGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgIGlmKHR5cGVvZiBleHBvcnRzLm1vdXNlRG93biAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgZXhwb3J0cy5tb3VzZURvd24oKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIG9uTW91c2VNb3ZlKGV2ZW50KSB7XG4gICAgLy8gQ2FuY2VsIHRoZSBkZWZhdWx0IGV2ZW50IGhhbmRsZXJcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIFxuICAgIHZhciByZWN0ID0gZXZlbnQudGFyZ2V0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXG4gICAgdmFyIGN1cnJlbnRYID0gZXZlbnQuY2xpZW50WC1yZWN0LmxlZnQ7XG4gICAgdmFyIGN1cnJlbnRZID0gZXZlbnQuY2xpZW50WS1yZWN0LnRvcDtcbiAgICBcbiAgICBleHBvcnRzLnBtb3VzZVggPSBleHBvcnRzLm1vdXNlWDtcbiAgICBleHBvcnRzLnBtb3VzZVkgPSBleHBvcnRzLm1vdXNlWTtcbiAgICBcbiAgICBleHBvcnRzLm1vdXNlWCA9IGN1cnJlbnRYO1xuICAgIGV4cG9ydHMubW91c2VZID0gY3VycmVudFk7XG4gICAgaWYoZXhwb3J0cy5tb3VzZVggIT0gZXhwb3J0cy5wbW91c2VYIHx8IGV4cG9ydHMubW91c2VZICE9IGV4cG9ydHMucG1vdXNlWSkge1xuICAgICAgICBpZih0eXBlb2YgZXhwb3J0cy5tb3VzZU1vdmVkICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgZXhwb3J0cy5tb3VzZU1vdmVkKGV2ZW50KTtcbiAgICAgICAgfVxuICAgICAgICBpZihleHBvcnRzLmlzTW91c2VEb3duKSB7XG4gICAgICAgICAgICBleHBvcnRzLm1vdXNlRHJhZ2dpbmcgPSB0cnVlO1xuICAgICAgICAgICAgaWYodHlwZW9mIGV4cG9ydHMubW91c2VEcmFnZ2VkICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIGV4cG9ydHMubW91c2VEcmFnZ2VkKGV2ZW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gb25Nb3VzZVVwKGV2ZW50KSB7XG4gICAgLy8gQ2FuY2VsIHRoZSBkZWZhdWx0IGV2ZW50IGhhbmRsZXJcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGV4cG9ydHMuaXNNb3VzZURvd24gPSBmYWxzZTtcbiAgICBpZih0eXBlb2YgZXhwb3J0cy5tb3VzZVVwICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBleHBvcnRzLm1vdXNlVXAoZXZlbnQpO1xuICAgIH1cbiAgICBpZighZXhwb3J0cy5tb3VzZURyYWdnaW5nICYmICh0eXBlb2YgZXhwb3J0cy5tb3VzZUNsaWNrZWQgIT09ICd1bmRlZmluZWQnKSkge1xuICAgICAgICBleHBvcnRzLm1vdXNlQ2xpY2tlZChldmVudCk7XG4gICAgfVxuICAgIGV4cG9ydHMubW91c2VEcmFnZ2luZyA9IGZhbHNlO1xufVxuXG5mdW5jdGlvbiBvbk1vdXNlVXBEb2MoZXZlbnQpIHtcbiAgICBleHBvcnRzLmlzTW91c2VEb3duID0gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIG9uVG91Y2hTdGFydChldmVudCkge1xuICAgIC8vIENhbmNlbCB0aGUgZGVmYXVsdCBldmVudCBoYW5kbGVyXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgIG1vdXNlRHJhZ2dpbmcgPSBmYWxzZTtcbiAgICB2YXIgcmVjdCA9IGV2ZW50LnRhcmdldFRvdWNoZXNbMF0udGFyZ2V0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXG4gICAgdmFyIGN1cnJlbnRYID0gZXZlbnQudGFyZ2V0VG91Y2hlc1swXS5jbGllbnRYLXJlY3QubGVmdDtcbiAgICB2YXIgY3VycmVudFkgPSBldmVudC50YXJnZXRUb3VjaGVzWzBdLmNsaWVudFktcmVjdC50b3A7XG4gICAgXG4gICAgcG1vdXNlWCA9IG1vdXNlWCA9IHN0YXJ0TW91c2VYID0gY3VycmVudFg7XG4gICAgcG1vdXNlWSA9IG1vdXNlWSA9IHN0YXJ0TW91c2VZID0gY3VycmVudFk7XG4gICAgY29uc29sZS5sb2coXCJ0b3VjaCBzdGFydFwiKTtcbiAgICBpc01vdXNlRG93biA9IHRydWU7XG4gICAgLy9tb3VzZUJ1dHRvbiA9IGV2ZW50LmJ1dHRvbjtcbiAgICBtb3VzZUJ1dHRvbiA9IDA7XG4gICAgc3RhcnRNb3VzZVRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICBpZih0eXBlb2YgbW91c2VEb3duICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBtb3VzZURvd24oKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIG9uVG91Y2hNb3ZlKGV2ZW50KSB7XG4gICAgLy8gQ2FuY2VsIHRoZSBkZWZhdWx0IGV2ZW50IGhhbmRsZXJcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIFxuICAgIHZhciByZWN0ID0gZXZlbnQudGFyZ2V0VG91Y2hlc1swXS50YXJnZXQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cbiAgICB2YXIgY3VycmVudFggPSBldmVudC50YXJnZXRUb3VjaGVzWzBdLmNsaWVudFgtcmVjdC5sZWZ0O1xuICAgIHZhciBjdXJyZW50WSA9IGV2ZW50LnRhcmdldFRvdWNoZXNbMF0uY2xpZW50WS1yZWN0LnRvcDtcbiAgICBcbiAgICBwbW91c2VYID0gbW91c2VYO1xuICAgIHBtb3VzZVkgPSBtb3VzZVk7XG4gICAgXG4gICAgbW91c2VYID0gY3VycmVudFg7XG4gICAgbW91c2VZID0gY3VycmVudFk7XG4gICAgaWYodHlwZW9mIG1vdXNlTW92ZWQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIG1vdXNlTW92ZWQoKTtcbiAgICB9XG4gICAgaWYoaXNNb3VzZURvd24pIHtcbiAgICAgICAgbW91c2VEcmFnZ2luZyA9IHRydWU7XG4gICAgICAgIGlmKHR5cGVvZiBtb3VzZURyYWdnZWQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBtb3VzZURyYWdnZWQoKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gb25Ub3VjaEVuZChldmVudCkge1xuICAgIC8vIENhbmNlbCB0aGUgZGVmYXVsdCBldmVudCBoYW5kbGVyXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICBpc01vdXNlRG93biA9IGZhbHNlO1xuICAgIGlmKHR5cGVvZiBtb3VzZVVwICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBtb3VzZVVwKCk7XG4gICAgfVxuICAgIGlmKCFtb3VzZURyYWdnaW5nICYmICh0eXBlb2YgbW91c2VDbGlja2VkICE9PSAndW5kZWZpbmVkJykpIHtcbiAgICAgICAgbW91c2VDbGlja2VkKCk7XG4gICAgfVxuICAgIG1vdXNlRHJhZ2dpbmcgPSBmYWxzZTtcbn1cbiJdfQ==
