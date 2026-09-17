/**
 * Creates or updates an administrator account.
 *
 *   npm run create-admin
 *   npm run create-admin -- --email you@example.com --name "Your Name"
 *
 * Without flags it prompts interactively and hides the password as it is
 * typed. This is the intended way to bootstrap a fresh deployment, and the
 * only way to create the first account before the user-management screens
 * exist.
 */
// Load .env before any module reads process.env (getEnv() validates on import).
import 'dotenv/config'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { db } from '../src/server/db/client'
import { hashPassword, checkPasswordPolicy } from '../src/server/auth/password'
import { recordAudit } from '../src/server/security/audit'
import type { UserRole } from '../src/server/db/generated/enums'

interface Options {
  email?: string
  name?: string
  role?: UserRole
  password?: string
}

const KEY_ENTER = '\r'
const KEY_NEWLINE = '\n'
const KEY_EOT = String.fromCharCode(4)
const KEY_ETX = String.fromCharCode(3)
const KEY_DELETE = String.fromCharCode(127)
const KEY_BACKSPACE = String.fromCharCode(8)

function parseArgs(argv: string[]): Options {
  const options: Options = {}
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]
    const value = argv[i + 1]
    if (!value) continue
    if (flag === '--email') options.email = value
    if (flag === '--name') options.name = value
    if (flag === '--password') options.password = value
    if (flag === '--role' && (value === 'SUPER_ADMIN' || value === 'VIEWER')) {
      options.role = value
    }
  }
  return options
}

/** Reads a line without echoing it, so the password never reaches scrollback. */
async function promptHidden(question: string): Promise<string> {
  stdout.write(question)

  return new Promise((resolve) => {
    const wasRaw = stdin.isRaw
    stdin.setRawMode?.(true)
    stdin.resume()

    let value = ''

    const finish = (result: string) => {
      stdin.setRawMode?.(wasRaw ?? false)
      stdin.pause()
      stdin.removeListener('data', onData)
      stdout.write('\n')
      resolve(result)
    }

    const onData = (chunk: Buffer) => {
      const char = chunk.toString('utf8')

      if (char === KEY_ENTER || char === KEY_NEWLINE || char === KEY_EOT) {
        finish(value)
        return
      }
      if (char === KEY_ETX) {
        stdout.write('\n')
        process.exit(130)
      }
      if (char === KEY_DELETE || char === KEY_BACKSPACE) {
        value = value.slice(0, -1)
        return
      }
      if (char >= ' ') value += char
    }

    stdin.on('data', onData)
  })
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const rl = createInterface({ input: stdin, output: stdout })

  console.log('\nCreate an administrator account\n')

  const email = (options.email ?? (await rl.question('Email: '))).trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('\nThat does not look like an email address.\n')
    rl.close()
    process.exit(1)
  }

  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true, name: true, role: true },
  })

  if (existing) {
    const answer = (
      await rl.question(
        `\nAn account with that email exists (${existing.name}). Reset its password? [y/N] `,
      )
    )
      .trim()
      .toLowerCase()
    if (answer !== 'y' && answer !== 'yes') {
      console.log('\nCancelled.\n')
      rl.close()
      process.exit(0)
    }
  }

  const name = existing
    ? existing.name
    : (options.name ?? (await rl.question('Full name: '))).trim()

  let role: UserRole = options.role ?? existing?.role ?? 'SUPER_ADMIN'
  if (!options.role && !existing) {
    const answer = (
      await rl.question('Role - [1] Super Admin  [2] Viewer  (default 1): ')
    ).trim()
    role = answer === '2' ? 'VIEWER' : 'SUPER_ADMIN'
  }

  rl.close()

  let password = options.password ?? ''
  if (!password) {
    for (;;) {
      password = await promptHidden('Password (min 12 characters): ')
      const policy = checkPasswordPolicy(password, { email, name })
      if (!policy.ok) {
        console.error(`  ${policy.problems.join(' ')}`)
        continue
      }
      const confirm = await promptHidden('Confirm password: ')
      if (confirm !== password) {
        console.error('  Passwords do not match.')
        continue
      }
      break
    }
  } else {
    const policy = checkPasswordPolicy(password, { email, name })
    if (!policy.ok) {
      console.error(`\n${policy.problems.join(' ')}\n`)
      process.exit(1)
    }
  }

  const passwordHash = await hashPassword(password)

  const user = existing
    ? await db.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          role,
          status: 'ACTIVE',
          failedLoginCount: 0,
          lockedUntil: null,
          passwordChangedAt: new Date(),
        },
        select: { id: true, email: true, name: true, role: true },
      })
    : await db.user.create({
        data: { email, name, passwordHash, role, status: 'ACTIVE' },
        select: { id: true, email: true, name: true, role: true },
      })

  await recordAudit({
    actor: { id: null, role: null, label: 'cli:create-admin' },
    action: existing ? 'auth.password_reset_by_cli' : 'user.created_by_cli',
    entityType: 'USER',
    entityId: user.id,
    entityLabel: user.email,
    after: { email: user.email, name: user.name, role: user.role },
  })

  console.log(
    `\nDone. ${existing ? 'Password reset for' : 'Created'} ${user.email} (${user.role})`,
  )
  console.log('Sign in at http://localhost:3000/admin\n')
}

main()
  .catch((error: unknown) => {
    console.error('\nFailed:', error instanceof Error ? error.message : error)
    console.error('\nIs the database running and migrated?  bash scripts/doctor.sh\n')
    process.exit(1)
  })
  .finally(() => {
    void db.$disconnect()
  })
