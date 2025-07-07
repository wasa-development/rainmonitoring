'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Download, RefreshCw } from 'lucide-react';
import { getDailyReportData } from '../actions';
import { generateDailyReportPdf } from '@/lib/report-generator';

export default function ReportsPage({ params }: { params: { cityName: string } }) {
  const cityName = decodeURIComponent(params.cityName);
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  
  const [reportDate, setReportDate] = useState<Date | undefined>(new Date());
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const handleGenerateReport = async () => {
    if (!reportDate) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Please select a date for the report.",
        });
        return;
    }

    setIsGeneratingReport(true);
    try {
        const data = await getDailyReportData(cityName, reportDate);
        if (data) {
            generateDailyReportPdf(data, cityName);
            toast({
                title: "Report Generated",
                description: "Your PDF report is downloading.",
            });
        } else {
            toast({
                variant: "destructive",
                title: "No Data",
                description: `No completed rain spells found for ${format(reportDate, 'PPP')}.`,
            });
        }
    } catch (e: any) {
        toast({
            variant: "destructive",
            title: "Error",
            description: e.message || "Failed to generate report.",
        });
    } finally {
        setIsGeneratingReport(false);
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
          Daily Reports
        </h1>
      </header>
      <Card className="max-w-xl mx-auto">
          <CardHeader>
              <CardTitle>Generate Daily Report</CardTitle>
              <CardDescription>Select a date to generate a PDF summary of all rain spells for that day.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-center gap-4">
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
              <Button onClick={handleGenerateReport} disabled={isGeneratingReport}>
                  {isGeneratingReport ? (
                      <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                      </>
                  ) : (
                      <>
                          <Download className="mr-2 h-4 w-4" />
                          Generate Rain Report
                      </>
                  )}
              </Button>
          </CardContent>
      </Card>
    </main>
  );
}