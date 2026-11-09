import React from 'react';
import Image from 'next/image';

interface BrandLogoProps {
  size?: 'sm' | 'md';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'sm',
}) => {
  const isMedium = size === 'md';

  return (
    <Image
      src="/unilearn-logo.png"
      alt="UniLearn"
      width={isMedium ? 220 : 130}
      height={isMedium ? 150 : 89}
      priority
      fetchPriority="high"
      className={isMedium ? 'h-24 w-auto object-contain' : 'h-10 w-auto object-contain'}
    />
  );
};
