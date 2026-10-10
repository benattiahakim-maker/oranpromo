@echo off
cd /d "%~dp0"
echo Demarrage du site BleDeal... (laisse cette fenetre ouverte, ferme-la pour arreter le site)
start "" cmd /c "timeout /t 8 >nul & start http://127.0.0.1:3000"
call npm.cmd run dev -- -H 127.0.0.1
pause
