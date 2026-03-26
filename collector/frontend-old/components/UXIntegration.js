/**
 * UX Integration Component
 * Integrates all UX enhancement components into the main application
 */

import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect, useRef } from 'https://esm.sh/preact/hooks';

// Import UX components
import UserGuide, { GUIDE_STEPS, guideManager } from './UserGuide.js';
import { feedbackManager } from './FeedbackSystem.js';
import { ErrorBoundary, errorReporter } from './ErrorHandler.js';
import { HelpPanel, ContextHelp } from './HelpSystem.js';
import { devLog } from '../utils/helpers.js';

// UX Integration Provider Component
export const UXProvider = ({ children }) => {
    const [helpPanelOpen, setHelpPanelOpen] = useState(false);
    const [currentContext, setCurrentContext] = useState('general');
    const [firstVisit, setFirstVisit] = useState(false);
    const [keyboardShortcutsEnabled, setKeyboardShortcutsEnabled] = useState(true);

    // Check if this is user's first visit
    useEffect(() => {
        const hasVisited = localStorage.getItem('collector-has-visited');
        if (!hasVisited) {
            setFirstVisit(true);
            localStorage.setItem('collector-has-visited', 'true');
        }
    }, []);

    // Set up keyboard shortcuts
    useEffect(() => {
        if (!keyboardShortcutsEnabled) return;

        const handleKeyDown = (e) => {
            // F1 - Open help
            if (e.key === 'F1') {
                e.preventDefault();
                setHelpPanelOpen(true);
            }
            
            // Escape - Close dialogs/panels
            else if (e.key === 'Escape') {
                setHelpPanelOpen(false);
                // Also close any toast notifications
                feedbackManager.clearAllToasts();
            }
            
            // Ctrl+/ - Show keyboard shortcuts
            else if (e.ctrlKey && e.key === '/') {
                e.preventDefault();
                setHelpPanelOpen(true);
                // Switch to shortcuts tab after opening
                setTimeout(() => {
                    const shortcutsTab = document.querySelector('[data-tab="shortcuts"]');
                    if (shortcutsTab) shortcutsTab.click();
                }, 100);
            }
            
            // Alt+D - Go to Dashboard
            else if (e.altKey && e.key === 'd') {
                e.preventDefault();
                window.location.hash = '#/dashboard';
                feedbackManager.info('Navigated to Dashboard');
            }
            
            // Alt+I - Go to Interfaces
            else if (e.altKey && e.key === 'i') {
                e.preventDefault();
                window.location.hash = '#/interfaces';
                feedbackManager.info('Navigated to Interfaces');
            }
            
            // Alt+T - Go to Testing
            else if (e.altKey && e.key === 't') {
                e.preventDefault();
                window.location.hash = '#/testing';
                feedbackManager.info('Navigated to Protocol Testing');
            }
            
            // Alt+R - Go to Drivers
            else if (e.altKey && e.key === 'r') {
                e.preventDefault();
                window.location.hash = '#/drivers';
                feedbackManager.info('Navigated to Drivers');
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [keyboardShortcutsEnabled]);

    // Update context based on current route
    useEffect(() => {
        const updateContext = () => {
            const hash = window.location.hash;
            if (hash.includes('dashboard')) {
                setCurrentContext('dashboard');
            } else if (hash.includes('interfaces') || hash.includes('config')) {
                setCurrentContext('interfaces');
            } else if (hash.includes('testing')) {
                setCurrentContext('testing');
            } else if (hash.includes('drivers')) {
                setCurrentContext('drivers');
            } else {
                setCurrentContext('general');
            }
        };

        updateContext();
        window.addEventListener('hashchange', updateContext);
        return () => window.removeEventListener('hashchange', updateContext);
    }, []);

    // Show welcome guide for first-time users
    useEffect(() => {
        if (firstVisit && guideManager.shouldShowGuide('welcome')) {
            setTimeout(() => {
                startWelcomeGuide();
            }, 2000); // Delay to let the app load
        }
    }, [firstVisit]);

    const startWelcomeGuide = () => {
        const welcomeSteps = [
            {
                target: 'body',
                title: 'Welcome to ProDB Collector!',
                content: html`
                    <div>
                        <p>Welcome to your industrial data collection platform. Let's take a quick tour of the key features.</p>
                        <ul>
                            <li>Monitor real-time data streams</li>
                            <li>Configure multiple protocol interfaces</li>
                            <li>Test protocol connections</li>
                            <li>Manage protocol drivers</li>
                        </ul>
                    </div>
                `,
                position: 'bottom'
            },
            {
                target: '.sidebar',
                title: 'Navigation Sidebar',
                content: 'Use the sidebar to navigate between different sections of the application. Each section provides specific functionality for managing your data collection.',
                position: 'right'
            },
            {
                target: '.main-content',
                title: 'Main Content Area',
                content: 'This is where you\'ll interact with the application features. The content changes based on your current section.',
                position: 'left'
            }
        ];

        // Create guide container
        const container = document.createElement('div');
        document.body.appendChild(container);

        import('https://esm.sh/preact').then(({ render }) => {
            render(html`
                <${UserGuide}
                    steps=${welcomeSteps}
                    autoStart=${true}
                    onComplete=${() => {
                        document.body.removeChild(container);
                        guideManager.markGuideCompleted('welcome');
                        feedbackManager.success('Welcome tour completed! Press F1 anytime for help.');
                    }}
                    onSkip=${() => {
                        document.body.removeChild(container);
                        guideManager.markGuideCompleted('welcome');
                        feedbackManager.info('You can always access help by pressing F1');
                    }}
                />
            `, container);
        });
    };

    return html`
        <${ErrorBoundary}
            onError=${(error, errorInfo) => {
                errorReporter.reportError(error, errorInfo);
                devLog('Application error caught:', error);
            }}
        >
            ${children}
            
            ${helpPanelOpen && html`
                <${HelpPanel}
                    isOpen=${helpPanelOpen}
                    context=${currentContext}
                    onClose=${() => setHelpPanelOpen(false)}
                />
            `}
        </ErrorBoundary>
    `;
};

// Context-aware help trigger component
export const ContextualHelp = ({ 
    content, 
    context = null,
    position = 'top',
    trigger = 'hover'
}) => {
    return html`
        <${ContextHelp}
            content=${content}
            position=${position}
            trigger=${trigger}
        />
    `;
};

// Quick action feedback component
export const QuickFeedback = ({ 
    action, 
    onSuccess = null, 
    onError = null,
    loadingMessage = 'Processing...',
    successMessage = 'Action completed successfully',
    errorMessage = 'Action failed'
}) => {
    const executeAction = async () => {
        const loadingId = feedbackManager.loading(loadingMessage);
        
        try {
            const result = await action();
            feedbackManager.removeToast(loadingId);
            
            if (onSuccess) {
                onSuccess(result);
            } else {
                feedbackManager.success(successMessage);
            }
            
            return result;
        } catch (error) {
            feedbackManager.removeToast(loadingId);
            
            if (onError) {
                onError(error);
            } else {
                feedbackManager.error(`${errorMessage}: ${error.message}`);
            }
            
            throw error;
        }
    };

    return { executeAction };
};

// Guided tour manager
export class GuidedTourManager {
    constructor() {
        this.tours = new Map();
        this.currentTour = null;
    }

    registerTour(id, steps, options = {}) {
        this.tours.set(id, { steps, options });
        guideManager.registerGuide(id, steps, options);
    }

    startTour(id, options = {}) {
        if (this.currentTour) {
            this.endCurrentTour();
        }

        const tour = this.tours.get(id);
        if (!tour) {
            console.warn(`Tour not found: ${id}`);
            return false;
        }

        if (!guideManager.shouldShowGuide(id)) {
            devLog(`Tour ${id} already completed or disabled`);
            return false;
        }

        this.currentTour = id;
        
        // Create guide container
        const container = document.createElement('div');
        document.body.appendChild(container);

        import('https://esm.sh/preact').then(({ render }) => {
            render(html`
                <${UserGuide}
                    steps=${tour.steps}
                    autoStart=${true}
                    onComplete=${() => {
                        document.body.removeChild(container);
                        guideManager.markGuideCompleted(id);
                        this.currentTour = null;
                        
                        if (options.onComplete) {
                            options.onComplete();
                        } else {
                            feedbackManager.success('Tour completed successfully!');
                        }
                    }}
                    onSkip=${() => {
                        document.body.removeChild(container);
                        this.currentTour = null;
                        
                        if (options.onSkip) {
                            options.onSkip();
                        } else {
                            feedbackManager.info('Tour skipped');
                        }
                    }}
                    ...${tour.options}
                    ...${options}
                />
            `, container);
        });

        return true;
    }

    endCurrentTour() {
        if (this.currentTour) {
            // Find and remove tour container
            const tourContainers = document.querySelectorAll('.user-guide-container');
            tourContainers.forEach(container => {
                const parent = container.parentElement;
                if (parent && parent.parentElement === document.body) {
                    document.body.removeChild(parent);
                }
            });
            
            this.currentTour = null;
        }
    }

    isTourActive() {
        return this.currentTour !== null;
    }

    getCurrentTour() {
        return this.currentTour;
    }
}

// Global tour manager instance
export const tourManager = new GuidedTourManager();

// Register default tours
tourManager.registerTour('dashboard-overview', GUIDE_STEPS.dashboard, {
    allowSkip: true,
    showProgress: true
});

tourManager.registerTour('interface-configuration', GUIDE_STEPS.interfaceConfig, {
    allowSkip: true,
    showProgress: true
});

tourManager.registerTour('protocol-testing', GUIDE_STEPS.protocolTesting, {
    allowSkip: true,
    showProgress: true
});

// Smart notification system
export class SmartNotificationSystem {
    constructor() {
        this.notificationQueue = [];
        this.maxConcurrentNotifications = 3;
        this.notificationHistory = [];
        this.userPreferences = this.loadPreferences();
    }

    notify(type, message, options = {}) {
        // Check if user has disabled this type of notification
        if (this.userPreferences.disabledTypes.includes(type)) {
            return null;
        }

        // Check for duplicate notifications
        const isDuplicate = this.notificationHistory.some(notification => 
            notification.message === message && 
            Date.now() - notification.timestamp < 5000 // 5 seconds
        );

        if (isDuplicate && !options.allowDuplicates) {
            return null;
        }

        // Add to history
        this.notificationHistory.push({
            type,
            message,
            timestamp: Date.now()
        });

        // Clean old history
        this.notificationHistory = this.notificationHistory.filter(
            notification => Date.now() - notification.timestamp < 60000 // 1 minute
        );

        // Show notification
        return feedbackManager.showToast(message, type, options);
    }

    success(message, options = {}) {
        return this.notify('success', message, options);
    }

    error(message, options = {}) {
        return this.notify('error', message, { duration: 8000, ...options });
    }

    warning(message, options = {}) {
        return this.notify('warning', message, { duration: 6000, ...options });
    }

    info(message, options = {}) {
        return this.notify('info', message, options);
    }

    loadPreferences() {
        try {
            const saved = localStorage.getItem('notification-preferences');
            return saved ? JSON.parse(saved) : {
                disabledTypes: [],
                maxConcurrent: 3
            };
        } catch (error) {
            return {
                disabledTypes: [],
                maxConcurrent: 3
            };
        }
    }

    savePreferences() {
        try {
            localStorage.setItem('notification-preferences', JSON.stringify(this.userPreferences));
        } catch (error) {
            console.warn('Failed to save notification preferences:', error);
        }
    }

    disableNotificationType(type) {
        if (!this.userPreferences.disabledTypes.includes(type)) {
            this.userPreferences.disabledTypes.push(type);
            this.savePreferences();
        }
    }

    enableNotificationType(type) {
        const index = this.userPreferences.disabledTypes.indexOf(type);
        if (index > -1) {
            this.userPreferences.disabledTypes.splice(index, 1);
            this.savePreferences();
        }
    }
}

// Global smart notification system
export const smartNotifications = new SmartNotificationSystem();

// Make UX utilities available globally
if (typeof window !== 'undefined') {
    window.tourManager = tourManager;
    window.smartNotifications = smartNotifications;
    window.guideManager = guideManager;
    window.errorReporter = errorReporter;
    
    // Global convenience functions
    window.showTour = (id, options) => tourManager.startTour(id, options);
    window.showHelp = (context) => {
        const event = new CustomEvent('open-help', { detail: { context } });
        document.dispatchEvent(event);
    };
    window.showGuide = (steps, options) => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        
        import('https://esm.sh/preact').then(({ render }) => {
            render(html`
                <${UserGuide}
                    steps=${steps}
                    autoStart=${true}
                    onComplete=${() => {
                        document.body.removeChild(container);
                        if (options?.onComplete) options.onComplete();
                    }}
                    onSkip=${() => {
                        document.body.removeChild(container);
                        if (options?.onSkip) options.onSkip();
                    }}
                    ...${options}
                />
            `, container);
        });
    };
}

export default {
    UXProvider,
    ContextualHelp,
    QuickFeedback,
    GuidedTourManager,
    SmartNotificationSystem,
    tourManager,
    smartNotifications
};