import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui'
import { publicImage } from '@/server/modules/media/public'
import { CinematicLayer, BackgroundVideo } from '@/components/site/cinematic-layer'
import { numberProp, stringProp, type BlockProps } from './types'

/**
 * The hero.
 *
 * Six layers, stacked and deliberately independent, so that a change to one of
 * them can never reach into another:
 *
 *   1. a flat wash of the picture's own dominant colour, so the band never
 *      flashes white before the media arrives
 *   2. the media itself — image, or image plus video
 *   3. the scrim that makes text legible over it
 *   4. the content
 *   5. the scroll-progress driver, which writes one number and no markup
 *
 * Every decorative layer is `pointer-events-none` and `aria-hidden`. Nothing in
 * the visual system can intercept a click, take focus, or be read aloud; the
 * headline, the buttons and the links are ordinary HTML sitting on top of it.
 *
 * Everything is CMS-controlled — the picture, the crop, the scrim strength, the
 * motion preset, the height. There is no hardcoded photograph and no hardcoded
 * choreography, which is what lets the company change the feel of its own front
 * page without a deployment.
 *
 * Without a picture it degrades to the quiet tinted band it has always been.
 * That fallback is the floor: an unconfigured hero looks like a company that
 * has not uploaded a photograph, not like a broken page.
 */

const HEIGHTS: Record<string, string> = {
  // `svh`, not `vh`: on a phone `100vh` is the viewport with the browser
  // chrome hidden, so a full-height hero is cropped on arrival and grows as you
  // scroll. `svh` is the smallest stable height and never shifts.
  full: 'min-h-[100svh]',
  tall: 'min-h-[78svh]',
  standard: 'min-h-[60svh]',
}

/**
 * Presets configure safe combinations rather than exposing every knob. Each is
 * a defensible pairing of how far the picture drifts and how hard the scrim
 * works, tuned so the text stays comfortably legible at every point.
 */
const PRESETS: Record<
  string,
  { drift: string; scale: string; blur: string; scrim: number }
> = {
  cinematic: { drift: '-6%', scale: '1.08', blur: '10px', scrim: 62 },
  editorial: { drift: '-3%', scale: '1.04', blur: '6px', scrim: 52 },
  minimal: { drift: '-1.5%', scale: '1.02', blur: '3px', scrim: 46 },
  static: { drift: '0%', scale: '1', blur: '0px', scrim: 52 },
}

export async function HeroBlock({ block, locale }: BlockProps) {
  const eyebrow = stringProp(block.props, 'eyebrow')
  const heading = stringProp(block.props, 'heading')
  const body = stringProp(block.props, 'body')
  const primaryLabel = stringProp(block.props, 'primaryCtaLabel')
  const primaryHref = stringProp(block.props, 'primaryCtaHref')
  const secondaryLabel = stringProp(block.props, 'secondaryCtaLabel')
  const secondaryHref = stringProp(block.props, 'secondaryCtaHref')
  const centred = stringProp(block.props, 'align', 'left') === 'center'

  if (!heading) return null

  const visual = stringProp(block.props, 'visual', 'image')
  const presetName = stringProp(block.props, 'preset', 'cinematic')
  const preset = PRESETS[presetName] ?? PRESETS.cinematic!
  const heightClass = HEIGHTS[stringProp(block.props, 'height', 'full')] ?? HEIGHTS.full!
  const videoUrl = stringProp(block.props, 'videoUrl')

  const [image, mobileImage, poster] = await Promise.all([
    publicImage(stringProp(block.props, 'imageId') || null, locale),
    publicImage(stringProp(block.props, 'mobileImageId') || null, locale),
    publicImage(stringProp(block.props, 'posterId') || null, locale),
  ])

  const still = image ?? poster
  const useVideo = visual === 'video' && Boolean(videoUrl)
  const hasVisual = visual !== 'none' && Boolean(still)

  if (!hasVisual)
    return (
      <PlainHero
        {...{
          block,
          eyebrow,
          heading,
          body,
          centred,
          primaryLabel,
          primaryHref,
          secondaryLabel,
          secondaryHref,
        }}
      />
    )

  const focalX = numberProp(block.props, 'focalX', 50)
  const focalY = numberProp(block.props, 'focalY', 50)
  const objectPosition = `${focalX}% ${focalY}%`
  const scrim = numberProp(block.props, 'overlayStrength', preset.scrim) / 100

  const id = `hero-${block.id}`
  const videoId = `${id}-video`

  return (
    <section
      id={block.anchor ?? id}
      className={`hero-cinematic relative isolate flex items-center overflow-hidden ${heightClass}`}
      style={
        {
          '--hero-progress': 0,
          '--hero-drift': preset.drift,
          '--hero-scale': preset.scale,
          '--hero-blur': preset.blur,
          '--hero-scrim': scrim,
        } as React.CSSProperties
      }
    >
      {/* Layer 1 — the colour the picture will resolve to. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-30"
        style={{ backgroundColor: still?.dominantColor ?? 'var(--color-primary-950)' }}
      />

      {/* Layer 2 — the media. Decorative: the headline below carries the
          meaning, so the picture is announced to nobody. */}
      <div
        aria-hidden="true"
        className="hero-media pointer-events-none absolute inset-0 -z-20"
      >
        {still && (
          <>
            <Image
              src={still.url}
              alt=""
              fill
              priority
              sizes="100vw"
              style={{ objectPosition }}
              className={`object-cover ${mobileImage ? 'hidden sm:block' : ''}`}
            />
            {mobileImage && (
              <Image
                src={mobileImage.url}
                alt=""
                fill
                priority
                sizes="100vw"
                style={{ objectPosition: '50% 50%' }}
                className="object-cover sm:hidden"
              />
            )}
          </>
        )}

        {useVideo && (
          <video
            id={videoId}
            muted
            loop
            playsInline
            preload="none"
            poster={still?.url}
            aria-hidden="true"
            tabIndex={-1}
            style={{ objectPosition }}
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-1000 data-[playing=true]:opacity-100"
          />
        )}
      </div>

      {/*
        Layer 3 — the scrim.

        Two gradients, not one flat tint. A uniform overlay would dull the whole
        photograph to rescue a paragraph in one corner of it; these darken the
        side the text is actually on and the bottom edge where the scroll cue
        sits, and leave the rest of the picture alone. That is the difference
        between a photograph with text on it and a photograph behind a grey
        sheet.
      */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 -z-10 ${centred ? 'hero-scrim-centre' : 'hero-scrim-side'}`}
      />
      <div
        aria-hidden="true"
        className="hero-scrim-foot pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-1/3"
      />

      {/* Layer 4 — the content. Never transformed, never blurred, never moved
          while somebody is reading it. */}
      <div
        className={`content-container relative w-full py-24 md:py-28 ${centred ? 'text-center' : ''}`}
      >
        <div className={centred ? 'mx-auto max-w-3xl' : 'max-w-2xl'}>
          {eyebrow && (
            <p className="mb-5 text-sm font-semibold tracking-[0.18em] text-white/80 uppercase">
              {eyebrow}
            </p>
          )}

          {/*
            `text-balance` and no fixed width. Uzbek, Russian, English and
            Chinese set this headline at wildly different lengths, and a layout
            that assumes one of them breaks for the other three.
          */}
          <h1 className="text-4xl leading-[1.04] font-semibold tracking-tight text-balance text-white md:text-6xl lg:text-7xl">
            {heading}
          </h1>

          {body && (
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-white/85 md:text-xl">
              {body}
            </p>
          )}

          {(primaryLabel || secondaryLabel) && (
            <div
              className={`mt-10 flex flex-wrap gap-3 ${centred ? 'justify-center' : ''}`}
            >
              {primaryLabel && primaryHref && (
                <Button asChild size="lg">
                  <Link href={primaryHref}>{primaryLabel}</Link>
                </Button>
              )}
              {secondaryLabel && secondaryHref && (
                <Button asChild size="lg" variant="secondary">
                  <Link href={secondaryHref}>{secondaryLabel}</Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Layer 5 — the driver. Renders nothing. */}
      <CinematicLayer targetId={block.anchor ?? id} />
      {useVideo && <BackgroundVideo videoId={videoId} src={videoUrl} />}
    </section>
  )
}

/** The picture-free hero: a quiet tinted band, unchanged from before. */
function PlainHero({
  block,
  eyebrow,
  heading,
  body,
  centred,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
}: {
  block: BlockProps['block']
  eyebrow: string
  heading: string
  body: string
  centred: boolean
  primaryLabel: string
  primaryHref: string
  secondaryLabel: string
  secondaryHref: string
}) {
  return (
    <section
      id={block.anchor ?? undefined}
      className="from-primary-50 relative overflow-hidden bg-gradient-to-b to-white"
    >
      <div className={`content-container py-20 md:py-28 ${centred ? 'text-center' : ''}`}>
        <div className={centred ? 'mx-auto max-w-3xl' : 'max-w-3xl'}>
          {eyebrow && (
            <p className="text-primary-600 mb-4 text-sm font-semibold tracking-[0.12em] uppercase">
              {eyebrow}
            </p>
          )}
          <h1 className="text-primary-950 text-4xl leading-[1.1] font-semibold text-balance md:text-5xl lg:text-6xl">
            {heading}
          </h1>
          {body && (
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-neutral-600">
              {body}
            </p>
          )}
          {(primaryLabel || secondaryLabel) && (
            <div
              className={`mt-9 flex flex-wrap gap-3 ${centred ? 'justify-center' : ''}`}
            >
              {primaryLabel && primaryHref && (
                <Button asChild size="lg">
                  <Link href={primaryHref}>{primaryLabel}</Link>
                </Button>
              )}
              {secondaryLabel && secondaryHref && (
                <Button asChild size="lg" variant="secondary">
                  <Link href={secondaryHref}>{secondaryLabel}</Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
