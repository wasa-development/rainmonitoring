
'use server';

import type { Spell, WeatherData, WeatherCondition } from "@/lib/types";
import { getCities } from "./admin/actions";
import { db } from "@/lib/firebase-admin";

// This function maps the condition code from OpenWeatherMap to our app's WeatherCondition type.
function mapOpenWeatherToCondition(icon: string): WeatherCondition {
    const mapping: { [key: string]: WeatherCondition } = {
        '01d': 'ClearDay',
        '01n': 'ClearNight',
        '02d': 'PartlyCloudyDay',
        '02n': 'PartlyCloudyNight',
        '03d': 'Cloudy',
        '03n': 'Cloudy',
        '04d': 'Cloudy',
        '04n': 'Cloudy',
        '09d': 'Rainy',
        '09n': 'Rainy',
        '10d': 'Rainy',
        '10n': 'Rainy',
        '11d': 'Thunderstorm',
        '11n': 'Thunderstorm',
        '13d': 'Snow',
        '13n': 'Snow',
        '50d': 'Fog',
        '50n': 'Fog',
    };
    return mapping[icon] || 'ClearDay'; // Default to ClearDay if icon is unknown
}

function getMockWeatherData(): WeatherData[] {
    const mockCities = ["Lahore", "Faisalabad", "Rawalpindi", "Multan", "Gujranwala", "Sialkot", "Sargodha", "Bahawalpur"];
    const conditions: WeatherCondition[] = ['ClearNight', 'PartlyCloudyDay', 'PartlyCloudyNight', 'Cloudy', 'Rainy', 'Thunderstorm', 'Snow', 'Fog'];

    const otherCitiesData = mockCities.map(city => {
        const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
        return {
            id: city.toLowerCase().replace(/\s/g, ''),
            city: city,
            condition: randomCondition,
            temperature: Math.floor(Math.random() * 25) + 15, // Temp between 15 and 40
            lastUpdated: new Date(),
            isSpellActive: Math.random() > 0.8 // 20% chance of spell being active
        };
    });
    
    const islamabadData: WeatherData = {
        id: 'islamabad',
        city: 'Islamabad',
        condition: 'ClearDay',
        temperature: Math.floor(Math.random() * 15) + 20, // A pleasant temp for clear weather: 20-34 C
        lastUpdated: new Date(),
        isSpellActive: false
    };
    
    const karachiData: WeatherData = {
        id: 'karachi',
        city: 'Karachi',
        condition: 'Rainy',
        temperature: Math.floor(Math.random() * 10) + 25, // Rainy temp: 25-34 C
        lastUpdated: new Date(),
        isSpellActive: false
    };

    return [islamabadData, karachiData, ...otherCitiesData];
}


async function getWeatherFromOpenWeatherMap(cityName: string): Promise<Omit<WeatherData, 'id' | 'lastUpdated' | 'isSpellActive'>> {
    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) {
        console.error("OpenWeatherMap API key is not configured.");
        throw new Error("Server configuration error: Weather service is unavailable.");
    }
    
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityName)}&appid=${apiKey}&units=metric`;

    const response = await fetch(url);

    if (!response.ok) {
        if (response.status === 404) {
            throw new Error(`City not found: ${cityName}`);
        } else {
            const errorData = await response.json();
            throw new Error(`Failed to fetch weather for ${cityName}: ${errorData.message || response.statusText}`);
        }
    }
    
    const data = await response.json();

    const condition = mapOpenWeatherToCondition(data.weather[0].icon);
    
    return {
        city: data.name,
        condition: condition,
        temperature: Math.round(data.main.temp),
    };
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
        console.error(`Error fetching active spell for ${cityName}:`, error);
        throw new Error(`Database error while checking for active spells for city: ${cityName}.`);
    }
}


export async function fetchWeatherData(): Promise<WeatherData[]> {
  let cities;
  try {
    cities = await getCities();
  } catch (error) {
     console.error("Critical error fetching cities from Firestore. This might be a database connection or permission issue.", error);
     // Fall through to allow mock data to be displayed locally
     cities = [];
  }

  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction && (!cities || cities.length === 0)) {
    const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'NOT_FOUND';
    const warningMessage = `WARNING: No cities found in Firestore. This could be a configuration issue. Please verify:\n1. Your environment (.env.local) is configured with the correct Firebase project (Project ID seems to be '${projectId}').\n2. The service account being used has permissions to read from Firestore (e.g., 'Cloud Datastore User' role).\n3. The 'cities' collection in your Firestore database is not empty.`;
    console.warn("****************************************************************************************************");
    console.warn(warningMessage);
    console.warn("----> DISPLAYING MOCK DATA FOR LOCAL DEVELOPMENT <----");
    console.warn("****************************************************************************************************");
    return getMockWeatherData();
  }

  if (isProduction && (!cities || cities.length === 0)) {
    console.log("No cities found in the database. Returning empty array for production.");
    return [];
  }


  const weatherPromises = cities!.map(async (city) => {
    const [apiWeather, activeSpell] = await Promise.all([
      getWeatherFromOpenWeatherMap(city.name),
      getActiveSpell(city.name),
    ]);

    const isSpellActive = !!activeSpell;
    let condition = apiWeather.condition;

    if (isSpellActive && !['Rainy', 'Thunderstorm', 'Snow'].includes(condition)) {
      condition = 'Rainy';
    }

    return {
      id: city.id,
      city: apiWeather.city,
      condition: condition,
      temperature: apiWeather.temperature,
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
          errors.push({ city: cities![index].name, reason });
          console.error(`Failed to fetch weather for ${cities![index].name}:`, result.reason);
      }
  });

  if (successfulData.length === 0 && cities!.length > 0) {
    if (!isProduction && !process.env.OPENWEATHERMAP_API_KEY) {
        console.warn("****************************************************************************************************");
        console.warn("WARNING: OPENWEATHERMAP_API_KEY is missing. Real weather data could not be fetched.");
        console.warn("----> DISPLAYING MOCK DATA FOR LOCAL DEVELOPMENT <----");
        console.warn("****************************************************************************************************");
        return getMockWeatherData();
    }
    
    // For other errors (e.g., network issues, invalid key)
    const firstErrorReason = errors[0]?.reason || "An unknown error occurred.";
    throw new Error(`Failed to fetch weather for all cities. The OPENWEATHERMAP_API_KEY is likely missing from your environment variables.`);
  }

  if (!isProduction) {
    const islamabadData: WeatherData = {
        id: 'islamabad',
        city: 'Islamabad',
        condition: 'ClearDay',
        temperature: Math.floor(Math.random() * 15) + 20, // A pleasant temp for clear weather: 20-34 C
        lastUpdated: new Date(),
        isSpellActive: false
    };
    
    const karachiData: WeatherData = {
        id: 'karachi',
        city: 'Karachi',
        condition: 'Rainy',
        temperature: Math.floor(Math.random() * 10) + 25, // Rainy temp: 25-34 C
        lastUpdated: new Date(),
        isSpellActive: false
    };

    // Remove any existing mock city data to avoid duplicates, then add our mock data to the front.
    const otherCities = successfulData.filter(city => !['islamabad', 'karachi'].includes(city.city.toLowerCase()));
    return [islamabadData, karachiData, ...otherCities];
  }

  return successfulData;
}


export async function fetchWeatherForCity(cityName: string): Promise<WeatherData | null> {
    const isProduction = process.env.NODE_ENV === 'production';
    if (!isProduction) {
        const mockData = getMockWeatherData();
        const mockCity = mockData.find(c => c.city.toLowerCase() === cityName.toLowerCase());
        if (mockCity) {
            console.log(`Returning mock data for searched city: ${cityName}`);
            return {
                ...mockCity,
                lastUpdated: new Date() // Ensure lastUpdated is fresh on search
            };
        }
    }
    
    if (!process.env.OPENWEATHERMAP_API_KEY) {
        console.warn(`Cannot search for city "${cityName}" because OPENWEATHERMAP_API_KEY is not configured.`);
        return null;
    }

    try {
        const [apiWeather, activeSpell] = await Promise.all([
            getWeatherFromOpenWeatherMap(cityName),
            getActiveSpell(cityName)
        ]);

        if (!apiWeather) {
            return null;
        }

        const isSpellActive = !!activeSpell;
        let condition = apiWeather.condition;
    
        if (isSpellActive && !['Rainy', 'Thunderstorm', 'Snow'].includes(condition)) {
            condition = 'Rainy';
        }
    
        const weatherData: WeatherData = {
          id: cityName.toLowerCase().replace(/\s/g, ''),
          city: apiWeather.city,
          condition: condition,
          temperature: Math.round(apiWeather.temperature),
          lastUpdated: new Date(),
          isSpellActive: isSpellActive
        };
        return weatherData;
    } catch (error) {
        console.error(`Error fetching weather for ${cityName}:`, error);
        return null;
    }
}
