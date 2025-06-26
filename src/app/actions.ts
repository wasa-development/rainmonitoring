
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
        console.error(`Error fetching active spell for ${cityName}:`, error);
        // Re-throw to ensure the calling function is aware of the failure.
        throw new Error(`Database error while checking for active spells for city: ${cityName}.`);
    }
}


export async function fetchWeatherData(): Promise<WeatherData[]> {
  const hasGoogleCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_CLIENT_EMAIL;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!hasGoogleCredentials && !isProduction) {
    console.warn("****************************************************************************************************");
    console.warn("WARNING: Google credentials not found for local development.");
    console.warn("The application will not be able to fetch real weather data, returning empty.");
    console.warn("Please see the instructions in `src/lib/firebase-admin.ts` to set them up.");
    return []; 
  }

  let cities;
  try {
    cities = await getCities();
  } catch (error) {
     console.error("Critical error fetching cities from Firestore. This might be a database connection or permission issue.", error);
     throw new Error("Could not connect to the database to fetch the list of cities. Please check your configuration.");
  }


  if (!cities || cities.length === 0) {
    if (isProduction) {
      console.log("No cities found in the database. Returning empty array for production.");
      return [];
    } else {
      // For local development, this is a strong sign of a configuration issue.
      const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'NOT_FOUND';
      const warningMessage = `WARNING: No cities found in Firestore. This could be a configuration issue. Please verify:\n1. Your environment (.env.local) is configured with the correct Firebase project (Project ID seems to be '${projectId}').\n2. The service account being used has permissions to read from Firestore (e.g., 'Cloud Datastore User' role).\n3. The 'cities' collection in your Firestore database is not empty.`;
      console.warn("****************************************************************************************************");
      console.warn(warningMessage);
      console.warn("****************************************************************************************************");
    }
    return []; // Return empty array instead of throwing an error to avoid crashing the app.
  }

  const weatherPromises = cities.map(async (city) => {
    const [aiWeather, activeSpell] = await Promise.all([
      getAiWeather({ city: city.name }),
      getActiveSpell(city.name),
    ]);

    const isSpellActive = !!activeSpell;
    let condition = aiWeather.condition;

    if (isSpellActive && !['Rainy', 'Thunderstorm', 'Snow'].includes(condition)) {
      condition = 'Rainy';
    }

    return {
      id: city.id,
      city: city.name,
      condition: condition,
      temperature: Math.round(aiWeather.temperature),
      lastUpdated: new Date(),
      isSpellActive: isSpellActive,
    } as WeatherData;
  });
  
  const settledResults = await Promise.allSettled(weatherPromises);
  
  const successfulData: WeatherData[] = [];
  const errors: { city: string, reason: string }[] = [];

  settledResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
          successfulData.push(result.value);
      } else {
          const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
          errors.push({ city: cities[index].name, reason });
          console.error(`Failed to fetch weather for ${cities[index].name}:`, result.reason);
      }
  });

  if (successfulData.length === 0 && cities.length > 0) {
      const firstErrorReason = errors[0]?.reason || "An unknown error occurred.";
      throw new Error(`Failed to fetch weather for all cities. This is likely a configuration or network issue. Example error: "${firstErrorReason}"`);
  }

  return successfulData;
}


export async function fetchWeatherForCity(cityName: string): Promise<WeatherData | null> {
    const hasGoogleCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_CLIENT_EMAIL;
    const isProduction = process.env.NODE_ENV === 'production';
  
    if (!hasGoogleCredentials && !isProduction) {
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
          id: cityName.toLowerCase().replace(/\s/g, ''),
          city: cityName,
          condition: condition,
          temperature: Math.round(aiWeather.temperature),
          lastUpdated: new Date(),
          isSpellActive: isSpellActive
        };
        return weatherData;
    } catch (error) {
        console.error(`Error fetching AI weather for ${cityName}:`, error);
        return null;
    }
}
