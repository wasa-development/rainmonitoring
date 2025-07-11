
'use server';

import { db, admin } from '@/lib/firebase-admin';
import type { DailyReportData, PondingPoint, Spell, DailyReportSpellInfo, DailyReportPointData } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const PondingPointSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, { message: 'Name is required.' }),
  currentSpell: z.coerce.number().optional(),
  clearedInTime: z.string().optional(),
  ponding: z.coerce.number().min(0, { message: 'Ponding value must not be negative.' }).optional(),
  order: z.coerce.number().optional(),
});

export async function getPondingPoints(cityName: string): Promise<PondingPoint[]> {
    try {
        const pointsSnapshot = await db.collection('ponding_points').where('cityName', '==', cityName).get();
        if (pointsSnapshot.empty) {
            return [];
        }

        const spellsSnapshot = await db.collection('spells')
            .where('cityName', '==', cityName)
            .where('status', '==', 'completed')
            .get();

        const completedSpells: Spell[] = spellsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                startTime: data.startTime.toDate(),
                endTime: data.endTime ? data.endTime.toDate() : undefined,
            } as Spell;
        });

        const pointsWithHistory = pointsSnapshot.docs.map(doc => {
            const pointData = doc.data() as PondingPoint;
            const pointId = doc.id;
            
            const maxRainfall = completedSpells.reduce((max, spell) => {
                if (spell.spellData) {
                    const matchedPoint = spell.spellData.find(p => p.pointId === pointId);
                    if (matchedPoint && typeof matchedPoint.totalRainfall === 'number') {
                        return Math.max(max, matchedPoint.totalRainfall);
                    }
                }
                return max;
            }, 0);

            let maxPonding = 0;
            for (const spell of completedSpells) {
                if (spell.spellData) {
                    for (const spellPointData of spell.spellData) {
                        if (spellPointData.pointId === pointId) {
                            if ((spellPointData.maxPondingLevel ?? 0) > maxPonding) {
                                maxPonding = spellPointData.maxPondingLevel;
                            }
                        }
                    }
                }
            }
            
            return {
                id: pointId,
                ...pointData,
                maxRainfall,
                maxPonding,
                updatedAt: pointData.updatedAt ? (pointData.updatedAt as any).toDate() : undefined,
            } as PondingPoint;
        });

        return pointsWithHistory;

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
    const newRainfallInput = data.currentSpell ?? 0;
    
    try {
        if (id) {
            // Update
            const pointRef = db.collection('ponding_points').doc(id);
            const docSnap = await pointRef.get();
            
            if (docSnap.exists) {
                const existingData = docSnap.data() as PondingPoint;
                const newPonding = data.ponding ?? 0;
                
                const oldMaxRainfall = existingData.maxRainfallForSpell ?? 0;
                const maxRainfallForSpell = Math.max(oldMaxRainfall, newRainfallInput);
                
                const oldMaxPonding = existingData.maxPondingLevelForSpell ?? 0;
                const maxPondingLevelForSpell = Math.max(oldMaxPonding, newPonding);

                const pointDataForUpdate = { 
                    name: data.name,
                    order: data.order ?? 9999,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    currentSpell: newRainfallInput,
                    isRaining: newRainfallInput > 0,
                    maxRainfallForSpell,
                    ponding: newPonding,
                    maxPondingLevelForSpell,
                    clearedInTime: data.clearedInTime ?? '',
                };

                await pointRef.update(pointDataForUpdate);

            } else {
                return { success: false, error: 'Ponding point not found for update.' };
            }
        } else {
            // Create
            const pointDataForDb = { 
                cityName,
                name: data.name,
                clearedInTime: data.clearedInTime ?? '',
                ponding: data.ponding ?? 0,
                order: data.order ?? 9999,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                currentSpell: newRainfallInput,
                isRaining: newRainfallInput > 0,
                maxRainfallForSpell: newRainfallInput,
                maxPondingLevelForSpell: data.ponding ?? 0,
                totalRainfall: 0,
                maxRainfall: 0,
                maxPonding: 0,
            };
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

        const batch = db.batch();

        const newSpellRef = db.collection('spells').doc();
        batch.set(newSpellRef, {
            cityName,
            startTime: admin.firestore.FieldValue.serverTimestamp(),
            endTime: null,
            status: 'active',
            spellData: [],
        });

        const pointsSnapshot = await db.collection('ponding_points').where('cityName', '==', cityName).get();
        pointsSnapshot.forEach(doc => {
            const pointRef = db.collection('ponding_points').doc(doc.id);
            batch.update(pointRef, {
                maxRainfallForSpell: 0,
                maxPondingLevelForSpell: 0,
                currentSpell: 0,
                isRaining: false,
                ponding: 0,
                clearedInTime: '',
            });
        });

        await batch.commit();

        revalidatePath(`/city/${encodeURIComponent(cityName)}`);
        revalidatePath(`/city/${encodeURIComponent(cityName)}/data-entry`);
        revalidatePath(`/city/${encodeURIComponent(cityName)}/report`);
        return { success: true, message: 'New rain spell started.' };
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
        
        const hasActiveRain = pondingPoints.some(p => p.isRaining);
        if (hasActiveRain) {
            return { success: false, error: 'Cannot stop spell while rainfall is still being recorded. Set all rain values to 0.' };
        }


        const spellData = pondingPoints.map(point => ({
            pointId: point.id,
            pointName: point.name,
            totalRainfall: point.maxRainfallForSpell ?? 0,
            pondingLevel: point.ponding ?? 0,
            maxPondingLevel: point.maxPondingLevelForSpell ?? 0,
            clearedInTime: point.clearedInTime ?? '',
        }));

        const batch = db.batch();

        const spellRef = db.collection('spells').doc(activeSpell.id);
        batch.update(spellRef, {
            status: 'completed',
            endTime: admin.firestore.FieldValue.serverTimestamp(),
            spellData: spellData
        });

        for (const point of pondingPoints) {
            const pointRef = db.collection('ponding_points').doc(point.id);
            const spellRainfall = point.maxRainfallForSpell ?? 0;
            
            batch.update(pointRef, { 
                currentSpell: 0,
                isRaining: false,
                // Add the completed spell's max rainfall to the running seasonal total
                totalRainfall: admin.firestore.FieldValue.increment(spellRainfall),
                maxRainfall: Math.max(point.maxRainfall ?? 0, spellRainfall),
                maxPonding: Math.max(point.maxPonding ?? 0, (point.maxPondingLevelForSpell ?? 0)),
                // Do not reset maxRainfallForSpell or maxPondingLevelForSpell here,
                // let startSpell handle resetting for the next spell.
            });
        }

        await batch.commit();

        revalidatePath(`/city/${encodeURIComponent(cityName)}`);
        revalidatePath(`/city/${encodeURIComponent(cityName)}/data-entry`);
        revalidatePath(`/city/${encodeURIComponent(cityName)}/report`);
        return { success: true, message: 'Spell ended and data saved.' };
    } catch (error: any) {
        return { success: false, error: error.message || 'An unknown error occurred.' };
    }
}

export async function endRainSeason(cityName: string) {
    try {
        const activeSpell = await getActiveSpell(cityName);
        if (activeSpell) {
            return { success: false, error: 'Cannot end rain season while a spell is active. Please stop the current spell first.' };
        }
        
        const batch = db.batch();

        const completedSpellsSnapshot = await db.collection('spells')
            .where('cityName', '==', cityName)
            .where('status', '==', 'completed')
            .get();

        if (!completedSpellsSnapshot.empty) {
            completedSpellsSnapshot.forEach(doc => {
                batch.update(doc.ref, { status: 'ended' });
            });
        }
        
        const pointsSnapshot = await db.collection('ponding_points').where('cityName', '==', cityName).get();

        pointsSnapshot.forEach(doc => {
            const pointRef = db.collection('ponding_points').doc(doc.id);
            batch.update(pointRef, {
                totalRainfall: 0,
                maxRainfall: 0,
                maxPonding: 0,
                maxRainfallForSpell: 0,
                maxPondingLevelForSpell: 0,
                currentSpell: 0,
                isRaining: false,
                ponding: 0,
                clearedInTime: ''
            });
        });

        await batch.commit();

        revalidatePath(`/city/${encodeURIComponent(cityName)}`);
        revalidatePath(`/city/${encodeURIComponent(cityName)}/data-entry`);
        revalidatePath(`/city/${encodeURIComponent(cityName)}/report`);
        return { success: true, message: `Rain season ended for ${cityName}. All historical and current data has been reset.` };
    } catch (error: any) {
        console.error("Error during endRainSeason:", error);
        return { success: false, error: error.message || "An unknown server error occurred during season end." };
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
  name: z.string(),
  currentSpell: z.coerce.number(),
  clearedInTime: z.string().optional(),
  ponding: z.coerce.number().min(0, { message: 'Ponding value must not be negative.' }),
});

export async function batchUpdatePondingPoints(formData: FormData, cityName: string) {
    const parsedPoints = parsePointsFromFormData(formData);

    const validationResults = parsedPoints.map(p => BatchPondingPointSchema.safeParse(p));

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

            const newPonding = pointData.ponding;
            const newRainfallInput = pointData.currentSpell ?? 0;
            
            const oldMaxRainfall = existingData.maxRainfallForSpell ?? 0;
            const maxRainfallForSpell = Math.max(oldMaxRainfall, newRainfallInput);

            const oldMaxPonding = existingData.maxPondingLevelForSpell ?? 0;
            const maxPondingLevelForSpell = Math.max(oldMaxPonding, newPonding);

            const pointDataForDb = { 
                currentSpell: newRainfallInput,
                clearedInTime: pointData.clearedInTime ?? '',
                ponding: newPonding,
                isRaining: newRainfallInput > 0,
                maxRainfallForSpell,
                maxPondingLevelForSpell,
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


export async function getDailyReportData(cityName: string, dateString: string): Promise<DailyReportData | null> {
    try {
        // The dateString comes from the client as 'yyyy-MM-dd'.
        // To avoid timezone issues, we'll construct the start and end dates in UTC
        // and then compare the spell's start time against this range.
        const reportDate = new Date(dateString + 'T00:00:00Z');
        const dayStart = new Date(reportDate.getUTCFullYear(), reportDate.getUTCMonth(), reportDate.getUTCDate(), 0, 0, 0, 0);
        const dayEnd = new Date(reportDate.getUTCFullYear(), reportDate.getUTCMonth(), reportDate.getUTCDate(), 23, 59, 59, 999);

        // Fetch ALL completed spells for the city. Filtering will happen in code.
        const allCompletedSpellsQuery = await db.collection('spells')
            .where('cityName', '==', cityName)
            .where('status', '==', 'completed')
            .get();

        // Filter the spells in code to avoid complex timezone-sensitive queries.
        const completedSpellsOnDate: Spell[] = allCompletedSpellsQuery.docs
            .map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    startTime: data.startTime.toDate(),
                    endTime: data.endTime.toDate(),
                } as Spell;
            })
            .filter(spell => {
                const spellStartTime = spell.startTime;
                // Check if the spell's start time is within the report day
                return spellStartTime >= dayStart && spellStartTime <= dayEnd;
            });
        
        const now = new Date();
        const isToday = dayStart.toDateString() === now.toDateString();

        let activeSpellForDay: Spell | null = null;
        if (isToday) {
            const activeSpell = await getActiveSpell(cityName);
            if (activeSpell) { 
                const pondingPoints = await getPondingPoints(cityName);
                const spellData = pondingPoints.map(point => {
                    const latestPonding = point.ponding ?? 0;
                    return {
                        pointId: point.id,
                        pointName: point.name,
                        order: point.order ?? 9999,
                        totalRainfall: point.currentSpell ?? 0,
                        maxPondingLevel: Math.max(point.maxPondingLevelForSpell ?? 0, latestPonding),
                        pondingLevel: latestPonding,
                        clearedInTime: latestPonding === 0 ? point.clearedInTime ?? '' : '',
                    };
                });
                
                activeSpellForDay = {
                    ...activeSpell,
                    endTime: new Date(),
                    status: 'active',
                    spellData,
                };
            }
        }

        const allSpellsForDay = [...completedSpellsOnDate];
        if (activeSpellForDay) {
            allSpellsForDay.push(activeSpellForDay);
        }

        if (allSpellsForDay.length === 0) {
            return null;
        }
        
        const sortedSpells = allSpellsForDay.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

        const reportSpells: DailyReportSpellInfo[] = sortedSpells.map(spell => ({
            startTime: spell.startTime,
            endTime: spell.endTime!,
            status: spell.status as 'active' | 'completed',
        }));

        const allPondingPoints = await getPondingPoints(cityName);
        const pointDataMap = new Map<string, DailyReportPointData>();
        
        allPondingPoints.forEach(point => {
            pointDataMap.set(point.id, {
                pointName: point.name,
                order: point.order,
                spellRainfall: Array(sortedSpells.length).fill(0),
                totalRainfall: 0,
                finalStatus: '', // This will be calculated below
            });
        });
        
        sortedSpells.forEach((spell, spellIndex) => {
            (spell.spellData || []).forEach(pointSpellData => {
                const pointId = pointSpellData.pointId;
                if (pointDataMap.has(pointId)) {
                    const currentPoint = pointDataMap.get(pointId)!;
                    const rainfall = pointSpellData.totalRainfall ?? 0;
                    currentPoint.spellRainfall[spellIndex] = rainfall;
                    currentPoint.totalRainfall += rainfall;
                }
            });
        });
        
        const pointsArray = Array.from(pointDataMap.values());
        
        // Calculate finalStatus after all spells are processed
        pointsArray.forEach(point => {
            const lastRainfall = point.spellRainfall.length > 0 ? point.spellRainfall[point.spellRainfall.length - 1] : 0;
            if (lastRainfall > 0) {
                 point.finalStatus = lastRainfall === 0.1 ? 'Trace' : `${lastRainfall.toFixed(1)} mm`;
            } else {
                point.finalStatus = 'Stopped';
            }
        });

        const totalRainfallSum = pointsArray.reduce((sum, point) => sum + point.totalRainfall, 0);
        const averageRainfall = pointsArray.length > 0 ? totalRainfallSum / pointsArray.length : 0;
        const maxTotalRainfall = Math.max(0, ...pointsArray.map(p => p.totalRainfall));

        return {
            spells: reportSpells,
            points: pointsArray,
            reportDate: reportDate,
            earliestStartTime: sortedSpells[0].startTime,
            averageRainfall,
            maxTotalRainfall,
        };

    } catch (error: any) {
        console.error("Critical error in getDailyReportData for city", cityName, " and date", dateString, ":", error.message, error.stack);
        throw new Error("A database error occurred while fetching the daily report data. Please check server logs for details.");
    }
}




    

    
