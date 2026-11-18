"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DiscoverIcon, InboxIcon, PlusIcon, ProfileIcon, TripsIcon } from "@/components/icons";
import { APP_NAME } from "@/lib/config";

const ITEMS = [
  { href: "/", label: "Discover", Icon: DiscoverIcon },
  { href: "/trips", label: "My trips", Icon: TripsIcon },
  { href: "/inbox", label: "Inbox", Icon: InboxIcon },
  { href: "/profile", label: "Profile", Icon: ProfileIcon },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

export function Nav({ signedIn, isAdmin }: { signedIn: boolean; isAdmin: boolean }) {
  const path = usePathname();
  // An open chat owns the whole bottom edge on phones: the composer is never covered.
  const inChat = /^\/inbox\/[^/]+/.test(path);

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center gap-6 px-4">
          <Link href="/" className="font-display text-h2 font-bold tracking-[-0.03em]">
            {APP_NAME}
          </Link>
          {signedIn ? (
            <nav aria-label="Main" className="ml-auto hidden items-center gap-1 md:flex">
              {ITEMS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive(path, href) ? "page" : undefined}
                  className="rounded-full px-3 py-2 text-small font-medium text-ink-soft hover:text-ink aria-[current=page]:text-ink aria-[current=page]:underline"
                >
                  {label}
                </Link>
              ))}
              {isAdmin && (
                <Link href="/admin" className="rounded-full px-3 py-2 text-small font-medium text-ink-soft hover:text-ink">
                  Admin
                </Link>
              )}
              <Link href="/post" className="btn btn-primary ml-3">
                <PlusIcon className="size-4" /> Post a trip
              </Link>
            </nav>
          ) : (
            <Link href="/login" className="btn btn-quiet ml-auto">
              Sign in
            </Link>
          )}
          {signedIn && !inChat && (
            <Link href="/post" className="btn btn-primary ml-auto md:hidden" aria-label="Post a trip">
              <PlusIcon className="size-4" /> Post
            </Link>
          )}
        </div>
      </header>
      {signedIn && !inChat && (
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          <ul className="grid grid-cols-4">
            {ITEMS.map(({ href, label, Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={isActive(path, href) ? "page" : undefined}
                  className="flex min-h-14 flex-col items-center justify-center gap-1 text-micro font-medium text-ink-soft aria-[current=page]:text-ink"
                >
                  <Icon className="size-5" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}
