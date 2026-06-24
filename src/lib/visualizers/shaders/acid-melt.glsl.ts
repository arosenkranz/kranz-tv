// Acid Melt — feedback-FBO preset with a MELTING KALEIDOSCOPE identity (distinct
// from Liquid Ink's soft marble). The previous frame is sampled through a radial
// kaleidoscope fold (N mirrored sectors) plus an inward zoom+spin, so structures
// mirror around the center and spiral inward — they "melt" toward the middle like
// a Milkdrop/oil-wheel mandala. A small curl-noise jitter keeps the melt organic
// (not a rigid mechanical spin). Fresh content is a thin radial filament, NOT a
// marble field, so it never reads like Liquid Ink. The shader OWNS accumulation
// (blend disabled in the feedback pass). u_hasPrev = 0 → fresh, no trail.
//
// INTENSITY is a REGIME change, not a magnitude nudge: it scales the symmetry
// order (sectors), spin/zoom rate, chromatic tearing, and hue-cycle speed —
// chill = 4-fold slow lazy mandala, max = 12-fold fast counter-spinning melt.
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
  #define TAU 6.28318530718

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

  // Curl of a noise field = divergence-free jitter that keeps the melt organic.
  vec2 curl(vec2 p) {
    const float e = 0.1;
    float dx = noise(p + vec2(0.0, e)) - noise(p - vec2(0.0, e));
    float dy = noise(p + vec2(e, 0.0)) - noise(p - vec2(e, 0.0));
    return vec2(dx, -dy) / (2.0 * e);
  }

  vec3 palette(float t) {
    return 0.5 + 0.5 * cos(TAU * (vec3(1.0) * t + vec3(0.0, 0.33, 0.67)));
  }

  // Fold a centered coordinate into N mirrored wedges (kaleidoscope).
  // Operates in polar space: quantize+mirror the angle, keep the radius.
  vec2 kaleido(vec2 c, float sectors, float spin) {
    float r = length(c);
    float a = atan(c.y, c.x) + spin;
    float seg = TAU / sectors;
    a = mod(a, seg);
    a = abs(a - seg * 0.5);   // mirror within the wedge → seamless reflection
    return vec2(cos(a), sin(a)) * r;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 texel = 1.0 / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;

    // Centered, aspect-correct coordinate for all radial math.
    vec2 c = (uv - 0.5) * vec2(aspect, 1.0);

    // ── INTENSITY AS REGIME ────────────────────────────────────────────────
    // Symmetry order steps with intensity (4 → 12). Quantizing to whole sectors
    // makes the change a crisp, instantly-readable jump, not a smear.
    float sectors = floor(mix(4.0, 12.0, u_intensity) + 0.5);
    float spinRate = mix(0.06, 0.45, u_intensity);   // mandala rotation speed
    float zoomMelt = mix(0.004, 0.030, u_intensity); // inward pull per frame
    float caAmt = mix(1.0, 6.0, u_intensity);        // chromatic tearing (px)
    float decay = mix(0.90, 0.975, u_intensity);     // trail persistence
    float hueRate = mix(0.04, 0.20, u_intensity);    // palette cycle speed

    // ── FEEDBACK SAMPLE: kaleidoscope fold + inward zoom + organic jitter ───
    vec3 prev = vec3(0.0);
    if (u_hasPrev > 0.5) {
      // Fold the sampling coordinate, spin it, pull it inward (the "melt").
      vec2 folded = kaleido(c, sectors, u_time * spinRate);
      folded *= (1.0 - zoomMelt);  // zoom toward center → structures spiral in
      // A little curl jitter so the mandala breathes instead of spinning rigidly.
      folded += curl(folded * 4.0 + u_time * 0.2) * 0.012;
      vec2 sampUv = folded / vec2(aspect, 1.0) + 0.5;

      // Chromatic tear along the radial direction (oil-wheel sheen).
      vec2 radial = (length(c) > 1e-4) ? normalize(c) : vec2(0.0);
      vec2 ca = radial * caAmt * texel;
      prev = vec3(
        texture(u_prevFrame, sampUv + ca).r,
        texture(u_prevFrame, sampUv).g,
        texture(u_prevFrame, sampUv - ca).b
      ) * decay;
    }

    // ── FRESH INK: a thin radial filament (NOT a marble field) ──────────────
    // A rotating bright spoke + a breathing ring. Folded by the same kaleidoscope
    // so injected light enters the mandala already mirrored. Sharp, high-contrast.
    vec2 fc = kaleido(c, sectors, u_time * spinRate);
    float ang = atan(fc.y, fc.x);
    float rad = length(fc);
    // Spoke: bright where the (jittered) angle is near zero, thin falloff.
    float spokeJit = noise(vec2(rad * 6.0, u_time * 0.6)) * 0.4;
    float spoke = smoothstep(0.12, 0.0, abs(ang) + spokeJit - 0.06);
    // Ring: a breathing annulus that the inward zoom drags toward center.
    float ringR = 0.22 + 0.08 * sin(u_time * 0.5);
    float ring = smoothstep(0.04, 0.0, abs(rad - ringR));
    float ink = clamp(spoke * 0.8 + ring * 0.6, 0.0, 1.0);
    vec3 inkColor = palette(u_trackProgress + rad * 1.5 + u_time * hueRate);
    float inject = mix(0.10, 0.22, u_intensity);
    vec3 injected = inkColor * ink * inject;

    // Accumulate. Soft-knee tonemap inside the loop prevents clip-to-white while
    // keeping long trails (equilibrium: injected ~ (1-decay)*content).
    vec3 col = prev + injected;
    col = col / (1.0 + col * 0.18);
    col = clamp(col, 0.0, 1.0);

    fragColor = vec4(col, 1.0);
  }
`
