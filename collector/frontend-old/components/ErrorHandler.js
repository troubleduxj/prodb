/**
 * Error Handler Component
 * Provides friendly error messages and recovery suggestions
 */

import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';
import FeedbackSystem, { feedbackManager } from './FeedbackSystem.js';
import { devLog } from '../utils/helpers.js';

// Error boundary component
export const ErrorBoundary = ({ 
    children, 
    fallback = null, 
    onError = null,
    showDetails = false,
    allowRetry = true 
}) => {
    const [hasError, setHasError] = useState(false);
    const [error, setError] = useState(null);
    const [errorInfo, setErrorInfo] = useState(null);
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        const handleError = (event) => {
            const error = event.error || event.reason;
            handleErrorCapture(error, { componentStack: event.filename });
        };

        const handleUnhandledRejection = (event) => {
            handleErrorCapture(event.reason, { type: 'unhandledRejection' });
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        };
    }, []);

    const handleErrorCapture = (error, errorInfo) => {
        setHasError(true);
        setError(error);
        setErrorInfo(errorInfo);
        
        devLog('Error caught by boundary:', error, errorInfo);
        
        if (onError) {
            onError(error, errorInfo);
        }

        // Report error to feedback system
        feedbackManager.error('An unexpected error occurred', {
            actions: allowRetry ? [{
                label: 'Retry',
                onClick: () => handleRetry()
            }] : []
        });
    };

    const handleRetry = () => {
        setHasError(false);
        setError(null);
        setErrorInfo(null);
        setRetryCount(prev => prev + 1);
    };

    const handleReload = () => {
        window.location.reload();
    };

    if (hasError) {
        if (fallback) {
            return fallback(error, errorInfo, handleRetry);
        }

        return html`
            <${ErrorDisplay}
                error=${error}
                errorInfo=${errorInfo}
                showDetails=${showDetails}
                allowRetry=${allowRetry}
                retryCount=${retryCount}
                onRetry=${handleRetry}
                onReload=${handleReload}
            />
        `;
    }

    return children;
};

// Error display component
export const ErrorDisplay = ({
    error,
    errorInfo = null,
    title = 'Something went wrong',
    showDetails = false,
    allowRetry = true,
    retryCount = 0,
    onRetry = null,
    onReload = null,
    suggestions = null
}) => {
    const [detailsVisible, setDetailsVisible] = useState(false);

    const getErrorSuggestions = (error) => {
        if (suggestions) return suggestions;

        const errorMessage = error?.message?.toLowerCase() || '';
        const errorName = error?.name?.toLowerCase() || '';

        // Common error patterns and suggestions
        if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
            return [
                'Check your internet connection',
                'Verify the server is running and accessible',
                'Try refreshing the page',
                'Contact your system administrator if the problem persists'
            ];
        }

        if (errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
            return [
                'Check if you have the necessary permissions',
                'Try logging out and logging back in',
                'Contact your administrator for access rights',
                'Clear your browser cache and cookies'
            ];
        }

        if (errorMessage.includes('timeout')) {
            return [
                'The operation took too long to complete',
                'Check your network connection speed',
                'Try the operation again',
                'Consider breaking large operations into smaller parts'
            ];
        }

        if (errorName.includes('syntax') || errorMessage.includes('parse')) {
            return [
                'There may be invalid data in your input',
                'Check for special characters or formatting issues',
                'Try refreshing the page',
                'Report this issue to support'
            ];
        }

        if (errorMessage.includes('memory') || errorMessage.includes('quota')) {
            return [
                'Your browser may be running low on memory',
                'Close other browser tabs or applications',
                'Try refreshing the page',
                'Consider using a different browser'
            ];
        }

        // Generic suggestions
        return [
            'Try refreshing the page',
            'Check your internet connection',
            'Clear your browser cache',
            'Try again in a few moments',
            'Contact support if the problem continues'
        ];
    };

    const getErrorCategory = (error) => {
        const message = error?.message?.toLowerCase() || '';
        const name = error?.name?.toLowerCase() || '';

        if (message.includes('network') || message.includes('fetch')) return 'network';
        if (message.includes('permission') || message.includes('unauthorized')) return 'permission';
        if (message.includes('timeout')) return 'timeout';
        if (name.includes('syntax') || message.includes('parse')) return 'syntax';
        if (message.includes('memory') || message.includes('quota')) return 'memory';
        
        return 'generic';
    };

    const getErrorIcon = (category) => {
        const icons = {
            network: '🌐',
            permission: '🔒',
            timeout: '⏱️',
            syntax: '📝',
            memory: '💾',
            generic: '⚠️'
        };
        return icons[category] || icons.generic;
    };

    const errorCategory = getErrorCategory(error);
    const errorSuggestions = getErrorSuggestions(error);
    const errorIcon = getErrorIcon(errorCategory);

    return html`
        <div class="error-display">
            <div class="error-content">
                <div class="error-header">
                    <span class="error-icon">${errorIcon}</span>
                    <h2 class="error-title">${title}</h2>
                </div>

                <div class="error-message">
                    <p>${error?.message || 'An unexpected error occurred'}</p>
                    
                    ${retryCount > 0 && html`
                        <p class="error-retry-info">
                            Retry attempt: ${retryCount}
                        </p>
                    `}
                </div>

                ${errorSuggestions && html`
                    <div class="error-suggestions">
                        <h3>What you can try:</h3>
                        <ul>
                            ${errorSuggestions.map(suggestion => html`
                                <li key=${suggestion}>${suggestion}</li>
                            `)}
                        </ul>
                    </div>
                `}

                <div class="error-actions">
                    ${allowRetry && onRetry && html`
                        <button class="btn btn-primary" onClick=${onRetry}>
                            Try Again
                        </button>
                    `}
                    
                    ${onReload && html`
                        <button class="btn btn-secondary" onClick=${onReload}>
                            Reload Page
                        </button>
                    `}
                    
                    <button 
                        class="btn btn-text"
                        onClick=${() => setDetailsVisible(!detailsVisible)}
                    >
                        ${detailsVisible ? 'Hide' : 'Show'} Details
                    </button>
                </div>

                ${(showDetails || detailsVisible) && html`
                    <div class="error-details">
                        <h4>Technical Details:</h4>
                        <div class="error-stack">
                            <strong>Error:</strong> ${error?.name || 'Unknown'}
                            <br />
                            <strong>Message:</strong> ${error?.message || 'No message'}
                            ${error?.stack && html`
                                <br />
                                <strong>Stack Trace:</strong>
                                <pre>${error.stack}</pre>
                            `}
                            ${errorInfo && html`
                                <br />
                                <strong>Component Info:</strong>
                                <pre>${JSON.stringify(errorInfo, null, 2)}</pre>
                            `}
                        </div>
                        
                        <div class="error-report">
                            <button 
                                class="btn btn-secondary"
                                onClick=${() => copyErrorToClipboard(error, errorInfo)}
                            >
                                Copy Error Report
                            </button>
                        </div>
                    </div>
                `}
            </div>
        </div>
    `;
};

// Network error component
export const NetworkError = ({
    onRetry = null,
    message = 'Unable to connect to the server'
}) => {
    return html`
        <${ErrorDisplay}
            error=${{ message, name: 'NetworkError' }}
            title="Connection Problem"
            allowRetry=${!!onRetry}
            onRetry=${onRetry}
            suggestions=${[
                'Check your internet connection',
                'Verify the collector service is running',
                'Check if the server address is correct',
                'Try again in a few moments'
            ]}
        />
    `;
};

// Permission error component
export const PermissionError = ({
    resource = 'this resource',
    onLogin = null
}) => {
    return html`
        <${ErrorDisplay}
            error=${{ message: `You don't have permission to access ${resource}`, name: 'PermissionError' }}
            title="Access Denied"
            allowRetry=${false}
            suggestions=${[
                'Check if you have the necessary permissions',
                'Contact your administrator for access',
                onLogin ? 'Try logging in again' : null
            ].filter(Boolean)}
        />
    `;
};

// Not found error component
export const NotFoundError = ({
    resource = 'page',
    onGoHome = null
}) => {
    return html`
        <${ErrorDisplay}
            error=${{ message: `The ${resource} you're looking for doesn't exist`, name: 'NotFoundError' }}
            title="Not Found"
            allowRetry=${false}
            suggestions=${[
                'Check the URL for typos',
                'The resource may have been moved or deleted',
                'Go back to the previous page',
                onGoHome ? 'Return to the dashboard' : null
            ].filter(Boolean)}
        />
    `;
};

// Utility functions
const copyErrorToClipboard = async (error, errorInfo) => {
    const errorReport = {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        error: {
            name: error?.name,
            message: error?.message,
            stack: error?.stack
        },
        errorInfo,
        appVersion: window.APP_VERSION || 'unknown'
    };

    try {
        await navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2));
        feedbackManager.success('Error report copied to clipboard');
    } catch (err) {
        console.error('Failed to copy error report:', err);
        feedbackManager.error('Failed to copy error report');
    }
};

// Error reporting service
export class ErrorReporter {
    constructor() {
        this.errors = [];
        this.maxErrors = 50;
        this.reportingEnabled = true;
    }

    reportError(error, context = {}) {
        if (!this.reportingEnabled) return;

        const errorReport = {
            id: Date.now() + Math.random(),
            timestamp: new Date().toISOString(),
            error: {
                name: error?.name,
                message: error?.message,
                stack: error?.stack
            },
            context,
            userAgent: navigator.userAgent,
            url: window.location.href,
            appVersion: window.APP_VERSION || 'unknown'
        };

        this.errors.push(errorReport);

        // Keep only recent errors
        if (this.errors.length > this.maxErrors) {
            this.errors = this.errors.slice(-this.maxErrors);
        }

        devLog('Error reported:', errorReport);

        // Could send to external service here
        this.sendToService(errorReport);
    }

    async sendToService(errorReport) {
        // Placeholder for external error reporting service
        // In a real implementation, you might send to Sentry, LogRocket, etc.
        try {
            // await fetch('/api/errors', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify(errorReport)
            // });
        } catch (err) {
            console.warn('Failed to send error report:', err);
        }
    }

    getErrors() {
        return [...this.errors];
    }

    clearErrors() {
        this.errors = [];
    }

    enableReporting() {
        this.reportingEnabled = true;
    }

    disableReporting() {
        this.reportingEnabled = false;
    }
}

// Global error reporter instance
export const errorReporter = new ErrorReporter();

// Set up global error handling
if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
        errorReporter.reportError(event.error, {
            type: 'javascript',
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
        });
    });

    window.addEventListener('unhandledrejection', (event) => {
        errorReporter.reportError(event.reason, {
            type: 'unhandledRejection'
        });
    });

    // Make error utilities available globally
    window.errorReporter = errorReporter;
    window.copyErrorToClipboard = copyErrorToClipboard;
}

export default {
    ErrorBoundary,
    ErrorDisplay,
    NetworkError,
    PermissionError,
    NotFoundError,
    ErrorReporter,
    errorReporter
};