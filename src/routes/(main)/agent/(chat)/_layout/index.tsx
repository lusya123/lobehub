'use client';

import { Flexbox } from '@lobehub/ui';
import { lazy, memo, Suspense, useEffect, useState } from 'react';
import { Outlet } from 'react-router';

import ChatHeader from '@/routes/(main)/agent/features/Conversation/Header';
import Portal from '@/routes/(main)/agent/features/Portal';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';

import HeaderSlot from './HeaderSlot';

const AgentWorkingSidebar = lazy(
  () => import('@/routes/(main)/agent/features/Conversation/WorkingSidebar'),
);

const DeferredAgentWorkingSidebar = memo(() => {
  const showRightPanel = useGlobalStore(systemStatusSelectors.showRightPanel);
  const [hasOpened, setHasOpened] = useState(showRightPanel);

  useEffect(() => {
    if (showRightPanel) setHasOpened(true);
  }, [showRightPanel]);

  if (!showRightPanel && !hasOpened) return null;

  return (
    <Suspense>
      <AgentWorkingSidebar />
    </Suspense>
  );
});

DeferredAgentWorkingSidebar.displayName = 'DeferredAgentWorkingSidebar';

const ChatLayout = memo(() => {
  return (
    <HeaderSlot.Provider>
      <Flexbox
        horizontal
        flex={1}
        height={'100%'}
        style={{ minHeight: 0, overflow: 'hidden', position: 'relative' }}
        width={'100%'}
      >
        <Flexbox flex={1} style={{ minHeight: 0, minWidth: 0 }}>
          <ChatHeader />
          <Flexbox flex={1} style={{ minHeight: 0, position: 'relative' }}>
            <Outlet />
          </Flexbox>
        </Flexbox>
        <Portal />
        <DeferredAgentWorkingSidebar />
      </Flexbox>
    </HeaderSlot.Provider>
  );
});

ChatLayout.displayName = 'ChatLayout';

export default ChatLayout;
