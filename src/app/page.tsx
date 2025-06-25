"use client";

import { useState, useEffect } from 'react';
import type { WeatherData } from "@/lib/weather";
import { getMockWeatherData } from "@/lib/weather";
import WeatherCard from "@/components/weather-card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Zap } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from '@/components/ui/skeleton';

const CitySkeleton = () => (
  <div className="flex flex-col justify-between rounded-lg border bg-card text-card-foreground shadow-sm p-6 space-y-4">
    <div className="space-y-2">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
    <div className="flex flex-col items-center gap-4">
      <Skeleton className="h-16 w-3/4" />
      <Skeleton className="h-20 w-20 rounded-full" />
    </div>
    <Skeleton className="h-4 w-1/3 mt-auto" />
  </div>
);

export default function Home() {
  const [weatherData, setWeatherData] = useState<WeatherData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

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
    toast({
      title: "Weather Updated",
      description: `Latest weather data has been fetched for all cities.`,
      className: "bg-card border-primary text-card-foreground"
    });
  };

  return (
    <main className="min-h-screen p-4 sm:p-8 md:p-12">
      <header className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <div className="flex items-center gap-3">
          <Zap className="w-8 h-8 text-primary" />
          <h1 className="text-3xl sm:text-4xl font-bold text-white">
            Pakistan Weather Pulse
          </h1>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing || loading} variant="outline" className="bg-card/50 border-primary text-primary hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed">
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh Data'}
        </Button>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {Array.from({ length: 15 }).map((_, i) => (
            <CitySkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {weatherData.map((data) => (
            <WeatherCard key={data.id} data={data} />
          ))}
        </div>
      )}
    </main>
  );
}
