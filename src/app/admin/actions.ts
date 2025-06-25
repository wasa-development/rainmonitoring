'use server';

import { z } from 'zod';
import { auth, db } from '@/lib/firebase-admin';
import type { AdminUser, City } from '@/lib/types';

const CreateUserSchema = z.object({
    email: z.string().email({ message: "Invalid email address." }),
    password: z.string().min(6, { message: "Password must be at least 6 characters." }),
    role: z.enum(['super-admin', 'city-user'], { required_error: "Role is required." }),
    assignedCity: z.string().optional(),
}).refine(data => {
    if (data.role === 'city-user') {
        return !!data.assignedCity;
    }
    return true;
}, {
    message: "Assigned city is required for city users.",
    path: ['assignedCity'],
});

export async function createNewUser(formData: FormData) {
    const rawData = Object.fromEntries(formData.entries());
    const validation = CreateUserSchema.safeParse(rawData);

    if (!validation.success) {
        const firstError = Object.values(validation.error.flatten().fieldErrors)[0]?.[0];
        return { success: false, error: firstError || 'Invalid input.' };
    }

    const { email, password, role, assignedCity } = validation.data;

    try {
        const userRecord = await auth.createUser({
            email,
            password,
        });

        const userDoc: Omit<AdminUser, 'uid'> = {
            email,
            role,
        };

        if (role === 'city-user' && assignedCity) {
            userDoc.assignedCity = assignedCity;
        }

        await db.collection('users').doc(userRecord.uid).set(userDoc);
        await auth.setCustomUserClaims(userRecord.uid, { role });

        return { success: true, message: `User ${email} created successfully.` };
    } catch (error: any) {
        if (error.code === 'auth/email-already-exists') {
            return { success: false, error: 'A user with this email already exists.' };
        }
        return { success: false, error: error.message || "An unknown error occurred." };
    }
}

const CreateCitySchema = z.object({
    name: z.string().min(1, "City name is required."),
});

export async function createNewCity(formData: FormData) {
    const rawData = Object.fromEntries(formData.entries());
    const validation = CreateCitySchema.safeParse(rawData);

    if (!validation.success) {
        const firstError = Object.values(validation.error.flatten().fieldErrors)[0]?.[0];
        return { success: false, error: firstError || 'Invalid input.' };
    }

    const { name } = validation.data;

    try {
        const cityRef = await db.collection('cities').add({ name });
        return { success: true, message: `City "${name}" created with ID: ${cityRef.id}.` };
    } catch (error: any) {
        return { success: false, error: error.message || "An unknown error occurred." };
    }
}

export async function getCities(): Promise<City[]> {
    try {
        const snapshot = await db.collection('cities').orderBy('name').get();
        if (snapshot.empty) {
            return [];
        }
        return snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name as string }));
    } catch (error) {
        console.error("Error fetching cities:", error);
        return [];
    }
}
