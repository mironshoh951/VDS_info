'use client'

import { useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Download, Upload, FileSpreadsheet, AlertCircle, Check } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import {
  exportResourceAction,
  importResourceAction,
} from '@/app/(admin)/admin/(workspace)/transfer-actions'
import type { ImportReport } from '@/server/modules/admin/transfer'

/**
 * Bulk import and export.
 *
 * The screen is built around one rule: nothing is written until the editor has
 * seen what would change. The import button runs a dry pass first and reports
 * it row by row; only then does a second, explicitly labelled button apply it.
 * A silent bulk write over a catalogue is not something anyone should be able
 * to do by clicking the wrong control once.
 */

interface ResourceOption {
  key: string
  label: string
  count: number
}

export function TransferPanel({
  resources,
  canImport,
}: {
  resources: ResourceOption[]
  canImport: boolean
}) {
  const t = useTranslations('admin.transfer')
  const [resourceKey, setResourceKey] = useState(resources[0]?.key ?? 'product')
  const [format, setFormat] = useState<'csv' | 'json'>('csv')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [fileText, setFileText] = useState<string>('')
  const [fileName, setFileName] = useState<string>('')
  const fileInput = useRef<HTMLInputElement>(null)

  const selected = resources.find((entry) => entry.key === resourceKey)

  /**
   * Turns the returned text into a download.
   *
   * The object URL is revoked immediately after the click: the browser has
   * already taken its copy by then, and leaving it alive holds the whole file
   * in memory for as long as the tab is open.
   */
  function download(filename: string, mimeType: string, body: string) {
    const blob = new Blob([body], { type: `${mimeType};charset=utf-8` })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  function runExport(template: boolean) {
    startTransition(async () => {
      setError(null)
      setNotice(null)
      const outcome = await exportResourceAction({ resourceKey, format, template })
      if (!outcome.ok || !outcome.body || !outcome.filename) {
        setError(outcome.message ?? t('failed'))
        return
      }
      download(outcome.filename, outcome.mimeType ?? 'text/plain', outcome.body)
      setNotice(
        template
          ? t('templateReady')
          : t('exportReady', { count: outcome.rowCount ?? 0, file: outcome.filename }),
      )
    })
  }

  function runImport(dryRun: boolean) {
    if (fileText.trim().length === 0) {
      setError(t('chooseFile'))
      return
    }
    startTransition(async () => {
      setError(null)
      setNotice(null)
      const outcome = await importResourceAction({
        resourceKey,
        format,
        text: fileText,
        dryRun,
      })
      if (!outcome.ok || !outcome.report) {
        setError(outcome.message ?? t('failed'))
        return
      }
      setReport(outcome.report)
      if (!dryRun) {
        setNotice(t('imported', { count: outcome.report.total }))
        // The file has been applied; offering "apply" again would double-write
        // every create in it.
        setFileText('')
        setFileName('')
        if (fileInput.current) fileInput.current.value = ''
      }
    })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-neutral-700">
              {t('contentType')}
            </span>
            <select
              value={resourceKey}
              onChange={(event) => {
                setResourceKey(event.target.value)
                setReport(null)
              }}
              className="w-full rounded-md border border-[var(--border-subtle)] bg-white px-3 py-2 text-sm"
            >
              {resources.map((entry) => (
                <option key={entry.key} value={entry.key}>
                  {entry.label} ({entry.count})
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-neutral-700">
              {t('format')}
            </span>
            <select
              value={format}
              onChange={(event) => setFormat(event.target.value as 'csv' | 'json')}
              className="w-full rounded-md border border-[var(--border-subtle)] bg-white px-3 py-2 text-sm"
            >
              <option value="csv">{t('formatCsv')}</option>
              <option value="json">{t('formatJson')}</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-neutral-900">
          {t('exportTitle')}
        </h2>
        <p className="mb-4 text-xs leading-relaxed text-neutral-500">
          {t('exportDescription', { count: selected?.count ?? 0 })}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => runExport(false)}
          >
            <Download className="h-4 w-4" />
            {t('exportButton')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => runExport(true)}
          >
            <FileSpreadsheet className="h-4 w-4" />
            {t('templateButton')}
          </Button>
        </div>
      </section>

      {canImport && (
        <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold text-neutral-900">
            {t('importTitle')}
          </h2>
          <p className="mb-4 text-xs leading-relaxed text-neutral-500">
            {t('importDescription')}
          </p>

          <input
            ref={fileInput}
            type="file"
            accept=".csv,.json,text/csv,application/json"
            className="mb-4 block w-full text-sm text-neutral-600 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-sm file:font-medium"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              setReport(null)
              setError(null)
              setNotice(null)
              if (!file) {
                setFileText('')
                setFileName('')
                return
              }
              setFileName(file.name)
              setFileText(await file.text())
              // Pick the format from the extension rather than making the
              // editor set two controls that must agree.
              if (file.name.endsWith('.json')) setFormat('json')
              if (file.name.endsWith('.csv')) setFormat('csv')
            }}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending || fileText.length === 0}
              onClick={() => runImport(true)}
            >
              {t('previewButton')}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pending || fileText.length === 0 || report === null}
              onClick={() => runImport(false)}
            >
              <Upload className="h-4 w-4" />
              {t('applyButton')}
            </Button>
          </div>

          {fileName && (
            <p className="mt-3 text-xs text-neutral-500">
              {t('selectedFile', { name: fileName })}
            </p>
          )}
        </section>
      )}

      {error && (
        <p className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {notice && (
        <p className="flex items-start gap-2 rounded-md bg-green-50 p-3 text-sm text-green-800">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          {notice}
        </p>
      )}

      {report && <ImportReportTable report={report} />}
    </div>
  )
}

function ImportReportTable({ report }: { report: ImportReport }) {
  const t = useTranslations('admin.transfer')

  return (
    <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-5">
      <h2 className="mb-1 text-sm font-semibold text-neutral-900">
        {report.dryRun ? t('previewTitle') : t('resultTitle')}
      </h2>
      <p className="mb-4 text-xs text-neutral-500">
        {t('summary', {
          total: report.total,
          created: report.created,
          updated: report.updated,
          failed: report.failed,
        })}
      </p>

      {report.rows.length > 0 && (
        <div className="max-h-96 overflow-y-auto rounded-md border border-[var(--border-subtle)]">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-3 py-2 font-medium">{t('columnLine')}</th>
                <th className="px-3 py-2 font-medium">{t('columnAction')}</th>
                <th className="px-3 py-2 font-medium">{t('columnRecord')}</th>
                <th className="px-3 py-2 font-medium">{t('columnNote')}</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr
                  key={row.line}
                  className="border-t border-[var(--border-subtle)] align-top"
                >
                  <td className="px-3 py-2 text-neutral-500 tabular-nums">{row.line}</td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-medium',
                        row.action === 'error'
                          ? 'bg-red-50 text-red-700'
                          : row.action === 'create'
                            ? 'bg-green-50 text-green-800'
                            : 'bg-neutral-100 text-neutral-600',
                      )}
                    >
                      {t(`action.${row.action}`)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-neutral-700">
                    {row.title ?? row.slug ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-neutral-500">{row.message ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
