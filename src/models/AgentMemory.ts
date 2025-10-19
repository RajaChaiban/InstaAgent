/**
 * Agent Memory Model - Stores agent's interactions, learnings, and context
 * This serves as the AI agent's long-term memory for personalized interactions
 */

import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IAgentMemory extends Document {
  username: string;
  platform: 'instagram' | 'twitter' | 'github';
  memoryType: 'interaction' | 'post' | 'comment' | 'user_profile' | 'preference' | 'context';

  // Interaction details
  targetUser?: string;
  targetPostUrl?: string;
  action: 'like' | 'comment' | 'follow' | 'unfollow' | 'dm' | 'post' | 'view';
  content?: string;  // Comment text, DM text, or post caption

  // AI-generated content tracking
  aiGenerated: boolean;
  aiPrompt?: string;

  // Engagement metrics
  engagement?: {
    likes?: number;
    comments?: number;
    shares?: number;
    impressions?: number;
  };

  // Success tracking
  wasSuccessful: boolean;
  errorMessage?: string;

  // Context and learning
  context?: {
    timeOfDay?: string;
    dayOfWeek?: string;
    hashtags?: string[];
    mentions?: string[];
    sentiment?: 'positive' | 'neutral' | 'negative';
  };

  // Metadata
  metadata?: any;

  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const agentMemorySchema: Schema<IAgentMemory> = new Schema(
  {
    username: {
      type: String,
      required: true,
      index: true,
    },
    platform: {
      type: String,
      required: true,
      enum: ['instagram', 'twitter', 'github'],
      default: 'instagram',
      index: true,
    },
    memoryType: {
      type: String,
      required: true,
      enum: ['interaction', 'post', 'comment', 'user_profile', 'preference', 'context'],
      index: true,
    },
    targetUser: {
      type: String,
      index: true,
    },
    targetPostUrl: {
      type: String,
    },
    action: {
      type: String,
      required: true,
      enum: ['like', 'comment', 'follow', 'unfollow', 'dm', 'post', 'view'],
      index: true,
    },
    content: {
      type: String,
    },
    aiGenerated: {
      type: Boolean,
      default: false,
    },
    aiPrompt: {
      type: String,
    },
    engagement: {
      likes: Number,
      comments: Number,
      shares: Number,
      impressions: Number,
    },
    wasSuccessful: {
      type: Boolean,
      default: true,
      index: true,
    },
    errorMessage: {
      type: String,
    },
    context: {
      timeOfDay: String,
      dayOfWeek: String,
      hashtags: [String],
      mentions: [String],
      sentiment: {
        type: String,
        enum: ['positive', 'neutral', 'negative'],
      },
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
agentMemorySchema.index({ username: 1, platform: 1, timestamp: -1 });
agentMemorySchema.index({ username: 1, action: 1, wasSuccessful: 1 });
agentMemorySchema.index({ targetUser: 1, action: 1 });

// Static method to get recent interactions with a user
agentMemorySchema.statics.getRecentInteractions = async function(
  username: string,
  targetUser: string,
  limit: number = 10
): Promise<IAgentMemory[]> {
  return this.find({
    username,
    targetUser,
  })
    .sort({ timestamp: -1 })
    .limit(limit);
};

// Static method to get successful actions stats
agentMemorySchema.statics.getSuccessRate = async function(
  username: string,
  action: string,
  days: number = 7
): Promise<{ total: number; successful: number; rate: number }> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const total = await this.countDocuments({
    username,
    action,
    timestamp: { $gte: startDate },
  });

  const successful = await this.countDocuments({
    username,
    action,
    timestamp: { $gte: startDate },
    wasSuccessful: true,
  });

  const rate = total > 0 ? (successful / total) * 100 : 0;

  return { total, successful, rate };
};

// Static method to check if already interacted with a post
agentMemorySchema.statics.hasInteracted = async function(
  username: string,
  targetPostUrl: string,
  action: string
): Promise<boolean> {
  const count = await this.countDocuments({
    username,
    targetPostUrl,
    action,
  });
  return count > 0;
};

const AgentMemory: Model<IAgentMemory> = mongoose.model<IAgentMemory>(
  'AgentMemory',
  agentMemorySchema
);

export default AgentMemory;
