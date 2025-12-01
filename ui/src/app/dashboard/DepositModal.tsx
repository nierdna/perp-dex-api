'use client';

import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

interface Wallet {
    chainKey: string;
    chainType: string;
    address: string;
    icon?: string;
    chainName?: string;
}

export default function DepositModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [loading, setLoading] = useState(false);
    const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
    const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchWallets();
        }
    }, [isOpen]);

    const fetchWallets = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/wallets/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch wallets');
            }

            const data = await response.json();
            setWallets(data);
            if (data.length > 0) {
                setSelectedWallet(data[0]);
            }
        } catch (error) {
            console.error('Error fetching wallets:', error);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (address: string) => {
        navigator.clipboard.writeText(address);
        setCopiedAddress(address);
        setTimeout(() => setCopiedAddress(null), 2000);
    };

    const getChainIcon = (wallet: Wallet) => {
        if (wallet.icon) return wallet.icon;
        const icons: Record<string, string> = {
            solana: 'https://assets.coingecko.com/coins/images/4128/standard/solana.png',
            base: 'https://assets.coingecko.com/coins/images/31199/standard/base.png',
            arbitrum: 'https://assets.coingecko.com/coins/images/16547/standard/arbitrum.png',
        };
        return icons[wallet.chainKey] || '';
    };

    const getChainName = (wallet: Wallet) => {
        if (wallet.chainName) return wallet.chainName;
        const names: Record<string, string> = {
            solana: 'Solana',
            base: 'Base',
            arbitrum: 'Arbitrum',
        };
        return names[wallet.chainKey] || wallet.chainKey;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="relative w-full max-w-md rounded-2xl bg-gray-800 p-6 shadow-2xl">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-white">Deposit Funds</h2>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 text-gray-400 hover:bg-gray-700 hover:text-white"
                    >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Chain Selection */}
                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-400">Select Network</label>
                            <div className="relative">
                                <select
                                    value={selectedWallet?.chainKey || ''}
                                    onChange={(e) => {
                                        const wallet = wallets.find((w) => w.chainKey === e.target.value);
                                        setSelectedWallet(wallet || null);
                                    }}
                                    className="w-full appearance-none rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 pl-12 text-white focus:border-blue-500 focus:outline-none"
                                >
                                    <option value="" disabled>-- Choose network --</option>
                                    {wallets.map((wallet) => (
                                        <option key={wallet.chainKey} value={wallet.chainKey}>
                                            {getChainName(wallet)}
                                        </option>
                                    ))}
                                </select>
                                {selectedWallet && (
                                    <img
                                        src={getChainIcon(selectedWallet)}
                                        alt={selectedWallet.chainKey}
                                        className="absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full"
                                    />
                                )}
                            </div>
                        </div>

                        {selectedWallet ? (
                            <div className="flex flex-col items-center space-y-6">
                                {/* QR Code */}
                                <div className="rounded-xl bg-white p-4">
                                    <QRCodeCanvas
                                        value={selectedWallet.address}
                                        size={180}
                                        imageSettings={{
                                            src: 'https://assets.coingecko.com/coins/images/6319/standard/usdc.png',
                                            height: 40,
                                            width: 40,
                                            excavate: true,
                                        }}
                                    />
                                </div>

                                {/* Address Display */}
                                <div className="w-full">
                                    <label className="mb-2 block text-sm font-medium text-gray-400">Deposit Address</label>
                                    <div className="flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-900 p-2">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-800">
                                            <img
                                                src={getChainIcon(selectedWallet)}
                                                alt={selectedWallet.chainKey}
                                                className="h-6 w-6 rounded-full"
                                            />
                                        </div>
                                        <input
                                            type="text"
                                            value={selectedWallet.address}
                                            readOnly
                                            className="flex-1 bg-transparent px-2 text-sm text-white focus:outline-none"
                                        />
                                        <button
                                            onClick={() => copyToClipboard(selectedWallet.address)}
                                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                                        >
                                            {copiedAddress === selectedWallet.address ? 'Copied!' : 'Copy'}
                                        </button>
                                    </div>
                                    <p className="mt-2 text-center text-xs text-gray-500">
                                        USDC/USDT are both accepted. Only send USDT or USDC to this address on {getChainName(selectedWallet)} network.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-xl bg-gray-900 p-8 text-center text-gray-400">
                                Please select a network to view deposit address
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
