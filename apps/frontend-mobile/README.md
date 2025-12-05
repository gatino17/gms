# Frontend Móvil (Expo) - Portal Alumno

Aplicación móvil en Expo orientada a alumnos. Flujo passwordless: el alumno ingresa su correo, recibe un código y accede a su información (perfil, curso actual, asistencia y pagos).

## Requisitos
- Node 20.x (recomendado) y npm.
- Expo CLI/EAS (Expo Go para probar en el teléfono).
- Backend corriendo y accesible por IP (no usar 127.0.0.1 para móvil).

## Variables
Configura la URL del backend:

```bash
set EXPO_PUBLIC_API_URL=http://<IP_DEL_BACKEND>:8002   # Windows CMD
export EXPO_PUBLIC_API_URL=http://<IP_DEL_BACKEND>:8002 # bash
```

El código toma por defecto la IP que Expo muestra en el QR para el puerto 8002.

## Desarrollo
```bash
cd apps/frontend-mobile
npm install
npm run start -- --tunnel   # o --lan, según tu red
```

Abre Expo Go en el teléfono y escanea el QR (o pega la URL exp://...).

## Flujo
1. Ingresa el correo del alumno.
2. Pulsa "Enviar código" (verás el código en un alert).
3. Ingresa/usa el código y pulsa "Entrar".
4. Se carga el dashboard con:
   - Perfil y estado (activo/inactivo).
   - Stats (cursos activos, completados, horas).
   - Próxima clase (curso actual).
   - Novedades (banners).
   - Clases activas, asistencia reciente y pagos.

## Notas
- El backend expone endpoints passwordless: `/api/pms/students/portal/request_code`, `/portal/login`, `/portal/me`.
- Para producción, reemplaza el envío de código en claro por correo/SMS y persiste los códigos en BD.

