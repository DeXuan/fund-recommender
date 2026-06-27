import React from 'react';
import { CrownOutlined } from '@ant-design/icons';

const ProBadge: React.FC<{
  isSVIP?: boolean;
  size?: 'small' | 'default';
  style?: React.CSSProperties;
}> = ({ isSVIP, size = 'default', style }) => {
  if (isSVIP) return null;

  const isSmall = size === 'small';

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 2,
      padding: isSmall ? '1px 6px' : '2px 8px',
      borderRadius: isSmall ? 6 : 8,
      background: 'linear-gradient(135deg, #faad14 0%, #fa8c16 100%)',
      color: '#fff',
      fontSize: isSmall ? 10 : 11,
      fontWeight: 700,
      lineHeight: isSmall ? '16px' : '18px',
      letterSpacing: '0.5px',
      boxShadow: '0 2px 4px rgba(250,173,20,0.3)',
      cursor: 'pointer',
      ...style,
    }}>
      <CrownOutlined style={{ fontSize: isSmall ? 9 : 10 }} />
      PRO
    </span>
  );
};

export default ProBadge;
