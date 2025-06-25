import { Sun, Cloud, CloudRain, CloudSun, type LucideProps } from 'lucide-react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type { WeatherData } from '@/lib/types';

export const CITIES = [
  "Lahore", "Multan", "Rawalpindi", "Gujranwala", "Faisalabad", "Bahawalpur",
  "Hafizabad", "Okara", "Jehlum", "Rahim Yar Khan", "Dera Ghazi Khan",
  "Sargodha", "Jhang", "Sialkot"
];

export const getWeatherIcon = (condition: WeatherData['condition']): ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>> => {
  switch (condition) {
    case 'Sunny':
    case 'Clear':
      return Sun;
    case 'Cloudy':
      return Cloud;
    case 'Partly Cloudy':
      return CloudSun;
    case 'Rainy':
      return CloudRain;
    default:
      return Sun;
  }
};
