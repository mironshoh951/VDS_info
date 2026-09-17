import { NextResponse } from 'next/server'

/**
 * Liveness probe. Deliberately does not touch the database or Redis: it
 * answers "is this process running", which is what an orchestrator needs to
 * decide whether to restart the container.
 */
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json(
    { status: 'ok', uptimeSeconds: Math.round(process.uptime()) },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
