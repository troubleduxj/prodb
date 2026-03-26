/**
 * Enhanced Quick Actions Component
 * Provides flexible quick action buttons with improved UX and accessibility
 */

import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';
import { systemStatusAPI } from '../services/api.js';
import { globalEvents, debounce } from '../utils/helpers.js';

const QuickActions = ({ 
    interfaceId, 
    status, 
    actions = ['start', 'stop', 'test', 'configure'],
    onActionComplete = null,
    size = 'normal',
    layout = 'horizontal', // 'horizontal', 'vertical', 'grid'
    showLabels = true,
    showIcons = true,
    showTooltips = true,
    confirmDestructive = true,
    maxActions = null,
    groupActions = false,
    customActions = {},
    disabled = false,
    className = '',
    navigateTo = null
}) => {
    const [loading, setLoading] = useState(new Set());
    const [lastAction, setLastAction] = useState(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(null);
    const [actionHistory, setActionHistory] = useState([]);

    // Debounced action execution to prevent double-clicks
    const debouncedExecuteAction = debounce(async (action) => {
        await executeAction(action);
    }, 300);

    // Handle action execution
    const executeAction = async (action) => {
        if (loading.has(action) || disabled) return;

        // Check if action requires confirmation
        const actionConfig = getActionConfig(action);
        if (confirmDestructive && actionConfig.destructive) {
            setShowConfirmDialog(action);
            return;
        }

        await performAction(action);
    };

    // Perform the actual action
    const performAction = async (action) => {
        if (loading.has(action)) return;

        setLoading(prev => new Set(prev).add(action));
        setLastAction(action);

        const startTime = Date.now();

        try {
            let result;
            
            // Check for custom actions first
            if (customActions[action]) {
                result = await customActions[action](interfaceId, status);
            } else {
                switch (action) {
                    case 'start':
                    case 'stop':
                    case 'restart':
                        result = await systemStatusAPI.updateInterfaceStatus(interfaceId, action);
                        break;
                        
                    case 'test':
                        // Navigate to test page with interface pre-selected
                        if (navigateTo) {
                            navigateTo(`/testing?interface=${interfaceId}`);
                            return;
                        }
                        break;
                        
                    case 'configure':
                        // Navigate to configuration page
                        if (navigateTo) {
                            navigateTo(`/config/${interfaceId}`);
                            return;
                        }
                        break;

                    case 'delete':
                        result = await systemStatusAPI.deleteInterface(interfaceId);
                        break;

                    case 'duplicate':
                        result = await systemStatusAPI.duplicateInterface(interfaceId);
                        break;

                    case 'export':
                        result = await systemStatusAPI.exportInterface(interfaceId);
                        break;
                        
                    default:
                        console.warn(`Unknown action: ${action}`);
                        return;
                }
            }

            const duration = Date.now() - startTime;

            // Add to action history
            setActionHistory(prev => [
                { action, timestamp: Date.now(), duration, success: true },
                ...prev.slice(0, 9) // Keep last 10 actions
            ]);

            // Emit success event
            globalEvents.emit('actionComplete', {
                interfaceId,
                action,
                success: true,
                result,
                duration
            });

            // Call callback if provided
            if (onActionComplete) {
                onActionComplete({ action, success: true, result, duration });
            }

        } catch (error) {
            console.error(`Failed to execute action ${action}:`, error);
            
            const duration = Date.now() - startTime;

            // Add to action history
            setActionHistory(prev => [
                { action, timestamp: Date.now(), duration, success: false, error: error.message },
                ...prev.slice(0, 9)
            ]);
            
            // Emit error event
            globalEvents.emit('actionComplete', {
                interfaceId,
                action,
                success: false,
                error: error.message,
                duration
            });

            // Call callback if provided
            if (onActionComplete) {
                onActionComplete({ action, success: false, error: error.message, duration });
            }

        } finally {
            setLoading(prev => {
                const newSet = new Set(prev);
                newSet.delete(action);
                return newSet;
            });
        }
    };

    // Handle confirmation dialog
    const handleConfirmAction = async (confirmed) => {
        const action = showConfirmDialog;
        setShowConfirmDialog(null);
        
        if (confirmed && action) {
            await performAction(action);
        }
    };

    // Get action button configuration
    const getActionConfig = (action) => {
        const configs = {
            start: {
                label: 'Start',
                icon: '▶️',
                variant: 'success',
                disabled: status === 'connected' || status === 'running',
                title: 'Start interface',
                shortcut: 'S',
                destructive: false,
                group: 'control'
            },
            stop: {
                label: 'Stop',
                icon: '⏹️',
                variant: 'warning',
                disabled: status === 'disconnected' || status === 'stopped',
                title: 'Stop interface',
                shortcut: 'T',
                destructive: false,
                group: 'control'
            },
            restart: {
                label: 'Restart',
                icon: '🔄',
                variant: 'secondary',
                disabled: status === 'disconnected' || status === 'stopped',
                title: 'Restart interface',
                shortcut: 'R',
                destructive: false,
                group: 'control'
            },
            test: {
                label: 'Test',
                icon: '🧪',
                variant: 'info',
                disabled: false,
                title: 'Test connection',
                shortcut: 'E',
                destructive: false,
                group: 'tools'
            },
            configure: {
                label: 'Config',
                icon: '⚙️',
                variant: 'secondary',
                disabled: false,
                title: 'Configure interface',
                shortcut: 'C',
                destructive: false,
                group: 'tools'
            },
            delete: {
                label: 'Delete',
                icon: '🗑️',
                variant: 'error',
                disabled: status === 'connected' || status === 'running',
                title: 'Delete interface (cannot be undone)',
                shortcut: 'D',
                destructive: true,
                group: 'danger'
            },
            duplicate: {
                label: 'Duplicate',
                icon: '📋',
                variant: 'secondary',
                disabled: false,
                title: 'Duplicate interface configuration',
                shortcut: 'U',
                destructive: false,
                group: 'tools'
            },
            export: {
                label: 'Export',
                icon: '📤',
                variant: 'secondary',
                disabled: false,
                title: 'Export interface configuration',
                shortcut: 'X',
                destructive: false,
                group: 'tools'
            },
            logs: {
                label: 'Logs',
                icon: '📋',
                variant: 'info',
                disabled: false,
                title: 'View interface logs',
                shortcut: 'L',
                destructive: false,
                group: 'tools'
            }
        };

        return configs[action] || {
            label: action,
            icon: '❓',
            variant: 'secondary',
            disabled: false,
            title: action,
            destructive: false,
            group: 'other'
        };
    };

    // Filter and sort actions based on status
    const getVisibleActions = () => {
        let visibleActions = [...actions];

        // Smart action filtering based on status
        if (status === 'connected' || status === 'running') {
            visibleActions = visibleActions.filter(action => 
                !['start'].includes(action)
            );
        } else if (status === 'disconnected' || status === 'stopped') {
            visibleActions = visibleActions.filter(action => 
                !['stop', 'restart'].includes(action)
            );
        }

        // Apply max actions limit
        if (maxActions && visibleActions.length > maxActions) {
            visibleActions = visibleActions.slice(0, maxActions);
        }

        // Group actions if requested
        if (groupActions) {
            const grouped = {};
            visibleActions.forEach(action => {
                const config = getActionConfig(action);
                if (!grouped[config.group]) {
                    grouped[config.group] = [];
                }
                grouped[config.group].push(action);
            });
            return grouped;
        }

        // Prioritize actions
        const priority = ['start', 'stop', 'restart', 'test', 'configure', 'duplicate', 'export', 'logs', 'delete'];
        return visibleActions.sort((a, b) => {
            const aIndex = priority.indexOf(a);
            const bIndex = priority.indexOf(b);
            return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
        });
    };

    const visibleActions = getVisibleActions();
    const sizeClass = size === 'small' ? 'btn-sm' : size === 'large' ? 'btn-lg' : '';

    // Render action button
    const renderActionButton = (action, index) => {
        const config = getActionConfig(action);
        const isLoading = loading.has(action);
        const isDisabled = disabled || config.disabled || isLoading;

        return html`
            <button
                key=${action}
                class="btn btn-${config.variant} ${sizeClass} ${isLoading ? 'loading' : ''} ${config.destructive ? 'destructive' : ''}"
                onClick=${() => debouncedExecuteAction(action)}
                disabled=${isDisabled}
                title=${showTooltips ? `${config.title}${config.shortcut ? ` (Alt+${config.shortcut})` : ''}` : ''}
                data-action=${action}
                aria-label=${config.title}
            >
                ${isLoading ? html`
                    <span class="spinner"></span>
                ` : showIcons ? html`
                    <span class="action-icon">${config.icon}</span>
                ` : ''}
                ${showLabels ? html`
                    <span class="action-label">${config.label}</span>
                ` : ''}
            </button>
        `;
    };

    // Render grouped actions
    const renderGroupedActions = (groupedActions) => {
        return Object.entries(groupedActions).map(([group, groupActions]) => html`
            <div class="action-group" key=${group}>
                <div class="action-group-label">${group}</div>
                <div class="action-group-buttons">
                    ${groupActions.map(renderActionButton)}
                </div>
            </div>
        `);
    };

    return html`
        <div class="quick-actions quick-actions-${layout} ${size} ${className} ${disabled ? 'disabled' : ''}">
            ${groupActions && typeof visibleActions === 'object' && !Array.isArray(visibleActions)
                ? renderGroupedActions(visibleActions)
                : Array.isArray(visibleActions) 
                    ? visibleActions.map(renderActionButton)
                    : null
            }
        </div>

        ${showConfirmDialog ? html`
            <div class="confirmation-dialog">
                <div class="confirmation-overlay" onClick=${() => handleConfirmAction(false)}></div>
                <div class="confirmation-content">
                    <div class="confirmation-header">
                        <h3>Confirm Action</h3>
                    </div>
                    <div class="confirmation-body">
                        <p>Are you sure you want to ${showConfirmDialog} this interface?</p>
                        ${showConfirmDialog === 'delete' ? html`
                            <p class="warning-text">This action cannot be undone.</p>
                        ` : ''}
                    </div>
                    <div class="confirmation-actions">
                        <button 
                            class="btn btn-secondary"
                            onClick=${() => handleConfirmAction(false)}
                        >
                            Cancel
                        </button>
                        <button 
                            class="btn btn-error"
                            onClick=${() => handleConfirmAction(true)}
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            </div>
        ` : ''}

        <style>
            /* Enhanced Quick Actions Styles */
            .quick-actions {
                display: flex;
                gap: var(--space-2);
                flex-wrap: wrap;
                align-items: center;
            }

            .quick-actions.disabled {
                opacity: 0.5;
                pointer-events: none;
            }

            /* Layout Variants */
            .quick-actions-horizontal {
                flex-direction: row;
            }

            .quick-actions-vertical {
                flex-direction: column;
                align-items: stretch;
            }

            .quick-actions-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
                gap: var(--space-2);
            }

            /* Size Variants */
            .quick-actions.small {
                gap: var(--space-1);
            }

            .quick-actions.large {
                gap: var(--space-3);
            }

            /* Action Buttons */
            .quick-actions .btn {
                display: flex;
                align-items: center;
                gap: var(--space-1);
                min-width: auto;
                white-space: nowrap;
                position: relative;
                transition: all var(--transition-normal);
            }

            .quick-actions .btn.loading {
                pointer-events: none;
            }

            .quick-actions .btn.destructive {
                border-color: var(--color-error);
            }

            .quick-actions .btn:hover {
                transform: translateY(-1px);
                box-shadow: var(--shadow-sm);
            }

            .quick-actions .btn:active {
                transform: translateY(0);
            }

            /* Action Icons and Labels */
            .action-icon {
                font-size: 0.875em;
                line-height: 1;
            }

            .action-label {
                font-size: var(--font-size-xs);
                font-weight: var(--font-weight-medium);
            }

            /* Size-specific adjustments */
            .quick-actions.small .action-label {
                display: none;
            }

            .quick-actions.small .btn {
                padding: var(--space-1) var(--space-2);
                min-width: 32px;
                justify-content: center;
            }

            .quick-actions.large .action-label {
                font-size: var(--font-size-sm);
            }

            .quick-actions.large .btn {
                padding: var(--space-3) var(--space-4);
            }

            /* Action Groups */
            .action-group {
                display: flex;
                flex-direction: column;
                gap: var(--space-2);
                padding: var(--space-3);
                background-color: var(--bg-secondary);
                border-radius: var(--border-radius);
                border: 1px solid var(--border-color);
            }

            .action-group-label {
                font-size: var(--font-size-xs);
                font-weight: var(--font-weight-semibold);
                color: var(--text-muted);
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin-bottom: var(--space-1);
            }

            .action-group-buttons {
                display: flex;
                gap: var(--space-2);
                flex-wrap: wrap;
            }

            /* Confirmation Dialog */
            .confirmation-dialog {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: var(--z-modal);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: var(--space-4);
            }

            .confirmation-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: var(--bg-overlay);
                backdrop-filter: blur(2px);
            }

            .confirmation-content {
                background-color: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-lg);
                box-shadow: var(--shadow-xl);
                padding: var(--space-6);
                max-width: 400px;
                width: 100%;
                position: relative;
                z-index: 1;
            }

            .confirmation-header h3 {
                margin: 0 0 var(--space-4) 0;
                color: var(--text-primary);
                font-size: var(--font-size-lg);
            }

            .confirmation-body {
                margin-bottom: var(--space-6);
            }

            .confirmation-body p {
                margin: 0 0 var(--space-2) 0;
                color: var(--text-secondary);
            }

            .warning-text {
                color: var(--color-warning) !important;
                font-weight: var(--font-weight-medium);
            }

            .confirmation-actions {
                display: flex;
                gap: var(--space-3);
                justify-content: flex-end;
            }

            /* Loading States */
            .spinner {
                width: 14px;
                height: 14px;
                border: 2px solid transparent;
                border-top: 2px solid currentColor;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            /* Responsive Design */
            @media (max-width: 768px) {
                .quick-actions-horizontal {
                    justify-content: center;
                }
                
                .quick-actions-grid {
                    grid-template-columns: repeat(auto-fit, minmax(60px, 1fr));
                }

                .action-group {
                    width: 100%;
                }

                .action-group-buttons {
                    justify-content: center;
                }
            }

            @media (max-width: 480px) {
                .quick-actions {
                    justify-content: center;
                }
                
                .quick-actions .btn {
                    flex: 1;
                    min-width: 0;
                    justify-content: center;
                }
                
                .action-label {
                    display: none;
                }

                .quick-actions-vertical .btn {
                    width: 100%;
                }

                .confirmation-content {
                    margin: var(--space-2);
                    padding: var(--space-4);
                }

                .confirmation-actions {
                    flex-direction: column;
                }

                .confirmation-actions .btn {
                    width: 100%;
                }
            }

            /* Accessibility */
            .quick-actions .btn:focus {
                outline: 2px solid var(--color-primary);
                outline-offset: 2px;
            }

            /* High Contrast Mode */
            @media (prefers-contrast: high) {
                .quick-actions .btn {
                    border-width: 2px;
                }

                .action-group {
                    border-width: 2px;
                }
            }

            /* Reduced Motion */
            @media (prefers-reduced-motion: reduce) {
                .quick-actions .btn {
                    transition: none;
                }

                .quick-actions .btn:hover {
                    transform: none;
                }

                .spinner {
                    animation: none;
                }
            }
        </style>
    `;
};

export default QuickActions;