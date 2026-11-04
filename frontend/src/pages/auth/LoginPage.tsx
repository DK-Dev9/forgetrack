import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Factory, ShieldCheck, ArrowRight, Lock, Mail, Sparkles, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { UserRole } from '../../types';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('admin@forgetrack.com');
  const [password, setPassword] = useState('ForgeTrackDemo123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login, quickDemoLogin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSelect = async (role: UserRole) => {
    setError(null);
    setLoading(true);
    try {
      await quickDemoLogin(role);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Demo login failed.');
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts: Array<{ role: UserRole; name: string; title: string; desc: string }> = [
    {
      role: 'ADMIN',
      name: 'Vikram Sharma',
      title: 'Administrator',
      desc: 'Full workspace access, user management, audit logs, organization config',
    },
    {
      role: 'PRODUCTION_MANAGER',
      name: 'Rajesh Patel',
      title: 'Production Manager',
      desc: 'Order planning, releases, shop floor assignments, material costing',
    },
    {
      role: 'STOREKEEPER',
      name: 'Amit Kumar',
      title: 'Storekeeper',
      desc: 'Inventory receipts, warehouse transfers, reservations, material issues/returns',
    },
    {
      role: 'OPERATOR',
      name: 'Suresh Verma',
      title: 'Production Operator',
      desc: 'Shop floor access, assigned orders only, consumption & output reporting',
    },
    {
      role: 'VIEWER',
      name: 'Ananya Iyer',
      title: 'Quality & Audit Viewer',
      desc: 'Read-only access to authorized screens and production metrics',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Background accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-brand-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-lg shadow-brand-500/20 mb-4">
          <Factory className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white">ForgeTrack</h2>
        <p className="mt-1 text-sm text-slate-400">
          Manufacturing Operations & Production Management
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl relative z-10 px-4 sm:px-0">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-md">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-800/80 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-colors"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-800/80 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-colors"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={loading}
              className="w-full mt-2"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Sign In to Workspace
            </Button>
          </form>

          {/* 1-Click Persona Switcher */}
          <div className="mt-8 pt-6 border-t border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-semibold text-slate-300 tracking-wide">
                Instant Demo Personas (1-Click Sign In)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {demoAccounts.map((account) => (
                <button
                  key={account.role}
                  disabled={loading}
                  onClick={() => handleDemoSelect(account.role)}
                  className="text-left p-3 rounded-xl bg-slate-800/40 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white group-hover:text-brand-400 transition-colors">
                      {account.title}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {account.role}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium mt-0.5">{account.name}</p>
                  <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-tight">
                    {account.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="text-center mt-6 text-xs text-slate-400">
          Secure, HTTP-only session authentication & PostgreSQL append-only transactional ledger.
        </div>
      </div>
    </div>
  );
};
