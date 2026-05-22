# 클라이언트 API 주소를 IDC 서버로 전환하고 배포하는 스크립트
param (
    [string]$IdcApiUrl
)

if (-not $IdcApiUrl) {
    Write-Host "오류: IDC 서버의 API 주소를 입력해야 합니다." -ForegroundColor Red
    Write-Host "사용법: .\switch_to_idc.ps1 -IdcApiUrl `"https://api.prok.or.kr`"" -ForegroundColor Yellow
    exit 1
}

$envFile = "$PSScriptRoot\.env.production"

# .env.production 파일 내용 업데이트
$envContent = "VITE_API_URL=$IdcApiUrl"
Set-Content -Path $envFile -Value $envContent -Encoding UTF8

Write-Host "[1/3] $envFile 업데이트 완료: $envContent" -ForegroundColor Green

# 빌드 실행
Write-Host "[2/3] 클라이언트 빌드 시작 (npm run build)..." -ForegroundColor Cyan
Set-Location -Path $PSScriptRoot
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "빌드 실패!" -ForegroundColor Red
    exit $LASTEXITCODE
}

# 배포 실행
Write-Host "[3/3] Firebase Hosting 배포 시작..." -ForegroundColor Cyan
firebase deploy --only hosting

if ($LASTEXITCODE -eq 0) {
    Write-Host "모든 과정이 성공적으로 완료되었습니다!" -ForegroundColor Green
    Write-Host "이제 로컬 PC를 끄셔도 앱이 완벽히 작동합니다." -ForegroundColor Green
} else {
    Write-Host "배포 중 오류가 발생했습니다." -ForegroundColor Red
}
