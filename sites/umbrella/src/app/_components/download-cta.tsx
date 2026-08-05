"use client";

import { useEffect, useState } from "react";
import {
  downloadCallToAction,
  resolveDownloadPlatform,
  type DetectedDownloadPlatform,
} from "../../lib/download-platform.js";

/**
 * OS-aware copy around one stable download destination.
 *
 * Detection never creates an artifact URL. The evidence-owning `/engine` route remains
 * the only destination, and unavailable platforms remain plain text rather than inert
 * controls that look downloadable.
 */
export function DownloadCta() {
  const [platform, setPlatform] = useState<DetectedDownloadPlatform>("unknown");

  useEffect(() => {
    setPlatform(resolveDownloadPlatform(window.navigator.userAgent));
  }, []);

  const action = downloadCallToAction(platform);

  return (
    <div className="download-cta" data-detected-platform={action.detectedPlatform}>
      <a className="button download-primary" href={action.href}>
        {action.label}
      </a>
      <p className="download-context" aria-live="polite">
        {action.context}
      </p>
      <ul className="platform-availability" aria-label="Desktop availability">
        {action.platforms.map((offer) => (
          <li data-availability={offer.availability} key={offer.id}>
            <span>{offer.name}</span>
            <span>{offer.availability === "available" ? "Available" : "Coming soon"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
