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