precision highp float;

varying float vAlpha;
varying float vColorMix;
varying float vHalo;
varying float vHot;

// Holographic Cosine Palette
vec3 palette(in float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.0, 0.33, 0.67);
    return a + b * cos(6.2831853 * (c * t + d));
}

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float distanceToCenter = length(uv);
  float core = smoothstep(0.48, 0.1, distanceToCenter);
  float spark = smoothstep(0.14, 0.0, distanceToCenter);
  float halo = smoothstep(0.5, 0.22, distanceToCenter);

  vec3 color = palette(vColorMix);
  vec3 accent = palette(vColorMix + 0.18);
  color = mix(color, accent, vHot * 0.32);

  float alpha = (core * 0.82 + spark * 0.34) * vAlpha;
  vec3 emission = color * (core * 0.95 + halo * 0.26 * vHalo) + vec3(1.0, 0.92, 0.78) * spark * vHot * 0.28;

  if (alpha < 0.015) {
    discard;
  }

  gl_FragColor = vec4(emission, alpha);
}
