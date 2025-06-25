'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

interface AuthState {
    user: User | null;
    claims: {
        role?: 'super-admin' | 'city-user' | 'viewer';
        assignedCity?: string;
    } | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
    const [user, setUser] = useState<User | null>(null);
    const [claims, setClaims] = useState<AuthState['claims']>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const idTokenResult = await user.getIdTokenResult();
                setUser(user);
                setClaims(idTokenResult.claims as AuthState['claims']);
            } else {
                setUser(null);
                setClaims(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signOut = async () => {
        await firebaseSignOut(auth);
        router.push('/');
    };

    return { user, claims, loading, signOut };
}
