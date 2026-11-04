import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { UsersPage } from './pages/users/UsersPage';
import { ItemsPage } from './pages/inventory/ItemsPage';
import { StockBalancesPage } from './pages/inventory/StockBalancesPage';
import { LedgerPage } from './pages/inventory/LedgerPage';
import { ReconciliationPage } from './pages/inventory/ReconciliationPage';
import { ProductsPage } from './pages/products/ProductsPage';
import { BOMPage } from './pages/products/BOMPage';
import { ProductionOrdersPage } from './pages/production/ProductionOrdersPage';
import { OrderDetailPage } from './pages/production/OrderDetailPage';
import { MaterialVarianceReportPage } from './pages/reports/MaterialVarianceReportPage';
import { ProductionCostsReportPage } from './pages/reports/ProductionCostsReportPage';
import { AuditLogPage } from './pages/audit/AuditLogPage';
import { Factory } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5000,
    },
  },
});

const ProtectedApp: React.FC = () => {
  const { user, loading, canManageUsers, canAccessCosts, isOperator } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center animate-pulse mb-3 shadow-lg shadow-brand-500/20">
          <Factory className="w-6 h-6 text-white" />
        </div>
        <p className="text-sm font-semibold tracking-wide">Initializing ForgeTrack...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        
        {/* Production */}
        <Route path="/production" element={<ProductionOrdersPage />} />
        <Route path="/production/:id" element={<OrderDetailPage />} />

        {/* Inventory */}
        {!isOperator && (
          <>
            <Route path="/inventory/items" element={<ItemsPage />} />
            <Route path="/inventory/balances" element={<StockBalancesPage />} />
            <Route path="/inventory/ledger" element={<LedgerPage />} />
            <Route path="/inventory/reconciliation" element={<ReconciliationPage />} />
          </>
        )}

        {/* Product Engineering */}
        {!isOperator && (
          <>
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/boms" element={<BOMPage />} />
          </>
        )}

        {/* Reports */}
        <Route path="/reports/material-variance" element={<MaterialVarianceReportPage />} />
        {canAccessCosts && (
          <Route path="/reports/production-costs" element={<ProductionCostsReportPage />} />
        )}

        {/* Administration */}
        {canManageUsers && <Route path="/users" element={<UsersPage />} />}
        <Route path="/audit" element={<AuditLogPage />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <ProtectedApp />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
