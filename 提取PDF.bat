@echo off
chcp 65001 >nul
title 法考PDF自动导入工具
color 0A

echo ==============================================
echo   法考PDF自动导入工具 - 双击即可运行
echo   自动提取+解析+更新网站数据
echo ==============================================
echo.
cd /d "%~dp0"

REM 检查Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo ❌ 未检测到Node.js！
    echo.
    echo 请先安装Node.js：
    echo 打开浏览器 → 访问 https://nodejs.org
    echo → 下载 LTS 版本 → 安装（一路点"下一步"）
    echo.
    pause
    exit /b
)
echo ✅ [1/3] Node.js 已就绪
echo.

REM 安装依赖（首次）
if not exist "node_modules\pdfjs-dist" (
    echo 📦 [2/3] 正在安装组件（首次需要，约1-2分钟）...
    echo.
    call npm install pdfjs-dist
    echo.
    if %errorlevel% neq 0 (
        color 0C
        echo ❌ 安装失败！请检查网络后重试。
        pause
        exit /b
    )
    echo ✅ 组件安装完成
    echo.
) else (
    echo ✅ [2/3] 组件已就绪
    echo.
)

echo 🔍 [3/3] 正在提取和解析PDF...
echo.
echo  📂 扫描位置：%USERPROFILE%\Documents\主观题题目和背诵\
echo.
node scan-pdfs.mjs
echo.
if %errorlevel% equ 0 (
    echo ✅ 处理完成！直接刷新网页即可看到新题目。
) else (
    color 0C
    echo ❌ 执行出错，请检查终端输出
)
echo.
pause
