import { ArrowRight, CircleSlash2, Navigation2 } from "lucide-react";
import { getStatusListNavigationCopy } from "@/i18n/status-list-navigation-copy";
import "./status-list-recap-navigation.css";

export type StatusListRecapDestination = {
  sourceLabel: string;
  targetLabel: string;
  stepId: string;
  available: boolean;
};

export function StatusListRecapNavigation({
  destinations,
  locale,
}: {
  destinations: StatusListRecapDestination[];
  locale: string;
}) {
  const copy = getStatusListNavigationCopy(locale);

  if (!destinations.length) return null;

  return (
    <section className="sl-recap-navigation" aria-labelledby="sl-recap-navigation-title" data-testid="status-list-recap-navigation">
      <div className="sl-recap-navigation-heading">
        <span className="sl-recap-navigation-mark" aria-hidden="true">
          <Navigation2 className="h-4 w-4" />
        </span>
        <div className="sl-recap-navigation-heading-copy">
          <h3 id="sl-recap-navigation-title" className="sl-recap-navigation-title">
            {copy.afterConfirm}
          </h3>
          <p className="sl-recap-navigation-note">{copy.executionFirst}</p>
        </div>
      </div>

      <div className="sl-recap-navigation-list">
        {destinations.map((destination) => (
          <article
            key={destination.stepId}
            className="sl-recap-navigation-route"
            data-available={destination.available}
          >
            <div className="sl-recap-navigation-place">
              <span className="sl-recap-navigation-label">{copy.from}</span>
              <span className="sl-recap-navigation-value">{destination.sourceLabel}</span>
            </div>
            <ArrowRight className="sl-recap-navigation-arrow" aria-hidden="true" />
            <div className="sl-recap-navigation-place sl-recap-navigation-destination">
              <span className="sl-recap-navigation-label">{copy.to}</span>
              <span className="sl-recap-navigation-value">{destination.targetLabel}</span>
            </div>
            {!destination.available && (
              <div className="sl-recap-navigation-unavailable">
                <CircleSlash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{copy.unavailable}</span>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
