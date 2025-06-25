
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
  DialogTrigger,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Home, PlusCircle, RefreshCw, PlayCircle, PauseCircle, Trash2 } from 'lucide-react';
import type { PondingPoint } from '@/lib/types';
import { getPondingPoints, addOrUpdatePondingPoint, deletePondingPoint, getActiveSpell, startSpell, stopSpell, updatePondingPointsBatch } from './actions';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function CityDashboardPage({ params }: { params: { cityName: string } }) {
  const { cityName: encodedCityName } = use(params);
  const cityName = decodeURIComponent(encodedCityName);
  const { toast } = useToast();
  const { user, claims, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [pondingPoints, setPondingPoints] = useState<PondingPoint[]>([]);
  const [maxSpellToday, setMaxSpellToday] = useState(0);
  
  const [isAddFormOpen, setAddFormOpen] = useState(false);
  const [isDeleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [pointToDelete, setPointToDelete] = useState<PondingPoint | null>(null);
  const [isSpellActive, setIsSpellActive] = useState(false);
  const [isStopSpellBlocked, setStopSpellBlocked] = useState(false);
  
  const [inputValues, setInputValues] = useState<Record<string, { currentSpell: string; ponding: string; clearedInTime: string; }>>({});

  const [isPending, startTransition] = useTransition();

  const addPointFormRef = useRef<HTMLFormElement>(null);

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
        if (claims?.role === 'super-admin') {
            router.push('/admin');
        } else if (
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

        const initialValues: typeof inputValues = {};
        for (const point of sortedPoints) {
            initialValues[point.id] = {
                currentSpell: String(point.currentSpell ?? 0),
                ponding: String(point.ponding ?? 0),
                clearedInTime: point.clearedInTime ?? '',
            };
        }
        setInputValues(initialValues);
        
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

  const handleInputChange = (pointId: string, field: keyof typeof inputValues[string], value: string) => {
    setInputValues(prev => ({
        ...prev,
        [pointId]: {
            ...prev[pointId],
            [field]: value,
        }
    }));
  };
  
  const handleTableSubmit = (formData: FormData) => {
    startTransition(async () => {
        const result = await updatePondingPointsBatch(formData, cityName);
        if (result.success) {
            toast({ title: 'Success', description: result.message });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
    });
  };
  
  const handleAddPointSubmit = (formData: FormData) => {
    startTransition(async () => {
        const result = await addOrUpdatePondingPoint(formData, cityName);
        if (result.success) {
            toast({ title: 'Success', description: result.message });
            setAddFormOpen(false);
            addPointFormRef.current?.reset();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
    });
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

  const handleDeleteClick = (point: PondingPoint) => {
    setPointToDelete(point);
    setDeleteAlertOpen(true);
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
                        <Button onClick={handleToggleSpell} disabled={isPending}>
                            {isPending ? <RefreshCw className="mr-2 animate-spin" /> : isSpellActive ? <PauseCircle className="mr-2" /> : <PlayCircle className="mr-2" />}
                            {isSpellActive ? 'Stop Spell' : 'Start Spell'}
                        </Button>
                        <Dialog open={isAddFormOpen} onOpenChange={setAddFormOpen}>
                            <DialogTrigger asChild>
                                 <Button>
                                    <PlusCircle className="mr-2" />
                                    Add Point
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                <DialogTitle>Add New Ponding Point</DialogTitle>
                                <DialogDescription>
                                    Add a new location to track for ponding. You can add rainfall data after the point is created.
                                </DialogDescription>
                                </DialogHeader>
                                <form ref={addPointFormRef} action={handleAddPointSubmit}>
                                    <div className="grid gap-4 py-4">
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <Label htmlFor="name" className="text-right">Name</Label>
                                            <Input id="name" name="name" className="col-span-3" required />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button type="submit" disabled={isPending}>
                                            {isPending && <RefreshCw className="animate-spin" />}
                                            {isPending ? 'Saving...' : 'Save Point'}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </>
                )}
                 <ThemeToggle />
            </div>
        </header>

        <form action={handleTableSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Live Data Entry</CardTitle>
              <CardDescription>
                {isSpellActive
                  ? "Enter live rainfall and ponding data. Click 'Save All Changes' when done."
                  : "A spell must be active to enter data. Click 'Start Spell' to begin."
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Point Name</TableHead>
                      <TableHead>Rain (mm)</TableHead>
                      <TableHead>Ponding (in)</TableHead>
                      <TableHead>Cleared Time (hh:mm)</TableHead>
                       {claims?.role !== 'viewer' && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pondingPoints.length > 0 ? (
                      pondingPoints.map((point) => (
                        <TableRow key={point.id}>
                          <TableCell className="font-medium">{point.name}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              name={`currentSpell_${point.id}`}
                              value={inputValues[point.id]?.currentSpell || '0'}
                              onChange={(e) => handleInputChange(point.id, 'currentSpell', e.target.value)}
                              disabled={!isSpellActive || claims?.role === 'viewer'}
                              className="w-28"
                              step="0.1"
                              min="0"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              name={`ponding_${point.id}`}
                              value={inputValues[point.id]?.ponding || '0'}
                              onChange={(e) => handleInputChange(point.id, 'ponding', e.target.value)}
                              disabled={!isSpellActive || claims?.role === 'viewer'}
                              className="w-28"
                              step="0.1"
                              min="0"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="text"
                              name={`clearedInTime_${point.id}`}
                              placeholder="02:30"
                              value={inputValues[point.id]?.clearedInTime || ''}
                              onChange={(e) => handleInputChange(point.id, 'clearedInTime', e.target.value)}
                              disabled={!isSpellActive || (parseFloat(inputValues[point.id]?.ponding) || 0) > 0 || claims?.role === 'viewer'}
                              className="w-32"
                            />
                          </TableCell>
                          {claims?.role !== 'viewer' && (
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDeleteClick(point)}
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Delete</span>
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                          No ponding points added for {cityName} yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            {claims?.role !== 'viewer' && (
              <CardFooter className="border-t px-6 py-4">
                  <Button type="submit" disabled={isPending || !isSpellActive}>
                      {isPending ? <RefreshCw className="animate-spin mr-2"/> : null}
                      Save All Changes
                  </Button>
              </CardFooter>
            )}
          </Card>
        </form>

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

    </div>
  );
}
