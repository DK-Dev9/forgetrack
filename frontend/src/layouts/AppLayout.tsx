import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Factory,
  PackageCheck,
  Boxes,
  Layers,
  FileSpreadsheet,
  Users,
  History,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Search,
  Building2,
  Sparkles,
  ClipboardList,
  CheckCircle2,
  TrendingDown,
  Warehouse as WarehouseIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/ui/Badge';
import { UserRole } from '../types';

export const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout, quickDemoLogin, isAdmin, isManager, isStorekeeper, isOperator, isViewer, canManageUsers, canAccessCosts } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);

  const handleRoleSwitch = async (role: UserRole) => {
    setSwitching(true);
    try {
      await quickDemoLogin(role);
      navigate('/');
    } finally {
      setSwitching(false);
    }
  };

  const navGroups = [
    {
      label: 'Operations',
      items: [
        {
          label: 'Dashboard',
          path: '/',
          icon: LayoutDashboard,
          show: true,
        },
        {
          label: 'Production Orders',
          path: '/production',
          icon: Factory,
          show: true,
        },
        {
          label: 'My Assigned Work',
          path: '/production?assigned_to_me=true',
          icon: ClipboardList,
          show: isOperator || isManager || isAdmin,
        },
      ],
    },
    {
      label: 'Inventory Control',
      items: [
        {
          label: 'Stock Balances',
          path: '/inventory/balances',
          icon: Boxes,
          show: !isOperator, // operator sees only material requirements in their orders
        },
        {
          label: 'Items & Materials',
          path: '/inventory/items',
          icon: PackageCheck,
          show: !isOperator,
        },
        {
          label: 'Inventory Ledger',
          path: '/inventory/ledger',
          icon: History,
          show: isStorekeeper || isManager || isAdmin,
        },
        {
          label: 'Reconciliation',
          path: '/inventory/reconciliation',
          icon: CheckCircle2,
          show: isStorekeeper || isAdmin,
        },
      ],
    },
    {
      label: 'Product Engineering',
      items: [
        {
          label: 'Products',
          path: '/products',
          icon: Layers,
          show: !isOperator,
        },
        {
          label: 'Bills of Materials',
          path: '/products/boms',
          icon: FileSpreadsheet,
          show: !isOperator,
        },
      ],
    },
    {
      label: 'Analytics & Costs',
      items: [
        {
          label: 'Material Variance',
          path: '/reports/material-variance',
          icon: TrendingDown,
          show: !isViewer,
        },
        {
          label: 'Production Costing',
          path: '/reports/production-costs',
          icon: TrendingDown,
          show: canAccessCosts,
        },
      ],
    },
    {
      label: 'Administration',
      items: [
        {
          label: 'Users & Access',
          path: '/users',
          icon: Users,
          show: canManageUsers,
        },
        {
          label: 'Audit History',
          path: '/audit',
          icon: ShieldCheck,
          show: isAdmin || isManager,
        },
      ],
    },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside
        className={`${
          collapsed ? 'w-20' : 'w-64'
        } bg-slate-900 text-slate-300 flex flex-col flex-shrink-0 transition-all duration-200 border-r border-slate-800 z-30`}
      >
        {/* Brand header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80">
          <Link to="/" className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white font-bold flex-shrink-0 shadow-md">
              <Factory className="w-5 h-5" />
            </div>
            {!collapsed && (
              <div>
                <span className="text-base font-bold tracking-tight text-white block leading-none">
                  ForgeTrack
                </span>
                <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase block mt-1">
                  Manufacturing OS
                </span>
              </div>
            )}
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter((item) => item.show);
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.label} className="space-y-1">
                {!collapsed && (
                  <p className="px-3 text-[10px] font-semibold tracking-wider text-slate-400 uppercase mb-1">
                    {group.label}
                  </p>
                )}
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.path === '/'
                      ? location.pathname === '/'
                      : location.pathname.startsWith(item.path.split('?')[0]);

                  return (
                    <Link
                      key={item.label}
                      to={item.path}
                      title={collapsed ? item.label : undefined}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-brand-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Organization pill */}
        {!collapsed && user?.organization && (
          <div className="p-3 mx-3 mb-3 rounded-lg bg-slate-800/60 border border-slate-700/50 flex items-center gap-2 text-xs text-slate-300">
            <Building2 className="w-4 h-4 text-brand-400 flex-shrink-0" />
            <div className="overflow-hidden">
              <span className="block font-medium truncate">{user.organization.name}</span>
              <span className="block text-[10px] text-slate-400">Workspace Active</span>
            </div>
          </div>
        )}

        {/* User profile bottom item */}
        <div className="p-3 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs flex-shrink-0">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate">{user?.full_name}</p>
                <div className="mt-0.5">
                  <Badge role={user?.role} />
                </div>
              </div>
            )}
          </div>
          {!collapsed && (
            <button
              onClick={() => logout()}
              title="Sign Out"
              className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-slate-200/80 flex items-center justify-between px-6 z-20">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-semibold text-slate-800 tracking-tight">
              ForgeTrack Workspace
            </h1>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-medium text-slate-500">
              {user?.organization?.name || 'Discrete Manufacturing'}
            </span>
          </div>

          {/* Quick Demo Switcher */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              <span className="px-2 py-0.5 font-medium text-slate-500 flex items-center gap-1 text-[11px]">
                <Sparkles className="w-3 h-3 text-amber-500" /> Demo Role:
              </span>
              {(['ADMIN', 'PRODUCTION_MANAGER', 'STOREKEEPER', 'OPERATOR', 'VIEWER'] as UserRole[]).map(
                (role) => (
                  <button
                    key={role}
                    disabled={switching || user?.role === role}
                    onClick={() => handleRoleSwitch(role)}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                      user?.role === role
                        ? 'bg-white text-slate-900 shadow-sm font-bold border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    {role === 'PRODUCTION_MANAGER' ? 'Manager' : role === 'STOREKEEPER' ? 'Store' : role === 'OPERATOR' ? 'Operator' : role.charAt(0) + role.slice(1).toLowerCase()}
                  </button>
                )
              )}
            </div>

            <button
              onClick={() => logout()}
              className="text-xs text-slate-600 hover:text-rose-600 font-medium px-2 py-1 rounded hover:bg-slate-50 flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </header>

        {/* Page Body Viewport */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
