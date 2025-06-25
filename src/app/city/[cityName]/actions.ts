'use server';

import { db } from '@/lib/firebase-admin';
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
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as PondingPoint[];
    } catch (error) {
        console.error("Error fetching ponding points:", error);
        // In a real app, you might want to throw the error or handle it differently
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
    
    const pointData = { 
        cityName,
        name: data.name,
        currentSpell: data.currentSpell ?? 0,
        clearedInTime: data.clearedInTime ?? '',
        ponding: data.ponding ?? 0,
        isRaining: data.isRaining ?? false,
    };

    try {
        if (id) {
            // Update
            await db.collection('ponding_points').doc(id).set(pointData, { merge: true });
        } else {
            // Create
            await db.collection('ponding_points').add(pointData);
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
