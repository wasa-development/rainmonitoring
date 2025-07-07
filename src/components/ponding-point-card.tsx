
'use client';

import type { AdminUser, PondingPoint } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Droplets, Edit, Trash2, TrendingUp, Clock, AlertTriangle } from 'lucide-react';
import React from 'react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const WhiteRainAnimation = ({ slow = false }: { slow?: boolean }) => {
    const raindrops = React.useMemo(() =>
        Array.from({ length: slow ? 20 : 70 }).map((_, i) => {
            const style = {
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * (slow ? 5 : 2)}s`,
                animationDuration: slow ? `${2.5 + Math.random() * 1.5}s` : `${1.2 + Math.random() * 0.6}s`,
            };
            return <div key={i} className="raindrop" style={style} />;
        }), [slow]);

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
    isSpellActive: boolean;
}

export default function PondingPointCard({ point, onEdit, onDelete, userRole, isSpellActive }: PondingPointCardProps) {
    const isRaining = point.currentSpell > 0;
    const isPonding = (point.ponding ?? 0) > 0;
    const isClear = !isRaining && !isPonding;
    const isJustPonding = isPonding && !isRaining;

    // Determine if we should use a background image that necessitates light-colored text.
    const useImageBg = isRaining || isClear || isJustPonding;

    const waveHeightPercentage = Math.min(40, 5 + (point.ponding || 0) * 4);

    return (
        <Card className={cn(
            "relative flex flex-col overflow-hidden transition-all duration-300 hover:border-primary/50 group h-full text-sm"
        )}>
            
            <div className="absolute inset-0 z-0">
                {isRaining && (
                     <>
                        <Image src="/rainy-day.jpg" alt="Raining weather background" layout="fill" objectFit="cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/10" />
                    </>
                )}
                {isClear && (
                    <>
                        <Image src="/clear-day.jpg" alt="Clear sunny sky" layout="fill" objectFit="cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/10" />
                    </>
                )}
                 {isJustPonding && (
                    <>
                        {/* Use a blue-ish background for ponding state */}
                        <Image src="/cloudy-day.jpg" alt="Cloudy sky with ponding" layout="fill" objectFit="cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-blue-900/60 via-blue-800/40 to-black/10" />
                    </>
                )}
                {isPonding && <PondingAnimation height={waveHeightPercentage} />}
                {isRaining && <WhiteRainAnimation slow={point.currentSpell === 0.1} />}
            </div>
            
            <div className={cn(
                "relative z-10 flex flex-col flex-grow rounded-lg",
                // If we use an image background, text should be white. Otherwise, use theme color.
                useImageBg ? "text-white" : "text-card-foreground",
            )}>
                <CardHeader className="flex flex-row items-start justify-between p-2">
                    <div>
                        <CardTitle className="text-sm leading-tight">{point.name}</CardTitle>
                    </div>
                    <div className="flex gap-1">
                    {userRole !== 'viewer' && (
                        <>
                            {/* Buttons now work on any background since text color is consistently white with image BGs */}
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/10 hover:text-white" onClick={() => onEdit(point)}>
                                <Edit className="h-4 w-4" />
                            </Button>
                            {userRole !== 'city-admin' && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:bg-white/10 hover:text-red-400" onClick={() => onDelete(point)} disabled={isSpellActive}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </>
                    )}
                    </div>
                </CardHeader>
                <CardContent className="flex-grow p-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-1.5">
                            <Droplets className={cn("h-3.5 w-3.5", useImageBg ? "text-white/90" : "text-primary")} />
                            <div>
                                <p className={cn("text-xs", useImageBg ? "text-white/80" : "text-muted-foreground")}>Current Rain</p>
                                <p className="font-semibold text-xs">{point.currentSpell === 0.1 ? 'Trace' : `${(point.currentSpell ?? 0).toFixed(1)} mm`}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <TrendingUp className={cn("h-3.5 w-3.5", useImageBg ? "text-white/90" : "text-primary")} />
                            <div>
                                <p className={cn("text-xs", useImageBg ? "text-white/80" : "text-muted-foreground")}>Max Today</p>
                                <p className="font-semibold text-xs">{(point.dailyMaxSpell ?? 0).toFixed(1)} mm</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <AlertTriangle className={cn("h-3.5 w-3.5", useImageBg ? "text-white/90" : "text-accent")} />
                            <div>
                                <p className={cn("text-xs", useImageBg ? "text-white/80" : "text-muted-foreground")}>Ponding</p>
                                <p className="font-semibold text-xs">{(point.ponding ?? 0).toFixed(1)} in</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Clock className={cn("h-3.5 w-3.5", useImageBg ? "text-white/90" : "text-muted-foreground")} />
                            <div>
                                <p className={cn("text-xs", useImageBg ? "text-white/80" : "text-muted-foreground")}>Cleared In</p>
                                <p className="font-semibold text-xs">{point.ponding > 0 ? '—' : point.clearedInTime || '—'}</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="p-2 pt-0">
                    {isRaining ? (
                        <Badge variant="outline" className="bg-black/20 border-white/50 text-white">
                            <Droplets className="mr-1 h-3 w-3" />
                            Raining
                        </Badge>
                    ) : isPonding ? (
                         <Badge variant="destructive" className="bg-red-500/80 border-red-400 text-white shadow-lg">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Ponding
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="bg-black/20 border-white/50 text-white">Clear</Badge>
                    )}
                </CardFooter>
            </div>
        </Card>
    );
}
