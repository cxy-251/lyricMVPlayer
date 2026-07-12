varying vec3 vColor;
varying float vLight;

void main() {
  gl_FragColor = vec4(vColor * vLight, 1.0);
}
