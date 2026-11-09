import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  onClick,
  hoverable,
}) => (
  <div
    onClick={onClick}
    className={[
      'bg-white rounded-xl border border-slate-200 shadow-sm',
      hoverable ? 'cursor-pointer hover:shadow-md hover:border-slate-300 transition-all duration-150' : '',
      className,
    ].join(' ')}
  >
    {children}
  </div>
);
