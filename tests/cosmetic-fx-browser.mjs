import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium, webkit } from "playwright";

const source = readFileSync("src/components/oni/OniCosmeticFx.tsx", "utf8");
function shader(name) {
  const match = source.match(new RegExp("const " + name + " = `([\\s\\S]*?)`;"));
  assert.ok(match?.[1], `${name} source missing`);
  return match[1];
}
const vertex = shader("VERTEX_SHADER");
const fragment = shader("FRAGMENT_SHADER");

const cases = [
  { name: "red-moon", redMoon: 1, crimson: 0, kishin: 0, entrance: 1 },
  { name: "crimson-frame", redMoon: 0, crimson: 1, kishin: 0, entrance: 1 },
  { name: "kishin-arrival", redMoon: 0, crimson: 0, kishin: 1, entrance: 0.34 },
  { name: "stacked", redMoon: 1, crimson: 1, kishin: 1, entrance: 0.34 },
];

for (const [browserName, launcher] of [
  ["chromium", chromium],
  ["webkit", webkit],
]) {
  const browser = await launcher.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 640 } });
    for (const fxCase of cases) {
      const result = await page.evaluate(
        ({ vertex, fragment, fxCase }) => {
          const canvas = document.createElement("canvas");
          canvas.width = 390;
          canvas.height = 640;
          const gl = canvas.getContext("webgl", {
            alpha: true,
            antialias: false,
            preserveDrawingBuffer: true,
            premultipliedAlpha: true,
          });
          if (!gl) return { ok: false, error: "webgl_unavailable" };
          const compile = (type, source) => {
            const item = gl.createShader(type);
            if (!item) throw new Error("shader_create_failed");
            gl.shaderSource(item, source);
            gl.compileShader(item);
            if (!gl.getShaderParameter(item, gl.COMPILE_STATUS)) {
              throw new Error(gl.getShaderInfoLog(item) || "shader_compile_failed");
            }
            return item;
          };
          try {
            const program = gl.createProgram();
            if (!program) throw new Error("program_create_failed");
            gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
            gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
              throw new Error(gl.getProgramInfoLog(program) || "program_link_failed");
            }
            gl.useProgram(program);
            const buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
              gl.STATIC_DRAW,
            );
            const position = gl.getAttribLocation(program, "a_position");
            gl.enableVertexAttribArray(position);
            gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
            const uniform = (name) => gl.getUniformLocation(program, name);
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.uniform2f(uniform("u_resolution"), canvas.width, canvas.height);
            gl.uniform2f(uniform("u_pointer"), 0.58, 0.46);
            gl.uniform1f(uniform("u_time"), 1.75);
            gl.uniform1f(uniform("u_redMoon"), fxCase.redMoon);
            gl.uniform1f(uniform("u_crimsonFrame"), fxCase.crimson);
            gl.uniform1f(uniform("u_kishin"), fxCase.kishin);
            gl.uniform1f(uniform("u_entrance"), fxCase.entrance);
            gl.uniform1f(uniform("u_intensity"), 1);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            const error = gl.getError();
            if (error !== gl.NO_ERROR) throw new Error(`gl_error_${error}`);
            const pixels = new Uint8Array(canvas.width * canvas.height * 4);
            gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            let alphaPixels = 0;
            let redEnergy = 0;
            let maxAlpha = 0;
            for (let i = 0; i < pixels.length; i += 4) {
              const alpha = pixels[i + 3];
              if (alpha > 2) alphaPixels += 1;
              redEnergy += pixels[i];
              if (alpha > maxAlpha) maxAlpha = alpha;
            }
            return { ok: true, alphaPixels, redEnergy, maxAlpha };
          } catch (error) {
            return { ok: false, error: String(error?.message || error) };
          }
        },
        { vertex, fragment, fxCase },
      );
      assert.equal(result.ok, true, `${browserName}/${fxCase.name}: ${result.error || "render failed"}`);
      assert.ok(result.alphaPixels > 100, `${browserName}/${fxCase.name}: effect rendered too few pixels`);
      assert.ok(result.redEnergy > 5000, `${browserName}/${fxCase.name}: crimson energy missing`);
      assert.ok(result.maxAlpha > 12, `${browserName}/${fxCase.name}: effect alpha is too weak`);
    }
    console.log(`ONI Cosmetic FX WebGL: ${browserName} PASS`);
  } finally {
    await browser.close();
  }
}
