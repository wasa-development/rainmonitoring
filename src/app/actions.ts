'use server';

import type { Spell, WeatherData } from "@/lib/types";
import { getCities } from "./admin/actions";
import { db } from "@/lib/firebase-admin";

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
        console.error("Error fetching active spell:", error);
        return null;
    }
}


export async function fetchWeatherData(): Promise<WeatherData[]> {
  const apiKey = process.env.ACCUWEATHER_API_KEY;

  if (!apiKey) {
    throw new Error("The AccuWeather API key is missing. For production, you must set the ACCUWEATHER_API_KEY environment variable in your hosting provider's settings.");
  }
  
  const cities = await getCities();

  if (!cities || cities.length === 0) {
      console.log("No cities found in the database.");
      return [];
  }

  const weatherPromises = cities.map(async (city) => {
    try {
      // Step 1: Get Location Key from latitude and longitude
      const locationUrl = `https://dataservice.accuweather.com/locations/v1/cities/geoposition/search?apikey=${apiKey}&q=${city.latitude},${city.longitude}`;
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

      // Step 2 & 3: Get Current Conditions, Forecast and Spell status concurrently
      const weatherUrl = `https://dataservice.accuweather.com/currentconditions/v1/${locationKey}?apikey=${apiKey}`;
      const forecastUrl = `https://dataservice.accuweather.com/forecasts/v1/daily/1day/${locationKey}?apikey=${apiKey}&metric=true`;

      const [weatherResponse, forecastResponse, activeSpell] = await Promise.all([
          fetch(weatherUrl, { next: { revalidate: 3600 } }), // Revalidate every hour
          fetch(forecastUrl, { next: { revalidate: 21600 } }), // Revalidate every 6 hours
          getActiveSpell(city.name)
      ]);
      
      if (!weatherResponse.ok) {
        console.error(`Failed to fetch weather for ${city.name}: ${weatherResponse.status} ${weatherResponse.statusText}`);
        return null;
      }
      const weatherDataArr = await weatherResponse.json();
      
      if (!weatherDataArr || weatherDataArr.length === 0) {
        console.warn(`No weather data returned from AccuWeather for ${city.name}.`);
        return null;
      }
      
      // Handle forecast response
      let forecastData = null;
      if (forecastResponse.ok) {
          const forecastJson = await forecastResponse.json();
          if (forecastJson && forecastJson.DailyForecasts && forecastJson.DailyForecasts.length > 0) {
              const dayForecast = forecastJson.DailyForecasts[0].Day;
              if (dayForecast.HasPrecipitation) {
                forecastData = {
                    hasPrecipitation: true,
                    precipitationType: dayForecast.PrecipitationType,
                };
              }
          }
      } else {
          console.warn(`Failed to fetch forecast for ${city.name}: ${forecastResponse.status} ${forecastResponse.statusText}`);
      }

      const weatherInfo = weatherDataArr[0];
      const weatherData: WeatherData = {
        id: locationKey,
        city: city.name, // Use the name from Firestore for consistency
        condition: mapAccuWeatherCondition(weatherInfo.WeatherText),
        temperature: Math.round(weatherInfo.Temperature.Metric.Value),
        lastUpdated: new Date(weatherInfo.EpochTime * 1000),
        forecast: forecastData,
        isSpellActive: !!activeSpell,
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
    throw new Error("The AccuWeather API key is missing. For production, you must set the ACCUWEATHER_API_KEY environment variable in your hosting provider's settings.");
  }

  try {
    // Step 1: Get Location Key from city name search
    const locationUrl = `https://dataservice.accuweather.com/locations/v1/cities/search?apikey=${apiKey}&q=${encodeURIComponent(city)}`;
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

    // Step 2 & 3: Get Current Conditions, Forecast and Spell status
    const weatherUrl = `https://dataservice.accuweather.com/currentconditions/v1/${locationKey}?apikey=${apiKey}`;
    const forecastUrl = `https://dataservice.accuweather.com/forecasts/v1/daily/1day/${locationKey}?apikey=${apiKey}&metric=true`;

    const [weatherResponse, forecastResponse, activeSpell] = await Promise.all([
        fetch(weatherUrl),
        fetch(forecastUrl),
        getActiveSpell(locationName)
    ]);
    
    if (!weatherResponse.ok) {
       return null;
    }
    const weatherDataArr = await weatherResponse.json();
    
    if (!weatherDataArr || weatherDataArr.length === 0) {
      return null;
    }
    
    // Handle forecast response
    let forecastData = null;
    if (forecastResponse.ok) {
        const forecastJson = await forecastResponse.json();
        if (forecastJson && forecastJson.DailyForecasts && forecastJson.DailyForecasts.length > 0) {
            const dayForecast = forecastJson.DailyForecasts[0].Day;
            if (dayForecast.HasPrecipitation) {
              forecastData = {
                  hasPrecipitation: true,
                  precipitationType: dayForecast.PrecipitationType
              };
            }
        }
    }

    const weatherInfo = weatherDataArr[0];
    const weatherData: WeatherData = {
      id: locationKey,
      city: locationName,
      condition: mapAccuWeatherCondition(weatherInfo.WeatherText),
      temperature: Math.round(weatherInfo.Temperature.Metric.Value),
      lastUpdated: new Date(weatherInfo.EpochTime * 1000),
      forecast: forecastData,
      isSpellActive: !!activeSpell
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
