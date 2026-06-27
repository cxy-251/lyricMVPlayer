uniform float uDelta;
uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform vec2 uResolution;

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec4 posData = texture2D(uPosition, uv);
  vec4 velData = texture2D(uVelocity, uv);
  
  // Update position using true delta time for frame independence
  // We clamp uDelta to avoid huge jumps on tab resume
  vec3 pos = posData.xyz + velData.xyz * min(uDelta, 0.05);
  
  gl_FragColor = vec4(pos, 1.0);
}
