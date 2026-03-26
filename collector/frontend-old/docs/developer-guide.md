# ProDB Collector Frontend 开发者文档

## 目录

1. [架构概述](#架构概述)
2. [技术栈](#技术栈)
3. [项目结构](#项目结构)
4. [开发环境设置](#开发环境设置)
5. [组件开发](#组件开发)
6. [API集成](#api集成)
7. [状态管理](#状态管理)
8. [样式系统](#样式系统)
9. [PWA功能](#pwa功能)
10. [性能优化](#性能优化)
11. [测试](#测试)
12. [部署](#部署)
13. [扩展开发](#扩展开发)

## 架构概述

ProDB Collector Frontend 采用现代化的前端架构，基于组件化设计和渐进式Web应用技术。

### 设计原则

- **轻量化**: 无构建工具，直接运行
- **模块化**: ES6模块系统，组件化开发
- **响应式**: 移动端优先的响应式设计
- **离线优先**: PWA技术，支持离线操作
- **性能优化**: 懒加载、缓存策略、资源优化

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    ProDB Collector Frontend                 │
├─────────────────────────────────────────────────────────────┤
│  Presentation Layer (UI Components)                        │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐  │
│  │ Dashboard   │ Testing     │ Config      │ Drivers     │  │
│  │ Page        │ Page        │ Page        │ Page        │  │
│  └─────────────┴─────────────┴─────────────┴─────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  Component Layer                                            │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐  │
│  │ Layout      │ Status      │ Protocol    │ Config      │  │
│  │ Components  │ Indicators  │ Testers     │ Wizards     │  │
│  └─────────────┴─────────────┴─────────────┴─────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  Service Layer                                              │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐  │
│  │ API         │ Protocols   │ Drivers     │ Offline     │  │
│  │ Service     │ Service     │ Service     │ Manager     │  │
│  └─────────────┴─────────────┴─────────────┴─────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  Utility Layer                                             │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐  │
│  │ Validation  │ Helpers     │ Performance │ Security    │  │
│  │ Utils       │ Utils       │ Utils       │ Utils       │  │
│  └─────────────┴─────────────┴─────────────┴─────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  Infrastructure Layer                                      │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐  │
│  │ Service     │ Cache       │ Network     │ State       │  │
│  │ Worker      │ Manager     │ Manager     │ Manager     │  │
│  └─────────────┴─────────────┴─────────────┴─────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 技术栈

### 核心技术

- **Preact**: 轻量级React替代方案 (3KB)
- **HTM**: JSX替代方案，无需构建工具
- **ES6 Modules**: 原生模块系统
- **CSS Variables**: 现代CSS特性
- **Service Worker**: PWA离线功能
- **Web APIs**: 现代浏览器API

### 开发工具

- **无构建工具**: 直接在浏览器中运行
- **ES6+**: 现代JavaScript特性
- **CSS Grid/Flexbox**: 现代布局技术
- **Fetch API**: 网络请求
- **LocalStorage**: 本地数据存储

### 外部依赖

```javascript
// CDN导入的依赖
import { render } from 'https://esm.sh/preact';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';
import { html } from 'https://esm.sh/htm/preact';
```

## 项目结构

```
collector/frontend/
├── index.html              # 主HTML文件
├── app.js                  # 应用入口点
├── manifest.json           # PWA清单文件
├── sw.js                   # Service Worker
├── package.json            # 项目配置
├── deploy.js               # 部署脚本
│
├── styles/                 # 样式文件
│   ├── main.css           # 主样式文件
│   ├── components.css     # 组件样式
│   ├── themes.css         # 主题样式
│   ├── mobile-optimization.css
│   ├── ux-enhancements.css
│   ├── performance.css
│   ├── security-enhancements.css
│   └── privacy-protection.css
│
├── components/             # UI组件
│   ├── Layout.js          # 布局组件
│   ├── StatusIndicator.js # 状态指示器
│   ├── QuickActions.js    # 快速操作
│   ├── ProtocolTester.js  # 协议测试器
│   ├── ConfigWizard.js    # 配置向导
│   ├── Modal.js           # 模态框
│   ├── Dialog.js          # 对话框
│   ├── Form.js            # 表单组件
│   └── ...                # 其他组件
│
├── pages/                  # 页面组件
│   ├── DashboardPage.js   # 仪表板页面
│   ├── TestingPage.js     # 测试页面
│   ├── ConfigPage.js      # 配置页面
│   └── DriversPage.js     # 驱动页面
│
├── services/               # 服务层
│   ├── api.js             # API服务
│   ├── protocols.js       # 协议服务
│   ├── drivers.js         # 驱动服务
│   ├── offline-manager.js # 离线管理
│   └── network-aware-api.js
│
├── utils/                  # 工具函数
│   ├── helpers.js         # 通用工具
│   ├── validation.js      # 验证工具
│   ├── performance.js     # 性能工具
│   └── lazy-loader.js     # 懒加载工具
│
├── build/                  # 构建工具
│   ├── build-config.js    # 构建配置
│   ├── optimize-resources.js
│   └── analyze-bundle.js  # 包分析工具
│
├── docs/                   # 文档
│   ├── user-manual.md     # 用户手册
│   ├── developer-guide.md # 开发指南
│   ├── api-reference.md   # API参考
│   └── deployment-guide.md
│
└── test/                   # 测试文件
    ├── components/        # 组件测试
    ├── services/          # 服务测试
    ├── utils/             # 工具测试
    └── integration/       # 集成测试
```

## 开发环境设置

### 前置要求

- 现代浏览器 (Chrome 80+, Firefox 75+, Safari 13+, Edge 80+)
- 本地HTTP服务器 (Python、Node.js或其他)
- 文本编辑器或IDE

### 快速开始

1. **克隆项目**
```bash
git clone <repository-url>
cd collector/frontend
```

2. **启动开发服务器**
```bash
# 使用Python
python -m http.server 8080

# 或使用Node.js
npx serve -p 8080

# 或使用PHP
php -S localhost:8080
```

3. **访问应用**
打开浏览器访问 `http://localhost:8080`

### 开发工具配置

#### VS Code配置

推荐的VS Code扩展：

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense"
  ]
}
```

#### 调试配置

启用调试模式：

```javascript
// 在浏览器控制台中执行
localStorage.setItem('debug', 'true');
localStorage.setItem('verbose', 'true');
location.reload();
```

## 组件开发

### 组件结构

标准组件结构：

```javascript
// components/ExampleComponent.js
import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';

/**
 * 示例组件
 * @param {Object} props - 组件属性
 * @param {string} props.title - 标题
 * @param {Function} props.onAction - 动作回调
 */
const ExampleComponent = ({ title, onAction, ...props }) => {
    const [state, setState] = useState(null);
    const [loading, setLoading] = useState(false);

    // 副作用处理
    useEffect(() => {
        // 组件挂载时的逻辑
        return () => {
            // 清理逻辑
        };
    }, []);

    // 事件处理
    const handleClick = () => {
        setLoading(true);
        onAction?.()
            .finally(() => setLoading(false));
    };

    // 渲染
    return html`
        <div class="example-component" ...${props}>
            <h2>${title}</h2>
            <button 
                onClick=${handleClick} 
                disabled=${loading}
                class="btn btn-primary"
            >
                ${loading ? 'Loading...' : 'Action'}
            </button>
        </div>
    `;
};

export default ExampleComponent;
```

### 组件最佳实践

#### 1. 属性验证

```javascript
// 使用JSDoc进行类型注释
/**
 * @typedef {Object} ComponentProps
 * @property {string} title - 组件标题
 * @property {boolean} [loading] - 加载状态
 * @property {Function} [onAction] - 动作回调
 */

/**
 * @param {ComponentProps} props
 */
const Component = (props) => {
    // 属性默认值
    const {
        title = 'Default Title',
        loading = false,
        onAction = () => {}
    } = props;
    
    // 运行时验证（开发模式）
    if (process.env.NODE_ENV === 'development') {
        if (typeof title !== 'string') {
            console.warn('Component: title should be a string');
        }
    }
    
    // 组件逻辑...
};
```

#### 2. 状态管理

```javascript
// 复杂状态使用useReducer
import { useReducer } from 'https://esm.sh/preact/hooks';

const initialState = {
    data: null,
    loading: false,
    error: null
};

const reducer = (state, action) => {
    switch (action.type) {
        case 'FETCH_START':
            return { ...state, loading: true, error: null };
        case 'FETCH_SUCCESS':
            return { ...state, loading: false, data: action.payload };
        case 'FETCH_ERROR':
            return { ...state, loading: false, error: action.payload };
        default:
            return state;
    }
};

const Component = () => {
    const [state, dispatch] = useReducer(reducer, initialState);
    
    const fetchData = async () => {
        dispatch({ type: 'FETCH_START' });
        try {
            const data = await api.getData();
            dispatch({ type: 'FETCH_SUCCESS', payload: data });
        } catch (error) {
            dispatch({ type: 'FETCH_ERROR', payload: error.message });
        }
    };
    
    // 组件逻辑...
};
```

#### 3. 性能优化

```javascript
import { memo, useMemo, useCallback } from 'https://esm.sh/preact/compat';

// 使用memo避免不必要的重渲染
const OptimizedComponent = memo(({ data, onUpdate }) => {
    // 使用useMemo缓存计算结果
    const processedData = useMemo(() => {
        return data.map(item => ({
            ...item,
            processed: true
        }));
    }, [data]);
    
    // 使用useCallback缓存函数
    const handleUpdate = useCallback((id) => {
        onUpdate(id);
    }, [onUpdate]);
    
    return html`
        <div>
            ${processedData.map(item => html`
                <div key=${item.id} onClick=${() => handleUpdate(item.id)}>
                    ${item.name}
                </div>
            `)}
        </div>
    `;
});
```

### 自定义Hooks

创建可复用的逻辑：

```javascript
// hooks/useApi.js
import { useState, useEffect } from 'https://esm.sh/preact/hooks';
import { api } from '../services/api.js';

/**
 * API数据获取Hook
 * @param {string} endpoint - API端点
 * @param {Object} options - 选项
 */
export const useApi = (endpoint, options = {}) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    const { 
        immediate = true, 
        dependencies = [],
        transform = (data) => data 
    } = options;
    
    const fetchData = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const response = await api.get(endpoint);
            const transformedData = transform(response);
            setData(transformedData);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        if (immediate) {
            fetchData();
        }
    }, [endpoint, ...dependencies]);
    
    return {
        data,
        loading,
        error,
        refetch: fetchData
    };
};

// 使用示例
const Component = () => {
    const { data, loading, error, refetch } = useApi('/api/v1/status', {
        transform: (data) => ({
            ...data,
            uptime: formatUptime(data.uptime)
        })
    });
    
    if (loading) return html`<div>Loading...</div>`;
    if (error) return html`<div>Error: ${error}</div>`;
    
    return html`
        <div>
            <h2>Status: ${data.status}</h2>
            <p>Uptime: ${data.uptime}</p>
            <button onClick=${refetch}>Refresh</button>
        </div>
    `;
};
```

## API集成

### API服务架构

```javascript
// services/api.js
class ApiService {
    constructor(baseURL = '') {
        this.baseURL = baseURL;
        this.defaultHeaders = {
            'Content-Type': 'application/json'
        };
    }
    
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: { ...this.defaultHeaders, ...options.headers },
            ...options
        };
        
        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            
            return await response.text();
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }
    
    get(endpoint, params = {}) {
        const url = new URL(endpoint, this.baseURL);
        Object.keys(params).forEach(key => {
            url.searchParams.append(key, params[key]);
        });
        
        return this.request(url.pathname + url.search);
    }
    
    post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
    
    put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }
    
    delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }
}

export const api = new ApiService('/api/v1');
```

### 错误处理

```javascript
// utils/error-handler.js
export class ApiError extends Error {
    constructor(message, status, response) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.response = response;
    }
}

export const handleApiError = (error) => {
    if (error instanceof ApiError) {
        switch (error.status) {
            case 401:
                // 处理认证错误
                return '认证失败，请重新登录';
            case 403:
                // 处理权限错误
                return '权限不足';
            case 404:
                // 处理资源不存在
                return '请求的资源不存在';
            case 500:
                // 处理服务器错误
                return '服务器内部错误';
            default:
                return error.message;
        }
    }
    
    if (error.name === 'NetworkError') {
        return '网络连接失败';
    }
    
    return '未知错误';
};
```

### 请求拦截器

```javascript
// services/interceptors.js
export const requestInterceptor = (config) => {
    // 添加认证token
    const token = localStorage.getItem('auth_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    
    // 添加请求ID用于追踪
    config.headers['X-Request-ID'] = generateRequestId();
    
    // 记录请求日志
    console.log('API Request:', config);
    
    return config;
};

export const responseInterceptor = (response) => {
    // 记录响应日志
    console.log('API Response:', response);
    
    // 处理特殊响应头
    const requestId = response.headers.get('X-Request-ID');
    if (requestId) {
        console.log('Request ID:', requestId);
    }
    
    return response;
};
```

## 状态管理

### 全局状态管理

```javascript
// stores/global-store.js
import { signal } from 'https://esm.sh/@preact/signals';

// 全局状态
export const globalState = {
    // 系统状态
    systemStatus: signal(null),
    
    // 接口列表
    interfaces: signal([]),
    
    // 用户设置
    userSettings: signal({
        theme: 'dark',
        language: 'zh-CN',
        refreshInterval: 5000
    }),
    
    // 通知
    notifications: signal([])
};

// 状态操作
export const actions = {
    updateSystemStatus(status) {
        globalState.systemStatus.value = status;
    },
    
    addInterface(interface) {
        globalState.interfaces.value = [
            ...globalState.interfaces.value,
            interface
        ];
    },
    
    updateInterface(id, updates) {
        globalState.interfaces.value = globalState.interfaces.value.map(
            iface => iface.id === id ? { ...iface, ...updates } : iface
        );
    },
    
    removeInterface(id) {
        globalState.interfaces.value = globalState.interfaces.value.filter(
            iface => iface.id !== id
        );
    },
    
    addNotification(notification) {
        const newNotification = {
            id: Date.now(),
            timestamp: new Date(),
            ...notification
        };
        
        globalState.notifications.value = [
            ...globalState.notifications.value,
            newNotification
        ];
        
        // 自动移除通知
        setTimeout(() => {
            actions.removeNotification(newNotification.id);
        }, notification.duration || 5000);
    },
    
    removeNotification(id) {
        globalState.notifications.value = globalState.notifications.value.filter(
            notification => notification.id !== id
        );
    }
};
```

### 本地存储管理

```javascript
// utils/storage.js
class StorageManager {
    constructor(prefix = 'prodb_') {
        this.prefix = prefix;
    }
    
    set(key, value) {
        try {
            const serialized = JSON.stringify(value);
            localStorage.setItem(this.prefix + key, serialized);
        } catch (error) {
            console.error('Storage set error:', error);
        }
    }
    
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(this.prefix + key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('Storage get error:', error);
            return defaultValue;
        }
    }
    
    remove(key) {
        localStorage.removeItem(this.prefix + key);
    }
    
    clear() {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith(this.prefix)) {
                localStorage.removeItem(key);
            }
        });
    }
    
    // 监听存储变化
    onChange(callback) {
        window.addEventListener('storage', (event) => {
            if (event.key && event.key.startsWith(this.prefix)) {
                const key = event.key.replace(this.prefix, '');
                callback(key, event.newValue, event.oldValue);
            }
        });
    }
}

export const storage = new StorageManager();
```

## 样式系统

### CSS变量系统

```css
/* styles/main.css */
:root {
    /* 颜色系统 */
    --color-primary: #2563eb;
    --color-primary-hover: #1d4ed8;
    --color-success: #10b981;
    --color-warning: #f59e0b;
    --color-error: #ef4444;
    --color-info: #06b6d4;
    
    /* 背景色 */
    --bg-primary: #0f172a;
    --bg-secondary: #1e293b;
    --bg-tertiary: #334155;
    --bg-card: #1e293b;
    
    /* 文字颜色 */
    --text-primary: #f8fafc;
    --text-secondary: #cbd5e1;
    --text-muted: #64748b;
    
    /* 间距系统 */
    --space-1: 0.25rem;
    --space-2: 0.5rem;
    --space-3: 0.75rem;
    --space-4: 1rem;
    --space-6: 1.5rem;
    --space-8: 2rem;
    
    /* 字体系统 */
    --font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    --font-size-sm: 0.875rem;
    --font-size-base: 1rem;
    --font-size-lg: 1.125rem;
    --font-size-xl: 1.25rem;
    
    /* 边框和阴影 */
    --border-radius: 8px;
    --border-color: #334155;
    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
}

/* 主题切换 */
[data-theme="light"] {
    --bg-primary: #ffffff;
    --bg-secondary: #f8fafc;
    --bg-tertiary: #e2e8f0;
    --text-primary: #1e293b;
    --text-secondary: #475569;
    --border-color: #e2e8f0;
}
```

### 组件样式

```css
/* styles/components.css */

/* 按钮组件 */
.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-2) var(--space-4);
    border: none;
    border-radius: var(--border-radius);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    text-decoration: none;
}

.btn-primary {
    background-color: var(--color-primary);
    color: white;
}

.btn-primary:hover {
    background-color: var(--color-primary-hover);
}

.btn-secondary {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
}

.btn-secondary:hover {
    background-color: var(--bg-hover);
}

/* 卡片组件 */
.card {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: var(--space-6);
    box-shadow: var(--shadow-sm);
    transition: all 0.2s ease;
}

.card:hover {
    box-shadow: var(--shadow-md);
    border-color: var(--color-primary);
}

/* 状态指示器 */
.status-indicator {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-3);
    border-radius: 9999px;
    font-size: var(--font-size-sm);
    font-weight: 500;
}

.status-indicator.connected {
    background-color: rgba(16, 185, 129, 0.1);
    color: var(--color-success);
}

.status-indicator.disconnected {
    background-color: rgba(245, 158, 11, 0.1);
    color: var(--color-warning);
}

.status-indicator.error {
    background-color: rgba(239, 68, 68, 0.1);
    color: var(--color-error);
}
```

### 响应式设计

```css
/* 响应式断点 */
@media (max-width: 768px) {
    .layout {
        flex-direction: column;
    }
    
    .sidebar {
        width: 100%;
        padding: var(--space-4);
    }
    
    .main-content {
        padding: var(--space-4);
    }
    
    .grid-cols-2,
    .grid-cols-3,
    .grid-cols-4 {
        grid-template-columns: 1fr;
    }
    
    .btn {
        width: 100%;
        justify-content: center;
    }
}

@media (max-width: 480px) {
    :root {
        --space-4: 0.75rem;
        --space-6: 1rem;
        --space-8: 1.5rem;
    }
    
    .card {
        padding: var(--space-4);
    }
    
    .btn {
        padding: var(--space-3) var(--space-4);
    }
}
```

## PWA功能

### Service Worker开发

Service Worker提供离线功能和缓存管理：

```javascript
// sw.js 核心功能
const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE = 'prodb-static-' + CACHE_VERSION;
const DYNAMIC_CACHE = 'prodb-dynamic-' + CACHE_VERSION;

// 缓存策略
const cacheStrategies = {
    // 静态资源：缓存优先
    cacheFirst: async (request) => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request);
        
        if (cached) {
            return cached;
        }
        
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
        }
        
        return response;
    },
    
    // API请求：网络优先
    networkFirst: async (request) => {
        try {
            const response = await fetch(request);
            
            if (response.ok) {
                const cache = await caches.open(DYNAMIC_CACHE);
                cache.put(request, response.clone());
            }
            
            return response;
        } catch (error) {
            const cache = await caches.open(DYNAMIC_CACHE);
            const cached = await cache.match(request);
            
            if (cached) {
                return cached;
            }
            
            throw error;
        }
    }
};
```

### 离线数据管理

```javascript
// services/offline-manager.js
class OfflineManager {
    constructor() {
        this.queue = [];
        this.isOnline = navigator.onLine;
        
        // 监听网络状态
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.processQueue();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
        });
    }
    
    // 添加离线操作到队列
    addToQueue(operation) {
        this.queue.push({
            ...operation,
            timestamp: Date.now(),
            id: this.generateId()
        });
        
        // 保存到本地存储
        this.saveQueue();
    }
    
    // 处理离线队列
    async processQueue() {
        if (!this.isOnline || this.queue.length === 0) {
            return;
        }
        
        const operations = [...this.queue];
        this.queue = [];
        
        for (const operation of operations) {
            try {
                await this.executeOperation(operation);
                console.log('Offline operation synced:', operation.id);
            } catch (error) {
                console.error('Failed to sync operation:', operation.id, error);
                // 重新加入队列
                this.queue.push(operation);
            }
        }
        
        this.saveQueue();
    }
    
    // 执行操作
    async executeOperation(operation) {
        switch (operation.type) {
            case 'UPDATE_CONFIG':
                return await api.put(`/interfaces/${operation.data.id}`, operation.data);
            case 'CREATE_INTERFACE':
                return await api.post('/interfaces', operation.data);
            case 'DELETE_INTERFACE':
                return await api.delete(`/interfaces/${operation.data.id}`);
            default:
                throw new Error(`Unknown operation type: ${operation.type}`);
        }
    }
    
    // 保存队列到本地存储
    saveQueue() {
        localStorage.setItem('offline_queue', JSON.stringify(this.queue));
    }
    
    // 从本地存储加载队列
    loadQueue() {
        const saved = localStorage.getItem('offline_queue');
        if (saved) {
            this.queue = JSON.parse(saved);
        }
    }
    
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

export const offlineManager = new OfflineManager();
```

### 推送通知

```javascript
// services/notification-service.js
class NotificationService {
    constructor() {
        this.permission = Notification.permission;
    }
    
    // 请求通知权限
    async requestPermission() {
        if ('Notification' in window) {
            this.permission = await Notification.requestPermission();
            return this.permission === 'granted';
        }
        return false;
    }
    
    // 显示通知
    show(title, options = {}) {
        if (this.permission !== 'granted') {
            console.warn('Notification permission not granted');
            return;
        }
        
        const notification = new Notification(title, {
            icon: '/icon-192.png',
            badge: '/badge-72.png',
            tag: options.tag || 'default',
            ...options
        });
        
        // 自动关闭
        if (options.autoClose !== false) {
            setTimeout(() => {
                notification.close();
            }, options.duration || 5000);
        }
        
        return notification;
    }
    
    // 显示系统通知
    showSystemNotification(message, type = 'info') {
        const icons = {
            info: '💡',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        };
        
        return this.show(`${icons[type]} ProDB Collector`, {
            body: message,
            tag: type
        });
    }
}

export const notificationService = new NotificationService();
```

## 性能优化

### 懒加载实现

```javascript
// utils/lazy-loader.js
class LazyLoader {
    constructor() {
        this.cache = new Map();
        this.loading = new Set();
    }
    
    // 懒加载组件
    async loadComponent(path) {
        if (this.cache.has(path)) {
            return this.cache.get(path);
        }
        
        if (this.loading.has(path)) {
            // 等待正在加载的组件
            return new Promise((resolve) => {
                const checkLoaded = () => {
                    if (this.cache.has(path)) {
                        resolve(this.cache.get(path));
                    } else {
                        setTimeout(checkLoaded, 10);
                    }
                };
                checkLoaded();
            });
        }
        
        this.loading.add(path);
        
        try {
            const module = await import(path);
            const component = module.default || module;
            
            this.cache.set(path, component);
            this.loading.delete(path);
            
            return component;
        } catch (error) {
            this.loading.delete(path);
            throw error;
        }
    }
    
    // 预加载组件
    preload(paths) {
        paths.forEach(path => {
            if (!this.cache.has(path) && !this.loading.has(path)) {
                this.loadComponent(path).catch(console.error);
            }
        });
    }
    
    // 清理缓存
    clearCache() {
        this.cache.clear();
    }
}

export const lazyLoader = new LazyLoader();

// 懒加载Hook
export const useLazyComponent = (path) => {
    const [component, setComponent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    useEffect(() => {
        lazyLoader.loadComponent(path)
            .then(comp => {
                setComponent(() => comp);
                setLoading(false);
            })
            .catch(err => {
                setError(err);
                setLoading(false);
            });
    }, [path]);
    
    return { component, loading, error };
};
```

### 虚拟滚动

```javascript
// components/VirtualScrollList.js
import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect, useRef } from 'https://esm.sh/preact/hooks';

const VirtualScrollList = ({ 
    items, 
    itemHeight, 
    containerHeight, 
    renderItem,
    overscan = 5 
}) => {
    const [scrollTop, setScrollTop] = useState(0);
    const containerRef = useRef();
    
    // 计算可见范围
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
        items.length - 1,
        Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );
    
    const visibleItems = items.slice(startIndex, endIndex + 1);
    
    // 处理滚动
    const handleScroll = (e) => {
        setScrollTop(e.target.scrollTop);
    };
    
    // 总高度
    const totalHeight = items.length * itemHeight;
    
    // 偏移量
    const offsetY = startIndex * itemHeight;
    
    return html`
        <div 
            ref=${containerRef}
            class="virtual-scroll-container"
            style=${{ height: containerHeight + 'px', overflow: 'auto' }}
            onScroll=${handleScroll}
        >
            <div style=${{ height: totalHeight + 'px', position: 'relative' }}>
                <div style=${{ transform: \`translateY(\${offsetY}px)\` }}>
                    ${visibleItems.map((item, index) => 
                        renderItem(item, startIndex + index)
                    )}
                </div>
            </div>
        </div>
    `;
};

export default VirtualScrollList;
```

### 防抖和节流

```javascript
// utils/performance.js

// 防抖函数
export const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
};

// 节流函数
export const throttle = (func, limit) => {
    let inThrottle;
    return (...args) => {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

// 防抖Hook
export const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    
    return debouncedValue;
};

// 节流Hook
export const useThrottle = (value, limit) => {
    const [throttledValue, setThrottledValue] = useState(value);
    const lastRan = useRef(Date.now());
    
    useEffect(() => {
        const handler = setTimeout(() => {
            if (Date.now() - lastRan.current >= limit) {
                setThrottledValue(value);
                lastRan.current = Date.now();
            }
        }, limit - (Date.now() - lastRan.current));
        
        return () => {
            clearTimeout(handler);
        };
    }, [value, limit]);
    
    return throttledValue;
};
```

## 测试

### 单元测试框架

```javascript
// test/test-framework.js
class TestFramework {
    constructor() {
        this.tests = [];
        this.results = [];
    }
    
    // 定义测试
    test(name, testFn) {
        this.tests.push({ name, testFn });
    }
    
    // 运行所有测试
    async runAll() {
        console.log('🧪 Running tests...\n');
        
        for (const test of this.tests) {
            try {
                await test.testFn();
                this.results.push({ name: test.name, status: 'passed' });
                console.log(`✅ ${test.name}`);
            } catch (error) {
                this.results.push({ 
                    name: test.name, 
                    status: 'failed', 
                    error: error.message 
                });
                console.log(`❌ ${test.name}: ${error.message}`);
            }
        }
        
        this.printSummary();
    }
    
    // 打印测试摘要
    printSummary() {
        const passed = this.results.filter(r => r.status === 'passed').length;
        const failed = this.results.filter(r => r.status === 'failed').length;
        
        console.log(`\n📊 Test Summary:`);
        console.log(`   Passed: ${passed}`);
        console.log(`   Failed: ${failed}`);
        console.log(`   Total: ${this.results.length}`);
    }
}

// 断言函数
export const assert = {
    equal(actual, expected, message = '') {
        if (actual !== expected) {
            throw new Error(`${message} Expected: ${expected}, Actual: ${actual}`);
        }
    },
    
    notEqual(actual, expected, message = '') {
        if (actual === expected) {
            throw new Error(`${message} Expected not equal to: ${expected}`);
        }
    },
    
    truthy(value, message = '') {
        if (!value) {
            throw new Error(`${message} Expected truthy value, got: ${value}`);
        }
    },
    
    falsy(value, message = '') {
        if (value) {
            throw new Error(`${message} Expected falsy value, got: ${value}`);
        }
    },
    
    throws(fn, message = '') {
        try {
            fn();
            throw new Error(`${message} Expected function to throw`);
        } catch (error) {
            // Expected behavior
        }
    }
};

export const testFramework = new TestFramework();
```

### 组件测试示例

```javascript
// test/components/status-indicator.test.js
import { testFramework, assert } from '../test-framework.js';
import { render } from 'https://esm.sh/preact';
import { html } from 'https://esm.sh/htm/preact';
import StatusIndicator from '../../components/StatusIndicator.js';

testFramework.test('StatusIndicator renders correctly', () => {
    const container = document.createElement('div');
    
    render(html`
        <${StatusIndicator} 
            value="connected" 
            type="status" 
            label="Connection Status" 
        />
    `, container);
    
    const indicator = container.querySelector('.status-indicator');
    assert.truthy(indicator, 'StatusIndicator should render');
    assert.truthy(indicator.classList.contains('connected'), 'Should have connected class');
});

testFramework.test('StatusIndicator handles different types', () => {
    const container = document.createElement('div');
    
    render(html`
        <${StatusIndicator} 
            value="error" 
            type="status" 
        />
    `, container);
    
    const indicator = container.querySelector('.status-indicator');
    assert.truthy(indicator.classList.contains('error'), 'Should have error class');
});
```

### API测试

```javascript
// test/services/api.test.js
import { testFramework, assert } from '../test-framework.js';
import { api } from '../../services/api.js';

// Mock fetch for testing
const originalFetch = window.fetch;
const mockFetch = (response) => {
    window.fetch = jest.fn(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve(response)
    }));
};

testFramework.test('API get request works', async () => {
    mockFetch({ status: 'ok' });
    
    const result = await api.get('/test');
    assert.equal(result.status, 'ok', 'Should return correct response');
    
    // Restore original fetch
    window.fetch = originalFetch;
});

testFramework.test('API handles errors', async () => {
    window.fetch = jest.fn(() => Promise.resolve({
        ok: false,
        status: 404,
        statusText: 'Not Found'
    }));
    
    try {
        await api.get('/nonexistent');
        assert.truthy(false, 'Should throw error');
    } catch (error) {
        assert.truthy(error.message.includes('404'), 'Should include status code');
    }
    
    // Restore original fetch
    window.fetch = originalFetch;
});
```

## 部署

### 生产构建

```bash
# 运行构建脚本
npm run build

# 或直接运行
node build/optimize-resources.js
```

### Docker部署

```dockerfile
# Dockerfile
FROM nginx:alpine

# 复制构建文件
COPY dist/ /usr/share/nginx/html/

# 复制nginx配置
COPY dist/nginx.conf /etc/nginx/conf.d/default.conf

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### 部署脚本

```bash
#!/bin/bash
# deploy.sh

set -e

echo "🚀 Deploying ProDB Collector Frontend..."

# 构建应用
echo "📦 Building application..."
npm run build

# 创建部署包
echo "📁 Creating deployment package..."
tar -czf prodb-collector-frontend.tar.gz -C dist .

# 上传到服务器（示例）
echo "📤 Uploading to server..."
scp prodb-collector-frontend.tar.gz user@server:/tmp/

# 在服务器上部署
echo "🔄 Deploying on server..."
ssh user@server << 'EOF'
    cd /var/www/html
    sudo tar -xzf /tmp/prodb-collector-frontend.tar.gz
    sudo systemctl reload nginx
    rm /tmp/prodb-collector-frontend.tar.gz
EOF

echo "✅ Deployment completed!"
```

## 扩展开发

### 插件系统

```javascript
// utils/plugin-system.js
class PluginSystem {
    constructor() {
        this.plugins = new Map();
        this.hooks = new Map();
    }
    
    // 注册插件
    register(name, plugin) {
        if (this.plugins.has(name)) {
            throw new Error(`Plugin ${name} already registered`);
        }
        
        this.plugins.set(name, plugin);
        
        // 初始化插件
        if (plugin.init) {
            plugin.init(this);
        }
        
        console.log(`Plugin ${name} registered`);
    }
    
    // 注册钩子
    addHook(name, callback) {
        if (!this.hooks.has(name)) {
            this.hooks.set(name, []);
        }
        
        this.hooks.get(name).push(callback);
    }
    
    // 执行钩子
    async executeHook(name, ...args) {
        const callbacks = this.hooks.get(name) || [];
        const results = [];
        
        for (const callback of callbacks) {
            try {
                const result = await callback(...args);
                results.push(result);
            } catch (error) {
                console.error(`Hook ${name} failed:`, error);
            }
        }
        
        return results;
    }
    
    // 获取插件
    getPlugin(name) {
        return this.plugins.get(name);
    }
    
    // 列出所有插件
    listPlugins() {
        return Array.from(this.plugins.keys());
    }
}

export const pluginSystem = new PluginSystem();
```

### 自定义协议驱动

```javascript
// 协议驱动接口
export class ProtocolDriver {
    constructor(config) {
        this.config = config;
        this.connected = false;
    }
    
    // 连接设备
    async connect() {
        throw new Error('connect() must be implemented');
    }
    
    // 断开连接
    async disconnect() {
        throw new Error('disconnect() must be implemented');
    }
    
    // 读取数据
    async read(address) {
        throw new Error('read() must be implemented');
    }
    
    // 写入数据
    async write(address, value) {
        throw new Error('write() must be implemented');
    }
    
    // 订阅数据变化
    subscribe(address, callback) {
        throw new Error('subscribe() must be implemented');
    }
    
    // 取消订阅
    unsubscribe(address) {
        throw new Error('unsubscribe() must be implemented');
    }
    
    // 获取驱动信息
    getInfo() {
        return {
            name: this.constructor.name,
            version: '1.0.0',
            description: 'Custom protocol driver'
        };
    }
}

// 示例：自定义HTTP协议驱动
export class HttpProtocolDriver extends ProtocolDriver {
    async connect() {
        try {
            const response = await fetch(this.config.endpoint);
            this.connected = response.ok;
            return this.connected;
        } catch (error) {
            this.connected = false;
            throw error;
        }
    }
    
    async disconnect() {
        this.connected = false;
    }
    
    async read(address) {
        if (!this.connected) {
            throw new Error('Not connected');
        }
        
        const url = `${this.config.endpoint}${address}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    }
    
    async write(address, value) {
        if (!this.connected) {
            throw new Error('Not connected');
        }
        
        const url = `${this.config.endpoint}${address}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    }
}
```

### 主题系统

```javascript
// utils/theme-system.js
class ThemeSystem {
    constructor() {
        this.themes = new Map();
        this.currentTheme = 'dark';
        
        // 注册默认主题
        this.registerTheme('dark', {
            name: 'Dark Theme',
            variables: {
                '--bg-primary': '#0f172a',
                '--bg-secondary': '#1e293b',
                '--text-primary': '#f8fafc',
                '--text-secondary': '#cbd5e1'
            }
        });
        
        this.registerTheme('light', {
            name: 'Light Theme',
            variables: {
                '--bg-primary': '#ffffff',
                '--bg-secondary': '#f8fafc',
                '--text-primary': '#1e293b',
                '--text-secondary': '#475569'
            }
        });
    }
    
    // 注册主题
    registerTheme(id, theme) {
        this.themes.set(id, theme);
    }
    
    // 应用主题
    applyTheme(themeId) {
        const theme = this.themes.get(themeId);
        if (!theme) {
            throw new Error(`Theme ${themeId} not found`);
        }
        
        const root = document.documentElement;
        
        // 应用CSS变量
        Object.entries(theme.variables).forEach(([property, value]) => {
            root.style.setProperty(property, value);
        });
        
        // 设置data-theme属性
        root.setAttribute('data-theme', themeId);
        
        this.currentTheme = themeId;
        
        // 保存到本地存储
        localStorage.setItem('theme', themeId);
        
        // 触发主题变更事件
        window.dispatchEvent(new CustomEvent('themechange', {
            detail: { theme: themeId }
        }));
    }
    
    // 获取当前主题
    getCurrentTheme() {
        return this.currentTheme;
    }
    
    // 列出所有主题
    listThemes() {
        return Array.from(this.themes.entries()).map(([id, theme]) => ({
            id,
            name: theme.name
        }));
    }
    
    // 从本地存储加载主题
    loadSavedTheme() {
        const saved = localStorage.getItem('theme');
        if (saved && this.themes.has(saved)) {
            this.applyTheme(saved);
        }
    }
}

export const themeSystem = new ThemeSystem();
```

---

这份开发者文档提供了完整的前端开发指南，包括架构设计、组件开发、API集成、性能优化等各个方面。开发者可以根据这份文档快速上手项目开发和扩展功能。