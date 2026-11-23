@echo off
REM DashCart - build and run (Windows)
REM   run.bat         -> normal mode (real 30-40 minute delivery clock)
REM   run.bat demo    -> demo mode (delivery runs 30x faster: about 70 seconds)
cd /d "%~dp0"

set SPEED=1
if /i "%1"=="demo" set SPEED=30

if not exist backend\out mkdir backend\out
javac -encoding UTF-8 -d backend\out backend\src\dashcart\*.java
if errorlevel 1 (
  echo Compile failed. Make sure Java JDK 17 or newer is installed.
  pause
  exit /b 1
)
echo Compiled OK.
java -cp backend\out dashcart.Main 8080 frontend %SPEED%
pause
