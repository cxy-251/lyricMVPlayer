uniform float uRibbonLength;

varying float vAlpha;
varying vec3 vColor;
varying vec2 vScreenVelocity;
varying float vCore;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);

  // Stretch UV based on screen velocity to create "ribbons"
  float speed2D = length(vScreenVelocity);
  if (speed2D > 0.0001) {
      vec2 dir = normalize(vScreenVelocity);

      // Project UV onto velocity direction and its tangent
      float dotDir = dot(uv, dir);
      vec2 tangent = vec2(-dir.y, dir.x);
      float dotTan = dot(uv, tangent);

      // Squish the tangent axis to make it thinner along the cross axis
      // which effectively elongates the particle along the velocity direction
      // Clamp the stretch factor to prevent particles from becoming infinitely thin
      float stretch = clamp(1.0 + speed2D * 28.0 * uRibbonLength, 1.0, 3.8);
      dotTan *= stretch;
      uv = dir * dotDir + tangent * dotTan;
  }

  float dist = length(uv);
  if (dist > 0.5) discard;

  float halo = smoothstep(0.5, 0.0, dist);
  float core = smoothstep(0.18, 0.0, dist);
  float softAlpha = halo * 0.34 + core * 1.1;

  vec3 color = vColor * (halo * 0.5 + core * (1.5 + vCore * 0.7));
  gl_FragColor = vec4(color, vAlpha * softAlpha);
}
