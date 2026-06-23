// STUB — Task D1 replaces the body. Minimal valid GLSL ES 3.00 fragment shader
// so Task C compiles independently.
export const FRACTAL_VOYAGE_SHADER = /* glsl */ `#version 300 es
  precision highp float;
  uniform float u_time;
  uniform float u_trackElapsed;
  uniform float u_trackProgress;
  uniform float u_intensity;
  uniform vec2 u_resolution;
  out vec4 fragColor;
  void main() {
    fragColor = vec4(0.0, 0.0, 0.0, 0.02);
  }
`
