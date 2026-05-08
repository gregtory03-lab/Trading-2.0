import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminProtectedRoute from "@/components/AdminProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import BuyCrypto from "./pages/crypto/BuyCrypto";
import SellCrypto from "./pages/crypto/SellCrypto";
import Exchange from "./pages/crypto/Exchange";
import Withdraw from "./pages/crypto/Withdraw";
import Transactions from "./pages/crypto/Transactions";
import KYC from "./pages/crypto/KYC";
import WalletAddress from "./pages/crypto/WalletAddress";
import Settings from "./pages/crypto/Settings";
import Admin from "./pages/Admin";
import SimpleAdmin from "./pages/SimpleAdmin";
import VipOffers from "./pages/crypto/VipOffers";
import SupportInbox from "./pages/crypto/SupportInbox";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LanguageProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/buy" 
              element={
                <ProtectedRoute>
                  <BuyCrypto />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/sell" 
              element={
                <ProtectedRoute>
                  <SellCrypto />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/exchange" 
              element={
                <ProtectedRoute>
                  <Exchange />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/withdraw" 
              element={
                <ProtectedRoute>
                  <Withdraw />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/transactions" 
              element={
                <ProtectedRoute>
                  <Transactions />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/kyc" 
              element={
                <ProtectedRoute>
                  <KYC />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/wallet" 
              element={
                <ProtectedRoute>
                  <WalletAddress />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/vip-offers" 
              element={
                <ProtectedRoute>
                  <VipOffers />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/support" 
              element={
                <ProtectedRoute>
                  <SupportInbox />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/settings" 
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin" 
              element={
                <AdminProtectedRoute>
                  <Admin />
                </AdminProtectedRoute>
              } 
            />
            <Route 
              path="/simple-admin" 
              element={
                <AdminProtectedRoute>
                  <SimpleAdmin />
                </AdminProtectedRoute>
              } 
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
