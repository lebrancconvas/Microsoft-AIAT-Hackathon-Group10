import type { CSSProperties, ReactNode } from 'react';
import { theme } from '../theme';

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        backgroundColor: theme.color.surface,
        borderRadius: theme.radius.lg,
        border: `1px solid ${theme.color.border}`,
        boxShadow: theme.shadow.md,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
