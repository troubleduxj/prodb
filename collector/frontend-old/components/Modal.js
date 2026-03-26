/**
 * Enhanced Modal Component
 * Provides flexible modal dialogs with various configurations
 */

import { html } from 'https://esm.sh/htm/preact';
import { useEffect, useRef } from 'https://esm.sh/preact/hooks';
import { globalEvents } from '../utils/helpers.js';

const Modal = ({
    isOpen = false,
    onClose = null,
    title = '',
    children,
    size = 'medium', // 'small', 'medium', 'large', 'fullscreen'
    variant = 'default', // 'default', 'confirmation', 'form', 'info'
    showCloseButton = true,
    closeOnOverlayClick = true,
    closeOnEscape = true,
    showHeader = true,
    showFooter = false,
    footerContent = null,
    className = '',
    style = {},
    zIndex = null,
    animate = true,
    preventBodyScroll = true,
    focusTrap = true,
    ariaLabel = null,
    ariaDescribedBy = null
}) => {
    const modalRef = useRef(null);
    const overlayRef = useRef(null);
    const previousActiveElement = useRef(null);

    // Handle escape key
    useEffect(() => {
        if (!isOpen || !closeOnEscape) return;

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose?.();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, closeOnEscape, onClose]);

    // Handle body scroll prevention
    useEffect(() => {
        if (!preventBodyScroll) return;

        if (isOpen) {
            const scrollY = window.scrollY;
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';
        } else {
            const scrollY = document.body.style.top;
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            if (scrollY) {
                window.scrollTo(0, parseInt(scrollY || '0') * -1);
            }
        }

        return () => {
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
        };
    }, [isOpen, preventBodyScroll]);

    // Handle focus management
    useEffect(() => {
        if (!focusTrap) return;

        if (isOpen) {
            previousActiveElement.current = document.activeElement;
            
            // Focus the modal after a brief delay to ensure it's rendered
            setTimeout(() => {
                const focusableElements = modalRef.current?.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (focusableElements?.length > 0) {
                    focusableElements[0].focus();
                }
            }, 100);
        } else {
            // Restore focus to previous element
            if (previousActiveElement.current) {
                previousActiveElement.current.focus();
            }
        }
    }, [isOpen, focusTrap]);

    // Handle focus trap
    useEffect(() => {
        if (!isOpen || !focusTrap) return;

        const handleTabKey = (e) => {
            if (e.key !== 'Tab') return;

            const focusableElements = modalRef.current?.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );

            if (!focusableElements || focusableElements.length === 0) return;

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        };

        document.addEventListener('keydown', handleTabKey);
        return () => document.removeEventListener('keydown', handleTabKey);
    }, [isOpen, focusTrap]);

    // Handle overlay click
    const handleOverlayClick = (e) => {
        if (closeOnOverlayClick && e.target === overlayRef.current) {
            onClose?.();
        }
    };

    // Emit modal events
    useEffect(() => {
        if (isOpen) {
            globalEvents.emit('modalOpened', { title, variant, size });
        } else {
            globalEvents.emit('modalClosed', { title, variant, size });
        }
    }, [isOpen, title, variant, size]);

    if (!isOpen) return null;

    const sizeClasses = {
        small: 'modal-small',
        medium: 'modal-medium',
        large: 'modal-large',
        fullscreen: 'modal-fullscreen'
    };

    const variantClasses = {
        default: 'modal-default',
        confirmation: 'modal-confirmation',
        form: 'modal-form',
        info: 'modal-info'
    };

    const modalClasses = [
        'modal-content',
        sizeClasses[size],
        variantClasses[variant],
        animate ? 'modal-animate' : '',
        className
    ].filter(Boolean).join(' ');

    const modalStyle = {
        zIndex: zIndex || 'var(--z-modal)',
        ...style
    };

    return html`
        <div 
            class="modal-overlay ${animate ? 'modal-overlay-animate' : ''}"
            ref=${overlayRef}
            onClick=${handleOverlayClick}
            style=${{ zIndex: zIndex || 'var(--z-modal)' }}
        >
            <div 
                class="${modalClasses}"
                ref=${modalRef}
                role="dialog"
                aria-modal="true"
                aria-label=${ariaLabel || title}
                aria-describedby=${ariaDescribedBy}
                style=${modalStyle}
            >
                ${showHeader ? html`
                    <div class="modal-header">
                        <h2 class="modal-title">${title}</h2>
                        ${showCloseButton ? html`
                            <button 
                                class="modal-close-button"
                                onClick=${onClose}
                                aria-label="Close modal"
                                type="button"
                            >
                                ✕
                            </button>
                        ` : ''}
                    </div>
                ` : ''}

                <div class="modal-body">
                    ${children}
                </div>

                ${showFooter && footerContent ? html`
                    <div class="modal-footer">
                        ${footerContent}
                    </div>
                ` : ''}
            </div>
        </div>

        <style>
            /* Modal Overlay */
            .modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: var(--bg-overlay);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: var(--space-4);
                backdrop-filter: blur(2px);
            }

            .modal-overlay-animate {
                animation: modalOverlayFadeIn var(--transition-normal);
            }

            /* Modal Content */
            .modal-content {
                background-color: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-lg);
                box-shadow: var(--shadow-xl);
                display: flex;
                flex-direction: column;
                max-height: 90vh;
                overflow: hidden;
                position: relative;
            }

            .modal-animate {
                animation: modalSlideIn var(--transition-normal);
            }

            /* Modal Sizes */
            .modal-small {
                width: 100%;
                max-width: 400px;
            }

            .modal-medium {
                width: 100%;
                max-width: 600px;
            }

            .modal-large {
                width: 100%;
                max-width: 900px;
            }

            .modal-fullscreen {
                width: 100vw;
                height: 100vh;
                max-width: none;
                max-height: none;
                border-radius: 0;
            }

            /* Modal Header */
            .modal-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: var(--space-6);
                border-bottom: 1px solid var(--border-color);
                background-color: var(--bg-secondary);
            }

            .modal-title {
                font-size: var(--font-size-xl);
                font-weight: var(--font-weight-semibold);
                color: var(--text-primary);
                margin: 0;
            }

            .modal-close-button {
                background: none;
                border: none;
                color: var(--text-muted);
                cursor: pointer;
                font-size: var(--font-size-lg);
                padding: var(--space-2);
                border-radius: var(--border-radius);
                transition: all var(--transition-normal);
                line-height: 1;
            }

            .modal-close-button:hover {
                background-color: var(--bg-hover);
                color: var(--text-primary);
            }

            /* Modal Body */
            .modal-body {
                padding: var(--space-6);
                overflow-y: auto;
                flex: 1;
            }

            /* Modal Footer */
            .modal-footer {
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: var(--space-3);
                padding: var(--space-6);
                border-top: 1px solid var(--border-color);
                background-color: var(--bg-secondary);
            }

            /* Modal Variants */
            .modal-confirmation .modal-header {
                background-color: var(--color-warning);
                color: white;
            }

            .modal-confirmation .modal-title {
                color: white;
            }

            .modal-info .modal-header {
                background-color: var(--color-info);
                color: white;
            }

            .modal-info .modal-title {
                color: white;
            }

            .modal-form .modal-body {
                padding: var(--space-8);
            }

            /* Animations */
            @keyframes modalOverlayFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            @keyframes modalSlideIn {
                from { 
                    opacity: 0;
                    transform: translateY(-20px) scale(0.95);
                }
                to { 
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }

            /* Responsive Design */
            @media (max-width: 768px) {
                .modal-overlay {
                    padding: var(--space-2);
                }

                .modal-content {
                    max-height: 95vh;
                }

                .modal-small,
                .modal-medium,
                .modal-large {
                    width: 100%;
                    max-width: none;
                }

                .modal-header,
                .modal-body,
                .modal-footer {
                    padding: var(--space-4);
                }

                .modal-title {
                    font-size: var(--font-size-lg);
                }
            }

            @media (max-width: 480px) {
                .modal-overlay {
                    padding: var(--space-1);
                }

                .modal-header,
                .modal-body,
                .modal-footer {
                    padding: var(--space-3);
                }

                .modal-footer {
                    flex-direction: column;
                    gap: var(--space-2);
                }

                .modal-footer button {
                    width: 100%;
                }
            }

            /* Reduced Motion */
            @media (prefers-reduced-motion: reduce) {
                .modal-overlay-animate,
                .modal-animate {
                    animation: none;
                }
            }

            /* High Contrast Mode */
            @media (prefers-contrast: high) {
                .modal-content {
                    border-width: 2px;
                }

                .modal-close-button:hover {
                    outline: 2px solid currentColor;
                }
            }
        </style>
    `;
};

export default Modal;