import { type ListItem } from './types';

export const menuKey = (provider: string, model: string) => `${provider}-${model}`;

export const normalizeModelDisplayName = (
  displayName: string | undefined,
  modelId: string,
  providerName?: string,
): string => {
  const resolvedName = displayName || modelId;
  if (!providerName) return resolvedName;

  const redundantPrefix = `${providerName} / `;
  return resolvedName.startsWith(redundantPrefix)
    ? resolvedName.slice(redundantPrefix.length)
    : resolvedName;
};

export const getListItemKey = (item: ListItem): string => {
  switch (item.type) {
    case 'model-item-single':
    case 'model-item-multiple': {
      return item.data.model.id;
    }
    case 'provider-model-item': {
      return menuKey(item.provider.id, item.model.id);
    }
    case 'group-header': {
      return `header-${item.provider.id}`;
    }
    case 'empty-model': {
      return `empty-${item.provider.id}`;
    }
    case 'no-provider': {
      return 'no-provider';
    }
  }
};
