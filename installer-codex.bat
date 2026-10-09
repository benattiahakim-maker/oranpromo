@echo off
rem Installe Codex en ligne de commande (meme compte ChatGPT que l'application Codex).
rem A lancer une seule fois, par double-clic.
cd /d "%~dp0"

echo.
echo === 1/3 Installation de Codex en ligne de commande ===
call npm.cmd install -g @openai/codex
if errorlevel 1 (
  echo.
  echo L'installation a echoue. Fais une capture d'ecran de cette fenetre pour Claude.
  pause
  exit /b 1
)

echo.
echo === 2/3 Connexion a ton compte ChatGPT ===
echo Une page va s'ouvrir dans le navigateur : connecte-toi avec ton compte ChatGPT.
call codex login

echo.
echo === 3/3 Verification ===
call codex --version
call codex login status

echo.
echo Termine. Tu peux fermer cette fenetre et prevenir Claude.
pause
