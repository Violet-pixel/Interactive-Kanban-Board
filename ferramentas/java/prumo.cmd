@echo off
setlocal
set PASTA=%~dp0
if not exist "%PASTA%out" mkdir "%PASTA%out"
javac -encoding UTF-8 -d "%PASTA%out" "%PASTA%src\Prumo.java" || exit /b 1
java -Dstdout.encoding=UTF-8 -cp "%PASTA%out" Prumo %*
