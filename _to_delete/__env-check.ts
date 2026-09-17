import 'dotenv/config'
import { getEnv } from '../src/lib/env'
const e = getEnv()
console.log('✓ Environment validation PASSED')
console.log('  DATABASE_URL :', e.DATABASE_URL)
console.log('  REDIS_URL    :', e.REDIS_URL)
console.log('  S3_ENDPOINT  :', e.S3_ENDPOINT)
console.log('  PUBLIC_HOST  :', e.PUBLIC_HOST, '| ADMIN_HOST:', e.ADMIN_HOST)
console.log('  SESSION_SECRET / ENCRYPTION_KEY: set (', e.SESSION_SECRET.length, '/', e.ENCRYPTION_KEY.length, 'chars )')
