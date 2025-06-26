import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { WeatherData } from "@/lib/types";
import { getWeatherIcon } from "@/lib/weather";
import { formatDistanceToNow } from "date-fns";
import React from 'react';
import { cn } from '@/lib/utils';

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

  return <div className="rain-container">{raindrops}</div>;
};

const SnowAnimation = () => {
  const snowflakes = React.useMemo(() =>
    Array.from({ length: 50 }).map((_, i) => {
      const style = {
        left: `${Math.random() * 100}%`,
        fontSize: `${0.5 + Math.random() * 0.7}rem`,
        animationDelay: `${Math.random() * 10}s`,
        animationDuration: `${5 + Math.random() * 5}s`,
      };
      return <div key={i} className="snowflake" style={style}>*</div>;
    }), []);

  return <div className="snow-container">{snowflakes}</div>;
};

const ThunderAnimation = () => (
    <div className="thunder-container">
        <div className="lightning-flash"></div>
    </div>
);

const FogOverlay = () => <div className="fog-overlay"></div>;

const CloudyOverlay = () => (
    <div className="cloudy-overlay">
        <div className="cloud-layer cloud1"></div>
        <div className="cloud-layer cloud2"></div>
    </div>
);


interface WeatherCardProps {
  data: WeatherData;
}

export default function WeatherCard({ data }: WeatherCardProps) {
  const Icon = getWeatherIcon(data.condition);
  const isRaining = data.condition === 'Rainy' || data.isSpellActive;
  const isSnowing = data.condition === 'Snow';
  const isThunderstorm = data.condition === 'Thunderstorm';
  const isFoggy = data.condition === 'Fog';
  const isCloudy = data.condition === 'Cloudy';
  
  const formattedCondition = data.condition.replace(/([A-Z])/g, ' $1').trim();
  
  const cardClasses = cn(
    'relative flex flex-col justify-between h-full transition-colors duration-500 border group-hover:border-primary/50 bg-card overflow-hidden',
    {
        'bg-sky-100 dark:bg-sky-950': data.condition === 'ClearDay',
        'bg-indigo-900/80 dark:bg-black text-white': data.condition === 'ClearNight',
        'bg-slate-200/80 dark:bg-slate-800/80': isCloudy || isFoggy || isSnowing,
    }
  );
  
  const cardContentClasses = cn(
    "relative z-20 bg-card/50 dark:bg-black/20 backdrop-blur-[2px] flex flex-col flex-grow rounded-lg h-full",
    {
        'bg-transparent dark:bg-transparent backdrop-blur-none': data.condition === 'ClearNight',
    }
  );

  const mutedTextClasses = cn('text-muted-foreground', {
      'text-indigo-300': data.condition === 'ClearNight',
  });


  return (
    <Link href={`/city/${encodeURIComponent(data.city)}`} className="block group">
        <Card className={cardClasses}>
          {isRaining && <CardRainAnimation />}
          {isSnowing && <SnowAnimation />}
          {isThunderstorm && <ThunderAnimation />}
          {isFoggy && <FogOverlay />}
          {isCloudy && <CloudyOverlay />}

          <div className={cardContentClasses}>
            <CardHeader className="flex flex-row items-center justify-between p-4 pb-0">
                <CardTitle className="text-lg font-semibold">{data.city}</CardTitle>
                <CardDescription className={mutedTextClasses}>{formattedCondition}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col items-center justify-center gap-2 p-4">
                <div className="flex items-center justify-center gap-6">
                    <div className="flex items-start">
                    <span className="text-5xl font-bold text-primary">{data.temperature}</span>
                    <span className={cn("text-xl font-medium mt-1", mutedTextClasses)}>°C</span>
                    </div>
                    <Icon className="w-16 h-16 text-primary drop-shadow-lg transition-transform group-hover:scale-110" />
                </div>
                 {/* Placeholder for alignment, as forecast is removed */}
                <div className="h-6" />
            </CardContent>
            <CardFooter className="flex items-center justify-start p-4 pt-0">
                <p className={cn("text-xs", mutedTextClasses)}>
                Updated {formatDistanceToNow(data.lastUpdated, { addSuffix: true })}
                </p>
            </CardFooter>
          </div>
        </Card>
    </Link>
  );
}
