/**
 * 🎯 CENTRALIZED BOT CONFIGURATION
 *
 * ALL bot settings are here - change this file to configure your bot!
 * No need to edit multiple files anymore.
 */

import dotenv from "dotenv";

dotenv.config();

export const botConfig = {
  // ============================================
  // 🔐 INSTAGRAM ACCOUNT SETTINGS (Your Bot Account)
  // ============================================
  instagram: {
    username: process.env.IGusername || "callsub.ai_bot",  // Your Instagram bot username
    password: process.env.IGpassword || "YOUR_PASSWORD",   // Your Instagram bot password
  },

  // ============================================
  // 🎯 TARGET SETTINGS (Who to Comment On)
  // ============================================
  target: {
     accounts: ["lifebytosin","drshievag","napro_fertility_surgeon"
    ],

    // How many posts to comment on PER ACCOUNT
    maxPostsToInteract: 1,  // ← CHANGE THIS: Number of posts per account
  },

  // ============================================
  // 🤖 AI SETTINGS (OpenRouter/Gemini)
  // ============================================
  ai: {
    // ✨ CHOOSE YOUR AI PROVIDER
    provider: process.env.AI_PROVIDER || "openrouter",  // "openrouter" or "gemini"

    // 🔑 OpenRouter Settings (Recommended for production)
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY || "",

      // ✨ PICK YOUR MODEL (Change this to switch AI models)
      model: process.env.OPENROUTER_MODEL || "openai/gpt-4o",
      temperature: 0.7,     // 0.0-1.0: Lower = consistent, Higher = creative
      maxTokens: 500,       // Max response length (Instagram comments are short)
    },

    // 🔑 Gemini Settings (Free alternative - Google AI)
    gemini: {
      apiKeys: [
        process.env.GEMINI_API_KEY_1,
        process.env.GEMINI_API_KEY_2,
        process.env.GEMINI_API_KEY_3,
      ].filter(Boolean),  // Remove undefined keys

      model: "gemini-2.0-flash",  // Gemini model version
      temperature: 0.7,
    },

    // ============================================
    // 💬 AI PROMPTS - CUSTOMIZE YOUR COMMENT STYLE
    // ============================================

    prompts: {
      // 🎯 System Prompt (Defines AI personality and behavior)
      system: `You are a human Instagram user writing authentic, engaging comments.
Your comments should:
- Match the tone of the post (casual, funny, serious, or sarcastic)
- Sound organic and natural, not AI-generated
- Use relatable language, including light slang when appropriate
- Be 50-80 characters long for quick reads
- Avoid generic praise like "Great post!" or "Amazing!"
- React specifically to the content
- Comply with Instagram guidelines (no spam, harassment, etc.)
- Feel conversational and genuine
- Do not use **ANY HASHTAGS** and **EMOGIS**`,

      // 🎨 User Prompt Template (What we ask the AI for each post)
      // Available variables: {caption}
      user: "Your task is to act as an authentic human user commenting on an Instagram post. Analyze the INPUT POST CAPTION and ensure the generated response matches the overall sentiment and subject matter of the post's tone. The comment must be specific to the content, referring directly to a detail or feature mentioned, and should be concise, aiming for a length between 50 and 80 characters (1-2 sentences). Crucially, the final comment must strictly adhere to the style constraint: do NOT include any hashtags (#) or emojis. Your output should contain ONLY the text of the comment itself, without any quotes, prefixes, or extraneous formatting."

    },

    // 🎭 Comment Generation Settings
    generation: {
      // How many comment options to generate per post
      variantsCount: 3,  // Will pick the best one

      // Retry settings if AI fails
      maxRetries: 2,
      retryDelay: 1000,  // ms
    },
  },

  // ============================================
  // ⏰ TIMING SETTINGS (Human-like delays)
  // ============================================
  timing: {
    // Random delay range (in milliseconds)
    minDelay: 2000,  // 2 seconds
    maxDelay: 5000,  // 5 seconds

    // Delay after login
    afterLogin: 3000,  // 3 seconds

    // Delay between posts
    betweenPosts: {
      min: 5000,   // 5 seconds
      max: 10000,  // 10 seconds
    },
  },

  // ============================================
  // 📊 SMART FILTERING SETTINGS
  // ============================================
  filtering: {
    // Caption length thresholds for engagement optimization
    captionLength: {
      enabled: true,  // Enable/disable caption length filtering
      min: 50,        // Minimum caption length (characters) to comment
      max: 2200,      // Maximum caption length (characters) to comment
      // Rationale:
      // - Too short (<50): Often just emojis or single words, low engagement
      // - Too long (>2200): Instagram caption limit is 2200, may indicate spam
      // - Sweet spot: 100-500 characters typically get best engagement
    },

    // Post age filtering (skip old posts)
    maxPostAge: {
      enabled: true,   // Enable/disable post age filtering
      days: 1,         // Maximum post age in days (posts older than this are skipped)
      // Rationale:
      // - Fresh posts get more visibility and engagement
      // - Commenting on old posts may look spammy
      // - 1 day ensures we only engage with very recent, active content
    },

    // Skip posts that have already been commented on
    skipDuplicates: true,  // Always skip posts we've already commented on
  },

  // ============================================
  // ⏰ SCHEDULER SETTINGS - AUTONOMOUS COMMENTING
  // ============================================
  scheduler: {
    // 🔄 ENABLE/DISABLE AUTOMATIC SCHEDULING
    enabled: true,  // ← Set to TRUE to auto-start scheduler on server launch

    // ⏱️ RUN INTERVAL (in minutes)
    interval: 1,  // Run every X minutes
    runOnStartup: false,  // Run immediately when server starts (before first interval)
    skipIfRunning: true,  // Skip scheduled run if previous run still in progress

    // 📊 STATISTICS
    logStats: true,  // Log statistics after each run (commented, skipped, failed)
    statsInterval: 24,  // Log summary stats every X hours
  },

  // ============================================
  // 🗄️ DATABASE SETTINGS
  // ============================================
  database: {
    mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/instagram-ai-agent",
  },

  // ============================================
  // 🔧 ADVANCED SETTINGS
  // ============================================
  advanced: {
    // Browser settings
    headless: false,  // Set to true for headless mode (no browser window)

    // Session settings
    saveCookies: true,  // Save login cookies for faster future logins
    cookiePath: "./cookies/Instagramcookies.json",

    // Interaction settings
    likeBeforeComment: true,  // Like post before commenting
    scrollBeforeInteract: true,  // Scroll to post before interacting
  },
};
