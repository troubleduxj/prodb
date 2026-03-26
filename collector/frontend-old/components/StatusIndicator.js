/**
 * Enhanced Status Indicator Component
 * Displays status with appropriate colors, icons, and animations
 */

import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';
import { getStatusColor, getStatusIcon, formatDuration, formatNumber, formatPercentage } from '../utils/helpers.js';

const StatusIndicator = ({ 
    value, 
    type = 'status', 
    size = 'normal',
    label = null,
    showIcon = true,
    showText = true,
    showPulse = false,
    showTrend = false,
    previousValue = null,
    onClick = null,
    className = '',
    style = {},
    tooltip = null,
    variant = 'default', // 'default', 'badge', 'card', 'minimal'
    animate = true,
    customIcon = null,
    customColor = null
}) => {
    const [isAnimating, setIsAnimating] = useState(false);
    const [trend, setTrend] = useState(null);

    // Calculate trend if previous value is provided
    useEffect(() => {
        if (showTrend && previousValue !== null && value !== previousValue) {
            if (type === 'counter' || type === 'percentage') {
                setTrend(value > previousValue ? 'up' : 'down');
                if (animate) {
                    setIsAnimating(true);
                    setTimeout(() => setIsAnimating(false), 300);
                }
            }
        }
    }, [value, previousValue, showTrend, type, animate]);

    // Format value based on type
    const formatValue = (val, type) => {
        if (val === null || val === undefined) return '--';
        
        switch (type) {
            case 'status':
                return String(val).charAt(0).toUpperCase() + String(val).slice(1);
            case 'counter':
                return formatNumber(val);
            case 'percentage':
                return formatPercentage(val / 100);
            case 'duration':
                return formatDuration(val);
            case 'bytes':
                return formatFileSize(val);
            case 'rate':
                return `${formatNumber(val)}/s`;
            case 'currency':
                return new Intl.NumberFormat('en-US', { 
                    style: 'currency', 
                    currency: 'USD' 
                }).format(val);
            case 'info':
            default:
                return String(val);
        }
    };

    // Format file size helper
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    // Get color for non-status types
    const getTypeColor = (type, value) => {
        switch (type) {
            case 'counter':
                return value > 0 ? 'var(--color-success)' : 'var(--text-muted)';
            case 'percentage':
                if (value >= 0.8) return 'var(--color-error)';
                if (value >= 0.6) return 'var(--color-warning)';
                return 'var(--color-success)';
            case 'rate':
                return value > 0 ? 'var(--color-info)' : 'var(--text-muted)';
            default:
                return 'var(--text-primary)';
        }
    };

    // Get icon for non-status types
    const getTypeIcon = (type) => {
        const icons = {
            counter: '📊',
            percentage: '📈',
            duration: '⏱️',
            bytes: '💾',
            rate: '⚡',
            currency: '💰',
            info: 'ℹ️'
        };
        return showIcon ? icons[type] : null;
    };

    const formattedValue = formatValue(value, type);
    const statusColor = customColor || (type === 'status' ? getStatusColor(value) : getTypeColor(type, value));
    const statusIcon = customIcon || (type === 'status' && showIcon ? getStatusIcon(value) : getTypeIcon(type));



    // Get trend icon
    const getTrendIcon = () => {
        if (!showTrend || !trend) return null;
        return trend === 'up' ? '↗️' : '↘️';
    };

    const sizeClasses = {
        small: 'status-indicator-sm',
        normal: 'status-indicator',
        large: 'status-indicator-lg'
    };

    const variantClasses = {
        default: 'status-variant-default',
        badge: 'status-variant-badge',
        card: 'status-variant-card',
        minimal: 'status-variant-minimal'
    };

    const componentClass = [
        sizeClasses[size],
        variantClasses[variant],
        isAnimating ? 'animating' : '',
        showPulse ? 'pulse' : '',
        onClick ? 'clickable' : '',
        className
    ].filter(Boolean).join(' ');

    const tooltipText = tooltip || (label ? `${label}: ${formattedValue}` : formattedValue);

    if (variant === 'badge') {
        return html`
            <span 
                class="${componentClass} status-${String(value).toLowerCase()}"
                style=${{ color: statusColor, ...style }}
                title="${tooltipText}"
                onClick=${onClick}
            >
                ${statusIcon && showIcon ? html`<span class="status-icon">${statusIcon}</span>` : ''}
                ${showText ? html`<span class="status-text">${formattedValue}</span>` : ''}
                ${getTrendIcon() ? html`<span class="trend-icon">${getTrendIcon()}</span>` : ''}
            </span>
        `;
    }

    if (variant === 'card') {
        return html`
            <div 
                class="${componentClass}"
                title="${tooltipText}"
                onClick=${onClick}
                style=${style}
            >
                <div class="status-card-header">
                    ${statusIcon && showIcon ? html`<span class="status-icon" style="color: ${statusColor}">${statusIcon}</span>` : ''}
                    ${label ? html`<span class="status-label">${label}</span>` : ''}
                    ${getTrendIcon() ? html`<span class="trend-icon">${getTrendIcon()}</span>` : ''}
                </div>
                <div class="status-card-value" style="color: ${statusColor}">
                    ${formattedValue}
                </div>
            </div>
        `;
    }

    if (variant === 'minimal') {
        return html`
            <span 
                class="${componentClass}"
                style=${{ color: statusColor, ...style }}
                title="${tooltipText}"
                onClick=${onClick}
            >
                ${statusIcon && showIcon ? statusIcon : ''}
                ${showText && statusIcon && showIcon ? ' ' : ''}
                ${showText ? formattedValue : ''}
            </span>
        `;
    }

    // Default variant
    if (type === 'status') {
        return html`
            <span 
                class="${componentClass} status-${String(value).toLowerCase()}"
                style=${{ color: statusColor, ...style }}
                title="${tooltipText}"
                onClick=${onClick}
            >
                ${statusIcon && showIcon ? html`<span class="status-icon">${statusIcon}</span>` : ''}
                ${showText ? html`<span class="status-text">${formattedValue}</span>` : ''}
                ${getTrendIcon() ? html`<span class="trend-icon">${getTrendIcon()}</span>` : ''}
            </span>
        `;
    }

    // For non-status types (counter, info, etc.)
    return html`
        <div 
            class="${componentClass} status-item" 
            title="${tooltipText}"
            onClick=${onClick}
            style=${style}
        >
            <div class="status-item-header">
                ${statusIcon && showIcon ? html`<span class="status-icon" style="color: ${statusColor}">${statusIcon}</span>` : ''}
                ${label ? html`<span class="status-label">${label}</span>` : ''}
                ${getTrendIcon() ? html`<span class="trend-icon">${getTrendIcon()}</span>` : ''}
            </div>
            <span class="status-value" style="color: ${statusColor}">
                ${formattedValue}
            </span>
        </div>
    `;
};

export default StatusIndicator;

// Add enhanced styles
const statusIndicatorStyles = html`
    <style>
        /* Enhanced Status Indicator Styles */
        .status-indicator,
        .status-indicator-sm,
        .status-indicator-lg {
            display: inline-flex;
            align-items: center;
            gap: var(--space-2);
            font-weight: var(--font-weight-medium);
            transition: all var(--transition-normal);
        }

        .status-indicator-sm {
            font-size: var(--font-size-xs);
            gap: var(--space-1);
        }

        .status-indicator-lg {
            font-size: var(--font-size-lg);
            gap: var(--space-3);
        }

        /* Variant Styles */
        .status-variant-badge {
            padding: var(--space-1) var(--space-3);
            border-radius: 9999px;
            font-size: var(--font-size-xs);
            font-weight: var(--font-weight-semibold);
            background-color: rgba(255, 255, 255, 0.1);
            border: 1px solid currentColor;
        }

        .status-variant-card {
            background-color: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius);
            padding: var(--space-4);
            min-width: 120px;
            text-align: center;
        }

        .status-variant-minimal {
            font-size: var(--font-size-sm);
        }

        /* Card Variant Specific */
        .status-card-header {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: var(--space-2);
            margin-bottom: var(--space-2);
        }

        .status-card-value {
            font-size: var(--font-size-xl);
            font-weight: var(--font-weight-bold);
            line-height: 1;
        }

        /* Status Item (for non-status types) */
        .status-item {
            display: flex;
            flex-direction: column;
            gap: var(--space-1);
        }

        .status-item-header {
            display: flex;
            align-items: center;
            gap: var(--space-2);
        }

        .status-label {
            font-size: var(--font-size-xs);
            color: var(--text-muted);
            font-weight: var(--font-weight-medium);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .status-value {
            font-size: var(--font-size-lg);
            font-weight: var(--font-weight-semibold);
            line-height: 1;
        }

        .status-icon {
            font-size: 1em;
            line-height: 1;
        }

        .trend-icon {
            font-size: var(--font-size-xs);
            opacity: 0.8;
        }

        /* Interactive States */
        .clickable {
            cursor: pointer;
        }

        .clickable:hover {
            transform: translateY(-1px);
            box-shadow: var(--shadow-sm);
        }

        /* Animation States */
        .animating {
            animation: statusPulse 0.3s ease-in-out;
        }

        .pulse .status-icon {
            animation: iconPulse 2s infinite;
        }

        @keyframes statusPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }

        @keyframes iconPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
        }

        /* Status-specific colors */
        .status-connected,
        .status-online,
        .status-running,
        .status-active {
            color: var(--color-success);
        }

        .status-disconnected,
        .status-offline,
        .status-stopped,
        .status-pending {
            color: var(--color-warning);
        }

        .status-error,
        .status-failed,
        .status-timeout {
            color: var(--color-error);
        }

        .status-testing,
        .status-loading,
        .status-processing {
            color: var(--color-info);
        }

        /* Size-specific adjustments */
        .status-indicator-sm .status-card-value {
            font-size: var(--font-size-lg);
        }

        .status-indicator-lg .status-card-value {
            font-size: var(--font-size-3xl);
        }

        .status-indicator-sm .status-variant-card {
            padding: var(--space-2);
            min-width: 80px;
        }

        .status-indicator-lg .status-variant-card {
            padding: var(--space-6);
            min-width: 160px;
        }

        /* Responsive adjustments */
        @media (max-width: 480px) {
            .status-variant-card {
                min-width: 100px;
                padding: var(--space-3);
            }

            .status-card-value {
                font-size: var(--font-size-lg);
            }
        }
    </style>
`;

// Append styles to component
StatusIndicator.styles = statusIndicatorStyles;