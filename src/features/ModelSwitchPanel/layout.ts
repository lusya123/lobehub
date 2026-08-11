import type { CSSProperties } from 'react';

export const AVAILABLE_PANEL_HEIGHT = 'var(--available-height, calc(100dvh - 16px))';

interface PanelLayoutOptions {
  height?: number;
  width?: number;
}

export const getPanelLayoutStyle = ({ height, width }: PanelLayoutOptions = {}): CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  ...(height === undefined ? {} : { height }),
  maxHeight: AVAILABLE_PANEL_HEIGHT,
  minHeight: 0,
  overflow: 'hidden',
  position: 'relative',
  ...(width === undefined ? {} : { width }),
});

export const getScrollableListStyle = (height: number): CSSProperties => ({
  height,
  minHeight: 0,
});
