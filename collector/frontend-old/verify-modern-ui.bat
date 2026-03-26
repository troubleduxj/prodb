@echo off
chcp 65001 >nul
echo ========================================
echo 现代化UI验证工具
echo ========================================
echo.

echo [1/5] 检查采集器服务状态...
curl -s http://localhost:8093/status >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ 采集器服务运行正常
) else (
    echo ❌ 采集器服务未运行
    echo 请先运行: cd collector ^&^& go run main.go
    pause
    exit /b 1
)

echo.
echo [2/5] 检查样式文件...
set "styles_ok=1"
if exist "styles\main.css" (
    echo ✅ main.css 存在
) else (
    echo ❌ main.css 缺失
    set "styles_ok=0"
)

if exist "styles\modern-components.css" (
    echo ✅ modern-components.css 存在
) else (
    echo ❌ modern-components.css 缺失
    set "styles_ok=0"
)

if exist "styles\components.css" (
    echo ✅ components.css 存在
) else (
    echo ❌ components.css 缺失
    set "styles_ok=0"
)

if exist "styles\themes.css" (
    echo ✅ themes.css 存在
) else (
    echo ❌ themes.css 缺失
    set "styles_ok=0"
)

echo.
echo [3/5] 检查测试页面...
curl -s http://localhost:8093/test-modern-ui.html -o nul
if %errorlevel% equ 0 (
    echo ✅ 测试页面可访问
) else (
    echo ❌ 测试页面无法访问
)

echo.
echo [4/5] 检查主应用页面...
curl -s http://localhost:8093/ -o nul
if %errorlevel% equ 0 (
    echo ✅ 主应用页面可访问
) else (
    echo ❌ 主应用页面无法访问
)

echo.
echo [5/5] 生成访问链接...
echo.
echo ========================================
echo 📱 访问以下链接查看效果:
echo ========================================
echo.
echo 🎨 现代化UI测试页面:
echo    http://localhost:8093/test-modern-ui.html
echo.
echo 🏠 主应用页面:
echo    http://localhost:8093/
echo.
echo 📊 仪表盘:
echo    http://localhost:8093/#/dashboard
echo.
echo 🔌 接口管理:
echo    http://localhost:8093/#/config
echo.
echo 🧪 协议测试:
echo    http://localhost:8093/#/testing
echo.
echo 🚗 驱动管理:
echo    http://localhost:8093/#/drivers
echo.
echo ========================================

echo.
echo 按任意键在浏览器中打开测试页面...
pause >nul

start http://localhost:8093/test-modern-ui.html

echo.
echo 验证完成!
pause
