const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const { HttpError } = require('../../lib/http');
const {
  MEMBER_COLUMNS, MAX_ROWS, templateBuffer, parseUpload, importMembers,
} = require('../../lib/imports/memberImport');

test('member template contains the supported Excel headings', () => {
  const workbook = XLSX.read(templateBuffer(), { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const headings = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0];
  assert.deepEqual(headings, MEMBER_COLUMNS.map((column) => column.label));
});

test('member import rejects a workbook with missing required headings', async () => {
  const sheet = XLSX.utils.aoa_to_sheet([['Email'], ['member@example.com']]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Members');
  const data = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });

  await assert.rejects(
    () => importMembers({ data, fileName: 'members.xlsx', actor: { _id: 'admin-id' } }),
    (error) => error instanceof HttpError && error.status === 400 && /Member ID, Full Name/.test(error.message),
  );
});

test('member import rejects workbooks with extra sheets before row parsing', async () => {
  const sheet = XLSX.utils.aoa_to_sheet([['Member ID', 'Full Name'], ['A-1', 'A Member']]);
  const second = XLSX.utils.aoa_to_sheet([['unexpected']]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Members');
  XLSX.utils.book_append_sheet(workbook, second, 'Unexpected');
  const data = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });

  await assert.rejects(
    () => importMembers({ data, fileName: 'members.xlsx', actor: { _id: 'admin-id' } }),
    (error) => error instanceof HttpError && error.status === 400 && /only one worksheet/.test(error.message),
  );
});

function workbookData(rows) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Members');
  return XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
}

test('member import allows up to three extra columns', () => {
  const data = workbookData([
    ['Member ID', 'Full Name', 'Extra 1', 'Extra 2', 'Extra 3'],
    ['A-1', 'A Member', 'one', 'two', 'three'],
  ]);

  const parsed = parseUpload(data, 'members.xlsx');
  assert.equal(parsed.columns.filter((column) => !column).length, 3);
});

test('member import rejects more than three extra columns', async () => {
  const data = workbookData([
    ['Member ID', 'Full Name', 'Extra 1', 'Extra 2', 'Extra 3', 'Extra 4'],
    ['A-1', 'A Member', 'one', 'two', 'three', 'four'],
  ]);

  await assert.rejects(
    () => importMembers({ data, fileName: 'members.xlsx', actor: { _id: 'admin-id' } }),
    (error) => error instanceof HttpError && error.status === 400 && /more than 3 extra columns/.test(error.message),
  );
});

test('member import rejects more than 400 member rows', async () => {
  const rows = [['Member ID', 'Full Name']];
  for (let index = 1; index <= MAX_ROWS + 1; index += 1) rows.push([`A-${index}`, `Member ${index}`]);

  await assert.rejects(
    () => importMembers({ data: workbookData(rows), fileName: 'members.xlsx', actor: { _id: 'admin-id' } }),
    (error) => error instanceof HttpError && error.status === 400 && /400 member rows/.test(error.message),
  );
});
