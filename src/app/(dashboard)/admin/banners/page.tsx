"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { showToast } from "@/hooks/use-toast";
import { Plus, X, Check, Ban, ToggleLeft, ToggleRight } from "lucide-react";

interface Banner {
  id: string;
  name: string;
  description: string | null;
  position: string;
  displayOrder: number;
  pricePerDay: number;
  minDays: number;
  maxDays: number;
  isActive: boolean;
  expiresAt: string | null;
  daysUntilExpiry: number | null;
  createdAt: string;
  _count: { bookings: number };
}

interface Booking {
  id: string;
  bannerId: string;
  merchantId: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  status: string;
  paid: boolean;
  rejectedReason: string | null;
  createdAt: string;
  banner: { id: string; name: string; position: string };
  merchant: { id: string; businessName: string };
  content: {
    imageUrl: string;
    altText: string | null;
    redirectUrl: string | null;
  } | null;
}

const POSITION_LABELS: Record<string, string> = {
  TOP: "Top",
  BOTTOM: "Bottom",
};

function statusBadge(s: string) {
  const cls =
    s === "PENDING"
      ? "bg-yellow-100 text-yellow-800"
      : s === "APPROVED"
        ? "bg-green-100 text-green-800"
        : s === "REJECTED"
          ? "bg-red-100 text-red-800"
          : s === "CANCELLED"
            ? "bg-gray-100 text-gray-800"
            : "bg-gray-100 text-gray-800";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {s}
    </span>
  );
}

function derivedBadges(booking: Booking) {
  const now = new Date();
  const end = new Date(booking.endDate);
  const badges: React.ReactNode[] = [];
  if (booking.status === "APPROVED") {
    if (end < now) {
      badges.push(
        <span
          key="expired"
          className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800"
        >
          Expired
        </span>,
      );
      // badges.push(<span key="renewal" className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">Renewal</span>)
    } else {
      badges.push(
        <span
          key="live"
          className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
        >
          Live
        </span>,
      );
    }
  }
  return badges;
}

export default function AdminBannersPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"banners" | "bookings">("banners");
  const [page, setPage] = useState(1);
  const [bookingsPage, setBookingsPage] = useState(1);
  const [bookingsStatus, setBookingsStatus] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
  position: 'TOP', slotCount: '5', pricePerDay: '', minDays: '7', maxDays: '30', expiresAt: '',
})

  const [editBanner, setEditBanner] = useState<Banner | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    displayOrder: "",
    pricePerDay: "",
    minDays: "",
    maxDays: "",
    expiresAt: "",
  });

  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: bannersData, isLoading: bannersLoading } = useQuery({
    queryKey: ["admin-banners", page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
      });
      const res = await fetch(`/api/admin/banners?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Failed to load");
      return json;
    },
  });

  const bParams = new URLSearchParams();
  bParams.set("page", String(bookingsPage));
  bParams.set("pageSize", "20");
  if (bookingsStatus) bParams.set("status", bookingsStatus);

  const { data: bookingsData, isLoading: bookingsLoading } = useQuery({
    queryKey: ["admin-banner-bookings", bParams.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/admin/banners/bookings?${bParams}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Failed to load");
      return json;
    },
    enabled: tab === "bookings",
  });

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch("/api/admin/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Failed to create");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
      setShowCreate(false);
      setCreateForm({
        position: "TOP",
        slotCount: "5",
        pricePerDay: "",
        minDays: "7",
        maxDays: "30",
        expiresAt: "",
      });
      showToast({ type: "success", title: "Banner slots created" });
    },
    onError: (e: any) =>
      showToast({ type: "error", title: "Failed", description: e?.message }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown>) => {
      const res = await fetch(`/api/admin/banners/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Failed to update");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
      setEditBanner(null);
      showToast({ type: "success", title: "Banner slot updated" });
    },
    onError: (e: any) =>
      showToast({ type: "error", title: "Failed", description: e?.message }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/admin/banners/${id}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Failed to toggle");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
      showToast({ type: "success", title: "Banner status toggled" });
    },
    onError: (e: any) =>
      showToast({ type: "error", title: "Failed", description: e?.message }),
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown>) => {
      const res = await fetch(`/api/admin/banners/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Failed to review");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-banner-bookings"] });
      setReviewBooking(null);
      setRejectReason("");
      showToast({ type: "success", title: "Booking reviewed" });
    },
    onError: (e: any) =>
      showToast({ type: "error", title: "Failed", description: e?.message }),
  });

 

function handleCreate(e: React.FormEvent) {
  e.preventDefault()
  createMutation.mutate({
    position: createForm.position,
    slotCount: parseInt(createForm.slotCount) || 1,
    pricePerDay: parseFloat(createForm.pricePerDay),
    minDays: parseInt(createForm.minDays),
    maxDays: parseInt(createForm.maxDays),
    expiresAt: createForm.expiresAt || undefined,
  })
}

  function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editBanner) return;
    updateMutation.mutate({
      id: editBanner.id,
      name: editForm.name,
      description: editForm.description || undefined,
      displayOrder: parseInt(editForm.displayOrder) || 0,
      pricePerDay: parseFloat(editForm.pricePerDay),
      minDays: parseInt(editForm.minDays),
      maxDays: parseInt(editForm.maxDays),
      expiresAt: editForm.expiresAt || null,
    });
  }

  function openEdit(banner: Banner) {
    setEditBanner(banner);
    setEditForm({
      name: banner.name,
      description: banner.description ?? "",
      displayOrder: String(banner.displayOrder ?? 0),
      pricePerDay: String(banner.pricePerDay),
      minDays: String(banner.minDays),
      maxDays: String(banner.maxDays),
      expiresAt: banner.expiresAt
        ? (new Date(banner.expiresAt).toISOString().split("T")[0] ?? "")
        : "",
    });
  }

  function handleApprove(booking: Booking) {
    reviewMutation.mutate({ id: booking.id, status: "APPROVED" });
  }

  function handleReject() {
    if (!reviewBooking) return;
    reviewMutation.mutate({
      id: reviewBooking.id,
      status: "REJECTED",
      rejectedReason: rejectReason || undefined,
    });
  }

  const banners = bannersData?.data ?? [];
  const bannersMeta = bannersData?.meta;
  const bookings = bookingsData?.data ?? [];
  const bookingsMeta = bookingsData?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Banner Management"
        description="Manage banner slots and review booking requests"
      />

      <div className="flex gap-1 border-b">
        <button
          onClick={() => setTab("banners")}
          className={`relative whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors ${
            tab === "banners"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Banner Slots
        </button>
        <button
          onClick={() => setTab("bookings")}
          className={`relative whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors ${
            tab === "bookings"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Bookings
        </button>
      </div>

      {tab === "banners" && (
        <>
          <Button onClick={() => setShowCreate((s) => !s)}>
            <Plus className="mr-1 h-4 w-4" />
            {showCreate ? "Cancel" : "Create Banner Slot"}
          </Button>

          {showCreate && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Create Banner Slot</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreate} className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Position *
                      </label>
                      <select
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={createForm.position}
                        onChange={(e) =>
                          setCreateForm((f) => ({
                            ...f,
                            position: e.target.value,
                          }))
                        }
                      >
                        <option value="TOP">Top</option>
                        <option value="BOTTOM">Bottom</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Number of Slots *
                      </label>
                      <Input
                        type="number"
                        min="1"
                        max="20"
                        value={createForm.slotCount}
                        onChange={(e) =>
                          setCreateForm((f) => ({
                            ...f,
                            slotCount: e.target.value,
                          }))
                        }
                        required
                      />
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        How many bookable slots to create in this position (e.g.
                        5 = merchants can book Slot 1 through Slot 5).
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Price Per Day (€) *
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={createForm.pricePerDay}
                        onChange={(e) =>
                          setCreateForm((f) => ({
                            ...f,
                            pricePerDay: e.target.value,
                          }))
                        }
                        required
                      />
                      {createForm.pricePerDay &&
                        (() => {
                          const samePosition = banners.filter(
                            (b: Banner) =>
                              b.position === createForm.position && b.isActive,
                          );
                          if (samePosition.length > 0) {
                            const existingPrice = Number(
                              samePosition[0].pricePerDay,
                            );
                            const enteredPrice = parseFloat(
                              createForm.pricePerDay,
                            );
                            if (enteredPrice !== existingPrice) {
                              return (
                                <p className="mt-1 text-xs text-amber-600">
                                  Warning: Other{" "}
                                  {POSITION_LABELS[createForm.position]} slots
                                  are priced at €{existingPrice.toFixed(2)}/day.
                                  All slots must share the same price.
                                </p>
                              );
                            }
                          }
                          return null;
                        })()}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Min Days
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={createForm.minDays}
                        onChange={(e) =>
                          setCreateForm((f) => ({
                            ...f,
                            minDays: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Max Days
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={createForm.maxDays}
                        onChange={(e) =>
                          setCreateForm((f) => ({
                            ...f,
                            maxDays: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Expires At (optional — blank = no expiry)
                    </label>
                    <Input
                      type="date"
                      value={createForm.expiresAt}
                      onChange={(e) =>
                        setCreateForm((f) => ({
                          ...f,
                          expiresAt: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowCreate(false)}
                    >
                      Cancel
                    </Button>
                    <LoadingButton
                      type="submit"
                      loading={createMutation.isPending}
                      loadingText="Creating…"
                    >
                      Create {createForm.slotCount || 1} Slot
                      {Number(createForm.slotCount) === 1 ? "" : "s"}
                    </LoadingButton>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Banner Slots</CardTitle>
            </CardHeader>
            <CardContent>
              {bannersLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : banners.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No banner slots created yet.
                </p>
              ) : (
                <div className="space-y-6">
                  {(["TOP", "BOTTOM"] as const).map((pos) => {
                    const slots = banners
                      .filter((b: Banner) => b.position === pos)
                      .sort(
                        (a: Banner, b: Banner) =>
                          (a.displayOrder ?? 0) - (b.displayOrder ?? 0),
                      );
                    if (slots.length === 0) return null;
                    return (
                      <div key={pos}>
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {POSITION_LABELS[pos]} Position
                        </h3>
                        <div className="space-y-2">
                          {slots.map((b: Banner) => (
                            <div
                              key={b.id}
                              className="rounded-md border p-3 text-sm"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground w-6 text-center font-mono">
                                    #{b.displayOrder ?? 0}
                                  </span>
                                  <p className="font-medium">{b.name}</p>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${b.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                                  >
                                    {b.isActive ? "Active" : "Inactive"}
                                  </span>
                                  {b.daysUntilExpiry !== null &&
                                    b.daysUntilExpiry <= 7 &&
                                    b.daysUntilExpiry > 0 && (
                                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                                        Expires in {b.daysUntilExpiry}d
                                      </span>
                                    )}
                                  {b.daysUntilExpiry !== null &&
                                    b.daysUntilExpiry <= 0 && (
                                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                                        Expired
                                      </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">
                                    €{Number(b.pricePerDay).toFixed(2)}/day
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openEdit(b)}
                                  >
                                    Edit
                                  </Button>
                                  <LoadingButton
                                    size="sm"
                                    variant="outline"
                                    loading={toggleMutation.isPending}
                                    onClick={() =>
                                      toggleMutation.mutate({
                                        id: b.id,
                                        isActive: !b.isActive,
                                      })
                                    }
                                  >
                                    {b.isActive ? (
                                      <ToggleRight className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <ToggleLeft className="h-4 w-4 text-gray-400" />
                                    )}
                                  </LoadingButton>
                                </div>
                              </div>
                              {b.description && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {b.description}
                                </p>
                              )}
                              <p className="mt-1 text-xs text-muted-foreground">
                                {b._count.bookings} bookings · Min {b.minDays}d
                                · Max {b.maxDays}d
                                {b.expiresAt && (
                                  <>
                                    {" "}
                                    · Expires{" "}
                                    {new Date(b.expiresAt).toLocaleDateString()}
                                  </>
                                )}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {bannersMeta && bannersMeta.totalPages > 1 && (
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-xs text-muted-foreground">
                    Page {page} of {bannersMeta.totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((p) => Math.min(bannersMeta.totalPages, p + 1))
                      }
                      disabled={page >= bannersMeta.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {editBanner && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span>Edit: {editBanner.name}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditBanner(null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleEdit} className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Name *
                    </label>
                    <Input
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, name: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Description
                    </label>
                    <Input
                      value={editForm.description}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          description: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Price Per Day (€) *
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editForm.pricePerDay}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            pricePerDay: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Min Days
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={editForm.minDays}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            minDays: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Max Days
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={editForm.maxDays}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            maxDays: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Display Order (slot number — lower = appears first)
                    </label>
                    <Input
                      type="number"
                      value={editForm.displayOrder}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          displayOrder: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Expires At (optional — blank = no expiry)
                    </label>
                    <Input
                      type="date"
                      value={editForm.expiresAt}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          expiresAt: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditBanner(null)}
                    >
                      Cancel
                    </Button>
                    <LoadingButton
                      type="submit"
                      loading={updateMutation.isPending}
                      loadingText="Saving…"
                    >
                      Save
                    </LoadingButton>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {tab === "bookings" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Booking Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <select
                className="rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={bookingsStatus}
                onChange={(e) => {
                  setBookingsStatus(e.target.value);
                  setBookingsPage(1);
                }}
              >
                <option value="">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {bookingsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No bookings found.
              </p>
            ) : (
              <div className="space-y-2">
                {bookings.map((b: Booking) => (
                  <div key={b.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {b.banner.name}{" "}
                          <span className="text-xs text-muted-foreground">
                            (
                            {POSITION_LABELS[b.banner.position] ??
                              b.banner.position}
                            )
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {b.merchant.businessName}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {statusBadge(b.status)}
                        {derivedBadges(b)}
                        <span className="font-semibold">
                          €{Number(b.totalPrice).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {new Date(b.startDate).toLocaleDateString()} -{" "}
                      {new Date(b.endDate).toLocaleDateString()}
                    </div>
                    {b.content?.imageUrl && (
                      <img
                        src={b.content.imageUrl}
                        alt={b.content.altText ?? ""}
                        className="mt-2 h-20 w-full cursor-pointer rounded object-cover transition-opacity hover:opacity-80"
                        onClick={() => setPreviewUrl(b.content!.imageUrl)}
                      />
                    )}
                    {b.status === "PENDING" && (
                      <div className="mt-2 flex gap-2">
                        <LoadingButton
                          size="sm"
                          loading={reviewMutation.isPending}
                          onClick={() => handleApprove(b)}
                        >
                          <Check className="mr-1 h-3 w-3" /> Approve
                        </LoadingButton>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive/50"
                          onClick={() => {
                            setReviewBooking(b);
                            setRejectReason("");
                          }}
                        >
                          <Ban className="mr-1 h-3 w-3" /> Reject
                        </Button>
                      </div>
                    )}
                    {b.rejectedReason && (
                      <p className="mt-1 text-xs text-red-600">
                        Reason: {b.rejectedReason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {bookingsMeta && bookingsMeta.totalPages > 1 && (
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-xs text-muted-foreground">
                  Page {bookingsPage} of {bookingsMeta.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBookingsPage((p) => Math.max(1, p - 1))}
                    disabled={bookingsPage <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setBookingsPage((p) =>
                        Math.min(bookingsMeta.totalPages, p + 1),
                      )
                    }
                    disabled={bookingsPage >= bookingsMeta.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {reviewBooking && (
              <Card className="mt-4 border-destructive/30">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>Reject Booking</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setReviewBooking(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Rejecting booking for{" "}
                    <strong>{reviewBooking.banner.name}</strong> by{" "}
                    {reviewBooking.merchant.businessName}
                  </p>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Rejection Reason
                    </label>
                    <textarea
                      rows={3}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Optional reason for rejection"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setReviewBooking(null)}
                    >
                      Cancel
                    </Button>
                    <LoadingButton
                      variant="destructive"
                      onClick={handleReject}
                      loading={reviewMutation.isPending}
                      loadingText="Rejecting…"
                    >
                      Reject Booking
                    </LoadingButton>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}

      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]">
            <img
              src={previewUrl}
              alt=""
              className="max-h-[90vh] max-w-[90vw] rounded object-contain"
            />
            <button
              className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-background shadow-md"
              onClick={() => setPreviewUrl(null)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
