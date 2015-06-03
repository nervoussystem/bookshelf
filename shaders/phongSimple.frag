precision mediump float;

varying vec3 vTransformedNormal;
varying vec4 vPosition;

uniform vec4 matColor;
uniform vec3 ambientLightingColor;
uniform vec3 directionalDiffuseColor;
uniform vec3 lightingDirection;
uniform float materialShininess;
        
void main(void) {
    float alpha = matColor.a;
    vec3 materialDiffuseColor = vec3(matColor);
    vec3 ambientLightWeighting = ambientLightingColor;
    vec3 normal = normalize(vTransformedNormal);
    float diffuseLightBrightness = max(dot(normal,lightingDirection),0.0);
    vec3 diffuseLightWeighting = diffuseLightBrightness*directionalDiffuseColor;
    vec3 r = reflect(lightingDirection, normal);
    r = -normalize(r);
    vec3 v = -vPosition.xyz;
    v = normalize(v);
  
    vec3 spec = vec3(.3,.3,.3)*pow(max(0.0,dot(r, v)), materialShininess);
                      
    gl_FragColor = vec4(
                    ambientLightWeighting * materialDiffuseColor
                    + materialDiffuseColor * diffuseLightWeighting
                    + spec
                    , alpha);
}


