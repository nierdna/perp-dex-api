import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['lib/widget.tsx'],
    format: ['iife'], // Immediately Invoked Function Expression for browser script
    globalName: 'LynxPay', // Global variable name
    minify: true,
    clean: true,
    dts: false,
    splitting: false,
    sourcemap: true,
    target: 'es2020',
    injectStyle: true, // Inject CSS directly into JS
    loader: {
        '.css': 'css',
    },
    noExternal: ['react', 'react-dom', 'qrcode.react'], // Bundle dependencies
});
