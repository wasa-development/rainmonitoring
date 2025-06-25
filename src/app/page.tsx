"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { WeatherData } from "@/lib/weather";
import { fetchWeatherData, fetchWeatherForCity } from "@/app/actions";
import WeatherCard from "@/components/weather-card";
import { Button } from "@/components/ui/button";
import { RefreshCw, CloudSun, AlertTriangle, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';

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
    <div className="pt-0">
        <Skeleton className="h-3 w-1/2" />
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
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

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

  return (
    <main className="min-h-screen p-4 sm:p-8 md:p-12">
      <header className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <div className="flex items-center gap-3">
          <CloudSun className="w-8 h-8 text-accent" />
          <h1 className="text-3xl sm:text-4xl font-bold text-primary">
            Pakistan Weather Pulse
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
                <Button type="submit" variant="outline" disabled={searching || loading || !searchQuery} className="px-3">
                    {searching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    <span className="sr-only">Search</span>
                </Button>
            </form>
            <Button onClick={handleRefresh} disabled={refreshing || loading || searching} variant="outline" className="border-accent text-accent hover:bg-accent/10 hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed">
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </Button>
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
            <p className="text-muted-foreground max-w-md mt-2 text-sm">
                To fix this, get a free API key from <a href="https://openweathermap.org/appid" target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">OpenWeatherMap</a>, add it to a <code>.env.local</code> file in your project, and restart the server.
            </p>
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
