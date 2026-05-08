import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

interface WalletState {
  isConnected: boolean;
  address: string | null;
  balance: string | null;
  provider: ethers.BrowserProvider | null;
}

export const useWallet = () => {
  const [wallet, setWallet] = useState<WalletState>({
    isConnected: false,
    address: null,
    balance: null,
    provider: null,
  });
  const [isConnecting, setIsConnecting] = useState(false);

  // Check if wallet is already connected on mount
  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        
        if (accounts.length > 0) {
          const address = accounts[0].address;
          const balance = await provider.getBalance(address);
          
          setWallet({
            isConnected: true,
            address,
            balance: ethers.formatEther(balance),
            provider,
          });
        }
      } catch (error) {
        console.error('Error checking wallet connection:', error);
      }
    }
  };

  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      throw new Error('TrustWallet or MetaMask not installed');
    }

    setIsConnecting(true);
    try {
      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const balance = await provider.getBalance(address);

      setWallet({
        isConnected: true,
        address,
        balance: ethers.formatEther(balance),
        provider,
      });

      return { success: true };
    } catch (error: any) {
      console.error('Failed to connect wallet:', error);
      throw new Error(error.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setWallet({
      isConnected: false,
      address: null,
      balance: null,
      provider: null,
    });
  };

  const getETHBalance = async (): Promise<string> => {
    if (!wallet.provider || !wallet.address) {
      throw new Error('Wallet not connected');
    }

    const balance = await wallet.provider.getBalance(wallet.address);
    return ethers.formatEther(balance);
  };

  return {
    wallet,
    isConnecting,
    connectWallet,
    disconnectWallet,
    getETHBalance,
    checkConnection,
  };
};

// Extend window interface for TypeScript
declare global {
  interface Window {
    ethereum?: any;
  }
}