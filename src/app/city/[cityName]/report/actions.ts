
'use server';

import { db } from '@/lib/firebase-admin';
import type { Spell } from '@/lib/types';
import { getPondingPoints } from '../actions';

export async function getActiveOrLatestReportData(cityName: string): Promise<Spell | null> {
    try {
        // 1. Check for active spell
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
                totalRainfall: point.currentSpell ?? 0,
                pondingLevel: point.ponding ?? 0,
                maxPondingLevel: point.maxPondingLevel ?? 0,
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

        // 2. If no active spell, find latest completed spell
        const completedSpellSnapshot = await db.collection('spells')
            .where('cityName', '==', cityName)
            .where('status', '==', 'completed')
            .orderBy('endTime', 'desc')
            .limit(1)
            .get();

        if (completedSpellSnapshot.empty) {
            return null; // No active or completed spells found
        }

        const doc = completedSpellSnapshot.docs[0];
        const data = doc.data();

        return {
            id: doc.id,
            ...data,
            startTime: data.startTime.toDate(),
            endTime: data.endTime.toDate(),
        } as Spell;

    } catch (error) {
        console.error(`Error fetching report data for ${cityName}:`, error);
        return null;
    }
}
