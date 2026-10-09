@echo off
rem Lance Codex (ligne de commande) sur le prompt prepare par Claude dans .codex-tache\prompt.md.
rem Le compte rendu de Codex est ecrit dans .codex-tache\journal.txt (relu par Claude).
cd /d "%~dp0"

if not exist ".codex-tache\prompt.md" (
  echo Aucun prompt trouve dans .codex-tache\prompt.md
  pause
  exit /b 1
)

del ".codex-tache\fin.txt" 2>nul
echo Codex travaille... ne ferme pas cette fenetre.
echo Le compte rendu s'ecrit dans .codex-tache\journal.txt

type ".codex-tache\prompt.md" | codex exec --full-auto - > ".codex-tache\journal.txt" 2>&1
echo %errorlevel%> ".codex-tache\fin.txt"

echo.
echo Termine. Cette fenetre se ferme dans 15 secondes.
timeout /t 15
