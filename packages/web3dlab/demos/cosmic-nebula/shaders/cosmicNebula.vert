uniform float uTime;
uniform float uNoiseScale;
uniform float uFlowSpeed;
uniform float uParticleSize;
uniform float uTwist;

uniform vec3 uColor1;
uniform vec3 uColor2;

varying float vAlpha;
varying vec3 vColor;
varying float vBrightness;

#include <simplex3d>

// Curl Noise uses the gradient of simplex noise to create fluid-like divergence-free fields
vec3 snoiseVec3( vec3 x ){
  float s  = snoise(vec3( x ));
  float s1 = snoise(vec3( x.y - 19.1 , x.z + 33.4 , x.x + 47.2 ));
  float s2 = snoise(vec3( x.z + 74.2 , x.x - 124.5 , x.y + 99.4 ));
  vec3 c = vec3( s , s1 , s2 );
  return c;
}

vec3 curlNoise( vec3 p ){
  const float e = .1;
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
  return normalize( vec3( x , y , z ) * divisor );
}

void main() {
  vec3 p = position;
  
  // Core noise displacement
  vec3 noisePos = p * uNoiseScale + uTime * uFlowSpeed;
  vec3 flow = curlNoise(noisePos);
  
  // Add macro-twist
  float dist = length(p.xy);
  float angle = uTime * uTwist / (dist + 1.0);
  float s = sin(angle);
  float c = cos(angle);
  p.xy = mat2(c, -s, s, c) * p.xy;
  
  // Apply fluid displacement
  // The curl field wraps the particles into swirling ribbons
  p += flow * 1.5;
  
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  
  // Size clamped at 8px to prevent near-view blurriness
  float rawSize = uParticleSize * (20.0 / -mvPosition.z);
  gl_PointSize = min(rawSize, 8.0);
  // Brightness compensation passed to fragment shader via alpha boost
  vBrightness = clamp(rawSize / 8.0, 1.0, 4.0);
  
  // Color Mapping based on fluid vector direction!
  // This creates the illusion of multi-colored neon gas mixing
  float colorMix = (flow.x + flow.y + flow.z) * 0.33 + 0.5;
  vColor = mix(uColor1, uColor2, colorMix);
  
  // Inner glowing core of the fluid is brighter, outer edges fade
  float centerDist = length(p) / 8.0;
  vAlpha = smoothstep(1.0, 0.0, centerDist) * 0.15;
}
