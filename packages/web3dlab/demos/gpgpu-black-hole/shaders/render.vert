uniform sampler2D uPosition;
uniform sampler2D uVelocity;

uniform vec3 uColorCore;
uniform vec3 uColorOuter;
uniform float uParticleSize;
uniform vec3 uPointer;

varying vec3 vColor;
varying float vAlpha;
varying float vDistToSingularity;

void main() {
  vec4 posData = texture2D(uPosition, uv);
  vec4 velData = texture2D(uVelocity, uv);

  vec3 pos = posData.xyz;
  vec3 vel = velData.xyz;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  vDistToSingularity = length(uPointer - pos);

  float speed = length(vel);
  
  // Point size is much larger so they overlap easily to create volumetric smoke
  gl_PointSize = uParticleSize * (45.0 / -mvPosition.z) * (1.0 + speed * 0.05);

  // Velocity-based color mapping: Slow = Deep Space Blue, Fast = Blazing Purple/White
  float speedFactor = smoothstep(0.0, 15.0, speed);
  vColor = mix(uColorOuter, uColorCore, pow(speedFactor, 1.5));
  
  // Base alpha increased significantly so particles are actually visible
  vAlpha = mix(0.15, 0.6, speedFactor);
}
