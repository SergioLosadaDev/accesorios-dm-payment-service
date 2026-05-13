const express = require('express');
const router = express.Router();
const pedidoController = require('../controllers/pedidoController');

// Rutas de pedido
router.post('/crear', pedidoController.crearPedidoDesdeCarrito);
router.get('/:id', pedidoController.obtenerPedido);

module.exports = router;