@echo off
title Clinica ERP - Cargar datos en BD
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\apply-seed.ps1"
pause
