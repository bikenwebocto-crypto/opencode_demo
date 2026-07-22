"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Star,
  Store,
  Sparkles,
  Gift,
  Tag,
} from "lucide-react";
import { SaveButton } from "./SaveButton";
import { type EmployeeOffer } from "./offers/employee-offer";

/**
 * @deprecated Use `EmployeeOffer` from `@/components/employee/offers/employee-offer`.
 * This alias is kept for backward-compat with existing call sites.
 */
export type OfferCardData = EmployeeOffer;

function getFlatOfferCard(offer: EmployeeOffer) {
  return {
    ...offer,
    imageUrls: offer.imageUrls ?? [],
  };
}

const TYPE_LABELS: Record<string, string> = {
  FLAT: "Flat",
  PERCENTAGE: "% Off",
  BUY_X_GET_Y: "BOGO",
  fixed_amount: "Fixed",
  percentage: "% Off",
  flat_rate: "Flat",
  buy_x_get_y: "BOGO",
};

function getBadgeColor(offerType: string): string {
  if (offerType === "PERCENTAGE" || offerType === "percentage")
    return "bg-purple-100 text-purple-800";
  if (offerType === "BUY_X_GET_Y" || offerType === "buy_x_get_y")
    return "bg-pink-100 text-pink-800";
  if (
    offerType === "FLAT" ||
    offerType === "flat_rate" ||
    offerType === "fixed_amount"
  )
    return "bg-orange-100 text-orange-800";
  return "bg-blue-100 text-blue-800";
}

interface Props {
  offer: EmployeeOffer;
  onRedeem?: (offer: EmployeeOffer) => void;
  /**
   * Called when the user taps anywhere on the card body.
   * The card itself is no longer a navigation link — it opens the
   * `RedeemModal` owned by the parent page.
   *
   * The FULL offer is passed; the modal does not refetch.
   */
  onOpen?: (offer: EmployeeOffer) => void;
}

export function OfferCard({ offer, onRedeem, onOpen }: Props) {
  const flatOffer = getFlatOfferCard(offer);

  const initials =
    flatOffer.merchant?.businessName
      .split(" ")
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() ?? "";

  const bannerImage =
    flatOffer.imageUrls.length > 0 ? flatOffer.imageUrls[0] : "";

  const discountLabel = () => {
    switch (flatOffer.offerType) {
      case "percentage":
      case "PERCENTAGE":
        return `${Number(flatOffer.discountValue)}% OFF`;
      case "buy_x_get_y":
      case "BUY_X_GET_Y":
        return "Buy X Get Y";
      case "flat_rate":
      case "fixed_amount":
      case "FLAT":
        return `£${Number(flatOffer.discountValue).toFixed(2)} OFF`;
      default:
        return "";
    }
  };

  // Open the details dialog when the user taps anywhere on the card,
  // except for interactive children (save button, redeem button) which
  // call `stopPropagation` themselves.
  const handleOpen = () => onOpen?.(offer);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onOpen) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(offer);
    }
  };

  return (
    <Card
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      aria-label={onOpen ? `View details for ${offer.title}` : undefined}
      onClick={onOpen ? handleOpen : undefined}
      onKeyDown={onOpen ? handleKeyDown : undefined}
      className={`relative overflow-hidden transition-shadow ${
        onOpen ? "cursor-pointer hover:shadow-md" : ""
      }`}
    >
      {/* Image Section - Full width */}
      <div className="relative w-full aspect-[16/9] bg-gradient-to-br from-primary/10 to-primary/5">
        {bannerImage ? (
          <img
            src={bannerImage}
            alt={offer.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Gift className="h-16 w-16 text-muted-foreground/30" />
          </div>
        )}

        {/* Badges - Overlay on image */}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {(offer?.isFeatured || offer?.isExclusive) && (
            <>
              {offer.isFeatured && (
                <Badge variant="default" className="text-[10px] shadow-md">
                  <Star className="mr-0.5 h-3 w-3" /> Featured
                </Badge>
              )}
              {offer.isExclusive && (
                <Badge variant="secondary" className="text-[10px] shadow-md">
                  <Sparkles className="mr-0.5 h-3 w-3" /> Exclusive
                </Badge>
              )}
            </>
          )}
        </div>

        {/* Save Button - Top right. Stops propagation so it does NOT
            open the details dialog when clicked. */}
        <div
          className="absolute right-3 top-3"
          onClick={(e) => e.stopPropagation()}
        >
          <SaveButton
            offerId={offer.id}
            initialSaved={offer.isSaved ?? false}
            size="sm"
          />
        </div>

        {/* Redemption Type Badge */}
        {offer.redemptionType && (
          <div className="absolute right-3 top-12">
            <Badge
              variant="secondary"
              className="text-[10px] shadow-md bg-white/90 text-foreground"
            >
              {offer.redemptionType === "IN_STORE_QR"
                ? "In-Store"
                : offer.redemptionType === "ONLINE_CODE"
                  ? "Online"
                  : offer.redemptionType === "BOOKING_LINK"
                    ? "Booking"
                    : offer.redemptionType}
            </Badge>
          </div>
        )}

        {/* Discount Badge - Bottom right */}
        {discountLabel() && (
          <div className="absolute bottom-3 right-3 rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground shadow-lg">
            {discountLabel()}
          </div>
        )}

        {/* Offer Type Badge - Bottom left */}
        <div className="absolute bottom-3 left-3">
          <Badge
            variant="secondary"
            className={`text-[10px] shadow-md ${getBadgeColor(offer.offerType)}`}
          >
            {TYPE_LABELS[offer.offerType] ?? offer.offerType}
          </Badge>
        </div>
      </div>

      {/* Content Section */}
      <CardContent className="p-4 space-y-3">
        {/* Merchant Info */}
        <div className="flex items-center gap-3">
          {offer.merchant?.logoUrl ? (
            <img
              src={offer.merchant.logoUrl}
              alt={offer.merchant.businessName}
              className="h-10 w-10 rounded-full border object-cover flex-shrink-0"
            />
          ) : (
            <div
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${getBadgeColor(offer.offerType)} text-sm font-bold`}
            >
              {initials || <Store className="h-4 w-4" />}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-sm">
              {offer.merchant?.businessName ?? "—"}
            </p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <span>
                {Number(offer.merchant?.averageRating ?? 0).toFixed(1)}
              </span>
              <span className="ml-1">·</span>
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">
                {offer.merchant?.city ?? "—"}
                {offer.merchant?.state ? `, ${offer.merchant.state}` : ""}
              </span>
            </div>
          </div>
        </div>

        {/* Title — no longer a link, but still styled to look tappable. */}
        <p className="line-clamp-2 text-sm font-medium">
          {offer.title}
        </p>

        {/* Description */}
        {offer.shortDescription && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {offer.shortDescription}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-xs text-muted-foreground">
            Expires {new Date(offer.endDate).toLocaleDateString()}
          </span>
          {offer.isRedeemed ? (
            <Button size="sm" variant="outline" disabled className="text-xs">
              Already Redeemed
            </Button>
          ) : onRedeem ? (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onRedeem(offer)
              }}
              className="text-xs"
            >
              <Tag className="mr-1 h-3 w-3" /> Redeem
            </Button>
          ) : (
            <span className="text-xs text-primary">View details →</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
