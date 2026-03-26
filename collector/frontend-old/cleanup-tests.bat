@echo off
REM Collector Frontend 测试文件清理脚本
REM 创建日期: 2025-01-30
REM 更新日期: 2025-01-30

echo ========================================
echo Collector Frontend 测试文件清理
echo ========================================
echo.

REM 创建归档目录
echo 创建归档目录结构...
if not exist "test\archived" mkdir "test\archived"
if not exist "test\archived\header-tests" mkdir "test\archived\header-tests"
if not exist "test\archived\offline-tests" mkdir "test\archived\offline-tests"
if not exist "test\archived\verification" mkdir "test\archived\verification"
if not exist "test\archived\layout-tests" mkdir "test\archived\layout-tests"
if not exist "test\archived\misc-fixes" mkdir "test\archived\misc-fixes"
echo ✓ 目录结构创建完成
echo.

echo [1/6] 归档 Header 测试文件...
move /Y "test-header-*.html" "test\archived\header-tests\" 2>nul
move /Y "test-final-header-fix.html" "test\archived\header-tests\" 2>nul
echo ✓ Header 测试文件已归档

echo [2/6] 归档离线管理器测试文件...
move /Y "test-offline-manager-*.html" "test\archived\offline-tests\" 2>nul
echo ✓ 离线管理器测试文件已归档

echo [3/6] 归档验证文件...
move /Y "verify-header-fix.html" "test\archived\verification\" 2>nul
move /Y "verify-implementation.js" "test\archived\verification\" 2>nul
move /Y "verify-ux-implementation.js" "test\archived\verification\" 2>nul
move /Y "fix-validation-imports.js" "test\archived\verification\" 2>nul
echo ✓ 验证文件已归档

echo [4/6] 归档布局测试文件...
move /Y "test-layout-fixed.html" "test\archived\layout-tests\" 2>nul
move /Y "test-chinese-menu-fix.html" "test\archived\layout-tests\" 2>nul
move /Y "test-sidebar-width-fix.html" "test\archived\layout-tests\" 2>nul
move /Y "test-status-indicator-fix.html" "test\archived\layout-tests\" 2>nul
move /Y "test-statusindicator-final-fix.html" "test\archived\layout-tests\" 2>nul
echo ✓ 布局测试文件已归档

echo [5/6] 归档其他修复测试文件...
move /Y "test-import-fixes.html" "test\archived\misc-fixes\" 2>nul
move /Y "test-validation-fix.html" "test\archived\misc-fixes\" 2>nul
move /Y "test-fixes.html" "test\archived\misc-fixes\" 2>nul
echo ✓ 其他修复测试文件已归档

echo [6/6] 创建归档索引文件...
echo # 测试文件归档 > "test\archived\README.md"
echo. >> "test\archived\README.md"
echo 归档日期: %date% %time% >> "test\archived\README.md"
echo. >> "test\archived\README.md"
echo ## 归档内容 >> "test\archived\README.md"
echo - header-tests: Header布局相关测试 >> "test\archived\README.md"
echo - offline-tests: 离线管理器测试 >> "test\archived\README.md"
echo - verification: 验证脚本 >> "test\archived\README.md"
echo - layout-tests: 布局修复测试 >> "test\archived\README.md"
echo - misc-fixes: 其他修复测试 >> "test\archived\README.md"
echo ✓ 归档索引已创建

echo.
echo ========================================
echo 清理完成！
echo ========================================
echo.
echo 📁 保留的核心测试文件:
echo   ✓ test-all-fixes.html
echo   ✓ test-critical-fixes.html
echo   ✓ test-batch-operations.html
echo   ✓ test-config-management.html
echo   ✓ test-driver-management.html
echo   ✓ test-driver-version-management.html
echo   ✓ test-protocol-testers.html
echo   ✓ test-mobile-optimization.html
echo   ✓ test-mobile-performance.html
echo   ✓ test-performance-optimizations.html
echo   ✓ test-enhanced-security.html
echo   ✓ test-security-validation.html
echo   ✓ test-privacy-protection.html
echo   ✓ test-ux-enhancements.html
echo   ✓ test-ux-integration.html
echo   ✓ status-check.html
echo   ✓ verify-offline-manager.html (新增)
echo.
echo 📦 归档位置: test\archived\
echo 📄 归档索引: test\archived\README.md
echo.
echo 按任意键退出...
pause >nul
