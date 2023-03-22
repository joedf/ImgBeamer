@echo off

@REM Set this to location of where you want the jsdoc files to be outputted.
set JSDOC_OUTDIR=jsdocs

echo clearing %JSDOC_OUTDIR% folder ...
rmdir /s /q "%JSDOC_OUTDIR%"
echo running jsdoc ...
call jsdoc -d "%JSDOC_OUTDIR%" -c misc/.jsdoc.conf.json
echo.
echo Copy over the missing images for the readme ...
xcopy app\src\img\icon.svg "%JSDOC_OUTDIR%\app\src\img\icon.svg*" /Y
xcopy misc\screenshot3.png "%JSDOC_OUTDIR%\misc\screenshot3.png*" /Y
echo.
echo Done.