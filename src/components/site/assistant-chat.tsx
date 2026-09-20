'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Send, Sparkles, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import { askAssistantAction, type AssistantActionResult } from '@/app/actions/assistant'
import type { AssistantSource } from '@/server/modules/ai/assistant'

/**
 * The catalogue assistant, as a conversation.
 *
 * Three things here are deliberate.
 *
 * The transcript lives in component state and nowhere else. No session, no
 * database row, no cookie: a visitor asking which composite matches a shade is
 * not starting a relationship with us, and the cheapest way to keep their
 * questions private is not to have them.
 *
 * Sources are shown as links under every answer, not as a footnote in the
 * text. An answer a visitor can check is worth more than one they must trust,
 * and it turns the assistant into navigation — the useful next step after
 * "we stock three of those" is the page for each one.
 *
 * The composer never disappears while a question is in flight. Replacing it
 * with a spinner loses what the visitor has already typed next, which on a
 * phone is the difference between asking a second question and leaving.
 */

interface Turn {
  role: 'user' | 'assistant'
  content: string
  sources?: AssistantSource[]
  grounded?: boolean
}

export function AssistantChat({
  locale,
  suggestions,
  contactHref,
}: {
  locale: string
  suggestions: string[]
  contactHref: string
}) {
  const t = useTranslations('assistant')
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const transcript = useRef<HTMLDivElement>(null)

  // Keep the newest answer in view, but only ever scroll the transcript's own
  // box — moving the whole page under someone who is reading is worse than
  // making them scroll.
  useEffect(() => {
    const node = transcript.current
    if (node) node.scrollTop = node.scrollHeight
  }, [turns, pending])

  function ask(question: string) {
    const trimmed = question.trim()
    if (trimmed.length < 2 || pending) return

    const history = turns.map((turn) => ({ role: turn.role, content: turn.content }))

    setTurns((previous) => [...previous, { role: 'user', content: trimmed }])
    setDraft('')
    setError(null)

    startTransition(async () => {
      const outcome: AssistantActionResult = await askAssistantAction({
        question: trimmed,
        locale,
        history,
      })

      if (!outcome.ok || !outcome.answer) {
        setError(outcome.message ?? t('failed'))
        return
      }

      setTurns((previous) => [
        ...previous,
        {
          role: 'assistant',
          content: outcome.answer ?? '',
          sources: outcome.sources ?? [],
          grounded: outcome.grounded ?? false,
        },
      ])
    })
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div
        ref={transcript}
        // `aria-live="polite"` rather than assertive: an answer arriving should
        // be announced when the screen reader finishes its sentence, not cut
        // across it.
        aria-live="polite"
        aria-busy={pending}
        className="max-h-[60svh] min-h-[16rem] space-y-4 overflow-y-auto overscroll-contain rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-4 sm:p-6"
      >
        {turns.length === 0 && !pending && (
          <div className="py-8 text-center">
            <Sparkles className="text-primary-600 mx-auto mb-3 h-6 w-6" />
            <p className="text-sm text-neutral-600">{t('empty')}</p>
          </div>
        )}

        {turns.map((turn, index) => (
          <div
            key={index}
            className={cn('flex', turn.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed',
                turn.role === 'user'
                  ? 'bg-primary-600 text-white'
                  : 'border border-[var(--border-subtle)] bg-white text-neutral-800',
              )}
            >
              {/* `whitespace-pre-wrap` keeps the model's own line breaks, which
                  is how a short list stays a list. */}
              <p className="whitespace-pre-wrap">{turn.content}</p>

              {turn.role === 'assistant' && (turn.sources?.length ?? 0) > 0 && (
                <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
                  <p className="mb-1.5 text-xs font-medium text-neutral-500">
                    {t('sources')}
                  </p>
                  <ul className="space-y-1">
                    {turn.sources?.map((source) => (
                      <li key={source.href}>
                        <Link
                          href={source.href}
                          className="text-primary-700 text-xs hover:underline"
                        >
                          {source.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {turn.role === 'assistant' && turn.grounded === false && (
                <p className="mt-3 text-xs text-neutral-500">
                  {t.rich('noMatch', {
                    link: (chunks) => (
                      <Link href={contactHref} className="text-primary-700 underline">
                        {chunks}
                      </Link>
                    ),
                  })}
                </p>
              )}
            </div>
          </div>
        ))}

        {pending && (
          <div className="flex justify-start">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-white px-4 py-3 text-sm text-neutral-500">
              {t('thinking')}
            </div>
          </div>
        )}
      </div>

      {turns.length === 0 && suggestions.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                onClick={() => ask(suggestion)}
                disabled={pending}
                className="hover:border-primary-400 rounded-full border border-[var(--border-subtle)] bg-white px-3 py-1.5 text-xs text-neutral-700"
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-4 flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          ask(draft)
        }}
      >
        <label className="flex-1">
          <span className="sr-only">{t('inputLabel')}</span>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends, Shift+Enter writes a new line — the convention
              // every messaging app has trained people to expect.
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                ask(draft)
              }
            }}
            rows={2}
            maxLength={500}
            placeholder={t('placeholder')}
            className="w-full resize-none rounded-xl border border-[var(--border-subtle)] bg-white px-4 py-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
          />
        </label>
        <Button type="submit" disabled={pending || draft.trim().length < 2}>
          <Send className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only">{t('send')}</span>
        </Button>
      </form>

      {error && (
        <p className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <p className="mt-4 text-xs leading-relaxed text-neutral-500">
        {t.rich('disclaimer', {
          link: (chunks) => (
            <Link href={contactHref} className="text-primary-700 underline">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  )
}
