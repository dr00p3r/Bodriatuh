#!/bin/bash

# Script para copiar los modelos de Human a la carpeta public

echo "📦 Copiando modelos de Human a public/models..."

# Crear directorio si no existe
mkdir -p public/models

# Copiar modelos desde node_modules
if [ -d "node_modules/@vladmandic/human/models" ]; then
  cp -r node_modules/@vladmandic/human/models/* public/models/
  echo "✅ Modelos copiados exitosamente!"
  echo "📁 Modelos disponibles en: public/models/"
  ls -la public/models/
else
  echo "❌ Error: No se encontró node_modules/@vladmandic/human/models"
  echo "Ejecuta primero: npm install"
  exit 1
fi
