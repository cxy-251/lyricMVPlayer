uniform float uTime;
uniform float uConnectionRadius;
uniform float uPulseSpeed;

attribute float aDistance;

varying float vAlpha;

void main() {
  // Hide lines that are longer than the dynamically controlled radius
  if (aDistance > uConnectionRadius) {
     gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // Clip it out
     return;
  }
  
  vec3 p = position;
  
  // Global breathing effect
  float distFromCenter = length(p);
  float breath = sin(uTime * uPulseSpeed - distFromCenter * 0.5) * 0.5 + 0.5;
  
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  
  // Fade out longer lines smoothly
  float distFade = smoothstep(uConnectionRadius, uConnectionRadius * 0.5, aDistance);
  
  // Fade edges of the sphere
  float edgeFade = smoothstep(12.0, 8.0, distFromCenter);
  
  vAlpha = distFade * edgeFade * (0.1 + breath * 0.3); // Lines are faint
}
