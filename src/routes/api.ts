import express from 'express';
import agentRoutes from '../api/agent';
import webhookRoutes from '../api/webhook';

const router = express.Router();

// Mount agent routes
router.use('/agent', agentRoutes);

// Mount webhook routes (for n8n integration)
router.use('/webhook', webhookRoutes);

export default router;
