import Link from "next/link";
import { getNewsCategories } from "@/lib/news";

export function NewsNav({ active }: { active?: string }) {
  const cats = getNewsCategories();
  return (
    <nav className="flex flex-wrap gap-2" aria-label="News categories">
      {cats.map((c) => {
        const href = c.id === "latest" ? "/news" : `/news/category/${c.id}`;
        const isActive = active === c.id;
        return (
          <Link
            key={c.id}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "border-[#0b3d2e] bg-[#0b3d2e] text-white"
                : "border-[#e0dbcf] bg-white text-[#3c4a41] hover:border-[#14734f] hover:text-[#14734f]"
            }`}
          >
            {c.short}
          </Link>
        );
      })}
    </nav>
  );
}
