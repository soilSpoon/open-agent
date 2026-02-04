import { LanguageSettings } from "@/components/settings/language-settings";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your application settings and preferences.
        </p>
      </div>
      <div className="grid gap-6">
        <LanguageSettings />
      </div>
    </div>
  );
}
