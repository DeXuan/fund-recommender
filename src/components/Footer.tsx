import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

export default function Footer() {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const border = isDark ? '#262626' : '#f0f0f0';
  const text2 = isDark ? '#a0a0a0' : '#595959';
  const text3 = isDark ? '#6b6b6b' : '#bfbfbf';

  return (
    <footer style={{
      borderTop: `1px solid ${border}`,
      padding: '32px 24px',
      textAlign: 'center',
      marginTop: 48,
    }}>
      <div style={{ maxWidth: 1800, margin: '0 auto' }}>
        {/* 免责声明 */}
        <div style={{
          border: isDark ? '1px solid #333' : '1px solid #f0f0f0',
          background: isDark ? '#1f1f1f' : '#fafafa',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 20,
          fontSize: 12,
          color: text3,
          lineHeight: 1.8,
        }}>
          {t('footer.disclaimer')}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: text2, marginBottom: 8 }}>
          {t('footer.about')}
        </div>
        <div style={{ fontSize: 13, color: text3, marginBottom: 4 }}>
          Fund-recommender
        </div>
        <div style={{ fontSize: 12, color: text3, marginTop: 16 }}>
          Copyright &copy;{' '}
          <a
            href="https://weibo.com/u/2970749213"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: isDark ? '#4096ff' : '#1677ff', textDecoration: 'none' }}
          >
            {t('footer.copyright')}
          </a>
        </div>
      </div>
    </footer>
  );
}
