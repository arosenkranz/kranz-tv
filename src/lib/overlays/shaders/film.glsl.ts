import { COMMON_GLSL } from './common.glsl'

/**
 * 8mm film look.
 *
 * Premultiplied-alpha output — RGB is additive, alpha darkens video beneath.
 *
 * Effects:
 * - Animated grain: fast hash noise, seeded by u_time
 * - Subtle vignette: gentle corner darkening
 * - Flicker: periodic brightness oscillation at ~18fps cadence
 * - Warm sepia tint: slight orange/brown colour cast
 * - Vertical scratches: thin bright vertical lines that appear/disappear
 */
export const FILM_SHADER =
  COMMON_GLSL +
  /* glsl */ `
  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;

    // --- Film grain ---
    float grainSeed = floor(u_time * 24.0);
    float grain = hash(uv * u_resolution + vec2(grainSeed * 13.7, grainSeed * 7.3));
    grain = (grain - 0.5) * 0.20;

    // --- Flicker: ~18fps brightness oscillation ---
    float flickerTime = floor(u_time * 18.0);
    float flicker = hash(vec2(flickerTime, 42.0));
    flicker = 0.88 + flicker * 0.12;

    // --- Warm sepia tint ---
    float sepiaR = 0.04;
    float sepiaG = 0.02;
    float sepiaB = 0.0;

    // --- Vertical scratches ---
    float scratchSeed1 = floor(u_time * 0.3);
    float scratchSeed2 = floor(u_time * 0.2 + 5.5);
    float scratchX1 = hash(vec2(scratchSeed1, 1.0));
    float scratchX2 = hash(vec2(scratchSeed2, 3.0));
    float scratchActive1 = step(0.85, hash(vec2(scratchSeed1, 7.0)));
    float scratchActive2 = step(0.90, hash(vec2(scratchSeed2, 9.0)));
    float scratchWidth = 0.0015;
    float scratch1 = scratchActive1 * smoothstep(scratchWidth, 0.0, abs(uv.x - scratchX1));
    float scratch2 = scratchActive2 * smoothstep(scratchWidth, 0.0, abs(uv.x - scratchX2));
    float scratch = (scratch1 + scratch2) * 0.30;

    // --- Combine ---
    float totalBright = scratch + clamp(grain, 0.0, 0.12) * flicker;
    float totalDark = clamp(-grain, 0.0, 0.12);
    totalDark = clamp(totalDark, 0.0, 0.55);
    totalBright = clamp(totalBright, 0.0, 0.30);

    fragColor = vec4(
      sepiaR + totalBright,
      sepiaG + totalBright * 0.9,
      sepiaB + totalBright * 0.6,
      totalDark
    );
  }
`
