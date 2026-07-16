import { CURRENT_ONBOARDING_VERSION, INBOX_SESSION_ID } from '@lobechat/const';
import { serverDB } from '@lobechat/database';
import {
  account,
  agents,
  agentsToSessions,
  aiModels,
  aiProviders,
  sessions,
  users,
  userSettings,
} from '@lobechat/database/schemas';
import { MAX_ONBOARDING_STEPS } from '@lobechat/types';
import { and, eq, isNull, like, notInArray, sql } from 'drizzle-orm';

import { SessionModel } from '@/database/models/session';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';

interface Sub2ApiModel {
  display_name: string;
  id: string;
}

interface Sub2ApiProvider {
  api_key: string;
  base_url: string;
  display_name: string;
  id: string;
  models: Sub2ApiModel[];
  sdk_type: 'anthropic' | 'google' | 'openai';
}

interface Sub2ApiConfig {
  providers: Sub2ApiProvider[];
  user_id: string;
}

interface DefaultModelConfig {
  model: string;
  provider: string;
}

interface PreparedSub2ApiProvider {
  encryptedKeyVaults: string;
  models: Sub2ApiModel[];
  provider: Sub2ApiProvider;
  providerId: string;
}

type ProvisionScheduler = (task: () => Promise<void>) => void;

interface RefreshSub2ApiOptions {
  deferWhenConfigured?: ProvisionScheduler;
}

export type RefreshSub2ApiResult = 'completed' | 'deferred';

const SUB2API_PROVIDER_PREFIX = 'sub2api-';
const SUB2API_OIDC_PROVIDER = 'generic-oidc';
const inFlightProvisions = new Map<string, Promise<void>>();
const DEFAULT_MODEL_PRIORITY: Record<Sub2ApiProvider['sdk_type'], string[]> = {
  anthropic: [
    'claude-sonnet-4-6',
    'claude-sonnet-4-5',
    'claude-sonnet-4',
    'claude-3-7-sonnet',
    'claude-3-5-sonnet',
    'claude-opus-4',
    'claude-3-opus',
    'claude-3-haiku',
  ],
  google: [
    'gemini-3.1-pro',
    'gemini-3-pro',
    'gemini-2.5-pro',
    'gemini-3.1-flash',
    'gemini-3-flash',
    'gemini-2.5-flash',
  ],
  openai: ['gpt-5.2', 'gpt-5.1', 'gpt-5', 'gpt-4.1', 'gpt-4o', 'o3', 'o4-mini'],
};

const getSub2ApiEnv = () => {
  const internalUrl = process.env.SUB2API_INTERNAL_URL?.replace(/\/+$/, '');
  const internalSecret = process.env.SUB2API_INTERNAL_SECRET;

  return { internalSecret, internalUrl };
};

export const normalizeSub2ApiProviderId = (providerId: string) => {
  const trimmedId = providerId.trim();
  if (!trimmedId) return '';

  return trimmedId.startsWith(SUB2API_PROVIDER_PREFIX)
    ? trimmedId
    : `${SUB2API_PROVIDER_PREFIX}${trimmedId}`;
};

export async function provisionSub2ApiFromAccount(
  authAccount: {
    accountId?: string | null;
    providerId?: string | null;
    userId?: string | null;
  },
  options: RefreshSub2ApiOptions = {},
) {
  if (authAccount.providerId !== SUB2API_OIDC_PROVIDER) return;
  if (!authAccount.userId || !authAccount.accountId) return;

  try {
    await refreshSub2ApiConfig(authAccount.userId, authAccount.accountId, options);
  } catch (error) {
    console.error('[sub2api-provision] failed after account hook', error);
  }
}

export async function hasSub2ApiConfig(lobeUserId: string) {
  const [provider] = await serverDB
    .select({ id: aiProviders.id })
    .from(aiProviders)
    .where(
      and(
        eq(aiProviders.userId, lobeUserId),
        like(aiProviders.id, `${SUB2API_PROVIDER_PREFIX}%`),
        isNull(aiProviders.workspaceId),
      ),
    )
    .limit(1);

  return !!provider;
}

export async function refreshSub2ApiConfig(
  lobeUserId: string,
  sub2apiUserId: string,
  options: RefreshSub2ApiOptions = {},
): Promise<RefreshSub2ApiResult> {
  if (options.deferWhenConfigured && (await hasSub2ApiConfig(lobeUserId))) {
    options.deferWhenConfigured(async () => {
      try {
        await provisionFromSub2Api(lobeUserId, sub2apiUserId);
      } catch (error) {
        console.error('[sub2api-provision] deferred refresh failed', error);
      }
    });

    return 'deferred';
  }

  await provisionFromSub2Api(lobeUserId, sub2apiUserId);
  return 'completed';
}

export function provisionFromSub2Api(lobeUserId: string, sub2apiUserId: string) {
  const taskKey = `${lobeUserId}:${sub2apiUserId}`;
  const inFlight = inFlightProvisions.get(taskKey);
  if (inFlight) return inFlight;

  const task = runSub2ApiProvision(lobeUserId, sub2apiUserId).finally(() => {
    if (inFlightProvisions.get(taskKey) === task) inFlightProvisions.delete(taskKey);
  });
  inFlightProvisions.set(taskKey, task);

  return task;
}

async function runSub2ApiProvision(lobeUserId: string, sub2apiUserId: string) {
  const { internalSecret, internalUrl } = getSub2ApiEnv();
  if (!internalUrl || !internalSecret) return;

  let res: Response;
  try {
    res = await fetch(`${internalUrl}/internal/v1/users/${sub2apiUserId}/lobe-config`, {
      headers: { Authorization: `Bearer ${internalSecret}` },
      cache: 'no-store',
    });
  } catch (error) {
    console.error('[sub2api-provision] failed to fetch config', error);
    return;
  }

  if (!res.ok) {
    console.error('[sub2api-provision] failed to fetch config', res.status, await res.text());
    return;
  }

  const config = (await res.json()) as Sub2ApiConfig;
  const seenProviderIds = new Set<string>();
  const providers = (config.providers ?? []).flatMap((provider) => {
    const providerId = normalizeSub2ApiProviderId(provider.id);
    const models = [
      ...new Map(
        provider.models.filter((model) => model.id).map((model) => [model.id, model]),
      ).values(),
    ];

    if (
      !providerId ||
      seenProviderIds.has(providerId) ||
      !provider.api_key ||
      !provider.base_url ||
      models.length === 0
    ) {
      return [];
    }

    seenProviderIds.add(providerId);
    return [{ models, provider, providerId }];
  });
  const gateKeeper = providers.length > 0 ? await KeyVaultsGateKeeper.initWithEnvKey() : undefined;
  const preparedProviders: PreparedSub2ApiProvider[] = gateKeeper
    ? await Promise.all(
        providers.map(async ({ models, provider, providerId }) => ({
          encryptedKeyVaults: await gateKeeper.encrypt(
            JSON.stringify({ apiKey: provider.api_key, baseURL: provider.base_url }),
          ),
          models,
          provider,
          providerId,
        })),
      )
    : [];
  let defaultModelConfig: DefaultModelConfig | undefined;
  const validModelIdsByProvider = new Map<string, Set<string>>();
  const validProviderIds = preparedProviders.map(({ providerId }) => providerId);

  for (const { models, provider, providerId } of preparedProviders) {
    defaultModelConfig ??= pickDefaultModel({ ...provider, models }, providerId);
    validModelIdsByProvider.set(providerId, new Set(models.map(({ id }) => id)));
  }

  await serverDB.transaction(async (tx) => {
    const now = new Date();
    if (preparedProviders.length > 0) {
      await tx
        .insert(aiProviders)
        .values(
          preparedProviders.map(({ encryptedKeyVaults, models, provider, providerId }) => ({
            checkModel: models[0]?.id,
            enabled: true,
            id: providerId,
            keyVaults: encryptedKeyVaults,
            name: provider.display_name,
            settings: { sdkType: provider.sdk_type },
            source: 'custom' as const,
            userId: lobeUserId,
          })),
        )
        .onConflictDoUpdate({
          set: {
            checkModel: sql`excluded.check_model`,
            enabled: sql`excluded.enabled`,
            keyVaults: sql`excluded.key_vaults`,
            name: sql`excluded.name`,
            settings: sql`excluded.settings`,
            source: sql`excluded.source`,
            updatedAt: now,
          },
          target: [aiProviders.id, aiProviders.userId],
          targetWhere: isNull(aiProviders.workspaceId),
        });

      await tx
        .insert(aiModels)
        .values(
          preparedProviders.flatMap(({ models, providerId }) =>
            models.map((model) => ({
              displayName: sub2ApiModelDisplayName(model),
              enabled: true,
              id: model.id,
              providerId,
              source: 'custom' as const,
              type: 'chat' as const,
              userId: lobeUserId,
            })),
          ),
        )
        .onConflictDoUpdate({
          set: {
            displayName: sql`excluded.display_name`,
            enabled: sql`excluded.enabled`,
            source: sql`excluded.source`,
            updatedAt: now,
          },
          target: [aiModels.id, aiModels.providerId, aiModels.userId],
          targetWhere: isNull(aiModels.workspaceId),
        });
    }

    for (const { models, providerId } of preparedProviders) {
      const validModelIds = models.map(({ id }) => id);
      if (validModelIds.length > 0) {
        await tx
          .delete(aiModels)
          .where(
            and(
              eq(aiModels.userId, lobeUserId),
              eq(aiModels.providerId, providerId),
              notInArray(aiModels.id, validModelIds),
            ),
          );
      }
    }

    const sub2apiProviderFilter = and(
      eq(aiProviders.userId, lobeUserId),
      like(aiProviders.id, `${SUB2API_PROVIDER_PREFIX}%`),
    );

    if (validProviderIds.length > 0) {
      await tx
        .delete(aiModels)
        .where(
          and(
            eq(aiModels.userId, lobeUserId),
            like(aiModels.providerId, `${SUB2API_PROVIDER_PREFIX}%`),
            notInArray(aiModels.providerId, validProviderIds),
          ),
        );

      await tx
        .delete(aiProviders)
        .where(and(sub2apiProviderFilter, notInArray(aiProviders.id, validProviderIds)));
    } else {
      await tx
        .delete(aiModels)
        .where(
          and(
            eq(aiModels.userId, lobeUserId),
            like(aiModels.providerId, `${SUB2API_PROVIDER_PREFIX}%`),
          ),
        );

      await tx.delete(aiProviders).where(sub2apiProviderFilter);
    }

    if (defaultModelConfig) {
      const now = new Date();
      const finishedAt = now.toISOString();

      await tx
        .update(users)
        .set({
          isOnboarded: true,
          onboarding: {
            currentStep: MAX_ONBOARDING_STEPS,
            finishedAt,
            version: CURRENT_ONBOARDING_VERSION,
          },
          updatedAt: now,
        })
        .where(eq(users.id, lobeUserId));

      const [existingSettings] = await tx
        .select({ defaultAgent: userSettings.defaultAgent })
        .from(userSettings)
        .where(eq(userSettings.id, lobeUserId))
        .limit(1);

      const prevDefaultAgent = (existingSettings?.defaultAgent || {}) as Record<string, any>;
      const prevConfig = (prevDefaultAgent.config || {}) as Record<string, any>;
      const preservedModelConfig = pickPreservedModelConfig(prevConfig, validModelIdsByProvider);
      const nextModelConfig = preservedModelConfig || defaultModelConfig;
      const nextDefaultAgent = {
        ...prevDefaultAgent,
        config: {
          ...prevConfig,
          model: nextModelConfig.model,
          provider: nextModelConfig.provider,
        },
      };

      await tx
        .insert(userSettings)
        .values({
          defaultAgent: nextDefaultAgent,
          id: lobeUserId,
        })
        .onConflictDoUpdate({
          set: { defaultAgent: nextDefaultAgent },
          target: userSettings.id,
        });
    }
  });

  if (defaultModelConfig) {
    await new SessionModel(serverDB, lobeUserId).createInbox({
      model: defaultModelConfig.model,
      provider: defaultModelConfig.provider,
    });

    await updateInboxAgentConfig(lobeUserId, defaultModelConfig, validModelIdsByProvider);
  }
}

const updateInboxAgentConfig = async (
  lobeUserId: string,
  defaultModelConfig: DefaultModelConfig,
  validModelIdsByProvider: Map<string, Set<string>>,
) => {
  const now = new Date();

  const updateAgentIfNeeded = async (agentId?: string) => {
    const where = agentId
      ? and(eq(agents.userId, lobeUserId), eq(agents.id, agentId))
      : and(eq(agents.userId, lobeUserId), eq(agents.slug, INBOX_SESSION_ID));

    const [currentAgent] = await serverDB
      .select({ model: agents.model, provider: agents.provider })
      .from(agents)
      .where(where)
      .limit(1);
    if (!currentAgent) return;
    if (pickPreservedModelConfig(currentAgent, validModelIdsByProvider)) return;
    if (currentAgent.provider && !currentAgent.provider.startsWith(SUB2API_PROVIDER_PREFIX)) return;

    await serverDB
      .update(agents)
      .set({
        model: defaultModelConfig.model,
        provider: defaultModelConfig.provider,
        updatedAt: now,
      })
      .where(where);
  };

  await updateAgentIfNeeded();

  const inboxSession = await serverDB.query.sessions.findFirst({
    columns: { id: true },
    where: and(eq(sessions.userId, lobeUserId), eq(sessions.slug, INBOX_SESSION_ID)),
  });
  if (!inboxSession) return;

  const [link] = await serverDB
    .select({ agentId: agentsToSessions.agentId })
    .from(agentsToSessions)
    .where(
      and(eq(agentsToSessions.userId, lobeUserId), eq(agentsToSessions.sessionId, inboxSession.id)),
    )
    .limit(1);
  if (!link?.agentId) return;

  await updateAgentIfNeeded(link.agentId);
};

const pickPreservedModelConfig = (
  config: Record<string, any>,
  validModelIdsByProvider: Map<string, Set<string>>,
): DefaultModelConfig | undefined => {
  const provider = typeof config.provider === 'string' ? config.provider : undefined;
  const model = typeof config.model === 'string' ? config.model : undefined;
  if (!provider || !model) return;
  if (!validModelIdsByProvider.get(provider)?.has(model)) return;

  return { model, provider };
};

const pickDefaultModel = (
  provider: Sub2ApiProvider,
  providerId = normalizeSub2ApiProviderId(provider.id),
): DefaultModelConfig | undefined => {
  const models = provider.models.map((item) => item.id).filter(Boolean);
  const priority = DEFAULT_MODEL_PRIORITY[provider.sdk_type] || [];
  const model =
    priority.flatMap((keyword) => models.filter((id) => id.includes(keyword))).at(0) || models[0];
  if (!model) return;

  return { model, provider: providerId };
};

const sub2ApiModelDisplayName = (model: Sub2ApiModel) => model.display_name || model.id;

export async function findLobeUserIdBySub2ApiUserId(sub2apiUserId: string) {
  const row = await serverDB.query.account.findFirst({
    where: and(eq(account.providerId, SUB2API_OIDC_PROVIDER), eq(account.accountId, sub2apiUserId)),
  });

  return row?.userId;
}
