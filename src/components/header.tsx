interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <div className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm px-8 py-6">
      <h1 className="text-2xl font-bold text-zinc-100">{title}</h1>
      {subtitle && (
        <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
      )}
    </div>
  );
}
