/**
 * Simple Script: Comment on a Specific Instagram User's Posts
 *
 * Usage:
 *   1. Make sure MongoDB is running: docker-compose up -d
 *   2. Edit src/config/botConfig.ts to configure target username and settings
 *   3. Run: npx tsc && node build/scripts/comment-on-user.js
 */

import logger from '../config/logger';
import { botConfig } from '../config/botConfig';
import { smartCommentService } from '../services/smart-comment';
import { connectDB } from '../config/db';

async function commentOnUser() {
    // ========================================
    // 🎯 ALL SETTINGS ARE IN: src/config/botConfig.ts
    // ========================================
    const targetAccounts = botConfig.target.accounts;  // Array of usernames

    logger.info(`🤖 Starting Instagram Bot`);
    logger.info(`👥 Target Accounts: ${targetAccounts.join(', ')}`);
    logger.info(`🤖 Using AI: ${botConfig.ai.provider} (${botConfig.ai.openrouter.model})`);
    logger.info('================================================');

    try {
        // Connect to the database
        await connectDB();

        // Use the smart comment service to process the accounts
        const results = await smartCommentService.processTargets(targetAccounts);

        logger.info(`\n${'='.repeat(60)}`);
        logger.info('🎉 All done! Successfully commented on all accounts!');
        logger.info(`📊 Summary: ${JSON.stringify(results, null, 2)}`);
        logger.info(`${'='.repeat(60)}`);

    } catch (error) {
        logger.error('❌ Error occurred:', error);
        throw error;
    } finally {
        // The service will handle closing the client if necessary
        process.exit(0);
    }
}

// Run the script
commentOnUser().catch(error => {
    logger.error('Fatal error:', error);
    process.exit(1);
});
