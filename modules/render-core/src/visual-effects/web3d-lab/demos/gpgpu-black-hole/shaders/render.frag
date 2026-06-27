varying vec3 vColor;
varying float vAlpha;
varying float vDistToSingularity;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float dist = length(uv);
  
  if (dist > 0.5) discard;
  
  // ==========================================
  // EVENT HORIZON FADE OUT
  // ==========================================
  // Particles that cross the event horizon (radius 1.0) vanish.
  // We fade them out smoothly between distance 1.0 and 1.5.
  float horizonFade = smoothstep(1.0, 1.5, vDistToSingularity);

  if (horizonFade <= 0.0) discard; // Inside the black hole, no light escapes

  // Soft particle edge (Gaussian falloff), extremely soft to force blending into fluids
  float intensity = exp(-dist * dist * 1.5);
  
  // Multiply alpha by horizonFade so they smoothly vanish as they get sucked in
  gl_FragColor = vec4(vColor * intensity, vAlpha * intensity * horizonFade);
}
