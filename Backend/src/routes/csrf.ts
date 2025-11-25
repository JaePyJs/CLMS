import { Router, Request, Response } from 'express';
import csrf from 'csurf';

const router = Router();

// CSRF protection middleware
const csrfProtection = csrf({ cookie: true });

/**
 * @swagger
 * /csrf-token:
 *   get:
 *     tags: [Security]
 *     summary: Get CSRF token
 *     description: Returns a CSRF token that must be included in subsequent state-changing requests
 *     responses:
 *       200:
 *         description: CSRF token generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 csrfToken:
 *                   type: string
 *                   description: CSRF token to include in X-CSRF-Token header
 */
router.get('/csrf-token', csrfProtection, (req: Request, res: Response) => {
  res.json({ csrfToken: req.csrfToken() });
});

export { router as csrfRoutes, csrfProtection };
