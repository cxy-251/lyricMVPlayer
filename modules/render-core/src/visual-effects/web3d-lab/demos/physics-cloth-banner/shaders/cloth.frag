precision highp float;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;

uniform float uGlowStrength;
uniform float uTime;

// Holographic Silk Palette
vec3 palette(in float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.263, 0.416, 0.557); // Iridescent blues and magentas
    return a + b * cos(6.2831853 * (c * t + d));
}

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
  
  // Fake Studio Light
  vec3 lightDir = normalize(vec3(0.5, 1.0, 0.8));
  vec3 halfVector = normalize(lightDir + viewDirection);
  
  // Silk Specular (Soft and glossy)
  float specular = pow(max(dot(normal, halfVector), 0.0), 32.0);
  
  // Fresnel Rim Light
  float rim = pow(1.0 - abs(dot(normal, viewDirection)), 2.0);
  
  // Holographic Iridescence mapped to viewing angle
  float iridescenceIndex = rim * 0.6 + sin(vUv.x * 5.0 + uTime * 0.3) * 0.2;
  vec3 silkColor = palette(iridescenceIndex);
  
  float scan = smoothstep(0.72, 1.0, sin(vUv.y * 76.0 + uTime * 1.8) * 0.5 + 0.5);

  // Deep premium background base
  vec3 baseColor = vec3(0.01, 0.015, 0.02);
  
  vec3 color = baseColor;
  color += silkColor * rim * (0.6 + uGlowStrength * 0.4);
  color += vec3(1.0, 0.95, 0.95) * specular * (0.3 + uGlowStrength * 0.3);
  color += silkColor * scan * 0.12;

  // Fade out edges smoothly
  float edgeFade = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x) * smoothstep(0.0, 0.08, vUv.y);
  float alpha = (0.35 + rim * 0.45 + scan * 0.05) * edgeFade;

  gl_FragColor = vec4(color, alpha);
}
