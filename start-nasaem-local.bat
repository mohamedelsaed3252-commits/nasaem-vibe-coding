@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Install Node.js LTS before starting Nasaem.
  pause
  exit /b 1
)

where pnpm >nul 2>&1
if errorlevel 1 (
  echo Install pnpm before starting Nasaem.
  pause
  exit /b 1
)

if not exist "node_modules\.pnpm" (
  echo Preparing Nasaem for first use. Internet is needed for this one-time setup.
  call pnpm install
  if errorlevel 1 (
    echo Setup failed.
    pause
    exit /b 1
  )
)

call pnpm nasaem:local
if errorlevel 1 (
  echo Nasaem stopped because of an error.
  pause
)
