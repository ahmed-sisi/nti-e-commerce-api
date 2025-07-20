import { Request, Response } from 'express';
import { Order } from '../models/orders';
import { OrderItem } from '../models/order_items';
import { Product } from '../models/products';
import mongoose from 'mongoose';

export const createOrder = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { user_id, items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must contain at least one item',
      });
    }

    let total_amount = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product_id).session(session);

      if (!product) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: `Product with id ${item.product_id} not found`,
        });
      }

      if (product.stock_quantity < item.quantity) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product ${product.name}. Available: ${product.stock_quantity}`,
        });
      }

      const itemTotal = product.price * item.quantity;
      total_amount += itemTotal;

      orderItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        price: product.price,
      });

      product.stock_quantity -= item.quantity;
      await product.save({ session });
    }

    const order = new Order({
      user_id,
      total_amount,
      status: 'pending',
    });

    const savedOrder = await order.save({ session });

    const orderItemsWithOrderId = orderItems.map(item => ({
      ...item,
      order_id: savedOrder._id,
    }));
    await OrderItem.insertMany(orderItemsWithOrderId, { session });
    await session.commitTransaction();
    const populatedOrder = await Order.findById(savedOrder._id)
      .populate('user_id', 'username email')
      .lean();
    const orderItemsPopulated = await OrderItem.find({ order_id: savedOrder._id })
      .populate('product_id', 'name description price')
      .lean();
    return res.status(201).json({
      success: true,
      data: {
        order: populatedOrder,
        items: orderItemsPopulated,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Create order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  } finally {
    session.endSession();
  }
};

export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, status, user_id } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    if (user_id) filter.user_id = user_id;
    const orders = await Order.find(filter)
      .populate('user_id', 'username email')
      .sort({ created_at: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit))
      .lean();
    const total = await Order.countDocuments(filter);
    return res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          current_page: Number(page),
          total_pages: Math.ceil(total / Number(limit)),
          total_orders: total,
          per_page: Number(limit),
        },
      },
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getOrderById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID',
      });
    }
    const order = await Order.findById(id).populate('user_id', 'username email').lean();
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }
    const orderItems = await OrderItem.find({ order_id: id })
      .populate('product_id', 'name description price')
      .lean();
    return res.status(200).json({
      success: true,
      data: {
        order,
        items: orderItems,
      },
    });
  } catch (error) {
    console.error('Get order by ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID',
      });
    }
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Valid statuses: ' + validStatuses.join(', '),
      });
    }
    const order = await Order.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    ).populate('user_id', 'username email');
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }
    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Update order status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getOrdersByUserId = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, status } = req.query;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }
    const filter: any = { user_id: userId };
    if (status) filter.status = status;
    const orders = await Order.find(filter)
      .populate('user_id', 'username email')
      .sort({ created_at: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit))
      .lean();
    const total = await Order.countDocuments(filter);
    return res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          current_page: Number(page),
          total_pages: Math.ceil(total / Number(limit)),
          total_orders: total,
          per_page: Number(limit),
        },
      },
    });
  } catch (error) {
    console.error('Get orders by user ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const cancelOrder = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID',
      });
    }
    const order = await Order.findById(id).session(session);
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }
    if (order.status === 'cancelled') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Order is already cancelled',
      });
    }
    if (order.status === 'delivered') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel delivered order',
      });
    }
    const orderItems = await OrderItem.find({ order_id: id }).session(session);
    for (const item of orderItems) {
      const product = await Product.findById(item.product_id).session(session);
      if (product) {
        product.stock_quantity += item.quantity;
        await product.save({ session });
      }
    }
    order.status = 'cancelled';
    await order.save({ session });
    await session.commitTransaction();
    return res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: order,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Cancel order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  } finally {
    session.endSession();
  }
};

export const deleteOrder = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID',
      });
    }
    const order = await Order.findById(id).session(session);
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }
    await OrderItem.deleteMany({ order_id: id }, { session });
    await Order.findByIdAndDelete(id, { session });
    await session.commitTransaction();
    return res.status(200).json({
      success: true,
      message: 'Order deleted successfully',
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Delete order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  } finally {
    session.endSession();
  }
};
