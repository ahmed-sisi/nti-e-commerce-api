import mongoose, { Document, Schema } from 'mongoose';
import { Category } from './categories';

export interface IProduct extends Document {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock_quantity: number;
  created_at: Date;
  updated_at: Date;
  categories: mongoose.Types.ObjectId[];
}

const productSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    stock_quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    categories: [
      {
        type: mongoose.Types.ObjectId,
        ref: 'Category',
        required: true,
      },
    ],
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

productSchema.index({ name: 1 });
productSchema.index({ price: 1 });
productSchema.index({ stock_quantity: 1 });

export const Product = mongoose.model<IProduct>('Product', productSchema);
