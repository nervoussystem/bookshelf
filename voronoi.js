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

var boundary = [];
boundary.push([0,0,0]);
boundary.push([width,0,0]);
boundary.push([width,height,0]);
boundary.push([0,height,0]);
boundary = boundary.reverse();
var epsilon = 0.00001;
function reset() {
  //make regularly spaced points
  pts.length = 0;
  
  var defaultSpacing = 200;
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
  boundary.length = 0;
  boundary.push([0,0,0]);
  boundary.push([0,height,0]);
  boundary.push([width,height,0]);
  boundary.push([width,0,0]);
  
  updateOutsidePts();
}

function updateOutsidePts() {
  //get bounding box
  var maxX = -9e9, minX = 9e9, maxY = -9e9, minY = 9e9;
  for(var i=0;i<boundary.length;++i) {
    var pt = boundary[i];
    maxX = Math.max(maxX, pt[0]);
    minX = Math.min(minX, pt[0]);
    maxY = Math.max(maxY, pt[1]);
    minY = Math.min(minY, pt[1]);
  }
  width = maxX;
  height = maxY;
  outsidePts.length = 0;
  var d = 5000;
  outsidePts.push({x:minX,y:minY-d,fixed:true,bottom:true});
  outsidePts.push({x:(minX+maxX)*0.5,y:minY-d,fixed:true,bottom:true});
  outsidePts.push({x:maxX,y:minY-d,fixed:true,bottom:true});

  outsidePts.push({x:maxX+d,y:minY,fixed:true,right:true});
  outsidePts.push({x:maxX+d,y:(maxY+minY)*0.5,fixed:true,right:true});
  outsidePts.push({x:maxX+d,y:maxY,fixed:true,right:true});

  outsidePts.push({x:maxX,y:maxY+d,fixed:true,top:true});
  outsidePts.push({x:(maxX+minX)*0.5,y:maxY+d,fixed:true,top:true});
  outsidePts.push({x:minX,y:maxY+d,fixed:true,top:true});

  outsidePts.push({x:minX-d,y:maxY,fixed:true,left:true});
  outsidePts.push({x:minX-d,y:(minY+maxY)*0.5,fixed:true,left:true});
  outsidePts.push({x:minX-d,y:minY,fixed:true,left:true});
}

var voronoi = (function() {
  var p1 = vec2.create();
  var p2 = vec2.create();
  var p3 = vec2.create();
  return function voronoi() {
    var triangulation = new SweepContext(outsidePts);
    
    //limit pts
    for(var i=0;i<pts.length;++i) {
      var pt = pts[i];
      pt.x = Math.max(0,Math.min(pt.x,width));
      pt.y = Math.max(0,Math.min(pt.y,height));
    }
    
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
    makeBoundaryEdges(voroMesh);
    markInsideOut();
    trimCells();
  }
})();

function markInsideOut() {
  for(var i=0;i<voroMesh.vertices.length;++i) {
    var v = voroMesh.vertices[i];
    var winding = windingNumber(v.pos, boundary);
    if(winding == 0) {
      v.isInside = false;
    } else {
      v.isInside = true;
    }
  }
}

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
  
  boundary[3][0] = width;
  boundary[2][0] = width;
  boundary[2][1] = height;
  boundary[1][1] = height;
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
          pt.x += dx*.1;
          pt.y += dy*.1;
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
        if(!pt.cell) {
          buildCell(pt,t);
        }
      }
    }
  }
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

function makeBoundaryEdges(mesh) {
  //add boundary edges and ensure every edge has a pair
  var numEdges = mesh.edges.length;
  var e,v,startV;
  var ptToEdge = [];
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
      ptToEdge[startV.index] = newEdge;
    }
  }
  for(var i=numEdges;i<mesh.edges.length;++i) {
    e = mesh.edges[i];
    var ptEdge = ptToEdge[e.v.index];
    if(ptEdge) {
      e.next = ptEdge;
    } else {
      console.log("error: no next boundary found");
    }
  }
}

function isInside(pt) {
  return pt.isInside;
  //return pt[0] > 0 && pt[0] < width && pt[1] > 0 && pt[1] < height;
}

var segSegIntersect = function(out,s1pt1,s1pt2,s2pt1,s2pt2) {
    var dx1 = s1pt2[0]-s1pt1[0];
    var dx2 = s2pt2[0]-s2pt1[0];
    var dy1 = s1pt2[1]-s1pt1[1];
    var dy2 = s2pt2[1]-s2pt1[1];
    var ax = s2pt1[0]-s1pt1[0];
    var ay = s2pt1[1]-s1pt1[1];
    //z component of cross product: sin(A)*|L1||L2|
    var crossish =  dx1*dy2-dy1*dx2;
    var u = (ax*dy1-ay*dx1)/crossish;
    if(u <= 0 || u > 1) return false;
    var t = (ax*dy2-ay*dx2)/crossish;
    if(t < 0 || t > 1) return false;
    out[0] = dx2*u+s2pt1[0];
    out[1] = dy2*u+s2pt1[1];
    return true;
};

var trimEdge = (function() {
  var dir = vec2.create();
  var dir2 = vec2.create();
  var bPt;
  
  return function trimEdge(out, inP,outP) {
    var prevPt = boundary[boundary.length-1];
    var prevIndex = boundary.length-1;
    vec2.sub(dir, outP, inP);
    var len = vec2.len(dir);
    vec2.scale(dir,dir,1.0/len);
    for(var i=0;i<boundary.length;++i) {
      bPt = boundary[i];
      if(segSegIntersect(out, inP, outP, prevPt, bPt)) {
        return i;
        //return prevIndex;
      }
      
      prevIndex = i;
      prevPt = bPt;
    }
  }
})();

var trimEdgeX = (function() {  
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
        return 3;
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
    return 0;
  }
})();

var EPSILON = 0.00001;

var trimCells = (function() {
  var f, e, tInfo, tv;
  var pt = vec3.create();
  return function trimCells() {
    for(var i=0;i<voroMesh.edges.length;++i) {
      e = voroMesh.edges[i];
      if(!isInside(e.v) && isInside(e.pair.v)) {
        e.info.trimmed = true;
        tInfo = trimEdge(pt, e.pair.v.pos,e.v.pos);
        tv = voroMesh.addVertex(pt);
        tv.w = eWeight;
        tv.b = true;
        tv.isInside = true;
        e.info.trimIndex = tInfo;
        e.v = tv;
        tv.e = e;
      } 
    }
    for(var i=0,l = voroMesh.faces.length;i<l; ++i) {
      f = voroMesh.faces[i];
      trimFace(f);
    }
    makeBoundaryEdges(voroMesh);

    //clean
    for(var i=0;i<voroMesh.vertices.length;) {
      if(!isInside(voroMesh.vertices[i])) {
        voroMesh.vertices.splice(i,1);
      } else {
        voroMesh.vertices[i].index = i;
        i++;
      }
    }
    for(var i=0;i<voroMesh.edges.length;) {
      e = voroMesh.edges[i];
      if(!isInside(e.v) && (e.pair.v == null || !isInside(e.pair.v))) {
        e.pair = null;
        e.next = null;
        e.v = null;
        e.face = null;
        voroMesh.edges.splice(i,1);
      } else {
        e.index = i;
        i++;
      }
    }
    
  }
})();

var trimFace = (function() {
  var trimPt = vec3.create();
  var v,e, startE;
  var newV, trimE, trimE2;
  return function trimFace(f) {
    startE = f.e;
    e = startE;
    //get trimmed edge
    do {
      e = e.next;
    } while(!e.info.trimmed && e != startE);
    if(!e.info.trimmed) return;
    
    trimE = e;
    do {
      e = e.next;
    } while(!e.pair.info.trimmed && e != trimE);
    if(e == trimE) {
      console.log("error: out edge find, but no in edge");
      return;
    }
    trimE2 = e.pair;
    
    var bIndex = trimE.info.trimIndex;
    e = trimE;
    while(bIndex != trimE2.info.trimIndex) {
      var newV = voroMesh.addVertex(boundary[bIndex]);
      newV.pos[2] = 0;
      newV.isInside = true;
      newV.w = eWeight;
      var newE = voroMesh.addEdge();
      newE.v = newV;
      newV.e = newE;
      newE.face = f;
      
      e.next = newE;
      e = newE;
      
      bIndex = (bIndex+1)%boundary.length;
    }
    //add edge to trimE2.v
    f.e = trimE;
    var newE = voroMesh.addEdge();
    newE.v = trimE2.v;
    e.next = newE;
    newE.next = trimE2.pair;
    newE.face = f;
  }
})();

var trimFace2 = (function() {
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
    } while(isInside(e.v) <= 0 && e != startE);
    startE = e;
    //find first outside pt
    do {
      
      prevE = e;
      e = e.next;
    } while(isInside(e.v) > 0 && e != startE);
    
    if(isInside(e.v) > 0) { return; }
    
    if(isInside(e.v) < 0) f.on = false;
    
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
    while(isInside(e.v) <= 0 && e != startE) {
      if(isInside(e.v) < 0) f.on = false;
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
    if(Math.abs(startE.v.pos[0]-newV.pos[0]) > EPSILON && Math.abs(startE.v.pos[1]-newV.pos[1]) > EPSILON) {
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

/*
  point in polygon adapted from http://geomalgorithms.com/a03-_inclusion.html
  Copyright 2000 softSurfer, 2012 Dan Sunday
  javascript port by Jesse Louis-Rosenberg 2015
*/
function isLeft(p0, p1, p2 )
{
    return ( (p1[0] - p0[0]) * (p2[1] - p0[1])
            - (p2[0] -  p0[0]) * (p1[1] - p0[1]) );
}
//===================================================================


function windingNumber(p,poly) {
  var wn = 0;    // the  winding number counter
  var v1,v2;
  //loop through all edges of the polygon
  for (var i=0; i<poly.length; i++) {   // edge from V[i] to  V[i+1]
    v1 = poly[i];
    var iNext = (i+1)%poly.length;
    v2 = poly[iNext];
    if (v1[1] <= p[1]) {          // start y <= P.y
      if (v2[1]  > p[1])      // an upward crossing
        if (isLeft( v1,v2, p) > 0)  // P left of  edge
          ++wn;            // have  a valid up intersect
    }
    else {                        // start y > P.y (no test needed)
      if (v2[1]  <= p[1])     // a downward crossing
        if (isLeft( v1, v2, p) < 0)  // P right of  edge
          --wn;            // have  a valid down intersect
    }
  }
  return wn;
}

exports.init = init;
exports.reset = reset;
exports.voronoi = voronoi;
exports.pts = pts;
exports.boundary = boundary;
exports.triangles = triangles;
exports.setDimensions = setDimensions;
exports.centroidal = centroidal;
exports.mesh = voroMesh;
exports.updateOutsidePts = updateOutsidePts;