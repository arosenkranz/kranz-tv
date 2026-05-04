import { COMMON_GLSL } from './common.glsl'

/**
 * Filmstrip — 8mm film projected through a bad composite connection.
 *
 * Premultiplied-alpha output — RGB is additive, alpha darkens video beneath.
 *
 * Combines film-stock artefacts (grain, flicker, scratches, sepia tint)
 * with 480i interlace artefacts (field lines, jitter, chroma bleed).
 * The result looks like a film print being played through cheap analogue
 * video hardware.
 *
 * Film layer:
 * - Animated grain (24fps hash noise)
 * - Brightness flicker (~18fps oscillation)
 * - Warm sepia tint
 * - Vertical scratches that appear/disappear
 *
 * Interlace layer:
 * - 2px alternating field lines at ~30fps
 * - Vertical jitter between fields
 * - Chroma bleed (red/blue fringing)
 */
export const FILMSTRIP_SHADER =
  COMMON_GLSL +
  /* glsl */ `
  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float py = gl_FragCoord.y;

    // ==================== FILM LAYER ====================

    // --- Film grain ---
    float grainSeed = floor(u_time * 24.0);
    float grain = hash(uv * u_resolution + vec2(grainSeed * 13.7, grainSeed * 7.3));
    grain = (grain - 0.5) * 0.18;

    // --- Flicker: ~18fps brightness oscillation ---
    float flickerTime = floor(u_time * 18.0);
    float flicker = hash(vec2(flickerTime, 42.0));
    flicker = 0.90 + flicker * 0.10;

    // --- Warm sepia tint ---
    float sepiaR = 0.035;
    float sepiaG = 0.018;
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
    float scratch = (scratch1 + scratch2) * 0.25;

    // ==================== INTERLACE LAYER ====================

    // --- Field selection: alternate odd/even at ~30fps ---
    float field = floor(u_time * 30.0);
    float isOddField = mod(field, 2.0);

    // Vertical jitter: shift field by ~0.5px each swap.
    float jitter = isOddField * 0.7;
    float adjustedY = py + jitter;

    // --- Interlace lines: 2px thick pairs ---
    float linePair = mod(floor(adjustedY / 2.0), 2.0);
    float fieldMatch = abs(linePair - isOddField);
    float lineDark = fieldMatch * 0.18;

    // --- Chroma bleed ---
    float lineEdge = smoothstep(0.0, 1.0, mod(adjustedY, 4.0) / 4.0);
    float chromaR = lineEdge * 0.020;
    float chromaB = (1.0 - lineEdge) * 0.015;

    // ==================== COMBINE ====================

    float filmBright = scratch + clamp(grain, 0.0, 0.10) * flicker;
    float filmDark = clamp(-grain, 0.0, 0.10);

    float totalBright = filmBright + chromaR + chromaB;
    totalBright = clamp(totalBright, 0.0, 0.25);

    float totalDark = filmDark + lineDark;
    totalDark = clamp(totalDark, 0.0, 0.45);

    fragColor = vec4(
      sepiaR + totalBright + chromaR,
      sepiaG + totalBright * 0.85,
      sepiaB + totalBright * 0.55 + chromaB,
      totalDark
    );
  }
`
