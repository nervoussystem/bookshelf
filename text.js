"use strict"

var poly2tri = require('./poly2tri.js');
var vboMesh = require('./vboMesh.js');
var glMatrix = require('../js/gl-matrix-min.js');
var vec2 = glMatrix.vec2;

var numVbos = [];

function init(gl) {
  vboMesh.setGL(gl);
  for(var i=0;i<10;++i) {
    numVbos[i] = vboMesh.create();
    var xhr = new XMLHttpRequest();
    xhr.open("GET","geometry/"+i+".txt");
    xhr.onreadystatechange = (function(vbo) {
      return function() {
        if(xhr.readyState == 4 && xhr.status == 200) {
          var outline = JSON.parse(xhr.responseText);
          makeTextVbo(vbo,outline);
        }
      }
    })(numVbos[i]);
    xhr.send();
  }
}

var makeTextVbo = function(vbo,outline) {
  vboMesh.clear(vbo);
  var min = vec2.create();
  var max = vec2.create();
  vec2.copy(min,outline[0]);
  vec2.copy(max,outline[0]);
  for(var i=0;i<outline.length;++i) {
    var pt = outline[i];
    min = vec2.min(min,pt);
    max = vec2.max(max,pt);
  }
  var scaling = 1.0/(max[1]-min[1]);
  var triPts = [];
  for(var i=0;i<outline.length;++i) {
    var pt = outline[i];
    vec2.sub(pt,pt,min);
    vec2.scale(pt,pt,scaling);
    triPts.push({x:pt[0],y:pt[1],index:i});
    vboMesh.addVertex(vbo,pt);
  }
  var triangulation = new SweepContext(triPts);
  triangulation.triangulate();
  var triangles = triangulation.getTriangles();
  for(var i=0;i<triangles.length;++i) {
    var tri = triangles[i];
    vboMesh.addTriangle(vbo,tri.points_[0].index,tri.points_[1].index,tri.points_[2].index);
  }

}

exports.init = init;
exports.numVbos = numVbos;