import { GlobalOutlined } from '@ant-design/icons';
import { Button, Dropdown } from 'antd';
import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const isEn = i18n.language === 'en-US';

  const changeLang = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('i18n-lang', lang);
  };

  return (
    <Dropdown
      menu={{
        items: [
          { key: 'zh-CN', label: '中文', onClick: () => changeLang('zh-CN') },
          { key: 'en-US', label: 'English', onClick: () => changeLang('en-US') },
        ],
        selectedKeys: [i18n.language],
      }}
      trigger={['click']}
    >
      <Button type="text" icon={<GlobalOutlined />} size="small">
        {isEn ? 'EN' : '中'}
      </Button>
    </Dropdown>
  );
}
