uniform float uTime;
uniform float uNoiseScale;
uniform float uFlowSpeed;
uniform float uTwist;
uniform float uOpacity;
uniform float uParticleSize;
uniform float uRibbonLength;

uniform vec3 uColor1;
uniform vec3 uColor2;

varying float vAlpha;
varying vec3 vColor;
varying vec2 vScreenVelocity;
varying float vCore;

#include <simplex3d>

vec3 snoiseVec3( vec3 x ){
  float s  = snoise(vec3( x ));
  float s1 = snoise(vec3( x.y - 19.1 , x.z + 33.4 , x.x + 47.2 ));
  float s2 = snoise(vec3( x.z + 74.2 , x.x - 124.5 , x.y + 99.4 ));
  return vec3( s , s1 , s2 );
}

vec3 curlNoise( vec3 p ){
  const float e = 0.1;
  vec3 dx = vec3( e   , 0.0 , 0.0 );
  vec3 dy = vec3( 0.0 , e   , 0.0 );
  vec3 dz = vec3( 0.0 , 0.0 , e   );

  vec3 p_x0 = snoiseVec3( p - dx );
  vec3 p_x1 = snoiseVec3( p + dx );
  vec3 p_y0 = snoiseVec3( p - dy );
  vec3 p_y1 = snoiseVec3( p + dy );
  vec3 p_z0 = snoiseVec3( p - dz );
  vec3 p_z1 = snoiseVec3( p + dz );

  float x = p_y1.z - p_y0.z - p_z1.y + p_z0.y;
  float y = p_z1.x - p_z0.x - p_x1.z + p_x0.z;
  float z = p_x1.y - p_x0.y - p_y1.x + p_y0.x;

  const float divisor = 1.0 / ( 2.0 * e );
  // Do NOT normalize here so we retain vorticity magnitude!
  return vec3( x , y , z ) * divisor;
}

void main() {
  vec3 p = position;

  // Core noise displacement
  vec3 noisePos = p * uNoiseScale + uTime * uFlowSpeed;
  vec3 flow = curlNoise(noisePos);
  float speed = length(flow); // Vorticity magnitude

  // Add macro-twist
  float distToCenter = length(p.xy);
  float angle = uTime * uTwist / (distToCenter + 1.0);
  float s = sin(angle);
  float c = cos(angle);
  p.xy = mat2(c, -s, s, c) * p.xy;

  // Apply a controlled curl displacement so filaments move without dissolving into smoke.
  p += flow * (0.22 + uRibbonLength * 0.08);

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Project velocity to screen space for ribbons in fragment shader
  vec4 projP = gl_Position;
  vec4 projV = projectionMatrix * modelViewMatrix * vec4(p + flow * (0.12 + uRibbonLength * 0.12), 1.0);

  if (projP.w > 0.01 && projV.w > 0.01) {
      vScreenVelocity = (projV.xy / projV.w) - (projP.xy / projP.w);
  } else {
      vScreenVelocity = vec2(0.0);
  }

  float radius = length(position);
  float coreWeight = 1.0 - smoothstep(1.2, 7.4, radius);
  float rawSize = uParticleSize * (15.0 / max(-mvPosition.z, 1.0));
  gl_PointSize = clamp(rawSize * mix(0.72, 1.45, coreWeight), 1.0, 8.5);

  // Color Mapping based on fluid vorticity (speed)
  // Fast = color1 (hot), Slow = color2 (cool)
  float colorMix = smoothstep(0.35, 2.75, speed) * 0.66 + coreWeight * 0.22;
  // Non-linear interpolation for dramatic core glow
  vColor = mix(uColor2, uColor1, pow(clamp(colorMix, 0.0, 1.0), 1.25));

  // Alpha Fading
  // 1. Center radial fade (Fix GLSL undefined behavior for smoothstep edges)
  float radialFade = 1.0 - smoothstep(6.2, 8.8, length(p));
  // 2. Depth Fading (Z-axis decay)
  float depthFade = exp(-pow(abs(mvPosition.z) * 0.035, 2.0));

  // Base opacity is dynamically controlled by Leva
  vCore = coreWeight;
  vAlpha = uOpacity * radialFade * depthFade * mix(0.78, 1.45, coreWeight);
}
