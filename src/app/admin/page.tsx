'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createNewUser, createNewCity, getCities, getPendingUserRequests, approveUserRequest, rejectUserRequest } from './actions';
import type { City, UserRequest } from '@/lib/types';
import Link from 'next/link';
import { Home, UserPlus, Building, RefreshCw, MailCheck, UserCheck, UserX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export default function AdminPage() {
    const { toast } = useToast();
    const [cities, setCities] = useState<City[]>([]);
    const [pendingRequests, setPendingRequests] = useState<UserRequest[]>([]);
    const [selectedRole, setSelectedRole] = useState<'super-admin' | 'city-user' | 'viewer' | ''>('');
    const [isSubmitting, startSubmitting] = useTransition();
    
    // State for approval/rejection dialogs
    const [requestToApprove, setRequestToApprove] = useState<UserRequest | null>(null);
    const [requestToReject, setRequestToReject] = useState<UserRequest | null>(null);

    const createUserFormRef = useRef<HTMLFormElement>(null);
    const createCityFormRef = useRef<HTMLFormElement>(null);
    const approveFormRef = useRef<HTMLFormElement>(null);

    const fetchData = async () => {
        const [cityData, requestData] = await Promise.all([getCities(), getPendingUserRequests()]);
        setCities(cityData);
        setPendingRequests(requestData);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreateUser = async (formData: FormData) => {
        startSubmitting(async () => {
            const result = await createNewUser(formData);
            if (result.success) {
                toast({ title: 'Success', description: result.message });
                createUserFormRef.current?.reset();
                setSelectedRole('');
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
        });
    };

    const handleCreateCity = async (formData: FormData) => {
        startSubmitting(async () => {
            const result = await createNewCity(formData);
            if (result.success) {
                toast({ title: 'Success', description: result.message });
                createCityFormRef.current?.reset();
                await fetchData(); 
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
        });
    };

    const handleApproveSubmit = async (formData: FormData) => {
        if (!requestToApprove) return;
        formData.append('requestId', requestToApprove.id);
        
        startSubmitting(async () => {
            const result = await approveUserRequest(formData);
            if (result.success) {
                toast({ title: 'Success', description: result.message });
                setRequestToApprove(null);
                await fetchData();
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
        });
    };
    
    const handleRejectConfirm = async () => {
        if (!requestToReject) return;
        
        startSubmitting(async () => {
            const result = await rejectUserRequest(requestToReject.id);
            if (result.success) {
                toast({ title: 'Success', description: result.message });
                setRequestToReject(null);
                await fetchData();
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
        });
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><UserPlus /> Create New User</CardTitle>
                        <CardDescription>Create a new user and assign them a role directly.</CardDescription>
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
                                        <SelectItem value="viewer">Viewer</SelectItem>
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
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <RefreshCw className="animate-spin" />}
                                Create User
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
                            <Button type="submit" disabled={isSubmitting}>
                                 {isSubmitting && <RefreshCw className="animate-spin" />}
                                Create City
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
            
            <Card className="lg:col-span-1">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><MailCheck /> Pending User Requests</CardTitle>
                    <CardDescription>Approve or reject new user signups.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {pendingRequests.length > 0 ? (
                        pendingRequests.map(req => (
                            <div key={req.id} className="flex items-center justify-between p-2 rounded-md border">
                                <div>
                                    <p className="font-semibold">{req.email}</p>
                                    <p className="text-sm text-muted-foreground">
                                        Role: {req.role} {req.role === 'city-user' && `(${req.assignedCity})`}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-green-500 hover:text-green-500" onClick={() => setRequestToApprove(req)}><UserCheck /></Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setRequestToReject(req)}><UserX /></Button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No pending requests.</p>
                    )}
                </CardContent>
            </Card>
        </div>

        {/* Approval Dialog */}
        <Dialog open={!!requestToApprove} onOpenChange={(open) => !open && setRequestToApprove(null)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Approve User Request</DialogTitle>
                    <DialogDescription>
                        Set an initial password for <span className="font-bold">{requestToApprove?.email}</span> to create their account.
                    </DialogDescription>
                </DialogHeader>
                <form ref={approveFormRef} action={handleApproveSubmit}>
                    <div className="py-4">
                        <Label htmlFor="approve-password">Initial Password</Label>
                        <Input id="approve-password" name="password" type="password" required minLength={6} />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setRequestToApprove(null)}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <RefreshCw className="animate-spin" />}
                            Approve & Create User
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
        
        {/* Rejection Alert Dialog */}
        <AlertDialog open={!!requestToReject} onOpenChange={(open) => !open && setRequestToReject(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will reject the user request for <span className="font-bold">{requestToReject?.email}</span>. They will not be able to sign up with this request again.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setRequestToReject(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRejectConfirm} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
                        {isSubmitting ? 'Rejecting...' : 'Reject Request'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </main>
  );
}
