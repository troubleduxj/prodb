/**
 * CSS样式文件验证脚本
 * 检查样式文件的完整性、语法和导入关系
 */

const fs = require('fs');
const path = require('path');

const stylesDir = path.join(__dirname, 'styles');
const errors = [];
const warnings = [];

// 检查文件是否存在
function checkFileExists(filePath, description) {
    const fullPath = path.join(stylesDir, filePath);
    if (!fs.existsSync(fullPath)) {
        errors.push(`❌ ${description}: 文件不存在 - ${filePath}`);
        return false;
    }
    return true;
}

// 检查CSS语法基本结构
function checkCSSSyntax(filePath) {
    const fullPath = path.join(stylesDir, filePath);
    try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        
        // 检查基本语法
        const openBraces = (content.match(/\{/g) || []).length;
        const closeBraces = (content.match(/\}/g) || []).length;
        
        if (openBraces !== closeBraces) {
            errors.push(`❌ ${filePath}: 大括号不匹配 (开: ${openBraces}, 闭: ${closeBraces})`);
        }
        
        // 检查@import语句
        const imports = content.match(/@import\s+url\(['"]([^'"]+)['"]\)/g) || [];
        imports.forEach(importStmt => {
            const match = importStmt.match(/url\(['"]([^'"]+)['"]\)/);
            if (match) {
                const importPath = match[1].replace(/^\.\//, '');
                if (!checkFileExists(importPath, `导入文件 ${importPath}`)) {
                    warnings.push(`⚠️  ${filePath}: 导入的文件不存在 - ${importPath}`);
                }
            }
        });
        
        // 检查CSS变量定义
        const cssVars = content.match(/--[a-zA-Z-]+:/g) || [];
        if (cssVars.length > 0) {
            console.log(`  ✓ 找到 ${cssVars.length} 个CSS变量`);
        }
        
        // 检查媒体查询
        const mediaQueries = content.match(/@media\s+[^{]+/g) || [];
        if (mediaQueries.length > 0) {
            console.log(`  ✓ 找到 ${mediaQueries.length} 个媒体查询`);
        }
        
        return true;
    } catch (error) {
        errors.push(`❌ ${filePath}: 读取文件失败 - ${error.message}`);
        return false;
    }
}

// 主验证函数
function verifyStyles() {
    console.log('🔍 开始验证样式文件...\n');
    
    // 检查主要样式文件
    const mainFiles = [
        'main.css',
        'themes.css',
        'components.css',
        'pages.css',
        'modern-components.css',
        'performance.css',
        'ux-enhancements.css',
        'security-enhancements.css',
        'privacy-protection.css',
        'mobile-optimization.css'
    ];
    
    console.log('📁 检查主要样式文件:');
    mainFiles.forEach(file => {
        if (checkFileExists(file, `主样式文件 ${file}`)) {
            console.log(`  ✓ ${file}`);
            checkCSSSyntax(file);
        }
    });
    
    // 检查styles.css入口文件
    console.log('\n📄 检查入口文件 styles.css:');
    const entryFile = path.join(__dirname, 'styles.css');
    if (fs.existsSync(entryFile)) {
        console.log('  ✓ styles.css 存在');
        const content = fs.readFileSync(entryFile, 'utf-8');
        const imports = content.match(/@import\s+url\(['"]([^'"]+)['"]\)/g) || [];
        console.log(`  ✓ 找到 ${imports.length} 个导入语句`);
    } else {
        errors.push('❌ styles.css 入口文件不存在');
    }
    
    // 输出结果
    console.log('\n' + '='.repeat(50));
    console.log('📊 验证结果汇总:');
    console.log('='.repeat(50));
    
    if (errors.length === 0 && warnings.length === 0) {
        console.log('✅ 所有检查通过！样式文件结构完整。\n');
        return 0;
    }
    
    if (warnings.length > 0) {
        console.log(`\n⚠️  警告 (${warnings.length}):`);
        warnings.forEach(w => console.log(`  ${w}`));
    }
    
    if (errors.length > 0) {
        console.log(`\n❌ 错误 (${errors.length}):`);
        errors.forEach(e => console.log(`  ${e}`));
        return 1;
    }
    
    return 0;
}

// 运行验证
if (require.main === module) {
    const exitCode = verifyStyles();
    process.exit(exitCode);
}

module.exports = { verifyStyles };

