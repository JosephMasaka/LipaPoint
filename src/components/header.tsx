interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <div className="border-b border-border bg-surface/80 backdrop-blur-sm px-4 sm:px-6 lg:px-8 py-4 pt-12 lg:pt-5 shrink-0 sticky top-0 z-10">
      <h1 className="text-lg sm:text-2xl font-bold text-text-primary">{title}</h1>
      {subtitle && (
        <p className="mt-0.5 text-xs sm:text-sm text-text-secondary">{subtitle}</p>
      )}
    </div>
  );
}
