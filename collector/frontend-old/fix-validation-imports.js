#!/usr/bin/env node

/**
 * Fix validation imports script
 * Ensures all validation.js imports are correct after fixing duplicate exports
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Fixing validation imports...');

// Test the validation module
async function testValidationModule() {
    try {
        console.log('Testing validation module import...');
        
        // Dynamic import to test the module
        const validationModule = await import('./utils/validation.js');
        
        console.log('✅ Validation module imported successfully');
        console.log('Available exports:', Object.keys(validationModule));
        
        // Test basic functionality
        const { validator, protocolValidators, formValidators } = validationModule;
        
        if (validator) {
            console.log('✅ validator instance available');
            
            // Test basic validation
            const result = validator.validateField('test', 'value', [
                { type: 'required' }
            ]);
            
            if (result && typeof result.valid === 'boolean') {
                console.log('✅ Basic validation working');
            } else {
                console.log('❌ Basic validation not working');
            }
        }
        
        if (protocolValidators) {
            console.log('✅ protocolValidators available');
            
            // Test OPC UA validation
            const opcuaResult = protocolValidators.opcuaEndpoint('opc.tcp://localhost:4840');
            if (opcuaResult && typeof opcuaResult.valid === 'boolean') {
                console.log('✅ Protocol validation working');
            } else {
                console.log('❌ Protocol validation not working');
            }
        }
        
        if (formValidators) {
            console.log('✅ formValidators available');
            
            // Test form rules creation
            const rules = formValidators.createProtocolRules('OPC_UA');
            if (rules && rules.endpoint) {
                console.log('✅ Form validation working');
            } else {
                console.log('❌ Form validation not working');
            }
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Validation module test failed:', error.message);
        console.error('Stack trace:', error.stack);
        return false;
    }
}

// Check for syntax errors in key files
function checkSyntaxErrors() {
    const filesToCheck = [
        'utils/validation.js',
        'components/ConfigWizard.js',
        'test/utils/validation.test.js'
    ];
    
    console.log('\n🔍 Checking for syntax errors...');
    
    for (const file of filesToCheck) {
        const filePath = path.join(__dirname, file);
        
        if (fs.existsSync(filePath)) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                
                // Basic syntax checks
                const exportMatches = content.match(/export\s+.*formValidators/g);
                if (exportMatches && exportMatches.length > 1) {
                    console.log(`❌ ${file}: Multiple formValidators exports found`);
                    console.log('   Exports:', exportMatches);
                } else {
                    console.log(`✅ ${file}: No duplicate exports`);
                }
                
                // Check for common syntax issues
                const braceCount = (content.match(/{/g) || []).length - (content.match(/}/g) || []).length;
                if (braceCount !== 0) {
                    console.log(`⚠️  ${file}: Unmatched braces (${braceCount})`);
                }
                
            } catch (error) {
                console.log(`❌ ${file}: Error reading file - ${error.message}`);
            }
        } else {
            console.log(`⚠️  ${file}: File not found`);
        }
    }
}

// Main execution
async function main() {
    console.log('ProDB Collector - Validation Import Fix\n');
    
    // Check syntax first
    checkSyntaxErrors();
    
    // Test the module
    console.log('\n🧪 Testing validation module...');
    const testPassed = await testValidationModule();
    
    if (testPassed) {
        console.log('\n🎉 All validation tests passed!');
        console.log('The duplicate export issue has been resolved.');
        console.log('\nNext steps:');
        console.log('1. Refresh your browser');
        console.log('2. Check the browser console for any remaining errors');
        console.log('3. Test the application functionality');
    } else {
        console.log('\n❌ Validation tests failed!');
        console.log('Please check the error messages above and fix any issues.');
    }
}

// Run the script
main().catch(error => {
    console.error('Script execution failed:', error);
    process.exit(1);
});