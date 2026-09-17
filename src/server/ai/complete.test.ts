import { describe, expect, it } from 'vitest'
import { parseJsonReply } from './complete'
import { OpenAiCompatibleProvider } from './openai-compatible'

describe('parseJsonReply', () => {
  it('reads a plain object', () => {
    expect(parseJsonReply<{ a: number }>('{"a":1}')).toEqual({ a: 1 })
  })

  it('reads an object wrapped in a fenced code block', () => {
    // Models do this constantly even when asked for JSON only, and a strict
    // JSON.parse would throw away a perfectly good translation.
    expect(parseJsonReply('```json\n{"title":"Salom"}\n```')).toEqual({ title: 'Salom' })
  })

  it('reads an object surrounded by prose', () => {
    expect(parseJsonReply('Here you go:\n{"title":"Salom"}\nHope that helps.')).toEqual({
      title: 'Salom',
    })
  })

  it('returns null rather than throwing on nonsense', () => {
    expect(parseJsonReply('no json here')).toBeNull()
    expect(parseJsonReply('{ broken')).toBeNull()
    expect(parseJsonReply('')).toBeNull()
  })
})

describe('cost accounting', () => {
  const provider = new OpenAiCompatibleProvider({
    id: 'GROQ',
    label: 'Groq',
    baseUrl: 'https://example.invalid/v1',
    apiKey: undefined,
    chatModel: 'test-model',
    pricing: { inputPerMillion: 0.59, outputPerMillion: 0.79 },
  })

  it('reports itself unconfigured without a key', () => {
    expect(provider.isConfigured()).toBe(false)
  })

  it('prices a call in whole micro-units', () => {
    // 1M in + 1M out at 0.59 + 0.79 = $1.38 = 1_380_000 micros.
    const micros = provider.costMicros({
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    })
    expect(micros).toBe(1_380_000)
    expect(Number.isInteger(micros)).toBe(true)
  })

  it('never stores a fraction of a micro-unit', () => {
    // The ledger is summed across thousands of rows; a float here would drift.
    const micros = provider.costMicros({ inputTokens: 7, outputTokens: 13 })
    expect(Number.isInteger(micros)).toBe(true)
  })

  it('refuses to call without a key', async () => {
    await expect(
      provider.chat({ messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toThrow(/not configured/i)
  })
})
