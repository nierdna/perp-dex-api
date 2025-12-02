'use client';

import { useEffect } from 'react';
// import '../lib/widget'; // REMOVED: Test bundle instead

export default function DemoPage() {
  useEffect(() => {
    // Initialize LynxPay widget
    // Wait for script to load
    const checkAndInit = () => {
      if (typeof window !== 'undefined' && (window as any).LynxPay) {
        (window as any).LynxPay.init({
          apiUrl: 'http://localhost:1999', // wallet-server URL
        });
      } else {
        setTimeout(checkAndInit, 100);
      }
    };
    checkAndInit();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <script src="/widget.global.js"></script>
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-[10px] opacity-50">
          <div className="absolute top-1/4 left-1/4 h-96 w-96 animate-pulse rounded-full bg-purple-500/30 blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 h-96 w-96 animate-pulse rounded-full bg-blue-500/30 blur-3xl"></div>
        </div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-purple-500/10 px-4 py-2 backdrop-blur-sm">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex h-3 w-3 rounded-full bg-purple-500"></span>
            </span>
            <span className="text-sm font-medium text-purple-300">Now Live</span>
          </div>

          <h1 className="mb-4 bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-6xl font-bold text-transparent sm:text-7xl">
            LynxPay Widget
          </h1>
          <p className="mx-auto max-w-2xl text-xl text-gray-300">
            Embeddable deposit widget for any website. Beautiful, fast, and easy to integrate.
          </p>
        </div>

        {/* Demo Cards */}
        <div className="mb-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Example 1 */}
          <div className="group relative overflow-hidden rounded-2xl bg-white/5 p-6 backdrop-blur-lg transition-all hover:bg-white/10 hover:shadow-2xl hover:shadow-purple-500/20">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
            <div className="relative">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
                  <span className="text-2xl">💰</span>
                </div>
                <h3 className="text-lg font-bold text-white">Simple Button</h3>
              </div>
              <p className="mb-4 text-sm text-gray-400">
                Just add an element with <code className="rounded bg-purple-500/20 px-2 py-1 text-xs text-purple-300">id=&quot;lynxpay-userId&quot;</code>
              </p>
              <div className="rounded-lg bg-slate-800/50 p-4">
                <div id="lynxpay-user_123456">💰 Deposit Funds</div>
              </div>
            </div>
          </div>

          {/* Example 2 */}
          <div className="group relative overflow-hidden rounded-2xl bg-white/5 p-6 backdrop-blur-lg transition-all hover:bg-white/10 hover:shadow-2xl hover:shadow-blue-500/20">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
            <div className="relative">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
                  <span className="text-2xl">✨</span>
                </div>
                <h3 className="text-lg font-bold text-white">Custom Text</h3>
              </div>
              <p className="mb-4 text-sm text-gray-400">
                The widget preserves your custom text
              </p>
              <div className="rounded-lg bg-slate-800/50 p-4">
                <div id="lynxpay-user_123456">Add Funds to Wallet</div>
              </div>
            </div>
          </div>

          {/* Example 3 */}
          <div className="group relative overflow-hidden rounded-2xl bg-white/5 p-6 backdrop-blur-lg transition-all hover:bg-white/10 hover:shadow-2xl hover:shadow-pink-500/20">
            <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
            <div className="relative">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-500/20">
                  <span className="text-2xl">👤</span>
                </div>
                <h3 className="text-lg font-bold text-white">Different User</h3>
              </div>
              <p className="mb-4 text-sm text-gray-400">
                Each button can have a different user ID
              </p>
              <div className="rounded-lg bg-slate-800/50 p-4">
                <div id="lynxpay-user_123456">Top Up Balance</div>
              </div>
            </div>
          </div>

          {/* Example 4 */}
          <div className="group relative overflow-hidden rounded-2xl bg-white/5 p-6 backdrop-blur-lg transition-all hover:bg-white/10 hover:shadow-2xl hover:shadow-green-500/20">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
            <div className="relative">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20">
                  <span className="text-2xl">⚡</span>
                </div>
                <h3 className="text-lg font-bold text-white">Minimal</h3>
              </div>
              <p className="mb-4 text-sm text-gray-400">
                Works with minimal markup
              </p>
              <div className="rounded-lg bg-slate-800/50 p-4">
                <div id="lynxpay-user_123456">Deposit</div>
              </div>
            </div>
          </div>
        </div>

        {/* Integration Guide */}
        <div className="mb-16 overflow-hidden rounded-2xl bg-white/5 backdrop-blur-lg">
          <div className="border-b border-white/10 bg-gradient-to-r from-purple-500/10 to-blue-500/10 p-6">
            <h2 className="text-3xl font-bold text-white">
              🚀 Quick Integration
            </h2>
            <p className="mt-2 text-gray-300">
              Get started in less than 2 minutes
            </p>
          </div>

          <div className="p-6">
            <div className="space-y-6">
              {/* Step 1 */}
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-500 text-sm font-bold text-white">
                  1
                </div>
                <div className="flex-1">
                  <h3 className="mb-2 text-lg font-semibold text-white">
                    Add the script to your website
                  </h3>
                  <div className="overflow-x-auto rounded-lg bg-slate-900 p-4">
                    <pre className="text-sm text-green-400">
                      {`<script src="https://cdn.lynxpay.com/widget.js"></script>
<script>
  LynxPay.init({
    apiUrl: 'https://api.lynxpay.com'
  });
</script>`}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-white">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="mb-2 text-lg font-semibold text-white">
                    Add deposit buttons anywhere
                  </h3>
                  <div className="overflow-x-auto rounded-lg bg-slate-900 p-4">
                    <pre className="text-sm text-green-400">
                      {`<div id="lynxpay-user_123456">Deposit Funds</div>`}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500 text-sm font-bold text-white">
                  3
                </div>
                <div className="flex-1">
                  <h3 className="mb-2 text-lg font-semibold text-white">
                    That&apos;s it! 🎉
                  </h3>
                  <p className="text-gray-400">
                    The widget will automatically transform your elements into beautiful deposit buttons with modals.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mb-16 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl bg-white/5 p-6 backdrop-blur-lg">
            <div className="mb-4 text-4xl">🎨</div>
            <h3 className="mb-2 text-xl font-bold text-white">Beautiful UI</h3>
            <p className="text-gray-400">
              Modern, responsive design that works on any device
            </p>
          </div>

          <div className="rounded-2xl bg-white/5 p-6 backdrop-blur-lg">
            <div className="mb-4 text-4xl">⚡</div>
            <h3 className="mb-2 text-xl font-bold text-white">Lightning Fast</h3>
            <p className="text-gray-400">
              Optimized bundle size and lazy loading for best performance
            </p>
          </div>

          <div className="rounded-2xl bg-white/5 p-6 backdrop-blur-lg">
            <div className="mb-4 text-4xl">🔒</div>
            <h3 className="mb-2 text-xl font-bold text-white">Secure</h3>
            <p className="text-gray-400">
              Built with security best practices and regular audits
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-6 py-3 backdrop-blur-lg">
            <span className="text-gray-400">Powered by</span>
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text font-bold text-transparent">
              LYNX Pay
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
