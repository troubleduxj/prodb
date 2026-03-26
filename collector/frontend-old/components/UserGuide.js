/**
 * User Guide and Tutorial System
 * Provides interactive tutorials and onboarding for new users
 */

import { html } from 'https://esm.sh/htm/preact';
import { useState, useEffect, useRef } from 'https://esm.sh/preact/hooks';
import { devLog } from '../utils/helpers.js';

const UserGuide = ({ 
    steps = [], 
    onComplete = null, 
    onSkip = null,
    autoStart = false,
    showProgress = true,
    allowSkip = true,
    overlay = true
}) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [targetElement, setTargetElement] = useState(null);
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
    const tooltipRef = useRef(null);
    const overlayRef = useRef(null);

    // Auto-start guide if enabled
    useEffect(() => {
        if (autoStart && steps.length > 0) {
            startGuide();
        }
    }, [autoStart, steps]);

    // Update target element and position when step changes
    useEffect(() => {
        if (isActive && steps[currentStep]) {
            updateTargetElement();
        }
    }, [currentStep, isActive]);

    // Handle window resize
    useEffect(() => {
        const handleResize = () => {
            if (isActive && targetElement) {
                updateTooltipPosition();
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isActive, targetElement]);

    const startGuide = () => {
        setCurrentStep(0);
        setIsActive(true);
        setIsVisible(true);
        devLog('User guide started');
    };

    const endGuide = (completed = false) => {
        setIsActive(false);
        setIsVisible(false);
        setTargetElement(null);
        
        if (completed && onComplete) {
            onComplete();
        }
        
        devLog(`User guide ${completed ? 'completed' : 'ended'}`);
    };

    const skipGuide = () => {
        if (onSkip) {
            onSkip();
        }
        endGuide(false);
    };

    const nextStep = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            endGuide(true);
        }
    };

    const prevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const goToStep = (stepIndex) => {
        if (stepIndex >= 0 && stepIndex < steps.length) {
            setCurrentStep(stepIndex);
        }
    };

    const updateTargetElement = () => {
        const step = steps[currentStep];
        if (!step || !step.target) return;

        const element = document.querySelector(step.target);
        if (element) {
            setTargetElement(element);
            updateTooltipPosition(element);
            
            // Scroll element into view if needed
            if (step.scrollIntoView !== false) {
                element.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center',
                    inline: 'center'
                });
            }
            
            // Add highlight class
            element.classList.add('guide-highlight');
            
            // Remove highlight from previous elements
            document.querySelectorAll('.guide-highlight').forEach(el => {
                if (el !== element) {
                    el.classList.remove('guide-highlight');
                }
            });
        } else {
            console.warn(`Guide target not found: ${step.target}`);
            setTargetElement(null);
        }
    };

    const updateTooltipPosition = (element = targetElement) => {
        if (!element || !tooltipRef.current) return;

        const elementRect = element.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const step = steps[currentStep];
        const position = step.position || 'bottom';
        
        let top, left;
        const offset = 20;
        const padding = 10;

        switch (position) {
            case 'top':
                top = elementRect.top - tooltipRect.height - offset;
                left = elementRect.left + (elementRect.width - tooltipRect.width) / 2;
                break;
            case 'bottom':
                top = elementRect.bottom + offset;
                left = elementRect.left + (elementRect.width - tooltipRect.width) / 2;
                break;
            case 'left':
                top = elementRect.top + (elementRect.height - tooltipRect.height) / 2;
                left = elementRect.left - tooltipRect.width - offset;
                break;
            case 'right':
                top = elementRect.top + (elementRect.height - tooltipRect.height) / 2;
                left = elementRect.right + offset;
                break;
            default:
                top = elementRect.bottom + offset;
                left = elementRect.left + (elementRect.width - tooltipRect.width) / 2;
        }

        // Keep tooltip within viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (left < padding) {
            left = padding;
        } else if (left + tooltipRect.width > viewportWidth - padding) {
            left = viewportWidth - tooltipRect.width - padding;
        }

        if (top < padding) {
            top = padding;
        } else if (top + tooltipRect.height > viewportHeight - padding) {
            top = viewportHeight - tooltipRect.height - padding;
        }

        setTooltipPosition({ top, left });
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            document.querySelectorAll('.guide-highlight').forEach(el => {
                el.classList.remove('guide-highlight');
            });
        };
    }, []);

    if (!isVisible || steps.length === 0) {
        return null;
    }

    const currentStepData = steps[currentStep];
    const progress = ((currentStep + 1) / steps.length) * 100;

    return html`
        <div class="user-guide-container">
            ${overlay && html`
                <div 
                    ref=${overlayRef}
                    class="guide-overlay"
                    onClick=${allowSkip ? skipGuide : null}
                />
            `}
            
            <div 
                ref=${tooltipRef}
                class="guide-tooltip ${currentStepData.className || ''}"
                style=${{
                    position: 'fixed',
                    top: `${tooltipPosition.top}px`,
                    left: `${tooltipPosition.left}px`,
                    zIndex: 10001
                }}
            >
                <div class="guide-content">
                    ${currentStepData.title && html`
                        <h3 class="guide-title">${currentStepData.title}</h3>
                    `}
                    
                    <div class="guide-description">
                        ${typeof currentStepData.content === 'string' 
                            ? html`<p>${currentStepData.content}</p>`
                            : currentStepData.content
                        }
                    </div>
                    
                    ${currentStepData.image && html`
                        <div class="guide-image">
                            <img src=${currentStepData.image} alt=${currentStepData.title || 'Guide step'} />
                        </div>
                    `}
                    
                    ${currentStepData.video && html`
                        <div class="guide-video">
                            <video 
                                src=${currentStepData.video} 
                                autoplay 
                                muted 
                                loop 
                                controls=${currentStepData.videoControls !== false}
                            />
                        </div>
                    `}
                    
                    ${currentStepData.code && html`
                        <div class="guide-code">
                            <pre><code>${currentStepData.code}</code></pre>
                        </div>
                    `}
                </div>
                
                ${showProgress && html`
                    <div class="guide-progress">
                        <div class="progress-bar">
                            <div 
                                class="progress-fill" 
                                style=${{ width: `${progress}%` }}
                            />
                        </div>
                        <span class="progress-text">
                            ${currentStep + 1} of ${steps.length}
                        </span>
                    </div>
                `}
                
                <div class="guide-actions">
                    <div class="guide-navigation">
                        <button 
                            class="btn btn-secondary"
                            onClick=${prevStep}
                            disabled=${currentStep === 0}
                        >
                            Previous
                        </button>
                        
                        <button 
                            class="btn btn-primary"
                            onClick=${nextStep}
                        >
                            ${currentStep === steps.length - 1 ? 'Finish' : 'Next'}
                        </button>
                    </div>
                    
                    ${allowSkip && html`
                        <button 
                            class="btn btn-text guide-skip"
                            onClick=${skipGuide}
                        >
                            Skip Tutorial
                        </button>
                    `}
                </div>
                
                ${steps.length > 1 && html`
                    <div class="guide-dots">
                        ${steps.map((_, index) => html`
                            <button
                                key=${index}
                                class="guide-dot ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}"
                                onClick=${() => goToStep(index)}
                                title=${steps[index].title || `Step ${index + 1}`}
                            />
                        `)}
                    </div>
                `}
                
                <div class="guide-arrow ${currentStepData.position || 'bottom'}" />
            </div>
        </div>
    `;
};

// Predefined guide steps for common workflows
export const GUIDE_STEPS = {
    dashboard: [
        {
            target: '.system-overview-card',
            title: 'System Overview',
            content: 'This card shows your collector\'s current status, including uptime, data points, and error counts.',
            position: 'bottom'
        },
        {
            target: '.interfaces-grid',
            title: 'Interface Management',
            content: 'Here you can see all your configured interfaces. Each card shows the connection status and provides quick actions.',
            position: 'top'
        },
        {
            target: '.add-interface-card',
            title: 'Add New Interface',
            content: 'Click here to add a new data collection interface. The wizard will guide you through the configuration process.',
            position: 'left'
        }
    ],
    
    interfaceConfig: [
        {
            target: '.protocol-selection',
            title: 'Choose Protocol',
            content: 'First, select the communication protocol for your device (OPC UA, Modbus, MQTT, etc.).',
            position: 'right'
        },
        {
            target: '.connection-settings',
            title: 'Connection Settings',
            content: 'Enter the connection details for your device, such as IP address, port, and authentication credentials.',
            position: 'bottom'
        },
        {
            target: '.test-connection-btn',
            title: 'Test Connection',
            content: 'Always test your connection before saving to ensure the configuration is correct.',
            position: 'top'
        }
    ],
    
    protocolTesting: [
        {
            target: '.test-mode-selector',
            title: 'Test Modes',
            content: 'Choose between single device testing, network scanning, or batch testing multiple configurations.',
            position: 'bottom'
        },
        {
            target: '.protocol-tester',
            title: 'Protocol Tester',
            content: 'Configure your test parameters here. The tester supports all major industrial protocols.',
            position: 'right'
        },
        {
            target: '.test-results',
            title: 'Test Results',
            content: 'View detailed test results including connection status, response times, and any error messages.',
            position: 'top'
        }
    ]
};

// Guide manager for controlling multiple guides
export class GuideManager {
    constructor() {
        this.guides = new Map();
        this.currentGuide = null;
        this.userPreferences = this.loadPreferences();
    }

    registerGuide(id, steps, options = {}) {
        this.guides.set(id, { steps, options });
    }

    startGuide(id, options = {}) {
        if (this.currentGuide) {
            this.endCurrentGuide();
        }

        const guide = this.guides.get(id);
        if (!guide) {
            console.warn(`Guide not found: ${id}`);
            return false;
        }

        // Check if user has disabled this guide
        if (this.userPreferences.disabledGuides.includes(id)) {
            devLog(`Guide ${id} is disabled by user preference`);
            return false;
        }

        this.currentGuide = id;
        devLog(`Starting guide: ${id}`);
        return true;
    }

    endCurrentGuide() {
        if (this.currentGuide) {
            devLog(`Ending guide: ${this.currentGuide}`);
            this.currentGuide = null;
        }
    }

    disableGuide(id) {
        if (!this.userPreferences.disabledGuides.includes(id)) {
            this.userPreferences.disabledGuides.push(id);
            this.savePreferences();
        }
    }

    enableGuide(id) {
        const index = this.userPreferences.disabledGuides.indexOf(id);
        if (index > -1) {
            this.userPreferences.disabledGuides.splice(index, 1);
            this.savePreferences();
        }
    }

    markGuideCompleted(id) {
        if (!this.userPreferences.completedGuides.includes(id)) {
            this.userPreferences.completedGuides.push(id);
            this.savePreferences();
        }
    }

    isGuideCompleted(id) {
        return this.userPreferences.completedGuides.includes(id);
    }

    loadPreferences() {
        try {
            const saved = localStorage.getItem('user-guide-preferences');
            return saved ? JSON.parse(saved) : {
                disabledGuides: [],
                completedGuides: [],
                showOnFirstVisit: true
            };
        } catch (error) {
            console.warn('Failed to load guide preferences:', error);
            return {
                disabledGuides: [],
                completedGuides: [],
                showOnFirstVisit: true
            };
        }
    }

    savePreferences() {
        try {
            localStorage.setItem('user-guide-preferences', JSON.stringify(this.userPreferences));
        } catch (error) {
            console.warn('Failed to save guide preferences:', error);
        }
    }

    shouldShowGuide(id) {
        return !this.isGuideCompleted(id) && 
               !this.userPreferences.disabledGuides.includes(id);
    }
}

// Global guide manager instance
export const guideManager = new GuideManager();

// Register default guides
guideManager.registerGuide('dashboard', GUIDE_STEPS.dashboard);
guideManager.registerGuide('interface-config', GUIDE_STEPS.interfaceConfig);
guideManager.registerGuide('protocol-testing', GUIDE_STEPS.protocolTesting);

export default UserGuide;