@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo === OranPromo : installation ===
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo Git n'est pas installe. Installe-le depuis https://git-scm.com puis relance ce fichier.
  pause
  exit /b 1
)

echo [1/3] Liaison du dossier avec GitHub...
if not exist ".git" (
  git init -q -b main
  git remote add origin https://github.com/benattiahakim-maker/oranpromo
)
git fetch -q origin main
git reset -q origin/main
git branch -q --set-upstream-to=origin/main main

echo [2/3] Creation du fichier .env.local...
if not exist ".env.local" (
  > ".env.local" echo NEXT_PUBLIC_SUPABASE_URL=https://iloyliuzsflzbkhpvxjt.supabase.co
  >> ".env.local" echo NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_0oJWRPRK8JRNedT2kNIrww_cVhRxEUZ
  >> ".env.local" echo ANTHROPIC_API_KEY=
  >> ".env.local" echo NEXT_PUBLIC_SITE_URL=http://localhost:3000
)

echo [3/3] Installation des dependances (1 a 3 minutes)...
call npm.cmd install --no-fund --no-audit

echo.
git status --short
echo.
echo === Termine. Pour lancer le site : npm.cmd run dev puis http://localhost:3000 ===
echo.
pause
(goto) 2>nul & del "%~f0"
