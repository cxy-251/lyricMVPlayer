vec3 p1 = vec3(sin(uTime) * uRadius, cos(uTime * 1.3) * uRadius, 0.0);
vec3 p2 = vec3(cos(uTime * 1.1) * uRadius, sin(uTime * 0.8) * uRadius, 0.0);

// Read low frequency (bass) from the FFT texture (uAudioTex)
// uAudioTex is a 1D texture, so we sample at y=0.5
float bass = texture2D(uAudioTex, vec2(0.01, 0.5)).r;
float mid = texture2D(uAudioTex, vec2(0.5, 0.5)).r;

// The balls swell violently with the bass!
// Amplified multipliers!
float s1 = 1.0 + bass * 1.5;
float s2 = 1.1 + mid * 1.0;
float s3 = 0.9 + uBassScale * 4.0; // Controlled directly by uniform from JS

// Third ball jumps to the beat
vec3 p3 = vec3(0.0, sin(uTime * 1.5) * uRadius * 0.5 + uBassScale * 5.0, cos(uTime) * uRadius);

float d1 = sdSphere(p - p1, s1);
float d2 = sdSphere(p - p2, s2);
float d3 = sdSphere(p - p3, s3);

float res = opSmoothUnion(d1, d2, uSmoothness);
res = opSmoothUnion(res, d3, uSmoothness);

return vec2(res, 1.0);
