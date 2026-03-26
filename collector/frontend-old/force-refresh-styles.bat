@echo off
echo ========================================
echo 强制刷新 ConfigPage 样式
echo ========================================
echo.

echo 1. 检查 pages.css 文件大小...
dir /b collector\frontend\styles\pages.css 2>nul
if errorlevel 1 (
    echo [错误] pages.css 文件不存在！
    pause
    exit /b 1
)

echo.
echo 2. 显示 pages.css 最后修改时间...
dir collector\frontend\styles\pages.css | find "pages.css"

echo.
echo 3. 检查 ConfigPage 样式是否存在...
findstr /C:"接口管理页面" collector\frontend\styles\pages.css >nul
if errorlevel 1 (
    echo [警告] ConfigPage 样式未找到！
) else (
    echo [成功] ConfigPage 样式已找到
)

echo.
echo 4. 打开测试页面...
echo    请在浏览器中按 Ctrl+Shift+R 强制刷新
echo.
start http://localhost:8093/test-config-page-styles.html

echo.
echo 5. 清理浏览器缓存建议:
echo    - Chrome: Ctrl+Shift+Delete
echo    - Firefox: Ctrl+Shift+Delete
echo    - Edge: Ctrl+Shift+Delete
echo.
echo 6. 或者在浏览器开发者工具中:
echo    - 右键点击刷新按钮
echo    - 选择"清空缓存并硬性重新加载"
echo.

pause
