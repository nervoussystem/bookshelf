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
