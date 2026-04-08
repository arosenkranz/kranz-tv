/**
 * Shared GLSL utility functions prepended to all overlay shaders.
 * Each shader file imports this and concatenates it before its own main().
 */
export const COMMON_GLSL = /* glsl */ `
  precision highp float;

  uniform float u_time;
  uniform vec2 u_resolution;

  // Fast pseudo-random from a 2D seed. Returns [0, 1).
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  // Value noise: smooth interpolation of hash values on a grid.
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f); // smoothstep
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  // Radial vignette: returns 1.0 at center, 0.0 at corners.
  // Aspect-ratio corrected so it's always circular on screen, not oval.
  float vignette(vec2 uv, float strength) {
    vec2 d = (uv - 0.5) * 2.0;
    // Correct for aspect ratio — scale X so distance is circular in screen space
    float aspect = u_resolution.x / u_resolution.y;
    d.x *= min(aspect, 1.0);
    d.y *= min(1.0 / aspect, 1.0);
    float r = dot(d, d);
    return pow(clamp(1.0 - r * 0.5, 0.0, 1.0), strength);
  }
`
