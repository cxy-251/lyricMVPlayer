uniform vec3 uNetworkColor;
varying float vAlpha;

void main() {
  gl_FragColor = vec4(uNetworkColor, vAlpha);
}
