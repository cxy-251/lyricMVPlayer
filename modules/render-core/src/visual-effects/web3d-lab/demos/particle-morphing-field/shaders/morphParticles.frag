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
  float core = smoothstep(0.5, 0.0, distanceToCenter);
  float spark = smoothstep(0.12, 0.0, distanceToCenter);
  float halo = smoothstep(0.5, 0.16, distanceToCenter);

  // Premium holographic coloring instead of flat lerping
  vec3 color = palette(vColorMix * 0.8 + vHot * 0.2);
  color = mix(color, vec3(1.0, 0.95, 0.9), vHot * 0.5); // Add intense white-hot core

  float alpha = core * vAlpha * 0.8;
  vec3 emission = color * (halo * 0.35 * vHalo + spark * 1.2 + vHot * 0.6);

  if (alpha < 0.015) {
    discard;
  }

  gl_FragColor = vec4(emission, alpha);
}
