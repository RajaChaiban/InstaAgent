/**
 * OpenRouter AI Service
 * Provides AI text generation using OpenRouter API
 * Supports multiple models: Claude, GPT-4, Llama, Gemini, etc.
 */

import axios from 'axios';
import logger from '../config/logger';

interface OpenRouterMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface OpenRouterResponse {
    id: string;
    model: string;
    choices: Array<{
        message: {
            role: string;
            content: string;
        };
        finish_reason: string;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

import { botConfig } from '../config/botConfig';

export class OpenRouterService {
    private apiKey: string;
    private model: string;
    private baseUrl = 'https://openrouter.ai/api/v1';

    constructor() {
        this.apiKey = botConfig.ai.openrouter.apiKey || '';
        this.model = botConfig.ai.openrouter.model || 'openai/gpt-4o';

        if (!this.apiKey) {
            logger.warn('OPENROUTER_API_KEY is not set in environment variables or botConfig.ts');
            logger.warn('Please set OPENROUTER_API_KEY in .env file or botConfig.ts');
        } else {
            logger.info(`API Key loaded, starting with: ${this.apiKey.substring(0, 4)}...`);
        }

        logger.info(`OpenRouter initialized with model: ${this.model}`);
    }

    /**
     * Generate text using OpenRouter AI
     */
    async generateText(prompt: string, systemPrompt?: string): Promise<string> {
        try {
            const messages: OpenRouterMessage[] = [];

            if (systemPrompt) {
                messages.push({
                    role: 'system',
                    content: systemPrompt,
                });
            }

            messages.push({
                role: 'user',
                content: prompt,
            });

            logger.info(`Generating AI response using ${this.model}`);

            const response = await axios.post<OpenRouterResponse>(
                `${this.baseUrl}/chat/completions`,
                {
                    model: this.model,
                    messages: messages,
                    temperature: botConfig.ai.openrouter.temperature || 0.7,
                    max_tokens: botConfig.ai.openrouter.maxTokens || 500,
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'HTTP-Referer': 'https://github.com/your-repo', // Optional
                        'X-Title': 'Riona AI Agent', // Optional
                        'Content-Type': 'application/json',
                    },
                }
            );

            const content = response.data.choices[0]?.message?.content;

            if (!content) {
                throw new Error('No content returned from OpenRouter');
            }

            logger.info(`AI response generated (${response.data.usage.total_tokens} tokens)`);

            return content.trim();

        } catch (error: any) {
            if (error.response) {
                logger.error('OpenRouter API error:', {
                    status: error.response.status,
                    data: error.response.data,
                });
                throw new Error(`OpenRouter API error: ${error.response.data.error?.message || error.response.statusText}`);
            } else {
                logger.error('OpenRouter request failed:', error.message);
                throw error;
            }
        }
    }

    /**
     * Generate Instagram comment using prompts from config (with vision support)
     */
    async generateInstagramComment(
        caption: string,
        imageBase64?: string,
        videoFramesBase64?: string[]
    ): Promise<string> {
        // If we have images/video frames, use vision API
        if (imageBase64 || (videoFramesBase64 && videoFramesBase64.length > 0)) {
            return this.generateCommentWithVision(caption, imageBase64, videoFramesBase64);
        }

        // Fallback to text-only
        const systemPrompt = botConfig.ai.prompts.system;
        const userPrompt = botConfig.ai.prompts.user.replace('{caption}', caption);

        return this.generateText(userPrompt, systemPrompt);
    }

    /**
     * Generate comment using vision API (GPT-4 Vision, Claude 3 Vision, etc.)
     */
    private async generateCommentWithVision(
        caption: string,
        imageBase64?: string,
        videoFramesBase64?: string[]
    ): Promise<string> {
        try {
            const systemPrompt = botConfig.ai.prompts.system;

            // Build user message with images
            const contentParts: any[] = [];

            // Add text instruction
            if (caption && caption.length > 0) {
                contentParts.push({
                    type: 'text',
                    text: `Caption: "${caption}"\n\nAnalyze the image/video and write a natural, authentic Instagram comment that responds to BOTH the caption and the visual content. Be specific about what you see.`
                });
            } else {
                contentParts.push({
                    type: 'text',
                    text: `This post has no caption. Analyze the image/video and write a natural, authentic Instagram comment about what you see. Be specific and genuine.`
                });
            }

            // Add image or video frames
            if (imageBase64) {
                contentParts.push({
                    type: 'image_url',
                    image_url: {
                        url: `data:image/jpeg;base64,${imageBase64}`
                    }
                });
                logger.info('Using vision API with image');
            } else if (videoFramesBase64 && videoFramesBase64.length > 0) {
                // Add up to 3 frames for video context
                videoFramesBase64.slice(0, 3).forEach((frame, index) => {
                    contentParts.push({
                        type: 'image_url',
                        image_url: {
                            url: `data:image/jpeg;base64,${frame}`
                        }
                    });
                });
                logger.info(`Using vision API with ${videoFramesBase64.length} video frames`);
            }

            const messages = [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: contentParts
                }
            ];

            logger.info(`Generating AI response with vision using ${this.model}`);

            const response = await axios.post<OpenRouterResponse>(
                `${this.baseUrl}/chat/completions`,
                {
                    model: this.model,
                    messages: messages,
                    temperature: botConfig.ai.openrouter.temperature || 0.7,
                    max_tokens: botConfig.ai.openrouter.maxTokens || 500,
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'HTTP-Referer': 'https://github.com/your-repo',
                        'X-Title': 'Riona AI Agent',
                        'Content-Type': 'application/json',
                    },
                }
            );

            const content = response.data.choices[0]?.message?.content;

            if (!content) {
                throw new Error('No content returned from OpenRouter vision API');
            }

            logger.info(`AI vision response generated (${response.data.usage.total_tokens} tokens)`);

            return content.trim();

        } catch (error: any) {
            logger.error('Vision API failed, falling back to text-only:', error.message);
            // Fallback to text-only if vision fails
            const systemPrompt = botConfig.ai.prompts.system;
            const userPrompt = botConfig.ai.prompts.user.replace('{caption}', caption || 'No caption');
            return this.generateText(userPrompt, systemPrompt);
        }
    }

    /**
     * Generate multiple comment options and select the best one
     */
    async generateInstagramComments(caption: string, count?: number): Promise<Array<{
        comment: string;
        viralRate: number;
        commentTokenCount: number;
    }>> {
        // Use count from config if not provided
        const variantsCount = count || botConfig.ai.generation.variantsCount || 3;

        const systemPrompt = `You are an expert at creating viral Instagram comments.
Generate ${variantsCount} different comment options for the given post.
Each comment should be unique and engaging.

Return a JSON array with this exact format:
[
  {
    "comment": "the actual comment text",
    "viralRate": 85,
    "commentTokenCount": 25
  }
]

Rules:
- Each comment: 150-250 characters
- viralRate: 0-100 (how likely to get likes/replies)
- commentTokenCount: approximate word count
- Vary the tone and style across options
- Make them feel human and authentic`;

        const prompt = `Post caption: "${caption}"

Generate ${variantsCount} comment options as a JSON array.`;

        try {
            const response = await this.generateText(prompt, systemPrompt);

            // Try to parse JSON response
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const comments = JSON.parse(jsonMatch[0]);
                return comments;
            }

            // Fallback: treat as single comment
            return [{
                comment: response,
                viralRate: 75,
                commentTokenCount: response.split(' ').length,
            }];

        } catch (error) {
            logger.error('Failed to parse AI response as JSON, using fallback');
            // Fallback: generate single comment
            const comment = await this.generateInstagramComment(caption);
            return [{
                comment: comment,
                viralRate: 70,
                commentTokenCount: comment.split(' ').length,
            }];
        }
    }
}

// Export singleton instance
export const openRouterService = new OpenRouterService();
