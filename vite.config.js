import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [
        laravel({
            input: 'resources/js/app.jsx',
            refresh: true,
        }),
        react(),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './resources/js'),
        },
    },
    build: {
        // Production optimizations
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: true, // Remove console.log in production
                drop_debugger: true,
            },
        },
        rollupOptions: {
            output: {
                manualChunks: {
                    // Code splitting for better caching
                    'react-vendor': ['react', 'react-dom'],
                    'chart-vendor': ['chart.js', 'react-chartjs-2'],
                    'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
                    'ui-vendor': ['lucide-react', 'clsx', 'react-hot-toast', 'react-datepicker'],
                },
            },
        },
        chunkSizeWarningLimit: 1000,
        sourcemap: false, // Disable source maps in production for security
    },
    server: {
        host: '0.0.0.0',
        port: 5175,
        cors: true,
        hmr: {
            host: 'localhost',
        },
    },
});
