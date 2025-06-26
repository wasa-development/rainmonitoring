
'use server';

import type { Spell, WeatherData, WeatherCondition } from "@/lib/types";
import { getCities } from "./admin/actions";
import { db } from "@/lib/firebase-admin";
import { getWeatherForCity as getAiWeather } from '@/ai/flows/get-weather-flow';

async function getActiveSpell(cityName: string): Promise<Spell | null> {
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
}


export async function fetchWeatherData(): Promise<WeatherData[]> {
  const hasGoogleCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_CLIENT_EMAIL;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!hasGoogleCredentials && !isProduction) {
    console.warn("****************************************************************************************************");
    console.warn("WARNING: Google credentials not found for local development.");
    console.warn("The application will not be able to fetch real weather data, returning empty.");
    console.warn("Please see the instructions in `src/lib/firebase-admin.ts` to set them up.");
    console.warn("****************************************************************************************************");
    return []; // Return empty array if no credentials, preventing crashes but making it clear why data is missing.
  }

  let cities;
  try {
    cities = await getCities();
  } catch (error) {
     console.error("Critical error fetching cities from Firestore. This might be a database connection or permission issue.", error);
     // Re-throw as a more user-friendly error to be displayed on the UI.
     throw new Error("Could not connect to the database to fetch the list of cities. Please check your configuration.");
  }


  if (!cities || cities.length === 0) {
    console.log("No cities found in the database. Returning empty array.");
    return [];
  }

  const weatherPromises = cities.map(async (city) => {
    // This promise will now throw an error on failure, which Promise.allSettled will catch.
    const [aiWeather, activeSpell] = await Promise.all([
      getAiWeather({ city: city.name }),
      getActiveSpell(city.name),
    ]);

    const isSpellActive = !!activeSpell;
    let condition = aiWeather.condition;

    // If a spell is active, the visual should represent rain, unless it's a more severe condition.
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
  
  // Use Promise.allSettled to handle both successful and failed promises
  const settledResults = await Promise.allSettled(weatherPromises);
  
  const successfulData: WeatherData[] = [];
  const errors: { city: string, reason: string }[] = [];

  settledResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
          successfulData.push(result.value);
      } else {
          // An error occurred for this city
          const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
          errors.push({ city: cities[index].name, reason });
          console.error(`Failed to fetch weather for ${cities[index].name}:`, result.reason);
      }
  });

  // If ALL cities failed, it's a critical error. Throw an informative message to the UI.
  if (successfulData.length === 0 && cities.length > 0) {
      const firstErrorReason = errors[0]?.reason || "An unknown error occurred.";
      throw new Error(`Failed to fetch weather for all cities. This could be a configuration or network issue. Example error: "${firstErrorReason}"`);
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
