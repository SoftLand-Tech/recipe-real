/**
 * Settings (language, logout, delete account) — OWNED BY SLICE ACCOUNT
 * (stub wired by foundation). Deliberately NOT auth-gated: like the mobile
 * app, it renders a signed-out state (language + sign-in entry) for anon
 * visitors. Replace this file's contents only.
 */
import { Placeholder } from "@/components/Placeholder";

export default function SettingsPage() {
  return <Placeholder titleKey="settings.pageTitle" />;
}
