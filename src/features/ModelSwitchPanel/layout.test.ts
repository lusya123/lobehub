import { describe, expect, it } from 'vitest';

import { AVAILABLE_PANEL_HEIGHT, getPanelLayoutStyle, getScrollableListStyle } from './layout';

describe('ModelSwitchPanel mobile layout', () => {
  it('caps the panel to the available viewport height', () => {
    expect(getPanelLayoutStyle({ height: 460, width: 320 })).toEqual({
      display: 'flex',
      flexDirection: 'column',
      height: 460,
      maxHeight: AVAILABLE_PANEL_HEIGHT,
      minHeight: 0,
      overflow: 'hidden',
      position: 'relative',
      width: 320,
    });
  });

  it('allows the list flex item to shrink into an independent scroll viewport', () => {
    expect(getScrollableListStyle(372)).toEqual({ height: 372, minHeight: 0 });
  });
});
