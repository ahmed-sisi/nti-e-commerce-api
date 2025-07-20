import mongoose, { Document, Schema } from 'mongoose';

export interface ICategory extends Document {
  id: string;
  name: string;
  description?: string;
}

const categorySchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    products: [
      {
        type: mongoose.Types.ObjectId,
        ref: 'Product',
      },
    ],
  },
  {
    timestamps: false,
  }
);

categorySchema.index({ name: 1 });

export const Category = mongoose.model<ICategory>('Category', categorySchema);
