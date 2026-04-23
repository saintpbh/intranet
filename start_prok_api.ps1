$ErrorActionPreference = "SilentlyContinue"
$ProjectRoot = "C:\Users\User\OneDrive - 한국기독교장로회총회유지재단\0.박봉환개인문서폴더\기장주소록"
$NgrokExe = Join-Path $ProjectRoot "ngrok.exe"
$PythonExe = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$ServerDir = Join-Path $ProjectRoot "server"
$NgrokCfg = "C:\Users\User\AppData\Local\ngrok\ngrok.yml"

$Env:PYTHONUTF8 = "1"

Stop-Process -Name "ngrok" -Force -ErrorAction SilentlyContinue
Get-WmiObject Win32_Process -Filter "Name='python.exe'" | Where-Object { $_.CommandLine -match "uvicorn.*main:app" -or $_.CommandLine -match "main.py" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Start-Sleep -Seconds 2

# Log files for debugging server crashes
$OutLog = Join-Path $ServerDir "server_out.log"
$ErrLog = Join-Path $ServerDir "server_err.log"

Start-Process -FilePath $NgrokExe -ArgumentList "start","prok-api","--config",$NgrokCfg -WindowStyle Hidden
Start-Process -FilePath $PythonExe -ArgumentList "-m","uvicorn","main:app","--host","0.0.0.0","--port","5005" -WorkingDirectory $ServerDir -WindowStyle Hidden -RedirectStandardOutput $OutLog -RedirectStandardError $ErrLog


Start-Sleep -Seconds 5
try {
    $response = Invoke-RestMethod -Uri "http://localhost:5005/docs" -Method Get -ErrorAction Stop
    Write-Host "Server started and verified successfully."
} catch {
    Write-Host "Failed to verify server connection after restart. It may take longer to boot."
}
