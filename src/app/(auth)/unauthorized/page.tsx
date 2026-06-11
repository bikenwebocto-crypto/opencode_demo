'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShieldAlert } from 'lucide-react'

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <ShieldAlert className="h-5 w-5 text-destructive" /> Unauthorized
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You do not have permission to view this page.
          </p>
          <div className="flex gap-2">
            <Link href="/login">
              <Button variant="outline">Sign in with another account</Button>
            </Link>
            <Link href="/">
              <Button>Go home</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
