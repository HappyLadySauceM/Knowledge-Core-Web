import en from "@/messages/en.json";
import zhCN from "@/messages/zh-CN.json";

export const locales = ["zh-CN", "en"] as const;
export type Locale = (typeof locales)[number];
export function isLocale(value: string): value is Locale { return (locales as readonly string[]).includes(value); }
export function getMessages(locale: string) { return locale === "en" ? en : zhCN; }
