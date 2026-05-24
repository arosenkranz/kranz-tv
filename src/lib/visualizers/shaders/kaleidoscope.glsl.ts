// 6-fold mirrored fractal driven purely by u_time and u_trackElapsed.
export const KALEIDOSCOPE_SHADER = /* glsl */ `#version 300 es
  precision mediump float;

  uniform float u_time;
  uniform float u_trackElapsed;
  uniform float u_trackProgress;
  uniform float u_intensity;
  uniform vec2  u_resolution;

  out vec4 fragColor;

  #define PI 3.14159265359
  #define FOLDS 6.0

  vec3 palette(float t) {
    vec3 a = vec3(0.5);
    vec3 b = vec3(0.5);
    vec3 c = vec3(1.0, 1.0, 0.5);
    vec3 d = vec3(0.0, 0.33, 0.67);
    return a + b * cos(2.0 * PI * (c * t + d));
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);

    float angle = atan(uv.y, uv.x);
    float radius = length(uv);

    // 6-fold symmetry
    float sector = (2.0 * PI) / FOLDS;
    angle = mod(angle, sector);
    angle = abs(angle - sector * 0.5);

    // Fractal zoom pulsed by track elapsed; intensity widens the pulse
    float zoomAmp = mix(0.1, 0.5, u_intensity);
    float zoom = 1.2 + zoomAmp * sin(u_trackElapsed * mix(0.05, 0.2, u_intensity));
    vec2 p = vec2(cos(angle), sin(angle)) * radius * zoom;

    // Rotation speed scales with intensity
    float rotSpeed = mix(0.08, 0.55, u_intensity);
    float t = u_time * rotSpeed + u_trackProgress;
    float v = sin(p.x * 6.0 + t) * sin(p.y * 6.0 + t * 1.3)
            + sin(length(p) * 8.0 - t * 2.0) * 0.5;

    vec3 col = palette(v * 0.5 + 0.5 + u_trackProgress * 0.2);
    float alpha = 0.88;

    fragColor = vec4(col * alpha, alpha);
  }
`
