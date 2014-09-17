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

var epsilon = 0.00001;
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
  //add boundary edges and ensure every edge has a pair
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
  if(pt[0] >= width-epsilon) {
    insideVal = Math.min(insideVal, rightOn ? 0 : -1);
  }
  if(pt[0] <= epsilon) {
    insideVal = Math.min(insideVal, leftOn ? 0 : -1);
  }
  if(pt[1] >= height-epsilon) {
    insideVal = Math.min(insideVal, topOn ? 0 : -1);
  }
  if(pt[1] <= epsilon) {
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

var EPSILON = 0.00001;

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

exports.init = init;
exports.reset = reset;
exports.voronoi = voronoi;
exports.pts = pts;
exports.triangles = triangles;
exports.setDimensions = setDimensions;
exports.centroidal = centroidal;
exports.mesh = voroMesh;