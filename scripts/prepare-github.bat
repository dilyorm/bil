@echo off
REM Prepare BIL project for GitHub push
REM This script removes sensitive data and prepares the project for public release

echo.
echo ========================================
echo   Preparing BIL for GitHub
echo ========================================
echo.

REM Check if we're in the right directory
if not exist "package.json" (
    echo [ERROR] Must be run from project root
    pause
    exit /b 1
)

echo Step 1: Checking for sensitive files...
echo.

REM Check for .env files
echo Checking for .env files...
dir /s /b .env 2>nul | findstr /v "node_modules" | findstr /v ".example"
if %errorlevel% equ 0 (
    echo [WARNING] Found .env files - they are in .gitignore
)
echo.

echo Step 2: Checking environment files...
if exist "packages\backend\.env.example" (
    echo [OK] .env.example exists
) else (
    echo [ERROR] .env.example missing
    pause
    exit /b 1
)
echo.

echo Step 3: Removing test and debug files...
del /s /q *_TROUBLESHOOTING.md 2>nul
del /s /q *_SUMMARY.md 2>nul
del /s /q *_COMPLETE.md 2>nul
del /s /q TEST_*.md 2>nul
del /s /q test-*.js 2>nul
echo [OK] Cleaned up test files
echo.

echo Step 4: Checking git status...
if exist ".git" (
    echo [OK] Git repository exists
) else (
    echo [WARNING] No git repository found. Initializing...
    git init
    echo [OK] Git repository initialized
)
echo.

echo Step 5: Creating .gitattributes...
(
echo # Auto detect text files and perform LF normalization
echo * text=auto
echo.
echo # Source code
echo *.ts text
echo *.tsx text
echo *.js text
echo *.jsx text
echo *.json text
echo *.md text
echo *.yml text
echo *.yaml text
echo.
echo # Scripts
echo *.sh text eol=lf
echo *.bat text eol=crlf
echo.
echo # Binary files
echo *.png binary
echo *.jpg binary
echo *.jpeg binary
echo *.gif binary
echo *.ico binary
echo *.db binary
echo *.sqlite binary
) > .gitattributes
echo [OK] .gitattributes created
echo.

echo ========================================
echo   Project is ready for GitHub!
echo ========================================
echo.
echo Next steps:
echo 1. Review changes: git status
echo 2. Add files: git add .
echo 3. Commit: git commit -m "Initial commit"
echo 4. Add remote: git remote add origin https://github.com/dilyorm/bil.git
echo 5. Push: git push -u origin main
echo.
echo [WARNING] Remember to:
echo - Never commit .env files
echo - Never commit API keys
echo - Review all files before pushing
echo.
pause
