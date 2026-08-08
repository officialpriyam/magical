'use client'

import { useState } from 'react'
import { Search, ChevronDown, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface Connector {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  category: string[]
  connected?: boolean
  active?: boolean
  upcoming?: boolean
  isNew?: boolean
}

const connectors: Connector[] = [
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Open source Firebase alternative with Postgres',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M13.7 21.8c-.3.3-.8.1-.8-.3V13h8.1c.7 0 1.1.8.7 1.3l-8 7.5zM10.3 2.2c.3-.3.8-.1.8.3V11H3c-.7 0-1.1-.8-.7-1.3l8-7.5z" opacity="0.8"/><path d="M11.1 21.8c-.3.3-.8.1-.8-.3V13h8.1c.7 0 1.1.8.7 1.3l-8 7.5z"/><path d="M7.7 2.2c.3-.3.8-.1.8.3V11H.4c-.7 0-1.1-.8-.7-1.3l7.4-7.5z"/></svg>,
    category: ['Cloud', 'Security'],
    connected: true,
    active: true,
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Read and manage repos, issues, and pull requests',
    icon: <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>,
    category: ['Productivity'],
    connected: true,
    active: true,
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Upload and download files to and from Google Drive',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M8.267 14.267l-2.404 4.164c.67.38 1.445.564 2.229.564.857 0 1.656-.336 2.257-.952l-.002-.003 2.143-3.775H8.267zM15.733 9.733H8.267L5.863 13.9c.6.616 1.4.967 2.257.967.856 0 1.655-.351 2.255-.967l1.288-2.267.07-.125v-.003l1.287-2.267H24l-3.834 6.72H24L20.167 9.733zM7.833 1.333L0 14.667h5.333l2.5-4.333h7.834L15.5 14.667H24L16.167 1.333H7.833z"/></svg>,
    category: ['Google', 'Productivity'],
    upcoming: true,
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Read, send, and manage your emails',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/></svg>,
    category: ['Google', 'Messaging'],
    upcoming: true,
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Create and manage Google Calendar events',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z"/></svg>,
    category: ['Google', 'Productivity'],
    upcoming: true,
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Set up payments',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/></svg>,
    category: ['Sales'],
    upcoming: true,
  },
  {
    id: 'paddle',
    name: 'Paddle',
    description: 'Set up payments with tax handled for you',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 18.75c-3.728 0-6.75-3.022-6.75-6.75S8.272 5.25 12 5.25s6.75 3.022 6.75 6.75-3.022 6.75-6.75 6.75z"/></svg>,
    category: ['Sales'],
    upcoming: true,
  },
  {
    id: 'shopify',
    name: 'Shopify',
    description: 'Build an eCommerce store',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M15.347 2.004c-.228 0-.456.015-.68.045l-1.26.18c-1.263.181-2.373.81-3.212 1.763l-.436.527-.42-.505c-.884-1.012-2.104-1.672-3.463-1.867l-1.178-.167C3.677 1.843 3.234 1.83 2.796 1.87l-.085.008C1.756 1.977.946 2.792.842 3.822L.84 3.93v.002c-.078.738.13 1.465.574 2.066l.07.09.07.087c.946 1.136 1.79 2.35 2.52 3.624l.297.523-.298.523c-.732 1.277-1.576 2.493-2.523 3.631l-.07.087-.07.09c-.443.6-.652 1.328-.574 2.067v.002c.104 1.03.914 1.846 1.864 1.945l.085.008c.438.04.88.027 1.26-.18l1.178-.167c1.36-.195 2.58-.855 3.463-1.867l.42-.505.436.527c.839.953 1.949 1.582 3.212 1.763l1.26.18c.224.03.452.045.68.045 1.49 0 2.806-.69 3.688-1.75l.24-.288.018-.022.018-.02c.82-1.008 1.308-2.273 1.373-3.608V6.04c-.065-1.336-.553-2.6-1.373-3.608l-.018-.02-.018-.022-.24-.288C18.153.69 16.837 0 15.347 0v.004zM12 4.15l.996 1.164c.854.994 1.654 2.058 2.389 3.183l.28.432-.28.432c-.735 1.125-1.535 2.189-2.389 3.183L12 13.744l-.996-1.164c-.854-.994-1.654-2.058-2.389-3.183l-.28-.432.28-.432c.735-1.125 1.535-2.189 2.389-3.183L12 4.15z"/></svg>,
    category: ['Ecommerce'],
    upcoming: true,
  },
  {
    id: 'apollo-io',
    name: 'Apollo.io',
    description: 'Search, enrich, and engage B2B contacts and companies',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm0 4.8c1.548 0 2.8 1.252 2.8 2.8S13.548 10.4 12 10.4 9.2 9.148 9.2 7.6s1.252-2.8 2.8-2.8zm0 14.4c-3.2 0-6-1.6-6-4.8 0-2.4 2.4-3.6 6-3.6s6 1.2 6 3.6c0 3.2-2.8 4.8-6 4.8z"/></svg>,
    category: ['Sales', 'Marketing'],
    isNew: true,
    upcoming: true,
  },
  {
    id: 'clickhouse',
    name: 'ClickHouse',
    description: 'Query ClickHouse databases over the HTTP interface',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M2.667 0h8.444v24H2.667V0zM12.889 0h8.444v24H12.889V0z"/></svg>,
    category: ['Cloud'],
    isNew: true,
    upcoming: true,
  },
  {
    id: 'google-analytics',
    name: 'Google Analytics',
    description: 'Web analytics and traffic insights',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 4.8c1.548 0 2.8 1.252 2.8 2.8S13.548 10.4 12 10.4 9.2 9.148 9.2 7.6s1.252-2.8 2.8-2.8zm0 14.4c-3.2 0-6-1.6-6-4.8 0-2.4 2.4-3.6 6-3.6s6 1.2 6 3.6c0 3.2-2.8 4.8-6 4.8z"/></svg>,
    category: ['Google', 'Marketing'],
    isNew: true,
    upcoming: true,
  },
  {
    id: 'posthog',
    name: 'PostHog',
    description: 'Product analytics, feature flags, and event capture',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 4.8c1.548 0 2.8 1.252 2.8 2.8S13.548 10.4 12 10.4 9.2 9.148 9.2 7.6s1.252-2.8 2.8-2.8zm0 14.4c-3.2 0-6-1.6-6-4.8 0-2.4 2.4-3.6 6-3.6s6 1.2 6 3.6c0 3.2-2.8 4.8-6 4.8z"/></svg>,
    category: ['Marketing'],
    isNew: true,
    upcoming: true,
  },
  {
    id: 'dbt',
    name: 'dbt Semantic Layer',
    description: 'Query governed metrics from your dbt Semantic Layer',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0L0 6v12l12 6 12-6V6L12 0zm0 2.4L21.6 7.2 12 12 2.4 7.2 12 2.4z"/></svg>,
    category: ['Cloud'],
    isNew: true,
    upcoming: true,
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Send messages and interact with Slack workspaces',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.125 0a2.528 2.528 0 0 1 2.522-2.52A2.528 2.528 0 0 1 24 5.042a2.528 2.528 0 0 1-2.522 2.521h-2.521V5.042zm-1.27 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V.52A2.527 2.527 0 0 1 15.166 0a2.528 2.528 0 0 1 2.523 2.522v2.52zM15.166 18.958a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.166 24a2.527 2.527 0 0 1-2.523-2.52v-2.52zm0-1.27a2.527 2.527 0 0 1-2.523-2.523 2.526 2.526 0 0 1 2.523-2.52h6.312A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.522h-6.312z"/></svg>,
    category: ['Messaging'],
    upcoming: true,
  },
  {
    id: 'google-maps',
    name: 'Google Maps Platform',
    description: 'Maps, geocoding, directions, and places APIs',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>,
    category: ['Google'],
    upcoming: true,
  },
  {
    id: 'firecrawl',
    name: 'Firecrawl',
    description: 'AI-powered scraper, search and retrieval tool',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2z"/></svg>,
    category: ['Productivity'],
    upcoming: true,
  },
  {
    id: 'google-search-console',
    name: 'Google Search Console',
    description: 'Read Search Console analytics and manage sites',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>,
    category: ['Google', 'Marketing'],
    upcoming: true,
  },
  {
    id: 'google-sheets',
    name: 'Google Sheets',
    description: 'Read and update spreadsheet data',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>,
    category: ['Google', 'Productivity'],
    upcoming: true,
  },
  {
    id: 'resend',
    name: 'Resend',
    description: 'Email API for developers',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/></svg>,
    category: ['Messaging'],
    upcoming: true,
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Add Notion pages and databases to your app',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L18.2 2.16c-.42-.326-.98-.7-2.055-.606l-12.8.934c-.466.047-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.166V6.354c0-.606-.233-.933-.748-.886l-15.177.887c-.56.046-.747.326-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.515-1.635.515-.748 0-.935-.234-1.498-.933l-4.577-7.186v6.952l1.453.327s0 .84-1.168.84l-3.222.187c-.093-.187 0-.653.327-.746l.84-.233V9.854c0-.934.28-1.268.747-1.268.327 0 .747.187 1.168.466l3.549 6.486V9.294L9.273 9.06c-.094-.42-.234-.84-.7-.84l-3.36.234c-.093.233 0 .653.28.746zm-8.98 11.5l6.744-19.448-1.632-.56-6.745 19.448z"/></svg>,
    category: ['Productivity'],
    upcoming: true,
  },
  {
    id: 'twilio',
    name: 'Twilio',
    description: 'Cloud communications platform for SMS, voice, and messaging',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M6.426 14.265A4.623 4.623 0 0 1 4.66 9.374c.006-.45.082-.896.223-1.318a4.648 4.648 0 0 1 3.243-2.868c.44-.1.897-.143 1.35-.126a4.623 4.623 0 0 1 4.548 3.762 4.62 4.62 0 0 1-1.3 4.572 4.62 4.62 0 0 1-4.763 1.386 4.62 4.62 0 0 1-1.535-.517z"/></svg>,
    category: ['Messaging'],
    upcoming: true,
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    description: 'AI voice generation, text-to-speech, and speech-to-text',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-2 16.5v-9l7 4.5-7 4.5z"/></svg>,
    category: ['AI'],
    upcoming: true,
  },
  {
    id: 'telegram',
    name: 'Telegram',
    description: 'Messaging platform with Bot API for automated interactions',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>,
    category: ['Messaging'],
    upcoming: true,
  },
  {
    id: 'google-docs',
    name: 'Google Docs',
    description: 'Create and edit Google Docs documents',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M14.17 2H8c-.55 0-1 .45-1 1v18c0 .55.45 1 1 1h11c.55 0 1-.45 1-1V7.83L14.17 2zM15 18H9v-2h6v2zm0-4H9v-2h6v2zm-3-4V3.5L18.5 9H12z"/></svg>,
    category: ['Google', 'Productivity'],
    upcoming: true,
  },
  {
    id: 'brevo',
    name: 'Brevo',
    description: 'Email, SMS, CRM, and marketing automation API',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/></svg>,
    category: ['Marketing', 'Messaging'],
    upcoming: true,
  },
  {
    id: 'airtable',
    name: 'Airtable',
    description: 'Spreadsheet-database hybrid and automation platform',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.394 5.593l4.573 2.64a.396.396 0 0 1 0 .686l-4.573 2.64a.396.396 0 0 1-.394 0L7.427 8.92a.396.396 0 0 1 0-.686l4.573-2.64a.396.396 0 0 1 .394 0z"/></svg>,
    category: ['Productivity'],
    upcoming: true,
  },
  {
    id: 'microsoft-outlook',
    name: 'Microsoft Outlook',
    description: 'Read, send, and manage emails',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 7.875V18.75c0 .69-.56 1.25-1.25 1.25H17V9.188l-5 3.125-5-3.125V20H1.25C.56 20 0 19.44 0 18.75V7.875C0 7.02.72 6.375 1.5 6.375h3L12 11.25l7.5-4.875h3c.78 0 1.5.645 1.5 1.5z"/></svg>,
    category: ['Microsoft'],
    upcoming: true,
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'CRM platform for sales, marketing, and customer service',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.44 8.26c0 3.19-3.47 5.78-7.75 5.78-4.28 0-7.75-2.59-7.75-5.78 0-3.19 3.47-5.78 7.75-5.78 4.28 0 7.75 2.59 7.75 5.78zm-2.09.43c0-2.08-2.45-3.77-5.47-3.77-3.01 0-5.46 1.69-5.46 3.77 0 2.08 2.45 3.77 5.46 3.77 3.02 0 5.47-1.69 5.47-3.77z"/></svg>,
    category: ['Sales', 'Marketing'],
    upcoming: true,
  },
  {
    id: 'google-slides',
    name: 'Google Slides',
    description: 'Create and manage Google Slides presentations',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12H7v-2h4v2zm6-4H7V8h10v2z"/></svg>,
    category: ['Google', 'Productivity'],
    upcoming: true,
  },
  {
    id: 'microsoft-excel',
    name: 'Microsoft Excel',
    description: 'Read and write spreadsheets',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 14H7v-2h5v2zm5-4H7V8h10v4z"/></svg>,
    category: ['Microsoft', 'Productivity'],
    upcoming: true,
  },
  {
    id: 'microsoft-onedrive',
    name: 'Microsoft OneDrive',
    description: 'Upload and read files',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>,
    category: ['Microsoft', 'Productivity'],
    upcoming: true,
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    description: 'AI-powered search and answer engine',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2z"/></svg>,
    category: ['AI'],
    upcoming: true,
  },
  {
    id: 'wordpress-self',
    name: 'WordPress (self-hosted)',
    description: 'Self-hosted WordPress sites and content',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>,
    category: ['Productivity'],
    upcoming: true,
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Add issue tracking and project management to your app',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M3.89 15.672L6.255.461A.542.542 0 0 1 7.27.289l2.543 4.771zm16.794 3.692l-2.25-14a.54.54 0 0 0-.919-.295L3.316 19.365l7.856 4.427a1.621 1.621 0 0 0 1.588 0zM14.3 7.147l-1.82-3.482a.542.542 0 0 0-.96 0L3.53 17.984z"/></svg>,
    category: ['Productivity'],
    upcoming: true,
  },
  {
    id: 'microsoft-teams',
    name: 'Microsoft Teams',
    description: 'Send messages and manage channels',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>,
    category: ['Microsoft', 'Messaging'],
    upcoming: true,
  },
  {
    id: 'microsoft-word',
    name: 'Microsoft Word',
    description: 'Read and write documents',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M14.17 2H8c-.55 0-1 .45-1 1v18c0 .55.45 1 1 1h11c.55 0 1-.45 1-1V7.83L14.17 2zM15 18H9v-2h6v2zm0-4H9v-2h6v2zm-3-4V3.5L18.5 9H12z"/></svg>,
    category: ['Microsoft', 'Productivity'],
    upcoming: true,
  },
  {
    id: 'aws-s3',
    name: 'AWS S3',
    description: 'Read and write data files in AWS S3 buckets',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.75 13.554v3.225c0 .612-.132 1.186-.37 1.704l2.024 2.024c.37-.623.596-1.332.596-2.09v-2.87c0-.66-.11-1.294-.31-1.884l-1.94.017zM6.375 13.554v3.225c0 .612.132 1.186.37 1.704l-2.024 2.024a5.98 5.98 0 0 1-.596-2.09v-2.87c0-.66.11-1.294.31-1.884l1.94.017z"/></svg>,
    category: ['AWS'],
    upcoming: true,
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'Connect your Salesforce CRM data to your app',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 3.5c-1.63 0-3.07.77-4 1.97C11.57 4.27 10.13 3.5 8.5 3.5 5.42 3.5 3 5.92 3 9c0 1.53.64 2.92 1.66 3.91L12 21l7.34-8.09C20.36 11.92 21 10.53 21 9c0-3.08-2.42-5.5-5.5-5.5z"/></svg>,
    category: ['Sales'],
    upcoming: true,
  },
  {
    id: 'snowflake',
    name: 'Snowflake',
    description: 'Cloud data platform for analytics and AI',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18L19.18 8 12 11.82 4.82 8 12 4.18z"/></svg>,
    category: ['Cloud'],
    upcoming: true,
  },
  {
    id: 'figma',
    name: 'Figma',
    description: "Use Figma's local MCP server from Figma Desktop on your machine.",
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 24c2.2 0 4-1.8 4-4v-4H8c-2.2 0-4 1.8-4 4s1.8 4 4 4zM4 8c0-2.2 1.8-4 4-4h4v8H8c-2.2 0-4-1.8-4-4zM8 0C5.8 0 4 1.8 4 4s1.8 4 4 4h4V0H8zM16 8c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4h-4V8zM12 8V0h4c2.2 0 4 1.8 4 4s-1.8 4-4 4h-4zM20 16c2.2 0 4-1.8 4-4s-1.8-4-4-4h-4v8h4z"/></svg>,
    category: ['Productivity'],
    upcoming: true,
  },
  {
    id: 'contentful',
    name: 'Contentful',
    description: 'Headless CMS for content delivery',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.144 10.236V5.37h-3.28v4.866h-1.64V5.37H9.944v4.866H8.304V5.37H5.024v13.26h3.28v-4.866h1.64v4.866h3.28v-4.866h1.64v4.866h3.28V5.37h-3.28v4.866h-1.64z"/></svg>,
    category: ['Productivity'],
    upcoming: true,
  },
  {
    id: 'bigquery',
    name: 'BigQuery',
    description: 'Query and analyze data in BigQuery',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7v10l10 5 10-5V7L12 2z"/></svg>,
    category: ['Google', 'Cloud'],
    upcoming: true,
  },
  {
    id: 'algolia',
    name: 'Algolia',
    description: 'Search and indexing engine',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>,
    category: ['Productivity'],
    upcoming: true,
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    description: 'Access TikTok user and content APIs',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.51a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 10.86 4.48V13.2a8.19 8.19 0 0 0 5.58 2.18v-3.45a4.85 4.85 0 0 1-5.58-2.72h5.58V6.69h-5.58z"/></svg>,
    category: ['Marketing'],
    upcoming: true,
  },
  {
    id: 'x-twitter',
    name: 'X (Twitter)',
    description: 'Read posts, users, and trends from X',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
    category: ['Marketing', 'Messaging'],
    upcoming: true,
  },
  {
    id: 'salesforce-crm',
    name: 'Zoho CRM',
    description: 'Connect your Zoho CRM data to your app',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>,
    category: ['Sales'],
    upcoming: true,
  },
  {
    id: 'neon',
    name: 'Neon',
    description: 'Serverless Postgres with branching',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.802 8.598v6.804c0 .51-.26.986-.688 1.255l-5.118 3.022c-.427.253-.953.253-1.38 0L5.498 16.657c-.428-.253-.688-.73-.688-1.24V8.598c0-.51.26-.987.688-1.255l5.118-3.022c.427-.253.953-.253 1.38 0l5.118 3.022c.428.268.688.744.688 1.255z"/></svg>,
    category: ['Cloud'],
    upcoming: true,
  },
  {
    id: 'mongodb',
    name: 'MongoDB',
    description: 'Document database for modern applications',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.193 9.555c-1.264-5.58-4.252-7.414-4.573-8.115-.28-.394-.53-.954-.735-1.44-.036.495-.055.685-.523 1.184-.723.566-4.438 3.682-4.74 10.02-.282 5.912 4.27 9.435 4.889 9.884l.07.05A73.49 73.49 0 0 1 11.91 24h.481c.114-1.032.284-2.056.51-3.07.417-.296.604-.463.85-.693a11.342 11.342 0 0 0 3.639-8.464c.01-.814-.103-1.662-.197-2.218z"/></svg>,
    category: ['Cloud'],
    upcoming: true,
  },
  {
    id: 'cloudinary',
    name: 'Cloudinary',
    description: 'Image and video management',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M9.956 8.268a5.34 5.34 0 0 0-1.473-2.136 5.354 5.354 0 0 0-2.16-1.29A5.255 5.255 0 0 0 2.625 4.5C1.175 4.5 0 5.67 0 7.12a5.31 5.31 0 0 0 .945 2.993 5.34 5.34 0 0 0 2.16 1.658c.336.106.688.168 1.05.188a5.374 5.374 0 0 0 2.176-.281 5.34 5.34 0 0 0 2.38-1.66l.024-.027.002.002a.192.192 0 0 1 .067-.08l.009-.005a.188.188 0 0 1 .083-.036l.013-.002a.18.18 0 0 1 .077.01l.014.006a.186.186 0 0 1 .067.064l.004.008a.185.185 0 0 1 .023.081l-.003.018a5.359 5.359 0 0 0 .384 3.033A5.37 5.37 0 0 0 9.375 21c1.38 0 2.643-.6 3.51-1.548a5.35 5.35 0 0 0 1.35-2.136 5.314 5.314 0 0 0-.003-2.14 5.339 5.339 0 0 0-1.35-2.136A5.37 5.37 0 0 0 9.375 12c-.674 0-1.315.145-1.89.404l-.006.003-.003-.006-.014-.01a.185.185 0 0 1-.033-.07l-.002-.014a.18.18 0 0 1 .013-.098l.006-.01a.188.188 0 0 1 .064-.07l.01-.005a.184.184 0 0 1 .083-.03l.017-.002c.028 0 .055.006.08.017l.009.004a.184.184 0 0 1 .068.065l.003.008a.187.187 0 0 1 .022.082l-.002.015-.001.008z"/></svg>,
    category: ['Cloud'],
    upcoming: true,
  },
  {
    id: 'databricks',
    name: 'Databricks',
    description: 'Unified analytics and AI platform',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7v10l10 5 10-5V7L12 2z"/></svg>,
    category: ['Cloud'],
    upcoming: true,
  },
  {
    id: 'n8n',
    name: 'n8n',
    description: 'Access and power your apps with your n8n workflows.',
    icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2z"/></svg>,
    category: ['Productivity'],
    upcoming: true,
  },
]

const categories = [
  { id: 'all', name: 'All', count: connectors.length },
  { id: 'google', name: 'Google', count: connectors.filter(c => c.category.includes('Google')).length },
  { id: 'microsoft', name: 'Microsoft', count: connectors.filter(c => c.category.includes('Microsoft')).length },
  { id: 'cloud', name: 'Cloud', count: connectors.filter(c => c.category.includes('Cloud')).length },
  { id: 'productivity', name: 'Productivity', count: connectors.filter(c => c.category.includes('Productivity')).length },
  { id: 'messaging', name: 'Messaging', count: connectors.filter(c => c.category.includes('Messaging')).length },
  { id: 'marketing', name: 'Marketing', count: connectors.filter(c => c.category.includes('Marketing')).length },
  { id: 'sales', name: 'Sales', count: connectors.filter(c => c.category.includes('Sales')).length },
  { id: 'ai', name: 'AI', count: connectors.filter(c => c.category.includes('AI')).length },
  { id: 'ecommerce', name: 'Ecommerce', count: connectors.filter(c => c.category.includes('Ecommerce')).length },
  { id: 'security', name: 'Security', count: connectors.filter(c => c.category.includes('Security')).length },
  { id: 'aws', name: 'AWS', count: connectors.filter(c => c.category.includes('AWS')).length },
]

export default function ConnectorsPage() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState<'popular' | 'name'>('popular')

  const enabledCount = connectors.filter(c => c.connected).length

  const filteredConnectors = connectors.filter((connector) => {
    const matchesSearch = connector.name.toLowerCase().includes(search.toLowerCase()) ||
      connector.description.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || connector.category.includes(selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1))
    return matchesSearch && matchesCategory
  }).sort((a, b) => {
    if (sortBy === 'popular') {
      if (a.connected && !b.connected) return -1
      if (!a.connected && b.connected) return 1
      if (a.isNew && !b.isNew) return -1
      if (!a.isNew && b.isNew) return 1
    }
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="flex h-full">
      {/* Left Sidebar */}
      <div className="w-64 shrink-0 border-r border-white/10 bg-white/[0.02] p-4">
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] py-2 pl-9 pr-3 text-sm text-white placeholder-white/40 outline-none transition focus:border-[#f97316]/50"
          />
        </div>

        <div className="mb-6 space-y-0.5">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
              selectedCategory === 'all' ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/[0.05] hover:text-white'
            }`}
          >
            <span>All</span>
            <span className="text-xs text-white/40">{connectors.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
              enabledCount > 0 ? 'text-white/80' : 'text-white/60'
            } hover:bg-white/[0.05]`}
          >
            <span>Enabled</span>
            <span className="text-xs text-white/40">{enabledCount}</span>
          </button>
        </div>

        <div className="mb-6">
          <h3 className="mb-2 px-3 text-[10px] font-medium uppercase tracking-wider text-white/30">Categories</h3>
          <div className="space-y-0.5">
            {categories.filter(c => c.id !== 'all').map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategory(category.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-sm transition ${
                  selectedCategory === category.id ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                <span>{category.name}</span>
                <span className="text-xs text-white/40">{category.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-white/10 pt-4">
          <p className="mb-3 px-3 text-xs text-white/40">Missing a connector?</p>
          <button
            type="button"
            className="w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-sm text-white/70 transition hover:bg-white/[0.1] hover:text-white"
          >
            Request
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-8 py-8">
          {/* Header Banner */}
          <div className="mb-8 rounded-2xl border border-white/10 bg-gradient-to-r from-[#f97316]/10 via-[#ea580c]/5 to-transparent p-6">
            <h1 className="mb-2 text-xl font-semibold text-white">Build from what you already use</h1>
            <p className="mb-4 text-sm text-white/50">
              Connectors let your Magical AI app talk to external tools like Stripe, Slack, and Google. Ask the agent to get started.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/[0.1] hover:text-white"
              >
                View the docs
                <ExternalLink className="h-3 w-3" />
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#f97316] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#ea580c]"
              >
                Got it
              </button>
            </div>
          </div>

          {/* Sort & Count */}
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm text-white/40">{filteredConnectors.length} connectors</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSortBy(sortBy === 'popular' ? 'name' : 'popular')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/[0.08]"
              >
                {sortBy === 'popular' ? 'Popular' : 'Name'}
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Connector Grid */}
          <div className="grid grid-cols-2 gap-3">
            {filteredConnectors.map((connector) => (
              <div
                key={connector.id}
                className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.05]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
                  {connector.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{connector.name}</span>
                    {connector.connected && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#22c55e]/15 px-1.5 py-0.5 text-[9px] font-medium text-[#22c55e]">
                        Connected
                      </span>
                    )}
                    {connector.isNew && !connector.connected && (
                      <span className="rounded bg-[#f97316]/15 px-1.5 py-0.5 text-[9px] font-medium text-[#f97316]">
                        New
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-white/40">{connector.description}</p>
                </div>
                {connector.connected && (
                  <Link
                    href="/settings/integrations"
                    className="shrink-0 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/[0.1] hover:text-white"
                  >
                    Settings
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
