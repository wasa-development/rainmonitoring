'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createNewUser, createNewCity, getCities } from './actions';
import type { City } from '@/lib/types';
import Link from 'next/link';
import { Home, UserPlus, Building, RefreshCw } from 'lucide-react';

export default function AdminPage() {
    const { toast } = useToast();
    const [cities, setCities] = useState<City[]>([]);
    const [selectedRole, setSelectedRole] = useState<'super-admin' | 'city-user' | ''>('');
    const [isCreateUserPending, setCreateUserPending] = useState(false);
    const [isCreateCityPending, setCreateCityPending] = useState(false);

    const createUserFormRef = useRef<HTMLFormElement>(null);
    const createCityFormRef = useRef<HTMLFormElement>(null);

    const fetchCityData = async () => {
        const cityData = await getCities();
        setCities(cityData);
    };

    useEffect(() => {
        fetchCityData();
    }, []);

    const handleCreateUser = async (formData: FormData) => {
        setCreateUserPending(true);
        const result = await createNewUser(formData);
        if (result.success) {
            toast({ title: 'Success', description: result.message });
            createUserFormRef.current?.reset();
            setSelectedRole('');
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setCreateUserPending(false);
    };

    const handleCreateCity = async (formData: FormData) => {
        setCreateCityPending(true);
        const result = await createNewCity(formData);
        if (result.success) {
            toast({ title: 'Success', description: result.message });
            createCityFormRef.current?.reset();
            await fetchCityData(); // Refresh city list
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setCreateCityPending(false);
    };

  return (
    <main className="container mx-auto p-4 sm:p-6 md:p-8">
       <header className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
                <Link href="/" className="text-accent hover:text-primary">
                    <Home className="w-7 h-7" />
                </Link>
                <h1 className="text-3xl sm:text-4xl font-bold text-primary">
                    Super Admin Dashboard
                </h1>
            </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><UserPlus /> Create New User</CardTitle>
                    <CardDescription>Create a new user and assign them a role.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form ref={createUserFormRef} action={handleCreateUser} className="space-y-4">
                         <div>
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" name="email" type="email" required />
                        </div>
                        <div>
                            <Label htmlFor="password">Password</Label>
                            <Input id="password" name="password" type="password" required minLength={6} />
                        </div>
                        <div>
                            <Label htmlFor="role">Role</Label>
                             <Select name="role" required onValueChange={(value: any) => setSelectedRole(value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="super-admin">Super Admin</SelectItem>
                                    <SelectItem value="city-user">City User</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {selectedRole === 'city-user' && (
                            <div>
                                <Label htmlFor="assignedCity">Assign to City</Label>
                                <Select name="assignedCity" required>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a city" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {cities.length > 0
                                            ? cities.map(city => (<SelectItem key={city.id} value={city.name}>{city.name}</SelectItem>))
                                            : <p className="p-2 text-sm text-muted-foreground">No cities available. Create one first.</p>}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <Button type="submit" disabled={isCreateUserPending}>
                            {isCreateUserPending && <RefreshCw className="animate-spin" />}
                            {isCreateUserPending ? 'Creating...' : 'Create User'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Building /> Create New City</CardTitle>
                    <CardDescription>Add a new city to be tracked.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form ref={createCityFormRef} action={handleCreateCity} className="space-y-4">
                        <div>
                            <Label htmlFor="name">City Name</Label>
                            <Input id="name" name="name" required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <Label htmlFor="latitude">Latitude</Label>
                                <Input id="latitude" name="latitude" type="number" step="any" required />
                            </div>
                             <div>
                                <Label htmlFor="longitude">Longitude</Label>
                                <Input id="longitude" name="longitude" type="number" step="any" required />
                            </div>
                        </div>
                        <Button type="submit" disabled={isCreateCityPending}>
                             {isCreateCityPending && <RefreshCw className="animate-spin" />}
                            {isCreateCityPending ? 'Creating...' : 'Create City'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    </main>
  );
}
