const Carrito = require('../models/Carrito');
const CarritoDetalle = require('../models/CarritoDetalle');
const Pedido = require('../models/Pedido');
const Pago = require('../models/Pago');

class PaymentService {
  // Obtener carrito activo del usuario
  async getActiveCart(usuario_id) {
    let carrito = await Carrito.getActiveByUser(usuario_id);
    if (!carrito) {
      carrito = await Carrito.create(usuario_id);
    }
    
    const detalles = await Carrito.getCartWithDetails(carrito.id);
    return {
      carrito,
      items: detalles,
      total: detalles.reduce((sum, item) => sum + (parseFloat(item.precio) * item.cantidad), 0)
    };
  }

  // Agregar item al carrito
  async addToCart(usuario_id, producto_id, cantidad) {
    let carrito = await Carrito.getActiveByUser(usuario_id);
    if (!carrito) {
      carrito = await Carrito.create(usuario_id);
    }
    
    const item = await CarritoDetalle.addItem(carrito.id, producto_id, cantidad);
    return item;
  }

  // Actualizar cantidad
  async updateCartItem(detalle_id, cantidad) {
    return await CarritoDetalle.updateQuantity(detalle_id, cantidad);
  }

  // Eliminar item del carrito
  async removeFromCart(detalle_id) {
    return await CarritoDetalle.removeItem(detalle_id);
  }

  // Vaciar carrito
  async clearCart(usuario_id) {
    const carrito = await Carrito.getActiveByUser(usuario_id);
    if (carrito) {
      await CarritoDetalle.clearCart(carrito.id);
    }
    return true;
  }

  // Crear pedido y procesar pago
  async checkout(usuario_id, metodo_pago) {
    const carrito = await Carrito.getActiveByUser(usuario_id);
    if (!carrito) {
      throw new Error('No hay carrito activo');
    }
    
    // Crear pedido
    const pedido = await Pedido.createFromCart(usuario_id, carrito.id);
    
    // Crear registro de pago
    const pago = await Pago.create(pedido.id, metodo_pago);
    
    // Procesar pago
    const pagoProcesado = await Pago.process(pago.id);
    
    // Actualizar estado del pedido según el pago
    if (pagoProcesado.estado === 'COMPLETADO') {
      await Pedido.updateStatus(pedido.id, 'CONFIRMADO');
    } else {
      await Pedido.updateStatus(pedido.id, 'RECHAZADO');
    }
    
    return {
      pedido,
      pago: pagoProcesado
    };
  }

  // Obtener historial de pedidos del usuario
  async getOrderHistory(usuario_id) {
    const pedidos = await Pedido.getByUser(usuario_id);
    
    const pedidosConDetalles = [];
    for (const pedido of pedidos) {
      const detalles = await Pedido.getWithDetails(pedido.id);
      const pago = await Pago.getByPedido(pedido.id);
      
      pedidosConDetalles.push({
        pedido,
        items: detalles,
        pago
      });
    }
    
    return pedidosConDetalles;
  }

  // Obtener detalle de un pedido específico
  async getOrderDetails(pedido_id, usuario_id) {
    const pedido = await Pedido.getById(pedido_id);
    
    if (!pedido || pedido.usuario_id !== usuario_id) {
      throw new Error('Pedido no encontrado o no autorizado');
    }
    
    const detalles = await Pedido.getWithDetails(pedido_id);
    const pago = await Pago.getByPedido(pedido_id);
    
    return {
      pedido,
      items: detalles,
      pago
    };
  }
}

module.exports = new PaymentService();