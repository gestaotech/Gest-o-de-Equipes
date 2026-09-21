import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function ReportTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  empty: string;
}) {
  if (!rows.length) {
    return (
      <div className="px-5 py-10 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {headers.map((h) => (
            <TableHead key={h}>{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((cells, i) => (
          <TableRow key={i}>
            {cells.map((c, j) => (
              <TableCell key={j}>{c}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}