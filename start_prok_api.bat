@echo off

set "NGROK=%~dp0ngrok.exe"
set "PYTHON=%~dp0server\venv\Scripts\python.exe"
set "SERVER=%~dp0server"
set "NGROK_CFG=%LOCALAPPDATA%\ngrok\ngrok.yml"

start "" "%NGROK%" start prok-api --config "%NGROK_CFG%"

cd /d "%SERVER%"
start "" "%PYTHON%" -m uvicorn main:app --host 0.0.0.0 --port 5005
