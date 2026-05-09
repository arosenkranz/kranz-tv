import { COMMON_GLSL } from './common.glsl'

/**
 * VHS tape simulation.
 *
 * Premultiplied-alpha output — RGB is additive, alpha darkens video beneath.
 *
 * Effects:
 * - Wide scanlines: darker bands spaced like VHS resolution
 * - Animated tracking line: a bright horizontal band that scrolls top-to-bottom
 * - Tape noise: subtle hash noise across the frame
 * - Occasional glitch tears: horizontal bands with soft edges
 */
export const VHS_SHADER =
  COMMON_GLSL +
  /* glsl */ `
  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;

    // --- Wide scanlines (VHS ~240 lines effective res) ---
    float scanline = mod(gl_FragCoord.y, 6.0);
    float scanDark = step(3.0, scanline) * 0.16;

    // --- Animated tracking line ---
    float trackPos = mod(u_time / 8.0, 1.0);
    float trackY = 1.0 - trackPos;
    float trackDist = abs(uv.y - trackY);
    float trackBand = smoothstep(0.03, 0.0, trackDist);
    float trackNoise = hash(vec2(uv.x * u_resolution.x, floor(u_time * 30.0))) * trackBand;
    float trackBright = trackBand * 0.12;

    // --- Glitch tears: soft-edged horizontal bands ---
    float tearSeed = floor(u_time * 1.8);
    float tearY = hash(vec2(tearSeed, 0.0));
    float tearHeight = 0.04 + hash(vec2(tearSeed, 1.0)) * 0.06;
    // Soft edges using smoothstep instead of hard step()
    float inTear = smoothstep(tearY - 0.01, tearY + 0.01, uv.y)
                 * smoothstep(tearY + tearHeight + 0.01, tearY + tearHeight - 0.01, uv.y);
    float tearActive = step(0.82, hash(vec2(tearSeed, 2.0)));
    float tearDark = inTear * tearActive * 0.18;
    float tearEdge = smoothstep(0.006, 0.0, abs(uv.y - tearY)) * inTear * tearActive * 0.12;

    // --- Tape noise scattered across frame ---
    float wobble = sin(uv.y * 180.0 + u_time * 2.5) * 0.0008;
    float frameNoise = hash(vec2((uv.x + wobble) * u_resolution.x * 0.5, uv.y * u_resolution.y * 0.5 + floor(u_time * 24.0))) * 0.04;

    // --- Vignette ---
    float vigDark = (1.0 - vignette(uv, 1.8)) * 0.30;

    // --- Combine ---
    float dark = clamp(scanDark + tearDark + vigDark, 0.0, 0.65);
    float bright = clamp(trackBright + tearEdge + trackNoise * 0.06 + frameNoise, 0.0, 0.20);

    fragColor = vec4(bright, bright, bright, dark);
  }
`
