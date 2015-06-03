precision mediump float;

attribute vec3 vertexPosition;

uniform mat4 mvMatrix;
uniform mat4 pMatrix;

void main(void) {
	gl_PointSize = 4.0;
	gl_Position = pMatrix * mvMatrix * vec4(vertexPosition, 1.0);
}