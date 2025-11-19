import { Router, Request, Response } from 'express'
import { env } from '../config/env'
import { config as dbConfig } from '../config/database'
import { cache } from '../services/cacheService'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  let db = { status: 'unknown', version: null as string | null }
  try {
    const stats = await dbConfig.getStats()
    db = { status: stats.isConnected ? 'connected' : 'disconnected', version: stats.version }
  } catch {
    db = { status: 'disconnected', version: null }
  }
  let redis = { available: false }
  try {
    redis = { available: cache.isAvailable() }
  } catch {}
  return res.status(200).json({
    app: 'CLMS Backend',
    version: process.env['npm_package_version'] || '2.0.0',
    environment: env.NODE_ENV,
    db,
    redis,
    timestamp: new Date().toISOString(),
  })
})

export { router as versionRoutes }