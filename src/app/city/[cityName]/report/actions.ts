
'use server';

import { db } from '@/lib/firebase-admin';
import type { Spell } from '@/lib/types';
import { getPondingPoints } from '../actions';

export async function getActiveOrLatestReportData(cityName: string): Promise<Spell | null> {
    try {
        // 1. Check for active spell first. This query is simple and doesn't need a special index.
        const activeSpellSnapshot = await db.collection('spells')
            .where('cityName', '==', cityName)
            .where('status', '==', 'active')
            .limit(1)
            .get();

        if (!activeSpellSnapshot.empty) {
            // Active spell found, construct a live report
            const activeSpellDoc = activeSpellSnapshot.docs[0];
            const activeSpellData = activeSpellDoc.data();
            const pondingPoints = await getPondingPoints(cityName);

            const liveSpellData = pondingPoints.map(point => ({
                pointId: point.id,
                pointName: point.name,
                order: point.order,
                totalRainfall: point.currentSpell ?? 0,
                pondingLevel: point.ponding ?? 0,
                maxPondingLevel: point.maxPondingLevelForSpell ?? 0,
                clearedInTime: point.clearedInTime ?? '',
            }));

            return {
                id: activeSpellDoc.id,
                cityName,
                startTime: activeSpellData.startTime.toDate(),
                endTime: new Date(), // Use current time for "as of"
                status: 'active',
                spellData: liveSpellData,
            } as Spell;
        }

        // 2. If no active spell, find latest completed spell.
        // WORKAROUND: The ideal query `...orderBy('endTime', 'desc')` requires a composite index
        // on (cityName, status, endTime). To avoid forcing index creation, we fetch all
        // completed spells for the city and sort them in code. This is less performant but more robust
        // for environments without the pre-configured index.
        const allCompletedSpellsQuery = await db.collection('spells')
            .where('cityName', '==', cityName)
            .where('status', '==', 'completed')
            .get();

        if (allCompletedSpellsQuery.empty) {
            return null; // No completed spells found either.
        }

        const completedSpells = allCompletedSpellsQuery.docs
            .map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    startTime: data.startTime.toDate(),
                    endTime: data.endTime ? data.endTime.toDate() : undefined,
                } as Spell;
            })
            .filter(spell => spell.endTime); // Ensure spell is valid before sorting

        if (completedSpells.length === 0) {
            return null;
        }
        
        // Sort by endTime descending to find the latest one
        completedSpells.sort((a, b) => b.endTime!.getTime() - a.endTime!.getTime());

        return completedSpells[0];

    } catch (error) {
        console.error(`Error fetching report data for ${cityName}:`, error);
        // This is a critical error path. If anything fails (like permissions), we return null.
        // The UI will show the "No Report Available" message, which is the safest fallback.
        return null;
    }
}
