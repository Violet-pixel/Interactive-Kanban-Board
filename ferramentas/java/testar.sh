#!/usr/bin/env bash
set -euo pipefail
pasta="$(cd "$(dirname "$0")" && pwd)"
saida=$(bash "$pasta/prumo.sh" resumo "$pasta/teste/tarefas.csv" 2026-10-21)
echo "$saida"
echo "$saida" | grep -q "Tarefas: 3 | concluídas: 1 | pendentes: 2 | atrasadas: 1"
atrasadas=$(bash "$pasta/prumo.sh" atrasadas "$pasta/teste/tarefas.csv" 2026-10-21)
echo "$atrasadas" | grep -q "2026-10-19  Corrigir travamento"
responsaveis=$(bash "$pasta/prumo.sh" responsaveis "$pasta/teste/tarefas.csv")
echo "$responsaveis" | grep -q "Carla Dias .*1/2 concluídas"
echo "Testes da ferramenta Java: ok"
