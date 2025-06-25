'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CloudSun, LogIn, RefreshCw } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { user, claims, loading: authLoading } = useAuth();
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    useEffect(() => {
        if (!authLoading && user) {
            if (claims?.role === 'super-admin') {
                router.push('/admin');
            } else if (claims?.role === 'city-user' && claims.assignedCity) {
                router.push(`/city/${encodeURIComponent(claims.assignedCity)}`);
            } else {
                router.push('/');
            }
        }
    }, [authLoading, user, claims, router]);

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Force refresh of the token to get custom claims.
            const idTokenResult = await user.getIdTokenResult(true);
            const role = idTokenResult.claims.role as string;
            const assignedCity = idTokenResult.claims.assignedCity as string;
            
            toast({
                title: 'Login Successful',
                description: `Welcome back! Redirecting you now...`,
            });

            if (role === 'super-admin') {
                router.push('/admin');
            } else if (role === 'city-user' && assignedCity) {
                router.push(`/city/${encodeURIComponent(assignedCity)}`);
            } else {
                router.push('/');
            }
        } catch (error: any) {
            console.error("Login Error:", error);
            let errorMessage = "An unknown error occurred during sign-in.";
            if (error.code) {
                switch (error.code) {
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                    case 'auth/invalid-credential':
                    case 'auth/user-disabled':
                        errorMessage = "Invalid email, password, or your account may be disabled or pending approval.";
                        break;
                    case 'auth/invalid-email':
                        errorMessage = "Please enter a valid email address.";
                        break;
                    default:
                        errorMessage = "Failed to sign in. Please try again later.";
                }
            }
            toast({
                variant: 'destructive',
                title: 'Login Failed',
                description: errorMessage,
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    if (authLoading || user) {
        return (
            <main className="flex min-h-screen items-center justify-center">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </main>
        );
    }

    return (
        <main className="flex items-center justify-center min-h-screen bg-background p-4">
            <Card className="w-full max-w-md shadow-2xl">
                <CardHeader className="text-center">
                    <div className="flex justify-center items-center gap-2 mb-2">
                        <CloudSun className="w-8 h-8 text-accent" />
                        <h1 className="text-2xl font-bold text-primary">Pakistan Weather Pulse</h1>
                    </div>
                    <CardTitle>Sign In</CardTitle>
                    <CardDescription>Enter your credentials to access your dashboard.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSignIn} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="admin@example.com"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Signing In...
                                </>
                            ) : (
                                <>
                                    <LogIn className="mr-2 h-4 w-4" />
                                    Sign In
                                </>
                            )}
                        </Button>
                    </form>
                     <div className="mt-4 text-center text-sm">
                        Don&apos;t have an account?{" "}
                        <Link href="/signup" className="underline text-accent hover:text-primary/80">
                            Sign up
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}
