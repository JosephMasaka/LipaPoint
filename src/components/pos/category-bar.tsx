"use client";

import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  color: string;
}

interface CategoryBarProps {
  categories: Category[];
  activeCategory: string;
  onSelect: (id: string) => void;
}

export function CategoryBar({ categories, activeCategory, onSelect }: CategoryBarProps) {
  return (
    <div className="flex gap-2 overflow-x-auto border-b border-zinc-800 bg-zinc-950 px-4 py-3 scrollbar-none">
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          className={cn(
            "flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200",
            activeCategory === cat.id
              ? "bg-zinc-800 text-zinc-100 border border-zinc-700"
              : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
          )}
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: cat.color }}
          />
          {cat.name}
        </button>
      ))}
    </div>
  );
}
