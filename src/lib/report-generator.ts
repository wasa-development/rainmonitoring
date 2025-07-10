
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

function getOrdinalSuffix(i: number) {
    const j = i % 10,
        k = i % 100;
    if (j === 1 && k !== 11) return "st";
    if (j === 2 && k !== 12) return "nd";
    if (j === 3 && k !== 13) return "rd";
    return "th";
}

export function generateDailyReportPdf(reportData: DailyReportData, cityName: string) {
    const doc = new jsPDF({ orientation: 'landscape' });

    // --- PDF Header ---
    doc.setFillColor(0, 115, 196); // #0073C4
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 35, 'F');
    doc.setTextColor(255, 255, 255);
    
    // Center
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`${cityName} Region Local Rainfall`, doc.internal.pageSize.getWidth() / 2, 10, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    const reportDateStr = format(reportData.reportDate, 'dd-MM-yyyy');
    doc.text(`Dated: ${reportDateStr}`, doc.internal.pageSize.getWidth() / 2, 16, { align: 'center' });

    // Rain Duration
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Rain Duration`, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });
    doc.setFont('helvetica', 'normal');

    let yPos = 27;
    reportData.spells.forEach((spell, index) => {
        const spellNumber = index + 1;
        const spellText = `${spellNumber}${getOrdinalSuffix(spellNumber)} Spell ${format(spell.startTime, 'hh:mm a')} to ${format(spell.endTime, 'hh:mm a')}`;
        doc.text(spellText, doc.internal.pageSize.getWidth() / 2, yPos, { align: 'center' });
        yPos += 5;
    });

    const lastSpellEndTime = reportData.spells.length > 0 ? reportData.spells[reportData.spells.length - 1].endTime : new Date();
    const reportingTimeText = `Reporting Time: ${format(lastSpellEndTime, 'hh:mm a')}`;
    doc.text(reportingTimeText, doc.internal.pageSize.getWidth() / 2, yPos, { align: 'center' });


    const tableColumnTitles: string[] = [
        "Sr. #",
        `Main Points in ${cityName}`,
        ...reportData.spells.map((_, index) => {
            const spellNumber = index + 1;
            return `${spellNumber}${getOrdinalSuffix(spellNumber)} Spell`;
        }),
        "Total Rain",
        "RAIN STATUS"
    ];
    
    const sortedPoints = reportData.points.sort((a,b) => (a.order ?? 9999) - (b.order ?? 9999) || a.pointName.localeCompare(b.pointName));
    const maxTotalRainfall = reportData.maxTotalRainfall;

    const tableRows = sortedPoints.map((point, index) => [
        index + 1,
        point.pointName,
        ...point.spellRainfall.map(rainfall => rainfall === 0.1 ? 'Trace' : rainfall.toFixed(1)),
        { content: point.totalRainfall.toFixed(1), styles: { fontStyle: 'bold', textColor: point.totalRainfall === maxTotalRainfall && maxTotalRainfall > 0 ? [255, 0, 0] : [0, 0, 0] } },
        point.finalStatus,
    ]);

    const averageRow = [
        { content: `Average Rain record (${cityName} Region)`, colSpan: 2 + reportData.spells.length, styles: { halign: 'left', fontStyle: 'bold' } },
        { content: reportData.averageRainfall.toFixed(2), styles: { halign: 'center', fontStyle: 'bold' } },
        { content: '', styles: {} }
    ];
    tableRows.push(averageRow);

    doc.autoTable({
        head: [tableColumnTitles],
        body: tableRows,
        startY: yPos + 5,
        theme: 'grid',
        headStyles: { 
            fillColor: [221, 235, 247], // light blue #DDEBF7
            textColor: [0, 0, 0], // black text
            fontStyle: 'bold',
            halign: 'center',
        },
        footStyles: {
             fillColor: [221, 235, 247],
             textColor: [0, 0, 0],
             fontStyle: 'bold',
        },
        styles: {
            cellPadding: 2,
            fontSize: 8,
            halign: 'center', // Center-align all cells by default
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 15 }, // Sr No
            1: { halign: 'left' }, // Ponding Point Name left aligned
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
