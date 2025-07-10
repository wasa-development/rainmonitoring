

export type WeatherCondition =
  | 'ClearDay'
  | 'ClearNight'
  | 'PartlyCloudyDay'
  | 'PartlyCloudyNight'
  | 'Cloudy'
  | 'Rainy'
  | 'Thunderstorm'
  | 'Snow'
  | 'Fog';

export interface WeatherData {
  id: string;
  city: string;
  condition: WeatherCondition;
  temperature: number;
  lastUpdated: Date;
  isSpellActive?: boolean;
}

export interface PondingPoint {
    id: string;
    name: string;
    cityName: string;
    currentSpell: number;
    maxRainfallForSpell?: number;
    maxRainfall?: number; // Highest rainfall recorded in any completed spell
    maxPonding?: number;
    clearedInTime: string;
    ponding: number;
    maxPondingLevelForSpell?: number;
    isRaining: boolean;
    order?: number;
    updatedAt?: Date;
    totalRainfall?: number;
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
    status: 'active' | 'completed' | 'ended';
    spellData: {
        pointId: string;
        pointName: string;
        order?: number;
        totalRainfall: number;
        pondingLevel: number;
        maxPondingLevel: number;
        clearedInTime: string;
    }[];
}

export interface DailyReportSpellInfo {
    startTime: Date;
    endTime: Date;
    status: 'active' | 'completed';
}

export interface DailyReportPointData {
    pointName: string;
    spellRainfall: number[];
    totalRainfall: number;
    finalStatus: string;
}

export interface DailyReportData {
    spells: DailyReportSpellInfo[];
    points: DailyReportPointData[];
    reportDate: Date;
    earliestStartTime: Date;
    averageRainfall: number;
    maxTotalRainfall: number;
}
    
