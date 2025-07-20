import { Router } from 'express';
import {
  getAllOrderItems,
  getOrderItemById,
  getOrderItemsByOrderId,
  addItemToOrder,
  updateOrderItemQuantity,
  removeOrderItem,
  getOrderItemsByProductId,
} from '../controllers/orderItemController';

const router = Router();

router.get('/', getAllOrderItems);

router.get('/:id', getOrderItemById);

router.get('/order/:orderId', getOrderItemsByOrderId);

router.get('/product/:productId', getOrderItemsByProductId);

router.post('/order/:orderId', addItemToOrder);

router.put('/:id/quantity', updateOrderItemQuantity);

router.delete('/:id', removeOrderItem);

export default router;
