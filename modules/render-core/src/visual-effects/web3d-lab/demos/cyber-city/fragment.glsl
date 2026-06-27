varying float vAlpha;
varying vec3 vColor;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float dist = length(uv);
  
  if (dist > 0.5) discard;
  
  // Holographic data points
  // Use a highly concentrated core for intense brightness
  float glow = exp(-dist * 10.0);
  float ambient = exp(-dist * 3.0) * 0.5;
  float intensity = glow + ambient;
  
  gl_FragColor = vec4(vColor * intensity, vAlpha * intensity);
}
