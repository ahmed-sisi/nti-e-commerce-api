import mongoose, { Document, Schema } from 'mongoose';

export interface IOrderItem extends Document {
  id: string;
  quantity: number;
  price: number;
  product_id: mongoose.Types.ObjectId;
  order_id: mongoose.Types.ObjectId;
}

const orderItemSchema: Schema = new Schema(
  {
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    product_id: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    order_id: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
  },
  {
    timestamps: false,
  }
);

orderItemSchema.index({ order_id: 1 });
orderItemSchema.index({ product_id: 1 });

orderItemSchema.index({ order_id: 1, product_id: 1 }, { unique: true });

export const OrderItem = mongoose.model<IOrderItem>('OrderItem', orderItemSchema);
