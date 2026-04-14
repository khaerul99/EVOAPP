import ExcelJS from 'exceljs';

function formatPercent(value) {
    const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
    return `${safeValue.toFixed(1)}%`;
}

function formatDateTime(value, locale = 'id-ID') {
    return new Date(value).toLocaleString(locale);
}

function buildReportRows({ analytics, rangeLabel, exportedAt }) {
    const totalLogs = Math.max(1, Number(analytics?.totalLogs) || 0);
    const warningAndError = (Number(analytics?.severityCounts?.warning) || 0) + (Number(analytics?.severityCounts?.error) || 0);

    return [
        { category: 'Meta', code: 'GENERATED_AT', description: 'Generated At', unitOfMeasure: 'timestamp', value: exportedAt, status: 'info', note: `Range: ${rangeLabel}` },
        { category: 'Meta', code: 'RANGE', description: 'Selected Range', unitOfMeasure: 'days', value: rangeLabel, status: 'info', note: 'Report scope' },
        { category: 'Summary', code: 'TOTAL_EVENTS', description: 'Total Events', unitOfMeasure: 'events', value: analytics.totalLogs, status: 'healthy', note: 'Semua event pada rentang terpilih' },
        { category: 'Summary', code: 'AUTH_SUCCESS_RATE', description: 'Auth Success Rate', unitOfMeasure: 'percent', value: formatPercent(analytics.authSuccessRate), status: 'healthy', note: 'Login success dibanding total percobaan login' },
        { category: 'Summary', code: 'ONLINE_CAMERAS', description: 'Online Cameras', unitOfMeasure: 'camera', value: analytics.onlineCams, status: 'healthy', note: 'Jumlah kamera status online' },
        { category: 'Summary', code: 'OFFLINE_CAMERAS', description: 'Offline Cameras', unitOfMeasure: 'camera', value: analytics.offlineCams, status: 'warning', note: 'Jumlah kamera status offline' },
        { category: 'Summary', code: 'CAMERA_ONLINE_RATE', description: 'Camera Online Rate', unitOfMeasure: 'percent', value: formatPercent(analytics.onlineRate), status: 'healthy', note: 'Persentase kamera online' },
        { category: 'Summary', code: 'WARNING_ERROR', description: 'Warning + Error', unitOfMeasure: 'events', value: warningAndError, status: 'attention', note: 'Total event dengan severity warning/error' },
        { category: 'Severity', code: 'INFO', description: 'Info Events', unitOfMeasure: 'events', value: analytics.severityCounts.info, status: 'info', note: `${formatPercent((analytics.severityCounts.info / totalLogs) * 100)} of total` },
        { category: 'Severity', code: 'WARNING', description: 'Warning Events', unitOfMeasure: 'events', value: analytics.severityCounts.warning, status: 'warning', note: `${formatPercent((analytics.severityCounts.warning / totalLogs) * 100)} of total` },
        { category: 'Severity', code: 'ERROR', description: 'Error Events', unitOfMeasure: 'events', value: analytics.severityCounts.error, status: 'danger', note: `${formatPercent((analytics.severityCounts.error / totalLogs) * 100)} of total` },
        ...(analytics.series || []).map((item) => ({
            category: 'Trend',
            code: item.key,
            description: `Security Event ${item.label}`,
            unitOfMeasure: 'events',
            value: item.value,
            status: item.value > 0 ? 'active' : 'idle',
            note: `Warnings: ${item.warnings}; Success: ${item.successes}`,
        })),
        ...(analytics.topActions || []).map((item, index) => ({
            category: 'TopAction',
            code: `ACTION_${String(index + 1).padStart(2, '0')}`,
            description: item.action,
            unitOfMeasure: 'count',
            value: item.count,
            status: 'ranked',
            note: 'Most frequent security event actions',
        })),
    ];
}

function applyHeaderStyle(cell) {
    cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1A3B5C' },
    };
    cell.font = {
        color: { argb: 'FFFFFFFF' },
        bold: true,
        size: 11,
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
        top: { style: 'thin', color: { argb: 'FFBFD1E5' } },
        left: { style: 'thin', color: { argb: 'FFBFD1E5' } },
        bottom: { style: 'thin', color: { argb: 'FFBFD1E5' } },
        right: { style: 'thin', color: { argb: 'FFBFD1E5' } },
    };
}

function applyBodyCellStyle(cell, columnNumber) {
    cell.border = {
        top: { style: 'thin', color: { argb: 'FFD8E3D0' } },
        left: { style: 'thin', color: { argb: 'FFD8E3D0' } },
        bottom: { style: 'thin', color: { argb: 'FFD8E3D0' } },
        right: { style: 'thin', color: { argb: 'FFD8E3D0' } },
    };
    cell.alignment = {
        vertical: 'middle',
        horizontal: columnNumber === 4 || columnNumber === 1 ? 'center' : 'left',
        wrapText: true,
    };
    if (columnNumber === 4 && typeof cell.value === 'number') {
        cell.numFmt = '#,##0';
    }
}

function safeSheetName(name) {
    return String(name).replace(/[\\/?*\[\]:]/g, '-').slice(0, 31);
}

function buildCategorySheets(rows) {
    const grouped = new Map();
    rows.forEach((row) => {
        const category = row.category || 'Other';
        if (!grouped.has(category)) {
            grouped.set(category, []);
        }
        grouped.get(category).push(row);
    });
    return grouped;
}

function getCategoryFill(category, index) {
    if (category === 'Meta') {
        return index % 2 === 0 ? 'FFEAF2E2' : 'FFDCEAD2';
    }
    if (category === 'Summary') {
        return 'FFCFE5B0';
    }
    if (category === 'Severity') {
        return 'FFF5F9E8';
    }
    if (category === 'TopAction') {
        return 'FFF7FBF2';
    }
    const palette = ['FFDDEFD5', 'FFD0E8C5', 'FFC1E2BC', 'FFB1DDB4', 'FFA2D7AB', 'FF94D2A2', 'FF84CC99'];
    return palette[index % palette.length];
}

function buildCategoryWorksheet(workbook, { category, rows, exportedAt, rangeLabel }) {
    const worksheet = workbook.addWorksheet(safeSheetName(category), {
        views: [{ state: 'frozen', ySplit: 3 }],
    });

    worksheet.columns = [
        { header: 'Code', key: 'code', width: 20 },
        { header: 'Description', key: 'description', width: 34 },
        { header: 'UnitOfMeasure', key: 'unitOfMeasure', width: 16 },
        { header: 'Value', key: 'value', width: 16 },
        { header: 'Status', key: 'status', width: 14 },
        { header: 'Note', key: 'note', width: 44 },
    ];

    const titleRow = worksheet.addRow([`ANALYTICS REPORT - ${category.toUpperCase()}`]);
    worksheet.mergeCells(`A${titleRow.number}:F${titleRow.number}`);
    const titleCell = worksheet.getCell(`A${titleRow.number}`);
    titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1A3B5C' },
    };
    titleCell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleRow.height = 26;

    const metaRow = worksheet.addRow(['Generated At', exportedAt, 'Range', rangeLabel, 'Category', category]);
    metaRow.eachCell((cell, columnNumber) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFEAF2E2' },
        };
        cell.font = { bold: true, color: { argb: 'FF1A3B5C' } };
        applyBodyCellStyle(cell, columnNumber);
    });

    const headerRow = worksheet.addRow(['Code', 'Description', 'UnitOfMeasure', 'Value', 'Status', 'Note']);
    headerRow.eachCell((cell) => applyHeaderStyle(cell));
    headerRow.height = 22;

    rows.forEach((row, index) => {
        const excelRow = worksheet.addRow({
            code: row.code,
            description: row.description,
            unitOfMeasure: row.unitOfMeasure,
            value: row.value,
            status: row.status,
            note: row.note,
        });

        const fillColor = getCategoryFill(category, index);
        excelRow.eachCell((cell, columnNumber) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: fillColor },
            };
            if (columnNumber === 4) {
                cell.font = { bold: true, color: { argb: 'FF1A3B5C' } };
            }
            applyBodyCellStyle(cell, columnNumber);
        });
    });
}

export async function exportAnalyticsWorkbook({ analytics, rangeLabel, rangeId, locale = 'id-ID' }) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'EvoSecure';
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.title = 'Analytics Report';
    workbook.subject = 'Security and camera analytics';

    const exportedAt = formatDateTime(Date.now(), locale);
    const rows = buildReportRows({ analytics, rangeLabel, exportedAt });
    const groupedRows = buildCategorySheets(rows);

    groupedRows.forEach((categoryRows, category) => {
        buildCategoryWorksheet(workbook, {
            category,
            rows: categoryRows,
            exportedAt,
            rangeLabel,
        });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `analytics-${rangeId}.xlsx`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}
