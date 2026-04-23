$ErrorActionPreference = "SilentlyContinue"
$ProjectRoot = "C:\Users\User\OneDrive - 한국기독교장로회총회유지재단\0.박봉환개인문서폴더\기장주소록"
$NgrokExe = Join-Path $ProjectRoot "ngrok.exe"
$PythonExe = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$ServerDir = Join-Path $ProjectRoot "server"
$NgrokCfg = "C:\Users\User\AppData\Local\ngrok\ngrok.yml"

# 기존에 실행중인 프로세스 정리 (포트 충돌 방지)
Stop-Process -Name "ngrok" -Force
Get-WmiObject Win32_Process -Filter "Name='python.exe' AND CommandLine LIKE '%uvicorn%main:app%'" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Get-WmiObject Win32_Process -Filter "Name='python.exe' AND CommandLine LIKE '%main.py%'" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

Start-Sleep -Seconds 2

# 서버 및 ngrok 실행 (포트 5000으로 통일)
Start-Process -FilePath $NgrokExe -ArgumentList "start","prok-api","--config",$NgrokCfg -WindowStyle Hidden
Start-Process -FilePath $PythonExe -ArgumentList "-m","uvicorn","main:app","--host","0.0.0.0","--port","5000" -WorkingDirectory $ServerDir -WindowStyle Hidden