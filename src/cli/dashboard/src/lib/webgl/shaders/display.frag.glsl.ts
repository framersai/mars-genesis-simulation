/**
 * Display shader — samples the final RD texture and colorizes U/V
 * into one of three palettes. Background stays near --bg-deep so
 * subtle patterns read clearly across all palettes.
 *   u_palette = 0 → amber (warm, default)
 *   u_palette = 1 → cool  (teal/violet, color-blind-safer)
 *   u_palette = 2 → mono  (warm off-white, high contrast)
 */
export const DISPLAY_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_uv;
uniform sampler2D u_field;
uniform vec3 u_sideTint;
uniform int u_palette;
out vec4 outColor;

void main() {
  vec2 rg = texture(u_field, v_uv).rg;
  float U = rg.r;
  float V = rg.g;

  vec3 bg = vec3(0.039, 0.031, 0.024);

  vec3 vitality;
  vec3 stress;
  if (u_palette == 1) {
    vitality = vec3(0.31, 0.80, 0.77);   // teal
    stress   = vec3(0.61, 0.42, 0.85);   // violet
  } else if (u_palette == 2) {
    vitality = vec3(0.96, 0.94, 0.90);   // near-white
    stress   = vec3(0.45, 0.42, 0.37);   // neutral grey
  } else {
    vitality = vec3(0.91, 0.71, 0.29);   // amber
    stress   = vec3(0.77, 0.40, 0.19);   // rust
  }

  float uPattern = clamp(1.0 - U, 0.0, 1.0);
  float vPattern = clamp(V * 3.0, 0.0, 1.0);

  vec3 color = bg
    + vitality * uPattern * 0.5
    + stress * vPattern * 0.7
    + u_sideTint * 0.04;

  outColor = vec4(color, 1.0);
}
`;
