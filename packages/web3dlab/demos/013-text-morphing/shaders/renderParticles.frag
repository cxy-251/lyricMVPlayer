varying vec3 vColor;
varying float vEnergy;

void main() {
  vec2 centeredUv = gl_PointCoord - 0.5;
  float distanceFromCenter = length(centeredUv);
  float alpha = 1.0 - smoothstep(0.3, 0.5, distanceFromCenter);

  if (alpha < 0.01) {
    discard;
  }

  float softCore = 1.0 - smoothstep(0.0, 0.42, distanceFromCenter);
  vec3 movingColor = mix(vColor, vec3(0.92, 0.98, 1.0), vEnergy * 0.3);
  gl_FragColor = vec4(movingColor * (0.72 + softCore * 0.45), alpha * 0.9);
}
