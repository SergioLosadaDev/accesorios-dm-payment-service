const prisma = require('../prisma');

// Obtener todos los pedidos (con filtros opcionales)
const getAllPedidos = async (req, res) => {
  try {
    const { estado, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (estado) {
      where.id_estado_actual = parseInt(estado);
    }

    const [pedidos, total] = await Promise.all([
      prisma.pedido.findMany({
        where,
        include: {
          cliente: true,
          estadoPedido: true,
          detalles: {
            include: {
              producto: {
                select: {
                  id_producto: true,
                  nombre: true,
                  precio: true
                }
              }
            }
          }
        },
        orderBy: {
          fecha_pedido: 'desc'
        },
        skip,
        take: parseInt(limit)
      }),
      prisma.pedido.count({ where })
    ]);

    res.json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      total_pages: Math.ceil(total / parseInt(limit)),
      pedidos: pedidos.map(pedido => ({
        id_pedido: pedido.id_pedido,
        fecha_pedido: pedido.fecha_pedido,
        total: pedido.total,
        estado: pedido.estadoPedido.nombre,
        estado_id: pedido.id_estado_actual,
        cliente: {
          id_cliente: pedido.cliente.id_cliente,
          nombre: pedido.cliente.nombre,
          correo: pedido.cliente.correo,
          telefono: pedido.cliente.telefono
        },
        direccion_envio: pedido.direccion_envio,
        telefono_contacto: pedido.telefono_contacto,
        cantidad_productos: pedido.detalles.reduce((sum, d) => sum + d.cantidad, 0)
      }))
    });

  } catch (error) {
    console.error('Error al obtener pedidos:', error);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
};

// Obtener detalle de un pedido específico
const getPedidoDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const pedido = await prisma.pedido.findUnique({
      where: { id_pedido: parseInt(id) },
      include: {
        cliente: true,
        estadoPedido: true,
        detalles: {
          include: {
            producto: {
              select: {
                id_producto: true,
                nombre: true,
                precio: true,
                stock: true
              }
            }
          }
        },
        historial: {
          include: {
            estado: true
          },
          orderBy: {
            fecha_cambio: 'desc'
          }
        }
      }
    });

    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    res.json({
      id_pedido: pedido.id_pedido,
      fecha_pedido: pedido.fecha_pedido,
      total: pedido.total,
      estado: pedido.estadoPedido.nombre,
      estado_id: pedido.id_estado_actual,
      direccion_envio: pedido.direccion_envio,
      telefono_contacto: pedido.telefono_contacto,
      cliente: {
        id_cliente: pedido.cliente.id_cliente,
        nombre: pedido.cliente.nombre,
        correo: pedido.cliente.correo,
        telefono: pedido.cliente.telefono
      },
      productos: pedido.detalles.map(d => ({
        id_producto: d.producto.id_producto,
        nombre: d.producto.nombre,
        cantidad: d.cantidad,
        precio_unitario: d.precio_unitario,
        subtotal: d.cantidad * parseFloat(d.precio_unitario)
      })),
      historial: pedido.historial.map(h => ({
        fecha: h.fecha_cambio,
        estado: h.estado.nombre,
        observacion: h.observacion
      }))
    });

  } catch (error) {
    console.error('Error al obtener detalle del pedido:', error);
    res.status(500).json({ error: 'Error al obtener detalle del pedido' });
  }
};

// Actualizar estado de un pedido
const updatePedidoEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado_id, observacion } = req.body;

    // Verificar que el pedido existe
    const pedido = await prisma.pedido.findUnique({
      where: { id_pedido: parseInt(id) }
    });

    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // Verificar que el nuevo estado existe
    const nuevoEstado = await prisma.estadoPedido.findUnique({
      where: { id_estado: parseInt(estado_id) }
    });

    if (!nuevoEstado) {
      return res.status(400).json({ error: 'Estado no válido' });
    }

    // Actualizar estado del pedido
    const pedidoActualizado = await prisma.pedido.update({
      where: { id_pedido: parseInt(id) },
      data: { id_estado_actual: parseInt(estado_id) }
    });

    // Registrar en historial
    await prisma.historialEstadoPedido.create({
      data: {
        observacion: observacion || `Estado actualizado a: ${nuevoEstado.nombre}`,
        id_pedido: parseInt(id),
        id_estado: parseInt(estado_id)
      }
    });

    res.json({
      message: 'Estado actualizado correctamente',
      pedido: {
        id_pedido: pedidoActualizado.id_pedido,
        estado_anterior: pedido.id_estado_actual,
        estado_nuevo: parseInt(estado_id),
        estado_nombre: nuevoEstado.nombre
      }
    });

  } catch (error) {
    console.error('Error al actualizar estado del pedido:', error);
    res.status(500).json({ error: 'Error al actualizar estado del pedido' });
  }
};

// Obtener todos los estados disponibles
const getEstadosDisponibles = async (req, res) => {
  try {
    const estados = await prisma.estadoPedido.findMany({
      orderBy: { id_estado: 'asc' }
    });

    res.json(estados);
  } catch (error) {
    console.error('Error al obtener estados:', error);
    res.status(500).json({ error: 'Error al obtener estados' });
  }
};

// Obtener estadísticas del dashboard
const getStats = async (req, res) => {
  try {
    const [totalPedidos, totalClientes, totalProductos, pedidosPorEstado, ventasUltimoMes] = await Promise.all([
      prisma.pedido.count(),
      prisma.cliente.count(),
      prisma.producto.count(),
      prisma.estadoPedido.findMany({
        include: {
          _count: {
            select: { pedidos: true }
          }
        }
      }),
      prisma.pedido.aggregate({
        where: {
          fecha_pedido: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        },
        _sum: {
          total: true
        }
      })
    ]);

    res.json({
      total_pedidos: totalPedidos,
      total_clientes: totalClientes,
      total_productos: totalProductos,
      ventas_ultimo_mes: ventasUltimoMes._sum.total || 0,
      pedidos_por_estado: pedidosPorEstado.map(e => ({
        estado: e.nombre,
        cantidad: e._count.pedidos
      }))
    });

  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
};

module.exports = {
  getAllPedidos,
  getPedidoDetail,
  updatePedidoEstado,
  getEstadosDisponibles,
  getStats
};