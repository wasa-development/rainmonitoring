
'use client';

import { useState, use, useEffect, useRef, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { PondingPoint } from '@/lib/types';
import { 
    getPondingPoints, 
    getActiveSpell, 
    startSpell, 
    stopSpell, 
    batchUpdatePondingPoints,
    addOrUpdatePondingPoint,
    deletePondingPoint
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
import { ThemeToggle } from '@/components/theme-toggle';
import { Home, PlayCircle, PauseCircle, RefreshCw, PlusCircle, Trash2, ArrowLeft } from 'lucide-react';

export default function DataEntryPage({ params }: { params: { cityName: string } }) {
    const { cityName: encodedCityName } = use(params);
    const cityName = decodeURIComponent(encodedCityName);
    
    const { toast } = useToast();
    const { user, claims, loading: authLoading } = useAuth();
    const router = useRouter();

    const [isPending, startTransition] = useTransition();
    const [isSpellActive, setIsSpellActive] = useState(false);
    const [isStopSpellBlocked, setStopSpellBlocked] = useState(false);

    // State for the table form
    const [points, setPoints] = useState<PondingPoint[]>([]);
    
    // State for modals/dialogs
    const [isFormOpen, setFormOpen] = useState(false);
    const [isDeleteAlertOpen, setDeleteAlertOpen] = useState(false);
    const [pointToDelete, setPointToDelete] = useState<PondingPoint | null>(null);

    const formRef = useRef<HTMLFormElement>(null);
    const addPointFormRef = useRef<HTMLFormElement>(null);

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
        async function fetchData() {
            const [pointsData, activeSpell] = await Promise.all([
                getPondingPoints(cityName),
                getActiveSpell(cityName)
            ]);
            const sortedPoints = pointsData.sort((a, b) => a.name.localeCompare(b.name));
            setPoints(sortedPoints);
            setIsSpellActive(!!activeSpell);
        }
        if (user) {
            fetchData();
        }
    }, [cityName, user, isPending]);

    const handleBatchUpdateSubmit = (formData: FormData) => {
        startTransition(async () => {
            const result = await batchUpdatePondingPoints(formData, cityName);
            if (result.success) {
                toast({ title: 'Success', description: result.message });
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
        });
    };

    const handleToggleSpell = () => {
        startTransition(async () => {
          if (isSpellActive) {
            const hasActiveRain = points.some(p => p.currentSpell > 0);
            if (hasActiveRain) {
                setStopSpellBlocked(true);
                return;
            }
            const result = await stopSpell(cityName);
            toast({ title: 'Spell Ended', description: result.message });
          } else {
            const result = await startSpell(cityName);
            toast({ title: 'Spell Started', description: 'You can now enter rainfall data.' });
          }
        });
    };
    
    const handleAddPointSubmit = (formData: FormData) => {
        startTransition(async () => {
            const result = await addOrUpdatePondingPoint(formData, cityName);
            if (result.success) {
                toast({ title: 'Success', description: 'New point added.' });
                setFormOpen(false);
                addPointFormRef.current?.reset();
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
            toast({ title: 'Success', description: result.message });
            setDeleteAlertOpen(false);
            setPointToDelete(null);
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
        <main className="container mx-auto p-4 sm:p-6 md:p-8">
            <header className="flex flex-col sm:flex-row justify-between items-start mb-8 gap-4">
                <div className="flex items-center gap-4">
                     <Link href={`/city/${encodeURIComponent(cityName)}`} className="text-primary hover:text-primary/80">
                        <ArrowLeft className="w-7 h-7" />
                    </Link>
                    <h1 className="text-3xl sm:text-4xl font-bold text-primary">
                        Bulk Data Entry: {cityName}
                    </h1>
                </div>
                 <div className="flex items-center gap-2">
                    <Button onClick={handleToggleSpell} disabled={isPending}>
                        {isPending ? <RefreshCw className="mr-2 animate-spin" /> : isSpellActive ? <PauseCircle className="mr-2" /> : <PlayCircle className="mr-2" />}
                        {isSpellActive ? 'Stop Spell' : 'Start Spell'}
                    </Button>
                    <Button onClick={() => setFormOpen(true)}>
                        <PlusCircle className="mr-2" />
                        Add Point
                    </Button>
                    <ThemeToggle />
                </div>
            </header>

            {points.length > 0 ? (
                <form action={handleBatchUpdateSubmit} ref={formRef}>
                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[30%]">Point Name</TableHead>
                                    <TableHead>Rain (mm)</TableHead>
                                    <TableHead>Ponding (in)</TableHead>
                                    <TableHead>Cleared In (hh:mm)</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {points.map((point, index) => (
                                    <TableRow key={point.id}>
                                        <input type="hidden" name={`points[${index}].id`} defaultValue={point.id} />
                                        <input type="hidden" name={`points[${index}].name`} defaultValue={point.name} />
                                        <TableCell className="font-medium">{point.name}</TableCell>
                                        <TableCell>
                                            <Input
                                                name={`points[${index}].currentSpell`}
                                                type="number"
                                                defaultValue={point.currentSpell ?? 0}
                                                step="0.1"
                                                min="0"
                                                disabled={!isSpellActive || isPending}
                                                className="max-w-xs"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                name={`points[${index}].ponding`}
                                                type="number"
                                                defaultValue={point.ponding ?? 0}
                                                step="0.1"
                                                min="0"
                                                disabled={isPending}
                                                className="max-w-xs"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                name={`points[${index}].clearedInTime`}
                                                type="text"
                                                defaultValue={point.clearedInTime || ''}
                                                placeholder="e.g., 02:30"
                                                disabled={isPending}
                                                className="max-w-xs"
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(point)} disabled={isPending}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                    <div className="mt-6 flex justify-end">
                        <Button type="submit" size="lg" disabled={isPending}>
                             {isPending && <RefreshCw className="animate-spin" />}
                             {isPending ? 'Saving...' : 'Save All Changes'}
                        </Button>
                    </div>
                </form>
            ) : (
                <Card className="md:col-span-2 lg:col-span-3">
                    <CardContent className="flex flex-col items-center justify-center h-48">
                        <h3 className="text-lg font-semibold">No Ponding Points Found</h3>
                        <p className="text-muted-foreground">Get started by adding a new ponding point.</p>
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

        </main>
    );
}
