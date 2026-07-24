import { useEffect, useRef } from "react";

import type { Celebration } from "./celebration";

export interface CelebrationOverlayProps {
  readonly celebration: Celebration;
  readonly onDone: () => void;
}

const VERTEX = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

// Fire rising from the bottom, plus branching lightning above baiman, plus an
// entry flash. Additive over the page (alpha follows luminance) so the score
// underneath stays legible — this is celebration, not an occlusion.
const FRAGMENT = `
precision highp float;
uniform vec2 u_res;
uniform float u_time, u_intensity, u_alpha, u_flash, u_lightning;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.0 + 13.0; a *= 0.5; }
  return v;
}
void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  float t = u_time;
  vec3 col = vec3(0.0);

  // fire
  vec2 fp = vec2(uv.x * 3.0, uv.y * 2.2 - t * 1.6);
  float flame = fbm(fp + fbm(fp * 1.7) * 0.6);
  float mask = smoothstep(0.98, 0.02, uv.y);
  float fire = pow(clamp(flame * mask * (0.6 + 0.8 * u_intensity), 0.0, 1.0), 1.5);
  vec3 fc = mix(vec3(0.6, 0.05, 0.0), vec3(1.0, 0.5, 0.05), smoothstep(0.15, 0.55, fire));
  fc = mix(fc, vec3(1.0, 0.95, 0.75), smoothstep(0.55, 0.95, fire));
  col += fc * fire * 2.2;

  // lightning
  if (u_lightning > 0.5){
    for (int b = 0; b < 3; b++){
      float fb = float(b);
      float seg = floor(t * 7.0) + fb * 3.7;
      float bx = 0.2 + 0.3 * fb + 0.08 * sin(seg * 1.7);
      float warp = (fbm(vec2(uv.y * 7.0 + fb * 11.0, seg)) - 0.5) * 0.18 * (0.5 + u_intensity);
      float d = abs(uv.x - (bx + warp));
      float flick = step(0.55, hash(vec2(seg, fb)));
      col += vec3(0.75, 0.85, 1.0) * smoothstep(0.010, 0.0, d) * flick * (1.0 + u_intensity);
      col += vec3(0.35, 0.45, 1.0) * smoothstep(0.06, 0.0, d) * 0.2 * flick;
    }
  }

  // entry flash
  col += vec3(1.0, 0.92, 0.8) * u_flash * 0.6;

  float lum = clamp(max(max(col.r, col.g), col.b), 0.0, 1.0);
  gl_FragColor = vec4(col, clamp(lum + u_flash * 0.5, 0.0, 1.0) * u_alpha);
}`;

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (shader === null) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const compiled: unknown = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (compiled !== true) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function CelebrationOverlay({ celebration, onDone }: CelebrationOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const noop = () => undefined;
    const canvas = canvasRef.current;
    if (canvas === null) {
      return noop;
    }
    const finish = () => doneRef.current();

    const reduce = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduce) {
      // A calm, static ember wash instead of motion — no information is lost.
      canvas.style.background =
        "radial-gradient(120% 80% at 50% 100%, rgba(182,56,36,0.28), transparent 60%)";
      const id = globalThis.setTimeout(finish, 600);
      return () => globalThis.clearTimeout(id);
    }

    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false });
    const vertex = gl === null ? null : compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = gl === null ? null : compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl === null || vertex === null || fragment === null ? null : gl.createProgram();
    if (gl === null || program === null || vertex === null || fragment === null) {
      finish(); // no WebGL (or a compile failure) — degrade to nothing rather than fail
      return noop;
    }

    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    // One oversized triangle covering the clip space.
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const location = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const u = {
      res: gl.getUniformLocation(program, "u_res"),
      time: gl.getUniformLocation(program, "u_time"),
      intensity: gl.getUniformLocation(program, "u_intensity"),
      alpha: gl.getUniformLocation(program, "u_alpha"),
      flash: gl.getUniformLocation(program, "u_flash"),
      lightning: gl.getUniformLocation(program, "u_lightning"),
    };

    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();

    const start = performance.now();
    let raf = 0;
    let last = start;
    let slowFrames = 0;

    const frame = (now: number) => {
      const elapsed = now - start;
      const progress = elapsed / celebration.durationMs;
      if (progress >= 1) {
        finish();
        return;
      }
      // Frame-budget guard: if the device can't keep up, bail rather than jank.
      if (now - last > 45) {
        slowFrames += 1;
        if (slowFrames > 6) {
          finish();
          return;
        }
      } else {
        slowFrames = 0;
      }
      last = now;

      const fadeIn = Math.min(progress / 0.06, 1);
      const fadeOut = Math.min((1 - progress) / 0.35, 1);
      gl.uniform2f(u.res, canvas.width, canvas.height);
      gl.uniform1f(u.time, elapsed / 1000);
      gl.uniform1f(u.intensity, Math.min(celebration.tier / 7, 1));
      gl.uniform1f(u.alpha, fadeIn * fadeOut);
      gl.uniform1f(u.flash, Math.max(0, 1 - elapsed / 220));
      gl.uniform1f(u.lightning, celebration.lightning ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      gl.deleteBuffer(buffer);
    };
  }, [celebration]);

  return (
    <canvas
      aria-hidden="true"
      ref={canvasRef}
      style={{
        height: "100%",
        inset: 0,
        pointerEvents: "none",
        position: "fixed",
        width: "100%",
        zIndex: 40,
      }}
    />
  );
}
