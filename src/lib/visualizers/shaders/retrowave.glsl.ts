// Receding chrome grid + synthwave sun. Pink/cyan/purple palette.
// Grid speed driven by u_time; sun stripes pulse with u_trackElapsed.
export const RETROWAVE_SHADER = /* glsl */ `#version 300 es
  precision mediump float;

  uniform float u_time;
  uniform float u_trackElapsed;
  uniform float u_trackProgress;
  uniform vec2  u_resolution;

  out vec4 fragColor;

  #define PI 3.14159265359
  #define HORIZON 0.45

  float grid(vec2 uv, float speed) {
    // Horizontal lines with perspective — closer lines are wider apart
    float y = uv.y;
    float perspY = 1.0 / max(y - HORIZON, 0.001);
    float lineH = fract(perspY * 0.4 - u_time * speed);
    float h = smoothstep(0.0, 0.05, lineH) * smoothstep(1.0, 0.95, lineH);

    // Vertical lines converging at horizon
    float perspX = (uv.x - 0.5) * perspY * 0.3;
    float lineV = fract(perspX * 3.0);
    float v = smoothstep(0.0, 0.04, lineV) * smoothstep(1.0, 0.96, lineV);

    return max(h, v) * step(HORIZON, uv.y);
  }

  vec3 sunStripes(vec2 uv) {
    float sunY = 0.38;
    float sunR = 0.22;
    float d = length(uv - vec2(0.5, sunY));
    if (d > sunR) return vec3(0.0);

    // Horizontal stripe cut-outs
    float localY = (uv.y - sunY + sunR) / (2.0 * sunR);
    float stripe = fract(localY * 10.0 + u_trackElapsed * 0.04);
    float cut = step(0.55, stripe);

    // Radial gradient: yellow center → magenta edge
    float t = d / sunR;
    vec3 sunCol = mix(vec3(1.0, 0.95, 0.2), vec3(1.0, 0.1, 0.6), t);
    return sunCol * (1.0 - cut) * 1.2;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;

    // Sky gradient: deep purple → dark blue
    vec3 sky = mix(vec3(0.05, 0.0, 0.15), vec3(0.0, 0.02, 0.25), uv.y);

    // Horizon glow
    float hGlow = exp(-abs(uv.y - HORIZON) * 20.0);
    sky += vec3(0.8, 0.0, 0.6) * hGlow * 0.6;

    // Sun
    vec3 sun = sunStripes(uv);

    // Grid
    float speed = 0.5 + u_trackProgress * 0.4;
    float g = grid(uv, speed);
    vec3 gridCol = mix(vec3(0.0, 0.9, 1.0), vec3(0.9, 0.0, 0.8), uv.x);
    vec3 gridLight = gridCol * g * 1.5;

    // Ground color: dark navy
    vec3 ground = vec3(0.02, 0.0, 0.08);

    vec3 col = uv.y < HORIZON ? sky + sun : ground + gridLight;
    float alpha = 0.92;

    fragColor = vec4(col * alpha, alpha);
  }
`
