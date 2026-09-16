import { useEffect, useRef } from 'react';
import { CloseIcon } from './icons';
import { SYNTHETIC_SEED } from '../data/synth';

/**
 * Provenance and method, one click from every screen.
 *
 * The page shows plausible-looking health numbers over real administrative
 * geography, which is exactly the combination that gets screenshotted into a
 * briefing note. The disclosure has to be unmissable and specific about which
 * half is real.
 */
export function MethodSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog className="sheet" ref={ref} onClose={onClose} onCancel={onClose}>
      <div className="sheet__head">
        <h3 className="sheet__title">Where these numbers come from</h3>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
      </div>
      <div className="sheet__body">
        <h4>Every health figure on this page is synthetic</h4>
        <p>
          No consultation record, disease count, coverage rate, workforce figure or facility on this
          page comes from a real registry, survey or health information system. They are generated
          by a seeded simulation (seed <code>{SYNTHETIC_SEED}</code>) that runs in your browser.
          Nothing here should be quoted, briefed, or used to make a decision about a real place.
        </p>
        <p>
          The simulated facility register is invented too — names, types, counts and positions. It
          exists to exercise the access analysis, not to tell you where a clinic is.
        </p>

        <h4>The geography is real</h4>
        <p>
          Administrative boundaries, land areas, centroids and PSGC p-codes come from the{' '}
          <em>Philippines — Subnational Administrative Boundaries</em> common operational dataset
          published by OCHA on the Humanitarian Data Exchange, sourced from NAMRIA and the
          Philippine Statistics Authority. Licensed CC BY-IGO. 88 provinces and 1,642 cities and
          municipalities are included, simplified to a shared-arc topology for the web.
        </p>
        <p>
          Real boundaries are used deliberately: fake coastlines would make every spatial judgement
          on the page meaningless, and adjacency, area and distance all have to be genuine for the
          analysis to behave the way it would against live data.
        </p>

        <h4>Why the simulation is structured, not random</h4>
        <p>
          Independent random values per area would produce a map of noise that no interface could be
          judged against. Instead values are driven by smooth spatial fields — urbanicity,
          remoteness, deprivation, service capacity, care-seeking — so the data reproduces the three
          properties that actually stress a spatial health tool:
        </p>
        <ul>
          <li>
            <strong>Spatial autocorrelation.</strong> Neighbouring areas resemble each other, so
            clusters and neighbour gaps carry information.
          </li>
          <li>
            <strong>Correlated indicators.</strong> A shared latent structure, so two-indicator
            comparison shows real association rather than a shapeless cloud.
          </li>
          <li>
            <strong>Small-number instability.</strong> Count-based rates are drawn from Poisson and
            binomial distributions over the actual denominator, so small areas genuinely produce
            unstable rates — which is what lets suppression and reliability flagging be demonstrated
            honestly rather than mocked up.
          </li>
        </ul>

        <h4>Aggregation</h4>
        <p>
          Values are generated only at city/municipality level. Province figures are true aggregates
          of their municipalities: count-based measures pool numerators and denominators, everything
          else is a population-weighted mean. The two levels reconcile exactly, so drilling down
          never contradicts the level above.
        </p>

        <h4>Disclosure control</h4>
        <p>
          Cells built on fewer than the indicator's minimum case count — ten by default — are
          withheld and drawn in a distinct grey, never as zero. Barangay-level mapping is
          deliberately absent: at that granularity, a shaded polygon combined with a facility roster
          can identify individual patients, and for stigmatised conditions that harm is severe and
          irreversible. Two indicators are excluded from mapping entirely for the same reason.
        </p>

        <h4>What the page does not have</h4>
        <ul>
          <li>
            <strong>Travel time.</strong> Access distances are straight-line from an area's
            centroid. They ignore roads, terrain, rivers and sea crossings, so they flatter island
            and upland areas. Real isochrones need a routing network that is not wired up.
          </li>
          <li>
            <strong>Age standardisation.</strong> Prevalence comparisons between areas with
            different age structures are crude rates, not standardised ones.
          </li>
          <li>
            <strong>Catchment modelling.</strong> Facilities are attributed to the area that hosts
            them, not the population they actually serve.
          </li>
        </ul>

        <h4>Reading the map safely</h4>
        <ul>
          <li>
            Class breaks change the story. The classification method is a control, not a hidden
            constant — switch it and watch which areas move.
          </li>
          <li>
            A high rate can mean high burden or good detection. Coverage and screening indicators
            are the companion to any prevalence map.
          </li>
          <li>
            Area-level association is not individual-level association. Nothing here supports a
            claim about any person.
          </li>
        </ul>
      </div>
    </dialog>
  );
}
