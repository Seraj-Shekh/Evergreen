import { Router } from 'express';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    success: true,
    status: 'ok',
    service: 'Evergreen Berry Harvest API',
    serverTime: new Date().toISOString(),
  });
});

export default router;
