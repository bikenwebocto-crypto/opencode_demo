"use client";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Send, Loader2 } from "lucide-react";
import {
  useCreateMerchantOffer,
  useUpdateMerchantOffer,
  useSubmitMerchantOffer,
} from "@/hooks/queries/use-merchant-offers";
import { OfferStrengthIndicator } from "./offer-strength-indicator";
import {
  OfferImageUploader,
  type PendingImage,
} from "@/components/merchant/offers/OfferImageUploader";
import { OfferImageGallery } from "@/components/merchant/offers/OfferImageGallery";
import { OfferMobilePreview } from "@/components/merchant/offers/OfferMobilePreview";
import { OfferBannerInfo } from "@/components/merchant/offers/OfferBannerInfo";
import { showToast } from "@/hooks/use-toast";
import { useCategories } from "@/hooks/queries/use-categories";
import { deleteOfferImage } from "@/lib/upload-offer-image";

interface FormData {
  title: string;
  description: string;
  shortDescription: string;
  termsAndConditions: string;
  imageUrls: string[];
  offerType: string;
  discountValue: string;
  discountMax: string;
  discountPercent: string;
  minimumSpend: string;
  maxRedemptions: string;
  startDate: string;
  endDate: string;
  daysOfWeek: string;
  redemptionCode: string;
  redemptionInstructions: string;
  categoryId: string;
  submissionNotes: string;
  replacementReason: string;
  redemptionType: string;
  bookingUrl: string;
  qrCodeUrl: string;
}

interface FormErrors {
  [key: string]: string;
}

interface OfferFormProps {
  offerId?: string;
  initialData?: Partial<FormData>;
  isReplacement?: boolean;
  currentLiveOffer?: { id: string; title: string } | null;
}

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
  "image/gif",
];
const MAX_SIZE = 5 * 1024 * 1024;

const DAYS_OF_WEEK = [
  { value: 0, short: 'Sun', full: 'Sunday' },
  { value: 1, short: 'Mon', full: 'Monday' },
  { value: 2, short: 'Tue', full: 'Tuesday' },
  { value: 3, short: 'Wed', full: 'Wednesday' },
  { value: 4, short: 'Thu', full: 'Thursday' },
  { value: 5, short: 'Fri', full: 'Friday' },
  { value: 6, short: 'Sat', full: 'Saturday' },
] as const

function parseInitialImageUrls(input: string | string[] | undefined): string[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.filter(Boolean);
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function urlToPendingImage(url: string, index: number): PendingImage {
  const name = url.split("/").pop() || `image-${index + 1}`;
  return {
    id: `existing-${index}`,
    file: new File([], name),
    previewUrl: url,
    status: "done",
    url,
  };
}

export function OfferForm({
  offerId,
  initialData,
  isReplacement,
  currentLiveOffer,
}: OfferFormProps) {
  const router = useRouter();
  const isEdit = !!offerId;
  const createOffer = useCreateMerchantOffer();
  const updateOffer = useUpdateMerchantOffer();
  const submitOffer = useSubmitMerchantOffer();
  const [errors, setErrors] = useState<FormErrors>({});
  const [showStrength, setShowStrength] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const { data: categories } = useCategories();
  const [lastEditedField, setLastEditedField] = useState<'minimumSpend' | 'discountMax' | 'discountPercent' | null>(null);

  useEffect(()=>{
    if(categories && initialData?.categoryId){
      const categoryExits= categories.some(c => c.id === initialData.categoryId)
      if(categoryExits){
        setForm( prev => ({...prev, categoryId: initialData.categoryId!}))
      }
    }
  }, [categories, initialData?.categoryId])
  const initialImageUrls = useMemo(
    () => parseInitialImageUrls(initialData?.imageUrls),
    [initialData?.imageUrls],
  );

  const [pendingImages, setPendingImages] = useState<PendingImage[]>(() =>
    initialImageUrls.map(urlToPendingImage),
  );

  const initialFormImageUrls = useMemo(() => initialImageUrls, []);
  
  const [form, setForm] = useState<FormData>({
    title: initialData?.title ?? "",
    description: initialData?.description ?? "",
    shortDescription: initialData?.shortDescription ?? "",
    termsAndConditions: initialData?.termsAndConditions ?? "",
    imageUrls: initialFormImageUrls,
    offerType: initialData?.offerType ?? "FLAT",
    discountValue: initialData?.discountValue ?? "",
    discountMax: initialData?.discountMax ?? "",
    discountPercent: initialData?.discountPercent ?? "",
    minimumSpend: initialData?.minimumSpend ?? "",
    maxRedemptions: initialData?.maxRedemptions ?? "",
    startDate: initialData?.startDate ?? "",
    endDate: initialData?.endDate ?? "",
    daysOfWeek: initialData?.daysOfWeek ?? "0,1,2,3,4,5,6",
    redemptionCode: initialData?.redemptionCode ?? "",
    redemptionInstructions: initialData?.redemptionInstructions ?? "",
    categoryId: initialData?.categoryId ?? "",
    submissionNotes: initialData?.submissionNotes ?? "",
    replacementReason: initialData?.replacementReason ?? "",
    redemptionType: initialData?.redemptionType ?? "IN_STORE_QR",
    bookingUrl: initialData?.bookingUrl ?? "",
    qrCodeUrl: initialData?.qrCodeUrl ?? "",
  });

  const set =
    (field: keyof FormData) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field])
        setErrors((prev) => {
          const n = { ...prev };
          delete n[field];
          return n;
        });
      if (field === "discountValue" || field === "offerType")
        setShowStrength(true);
    };

  // Linked field recalculation — tracks last edited field to avoid circular loops
  const handleLinkedFieldChange = (
    field: 'minimumSpend' | 'discountMax' | 'discountPercent',
    value: string,
  ) => {
    setLastEditedField(field);
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      const ms = Number(next.minimumSpend);
      const dm = Number(next.discountMax);
      const dp = Number(next.discountPercent);
      const hasMs = !isNaN(ms) && ms > 0;
      const hasDm = !isNaN(dm) && dm > 0;
      const hasDp = !isNaN(dp) && dp > 0;

      if (field === 'minimumSpend') {
        // Minimum Spend changed → recalculate whichever dependent is set
        if (hasMs && hasDp) {
          // Percentage is source of truth → recalc Max
          const calcMax = (ms * dp) / 100;
          next.discountMax = String(Math.min(Math.round(calcMax * 100) / 100, ms));
        } else if (hasMs && hasDm) {
          // Max is source of truth → recalc Percentage
          const pct = (dm / ms) * 100;
          next.discountPercent = Math.min(Math.round(pct * 100) / 100, 90).toString();
        }
      } else if (field === 'discountPercent') {
        // Percentage changed → recalculate Max Discount
        if (hasMs && hasDp) {
          const calcMax = (ms * dp) / 100;
          next.discountMax = String(Math.min(Math.round(calcMax * 100) / 100, ms));
        }
      } else if (field === 'discountMax') {
        // Max Discount changed → recalculate Percentage
        if (hasMs && hasDm) {
          const pct = (dm / ms) * 100;
          next.discountPercent = Math.min(Math.round(pct * 100) / 100, 90).toString();
        }
      }
      return next;
    });

    // Clear errors on change
    setErrors((prev) => {
      const n = { ...prev };
      delete n[field];
      delete n.discountMax;
      delete n.discountPercent;
      delete n.minimumSpend;
      return n;
    });
    setShowStrength(true);
  };

  const toggleDay = (day: number) => {
    setForm((prev) => {
      const current = prev.daysOfWeek.split(',').filter(Boolean)
      const str = String(day)
      const next = current.includes(str)
        ? current.filter((d) => d !== str)
        : [...current, str].sort()
      return { ...prev, daysOfWeek: next.join(',') }
    })
    if (errors.daysOfWeek) {
      setErrors((prev) => {
        const n = { ...prev }
        delete n.daysOfWeek
        return n
      })
    }
  }

  const validate = (): boolean => {
    const errs: FormErrors = {};
    if (!form.title.trim()) errs.title = "Title is required";
    if (form.title.length < 5)
      errs.title = "Title must be at least 5 characters";
    if (!form.offerType) errs.offerType = "Offer type is required";
    if (!form.discountValue.trim())
      errs.discountValue = "Discount value is required";
    else if (
      isNaN(Number(form.discountValue)) ||
      Number(form.discountValue) <= 0
    )
      errs.discountValue = "Must be a positive number";
    if (!form.startDate.trim()) errs.startDate = "Start date is required";
    if (!form.endDate.trim()) errs.endDate = "End date is required";
    else if (
      form.startDate &&
      new Date(form.endDate) <= new Date(form.startDate)
    )
      errs.endDate = "End date must be after start date";
    if (isReplacement && !form.termsAndConditions.trim())
      errs.termsAndConditions =
        "Terms and conditions are required for replacement offers";

    // Days of week validation
    const selectedDays = form.daysOfWeek.split(',').filter(Boolean)
    if (selectedDays.length === 0) {
      errs.daysOfWeek = "Select at least one valid day"
    } else {
      const invalid = selectedDays.filter((d) => !DAYS_OF_WEEK.map((day) => String(day.value)).includes(d))
      if (invalid.length > 0) {
        errs.daysOfWeek = "Select at least one valid day"
      }
    }

    // Linked field validation
    if (form.minimumSpend.trim()) {
      const ms = Number(form.minimumSpend);
      if (isNaN(ms) || ms <= 0) errs.minimumSpend = "Must be greater than 0";
    }
    if (form.discountMax.trim()) {
      const dm = Number(form.discountMax);
      if (isNaN(dm) || dm <= 0) errs.discountMax = "Must be greater than 0";
      if (form.minimumSpend.trim() && dm > Number(form.minimumSpend))
        errs.discountMax = "Maximum discount cannot exceed minimum spend";
    }
    if (form.discountPercent.trim()) {
      const dp = Number(form.discountPercent);
      if (isNaN(dp) || dp < 1 || dp > 90) errs.discountPercent = "Must be between 1% and 90%";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const isUploading = uploadingCount > 0;
  
  const buildBody = (saveAsDraft = false): Record<string, unknown> => ({
    title: form.title,
    description: form.description,
    shortDescription: form.shortDescription || null,
    termsAndConditions: form.termsAndConditions || null,
    imageUrls: form.imageUrls,
    offerType: form.offerType,
    discountValue: Number(form.discountValue),
    discountMax: form.discountMax ? Number(form.discountMax) : null,
    discountPercent: form.discountPercent ? Number(form.discountPercent) : null,
    minimumSpend: form.minimumSpend ? Number(form.minimumSpend) : null,
    maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
    startDate: form.startDate,
    endDate: form.endDate,
    daysOfWeek: form.daysOfWeek
      .split(",")
      .map((s) => parseInt(s.trim()))
      .filter((n) => !isNaN(n)),
    redemptionCode: form.redemptionCode || null,
    redemptionInstructions: form.redemptionInstructions || null,
    categoryId: form.categoryId || null,
    submissionNotes: form.submissionNotes || null,
    replacementReason: isReplacement ? form.replacementReason || null : null,
    saveAsDraft,
    redemptionType: form.redemptionType || null,
    bookingUrl: form.bookingUrl || null,
    qrCodeUrl: form.qrCodeUrl || null,
    ...(isReplacement && currentLiveOffer
      ? { replacesOfferId: currentLiveOffer.id }
      : {}),
  });

  const handleSaveDraft = async () => {
    if (!form.title.trim()) {
      showToast({ type: "error", title: "Title is required to save a draft" });
      return;
    }
    if (isUploading) {
      showToast({
        type: "error",
        title: "Please wait for image uploads to complete",
      });
      return;
    }
    try {
      if (isEdit) {
        await updateOffer.mutateAsync({ id: offerId, ...buildBody(true) });
        showToast({ type: "success", title: "Draft saved" });
      } else {
        await createOffer.mutateAsync(buildBody(true));
        showToast({ type: "success", title: "Draft saved" });
      }
      router.push("/merchant/offers");
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Failed to save draft",
        description: err.message,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (isUploading) {
      showToast({
        type: "error",
        title: "Please wait for image uploads to complete",
      });
      return;
    }

    if (isEdit) {
      try {
        const result = await submitOffer.mutateAsync({
          id: offerId,
          ...buildBody(false),
        });
        if (result.qualityCheck === "PASSED") {
          showToast({ type: "success", title: "Offer submitted for review" });
        } else {
          showToast({
            type: "error",
            title: "Validation failed",
            description: "Fix the errors and resubmit",
          });
        }
        router.push("/merchant/offers");
      } catch (err: any) {
        showToast({
          type: "error",
          title: "Submission failed",
          description: err.message,
        });
      }
    } else {
      try {
        const result = await createOffer.mutateAsync(buildBody(false));
        if (result.qualityCheck === "PASSED") {
          showToast({
            type: "success",
            title: isReplacement
              ? "Replacement offer submitted for review"
              : "Offer submitted for review",
          });
        } else {
          showToast({
            type: "error",
            title: "Validation failed",
            description: "Fix the errors and resubmit",
          });
          if (result.validationErrors) {
            setErrors(result.validationErrors);
          }
        }
        router.push("/merchant/offers");
      } catch (err: any) {
        showToast({
          type: "error",
          title: "Failed to submit",
          description: err.message,
        });
      }
    }
  };

  const handleImagesReady = (images: PendingImage[]) => {
    setPendingImages((prev) => {
      const merged = [...prev];
      for (const img of images) {
        const idx = merged.findIndex((p) => p.id === img.id);
        if (idx >= 0) {
          merged[idx] = img;
        } else {
          merged.push(img);
        }
      }
      return merged;
    });

    const uploading = images.filter((i) => i.status === "uploading").length;
    const done = images.filter((i) => i.status === "done").length;
    const errors = images.filter((i) => i.status === "error").length;

    if (uploading > 0) {
      setUploadingCount((prev) => prev + uploading);
    }
    if (done > 0 || errors > 0) {
      setUploadingCount((prev) => Math.max(0, prev - (done + errors)));
    }

    const completedUrls = images
      .filter((i) => i.status === "done" && i.url)
      .map((i) => i.url!);
    if (completedUrls.length > 0) {
      setForm((prev) => {
        const existing = new Set(prev.imageUrls);
        const toAdd = completedUrls.filter((u) => !existing.has(u));
        if (toAdd.length === 0) return prev;
        return { ...prev, imageUrls: [...prev.imageUrls, ...toAdd] };
      });
    }
  };

  const handleRemoveImage = (id: string) => {
    setPendingImages((prev) => {
      const img = prev.find((p) => p.id === id);
      if (img?.url) {
        deleteOfferImage(img.url);
      }
      return prev.filter((p) => p.id !== id);
    });
    setForm((prev) => {
      const img = pendingImages.find((p) => p.id === id);
      if (img?.url) {
        return {
          ...prev,
          imageUrls: prev.imageUrls.filter((u) => u !== img.url),
        };
      }
      return prev;
    });
  };

  const handleMoveUp = (id: string) => {
    setPendingImages((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      const temp = next[idx]!;
      next[idx] = next[idx - 1]!;
      next[idx - 1] = temp;
      return next;
    });
    setForm((prev) => {
      const idx = prev.imageUrls.findIndex((u) => {
        const img = pendingImages.find((p) => p.id === id);
        return img?.url === u;
      });
      if (idx <= 0) return prev;
      const next = [...prev.imageUrls];
      const temp = next[idx]!;
      next[idx] = next[idx - 1]!;
      next[idx - 1] = temp;
      return { ...prev, imageUrls: next };
    });
  };

  const handleMoveDown = (id: string) => {
    setPendingImages((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      const temp = next[idx]!;
      next[idx] = next[idx + 1]!;
      next[idx + 1] = temp;
      return next;
    });
    setForm((prev) => {
      const idx = prev.imageUrls.findIndex((u) => {
        const img = pendingImages.find((p) => p.id === id);
        return img?.url === u;
      });
      if (idx < 0 || idx >= prev.imageUrls.length - 1) return prev;
      const next = [...prev.imageUrls];
      const temp = next[idx]!;
      next[idx] = next[idx + 1]!;
      next[idx + 1] = temp;
      return { ...prev, imageUrls: next };
    });
  };

  const categoryName = form.categoryId
    ? categories?.find((c) => c.id === form.categoryId)?.name
    : undefined;

  const labelClass = "text-sm font-medium";
  const inputClass = "w-full";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => router.push("/merchant/offers")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isReplacement
              ? "Replace My Offer"
              : isEdit
                ? "Edit Offer"
                : "Create Offer"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isReplacement
              ? "Submit a replacement offer for review. Your current offer stays live until approved."
              : isEdit
                ? "Update your offer details"
                : "Create a new discount offer"}
          </p>
        </div>
      </div>

      {isReplacement && currentLiveOffer && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="p-4 text-sm">
            <p className="font-medium">
              Replacing:{" "}
              <span className="text-blue-600">{currentLiveOffer.title}</span>
            </p>
            <p className="text-muted-foreground mt-1">
              Your current live offer will remain visible to employees until the
              replacement is approved.
            </p>
          </CardContent>
        </Card>
      )}

      {isReplacement && (
        <Card>
          <CardHeader>
            <CardTitle>Replacement Details</CardTitle>
          </CardHeader>
          <CardContent>
            <label className={labelClass}>Reason for replacement</label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={form.replacementReason}
              onChange={set("replacementReason")}
              placeholder="Why are you replacing your current offer? (shown to admins during review)"
              maxLength={1000}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {form.replacementReason.length}/1000
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left column — form fields */}
        <div className="space-y-6 lg:col-span-1">
          <form onSubmit={handleSubmit}>
            <Card>
              <CardHeader>
                <CardTitle>Offer Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className={labelClass}>Title *</label>
                  <Input
                    className={inputClass}
                    value={form.title}
                    onChange={set("title")}
                    placeholder="e.g. 20% Off All Menu Items"
                    maxLength={255}
                  />
                  {errors.title && (
                    <p className="mt-1 text-xs text-destructive">
                      {errors.title}
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelClass}>Short Description</label>
                  <Input
                    className={inputClass}
                    value={form.shortDescription}
                    onChange={set("shortDescription")}
                    placeholder="Brief description (max 500 chars)"
                    maxLength={500}
                  />
                </div>

                <div>
                  <label className={labelClass}>Description</label>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={form.description}
                    onChange={set("description")}
                    placeholder="Full offer description"
                    maxLength={2000}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Category</label>
                    <select
                      name="category"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      value={form.categoryId}
                      onChange={set("categoryId")}
                    >
                      <option value="">Select category</option>
                      {(categories ?? []).map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>Offer Type *</label>
                    <select
                      name="offerType"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      value={form.offerType}
                      onChange={set("offerType")}
                    >
                      <option value="FLAT">Flat Amount</option>
                      <option value="PERCENTAGE">Percentage</option>
                      <option value="BUY_X_GET_Y">Buy X Get Y</option>
                    </select>
                  </div>
                </div>

                {/* Redemption Type Selection */}
                <div>
                  <label className={labelClass}>Redemption Type</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    value={form.redemptionType}
                    onChange={set("redemptionType")}
                    name="redemptionType"
                  >
                    <option value="IN_STORE_QR">In-Store QR Code</option>
                    <option value="ONLINE_CODE">Online Code</option>
                    <option value="BOOKING_LINK">Booking Link</option>
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {form.redemptionType === 'ONLINE_CODE' && 'Employee gets a code to enter on merchant website'}
                    {form.redemptionType === 'BOOKING_LINK' && 'Employee is redirected to merchant booking page'}
                    {form.redemptionType === 'IN_STORE_QR' && 'Employee shows QR code at merchant location'}
                  </p>
                </div>

                {/* Redemption Type Specific Fields */}
                {form.redemptionType === 'ONLINE_CODE' && (
                  <Card className="bg-muted/30">
                    <CardHeader>
                      <CardTitle className="text-sm">Online Code Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className={labelClass}>Booking URL *</label>
                        <Input
                          className={inputClass}
                          value={form.bookingUrl}
                          onChange={set("bookingUrl")}
                          placeholder="https://merchant-website.com/offer"
                          type="url"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Where employees will be directed to use their code
                        </p>
                      </div>
                      <div>
                        <label className={labelClass}>Offer Code</label>
                        <Input
                          className={inputClass}
                          value={form.redemptionCode}
                          onChange={set("redemptionCode")}
                          placeholder="Auto-generated if empty"
                          maxLength={6}
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          6-character alphanumeric code. Leave empty to auto-generate.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {form.redemptionType === 'BOOKING_LINK' && (
                  <Card className="bg-muted/30">
                    <CardHeader>
                      <CardTitle className="text-sm">Booking Link Configuration</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div>
                        <label className={labelClass}>Booking URL *</label>
                        <Input
                          className={inputClass}
                          value={form.bookingUrl}
                          onChange={set("bookingUrl")}
                          placeholder="https://booking-system.com/offers/..."
                          type="url"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Direct link to merchant booking system
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {form.redemptionType === 'IN_STORE_QR' && (
                  <Card className="bg-muted/30">
                    <CardHeader>
                      <CardTitle className="text-sm">In-Store QR Configuration</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        A unique QR code will be generated for this offer. Employees will scan it at the merchant location to receive their redemption code.
                      </p>
                    </CardContent>
                  </Card>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Discount Value *</label>
                    <Input
                      className={inputClass}
                      type="number"
                      step="0.01"
                      value={form.discountValue}
                      onChange={set("discountValue")}
                      placeholder="e.g. 5.00"
                    />
                    {errors.discountValue && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.discountValue}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Discount Max</label>
                    <Input
                      className={inputClass}
                      type="number"
                      step="0.01"
                      value={form.discountMax}
                      onChange={(e) => handleLinkedFieldChange("discountMax", e.target.value)}
                      placeholder="Maximum discount amount"
                    />
                    {errors.discountMax && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.discountMax}
                      </p>
                    )}
                  </div>
                </div>

                {showStrength &&
                  form.discountValue &&
                  Number(form.discountValue) > 0 && (
                    <OfferStrengthIndicator
                      discountValue={Number(form.discountValue)}
                      offerType={form.offerType}
                      categoryId={form.categoryId || null}
                      minimumSpend={form.minimumSpend ? Number(form.minimumSpend) : undefined}
                      discountMax={form.discountMax ? Number(form.discountMax) : undefined}
                    />
                  )}

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className={labelClass}>Discount Percent</label>
                    <Input
                      className={inputClass}
                      type="number"
                      value={form.discountPercent}
                      onChange={(e) => handleLinkedFieldChange("discountPercent", e.target.value)}
                      placeholder="e.g. 20"
                    />
                    {errors.discountPercent && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.discountPercent}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Minimum Spend</label>
                    <Input
                      className={inputClass}
                      type="number"
                      step="0.01"
                      value={form.minimumSpend}
                      onChange={(e) => handleLinkedFieldChange("minimumSpend", e.target.value)}
                      placeholder="Minimum order amount"
                    />
                    {errors.minimumSpend && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.minimumSpend}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Max Redemptions</label>
                    <Input
                      className={inputClass}
                      type="number"
                      value={form.maxRedemptions}
                      onChange={set("maxRedemptions")}
                      placeholder="Unlimited if empty"
                    />
                  </div>
                </div>

                {/* Campaign Liability Summary */}
                {form.minimumSpend && form.discountMax && form.maxRedemptions && (
                  <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
                    <h4 className="text-xs font-semibold text-muted-foreground">Campaign Liability Estimate</h4>
                    <p className="text-sm font-medium">
                      Total potential payout: ${(
                        Number(form.discountMax) * Number(form.maxRedemptions)
                      ).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Based on max {form.maxRedemptions} redemptions × ${Number(form.discountMax).toFixed(2)} max discount
                    </p>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Start Date *</label>
                    <Input
                      className={inputClass}
                      type="datetime-local"
                      value={form.startDate}
                      onChange={set("startDate")}
                    />
                    {errors.startDate && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.startDate}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>End Date *</label>
                    <Input
                      className={inputClass}
                      type="datetime-local"
                      value={form.endDate}
                      onChange={set("endDate")}
                    />
                    {errors.endDate && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.endDate}
                      </p>
                    )}
                  </div>
                </div>

                {/* Days of Week */}
                <div>
                  <label className={labelClass}>Available Days</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((day) => {
                      const selected = form.daysOfWeek
                        .split(',')
                        .map((s) => s.trim())
                        .includes(String(day.value))
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleDay(day.value)}
                          className={`
                            rounded-full px-3 py-1.5 text-xs font-medium transition-colors
                            ${selected
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }
                          `}
                        >
                          {day.short}
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(() => {
                      const sel = form.daysOfWeek.split(',').filter(Boolean)
                      if (sel.length === 7) return 'Every day'
                      return sel.map((s) => DAYS_OF_WEEK.find((d) => d.value === Number(s))?.short).join(' • ')
                    })()}
                  </p>
                  {errors.daysOfWeek && (
                    <p className="mt-1 text-xs text-destructive">
                      {errors.daysOfWeek}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Offer Banner</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <OfferImageUploader
                  onImagesReady={handleImagesReady}
                  disabled={isUploading}
                  currentCount={pendingImages.length}
                />

                <OfferImageGallery
                  images={pendingImages}
                  onRemove={handleRemoveImage}
                  onMoveUp={handleMoveUp}
                  onMoveDown={handleMoveDown}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Redemption & Terms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className={labelClass}>Redemption Instructions</label>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={form.redemptionInstructions}
                    onChange={set("redemptionInstructions")}
                    placeholder="Instructions for redeeming this offer"
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Terms & Conditions {isReplacement && "*"}
                  </label>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={form.termsAndConditions}
                    onChange={set("termsAndConditions")}
                    placeholder="Terms and conditions"
                  />
                  {errors.termsAndConditions && (
                    <p className="mt-1 text-xs text-destructive">
                      {errors.termsAndConditions}
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelClass}>Submission Notes</label>
                  <textarea
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={form.submissionNotes}
                    onChange={set("submissionNotes")}
                    placeholder="Any notes for the review team"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              {isReplacement || (!isEdit && !offerId) ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveDraft}
                    disabled={
                      isUploading ||
                      createOffer.isPending ||
                      updateOffer.isPending
                    }
                  >
                    {createOffer.isPending ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-1 h-4 w-4" />
                    )}
                    Save as Draft
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      isUploading ||
                      createOffer.isPending ||
                      submitOffer.isPending
                    }
                  >
                    {submitOffer.isPending ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-1 h-4 w-4" />
                    )}
                    {submitOffer.isPending
                      ? "Submitting..."
                      : isReplacement
                        ? "Submit Replacement"
                        : "Submit for Review"}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="submit"
                    disabled={
                      isUploading ||
                      updateOffer.isPending ||
                      submitOffer.isPending
                    }
              
                  >
                    {updateOffer.isPending ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-1 h-4 w-4" />
                    )}
                    {updateOffer.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/merchant/offers")}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>

        {/* Right column — preview panel */}
        <div className="space-y-6 lg:col-span-1">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <Card>
              <CardHeader>
                <CardTitle>Mobile Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <OfferMobilePreview
                  title={form.title}
                  shortDescription={form.shortDescription}
                  description={form.description}
                  discountValue={form.discountValue}
                  offerType={form.offerType}
                  startDate={form.startDate}
                  endDate={form.endDate}
                  imageUrls={form.imageUrls}
                  isFeatured={false}
                  isExclusive={false}
                  merchantName="Your Business"
                  categoryName={categoryName}
                />
              </CardContent>
            </Card>

            <div className="mt-6">
              <OfferBannerInfo imageUrls={form.imageUrls} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
