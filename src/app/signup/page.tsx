
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, RefreshCw } from 'lucide-react';
import type { City } from '@/lib/types';
import { getCities, requestSignup } from './actions';
import { useAuth } from '@/hooks/use-auth';
import { ThemeToggle } from '@/components/theme-toggle';
import { Logo } from '@/components/logo';

export default function SignupPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { user, loading: authLoading } = useAuth();

    const [isLoading, setIsLoading] = useState(false);
    const [cities, setCities] = useState<City[]>([]);
    const [selectedRole, setSelectedRole] = useState<'city-user' | 'viewer' | ''>('');
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (!authLoading && user) {
            router.push('/');
        }
    }, [authLoading, user, router]);

    useEffect(() => {
        async function fetchCityData() {
            const cityData = await getCities();
            setCities(cityData);
        };
        fetchCityData();
    }, []);

    const handleSignupRequest = async (formData: FormData) => {
        setIsLoading(true);
        const result = await requestSignup(formData);
        
        if (result.success) {
            toast({
                title: 'Request Submitted',
                description: result.message,
            });
            formRef.current?.reset();
            setSelectedRole('');
            setTimeout(() => router.push('/login'), 2000);
        } else {
            toast({
                variant: 'destructive',
                title: 'Submission Failed',
                description: result.error,
            });
        }
        setIsLoading(false);
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
            <Card className="w-full max-w-md shadow-2xl relative">
                <div className="absolute top-4 right-4">
                    <ThemeToggle />
                </div>
                <CardHeader className="text-center">
                    <div className="flex flex-col justify-center items-center gap-2 mb-2">
                        <Logo width={96} height={96} />
                        <h1 className="text-2xl font-bold text-primary">Punjab WASA Rain Monitoring</h1>
                    </div>
                    <CardTitle>Request an Account</CardTitle>
                    <CardDescription>Your request will be reviewed by an administrator.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form ref={formRef} action={handleSignupRequest} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="user@example.com"
                                required
                                disabled={isLoading}
                            />
                        </div>
                        <div className="space-y-2">
                             <Label htmlFor="role">Requested Role</Label>
                             <Select name="role" required onValueChange={(value: any) => setSelectedRole(value)} disabled={isLoading}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="city-user">City User</SelectItem>
                                    <SelectItem value="viewer">Viewer</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                         {selectedRole === 'city-user' && (
                            <div className="space-y-2">
                                <Label htmlFor="assignedCity">City Assignment</Label>
                                <Select name="assignedCity" required disabled={isLoading}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a city" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {cities.length > 0
                                            ? cities.map(city => (<SelectItem key={city.id} value={city.name}>{city.name}</SelectItem>))
                                            : <SelectItem value="" disabled>Loading cities...</SelectItem>}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                       
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                <>
                                    <UserPlus className="mr-2 h-4 w-4" />
                                    Request Account
                                </>
                            )}
                        </Button>
                    </form>
                     <div className="mt-4 text-center text-sm">
                        Already have an account?{" "}
                        <Link href="/login" className="underline text-primary/80 hover:text-primary">
                            Sign In
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}
