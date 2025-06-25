'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase-admin';
import { getCities } from '../admin/actions';

const SignupRequestSchema = z.object({
    email: z.string().email({ message: "Invalid email address." }),
    role: z.enum(['city-user', 'viewer'], { required_error: "Role is required." }),
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

export async function requestSignup(formData: FormData) {
    const rawData = Object.fromEntries(formData.entries());
    const validation = SignupRequestSchema.safeParse(rawData);

    if (!validation.success) {
        const firstError = Object.values(validation.error.flatten().fieldErrors)[0]?.[0];
        return { success: false, error: firstError || 'Invalid input.' };
    }

    const { email, role, assignedCity } = validation.data;

    try {
        const existingRequest = await db.collection('user_requests').where('email', '==', email).where('status', '==', 'pending').get();
        if (!existingRequest.empty) {
            return { success: false, error: 'A pending request for this email already exists.' };
        }
        
        await db.collection('user_requests').add({
            email,
            role,
            assignedCity: assignedCity || null,
            status: 'pending',
            requestedAt: new Date(),
        });
        return { success: true, message: 'Your request has been submitted for approval.' };
    } catch (error: any) {
        return { success: false, error: error.message || "An unknown error occurred." };
    }
}

// We can reuse the getCities action from the admin actions
export { getCities };
