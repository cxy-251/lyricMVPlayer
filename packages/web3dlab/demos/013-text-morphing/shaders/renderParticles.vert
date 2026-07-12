uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform float uPointSize;

attribute vec2 aParticleUv;
attribute float aSeed;

varying vec3 vColor;
varying float vEnergy;

void main() {
  vec3 particlePosition = texture2D(uPosition, aParticleUv).xyz;
  vec3 particleVelocity = texture2D(uVelocity, aParticleUv).xyz;
  vec4 viewPosition = modelViewMatrix * vec4(particlePosition, 1.0);
  float speed = length(particleVelocity);

  vec3 cyan = vec3(0.18, 0.83, 1.0);
  vec3 violet = vec3(0.48, 0.34, 1.0);
  vec3 rose = vec3(1.0, 0.25, 0.62);
  float palette = fract(aSeed * 2.73 + particlePosition.y * 0.055);
  vColor = palette < 0.52
    ? mix(cyan, violet, palette / 0.52)
    : mix(violet, rose, (palette - 0.52) / 0.48);
  vEnergy = clamp(speed * 0.2, 0.0, 1.0);

  float sizeVariation = mix(0.72, 1.28, aSeed);
  float perspective = 10.0 / max(2.0, -viewPosition.z);
  gl_PointSize = clamp(uPointSize * sizeVariation * perspective, 1.2, 6.5);
  gl_Position = projectionMatrix * viewPosition;
}
