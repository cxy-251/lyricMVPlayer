uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform float uDelta;

uniform float uTime;
uniform float uFeedRate;

varying vec2 vUv;

void main() {
  vec4 posData = texture2D(uPosition, vUv);
  vec4 velData = texture2D(uVelocity, vUv);

  vec3 pos = posData.xyz;
  vec3 vel = velData.xyz;
  float seed = posData.w;

  // Verlet Integration
  pos += vel * uDelta;

  float dist = length(pos);

  float rand = fract(sin(dot(vec2(seed, uTime * 0.17), vec2(12.9898, 78.233))) * 43758.5453);

  if (dist > 36.0 || dist < 1.08 || dist != dist || pos.x != pos.x || rand < uFeedRate) {
    float angle = fract(seed * 17.137 + uTime * 0.018) * 6.28318530718;
    float radiusJitter = fract(seed * 123.456 + uTime * 0.071);
    float laneJitter = fract(seed * 41.771 + uTime * 0.037);
    float innerRadius = 1.65 + pow(radiusJitter, 1.7) * 4.35;
    float outerRadius = 10.5 + radiusJitter * 8.0;
    float useInnerDisk = max(step(laneJitter, 0.48), step(dist, 1.08));
    float radius = mix(outerRadius, innerRadius, useInnerDisk);
    float diskHeight = mix(0.35 + radius * 0.035, 0.22 + radius * 0.05, useInnerDisk);
    pos = vec3(
      cos(angle) * radius,
      (fract(seed * 987.654 + uTime * 0.113) - 0.5) * diskHeight,
      sin(angle) * radius
    );
  }

  gl_FragColor = vec4(pos, seed);
}
