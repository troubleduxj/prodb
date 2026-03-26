/**
 * Dialog Component
 * Specialized modal for confirmations, alerts, and simple interactions
 */

import { html } from 'https://esm.sh/htm/preact';
import { useState } from 'https://esm.sh/preact/hooks';
import Modal from './Modal.js';

const Dialog = ({
    isOpen = false,
    onClose = null,
    onConfirm = null,
    onCancel = null,
    title = '',
    message = '',
    type = 'info', // 'info', 'warning', 'error', 'success', 'confirm'
    confirmText = 'OK',
    cancelText = 'Cancel',
    showCancel = false,
    loading = false,
    children = null,
    icon = null,
    className = '',
    size = 'small'
}) => {
    const [isProcessing, setIsProcessing] = useState(false);

    // Handle confirm action
    const handleConfirm = async () => {
        if (isProcessing || loading) return;

        if (onConfirm) {
            setIsProcessing(true);
            try {
                await onConfirm();
                onClose?.();
            } catch (error) {
                console.error('Dialog confirm action failed:', error);
            } finally {
                setIsProcessing(false);
            }
        } else {
            onClose?.();
        }
    };

    // Handle cancel action
    const handleCancel = () => {
        if (isProcessing || loading) return;
        
        if (onCancel) {
            onCancel();
        }
        onClose?.();
    };

    // Get type-specific configuration
    const getTypeConfig = (type) => {
        const configs = {
            info: {
                icon: 'ℹ️',
                variant: 'info',
                confirmVariant: 'primary'
            },
            warning: {
                icon: '⚠️',
                variant: 'confirmation',
                confirmVariant: 'warning'
            },
            error: {
                icon: '❌',
                variant: 'confirmation',
                confirmVariant: 'error'
            },
            success: {
                icon: '✅',
                variant: 'info',
                confirmVariant: 'success'
            },
            confirm: {
                icon: '❓',
                variant: 'confirmation',
                confirmVariant: 'primary'
            }
        };

        return configs[type] || configs.info;
    };

    const typeConfig = getTypeConfig(type);
    const dialogIcon = icon || typeConfig.icon;

    // Footer content
    const footerContent = html`
        <div class="dialog-actions">
            ${showCancel || type === 'confirm' ? html`
                <button 
                    class="btn btn-secondary"
                    onClick=${handleCancel}
                    disabled=${isProcessing || loading}
                    type="button"
                >
                    ${cancelText}
                </button>
            ` : ''}
            <button 
                class="btn btn-${typeConfig.confirmVariant} ${isProcessing || loading ? 'loading' : ''}"
                onClick=${handleConfirm}
                disabled=${isProcessing || loading}
                type="button"
            >
                ${isProcessing || loading ? html`
                    <span class="spinner"></span>
                ` : ''}
                ${confirmText}
            </button>
        </div>
    `;

    return html`
        <${Modal}
            isOpen=${isOpen}
            onClose=${onClose}
            title=${title}
            size=${size}
            variant=${typeConfig.variant}
            showFooter=${true}
            footerContent=${footerContent}
            closeOnOverlayClick=${!isProcessing && !loading}
            closeOnEscape=${!isProcessing && !loading}
            className="dialog ${className}"
        >
            <div class="dialog-content">
                ${dialogIcon ? html`
                    <div class="dialog-icon dialog-icon-${type}">
                        ${dialogIcon}
                    </div>
                ` : ''}
                
                <div class="dialog-message">
                    ${message ? html`<p class="dialog-text">${message}</p>` : ''}
                    ${children}
                </div>
            </div>
        </${Modal}>

        <style>
            /* Dialog Styles */
            .dialog-content {
                display: flex;
                align-items: flex-start;
                gap: var(--space-4);
                text-align: left;
            }

            .dialog-icon {
                font-size: var(--font-size-2xl);
                line-height: 1;
                flex-shrink: 0;
                margin-top: var(--space-1);
            }

            .dialog-icon-info {
                color: var(--color-info);
            }

            .dialog-icon-warning {
                color: var(--color-warning);
            }

            .dialog-icon-error {
                color: var(--color-error);
            }

            .dialog-icon-success {
                color: var(--color-success);
            }

            .dialog-icon-confirm {
                color: var(--color-primary);
            }

            .dialog-message {
                flex: 1;
                min-width: 0;
            }

            .dialog-text {
                color: var(--text-secondary);
                line-height: var(--line-height-relaxed);
                margin: 0;
            }

            .dialog-actions {
                display: flex;
                gap: var(--space-3);
                justify-content: flex-end;
                width: 100%;
            }

            /* Single column layout for small dialogs */
            @media (max-width: 480px) {
                .dialog-content {
                    flex-direction: column;
                    text-align: center;
                    gap: var(--space-3);
                }

                .dialog-icon {
                    align-self: center;
                    margin-top: 0;
                }

                .dialog-actions {
                    flex-direction: column;
                }

                .dialog-actions .btn {
                    width: 100%;
                }
            }
        </style>
    `;
};

// Utility functions for common dialog types
Dialog.alert = (message, title = 'Alert') => {
    return new Promise((resolve) => {
        // This would need to be implemented with a global dialog manager
        // For now, return a resolved promise
        resolve();
    });
};

Dialog.confirm = (message, title = 'Confirm') => {
    return new Promise((resolve) => {
        // This would need to be implemented with a global dialog manager
        // For now, return a resolved promise with true
        resolve(true);
    });
};

Dialog.prompt = (message, defaultValue = '', title = 'Input') => {
    return new Promise((resolve) => {
        // This would need to be implemented with a global dialog manager
        // For now, return a resolved promise with the default value
        resolve(defaultValue);
    });
};

export default Dialog;