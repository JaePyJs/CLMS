import { Router, Request, Response } from 'express'
import { ApiResponse } from '@/types'

const router = Router()

router.get('/', (req: Request, res: Response) => {
  const response: ApiResponse = {
    success: true,
    data: { message: 'Activities endpoint - coming soon' },
    timestamp: new Date().toISOString()
  }
  res.json(response)
})

export default router