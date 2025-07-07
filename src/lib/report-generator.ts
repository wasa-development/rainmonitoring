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

    // --- PDF Header ---
    doc.setFillColor(0, 115, 196); // #0073C4
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`Daily Rain Report - ${cityName}`, doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const reportDateStr = format(reportData.reportDate, 'MMMM do, yyyy');
    const earliestStartTimeStr = format(reportData.earliestStartTime, 'hh:mm a');
    const generationTimeStr = format(new Date(), 'hh:mm a');
    
    doc.text(`Date: ${reportDateStr}`, 14, 25);
    doc.text(`Rain Started: ${earliestStartTimeStr}`, doc.internal.pageSize.getWidth() / 2, 25, { align: 'center' });
    doc.text(`Generated: ${generationTimeStr}`, doc.internal.pageSize.getWidth() - 14, 25, { align: 'right' });


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
            fillColor: [221, 235, 247], // light blue #DDEBF7
            textColor: [0, 0, 0], // black text
            fontStyle: 'bold',
        },
        styles: {
            cellPadding: 2,
            fontSize: 8,
        },
        alternateRowStyles: {
            fillColor: [242, 242, 242], // light grey #F2F2F2
        },
    });

    // --- PDF Footer ---
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFillColor(0, 115, 196); // #0073C4
    doc.rect(0, pageHeight - 12, doc.internal.pageSize.getWidth(), 12, 'F');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(`Monsoon Control Room, WASA Head Office ${cityName}`, doc.internal.pageSize.getWidth() / 2, pageHeight - 5, { align: 'center' });


    // Save the PDF
    doc.save(`Rain_Report_${cityName}_${format(reportData.reportDate, 'yyyy-MM-dd')}.pdf`);
}
