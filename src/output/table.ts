import Table from 'cli-table3';

export function createTable(headers: string[], rows: (string | number)[][]): string {
  const table = new Table({
    head: headers,
    style: { head: ['cyan'] },
  });
  rows.forEach(row => table.push(row.map(String)));
  return table.toString();
}
