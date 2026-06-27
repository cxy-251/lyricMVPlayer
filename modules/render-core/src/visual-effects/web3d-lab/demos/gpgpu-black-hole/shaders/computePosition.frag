uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform float uDelta;

varying vec2 vUv;

void main() {
  vec4 posData = texture2D(uPosition, vUv);
  vec4 velData = texture2D(uVelocity, vUv);

  vec3 pos = posData.xyz;
  vec3 vel = velData.xyz;
  float mass = posData.w;

  // Verlet Integration
  pos += vel * uDelta;

  gl_FragColor = vec4(pos, mass);
}
