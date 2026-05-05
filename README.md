# 🎭 Detector Facial

> Sistema web de **detección y reconocimiento facial** en tiempo real con autenticación segura, gestión de usuarios y exportación de reportes.

![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?style=flat&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.x-000000?style=flat&logo=express&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8.x-4479A1?style=flat&logo=mysql&logoColor=white)
![face-api.js](https://img.shields.io/badge/face--api.js-0.22.2-FF6B6B?style=flat)
![Railway](https://img.shields.io/badge/Deploy-Railway-0B0D0E?style=flat&logo=railway&logoColor=white)
![Licencia](https://img.shields.io/badge/Licencia-ISC-blue?style=flat)

---

## 📋 Tabla de Contenidos

- [Descripción](#-descripción)
- [Características](#-características)
- [Tecnologías](#-tecnologías)
- [Arquitectura](#-arquitectura)
- [Requisitos](#-requisitos)
- [Instalación](#-instalación)
- [Variables de Entorno](#-variables-de-entorno)
- [Uso](#-uso)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [API Endpoints](#-api-endpoints)
- [Despliegue](#-despliegue-en-railway)
  

---

## 📖 Descripción

**Detector Facial** es una aplicación web full-stack que combina inteligencia artificial de visión por computadora con un backend robusto para ofrecer:

- Reconocimiento facial en tiempo real desde el navegador usando la cámara web.
- Gestión segura de usuarios con autenticación JWT.
- Almacenamiento de registros de acceso en base de datos MySQL.
- Exportación de reportes en formato Excel.
- Despliegue listo para producción en Railway.

---

## ✨ Características

- 🧠 **Reconocimiento facial con IA** — Detección de rostros mediante modelos preentrenados de `face-api.js` (SSD MobileNetV1 + FaceNet).
- 🔐 **Autenticación segura** — Sistema de login con contraseñas encriptadas con `bcrypt` y sesiones con `JWT`.
- 📸 **Carga de imágenes** — Gestión de fotos de perfil y registros con `multer`.
- 📊 **Exportación a Excel** — Generación de reportes descargables con `ExcelJS`.
- 🛡️ **Rate Limiting** — Protección contra abuso de la API con `express-rate-limit`.
- 🌐 **CORS configurado** — Listo para integrarse con frontends en distintos dominios.
- ☁️ **Deploy en Railway** — Configurado con `railway.json` para despliegue automático.

---

## 🛠️ Tecnologías

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Runtime | Node.js | 18+ |
| Framework | Express | ^5.2.1 |
| Base de datos | MySQL | 8.x |
| IA / Visión | face-api.js | ^0.22.2 |
| Autenticación | jsonwebtoken + bcrypt | ^9.0.3 / ^6.0.0 |
| Archivos | multer | ^2.0.2 |
| Reportes | ExcelJS | ^4.4.0 |
| Variables de entorno | dotenv | ^17.2.4 |
| Frontend | HTML5 + CSS3 + JavaScript | — |

---

## 🏗️ Arquitectura

```
┌──────────────────────────────────────────┐
│              CLIENTE (Browser)           │
│  HTML + CSS + JavaScript + face-api.js  │
│          Cámara Web / Imágenes          │
└─────────────────┬────────────────────────┘
                  │ HTTP / REST API
┌─────────────────▼────────────────────────┐
│           BACKEND (Node.js / Express)    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │  Auth    │ │  Facial  │ │ Reportes │ │
│  │  JWT     │ │  Routes  │ │  Excel   │ │
│  └──────────┘ └──────────┘ └──────────┘ │
│           Rate Limiter / CORS            │
└─────────────────┬────────────────────────┘
                  │ mysql2
┌─────────────────▼────────────────────────┐
│              MySQL Database              │
│     Usuarios | Registros | Imágenes     │
└──────────────────────────────────────────┘
```

---

## 📦 Requisitos

- [Node.js](https://nodejs.org/) >= 18.x
- [MySQL](https://www.mysql.com/) >= 8.x
- npm >= 9.x
- Navegador moderno con soporte para `getUserMedia` (cámara web)

---

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/HAYDER1122/Detector-Facial.git
cd Detector-Facial
```

### 2. Instalar dependencias del backend

```bash
npm install
```

### 3. Configurar la base de datos

Crea una base de datos en MySQL y ejecuta el script de inicialización (si existe en `/backend/db/`):

```sql
CREATE DATABASE detector_facial;
```

### 4. Configurar variables de entorno

Copia el archivo de ejemplo y edita con tus credenciales:

```bash
cp .env.example .env
```

### 5. Iniciar el servidor

```bash
# Desarrollo (con recarga automática)
npx nodemon backend/server.js

# Producción
node backend/server.js
```

### 6. Abrir en el navegador

```
http://localhost:3000
```

---

## 🔑 Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# Base de datos
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_contraseña
DB_NAME=detector_facial

# JWT
JWT_SECRET=tu_clave_secreta_muy_segura

# Servidor
PORT=3000
NODE_ENV=development
```

> ⚠️ **Nunca subas el archivo `.env` a GitHub.** Asegúrate de que esté en tu `.gitignore`.

---

## 💻 Uso

### Registro de usuario
1. Accede a la pantalla de registro.
2. Ingresa los datos requeridos y una foto de perfil.
3. El sistema encripta la contraseña y almacena el descriptor facial.

### Reconocimiento facial
1. Inicia sesión en el sistema.
2. Activa la cámara desde el panel principal.
3. El sistema detecta rostros en tiempo real y los compara con la base de datos.
4. Los accesos quedan registrados automáticamente.

### Exportar reporte
1. Accede al módulo de reportes.
2. Filtra por fecha o usuario.
3. Descarga el reporte en formato `.xlsx`.

---

## 📁 Estructura del Proyecto

```
Detector-Facial/
├── backend/
│   ├── server.js          # Punto de entrada del servidor
│   ├── routes/            # Rutas de la API REST
│   ├── controllers/       # Lógica de negocio
│   ├── middlewares/       # Auth JWT, rate limit, multer
│   ├── models/            # Consultas a la base de datos
│   └── db/                # Configuración de conexión MySQL
├── index.js               # Archivo raíz / entrada alternativa
├── package.json           # Dependencias y scripts
├── railway.json           # Configuración de despliegue
└── .env                   # Variables de entorno (no incluir en git)
```

---

## 🔌 API Endpoints

### Autenticación

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Registrar nuevo usuario |
| `POST` | `/api/auth/login` | Iniciar sesión (devuelve JWT) |

### Reconocimiento Facial

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/facial/detect` | Detectar rostro en imagen enviada |
| `POST` | `/api/facial/register-face` | Registrar descriptor facial de usuario |
| `GET`  | `/api/facial/records` | Obtener registros de acceso |

### Reportes

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET`  | `/api/reports/export` | Exportar registros a Excel |

### Archivos

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/upload` | Subir imagen de perfil (multer) |

> 🔒 La mayoría de endpoints requieren el header `Authorization: Bearer <token>`.

---

## ☁️ Despliegue en Railway

El proyecto incluye el archivo `railway.json` preconfigurado:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "startCommand": "node backend/server.js"
}
```

### Pasos para desplegar:

1. Crea una cuenta en [Railway](https://railway.app).
2. Conecta tu repositorio de GitHub.
3. Agrega un servicio de **MySQL** desde el panel de Railway.
4. Configura las variables de entorno en el panel de Railway.
5. Railway desplegará automáticamente al hacer push a `main`.



<p align="center">
  Hecho  por <a href="https://github.com/HAYDER1122">HAYDER1122</a>
</p>
