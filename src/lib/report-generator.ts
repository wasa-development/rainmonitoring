
'use client';

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { DailyReportData } from './types';
import { format } from 'date-fns';
import { Logo } from '@/components/logo';

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
    const pageW = doc.internal.pageSize.getWidth();

    // --- PDF Header ---
    doc.setFillColor(0, 115, 196); // #0073C4
    doc.rect(0, 0, pageW, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    
    // Logo
    const logoImg = new Image();
    logoImg.src = '/logo.png';
    doc.addImage(logoImg, 'PNG', 14, 12, 20, 20);

    // Center Text
    doc.setFontSize(16);
    doc.text(`${cityName} Region Local Rainfall`, pageW / 2, 10, { align: 'center' });
    doc.setFontSize(12);
    const reportDateStr = format(reportData.reportDate, 'dd-MM-yyyy');
    doc.text(`Dated: ${reportDateStr}`, pageW / 2, 18, { align: 'center' });

    // Rain Duration
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Rain Duration`, pageW / 2, 25, { align: 'center' });
    doc.setFont('helvetica', 'normal');

    let yPos = 30;
    reportData.spells.forEach((spell, index) => {
        const spellNumber = index + 1;
        const spellText = `${spellNumber}${getOrdinalSuffix(spellNumber)} Spell ${format(spell.startTime, 'hh:mm a')} to ${format(spell.endTime, 'hh:mm a')}`;
        doc.text(spellText, pageW / 2, yPos, { align: 'center' });
        yPos += 5;
    });

    const lastSpellEndTime = reportData.spells.length > 0 ? reportData.spells[reportData.spells.length - 1].endTime : new Date();
    const reportingTimeText = `Reporting Time: ${format(lastSpellEndTime, 'hh:mm a')}`;
    doc.text(reportingTimeText, pageW / 2, yPos, { align: 'center' });

    // --- Table ---
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
        { content: `Average Rain record (${cityName} Region)`, colSpan: 2 + reportData.spells.length, styles: { halign: 'left', fontStyle: 'bold', fillColor: [221, 235, 247] } },
        { content: reportData.averageRainfall.toFixed(2), styles: { halign: 'center', fontStyle: 'bold', fillColor: [221, 235, 247] } },
        { content: '', styles: {fillColor: [221, 235, 247] } }
    ];

    doc.autoTable({
        head: [tableColumnTitles],
        body: tableRows,
        foot: [averageRow],
        startY: 48,
        theme: 'grid',
        headStyles: { 
            fillColor: [221, 235, 247], // light blue #DDEBF7
            textColor: [0, 0, 0], // black text
            fontStyle: 'bold',
            halign: 'center',
            lineWidth: 0.5,
            lineColor: [0,0,0],
        },
        footStyles: {
            lineWidth: 0.5,
            lineColor: [0,0,0],
        },
        styles: {
            cellPadding: 2,
            fontSize: 8,
            halign: 'center',
            lineWidth: 0.5,
            lineColor: [0,0,0],
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
    const finalY = (doc as any).lastAutoTable.finalY;

    doc.setFillColor(0, 115, 196); // #0073C4
    doc.rect(0, finalY + 2, pageW, 10, 'F');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(`Monsoon Control Room, WASA Head Office ${cityName}`, pageW / 2, finalY + 8, { align: 'center' });

    // Save the PDF
    doc.save(`Rain_Report_${cityName}_${format(new Date(reportData.reportDate), 'yyyy-MM-dd')}.pdf`);
}
