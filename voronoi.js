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