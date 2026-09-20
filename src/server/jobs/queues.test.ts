import { describe, expect, it } from 'vitest'
import { translationJobSchema, QUEUE_TRANSLATION } from './queues'

/**
 * The payload schema is the contract between the request that queues a job and
 * the worker that runs it minutes later, in another process. Anything it lets
 * through unchecked becomes a crash in a background process nobody is
 * watching, so it is validated on both sides — written here, parsed again in
 * the worker — and this is the test of that shape.
 */

describe('translation job payload', () => {
  const valid = {
    resourceKey: 'product',
    id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    requestedBy: null,
    requestedByLabel: null,
  }

  it('accepts a well-formed job', () => {
    expect(translationJobSchema.parse(valid).resourceKey).toBe('product')
  })

  it('defaults the requester fields rather than demanding them', () => {
    const parsed = translationJobSchema.parse({
      resourceKey: 'page',
      id: valid.id,
    })
    expect(parsed.requestedBy).toBeNull()
    expect(parsed.requestedByLabel).toBeNull()
  })

  it('refuses a content type that does not exist', () => {
    expect(() =>
      translationJobSchema.parse({ ...valid, resourceKey: 'invoice' }),
    ).toThrow()
  })

  it('refuses an id that is not a uuid', () => {
    // A worker that trusted this would build a query from arbitrary input.
    expect(() => translationJobSchema.parse({ ...valid, id: 'x' })).toThrow()
  })

  it('refuses a language the site does not have', () => {
    expect(() =>
      translationJobSchema.parse({ ...valid, targetLocales: ['de'] }),
    ).toThrow()
  })

  it('keeps the queue name stable', () => {
    // The worker subscribes to this string; renaming it silently would leave
    // jobs queued forever with no consumer.
    expect(QUEUE_TRANSLATION).toBe('translation')
  })
})
