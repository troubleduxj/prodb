Write-Host "🔄 重启后端服务..." -ForegroundColor Cyan
Write-Host ""

Write-Host "📁 切换到后端目录..." -ForegroundColor Yellow
Set-Location -Path "platform\backend"

Write-Host "🛑 停止可能运行的后端服务..." -ForegroundColor Yellow
Get-Process -Name "main" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

Write-Host "🔧 检查Go模块..." -ForegroundColor Yellow
go mod tidy

Write-Host "🚀 启动后端服务..." -ForegroundColor Green
Write-Host "📝 日志将显示在下方，按 Ctrl+C 停止服务" -ForegroundColor Gray
Write-Host ""

go run main.go