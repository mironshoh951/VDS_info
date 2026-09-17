/**
 * Emits JSON-LD.
 *
 * `JSON.stringify` output is escaped for the one character sequence that can
 * break out of a script element. The payload is built server-side from
 * database values, never from user input, but the escape costs nothing and
 * removes the question entirely.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return null

  const json = JSON.stringify(data).replace(/</g, '\\u003c')

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
}
