/**
 * 批量应用现代化样式到所有页面
 * 只替换CSS类名,不修改任何功能
 */

const fs = require('fs');
const path = require('path');

// 样式类名映射表
const styleMapping = {
    // 卡片样式
    'class="card"': 'class="modern-card"',
    'class="card ': 'class="modern-card ',
    'className="card"': 'className="modern-card"',
    'className="card ': 'className="modern-card ',
    
    // 添加悬停效果
    'class="modern-card"': 'class="modern-card card-hover"',
    'className="modern-card"': 'className="modern-card card-hover"',
    
    // 徽章样式
    'class="badge"': 'class="badge badge-primary"',
    'className="badge"': 'className="badge badge-primary"',
    'class="status-badge': 'class="badge badge-',
    'className="status-badge': 'className="badge badge-',
    
    // 按钮样式保持不变(已经使用标准类名)
    
    // 统计卡片
    'class="stat-card"': 'class="stat-card stat-primary"',
    'className="stat-card"': 'className="stat-card stat-primary"',
    
    // 提示框
    'class="alert ': 'class="alert alert-',
    'className="alert ': 'className="alert alert-',
    
    // 表单组件(已经使用标准类名)
    
    // 列表组件
    'class="list"': 'class="modern-list"',
    'className="list"': 'className="modern-list"',
    
    // 进度条(已经使用标准类名)
};

// 需要更新的文件列表
const filesToUpdate = [
    'pages/DashboardPage.js',
    'pages/ConfigPage.js',
    'pages/TestingPage.js',
    'pages/DriversPage.js',
    'components/StatusIndicator.js',
    'components/QuickActions.js',
    'components/RealTimeMonitor.js',
    'components/LogViewer.js',
    'components/ProtocolTester.js',
    'components/DeviceScanner.js',
    'components/BatchTester.js',
    'components/TestResultsDisplay.js',
    'components/ConfigWizard.js',
    'components/BatchOperations.js',
    'components/DriverCard.js',
    'components/DriverScanner.js'
];

console.log('开始应用现代化样式...\n');

filesToUpdate.forEach(file => {
    const filePath = path.join(__dirname, file);
    
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  文件不存在: ${file}`);
        return;
    }
    
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;
        
        // 应用所有样式映射
        Object.entries(styleMapping).forEach(([oldStyle, newStyle]) => {
            if (content.includes(oldStyle)) {
                content = content.replace(new RegExp(oldStyle, 'g'), newStyle);
                modified = true;
            }
        });
        
        if (modified) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ 已更新: ${file}`);
        } else {
            console.log(`⏭️  无需更新: ${file}`);
        }
    } catch (error) {
        console.error(`❌ 更新失败: ${file}`, error.message);
    }
});

console.log('\n样式更新完成!');
console.log('\n请刷新浏览器查看效果: http://localhost:8093/');
