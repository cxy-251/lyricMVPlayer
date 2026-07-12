uniform float uTime;
uniform float uDelta;
uniform float uSeparationForce;
uniform float uAlignmentForce;
uniform float uCohesionForce;
uniform float uMaxSpeed;
uniform float uPointerForce;
uniform vec3 uPointer;
uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform vec2 uResolution;

const float SEPARATION_DISTANCE = 0.62;
const float ALIGNMENT_DISTANCE = 1.65;
const float COHESION_DISTANCE = 2.35;
const float BOUNDARY_RADIUS = 5.6;

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec3 position = texture2D(uPosition, uv).xyz;
  vec3 velocity = texture2D(uVelocity, uv).xyz;
  vec3 separation = vec3(0.0);
  vec3 alignment = vec3(0.0);
  vec3 cohesion = vec3(0.0);
  float separationWeight = 0.0;
  float alignmentWeight = 0.0;
  float cohesionWeight = 0.0;

  for (float y = 0.0; y < 32.0; y += 1.0) {
    for (float x = 0.0; x < 32.0; x += 1.0) {
      vec2 otherUv = (vec2(x, y) + 0.5) / uResolution;
      vec3 otherPosition = texture2D(uPosition, otherUv).xyz;
      vec3 difference = position - otherPosition;
      float distanceToOther = length(difference);

      if (distanceToOther > 0.001) {
        if (distanceToOther < SEPARATION_DISTANCE) {
          float weight = 1.0 - smoothstep(0.0, SEPARATION_DISTANCE, distanceToOther);
          separation += difference / max(distanceToOther * distanceToOther, 0.01) * weight;
          separationWeight += weight;
        }

        if (distanceToOther < ALIGNMENT_DISTANCE) {
          float weight = 1.0 - smoothstep(0.0, ALIGNMENT_DISTANCE, distanceToOther);
          alignment += texture2D(uVelocity, otherUv).xyz * weight;
          alignmentWeight += weight;
        }

        if (distanceToOther < COHESION_DISTANCE) {
          float weight = 1.0 - smoothstep(0.0, COHESION_DISTANCE, distanceToOther);
          cohesion += otherPosition * weight;
          cohesionWeight += weight;
        }
      }
    }
  }

  vec3 acceleration = vec3(0.0);

  if (separationWeight > 0.0) {
    acceleration += normalize(separation / separationWeight) * uSeparationForce;
  }

  if (alignmentWeight > 0.0) {
    vec3 averageVelocity = alignment / alignmentWeight;
    acceleration += (averageVelocity - velocity) * uAlignmentForce;
  }

  if (cohesionWeight > 0.0) {
    vec3 neighborhoodCenter = cohesion / cohesionWeight;
    acceleration += (neighborhoodCenter - position) * uCohesionForce;
  }

  vec3 pointerOffset = position - uPointer;
  float pointerDistance = length(pointerOffset);
  if (pointerDistance > 0.001 && pointerDistance < 3.1) {
    float avoidance = 1.0 - pointerDistance / 3.1;
    acceleration += normalize(pointerOffset) * avoidance * avoidance * uPointerForce;
  }

  float distanceFromCenter = length(position);
  if (distanceFromCenter > BOUNDARY_RADIUS) {
    acceleration -= normalize(position) * (distanceFromCenter - BOUNDARY_RADIUS) * 3.2;
  } else {
    acceleration -= position * 0.012;
  }

  float boidSeed = dot(uv, vec2(127.1, 311.7));
  vec3 wander = vec3(
    sin(uTime * 0.91 + boidSeed),
    cos(uTime * 0.73 + boidSeed * 1.37),
    sin(uTime * 0.81 + boidSeed * 2.11)
  );
  acceleration += wander * 0.16;

  velocity += acceleration * min(uDelta, 0.04);
  float speed = length(velocity);
  float minimumSpeed = uMaxSpeed * 0.52;

  if (speed > 0.001) {
    velocity += normalize(velocity) * (uMaxSpeed * 0.76 - speed) * uDelta * 0.7;
  }

  speed = length(velocity);
  if (speed > uMaxSpeed) {
    velocity = normalize(velocity) * uMaxSpeed;
  } else if (speed < minimumSpeed && speed > 0.001) {
    velocity = normalize(velocity) * minimumSpeed;
  }

  gl_FragColor = vec4(velocity, 1.0);
}
