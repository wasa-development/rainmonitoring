'use server';

import { db, admin } from '@/lib/firebase-admin';
import type { PondingPoint, Spell } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const PondingPointSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, { message: 'Name is required.' }),
  currentSpell: z.coerce.number().min(0, { message: 'Spell value must not be negative.' }).int({ message: 'Rainfall must be a whole number.' }).optional(),
  clearedInTime: z.string().optional(),
  ponding: z.coerce.number().min(0, { message: 'Ponding value must not be negative.' }).optional(),
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
    const currentSpellValue = data.currentSpell ?? 0;
    
    const pointDataForDb: any = { 
        cityName,
        name: data.name,
        currentSpell: currentSpellValue,
        clearedInTime: data.clearedInTime ?? '',
        ponding: data.ponding ?? 0,
        isRaining: currentSpellValue > 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    try {
        if (id) {
            // Update
            const pointRef = db.collection('ponding_points').doc(id);
            const docSnap = await pointRef.get();
            
            if (docSnap.exists) {
                const existingData = docSnap.data() as PondingPoint;
                const oldPonding = existingData.ponding ?? 0;
                const newPonding = data.ponding ?? 0;
                const clearedInTime = data.clearedInTime ?? '';

                if (oldPonding > 0 && newPonding === 0 && !clearedInTime) {
                    return { 
                        success: false, 
                        error: "'Cleared In' time is required when ponding is resolved (set to 0)." 
                    };
                }

                let dailyMaxSpell = pointDataForDb.currentSpell;
                let maxSpellRainfall = pointDataForDb.currentSpell;

                if (existingData.updatedAt) {
                    const lastUpdated = existingData.updatedAt.toDate();
                    const now = new Date();

                    const isSameDay = lastUpdated.getFullYear() === now.getFullYear() &&
                                      lastUpdated.getMonth() === now.getMonth() &&
                                      lastUpdated.getDate() === now.getDate();
                    
                    const oldDailyMax = isSameDay ? (existingData.dailyMaxSpell ?? 0) : 0;
                    dailyMaxSpell = Math.max(oldDailyMax, pointDataForDb.currentSpell);
                }
                const oldMaxSpellRainfall = existingData.maxSpellRainfall ?? 0;
                maxSpellRainfall = Math.max(oldMaxSpellRainfall, pointDataForDb.currentSpell);

                pointDataForDb.dailyMaxSpell = dailyMaxSpell;
                pointDataForDb.maxSpellRainfall = maxSpellRainfall;
                await pointRef.set(pointDataForDb, { merge: true });

            } else {
                return { success: false, error: 'Ponding point not found for update.' };
            }
        } else {
            // Create
            pointDataForDb.dailyMaxSpell = pointDataForDb.currentSpell;
            pointDataForDb.maxSpellRainfall = pointDataForDb.currentSpell;
            await db.collection('ponding_points').add(pointDataForDb);
        }
        revalidatePath(`/city/${encodeURIComponent(cityName)}`);
        revalidatePath(`/city/${encodeURIComponent(cityName)}/data-entry`);
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
        revalidatePath(`/city/${encodeURIComponent(cityName)}/data-entry`);
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

        const spellRef = db.collection('spells').doc(activeSpell.id);
        batch.update(spellRef, {
            status: 'completed',
            endTime: admin.firestore.FieldValue.serverTimestamp(),
            spellData: spellData
        });

        pondingPoints.forEach(point => {
            const pointRef = db.collection('ponding_points').doc(point.id);
            batch.update(pointRef, { currentSpell: 0, isRaining: false, maxSpellRainfall: 0 });
        });

        await batch.commit();

        revalidatePath(`/city/${encodeURIComponent(cityName)}`);
        revalidatePath(`/city/${encodeURIComponent(cityName)}/data-entry`);
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
        revalidatePath(`/city/${encodeURIComponent(cityName)}/data-entry`);
        return { success: true, message: 'Ponding point deleted successfully.' };
    } catch (error: any) {
        return { success: false, error: error.message || 'An unknown error occurred.' };
    }
}


// Helper function to parse form data with array-like keys into an array of objects
function parsePointsFromFormData(formData: FormData) {
    const pointsMap = new Map<string, any>();
    
    for (const [key, value] of formData.entries()) {
        const match = key.match(/^points\[(\d+)\]\.(.+)$/);
        if (match) {
            const [, index, field] = match;
            if (!pointsMap.has(index)) {
                pointsMap.set(index, { index: parseInt(index, 10) });
            }
            pointsMap.get(index)[field] = value;
        }
    }
    
    return Array.from(pointsMap.values()).sort((a, b) => a.index - b.index);
}


const BatchPondingPointSchema = z.object({
  id: z.string().min(1, { message: 'ID is missing.' }),
  name: z.string(), // for error messages
  currentSpell: z.coerce.number().min(0, { message: 'Spell value must not be negative.' }).int({ message: 'Rainfall must be a whole number.' }),
  clearedInTime: z.string().optional(),
  ponding: z.coerce.number().min(0, { message: 'Ponding value must not be negative.' }),
});

export async function batchUpdatePondingPoints(formData: FormData, cityName: string) {
    const parsedPoints = parsePointsFromFormData(formData);
    
    const validationResults = parsedPoints.map(p => BatchPondingPointSchema.safeParse(p));

    // Find the first validation error, if any
    for (let i = 0; i < validationResults.length; i++) {
        const result = validationResults[i];
        if (!result.success) {
            const pointName = parsedPoints[i]?.name || `Point #${i + 1}`;
            const firstError = Object.values(result.error.flatten().fieldErrors)[0]?.[0];
            return { success: false, error: `Error for ${pointName}: ${firstError || 'Invalid input.'}` };
        }
    }

    const pointsToUpdate = validationResults.map(res => (res as z.SafeParseSuccess<any>).data);

    try {
        const batch = db.batch();
        const allPointIds = pointsToUpdate.map(p => p.id);
        
        // Fetch all existing points in one go
        const existingPointsSnapshots = allPointIds.length > 0
            ? await db.collection('ponding_points').where(admin.firestore.FieldPath.documentId(), 'in', allPointIds).get()
            : { docs: [] };
        const existingPointsData = new Map(existingPointsSnapshots.docs.map(doc => [doc.id, doc.data() as PondingPoint]));

        for (const pointData of pointsToUpdate) {
            const pointRef = db.collection('ponding_points').doc(pointData.id);
            const existingData = existingPointsData.get(pointData.id);

            if (!existingData) {
                console.warn(`Ponding point with ID ${pointData.id} not found during batch update. Skipping.`);
                continue;
            }

            const oldPonding = existingData.ponding ?? 0;
            const newPonding = pointData.ponding;

            if (oldPonding > 0 && newPonding === 0 && !pointData.clearedInTime) {
                return { 
                    success: false, 
                    error: `'Cleared In' time is required for ${pointData.name} since ponding was resolved.` 
                };
            }
            
            const currentSpellValue = pointData.currentSpell ?? 0;
            
            let dailyMaxSpell = currentSpellValue;
            let maxSpellRainfall = currentSpellValue;

            if (existingData.updatedAt) {
                const lastUpdated = existingData.updatedAt.toDate();
                const now = new Date();
                const isSameDay = lastUpdated.getFullYear() === now.getFullYear() &&
                                  lastUpdated.getMonth() === now.getMonth() &&
                                  lastUpdated.getDate() === now.getDate();
                
                const oldDailyMax = isSameDay ? (existingData.dailyMaxSpell ?? 0) : 0;
                dailyMaxSpell = Math.max(oldDailyMax, currentSpellValue);
            }
            const oldMaxSpellRainfall = existingData.maxSpellRainfall ?? 0;
            maxSpellRainfall = Math.max(oldMaxSpellRainfall, currentSpellValue);

            const pointDataForDb = { 
                currentSpell: currentSpellValue,
                clearedInTime: pointData.clearedInTime ?? '',
                ponding: newPonding,
                isRaining: currentSpellValue > 0,
                dailyMaxSpell,
                maxSpellRainfall,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            batch.set(pointRef, pointDataForDb, { merge: true });
        }

        await batch.commit();

        revalidatePath(`/city/${encodeURIComponent(cityName)}`);
        revalidatePath(`/city/${encodeURIComponent(cityName)}/data-entry`);
        return { success: true, message: 'All points updated successfully.' };
    } catch (error: any) {
        return { success: false, error: error.message || 'An unknown server error occurred.' };
    }
}
