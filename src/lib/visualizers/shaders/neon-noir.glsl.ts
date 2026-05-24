// 1980s neon noir — dark void with 3 soft neon glow sources on independent
// Lissajous paths. Wet-pavement reflection on the lower half mirrors the glow
// sources vertically with a vertical smear — instant Blade Runner atmosphere.
// u_intensity scales glow radius, drift speed, and reflection brightness.
export const NEON_NOIR_SHADER = /* glsl */ `#version 300 es
  precision mediump float;

  uniform float u_time;
  uniform float u_trackElapsed;
  uniform float u_trackProgress;
  uniform float u_intensity;
  uniform vec2  u_resolution;

  out vec4 fragColor;

  #define PI 3.14159265359

  // Exponential radial glow — characteristic neon bloom
  float neonGlow(vec2 p, vec2 src, float radius) {
    float d = length(p - src);
    return exp(-d * d / (radius * radius));
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;
    vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

    // Glow drift speed and radius scale with intensity
    float speed  = mix(0.04, 0.28, u_intensity);
    float radius = mix(0.18, 0.42, u_intensity);

    // Three neon light sources on independent Lissajous orbits
    vec2 src[3];
    src[0] = vec2(
       0.30 * aspect * sin(u_time * speed * 0.9),
       0.22 * cos(u_time * speed * 0.7  + PI * 0.2)
    );
    src[1] = vec2(
      -0.25 * aspect * cos(u_time * speed * 0.6 + PI),
       0.18 * sin(u_time * speed * 1.1  + PI * 0.7)
    );
    src[2] = vec2(
       0.12 * aspect * sin(u_time * speed * 1.3 + PI * 0.4),
      -0.28 * cos(u_time * speed * 0.5  + PI * 1.1)
    );

    // Neon colour palette: deep magenta / electric blue / cold cyan
    vec3 neonCol[3];
    neonCol[0] = vec3(0.86, 0.00, 0.47);  // deep magenta
    neonCol[1] = vec3(0.00, 0.31, 0.78);  // electric blue
    neonCol[2] = vec3(0.00, 0.54, 0.68);  // cold cyan

    // Accumulate glow from all three sources
    vec3 glow = vec3(0.0);
    for (int i = 0; i < 3; i++) {
      float g = neonGlow(p, src[i], radius);
      glow += neonCol[i] * g * 0.38;
    }

    // Very dark background with a trace of blue-purple to avoid pure black
    vec3 bg = vec3(0.010, 0.000, 0.045);
    vec3 col = bg + glow;

    // Wet-pavement reflection: lower half mirrors the glow sources upward
    // The horizon sits at y=0 in scene coordinates (uv.y = 0.5 in UV space)
    float horizonY = 0.0;
    if (p.y < horizonY) {
      // Reflected coordinate — smear vertically by dividing depth
      float reflDepth = abs(p.y - horizonY) + 0.01;
      vec3 reflGlow = vec3(0.0);
      for (int i = 0; i < 3; i++) {
        // Mirror source above horizon; smear by stretching radius with depth
        vec2 reflSrc = vec2(src[i].x, -src[i].y);
        float reflR = radius * (1.0 + reflDepth * 2.5);
        float g = neonGlow(p, reflSrc, reflR);
        // Reflection fades with depth below horizon
        float fade = exp(-reflDepth * 3.5);
        reflGlow += neonCol[i] * g * fade * 0.22 * mix(0.3, 1.0, u_intensity);
      }
      // Thin bright reflection streak right at the horizon
      float streak = exp(-abs(p.y - horizonY) * 60.0) * 0.12 * u_intensity;
      col += reflGlow + streak;
    }

    // Subtle vignette for cinematic framing
    float vig = 1.0 - 0.45 * dot(p * 1.2, p * 1.2);
    col *= clamp(vig, 0.0, 1.0);

    // Clamp gently to preserve neon character without blowing out
    col = col / (col + 0.4) * 1.4;

    float alpha = 0.94;
    fragColor = vec4(clamp(col, 0.0, 1.0) * alpha, alpha);
  }
`
