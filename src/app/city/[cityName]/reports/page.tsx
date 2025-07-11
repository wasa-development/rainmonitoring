
'use client';

import { useState, use } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Download, RefreshCw, Search } from 'lucide-react';
import { getDailyReportData } from '../actions';
import { generateDailyReportPdf } from '@/lib/report-generator';
import type { DailyReportData } from '@/lib/types';
import { Logo } from '@/components/logo';

function getOrdinalSuffix(i: number) {
    const j = i % 10,
        k = i % 100;
    if (j === 1 && k !== 11) return "st";
    if (j === 2 && k !== 12) return "nd";
    if (j === 3 && k !== 13) return "rd";
    return "th";
}

function GeneratedReport({ reportData, cityName }: { reportData: DailyReportData, cityName: string }) {
  const { maxTotalRainfall } = reportData;
  const sortedPoints = [...reportData.points].sort((a,b) => (a.order ?? 9999) - (b.order ?? 9999) || a.pointName.localeCompare(b.pointName));
  const lastSpellEndTime = reportData.spells.length > 0 ? reportData.spells[reportData.spells.length - 1].endTime : new Date();

  return (
      <div className="max-w-5xl mx-auto bg-white dark:bg-card shadow-lg mt-4 text-black" id="report-content">
          <div style={{ backgroundColor: '#0073C4' }} className="text-white grid grid-cols-[auto_1fr] items-center p-4 gap-x-4">
              <div className="bg-white p-1 rounded-md self-center row-span-2">
                  <Logo width={64} height={64} />
              </div>
              <div className="text-center">
                  <h2 className="text-2xl font-bold">{cityName} Region Local Rainfall</h2>
                  <p>Dated {format(reportData.reportDate, 'dd-MM-yyyy')}</p>
              </div>
              <div className="text-center col-start-2">
                  <div className="mt-2">
                      <p className="font-bold">Rain Duration</p>
                      {reportData.spells.map((spell, index) => {
                          const spellNumber = index + 1;
                          return (
                              <p key={index}>
                                  {spellNumber}{getOrdinalSuffix(spellNumber)} Spell {format(spell.startTime, 'hh:mm a')} to {format(spell.endTime, 'hh:mm a')}
                              </p>
                          );
                      })}
                  </div>
                  <p className="mt-1">Reporting Time: {format(lastSpellEndTime, 'hh:mm a')}</p>
              </div>
          </div>
          
          <div className="overflow-x-auto p-1">
              <table className="w-full text-sm border-collapse">
                  <thead style={{ backgroundColor: '#DDEBF7' }}>
                      <tr>
                          <th scope="col" className="px-2 py-2 border-2 border-black w-16 text-center font-bold">Sr. #</th>
                          <th scope="col" className="px-2 py-2 border-2 border-black text-left font-bold">Main Points in {cityName}</th>
                          {reportData.spells.map((_, index) => {
                              const spellNumber = index + 1;
                              return (
                                <th key={index} scope="col" className="px-2 py-2 border-2 border-black text-center font-bold">{spellNumber}{getOrdinalSuffix(spellNumber)} Spell</th>
                              )
                          })}
                          <th scope="col" className="px-2 py-2 border-2 border-black text-center font-bold">Total Rain</th>
                          <th scope="col" className="px-2 py-2 border-2 border-black text-center font-bold">RAIN STATUS</th>
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
                  </tbody>
                   <tfoot style={{ backgroundColor: '#DDEBF7' }}>
                        <tr>
                             <td colSpan={2 + reportData.spells.length} className="px-2 py-2 border-2 border-black font-bold text-left">
                                Average Rain record ({cityName} Region)
                             </td>
                             <td className="px-2 py-2 border-2 border-black font-bold text-center">
                                {reportData.averageRainfall.toFixed(2)}
                             </td>
                             <td className="px-2 py-2 border-2 border-black"></td>
                        </tr>
                   </tfoot>
              </table>
          </div>

          <div style={{ backgroundColor: '#0073C4' }} className="text-white text-center p-2 mt-0 font-semibold">
              Monsoon Control Room, WASA Head Office {cityName}
          </div>
      </div>
  );
}

export default function ReportsPage({ params }: { params: { cityName: string } }) {
  const { cityName: encodedCityName } = use(params);
  const cityName = decodeURIComponent(encodedCityName);
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  
  const [reportDate, setReportDate] = useState<Date | undefined>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState<DailyReportData | null>(null);

  const handleViewReport = async () => {
    if (!reportDate) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Please select a date for the report.",
        });
        return;
    }

    setIsLoading(true);
    setReportData(null); // Clear previous report before fetching new one
    try {
        const dateString = format(reportDate, 'yyyy-MM-dd');
        const data = await getDailyReportData(cityName, dateString);
        if (data) {
            setReportData(data);
        } else {
            toast({
                variant: "destructive",
                title: "No Data",
                description: `No completed or active rain spells found for ${format(reportDate, 'PPP')}.`,
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
        toast({
            title: "Report Generated",
            description: "Your PDF report is downloading.",
        });
    }
  };

  if (authLoading || !user) {
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
          Rain Reports
        </h1>
      </header>
      <Card className="max-w-xl mx-auto overflow-hidden shadow-lg">
          <CardHeader>
              <CardTitle>Generate Rain Report</CardTitle>
              <CardDescription>Select a date to generate a PDF summary of all rain spells for that day.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-center justify-center gap-4 p-6">
              <Popover>
                  <PopoverTrigger asChild>
                      <Button
                          variant={"outline"}
                          className={cn(
                              "w-full sm:w-[280px] justify-start text-left font-normal",
                              !reportDate && "text-muted-foreground"
                          )}
                      >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {reportDate ? format(reportDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                      <Calendar
                          mode="single"
                          selected={reportDate}
                          onSelect={setReportDate}
                          initialFocus
                          disabled={(date) => date > new Date() || date < new Date("2024-01-01")}
                      />
                  </PopoverContent>
              </Popover>
              <Button onClick={handleViewReport} disabled={isLoading}>
                  {isLoading ? (
                      <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                      </>
                  ) : (
                      <>
                          <Search className="mr-2 h-4 w-4" />
                          View Report
                      </>
                  )}
              </Button>
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
