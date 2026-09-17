/**
 * Checks that the configured AI provider actually answers.
 *
 *   npm run ai:check
 *
 * Exists because the alternative is discovering a bad model name from a red
 * message in the middle of editing a product. It reports three things
 * separately — is a key set, does the key work, does the configured model do
 * chat — because they fail for different reasons and need different fixes.
 *
 * The key is read from .env and never printed.
 */
import 'dotenv/config'

const PROVIDERS = {
  groq: {
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    keyVar: 'GROQ_API_KEY',
    modelVar: 'AI_CHAT_MODEL_GROQ',
  },
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    keyVar: 'OPENAI_API_KEY',
    modelVar: 'AI_CHAT_MODEL_OPENAI',
  },
  anthropic: {
    label: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    keyVar: 'ANTHROPIC_API_KEY',
    modelVar: 'AI_CHAT_MODEL_ANTHROPIC',
  },
}

// Speech, moderation and embedding models answer /models too; listing them as
// chat options is what sends someone to a "does not support chat completions".
const NON_CHAT = ['whisper', 'orpheus', 'tts', 'guard', 'embed', 'rerank', 'moderation']

const name = process.argv[2] ?? process.env.AI_DEFAULT_CHAT_PROVIDER ?? 'groq'
const provider = PROVIDERS[name]

if (!provider) {
  console.error(`Unknown provider "${name}". Try: ${Object.keys(PROVIDERS).join(', ')}`)
  process.exit(1)
}

const apiKey = process.env[provider.keyVar]
const model = process.env[provider.modelVar]

console.log(`Provider : ${provider.label}`)
console.log(`Model    : ${model ?? '(not set)'}`)

if (!apiKey) {
  console.error(`\n✗ ${provider.keyVar} is not set in .env.`)
  process.exit(1)
}
console.log(`Key      : set (${apiKey.length} characters)`)

const auth = { Authorization: `Bearer ${apiKey}` }

let chatModels = []
try {
  const response = await fetch(`${provider.baseUrl}/models`, { headers: auth })
  if (response.status === 401) {
    console.error('\n✗ The key was rejected. Check it in .env.')
    process.exit(1)
  }
  const payload = await response.json()
  chatModels = (payload.data ?? [])
    .map((entry) => entry.id)
    .filter((id) => typeof id === 'string')
    .filter((id) => !NON_CHAT.some((word) => id.toLowerCase().includes(word)))
    .sort()
} catch (error) {
  console.error(`\n✗ Could not reach ${provider.label}: ${error.message}`)
  process.exit(1)
}

console.log(`\nChat models this key can use:`)
for (const id of chatModels) console.log(`  ${id === model ? '→' : ' '} ${id}`)

if (!model) {
  console.error(`\n✗ ${provider.modelVar} is not set. Pick one of the above.`)
  process.exit(1)
}

// Listing is not proof: a model can be listed and still refuse chat. The only
// honest check is a real completion.
process.stdout.write(`\nSending a test message to ${model}… `)

const response = await fetch(`${provider.baseUrl}/chat/completions`, {
  method: 'POST',
  headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model,
    max_tokens: 16,
    messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
  }),
})

const payload = await response.json().catch(() => null)

if (!response.ok) {
  console.log('failed.')
  console.error(`\n✗ ${payload?.error?.message ?? `HTTP ${response.status}`}`)
  if (chatModels.length > 0) {
    console.error(`\nSet ${provider.modelVar} in .env to one of the models listed above.`)
  }
  process.exit(1)
}

console.log('ok.')
console.log(
  `\n✓ ${provider.label} is working. Reply: ${payload?.choices?.[0]?.message?.content?.trim()}`,
)
