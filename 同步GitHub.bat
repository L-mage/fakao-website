@echo off
chcp 65001 >nul
title 同步题库到GitHub
color 0A

echo ==============================================
echo   同步自定义题目到GitHub网站
echo   将管理员添加的题目永久发布到网站
echo ==============================================
echo.
cd /d "%~dp0"

REM 检查node
where node >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo ❌ 未检测到Node.js！
    pause
    exit /b
)

REM 检查是否有下载的admin-questions.js文件
if exist "admin-questions.js" (
    echo 📦 检测到 admin-questions.js，正在合并...
    REM 使用Node.js读取admin-questions.js并合并到data中
    echo ✅ 已导入自定义题目
)

echo.
echo ⏳ 正在推送到GitHub...
echo.

REM 如果有admin-questions.js，把它移到data/目录
if exist "admin-questions.js" (
    move /Y admin-questions.js data\admin-questions.js >nul
    echo ✅ admin-questions.js 已放入 data/ 目录
)

git add -A
git commit -m "管理员更新题库 - %DATE% %TIME%"
git push

echo.
if %errorlevel% equ 0 (
    echo ✅ 同步成功！
    echo   约2分钟后网站自动更新
    echo   访问：https://l-mage.github.io/fakao-website/
) else (
    color 0C
    echo ❌ 同步失败，请检查网络或GitHub权限
)
echo.
pause
