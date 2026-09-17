import { sceneSvg } from './media-art.js'
import { writeFileSync } from 'node:fs'
for (const k of ['gallery-showroom','gallery-warehouse','hero-home']) {
  writeFileSync(`.arttest/${k}.svg`, sceneSvg(k, 1600, 1000))
}
console.log('ok')
