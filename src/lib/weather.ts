import { Sun, Cloud, CloudRain, CloudSun, type LucideProps } from 'lucide-react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';

export interface WeatherData {
  id: string;
  city: string;
  condition: 'Sunny' | 'Rainy' | 'Clear' | 'Cloudy' | 'Partly Cloudy';
  temperature: number;
  lastUpdated: Date;
}

export const CITIES = [
  "Lahore", "Multan", "Rawalpindi", "Gujranwala", "Faisalabad", "Bahawalpur",
  "Hafizabad", "Sahiwal", "Okara", "Jehlum", "Rahim Yar Khan", "D.G. Khan",
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
