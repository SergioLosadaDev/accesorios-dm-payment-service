# ADR-001 — Delegación del Flujo de Pago a WhatsApp sin Gateway de Pagos

- **Categoría:** Behavioral
- **Estado:** Accepted
- **Fecha:** 2025-05-16
- **Autores:** Equipo técnico Accesorios DM

---

## Contexto

El servicio es el núcleo transaccional de una tienda de accesorios con escala pequeña-mediana. Integrar un gateway de pagos (Mercado Pago, PayU, Stripe) implica:

- Proceso de homologación y certificación PCI-DSS.
- Tiempo de desarrollo e integración no trivial.
- Costos de transacción por operación.
- Complejidad en el manejo de webhooks, estados asincrónicos y reversiones de pago.

El negocio opera con un modelo de atención personalizada por WhatsApp donde se confirman manualmente los pagos, lo cual ya es el flujo real de negocio previo a la digitalización.

---

## Decisión

Al completar la creación de un pedido (`POST /api/v1/pedidos/crear`), el servicio genera y retorna un **WhatsApp deep link** preformateado con el número de pedido y el total:

```javascript
// pedidoController.js
whatsapp_link: `https://wa.me/573166751065?text=Hola,%20quiero%20realizar%20el%20pago%20del%20pedido%20%23${pedido.id_pedido}%20por%20un%20total%20de%20$${total}`
```

El número de WhatsApp está hardcodeado en el controlador. No existe ningún módulo de pagos, webhook receiver, ni transición automática al estado `PAGADO`. La confirmación del pago es 100% manual: un administrador debe actualizar el estado del pedido vía `PUT /api/v1/admin/pedidos/:id/estado`.

---

## Consecuencias

### Ventajas

- Zero time-to-market para el flujo de pago: sin certificaciones ni integraciones externas.
- Sin costos de transacción ni comisiones de gateway.
- Se adapta al flujo de negocio real ya operativo en el negocio.
- Sin dependencias externas críticas en el critical path de creación del pedido.
- Sin complejidad de manejo de estados de pago asincrónicos ni webhooks.

### Desventajas

- El número de WhatsApp está hardcodeado — un cambio requiere redeploy del servicio.
- No hay confirmación automática de pago; la reconciliación es completamente manual.
- No escala si el volumen de pedidos crece significativamente.
- No genera evidencia digital del pago dentro del sistema.
- Imposible implementar reembolsos automáticos, chargebacks o auditorías programáticas.
- El estado `PAGADO` debe ser seteado manualmente por un administrador.

---

## Alternativas Consideradas

| Alternativa | Descripción | Motivo de descarte |
|---|---|---|
| **Mercado Pago / PayU** | Gateway latinoamericano con alta adopción | Requiere homologación, agrega latencia asincrónica y costos por transacción |
| **Pago contra entrega** | Sin confirmación previa | Expone al negocio a altas tasas de devolución |
| **WhatsApp Business API** | Integración oficial programática | Requiere cuenta verificada, aprobación de Meta y desarrollo adicional significativo |
| **Transferencia bancaria manual** | El cliente envía comprobante | Sin diferencia real frente al modelo actual, mayor fricción para el usuario |

---

## Relación con la Arquitectura Actual

Esta decisión ancla al servicio a un modelo de negocio manual. El estado `PENDIENTE` es el estado terminal automático; todos los estados posteriores (`PAGADO`, `EN_PREPARACION`, `ENVIADO`, `ENTREGADO`) requieren intervención manual de un administrador a través del panel admin.

Para migrar a un gateway real, se deberá:

1. Extraer la lógica de pago a una estrategia (`PaymentStrategy`) intercambiable.
2. Añadir un endpoint de webhook para recibir notificaciones del gateway.
3. Implementar una máquina de estados para la transición automática `PENDIENTE → PAGADO`.
4. Mover el número de WhatsApp a una variable de entorno como paso intermedio.

---

## Justificación de Categoría Behavioral

Esta decisión es **Behavioral** porque define el comportamiento observable del sistema al finalizar una compra. En tiempo de ejecución, el sistema no procesa el pago: genera un enlace y delega la acción al usuario y al operador humano. Esto determina el flujo de ejecución, los estados alcanzables del pedido de forma automática y la interacción del sistema con actores externos.
