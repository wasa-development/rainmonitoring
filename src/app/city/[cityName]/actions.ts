'use server';

import { db, admin } from '@/lib/firebase-admin';
import type { PondingPoint } from '@/lib/types';
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
