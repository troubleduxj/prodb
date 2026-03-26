# Test script for ProDB Collector
Write-Host "Testing ProDB Collector..." -ForegroundColor Green

# Set test environment variables
$env:COLLECTOR_ID = "test-collector-001"
$env:SECRET_KEY = "test-secret-key"
$env:PLATFORM_API_ENDPOINT = "http://localhost:8088"
$env:LOG_LEVEL = "debug"

Write-Host "Environment variables set:" -ForegroundColor Yellow
Write-Host "COLLECTOR_ID: $env:COLLECTOR_ID"
Write-Host "SECRET_KEY: $env:SECRET_KEY"
Write-Host "PLATFORM_API_ENDPOINT: $env:PLATFORM_API_ENDPOINT"
Write-Host "LOG_LEVEL: $env:LOG_LEVEL"

Write-Host "`nStarting collector for 5 seconds..." -ForegroundColor Yellow

# Start collector process
$process = Start-Process -FilePath "./collector.exe" -NoNewWindow -PassThru

# Wait for 5 seconds
Start-Sleep -Seconds 5

# Stop the process
if (!$process.HasExited) {
    Stop-Process -Id $process.Id -Force
    Write-Host "Collector stopped successfully." -ForegroundColor Green
} else {
    Write-Host "Collector exited on its own." -ForegroundColor Yellow
}

Write-Host "`nTest completed." -ForegroundColor Green