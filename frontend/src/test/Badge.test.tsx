import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Badge, StatusBadge, RoleBadge } from '../components/ui/Badge';

describe('Badge Components', () => {
  it('renders default badge with children', () => {
    render(<Badge>Test Badge</Badge>);
    expect(screen.getByText('Test Badge')).toBeInTheDocument();
  });

  it('renders success status badge correctly', () => {
    render(<StatusBadge status="COMPLETED" />);
    expect(screen.getByText(/completed/i)).toBeInTheDocument();
  });

  it('renders in-progress status badge correctly', () => {
    render(<StatusBadge status="IN_PROGRESS" />);
    expect(screen.getByText(/in progress/i)).toBeInTheDocument();
  });

  it('renders role badge with human-readable labels', () => {
    render(<RoleBadge role="PRODUCTION_MANAGER" />);
    expect(screen.getByText(/production manager/i)).toBeInTheDocument();
  });

  it('renders operator role badge correctly', () => {
    render(<RoleBadge role="OPERATOR" />);
    expect(screen.getByText(/operator/i)).toBeInTheDocument();
  });
});
