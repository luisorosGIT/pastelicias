@echo off
chcp 65001 > nul
echo [4/5] Instalando dependencias del Frontend...
cd /d "%~dp0frontend"
call npm install
if %errorlevel% neq 0 ( echo ERROR en npm install frontend & pause & exit /b 1 )
echo.
echo ============================================
echo   Instalacion completada!
echo ============================================
echo.
echo Abre DOS terminales y ejecuta:
echo   Terminal 1 (Backend):   cd backend ^&^& npm run dev
echo   Terminal 2 (Frontend):  cd frontend ^&^& npm start
echo.
pause
