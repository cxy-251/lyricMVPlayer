precision highp float;

varying vec2 vUv;

uniform sampler2D uTrail;
uniform vec2 uPointer;
uniform vec2 uResolution;
uniform float uBackgroundScale;
uniform float uDistortionStrength;
uniform float uTime;
uniform float uZoom;
uniform float uSpecularIntensity;
uniform float uSpecularShininess;

// Cosine based palette for iridescent holographic colors
vec3 palette(in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d) {
    return a + b * cos(6.2831853 * (c * t + d));
}

void main() {
  vec2 uv = vUv;
  
  // Sample distance for normal map calculation
  vec2 texel = vec2(2.5, 2.5) / uResolution;

  // Sample fluid density from the trail texture
  float dC = texture2D(uTrail, uv).z; // Center
  float dR = texture2D(uTrail, uv + vec2(texel.x, 0.0)).z; // Right
  float dU = texture2D(uTrail, uv + vec2(0.0, texel.y)).z; // Up
  
  // Calculate gradient (Surface Normal)
  float dx = dR - dC;
  float dy = dU - dC;
  
  // Construct the 3D surface normal
  // normalZ controls the "bumpiness" - smaller value = steeper waves
  float normalZ = 0.012 / max(uDistortionStrength, 0.1); 
  vec3 normal = normalize(vec3(-dx, -dy, normalZ));
  
  // View vector (Looking straight at the screen)
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  
  // Fixed light direction to prevent erratic screen-wide flashes
  vec3 lightDir = normalize(vec3(0.5, 0.8, 1.0));
  
  // Reflection vector
  vec3 ref = reflect(-viewDir, normal);
  
  // Iridescent coloring mapped to the reflection vector and fluid memory
  float memory = texture2D(uTrail, uv).a;
  float colorIndex = ref.x * 0.4 + ref.y * 0.4 + uTime * 0.15 + memory * 0.5;
  
  // Apple-style premium iridescent palette
  vec3 a = vec3(0.5, 0.5, 0.5);
  vec3 b = vec3(0.5, 0.5, 0.5);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.0, 0.33, 0.67);
  vec3 iridescence = palette(colorIndex, a, b, c, d);
  
  // Specular highlight (Glossy liquid metal), strictly masked by fluid density
  vec3 halfVector = normalize(lightDir + viewDir);
  float fluidMask = smoothstep(0.01, 0.05, dC); // Critical: Ensure background never catches highlights
  float specular = pow(max(dot(normal, halfVector), 0.0), uSpecularShininess) * fluidMask * uSpecularIntensity;
  
  // Diffuse lighting
  float diffuse = max(dot(normal, lightDir), 0.0) * fluidMask;
  
  // Fresnel effect for glowing edges, strictly masked
  float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0) * fluidMask;
  
  // Combine lighting components
  vec3 ambient = vec3(0.015, 0.02, 0.04); // Darker sleek background
  vec3 metallicColor = ambient 
                     + iridescence * diffuse * 1.2 
                     + vec3(1.0, 0.95, 0.9) * specular 
                     + iridescence * fresnel * 0.8;
                     
  // Base background for areas without fluid
  vec3 backgroundColor = vec3(0.01, 0.01, 0.015);
  
  // Blend liquid with background based on density
  float blendAlpha = smoothstep(0.0, 0.05, dC);
  vec3 finalColor = mix(backgroundColor, metallicColor, blendAlpha);
  
  // Add a dark physical drop shadow contour around the liquid
  float contour = smoothstep(0.0, 0.08, dC) - smoothstep(0.08, 0.15, dC);
  finalColor -= contour * 0.25;

  // Add subtle glow from the fluid flow
  vec2 flow = texture2D(uTrail, uv).xy * 2.0 - 1.0;
  finalColor += iridescence * length(flow) * 0.2 * blendAlpha;

  // Subtle Vignette
  vec2 aspect = vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
  vec2 center = (uv - 0.5) * aspect;
  float radial = length(center);
  finalColor *= smoothstep(1.3, 0.3, radial);

  gl_FragColor = vec4(finalColor, 1.0);
}
