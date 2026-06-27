// We will create 3 spheres that orbit and fuse together

// Calculate dynamic positions
vec3 p1 = vec3(sin(uTime) * uRadius, cos(uTime * 1.3) * uRadius, 0.0);
vec3 p2 = vec3(cos(uTime * 1.1) * uRadius, sin(uTime * 0.8) * uRadius, 0.0);
vec3 p3 = vec3(0.0, sin(uTime * 1.5) * uRadius * 0.5, cos(uTime) * uRadius);

// Add an interactive sphere mapped to the mouse pointer
// (Assuming we pass uPointer in uniforms later)
vec3 pMouse = uPointer;

float d1 = sdSphere(p - p1, 1.0);
float d2 = sdSphere(p - p2, 1.1);
float d3 = sdSphere(p - p3, 0.9);
float dMouse = sdSphere(p - pMouse, 1.2);

// Smoothly combine them using the opSmoothUnion operator from sdfMath.glsl
float res = opSmoothUnion(d1, d2, uSmoothness);
res = opSmoothUnion(res, d3, uSmoothness);
res = opSmoothUnion(res, dMouse, uSmoothness);

// Return distance and a material ID
return vec2(res, 1.0);
