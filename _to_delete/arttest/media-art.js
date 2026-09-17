/**
 * Generated artwork for the development seed.
 *
 * The site has nowhere to get photographs from, and the two obvious sources are
 * both wrong: stock photography is somebody else's licensed work, and product
 * shots would belong to manufacturers this fictional catalogue is only
 * pretending to stock. So the seed draws its own — abstract compositions in the
 * site's palette, deterministic per key, so re-seeding produces the same set and
 * a screenshot taken today still matches tomorrow.
 *
 * They are meant to read as *deliberate placeholder art*, never as photographs.
 *
 * Two constraints shape the drawing, both learned the hard way:
 *
 *  - **No SVG filters and no `dominant-baseline`.** Renderers disagree about
 *    both. A blur that silently does nothing turns a soft composition into flat
 *    blocks of colour, and a baseline attribute that is ignored drops a
 *    monogram's letters off the tile. Gradients and arithmetic work everywhere.
 *  - **Nothing figurative.** An early version drew radiating spokes around a
 *    circle to suggest an instrument; on a dental supplier's catalogue it read
 *    as a picture of a virus. Abstract geometry cannot be misread that way.
 */
/** Small, fast, deterministic. Not for anything that needs real randomness. */
function rngFor(key) {
    let h = 2166136261;
    for (let i = 0; i < key.length; i += 1) {
        h ^= key.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    let state = h >>> 0;
    return () => {
        state |= 0;
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
/**
 * Hues come from a narrow band around the brand teal rather than the whole
 * wheel. A rainbow of tiles looks like a demo; a family of related tiles looks
 * like a design.
 */
const HUE_BASE = 194;
const HUE_SPREAD = 40;
/**
 * Colours are emitted as hex, never as `hsl()`.
 *
 * SVG renderers disagree about CSS colour functions — one of them drew every
 * `hsl()` fill as solid black, which is not a bug you notice until the seeded
 * catalogue is full of black circles. Hex is understood by all of them.
 */
function hslHex(h, s, l) {
    const sat = s / 100;
    const lum = l / 100;
    const c = (1 - Math.abs(2 * lum - 1)) * sat;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = lum - c / 2;
    const [r, g, b] = h < 60
        ? [c, x, 0]
        : h < 120
            ? [x, c, 0]
            : h < 180
                ? [0, c, x]
                : h < 240
                    ? [0, x, c]
                    : h < 300
                        ? [x, 0, c]
                        : [c, 0, x];
    return `#${[r, g, b]
        .map((channel) => Math.round((channel + m) * 255)
        .toString(16)
        .padStart(2, '0'))
        .join('')}`;
}
function paletteFor(rng, warm) {
    const hue = Math.round(HUE_BASE + (rng() - 0.5) * HUE_SPREAD);
    const accentHue = warm ? 36 : (hue + 20) % 360;
    return {
        deep: hslHex(hue, 45, 17),
        mid: hslHex(hue, 40, 31),
        light: hslHex(hue, 36, 58),
        accent: hslHex(accentHue, 52, 54),
    };
}
function initials(label) {
    const words = label
        .replace(/[^\p{L}\p{N} ]/gu, ' ')
        .split(/\s+/)
        .filter(Boolean);
    if (words.length === 0)
        return '—';
    if (words.length === 1)
        return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
}
function escapeText(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
const FONT = 'Inter, Helvetica, Arial, sans-serif';
/**
 * A soft blob built from a radial gradient that fades to transparent.
 *
 * This is the filter-free way to get the depth a Gaussian blur would give, and
 * unlike a blur it renders identically everywhere.
 */
function blob(id, cx, cy, r, color, alpha) {
    return {
        def: `<radialGradient id="${id}" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="${color}" stop-opacity="${alpha}"/>
      <stop offset="0.55" stop-color="${color}" stop-opacity="${(alpha * 0.55).toFixed(3)}"/>
      <stop offset="1" stop-color="${color}" stop-opacity="0"/>
    </radialGradient>`,
        shape: `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="url(#${id})"/>`,
    };
}
/**
 * A monogram tile for a brand or partner.
 *
 * Deliberately not a fake logo with a fake wordmark: it is a coloured tile with
 * initials, which is exactly what a directory shows for an organisation that
 * has not supplied a mark. Nobody will mistake it for the real one.
 */
export function monogramSvg(key, label, size = 512) {
    const rng = rngFor(key);
    const palette = paletteFor(rng, rng() > 0.75);
    const radius = Math.round(size * 0.2);
    const fontSize = Math.round(size * 0.34);
    const glow = blob('glow', size * 0.82, size * 0.18, size * 0.5, palette.light, 0.5);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="0.65" y2="1">
      <stop offset="0" stop-color="${palette.mid}"/>
      <stop offset="1" stop-color="${palette.deep}"/>
    </linearGradient>
    ${glow.def}
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#tile)"/>
  ${glow.shape}
  <circle cx="${size / 2}" cy="${size / 2}" r="${(size * 0.36).toFixed(0)}"
          fill="none" stroke="#ffffff" stroke-opacity="0.14" stroke-width="${Math.max(1, size * 0.008).toFixed(1)}"/>
  <text x="${size / 2}" y="${(size / 2 + fontSize * 0.35).toFixed(0)}" text-anchor="middle"
        font-family="${FONT}" font-weight="600" font-size="${fontSize}"
        fill="#ffffff" letter-spacing="${(size * 0.012).toFixed(1)}">${escapeText(initials(label))}</text>
</svg>`;
}
/**
 * A product tile.
 *
 * A pale studio ground with one calm form on it — the way a product is usually
 * shot against seamless paper — plus a thin offset ring for precision and the
 * product's name set small underneath. The proportions come from the key, so
 * two products never look alike and the same product always does.
 */
export function productSvg(key, label, width = 1200, height = 900) {
    const rng = rngFor(key);
    const palette = paletteFor(rng, false);
    const cx = width / 2;
    const cy = height * 0.46;
    const r = Math.min(width, height) * (0.21 + rng() * 0.05);
    const ringOffset = r * (0.12 + rng() * 0.16);
    const ringAngle = rng() * Math.PI * 2;
    const tint = blob('tint', cx, cy, r * 2.4, palette.light, 0.28);
    const caption = escapeText(label.slice(0, 32).toUpperCase());
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#e9eff2"/>
    </linearGradient>
    <linearGradient id="form" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="${palette.mid}"/>
      <stop offset="1" stop-color="${palette.deep}"/>
    </linearGradient>
    <radialGradient id="shadow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="${palette.deep}" stop-opacity="0.22"/>
      <stop offset="1" stop-color="${palette.deep}" stop-opacity="0"/>
    </radialGradient>
    ${tint.def}
  </defs>
  <rect width="${width}" height="${height}" fill="url(#ground)"/>
  ${tint.shape}
  <ellipse cx="${cx}" cy="${(cy + r * 1.22).toFixed(0)}" rx="${(r * 1.45).toFixed(0)}" ry="${(r * 0.2).toFixed(0)}" fill="url(#shadow)"/>
  <circle cx="${(cx + Math.cos(ringAngle) * ringOffset).toFixed(1)}" cy="${(cy + Math.sin(ringAngle) * ringOffset).toFixed(1)}"
          r="${(r * 1.18).toFixed(1)}" fill="none" stroke="${palette.light}" stroke-opacity="0.55"
          stroke-width="${(r * 0.035).toFixed(1)}"/>
  <circle cx="${cx}" cy="${cy.toFixed(0)}" r="${r.toFixed(1)}" fill="url(#form)"/>
  <ellipse cx="${(cx - r * 0.3).toFixed(1)}" cy="${(cy - r * 0.34).toFixed(1)}"
           rx="${(r * 0.34).toFixed(1)}" ry="${(r * 0.24).toFixed(1)}" fill="#ffffff" fill-opacity="0.16"
           transform="rotate(-28 ${(cx - r * 0.3).toFixed(1)} ${(cy - r * 0.34).toFixed(1)})"/>
  <text x="${cx}" y="${(height * 0.9).toFixed(0)}" text-anchor="middle"
        font-family="${FONT}" font-size="${Math.round(height * 0.036)}" font-weight="500"
        fill="${palette.deep}" fill-opacity="0.45" letter-spacing="${(width * 0.004).toFixed(1)}">${caption}</text>
</svg>`;
}
/**
 * A wide scene for a hero, a cover or the photo gallery.
 *
 * Layered soft blobs over a deep gradient: enough depth to carry a headline,
 * abstract enough that it never pretends to be a room.
 */
export function sceneSvg(key, width = 2000, height = 1200) {
    const rng = rngFor(key);
    const palette = paletteFor(rng, rng() > 0.82);
    const defs = [];
    const shapes = [];
    const count = 4 + Math.floor(rng() * 2);
    const colors = [palette.light, palette.accent, palette.mid, palette.light];
    for (let i = 0; i < count; i += 1) {
        const b = blob(`b${i}`, width * (0.08 + rng() * 0.88), height * (0.02 + rng() * 0.96), Math.min(width, height) * (0.32 + rng() * 0.5), colors[i % colors.length], 0.22 + rng() * 0.2);
        defs.push(b.def);
        shapes.push(b.shape);
    }
    // Two hairline arcs, drawn large and mostly off-frame. They give the field
    // enough structure that four gallery tiles read as four pictures rather than
    // four blurs, while staying quiet enough to sit under a headline.
    const arcR = Math.min(width, height) * (0.85 + rng() * 0.5);
    const arcX = width * (0.15 + rng() * 0.7);
    const arcY = height * (rng() > 0.5 ? -0.35 : 1.35);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${palette.deep}"/>
      <stop offset="0.5" stop-color="${palette.mid}"/>
      <stop offset="1" stop-color="${palette.deep}"/>
    </linearGradient>
    ${defs.join('\n    ')}
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  ${shapes.join('\n  ')}
  <circle cx="${arcX.toFixed(0)}" cy="${arcY.toFixed(0)}" r="${arcR.toFixed(0)}"
          fill="none" stroke="#ffffff" stroke-opacity="0.10" stroke-width="${Math.max(1, width * 0.0015).toFixed(1)}"/>
  <circle cx="${arcX.toFixed(0)}" cy="${arcY.toFixed(0)}" r="${(arcR * 0.78).toFixed(0)}"
          fill="none" stroke="#ffffff" stroke-opacity="0.07" stroke-width="${Math.max(1, width * 0.0015).toFixed(1)}"/>
</svg>`;
}
