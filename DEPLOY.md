# Deploy de produccion

## Objetivo

- `https://gmsoluciondigital.com` -> frontend GMS: landing, login y app
- `https://www.gmsoluciondigital.com` -> mismo frontend
- `https://api.gmsoluciondigital.com` -> backend FastAPI de GMS
- `https://acrodancetrainig.com` -> proyecto Acrodance, separado de GMS

## Estructura recomendada

El servidor debe exponer solo:

- `80`
- `443`
- `22`

Los contenedores deben quedar internos y accesibles solo por `127.0.0.1`:

- frontend GMS -> `127.0.0.1:3001`
- backend GMS -> `127.0.0.1:8001`
- Acrodance -> `127.0.0.1:3002` o el puerto interno que definas

## Variables de entorno

### Frontend

Usa `apps/frontend/.env.production.example` como base:

```env
VITE_API_BASE_URL=https://api.gmsoluciondigital.com
```

### Backend

Usa `apps/backend/.env.production.example` como base:

```env
APP_ENV=production
CORS_ORIGINS=https://gmsoluciondigital.com,https://www.gmsoluciondigital.com
```

Completa tambien:

- `DATABASE_URL`
- `SECRET_KEY`
- credenciales Twilio

## Docker Compose

Archivo incluido:

- `deploy/docker-compose.prod.yml`

Levanta GMS con:

```bash
cd /home/gms
docker compose -f deploy/docker-compose.prod.yml up -d --build
```

## Flujo de actualizacion habitual

Cuando hagas cambios locales y los subas a GitHub, en el servidor el flujo recomendado es:

```bash
cd /home/gms
git pull
```

### Si cambiaste solo frontend

```bash
./deploy/update-gms.sh frontend
```

### Si cambiaste solo backend

```bash
./deploy/update-gms.sh backend
```

### Si cambiaste ambos o quieres un recambio limpio

```bash
./deploy/update-gms.sh all
```

Notas:

- el script usa por defecto `docker-compose.yml`
- si mas adelante decides mover el servidor al compose productivo del repo, puedes ejecutar:

```bash
COMPOSE_FILE=deploy/docker-compose.prod.yml ./deploy/update-gms.sh all
```

- si despues de un cambio frontend sigues viendo archivos viejos en navegador, purga cache en Cloudflare y prueba en modo incognito

## Nginx reverse proxy

Archivo incluido:

- `deploy/nginx/gmsoluciondigital.com.conf`

Este archivo enruta:

- `gmsoluciondigital.com` -> `127.0.0.1:3001`
- `api.gmsoluciondigital.com` -> `127.0.0.1:8001`

Archivo de referencia adicional:

- `deploy/nginx/acrodancetrainig.com.conf`

Ese archivo enruta:

- `acrodancetrainig.com` -> `127.0.0.1:3002`

Instalacion tipica en el servidor:

```bash
sudo cp deploy/nginx/gmsoluciondigital.com.conf /etc/nginx/sites-available/gmsoluciondigital.com.conf
sudo ln -s /etc/nginx/sites-available/gmsoluciondigital.com.conf /etc/nginx/sites-enabled/gmsoluciondigital.com.conf
sudo nginx -t
sudo systemctl reload nginx
```

Luego agrega HTTPS con `certbot` o con certificados de origen de Cloudflare.

## Cloudflare

Crear estos registros DNS:

1. `A` `@` -> `206.189.191.143`
2. `CNAME` `www` -> `gmsoluciondigital.com`
3. `A` `api` -> `206.189.191.143`

Para `acrodancetrainig.com`, mantenlo apuntando al mismo servidor si ya esta activo.

En Cloudflare:

- `SSL/TLS` -> `Full (strict)`
- `Always Use HTTPS` -> `ON`

## Checklist antes de activar dominio

1. Backend con `.env` de produccion
2. Frontend construido con `VITE_API_BASE_URL=https://api.gmsoluciondigital.com`
3. Nginx proxy activo
4. Puertos publicos cerrados:
   - no dejar expuestos `8000` ni `8082`
5. Validar:
   - `/`
   - `/login`
   - `/dashboard`
   - `https://api.gmsoluciondigital.com/health`
   - envio Twilio/WhatsApp
