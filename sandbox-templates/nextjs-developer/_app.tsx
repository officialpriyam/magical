import "@/styles/globals.css";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import type { AppProps } from "next/app";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const isPostHogEnabled = Boolean(posthogKey);

if (typeof window !== "undefined" && posthogKey) {
  posthog.init(posthogKey, {
    api_host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    person_profiles: "identified_only",
    session_recording: {
      recordCrossOriginIframes: false,
    },
  });
}

export default function App({ Component, pageProps }: AppProps) {
  return isPostHogEnabled ? (
    <PostHogProvider client={posthog}>
      <Component {...pageProps} />
    </PostHogProvider>
  ) : (
    <Component {...pageProps} />
  );
}
