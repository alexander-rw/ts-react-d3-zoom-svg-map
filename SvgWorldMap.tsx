/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-len */
/* eslint-disable class-methods-use-this */
/* eslint-disable max-classes-per-file */
import {
  select,
  zoom,
  event,
  zoomIdentity,
  ZoomBehavior,
  Selection,
  ContainerElement,
  geoEquirectangular,
  geoPath,
  polygonCentroid,
} from "d3";

import React from "react";

import { MapFeature } from "../../@types/Map/MapFeature";
import { screen } from "../../Utilities/ScreenUtils";
import { BaseComponent } from "../BaseComponents/BaseComponent";

interface Props {
  width: number;
  height: number;
}

interface State {
  transform: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

const boundsWithOffset = (bounds: any, centroid: any, paddingPct: number): any => {
  const {
    xMin,
    xMax,
    yMin,
    yMax,
  } = bounds;
  const { xCentre, yCentre } = centroid;

  const [dx, dy] = [(xMax - xMin), (yMax - yMin)].map(diff => 0.5 * diff * (1 + (paddingPct / 100)));

  return {
    xMin: xCentre - dx,
    xMax: xCentre + dx,
    yMin: yCentre - dy,
    yMax: yCentre + dy,
  };
};

const geoBoundingBox = (feature: MapFeature): any => {
  const [xMin, yMin, xMax, yMax] = [feature.geometry.coordinates[0], 0, 0, 0]; // get extent here

  return {
    xMin,
    xMax,
    yMin,
    yMax,
  };
};

const worldProjection = geoEquirectangular()
  .fitSize([screen.width, screen.height], {}); // feature goes here

const worldPathGen = geoPath().projection(worldProjection);

const boundsAndCentroidFeature = (bounds: any, centroid: any, paddingPct: number): any => {
  const {
    xMin, xMax, yMin, yMax,
  } = boundsWithOffset(bounds, centroid, paddingPct);
  const { xCentre, yCentre } = centroid;

  const coords: any[] = [
    // Multipoint defined by the bounding box of the extent
    [xMin, yCentre],
    [xCentre, yMin],
    [xMax, yCentre],
    [xCentre, yMax],
    [xMin, yCentre],
  ];

  return { type: "MultiPoint", coordinates: coords };
};


export class SvgWorldMap extends BaseComponent<Props, State> { // eslint-disable-line @typescript-eslint/no-explicit-any
  public static readonly WorldviewrMapContainerClassName = "worldviewr-map-container";

  private static readonly WorldViewrSvgName = "worldviewr-svg";

  private static readonly WorldViewrGName = "worldviewr-g";

  private static readonly WorldviewrMapClassName = "worldviewr-map";

  private static readonly minZoom: number = 0.99;

  private static readonly maxZoom: number = 18000;

  private zoom: ZoomBehavior<SVGSVGElement, unknown>;

  private mapSvgSelector: () => Selection<SVGSVGElement, unknown, ContainerElement, unknown> = () => select(`#${SvgWorldMap.WorldViewrSvgName}`);

  private mapGSelector: () => Selection<SVGGElement, unknown, ContainerElement, unknown> = () => select(`#${SvgWorldMap.WorldViewrGName}`);

  constructor(props: Props, state: State) {
    super(props, state);
    this.zoomed = this.zoomed.bind(this);

    this.zoom = zoom<SVGSVGElement, unknown>()
      .scaleExtent([SvgWorldMap.minZoom, SvgWorldMap.maxZoom])
      .translateExtent([[0, 0], [screen.width, screen.height]])
      .on("zoom", this.zoomed);
  }

  render(): JSX.Element {
    const features = MapData.features.map((feature: MapFeature) => ({
      ...feature,
      d: worldPathGen(feature) || "",
    }))
      .map(f => (
        <path
          id={f.id}
          key={f.id}
          d={f.d}
          fill={f.properties.fill}
          fillOpacity={f.properties.fillOpacity}
          stroke={f.properties.stroke}
          strokeOpacity={f.properties.strokeOpacity}
        />
      ));

    return (
      <div className={SvgWorldMap.WorldviewrMapContainerClassName}>
        <svg
          id={SvgWorldMap.WorldViewrSvgName}
          className={SvgWorldMap.WorldViewrSvgName}
          width="100vw"
          height="100vh"
        >
          <g
            id={SvgWorldMap.WorldViewrGName}
            className={SvgWorldMap.WorldviewrMapClassName}
          >
            { /* Features go here */}
          </g>
        </svg>
      </div>
    );
  }

  componentDidMount(): void {
    // Register the map as zoomable
    this.mapSvgSelector().call(this.zoom);
    this.zoomMapTo(Kylvoro, 140);
  }

  private zoomed(): void {
    this.mapGSelector().attr("transform", event.transform.toString());
  }

  public zoomMapTo(feature: MapFeature, paddingPct: number): void {
    const bounds = geoBoundingBox(feature);
    const centroid = polygonCentroid(feature.geometry as any);
    const boundFeat = boundsAndCentroidFeature(bounds, centroid, paddingPct);
    const bnds = worldPathGen.bounds(boundFeat);
    const [xc, yc] = worldPathGen.centroid(boundFeat);
    const [[x0, y0], [x1, y1]] = bnds;

    const [zoomWidth, zoomHeight] = [Math.abs(x1 - x0), Math.abs(y1 - y0)].map(s => s * (1 + paddingPct / 100));
    const [xScale, yScale] = [screen.width / zoomWidth, screen.height / zoomHeight];
    let zoomScale = Math.min(xScale, yScale);
    zoomScale = Math.min(zoomScale, SvgWorldMap.maxZoom);
    zoomScale = Math.max(zoomScale, SvgWorldMap.minZoom);

    // Find screen pixel equivalent once scaled

    const [offsetX, offsetY] = [xc, yc].map(s => s * zoomScale);

    let [left, top] = [(0.5 * screen.width) - offsetX, (0.5 * screen.height) - offsetY].map(s => Math.min(0, s));

    left = Math.max(screen.width * (1 - zoomScale), left);
    top = Math.max(screen.width * (1 - zoomScale), top);

    this.mapSvgSelector()
      .transition()
      .duration(1050)
      .call(this.zoom.transform, zoomIdentity.translate(left, top).scale(zoomScale));
  }
}
