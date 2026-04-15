const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Rutas del carrito
router.get('/cart/:usuario_id', paymentController.getCart.bind(paymentController));
router.post('/cart/:usuario_id/add', paymentController.addToCart.bind(paymentController));
router.put('/cart/item/:detalle_id', paymentController.updateCartItem.bind(paymentController));
router.delete('/cart/item/:detalle_id', paymentController.removeFromCart.bind(paymentController));
router.delete('/cart/:usuario_id/clear', paymentController.clearCart.bind(paymentController));

// Checkout
router.post('/checkout/:usuario_id', paymentController.checkout.bind(paymentController));

// Pedidos
router.get('/orders/:usuario_id', paymentController.getOrderHistory.bind(paymentController));
router.get('/orders/:usuario_id/:pedido_id', paymentController.getOrderDetails.bind(paymentController));

module.exports = router;