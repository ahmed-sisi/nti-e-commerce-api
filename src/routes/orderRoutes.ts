import { Router } from 'express';
import {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  getOrdersByUserId,
  cancelOrder,
  deleteOrder,
} from '../controllers/order.controller';

const router = Router();

router.post('/', createOrder);

router.get('/', getAllOrders);

router.get('/:id', getOrderById);

router.put('/:id/status', updateOrderStatus);

router.get('/user/:userId', getOrdersByUserId);

router.put('/:id/cancel', cancelOrder);

router.delete('/:id', deleteOrder);

export default router;
