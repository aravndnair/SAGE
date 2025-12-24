@echo off
cd /d C:\Vscode\SAGE
call sage_env\Scripts\activate.bat
python backend\main.py
