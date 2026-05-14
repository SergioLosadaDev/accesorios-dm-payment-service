FROM node:18-bookworm-slim

WORKDIR /app

# Instalar dependencias de sistema necesarias para Prisma
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY . .

# Generar cliente Prisma
RUN npx prisma generate

EXPOSE 9002

CMD ["npm", "run", "dev"]