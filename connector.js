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
