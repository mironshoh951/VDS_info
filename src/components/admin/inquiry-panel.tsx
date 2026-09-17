'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui'
import {
  setInquiryStatusAction,
  addNoteAction,
} from '@/app/(admin)/admin/(workspace)/inquiries/actions'

const STATUSES = [
  { value: 'NEW', label: 'New' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'ARCHIVED', label: 'Archived' },
  { value: 'SPAM', label: 'Spam' },
]

/**
 * Status control and internal notes for one inquiry.
 *
 * Read-only accounts get the same view without the controls; the server
 * rejects the mutation regardless of what is rendered.
 */
export function InquiryPanel({
  id,
  status,
  canUpdate,
}: {
  id: string
  status: string
  canUpdate: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const changeStatus = (next: string) => {
    setError(null)
    startTransition(async () => {
      const result = await setInquiryStatusAction({ id, status: next })
      if (!result.ok) setError(result.message ?? 'Could not update the status.')
      else router.refresh()
    })
  }

  const submitNote = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await addNoteAction({ id, body: note })
      if (!result.ok) {
        setError(result.message ?? 'Could not save the note.')
        return
      }
      setNote('')
      router.refresh()
    })
  }

  if (!canUpdate) {
    return (
      <p className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-4 py-3 text-sm text-neutral-600">
        Your account is read-only. A Super Admin can change the status and add notes.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <label
          htmlFor="inquiry-status"
          className="mb-1.5 block text-sm font-medium text-neutral-700"
        >
          Status
        </label>
        <select
          id="inquiry-status"
          value={status}
          disabled={pending}
          onChange={(event) => changeStatus(event.target.value)}
          className="h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        >
          {STATUSES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={submitNote}>
        <label
          htmlFor="inquiry-note"
          className="mb-1.5 block text-sm font-medium text-neutral-700"
        >
          Internal note
        </label>
        <textarea
          id="inquiry-note"
          rows={4}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Visible only to administrators."
          className="w-full rounded-md border border-neutral-300 p-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        />
        <Button
          type="submit"
          size="sm"
          className="mt-2"
          disabled={pending || !note.trim()}
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          {pending ? 'Saving…' : 'Add note'}
        </Button>
      </form>

      {error && (
        <p
          role="alert"
          className="border-danger-500/30 bg-danger-50 text-danger-700 flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}
