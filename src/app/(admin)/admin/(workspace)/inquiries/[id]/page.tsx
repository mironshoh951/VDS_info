import { notFound } from 'next/navigation'
import { getActor } from '@/server/auth/context'
import { hasCapability } from '@/server/auth/guard'
import { getInquiry } from '@/server/modules/inquiries/service'
import { isAppError } from '@/lib/errors'
import { AdminPageHeader } from '@/components/admin/page-header'
import { InquiryPanel } from '@/components/admin/inquiry-panel'

export const dynamic = 'force-dynamic'

export default async function InquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const actor = await getActor()

  let inquiry
  try {
    inquiry = await getInquiry(actor, id)
  } catch (error) {
    if (isAppError(error) && error.code === 'NOT_FOUND') notFound()
    throw error
  }

  const canUpdate = hasCapability(actor, 'inquiry.update')

  return (
    <>
      <AdminPageHeader
        title={inquiry.reference}
        description={`${inquiry.type} · received ${inquiry.createdAt.toISOString().slice(0, 16).replace('T', ' ')}`}
        breadcrumb={{ label: 'Inquiries', href: '/admin/inquiries' }}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold tracking-wider text-neutral-500 uppercase">
              Message
            </h2>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-neutral-800">
              {inquiry.message}
            </p>
          </section>

          <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold tracking-wider text-neutral-500 uppercase">
              Notes
            </h2>
            {inquiry.notes.length === 0 ? (
              <p className="text-sm text-neutral-500">No notes yet.</p>
            ) : (
              <ul className="space-y-4">
                {inquiry.notes.map((note) => (
                  <li key={note.id} className="border-primary-200 border-l-2 pl-4">
                    <p className="text-sm whitespace-pre-wrap text-neutral-800">
                      {note.body}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {note.authorName ?? 'Unknown'} ·{' '}
                      <time dateTime={note.createdAt.toISOString()}>
                        {note.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                      </time>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold tracking-wider text-neutral-500 uppercase">
              Contact
            </h2>
            <dl className="space-y-3 text-sm">
              <Field label="Name" value={inquiry.name} />
              {inquiry.company && <Field label="Company" value={inquiry.company} />}
              <Field
                label="Email"
                value={
                  inquiry.masked ? (
                    inquiry.email
                  ) : (
                    <a
                      href={`mailto:${inquiry.email}`}
                      className="text-primary-700 hover:underline"
                    >
                      {inquiry.email}
                    </a>
                  )
                }
              />
              {inquiry.phone && <Field label="Phone" value={inquiry.phone} />}
              {inquiry.countryCode && (
                <Field label="Country" value={inquiry.countryCode} />
              )}
              {inquiry.locale && <Field label="Language" value={inquiry.locale} />}
              {inquiry.relatedLabel && (
                <Field label="About" value={inquiry.relatedLabel} />
              )}
              {inquiry.sourcePath && <Field label="Page" value={inquiry.sourcePath} />}
            </dl>
          </section>

          <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold tracking-wider text-neutral-500 uppercase">
              Handling
            </h2>
            <InquiryPanel id={inquiry.id} status={inquiry.status} canUpdate={canUpdate} />
          </section>
        </aside>
      </div>
    </>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs tracking-wider text-neutral-500 uppercase">{label}</dt>
      <dd className="mt-0.5 break-words text-neutral-800">{value}</dd>
    </div>
  )
}
