const paymentService = require('../services/paymentService');

class PaymentController {
  // Obtener carrito
  async getCart(req, res) {
    try {
      const { usuario_id } = req.params;
      const cart = await paymentService.getActiveCart(parseInt(usuario_id));
      res.json(cart);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Agregar al carrito
  async addToCart(req, res) {
    try {
      const { usuario_id } = req.params;
      const { producto_id, cantidad } = req.body;
      
      const item = await paymentService.addToCart(parseInt(usuario_id), producto_id, cantidad);
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Actualizar item del carrito
  async updateCartItem(req, res) {
    try {
      const { detalle_id } = req.params;
      const { cantidad } = req.body;
      
      const item = await paymentService.updateCartItem(parseInt(detalle_id), cantidad);
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Eliminar item del carrito
  async removeFromCart(req, res) {
    try {
      const { detalle_id } = req.params;
      await paymentService.removeFromCart(parseInt(detalle_id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Vaciar carrito
  async clearCart(req, res) {
    try {
      const { usuario_id } = req.params;
      await paymentService.clearCart(parseInt(usuario_id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Checkout
  async checkout(req, res) {
    try {
      const { usuario_id } = req.params;
      const { metodo_pago } = req.body;
      
      const result = await paymentService.checkout(parseInt(usuario_id), metodo_pago);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Historial de pedidos
  async getOrderHistory(req, res) {
    try {
      const { usuario_id } = req.params;
      const history = await paymentService.getOrderHistory(parseInt(usuario_id));
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Detalle de pedido específico
  async getOrderDetails(req, res) {
    try {
      const { usuario_id, pedido_id } = req.params;
      const details = await paymentService.getOrderDetails(parseInt(pedido_id), parseInt(usuario_id));
      res.json(details);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new PaymentController();