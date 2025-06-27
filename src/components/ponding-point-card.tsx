'use client';

import type { AdminUser, PondingPoint } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Droplets, Edit, Trash2, TrendingUp, Clock, AlertTriangle } from 'lucide-react';
import React from 'react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const BlueRainAnimation = () => {
    const raindrops = React.useMemo(() =>
        Array.from({ length: 70 }).map((_, i) => {
            const style = {
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${1.2 + Math.random() * 0.6}s`,
            };
            return <div key={i} className="blue-raindrop" style={style} />;
        }), []);

    return <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-lg">{raindrops}</div>;
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
    const isClear = !isRaining && !isPonding;

    const hasBackgroundImage = isClear;

    const waveHeightPercentage = Math.min(40, 5 + (point.ponding || 0) * 4);

    return (
        <Card className="relative flex flex-col overflow-hidden transition-all duration-300 hover:border-primary/50 group h-full">
            
            <div className="absolute inset-0 z-0">
                {isClear && (
                    <>
                        <Image src="/clear-day.jpg" alt="Clear sunny sky" layout="fill" objectFit="cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/10" />
                    </>
                )}
                 {isRaining && (
                     <div className="absolute top-0 left-0 w-full h-1/4">
                        <Image src="/cloudy-day.jpg" alt="Cloudy sky" layout="fill" objectFit="cover" className="rounded-t-lg" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />
                    </div>
                )}
                {isPonding && <PondingAnimation height={waveHeightPercentage} />}
                {isRaining && <BlueRainAnimation />}
            </div>
            
            <div className={cn(
                "relative z-10 flex flex-col flex-grow rounded-lg",
                hasBackgroundImage ? "text-white" : "text-card-foreground",
            )}>
                <CardHeader className="flex flex-row items-start justify-between p-4">
                    <div>
                        <CardTitle className={cn("text-lg", isRaining && "text-white")}>{point.name}</CardTitle>
                    </div>
                    <div className="flex gap-1">
                    {userRole !== 'viewer' && (
                        <>
                            <Button variant="ghost" size="icon" className={cn("h-8 w-8", (hasBackgroundImage || isRaining) && "text-white hover:bg-white/10 hover:text-white")} onClick={() => onEdit(point)}>
                                <Edit className="h-4 w-4" />
                            </Button>
                            {userRole === 'super-admin' && (
                                <Button variant="ghost" size="icon" className={cn("h-8 w-8 text-destructive hover:text-destructive", (hasBackgroundImage || isRaining) && "text-red-400 hover:bg-white/10 hover:text-red-400")} onClick={() => onDelete(point)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </>
                    )}
                    </div>
                </CardHeader>
                <CardContent className="flex-grow p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <Droplets className={cn("h-5 w-5", hasBackgroundImage ? "text-white/90" : "text-primary")} />
                            <div>
                                <p className={cn(hasBackgroundImage ? "text-white/80" : "text-muted-foreground")}>Current Rain</p>
                                <p className="font-semibold">{point.currentSpell.toFixed(1)} mm</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <TrendingUp className={cn("h-5 w-5", hasBackgroundImage ? "text-white/90" : "text-primary")} />
                            <div>
                                <p className={cn(hasBackgroundImage ? "text-white/80" : "text-muted-foreground")}>Max Today</p>
                                <p className="font-semibold">{(point.dailyMaxSpell ?? 0).toFixed(1)} mm</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <AlertTriangle className={cn("h-5 w-5", hasBackgroundImage ? "text-white/90" : "text-accent")} />
                            <div>
                                <p className={cn(hasBackgroundImage ? "text-white/80" : "text-muted-foreground")}>Ponding</p>
                                <p className="font-semibold">{point.ponding.toFixed(1)} in</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock className={cn("h-5 w-5", hasBackgroundImage ? "text-white/90" : "text-muted-foreground")} />
                            <div>
                                <p className={cn(hasBackgroundImage ? "text-white/80" : "text-muted-foreground")}>Cleared In</p>
                                <p className="font-semibold">{point.ponding > 0 ? '—' : point.clearedInTime || '—'}</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="p-4 pt-0">
                    {isRaining ? (
                        <Badge variant="outline" className={cn(hasBackgroundImage && "bg-black/20 border-white/50 text-white")}>
                            <Droplets className="mr-1 h-3 w-3" />
                            Raining
                        </Badge>
                    ) : isPonding ? (
                        <Badge variant="destructive" className="bg-destructive/10 border-destructive/50 text-destructive">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Ponding
                        </Badge>
                    ) : (
                        <Badge variant="outline" className={cn(hasBackgroundImage && "bg-black/20 border-white/50 text-white")}>Clear</Badge>
                    )}
                </CardFooter>
            </div>
        </Card>
    );
}
