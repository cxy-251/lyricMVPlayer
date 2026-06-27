varying float vAlpha;
varying vec3 vColor;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float dist = length(uv);
  
  if (dist > 0.5) discard;
  
  // Liquid light Gaussian falloff
  float intensity = 1.0 - (dist * 2.0);
  intensity = pow(intensity, 2.0);
  
  gl_FragColor = vec4(vColor * intensity, vAlpha * intensity);
}
