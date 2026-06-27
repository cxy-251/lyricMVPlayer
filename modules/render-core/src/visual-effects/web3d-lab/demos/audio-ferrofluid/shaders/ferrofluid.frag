varying vec2 vUv;
varying vec3 vRayDir;

uniform float uTime;
uniform float uRadius;
uniform float uSpikeIntensity;
uniform float uRippleIntensity;
uniform vec3 uColorDark;
uniform vec3 uColorLight;
uniform sampler2D uAudioTex;

// Standard SDF library
#include <sdfMath>

// 3D Simplex Noise from Ashima Arts (compact version)
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){ 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0 ); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  float n_ = 1.0/7.0;
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );
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
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
}

// SDF Mapping
vec2 map(vec3 p) {
  // Base Sphere
  float d = sdSphere(p, uRadius);
  
  // Audio Analysis
  // We sample bass for large spikes and treble for small ripples
  float bass = texture2D(uAudioTex, vec2(0.01, 0.5)).r;
  float mid = texture2D(uAudioTex, vec2(0.3, 0.5)).r;
  float treble = texture2D(uAudioTex, vec2(0.8, 0.5)).r;
  
  // Low frequency drives massive, slow displacement spikes
  float spikeNoise = snoise(p * 0.8 + uTime * 0.5);
  d += spikeNoise * (0.5 + bass * uSpikeIntensity);
  
  // Mid-High frequency drives rapid, sharp ripples
  float rippleNoise = snoise(p * 3.0 - uTime * 1.5);
  d += rippleNoise * (0.2 + (mid + treble) * uRippleIntensity);
  
  return vec2(d, 1.0);
}

// Calculate Normal
vec3 calcNormal(vec3 p) {
  const float h = 0.001; // slightly larger epsilon for noisy surfaces
  const vec2 k = vec2(1,-1);
  return normalize( k.xyy*map( p + k.xyy*h ).x + 
                    k.yyx*map( p + k.yyx*h ).x + 
                    k.yxy*map( p + k.yxy*h ).x + 
                    k.xxx*map( p + k.xxx*h ).x );
}

void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vRayDir);
  
  float t = 0.0;
  float d = 0.0;
  const int MAX_STEPS = 100;
  const float MAX_DIST = 50.0;
  
  for(int i=0; i<MAX_STEPS; i++) {
    vec3 p = ro + rd * t;
    d = map(p).x;
    // For highly displaced surfaces, we multiply d by a factor < 1.0 
    // to prevent raymarching overshoots!
    t += d * 0.5; 
    if(abs(d) < 0.001 || t > MAX_DIST) break;
  }
  
  if(t > MAX_DIST) {
    // Sleek dark gradient background
    vec3 bgCol = mix(vec3(0.02, 0.02, 0.03), vec3(0.0), length(vUv - 0.5));
    gl_FragColor = vec4(bgCol, 1.0);
    return;
  }
  
  // Hit Surface!
  vec3 p = ro + rd * t;
  vec3 n = calcNormal(p);
  
  // Audio for color modulation
  float bass = texture2D(uAudioTex, vec2(0.01, 0.5)).r;
  
  // Liquid Metal / Chrome Shading - Premium PBR Simulation
  // 1. Reflection Vector
  vec3 ref = reflect(rd, n);
  
  // 2. Premium Studio Environment (Multiple Fake Softboxes)
  vec3 envLight = vec3(0.01, 0.01, 0.02); // Base ambient
  envLight += vec3(1.0, 1.0, 1.0) * smoothstep(0.4, 0.95, ref.y); // Top overhead softbox
  envLight += vec3(1.0, 0.4, 0.1) * smoothstep(0.6, 0.95, dot(ref, normalize(vec3(-1.0, 0.2, 0.5)))) * 0.8; // Warm side rim
  envLight += vec3(0.1, 0.6, 1.0) * smoothstep(0.6, 0.95, dot(ref, normalize(vec3(1.0, -0.1, -0.5)))) * 0.8; // Cool back rim
  
  // 3. True Fresnel Schlick approximation
  vec3 f0 = vec3(0.9, 0.92, 0.95); // High metallic reflectivity
  vec3 fresnelTerm = f0 + (1.0 - f0) * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
  
  vec3 finalColor = envLight * fresnelTerm;
  
  // 4. Bass-driven Spectral Iridescence
  vec3 iridescence = 0.5 + 0.5 * cos(4.0 * dot(n, -rd) + vec3(0.0, 2.0, 4.0) + uTime);
  finalColor += iridescence * pow(1.0 - max(dot(n, -rd), 0.0), 2.0) * (bass * 1.5) * mix(uColorDark, uColorLight, 0.5);
  
  // 5. Microfacet Specular Highlight (Very sharp for liquid metal)
  vec3 lightDir = normalize(vec3(1.0, 2.5, 1.0));
  vec3 halfVector = normalize(lightDir - rd);
  float specular = pow(max(dot(n, halfVector), 0.0), 128.0) * 2.5;
  finalColor += specular * vec3(1.0);
  
  // 6. Fake Ambient Occlusion based on local geometry concavity
  float ao = clamp(map(p + n * 0.5).x * 2.0, 0.1, 1.0);
  finalColor *= ao;
  
  // 7. Subtle Depth Fog
  finalColor = mix(finalColor, vec3(0.02, 0.02, 0.03), 1.0 - exp(-0.005 * t * t));
  
  // ACES Film Tone Mapping (Sleek cinematic contrast)
  finalColor = clamp((finalColor*(2.51*finalColor+0.03))/(finalColor*(2.43*finalColor+0.59)+0.14), 0.0, 1.0);
  
  gl_FragColor = vec4(finalColor, 1.0);
}
