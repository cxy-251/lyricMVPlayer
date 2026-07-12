varying float vHue;

void main() {
  float distanceFromCenter = length(gl_PointCoord - 0.5);
  float alpha = 1.0 - smoothstep(0.08, 0.5, distanceFromCenter);
  vec3 color = mix(vec3(0.12, 0.72, 1.0), vec3(0.68, 0.32, 1.0), vHue);
  gl_FragColor = vec4(color, alpha * 0.34);
}
