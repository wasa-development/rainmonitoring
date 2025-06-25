'use server';

import type { WeatherData } from "@/lib/weather";
import { CITIES } from "@/lib/weather";

function mapApiCondition(apiMain: string, apiDesc: string): WeatherData['condition'] {
    switch (apiMain) {
        case 'Thunderstorm':
        case 'Drizzle':
        case 'Rain':
            return 'Rainy';
        case 'Clear':
            return 'Clear';
        case 'Clouds':
            if (apiDesc.includes('few clouds') || apiDesc.includes('scattered clouds')) {
                return 'Partly Cloudy';
            }
            return 'Cloudy';
        default:
            return 'Cloudy';
    }
}


export async function fetchWeatherData(): Promise<WeatherData[]> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;

  if (!apiKey || apiKey === "YOUR_API_KEY_HERE") {
    throw new Error("OpenWeatherMap API key is missing. Please add it to your .env.local file and restart the server.");
  }

  const weatherPromises = CITIES.map(async (city) => {
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${city},PK&appid=${apiKey}&units=metric`;
      const response = await fetch(url, { next: { revalidate: 3600 } }); // Revalidate every hour
      
      if (!response.ok) {
        if (response.status === 404) {
            console.warn(`City not found: ${city}`);
            return null;
        }
        console.error(`Failed to fetch weather for ${city}: ${response.status} ${response.statusText}`);
        return null;
      }
      const data = await response.json();
      
      const weatherData: WeatherData = {
        id: data.id.toString(),
        city: data.name,
        condition: mapApiCondition(data.weather[0].main, data.weather[0].description),
        temperature: Math.round(data.main.temp),
        lastUpdated: new Date(data.dt * 1000),
      };
      return weatherData;
    } catch (error) {
      console.error(`Error fetching weather for ${city}:`, error);
      return null;
    }
  });

  const results = await Promise.all(weatherPromises);
  return results.filter((data): data is WeatherData => data !== null);
}


export async function fetchWeatherForCity(city: string): Promise<WeatherData | null> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;

  if (!apiKey || apiKey === "YOUR_API_KEY_HERE") {
    throw new Error("OpenWeatherMap API key is missing.");
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city},PK&appid=${apiKey}&units=metric`;
    const response = await fetch(url);
    
    if (!response.ok) {
        if (response.status === 404) {
            console.warn(`City not found: ${city}`);
            return null;
        }
        console.error(`Failed to fetch weather for ${city}: ${response.status} ${response.statusText}`);
        throw new Error(`Could not fetch weather data for ${city}.`);
    }
    const data = await response.json();
    
    const weatherData: WeatherData = {
      id: data.id.toString(),
      city: data.name,
      condition: mapApiCondition(data.weather[0].main, data.weather[0].description),
      temperature: Math.round(data.main.temp),
      lastUpdated: new Date(data.dt * 1000),
    };
    return weatherData;
  } catch (error) {
    console.error(`Error fetching weather for ${city}:`, error);
    if (error instanceof Error) {
        throw error;
    }
    throw new Error(`An unknown error occurred while fetching weather for ${city}.`);
  }
}
