// Widget initialization script
// This will be the CDN script that clients include

import React from 'react';
import { createRoot } from 'react-dom/client';
import DepositModal from '../components/DepositModal';

interface LynxPayConfig {
    apiUrl: string;
}

class LynxPayWidget {
    private config: LynxPayConfig;
    private modalRoot: HTMLElement | null = null;
    private reactRoot: any = null;

    constructor(config: LynxPayConfig) {
        this.config = config;
        this.init();
    }

    private init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeWidgets());
        } else {
            this.initializeWidgets();
        }
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
        button.addEventListener('click', () => this.openModal(userId));

        // Replace original element
        element.replaceWith(button);
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
