// Lava Drip — feedback-FBO preset. Gooey lava-lamp metaballs (smooth-min SDF)
// that merge, stretch and drip. The previous frame is advected DOWNWARD + warped
// by noise (the "melt"/drip) with heavy oily chromatic smear, so blobs leave
// dripping, oil-on-water trails. Distinct substance from Liquid Ink (marble) and
// Mandala (radial). The shader OWNS accumulation (blend disabled in the feedback
// pass). u_hasPrev = 0 → fresh.
// u_intensity scales: blob count/speed, drip strength, chromatic smear, decay.
export const LAVA_DRIP_SHADER = /* glsl */ `#version 300 es
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
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  vec3 palette(float t) {
    // Acid green → cyan → magenta → violet.
    return 0.5 + 0.5 * cos(TAU * (vec3(1.0, 0.9, 0.7) * t + vec3(0.25, 0.45, 0.8)));
  }

  // Polynomial smooth-min — the "merge" that makes metaballs gooey.
  float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 texel = 1.0 / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

    float dripAmt = mix(0.6, 2.4, u_intensity);      // downward melt (px/frame)
    float wobble = mix(0.3, 1.1, u_intensity);       // noise warp of the drip
    float caAmt = mix(1.5, 6.0, u_intensity);        // oily chromatic smear (px)
    float decay = mix(0.93, 0.985, u_intensity);     // trail persistence
    float blobSpeed = mix(0.15, 0.55, u_intensity);
    float nBlobs = floor(mix(4.0, 7.0, u_intensity) + 0.5);

    // ── FEEDBACK: advect previous frame downward + noise-warp = dripping melt ──
    vec3 prev = vec3(0.0);
    if (u_hasPrev > 0.5) {
      // Drip: pull the image DOWN, plus a horizontal noise wobble so drips snake.
      float t = u_time;
      vec2 warp = vec2(
        (noise(uv * 5.0 + vec2(0.0, t * 0.3)) - 0.5) * wobble,
        dripAmt + (noise(uv * 7.0 - t * 0.2) - 0.5) * wobble
      );
      vec2 adv = uv - warp * texel;
      // Chromatic smear along the drip direction (oil-on-water).
      vec2 ca = normalize(warp + 1e-4) * caAmt * texel;
      prev = vec3(
        texture(u_prevFrame, adv + ca).r,
        texture(u_prevFrame, adv).g,
        texture(u_prevFrame, adv - ca).b
      ) * decay;
    }

    // ── INJECT: metaball field (smooth-min SDF of N orbiting blobs) ──────────
    float field = 0.0;
    float d = 1e9;
    for (int i = 0; i < 7; i++) {
      if (float(i) >= nBlobs) break;
      float fi = float(i);
      float a = fi * 2.3994 + u_time * blobSpeed * (0.6 + 0.2 * fi);
      // Blobs rise and bob (lava-lamp), wrapping vertically.
      vec2 bc = vec2(
        0.62 * aspect * sin(a * 0.7 + fi),
        0.55 * sin(u_time * (0.18 + 0.05 * fi) + fi * 1.7)
      );
      float r = mix(0.10, 0.20, hash(vec2(fi, 3.0)));
      float di = length(p - bc) - r;
      d = smin(d, di, 0.22);  // gooey merge
    }
    // Soft inside-of-blob mask; thin bright rim where blobs meet (the "acid" edge).
    float inside = smoothstep(0.04, -0.04, d);
    float rim = smoothstep(0.06, 0.0, abs(d)) * 0.7;
    float blob = clamp(inside + rim, 0.0, 1.0);
    vec3 col2 = palette(u_trackProgress + d * 1.2 + u_time * 0.08);
    float inject = mix(0.12, 0.22, u_intensity);
    vec3 injected = col2 * blob * inject;

    vec3 col = prev + injected;
    col = col / (1.0 + col * 0.16);
    col = clamp(col, 0.0, 1.0);

    fragColor = vec4(col, 1.0);
  }
`
