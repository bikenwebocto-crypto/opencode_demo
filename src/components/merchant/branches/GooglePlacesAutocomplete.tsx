'use client'

import { useRef } from 'react'
import { useJsApiLoader, Autocomplete } from '@react-google-maps/api'
import { Input } from '@/components/ui/input'
import { Loader2, AlertCircle } from 'lucide-react'

const libraries: ('places')[] = ['places']

export interface PlaceResult {
  addressLine1: string
  city: string
  state: string
  country: string
  postalCode: string
  latitude: number
  longitude: number
  formattedAddress: string
}

interface GooglePlacesAutocompleteProps {
  onPlaceSelected: (place: PlaceResult) => void
  disabled?: boolean
}

function extractAddressComponent(
  components: google.maps.GeocoderAddressComponent[],
  type: string
): string {
  return components.find((c) => c.types.includes(type))?.long_name ?? ''
}

export function GooglePlacesAutocomplete({ onPlaceSelected, disabled }: GooglePlacesAutocompleteProps) {
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-maps-places',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
    libraries,
  })

  function handlePlaceChanged() {
    const place = autocompleteRef.current?.getPlace()
    if (!place?.address_components || !place?.geometry?.location) return

    const components = place.address_components
    const streetNumber = extractAddressComponent(components, 'street_number')
    const route = extractAddressComponent(components, 'route')
    const addressLine1 = [streetNumber, route].filter(Boolean).join(' ')
    const city =
      extractAddressComponent(components, 'locality') ||
      extractAddressComponent(components, 'sublocality') ||
      extractAddressComponent(components, 'administrative_area_level_2')
    const state = extractAddressComponent(components, 'administrative_area_level_1')
    const country = extractAddressComponent(components, 'country')
    const postalCode = extractAddressComponent(components, 'postal_code')
    const lat = place.geometry.location.lat()
    const lng = place.geometry.location.lng()

    onPlaceSelected({
      addressLine1,
      city,
      state,
      country,
      postalCode,
      latitude: Number(lat.toFixed(7)),
      longitude: Number(lng.toFixed(7)),
      formattedAddress: place.formatted_address ?? '',
    })
  }

  if (loadError) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
        <AlertCircle className="h-3 w-3" />
        Failed to load Google Maps. Check your API key.
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-muted/30 p-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading address search…
      </div>
    )
  }

  return (
    <Autocomplete
      onLoad={(autocomplete) => {
        autocompleteRef.current = autocomplete
      }}
      onPlaceChanged={handlePlaceChanged}
      fields={['address_components', 'geometry', 'formatted_address']}
      types={['address']}
    >
      <Input placeholder="Search address or place…" disabled={disabled} />
    </Autocomplete>
  )
}
