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

// Actualizar estado de pedido
const updatePedidoEstado = async (req, res) => {
    try {
        const { id } = req.params;
        const { id_estado, estado } = req.body;
        const estadoQuery = req.query.estado;
        
        let estadoId = null;
        
        // Prioridad: 1. id_estado (body), 2. estado (query), 3. estado (body)
        if (id_estado) {
            estadoId = parseInt(id_estado);
        } else if (estadoQuery) {
            const estadoEncontrado = await prisma.estadoPedido.findFirst({
                where: { nombre: estadoQuery }
            });
            if (estadoEncontrado) {
                estadoId = estadoEncontrado.id_estado;
            }
        } else if (estado) {
            const estadoEncontrado = await prisma.estadoPedido.findFirst({
                where: { nombre: estado }
            });
            if (estadoEncontrado) {
                estadoId = estadoEncontrado.id_estado;
            }
        }
        
        if (!estadoId) {
            return res.status(400).json({ 
                error: "Se requiere id_estado o estado",
                ejemplo: { id_estado: 2, estado: "PAGADO" }
            });
        }
        
        // Verificar que el pedido existe
        const pedido = await prisma.pedido.findUnique({
            where: { id_pedido: parseInt(id) }
        });
        
        if (!pedido) {
            return res.status(404).json({ error: "Pedido no encontrado" });
        }
        
        // Verificar que el nuevo estado existe
        const nuevoEstado = await prisma.estadoPedido.findUnique({
            where: { id_estado: estadoId }
        });
        
        if (!nuevoEstado) {
            return res.status(404).json({ error: "Estado no encontrado" });
        }
        
        // Actualizar el pedido - CAMPO CORRECTO: id_estado_actual
        const pedidoActualizado = await prisma.pedido.update({
            where: { id_pedido: parseInt(id) },
            data: { 
                id_estado_actual: estadoId
            }
        });
        
        // Registrar en historial
        await prisma.historialEstadoPedido.create({
            data: {
                id_pedido: parseInt(id),
                id_estado: estadoId,
                observacion: `Estado actualizado a: ${nuevoEstado.nombre}`
            }
        });
        
        res.json({
            success: true,
            message: "Estado actualizado correctamente",
            pedido: pedidoActualizado,
            nuevo_estado: nuevoEstado.nombre
        });
        
    } catch (error) {
        console.error("Error al actualizar estado del pedido:", error);
        res.status(500).json({ error: "No se pudo actualizar estado", details: error.message });
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

// Obtener resumen de ventas por período
const getVentasPorPeriodo = async (req, res) => {
  try {
    const { periodo = 'mes', fecha_inicio, fecha_fin } = req.query;
    
    let startDate, endDate;
    
    if (fecha_inicio && fecha_fin) {
      startDate = new Date(fecha_inicio);
      endDate = new Date(fecha_fin);
    } else {
      endDate = new Date();
      switch (periodo) {
        case 'dia':
          startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'semana':
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'mes':
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'año':
          startDate = new Date();
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1);
      }
    }

    const pedidos = await prisma.pedido.findMany({
      where: {
        fecha_pedido: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        estadoPedido: true
      }
    });

    const totalVentas = pedidos.reduce((sum, p) => sum + parseFloat(p.total), 0);
    const pedidosCompletados = pedidos.filter(p => p.estadoPedido.nombre === 'ENTREGADO').length;
    const pedidosPendientes = pedidos.filter(p => p.estadoPedido.nombre === 'PENDIENTE').length;
    const pedidosEnviados = pedidos.filter(p => p.estadoPedido.nombre === 'ENVIADO').length;

    // Ventas por día (para gráfico)
    const ventasPorDia = {};
    pedidos.forEach(p => {
      const fecha = p.fecha_pedido.toISOString().split('T')[0];
      if (!ventasPorDia[fecha]) {
        ventasPorDia[fecha] = { total: 0, cantidad: 0 };
      }
      ventasPorDia[fecha].total += parseFloat(p.total);
      ventasPorDia[fecha].cantidad++;
    });

    res.json({
      periodo: {
        desde: startDate,
        hasta: endDate
      },
      resumen: {
        total_ventas: totalVentas,
        total_pedidos: pedidos.length,
        pedidos_completados: pedidosCompletados,
        pedidos_pendientes: pedidosPendientes,
        pedidos_enviados: pedidosEnviados,
        ticket_promedio: pedidos.length > 0 ? totalVentas / pedidos.length : 0
      },
      ventas_por_dia: Object.entries(ventasPorDia).map(([fecha, data]) => ({
        fecha,
        total: data.total,
        cantidad: data.cantidad
      }))
    });

  } catch (error) {
    console.error('Error al obtener ventas por período:', error);
    res.status(500).json({ error: 'Error al obtener ventas por período' });
  }
};

// Obtener productos más vendidos
const getProductosMasVendidos = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const productos = await prisma.detallePedido.groupBy({
      by: ['id_producto'],
      _sum: {
        cantidad: true
      },
      orderBy: {
        _sum: {
          cantidad: 'desc'
        }
      },
      take: parseInt(limit)
    });

    const productosConDetalle = await Promise.all(
      productos.map(async (p) => {
        const producto = await prisma.producto.findUnique({
          where: { id_producto: p.id_producto },
          select: {
            id_producto: true,
            nombre: true,
            precio: true
          }
        });
        return {
          ...producto,
          total_vendido: p._sum.cantidad,
          total_ingresos: p._sum.cantidad * parseFloat(producto.precio)
        };
      })
    );

    res.json(productosConDetalle);
  } catch (error) {
    console.error('Error al obtener productos más vendidos:', error);
    res.status(500).json({ error: 'Error al obtener productos más vendidos' });
  }
};

// Obtener clientes más frecuentes
const getClientesTop = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const clientes = await prisma.pedido.groupBy({
      by: ['id_cliente'],
      _count: {
        id_pedido: true
      },
      _sum: {
        total: true
      },
      orderBy: {
        _count: {
          id_pedido: 'desc'
        }
      },
      take: parseInt(limit)
    });

    const clientesConDetalle = await Promise.all(
      clientes.map(async (c) => {
        const cliente = await prisma.cliente.findUnique({
          where: { id_cliente: c.id_cliente },
          select: {
            id_cliente: true,
            nombre: true,
            correo: true,
            telefono: true
          }
        });
        return {
          ...cliente,
 total_pedidos: c._count.id_pedido,
          total_gastado: c._sum.total
        };
      })
    );

    res.json(clientesConDetalle);
  } catch (error) {
    console.error('Error al obtener clientes top:', error);
    res.status(500).json({ error: 'Error al obtener clientes top' });
  }
};

module.exports = {
  getAllPedidos,
  getPedidoDetail,
  updatePedidoEstado,
  getEstadosDisponibles,
  getStats,
  getVentasPorPeriodo,
  getProductosMasVendidos,
  getClientesTop
};