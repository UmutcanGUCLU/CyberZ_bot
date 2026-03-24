@echo off
title Studio Bot v6
color 0E
echo.
echo  ========================================
echo      STUDIO BOT v6 BASLATILIYOR
echo  ========================================
echo.
echo  Komutlar otomatik kaydedilecek.
echo  Kapatmak icin CTRL+C veya pencereyi kapat.
echo.
cd /d %~dp0
node bot.js
echo.
echo  Bot durdu!
pause
