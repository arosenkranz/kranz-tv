// Internal present pass — blits one texture (the just-written feedback FBO)
// straight to the screen. NOT a user-facing preset. Runs with blend disabled
// so it is a true copy, never a composite.
export const PRESENT_VERTEX_SHADER = /* glsl */ `#version 300 es
  in vec2 a_position;
  out vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

export const PRESENT_FRAGMENT_SHADER = /* glsl */ `#version 300 es
  precision mediump float;
  uniform sampler2D u_tex;
  in vec2 v_uv;
  out vec4 fragColor;
  void main() {
    fragColor = texture(u_tex, v_uv);
  }
`
