
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Download, RefreshCw, Eye } from 'lucide-react';
import { getDailyReportData, getRainEvents } from '../actions';
import { generateDailyReportPdf } from '@/lib/report-generator';
import type { DailyReportData, RainEvent } from '@/lib/types';
import { Logo } from '@/components/logo';

function getOrdinalSuffix(i: number) {
  const j = i % 10, k = i % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

function GeneratedReport({ reportData, cityName }: { reportData: DailyReportData, cityName: string }) {
  const { maxTotalRainfall } = reportData;
  const sortedPoints = [...reportData.points].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999) || a.pointName.localeCompare(b.pointName));
  const lastSpellEndTime = reportData.spells.length > 0 ? new Date(reportData.spells[reportData.spells.length - 1].endTime) : new Date();

  return (
    <div className="max-w-5xl mx-auto bg-white dark:bg-card shadow-lg mt-4" id="report-content">
      <div style={{ backgroundColor: '#0073C4' }} className="text-white grid grid-cols-[auto_1fr] items-center p-4 gap-x-4">
        <div className="bg-white p-1 rounded-md self-center row-span-2">
          <Logo width={64} height={64} />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold">{cityName} Region Local Rainfall</h2>
          <p>Dated {format(new Date(reportData.reportDate), 'dd-MM-yyyy')}</p>
        </div>
        <div className="text-center col-start-2">
          <div className="mt-2">
            <p className="font-bold">Rain Duration</p>
            {reportData.spells.map((spell, index) => {
              const spellNumber = index + 1;
              return (
                <p key={index}>
                  {spellNumber}{getOrdinalSuffix(spellNumber)} Spell {format(new Date(spell.startTime), 'hh:mm a')} to {format(new Date(spell.endTime), 'hh:mm a')}
                </p>
              );
            })}
          </div>
          <p className="mt-1">Reporting Time: {format(lastSpellEndTime, 'hh:mm a')}</p>
        </div>
      </div>

      <div className="overflow-x-auto p-1 text-black">
        <table className="w-full text-sm border-collapse">
          <thead style={{ backgroundColor: '#DDEBF7' }}>
            <tr>
              <th className="px-2 py-2 border-2 border-black w-16 text-center font-bold">Sr. #</th>
              <th className="px-2 py-2 border-2 border-black text-left font-bold">Main Points in {cityName}</th>
              {reportData.spells.map((_, index) => {
                const spellNumber = index + 1;
                return (
                  <th key={index} className="px-2 py-2 border-2 border-black text-center font-bold">{spellNumber}{getOrdinalSuffix(spellNumber)} Spell</th>
                )
              })}
              <th className="px-2 py-2 border-2 border-black text-center font-bold">Total Rain</th>
              <th className="px-2 py-2 border-2 border-black text-center font-bold">RAIN STATUS</th>
            </tr>
          </thead>
          <tbody>
            {sortedPoints.map((point, index) => (
              <tr key={point.pointName} style={index % 2 === 0 ? {} : { backgroundColor: '#F2F2F2' }} className="h-8">
                <td className="px-2 py-1 border-2 border-black text-center">{index + 1}</td>
                <td className="px-2 py-1 border-2 border-black">{point.pointName}</td>
                {point.spellRainfall.map((rainfall, spellIndex) => (
                  <td key={spellIndex} className="px-2 py-1 border-2 border-black text-center">
                    {rainfall === 0.1 ? 'Trace' : rainfall.toFixed(1)}
                  </td>
                ))}
                <td className="px-2 py-1 border-2 border-black text-center font-bold" style={point.totalRainfall === maxTotalRainfall && maxTotalRainfall > 0 ? { color: 'red' } : {}}>
                  {point.totalRainfall.toFixed(1)}
                </td>
                <td className="px-2 py-1 border-2 border-black text-center">{point.finalStatus}</td>
              </tr>
            ))}
             <tr style={{ backgroundColor: '#DDEBF7' }}>
                <td colSpan={2 + reportData.spells.length} className="px-2 py-2 border-2 border-black font-bold text-left">
                  Average Rain record ({cityName} Region)
                </td>
                <td className="px-2 py-2 border-2 border-black font-bold text-center">
                  {reportData.averageRainfall.toFixed(2)}
                </td>
                <td className="px-2 py-2 border-2 border-black"></td>
              </tr>
          </tbody>
        </table>
      </div>

      <div style={{ backgroundColor: '#0073C4' }} className="text-white text-center p-2 mt-0 font-semibold">
        Monsoon Control Room, WASA Head Office {cityName}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const params = useParams();
  const encodedCityName = params?.cityName as string;
  const cityName = decodeURIComponent(encodedCityName);

  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState<DailyReportData | null>(null);
  const [rainEvents, setRainEvents] = useState<RainEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    getRainEvents(cityName)
      .then(setRainEvents)
      .finally(() => setEventsLoading(false));
  }, [authLoading, user, cityName, router]);

  const handleViewReport = async (rainEventId: string) => {
    setIsLoading(true);
    setReportData(null);
    try {
      const data = await getDailyReportData(cityName, rainEventId);
      if (data) {
        setReportData(data);
        toast({
          title: "Report Generated",
          description: `Showing report for event started at ${format(new Date(data.reportDate), 'PPP')}.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "No Data",
          description: `No spell data found for the selected rain event.`,
        });
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e.message || "Failed to generate report.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPdf = () => {
    if (reportData) {
      generateDailyReportPdf(reportData, cityName);
    }
  };
  
  if (authLoading || eventsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="p-4 sm:p-6 md:p-8">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-primary">
          Rain Event Reports
        </h1>
      </header>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Event History</CardTitle>
          <CardDescription>Select a rain event to view its detailed report.</CardDescription>
        </CardHeader>
        <CardContent>
            {rainEvents.length > 0 ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Start Time</TableHead>
                            <TableHead>End Time</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rainEvents.map(event => (
                            <TableRow key={event.id}>
                                <TableCell>{format(new Date(event.startedAt), 'PPpp')}</TableCell>
                                <TableCell>{event.endedAt ? format(new Date(event.endedAt), 'PPpp') : '—'}</TableCell>
                                <TableCell>
                                    <Badge variant={event.status === 'active' ? 'default' : 'secondary'} className={cn(event.status === 'active' && "bg-green-600")}>
                                        {event.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button onClick={() => handleViewReport(event.id)} variant="outline" size="sm" disabled={isLoading}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        View Report
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : (
                <p className="text-muted-foreground text-center py-8">No rain events found for {cityName}.</p>
            )}
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex justify-center mt-8">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {reportData && !isLoading && (
        <>
          <div className="mt-8 flex justify-end max-w-5xl mx-auto">
            <Button onClick={handleDownloadPdf}>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          </div>
          <GeneratedReport reportData={reportData} cityName={cityName} />
        </>
      )}
    </main>
  );
}
