const prisma = require('../prisma');

// Crear nuevo carrito
const crearCarrito = async (req, res) => {
  try {
    const { id_cliente } = req.body;
    
    const carrito = await prisma.carrito.create({
      data: {
        id_cliente: id_cliente || null,
        estado: 'activo'
      }
    });
    
    res.status(201).json(carrito);
  } catch (error) {
    console.error('Error al crear carrito:', error);
    res.status(500).json({ error: 'Error al crear carrito' });
  }
};

// Obtener carrito con sus items
const obtenerCarrito = async (req, res) => {
  try {
    const { id } = req.params;
    
    const carrito = await prisma.carrito.findUnique({
      where: { id_carrito: parseInt(id) },
      include: {
        items: {
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
        }
      }
    });
    
    if (!carrito) {
      return res.status(404).json({ error: 'Carrito no encontrado' });
    }
    
    // Calcular total
    const total = carrito.items.reduce((sum, item) => {
      return sum + (item.cantidad * parseFloat(item.precio_unitario));
    }, 0);
    
    res.json({
      ...carrito,
      total: total
    });
  } catch (error) {
    console.error('Error al obtener carrito:', error);
    res.status(500).json({ error: 'Error al obtener carrito' });
  }
};

// Agregar item al carrito
const agregarItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { id_producto, cantidad } = req.body;
    
    // Verificar que el producto existe y tiene stock
    const producto = await prisma.producto.findUnique({
      where: { id_producto: parseInt(id_producto) }
    });
    
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    if (producto.stock < cantidad) {
      return res.status(400).json({ error: 'Stock insuficiente' });
    }
    
    // Verificar si el item ya existe en el carrito
    const itemExistente = await prisma.itemCarrito.findFirst({
      where: {
        id_carrito: parseInt(id),
        id_producto: parseInt(id_producto)
      }
    });
    
    let item;
    if (itemExistente) {
      // Actualizar cantidad
      item = await prisma.itemCarrito.update({
        where: { id_item_carrito: itemExistente.id_item_carrito },
        data: { cantidad: itemExistente.cantidad + cantidad }
      });
    } else {
      // Crear nuevo item
      item = await prisma.itemCarrito.create({
        data: {
          id_carrito: parseInt(id),
          id_producto: parseInt(id_producto),
          cantidad: cantidad,
          precio_unitario: producto.precio
        }
      });
    }
    
    res.status(201).json(item);
  } catch (error) {
    console.error('Error al agregar item:', error);
    res.status(500).json({ error: 'Error al agregar item al carrito' });
  }
};

// Actualizar cantidad de un item
const actualizarItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { cantidad } = req.body;
    
    if (cantidad <= 0) {
      return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });
    }
    
    const item = await prisma.itemCarrito.update({
      where: { id_item_carrito: parseInt(itemId) },
      data: { cantidad: cantidad }
    });
    
    res.json(item);
  } catch (error) {
    console.error('Error al actualizar item:', error);
    res.status(500).json({ error: 'Error al actualizar item' });
  }
};

// Eliminar item del carrito
const eliminarItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    
    await prisma.itemCarrito.delete({
      where: { id_item_carrito: parseInt(itemId) }
    });
    
    res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar item:', error);
    res.status(500).json({ error: 'Error al eliminar item' });
  }
};

// Vaciar carrito (eliminar todos los items)
const vaciarCarrito = async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.itemCarrito.deleteMany({
      where: { id_carrito: parseInt(id) }
    });
    
    res.status(204).send();
  } catch (error) {
    console.error('Error al vaciar carrito:', error);
    res.status(500).json({ error: 'Error al vaciar carrito' });
  }
};

module.exports = {
  crearCarrito,
  obtenerCarrito,
  agregarItem,
  actualizarItem,
  eliminarItem,
  vaciarCarrito
};