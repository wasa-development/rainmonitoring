export interface WeatherData {
  id: string;
  city: string;
  condition: 'Sunny' | 'Rainy' | 'Clear' | 'Cloudy' | 'Partly Cloudy';
  temperature: number;
  lastUpdated: Date;
  forecast?: {
    hasPrecipitation: boolean;
    precipitationType: string;
  };
}

export interface PondingPoint {
    id: string;
    name: string;
    cityName: string;
    currentSpell: number;
    maxSpellRainfall?: number;
    clearedInTime: string;
    ponding: number;
    isRaining: boolean;
    dailyMaxSpell?: number;
    updatedAt?: Date;
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
    requestedAt?: Date;
}

export interface Spell {
    id: string;
    cityName: string;
    startTime: Date;
    endTime?: Date;
    status: 'active' | 'completed';
    spellData: {
        pointId: string;
        pointName: string;
        totalRainfall: number;
    }[];
}
