varying vec2 vUv;
varying vec3 vRayDir;
void main() {
  vUv = uv;
  vec4 ndc = vec4(position.xy, 1.0, 1.0);
  vec4 viewPos = inverse(projectionMatrix) * ndc;
  vec3 worldDir = (inverse(viewMatrix) * vec4(viewPos.xyz, 0.0)).xyz;
  vRayDir = normalize(worldDir);
  gl_Position = ndc;
}
