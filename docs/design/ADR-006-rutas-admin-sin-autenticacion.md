# ADR-006 — Rutas Administrativas sin Autenticación en el Microservicio

- **Categoría:** Design
- **Estado:** Accepted *(con deuda de seguridad documentada)*
- **Fecha:** 2025-05-16
- **Autores:** Equipo técnico Accesorios DM

---

## Contexto

El servicio expone 8 endpoints de administración bajo el prefijo `/api/v1/admin/*` que incluyen operaciones de alta criticidad:

| Método | Endpoint | Sensibilidad |
|---|---|---|
| `GET` | `/admin/pedidos` | Lista todos los pedidos con datos personales de clientes |
| `GET` | `/admin/pedidos/:id` | Detalle completo de pedido con historial |
| `PUT` | `/admin/pedidos/:id/estado` | Modifica el estado de cualquier pedido |
| `GET` | `/admin/stats` | Expone métricas del negocio |
| `GET` | `/admin/ventas/periodo` | Expone volumen de ventas por período |
| `GET` | `/admin/productos/top` | Expone productos e ingresos |
| `GET` | `/admin/clientes/top` | Expone datos de los clientes más frecuentes |

Ninguno de estos endpoints tiene middleware de autenticación o autorización:

```javascript
// adminRoutes.js — sin ningún middleware de auth en la cadena
const router = express.Router();

router.get('/pedidos', adminController.getAllPedidos);
router.put('/pedidos/:id/estado', adminController.updatePedidoEstado);
router.get('/stats', adminController.getStats);
// ...
```

El comentario en `carritoRoutes.js` confirma que la omisión es intencional y reconocida:

```javascript
// Rutas públicas (sin autenticación por ahora)
```

Adicionalmente, el modelo `Empleado` con campo `password` existe en el schema `security` de Prisma, lo que indica que la autenticación fue diseñada a nivel de base de datos pero nunca implementada en este servicio.

---

## Decisión

Se decidió **no implementar autenticación ni autorización a nivel del microservicio** para los endpoints administrativos. El modelo de seguridad implícito adoptado es **perimeter security**: la protección se delega a la capa de red, asumiendo que los endpoints de administración solo son accesibles a través de la red Docker interna (`accesorios-dm-net`) y no están expuestos públicamente.

```yaml
# docker-compose.yml — el servicio pertenece a una red Docker privada
networks:
  accesorios-dm-net:
    external: true
    name: accesorios-dm-database_accesorios-network-dev
```

La hipótesis de seguridad es que ningún actor externo puede alcanzar el puerto `9002` directamente sin estar dentro de la red Docker del proyecto.

---

## Consecuencias

### Ventajas

- Sin latencia adicional por verificación de tokens en cada request.
- Sin complejidad de gestión de sesiones, tokens JWT o refresh tokens en este microservicio.
- Desarrollo más rápido en etapas iniciales del proyecto.
- Coherente como solución temporal si existe (o se planifica) un API Gateway que centralice la autenticación.

### Desventajas

- **Exposición total ante configuración incorrecta:** si el puerto del servicio es mapeado al host por error (o intencionalmente en desarrollo), todos los endpoints admin son públicamente accesibles sin ninguna protección.
- **Sin autorización a nivel de recurso:** no es posible distinguir qué empleado realizó qué operación. No hay `req.user` ni identidad del operador.
- **Sin auditoría de operaciones administrativas:** el `HistorialEstadoPedido` registra el cambio de estado pero no quién lo realizó ni desde qué IP.
- **Confianza total en el perímetro de red** es un antipatrón conocido (*castle and moat*): una sola brecha en el perímetro expone todos los recursos sin ninguna capa adicional de defensa.
- El modelo `Empleado` en `security.empleado` con campo `password` sugiere que la autenticación fue intencionada pero nunca conectada a este servicio.
- **Incumplimiento de Zero Trust:** cualquier contenedor dentro de la misma red Docker puede invocar operaciones administrativas sin restricción.
- Potencial incumplimiento de regulaciones de privacidad (datos personales de clientes expuestos sin control de acceso).

---

## Alternativas Consideradas

| Alternativa | Descripción | Trade-off |
|---|---|---|
| **API Key estática** | Header `X-Admin-Key` validado contra variable de entorno | Implementación mínima (< 10 líneas); sin gestión de sesiones; adecuado para comunicación servicio-a-servicio |
| **JWT middleware (Bearer token)** | `express-jwt` + validación de firma con secret | Sin estado, escalable, implementable en horas; requiere emisor de tokens |
| **OAuth2 / OIDC con Keycloak** | Solución enterprise con roles, scopes y SSO | Máxima granularidad y control; alta complejidad operacional |
| **mTLS** | Autenticación mutua por certificados a nivel de transporte | Máxima seguridad en comunicación inter-servicio; complejidad de gestión de certificados |
| **API Gateway centralizado** | Gateway upstream autentica y rutea; microservicio confía en red interna | Válido si el gateway existe; actualmente no está documentado como presente en la arquitectura |

---

## Corrección Recomendada de Menor Fricción

Implementar autenticación por API Key como primera línea de defensa en `adminRoutes.js`:

```javascript
// src/middleware/adminAuth.js
const adminAuth = (req, res, next) => {
  const apiKey = req.headers['x-admin-key'];
  if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

module.exports = adminAuth;
```

```javascript
// adminRoutes.js
const adminAuth = require('../middleware/adminAuth');
router.use(adminAuth); // aplicado a todas las rutas de administración

router.get('/pedidos', adminController.getAllPedidos);
// ...
```

```bash
# .env
ADMIN_API_KEY=<secret-generado-con-openssl-rand-hex-32>
```

---

## Relación con la Arquitectura Actual

Esta decisión crea la mayor superficie de riesgo del servicio en términos de seguridad. Su mitigación es independiente de cualquier otra deuda técnica y puede ser implementada sin cambios en la API, el schema o la lógica de negocio. La existencia del modelo `Empleado` en Prisma sugiere que la visión a mediano plazo es implementar autenticación basada en sesiones de empleados con roles definidos, lo que haría posible registrar en el historial de pedidos el identificador del empleado que realizó cada cambio de estado.

---

## Justificación de Categoría Design

Esta decisión es **Design** porque define un patrón deliberado (aunque incompleto) de seguridad en el diseño interno del servicio: la decisión de dónde se aplica la autenticación — en el microservicio, en el gateway, en la red — es una decisión de diseño de arquitectura de seguridad. Afecta la estructura de middlewares Express, la presencia o ausencia de capas de autorización, y el diseño de cómo el servicio distingue actores autorizados de no autorizados.
