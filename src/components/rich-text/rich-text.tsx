import Link from 'next/link'
import { Fragment } from 'react'
import { parseRichText, isSafeHref, type Mark, type RichTextNode } from '@/lib/rich-text'
import { cn } from '@/lib/cn'

/**
 * Renders a stored rich-text document.
 *
 * The renderer is an allow-list: a node type it does not recognise is not
 * rendered at all. Combined with the structured storage format, that removes
 * HTML injection through the CMS as a category of bug rather than mitigating
 * it (§10.1).
 */
export function RichText({
  document,
  className,
}: {
  document: unknown
  className?: string
}) {
  const parsed = parseRichText(document)
  if (!parsed || parsed.content.length === 0) return null

  return (
    <div
      className={cn(
        'space-y-4 text-base leading-relaxed text-neutral-700',
        '[&_a]:text-primary-700 hover:[&_a]:text-primary-800 [&_a]:underline [&_a]:underline-offset-2',
        className,
      )}
    >
      {renderNodes(parsed.content)}
    </div>
  )
}

function renderNodes(nodes: RichTextNode[]): React.ReactNode {
  return nodes.map((node, index) => <Fragment key={index}>{renderNode(node)}</Fragment>)
}

function renderNode(node: RichTextNode): React.ReactNode {
  if (node.type === 'text') return applyMarks(node.text, node.marks)

  switch (node.type) {
    case 'paragraph':
      return <p>{node.content ? renderNodes(node.content) : null}</p>

    case 'heading': {
      const level = node.level ?? 2
      const className =
        level === 2
          ? 'mt-10 text-2xl font-semibold text-neutral-900'
          : level === 3
            ? 'mt-8 text-xl font-semibold text-neutral-900'
            : 'mt-6 text-lg font-semibold text-neutral-900'
      const Tag = (level === 2 ? 'h2' : level === 3 ? 'h3' : 'h4') as 'h2' | 'h3' | 'h4'
      return (
        <Tag className={className}>{node.content ? renderNodes(node.content) : null}</Tag>
      )
    }

    case 'bulletList':
      return (
        <ul className="marker:text-primary-400 list-disc space-y-2 pl-6">
          {node.content ? renderNodes(node.content) : null}
        </ul>
      )

    case 'orderedList':
      return (
        <ol className="list-decimal space-y-2 pl-6 marker:text-neutral-400">
          {node.content ? renderNodes(node.content) : null}
        </ol>
      )

    case 'listItem':
      return <li>{node.content ? renderNodes(node.content) : null}</li>

    case 'blockquote':
      return (
        <blockquote className="border-primary-300 border-l-2 pl-5 text-neutral-600 italic">
          {node.content ? renderNodes(node.content) : null}
        </blockquote>
      )

    case 'hardBreak':
      return <br />

    case 'divider':
      return <hr className="my-8 border-[var(--border-subtle)]" />

    default:
      return null
  }
}

function applyMarks(text: string, marks: Mark[] | undefined): React.ReactNode {
  if (!marks || marks.length === 0) return text

  return marks.reduce<React.ReactNode>((content, mark) => {
    switch (mark.type) {
      case 'bold':
        return <strong className="font-semibold text-neutral-900">{content}</strong>
      case 'italic':
        return <em>{content}</em>
      case 'underline':
        return <u>{content}</u>
      case 'code':
        return (
          <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-sm text-neutral-800">
            {content}
          </code>
        )
      case 'link': {
        // A stored link that is not a permitted scheme renders as plain text.
        if (!isSafeHref(mark.href)) return content
        const external = /^https?:\/\//i.test(mark.href)
        return external || mark.target === '_blank' ? (
          <a
            href={mark.href}
            {...(mark.target === '_blank' || external
              ? { target: '_blank', rel: 'noopener noreferrer' }
              : {})}
          >
            {content}
          </a>
        ) : (
          <Link href={mark.href}>{content}</Link>
        )
      }
      default:
        return content
    }
  }, text)
}
