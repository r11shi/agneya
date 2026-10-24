'use client';
import { useState } from 'react';
import { Download, FileSpreadsheet, Info, Printer } from './icons';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Papa from 'papaparse';
import type { ReportData } from '@/contracts/workspace';
import { useResource } from './api';
import { Badge, Button, Empty, ErrorNotice } from './ui';
import { FiltersBar, type Filters } from './case-table';
import { filterParams } from './workspace';
export function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  const safe = rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        typeof value === 'string' && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value,
      ]),
    ),
  );
  const url = URL.createObjectURL(
    new Blob([Papa.unparse(safe, { quotes: true })], { type: 'text/csv;charset=utf-8' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const dimensionTitles: [string, string][] = [
  ['bureau', 'Bureau / Cell-wise'],
  ['region', 'Region-wise'],
  ['status', 'Status-wise'],
  ['institution', 'Institution-wise'],
  ['month', 'Monthly'],
  ['quarter', 'Quarterly'],
];
function describeFilters(f: Filters) {
  const parts = Object.entries(f)
    .filter(([k, v]) => v && k !== 'page')
    .map(([k, v]) => `${k.replace('_id', '')}: ${String(v).replaceAll('_', ' ')}`);
  return parts.length ? parts.join(' · ') : 'All permitted cases';
}
// A real, paginated A4 document generated in the browser from the report the
// user is already authorised to see. Loaded on demand to keep the page light.
export async function downloadPdf(r: ReportData, filters: Filters) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const ink: [number, number, number] = [24, 24, 27];
  const muted: [number, number, number] = [113, 113, 122];
  const generated = new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date());
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...ink);
  doc.text('Complaint monitoring report', 40, 56);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...muted);
  doc.text(`Casebridge · AICTE bureaus/cells · generated ${generated} IST`, 40, 74);
  doc.text(`Filters: ${describeFilters(filters)}`, 40, 88, { maxWidth: 515 });
  autoTable(doc, {
    startY: 104,
    theme: 'grid',
    head: [
      ['Received', 'Currently disposed', 'Disposal rate', 'Cross-bureau cases', 'Identity review'],
    ],
    body: [
      [
        r.total,
        r.disposed,
        r.disposal_rate === null ? 'N/A' : `${r.disposal_rate}%`,
        r.overlap_cases,
        r.identity_review,
      ],
    ],
    styles: { fontSize: 10, halign: 'center', textColor: ink, lineColor: [228, 228, 231] },
    headStyles: { fillColor: [244, 244, 245], textColor: muted, fontStyle: 'normal' },
  });
  const tables: [string, (string | number)[][]][] = [
    ['Pending case ageing (active cases)', r.ageing.map((a) => [a.label, a.count])],
    ...dimensionTitles.map(
      ([key, title]) =>
        [
          title,
          r.dimensions
            .filter((d) => d.dimension === key)
            .map((d) => [
              d.label.replaceAll('_', ' '),
              d.received,
              d.active,
              d.disposed,
              d.overdue,
            ]),
        ] as [string, (string | number)[][]],
    ),
  ];
  for (const [title, body] of tables) {
    if (!body.length) continue;
    const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 26;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(...ink);
    doc.text(title, 40, y);
    autoTable(doc, {
      startY: y + 8,
      head: [
        title.startsWith('Pending')
          ? ['Elapsed since receipt', 'Active cases']
          : ['', 'Received', 'Active', 'Currently disposed', 'Beyond timeline'],
      ],
      body,
      theme: 'striped',
      styles: { fontSize: 9, textColor: ink, cellPadding: 5 },
      headStyles: { fillColor: [62, 99, 221], textColor: 255 },
      alternateRowStyles: { fillColor: [250, 250, 251] },
      columnStyles: { 0: { cellWidth: 200 } },
    });
  }
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(`${r.definition} Synthetic demonstration data.`, 40, 806, { maxWidth: 440 });
    doc.text(`Page ${i} of ${pages}`, 555, 806, { align: 'right' });
  }
  doc.save(`casebridge-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}
export function ReportsView({
  filters,
  onFilters,
}: {
  filters: Filters;
  onFilters: (f: Partial<Filters>) => void;
}) {
  const [advanced, setAdvanced] = useState(false),
    [pdfBusy, setPdfBusy] = useState(false),
    [dimension, setDimension] = useState('bureau');
  const report = useResource<ReportData>(`/api/reports?${filterParams(filters)}`, undefined, 15000),
    r = report.data;
  return (
    <>
      <div className="print-only print-header">
        Casebridge · Complaint monitoring report · {describeFilters(filters)} · printed{' '}
        {new Intl.DateTimeFormat('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Asia/Kolkata',
        }).format(new Date())}{' '}
        IST · Synthetic demonstration data
      </div>
      <div className="page-heading compact">
        <div>
          <h1>Reports & analytics</h1>
          <p>Workload, ageing and outcomes by bureau, region, institution and period.</p>
        </div>
        <div className="heading-actions no-print">
          <Button
            disabled={!r}
            onClick={() => r && downloadCsv('casebridge-report.csv', r.dimensions)}
          >
            <FileSpreadsheet size={15} />
            CSV
          </Button>
          <Button disabled={!r} onClick={() => window.print()}>
            <Printer size={15} />
            Print
          </Button>
          <Button
            variant="primary"
            disabled={!r || pdfBusy}
            busy={pdfBusy}
            onClick={async () => {
              if (!r) return;
              setPdfBusy(true);
              try {
                await downloadPdf(r, filters);
              } finally {
                setPdfBusy(false);
              }
            }}
          >
            <Download size={15} />
            Download PDF
          </Button>
        </div>
      </div>
      <section className="panel reports-filters no-print">
        <FiltersBar
          filters={filters}
          onChange={onFilters}
          advanced={advanced}
          setAdvanced={setAdvanced}
        />
      </section>
      {report.error ? <ErrorNotice retry={report.refresh}>{report.error}</ErrorNotice> : null}
      {r ? (
        <>
          <div className="report-stats">
            <div>
              <span>Received in cohort</span>
              <strong>{r.total}</strong>
            </div>
            <div>
              <span>Currently disposed</span>
              <strong>{r.disposed}</strong>
            </div>
            <div>
              <span>Cohort disposal rate</span>
              <strong>{r.disposal_rate === null ? 'N/A' : `${r.disposal_rate}%`}</strong>
            </div>
            <div>
              <span>Cross-bureau cases</span>
              <strong>{r.overlap_cases}</strong>
            </div>
          </div>
          <div className="reports-chart-grid">
            <section className="panel">
              <div className="panel-heading">
                <h2>Active case ageing</h2>
                <Badge>Elapsed days</Badge>
              </div>
              {r.ageing.length ? (
                <div className="chart">
                  <ResponsiveContainer
                    width="100%"
                    height={210}
                    initialDimension={{ width: 450, height: 210 }}
                  >
                    <BarChart data={r.ageing} margin={{ top: 10, right: 24, bottom: 0, left: -20 }}>
                      <CartesianGrid vertical={false} stroke="#edf0f4" />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: '#687484' }}
                      />
                      <YAxis
                        allowDecimals={false}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: '#687484' }}
                      />
                      <Tooltip cursor={{ fill: '#f3f5f9' }} />
                      <Bar
                        dataKey="count"
                        name="Active cases"
                        fill="#7893de"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={42}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <Empty title="No active cases in this cohort" />
              )}
            </section>
            <section className="panel">
              <div className="panel-heading">
                <h2>Cases by receipt month</h2>
                <span className="muted">India calendar</span>
              </div>
              <div className="chart">
                <ResponsiveContainer
                  width="100%"
                  height={210}
                  initialDimension={{ width: 450, height: 210 }}
                >
                  <BarChart
                    data={r.dimensions.filter((d) => d.dimension === 'month')}
                    margin={{ top: 10, right: 24, bottom: 0, left: -20 }}
                  >
                    <CartesianGrid vertical={false} stroke="#edf0f4" />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#687484' }}
                    />
                    <YAxis
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#687484' }}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="received"
                      name="Received"
                      fill="#b9c7ed"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={38}
                    />
                    <Bar
                      dataKey="disposed"
                      name="Currently disposed"
                      fill="#4f74cf"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={38}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
          <section className="panel no-print">
            <div className="panel-heading">
              <h2>Breakdown</h2>
              <select
                aria-label="Report dimension"
                value={dimension}
                onChange={(e) => setDimension(e.target.value)}
              >
                {['bureau', 'region', 'institution', 'status', 'month', 'quarter'].map((d) => (
                  <option value={d} key={d}>
                    {d[0].toUpperCase() + d.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="table-scroll">
              <table className="directory-table">
                <thead>
                  <tr>
                    <th>{dimension}</th>
                    <th>Received</th>
                    <th>Active</th>
                    <th>Currently disposed</th>
                    <th>Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {r.dimensions
                    .filter((d) => d.dimension === dimension)
                    .map((d) => (
                      <tr key={d.label}>
                        <td>{d.label.replaceAll('_', ' ')}</td>
                        <td>{d.received}</td>
                        <td>{d.active}</td>
                        <td>{d.disposed}</td>
                        <td className={d.overdue ? 'text-danger' : ''}>{d.overdue}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
          <div className="print-only print-tables">
            {dimensionTitles.map(([key, title]) => (
              <section key={key}>
                <h2>{title}</h2>
                <table className="directory-table">
                  <thead>
                    <tr>
                      <th />
                      <th>Received</th>
                      <th>Active</th>
                      <th>Currently disposed</th>
                      <th>Beyond timeline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.dimensions
                      .filter((d) => d.dimension === key)
                      .map((d) => (
                        <tr key={d.label}>
                          <td>{d.label.replaceAll('_', ' ')}</td>
                          <td>{d.received}</td>
                          <td>{d.active}</td>
                          <td>{d.disposed}</td>
                          <td>{d.overdue}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
          <div className="metric-definition">
            <Info size={17} />
            <p>
              {r.definition}
              <br />
              Actions in the selected period: {r.period_events.transfers} transfers ·{' '}
              {r.period_events.escalations} escalations · {r.period_events.disposals} disposals.
            </p>
          </div>
        </>
      ) : null}
    </>
  );
}
