'use server';

import type { WeatherData } from "@/lib/weather";
import { getCities } from "./admin/actions";

function mapApiCondition(apiMain: string, apiDesc:string): WeatherData['condition'] {
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

  if (!apiKey) {
    throw new Error("The OpenWeatherMap API key is missing from the environment configuration.");
  }
  
  const cities = await getCities();

  if (!cities || cities.length === 0) {
      console.log("No cities found in the database.");
      return [];
  }

  const weatherPromises = cities.map(async (city) => {
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${city.latitude}&lon=${city.longitude}&appid=${apiKey}&units=metric`;
      const response = await fetch(url, { next: { revalidate: 3600 } }); // Revalidate every hour
      
      if (!response.ok) {
        if (response.status === 401) {
            // This is a critical error, likely a bad API key. Fail everything.
            throw new Error("The configured OpenWeatherMap API key seems to be invalid.");
        }
        console.error(`Failed to fetch weather for ${city.name}: ${response.status} ${response.statusText}`);
        return null;
      }
      const data = await response.json();
      
      const weatherData: WeatherData = {
        id: data.id.toString(),
        city: city.name, // Use the name from Firestore
        condition: mapApiCondition(data.weather[0].main, data.weather[0].description),
        temperature: Math.round(data.main.temp),
        lastUpdated: new Date(data.dt * 1000),
      };
      return weatherData;
    } catch (error) {
      if (error instanceof Error && error.message.includes("API key")) {
          // Rethrow critical errors to be caught by the main loader.
          throw error;
      }
      console.error(`Error fetching weather for ${city.name}:`, error);
      return null;
    }
  });

  const results = await Promise.all(weatherPromises);
  return results.filter((data): data is WeatherData => data !== null);
}


export async function fetchWeatherForCity(city: string): Promise<WeatherData | null> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;

  if (!apiKey) {
    throw new Error("The OpenWeatherMap API key is missing from the environment configuration.");
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)},PK&appid=${apiKey}&units=metric`;
    const response = await fetch(url);
    
    if (!response.ok) {
        if (response.status === 401) {
            throw new Error("The configured OpenWeatherMap API key seems to be invalid.");
        }
        if (response.status === 429) {
            throw new Error("API rate limit exceeded. Please try again later.");
        }
        if (response.status === 404) {
            console.warn(`City not found: ${city}`);
            return null;
        }
        console.error(`Failed to fetch weather for ${city}: ${response.status} ${response.statusText}`);
        // For other server errors, return null. The UI will treat this as "not found".
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
    if (error instanceof Error) {
        throw error;
    }
    throw new Error(`An unknown error occurred while fetching weather for ${city}.`);
  }
}
