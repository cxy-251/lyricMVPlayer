varying float vAlpha;
varying vec3 vColor;
varying float vBrightness;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float dist = length(uv);
  
  if (dist > 0.5) discard;
  
  // Gaussian-like soft falloff for a gaseous volume feel
  float softAlpha = exp(-dist * dist * 80.0);
  
  // Brightness compensation applied only to alpha to preserve twist color layering
  gl_FragColor = vec4(vColor * softAlpha * 1.5, vAlpha * softAlpha * vBrightness);
}
