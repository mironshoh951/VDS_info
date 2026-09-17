'use client'

import { useEffect } from 'react'

/**
 * The scroll choreography for the hero, and nothing else.
 *
 * It owns exactly one number: how far through the hero the visitor has
 * scrolled, 0 to 1, written to the hero element as `--hero-progress`. Every
 * visual consequence — drift, scale, blur, scrim — is CSS reading that
 * variable. Keeping the arithmetic here and the appearance in the stylesheet is
 * what stops animation logic from spreading through unrelated components.
 *
 * What it deliberately does not do is as important:
 *
 *  - **It never touches scrolling.** No wheel handlers, no snapping, no
 *    `scroll-behavior` overrides. The hero is ordinary document flow; the page
 *    scrolls the way the browser scrolls. A visitor who feels held in place by
 *    a hero leaves.
 *  - **It never moves the content.** Only the decorative media layer is
 *    transformed. Text that slides while you are reading it is not cinematic,
 *    it is annoying — and a moving CTA is a CTA you miss.
 *  - **It stops when the hero leaves.** An IntersectionObserver gates the
 *    scroll listener, so a visitor reading the catalogue three screens down is
 *    not paying for a frame loop they cannot see.
 *
 * Reads go through `requestAnimationFrame` and the listener is passive, so the
 * work lands once per frame at most and never blocks the scroll thread.
 */
export function CinematicLayer({ targetId }: { targetId: string }) {
  useEffect(() => {
    // The pending-frame handle is a local, not a ref, and that is deliberate.
    // Held in a ref it survives the effect's cleanup, and React remounts every
    // effect once in development — so the second mount would find a handle left
    // over from the first, conclude a frame was already scheduled, and never
    // schedule another. The hero would simply stop responding to scroll, with
    // no error anywhere. Scoping it to the effect makes that impossible.
    let frame: number | null = null

    const element = document.getElementById(targetId)
    if (!element) return

    // Motion is a preference, not a default. With it off the hero stays exactly
    // as it first painted — still a photograph, still beautiful, simply still.
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    /**
     * A device hint, not a device sniff. A phone on a metered connection with
     * Data Saver on has told us plainly that it would rather have the page than
     * the performance; a 2-core machine will drop frames on a blur.
     */
    const isConstrained = () => {
      const nav = navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string }
        deviceMemory?: number
      }
      if (nav.connection?.saveData) return true
      if (nav.connection?.effectiveType && /2g/.test(nav.connection.effectiveType))
        return true
      if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2) return true
      return (navigator.hardwareConcurrency ?? 8) <= 2
    }

    const enabled = () => !motionQuery.matches && !isConstrained()

    let visible = true
    let last = -1

    const measure = () => {
      frame = null
      const height = element.offsetHeight || 1
      // Clamped, and measured against the hero's own height rather than the
      // viewport: a "standard" hero and a full-screen one should complete their
      // transition at the same point in their own lifetime.
      const raw = window.scrollY / height
      const progress = raw < 0 ? 0 : raw > 1 ? 1 : raw

      // Two decimal places. The eye cannot see more, and rounding keeps the
      // browser from invalidating styles on sub-pixel scroll noise.
      const rounded = Math.round(progress * 100) / 100
      if (rounded === last) return
      last = rounded
      element.style.setProperty('--hero-progress', String(rounded))
    }

    const schedule = () => {
      if (!visible || frame !== null) return
      frame = requestAnimationFrame(measure)
    }

    const apply = () => {
      if (enabled()) {
        element.dataset.motion = 'on'
        schedule()
      } else {
        element.dataset.motion = 'off'
        element.style.setProperty('--hero-progress', '0')
      }
    }

    // Once the hero is off screen its progress is pinned at 1 and the listener
    // stops doing anything.
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? false
        if (visible) schedule()
      },
      { rootMargin: '10% 0px' },
    )
    observer.observe(element)

    apply()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    motionQuery.addEventListener('change', apply)

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      motionQuery.removeEventListener('change', apply)
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [targetId])

  return null
}

/**
 * Background video, attached only when it is worth attaching.
 *
 * The markup ships without a `src`, so the browser fetches nothing until this
 * decides it should. A hero that blocks first paint on a 12 MB file is not a
 * premium experience whatever it looks like once it arrives — and on a phone on
 * mobile data it is a cost the visitor did not agree to.
 *
 * The poster image is the real hero. The video is an upgrade that either
 * arrives or does not; either way the page is complete.
 */
export function BackgroundVideo({ videoId, src }: { videoId: string; src: string }) {
  useEffect(() => {
    const video = document.getElementById(videoId)
    if (!(video instanceof HTMLVideoElement)) return

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (motionQuery.matches) return

    const nav = navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string }
    }
    if (nav.connection?.saveData) return
    if (
      nav.connection?.effectiveType &&
      /(^|\W)(2g|slow-2g|3g)/.test(nav.connection.effectiveType)
    ) {
      return
    }

    // Only once there are actual frames to show. Fading in on `loadeddata`
    // rather than on `play()` avoids the flash of a blank video element over a
    // perfectly good poster.
    const reveal = () => {
      video.dataset.playing = 'true'
    }
    const hide = () => {
      delete video.dataset.playing
    }

    video.addEventListener('playing', reveal)
    video.addEventListener('error', hide)
    video.addEventListener('stalled', hide)

    video.src = src
    video.load()

    // Autoplay is a request, not a guarantee. When the browser refuses, the
    // poster simply stays — which is the same thing the page would have shown
    // anyway, so there is nothing to handle beyond not throwing.
    void video.play().catch(() => {})

    return () => {
      video.removeEventListener('playing', reveal)
      video.removeEventListener('error', hide)
      video.removeEventListener('stalled', hide)
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  }, [videoId, src])

  return null
}
