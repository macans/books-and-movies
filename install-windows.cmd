@echo off
setlocal
set "bundle=%~dp0"
if not exist "%bundle%extension\manifest.json" (
 echo Extract the complete download before starting the installer.
 exit /b 1
)
if exist "%bundle%extension\data\bootstrap.json" (
 echo This bundle contains private data. Use a clean release.
 exit /b 1
)
set "target=%LOCALAPPDATA%\BooksAndMovies"
if defined BOOKS_MOVIES_INSTALL_DIR set "target=%BOOKS_MOVIES_INSTALL_DIR%"
if not exist "%target%" mkdir "%target%"
if exist "%target%\extension" move "%target%\extension" "%target%\extension.previous.%RANDOM%%RANDOM%" >nul
xcopy "%bundle%extension" "%target%\extension\" /E /I /Y /Q >nul
if errorlevel 1 exit /b 1
copy /Y "%bundle%install\INSTALL.html" "%target%\INSTALL.html" >nul
echo Extension prepared at: %target%\extension
echo In Chrome: chrome://extensions ^> Developer mode ^> Load unpacked.
echo Select the extension folder above, then connect Douban in Books and Movies.
if "%~1"=="--prepare-only" exit /b 0
set "chrome=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%chrome%" set "chrome=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%chrome%" set "chrome=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if exist "%chrome%" (
 start "" "%chrome%" "%target%\INSTALL.html" "chrome://extensions"
) else (
 start "" "%target%\INSTALL.html"
)
pause
