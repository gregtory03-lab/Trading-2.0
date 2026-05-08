import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Copy, Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLiveCryptoPrices } from '@/hooks/useLiveCryptoPrices';
import { usePlatformSetting } from '@/hooks/usePlatformSetting';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';

const FALLBACK_WALLET_ADDRESSES: Record<string, string> = {
  BTC: 'bc1q56qxqrchf20qra4a0962fg7fqm54rvp9r7xhrl',
  ETH: '0xc2930d27a31cB1C25Cd6Bd96F858f0190CFdA5cB',
  USDT: '0xc2930d27a31cB1C25Cd6Bd96F858f0190CFdA5cB',
  USDC: '0xc2930d27a31cB1C25Cd6Bd96F858f0190CFdA5cB',
};

const WALLET_SETTING_KEYS: Record<string, string> = {
  BTC: 'wallet_address_btc',
  ETH: 'wallet_address_eth',
  USDT: 'wallet_address_usdt',
  USDC: 'wallet_address_usdc',
};

const DepositInfo = ({ coin }: { coin: string }) => {
  const [showAddress, setShowAddress] = useState(false);
  const [copied, setCopied] = useState(false);
  const fallback = FALLBACK_WALLET_ADDRESSES[coin] || FALLBACK_WALLET_ADDRESSES['ETH'];
  const settingKey = WALLET_SETTING_KEYS[coin] || WALLET_SETTING_KEYS['ETH'];
  const { value: addressRaw } = usePlatformSetting<string>(settingKey, fallback);
  const address = (typeof addressRaw === 'string' && addressRaw.trim()) ? addressRaw : fallback;

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!showAddress) {
    return (
      <Button size="sm" variant="default" className="w-full text-xs" onClick={() => setShowAddress(true)}>
        Deposit {coin}
      </Button>
    );
  }

  return (
    <div className="p-2 rounded-md bg-muted/50 border border-border space-y-1">
      <p className="text-xs font-medium text-center">Send {coin} to this address:</p>
      <div className="flex items-center gap-1">
        <code className="text-[10px] break-all flex-1 bg-background p-1.5 rounded border border-border">
          {address}
        </code>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={copyAddress}>
          {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
      <div className="flex justify-center pt-1">
        <div className="bg-white p-1.5 rounded">
          <QRCodeSVG value={address} size={96} level="M" includeMargin={false} />
        </div>
      </div>
      {(coin === 'USDT' || coin === 'USDC') && (
        <p className="text-[10px] text-muted-foreground text-center">Network: ERC-20 (Ethereum)</p>
      )}
    </div>
  );
};

const OrderBook = ({ onPriceUpdate, sessionActive, lotSize, sessionStartTime }: { onPriceUpdate: (price: number) => void; sessionActive: boolean; lotSize?: number; sessionStartTime?: number | null }) => {
  const { language, translations } = useLanguage();
  const t = (key: string) => translations[language]?.[key] || key;
  
  const [currentPrice, setCurrentPrice] = useState(() => {
    // Generate random starting price between 950 and 1100
    return 950 + Math.random() * 150;
  });
  const [buyOrders, setBuyOrders] = useState([
    [1001.94, 2.42, 2424.69],
    [999.2, 0.8, 799.36],
    [996.21, 2.77, 2759.50],
    [993.85, 2.56, 2544.26],
    [992.7, 0.09, 89.34],
    [992.54, 2.4, 2382.10],
    [992.43, 0.78, 774.10],
    [989.31, 2.78, 2750.28],
    [988.51, 1.98, 1957.25],
    [987.86, 0.38, 375.39],
  ]);

  const [sellOrders, setSellOrders] = useState([
    [1003.33, 1.3, 1304.33],
    [1003.45, 1.71, 1715.90],
    [1003.74, 0.41, 411.53],
    [1004.14, 0.81, 813.35],
    [1006.25, 0.22, 221.38],
    [1008.47, 0.23, 231.95],
    [1010.4, 1.14, 1151.86],
    [1010.81, 1.31, 1324.16],
    [1011.16, 2.09, 2113.32],
    [1014.08, 1.41, 1429.85],
  ]);

  // Calculate dynamic spread based on order book
  const spread = sellOrders.length > 0 && buyOrders.length > 0 
    ? sellOrders[0][0] - buyOrders[0][0] // Lowest sell price - Highest buy price
    : 10.82; // Fallback value

  // Continuous price updates - always runs at 1s interval
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPrice(prev => {
        const profitableLots = [10, 15, 20, 25, 30];
        if (sessionActive && profitableLots.includes(lotSize!) && sessionStartTime) {
          const elapsedTime = Date.now() - sessionStartTime;

          // Special behavior for lot size 10: oscillate (rise & fall) for 3 minutes,
          // with the rise concentrated toward the end of the 3-minute window.
          if (lotSize === 10) {
            const durationMs = 180000;
            const targetPrice = 3000;
            const startPrice = 1000;
            // Once 3 minutes have passed, lock to target so it stays at 3000
            if (elapsedTime >= durationMs) {
              const change = (Math.random() - 0.5) * 6;
              const newPrice = Math.max(targetPrice - 20, Math.min(targetPrice + 20, prev + change));
              const finalPrice = Math.abs(newPrice - targetPrice) < 1 ? targetPrice : newPrice;
              onPriceUpdate(finalPrice);
              return finalPrice;
            }
            const progress = elapsedTime / durationMs;
            // Back-loaded easing: small gains early, big rise near the end
            const eased = Math.pow(progress, 3);
            const baseline = startPrice + (targetPrice - startPrice) * eased;
            // Oscillation amplitude shrinks as we approach the end so the final rise dominates
            const oscAmplitude = 60 * (1 - progress);
            const oscillation = Math.sin(elapsedTime / 8000) * oscAmplitude + (Math.random() - 0.5) * 20;
            const expectedPrice = baseline + oscillation;
            const drift = (expectedPrice - prev) * 0.25;
            const newPrice = Math.max(startPrice - 50, Math.min(targetPrice, prev + drift));
            onPriceUpdate(newPrice);
            return newPrice;
          }

          // Lot 30: oscillate (rise & fall) with rise weighted toward target 3000
          if (lotSize === 30) {
            const durationMs = 180000;
            const targetPrice = 3000;
            const startPrice = 1000;
            if (elapsedTime >= durationMs) {
              const change = (Math.random() - 0.5) * 8;
              const newPrice = Math.max(targetPrice - 25, Math.min(targetPrice + 25, prev + change));
              const finalPrice = Math.abs(newPrice - targetPrice) < 1 ? targetPrice : newPrice;
              onPriceUpdate(finalPrice);
              return finalPrice;
            }
            const progress = elapsedTime / durationMs;
            const eased = Math.pow(progress, 2.2);
            const baseline = startPrice + (targetPrice - startPrice) * eased;
            const oscAmplitude = 80 * (1 - progress * 0.7);
            const oscillation = Math.sin(elapsedTime / 7000) * oscAmplitude + (Math.random() - 0.5) * 25;
            const expectedPrice = baseline + oscillation;
            const drift = (expectedPrice - prev) * 0.22;
            const newPrice = Math.max(startPrice - 50, Math.min(targetPrice, prev + drift));
            onPriceUpdate(newPrice);
            return newPrice;
          }

          let targetPrice = 3000;
          let durationMs = 180000;
          if (lotSize === 15) { targetPrice = 3000; durationMs = 240000; }
          else if (lotSize === 20) { targetPrice = 3000; durationMs = 300000; }
          else if (lotSize === 25) { targetPrice = 2500; durationMs = 180000; }

          const progress = Math.min(1, elapsedTime / durationMs);

          if (prev < targetPrice) {
            const expectedPrice = 1000 + (targetPrice - 1000) * progress;
            const drift = (expectedPrice - prev) * 0.15 + (Math.random() - 0.3) * 5;
            const newPrice = Math.min(targetPrice, prev + Math.max(drift, 0.5));
            onPriceUpdate(newPrice);
            return newPrice;
          } else {
            const change = (Math.random() - 0.5) * 10;
            const newPrice = Math.max(targetPrice - 50, Math.min(targetPrice + 50, prev + change));
            onPriceUpdate(newPrice);
            return newPrice;
          }
        }
        else if (sessionActive && lotSize && !profitableLots.includes(lotSize) && sessionStartTime) {
          const dropAmount = Math.random() * 8 + 2;
          const newPrice = Math.max(500, prev - dropAmount);
          onPriceUpdate(newPrice);
          return newPrice;
        } else {
          // Normal continuous price fluctuation even without session
          const change = (Math.random() - 0.5) * 4;
          const newPrice = prev + change;
          const finalPrice = Math.max(900, Math.min(1500, newPrice));
          onPriceUpdate(finalPrice);
          return finalPrice;
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onPriceUpdate, sessionActive, lotSize, sessionStartTime]);

  // Continuous order book updates - always runs at 1.5s interval
  useEffect(() => {
    const interval = setInterval(() => {
      setBuyOrders(prevOrders => 
        prevOrders.map(([price, amount]) => {
          const newPrice = price + (Math.random() - 0.5) * 0.8;
          const newAmount = Math.max(0.01, amount + (Math.random() - 0.5) * 0.3);
          const total = newPrice * newAmount;
          return [parseFloat(newPrice.toFixed(2)), parseFloat(newAmount.toFixed(2)), parseFloat(total.toFixed(2))];
        })
      );

      setSellOrders(prevOrders => 
        prevOrders.map(([price, amount]) => {
          const newPrice = price + (Math.random() - 0.5) * 0.8;
          const newAmount = Math.max(0.01, amount + (Math.random() - 0.5) * 0.3);
          const total = newPrice * newAmount;
          return [parseFloat(newPrice.toFixed(2)), parseFloat(newAmount.toFixed(2)), parseFloat(total.toFixed(2))];
        })
      );
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="mb-4">
      <CardHeader className="px-2 py-2 sm:p-3">
        <CardTitle className="text-base sm:text-lg">{t('orderBook')}</CardTitle>
        <p className="text-center text-primary font-bold text-sm sm:text-base">{t('currentPrice')}: {currentPrice.toFixed(2)}</p>
      </CardHeader>
      <CardContent className="px-2 py-2 sm:p-3">
        <div className="grid grid-cols-3 gap-1 sm:gap-2 text-[10px] sm:text-xs font-medium mb-2">
          <div className="text-muted-foreground">{t('price')}</div>
          <div className="text-muted-foreground text-right">{t('amount')}</div>
          <div className="text-muted-foreground text-right">{t('total')}</div>
        </div>
        
        {/* Buy Orders */}
        <div className="space-y-0.5 sm:space-y-1 mb-3">
          {buyOrders.map(([price, amount, total], i) => (
            <div key={`buy-${i}`} className="grid grid-cols-3 gap-1 sm:gap-2 text-[10px] sm:text-xs">
              <div className="text-green-500 font-mono truncate">{price}</div>
              <div className="text-muted-foreground font-mono text-right">{amount}</div>
              <div className="text-muted-foreground font-mono text-right">{total}</div>
            </div>
          ))}
        </div>

        {/* Separator */}
        <div className="border-t border-border my-2 sm:my-3"></div>

        {/* Sell Orders */}
        <div className="space-y-0.5 sm:space-y-1 mb-3">
          {sellOrders.map(([price, amount, total], i) => (
            <div key={`sell-${i}`} className="grid grid-cols-3 gap-1 sm:gap-2 text-[10px] sm:text-xs">
              <div className="text-red-500 font-mono truncate">{price}</div>
              <div className="text-muted-foreground font-mono text-right">{amount}</div>
              <div className="text-muted-foreground font-mono text-right">{total}</div>
            </div>
          ))}
        </div>
        
        {/* Spread */}
        <div className="text-center text-xs sm:text-sm text-muted-foreground">
          {t('spread')}: {spread.toFixed(2)}
        </div>
      </CardContent>
    </Card>
  );
};

const TradingForm = ({ balance, coin, currentPrice, onSessionStart, onBalanceUpdate, realPrice }: { balance: number; coin: string; currentPrice: number; onSessionStart: (active: boolean, lotSize?: number, startTime?: number) => void; onBalanceUpdate: (newBalance: number) => void; realPrice: number }) => {
  const { language, translations } = useLanguage();
  const t = (key: string) => translations[language]?.[key] || key;
  
  const [lots, setLots] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [entryPrice, setEntryPrice] = useState('-');
  const [exitPrice, setExitPrice] = useState('-');
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionStopped, setSessionStopped] = useState(false);
  const [profit, setProfit] = useState(0);
  const [showPL, setShowPL] = useState(false);
  const [grandTotal, setGrandTotal] = useState(0);
  const [selectedAction, setSelectedAction] = useState<'buy' | 'sell' | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [showMinWarning, setShowMinWarning] = useState(false);

  // Configurable minimum balance required to trade (USD), set in admin panel
  const { value: minTradingUsdRaw } = usePlatformSetting<number | string>('min_trading_balance_usd', 500);
  const minTradingUsd = Number(minTradingUsdRaw) || 500;

  const getMinimumBalance = () => {
    if (realPrice <= 0) return 0;
    return minTradingUsd / realPrice;
  };

  // Calculate profit based on entry, exit, and lot size
  const calculateProfit = (entry: number, exit: number, lotSize: number) => {
    const priceDifference = exit - entry;
    const totalProfit = priceDifference * lotSize;
    return totalProfit;
  };

  // Convert coin balance to USDT using real exchange rate
  const getBalanceInUSDT = () => {
    // If wallet balance is 0, available balance should also be 0
    if (balance === 0) return 0;
    const availableBalance = getAvailableBalance();
    return availableBalance * realPrice; // Use real crypto price and available balance
  };

  // Get available balance for trading (0 if below minimum)
  const getAvailableBalance = () => {
    const minBalance = getMinimumBalance();
    if (balance < minBalance) return 0;
    return balance;
  };

  const startSession = () => {
    // Input validation for security
    const lotSizeNum = parseFloat(lots);
    const stopLossNum = parseFloat(stopLoss);
    
    // Check if Buy or Sell is clicked
    if (!selectedAction) {
      alert('Please select Buy or Sell first');
      return;
    }
    
    // Check if lot size is filled in
    if (!lots || isNaN(lotSizeNum) || lotSizeNum <= 0 || lotSizeNum > 1000) {
      alert('Please enter a valid lot size (1-1000)');
      return;
    }
    
    // Check minimum balance requirements
    const minBalance = getMinimumBalance();
    if (balance < minBalance) {
      setShowMinWarning(true);
      const balanceUsd = (balance * realPrice).toFixed(2);
      toast.error(
        t('minBalanceToast').replace('{amount}', String(minTradingUsd)),
        {
          description: t('minBalanceToastDesc')
            .replace('{coin}', coin)
            .replace('{balance}', balanceUsd),
        }
      );
      return;
    }
    setShowMinWarning(false);
    
    if (!stopLoss || isNaN(stopLossNum) || stopLossNum <= 0 || stopLossNum > 10000) {
      alert('Please enter a valid stop loss target (1-10000)');
      return;
    }

    if (lots && stopLoss && selectedAction && balance > 0) {
      const sessionEntryPrice = currentPrice.toFixed(2);
      setEntryPrice(sessionEntryPrice);
      setExitPrice(stopLoss);
      setSessionActive(true);
      setShowPL(false);
      setSessionStopped(false);
      setSessionStartTime(Date.now()); // Record session start time
      
      // Special behavior for lot size 10 - price rises to 1500 then falls
      if (lotSizeNum === 10) {
        // Will be handled in OrderBook component
      }
      
      // Notify parent component about session start with timestamp
      onSessionStart(true, lotSizeNum, sessionStartTime);
      
      // Calculate profit with the entered values for preview
      const calculatedProfit = calculateProfit(parseFloat(sessionEntryPrice), parseFloat(stopLoss), parseFloat(lots));
      setProfit(calculatedProfit);
      
      // Grand total = profit preview + available balance (in USDT form)
      const balanceInUSDT = getBalanceInUSDT();
      setGrandTotal(calculatedProfit + balanceInUSDT);
    }
  };

  const stopSession = () => {
    // Stop session - exit price is current price when session is stopped
    const sessionExitPrice = currentPrice;
    setExitPrice(sessionExitPrice.toFixed(2));
    
    // Calculate profit: (Exit Price - Entry Price) × Lot Size
    const calculatedProfit = calculateProfit(parseFloat(entryPrice), sessionExitPrice, parseFloat(lots));
    setProfit(calculatedProfit);
    
    // Convert USDT profit to coin using REAL crypto price, not simulated trading price
    const profitInCoin = calculatedProfit / realPrice; // Use real crypto price for conversion
    const newBalance = Math.max(0, balance + profitInCoin); // Ensure balance doesn't go negative
    setGrandTotal(newBalance * realPrice); // Show grand total in USDT using real price
    
    // Update the parent component's balance with new coin balance
    onBalanceUpdate(newBalance);
    
    setSessionActive(false);
    setSessionStopped(true);
    setSessionStartTime(null);
    onSessionStart(false);
  };

  return (
    <Card>
      <CardHeader className="px-3 py-2 sm:p-3">
        <CardTitle className="text-base sm:text-lg">{t('tradingForm')}</CardTitle>
      </CardHeader>
      <CardContent className="px-3 py-2 sm:p-3 space-y-3 sm:space-y-4">
        <div className="flex gap-2">
          <Button 
            className="flex-1 h-11 sm:h-9 text-sm touch-manipulation bg-green-600 hover:bg-green-700"
            variant={selectedAction === 'buy' ? 'default' : 'outline'}
            onClick={() => setSelectedAction('buy')}
            disabled={sessionActive}
          >
            {t('buy')}
          </Button>
          <Button 
            variant={selectedAction === 'sell' ? 'destructive' : 'outline'}
            className="flex-1 h-11 sm:h-9 text-sm touch-manipulation"
            onClick={() => setSelectedAction('sell')}
            disabled={sessionActive}
          >
            {t('sell')}
          </Button>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs sm:text-sm font-medium">{t('lotSize')}:</label>
          <input
            className="w-full p-2.5 sm:p-2 text-sm border rounded-md bg-background text-foreground touch-manipulation"
            value={lots}
            onChange={e => {
              const value = e.target.value;
              if (/^\d*\.?\d*$/.test(value) && parseFloat(value) <= 1000) {
                setLots(value);
              }
            }}
            placeholder={t('enterLots')}
            disabled={sessionActive}
            type="number"
            min="0.01"
            max="1000"
            step="0.01"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs sm:text-sm font-medium">{t('stopLossTarget')}:</label>
          <input
            className="w-full p-2.5 sm:p-2 text-sm border rounded-md bg-background text-foreground touch-manipulation"
            value={stopLoss}
            onChange={e => {
              const value = e.target.value;
              if (/^\d*\.?\d*$/.test(value) && parseFloat(value) <= 10000) {
                setStopLoss(value);
              }
            }}
            placeholder={t('enterTarget')}
            disabled={sessionActive}
            type="number"
            min="1"
            max="10000"
            step="0.01"
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={startSession}
            disabled={sessionActive}
            variant={sessionActive ? "secondary" : "default"}
            className="flex-1 h-11 sm:h-9 text-sm touch-manipulation"
          >
            {t('startSession')}
          </Button>
          <Button
            onClick={stopSession}
            disabled={!sessionActive}
            variant={!sessionActive ? "secondary" : "destructive"}
            className="flex-1 h-11 sm:h-9 text-sm touch-manipulation"
          >
            {t('stopSession')}
          </Button>
        </div>

        <Button 
          onClick={() => setShowPL(true)} 
          variant="outline"
          className="w-full h-11 sm:h-9 text-sm touch-manipulation"
          disabled={!sessionStopped}
        >
          {t('showPL')}
        </Button>

        {/* Balance Display Section */}
        <div className="p-2.5 sm:p-3 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
          <h3 className="text-xs sm:text-sm font-semibold mb-1.5 text-center">{coin} Balance Information</h3>
          <div className="space-y-0.5 text-center">
            <p className="text-[10px] sm:text-xs text-muted-foreground">Total Balance in {coin}:</p>
            <p className="text-xs sm:text-sm font-bold">
              {balance.toFixed(coin === 'USDC' || coin === 'USDT' ? 2 : 8)} {coin}
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Total Balance in USDT:</p>
            <p className="text-xs sm:text-sm font-semibold text-primary">
              ${(balance * realPrice).toFixed(2)} USDT
            </p>
            {coin === 'USDC' && (
              <>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">USDC Balance in USDT:</p>
                <p className="text-xs sm:text-sm font-semibold text-primary">
                  ${(balance * realPrice).toFixed(2)} USDT
                </p>
              </>
            )}
            {showMinWarning && (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-red-500 font-medium">
                  ⚠️ Minimum ${minTradingUsd} USD required to trade
                </p>
                <DepositInfo coin={coin} />
              </div>
            )}
          </div>
        </div>

        {showPL && (
          <div className="space-y-0.5 sm:space-y-1 text-xs sm:text-sm bg-muted/50 p-2.5 sm:p-3 rounded-lg">
            <p>{t('profitPreview')}: <span className="font-mono">{profit.toFixed(4)} USDT</span></p>
            <p>{t('profitIn')} {coin}: <span className="font-mono text-[10px] sm:text-sm">{(profit / realPrice).toFixed(8)} {coin}</span></p>
            <p>{t('entryPrice')}: <span className="font-mono">{entryPrice}</span></p>
            <p>{t('exitPrice')}: <span className="font-mono">{exitPrice}</span></p>
            <p>{t('availableBalance')}: <span className="font-mono text-[10px] sm:text-sm">{getAvailableBalance().toFixed(8)} {coin}</span></p>
            <p>{t('balanceInUSDT')}: <span className="font-mono">{getBalanceInUSDT().toFixed(2)} USDT</span></p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface TradingInterfaceProps {
  coin: string;
  balance: number;
  onBack: () => void;
  onBalanceUpdateDB?: (newBalance: number) => void;
}

export default function TradingInterface({ coin, balance, onBack, onBalanceUpdateDB }: TradingInterfaceProps) {
  const { language, translations } = useLanguage();
  const t = (key: string) => translations[language]?.[key] || key;
  
  // Get real crypto prices
  const { getCurrentPrice } = useLiveCryptoPrices();
  
  const [currentBalance, setCurrentBalance] = useState(balance);
  const [currentPrice, setCurrentPrice] = useState(() => {
    // Generate random starting price between 950 and 1100
    return 950 + Math.random() * 150;
  });
  const [sessionActive, setSessionActive] = useState(false);
  const [currentLotSize, setCurrentLotSize] = useState<number | undefined>(undefined);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);

  // Get real exchange rate for the coin
  const getRealPrice = () => {
    // Stablecoins are always ~$1
    if (coin === 'USDC' || coin === 'USDT') return 1;
    return getCurrentPrice(coin);
  };

  const handlePriceUpdate = (price: number) => {
    setCurrentPrice(price);
  };

  const handleSessionStart = (active: boolean, lotSize?: number, startTime?: number) => {
    setSessionActive(active);
    setCurrentLotSize(lotSize);
    setSessionStartTime(active ? (startTime || Date.now()) : null);
  };

  const handleBalanceUpdate = (newBalance: number) => {
    setCurrentBalance(newBalance);
    // Also update the database balance if callback is provided
    if (onBalanceUpdateDB) {
      onBalanceUpdateDB(newBalance);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBalance(prev => parseFloat((balance + Math.random() * 0.0001).toFixed(6)));
    }, 5000);
    return () => clearInterval(interval);
  }, [balance]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-xl font-bold">{coin} {t('trading')}</h2>
      </div>
      
      <OrderBook 
        onPriceUpdate={handlePriceUpdate} 
        sessionActive={sessionActive} 
        lotSize={currentLotSize}
        sessionStartTime={sessionStartTime}
      />
      <TradingForm 
        balance={currentBalance} 
        coin={coin} 
        currentPrice={currentPrice} 
        onSessionStart={handleSessionStart}
        onBalanceUpdate={handleBalanceUpdate}
        realPrice={getRealPrice()}
      />
    </div>
  );
}