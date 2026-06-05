@echo off
title Clinica ERP - Detectar puertos libres
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\detect-ports.ps1"
pause
