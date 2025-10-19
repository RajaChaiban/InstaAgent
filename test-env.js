// Quick test to verify .env is loaded correctly
require('dotenv').config();

console.log('=== Environment Variables Check ===');
console.log('IGusername:', process.env.IGusername || '❌ NOT SET');
console.log('IGpassword:', process.env.IGpassword ? '✅ SET (hidden)' : '❌ NOT SET');
console.log('OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? '✅ SET (hidden)' : '❌ NOT SET');
console.log('AI_PROVIDER:', process.env.AI_PROVIDER || '❌ NOT SET');
console.log('MONGODB_URI:', process.env.MONGODB_URI || '❌ NOT SET');
console.log('===================================');

// Check for placeholder values
if (process.env.IGusername === 'your_instagram_username') {
    console.log('⚠️  WARNING: IGusername still has placeholder value!');
}
if (process.env.IGpassword === 'your_instagram_password') {
    console.log('⚠️  WARNING: IGpassword still has placeholder value!');
}
if (process.env.OPENROUTER_API_KEY === 'your_openrouter_api_key_here') {
    console.log('⚠️  WARNING: OPENROUTER_API_KEY still has placeholder value!');
}
