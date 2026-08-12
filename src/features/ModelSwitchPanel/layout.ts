import type { CSSProperties } from 'react';

interface PanelLayoutOptions {
  height?: number;
  width?: number;
}

export const getAvailablePanelHeight = (height: number) =>
  `min(${height}px, var(--available-height, ${height}px))`;

export const getPanelLayoutStyle = ({ height, width }: PanelLayoutOptions = {}): CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  ...(height === undefined ? {} : { height: getAvailablePanelHeight(height) }),
  minHeight: 0,
  position: 'relative',
  ...(width === undefined ? {} : { width }),
});

export const getScrollableListStyle = (): CSSProperties => ({ minHeight: 0 });
