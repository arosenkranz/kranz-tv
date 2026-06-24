// Warp Drive (preset id stays "starfield" for persistence). Relativistic star
// streaks rushing past with chromatic aberration at the edges.
// u_intensity scales: streak speed, star density, chromatic-aberration split.
export const STARFIELD_SHADER = /* glsl */ `#version 300 es
  precision mediump float;

  uniform float u_time;
  uniform float u_trackElapsed;
  uniform float u_trackProgress;
  uniform float u_intensity;
  uniform vec2  u_resolution;

  out vec4 fragColor;

  #define PI 3.14159265359

  float hash(float n) { return fract(sin(n) * 43758.5453); }

  // One warp star → brightness, given a chromatic radial offset.
  float starField(vec2 uv, float speed, float density, float chroma) {
    float count = mix(70.0, 160.0, density);
    float b = 0.0;
    for (float i = 0.0; i < 160.0; i++) {
      if (i >= count) break;
      float seed = i * 0.0731 + 1.7;
      float angle = hash(seed) * 2.0 * PI;
      float depth = fract(hash(seed + 3.1) - u_time * speed * (0.4 + hash(seed + 1.3) * 0.8));
      float dist = (0.04 / max(depth, 0.001)) * (1.0 + chroma);
      vec2 dir = vec2(cos(angle), sin(angle));
      vec2 head = dir * dist;
      // Streak length grows as the star nears (low depth).
      vec2 tail = dir * dist * (1.0 - mix(0.05, 0.45, u_intensity));
      // Distance from uv to the streak segment head..tail.
      vec2 pa = uv - tail;
      vec2 ba = head - tail;
      float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0);
      float d = length(pa - ba * h);
      b += (0.0015 / (d + 0.0015)) * (1.0 - depth);
    }
    return b;
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;

    float speed = mix(0.6, 2.4, u_intensity) + u_trackElapsed * 0.003;
    float density = u_intensity;
    // Chromatic aberration grows toward the edges and with intensity.
    float edge = length(uv);
    float ca = edge * mix(0.01, 0.06, u_intensity);

    float r = starField(uv, speed, density, ca);
    float g = starField(uv, speed, density, 0.0);
    float bch = starField(uv, speed, density, -ca);

    vec3 tint = mix(vec3(0.7, 0.85, 1.0), vec3(1.0, 0.7, 0.9), u_trackProgress);
    vec3 col = vec3(r, g, bch) * tint;
    col = clamp(col, 0.0, 1.0);

    fragColor = vec4(col, max(length(col), 0.02));
  }
`
