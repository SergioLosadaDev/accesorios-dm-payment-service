const pool = require('../config/database');

class Pedido {
  // Crear pedido a partir del carrito
  static async createFromCart(usuario_id, carrito_id) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Obtener detalles del carrito
      const cartQuery = `
        SELECT cd.producto_id, cd.cantidad, p.precio
        FROM pago.carrito_detalle cd
        JOIN inventario.producto p ON cd.producto_id = p.id
        WHERE cd.carrito_id = $1
      `;
      const cartItems = await client.query(cartQuery, [carrito_id]);
      
      if (cartItems.rows.length === 0) {
        throw new Error('El carrito está vacío');
      }
      
      // Calcular total
      const total = cartItems.rows.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
      
      // Crear pedido
      const pedidoQuery = `
        INSERT INTO pago.pedido (usuario_id, total, estado)
        VALUES ($1, $2, 'PENDIENTE')
        RETURNING *
      `;
      const pedido = await client.query(pedidoQuery, [usuario_id, total]);
      const pedido_id = pedido.rows[0].id;
      
      // Crear detalles del pedido
      for (const item of cartItems.rows) {
        const detalleQuery = `
          INSERT INTO pago.pedido_detalle (pedido_id, producto_id, cantidad, precio_unitario)
          VALUES ($1, $2, $3, $4)
        `;
        await client.query(detalleQuery, [pedido_id, item.producto_id, item.cantidad, item.precio]);
      }
      
      // Actualizar estado del carrito
      await client.query(`
        UPDATE pago.carrito SET estado = 'COMPLETADO' WHERE id = $1
      `, [carrito_id]);
      
      await client.query('COMMIT');
      return pedido.rows[0];
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Obtener pedido por ID
  static async getById(pedido_id) {
    const query = `
      SELECT * FROM pago.pedido WHERE id = $1
    `;
    const result = await pool.query(query, [pedido_id]);
    return result.rows[0];
  }

  // Obtener pedidos por usuario
  static async getByUser(usuario_id) {
    const query = `
      SELECT * FROM pago.pedido
      WHERE usuario_id = $1
      ORDER BY fecha DESC
    `;
    const result = await pool.query(query, [usuario_id]);
    return result.rows;
  }

  // Obtener pedido con detalles
  static async getWithDetails(pedido_id) {
    const query = `
      SELECT 
        p.id, p.usuario_id, p.fecha, p.total, p.estado,
        pd.id as detalle_id, pd.producto_id, pd.cantidad, pd.precio_unitario,
        inv.nombre as producto_nombre
      FROM pago.pedido p
      JOIN pago.pedido_detalle pd ON p.id = pd.pedido_id
      JOIN inventario.producto inv ON pd.producto_id = inv.id
      WHERE p.id = $1
    `;
    const result = await pool.query(query, [pedido_id]);
    return result.rows;
  }

  // Actualizar estado del pedido
  static async updateStatus(pedido_id, estado) {
    const query = `
      UPDATE pago.pedido
      SET estado = $1
      WHERE id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [estado, pedido_id]);
    return result.rows[0];
  }
}

module.exports = Pedido;