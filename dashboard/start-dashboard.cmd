@echo off
title Marketing OS
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js blev ikke fundet.
  echo   Du kan stadig bruge dashboardet: dobbeltklik marketing-os.html.
  echo   Saa skal du blot bekraefte en gang pr. session, naar du gemmer.
  echo.
  pause
  exit /b 1
)

node server.js

echo.
echo   Serveren er stoppet. Tryk en tast for at lukke.
pause >nul
