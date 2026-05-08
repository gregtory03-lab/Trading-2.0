import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

export interface CryptoPrice {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
}

export const useLiveCryptoPrices = (symbols: string[] = ['bitcoin', 'ethereum', 'litecoin', 'cardano']) => {
  const [prices, setPrices] = useState<Record<string, CryptoPrice>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const symbolsKey = useMemo(() => symbols.join(','), [symbols]);

  const fetchPrices = useCallback(async () => {
    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${symbolsKey}&vs_currencies=usd&include_24hr_change=true`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch crypto prices');
      }
      
      const data = await response.json();
      
      const formattedPrices: Record<string, CryptoPrice> = {};
      
      Object.entries(data).forEach(([key, value]: [string, any]) => {
        const symbol = key === 'bitcoin' ? 'BTC' : 
                     key === 'ethereum' ? 'ETH' : 
                     key === 'litecoin' ? 'LTC' : 
                     key === 'cardano' ? 'ADA' : 
                     key.toUpperCase();
        
        formattedPrices[symbol] = {
          symbol,
          price: value.usd,
          change24h: value.usd_24h_change || 0,
          changePercent24h: value.usd_24h_change || 0
        };
      });
      
      setPrices(formattedPrices);
      setError(null);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch prices');
      setIsLoading(false);
    }
  }, [symbolsKey]);

  useEffect(() => {
    fetchPrices();
    
    intervalRef.current = setInterval(fetchPrices, 30000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchPrices]);

  const getCurrentPrice = useCallback((symbol: string): number => {
    // Stablecoins are always ~$1
    if (symbol === 'USDC' || symbol === 'USDT') return 1;
    return prices[symbol]?.price || 0;
  }, [prices]);

  const getPriceChange = useCallback((symbol: string): number => {
    return prices[symbol]?.changePercent24h || 0;
  }, [prices]);

  return {
    prices,
    isLoading,
    error,
    getCurrentPrice,
    getPriceChange,
    refetch: fetchPrices
  };
};