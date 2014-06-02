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
      vec3.sub(dirs[index],e.v.pos,center);
      len = vec3.len(dirs[index]);
      vec3.scale(dirs[index],dirs[index],1.0/len);
      labels[index] = e.info.label;
      //console.log(e.info.label);
      lengths[index] = len;
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
      
      cLen = lengths[i]-shelfOffset*2;
      aLen = accuracy * Math.floor(cLen / accuracy);
      lenDiff = (cLen-aLen)*0.5;
      
      vec2.set(perp,dir[1],-dir[0]);
      vec3.scaleAndAdd(pt,center, dir, conLen+shelfOffset+lenDiff);
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
      vec3.scaleAndAdd(pt,center, nDir, conLen+shelfOffset+lenDiff);
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
    
    //add label holes
    var labelSpace = 1;
    for(var i=0;i<numLegs;++i) {
      //make points
      dir = dirs[i];
      vec2.set(perp,dir[1],-dir[0]);
      vec3.scaleAndAdd(pt,center, dir, shelfOffset-labelSpace);
      vec2.scaleAndAdd(pt,pt,perp,labelHeight);
      addConnectorPt(vboOut,pt);
      
      vec2.scaleAndAdd(pt,pt,perp,-labelHeight*2);
      addConnectorPt(vboOut,pt);
      
      vec2.scaleAndAdd(pt,pt,dir,-labelHeight);
      addConnectorPt(vboOut,pt);
      
      vec2.scaleAndAdd(pt,pt,perp,labelHeight*2);
      addConnectorPt(vboOut,pt);
      vec3.copy(labelsPt[i],pt);
      
    }
    
    //stitch sides
    for(var i=0;i<numPts;++i) {
      var iNext = (i+1)%numPts;
      vboMesh.addTriangle(vboOut,baseIndex+i*2,baseIndex+iNext*2+1,baseIndex+i*2+1);
      vboMesh.addTriangle(vboOut,baseIndex+i*2,baseIndex+iNext*2,baseIndex+iNext*2+1);
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
      var tens = Math.floor(labels[i]/10);
      var ones = Math.round(labels[i]-tens*10);
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
      
      vec2.scaleAndAdd(pt,pt,perp,-labelHeight*2);
      innerCrvs[i].push({x:pt[0],y:pt[1],index:numPts});
      vboMesh.addVertex(vboOut,pt);
      numPts++;
      
      vec2.scaleAndAdd(pt,pt,dir,-labelHeight);
      innerCrvs[i].push({x:pt[0],y:pt[1],index:numPts});
      vboMesh.addVertex(vboOut,pt);
      numPts++;
      
      vec2.scaleAndAdd(pt,pt,perp,labelHeight*2);
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