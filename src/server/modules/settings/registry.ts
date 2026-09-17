/**
 * Site settings registry (§50, §79).
 *
 * Every setting the application reads is declared here with its namespace,
 * shape and default. Two consequences:
 *
 *  - The admin settings screens are generated from this registry, so a new
 *    setting appears in the UI without bespoke form code.
 *  - Nothing can read a setting that was never declared, which is what stops
 *    configuration drifting into undocumented magic strings.
 *
 * Defaults here are *technical* defaults. Business content (company name,
 * statistics, addresses, claims) ships empty and is entered by the client —
 * the platform never invents it.
 */

import { z } from 'zod'

export const settingsRegistry = {
  'site.general': {
    siteName: { schema: z.string().default(''), localized: true, default: '' },
    tagline: { schema: z.string().default(''), localized: true, default: '' },
    logoAssetId: {
      schema: z.string().nullable().default(null),
      localized: false,
      default: null,
    },
    logoInvertedAssetId: {
      schema: z.string().nullable().default(null),
      localized: false,
      default: null,
    },
    faviconAssetId: {
      schema: z.string().nullable().default(null),
      localized: false,
      default: null,
    },
    legalName: { schema: z.string().default(''), localized: false, default: '' },
    registrationNumber: { schema: z.string().default(''), localized: false, default: '' },
  },
  'site.i18n': {
    defaultLocale: {
      schema: z.enum(['en', 'ru', 'uz', 'zh']).default('uz'),
      localized: false,
      default: 'uz',
    },
    enabledLocales: {
      schema: z.array(z.enum(['en', 'ru', 'uz', 'zh'])).default(['en', 'ru', 'uz', 'zh']),
      localized: false,
      default: ['en', 'ru', 'uz', 'zh'],
    },
    publishAiDrafts: {
      schema: z.boolean().default(false),
      localized: false,
      default: false,
    },
  },
  'site.contact': {
    primaryEmail: { schema: z.string().default(''), localized: false, default: '' },
    primaryPhone: { schema: z.string().default(''), localized: false, default: '' },
    whatsapp: { schema: z.string().default(''), localized: false, default: '' },
    telegram: { schema: z.string().default(''), localized: false, default: '' },
    notificationRecipients: {
      schema: z.array(z.string()).default([]),
      localized: false,
      default: [],
    },
  },
  'site.seo': {
    defaultTitle: { schema: z.string().default(''), localized: true, default: '' },
    titleTemplate: { schema: z.string().default('%s'), localized: true, default: '%s' },
    defaultDescription: { schema: z.string().default(''), localized: true, default: '' },
    defaultOgImageId: {
      schema: z.string().nullable().default(null),
      localized: false,
      default: null,
    },
    robotsAllowIndexing: {
      schema: z.boolean().default(false),
      localized: false,
      default: false,
    },
    organizationSchema: {
      schema: z.record(z.string(), z.unknown()).default({}),
      localized: false,
      default: {},
    },
  },
  'site.maintenance': {
    enabled: { schema: z.boolean().default(false), localized: false, default: false },
    title: { schema: z.string().default(''), localized: true, default: '' },
    message: { schema: z.string().default(''), localized: true, default: '' },
    imageAssetId: {
      schema: z.string().nullable().default(null),
      localized: false,
      default: null,
    },
    startsAt: {
      schema: z.string().nullable().default(null),
      localized: false,
      default: null,
    },
    endsAt: {
      schema: z.string().nullable().default(null),
      localized: false,
      default: null,
    },
    bypassIps: { schema: z.array(z.string()).default([]), localized: false, default: [] },
  },
  'site.privacy': {
    cookieBannerEnabled: {
      schema: z.boolean().default(true),
      localized: false,
      default: true,
    },
    policyVersion: { schema: z.string().default('1'), localized: false, default: '1' },
    analyticsCategoryRequired: {
      schema: z.boolean().default(false),
      localized: false,
      default: false,
    },
    dataRetentionDays: {
      schema: z.object({
        analytics: z.number().int().positive().default(395),
        submissions: z.number().int().positive().default(1095),
        auditLogs: z.number().int().positive().default(2555),
        securityEvents: z.number().int().positive().default(730),
      }),
      localized: false,
      default: {
        analytics: 395,
        submissions: 1095,
        auditLogs: 2555,
        securityEvents: 730,
      },
    },
  },
  'security.policy': {
    inquiryViewerSeesPii: {
      schema: z.boolean().default(false),
      localized: false,
      default: false,
    },
    sessionIdleMinutes: {
      schema: z.number().int().min(5).max(480).default(30),
      localized: false,
      default: 30,
    },
    sessionAbsoluteHours: {
      schema: z.number().int().min(1).max(72).default(12),
      localized: false,
      default: 12,
    },
    requireMfaForSuperAdmin: {
      schema: z.boolean().default(false),
      localized: false,
      default: false,
    },
  },
  'ai.routing': {
    chatProvider: {
      schema: z.enum(['anthropic', 'openai', 'groq']).default('groq'),
      localized: false,
      default: 'groq',
    },
    translateProvider: {
      schema: z.enum(['anthropic', 'openai', 'groq']).default('groq'),
      localized: false,
      default: 'groq',
    },
    // 'none' is a real choice, not a placeholder: Groq has no embedding models,
    // so a Groq-only deployment has no vector index and retrieval falls back to
    // the Postgres search that already exists.
    embedProvider: {
      schema: z.enum(['openai', 'none']).default('none'),
      localized: false,
      default: 'none',
    },
    publicAssistantEnabled: {
      schema: z.boolean().default(false),
      localized: false,
      default: false,
    },
    adminAssistantEnabled: {
      schema: z.boolean().default(true),
      localized: false,
      default: true,
    },
  },
  'ai.budget': {
    monthlyLimitUsd: {
      schema: z.number().nonnegative().default(100),
      localized: false,
      default: 100,
    },
    warnAtPercent: {
      schema: z.number().min(1).max(100).default(70),
      localized: false,
      default: 70,
    },
    hardStop: { schema: z.boolean().default(true), localized: false, default: true },
  },
} as const

export type SettingsNamespace = keyof typeof settingsRegistry
export type SettingKey<N extends SettingsNamespace> = keyof (typeof settingsRegistry)[N]

export function isKnownSetting(namespace: string, key: string): boolean {
  const ns = (settingsRegistry as Record<string, Record<string, unknown>>)[namespace]
  return Boolean(ns && key in ns)
}
