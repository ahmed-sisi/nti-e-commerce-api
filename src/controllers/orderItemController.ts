import { Request, Response } from 'express';
import { OrderItem } from '../models/order_items';
import { Order } from '../models/orders';
import { Product } from '../models/products';
import mongoose from 'mongoose';
export const getAllOrderItems = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, order_id, product_id } = req.query;
    const filter: any = {};
    if (order_id) filter.order_id = order_id;
    if (product_id) filter.product_id = product_id;
    const orderItems = await OrderItem.find(filter)
      .populate('order_id', 'total_amount status created_at')
      .populate('product_id', 'name description price')
      .sort({ _id: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit))
      .lean();
    const total = await OrderItem.countDocuments(filter);
    return res.status(200).json({
      success: true,
      data: {
        order_items: orderItems,
        pagination: {
          current_page: Number(page),
          total_pages: Math.ceil(total / Number(limit)),
          total_items: total,
          per_page: Number(limit),
        },
      },
    });
  } catch (error) {
    console.error('Get all order items error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getOrderItemById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order item ID',
      });
    }

    const orderItem = await OrderItem.findById(id)
      .populate('order_id', 'total_amount status created_at user_id')
      .populate('product_id', 'name description price stock_quantity')
      .lean();

    if (!orderItem) {
      return res.status(404).json({
        success: false,
        message: 'Order item not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: orderItem,
    });
  } catch (error) {
    console.error('Get order item by ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getOrderItemsByOrderId = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID',
      });
    }
    const orderItems = await OrderItem.find({ order_id: orderId })
      .populate('product_id', 'name description price stock_quantity')
      .lean();
    if (orderItems.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No order items found for this order',
      });
    }
    const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return res.status(200).json({
      success: true,
      data: {
        order_items: orderItems,
        summary: {
          total_items: orderItems.length,
          total_quantity: totalQuantity,
          total_amount: totalAmount,
        },
      },
    });
  } catch (error) {
    console.error('Get order items by order ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
export const addItemToOrder = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId } = req.params;
    const { product_id, quantity } = req.body;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID',
      });
    }
    if (!mongoose.Types.ObjectId.isValid(product_id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }
    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be greater than 0',
      });
    }
    const order = await Order.findById(orderId).session(session);
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }
    if (order.status === 'delivered' || order.status === 'cancelled') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Cannot modify delivered or cancelled orders',
      });
    }
    const product = await Product.findById(product_id).session(session);
    if (!product) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    if (product.stock_quantity < quantity) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Available: ${product.stock_quantity}`,
      });
    }
    const existingItem = await OrderItem.findOne({
      order_id: orderId,
      product_id,
    }).session(session);

    if (existingItem) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Product already exists in this order. Use update endpoint to modify quantity.',
      });
    }
    const orderItem = new OrderItem({
      order_id: orderId,
      product_id,
      quantity,
      price: product.price,
    });

    await orderItem.save({ session });
    product.stock_quantity -= quantity;
    await product.save({ session });
    const itemTotal = product.price * quantity;
    order.total_amount += itemTotal;
    await order.save({ session });
    await session.commitTransaction();
    const populatedOrderItem = await OrderItem.findById(orderItem._id)
      .populate('product_id', 'name description price')
      .lean();

    return res.status(201).json({
      success: true,
      data: populatedOrderItem,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Add item to order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  } finally {
    session.endSession();
  }
};

// ...existing code...
export const updateOrderItemQuantity = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { quantity } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order item ID',
      });
    }

    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be greater than 0',
      });
    }

    const orderItem = await OrderItem.findById(id).session(session);
    if (!orderItem) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Order item not found',
      });
    }
    const order = await Order.findById(orderItem.order_id).session(session);
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Associated order not found',
      });
    }

    if (order.status === 'delivered' || order.status === 'cancelled') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Cannot modify delivered or cancelled orders',
      });
    }
    const product = await Product.findById(orderItem.product_id).session(session);
    if (!product) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Associated product not found',
      });
    }
    const quantityDifference = quantity - orderItem.quantity;
    if (quantityDifference > 0 && product.stock_quantity < quantityDifference) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Available: ${product.stock_quantity}`,
      });
    }
    product.stock_quantity -= quantityDifference;
    await product.save({ session });
    const oldItemTotal = orderItem.price * orderItem.quantity;
    const newItemTotal = orderItem.price * quantity;
    const totalDifference = newItemTotal - oldItemTotal;
    order.total_amount += totalDifference;
    await order.save({ session });
    orderItem.quantity = quantity;
    await orderItem.save({ session });
    await session.commitTransaction();
    const updatedOrderItem = await OrderItem.findById(id)
      .populate('product_id', 'name description price')
      .lean();
    return res.status(200).json({
      success: true,
      data: updatedOrderItem,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Update order item quantity error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  } finally {
    session.endSession();
  }
};

export const removeOrderItem = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order item ID',
      });
    }
    const orderItem = await OrderItem.findById(id).session(session);
    if (!orderItem) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Order item not found',
      });
    }
    const order = await Order.findById(orderItem.order_id).session(session);
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Associated order not found',
      });
    }
    if (order.status === 'delivered' || order.status === 'cancelled') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Cannot modify delivered or cancelled orders',
      });
    }
    const product = await Product.findById(orderItem.product_id).session(session);
    if (product) {
      product.stock_quantity += orderItem.quantity;
      await product.save({ session });
    }
    const itemTotal = orderItem.price * orderItem.quantity;
    order.total_amount -= itemTotal;
    await order.save({ session });
    await OrderItem.findByIdAndDelete(id, { session });
    await session.commitTransaction();
    return res.status(200).json({
      success: true,
      message: 'Order item removed successfully',
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Remove order item error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  } finally {
    session.endSession();
  }
};

export const getOrderItemsByProductId = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }
    const orderItems = await OrderItem.find({ product_id: productId })
      .populate('order_id', 'total_amount status created_at user_id')
      .sort({ _id: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit))
      .lean();
    const total = await OrderItem.countDocuments({ product_id: productId });

    const salesStats = await OrderItem.aggregate([
      { $match: { product_id: new mongoose.Types.ObjectId(productId) } },
      {
        $group: {
          _id: null,
          totalSold: { $sum: '$quantity' },
          totalRevenue: { $sum: { $multiply: ['$quantity', '$price'] } },
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      data: {
        order_items: orderItems,
        summary: {
          total_quantity_sold: salesStats[0]?.totalSold || 0,
          total_revenue: salesStats[0]?.totalRevenue || 0,
          total_orders: total,
        },
        pagination: {
          current_page: Number(page),
          total_pages: Math.ceil(total / Number(limit)),
          total_items: total,
          per_page: Number(limit),
        },
      },
    });
  } catch (error) {
    console.error('Get order items by product ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
