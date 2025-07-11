
'use client';

import { useState, use, useEffect, useRef, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { PondingPoint, RainEvent } from '@/lib/types';
import { 
    getPondingPoints, 
    getActiveSpell, 
    startSpell, 
    stopSpell, 
    batchUpdatePondingPoints,
    addOrUpdatePondingPoint,
    deletePondingPoint,
    getActiveRainEvent
} from '../actions';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Home, PlayCircle, PauseCircle, RefreshCw, PlusCircle, Trash2, ArrowLeft, CloudOff, Info } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

export default function DataEntryPage({ params }: { params: { cityName: string } }) {
    const { cityName: encodedCityName } = use(params);
    const cityName = decodeURIComponent(encodedCityName);
    
    const { toast } = useToast();
    const { user, claims, loading: authLoading } = useAuth();
    const router = useRouter();

    const [isPending, startTransition] = useTransition();
    const [activeRainEvent, setActiveRainEvent] = useState<RainEvent | null>(null);
    const [isSpellActive, setIsSpellActive] = useState(false);
    const [isStopSpellBlocked, setStopSpellBlocked] = useState(false);

    // State for the table form
    const [points, setPoints] = useState<PondingPoint[]>([]);
    
    // State for modals/dialogs
    const [isFormOpen, setFormOpen] = useState(false);
    const [isDeleteAlertOpen, setDeleteAlertOpen] = useState(false);
    const [pointToDelete, setPointToDelete] = useState<PondingPoint | null>(null);
    const [pointForClearance, setPointForClearance] = useState<PondingPoint | null>(null);

    const formRef = useRef<HTMLFormElement>(null);
    const addPointFormRef = useRef<HTMLFormElement>(null);

    const fetchData = async () => {
        const rainEvent = await getActiveRainEvent(cityName);
        setActiveRainEvent(rainEvent);

        let activeSpell = null;
        if (rainEvent) {
            activeSpell = await getActiveSpell(rainEvent.id);
        }
        setIsSpellActive(!!activeSpell);

        const pointsData = await getPondingPoints(cityName, rainEvent?.id);
        const sortedPoints = pointsData.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999) || a.name.localeCompare(b.name));
        setPoints(sortedPoints);
    };
    
    useEffect(() => {
        if (!authLoading) {
          if (!user) {
            router.push('/login');
            return;
          }
          if (claims?.role === 'viewer') {
            toast({ variant: 'destructive', title: 'Access Denied', description: "You don't have permission to view this page." });
            router.push(`/city/${encodeURIComponent(cityName)}`);
          }
        }
    }, [authLoading, user, claims, router, toast, cityName]);

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [cityName, user]);

    const submitBatchUpdate = (formData: FormData) => {
        startTransition(async () => {
            const result = await batchUpdatePondingPoints(formData, cityName);
            if (result.success) {
                toast({ title: 'Success', description: result.message });
                await fetchData();
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
        });
    };
    
    const handleBatchUpdateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        
        // Find the first point that was cleared but has no clearance time
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            const originalPonding = point.ponding ?? 0;
            const newPonding = parseFloat(formData.get(`points[${i}].ponding`) as string || '0');
            const clearanceTime = formData.get(`points[${i}].clearedInTime`) as string;

            if (originalPonding > 0 && newPonding === 0 && !clearanceTime) {
                setPointForClearance(point);
                return; // Stop submission and show dialog
            }
        }

        // If all checks pass, submit the form
        submitBatchUpdate(formData);
    };
    
    const handleClearanceTimeSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!pointForClearance || !formRef.current) return;

        const timeData = new FormData(e.currentTarget);
        const newClearanceTime = timeData.get('clearanceTime') as string;

        // Find the corresponding input in the main form and update its value
        const pointIndex = points.findIndex(p => p.id === pointForClearance.id);
        if (pointIndex !== -1) {
            const timeInput = formRef.current.querySelector(`input[name="points[${pointIndex}].clearedInTime"]`) as HTMLInputElement;
            if (timeInput) {
                timeInput.value = newClearanceTime;
            }
        }
        
        // Close the dialog and re-submit the main form
        setPointForClearance(null);
        
        // Use a short timeout to allow state to update before re-submitting
        setTimeout(() => {
            if (formRef.current) {
                // We create a new "submit" event to pass to the handler.
                // This feels a bit like a hack, but it's a clean way to re-trigger our validation logic.
                const fakeEvent = {
                    preventDefault: () => {},
                    currentTarget: formRef.current,
                } as unknown as React.FormEvent<HTMLFormElement>;
                
                handleBatchUpdateSubmit(fakeEvent);
            }
        }, 50);
    };


    const handleToggleSpell = () => {
        if (!activeRainEvent) return;
        startTransition(async () => {
          if (isSpellActive) {
            const hasActiveRain = points.some(p => (p.currentSpell ?? 0) > 0);
            if (hasActiveRain) {
                setStopSpellBlocked(true);
                return;
            }
            const result = await stopSpell(cityName, activeRainEvent.id);
            if(result.success) {
                toast({ title: 'Spell Ended', description: result.message });
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
          } else {
            const result = await startSpell(cityName, activeRainEvent.id);
            if (result.success) {
                toast({ title: 'Spell Started', description: result.message });
            } else {
                 toast({ variant: 'destructive', title: 'Error Starting Spell', description: result.error });
            }
          }
          await fetchData();
        });
    };
    
    const handleAddPointSubmit = (formData: FormData) => {
        startTransition(async () => {
            const result = await addOrUpdatePondingPoint(formData, cityName);
            if (result.success) {
                toast({ title: 'Success', description: 'New point added.' });
                setFormOpen(false);
                addPointFormRef.current?.reset();
                await fetchData();
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
        });
    };
    
    const handleDeleteClick = (point: PondingPoint) => {
        setPointToDelete(point);
        setDeleteAlertOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!pointToDelete) return;
        startTransition(async () => {
            const result = await deletePondingPoint(pointToDelete.id, cityName);
            if(result.success){
                toast({ title: 'Success', description: result.message });
            } else {
                 toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
            setDeleteAlertOpen(false);
            setPointToDelete(null);
            await fetchData();
        });
    };

    if (authLoading || !user || !claims || claims.role === 'viewer') {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <main className="p-4 sm:p-6 md:p-8">
            <header className="flex flex-col sm:flex-row justify-between items-start mb-8 gap-4">
                <h1 className="text-3xl sm:text-4xl font-bold text-primary">
                    Bulk Data Entry
                </h1>
                <div className="flex items-center gap-2">
                    <Button onClick={handleToggleSpell} disabled={isPending || !activeRainEvent}>
                        {isPending ? <RefreshCw className="mr-2 animate-spin" /> : isSpellActive ? <PauseCircle className="mr-2" /> : <PlayCircle className="mr-2" />}
                        {isSpellActive ? 'Stop Spell' : 'Start Spell'}
                    </Button>
                    <Button onClick={() => setFormOpen(true)} disabled={!isSpellActive}>
                        <PlusCircle className="mr-2" />
                        Add Point
                    </Button>
                </div>
            </header>

            {!activeRainEvent && (
                <Card className="mb-8 border-primary/50 bg-primary/10">
                    <CardContent className="p-6 flex items-center justify-center gap-4">
                        <Info className="h-6 w-6 text-primary"/>
                        <p className="text-lg font-semibold text-primary-foreground">No active rain event. Please start a rain event from the main dashboard to begin entering data.</p>
                    </CardContent>
                </Card>
            )}

            {points.length > 0 ? (
                <form onSubmit={handleBatchUpdateSubmit} ref={formRef}>
                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[30%]">Point Name</TableHead>
                                    <TableHead>Rain (mm)</TableHead>
                                    <TableHead>Ponding (in)</TableHead>
                                    <TableHead>Cleared In (hh:mm)</TableHead>
                                    {claims?.role !== 'city-user' && (
                                        <TableHead className="text-right">Actions</TableHead>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {points.map((point, index) => (
                                    <RainfallTableRow 
                                        key={point.id}
                                        point={point}
                                        index={index}
                                        isSpellActive={isSpellActive}
                                        isPending={isPending}
                                        userRole={claims?.role}
                                        onDelete={handleDeleteClick}
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                    <div className="mt-6 flex justify-end">
                        <Button type="submit" size="lg" disabled={isPending || !isSpellActive}>
                             {isPending && <RefreshCw className="animate-spin" />}
                             {isPending ? 'Saving...' : 'Save All Changes'}
                        </Button>
                    </div>
                </form>
            ) : (
                <Card className="md:col-span-2 lg:col-span-3">
                    <CardContent className="flex flex-col items-center justify-center h-48">
                        <h3 className="text-lg font-semibold">No Ponding Points Found</h3>
                        <p className="text-muted-foreground">Get started by adding a new ponding point during an active spell.</p>
                    </CardContent>
                </Card>
            )}

            {/* Dialog for adding a new point */}
            <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Add Ponding Point</DialogTitle>
                        <DialogDescription>Add a new location to track for ponding.</DialogDescription>
                    </DialogHeader>
                    <form ref={addPointFormRef} action={handleAddPointSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="name" className="text-right">Name</Label>
                                <Input id="name" name="name" className="col-span-3" required />
                            </div>
                             <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="order" className="text-right">Order</Label>
                                <Input id="order" name="order" type="number" defaultValue={points.length + 1} className="col-span-3" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending && <RefreshCw className="animate-spin" />}
                                Add Point
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Alert Dialog for deleting a point */}
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
            
            <Dialog open={!!pointForClearance} onOpenChange={(open) => !open && setPointForClearance(null)}>
                <DialogContent>
                     <form onSubmit={handleClearanceTimeSubmit}>
                        <DialogHeader>
                            <DialogTitle>Clearance Time Required</DialogTitle>
                            <DialogDescription>
                                Ponding was cleared for <span className="font-bold">{pointForClearance?.name}</span>. Please provide the clearance time.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <Label htmlFor="clearanceTime">Clearance Time (hh:mm)</Label>
                            <Input
                                id="clearanceTime"
                                name="clearanceTime"
                                autoFocus
                                required
                                placeholder="e.g., 02:30"
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setPointForClearance(null)}>
                                Cancel
                            </Button>
                            <Button type="submit">
                                Save and Continue
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </main>
    );
}

function RainfallTableRow({ point, index, isSpellActive, isPending, userRole, onDelete }: { point: PondingPoint, index: number, isSpellActive: boolean, isPending: boolean, userRole?: string, onDelete: (point: PondingPoint) => void }) {
    const [rainValue, setRainValue] = useState((point.currentSpell ?? 0).toString());
    const [pondingValue, setPondingValue] = useState((point.ponding ?? 0).toString());
    const [clearedInTimeValue, setClearedInTimeValue] = useState(point.clearedInTime || '');
    const isTrace = rainValue === '0.1';

    useEffect(() => {
        setRainValue((point.currentSpell ?? 0).toString());
        setPondingValue((point.ponding ?? 0).toString());
        setClearedInTimeValue(point.clearedInTime || '');
    }, [point.currentSpell, point.ponding, point.clearedInTime, isSpellActive]);

    const handleTraceChange = (checked: boolean) => {
        setRainValue(checked ? '0.1' : '0');
    };

    const handleRainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setRainValue(e.target.value);
    };

    const handlePondingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setPondingValue(newValue);
        if (parseFloat(newValue) > 0) {
            setClearedInTimeValue('');
        }
    };

    return (
        <TableRow>
            <TableCell className="font-medium">
                <input type="hidden" name={`points[${index}].id`} defaultValue={point.id} />
                <input type="hidden" name={`points[${index}].name`} defaultValue={point.name} />
                {point.name}
            </TableCell>
            <TableCell>
                <div className="flex flex-wrap items-center gap-2">
                    <Input
                        name={`points[${index}].currentSpell`}
                        type="number"
                        value={rainValue}
                        onChange={handleRainChange}
                        step="0.1"
                        min="0"
                        disabled={!isSpellActive || isPending}
                        className="w-24"
                    />
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <Checkbox
                            id={`trace-${point.id}`}
                            checked={isTrace}
                            onCheckedChange={handleTraceChange}
                            disabled={!isSpellActive || isPending}
                        />
                        <Label htmlFor={`trace-${point.id}`} className="text-sm font-normal">Trace</Label>
                    </div>
                    <Button 
                        type="button" 
                        variant="ghost"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => setRainValue('0')}
                        disabled={!isSpellActive || isPending}>
                        <CloudOff className="mr-1 h-3 w-3"/>
                        Stop Rain
                    </Button>
                </div>
            </TableCell>
            <TableCell>
                <Input
                    name={`points[${index}].ponding`}
                    type="number"
                    value={pondingValue}
                    onChange={handlePondingChange}
                    step="0.1"
                    min="0"
                    disabled={isPending}
                    className="max-w-xs"
                />
            </TableCell>
            <TableCell>
                <div className="flex items-center gap-2">
                    <Input
                        name={`points[${index}].clearedInTime`}
                        type="text"
                        value={clearedInTimeValue}
                        onChange={(e) => setClearedInTimeValue(e.target.value)}
                        placeholder="e.g., 02:30"
                        disabled={isPending || parseFloat(pondingValue) > 0}
                        className="w-28"
                    />
                    <Button 
                        type="button" 
                        variant="ghost"
                        size="sm"
                        className="text-xs h-8"
                        onClick={(e) => {
                             const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                            if (input) {
                                input.value = 'Cleared During Rain';
                                setClearedInTimeValue('Cleared During Rain');
                            }
                        }}
                        disabled={isPending || parseFloat(pondingValue) > 0}>
                        During Rain
                    </Button>
                </div>
            </TableCell>
            {userRole !== 'city-user' && (
                <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(point)} disabled={isPending || isSpellActive}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </TableCell>
            )}
        </TableRow>
    );
}
