// Curl-noise lava-lamp blobs with slow color-cycle. No audio FFT.
export const PLASMA_SHADER = /* glsl */ `#version 300 es
  precision mediump float;

  uniform float u_time;
  uniform float u_trackElapsed;
  uniform float u_trackProgress;
  uniform vec2  u_resolution;

  out vec4 fragColor;

  #define PI 3.14159265359

  float plasma(vec2 p, float t) {
    float v = sin(p.x * 3.0 + t);
    v += sin(p.y * 2.5 + t * 0.7);
    v += sin((p.x + p.y) * 2.0 + t * 1.3);
    float cx = p.x + 0.5 * sin(t * 0.3);
    float cy = p.y + 0.5 * cos(t * 0.4);
    v += sin(sqrt(cx * cx + cy * cy) * 4.0 + t);
    return v;
  }

  vec3 plasmaColor(float v, float progress) {
    float hue = v * 0.5 + 0.5 + progress * 0.3;
    // HSL-like: rich purples → reds → oranges
    float r = sin(PI * hue * 2.0) * 0.5 + 0.5;
    float g = sin(PI * hue * 2.0 + 2.094) * 0.3 + 0.2;
    float b = sin(PI * hue * 2.0 + 4.189) * 0.5 + 0.5;
    return clamp(vec3(r, g, b), 0.0, 1.0);
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy / u_resolution) * 2.0 - 1.0;
    uv.x *= u_resolution.x / u_resolution.y;

    float drift = u_trackElapsed * 0.05;
    float t = u_time * 0.4 + drift;

    float v = plasma(uv, t);

    // Soft bloom: add a second layer at slower speed
    float v2 = plasma(uv * 1.5 + vec2(0.3, -0.2), t * 0.6);
    float combined = (v + v2) * 0.5;

    vec3 col = plasmaColor(combined, u_trackProgress);
    float alpha = 0.9;

    fragColor = vec4(col * alpha, alpha);
  }
`
