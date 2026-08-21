import { useState } from 'react';

interface Props {
  children: React.ReactNode;
  className?: string;
  isDark: boolean;
}

export function CodeBlock({ children, className, isDark, ...props }: Props & Record<string, any>) {
  const [copied, setCopied] = useState(false);
  const isInline = !className;
  if (isInline) return <code className={className} {...props}>{children}</code>;
  const codeText = String(children).replace(/\n$/, '');
  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        position: 'absolute', top: 8, right: 8, zIndex: 1,
        display: 'flex', gap: 4,
      }}>
        <span style={{
          fontSize: 11, color: isDark ? '#666' : '#999', padding: '2px 8px',
          borderRadius: 4, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          userSelect: 'none',
        }}>
          {className?.replace('language-', '') || 'code'}
        </span>
        <span
          onClick={() => { navigator.clipboard.writeText(codeText); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          style={{
            fontSize: 11, color: copied ? '#52c41a' : (isDark ? '#888' : '#999'),
            padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
            background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            transition: 'color 0.2s',
          }}
        >
          {copied ? '已复制' : '复制'}
        </span>
      </div>
      <code className={className} {...props}>{children}</code>
    </div>
  );
}
