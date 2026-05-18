const prisma = require('../prisma');

// Obtener estado PENDIENTE (por defecto)
const getEstadoPendienteId = async () => {
  const estado = await prisma.estadoPedido.findFirst({
    where: { nombre: 'PENDIENTE' }
  });
  return estado ? estado.id_estado : 1; // Fallback a 1 si no existe
};

// Crear pedido desde carrito
const crearPedidoDesdeCarrito = async (req, res) => {
  try {
    const { 
      id_carrito, 
      direccion_envio, 
      telefono_contacto,
      cliente_nombre,
      cliente_correo,
      cliente_telefono 
    } = req.body;

    // 1. Obtener el carrito con sus items
    const carrito = await prisma.carrito.findUnique({
      where: { id_carrito: parseInt(id_carrito) },
      include: {
        items: {
          include: {
            producto: true
          }
        }
      }
    });

    if (!carrito) {
      return res.status(404).json({ error: 'Carrito no encontrado' });
    }

    if (carrito.items.length === 0) {
      return res.status(400).json({ error: 'El carrito está vacío' });
    }

    // 2. Verificar stock de cada producto
    for (const item of carrito.items) {
      if (item.producto.stock < item.cantidad) {
        return res.status(400).json({ 
          error: `Stock insuficiente para el producto: ${item.producto.nombre}` 
        });
      }
    }

    // 3. Crear o buscar cliente
    let cliente = await prisma.cliente.findUnique({
      where: { correo: cliente_correo }
    });

    if (!cliente) {
      cliente = await prisma.cliente.create({
        data: {
          nombre: cliente_nombre,
          correo: cliente_correo,
          telefono: cliente_telefono
        }
      });
    }

    // 4. Calcular total del pedido
    const total = carrito.items.reduce((sum, item) => {
      return sum + (item.cantidad * parseFloat(item.precio_unitario));
    }, 0);

    // 5. Obtener estado pendiente
    const estadoPendienteId = await getEstadoPendienteId();

    // 6. Crear el pedido
    const pedido = await prisma.pedido.create({
      data: {
        direccion_envio,
        telefono_contacto,
        total,
        id_cliente: cliente.id_cliente,
        id_estado_actual: estadoPendienteId
      }
    });

    // 7. Crear detalles del pedido
    for (const item of carrito.items) {
      await prisma.detallePedido.create({
        data: {
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          id_pedido: pedido.id_pedido,
          id_producto: item.id_producto
        }
      });

      // 8. Actualizar stock del producto
      await prisma.producto.update({
        where: { id_producto: item.id_producto },
        data: {
          stock: item.producto.stock - item.cantidad
        }
      });
    }

    // 9. Registrar historial de estado
    await prisma.historialEstadoPedido.create({
      data: {
        observacion: 'Pedido creado desde carrito',
        id_pedido: pedido.id_pedido,
        id_estado: estadoPendienteId
      }
    });

    // 10. Marcar carrito como procesado
    await prisma.carrito.update({
      where: { id_carrito: parseInt(id_carrito) },
      data: { estado: 'procesado' }
    });

    // 11. Registrar movimiento de inventario (salida)
    for (const item of carrito.items) {
      await prisma.$executeRaw`
        INSERT INTO inventario.inventario_movimiento (cantidad, referencia, id_producto, id_tipo_movimiento)
        VALUES (${-item.cantidad}, ${`Pedido #${pedido.id_pedido}`}, ${item.id_producto}, 2)
      `;
    }

    res.status(201).json({
      message: 'Pedido creado exitosamente',
      pedido: {
        id_pedido: pedido.id_pedido,
        total: pedido.total,
        direccion_envio: pedido.direccion_envio,
        telefono_contacto: pedido.telefono_contacto,
        fecha_pedido: pedido.fecha_pedido,
        estado: 'PENDIENTE'
      },
      cliente: {
        id_cliente: cliente.id_cliente,
        nombre: cliente.nombre,
        correo: cliente.correo
      },
      whatsapp_link: `https://wa.me/573166751065?text=Hola,%20quiero%20realizar%20el%20pago%20del%20pedido%20%23${pedido.id_pedido}%20por%20un%20total%20de%20$${total}`
    });

  } catch (error) {
    console.error('Error al crear pedido:', error);
    res.status(500).json({ error: 'Error al crear pedido', details: error.message });
  }
};

// Obtener pedido por ID
const obtenerPedido = async (req, res) => {
  try {
    const { id } = req.params;

    const pedido = await prisma.pedido.findUnique({
      where: { id_pedido: parseInt(id) },
      include: {
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
        },
        cliente: true,
        estadoPedido: true,
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

    res.json(pedido);
  } catch (error) {
    console.error('Error al obtener pedido:', error);
    res.status(500).json({ error: 'Error al obtener pedido' });
  }
};

// Obtener pedidos por correo del cliente
const getPedidosByClienteCorreo = async (req, res) => {
  try {
    const { correo } = req.params;

    // Buscar cliente por correo
    const cliente = await prisma.cliente.findUnique({
      where: { correo: decodeURIComponent(correo) }
    });

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Obtener pedidos del cliente
    const pedidos = await prisma.pedido.findMany({
      where: { id_cliente: cliente.id_cliente },
      include: {
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
      }
    });

    res.json({
      cliente: {
        id_cliente: cliente.id_cliente,
        nombre: cliente.nombre,
        correo: cliente.correo
      },
      total_pedidos: pedidos.length,
      pedidos: pedidos.map(pedido => ({
        id_pedido: pedido.id_pedido,
        fecha_pedido: pedido.fecha_pedido,
        total: pedido.total,
        estado: pedido.estadoPedido.nombre,
        direccion_envio: pedido.direccion_envio,
        telefono_contacto: pedido.telefono_contacto,
        cantidad_productos: pedido.detalles.reduce((sum, d) => sum + d.cantidad, 0),
        productos: pedido.detalles.map(d => ({
          nombre: d.producto.nombre,
          cantidad: d.cantidad,
          precio_unitario: d.precio_unitario,
          subtotal: d.cantidad * parseFloat(d.precio_unitario)
        }))
      }))
    });

  } catch (error) {
    console.error('Error al obtener pedidos por correo:', error);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
};

// Obtener pedidos por ID de cliente
const getPedidosByClienteId = async (req, res) => {
  try {
    const { clienteId } = req.params;

    // Verificar que el cliente existe
    const cliente = await prisma.cliente.findUnique({
      where: { id_cliente: parseInt(clienteId) }
    });

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Obtener pedidos del cliente
    const pedidos = await prisma.pedido.findMany({
      where: { id_cliente: parseInt(clienteId) },
      include: {
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
      }
    });

    res.json({
      cliente: {
        id_cliente: cliente.id_cliente,
        nombre: cliente.nombre,
        correo: cliente.correo
      },
      total_pedidos: pedidos.length,
      pedidos: pedidos.map(pedido => ({
        id_pedido: pedido.id_pedido,
        fecha_pedido: pedido.fecha_pedido,
        total: pedido.total,
        estado: pedido.estadoPedido.nombre,
        direccion_envio: pedido.direccion_envio,
        telefono_contacto: pedido.telefono_contacto,
        cantidad_productos: pedido.detalles.reduce((sum, d) => sum + d.cantidad, 0),
        productos: pedido.detalles.map(d => ({
          nombre: d.producto.nombre,
          cantidad: d.cantidad,
          precio_unitario: d.precio_unitario,
          subtotal: d.cantidad * parseFloat(d.precio_unitario)
        }))
      }))
    });

  } catch (error) {
    console.error('Error al obtener pedidos por ID:', error);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
};

const checkout = async (req, res) => {
  try {
    const {
      cliente,
      items,
      direccion_envio,
      telefono_contacto
    } = req.body;

    // 1. Crear cliente en security-service
    let clienteDb;

    // Intentar buscar cliente existente
    const clienteExistenteResponse = await fetch(
      `${process.env.SECURITY_SERVICE_URL}/clientes/correo/${encodeURIComponent(cliente.correo)}`
    );

    if (clienteExistenteResponse.ok) {

      // Cliente ya existe
      clienteDb = await clienteExistenteResponse.json();

    } else {

      // Crear cliente nuevo
      const crearClienteResponse = await fetch(
        `${process.env.SECURITY_SERVICE_URL}/clientes/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            nombre: cliente.nombre,
            correo: cliente.correo,
            telefono: cliente.telefono
          })
        }
      );

      if (!crearClienteResponse.ok) {
        const errorText = await crearClienteResponse.text();
        throw new Error(errorText);
      }

      clienteDb = await crearClienteResponse.json();
    }

    // 2. Crear carrito
    const carrito = await prisma.carrito.create({
      data: {
        id_cliente: clienteDb.id_cliente,
        estado: 'activo'
      }
    });

    // 3. Agregar productos al carrito
    for (const item of items) {
      await prisma.itemCarrito.create({
        data: {
          id_carrito: carrito.id_carrito,
          id_producto: item.id_producto,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario || 0
        }
      });
    }

    // 4. Reutilizamos tu función existente
    req.body = {
      id_carrito: carrito.id_carrito,
      direccion_envio,
      telefono_contacto,
      cliente_nombre: cliente.nombre,
      cliente_correo: cliente.correo,
      cliente_telefono: cliente.telefono
    };

    return crearPedidoDesdeCarrito(req, res);

  } catch (error) {
    console.error('Error en checkout:', error);
    res.status(500).json({ error: 'Error en checkout', details: error.message });
  }
};

module.exports = {
  crearPedidoDesdeCarrito,
  obtenerPedido,
  getPedidosByClienteCorreo,
  getPedidosByClienteId,
  checkout
};