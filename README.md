# Instagram Marketing AI Agent

An intelligent Instagram automation platform that leverages AI to create authentic, context-aware social media engagement. The system uses advanced AI models (OpenRouter/Gemini) to generate natural, engaging comments on Instagram posts, with built-in smart filtering, duplicate prevention, and automated scheduling capabilities.

## What It Does

This bot automates Instagram engagement by:

- Logging into Instagram with your bot account
- Visiting target Instagram accounts you specify
- Reading recent posts and captions
- Generating contextual, AI-powered comments using GPT-4, Claude, or Gemini
- Posting comments automatically (with human-like delays)
- Tracking all interactions in MongoDB to prevent duplicate comments
- Running on a schedule (every X minutes) or manually via API

## Key Features

- **AI-Powered Comments**: Uses OpenRouter (GPT-4, Claude, etc.) or Gemini to generate contextually relevant comments
- **Smart Filtering**: Automatically skips posts with captions that are too short (<50 chars) or too long (>2200 chars)
- **Duplicate Prevention**: Never comments twice on the same post (tracked via MongoDB)
- **Automated Scheduling**: Run commenting tasks at configurable intervals (default: 10 minutes)
- **Multi-Account Targeting**: Process multiple Instagram accounts in sequence
- **Human-like Delays**: Configurable random delays to mimic natural behavior
- **Statistics & Analytics**: Track engagement metrics and success rates
- **AI Agent Training**: Train the AI to match your brand voice using YouTube videos, audio files, websites, or documents

## Prerequisites

Before you begin, you need:

- **Node.js** v16 or higher
- **Docker Desktop** (for MongoDB database)
- **Instagram account** (for the bot to use)
- **OpenRouter API key** (recommended) OR **Gemini API key** (free alternative)

## Installation

### Step 1: Get NPM

npm install


### Step 2: Start MongoDB Database

```bash
docker-compose up -d
```

This starts MongoDB in a Docker container on port 27017.

**Verify it's running:**
```bash
docker ps
```

### Step 3: Configure Environment Variables

Create a `.env` file in the root directory with:

```env
# Instagram Credentials
IGusername=your_instagram_username
IGpassword=your_instagram_password

# AI Provider (Choose one)
AI_PROVIDER=openrouter

# OpenRouter (Recommended - $0.01-0.05 per comment)
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=openai/gpt-4o

# OR use Gemini (Free alternative)
GEMINI_API_KEY_1=your_gemini_key_1
GEMINI_API_KEY_2=your_gemini_key_2
GEMINI_API_KEY_3=your_gemini_key_3

# Database
MONGODB_URI=mongodb://localhost:27017/instagram-ai-agent

# Server
PORT=3000
SESSION_SECRET=your_random_secret_key
```

**Get API Keys:**
- **OpenRouter**: https://openrouter.ai/keys (requires payment)
- **Gemini**: https://makersuite.google.com/app/apikey (free)

### Step 5: Configure Target Accounts

Edit `src/config/botConfig.ts` and add the Instagram accounts you want to comment on:

```typescript
target: {
  accounts: [
    "target_account_1",
    "target_account_2",
    "target_account_3",
  ],
  maxPostsToInteract: 1,  // Number of posts per account per run
}
```

### Step 6: Start the Application

```bash
npm start
```

The server will start on `http://localhost:3000`

## How to Use

### Option 1: Manual Bot Run

Trigger a single bot run manually:

```bash
curl -X POST http://localhost:3000/api/run-bot
```

This will:
1. Log into Instagram
2. Visit each target account
3. Find recent posts
4. Generate and post AI comments
5. Save results to MongoDB

### Option 2: Automated Scheduling

Start the scheduler to run automatically every 10 minutes:

```bash
curl -X POST http://localhost:3000/api/scheduler/start
```

**Check scheduler status:**
```bash
curl http://localhost:3000/api/scheduler/status
```

**Stop scheduler:**
```bash
curl -X POST http://localhost:3000/api/scheduler/stop
```

### Option 3: View Statistics

Check your engagement metrics for the last 7 days:

```bash
curl http://localhost:3000/api/smart-comment/stats?days=7
```

Example response:
```json
{
  "success": true,
  "stats": {
    "period": "Last 7 days",
    "total": 150,
    "successful": 142,
    "failed": 8,
    "successRate": 94.67
  }
}
```

## Configuration Options

### Bot Configuration (`src/config/botConfig.ts`)

```typescript
export const botConfig = {
  // Instagram credentials
  instagram: {
    username: process.env.IGusername || "",
    password: process.env.IGpassword || "",
  },

  // Target accounts to comment on
  target: {
    accounts: ["account1", "account2"],
    maxPostsToInteract: 1,
  },

  // AI settings
  ai: {
    provider: "openrouter",  // or "gemini"
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY,
      model: "openai/gpt-4o",  // or "anthropic/claude-3.5-sonnet"
    },
    prompt: "Generate a relevant, engaging comment...",
  },

  // Timing (human-like delays)
  timing: {
    minDelay: 2000,           // 2 seconds
    maxDelay: 5000,           // 5 seconds
    afterLogin: 3000,
    betweenPosts: {
      min: 5000,
      max: 10000,
    },
  },

  // Smart filtering
  filtering: {
    captionLength: {
      enabled: true,
      min: 50,              // Skip very short captions
      max: 2200,            // Skip very long captions
    },
    skipDuplicates: true,   // Never comment twice
  },

  // Scheduler
  scheduler: {
    enabled: false,         // Auto-start on launch
    interval: 10,           // Run every 10 minutes
  },
};
```

### Available AI Models (OpenRouter)

- **openai/gpt-4o** - Latest GPT-4 (best quality, ~$0.01-0.05/comment)
- **anthropic/claude-3.5-sonnet** - Best for creative comments
- **openai/gpt-3.5-turbo** - Budget-friendly option (~$0.001/comment)
- **meta-llama/llama-3.1-405b-instruct** - Open source alternative

## API Endpoints

### Bot Control
- `POST /api/run-bot` - Manually trigger bot run
- `POST /api/smart-comment/run` - Run smart comment service
- `GET /api/smart-comment/stats?days=7` - Get comment statistics

### Scheduler Control
- `POST /api/scheduler/start` - Start automated scheduler
- `POST /api/scheduler/stop` - Stop scheduler
- `POST /api/scheduler/run-now` - Trigger immediate run
- `GET /api/scheduler/status` - Get scheduler status

## Training the AI Agent (Optional)

Personalize the AI's commenting style by training it on your content:

### Train from YouTube Video
```bash
npm run train:youtube
# Enter YouTube URL when prompted
```

### Train from Audio File
```bash
npm run train:audio
# Select audio file when prompted
```

### Train from Website
```bash
npm run train:link
# Enter website URL when prompted
```

Supported formats: PDF, DOC, DOCX, TXT, MP3, WAV

## How It Works

### Smart Comment Flow

1. **Login**: Bot logs into Instagram using your credentials
2. **Cookie Management**: Saves session cookies to avoid re-login
3. **Target Selection**: Loads target accounts from config
4. **Post Discovery**: Fetches recent posts from each account
5. **Smart Filtering**:
   - Checks if post was already commented on (MongoDB lookup)
   - Validates caption length (50-2200 characters)
   - Skips if filters fail
6. **AI Generation**: Sends caption to OpenRouter/Gemini for comment generation
7. **Post Comment**: Submits comment to Instagram
8. **Save to Database**: Records interaction in MongoDB
9. **Human Delays**: Waits random time before next action
10. **Repeat**: Moves to next post/account

### Database Schema

**PostMemory Collection** (prevents duplicates):
```json
{
  "platform": "instagram",
  "targetAccount": "username",
  "postId": "unique_post_id",
  "postUrl": "https://instagram.com/p/...",
  "captionLength": 245,
  "caption": "Original post caption...",
  "commentText": "AI-generated comment...",
  "wasSuccessful": true,
  "commentedAt": "2025-10-15T10:30:00.000Z"
}
```

## Troubleshooting

### "Failed to login to Instagram"
- Verify credentials in `.env` file
- Check if account requires 2FA (not yet supported)
- Try logging in manually to verify account isn't locked

### "MongoDB connection failed"
- Ensure MongoDB is running: `docker ps`
- Check MongoDB URI in `.env`
- Try restarting: `docker-compose restart`

### "OpenRouter API error"
- Verify API key is correct
- Check account has credits at https://openrouter.ai/credits
- Try alternative model in config

### "No posts found"
- Target account may be private
- Account may have no recent posts
- Check Instagram session is valid

## Docker Commands

```bash
# Start MongoDB
docker-compose up -d

# Check status
docker ps

# View logs
docker logs instagram-ai-mongodb

# Stop MongoDB
docker-compose down

# Stop and remove data
docker-compose down -v
```

## Security & Best Practices

### Rate Limiting
- Built-in delays to avoid Instagram rate limits
- Random timing to appear more human
- Configurable intervals between actions

### Session Management
- Cookies saved in MongoDB
- Reduces login frequency
- Maintains session across restarts

### Privacy
- All data stored locally in MongoDB
- No external analytics
- Full control over your data

## Project Structure

```
instagram-marketing-ai-agent/
├── src/
│   ├── client/                 # Platform integrations
│   │   ├── Instagram.ts        # Main Instagram client
│   │   └── IG-bot/IgClient.ts  # Instagram automation logic
│   ├── services/               # Core business logic
│   │   ├── smart-comment.ts    # Smart commenting system
│   │   ├── scheduler.ts        # Automated scheduling
│   │   ├── ai-provider.ts      # AI provider abstraction
│   │   └── openrouter.ts       # OpenRouter integration
│   ├── models/                 # Database models
│   │   ├── PostMemory.ts       # Comment tracking
│   │   ├── AgentMemory.ts      # AI memory/context
│   │   └── Cookie.ts           # Session management
│   ├── config/                 # Configuration
│   │   ├── botConfig.ts        # Bot settings
│   │   ├── logger.ts           # Logging setup
│   │   └── db.ts               # MongoDB connection
│   ├── Agent/                  # AI training
│   │   ├── training/           # Training scripts
│   │   └── characters/         # AI personality profiles
│   ├── app.ts                  # Express app
│   └── index.ts                # Entry point
├── docker-compose.yml          # Docker configuration
├── package.json                # Dependencies
├── .env                        # Environment variables
└── README.md                   # This file
```

## License

MIT License - See LICENSE file for details

## Disclaimer

This tool is for educational purposes and personal use. Use responsibly and in compliance with Instagram's Terms of Service. The developers are not responsible for any misuse or account restrictions resulting from the use of this software.


