import * as puppeteer from 'puppeteer';
import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import AdblockerPlugin from "puppeteer-extra-plugin-adblocker";
import UserAgent from "user-agents";
import { Server } from "proxy-chain";
import { botConfig } from "../../config/botConfig";
import logger from "../../config/logger";
import { Instagram_cookiesExist, loadCookies, saveCookies } from "../../utils";
import { aiProviderService } from "../../services/ai-provider";
import readline from "readline";
import fs from "fs/promises";
import { getShouldExitInteractions } from '../../api/agent';

puppeteerExtra.use(StealthPlugin());
puppeteerExtra.use(
  AdblockerPlugin({
    interceptResolutionPriority: puppeteer.DEFAULT_INTERCEPT_RESOLUTION_PRIORITY,
  })
);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const randomDelay = (min: number = 1000, max: number = 3000) => {
    const randomMs = Math.floor(Math.random() * (max - min + 1)) + min;
    logger.info(`⏰ Random delay: ${(randomMs / 1000).toFixed(1)}s`);
    return new Promise((resolve) => setTimeout(resolve, randomMs));
};

async function humanLikeClick(page: puppeteer.Page, selector: string) {
    await page.waitForSelector(selector, { visible: true });
    const element = await page.$(selector);
    if (!element) throw new Error(`Element not found: ${selector}`);

    const box = await element.boundingBox();
    if (!box) throw new Error(`Element bounding box not found: ${selector}`);

    const x = box.x + box.width / 2 + (Math.random() - 0.5) * box.width * 0.2;
    const y = box.y + box.height / 2 + (Math.random() - 0.5) * box.height * 0.2;

    await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 10) + 5 });
    await randomDelay(200, 500);
    await page.mouse.down();
    await randomDelay(50, 150);
    await page.mouse.up();
}

async function humanLikeType(page: puppeteer.Page, selector: string, text: string) {
    await page.waitForSelector(selector, { visible: true });
    await humanLikeClick(page, selector);

    for (const char of text) {
        await page.keyboard.type(char, { delay: Math.random() * 150 + 50 });
    }
}

export class IgClient {
    private browser: puppeteer.Browser | null = null;
    private page: puppeteer.Page | null = null;
    private username: string;
    private password: string;

    constructor() {
        this.username = botConfig.instagram.username;
        this.password = botConfig.instagram.password;

        logger.info(`IgClient initialized with username: ${this.username}`);

        if (!this.username || this.username === 'YOUR_INSTAGRAM_USERNAME') {
            logger.error('Instagram username is not set! Check your botConfig.ts file.');
        }
        if (!this.password || this.password === 'YOUR_INSTAGRAM_PASSWORD') {
            logger.error('Instagram password is not set! Check your botConfig.ts file.');
        }
    }

    async init() {
        const width = 1280;
        const height = 800;
        const screenWidth = 1920;
        const screenHeight = 1080;
        const left = Math.floor((screenWidth - width) / 2);
        const top = Math.floor((screenHeight - height) / 2);
        this.browser = await puppeteerExtra.launch({
            headless: false,
            args: [
                `--window-size=${width},${height}`,
                `--window-position=${left},${top}`
            ],
        });
        this.page = await this.browser.newPage();
        const userAgent = new UserAgent({ deviceCategory: "desktop" });
        await this.page.setUserAgent(userAgent.toString());
        await this.page.setViewport({ width, height });

        if (await Instagram_cookiesExist()) {
            await this.loginWithCookies();
        } else {
            await this.loginWithCredentials();
        }
    }

    private async loginWithCookies() {
        if (!this.page) throw new Error("Page not initialized");
        const cookies = await loadCookies("./cookies/Instagramcookies.json");
        if(cookies.length > 0) {
            await this.page.setCookie(...cookies);
        }
        
        logger.info("Loaded cookies. Navigating to Instagram home page.");
        await this.page.goto("https://www.instagram.com/", {
            waitUntil: "networkidle2",
        });
        const url = this.page.url();
        if (url.includes("/login/")) {
            logger.warn("Cookies are invalid or expired. Falling back to credentials login.");
            await this.loginWithCredentials();
        } else {
            logger.info("Successfully logged in with cookies.");
        }
    }

    private async loginWithCredentials() {
        if (!this.page || !this.browser) throw new Error("Browser/Page not initialized");
        logger.info("Logging in with credentials...");
        logger.info(`Using username: ${this.username}`);

        await this.page.goto("https://www.instagram.com/accounts/login/", {
            waitUntil: "networkidle2",
        });

        await randomDelay(2000, 4000);
        logger.info("Login page loaded. Waiting for input fields...");

        logger.info("Typing username...");
        await humanLikeType(this.page, 'input[name="username"]', this.username);

        logger.info("Username filled.");
        await randomDelay(2000, 5000);

        logger.info("Typing password...");
        await humanLikeType(this.page, 'input[name="password"]', this.password);

        logger.info("Password filled.");
        await randomDelay(2000, 5000);

        logger.info("Clicking login button...");
        await humanLikeClick(this.page, 'button[type="submit"]');

        logger.info("Waiting for login to complete...");
        await this.page.waitForNavigation({ waitUntil: "networkidle2" });

        const cookies = await this.page.cookies();
        await saveCookies("./cookies/Instagramcookies.json", cookies);
        logger.info("Successfully logged in and saved cookies.");

        await this.handleNotificationPopup();
    }

    async handleNotificationPopup() {
        if (!this.page) throw new Error("Page not initialized");
        console.log("Checking for notification popup...");

        try {
            const dialogSelector = 'div[role="dialog"]';
            await this.page.waitForSelector(dialogSelector, { timeout: 5000 });
            const dialog = await this.page.$(dialogSelector);

            if (dialog) {
                console.log("Notification dialog found. Searching for 'Not Now' button.");
                const notNowButtonSelectors = ["button", `div[role="button"]`];
                let notNowButton: puppeteer.ElementHandle<Element> | null = null;

                for (const selector of notNowButtonSelectors) {
                    const elements = await dialog.$$(selector);
                    for (const element of elements) {
                        try {
                            const text = await element.evaluate((el) => el.textContent);
                            if (text && text.trim().toLowerCase() === "not now") {
                                notNowButton = element;
                                console.log(`Found 'Not Now' button with selector: ${selector}`);
                                break;
                            }
                        } catch (e) {
                        }
                    }
                    if (notNowButton) break;
                }

                if (notNowButton) {
                    try {
                        console.log("Dismissing 'Not Now' notification popup...");
                        await notNowButton.evaluate((btn:any) => btn.click());
                        await delay(1500);
                        console.log("'Not Now' notification popup dismissed.");
                    } catch (e) {
                        console.warn("Failed to click 'Not Now' button. It might be gone or covered.", e);
                    }
                } else {
                    console.log("'Not Now' button not found within the dialog.");
                }
            }
        } catch (error) {
            console.log("No notification popup appeared within the timeout period.");
        }
    }

    async sendDirectMessage(username: string, message: string) {
        if (!this.page) throw new Error("Page not initialized");
        try {
            await this.sendDirectMessageWithMedia(username, message);
        } catch (error) {
            logger.error("Failed to send direct message", error);
            throw error;
        }
    }

    async sendDirectMessageWithMedia(username: string, message: string, mediaPath?: string) {
        if (!this.page) throw new Error("Page not initialized");
        try {
            await this.page.goto(`https://www.instagram.com/${username}/`, {
                waitUntil: "networkidle2",
            });
            console.log("Navigated to user profile");
            await delay(3000);

            const messageButtonSelectors = ['div[role="button"]', "button", 'a[href*="/direct/t/"]', 'div[role="button"] span', 'div[role="button"] div'];
            let messageButton: puppeteer.ElementHandle<Element> | null = null;
            for (const selector of messageButtonSelectors) {
                const elements = await this.page.$$(selector);
                for (const element of elements) {
                    const text = await element.evaluate((el: Element) => el.textContent);
                    if (text && text.trim() === "Message") {
                        messageButton = element;
                        break;
                    }
                }
                if (messageButton) break;
            }
            if (!messageButton) throw new Error("Message button not found.");
            await messageButton.click();
            await delay(2000);
            await this.handleNotificationPopup();

            if (mediaPath) {
                const fileInput = await this.page.$('input[type="file"]');
                if (fileInput) {
                    await fileInput.uploadFile(mediaPath);
                    await this.handleNotificationPopup();
                    await delay(2000);
                } else {
                    logger.warn("File input for media not found.");
                }
            }

            const messageInputSelectors = ['textarea[placeholder="Message..."]', 'div[role="textbox"]', 'div[contenteditable="true"]', 'textarea[aria-label="Message"]'];
            let messageInput: puppeteer.ElementHandle<Element> | null = null;
            for (const selector of messageInputSelectors) {
                messageInput = await this.page.$(selector);
                if (messageInput) break;
            }
            if (!messageInput) throw new Error("Message input not found.");
            await messageInput.type(message);
            await this.handleNotificationPopup();
            await delay(2000);

            const sendButtonSelectors = ['div[role="button"]', "button"];
            let sendButton: puppeteer.ElementHandle<Element> | null = null;
            for (const selector of sendButtonSelectors) {
                const elements = await this.page.$$(selector);
                for (const element of elements) {
                    const text = await element.evaluate((el: Element) => el.textContent);
                    if (text && text.trim() === "Send") {
                        sendButton = element;
                        break;
                    }
                }
                if (sendButton) break;
            }
            if (!sendButton) throw new Error("Send button not found.");
            await sendButton.click();
            await this.handleNotificationPopup();
            console.log("Message sent successfully");
        } catch (error) {
            logger.error(`Failed to send DM to ${username}`, error);
            throw error;
        }
    }

    async sendDirectMessagesFromFile(file: Buffer | string, message: string, mediaPath?: string) {
        if (!this.page) throw new Error("Page not initialized");
        logger.info(`Sending DMs from provided file content`);
        let fileContent: string;
        if (Buffer.isBuffer(file)) {
            fileContent = file.toString('utf-8');
        } else {
            fileContent = file;
        }
        const usernames = fileContent.split("\n");
        for (const username of usernames) {
            if (username.trim()) {
                await this.handleNotificationPopup();
                await this.sendDirectMessageWithMedia(username.trim(), message, mediaPath);
                await this.handleNotificationPopup();
                await delay(30000);
            }
        }
    }

    async interactWithPostsCustom(maxPosts: number = 5) {
        return this.interactWithPosts(maxPosts);
    }

    async navigateToUser(username: string) {
        if (!this.page) throw new Error("Page not initialized");
        await this.page.goto(`https://www.instagram.com/${username}/`, {
            waitUntil: "networkidle2",
        });
    }

    async interactWithPosts(maxPostsParam?: number) {
        if (!this.page) throw new Error("Page not initialized");
        let postIndex = 1;
        const maxPosts = maxPostsParam || 20;
        const page = this.page;
        while (postIndex <= maxPosts) {
            if (typeof getShouldExitInteractions === 'function' && getShouldExitInteractions()) {
                console.log('Exit from interactions requested. Stopping loop.');
                break;
            }
            try {
                const postSelector = `article:nth-of-type(${postIndex})`;
                if (!(await page.$(postSelector))) {
                    console.log("No more posts found. Ending iteration...");
                    return;
                }
                const likeButtonSelector = `${postSelector} svg[aria-label="Like"]`;
                const likeButton = await page.$(likeButtonSelector);
                let ariaLabel = null;
                if (likeButton) {
                    ariaLabel = await likeButton.evaluate((el: Element) => el.getAttribute("aria-label"));
                }
                if (ariaLabel === "Like" && likeButton) {
                    console.log(`Liking post ${postIndex}...`);
                    await likeButton.click();
                    await page.keyboard.press("Enter");
                    console.log(`Post ${postIndex} liked.`);
                } else if (ariaLabel === "Unlike") {
                    console.log(`Post ${postIndex} is already liked.`);
                } else {
                    console.log(`Like button not found for post ${postIndex}.`);
                }
                const captionSelector = `${postSelector} div.x9f619 span._ap3a div span._ap3a`;
                const captionElement = await page.$(captionSelector);
                let caption = "";
                if (captionElement) {
                    caption = await captionElement.evaluate((el) => (el as HTMLElement).innerText);
                    console.log(`Caption for post ${postIndex}: ${caption}`);
                } else {
                    console.log(`No caption found for post ${postIndex}.`);
                }
                const moreLinkSelector = `${postSelector} div.x9f619 span._ap3a span div span.x1lliihq`;
                const moreLink = await page.$(moreLinkSelector);
                if (moreLink && captionElement) {
                    console.log(`Expanding caption for post ${postIndex}...`);
                    await moreLink.click();
                    const expandedCaption = await captionElement.evaluate((el) => (el as HTMLElement).innerText);
                    console.log(
                        `Expanded Caption for post ${postIndex}: ${expandedCaption}`
                    );
                    caption = expandedCaption;
                }
                const commentBoxSelector = `${postSelector} textarea`;
                const commentBox = await page.$(commentBoxSelector);
                if (commentBox) {
                    console.log(`Commenting on post ${postIndex}...`);

                    const result = await aiProviderService.generateInstagramComments(caption);
                    const comment = (result[0]?.comment ?? "") as string;

                    console.log(`Generated comment: "${comment}"`);
                    await commentBox.type(comment);
                    const postButton = await page.evaluateHandle(() => {
                        const buttons = Array.from(
                            document.querySelectorAll('div[role="button"]')
                        );
                        return buttons.find(
                            (button) =>
                                button.textContent === "Post" && !button.hasAttribute("disabled")
                        );
                    });
                    const postButtonElement = postButton && postButton.asElement ? postButton.asElement() : null;
                    if (postButtonElement) {
                        console.log(`Posting comment on post ${postIndex}...`);
                        await (postButtonElement as puppeteer.ElementHandle<Element>).click();
                        console.log(`Comment posted on post ${postIndex}.`);
                        await delay(2000);
                    } else {
                        console.log("Post button not found.");
                    }
                } else {
                    console.log("Comment box not found.");
                }
                const waitTime = Math.floor(Math.random() * 5000) + 5000;
                console.log(
                    `Waiting ${waitTime / 1000} seconds before moving to the next post...`
                );
                await delay(waitTime);
                await delay(1000);
                await page.evaluate(() => {
                    window.scrollBy(0, window.innerHeight);
                });
                postIndex++;
            } catch (error) {
                console.error(`Error interacting with post ${postIndex}:`, error);
                break;
            }
        }
    }

    async scrapeFollowers(targetAccount: string, maxFollowers: number) {
        if (!this.page) throw new Error("Page not initialized");
        const page = this.page;
        try {
            await page.goto(`https://www.instagram.com/${targetAccount}/followers/`, {
                waitUntil: "networkidle2",
            });
            console.log(`Navigated to ${targetAccount}'s followers page`);

            try {
                await page.waitForSelector('div a[role="link"] span[title]');
            } catch {
                await page.waitForSelector('div[role="dialog"]');
            }
            console.log("Followers modal loaded");

            const followers: string[] = [];
            let previousHeight = 0;
            let currentHeight = 0;
            maxFollowers = maxFollowers + 4;
            console.log(maxFollowers);
            while (followers.length < maxFollowers) {
                const newFollowers = await page.evaluate(() => {
                    const followerElements =
                        document.querySelectorAll('div a[role="link"]');
                    return Array.from(followerElements)
                        .map((element) => element.getAttribute("href"))
                        .filter(
                            (href): href is string => href !== null && href.startsWith("/")
                        )
                        .map((href) => href.substring(1));
                });

                for (const follower of newFollowers) {
                    if (!followers.includes(follower) && followers.length < maxFollowers) {
                        followers.push(follower);
                        console.log(`Found follower: ${follower}`);
                    }
                }

                await page.evaluate(() => {
                    const dialog = document.querySelector('div[role="dialog"]');
                    if (dialog) {
                        dialog.scrollTop = dialog.scrollHeight;
                    }
                });

                await delay(1000);

                currentHeight = await page.evaluate(() => {
                    const dialog = document.querySelector('div[role="dialog"]');
                    return dialog ? dialog.scrollHeight : 0;
                });

                if (currentHeight === previousHeight) {
                    console.log("Reached the end of followers list");
                    break;
                }

                previousHeight = currentHeight;
            }

            console.log(`Successfully scraped ${followers.length - 4} followers`);
            return followers.slice(4, maxFollowers);
        } catch (error) {
            console.error(`Error scraping followers for ${targetAccount}:`, error);
            throw error;
        }
    }

    /**
     * Get the last 4 posts with their IDs and timestamps (lightweight - no screenshots)
     * Includes scrolling to ensure we find the 4th post
     * INCLUDES BOTH PINNED AND UNPINNED POSTS - filtering by timestamp only
     */
    async getLastFourPosts(targetAccount: string): Promise<Array<{
        postId: string;
        postUrl: string;
        contentType: 'image' | 'video' | 'reel';
        timestamp: Date;
        isPinned: boolean;
    }>> {
        if (!this.page) throw new Error("Page not initialized");
        logger.info(`Navigating to ${targetAccount}'s profile...`);
        await this.page.goto(`https://www.instagram.com/${targetAccount}/`, {
            waitUntil: "networkidle2",
        });
        await randomDelay(2000, 4000);
        await this.handleNotificationPopup();

        logger.info("Looking for the last 4 posts (including both pinned and unpinned)...");

        // Function to get ALL post links (pinned AND unpinned)
        const getAllPosts = async () => {
            return await this.page!.evaluate(() => {
                const allLinks = Array.from(document.querySelectorAll('a[href]'));
                const seenPosts = new Set<string>();
                const postsWithPinStatus: Array<{ href: string; isPinned: boolean }> = [];

                allLinks.forEach(link => {
                    const href = link.getAttribute('href');
                    if (!href || (!href.includes('/p/') && !href.includes('/reel/'))) {
                        return;
                    }

                    // Skip duplicates
                    if (seenPosts.has(href)) {
                        return;
                    }

                    // Check if this post is pinned
                    let currentElement: HTMLElement | null = link as HTMLElement;
                    let isPinned = false;

                    for (let i = 0; i < 10; i++) {
                        if (!currentElement) break;

                        const pinIcon = currentElement.querySelector('svg[aria-label*="Pinned"]') ||
                                        currentElement.querySelector('svg[aria-label*="pinned"]') ||
                                        currentElement.querySelector('svg[aria-label*="Pin"]') ||
                                        currentElement.querySelector('svg[aria-label*="pin"]') ||
                                        currentElement.querySelector('svg[aria-label*="Thumbtack"]') ||
                                        currentElement.querySelector('svg[aria-label*="thumbtack"]') ||
                                        currentElement.querySelector('svg[aria-label*="Pushpin"]') ||
                                        currentElement.querySelector('svg[aria-label*="pushpin"]');

                        if (pinIcon) {
                            isPinned = true;
                            break;
                        }

                        currentElement = currentElement.parentElement;
                    }

                    seenPosts.add(href);
                    postsWithPinStatus.push({ href, isPinned });
                });

                return postsWithPinStatus;
            });
        };

        let posts = await getAllPosts();
        logger.info(`Initially found ${posts.length} total posts (pinned + unpinned)`);

        // If we have less than 4 posts, scroll to load more
        let scrollAttempts = 0;
        const maxScrollAttempts = 3;

        while (posts.length < 4 && scrollAttempts < maxScrollAttempts) {
            logger.info(`Only ${posts.length} posts found. Scrolling to find more... (attempt ${scrollAttempts + 1}/${maxScrollAttempts})`);

            // Scroll down
            await this.page.evaluate(() => {
                window.scrollBy(0, window.innerHeight);
            });

            await randomDelay(2000, 3000);

            // Get posts again after scrolling
            const newPosts = await getAllPosts();

            if (newPosts.length === posts.length) {
                logger.info("No new posts loaded after scrolling. Stopping.");
                break;
            }

            posts = newPosts;
            logger.info(`Now found ${posts.length} total posts after scrolling`);
            scrollAttempts++;
        }

        // Take up to 4 posts
        const selectedPosts = posts.slice(0, 4);

        if (selectedPosts.length === 0) {
            logger.warn("Could not find any posts on this profile.");
            return [];
        }

        logger.info(`Found ${selectedPosts.length} posts. Extracting timestamps...`);

        const postsWithTimestamps = [];

        // Visit each post to get its timestamp
        for (const postData of selectedPosts) {
            try {
                const postUrl = postData.href.startsWith('http')
                    ? postData.href
                    : `https://www.instagram.com${postData.href}`;

                // Extract post ID
                const match = postData.href.match(/\/(p|reel)\/([^\/\?]+)/);
                if (!match) {
                    logger.warn(`Could not extract post ID from URL: ${postData.href}`);
                    continue;
                }

                const contentTypeMatch = match[1];
                const postId = match[2];
                const typeLabel = contentTypeMatch === 'reel' ? 'reel' : 'image';

                // Navigate to post to get timestamp
                logger.info(`Navigating to post ${postId} (${postData.isPinned ? 'PINNED' : 'unpinned'}) to get timestamp...`);
                await this.page.goto(postUrl, { waitUntil: "networkidle2" });
                await randomDelay(1000, 2000);

                // Extract timestamp
                const timeSelector = 'time';
                await this.page.waitForSelector(timeSelector, { timeout: 5000 });
                const timeElement = await this.page.$(timeSelector);

                if (!timeElement) {
                    logger.warn(`Could not find time element for post ${postId}`);
                    continue;
                }

                const postTimestampStr = await timeElement.evaluate((el: any) => el.getAttribute('datetime'));
                if (!postTimestampStr) {
                    logger.warn(`Could not extract datetime for post ${postId}`);
                    continue;
                }

                const timestamp = new Date(postTimestampStr);
                const now = new Date();
                const ageInDays = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60 * 24);

                postsWithTimestamps.push({
                    postId,
                    postUrl,
                    contentType: typeLabel as 'image' | 'video' | 'reel',
                    timestamp,
                    isPinned: postData.isPinned
                });

                logger.info(`Post ${postId}: ${timestamp.toISOString()} (${typeLabel}) - Age: ${ageInDays.toFixed(1)} days - ${postData.isPinned ? 'PINNED' : 'Unpinned'}`);

                // Go back to profile
                await this.page.goBack();
                await randomDelay(1000, 2000);

            } catch (error) {
                logger.error(`Error processing post ${postData.href}:`, error);
                continue;
            }
        }

        // Sort by timestamp (newest first)
        postsWithTimestamps.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        logger.info(`Successfully extracted ${postsWithTimestamps.length} posts with timestamps`);
        return postsWithTimestamps;
    }

    /**
     * Get only the post ID and basic info (lightweight - no screenshots)
     */
    async getLatestPostId(targetAccount: string): Promise<{
        postId: string;
        postUrl: string;
        contentType: 'image' | 'video' | 'reel';
    } | null> {
        if (!this.page) throw new Error("Page not initialized");
        logger.info(`Navigating to ${targetAccount}'s profile...`);
        await this.page.goto(`https://www.instagram.com/${targetAccount}/`, {
            waitUntil: "networkidle2",
        });
        await randomDelay(2000, 4000);
        await this.handleNotificationPopup();

        logger.info("Looking for the latest post ID (including pinned and unpinned)...");

        // Use JavaScript to find ALL post links (posts, videos, AND reels)
        // INCLUDES both pinned and unpinned posts
        const postLink = await this.page.evaluate(() => {
            const allLinks = Array.from(document.querySelectorAll('a[href]'));
            const contentLinks = allLinks.filter(link => {
                const href = link.getAttribute('href');
                return href && (href.includes('/p/') || href.includes('/reel/'));
            });

            if (contentLinks.length === 0) return null;
            return contentLinks[0].getAttribute('href');
        });

        if (!postLink) {
            logger.warn("Could not find any posts, videos, or reels on this profile.");
            return null;
        }

        logger.info(`Found latest post: ${postLink}`);

        const postUrl = postLink.startsWith('http')
            ? postLink
            : `https://www.instagram.com${postLink}`;

        // Extract post ID - supports both /p/ and /reel/ formats
        const match = postLink.match(/\/(p|reel)\/([^\/\?]+)/);
        if (!match) {
            logger.error(`Could not extract post ID from URL: ${postLink}`);
            return null;
        }

        const contentTypeMatch = match[1];  // 'p' or 'reel'
        const postId = match[2];  // The actual post ID
        const typeLabel = contentTypeMatch === 'reel' ? 'reel' : 'image';
        logger.info(`Post ID extracted: ${postId} (type: ${typeLabel})`);

        return {
            postId,
            postUrl,
            contentType: typeLabel as 'image' | 'video' | 'reel'
        };
    }

    /**
     * Get full post details with visual analysis (screenshots/video frames)
     */
    async getLatestPost(targetAccount: string): Promise<{
        postId: string;
        postUrl: string;
        caption: string;
        captionLength: number;
        postTimestamp: Date;
        screenshotBase64?: string;  // Base64 encoded screenshot for images
        videoFramesBase64?: string[]; // Base64 encoded frames for videos/reels
        contentType: 'image' | 'video' | 'reel';
    } | null> {
        if (!this.page) throw new Error("Page not initialized");
        logger.info(`Navigating to ${targetAccount}'s profile...`);
        await this.page.goto(`https://www.instagram.com/${targetAccount}/`, {
            waitUntil: "networkidle2",
        });
        await randomDelay(2000, 4000);
        await this.handleNotificationPopup();

        logger.info("Looking for the latest post (photos, videos, and reels - including pinned)...");

        // Use JavaScript to find ALL post links (posts, videos, AND reels)
        // INCLUDES both pinned and unpinned posts
        const postLink = await this.page.evaluate(() => {
            const allLinks = Array.from(document.querySelectorAll('a[href]'));
            const contentLinks = allLinks.filter(link => {
                const href = link.getAttribute('href');
                return href && (href.includes('/p/') || href.includes('/reel/'));
            });

            if (contentLinks.length === 0) return null;
            return contentLinks[0].getAttribute('href');
        });

        try {
            if (!postLink) {
                throw new Error("Could not find any posts, videos, or reels on this profile.");
            }

            logger.info(`Found latest post: ${postLink}`);

            const postUrl = postLink.startsWith('http')
                ? postLink
                : `https://www.instagram.com${postLink}`;

            // Extract post ID - supports both /p/ and /reel/ formats
            const match = postLink.match(/\/(p|reel)\/([^\/\?]+)/);
            if (!match) throw new Error(`Could not extract post ID from URL: ${postLink}`);

            const contentType = match[1];  // 'p' or 'reel'
            const postId = match[2];  // The actual post ID
            const typeLabel = contentType === 'reel' ? 'reel' : 'photo/video post';
            logger.info(`Post ID extracted: ${postId} (type: ${typeLabel})`);

            // Click the first post using JavaScript evaluation (more reliable)
            await this.page.evaluate((href) => {
                const link = document.querySelector(`a[href="${href}"]`) as HTMLElement;
                if (link) {
                    link.click();
                    return true;
                }
                return false;
            }, postLink);
            logger.info("Post clicked, waiting for modal to open...");
            await randomDelay(2000, 3000);
            await this.handleNotificationPopup();

            logger.info("Extracting post details...");

            // Extract timestamp
            const timeSelector = 'time';
            await this.page.waitForSelector(timeSelector, { timeout: 5000 });
            const timeElement = await this.page.$(timeSelector);
            if (!timeElement) throw new Error("Could not find time element for post.");
            const postTimestampStr = await timeElement.evaluate((el: any) => el.getAttribute('datetime'));
            if (!postTimestampStr) throw new Error("Could not extract datetime attribute from time element.");
            const postTimestamp = new Date(postTimestampStr);

            // Extract caption - try multiple selectors for photos and videos
            let caption = "";
            const captionSelectors = [
                'h1',                                           // Primary caption location
                'div._a9zs h1',                                // Caption in modal
                'span._ap3a._aaco._aacu._aacx._aad7._aade',   // Alternative caption span
                'div.x9f619 span._ap3a',                       // Feed caption
                'article span._ap3a._aaco._aacu._aacx._aad7._aade', // Article caption
            ];

            for (const selector of captionSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 2000 });
                    const captionElement = await this.page.$(selector);
                    if (captionElement) {
                        const text = await captionElement.evaluate((el) => (el as HTMLElement).innerText);
                        if (text && text.trim().length > 0) {
                            caption = text.trim();
                            logger.info(`Caption extracted using selector: ${selector}`);
                            break;
                        }
                    }
                } catch (e) {
                    // Try next selector
                }
            }

            if (!caption || caption.length === 0) {
                logger.warn("No caption found for this post (post may have no caption text).");
                caption = ""; // Empty caption is valid for posts without text
            }

            const captionLength = caption.length;
            logger.info(`Caption length: ${captionLength} characters`);

            // Determine content type and capture visual data
            let screenshotBase64: string | undefined;
            let videoFramesBase64: string[] | undefined;
            let finalContentType: 'image' | 'video' | 'reel' = contentType === 'reel' ? 'reel' : 'image';

            // Check if content is a video or reel
            const hasVideo = await this.page.evaluate(() => {
                const videoElement = document.querySelector('video');
                return videoElement !== null;
            });

            if (hasVideo) {
                logger.info("Detected video/reel content - extracting frames...");
                finalContentType = contentType === 'reel' ? 'reel' : 'video';

                // Extract 3 frames from the video (beginning, middle, end)
                videoFramesBase64 = await this.captureVideoFrames(3);
                logger.info(`Captured ${videoFramesBase64.length} video frames`);
            } else {
                logger.info("Detected image content - taking screenshot...");
                finalContentType = 'image';

                // Take screenshot of the image
                screenshotBase64 = await this.capturePostScreenshot();
                logger.info("Screenshot captured successfully");
            }

            await this.page.goBack(); // Go back to profile page
            await randomDelay(2000, 3000);

            return {
                postId,
                postUrl,
                caption,
                captionLength,
                postTimestamp,
                screenshotBase64,
                videoFramesBase64,
                contentType: finalContentType
            };

        } catch (error) {
            logger.error(`Failed to get latest post for ${targetAccount}:`, error);
            return null;
        }
    }

    /**
     * Get specific post details with visual analysis by post URL
     */
    async getPostDetails(postUrl: string): Promise<{
        postId: string;
        postUrl: string;
        caption: string;
        captionLength: number;
        postTimestamp: Date;
        screenshotBase64?: string;
        videoFramesBase64?: string[];
        contentType: 'image' | 'video' | 'reel';
    } | null> {
        if (!this.page) throw new Error("Page not initialized");

        try {
            logger.info(`Navigating to post: ${postUrl}`);
            await this.page.goto(postUrl, {
                waitUntil: "networkidle2",
            });
            await randomDelay(2000, 3000);
            await this.handleNotificationPopup();

            logger.info("Extracting post details...");

            // Extract post ID from URL
            const match = postUrl.match(/\/(p|reel)\/([^\/\?]+)/);
            if (!match) throw new Error(`Could not extract post ID from URL: ${postUrl}`);

            const contentType = match[1];
            const postId = match[2];

            // Extract timestamp
            const timeSelector = 'time';
            await this.page.waitForSelector(timeSelector, { timeout: 5000 });
            const timeElement = await this.page.$(timeSelector);
            if (!timeElement) throw new Error("Could not find time element for post.");
            const postTimestampStr = await timeElement.evaluate((el: any) => el.getAttribute('datetime'));
            if (!postTimestampStr) throw new Error("Could not extract datetime attribute from time element.");
            const postTimestamp = new Date(postTimestampStr);

            // Extract caption
            let caption = "";
            const captionSelectors = [
                'h1',
                'div._a9zs h1',
                'span._ap3a._aaco._aacu._aacx._aad7._aade',
                'div.x9f619 span._ap3a',
                'article span._ap3a._aaco._aacu._aacx._aad7._aade',
            ];

            for (const selector of captionSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 2000 });
                    const captionElement = await this.page.$(selector);
                    if (captionElement) {
                        const text = await captionElement.evaluate((el) => (el as HTMLElement).innerText);
                        if (text && text.trim().length > 0) {
                            caption = text.trim();
                            logger.info(`Caption extracted using selector: ${selector}`);
                            break;
                        }
                    }
                } catch (e) {
                    // Try next selector
                }
            }

            if (!caption || caption.length === 0) {
                logger.warn("No caption found for this post (post may have no caption text).");
                caption = "";
            }

            const captionLength = caption.length;
            logger.info(`Caption length: ${captionLength} characters`);

            // Determine content type and capture visual data
            let screenshotBase64: string | undefined;
            let videoFramesBase64: string[] | undefined;
            let finalContentType: 'image' | 'video' | 'reel' = contentType === 'reel' ? 'reel' : 'image';

            // Check if content is a video or reel
            const hasVideo = await this.page.evaluate(() => {
                const videoElement = document.querySelector('video');
                return videoElement !== null;
            });

            if (hasVideo) {
                logger.info("Detected video/reel content - extracting frames...");
                finalContentType = contentType === 'reel' ? 'reel' : 'video';
                videoFramesBase64 = await this.captureVideoFrames(3);
                logger.info(`Captured ${videoFramesBase64.length} video frames`);
            } else {
                logger.info("Detected image content - taking screenshot...");
                finalContentType = 'image';
                screenshotBase64 = await this.capturePostScreenshot();
                logger.info("Screenshot captured successfully");
            }

            return {
                postId,
                postUrl,
                caption,
                captionLength,
                postTimestamp,
                screenshotBase64,
                videoFramesBase64,
                contentType: finalContentType
            };

        } catch (error) {
            logger.error(`Failed to get post details for ${postUrl}:`, error);
            return null;
        }
    }

    async postComment(postIdOrUrl: string, commentText: string): Promise<void> {
        if (!this.page) throw new Error("Page not initialized");

        // Support both post ID and full URL
        let postUrl: string;
        if (postIdOrUrl.startsWith('http')) {
            // Already a full URL
            postUrl = postIdOrUrl;
        } else if (postIdOrUrl.startsWith('/')) {
            // Relative URL
            postUrl = `https://www.instagram.com${postIdOrUrl}`;
        } else {
            // Just an ID - default to /p/ format for backwards compatibility
            postUrl = `https://www.instagram.com/p/${postIdOrUrl}/`;
        }

        logger.info(`Navigating to post to comment: ${postUrl}`);
        await this.page.goto(postUrl, {
            waitUntil: "networkidle2",
        });
        await randomDelay(2000, 4000);
        await this.handleNotificationPopup();

        logger.info(`Typing comment: "${commentText}"`);
        const commentBoxSelector = 'textarea[aria-label="Add a comment…"]';
        await this.page.waitForSelector(commentBoxSelector, { timeout: 5000 });
        await humanLikeType(this.page, commentBoxSelector, commentText);
        await randomDelay(1000, 2000);

        logger.info("Posting comment...");
        const postButton = await this.page.evaluateHandle(() => {
            const buttons = Array.from(
                document.querySelectorAll('div[role="button"]')
            );
            return buttons.find(
                (button) =>
                    button.textContent === "Post" && !button.hasAttribute("disabled")
            );
        });
        const postButtonElement = postButton && postButton.asElement ? postButton.asElement() : null;
        if (postButtonElement) {
            await (postButtonElement as puppeteer.ElementHandle<Element>).click();
            logger.info("Comment posted successfully.");
            await randomDelay(3000, 5000); // Wait for comment to post
        } else {
            throw new Error("Post button not found.");
        }
    }

    /**
     * Capture screenshot of image post
     */
    private async capturePostScreenshot(): Promise<string> {
        if (!this.page) throw new Error("Page not initialized");

        try {
            // Find the image element
            const imageSelector = 'img[style*="object-fit"]';
            await this.page.waitForSelector(imageSelector, { timeout: 5000 });

            const imageElement = await this.page.$(imageSelector);
            if (!imageElement) throw new Error("Could not find image element");

            // Take screenshot of just the image element
            const screenshot = await imageElement.screenshot({ encoding: 'base64' });
            return screenshot;
        } catch (error) {
            logger.warn("Failed to capture image screenshot, falling back to full page screenshot");
            // Fallback: take full page screenshot
            const screenshot = await this.page.screenshot({ encoding: 'base64', fullPage: false });
            return screenshot;
        }
    }

    /**
     * Capture multiple frames from video/reel
     */
    private async captureVideoFrames(frameCount: number = 3): Promise<string[]> {
        if (!this.page) throw new Error("Page not initialized");

        const frames: string[] = [];

        try {
            // Wait for video element
            await this.page.waitForSelector('video', { timeout: 5000 });

            // Get video duration and capture frames at different timestamps
            const videoDuration = await this.page.evaluate(() => {
                const video = document.querySelector('video') as HTMLVideoElement;
                return video?.duration || 0;
            });

            if (videoDuration === 0) {
                logger.warn("Video duration is 0, capturing single frame");
                frameCount = 1;
            }

            // Capture frames at intervals
            for (let i = 0; i < frameCount; i++) {
                const timestamp = (videoDuration / (frameCount + 1)) * (i + 1);

                // Seek to timestamp and wait for frame
                await this.page.evaluate((time) => {
                    const video = document.querySelector('video') as HTMLVideoElement;
                    if (video) {
                        video.currentTime = time;
                    }
                }, timestamp);

                // Wait for video to seek
                await delay(500);

                // Capture the video frame
                const videoElement = await this.page.$('video');
                if (videoElement) {
                    const screenshot = await videoElement.screenshot({ encoding: 'base64' });
                    frames.push(screenshot);
                    logger.info(`Captured frame ${i + 1}/${frameCount} at ${timestamp.toFixed(1)}s`);
                }
            }

            if (frames.length === 0) {
                throw new Error("No frames captured");
            }

            return frames;
        } catch (error) {
            logger.error("Failed to capture video frames:", error);
            // Fallback: capture single screenshot
            const screenshot = await this.page.screenshot({ encoding: 'base64', fullPage: false });
            return [screenshot];
        }
    }

    public async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }
}