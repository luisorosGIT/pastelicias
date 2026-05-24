@echo off
chcp 65001 > nul
echo ============================================
echo   PASTELICIAS - Setup inicial
echo ============================================
echo.

echo [1/5] Instalando dependencias del Backend...
cd /d "%~dp0backend"
call npm install
if %errorlevel% neq 0 ( echo ERROR en npm install backend & pause & exit /b 1 )

echo.
echo [2/5] Generando Prisma Client...
call npx prisma generate
if %errorlevel% neq 0 ( echo ERROR en prisma generate & pause & exit /b 1 )

echo.
echo [3/5] Ejecutando migraciones (creando tablas en Supabase)...
call npx prisma migrate dev --name init
if %errorlevel% neq 0 ( echo ERROR en prisma migrate & pause & exit /b 1 )

echo.
echo [4/5] Instalando dependencias del Frontend...
cd /d "%~dp0frontend"
call npm install
if %errorlevel% neq 0 ( echo ERROR en npm install frontend & pause & exit /b 1 )

echo.
echo ============================================
echo   Setup completado exitosamente!
echo ============================================
echo.
echo Ahora abre DOS terminales separadas:
echo   Terminal 1 (Backend):  cd backend ^&^& npm run dev
echo   Terminal 2 (Frontend): cd frontend ^&^& npm start
echo.
pause
