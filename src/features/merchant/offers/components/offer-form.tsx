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
                      onChange={set("discountMax")}
                      placeholder="Maximum discount amount"
                    />
                  </div>
                </div>

                {showStrength &&
                  form.discountValue &&
                  Number(form.discountValue) > 0 && (
                    <OfferStrengthIndicator
                      discountValue={Number(form.discountValue)}
                      offerType={form.offerType}
                      categoryId={form.categoryId || null}
                    />
                  )}

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className={labelClass}>Discount Percent</label>
                    <Input
                      className={inputClass}
                      type="number"
                      value={form.discountPercent}
                      onChange={set("discountPercent")}
                      placeholder="e.g. 20"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Minimum Spend</label>
                    <Input
                      className={inputClass}
                      type="number"
                      step="0.01"
                      value={form.minimumSpend}
                      onChange={set("minimumSpend")}
                      placeholder="Minimum order amount"
                    />
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
