import { type UIChatMessage } from '@lobechat/types';
import { Flexbox, Modal, Segmented, Skeleton, Tabs } from '@lobehub/ui';
import { memo, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import ShareDataProvider from '@/features/ShareModal/ShareDataProvider';
import { useIsMobile } from '@/hooks/useIsMobile';
import dynamic from '@/libs/next/dynamic';

import { useConversationStore } from '../../store';

const loading = () => <Skeleton active paragraph={{ rows: 8 }} />;

const ShareImage = dynamic(() => import('./ShareImage'), { loading, ssr: false });
const SharePdf = dynamic(() => import('@/features/ShareModal/SharePdf'), {
  loading,
  ssr: false,
});
const ShareText = dynamic(() => import('./ShareText'), { loading, ssr: false });

enum Tab {
  PDF = 'pdf',
  Screenshot = 'screenshot',
  Text = 'text',
}

export interface ShareModalProps {
  message: UIChatMessage;
  onCancel: () => void;
  open: boolean;
}

const ShareModal = memo<ShareModalProps>(({ onCancel, open, message }) => {
  const [tab, setTab] = useState<Tab>(Tab.Screenshot);
  const { t } = useTranslation('chat');
  const uniqueId = useId();
  const isMobile = useIsMobile();
  const context = useConversationStore((s) => s.context);

  const tabItems = useMemo(() => {
    const items = [
      {
        children: <ShareImage message={message} mobile={isMobile} uniqueId={uniqueId} />,
        key: Tab.Screenshot,
        label: t('shareModal.screenshot'),
      },
      {
        children: <ShareText item={message} />,
        key: Tab.Text,
        label: t('shareModal.text'),
      },
      {
        children: (
          <ShareDataProvider context={context}>
            <SharePdf message={message} />
          </ShareDataProvider>
        ),
        key: Tab.PDF,
        label: t('shareModal.pdf'),
      },
    ];

    return items;
  }, [context, isMobile, message, uniqueId, t]);

  return (
    <Modal
      allowFullscreen
      centered={false}
      destroyOnHidden={true}
      footer={null}
      open={open}
      title={t('share', { ns: 'common' })}
      width={1440}
      onCancel={onCancel}
    >
      <Flexbox gap={isMobile ? 8 : 24}>
        <Segmented
          block
          style={{ width: '100%' }}
          value={tab}
          variant={'filled'}
          options={tabItems.map((item) => {
            return {
              label: item?.label,
              value: item?.key,
            };
          })}
          onChange={(value) => setTab(value as Tab)}
        />
        <Tabs
          activeKey={tab}
          indicator={{ align: 'center', size: (origin) => origin - 20 }}
          items={tabItems}
          renderTabBar={() => <></>}
          onChange={(key) => setTab(key as Tab)}
        />
      </Flexbox>
    </Modal>
  );
});

export default ShareModal;
