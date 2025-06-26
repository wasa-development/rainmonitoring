
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
        // This can fail in local dev without credentials, which is fine for this specific check.
        // We will catch the broader credential issue in the main functions.
        return null;
    }
}


export async function fetchWeatherData(): Promise<WeatherData[]> {
  const hasGoogleCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_CLIENT_EMAIL;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!hasGoogleCredentials) {
    if (!isProduction) {
        console.warn("****************************************************************************************************");
        console.warn("WARNING: Google credentials not found for local development.");
        console.warn("The application will not be able to fetch real weather data.");
        console.warn("Please see the instructions in `src/lib/firebase-admin.ts` to set them up.");
        console.warn("****************************************************************************************************");
    } else {
        console.error("CRITICAL: Google credentials not found in production environment. Weather data will be unavailable.");
    }
    return []; // Return empty array if no credentials, preventing mock data and crashes.
  }

  try {
    const cities = await getCities();

    if (!cities || cities.length === 0) {
      console.log("No cities found in the database. Returning empty array.");
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
  } catch (error) {
      console.error("An error occurred while trying to fetch weather data. This could be a Firestore connection issue.", error);
      return []; // Return empty array on any top-level error.
  }
}


export async function fetchWeatherForCity(cityName: string): Promise<WeatherData | null> {
    const hasGoogleCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_CLIENT_EMAIL;
  
    if (!hasGoogleCredentials) {
       console.warn(`Cannot search for city "${cityName}" because Google credentials are not configured for local development.`);
       return null;
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
