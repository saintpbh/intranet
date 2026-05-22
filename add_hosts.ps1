# hosts 파일에 DNS 오버라이드 추가
$hostsPath = "C:\Windows\System32\drivers\etc\hosts"
$entry = "`n222.231.1.47 server.prok.or.kr"
$content = Get-Content $hostsPath -Raw
if ($content -notmatch "server\.prok\.or\.kr") {
    Add-Content -Path $hostsPath -Value $entry -Force
    Write-Host "Added: 222.231.1.47 server.prok.or.kr"
} else {
    Write-Host "Already exists"
}
ipconfig /flushdns
