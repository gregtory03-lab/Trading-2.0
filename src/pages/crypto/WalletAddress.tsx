import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Wallet, Copy, QrCode, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QRCodeSVG } from 'qrcode.react';
import CryptoDashboardLayout from '@/components/CryptoDashboardLayout';

const WalletAddress = () => {
  const { toast } = useToast();
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<{ crypto: string; address: string } | null>(null);

  const walletAddresses = {
    BTC: 'bc1q56qxqrchf20qra4a0962fg7fqm54rvp9r7xhrl',
    ETH: '0xc2930d27a31cB1C25Cd6Bd96F858f0190CFdA5cB',
    USDC: '0xc2930d27a31cB1C25Cd6Bd96F858f0190CFdA5cB'
  };

  const copyToClipboard = (address: string, crypto: string) => {
    navigator.clipboard.writeText(address);
    toast({
      title: "Address Copied! 📋",
      description: `${crypto} wallet address copied to clipboard`,
    });
  };

  const showQRCode = (crypto: string, address: string) => {
    setSelectedAddress({ crypto, address });
    setQrDialogOpen(true);
  };

  return (
    <CryptoDashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Wallet className="h-6 w-6 text-green-500" />
          <h1 className="text-3xl font-bold">Wallet Address</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Deposit Addresses</CardTitle>
            <CardDescription>Addresses for receiving different cryptocurrencies</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Bitcoin (BTC)</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="text"
                  value={walletAddresses.BTC}
                  readOnly
                  className="bg-muted"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(walletAddresses.BTC, 'BTC')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => showQRCode('BTC', walletAddresses.BTC)}
                >
                  <QrCode className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label>Ethereum (ETH)</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="text"
                  value={walletAddresses.ETH}
                  readOnly
                  className="bg-muted"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(walletAddresses.ETH, 'ETH')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => showQRCode('ETH', walletAddresses.ETH)}
                >
                  <QrCode className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label>USD Coin (USDC)</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="text"
                  value={walletAddresses.USDC}
                  readOnly
                  className="bg-muted"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(walletAddresses.USDC, 'USDC')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => showQRCode('USDC', walletAddresses.USDC)}
                >
                  <QrCode className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* QR Code Dialog */}
        <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center">
                {selectedAddress?.crypto} Wallet Address
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="bg-white p-4 rounded-lg">
                {selectedAddress && (
                  <QRCodeSVG
                    value={selectedAddress.address}
                    size={200}
                    level="H"
                    includeMargin
                  />
                )}
              </div>
              <p className="text-xs text-muted-foreground text-center break-all px-4">
                {selectedAddress?.address}
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  if (selectedAddress) {
                    copyToClipboard(selectedAddress.address, selectedAddress.crypto);
                  }
                }}
                className="w-full"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Address
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </CryptoDashboardLayout>
  );
};

export default WalletAddress;