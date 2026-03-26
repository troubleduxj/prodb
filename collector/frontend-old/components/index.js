/**
 * UI Components Library Index
 * Exports all enhanced UI components for the ProDB Collector
 */

// Core Layout Components
export { default as Layout } from './Layout.js';

// UI Components
export { default as StatusIndicator } from './StatusIndicator.js';
export { default as QuickActions } from './QuickActions.js';
export { default as RealTimeMonitor } from './RealTimeMonitor.js';
export { default as LogViewer } from './LogViewer.js';
export { default as Modal } from './Modal.js';
export { default as Dialog } from './Dialog.js';
export { default as Form } from './Form.js';

// Testing Components
export { default as ProtocolTester } from './ProtocolTester.js';
export { default as DeviceScanner } from './DeviceScanner.js';
export { default as BatchTester } from './BatchTester.js';
export { default as TestResultsDisplay } from './TestResultsDisplay.js';
export { default as TestReportGenerator } from './TestReportGenerator.js';

// Configuration Components
export { default as ConfigWizard } from './ConfigWizard.js';
export { default as BatchOperations } from './BatchOperations.js';
export { default as QuickConfigTemplates } from './QuickConfigTemplates.js';
export { default as ConfigImportExport } from './ConfigImportExport.js';
export { default as ConfigClipboard } from './ConfigClipboard.js';
export { default as QuickCreateDialog } from './QuickCreateDialog.js';
export { default as ConfigTemplateManager } from './ConfigTemplateManager.js';
export { default as ConfigBackupManager } from './ConfigBackupManager.js';
export { default as ConfigHistoryManager } from './ConfigHistoryManager.js';

// Driver Management Components
export { default as DriverCard } from './DriverCard.js';
export { default as DriverScanner } from './DriverScanner.js';

// Security and Validation Components
export { default as ConfigValidator } from './ConfigValidator.js';
export { FieldValidator, SecurityConfirmationDialog } from './ConfigValidator.js';
export { default as OperationLogger } from './OperationLogger.js';
export { LogDetailsDialog, SimpleLogViewer } from './OperationLogger.js';
export { default as ProtectedComponent } from './AccessControl.js';
export { 
    ProtectedButton, 
    SessionManager, 
    PermissionPanel, 
    SensitiveDataDisplay,
    withSecurityConfirmation 
} from './AccessControl.js';

// Mobile-Optimized Components
export { default as MobileForm } from './MobileForm.js';
export { default as MobileTable } from './MobileTable.js';
export { default as MobileUtils } from './MobileUtils.js';
export {
    useMobileDetection,
    useHorizontalScroll,
    useSwipeGesture,
    ResponsiveContainer,
    HorizontalScrollContainer,
    TouchButton,
    TouchInput,
    TouchSelect,
    ResponsiveGrid,
    MobileModal,
    TouchTabs,
    MobileLoader
} from './MobileUtils.js';

// Component utilities and helpers
export const UIComponents = {
    Layout: () => import('./Layout.js'),
    StatusIndicator: () => import('./StatusIndicator.js'),
    QuickActions: () => import('./QuickActions.js'),
    RealTimeMonitor: () => import('./RealTimeMonitor.js'),
    LogViewer: () => import('./LogViewer.js'),
    Modal: () => import('./Modal.js'),
    Dialog: () => import('./Dialog.js'),
    Form: () => import('./Form.js'),
    ProtocolTester: () => import('./ProtocolTester.js'),
    DeviceScanner: () => import('./DeviceScanner.js'),
    BatchTester: () => import('./BatchTester.js'),
    TestResultsDisplay: () => import('./TestResultsDisplay.js'),
    TestReportGenerator: () => import('./TestReportGenerator.js'),
    ConfigWizard: () => import('./ConfigWizard.js'),
    BatchOperations: () => import('./BatchOperations.js'),
    QuickConfigTemplates: () => import('./QuickConfigTemplates.js'),
    ConfigImportExport: () => import('./ConfigImportExport.js'),
    ConfigClipboard: () => import('./ConfigClipboard.js'),
    QuickCreateDialog: () => import('./QuickCreateDialog.js'),
    ConfigTemplateManager: () => import('./ConfigTemplateManager.js'),
    ConfigBackupManager: () => import('./ConfigBackupManager.js'),
    ConfigHistoryManager: () => import('./ConfigHistoryManager.js'),
    DriverCard: () => import('./DriverCard.js'),
    DriverScanner: () => import('./DriverScanner.js'),
    ConfigValidator: () => import('./ConfigValidator.js'),
    OperationLogger: () => import('./OperationLogger.js'),
    ProtectedComponent: () => import('./AccessControl.js'),
    MobileForm: () => import('./MobileForm.js'),
    MobileTable: () => import('./MobileTable.js'),
    MobileUtils: () => import('./MobileUtils.js')
};

// Component configuration and defaults
export const ComponentDefaults = {
    StatusIndicator: {
        size: 'normal',
        type: 'status',
        showIcon: true,
        showText: true,
        variant: 'default'
    },
    QuickActions: {
        size: 'normal',
        layout: 'horizontal',
        showLabels: true,
        showIcons: true,
        showTooltips: true,
        confirmDestructive: true
    },
    Modal: {
        size: 'medium',
        variant: 'default',
        showCloseButton: true,
        closeOnOverlayClick: true,
        closeOnEscape: true,
        animate: true,
        preventBodyScroll: true,
        focusTrap: true
    },
    Dialog: {
        type: 'info',
        size: 'small',
        showCancel: false,
        confirmText: 'OK',
        cancelText: 'Cancel'
    },
    Form: {
        autoValidate: true,
        validateOnChange: true,
        validateOnBlur: true,
        showErrorSummary: false,
        resetOnSubmit: false
    },
    MobileForm: {
        collapsible: true,
        touchOptimized: true,
        preventZoom: true,
        autoFocus: false,
        submitLabel: 'Submit',
        cancelLabel: 'Cancel'
    },
    MobileTable: {
        showCardView: true,
        showScrollIndicators: true,
        priorityColumns: ['critical', 'high'],
        emptyMessage: 'No data available',
        cardViewThreshold: 768
    },
    TouchButton: {
        size: 'medium',
        variant: 'primary',
        minTouchTarget: 44,
        hapticFeedback: true
    },
    ResponsiveGrid: {
        columns: { mobile: 1, tablet: 2, desktop: 3 },
        gap: 'medium',
        breakpoints: { mobile: 768, tablet: 1024 }
    }
};

// Theme and styling utilities
export const ComponentThemes = {
    // Status indicator color mappings
    statusColors: {
        connected: 'var(--color-success)',
        disconnected: 'var(--color-warning)',
        error: 'var(--color-error)',
        testing: 'var(--color-info)'
    },
    
    // Button variant mappings
    buttonVariants: {
        primary: 'btn-primary',
        secondary: 'btn-secondary',
        success: 'btn-success',
        warning: 'btn-warning',
        error: 'btn-error',
        info: 'btn-info'
    },
    
    // Size mappings
    sizes: {
        small: 'sm',
        normal: '',
        large: 'lg'
    }
};

// Validation helpers for forms
export const ValidationRules = {
    required: (message = 'This field is required') => ({
        required: true,
        requiredMessage: message
    }),
    
    minLength: (length, message) => ({
        minLength: length,
        minLengthMessage: message || `Must be at least ${length} characters`
    }),
    
    maxLength: (length, message) => ({
        maxLength: length,
        maxLengthMessage: message || `Must be no more than ${length} characters`
    }),
    
    email: (message = 'Please enter a valid email address') => ({
        email: true,
        emailMessage: message
    }),
    
    pattern: (regex, message) => ({
        pattern: regex,
        patternMessage: message
    }),
    
    number: (min, max, message) => ({
        number: true,
        min,
        max,
        numberMessage: message,
        minMessage: min !== undefined ? `Must be at least ${min}` : undefined,
        maxMessage: max !== undefined ? `Must be no more than ${max}` : undefined
    }),
    
    custom: (validateFn, message) => ({
        validate: validateFn,
        customMessage: message
    })
};

// Action configurations for QuickActions
export const ActionConfigs = {
    interface: {
        start: {
            label: 'Start',
            icon: '▶️',
            variant: 'success',
            group: 'control'
        },
        stop: {
            label: 'Stop',
            icon: '⏹️',
            variant: 'warning',
            group: 'control'
        },
        restart: {
            label: 'Restart',
            icon: '🔄',
            variant: 'secondary',
            group: 'control'
        },
        test: {
            label: 'Test',
            icon: '🧪',
            variant: 'info',
            group: 'tools'
        },
        configure: {
            label: 'Config',
            icon: '⚙️',
            variant: 'secondary',
            group: 'tools'
        },
        delete: {
            label: 'Delete',
            icon: '🗑️',
            variant: 'error',
            group: 'danger',
            destructive: true
        }
    }
};

// Accessibility helpers
export const A11yHelpers = {
    // Generate ARIA labels for status indicators
    getStatusAriaLabel: (status, value) => {
        const statusMap = {
            connected: 'Connected',
            disconnected: 'Disconnected',
            error: 'Error',
            testing: 'Testing'
        };
        return `Status: ${statusMap[status] || status}${value ? `, ${value}` : ''}`;
    },
    
    // Generate ARIA labels for actions
    getActionAriaLabel: (action, target) => {
        return `${action} ${target || 'item'}`;
    },
    
    // Focus management utilities
    focusManagement: {
        trapFocus: (container) => {
            const focusableElements = container.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            return Array.from(focusableElements);
        },
        
        restoreFocus: (element) => {
            if (element && typeof element.focus === 'function') {
                element.focus();
            }
        }
    }
};

// Component event types for global event system
export const ComponentEvents = {
    STATUS_CHANGED: 'statusChanged',
    ACTION_EXECUTED: 'actionExecuted',
    MODAL_OPENED: 'modalOpened',
    MODAL_CLOSED: 'modalClosed',
    FORM_SUBMITTED: 'formSubmitted',
    FORM_VALIDATED: 'formValidated'
};

// Performance optimization utilities
export const PerformanceUtils = {
    // Lazy load components
    lazyLoad: (componentName) => {
        return UIComponents[componentName]?.();
    },
    
    // Debounce utility for component interactions
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    // Throttle utility for high-frequency events
    throttle: (func, limit) => {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
};

export default {
    Layout,
    StatusIndicator,
    QuickActions,
    Modal,
    Dialog,
    Form,
    ComponentDefaults,
    ComponentThemes,
    ValidationRules,
    ActionConfigs,
    A11yHelpers,
    ComponentEvents,
    PerformanceUtils
};