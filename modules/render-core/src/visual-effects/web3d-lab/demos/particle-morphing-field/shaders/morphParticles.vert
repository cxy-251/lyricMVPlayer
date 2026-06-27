uniform float uClickPulse;
uniform float uDrag;
uniform float uFromShape;
uniform float uInteractionStrength;
uniform float uMorph;
uniform float uParticleSize;
uniform float uPixelRatio;
uniform float uTime;
uniform float uToShape;
uniform float uTurbulenceStrength;
uniform float uWheel;
uniform vec2 uPointer;

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
  float turbulence = uTurbulenceStrength * (0.42 + uDrag * 1.45 + abs(uWheel) * 0.24);

  vec3 idleWave = vec3(
    sin(time * 0.92 + p.y * 1.7 + phase),
    cos(time * 0.74 + p.z * 1.3 + phase * 1.7),
    sin(time * 0.66 + p.x * 1.45 + phase * 2.1)
  );
  p += idleWave * turbulence * 0.055;

  float orbit = time * (0.025 + aSeed.y * 0.04);
  p.xz = rotate2d(orbit) * p.xz;

  vec2 pointer = uPointer * vec2(4.8, 3.15);
  float pointerDistance = distance(p.xy, pointer);
  float pointerInfluence = smoothstep(1.55, 0.0, pointerDistance);
  vec2 outward = normalize(p.xy - pointer + vec2(0.001));
  vec2 tangent = vec2(-outward.y, outward.x);
  float pulse = sin(time * 8.0 + phase + radius * 2.2) * 0.5 + 0.5;
  float interaction = pointerInfluence * uInteractionStrength * (1.0 + uDrag * 1.7);

  p.xy += outward * interaction * (0.32 + pulse * 0.24);
  p.xy += tangent * interaction * (0.12 + aSeed.z * 0.18);
  p.z += interaction * (sin(phase + time * 4.2) * 0.48 + 0.16);

  float clickWave = sin(radius * 4.8 - time * 9.0 + phase) * uClickPulse;
  p += normalize(p + vec3(0.001)) * clickWave * 0.13;

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float perspective = 30.0 / max(-mvPosition.z, 0.001);
  float morphGlow = sin(morph * 3.14159265);
  gl_PointSize = aSeed.w * uParticleSize * uPixelRatio * perspective * (0.78 + interaction * 1.1 + morphGlow * 0.18);

  vAlpha = clamp(0.2 + interaction * 0.18 + morphGlow * 0.08 - radius * 0.014, 0.055, 0.54);
  vColorMix = fract(aSeed.y * 0.72 + uToShape * 0.21 + radius * 0.035);
  vHot = clamp(interaction + morphGlow * 0.75 + uClickPulse * 0.35, 0.0, 1.0);
  vHalo = clamp(0.18 + morphGlow * 0.72 + pointerInfluence * 0.45, 0.0, 1.0);
}
