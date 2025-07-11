
'use server';

import { db, admin } from '@/lib/firebase-admin';
import type { DailyReportData, PondingPoint, Spell, DailyReportSpellInfo, DailyReportPointData, SpellPointData, RainEvent } from '@/lib/types';
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


export async function getActiveRainEvent(cityName: string): Promise<RainEvent | null> {
    try {
        const snapshot = await db.collection('rain_events')
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
            startedAt: data.startedAt.toDate(),
            endedAt: data.endedAt ? data.endedAt.toDate() : undefined,
        } as RainEvent;
    } catch (error) {
        console.error("Error fetching active rain event:", error);
        return null;
    }
}

export async function getRainEvents(cityName: string): Promise<RainEvent[]> {
    try {
        const snapshot = await db.collection('rain_events')
            .where('cityName', '==', cityName)
            .orderBy('startedAt', 'desc')
            .get();

        const events = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                startedAt: data.startedAt.toDate(),
                endedAt: data.endedAt ? data.endedAt.toDate() : undefined,
            } as RainEvent;
        });

        return events;
    } catch (error) {
        console.error("Error fetching rain events:", error);
        return [];
    }
}


export async function getPondingPoints(cityName: string, activeRainEventId?: string): Promise<PondingPoint[]> {
    try {
        const pointsSnapshot = await db.collection('ponding_points').where('cityName', '==', cityName).get();
        if (pointsSnapshot.empty) {
            return [];
        }

        let completedSpells: Spell[] = [];
        if (activeRainEventId) {
            const spellsSnapshot = await db.collection('spells')
                .where('rainEventId', '==', activeRainEventId)
                .where('status', '==', 'completed')
                .get();

            completedSpells = spellsSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    startTime: data.startTime.toDate(),
                    endTime: data.endTime ? data.endTime.toDate() : undefined,
                } as Spell;
            });
        }


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

export async function getActiveSpell(rainEventId: string): Promise<Spell | null> {
    try {
        const snapshot = await db.collection('spells')
            .where('rainEventId', '==', rainEventId)
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

export async function startRainEvent(cityName: string) {
    try {
        const activeEvent = await getActiveRainEvent(cityName);
        if (activeEvent) {
            return { success: false, error: 'A rain event is already active for this city.' };
        }

        const newEventRef = await db.collection('rain_events').add({
            cityName,
            startedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'active'
        });

        revalidatePath(`/city/${encodeURIComponent(cityName)}`);
        return { success: true, message: 'New rain event started.', rainEventId: newEventRef.id };

    } catch(error: any) {
        return { success: false, error: error.message || 'An unknown error occurred.' };
    }
}


export async function startSpell(cityName: string, rainEventId: string) {
    try {
        const activeSpell = await getActiveSpell(rainEventId);
        if (activeSpell) {
            return { success: false, error: 'A spell is already active for this rain event.' };
        }

        const batch = db.batch();

        const newSpellRef = db.collection('spells').doc();
        batch.set(newSpellRef, {
            cityName,
            rainEventId,
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


export async function stopSpell(cityName: string, rainEventId: string) {
    try {
        const activeSpell = await getActiveSpell(rainEventId);
        if (!activeSpell) {
            return { success: false, error: 'No active spell found to stop.' };
        }

        const pondingPoints = await getPondingPoints(cityName, rainEventId);
        
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
            const newTotalRainfall = (point.totalRainfall ?? 0) + spellRainfall;
            const newMaxRainfall = Math.max(point.maxRainfall ?? 0, spellRainfall);
            const newMaxPonding = Math.max(point.maxPonding ?? 0, point.maxPondingLevelForSpell ?? 0);
            
            batch.update(pointRef, { 
                totalRainfall: newTotalRainfall,
                maxRainfall: newMaxRainfall,
                maxPonding: newMaxPonding,

                // Reset spell-specific fields.
                currentSpell: 0,
                isRaining: false,
                maxRainfallForSpell: 0,
                maxPondingLevelForSpell: 0,
            });
        }

        await batch.commit();

        revalidatePath(`/city/${encodeURIComponent(cityName)}`);
        revalidatePath(`/city/${encodeURIComponent(cityName)}/data-entry`);
        revalidatePath(`/city/${encodeURIComponent(cityName)}/report`);
        return { success: true, message: 'Spell ended and data saved.' };
    } catch (error: any) {
        return { success: false, error: error.message || 'An unknown server error occurred.' };
    }
}

export async function endRainEvent(cityName: string, rainEventId: string) {
    try {
        const activeSpell = await getActiveSpell(rainEventId);
        if (activeSpell) {
            return { success: false, error: 'Cannot end rain event while a spell is active. Please stop the current spell first.' };
        }
        
        const batch = db.batch();

        const rainEventRef = db.collection('rain_events').doc(rainEventId);
        batch.update(rainEventRef, {
            status: 'ended',
            endedAt: admin.firestore.FieldValue.serverTimestamp()
        });

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
        return { success: true, message: `Rain event ended for ${cityName}. All historical and current data has been reset.` };
    } catch (error: any) {
        console.error("Error during endRainEvent:", error);
        return { success: false, error: error.message || "An unknown server error occurred during event end." };
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
        const reportDate = new Date(dateString);
        reportDate.setUTCHours(0, 0, 0, 0); // Start of day in UTC
        const reportDateEnd = new Date(dateString);
        reportDateEnd.setUTCHours(23, 59, 59, 999); // End of day in UTC

        const today = new Date();
        const isToday = today.getUTCFullYear() === reportDate.getUTCFullYear() &&
                        today.getUTCMonth() === reportDate.getUTCMonth() &&
                        today.getUTCDate() === reportDate.getUTCDate();

        // Find rain events that were active during the selected day
        const rainEventsSnapshot = await db.collection('rain_events')
            .where('cityName', '==', cityName)
            .where('startedAt', '<=', reportDateEnd)
            .get();
        
        const relevantRainEvents = rainEventsSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data(), startedAt: (doc.data().startedAt as admin.firestore.Timestamp).toDate() } as RainEvent))
            .filter(event => !event.endedAt || new Date(event.endedAt) >= reportDate);
            
        if (relevantRainEvents.length === 0) return null;
        
        const relevantRainEventIds = relevantRainEvents.map(e => e.id);

        const allCurrentPondingPoints = await getPondingPoints(cityName);

        const completedSpellsSnapshot = await db.collection('spells')
            .where('rainEventId', 'in', relevantRainEventIds)
            .where('status', '==', 'completed')
            .where('startTime', '>=', reportDate)
            .where('startTime', '<=', reportDateEnd)
            .orderBy('startTime', 'asc')
            .get();
        
        const completedSpells: Spell[] = completedSpellsSnapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, ...data, startTime: data.startTime.toDate(), endTime: data.endTime?.toDate() } as Spell;
        });

        const allSpellsForDay: Spell[] = [...completedSpells];

        // Only look for an active spell if the report date is today
        if (isToday) {
            const activeRainEvent = await getActiveRainEvent(cityName);
            if (activeRainEvent) {
                const activeSpell = await getActiveSpell(activeRainEvent.id);
                if (activeSpell) {
                    const liveSpellData: SpellPointData[] = allCurrentPondingPoints.map(point => ({
                        pointId: point.id,
                        pointName: point.name,
                        order: point.order ?? 9999,
                        totalRainfall: point.maxRainfallForSpell ?? 0,
                        maxPondingLevel: Math.max(point.maxPondingLevelForSpell ?? 0, point.ponding ?? 0),
                        pondingLevel: point.ponding ?? 0,
                        clearedInTime: (point.ponding ?? 0) === 0 ? (point.clearedInTime ?? 'N/A') : 'N/A',
                    }));
                    
                    allSpellsForDay.push({
                        ...activeSpell,
                        endTime: new Date(), 
                        status: 'active',
                        spellData: liveSpellData,
                    });
                }
            }
        }
        
        if (allSpellsForDay.length === 0) {
            return null;
        }

        const earliestStartTime = allSpellsForDay[0].startTime;

        const allPointsMap = new Map<string, {name: string, order: number}>();
        allCurrentPondingPoints.forEach(p => allPointsMap.set(p.id, { name: p.name, order: p.order ?? 9999 }));
        allSpellsForDay.forEach(spell => {
            spell.spellData?.forEach(p => {
                if (!allPointsMap.has(p.pointId)) {
                    allPointsMap.set(p.pointId, { name: p.pointName, order: p.order ?? 9999 });
                }
            });
        });

        const pointDataMap = new Map<string, DailyReportPointData>();
        allPointsMap.forEach((pointDetails, pointId) => {
            pointDataMap.set(pointId, {
                pointName: pointDetails.name,
                order: pointDetails.order,
                spellRainfall: Array(allSpellsForDay.length).fill(0),
                totalRainfall: 0,
                finalStatus: 'Clear',
                lastSpellData: null,
            });
        });

        allSpellsForDay.forEach((spell, spellIndex) => {
            spell.spellData?.forEach(pointSpellData => {
                const pointId = pointSpellData.pointId;
                const currentPoint = pointDataMap.get(pointId);
                
                if (currentPoint) {
                    const rainfall = pointSpellData.totalRainfall ?? 0;
                    currentPoint.spellRainfall[spellIndex] = rainfall;
                    currentPoint.totalRainfall += rainfall;
                    currentPoint.lastSpellData = pointSpellData;
                }
            });
        });
        
        pointDataMap.forEach(point => {
            const lastData = point.lastSpellData;
            if (lastData) {
                if (lastData.pondingLevel > 0) {
                    point.finalStatus = `${lastData.pondingLevel.toFixed(1)} in`;
                } else if (lastData.clearedInTime && lastData.clearedInTime !== 'N/A' && lastData.clearedInTime.trim() !== '') {
                    point.finalStatus = lastData.clearedInTime;
                } else if (point.totalRainfall > 0) {
                    point.finalStatus = 'Stopped';
                }
            } else if (point.totalRainfall > 0) {
                 point.finalStatus = 'Stopped';
            }
        });

        const reportSpells: DailyReportSpellInfo[] = allSpellsForDay.map(spell => ({
            startTime: spell.startTime,
            endTime: spell.endTime!,
            status: spell.status as 'active' | 'completed',
        }));

        const pointsArray = Array.from(pointDataMap.values());
        const totalRainfallSum = pointsArray.reduce((sum, point) => sum + point.totalRainfall, 0);
        const averageRainfall = pointsArray.length > 0 ? totalRainfallSum / pointsArray.length : 0;
        const maxTotalRainfall = Math.max(0, ...pointsArray.map(p => p.totalRainfall));

        return {
            spells: reportSpells,
            points: pointsArray,
            reportDate: reportDate,
            earliestStartTime: earliestStartTime,
            averageRainfall,
            maxTotalRainfall,
        };

    } catch (error: any) {
        if (error.code === 'failed-precondition' && error.message.includes('index')) {
            const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
            const databaseId = '(default)'; 
            const collectionId = 'spells';

            // This query URL is specific to the query in this function.
            // If the query changes, this URL must be updated.
            const queryParams = new URLSearchParams({
                "collectionId": collectionId,
                "databaseId": databaseId,
                "queryScope": "COLLECTION",
                "fields": JSON.stringify([
                    {"fieldPath": "rainEventId", "mode": "ARRAY_CONTAINS"},
                    {"fieldPath": "status", "mode": "EQUAL"},
                    {"fieldPath": "startTime", "mode": "ASCENDING"}
                ])
            });

            const indexCreationUrl = `https://console.firebase.google.com/project/${projectId}/firestore/indexes/composite?${queryParams.toString()}`;

            const userFriendlyError = `The database query for the report failed because a required index is missing. Please create the index in your Firestore database by visiting this URL, then try again: ${indexCreationUrl}`;
            
            console.error("Missing Firestore index for getDailyReportData query.");
            throw new Error(userFriendlyError);
        }

        console.error("CRITICAL ERROR in getDailyReportData for city", cityName, "on date", dateString);
        console.error("Error Message:", error.message);
        console.error("Error Stack:", error.stack);
        throw new Error("A database error occurred while fetching the daily report data. Please check server logs for details.");
    }
}
