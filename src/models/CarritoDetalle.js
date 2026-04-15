const pool = require('../config/database');

class CarritoDetalle {
  // Agregar producto al carrito
  static async addItem(carrito_id, producto_id, cantidad) {
    // Verificar si ya existe el producto en el carrito
    const checkQuery = `
      SELECT * FROM pago.carrito_detalle
      WHERE carrito_id = $1 AND producto_id = $2
    `;
    const existing = await pool.query(checkQuery, [carrito_id, producto_id]);
    
    if (existing.rows.length > 0) {
      // Actualizar cantidad
      const updateQuery = `
        UPDATE pago.carrito_detalle
        SET cantidad = cantidad + $1
        WHERE carrito_id = $2 AND producto_id = $3
        RETURNING *
      `;
      const result = await pool.query(updateQuery, [cantidad, carrito_id, producto_id]);
      return result.rows[0];
    } else {
      // Insertar nuevo
      const insertQuery = `
        INSERT INTO pago.carrito_detalle (carrito_id, producto_id, cantidad)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      const result = await pool.query(insertQuery, [carrito_id, producto_id, cantidad]);
      return result.rows[0];
    }
  }

  // Actualizar cantidad
  static async updateQuantity(detalle_id, cantidad) {
    const query = `
      UPDATE pago.carrito_detalle
      SET cantidad = $1
      WHERE id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [cantidad, detalle_id]);
    return result.rows[0];
  }

  // Eliminar item del carrito
  static async removeItem(detalle_id) {
    const query = 'DELETE FROM pago.carrito_detalle WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [detalle_id]);
    return result.rows[0];
  }

  // Vaciar carrito
  static async clearCart(carrito_id) {
    const query = 'DELETE FROM pago.carrito_detalle WHERE carrito_id = $1';
    await pool.query(query, [carrito_id]);
    return true;
  }
}

module.exports = CarritoDetalle;