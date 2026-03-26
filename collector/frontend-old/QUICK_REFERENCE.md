# 前端现代化改造 - 快速参考

## 🚀 快速开始

### 1. 测试已完成的更新
```bash
cd collector/frontend
verify-dashboard-update.bat
```

### 2. 在浏览器中查看
- 仪表盘: http://localhost:8093/#/dashboard
- 样式测试: http://localhost:8093/test-modern-ui.html

---

## 📝 更新其他页面

### ConfigPage.js
```powershell
$content = Get-Content "collector/frontend/pages/ConfigPage.js" -Raw -Encoding UTF8
$content = $content -replace 'class="card"', 'class="modern-card card-hover"'
[System.IO.File]::WriteAllText("collector/frontend/pages/ConfigPage.js", $content, [System.Text.UTF8Encoding]::new($false))
```

### TestingPage.js
```powershell
$content = Get-Content "collector/frontend/pages/TestingPage.js" -Raw -Encoding UTF8
$content = $content -replace 'class="card"', 'class="modern-card card-hover"'
[System.IO.File]::WriteAllText("collector/frontend/pages/TestingPage.js", $content, [System.Text.UTF8Encoding]::new($false))
```

### DriversPage.js
```powershell
$content = Get-Content "collector/frontend/pages/DriversPage.js" -Raw -Encoding UTF8
$content = $content -replace 'class="card"', 'class="modern-card card-hover"'
[System.IO.File]::WriteAllText("collector/frontend/pages/DriversPage.js", $content, [System.Text.UTF8Encoding]::new($false))
```

---

## 🎨 常用样式类

### 卡片
```html
<div class="modern-card card-hover">...</div>
<div class="modern-card card-gradient">...</div>
```

### 徽章
```html
<span class="badge badge-primary">主要</span>
<span class="badge badge-success">成功</span>
<span class="badge badge-warning">警告</span>
<span class="badge badge-error">错误</span>
```

### 统计卡片
```html
<div class="stat-card stat-primary">...</div>
<div class="stat-card stat-success">...</div>
```

### 提示框
```html
<div class="alert alert-info">...</div>
<div class="alert alert-success">...</div>
```

---

## 📚 文档

- `WORK_COMPLETED_SUMMARY.md` - 工作总结
- `MODERNIZATION_STATUS.md` - 当前状态
- `MODERNIZATION_COMPLETE_GUIDE.md` - 完整指南
- `MODERN_STYLE_GUIDE.md` - 样式指南

---

## ✅ 测试清单

- [ ] 页面加载正常
- [ ] 所有按钮可点击
- [ ] 样式现代化
- [ ] 悬停效果正常
- [ ] 响应式布局正常
- [ ] 无控制台错误
