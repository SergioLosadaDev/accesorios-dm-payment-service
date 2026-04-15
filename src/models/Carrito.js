const pool = require('../config/database');

class Carrito {
  // Crear carrito para usuario
  static async create(usuario_id) {
    const query = `
      INSERT INTO pago.carrito (usuario_id, estado)
      VALUES ($1, 'ACTIVO')
      RETURNING *
    `;
    const result = await pool.query(query, [usuario_id]);
    return result.rows[0];
  }

  // Obtener carrito activo por usuario
  static async getActiveByUser(usuario_id) {
    const query = `
      SELECT * FROM pago.carrito
      WHERE usuario_id = $1 AND estado = 'ACTIVO'
      ORDER BY creado_en DESC
      LIMIT 1
    `;
    const result = await pool.query(query, [usuario_id]);
    return result.rows[0];
  }

  // Obtener carrito con detalles
  static async getCartWithDetails(carrito_id) {
    const query = `
      SELECT 
        c.id, c.usuario_id, c.estado, c.creado_en,
        cd.id as detalle_id, cd.producto_id, cd.cantidad,
        p.nombre as producto_nombre, p.precio
      FROM pago.carrito c
      JOIN pago.carrito_detalle cd ON c.id = cd.carrito_id
      JOIN inventario.producto p ON cd.producto_id = p.id
      WHERE c.id = $1
    `;
    const result = await pool.query(query, [carrito_id]);
    return result.rows;
  }

  // Actualizar estado del carrito
  static async updateStatus(carrito_id, estado) {
    const query = `
      UPDATE pago.carrito
      SET estado = $1
      WHERE id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [estado, carrito_id]);
    return result.rows[0];
  }
}

module.exports = Carrito;