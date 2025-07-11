
'use server';

import { db, admin } from '@/lib/firebase-admin';
import type { Spell } from '@/lib/types';
import { getPondingPoints } from '../actions';

export async function getActiveOrLatestReportData(cityName: string): Promise<Spell | null> {
    try {
        // 1. Check for active spell first.
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
                totalRainfall: point.maxRainfallForSpell ?? 0,
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
        const completedSpellsQuery = await db.collection('spells')
            .where('cityName', '==', cityName)
            .where('status', '==', 'completed')
            .get();

        if (!completedSpellsQuery.empty) {
            const completedSpells = completedSpellsQuery.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    startTime: doc.data().startTime.toDate(),
                    endTime: doc.data().endTime ? doc.data().endTime.toDate() : undefined,
                } as Spell))
                .filter(spell => spell.endTime);
            
            if (completedSpells.length > 0) {
                 completedSpells.sort((a, b) => b.endTime!.getTime() - a.endTime!.getTime());
                 return completedSpells[0];
            }
        }
        
        // 3. If no active or completed spells, find latest "ended" spell as a fallback.
        const endedSpellsQuery = await db.collection('spells')
            .where('cityName', '==', cityName)
            .where('status', '==', 'ended')
            .get();
            
        if (!endedSpellsQuery.empty) {
            const endedSpells = endedSpellsQuery.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    startTime: doc.data().startTime.toDate(),
                    endTime: doc.data().endTime ? doc.data().endTime.toDate() : undefined,
                } as Spell))
                .filter(spell => spell.endTime);
                
            if (endedSpells.length > 0) {
                endedSpells.sort((a, b) => b.endTime!.getTime() - a.endTime!.getTime());
                return endedSpells[0];
            }
        }

        return null; // No spells of any kind found.

    } catch (error) {
        console.error(`Error fetching report data for ${cityName}:`, error);
        return null;
    }
}
