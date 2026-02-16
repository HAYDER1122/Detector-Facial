#!/bin/bash

# -----------------------------
# Start script para Railway
# -----------------------------

# Ir a la carpeta backend
cd backend

# Instalar dependencias
echo "Instalando dependencias..."
npm install

# Arrancar el servidor
echo "Iniciando servidor..."
node server.js
