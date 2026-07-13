export const moltenReliefVertexShader = `
precision highp float;

void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const moltenReliefFragmentShader = `
precision highp float;

uniform float uTime;
uniform float uSeed;
uniform float uReliefStrength;
uniform float uNormalStrength;
uniform float uCellularScale;
uniform float uCellularDistortion;
uniform float uLayerScale;
uniform float uCrystalStrength;
uniform float uSymmetryStrength;
uniform float uErosionStrength;
uniform float uHeatIntensity;
uniform float uBlueRimStrength;
uniform float uLightAngle;
uniform float uQuality;
uniform vec2 uResolution;

#define PI 3.14159265359

vec2 hash22(vec2 point) {
  vec3 p3 = fract(vec3(point.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float valueNoise(vec2 point) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  vec2 smoothLocal = local * local * (3.0 - 2.0 * local);
  float a = hash22(cell).x;
  float b = hash22(cell + vec2(1.0, 0.0)).x;
  float c = hash22(cell + vec2(0.0, 1.0)).x;
  float d = hash22(cell + vec2(1.0, 1.0)).x;
  return mix(mix(a, b, smoothLocal.x), mix(c, d, smoothLocal.x), smoothLocal.y);
}

vec3 voronoi(vec2 point, float time) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  float nearest = 8.0;
  float second = 8.0;
  float identity = 0.0;

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y));
      vec2 random = hash22(cell + offset + uSeed * 0.013);
      vec2 motion = sin(time * 1.1 + random * 6.28318) * 0.085;
      vec2 delta = offset + 0.5 + (random - 0.5) * 0.72 + motion - local;
      float distanceToSeed = dot(delta, delta);
      if (distanceToSeed < nearest) {
        second = nearest;
        nearest = distanceToSeed;
        identity = random.y;
      } else if (distanceToSeed < second) {
        second = distanceToSeed;
      }
    }
  }

  return vec3(sqrt(nearest), sqrt(second) - sqrt(nearest), identity);
}

vec2 foldedCoordinates(vec2 point) {
  float radius = length(point);
  float angle = atan(point.y, point.x);
  float sector = PI / 3.0;
  angle = abs(mod(angle + sector * 0.5, sector) - sector * 0.5);
  return vec2(cos(angle), sin(angle)) * radius;
}

vec4 surfaceField(vec2 point) {
  float slowTime = uTime;
  vec2 seedOffset = hash22(vec2(uSeed * 0.017, uSeed * 0.031)) - 0.5;
  vec2 noisePoint = point * 0.78 + seedOffset * 3.0;
  vec2 warp = vec2(
    valueNoise(noisePoint + vec2(slowTime * 0.22, -slowTime * 0.13)),
    valueNoise(noisePoint + vec2(5.7 - slowTime * 0.16, 2.9 + slowTime * 0.19))
  ) - 0.5;

  vec2 asymmetric = point + warp * uCellularDistortion;
  vec2 symmetric = foldedCoordinates(point + warp * uCellularDistortion * 0.56);
  vec2 domain = mix(asymmetric, symmetric, uSymmetryStrength * 0.78);
  domain += vec2(
    sin(point.y * 2.3 + slowTime * 0.42),
    cos(point.x * 1.9 - slowTime * 0.36)
  ) * 0.045 * uCellularDistortion;

  vec3 cell = voronoi(domain * uCellularScale, slowTime);
  float cellBody = 1.0 - smoothstep(0.13, 0.67, cell.x);
  float cellWall = 1.0 - smoothstep(0.022, 0.125, cell.y);
  float layerNoise = valueNoise(domain * (0.72 + uLayerScale * 0.18) + seedOffset * 4.0);
  float layerPhase = (domain.y * 1.35 + domain.x * 0.18 + layerNoise * 0.86) * uLayerScale * 4.2;
  layerPhase += sin(domain.x * 3.1 - slowTime * 1.8) * 0.52;
  float strata = pow(1.0 - abs(sin(layerPhase)), mix(5.0, 9.0, clamp(uQuality * 0.5, 0.0, 1.0)));

  vec2 crystalDomain = domain * 1.26 + seedOffset * 2.0;
  vec2 crystalCell = floor(crystalDomain);
  vec2 crystalCenter = (hash22(crystalCell + 7.4) - 0.5) * 0.36;
  vec2 crystalPoint = fract(crystalDomain) - 0.5 - crystalCenter;
  float crystalRadius = length(crystalPoint);
  float crystalAngle = atan(crystalPoint.y, crystalPoint.x);
  float petalCount = 5.0 + floor(hash22(crystalCell + 2.8).x * 4.0);
  float petals = 0.5 + 0.5 * cos(crystalAngle * petalCount + slowTime * 0.72 + cell.z * 5.0);
  float crystal = pow(petals, 4.0) * smoothstep(0.56, 0.04, crystalRadius);

  float erosionNoise = mix(warp.y, cell.z, 0.36) + 0.16 * sin(layerPhase * 0.43 + slowTime * 2.4);
  float erosion = smoothstep(0.44, 0.82, erosionNoise + cell.x * 0.22);
  float breathing = 0.5 + 0.5 * sin(slowTime * 2.4 + cell.z * 4.0 + domain.x * 0.8);

  float height = 0.09;
  height += cellBody * mix(0.34, 0.47, breathing);
  height += cellWall * 0.23;
  height += strata * (0.12 + 0.06 * cellBody);
  height += crystal * uCrystalStrength * 0.42;
  height -= erosion * uErosionStrength * 0.29;
  height += (layerNoise - 0.5) * 0.08;
  height = clamp(height * uReliefStrength, 0.015, 1.42);

  return vec4(height, cellWall, crystal, strata);
}

vec3 heatGradient(float value) {
  vec3 abyss = vec3(0.035, 0.002, 0.008);
  vec3 ember = vec3(0.26, 0.008, 0.012);
  vec3 crimson = vec3(0.72, 0.035, 0.012);
  vec3 orange = vec3(1.0, 0.22, 0.012);
  vec3 gold = vec3(1.0, 0.68, 0.09);
  vec3 whiteHot = vec3(1.32, 1.08, 0.56);
  vec3 color = mix(abyss, ember, smoothstep(0.03, 0.28, value));
  color = mix(color, crimson, smoothstep(0.22, 0.52, value));
  color = mix(color, orange, smoothstep(0.48, 0.78, value));
  color = mix(color, gold, smoothstep(0.76, 1.0, value));
  color = mix(color, whiteHot, smoothstep(0.98, 1.18, value));
  return color;
}

void main() {
  vec2 resolution = max(uResolution, vec2(1.0));
  vec2 point = (gl_FragCoord.xy - resolution * 0.5) / max(resolution.x, resolution.y);
  point *= 3.45;

  float epsilon = mix(2.5, 1.25, clamp(uQuality * 0.5, 0.0, 1.0)) / max(resolution.x, resolution.y) * 3.45;
  vec4 center = surfaceField(point);
  float left = surfaceField(point - vec2(epsilon, 0.0)).x;
  float right = surfaceField(point + vec2(epsilon, 0.0)).x;
  float down = surfaceField(point - vec2(0.0, epsilon)).x;
  float up = surfaceField(point + vec2(0.0, epsilon)).x;

  vec3 normal = normalize(vec3(
    (left - right) * uNormalStrength,
    (down - up) * uNormalStrength,
    epsilon * 165.0
  ));
  vec3 viewDirection = vec3(0.0, 0.0, 1.0);
  vec3 lightDirection = normalize(vec3(cos(uLightAngle), sin(uLightAngle), 0.82));
  vec3 halfDirection = normalize(lightDirection + viewDirection);
  float diffuse = max(dot(normal, lightDirection), 0.0);
  float halfLambert = dot(normal, lightDirection) * 0.5 + 0.5;
  float specular = pow(max(dot(normal, halfDirection), 0.0), 42.0);
  float broadSpecular = pow(max(dot(normal, halfDirection), 0.0), 9.0);
  float slope = clamp(1.0 - normal.z, 0.0, 1.0);
  float curvature = abs(left + right + down + up - center.x * 4.0) * 18.0;
  float ambientOcclusion = clamp(0.34 + center.x * 0.58 - slope * 0.24 - curvature * 0.12, 0.18, 1.0);

  float thermal = clamp(center.x * 0.61 + halfLambert * 0.14 + center.w * 0.045, 0.0, 1.16);
  vec3 color = heatGradient(thermal) * (0.4 + diffuse * 0.78);
  color *= ambientOcclusion;

  float fissureHeat = center.y * smoothstep(0.16, 0.72, center.x) * (0.42 + center.w * 0.58);
  color += vec3(1.18, 0.34, 0.015) * fissureHeat * uHeatIntensity * 0.48;
  color += vec3(1.24, 0.86, 0.31) * specular * uHeatIntensity * 1.18;
  color += vec3(0.72, 0.16, 0.018) * broadSpecular * 0.34;

  float blueEdge = smoothstep(0.16, 0.66, slope) * smoothstep(0.012, 0.17, curvature + center.y * 0.035);
  blueEdge *= smoothstep(0.24, 0.58, center.x) * (1.0 - smoothstep(0.8, 1.18, center.x));
  blueEdge = pow(blueEdge, 2.25) * uBlueRimStrength;
  vec3 coldRim = mix(vec3(0.04, 0.28, 1.2), vec3(0.12, 0.82, 1.42), center.w);
  color = mix(color, coldRim * (1.05 + broadSpecular), clamp(blueEdge, 0.0, 0.82));

  float lowVariation = valueNoise(point * 0.54 + uSeed * 0.009);
  color *= mix(vec3(0.82, 0.9, 1.0), vec3(1.08, 0.86, 0.78), lowVariation * 0.22);
  color *= uHeatIntensity;
  float vignette = 1.0 - smoothstep(0.48, 1.36, length(point) * 0.66) * 0.26;
  color *= vignette;

  gl_FragColor = vec4(color, 1.0);
}
`;
