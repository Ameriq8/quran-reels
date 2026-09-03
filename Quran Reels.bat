@echo off
setlocal

set "APP_DIR=%~dp0"
set "BRAVE=C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe"

if not exist "%APP_DIR%\package.json" (
  echo Quran Reels was not found at %APP_DIR%
  pause
  exit /b 1
)

where bun >nul 2>nul
if errorlevel 1 (
  echo Bun is required but was not found.
  pause
  exit /b 1
)

where ffmpeg >nul 2>nul
if errorlevel 1 (
  echo FFmpeg is required but was not found.
  pause
  exit /b 1
)

if not exist "%APP_DIR%\node_modules" (
  pushd "%APP_DIR%"
  bun install --frozen-lockfile
  if errorlevel 1 goto :failed
  popd
)

if not exist "%APP_DIR%\client\node_modules" (
  pushd "%APP_DIR%\client"
  bun install --frozen-lockfile
  if errorlevel 1 goto :failed
  popd
)

if not exist "%APP_DIR%\client\.next\BUILD_ID" (
  pushd "%APP_DIR%\client"
  bun run build
  if errorlevel 1 goto :failed
  popd
)

powershell -NoProfile -Command "try { (Invoke-WebRequest 'http://127.0.0.1:3000' -UseBasicParsing -TimeoutSec 2) | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 start "Quran Reels API" /min cmd /k "cd /d ""%APP_DIR%"" && bun start"

powershell -NoProfile -Command "try { (Invoke-WebRequest 'http://127.0.0.1:3001' -UseBasicParsing -TimeoutSec 2) | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 start "Quran Reels UI" /min cmd /k "cd /d ""%APP_DIR%\client"" && bun run start --port 3001"

powershell -NoProfile -Command "$deadline=(Get-Date).AddSeconds(90); while((Get-Date)-lt $deadline){ try { (Invoke-WebRequest 'http://127.0.0.1:3001' -UseBasicParsing -TimeoutSec 2) | Out-Null; exit 0 } catch { Start-Sleep -Seconds 1 } }; exit 1"
if errorlevel 1 goto :failed

start "" "%BRAVE%" "http://localhost:3001"
exit /b 0

:failed
echo Quran Reels could not start. Review the minimized API and UI windows.
pause
exit /b 1
