/**
 * Shown when a CMS-driven area has no content yet.
 *
 * This deliberately does not fake a page. A brand-new installation should look
 * empty and say so, so that nobody mistakes sample marketing copy for real
 * company content and ships it (§73, §80).
 */
export function NotConfiguredNotice({ area }: { area: string }) {
  return (
    <div className="content-container py-24">
      <div className="mx-auto max-w-xl rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-subtle)] px-8 py-12 text-center">
        <h1 className="text-xl font-semibold text-neutral-800">
          No content published yet
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          This area of the site has not been set up. An administrator can add and publish
          content for it from the administration panel.
        </p>
        <p className="mt-6 font-mono text-xs text-neutral-400">area: {area}</p>
      </div>
    </div>
  )
}
