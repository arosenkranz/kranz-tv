import type p5 from 'p5'
import type { IntensityLevel } from '../../types'

export interface FlowFieldParams {
  readonly fieldDensity: number
  readonly strokeCount: number
  readonly driftSpeed: number
}

// SCAFFOLD VALUES — user reviews + refines.
export const FLOW_FIELD_INTENSITY: Record<IntensityLevel, FlowFieldParams> = {
  chill:   { fieldDensity: 0.5, strokeCount: 120,  driftSpeed: 0.3 },
  normal:  { fieldDensity: 1.0, strokeCount: 300,  driftSpeed: 0.6 },
  intense: { fieldDensity: 1.7, strokeCount: 600,  driftSpeed: 1.1 },
  max:     { fieldDensity: 2.5, strokeCount: 1000, driftSpeed: 1.8 },
}

interface Agent {
  x: number
  y: number
  hue: number
}

const PSEUDO_BPM = 120
const PULSE_HZ = PSEUDO_BPM / 60

export function makeFlowFieldSketch(
  getParams: () => FlowFieldParams,
  getElapsed: () => number,
) {
  return (p: p5): void => {
    let agents: Agent[] = []

    const seed = (n: number): void => {
      agents = Array.from({ length: n }, () => ({
        x: p.random(p.width),
        y: p.random(p.height),
        hue: p.random(360),
      }))
    }

    p.setup = (): void => {
      p.createCanvas(p.windowWidth, p.windowHeight)
      p.colorMode(p.HSB, 360, 100, 100, 100)
      p.background(263, 80, 8)
      seed(getParams().strokeCount)
    }

    p.draw = (): void => {
      const params = getParams()
      const t = getElapsed()
      if (agents.length !== params.strokeCount) seed(params.strokeCount)
      // Pulse fades the trail less on the beat → blooming pulses.
      const pulse = (Math.sin(t * PULSE_HZ * Math.PI * 2) + 1) * 0.5
      p.noStroke()
      p.fill(263, 80, 8, 6 - pulse * 4)
      p.rect(0, 0, p.width, p.height)
      const scale = 0.0016 * params.fieldDensity
      for (const a of agents) {
        const angle =
          p.noise(a.x * scale, a.y * scale, t * 0.05) * p.TWO_PI * 2
        const spd = params.driftSpeed * 1.6
        const nx = a.x + Math.cos(angle) * spd
        const ny = a.y + Math.sin(angle) * spd
        p.stroke(a.hue, 80, 100, 50)
        p.strokeWeight(1.2)
        p.line(a.x, a.y, nx, ny)
        a.x = (nx + p.width) % p.width
        a.y = (ny + p.height) % p.height
        a.hue = (a.hue + 0.2) % 360
      }
    }

    p.windowResized = (): void => {
      p.resizeCanvas(p.windowWidth, p.windowHeight)
    }
  }
}
