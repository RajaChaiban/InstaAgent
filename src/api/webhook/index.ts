/**
 * 🔗 WEBHOOK API FOR N8N INTEGRATION
 *
 * This endpoint allows n8n (or any external service) to trigger the Instagram bot
 * by sending HTTP POST requests with target accounts and configuration.
 */

import express, { Request, Response } from 'express';
import { smartCommentService } from '../../services/smart-comment';
import logger from '../../config/logger';
import { botConfig } from '../../config/botConfig';

const router = express.Router();

// Store active jobs to prevent duplicates
const activeJobs = new Map<string, boolean>();

/**
 * POST /api/webhook/run-bot
 *
 * Trigger the Instagram bot to comment on accounts
 *
 * Request Body:
 * {
 *   "accounts": ["username1", "username2"],  // Required: Array of Instagram usernames
 *   "postsPerAccount": 1,                     // Optional: Number of posts to comment on per account
 *   "apiKey": "your-secret-key"               // Optional: For authentication
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Bot started successfully",
 *   "jobId": "job-123456",
 *   "accounts": ["username1", "username2"],
 *   "postsPerAccount": 1
 * }
 */
router.post('/run-bot', async (req: Request, res: Response) => {
    try {
        // Extract data from request
        const {
            accounts,
            postsPerAccount = 1, // This is now handled by the botConfig, but we can leave it for compatibility
            apiKey
        } = req.body;

        // ============================================
        // VALIDATION
        // ============================================

        // Check API key (optional - remove if not needed)
        const WEBHOOK_API_KEY = process.env.WEBHOOK_API_KEY;
        if (WEBHOOK_API_KEY && apiKey !== WEBHOOK_API_KEY) {
            return res.status(401).json({
                success: false,
                error: 'Invalid API key'
            });
        }

        // Validate accounts array
        if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Missing or invalid "accounts" array. Expected: ["username1", "username2"]'
            });
        }

        // Validate account usernames
        for (const account of accounts) {
            if (typeof account !== 'string' || account.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid account username: "${account}". Must be non-empty string.`
                });
            }
        }

        // Generate unique job ID
        const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Check if job already running for these accounts
        const jobKey = accounts.sort().join(',');
        if (activeJobs.has(jobKey)) {
            return res.status(409).json({
                success: false,
                error: 'Bot is already running for these accounts. Please wait for completion.',
                accounts: accounts
            });
        }

        // Mark job as active
        activeJobs.set(jobKey, true);

        // ============================================
        // RESPOND IMMEDIATELY (Don't wait for completion)
        // ============================================
        res.status(202).json({
            success: true,
            message: 'Bot job accepted and started',
            jobId: jobId,
            accounts: accounts,
            status: 'processing'
        });

        // ============================================
        // RUN BOT IN BACKGROUND (Async)
        // ============================================
        runBotInBackground(accounts, jobId, jobKey).catch(error => {
            logger.error(`Job ${jobId} failed:`, error);
        });

    } catch (error: any) {
        logger.error('Webhook error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * GET /api/webhook/status/:jobId
 *
 * Check the status of a bot job
 */
router.get('/status/:jobId', (req: Request, res: Response) => {
    const { jobId } = req.params;

    // In production, you'd store this in Redis or database
    // For now, just return a basic response
    res.json({
        success: true,
        jobId: jobId,
        status: 'completed',
        message: 'Job status endpoint (implement with database for production)'
    });
});

/**
 * POST /api/webhook/test
 *
 * Test endpoint to verify webhook is working
 */
router.post('/test', (req: Request, res: Response) => {
    logger.info('Webhook test endpoint called');
    res.json({
        success: true,
        message: 'Webhook is working!',
        receivedData: req.body,
        timestamp: new Date().toISOString(),
        botConfig: {
            accounts: botConfig.target.accounts,
            postsPerAccount: botConfig.target.maxPostsToInteract,
            aiProvider: botConfig.ai.provider,
            aiModel: botConfig.ai.openrouter.model
        }
    });
});

// ============================================
// BACKGROUND BOT EXECUTION FUNCTION
// ============================================

async function runBotInBackground(
    accounts: string[],
    jobId: string,
    jobKey: string
) {
    try {
        logger.info(`[${jobId}] Starting bot for accounts: ${accounts.join(', ')}`);
        
        // Use the smart comment service to process the accounts
        const results = await smartCommentService.processTargets(accounts);

        logger.info(`[${jobId}] Bot job completed successfully`);
        logger.info(`[${jobId}] Summary: ${JSON.stringify(results, null, 2)}`);

    } catch (error: any) {
        logger.error(`[${jobId}] Bot job failed:`, error);
        throw error;
    } finally {
        // Clean up
        activeJobs.delete(jobKey);
        logger.info(`[${jobId}] Job finished, resources released`);
    }
}

// Helper function
function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export default router;
