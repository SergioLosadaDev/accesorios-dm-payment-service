const express = require('express');
const router = express.Router();
const carritoController = require('../controllers/carritoController');

// Rutas públicas (sin autenticación por ahora)
router.post('/', carritoController.crearCarrito);
router.get('/:id', carritoController.obtenerCarrito);
router.post('/:id/items', carritoController.agregarItem);
router.put('/items/:itemId', carritoController.actualizarItem);
router.delete('/items/:itemId', carritoController.eliminarItem);
router.delete('/:id', carritoController.vaciarCarrito);

module.exports = router;