uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform sampler2D uTargetPosition;

uniform float uDelta;
uniform float uTime;
uniform float uAttraction;
uniform float uDamping;
uniform float uAssembly;
uniform float uTurbulence;

varying vec2 vUv;

vec4 permute(vec4 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n = 1.0 / 7.0;
  vec3 ns = n * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 xGrid = floor(j * ns.z);
  vec4 yGrid = floor(j - 7.0 * xGrid);
  vec4 x = xGrid * ns.x + ns.yyyy;
  vec4 y = yGrid * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = inversesqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m *= m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

vec3 curlNoise(vec3 point) {
  const float epsilon = 0.1;
  vec3 dx = vec3(epsilon, 0.0, 0.0);
  vec3 dy = vec3(0.0, epsilon, 0.0);
  vec3 dz = vec3(0.0, 0.0, epsilon);
  vec3 x0 = vec3(snoise(point - dx), snoise(point - dx + 19.1), snoise(point - dx - 19.1));
  vec3 x1 = vec3(snoise(point + dx), snoise(point + dx + 19.1), snoise(point + dx - 19.1));
  vec3 y0 = vec3(snoise(point - dy), snoise(point - dy + 19.1), snoise(point - dy - 19.1));
  vec3 y1 = vec3(snoise(point + dy), snoise(point + dy + 19.1), snoise(point + dy - 19.1));
  vec3 z0 = vec3(snoise(point - dz), snoise(point - dz + 19.1), snoise(point - dz - 19.1));
  vec3 z1 = vec3(snoise(point + dz), snoise(point + dz + 19.1), snoise(point + dz - 19.1));
  vec3 curl = vec3(
    y1.z - y0.z - z1.y + z0.y,
    z1.x - z0.x - x1.z + x0.z,
    x1.y - x0.y - y1.x + y0.x
  );
  return curl / max(length(curl), 0.0001);
}

void main() {
  vec3 position = texture2D(uPosition, vUv).xyz;
  vec3 velocity = texture2D(uVelocity, vUv).xyz;
  vec3 target = texture2D(uTargetPosition, vUv).xyz;
  vec3 offset = target - position;
  float distanceToTarget = length(offset);

  float springStrength = uAttraction * mix(0.58, 1.0, uAssembly);
  vec3 force = offset * springStrength;
  float transitionEnergy = 1.0 - uAssembly;
  float swirlMask = smoothstep(0.08, 2.8, distanceToTarget);
  vec3 curl = curlNoise(position * 0.42 + uTime * 0.28);
  force += curl * uTurbulence * transitionEnergy * transitionEnergy * swirlMask;

  velocity += force * uDelta;
  velocity *= exp(-uDamping * uDelta);

  if (distanceToTarget < 0.018) {
    velocity *= 0.82;
  }

  gl_FragColor = vec4(velocity, 1.0);
}
