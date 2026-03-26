// Mobile-Optimized Table Component
import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect, useRef } from 'https://esm.sh/preact/hooks';

const MobileTable = ({ 
    data = [], 
    columns = [], 
    onRowClick = null,
    showCardView = false,
    className = '',
    emptyMessage = 'No data available'
}) => {
    const [isMobile, setIsMobile] = useState(false);
    const [showScrollIndicators, setShowScrollIndicators] = useState({ left: false, right: false });
    const tableRef = useRef(null);

    // Check if we're on mobile
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Handle scroll indicators for horizontal scrolling
    useEffect(() => {
        const handleScroll = () => {
            if (!tableRef.current) return;
            
            const { scrollLeft, scrollWidth, clientWidth } = tableRef.current;
            setShowScrollIndicators({
                left: scrollLeft > 0,
                right: scrollLeft < scrollWidth - clientWidth - 1
            });
        };

        const tableElement = tableRef.current;
        if (tableElement) {
            handleScroll(); // Initial check
            tableElement.addEventListener('scroll', handleScroll);
            return () => tableElement.removeEventListener('scroll', handleScroll);
        }
    }, [data]);

    // Filter columns based on priority for mobile
    const getVisibleColumns = () => {
        if (!isMobile) return columns;
        
        // On mobile, show only critical and high priority columns
        const priorityOrder = ['critical', 'high', 'medium', 'low'];
        const sortedColumns = columns.sort((a, b) => {
            const aPriority = priorityOrder.indexOf(a.priority || 'medium');
            const bPriority = priorityOrder.indexOf(b.priority || 'medium');
            return aPriority - bPriority;
        });
        
        // Show critical and high priority columns, plus up to 2 medium priority
        const criticalAndHigh = sortedColumns.filter(col => 
            col.priority === 'critical' || col.priority === 'high'
        );
        const medium = sortedColumns.filter(col => col.priority === 'medium').slice(0, 2);
        
        return [...criticalAndHigh, ...medium];
    };

    // Render table view
    const renderTableView = () => {
        const visibleColumns = getVisibleColumns();
        
        return html`
            <div class="scroll-container">
                ${showScrollIndicators.left && html`
                    <div class="scroll-indicator left">‹</div>
                `}
                ${showScrollIndicators.right && html`
                    <div class="scroll-indicator right">›</div>
                `}
                <div class="mobile-table-container" ref=${tableRef}>
                    <table class="mobile-table">
                        <thead>
                            <tr>
                                ${visibleColumns.map(column => html`
                                    <th 
                                        key=${column.key}
                                        class="col-priority-${column.priority || 'medium'}"
                                    >
                                        ${column.label}
                                    </th>
                                `)}
                            </tr>
                        </thead>
                        <tbody>
                            ${data.length === 0 ? html`
                                <tr>
                                    <td colspan=${visibleColumns.length} style="text-align: center; padding: 2rem; color: var(--text-muted);">
                                        ${emptyMessage}
                                    </td>
                                </tr>
                            ` : data.map((row, index) => html`
                                <tr 
                                    key=${index}
                                    onClick=${onRowClick ? () => onRowClick(row, index) : null}
                                    style=${onRowClick ? 'cursor: pointer;' : ''}
                                    class=${onRowClick ? 'clickable-row' : ''}
                                >
                                    ${visibleColumns.map(column => html`
                                        <td 
                                            key=${column.key}
                                            class="col-priority-${column.priority || 'medium'}"
                                        >
                                            ${column.render ? column.render(row[column.key], row, index) : row[column.key]}
                                        </td>
                                    `)}
                                </tr>
                            `)}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    };

    // Render card view for mobile
    const renderCardView = () => {
        if (data.length === 0) {
            return html`
                <div class="empty-results">
                    <div class="empty-icon">📋</div>
                    <p>${emptyMessage}</p>
                </div>
            `;
        }

        return html`
            <div class="mobile-card-list">
                ${data.map((row, index) => html`
                    <div 
                        key=${index}
                        class="mobile-card-item ${onRowClick ? 'clickable' : ''}"
                        onClick=${onRowClick ? () => onRowClick(row, index) : null}
                    >
                        <div class="mobile-card-header">
                            <h4 class="mobile-card-title">
                                ${columns.find(col => col.priority === 'critical')?.render 
                                    ? columns.find(col => col.priority === 'critical').render(row[columns.find(col => col.priority === 'critical').key], row, index)
                                    : row[columns.find(col => col.priority === 'critical')?.key] || `Item ${index + 1}`
                                }
                            </h4>
                            ${columns.find(col => col.key === 'status') && html`
                                <div class="mobile-card-status">
                                    ${columns.find(col => col.key === 'status').render 
                                        ? columns.find(col => col.key === 'status').render(row.status, row, index)
                                        : row.status
                                    }
                                </div>
                            `}
                        </div>
                        <div class="mobile-card-details">
                            ${columns
                                .filter(col => col.priority !== 'critical' && col.key !== 'status')
                                .slice(0, 6) // Limit to 6 details on mobile
                                .map(column => html`
                                    <div key=${column.key} class="mobile-card-detail">
                                        <span class="mobile-card-label">${column.label}</span>
                                        <span class="mobile-card-value">
                                            ${column.render ? column.render(row[column.key], row, index) : row[column.key] || '-'}
                                        </span>
                                    </div>
                                `)
                            }
                        </div>
                    </div>
                `)}
            </div>
        `;
    };

    return html`
        <div class="mobile-table-wrapper ${className}">
            ${(isMobile && showCardView) ? renderCardView() : renderTableView()}
        </div>
    `;
};

export default MobileTable;