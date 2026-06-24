// Blacklight — feedback-FBO preset. Mostly black; thin intensely-saturated neon
// filaments that bloom and drip downward like UV-reactive paint. The previous
// frame is advected downward + noise-warped (drip), blurred slightly for bloom
// spread, and decayed slowly so neon trails linger. The shader OWNS accumulation
// (blend disabled in the feedback pass). u_hasPrev = 0 → fresh.
// u_intensity scales: drip strength, chromatic smear, bloom spread, decay, brightness.
export const BLACKLIGHT_SHADER = /* glsl */ `#version 300 es
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
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
    return v;
  }

  // Neon palette: electric magenta / cyan / lime — fully saturated.
  vec3 neon(float t) {
    return 0.5 + 0.5 * cos(TAU * (vec3(1.0) * t + vec3(0.0, 0.4, 0.7)));
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 texel = 1.0 / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;
    vec2 p = vec2(uv.x * aspect, uv.y);

    float dripAmt = mix(0.8, 3.0, u_intensity);
    float wob = mix(0.4, 1.4, u_intensity);
    float caAmt = mix(2.0, 8.0, u_intensity);
    float decay = mix(0.94, 0.99, u_intensity);
    float bloom = mix(0.985, 0.94, u_intensity); // smaller = wider glow spread

    vec3 prev = vec3(0.0);
    if (u_hasPrev > 0.5) {
      vec2 warp = vec2(
        (fbm(uv * 4.0 + vec2(0.0, u_time * 0.3)) - 0.5) * wob,
        dripAmt + (fbm(uv * 6.0 - u_time * 0.2) - 0.5) * wob
      );
      vec2 adv = uv - warp * texel;
      vec2 ca = normalize(warp + 1e-4) * caAmt * texel;
      vec3 c0 = vec3(
        texture(u_prevFrame, adv + ca).r,
        texture(u_prevFrame, adv).g,
        texture(u_prevFrame, adv - ca).b
      );
      // Horizontal 2-tap blur for bloom spread as it trails.
      vec3 c1 = texture(u_prevFrame, adv + vec2(texel.x, 0.0) * 2.0).rgb;
      vec3 c2 = texture(u_prevFrame, adv - vec2(texel.x, 0.0) * 2.0).rgb;
      prev = mix(c0, (c1 + c2) * 0.5, 1.0 - bloom) * decay;
    }

    // Thin neon filaments: narrow band of a domain-warped fbm.
    vec2 wp = p * 3.0 + u_time * 0.04;
    float n = fbm(wp + vec2(fbm(wp), fbm(wp + 5.0)));
    float fil = pow(smoothstep(0.48, 0.52, n) * smoothstep(0.62, 0.58, n), 0.5);
    vec3 col2 = neon(u_trackProgress + n * 2.0 + u_time * 0.05);
    float inject = mix(0.5, 1.1, u_intensity);
    vec3 injected = col2 * fil * inject;

    vec3 col = prev + injected;
    col = col / (1.0 + col * 0.10);
    col = clamp(col, 0.0, 1.0);

    fragColor = vec4(col, 1.0);
  }
`
