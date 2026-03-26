/**
 * Configuration Clipboard Component for ProDB Collector
 * Handles configuration copy, paste, and template management
 */

import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';

const ConfigClipboard = ({ 
    onPasteConfig, 
    onClearClipboard,
    clipboardConfig = null 
}) => {
    const [showClipboard, setShowClipboard] = useState(false);
    const [clipboardHistory, setClipboardHistory] = useState([]);

    useEffect(() => {
        // Load clipboard history from localStorage
        const savedHistory = localStorage.getItem('collector-clipboard-history');
        if (savedHistory) {
            try {
                setClipboardHistory(JSON.parse(savedHistory));
            } catch (error) {
                console.error('Failed to load clipboard history:', error);
            }
        }
    }, []);

    useEffect(() => {
        // Save clipboard history to localStorage
        if (clipboardHistory.length > 0) {
            localStorage.setItem('collector-clipboard-history', JSON.stringify(clipboardHistory));
        }
    }, [clipboardHistory]);

    const addToHistory = (config) => {
        const historyItem = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            name: config.name || 'Unnamed Config',
            protocol: config.protocol,
            config: config
        };

        setClipboardHistory(prev => {
            const newHistory = [historyItem, ...prev.filter(item => item.id !== historyItem.id)];
            return newHistory.slice(0, 10); // Keep only last 10 items
        });
    };

    const handlePasteFromHistory = (historyItem) => {
        onPasteConfig(historyItem.config);
        setShowClipboard(false);
    };

    const handleClearHistory = () => {
        if (confirm('确定要清除所有剪贴板历史吗？')) {
            setClipboardHistory([]);
            localStorage.removeItem('collector-clipboard-history');
        }
    };

    const formatTimestamp = (timestamp) => {
        return new Date(timestamp).toLocaleString('zh-CN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return html`
        <div class="config-clipboard">
            <!-- Clipboard Status -->
            ${clipboardConfig && html`
                <div class="clipboard-status">
                    <div class="clipboard-info">
                        <span class="clipboard-icon">📋</span>
                        <div class="clipboard-details">
                            <span class="clipboard-name">${clipboardConfig.name}</span>
                            <span class="clipboard-protocol">${clipboardConfig.protocol}</span>
                        </div>
                    </div>
                    
                    <div class="clipboard-actions">
                        <button 
                            class="btn btn-primary btn-sm"
                            onClick=${() => onPasteConfig(clipboardConfig)}
                            title="粘贴配置"
                        >
                            <span class="btn-icon">📋</span>
                            粘贴
                        </button>
                        
                        <button 
                            class="btn btn-outline btn-sm"
                            onClick=${() => setShowClipboard(!showClipboard)}
                            title="查看剪贴板历史"
                        >
                            <span class="btn-icon">📚</span>
                            历史
                        </button>
                        
                        <button 
                            class="btn btn-outline btn-sm"
                            onClick=${onClearClipboard}
                            title="清除剪贴板"
                        >
                            <span class="btn-icon">🗑️</span>
                            清除
                        </button>
                    </div>
                </div>
            `}

            <!-- Clipboard History Panel -->
            ${showClipboard && html`
                <div class="clipboard-panel">
                    <div class="panel-header">
                        <h3>剪贴板历史</h3>
                        <div class="panel-actions">
                            ${clipboardHistory.length > 0 && html`
                                <button 
                                    class="btn btn-outline btn-sm"
                                    onClick=${handleClearHistory}
                                >
                                    清除历史
                                </button>
                            `}
                            <button 
                                class="btn btn-outline btn-sm"
                                onClick=${() => setShowClipboard(false)}
                            >
                                关闭
                            </button>
                        </div>
                    </div>

                    <div class="history-list">
                        ${clipboardHistory.length === 0 ? html`
                            <div class="empty-history">
                                <div class="empty-icon">📋</div>
                                <p>暂无剪贴板历史</p>
                                <p class="empty-hint">复制接口配置后会显示在这里</p>
                            </div>
                        ` : clipboardHistory.map(item => html`
                            <div class="history-item" key=${item.id}>
                                <div class="item-info">
                                    <div class="item-header">
                                        <span class="item-name">${item.name}</span>
                                        <span class="item-protocol">${item.protocol}</span>
                                    </div>
                                    <div class="item-meta">
                                        <span class="item-timestamp">${formatTimestamp(item.timestamp)}</span>
                                    </div>
                                </div>
                                
                                <div class="item-preview">
                                    ${Object.entries(item.config.config || {}).slice(0, 2).map(([key, value]) => html`
                                        <div class="preview-item" key=${key}>
                                            <span class="preview-key">${key}:</span>
                                            <span class="preview-value">
                                                ${key.includes('password') ? '••••••••' : value}
                                            </span>
                                        </div>
                                    `)}
                                </div>
                                
                                <div class="item-actions">
                                    <button 
                                        class="btn btn-primary btn-sm"
                                        onClick=${() => handlePasteFromHistory(item)}
                                        title="使用此配置"
                                    >
                                        使用
                                    </button>
                                </div>
                            </div>
                        `)}
                    </div>
                </div>
            `}

            <!-- Quick Paste Shortcuts -->
            ${!showClipboard && clipboardHistory.length > 0 && html`
                <div class="quick-paste">
                    <span class="quick-paste-label">最近复制:</span>
                    <div class="quick-paste-items">
                        ${clipboardHistory.slice(0, 3).map(item => html`
                            <button 
                                key=${item.id}
                                class="quick-paste-item"
                                onClick=${() => handlePasteFromHistory(item)}
                                title=${`粘贴 ${item.name} (${item.protocol})`}
                            >
                                <span class="item-name">${item.name}</span>
                                <span class="item-protocol">${item.protocol}</span>
                            </button>
                        `)}
                    </div>
                </div>
            `}
        </div>
    `;
};

// Export utility functions for use in other components
export const copyConfigToClipboard = (config) => {
    try {
        // Create a clean copy without runtime fields
        const cleanConfig = {
            ...config,
            id: undefined,
            status: undefined,
            createdAt: undefined,
            updatedAt: undefined
        };
        
        const { id, status, createdAt, updatedAt, ...configToCopy } = cleanConfig;
        
        // Store in browser clipboard if available
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(JSON.stringify(configToCopy, null, 2));
        }
        
        return configToCopy;
    } catch (error) {
        console.error('Failed to copy config to clipboard:', error);
        throw error;
    }
};

export const pasteConfigFromClipboard = async () => {
    try {
        if (navigator.clipboard && navigator.clipboard.readText) {
            const text = await navigator.clipboard.readText();
            return JSON.parse(text);
        }
        return null;
    } catch (error) {
        console.error('Failed to paste config from clipboard:', error);
        return null;
    }
};

export default ConfigClipboard;