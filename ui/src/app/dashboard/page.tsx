'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DepositModal from './DepositModal';

interface UserInfo {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    balance?: string;
}

export default function DashboardPage() {
    const router = useRouter();
    const [isFarming, setIsFarming] = useState(false);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('accessToken');
        if (!token) {
            router.push('/login');
            return;
        }

        // Fetch user info
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        })
            .then(res => res.json())
            .then(data => setUserInfo(data))
            .catch(err => {
                console.error('Failed to fetch user info:', err);
                // Token might be invalid, redirect to login
                localStorage.removeItem('accessToken');
                router.push('/login');
            });
    }, [router]);

    const handleLogout = () => {
        localStorage.removeItem('accessToken');
        router.push('/login');
    };

    const toggleFarming = () => {
        setIsFarming(!isFarming);
        // TODO: Call API to start/stop farming
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            {/* Header */}
            <header className="border-b border-gray-800 bg-gray-800/50 backdrop-blur-sm">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
                    <h1 className="text-2xl font-bold text-blue-500">Point Farming</h1>
                    <div className="flex items-center gap-4">
                        {userInfo?.avatarUrl && (
                            <img
                                src={userInfo.avatarUrl}
                                alt={userInfo.username}
                                className="h-8 w-8 rounded-full"
                            />
                        )}
                        <span className="text-sm text-gray-400">
                            {userInfo ? `@${userInfo.username}` : 'Loading...'}
                        </span>
                        <button
                            onClick={handleLogout}
                            className="rounded-md bg-gray-700 px-3 py-2 text-sm font-medium text-white hover:bg-gray-600"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl bg-gray-800 p-6 shadow-lg">
                        <p className="text-sm font-medium text-gray-400">Total Volume</p>
                        <p className="mt-2 text-3xl font-bold text-white">$1,234,567</p>
                    </div>
                    <div className="rounded-xl bg-gray-800 p-6 shadow-lg">
                        <p className="text-sm font-medium text-gray-400">Current Balance</p>
                        <p className="mt-2 text-3xl font-bold text-white">
                            ${userInfo?.balance ? parseFloat(userInfo.balance).toFixed(2) : '0.00'}
                        </p>
                    </div>
                    <div className="rounded-xl bg-gray-800 p-6 shadow-lg">
                        <p className="text-sm font-medium text-gray-400">Active Orders</p>
                        <p className="mt-2 text-3xl font-bold text-white">2</p>
                    </div>
                    <div className="rounded-xl bg-gray-800 p-6 shadow-lg">
                        <p className="text-sm font-medium text-gray-400">Status</p>
                        <div className="mt-2 flex items-center gap-2">
                            <span
                                className={`h-3 w-3 rounded-full ${isFarming ? 'bg-green-500' : 'bg-red-500'
                                    }`}
                            ></span>
                            <span className="text-lg font-bold text-white">
                                {isFarming ? 'Running' : 'Stopped'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="mt-8 flex gap-4">
                    <button
                        onClick={toggleFarming}
                        className={`rounded-lg px-6 py-3 text-lg font-bold text-white transition-colors ${isFarming
                                ? 'bg-red-500 hover:bg-red-600'
                                : 'bg-green-500 hover:bg-green-600'
                            }`}
                    >
                        {isFarming ? 'Stop Farming' : 'Start Farming'}
                    </button>
                    <button
                        onClick={() => setIsDepositModalOpen(true)}
                        className="rounded-lg bg-blue-500 px-6 py-3 text-lg font-bold text-white transition-colors hover:bg-blue-600"
                    >
                        💰 Deposit
                    </button>
                </div>

                {/* Recent Activity */}
                <div className="mt-8 rounded-xl bg-gray-800 shadow-lg">
                    <div className="border-b border-gray-700 px-6 py-4">
                        <h3 className="text-lg font-medium text-white">Recent Activity</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-400">
                            <thead className="bg-gray-700/50 text-xs uppercase text-gray-300">
                                <tr>
                                    <th className="px-6 py-3">Time</th>
                                    <th className="px-6 py-3">Pair</th>
                                    <th className="px-6 py-3">Side</th>
                                    <th className="px-6 py-3">Size</th>
                                    <th className="px-6 py-3">Price</th>
                                    <th className="px-6 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {/* Mock Data */}
                                {[1, 2, 3].map((i) => (
                                    <tr key={i} className="hover:bg-gray-700/30">
                                        <td className="px-6 py-4">2023-10-27 10:30:{i}0</td>
                                        <td className="px-6 py-4">ETH-USD</td>
                                        <td className="px-6 py-4">
                                            <span className="text-green-400">Long</span>
                                        </td>
                                        <td className="px-6 py-4">1.5 ETH</td>
                                        <td className="px-6 py-4">$1,850.00</td>
                                        <td className="px-6 py-4">
                                            <span className="rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-green-400">
                                                Filled
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* Deposit Modal */}
            <DepositModal isOpen={isDepositModalOpen} onClose={() => setIsDepositModalOpen(false)} />
        </div>
    );
}
