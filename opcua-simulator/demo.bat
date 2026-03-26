@echo off
echo ========================================
echo    ProDB OPC UA Simulator Demo
echo ========================================
echo.

echo Starting OPC UA Simulator...
start /B go run main.go config.json

echo Waiting for simulator to initialize...
timeout /t 3 /nobreak > nul

echo.
echo Testing simulator connection...
go run quick_test.go

echo.
echo ========================================
echo Demo completed!
echo.
echo The simulator is still running in the background.
echo You can access it at:
echo   HTTP API: http://localhost:8080
echo   OPC UA:   opc.tcp://localhost:4840/opcua/simulator
echo.
echo To stop the simulator, close this window or press Ctrl+C
echo ========================================
echo.
pause