@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Primero ejecute INSTALAR-MOTOR-LOCAL.bat
  pause
  exit /b 1
)
call ".venv\Scripts\activate.bat"
python "motor_local\local_server.py" --host 0.0.0.0 --port 8000 --root "%CD%"
pause
