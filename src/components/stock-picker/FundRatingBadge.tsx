import React from 'react';
import { Tag, Tooltip } from 'antd';

interface RatingData {
  grade: string;
  label: string;
  strengths: string[];
  weaknesses: string[];
}

const gradeConfig: Record<string, { color: string; bg: string }> = {
  'A': { color: '#52c41a', bg: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)' },
  'B+': { color: '#1890ff', bg: 'linear-gradient(135deg, #1890ff 0%, #40a9ff 100%)' },
  'B': { color: '#8c8c8c', bg: 'linear-gradient(135deg, #8c8c8c 0%, #bfbfbf 100%)' },
  'C': { color: '#fa8c16', bg: 'linear-gradient(135deg, #fa8c16 0%, #ffa940 100%)' },
  'D': { color: '#f5222d', bg: 'linear-gradient(135deg, #f5222d 0%, #ff4d4f 100%)' },
};

const FundRatingBadge: React.FC<{ rating: RatingData; size?: 'small' | 'default' }> = ({ rating, size = 'default' }) => {
  if (!rating) return null;
  const config = gradeConfig[rating.grade] || gradeConfig['B'];
  const isSmall = size === 'small';

  const tooltipContent = (
    <div style={{ maxWidth: 240 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{rating.label} ({rating.grade})</div>
      {rating.strengths?.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <span style={{ color: '#52c41a' }}>优势：</span>{rating.strengths.join('、')}
        </div>
      )}
      {rating.weaknesses?.length > 0 && (
        <div>
          <span style={{ color: '#ff4d4f' }}>风险：</span>{rating.weaknesses.join('、')}
        </div>
      )}
    </div>
  );

  return (
    <Tooltip title={tooltipContent}>
      <Tag
        style={{
          background: config.bg,
          color: '#fff',
          border: 'none',
          fontWeight: 700,
          fontSize: isSmall ? 11 : 13,
          padding: isSmall ? '0 6px' : '2px 10px',
          borderRadius: 6,
          cursor: 'pointer',
          lineHeight: isSmall ? '18px' : '22px',
        }}
      >
        {rating.grade}
      </Tag>
    </Tooltip>
  );
};

export default FundRatingBadge;
