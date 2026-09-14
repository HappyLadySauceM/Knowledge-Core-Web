"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  Globe2,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Trash2,
  Image as ImageIcon,
  type LucideIcon,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { SessionDataSchema, type SiteProfile } from "@/lib/api/types";
import { getMessages } from "@/lib/i18n";
import { StudioFolders } from "@/components/studio/studio-client";

const sidebarStorageKey = "knowledge-core:studio-sidebar-collapsed";

function sessionQuery() {
  return {
    queryKey: ["session"],
    queryFn: async () => {
      const response = await fetch("/api/bff/auth/session");
      if (!response.ok) throw new Error("session unavailable");
      return SessionDataSchema.parse(await response.json());
    },
    retry: false,
  } as const;
}

function routeLabel(pathname: string, labels: ReturnType<typeof getMessages>["backend"]) {
  if (pathname.includes("/media")) return labels.media;
  if (pathname.includes("/trash")) return labels.trash;
  if (pathname.includes("/documents/")) return labels.editor;
  if (pathname.includes("/admin")) return labels.admin;
  if (pathname.includes("/settings")) return labels.security;
  return labels.documents;
}

function buildQueryURL(pathname: string, searchParams: URLSearchParams) {
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function BackendNavLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      className={`backend-nav-link${active ? " active" : ""}`}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      onClick={onNavigate}
    >
      <Icon size={17} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}

export function BackendShell({ locale, profile, children }: { locale: string; profile?: SiteProfile; children: React.ReactNode }) {
  const t = getMessages(locale);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const session = useQuery(sessionQuery());
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const storageReady = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const currentSearch = searchParams.get("q") ?? "";
  const selectedFolder = searchParams.get("folder") ?? undefined;
  const [searchValue, setSearchValue] = useState(currentSearch);
  const isDocumentList = pathname === `/${locale}/studio`;
  const user = session.data?.user;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem(sidebarStorageKey);
      setCollapsed(saved === "true");
      storageReady.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!storageReady.current) return;
    window.localStorage.setItem(sidebarStorageKey, String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchValue(currentSearch), 0);
    return () => window.clearTimeout(timer);
  }, [currentSearch]);

  useEffect(() => {
    if (!isDocumentList || searchValue.trim() === currentSearch) return;
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      const value = searchValue.trim();
      if (value) next.set("q", value);
      else next.delete("q");
      next.delete("cursor");
      router.replace(buildQueryURL(pathname, next), { scroll: false });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [currentSearch, isDocumentList, pathname, router, searchParams, searchValue]);

  useEffect(() => {
    if (!notificationsOpen && !accountOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
        setAccountOpen(false);
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [accountOpen, notificationsOpen]);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  function toggleCollapsed() {
    setCollapsed((value) => !value);
    setNotificationsOpen(false);
    setAccountOpen(false);
  }

  function closeMobile() {
    setMobileOpen(false);
  }

  function updateFolder(folder?: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (folder) next.set("folder", folder);
    else next.delete("folder");
    next.delete("cursor");
    router.replace(buildQueryURL(pathname, next), { scroll: false });
    closeMobile();
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams(searchParams.toString());
    const value = searchValue.trim();
    if (value) next.set("q", value);
    else next.delete("q");
    next.delete("cursor");
    router.push(buildQueryURL(`/${locale}/studio`, next));
    closeMobile();
  }

  async function logout() {
    await fetch("/api/bff/auth/logout", { method: "POST" });
    router.push(`/${locale}`);
    router.refresh();
  }

  const docsActive = pathname === `/${locale}/studio` || pathname.startsWith(`/${locale}/studio/documents/`);
  const mediaActive = pathname === `/${locale}/studio/media`;
  const trashActive = pathname === `/${locale}/studio/trash`;
  const adminActive = pathname.startsWith(`/${locale}/admin`);
  const securityActive = pathname.startsWith(`/${locale}/settings`);
  const routeTitle = routeLabel(pathname, t.backend);
  const nextLocale = locale === "zh-CN" ? "en" : "zh-CN";
  const languagePath = `${pathname.replace(/^\/(zh-CN|en)/, `/${nextLocale}`)}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const sidebarClass = `backend-sidebar${collapsed ? " is-collapsed" : ""}${mobileOpen ? " is-mobile-open" : ""}`;

  return (
    <div className={`backend-shell${collapsed ? " sidebar-collapsed" : ""}`}>
      {mobileOpen ? <button className="backend-sidebar-scrim" type="button" aria-label={t.backend.closeMenu} onClick={closeMobile} /> : null}
      <aside className={sidebarClass} aria-label={t.backend.navigation}>
        <div className="backend-sidebar-header">
          <Link href={`/${locale}/studio`} className="backend-brand" title={collapsed ? `${profile?.title ?? "HappyLadySauce"} Studio` : undefined} onClick={closeMobile}>
            <span className="brand-mark">HS</span>
            <span className="backend-brand-copy"><strong>{profile?.title ?? "HappyLadySauce"}</strong><small>Studio</small></span>
          </Link>
          <button className="backend-collapse-button" type="button" onClick={toggleCollapsed} aria-label={collapsed ? t.backend.expand : t.backend.collapse} title={collapsed ? t.backend.expand : t.backend.collapse}>
            {collapsed ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}
          </button>
        </div>

        <nav className="backend-navigation">
          <p className="backend-nav-heading">{t.backend.workspace}</p>
          <BackendNavLink href={`/${locale}/studio`} label={t.studio.allDocuments} icon={FileText} active={docsActive} collapsed={collapsed} onNavigate={closeMobile} />
          <BackendNavLink href={`/${locale}/studio/media`} label={t.studio.mediaLibrary} icon={ImageIcon} active={mediaActive} collapsed={collapsed} onNavigate={closeMobile} />
          <BackendNavLink href={`/${locale}/studio/trash`} label={t.studio.trash} icon={Trash2} active={trashActive} collapsed={collapsed} onNavigate={closeMobile} />

          {user?.role === "admin" ? (
            <>
              <p className="backend-nav-heading backend-nav-heading-spaced">{t.backend.platform}</p>
              <BackendNavLink href={`/${locale}/admin`} label={t.backend.admin} icon={LayoutDashboard} active={adminActive} collapsed={collapsed} onNavigate={closeMobile} />
            </>
          ) : null}
        </nav>

        {isDocumentList && !collapsed ? (
          <section className="backend-folder-section" aria-label={t.studio.folders}>
            <p className="backend-nav-heading">{t.studio.folders}</p>
            <StudioFolders locale={locale} selected={selectedFolder} onSelect={updateFolder} />
          </section>
        ) : null}

        <div className="backend-sidebar-footer">
          <Link href={`/${locale}`} className="backend-footer-link" title={collapsed ? t.backend.publicSite : undefined} onClick={closeMobile}>
            <Globe2 size={16} aria-hidden="true" /><span>{t.backend.publicSite}</span>
          </Link>
          <Link href={`/${locale}/settings/security`} className={`backend-footer-link${securityActive ? " active" : ""}`} title={collapsed ? t.backend.security : undefined} onClick={closeMobile}>
            <ShieldCheck size={16} aria-hidden="true" /><span>{t.backend.security}</span>
          </Link>
        </div>
      </aside>

      <div className="backend-main">
        <header className="backend-topbar">
          <div className="backend-topbar-leading">
            <button className="backend-mobile-menu" type="button" aria-label={t.backend.openMenu} aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}>
              <Menu size={19} />
            </button>
            <div className="backend-breadcrumbs"><span>{t.backend.studio}</span><ChevronRight size={14} aria-hidden="true" /><strong>{routeTitle}</strong></div>
          </div>
          <form className="backend-global-search" onSubmit={submitSearch} role="search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
            <input ref={searchInputRef} value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder={t.backend.searchPlaceholder} aria-label={t.backend.searchPlaceholder} />
            <kbd>⌘ K</kbd>
          </form>
          <div className="backend-topbar-actions">
            <div className="backend-popover-wrap">
              <button className="backend-icon-button" type="button" aria-label={t.backend.notifications} aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen((value) => !value); setAccountOpen(false); }}>
                <Bell size={17} />
              </button>
              {notificationsOpen ? <div className="backend-popover backend-notification-popover" role="status"><strong>{t.backend.notifications}</strong><p>{t.backend.noNotifications}</p></div> : null}
            </div>
            <Link className="language-switcher" href={languagePath}>{nextLocale === "en" ? "EN" : "中文"}</Link>
            <ThemeToggle />
            <div className="backend-popover-wrap">
              <button className="backend-account-button" type="button" aria-expanded={accountOpen} onClick={() => { setAccountOpen((value) => !value); setNotificationsOpen(false); }}>
                <span className="backend-avatar">{user?.username?.slice(0, 1).toUpperCase() ?? "?"}</span><span className="backend-account-name">{user?.username ?? t.backend.account}</span>
              </button>
              {accountOpen ? <div className="backend-popover backend-account-popover" role="menu">
                <strong>{user?.username ?? t.backend.account}</strong>
                <Link href={`/${locale}/settings/security`} role="menuitem" onClick={() => setAccountOpen(false)}><Settings size={14} />{t.backend.security}</Link>
                <Link href={`/${locale}`} role="menuitem" onClick={() => setAccountOpen(false)}><Globe2 size={14} />{t.backend.publicSite}</Link>
                <button type="button" role="menuitem" onClick={() => void logout()}><LogOut size={14} />{t.nav.signOut}</button>
              </div> : null}
            </div>
          </div>
        </header>
        <main className="backend-content">{children}</main>
      </div>
    </div>
  );
}
