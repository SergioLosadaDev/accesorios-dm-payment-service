const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Rutas de administración
router.get('/pedidos', adminController.getAllPedidos);
router.get('/pedidos/:id', adminController.getPedidoDetail);
router.put('/pedidos/:id/estado', adminController.updatePedidoEstado);
router.get('/estados', adminController.getEstadosDisponibles);
router.get('/stats', adminController.getStats);

module.exports = router;