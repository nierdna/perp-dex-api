'use client';

import React from 'react';

export default function LoginPage() {
    const handleLogin = () => {
        // Redirect to Manager Server Twitter Auth
        window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/twitter`;
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white">
            <div className="w-full max-w-md space-y-8 rounded-xl bg-gray-800 p-10 shadow-2xl">
                <div className="text-center">
                    <h2 className="mt-6 text-3xl font-extrabold tracking-tight">
                        Point Farming
                    </h2>
                    <p className="mt-2 text-sm text-gray-400">
                        Sign in to manage your farming strategy
                    </p>
                </div>
                <div className="mt-8 space-y-6">
                    <button
                        onClick={handleLogin}
                        className="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-500 px-4 py-3 text-sm font-medium text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                    >
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                            {/* Twitter Icon */}
                            <svg
                                className="h-5 w-5 text-blue-100 group-hover:text-white"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.84 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                            </svg>
                        </span>
                        Sign in with Twitter
                    </button>
                </div>
            </div>
        </div>
    );
}
