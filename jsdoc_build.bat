@echo off

@REM Set this to location of where you want the jsdoc files to be outputted.
set JSDOC_OUTDIR=jsdocs


SET arg1=%1

IF /I _%arg1%_==_clean_ (
	goto clean
) ELSE (
	call :clean
	goto build
)

:clean
echo clearing %JSDOC_OUTDIR% folder ...
rmdir /s /q "%JSDOC_OUTDIR%"
echo Cleared.
goto:eof

:build
echo running jsdoc ...
call jsdoc -d "%JSDOC_OUTDIR%" -c .jsdoc.json
echo Copy over the missing images for the readme ...
xcopy app\src\img\icon.svg "%JSDOC_OUTDIR%\app\src\img\icon.svg*" /Y
xcopy misc\screenshot4.png "%JSDOC_OUTDIR%\misc\screenshot*.png*" /Y
echo.
echo Done.
goto:eof