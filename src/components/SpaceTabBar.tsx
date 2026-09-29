import React from 'react';
import { Briefcase, Home } from 'lucide-react';

export function SpaceTabBar({
  spaceTab,
  setSpaceTab,
}: {
  spaceTab: 'office' | 'personal';
  setSpaceTab: (tab: 'office' | 'personal') => void;
}) {
  return (
    <div className="tw-space-tabbar" role="tablist" aria-label="Workspaces">
      <button
        type="button"
        role="tab"
        aria-selected={spaceTab === 'office'}
        className={'tw-space-tab' + (spaceTab === 'office' ? ' active' : '')}
        onClick={() => setSpaceTab('office')}
      >
        <Briefcase size={14} /> Office
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={spaceTab === 'personal'}
        className={'tw-space-tab' + (spaceTab === 'personal' ? ' active' : '')}
        onClick={() => setSpaceTab('personal')}
      >
        <Home size={14} /> Personal
      </button>
    </div>
  );
}
