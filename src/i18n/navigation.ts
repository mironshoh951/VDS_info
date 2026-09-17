import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

/**
 * Locale-aware navigation helpers for components.
 *
 * Kept separate from `routing.ts` because `createNavigation` reaches into the
 * server request configuration, which pulls in the database layer — not
 * something the edge middleware can or should load.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)
