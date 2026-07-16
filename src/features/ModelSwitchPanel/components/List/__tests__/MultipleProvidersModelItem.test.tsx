/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { AiModelForSelect } from 'model-bank';
import type { HTMLAttributes, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { MultipleProvidersModelItem } from '../MultipleProvidersModelItem';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@lobehub/ui', () => ({
  DropdownMenuGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuGroupLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  DropdownMenuItemIcon: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  DropdownMenuItemLabel: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  DropdownMenuPopup: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DropdownMenuPortal: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuPositioner: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuSubmenuRoot: ({ children, open }: { children: ReactNode; open?: boolean }) => (
    <div data-open={String(open)} data-testid="submenu-root">
      {children}
    </div>
  ),
  DropdownMenuSubmenuTrigger: ({
    children,
    className,
    onClick,
    style,
  }: HTMLAttributes<HTMLDivElement>) => (
    <div className={className} style={style} onClick={onClick}>
      {children}
    </div>
  ),
  Flexbox: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
  Tag: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  menuSharedStyles: { item: 'item' },
}));

vi.mock('@/components/ModelSelect', () => ({
  ModelItemRender: ({
    displayName,
    proBadgeLabel,
  }: {
    displayName: string;
    proBadgeLabel?: string;
  }) => (
    <div>
      {displayName}
      {proBadgeLabel && <span data-testid="model-pro-badge">{proBadgeLabel}</span>}
    </div>
  ),
  ProviderItemRender: ({ name }: { name: string }) => <div>{name}</div>,
}));

vi.mock('../../ModelDetailPanel', () => ({
  default: ({ model, provider }: { model: string; provider: string }) => (
    <div data-testid="model-detail-panel">
      {provider}/{model}
    </div>
  ),
}));

describe('MultipleProvidersModelItem', () => {
  it('renders model detail panel even when info tags are hidden', () => {
    render(
      <MultipleProvidersModelItem
        activeKey="lobehub-gpt-5.4"
        newLabel="new"
        showInfoTag={false}
        data={{
          displayName: 'GPT-5.4',
          model: {
            abilities: {},
            displayName: 'GPT-5.4',
            id: 'gpt-5.4',
          } as AiModelForSelect,
          providers: [
            { id: 'lobehub', name: 'LobeHub' },
            { id: 'openai', name: 'OpenAI' },
          ],
        }}
        onClose={vi.fn()}
        onModelChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('model-detail-panel')).toHaveTextContent('lobehub/gpt-5.4');
    expect(screen.getByText('ModelSwitchPanel.useModelFrom')).toBeInTheDocument();
    expect(screen.getAllByText('LobeHub')).toHaveLength(2);
  });

  it('does not silently select the first provider when the model row is clicked', () => {
    const onClose = vi.fn();
    const onModelChange = vi.fn();
    const onRestrictedModelClick = vi.fn();

    render(
      <MultipleProvidersModelItem
        activeKey="anthropic-claude-opus-4-7"
        newLabel="new"
        proLabel="pro"
        showInfoTag={false}
        data={{
          displayName: 'Claude Opus 4.7',
          model: {
            abilities: {},
            displayName: 'Claude Opus 4.7',
            id: 'claude-opus-4-7',
          } as AiModelForSelect,
          providers: [
            { id: 'lobehub', name: 'LobeHub' },
            { id: 'anthropic', name: 'Anthropic' },
          ],
        }}
        isModelRestricted={(modelId, providerId) =>
          modelId === 'claude-opus-4-7' && providerId === 'lobehub'
        }
        onClose={onClose}
        onModelChange={onModelChange}
        onRestrictedModelClick={onRestrictedModelClick}
      />,
    );

    fireEvent.click(screen.getByText('Claude Opus 4.7'));

    expect(onRestrictedModelClick).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(onModelChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('submenu-root')).toHaveAttribute('data-open', 'true');
  });

  it('selects only the provider explicitly clicked by the user', () => {
    const onClose = vi.fn();
    const onModelChange = vi.fn();

    render(
      <MultipleProvidersModelItem
        activeKey="other-model"
        newLabel="new"
        showInfoTag={false}
        data={{
          displayName: 'Claude Sonnet 4.6',
          model: {
            abilities: {},
            displayName: 'Claude Sonnet 4.6',
            id: 'claude-sonnet-4-6',
          } as AiModelForSelect,
          providers: [
            { id: 'sub2api-group-light', name: 'Light' },
            { id: 'sub2api-group-pro', name: 'Pro' },
          ],
        }}
        onClose={onClose}
        onModelChange={onModelChange}
      />,
    );

    fireEvent.click(screen.getByText('Pro'));

    expect(onModelChange).toHaveBeenCalledWith('claude-sonnet-4-6', 'sub2api-group-pro');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses the restricted handler when every provider is restricted', () => {
    const onClose = vi.fn();
    const onModelChange = vi.fn();
    const onRestrictedModelClick = vi.fn();

    render(
      <MultipleProvidersModelItem
        activeKey="other-model"
        isModelRestricted={() => true}
        newLabel="new"
        proLabel="pro"
        showInfoTag={false}
        data={{
          displayName: 'Claude Opus 4.7',
          model: {
            abilities: {},
            displayName: 'Claude Opus 4.7',
            id: 'claude-opus-4-7',
          } as AiModelForSelect,
          providers: [
            { id: 'lobehub', name: 'LobeHub' },
            { id: 'anthropic', name: 'Anthropic' },
          ],
        }}
        onClose={onClose}
        onModelChange={onModelChange}
        onRestrictedModelClick={onRestrictedModelClick}
      />,
    );

    fireEvent.click(screen.getByText('Claude Opus 4.7'));

    expect(onRestrictedModelClick).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onModelChange).not.toHaveBeenCalled();
  });
});
