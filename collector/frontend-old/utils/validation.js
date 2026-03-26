/**
 * Validation Utilities for ProDB Collector
 * Provides common validation functions for forms and data
 */

/**
 * Validation result structure
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string[]} errors - Array of error messages
 * @property {string[]} warnings - Array of warning messages
 */

/**
 * Field validation rule
 * @typedef {Object} ValidationRule
 * @property {string} type - Rule type (required, minLength, maxLength, pattern, etc.)
 * @property {any} value - Rule value/parameter
 * @property {string} message - Custom error message
 */

export class Validator {
    constructor() {
        this.rules = new Map();
        this.customValidators = new Map();
    }

    /**
     * Add validation rule for a field
     * @param {string} fieldName - Field name
     * @param {ValidationRule[]} rules - Validation rules
     */
    addRules(fieldName, rules) {
        this.rules.set(fieldName, rules);
    }

    /**
     * Add custom validator function
     * @param {string} name - Validator name
     * @param {Function} validator - Validator function
     */
    addCustomValidator(name, validator) {
        this.customValidators.set(name, validator);
    }

    /**
     * Validate single field
     * @param {string} fieldName - Field name
     * @param {any} value - Field value
     * @param {ValidationRule[]} rules - Validation rules (optional)
     * @returns {ValidationResult} Validation result
     */
    validateField(fieldName, value, rules = null) {
        const fieldRules = rules || this.rules.get(fieldName) || [];
        const errors = [];
        const warnings = [];

        for (const rule of fieldRules) {
            const result = this.applyRule(value, rule, fieldName);
            if (!result.valid) {
                if (result.severity === 'warning') {
                    warnings.push(result.message);
                } else {
                    errors.push(result.message);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate multiple fields
     * @param {Object} data - Data object to validate
     * @param {Object} fieldRules - Field rules mapping (optional)
     * @returns {ValidationResult} Validation result
     */
    validateObject(data, fieldRules = null) {
        const allErrors = [];
        const allWarnings = [];

        const rulesToUse = fieldRules || Object.fromEntries(this.rules);

        for (const [fieldName, rules] of Object.entries(rulesToUse)) {
            const fieldValue = data[fieldName];
            const result = this.validateField(fieldName, fieldValue, rules);
            
            allErrors.push(...result.errors);
            allWarnings.push(...result.warnings);
        }

        return {
            valid: allErrors.length === 0,
            errors: allErrors,
            warnings: allWarnings
        };
    }

    /**
     * Apply single validation rule
     * @param {any} value - Value to validate
     * @param {ValidationRule} rule - Validation rule
     * @param {string} fieldName - Field name for error messages
     * @returns {Object} Rule application result
     */
    applyRule(value, rule, fieldName) {
        const { type, value: ruleValue, message, severity = 'error' } = rule;

        switch (type) {
            case 'required':
                if (this.isEmpty(value)) {
                    return {
                        valid: false,
                        message: message || `${fieldName} is required`,
                        severity
                    };
                }
                break;

            case 'minLength':
                if (value && value.length < ruleValue) {
                    return {
                        valid: false,
                        message: message || `${fieldName} must be at least ${ruleValue} characters`,
                        severity
                    };
                }
                break;

            case 'maxLength':
                if (value && value.length > ruleValue) {
                    return {
                        valid: false,
                        message: message || `${fieldName} must be at most ${ruleValue} characters`,
                        severity
                    };
                }
                break;

            case 'min':
                if (value !== null && value !== undefined && Number(value) < ruleValue) {
                    return {
                        valid: false,
                        message: message || `${fieldName} must be at least ${ruleValue}`,
                        severity
                    };
                }
                break;

            case 'max':
                if (value !== null && value !== undefined && Number(value) > ruleValue) {
                    return {
                        valid: false,
                        message: message || `${fieldName} must be at most ${ruleValue}`,
                        severity
                    };
                }
                break;

            case 'pattern':
                if (value && !ruleValue.test(value)) {
                    return {
                        valid: false,
                        message: message || `${fieldName} format is invalid`,
                        severity
                    };
                }
                break;

            case 'email':
                if (value && !this.isValidEmail(value)) {
                    return {
                        valid: false,
                        message: message || `${fieldName} must be a valid email address`,
                        severity
                    };
                }
                break;

            case 'url':
                if (value && !this.isValidUrl(value)) {
                    return {
                        valid: false,
                        message: message || `${fieldName} must be a valid URL`,
                        severity
                    };
                }
                break;

            case 'ip':
                if (value && !this.isValidIP(value)) {
                    return {
                        valid: false,
                        message: message || `${fieldName} must be a valid IP address`,
                        severity
                    };
                }
                break;

            case 'port':
                if (value && !this.isValidPort(value)) {
                    return {
                        valid: false,
                        message: message || `${fieldName} must be a valid port number (1-65535)`,
                        severity
                    };
                }
                break;

            case 'custom':
                if (this.customValidators.has(ruleValue)) {
                    const customValidator = this.customValidators.get(ruleValue);
                    const result = customValidator(value, fieldName);
                    if (!result.valid) {
                        return {
                            valid: false,
                            message: message || result.message,
                            severity
                        };
                    }
                }
                break;

            default:
                console.warn(`Unknown validation rule type: ${type}`);
        }

        return { valid: true };
    }

    /**
     * Check if value is empty
     * @param {any} value - Value to check
     * @returns {boolean} True if empty
     */
    isEmpty(value) {
        return value === null || 
               value === undefined || 
               value === '' || 
               (Array.isArray(value) && value.length === 0) ||
               (typeof value === 'object' && Object.keys(value).length === 0);
    }

    /**
     * Validate email address
     * @param {string} email - Email to validate
     * @returns {boolean} True if valid
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validate URL
     * @param {string} url - URL to validate
     * @returns {boolean} True if valid
     */
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Validate IP address
     * @param {string} ip - IP address to validate
     * @returns {boolean} True if valid
     */
    isValidIP(ip) {
        const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        return ipv4Regex.test(ip) || ipv6Regex.test(ip);
    }

    /**
     * Validate port number
     * @param {number|string} port - Port to validate
     * @returns {boolean} True if valid
     */
    isValidPort(port) {
        const portNum = Number(port);
        return Number.isInteger(portNum) && portNum >= 1 && portNum <= 65535;
    }
}

// Protocol-specific validation functions
export const protocolValidators = {
    /**
     * Validate OPC UA endpoint
     * @param {string} endpoint - OPC UA endpoint
     * @returns {ValidationResult} Validation result
     */
    opcuaEndpoint(endpoint) {
        const errors = [];
        const warnings = [];

        if (!endpoint) {
            errors.push('OPC UA endpoint is required');
        } else {
            if (!endpoint.startsWith('opc.tcp://')) {
                errors.push('OPC UA endpoint must start with "opc.tcp://"');
            }

            try {
                const url = new URL(endpoint);
                if (!url.hostname) {
                    errors.push('OPC UA endpoint must include a hostname');
                }
                if (!url.port) {
                    warnings.push('OPC UA endpoint should include a port number');
                }
            } catch {
                errors.push('OPC UA endpoint format is invalid');
            }
        }

        return { valid: errors.length === 0, errors, warnings };
    },

    /**
     * Validate Modbus configuration
     * @param {Object} config - Modbus configuration
     * @returns {ValidationResult} Validation result
     */
    modbusConfig(config) {
        const errors = [];
        const warnings = [];

        if (!config.host) {
            errors.push('Modbus host is required');
        } else if (!protocolValidators.isValidHostname(config.host)) {
            errors.push('Modbus host must be a valid IP address or hostname');
        }

        if (!config.port) {
            errors.push('Modbus port is required');
        } else if (!validator.isValidPort(config.port)) {
            errors.push('Modbus port must be between 1 and 65535');
        }

        if (config.slaveId === undefined || config.slaveId === null) {
            errors.push('Modbus slave ID is required');
        } else {
            const slaveId = Number(config.slaveId);
            if (!Number.isInteger(slaveId) || slaveId < 1 || slaveId > 255) {
                errors.push('Modbus slave ID must be between 1 and 255');
            }
        }

        return { valid: errors.length === 0, errors, warnings };
    },

    /**
     * Validate MQTT configuration
     * @param {Object} config - MQTT configuration
     * @returns {ValidationResult} Validation result
     */
    mqttConfig(config) {
        const errors = [];
        const warnings = [];

        if (!config.broker) {
            errors.push('MQTT broker is required');
        } else {
            if (!config.broker.match(/^mqtts?:\/\//)) {
                warnings.push('MQTT broker should start with "mqtt://" or "mqtts://"');
            }

            try {
                const url = new URL(config.broker);
                if (!url.hostname) {
                    errors.push('MQTT broker must include a hostname');
                }
            } catch {
                errors.push('MQTT broker format is invalid');
            }
        }

        if (!config.topic) {
            errors.push('MQTT topic is required');
        } else if (config.topic.includes('#') && !config.topic.endsWith('#')) {
            warnings.push('MQTT wildcard "#" should only be used at the end of topic');
        }

        if (config.qos !== undefined) {
            const qos = Number(config.qos);
            if (![0, 1, 2].includes(qos)) {
                errors.push('MQTT QoS must be 0, 1, or 2');
            }
        }

        return { valid: errors.length === 0, errors, warnings };
    },

    /**
     * Check if hostname is valid
     * @param {string} hostname - Hostname to validate
     * @returns {boolean} True if valid
     */
    isValidHostname(hostname) {
        // Check if it's an IP address
        if (validator.isValidIP(hostname)) {
            return true;
        }

        // Check if it's a valid hostname
        const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        return hostnameRegex.test(hostname);
    }
};

// Form validation helpers
export const formValidators = {
    /**
     * Create validation rules for protocol configuration
     * @param {string} protocolType - Protocol type
     * @returns {Object} Validation rules
     */
    createProtocolRules(protocolType) {
        const rules = {};

        switch (protocolType) {
            case 'OPC_UA':
                rules.endpoint = [
                    { type: 'required' },
                    { type: 'custom', value: 'opcuaEndpoint' }
                ];
                rules.securityPolicy = [{ type: 'required' }];
                rules.securityMode = [{ type: 'required' }];
                break;

            case 'MODBUS_TCP':
                rules.host = [
                    { type: 'required' },
                    { type: 'custom', value: 'hostname' }
                ];
                rules.port = [
                    { type: 'required' },
                    { type: 'port' }
                ];
                rules.slaveId = [
                    { type: 'required' },
                    { type: 'min', value: 1 },
                    { type: 'max', value: 255 }
                ];
                break;

            case 'MQTT':
                rules.broker = [
                    { type: 'required' },
                    { type: 'url' }
                ];
                rules.topic = [{ type: 'required' }];
                rules.port = [{ type: 'port' }];
                break;

            default:
                console.warn(`No validation rules defined for protocol: ${protocolType}`);
        }

        return rules;
    },

    /**
     * Validate form data
     * @param {Object} formData - Form data to validate
     * @param {Object} rules - Validation rules
     * @returns {ValidationResult} Validation result
     */
    validateForm(formData, rules) {
        return validator.validateObject(formData, rules);
    }
};

// Create global validator instance
export const validator = new Validator();

// Register custom validators
validator.addCustomValidator('opcuaEndpoint', (value) => protocolValidators.opcuaEndpoint(value));
validator.addCustomValidator('hostname', (value) => ({
    valid: protocolValidators.isValidHostname(value),
    message: 'Must be a valid IP address or hostname'
}));

// Export validation utilities - all exports are already declared above