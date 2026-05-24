// 1960s Op-Art moiré — two offset sets of concentric rings create hypnotic
// interference fringes. High-contrast cream/near-black with amber tint.
// Motion is slow and meditative; u_intensity scales ring-centre drift speed.
export const OP_ART_SHADER = /* glsl */ `#version 300 es
  precision mediump float;

  uniform float u_time;
  uniform float u_trackElapsed;
  uniform float u_trackProgress;
  uniform float u_intensity;
  uniform vec2  u_resolution;

  out vec4 fragColor;

  #define PI 3.14159265359

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    // Correct aspect ratio
    float aspect = u_resolution.x / u_resolution.y;
    vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

    // Drift speed scales with intensity
    float speed = mix(0.04, 0.22, u_intensity);

    // Two ring centres on slow independent Lissajous paths
    vec2 c1 = vec2(
       0.22 * sin(u_time * speed * 0.9),
       0.18 * cos(u_time * speed * 0.7)
    );
    vec2 c2 = vec2(
      -0.20 * cos(u_time * speed * 0.8),
      -0.16 * sin(u_time * speed * 1.1)
    );
    // Third centre counter-rotates for extra interference complexity
    vec2 c3 = vec2(
       0.12 * cos(u_time * speed * 1.3 + PI * 0.5),
      -0.10 * sin(u_time * speed * 0.6 + PI * 0.3)
    );

    // Ring frequency drifts very slowly with track progress
    float freq = mix(14.0, 17.0, 0.5 + 0.5 * sin(u_trackProgress * PI * 2.0));

    // Moiré = product of periodic ring fields
    float r1 = sin(length(p - c1) * freq * PI);
    float r2 = sin(length(p - c2) * freq * PI);
    float r3 = sin(length(p - c3) * freq * PI * 0.72);

    float moire = r1 * r2 * r3;

    // High-contrast step — period-accurate B&W
    float bw = step(0.0, moire);

    // Cream paper background, near-black ink
    vec3 paper = vec3(0.94, 0.91, 0.84);
    vec3 ink   = vec3(0.07, 0.05, 0.04);
    vec3 col = mix(ink, paper, bw);

    // Subtle amber tint in the bright interference zones
    col += vec3(0.04, 0.015, 0.0) * bw * abs(moire);

    // Vignette — darkens edges slightly for a print-on-paper feel
    float vig = 1.0 - 0.3 * dot(p * 1.4, p * 1.4);
    col *= clamp(vig, 0.0, 1.0);

    float alpha = 0.95;
    fragColor = vec4(col * alpha, alpha);
  }
`
