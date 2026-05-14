const express = require('express');
const router = express.Router();
const pedidoController = require('../controllers/pedidoController');

// Rutas de pedido
router.post('/crear', pedidoController.crearPedidoDesdeCarrito);
router.get('/:id', pedidoController.obtenerPedido);
router.get('/cliente/correo/:correo', pedidoController.getPedidosByClienteCorreo);
router.get('/cliente/id/:clienteId', pedidoController.getPedidosByClienteId);

module.exports = router;