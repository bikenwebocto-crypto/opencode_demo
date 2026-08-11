// Global setup: verify environment prerequisites and write a skip-anchor used by specs.
// If no role credentials are configured, the run still proceeds — authenticated specs skip.

import type { FullConfig } from '@playwright/test'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import * as http from 'node:http'
import { anyRoleConfigured, BASE_URL } from './support/creds'

function probe(urlStr: string): Promise<boolean> {
  return new Promise((resolve) => {
    const url = new URL(urlStr)
    const req = http.get(url, { timeout: 8000 }, (res) => {
      res.destroy()
      resolve(true)
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
  })
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  const serverUp = await probe(`${BASE_URL}/login`)
  const hasCreds = anyRoleConfigured()

  const dir = path.join(os.tmpdir(), 'opencode_e2e')
  await fs.mkdir(dir, { recursive: true })

  const anchor = {
    serverUp,
    hasCreds,
    baseURL: BASE_URL,
    ts: new Date().toISOString(),
  }
  await fs.writeFile(path.join(dir, 'env-anchor.json'), JSON.stringify(anchor, null, 2))

  // eslint-disable-next-line no-console
  console.log(
    `[e2e] serverUp=${serverUp} hasRoleCreds=${hasCreds} baseURL=${BASE_URL}\n` +
      `[e2e] To run authenticated specs, create e2e/.env.e2e with E2E_*_EMAIL / E2E_*_PASSWORD vars (see docs/testing/README.md).`
  )
}