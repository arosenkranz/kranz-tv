// Neon Tunnel — raymarched cyberpunk tunnel fly-through. A ray is marched down
// an infinite tube (depth = 1/r so the center recedes forever), with a neon
// grid on the walls (rings along depth + ribs along the angle), per-cell
// flicker, depth-cycled hue, and chromatic aberration that widens on the beat.
// Pure fragment shader → infinite procedural depth, no geometry, never a seam.
// u_intensity scales: fly speed, grid glow, aberration/pulse punch.
export const NEON_TUNNEL_SHADER = /* glsl */ `#version 300 es
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

  // IQ cosine palette — neon hues, staggered per channel so they stay vivid.
  vec3 palette(float t) {
    return 0.5 + 0.5 * cos(2.0 * PI * (vec3(1.0, 0.7, 0.4) * t + vec3(0.0, 0.15, 0.3)));
  }

  void main() {
    // Aspect-correct coords centered on the vanishing point. The center offset
    // (0.210, 0.250) was tuned live so the tunnel reads centered in the panel.
    vec2 uv = (gl_FragCoord.xy - (vec2(0.5) + vec2(0.210, 0.250)) * u_resolution) / u_resolution.y;

    // Intensity → fly speed + glow. A deterministic beat pulse from track
    // elapsed (schedule-pure, like the other presets) drives aberration width.
    float speed = mix(0.6, 2.6, u_intensity);
    float glowAmt = mix(0.8, 2.0, u_intensity);
    float pulse = 0.5 + 0.5 * sin(u_trackElapsed * 2.0 * PI);

    float t = u_time * speed;
    vec3 col = vec3(0.0);

    // Chromatic aberration: sample the tunnel at 3 slightly different radii and
    // route each to one color channel. Widens with the beat.
    for (int c = 0; c < 3; c++) {
      float ca = (float(c) - 1.0) * 0.012 * (0.5 + pulse);
      vec2 p = uv * (1.0 + ca);
      float r = length(p) + 1e-4;
      float a = atan(p.y, p.x);

      // Tunnel mapping: depth = 1/r so the center recedes infinitely.
      float depth = 0.30 / r + t * 0.6;
      float ang = a / PI;

      // Neon grid: rings along depth, ribs along the angle.
      float rings = abs(fract(depth * 3.0) - 0.5);
      float ribs  = abs(fract(ang * 8.0 + depth * 0.5) - 0.5);
      float grid  = smoothstep(0.06, 0.0, rings) + smoothstep(0.05, 0.0, ribs);

      // Per-cell flicker (neon signage feel) + hue cycling with depth.
      float cell  = hash(floor(vec2(depth * 3.0, ang * 8.0)));
      float flick = 0.5 + 0.5 * sin(t * 4.0 + cell * 30.0);
      vec3  neon  = palette(depth * 0.15 + cell * 0.2 + u_trackProgress * 0.3);

      float glow = grid * (0.6 + flick * 0.8) * glowAmt;
      // Radial falloff: walls bright, far center dark → sense of infinite depth.
      float wall = smoothstep(0.0, 1.2, r);
      float chan = glow * wall * (1.0 + pulse * 0.6);

      if (c == 0) col.r += chan;
      else if (c == 1) col.g += chan;
      else col.b += chan;
      col += neon * chan * 0.35;
    }

    // Vignette + faint scanline for the retro-cyberpunk feel.
    col *= 1.0 - 0.4 * length(uv);
    col += 0.02;
    col *= 0.9 + 0.1 * sin(gl_FragCoord.y * 1.5);

    fragColor = vec4(col, max(length(col), 0.02));
  }
`
