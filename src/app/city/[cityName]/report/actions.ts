
'use server';

import { db, admin } from '@/lib/firebase-admin';
import type { Spell, RainEvent } from '@/lib/types';
import { getPondingPoints, getActiveSpell as getActiveSpellForEvent } from '../actions';

export async function getActiveOrLatestReportData(cityName: string): Promise<Spell | null> {
    try {
        const activeRainEventSnapshot = await db.collection('rain_events')
            .where('cityName', '==', cityName)
            .where('status', '==', 'active')
            .limit(1)
            .get();
        
        let activeRainEvent: RainEvent | null = null;
        if (!activeRainEventSnapshot.empty) {
            const doc = activeRainEventSnapshot.docs[0];
            activeRainEvent = { id: doc.id, ...doc.data() } as RainEvent;
        }

        if (activeRainEvent) {
             const activeSpell = await getActiveSpellForEvent(activeRainEvent.id);
             if (activeSpell) {
                const pondingPoints = await getPondingPoints(cityName, activeRainEvent.id);
                const liveSpellData = pondingPoints.map(point => ({
                    pointId: point.id,
                    pointName: point.name,
                    order: point.order,
                    totalRainfall: point.maxRainfallForSpell ?? 0,
                    pondingLevel: point.ponding ?? 0,
                    maxPondingLevel: point.maxPondingLevelForSpell ?? 0,
                    clearedInTime: point.clearedInTime ?? '',
                }));

                return {
                    ...activeSpell,
                    endTime: new Date(), 
                    status: 'active',
                    spellData: liveSpellData,
                } as Spell;
             }
        }

        // If no active spell, find latest completed spell from ANY rain event.
        const allSpellsQuery = await db.collection('spells')
            .where('cityName', '==', cityName)
            .where('status', 'in', ['completed', 'ended'])
            .orderBy('endTime', 'desc')
            .limit(1)
            .get();

        if (!allSpellsQuery.empty) {
            const doc = allSpellsQuery.docs[0];
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                startTime: data.startTime.toDate(),
                endTime: data.endTime ? data.endTime.toDate() : undefined,
            } as Spell;
        }

        return null; // No spells of any kind found.

    } catch (error) {
        console.error(`Error fetching report data for ${cityName}:`, error);
        return null;
    }
}
