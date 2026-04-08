import { COMMON_GLSL } from './common.glsl'

/**
 * CRT monitor simulation with barrel distortion.
 *
 * Premultiplied-alpha output — RGB is additive, alpha darkens video beneath.
 *
 * Effects:
 * - Barrel distortion: scanlines visibly curve like convex CRT glass
 * - Fewer, thicker scanlines (~120) so curvature is obvious
 * - Faint green phosphor tint
 */
export const CRT_SHADER = COMMON_GLSL + /* glsl */ `
  vec2 barrelDistort(vec2 uv, float amount) {
    vec2 centered = uv - 0.5;
    float r2 = dot(centered, centered);
    return centered * (1.0 + amount * r2) + 0.5;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;

    // Barrel distortion applied directly — no pre-scale so
    // the curvature is visible as the edges pull inward
    vec2 curved = barrelDistort(uv, 1.2);

    // ~280 scanlines
    float scanY = curved.y * 280.0;
    float scanline = sin(scanY * 3.14159) * 0.5 + 0.5;
    float scanDark = (1.0 - scanline) * 0.30;

    // Faint green phosphor tint
    float greenTint = 0.015;

    // Very subtle edge darkening
    float edgeFade = smoothstep(1.1, 0.8, length((uv - 0.5) * 2.0));
    float edgeDark = (1.0 - edgeFade) * 0.15;

    float dark = clamp(scanDark + edgeDark, 0.0, 0.60);

    gl_FragColor = vec4(0.0, greenTint, 0.0, dark);
  }
`
