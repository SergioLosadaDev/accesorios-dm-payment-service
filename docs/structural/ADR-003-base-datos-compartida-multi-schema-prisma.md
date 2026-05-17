# ADR-003 — Base de Datos PostgreSQL Compartida Multi-Schema Accedida vía Prisma multiSchema

- **Categoría:** Structural
- **Estado:** Accepted
- **Fecha:** 2025-05-16
- **Autores:** Equipo técnico Accesorios DM

---

## Contexto

La plataforma Accesorios DM está organizada como microservicios, pero todos comparten una única instancia de PostgreSQL que contiene 7 schemas correspondientes a diferentes dominios de negocio:

| Schema | Dominio | Modelos |
|---|---|---|
| `security` | Autenticación | `Rol`, `Empleado` |
| `clientes` | Clientes | `Cliente` |
| `catalogo` | Catálogo de productos | `Producto` |
| `ventas` | Transacciones | `Carrito`, `ItemCarrito`, `Pedido`, `DetallePedido` |
| `logistica` | Estados y trazabilidad | `EstadoPedido`, `HistorialEstadoPedido` |
| `inventario` | Movimientos de stock | No modelado en Prisma — accedido vía `$executeRaw` |
| `public` | Default PostgreSQL | — |

El `payment-service` accede directamente a 5 de estos 7 schemas desde un único `PrismaClient`. La configuración usa la **preview feature `multiSchema`** de Prisma 5:

```prisma
// prisma/schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["security", "clientes", "catalogo", "ventas", "logistica", "inventario", "public"]
}
```

El schema `inventario` es un caso particular: no está modelado en Prisma pero se accede mediante SQL crudo en `pedidoController.js`, lo que indica que las tablas de ese schema son propiedad conceptual de otro servicio.

---

## Decisión

Se adoptó una base de datos compartida con separación lógica por schemas de PostgreSQL. Cada dominio tiene su propio namespace pero todos residen en el mismo servidor, la misma instancia y bajo el mismo rol de base de datos (`admin`). El `payment-service` tiene permisos de lectura y escritura sobre múltiples schemas que conceptualmente pertenecen a otros dominios de negocio.

Esta decisión evita la necesidad de comunicación HTTP inter-servicio para acceder a datos de productos, clientes o estados de logística, realizando joins directos en SQL a través de Prisma.

---

## Consecuencias

### Ventajas

- Sin overhead de comunicación inter-servicio: los datos de `catalogo`, `clientes` y `logistica` se obtienen con un solo query JOIN optimizado por el motor de base de datos.
- Menor complejidad operacional: un solo servidor, un solo proceso de backup, un solo punto de configuración de conexión.
- Transacciones cross-schema son posibles dentro del mismo servicio sin coordinación distribuida.
- Modelo de datos unificado: no hay que sincronizar estados entre servicios mediante eventos o APIs.
- Menor latencia en operaciones que requieren datos de múltiples dominios.

### Desventajas

- **Acoplamiento estructural fuerte:** el `payment-service` conoce y depende del modelo de datos de `catalogo`, `clientes` y `logistica`. Un cambio de schema en cualquiera de esos dominios puede romper este servicio.
- **Violación del principio de bounded context:** cada microservicio debería ser dueño exclusivo y único de sus datos; ningún otro servicio debería acceder directamente a su schema.
- **Escalabilidad limitada:** no es posible migrar, shardear o escalar un schema de forma independiente del resto.
- **Riesgo de seguridad ampliado:** una credencial comprometida del `payment-service` expone datos de todos los schemas, incluyendo `security` (contraseñas de empleados).
- La feature `multiSchema` de Prisma es **preview** (no estable), lo que implica riesgo de cambios breaking en futuras versiones.
- El acceso a `inventario` vía `$executeRaw` evidencia que el límite de ownership ya está siendo transgredido de forma no tipada.

---

## Alternativas Consideradas

| Alternativa | Descripción | Trade-off |
|---|---|---|
| **Database-per-service** | Cada microservicio tiene su propia instancia de BD | Máximo desacoplamiento y autonomía; mayor complejidad operacional y de sincronización |
| **API calls inter-servicio** | El `payment-service` consulta productos y clientes via HTTP REST | Desacoplamiento real; añade latencia de red y dependencias de disponibilidad entre servicios |
| **Event-driven con event store** | Los servicios publican eventos; el `payment-service` mantiene una proyección local | Máxima resiliencia y desacoplamiento; alta complejidad de implementación |
| **Schema-per-service (estado actual)** | Schemas separados en una BD compartida | Mitad del camino: hay separación lógica pero no física ni de seguridad |

---

## Relación con la Arquitectura Actual

Esta decisión es la que más limita la evolución hacia una arquitectura de microservicios autónoma. El path de migración progresivo es:

1. **Corto plazo:** definir interfaces de API claras en los servicios dueños de cada dominio (`catalogo-service`, `clientes-service`).
2. **Mediano plazo:** reemplazar los `include` de Prisma cross-schema por llamadas HTTP con circuit breaker.
3. **Largo plazo:** eliminar los modelos `Producto`, `Cliente`, `Empleado` y `Rol` del schema de Prisma de este servicio. El `payment-service` únicamente debería ser dueño de los schemas `ventas` y `logistica`.

---

## Justificación de Categoría Structural

Esta decisión es **Structural** porque define cómo está organizada y distribuida la infraestructura de datos del sistema. Determina los límites físicos y lógicos entre componentes, establece qué servicio puede acceder a qué datos y define el grado de acoplamiento estructural entre los microservicios a nivel de almacenamiento persistente.
