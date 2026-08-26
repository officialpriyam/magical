'use client'

import { useState, useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, CreditCard, Building2, MapPin } from 'lucide-react'

const billingFormSchema = z.object({
  // Company Information
  companyName: z.string().min(1, 'Company name is required'),
  companyEmail: z.string().email('Valid email is required'),
  taxId: z.string().optional(),
  
  // Billing Address
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State/Province is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().min(1, 'Country is required'),
  
  // Payment Information
  paymentMethod: z.enum(['card', 'bank_transfer', 'invoice'], {
    required_error: 'Please select a payment method',
  }),
  
  // Billing Cycle
  billingCycle: z.enum(['monthly', 'annual'], {
    required_error: 'Please select a billing cycle',
  }),
})

type BillingFormData = z.infer<typeof billingFormSchema>

interface BillingFormProps {
  onSubmit?: (data: BillingFormData) => Promise<void>
  defaultValues?: Partial<BillingFormData>
  isLoading?: boolean
}

export function BillingForm({ onSubmit, defaultValues, isLoading = false }: BillingFormProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(false)

  const form = useForm<BillingFormData>({
    resolver: zodResolver(billingFormSchema),
    defaultValues: {
      companyName: '',
      companyEmail: '',
      taxId: '',
      address: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'US',
      paymentMethod: 'card',
      billingCycle: 'monthly',
      ...defaultValues,
    },
  })

  // Load existing billing data
  useEffect(() => {
    const loadBillingData = async () => {
      setIsLoadingData(true)
      try {
        const response = await fetch('/api/stripe/billing')
        if (response.ok) {
          const { billingInfo } = await response.json()
          if (billingInfo) {
            form.reset({
              companyName: billingInfo.name || '',
              companyEmail: billingInfo.email || '',
              taxId: billingInfo.tax_id || '',
              address: billingInfo.address?.line1 || '',
              city: billingInfo.address?.city || '',
              state: billingInfo.address?.state || '',
              postalCode: billingInfo.address?.postal_code || '',
              country: billingInfo.address?.country || 'US',
            })
          }
        }
      } catch (error) {
        console.error('Error loading billing data:', error)
      } finally {
        setIsLoadingData(false)
      }
    }

    loadBillingData()
  }, [form])

  const handleSubmit = async (data: BillingFormData) => {
    if (onSubmit) {
      setIsSubmitting(true)
      try {
        await onSubmit(data)
        toast({
          title: 'Billing information updated',
          description: 'Your billing details have been successfully saved.',
        })
      } catch (error) {
        console.error('Form submission error:', error)
        toast({
          title: 'Error',
          description: 'Failed to update billing information. Please try again.',
          variant: 'destructive',
        })
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  const countries = [
    { value: 'US', label: 'United States' },
    { value: 'CA', label: 'Canada' },
    { value: 'GB', label: 'United Kingdom' },
    { value: 'DE', label: 'Germany' },
    { value: 'FR', label: 'France' },
    { value: 'AU', label: 'Australia' },
    { value: 'JP', label: 'Japan' },
    { value: 'SG', label: 'Singapore' },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Billing Information
        </CardTitle>
        <CardDescription>
          Update your billing details and payment preferences
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Company Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Building2 className="h-4 w-4" />
              Company Information
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  {...form.register('companyName')}
                  placeholder="Your Company Inc."
                />
                {form.formState.errors.companyName && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.companyName.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyEmail">Company Email *</Label>
                <Input
                  id="companyEmail"
                  type="email"
                  {...form.register('companyEmail')}
                  placeholder="billing@yourcompany.com"
                />
                {form.formState.errors.companyEmail && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.companyEmail.message}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxId">Tax ID / VAT Number (Optional)</Label>
              <Input
                id="taxId"
                {...form.register('taxId')}
                placeholder="123-45-6789"
              />
            </div>
          </div>

          {/* Billing Address */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="h-4 w-4" />
              Billing Address
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Street Address *</Label>
                <Input
                  id="address"
                  {...form.register('address')}
                  placeholder="123 Main Street"
                />
                {form.formState.errors.address && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.address.message}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    {...form.register('city')}
                    placeholder="San Francisco"
                  />
                  {form.formState.errors.city && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.city.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State/Province *</Label>
                  <Input
                    id="state"
                    {...form.register('state')}
                    placeholder="CA"
                  />
                  {form.formState.errors.state && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.state.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Postal Code *</Label>
                  <Input
                    id="postalCode"
                    {...form.register('postalCode')}
                    placeholder="94105"
                  />
                  {form.formState.errors.postalCode && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.postalCode.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country *</Label>
                <Select
                  value={form.watch('country')}
                  onValueChange={(value) => form.setValue('country', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((country) => (
                      <SelectItem key={country.value} value={country.value}>
                        {country.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.country && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.country.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Payment Preferences */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CreditCard className="h-4 w-4" />
              Payment Preferences
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method *</Label>
                <Select
                  value={form.watch('paymentMethod')}
                  onValueChange={(value) => form.setValue('paymentMethod', value as 'card' | 'bank_transfer' | 'invoice')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="card">Credit/Debit Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="invoice">Invoice (Enterprise)</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.paymentMethod && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.paymentMethod.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingCycle">Billing Cycle *</Label>
                <Select
                  value={form.watch('billingCycle')}
                  onValueChange={(value) => form.setValue('billingCycle', value as 'monthly' | 'annual')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select billing cycle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="annual">Annual (Save 10%)</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.billingCycle && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.billingCycle.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isLoading || isSubmitting || isLoadingData}
              className="w-full md:w-auto"
            >
              {(isLoading || isSubmitting || isLoadingData) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isLoadingData ? 'Loading...' : isSubmitting ? 'Saving...' : 'Save Billing Information'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
