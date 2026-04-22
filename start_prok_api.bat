@echo off

set "NGROK=C:\Users\User\ONEDRI~1\085DE~1.박\기장주~1\ngrok.exe"
set "PYTHON=C:\Users\User\ONEDRI~1\085DE~1.박\기장주~1\VENV~1\Scripts\python.exe"
set "SERVER=C:\Users\User\ONEDRI~1\085DE~1.박\기장주~1\server"
set "NGROK_CFG=C:\Users\User\AppData\Local\ngrok\ngrok.yml"

start "" "%NGROK%" start prok-api --config "%NGROK_CFG%"

cd /d "%SERVER%"
start "" "%PYTHON%" -m uvicorn main:app --host 0.0.0.0 --port 5000
