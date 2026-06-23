export const ACID_MELT_SHADER = /* glsl */ `#version 300 es
  precision mediump float;
  uniform float u_time; uniform float u_trackElapsed; uniform float u_trackProgress;
  uniform float u_intensity; uniform vec2 u_resolution;
  uniform sampler2D u_prevFrame; uniform float u_hasPrev;
  out vec4 fragColor;
  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec3 prev = u_hasPrev > 0.5 ? texture(u_prevFrame, uv).rgb * 0.95 : vec3(0.0);
    vec3 ink = 0.5 + 0.5 * cos(u_time + uv.xyx * 6.0 + vec3(0.0, 2.0, 4.0));
    vec3 col = max(prev, ink * 0.5);
    fragColor = vec4(col, 1.0);
  }
`
