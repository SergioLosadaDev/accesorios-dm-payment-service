# Payment Service - Accesorios DM

Microservicio de gestión de carritos, pedidos y pagos para la plataforma de comercio electrónico Accesorios DM.

## Requisitos Previos

- Docker Desktop
- Docker Compose
- Node.js 18+ (para ejecución local)
- Base de datos PostgreSQL (accesorios-dm-database)

## Estructura del Proyecto
```
accesorios-dm-payment-service/
├── src/
│ ├── controllers/
│ │ ├── carritoController.js
│ │ ├── pedidoController.js
│ │ └── adminController.js
│ ├── routes/
│ │ ├── carritoRoutes.js
│ │ ├── pedidoRoutes.js
│ │ └── adminRoutes.js
│ ├── prisma/
│ │ └── index.js
│ └── index.js
├── prisma/
│ └── schema.prisma
├── Dockerfile
├── docker-compose.yml
├── package.json
├── .env.example
└── README.md
```


## Ambientes y Puertos

| Ambiente | Puerto | BD (localhost) | BD (red Docker) |
|----------|--------|----------------|-----------------|
| develop | 9002 | 5434 | 5432 |
| qa | 9001 | 5433 | 5432 |
| main | 9000 | 5432 | 5432 |

## Dependencia: Base de Datos

Este microservicio requiere la base de datos `accesorios-dm-database`.

### Clonar la base de datos

```bash
git clone https://github.com/SergioLosadaDev/accesorios-dm-database.git
```

## Levantar la base de datos según ambiente

### Develop:
```bash
git checkout develop
docker-compose -f docker-compose.yml up -d
```

### QA:
```bash
git checkout qa
docker-compose -f docker-compose.yml up -d
```

## Configuración del Microservicio

### Variables de entorno

|Variable	|Valor	|Descripción|
|-----------|-------|-----------|
|DATABASE_URL	|postgresql://admin:admin123@host:port/db	|Conexión a BD|
|PORT	|9002/9001/9000	|Puerto del servicio|

## Archivo .env (crear desde .env.example)

```bash
cp .env.example .env
# Editar según el ambiente
```

## Cómo Levantar el Microservicio

### Opción 1: Con Docker (Recomendado)
```bash
# Desarrolllo
git checkout develop
docker-compose up -d

# QA
git checkout qa
docker-compose up -d

# Producción
git checkout main
docker-compose up -d
```

### Opción 2: Ejecución local
```bash
npm install
npm run dev
```

## Endpoints Disponibles

### Carrito (Público)

|Método	|Endpoint	|Descripción|
|-------|-----------|-----------|
|POST	|/api/v1/carrito	|Crear carrito|
|GET	|/api/v1/carrito/:id	|Obtener carrito con items|
|POST	|/api/v1/carrito/:id/items	|Agregar item al carrito|
|PUT	|/api/v1/carrito/items/:itemId	|Actualizar cantidad|
|DELETE	|/api/v1/carrito/items/:itemId	|Eliminar item|
|DELETE	|/api/v1/carrito/:id	|Vaciar carrito|

### Pedido (Público)

|Método	|Endpoint	|Descripción|
|-------|-----------|-----------|
|POST	|/api/v1/pedidos/crear	|Crear pedido desde carrito|
|GET	|/api/v1/pedidos/:id	|Obtener pedido por ID|
|GET	|/api/v1/pedidos/cliente/correo/:correo	|Historial por email|
|GET	|/api/v1/pedidos/cliente/id/:clienteId	|Historial por ID|

### Administración

|Método	|Endpoint	|Descripción|
|-------|-----------|-----------|
|GET	|/api/v1/admin/pedidos	|Listar todos los pedidos|
|GET	|/api/v1/admin/pedidos/:id	|Detalle de pedido|
|PUT	|/api/v1/admin/pedidos/:id/estado	|Cambiar estado|
|GET	|/api/v1/admin/estados	|Listar estados|
|GET	|/api/v1/admin/stats	|Estadísticas generales|
|GET	|/api/v1/admin/ventas/periodo	|Ventas por período|
|GET	|/api/v1/admin/productos/top	|Productos más vendidos|
|GET	|/api/v1/admin/clientes/top	|Clientes más frecuentes|

### Health Check

|Método	|Endpoint	|Descripción|
|GET	|/api/v1/health	|Health check|

## Ejemplos de uso

### 1. Crear carrito
```bash
curl -X POST http://localhost:9002/api/v1/carrito \
  -H "Content-Type: application/json" \
  -d '{"id_cliente": 1}'
```

### 2. Agregar item al carrito
```bash
curl -X POST http://localhost:9002/api/v1/carrito/1/items \
  -H "Content-Type: application/json" \
  -d '{"id_producto": 1, "cantidad": 2}'
```

### 3. Crear pedido
```bash
curl -X POST http://localhost:9002/api/v1/pedidos/crear \
  -H "Content-Type: application/json" \
  -d '{
    "id_carrito": 1,
    "direccion_envio": "Calle 123, Ciudad",
    "telefono_contacto": "3001234567",
    "cliente_nombre": "Juan Perez",
    "cliente_correo": "juan@test.com",
    "cliente_telefono": "3001234567"
  }'
```

### 4. Ver historial de pedidos
```bash
curl http://localhost:9002/api/v1/pedidos/cliente/correo/juan@test.com
```

### 5. Admin: ver estadísticas
```bash
curl http://localhost:9002/api/v1/admin/stats
```

## Comandos Útiles
```bash
# Ver logs del contenedor
docker-compose logs -f

# Reconstruir imagen
docker-compose build --no-cache

# Detener y eliminar contenedor
docker-compose down

# Regenerar cliente Prisma
npx prisma generate

# Conectar a la base de datos (desde el host)
docker exec -it accesorios-dm-postgres-dev psql -U admin -d accesorios_dm_db
```

## Tecnologías Utilizadas

|Tecnología	|Versión	|Propósito|
|-----------|-----------|---------|
|Node.js	|18	|Runtime|
|Express	|4.18.2	|Framework web|
|Prisma	|5.22.0	|ORM|
|PostgreSQL	|16	|Base de datos|
|Docker	|-	|Contenerización|

## Licencia

Proyecto interno de Accesorios DM.







