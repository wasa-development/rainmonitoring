
'use server';

import type { Spell, WeatherData, WeatherCondition } from "@/lib/types";
import { getCities } from "./admin/actions";
import { db } from "@/lib/firebase-admin";
import { getWeatherForCity as getAiWeather } from '@/ai/flows/get-weather-flow';

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


export async function fetchWeatherData(): Promise<WeatherData[]> {
  // Check if Google credentials are likely available
  const hasGoogleCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_PROJECT_ID;

  if (!hasGoogleCredentials) {
    if (process.env.NODE_ENV === 'production') {
        // In production, credentials should always be available.
        throw new Error("Google Application Credentials are not configured. This is required for production.");
    } else {
        console.log("Google credentials missing. Returning empty list for development. Please configure credentials to fetch data.");
        return [];
    }
  }
  
  const cities = await getCities();

  if (!cities || cities.length === 0) {
      console.log("No cities found in the database. Returning empty list.");
      return [];
  }

  const weatherPromises = cities.map(async (city) => {
    try {
      const [aiWeather, activeSpell] = await Promise.all([
          getAiWeather({ city: city.name }),
          getActiveSpell(city.name)
      ]);

      if (!aiWeather) {
         console.error(`Failed to fetch AI weather data for ${city.name}`);
         return null;
      }
      
      const isSpellActive = !!activeSpell;
      let condition = aiWeather.condition;

      // If a spell is active, the visual should represent rain, unless it's a more severe condition.
      if (isSpellActive && !['Rainy', 'Thunderstorm', 'Snow'].includes(condition)) {
          condition = 'Rainy';
      }

      const weatherData: WeatherData = {
        id: city.id, // Using the ID from our DB
        city: city.name,
        condition: condition,
        temperature: Math.round(aiWeather.temperature),
        lastUpdated: new Date(),
        isSpellActive: isSpellActive,
      };
      return weatherData;
    } catch (error) {
      console.error(`Error fetching AI weather for ${city.name}:`, error);
      return null; // Return null for this city if the AI call fails
    }
  });

  const results = await Promise.all(weatherPromises);
  return results.filter((data): data is WeatherData => data !== null);
}


export async function fetchWeatherForCity(cityName: string): Promise<WeatherData | null> {
    const hasGoogleCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_PROJECT_ID;
  
    if (!hasGoogleCredentials) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error("Google Application Credentials are not configured. This is required for production.");
        } else {
            console.log(`Google credentials missing. Cannot fetch data for searched city: ${cityName}`);
            return null;
        }
    }

    try {
        const [aiWeather, activeSpell] = await Promise.all([
            getAiWeather({ city: cityName }),
            getActiveSpell(cityName)
        ]);

        if (!aiWeather) {
            console.warn(`AI could not find weather for city: ${cityName}`);
            return null;
        }

        const isSpellActive = !!activeSpell;
        let condition = aiWeather.condition;
    
        if (isSpellActive && !['Rainy', 'Thunderstorm', 'Snow'].includes(condition)) {
            condition = 'Rainy';
        }
    
        const weatherData: WeatherData = {
          id: cityName.toLowerCase().replace(/\s/g, ''), // Create a simple ID for searched cities
          city: cityName,
          condition: condition,
          temperature: Math.round(aiWeather.temperature),
          lastUpdated: new Date(),
          isSpellActive: isSpellActive
        };
        return weatherData;
    } catch (error) {
        console.error(`Error fetching AI weather for ${cityName}:`, error);
        // Don't re-throw, just return null as the function signature suggests.
        return null;
    }
}
