uniform float uTime;
uniform float uDopplerStrength;
uniform vec3 uCameraPos;

attribute float aRadius;
attribute float aAngle;
attribute float aHeight;
attribute float aRandom;

varying vec3  vColor;
varying float vAlpha;
varying float vBrightness;

const float DISK_INNER = 1.6;
const float DISK_OUTER = 9.0;

void main() {
  // Keplerian orbital speed (slower further out)
  float angularSpeed = (0.75 / sqrt(max(aRadius, 0.1)));
  float angle = aAngle + uTime * angularSpeed;

  // Infall spiral (Viscous accretion)
  float infallSpeed = 0.014 / (aRadius * 0.6 + 0.3);
  float infallPhase = fract(aRandom * 5.13 + uTime * infallSpeed);
  float r = max(DISK_INNER, aRadius - infallPhase * (aRadius - DISK_INNER) * 0.85);

  // MRI turbulence
  float turbStr = (1.0 - (r - DISK_INNER) / (DISK_OUTER - DISK_INNER) * 0.6) * 0.11;
  float noise = aRandom * 6.28318;
  float turbX = sin(uTime * 0.9 + noise * 1.7) * turbStr;
  float turbZ = cos(uTime * 1.25 + noise * 2.3) * turbStr;

  vec3 p = vec3(
    cos(angle) * r + turbX,
    aHeight,
    sin(angle) * r + turbZ
  );

  // Calculate Instantaneous Velocity Vector (tangent to the circle)
  // Derivative of (cos(theta), 0, sin(theta)) is (-sin(theta), 0, cos(theta))
  vec3 velocity = normalize(vec3(-sin(angle), 0.0, cos(angle)));

  // Calculate View Direction (from particle to camera)
  vec3 viewDir = normalize(uCameraPos - p);

  // Doppler Beaming dot product
  float dopplerDot = dot(velocity, viewDir);

  float ct = clamp((r - DISK_INNER) / (DISK_OUTER - DISK_INNER), 0.0, 1.0);

  // Base Disk Colors
  vec3 innerEdge = vec3(1.00, 0.72, 0.38);  // Inner: hot amber
  vec3 warmBand  = vec3(1.00, 0.34, 0.04);  // Mid: saturated orange
  vec3 outerEdge = vec3(0.25, 0.03, 0.005); // Outer: Dark Red Dust

  vec3 color;
  if (ct < 0.2) {
    color = mix(innerEdge, warmBand, ct / 0.2);
  } else {
    color = mix(warmBand, outerEdge, (ct - 0.2) / 0.8);
  }

  // RELATIVISTIC BEAMING (Doppler Effect)
  // Asymmetric brightness and color shifting based on velocity dot viewDir
  float dopplerFactor = 1.0 + dopplerDot * uDopplerStrength * 0.58;

  // Controlled relativistic beaming: visible asymmetry without white-out.
  float beamingIntensity = clamp(pow(max(dopplerFactor, 0.08), 2.1), 0.18, 2.25);

  if (dopplerDot > 0.0) {
      // Blue-shift: Approaching camera
      vec3 blueShift = vec3(0.5, 0.68, 0.92); // Blue-white, not pure white
      color = mix(color, blueShift, dopplerDot * uDopplerStrength * 0.42);
  } else {
      // Red-shift: Receding from camera
      vec3 redShift = vec3(0.72, 0.18, 0.02); // Amber red/bronze
      color = mix(color, redShift, abs(dopplerDot) * uDopplerStrength * 0.55);
  }

  color *= beamingIntensity;

  // ISCO Inner Glow
  float innerGlow = exp(-ct * 10.5) * 0.52;
  float accretionBand = exp(-pow((ct - 0.18) / 0.16, 2.0));
  color += vec3(1.0, 0.58, 0.18) * innerGlow * (0.42 + beamingIntensity * 0.24);
  color += vec3(1.0, 0.36, 0.05) * accretionBand * 0.42;

  vColor = color;

  // Alpha calculations
  float sizeVar = 0.3 + fract(aRandom * 777.3) * 0.7;
  float edgeFade = 1.0 - smoothstep(0.76, 1.0, ct);

  // Receding side also fades in alpha slightly to emphasize depth
  float alphaBeaming = mix(0.45, 1.18, (dopplerDot * 0.5 + 0.5));
  vAlpha = sizeVar * edgeFade * (0.010 + innerGlow * 0.009 + accretionBand * 0.014) * alphaBeaming;

  // Projection
  vec4 mvp = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvp;

  // Particle Size Distortion
  // Approaching particles appear larger due to beaming
  float rawSize = (0.9 + sizeVar * 1.2) * (14.0 / -mvp.z) * max(pow(max(dopplerFactor, 0.1), 0.85), 0.55);
  float clampSize = min(rawSize, 6.2);
  gl_PointSize = clampSize;

  vBrightness = clamp(rawSize / clampSize, 1.0, 2.2);
}
