uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform float uDelta;
uniform float uTime;
uniform vec3 uPointer;
uniform float uGravity;
uniform float uFriction;
uniform float uTurbulence;
uniform float uFeedRate;

varying vec2 vUv;

// 3D Simplex Noise from WebGL standard library
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

float snoise(vec3 v){
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  // First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;

  // Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  //  x0 = x0 - 0.0 + 0.0 * C
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

  // Permutations
  i = mod(i, 289.0 );
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  // Gradients
  // ( N*N points uniformly over a square, mapped onto an octahedron.)
  float n_ = 1.0/7.0; // N=7
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

  //Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  // Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
}

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
  vec3 curlVec = vec3( x , y , z ) * divisor;
  float curlLen = length(curlVec);
  return curlLen > 0.0001 ? (curlVec / curlLen) : vec3(0.0);
}

void main() {
  vec4 posData = texture2D(uPosition, vUv);
  vec4 velData = texture2D(uVelocity, vUv);

  vec3 pos = posData.xyz;
  vec3 vel = velData.xyz;
  float seed = posData.w; // Used as a random seed

  // The black hole is at the center (0,0,0)
  vec3 dir = vec3(0.0, 0.0, 0.0) - pos;
  float dist = length(dir);

  // Prevent normalize(vec3(0)) NaN explosion which poisons the FBO
  if (dist < 0.0001) {
    dir = vec3(0.0001, 0.0, 0.0);
    dist = 0.0001;
  }
  vec3 normDir = dir / dist;
  vec3 predictedPos = pos + vel * uDelta;
  float predictedDist = length(predictedPos);
  float respawnRand = fract(sin(dot(vec2(seed, uTime * 0.17), vec2(12.9898, 78.233))) * 43758.5453);

  if (predictedDist > 36.0 || predictedDist < 1.08 || pos.x != pos.x || predictedPos.x != predictedPos.x || respawnRand < uFeedRate) {
    float angle = fract(seed * 17.137 + uTime * 0.018) * 6.28318530718;
    float radiusJitter = fract(seed * 123.456 + uTime * 0.071);
    float laneJitter = fract(seed * 41.771 + uTime * 0.037);
    float innerRadius = 1.65 + pow(radiusJitter, 1.7) * 4.35;
    float outerRadius = 10.5 + radiusJitter * 8.0;
    float useInnerDisk = max(step(laneJitter, 0.48), step(predictedDist, 1.08));
    float radius = mix(outerRadius, innerRadius, useInnerDisk);
    vec3 spawnDir = normalize(vec3(cos(angle), 0.0, sin(angle)));
    vec3 spawnTangent = normalize(cross(-spawnDir, vec3(0.0, 1.0, 0.0)));
    float spawnSpeed = sqrt(max(uGravity / max(radius, 1.0), 0.0)) * mix(1.28, 1.42, useInnerDisk);
    float verticalSeed = fract(seed * 761.31 + uTime * 0.053) - 0.5;
    vel = spawnTangent * spawnSpeed + vec3(0.0, verticalSeed * 0.18, 0.0);
    gl_FragColor = vec4(vel, 1.0);
    return;
  }

  // ==========================================
  // ACCRETION DISK GRAVITY & ORBIT
  // ==========================================
  float safeDist = max(dist, 1.25);

  float gravityForce = uGravity / (safeDist * safeDist + 6.0) + exp(-safeDist * 0.45) * uGravity * 0.08;

  vec3 force = normDir * gravityForce;

  // Tangential orbital direction (Accretion disk rotation swirl)
  vec3 tangent = normalize(cross(normDir, vec3(0.0, 1.0, 0.0)));
  if (length(tangent) < 0.0001) tangent = vec3(1.0, 0.0, 0.0);

  // ==========================================
  // 3D CURL NOISE TURBULENCE
  // ==========================================
  vec3 curl = curlNoise(pos * 0.18 + uTime * 0.08 + seed * 5.0);
  float curlMagnitude = (0.16 + exp(-safeDist * 0.22) * 0.9) * uTurbulence;
  force += curl * curlMagnitude;

  vel += force * uDelta;

  // ==========================================
  // KEPLERIAN ORBIT STEERING & FRICTION
  // ==========================================
  float idealSpeed = sqrt(gravityForce * safeDist) * 1.12;
  vec3 idealTangentVel = tangent * idealSpeed;

  // Split current velocity
  float radialSpeed = dot(vel, normDir);
  vec3 radialVel = radialSpeed * normDir;
  vec3 tangentVel = vel - radialVel;
  float horizonHold = 1.0 - smoothstep(1.35, 3.25, safeDist);
  float photonBand = smoothstep(1.28, 1.65, safeDist) * (1.0 - smoothstep(3.4, 5.8, safeDist));

  float frictionAmount = smoothstep(0.94, 0.998, uFriction);
  radialVel *= mix(0.84, 0.995, frictionAmount);
  radialVel -= normDir * max(radialSpeed, 0.0) * horizonHold * 0.42;
  tangentVel *= mix(0.9, 1.002, frictionAmount);
  tangentVel.y *= mix(0.94, 0.84, photonBand);

  // Steer tangential velocity towards ideal Keplerian orbit
  tangentVel = mix(tangentVel, idealTangentVel, uDelta * (1.25 + photonBand * 1.55));

  vel = radialVel + tangentVel;

  float outerInjection = smoothstep(14.0, 18.5, dist);
  vec3 injectedVel = tangent * sqrt(max(uGravity / max(dist, 1.0), 0.0)) * 1.35 + curl * uTurbulence * 0.16;
  vel = mix(vel, injectedVel, outerInjection * 0.08);
  float ringInjection = smoothstep(1.4, 2.0, dist) * (1.0 - smoothstep(4.8, 6.0, dist));
  vec3 ringVel = tangent * sqrt(max(uGravity / max(dist, 1.0), 0.0)) * 1.34 + curl * uTurbulence * 0.12;
  vel = mix(vel, ringVel, ringInjection * 0.055);

  float currentSpeed = length(vel);

  // Robust NaN check and Speed Clamp
  if (!(currentSpeed >= 0.0)) {
    vel = tangent * sqrt(max(uGravity / max(dist, 1.0), 0.0));
  } else if (currentSpeed > 12.0) {
    vel = (vel / currentSpeed) * 12.0;
  }

  gl_FragColor = vec4(vel, 1.0);
}
