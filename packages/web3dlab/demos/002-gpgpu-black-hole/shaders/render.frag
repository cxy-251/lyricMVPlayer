varying vec3 vColor;
varying float vAlpha;
varying float vDistToSingularity;
varying float vHorizonGlow;

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

  // ==========================================
  // SOFT PARTICLES (Fluid-like additive blending)
  // ==========================================
  // Extreme soft edges using smoothstep for volumetric plasma look
  // 1.0 at center, fading out completely by 0.5 radius
  float intensity = 1.0 - smoothstep(0.0, 0.5, dist);
  float photonBoost = 1.0 + vHorizonGlow * 0.85;
  
  // Multiply alpha by horizonFade so they smoothly vanish as they get sucked in
  gl_FragColor = vec4(vColor * intensity * photonBoost, vAlpha * intensity * horizonFade * 0.2);
}
