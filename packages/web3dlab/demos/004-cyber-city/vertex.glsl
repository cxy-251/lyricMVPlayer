uniform float uTime;
uniform float uScanSpeed;
uniform float uScanWidth;
uniform vec3 uScanColor;
uniform float uTransmission; // Base neon glow

attribute float aRandom;

varying float vAlpha;
varying vec3 vColor;
varying float vDist;
varying float vScanIntensity;

void main() {
  vec3 p = position;

  // Basic holographic drift
  p.y += sin(uTime * 0.5 + aRandom * 10.0) * 0.2;

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  vDist = length(mvPosition.xyz);

  // 1. Depth Attenuation: fade out far buildings aggressively
  float depthFade = exp(-pow(vDist * 0.012, 2.0));

  // 2. Volumetric Scanning Wave with Asymmetric Decay Trail
  float maxZ = 70.0;
  // Sweep from +maxZ down to -maxZ (or vice versa)
  // Let's sweep along X axis for a classic radar look, or Z axis
  float scanPos = mod(uTime * uScanSpeed, maxZ * 2.0) - maxZ;

  // We want the wave to travel in positive Z direction
  float diff = scanPos - p.z;

  float scanCore = 0.0;
  float scanTrail = 0.0;

  if (diff > 0.0 && diff < uScanWidth) {
    // Inside the hot core of the scanner
    scanCore = sin((diff / uScanWidth) * 3.14159);
  } else if (diff >= uScanWidth) {
    // In the trailing wake behind the scanner
    float trailDist = diff - uScanWidth;
    scanTrail = exp(-trailDist * 0.05); // Exponential decay trail
  }

  vScanIntensity = scanCore * 2.0 + scanTrail * 1.5;

  // 3. Multi-color gradients based on height
  vec3 lowColor = vec3(0.01, 0.05, 0.15); // Deep cyber blue/purple
  float heightRatio = clamp(p.y / 25.0, 0.0, 1.0);
  vec3 highColor = mix(uScanColor, vec3(0.8, 0.2, 1.0), heightRatio * 0.8); // Scan color + neon magenta

  vec3 baseCityColor = mix(lowColor, highColor, pow(heightRatio, 1.5));

  // Add rare super-bright windows
  float windowLight = step(0.98, fract(aRandom * 777.0)) * 2.0;
  baseCityColor += windowLight * highColor * 0.5;

  // 4. Final Color synthesis
  // uTransmission controls the base ambient brightness of the matrix
  vColor = baseCityColor * uTransmission + (uScanColor * vScanIntensity * 2.5);

  // Active size pulse during scan
  float activeSize = 1.0 + vScanIntensity * 2.0;
  gl_PointSize = activeSize * (40.0 / -mvPosition.z);

  // 5. Alpha blending
  vAlpha = (0.3 + windowLight * 0.5 + vScanIntensity) * depthFade;
}
