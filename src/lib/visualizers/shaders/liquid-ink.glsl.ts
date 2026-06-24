// Liquid Ink — domain-warped FBM marble bleed. Colors fold and bleed like ink
// in water / a 60s liquid light show. Slow and hypnotic, but with VIVID,
// well-separated hues (the warp intermediates drive distinct color boundaries).
// u_intensity scales: warp depth, flow speed, hue saturation.
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

  // Rotate each octave (IQ trick) so they don't align into grid artifacts.
  const mat2 M = mat2(0.80, 0.60, -0.60, 0.80);
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = M * p * 2.02;
      a *= 0.5;
    }
    return v;
  }

  // IQ cosine palette. d staggered per-channel → peaks 120deg apart → vivid,
  // never collapses to gray (the lockstep bug this replaces).
  vec3 palette(float t, vec3 d) {
    return 0.5 + 0.5 * cos(2.0 * PI * (vec3(1.0) * t + d));
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    uv.x *= u_resolution.x / u_resolution.y;

    float flow = mix(0.02, 0.12, u_intensity) * u_time + u_trackElapsed * 0.005;
    float warpAmt = mix(2.0, 4.5, u_intensity);

    // Two-level domain warp — q warps p, r warps q (the "marble fold"). The
    // intermediates q and r are the FAST-changing fields that become color
    // boundaries below.
    vec2 q = vec2(
      fbm(uv + vec2(0.0, flow)),
      fbm(uv + vec2(5.2, 1.3 - flow))
    );
    vec2 r = vec2(
      fbm(uv + warpAmt * q + vec2(1.7, 9.2) + 0.15 * flow),
      fbm(uv + warpAmt * q + vec2(8.3, 2.8) - 0.12 * flow)
    );
    float f = fbm(uv + warpAmt * r);

    float pp = u_trackProgress * 0.5;
    // Base hue from the final warp, then layer two more hues keyed off the
    // intermediates so folds read as STRONG, distinct color transitions.
    vec3 col = palette(f + pp, vec3(0.0, 0.33, 0.67));
    col = mix(
      col,
      palette(dot(q, q) + pp, vec3(0.15, 0.45, 0.75)),
      clamp(dot(q, q) * 2.0, 0.0, 1.0)
    );
    col = mix(
      col,
      palette(r.y + pp, vec3(0.6, 0.2, 0.1)),
      clamp(r.y * r.y * 4.0, 0.0, 1.0)
    );

    // Deepen folds + boost saturation/contrast. col*col darkens mids without
    // clipping highlights; sat scales with intensity.
    float sat = mix(1.0, 1.6, u_intensity);
    float mean = (col.r + col.g + col.b) / 3.0;
    col = clamp(mean + (col - mean) * sat, 0.0, 1.0);
    col *= mix(0.6, 1.0, f);
    col = mix(col, col * col, 0.5);

    fragColor = vec4(col, max(length(col), 0.02));
  }
`
