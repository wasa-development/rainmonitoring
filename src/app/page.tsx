"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import type { WeatherData } from "@/lib/types";
import { fetchWeatherData, fetchWeatherForCity } from "@/app/actions";
import WeatherCard from "@/components/weather-card";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle, Search, LogIn, LogOut, LayoutDashboard } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { ThemeToggle } from '@/components/theme-toggle';
import { Logo } from '@/components/logo';

const CitySkeleton = () => (
    <div className="flex flex-col justify-between rounded-lg border bg-card text-card-foreground p-4 space-y-4">
    <div className="flex items-center justify-between pb-0">
      <Skeleton className="h-5 w-2/4" />
      <Skeleton className="h-4 w-1/4" />
    </div>
    <div className="flex flex-grow items-center justify-center gap-6">
      <Skeleton className="h-12 w-1/3" />
      <Skeleton className="h-16 w-16 rounded-full" />
    </div>
    <div className="flex items-center justify-between pt-0">
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
    </div>
  </div>
);

export default function Home() {
  const [weatherData, setWeatherData] = useState<WeatherData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const { toast } = useToast();
  const { user, claims, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  const getDashboardLink = () => {
    if (!claims) return '/';
    if (claims.role === 'super-admin') {
        return '/admin';
    }
    if (claims.role === 'city-user' && claims.assignedCity) {
        return `/city/${encodeURIComponent(claims.assignedCity)}`;
    }
    return '/'; // Viewers or others go to home
  };

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchWeatherData();
      setWeatherData(data);
    } catch (e: any) {
      console.error(e);
      const errorMessage = e.message || "An unknown error occurred while fetching data.";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    }
  }, [toast]);

  useEffect(() => {
    if (user) { // Only load data if user is authenticated
        setLoading(true);
        loadData().finally(() => setLoading(false));
    }
  }, [loadData, user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSearch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) return;

    setSearching(true);
    try {
        const result = await fetchWeatherForCity(trimmedQuery);
        if (result) {
            setWeatherData(prevData => {
                if (prevData.some(city => city.id === result.id)) {
                    const otherCities = prevData.filter(city => city.id !== result.id);
                    return [result, ...otherCities];
                }
                return [result, ...prevData];
            });
            setSearchQuery('');
        } else {
            toast({
                variant: "destructive",
                title: "City not found",
                description: `Could not find weather data for "${trimmedQuery}". Please try another city.`,
            });
        }
    } catch (e: any) {
        console.error(e);
        const errorMessage = e.message || "An unknown error occurred while searching.";
        toast({
            variant: "destructive",
            title: "Search Error",
            description: errorMessage,
        });
    } finally {
        setSearching(false);
    }
  };

  if (authLoading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 sm:p-8 md:p-12">
      <header className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <div className="flex items-center gap-3">
          <Logo />
          <h1 className="text-3xl sm:text-4xl font-bold text-primary">
            Punjab WASA Rain Monitoring
          </h1>
        </div>
        <div className="flex w-full sm:w-auto items-center gap-2">
            <form onSubmit={handleSearch} className="flex flex-grow sm:flex-grow-0 items-center gap-2">
                <Input
                    type="search"
                    placeholder="Search for a city..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="sm:w-48"
                    disabled={searching || loading}
                />
                <Button type="submit" variant="outline" size="icon" disabled={searching || loading || !searchQuery}>
                    {searching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    <span className="sr-only">Search</span>
                </Button>
            </form>
            <Button onClick={handleRefresh} disabled={refreshing || loading || searching} variant="outline">
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </Button>
            
            {authLoading ? (
                <Skeleton className="h-10 w-28" />
            ) : user ? (
                <>
                    {claims?.role !== 'viewer' && (
                        <Link href={getDashboardLink()} passHref>
                            <Button variant="outline">
                                <LayoutDashboard className="mr-2 h-4 w-4" />
                                Dashboard
                            </Button>
                        </Link>
                    )}
                    <Button onClick={signOut}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign Out
                    </Button>
                </>
            ) : (
                <Link href="/login" passHref>
                    <Button>
                        <LogIn className="mr-2 h-4 w-4" />
                        Sign In
                    </Button>
                </Link>
            )}
            <ThemeToggle />
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 15 }).map((_, i) => (
            <CitySkeleton key={i} />
          ))}
        </div>
      ) : error ? (
         <div className="flex flex-col items-center justify-center text-center py-20 bg-card rounded-lg border border-destructive/50">
            <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
            <h2 className="text-2xl font-semibold text-destructive mb-2">Failed to Load Weather Data</h2>
            <p className="text-muted-foreground max-w-md">{error}</p>
         </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {weatherData.map((data) => (
            <WeatherCard key={data.id} data={data} />
          ))}
        </div>
      )}
    </main>
  );
}
