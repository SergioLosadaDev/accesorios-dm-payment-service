const pool = require('../config/database');

class Pago {
  // Crear registro de pago
  static async create(pedido_id, metodo_pago) {
    const query = `
      INSERT INTO pago.pago (pedido_id, metodo_pago, estado, fecha)
      VALUES ($1, $2, 'PENDIENTE', CURRENT_TIMESTAMP)
      RETURNING *
    `;
    const result = await pool.query(query, [pedido_id, metodo_pago]);
    return result.rows[0];
  }

  // Procesar pago (simulación)
  static async process(pago_id) {
    // Simular procesamiento de pago
    const estados = ['COMPLETADO', 'RECHAZADO'];
    const estado = estados[Math.random() > 0.2 ? 0 : 1]; // 80% éxito
    
    const query = `
      UPDATE pago.pago
      SET estado = $1
      WHERE id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [estado, pago_id]);
    return result.rows[0];
  }

  // Obtener pago por pedido
  static async getByPedido(pedido_id) {
    const query = `
      SELECT * FROM pago.pago WHERE pedido_id = $1
    `;
    const result = await pool.query(query, [pedido_id]);
    return result.rows[0];
  }

  // Actualizar estado del pago
  static async updateStatus(pago_id, estado) {
    const query = `
      UPDATE pago.pago
      SET estado = $1
      WHERE id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [estado, pago_id]);
    return result.rows[0];
  }
}

module.exports = Pago;