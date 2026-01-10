#!/bin/bash
# Script para criar arquivo .env a partir do .env.example

if [ -f .env ]; then
  echo "⚠️  Arquivo .env já existe!"
  read -p "Deseja sobrescrever? (s/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "Operação cancelada."
    exit 0
  fi
fi

cp .env.example .env
echo "✅ Arquivo .env criado com sucesso!"
echo ""
echo "📝 Por favor, edite o arquivo .env e configure:"
echo "   - VITE_API_BASE_URL (URL do seu backend)"
echo "   - VITE_GOOGLE_CLIENT_ID (seu Google Client ID)"
echo ""
echo "💡 Veja o README.md para instruções de como obter o Google Client ID."
