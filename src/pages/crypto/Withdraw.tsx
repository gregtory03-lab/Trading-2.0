import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Download, DollarSign, Wallet, CreditCard, ClipboardPaste } from 'lucide-react';
import CryptoDashboardLayout from '@/components/CryptoDashboardLayout';

const Withdraw = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [withdrawalMethod, setWithdrawalMethod] = useState<'wallet' | 'bank'>('wallet');
  const [amount, setAmount] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [walletBalances, setWalletBalances] = useState<Record<string, number>>({});
  const [selectedCrypto, setSelectedCrypto] = useState('');

  // Bank details
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [bankName, setBankName] = useState('');
  const [iban, setIban] = useState('');
  const [swiftCode, setSwiftCode] = useState('');

  useEffect(() => {
    if (user) {
      fetchWalletBalances();
    }
  }, [user]);

  const fetchWalletBalances = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('wallet_balances')
      .select('*')
      .eq('user_id', user.id);

    const balances: Record<string, number> = {};
    data?.forEach(balance => {
      balances[balance.symbol] = parseFloat(balance.balance.toString());
    });
    setWalletBalances(balances);
  };

  const updateWalletBalance = async (symbol: string, newBalance: number) => {
    if (!user) return;

    const { error: updateError } = await supabase
      .from('wallet_balances')
      .update({ balance: newBalance })
      .eq('user_id', user.id)
      .eq('symbol', symbol);

    if (updateError?.code === 'PGRST116' || !updateError) {
      const { error: insertError } = await supabase
        .from('wallet_balances')
        .insert({
          user_id: user.id,
          symbol,
          balance: newBalance
        });

      if (insertError) {
        console.error('Error inserting wallet balance:', insertError);
      }
    } else if (updateError) {
      console.error('Error updating wallet balance:', updateError);
    }
  };

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  // Hardcoded USD prices for stablecoins, approximate for others
  const getUsdValue = (symbol: string, amt: number): number => {
    const approxPrices: Record<string, number> = { BTC: 60000, ETH: 3000, USDT: 1, USDC: 1 };
    return amt * (approxPrices[symbol] || 1);
  };

  const handleWithdraw = async () => {
    if (!selectedCrypto) {
      toast({ title: "Select Cryptocurrency", description: "Please select a cryptocurrency to withdraw.", variant: "destructive" });
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid withdrawal amount.", variant: "destructive" });
      return;
    }

    const withdrawAmount = parseFloat(amount);
    const usdValue = getUsdValue(selectedCrypto, withdrawAmount);
    if (usdValue < 1000) {
      toast({ title: "Minimum Withdrawal $1,000", description: `Your withdrawal of ~$${usdValue.toFixed(2)} USD is below the $1,000 minimum.`, variant: "destructive" });
      return;
    }

    if (withdrawalMethod === 'wallet' && !walletAddress) {
      toast({ title: "Address Required", description: "Please enter a valid wallet address.", variant: "destructive" });
      return;
    }

    if (withdrawalMethod === 'bank') {
      if (!cardNumber || cardNumber.replace(/\s/g, '').length < 13) {
        toast({ title: "Card Number Required", description: "Please enter a valid card/account number.", variant: "destructive" });
        return;
      }
      if (!cardHolder.trim()) {
        toast({ title: "Card Holder Required", description: "Please enter the card holder name.", variant: "destructive" });
        return;
      }
      if (!bankName.trim()) {
        toast({ title: "Bank Name Required", description: "Please enter your bank name.", variant: "destructive" });
        return;
      }
    }

    // withdrawAmount already declared above
    const balance = walletBalances[selectedCrypto] || 0;
    
    if (withdrawAmount > balance) {
      toast({ title: "Insufficient Balance", description: `You don't have enough ${selectedCrypto} for this withdrawal.`, variant: "destructive" });
      return;
    }

    const newBalance = balance - withdrawAmount;
    const fee = selectedCrypto === 'BTC' ? 0.0001 : 0.001;

    const details = withdrawalMethod === 'wallet'
      ? { method: 'wallet', wallet_address: walletAddress, withdrawal_fee: fee }
      : { 
          method: 'bank', 
          card_number: `****${cardNumber.replace(/\s/g, '').slice(-4)}`,
          card_holder: cardHolder,
          bank_name: bankName,
          iban: iban || undefined,
          swift_code: swiftCode || undefined,
          withdrawal_fee: fee 
        };

    await supabase.from('transactions').insert({
      user_id: user!.id,
      type: 'withdraw',
      crypto_symbol: selectedCrypto,
      amount: withdrawAmount,
      status: 'pending',
      details
    });

    await updateWalletBalance(selectedCrypto, newBalance);
    await fetchWalletBalances();

    toast({
      title: "Withdrawal Initiated! 💰",
      description: `${withdrawAmount} ${selectedCrypto} withdrawal to ${withdrawalMethod === 'bank' ? 'bank account' : 'wallet'} is pending admin approval.`,
    });
    setAmount('');
    setWalletAddress('');
    setSelectedCrypto('');
    setCardNumber('');
    setCardHolder('');
    setBankName('');
    setIban('');
    setSwiftCode('');
  };

  return (
    <CryptoDashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Download className="h-6 w-6 text-purple-500" />
          <h1 className="text-3xl font-bold">Withdraw Funds</h1>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Withdraw Funds</CardTitle>
              <CardDescription>Choose withdrawal method and enter details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Withdrawal Method Toggle */}
              <div>
                <Label>Withdrawal Method</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <Button
                    type="button"
                    variant={withdrawalMethod === 'wallet' ? 'default' : 'outline'}
                    className={withdrawalMethod === 'wallet' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}
                    onClick={() => setWithdrawalMethod('wallet')}
                  >
                    <Wallet className="h-4 w-4 mr-2" />
                    Crypto Wallet
                  </Button>
                  <Button
                    type="button"
                    variant={withdrawalMethod === 'bank' ? 'default' : 'outline'}
                    className={withdrawalMethod === 'bank' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}
                    onClick={() => setWithdrawalMethod('bank')}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Bank / Card
                  </Button>
                </div>
              </div>

              {/* Select Crypto */}
              <div>
                <Label>Select Cryptocurrency</Label>
                <select 
                  className="w-full mt-1 p-2 border border-border rounded-md bg-background"
                  value={selectedCrypto}
                  onChange={(e) => setSelectedCrypto(e.target.value)}
                >
                  <option value="">Select cryptocurrency</option>
                  <option value="BTC">Bitcoin (BTC)</option>
                  <option value="ETH">Ethereum (ETH)</option>
                  <option value="USDT">Tether (USDT)</option>
                  <option value="USDC">USD Coin (USDC)</option>
                </select>
              </div>

              {selectedCrypto && (
                <>
                  {/* Amount */}
                  <div>
                    <Label>Withdrawal Amount ({selectedCrypto})</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        step="0.00000001"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => {
                          const bal = walletBalances[selectedCrypto] || 0;
                          const fee = selectedCrypto === 'BTC' ? 0.0001 : 0.001;
                          const max = Math.max(0, bal - fee);
                          setAmount(max.toString());
                        }}
                      >
                        Max
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Available Balance: {(walletBalances[selectedCrypto] || 0).toFixed(8)} {selectedCrypto}
                    </p>
                  </div>

                  {/* Wallet Address (crypto method) */}
                  {withdrawalMethod === 'wallet' && (
                    <div>
                      <Label>Wallet Address</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          type="text"
                          placeholder={selectedCrypto === 'BTC' ? 'bc1q0w2ygfmakvhhhmdd2ujxk6hcq70d0stzjjmvf5' : '0xd70948BB43F5825d3DBCE077294a7210F3Fa3c82'}
                          value={walletAddress}
                          onChange={(e) => setWalletAddress(e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={async () => {
                            try {
                              const text = await navigator.clipboard.readText();
                              setWalletAddress(text.trim());
                              toast({ title: "Pasted! 📋", description: "Wallet address pasted from clipboard" });
                            } catch {
                              toast({ title: "Paste Failed", description: "Unable to read clipboard. Please paste manually.", variant: "destructive" });
                            }
                          }}
                        >
                          <ClipboardPaste className="h-4 w-4 mr-1" />
                          Paste
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Bank / Card Details */}
                  {withdrawalMethod === 'bank' && (
                    <div className="space-y-3 border border-border rounded-lg p-4 bg-muted/30">
                      <h3 className="font-semibold flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Bank / Card Details
                      </h3>
                      <div>
                        <Label>Card / Account Number *</Label>
                        <Input
                          type="text"
                          placeholder="1234 5678 9012 3456"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                          className="mt-1"
                          maxLength={19}
                        />
                      </div>
                      <div>
                        <Label>Card Holder / Account Name *</Label>
                        <Input
                          type="text"
                          placeholder="John Doe"
                          value={cardHolder}
                          onChange={(e) => setCardHolder(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Bank Name *</Label>
                        <Input
                          type="text"
                          placeholder="e.g. Chase, Barclays, Deutsche Bank"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>IBAN (optional)</Label>
                          <Input
                            type="text"
                            placeholder="GB29NWBK60161331926819"
                            value={iban}
                            onChange={(e) => setIban(e.target.value.toUpperCase())}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>SWIFT/BIC (optional)</Label>
                          <Input
                            type="text"
                            placeholder="NWBKGB2L"
                            value={swiftCode}
                            onChange={(e) => setSwiftCode(e.target.value.toUpperCase())}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  <div className="bg-muted p-3 rounded-md">
                    <div className="flex justify-between text-sm">
                      <span>Withdrawal Method:</span>
                      <span className="font-medium">{withdrawalMethod === 'bank' ? 'Bank / Card' : 'Crypto Wallet'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Withdrawal Amount:</span>
                      <span>{amount || '0.00'} {selectedCrypto}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Network Fee:</span>
                      <span>{selectedCrypto === 'BTC' ? '0.0001' : '0.001'} {selectedCrypto}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t pt-2 mt-2">
                      <span className="font-semibold">Total:</span>
                      <span className="font-semibold">
                        {amount ? 
                          (parseFloat(amount) + (selectedCrypto === 'BTC' ? 0.0001 : 0.001)).toFixed(selectedCrypto === 'BTC' ? 4 : 3) : 
                          (selectedCrypto === 'BTC' ? '0.0001' : '0.001')
                        } {selectedCrypto}
                      </span>
                    </div>
                  </div>
                </>
              )}

              <Button 
                onClick={handleWithdraw} 
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                disabled={!amount || !selectedCrypto}
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Withdraw {amount || '0.00'} {selectedCrypto || 'Crypto'} to {withdrawalMethod === 'bank' ? 'Bank' : 'Wallet'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </CryptoDashboardLayout>
  );
};

export default Withdraw;
