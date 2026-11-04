import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, UserRole } from '../types';
import { authApi } from '../api/authApi';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  quickDemoLogin: (role: UserRole) => Promise<User>;
  isAdmin: boolean;
  isManager: boolean;
  isStorekeeper: boolean;
  isOperator: boolean;
  isViewer: boolean;
  canManageUsers: boolean;
  canAccessCosts: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_CREDENTIALS: Record<UserRole, { email: string; pass: string }> = {
  ADMIN: { email: 'admin@forgetrack.com', pass: 'ForgeTrackDemo123!' },
  PRODUCTION_MANAGER: { email: 'manager@forgetrack.com', pass: 'ForgeTrackDemo123!' },
  STOREKEEPER: { email: 'store@forgetrack.com', pass: 'ForgeTrackDemo123!' },
  OPERATOR: { email: 'operator@forgetrack.com', pass: 'ForgeTrackDemo123!' },
  VIEWER: { email: 'viewer@forgetrack.com', pass: 'ForgeTrackDemo123!' },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Attempt to load currently logged-in user on mount
    authApi
      .getCurrentUser()
      .then((currUser) => {
        setUser(currUser);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = async (email: string, pass: string): Promise<User> => {
    const loggedIn = await authApi.login(email, pass);
    setUser(loggedIn);
    return loggedIn;
  };

  const logout = async (): Promise<void> => {
    await authApi.logout();
    setUser(null);
  };

  const quickDemoLogin = async (role: UserRole): Promise<User> => {
    const cred = DEMO_CREDENTIALS[role];
    return login(cred.email, cred.pass);
  };

  const isAdmin = user?.role === 'ADMIN';
  const isManager = user?.role === 'PRODUCTION_MANAGER';
  const isStorekeeper = user?.role === 'STOREKEEPER';
  const isOperator = user?.role === 'OPERATOR';
  const isViewer = user?.role === 'VIEWER';

  const canManageUsers = isAdmin;
  const canAccessCosts = isAdmin || isManager;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        quickDemoLogin,
        isAdmin,
        isManager,
        isStorekeeper,
        isOperator,
        isViewer,
        canManageUsers,
        canAccessCosts,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
