// Liquid Ink — domain-warped FBM marble bleed. Colors fold and bleed like ink
// in water / a 60s liquid light show. Slow and hypnotic.
// u_intensity scales: warp depth (fold octaves weight), flow speed, saturation.
export const LIQUID_INK_SHADER = /* glsl */ `#version 300 es
  precision highp float;

  uniform float u_time;
  uniform float u_trackElapsed;
  uniform float u_trackProgress;
  uniform float u_intensity;
  uniform vec2  u_resolution;

  out vec4 fragColor;

  #define PI 3.14159265359

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }

  vec3 palette(float t) {
    return 0.5 + 0.5 * cos(2.0 * PI * (vec3(0.9, 1.0, 1.1) * t + vec3(0.1, 0.35, 0.6)));
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    uv.x *= u_resolution.x / u_resolution.y;

    float flow = mix(0.02, 0.12, u_intensity) * u_time + u_trackElapsed * 0.005;
    float warpAmt = mix(0.4, 1.4, u_intensity);

    // Two-level domain warp — q warps p, r warps q (the "marble fold").
    vec2 q = vec2(fbm(uv + vec2(0.0, flow)), fbm(uv + vec2(5.2, 1.3 - flow)));
    vec2 r = vec2(
      fbm(uv + warpAmt * q + vec2(1.7, 9.2) + 0.15 * flow),
      fbm(uv + warpAmt * q + vec2(8.3, 2.8) - 0.12 * flow)
    );
    float f = fbm(uv + warpAmt * r);

    float sat = mix(0.6, 1.25, u_intensity);
    vec3 col = palette(f + u_trackProgress * 0.5 + length(r) * 0.4);
    // Pull toward saturation by pushing away from the channel mean.
    float mean = (col.r + col.g + col.b) / 3.0;
    col = clamp(mean + (col - mean) * sat, 0.0, 1.0);
    // Deepen the folds.
    col *= mix(0.55, 1.0, f);

    fragColor = vec4(col, max(length(col), 0.02));
  }
`
