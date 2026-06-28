// 吸积盘粒子片段着色器
// 每个粒子渲染为高斯软圆盘，叠加后形成有厚度的气体云外观

varying vec3  vColor;
varying float vAlpha;
varying float vBrightness;

void main() {
  vec2  uv   = gl_PointCoord - 0.5;
  float dist = length(uv);
  if (dist > 0.5) discard;

  // 高斯衰减：中心锐利，边缘柔和消失
  float softAlpha  = exp(-dist * dist * 14.0);

  // vBrightness 补偿近景截断损失的发光面积
  gl_FragColor = vec4(vColor, vAlpha * softAlpha * vBrightness);
}
