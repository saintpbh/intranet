$ErrorActionPreference = "SilentlyContinue"
$ProjectRoot = "C:\Users\User\OneDrive - 한국기독교장로회총회유지재단\0.박봉환개인문서폴더\기장주소록"
$NgrokExe = Join-Path $ProjectRoot "ngrok.exe"
$PythonExe = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$ServerDir = Join-Path $ProjectRoot "server"
$NgrokCfg = "C:\Users\User\AppData\Local\ngrok\ngrok.yml"
Start-Process -FilePath $NgrokExe -ArgumentList "start","prok-api","--config",$NgrokCfg -WindowStyle Hidden
Start-Process -FilePath $PythonExe -ArgumentList "-m","uvicorn","main:app","--host","0.0.0.0","--port","5000" -WorkingDirectory $ServerDir -WindowStyle Hidden