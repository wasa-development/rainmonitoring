
'use client';

import { useState, use, useEffect, useRef, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Home, PlusCircle, RefreshCw, PlayCircle, PauseCircle, FilePenLine } from 'lucide-react';
import type { AdminUser, PondingPoint, Spell } from '@/lib/types';
import { getPondingPoints, addOrUpdatePondingPoint, deletePondingPoint, getActiveSpell, startSpell, stopSpell } from './actions';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
import PondingPointCard from '@/components/ponding-point-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function CityDashboardPage({ params }: { params: { cityName: string } }) {
  const { cityName: encodedCityName } = use(params);
  const cityName = decodeURIComponent(encodedCityName);
  const { toast } = useToast();
  const { user, claims, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [pondingPoints, setPondingPoints] = useState<PondingPoint[]>([]);
  const [maxSpellToday, setMaxSpellToday] = useState(0);
  
  const [isFormOpen, setFormOpen] = useState(false);
  const [isDeleteAlertOpen, setDeleteAlertOpen] = useState(false);
  
  const [editingPoint, setEditingPoint] = useState<PondingPoint | null>(null);
  const [pointToDelete, setPointToDelete] = useState<PondingPoint | null>(null);
  const [isSpellActive, setIsSpellActive] = useState(false);
  const [isStopSpellBlocked, setStopSpellBlocked] = useState(false);
  
  const [currentPondingValue, setCurrentPondingValue] = useState('0');

  const [isClearanceDialogOpen, setClearanceDialogOpen] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);
  
  const [isPending, startTransition] = useTransition();

  const formRef = useRef<HTMLFormElement>(null);
  const clearanceFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
    }
  }, [authLoading, user, router]);

  useEffect(() => {
     if (!authLoading && user) {
        if (
            claims?.role === 'city-user' &&
            claims.assignedCity &&
            claims.assignedCity !== cityName
        ) {
            toast({
            variant: 'destructive',
            title: 'Access Denied',
            description: `You can only view the dashboard for ${claims.assignedCity}.`,
            });
            router.push(`/city/${encodeURIComponent(claims.assignedCity)}`);
        }
     }
  }, [authLoading, user, claims, cityName, router, toast]);


  useEffect(() => {
    async function fetchData() {
        const [points, activeSpell] = await Promise.all([
          getPondingPoints(cityName),
          getActiveSpell(cityName)
        ]);

        const sortedPoints = points.sort((a, b) => a.name.localeCompare(b.name));
        setPondingPoints(sortedPoints);
        
        setIsSpellActive(!!activeSpell);
        
        const now = new Date();
        const dailyMax = Math.max(0, ...points
            .filter(p => {
                if (!p.updatedAt) return false;
                const lastUpdated = p.updatedAt;
                return lastUpdated.getFullYear() === now.getFullYear() &&
                       lastUpdated.getMonth() === now.getMonth() &&
                       lastUpdated.getDate() === now.getDate();
            })
            .map(p => p.dailyMaxSpell ?? 0));
        
        setMaxSpellToday(dailyMax);
    }
    if (user) { 
        fetchData();
    }
  }, [cityName, isPending, user]);

  const submitPondingPointForm = (formData: FormData) => {
    startTransition(async () => {
        const result = await addOrUpdatePondingPoint(formData, cityName);
        if (result.success) {
            toast({ title: 'Success', description: result.message });
            setFormOpen(false);
            setEditingPoint(null);
            setClearanceDialogOpen(false);
            setPendingFormData(null);
            formRef.current?.reset();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
            setClearanceDialogOpen(false); // Close dialog even on error
        }
    });
  }
  
  const handleFormSubmit = (formData: FormData) => {
    const newPondingValue = parseFloat(formData.get('ponding') as string ?? '0');
    const oldPondingValue = editingPoint?.ponding ?? 0;
    const clearedInTime = formData.get('clearedInTime') as string;

    if (editingPoint && oldPondingValue > 0 && newPondingValue === 0 && !clearedInTime) {
        setPendingFormData(formData);
        setClearanceDialogOpen(true);
        return;
    }
    submitPondingPointForm(formData);
  };
  
  const handleClearanceTimeSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pendingFormData) return;

    const clearanceTimeForm = event.currentTarget;
    const clearanceTimeInput = clearanceTimeForm.elements.namedItem('clearedInTime') as HTMLInputElement;
    const clearanceTime = clearanceTimeInput.value;

    pendingFormData.set('clearedInTime', clearanceTime);
    submitPondingPointForm(pendingFormData);
  };

  const handleEditClick = (point: PondingPoint) => {
    setEditingPoint(point);
    setCurrentPondingValue(String(point.ponding ?? 0));
    setFormOpen(true);
  };

  const handleAddNewClick = () => {
    setEditingPoint(null);
    setCurrentPondingValue('0');
    setFormOpen(true);
  };
  
  const handleDeleteClick = (point: PondingPoint) => {
    setPointToDelete(point);
    setDeleteAlertOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!pointToDelete) return;
    
    startTransition(async () => {
        const result = await deletePondingPoint(pointToDelete.id, cityName);
         if (result.success) {
            toast({ title: 'Success', description: result.message });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setDeleteAlertOpen(false);
        setPointToDelete(null);
    });
  };

  const handleToggleSpell = () => {
    startTransition(async () => {
      if (isSpellActive) {
        const hasActiveRain = pondingPoints.some(p => p.currentSpell > 0);
        if (hasActiveRain) {
            setStopSpellBlocked(true);
            return;
        }

        const result = await stopSpell(cityName);
        if (result.success) {
          toast({ title: 'Spell Ended', description: 'Spell data saved and rainfall values reset.' });
        } else {
          toast({ variant: 'destructive', title: 'Error Stopping Spell', description: result.error });
        }
      } else {
        const result = await startSpell(cityName);
        if (result.success) {
          toast({ title: 'Spell Started', description: 'You can now enter rainfall data.' });
        } else {
          toast({ variant: 'destructive', title: 'Error Starting Spell', description: result.error });
        }
      }
    });
  };
  
  const handlePondingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setCurrentPondingValue(e.target.value);
  };

  const maxCurrentSpell = Math.max(0, ...pondingPoints.map(p => p.currentSpell));

  if (authLoading || !user) {
    return (
        <div className="flex min-h-screen items-center justify-center">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <main className="container mx-auto p-4 sm:p-6 md:p-8 z-10 relative">
        <header className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
            <div className="flex items-center gap-4">
                <Link href="/" className="text-primary hover:text-primary/80">
                    <Home className="w-7 h-7" />
                </Link>
                <h1 className="text-3xl sm:text-4xl font-bold text-primary">
                    Ponding Points: {cityName}
                </h1>
            </div>
            <div className="flex items-center gap-2">
                {claims?.role !== 'viewer' && (
                    <>
                        <Button asChild variant="outline">
                            <Link href={`/city/${encodeURIComponent(cityName)}/data-entry`}>
                                <FilePenLine className="mr-2" />
                                Bulk Data Entry
                            </Link>
                        </Button>
                        <Button onClick={handleToggleSpell} disabled={isPending}>
                            {isPending ? <RefreshCw className="mr-2 animate-spin" /> : isSpellActive ? <PauseCircle className="mr-2" /> : <PlayCircle className="mr-2" />}
                            {isSpellActive ? 'Stop Spell' : 'Start Spell'}
                        </Button>
                        <Button onClick={handleAddNewClick}>
                            <PlusCircle className="mr-2" />
                            Add Point
                        </Button>
                    </>
                )}
                 <ThemeToggle />
            </div>
        </header>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {pondingPoints.length > 0 ? (
            pondingPoints.map((point) => (
                <PondingPointCard 
                    key={point.id} 
                    point={point} 
                    onEdit={() => handleEditClick(point)} 
                    onDelete={() => handleDeleteClick(point)}
                    userRole={claims?.role}
                />
            ))
          ) : (
             <Card className="sm:col-span-2 md:col-span-3 lg:col-span-4">
                <CardContent className="flex flex-col items-center justify-center h-48">
                    <h3 className="text-lg font-semibold">No Ponding Points Found</h3>
                    <p className="text-muted-foreground">Get started by adding a new ponding point.</p>
                </CardContent>
            </Card>
          )}
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Max Spell (Current)</CardTitle>
                    <CardDescription>Highest recorded rainfall in the current spell across all points.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-4xl font-bold">{maxCurrentSpell.toFixed(1)} <span className="text-lg font-normal text-muted-foreground">mm</span></p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Max Spell (Today)</CardTitle>
                     <CardDescription>Highest recorded rainfall today across all spells.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-4xl font-bold">{maxSpellToday.toFixed(1)} <span className="text-lg font-normal text-muted-foreground">mm</span></p>
                </CardContent>
            </Card>
        </div>

      </main>

        <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{editingPoint ? 'Edit' : 'Add'} Ponding Point</DialogTitle>
                     <DialogDescription>
                        {editingPoint
                        ? `Update the details for ${editingPoint.name}.`
                        : 'Add a new location to track for ponding. You can add rainfall and ponding data after creating it.'}
                    </DialogDescription>
                </DialogHeader>
                <form ref={formRef} action={handleFormSubmit}>
                    {editingPoint && <input type="hidden" name="id" value={editingPoint.id} />}
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">Name</Label>
                            <Input
                                id="name"
                                name="name"
                                defaultValue={editingPoint?.name || ''}
                                className="col-span-3"
                                readOnly={!!editingPoint && claims?.role === 'city-user'}
                                required
                            />
                        </div>
                       {editingPoint && (
                            <>
                                {isSpellActive && (
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="currentSpell" className="text-right">Rain (mm)</Label>
                                        <Input
                                            id="currentSpell"
                                            name="currentSpell"
                                            type="number"
                                            defaultValue={editingPoint?.currentSpell ?? 0}
                                            className="col-span-3"
                                            step="0.1"
                                            min="0"
                                        />
                                    </div>
                                )}
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="ponding" className="text-right">Ponding (in)</Label>
                                    <Input
                                        id="ponding"
                                        name="ponding"
                                        type="number"
                                        value={currentPondingValue}
                                        onChange={handlePondingChange}
                                        className="col-span-3"
                                        step="0.1"
                                        min="0"
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="clearedInTime" className="text-right">Cleared In</Label>
                                    <Input
                                        id="clearedInTime"
                                        name="clearedInTime"
                                        type="text"
                                        defaultValue={editingPoint?.clearedInTime || ''}
                                        placeholder="e.g., 02:30"
                                        className="col-span-3"
                                        disabled={parseFloat(currentPondingValue) > 0}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>Cancel</Button>
                         <Button type="submit" disabled={isPending}>
                            {isPending && <RefreshCw className="animate-spin" />}
                            {isPending ? 'Saving...' : (editingPoint ? 'Save Changes' : 'Add Point')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>


        <AlertDialog open={isDeleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the ponding point
                        for <span className="font-bold">{pointToDelete?.name}</span>.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setPointToDelete(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDeleteConfirm}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={isPending}
                    >
                        {isPending && <RefreshCw className="animate-spin" />}
                        {isPending ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={isStopSpellBlocked} onOpenChange={setStopSpellBlocked}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Cannot Stop Spell</AlertDialogTitle>
                    <AlertDialogDescription>
                        You cannot stop the spell while rainfall is still being recorded for one or more ponding points. Please ensure all points have a "Current Spell" of 0.0 mm before stopping the spell.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={() => setStopSpellBlocked(false)}>OK</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <Dialog open={isClearanceDialogOpen} onOpenChange={setClearanceDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Clearance Time Required</DialogTitle>
                    <DialogDescription>
                        You have set the ponding value to 0. Please enter the time it took to clear the ponding for <span className="font-bold">{editingPoint?.name}</span>.
                    </DialogDescription>
                </DialogHeader>
                <form ref={clearanceFormRef} onSubmit={handleClearanceTimeSubmit}>
                    <div className="py-4">
                        <Label htmlFor="clearance-time-input">Cleared In (hh:mm)</Label>
                        <Input id="clearance-time-input" name="clearedInTime" type="text" placeholder="e.g., 02:30" required />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setClearanceDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? 'Saving...' : 'Confirm & Save'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>

    </div>
  );
}

    