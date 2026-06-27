uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform vec2 uResolution;

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec3 pos = texture2D(uPosition, uv).xyz;
  vec3 vel = texture2D(uVelocity, uv).xyz;
  
  pos += vel * 0.016;
  
  gl_FragColor = vec4(pos, 1.0);
}
