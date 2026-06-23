// Acid Melt — feedback-FBO preset. The previous frame is ADVECTED along a
// time-evolving curl-noise flow field (per-pixel, divergence-free → ribbons that
// flow and melt, not a rigid zoom/rotate). Fresh content is a weak domain-warped
// FBM field injected each frame; the feedback loop stretches it into organic
// acid trails. Chromatic drift is split along the flow so aberration melts too.
// The shader OWNS accumulation (blend disabled in the feedback pass).
// u_hasPrev = 0 on the first frame / when FBOs are unavailable → fresh, no trail.
// u_intensity scales: flow strength, decay (trail length), inject amount, drift.
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

  const mat2 M = mat2(0.80, 0.60, -0.60, 0.80);
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = M * p * 2.0;
      a *= 0.5;
    }
    return v;
  }

  // Curl of a noise field = perpendicular gradient. Divergence-free → the flow
  // circulates (melts) instead of pooling. The 90deg rotation is the whole trick.
  vec2 curl(vec2 p) {
    const float e = 0.1;
    float dx = noise(p + vec2(0.0, e)) - noise(p - vec2(0.0, e));
    float dy = noise(p + vec2(e, 0.0)) - noise(p - vec2(e, 0.0));
    return vec2(dx, -dy) / (2.0 * e);
  }

  vec3 palette(float t) {
    return 0.5 + 0.5 * cos(2.0 * PI * (vec3(1.0) * t + vec3(0.0, 0.33, 0.67)));
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 texel = 1.0 / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;

    // Two octaves of curl flow at different scales, both evolving in time so the
    // field itself morphs (a static field would just smear in fixed channels).
    vec2 fp = vec2(uv.x * aspect, uv.y);
    vec2 flow =
      curl(fp * 3.0 + u_time * 0.10) * 1.0 +
      curl(fp * 7.0 - u_time * 0.16) * 0.45;

    float flowStrength = mix(2.0, 8.0, u_intensity);
    float decay = mix(0.94, 0.985, u_intensity);    // trail persistence
    float inject = mix(0.05, 0.10, u_intensity);    // weak — feedback does the work
    float caAmt = mix(1.0, 4.0, u_intensity);       // chromatic split (px)

    // Advect: sample the previous frame UPSTREAM of the flow. Per-channel offset
    // along the flow direction = chromatic smear that melts with the motion.
    vec3 prev = vec3(0.0);
    if (u_hasPrev > 0.5) {
      vec2 adv = uv - flow * flowStrength * texel;
      vec2 ca = flow * caAmt * texel;
      prev = vec3(
        texture(u_prevFrame, adv + ca).r,
        texture(u_prevFrame, adv).g,
        texture(u_prevFrame, adv - ca).b
      ) * decay;
    }

    // Inject a spatially-extended, domain-warped FBM field (organic, NOT radial
    // blobs). Advection stretches it into acid ribbons over successive frames.
    vec2 wp = fp * 2.2 + flow * 0.5 + u_time * 0.06;
    vec2 q = vec2(fbm(wp), fbm(wp + vec2(5.2, 1.3)));
    float pat = fbm(wp + 3.0 * q);
    float ink = smoothstep(0.45, 0.62, pat);
    vec3 inkColor = palette(u_trackProgress + pat + u_time * 0.05);
    vec3 injected = inkColor * ink * inject;

    // Accumulate. Soft knee tonemap INSIDE the loop prevents clip-to-white while
    // keeping long trails (equilibrium: injected ~ (1-decay)*content).
    vec3 col = prev + injected;
    col = col / (1.0 + col * 0.18);
    col = clamp(col, 0.0, 1.0);

    fragColor = vec4(col, 1.0);
  }
`
