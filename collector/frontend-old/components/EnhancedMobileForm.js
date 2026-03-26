/**
 * Enhanced Mobile Form Component
 * Optimized for mobile performance and poor network conditions
 */
import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect, useRef, useMemo } from 'https://esm.sh/preact/hooks';
import { useMobileDetection } from './MobileUtils.js';

const EnhancedMobileForm = ({ 
    fields = [], 
    onSubmit = () => {}, 
    onCancel = null,
    submitLabel = 'Submit',
    cancelLabel = 'Cancel',
    title = '',
    collapsible = false,
    initialData = {},
    className = '',
    autoSave = false,
    offlineSupport = true,
    progressiveValidation = true
}) => {
    const [formData, setFormData] = useState(initialData);
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [collapsedSections, setCollapsedSections] = useState(new Set());
    const [validationProgress, setValidationProgress] = useState(0);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    
    const { isMobile, isTablet } = useMobileDetection();
    const formRef = useRef(null);
    const autoSaveTimeoutRef = useRef(null);
    const validationTimeoutRef = useRef(null);

    // Listen for online/offline events
    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Auto-save functionality
    useEffect(() => {
        if (!autoSave || !isDirty) return;
        
        if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
        }
        
        autoSaveTimeoutRef.current = setTimeout(() => {
            saveToLocalStorage();
        }, 2000); // Auto-save after 2 seconds of inactivity
        
        return () => {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
        };
    }, [formData, isDirty, autoSave]);

    // Load saved data on mount
    useEffect(() => {
        if (autoSave) {
            loadFromLocalStorage();
        }
    }, [autoSave]);

    // Memoized grouped fields for performance
    const groupedFields = useMemo(() => {
        return fields.reduce((groups, field) => {
            const section = field.section || 'default';
            if (!groups[section]) {
                groups[section] = [];
            }
            groups[section].push(field);
            return groups;
        }, {});
    }, [fields]);

    // Progressive validation
    const validateFieldProgressive = (fieldName, value) => {
        if (!progressiveValidation) return;
        
        if (validationTimeoutRef.current) {
            clearTimeout(validationTimeoutRef.current);
        }
        
        validationTimeoutRef.current = setTimeout(() => {
            const field = fields.find(f => f.name === fieldName);
            if (!field) return;
            
            let error = null;
            
            if (field.required && (!value || value === '')) {
                error = `${field.label} is required`;
            } else if (field.validate && value) {
                const validationResult = field.validate(value);
                if (validationResult !== true) {
                    error = validationResult;
                }
            }
            
            setErrors(prev => ({
                ...prev,
                [fieldName]: error
            }));
            
            // Update validation progress
            updateValidationProgress();
        }, 300); // Debounce validation
    };

    const updateValidationProgress = () => {
        const totalFields = fields.filter(f => f.required).length;
        const validFields = fields.filter(f => {
            if (!f.required) return true;
            const value = formData[f.name];
            return value && value !== '' && !errors[f.name];
        }).length;
        
        setValidationProgress(totalFields > 0 ? (validFields / totalFields) * 100 : 100);
    };

    const handleInputChange = (fieldName, value) => {
        setFormData(prev => ({
            ...prev,
            [fieldName]: value
        }));
        
        setIsDirty(true);
        
        // Progressive validation
        validateFieldProgressive(fieldName, value);
    };

    const saveToLocalStorage = () => {
        try {
            const saveKey = `form_data_${title.replace(/\s+/g, '_').toLowerCase()}`;
            localStorage.setItem(saveKey, JSON.stringify({
                data: formData,
                timestamp: Date.now()
            }));
        } catch (error) {
            console.warn('Failed to save form data:', error);
        }
    };

    const loadFromLocalStorage = () => {
        try {
            const saveKey = `form_data_${title.replace(/\s+/g, '_').toLowerCase()}`;
            const saved = localStorage.getItem(saveKey);
            
            if (saved) {
                const { data, timestamp } = JSON.parse(saved);
                
                // Only load if saved within last 24 hours
                if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
                    setFormData(prev => ({ ...prev, ...data }));
                    setIsDirty(true);
                }
            }
        } catch (error) {
            console.warn('Failed to load saved form data:', error);
        }
    };
}    
const validateForm = () => {
        const newErrors = {};
        
        fields.forEach(field => {
            if (field.required && (!formData[field.name] || formData[field.name] === '')) {
                newErrors[field.name] = `${field.label} is required`;
            }
            
            if (field.validate && formData[field.name]) {
                const validationResult = field.validate(formData[field.name]);
                if (validationResult !== true) {
                    newErrors[field.name] = validationResult;
                }
            }
        });
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            // Scroll to first error
            const firstErrorField = Object.keys(errors)[0];
            if (firstErrorField) {
                const errorElement = formRef.current?.querySelector(`[name="${firstErrorField}"]`);
                errorElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }
        
        setIsSubmitting(true);
        
        try {
            if (isOffline && offlineSupport) {
                // Queue for offline processing
                await queueOfflineSubmission();
                showOfflineNotification();
            } else {
                await onSubmit(formData);
                clearSavedData();
            }
        } catch (error) {
            console.error('Form submission error:', error);
            
            if (offlineSupport) {
                await queueOfflineSubmission();
                showOfflineNotification();
            } else {
                throw error;
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const queueOfflineSubmission = async () => {
        try {
            const offlineData = {
                type: 'form_submission',
                formTitle: title,
                data: formData,
                timestamp: Date.now()
            };
            
            const existingQueue = JSON.parse(localStorage.getItem('offline_submissions') || '[]');
            existingQueue.push(offlineData);
            localStorage.setItem('offline_submissions', JSON.stringify(existingQueue));
        } catch (error) {
            console.error('Failed to queue offline submission:', error);
        }
    };

    const showOfflineNotification = () => {
        // Dispatch custom event for offline notification
        window.dispatchEvent(new CustomEvent('show-notification', {
            detail: {
                type: 'info',
                message: 'Form saved offline. Will sync when connection is restored.',
                duration: 5000
            }
        }));
    };

    const clearSavedData = () => {
        try {
            const saveKey = `form_data_${title.replace(/\s+/g, '_').toLowerCase()}`;
            localStorage.removeItem(saveKey);
            setIsDirty(false);
        } catch (error) {
            console.warn('Failed to clear saved data:', error);
        }
    };

    const toggleSection = (sectionName) => {
        const newCollapsed = new Set(collapsedSections);
        if (newCollapsed.has(sectionName)) {
            newCollapsed.delete(sectionName);
        } else {
            newCollapsed.add(sectionName);
        }
        setCollapsedSections(newCollapsed);
    };

    // Optimized field rendering with virtualization for large forms
    const renderField = (field, index) => {
        const value = formData[field.name] || '';
        const error = errors[field.name];
        const fieldId = `field-${field.name}`;

        // Use appropriate input size for mobile
        const inputSize = isMobile ? 'large' : 'medium';
        const inputClass = `mobile-form-input ${inputSize} ${error ? 'error' : ''} ${field.className || ''}`;

        const commonProps = {
            id: fieldId,
            name: field.name,
            value: value,
            onChange: (e) => handleInputChange(field.name, e.target.value),
            className: inputClass,
            placeholder: field.placeholder || field.label,
            disabled: isSubmitting || field.disabled,
            required: field.required,
            'data-field-index': index // For performance tracking
        };

        let inputElement;
        
        switch (field.type) {
            case 'select':
                inputElement = html`
                    <select ...${commonProps}>
                        ${field.placeholder && html`<option value="">${field.placeholder}</option>`}
                        ${field.options?.map(option => html`
                            <option key=${option.value} value=${option.value}>
                                ${option.label}
                            </option>
                        `)}
                    </select>
                `;
                break;
                
            case 'textarea':
                inputElement = html`
                    <textarea 
                        ...${commonProps}
                        rows=${field.rows || (isMobile ? 4 : 3)}
                        style="resize: vertical; min-height: ${isMobile ? '60px' : '44px'};"
                    ></textarea>
                `;
                break;   
         case 'checkbox':
                inputElement = html`
                    <label class="mobile-checkbox-label enhanced">
                        <input 
                            type="checkbox"
                            id=${fieldId}
                            name=${field.name}
                            checked=${value}
                            onChange=${(e) => handleInputChange(field.name, e.target.checked)}
                            disabled=${isSubmitting || field.disabled}
                            class="mobile-checkbox enhanced"
                        />
                        <span class="mobile-checkbox-text">${field.label}</span>
                        <span class="mobile-checkbox-indicator"></span>
                    </label>
                `;
                break;
                
            case 'radio':
                inputElement = html`
                    <div class="mobile-radio-group enhanced">
                        ${field.options?.map(option => html`
                            <label key=${option.value} class="mobile-radio-label enhanced">
                                <input 
                                    type="radio"
                                    name=${field.name}
                                    value=${option.value}
                                    checked=${value === option.value}
                                    onChange=${(e) => handleInputChange(field.name, e.target.value)}
                                    disabled=${isSubmitting || field.disabled}
                                    class="mobile-radio enhanced"
                                />
                                <span class="mobile-radio-indicator"></span>
                                <span class="mobile-radio-text">${option.label}</span>
                            </label>
                        `)}
                    </div>
                `;
                break;
                
            case 'number':
                inputElement = html`
                    <input 
                        type="number"
                        ...${commonProps}
                        min=${field.min}
                        max=${field.max}
                        step=${field.step || (field.decimal ? '0.01' : '1')}
                        inputmode="numeric"
                        pattern="[0-9]*"
                    />
                `;
                break;
                
            case 'tel':
                inputElement = html`
                    <input 
                        type="tel"
                        ...${commonProps}
                        inputmode="tel"
                        autocomplete="tel"
                    />
                `;
                break;
                
            case 'email':
                inputElement = html`
                    <input 
                        type="email"
                        ...${commonProps}
                        inputmode="email"
                        autocomplete="email"
                    />
                `;
                break;
                
            case 'url':
                inputElement = html`
                    <input 
                        type="url"
                        ...${commonProps}
                        inputmode="url"
                        autocomplete="url"
                    />
                `;
                break;
                
            default:
                inputElement = html`
                    <input 
                        type=${field.type || 'text'}
                        ...${commonProps}
                        pattern=${field.pattern}
                        autocomplete=${field.autocomplete}
                        inputmode=${field.inputmode || 'text'}
                    />
                `;
        }

        return html`
            <div class="mobile-form-field enhanced ${field.type === 'checkbox' ? 'checkbox-field' : ''}">
                ${field.type !== 'checkbox' && html`
                    <label for=${fieldId} class="mobile-form-label enhanced">
                        ${field.label}
                        ${field.required && html`<span class="required-indicator">*</span>`}
                        ${field.optional && html`<span class="optional-indicator">(optional)</span>`}
                    </label>
                `}
                <div class="mobile-form-input-wrapper">
                    ${inputElement}
                    ${field.icon && html`
                        <span class="mobile-form-input-icon">${field.icon}</span>
                    `}
                </div>
                ${field.help && html`
                    <div class="mobile-form-help enhanced">${field.help}</div>
                `}
                ${error && html`
                    <div class="mobile-form-error enhanced" role="alert">${error}</div>
                `}
            </div>
        `;
    }; 
   const renderSection = (sectionName, sectionFields) => {
        const isCollapsed = collapsedSections.has(sectionName);
        const isDefaultSection = sectionName === 'default';
        
        return html`
            <div class="mobile-form-section enhanced ${isCollapsed ? 'collapsed' : ''}">
                ${!isDefaultSection && html`
                    <div 
                        class="mobile-form-section-header enhanced ${collapsible ? 'collapsible' : ''}"
                        onClick=${collapsible ? () => toggleSection(sectionName) : null}
                        role=${collapsible ? 'button' : null}
                        tabindex=${collapsible ? '0' : null}
                        onKeyDown=${collapsible ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                toggleSection(sectionName);
                            }
                        } : null}
                    >
                        <h3 class="mobile-form-section-title">${sectionName}</h3>
                        ${collapsible && html`
                            <span class="mobile-form-section-toggle" aria-hidden="true">
                                ${isCollapsed ? '▶' : '▼'}
                            </span>
                        `}
                    </div>
                `}
                <div class="mobile-form-section-content ${isCollapsed ? 'hidden' : ''}">
                    ${sectionFields.map((field, index) => renderField(field, index))}
                </div>
            </div>
        `;
    };

    return html`
        <form class="mobile-form enhanced ${className}" onSubmit=${handleSubmit} ref=${formRef} novalidate>
            ${title && html`
                <div class="mobile-form-header enhanced">
                    <h2 class="mobile-form-title">${title}</h2>
                    ${isOffline && html`
                        <div class="offline-indicator" title="Working offline">
                            📡 Offline
                        </div>
                    `}
                    ${isDirty && autoSave && html`
                        <div class="auto-save-indicator" title="Auto-saved">
                            💾 Saved
                        </div>
                    `}
                </div>
            `}
            
            ${progressiveValidation && validationProgress < 100 && html`
                <div class="validation-progress-bar">
                    <div class="validation-progress-fill" style="width: ${validationProgress}%"></div>
                    <span class="validation-progress-text">
                        ${Math.round(validationProgress)}% Complete
                    </span>
                </div>
            `}
            
            <div class="mobile-form-body enhanced">
                ${Object.entries(groupedFields).map(([sectionName, sectionFields]) => 
                    renderSection(sectionName, sectionFields)
                )}
            </div>
            
            <div class="mobile-form-footer enhanced">
                <div class="mobile-form-actions">
                    ${onCancel && html`
                        <button 
                            type="button" 
                            class="btn btn-secondary mobile-form-cancel enhanced"
                            onClick=${onCancel}
                            disabled=${isSubmitting}
                        >
                            ${cancelLabel}
                        </button>
                    `}
                    <button 
                        type="submit" 
                        class="btn btn-primary mobile-form-submit enhanced"
                        disabled=${isSubmitting || (progressiveValidation && validationProgress < 100)}
                    >
                        ${isSubmitting ? html`
                            <span class="loading-spinner"></span>
                            ${isOffline ? 'Saving...' : 'Submitting...'}
                        ` : submitLabel}
                    </button>
                </div>
                
                ${isOffline && offlineSupport && html`
                    <div class="offline-notice">
                        <small>
                            📡 You're offline. Form will be saved locally and synced when connection is restored.
                        </small>
                    </div>
                `}
            </div>
        </form>
    `;
};

export default EnhancedMobileForm;