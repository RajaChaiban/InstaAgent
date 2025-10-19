/**
 * Scheduler Service
 * Runs the smart comment bot at configurable intervals
 */

import cron from 'node-cron';
import logger from '../config/logger';
import { botConfig } from '../config/botConfig';
import { smartCommentService } from './smart-comment';
import { closeIgClient } from '../client/Instagram';

export class SchedulerService {
    private task: cron.ScheduledTask | null = null;
    private isRunning: boolean = false;
    private runCount: number = 0;
    private lastRunTime: Date | null = null;
    private lastRunResults: any = null;

    /**
     * Start the scheduler
     */
    start(): void {
        if (!botConfig.scheduler.enabled) {
            logger.warn('[Scheduler] Scheduler is disabled in botConfig.ts');
            logger.info('[Scheduler] To enable: Set botConfig.scheduler.enabled = true');
            return;
        }

        if (this.task) {
            logger.warn('[Scheduler] Scheduler is already running');
            return;
        }

        const interval = botConfig.scheduler.interval || 10;
        const cronExpression = `*/${interval} * * * *`; // Every X minutes

        logger.info(`[Scheduler] Starting scheduler with ${interval}-minute interval`);
        logger.info(`[Scheduler] Cron expression: ${cronExpression}`);
        logger.info(`[Scheduler] Target accounts: ${botConfig.target.accounts.join(', ')}`);

        this.task = cron.schedule(cronExpression, async () => {
            await this.runScheduledTask();
        });

        logger.info('[Scheduler] ✓ Scheduler started successfully');
        logger.info(`[Scheduler] Next run in ${interval} minutes`);

        // Run on startup if configured
        if (botConfig.scheduler.runOnStartup) {
            logger.info('[Scheduler] Running on startup (runOnStartup=true)...');
            setTimeout(() => this.runScheduledTask(), 2000); // Delay 2s to let server fully start
        }
    }

    /**
     * Stop the scheduler
     */
    stop(): void {
        if (!this.task) {
            logger.warn('[Scheduler] No scheduler running');
            return;
        }

        this.task.stop();
        this.task = null;
        logger.info('[Scheduler] Scheduler stopped');
    }

    /**
     * Run the scheduled task
     */
    private async runScheduledTask(): Promise<void> {
        if (this.isRunning) {
            if (botConfig.scheduler.skipIfRunning) {
                logger.warn('[Scheduler] Previous task still running, skipping this interval (skipIfRunning=true)');
                return;
            }
            logger.warn('[Scheduler] Previous task still running, but proceeding anyway (skipIfRunning=false)');
        }

        this.isRunning = true;
        this.runCount++;
        this.lastRunTime = new Date();

        const runId = `RUN-${this.runCount}`;
        const startTime = Date.now();

        logger.info(`[Scheduler] ========================================`);
        logger.info(`[Scheduler] ${runId} started at ${this.lastRunTime.toISOString()}`);
        logger.info(`[Scheduler] ========================================`);

        try {
            // Get target accounts from config
            const targets = botConfig.target.accounts;

            if (!targets || targets.length === 0) {
                logger.warn('[Scheduler] No target accounts configured in botConfig.ts');
                return;
            }

            logger.info(`[Scheduler] Processing ${targets.length} accounts...`);

            // Process all targets
            const results = await smartCommentService.processTargets(targets);

            // Store results
            this.lastRunResults = {
                runId,
                timestamp: this.lastRunTime,
                duration: Date.now() - startTime,
                targets: targets.length,
                results
            };

            // Log summary if enabled
            if (botConfig.scheduler.logStats) {
                const summary = {
                    commented: results.filter(r => r.action === 'commented').length,
                    skipped: results.filter(r => r.action === 'skipped').length,
                    failed: results.filter(r => r.action === 'failed').length,
                    duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`
                };

                logger.info(`[Scheduler] ========================================`);
                logger.info(`[Scheduler] ${runId} completed`);
                logger.info(`[Scheduler] Summary: ${JSON.stringify(summary, null, 2)}`);
                logger.info(`[Scheduler] ========================================`);
            } else {
                logger.info(`[Scheduler] ${runId} completed (${((Date.now() - startTime) / 1000).toFixed(2)}s)`);
            }

        } catch (error: any) {
            logger.error(`[Scheduler] ${runId} failed:`, error);
            this.lastRunResults = {
                runId,
                timestamp: this.lastRunTime,
                duration: Date.now() - startTime,
                error: error.message
            };
        } finally {
            this.isRunning = false;

            // Optional: Close browser between runs to save resources
            // Uncomment if you want to close the browser after each run
            // await closeIgClient();
            // logger.info('[Scheduler] Browser closed to save resources');
        }
    }

    /**
     * Run immediately (bypass schedule)
     */
    async runNow(): Promise<any> {
        logger.info('[Scheduler] Manual run triggered');
        await this.runScheduledTask();
        return this.lastRunResults;
    }

    /**
     * Get scheduler status
     */
    getStatus(): {
        enabled: boolean;
        running: boolean;
        isExecuting: boolean;
        runCount: number;
        lastRun: Date | null;
        lastResults: any;
        interval: number;
        nextRun: string;
    } {
        const interval = botConfig.scheduler.interval || 10;
        let nextRun = 'Not scheduled';

        if (this.task && this.lastRunTime) {
            const nextRunTime = new Date(this.lastRunTime.getTime() + interval * 60 * 1000);
            nextRun = nextRunTime.toISOString();
        }

        return {
            enabled: botConfig.scheduler.enabled,
            running: this.task !== null,
            isExecuting: this.isRunning,
            runCount: this.runCount,
            lastRun: this.lastRunTime,
            lastResults: this.lastRunResults,
            interval,
            nextRun
        };
    }

    /**
     * Get statistics
     */
    async getStats(days: number = 7): Promise<any> {
        return smartCommentService.getStats(days);
    }
}

// Export singleton instance
export const schedulerService = new SchedulerService();
