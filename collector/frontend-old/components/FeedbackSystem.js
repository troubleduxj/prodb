/**
 * 反馈和支持系统组件
 * 提供用户反馈、问题报告和支持渠道
 */

import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';
import Modal from './Modal.js';

const FeedbackSystem = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState('feedback');
    const [feedbackData, setFeedbackData] = useState({
        type: 'suggestion',
        title: '',
        description: '',
        email: '',
        priority: 'medium',
        category: 'general'
    });
    const [submitStatus, setSubmitStatus] = useState(null);
    const [supportInfo, setSupportInfo] = useState(null);

    // 加载支持信息
    useEffect(() => {
        loadSupportInfo();
    }, []);

    const loadSupportInfo = () => {
        setSupportInfo({
            version: '1.0.0',
            buildDate: '2024-01-15',
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screenResolution: `${screen.width}x${screen.height}`,
            timestamp: new Date().toISOString()
        });
    };

    const handleInputChange = (field, value) => {
        setFeedbackData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSubmitFeedback = async () => {
        if (!feedbackData.title.trim() || !feedbackData.description.trim()) {
            setSubmitStatus({
                type: 'error',
                message: '请填写标题和详细描述'
            });
            return;
        }

        setSubmitStatus({ type: 'loading', message: '提交中...' });

        try {
            // 模拟API调用
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            const submissionData = {
                ...feedbackData,
                systemInfo: supportInfo,
                timestamp: new Date().toISOString(),
                id: generateFeedbackId()
            };

            // 保存到本地存储（实际应用中应发送到服务器）
            const existingFeedback = JSON.parse(localStorage.getItem('user_feedback') || '[]');
            existingFeedback.push(submissionData);
            localStorage.setItem('user_feedback', JSON.stringify(existingFeedback));

            setSubmitStatus({
                type: 'success',
                message: `反馈提交成功！反馈ID: ${submissionData.id}`
            });

            // 重置表单
            setTimeout(() => {
                setFeedbackData({
                    type: 'suggestion',
                    title: '',
                    description: '',
                    email: '',
                    priority: 'medium',
                    category: 'general'
                });
                setSubmitStatus(null);
            }, 3000);

        } catch (error) {
            setSubmitStatus({
                type: 'error',
                message: '提交失败，请稍后重试'
            });
        }
    };

    const generateFeedbackId = () => {
        return 'FB' + Date.now().toString(36).toUpperCase();
    };

    const copySystemInfo = () => {
        const info = `
ProDB Collector 系统信息
========================
版本: ${supportInfo.version}
构建日期: ${supportInfo.buildDate}
浏览器: ${supportInfo.userAgent}
平台: ${supportInfo.platform}
语言: ${supportInfo.language}
屏幕分辨率: ${supportInfo.screenResolution}
时间戳: ${supportInfo.timestamp}
        `.trim();

        navigator.clipboard.writeText(info).then(() => {
            setSubmitStatus({
                type: 'success',
                message: '系统信息已复制到剪贴板'
            });
            setTimeout(() => setSubmitStatus(null), 2000);
        });
    };

    const openExternalLink = (url) => {
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const renderFeedbackForm = () => html`
        <div class="feedback-form">
            <div class="form-group">
                <label>反馈类型</label>
                <select 
                    value=${feedbackData.type}
                    onChange=${(e) => handleInputChange('type', e.target.value)}
                    class="form-select"
                >
                    <option value="suggestion">功能建议</option>
                    <option value="bug">问题报告</option>
                    <option value="improvement">改进建议</option>
                    <option value="question">使用问题</option>
                    <option value="other">其他</option>
                </select>
            </div>

            <div class="form-group">
                <label>分类</label>
                <select 
                    value=${feedbackData.category}
                    onChange=${(e) => handleInputChange('category', e.target.value)}
                    class="form-select"
                >
                    <option value="general">一般</option>
                    <option value="ui">用户界面</option>
                    <option value="performance">性能</option>
                    <option value="protocol">协议功能</option>
                    <option value="mobile">移动端</option>
                    <option value="api">API接口</option>
                    <option value="documentation">文档</option>
                </select>
            </div>

            <div class="form-group">
                <label>优先级</label>
                <select 
                    value=${feedbackData.priority}
                    onChange=${(e) => handleInputChange('priority', e.target.value)}
                    class="form-select"
                >
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                    <option value="urgent">紧急</option>
                </select>
            </div>

            <div class="form-group">
                <label>标题 *</label>
                <input 
                    type="text"
                    value=${feedbackData.title}
                    onChange=${(e) => handleInputChange('title', e.target.value)}
                    placeholder="简要描述您的反馈"
                    class="form-input"
                    maxLength="100"
                />
                <div class="char-count">${feedbackData.title.length}/100</div>
            </div>

            <div class="form-group">
                <label>详细描述 *</label>
                <textarea 
                    value=${feedbackData.description}
                    onChange=${(e) => handleInputChange('description', e.target.value)}
                    placeholder="请详细描述您的反馈内容，包括重现步骤、期望结果等"
                    class="form-textarea"
                    rows="6"
                    maxLength="1000"
                ></textarea>
                <div class="char-count">${feedbackData.description.length}/1000</div>
            </div>

            <div class="form-group">
                <label>联系邮箱（可选）</label>
                <input 
                    type="email"
                    value=${feedbackData.email}
                    onChange=${(e) => handleInputChange('email', e.target.value)}
                    placeholder="如需回复，请提供邮箱地址"
                    class="form-input"
                />
            </div>

            ${submitStatus && html`
                <div class="status-message ${submitStatus.type}">
                    ${submitStatus.type === 'loading' && html`
                        <div class="loading-spinner"></div>
                    `}
                    <span>${submitStatus.message}</span>
                </div>
            `}

            <div class="form-actions">
                <button 
                    onClick=${handleSubmitFeedback}
                    disabled=${submitStatus?.type === 'loading'}
                    class="btn btn-primary"
                >
                    ${submitStatus?.type === 'loading' ? '提交中...' : '提交反馈'}
                </button>
                <button onClick=${onClose} class="btn btn-secondary">
                    取消
                </button>
            </div>
        </div>
    `;

    const renderSupportInfo = () => html`
        <div class="support-info">
            <div class="info-section">
                <h3>📞 联系方式</h3>
                <div class="contact-methods">
                    <div class="contact-item">
                        <span class="contact-icon">📧</span>
                        <div class="contact-details">
                            <strong>邮箱支持</strong>
                            <p>support@prodb.com</p>
                            <small>24小时内回复</small>
                        </div>
                    </div>
                    
                    <div class="contact-item">
                        <span class="contact-icon">💬</span>
                        <div class="contact-details">
                            <strong>在线客服</strong>
                            <p>工作日 9:00-18:00</p>
                            <button 
                                onClick=${() => openExternalLink('https://chat.prodb.com')}
                                class="btn btn-sm btn-primary"
                            >
                                开始对话
                            </button>
                        </div>
                    </div>
                    
                    <div class="contact-item">
                        <span class="contact-icon">📞</span>
                        <div class="contact-details">
                            <strong>电话支持</strong>
                            <p>400-123-4567</p>
                            <small>工作日 9:00-18:00</small>
                        </div>
                    </div>
                </div>
            </div>

            <div class="info-section">
                <h3>📚 自助资源</h3>
                <div class="resource-links">
                    <button 
                        onClick=${() => openExternalLink('/docs/user-manual.md')}
                        class="resource-link"
                    >
                        <span class="resource-icon">📖</span>
                        <div>
                            <strong>用户手册</strong>
                            <p>完整的功能说明和操作指南</p>
                        </div>
                    </button>
                    
                    <button 
                        onClick=${() => openExternalLink('/docs/quick-start-guide.md')}
                        class="resource-link"
                    >
                        <span class="resource-icon">🚀</span>
                        <div>
                            <strong>快速入门</strong>
                            <p>5分钟快速上手教程</p>
                        </div>
                    </button>
                    
                    <button 
                        onClick=${() => openExternalLink('/docs/api-reference.md')}
                        class="resource-link"
                    >
                        <span class="resource-icon">🔌</span>
                        <div>
                            <strong>API文档</strong>
                            <p>完整的API接口参考</p>
                        </div>
                    </button>
                    
                    <button 
                        onClick=${() => openExternalLink('https://community.prodb.com')}
                        class="resource-link"
                    >
                        <span class="resource-icon">💬</span>
                        <div>
                            <strong>社区论坛</strong>
                            <p>用户交流和问题讨论</p>
                        </div>
                    </button>
                </div>
            </div>

            <div class="info-section">
                <h3>🔧 系统信息</h3>
                <div class="system-info">
                    ${supportInfo && Object.entries({
                        '版本': supportInfo.version,
                        '构建日期': supportInfo.buildDate,
                        '浏览器': supportInfo.userAgent.split(' ')[0],
                        '平台': supportInfo.platform,
                        '语言': supportInfo.language,
                        '屏幕分辨率': supportInfo.screenResolution
                    }).map(([key, value]) => html`
                        <div class="info-row">
                            <span class="info-label">${key}:</span>
                            <span class="info-value">${value}</span>
                        </div>
                    `)}
                    
                    <button 
                        onClick=${copySystemInfo}
                        class="btn btn-sm btn-secondary copy-info-btn"
                    >
                        📋 复制系统信息
                    </button>
                </div>
            </div>
        </div>
    `;

    const renderFAQ = () => html`
        <div class="faq-section">
            <div class="faq-search">
                <input 
                    type="text" 
                    placeholder="搜索常见问题..."
                    class="form-input"
                />
            </div>
            
            <div class="faq-categories">
                <button class="faq-category active">全部</button>
                <button class="faq-category">连接问题</button>
                <button class="faq-category">配置问题</button>
                <button class="faq-category">性能问题</button>
                <button class="faq-category">移动端</button>
            </div>

            <div class="faq-list">
                ${[
                    {
                        question: '无法连接到OPC UA服务器怎么办？',
                        answer: '请检查：1) 服务器地址和端口是否正确；2) 网络连接是否正常；3) 防火墙设置；4) 服务器是否在线运行。',
                        category: 'connection'
                    },
                    {
                        question: '如何在移动设备上使用？',
                        answer: '在移动浏览器中打开应用，点击"添加到主屏幕"即可安装为原生应用。支持离线查看缓存数据。',
                        category: 'mobile'
                    },
                    {
                        question: '数据不更新是什么原因？',
                        answer: '可能原因：1) 接口未启动；2) 设备连接断开；3) 数据点配置错误；4) 网络问题。请检查接口状态和日志。',
                        category: 'data'
                    },
                    {
                        question: '如何提高页面加载速度？',
                        answer: '建议：1) 清除浏览器缓存；2) 关闭不必要的标签页；3) 检查网络连接；4) 减少同时显示的数据量。',
                        category: 'performance'
                    },
                    {
                        question: '支持哪些工业协议？',
                        answer: '目前支持：OPC UA、OPC DA、Modbus TCP/RTU、MQTT、Ethernet/IP等主流工业协议，并支持自定义驱动扩展。',
                        category: 'protocol'
                    }
                ].map((faq, index) => html`
                    <div class="faq-item" key=${index}>
                        <div class="faq-question">
                            <span>${faq.question}</span>
                            <span class="faq-toggle">+</span>
                        </div>
                        <div class="faq-answer">
                            <p>${faq.answer}</p>
                        </div>
                    </div>
                `)}
            </div>
        </div>
    `;

    return html`
        <${Modal} onClose=${onClose} title="帮助与支持" size="large">
            <div class="feedback-system">
                <div class="feedback-tabs">
                    <button 
                        class="tab-button ${activeTab === 'feedback' ? 'active' : ''}"
                        onClick=${() => setActiveTab('feedback')}
                    >
                        💬 反馈建议
                    </button>
                    <button 
                        class="tab-button ${activeTab === 'support' ? 'active' : ''}"
                        onClick=${() => setActiveTab('support')}
                    >
                        🆘 获取帮助
                    </button>
                    <button 
                        class="tab-button ${activeTab === 'faq' ? 'active' : ''}"
                        onClick=${() => setActiveTab('faq')}
                    >
                        ❓ 常见问题
                    </button>
                </div>

                <div class="tab-content">
                    ${activeTab === 'feedback' && renderFeedbackForm()}
                    ${activeTab === 'support' && renderSupportInfo()}
                    ${activeTab === 'faq' && renderFAQ()}
                </div>
            </div>
        <//>
    `;
};

// Simple feedback manager for programmatic use
export const feedbackManager = {
    initialized: false,
    
    init() {
        if (this.initialized) return;
        this.ensureStyles();
        this.initialized = true;
        console.log('Feedback manager initialized');
    },
    
    success(message, options = {}) {
        this.showNotification('success', message, options);
    },
    
    error(message, options = {}) {
        this.showNotification('error', message, options);
    },
    
    warning(message, options = {}) {
        this.showNotification('warning', message, options);
    },
    
    showToast(message, type = 'info', options = {}) {
        this.showNotification(type, message, options);
    },
    
    info(message, options = {}) {
        this.showNotification('info', message, options);
    },
    
    showNotification(type, message, options = {}) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `feedback-notification feedback-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${this.getIcon(type)}</span>
                <span class="notification-message">${message}</span>
                ${options.actions ? this.renderActions(options.actions) : ''}
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        // Add styles if not already added
        this.ensureStyles();
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto remove after delay
        const duration = options.duration || (type === 'error' ? 8000 : 4000);
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, duration);
        
        // Animate in
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });
    },
    
    getIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || 'ℹ️';
    },
    
    renderActions(actions) {
        return `
            <div class="notification-actions">
                ${actions.map(action => `
                    <button class="notification-action" onclick="${action.onClick || ''}">${action.label}</button>
                `).join('')}
            </div>
        `;
    },
    
    ensureStyles() {
        if (document.getElementById('feedback-notification-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'feedback-notification-styles';
        styles.textContent = `
            .feedback-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: var(--bg-secondary, #1e293b);
                border: 1px solid var(--border-color, #334155);
                border-radius: 8px;
                padding: 16px;
                max-width: 400px;
                z-index: 10000;
                transform: translateX(100%);
                transition: transform 0.3s ease;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
            }
            
            .feedback-notification.show {
                transform: translateX(0);
            }
            
            .feedback-notification.feedback-success {
                border-left: 4px solid #10b981;
            }
            
            .feedback-notification.feedback-error {
                border-left: 4px solid #ef4444;
            }
            
            .feedback-notification.feedback-warning {
                border-left: 4px solid #f59e0b;
            }
            
            .feedback-notification.feedback-info {
                border-left: 4px solid #06b6d4;
            }
            
            .notification-content {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                color: var(--text-primary, #f8fafc);
            }
            
            .notification-icon {
                font-size: 16px;
                flex-shrink: 0;
            }
            
            .notification-message {
                flex: 1;
                font-size: 14px;
                line-height: 1.4;
            }
            
            .notification-close {
                background: none;
                border: none;
                color: var(--text-secondary, #cbd5e1);
                cursor: pointer;
                font-size: 18px;
                padding: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            
            .notification-close:hover {
                color: var(--text-primary, #f8fafc);
            }
            
            .notification-actions {
                margin-top: 8px;
                display: flex;
                gap: 8px;
            }
            
            .notification-action {
                background: var(--color-primary, #2563eb);
                color: white;
                border: none;
                padding: 4px 12px;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
            }
            
            .notification-action:hover {
                background: var(--color-primary-hover, #1d4ed8);
            }
        `;
        
        document.head.appendChild(styles);
    }
};

export default FeedbackSystem;