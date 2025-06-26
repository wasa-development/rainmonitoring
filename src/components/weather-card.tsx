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

const CloudyOverlay = () => (
    <div className="cloudy-overlay">
        <div className="cloud-layer cloud1"></div>
        <div className="cloud-layer cloud2"></div>
    </div>
);

const FogOverlay = () => <div className="fog-overlay"></div>;

const renderBackgroundImage = (condition: WeatherData['condition']) => {
    switch (condition) {
        case 'ClearDay':
            return <Image src="/clear-day.jpg" alt="Clear sunny sky" layout="fill" objectFit="cover" className="absolute z-0" />;
        case 'Cloudy':
        case 'PartlyCloudyDay':
        case 'PartlyCloudyNight':
            return <Image src="/cloudy-day.jpg" alt="Cloudy sky" layout="fill" objectFit="cover" className="absolute z-0" />;
        case 'Rainy':
        case 'Thunderstorm':
            return <Image src="/rainy-day.jpg" alt="A city street on a rainy day" layout="fill" objectFit="cover" className="absolute z-0" />;
        default:
            return null;
    }
};

interface WeatherCardProps {
  data: WeatherData;
}

export default function WeatherCard({ data }: WeatherCardProps) {
  const Icon = getWeatherIcon(data.condition);
  const isRaining = data.condition === 'Rainy' || data.condition === 'Thunderstorm';
  const isSnowing = data.condition === 'Snow';
  const isThunderstorm = data.condition === 'Thunderstorm';
  const isCloudy = ['Cloudy', 'PartlyCloudyDay', 'PartlyCloudyNight'].includes(data.condition);
  const isFoggy = data.condition === 'Fog';
  const hasImage = ['ClearDay', 'Cloudy', 'PartlyCloudyDay', 'PartlyCloudyNight', 'Rainy', 'Thunderstorm'].includes(data.condition);

  const formattedCondition = data.condition.replace(/([A-Z])/g, ' $1').trim();

  return (
    <Link href={`/city/${encodeURIComponent(data.city)}`} className="block group">
        <Card className="relative flex flex-col justify-between h-full transition-colors duration-500 border group-hover:border-primary/50 bg-card overflow-hidden">
            {renderBackgroundImage(data.condition)}
            {hasImage && <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/10 z-10" />}
          
            {isRaining && <CardRainAnimation />}
            {isSnowing && <SnowAnimation />}
            {isThunderstorm && <ThunderAnimation />}
            {isCloudy && <CloudyOverlay />}
            {isFoggy && <FogOverlay />}

            <div className={cn("relative z-20 flex flex-col h-full p-6", hasImage || isFoggy ? "text-white" : "text-card-foreground")}>
                <div className="flex justify-between items-start">
                    <span className="text-8xl font-light tracking-tight">{data.temperature}°</span>
                     {data.condition !== 'ClearDay' && (
                        <Icon className={cn("w-20 h-20 drop-shadow-lg transition-transform group-hover:scale-110 mt-2")} />
                     )}
                </div>
                
                <p className={cn("text-2xl -mt-3", hasImage || isFoggy ? "text-white/90" : "text-muted-foreground")}>{formattedCondition}</p>

                <div className="flex-grow" />

                <div>
                    <h2 className="text-3xl font-bold">{data.city}</h2>
                    <p className={cn("text-sm", hasImage || isFoggy ? "text-white/80" : "text-muted-foreground")}>
                        Updated {formatDistanceToNow(data.lastUpdated, { addSuffix: true })}
                    </p>
                </div>
            </div>
        </Card>
    </Link>
  );
}
