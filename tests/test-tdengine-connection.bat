@echo off
echo Testing TDengine connection to 192.168.237.145:6030...
echo.

go run test-tdengine-connection.go

echo.
echo Test completed. Press any key to exit...
pause > nul