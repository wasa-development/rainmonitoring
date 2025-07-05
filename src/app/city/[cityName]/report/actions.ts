
'use server';

import { db } from '@/lib/firebase-admin';
import type { Spell } from '@/lib/types';

export async function getLatestReportData(cityName: string): Promise<Spell | null> {
    try {
        const snapshot = await db.collection('spells')
            .where('cityName', '==', cityName)
            .where('status', '==', 'completed')
            .orderBy('endTime', 'desc')
            .limit(1)
            .get();

        if (snapshot.empty) {
            return null;
        }

        const doc = snapshot.docs[0];
        const data = doc.data();
        
        // Ensure endTime is a Date object before returning
        const endTime = data.endTime ? data.endTime.toDate() : new Date();

        return {
            id: doc.id,
            ...data,
            startTime: data.startTime.toDate(),
            endTime: endTime,
        } as Spell;

    } catch (error) {
        console.error(`Error fetching latest report data for ${cityName}:`, error);
        return null;
    }
}
