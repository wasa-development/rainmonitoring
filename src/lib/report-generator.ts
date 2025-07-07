'use client';

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { DailyReportData } from './types';
import { format } from 'date-fns';

// Extend jsPDF with autoTable type definitions
declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: any) => jsPDF;
    }
}

export function generateDailyReportPdf(reportData: DailyReportData, cityName: string) {
    const doc = new jsPDF({ orientation: 'landscape' });

    const reportDateStr = format(reportData.reportDate, 'MMMM do, yyyy');
    const earliestStartTimeStr = format(reportData.earliestStartTime, 'hh:mm a');
    const generationTimeStr = format(new Date(), 'hh:mm a');

    doc.setFontSize(18);
    doc.text(`Daily Rain Report for ${cityName}`, 14, 22);
    doc.setFontSize(11);
    doc.text(`Date: ${reportDateStr}`, 14, 30);
    doc.text(`Rain Started: ${earliestStartTimeStr}`, 140, 30);
    doc.text(`Report Generated: ${generationTimeStr}`, 230, 30);

    const tableColumnTitles: string[] = [
        "Ponding Point",
        ...reportData.spells.map((spell, index) => 
            `Spell ${index + 1} (${format(spell.startTime, 'HH:mm')}-${format(spell.endTime, 'HH:mm')})`
        ),
        "Total Rain (mm)",
        "Final Status"
    ];

    const tableRows = reportData.points.map(point => [
        point.pointName,
        ...point.spellRainfall.map(rainfall => rainfall.toFixed(0)),
        point.totalRainfall.toFixed(0),
        point.finalStatus,
    ]);

    doc.autoTable({
        head: [tableColumnTitles],
        body: tableRows,
        startY: 35,
        theme: 'grid',
        headStyles: { 
            fillColor: [22, 160, 133], // A pleasant teal color
            textColor: [255, 255, 255],
            fontStyle: 'bold',
        },
        styles: {
            cellPadding: 2,
            fontSize: 8,
        },
        alternateRowStyles: {
            fillColor: [245, 245, 245],
        },
    });

    // Save the PDF
    doc.save(`Rain_Report_${cityName}_${format(reportData.reportDate, 'yyyy-MM-dd')}.pdf`);
}
