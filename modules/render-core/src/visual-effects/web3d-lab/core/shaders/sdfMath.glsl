// SDF (Signed Distance Field) Mathematics Library
// Provides standard primitives, operators, and utilities for Raymarching

// --- Primitives ---

float sdSphere( vec3 p, float s ) {
  return length(p) - s;
}

float sdBox( vec3 p, vec3 b ) {
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}

float sdTorus( vec3 p, vec2 t ) {
  vec2 q = vec2(length(p.xz)-t.x,p.y);
  return length(q)-t.y;
}

float sdPlane( vec3 p, vec3 n, float h ) {
  // n must be normalized
  return dot(p,n) + h;
}

// --- Boolean Operators ---

float opUnion( float d1, float d2 ) {
    return min(d1, d2);
}

float opSubtraction( float d1, float d2 ) {
    return max(-d1, d2);
}

float opIntersection( float d1, float d2 ) {
    return max(d1, d2);
}

// --- Smooth Boolean Operators (The magic behind Metaballs) ---

float opSmoothUnion( float d1, float d2, float k ) {
    float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) - k*h*(1.0-h);
}

float opSmoothSubtraction( float d1, float d2, float k ) {
    float h = clamp( 0.5 - 0.5*(d2+d1)/k, 0.0, 1.0 );
    return mix( d2, -d1, h ) + k*h*(1.0-h);
}

float opSmoothIntersection( float d1, float d2, float k ) {
    float h = clamp( 0.5 - 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) + k*h*(1.0-h);
}

// --- Transformations ---

vec3 opTwist( in vec3 p, float k ) {
    float c = cos(k*p.y);
    float s = sin(k*p.y);
    mat2  m = mat2(c,-s,s,c);
    vec3  q = vec3(m*p.xz,p.y);
    return q;
}

vec3 opRepetition( in vec3 p, in vec3 c ) {
    return mod(p+0.5*c,c)-0.5*c;
}
