# ADR-004 — Estrategia Branch-Per-Environment para Gestión de Ambientes con Docker Compose

- **Categoría:** Structural
- **Estado:** Accepted
- **Fecha:** 2025-05-16
- **Autores:** Equipo técnico Accesorios DM

---

## Contexto

El proyecto requiere tres ambientes diferenciados con configuración de infraestructura distinta:

| Branch | Ambiente | Puerto app | Puerto BD (host) | Red Docker |
|---|---|---|---|---|
| `develop` | Desarrollo | 9002 | 5434 | `accesorios-dm-database_accesorios-network-dev` |
| `qa` | Control de calidad | 9001 | 5433 | `accesorios-dm-database_accesorios-network-qa` |
| `main` | Producción | 9000 | 5432 | `accesorios-dm-database_accesorios-network-prod` |

Cada ambiente se conecta a una red Docker externa creada por el repositorio `accesorios-dm-database`, que debe estar levantado previamente. La solución adoptada usa las **ramas de Git como mecanismo de configuración de ambiente**: la configuración de cada ambiente está embebida directamente en el `docker-compose.yml` de su rama correspondiente.

```yaml
# docker-compose.yml (rama develop)
services:
  payment-service:
    container_name: accesorios-dm-payment-dev
    ports:
      - "9002:9002"
    environment:
      - PORT=9002
      - DATABASE_URL=postgresql://admin:admin123@accesorios-dm-postgres-dev:5432/accesorios_dm_db
    networks:
      - accesorios-dm-net
networks:
  accesorios-dm-net:
    external: true
    name: accesorios-dm-database_accesorios-network-dev
```

El operador selecciona el ambiente ejecutando `git checkout <branch>` seguido de `docker-compose up -d`.

---

## Decisión

La configuración de infraestructura de cada ambiente — puerto, `DATABASE_URL`, nombre de contenedor y red Docker — está versionada dentro del `docker-compose.yml` de la rama correspondiente. No existe un sistema centralizado de configuración, vault de secretos ni variables de entorno externalizadas. Los secretos de base de datos se almacenan en texto plano en el repositorio.

Adicionalmente, el `Dockerfile` usa `npm run dev` (nodemon) como comando de inicio, lo que implica que todos los ambientes — incluyendo producción (`main`) — ejecutan el servidor con recarga automática de archivos.

---

## Consecuencias

### Ventajas

- Flujo operacional extremadamente simple y autodocumentado: `git checkout develop && docker-compose up -d`.
- Sin dependencias externas de infraestructura: no requiere Kubernetes, Consul, Vault ni CI/CD para levantar el servicio.
- Configuración self-contained en el repositorio: cualquier desarrollador puede reproducir cualquier ambiente con dos comandos.
- Alineado con el flujo de Git ya conocido por el equipo, sin curva de aprendizaje adicional.
- Trazabilidad de configuración: los cambios de infraestructura quedan registrados en el historial de Git.

### Desventajas

- **Secretos en el repositorio en texto plano:** la contraseña `admin123` está expuesta en el `docker-compose.yml` y queda en el historial de Git permanentemente.
- **Acoplamiento entre versionamiento de código y configuración:** un bugfix aplicado en `develop` debe ser cherry-picked o mergeado manualmente a `qa` y `main`, aumentando el riesgo de divergencia entre ramas.
- **Sin ambientes efímeros:** no es posible levantar automáticamente un ambiente por feature branch para testing aislado.
- **Los cambios de configuración contaminan el historial de código:** un cambio de puerto o credencial aparece como un commit de código normal.
- No escala a equipos grandes ni a topologías con múltiples réplicas, load balancers o canary deployments.
- El uso de `nodemon` en el `Dockerfile` como CMD de producción añade overhead innecesario y puede enmascarar crashes rápidos con reinicios automáticos.

---

## Alternativas Consideradas

| Alternativa | Descripción | Trade-off |
|---|---|---|
| **`.env` por ambiente + `--env-file`** | `docker-compose.yml` base neutral; secretos en `.env.develop`, `.env.qa`, `.env.prod` (gitignored) | Elimina secretos del repo; mínimo cambio estructural |
| **`docker-compose.override.yml`** | Archivo base + overrides por ambiente sin duplicar el compose completo | Mayor modularidad; requiere disciplina en la gestión de overrides |
| **Variables inyectadas por CI/CD** | El pipeline (GitHub Actions, GitLab CI) inyecta `DATABASE_URL` y `PORT` desde secrets | Elimina completamente la configuración del repo; requiere configurar el pipeline |
| **Kubernetes + ConfigMaps + Secrets** | Gestión declarativa de configuración con separación de secretos | Máxima flexibilidad y seguridad; alta complejidad operacional |

---

## Corrección Recomendada de Mayor Impacto

Migrar credenciales fuera del repositorio con el menor cambio posible:

```bash
# .env.develop (gitignored)
PORT=9002
DATABASE_URL=postgresql://admin:<password>@accesorios-dm-postgres-dev:5432/accesorios_dm_db
```

```yaml
# docker-compose.yml — sin credenciales hardcodeadas
services:
  payment-service:
    env_file:
      - .env.develop
```

```bash
# Ejecución
docker-compose --env-file .env.develop up -d
```

---

## Relación con la Arquitectura Actual

Esta estrategia crea una dependencia implícita entre el repositorio `accesorios-dm-payment-service` y el repositorio `accesorios-dm-database`: la red Docker externa debe existir antes de levantar este servicio. Esta dependencia no está documentada de forma explícita en el código más allá del `README.md`, lo que puede causar confusión en nuevos integrantes del equipo. El riesgo de seguridad más inmediato es la contraseña en texto plano, que debe ser rotada y removida del historial de Git.

---

## Justificación de Categoría Structural

Esta decisión es **Structural** porque define cómo está organizada la topología de despliegue del sistema a través de sus ambientes. Establece la relación entre la estructura del repositorio (ramas de Git) y la infraestructura de ejecución (puertos, redes Docker, contenedores), determinando cómo se estructura el ciclo de vida del servicio desde el desarrollo hasta la producción.
