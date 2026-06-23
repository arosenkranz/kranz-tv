// Fractal Voyage — raymarched flight through a power-8 Mandelbulb. Organic
// coral surfaces morphing with track progress; palette cycles with progress.
// u_intensity scales: flight speed, DE power wobble, palette cycle rate, glow.
export const FRACTAL_VOYAGE_SHADER = /* glsl */ `#version 300 es
  precision highp float;

  uniform float u_time;
  uniform float u_trackElapsed;
  uniform float u_trackProgress;
  uniform float u_intensity;
  uniform vec2  u_resolution;

  out vec4 fragColor;

  #define PI 3.14159265359
  #define MAX_STEPS 64
  #define MAX_DIST 6.0
  #define SURF 0.001

  // Power-8 Mandelbulb distance estimator.
  float mandelbulbDE(vec3 pos, float power) {
    vec3 z = pos;
    float dr = 1.0;
    float r = 0.0;
    for (int i = 0; i < 6; i++) {
      r = length(z);
      if (r > 2.0) break;
      float theta = acos(z.z / r);
      float phi = atan(z.y, z.x);
      dr = pow(r, power - 1.0) * power * dr + 1.0;
      float zr = pow(r, power);
      theta *= power;
      phi *= power;
      z = zr * vec3(sin(theta) * cos(phi), sin(phi) * sin(theta), cos(theta));
      z += pos;
    }
    return 0.5 * log(r) * r / dr;
  }

  vec3 palette(float t) {
    return 0.5 + 0.5 * cos(2.0 * PI * (vec3(1.0, 0.7, 0.4) * t + vec3(0.0, 0.15, 0.35)));
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;

    float speed = mix(0.05, 0.4, u_intensity);
    float fly = u_time * speed + u_trackElapsed * 0.01;
    // Slow power wobble so the fractal "breathes".
    float power = 8.0 + sin(u_time * 0.2) * mix(0.3, 1.6, u_intensity);

    vec3 ro = vec3(0.0, 0.0, 1.6 - fract(fly) * 0.6);
    vec3 rd = normalize(vec3(uv, -1.0));
    // Gentle rotation of the ray field over time.
    float a = u_time * 0.08;
    rd.xy = mat2(cos(a), -sin(a), sin(a), cos(a)) * rd.xy;

    float t = 0.0;
    float glow = 0.0;
    for (int i = 0; i < MAX_STEPS; i++) {
      vec3 p = ro + rd * t;
      float d = mandelbulbDE(p, power);
      glow += 0.015 / (abs(d) + 0.02);
      if (d < SURF || t > MAX_DIST) break;
      t += d * 0.7;
    }

    float palT = u_trackProgress + t * 0.12 + u_time * mix(0.01, 0.06, u_intensity);
    vec3 col = palette(palT) * glow * mix(0.5, 1.2, u_intensity);
    col = pow(clamp(col, 0.0, 1.0), vec3(0.85));

    fragColor = vec4(col, max(length(col), 0.02));
  }
`
