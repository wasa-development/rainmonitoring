'use server';
/**
 * @fileOverview A flow to get current weather data for a city using Google's AI.
 *
 * - getWeatherForCity - A function that fetches weather data.
 * - WeatherInput - The input type for the getWeatherForCity function.
 * - WeatherOutput - The return type for the getWeatherForCity function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Define the possible weather conditions that the AI should use.
// This matches the app's internal WeatherCondition type.
const WeatherConditionSchema = z.enum([
    'ClearDay',
    'ClearNight',
    'PartlyCloudyDay',
    'PartlyCloudyNight',
    'Cloudy',
    'Rainy',
    'Thunderstorm',
    'Snow',
    'Fog',
]);

const WeatherInputSchema = z.object({
    city: z.string().describe('The city name to get the weather for, e.g., "Lahore".'),
});
export type WeatherInput = z.infer<typeof WeatherInputSchema>;

const WeatherOutputSchema = z.object({
    temperature: z.number().describe('The current temperature in Celsius.'),
    condition: WeatherConditionSchema.describe('The current weather condition, mapped to one of the allowed types.'),
});
export type WeatherOutput = z.infer<typeof WeatherOutputSchema>;

// The exported function that will be called from server actions.
export async function getWeatherForCity(input: WeatherInput): Promise<WeatherOutput> {
    return getWeatherFlow(input);
}

// Define the prompt for the AI model.
const getWeatherPrompt = ai.definePrompt({
    name: 'getWeatherPrompt',
    input: { schema: WeatherInputSchema },
    output: { schema: WeatherOutputSchema },
    // Instructions for the AI
    prompt: `You are a weather assistant. The user will provide a city name.
    Your task is to find the current weather for that city.
    You MUST determine the temperature in Celsius.
    
    Based on the weather and time of day, you MUST classify the current weather condition into ONE of these specific categories: 
    ClearDay, ClearNight, PartlyCloudyDay, PartlyCloudyNight, Cloudy, Rainy, Thunderstorm, Snow, Fog.
    
    For example:
    - If it's sunny and daytime, use 'ClearDay'.
    - If it's clear and nighttime, use 'ClearNight'.
    - If there are some clouds during the day, use 'PartlyCloudyDay'.
    - If it is raining, use 'Rainy'.
    - Use the most accurate, real-time data available to you.
    
    City: {{{city}}}
    `,
    // Using a model that is good at following instructions and has tool use.
    config: {
        model: 'googleai/gemini-2.0-flash',
    }
});

// Define the Genkit flow.
const getWeatherFlow = ai.defineFlow(
    {
        name: 'getWeatherFlow',
        inputSchema: WeatherInputSchema,
        outputSchema: WeatherOutputSchema,
    },
    async (input) => {
        const llmResponse = await getWeatherPrompt(input);
        const weatherData = llmResponse.output;

        if (!weatherData) {
            throw new Error(`Could not get weather data for ${input.city}`);
        }

        return weatherData;
    }
);
