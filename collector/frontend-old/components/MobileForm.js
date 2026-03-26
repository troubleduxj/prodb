// Mobile-Optimized Form Component
import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';

const MobileForm = ({ 
    fields = [], 
    onSubmit = () => {}, 
    onCancel = null,
    submitLabel = 'Submit',
    cancelLabel = 'Cancel',
    title = '',
    collapsible = false,
    initialData = {},
    className = ''
}) => {
    const [formData, setFormData] = useState(initialData);
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [collapsedSections, setCollapsedSections] = useState(new Set());

    // Check if we're on mobile
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Group fields by section
    const groupedFields = fields.reduce((groups, field) => {
        const section = field.section || 'default';
        if (!groups[section]) {
            groups[section] = [];
        }
        groups[section].push(field);
        return groups;
    }, {});

    // Handle form input changes
    const handleInputChange = (fieldName, value) => {
        setFormData(prev => ({
            ...prev,
            [fieldName]: value
        }));
        
        // Clear error when user starts typing
        if (errors[fieldName]) {
            setErrors(prev => ({
                ...prev,
                [fieldName]: null
            }));
        }
    };

    // Validate form
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

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }
        
        setIsSubmitting(true);
        try {
            await onSubmit(formData);
        } catch (error) {
            console.error('Form submission error:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Toggle section collapse
    const toggleSection = (sectionName) => {
        const newCollapsed = new Set(collapsedSections);
        if (newCollapsed.has(sectionName)) {
            newCollapsed.delete(sectionName);
        } else {
            newCollapsed.add(sectionName);
        }
        setCollapsedSections(newCollapsed);
    };

    // Render form field
    const renderField = (field) => {
        const value = formData[field.name] || '';
        const error = errors[field.name];
        const fieldId = `field-${field.name}`;

        const commonProps = {
            id: fieldId,
            name: field.name,
            value: value,
            onChange: (e) => handleInputChange(field.name, e.target.value),
            className: `mobile-form-input ${error ? 'error' : ''} ${field.className || ''}`,
            placeholder: field.placeholder || field.label,
            disabled: isSubmitting || field.disabled,
            required: field.required
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
                        rows=${field.rows || 3}
                        style="resize: vertical; min-height: 44px;"
                    ></textarea>
                `;
                break;
                
            case 'checkbox':
                inputElement = html`
                    <label class="mobile-checkbox-label">
                        <input 
                            type="checkbox"
                            id=${fieldId}
                            name=${field.name}
                            checked=${value}
                            onChange=${(e) => handleInputChange(field.name, e.target.checked)}
                            disabled=${isSubmitting || field.disabled}
                            class="mobile-checkbox"
                        />
                        <span class="mobile-checkbox-text">${field.label}</span>
                    </label>
                `;
                break;
                
            case 'radio':
                inputElement = html`
                    <div class="mobile-radio-group">
                        ${field.options?.map(option => html`
                            <label key=${option.value} class="mobile-radio-label">
                                <input 
                                    type="radio"
                                    name=${field.name}
                                    value=${option.value}
                                    checked=${value === option.value}
                                    onChange=${(e) => handleInputChange(field.name, e.target.value)}
                                    disabled=${isSubmitting || field.disabled}
                                    class="mobile-radio"
                                />
                                <span class="mobile-radio-text">${option.label}</span>
                            </label>
                        `)}
                    </div>
                `;
                break;
                
            default:
                inputElement = html`
                    <input 
                        type=${field.type || 'text'}
                        ...${commonProps}
                        min=${field.min}
                        max=${field.max}
                        step=${field.step}
                        pattern=${field.pattern}
                    />
                `;
        }

        return html`
            <div class="mobile-form-field ${field.type === 'checkbox' ? 'checkbox-field' : ''}">
                ${field.type !== 'checkbox' && html`
                    <label for=${fieldId} class="mobile-form-label">
                        ${field.label}
                        ${field.required && html`<span class="required-indicator">*</span>`}
                    </label>
                `}
                ${inputElement}
                ${field.help && html`
                    <div class="mobile-form-help">${field.help}</div>
                `}
                ${error && html`
                    <div class="mobile-form-error">${error}</div>
                `}
            </div>
        `;
    };

    // Render section
    const renderSection = (sectionName, sectionFields) => {
        const isCollapsed = collapsedSections.has(sectionName);
        const isDefaultSection = sectionName === 'default';
        
        return html`
            <div class="mobile-form-section ${isCollapsed ? 'collapsed' : ''}">
                ${!isDefaultSection && html`
                    <div 
                        class="mobile-form-section-header ${collapsible ? 'collapsible' : ''}"
                        onClick=${collapsible ? () => toggleSection(sectionName) : null}
                    >
                        <h3 class="mobile-form-section-title">${sectionName}</h3>
                        ${collapsible && html`
                            <span class="mobile-form-section-toggle">
                                ${isCollapsed ? '▶' : '▼'}
                            </span>
                        `}
                    </div>
                `}
                <div class="mobile-form-section-content ${isCollapsed ? 'hidden' : ''}">
                    ${sectionFields.map(field => renderField(field))}
                </div>
            </div>
        `;
    };

    return html`
        <form class="mobile-form ${className}" onSubmit=${handleSubmit}>
            ${title && html`
                <div class="mobile-form-header">
                    <h2 class="mobile-form-title">${title}</h2>
                </div>
            `}
            
            <div class="mobile-form-body">
                ${Object.entries(groupedFields).map(([sectionName, sectionFields]) => 
                    renderSection(sectionName, sectionFields)
                )}
            </div>
            
            <div class="mobile-form-footer">
                <div class="mobile-form-actions">
                    ${onCancel && html`
                        <button 
                            type="button" 
                            class="btn btn-secondary mobile-form-cancel"
                            onClick=${onCancel}
                            disabled=${isSubmitting}
                        >
                            ${cancelLabel}
                        </button>
                    `}
                    <button 
                        type="submit" 
                        class="btn btn-primary mobile-form-submit"
                        disabled=${isSubmitting}
                    >
                        ${isSubmitting ? 'Submitting...' : submitLabel}
                    </button>
                </div>
            </div>
        </form>
    `;
};

export default MobileForm;