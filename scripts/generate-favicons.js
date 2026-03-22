// scripts/generate-favicons.js
// Run once to generate all PNG favicons and favicon.ico from public/favicon.svg
// Usage: node scripts/generate-favicons.js

import { Resvg } from '@resvg/resvg-js'
import pngToIco from 'png-to-ico'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const svg = await fs.readFile(path.join(ROOT, 'public/favicon.svg'), 'utf8')

// Generate PNGs at each required size
const sizes = [
  { size: 16, name: 'favicon-16x16.png' },     // intermediate: used for .ico only
  { size: 32, name: 'favicon-32x32.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 192, name: 'favicon-192x192.png' },
  { size: 512, name: 'favicon-512x512.png' },
]

for (const { size, name } of sizes) {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } })
  const png = resvg.render().asPng()
  const outPath = path.join(ROOT, 'public', name)
  await fs.writeFile(outPath, png)
  console.log(`✓ ${name} (${size}×${size})`)
}

// Generate multi-size .ico from 16×16 and 32×32
const ico = await pngToIco([
  path.join(ROOT, 'public/favicon-16x16.png'),
  path.join(ROOT, 'public/favicon-32x32.png'),
])
await fs.writeFile(path.join(ROOT, 'public/favicon.ico'), ico)
console.log('✓ favicon.ico (16×16 + 32×32)')

console.log('\nAll favicon assets generated successfully.')
