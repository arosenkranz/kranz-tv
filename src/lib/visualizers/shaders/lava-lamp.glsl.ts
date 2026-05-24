// 1970s lava lamp — 5 SDF metaballs with smooth-min merge topology.
// Amber/burnt-orange blobs on deep black-brown. Slow thermal buoyancy motion.
// u_intensity scales blob drift speed and smooth-merge radius.
export const LAVA_LAMP_SHADER = /* glsl */ `#version 300 es
  precision mediump float;

  uniform float u_time;
  uniform float u_trackElapsed;
  uniform float u_trackProgress;
  uniform float u_intensity;
  uniform vec2  u_resolution;

  out vec4 fragColor;

  #define PI 3.14159265359
  #define NUM_BLOBS 5

  // Smooth minimum — produces organic blob merging
  float smin(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * 0.25;
  }

  float hash(float n) {
    return fract(sin(n) * 43758.5453);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;
    vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

    // Blob drift speed driven by intensity
    float speed = mix(0.06, 0.45, u_intensity);
    // Smooth-min blend radius — widens at higher intensity (blobs merge more)
    float k = mix(0.10, 0.22, u_intensity);
    // Blob radius
    float blobR = 0.18;

    // Build SDF field: minimum distance to any blob surface
    float field = 9999.0;
    for (int i = 0; i < NUM_BLOBS; i++) {
      float fi = float(i);
      float phase = fi * 1.2566; // 2PI/5 spacing
      float h1 = hash(fi);
      float h2 = hash(fi + 7.3);
      float h3 = hash(fi + 13.7);

      // Thermal buoyancy: blobs rise, reach top, fall back (asymmetric)
      float rise = sin(u_time * speed * (0.7 + h1 * 0.6) + phase);
      float sway = cos(u_time * speed * (0.5 + h2 * 0.4) + phase * 1.3);

      vec2 centre = vec2(
        (h3 - 0.5) * 0.7 * aspect + sway * 0.15 * aspect,
        rise * 0.38 + (h1 - 0.5) * 0.1
      );

      float d = length(p - centre) - blobR;
      field = smin(field, d, k);
    }

    // Inside blob (field < 0) = amber glow; outside = deep black-brown void
    float blob = clamp(-field / 0.05, 0.0, 1.0);

    // 1970s lava lamp amber palette
    vec3 hotCore  = vec3(1.00, 0.72, 0.15); // bright amber-yellow
    vec3 warmEdge = vec3(0.70, 0.25, 0.03); // burnt orange
    vec3 voidCol  = vec3(0.03, 0.01, 0.00); // near-black brown

    // Radial glow within each blob — brighter toward centre
    float innerGlow = clamp(-field / blobR, 0.0, 1.0);
    vec3 blobCol = mix(warmEdge, hotCore, innerGlow * innerGlow);

    // Ambient warm fog just outside blob surfaces (the heated liquid glow)
    float fog = exp(field * 4.0) * 0.12;
    vec3 fogCol = vec3(0.25, 0.06, 0.01);

    vec3 col = mix(voidCol + fogCol * fog, blobCol, blob);

    // Very subtle film-grain texture for period texture
    float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    col += (grain - 0.5) * 0.018;

    float alpha = 0.93;
    fragColor = vec4(clamp(col, 0.0, 1.0) * alpha, alpha);
  }
`
