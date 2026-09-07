"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { ImageUpload, uploadDeferredImage } from "@/components/ui/image-upload";
import type { DeferredFile } from "@/components/shared/ImageUploader";
import { BANNER_IMAGE_OPTIONS } from "@/lib/upload/image";
import { showToast } from "@/hooks/use-toast";
import { Plus, X, Calendar } from "lucide-react";

interface SlotInfo {
  slotNumber: number;
  status: "AVAILABLE" | "PENDING" | "APPROVED";
  bookingId?: string;
  startDate?: string;
  bookedUntil?: string;
  merchantName?: string;
  isOwnBooking?: boolean;
  bookings?: Array<{
    startDate: string;
    endDate: string;
    status: "PENDING" | "APPROVED";
    isOwnBooking?: boolean;
  }>;
}

interface PositionSlots {
  bannerId: string;
  position: string;
  pricePerDay: number;
  minDays: number;
  maxDays: number;
  slotCount: number;
  availableCount: number;
  slots: SlotInfo[];
}

interface Booking {
  id: string;
  bannerId: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  status: string;
  paid: boolean;
  createdAt: string;
  banner: { id: string; name: string; position: string; pricePerDay: number };
  content: {
    imageUrl: string;
    altText: string | null;
    redirectUrl: string | null;
  } | null;
}

interface ApiResponse {
  data: Booking[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

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
    } else if (!booking.paid) {
      badges.push(
        <span
          key="not-visible"
          className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
        >
          Not Visible
        </span>,
      );
    } else {
      badges.push(
        <span
          key="visible"
          className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
        >
          Visible
        </span>,
      );
    }
  }
  return badges;
}

const POSITION_LABELS: Record<string, string> = {
  TOP: "Top",
  BOTTOM: "Bottom",
};

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  const nd = new Date(d);
  nd.setHours(0, 0, 0, 0);
  return nd;
}

function hasOpenWindow(
  slot: SlotInfo,
  minDays: number,
  maxDaysHorizon: number,
  today: Date,
): boolean {
  const bookedRanges = (slot.bookings ?? [])
    .filter((b) => b.status === "APPROVED" || b.status === "PENDING")
    .filter((b) => b.startDate && b.endDate)
    .map((b) => ({
      start: startOfDay(new Date(b.startDate)),
      end: startOfDay(new Date(b.endDate)),
    }));

  const dayInMs = 1000 * 60 * 60 * 24;
  let freeRun = 0;

  for (let i = 0; i <= maxDaysHorizon; i++) {
    const day = new Date(today.getTime() + i * dayInMs);
    const isBooked = bookedRanges.some((r) => day >= r.start && day <= r.end);
    if (isBooked) {
      freeRun = 0;
      continue;
    }
    freeRun++;
    if (freeRun >= minDays) return true;
  }
  return false;
}

function buildCalendarCells(year: number, month: number): Array<Date | null> {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  return cells;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function MerchantBannersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [showBook, setShowBook] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingBannerFile, setPendingBannerFile] =
    useState<DeferredFile | null>(null);

  const [selectedPosition, setSelectedPosition] = useState("TOP");
  const [selectedSlotNumber, setSelectedSlotNumber] = useState<number | null>(
    null,
  );
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [pickedStart, setPickedStart] = useState<string | null>(null);
  const [pickedEnd, setPickedEnd] = useState<string | null>(null);
  const [form, setForm] = useState({
    bannerId: "",
    startDate: "",
    endDate: "",
    imageUrl: "",
    altText: "",
    redirectUrl: "",
  });

  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [editForm, setEditForm] = useState({
    imageUrl: "",
    altText: "",
    redirectUrl: "",
  });
  const [editPendingFile, setEditPendingFile] = useState<DeferredFile | null>(
    null,
  );

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", "20");
  if (status) params.set("status", status);

  const { data, isLoading } = useQuery({
    queryKey: ["merchant-banners", params.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/merchant/banners?${params.toString()}`);
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error?.message ?? "Failed to load bookings");
      return json as ApiResponse;
    },
  });

  const { data: slotsData, isLoading: slotsLoading } = useQuery({
    queryKey: ["merchant-banner-slots", selectedPosition],
    queryFn: async () => {
      const res = await fetch(
        `/api/merchant/banners/slots?position=${selectedPosition}`,
      );
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error?.message ?? "Failed to load slots");
      return json as { success: boolean; data: PositionSlots };
    },
    enabled: showBook,
  });

  const positionSlots = slotsData?.data;

  useEffect(() => {
    if (positionSlots?.bannerId) {
      setForm((f) => ({ ...f, bannerId: positionSlots.bannerId }));
    }
  }, [positionSlots?.bannerId]);

  useEffect(() => {
    setPickedStart(null);
    setPickedEnd(null);
    const now = new Date();
    setCalendarMonth({ year: now.getFullYear(), month: now.getMonth() });
  }, [selectedSlotNumber, selectedPosition]);

  const selectedSlot = selectedSlotNumber
    ? (positionSlots?.slots.find((s) => s.slotNumber === selectedSlotNumber) ??
      null)
    : null;

  const bookedRanges: Array<{ start: Date; end: Date; isOwn: boolean }> = (
    selectedSlot?.bookings ?? []
  )
    .filter((b) => b.startDate && b.endDate)
    .map((b) => ({
      start: startOfDay(new Date(b.startDate)),
      end: startOfDay(new Date(b.endDate)),
      isOwn: !!b.isOwnBooking,
    }));

  const today = startOfDay(new Date());
  const dayInMs = 1000 * 60 * 60 * 24;

  function dateInBookedRanges(d: Date): boolean {
    return bookedRanges.some((r) => d >= r.start && d <= r.end);
  }

  const days =
    pickedStart && pickedEnd
      ? Math.round(
          (new Date(pickedEnd).getTime() - new Date(pickedStart).getTime()) /
            dayInMs,
        )
      : 0;

  const totalPrice =
    positionSlots && days > 0 ? Number(positionSlots.pricePerDay) * days : 0;

  function handleDayClick(d: Date) {
    if (!positionSlots || d < today) return;
    if (dateInBookedRanges(d)) return;
    const key = toDateKey(d);
    if (!pickedStart || (pickedStart && pickedEnd)) {
      // start a fresh range
      setPickedStart(key);
      setPickedEnd(null);
      setForm((f) => ({ ...f, startDate: key, endDate: "" }));
      return;
    }
    // pickedStart set, no end yet
    const start = new Date(pickedStart);
    if (d < start) {
      setPickedStart(key);
      setPickedEnd(pickedStart);
      setForm((f) => ({ ...f, startDate: key, endDate: pickedStart }));
      return;
    }
    if (d.getTime() === start.getTime()) return;
    // check range validity: min/max days and no booked day inside
    const rangeDays = Math.round((d.getTime() - start.getTime()) / dayInMs);
    if (rangeDays < (positionSlots.minDays ?? 0)) {
      showToast({
        type: "error",
        title: "Too short",
        description: `Minimum booking period is ${positionSlots.minDays} days.`,
      });
      return;
    }
    if (rangeDays > (positionSlots.maxDays ?? 0)) {
      showToast({
        type: "error",
        title: "Too long",
        description: `Maximum booking period is ${positionSlots.maxDays} days.`,
      });
      return;
    }
    for (let i = 0; i <= rangeDays; i++) {
      const day = new Date(start.getTime() + i * dayInMs);
      if (dateInBookedRanges(day)) {
        showToast({
          type: "error",
          title: "Conflict",
          description:
            "Selected range includes a booked day. Please adjust your dates.",
        });
        return;
      }
    }
    setPickedEnd(key);
    setForm((f) => ({ ...f, endDate: key }));
  }

  function clearPicked() {
    setPickedStart(null);
    setPickedEnd(null);
    setForm((f) => ({ ...f, startDate: "", endDate: "" }));
  }

  const calCells = buildCalendarCells(calendarMonth.year, calendarMonth.month);

  function prevMonth() {
    setCalendarMonth((m) => {
      if (m.month === 0) return { year: m.year - 1, month: 11 };
      return { year: m.year, month: m.month - 1 };
    });
  }

  function nextMonth() {
    setCalendarMonth((m) => {
      if (m.month === 11) return { year: m.year + 1, month: 0 };
      return { year: m.year, month: m.month + 1 };
    });
  }

  const bookMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch("/api/merchant/banners/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error?.message ?? "Failed to book banner");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-banners"] });
      queryClient.invalidateQueries({ queryKey: ["merchant-banner-slots"] });
      setShowBook(false);
      setPendingBannerFile(null);
      setSelectedSlotNumber(null);
      setPickedStart(null);
      setPickedEnd(null);
      setForm({
        bannerId: "",
        startDate: "",
        endDate: "",
        imageUrl: "",
        altText: "",
        redirectUrl: "",
      });
      showToast({
        type: "success",
        title: "Booking submitted",
        description: "Your banner booking is pending approval.",
      });
    },
    onError: (e: any) =>
      showToast({ type: "error", title: "Failed", description: e?.message }),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown>) => {
      const res = await fetch(`/api/merchant/banners/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error?.message ?? "Failed to update booking");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-banners"] });
      setEditBooking(null);
      setEditPendingFile(null);
      showToast({ type: "success", title: "Booking updated" });
    },
    onError: (e: any) =>
      showToast({ type: "error", title: "Failed", description: e?.message }),
  });

  function openEdit(b: Booking) {
    setEditBooking(b);
    setEditForm({
      imageUrl: b.content?.imageUrl ?? "",
      altText: b.content?.altText ?? "",
      redirectUrl: b.content?.redirectUrl ?? "",
    });
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editBooking) return;
    let imageUrl = editForm.imageUrl;
    if (editPendingFile) {
      try {
        imageUrl =
          (await uploadDeferredImage(editPendingFile, BANNER_IMAGE_OPTIONS)) ??
          "";
      } catch (err: any) {
        showToast({
          type: "error",
          title: "Image upload failed",
          description: err?.message,
        });
        return;
      }
    }
    editMutation.mutate({
      id: editBooking.id,
      imageUrl,
      altText: editForm.altText || undefined,
      redirectUrl: editForm.redirectUrl || undefined,
    });
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    // Upload deferred image before submitting
    let imageUrl = form.imageUrl;
    if (pendingBannerFile) {
      try {
        imageUrl =
          (await uploadDeferredImage(
            pendingBannerFile,
            BANNER_IMAGE_OPTIONS,
          )) ?? "";
      } catch (err: any) {
        showToast({
          type: "error",
          title: "Image upload failed",
          description: err?.message,
        });
        return;
      }
    }
    bookMutation.mutate({ ...form, imageUrl });
  }

  const bookings = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Banner Bookings"
        description="Book promotional banner slots and manage your bookings"
        actions={
          <Button onClick={() => setShowBook((s) => !s)}>
            <Plus className="mr-1 h-4 w-4" />
            {showBook ? "Cancel" : "Book a Banner"}
          </Button>
        }
      />

      {showBook && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Book a Banner Slot</CardTitle>
          </CardHeader>
          <CardContent>
            {
              <form onSubmit={handleBook} className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Position
                  </label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={selectedPosition}
                    onChange={(e) => {
                      setSelectedPosition(e.target.value);
                      setSelectedSlotNumber(null);
                    }}
                  >
                    <option value="TOP">Top</option>
                    <option value="BOTTOM">Bottom</option>
                  </select>
                </div>

                {slotsLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : !positionSlots ? (
                  <p className="text-sm text-muted-foreground">
                    No active banner slot for this position.
                  </p>
                ) : (
                  <>
                    <div className="rounded-md bg-muted/30 p-3 text-sm text-muted-foreground">
                      <p>
                        ₹{Number(positionSlots.pricePerDay).toFixed(2)}/day ·{" "}
                        {positionSlots.availableCount} of{" "}
                        {positionSlots.slotCount} slot
                        {positionSlots.slotCount !== 1 ? "s" : ""} available
                      </p>
                      <p className="mt-1 text-xs">
                        Min: {positionSlots.minDays} days · Max:{" "}
                        {positionSlots.maxDays} days
                      </p>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Choose a slot
                      </label>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {positionSlots.slots.map((slot) => {
                          const isAvailable = hasOpenWindow(
                            slot,
                            positionSlots.minDays ?? 1,
                            positionSlots.maxDays ?? 30,
                            today,
                          );
                          const isSelected =
                            selectedSlotNumber === slot.slotNumber;
                          return (
                            <button
                              type="button"
                              key={slot.slotNumber}
                              disabled={!isAvailable}
                              onClick={() =>
                                setSelectedSlotNumber(slot.slotNumber)
                              }
                              className={`rounded-md border p-2 text-left text-xs transition-colors ${
                                !isAvailable
                                  ? "cursor-not-allowed border-muted bg-muted/40 text-muted-foreground"
                                  : isSelected
                                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                                    : "hover:bg-muted/50"
                              }`}
                            >
                              <p className="font-semibold">
                                Slot {slot.slotNumber}
                              </p>
                              {isAvailable ? (
                                <p className="mt-1 text-emerald-600">
                                  {(slot.bookings?.length ?? 0) > 0
                                    ? "Partially booked"
                                    : "Available"}
                                </p>
                              ) : (
                                <>
                                  <p className="mt-1 text-amber-600">
                                    Fully booked
                                  </p>
                                  {slot.bookedUntil && (
                                    <p className="mt-0.5 text-muted-foreground">
                                      until{" "}
                                      {new Date(
                                        slot.bookedUntil,
                                      ).toLocaleDateString()}
                                    </p>
                                  )}
                                </>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {selectedSlotNumber != null && selectedSlot && (
                      <>
                        <div className="rounded-md bg-primary/10 p-3 text-sm">
                          <p className="font-medium">
                            Selected slot: Slot {selectedSlot.slotNumber}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {bookedRanges.length > 0 ? (
                              <>
                                Booked days:{" "}
                                {bookedRanges
                                  .map(
                                    (r) =>
                                      `${new Date(r.start).toLocaleDateString()} – ${new Date(r.end).toLocaleDateString()}`,
                                  )
                                  .join(", ")}
                              </>
                            ) : (
                              "No existing bookings for this slot"
                            )}
                          </p>
                        </div>

                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <label className="text-xs font-medium text-muted-foreground">
                              Select dates (
                              {new Date(
                                calendarMonth.year,
                                calendarMonth.month,
                                1,
                              ).toLocaleDateString("en-US", {
                                month: "long",
                                year: "numeric",
                              })}
                              )
                            </label>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={prevMonth}
                              >
                                ‹
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={nextMonth}
                              >
                                ›
                              </Button>
                            </div>
                          </div>

                          <div className="rounded-md border">
                            <div className="grid grid-cols-7 gap-1 border-b bg-muted/30 p-1 text-center text-[10px] font-medium uppercase text-muted-foreground">
                              {WEEKDAY_LABELS.map((w) => (
                                <span key={w}>{w}</span>
                              ))}
                            </div>
                            <div className="grid grid-cols-7 gap-1 p-1">
                              {calCells.map((cell, idx) => {
                                if (!cell) return <div key={`e-${idx}`} />;
                                const key = toDateKey(cell);
                                const isPast = cell < today;
                                const isBooked = dateInBookedRanges(cell);
                                const isSelected =
                                  key === pickedStart || key === pickedEnd;
                                const inRange =
                                  pickedStart &&
                                  pickedEnd &&
                                  key > pickedStart &&
                                  key < pickedEnd;
                                const disabled = isPast || isBooked;
                                return (
                                  <button
                                    key={key}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => handleDayClick(cell)}
                                    className={`flex h-9 items-center justify-center rounded-md text-xs transition-colors ${
                                      isPast || isBooked
                                        ? "cursor-not-allowed text-muted-foreground/40 line-through"
                                        : inRange
                                          ? "bg-primary/20 text-primary"
                                          : isSelected
                                            ? "bg-primary text-primary-foreground font-semibold"
                                            : "hover:bg-muted/50"
                                    }`}
                                  >
                                    {cell.getDate()}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <span className="inline-block h-3 w-3 rounded bg-primary" />{" "}
                              Selected
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="inline-block h-3 w-3 rounded bg-primary/20" />{" "}
                              In range
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="inline-block h-3 w-3 rounded bg-muted text-muted-foreground/40 line-through" />{" "}
                              Booked
                            </span>
                          </div>

                          {pickedStart && (
                            <div className="mt-2 flex flex-wrap items-center gap-4 rounded-md bg-muted/40 p-3 text-sm">
                              <p className="font-medium">
                                Slot {selectedSlotNumber}
                              </p>
                              <p>
                                From:{" "}
                                {pickedStart
                                  ? new Date(pickedStart).toLocaleDateString()
                                  : "—"}
                              </p>
                              <p>
                                To:{" "}
                                {pickedEnd
                                  ? new Date(pickedEnd).toLocaleDateString()
                                  : "pick an end date"}
                              </p>
                              {days > 0 && (
                                <>
                                  <p>Days: {days}</p>
                                  <p className="font-semibold">
                                    Total:{" "}
                                    {Intl.NumberFormat("en-IN", {
                                      style: "currency",
                                      currency: "INR",
                                    }).format(totalPrice)}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={clearPicked}
                                    className="text-xs text-primary underline"
                                  >
                                    Clear
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}

                <ImageUpload
                  value={form.imageUrl}
                  onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
                  onDeferredFile={(file) => setPendingBannerFile(file)}
                  uploadMode="deferred"
                  label="Banner Image *"
                  helperText="Recommended size: 1200×400 px, max 5 MB, PNG/JPG/WEBP"
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Alt Text
                    </label>
                    <Input
                      value={form.altText}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, altText: e.target.value }))
                      }
                      placeholder="Describe the banner image"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Redirect URL
                    </label>
                    <Input
                      type="url"
                      value={form.redirectUrl}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, redirectUrl: e.target.value }))
                      }
                      placeholder="https://example.com/landing"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowBook(false)}
                  >
                    Cancel
                  </Button>
                  <LoadingButton
                    type="submit"
                    disabled={
                      (!pendingBannerFile && !form.imageUrl) ||
                      !selectedSlotNumber ||
                      !pickedStart ||
                      !pickedEnd
                    }
                    loading={bookMutation.isPending}
                    loadingText="Submitting…"
                  >
                    Submit Booking
                  </LoadingButton>
                </div>
              </form>
            }
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>My Bookings</span>
            <span className="text-sm text-muted-foreground">
              {meta?.total ?? 0} total
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : bookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No banner bookings yet. Click &quot;Book a Banner&quot; to get
              started.
            </p>
          ) : (
            <>
              <ul className="space-y-2">
                {bookings.map((b) => (
                  <li key={b.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{b.banner.name}</p>
                        <span className="text-xs text-muted-foreground">
                          (
                          {POSITION_LABELS[b.banner.position] ??
                            b.banner.position}
                          )
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {statusBadge(b.status)}
                        {derivedBadges(b)}
                        <span className="font-semibold">
                          ₹{Number(b.totalPrice).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(b.startDate).toLocaleDateString()} -{" "}
                      {new Date(b.endDate).toLocaleDateString()}
                      {b.content?.imageUrl && (
                        <img
                          src={b.content.imageUrl}
                          alt={b.content.altText ?? ""}
                          className="h-16 w-28 cursor-pointer rounded object-cover transition-opacity hover:opacity-80"
                          onClick={() => setPreviewUrl(b.content!.imageUrl)}
                        />
                      )}
                    </div>
                    {b.status === "PENDING" && (
                      <div className="mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(b)}
                        >
                          Edit
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {meta && meta.totalPages > 1 && (
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-xs text-muted-foreground">
                    Page {page} of {meta.totalPages}
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
                        setPage((p) => Math.min(meta.totalPages, p + 1))
                      }
                      disabled={page >= meta.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {editBooking && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>Edit Booking — {editBooking.banner.name}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditBooking(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEdit} className="space-y-3">
              <ImageUpload
                value={editForm.imageUrl}
                onChange={(url) =>
                  setEditForm((f) => ({ ...f, imageUrl: url }))
                }
                onDeferredFile={(file) => setEditPendingFile(file)}
                uploadMode="deferred"
                label="Banner Image"
                helperText="Recommended size: 1200×400 px, max 5 MB, PNG/JPG/WEBP"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Alt Text
                  </label>
                  <Input
                    value={editForm.altText}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, altText: e.target.value }))
                    }
                    placeholder="Describe the banner image"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Redirect URL
                  </label>
                  <Input
                    type="url"
                    value={editForm.redirectUrl}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        redirectUrl: e.target.value,
                      }))
                    }
                    placeholder="https://example.com/landing"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditBooking(null)}
                >
                  Cancel
                </Button>
                <LoadingButton
                  type="submit"
                  loading={editMutation.isPending}
                  loadingText="Saving…"
                >
                  Save Changes
                </LoadingButton>
              </div>
            </form>
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
