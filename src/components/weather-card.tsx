import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { WeatherData } from "@/lib/types";
import { getWeatherIcon } from "@/lib/weather";
import { formatDistanceToNow } from "date-fns";
import { CloudRain } from 'lucide-react';
import React from 'react';

const CardRainAnimation = () => {
  const raindrops = React.useMemo(() => 
    Array.from({ length: 70 }).map((_, i) => {
      const style = {
        left: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 2}s`,
        animationDuration: `${0.5 + Math.random() * 0.5}s`,
      };
      return <div key={i} className="raindrop" style={style} />;
    }), []);

  return <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-lg z-10">{raindrops}</div>;
};

interface WeatherCardProps {
  data: WeatherData;
}

export default function WeatherCard({ data }: WeatherCardProps) {
  const Icon = getWeatherIcon(data.condition);
  const isRainingFromSpell = data.isSpellActive;

  return (
    <Link href={`/city/${encodeURIComponent(data.city)}`} className="block group">
        <Card className="relative flex flex-col justify-between h-full transition-colors border group-hover:border-primary/50 bg-card overflow-hidden">
          {isRainingFromSpell && <CardRainAnimation />}
          <div className="relative z-20 bg-card/50 dark:bg-black/20 backdrop-blur-[2px] flex flex-col flex-grow rounded-lg h-full">
            <CardHeader className="flex flex-row items-center justify-between p-4 pb-0">
                <CardTitle className="text-lg font-semibold">{data.city}</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">{data.condition}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col items-center justify-center gap-2 p-4">
                <div className="flex items-center justify-center gap-6">
                    <div className="flex items-start">
                    <span className="text-5xl font-bold text-primary">{data.temperature}</span>
                    <span className="text-xl font-medium text-muted-foreground mt-1">°C</span>
                    </div>
                    <Icon className="w-16 h-16 text-primary drop-shadow-lg transition-transform group-hover:scale-110" />
                </div>
                {data.forecast?.hasPrecipitation ? (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <CloudRain className="h-4 w-4 text-primary" />
                        <span>Forecast: {data.forecast.precipitationType}</span>
                    </div>
                ) : (
                    <div className="h-6" />
                )}
            </CardContent>
            <CardFooter className="flex items-center justify-start p-4 pt-0">
                <p className="text-xs text-muted-foreground">
                Updated {formatDistanceToNow(data.lastUpdated, { addSuffix: true })}
                </p>
            </CardFooter>
          </div>
        </Card>
    </Link>
  );
}
