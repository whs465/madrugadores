@echo off
powershell -NoProfile -Command "if (-not (Test-NetConnection 127.0.0.1 -Port 8765 -InformationLevel Quiet -WarningAction SilentlyContinue)) { Start-Process -FilePath 'node' -ArgumentList 'servidor.cjs' -WorkingDirectory '%~dp0' -WindowStyle Hidden }; Start-Process 'http://localhost:8765/propuesta.html'"
