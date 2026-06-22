import { useState, useCallback } from 'react';

export function useTabLazyLoad(initialTab: string) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set([initialTab]));

  const handleTabChange = useCallback((tab: string, onFirstLoad?: () => void) => {
    setActiveTab(tab);
    if (!loadedTabs.has(tab)) {
      setLoadedTabs(prev => new Set(prev).add(tab));
      onFirstLoad?.();
    }
  }, [loadedTabs]);

  return { activeTab, loadedTabs, handleTabChange };
}
