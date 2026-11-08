const XLSX = require('xlsx');
const { HttpError } = require('../../lib/http');
const { Member, ImportHistory, AuditLog } = require('../../models');
const { normalizeMemberId } = require('../validation/normalize');

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 400;
const MAX_SHEETS = 1;
const MAX_CELL_CHARS = 1000;

const MEMBER_COLUMNS = [
  { key: 'memberId', label: 'Member ID', required: true },
  { key: 'fullName', label: 'Full Name', required: true },
  { key: 'department', label: 'Department', required: false },
  { key: 'email', label: 'Email', required: false },
  { key: 'phone', label: 'Phone', required: false },
  { key: 'profileImageUrl', label: 'Profile Image URL', required: false },
  { key: 'memberType', label: 'Member Type', required: false },
  { key: 'status', label: 'Status', required: false },
];

const MAX_EXTRA_COLUMNS = 3;
const MAX_COLUMNS = MEMBER_COLUMNS.length + MAX_EXTRA_COLUMNS;
const columnByLabel = new Map(MEMBER_COLUMNS.map((column) => [column.label.toLowerCase(), column]));

function templateBuffer() {
  const sheet = XLSX.utils.aoa_to_sheet([MEMBER_COLUMNS.map((column) => column.label)]);
  sheet['!cols'] = MEMBER_COLUMNS.map(() => ({ wch: 22 }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Members');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function parseUpload(data, fileName) {
  if (!fileName || typeof fileName !== 'string' || !/\.(xlsx|xls)$/i.test(fileName)) {
    throw new HttpError(400, 'Upload an Excel file (.xlsx or .xls).');
  }
  if (typeof data !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) {
    throw new HttpError(400, 'The Excel file data is invalid.');
  }

  if (data.length % 4 === 1) throw new HttpError(400, 'The Excel file data is invalid.');
  let buffer;
  try { buffer = Buffer.from(data, 'base64'); } catch { throw new HttpError(400, 'The Excel file data is invalid.'); }
  if (!buffer.length || buffer.length > MAX_FILE_BYTES) {
    throw new HttpError(400, 'The Excel file must be between 1 byte and 5 MB.');
  }

  let workbook;
  try {
    workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: false,
      cellFormula: false,
      cellHTML: false,
      cellStyles: false,
      cellNF: false,
      bookDeps: false,
      bookFiles: false,
      bookProps: false,
      bookVBA: false,
      WTF: false,
    });
  } catch {
    throw new HttpError(400, 'The Excel file could not be read.');
  }
  if (workbook.SheetNames.length > MAX_SHEETS) throw new HttpError(400, 'The workbook must contain only one worksheet.');
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new HttpError(400, 'The Excel workbook has no worksheets.');
  const sheet = workbook.Sheets[sheetName];
  if (!sheet['!ref']) throw new HttpError(400, 'The first worksheet is empty.');
  const range = XLSX.utils.decode_range(sheet['!ref']);
  if (range.e.c + 1 > MAX_COLUMNS || range.e.r + 1 > MAX_ROWS + 1) {
    throw new HttpError(400, `The worksheet cannot exceed ${MAX_COLUMNS} columns or ${MAX_ROWS} member rows.`);
  }
  const cells = Object.keys(sheet).filter((key) => !key.startsWith('!'));
  if (cells.some((key) => String(sheet[key].v ?? '').length > MAX_CELL_CHARS)) {
    throw new HttpError(400, `Worksheet cell values cannot exceed ${MAX_CELL_CHARS} characters.`);
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  if (!rows.length) throw new HttpError(400, 'The first worksheet is empty.');

  const headers = rows[0].map((value) => String(value).trim());
  const columns = headers.map((header) => columnByLabel.get(header.toLowerCase()));
  const missing = MEMBER_COLUMNS.filter((column) => column.required && !columns.includes(column));
  if (missing.length) throw new HttpError(400, `The first worksheet must include: ${missing.map((column) => column.label).join(', ')}.`);
  const extraColumns = columns.filter((column, index) => !column && headers[index]);
  if (extraColumns.length > MAX_EXTRA_COLUMNS) {
    throw new HttpError(400, `The worksheet cannot contain more than ${MAX_EXTRA_COLUMNS} extra columns.`);
  }
  if (new Set(columns.filter(Boolean).map((column) => column.key)).size !== columns.filter(Boolean).length) {
    throw new HttpError(400, 'The worksheet contains duplicate column headings.');
  }

  const dataRows = rows.slice(1).filter((row) => row.some((value) => String(value).trim() !== ''));
  if (!dataRows.length) throw new HttpError(400, 'The first worksheet contains no member rows.');
  if (dataRows.length > MAX_ROWS) throw new HttpError(400, `The upload cannot contain more than ${MAX_ROWS} member rows.`);

  return { sheetName, headers, columns, rows: dataRows };
}

function rowValue(row, columns, key) {
  const index = columns.findIndex((column) => column?.key === key);
  return index < 0 ? '' : String(row[index] ?? '').trim();
}

function toMember(row, columns, rowNumber) {
  const member = {
    memberId: rowValue(row, columns, 'memberId'),
    fullName: rowValue(row, columns, 'fullName'),
    department: rowValue(row, columns, 'department'),
    email: rowValue(row, columns, 'email'),
    phone: rowValue(row, columns, 'phone'),
    profileImageUrl: rowValue(row, columns, 'profileImageUrl'),
    memberType: rowValue(row, columns, 'memberType') || 'executive',
    status: rowValue(row, columns, 'status') || 'active',
  };
  const errors = [];
  if (!member.memberId) errors.push({ row: rowNumber, field: 'Member ID', value: '', message: 'Member ID is required.' });
  if (!member.fullName) errors.push({ row: rowNumber, field: 'Full Name', value: '', message: 'Full Name is required.' });
  if (member.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email)) {
    errors.push({ row: rowNumber, field: 'Email', value: member.email, message: 'Email is not valid.' });
  }
  if (member.profileImageUrl && !/^https?:\/\/\S+$/i.test(member.profileImageUrl)) {
    errors.push({ row: rowNumber, field: 'Profile Image URL', value: member.profileImageUrl, message: 'Profile Image URL must be an http(s) URL.' });
  }
  const memberType = member.memberType.toLowerCase().replace(/\s+/g, '-');
  if (!['executive', 'non-executive'].includes(memberType)) {
    errors.push({ row: rowNumber, field: 'Member Type', value: member.memberType, message: 'Member Type must be executive or non-executive.' });
  } else member.memberType = memberType;
  if (!['active', 'inactive'].includes(member.status.toLowerCase())) {
    errors.push({ row: rowNumber, field: 'Status', value: member.status, message: 'Status must be active or inactive.' });
  } else member.status = member.status.toLowerCase();
  return { member, errors };
}

async function importMembers({ data, fileName, actor }) {
  const parsed = parseUpload(data, fileName);
  const rowErrors = [];
  const members = [];
  const seen = new Set();
  parsed.rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const result = toMember(row, parsed.columns, rowNumber);
    if (result.member.memberId) {
      const normalized = normalizeMemberId(result.member.memberId);
      if (seen.has(normalized)) result.errors.push({ row: rowNumber, field: 'Member ID', value: result.member.memberId, message: 'Member ID is duplicated in this file.' });
      seen.add(normalized);
    }
    rowErrors.push(...result.errors);
    members.push(result.member);
  });
  if (rowErrors.length) {
    const error = new HttpError(400, `The upload contains ${rowErrors.length} validation error${rowErrors.length === 1 ? '' : 's'}.`);
    error.details = rowErrors;
    throw error;
  }

  const operations = members.map((member) => {
    const normalized = Member.withNormalized(member);
    return {
      updateOne: {
        filter: { memberIdNormalized: normalized.memberIdNormalized },
        update: {
          $set: { ...normalized, deactivatedAt: normalized.status === 'inactive' ? new Date() : null },
          $setOnInsert: { createdAt: new Date() },
        },
        upsert: true,
        runValidators: true,
      },
    };
  });

  let result;
  try {
    result = await Member.bulkWrite(operations, { ordered: true });
  } catch (err) {
    await ImportHistory.create({
      fileName, fileSize: Buffer.from(data, 'base64').length, sheetName: parsed.sheetName,
      columnMapping: Object.fromEntries(parsed.columns.map((column, index) => column && [column.key, parsed.headers[index]]).filter(Boolean)),
      performedBy: actor._id, status: 'failed',
      counts: { totalRows: members.length, failed: members.length },
    });
    throw err;
  }

  const counts = {
    totalRows: members.length,
    created: result.upsertedCount || 0,
    updated: members.length - (result.upsertedCount || 0),
    skipped: 0,
    sentForReview: 0,
    failed: 0,
  };
  const history = await ImportHistory.create({
    fileName, fileSize: Buffer.from(data, 'base64').length, sheetName: parsed.sheetName,
    columnMapping: Object.fromEntries(parsed.columns.map((column, index) => column && [column.key, parsed.headers[index]]).filter(Boolean)),
    performedBy: actor._id, status: 'completed', counts, completedAt: new Date(),
  });
  await AuditLog.create({
    actor: actor._id, actorRole: 'admin', action: 'import.complete', targetType: 'ImportHistory', targetId: history._id,
    summary: `Imported ${counts.totalRows} member rows from ${fileName}`, metadata: counts,
  });
  return { counts, importId: history._id };
}

module.exports = {
  MEMBER_COLUMNS, MAX_FILE_BYTES, MAX_ROWS, MAX_SHEETS, MAX_EXTRA_COLUMNS, MAX_COLUMNS,
  templateBuffer, parseUpload, importMembers,
};
