
'use client';

import { useState, use } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Download, RefreshCw, Search } from 'lucide-react';
import { getDailyReportData } from '../actions';
import { generateDailyReportPdf } from '@/lib/report-generator';
import type { DailyReportData } from '@/lib/types';

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
        const data = await getDailyReportData(cityName, reportDate);
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
          <CardHeader style={{ backgroundColor: '#0073C4' }} className="text-white">
              <CardTitle className="text-white">Generate Rain Report</CardTitle>
              <CardDescription className="text-white/80">Select a date to generate a PDF summary of all rain spells for that day.</CardDescription>
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
        <Card className="mt-8">
            <CardHeader className="flex flex-row justify-between items-center">
                <div>
                    <CardTitle>Daily Rain Report</CardTitle>
                    <CardDescription>
                        Showing data for {format(reportData.reportDate, 'PPP')}
                    </CardDescription>
                </div>
                <Button onClick={handleDownloadPdf}>
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                </Button>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto border rounded-lg">
                    <Table>
                        <TableHeader>
                        <TableRow style={{ backgroundColor: '#DDEBF7' }} className="hover:bg-blue-100/70">
                            <TableHead className="font-bold text-black text-center w-16">Sr No</TableHead>
                            <TableHead className="font-bold text-black">Ponding Point</TableHead>
                            {reportData.spells.map((spell, index) => (
                            <TableHead key={index} className="text-center font-bold text-black">
                                Spell {index + 1} {spell.status === 'active' && <span className="text-red-500 font-bold">(Live)</span>} <br />
                                <span className="font-normal text-xs text-black/60">
                                ({format(spell.startTime, 'HH:mm')}-{format(spell.endTime, 'HH:mm')})
                                </span>
                            </TableHead>
                            ))}
                            <TableHead className="text-center font-bold text-black">Total Rain (mm)</TableHead>
                            <TableHead className="font-bold text-black">Final Status</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {reportData.points.sort((a,b) => a.pointName.localeCompare(b.pointName)).map((point, index) => (
                            <TableRow key={point.pointName} style={{ backgroundColor: '#F2F2F2' }} className="hover:bg-stone-300/50">
                            <TableCell className="font-medium text-center">{index + 1}</TableCell>
                            <TableCell className="font-medium">{point.pointName}</TableCell>
                            {point.spellRainfall.map((rainfall, index) => (
                                <TableCell key={index} className="text-center">{rainfall.toFixed(0)}</TableCell>
                            ))}
                            <TableCell className="text-center font-bold">{point.totalRainfall.toFixed(0)}</TableCell>
                            <TableCell>{point.finalStatus}</TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
      )}

    </main>
  );
}
