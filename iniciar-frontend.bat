@echo off
chcp 65001 > nul
title Pastelicias - FRONTEND
cd /d "%~dp0frontend"
echo Iniciando Frontend en http://localhost:4200 ...
npm start
pause
