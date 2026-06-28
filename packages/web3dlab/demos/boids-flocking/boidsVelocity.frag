uniform float uTime;
uniform float uDelta;
uniform float uSeparationDistance;
uniform float uAlignmentDistance;
uniform float uCohesionDistance;
uniform float uSeparationForce;
uniform float uAlignmentForce;
uniform float uCohesionForce;
uniform float uMaxSpeed;
uniform vec3 uPointer;
uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform vec2 uResolution;

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec4 posData = texture2D(uPosition, uv);
  vec4 velData = texture2D(uVelocity, uv);
  
  vec3 position = posData.xyz;
  vec3 velocity = velData.xyz;
  
  vec3 separation = vec3(0.0);
  vec3 alignment = vec3(0.0);
  vec3 cohesion = vec3(0.0);
  
  int sepCount = 0;
  int aliCount = 0;
  int cohCount = 0;
  
  // O(N^2) loop to calculate boids forces
  for (float y = 0.0; y < uResolution.y; y++) {
    for (float x = 0.0; x < uResolution.x; x++) {
      if (x == gl_FragCoord.x && y == gl_FragCoord.y) continue;
      
      // Sample exactly at pixel centers
      vec2 otherUv = (vec2(x, y) + 0.5) / uResolution.xy;
      vec3 otherPos = texture2D(uPosition, otherUv).xyz;
      vec3 otherVel = texture2D(uVelocity, otherUv).xyz;
      
      vec3 diff = position - otherPos;
      float dist = length(diff);
      
      if (dist > 0.0) {
        // Separation
        if (dist < uSeparationDistance) {
          separation += normalize(diff) * (1.0 - dist / uSeparationDistance); // Closer = stronger force!
          sepCount++;
        }
        
        // Alignment
        if (dist < uAlignmentDistance) {
          alignment += otherVel;
          aliCount++;
        }
        
        // Cohesion
        if (dist < uCohesionDistance) {
          cohesion += otherPos;
          cohCount++;
        }
      }
    }
  }
  
  if (sepCount > 0) {
    separation = (separation / float(sepCount)) * uSeparationForce * 10.0; // scale up to match user's slider expectation
    velocity += separation;
  }
  
  if (aliCount > 0) {
    alignment = (alignment / float(aliCount));
    vec3 steer = alignment - velocity;
    velocity += steer * uAlignmentForce * 2.0;
  }
  
  if (cohCount > 0) {
    cohesion = (cohesion / float(cohCount));
    vec3 steer = cohesion - position;
    velocity += steer * uCohesionForce * 2.0;
  }
  
  // Predator Avoidance (Mouse)
  vec3 pointerDiff = position - uPointer;
  float pointerDist = length(pointerDiff);
  if (pointerDist < 4.0) {
    velocity += normalize(pointerDiff) * (4.0 - pointerDist) * 0.5;
  }
  
  // Center Attraction (Keep them on screen)
  velocity -= position * 0.005;
  
  // Limit speed
  float speed = length(velocity);
  if (speed > uMaxSpeed) {
    velocity = normalize(velocity) * uMaxSpeed;
  }
  
  // Basic wander for natural noise
  velocity.x += sin(uTime * 2.0 + position.y) * 0.01;
  velocity.y += cos(uTime * 1.5 + position.z) * 0.01;
  velocity.z += sin(uTime * 3.0 + position.x) * 0.01;
  
  gl_FragColor = vec4(velocity, 1.0);
}
