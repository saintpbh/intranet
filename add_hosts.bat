@echo off
echo 222.231.1.47 server.prok.or.kr >> C:\Windows\System32\drivers\etc\hosts
echo hosts 파일에 추가 완료!
ipconfig /flushdns
echo DNS 캐시 초기화 완료!
ping -n 1 server.prok.or.kr
pause
