import "dotenv/config";

function parseAdminIds(value: string | undefined): Set<number> {
  if (!value) {
    return new Set();
  }

  return new Set(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item)),
  );
}

export const config = {
  botToken: process.env.BOT_TOKEN ?? "",
  adminTelegramIds: parseAdminIds(process.env.ADMIN_TELEGRAM_IDS),
  registerUrl: process.env.L_BANK_REGISTER_URL ?? "https://www.lbank.com/",
};

export function requireBotToken(): string {
  if (!config.botToken) {
    throw new Error("BOT_TOKEN is required");
  }

  return config.botToken;
}

