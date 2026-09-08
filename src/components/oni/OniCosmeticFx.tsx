import { useEffect, useRef, useState, type ReactNode } from "react";
import { resolveOniFx } from "@/lib/cosmetics/oni-fx-presets";
import "./OniCosmeticFx.css";

const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;
uniform vec2 u_resolution;
uniform vec2 u_pointer;
uniform float u_time;
uniform float u_redMoon;
uniform float u_crimsonFrame;
uniform float u_garageNeon;
uniform float u_kitsune;
uniform float u_nightRider;
uniform float u_kishin;
uniform float u_creatorMoon;
uniform float u_trophyVault;
uniform float u_entrance;
uniform float u_intensity;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.52;
  mat2 turn = mat2(0.80, -0.60, 0.60, 0.80);
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise2(p);
    p = turn * p * 2.03 + 17.1;
    amplitude *= 0.5;
  }
  return value;
}

float pulse(float x, float center, float width) {
  float z = (x - center) / width;
  return exp(-z * z);
}

float softOrb(vec2 p, vec2 center, float radius) {
  return exp(-length(p - center) * radius);
}

void main() {
  vec2 safeResolution = max(u_resolution, vec2(1.0));
  vec2 uv = gl_FragCoord.xy / safeResolution;
  float aspect = safeResolution.x / safeResolution.y;
  vec2 p = uv - 0.5;
  p.x *= aspect;
  vec2 pointer = (u_pointer - 0.5) * 2.0;

  vec3 color = vec3(0.0);
  float alpha = 0.0;

  if (u_redMoon > 0.5) {
    vec2 center = vec2(0.72 + pointer.x * 0.018, 0.70 + pointer.y * 0.012);
    vec2 moonUv = uv - center;
    moonUv.x *= aspect;
    float moonDistance = length(moonUv);
    float disc = 1.0 - smoothstep(0.205, 0.222, moonDistance);
    float lunar = 0.58 + 0.42 * fbm(moonUv * 13.0 + vec2(u_time * 0.014, -u_time * 0.009));
    float crater = smoothstep(0.34, 0.88, fbm(moonUv * 28.0 - 7.0));
    vec3 moonColor = vec3(0.48, 0.006, 0.014) * (0.68 + 0.55 * lunar)
      - vec3(0.12, 0.0, 0.0) * crater;
    color += moonColor * disc * 1.15;
    alpha = max(alpha, disc * (0.44 + 0.22 * lunar));

    float halo = exp(-moonDistance * 8.6) * (1.0 - disc * 0.4);
    color += vec3(0.42, 0.006, 0.018) * halo * 0.75;
    alpha = max(alpha, halo * 0.22);

    float fog = fbm(
      vec2(p.x * 1.8 + u_time * 0.025, p.y * 2.4 - u_time * 0.018) + pointer * 0.12
    );
    fog *= smoothstep(0.18, 0.92, fog) * smoothstep(0.04, 0.62, uv.y);
    color += vec3(0.13, 0.004, 0.012) * fog * 0.58;
    alpha = max(alpha, fog * 0.19);

    vec2 drift = uv;
    drift.y += u_time * 0.045;
    vec2 cells = vec2(10.0, 17.0);
    vec2 cellId = floor(drift * cells);
    vec2 cellUv = fract(drift * cells) - 0.5;
    float random = hash21(cellId);
    cellUv.x += (random - 0.5) * 0.64;
    float ember = (1.0 - smoothstep(0.0, 0.078, length(cellUv))) * step(0.76, random);
    ember *= 0.45 + 0.55 * hash21(cellId + 9.2);
    color += vec3(1.0, 0.11, 0.025) * ember * 0.9;
    alpha = max(alpha, ember * 0.68);
  }

  if (u_crimsonFrame > 0.5) {
    float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    float organicNoise = fbm(
      uv * vec2(8.0, 11.0) + vec2(u_time * 0.045, -u_time * 0.031)
    );
    float molten = 1.0 - smoothstep(0.010, 0.062 + organicNoise * 0.026, edge);
    float hot = pow(clamp(molten, 0.0, 1.0), 2.7);
    float breathe = 0.82 + 0.18 * sin(u_time * 1.35 + organicNoise * 6.2831);
    color += vec3(0.56, 0.008, 0.018) * molten * breathe
      + vec3(1.0, 0.18, 0.055) * hot * 0.32;
    alpha = max(alpha, molten * (0.28 + 0.36 * hot));
  }

  if (u_garageNeon > 0.5) {
    float haze = fbm(
      vec2(p.x * 2.7 - u_time * 0.032, p.y * 2.0 + u_time * 0.018) + pointer * 0.08
    );
    float leftPool = exp(-pow((p.x + 0.34) * 4.8, 2.0)) * (0.38 + 0.62 * haze);
    float rightPool = exp(-pow((p.x - 0.34) * 4.8, 2.0)) * (0.38 + 0.62 * (1.0 - haze));
    float floorBloom = exp(-abs(p.y + 0.36) * 8.5) * (0.5 + 0.5 * haze);
    float roofMist = smoothstep(0.12, 0.88, haze) * smoothstep(-0.45, 0.38, p.y);
    color += vec3(0.012, 0.30, 0.42) * leftPool * 0.72;
    color += vec3(0.46, 0.018, 0.24) * rightPool * 0.64;
    color += vec3(0.08, 0.34, 0.40) * floorBloom * 0.42;
    color += vec3(0.16, 0.04, 0.18) * roofMist * 0.20;
    alpha = max(alpha, (leftPool + rightPool) * 0.17 + floorBloom * 0.20 + roofMist * 0.08);
  }

  if (u_kitsune > 0.5) {
    float phase = u_time * 0.72;
    vec2 centerA = vec2(-0.22 + sin(phase) * 0.08, 0.04 + cos(phase * 1.2) * 0.08);
    vec2 centerB = vec2(0.24 + cos(phase * 0.9) * 0.09, -0.06 + sin(phase * 1.4) * 0.07);
    vec2 centerC = vec2(0.02 + sin(phase * 1.25) * 0.13, 0.24 + cos(phase) * 0.05);
    float fireA = softOrb(p, centerA, 11.0);
    float fireB = softOrb(p, centerB, 12.0);
    float fireC = softOrb(p, centerC, 13.0);
    float spiritNoise = fbm(p * 5.2 + vec2(phase * 0.35, -phase * 0.24));
    float tails = exp(-abs(length(p * vec2(0.8, 1.2)) - 0.31) * 13.0);
    tails *= 0.42 + 0.58 * spiritNoise;
    float crown = softOrb(p, vec2(pointer.x * 0.025, 0.23 + pointer.y * 0.015), 5.8);
    color += vec3(1.0, 0.26, 0.035) * (fireA + fireC * 0.8) * 0.72;
    color += vec3(0.92, 0.045, 0.28) * fireB * 0.65;
    color += vec3(0.56, 0.06, 0.42) * tails * 0.25;
    color += vec3(1.0, 0.36, 0.08) * crown * spiritNoise * 0.18;
    alpha = max(alpha, (fireA + fireB + fireC) * 0.24 + tails * 0.12 + crown * 0.06);
  }

  if (u_nightRider > 0.5) {
    float nightNoise = fbm(vec2(p.x * 4.2 - u_time * 0.26, p.y * 2.1));
    float midnightVeil = smoothstep(0.28, 0.88, nightNoise) * exp(-length(p) * 1.65);
    float roadBloom = exp(-abs(p.y + 0.22) * 7.5) * exp(-abs(p.x) * 1.6);
    float angle = atan(p.y + 0.16, p.x);
    float radialWake = pow(0.5 + 0.5 * sin(angle * 7.0 - u_time * 2.0), 8.0);
    radialWake *= smoothstep(0.12, 0.68, length(p)) * exp(-length(p) * 2.5);
    color += vec3(0.025, 0.04, 0.22) * midnightVeil * 0.92;
    color += vec3(0.08, 0.11, 0.52) * roadBloom * 0.50;
    color += vec3(0.30, 0.035, 0.48) * radialWake * 0.40;
    alpha = max(alpha, midnightVeil * 0.20 + roadBloom * 0.16 + radialWake * 0.12);
  }

  if (u_kishin > 0.5) {
    float entrance = clamp(u_entrance, 0.0, 1.0);
    float flash = pulse(entrance, 0.16, 0.035);
    float impact = pulse(entrance, 0.34, 0.065);
    float wake = 1.0 - smoothstep(0.55, 1.0, entrance);
    float radial = exp(-length(p - vec2(pointer.x * 0.02, pointer.y * 0.01)) * 3.7);
    float smoke = fbm(p * 3.1 + vec2(-u_time * 0.07, u_time * 0.04));
    smoke = smoothstep(0.38, 0.86, smoke) * wake;
    color += vec3(0.86, 0.01, 0.025) * (flash * 0.88 + impact * radial * 0.85 + smoke * 0.22);
    alpha = max(alpha, flash * 0.48 + impact * radial * 0.32 + smoke * 0.12);
  }

  if (u_creatorMoon > 0.5) {
    vec2 creatorCenter = vec2(0.26 + pointer.x * 0.015, 0.72 + pointer.y * 0.012);
    vec2 creatorUv = uv - creatorCenter;
    creatorUv.x *= aspect;
    float creatorDistance = length(creatorUv);
    float creatorDisc = 1.0 - smoothstep(0.135, 0.155, creatorDistance);
    float creatorTexture = fbm(creatorUv * 20.0 + vec2(-u_time * 0.01, u_time * 0.008));
    float cinematicFog = fbm(
      vec2(p.x * 1.7 + u_time * 0.019, p.y * 2.2 - u_time * 0.012) + 4.2
    );
    cinematicFog = smoothstep(0.36, 0.78, cinematicFog);
    float vignette = smoothstep(0.92, 0.18, length(p * vec2(0.82, 1.0)));
    float rim = exp(-abs(creatorDistance - 0.15) * 36.0);
    color += vec3(0.62, 0.018, 0.035) * creatorDisc * (0.62 + creatorTexture * 0.55);
    color += vec3(0.78, 0.04, 0.075) * rim * 0.32;
    color += vec3(0.20, 0.006, 0.028) * cinematicFog * vignette * 0.42;
    color += vec3(0.08, 0.012, 0.03) * vignette * 0.20;
    alpha = max(alpha, creatorDisc * 0.45 + rim * 0.18 + cinematicFog * vignette * 0.15);
  }

  if (u_trophyVault > 0.5) {
    vec2 glitterUv = uv + vec2(u_time * 0.018, -u_time * 0.028);
    vec2 glitterCells = vec2(8.0, 13.0);
    vec2 glitterId = floor(glitterUv * glitterCells);
    vec2 glitterLocal = fract(glitterUv * glitterCells) - 0.5;
    float glitterRandom = hash21(glitterId + 31.7);
    glitterLocal += vec2(glitterRandom - 0.5, hash21(glitterId + 7.4) - 0.5) * 0.42;
    float sparkle = exp(-length(glitterLocal) * 27.0) * step(0.72, glitterRandom);
    float goldMist = fbm(p * 4.4 + vec2(u_time * 0.04, -u_time * 0.025));
    goldMist = smoothstep(0.52, 0.88, goldMist) * exp(-length(p) * 1.7);
    float medalGlow = softOrb(p, vec2(0.0, -0.02), 4.7);
    color += vec3(1.0, 0.52, 0.08) * sparkle * 0.95;
    color += vec3(0.72, 0.28, 0.035) * goldMist * 0.28;
    color += vec3(1.0, 0.68, 0.18) * medalGlow * 0.11;
    alpha = max(alpha, sparkle * 0.70 + goldMist * 0.11 + medalGlow * 0.05);
  }

  color *= u_intensity;
  alpha = clamp(alpha * u_intensity, 0.0, 0.92);
  color *= alpha;
  gl_FragColor = vec4(color, alpha);
}
`;

type OniCosmeticFxProps = {
  effectIds: readonly string[];
  children: ReactNode;
  className?: string;
  entranceKey?: string;
  preview?: boolean;
  ambient?: boolean;
};

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("shader_create_failed");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "shader_compile_failed";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) throw new Error("program_create_failed");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? "program_link_failed";
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

export function OniCosmeticFx({
  effectIds,
  children,
  className = "",
  entranceKey = "",
  preview = false,
  ambient = false,
}: OniCosmeticFxProps) {
  const fx = resolveOniFx(effectIds);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const shell = shellRef.current;
    const canvas = canvasRef.current;
    if (!shell || !canvas || !fx.active) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lowPowerDevice = (navigator.hardwareConcurrency ?? 8) <= 4;
    const dprCap = preview
      ? 1.15
      : ambient
        ? 1.35
        : lowPowerDevice
          ? 1.25
          : window.innerWidth < 768
            ? 1.5
            : 1.8;
    const targetFps = reducedMotion ? 1 : preview ? 24 : ambient ? 30 : lowPowerDevice ? 30 : 60;
    let gl: WebGLRenderingContext | null = null;
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    let frameId = 0;
    let visible = true;
    let pageVisible = document.visibilityState === "visible";
    let lastFrame = 0;
    let start = performance.now();
    let pointerX = 0.5;
    let pointerY = 0.5;

    try {
      gl = canvas.getContext("webgl", {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: true,
        powerPreference: preview || ambient ? "low-power" : "high-performance",
      });
      if (!gl) throw new Error("webgl_unavailable");
      program = createProgram(gl);
      gl.useProgram(program);
      gl.disable(gl.DEPTH_TEST);

      buffer = gl.createBuffer();
      if (!buffer) throw new Error("buffer_create_failed");
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
      );
      const position = gl.getAttribLocation(program, "a_position");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      const uniforms = {
        resolution: gl.getUniformLocation(program, "u_resolution"),
        pointer: gl.getUniformLocation(program, "u_pointer"),
        time: gl.getUniformLocation(program, "u_time"),
        redMoon: gl.getUniformLocation(program, "u_redMoon"),
        crimsonFrame: gl.getUniformLocation(program, "u_crimsonFrame"),
        garageNeon: gl.getUniformLocation(program, "u_garageNeon"),
        kitsune: gl.getUniformLocation(program, "u_kitsune"),
        nightRider: gl.getUniformLocation(program, "u_nightRider"),
        kishin: gl.getUniformLocation(program, "u_kishin"),
        creatorMoon: gl.getUniformLocation(program, "u_creatorMoon"),
        trophyVault: gl.getUniformLocation(program, "u_trophyVault"),
        entrance: gl.getUniformLocation(program, "u_entrance"),
        intensity: gl.getUniformLocation(program, "u_intensity"),
      };

      const resize = () => {
        if (!gl) return;
        const rect = shell.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
        const width = Math.max(1, Math.round(rect.width * dpr));
        const height = Math.max(1, Math.round(rect.height * dpr));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
          gl.viewport(0, 0, width, height);
        }
      };

      const render = (now: number) => {
        if (!gl || !program) return;
        frameId = window.requestAnimationFrame(render);
        if (!visible || !pageVisible) return;
        const frameInterval = 1000 / targetFps;
        if (now - lastFrame < frameInterval) return;
        lastFrame = now;
        resize();
        const elapsed = Math.max(0, now - start);
        const entrance = fx.kishinArrival
          ? reducedMotion
            ? 1
            : Math.min(1, elapsed / Math.max(1, fx.entranceMs))
          : 1;
        const surfaceIntensity = reducedMotion
          ? Math.min(0.82, fx.intensity)
          : ambient
            ? fx.intensity * 0.68
            : fx.intensity;

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
        gl.uniform2f(uniforms.pointer, pointerX, pointerY);
        gl.uniform1f(uniforms.time, elapsed / 1000);
        gl.uniform1f(uniforms.redMoon, fx.redMoon ? 1 : 0);
        gl.uniform1f(uniforms.crimsonFrame, fx.crimsonFrame ? 1 : 0);
        gl.uniform1f(uniforms.garageNeon, fx.garageNeon ? 1 : 0);
        gl.uniform1f(uniforms.kitsune, fx.kitsune ? 1 : 0);
        gl.uniform1f(uniforms.nightRider, fx.nightRider ? 1 : 0);
        gl.uniform1f(uniforms.kishin, fx.kishinArrival ? 1 : 0);
        gl.uniform1f(uniforms.creatorMoon, fx.creatorMoon ? 1 : 0);
        gl.uniform1f(uniforms.trophyVault, fx.trophyVault ? 1 : 0);
        gl.uniform1f(uniforms.entrance, entrance);
        gl.uniform1f(uniforms.intensity, surfaceIntensity);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        if (reducedMotion) window.cancelAnimationFrame(frameId);
      };

      const onPointerMove = (event: PointerEvent) => {
        const rect = shell.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        pointerX = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
        pointerY = 1 - Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
      };
      const onPointerLeave = () => {
        pointerX = 0.5;
        pointerY = 0.5;
      };
      const onVisibility = () => {
        pageVisible = document.visibilityState === "visible";
      };
      const onContextLost = (event: Event) => {
        event.preventDefault();
        setFallback(true);
      };

      shell.addEventListener("pointermove", onPointerMove, { passive: true });
      shell.addEventListener("pointerleave", onPointerLeave, { passive: true });
      document.addEventListener("visibilitychange", onVisibility);
      canvas.addEventListener("webglcontextlost", onContextLost);

      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(shell);
      const intersectionObserver = new IntersectionObserver(
        ([entry]) => {
          visible = Boolean(entry?.isIntersecting);
        },
        { threshold: 0.01 },
      );
      intersectionObserver.observe(shell);

      start = performance.now();
      resize();
      frameId = window.requestAnimationFrame(render);
      setFallback(false);

      return () => {
        window.cancelAnimationFrame(frameId);
        resizeObserver.disconnect();
        intersectionObserver.disconnect();
        shell.removeEventListener("pointermove", onPointerMove);
        shell.removeEventListener("pointerleave", onPointerLeave);
        document.removeEventListener("visibilitychange", onVisibility);
        canvas.removeEventListener("webglcontextlost", onContextLost);
        if (gl && buffer) gl.deleteBuffer(buffer);
        if (gl && program) gl.deleteProgram(program);
      };
    } catch {
      setFallback(true);
      return;
    }
  }, [
    ambient,
    entranceKey,
    fx.active,
    fx.creatorMoon,
    fx.crimsonFrame,
    fx.entranceMs,
    fx.garageNeon,
    fx.intensity,
    fx.kishinArrival,
    fx.kitsune,
    fx.nightRider,
    fx.redMoon,
    fx.trophyVault,
    preview,
  ]);

  return (
    <div
      ref={shellRef}
      className={`oni-fx-shell ${className}`.trim()}
      data-fallback={fallback ? "true" : "false"}
      data-red-moon={fx.redMoon ? "true" : "false"}
      data-crimson-frame={fx.crimsonFrame ? "true" : "false"}
      data-garage-neon={fx.garageNeon ? "true" : "false"}
      data-kitsune={fx.kitsune ? "true" : "false"}
      data-night-rider={fx.nightRider ? "true" : "false"}
      data-kishin={fx.kishinArrival ? "true" : "false"}
      data-creator-moon={fx.creatorMoon ? "true" : "false"}
      data-trophy-vault={fx.trophyVault ? "true" : "false"}
    >
      <div className="oni-fx-atmosphere" aria-hidden="true" />
      {fx.active ? <canvas ref={canvasRef} className="oni-fx-canvas" aria-hidden="true" /> : null}
      <div className="oni-fx-surface">{children}</div>
    </div>
  );
}
