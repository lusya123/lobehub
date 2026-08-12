import { describe, expect, it } from 'vitest';

import { getAvailablePanelHeight, getPanelLayoutStyle, getScrollableListStyle } from './layout';

describe('ModelSwitchPanel mobile layout', () => {
  it('uses the concrete available height so Safari can shrink the flex list', () => {
    expect(getAvailablePanelHeight(460)).toBe('min(460px, var(--available-height, 460px))');
    expect(getPanelLayoutStyle({ height: 460, width: 320 })).toEqual({
      display: 'flex',
      flexDirection: 'column',
      height: 'min(460px, var(--available-height, 460px))',
      minHeight: 0,
      position: 'relative',
      width: 320,
    });
  });

  it('allows the list flex item to shrink without pinning a fixed height', () => {
    expect(getScrollableListStyle()).toEqual({ minHeight: 0 });
  });

  it('keeps the resizable panel flexible while Rnd owns its max height', () => {
    expect(getPanelLayoutStyle()).toEqual({
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      position: 'relative',
    });
  });
});
