import express, { Application } from "express";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";
import session from 'express-session';
import logger from "./config/logger";
import { connectDB } from "./config/db";
import { runBot } from "./client/Instagram";
import { schedulerService } from "./services/scheduler";
import { smartCommentService } from "./services/smart-comment";
import { botConfig } from "./config/botConfig";

dotenv.config();

const app: Application = express();

// Connect to database and start scheduler if enabled
connectDB().then(() => {
  if (botConfig.scheduler.enabled) {
    logger.info('[App] Auto-starting scheduler (enabled in config)...');
    schedulerService.start();
  } else {
    logger.info('[App] Scheduler is disabled. Use POST /api/scheduler/start to enable it.');
  }
});

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'supersecretkey',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 2 * 60 * 60 * 1000, sameSite: 'lax' },
}));

// ============================================
// BOT ENDPOINTS
// ============================================

app.post('/api/run-bot', async (req, res) => {
    try {
        logger.info('Received request to run bot...');
        await runBot();
        res.status(200).json({ message: 'Bot run completed successfully.' });
    } catch (error) {
        logger.error('Error running bot:', error);
        res.status(500).json({ error: 'Failed to run bot.' });
    }
});

// ============================================
// SMART COMMENT ENDPOINTS
// ============================================

app.post('/api/smart-comment/run', async (req, res) => {
    try {
        logger.info('Manual smart comment run requested...');
        const targets = req.body.targets || botConfig.target.accounts;
        const results = await smartCommentService.processTargets(targets);
        res.status(200).json({
            success: true,
            message: 'Smart comment run completed',
            results
        });
    } catch (error: any) {
        logger.error('Error running smart comment:', error);
        res.status(500).json({ error: error.message || 'Failed to run smart comment.' });
    }
});

app.get('/api/smart-comment/stats', async (req, res) => {
    try {
        const days = parseInt(req.query.days as string) || 7;
        const stats = await smartCommentService.getStats(days);
        res.status(200).json({ success: true, stats });
    } catch (error: any) {
        logger.error('Error getting stats:', error);
        res.status(500).json({ error: error.message || 'Failed to get stats.' });
    }
});

// ============================================
// SCHEDULER ENDPOINTS
// ============================================

app.post('/api/scheduler/start', async (req, res) => {
    try {
        schedulerService.start();
        const status = schedulerService.getStatus();
        res.status(200).json({
            success: true,
            message: 'Scheduler started',
            status
        });
    } catch (error: any) {
        logger.error('Error starting scheduler:', error);
        res.status(500).json({ error: error.message || 'Failed to start scheduler.' });
    }
});

app.post('/api/scheduler/stop', async (req, res) => {
    try {
        schedulerService.stop();
        const status = schedulerService.getStatus();
        res.status(200).json({
            success: true,
            message: 'Scheduler stopped',
            status
        });
    } catch (error: any) {
        logger.error('Error stopping scheduler:', error);
        res.status(500).json({ error: error.message || 'Failed to stop scheduler.' });
    }
});

app.post('/api/scheduler/run-now', async (req, res) => {
    try {
        logger.info('Manual scheduler run requested...');
        const results = await schedulerService.runNow();
        res.status(200).json({
            success: true,
            message: 'Scheduler run completed',
            results
        });
    } catch (error: any) {
        logger.error('Error running scheduler manually:', error);
        res.status(500).json({ error: error.message || 'Failed to run scheduler.' });
    }
});

app.get('/api/scheduler/status', async (req, res) => {
    try {
        const status = schedulerService.getStatus();
        res.status(200).json({ success: true, status });
    } catch (error: any) {
        logger.error('Error getting scheduler status:', error);
        res.status(500).json({ error: error.message || 'Failed to get status.' });
    }
});

app.get('/api/scheduler/stats', async (req, res) => {
    try {
        const days = parseInt(req.query.days as string) || 7;
        const stats = await schedulerService.getStats(days);
        res.status(200).json({ success: true, stats });
    } catch (error: any) {
        logger.error('Error getting scheduler stats:', error);
        res.status(500).json({ error: error.message || 'Failed to get stats.' });
    }
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;