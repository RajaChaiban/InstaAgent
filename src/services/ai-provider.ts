/**
 * AI Provider Service
 * Unified interface for multiple AI providers (OpenRouter, Gemini)
 */

import logger from '../config/logger';
import { openRouterService } from './openrouter';
import { runAgent as runGeminiAgent } from '../Agent/index';
import { getInstagramCommentSchema } from '../Agent/schema';

export type AIProvider = 'openrouter' | 'gemini';

export interface CommentResult {
    comment: string;
    viralRate: number;
    commentTokenCount: number;
}

import { botConfig } from '../config/botConfig';

class AIProviderService {
    private provider: AIProvider;

    constructor() {
        this.provider = botConfig.ai.provider as AIProvider;
        logger.info(`AI Provider initialized: ${this.provider}`);
    }

    /**
     * Generate Instagram comments using the configured provider
     */
    async generateInstagramComments(caption: string): Promise<CommentResult[]> {
        try {
            if (this.provider === 'openrouter') {
                return await this.generateWithOpenRouter(caption);
            } else {
                return await this.generateWithGemini(caption);
            }
        } catch (error) {
            logger.error(`AI generation failed with ${this.provider}:`, error);
            throw error;
        }
    }

    /**
     * Generate using OpenRouter
     */
    private async generateWithOpenRouter(caption: string): Promise<CommentResult[]> {
        logger.info('Generating comments with OpenRouter...');

        try {
            const comments = await openRouterService.generateInstagramComments(caption, 3);
            logger.info(`Generated ${comments.length} comments with OpenRouter`);
            return comments;
        } catch (error) {
            logger.error('OpenRouter generation failed:', error);

            // Fallback: generate single comment
            try {
                const comment = await openRouterService.generateInstagramComment(caption);
                return [{
                    comment: comment,
                    viralRate: 75,
                    commentTokenCount: comment.split(' ').length,
                }];
            } catch (fallbackError) {
                logger.error('OpenRouter fallback also failed:', fallbackError);
                throw fallbackError;
            }
        }
    }

    /**
     * Generate using Gemini (uses prompts from config)
     */
    private async generateWithGemini(caption: string): Promise<CommentResult[]> {
        logger.info('Generating comments with Gemini...');

        // Use prompts from config
        const userPrompt = botConfig.ai.prompts.user.replace('{caption}', caption);
        const systemContext = botConfig.ai.prompts.system;

        // Combine system and user prompts for Gemini
        const fullPrompt = `${systemContext}\n\n${userPrompt}`;

        const schema = getInstagramCommentSchema();
        const result = await runGeminiAgent(schema, fullPrompt);

        logger.info(`Generated ${result.length} comments with Gemini`);

        return result;
    }

    /**
     * Get the current provider
     */
    getProvider(): AIProvider {
        return this.provider;
    }

    /**
     * Switch provider dynamically
     */
    setProvider(provider: AIProvider): void {
        this.provider = provider;
        logger.info(`AI Provider switched to: ${this.provider}`);
    }
}

// Export singleton instance
export const aiProviderService = new AIProviderService();
