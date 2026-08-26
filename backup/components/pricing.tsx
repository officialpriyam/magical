"use client"

import { PricingCard } from "@/components/ui/pricing-card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

interface PricingModalProps {
  isOpen: boolean
  onClose: () => void
}

export function PricingModal({ isOpen, onClose }: PricingModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl">
        <DialogHeader className="text-left md:text-center">
          <DialogTitle className="mb-3 text-3xl font-semibold md:mb-4 lg:mb-6 lg:text-4xl">
            Plans made for every developer
          </DialogTitle>
          <DialogDescription className="text-muted-foreground lg:text-lg mb-6 md:mb-8 lg:mb-12">
            Start building with our powerful tools. Upgrade anytime as your needs grow.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl flex flex-col justify-between border p-1">
          <div className="flex flex-col gap-4 md:flex-row">
            <PricingCard
              title="Free / Open Source"
              price="$0 / forever"
              description="Perfect for individual developers and open source projects."
              buttonText="Current Plan"
              buttonVariant="outline"
              features={[
                "Unlimited code generation",
                "All AI models included",
                "Community support",
                "Self-hosted deployment",
                "GitHub integration",
                "Open source license",
              ]}
            />

            <PricingCard
              title="Pro Developer"
              price="$9.99 / month"
              description="Enhanced features for professional developers and teams."
              buttonText="Start Pro Trial"
              buttonVariant="default"
              features={[
                "Advanced AI models (GPT-4, Claude)",
                "Priority code generation",
                "Private cloud hosting",
                "Advanced debugging tools",
                "Custom component libraries",
                "Priority support",
                "Team collaboration",
                "Usage analytics",
              ]}
            />

            <PricingCard
              title="Enterprise"
              price="Custom / month"
              description="Custom solutions for large development teams and organizations."
              buttonText="Contact Sales"
              buttonVariant="default"
              highlight
              badge="Most Popular"
              features={[
                "Custom AI model fine-tuning",
                "On-premises deployment",
                "SSO & enterprise security",
                "Dedicated support manager",
                "Custom integrations",
                "SLA guarantees",
                "White-label options",
                "Custom training & onboarding",
              ]}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
