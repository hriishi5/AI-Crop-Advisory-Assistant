import { type ReactNode, useState } from 'react';
import { BarChart3, BookOpen, ChevronRight, Leaf, LogOut, Menu, Sprout, UserRound, X } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useGetCurrentFarmer, useLogout } from '@workspace/api-client-react';

const nav = [
  { href: '/dashboard', label: 'Overview', icon: BarChart3 },
  { href: '/farms', label: 'My farms', icon: Sprout },
  { href: '/history', label: 'Field history', icon: BookOpen },
  { href: '/profile', label: 'Profile', icon: UserRound },
];

function Mark() {
  return <div className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-primary shadow-sm"><Leaf size={19} strokeWidth={2.5} /></div>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: farmer } = useGetCurrentFarmer();
  const logout = useLogout();
  const initials = farmer?.fullName?.split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase() ?? 'KS';
  const close = () => setMobileOpen(false);
  const sidebar = <aside className={`fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col bg-sidebar px-4 py-5 text-sidebar-foreground transition-transform duration-300 lg:static lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
    <div className="flex items-center gap-3 px-2"><Mark /><div><div className="font-display text-[21px] leading-none">KisanSaathi</div><div className="mt-1 font-mono-app text-[9px] uppercase tracking-[.18em] text-sidebar-foreground/55">field companion</div></div><button className="ml-auto rounded-lg p-1 text-sidebar-foreground/60 lg:hidden" onClick={close} data-testid="button-close-menu"><X size={18} /></button></div>
    <div className="mt-10 px-2 font-mono-app text-[10px] uppercase tracking-[.2em] text-sidebar-foreground/45">Workspace</div>
    <nav className="mt-3 grid gap-1">{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={close} className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${location === href ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/68 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`} data-testid={`link-nav-${label.toLowerCase().replace(/\s+/g, '-')}`}><Icon size={17} /><span className="font-medium">{label}</span>{location === href ? <ChevronRight size={15} className="ml-auto text-secondary" /> : null}</Link>)}</nav>
    <div className="mt-auto rounded-2xl border border-sidebar-border bg-sidebar-accent/50 p-3"><div className="flex items-center gap-2.5"><div className="grid h-9 w-9 place-items-center rounded-full bg-secondary font-semibold text-primary">{initials}</div><div className="min-w-0"><div className="truncate text-sm font-semibold">{farmer?.fullName ?? 'Your account'}</div><div className="truncate text-[11px] text-sidebar-foreground/55">{farmer?.defaultDistrict ?? 'Add your district'}</div></div></div><button onClick={() => logout.mutate(undefined, { onSuccess: () => setLocation('/login') })} className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs text-sidebar-foreground/60 transition hover:bg-sidebar-accent hover:text-sidebar-foreground" data-testid="button-logout"><LogOut size={14} /> Sign out</button></div>
  </aside>;
  return <div className="min-h-[100dvh] bg-background lg:flex"><div className="lg:hidden">{mobileOpen ? <div className="fixed inset-0 z-30 bg-primary/25" onClick={close} /> : null}</div>{sidebar}<main className="min-w-0 flex-1"><header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-border/70 bg-background/90 px-4 backdrop-blur-md sm:px-7 lg:px-10"><button className="rounded-xl p-2 text-foreground lg:hidden" onClick={() => setMobileOpen(true)} data-testid="button-open-menu"><Menu size={21} /></button><div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><span className="h-2 w-2 rounded-full bg-[hsl(155_48%_44%)]" /> Field workspace <span className="text-border">/</span> <span className="font-medium text-foreground">{nav.find((item) => location.startsWith(item.href))?.label ?? 'KisanSaathi'}</span></div><div className="ml-auto flex items-center gap-3"><Link href="/farms/new" className="hidden rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:brightness-110 sm:inline-flex" data-testid="link-quick-add-farm">+ Add field</Link><Link href="/profile" className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-xs font-bold text-foreground" data-testid="link-header-profile">{initials}</Link></div></header><div className="page-enter mx-auto max-w-[1440px] px-4 py-7 pb-24 sm:px-7 lg:px-10 lg:py-10 lg:pb-12">{children}</div></main><nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-card/95 px-2 py-2 backdrop-blur-md lg:hidden">{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`grid place-items-center gap-1 rounded-xl py-1.5 text-[10px] ${location === href ? 'text-accent' : 'text-muted-foreground'}`} data-testid={`link-mobile-${label.toLowerCase().replace(/\s+/g, '-')}`}><Icon size={17} /><span>{label}</span></Link>)}</nav></div>;
}