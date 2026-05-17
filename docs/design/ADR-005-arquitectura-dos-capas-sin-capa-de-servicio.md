# ADR-005 — Arquitectura de Dos Capas sin Capa de Servicio

- **Categoría:** Design
- **Estado:** Accepted
- **Fecha:** 2025-05-16
- **Autores:** Equipo técnico Accesorios DM

---

## Contexto

El servicio tiene tres capas identificables en el código fuente:

```
HTTP Request
     ↓
src/routes/        → Express Router (thin routers: solo mapean verbo+path a función de controlador)
     ↓
src/controllers/   → Validación de entrada + lógica de negocio + acceso a datos
     ↓
src/prisma/        → Instancia singleton de PrismaClient
     ↓
PostgreSQL
```

No existe capa de `services/`, `repositories/`, `domain/` ni `use-cases/`. Toda la lógica de negocio reside en los controladores: validación de stock, cálculo de totales, resolución o creación de clientes, construcción de respuesta HTTP, consultas complejas agregadas y escrituras multi-tabla.

El singleton Prisma en `src/prisma/index.js` es la única abstracción de acceso a datos del sistema:

```javascript
// src/prisma/index.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
module.exports = prisma;
```

Los controladores importan y usan esta instancia directamente, sin ninguna interfaz intermedia.

---

## Decisión

Se adoptó una arquitectura MVC simplificada de dos capas efectivas — **Router → Controller → ORM** — sin una capa de servicio, sin repository pattern y sin ninguna abstracción entre el controlador y el ORM. La lógica de negocio y la lógica de acceso a datos coexisten dentro de las funciones de controlador.

Ejemplo representativo: la función `crearPedidoDesdeCarrito` en `pedidoController.js` tiene aproximadamente 150 líneas que incluyen validación de entrada, orquestación de múltiples entidades, cálculos de negocio, escrituras a la base de datos y construcción de la respuesta HTTP — todo en una única función.

---

## Consecuencias

### Ventajas

- Velocidad de desarrollo inicial alta: sin boilerplate de capas adicionales.
- Menor número de archivos y abstracciones para navegar en una codebase pequeña.
- Trazabilidad directa: una ruta lleva a un controlador que lleva a la base de datos, sin indirecciones.
- Apropiado para MVPs o servicios con lógica de negocio estable y simple.

### Desventajas

- **Imposible testear la lógica de negocio de forma unitaria** sin levantar una base de datos real: no hay interfaz que pueda ser mockeada o reemplazada en tests.
- **Violación del Principio de Responsabilidad Única (SRP):** un controlador como `crearPedidoDesdeCarrito` mezcla responsabilidades de validación, orquestación, persistencia y presentación de respuesta.
- **Alta duplicación:** `getPedidosByClienteId` y `getPedidosByClienteCorreo` son estructuralmente casi idénticas. En una capa de servicio serían una única función parametrizada.
- **Acoplamiento directo a Prisma:** cambiar el ORM requeriría reescribir todos los controladores. No existe ninguna interfaz de repositorio que abstraiga el mecanismo de persistencia.
- **Dificultad para reutilizar lógica de negocio** entre diferentes endpoints o entre una futura cola de tareas asíncronas y el controlador HTTP.
- Los controladores que superan 50 líneas son una señal de que la lógica no pertenece en esa capa.

---

## Alternativas Consideradas

| Alternativa | Descripción | Trade-off |
|---|---|---|
| **Controller → Service → Repository** | Separación completa: controlador parsea HTTP, servicio contiene lógica, repositorio abstrae BD | Máxima separación y testabilidad; mayor boilerplate inicial |
| **Controller → UseCase → Repository** | Estilo Clean Architecture: cada operación de negocio es una clase independiente | Altamente testeable y extensible; curva de aprendizaje considerable |
| **Controller → Service (sin Repository)** | La capa de servicio abstrae la lógica de negocio; Prisma sigue siendo accedido directamente en el servicio | Punto medio razonable: mejora testabilidad sin full DDD |
| **Arquitectura actual (dos capas)** | Controller directo a Prisma | Simplicidad máxima; deuda de testabilidad y mantenibilidad |

---

## Refactor Recomendado

La mejora de menor fricción es extraer una capa `src/services/` con funciones puras de negocio. Los controladores se reducen a tres responsabilidades exclusivas: parsear el request, llamar al servicio y devolver la respuesta.

```
src/
  routes/
    pedidoRoutes.js
  controllers/
    pedidoController.js   ← solo parseo HTTP y delegación
  services/
    pedidoService.js      ← lógica de negocio, recibe prisma como dependencia
  prisma/
    index.js
```

```javascript
// pedidoService.js — lógica de negocio testeable de forma unitaria
const crearPedido = async (prisma, { id_carrito, direccion_envio, ...datos }) => {
  // toda la lógica aquí, sin Express, sin req/res
};

// pedidoController.js — solo orquesta HTTP
const crearPedidoHandler = async (req, res) => {
  try {
    const resultado = await pedidoService.crearPedido(prisma, req.body);
    res.status(201).json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

---

## Relación con la Arquitectura Actual

Esta decisión tiene el mayor impacto sobre la mantenibilidad a largo plazo del servicio. A medida que el negocio crezca y la lógica de pedidos se complejice (descuentos, cupones, múltiples métodos de pago, notificaciones), los controladores actuales se volverán imposibles de mantener y depurar sin una separación clara de responsabilidades.

---

## Justificación de Categoría Design

Esta decisión es **Design** porque define el diseño interno del servicio: cómo están organizadas las responsabilidades entre los componentes, qué patrones de diseño se aplican (o se omiten) y cómo fluye la lógica de negocio a través de las capas. No afecta la estructura de carpetas del repositorio de forma visible desde fuera, sino la arquitectura interna de cómo está diseñado el código.
