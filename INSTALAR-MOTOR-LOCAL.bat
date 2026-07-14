@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
  echo No se encontro Python. Instale Python 3.11 o posterior y marque Add Python to PATH.
  pause
  exit /b 1
)
if not exist ".venv\Scripts\python.exe" py -m venv .venv
call ".venv\Scripts\activate.bat"
python -m pip install --upgrade pip
python -m pip install -r "motor_local\requirements.txt"
echo.
echo Instalacion finalizada. El analisis funcionara localmente sin API ni IA.
pause
