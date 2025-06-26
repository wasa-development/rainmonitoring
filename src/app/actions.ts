
'use server';

import type { Spell, WeatherData, WeatherCondition } from "@/lib/types";
import { getCities } from "./admin/actions";
import { db } from "@/lib/firebase-admin";
import { getWeatherForCity as getAiWeather } from '@/ai/flows/get-weather-flow';

function generateMockWeatherData(): WeatherData[] {
    const mockCities = ["Lahore", "Karachi", "Islamabad", "Peshawar", "Quetta", "Multan", "Faisalabad", "Sialkot", "Gujranwala", "Rawalpindi", "Hyderabad", "Sukkur", "Bahawalpur", "Sargodha", "Mirpur Khas"];
    const conditions: WeatherCondition[] = ['ClearDay', 'PartlyCloudyDay', 'Cloudy', 'Rainy', 'Thunderstorm', 'Fog', 'Snow', 'ClearNight', 'PartlyCloudyNight'];
    
    return mockCities.map(city => {
        const condition = conditions[Math.floor(Math.random() * conditions.length)];
        return {
            id: city.toLowerCase().replace(/\s/g, ''),
            city: city,
            condition: condition,
            temperature: Math.floor(Math.random() * 25) + 15, // Temp between 15 and 40
            lastUpdated: new Date(Date.now() - Math.random() * 1000 * 60 * 60), // a random time within the last hour
            isSpellActive: condition === 'Rainy' || condition === 'Thunderstorm',
        };
    });
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
        // This can fail in local dev without credentials, which is fine for this specific check.
        // We will catch the broader credential issue in the main functions.
        return null;
    }
}


export async function fetchWeatherData(): Promise<WeatherData[]> {
  // Check if Google credentials are likely available
  const hasGoogleCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_CLIENT_EMAIL;

  if (!hasGoogleCredentials) {
    console.log("Google credentials not found for local development. Returning mock data.");
    return generateMockWeatherData();
  }
  
  // Try to fetch real data, but if it fails (e.g. firestore connection fails locally), fall back to mock data.
  try {
    const cities = await getCities();

    // If there are no cities in the database, still show mock data locally for a better dev experience.
    if (!cities || cities.length === 0) {
        console.log("No cities found in the database. Returning mock data for local development.");
        return generateMockWeatherData();
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
      console.error("An error occurred fetching real weather data, likely due to local credential issues. Falling back to mock data.", error);
      return generateMockWeatherData();
  }
}


export async function fetchWeatherForCity(cityName: string): Promise<WeatherData | null> {
    const hasGoogleCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_CLIENT_EMAIL;
  
    if (!hasGoogleCredentials) {
       console.log("Google credentials not found for local development. Returning mock data for searched city.");
       const conditions: WeatherCondition[] = ['ClearDay', 'PartlyCloudyDay', 'Cloudy', 'Rainy', 'Thunderstorm', 'Fog'];
       const condition = conditions[Math.floor(Math.random() * conditions.length)];
       return {
            id: cityName.toLowerCase().replace(/\s/g, ''),
            city: cityName,
            condition: condition,
            temperature: Math.floor(Math.random() * 25) + 15,
            lastUpdated: new Date(),
            isSpellActive: condition === 'Rainy' || condition === 'Thunderstorm',
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
