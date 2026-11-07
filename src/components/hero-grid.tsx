import { useEffect, useRef } from 'react'
import { cn } from 'cn'

/*
 * The home hero's backdrop: a design tool's canvas grid laid down as a floor and receding to a
 * horizon. Ink lines with a major line every fourth cell, one redline origin axis (the way 3D
 * tools mark the X axis) and a little drifting dust. Raw WebGL2, no Three.js: it is one shader.
 */

const CAMERA_HEIGHT = 1.55
const PITCH = 0.15 // radians below the horizon
const FOCAL = 1.45
const DRIFT = 0.18 // grid cells per second, toward the viewer
const MAJOR_EVERY = 4
const PARTICLES = 110
const PARTICLE_DEPTH = 34

const fullscreenVertex = /* glsl */ `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

// Shared camera: a ray per pixel, pitched down toward a ground plane at y = 0.
const camera = /* glsl */ `
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uParallax;
uniform float uCenter; // vanishing point's x offset, in uv units
const float HEIGHT = ${CAMERA_HEIGHT.toFixed(3)};
const float PITCH = ${PITCH.toFixed(3)};
const float FOCAL = ${FOCAL.toFixed(3)};
vec3 cameraOrigin() {
  return vec3(uParallax.x * 0.7, HEIGHT + uParallax.y * 0.18, 0.0);
}`

const gridFragment = /* glsl */ `#version 300 es
precision highp float;
${camera}
uniform vec3 uInk;
uniform vec3 uAccent;
uniform float uStrength;
out vec4 outColor;

// 1 on a line, 0 off it; anti-aliased to one device pixel and dropped once lines get denser
// than a pixel, so the far field dissolves instead of shimmering.
float lines(vec2 c) {
  vec2 w = fwidth(c);
  vec2 g = abs(fract(c - 0.5) - 0.5) / w;
  float line = 1.0 - min(min(g.x, g.y), 1.0);
  return line * (1.0 - smoothstep(0.25, 0.8, max(w.x, w.y)));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y - vec2(uCenter, 0.0);
  float s = sin(PITCH), c = cos(PITCH);
  vec3 dir = normalize(vec3(uv.x, uv.y * c - FOCAL * s, uv.y * s + FOCAL * c));
  vec3 ro = cameraOrigin();

  float horizon = FOCAL * tan(PITCH);
  // A faint redline haze sitting on the horizon, the only glow in the scene.
  float haze = exp(-abs(uv.y - horizon) * 26.0) * 0.05;

  if (dir.y >= -0.0005) {
    outColor = vec4(uAccent * haze, haze) * uStrength;
    return;
  }

  float t = -ro.y / dir.y;
  vec2 p = (ro + dir * t).xz;
  vec2 drifting = vec2(p.x, p.y + uTime * ${DRIFT.toFixed(3)});

  float fade = exp(-t * 0.075) * smoothstep(0.0, 0.06, horizon - uv.y);
  float minor = lines(drifting) * 0.16;
  float major = lines(drifting / ${MAJOR_EVERY.toFixed(1)}) * 0.3;
  float ink = max(minor, major) * fade;

  // The origin axis runs to the horizon and does not drift with the grid.
  float axisW = fwidth(p.x);
  float axis = (1.0 - min(abs(p.x) / (axisW * 1.2), 1.0)) * 0.32 * fade;
  axis *= 1.0 - smoothstep(0.25, 0.8, axisW);

  float glow = haze + axis;
  outColor = vec4(uInk * ink + uAccent * glow, ink + glow) * uStrength;
}`

const particleVertex = /* glsl */ `#version 300 es
precision highp float;
${camera}
uniform float uDpr;
in vec4 aSeed; // x, y, z, accent
out float vAlpha;
out float vAccent;

void main() {
  float z = mod(aSeed.z - uTime * ${(DRIFT * 0.8).toFixed(3)}, ${PARTICLE_DEPTH.toFixed(1)}) + 1.0;
  vec3 world = vec3(
    aSeed.x + sin(uTime * 0.13 + aSeed.z) * 0.25,
    aSeed.y + sin(uTime * 0.21 + aSeed.x * 3.0) * 0.12,
    z
  );
  vec3 rel = world - cameraOrigin();
  float s = sin(PITCH), c = cos(PITCH);
  vec3 view = vec3(rel.x, rel.y * c + rel.z * s, -rel.y * s + rel.z * c);
  vec2 uv = FOCAL * view.xy / view.z;
  gl_Position = vec4((uv.x + uCenter) * 2.0 * uRes.y / uRes.x, uv.y * 2.0, 0.0, 1.0);
  gl_PointSize = clamp(5.0 / view.z, 0.6, 2.6) * uDpr * 2.0;
  vAlpha = smoothstep(1.0, 4.0, z) * smoothstep(${PARTICLE_DEPTH.toFixed(1)}, ${(PARTICLE_DEPTH * 0.6).toFixed(1)}, z);
  vAccent = aSeed.w;
}`

const particleFragment = /* glsl */ `#version 300 es
precision highp float;
uniform vec3 uInk;
uniform vec3 uAccent;
uniform float uStrength;
in float vAlpha;
in float vAccent;
out vec4 outColor;

void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.1, d) * vAlpha * mix(0.22, 0.4, vAccent) * uStrength;
  outColor = vec4(mix(uInk, uAccent, vAccent) * a, a);
}`

function compile(gl: WebGL2RenderingContext, vertex: string, fragment: string) {
  const program = gl.createProgram()
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || 'Shader failed to compile')
    }
    gl.attachShader(program, shader)
  }
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? 'Program failed to link')
  }
  return program
}

/** Reads a theme token (always a hex color in styles.css) as linear-ish 0–1 RGB. */
function readColor(name: string): [number, number, number] {
  const hex = getComputedStyle(document.documentElement).getPropertyValue(name).trim().slice(1)
  const full = hex.length === 3 ? [...hex].map((ch) => ch + ch).join('') : hex
  const n = Number.parseInt(full, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export function HeroGrid({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const gl = canvas?.getContext('webgl2', { antialias: false, premultipliedAlpha: true })
    if (!canvas || !gl) return

    let grid: WebGLProgram, dust: WebGLProgram
    try {
      grid = compile(gl, fullscreenVertex, gridFragment)
      dust = compile(gl, particleVertex, particleFragment)
    } catch (error) {
      console.warn('Hero grid disabled:', error)
      return
    }

    const seeds = new Float32Array(PARTICLES * 4)
    for (let i = 0; i < PARTICLES; i++) {
      seeds[i * 4] = (Math.random() - 0.5) * 26
      seeds[i * 4 + 1] = 0.05 + Math.random() ** 1.6 * 2.6
      seeds[i * 4 + 2] = Math.random() * PARTICLE_DEPTH
      seeds[i * 4 + 3] = Math.random() < 0.1 ? 1 : 0
    }
    const vao = gl.createVertexArray()
    const buffer = gl.createBuffer()
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW)
    const seedLoc = gl.getAttribLocation(dust, 'aSeed')
    gl.enableVertexAttribArray(seedLoc)
    gl.vertexAttribPointer(seedLoc, 4, gl.FLOAT, false, 0, 0)

    const uniforms = (program: WebGLProgram) => ({
      res: gl.getUniformLocation(program, 'uRes'),
      time: gl.getUniformLocation(program, 'uTime'),
      parallax: gl.getUniformLocation(program, 'uParallax'),
      ink: gl.getUniformLocation(program, 'uInk'),
      accent: gl.getUniformLocation(program, 'uAccent'),
      strength: gl.getUniformLocation(program, 'uStrength'),
      dpr: gl.getUniformLocation(program, 'uDpr'),
      center: gl.getUniformLocation(program, 'uCenter'),
    })
    const gridU = uniforms(grid)
    const dustU = uniforms(dust)

    let ink = readColor('--ink')
    let accent = readColor('--redline')
    let strength = 1
    const readTheme = () => {
      ink = readColor('--ink')
      accent = readColor('--redline')
      // Light lines on a dark ground read stronger than dark lines on paper.
      strength = document.documentElement.classList.contains('dark') ? 0.8 : 1
    }
    readTheme()
    const themeObserver = new MutationObserver(() => {
      readTheme()
      if (still) draw(performance.now())
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    // Put the vanishing point over the content column, not the viewport (the sidebar sits left).
    let center = 0
    const resize = () => {
      const main = document.querySelector('main')?.getBoundingClientRect()
      center = main
        ? (main.left + main.width / 2 - canvas.clientWidth / 2) / canvas.clientHeight
        : 0
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr))
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr))
      gl.viewport(0, 0, canvas.width, canvas.height)
      if (still) draw(performance.now())
    }
    const resizeObserver = new ResizeObserver(resize)

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let still = motion.matches

    // Pointer parallax, eased so the camera floats after the cursor rather than tracking it.
    const target = { x: 0, y: 0 }
    const parallax = { x: 0, y: 0 }
    const onPointer = (event: PointerEvent) => {
      target.x = (event.clientX / window.innerWidth) * 2 - 1
      target.y = (event.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', onPointer, { passive: true })

    const start = performance.now()
    const draw = (now: number) => {
      const time = still ? 0 : (now - start) / 1000
      if (!still) {
        parallax.x += (target.x - parallax.x) * 0.035
        parallax.y += (target.y - parallax.y) * 0.035
      }
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

      for (const [program, u] of [
        [grid, gridU],
        [dust, dustU],
      ] as const) {
        gl.useProgram(program)
        gl.uniform2f(u.res, canvas.width, canvas.height)
        gl.uniform1f(u.time, time)
        gl.uniform2f(u.parallax, parallax.x, -parallax.y)
        gl.uniform3fv(u.ink, ink)
        gl.uniform3fv(u.accent, accent)
        gl.uniform1f(u.strength, strength)
        gl.uniform1f(u.dpr, dpr)
        gl.uniform1f(u.center, center)
        if (program === grid) gl.drawArrays(gl.TRIANGLES, 0, 3)
        else gl.drawArrays(gl.POINTS, 0, PARTICLES)
      }
    }

    // Only animate while the hero is on screen.
    let frame = 0
    let visible = true
    const loop = (now: number) => {
      draw(now)
      frame = requestAnimationFrame(loop)
    }
    const sync = () => {
      cancelAnimationFrame(frame)
      if (visible && !still) frame = requestAnimationFrame(loop)
      else draw(performance.now())
    }
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true
      sync()
    })
    const onMotion = () => {
      still = motion.matches
      sync()
    }
    motion.addEventListener('change', onMotion)

    resizeObserver.observe(canvas)
    visibility.observe(canvas)
    resize()
    sync()

    return () => {
      cancelAnimationFrame(frame)
      themeObserver.disconnect()
      resizeObserver.disconnect()
      visibility.disconnect()
      motion.removeEventListener('change', onMotion)
      window.removeEventListener('pointermove', onPointer)
      // Free resources rather than losing the context: StrictMode remounts reuse this canvas.
      gl.deleteProgram(grid)
      gl.deleteProgram(dust)
      gl.deleteBuffer(buffer)
      gl.deleteVertexArray(vao)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-0 top-14 -z-10 h-[30rem] w-full',
        // Keep the floor around the headline: fade it out at the edges and well before the list.
        '[mask-image:linear-gradient(to_bottom,black_45%,transparent_92%)]',
        className,
      )}
    />
  )
}
