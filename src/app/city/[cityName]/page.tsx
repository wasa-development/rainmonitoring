
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
import { Home, PlusCircle, RefreshCw, PlayCircle, PauseCircle, CloudOff } from 'lucide-react';
import type { PondingPoint } from '@/lib/types';
import { getPondingPoints, addOrUpdatePondingPoint, deletePondingPoint, getActiveSpell, startSpell, stopSpell, endRainSeason } from './actions';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import PondingPointCard from '@/components/ponding-point-card';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

export default function CityDashboardPage({ params }: { params: { cityName: string } }) {
  const { cityName: encodedCityName } = use(params);
  const cityName = decodeURIComponent(encodedCityName);
  const { toast } = useToast();
  const { user, claims, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [pondingPoints, setPondingPoints] = useState<PondingPoint[]>([]);
  const [maxCurrentSpell, setMaxCurrentSpell] = useState(0);
  
  const [isFormOpen, setFormOpen] = useState(false);
  const [isDeleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [isEndSeasonAlertOpen, setIsEndSeasonAlertOpen] = useState(false);
  
  const [editingPoint, setEditingPoint] = useState<PondingPoint | null>(null);
  const [pointToDelete, setPointToDelete] = useState<PondingPoint | null>(null);
  const [isSpellActive, setIsSpellActive] = useState(false);
  const [isStopSpellBlocked, setStopSpellBlocked] = useState(false);
  
  const [currentPondingValue, setCurrentPondingValue] = useState('0');
  const [currentRainValue, setCurrentRainValue] = useState('0');
  const [currentClearedInTime, setCurrentClearedInTime] = useState('');
  const [currentOrder, setCurrentOrder] = useState<number | string>(9999);
  const isTrace = currentRainValue === '0.1';
  
  const [isPending, startTransition] = useTransition();

  const formRef = useRef<HTMLFormElement>(null);

  const fetchData = async () => {
    const [points, activeSpell] = await Promise.all([
      getPondingPoints(cityName),
      getActiveSpell(cityName)
    ]);

    const sortedPoints = points.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999) || a.name.localeCompare(b.name));
    setPondingPoints(sortedPoints);
    
    setIsSpellActive(!!activeSpell);
    
    const maxCurrent = Math.max(0, ...points.map(p => Math.max(0, p.currentSpell)));
    
    setMaxCurrentSpell(maxCurrent);
  };
  
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
    }
  }, [authLoading, user, router]);


  useEffect(() => {
    if (user) { 
        fetchData();
    }
  }, [cityName, user]);
  
  useEffect(() => {
    if (editingPoint) {
      setCurrentPondingValue(String(editingPoint.ponding ?? 0));
      setCurrentRainValue(String(editingPoint.currentSpell ?? 0));
      setCurrentClearedInTime(editingPoint.clearedInTime || '');
      setCurrentOrder(editingPoint.order ?? pondingPoints.length + 1);
    } else {
      setCurrentPondingValue('0');
      setCurrentRainValue('0');
      setCurrentClearedInTime('');
      setCurrentOrder(pondingPoints.length + 1);
    }
  }, [editingPoint, pondingPoints.length]);

  const handleFormSubmit = (formData: FormData) => {
    startTransition(async () => {
        const result = await addOrUpdatePondingPoint(formData, cityName);
        if (result.success) {
            toast({ title: 'Success', description: result.message });
            setFormOpen(false);
            setEditingPoint(null);
            formRef.current?.reset();
            await fetchData();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
    });
  }

  const handleEditClick = (point: PondingPoint) => {
    setEditingPoint(point);
    setFormOpen(true);
  };

  const handleAddNewClick = () => {
    setEditingPoint(null);
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
        await fetchData();
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
          toast({ title: 'Spell Started', description: result.message });
        } else {
          toast({ variant: 'destructive', title: 'Error Starting Spell', description: result.error });
        }
      }
      await fetchData();
    });
  };

  const handleEndRainSeasonConfirm = async () => {
    startTransition(async () => {
      const result = await endRainSeason(cityName);
      if (result.success) {
        toast({ title: 'Rain Season Ended', description: result.message });
        await fetchData();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
      setIsEndSeasonAlertOpen(false);
    });
  };
  
  const handlePondingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setCurrentPondingValue(e.target.value);
  };

  const handleRainInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setCurrentRainValue(e.target.value);
  };

  const handleTraceChange = (checked: boolean) => {
      setCurrentRainValue(checked ? '0.1' : '0');
  };

  if (authLoading || !user) {
    return (
        <div className="flex min-h-screen items-center justify-center">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
        <header className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
            <h1 className="text-3xl sm:text-4xl font-bold text-primary">
                Ponding Points Dashboard
            </h1>
            <div className="flex items-center gap-2">
                {claims?.role !== 'viewer' && (
                    <>
                        <Button onClick={handleToggleSpell} disabled={isPending}>
                            {isPending ? <RefreshCw className="mr-2 animate-spin" /> : isSpellActive ? <PauseCircle className="mr-2" /> : <PlayCircle className="mr-2" />}
                            {isSpellActive ? 'Stop Spell' : 'Start Spell'}
                        </Button>
                        <Button onClick={handleAddNewClick}>
                            <PlusCircle className="mr-2" />
                            Add Point
                        </Button>
                         <Button variant="destructive" onClick={() => setIsEndSeasonAlertOpen(true)} disabled={isPending || isSpellActive}>
                            <CloudOff className="mr-2" />
                            End Rain
                        </Button>
                    </>
                )}
            </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card>
                <CardHeader className="pb-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Max Spell (Current)</h3>
                    <p className="text-xs text-muted-foreground">Highest recorded rainfall in the current spell across all points.</p>
                </CardHeader>
                <CardContent>
                    <p className="text-4xl font-bold">{maxCurrentSpell.toFixed(1)} <span className="text-lg font-normal text-muted-foreground">mm</span></p>
                </CardContent>
            </Card>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {pondingPoints.length > 0 ? (
            pondingPoints.map((point) => (
                <PondingPointCard 
                    key={point.id} 
                    point={point} 
                    onEdit={() => handleEditClick(point)} 
                    onDelete={() => handleDeleteClick(point)}
                    userRole={claims?.role}
                    isSpellActive={isSpellActive}
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

        <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{editingPoint ? 'Edit' : 'Add'} Ponding Point</DialogTitle>
                     <DialogDescription>
                        {editingPoint
                        ? `Update the details for ${editingPoint.name}.`
                        : 'Add a new location to track for ponding.'}
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
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="order" className="text-right">Order</Label>
                            <Input
                                id="order"
                                name="order"
                                type="number"
                                value={currentOrder}
                                onChange={(e) => setCurrentOrder(e.target.value)}
                                className="col-span-3"
                            />
                        </div>
                       {editingPoint && (
                            <>
                                {isSpellActive && (
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="currentSpell" className="text-right">Rain (mm)</Label>
                                        <div className="col-span-3 flex items-center gap-2">
                                            <Input
                                                id="currentSpell"
                                                name="currentSpell"
                                                type="number"
                                                value={currentRainValue}
                                                onChange={handleRainInputChange}
                                                className="w-24"
                                                step="0.1"
                                                min="0"
                                            />
                                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                <Checkbox id="trace-checkbox" checked={isTrace} onCheckedChange={handleTraceChange} />
                                                <Label htmlFor="trace-checkbox" className="font-normal">Trace</Label>
                                            </div>
                                        </div>
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
                                    <div className="col-span-3 flex items-center gap-2">
                                        <Input
                                            id="clearedInTime"
                                            name="clearedInTime"
                                            type="text"
                                            value={currentClearedInTime}
                                            onChange={(e) => setCurrentClearedInTime(e.target.value)}
                                            placeholder="e.g., 02:30"
                                            className="flex-grow"
                                        />
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            className="h-8 text-xs"
                                            onClick={() => setCurrentClearedInTime('Cleared During Rain')}>
                                            During Rain
                                        </Button>
                                    </div>
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
                        This will permanently delete the ponding point
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
                        You cannot stop the spell while rainfall is still being recorded for one or more ponding points. Please ensure all points have a "Rain" value of 0 mm before stopping the spell.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={() => setStopSpellBlocked(false)}>OK</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        
        <AlertDialog open={isEndSeasonAlertOpen} onOpenChange={setIsEndSeasonAlertOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>End Rain Season?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will reset all rainfall and ponding data for every point in {cityName} to zero. This action cannot be undone and should be used to mark the beginning of a new rain season.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleEndRainSeasonConfirm}
                        className="bg-destructive hover:bg-destructive/90"
                        disabled={isPending}
                    >
                         {isPending ? 'Resetting...' : 'Yes, End Season'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

    </div>
  );
}
