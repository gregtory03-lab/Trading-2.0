import { useMemo } from 'react';
import { useLiveCryptoPrices } from '@/hooks/useLiveCryptoPrices';
import { Bitcoin } from 'lucide-react';

interface TickerItem {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  logo: React.ReactNode;
}

const CryptoTicker = () => {
  const { prices } = useLiveCryptoPrices();

  const tickerData: TickerItem[] = useMemo(() => [
    {
      symbol: 'BTC',
      name: 'Bitcoin',
      price: prices['BTC']?.price || 43250.00,
      change24h: prices['BTC']?.changePercent24h || 2.45,
      logo: <Bitcoin className="h-6 w-6" />
    },
    {
      symbol: 'ETH',
      name: 'Ethereum',
      price: prices['ETH']?.price || 2850.75,
      change24h: prices['ETH']?.changePercent24h || -1.23,
      logo: (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0L1.608 6L12 12l10.392-6L12 0zM1.608 18L12 24l10.392-6L12 18l-10.392-6z"/>
          <path d="M1.608 12L12 18l10.392-6L12 6L1.608 12z"/>
        </svg>
      )
    }
  ], [prices]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  };

  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };

  const duplicatedData = [...tickerData, ...tickerData, ...tickerData];

  return (
    <div className="relative w-full overflow-hidden bg-gradient-to-r from-background/95 via-background/90 to-background/95 backdrop-blur-md border border-border/50 rounded-lg shadow-2xl">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 pointer-events-none" />
      
      <div className="relative px-4 py-3">
        <div className="flex items-center gap-1 mb-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Live Market Data</span>
        </div>
        
        <div className="overflow-hidden">
          <div className="flex animate-[scroll_60s_linear_infinite] gap-8">
            {duplicatedData.map((item, index) => (
              <div
                key={`${item.symbol}-${index}`}
                className="flex-shrink-0 flex items-center gap-4 px-6 py-3 rounded-xl bg-card/50 backdrop-blur-sm border border-border/30 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 hover:bg-card/70"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 backdrop-blur-sm border border-primary/20">
                  <div className="text-primary">
                    {item.logo}
                  </div>
                </div>
                
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{item.symbol}</span>
                    <span className="text-xs text-muted-foreground font-medium">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-foreground tabular-nums">
                      {formatPrice(item.price)}
                    </span>
                    <span className={`text-sm font-semibold px-2 py-1 rounded-md tabular-nums ${
                      item.change24h >= 0 
                        ? 'text-green-400 bg-green-500/10 border border-green-500/20' 
                        : 'text-red-400 bg-red-500/10 border border-red-500/20'
                    }`}>
                      {formatChange(item.change24h)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background to-transparent pointer-events-none z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent pointer-events-none z-10" />
    </div>
  );
};

export default CryptoTicker;