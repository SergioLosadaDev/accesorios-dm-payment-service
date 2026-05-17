# ADR-002 — Creación de Pedido con Operaciones Secuenciales sin Transacción Atómica

- **Categoría:** Behavioral
- **Estado:** Accepted *(con riesgo documentado)*
- **Fecha:** 2025-05-16
- **Autores:** Equipo técnico Accesorios DM

---

## Contexto

La función `crearPedidoDesdeCarrito` es la operación más crítica del servicio. Ejecuta **10 operaciones de base de datos secuenciales** para materializar un pedido:

```
1.  findUnique(carrito + items + productos)
2.  Validación de stock en memoria
3.  findUnique(cliente) / create(cliente)
4.  create(pedido)
5.  create(detallePedido)  ← por cada item del carrito
6.  update(producto.stock) ← por cada item del carrito
7.  create(historialEstadoPedido)
8.  update(carrito.estado = 'procesado')
9.  $executeRaw INSERT inventario.inventario_movimiento ← por cada item, SQL crudo
```

Prisma 5 ofrece transacciones interactivas nativas mediante `prisma.$transaction(async (tx) => { ... })`. Sin embargo, ninguna de estas operaciones está envuelta en un bloque transaccional.

---

## Decisión

Se optó por ejecutar cada operación de forma independiente y secuencial, sin un bloque transaccional. La lógica es procedural: si un paso falla, los pasos anteriores ya están persistidos en la base de datos sin posibilidad de rollback automático.

```javascript
// pedidoController.js — patrón de escrituras sin transacción
const pedido = await prisma.pedido.create({ data: { ... } }); // persiste inmediatamente

for (const item of carrito.items) {
  await prisma.detallePedido.create({ ... });   // puede fallar aquí
  await prisma.producto.update({ ... });        // dejando el pedido sin detalles completos
}

// Si falla aquí: pedido creado, stock parcialmente decrementado
await prisma.historialEstadoPedido.create({ ... });
await prisma.carrito.update({ ... });

// Fuera de cualquier mecanismo de rollback posible:
await prisma.$executeRaw`INSERT INTO inventario.inventario_movimiento ...`;
```

---

## Consecuencias

### Ventajas

- Código más simple y lineal, fácil de leer y seguir en debugging.
- Bajo overhead en el caso exitoso: sin bloqueos de transacción prolongados.
- Compatible con la escala actual del negocio donde fallos concurrentes son poco frecuentes.
- Sin necesidad de configuración adicional de Prisma o de la base de datos.

### Desventajas

- **Riesgo crítico de inconsistencia de datos:** si la operación falla en el paso 5 o 6, el pedido existe en base de datos pero el stock no fue decrementado correctamente y el movimiento de inventario no fue registrado.
- **Condición de carrera (race condition):** dos requests concurrentes para el mismo carrito pueden pasar la validación de stock simultáneamente antes de que alguna actualice el stock, resultando en overselling.
- **Carrito en estado inconsistente:** puede quedar marcado como `procesado` sin un pedido completamente formado, o viceversa.
- **Sin rollback automático:** requiere intervención manual en la base de datos ante cualquier fallo parcial.
- El `$executeRaw` de inventario opera completamente fuera de cualquier mecanismo de compensación.
- Dificulta la auditoría y el diagnóstico post-mortem de pedidos corruptos.

---

## Alternativas Consideradas

| Alternativa | Descripción | Trade-off |
|---|---|---|
| **`prisma.$transaction([...ops])`** | Transacción batch secuencial | No permite lógica condicional entre pasos; limitado para este caso de uso |
| **`prisma.$transaction(async (tx) => {...})`** | Transacción interactiva con rollback automático | Opción óptima: permite lógica condicional, garantiza atomicidad, mínimo cambio de código |
| **Saga Pattern** | Compensaciones explícitas por cada paso fallido | Apropiado para arquitecturas distribuidas cross-servicio; sobredimensionado para este caso |
| **Outbox Pattern** | Persistencia de eventos con procesamiento asíncrono | Alta complejidad; apropiado cuando se integra con mensajería como Kafka o RabbitMQ |

---

## Corrección Recomendada

La corrección de menor esfuerzo es envolver toda la operación en una transacción interactiva de Prisma:

```javascript
const resultado = await prisma.$transaction(async (tx) => {
  const carrito = await tx.carrito.findUnique({ ... });
  // validaciones...
  const cliente = await tx.cliente.upsert({ ... });
  const pedido  = await tx.pedido.create({ ... });

  for (const item of carrito.items) {
    await tx.detallePedido.create({ ... });
    await tx.producto.update({ ... });
  }

  await tx.historialEstadoPedido.create({ ... });
  await tx.carrito.update({ ... });
  await tx.$executeRaw`INSERT INTO inventario.inventario_movimiento ...`;

  return { pedido, cliente };
});
```

Si cualquier operación lanza una excepción, Prisma ejecuta automáticamente un `ROLLBACK` completo.

---

## Relación con la Arquitectura Actual

Esta es la deuda técnica de mayor impacto en la confiabilidad del sistema. En el estado actual, cualquier error de red, timeout de base de datos o excepción inesperada durante la creación de un pedido puede dejar el sistema en un estado parcialmente consistente que requiere corrección manual. La corrección es no-disruptiva y puede aplicarse sin cambios en la API ni en el schema.

---

## Justificación de Categoría Behavioral

Esta decisión es **Behavioral** porque define el comportamiento del sistema ante condiciones de fallo en tiempo de ejecución. No se trata de cómo está organizado el código, sino de qué hace el sistema cuando una operación compuesta falla a mitad de camino: ¿mantiene consistencia o deja el estado de la base de datos parcialmente modificado? Esa es una decisión de comportamiento con consecuencias directas en la integridad de los datos en producción.
