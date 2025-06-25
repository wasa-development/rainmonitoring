'use client';

import { useState, use, useEffect, useRef, useTransition } from 'react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Home, PlusCircle, Droplets, Trash2, Edit, AlertTriangle, RefreshCw, PlayCircle, PauseCircle } from 'lucide-react';
import RainAnimation from '@/components/rain-animation';
import type { PondingPoint } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getPondingPoints, addOrUpdatePondingPoint, deletePondingPoint } from './actions';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';


const PONDING_THRESHOLD = 3.0; // inches

export default function CityDashboardPage({ params }: { params: { cityName: string } }) {
  const { cityName: encodedCityName } = use(params);
  const cityName = decodeURIComponent(encodedCityName);
  const { toast } = useToast();
  
  const [pondingPoints, setPondingPoints] = useState<PondingPoint[]>([]);
  const [maxSpellToday, setMaxSpellToday] = useState(0);
  
  const [isFormOpen, setFormOpen] = useState(false);
  const [isDeleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [editingPoint, setEditingPoint] = useState<PondingPoint | null>(null);
  const [pointToDelete, setPointToDelete] = useState<PondingPoint | null>(null);
  const [isSpellActive, setIsSpellActive] = useState(false);
  const [showStopSpellAlert, setShowStopSpellAlert] = useState(false);

  const [isPending, startTransition] = useTransition();

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    async function fetchData() {
        const points = await getPondingPoints(cityName);
        const sortedPoints = points.sort((a, b) => b.currentSpell - a.currentSpell);
        setPondingPoints(sortedPoints);
        
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
    fetchData();
  }, [cityName, isPending]);

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    startTransition(async () => {
        const result = await addOrUpdatePondingPoint(formData, cityName);
        if (result.success) {
            toast({ title: 'Success', description: result.message });
            setFormOpen(false);
            setEditingPoint(null);
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

  const handleEditClick = (point: PondingPoint) => {
    setEditingPoint(point);
    setFormOpen(true);
  };

  const handleDeleteClick = (point: PondingPoint) => {
    setPointToDelete(point);
    setDeleteAlertOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
        setEditingPoint(null);
        formRef.current?.reset();
    }
    setFormOpen(open);
  }

  const handleToggleSpell = () => {
    if (isSpellActive) {
      // Trying to stop the spell
      const hasActiveRainfall = pondingPoints.some(p => p.currentSpell > 0);
      if (hasActiveRainfall) {
        setShowStopSpellAlert(true);
      } else {
        setIsSpellActive(false);
      }
    } else {
      // Starting the spell
      setIsSpellActive(true);
    }
  };

  const isRainingAnywhere = pondingPoints.some(p => p.isRaining);
  const maxCurrentSpell = Math.max(0, ...pondingPoints.map(p => p.currentSpell));

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {isSpellActive && isRainingAnywhere && <RainAnimation />}
      
      <main className="container mx-auto p-4 sm:p-6 md:p-8 z-10 relative">
        <header className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
            <div className="flex items-center gap-4">
                <Link href="/" className="text-accent hover:text-primary">
                    <Home className="w-7 h-7" />
                </Link>
                <h1 className="text-3xl sm:text-4xl font-bold text-primary">
                    Ponding Points: {cityName}
                </h1>
            </div>
            <div className="flex items-center gap-2">
                <Button onClick={handleToggleSpell}>
                    {isSpellActive ? <PauseCircle className="mr-2" /> : <PlayCircle className="mr-2" />}
                    {isSpellActive ? 'Stop Spell' : 'Start Spell'}
                </Button>
                <Dialog open={isFormOpen} onOpenChange={handleDialogClose}>
                    <DialogTrigger asChild>
                         <Button onClick={() => setEditingPoint(null)}>
                            <PlusCircle className="mr-2" />
                            Add Point
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                        <DialogTitle>{editingPoint ? 'Edit' : 'Add New'} Ponding Point</DialogTitle>
                        <DialogDescription>
                            {editingPoint
                                ? "Update the details for this ponding point. Rainfall data can only be entered during an active spell."
                                : "Add a new location to track for ponding."
                            }
                        </DialogDescription>
                        </DialogHeader>
                        <form ref={formRef} onSubmit={handleFormSubmit}>
                            {editingPoint && <input type="hidden" name="id" value={editingPoint.id} />}
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="name" className="text-right">Name</Label>
                                    <Input id="name" name="name" className="col-span-3" required defaultValue={editingPoint?.name} />
                                </div>
                                {editingPoint && (
                                    <>
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <Label htmlFor="currentSpell" className="text-right">Spell (mm)</Label>
                                            <Input id="currentSpell" name="currentSpell" type="number" step="0.1" className="col-span-3" required defaultValue={editingPoint?.currentSpell} disabled={!isSpellActive} />
                                        </div>
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <Label htmlFor="clearedInTime" className="text-right">Cleared (hh:mm)</Label>
                                            <Input id="clearedInTime" name="clearedInTime" type="text" placeholder="02:30" className="col-span-3" defaultValue={editingPoint?.clearedInTime} disabled={!isSpellActive || (editingPoint?.ponding ?? 0) > 0} />
                                        </div>
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <Label htmlFor="ponding" className="text-right">Ponding (in)</Label>
                                            <Input id="ponding" name="ponding" type="number" step="0.1" className="col-span-3" required defaultValue={editingPoint?.ponding} disabled={!isSpellActive} />
                                        </div>
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <Label htmlFor="isRaining" className="text-right">Raining?</Label>
                                            <Checkbox id="isRaining" name="isRaining" className="col-span-3 justify-self-start" defaultChecked={editingPoint?.isRaining} disabled={!isSpellActive} />
                                        </div>
                                    </>
                                )}
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={isPending}>
                                    {isPending && <RefreshCw className="animate-spin" />}
                                    {isPending ? 'Saving...' : 'Save changes'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </header>

        <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead className="w-[250px]">Ponding Point</TableHead>
                <TableHead className="text-right">Current Spell (mm)</TableHead>
                <TableHead className="text-right">Cleared in (hh:mm)</TableHead>
                <TableHead className="text-right">Ponding (in)</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {pondingPoints.length > 0 ? pondingPoints.map((point) => (
                <TableRow
                    key={point.id}
                    className={cn({
                    'ponding-animation': point.ponding > PONDING_THRESHOLD,
                    })}
                    style={
                    point.ponding > PONDING_THRESHOLD
                        ? ({
                            '--ponding-height': `${Math.min(
                                (point.ponding / (PONDING_THRESHOLD + 2)) * 100,
                                100
                            )}%`,
                            } as React.CSSProperties)
                        : undefined
                    }
                >
                    <TableCell className="font-medium">{point.name}</TableCell>
                    <TableCell className="text-right">{point.currentSpell.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{point.ponding > 0 ? '—' : point.clearedInTime || '—'}</TableCell>
                    <TableCell className="text-right font-bold">
                        <div className="flex items-center justify-end gap-2">
                        {point.ponding > PONDING_THRESHOLD && (
                            <AlertTriangle className="w-4 h-4 text-destructive" />
                        )}
                        {point.ponding.toFixed(1)}
                        </div>
                    </TableCell>
                    <TableCell className="text-center">
                        {point.isRaining ? (
                            <Badge variant="secondary" className="bg-blue-900/50 text-blue-300 border-blue-500/50">
                                <Droplets className="mr-1 h-3 w-3" />
                                Raining
                            </Badge>
                        ) : (
                            <Badge variant="outline">Clear</Badge>
                        )}
                    </TableCell>
                     <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditClick(point)}>
                                <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(point)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </TableCell>
                </TableRow>
                )) : (
                    <TableRow>
                        <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                            No ponding points added for {cityName} yet.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
            </Table>
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

        <AlertDialog open={showStopSpellAlert} onOpenChange={setShowStopSpellAlert}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Cannot Stop Spell</AlertDialogTitle>
                    <AlertDialogDescription>
                        You cannot stop the spell while rainfall is recorded at one or more points. Please set "Spell (mm)" to 0.0 for all points to proceed.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={() => setShowStopSpellAlert(false)}>OK</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

    </div>
  );
}
