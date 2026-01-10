#!/bin/bash

# Script para alternar entre ambientes de desenvolvimento e produção
# Uso: ./switch-env.sh [dev|prod|status]

ENV_FILE=".env"

show_usage() {
    echo "Uso: $0 [dev|prod|status]"
    echo ""
    echo "Comandos:"
    echo "  dev    - Configurar para desenvolvimento local"
    echo "  prod   - Configurar para produção (Azure)"
    echo "  status - Mostrar configuração atual"
    echo ""
    echo "Exemplos:"
    echo "  ./switch-env.sh dev    # Desenvolvimento"
    echo "  ./switch-env.sh prod   # Produção"
    echo "  ./switch-env.sh status # Ver configuração atual"
}

show_status() {
    if [ ! -f "$ENV_FILE" ]; then
        echo "❌ Arquivo .env não encontrado!"
        echo "Execute './switch-env.sh dev' para criar."
        return
    fi

    echo "📋 Configuração atual (.env):"
    echo "----------------------------------------"

    if grep -q "localhost:3000" "$ENV_FILE"; then
        echo "🌍 Ambiente: DESENVOLVIMENTO"
        echo "🔗 API URL: $(grep VITE_API_BASE_URL "$ENV_FILE" | cut -d'=' -f2)"
    elif grep -q "azurewebsites.net" "$ENV_FILE"; then
        echo "🚀 Ambiente: PRODUÇÃO (Azure)"
        echo "🔗 API URL: $(grep VITE_API_BASE_URL "$ENV_FILE" | cut -d'=' -f2)"
    else
        echo "❓ Ambiente: DESCONHECIDO"
        echo "🔗 API URL: $(grep VITE_API_BASE_URL "$ENV_FILE" | cut -d'=' -f2)"
    fi

    echo ""
    echo "💡 Para alternar:"
    echo "   Desenvolvimento: ./switch-env.sh dev"
    echo "   Produção:        ./switch-env.sh prod"
}

switch_to_dev() {
    if [ ! -f "env.development" ]; then
        echo "❌ Arquivo env.development não encontrado!"
        exit 1
    fi

    cp env.development .env
    echo "✅ Configurado para DESENVOLVIMENTO"
    show_status
}

switch_to_prod() {
    if [ ! -f "env.production" ]; then
        echo "❌ Arquivo env.production não encontrado!"
        exit 1
    fi

    # Lembrete para atualizar a URL da Azure
    if grep -q "seuservico.azurewebsites.net" env.production; then
        echo "⚠️  IMPORTANTE: Atualize a URL da Azure no arquivo env.production"
        echo "   Substitua 'seuservico.azurewebsites.net' pela URL real do seu serviço Azure"
        echo ""
    fi

    cp env.production .env
    echo "✅ Configurado para PRODUÇÃO"
    show_status
}

# Verificar se foi passado um argumento
case "$1" in
    "dev")
        switch_to_dev
        ;;
    "prod")
        switch_to_prod
        ;;
    "status"|"")
        show_status
        ;;
    *)
        echo "❌ Comando inválido: $1"
        echo ""
        show_usage
        exit 1
        ;;
esac