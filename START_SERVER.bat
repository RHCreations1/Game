@echo off
cd /d "%~dp0"
start "Event Raffle System" http://localhost:8000/admin.html
py -m http.server 8000
pause
