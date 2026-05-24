// Hyperspace flythrough — receding dots on black, speed from u_time.
// Color shifts subtly with u_trackProgress for a slow palette drift.
export const STARFIELD_SHADER = /* glsl */ `#version 300 es
  precision mediump float;

  uniform float u_time;
  uniform float u_trackElapsed;
  uniform float u_trackProgress;
  uniform float u_intensity;
  uniform vec2  u_resolution;

  out vec4 fragColor;

  #define STAR_COUNT 120.0
  #define PI 3.14159265359

  float hash(float n) {
    return fract(sin(n) * 43758.5453);
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

    vec3 col = vec3(0.0);
    float speed = mix(0.2, 1.8, u_intensity) + u_trackElapsed * 0.002;

    for (float i = 0.0; i < STAR_COUNT; i++) {
      // Stable random seed per star
      float seed = i * 0.07139 + 1.3;
      float angle = hash(seed) * 2.0 * PI;
      float depth = fract(hash(seed + 7.3) - u_time * speed * (0.3 + hash(seed + 2.1) * 0.7));

      // Project from depth to screen
      float dist = 0.05 / depth;
      vec2 starPos = vec2(cos(angle), sin(angle)) * dist;

      // Streak toward edges
      vec2 streak = starPos - vec2(cos(angle), sin(angle)) * (0.05 / max(depth + 0.01, 0.01)) * 0.15;
      float streakLen = length(uv - starPos) / max(length(starPos - streak), 0.001);

      float r = 0.0008 / (length(uv - starPos) + 0.001);
      float brightness = clamp(r, 0.0, 1.0) * (1.0 - depth);

      // Color tint from track progress
      float tint = hash(seed + 4.1);
      vec3 starCol = mix(
        vec3(0.8, 0.9, 1.0),
        vec3(1.0, 0.6 + tint * 0.2, 0.3 + u_trackProgress * 0.4),
        u_trackProgress * 0.5
      );

      col += starCol * brightness;
    }

    col = clamp(col, 0.0, 1.0);
    float alpha = length(col) > 0.01 ? 1.0 : 0.0;
    fragColor = vec4(col, max(length(col), 0.02));
  }
`
