import { Sun, Moon, CloudSun, CloudMoon, Cloud, CloudRain, CloudLightning, Snowflake, CloudFog, type LucideProps } from 'lucide-react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type { WeatherCondition } from '@/lib/types';

export const getWeatherIcon = (condition: WeatherCondition): ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>> => {
  switch (condition) {
    case 'ClearDay':
      return Sun;
    case 'ClearNight':
        return Moon;
    case 'PartlyCloudyDay':
        return CloudSun;
    case 'PartlyCloudyNight':
        return CloudMoon;
    case 'Cloudy':
      return Cloud;
    case 'Rainy':
      return CloudRain;
    case 'Thunderstorm':
        return CloudLightning;
    case 'Snow':
        return Snowflake;
    case 'Fog':
        return CloudFog;
    default:
      return Sun; // Fallback
  }
};
