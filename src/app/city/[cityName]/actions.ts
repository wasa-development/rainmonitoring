'use server';

import { db, admin } from '@/lib/firebase-admin';
import type { PondingPoint, Spell } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const PondingPointSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, { message: 'Name is required.' }),
  currentSpell: z.coerce.number().min(0, { message: 'Spell must be a positive number.' }).optional(),
  clearedInTime: z.string().optional(),
  ponding: z.coerce.number().min(0, { message: 'Ponding must be a positive number.' }).optional(),
  isRaining: z.preprocess((val) => val === 'on' || val === true, z.boolean()).optional(),
});

export async function getPondingPoints(cityName: string): Promise<PondingPoint[]> {
    try {
        const snapshot = await db.collection('ponding_points').where('cityName', '==', cityName).get();
        if (snapshot.empty) {
            return [];
        }
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                updatedAt: data.updatedAt ? data.updatedAt.toDate() : undefined,
            } as PondingPoint;
        });
    } catch (error) {
        console.error("Error fetching ponding points:", error);
        return [];
    }
}

export async function addOrUpdatePondingPoint(formData: FormData, cityName: string) {
    const rawData = Object.fromEntries(formData.entries());
    const validation = PondingPointSchema.safeParse(rawData);

    if (!validation.success) {
        const firstError = Object.values(validation.error.flatten().fieldErrors)[0]?.[0];
        return { success: false, error: firstError || 'Invalid input.' };
    }

    const { id, ...data } = validation.data;
    
    const pointDataForDb: any = { 
        cityName,
        name: data.name,
        currentSpell: data.currentSpell ?? 0,
        clearedInTime: data.clearedInTime ?? '',
        ponding: data.ponding ?? 0,
        isRaining: data.isRaining ?? false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    try {
        if (id) {
            // Update
            const pointRef = db.collection('ponding_points').doc(id);
            const docSnap = await pointRef.get();
            
            let dailyMaxSpell = pointDataForDb.currentSpell;

            if (docSnap.exists()) {
                const existingData = docSnap.data();
                if (existingData && existingData.updatedAt) {
                    const lastUpdated = existingData.updatedAt.toDate();
                    const now = new Date();

                    const isSameDay = lastUpdated.getFullYear() === now.getFullYear() &&
                                      lastUpdated.getMonth() === now.getMonth() &&
                                      lastUpdated.getDate() === now.getDate();
                    
                    const oldDailyMax = isSameDay ? (existingData.dailyMaxSpell ?? 0) : 0;
                    dailyMaxSpell = Math.max(oldDailyMax, pointDataForDb.currentSpell);
                }
            }
            
            pointDataForDb.dailyMaxSpell = dailyMaxSpell;
            await pointRef.set(pointDataForDb, { merge: true });
        } else {
            // Create
            pointDataForDb.dailyMaxSpell = pointDataForDb.currentSpell;
            await db.collection('ponding_points').add(pointDataForDb);
        }
        revalidatePath(`/city/${encodeURIComponent(cityName)}`);
        return { success: true, message: `Ponding point ${id ? 'updated' : 'created'} successfully.` };
    } catch (error: any) {
        return { success: false, error: error.message || 'An unknown error occurred.' };
    }
}

export async function getActiveSpell(cityName: string): Promise<Spell | null> {
    try {
        const snapshot = await db.collection('spells')
            .where('cityName', '==', cityName)
            .where('status', '==', 'active')
            .limit(1)
            .get();

        if (snapshot.empty) {
            return null;
        }

        const doc = snapshot.docs[0];
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            startTime: data.startTime.toDate(),
            endTime: data.endTime ? data.endTime.toDate() : undefined,
        } as Spell;
    } catch (error) {
        console.error("Error fetching active spell:", error);
        return null;
    }
}

export async function startSpell(cityName: string) {
    try {
        const activeSpell = await getActiveSpell(cityName);
        if (activeSpell) {
            return { success: false, error: 'A spell is already active for this city.' };
        }

        await db.collection('spells').add({
            cityName,
            startTime: admin.firestore.FieldValue.serverTimestamp(),
            endTime: null,
            status: 'active',
            spellData: [],
        });

        revalidatePath(`/city/${encodeURIComponent(cityName)}`);
        return { success: true, message: 'Spell started successfully.' };
    } catch (error: any) {
        return { success: false, error: error.message || 'An unknown error occurred.' };
    }
}


export async function stopSpell(cityName: string) {
    try {
        const activeSpell = await getActiveSpell(cityName);
        if (!activeSpell) {
            return { success: false, error: 'No active spell found to stop.' };
        }

        const pondingPoints = await getPondingPoints(cityName);

        const spellData = pondingPoints.map(point => ({
            pointId: point.id,
            pointName: point.name,
            totalRainfall: point.currentSpell,
        }));

        const batch = db.batch();

        // Update the spell document
        const spellRef = db.collection('spells').doc(activeSpell.id);
        batch.update(spellRef, {
            status: 'completed',
            endTime: admin.firestore.FieldValue.serverTimestamp(),
            spellData: spellData
        });

        // Reset currentSpell for all ponding points
        pondingPoints.forEach(point => {
            const pointRef = db.collection('ponding_points').doc(point.id);
            batch.update(pointRef, { currentSpell: 0, isRaining: false });
        });

        await batch.commit();

        revalidatePath(`/city/${encodeURIComponent(cityName)}`);
        return { success: true, message: 'Spell ended and data saved.' };
    } catch (error: any) {
        return { success: false, error: error.message || 'An unknown error occurred.' };
    }
}


export async function deletePondingPoint(id: string, cityName: string) {
    if (!id) {
        return { success: false, error: 'Cannot delete point without an ID.' };
    }
    try {
        await db.collection('ponding_points').doc(id).delete();
        revalidatePath(`/city/${encodeURIComponent(cityName)}`);
        return { success: true, message: 'Ponding point deleted successfully.' };
    } catch (error: any) {
        return { success: false, error: error.message || 'An unknown error occurred.' };
    }
}
