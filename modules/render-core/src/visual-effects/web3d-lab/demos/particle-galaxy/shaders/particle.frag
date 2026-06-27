// 背景星场片段着色器
varying vec3 vStarColor;

void main() {
  vec2  uv   = gl_PointCoord - 0.5;
  float dist = length(uv);
  if (dist > 0.5) discard;

  // 高斯衰减：模拟星光弥散圆盘
  float alpha = exp(-dist * dist * 22.0) * 0.75;
  gl_FragColor = vec4(vStarColor, alpha);
}
