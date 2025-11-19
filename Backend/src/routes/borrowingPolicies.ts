/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/authenticate';
import { logger } from '../utils/logger';
import { BorrowingPolicyService } from '../services/borrowingPolicyService';

const router = Router();

// GET /api/policies
router.get(
  '/',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    const policies = await BorrowingPolicyService.listPolicies(false);
    res.json({ success: true, data: policies });
  }),
);

// GET /api/policies/category/:category
router.get(
  '/category/:category',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const policy = await BorrowingPolicyService.getPolicyByCategory(req.params['category']);
    if (!policy) {
      res.status(404).json({ success: false, message: 'Policy not found' });
      return;
    }
    res.json({ success: true, data: policy });
  }),
);

// POST /api/policies
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Create borrowing policy', { body: req.body });
    const { name, category, loan_days, overnight, is_active } = req.body;
    if (!category || loan_days === undefined && !overnight) {
      res.status(400).json({ success: false, message: 'category and loan_days or overnight required' });
      return;
    }
    const created = await BorrowingPolicyService.createPolicy({ name, category, loan_days: loan_days ?? 0, overnight, is_active });
    res.status(201).json({ success: true, data: created });
  }),
);

// PUT /api/policies/:id
router.put(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await BorrowingPolicyService.updatePolicy(req.params['id'], req.body);
    res.json({ success: true, data: updated });
  }),
);

// POST /api/policies/compute-due-date
router.post(
  '/compute-due-date',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { checkoutDate, policyId, category } = req.body;
    if (!checkoutDate || (!policyId && !category)) {
      res.status(400).json({ success: false, message: 'checkoutDate and policyId or category required' });
      return;
    }
    let policy: any = null;
    if (policyId) {
      policy = (await BorrowingPolicyService.listPolicies(false)).find(p => p.id === policyId);
    } else {
      policy = await BorrowingPolicyService.getPolicyByCategory(category);
    }
    if (!policy) {
      const mapCategory = String(category || '').toLowerCase();
      const fallback: Record<string, { loan_days: number; overnight: boolean }> = {
        'filipiniana': { loan_days: 3, overnight: false },
        'general': { loan_days: 3, overnight: false },
        'general collection': { loan_days: 3, overnight: false },
        'fiction': { loan_days: 7, overnight: false },
        'easy books': { loan_days: 1, overnight: true },
      };
      const fb = fallback[mapCategory];
      if (!fb) {
        res.status(404).json({ success: false, message: 'Policy not found' });
        return;
      }
      const dueDate = BorrowingPolicyService.computeDueDate(new Date(checkoutDate), { loan_days: fb.loan_days, overnight: fb.overnight });
      res.json({ success: true, data: { dueDate } });
      return;
    }
    const dueDate = BorrowingPolicyService.computeDueDate(new Date(checkoutDate), { loan_days: policy.loan_days, overnight: policy.overnight });
    res.json({ success: true, data: { dueDate } });
  }),
);

// POST /api/policies/assign-default
router.post(
  '/assign-default',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { bookId, policyId } = req.body;
    if (!bookId || !policyId) {
      res.status(400).json({ success: false, message: 'bookId and policyId are required' });
      return;
    }
    const result = await BorrowingPolicyService.assignDefaultPolicyToBook(bookId, policyId);
    res.json({ success: true, data: result });
  }),
);

export default router;