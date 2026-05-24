@echo off
chcp 65001 > nul
title Pastelicias - BACKEND
cd /d "%~dp0backend"
echo Iniciando Backend en http://localhost:3000 ...
npm run dev
pause
