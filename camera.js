/*
	Based on PeasyCam by Jonathan Feinberg
	which is distributed under the Apache Public License, version 2.0 http://www.apache.org/licenses/LICENSE-2.0.html
	which there is a good chance I am not following
	http://mrfeinberg.com/peasycam/
*/
"use strict"

var glMatrix = require("../js/gl-matrix-min.js");
var vec3 = glMatrix.vec3;
var mat4 = glMatrix.mat4;
var quat = glMatrix.quat;

var NScamera = {};
NScamera = exports;

NScamera.rot = quat.create();
NScamera.center = vec3.create();
NScamera.distance = 10;
NScamera.velocityX = 0;
NScamera.velocityY = 0;
NScamera.velocityZ = 0;
NScamera.dampening = 0.84;
NScamera.startDistance = 10;
NScamera.minDistance = 5;
NScamera.fixX = false;
NScamera.fixY = false;
NScamera.fixZ = false;
NScamera.screenCenter = [0,0];
vec3.angle = function(v1,v2) {
	return Math.acos(vec3.dot(v1,v2)/(vec3.length(v1)*vec3.length(v2)));
}

NScamera.lookAt = (function() {
  var dir = vec3.create();
  return function lookAt(pos,center,up) {
    vec3.sub(dir,center,pos);
    vec3.copy(this.center,center);
    var len = vec3.length(dir);
    this.distance = len;
  }
})();

NScamera.feed = (function() {
  var pos = vec3.create();
  var up = vec3.create();
  var lookat = mat4.create();
  return function(mat) {
	vec3.set(pos,0,0,1);
	vec3.set(up,0,1,0);
	  vec3.transformQuat(pos,pos,this.rot);
	  vec3.scale(pos,pos,this.distance);
	  vec3.add(pos,pos, this.center);
	  vec3.transformQuat(up,up,this.rot);
	 // mat4.lookAt(pos,this.center,up,mat);
	  mat4.multiply(mat, mat, mat4.lookAt(lookat,pos,this.center,up));
  };
  })();


NScamera.eyeDir = function(dir) {
	vec3.set(dir,0,0,1);
	vec3.transformQuat(dir,dir,this.rot);
	vec3.scale(dir, dir, -1);
}

NScamera.eyePos = function(pos) {
	vec3.set(pos,0,0,1);
	vec3.transformQuat(pos,pos,this.rot);
	vec3.scale(pos, pos, this.distance);
  vec3.add(pos,pos, this.center);
}

NScamera.mouseDragged = function(dx,dy,mx,my,button) {
   if(button == 1) {
     this.mouseRotate(dx,dy,mx,my);
   } else if(button == 2) {
	 this.mousePan(dx,dy);
   } else if(button == 3) {
     this.mouseZoom(dy);
   }
}

NScamera.mousePan = function(dx,dy) {
  var panScale = Math.sqrt(this.distance *0.0001);
  this.pan(-dx*panScale, -dy*panScale);
}

NScamera.pan = function(dx,dy) {
  var temp = [dx,dy,0];
  vec3.transformQuat(temp,temp,this.rot);
  vec3.add(this.center,this.center,temp);
}

NScamera.mouseRotate = function(dx,dy,mx,my) {
	var u = [0,0,-100*.6*this.startDistance]; //this.distance?

	var rho = Math.abs(this.screenCenter[0] - mx) / 800;
	var adz = Math.abs(dy) * rho;
	var ady = Math.abs(dy) * (1 - rho);
	var ySign = dy < 0 ? -1 : 1;
	var vy = vec3.create(); //avoid
	vec3.add(vy,u,[0,ady,0]);
	this.velocityX += vec3.angle(u,vy)*ySign;
	var vz = vec3.create(); //avoid
	vec3.add(vz,u,[0,adz,0]);
	this.velocityZ += vec3.angle(u, vz) * -ySign
			* (mx < this.screenCenter[0] / 2 ? -1 : 1);


	var eccentricity = Math.abs(this.screenCenter[1] - my)
			/ 800;
	var xSign = dx > 0 ? -1 : 1;
	adz = Math.abs(dx) * eccentricity;
	var adx = Math.abs(dx) * (1 - eccentricity);
	var vx = vec3.create();
	vec3.add(vx,u,[adx, 0, 0]);
	this.velocityY += vec3.angle(u,vx)*xSign;
	vec3.add(vz,u,[0,adz,0]);
	this.velocityZ += vec3.angle(u,vz)*xSign
		* (my > this.screenCenter[1] ? -1 : 1);
	
}

NScamera.mouseZoom = function(delta) {
	this.distance = Math.max(this.minDistance, this.distance - delta * Math.sqrt(this.distance * .02));
}

NScamera.step = function() {
  this.velocityX *= this.dampening;
  this.velocityY *= this.dampening;
  this.velocityZ *= this.dampening;
  if(Math.abs(this.velocityX) < 0.001) this.velocityX = 0;
  if(Math.abs(this.velocityY) < 0.001) this.velocityY = 0;
  if(Math.abs(this.velocityZ) < 0.001) this.velocityZ = 0;
  //is create necessary? Also is w first or last
  //do not create quat every time
  if(this.velocityX != 0 && !this.fixX) quat.multiply(this.rot,this.rot,[Math.sin(this.velocityX/2.0),0,0,Math.cos(this.velocityX/2.0)]);
  if(this.velocityY != 0 && !this.fixY) quat.multiply(this.rot,this.rot,[0,Math.sin(this.velocityY/2.0),0,Math.cos(this.velocityY/2.0)]);
  if(this.velocityZ != 0 && !this.fixZ) quat.multiply(this.rot,this.rot,[0,0,Math.sin(this.velocityZ/2.0),Math.cos(this.velocityZ/2.0)]);
  
}
