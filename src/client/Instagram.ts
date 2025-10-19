import { IgClient } from './IG-bot/IgClient';
import logger from '../config/logger';
import { botConfig } from '../config/botConfig';

import { smartCommentService } from '../services/smart-comment';

let igClient: IgClient | null = null;

export const getIgClient = async (): Promise<IgClient> => {
    if (!igClient) {
        igClient = new IgClient();
        try {
            await igClient.init();
        } catch (error) {
            logger.error("Failed to initialize Instagram client", error);
            throw error;
        }
    }
    return igClient;
};

export const runBot = async () => {
    logger.info("Manual bot run triggered...");
    await smartCommentService.processTargets(botConfig.target.accounts);
};

export const closeIgClient = async () => {
    if (igClient) {
        await igClient.close();
        igClient = null;
    }
};

// Handler for scraping followers (used by API)
export const scrapeFollowersHandler = async (targetAccount: string, maxFollowers: number) => {
    const client = await getIgClient();
    try {
        const followers = await client.scrapeFollowers(targetAccount, maxFollowers);
        return followers;
    } catch (error) {
        logger.error(`Failed to scrape followers for ${targetAccount}:`, error);
        throw error;
    }
};