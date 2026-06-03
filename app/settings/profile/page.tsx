'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'
import { Sparkles, Zap, Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAuthContext } from '@/lib/auth-provider'
import { 
  getUserProfile, 
  updateUserProfile, 
  updateUserPreferences,
  getUserPreferences
} from '@/lib/user-settings'
import { UserPreferences } from '@/lib/database.types'


export default function ProfileSettings() {
  const { session } = useAuthContext()
  const { toast } = useToast()
  
  const [fullName, setFullName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [workDescription, setWorkDescription] = useState('')
  const [aiAssistance, setAiAssistance] = useState(true)
  const [smartSuggestions, setSmartSuggestions] = useState(false)
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUpdatingPreferences, setIsUpdatingPreferences] = useState(false)

  useEffect(() => {
    if (!session?.user?.id) return

    const loadUserData = async () => {
      setIsLoading(true)
      try {
        const [profile, preferences] = await Promise.all([
          getUserProfile(session.user.id),
          getUserPreferences(session.user.id)
        ])

        if (profile) {
          setFullName(profile.full_name || '')
          setDisplayName(profile.display_name || '')
          setWorkDescription(profile.work_description || '')
        }

        if (preferences) {
          setAiAssistance(preferences.ai_assistance ?? false)
          setSmartSuggestions(preferences.smart_suggestions ?? false)
        }
      } catch (error) {
        console.error('Error loading user data:', error)
        toast({
          title: "Error",
          description: "Failed to load profile data. Please refresh the page.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadUserData()
  }, [session?.user?.id, toast])

  const handleSaveProfile = async () => {
    if (!session?.user?.id) return

    setIsSaving(true)
    try {
      const success = await updateUserProfile(session.user.id, {
        full_name: fullName,
        display_name: displayName,
        work_description: workDescription
      })

      if (success) {
        toast({
          title: "Success",
          description: "Profile information updated successfully.",
        })
      } else {
        throw new Error('Failed to update profile')
      }
    } catch (error) {
      console.error('Error saving profile:', error)
      toast({
        title: "Error",
        description: "Failed to save profile information. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdatePreference = async (key: keyof UserPreferences, value: boolean) => {
    if (!session?.user?.id) return

    setIsUpdatingPreferences(true)
    try {
      const success = await updateUserPreferences(session.user.id, {
        [key]: value
      })

      if (success) {
        if (key === 'ai_assistance') setAiAssistance(value)
        if (key === 'smart_suggestions') setSmartSuggestions(value)
        
        toast({
          title: "Success",
          description: "Preference updated successfully.",
        })
      } else {
        throw new Error('Failed to update preference')
      }
    } catch (error) {
      console.error('Error updating preference:', error)
      toast({
        title: "Error",
        description: "Failed to update preference. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUpdatingPreferences(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-medium">Profile</h2>
          <p className="text-sm text-muted-foreground">
            Manage your personal information and preferences.
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Profile</h2>
        <p className="text-sm text-muted-foreground">
          Manage your personal information and preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>
            Update your personal details here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
              id="fullName"
              placeholder="Enter your full name"
              value={fullName || session?.user?.user_metadata?.full_name || ''}
              onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="displayName">What should we call you?</Label>
              <Input
              id="displayName"
              placeholder="Your preferred name"
              value={displayName || session?.user?.user_metadata?.name || session?.user?.user_metadata?.display_name || ''}
              onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            </div>

            <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">User Metadata</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
              <Label>User ID</Label>
              <Input value={session?.user?.id || ''} readOnly className="bg-muted" />
              </div>
              
              <div className="space-y-2">
              <Label>Email</Label>
              <Input value={session?.user?.email || ''} readOnly className="bg-muted" />
              </div>
              
              <div className="space-y-2">
              <Label>Account Created</Label>
              <Input 
                value={session?.user?.created_at ? new Date(session.user.created_at).toLocaleDateString() : ''} 
                readOnly 
                className="bg-muted" 
              />
              </div>
              
              <div className="space-y-2">
              <Label>Last Updated</Label>
              <Input 
                value={session?.user?.updated_at ? new Date(session.user.updated_at).toLocaleDateString() : ''} 
                readOnly 
                className="bg-muted" 
              />
              </div>
            </div>
            </div>

          <div className="space-y-2">
            <Label htmlFor="workDescription">What best describes your work?</Label>
            <Select value={workDescription} onValueChange={setWorkDescription}>
              <SelectTrigger>
                <SelectValue placeholder="Select your role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="developer">Software Developer</SelectItem>
                <SelectItem value="designer">UI/UX Designer</SelectItem>
                <SelectItem value="product-manager">Product Manager</SelectItem>
                <SelectItem value="data-scientist">Data Scientist</SelectItem>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="entrepreneur">Entrepreneur</SelectItem>
                <SelectItem value="researcher">Researcher</SelectItem>
                <SelectItem value="consultant">Consultant</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end">
            <Button 
              onClick={handleSaveProfile}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save changes
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div>
        <h3 className="text-lg font-medium mb-4">Features</h3>
        <div className="space-y-4">
          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-medium">AI Code Assistance</h4>
                  <p className="text-sm text-muted-foreground">
                    Get intelligent code suggestions and explanations while you build your applications.
                  </p>
                </div>
              </div>
              <Switch
                checked={aiAssistance}
                onCheckedChange={(checked) => handleUpdatePreference('ai_assistance', checked)}
                disabled={isUpdatingPreferences}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-medium">Smart Suggestions</h4>
                  <p className="text-sm text-muted-foreground">
                    Receive contextual suggestions for templates, components, and optimization opportunities.
                  </p>
                </div>
              </div>
              <Switch
                checked={smartSuggestions}
                onCheckedChange={(checked) => handleUpdatePreference('smart_suggestions', checked)}
                disabled={isUpdatingPreferences}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
