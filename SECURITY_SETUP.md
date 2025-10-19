# Security Setup Guide

## Important: Protecting Your Credentials

This project uses environment variables to keep sensitive information like API keys, passwords, and tokens secure.

## Setup Instructions

### 1. Create Your Environment File

Copy the example environment file and add your actual credentials:

```bash
cp .env.example .env
```

### 2. Add Your Credentials

Edit the `.env` file and replace the placeholder values with your actual credentials:

- `OPENROUTER_API_KEY` - Your OpenRouter API key
- `IGusername` and `IGpassword` - Your Instagram bot credentials
- `GEMINI_API_KEY_X` - Your Gemini API keys (if using Gemini)
- `TWITTER_*` - Your Twitter API credentials (if using Twitter features)
- `MONGODB_URI` - Your MongoDB connection string
- `SESSION_SECRET` and `JWT_SECRET` - Generate random secure strings

### 3. Generate Secure Secrets

For `SESSION_SECRET` and `JWT_SECRET`, use a random string generator:

```bash
# On Linux/Mac
openssl rand -base64 32

# On Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))

# Or use an online generator like: https://www.random.org/strings/
```

### 4. Never Commit Sensitive Files

The following files/folders are already in `.gitignore` and should NEVER be committed:

- `.env` files (contains your actual credentials)
- `src/secret/` directory
- `cookies/` directory (contains session data)

### 5. Before Pushing to GitHub

Always verify that no sensitive data is being committed:

```bash
git status
git diff
```

## What's Safe to Commit?

✅ **SAFE** to commit:
- `.env.example` - Template with placeholder values
- `src/config/botConfig.ts` - Uses environment variables
- Code files that reference `process.env.*`

❌ **NEVER** commit:
- `.env` - Contains your actual credentials
- `src/secret/index.ts` - If it contains hardcoded values
- Any file with actual API keys, passwords, or tokens
- `cookies/` folder - Contains session data

## Security Best Practices

1. **Rotate Credentials Regularly**: Change your API keys and passwords periodically
2. **Use Different Credentials for Development and Production**
3. **Enable 2FA**: Enable two-factor authentication on all your accounts
4. **Limit API Key Permissions**: Only grant necessary permissions to API keys
5. **Monitor Usage**: Regularly check your API usage for unusual activity

## If You Accidentally Commit Credentials

1. **Immediately rotate/revoke** the exposed credentials
2. Remove the sensitive data from Git history:
   ```bash
   # Use git filter-branch or BFG Repo-Cleaner
   # See: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository
   ```
3. Force push the cleaned history
4. Update your `.env` file with new credentials

## Need Help?

If you're unsure about security, consult the documentation or seek help before pushing to GitHub.
