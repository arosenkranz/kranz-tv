// Rotating wireframe geometry — flower-of-life / hexagonal pattern.
// Gold-on-black palette, slow rotation from u_time.
export const SACRED_GEOMETRY_SHADER = /* glsl */ `#version 300 es
  precision mediump float;

  uniform float u_time;
  uniform float u_trackElapsed;
  uniform float u_trackProgress;
  uniform float u_intensity;
  uniform vec2  u_resolution;

  out vec4 fragColor;

  #define PI 3.14159265359
  #define TAU 6.28318530718

  float circle(vec2 uv, vec2 center, float radius, float width) {
    float d = length(uv - center) - radius;
    return smoothstep(width, 0.0, abs(d));
  }

  mat2 rotate2d(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat2(c, -s, s, c);
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);

    float rotSpeed = u_time * mix(0.03, 0.25, u_intensity) + u_trackElapsed * 0.003;
    uv = rotate2d(rotSpeed) * uv;

    float col = 0.0;
    float lineW = 0.008;

    // Center circle
    col += circle(uv, vec2(0.0), 0.25, lineW);

    // 6 surrounding circles (flower of life)
    for (float i = 0.0; i < 6.0; i++) {
      float angle = i * TAU / 6.0;
      vec2 center = vec2(cos(angle), sin(angle)) * 0.25;
      col += circle(uv, center, 0.25, lineW);
    }

    // Outer containing circle
    col += circle(uv, vec2(0.0), 0.5, lineW);

    // Inner hexagon star — two overlapping triangles
    for (float i = 0.0; i < 3.0; i++) {
      float a1 = i * TAU / 3.0;
      float a2 = a1 + PI;
      vec2 p1 = vec2(cos(a1), sin(a1)) * 0.45;
      vec2 p2 = vec2(cos(a1 + TAU / 3.0), sin(a1 + TAU / 3.0)) * 0.45;
      vec2 p3 = vec2(cos(a2), sin(a2)) * 0.45;
      // Draw each edge as a thin line
      vec2 dir = normalize(p2 - p1);
      float t1 = dot(uv - p1, dir);
      t1 = clamp(t1, 0.0, length(p2 - p1));
      float d1 = length(uv - p1 - dir * t1);
      col += smoothstep(lineW, 0.0, d1);

      dir = normalize(p3 - p2);
      float t2 = dot(uv - p2, dir);
      t2 = clamp(t2, 0.0, length(p3 - p2));
      float d2 = length(uv - p2 - dir * t2);
      col += smoothstep(lineW, 0.0, d2);

      dir = normalize(p1 - p3);
      float t3 = dot(uv - p3, dir);
      t3 = clamp(t3, 0.0, length(p1 - p3));
      float d3 = length(uv - p3 - dir * t3);
      col += smoothstep(lineW, 0.0, d3);
    }

    col = clamp(col, 0.0, 1.0);

    // Gold-on-black palette, with a subtle pulse from track progress
    float pulseAmp = mix(0.05, 0.3, u_intensity);
    float pulse = (1.0 - pulseAmp) + pulseAmp * sin(u_trackElapsed * mix(0.2, 1.0, u_intensity));
    vec3 gold = vec3(1.0, 0.78, 0.1) * pulse;
    vec3 finalCol = gold * col;
    float alpha = col > 0.01 ? col * 0.9 : 0.0;

    fragColor = vec4(finalCol, alpha);
  }
`
