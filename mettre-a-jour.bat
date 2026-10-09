@echo off
cd /d "%~dp0"
echo Recuperation de la derniere version depuis GitHub...
git fetch origin main
git reset --hard origin/main
call npm.cmd install --no-fund --no-audit
echo.
echo === A jour. Lance le site avec lancer-site.bat ===
pause
