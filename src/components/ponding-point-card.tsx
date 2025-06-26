'use client';

import type { AdminUser, PondingPoint } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Droplets, Edit, Trash2, TrendingUp, Clock, AlertTriangle } from 'lucide-react';
import React from 'react';

const CardRainAnimation = () => {
  const raindrops = React.useMemo(() => 
    Array.from({ length: 70 }).map((_, i) => {
      const style = {
        left: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 2}s`,
        animationDuration: `${1.2 + Math.random() * 0.6}s`,
      };
      return <div key={i} className="raindrop" style={style} />;
    }), []);

  return <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-lg z-10">{raindrops}</div>;
};

const PondingAnimation = ({ height }: { height: number }) => (
    <div className="ponding-animation-container" style={{ height: `${height}%` }}>
        <div className="wave-layer wave1"></div>
        <div className="wave-layer wave2"></div>
    </div>
);

interface PondingPointCardProps {
    point: PondingPoint;
    onEdit: (point: PondingPoint) => void;
    onDelete: (point: PondingPoint) => void;
    userRole?: AdminUser['role'];
}

export default function PondingPointCard({ point, onEdit, onDelete, userRole }: PondingPointCardProps) {
    const isRaining = point.isRaining && point.currentSpell > 0;
    const isPonding = point.ponding > 0;

    // Scale: Start at 5% height, add 4% for each inch of ponding, up to a max of 40%.
    const waveHeightPercentage = Math.min(40, 5 + (point.ponding || 0) * 4);

    return (
        <Card className="relative flex flex-col overflow-hidden transition-all duration-300 hover:border-primary/50 group">
            {isRaining && <CardRainAnimation />}
            {isPonding && <PondingAnimation height={waveHeightPercentage} />}
            
            <div className="relative z-20 bg-card/50 dark:bg-black/20 backdrop-blur-[2px] flex flex-col flex-grow rounded-lg">
                <CardHeader className="flex flex-row items-start justify-between p-4">
                    <div>
                        <CardTitle className="text-lg">{point.name}</CardTitle>
                    </div>
                    <div className="flex gap-1">
                    {userRole !== 'viewer' && (
                        <>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(point)}>
                                <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(point)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </>
                    )}
                    </div>
                </CardHeader>
                <CardContent className="flex-grow p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <Droplets className="h-5 w-5 text-primary" />
                            <div>
                                <p className="text-muted-foreground">Current Rain</p>
                                <p className="font-semibold">{point.currentSpell.toFixed(1)} mm</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-primary" />
                            <div>
                                <p className="text-muted-foreground">Max Today</p>
                                <p className="font-semibold">{(point.dailyMaxSpell ?? 0).toFixed(1)} mm</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-primary" />
                            <div>
                                <p className="text-muted-foreground">Ponding</p>
                                <p className="font-semibold">{point.ponding.toFixed(1)} in</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-primary" />
                            <div>
                                <p className="text-muted-foreground">Cleared In</p>
                                <p className="font-semibold">{point.ponding > 0 ? '—' : point.clearedInTime || '—'}</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="p-4 pt-0">
                    {isRaining ? (
                        <Badge variant="secondary" className="bg-blue-900/50 text-blue-300 border-blue-500/50">
                            <Droplets className="mr-1 h-3 w-3" />
                            Raining
                        </Badge>
                    ) : isPonding ? (
                        <Badge variant="secondary" className="bg-amber-900/60 text-amber-300 border-amber-500/60">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Ponding
                        </Badge>
                    ) : (
                        <Badge variant="outline">Clear</Badge>
                    )}
                </CardFooter>
            </div>
        </Card>
    );
}
