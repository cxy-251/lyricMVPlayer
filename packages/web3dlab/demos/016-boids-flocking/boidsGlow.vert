uniform sampler2D uPositionTexture;

attribute vec2 aBoidUv;

varying float vHue;

void main() {
  vec3 boidPosition = texture2D(uPositionTexture, aBoidUv).xyz;
  vec4 viewPosition = modelViewMatrix * vec4(boidPosition, 1.0);
  vHue = fract(sin(dot(aBoidUv, vec2(12.9898, 78.233))) * 43758.5453);
  gl_PointSize = clamp(4.6 * (10.0 / max(2.0, -viewPosition.z)), 2.0, 6.5);
  gl_Position = projectionMatrix * viewPosition;
}
