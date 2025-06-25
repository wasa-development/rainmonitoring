import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { WeatherData } from "@/lib/weather";
import { getWeatherIcon } from "@/lib/weather";
import { formatDistanceToNow } from "date-fns";
import RainAnimation from "./rain-animation";
import { cn } from "@/lib/utils";

interface WeatherCardProps {
  data: WeatherData;
}

export default function WeatherCard({ data }: WeatherCardProps) {
  const Icon = getWeatherIcon(data.condition);
  const isRainy = data.condition === 'Rainy';

  return (
    <Card className="relative flex flex-col justify-between overflow-hidden transition-all duration-300 ease-in-out hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1">
      {isRainy && <RainAnimation />}
      <div className="relative z-10 flex flex-col h-full bg-card/80 backdrop-blur-sm p-2 rounded-lg">
        <CardHeader className="p-4">
          <CardTitle className="text-xl font-bold">{data.city}</CardTitle>
          <CardDescription className="text-accent font-medium">{data.condition}</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col items-center justify-center gap-2 p-4">
          <div className="flex items-start">
            <span className="text-6xl font-bold text-white">{data.temperature}</span>
            <span className="text-2xl font-bold text-primary mt-1">°C</span>
          </div>
          <Icon className="w-20 h-20 text-primary drop-shadow-lg" />
        </CardContent>
        <CardFooter className="p-4 mt-auto">
          <p className="text-xs text-muted-foreground w-full text-center">
            Updated {formatDistanceToNow(data.lastUpdated, { addSuffix: true })}
          </p>
        </CardFooter>
      </div>
    </Card>
  );
}
