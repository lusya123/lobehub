/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import type { AiModelForSelect } from 'model-bank';
import { describe, expect, it } from 'vitest';

import type { EnabledProviderWithModels } from '@/types/aiProvider';

import { useCurrentModelInfo } from './useCurrentModelName';

describe('useCurrentModelInfo', () => {
  it('returns the selected group and a model name without the legacy group prefix', () => {
    const enabledList: EnabledProviderWithModels[] = [
      {
        children: [
          {
            abilities: {},
            displayName: 'Pro / Claude Sonnet 4.6',
            id: 'claude-sonnet-4-6',
            type: 'chat',
          } as AiModelForSelect,
        ],
        id: 'sub2api-group-pro',
        name: 'Pro',
        source: 'custom',
      },
    ];

    const { result } = renderHook(() =>
      useCurrentModelInfo(enabledList, 'claude-sonnet-4-6', 'sub2api-group-pro'),
    );

    expect(result.current).toEqual({
      displayName: 'Claude Sonnet 4.6',
      providerName: 'Pro',
    });
  });

  it('falls back to stable ids while provider data is loading', () => {
    const { result } = renderHook(() =>
      useCurrentModelInfo([], 'claude-sonnet-4-6', 'sub2api-group-pro'),
    );

    expect(result.current).toEqual({
      displayName: 'claude-sonnet-4-6',
      providerName: 'sub2api-group-pro',
    });
  });
});
