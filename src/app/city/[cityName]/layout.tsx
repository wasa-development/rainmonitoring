
'use client';

import { use, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { Home, LayoutDashboard, Users, FilePenLine, LogOut, RefreshCw, BarChart3, FileClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';

export default function CityLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { cityName: string };
}) {
  const { cityName: encodedCityName } = use(params);
  const cityName = decodeURIComponent(encodedCityName);
  const pathname = usePathname();
  const { user, claims, loading: authLoading, signOut } = useAuth();

  const menuItems = useMemo(() => [
    {
      href: `/city/${encodedCityName}`,
      label: 'Ponding Points',
      icon: LayoutDashboard,
      active: pathname === `/city/${encodedCityName}`,
    },
    {
      href: `/city/${encodedCityName}/data-entry`,
      label: 'Bulk Data Entry',
      icon: FilePenLine,
      active: pathname === `/city/${encodedCityName}/data-entry`,
      roles: ['super-admin', 'city-user'],
    },
    {
      href: `/city/${encodedCityName}/report`,
      label: 'Status Report',
      icon: FileClock,
      active: pathname === `/city/${encodedCityName}/report`,
    },
    {
      href: `/city/${encodedCityName}/reports`,
      label: 'Daily Reports',
      icon: BarChart3,
      active: pathname === `/city/${encodedCityName}/reports`,
      roles: ['super-admin', 'city-user'],
    },
    {
        href: '/admin',
        label: 'Manage Users',
        icon: Users,
        active: pathname === '/admin',
        roles: ['super-admin', 'city-user'],
    }
  ], [encodedCityName, pathname]);
  
  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <Logo width={40} height={40} />
            <span className="text-lg font-semibold group-data-[state=collapsed]:hidden">{cityName}</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/'}>
                    <Link href="/">
                        <Home />
                        All Cities
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            {menuItems.map((item) => {
              if (item.roles && !item.roles.includes(claims?.role!)) {
                  return null;
              }
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={item.active}>
                    <Link href={item.href}>
                      <item.icon />
                      {item.label}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="!flex-row !items-center !justify-between p-2">
            <Button onClick={signOut} variant="ghost" className="justify-start p-2 h-auto text-sm">
              <LogOut className="mr-2"/>
              Sign Out
            </Button>
            <ThemeToggle />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex items-center justify-between p-4 border-b sticky top-0 bg-background z-20">
            <div className="flex items-center gap-2">
                 <SidebarTrigger />
                 <h2 className="text-lg font-semibold md:hidden">{cityName}</h2>
            </div>
            <ThemeToggle />
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
