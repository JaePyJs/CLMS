import { Router, Request, Response } from 'express';
import { LeaderboardService } from '../services/LeaderboardService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @swagger
 * /leaderboard/monthly:
 *   get:
 *     summary: Get monthly student leaderboard
 *     tags: [Leaderboard]
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         required: true
 *   post:
 *     summary: Generate monthly rewards (Admin only)
 *     tags: [Leaderboard]
 *     responses:
 *       200:
 *         description: Rewards generated successfully
 */
router.get('/monthly', async (req: Request, res: Response) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month =
      parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const gradeLevel = req.query.gradeLevel
      ? parseInt(req.query.gradeLevel as string)
      : undefined;
    const section = req.query.section as string | undefined;

    const leaderboard = await LeaderboardService.getMonthlyLeaderboard(
      year,
      month,
      limit,
      gradeLevel,
      section,
    );
    res.json(leaderboard);
  } catch (error) {
    logger.error('Error fetching monthly leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch monthly leaderboard' });
  }
});

router.get('/yearly', async (req: Request, res: Response) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const limit = parseInt(req.query.limit as string) || 100;
    const gradeLevel = req.query.gradeLevel
      ? parseInt(req.query.gradeLevel as string)
      : undefined;
    const section = req.query.section as string | undefined;

    const leaderboard = await LeaderboardService.getYearlyLeaderboard(
      year,
      limit,
      gradeLevel,
      section,
    );
    res.json(leaderboard);
  } catch (error) {
    logger.error('Error fetching yearly leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch yearly leaderboard' });
  }
});
router.post('/rewards/generate', async (req: Request, res: Response) => {
  try {
    const { year, month } = req.body;

    if (!year || !month) {
      return res.status(400).json({ error: 'Year and month are required' });
    }

    const result = await LeaderboardService.generateMonthlyRewards(
      Number(year),
      Number(month),
    );

    res.json(result);
  } catch (error) {
    logger.error('Error generating rewards:', error);
    res.status(500).json({ error: 'Failed to generate rewards' });
  }
});

/**
 * @swagger
 * /leaderboard/reset:
 *   post:
 *     summary: Reset leaderboard statistics (Admin only)
 *     tags: [Leaderboard]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               year:
 *                 type: integer
 *               month:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Leaderboard reset successfully
 */
router.post('/reset', async (req: Request, res: Response) => {
  try {
    const { year, month } = req.body;

    // Validate: if month is provided, year must also be provided
    if (month && !year) {
      return res
        .status(400)
        .json({ error: 'Year is required when specifying month' });
    }

    const result = await LeaderboardService.resetLeaderboard(
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
    );

    res.json({
      success: true,
      message:
        year && month
          ? `Leaderboard reset for ${month}/${year}`
          : year
            ? `Leaderboard reset for year ${year}`
            : 'Entire leaderboard reset',
      recordsDeleted: result.count,
    });
  } catch (error) {
    logger.error('Error resetting leaderboard:', error);
    res.status(500).json({ error: 'Failed to reset leaderboard' });
  }
});

export const leaderboardRoutes = router;
