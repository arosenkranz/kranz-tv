import { COMMON_GLSL } from './common.glsl'

/**
 * Analog over-the-air broadcast signal.
 *
 * Premultiplied-alpha output — RGB is additive, alpha darkens video beneath.
 *
 * Static is per-pixel random each frame with NO directional motion.
 * Time is decoupled from spatial coordinates to prevent scrolling artifacts.
 *
 * - Static/snow: independent per-pixel flicker
 * - Horizontal band interference: occasional faint bands drift slowly
 * - Scanlines: faint horizontal banding
 * - Gentle vignette
 */
export const BROADCAST_SHADER = COMMON_GLSL + /* glsl */ `
  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float px = floor(uv.x * u_resolution.x);
    float py = floor(uv.y * u_resolution.y);

    // --- Per-pixel static ---
    // Each pixel gets an independent random value each frame.
    // Time is folded into a completely separate hash dimension
    // so changing frames doesn't shift the noise spatially.
    float frame = floor(u_time * 24.0);
    float frameHash = hash(vec2(frame * 73.17, frame * 31.91));
    float snow = hash(vec2(
      px * 1.0 + frameHash * 7432.1,
      py * 1.0 + frameHash * 3891.7
    ));
    snow = (snow - 0.5) * 0.12;

    // --- Horizontal band interference ---
    // Faint brightness bands that drift slowly up/down (not per-pixel).
    // Simulates multipath signal interference — wide, gentle waves.
    float band1 = sin(uv.y * 4.0 + u_time * 0.15) * 0.015;
    float band2 = sin(uv.y * 7.0 - u_time * 0.09) * 0.010;
    float bands = band1 + band2;

    // --- Scanlines ---
    float scanline = mod(gl_FragCoord.y, 4.0);
    float scanDark = step(3.0, scanline) * 0.08;

    // --- Gentle vignette ---
    float vigDark = (1.0 - vignette(uv, 3.5)) * 0.18;

    // --- Combine ---
    float total = snow + bands;
    float bright = clamp(total, 0.0, 0.06);
    float dark = clamp(-total, 0.0, 0.06) + scanDark + vigDark;
    dark = clamp(dark, 0.0, 0.40);

    gl_FragColor = vec4(bright, bright, bright, dark);
  }
`
