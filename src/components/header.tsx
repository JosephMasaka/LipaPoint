interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <div className="border-b border-border bg-surface/80 backdrop-blur-sm px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pt-14 lg:pt-6">
      <h1 className="text-xl sm:text-2xl font-bold text-text-primary">{title}</h1>
      {subtitle && (
        <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
      )}
    </div>
  );
}
