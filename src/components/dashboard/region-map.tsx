"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { geoMercator, type GeoProjection } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";

import {
  CITY_BY_KEY,
  type CityKey,
  colorForScore,
  hoverColorForScore,
  riskLabel,
  scoreForBorough,
} from "@/lib/mock-data";
import { useBoroughs, type BoroughScore } from "@/lib/hooks/use-boroughs";
import { cdiColorHex, cdiHoverColorHex } from "@/lib/cdi-colors";
import { cn } from "@/lib/utils";

const BOROUGHS_URL = "/boroughs.geojson";
const GEMEENTEN_URL = "/gemeenten.topojson";
const WATER_URL = "/water.geojson";

type BoroughProps = {
  city: CityKey;
  borough: string;
};
type GemeenteProps = {
  statcode?: string;
  statnaam?: string;
};
type WaterProps = {
  city?: string;
};

type HoverInfo = {
  name: string;
  score: number;
  x: number;
  y: number;
  riskLevel?: BoroughScore["riskLevel"];
};
type GemeenteTopology = Topology<{ gemeente_2024: GeometryCollection<GemeenteProps> }>;

const MAP_WIDTH = 800;
const MAP_HEIGHT = 600;
const FIT_EXTENT: [[number, number], [number, number]] = [
  [70, 50],
  [730, 550],
];
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.35;

const GEMEENTE_STYLE = {
  default: { outline: "none", pointerEvents: "none" as const },
  hover: { outline: "none", pointerEvents: "none" as const },
  pressed: { outline: "none", pointerEvents: "none" as const },
} as const;

const WATER_STYLE = {
  default: { outline: "none", pointerEvents: "none" as const },
  hover: { outline: "none", pointerEvents: "none" as const },
  pressed: { outline: "none", pointerEvents: "none" as const },
} as const;

export function RegionMap({
  city,
  onBoroughClick,
}: {
  city: CityKey;
  onBoroughClick?: (borough: string) => void;
}) {
  const profile = CITY_BY_KEY[city];
  const { scores: boroughScores, loading: boroughsLoading } = useBoroughs(city);
  const [boroughs, setBoroughs] = useState<FeatureCollection<Geometry, BoroughProps> | null>(null);
  const [gemeenteTopo, setGemeenteTopo] = useState<GemeenteTopology | null>(null);
  const [water, setWater] = useState<FeatureCollection<Geometry, WaterProps> | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [zoom, setZoom] = useState<number>(profile.zoomLevel);
  const [center, setCenter] = useState<[number, number]>(profile.zoomCenter);
  const [mapError, setMapError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Sync zoom/center to the new city profile — intentional reset.
    /* eslint-disable react-hooks/set-state-in-effect */
    setZoom(profile.zoomLevel);
    setCenter(profile.zoomCenter);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [profile]);

  useEffect(() => {
    let cancelled = false;
    const fetchJson = async <T,>(url: string): Promise<T> => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url} → ${res.status}`);
      return (await res.json()) as T;
    };
    Promise.all([
      fetchJson<FeatureCollection<Geometry, BoroughProps>>(BOROUGHS_URL),
      fetchJson<GemeenteTopology>(GEMEENTEN_URL),
      fetchJson<FeatureCollection<Geometry, WaterProps>>(WATER_URL),
    ])
      .then(([b, g, w]) => {
        if (cancelled) return;
        setBoroughs(b);
        setGemeenteTopo(g);
        setWater(w);
        setMapError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setMapError(err instanceof Error ? err.message : "Map data unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Clear hover state on city change so we don't show a tooltip for a
    // borough that no longer exists in the visible map.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHover(null);
  }, [city]);

  const cityBoroughs = useMemo<FeatureCollection<Geometry, BoroughProps> | null>(() => {
    if (!boroughs) return null;
    const features = boroughs.features.filter((f) => f.properties.city === city);
    return { type: "FeatureCollection", features };
  }, [boroughs, city]);

  const gemeenteCollection = useMemo<FeatureCollection<Geometry, GemeenteProps> | null>(() => {
    if (!gemeenteTopo) return null;
    const fc = feature(gemeenteTopo, gemeenteTopo.objects.gemeente_2024) as FeatureCollection<
      Geometry,
      GemeenteProps
    >;
    return {
      type: "FeatureCollection",
      features: fc.features.filter((f) => f.properties.statcode !== profile.gmCodeFull),
    };
  }, [gemeenteTopo, profile.gmCodeFull]);

  const cityWater = useMemo<FeatureCollection<Geometry, WaterProps> | null>(() => {
    if (!water) return null;
    return {
      type: "FeatureCollection",
      features: water.features.filter((f) => f.properties.city === city),
    };
  }, [water, city]);

  const projection = useMemo<GeoProjection | null>(() => {
    if (!cityBoroughs || cityBoroughs.features.length === 0) return null;
    return geoMercator().fitExtent(FIT_EXTENT, cityBoroughs);
  }, [cityBoroughs]);

  const onHoverEnter = useCallback(
    (
      name: string,
      score: number,
      clientX: number,
      clientY: number,
      riskLevel?: BoroughScore["riskLevel"],
    ) => {
      const rect = containerRef.current?.getBoundingClientRect();
      setHover({
        name,
        score,
        x: rect ? clientX - rect.left : 0,
        y: rect ? clientY - rect.top : 0,
        riskLevel,
      });
    },
    [],
  );

  const onHoverMove = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    setHover((prev) =>
      prev
        ? {
            ...prev,
            x: rect ? clientX - rect.left : prev.x,
            y: rect ? clientY - rect.top : prev.y,
          }
        : prev,
    );
  }, []);

  const onHoverLeave = useCallback(() => setHover(null), []);

  const onMoveEnd = useCallback((pos: { coordinates: [number, number]; zoom: number }) => {
    setZoom(pos.zoom);
    setCenter(pos.coordinates);
  }, []);

  const ready = !!projection && !!gemeenteCollection && !!cityWater && !!cityBoroughs;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-lg border border-hairline"
      style={{ backgroundColor: "oklch(0.88 0.05 220)" }}
    >
      {ready ? (
        <ComposableMap
          projection={projection as unknown as string}
          width={MAP_WIDTH}
          height={MAP_HEIGHT}
          style={{
            width: "100%",
            height: "100%",
            opacity: boroughsLoading ? 0.85 : 1,
            transition: "opacity 240ms ease",
          }}
        >
          <ZoomableGroup
            center={center}
            zoom={zoom}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            onMoveEnd={onMoveEnd}
          >
            <GemeenteLayer collection={gemeenteCollection!} />
            <BoroughLayer
              collection={cityBoroughs!}
              boroughScores={boroughScores}
              onHoverEnter={onHoverEnter}
              onHoverMove={onHoverMove}
              onHoverLeave={onHoverLeave}
              onClick={onBoroughClick}
            />
            <WaterLayer collection={cityWater!} />
          </ZoomableGroup>
        </ComposableMap>
      ) : null}

      {!ready && !mapError ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-hairline bg-panel/80 px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur">
            <span className="size-1.5 animate-pulse rounded-full bg-teal" />
            Loading map…
          </div>
        </div>
      ) : null}

      {mapError ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="inline-flex max-w-[280px] flex-col items-center gap-1.5 rounded-md border border-risk-red/40 bg-risk-red-soft/60 px-3 py-2 text-center text-[11px] text-foreground backdrop-blur">
            <svg
              viewBox="0 0 14 14"
              className="size-3.5 text-risk-red"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M7 1.5L13 12.5H1L7 1.5Z" />
              <path d="M7 6v2.5" />
              <path d="M7 10.5v.01" />
            </svg>
            <span className="font-medium">Map data unavailable</span>
            <span className="text-muted-foreground">{mapError}</span>
          </div>
        </div>
      ) : null}

      {hover ? (
        <MapTooltip
          x={hover.x}
          y={hover.y}
          name={hover.name}
          score={hover.score}
          riskLevel={hover.riskLevel}
        />
      ) : null}

      <NeighborLegend />
      <CompassBadge city={profile.label} buurten={cityBoroughs?.features.length ?? 0} />
      <ZoomControls
        zoom={zoom}
        onZoomIn={() => setZoom((z) => Math.min(z * ZOOM_STEP, MAX_ZOOM))}
        onZoomOut={() => setZoom((z) => Math.max(z / ZOOM_STEP, MIN_ZOOM))}
        onReset={() => {
          setZoom(profile.zoomLevel);
          setCenter(profile.zoomCenter);
        }}
      />
    </div>
  );
}

const GemeenteLayer = memo(function GemeenteLayer({
  collection,
}: {
  collection: FeatureCollection<Geometry, GemeenteProps>;
}) {
  return (
    <Geographies geography={collection}>
      {({ geographies }) =>
        geographies.map((geo) => (
          <Geography
            key={geo.rsmKey}
            geography={geo}
            fill="oklch(0.93 0.005 220)"
            stroke="oklch(0.86 0.008 220)"
            strokeWidth={0.55}
            style={GEMEENTE_STYLE}
          />
        ))
      }
    </Geographies>
  );
});

const WaterLayer = memo(function WaterLayer({
  collection,
}: {
  collection: FeatureCollection<Geometry, WaterProps>;
}) {
  return (
    <Geographies geography={collection}>
      {({ geographies }) =>
        geographies.map((geo) => (
          <Geography
            key={geo.rsmKey}
            geography={geo}
            fill="oklch(0.88 0.05 220)"
            stroke="oklch(0.82 0.06 220)"
            strokeWidth={0.25}
            style={WATER_STYLE}
          />
        ))
      }
    </Geographies>
  );
});

type BoroughCallbacks = {
  onHoverEnter: (
    name: string,
    score: number,
    clientX: number,
    clientY: number,
    riskLevel?: BoroughScore["riskLevel"],
  ) => void;
  onHoverMove: (clientX: number, clientY: number) => void;
  onHoverLeave: () => void;
  onClick?: (borough: string) => void;
};

const BoroughLayer = memo(function BoroughLayer({
  collection,
  boroughScores,
  onHoverEnter,
  onHoverMove,
  onHoverLeave,
  onClick,
}: {
  collection: FeatureCollection<Geometry, BoroughProps>;
  boroughScores: Map<string, BoroughScore>;
} & BoroughCallbacks) {
  return (
    <Geographies geography={collection}>
      {({ geographies }) =>
        geographies.map((geo) => (
          <BoroughPath
            key={geo.rsmKey}
            geography={geo as unknown as Feature<Geometry, BoroughProps>}
            boroughScores={boroughScores}
            onHoverEnter={onHoverEnter}
            onHoverMove={onHoverMove}
            onHoverLeave={onHoverLeave}
            onClick={onClick}
          />
        ))
      }
    </Geographies>
  );
});

const BoroughPath = memo(function BoroughPath({
  geography,
  boroughScores,
  onHoverEnter,
  onHoverMove,
  onHoverLeave,
  onClick,
}: {
  geography: Feature<Geometry, BoroughProps>;
  boroughScores: Map<string, BoroughScore>;
  onHoverEnter: BoroughCallbacks["onHoverEnter"];
  onHoverMove: BoroughCallbacks["onHoverMove"];
  onHoverLeave: BoroughCallbacks["onHoverLeave"];
  onClick?: BoroughCallbacks["onClick"];
}) {
  const { borough } = geography.properties;
  const live = boroughScores.get(borough);
  const liveScore = live?.avgScore;
  const score = liveScore ?? scoreForBorough(borough); // -1 = no data yet
  const liveRiskLevel = live?.riskLevel;
  const isIndustrial = score === -2;
  // Prefer the live CDI-band color from the API; fall back to legacy
  // score-threshold palette when the borough hasn't loaded yet or is industrial.
  const baseFill = !isIndustrial && live?.color ? cdiColorHex(live.color) : colorForScore(score);
  const hoverFill =
    !isIndustrial && live?.color ? cdiHoverColorHex(live.color) : hoverColorForScore(score);

  const styles = useMemo(
    () => ({
      default: {
        outline: "none",
        transition: "filter 180ms ease",
        cursor: isIndustrial ? "default" : "pointer",
      },
      hover: {
        outline: "none",
        fill: isIndustrial ? baseFill : hoverFill,
        filter: isIndustrial
          ? "none"
          : "drop-shadow(0 6px 14px rgba(0,0,0,0.22)) drop-shadow(0 1px 3px rgba(0,0,0,0.14))",
      },
      pressed: { outline: "none" },
    }),
    [hoverFill, baseFill, isIndustrial],
  );

  const handleEnter = useCallback(
    (e: React.MouseEvent<SVGPathElement>) => {
      if (isIndustrial) return;
      onHoverEnter(borough, score, e.clientX, e.clientY, liveRiskLevel);
    },
    [onHoverEnter, borough, score, isIndustrial, liveRiskLevel],
  );

  const handleMove = useCallback(
    (e: React.MouseEvent<SVGPathElement>) => {
      if (isIndustrial) return;
      onHoverMove(e.clientX, e.clientY);
    },
    [onHoverMove, isIndustrial],
  );

  const handleClick = useCallback(() => {
    if (isIndustrial || !onClick) return;
    onClick(borough);
  }, [onClick, borough, isIndustrial]);

  return (
    <Geography
      geography={geography}
      fill={baseFill}
      stroke="oklch(0.99 0.003 220)"
      strokeWidth={0.35}
      onMouseEnter={handleEnter}
      onMouseMove={handleMove}
      onMouseLeave={onHoverLeave}
      onClick={handleClick}
      style={styles}
    />
  );
});

// Approx tooltip dimensions used to clamp x/y so it never clips outside the map
// container (the container has overflow-hidden — anything off-edge disappears).
const TOOLTIP_HALF_WIDTH = 90;
const TOOLTIP_HEIGHT = 56;
const TOOLTIP_PAD = 8;

function MapTooltip({
  x,
  y,
  name,
  score,
  riskLevel,
}: {
  x: number;
  y: number;
  name: string;
  score: number;
  riskLevel?: BoroughScore["riskLevel"];
}) {
  // Prefer CDI-derived risk band (matches polygon fill); fall back to legacy
  // score thresholds only when the API hasn't resolved the borough yet.
  const noData = !riskLevel && score < 0;
  const tone = noData
    ? "border-hairline bg-panel/95 text-foreground"
    : riskLevel
      ? riskLevel === "severe"
        ? "border-risk-red/40 bg-risk-red-soft/70 text-foreground"
        : riskLevel === "high"
          ? "border-risk-amber/40 bg-risk-amber-soft/80 text-foreground"
          : riskLevel === "moderate"
            ? "border-risk-amber/40 bg-risk-amber-soft/45 text-foreground"
            : "border-risk-green/40 bg-risk-green-soft/70 text-foreground"
      : score < 60
        ? "border-risk-red/40 bg-risk-red-soft/70 text-foreground"
        : score < 80
          ? "border-risk-amber/40 bg-risk-amber-soft/70 text-foreground"
          : "border-risk-green/40 bg-risk-green-soft/70 text-foreground";
  const label = noData ? "No data" : riskLevel ? RISK_LEVEL_LABEL[riskLevel] : riskLabel(score);

  // Clamp the tooltip position to the container so it doesn't clip at edges.
  // We read the parent (the .relative map container) at render time.
  const ref = useRef<HTMLDivElement>(null);
  const [clamp, setClamp] = useState<{ left: number; top: number; flipBelow: boolean }>({
    left: x,
    top: y,
    flipBelow: false,
  });
  useEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement?.parentElement; // tooltip → wrapper → map container
    if (!parent) {
      setClamp({ left: x, top: y, flipBelow: false });
      return;
    }
    const rect = parent.getBoundingClientRect();
    const minX = TOOLTIP_HALF_WIDTH + TOOLTIP_PAD;
    const maxX = rect.width - TOOLTIP_HALF_WIDTH - TOOLTIP_PAD;
    const flipBelow = y < TOOLTIP_HEIGHT + TOOLTIP_PAD;
    const left = Math.max(minX, Math.min(x, maxX));
    const top = flipBelow ? y + TOOLTIP_PAD : y;
    setClamp({ left, top, flipBelow });
  }, [x, y]);

  return (
    <div
      ref={ref}
      className={cn(
        "pointer-events-none absolute z-30 -translate-x-1/2",
        clamp.flipBelow ? "translate-y-3" : "-translate-y-[calc(100%+12px)]",
      )}
      style={{ left: clamp.left, top: clamp.top }}
    >
      <div
        className={cn(
          "min-w-[150px] rounded-md border bg-panel/95 px-2.5 py-1.5 shadow-[0_10px_28px_-8px_rgb(0_0_0_/_0.14)] backdrop-blur",
          tone,
        )}
      >
        <div className="text-[12px] font-semibold tracking-tight">{name}</div>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span className="font-mono tabular text-[15px] font-medium leading-none">
            {noData ? "–" : Math.round(score)}
          </span>
          <span className="text-[9.5px] uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}

const RISK_LEVEL_LABEL: Record<NonNullable<BoroughScore["riskLevel"]>, string> = {
  low: "Healthy",
  moderate: "Moderate Risk",
  high: "At Risk",
  severe: "Severe — Connection Desert",
};

function NeighborLegend() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1 rounded-md border border-hairline bg-panel/85 px-2 py-1.5 text-[9.5px] uppercase tracking-[0.06em] text-muted-foreground backdrop-blur">
      <div className="flex items-center gap-1.5">
        <span className="size-2 rounded-[2px] border border-hairline-strong bg-[oklch(0.93_0.005_220)]" />
        <span>Neighbouring gemeente</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="size-2 rounded-[2px] bg-[oklch(0.88_0.012_220)]" />
        <span>Industrial · no CDI</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="size-2 rounded-[2px] bg-[oklch(0.88_0.05_220)]" />
        <span>Water</span>
      </div>
    </div>
  );
}

function CompassBadge({ city, buurten }: { city: string; buurten: number }) {
  return (
    <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-1.5 rounded-md border border-hairline bg-panel/85 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-muted-foreground backdrop-blur">
      <svg
        viewBox="0 0 12 12"
        className="size-2.5 text-teal"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M6 0L7 5L12 6L7 7L6 12L5 7L0 6L5 5L6 0Z" />
      </svg>
      <span className="font-mono tabular">{city}</span>
      <span className="text-muted-foreground/40">·</span>
      <span className="font-mono tabular">{buurten}</span>
    </div>
  );
}

function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  return (
    <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-md border border-hairline bg-panel/90 shadow-[0_4px_12px_-4px_rgb(0_0_0_/_0.08)] backdrop-blur">
      <button
        type="button"
        aria-label="Zoom in"
        onClick={onZoomIn}
        className="flex size-7 items-center justify-center text-foreground/80 transition-colors hover:bg-muted/40 hover:text-foreground"
      >
        <svg
          viewBox="0 0 14 14"
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M7 3v8M3 7h8" />
        </svg>
      </button>
      <div className="border-t border-hairline px-1 py-0.5 text-center font-mono text-[9px] tabular text-muted-foreground">
        {zoom.toFixed(1)}×
      </div>
      <button
        type="button"
        aria-label="Zoom out"
        onClick={onZoomOut}
        className="flex size-7 items-center justify-center border-t border-hairline text-foreground/80 transition-colors hover:bg-muted/40 hover:text-foreground"
      >
        <svg
          viewBox="0 0 14 14"
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M3 7h8" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Reset view"
        onClick={onReset}
        className="flex size-7 items-center justify-center border-t border-hairline text-foreground/70 transition-colors hover:bg-muted/40 hover:text-foreground"
      >
        <svg
          viewBox="0 0 14 14"
          className="size-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2 7a5 5 0 1 0 1.5-3.5M2 3v3h3" />
        </svg>
      </button>
    </div>
  );
}
