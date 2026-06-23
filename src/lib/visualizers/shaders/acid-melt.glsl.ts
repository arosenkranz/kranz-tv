// Acid Melt — feedback-FBO preset. Samples the previous frame zoomed + rotated
// with a per-channel chromatic drift (wet/oily smear), applies feedback gain,
// and composites fresh ink on top. The shader OWNS accumulation (blend is
// disabled in the feedback pass). u_hasPrev = 0 on the first frame / when FBOs
// are unavailable → renders fresh with no trail.
// u_intensity scales: feedback gain (trail persistence), zoom/rotation speed,
// chromatic-drift offset magnitude.
export const ACID_MELT_SHADER = /* glsl */ `#version 300 es
  precision highp float;

  uniform float u_time;
  uniform float u_trackElapsed;
  uniform float u_trackProgress;
  uniform float u_intensity;
  uniform vec2  u_resolution;
  uniform sampler2D u_prevFrame;
  uniform float u_hasPrev;

  out vec4 fragColor;

  #define PI 3.14159265359

  vec3 palette(float t) {
    return 0.5 + 0.5 * cos(2.0 * PI * (vec3(1.0, 0.8, 0.6) * t + vec3(0.0, 0.25, 0.5)));
  }

  // Sample the previous frame at a transformed UV (centered zoom + rotate).
  vec2 warp(vec2 uv, float zoom, float ang) {
    vec2 c = uv - 0.5;
    c *= zoom;
    c = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * c;
    return c + 0.5;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;

    float zoom = 1.0 - mix(0.004, 0.02, u_intensity);
    float ang = mix(0.002, 0.02, u_intensity) * sin(u_time * 0.3 + 1.0);
    float drift = mix(0.001, 0.006, u_intensity);
    float gain = mix(0.85, 0.97, u_intensity); // trail persistence

    // Chromatic drift — sample each channel at a slightly different warp.
    vec3 prev = vec3(0.0);
    if (u_hasPrev > 0.5) {
      vec2 ur = warp(uv, zoom, ang + drift);
      vec2 ug = warp(uv, zoom, ang);
      vec2 ub = warp(uv, zoom, ang - drift);
      prev = vec3(
        texture(u_prevFrame, ur).r,
        texture(u_prevFrame, ug).g,
        texture(u_prevFrame, ub).b
      ) * gain;
    }

    // Fresh ink: a slow moving blob of palette color.
    vec2 p = uv - 0.5;
    p.x *= u_resolution.x / u_resolution.y;
    float t = u_time * mix(0.1, 0.4, u_intensity);
    vec2 c1 = 0.28 * vec2(sin(t * 1.1), cos(t * 0.9));
    vec2 c2 = 0.24 * vec2(cos(t * 0.7 + 1.0), sin(t * 1.3 + 2.0));
    float blob = 0.02 / (length(p - c1) + 0.04) + 0.018 / (length(p - c2) + 0.04);
    vec3 ink = palette(u_trackProgress + t * 0.1 + length(p)) * clamp(blob, 0.0, 1.0);

    // Composite: trail (prev) plus new ink, leaning additive for glow.
    vec3 col = max(prev, prev * 0.6 + ink);
    col = clamp(col, 0.0, 1.0);

    fragColor = vec4(col, 1.0);
  }
`
