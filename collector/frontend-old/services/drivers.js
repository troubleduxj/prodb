/**
 * Driver Service Layer for ProDB Collector
 * Handles driver management operations and lifecycle
 */

import { driverAPI } from './api.js';

export class DriverService {
    constructor() {
        this.loadedDrivers = new Map();
        this.availableDrivers = new Map();
        this.driverStatus = new Map();
    }

    /**
     * Initialize driver service
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            await this.refreshDrivers();
        } catch (error) {
            console.error('Failed to initialize driver service:', error);
        }
    }

    /**
     * Refresh driver lists
     * @returns {Promise<void>}
     */
    async refreshDrivers() {
        try {
            const [loaded, available] = await Promise.all([
                driverAPI.getDrivers(),
                driverAPI.getAvailableDrivers()
            ]);

            // Update loaded drivers
            this.loadedDrivers.clear();
            loaded.forEach(driver => {
                this.loadedDrivers.set(driver.id, driver);
                this.driverStatus.set(driver.id, driver.status);
            });

            // Update available drivers
            this.availableDrivers.clear();
            available.forEach(driver => {
                this.availableDrivers.set(driver.id, driver);
            });

        } catch (error) {
            console.error('Failed to refresh drivers:', error);
            throw error;
        }
    }

    /**
     * Get loaded drivers
     * @returns {Array} Loaded drivers
     */
    getLoadedDrivers() {
        return Array.from(this.loadedDrivers.values());
    }

    /**
     * Get available drivers
     * @returns {Array} Available drivers
     */
    getAvailableDrivers() {
        return Array.from(this.availableDrivers.values());
    }

    /**
     * Get driver by ID
     * @param {string} driverId - Driver ID
     * @returns {Object|null} Driver information
     */
    getDriver(driverId) {
        return this.loadedDrivers.get(driverId) || this.availableDrivers.get(driverId) || null;
    }

    /**
     * Check if driver is loaded
     * @param {string} driverId - Driver ID
     * @returns {boolean} True if driver is loaded
     */
    isDriverLoaded(driverId) {
        return this.loadedDrivers.has(driverId) && 
               this.driverStatus.get(driverId) === 'loaded';
    }

    /**
     * Get driver status
     * @param {string} driverId - Driver ID
     * @returns {string} Driver status
     */
    getDriverStatus(driverId) {
        return this.driverStatus.get(driverId) || 'unknown';
    }

    /**
     * Load driver
     * @param {string} driverId - Driver ID
     * @returns {Promise<Object>} Load result
     */
    async loadDriver(driverId) {
        try {
            this.driverStatus.set(driverId, 'loading');
            
            const result = await driverAPI.loadDriver(driverId);
            
            if (result.success) {
                this.driverStatus.set(driverId, 'loaded');
                await this.refreshDrivers(); // Refresh to get updated driver info
            } else {
                this.driverStatus.set(driverId, 'error');
            }

            return result;

        } catch (error) {
            this.driverStatus.set(driverId, 'error');
            throw error;
        }
    }

    /**
     * Unload driver
     * @param {string} driverId - Driver ID
     * @returns {Promise<Object>} Unload result
     */
    async unloadDriver(driverId) {
        try {
            this.driverStatus.set(driverId, 'unloading');
            
            const result = await driverAPI.unloadDriver(driverId);
            
            if (result.success) {
                this.driverStatus.set(driverId, 'unloaded');
                this.loadedDrivers.delete(driverId);
            } else {
                this.driverStatus.set(driverId, 'error');
            }

            return result;

        } catch (error) {
            this.driverStatus.set(driverId, 'error');
            throw error;
        }
    }

    /**
     * Toggle driver status (load/unload)
     * @param {string} driverId - Driver ID
     * @returns {Promise<Object>} Operation result
     */
    async toggleDriver(driverId) {
        const isLoaded = this.isDriverLoaded(driverId);
        
        if (isLoaded) {
            return this.unloadDriver(driverId);
        } else {
            return this.loadDriver(driverId);
        }
    }

    /**
     * Install driver from file
     * @param {File} driverFile - Driver file
     * @returns {Promise<Object>} Install result
     */
    async installDriverFromFile(driverFile) {
        try {
            const result = await driverAPI.installDriver(driverFile, driverFile.name);
            
            if (result.success) {
                await this.refreshDrivers(); // Refresh to include new driver
            }

            return result;

        } catch (error) {
            console.error('Failed to install driver:', error);
            throw error;
        }
    }

    /**
     * Install driver from URL
     * @param {string} driverUrl - Driver download URL
     * @param {string} fileName - File name
     * @returns {Promise<Object>} Install result
     */
    async installDriverFromUrl(driverUrl, fileName) {
        try {
            // Download driver file
            const response = await fetch(driverUrl);
            if (!response.ok) {
                throw new Error(`Failed to download driver: ${response.statusText}`);
            }

            const driverContent = await response.text();
            const base64Content = btoa(driverContent);

            const result = await driverAPI.installDriver(base64Content, fileName);
            
            if (result.success) {
                await this.refreshDrivers();
            }

            return result;

        } catch (error) {
            console.error('Failed to install driver from URL:', error);
            throw error;
        }
    }

    /**
     * Validate driver file
     * @param {File} driverFile - Driver file to validate
     * @returns {Promise<Object>} Validation result
     */
    async validateDriverFile(driverFile) {
        try {
            // Basic file validation
            const validExtensions = ['.js', '.dll', '.so', '.dylib'];
            const fileExtension = driverFile.name.toLowerCase().substring(driverFile.name.lastIndexOf('.'));
            
            if (!validExtensions.includes(fileExtension)) {
                return {
                    valid: false,
                    errors: [`Unsupported file type: ${fileExtension}`]
                };
            }

            // Size validation (max 10MB)
            const maxSize = 10 * 1024 * 1024;
            if (driverFile.size > maxSize) {
                return {
                    valid: false,
                    errors: ['Driver file is too large (max 10MB)']
                };
            }

            // For JavaScript drivers, perform basic syntax validation
            if (fileExtension === '.js') {
                const content = await this.readFileAsText(driverFile);
                try {
                    // Basic syntax check
                    new Function(content);
                } catch (syntaxError) {
                    return {
                        valid: false,
                        errors: [`JavaScript syntax error: ${syntaxError.message}`]
                    };
                }
            }

            return { valid: true, errors: [] };

        } catch (error) {
            return {
                valid: false,
                errors: [`Validation failed: ${error.message}`]
            };
        }
    }

    /**
     * Read file as text
     * @param {File} file - File to read
     * @returns {Promise<string>} File content
     */
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    /**
     * Get drivers by protocol
     * @param {string} protocol - Protocol type
     * @returns {Array} Drivers supporting the protocol
     */
    getDriversByProtocol(protocol) {
        const allDrivers = [...this.getLoadedDrivers(), ...this.getAvailableDrivers()];
        return allDrivers.filter(driver => 
            driver.protocol === protocol || 
            (driver.supportedProtocols && driver.supportedProtocols.includes(protocol))
        );
    }

    /**
     * Get driver statistics
     * @returns {Object} Driver statistics
     */
    getDriverStats() {
        const loaded = this.getLoadedDrivers();
        const available = this.getAvailableDrivers();
        
        const protocolCounts = {};
        [...loaded, ...available].forEach(driver => {
            const protocol = driver.protocol;
            protocolCounts[protocol] = (protocolCounts[protocol] || 0) + 1;
        });

        const statusCounts = {};
        Array.from(this.driverStatus.values()).forEach(status => {
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });

        return {
            total: loaded.length + available.length,
            loaded: loaded.length,
            available: available.length,
            protocolCounts,
            statusCounts
        };
    }

    /**
     * Search drivers
     * @param {string} query - Search query
     * @returns {Array} Matching drivers
     */
    searchDrivers(query) {
        const allDrivers = [...this.getLoadedDrivers(), ...this.getAvailableDrivers()];
        const lowerQuery = query.toLowerCase();
        
        return allDrivers.filter(driver => 
            driver.name.toLowerCase().includes(lowerQuery) ||
            driver.description.toLowerCase().includes(lowerQuery) ||
            driver.protocol.toLowerCase().includes(lowerQuery) ||
            (driver.author && driver.author.toLowerCase().includes(lowerQuery))
        );
    }

    /**
     * Export driver configuration
     * @param {string} driverId - Driver ID
     * @returns {Object} Driver configuration
     */
    exportDriverConfig(driverId) {
        const driver = this.getDriver(driverId);
        if (!driver) {
            throw new Error(`Driver not found: ${driverId}`);
        }

        return {
            id: driver.id,
            name: driver.name,
            version: driver.version,
            protocol: driver.protocol,
            config: driver.config || {},
            exportedAt: new Date().toISOString()
        };
    }

    /**
     * Import driver configuration
     * @param {Object} driverConfig - Driver configuration
     * @returns {Promise<Object>} Import result
     */
    async importDriverConfig(driverConfig) {
        try {
            // Validate configuration structure
            const requiredFields = ['id', 'name', 'protocol'];
            const missingFields = requiredFields.filter(field => !driverConfig[field]);
            
            if (missingFields.length > 0) {
                throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
            }

            // Check if driver exists
            const existingDriver = this.getDriver(driverConfig.id);
            if (!existingDriver) {
                throw new Error(`Driver not found: ${driverConfig.id}`);
            }

            // Apply configuration (this would typically involve API call)
            // For now, we'll just update local state
            if (this.loadedDrivers.has(driverConfig.id)) {
                const driver = this.loadedDrivers.get(driverConfig.id);
                driver.config = { ...driver.config, ...driverConfig.config };
                this.loadedDrivers.set(driverConfig.id, driver);
            }

            return {
                success: true,
                message: 'Driver configuration imported successfully'
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get driver health status
     * @param {string} driverId - Driver ID
     * @returns {Promise<Object>} Health status
     */
    async getDriverHealth(driverId) {
        try {
            const driver = this.getDriver(driverId);
            if (!driver) {
                return { healthy: false, error: 'Driver not found' };
            }

            if (!this.isDriverLoaded(driverId)) {
                return { healthy: false, error: 'Driver not loaded' };
            }

            // This would typically make an API call to check driver health
            // For now, we'll simulate based on status
            const status = this.getDriverStatus(driverId);
            
            return {
                healthy: status === 'loaded',
                status,
                lastCheck: new Date().toISOString(),
                uptime: driver.uptime || 0,
                memoryUsage: driver.memoryUsage || 0,
                errorCount: driver.errorCount || 0
            };

        } catch (error) {
            return {
                healthy: false,
                error: error.message
            };
        }
    }

    // ===== VERSION MANAGEMENT METHODS =====

    /**
     * Get driver version history
     * @param {string} driverId - Driver ID
     * @returns {Promise<Array>} Version history
     */
    async getDriverVersionHistory(driverId) {
        try {
            return await driverAPI.getVersionHistory(driverId);
        } catch (error) {
            console.error('Failed to get version history:', error);
            throw error;
        }
    }

    /**
     * Check for driver updates
     * @param {string} driverId - Driver ID
     * @returns {Promise<Array>} Available updates
     */
    async checkDriverUpdates(driverId) {
        try {
            return await driverAPI.checkUpdates(driverId);
        } catch (error) {
            console.error('Failed to check updates:', error);
            throw error;
        }
    }

    /**
     * Update driver to specific version
     * @param {string} driverId - Driver ID
     * @param {string} targetVersion - Target version
     * @param {Object} options - Update options
     * @returns {Promise<Object>} Update result
     */
    async updateDriverVersion(driverId, targetVersion, options = {}) {
        try {
            const result = await driverAPI.updateVersion(driverId, targetVersion, options);
            
            if (result.success) {
                await this.refreshDrivers();
            }
            
            return result;
        } catch (error) {
            console.error('Failed to update driver version:', error);
            throw error;
        }
    }

    /**
     * Rollback driver to previous version
     * @param {string} driverId - Driver ID
     * @param {string} targetVersion - Target version
     * @returns {Promise<Object>} Rollback result
     */
    async rollbackDriverVersion(driverId, targetVersion) {
        try {
            const result = await driverAPI.rollbackVersion(driverId, targetVersion);
            
            if (result.success) {
                await this.refreshDrivers();
            }
            
            return result;
        } catch (error) {
            console.error('Failed to rollback driver version:', error);
            throw error;
        }
    }

    /**
     * Get rollback history
     * @param {string} driverId - Driver ID
     * @returns {Promise<Array>} Rollback history
     */
    async getRollbackHistory(driverId) {
        try {
            return await driverAPI.getRollbackHistory(driverId);
        } catch (error) {
            console.error('Failed to get rollback history:', error);
            return [];
        }
    }

    // ===== COMPATIBILITY AND VALIDATION METHODS =====

    /**
     * Check driver compatibility
     * @param {File} driverFile - Driver file
     * @returns {Promise<Object>} Compatibility result
     */
    async checkDriverCompatibility(driverFile) {
        try {
            return await driverAPI.checkCompatibility(driverFile);
        } catch (error) {
            console.error('Failed to check compatibility:', error);
            return {
                compatible: false,
                issues: [error.message]
            };
        }
    }

    /**
     * Check version compatibility
     * @param {string} driverId - Driver ID
     * @param {string} version - Version to check
     * @returns {Promise<Object>} Compatibility result
     */
    async checkVersionCompatibility(driverId, version) {
        try {
            return await driverAPI.checkVersionCompatibility(driverId, version);
        } catch (error) {
            console.error('Failed to check version compatibility:', error);
            return {
                compatible: false,
                issues: [error.message]
            };
        }
    }

    /**
     * Get compatibility matrix
     * @param {string} driverId - Driver ID
     * @returns {Promise<Object>} Compatibility matrix
     */
    async getCompatibilityMatrix(driverId) {
        try {
            return await driverAPI.getCompatibilityMatrix(driverId);
        } catch (error) {
            console.error('Failed to get compatibility matrix:', error);
            return null;
        }
    }

    /**
     * Validate driver compatibility
     * @param {string} driverId - Driver ID
     * @param {Object} options - Validation options
     * @returns {Promise<Object>} Validation results
     */
    async validateDriverCompatibility(driverId, options = {}) {
        try {
            return await driverAPI.validateCompatibility(driverId, options);
        } catch (error) {
            console.error('Failed to validate compatibility:', error);
            throw error;
        }
    }

    /**
     * Fix compatibility issues
     * @param {string} driverId - Driver ID
     * @param {Array} issues - Issues to fix
     * @returns {Promise<Object>} Fix result
     */
    async fixCompatibilityIssues(driverId, issues) {
        try {
            return await driverAPI.fixCompatibilityIssues(driverId, issues);
        } catch (error) {
            console.error('Failed to fix compatibility issues:', error);
            throw error;
        }
    }

    /**
     * Get validation history
     * @param {string} driverId - Driver ID
     * @returns {Promise<Array>} Validation history
     */
    async getValidationHistory(driverId) {
        try {
            return await driverAPI.getValidationHistory(driverId);
        } catch (error) {
            console.error('Failed to get validation history:', error);
            return [];
        }
    }

    /**
     * Get system information
     * @returns {Promise<Object>} System information
     */
    async getSystemInfo() {
        try {
            return await driverAPI.getSystemInfo();
        } catch (error) {
            console.error('Failed to get system info:', error);
            return {
                os: 'Unknown',
                version: 'Unknown',
                arch: 'Unknown',
                runtime: 'Unknown',
                runtimeVersion: 'Unknown',
                totalMemory: 0
            };
        }
    }

    /**
     * Get dependency graph
     * @param {string} driverId - Driver ID
     * @returns {Promise<Object>} Dependency graph
     */
    async getDependencyGraph(driverId) {
        try {
            return await driverAPI.getDependencyGraph(driverId);
        } catch (error) {
            console.error('Failed to get dependency graph:', error);
            return null;
        }
    }

    /**
     * Generate compatibility report
     * @param {Object} validationResults - Validation results
     * @returns {string} HTML report
     */
    generateCompatibilityReport(validationResults) {
        // Generate HTML report from validation results
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Driver Compatibility Report</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
                    .section { margin: 20px 0; }
                    .success { color: #10b981; }
                    .warning { color: #f59e0b; }
                    .error { color: #ef4444; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Driver Compatibility Report</h1>
                    <p>Generated on: ${new Date().toLocaleString()}</p>
                    <p>Overall Status: <span class="${validationResults.overall.status}">${validationResults.overall.status}</span></p>
                </div>
                
                <div class="section">
                    <h2>System Requirements</h2>
                    ${this.generateSectionHTML(validationResults.systemRequirements)}
                </div>
                
                <div class="section">
                    <h2>Dependencies</h2>
                    ${this.generateSectionHTML(validationResults.dependencies)}
                </div>
                
                <div class="section">
                    <h2>Conflicts</h2>
                    ${this.generateSectionHTML(validationResults.conflicts)}
                </div>
                
                <div class="section">
                    <h2>Performance</h2>
                    ${this.generateSectionHTML(validationResults.performance)}
                </div>
            </body>
            </html>
        `;
        
        return html;
    }

    /**
     * Generate section HTML for report
     * @param {Object} section - Section data
     * @returns {string} HTML content
     */
    generateSectionHTML(section) {
        if (!section) return '<p>No data available</p>';
        
        let html = '';
        
        if (section.passed && section.passed.length > 0) {
            html += '<h3 class="success">Passed Checks</h3><ul>';
            section.passed.forEach(check => {
                html += `<li>${check.description}</li>`;
            });
            html += '</ul>';
        }
        
        if (section.warnings && section.warnings.length > 0) {
            html += '<h3 class="warning">Warnings</h3><ul>';
            section.warnings.forEach(warning => {
                html += `<li>${warning.description}</li>`;
            });
            html += '</ul>';
        }
        
        if (section.issues && section.issues.length > 0) {
            html += '<h3 class="error">Issues</h3><ul>';
            section.issues.forEach(issue => {
                html += `<li>${issue.description}</li>`;
            });
            html += '</ul>';
        }
        
        return html || '<p>No checks performed</p>';
    }

    // ===== ONLINE DRIVER METHODS =====

    /**
     * Get online drivers
     * @returns {Promise<Array>} Online drivers
     */
    async getOnlineDrivers() {
        try {
            return await driverAPI.getOnlineDrivers();
        } catch (error) {
            console.error('Failed to get online drivers:', error);
            return [];
        }
    }

    /**
     * Install online driver
     * @param {string} driverId - Online driver ID
     * @param {Object} options - Installation options
     * @returns {Promise<Object>} Installation result
     */
    async installOnlineDriver(driverId, options = {}) {
        try {
            const result = await driverAPI.installOnlineDriver(driverId, options);
            
            if (result.success) {
                await this.refreshDrivers();
            }
            
            return result;
        } catch (error) {
            console.error('Failed to install online driver:', error);
            throw error;
        }
    }

    // ===== DEVELOPMENT TOOLS METHODS =====

    /**
     * Get driver API documentation
     * @returns {Promise<Object>} API documentation
     */
    async getDriverAPIDocumentation() {
        try {
            return await driverAPI.getAPIDocumentation();
        } catch (error) {
            console.error('Failed to get API documentation:', error);
            return null;
        }
    }

    /**
     * Get driver templates
     * @returns {Promise<Array>} Driver templates
     */
    async getDriverTemplates() {
        try {
            return await driverAPI.getDriverTemplates();
        } catch (error) {
            console.error('Failed to get driver templates:', error);
            return [];
        }
    }

    /**
     * Run driver test
     * @param {Object} testConfig - Test configuration
     * @returns {Promise<Object>} Test result
     */
    async runDriverTest(testConfig) {
        try {
            return await driverAPI.runDriverTest(testConfig);
        } catch (error) {
            console.error('Failed to run driver test:', error);
            throw error;
        }
    }

    /**
     * Validate driver code
     * @param {string} code - Driver code
     * @returns {Promise<Object>} Validation result
     */
    async validateDriverCode(code) {
        try {
            return await driverAPI.validateDriverCode(code);
        } catch (error) {
            console.error('Failed to validate driver code:', error);
            throw error;
        }
    }
}

// Create singleton instance
export const driverService = new DriverService();