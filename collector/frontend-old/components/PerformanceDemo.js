/**
 * Performance Demo Component
 * Demonstrates virtual scrolling, lazy loading, and caching features
 */

import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect, useMemo } from 'https://esm.sh/preact/hooks';
import VirtualScrollList from './VirtualScrollList.js';
import { lazyLoad, preloadComponents } from '../utils/lazy-loader.js';
import { debounce, performanceMonitor, globalStateCache } from '../utils/performance.js';
import { enhancedSystemStatusAPI } from '../services/enhanced-api.js';

// Lazy load heavy components
const LazyChart = lazyLoad(
    () => import('./Chart.js'),
    {
        cacheKey: 'chart-component',
        fallback: html`<div class="loading-chart">Loading chart...</div>`,
        errorFallback: (error) => html`<div class="error-chart">Failed to load chart: ${error.message}</div>`
    }
);

const LazyDataTable = lazyLoad(
    () => import('./DataTable.js'),
    {
        cacheKey: 'data-table-component',
        fallback: html`<div class="loading-table">Loading data table...</div>`
    }
);

const PerformanceDemo = () => {
    const [activeTab, setActiveTab] = useState('virtual-scroll');
    const [searchQuery, setSearchQuery] = useState('');
    const [largeDataset, setLargeDataset] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [performanceStats, setPerformanceStats] = useState({});
    const [cacheStats, setCacheStats] = useState({});

    // Generate large dataset for virtual scrolling demo
    useEffect(() => {
        const timer = performanceMonitor.start('generate-large-dataset');
        
        const data = [];
        for (let i = 0; i < 10000; i++) {
            data.push({
                id: i,
                name: `Item ${i}`,
                value: Math.random() * 1000,
                status: ['active', 'inactive', 'pending'][Math.floor(Math.random() * 3)],
                timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
                description: `This is a description for item ${i} with some additional text to make it longer`
            });
        }
        
        setLargeDataset(data);
        setFilteredData(data);
        timer.end();
    }, []);

    // Debounced search function
    const debouncedSearch = useMemo(() => 
        debounce((query) => {
            const timer = performanceMonitor.start('filter-dataset');
            
            if (!query.trim()) {
                setFilteredData(largeDataset);
            } else {
                const filtered = largeDataset.filter(item =>
                    item.name.toLowerCase().includes(query.toLowerCase()) ||
                    item.description.toLowerCase().includes(query.toLowerCase())
                );
                setFilteredData(filtered);
            }
            
            timer.end();
        }, 300),
        [largeDataset]
    );

    // Handle search input
    useEffect(() => {
        debouncedSearch(searchQuery);
    }, [searchQuery, debouncedSearch]);

    // Update performance stats periodically
    useEffect(() => {
        const updateStats = () => {
            setPerformanceStats(performanceMonitor.getMetrics());
            setCacheStats(globalStateCache.getStats());
        };

        updateStats();
        const interval = setInterval(updateStats, 2000);
        return () => clearInterval(interval);
    }, []);

    // Preload components when demo loads
    useEffect(() => {
        preloadComponents([
            { importFn: () => import('./Chart.js'), cacheKey: 'chart-component' },
            { importFn: () => import('./DataTable.js'), cacheKey: 'data-table-component' }
        ]).catch(error => {
            console.warn('Failed to preload some components:', error);
        });
    }, []);

    // Virtual scroll item renderer
    const renderVirtualItem = (item, index, props) => {
        return html`
            <div 
                ...${props}
                class="virtual-item ${item.status}"
                key=${item.id}
            >
                <div class="item-header">
                    <span class="item-name">${item.name}</span>
                    <span class="item-status status-${item.status}">${item.status}</span>
                </div>
                <div class="item-content">
                    <div class="item-value">Value: ${item.value.toFixed(2)}</div>
                    <div class="item-timestamp">${new Date(item.timestamp).toLocaleString()}</div>
                </div>
                <div class="item-description">${item.description}</div>
            </div>
        `;
    };

    // Cache demo functions
    const testCachePerformance = async () => {
        const timer = performanceMonitor.start('cache-performance-test');
        
        // Test multiple API calls with caching
        const promises = [];
        for (let i = 0; i < 10; i++) {
            promises.push(enhancedSystemStatusAPI.getStatus());
        }
        
        await Promise.all(promises);
        timer.end();
        
        // Update stats
        setPerformanceStats(performanceMonitor.getMetrics());
        setCacheStats(globalStateCache.getStats());
    };

    const clearAllCaches = () => {
        globalStateCache.clear();
        performanceMonitor.reset();
        setCacheStats(globalStateCache.getStats());
        setPerformanceStats({});
    };

    return html`
        <div class="performance-demo">
            <div class="demo-header">
                <h2>Performance Optimization Demo</h2>
                <div class="demo-tabs">
                    <button 
                        class=${activeTab === 'virtual-scroll' ? 'active' : ''}
                        onClick=${() => setActiveTab('virtual-scroll')}
                    >
                        Virtual Scrolling
                    </button>
                    <button 
                        class=${activeTab === 'lazy-loading' ? 'active' : ''}
                        onClick=${() => setActiveTab('lazy-loading')}
                    >
                        Lazy Loading
                    </button>
                    <button 
                        class=${activeTab === 'caching' ? 'active' : ''}
                        onClick=${() => setActiveTab('caching')}
                    >
                        Smart Caching
                    </button>
                    <button 
                        class=${activeTab === 'performance' ? 'active' : ''}
                        onClick=${() => setActiveTab('performance')}
                    >
                        Performance Stats
                    </button>
                </div>
            </div>

            <div class="demo-content">
                ${activeTab === 'virtual-scroll' && html`
                    <div class="virtual-scroll-demo">
                        <div class="demo-controls">
                            <h3>Virtual Scrolling Demo (${largeDataset.length.toLocaleString()} items)</h3>
                            <div class="search-container">
                                <input
                                    type="text"
                                    placeholder="Search items..."
                                    value=${searchQuery}
                                    onInput=${(e) => setSearchQuery(e.target.value)}
                                    class="search-input"
                                />
                                <span class="search-results">
                                    Showing ${filteredData.length.toLocaleString()} of ${largeDataset.length.toLocaleString()} items
                                </span>
                            </div>
                        </div>
                        
                        <${VirtualScrollList}
                            items=${filteredData}
                            itemHeight=${120}
                            containerHeight=${500}
                            renderItem=${renderVirtualItem}
                            overscan=${5}
                            className="demo-virtual-list"
                        />
                        
                        <div class="demo-info">
                            <p>
                                <strong>Virtual scrolling</strong> renders only visible items, maintaining smooth performance 
                                even with ${largeDataset.length.toLocaleString()} items. Try scrolling and searching to see the performance benefits.
                            </p>
                        </div>
                    </div>
                `}

                ${activeTab === 'lazy-loading' && html`
                    <div class="lazy-loading-demo">
                        <h3>Lazy Loading Demo</h3>
                        
                        <div class="lazy-components">
                            <div class="component-section">
                                <h4>Lazy Chart Component</h4>
                                <${LazyChart} 
                                    data=${filteredData.slice(0, 100)}
                                    type="line"
                                />
                            </div>
                            
                            <div class="component-section">
                                <h4>Lazy Data Table Component</h4>
                                <${LazyDataTable} 
                                    data=${filteredData.slice(0, 50)}
                                    columns=${['name', 'value', 'status', 'timestamp']}
                                />
                            </div>
                        </div>
                        
                        <div class="demo-info">
                            <p>
                                <strong>Lazy loading</strong> components are loaded only when needed, reducing initial bundle size 
                                and improving page load performance. Components are cached after first load.
                            </p>
                        </div>
                    </div>
                `}

                ${activeTab === 'caching' && html`
                    <div class="caching-demo">
                        <h3>Smart Caching Demo</h3>
                        
                        <div class="cache-controls">
                            <button onClick=${testCachePerformance} class="btn btn-primary">
                                Test Cache Performance
                            </button>
                            <button onClick=${clearAllCaches} class="btn btn-secondary">
                                Clear All Caches
                            </button>
                        </div>
                        
                        <div class="cache-stats">
                            <div class="stat-card">
                                <h4>Cache Statistics</h4>
                                <div class="stats-grid">
                                    <div class="stat-item">
                                        <span class="stat-label">Cache Size:</span>
                                        <span class="stat-value">${cacheStats.size || 0}</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="stat-label">Cache Keys:</span>
                                        <span class="stat-value">${cacheStats.keys?.length || 0}</span>
                                    </div>
                                </div>
                                
                                ${cacheStats.keys && cacheStats.keys.length > 0 && html`
                                    <div class="cache-keys">
                                        <h5>Cached Keys:</h5>
                                        <ul>
                                            ${cacheStats.keys.map(key => html`
                                                <li key=${key}>${key}</li>
                                            `)}
                                        </ul>
                                    </div>
                                `}
                            </div>
                        </div>
                        
                        <div class="demo-info">
                            <p>
                                <strong>Smart caching</strong> reduces API calls by intelligently caching responses with TTL, 
                                dependency tracking, and automatic invalidation. Test the performance difference!
                            </p>
                        </div>
                    </div>
                `}

                ${activeTab === 'performance' && html`
                    <div class="performance-stats-demo">
                        <h3>Performance Statistics</h3>
                        
                        <div class="performance-grid">
                            ${Object.entries(performanceStats).map(([label, stats]) => html`
                                <div class="performance-card" key=${label}>
                                    <h4>${label}</h4>
                                    <div class="performance-metrics">
                                        <div class="metric">
                                            <span class="metric-label">Count:</span>
                                            <span class="metric-value">${stats.count}</span>
                                        </div>
                                        <div class="metric">
                                            <span class="metric-label">Avg Time:</span>
                                            <span class="metric-value">${stats.avgTime?.toFixed(2)}ms</span>
                                        </div>
                                        <div class="metric">
                                            <span class="metric-label">Min Time:</span>
                                            <span class="metric-value">${stats.minTime?.toFixed(2)}ms</span>
                                        </div>
                                        <div class="metric">
                                            <span class="metric-label">Max Time:</span>
                                            <span class="metric-value">${stats.maxTime?.toFixed(2)}ms</span>
                                        </div>
                                        <div class="metric">
                                            <span class="metric-label">Total Time:</span>
                                            <span class="metric-value">${stats.totalTime?.toFixed(2)}ms</span>
                                        </div>
                                    </div>
                                </div>
                            `)}
                        </div>
                        
                        ${Object.keys(performanceStats).length === 0 && html`
                            <div class="no-stats">
                                <p>No performance data available. Try using other demo features to generate statistics.</p>
                            </div>
                        `}
                        
                        <div class="demo-info">
                            <p>
                                <strong>Performance monitoring</strong> tracks execution times for all operations, 
                                helping identify bottlenecks and optimization opportunities.
                            </p>
                        </div>
                    </div>
                `}
            </div>
        </div>
    `;
};

export default PerformanceDemo;