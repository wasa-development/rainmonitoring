"use client";

import { useState, useEffect } from 'react';
import type { WeatherData } from "@/lib/weather";
import { getMockWeatherData } from "@/lib/weather";
import WeatherCard from "@/components/weather-card";
import { Button } from "@/components/ui/button";
import { RefreshCw, CloudSun } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

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

  useEffect(() => {
    const timer = setTimeout(() => {
      setWeatherData(getMockWeatherData());
      setLoading(false);
    }, 1500); // Simulate initial loading
    return () => clearTimeout(timer);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setWeatherData(getMockWeatherData());
    setRefreshing(false);
  };

  return (
    <main className="min-h-screen p-4 sm:p-8 md:p-12">
      <header className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <div className="flex items-center gap-3">
          <CloudSun className="w-8 h-8 text-accent" />
          <h1 className="text-3xl sm:text-4xl font-bold text-primary">
            Weather Dashboard
          </h1>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing || loading} variant="outline" className="border-accent text-accent hover:bg-accent/10 hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed">
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh Data'}
        </Button>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <CitySkeleton key={i} />
          ))}
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
