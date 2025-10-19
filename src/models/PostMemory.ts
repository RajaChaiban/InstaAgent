/**
 * Post Memory Model - Tracks posts that have been commented on
 * Ensures idempotent commenting (no duplicate comments on same post)
 */

import mongoose, { Document, Schema, Model } from 'mongoose';

// Interface for static methods
export interface IPostMemoryModel extends Model<IPostMemory> {
  hasCommented(platform: string, targetAccount: string, postId: string): Promise<boolean>;
  recordComment(data: {
    platform: string;
    targetAccount: string;
    postId: string;
    postUrl?: string;
    captionLength: number;
    caption?: string;
    commentText?: string;
    wasSuccessful: boolean;
    metadata?: any;
  }): Promise<IPostMemory>;
  getRecentComments(targetAccount: string, limit?: number): Promise<IPostMemory[]>;
  getStats(targetAccount?: string, days?: number): Promise<{
    total: number;
    successful: number;
    failed: number;
    successRate: number;
  }>;
  getLastPostTimestamp(targetAccount: string): Promise<Date | null>;
}

export interface IPostMemory extends Document {
  platform: 'instagram' | 'twitter';
  targetAccount: string;
  postId: string;
  postUrl?: string;
  captionLength: number;
  caption?: string;
  commentedAt: Date;
  commentText?: string;
  wasSuccessful: boolean;
  metadata?: {
    likes?: number;
    comments?: number;
    timestamp?: string;
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

const postMemorySchema: Schema<IPostMemory> = new Schema(
  {
    platform: {
      type: String,
      required: true,
      enum: ['instagram', 'twitter'],
      default: 'instagram',
      index: true,
    },
    targetAccount: {
      type: String,
      required: true,
      index: true,
    },
    postId: {
      type: String,
      required: true,
      index: true,
    },
    postUrl: {
      type: String,
    },
    captionLength: {
      type: Number,
      required: true,
    },
    caption: {
      type: String,
    },
    commentedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    commentText: {
      type: String,
    },
    wasSuccessful: {
      type: Boolean,
      default: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index to prevent duplicate comments on same post
postMemorySchema.index({ platform: 1, targetAccount: 1, postId: 1 }, { unique: true });

// Index for querying recent comments
postMemorySchema.index({ targetAccount: 1, commentedAt: -1 });

// Static method to check if a post has already been commented on
postMemorySchema.statics.hasCommented = async function(
  platform: string,
  targetAccount: string,
  postId: string
): Promise<boolean> {
  const count = await this.countDocuments({
    platform,
    targetAccount,
    postId,
  });
  return count > 0;
};

// Static method to record a new comment
postMemorySchema.statics.recordComment = async function(data: {
  platform: string;
  targetAccount: string;
  postId: string;
  postUrl?: string;
  captionLength: number;
  caption?: string;
  commentText?: string;
  wasSuccessful: boolean;
  metadata?: any;
}): Promise<IPostMemory> {
  return this.create({
    ...data,
    commentedAt: new Date(),
  });
};

// Static method to get recent comments for a target account
postMemorySchema.statics.getRecentComments = async function(
  targetAccount: string,
  limit: number = 10
): Promise<IPostMemory[]> {
  return this.find({ targetAccount })
    .sort({ commentedAt: -1 })
    .limit(limit);
};

// Static method to get comment stats
postMemorySchema.statics.getStats = async function(
  targetAccount?: string,
  days: number = 7
): Promise<{
  total: number;
  successful: number;
  failed: number;
  successRate: number;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const query = targetAccount
    ? { targetAccount, commentedAt: { $gte: startDate } }
    : { commentedAt: { $gte: startDate } };

  const total = await this.countDocuments(query);
  const successful = await this.countDocuments({ ...query, wasSuccessful: true });
  const failed = total - successful;
  const successRate = total > 0 ? (successful / total) * 100 : 0;

  return { total, successful, failed, successRate };
};

// Static method to get the timestamp of the last commented post
postMemorySchema.statics.getLastPostTimestamp = async function(
  targetAccount: string
): Promise<Date | null> {
  const lastComment = await this.findOne({
    targetAccount,
    wasSuccessful: true,
  })
    .sort({ commentedAt: -1 })
    .select('commentedAt');

  return lastComment ? lastComment.commentedAt : null;
};

const PostMemory = mongoose.model<IPostMemory, IPostMemoryModel>(
  'PostMemory',
  postMemorySchema
);

export default PostMemory;
