uniform sampler2D uPosition;
uniform sampler2D uVelocity;

uniform vec3 uColorCore;
uniform vec3 uColorOuter;
uniform float uParticleSize;
uniform float uHorizonGlow;
uniform vec3 uPointer;

varying vec3 vColor;
varying float vAlpha;
varying float vDistToSingularity;
varying float vHorizonGlow;

void main() {
  vec4 posData = texture2D(uPosition, uv);
  vec4 velData = texture2D(uVelocity, uv);

  vec3 pos = posData.xyz;
  vec3 vel = velData.xyz;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  vDistToSingularity = length(pos);

  float speed = length(vel);
  float diskPlane = exp(-abs(pos.y) * 2.1);
  float photonRing = exp(-pow((vDistToSingularity - 1.62) / 0.42, 2.0)) * diskPlane;
  float innerAccretion = (1.0 - smoothstep(2.0, 6.2, vDistToSingularity)) * smoothstep(1.08, 1.55, vDistToSingularity) * diskPlane;
  vHorizonGlow = clamp((photonRing * 1.25 + innerAccretion * 0.35) * uHorizonGlow, 0.0, 4.0);

  // Dynamic Velocity Stretching: particles moving fast get stretched/enlarged
  // This simulates motion blur / light streaks on the GPU
  // Reduce size drastically for 1M particle volumetric blending
  float rawSize = uParticleSize * (27.0 / -mvPosition.z) * (1.0 + pow(speed, 1.05) * 0.045 + vHorizonGlow * 0.08);
  gl_PointSize = clamp(rawSize, 1.1, 4.8);

  // Distance-based color mapping with non-linear interpolation
  // The core is extremely hot and bright, the outer rim is cool
  float distanceFactor = clamp(1.0 - (vDistToSingularity / 16.0), 0.0, 1.0);

  // Non-linear pow for intense core focus
  vec3 baseColor = mix(uColorOuter, uColorCore, pow(distanceFactor, 1.45));

  // Additive blast for high-speed particles near the core
  float speedFactor = smoothstep(0.6, 7.5, speed);
  vColor = baseColor + (uColorCore * pow(speedFactor, 1.25) * 0.55) + (uColorCore * vHorizonGlow * 0.82);

  // Alpha fading based on speed and distance to simulate plasma density
  vAlpha = mix(0.32, 0.95, clamp(speedFactor + pow(distanceFactor, 1.8) + vHorizonGlow * 0.32, 0.0, 1.0));
}
