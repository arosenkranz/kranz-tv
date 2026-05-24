// Receding chrome grid + synthwave sun. Pink/cyan/purple palette.
// Grid speed driven by u_time; sun stripes pulse with u_trackElapsed.
// Fixed: use sceneY = 1.0 - uv.y so sky/sun renders at top, grid at bottom.
export const RETROWAVE_SHADER = /* glsl */ `#version 300 es
  precision mediump float;

  uniform float u_time;
  uniform float u_trackElapsed;
  uniform float u_trackProgress;
  uniform vec2  u_resolution;

  out vec4 fragColor;

  #define PI 3.14159265359
  #define HORIZON 0.45

  float grid(vec2 sy_uv, float speed) {
    // Horizontal lines with perspective — closer lines are wider apart
    // sy_uv.y uses sceneY so y=0 is top of screen (sky)
    float y = sy_uv.y;
    float perspY = 1.0 / max(y - HORIZON, 0.001);
    float lineH = fract(perspY * 0.4 - u_time * speed);
    float h = smoothstep(0.0, 0.05, lineH) * smoothstep(1.0, 0.95, lineH);

    // Vertical lines converging at horizon
    float perspX = (sy_uv.x - 0.5) * perspY * 0.3;
    float lineV = fract(perspX * 3.0);
    float v = smoothstep(0.0, 0.04, lineV) * smoothstep(1.0, 0.96, lineV);

    return max(h, v) * step(HORIZON, sy_uv.y);
  }

  // sy_uv uses sceneY coords: sy_uv.y=0 is top of screen
  vec3 sunStripes(vec2 sy_uv) {
    float sunY = 0.32;  // sits above horizon (lower sy_uv.y = higher on screen)
    float sunR = 0.22;
    float d = length(sy_uv - vec2(0.5, sunY));
    if (d > sunR) return vec3(0.0);

    // Horizontal stripe cut-outs
    float localY = (sy_uv.y - sunY + sunR) / (2.0 * sunR);
    float stripe = fract(localY * 10.0 + u_trackElapsed * 0.04);
    float cut = step(0.55, stripe);

    // Radial gradient: yellow center → magenta edge
    float t = d / sunR;
    vec3 sunCol = mix(vec3(1.0, 0.95, 0.2), vec3(1.0, 0.1, 0.6), t);
    return sunCol * (1.0 - cut) * 1.2;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    // sceneY: flip so sy=0 is TOP of screen, sky renders at top, grid at bottom
    vec2 sy = vec2(uv.x, 1.0 - uv.y);

    // Sky gradient: deep purple at top → dark blue near horizon
    vec3 sky = mix(vec3(0.05, 0.0, 0.15), vec3(0.0, 0.02, 0.25), sy.y);

    // Horizon glow
    float hGlow = exp(-abs(sy.y - HORIZON) * 20.0);
    sky += vec3(0.8, 0.0, 0.6) * hGlow * 0.6;

    // Sun (positioned in upper half of sky using sceneY)
    vec3 sun = sunStripes(sy);

    // Grid — intensity drives scroll speed
    float speed = mix(0.15, 1.4, u_intensity) + u_trackProgress * 0.4;
    float g = grid(sy, speed);
    vec3 gridCol = mix(vec3(0.0, 0.9, 1.0), vec3(0.9, 0.0, 0.8), uv.x);
    vec3 gridLight = gridCol * g * 1.5;

    // Ground color: dark navy
    vec3 ground = vec3(0.02, 0.0, 0.08);

    // sy.y < HORIZON = top half (sky+sun); sy.y >= HORIZON = bottom half (ground+grid)
    vec3 col = sy.y < HORIZON ? sky + sun : ground + gridLight;
    float alpha = 0.92;

    fragColor = vec4(col * alpha, alpha);
  }
`
