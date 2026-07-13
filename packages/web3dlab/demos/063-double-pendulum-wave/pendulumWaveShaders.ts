export const ribbonVertexShader = /* glsl */ `
  attribute float aSide;
  attribute float aProgress;
  attribute float aRibbon;
  attribute float aSpeed;

  varying float vSide;
  varying float vProgress;
  varying float vRibbon;
  varying float vSpeed;

  void main() {
    vSide = aSide;
    vProgress = aProgress;
    vRibbon = aRibbon;
    vSpeed = aSpeed;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const ribbonFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uColorSpeed;
  uniform float uRibbonCount;

  varying float vSide;
  varying float vProgress;
  varying float vRibbon;
  varying float vSpeed;

  vec3 hsv2rgb(vec3 c) {
    vec3 p = abs(fract(c.xxx + vec3(0.0, 0.6666667, 0.3333333)) * 6.0 - 3.0);
    return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
  }

  void main() {
    float edge = 1.0 - smoothstep(0.28, 1.0, abs(vSide));
    float head = smoothstep(0.0, 0.18, vProgress);
    float tail = smoothstep(0.0, 0.24, vProgress);
    float shimmer = 0.9 + 0.1 * sin(vProgress * 97.0 + vRibbon * 4.7);
    float hue = fract(vRibbon / max(1.0, uRibbonCount) + vProgress * 0.34 + uTime * uColorSpeed);
    vec3 color = hsv2rgb(vec3(hue, 0.78, 1.0));
    float speedLight = 0.88 + min(vSpeed * 0.12, 0.34);
    float alpha = edge * tail * shimmer * (0.24 + 0.28 * vProgress);
    vec3 hdrColor = color * speedLight * (0.7 + edge * 0.48 + head * 0.08);
    gl_FragColor = vec4(hdrColor, alpha);
  }
`;

export const particleVertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = aSize * (7.0 / max(1.0, -viewPosition.z));
    vAlpha = aAlpha;
  }
`;

export const particleFragmentShader = /* glsl */ `
  varying float vAlpha;

  void main() {
    vec2 centered = gl_PointCoord - 0.5;
    float radius = length(centered);
    float core = 1.0 - smoothstep(0.04, 0.48, radius);
    float halo = 1.0 - smoothstep(0.1, 0.5, radius);
    gl_FragColor = vec4(vec3(1.2 + core * 0.8), (core * 0.8 + halo * 0.2) * vAlpha);
  }
`;
