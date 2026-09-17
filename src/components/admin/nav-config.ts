import type { Capability } from '@/server/auth/capabilities'

/**
 * Administration navigation.
 *
 * Unlike the public site's menus, this structure is application architecture
 * rather than business content, so it lives in code. Each item declares the
 * capability required to see it — a Viewer simply does not render sections
 * they cannot use, while the server still enforces the same rule on every
 * page and endpoint.
 */

export interface NavItem {
  href: string
  /** Key under the `admin.nav` namespace; the sidebar translates it. */
  key: string
  capability: Capability
  /** Lucide icon name, resolved by the sidebar. */
  icon: string
  badge?: 'inquiries'
  /**
   * The screen is not written yet. The item still appears — hiding planned
   * work makes the panel look finished when it is not — but it is rendered
   * inert rather than as a link that 404s.
   */
  planned?: boolean
}

export interface NavSection {
  /** Key under the `admin.sections` namespace. */
  key: string
  items: NavItem[]
}

export const ADMIN_NAV: NavSection[] = [
  {
    key: 'overview',
    items: [
      {
        href: '/admin/dashboard',
        key: 'dashboard',
        capability: 'content.read',
        icon: 'LayoutDashboard',
      },
      {
        href: '/admin/inquiries',
        key: 'inquiries',
        capability: 'inquiry.read',
        icon: 'Inbox',
        badge: 'inquiries',
      },
    ],
  },
  {
    key: 'catalogue',
    items: [
      {
        href: '/admin/products',
        key: 'products',
        capability: 'content.read',
        icon: 'Package',
      },
      {
        href: '/admin/categories',
        key: 'categories',
        capability: 'content.read',
        icon: 'FolderTree',
      },
      { href: '/admin/brands', key: 'brands', capability: 'content.read', icon: 'Tag' },
      {
        href: '/admin/partners',
        key: 'partners',
        capability: 'content.read',
        icon: 'Handshake',
      },
    ],
  },
  {
    key: 'content',
    items: [
      {
        href: '/admin/pages',
        key: 'pages',
        capability: 'content.read',
        icon: 'FileText',
      },
      { href: '/admin/menus', key: 'menus', capability: 'menu.read', icon: 'Menu' },
      {
        href: '/admin/services',
        key: 'services',
        capability: 'content.read',
        icon: 'Wrench',
      },
      {
        href: '/admin/events',
        key: 'events',
        capability: 'content.read',
        icon: 'CalendarDays',
      },
      {
        href: '/admin/news',
        key: 'news',
        capability: 'content.read',
        icon: 'Newspaper',
      },
      {
        href: '/admin/resources',
        key: 'resources',
        capability: 'content.read',
        icon: 'FolderOpen',
      },
      {
        href: '/admin/certificates',
        key: 'certificates',
        capability: 'content.read',
        icon: 'ShieldCheck',
      },
      {
        href: '/admin/achievements',
        key: 'achievements',
        capability: 'content.read',
        icon: 'Award',
      },
      { href: '/admin/media', key: 'media', capability: 'media.read', icon: 'Image' },
    ],
  },
  {
    key: 'languages',
    items: [
      {
        href: '/admin/translations',
        key: 'translations',
        capability: 'translation.read',
        icon: 'Languages',
      },
    ],
  },
  {
    key: 'insight',
    items: [
      {
        href: '/admin/analytics',
        key: 'analytics',
        capability: 'analytics.read',
        icon: 'BarChart3',
      },
      {
        href: '/admin/search-terms',
        key: 'searchTerms',
        capability: 'analytics.read',
        icon: 'Search',
      },
      {
        href: '/admin/audit',
        key: 'audit',
        capability: 'audit.read',
        icon: 'ScrollText',
      },
    ],
  },
  {
    key: 'system',
    items: [
      {
        href: '/admin/settings',
        key: 'settings',
        capability: 'settings.read',
        icon: 'Settings',
      },
      { href: '/admin/users', key: 'users', capability: 'user.read', icon: 'Users' },
      {
        href: '/admin/security',
        key: 'security',
        capability: 'security.read',
        icon: 'Lock',
      },
      {
        href: '/admin/trash',
        key: 'trash',
        capability: 'content.read',
        icon: 'Trash2',
      },
    ],
  },
]
