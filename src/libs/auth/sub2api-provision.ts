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
import { and, eq, isNull, like, notInArray } from 'drizzle-orm';

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

const SUB2API_PROVIDER_PREFIX = 'sub2api-';
const SUB2API_OIDC_PROVIDER = 'generic-oidc';
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

export async function provisionSub2ApiFromAccount(authAccount: {
  accountId?: string | null;
  providerId?: string | null;
  userId?: string | null;
}) {
  if (authAccount.providerId !== SUB2API_OIDC_PROVIDER) return;
  if (!authAccount.userId || !authAccount.accountId) return;

  try {
    await provisionFromSub2Api(authAccount.userId, authAccount.accountId);
  } catch (error) {
    console.error('[sub2api-provision] failed after account hook', error);
  }
}

export async function provisionFromSub2Api(lobeUserId: string, sub2apiUserId: string) {
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
  const gateKeeper = await KeyVaultsGateKeeper.initWithEnvKey();
  let defaultModelConfig: DefaultModelConfig | undefined;
  const validModelIdsByProvider = new Map<string, Set<string>>();

  await serverDB.transaction(async (tx) => {
    const validProviderIds: string[] = [];

    for (const p of config.providers) {
      const providerId = normalizeSub2ApiProviderId(p.id);
      if (!providerId || !p.api_key || !p.base_url || p.models.length === 0) continue;

      validProviderIds.push(providerId);
      defaultModelConfig ??= pickDefaultModel(p, providerId);
      const encryptedKeyVaults = await gateKeeper.encrypt(
        JSON.stringify({ apiKey: p.api_key, baseURL: p.base_url }),
      );

      await tx
        .insert(aiProviders)
        .values({
          checkModel: p.models[0]?.id,
          enabled: true,
          id: providerId,
          keyVaults: encryptedKeyVaults,
          name: p.display_name,
          settings: { sdkType: p.sdk_type },
          source: 'custom',
          userId: lobeUserId,
        })
        .onConflictDoUpdate({
          set: {
            checkModel: p.models[0]?.id,
            enabled: true,
            keyVaults: encryptedKeyVaults,
            name: p.display_name,
            settings: { sdkType: p.sdk_type },
            source: 'custom',
            updatedAt: new Date(),
          },
          target: [aiProviders.id, aiProviders.userId],
          targetWhere: isNull(aiProviders.workspaceId),
        });

      const validModelIds: string[] = [];
      for (const m of p.models) {
        if (!m.id) continue;
        const modelDisplayName = sub2ApiModelDisplayName(m);
        validModelIds.push(m.id);
        await tx
          .insert(aiModels)
          .values({
            displayName: modelDisplayName,
            enabled: true,
            id: m.id,
            providerId,
            source: 'custom',
            type: 'chat',
            userId: lobeUserId,
          })
          .onConflictDoUpdate({
            set: {
              displayName: modelDisplayName,
              enabled: true,
              source: 'custom',
              updatedAt: new Date(),
            },
            target: [aiModels.id, aiModels.providerId, aiModels.userId],
            targetWhere: isNull(aiModels.workspaceId),
          });
      }
      validModelIdsByProvider.set(providerId, new Set(validModelIds));

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
