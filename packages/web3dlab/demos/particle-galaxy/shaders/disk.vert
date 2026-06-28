// 吸积盘粒子顶点着色器（修订版 3）
// 修复：降低 alpha 防止颜色饱和白化 / 多普勒内置固定值 / 添加旋转速度控制

uniform float uTime;
uniform float uRotationSpeed;

attribute float aRadius;
attribute float aAngle;
attribute float aHeight;
attribute float aRandom;

varying vec3  vColor;
varying float vAlpha;
varying float vBrightness;

const float DISK_INNER = 1.6;
const float DISK_OUTER = 9.0;

void main() {
  float t = clamp((aRadius - DISK_INNER) / (DISK_OUTER - DISK_INNER), 0.0, 1.0);

  // ── 开普勒差异旋转 ────────────────────────────────────────
  float angularSpeed = (0.75 / sqrt(max(aRadius, 0.1))) * uRotationSpeed;
  float angle        = aAngle + uTime * angularSpeed;

  // ── 向内螺旋漂移（粘滞吸积下落）────────────────────────
  float infallSpeed = 0.014 / (aRadius * 0.6 + 0.3);
  float infallPhase = fract(aRandom * 5.13 + uTime * infallSpeed);
  float r           = max(DISK_INNER, aRadius - infallPhase * (aRadius - DISK_INNER) * 0.85);

  // ── MRI 湍流扰动 ─────────────────────────────────────────
  float turbStr = (1.0 - (r - DISK_INNER) / (DISK_OUTER - DISK_INNER) * 0.6) * 0.11;
  float noise   = aRandom * 6.28318;
  float turbX   = sin(uTime * 0.9  + noise * 1.7) * turbStr;
  float turbZ   = cos(uTime * 1.25 + noise * 2.3) * turbStr;

  vec3 p = vec3(
    cos(angle) * r + turbX,
    aHeight,
    sin(angle) * r + turbZ
  );

  float ct = clamp((r - DISK_INNER) / (DISK_OUTER - DISK_INNER), 0.0, 1.0);

  // ── 颜色：EHT M87* 橙黄色调 ──────────────────────────────
  vec3 innerEdge = vec3(1.00, 0.95, 0.72);  // 内缘：黄白热区
  vec3 warmBand  = vec3(1.00, 0.50, 0.05);  // 主体：饱和橙色
  vec3 outerEdge = vec3(0.28, 0.05, 0.008); // 外缘：暗红尘埃

  vec3 color;
  if (ct < 0.2) {
    color = mix(innerEdge, warmBand, ct / 0.2);
  } else {
    color = mix(warmBand, outerEdge, (ct - 0.2) / 0.8);
  }

  // ── 内置固定多普勒（物理真实，不依赖用户滑块）──────────
  // 旋转方向决定哪侧更亮；cos(angle) 选取朝向摄像机的半侧
  float beta    = 0.38 * (1.0 - ct * 0.5);
  float doppler = pow(1.0 + beta * cos(angle), 3.0);
  color *= clamp(doppler, 0.08, 5.0);

  // ── ISCO 内缘辉光（保守强度，不淹没颜色层次）──────────
  float innerGlow = exp(-ct * 10.0) * 1.4;
  color += vec3(1.0, 0.88, 0.55) * innerGlow;

  vColor = color;

  // ── Alpha：大幅降低单粒子 alpha，防止叠加混合变白 ────
  // 100k 粒子叠加后密集区自然饱和，稀疏区保持橙色
  float sizeVar  = 0.3 + fract(aRandom * 777.3) * 0.7;
  float edgeFade = 1.0 - smoothstep(0.76, 1.0, ct);
  vAlpha = sizeVar * edgeFade * (0.022 + innerGlow * 0.028);

  // ── 投影与粒子尺寸 ────────────────────────────────────
  vec4 mvp      = modelViewMatrix * vec4(p, 1.0);
  gl_Position   = projectionMatrix * mvp;

  float rawSize   = (1.2 + sizeVar * 1.5) * (14.0 / -mvp.z);
  float clampSize = min(rawSize, 8.0);
  gl_PointSize    = clampSize;
  vBrightness     = clamp(rawSize / clampSize, 1.0, 4.0);
}
