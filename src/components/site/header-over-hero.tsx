'use client'

import { useEffect } from 'react'

/**
 * Makes the header transparent while a hero is behind it.
 *
 * Watched with an IntersectionObserver rather than a scroll threshold, for one
 * practical reason: the hero's height is a CMS setting. A hardcoded "solid
 * after 400px" is right for one configuration and wrong for the other three,
 * and wrong in the worst way — white links on a white page.
 *
 * The default is the solid header. This only ever *removes* the background, and
 * only while it can see a hero, so a page with no hero, a failed observer, or
 * JavaScript that never runs all leave the header exactly as the server sent
 * it. Navigation that depends on a script to stay readable is navigation that
 * eventually is not.
 */
export function HeaderOverHero() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>('.site-header')
    if (!header) return

    const hero = document.querySelector<HTMLElement>('.hero-cinematic')
    if (!hero) return

    const apply = (over: boolean) => {
      header.dataset.overHero = over ? 'true' : 'false'
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        // The switch happens when the hero's last header-height of pixels
        // leaves the top of the screen, so the background arrives exactly as
        // the photograph behind the links runs out.
        apply(Boolean(entry?.isIntersecting))
      },
      { rootMargin: `-${header.offsetHeight}px 0px 0px 0px`, threshold: 0 },
    )

    observer.observe(hero)
    return () => {
      observer.disconnect()
      delete header.dataset.overHero
    }
  }, [])

  return null
}
