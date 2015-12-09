"use strict"

var glShader = require('../js/glShader.js');
var glMatrix = require('../js/gl-matrix-min.js');
var poly2tri = require('./poly2tri.js');
var glUtils = require('./glUtils.js');
var voronoi = require('./voronoi.js');
var vboMesh = require('./vboMesh.js');
var connector = require('./connector.js');
var pointer = require('../js/pointer.js');
var camera = require('./camera.js');
var bookshelf = require('./bookshelf.js');
var gui = require('./gui.js');
var vec2 = glMatrix.vec2;
var vec3 = glMatrix.vec3;
var vec4 = glMatrix.vec4;
var mat4 = glMatrix.mat4;
var mat3 = glMatrix.mat3;
var quat = glMatrix.quat;

var canvas;
var canvas2d;
var ctx;
var gl;
var colorShader;
var phongShader;
var voronoiEdges;
var mvMatrix = mat4.create();
var pMatrix = mat4.create();
var nMatrix = mat3.create();
var connectorVbo;
var shelfVbo;
var circleVbo;
var tempVbo;

var colorInfo;

var minimumShelf = 75;//85;//105;
var flattenAngle = 0;//Math.PI*.1;
bookshelf.flattenAngle = flattenAngle;
var sinFlattenAngle = Math.sin(flattenAngle);

var selectedPt = -1;

var window2dWidth = 800;

init();

function init() {
//stupid
	document.addEventListener( "keydown",keyPress,false);
	document.addEventListener( 'drop', onDocumentDrop, false );
	document.addEventListener( 'dragover', function(event){event.preventDefault();}, false );
	document.addEventListener( 'dragleave', function(event){event.preventDefault();}, false );

  canvas = document.getElementById("gl");
  canvas2d = document.getElementById("2d");
  pointer.setupMouseEvents(canvas);
  camera.screenCenter = [1200,400];
  ctx = canvas2d.getContext('2d');
  gl = glUtils.init(canvas);
  //setupGui();
  
  gui.setColorCallback(setConnectorColor);
  gui.setSaveFunction(save);
  gui.init();
  colorShader = glShader.loadShader(gl,"../shaders/simpleColor.vert","../shaders/simpleColor.frag");
  phongShader = glShader.loadShader(gl,"../shaders/phongSimple.vert","../shaders/phongSimple.frag");
  vboMesh.setGL(gl);
  var loadId = getUrlVars()['id'];
  initVoronoi();
  if(loadId) {
    load(loadId);
  }
  connector.initConnector(gl);
  
  voronoiEdges = vboMesh.create();
  connectorVbo = vboMesh.create32();
  tempVbo = vboMesh.create();
  shelfVbo = vboMesh.create();
  vboMesh.enableTexCoord(shelfVbo);
  vboMesh.enableNormals(shelfVbo);
  initCircle();
  requestAnimationFrame(step);
  
  quat.rotateY(camera.rot,camera.rot,195*Math.PI/180.0);
  quat.rotateX(camera.rot,camera.rot,15*Math.PI/180.0);
  vec3.set(camera.center,bookshelf.width*0.5,bookshelf.height*0.5,5);
  //gui.init();
}

function initCircle() {
  circleVbo = vboMesh.create();
  vboMesh.addVertex(circleVbo,[0,0,0]);
  for(var i=0;i<=12;++i) {
    var angle = i*Math.PI*2.0/12.0;
    vboMesh.addVertex(circleVbo, [6*Math.cos(angle),6*Math.sin(angle),0]);
  }
  vboMesh.buffer(circleVbo,gl);
}

function step() {
  requestAnimationFrame(step);
  var maxX = -9e9, minX = 9e9, maxY = -9e9, minY = 9e9;
  for(var i=0;i<voronoi.boundary.length;++i) {
    var pt = voronoi.boundary[i];
    maxX = Math.max(maxX, pt[0]);
    minX = Math.min(minX, pt[0]);
    maxY = Math.max(maxY, pt[1]);
    minY = Math.min(minY, pt[1]);
  }
  vec3.set(camera.center,(maxX+minX)*0.5,(maxY+minY)*0.5,bookshelf.depth*0.5);
  camera.step();
  checkHover();
  dragHover();
  vboMesh.clear(connectorVbo);
  voronoi.voronoi();
  voronoi.centroidal();
  fixShelves();
  fixShelves();
  fixShelves();
  fixShelves();
  flattenShelves();
  getConnectors();
  drawShelves();
  draw();
  gui.setNumCellsUI();
  
  document.getElementById("selected").innerHTML = getTotalWood();
}

function onDocumentDrop(event) {
  event.preventDefault();
  var file = event.dataTransfer.files[ 0 ];
  var filename = file.name;
  if(filename.substr(filename.length-4,4) == ".obj") {
    var reader = new FileReader();
    
    reader.onload = function ( event ) {
      loadObj(event.target.result.split("\n"),voronoi.mesh);
      vboMesh.clear(connectorVbo);
      getConnectors();
      download();
    };
        
    reader.readAsText( file );
  }
}

function loadObj(lines,mesh) {
  mesh.edges.length = 0;
  mesh.faces.length = 0;
  mesh.vertices.length = 0;
  var pt = vec3.create();
  var ptToEdge = [];
  
  var j;
  var tri = [];
  for(var i=0,len=lines.length;i<len;++i) {
    var tokens = lines[i].split(" ");
    if(tokens[0] == "v") {
       var v = mesh.addVertex([parseFloat(tokens[1]), parseFloat(tokens[2]), parseFloat(tokens[3])]);
    } else if(tokens[0] == "f") {
      var newFace = mesh.addFace();
      tri.length = 0;
      for(j=1;j<tokens.length;++j) {
        tri.push(parseInt(tokens[j].split("/")[0])-1);
      }
      
      var i1 = tri[tri.length-1];
      var prevEdge = null;
      for(j=0;j<tri.length;++j) {
        var i2 = tri[j];
        var newEdge1 = mesh.addEdge();
        newEdge1.v = mesh.vertices[i2];
        mesh.vertices[i2].e = newEdge1;
        newEdge1.face = newFace;
        
        findPair(newEdge1, ptToEdge,i1,i2);
        if(prevEdge != null) {
          prevEdge.next = newEdge1;
          newEdge1.prev = prevEdge;
        }
        if(j==0) {
          newFace.e = newEdge1;
        }
        i1 = i2;
        prevEdge = newEdge1;
        
      }
      prevEdge.next = newFace.e;
      newFace.e.prev = prevEdge;
      newFace.on = true;
    }
  }
  
  makeBoundaryEdges(mesh,ptToEdge);
}

function findPair(e,ptToEdge,i1,i2) {
  var ptEdge = ptToEdge[i2];
  if(ptEdge) {
    for(var i=0;i<ptEdge.length;++i) {
      var e2 = ptEdge[i];
      if(e2.v.index == i1) {
        e2.pair = e;
        e.pair = e2;
        console.log("found pair");
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
  for(var i=0;i<numEdges;++i) {
    var e = mesh.edges[i];
    if(e.pair == null) {
      var newEdge = mesh.addEdge();
      newEdge.pair = e;
      e.pair = newEdge;
      //hack only works for triangles (should load edges in pairs instead)
      //if prev pointer is add could use e.prev.v;
      newEdge.v = e.prev.v;
      newEdge.v.b = true;
      var ptEdge = ptToEdge[e.v.index];
      ptEdge.push(newEdge);
    }
  }
  for(var i=numEdges;i<mesh.edges.length;++i) {
    var e = mesh.edges[i];
    var ptEdge = ptToEdge[e.v.index];
    if(ptEdge) {
      for(var j=0;j<ptEdge.length;++j) {
        var e2 = ptEdge[j];
        if(e2.face == null) {
          e.next = e2;
        }
      }
    }
  }
}

function draw() {
  //draw2d();
  draw3d();
}

function draw2d() {
  ctx.clearRect(0,0,canvas.offsetWidth,canvas.offsetHeight);
  var scaling = Math.min(canvas.offsetWidth/bookshelf.width,canvas.offsetHeight/bookshelf.height);
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

function drawShelves() {
  vboMesh.clear(shelfVbo);
  for(var i=0;i<voronoi.mesh.edges.length;++i) {
    var e = voronoi.mesh.edges[i];
    if(e.v.e) {
      if(e.v.index < e.pair.v.index) {
        drawShelf(shelfVbo,e);
      }
    }
  }
  vboMesh.buffer(shelfVbo);
}

var drawShelf = (function() {
  var center = vec3.create();
  var dir = vec3.create();
  var perp = vec3.create();
  var pts = new Array(8);
  for(var i=0;i<pts.length;++i) pts[i] = vec3.create();
  return function drawShelf(vboOut, e) {
    var length = connector.getShelfLength(e);
    vec3.add(center,e.v.pos,e.pair.v.pos);
    vec3.scale(center,center,0.5);
    vec3.sub(dir,e.v.pos,e.pair.v.pos);
    vec3.normalize(dir,dir);
    vec3.set(perp,dir[1],-dir[0],0);

    //top
    vec3.scaleAndAdd(pts[0],center,dir,length*0.5);
    vec3.scaleAndAdd(pts[0],pts[0],perp,bookshelf.woodWidth*0.5);
    vec3.copy(pts[1],pts[0]);
    pts[1][2] = bookshelf.depth;
    
    vec3.scaleAndAdd(pts[3],center,dir,-length*0.5);
    vec3.scaleAndAdd(pts[3],pts[3],perp,bookshelf.woodWidth*0.5);
    vec3.copy(pts[2],pts[3]);
    pts[2][2] = bookshelf.depth;

    addQuadFaceTex(vboOut,pts[0],pts[1],pts[2],pts[3],[length,0],[length,bookshelf.depth],[0,bookshelf.depth],[0,0],perp);
    //bottom
    vec3.negate(perp,perp);

    vec3.scaleAndAdd(pts[4],center,dir,length*0.5);
    vec3.scaleAndAdd(pts[4],pts[4],perp,bookshelf.woodWidth*0.5);
    vec3.copy(pts[5],pts[4]);
    pts[5][2] = bookshelf.depth;
    
    vec3.scaleAndAdd(pts[7],center,dir,-length*0.5);
    vec3.scaleAndAdd(pts[7],pts[7],perp,bookshelf.woodWidth*0.5);
    vec3.copy(pts[6],pts[7]);
    pts[6][2] = bookshelf.depth;
    
    addQuadFaceTex(vboOut,pts[4],pts[5],pts[6],pts[7],[length,0],[length,bookshelf.depth],[0,bookshelf.depth],[0,0],perp);
    
    //sides
    addQuadFaceTex(vboOut,pts[1],pts[5],pts[6],pts[2],[length,0],[length,1],[0,1],[0,0],[0,0,1]);
    addQuadFaceTex(vboOut,pts[0],pts[4],pts[7],pts[3],[length,0],[length,1],[0,1],[0,0],[0,0,-1]);

    addQuadFaceTex(vboOut,pts[0],pts[1],pts[5],pts[4],[length,0],[length,1],[0,1],[0,0],dir);
    vec3.negate(dir,dir);
    addQuadFaceTex(vboOut,pts[3],pts[2],pts[6],pts[7],[length,0],[length,1],[0,1],[0,0],dir);
    
  }
})();

function addQuadFaceTex(vboOut,p1,p2,p3,p4,t1,t2,t3,t4,n) {
  vboMesh.addVertex(vboOut,p1,n);
  vboMesh.addTexCoord(vboOut,t1);
  vboMesh.addVertex(vboOut,p2,n);
  vboMesh.addTexCoord(vboOut,t2);
  vboMesh.addVertex(vboOut,p3,n);
  vboMesh.addTexCoord(vboOut,t3);
  
  vboMesh.addVertex(vboOut,p1,n);
  vboMesh.addTexCoord(vboOut,t1);
  vboMesh.addVertex(vboOut,p3,n);
  vboMesh.addTexCoord(vboOut,t3);
  vboMesh.addVertex(vboOut,p4,n);
  vboMesh.addTexCoord(vboOut,t4);
  
  
}

function draw3d() {
  gl.viewport(0,0,1600,800);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  if(!colorShader.isReady || !phongShader.isReady) return;
  //draw2dGL();
  gl.viewport(400,0,800,800);
  
  phongShader.begin();
  mat4.identity(mvMatrix);
  var maxDim = voronoi.boundary.reduce(function(prev,curr, index, array) {return Math.max(prev, curr[0], curr[1]);},0)*0.5+100;
  mat4.ortho(pMatrix,-maxDim,maxDim,maxDim,-maxDim,-3000,3000);
  camera.feed(mvMatrix);
  //set color
  phongShader.uniforms.ambientLightingColor.set([.3,.3,.3]);
  phongShader.uniforms.directionalDiffuseColor.set([.7,.7,.7]);//.7
  var lightingDir = [.3,.3,.8];//[.3,.3,.8];
  vec3.normalize(lightingDir,lightingDir);
  phongShader.uniforms.lightingDirection.set(lightingDir);
  phongShader.uniforms.materialShininess.set(8);
  
  //set matrices
  mat3.normalFromMat4(nMatrix,mvMatrix);
  phongShader.uniforms.mvMatrix.set(mvMatrix);
  phongShader.uniforms.nMatrix.set(nMatrix);
  phongShader.uniforms.pMatrix.set(pMatrix);
    
  phongShader.uniforms.matColor.set([0,0,0,1]);
  phongShader.attribs.vertexPosition.set(circleVbo.vertexBuffer);
  phongShader.attribs.vertexNormal.disable();
  phongShader.attribs.vertexPosition.set(circleVbo.vertexBuffer);
  for(var i=0;i<voronoi.pts.length;++i) {
    var pt = voronoi.pts[i];
    if(selectedPt == i) {
      phongShader.uniforms.matColor.set([1,0,0,.5]);
    } else if(pt.boundary) {
      phongShader.uniforms.matColor.set([0,0,1,.5]);
    } else {
      phongShader.uniforms.matColor.set([0,0,0,.5]);
    }
    mat4.translate(mvMatrix,mvMatrix,[pt.x,pt.y,0]);
    phongShader.uniforms.mvMatrix.set(mvMatrix);
    gl.drawArrays(gl.TRIANGLE_FAN,0,circleVbo.numVertices);
    mat4.translate(mvMatrix,mvMatrix,[-pt.x,-pt.y,0]);
  }
  phongShader.attribs.vertexNormal.enable();
  phongShader.uniforms.mvMatrix.set(mvMatrix);
  
  //draw shelves
  //wood color
  phongShader.uniforms.matColor.set([229.0/255,204.0/255,164.0/255,1]);
  //wood is not shiny
  phongShader.uniforms.materialShininess.set(1);
  phongShader.attribs.vertexNormal.set(shelfVbo.normalBuffer);
  phongShader.attribs.vertexPosition.set(shelfVbo.vertexBuffer);
  gl.drawArrays(gl.TRIANGLES,0,shelfVbo.numVertices);

  phongShader.uniforms.matColor.set([colorInfo.r/255,colorInfo.g/255,colorInfo.b/255,1]);

  mat4.scale(mvMatrix,mvMatrix,[1,1,-1]);
  mat3.normalFromMat4(nMatrix,mvMatrix);
  phongShader.uniforms.mvMatrix.set(mvMatrix);
  phongShader.uniforms.nMatrix.set(nMatrix);
  
  //make voronoi edges vbo
  //voronoiToEdgeVBO();
  
  //draw edges vbo
  //colorShader.attribs.vertexPosition.set(voronoiEdges.vertexBuffer);
  //gl.drawArrays(gl.LINES, 0,voronoiEdges.numVertices);

  //draw connectors
  phongShader.attribs.vertexPosition.set(connectorVbo.vertexBuffer);
  phongShader.attribs.vertexNormal.set(connectorVbo.normalBuffer);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,connectorVbo.indexBuffer);
  gl.drawElements(gl.TRIANGLES,connectorVbo.numIndices,gl.UNSIGNED_INT,0);
  
  mat4.scale(mvMatrix,mvMatrix,[1,1,-1]);
  mat4.translate(mvMatrix,mvMatrix,[0,0,bookshelf.depth]);
  mat3.normalFromMat4(nMatrix,mvMatrix);
  phongShader.uniforms.mvMatrix.set(mvMatrix);
  phongShader.uniforms.nMatrix.set(nMatrix);  
  gl.drawElements(gl.TRIANGLES,connectorVbo.numIndices,gl.UNSIGNED_INT,0);  
  
  phongShader.end();  
}

function draw2dGL() {
  gl.viewport(0,0,800,800);
  
  colorShader.begin();
  mat4.identity(mvMatrix);
  var scaling = Math.min(window2dWidth/bookshelf.width,canvas.offsetHeight/bookshelf.height);
  mat4.scale(mvMatrix,mvMatrix,[scaling,scaling,scaling]);
  mat4.ortho(pMatrix,0,window2dWidth,canvas.offsetHeight,0,-2000,2000);
  
  //set color
  colorShader.uniforms.matColor.set([0,0,0,1]);
  //set matrices
  colorShader.uniforms.mvMatrix.set(mvMatrix);
  colorShader.uniforms.pMatrix.set(pMatrix);
  
  //make voronoi edges vbo
  //voronoiToEdgeVBO();
  
  //draw edges vbo
  //colorShader.attribs.vertexPosition.set(voronoiEdges.vertexBuffer);
  //gl.drawArrays(gl.LINES, 0,voronoiEdges.numVertices);

  //draw connectors
  colorShader.attribs.vertexPosition.set(connectorVbo.vertexBuffer);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,connectorVbo.indexBuffer);
  gl.drawElements(gl.TRIANGLES,connectorVbo.numIndices,gl.UNSIGNED_INT,0);
  
  //draw shelves
  colorShader.attribs.vertexPosition.set(shelfVbo.vertexBuffer);
  gl.drawArrays(gl.TRIANGLES,0,shelfVbo.numVertices);
  
  
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
  vboMesh.computeSmoothNormals(connectorVbo);
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

function flattenShelves() {
  var iterations = 2;
  var dir = vec2.create();
  var mid = vec2.create();
  sinFlattenAngle = Math.sin(bookshelf.flattenAngle);
  for(var i=0;i<iterations;++i) {
    for(var j=0;j<voronoi.mesh.edges.length;++j) {
      var e = voronoi.mesh.edges[j];
      if(e.v.e != null) {
        var v1 = e.v;
        var v2 = e.pair.v;
        vec2.sub(dir,v2.pos,v1.pos);
        var len = vec2.len(dir);
        vec2.scale(dir,dir,1.0/len);
        
        if(Math.abs(dir[1]) < sinFlattenAngle) {
          vec2.add(mid,v1.pos,v2.pos);
          vec2.scale(mid,mid,0.5);
          //v1.pos[1] = newY;
          //v2.pos[1] = newY;
          if(dir[0] > 0) {
            vec2.set(v1.pos, -len*0.5+mid[0], mid[1]);
            vec2.set(v2.pos, len*0.5+mid[0], mid[1]);
          } else {
            vec2.set(v1.pos, len*0.5+mid[0], mid[1]);
            vec2.set(v2.pos, -len*0.5+mid[0], mid[1]);          
          }
        }        
      }
    }
  }
}

function initVoronoi() {
  voronoi.setDimensions(bookshelf.width,bookshelf.height);
  voronoi.init();
  voronoi.reset();
  voronoi.voronoi();
}

function save() {
  
  var saveme = {};
  saveme.boundary = voronoi.boundary;
  saveme.pts = [];
  for(var i=0;i<voronoi.pts.length;++i) {
    var pt = voronoi.pts[i];
    saveme.pts.push(pt.x);
    saveme.pts.push(pt.y);
  }
  saveme.woodWidth = bookshelf.woodWidth;
  saveme.tolerance = connector.getTolerance();
  
  var xhr = new XMLHttpRequest();
	xhr.open("POST", "api.php",true); 
	var data = new FormData();
	data.append("action", "save");
	data.append("designData", JSON.stringify(saveme));
  /*
	//var imageData = gl.getImageData(canvas2d.offsetWidth,0,canvas2d.offsetWidth,canvas2d.offsetHeight);
	var pixels = new Uint8Array(canvas2d.offsetWidth*canvas2d.offsetHeight*4);
	gl.readPixels(canvas2d.offsetWidth,0,canvas2d.offsetWidth,canvas2d.offsetHeight,gl.RGBA, gl.UNSIGNED_BYTE,pixels);
	var imageData = context.createImageData(canvas2d.offsetWidth,canvas2d.offsetHeight);
	for(var i=0,j;i<canvas2d.offsetWidth;++i) {
		for(j=0;j<canvas2d.offsetHeight;++j) {
			var index1 = (canvas2d.offsetWidth*j+i)*4;
			var index2 = (canvas2d.offsetWidth*(canvas2d.offsetHeight-1-j)+i)*4;
			imageData.data[index1] = pixels[index2];
			imageData.data[index1+1] = pixels[index2+1];
			imageData.data[index1+2] = pixels[index2+2];
			imageData.data[index1+3] = pixels[index2+3];
		}
	}
	context.putImageData(imageData,0,0);
	
	data.append("imageData", (canvas2d.toDataURL("image/png").split(","))[1]);
  */
  
	//need to do something on error condition
	xhr.onreadystatechange = function() {
		if(xhr.readyState == 4 && xhr.status == 200) {
			var response =  xhr.responseText;
			var stuff = response.split(",");
			if(response == "error") {
        return;
      }
      var lastSaveId = stuff[0];
			alert("saved id: " + lastSaveId);
		}
	};
	xhr.send(data);
}

function load(id) {
  var xhr = new XMLHttpRequest();
	xhr.open("POST", "api.php",true); 
	var data = new FormData();
	data.append("action", "load");
  data.append("id", id);
  xhr.onreadystatechange = function() {
		if(xhr.readyState == 4 && xhr.status == 200) {
			var response =  xhr.responseText;
			if(response == "error") {
        return;
      }
      loadJSON(response);
		}
	};
	xhr.send(data);
}

function loadJSON(str) {
  var loadObj = JSON.parse(str);
  voronoi.boundary.length = 0;
  var maxX = 0, maxY = 0;
  for(var i=0;i<loadObj.boundary.length;++i) {
    voronoi.boundary.push(loadObj.boundary[i]);
    maxX = Math.max(maxX, loadObj.boundary[i][0]);
    maxY = Math.max(maxY, loadObj.boundary[i][1]);
  }
  bookshelf.width = maxX;
  bookshelf.height = maxY;
  voronoi.pts.length = 0;
  for(var i=0;i<loadObj.pts.length;) {
    var x = loadObj.pts[i++];
    var y = loadObj.pts[i++];
    voronoi.pts.push({x:x,y:y,on:true});
  }
  voronoi.updateOutsidePts();
  bookshelf.woodWidth = loadObj.woodWidth;
  connector.setTolerance(loadObj.tolerance);
}

function getUrlVars() {
  var vars = {};
  var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
  vars[key] = value;
  });
  return vars;
}


function keyPress(event) {
  switch(event.which) {
    case "D".charCodeAt(0):
      download();
      break;
  }
}

/*function setupGui() {
  var widthSlide = document.getElementById("width");
  widthSlide.oninput = function() {bookshelf.setWidth(parseFloat(this.value));}
  var heightSlide = document.getElementById("height");
  heightSlide.oninput = function() {setHeight(parseFloat(this.value));}
}*/

function getTotalWood() {
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
  var totalLen = 0;
  for(var i=0;i<lens.length;++i) {
    if(lens[i]) {
      totalLen += (lens[i]/25.4);
    }
  }
  return totalLen*bookshelf.depth/25.4;
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
  var totalLen = 0;
  for(var i=0;i<lens.length;++i) {
    if(lens[i]) {
      lenStr += i + " " + (lens[i]/25.4).toFixed(3) + "\n";
      totalLen += (lens[i]/25.4);
    }
  }
  
  console.log(totalLen);
  
  var a = document.createElement('a');
  var blob = new Blob([lenStr]);
  a.href = window.URL.createObjectURL(blob);
  a.download = "lengths"+new Date().toISOString().substring(0,16)+".txt";
  a.click();
  
  downloadVboAsSTL(connectorVbo);
  downloadDesignMesh();
}

function downloadDesignMesh() {
  var objStr = "";
  for(var i=0;i<voronoi.mesh.vertices.length;++i) {
    var v = voronoi.mesh.vertices[i];
    objStr += "v " + v.pos[0] + " " + v.pos[1] + " " + v.pos[2] + "\n";
  }
  
  for(var i=0;i<voronoi.mesh.faces.length;++i) {
    var f = voronoi.mesh.faces[i];
    objStr += "f";
    var startE = f.e;
    var e = startE;
    do {
      objStr += " " + (e.v.index+1);
      e = e.next;
    } while(e != startE);
    objStr += "\n";
  }
  var a = document.createElement('a');
  var blob = new Blob([objStr]);
  a.href = window.URL.createObjectURL(blob);
  a.download = "bookshelfMesh"+new Date().toISOString().substring(0,16)+".txt";
  a.click();
}

/*
  convert point on screen to point on model
  
  @param float x
    mouse position in x
  @param float y
    mouse position in y
  @out array out
    output point in real space
*/
var screenToReal = (function() {
  var pt1 = vec3.create();
  var dir = vec3.create();
  var planeDir = vec3.create();
  var ray = vec4.create();
  var invMatrix = mat4.create();
  var tMat = mat4.create();
  var ray2 = vec4.create();
  var up = vec3.clone([0,0,1]);
  return function screenToReal(x,y,out) {
    //get camera transform
    mat4.identity(mvMatrix);
    camera.feed(mvMatrix);

    vec4.set(ray, 2.0*(x-400.0)/800.0-1.0, 1.0-2.0*y/800.0,-0.3,1.0);
    vec4.set(ray2, 2.0*(x-400.0)/800.0-1.0, 1.0-2.0*y/800.0,0.3,1.0);
    mat4.mul(tMat,pMatrix,mvMatrix);
    mat4.invert(invMatrix, tMat);
    vec4.transformMat4(ray, ray, invMatrix);
    vec4.transformMat4(ray2, ray2, invMatrix);

    //ray[2] = -1.0;
    //ray[3] = 0.0;
    //ray2[2] = -1.0;
    //ray2[3] = 0.0;
    
    
    //mat4.invert(invMatrix,mvMatrix);
    //vec4.transformMat4(ray, ray, invMatrix);
    //vec4.transformMat4(ray2, ray2, invMatrix);
    vec3.sub(dir,ray,ray2);
    vec3.normalize(dir,dir);
    vec2.scaleAndAdd(out,ray2,dir,(-ray2[2])/dir[2]);
    
    //var scaling = Math.min(canvas.offsetWidth/bookshelf.width,canvas.offsetHeight/bookshelf.height);
    //out[0] = x/scaling;
    //out[1] = y/scaling;
  
  }
})();

var realToScreen = (function() {
  var pt = vec3.create();
  var tMat = mat4.create();
  return function realToScreen(x,y,out) {
    //get camera transform
    mat4.identity(mvMatrix);
    camera.feed(mvMatrix);

    mat4.mul(tMat,pMatrix,mvMatrix);

    vec3.set(pt,x,y,0);
    vec3.transformMat4(pt,pt,tMat);
    //y = 1.0-2.0*y/800.0
    out[0] = (pt[0]+1.0)*400+400;
    out[1] = (pt[1]-1.0)*-400;
    //var scaling = Math.min(canvas.offsetWidth/bookshelf.width,canvas.offsetHeight/bookshelf.height);
    //out[0] = x*scaling;
    //out[1] = y*scaling;
  };
})();

pointer.mouseMoved = function() {
  checkHover();
  dragHover();
}

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
        if(dx*dx+dy*dy < 15*15) {
          selectedPt = i;
        //console.log(dx + " " + dy);
          
        }
      }
    }
  }
})();

pointer.mouseDragged = (function() {
  var coord = vec2.create();
  return function mouseDragged() {
    //if(pointer.mouseX > window2dWidth) {
      //camera.mouseDragged(pointer.mouseX-pointer.pmouseX,pointer.mouseY-pointer.pmouseY,pointer.mouseX,pointer.mouseY,pointer.mouseButton);
    //}
  }
})();

pointer.mouseClicked = (function() {
  var coords = vec2.create();
  return function mouseClicked(event) {
    //if(pointer.mouseX < window2dWidth) {
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
      //}
  
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

function setConnectorColor(c) {
	colorInfo = c;
}
