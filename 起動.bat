@echo off
chcp 65001 > nul
title Discord 20MB メディア圧縮ツール
echo --------------------------------------------------
echo  Discord 20MB メディア圧縮ツールを起動しています...
echo --------------------------------------------------
cd /d "%~dp0"
python server.py
if errorlevel 1 (
    echo Pythonが見つからないため、直接ブラウザで index.html を開きます...
    start index.html
)
pause
