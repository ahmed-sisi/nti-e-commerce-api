import mongoose, { Document, Schema } from 'mongoose';

export interface IFeedback extends Document {
  id: string;
  rating: number;
  comment?: string;
  created_at: Date;
  product_id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
}

const feedbackSchema: Schema = new Schema(
  {
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    product_id: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: false,
    },
  }
);

feedbackSchema.index({ product_id: 1 });
feedbackSchema.index({ user_id: 1 });
feedbackSchema.index({ rating: 1 });

feedbackSchema.index({ product_id: 1, user_id: 1 }, { unique: true });

export const Feedback = mongoose.model<IFeedback>('Feedback', feedbackSchema);
