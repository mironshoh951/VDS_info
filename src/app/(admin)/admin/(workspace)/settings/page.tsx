import { getActor } from '@/server/auth/context'
import { requireCapability, hasCapability } from '@/server/auth/guard'
import { getSettings } from '@/server/modules/settings/service'
import { LOCALES, LOCALE_DESCRIPTORS } from '@/i18n/config'
import { AdminPageHeader } from '@/components/admin/page-header'
import { SettingsForm, type SettingField } from '@/components/admin/settings-form'
import { configuredProviders } from '@/server/ai/providers'

export const dynamic = 'force-dynamic'

/**
 * Site settings.
 *
 * Grouped by what an operator is trying to do rather than by storage
 * namespace. Each field is described once here and rendered by a shared form
 * component, so adding a setting is a registry entry plus one line.
 */
export default async function SettingsPage() {
  const actor = await getActor()
  await requireCapability(actor, 'settings.read')

  const canEdit = hasCapability(actor, 'settings.manage')

  const [general, i18n, contact, seo, maintenance, privacy, policy, aiRouting, aiBudget] =
    await Promise.all([
      getSettings('site.general'),
      getSettings('site.i18n'),
      getSettings('site.contact'),
      getSettings('site.seo'),
      getSettings('site.maintenance'),
      getSettings('site.privacy'),
      getSettings('security.policy'),
      getSettings('ai.routing'),
      getSettings('ai.budget'),
    ])

  // Which providers actually have a key. A settings screen that offers a
  // provider the deployment cannot call is how an operator spends ten minutes
  // wondering why translation says "not configured" — so the list says which
  // ones are live rather than leaving them to find out at the point of use.
  const ready = configuredProviders()
  const providerHelp =
    ready.length > 0
      ? `Configured on this server: ${ready.join(', ')}.`
      : 'No API key is set on this server yet, so every provider will refuse.'

  const CHAT_PROVIDER_OPTIONS = [
    { value: 'groq', label: ready.includes('groq') ? 'Groq' : 'Groq (no key set)' },
    {
      value: 'openai',
      label: ready.includes('openai') ? 'OpenAI' : 'OpenAI (no key set)',
    },
    {
      value: 'anthropic',
      label: ready.includes('anthropic') ? 'Anthropic' : 'Anthropic (no key set)',
    },
  ]

  const localeOptions = LOCALES.map((locale) => ({
    value: locale,
    label: LOCALE_DESCRIPTORS[locale].nativeName,
  }))

  const groups: Array<{ title: string; description: string; fields: SettingField[] }> = [
    {
      title: 'Company',
      description: 'Names shown in the header, footer and page titles.',
      fields: [
        {
          namespace: 'site.general',
          key: 'siteName',
          label: 'Site name',
          help: 'Shown in the header, the footer and the browser tab.',
          kind: 'text',
          value: general.siteName,
        },
        {
          namespace: 'site.general',
          key: 'tagline',
          label: 'Tagline',
          help: 'One line under the site name in the footer.',
          kind: 'text',
          value: general.tagline,
        },
        {
          namespace: 'site.general',
          key: 'legalName',
          label: 'Legal name',
          help: 'Used in the copyright line and structured data.',
          kind: 'text',
          value: general.legalName,
        },
        {
          namespace: 'site.general',
          key: 'registrationNumber',
          label: 'Registration number',
          kind: 'text',
          value: general.registrationNumber,
        },
      ],
    },
    {
      title: 'Languages',
      description:
        'Which of the four supported languages the public site offers, and which one a visitor gets by default.',
      fields: [
        {
          namespace: 'site.i18n',
          key: 'enabledLocales',
          label: 'Enabled languages',
          help: 'A disabled language is unreachable even by typing its URL.',
          kind: 'select',
          multiple: true,
          options: localeOptions,
          value: i18n.enabledLocales,
        },
        {
          namespace: 'site.i18n',
          key: 'defaultLocale',
          label: 'Default language',
          help: 'Used when a visitor has no preference, and as the fallback for missing translations.',
          kind: 'select',
          options: localeOptions,
          value: i18n.defaultLocale,
        },
        {
          namespace: 'site.i18n',
          key: 'publishAiDrafts',
          label: 'Show AI drafts publicly',
          help: 'Off by default. AI translations should be reviewed before visitors see them.',
          kind: 'boolean',
          value: i18n.publishAiDrafts,
        },
      ],
    },
    {
      title: 'Contact',
      description: 'Shown on the contact page and in the footer.',
      fields: [
        {
          namespace: 'site.contact',
          key: 'primaryEmail',
          label: 'Email',
          kind: 'text',
          value: contact.primaryEmail,
        },
        {
          namespace: 'site.contact',
          key: 'primaryPhone',
          label: 'Phone',
          kind: 'text',
          value: contact.primaryPhone,
        },
        {
          namespace: 'site.contact',
          key: 'notificationRecipients',
          label: 'Notify these addresses',
          help: 'Who receives an email when an enquiry arrives. One address per line.',
          kind: 'list',
          value: contact.notificationRecipients,
        },
      ],
    },
    {
      title: 'Search engines',
      description: 'Indexing stays off until the site is ready to launch.',
      fields: [
        {
          namespace: 'site.seo',
          key: 'robotsAllowIndexing',
          label: 'Allow search engines to index this site',
          help: 'While off, robots.txt disallows everything and the sitemap is empty. Turn on at launch.',
          kind: 'boolean',
          value: seo.robotsAllowIndexing,
        },
        {
          namespace: 'site.seo',
          key: 'defaultTitle',
          label: 'Default page title',
          kind: 'text',
          value: seo.defaultTitle,
        },
        {
          namespace: 'site.seo',
          key: 'titleTemplate',
          label: 'Title template',
          help: 'Use %s for the page title, e.g. "%s · Company".',
          kind: 'text',
          value: seo.titleTemplate,
        },
        {
          namespace: 'site.seo',
          key: 'defaultDescription',
          label: 'Default meta description',
          kind: 'textarea',
          value: seo.defaultDescription,
        },
      ],
    },
    {
      title: 'Maintenance',
      description:
        'Take the public site offline temporarily without stopping the server.',
      fields: [
        {
          namespace: 'site.maintenance',
          key: 'enabled',
          label: 'Maintenance mode',
          help: 'Visitors see a maintenance page. The administration panel stays reachable.',
          kind: 'boolean',
          value: maintenance.enabled,
        },
        {
          namespace: 'site.maintenance',
          key: 'title',
          label: 'Maintenance heading',
          kind: 'text',
          value: maintenance.title,
        },
        {
          namespace: 'site.maintenance',
          key: 'message',
          label: 'Maintenance message',
          kind: 'textarea',
          value: maintenance.message,
        },
        {
          namespace: 'site.maintenance',
          key: 'bypassIps',
          label: 'Addresses that bypass maintenance',
          help: 'One IP address per line.',
          kind: 'list',
          value: maintenance.bypassIps,
        },
      ],
    },
    {
      title: 'Privacy',
      description: 'Consent banner and how long collected data is kept.',
      fields: [
        {
          namespace: 'site.privacy',
          key: 'cookieBannerEnabled',
          label: 'Show the cookie consent banner',
          kind: 'boolean',
          value: privacy.cookieBannerEnabled,
        },
        {
          namespace: 'site.privacy',
          key: 'policyVersion',
          label: 'Policy version',
          help: 'Increment when the privacy policy changes so consent is collected again.',
          kind: 'text',
          value: privacy.policyVersion,
        },
      ],
    },
    {
      title: 'Security',
      description: 'Session behaviour and what read-only accounts can see.',
      fields: [
        {
          namespace: 'security.policy',
          key: 'inquiryViewerSeesPii',
          label: 'Read-only accounts see full contact details',
          help: 'Off by default: Viewers see masked email addresses and phone numbers on inquiries.',
          kind: 'boolean',
          value: policy.inquiryViewerSeesPii,
        },
        {
          namespace: 'security.policy',
          key: 'sessionIdleMinutes',
          label: 'Sign out after inactivity (minutes)',
          kind: 'number',
          value: policy.sessionIdleMinutes,
        },
        {
          namespace: 'security.policy',
          key: 'sessionAbsoluteHours',
          label: 'Maximum session length (hours)',
          kind: 'number',
          value: policy.sessionAbsoluteHours,
        },
        {
          namespace: 'security.policy',
          key: 'requireMfaForSuperAdmin',
          label: 'Require two-factor authentication for Super Admins',
          kind: 'boolean',
          value: policy.requireMfaForSuperAdmin,
        },
      ],
    },
    {
      title: 'AI',
      description:
        'Which provider handles which task, and the spending ceiling. Provider keys live in the environment, never in the database.',
      fields: [
        {
          namespace: 'ai.routing',
          key: 'publicAssistantEnabled',
          label: 'Public assistant',
          help: 'Off until the knowledge index has been built and reviewed.',
          kind: 'boolean',
          value: aiRouting.publicAssistantEnabled,
        },
        {
          namespace: 'ai.routing',
          key: 'adminAssistantEnabled',
          label: 'Admin assistant',
          kind: 'boolean',
          value: aiRouting.adminAssistantEnabled,
        },
        {
          namespace: 'ai.routing',
          key: 'chatProvider',
          label: 'Chat provider',
          help: providerHelp,
          kind: 'select',
          options: CHAT_PROVIDER_OPTIONS,
          value: aiRouting.chatProvider,
        },
        {
          namespace: 'ai.routing',
          key: 'translateProvider',
          label: 'Translation provider',
          help: providerHelp,
          kind: 'select',
          options: CHAT_PROVIDER_OPTIONS,
          value: aiRouting.translateProvider,
        },
        {
          namespace: 'ai.routing',
          key: 'embedProvider',
          label: 'Embedding provider',
          help: 'Groq serves no embedding models. With “None” the knowledge index stays empty and the assistant retrieves with the site search instead.',
          kind: 'select',
          options: [
            { value: 'none', label: 'None — use site search' },
            { value: 'openai', label: 'OpenAI' },
          ],
          value: aiRouting.embedProvider,
        },
        {
          namespace: 'ai.budget',
          key: 'monthlyLimitUsd',
          label: 'Monthly budget (USD)',
          kind: 'number',
          value: aiBudget.monthlyLimitUsd,
        },
        {
          namespace: 'ai.budget',
          key: 'hardStop',
          label: 'Stop AI features at the limit',
          help: 'When the budget is reached the assistant degrades to search rather than continuing to spend.',
          kind: 'boolean',
          value: aiBudget.hardStop,
        },
      ],
    },
  ]

  return (
    <>
      <AdminPageHeader
        title="Settings"
        description="Everything here changes the live site. Changes are audited and require password confirmation."
      />

      {!canEdit && (
        <p className="mb-6 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-4 py-3 text-sm text-neutral-600">
          Your account is read-only. Settings are shown but cannot be changed.
        </p>
      )}

      <div className="space-y-6">
        {groups.map((group) => (
          <section
            key={group.title}
            className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-white"
          >
            <header className="border-b border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-5 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">{group.title}</h2>
              <p className="mt-0.5 text-xs text-neutral-600">{group.description}</p>
            </header>
            <div className="px-5">
              <SettingsForm fields={group.fields} canEdit={canEdit} />
            </div>
          </section>
        ))}
      </div>
    </>
  )
}
