uniform float uTime;
uniform float uScanSpeed;
uniform float uGlitchIntensity;
uniform float uParticleSize;
uniform vec3 uBaseColor;
uniform vec3 uScanColor;

attribute float aRandom;

varying float vAlpha;
varying vec3 vColor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec3 p = position;
  vec2 blockId = floor(p.xz * 0.5); // block chunking for glitches
  
  // 1. Radar Scanner (Linear sweep along Z axis instead of radial)
  float maxZ = 80.0;
  float scanZ = mod(uTime * uScanSpeed, maxZ * 2.0) - maxZ;
  
  float distToScan = abs(p.z - scanZ);
  
  float scanIntensity = 0.0;
  if (distToScan < 5.0) {
      scanIntensity = exp(-distToScan * 1.5);
  }
  
  // 2. Glitch Physics
  float isGlitching = scanIntensity * (hash21(blockId + uTime) > 0.5 ? 1.0 : 0.0);
  p.x += isGlitching * (aRandom - 0.5) * uGlitchIntensity;
  p.y += isGlitching * (fract(aRandom * 123.0) - 0.5) * uGlitchIntensity * 0.5;
  p.z += isGlitching * (fract(aRandom * 456.0) - 0.5) * uGlitchIntensity;
  
  // Add global slow drift for floating hologram feel
  p.y += sin(uTime * 0.5 + aRandom * 10.0) * 0.1;
  
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  
  // 3. City Built-in Lights ("Windows" and base glow)
  // Make 5% of the particles randomly glow extremely bright to simulate lighted windows
  float windowLight = step(0.95, fract(aRandom * 777.0)) * 2.0;
  
  // Vertical gradient: buildings get slightly brighter at the top
  float heightGlow = clamp(p.y / 20.0, 0.0, 1.0);
  
  vec3 cityColor = uBaseColor * (1.0 + windowLight + heightGlow * 0.5);
  
  // 4. Color & Size
  vColor = mix(cityColor, uScanColor, scanIntensity * 1.5);
  
  float activeSize = uParticleSize * (1.0 + scanIntensity * 2.0);
  gl_PointSize = activeSize * (15.0 / -mvPosition.z);
  
  // 5. Alpha logic
  // Ensure the base building is extremely clear
  float baseAlpha = 0.6 + windowLight * 0.4;
  vAlpha = baseAlpha + scanIntensity;
}
