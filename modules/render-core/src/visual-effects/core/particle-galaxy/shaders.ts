export const particleGalaxyVertexShader = `
uniform float uTime;
uniform float uSpeed;
uniform float uParticleSize;
uniform float uPixelRatio;
uniform float uInteractionStrength;
uniform float uDrag;
uniform float uWheel;
uniform float uGlow;
uniform vec2 uPointer;

attribute float aScale;
attribute float aPhase;
attribute float aRandom;
attribute float aRadius;

varying float vAlpha;
varying float vColorMix;
varying float vHot;

mat2 rotate2d(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

void main() {
  vec3 p = position;
  float radius = max(length(p.xy), 0.001);
  float time = uTime * uSpeed;

  float orbitalDrift = time * (0.24 + 2.4 / (radius + 2.0));
  p.xy = rotate2d(orbitalDrift) * p.xy;

  vec2 pointer = uPointer * vec2(7.2, 4.2);
  float pointerDistance = distance(p.xy, pointer);
  float hoverInfluence = smoothstep(5.8, 0.0, pointerDistance);
  float interaction = hoverInfluence * (uInteractionStrength + uDrag * 0.95 + abs(uWheel) * 0.55);

  vec2 direction = normalize(p.xy - pointer + vec2(0.001));
  float pulse = sin(time * 8.0 + aPhase * 6.283185 + radius * 0.72) * 0.5 + 0.5;
  p.xy += direction * interaction * (0.35 + pulse * 0.58);
  p.z += interaction * sin(aPhase * 13.0 + time * 5.0) * 0.7;
  p.z += sin(radius * 0.75 - time * 2.0 + aPhase * 6.283185) * (0.08 + aRandom * 0.11);

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float perspective = 28.0 / max(-mvPosition.z, 0.001);
  gl_PointSize = aScale * uParticleSize * perspective * uPixelRatio * (1.0 + interaction * 1.7);

  vAlpha = clamp(0.72 - aRadius * 0.036 + interaction * 0.38, 0.1, 0.82);
  vColorMix = clamp(aRandom * 0.72 + aRadius * 0.035, 0.0, 1.0);
  vHot = clamp(interaction + (1.0 - aRadius * 0.12), 0.0, 1.0);
}
`;

export const particleGalaxyFragmentShader = `
precision highp float;

uniform float uGlow;

varying float vAlpha;
varying float vColorMix;
varying float vHot;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float distanceToCenter = length(uv);
  float core = smoothstep(0.5, 0.0, distanceToCenter);
  float spark = smoothstep(0.16, 0.0, distanceToCenter);

  vec3 cyan = vec3(0.28, 0.92, 1.0);
  vec3 rose = vec3(1.0, 0.34, 0.78);
  vec3 gold = vec3(1.0, 0.78, 0.34);
  vec3 color = mix(cyan, rose, vColorMix);
  color = mix(color, gold, vHot * 0.42);

  float glow = clamp(uGlow, 0.2, 3.0);
  float alpha = core * vAlpha * (0.5 + glow * 0.08);
  vec3 emission = color * (0.24 + spark * (0.78 + glow * 0.32) + vHot * (0.24 + glow * 0.12));

  if (alpha < 0.02) {
    discard;
  }

  gl_FragColor = vec4(emission, alpha);
}
`;
