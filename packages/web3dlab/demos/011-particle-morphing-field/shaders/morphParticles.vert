uniform float uClickPulse;
uniform float uFromShape;
uniform float uMorph;
uniform float uParticleSize;
uniform float uPixelRatio;
uniform float uTime;
uniform float uToShape;
uniform float uTurbulenceStrength;

attribute vec3 aSphere;
attribute vec3 aTorus;
attribute vec3 aGalaxy;
attribute vec3 aGrid;
attribute vec4 aSeed;

varying float vAlpha;
varying float vColorMix;
varying float vHalo;
varying float vHot;

mat2 rotate2d(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

vec3 getShape(float shapeIndex) {
  if (shapeIndex < 0.5) {
    return aSphere;
  }

  if (shapeIndex < 1.5) {
    return aTorus;
  }

  if (shapeIndex < 2.5) {
    return aGalaxy;
  }

  return aGrid;
}

void main() {
  vec3 fromPosition = getShape(uFromShape);
  vec3 toPosition = getShape(uToShape);
  float morph = smoothstep(0.0, 1.0, uMorph);
  vec3 p = mix(fromPosition, toPosition, morph);

  float radius = max(length(p), 0.001);
  float phase = aSeed.x * 6.2831853;
  float time = uTime;
  float morphGlow = sin(morph * 3.14159265);
  float turbulence = uTurbulenceStrength * (0.34 + morphGlow * 0.56 + uClickPulse * 0.22);

  vec3 idleWave = vec3(
    sin(time * 0.92 + p.y * 1.7 + phase),
    cos(time * 0.74 + p.z * 1.3 + phase * 1.7),
    sin(time * 0.66 + p.x * 1.45 + phase * 2.1)
  );
  p += idleWave * turbulence * 0.055;

  float orbit = time * (0.025 + aSeed.y * 0.04);
  p.xz = rotate2d(orbit) * p.xz;

  float clickWave = sin(radius * 4.8 - time * 9.0 + phase) * uClickPulse;
  p += normalize(p + vec3(0.001)) * clickWave * 0.13;

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float perspective = 30.0 / max(-mvPosition.z, 0.001);
  float rawSize = aSeed.w * uParticleSize * uPixelRatio * perspective * (0.95 + morphGlow * 0.26 + uClickPulse * 0.12);
  gl_PointSize = clamp(rawSize, 1.2, 6.4);

  vAlpha = clamp(0.34 + morphGlow * 0.14 - radius * 0.012, 0.12, 0.68);
  vColorMix = fract(aSeed.y * 0.79 + aSeed.z * 0.37 + uToShape * 0.19 + radius * 0.047);
  vHot = clamp(morphGlow * 0.56 + uClickPulse * 0.28, 0.0, 1.0);
  vHalo = clamp(0.24 + morphGlow * 0.42, 0.0, 1.0);
}
