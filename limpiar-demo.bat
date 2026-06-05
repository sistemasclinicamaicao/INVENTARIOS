@echo off
title Clinica ERP - Limpiar datos demo
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\clear-demo-data.ps1"
pause
