uniform float uTime;
uniform float uConnectionRadius;
uniform float uDriftChaos;
uniform float uSynapseGlow;

attribute float aDistance;

varying float vAlpha;

void main() {
  // Hide lines that are longer than the dynamically controlled radius
  if (aDistance > uConnectionRadius) {
     gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // Clip it out
     return;
  }

  vec3 p = position;

  // Organic drift (Exact same logic as nodes so they stay attached)
  vec3 drift = vec3(
    sin(uTime * 0.3 + p.z * 1.5),
    cos(uTime * 0.2 + p.x * 1.5),
    sin(uTime * 0.4 + p.y * 1.5)
  ) * uDriftChaos;

  p += drift;

  // Global breathing effect
  float distFromCenter = length(position); // base position for consistent breathing
  float breath = sin(uTime * 1.5 - distFromCenter * 0.5) * 0.5 + 0.5;

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Fade out longer lines smoothly
  float distFade = smoothstep(uConnectionRadius, uConnectionRadius * 0.5, aDistance);

  // Fade edges of the sphere
  float edgeFade = smoothstep(12.0, 8.0, distFromCenter);

  vAlpha = distFade * edgeFade * (uSynapseGlow + breath * 0.15); // Glow tied to Leva
}
