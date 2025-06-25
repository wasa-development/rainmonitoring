'use server';

import type { WeatherData } from "@/lib/types";
import { getCities } from "./admin/actions";

function mapAccuWeatherCondition(weatherText: string): WeatherData['condition'] {
    const text = weatherText.toLowerCase();
    if (text.includes('thunder') || text.includes('rain') || text.includes('shower') || text.includes('drizzle')) {
        return 'Rainy';
    }
    if (text.includes('sunny')) {
        return 'Sunny';
    }
    if (text.includes('clear')) {
        return 'Clear';
    }
    if (text.includes('partly') || text.includes('intermittent') || text.includes('some clouds') || text.includes('hazy')) {
        return 'Partly Cloudy';
    }
    if (text.includes('mostly cloudy') || text.includes('cloudy') || text.includes('overcast') || text.includes('fog')) {
        return 'Cloudy';
    }
    return 'Cloudy'; // Default for any other condition
}


export async function fetchWeatherData(): Promise<WeatherData[]> {
  const apiKey = process.env.ACCUWEATHER_API_KEY;

  if (!apiKey) {
    throw new Error("The AccuWeather API key is missing. Please add ACCUWEATHER_API_KEY to your environment variables.");
  }
  
  const cities = await getCities();

  if (!cities || cities.length === 0) {
      console.log("No cities found in the database.");
      return [];
  }

  const weatherPromises = cities.map(async (city) => {
    try {
      // Step 1: Get Location Key from latitude and longitude
      const locationUrl = `http://dataservice.accuweather.com/locations/v1/cities/geoposition/search?apikey=${apiKey}&q=${city.latitude},${city.longitude}`;
      const locationResponse = await fetch(locationUrl, { next: { revalidate: 86400 } }); // Cache location key for a day

      if (!locationResponse.ok) {
         if (locationResponse.status === 401) throw new Error("The configured AccuWeather API key seems to be invalid.");
         if (locationResponse.status === 503) throw new Error("AccuWeather API rate limit exceeded. The free tier allows only 50 calls per day.");
         console.error(`Failed to get AccuWeather location key for ${city.name}: ${locationResponse.status} ${locationResponse.statusText}`);
         return null;
      }
      
      const locationData = await locationResponse.json();
      const locationKey = locationData?.Key;

      if (!locationKey) {
        console.warn(`Could not find AccuWeather location key for ${city.name}.`);
        return null;
      }

      // Step 2: Get Current Conditions using the Location Key
      const weatherUrl = `http://dataservice.accuweather.com/currentconditions/v1/${locationKey}?apikey=${apiKey}`;
      const weatherResponse = await fetch(weatherUrl, { next: { revalidate: 3600 } }); // Revalidate every hour
      
      if (!weatherResponse.ok) {
        console.error(`Failed to fetch weather for ${city.name}: ${weatherResponse.status} ${weatherResponse.statusText}`);
        return null;
      }
      const weatherDataArr = await weatherResponse.json();
      
      if (!weatherDataArr || weatherDataArr.length === 0) {
        console.warn(`No weather data returned from AccuWeather for ${city.name}.`);
        return null;
      }
      
      const weatherInfo = weatherDataArr[0];
      const weatherData: WeatherData = {
        id: locationKey,
        city: city.name, // Use the name from Firestore for consistency
        condition: mapAccuWeatherCondition(weatherInfo.WeatherText),
        temperature: Math.round(weatherInfo.Temperature.Metric.Value),
        lastUpdated: new Date(weatherInfo.EpochTime * 1000),
      };
      return weatherData;
    } catch (error) {
      if (error instanceof Error && (error.message.includes("API key") || error.message.includes("rate limit"))) {
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
  const apiKey = process.env.ACCUWEATHER_API_KEY;

  if (!apiKey) {
    throw new Error("The AccuWeather API key is missing. Please add ACCUWEATHER_API_KEY to your environment variables.");
  }

  try {
    // Step 1: Get Location Key from city name search
    const locationUrl = `http://dataservice.accuweather.com/locations/v1/cities/search?apikey=${apiKey}&q=${encodeURIComponent(city)}`;
    const locationResponse = await fetch(locationUrl, { next: { revalidate: 86400 } });

    if (!locationResponse.ok) {
        if (locationResponse.status === 401) throw new Error("The configured AccuWeather API key seems to be invalid.");
        if (locationResponse.status === 503) throw new Error("AccuWeather API rate limit exceeded. The free tier allows only 50 calls per day.");
        console.error(`Failed to search AccuWeather city for ${city}: ${locationResponse.status} ${locationResponse.statusText}`);
        return null;
    }

    const locationData = await locationResponse.json();
    if (!locationData || locationData.length === 0) {
        console.warn(`City not found via AccuWeather: ${city}`);
        return null;
    }

    const locationKey = locationData[0]?.Key;
    const locationName = locationData[0]?.LocalizedName;

    if (!locationKey) {
        return null;
    }

    // Step 2: Get Current Conditions
    const weatherUrl = `http://dataservice.accuweather.com/currentconditions/v1/${locationKey}?apikey=${apiKey}`;
    const weatherResponse = await fetch(weatherUrl);
    
    if (!weatherResponse.ok) {
       return null;
    }
    const weatherDataArr = await weatherResponse.json();
    
    if (!weatherDataArr || weatherDataArr.length === 0) {
      return null;
    }
    
    const weatherInfo = weatherDataArr[0];
    const weatherData: WeatherData = {
      id: locationKey,
      city: locationName,
      condition: mapAccuWeatherCondition(weatherInfo.WeatherText),
      temperature: Math.round(weatherInfo.Temperature.Metric.Value),
      lastUpdated: new Date(weatherInfo.EpochTime * 1000),
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
