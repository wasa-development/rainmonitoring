import Link from 'next/link';
import Image from 'next/image';
import { Card } from "@/components/ui/card";
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
        animationDuration: `${1.2 + Math.random() * 0.6}s`,
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
  const isClearDay = data.condition === 'ClearDay';
  const isRaining = data.condition === 'Rainy' || data.condition === 'Thunderstorm';
  const isSnowing = data.condition === 'Snow';
  const isThunderstorm = data.condition === 'Thunderstorm';
  const isFoggy = data.condition === 'Fog';
  const isCloudy = data.condition === 'Cloudy';
  
  const formattedCondition = data.condition.replace(/([A-Z])/g, ' $1').trim();
  
  const cardClasses = cn(
    'relative flex flex-col justify-between h-full transition-colors duration-500 border group-hover:border-primary/50 bg-card overflow-hidden',
    {
        'bg-indigo-900/80 dark:bg-black text-white': data.condition === 'ClearNight',
        'bg-slate-800/80': isFoggy || isSnowing,
    }
  );
  
  const cardContentClasses = cn(
    "relative z-20 bg-card/50 dark:bg-black/20 backdrop-blur-[2px] flex flex-col flex-grow rounded-lg h-full",
    {
        'bg-transparent dark:bg-transparent backdrop-blur-none': data.condition === 'ClearNight',
        'bg-black/10 dark:bg-black/30': isClearDay || isCloudy,
    }
  );

  const mutedTextClasses = cn('text-white/90');


  return (
    <Link href={`/city/${encodeURIComponent(data.city)}`} className="block group">
        <Card className={cardClasses}>
          {isClearDay && (
            <Image
                src="/clear-day.jpg"
                alt="Clear sunny sky"
                layout="fill"
                objectFit="cover"
                className="absolute z-0"
            />
          )}
          {isCloudy && (
            <Image
                src="/cloudy-day.jpg"
                alt="Cloudy sky"
                layout="fill"
                objectFit="cover"
                className="absolute z-0"
            />
          )}
          {isRaining && <CardRainAnimation />}
          {isSnowing && <SnowAnimation />}
          {isThunderstorm && <ThunderAnimation />}
          {isFoggy && <FogOverlay />}
          {isCloudy && <CloudyOverlay />}

          <div className={cardContentClasses}>
             <div className="flex flex-col h-full p-6 text-white">
                <div className="flex justify-between items-start">
                    <span className="text-8xl font-light tracking-tight">{data.temperature}°</span>
                     <Icon className={cn(
                        "w-20 h-20 drop-shadow-lg transition-transform group-hover:scale-110 mt-2",
                        data.condition === 'ClearDay' ? 'text-yellow-400' : 'text-white'
                    )} />
                </div>
                
                <p className="text-2xl text-white/90 -mt-3">{formattedCondition}</p>

                <div className="flex-grow" />

                <div>
                    <h2 className="text-3xl font-bold">{data.city}</h2>
                    <p className={cn("text-sm", mutedTextClasses)}>
                        Updated {formatDistanceToNow(data.lastUpdated, { addSuffix: true })}
                    </p>
                </div>
             </div>
          </div>
        </Card>
    </Link>
  );
}
