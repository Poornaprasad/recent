
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select"
import { Input } from "@/components/ui/input";
import { getAuditLogs, type AuditLog } from '@/lib/db/schema';
import { cn } from '@/lib/utils/utils';
import { useState, useMemo } from "react";
import { Eye, Download, Search, ChevronLeft, ChevronRight } from "lucide-react";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>(getAuditLogs());
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);


  const getSeverityBadgeClass = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return "bg-red-600 text-white border-red-700 dark:bg-red-800 dark:text-red-100";
      case "error":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800";
      case "warning":
        return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800";
      case "info":
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/50 dark:text-gray-300 dark:border-gray-800";
    }
  };

  const filteredLogs = useMemo(() => {
    return logs
        .filter(log => {
            const searchTermLower = searchTerm.toLowerCase();
            return (
                log.user.toLowerCase().includes(searchTermLower) ||
                log.action.toLowerCase().includes(searchTermLower) ||
                log.resource.toLowerCase().includes(searchTermLower) ||
                log.details.toLowerCase().includes(searchTermLower) ||
                log.ipAddress.toLowerCase().includes(searchTermLower)
            );
        })
        .filter(log => {
            if (severityFilter === 'all') return true;
            return log.severity.toLowerCase() === severityFilter;
        });
  }, [logs, searchTerm, severityFilter]);

  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredLogs.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredLogs, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(filteredLogs.length / rowsPerPage);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
        setCurrentPage(currentPage + 1);
    }
  }

  const handlePrevPage = () => {
    if (currentPage > 1) {
        setCurrentPage(currentPage - 1);
    }
  }


  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
            <h2 className="text-3xl font-bold tracking-tight">Audit Logs</h2>
            <p className="text-muted-foreground">Security and compliance audit trail</p>
        </div>
      </div>
      <Card>
        <CardHeader>
            <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <Badge variant="secondary">{filteredLogs.length}</Badge>
                    <span>Audit Trail</span>
                </CardTitle>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search logs..." 
                            className="pl-8 w-64" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Select value={severityFilter} onValueChange={setSeverityFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by severity" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Severities</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                            <SelectItem value="error">Error</SelectItem>
                            <SelectItem value="warning">Warning</SelectItem>
                            <SelectItem value="info">Info</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </CardHeader>
        <CardContent>
          {paginatedLogs.length > 0 ? (
             <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">{log.timestamp}</TableCell>
                        <TableCell>{log.user}</TableCell>
                        <TableCell>{log.action}</TableCell>
                        <TableCell>{log.resource}</TableCell>
                        <TableCell>{log.details}</TableCell>
                        <TableCell>{log.ipAddress}</TableCell>
                        <TableCell>
                            <Badge variant="outline" className={cn(getSeverityBadgeClass(log.severity))}>
                                {log.severity}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                            <Button variant="ghost" size="icon">
                                <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                                <Download className="h-4 w-4" />
                            </Button>
                        </TableCell>
                      </TableRow>
                  ))}
                </TableBody>
              </Table>
          ) : (
            <div className="text-center py-12">
                <h3 className="text-lg font-semibold">No Logs Found</h3>
                <p className="text-muted-foreground mt-2">There are no audit logs matching your search criteria.</p>
            </div>
          )}
        </CardContent>
        <div className="flex items-center justify-end space-x-2 py-4 px-6 border-t">
            <div className="flex items-center space-x-2">
                <p className="text-sm font-medium">Rows per page</p>
                <Select
                    value={`${rowsPerPage}`}
                    onValueChange={(value) => {
                        setRowsPerPage(Number(value))
                        setCurrentPage(1)
                    }}
                >
                    <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue placeholder={rowsPerPage} />
                    </SelectTrigger>
                    <SelectContent side="top">
                        {[10, 20, 30, 40, 50].map((pageSize) => (
                            <SelectItem key={pageSize} value={`${pageSize}`}>
                            {pageSize}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center space-x-2">
                <Button
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                >
                    <span className="sr-only">Go to previous page</span>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                >
                    <span className="sr-only">Go to next page</span>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
      </Card>
    </div>
  );
}
