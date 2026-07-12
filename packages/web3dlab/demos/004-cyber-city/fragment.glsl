varying float vAlpha;
varying vec3 vColor;
varying float vDist;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float dist = length(uv);

  // Create a perfectly feathered soft circle
  if (dist > 0.5) discard;

  // Hot white core
  float core = smoothstep(0.15, 0.0, dist);
  // Soft colored glow
  float glow = exp(-dist * 8.0);

  // Combine for intense neon look
  float intensity = core * 0.8 + glow;

  // Force hot core to be white-ish
  vec3 finalColor = mix(vColor, vec3(1.0), core * 0.6);

  gl_FragColor = vec4(finalColor * intensity, vAlpha * intensity);
}
