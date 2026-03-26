# 现代化样式指南

**创建日期**: 2025-10-28  
**版本**: 1.0.0  
**状态**: ✅ 已完成  

---

## 🎨 设计理念

### 核心原则
1. **简洁优雅**: 去除不必要的装饰，专注于内容
2. **现代感**: 使用渐变、阴影、动画等现代设计元素
3. **一致性**: 统一的视觉语言和交互模式
4. **响应式**: 适配各种屏幕尺寸
5. **可访问性**: 良好的对比度和可读性

---

## 🎯 组件样式

### 1. 卡片组件 (Card)

#### 特点
- 12px圆角，更加柔和
- 悬停时上浮效果 (translateY(-2px))
- 渐变背景的header
- 平滑的阴影过渡

#### 使用示例
```html
<div class="card">
    <div class="card-header">
        <h3>📊 标题</h3>
    </div>
    <div class="card-body">
        内容区域
    </div>
    <div class="card-footer">
        底部操作区
    </div>
</div>
```

---

### 2. 按钮组件 (Button)

#### 类型
- **btn-primary**: 主要操作，渐变紫色
- **btn-secondary**: 次要操作，灰色
- **btn-success**: 成功操作，绿色渐变
- **btn-danger**: 危险操作，红色渐变

#### 特点
- 波纹点击效果
- 悬停上浮动画
- 柔和的阴影

#### 使用示例
```html
<button class="btn btn-primary">
    <span>✨</span>
    主要按钮
</button>

<button class="btn btn-secondary btn-sm">
    小按钮
</button>

<button class="btn btn-success btn-lg">
    大按钮
</button>
```

---

### 3. 表单组件 (Form)

#### 特点
- 8px圆角
- 聚焦时蓝色光晕效果
- 平滑的过渡动画
- 清晰的错误提示

#### 使用示例
```html
<div class="form-group">
    <label class="form-label required">用户名</label>
    <input type="text" class="form-input" placeholder="请输入用户名">
    <span class="form-help">用户名长度为3-20个字符</span>
</div>

<div class="form-group">
    <label class="form-label">描述</label>
    <textarea class="form-textarea" placeholder="请输入描述"></textarea>
    <span class="form-error">描述不能为空</span>
</div>
```

---

### 4. 徽章组件 (Badge)

#### 类型
- **badge-primary**: 主要信息
- **badge-success**: 成功状态
- **badge-warning**: 警告状态
- **badge-danger**: 错误状态
- **badge-info**: 提示信息

#### 使用示例
```html
<span class="badge badge-success">
    <span>✓</span>
    在线
</span>

<span class="badge badge-warning">
    <span>⚠</span>
    警告
</span>
```

---

### 5. 状态指示器 (Status Indicator)

#### 特点
- 脉动动画的状态点
- 圆润的外观
- 清晰的颜色区分

#### 使用示例
```html
<div class="status-indicator online">
    <span class="status-dot"></span>
    在线
</div>

<div class="status-indicator offline">
    <span class="status-dot"></span>
    离线
</div>

<div class="status-indicator error">
    <span class="status-dot"></span>
    错误
</div>
```

---

### 6. 表格组件 (Table)

#### 特点
- 渐变表头
- 悬停行高亮
- 圆角容器
- 清晰的分隔线

#### 使用示例
```html
<div class="table-container">
    <table class="table">
        <thead>
            <tr>
                <th>ID</th>
                <th>名称</th>
                <th>状态</th>
                <th>操作</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>001</td>
                <td>设备A</td>
                <td><span class="badge badge-success">在线</span></td>
                <td><button class="btn btn-sm">查看</button></td>
            </tr>
        </tbody>
    </table>
</div>
```

---

### 7. 标签页组件 (Tabs)

#### 特点
- 底部边框指示器
- 平滑的颜色过渡
- 悬停背景效果

#### 使用示例
```html
<div class="tabs">
    <button class="tab active">基本信息</button>
    <button class="tab">高级设置</button>
    <button class="tab">日志记录</button>
</div>
```

---

### 8. 进度条组件 (Progress)

#### 特点
- 渐变填充
- 闪烁动画效果
- 平滑的宽度过渡

#### 使用示例
```html
<div class="progress">
    <div class="progress-bar" style="width: 60%"></div>
</div>
```

---

### 9. 提示框组件 (Alert)

#### 类型
- **alert-info**: 信息提示
- **alert-success**: 成功提示
- **alert-warning**: 警告提示
- **alert-error**: 错误提示

#### 使用示例
```html
<div class="alert alert-success">
    <span class="alert-icon">✓</span>
    <div class="alert-content">
        <div class="alert-title">操作成功</div>
        <div class="alert-message">数据已成功保存</div>
    </div>
</div>

<div class="alert alert-warning">
    <span class="alert-icon">⚠</span>
    <div class="alert-content">
        <div class="alert-title">注意</div>
        <div class="alert-message">此操作不可撤销</div>
    </div>
</div>
```

---

### 10. 模态框组件 (Modal)

#### 特点
- 背景模糊效果
- 上滑入场动画
- 圆角设计
- 阴影层次

#### 使用示例
```html
<div class="modal-overlay">
    <div class="modal">
        <div class="modal-header">
            <h3 class="modal-title">标题</h3>
            <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
            内容区域
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary">取消</button>
            <button class="btn btn-primary">确定</button>
        </div>
    </div>
</div>
```

---

## 🎨 颜色系统

### 主色调
```css
--color-primary: #667eea (紫色)
--color-success: #10b981 (绿色)
--color-warning: #f59e0b (橙色)
--color-error: #ef4444 (红色)
--color-info: #06b6d4 (青色)
```

### 渐变效果
```css
/* 主要渐变 */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* 成功渐变 */
background: linear-gradient(135deg, #10b981 0%, #059669 100%);

/* 危险渐变 */
background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
```

---

## 🎭 动画效果

### 1. 淡入动画
```css
@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}
```

### 2. 上滑动画
```css
@keyframes slideUp {
    from {
        transform: translateY(20px);
        opacity: 0;
    }
    to {
        transform: translateY(0);
        opacity: 1;
    }
}
```

### 3. 脉动动画
```css
@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}
```

### 4. 旋转动画
```css
@keyframes spin {
    to { transform: rotate(360deg); }
}
```

### 5. 闪烁动画
```css
@keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
}
```

---

## 📐 间距系统

### 标准间距
```css
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-5: 20px
--space-6: 24px
--space-8: 32px
```

### 使用建议
- **组件内部**: 使用较小间距 (4-12px)
- **组件之间**: 使用中等间距 (16-24px)
- **区块之间**: 使用较大间距 (24-32px)

---

## 🔤 字体系统

### 字体大小
```css
--font-size-xs: 12px
--font-size-sm: 13px
--font-size-base: 14px
--font-size-lg: 16px
--font-size-xl: 18px
--font-size-2xl: 20px
```

### 字重
```css
--font-weight-normal: 400
--font-weight-medium: 500
--font-weight-semibold: 600
--font-weight-bold: 700
```

---

## 🎯 最佳实践

### 1. 卡片使用
- 用于包含相关内容的容器
- 保持适当的内边距
- 使用header区分标题和内容

### 2. 按钮使用
- 主要操作使用btn-primary
- 次要操作使用btn-secondary
- 危险操作使用btn-danger
- 保持按钮文字简洁

### 3. 表单使用
- 必填字段添加required类
- 提供清晰的帮助文本
- 错误提示要明确具体

### 4. 颜色使用
- 保持颜色语义一致
- 避免过度使用鲜艳颜色
- 确保足够的对比度

### 5. 动画使用
- 保持动画时长适中 (0.2-0.3s)
- 使用缓动函数增加自然感
- 避免过度动画影响性能

---

## 📱 响应式设计

### 断点
```css
/* 移动端 */
@media (max-width: 768px) { }

/* 平板端 */
@media (max-width: 1024px) { }

/* 桌面端 */
@media (min-width: 1025px) { }
```

### 适配策略
- 移动端: 单列布局
- 平板端: 双列布局
- 桌面端: 多列布局

---

## 🚀 性能优化

### CSS优化
1. 使用CSS变量减少重复
2. 合理使用will-change
3. 避免复杂的选择器
4. 使用transform代替position

### 动画优化
1. 优先使用transform和opacity
2. 使用requestAnimationFrame
3. 避免同时动画过多元素
4. 使用GPU加速

---

## ✅ 检查清单

### 组件开发
- [ ] 使用统一的圆角 (8-12px)
- [ ] 添加适当的过渡动画
- [ ] 实现悬停状态
- [ ] 支持禁用状态
- [ ] 响应式适配

### 样式规范
- [ ] 使用CSS变量
- [ ] 遵循命名规范
- [ ] 添加注释说明
- [ ] 测试不同主题
- [ ] 验证可访问性

---

**文档版本**: 1.0.0  
**最后更新**: 2025-10-28  
**维护者**: Kiro AI Assistant  
