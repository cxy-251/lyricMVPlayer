uniform sampler2D uPositionTexture;
uniform sampler2D uVelocityTexture;
uniform float uTime;
uniform float uBirdSize;

attribute vec2 aBoidUv;

varying vec3 vColor;
varying float vLight;

float random(vec2 value) {
  return fract(sin(dot(value, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec3 boidPosition = texture2D(uPositionTexture, aBoidUv).xyz;
  vec3 velocity = texture2D(uVelocityTexture, aBoidUv).xyz;
  float speed = length(velocity);
  vec3 forward = speed > 0.001 ? normalize(velocity) : vec3(0.0, 0.0, 1.0);
  vec3 referenceUp = abs(forward.y) > 0.92 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 right = normalize(cross(referenceUp, forward));
  vec3 up = normalize(cross(forward, right));
  float seed = random(aBoidUv);

  vec3 localPosition = position * uBirdSize;
  float flap = sin(uTime * mix(7.0, 10.5, seed) + seed * 31.4);
  localPosition.y += abs(localPosition.x) * flap * 0.34;
  vec3 worldPosition = boidPosition
    + right * localPosition.x
    + up * localPosition.y
    + forward * localPosition.z;
  vec3 worldNormal = normalize(right * normal.x + up * normal.y + forward * normal.z);

  vec3 cyan = vec3(0.12, 0.86, 1.0);
  vec3 blue = vec3(0.25, 0.38, 1.0);
  vec3 amber = vec3(1.0, 0.58, 0.18);
  float palette = fract(seed * 2.4 + forward.y * 0.15);
  vColor = palette < 0.68
    ? mix(cyan, blue, palette / 0.68)
    : mix(blue, amber, (palette - 0.68) / 0.32);
  vec3 lightDirection = normalize(vec3(0.4, 0.8, 0.55));
  vLight = 0.58 + max(dot(worldNormal, lightDirection), 0.0) * 0.42;

  gl_Position = projectionMatrix * viewMatrix * vec4(worldPosition, 1.0);
}
