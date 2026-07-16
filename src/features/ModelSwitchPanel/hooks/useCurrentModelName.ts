import { useMemo } from 'react';

import { type EnabledProviderWithModels } from '@/types/aiProvider';

import { normalizeModelDisplayName } from '../utils';

interface CurrentModelInfo {
  displayName: string;
  providerName: string;
}

export const useCurrentModelInfo = (
  enabledList: EnabledProviderWithModels[],
  model: string,
  provider: string,
): CurrentModelInfo => {
  return useMemo(() => {
    const currentProvider = enabledList.find((item) => item.id === provider);
    const modelProvider =
      currentProvider ??
      enabledList.find((item) => item.children.some((child) => child.id === model));
    const currentModel = modelProvider?.children.find((item) => item.id === model);

    return {
      displayName: normalizeModelDisplayName(currentModel?.displayName, model, modelProvider?.name),
      providerName: currentProvider?.name || provider,
    };
  }, [enabledList, model, provider]);
};

export const useCurrentModelName = (
  enabledList: EnabledProviderWithModels[],
  model: string,
): string => {
  return useMemo(() => {
    for (const providerItem of enabledList) {
      const modelItem = providerItem.children.find((m) => m.id === model);
      if (modelItem) {
        return normalizeModelDisplayName(modelItem.displayName, modelItem.id, providerItem.name);
      }
    }
    return model;
  }, [enabledList, model]);
};
