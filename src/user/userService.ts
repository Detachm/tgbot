import type { User } from "../domain/types.js";
import type { Language } from "../domain/types.js";
import type { MemoryStore } from "../db/memoryStore.js";

const defaultRiskProfile = {
  riskPercent: 3,
  maxLeverage: 10,
  dailyTradeLimit: 10,
  dailyRiskLimitPercent: 15,
  allowAddPosition: false,
};

export class UserService {
  constructor(private readonly store: MemoryStore) {}

  getOrCreateUser(input: { telegramId: number; username?: string }): User {
    const existing = this.store.users.get(input.telegramId);
    if (existing) {
      return existing;
    }

    const user: User = {
      telegramId: input.telegramId,
      username: input.username,
      bindingStatus: "unbound",
      riskProfile: { ...defaultRiskProfile },
      createdAt: new Date(),
    };

    this.store.users.set(user.telegramId, user);
    this.store.addAudit({
      actorTelegramId: user.telegramId,
      action: "user.created",
      entityType: "user",
      entityId: String(user.telegramId),
      metadata: { bindingStatus: user.bindingStatus },
    });

    return user;
  }

  bindDemoAccount(telegramId: number): User {
    const user = this.getOrCreateUser({ telegramId });
    user.bindingStatus = "bound";
    this.store.users.set(telegramId, user);
    this.store.addAudit({
      actorTelegramId: telegramId,
      action: "user.demo_bound",
      entityType: "user",
      entityId: String(telegramId),
      metadata: { mode: "partial", secretStored: false },
    });
    return user;
  }

  setLanguage(telegramId: number, language: Language): User {
    const user = this.getOrCreateUser({ telegramId });
    user.language = language;
    this.store.users.set(telegramId, user);
    this.store.addAudit({
      actorTelegramId: telegramId,
      action: "user.language_set",
      entityType: "user",
      entityId: String(telegramId),
      metadata: { language },
    });
    return user;
  }
}
