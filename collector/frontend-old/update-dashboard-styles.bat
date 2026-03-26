@echo off
chcp 65001 >nul
echo 正在更新 DashboardPage.js 的样式类名...
echo.

powershell -Command "$content = Get-Content 'pages/DashboardPage.js' -Raw -Encoding UTF8; $content = $content -replace 'class=\"system-overview-card\"', 'class=\"modern-card card-gradient\"'; $content = $content -replace 'class=\"interface-card', 'class=\"modern-card card-hover'; $content = $content -replace 'class=\"add-interface-card\"', 'class=\"modern-card card-hover\"'; $content = $content -replace 'class=\"quick-access-card\"', 'class=\"modern-card card-hover\"'; [System.IO.File]::WriteAllText('pages/DashboardPage.js', $content, [System.Text.UTF8Encoding]::new($false))"

echo ✅ DashboardPage.js 样式类名已更新
echo.
echo 请刷新浏览器查看效果: http://localhost:8093/
pause
