'use client';

import { useState, use } from 'react';
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Home, PlusCircle, Droplets, Trash2, Edit, AlertTriangle } from 'lucide-react';
import RainAnimation from '@/components/rain-animation';
import type { PondingPoint } from '@/lib/types';
import { cn } from '@/lib/utils';

// Mock data for demonstration purposes
const mockPondingPoints: PondingPoint[] = [
  { id: '1', name: 'Liberty Chowk', currentSpell: 15, clearedInTime: '', ponding: 2.5, isRaining: true },
  { id: '2', name: 'Kalma Underpass', currentSpell: 25, clearedInTime: '', ponding: 4.0, isRaining: true },
  { id: '3', name: 'Center Point', currentSpell: 10, clearedInTime: '', ponding: 1.0, isRaining: false },
  { id: '4', name: 'Ferozepur Road', currentSpell: 22, clearedInTime: '', ponding: 3.5, isRaining: true },
  { id: '5', name: 'Ichhra Market', currentSpell: 8, clearedInTime: '', ponding: 0.5, isRaining: false },
  { id: '6', name: 'Model Town Park', currentSpell: 5, clearedInTime: '00:30', ponding: 0.0, isRaining: false },
];

const PONDING_THRESHOLD = 3.0; // inches

export default function CityDashboardPage({ params }: { params: { cityName: string } }) {
  const { cityName: encodedCityName } = use(params);
  const cityName = decodeURIComponent(encodedCityName);
  const [pondingPoints, setPondingPoints] = useState<PondingPoint[]>(
    [...mockPondingPoints].sort((a, b) => b.currentSpell - a.currentSpell)
  );
  
  const initialMaxCurrentSpell = Math.max(0, ...mockPondingPoints.map(p => p.currentSpell));
  const [maxSpellToday, setMaxSpellToday] = useState(Math.max(initialMaxCurrentSpell, 32.5)); // Start with a mock "daily max"

  const [isFormOpen, setFormOpen] = useState(false);

  const isRainingAnywhere = pondingPoints.some(p => p.isRaining);

  const handleAddPondingPoint = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const pondingValue = Number(formData.get('ponding'));

    const newPoint: PondingPoint = {
      id: new Date().toISOString(),
      name: formData.get('name') as string,
      currentSpell: Number(formData.get('currentSpell')),
      clearedInTime: pondingValue > 0 ? '' : (formData.get('clearedInTime') as string),
      ponding: pondingValue,
      isRaining: (formData.get('isRaining') as string) === 'on',
    };
    
    const updatedPoints = [...pondingPoints, newPoint].sort((a, b) => b.currentSpell - a.currentSpell);
    setPondingPoints(updatedPoints);

    if (newPoint.currentSpell > maxSpellToday) {
        setMaxSpellToday(newPoint.currentSpell);
    }

    setFormOpen(false);
    form.reset();
  };


  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {isRainingAnywhere && <RainAnimation />}
      
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

            <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
                <DialogTrigger asChild>
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Ponding Point
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                    <DialogTitle>Add New Ponding Point</DialogTitle>
                    <DialogDescription>
                        Enter the details for the new location. Click save when you're done.
                    </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddPondingPoint}>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="name" className="text-right">Name</Label>
                                <Input id="name" name="name" className="col-span-3" required />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="currentSpell" className="text-right">Spell (mm)</Label>
                                <Input id="currentSpell" name="currentSpell" type="number" step="0.1" className="col-span-3" required />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="clearedInTime" className="text-right">Cleared (hh:mm)</Label>
                                <Input id="clearedInTime" name="clearedInTime" type="text" placeholder="02:30" className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="ponding" className="text-right">Ponding (in)</Label>
                                <Input id="ponding" name="ponding" type="number" step="0.1" className="col-span-3" required />
                            </div>
                             <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="isRaining" className="text-right">Raining?</Label>
                                <Input id="isRaining" name="isRaining" type="checkbox" className="col-span-3 h-4 w-4 justify-self-start" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit">Save changes</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
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
                {pondingPoints.map((point) => (
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
                    <TableCell className="text-right">{point.ponding > 0 ? '—' : point.clearedInTime}</TableCell>
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
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </TableCell>
                </TableRow>
                ))}
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
                    <p className="text-4xl font-bold">{Math.max(0, ...pondingPoints.map(p => p.currentSpell)).toFixed(1)} <span className="text-lg font-normal text-muted-foreground">mm</span></p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Max Spell (Today)</CardTitle>
                     <CardDescription>Highest recorded rainfall today. (Auto-calculated)</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-4xl font-bold">{maxSpellToday.toFixed(1)} <span className="text-lg font-normal text-muted-foreground">mm</span></p>
                </CardContent>
            </Card>
        </div>
      </main>
    </div>
  );
}
