/**
 * Enhanced Form Component
 * Provides form handling with validation, error management, and various input types
 */

import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect, useRef } from 'https://esm.sh/preact/hooks';
import { debounce } from '../utils/helpers.js';

const Form = ({
    onSubmit = null,
    onValidate = null,
    onChange = null,
    initialValues = {},
    validationRules = {},
    children,
    className = '',
    autoValidate = true,
    validateOnChange = true,
    validateOnBlur = true,
    showErrorSummary = false,
    disabled = false,
    loading = false,
    resetOnSubmit = false
}) => {
    const [values, setValues] = useState(initialValues);
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const formRef = useRef(null);

    // Debounced validation function
    const debouncedValidate = useRef(
        debounce((fieldName, value, allValues) => {
            if (validateOnChange && autoValidate) {
                validateField(fieldName, value, allValues);
            }
        }, 300)
    ).current;

    // Update values when initialValues change
    useEffect(() => {
        setValues(initialValues);
    }, [initialValues]);

    // Validate a single field
    const validateField = (fieldName, value, allValues = values) => {
        const rules = validationRules[fieldName];
        if (!rules) return null;

        let error = null;

        // Required validation
        if (rules.required && (!value || (typeof value === 'string' && !value.trim()))) {
            error = rules.requiredMessage || `${fieldName} is required`;
        }

        // Min length validation
        if (!error && rules.minLength && value && value.length < rules.minLength) {
            error = rules.minLengthMessage || `${fieldName} must be at least ${rules.minLength} characters`;
        }

        // Max length validation
        if (!error && rules.maxLength && value && value.length > rules.maxLength) {
            error = rules.maxLengthMessage || `${fieldName} must be no more than ${rules.maxLength} characters`;
        }

        // Pattern validation
        if (!error && rules.pattern && value && !rules.pattern.test(value)) {
            error = rules.patternMessage || `${fieldName} format is invalid`;
        }

        // Email validation
        if (!error && rules.email && value) {
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(value)) {
                error = rules.emailMessage || 'Please enter a valid email address';
            }
        }

        // Number validation
        if (!error && rules.number && value) {
            const num = Number(value);
            if (isNaN(num)) {
                error = rules.numberMessage || `${fieldName} must be a number`;
            } else {
                if (rules.min !== undefined && num < rules.min) {
                    error = rules.minMessage || `${fieldName} must be at least ${rules.min}`;
                }
                if (rules.max !== undefined && num > rules.max) {
                    error = rules.maxMessage || `${fieldName} must be no more than ${rules.max}`;
                }
            }
        }

        // Custom validation function
        if (!error && rules.validate && typeof rules.validate === 'function') {
            error = rules.validate(value, allValues);
        }

        // Update errors state
        setErrors(prev => ({
            ...prev,
            [fieldName]: error
        }));

        return error;
    };

    // Validate all fields
    const validateForm = (valuesToValidate = values) => {
        const newErrors = {};
        let hasErrors = false;

        Object.keys(validationRules).forEach(fieldName => {
            const error = validateField(fieldName, valuesToValidate[fieldName], valuesToValidate);
            if (error) {
                newErrors[fieldName] = error;
                hasErrors = true;
            }
        });

        // Custom form-level validation
        if (onValidate && typeof onValidate === 'function') {
            const formError = onValidate(valuesToValidate);
            if (formError) {
                newErrors._form = formError;
                hasErrors = true;
            }
        }

        setErrors(newErrors);
        return !hasErrors;
    };

    // Handle field value change
    const handleFieldChange = (fieldName, value) => {
        const newValues = { ...values, [fieldName]: value };
        setValues(newValues);

        // Call onChange callback
        if (onChange) {
            onChange(newValues, fieldName, value);
        }

        // Debounced validation
        if (touched[fieldName]) {
            debouncedValidate(fieldName, value, newValues);
        }
    };

    // Handle field blur
    const handleFieldBlur = (fieldName) => {
        setTouched(prev => ({ ...prev, [fieldName]: true }));

        if (validateOnBlur && autoValidate) {
            validateField(fieldName, values[fieldName]);
        }
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (disabled || loading || isSubmitting) return;

        // Mark all fields as touched
        const allFieldNames = Object.keys(validationRules);
        const newTouched = {};
        allFieldNames.forEach(name => {
            newTouched[name] = true;
        });
        setTouched(newTouched);

        // Validate form
        const isValid = validateForm();
        if (!isValid) return;

        setIsSubmitting(true);

        try {
            if (onSubmit) {
                await onSubmit(values);
            }

            if (resetOnSubmit) {
                setValues(initialValues);
                setTouched({});
                setErrors({});
            }
        } catch (error) {
            console.error('Form submission error:', error);
            setErrors(prev => ({
                ...prev,
                _form: error.message || 'An error occurred while submitting the form'
            }));
        } finally {
            setIsSubmitting(false);
        }
    };

    // Reset form
    const resetForm = () => {
        setValues(initialValues);
        setTouched({});
        setErrors({});
    };

    // Get field props for form controls
    const getFieldProps = (fieldName, type = 'text') => {
        return {
            name: fieldName,
            value: values[fieldName] || '',
            onChange: (e) => {
                const value = type === 'checkbox' ? e.target.checked : e.target.value;
                handleFieldChange(fieldName, value);
            },
            onBlur: () => handleFieldBlur(fieldName),
            error: touched[fieldName] ? errors[fieldName] : null,
            disabled: disabled || loading || isSubmitting
        };
    };

    // Error summary component
    const ErrorSummary = () => {
        const errorList = Object.entries(errors)
            .filter(([key, error]) => error && key !== '_form')
            .map(([key, error]) => ({ field: key, message: error }));

        if (!showErrorSummary || errorList.length === 0) return null;

        return html`
            <div class="form-error-summary" role="alert">
                <h4 class="error-summary-title">Please correct the following errors:</h4>
                <ul class="error-summary-list">
                    ${errorList.map(({ field, message }) => html`
                        <li key=${field}>
                            <a 
                                href="#${field}"
                                class="error-summary-link"
                                onClick=${(e) => {
                                    e.preventDefault();
                                    const element = formRef.current?.querySelector(`[name="${field}"]`);
                                    element?.focus();
                                }}
                            >
                                ${message}
                            </a>
                        </li>
                    `)}
                </ul>
            </div>
        `;
    };

    return html`
        <form 
            ref=${formRef}
            class="enhanced-form ${className} ${disabled || loading ? 'form-disabled' : ''}"
            onSubmit=${handleSubmit}
            noValidate
        >
            <${ErrorSummary} />
            
            ${errors._form ? html`
                <div class="form-error form-error-global" role="alert">
                    ${errors._form}
                </div>
            ` : ''}

            <div class="form-content">
                ${typeof children === 'function' 
                    ? children({ 
                        values, 
                        errors, 
                        touched, 
                        getFieldProps, 
                        resetForm,
                        isSubmitting: isSubmitting || loading,
                        isValid: Object.keys(errors).length === 0
                    })
                    : children
                }
            </div>
        </form>

        <style>
            /* Enhanced Form Styles */
            .enhanced-form {
                display: flex;
                flex-direction: column;
                gap: var(--space-4);
            }

            .form-disabled {
                opacity: 0.6;
                pointer-events: none;
            }

            .form-content {
                display: flex;
                flex-direction: column;
                gap: var(--space-4);
            }

            /* Error Summary */
            .form-error-summary {
                background-color: rgba(239, 68, 68, 0.1);
                border: 1px solid var(--color-error);
                border-radius: var(--border-radius);
                padding: var(--space-4);
                margin-bottom: var(--space-4);
            }

            .error-summary-title {
                color: var(--color-error);
                font-size: var(--font-size-sm);
                font-weight: var(--font-weight-semibold);
                margin: 0 0 var(--space-2) 0;
            }

            .error-summary-list {
                list-style: none;
                margin: 0;
                padding: 0;
            }

            .error-summary-list li {
                margin-bottom: var(--space-1);
            }

            .error-summary-link {
                color: var(--color-error);
                text-decoration: none;
                font-size: var(--font-size-sm);
            }

            .error-summary-link:hover {
                text-decoration: underline;
            }

            /* Global Form Error */
            .form-error-global {
                background-color: rgba(239, 68, 68, 0.1);
                border: 1px solid var(--color-error);
                border-radius: var(--border-radius);
                padding: var(--space-3);
                color: var(--color-error);
                font-size: var(--font-size-sm);
                text-align: center;
            }

            /* Form Group Styles */
            .form-group {
                display: flex;
                flex-direction: column;
                gap: var(--space-2);
            }

            .form-group-horizontal {
                flex-direction: row;
                align-items: center;
                gap: var(--space-4);
            }

            .form-group-horizontal .form-label {
                margin-bottom: 0;
                min-width: 120px;
            }

            /* Form Label */
            .form-label {
                display: block;
                font-weight: var(--font-weight-medium);
                color: var(--text-primary);
                font-size: var(--font-size-sm);
                margin-bottom: var(--space-2);
            }

            .form-label.required::after {
                content: ' *';
                color: var(--color-error);
            }

            /* Form Controls */
            .form-input,
            .form-select,
            .form-textarea {
                width: 100%;
                background-color: var(--bg-tertiary);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius);
                padding: var(--space-3);
                color: var(--text-primary);
                font-size: var(--font-size-base);
                transition: all var(--transition-normal);
                font-family: inherit;
            }

            .form-input:focus,
            .form-select:focus,
            .form-textarea:focus {
                outline: none;
                border-color: var(--color-primary);
                box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
            }

            .form-input.error,
            .form-select.error,
            .form-textarea.error {
                border-color: var(--color-error);
            }

            .form-input.error:focus,
            .form-select.error:focus,
            .form-textarea.error:focus {
                box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
            }

            .form-input::placeholder,
            .form-textarea::placeholder {
                color: var(--text-muted);
            }

            .form-textarea {
                resize: vertical;
                min-height: 80px;
            }

            /* Checkbox and Radio */
            .form-checkbox,
            .form-radio {
                display: flex;
                align-items: center;
                gap: var(--space-2);
                cursor: pointer;
            }

            .form-checkbox input,
            .form-radio input {
                margin: 0;
            }

            /* Form Error */
            .form-error {
                color: var(--color-error);
                font-size: var(--font-size-sm);
                margin-top: var(--space-1);
            }

            /* Form Help */
            .form-help {
                color: var(--text-muted);
                font-size: var(--font-size-sm);
                margin-top: var(--space-1);
            }

            /* Form Actions */
            .form-actions {
                display: flex;
                gap: var(--space-3);
                justify-content: flex-end;
                padding-top: var(--space-4);
                border-top: 1px solid var(--border-color);
            }

            /* Responsive Design */
            @media (max-width: 768px) {
                .form-group-horizontal {
                    flex-direction: column;
                    align-items: stretch;
                }

                .form-group-horizontal .form-label {
                    min-width: auto;
                }

                .form-actions {
                    flex-direction: column;
                }

                .form-actions .btn {
                    width: 100%;
                }
            }
        </style>
    `;
};

// Form field components
const FormGroup = ({ children, horizontal = false, className = '' }) => {
    return html`
        <div class="form-group ${horizontal ? 'form-group-horizontal' : ''} ${className}">
            ${children}
        </div>
    `;
};

const FormLabel = ({ children, required = false, htmlFor = '', className = '' }) => {
    return html`
        <label 
            class="form-label ${required ? 'required' : ''} ${className}"
            for=${htmlFor}
        >
            ${children}
        </label>
    `;
};

const FormInput = ({ type = 'text', error = null, className = '', ...props }) => {
    return html`
        <div>
            <input 
                type=${type}
                class="form-input ${error ? 'error' : ''} ${className}"
                ...${props}
            />
            ${error ? html`<div class="form-error">${error}</div>` : ''}
        </div>
    `;
};

const FormTextarea = ({ error = null, className = '', ...props }) => {
    return html`
        <div>
            <textarea 
                class="form-textarea ${error ? 'error' : ''} ${className}"
                ...${props}
            ></textarea>
            ${error ? html`<div class="form-error">${error}</div>` : ''}
        </div>
    `;
};

const FormSelect = ({ options = [], error = null, className = '', ...props }) => {
    return html`
        <div>
            <select 
                class="form-select ${error ? 'error' : ''} ${className}"
                ...${props}
            >
                ${options.map(option => html`
                    <option 
                        key=${option.value} 
                        value=${option.value}
                        disabled=${option.disabled}
                    >
                        ${option.label}
                    </option>
                `)}
            </select>
            ${error ? html`<div class="form-error">${error}</div>` : ''}
        </div>
    `;
};

const FormActions = ({ children, className = '' }) => {
    return html`
        <div class="form-actions ${className}">
            ${children}
        </div>
    `;
};

// Export form components
Form.Group = FormGroup;
Form.Label = FormLabel;
Form.Input = FormInput;
Form.Textarea = FormTextarea;
Form.Select = FormSelect;
Form.Actions = FormActions;

export default Form;