
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { getLatestReportData } from './actions';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, RefreshCw, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import type { Spell } from '@/lib/types';

export default function ReportPage({ params }: { params: { cityName: string } }) {
    const { cityName: encodedCityName } = params;
    const cityName = decodeURIComponent(encodedCityName);
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [reportData, setReportData] = useState<Spell | null>(null);
    const [dataLoading, setDataLoading] = useState(true);

    useEffect(() => {
        if (!authLoading) {
            if (!user) {
                router.push('/login');
            } else {
                getLatestReportData(cityName)
                    .then(data => {
                        setReportData(data);
                    })
                    .finally(() => {
                        setDataLoading(false);
                    });
            }
        }
    }, [authLoading, user, router, cityName]);


    const handlePrint = () => {
        window.print();
    };

    if (authLoading || dataLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    if (!reportData) {
        return (
            <main className="container mx-auto p-8">
                 <div className="flex justify-between items-center mb-8 print:hidden">
                    <Link href={`/city/${encodeURIComponent(cityName)}`}>
                        <Button variant="outline"><ArrowLeft className="mr-2" /> Back to Dashboard</Button>
                    </Link>
                </div>
                <div className="flex flex-col items-center justify-center text-center py-20 bg-card rounded-lg border">
                    <AlertTriangle className="w-16 h-16 text-muted-foreground mb-4" />
                    <h2 className="text-2xl font-semibold mb-2">No Report Available</h2>
                    <p className="text-muted-foreground max-w-md">There are no completed spell reports for {cityName} yet.</p>
                </div>
            </main>
        );
    }

    const { startTime, endTime, spellData } = reportData;

    return (
        <main className="bg-stone-100 dark:bg-background p-4 sm:p-8 font-sans">
            <div className="max-w-5xl mx-auto bg-white dark:bg-card shadow-lg">
                <header className="p-4 flex justify-between items-center border-b print:hidden">
                    <Link href={`/city/${encodeURIComponent(cityName)}`}>
                         <Button variant="outline"><ArrowLeft className="mr-2" /> Back to Dashboard</Button>
                    </Link>
                    <h1 className="text-xl font-bold text-foreground">Ponding Report</h1>
                    <Button onClick={handlePrint}><Printer className="mr-2" /> Print Report</Button>
                </header>
                
                <div className="p-1" id="report-content">
                    <div style={{ backgroundColor: '#0073C4' }} className="text-white grid grid-cols-3 items-center p-4">
                        <div className="flex items-center gap-4">
                             <div className="bg-white rounded-full p-1">
                                <Logo width={64} height={64} />
                            </div>
                            <div>
                                <p className="font-bold text-xl">WASA</p>
                                <p className="font-bold text-xl">{cityName.toUpperCase()}</p>
                            </div>
                        </div>
                        <div className="text-center">
                            <h2 className="text-3xl font-bold">Ponding Report</h2>
                            <p className="text-lg">Dated {format(new Date(endTime!), 'dd-MM-yyyy')}</p>
                        </div>
                        <div className="text-right text-base pl-2">
                            <p><strong>Rain Start:</strong> {format(new Date(startTime), 'hh:mm a')}</p>
                            <p><strong>Stop Time:</strong> {format(new Date(endTime!), 'hh:mm a')}</p>
                            <p><strong>Reporting Time:</strong> {format(new Date(endTime!), 'hh:mm a')}</p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                         <table className="w-full text-sm text-black border-collapse">
                            <thead style={{ backgroundColor: '#DDEBF7' }}>
                                <tr>
                                    <th scope="col" className="px-2 py-2 border-2 border-black w-16 text-center font-bold">Sr No</th>
                                    <th scope="col" className="px-2 py-2 border-2 border-black text-left font-bold">Name of Ponding Point</th>
                                    <th scope="col" className="px-2 py-2 border-2 border-black text-center font-bold">Ponding at Stop Time (Inches)</th>
                                    <th scope="col" className="px-2 py-2 border-2 border-black text-center font-bold">Total Clearance Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {spellData
                                .sort((a, b) => a.pointName.localeCompare(b.pointName))
                                .map((point, index) => (
                                    <tr key={point.pointId} style={{ backgroundColor: '#F2F2F2' }} className="h-8">
                                        <td className="px-2 py-1 border-2 border-black text-center">{index + 1}</td>
                                        <td className="px-2 py-1 border-2 border-black">{point.pointName}</td>
                                        <td className="px-2 py-1 border-2 border-black text-center">
                                            {point.pondingLevel > 0 ? point.pondingLevel.toFixed(1) : 'No Ponding'}
                                        </td>
                                        <td className="px-2 py-1 border-2 border-black text-center">{point.clearedInTime || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ backgroundColor: '#0073C4' }} className="text-white text-center p-2 mt-0 font-semibold">
                        Monsoon Control Room, WASA Head Office {cityName}
                    </div>
                </div>
            </div>
             <style jsx global>{`
                @media print {
                    @page {
                        size: landscape;
                        margin: 1cm;
                    }
                    body {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        background-color: white !important;
                    }
                    main {
                        padding: 0;
                        margin: 0;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                    #report-content {
                        box-shadow: none;
                        border: none;
                    }
                    table {
                        color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                    }
                }
            `}</style>
        </main>
    );
}
