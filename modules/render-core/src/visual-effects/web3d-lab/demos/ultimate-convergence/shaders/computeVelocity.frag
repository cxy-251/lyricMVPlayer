uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform sampler2D uAudioTex;
uniform sampler2D uFluidTexture;
uniform float uTime;
uniform vec2 uResolution;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec3 pos = texture2D(uPosition, uv).xyz;
  vec3 vel = texture2D(uVelocity, uv).xyz;
  
  float bass = texture2D(uAudioTex, vec2(0.01, 0.5)).r;
  float treble = texture2D(uAudioTex, vec2(0.8, 0.5)).r;
  
  vec3 dirToCenter = -pos;
  float dist = length(dirToCenter);
  vec3 normDir = normalize(dirToCenter);
  
  vec3 orbitDir = cross(normDir, vec3(0.0, 1.0, 0.0));
  if (pos.y > 0.0) orbitDir = cross(normDir, vec3(0.0, -1.0, 0.0));
  
  vec3 force = vec3(0.0);
  
  force += orbitDir * 8.0;
  force += normDir * (dist * 0.5);
  
  if (dist < 8.0) {
    force -= normDir * (bass * 150.0);
  }
  
  float rnd = hash(uv + uTime) * 2.0 - 1.0;
  force.y += rnd * treble * 20.0;
  
  vec2 screenUv = (pos.xy * 0.03) + 0.5;
  if (screenUv.x > 0.0 && screenUv.x < 1.0 && screenUv.y > 0.0 && screenUv.y < 1.0) {
    vec4 fluidData = texture2D(uFluidTexture, screenUv);
    vec2 fluidVel = fluidData.xy * 2.0 - 1.0;
    
    force.x += fluidVel.x * 200.0;
    force.y += fluidVel.y * 200.0;
  }
  
  vel += force * 0.016;
  vel *= 0.94;
  
  gl_FragColor = vec4(vel, 1.0);
}
