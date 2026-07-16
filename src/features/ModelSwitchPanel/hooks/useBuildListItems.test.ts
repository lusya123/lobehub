/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import type { AiModelForSelect } from 'model-bank';
import { describe, expect, it } from 'vitest';

import type { EnabledProviderWithModels } from '@/types/aiProvider';

import { getListItemKey } from '../utils';
import { useBuildListItems } from './useBuildListItems';

const createModel = (id: string, displayName: string): AiModelForSelect =>
  ({
    abilities: {},
    displayName,
    id,
    type: 'chat',
  }) as AiModelForSelect;

describe('useBuildListItems', () => {
  it('deduplicates the same model id across groups and removes stale group prefixes', () => {
    const enabledList: EnabledProviderWithModels[] = [
      {
        children: [createModel('claude-sonnet-4-6', 'Light / Claude Sonnet 4.6')],
        id: 'sub2api-group-light',
        name: 'Light',
        source: 'custom',
      },
      {
        children: [createModel('claude-sonnet-4-6', 'Pro / Claude Sonnet 4.6')],
        id: 'sub2api-group-pro',
        name: 'Pro',
        source: 'custom',
      },
      {
        children: [createModel('claude-sonnet-4-6', 'AWS / Claude Sonnet 4.6')],
        id: 'sub2api-group-aws',
        name: 'AWS',
        source: 'custom',
      },
    ];

    const { result } = renderHook(() => useBuildListItems(enabledList, 'byModel'));

    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toMatchObject({
      data: {
        displayName: 'Claude Sonnet 4.6',
        model: {
          displayName: 'Claude Sonnet 4.6',
          id: 'claude-sonnet-4-6',
        },
        providers: [
          { id: 'sub2api-group-light', name: 'Light' },
          { id: 'sub2api-group-pro', name: 'Pro' },
          { id: 'sub2api-group-aws', name: 'AWS' },
        ],
      },
      type: 'model-item-multiple',
    });
    expect(getListItemKey(result.current[0])).toBe('claude-sonnet-4-6');
  });

  it('keeps models with different ids separate even when their display names match', () => {
    const enabledList: EnabledProviderWithModels[] = [
      {
        children: [createModel('model-v1', 'Shared Name')],
        id: 'provider-a',
        name: 'Provider A',
        source: 'custom',
      },
      {
        children: [createModel('model-v2', 'Shared Name')],
        id: 'provider-b',
        name: 'Provider B',
        source: 'custom',
      },
    ];

    const { result } = renderHook(() => useBuildListItems(enabledList, 'byModel'));

    expect(result.current).toHaveLength(2);
    expect(result.current.map(getListItemKey)).toEqual(['model-v1', 'model-v2']);
    expect(result.current.every((item) => item.type === 'model-item-single')).toBe(true);
  });

  it('supports finding a model by its group name', () => {
    const enabledList: EnabledProviderWithModels[] = [
      {
        children: [createModel('claude-sonnet-4-6', 'Claude Sonnet 4.6')],
        id: 'sub2api-group-light',
        name: 'Light',
        source: 'custom',
      },
      {
        children: [createModel('claude-sonnet-4-6', 'Claude Sonnet 4.6')],
        id: 'sub2api-group-pro',
        name: 'Pro',
        source: 'custom',
      },
    ];

    const { result } = renderHook(() => useBuildListItems(enabledList, 'byModel', 'pro'));

    expect(result.current).toMatchObject([
      {
        data: {
          displayName: 'Claude Sonnet 4.6',
          providers: [{ id: 'sub2api-group-pro', name: 'Pro' }],
        },
        type: 'model-item-single',
      },
    ]);
  });

  it('removes legacy group prefixes in provider-grouped developer mode too', () => {
    const enabledList: EnabledProviderWithModels[] = [
      {
        children: [createModel('claude-sonnet-4-6', 'Pro / Claude Sonnet 4.6')],
        id: 'sub2api-group-pro',
        name: 'Pro',
        source: 'custom',
      },
    ];

    const { result } = renderHook(() => useBuildListItems(enabledList, 'byProvider'));

    expect(result.current).toMatchObject([
      { provider: { id: 'sub2api-group-pro', name: 'Pro' }, type: 'group-header' },
      {
        model: { displayName: 'Claude Sonnet 4.6', id: 'claude-sonnet-4-6' },
        provider: { id: 'sub2api-group-pro', name: 'Pro' },
        type: 'provider-model-item',
      },
    ]);
  });
});
