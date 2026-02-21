#!/usr/bin/env bash

echo "Iniciando o upload das variáveis do .env para o Cloudflare Secrets..."
echo "-------------------------------------------------------------------"

# Lê o arquivo .env linha por linha, ignora espaços e comentários
while IFS='=' read -r key value || [ -n "$key" ]; do
  # Ignora linhas vazias e linhas que começam com #
  if [[ -n "$key" && "$key" != \#* ]]; then
    
    # Limpa aspas duplas, aspas simples e espaços em branco do início e do fim do valor
    clean_value=$(echo "$value" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e "s/^'//" -e "s/'$//" -e 's/^"//' -e 's/"$//')
    
    echo "Enviando secret: $key"
    # O comando abaixo envia a secret silenciosamente para a nuvem
    echo "$clean_value" | bunx wrangler secret put "$key"
    echo "$key enviado com sucesso!"
    echo "---------------------------"
  fi
done < .env

echo "Todas as variáveis foram exportadas para Produção!"
