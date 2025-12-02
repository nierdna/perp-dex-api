import React from 'react';
import { createRoot } from 'react-dom/client';
import DepositModal from '../components/DepositModal';
import './widget.generated.css'; // Import generated Tailwind CSS

console.log('🚀 [LynxPay] Widget script loaded!');

interface LynxPayConfig {
    apiUrl: string;
}

class LynxPayWidget {
    private config: LynxPayConfig;
    private modalRoot: HTMLElement | null = null;
    private reactRoot: any = null;
    private static isInitialized = false;

    constructor(config: LynxPayConfig) {
        this.config = config;
        this.init();
    }

    private init() {
        if (LynxPayWidget.isInitialized) {
            // If already initialized, just run a scan immediately to catch new elements
            this.initializeWidgets();
            return;
        }
        LynxPayWidget.isInitialized = true;

        // Initial scan
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeWidgets());
        } else {
            this.initializeWidgets();
        }

        // Watch for dynamic changes (React/Next.js hydration)
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node instanceof HTMLElement) {
                        // Check the node itself
                        if (node.id && node.id.startsWith('lynxpay-')) {
                            const userId = node.id.replace('lynxpay-', '');
                            this.convertToButton(node, userId);
                        }
                        // Check children
                        const elements = node.querySelectorAll('[id^="lynxpay-"]');
                        elements.forEach((element) => {
                            const userId = element.id.replace('lynxpay-', '');
                            if (userId) {
                                this.convertToButton(element as HTMLElement, userId);
                            }
                        });
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    private initializeWidgets() {
        // Find all elements with id starting with "lynxpay-"
        const elements = document.querySelectorAll('[id^="lynxpay-"]');

        elements.forEach((element) => {
            const userId = element.id.replace('lynxpay-', '');
            if (userId) {
                this.convertToButton(element as HTMLElement, userId);
            }
        });
    }

    private convertToButton(element: HTMLElement, userId: string) {
        // Check if already processed
        if (element.getAttribute('data-lynxpay-processed')) {
            return;
        }

        // Mark as processed
        element.setAttribute('data-lynxpay-processed', 'true');

        // Create button
        const button = document.createElement('button');
        button.textContent = element.textContent || 'Deposit';
        button.className = 'lynxpay-deposit-btn';
        button.style.cssText = `
      padding: 12px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      font-size: 14px;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

        // Hover effects
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'translateY(-2px)';
            button.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
        });

        button.addEventListener('mouseleave', () => {
            button.style.transform = 'translateY(0)';
            button.style.boxShadow = 'none';
        });

        // Click handler
        button.addEventListener('click', (e) => {
            console.log('🔘 [LynxPay] Button clicked for user:', userId);
            e.preventDefault();
            e.stopPropagation(); // Prevent bubbling issues
            this.openModal(userId);
        });

        // Clear content and append button instead of replacing
        element.innerHTML = '';
        element.appendChild(button);
        console.log('✅ [LynxPay] Converted element to button for user:', userId);

        // Ensure container has no conflicting styles
        element.style.display = 'inline-block';
        element.style.padding = '0';
        element.style.border = 'none';
        element.style.background = 'transparent';
    }

    private openModal(userId: string) {
        // Create modal container if not exists
        if (!this.modalRoot) {
            this.modalRoot = document.createElement('div');
            this.modalRoot.id = 'lynxpay-modal-root';
            document.body.appendChild(this.modalRoot);
        }

        // Render modal
        if (!this.reactRoot) {
            this.reactRoot = createRoot(this.modalRoot);
        }

        this.reactRoot.render(
            React.createElement(DepositModal, {
                isOpen: true,
                onClose: () => this.closeModal(),
                userId: userId,
                apiUrl: this.config.apiUrl,
            })
        );
    }

    private closeModal() {
        if (this.reactRoot && this.modalRoot) {
            this.reactRoot.render(
                React.createElement(DepositModal, {
                    isOpen: false,
                    onClose: () => { },
                    userId: '',
                    apiUrl: this.config.apiUrl,
                })
            );
        }
    }
}

// Export for direct usage if needed
export default LynxPayWidget;

// Auto-initialize if loaded via script tag
if (typeof window !== 'undefined') {
    // Expose to window
    (window as any).LynxPay = {
        init: (config: LynxPayConfig) => {
            new LynxPayWidget(config);
        },
    };
}
