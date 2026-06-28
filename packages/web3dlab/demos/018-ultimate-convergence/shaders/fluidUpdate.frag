varying vec2 vUv;
uniform sampler2D uPrevTrail;
uniform vec2 uPointer;
uniform vec2 uPrevPointer;
uniform vec2 uVelocity;
uniform float uDistortionStrength;
uniform float uFluidDecay;
uniform float uRippleRadius;
uniform float uTrailPersistence;
uniform float uDelta;
uniform float uTime;

float sdLine(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba)/dot(ba, ba), 0.0, 1.0);
  return length(pa - ba*h);
}

void main() {
  vec4 prev = texture2D(uPrevTrail, vUv);
  prev *= uTrailPersistence;
  float dist = sdLine(vUv, uPrevPointer, uPointer);
  float force = smoothstep(uRippleRadius, 0.0, dist);
  vec2 encodedVel = (uVelocity * uDistortionStrength * force * 10.0) * 0.5 + 0.5;
  vec4 finalFluid = prev;
  if (force > 0.0) {
    finalFluid.xy = mix(finalFluid.xy, encodedVel, force * 0.5);
    finalFluid.z = min(finalFluid.z + force, 1.0);
  }
  finalFluid.xy = mix(finalFluid.xy, vec2(0.5), uFluidDecay * uDelta);
  gl_FragColor = finalFluid;
}
