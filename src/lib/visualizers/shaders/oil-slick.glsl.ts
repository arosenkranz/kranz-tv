// Oil Slick — feedback-FBO preset. Sharp ridged veins (reaction-diffusion feel)
// with thin-film oil-on-water iridescence, advected along a curl-noise flow field
// and smeared with chromatic aberration. The ridged FBM (abs()-folded octaves)
// gives crisp filaments — the opposite of Liquid Ink's soft marble. The shader
// OWNS accumulation (blend disabled in the feedback pass). u_hasPrev = 0 → fresh.
// u_intensity scales: flow strength, chromatic smear, decay, ridge sharpness.
export const OIL_SLICK_SHADER = /* glsl */ `#version 300 es
  precision highp float;

  uniform float u_time;
  uniform float u_trackElapsed;
  uniform float u_trackProgress;
  uniform float u_intensity;
  uniform vec2  u_resolution;
  uniform sampler2D u_prevFrame;
  uniform float u_hasPrev;

  out vec4 fragColor;

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

  const mat2 M = mat2(0.8, 0.6, -0.6, 0.8);
  // Ridged FBM: abs()-fold each octave → sharp veins instead of soft blobs.
  float ridged(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) {
      float n = noise(p);
      n = 1.0 - abs(2.0 * n - 1.0);
      v += a * n; p = M * p * 2.0; a *= 0.5;
    }
    return v;
  }

  vec2 curl(vec2 p) {
    const float e = 0.1;
    float dx = noise(p + vec2(0.0, e)) - noise(p - vec2(0.0, e));
    float dy = noise(p + vec2(e, 0.0)) - noise(p - vec2(e, 0.0));
    return vec2(dx, -dy) / (2.0 * e);
  }

  // Thin-film / oil-on-water iridescence: phase-shift each channel by a constant.
  vec3 oilColor(float t) {
    return 0.5 + 0.5 * cos(TAU * (vec3(1.0) * t + vec3(0.0, 0.18, 0.36)) + vec3(0.0, 2.0, 4.0));
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 texel = 1.0 / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;
    vec2 p = vec2(uv.x * aspect, uv.y);

    float flowStr = mix(2.0, 9.0, u_intensity);
    float caAmt = mix(1.5, 7.0, u_intensity);
    float decay = mix(0.90, 0.97, u_intensity);
    float sharp = mix(8.0, 22.0, u_intensity);

    vec2 flow = curl(p * 3.0 + u_time * 0.12) * 1.0 + curl(p * 7.0 - u_time * 0.18) * 0.5;

    vec3 prev = vec3(0.0);
    if (u_hasPrev > 0.5) {
      vec2 adv = uv - flow * flowStr * texel;
      vec2 ca = flow * caAmt * texel;
      prev = vec3(
        texture(u_prevFrame, adv + ca).r,
        texture(u_prevFrame, adv).g,
        texture(u_prevFrame, adv - ca).b
      ) * decay;
    }

    // Veins: where ridged FBM crests → thin bright filaments.
    float r = ridged(p * 2.6 + flow * 0.4 + u_time * 0.05);
    float vein = pow(smoothstep(0.55, 0.85, r), 3.0);
    vec3 inkColor = oilColor(u_trackProgress + r * 1.5 + u_time * 0.06);
    float inject = mix(0.06, 0.13, u_intensity);
    vec3 injected = inkColor * vein * inject * sharp * 0.1;

    vec3 col = prev + injected;
    col = col / (1.0 + col * 0.2);
    col = clamp(col, 0.0, 1.0);

    fragColor = vec4(col, 1.0);
  }
`
