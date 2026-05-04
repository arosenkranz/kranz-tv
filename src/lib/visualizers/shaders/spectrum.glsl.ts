// Faked EQ bars driven by sin/cos of elapsed time + track progress.
// No Web Audio FFT — purely procedural. Default, cheapest preset.
// WebGL1 / GLSL ES 1.0 syntax to match ShaderQuadRenderer base class.
export const SPECTRUM_SHADER = /* glsl */ `
  precision mediump float;

  uniform float u_time;
  uniform float u_trackElapsed;
  uniform float u_trackProgress;
  uniform vec2  u_resolution;

  #define BAR_COUNT 32.0

  float fakeAmplitude(float barIndex, float t) {
    float phase = barIndex * 0.47 + t * 2.1;
    float lo = sin(phase) * 0.5 + 0.5;
    float hi = sin(phase * 1.7 + t * 0.9) * 0.5 + 0.5;
    float mid = sin(phase * 3.1 + t * 1.3) * 0.3 + 0.3;
    return clamp(lo * 0.4 + hi * 0.35 + mid * 0.25, 0.04, 0.95);
  }

  vec3 barColor(float barIndex, float amp, float progress) {
    float hue = mod(barIndex / BAR_COUNT + progress * 0.5, 1.0);
    float h = hue * 6.0;
    float i = floor(h);
    float f = h - i;
    float v = amp;
    float s = 0.75;
    float p = v * (1.0 - s);
    float q = v * (1.0 - s * f);
    float t2 = v * (1.0 - s * (1.0 - f));
    if (i == 0.0) return vec3(v, t2, p);
    if (i == 1.0) return vec3(q, v, p);
    if (i == 2.0) return vec3(p, v, t2);
    if (i == 3.0) return vec3(p, q, v);
    if (i == 4.0) return vec3(t2, p, v);
    return vec3(v, p, q);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;

    float barIndex = floor(uv.x * BAR_COUNT);
    float amp = fakeAmplitude(barIndex, u_trackElapsed);

    float lit = step(1.0 - amp, uv.y);

    float reflectAmp = fakeAmplitude(barIndex, u_trackElapsed) * 0.4;
    float litReflect = step(0.15 - reflectAmp, uv.y) * step(uv.y, 0.15);

    vec3 col = barColor(barIndex, amp, u_trackProgress);
    float alpha = max(lit, litReflect * 0.4) * 0.85;

    gl_FragColor = vec4(col * alpha, alpha);
  }
`
