import mongoose, { Document, Schema } from 'mongoose';

export interface IOrder extends Document {
  id: string;
  total_amount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  created_at: Date;
  updated_at: Date;
  user_id: mongoose.Types.ObjectId;
}

const orderSchema: Schema = new Schema(
  {
    total_amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
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
      updatedAt: 'updated_at',
    },
  }
);

orderSchema.index({ user_id: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ created_at: -1 });

export const Order = mongoose.model<IOrder>('Order', orderSchema);
