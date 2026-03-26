/**
 * Help System Component
 * Provides contextual help, documentation, and FAQ system
 */

import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect, useRef } from 'https://esm.sh/preact/hooks';
import { debounce } from '../utils/performance.js';
import { devLog } from '../utils/helpers.js';

// Help panel component
export const HelpPanel = ({ 
    isOpen = false, 
    onClose = null,
    context = 'general',
    searchable = true 
}) => {
    const [activeTab, setActiveTab] = useState('help');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const panelRef = useRef(null);

    // Debounced search function
    const debouncedSearch = useRef(
        debounce(async (query) => {
            if (!query.trim()) {
                setSearchResults([]);
                setIsSearching(false);
                return;
            }

            setIsSearching(true);
            try {
                const results = await searchHelpContent(query, context);
                setSearchResults(results);
            } catch (error) {
                console.error('Help search failed:', error);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 300)
    ).current;

    // Handle search input
    useEffect(() => {
        debouncedSearch(searchQuery);
    }, [searchQuery]);

    // Handle escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen && onClose) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Focus panel when opened
    useEffect(() => {
        if (isOpen && panelRef.current) {
            panelRef.current.focus();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return html`
        <div class="help-overlay" onClick=${onClose}>
            <div 
                ref=${panelRef}
                class="help-panel"
                onClick=${(e) => e.stopPropagation()}
                tabIndex="-1"
            >
                <div class="help-header">
                    <h2>Help & Documentation</h2>
                    <button class="help-close" onClick=${onClose}>×</button>
                </div>

                <div class="help-tabs">
                    <button 
                        class=${activeTab === 'help' ? 'active' : ''}
                        onClick=${() => setActiveTab('help')}
                    >
                        Help
                    </button>
                    <button 
                        class=${activeTab === 'faq' ? 'active' : ''}
                        onClick=${() => setActiveTab('faq')}
                    >
                        FAQ
                    </button>
                    <button 
                        class=${activeTab === 'shortcuts' ? 'active' : ''}
                        onClick=${() => setActiveTab('shortcuts')}
                    >
                        Shortcuts
                    </button>
                    <button 
                        class=${activeTab === 'about' ? 'active' : ''}
                        onClick=${() => setActiveTab('about')}
                    >
                        About
                    </button>
                </div>

                ${searchable && html`
                    <div class="help-search">
                        <input
                            type="text"
                            placeholder="Search help content..."
                            value=${searchQuery}
                            onInput=${(e) => setSearchQuery(e.target.value)}
                            class="help-search-input"
                        />
                        ${isSearching && html`
                            <div class="help-search-loading">Searching...</div>
                        `}
                    </div>
                `}

                <div class="help-content">
                    ${searchQuery && searchResults.length > 0 ? html`
                        <${SearchResults} results=${searchResults} />
                    ` : html`
                        ${activeTab === 'help' && html`<${HelpContent} context=${context} />`}
                        ${activeTab === 'faq' && html`<${FAQContent} context=${context} />`}
                        ${activeTab === 'shortcuts' && html`<${ShortcutsContent} />`}
                        ${activeTab === 'about' && html`<${AboutContent} />`}
                    `}
                </div>
            </div>
        </div>
    `;
};

// Search results component
const SearchResults = ({ results }) => {
    return html`
        <div class="search-results">
            <h3>Search Results (${results.length})</h3>
            ${results.map((result, index) => html`
                <div class="search-result" key=${index}>
                    <h4 class="result-title">${result.title}</h4>
                    <p class="result-excerpt">${result.excerpt}</p>
                    <div class="result-meta">
                        <span class="result-category">${result.category}</span>
                        <span class="result-relevance">Relevance: ${Math.round(result.relevance * 100)}%</span>
                    </div>
                </div>
            `)}
        </div>
    `;
};

// Help content component
const HelpContent = ({ context }) => {
    const helpContent = getHelpContent(context);

    return html`
        <div class="help-sections">
            ${helpContent.map((section, index) => html`
                <div class="help-section" key=${index}>
                    <h3>${section.title}</h3>
                    <div class="help-section-content">
                        ${section.content.map((item, itemIndex) => html`
                            <div class="help-item" key=${itemIndex}>
                                ${item.type === 'text' && html`<p>${item.content}</p>`}
                                ${item.type === 'list' && html`
                                    <ul>
                                        ${item.items.map(listItem => html`
                                            <li key=${listItem}>${listItem}</li>
                                        `)}
                                    </ul>
                                `}
                                ${item.type === 'code' && html`
                                    <pre class="help-code"><code>${item.content}</code></pre>
                                `}
                                ${item.type === 'image' && html`
                                    <img src=${item.src} alt=${item.alt} class="help-image" />
                                `}
                                ${item.type === 'video' && html`
                                    <video src=${item.src} controls class="help-video" />
                                `}
                            </div>
                        `)}
                    </div>
                </div>
            `)}
        </div>
    `;
};

// FAQ content component
const FAQContent = ({ context }) => {
    const [expandedItems, setExpandedItems] = useState(new Set());
    const faqItems = getFAQContent(context);

    const toggleItem = (index) => {
        const newExpanded = new Set(expandedItems);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedItems(newExpanded);
    };

    return html`
        <div class="faq-content">
            <h3>Frequently Asked Questions</h3>
            <div class="faq-items">
                ${faqItems.map((item, index) => html`
                    <div class="faq-item ${expandedItems.has(index) ? 'expanded' : ''}" key=${index}>
                        <button 
                            class="faq-question"
                            onClick=${() => toggleItem(index)}
                        >
                            <span>${item.question}</span>
                            <span class="faq-toggle">${expandedItems.has(index) ? '−' : '+'}</span>
                        </button>
                        ${expandedItems.has(index) && html`
                            <div class="faq-answer">
                                ${typeof item.answer === 'string' 
                                    ? html`<p>${item.answer}</p>`
                                    : item.answer
                                }
                            </div>
                        `}
                    </div>
                `)}
            </div>
        </div>
    `;
};

// Shortcuts content component
const ShortcutsContent = () => {
    const shortcuts = getKeyboardShortcuts();

    return html`
        <div class="shortcuts-content">
            <h3>Keyboard Shortcuts</h3>
            <div class="shortcuts-grid">
                ${Object.entries(shortcuts).map(([category, items]) => html`
                    <div class="shortcuts-category" key=${category}>
                        <h4>${category}</h4>
                        <div class="shortcuts-list">
                            ${items.map((shortcut, index) => html`
                                <div class="shortcut-item" key=${index}>
                                    <div class="shortcut-keys">
                                        ${shortcut.keys.map(key => html`
                                            <kbd key=${key}>${key}</kbd>
                                        `)}
                                    </div>
                                    <div class="shortcut-description">${shortcut.description}</div>
                                </div>
                            `)}
                        </div>
                    </div>
                `)}
            </div>
        </div>
    `;
};

// About content component
const AboutContent = () => {
    return html`
        <div class="about-content">
            <h3>About ProDB Collector</h3>
            <div class="about-info">
                <div class="about-section">
                    <h4>Version Information</h4>
                    <p>Version: ${window.APP_VERSION || '1.0.0'}</p>
                    <p>Build Date: ${window.BUILD_DATE || new Date().toLocaleDateString()}</p>
                    <p>Environment: ${window.NODE_ENV || 'production'}</p>
                </div>
                
                <div class="about-section">
                    <h4>System Information</h4>
                    <p>Browser: ${navigator.userAgent}</p>
                    <p>Platform: ${navigator.platform}</p>
                    <p>Language: ${navigator.language}</p>
                </div>
                
                <div class="about-section">
                    <h4>Features</h4>
                    <ul>
                        <li>Multi-protocol data collection</li>
                        <li>Real-time monitoring and visualization</li>
                        <li>Protocol testing and diagnostics</li>
                        <li>Driver management system</li>
                        <li>Mobile-responsive interface</li>
                        <li>Performance optimizations</li>
                    </ul>
                </div>
                
                <div class="about-section">
                    <h4>Support</h4>
                    <p>For technical support and documentation, visit our support portal or contact your system administrator.</p>
                </div>
            </div>
        </div>
    `;
};

// Context help tooltip component
export const ContextHelp = ({ 
    content, 
    position = 'top',
    trigger = 'hover',
    maxWidth = 300 
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
    const triggerRef = useRef(null);
    const tooltipRef = useRef(null);

    const showTooltip = () => {
        setIsVisible(true);
        updatePosition();
    };

    const hideTooltip = () => {
        setIsVisible(false);
    };

    const updatePosition = () => {
        if (!triggerRef.current || !tooltipRef.current) return;

        const triggerRect = triggerRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        
        let top, left;
        const offset = 10;

        switch (position) {
            case 'top':
                top = triggerRect.top - tooltipRect.height - offset;
                left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
                break;
            case 'bottom':
                top = triggerRect.bottom + offset;
                left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
                break;
            case 'left':
                top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
                left = triggerRect.left - tooltipRect.width - offset;
                break;
            case 'right':
                top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
                left = triggerRect.right + offset;
                break;
        }

        // Keep tooltip within viewport
        const padding = 10;
        if (left < padding) left = padding;
        if (left + tooltipRect.width > window.innerWidth - padding) {
            left = window.innerWidth - tooltipRect.width - padding;
        }
        if (top < padding) top = padding;
        if (top + tooltipRect.height > window.innerHeight - padding) {
            top = window.innerHeight - tooltipRect.height - padding;
        }

        setTooltipPosition({ top, left });
    };

    const handleTrigger = () => {
        if (trigger === 'click') {
            if (isVisible) {
                hideTooltip();
            } else {
                showTooltip();
            }
        }
    };

    return html`
        <div class="context-help">
            <button
                ref=${triggerRef}
                class="context-help-trigger"
                onClick=${handleTrigger}
                onMouseEnter=${trigger === 'hover' ? showTooltip : null}
                onMouseLeave=${trigger === 'hover' ? hideTooltip : null}
                onFocus=${trigger === 'focus' ? showTooltip : null}
                onBlur=${trigger === 'focus' ? hideTooltip : null}
                aria-describedby="context-help-tooltip"
            >
                ?
            </button>
            
            ${isVisible && html`
                <div
                    ref=${tooltipRef}
                    id="context-help-tooltip"
                    class="context-help-tooltip"
                    style=${{
                        position: 'fixed',
                        top: `${tooltipPosition.top}px`,
                        left: `${tooltipPosition.left}px`,
                        maxWidth: `${maxWidth}px`,
                        zIndex: 10000
                    }}
                    role="tooltip"
                >
                    <div class="tooltip-content">
                        ${typeof content === 'string' 
                            ? html`<p>${content}</p>`
                            : content
                        }
                    </div>
                    <div class="tooltip-arrow ${position}" />
                </div>
            `}
        </div>
    `;
};

// Help content data
const getHelpContent = (context) => {
    const commonContent = [
        {
            title: 'Getting Started',
            content: [
                {
                    type: 'text',
                    content: 'Welcome to ProDB Collector! This application helps you collect and monitor data from various industrial protocols.'
                },
                {
                    type: 'list',
                    items: [
                        'Configure data collection interfaces',
                        'Monitor real-time data streams',
                        'Test protocol connections',
                        'Manage protocol drivers'
                    ]
                }
            ]
        },
        {
            title: 'Navigation',
            content: [
                {
                    type: 'text',
                    content: 'Use the sidebar to navigate between different sections:'
                },
                {
                    type: 'list',
                    items: [
                        'Dashboard - System overview and status',
                        'Interfaces - Manage data collection points',
                        'Protocol Testing - Test connections and protocols',
                        'Drivers - Manage protocol drivers',
                        'Configuration - System settings'
                    ]
                }
            ]
        }
    ];

    const contextContent = {
        dashboard: [
            {
                title: 'Dashboard Overview',
                content: [
                    {
                        type: 'text',
                        content: 'The dashboard provides a real-time overview of your collector system status and performance.'
                    },
                    {
                        type: 'list',
                        items: [
                            'System status indicators show overall health',
                            'Interface cards display connection status',
                            'Quick actions allow immediate control',
                            'Performance metrics track data flow'
                        ]
                    }
                ]
            }
        ],
        interfaces: [
            {
                title: 'Interface Management',
                content: [
                    {
                        type: 'text',
                        content: 'Interfaces define how the collector connects to and reads data from external devices.'
                    },
                    {
                        type: 'list',
                        items: [
                            'Create new interfaces using the configuration wizard',
                            'Test connections before saving',
                            'Monitor interface status in real-time',
                            'Use batch operations for multiple interfaces'
                        ]
                    }
                ]
            }
        ],
        testing: [
            {
                title: 'Protocol Testing',
                content: [
                    {
                        type: 'text',
                        content: 'The protocol testing tool helps you verify connections and troubleshoot communication issues.'
                    },
                    {
                        type: 'list',
                        items: [
                            'Test individual protocol connections',
                            'Scan networks for available devices',
                            'Perform batch testing on multiple configurations',
                            'Generate detailed test reports'
                        ]
                    }
                ]
            }
        ]
    };

    return [...commonContent, ...(contextContent[context] || [])];
};

const getFAQContent = (context) => {
    return [
        {
            question: 'How do I add a new data collection interface?',
            answer: html`
                <p>To add a new interface:</p>
                <ol>
                    <li>Go to the Interfaces page</li>
                    <li>Click the "Add Interface" card</li>
                    <li>Follow the configuration wizard</li>
                    <li>Test the connection before saving</li>
                </ol>
            `
        },
        {
            question: 'Why is my interface showing as disconnected?',
            answer: 'Check the network connection, verify the device is powered on and accessible, and ensure the configuration parameters are correct.'
        },
        {
            question: 'How do I test a protocol connection?',
            answer: html`
                <p>Use the Protocol Testing tool:</p>
                <ol>
                    <li>Navigate to Protocol Testing</li>
                    <li>Select your protocol type</li>
                    <li>Enter connection parameters</li>
                    <li>Click "Test Connection"</li>
                </ol>
            `
        },
        {
            question: 'Can I import/export interface configurations?',
            answer: 'Yes, you can export configurations as JSON files and import them on other collector instances or for backup purposes.'
        },
        {
            question: 'What protocols are supported?',
            answer: 'The collector supports OPC UA, OPC DA, Modbus TCP/RTU, MQTT, Ethernet/IP, and other industrial protocols through the driver system.'
        }
    ];
};

const getKeyboardShortcuts = () => {
    return {
        'Navigation': [
            { keys: ['Alt', 'D'], description: 'Go to Dashboard' },
            { keys: ['Alt', 'I'], description: 'Go to Interfaces' },
            { keys: ['Alt', 'T'], description: 'Go to Protocol Testing' },
            { keys: ['Alt', 'R'], description: 'Go to Drivers' },
            { keys: ['Alt', 'C'], description: 'Go to Configuration' }
        ],
        'General': [
            { keys: ['F1'], description: 'Open Help' },
            { keys: ['Escape'], description: 'Close dialogs/panels' },
            { keys: ['Ctrl', 'R'], description: 'Refresh current page' },
            { keys: ['Ctrl', '/'], description: 'Toggle sidebar' }
        ],
        'Interface Management': [
            { keys: ['Ctrl', 'N'], description: 'Add new interface' },
            { keys: ['Ctrl', 'S'], description: 'Save configuration' },
            { keys: ['Ctrl', 'T'], description: 'Test connection' }
        ]
    };
};

// Search function
const searchHelpContent = async (query, context) => {
    // Simulate search delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const allContent = [
        ...getHelpContent(context),
        ...getFAQContent(context).map(faq => ({
            title: faq.question,
            content: [{ type: 'text', content: typeof faq.answer === 'string' ? faq.answer : 'FAQ answer' }]
        }))
    ];
    
    const results = [];
    const queryLower = query.toLowerCase();
    
    allContent.forEach(section => {
        const titleMatch = section.title.toLowerCase().includes(queryLower);
        const contentMatch = section.content.some(item => {
            if (item.type === 'text') {
                return item.content.toLowerCase().includes(queryLower);
            }
            if (item.type === 'list') {
                return item.items.some(listItem => listItem.toLowerCase().includes(queryLower));
            }
            return false;
        });
        
        if (titleMatch || contentMatch) {
            const relevance = titleMatch ? 1.0 : 0.7;
            const excerpt = section.content
                .filter(item => item.type === 'text')
                .map(item => item.content)
                .join(' ')
                .substring(0, 150) + '...';
            
            results.push({
                title: section.title,
                excerpt,
                category: context,
                relevance
            });
        }
    });
    
    return results.sort((a, b) => b.relevance - a.relevance);
};

export default {
    HelpPanel,
    ContextHelp
};