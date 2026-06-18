"use client";

import { useCallback, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { showToast } from "@/hooks/use-toast";
import {
  useCompanyDetail,
  useUpdateCompanyDetail,
  useDeleteCompany,
} from "@/hooks/queries/use-companies";
import { useEmployees } from "@/hooks/queries/use-employees";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { DataTable } from "@/components/shared/data-table";
import { FilterBar } from "@/components/shared/filter-bar";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  ArrowLeft,
  CheckCircle,
  Pause,
  Ban,
  XCircle,
  Send,
  Mail,
  Download,
  CheckCircle2,
  X,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import type { ColumnDef } from "@/types";
import { CSVUploadDropzone } from "@/features/csv-uploads/components/csv-upload-dropzone";

interface CityReadiness {
  city: string | null;
  activeMerchants: number;
  uniqueCategories: number;
  required: { minActiveMerchants: number; minUniqueCategories: number };
  ready: boolean;
  message: string;
}

interface ImportPreview {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  bodyHash: string;
  validRows: Array<{
    rowNumber: number;
    firstName: string;
    lastName: string;
    email: string;
    department: string | null;
  }>;
  invalidRows: Array<{
    rowNumber: number;
    reason: string;
    raw: Record<string, string>;
  }>;
}

async function fetchReadiness(id: string): Promise<CityReadiness> {
  const res = await fetch(`/api/admin/companies/${id}/city-readiness`);
  const json = await res.json();
  if (!res.ok)
    throw new Error(json.error?.message ?? "Failed to load readiness");
  return json.data;
}

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const queryClient = useQueryClient();

  const { data, isLoading } = useCompanyDetail(id);
  const updateDetail = useUpdateCompanyDetail();
  const deleteCompany = useDeleteCompany();

  const { data: readiness } = useQuery({
    queryKey: ["company-readiness", id],
    queryFn: () => fetchReadiness(id),
    enabled: !!id,
  });

  const company = data?.data;

  const [adminNote, setAdminNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  // CSV preview state
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  const [preview, setPreview] = useState<{
    csv: string;
    data: ImportPreview;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmImportOpen, setConfirmImportOpen] = useState(false);

  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState("ALL");
  const {
    page: empPage,
    setPage: setEmpPage,
    pageSize: empPageSize,
  } = useTablePagination({ defaultPageSize: 10 });

  const { data: empData } = useEmployees({
    companyId: id,
    status: employeeStatusFilter !== "ALL" ? employeeStatusFilter : undefined,
    q: employeeSearch || undefined,
    page: empPage,
    pageSize: empPageSize,
  });

  const employees = empData?.data ?? [];
  const empMeta = empData?.meta;

  const employeeColumns: ColumnDef<any>[] = [
    {
      key: "name",
      header: "Employee",
      render: (e: any) => (
        <span className="font-medium">
          {e.firstName} {e.lastName}
        </span>
      ),
    },
    { key: "email", header: "Email" },
    { key: "department", header: "Department" },
    {
      key: "status",
      header: "Status",
      render: (e: any) => <StatusBadge status={e.status} />,
    },
  ];

  const handleStatusChange = useCallback((status: string) => {
    setConfirmAction(status);
    setConfirmOpen(true);
  }, []);

  const confirmStatusChange = useCallback(() => {
    if (!confirmAction) return;
    updateDetail.mutate(
      { id, status: confirmAction },
      {
        onSuccess: (res: any) => {
          showToast({
            type: "success",
            title: res.message ?? `Company ${confirmAction.toLowerCase()}`,
          });
          setConfirmOpen(false);
          setConfirmAction("");
          queryClient.invalidateQueries({
            queryKey: ["company-readiness", id],
          });
        },
        onError: (err: Error) => {
          showToast({
            type: "error",
            title: "Update failed",
            description: err.message,
          });
          setConfirmOpen(false);
          setConfirmAction("");
        },
      },
    );
  }, [id, confirmAction, updateDetail, queryClient]);

  const handleSaveNote = useCallback(() => {
    if (!adminNote.trim() && !company?.adminNote) return;
    updateDetail.mutate(
      { id, adminNote },
      {
        onSuccess: () => {
          showToast({ type: "success", title: "Admin note saved" });
          setNoteSaved(true);
          setTimeout(() => setNoteSaved(false), 3000);
        },
        onError: (err: Error) =>
          showToast({
            type: "error",
            title: "Failed to save note",
            description: err.message,
          }),
      },
    );
  }, [id, adminNote, updateDetail, company]);

  const handleBillingStatusChange = useCallback(
    (billingStatus: string) => {
      updateDetail.mutate(
        { id, billingStatus },
        {
          onSuccess: () => {
            showToast({
              type: "success",
              title: `Billing status updated to ${billingStatus}`,
            });
            queryClient.invalidateQueries({
              queryKey: ["company-readiness", id],
            });
          },
          onError: (err: Error) =>
            showToast({
              type: "error",
              title: "Billing update failed",
              description: err.message,
            }),
        },
      );
    },
    [id, updateDetail, queryClient],
  );

  // CSV preview/confirm flow --------------------------------------
  const handleCSVSelected = useCallback(
    async (file: File) => {
      setPreviewLoading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(`/api/admin/companies/${id}/csv-preview`, {
          method: "POST",
          body: formData,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message ?? "Preview failed");

        // We need the body hash to confirm; read the file text again
        // (cheap) so the confirm step can re-validate the body.
        const csv = await file.text();
        setPreview({ csv, data: json.data });
      } catch (err: any) {
        showToast({
          type: "error",
          title: "Preview failed",
          description: err.message,
        });
      } finally {
        setPreviewLoading(false);
      }
    },
    [id],
  );

  const confirmImport = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error("No preview to confirm");
      const res = await fetch(`/api/admin/companies/${id}/csv-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csv: preview.csv,
          bodyHash: preview.data.bodyHash,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Import failed");
      return json;
    },
    onSuccess: (json) => {
      showToast({
        type: "success",
        title: "Import complete",
        description: json.message ?? `${json.data?.imported} imported`,
      });
      setPreview(null);
      setShowCSVUpload(false);
      setConfirmImportOpen(false);
      queryClient.invalidateQueries({ queryKey: ["employees", id] });
    },
    onError: (err: Error) =>
      showToast({
        type: "error",
        title: "Import failed",
        description: err.message,
      }),
  });

  const sendLaunchPack = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/companies/${id}/launch-pack`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error?.message ?? "Failed to send launch pack");
      return json;
    },
    onSuccess: (json) => {
      showToast({
        type: "success",
        title: "Launch pack sent",
        description: `${json.data?.adminCount ?? 0} admins, ${json.data?.employeeCount ?? 0} employees notified`,
      });
    },
    onError: (err: Error) =>
      showToast({ type: "error", title: "Failed", description: err.message }),
  });

  const sendBillingReminder = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/companies/${id}/billing-reminder`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error?.message ?? "Failed to send reminder");
      return json;
    },
    onSuccess: () =>
      showToast({ type: "success", title: "Billing reminder sent" }),
    onError: (err: Error) =>
      showToast({ type: "error", title: "Failed", description: err.message }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="text-center text-muted-foreground py-12">
        Company not found
      </div>
    );
  }

  const billing = company.billing;
  const history = company.statusHistory ?? [];
  const enrolledCount = company._count?.employees ?? 0;
  const cityReadiness = readiness as CityReadiness | undefined;
  const markActiveDisabled =
    !cityReadiness?.ready && company.status !== "ACTIVE";

  return (
    <div className="space-y-6">
      <PageHeader
        title={company.name}
        description={`${company.email} · Created ${new Date(company.createdAt).toLocaleDateString()}`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/admin/companies")}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          </div>
        }
      />

      {/* City Readiness Gate */}
      {readiness && !readiness.ready && (
        <div className="flex items-start gap-3 rounded-md border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-200">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">City readiness not met</p>
            <p className="mt-1 text-xs">{readiness.message}</p>
            <p className="mt-1 text-xs">
              Mark Active is disabled until{" "}
              {readiness.required.minActiveMerchants} active merchants and{" "}
              {readiness.required.minUniqueCategories} unique categories are
              present in {readiness.city || "this city"}.
            </p>
          </div>
        </div>
      )}

      {/* Company Header */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-bold">{company.name}</h2>
              <p className="text-sm text-muted-foreground">{company.email}</p>
            </div>
            <StatusBadge status={company.status} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              <strong className="text-foreground">{enrolledCount}</strong>{" "}
              employees
            </span>
            {company.city && <span>· {company.city}</span>}
            {company.approvedAt && (
              <span>
                · Activated {new Date(company.approvedAt).toLocaleDateString()}
              </span>
            )}
            {billing?.renewalDate && (
              <span>
                · Renews {new Date(billing.renewalDate).toLocaleDateString()}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Admin Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Admin Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="success"
            onClick={() => handleStatusChange("ACTIVE")}
            disabled={markActiveDisabled}
            title={
              markActiveDisabled
                ? "City readiness not met. Update the city or wait for more merchants to join."
                : undefined
            }
          >
            <CheckCircle className="mr-1 h-4 w-4" />
            Mark Active
          </Button>
          {company.status !== "PAUSED" && (
            <Button
              size="sm"
              variant="warning"
              onClick={() => handleStatusChange("PAUSED")}
            >
              <Pause className="mr-1 h-4 w-4" />
              Pause
            </Button>
          )}
          {company.status !== "SUSPENDED" && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleStatusChange("SUSPENDED")}
            >
              <Ban className="mr-1 h-4 w-4" />
              Suspend
            </Button>
          )}
          {company.status !== "CANCELLED" && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleStatusChange("CANCELLED")}
            >
              <XCircle className="mr-1 h-4 w-4" />
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => sendLaunchPack.mutate()}
            disabled={sendLaunchPack.isPending}
          >
            <Send className="mr-1 h-4 w-4" />
            {sendLaunchPack.isPending ? "Sending…" : "Send Launch Pack"}
          </Button>
          <Button size="sm" variant="outline">
            <Mail className="mr-1 h-4 w-4" />
            Transfer Admin Email
          </Button>
        </CardContent>
      </Card>

      {/* Billing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Billing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              <select
                className="rounded border px-2 py-1 text-sm"
                value={billing?.billingStatus ?? "ACTIVE"}
                onChange={(e) => handleBillingStatusChange(e.target.value)}
              >
                <option value="ACTIVE">Active</option>
                <option value="INVOICE_OVERDUE">Invoice Overdue</option>
                <option value="ON_HOLD">On Hold</option>
              </select>
            </div>
            {billing?.billingStatus === "INVOICE_OVERDUE" && (
              <Button
                size="sm"
                variant="warning"
                onClick={() => sendBillingReminder.mutate()}
                disabled={sendBillingReminder.isPending}
              >
                <Mail className="mr-1 h-4 w-4" />
                {sendBillingReminder.isPending ? "Sending…" : "Send Reminder"}
              </Button>
            )}
            <span className="text-sm text-muted-foreground">
              Plan: <strong>{billing?.plan ?? "—"}</strong>
            </span>
            <span className="text-sm text-muted-foreground">
              Cycle: <strong>{billing?.billingCycle ?? "—"}</strong>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div>
              <p className="text-muted-foreground">Price / Employee</p>
              <p className="font-medium">
                ${Number(billing?.pricePerEmployee ?? 0).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Last Invoice</p>
              <p className="font-medium">
                {billing?.currentPeriodStart
                  ? new Date(billing.currentPeriodStart).toLocaleDateString()
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Next Renewal</p>
              <p className="font-medium">
                {billing?.renewalDate
                  ? new Date(billing.renewalDate).toLocaleDateString()
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Trial</p>
              <p className="font-medium">
                {billing?.isTrial
                  ? `Until ${billing.trialEndsAt ? new Date(billing.trialEndsAt).toLocaleDateString() : "—"}`
                  : "No"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee List + CSV upload */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Employees ({enrolledCount})
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCSVUpload(!showCSVUpload)}
            >
              <FileSpreadsheet className="mr-1 h-4 w-4" />
              {showCSVUpload ? "Hide" : "Bulk Upload"} CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showCSVUpload && !preview && (
            <>
              <p className="text-xs text-muted-foreground">
                Required columns: <code>firstName</code>, <code>lastName</code>,{" "}
                <code>email</code>, <code>department</code> (optional),{" "}
                <code>jobTitle</code> (optional). Header row is required.
              </p>
              <CSVUploadDropzone
                onUpload={handleCSVSelected}
                isUploading={previewLoading}
                acceptedFormats=".csv"
              />
            </>
          )}

          {preview && (
            <div className="space-y-3 rounded-md border bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">CSV Preview</h4>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPreview(null)}
                >
                  <X className="h-3 w-3" /> Cancel
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="rounded border bg-card p-2">
                  <p className="text-muted-foreground text-xs">Total rows</p>
                  <p className="text-lg font-semibold">
                    {preview.data.totalRows}
                  </p>
                </div>
                <div className="rounded border bg-card p-2">
                  <p className="text-muted-foreground text-xs">Valid</p>
                  <p className="text-lg font-semibold text-green-700">
                    {preview.data.validCount}
                  </p>
                </div>
                <div className="rounded border bg-card p-2">
                  <p className="text-muted-foreground text-xs">Rejected</p>
                  <p className="text-lg font-semibold text-red-700">
                    {preview.data.invalidCount}
                  </p>
                </div>
              </div>

              {preview.data.validCount > 0 && (
                <details className="rounded border bg-card p-2 text-sm" open>
                  <summary className="cursor-pointer font-medium">
                    Valid rows ({preview.data.validCount})
                  </summary>
                  <div className="mt-2 max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="p-1">Row</th>
                          <th className="p-1">Name</th>
                          <th className="p-1">Email</th>
                          <th className="p-1">Department</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.data.validRows.map((r) => (
                          <tr key={`v-${r.rowNumber}`} className="border-b">
                            <td className="p-1">{r.rowNumber}</td>
                            <td className="p-1">
                              {r.firstName} {r.lastName}
                            </td>
                            <td className="p-1">{r.email}</td>
                            <td className="p-1">{r.department ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}

              {preview.data.invalidCount > 0 && (
                <details className="rounded border bg-card p-2 text-sm" open>
                  <summary className="cursor-pointer font-medium text-red-700">
                    Invalid rows ({preview.data.invalidCount})
                  </summary>
                  <div className="mt-2 max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="p-1">Row</th>
                          <th className="p-1">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.data.invalidRows.map((r) => (
                          <tr key={`i-${r.rowNumber}`} className="border-b">
                            <td className="p-1">{r.rowNumber}</td>
                            <td className="p-1 text-red-700">{r.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPreview(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => setConfirmImportOpen(true)}
                  disabled={preview.data.validCount === 0}
                >
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                  Confirm Import ({preview.data.validCount})
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search employees..."
              className="rounded border px-3 py-1.5 text-sm"
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
            />
            <select
              className="rounded border px-2 py-1.5 text-sm"
              value={employeeStatusFilter}
              onChange={(e) => setEmployeeStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INVITED">Invited</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
          <DataTable
            columns={employeeColumns}
            data={employees}
            keyExtractor={(e: any) => e.id}
            isLoading={false}
            emptyMessage="No employees found"
            pagination={{
              page: empPage,
              pageSize: empPageSize,
              total: empMeta?.total ?? employees.length,
              onPageChange: setEmpPage,
            }}
          />
        </CardContent>
      </Card>

      {/* Admin Note */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Admin Note</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            className="w-full rounded border p-3 text-sm"
            rows={3}
            maxLength={500}
            placeholder="Add an internal note about this company (max 500 characters). Not visible to the company admin."
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {adminNote.length}/500
            </span>
            <Button
              size="sm"
              onClick={handleSaveNote}
              disabled={updateDetail.isPending}
            >
              {noteSaved
                ? "Saved"
                : updateDetail.isPending
                  ? "Saving..."
                  : "Save Note"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No status changes recorded.
            </p>
          ) : (
            <div className="space-y-2">
              {history.map((h: any) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between rounded border px-4 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <StatusBadge status={h.fromStatus ?? "—"} />
                    <span>→</span>
                    <StatusBadge status={h.toStatus} />
                    {h.reason && (
                      <span className="text-muted-foreground">
                        — {h.reason}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {h.changedByType} · {new Date(h.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title={`${confirmAction} Company`}
        message={`Are you sure you want to set this company to "${confirmAction}"?`}
        confirmLabel={confirmAction}
        loading={updateDetail.isPending}
        onConfirm={confirmStatusChange}
        onCancel={() => {
          setConfirmOpen(false);
          setConfirmAction("");
        }}
      />

      <ConfirmDialog
        open={confirmImportOpen}
        title="Confirm Employee Import"
        message={`This will create ${preview?.data.validCount ?? 0} new employee records. ${preview?.data.invalidCount ?? 0} invalid rows will be skipped. This action cannot be undone.`}
        confirmLabel="Import"
        loading={confirmImport.isPending}
        onConfirm={() => confirmImport.mutate()}
        onCancel={() => setConfirmImportOpen(false)}
      />
    </div>
  );
}
