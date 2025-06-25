export interface WeatherData {
  id: string;
  city: string;
  condition: 'Sunny' | 'Rainy' | 'Clear' | 'Cloudy' | 'Partly Cloudy';
  temperature: number;
  lastUpdated: Date;
}

export interface PondingPoint {
    id: string;
    name: string;
    cityName: string;
    currentSpell: number;
    clearedInTime: string;
    ponding: number;
    isRaining: boolean;
}

export interface AdminUser {
    uid: string;
    email: string;
    role: 'super-admin' | 'city-user' | 'viewer';
    assignedCity?: string;
}

export interface City {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
}

export interface UserRequest {
    id: string;
    email: string;
    role: 'city-user' | 'viewer';
    assignedCity?: string;
    status: 'pending' | 'approved' | 'rejected';
}
