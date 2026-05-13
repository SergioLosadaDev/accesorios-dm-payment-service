const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 9002;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const carritoRoutes = require('./routes/carritoRoutes');
const pedidoRoutes = require('./routes/pedidoRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({ 
    status: 'UP', 
    service: 'payment-service', 
    version: '1.0.0' 
  });
});

// Rutas
app.use('/api/v1/carrito', carritoRoutes);
app.use('/api/v1/pedidos', pedidoRoutes);
app.use('/api/v1/admin', adminRoutes);

app.listen(PORT, () => {
  console.log(`Payment Service running on port ${PORT}`);
});