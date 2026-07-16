'use client';

import { type ConversationContext } from '@lobechat/types';
import { Flexbox, Segmented, Skeleton } from '@lobehub/ui';
import { createModal, type ModalInstance } from '@lobehub/ui/base-ui';
import { t } from 'i18next';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useIsMobile } from '@/hooks/useIsMobile';
import dynamic from '@/libs/next/dynamic';

import ShareDataProvider, { useShareData } from './ShareDataProvider';

const loading = () => (
  <Flexbox gap={12} paddingBlock={8}>
    <Skeleton active paragraph={{ rows: 8 }} />
  </Flexbox>
);

const ShareImage = dynamic(() => import('./ShareImage'), { loading, ssr: false });
const ShareJSON = dynamic(() => import('./ShareJSON'), { loading, ssr: false });
const SharePdf = dynamic(() => import('./SharePdf'), { loading, ssr: false });
const ShareText = dynamic(() => import('./ShareText'), { loading, ssr: false });

enum Tab {
  JSON = 'json',
  PDF = 'pdf',
  Screenshot = 'screenshot',
  Text = 'text',
}

export interface OpenShareModalOptions {
  afterClose?: () => void;
  context?: Partial<ConversationContext>;
}

const ShareModalContent = memo(() => {
  const [tab, setTab] = useState<Tab>(Tab.Screenshot);
  const { t } = useTranslation('chat');
  const isMobile = useIsMobile();
  const { dbMessages, isLoading } = useShareData();

  const tabItems = useMemo(
    () => [
      {
        label: t('shareModal.screenshot'),
        value: Tab.Screenshot,
      },
      {
        label: t('shareModal.text'),
        value: Tab.Text,
      },
      {
        label: t('shareModal.pdf'),
        value: Tab.PDF,
      },
      {
        label: 'JSON',
        value: Tab.JSON,
      },
    ],
    [t],
  );

  return (
    <Flexbox
      gap={isMobile ? 8 : 24}
      height={'100%'}
      style={{ overflow: 'hidden', position: 'relative' }}
    >
      <Segmented
        block
        options={tabItems}
        style={{ width: '100%' }}
        value={tab}
        variant={'filled'}
        onChange={(value) => setTab(value as Tab)}
      />
      {isLoading && dbMessages.length === 0 ? (
        <Flexbox gap={12} paddingBlock={8}>
          <Skeleton active paragraph={{ rows: 8 }} />
        </Flexbox>
      ) : (
        <>
          {tab === Tab.Screenshot && <ShareImage mobile={isMobile} />}
          {tab === Tab.Text && <ShareText />}
          {tab === Tab.PDF && <SharePdf />}
          {tab === Tab.JSON && <ShareJSON />}
        </>
      )}
    </Flexbox>
  );
});

ShareModalContent.displayName = 'ShareModalContent';

export const openShareModal = ({
  afterClose,
  context,
}: OpenShareModalOptions = {}): ModalInstance =>
  createModal({
    content: (
      <ShareDataProvider context={context}>
        <ShareModalContent />
      </ShareDataProvider>
    ),
    footer: null,
    maskClosable: true,
    onOpenChangeComplete: (open) => {
      if (!open) afterClose?.();
    },
    styles: {
      content: { height: 'min(80vh, 800px)' },
    },
    title: t('shareModal.title', { ns: 'chat' }),
    width: 'min(90vw, 1024px)',
  });

export default openShareModal;
