import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { WeatherData } from "@/lib/types";
import { getWeatherIcon } from "@/lib/weather";
import { formatDistanceToNow } from "date-fns";

interface WeatherCardProps {
  data: WeatherData;
}

export default function WeatherCard({ data }: WeatherCardProps) {
  const Icon = getWeatherIcon(data.condition);

  return (
    <Link href={`/city/${encodeURIComponent(data.city)}`} className="block group">
        <Card className="flex flex-col justify-between h-full transition-colors border-transparent border group-hover:border-accent/50 bg-card">
        <CardHeader className="flex flex-row items-center justify-between p-4 pb-0">
            <CardTitle className="text-lg font-semibold">{data.city}</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">{data.condition}</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center gap-6 p-4">
            <div className="flex items-start">
            <span className="text-5xl font-bold text-primary">{data.temperature}</span>
            <span className="text-xl font-medium text-muted-foreground mt-1">°C</span>
            </div>
            <Icon className="w-16 h-16 text-accent drop-shadow-lg transition-transform group-hover:scale-110" />
        </CardContent>
        <CardFooter className="p-4 pt-0">
            <p className="text-xs text-muted-foreground w-full text-left">
            Updated {formatDistanceToNow(data.lastUpdated, { addSuffix: true })}
            </p>
        </CardFooter>
        </Card>
    </Link>
  );
}
