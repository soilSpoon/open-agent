import { ThemeToggle } from "@/components/theme-toggle";

export function Header() {
  return (
    <header className="hidden h-14 items-center gap-4 border-b bg-muted/40 px-6 md:flex md:h-[60px] md:px-6">
      <div className="w-full flex-1">
        <h1 className="text-lg font-semibold">OpenAgent</h1>
      </div>
      <ThemeToggle />
    </header>
  );
}
