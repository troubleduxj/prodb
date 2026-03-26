# 布局遮挡问题 - 快速修复指南

## ✅ 问题已修复！

主显示区左侧被菜单栏遮挡的问题已经解决。

---

## 🚀 立即验证

### 方法1: 访问测试页面
```
http://localhost:8093/test-layout-overlap-fix.html
```
这个页面会自动检测布局是否正确，并显示实时状态。

### 方法2: 刷新当前页面
1. 按 **Ctrl+F5** (Windows) 或 **Cmd+Shift+R** (Mac) 强制刷新
2. 检查左侧内容是否完全可见

---

## 🔧 修复内容

在 `collector/frontend/styles/main.css` 中添加了：

```css
@media (max-width: 1024px) {
    .main-content {
        margin-left: 200px;
        width: calc(100% - 200px);  /* ← 新增这一行 */
        padding: var(--space-6);
    }
}
```

---

## ✅ 验证清单

- [ ] 左边缘内容完全可见
- [ ] 表格第一列不被遮挡
- [ ] 卡片左侧不被遮挡
- [ ] 没有不必要的水平滚动条
- [ ] 调整窗口大小时布局正确响应

---

## 💡 如果问题仍然存在

### 1. 清除浏览器缓存
- Chrome: Ctrl+Shift+Delete
- Firefox: Ctrl+Shift+Delete
- Edge: Ctrl+Shift+Delete

### 2. 重启采集器
```batch
cd collector
restart-collector.bat
```

### 3. 检查CSS文件
确认 `collector/frontend/styles/main.css` 包含修复代码

---

## 📊 布局规格

| 屏幕尺寸 | 侧边栏宽度 | 主内容区margin-left | 主内容区width |
|---------|-----------|-------------------|--------------|
| > 1024px | 240px | 240px | calc(100% - 240px) |
| 768-1024px | 200px | 200px | calc(100% - 200px) ✅ |
| < 768px | 隐藏 | 0 | 100% |

---

## 📞 需要帮助？

查看详细文档: `collector/frontend/LAYOUT_OVERLAP_FIX.md`
