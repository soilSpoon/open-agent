import { ThemeToggle } from "@/components/theme-toggle";

export function Header() {
  return (
    <header className="hidden h-14 items-center gap-4 border-b bg-muted/40 px-6 lg:flex lg:h-[60px] lg:px-6">
      <div className="w-full flex-1">
        <h1 className="text-lg font-semibold">OpenAgent</h1>
      </div>
      <ThemeToggle />
    </header>
  );
}
