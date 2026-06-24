// Fractal Voyage — raymarched orbit around a power-8 Mandelbulb. The surface is
// LIT (normal + AO + soft shadow + orbit-trap color), not glow-accumulated, so
// it shows organic coral STRUCTURE and never blows out. The camera orbits on a
// continuous sin/cos path (no fract() teleport → no flicker). ACES tonemap
// bounds highlights.
// u_intensity scales: orbit speed, DE power wobble, palette cycle, light punch.
export const FRACTAL_VOYAGE_SHADER = /* glsl */ `#version 300 es
  precision highp float;

  uniform float u_time;
  uniform float u_trackElapsed;
  uniform float u_trackProgress;
  uniform float u_intensity;
  uniform vec2  u_resolution;

  out vec4 fragColor;

  #define PI 3.14159265359
  #define MAX_STEPS 90
  #define MAX_DIST 8.0

  float g_power = 8.0;

  // Power-8 Mandelbulb. Returns vec2(distance, orbitTrap). The trap = closest the
  // orbit gets to the origin, a bounded value used for coloring.
  vec2 mandelbulbDE(vec3 pos) {
    vec3 z = pos;
    float dr = 1.0;
    float r = 0.0;
    float trap = 1e10;
    for (int i = 0; i < 8; i++) {
      r = length(z);
      if (r > 2.0) break;
      float theta = acos(clamp(z.z / r, -1.0, 1.0));
      float phi = atan(z.y, z.x);
      dr = pow(r, g_power - 1.0) * g_power * dr + 1.0;
      float zr = pow(r, g_power);
      theta *= g_power;
      phi *= g_power;
      z = zr * vec3(sin(theta) * cos(phi), sin(phi) * sin(theta), cos(theta)) + pos;
      trap = min(trap, r);
    }
    return vec2(0.5 * log(r) * r / dr, trap);
  }

  // Tetrahedron normal — 4 DE evals.
  vec3 calcNormal(vec3 p) {
    const float h = 0.0008;
    const vec2 k = vec2(1.0, -1.0);
    return normalize(
      k.xyy * mandelbulbDE(p + k.xyy * h).x +
      k.yyx * mandelbulbDE(p + k.yyx * h).x +
      k.yxy * mandelbulbDE(p + k.yxy * h).x +
      k.xxx * mandelbulbDE(p + k.xxx * h).x
    );
  }

  // IQ ambient occlusion — bounded to [0,1].
  float calcAO(vec3 p, vec3 n) {
    float occ = 0.0;
    float sca = 1.0;
    for (int i = 0; i < 5; i++) {
      float h = 0.01 + 0.12 * float(i) / 4.0;
      occ += (h - mandelbulbDE(p + h * n).x) * sca;
      sca *= 0.95;
    }
    return clamp(1.0 - 3.0 * occ, 0.0, 1.0);
  }

  // IQ soft shadow.
  float softShadow(vec3 ro, vec3 rd) {
    float res = 1.0;
    float t = 0.02;
    for (int i = 0; i < 24; i++) {
      float h = mandelbulbDE(ro + rd * t).x;
      res = min(res, 8.0 * h / t);
      t += clamp(h, 0.02, 0.12);
      if (h < 0.001 || t > 4.0) break;
    }
    return clamp(res, 0.0, 1.0);
  }

  vec3 palette(float t) {
    return 0.5 + 0.5 * cos(2.0 * PI * (vec3(1.0) * t + vec3(0.0, 0.33, 0.67)));
  }

  mat3 setCamera(vec3 ro, vec3 ta) {
    vec3 cw = normalize(ta - ro);
    vec3 cp = vec3(0.0, 1.0, 0.0);
    vec3 cu = normalize(cross(cw, cp));
    vec3 cv = normalize(cross(cu, cw));
    return mat3(cu, cv, cw);
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;

    // Slow power wobble so the fractal "breathes".
    g_power = 8.0 + sin(u_time * 0.2) * mix(0.3, 1.4, u_intensity);

    // Continuous orbit — sin/cos only, loops forever, no teleport.
    float t = u_time * mix(0.05, 0.18, u_intensity) + u_trackElapsed * 0.01;
    float radius = 2.2 + 0.45 * sin(t * 0.5);
    vec3 ro = vec3(radius * cos(t), 0.7 * sin(t * 0.37), radius * sin(t));
    mat3 cam = setCamera(ro, vec3(0.0));
    vec3 rd = cam * normalize(vec3(uv, 1.6));

    // March to the surface with a distance-relative epsilon (kills speckle).
    float dist = 0.0;
    float trap = 0.0;
    bool hit = false;
    for (int i = 0; i < MAX_STEPS; i++) {
      vec3 p = ro + rd * dist;
      vec2 res = mandelbulbDE(p);
      trap = res.y;
      if (res.x < 0.0015 * dist) { hit = true; break; }
      if (dist > MAX_DIST) break;
      dist += res.x * 0.8;
    }

    vec3 col = vec3(0.0);
    if (hit) {
      vec3 p = ro + rd * dist;
      vec3 n = calcNormal(p);
      vec3 lightDir = normalize(vec3(0.6, 0.7, -0.4));

      float ao = calcAO(p, n);
      float sh = softShadow(p + n * 0.002, lightDir);
      float dif = clamp(dot(n, lightDir), 0.0, 1.0);
      // Soft fresnel rim for a glassy coral edge.
      float fres = pow(clamp(1.0 + dot(rd, n), 0.0, 1.0), 3.0);

      float palT = trap * 2.0 + u_trackProgress + u_time * mix(0.01, 0.05, u_intensity);
      vec3 base = palette(palT);

      vec3 amb = base * (0.25 + 0.25 * n.y) * ao;
      vec3 diffuse = base * dif * sh * mix(0.7, 1.3, u_intensity);
      vec3 rim = palette(palT + 0.5) * fres * 0.6;
      col = amb + diffuse + rim;

      // Distance fade so the far side recedes into black (depth cue).
      col *= exp(-0.15 * dist);
    }

    // ACES tonemap — bounds highlights, no clip-to-solid.
    col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
    col = pow(clamp(col, 0.0, 1.0), vec3(0.4545));

    fragColor = vec4(col, max(length(col), 0.02));
  }
`
