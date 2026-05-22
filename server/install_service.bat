@echo off
echo ========================================================
echo PROK FastAPI 백엔드 무중단 서비스(예약 작업) 등록 스크립트
echo ========================================================

:: 현재 스크립트의 절대 경로 가져오기
set "SCRIPT_DIR=%~dp0"
set "VBS_FILE=%SCRIPT_DIR%run_hidden.vbs"
set "BAT_FILE=%SCRIPT_DIR%start_prok_api.bat"

:: 1. 백그라운드(숨김) 실행을 위한 VBScript 생성
echo Set WinScriptHost = CreateObject("WScript.Shell") > "%VBS_FILE%"
echo WinScriptHost.Run Chr(34) ^& "%BAT_FILE%" ^& Chr(34), 0, False >> "%VBS_FILE%"
echo [완료] 숨김 실행 스크립트(run_hidden.vbs) 생성 완료.

:: 2. 윈도우 작업 스케줄러에 등록 (시스템 시작 시 자동 실행)
echo.
echo 시스템 시작 시 자동으로 서버가 백그라운드에서 실행되도록 예약 작업을 등록합니다.
echo (관리자 권한이 필요할 수 있습니다)
schtasks /create /f /tn "PROK_FastAPI_Backend" /tr "wscript.exe \"%VBS_FILE%\"" /sc onstart /ru SYSTEM

echo.
echo [설치 완료]
echo 이제 IDC 서버가 재부팅될 때마다 FastAPI 서버가 자동으로 백그라운드에서 실행됩니다.
echo 지금 즉시 실행하려면 다음 명령을 사용하세요:
echo schtasks /run /tn "PROK_FastAPI_Backend"
echo.
pause
