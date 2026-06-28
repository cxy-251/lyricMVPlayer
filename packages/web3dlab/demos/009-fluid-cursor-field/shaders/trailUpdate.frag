precision highp float;

varying vec2 vUv;

uniform sampler2D uPrevTrail;
uniform vec2 uPointer;
uniform vec2 uPrevPointer;
uniform vec2 uVelocity;
uniform vec2 uTexel;
uniform float uAspect;
uniform float uTime;
uniform float uDelta;
uniform float uDistortionStrength;
uniform float uDrag;
uniform float uForce;
uniform float uFluidDecay;
uniform float uRippleRadius;
uniform float uTrailPersistence;

float saturate(float value) {
  return clamp(value, 0.0, 1.0);
}

float distanceToSegment(vec2 point, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float amount = dot(point - a, ab) / max(dot(ab, ab), 0.00001);
  vec2 closest = a + ab * saturate(amount);
  return length(point - closest);
}

vec4 sampleTrail(vec2 uv) {
  vec4 center = texture2D(uPrevTrail, uv) * 0.52;
  center += texture2D(uPrevTrail, uv + vec2(uTexel.x, 0.0)) * 0.12;
  center += texture2D(uPrevTrail, uv - vec2(uTexel.x, 0.0)) * 0.12;
  center += texture2D(uPrevTrail, uv + vec2(0.0, uTexel.y)) * 0.12;
  center += texture2D(uPrevTrail, uv - vec2(0.0, uTexel.y)) * 0.12;
  return center;
}

void main() {
  vec4 previous = texture2D(uPrevTrail, vUv);
  vec2 previousFlow = previous.xy * 2.0 - 1.0;

  vec2 advectedUv = vUv - previousFlow * (0.006 + uTrailPersistence * 0.012);
  vec4 trail = sampleTrail(advectedUv);

  vec2 flow = trail.xy * 2.0 - 1.0;
  float density = trail.z;
  float memory = trail.a;

  float persistence = mix(0.78, 0.993, uTrailPersistence);
  float fade = pow(persistence, uDelta * 60.0) * exp(-uFluidDecay * uDelta * 0.22);
  flow *= fade;
  density *= fade;
  memory *= fade;

  vec2 aspectVec = vec2(uAspect, 1.0);
  vec2 uv = vUv * aspectVec;
  vec2 pointer = uPointer * aspectVec;
  vec2 prevPointer = uPrevPointer * aspectVec;
  float radius = max(uRippleRadius, 0.015);
  float distanceFromTrail = distanceToSegment(uv, prevPointer, pointer);
  float impulse = smoothstep(radius, 0.0, distanceFromTrail);

  vec2 velocity = uVelocity * aspectVec;
  float speed = length(velocity);
  vec2 direction = speed > 0.0001 ? normalize(velocity) : vec2(0.0, 1.0);
  vec2 tangent = vec2(-direction.y, direction.x);
  vec2 radial = normalize((uv - pointer) + 0.0001);
  float ripple = sin(distanceFromTrail / radius * 6.28318 - uTime * 8.0);
  float swirlSign = sin(dot(vUv, vec2(19.0, 31.0)) + uTime * 2.2);
  float dragBoost = 1.0 + uDrag * 1.9;
  float strength = uForce * uDistortionStrength * dragBoost;

  vec2 injectedFlow =
    direction * impulse * strength * 0.066 +
    tangent * impulse * strength * (0.04 + 0.025 * swirlSign) +
    radial * impulse * max(ripple, -0.2) * strength * 0.032;

  float ring = smoothstep(radius * 0.9, radius * 0.28, abs(distanceFromTrail - radius * 0.42));
  flow += injectedFlow;
  density += impulse * strength * 0.58 + ring * strength * 0.24;
  memory += impulse * (0.18 + strength * 0.28);

  float flowLength = length(flow);
  if (flowLength > 1.0) {
    flow /= flowLength;
  }

  gl_FragColor = vec4(flow * 0.5 + 0.5, saturate(density), saturate(memory));
}
