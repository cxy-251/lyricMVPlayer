// Simulation structure inspired by Pavel Dobryakov's MIT-licensed
// WebGL-Fluid-Simulation and GPU Gems chapter 38. Shader code is rewritten
// for the web3dlab runtime in this directory.

export const BASE_VERTEX_SHADER = `
precision highp float;
attribute vec2 aPosition;
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
uniform vec2 texelSize;

void main () {
  vUv = aPosition * 0.5 + 0.5;
  vL = vUv - vec2(texelSize.x, 0.0);
  vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y);
  vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const COPY_SHADER = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTexture;
void main () {
  gl_FragColor = texture2D(uTexture, vUv);
}
`;

export const CLEAR_SHADER = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTexture;
uniform float value;
void main () {
  gl_FragColor = texture2D(uTexture, vUv) * value;
}
`;

export const SPLAT_SHADER = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTarget;
uniform float aspectRatio;
uniform vec3 color;
uniform vec2 point;
uniform float radius;

void main () {
  vec2 offset = vUv - point;
  offset.x *= aspectRatio;
  float influence = exp(-dot(offset, offset) / max(radius, 0.00001));
  vec3 base = texture2D(uTarget, vUv).xyz;
  gl_FragColor = vec4(base + color * influence, 1.0);
}
`;

export const ADVECTION_SHADER = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 velocityTexelSize;
uniform float dt;
uniform float dissipation;

void main () {
  vec2 velocity = texture2D(uVelocity, vUv).xy;
  vec2 coord = clamp(vUv - dt * velocity * velocityTexelSize, 0.001, 0.999);
  gl_FragColor = texture2D(uSource, coord) * dissipation;
}
`;

export const CURL_SHADER = `
precision highp float;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
uniform sampler2D uVelocity;

void main () {
  float left = texture2D(uVelocity, vL).y;
  float right = texture2D(uVelocity, vR).y;
  float top = texture2D(uVelocity, vT).x;
  float bottom = texture2D(uVelocity, vB).x;
  float value = right - left - top + bottom;
  gl_FragColor = vec4(0.5 * value, 0.0, 0.0, 1.0);
}
`;

export const VORTICITY_SHADER = `
precision highp float;
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float curl;
uniform float dt;

void main () {
  float left = abs(texture2D(uCurl, vL).x);
  float right = abs(texture2D(uCurl, vR).x);
  float top = abs(texture2D(uCurl, vT).x);
  float bottom = abs(texture2D(uCurl, vB).x);
  float center = texture2D(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(top - bottom, right - left);
  force /= length(force) + 0.0001;
  force *= curl * center;
  force.y *= -1.0;
  vec2 velocity = texture2D(uVelocity, vUv).xy;
  velocity += force * dt;
  velocity = min(max(velocity, vec2(-1000.0)), vec2(1000.0));
  gl_FragColor = vec4(velocity, 0.0, 1.0);
}
`;

export const DIVERGENCE_SHADER = `
precision highp float;
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
uniform sampler2D uVelocity;

void main () {
  float left = texture2D(uVelocity, vL).x;
  float right = texture2D(uVelocity, vR).x;
  float top = texture2D(uVelocity, vT).y;
  float bottom = texture2D(uVelocity, vB).y;
  vec2 center = texture2D(uVelocity, vUv).xy;
  if (vL.x < 0.0) left = -center.x;
  if (vR.x > 1.0) right = -center.x;
  if (vT.y > 1.0) top = -center.y;
  if (vB.y < 0.0) bottom = -center.y;
  gl_FragColor = vec4(0.5 * (right - left + top - bottom), 0.0, 0.0, 1.0);
}
`;

export const PRESSURE_SHADER = `
precision highp float;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;

void main () {
  float left = texture2D(uPressure, vL).x;
  float right = texture2D(uPressure, vR).x;
  float top = texture2D(uPressure, vT).x;
  float bottom = texture2D(uPressure, vB).x;
  float divergence = texture2D(uDivergence, (vL + vR) * 0.5).x;
  float pressure = (left + right + top + bottom - divergence) * 0.25;
  gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
}
`;

export const GRADIENT_SUBTRACT_SHADER = `
precision highp float;
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;

void main () {
  float left = texture2D(uPressure, vL).x;
  float right = texture2D(uPressure, vR).x;
  float top = texture2D(uPressure, vT).x;
  float bottom = texture2D(uPressure, vB).x;
  vec2 velocity = texture2D(uVelocity, vUv).xy;
  velocity -= vec2(right - left, top - bottom);
  gl_FragColor = vec4(velocity, 0.0, 1.0);
}
`;

export const BLOOM_PREFILTER_SHADER = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTexture;
uniform float threshold;
uniform float softKnee;

void main () {
  vec3 color = texture2D(uTexture, vUv).rgb;
  float brightness = max(color.r, max(color.g, color.b));
  float knee = max(threshold * softKnee, 0.0001);
  float soft = clamp((brightness - threshold + knee) / (2.0 * knee), 0.0, 1.0);
  float contribution = max(brightness - threshold, 0.0) + knee * soft * soft;
  contribution /= max(brightness, 0.0001);
  gl_FragColor = vec4(color * contribution, 1.0);
}
`;

export const BLOOM_BLUR_SHADER = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTexture;
uniform vec2 direction;

void main () {
  vec3 color = texture2D(uTexture, vUv).rgb * 0.227027;
  color += texture2D(uTexture, vUv + direction * 1.384615).rgb * 0.316216;
  color += texture2D(uTexture, vUv - direction * 1.384615).rgb * 0.316216;
  color += texture2D(uTexture, vUv + direction * 3.230769).rgb * 0.070270;
  color += texture2D(uTexture, vUv - direction * 3.230769).rgb * 0.070270;
  gl_FragColor = vec4(color, 1.0);
}
`;

export const BLOOM_FINAL_SHADER = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uBloom0;
uniform sampler2D uBloom1;
uniform sampler2D uBloom2;
uniform float intensity;

void main () {
  vec3 bloom = texture2D(uBloom0, vUv).rgb * 0.52;
  bloom += texture2D(uBloom1, vUv).rgb * 0.31;
  bloom += texture2D(uBloom2, vUv).rgb * 0.17;
  gl_FragColor = vec4(bloom * intensity, 1.0);
}
`;

export const SUNRAYS_MASK_SHADER = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTexture;

void main () {
  vec3 color = texture2D(uTexture, vUv).rgb;
  float brightness = max(color.r, max(color.g, color.b));
  float mask = smoothstep(0.08, 0.8, brightness);
  gl_FragColor = vec4(mask, mask, mask, 1.0);
}
`;

export const SUNRAYS_SHADER = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTexture;
uniform float weight;
uniform float exposure;

void main () {
  vec2 coord = vUv;
  vec2 direction = (vUv - 0.5) * (0.34 / 20.0);
  float illuminationDecay = 1.0;
  float rays = 0.0;
  for (int i = 0; i < 20; i++) {
    coord -= direction;
    rays += texture2D(uTexture, coord).r * illuminationDecay * weight;
    illuminationDecay *= 0.95;
  }
  gl_FragColor = vec4(vec3(rays * exposure), 1.0);
}
`;

export const DISPLAY_SHADER = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uDye;
uniform sampler2D uBloom;
uniform sampler2D uSunrays;
uniform vec3 background;
uniform float bloomEnabled;
uniform float sunraysEnabled;
uniform float transparentBackground;

float hash (vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main () {
  vec3 dye = texture2D(uDye, vUv).rgb;
  vec3 bloom = texture2D(uBloom, vUv).rgb * bloomEnabled;
  float rays = texture2D(uSunrays, vUv).r * sunraysEnabled;
  float density = max(dye.r, max(dye.g, dye.b));
  vec3 smoke = dye + bloom + rays * (dye * 0.65 + vec3(0.18));
  smoke += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  float alpha = clamp(density * 1.35 + max(bloom.r, max(bloom.g, bloom.b)), 0.0, 1.0);
  vec3 color = transparentBackground > 0.5 ? smoke : mix(background, smoke, alpha);
  gl_FragColor = vec4(color, transparentBackground > 0.5 ? alpha : 1.0);
}
`;
