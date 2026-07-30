@echo off
title GerBar Load Planner

REM Ir a la carpeta donde está este archivo
cd /d "%~dp0"

echo =====================================
echo Iniciando GerBar Load Planner...
echo =====================================

REM Iniciar Backend
start "GerBar Backend" cmd /k "cd /d backend && python -m uvicorn app.main:app --reload"

REM Esperar 3 segundos
timeout /t 3 /nobreak >nul

REM Iniciar Frontend
start "GerBar Frontend" cmd /k "cd /d frontend && npm run dev"

REM Esperar 5 segundos
timeout /t 5 /nobreak >nul

REM Abrir navegador
start "" "http://localhost:5173"

exit