@echo off
chcp 65001 >nul
echo ========================================
echo Dashboard页面现代化样式验证
echo ========================================
echo.

echo [1/3] 检查采集器服务状态...
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
echo [2/3] 检查样式文件...
if exist "styles\modern-components.css" (
    echo ✅ modern-components.css 存在
) else (
    echo ❌ modern-components.css 缺失
)

echo.
echo [3/3] 检查更新后的文件...
findstr /C:"modern-card card-gradient" "pages\DashboardPage.js" >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ DashboardPage.js 已更新为现代化样式
) else (
    echo ❌ DashboardPage.js 未更新
)

echo.
echo ========================================
echo 验证完成!
echo ========================================
echo.
echo 📱 请在浏览器中打开以下链接进行功能测试:
echo.
echo 🏠 仪表盘页面:
echo    http://localhost:8093/#/dashboard
echo.
echo 🎨 样式测试页面:
echo    http://localhost:8093/test-modern-ui.html
echo.
echo ========================================
echo.
echo 功能测试清单:
echo [ ] 页面加载正常
echo [ ] 系统状态卡片显示正确
echo [ ] 接口卡片显示正确且有悬停效果
echo [ ] 添加接口卡片可点击
echo [ ] 快速访问卡片可点击
echo [ ] 所有按钮功能正常
echo [ ] 样式看起来现代化
echo [ ] 响应式布局正常
echo.
echo ========================================
echo.
echo 按任意键在浏览器中打开仪表盘页面...
pause >nul

start http://localhost:8093/#/dashboard

echo.
echo 测试完成后,请查看 MODERNIZATION_STATUS.md 了解下一步操作
pause
