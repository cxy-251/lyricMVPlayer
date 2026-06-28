uniform float uTime;
uniform float uMorphProgress;
uniform float uFromShape;
uniform float uToShape;
uniform vec3 uPointerWorld;
uniform float uRepelRadius;
uniform float uRepelStrength;
uniform float uTurbulence;
uniform float uParticleSize;

attribute vec3 aSphere;
attribute vec3 aTorus;
attribute vec3 aGalaxy;
attribute vec3 aGrid;
attribute vec4 aSeed;

varying float vAlpha;
varying vec3 vColor;

vec3 getShape(float index) {
  if (index < 0.5) return aSphere;
  if (index < 1.5) return aTorus;
  if (index < 2.5) return aGalaxy;
  return aGrid;
}

mat2 rotate2d(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

void main() {
  vec3 fromPos = getShape(uFromShape);
  vec3 toPos = getShape(uToShape);
  
  // Base center of the morph
  vec3 p = mix(fromPos, toPos, uMorphProgress);
  
  // Add an organic "breathing" or "explosion" effect during the morph
  float pop = sin(uMorphProgress * 3.14159) * aSeed.x * 2.0;
  p += normalize(p + 0.01) * pop;
  
  // Global rotation
  p.xy = rotate2d(uTime * 0.1) * p.xy;
  p.xz = rotate2d(uTime * 0.05) * p.xz;
  
  // --- POINTER INTERACTION (Fluid Repulsion) ---
  // 3. Mouse Repel Interaction (Clean Spherical Bubble)
  vec3 pointer3D = uPointerWorld;
  float distToPointer = distance(p, pointer3D);
  
  // Create a clean push outwards
  float repelRaw = smoothstep(uRepelRadius, 0.0, distToPointer);
  float repel = pow(repelRaw, 2.0) * uRepelStrength;
  p += normalize(p - pointer3D + vec3(0.001)) * repel;
  
  // Add liquid noise/turbulence (always active, amplified during morph)
  float turbulenceFactor = uTurbulence * 0.05 * (1.0 + (1.0 - uMorphProgress) * 2.0);
  p.xyz += vec3(
    sin(uTime * 2.0 + aSeed.x * 100.0) * cos(uTime * 1.5 + aSeed.y * 100.0),
    cos(uTime * 1.8 + aSeed.y * 120.0) * sin(uTime * 1.2 + aSeed.z * 80.0),
    sin(uTime * 2.2 + aSeed.z * 90.0) * cos(uTime * 1.6 + aSeed.x * 110.0)
  ) * turbulenceFactor;
  
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  
  // Particle Size
  gl_PointSize = (1.5 + aSeed.x * 1.5 + repel * 4.0) * uParticleSize * (20.0 / -mvPosition.z);
  
  // Volumetric Hologram Colors (Pink/Cyan liquid light)
  vec3 colorA = vec3(1.0, 0.1, 0.5); // Neon Pink
  vec3 colorB = vec3(0.1, 0.8, 1.0); // Cyan
  vec3 hotColor = vec3(1.0, 1.0, 1.0);
  
  vColor = mix(colorA, colorB, aSeed.y);
  vColor = mix(vColor, hotColor, repel * 0.8 + pop * 0.3); // Glow bright when morphing or repelling
  
  vAlpha = 0.05 + repel * 0.1 + pop * 0.05; // Extremely low opacity for liquid additive blending
}
