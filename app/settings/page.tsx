import { LanguageSettings } from "@/components/settings/language-settings";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your application settings.
        </p>
      </div>
      <div className="grid gap-10">
        <LanguageSettings />
      </div>
    </div>
  );
}
