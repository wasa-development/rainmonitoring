import { Sun, Cloud, CloudRain, Wind, CloudSun, type LucideProps } from 'lucide-react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';

export interface WeatherData {
  id: string;
  city: string;
  condition: 'Sunny' | 'Rainy' | 'Windy' | 'Clear' | 'Cloudy' | 'Partly Cloudy';
  temperature: number;
  lastUpdated: Date;
}

export const CITIES = [
  "Lahore", "Multan", "Rawalpindi", "Gujranwala", "Faisalabad", "Bahawalpur",
  "Hafizabad", "Sahiwal", "Okara", "Jehlum", "Rahim Yar Khan", "D.G. Khan",
  "Sargodha", "Jhang", "Sialkot"
];

const CONDITIONS: WeatherData['condition'][] = ['Sunny', 'Rainy', 'Windy', 'Clear', 'Cloudy', 'Partly Cloudy'];

function getRandomCondition(): WeatherData['condition'] {
  return CONDITIONS[Math.floor(Math.random() * CONDITIONS.length)];
}

function getRandomTemperature(): number {
  return Math.floor(Math.random() * 25) + 15; // Temp between 15 and 40
}

export const getMockWeatherData = (): WeatherData[] => {
  return CITIES.map((city) => ({
    id: city.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    city,
    condition: getRandomCondition(),
    temperature: getRandomTemperature(),
    lastUpdated: new Date(Date.now() - Math.random() * 1000 * 60 * 60), // within the last hour
  }));
};

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
    case 'Windy':
      return Wind;
    default:
      return Sun;
  }
};
