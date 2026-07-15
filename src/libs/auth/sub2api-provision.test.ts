import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const schemas = {
    account: {
      accountId: 'account.accountId',
      providerId: 'account.providerId',
    },
    agents: {
      id: 'agents.id',
      model: 'agents.model',
      provider: 'agents.provider',
      slug: 'agents.slug',
      userId: 'agents.userId',
    },
    agentsToSessions: {
      agentId: 'agentsToSessions.agentId',
      sessionId: 'agentsToSessions.sessionId',
      userId: 'agentsToSessions.userId',
    },
    aiModels: {
      id: 'aiModels.id',
      providerId: 'aiModels.providerId',
      userId: 'aiModels.userId',
      workspaceId: 'aiModels.workspaceId',
    },
    aiProviders: {
      id: 'aiProviders.id',
      userId: 'aiProviders.userId',
      workspaceId: 'aiProviders.workspaceId',
    },
    sessions: {
      slug: 'sessions.slug',
      userId: 'sessions.userId',
    },
    users: {
      id: 'users.id',
    },
    userSettings: {
      defaultAgent: 'userSettings.defaultAgent',
      id: 'userSettings.id',
    },
  };

  const state = {
    createInbox: vi.fn(),
    deletes: [] as any[],
    inserts: [] as any[],
    selects: [] as any[],
    tx: undefined as any,
    updates: [] as any[],
  };

  const createLimitChain = (result: any[] = []) => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(async () => result),
      })),
    })),
  });

  const createTx = () => ({
    delete: vi.fn((table) => ({
      where: vi.fn(async (condition) => {
        state.deletes.push({ condition, table });
      }),
    })),
    insert: vi.fn((table) => ({
      values: vi.fn((value) => {
        state.inserts.push({ table, value });

        return {
          onConflictDoUpdate: vi.fn(async (config) => {
            state.inserts.at(-1).onConflictDoUpdate = config;
          }),
        };
      }),
    })),
    select: vi.fn((selection) => {
      state.selects.push(selection);

      return createLimitChain([]);
    }),
    update: vi.fn((table) => ({
      set: vi.fn((value) => ({
        where: vi.fn(async (condition) => {
          state.updates.push({ condition, table, value });
        }),
      })),
    })),
  });

  const serverDB = {
    query: {
      account: {
        findFirst: vi.fn(),
      },
      sessions: {
        findFirst: vi.fn(async () => null),
      },
    },
    select: vi.fn((selection) => {
      state.selects.push(selection);

      return createLimitChain([]);
    }),
    transaction: vi.fn(async (callback) => {
      state.tx = createTx();

      return callback(state.tx);
    }),
    update: vi.fn((table) => ({
      set: vi.fn((value) => ({
        where: vi.fn(async (condition) => {
          state.updates.push({ condition, table, value });
        }),
      })),
    })),
  };

  return { schemas, serverDB, state };
});

vi.mock('@lobechat/const', () => ({
  CURRENT_ONBOARDING_VERSION: 1,
  INBOX_SESSION_ID: 'inbox',
}));

vi.mock('@lobechat/database', () => ({
  serverDB: mocks.serverDB,
}));

vi.mock('@lobechat/database/schemas', () => mocks.schemas);

vi.mock('@lobechat/types', () => ({
  MAX_ONBOARDING_STEPS: 6,
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args) => ({ args, op: 'and' })),
  eq: vi.fn((left, right) => ({ left, op: 'eq', right })),
  isNull: vi.fn((value) => ({ op: 'isNull', value })),
  like: vi.fn((left, right) => ({ left, op: 'like', right })),
  notInArray: vi.fn((left, right) => ({ left, op: 'notInArray', right })),
}));

vi.mock('@/database/models/session', () => ({
  SessionModel: vi.fn(() => ({
    createInbox: mocks.state.createInbox,
  })),
}));

vi.mock('@/server/modules/KeyVaultsEncrypt', () => ({
  KeyVaultsGateKeeper: {
    initWithEnvKey: vi.fn(async () => ({
      encrypt: vi.fn(async (value: string) => `encrypted:${value}`),
    })),
  },
}));

describe('sub2api provisioning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.deletes = [];
    mocks.state.inserts = [];
    mocks.state.selects = [];
    mocks.state.tx = undefined;
    mocks.state.updates = [];

    process.env.SUB2API_INTERNAL_URL = 'http://127.0.0.1:18080';
    process.env.SUB2API_INTERNAL_SECRET = 'internal-secret';
  });

  it('normalizes remote provider ids into the sub2api namespace', async () => {
    const { normalizeSub2ApiProviderId } = await import('./sub2api-provision');

    expect(normalizeSub2ApiProviderId('openai')).toBe('sub2api-openai');
    expect(normalizeSub2ApiProviderId('sub2api-openai')).toBe('sub2api-openai');
    expect(normalizeSub2ApiProviderId('  anthropic  ')).toBe('sub2api-anthropic');
  });

  it('stores unprefixed remote providers without colliding with user providers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            providers: [
              {
                api_key: 'sk-test',
                base_url: 'http://127.0.0.1:18080/v1',
                display_name: 'Sub2API OpenAI',
                id: 'openai',
                models: [{ display_name: 'GPT 5.1', id: 'gpt-5.1' }],
                sdk_type: 'openai',
              },
            ],
            user_id: 'sub2api-user',
          }),
          { status: 200 },
        );
      }),
    );

    const { provisionFromSub2Api } = await import('./sub2api-provision');

    await provisionFromSub2Api('lobe-user', 'sub2api-user');

    const providerInsert = mocks.state.inserts.find(
      ({ table }) => table === mocks.schemas.aiProviders,
    );
    const modelInsert = mocks.state.inserts.find(({ table }) => table === mocks.schemas.aiModels);

    expect(providerInsert.value).toMatchObject({
      id: 'sub2api-openai',
      userId: 'lobe-user',
    });
    expect(modelInsert.value).toMatchObject({
      id: 'gpt-5.1',
      providerId: 'sub2api-openai',
      userId: 'lobe-user',
    });
    expect(mocks.state.createInbox).toHaveBeenCalledWith({
      model: 'gpt-5.1',
      provider: 'sub2api-openai',
    });
    expect(providerInsert.value.id).not.toBe('openai');
    expect(providerInsert.onConflictDoUpdate.targetWhere).toEqual({
      op: 'isNull',
      value: mocks.schemas.aiProviders.workspaceId,
    });
    expect(modelInsert.onConflictDoUpdate.targetWhere).toEqual({
      op: 'isNull',
      value: mocks.schemas.aiModels.workspaceId,
    });
  });
});
