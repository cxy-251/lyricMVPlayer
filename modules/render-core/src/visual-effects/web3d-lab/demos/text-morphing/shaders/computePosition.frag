uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform float uDelta;
varying vec2 vUv;
void main() {
  vec3 pos = texture2D(uPosition, vUv).xyz;
  vec3 vel = texture2D(uVelocity, vUv).xyz;
  gl_FragColor = vec4(pos + vel * uDelta, 1.0);
}
