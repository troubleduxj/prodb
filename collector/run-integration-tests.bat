@echo off
REM ProDB Collector Integration Tests Runner
REM This script runs all integration tests for the collector

echo ========================================
echo ProDB Collector Integration Tests
echo ========================================
echo.

echo [1/4] Running Core Collector Tests...
go test -v ./internal/core/... -run Integration
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Core collector tests failed
    exit /b 1
)
echo.

echo [2/4] Running Auth Manager Tests...
go test -v ./internal/auth/... -run Integration
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Auth manager tests failed
    exit /b 1
)
echo.

echo [3/4] Running Protocol Manager Tests...
go test -v ./internal/protocol/... -run Integration
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Protocol manager tests failed
    exit /b 1
)
echo.

echo [4/4] Running All Unit Tests...
go test -v ./...
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Some unit tests failed
    exit /b 1
)
echo.

echo ========================================
echo All Tests Passed Successfully!
echo ========================================
echo.

echo Generating Test Coverage Report...
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out -o coverage.html
echo Coverage report generated: coverage.html
echo.

echo Test execution completed!
