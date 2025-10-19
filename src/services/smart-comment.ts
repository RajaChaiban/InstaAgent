/**
 * Smart Comment Service
 * Implements idempotent commenting with intelligent filtering
 */

import logger from '../config/logger';
import { botConfig } from '../config/botConfig';
import PostMemory from '../models/PostMemory';
import { getIgClient } from '../client/Instagram';
import { openRouterService } from './openrouter';

export interface CommentResult {
    targetAccount: string;
    success: boolean;
    action: 'commented' | 'skipped' | 'failed';
    reason?: string;
    postId?: string;
    postUrl?: string;
    captionLength?: number;
    comment?: string;
}

export class SmartCommentService {
    /**
     * Check if a post meets the caption length criteria
     */
    private shouldCommentBasedOnLength(captionLength: number): { allowed: boolean; reason?: string } {
        const config = botConfig.filtering.captionLength;

        if (!config.enabled) {
            return { allowed: true };
        }

        if (captionLength < config.min) {
            return {
                allowed: false,
                reason: `Caption too short (${captionLength} < ${config.min} chars)`
            };
        }

        if (captionLength > config.max) {
            return {
                allowed: false,
                reason: `Caption too long (${captionLength} > ${config.max} chars)`
            };
        }

        return { allowed: true };
    }

    /**
     * Comment on the latest post if it's new and meets all criteria.
     * NEW LOGIC: Fetch last 4 posts, sort by timestamp, comment on latest non-commented post
     */
    async commentOnLatestPost(targetAccount: string): Promise<CommentResult> {
        try {
            logger.info(`[Smart Comment] Processing ${targetAccount}...`);
            const client = await getIgClient();

            // 1. Get the last 4 posts with timestamps (skips pinned posts automatically)
            logger.info(`[Smart Comment] Fetching last 4 posts with timestamps...`);
            const posts = await client.getLastFourPosts(targetAccount);

            if (!posts || posts.length === 0) {
                return {
                    targetAccount,
                    success: true,
                    action: 'skipped',
                    reason: 'No posts found for this account',
                };
            }

            logger.info(`[Smart Comment] Found ${posts.length} posts. Checking age and comment status...`);

            // 2. Filter posts based on age and comment status
            const now = new Date();
            const maxPostAgeDays = botConfig.filtering.maxPostAge.enabled
                ? botConfig.filtering.maxPostAge.days
                : 999; // If disabled, allow very old posts
            const maxPostAgeMs = maxPostAgeDays * 24 * 60 * 60 * 1000;
            const eligiblePosts = [];

            logger.info(`[Smart Comment] Max post age filter: ${botConfig.filtering.maxPostAge.enabled ? maxPostAgeDays + ' days' : 'DISABLED'}`);

            for (const post of posts) {
                const postAge = now.getTime() - post.timestamp.getTime();
                const ageInDays = postAge / (1000 * 60 * 60 * 24);
                const pinStatus = post.isPinned ? 'PINNED' : 'unpinned';

                // Check if post is older than max age (if filtering enabled)
                if (botConfig.filtering.maxPostAge.enabled && postAge > maxPostAgeMs) {
                    logger.info(`[Smart Comment] Post ${post.postId} (${pinStatus}) - TOO OLD (${ageInDays.toFixed(1)} days > ${maxPostAgeDays} days) - SKIPPING`);
                    continue;
                }

                // Check if already commented
                const alreadyCommented = await PostMemory.hasCommented('instagram', targetAccount, post.postId);
                if (alreadyCommented) {
                    logger.info(`[Smart Comment] Post ${post.postId} (${pinStatus}) - Already commented (${ageInDays.toFixed(1)} days old) - SKIPPING`);
                    continue;
                }

                // Post is eligible: within age limit AND not commented (pinned status doesn't matter)
                logger.info(`[Smart Comment] Post ${post.postId} (${pinStatus}) - ELIGIBLE (${ageInDays.toFixed(1)} days old, not commented)`);
                eligiblePosts.push(post);
            }

            // 3. If no eligible posts found, skip this account
            if (eligiblePosts.length === 0) {
                logger.info(`[Smart Comment] No eligible posts for ${targetAccount} (all posts are either >${maxPostAgeDays} days old or already commented) - skipping account`);
                return {
                    targetAccount,
                    success: true,
                    action: 'skipped',
                    reason: `No posts within ${maxPostAgeDays} days or all recent posts already commented on`,
                };
            }

            // 4. Select the LATEST eligible post (they're already sorted by timestamp, newest first)
            const latestEligiblePost = eligiblePosts[0];
            const { postId, postUrl, contentType, timestamp } = latestEligiblePost;

            const ageInDays = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60 * 24);
            logger.info(`[Smart Comment] Selected latest eligible post: ${postId} (${contentType}) - Posted: ${timestamp.toISOString()} (${ageInDays.toFixed(1)} days old)`);

            // 5. Get full post details with visual analysis for the specific post URL
            logger.info(`[Smart Comment] Capturing visuals and analyzing post ${postId}...`);
            const post = await client.getPostDetails(postUrl);
            if (!post) {
                return {
                    targetAccount,
                    success: true,
                    action: 'skipped',
                    reason: 'Failed to get post details',
                };
            }

            const { caption, captionLength, postTimestamp, screenshotBase64, videoFramesBase64 } = post;
            logger.info(`[Smart Comment] Visual capture complete. Caption length: ${captionLength} characters`);

            // 6. Generate comment with vision
            logger.info(`[Smart Comment] Generating comment with ${contentType} analysis...`);
            const comment = await openRouterService.generateInstagramComment(
                caption || '',
                screenshotBase64,
                videoFramesBase64
            );
            if (!comment) {
                throw new Error('AI failed to generate a comment.');
            }
            logger.info(`[Smart Comment] AI generated comment: "${comment}"`);

            // 7. Post the comment (pass URL to support both /p/ and /reel/)
            await client.postComment(postUrl, comment);
            logger.info(`[Smart Comment] ✓ Successfully posted comment on ${postId}`);

            // 8. Record the successful comment in database (saves post ID to prevent duplicates)
            await PostMemory.recordComment({
                platform: 'instagram',
                targetAccount,
                postId,
                postUrl,
                captionLength: captionLength || 0,
                caption,
                commentText: comment,
                wasSuccessful: true,
                metadata: { postTimestamp: timestamp },
            });

            logger.info(`[Smart Comment] ✓ Post ID ${postId} saved to database - will be skipped in future runs`);

            return {
                targetAccount,
                success: true,
                action: 'commented',
                postId,
                postUrl,
                captionLength,
                comment,
            };

        } catch (error: any) {
            logger.error(`[Smart Comment] Error processing ${targetAccount}:`, error);
            return {
                targetAccount,
                success: false,
                action: 'failed',
                reason: error.message || 'Unknown error',
            };
        }
    }

    /**
     * Process multiple target accounts
     */
    async processTargets(targetAccounts: string[]): Promise<CommentResult[]> {
        logger.info(`[Smart Comment] Processing ${targetAccounts.length} target accounts...`);

        const results: CommentResult[] = [];

        for (const targetAccount of targetAccounts) {
            try {
                const result = await this.commentOnLatestPost(targetAccount);
                results.push(result);

                // Add delay between accounts (from config)
                const delay = Math.floor(
                    Math.random() * (botConfig.timing.betweenPosts.max - botConfig.timing.betweenPosts.min) +
                    botConfig.timing.betweenPosts.min
                );
                logger.info(`[Smart Comment] Waiting ${delay}ms before next account...`);
                await new Promise(resolve => setTimeout(resolve, delay));

            } catch (error: any) {
                logger.error(`[Smart Comment] Failed to process ${targetAccount}:`, error);
                results.push({
                    targetAccount,
                    success: false,
                    action: 'failed',
                    reason: error.message || 'Unknown error'
                });
            }
        }

        // Log summary
        const commented = results.filter(r => r.action === 'commented').length;
        const skipped = results.filter(r => r.action === 'skipped').length;
        const failed = results.filter(r => r.action === 'failed').length;

        logger.info(`[Smart Comment] Summary: ${commented} commented, ${skipped} skipped, ${failed} failed`);

        return results;
    }

    /**
     * Get statistics for recent activity
     */
    async getStats(days: number = 7): Promise<any> {
        const stats = await PostMemory.getStats(undefined, days);
        return {
            period: `Last ${days} days`,
            ...stats
        };
    }
}

// Export singleton instance
export const smartCommentService = new SmartCommentService();
