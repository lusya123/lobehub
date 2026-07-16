import { lazy, Suspense, useEffect, useState } from 'react';

import { useChatStore } from '@/store/chat';
import { chatPortalSelectors } from '@/store/chat/selectors';

import Portal from './features/Portal';

const PortalPanel = lazy(() => import('./features/PortalPanel'));

const ChatPortal = () => {
  const showPortal = useChatStore(chatPortalSelectors.showPortal);
  const [hasOpened, setHasOpened] = useState(showPortal);

  useEffect(() => {
    if (showPortal) setHasOpened(true);
  }, [showPortal]);

  return (
    <Portal>
      {(showPortal || hasOpened) && (
        <Suspense>
          <PortalPanel mobile={false} />
        </Suspense>
      )}
    </Portal>
  );
};

export default ChatPortal;
