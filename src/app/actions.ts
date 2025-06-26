
'use server';

import type { Spell, WeatherData, WeatherCondition } from "@/lib/types";
import { getCities } from "./admin/actions";
import { db } from "@/lib/firebase-admin";

function mapOpenWeatherCondition(weatherMain: string, weatherIcon: string): WeatherCondition {
    const main = weatherMain.toLowerCase();
    const isDay = weatherIcon.endsWith('d');

    if (main.includes('thunderstorm')) return 'Thunderstorm';
    if (main.includes('drizzle') || main.includes('rain')) return 'Rainy';
    if (main.includes('snow')) return 'Snow';
    if (['mist', 'smoke', 'haze', 'dust', 'fog', 'sand', 'ash', 'squall', 'tornado'].includes(main)) return 'Fog';

    if (main.includes('clear')) {
        return isDay ? 'ClearDay' : 'ClearNight';
    }

    if (main.includes('clouds')) {
        // OWM uses different icon codes for cloud coverage. e.g. 02: few, 03: scattered, 04: broken/overcast
        if (weatherIcon.startsWith('02')) { // few clouds
            return isDay ? 'PartlyCloudyDay' : 'PartlyCloudyNight';
        }
         if (weatherIcon.startsWith('03')) { // scattered clouds
            return isDay ? 'PartlyCloudyDay' : 'PartlyCloudyNight';
        }
        return 'Cloudy'; // broken clouds, overcast clouds
    }

    // Default fallback
    return isDay ? 'ClearDay' : 'ClearNight';
}


async function getActiveSpell(cityName: string): Promise<Spell | null> {
    try {
        const snapshot = await db.collection('spells')
            .where('cityName', '==', cityName)
            .where('status', '==', 'active')
            .limit(1)
            .get();

        if (snapshot.empty) {
            return null;
        }

        const doc = snapshot.docs[0];
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            startTime: data.startTime.toDate(),
            endTime: data.endTime ? data.endTime.toDate() : undefined,
        } as Spell;
    } catch (error) {
        // This will fail in local dev without credentials, which is fine.
        if (process.env.NODE_ENV !== 'production') {
            return null;
        }
        console.error("Error fetching active spell:", error);
        return null;
    }
}


// New mock data generation function for local development
function generateMockWeatherData(): WeatherData[] {
    const mockCities = [
        { name: 'Lahore', id: '1172451' },
        { name: 'Karachi', id: '1174872' },
        { name: 'Islamabad', id: '1176615' },
        { name: 'Faisalabad', id: '1179400' },
        { name: 'Rawalpindi', id: '1167151' },
        { name: 'Multan', id: '1169824' },
        { name: 'Peshawar', id: '1168243' },
        { name: 'Quetta', id: '1167429' },
    ];

    const conditions: WeatherCondition[] = ['ClearDay', 'ClearNight', 'PartlyCloudyDay', 'PartlyCloudyNight', 'Cloudy', 'Rainy', 'Thunderstorm', 'Fog', 'Snow'];

    return mockCities.map(city => {
        let condition = conditions[Math.floor(Math.random() * conditions.length)];
        const isSpellActive = Math.random() > 0.5;
        
        // If a spell is active, the visual should represent rain.
        if (isSpellActive && !['Rainy', 'Thunderstorm', 'Snow'].includes(condition)) {
            condition = 'Rainy';
        }

        return {
            id: city.id,
            city: city.name,
            condition: condition,
            temperature: Math.floor(Math.random() * 20) + 15, // Temp between 15 and 35
            lastUpdated: new Date(),
            isSpellActive: isSpellActive,
        };
    });
}


export async function fetchWeatherData(): Promise<WeatherData[]> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error("The OpenWeatherMap API key is missing. For production, you must set the OPENWEATHERMAP_API_KEY environment variable in your hosting provider's settings.");
    } else {
        console.log("OpenWeatherMap API key missing or running locally without credentials. Generating mock data for development.");
        return generateMockWeatherData();
    }
  }
  
  const cities = await getCities();

  if (!cities || cities.length === 0) {
      if (process.env.NODE_ENV !== 'production') {
          console.log("No cities found in DB. Generating mock data for local development.");
          return generateMockWeatherData();
      }
      console.log("No cities found in the database.");
      return [];
  }

  const weatherPromises = cities.map(async (city) => {
    try {
      // Use OpenWeatherMap API
      const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${city.latitude}&lon=${city.longitude}&appid=${apiKey}&units=metric`;
      
      const [weatherResponse, activeSpell] = await Promise.all([
          fetch(weatherUrl, { next: { revalidate: 3600 } }), // Revalidate every hour
          getActiveSpell(city.name)
      ]);

      if (!weatherResponse.ok) {
         if (weatherResponse.status === 401) throw new Error("The configured OpenWeatherMap API key seems to be invalid or has been disabled.");
         console.error(`Failed to fetch OpenWeatherMap data for ${city.name}: ${weatherResponse.status} ${weatherResponse.statusText}`);
         return null;
      }
      
      const weatherInfo = await weatherResponse.json();
      
      if (!weatherInfo || !weatherInfo.weather || weatherInfo.weather.length === 0) {
        console.warn(`No weather data returned from OpenWeatherMap for ${city.name}.`);
        return null;
      }
      
      const isSpellActive = !!activeSpell;
      let condition = mapOpenWeatherCondition(weatherInfo.weather[0].main, weatherInfo.weather[0].icon);

      // If a spell is active, the visual should represent rain, unless it's a more severe condition.
      if (isSpellActive && !['Rainy', 'Thunderstorm', 'Snow'].includes(condition)) {
          condition = 'Rainy';
      }

      const weatherData: WeatherData = {
        id: String(weatherInfo.id),
        city: city.name, // Use the name from Firestore for consistency
        condition: condition,
        temperature: Math.round(weatherInfo.main.temp),
        lastUpdated: new Date(weatherInfo.dt * 1000),
        isSpellActive: isSpellActive,
      };
      return weatherData;
    } catch (error) {
      if (error instanceof Error && error.message.includes("API key")) {
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
    if (process.env.NODE_ENV === 'production') {
        throw new Error("The OpenWeatherMap API key is missing. For production, you must set the OPENWEATHERMAP_API_KEY environment variable in your hosting provider's settings.");
    } else {
        console.log(`API key missing or local env. Generating mock data for searched city: ${city}`);
        const conditions: WeatherCondition[] = ['ClearDay', 'ClearNight', 'PartlyCloudyDay', 'PartlyCloudyNight', 'Cloudy', 'Rainy', 'Thunderstorm', 'Fog', 'Snow'];
        let condition = conditions[Math.floor(Math.random() * conditions.length)];
        const isSpellActive = Math.random() > 0.5;
        
        if (isSpellActive && !['Rainy', 'Thunderstorm', 'Snow'].includes(condition)) {
            condition = 'Rainy';
        }
        
        return {
            id: city.toLowerCase().replace(/\s/g, ''),
            city: city,
            condition: condition,
            temperature: Math.floor(Math.random() * 20) + 15,
            lastUpdated: new Date(),
            isSpellActive: isSpellActive,
        };
    }
  }

  try {
    // Step 1: Get lat/lon from city name using OpenWeatherMap Geocoding API
    const geocodeUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)},PK&limit=1&appid=${apiKey}`;
    const geocodeResponse = await fetch(geocodeUrl, { next: { revalidate: 86400 } });

    if (!geocodeResponse.ok) {
        if (geocodeResponse.status === 401) throw new Error("The configured OpenWeatherMap API key seems to be invalid or has been disabled.");
        console.error(`Failed to search OpenWeatherMap city for ${city}: ${geocodeResponse.status} ${geocodeResponse.statusText}`);
        return null;
    }

    const geocodeData = await geocodeResponse.json();
    if (!geocodeData || geocodeData.length === 0) {
        console.warn(`City not found via OpenWeatherMap: ${city}`);
        return null;
    }

    const { lat, lon, name: locationName } = geocodeData[0];

    // Step 2: Get weather data
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    
    const [weatherResponse, activeSpell] = await Promise.all([
        fetch(weatherUrl),
        getActiveSpell(locationName)
    ]);
    
    if (!weatherResponse.ok) {
       return null;
    }
    const weatherInfo = await weatherResponse.json();
    
    if (!weatherInfo || !weatherInfo.weather || weatherInfo.weather.length === 0) {
      return null;
    }

    const isSpellActive = !!activeSpell;
    let condition = mapOpenWeatherCondition(weatherInfo.weather[0].main, weatherInfo.weather[0].icon);

    if (isSpellActive && !['Rainy', 'Thunderstorm', 'Snow'].includes(condition)) {
        condition = 'Rainy';
    }

    const weatherData: WeatherData = {
      id: String(weatherInfo.id),
      city: locationName,
      condition: condition,
      temperature: Math.round(weatherInfo.main.temp),
      lastUpdated: new Date(weatherInfo.dt * 1000),
      isSpellActive: isSpellActive
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
