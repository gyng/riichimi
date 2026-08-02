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
  vec2 c = uv - 0.5; c.x *= u_res.x / u_res.y;   // centred, aspect-corrected
  float r = length(c);
  float ang = atan(c.y, c.x);
  float t = u_time;
  vec3 col = vec3(0.0);

  // fire aura radiating from the centre — the kanji burns from within
  float fl = fbm(vec2(ang * 3.0 + fbm(c * 4.0) * 1.2, r * 4.0 - t * 2.0));
  float ring = smoothstep(0.02, 0.32, r) * smoothstep(1.05, 0.32, r);
  float fire = pow(clamp(fl * ring * (0.7 + 0.7 * u_intensity), 0.0, 1.0), 1.4);
  vec3 fc = mix(vec3(0.6, 0.05, 0.0), vec3(1.0, 0.5, 0.05), smoothstep(0.15, 0.55, fire));
  fc = mix(fc, vec3(1.0, 0.95, 0.75), smoothstep(0.55, 0.95, fire));
  col += fc * fire * 2.3;

  // lightning striking outward from the centre
  if (u_lightning > 0.5){
    for (int k = 0; k < 3; k++){
      float fk = float(k);
      float seg = floor(t * 7.0) + fk * 3.7;
      float baseAng = fk * 2.094 + seg * 0.25;
      float jit = (fbm(vec2(r * 9.0, seg + fk * 5.0)) - 0.5) * 0.6;
      float da = ang - baseAng - jit; da = atan(sin(da), cos(da));
      float w = 0.04 / max(r, 0.06);
      float reach = smoothstep(1.0, 0.12, r) * step(0.08, r);
      float flick = step(0.5, hash(vec2(seg, fk)));
      col += vec3(0.75, 0.85, 1.0) * smoothstep(w, 0.0, abs(da)) * reach * flick * (1.0 + u_intensity);
      col += vec3(0.4, 0.5, 1.0) * smoothstep(w * 3.0, 0.0, abs(da)) * reach * 0.25 * flick;
    }
  }

  // entry flash bursting from the centre
  float centreFlash = u_flash * smoothstep(0.85, 0.0, r);
  col += vec3(1.0, 0.92, 0.8) * centreFlash * 1.2;

  float lum = clamp(max(max(col.r, col.g), col.b), 0.0, 1.0);
  gl_FragColor = vec4(col, clamp(lum + centreFlash * 0.5, 0.0, 1.0) * u_alpha);
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

/**
 * How large a buffer the fire is drawn into.
 *
 * The shader colours every pixel every frame, so its cost is the buffer's area
 * and nothing else. At native resolution a 1512×900 window on a 2× display is
 * 5.4 million fragments a frame — eight times a phone's — which is how a desk
 * ended up with a celebration that gave up after half a second while the same
 * build ran it in full on a phone. A soft fire loses nothing by being drawn
 * smaller and scaled up, so the buffer is capped and the pixels are spent where
 * they show.
 */
export function drawingBufferSize(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
): { readonly height: number; readonly width: number } {
  const BUDGET = 1_400_000;
  const wanted = cssWidth * cssHeight * devicePixelRatio * devicePixelRatio;
  const scale = wanted > BUDGET ? Math.sqrt(BUDGET / wanted) : 1;
  return {
    height: Math.max(1, Math.floor(cssHeight * devicePixelRatio * scale)),
    width: Math.max(1, Math.floor(cssWidth * devicePixelRatio * scale)),
  };
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
      const { height, width } = drawingBufferSize(canvas.clientWidth, canvas.clientHeight, dpr);
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    };
    resize();

    const start = performance.now();
    let raf = 0;
    let last = start;
    let slowFrames = 0;
    let degraded = false;

    const frame = (now: number) => {
      const elapsed = now - start;
      const progress = elapsed / celebration.durationMs;
      if (progress >= 1) {
        finish();
        return;
      }
      // Frame-budget guard. Dropping the fire is the right answer on a device
      // that cannot draw it, but this used to end the whole celebration — the
      // stamp naming the hand went with it, which is the part actually worth
      // seeing. Now only the shader stops, and the stamp plays out its time.
      if (!degraded && now - last > 45) {
        slowFrames += 1;
        if (slowFrames > 6) {
          degraded = true;
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
        }
      } else if (!degraded) {
        slowFrames = 0;
      }
      last = now;

      if (degraded) {
        raf = requestAnimationFrame(frame);
        return;
      }

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
