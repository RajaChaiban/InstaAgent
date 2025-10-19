/**
 * Cookie Model - Stores Instagram session cookies for persistent login
 * This allows the agent to maintain sessions across restarts without re-login
 */

import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ICookie extends Document {
  username: string;
  platform: 'instagram' | 'twitter' | 'github';
  cookies: any[];  // Array of cookie objects
  sessionId?: string;
  lastUsed: Date;
  expiresAt?: Date;
  isValid: boolean;
  metadata?: {
    userAgent?: string;
    deviceId?: string;
    ipAddress?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const cookieSchema: Schema<ICookie> = new Schema(
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
    },
    cookies: {
      type: Schema.Types.Mixed,
      required: true,
    },
    sessionId: {
      type: String,
      index: true,
    },
    lastUsed: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
    },
    isValid: {
      type: Boolean,
      default: true,
    },
    metadata: {
      userAgent: String,
      deviceId: String,
      ipAddress: String,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// Create compound index for faster queries
cookieSchema.index({ username: 1, platform: 1 }, { unique: true });

// Method to check if cookie is expired
cookieSchema.methods.isExpired = function(): boolean {
  if (this.expiresAt) {
    return new Date() > this.expiresAt;
  }
  return false;
};

// Static method to find valid cookies for a user
cookieSchema.statics.findValidCookie = async function(
  username: string,
  platform: string = 'instagram'
): Promise<ICookie | null> {
  return this.findOne({
    username,
    platform,
    isValid: true,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  }).sort({ lastUsed: -1 });
};

const Cookie: Model<ICookie> = mongoose.model<ICookie>('Cookie', cookieSchema);

export default Cookie;
