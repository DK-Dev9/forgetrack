import React from 'react';
import { OrderStatus, OrderPriority, ItemType, UserRole } from '../../types';

interface BadgeProps {
  children?: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  status?: OrderStatus;
  priority?: OrderPriority;
  itemType?: ItemType;
  role?: UserRole;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant,
  status,
  priority,
  itemType,
  role,
  className = '',
}) => {
  let style = 'bg-slate-100 text-slate-700 border-slate-200';
  let label = children;

  if (status) {
    label = status.replace('_', ' ');
    switch (status) {
      case 'DRAFT':
        style = 'bg-slate-100 text-slate-700 border-slate-300';
        break;
      case 'PLANNED':
        style = 'bg-blue-50 text-blue-700 border-blue-200';
        break;
      case 'RELEASED':
        style = 'bg-indigo-50 text-indigo-700 border-indigo-200';
        break;
      case 'IN_PROGRESS':
        style = 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse';
        break;
      case 'ON_HOLD':
        style = 'bg-orange-50 text-orange-700 border-orange-200';
        break;
      case 'COMPLETED':
        style = 'bg-emerald-50 text-emerald-800 border-emerald-300';
        break;
      case 'CLOSED':
        style = 'bg-teal-50 text-teal-800 border-teal-300';
        break;
      case 'CANCELLED':
        style = 'bg-rose-50 text-rose-700 border-rose-200 line-through';
        break;
    }
  } else if (priority) {
    label = priority;
    switch (priority) {
      case 'LOW':
        style = 'bg-slate-100 text-slate-600 border-slate-200';
        break;
      case 'MEDIUM':
        style = 'bg-blue-50 text-blue-700 border-blue-200';
        break;
      case 'HIGH':
        style = 'bg-amber-50 text-amber-800 border-amber-300 font-medium';
        break;
      case 'URGENT':
        style = 'bg-rose-50 text-rose-800 border-rose-300 font-semibold';
        break;
    }
  } else if (itemType) {
    label = itemType.replace('_', ' ');
    switch (itemType) {
      case 'RAW_MATERIAL':
        style = 'bg-zinc-100 text-zinc-800 border-zinc-300';
        break;
      case 'COMPONENT':
        style = 'bg-cyan-50 text-cyan-800 border-cyan-200';
        break;
      case 'FINISHED_GOOD':
        style = 'bg-emerald-50 text-emerald-800 border-emerald-200 font-medium';
        break;
      case 'CONSUMABLE':
        style = 'bg-amber-50 text-amber-800 border-amber-200';
        break;
    }
  } else if (role) {
    label = role.replace('_', ' ');
    switch (role) {
      case 'ADMIN':
        style = 'bg-purple-50 text-purple-700 border-purple-200 font-semibold';
        break;
      case 'PRODUCTION_MANAGER':
        style = 'bg-blue-50 text-blue-700 border-blue-200 font-medium';
        break;
      case 'STOREKEEPER':
        style = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        break;
      case 'OPERATOR':
        style = 'bg-amber-50 text-amber-800 border-amber-300';
        break;
      case 'VIEWER':
        style = 'bg-slate-100 text-slate-600 border-slate-200';
        break;
    }
  } else if (variant) {
    switch (variant) {
      case 'success':
        style = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        break;
      case 'warning':
        style = 'bg-amber-50 text-amber-800 border-amber-300';
        break;
      case 'danger':
        style = 'bg-rose-50 text-rose-700 border-rose-200';
        break;
      case 'info':
        style = 'bg-blue-50 text-blue-700 border-blue-200';
        break;
      case 'neutral':
        style = 'bg-slate-100 text-slate-700 border-slate-200';
        break;
    }
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${style} ${className}`}
    >
      {label}
    </span>
  );
};

export const StatusBadge: React.FC<{ status: OrderStatus; className?: string }> = ({ status, className }) => (
  <Badge status={status} className={className} />
);

export const RoleBadge: React.FC<{ role: UserRole; className?: string }> = ({ role, className }) => (
  <Badge role={role} className={className} />
);

export const ItemTypeBadge: React.FC<{ itemType: ItemType; className?: string }> = ({ itemType, className }) => (
  <Badge itemType={itemType} className={className} />
);

