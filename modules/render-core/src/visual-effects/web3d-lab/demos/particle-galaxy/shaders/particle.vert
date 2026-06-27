// 背景星场顶点着色器
attribute float aStarSize;
attribute vec3  aStarColor;
varying   vec3  vStarColor;

void main() {
  vStarColor  = aStarColor;
  vec4 mvp    = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvp;

  float rawSize = aStarSize * (60.0 / -mvp.z);
  gl_PointSize  = min(rawSize, 4.0);
}
