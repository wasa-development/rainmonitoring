# **App Name**: Pakistan Weather Pulse

## Core Features:

- Weather Data Fetch: Fetches weather data from OpenWeatherMap API for 15 cities in Pakistan.
- Firestore Storage: Stores hourly weather data in Firestore, timestamped for each update.
- City Weather Cards: Displays city name, current condition, temperature, and weather icon/animation.
- Animated Weather Icons: Uses rain animation if a city's weather condition includes rain.
- Update Timestamps: Displays last updated time for each city's weather data.
- Manual Refresh Option: Provides a manual refresh button for administrators to update weather data.

## Style Guidelines:

- Background color: Dark, desaturated blue-gray (#222F3E) for a modern, easy-on-the-eyes aesthetic in a dark color scheme.
- Primary color: Saturated, brighter yellow (#FFD369), contrasting against the background, drawing inspiration from sunlight and warmth. 
- Accent color: Desaturated, brighter orange (#F29559) analogous to the primary yellow hue, to bring interest to highlighted elements.
- Body and headline font: 'Inter' (sans-serif) for a clean and modern look, which will suit both headers and body text. 
- Use animated icons that dynamically represent weather conditions (sun, rain, clouds) pulled directly from the WeatherAPI.com set.
- Clean, minimalistic card layout optimized for large screens.
- Smooth transitions when updating or refreshing weather data on city cards.