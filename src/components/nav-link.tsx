"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Active-aware header link. Mirrors bottom-nav logic: exact match for roots,
// prefix match otherwise. Sets aria-current="page" when active so styling can
// be done purely with Tailwind's `aria-[current=page]:` variant (reliable
// override, no class-order guessing).
export function isActivePath(pathname: string, href: string, exact = false) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLink({
  href,
  exact = false,
  className = "",
  onClick,
  children,
}: {
  href: string;
  exact?: boolean;
  className?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = isActivePath(pathname, href, exact);
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={className}
    >
      {children}
    </Link>
  );
}
