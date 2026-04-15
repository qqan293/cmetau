const stops = [
  { id: "gungahlin", name: "Gungahlin Place", shortName: "GGN" },
  { id: "manning-clark-north", name: "Manning Clark North", shortName: "MCK" },
  { id: "mapleton", name: "Mapleton Avenue", shortName: "MPN" },
  { id: "nullarbor", name: "Nullarbor Avenue", shortName: "NLR" },
  { id: "well-station", name: "Well Station Drive", shortName: "WSN" },
  { id: "epic", name: "EPIC and Racecourse", shortName: "EPC" },
  { id: "sandford", name: "Sandford Street", shortName: "SFD" },
  { id: "phillip", name: "Phillip Avenue", shortName: "PLP" },
  { id: "swinden", name: "Swinden Street", shortName: "SWN" },
  { id: "dickson", name: "Dickson Interchange", shortName: "DKN" },
  { id: "macarthur", name: "Macarthur Avenue", shortName: "MCR" },
  { id: "ipima", name: "Ipima Street", shortName: "IPA" },
  { id: "elouera", name: "Elouera Street", shortName: "ELA" },
  { id: "alinga", name: "Alinga Street", shortName: "ALG" }
];

const segmentMinutes = [2, 2, 3, 3, 4, 3, 2, 2, 3, 2, 3, 2, 2];

const disruptions = [
  {
    id: "northbound-power-event",
    startMinute: 7 * 60 + 35,
    endMinute: 8 * 60 + 20,
    startStopIndex: 5,
    endStopIndex: 8,
    severity: "major",
    title: "Temporary power isolation near Phillip Avenue",
    summary:
      "Services are slowing through the inner-north section while controllers manage a power reset."
  },
  {
    id: "city-delay",
    startMinute: 17 * 60 + 10,
    endMinute: 17 * 60 + 55,
    startStopIndex: 10,
    endStopIndex: 13,
    severity: "minor",
    title: "Late afternoon congestion into the city",
    summary:
      "Approach into Alinga Street is operating with temporary holding for platform regulation."
  }
];

const vehicles = [
  buildVehicle("LRV 201", 5 * 60 + 20, 0),
  buildVehicle("LRV 204", 5 * 60 + 28, 1),
  buildVehicle("LRV 207", 5 * 60 + 36, 0),
  buildVehicle("LRV 209", 5 * 60 + 44, 1),
  buildVehicle("LRV 212", 5 * 60 + 52, 0)
];

const state = {
  isPlaying: false,
  speedMultiplier: 30,
  simulationMinute: getCurrentMinute(),
  timerId: null,
  dataSource: "mock",
  routeViewMode: "timeline",
  timelineRows: [],
  timelineTrips: [],
  timelineUsdIncidents: [],
  timelineUsdPlatformRows: [],
  timelineKpi3Rows: [],
  timelineFileName: "",
  kpi2Events: [],
  kpi2FileName: "",
  kpi2Results: [],
  kpi2TotalPoints: 0,
  kpi2Intervals: { PA: new Map(), PID: new Map() },
  kpi2LogFileName: "",
  kpi2LogIncidents: [],
  kpi2LogPlatformRows: [],
  kpi2LogResults: [],
  kpi2LogTotalPoints: 0,
  kpi2LogServiceWindow: { min: 300, max: 1440 },
  kpi3Events: [],
  kpi3FileName: "",
  kpi3Results: [],
  kpi3TotalPoints: 0,
  kpi3Intervals: { PA: new Map(), PID: new Map() },
  kpi3LrvLookup: createEmptyKpi3LrvLookup(),
  kpi3LrvMapFileName: "",
  selectedInspectorKind: "",
  selectedPlatformId: "",
  selectedAssetKey: "",
  serviceWindow: { min: 300, max: 1440 }
};

const elements = {
  routeCanvas: document.querySelector("#routeCanvas"),
  clockLabel: document.querySelector("#clockLabel"),
  timelineLabel: document.querySelector("#timelineLabel"),
  timelineStart: document.querySelector("#timelineStart"),
  timelineEnd: document.querySelector("#timelineEnd"),
  timelineScrubber: document.querySelector("#timelineScrubber"),
  timelineUsdOverlay: document.querySelector("#timelineUsdOverlay"),
  timeSlider: document.querySelector("#timeSlider"),
  csvInput: document.querySelector("#csvInput"),
  csvStatus: document.querySelector("#csvStatus"),
  kpi2Input: document.querySelector("#kpi2Input"),
  kpi2Status: document.querySelector("#kpi2Status"),
  kpi2LogInput: document.querySelector("#kpi2LogInput"),
  kpi2LogStatus: document.querySelector("#kpi2LogStatus"),
  kpi3Input: document.querySelector("#kpi3Input"),
  kpi3Status: document.querySelector("#kpi3Status"),
  kpi3LrvMapInput: document.querySelector("#kpi3LrvMapInput"),
  kpi3LrvMapStatus: document.querySelector("#kpi3LrvMapStatus"),
  playPauseButton: document.querySelector("#playPauseButton"),
  speedSelect: document.querySelector("#speedSelect"),
  liveButton: document.querySelector("#liveButton"),
  routeViewCopy: document.querySelector("#routeViewCopy"),
  routeTimelineTab: document.querySelector("#routeTimelineTab"),
  routeKpi2LogTab: document.querySelector("#routeKpi2LogTab"),
  networkState: document.querySelector("#networkState"),
  networkSummary: document.querySelector("#networkSummary"),
  activeCount: document.querySelector("#activeCount"),
  activeSummary: document.querySelector("#activeSummary"),
  kpi2Total: document.querySelector("#kpi2Total"),
  kpi2Summary: document.querySelector("#kpi2Summary"),
  kpi3Total: document.querySelector("#kpi3Total"),
  kpi3Summary: document.querySelector("#kpi3Summary"),
  kpi2Audit: document.querySelector("#kpi2Audit"),
  kpi3Audit: document.querySelector("#kpi3Audit"),
  usdComparison: document.querySelector("#usdComparison"),
  disruptionList: document.querySelector("#disruptionList"),
  vehicleList: document.querySelector("#vehicleList"),
  platformMessageTitle: document.querySelector("#platformMessageTitle"),
  platformMessageList: document.querySelector("#platformMessageList")
};

init();

function init() {
  elements.timeSlider.value = String(state.simulationMinute);
  elements.speedSelect.value = String(state.speedMultiplier);

  elements.playPauseButton.addEventListener("click", togglePlayback);
  elements.speedSelect.addEventListener("change", handleSpeedChange);
  elements.timeSlider.addEventListener("input", handleSliderInput);
  elements.csvInput.addEventListener("change", handleCsvSelection);
  elements.kpi2Input.addEventListener("change", handleKpi2Selection);
  elements.kpi2LogInput.addEventListener("change", handleKpi2LogSelection);
  elements.kpi3Input.addEventListener("change", handleKpi3Selection);
  elements.kpi3LrvMapInput.addEventListener("change", handleKpi3LrvMapSelection);
  elements.liveButton.addEventListener("click", jumpToLive);
  elements.routeTimelineTab.addEventListener("click", () => setRouteViewMode("timeline"));
  elements.routeKpi2LogTab.addEventListener("click", () => setRouteViewMode("kpi2log"));
  window.addEventListener("resize", render);

  render();
}

function buildVehicle(label, firstDeparture, directionSeed) {
  const trips = [];
  const turnaroundMinutes = 6;
  const fullRunMinutes = segmentMinutes.reduce((sum, value) => sum + value, 0);
  let departure = firstDeparture;
  let direction = directionSeed;

  while (departure < 24 * 60) {
    const tripStops =
      direction === 0 ? stops.map((_, index) => index) : stops.map((_, index) => index).reverse();

    const stopTimes = tripStops.map((stopIndex, sequenceIndex) => {
      if (sequenceIndex === 0) {
        return { stopIndex, minute: departure };
      }

      const offset = segmentMinutes
        .slice(0, sequenceIndex)
        .reduce((sum, value) => sum + value, 0);

      return {
        stopIndex,
        minute: departure + offset
      };
    });

    trips.push({
      id: `${label}-${departure}`,
      direction,
      directionCode: direction === 1 ? "NB" : "SB",
      stopTimes,
      destination:
        direction === 0 ? stops[stops.length - 1].name : stops[0].name,
      departure,
      arrival: departure + fullRunMinutes
    });

    departure += fullRunMinutes + turnaroundMinutes;
    direction = direction === 0 ? 1 : 0;
  }

  return { id: label.toLowerCase().replace(/\s+/g, "-"), label, trips };
}

function togglePlayback() {
  state.isPlaying = !state.isPlaying;

  if (state.isPlaying) {
    startTimer();
  } else {
    stopTimer();
  }

  render();
}

function startTimer() {
  stopTimer();
  let previousTick = performance.now();

  state.timerId = window.setInterval(() => {
    const now = performance.now();
    const elapsedSeconds = (now - previousTick) / 1000;
    previousTick = now;

    state.simulationMinute += (elapsedSeconds / 60) * state.speedMultiplier;
    if (state.simulationMinute > 24 * 60) {
      state.simulationMinute = 24 * 60;
      state.isPlaying = false;
      stopTimer();
    }

    render();
  }, 100);
}

function stopTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function handleSpeedChange(event) {
  state.speedMultiplier = Number(event.target.value);
  render();
}

function handleSliderInput(event) {
  state.simulationMinute = Number(event.target.value);
  render();
}

function jumpToLive() {
  state.simulationMinute = getCurrentMinute();
  render();
}

function setRouteViewMode(mode) {
  if (mode === "kpi2log" && state.kpi2LogIncidents.length === 0) {
    return;
  }

  state.routeViewMode = mode;
  clampSimulationMinuteToRouteWindow();
  render();
}

function getEffectiveRouteViewMode() {
  if (state.routeViewMode === "kpi2log" && state.kpi2LogIncidents.length > 0) {
    return "kpi2log";
  }

  return "timeline";
}

function getCurrentRouteServiceWindow() {
  if (getEffectiveRouteViewMode() !== "kpi2log") {
    return state.serviceWindow;
  }

  if (state.dataSource === "timeline" && state.timelineTrips.length > 0) {
    return {
      min: Math.min(state.serviceWindow.min, state.kpi2LogServiceWindow.min),
      max: Math.max(state.serviceWindow.max, state.kpi2LogServiceWindow.max)
    };
  }

  return state.kpi2LogServiceWindow;
}

function clampSimulationMinuteToRouteWindow() {
  const windowRange = getCurrentRouteServiceWindow();
  state.simulationMinute = Math.min(
    windowRange.max,
    Math.max(windowRange.min, state.simulationMinute)
  );
}

function getCurrentRouteUsdIncidents() {
  return getEffectiveRouteViewMode() === "kpi2log"
    ? state.kpi2LogIncidents
    : getAllUsdIncidents();
}

function getCurrentRouteKpi2Results() {
  return getEffectiveRouteViewMode() === "kpi2log"
    ? state.kpi2LogResults
    : state.kpi2Results;
}

function getCurrentRouteKpi2TotalPoints() {
  return getEffectiveRouteViewMode() === "kpi2log"
    ? state.kpi2LogTotalPoints
    : state.kpi2TotalPoints;
}

function getCurrentRouteKpi2FileLabel() {
  return getEffectiveRouteViewMode() === "kpi2log"
    ? state.kpi2LogFileName
    : state.kpi2FileName;
}

function hasTimelineBackgroundForKpi2LogView() {
  return state.dataSource === "timeline" && state.timelineTrips.length > 0;
}

function getActiveVehiclesForCurrentRouteView() {
  if (getEffectiveRouteViewMode() === "kpi2log") {
    return hasTimelineBackgroundForKpi2LogView() ? getActiveVehicles() : [];
  }

  return getActiveVehicles();
}

function render() {
  clampSimulationMinuteToRouteWindow();
  const routeViewMode = getEffectiveRouteViewMode();
  const hasTimelineBackground =
    routeViewMode === "kpi2log" && hasTimelineBackgroundForKpi2LogView();
  const activeDisruptions = routeViewMode === "kpi2log" ? [] : getActiveDisruptions();
  const activeUsdIncidents = getCurrentRouteUsdIncidents().filter(
    (incident) =>
      state.simulationMinute >= incident.startMinute &&
      state.simulationMinute <= incident.endMinute
  );
  const allUsdIncidents = getCurrentRouteUsdIncidents();
  const activeVehicles = getActiveVehiclesForCurrentRouteView();
  const routeWindow = getCurrentRouteServiceWindow();

  elements.timeSlider.min = String(routeWindow.min);
  elements.timeSlider.max = String(routeWindow.max);
  elements.timeSlider.value = String(Math.round(state.simulationMinute));
  elements.clockLabel.textContent = formatMinute(state.simulationMinute, true);
  elements.timelineLabel.textContent = formatMinute(state.simulationMinute, true);
  elements.timelineStart.textContent = formatMinute(routeWindow.min, true);
  elements.timelineEnd.textContent = formatMinute(routeWindow.max, true);
  elements.timelineScrubber.classList.toggle("usd-active", activeUsdIncidents.length > 0);
  elements.playPauseButton.textContent = state.isPlaying ? "Pause" : "Play";
  elements.playPauseButton.dataset.state = state.isPlaying ? "pause" : "play";
  elements.playPauseButton.setAttribute(
    "aria-label",
    state.isPlaying ? "Pause playback" : "Play playback"
  );
  elements.csvStatus.textContent =
    state.dataSource === "timeline"
      ? `Loaded ${state.timelineFileName}`
      : "Using mock service data.";
  elements.kpi2Status.textContent = state.kpi2FileName
    ? `Loaded ${state.kpi2FileName}`
    : "No KPI 02 file loaded.";
  elements.kpi2LogStatus.textContent = state.kpi2LogFileName
    ? `Loaded ${state.kpi2LogFileName}`
    : "No KPI 02 calculation log loaded.";
  elements.kpi3Status.textContent = state.kpi3FileName
    ? `Loaded ${state.kpi3FileName}`
    : "No KPI 03 file loaded.";
  elements.kpi3LrvMapStatus.textContent = state.kpi3LrvMapFileName
    ? `Loaded ${state.kpi3LrvMapFileName} (${state.kpi3LrvLookup.byTrip.size} trip LRV mappings).`
    : "Optional for KPI 03 when the Timeline CSV does not include LRV numbers.";
  elements.routeViewCopy.textContent =
    routeViewMode === "kpi2log"
      ? hasTimelineBackground
        ? "Imported KPI 2 calculation log overlaid on the loaded timeline playback."
        : "Imported KPI 2 calculation log replayed against the full corridor."
      : "All stops from Gungahlin Place to Alinga Street.";
  elements.routeCanvas.classList.toggle("timeline-background-mode", hasTimelineBackground);
  updateRouteTabState(routeViewMode);
  renderTimelineUsdOverlay(allUsdIncidents);

  renderRoute(activeVehicles, activeDisruptions, activeUsdIncidents);
  renderNetworkStatus(activeVehicles, activeDisruptions, activeUsdIncidents);
  renderKpi2Status();
  renderKpi3Status();
  renderKpi2Audit();
  renderKpi3Audit();
  renderUsdComparison();
  renderDisruptions(activeUsdIncidents);
  renderVehicles(activeVehicles);
  renderMessageInspector();
}

function updateRouteTabState(routeViewMode) {
  const hasLog = state.kpi2LogIncidents.length > 0;
  elements.routeTimelineTab.classList.toggle("is-active", routeViewMode === "timeline");
  elements.routeTimelineTab.setAttribute("aria-selected", routeViewMode === "timeline" ? "true" : "false");
  elements.routeKpi2LogTab.classList.toggle("is-active", routeViewMode === "kpi2log");
  elements.routeKpi2LogTab.setAttribute("aria-selected", routeViewMode === "kpi2log" ? "true" : "false");
  elements.routeKpi2LogTab.disabled = !hasLog;
}

function renderRoute(activeVehicles, activeDisruptions, activeUsdIncidents) {
  const fragment = document.createDocumentFragment();
  if (activeUsdIncidents.length > 0) {
    const banner = document.createElement("div");
    const affectedBlocks = new Set(activeUsdIncidents.flatMap((incident) => incident.blockIds)).size;
    banner.className = "usd-banner";
    banner.innerHTML = `
      <strong>USD Active</strong>
      <span>${affectedBlocks} impacted ${affectedBlocks === 1 ? "LRV/block" : "LRVs/blocks"} • threshold exceeded for more than 5 minutes</span>
    `;
    fragment.appendChild(banner);
  }
  fragment.appendChild(
    buildDirectionSection({
      heading: "Northbound",
      destination: stops[0].name,
      directionCode: "NB",
      activeVehicles,
      activeDisruptions,
      activeUsdIncidents
    })
  );
  fragment.appendChild(
    buildDirectionSection({
      heading: "Southbound",
      destination: stops[stops.length - 1].name,
      directionCode: "SB",
      activeVehicles,
      activeDisruptions,
      activeUsdIncidents
    })
  );

  elements.routeCanvas.replaceChildren(fragment);
}

function buildDirectionSection({ heading, destination, directionCode, activeVehicles, activeDisruptions, activeUsdIncidents }) {
  const isMobile = window.innerWidth <= 960;
  const section = document.createElement("section");
  const header = document.createElement("div");
  const track = document.createElement("div");
  const direction = directionCode === "NB" ? 1 : 0;
  const sectionVehicles = activeVehicles.filter((vehicle) => vehicle.directionCode === directionCode);
  const sectionUsdIncidents = activeUsdIncidents.filter((incident) =>
    incident.directionCodes.includes(directionCode)
  );
  const kpi2PointsByPlatform = getKpi2PointsByPlatform(directionCode);

  section.className = `route-direction${sectionUsdIncidents.length > 0 ? " usd-active" : ""}`;
  header.className = "route-direction-header";
  track.className = "route-track";
  header.innerHTML = `
    <div>
      <h3>${heading}</h3>
      <p>towards ${destination}</p>
    </div>
    ${sectionUsdIncidents.length > 0 ? '<span class="usd-chip">USD</span>' : ""}
  `;
  section.appendChild(header);
  section.appendChild(track);

  activeDisruptions.forEach((event) => {
    const band = document.createElement("div");
    band.className = "disruption-band";

    const startPosition = getStopPercent(event.startStopIndex, direction);
    const endPosition = getStopPercent(event.endStopIndex, direction);
    const lower = Math.min(startPosition, endPosition);
    const size = Math.abs(endPosition - startPosition);

    if (isMobile) {
      band.style.top = `${lower}%`;
      band.style.height = `${size}%`;
    } else {
      band.style.left = `${lower}%`;
      band.style.width = `${size}%`;
    }

    section.appendChild(band);
  });

  sectionUsdIncidents.forEach((incident) => {
    const band = document.createElement("div");
    band.className = "usd-band";
    const startPosition = getStopPercent(incident.startStopIndex, direction);
    const endPosition = getStopPercent(incident.endStopIndex, direction);
    const lower = Math.min(startPosition, endPosition);
    const size = Math.abs(endPosition - startPosition);

    if (isMobile) {
      band.style.top = `${lower}%`;
      band.style.height = `${size}%`;
    } else {
      band.style.left = `${lower}%`;
      band.style.width = `${size}%`;
    }

    section.appendChild(band);
  });

  stops.forEach((stop, index) => {
    const position = getStopPercent(index, direction);
    const platformId = `${stop.shortName}${directionCode}`;
    const impacted = activeDisruptions.some(
      (event) => index >= event.startStopIndex && index <= event.endStopIndex
    );
    const kpiPoints = kpi2PointsByPlatform.get(platformId) || 0;
    const selected =
      state.selectedInspectorKind === "platform" && state.selectedPlatformId === platformId;
    const card = document.createElement("div");
    const marker = document.createElement("div");
    const minutesToStop = getNextArrivalAtStop(index, direction);

    marker.className = `route-stop${kpiPoints > 0 ? " kpi-alert" : ""}${selected ? " selected" : ""}`;
    card.className = `route-stop-card ${index % 2 === 0 ? "top" : "bottom"}${impacted ? " disrupted" : ""}${minutesToStop === null ? " future" : ""}${kpiPoints > 0 ? " kpi-alert" : ""}${selected ? " selected" : ""}`;

    if (isMobile) {
      marker.style.top = `${position}%`;
      card.style.top = `${position}%`;
    } else {
      marker.style.left = `${position}%`;
      card.style.left = `${position}%`;
    }

    const selectPlatform = () => {
      state.selectedInspectorKind = "platform";
      state.selectedPlatformId = platformId;
      state.selectedAssetKey = "";
      render();
    };

    marker.tabIndex = 0;
    marker.setAttribute("role", "button");
    marker.setAttribute("aria-label", `Select platform ${platformId}`);
    marker.addEventListener("click", selectPlatform);
    marker.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectPlatform();
      }
    });

    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Select platform ${platformId}`);
    card.addEventListener("click", selectPlatform);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectPlatform();
      }
    });

    card.innerHTML = `
      <div class="route-stop-name">${stop.shortName}</div>
      ${kpiPoints > 0 ? `<div class="route-stop-kpi">${kpiPoints.toFixed(1)} PP</div>` : ""}
    `;

    section.appendChild(marker);
    section.appendChild(card);
  });

  sectionVehicles.forEach((vehicle) => {
    const wrap = document.createElement("div");
    const marker = document.createElement("div");
    const pill = document.createElement("div");
    const position = getVehicleDisplayPercent(vehicle, direction);
    const assetTarget = getVehicleAssetTarget(vehicle);
    const usesTimelineBackground = getEffectiveRouteViewMode() === "kpi2log";
    const kpi3Points = usesTimelineBackground ? 0 : getCurrentKpi3PointsForVehicle(vehicle);
    const selected =
      assetTarget.key &&
      state.selectedInspectorKind === "asset" &&
      state.selectedAssetKey === assetTarget.key;
    const pointLines = getVehicleTooltipPointLines(vehicle);
    const tooltipLines = [
      vehicle.adherenceLabel,
      shouldShowTripLine(vehicle) ? `Trip ${vehicle.tripId}` : "",
      vehicle.blockId ? `Block ${vehicle.blockId}` : "",
      vehicle.lrvId ? `LRV ${vehicle.lrvId}` : "",
      ...pointLines
    ].filter(Boolean);
    const tone =
      vehicle.status === "disrupted"
        ? "var(--disruption)"
        : vehicle.delayMinutes > 0
          ? "var(--delay)"
          : "var(--on-time)";

    wrap.className = "lrv-wrap";
    if (usesTimelineBackground) {
      wrap.classList.add("background-vehicle");
    }
    marker.className = `lrv-marker${kpi3Points > 0 ? " kpi-alert" : ""}${selected ? " selected" : ""}`;
    pill.className = "lrv-pill";
    marker.style.background = tone;
    wrap.style.left = `${position}%`;

    if (isMobile) {
      wrap.style.top = `${position}%`;
    } else {
      wrap.style.top = "58%";
    }

    if (assetTarget.key) {
      const selectAsset = () => {
        state.selectedInspectorKind = "asset";
        state.selectedAssetKey = assetTarget.key;
        state.selectedPlatformId = "";
        render();
      };

      wrap.tabIndex = 0;
      wrap.setAttribute("role", "button");
      wrap.setAttribute("aria-label", `Select ${assetTarget.label}`);
      wrap.addEventListener("click", selectAsset);
      wrap.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectAsset();
        }
      });
    }

    pill.innerHTML = `
      <strong>${vehicle.label}</strong>
      ${tooltipLines.map((line) => `<small>${line}</small>`).join("")}
    `;

    wrap.appendChild(marker);
    wrap.appendChild(pill);
    section.appendChild(wrap);
  });

  return section;
}

function getKpi2PointsByPlatform(directionCode) {
  const platformMap = new Map();

  getCurrentRouteKpi2Results().forEach((result) => {
    if (!result.platformId.endsWith(directionCode)) {
      return;
    }

    const currentPoints = getKpi2PointsAtMinute(result, state.simulationMinute);
    if (currentPoints <= 0) {
      return;
    }

    platformMap.set(result.platformId, roundToTenth((platformMap.get(result.platformId) || 0) + currentPoints));
  });

  return platformMap;
}

function getKpi2PointsAtMinute(result, minute) {
  let total = 0;

  if (
    result.initialBreach &&
    Number.isFinite(result.initialBreachMinute) &&
    minute >= result.initialBreachMinute
  ) {
    total += result.initialPoints;
  }

  if (
    result.continuousBreach &&
    Number.isFinite(result.continuousBreachMinute) &&
    minute >= result.continuousBreachMinute
  ) {
    total += result.continuousPoints;
  }

  return total;
}

function getKpi3PointsAtMinute(result, minute) {
  let total = 0;

  if (
    result.initialBreach &&
    Number.isFinite(result.initialBreachMinute) &&
    minute >= result.initialBreachMinute
  ) {
    total += result.initialPoints;
  }

  if (
    result.continuousBreach &&
    Number.isFinite(result.continuousBreachMinute) &&
    minute >= result.continuousBreachMinute
  ) {
    total += result.continuousPoints;
  }

  return total;
}

function renderNetworkStatus(activeVehicles, activeDisruptions, activeUsdIncidents) {
  const routeViewMode = getEffectiveRouteViewMode();
  const hasTimelineBackground = hasTimelineBackgroundForKpi2LogView();

  if (activeUsdIncidents.length > 0) {
    const affectedTrips = new Set(activeUsdIncidents.flatMap((incident) => incident.blockIds)).size;
    elements.networkState.textContent = "USD active";
    elements.networkSummary.textContent =
      routeViewMode === "kpi2log"
        ? hasTimelineBackground
          ? `Imported KPI 2 log shows ${affectedTrips} impacted block${affectedTrips === 1 ? "" : "s"} while the loaded timeline provides vehicle background playback.`
          : `Imported KPI 2 log shows ${affectedTrips} impacted block${affectedTrips === 1 ? "" : "s"} in the active USD window.`
        : `Systemic interruption detected: ${affectedTrips} impacted LRVs/blocks for more than 5 minutes.`;
  } else if (activeDisruptions.length === 0) {
    elements.networkState.textContent =
      routeViewMode === "kpi2log"
        ? hasTimelineBackground
          ? "KPI 2 log + timeline"
          : "KPI 2 log view"
        : state.dataSource === "timeline"
          ? "Timeline playback"
          : "Normal service";
    elements.networkSummary.textContent =
      routeViewMode === "kpi2log"
        ? hasTimelineBackground
          ? "Timeline vehicle playback is shown in the background. No imported KPI 2 log disruption is active at the current simulation time."
          : "No imported KPI 2 log disruption is active at the current simulation time."
        : state.dataSource === "timeline"
        ? "Playback is using actual trip events from the loaded CSV."
        : "No active disruption.";
  } else {
    elements.networkState.textContent = activeDisruptions.length > 1 ? "Multiple disruptions" : "Disruption active";
    elements.networkSummary.textContent = activeDisruptions
      .map((event) => event.title)
      .join(" ");
  }

  elements.activeCount.textContent = String(activeVehicles.length);

  if (routeViewMode === "kpi2log" && !hasTimelineBackground) {
    elements.activeSummary.textContent = "Vehicle positions are not available in KPI 2 log view.";
    return;
  }

  if (activeVehicles.length === 0) {
    elements.activeSummary.textContent = "No vehicles in service at this time.";
  } else {
    const delayedCount = activeVehicles.filter((vehicle) => vehicle.delayMinutes > 0).length;
    elements.activeSummary.textContent =
      delayedCount === 0
        ? "All active LRVs are running to plan."
        : `${delayedCount} active LRV${delayedCount > 1 ? "s are" : " is"} carrying delay.`;
  }
}

function renderKpi2Status() {
  const currentResults = getCurrentRouteKpi2Results();
  const currentTotalPoints = getCurrentRouteKpi2TotalPoints();
  const routeViewMode = getEffectiveRouteViewMode();

  if (routeViewMode === "kpi2log" && !state.kpi2LogFileName) {
    elements.kpi2Total.textContent = "--";
    elements.kpi2Summary.textContent = "Load a KPI 02 calculation log to assess imported stop disruptions.";
    return;
  }

  if (routeViewMode !== "kpi2log" && !state.kpi2FileName) {
    elements.kpi2Total.textContent = "--";
    elements.kpi2Summary.textContent = "Load a KPI 02 CSV to assess stop notifications.";
    return;
  }

  if (
    routeViewMode !== "kpi2log" &&
    (state.dataSource !== "timeline" || state.timelineUsdPlatformRows.length === 0)
  ) {
    elements.kpi2Total.textContent = "0.0";
    elements.kpi2Summary.textContent = "Load a Timeline CSV with USD windows to score KPI 02.";
    return;
  }

  const breachCount = currentResults.filter((result) => result.totalPoints > 0).length;
  elements.kpi2Total.textContent = currentTotalPoints.toFixed(1);
  elements.kpi2Summary.textContent =
    breachCount === 0
      ? routeViewMode === "kpi2log"
        ? "No KPI 02 point failures were recorded in the imported calculation log."
        : "No KPI 02 point failures detected for the loaded USD windows."
      : `${breachCount} platform breach${breachCount > 1 ? "es" : ""} across the ${routeViewMode === "kpi2log" ? "imported log windows" : "loaded USD windows"}.`;
}

function renderKpi3Status() {
  if (getEffectiveRouteViewMode() === "kpi2log") {
    elements.kpi3Total.textContent = "--";
    elements.kpi3Summary.textContent = "KPI 03 is not available in KPI 2 log view.";
    return;
  }

  if (!state.kpi3FileName) {
    elements.kpi3Total.textContent = "--";
    elements.kpi3Summary.textContent = "Load a KPI 03 CSV to assess onboard notifications.";
    return;
  }

  if (state.dataSource !== "timeline" || state.timelineKpi3Rows.length === 0) {
    elements.kpi3Total.textContent = "0.0";
    elements.kpi3Summary.textContent =
      "Load a Timeline CSV with identifiable LRVs, or add the Wabtec LRV timetable CSV, to score KPI 03.";
    return;
  }

  const breachCount = state.kpi3Results.filter((result) => result.totalPoints > 0).length;
  elements.kpi3Total.textContent = state.kpi3TotalPoints.toFixed(1);
  elements.kpi3Summary.textContent =
    breachCount === 0
      ? "No KPI 03 point failures detected for the loaded LRV USD windows."
      : `${breachCount} LRV breach${breachCount > 1 ? "es" : ""} across the loaded USD windows.`;
}

function renderKpi2Audit() {
  const currentResults = getCurrentRouteKpi2Results();
  const routeViewMode = getEffectiveRouteViewMode();

  if (routeViewMode === "kpi2log" && !state.kpi2LogFileName) {
    elements.kpi2Audit.innerHTML = '<div class="audit-empty">Load a KPI 02 calculation log to inspect imported platform scoring.</div>';
    return;
  }

  if (routeViewMode !== "kpi2log" && !state.kpi2FileName) {
    elements.kpi2Audit.innerHTML = '<div class="audit-empty">Load a KPI 02 CSV to inspect platform-level scoring.</div>';
    return;
  }

  if (
    routeViewMode !== "kpi2log" &&
    (state.dataSource !== "timeline" || state.timelineUsdPlatformRows.length === 0)
  ) {
    elements.kpi2Audit.innerHTML = '<div class="audit-empty">Load a Timeline CSV with USD windows to build the KPI 02 audit table.</div>';
    return;
  }

  if (currentResults.length === 0) {
    elements.kpi2Audit.innerHTML = '<div class="audit-empty">No KPI 02 audit rows were generated for the loaded files.</div>';
    return;
  }

  const rows = currentResults
    .slice()
    .sort((left, right) => {
      const incidentCompare = compareUsdSort(
        left.incidentId,
        left.numericId,
        right.incidentId,
        right.numericId
      );
      if (incidentCompare !== 0) {
        return incidentCompare;
      }

      const platformCompare = left.platformId.localeCompare(right.platformId);
      if (platformCompare !== 0) {
        return platformCompare;
      }

      return left.startMinute - right.startMinute;
    })
    .map(
      (result) => `
        <tr>
          <td>${formatIncidentLabel(result.incidentId)}</td>
          <td>${result.platformId}</td>
          <td>${formatMinute(result.startMinute, true)}</td>
          <td>${formatMinute(result.endMinute, true)}</td>
          <td><span class="badge ${result.initialBreach ? "alert" : "ok"}">${result.initialBreach ? "Yes" : "No"}</span></td>
          <td><span class="badge ${result.continuousBreach ? "alert" : "ok"}">${result.continuousBreach ? "Yes" : "No"}</span></td>
          <td>${result.totalPoints.toFixed(1)}</td>
        </tr>
      `
    )
    .join("");

  elements.kpi2Audit.innerHTML = `
    <table class="audit-table">
      <thead>
        <tr>
          <th>USD ID</th>
          <th>Platform</th>
          <th>Start</th>
          <th>End</th>
          <th>Initial Breach</th>
          <th>Continuous Breach</th>
          <th>Total PP</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderKpi3Audit() {
  if (getEffectiveRouteViewMode() === "kpi2log") {
    elements.kpi3Audit.innerHTML = '<div class="audit-empty">KPI 03 audit is unavailable in KPI 2 log view.</div>';
    return;
  }

  if (!state.kpi3FileName) {
    elements.kpi3Audit.innerHTML = '<div class="audit-empty">Load a KPI 03 CSV to inspect onboard scoring.</div>';
    return;
  }

  if (state.dataSource !== "timeline" || state.timelineKpi3Rows.length === 0) {
    elements.kpi3Audit.innerHTML = '<div class="audit-empty">Load a Timeline CSV with identifiable LRVs, or add the Wabtec LRV timetable CSV, to build the KPI 03 audit table.</div>';
    return;
  }

  if (state.kpi3Results.length === 0) {
    elements.kpi3Audit.innerHTML = '<div class="audit-empty">No KPI 03 audit rows were generated for the loaded files.</div>';
    return;
  }

  const rows = state.kpi3Results
    .slice()
    .sort((left, right) => {
      const incidentCompare = compareUsdSort(
        left.incidentId,
        left.numericId,
        right.incidentId,
        right.numericId
      );
      if (incidentCompare !== 0) {
        return incidentCompare;
      }

      const assetCompare = left.assetLabel.localeCompare(right.assetLabel);
      if (assetCompare !== 0) {
        return assetCompare;
      }

      return left.startMinute - right.startMinute;
    })
    .map(
      (result) => `
        <tr>
          <td>${formatIncidentLabel(result.incidentId)}</td>
          <td>${result.assetLabel}</td>
          <td>${formatMinute(result.startMinute, true)}</td>
          <td>${formatMinute(result.endMinute, true)}</td>
          <td><span class="badge ${result.initialBreach ? "alert" : "ok"}">${result.initialBreach ? "Yes" : "No"}</span></td>
          <td><span class="badge ${result.continuousBreach ? "alert" : "ok"}">${result.continuousBreach ? "Yes" : "No"}</span></td>
          <td>${result.totalPoints.toFixed(1)}</td>
        </tr>
      `
    )
    .join("");

  elements.kpi3Audit.innerHTML = `
    <table class="audit-table">
      <thead>
        <tr>
          <th>USD ID</th>
          <th>LRV / Block</th>
          <th>Start</th>
          <th>End</th>
          <th>Initial Breach</th>
          <th>Continuous Breach</th>
          <th>Total PP</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderUsdComparison() {
  const comparison = buildUsdComparisonModel();

  if (state.dataSource !== "timeline" || state.timelineUsdIncidents.length === 0) {
    elements.usdComparison.innerHTML =
      '<div class="audit-empty">Load a Timeline CSV to compare timeline-derived USD identification.</div>';
    return;
  }

  if (state.kpi2LogIncidents.length === 0) {
    elements.usdComparison.innerHTML =
      '<div class="audit-empty">Load a KPI 02 calculation log to compare against the app method.</div>';
    return;
  }

  if (!comparison || comparison.rows.length === 0) {
    elements.usdComparison.innerHTML =
      '<div class="audit-empty">No USD comparison rows were generated.</div>';
    return;
  }

  const rows = comparison.rows
    .map((row) => {
      const statusClass =
        row.status === "Matched" ? "ok" : row.status === "Timeline only" ? "delay" : "alert";
      return `
        <tr>
          <td><span class="badge ${statusClass}">${row.status}</span></td>
          <td>${row.timeline ? formatIncidentLabel(row.timeline.id) : "—"}</td>
          <td>${row.timeline ? formatIncidentWindow(row.timeline) : "—"}</td>
          <td>${row.log ? formatIncidentLabel(row.log.id) : "—"}</td>
          <td>${row.log ? formatIncidentWindow(row.log) : "—"}</td>
          <td>${Number.isFinite(row.startDeltaMinutes) ? formatSignedMinuteDelta(row.startDeltaMinutes) : "—"}</td>
          <td>${Number.isFinite(row.endDeltaMinutes) ? formatSignedMinuteDelta(row.endDeltaMinutes) : "—"}</td>
          <td>${formatScopeComparison(row.platformComparison, "platform")}</td>
          <td>${formatScopeComparison(row.blockComparison, "block")}</td>
        </tr>
      `;
    })
    .join("");

  elements.usdComparison.innerHTML = `
    <div class="comparison-summary">
      <span class="badge ok">${comparison.matchedCount} matched</span>
      <span class="badge delay">${comparison.timelineOnlyCount} timeline-only</span>
      <span class="badge alert">${comparison.logOnlyCount} log-only</span>
    </div>
    <table class="audit-table usd-comparison-table">
      <thead>
        <tr>
          <th>Status</th>
          <th>App USD</th>
          <th>App Window</th>
          <th>Log USD</th>
          <th>Log Window</th>
          <th>Start Delta</th>
          <th>End Delta</th>
          <th>Platforms</th>
          <th>Blocks</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderDisruptions(activeUsdIncidents) {
  if (activeUsdIncidents.length === 0) {
    elements.disruptionList.innerHTML = `
      <article class="stack-item">
        <h4>No active USD</h4>
        <p>No systemic interruption currently exceeds the 5 minute and multi-service threshold.</p>
        <div class="badge-row">
          <span class="badge ok">Monitoring USD threshold</span>
        </div>
      </article>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();

  activeUsdIncidents.forEach((event) => {
    const item = document.createElement("article");
    item.className = "stack-item";
    const causeEvent = event.systemicTrigger || event.triggerEvent;
    const routeViewMode = getEffectiveRouteViewMode();
    const kpi2Rows = getCurrentRouteKpi2Results().filter((result) => result.incidentId === event.id);
    const kpi3Rows =
      routeViewMode === "kpi2log"
        ? []
        : state.kpi3Results.filter((result) => result.incidentId === event.id);
    const incidentPoints = roundToTenth(kpi2Rows.reduce((sum, row) => sum + row.totalPoints, 0));
    const incidentKpi3Points = roundToTenth(
      kpi3Rows.reduce((sum, row) => sum + row.totalPoints, 0)
    );
    const breachLines = kpi2Rows
      .filter((row) => row.totalPoints > 0)
      .map(
        (row) =>
          `<p>KPI 02: ${row.platformId} • ${row.totalPoints.toFixed(1)} PP • ${row.initialBreach ? "late initial notice" : "initial ok"} • ${row.continuousBreach ? "continuous notice breach" : "continuous ok"}</p>`
      )
      .join("");
    const kpi3Lines = kpi3Rows
      .filter((row) => row.totalPoints > 0)
      .map(
        (row) =>
          `<p>KPI 03: ${row.assetLabel} • ${row.totalPoints.toFixed(1)} PP • ${row.initialBreach ? "late initial notice" : "initial ok"} • ${row.continuousBreach ? "continuous notice breach" : "continuous ok"}</p>`
      )
      .join("");
    item.innerHTML = `
      <h4>USD ${formatMinute(event.startMinute, true)}-${formatMinute(event.endMinute, true)}</h4>
      <p>${event.summary}</p>
      <p>${formatUsdCauseSummary(causeEvent)}</p>
      <p>${formatUsdStopSummary(event.endEvent)}</p>
      ${getCurrentRouteKpi2FileLabel() ? `<p>KPI 02 points for this USD: ${incidentPoints.toFixed(1)}</p>` : ""}
      ${routeViewMode !== "kpi2log" && state.kpi3FileName ? `<p>KPI 03 points for this USD: ${incidentKpi3Points.toFixed(1)}</p>` : ""}
      ${breachLines}
      ${kpi3Lines}
      <div class="badge-row">
        <span class="badge alert">${event.blockIds.length} LRVs/blocks impacted</span>
        <span class="badge alert">${stops[event.startStopIndex].shortName}-${stops[event.endStopIndex].shortName}</span>
        <span class="badge alert">${event.directionCodes.join(" / ")}</span>
      </div>
    `;
    fragment.appendChild(item);
  });

  elements.disruptionList.replaceChildren(fragment);
}

function buildUsdComparisonModel() {
  if (
    state.dataSource !== "timeline" ||
    state.timelineUsdIncidents.length === 0 ||
    state.kpi2LogIncidents.length === 0
  ) {
    return null;
  }

  const timelineIncidents = [...state.timelineUsdIncidents].sort(sortIncidentsForComparison);
  const logIncidents = [...state.kpi2LogIncidents].sort(sortIncidentsForComparison);
  const unmatchedLogIds = new Set(logIncidents.map((incident) => incident.id));
  const logById = new Map(logIncidents.map((incident) => [incident.id, incident]));
  const rows = [];

  timelineIncidents.forEach((timelineIncident) => {
    const bestMatch = logIncidents
      .filter((logIncident) => unmatchedLogIds.has(logIncident.id))
      .map((logIncident) => ({
        logIncident,
        score: getUsdComparisonScore(timelineIncident, logIncident)
      }))
      .sort((left, right) => right.score - left.score)[0];

    if (bestMatch && bestMatch.score > 0) {
      unmatchedLogIds.delete(bestMatch.logIncident.id);
      rows.push(createUsdComparisonRow(timelineIncident, bestMatch.logIncident));
      return;
    }

    rows.push(createUsdComparisonRow(timelineIncident, null));
  });

  unmatchedLogIds.forEach((logId) => {
    rows.push(createUsdComparisonRow(null, logById.get(logId)));
  });

  rows.sort((left, right) => {
    const leftMinute = left.timeline?.startMinute ?? left.log?.startMinute ?? 0;
    const rightMinute = right.timeline?.startMinute ?? right.log?.startMinute ?? 0;
    if (leftMinute !== rightMinute) {
      return leftMinute - rightMinute;
    }

    return String(left.timeline?.id || left.log?.id || "").localeCompare(
      String(right.timeline?.id || right.log?.id || "")
    );
  });

  return {
    rows,
    matchedCount: rows.filter((row) => row.status === "Matched").length,
    timelineOnlyCount: rows.filter((row) => row.status === "Timeline only").length,
    logOnlyCount: rows.filter((row) => row.status === "Log only").length
  };
}

function sortIncidentsForComparison(left, right) {
  const startCompare = left.startMinute - right.startMinute;
  if (startCompare !== 0) {
    return startCompare;
  }

  return compareUsdSort(left.id, left.numericId, right.id, right.numericId);
}

function getUsdComparisonScore(timelineIncident, logIncident) {
  const timeOverlap = getIntervalOverlapMinutes(timelineIncident, logIncident);
  const platformOverlap = countIntersection(
    timelineIncident.platformIds || [],
    logIncident.platformIds || []
  );
  const blockOverlap = countIntersection(
    timelineIncident.blockIds || [],
    logIncident.blockIds || []
  );
  const directionOverlap = countIntersection(
    timelineIncident.directionCodes || [],
    logIncident.directionCodes || []
  );

  if (timeOverlap === 0 && platformOverlap === 0 && blockOverlap === 0) {
    return 0;
  }

  const endpointCloseness = Math.max(
    0,
    240 -
      (Math.abs(timelineIncident.startMinute - logIncident.startMinute) +
        Math.abs(timelineIncident.endMinute - logIncident.endMinute))
  );

  return (
    platformOverlap * 10000 +
    blockOverlap * 2500 +
    directionOverlap * 1000 +
    timeOverlap * 20 +
    endpointCloseness
  );
}

function createUsdComparisonRow(timelineIncident, logIncident) {
  return {
    status: timelineIncident && logIncident ? "Matched" : timelineIncident ? "Timeline only" : "Log only",
    timeline: timelineIncident,
    log: logIncident,
    startDeltaMinutes:
      timelineIncident && logIncident ? logIncident.startMinute - timelineIncident.startMinute : null,
    endDeltaMinutes:
      timelineIncident && logIncident ? logIncident.endMinute - timelineIncident.endMinute : null,
    platformComparison: compareMembers(
      timelineIncident?.platformIds || [],
      logIncident?.platformIds || []
    ),
    blockComparison: compareMembers(
      timelineIncident?.blockIds || [],
      logIncident?.blockIds || []
    )
  };
}

function compareMembers(leftItems, rightItems) {
  const left = new Set(leftItems.filter(Boolean));
  const right = new Set(rightItems.filter(Boolean));
  const shared = [...left].filter((item) => right.has(item));

  return {
    leftCount: left.size,
    rightCount: right.size,
    sharedCount: shared.length
  };
}

function countIntersection(leftItems, rightItems) {
  return compareMembers(leftItems, rightItems).sharedCount;
}

function getIntervalOverlapMinutes(left, right) {
  return Math.max(0, Math.min(left.endMinute, right.endMinute) - Math.max(left.startMinute, right.startMinute));
}

function formatIncidentWindow(incident) {
  return `${formatMinute(incident.startMinute, true)}-${formatMinute(incident.endMinute, true)}`;
}

function formatScopeComparison(comparison, label) {
  if (!comparison || (comparison.leftCount === 0 && comparison.rightCount === 0)) {
    return "—";
  }

  return `
    <span>${comparison.sharedCount} shared ${label}${comparison.sharedCount === 1 ? "" : "s"}</span>
    <small>app ${comparison.leftCount} • log ${comparison.rightCount}</small>
  `;
}

function formatSignedMinuteDelta(deltaMinutes) {
  const sign = deltaMinutes > 0 ? "+" : deltaMinutes < 0 ? "-" : "";
  const totalSeconds = Math.round(Math.abs(deltaMinutes) * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${sign}${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function renderVehicles(activeVehicles) {
  if (getEffectiveRouteViewMode() === "kpi2log" && !hasTimelineBackgroundForKpi2LogView()) {
    elements.vehicleList.innerHTML = `
      <article class="stack-item">
        <h4>No vehicle playback in this tab</h4>
        <p>The KPI 2 calculation log provides disruption windows, not live LRV positions.</p>
      </article>
    `;
    return;
  }

  if (activeVehicles.length === 0) {
    elements.vehicleList.innerHTML = `
      <article class="stack-item">
        <h4>No active vehicles</h4>
        <p>Move the timeline into service hours to see LRVs enter the route.</p>
      </article>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();
  const routeViewMode = getEffectiveRouteViewMode();

  activeVehicles
    .sort((left, right) => left.progressPercent - right.progressPercent)
    .forEach((vehicle) => {
      const item = document.createElement("article");
      item.className = "stack-item";
      item.innerHTML = `
        <h4>${vehicle.label}</h4>
        <p>${vehicle.locationLabel}</p>
        ${routeViewMode === "kpi2log" ? "<p>Timeline background vehicle in KPI 2 log view.</p>" : ""}
        <div class="badge-row">
          <span class="badge ${vehicle.delayMinutes > 0 ? "delay" : "ok"}">${
            vehicle.delayMinutes > 0 ? `${vehicle.delayMinutes} min late` : "On time"
          }</span>
          <span class="badge">${vehicle.destination}</span>
          <span class="badge ${vehicle.status === "disrupted" ? "alert" : ""}">${vehicle.statusLabel}</span>
        </div>
      `;
      fragment.appendChild(item);
    });

  elements.vehicleList.replaceChildren(fragment);
}

function renderMessageInspector() {
  const hasKpi2 = Boolean(state.kpi2FileName);
  const hasKpi3 = Boolean(state.kpi3FileName);

  if (!hasKpi2 && !hasKpi3) {
    elements.platformMessageTitle.textContent = "Message Inspector";
    elements.platformMessageList.innerHTML = `
      <article class="stack-item">
        <h4>No message data loaded</h4>
        <p>Load KPI 02 or KPI 03 CSV files to inspect stop and onboard message intervals.</p>
      </article>
    `;
    return;
  }

  if (state.selectedInspectorKind === "asset" && state.selectedAssetKey) {
    renderAssetMessageInspector();
    return;
  }

  if (state.selectedInspectorKind === "platform" && state.selectedPlatformId) {
    renderPlatformMessageInspector();
    return;
  }

  elements.platformMessageTitle.textContent = "Message Inspector";
  elements.platformMessageList.innerHTML = `
    <article class="stack-item">
      <h4>No target selected</h4>
      <p>Click a platform to inspect KPI 02 stop messages, or click an active LRV to inspect KPI 03 onboard messages.</p>
    </article>
  `;
}

function renderPlatformMessageInspector() {
  if (!state.kpi2FileName) {
    elements.platformMessageTitle.textContent = "Platform Messages";
    elements.platformMessageList.innerHTML = `
      <article class="stack-item">
        <h4>No KPI 02 data</h4>
        <p>Load a KPI 02 CSV to inspect PA and PID intervals for this platform.</p>
      </article>
    `;
    return;
  }

  const paIntervals = state.kpi2Intervals.PA.get(state.selectedPlatformId) || [];
  const pidIntervals = state.kpi2Intervals.PID.get(state.selectedPlatformId) || [];
  const platformResults = state.kpi2Results.filter(
    (result) => result.platformId === state.selectedPlatformId
  );
  const totalPlatformPoints = roundToTenth(
    platformResults.reduce((sum, result) => sum + result.totalPoints, 0)
  );
  const peakPlatformPoints = platformResults.length
    ? Math.max(...platformResults.map((result) => result.totalPoints))
    : 0;
  const fragment = document.createDocumentFragment();

  elements.platformMessageTitle.textContent = `Platform Messages • ${state.selectedPlatformId}`;

  const summary = document.createElement("article");
  summary.className = "stack-item";
  summary.innerHTML = `
    <h4>${state.selectedPlatformId}</h4>
    <p>Total KPI 02 points across loaded USD windows: ${totalPlatformPoints.toFixed(1)} PP</p>
    <p>Maximum for a single USD on this platform: ${peakPlatformPoints.toFixed(1)} PP</p>
    <p>PA intervals parsed: ${paIntervals.length} • PID intervals parsed: ${pidIntervals.length}</p>
    <div class="badge-row">
      <span class="badge alert">${platformResults.length} USD platform window${platformResults.length > 1 ? "s" : ""}</span>
    </div>
  `;
  fragment.appendChild(summary);

  [
    createMessageIntervalCard("Platform PA intervals", paIntervals, {
      emptyMessage: "No PA intervals recorded for this platform."
    }),
    createMessageIntervalCard("Platform PID intervals", pidIntervals, {
      emptyMessage: "No PID intervals recorded for this platform."
    })
  ].forEach((card) => fragment.appendChild(card));

  elements.platformMessageList.replaceChildren(fragment);
}

function renderAssetMessageInspector() {
  if (!state.kpi3FileName) {
    elements.platformMessageTitle.textContent = "Onboard Messages";
    elements.platformMessageList.innerHTML = `
      <article class="stack-item">
        <h4>No KPI 03 data</h4>
        <p>Load a KPI 03 CSV to inspect onboard PA and PID intervals for this LRV.</p>
      </article>
    `;
    return;
  }

  const paIntervals = state.kpi3Intervals.PA.get(state.selectedAssetKey) || [];
  const pidIntervals = state.kpi3Intervals.PID.get(state.selectedAssetKey) || [];
  const assetResults = state.kpi3Results.filter(
    (result) => result.assetKey === state.selectedAssetKey
  );
  const displayLabel = assetResults[0]?.assetLabel || formatAssetKey(state.selectedAssetKey);
  const totalAssetPoints = roundToTenth(
    assetResults.reduce((sum, result) => sum + result.totalPoints, 0)
  );
  const peakAssetPoints = assetResults.length
    ? Math.max(...assetResults.map((result) => result.totalPoints))
    : 0;
  const fragment = document.createDocumentFragment();

  elements.platformMessageTitle.textContent = `Onboard Messages • ${displayLabel}`;

  const summary = document.createElement("article");
  summary.className = "stack-item";
  summary.innerHTML = `
    <h4>${displayLabel}</h4>
    <p>Total KPI 03 points across loaded USD windows: ${totalAssetPoints.toFixed(1)} PP</p>
    <p>Maximum for a single USD on this LRV: ${peakAssetPoints.toFixed(1)} PP</p>
    <p>PA intervals parsed: ${paIntervals.length} • PID intervals parsed: ${pidIntervals.length}</p>
    <div class="badge-row">
      <span class="badge alert">${assetResults.length} USD LRV window${assetResults.length > 1 ? "s" : ""}</span>
    </div>
  `;
  fragment.appendChild(summary);

  [
    createMessageIntervalCard("Onboard PA intervals", paIntervals, {
      emptyMessage: "No onboard PA intervals recorded for this LRV."
    }),
    createMessageIntervalCard("Onboard PID intervals", pidIntervals, {
      emptyMessage: "No onboard PID intervals recorded for this LRV."
    })
  ].forEach((card) => fragment.appendChild(card));

  elements.platformMessageList.replaceChildren(fragment);
}

function createMessageIntervalCard(title, intervals, options = {}) {
  const card = document.createElement("article");
  card.className = "stack-item";
  const emptyMessage = options.emptyMessage || "No intervals recorded.";

  if (intervals.length === 0) {
    card.innerHTML = `
      <h4>${title}</h4>
      <p>${emptyMessage}</p>
    `;
    return card;
  }

  card.innerHTML = `
    <h4>${title}</h4>
    ${intervals
      .map(
        (interval) =>
          `<p>${formatMinute(interval.startMinute, true)} to ${formatMinute(interval.endMinute, true)} • ${interval.messageId}</p>`
      )
      .join("")}
  `;
  return card;
}

function handleCsvSelection(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const rows = parseCsv(String(reader.result || ""));
      const timelineTrips = buildTimelineTrips(rows);

      if (timelineTrips.length === 0) {
        throw new Error("No usable trips found in CSV.");
      }

      const minMinute = Math.floor(
        Math.min(...timelineTrips.map((trip) => trip.departure))
      );
      const maxMinute = Math.ceil(
        Math.max(...timelineTrips.map((trip) => trip.arrival))
      );

      state.dataSource = "timeline";
      const usdModel = buildTimelineUsdModel(rows);
      state.timelineRows = rows;
      state.timelineTrips = timelineTrips;
      state.timelineUsdIncidents = usdModel.incidents;
      state.timelineUsdPlatformRows = usdModel.platformRows;
      state.timelineKpi3Rows = buildTimelineKpi3Windows(
        rows,
        usdModel.incidents,
        state.kpi3LrvLookup
      );
      state.timelineFileName = file.name;
      state.serviceWindow = {
        min: Math.max(0, minMinute - 5),
        max: Math.min(1440, maxMinute + 5)
      };
      state.simulationMinute = state.serviceWindow.min;
      refreshKpi2Results();
      refreshKpi3Results();
      render();
    } catch (error) {
      state.dataSource = "mock";
      state.timelineRows = [];
      state.timelineTrips = [];
      state.timelineUsdIncidents = [];
      state.timelineUsdPlatformRows = [];
      state.timelineKpi3Rows = [];
      state.timelineFileName = "";
      state.selectedInspectorKind = "";
      state.selectedPlatformId = "";
      state.selectedAssetKey = "";
      state.kpi2Results = [];
      state.kpi2TotalPoints = 0;
      state.kpi2Intervals = { PA: new Map(), PID: new Map() };
      state.kpi3Results = [];
      state.kpi3TotalPoints = 0;
      state.kpi3Intervals = { PA: new Map(), PID: new Map() };
      state.serviceWindow = { min: 300, max: 1440 };
      elements.csvStatus.textContent = `CSV load failed: ${error.message}`;
    }
  });

  reader.readAsText(file);
}

function handleKpi2Selection(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const rows = parseCsv(String(reader.result || ""));
      state.kpi2Events = buildKpi2Events(rows);
      state.kpi2FileName = file.name;
      refreshKpi2Results();
      render();
    } catch (error) {
      state.kpi2Events = [];
      state.kpi2FileName = "";
      state.kpi2Results = [];
      state.kpi2TotalPoints = 0;
      state.kpi2Intervals = { PA: new Map(), PID: new Map() };
      elements.kpi2Status.textContent = `KPI 02 load failed: ${error.message}`;
    }
  });

  reader.readAsText(file);
}

function handleKpi2LogSelection(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const model = parseKpi2CalculationLog(String(reader.result || ""));
      state.kpi2LogFileName = file.name;
      state.kpi2LogIncidents = model.incidents;
      state.kpi2LogPlatformRows = model.platformRows;
      state.kpi2LogResults = model.results;
      state.kpi2LogTotalPoints = model.totalPoints;
      state.kpi2LogServiceWindow = model.serviceWindow;
      state.routeViewMode = "kpi2log";
      clampSimulationMinuteToRouteWindow();
      render();
    } catch (error) {
      state.kpi2LogFileName = "";
      state.kpi2LogIncidents = [];
      state.kpi2LogPlatformRows = [];
      state.kpi2LogResults = [];
      state.kpi2LogTotalPoints = 0;
      state.kpi2LogServiceWindow = { min: 300, max: 1440 };
      state.routeViewMode = "timeline";
      elements.kpi2LogStatus.textContent = `KPI 02 log load failed: ${error.message}`;
    }
  });

  reader.readAsText(file);
}

function handleKpi3Selection(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const rows = parseCsv(String(reader.result || ""));
      state.kpi3Events = buildKpi3Events(rows);
      state.kpi3FileName = file.name;
      refreshKpi3Results();
      render();
    } catch (error) {
      state.kpi3Events = [];
      state.kpi3FileName = "";
      state.kpi3Results = [];
      state.kpi3TotalPoints = 0;
      state.kpi3Intervals = { PA: new Map(), PID: new Map() };
      elements.kpi3Status.textContent = `KPI 03 load failed: ${error.message}`;
    }
  });

  reader.readAsText(file);
}

function handleKpi3LrvMapSelection(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      state.kpi3LrvLookup = buildKpi3LrvLookupFromTimetableText(String(reader.result || ""));
      state.kpi3LrvMapFileName = file.name;
      rebuildTimelineKpi3Rows();
      refreshKpi3Results();
      render();
    } catch (error) {
      state.kpi3LrvLookup = createEmptyKpi3LrvLookup();
      state.kpi3LrvMapFileName = "";
      rebuildTimelineKpi3Rows();
      refreshKpi3Results();
      elements.kpi3LrvMapStatus.textContent = `LRV timetable load failed: ${error.message}`;
    }
  });

  reader.readAsText(file);
}

function rebuildTimelineKpi3Rows() {
  state.timelineKpi3Rows =
    state.dataSource === "timeline" && state.timelineRows.length > 0
      ? buildTimelineKpi3Windows(
          state.timelineRows,
          state.timelineUsdIncidents,
          state.kpi3LrvLookup
        )
      : [];
}

function refreshKpi2Results() {
  if (state.dataSource !== "timeline" || state.timelineUsdPlatformRows.length === 0 || state.kpi2Events.length === 0) {
    state.kpi2Results = [];
    state.kpi2TotalPoints = 0;
    state.kpi2Intervals = { PA: new Map(), PID: new Map() };
    if (state.selectedInspectorKind === "platform") {
      state.selectedPlatformId = "";
    }
    return;
  }

  state.kpi2Intervals = buildKpi2IntervalCollections(state.kpi2Events);
  state.kpi2Results = evaluateKpi2(state.timelineUsdPlatformRows, state.kpi2Intervals);
  state.kpi2TotalPoints = roundToTenth(
    state.kpi2Results.reduce((sum, result) => sum + result.totalPoints, 0)
  );

  if (
    !state.selectedPlatformId ||
    (!state.kpi2Intervals.PA.has(state.selectedPlatformId) &&
      !state.kpi2Intervals.PID.has(state.selectedPlatformId))
  ) {
    state.selectedPlatformId =
      state.kpi2Results[0]?.platformId ||
      state.kpi2Intervals.PA.keys().next().value ||
      state.kpi2Intervals.PID.keys().next().value ||
      "";

    if (state.selectedPlatformId && !state.selectedInspectorKind) {
      state.selectedInspectorKind = "platform";
    }
  }
}

function refreshKpi3Results() {
  if (state.dataSource !== "timeline" || state.timelineKpi3Rows.length === 0 || state.kpi3Events.length === 0) {
    state.kpi3Results = [];
    state.kpi3TotalPoints = 0;
    state.kpi3Intervals = { PA: new Map(), PID: new Map() };
    if (state.selectedInspectorKind === "asset") {
      state.selectedAssetKey = "";
    }
    return;
  }

  state.kpi3Intervals = buildKpi3IntervalCollections(state.kpi3Events);
  state.kpi3Results = evaluateKpi3(state.timelineKpi3Rows, state.kpi3Intervals);
  state.kpi3TotalPoints = roundToTenth(
    state.kpi3Results.reduce((sum, result) => sum + result.totalPoints, 0)
  );

  if (
    !state.selectedAssetKey ||
    (!state.kpi3Intervals.PA.has(state.selectedAssetKey) &&
      !state.kpi3Intervals.PID.has(state.selectedAssetKey))
  ) {
    state.selectedAssetKey =
      state.kpi3Results[0]?.assetKey ||
      state.kpi3Intervals.PA.keys().next().value ||
      state.kpi3Intervals.PID.keys().next().value ||
      "";
  }

  if (state.selectedAssetKey && !state.selectedInspectorKind && !state.selectedPlatformId) {
    state.selectedInspectorKind = "asset";
  }
}

function getActiveVehicles() {
  if (state.dataSource === "timeline") {
    return state.timelineTrips
      .map((trip) => getTimelineVehicleState(trip, state.simulationMinute))
      .filter(Boolean);
  }

  return vehicles
    .map((vehicle) => getVehicleState(vehicle, state.simulationMinute))
    .filter(Boolean);
}

function getActiveDisruptions() {
  if (state.dataSource === "timeline") {
    return [];
  }

  return disruptions.filter((item) =>
    state.simulationMinute >= item.startMinute &&
    state.simulationMinute <= item.endMinute
  );
}

function getActiveUsdIncidents() {
  const sourceIncidents = getAllUsdIncidents();

  return sourceIncidents.filter(
    (incident) =>
      state.simulationMinute >= incident.startMinute &&
      state.simulationMinute <= incident.endMinute
  );
}

function getAllUsdIncidents() {
  return state.dataSource === "timeline" ? state.timelineUsdIncidents : buildMockUsdIncidents();
}

function getVehicleState(vehicle, minute) {
  const trip = vehicle.trips.find(
    (candidate) => minute >= candidate.departure && minute <= candidate.arrival
  );

  if (!trip) {
    return null;
  }

  const disruption = disruptions.find(
    (event) =>
      minute >= event.startMinute &&
      minute <= event.endMinute &&
      trip.stopTimes.some(
        (stopTime) =>
          stopTime.stopIndex >= event.startStopIndex &&
          stopTime.stopIndex <= event.endStopIndex
      )
  );

  const delayMinutes = disruption ? (disruption.severity === "major" ? 6 : 3) : 0;
  const adjustedMinute = minute - delayMinutes;

  for (let index = 0; index < trip.stopTimes.length - 1; index += 1) {
    const current = trip.stopTimes[index];
    const next = trip.stopTimes[index + 1];

    if (adjustedMinute >= current.minute && adjustedMinute <= next.minute) {
      const elapsed = adjustedMinute - current.minute;
      const span = next.minute - current.minute;
      const interpolation = span === 0 ? 0 : elapsed / span;
      const rawStopIndex = current.stopIndex + (next.stopIndex - current.stopIndex) * interpolation;
      const progressPercent = getInterpolatedPercent(rawStopIndex);
      const destination = trip.destination;
      const locationLabel = `Between ${stops[current.stopIndex].name} and ${stops[next.stopIndex].name}`;

      return {
        label: vehicle.label,
        tripId: trip.id,
        blockId: vehicle.label,
        lrvId: vehicle.label,
        destination,
        direction: trip.direction,
        directionCode: trip.directionCode,
        progressPercent,
        delayMinutes,
        adherenceMinutes: delayMinutes,
        adherenceLabel: formatAdherenceLabel(delayMinutes),
        locationLabel,
        tooltipPlatformIds: [
          `${stops[current.stopIndex].shortName}${trip.directionCode}`,
          `${stops[next.stopIndex].shortName}${trip.directionCode}`
        ],
        status: disruption ? "disrupted" : delayMinutes > 0 ? "delayed" : "ok",
        statusLabel: disruption ? "Affected by disruption" : delayMinutes > 0 ? "Delayed" : "Running normally"
      };
    }
  }

  const terminalStop = trip.stopTimes[trip.stopTimes.length - 1].stopIndex;
  return {
    label: vehicle.label,
    tripId: trip.id,
    blockId: vehicle.label,
    lrvId: vehicle.label,
    destination: trip.destination,
    direction: trip.direction,
    directionCode: trip.directionCode,
    progressPercent: getStopPercent(terminalStop),
    delayMinutes,
    adherenceMinutes: delayMinutes,
    adherenceLabel: formatAdherenceLabel(delayMinutes),
    locationLabel: `At ${stops[terminalStop].name}`,
    tooltipPlatformIds: [`${stops[terminalStop].shortName}${trip.directionCode}`],
    status: disruption ? "disrupted" : "ok",
    statusLabel: disruption ? "Holding at platform" : "At platform"
  };
}

function getNextArrivalAtStop(stopIndex, direction) {
  if (state.dataSource === "timeline") {
    const upcoming = state.timelineTrips
      .filter((trip) => trip.direction === direction)
      .map((trip) => trip.stopTimes.find((entry) => entry.stopIndex === stopIndex))
      .filter(Boolean)
      .map((entry) => Math.ceil(entry.actualMinute - state.simulationMinute))
      .filter((value) => value >= 0)
      .sort((left, right) => left - right);

    return upcoming[0] ?? null;
  }

  const upcoming = vehicles
    .flatMap((vehicle) =>
      vehicle.trips
        .filter(
          (trip) =>
            trip.direction === direction &&
            trip.stopTimes.some((entry) => entry.stopIndex === stopIndex)
        )
        .map((trip) => {
          const stopTime = trip.stopTimes.find((entry) => entry.stopIndex === stopIndex);
          const disruption = disruptions.find(
            (event) =>
              stopIndex >= event.startStopIndex &&
              stopIndex <= event.endStopIndex &&
              stopTime.minute >= event.startMinute &&
              stopTime.minute <= event.endMinute
          );
          const delayMinutes = disruption ? (disruption.severity === "major" ? 6 : 3) : 0;
          return Math.ceil(stopTime.minute + delayMinutes - state.simulationMinute);
        })
    )
    .filter((value) => value !== null)
    .filter((value) => value >= 0)
    .sort((left, right) => left - right);

  return upcoming[0] ?? null;
}

function getStopPercent(index, direction = 0) {
  const inset = 8;
  const span = 84;
  return inset + (span * (stops.length - 1 - index)) / (stops.length - 1);
}

function getInterpolatedPercent(rawStopIndex) {
  const inset = 8;
  const span = 84;
  return inset + (span * (stops.length - 1 - rawStopIndex)) / (stops.length - 1);
}

function getVehicleDisplayPercent(vehicle, direction) {
  return vehicle.progressPercent;
}

function isKpi3ResultActiveForVehicle(result, vehicle, assetKey, minute) {
  if (!result || !vehicle || !assetKey || result.assetKey !== assetKey) {
    return false;
  }

  if (minute < result.startMinute || minute > result.endMinute) {
    return false;
  }

  if (!Array.isArray(result.windows) || result.windows.length === 0) {
    return true;
  }

  const matchingTripWindows = result.windows.filter(
    (window) => !vehicle.tripId || !window.tripId || window.tripId === vehicle.tripId
  );

  if (matchingTripWindows.length === 0) {
    return false;
  }

  return matchingTripWindows.some(
    (window) => minute >= window.startMinute && minute <= window.endMinute
  );
}

function getCurrentKpi3PointsForVehicle(vehicle) {
  if (getEffectiveRouteViewMode() === "kpi2log") {
    return 0;
  }

  const assetKey = getVehicleAssetTarget(vehicle).key;

  if (!assetKey || vehicle.status === "ok") {
    return 0;
  }

  return roundToTenth(
    state.kpi3Results
      .filter((result) =>
        isKpi3ResultActiveForVehicle(result, vehicle, assetKey, state.simulationMinute)
      )
      .reduce((sum, result) => sum + getKpi3PointsAtMinute(result, state.simulationMinute), 0)
  );
}

function getVehicleTooltipPointLines(vehicle) {
  const lines = [];
  const platformIds = [...new Set(vehicle.tooltipPlatformIds || [])];
  const routeKpi2Results = getCurrentRouteKpi2Results();
  const routeViewMode = getEffectiveRouteViewMode();

  platformIds.forEach((platformId) => {
    const points = roundToTenth(
      routeKpi2Results
        .filter((result) => result.platformId === platformId)
        .reduce((sum, result) => sum + getKpi2PointsAtMinute(result, state.simulationMinute), 0)
    );

    if (points > 0) {
      lines.push(`KPI 02 ${platformId} ${points.toFixed(1)} PP`);
    }
  });

  const assetTarget = getVehicleAssetTarget(vehicle);
  if (routeViewMode !== "kpi2log" && assetTarget.key) {
    const points = getCurrentKpi3PointsForVehicle(vehicle);

    if (points > 0) {
      lines.push(`KPI 03 ${points.toFixed(1)} PP`);
    }
  }

  return lines;
}

function getTimelineVehicleState(trip, minute) {
  if (minute < trip.departure || minute > trip.arrival) {
    return null;
  }

  for (let index = 0; index < trip.stopTimes.length - 1; index += 1) {
    const current = trip.stopTimes[index];
    const next = trip.stopTimes[index + 1];

    if (minute >= current.actualMinute && minute <= next.actualMinute) {
      const elapsed = minute - current.actualMinute;
      const span = Math.max(0.001, next.actualMinute - current.actualMinute);
      const interpolation = elapsed / span;
      const rawStopIndex = current.stopIndex + (next.stopIndex - current.stopIndex) * interpolation;
      const progressPercent = getInterpolatedPercent(rawStopIndex);
      const scheduledInterpolated =
        current.scheduledMinute + (next.scheduledMinute - current.scheduledMinute) * interpolation;
      const adherenceMinutes = roundToTenth(minute - scheduledInterpolated);
      const delayMinutes = Math.max(0, Math.round(Math.max(0, adherenceMinutes)));

      return {
        label: `Trip ${trip.tripId}`,
        tripId: trip.tripId,
        blockId: trip.blockId,
        lrvId: trip.lrvId,
        destination: trip.destination,
        direction: trip.direction,
        directionCode: trip.directionCode,
        progressPercent,
        delayMinutes,
        adherenceMinutes,
        adherenceLabel: formatAdherenceLabel(adherenceMinutes),
        locationLabel: `Between ${stops[current.stopIndex].name} and ${stops[next.stopIndex].name}`,
        tooltipPlatformIds: [
          `${stops[current.stopIndex].shortName}${trip.directionCode}`,
          `${stops[next.stopIndex].shortName}${trip.directionCode}`
        ],
        status: getAdherenceStatus(adherenceMinutes),
        statusLabel: formatAdherenceLabel(adherenceMinutes)
      };
    }
  }

  const terminal = trip.stopTimes[trip.stopTimes.length - 1];
  const terminalAdherence = roundToTenth(terminal.actualMinute - terminal.scheduledMinute);
  const terminalDelay = Math.max(0, Math.round(Math.max(0, terminalAdherence)));
  return {
    label: `Trip ${trip.tripId}`,
    tripId: trip.tripId,
    blockId: trip.blockId,
    lrvId: trip.lrvId,
    destination: trip.destination,
    direction: trip.direction,
    directionCode: trip.directionCode,
    progressPercent: getStopPercent(terminal.stopIndex),
    delayMinutes: terminalDelay,
    adherenceMinutes: terminalAdherence,
    adherenceLabel: formatAdherenceLabel(terminalAdherence),
    locationLabel: `At ${stops[terminal.stopIndex].name}`,
    tooltipPlatformIds: [`${stops[terminal.stopIndex].shortName}${trip.directionCode}`],
    status: getAdherenceStatus(terminalAdherence),
    statusLabel: formatAdherenceLabel(terminalAdherence)
  };
}

function parseCsv(text) {
  const rows = parseCsvRows(text);
  const [header, ...data] = rows;
  return data.map((values) =>
    Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""]))
  );
}

function parseCsvRows(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(current);
      if (row.some((value) => value !== "")) {
        rows.push(row);
      }
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  if (current !== "" || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows;
}

function parseKpi2CalculationLog(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);
  const concurrentDisruptions = [];
  const concurrentByKey = new Map();
  const blockWindows = [];
  const platformWindowMap = new Map();
  const platformWindows = [];
  const totalLineMatch = text.match(/KPI 2 Total penalty points:\s*([0-9.]+)/i);

  lines.forEach((line) => {
    const message = stripLogPrefix(line);
    if (!message) {
      return;
    }

    const blockMatch = message.match(
      /^Block:\s+(.+?)\s+->\s+(\d{2}:\d{2}:\d{2}) to (\d{2}:\d{2}:\d{2})/
    );
    if (blockMatch) {
      const [, blockId, startText, endText] = blockMatch;
      blockWindows.push({
        blockId: blockId.trim(),
        startMinute: parseClockMinute(startText),
        endMinute: parseClockMinute(endText)
      });
      return;
    }

    const concurrentMatch = message.match(/^(\d{2}:\d{2}:\d{2}) to (\d{2}:\d{2}:\d{2}) \(/);
    if (concurrentMatch && !message.startsWith("Platform:")) {
      const [, startText, endText] = concurrentMatch;
      const startMinute = parseClockMinute(startText);
      const endMinute = parseClockMinute(endText);
      const numericId = concurrentDisruptions.length + 1;
      const incident = {
        id: `usd-${numericId}`,
        numericId,
        startMinute,
        endMinute
      };
      concurrentDisruptions.push(incident);
      concurrentByKey.set(`${startText}-${endText}`, incident);
      return;
    }

    const windowMatch = message.match(
      /^Platform:\s+([A-Z]{3}\d)\s+->\s+(\d{2}:\d{2}:\d{2}) to (\d{2}:\d{2}:\d{2}).*?due to concurrent disruption (\d{2}:\d{2}:\d{2}) to (\d{2}:\d{2}:\d{2})/
    );
    if (!windowMatch) {
      return;
    }

    const [, platformToken, startText, endText, incidentStartText, incidentEndText] = windowMatch;
    const incident =
      concurrentByKey.get(`${incidentStartText}-${incidentEndText}`) ||
      {
        id: `usd-${concurrentDisruptions.length + 1}`,
        numericId: concurrentDisruptions.length + 1,
        startMinute: parseClockMinute(incidentStartText),
        endMinute: parseClockMinute(incidentEndText)
      };
    const platformId = normaliseKpi2Platform(platformToken);
    const stopCode = platformId.slice(0, 3);
    const stopIndex = stops.findIndex((stop) => stop.shortName === stopCode);
    const directionCode = platformId.endsWith("NB") ? "NB" : "SB";
    const startMinute = parseClockMinute(startText);
    const endMinute = parseClockMinute(endText);
    const key = `${platformId}::${startText}::${endText}::${incident.id}`;

    let windowRow = platformWindowMap.get(key);
    if (!windowRow) {
      windowRow = {
        key,
        incidentId: incident.id,
        numericId: incident.numericId,
        platformId,
        stopCode,
        stopIndex,
        directionCode,
        startMinute,
        endMinute,
        triggerEvent: {
          platformId,
          eventType: "Concurrent disruption",
          thresholdMinute: incident.startMinute,
          differenceSeconds: null
        },
        incidentTriggerEvent: {
          platformId,
          eventType: "Concurrent disruption",
          thresholdMinute: incident.startMinute,
          differenceSeconds: null
        },
        endEvent: {
          platformId,
          eventType: "Concurrent disruption",
          resolvedMinute: endMinute,
          reason: "Imported from KPI 2 calculation log"
        },
        initialBreach: false,
        continuousBreach: false,
        initialBreachMinute: null,
        continuousBreachMinute: null,
        loggedTotalPoints: null
      };
      platformWindowMap.set(key, windowRow);
      platformWindows.push(windowRow);
    }

    const initialFailureMatch = message.match(
      /failed to play an initial (PA|PID) message by (\d{2}:\d{2}:\d{2})/i
    );
    if (initialFailureMatch) {
      windowRow.initialBreach = true;
      windowRow.initialBreachMinute = Number.isFinite(windowRow.initialBreachMinute)
        ? Math.min(windowRow.initialBreachMinute, parseClockMinute(initialFailureMatch[2]))
        : parseClockMinute(initialFailureMatch[2]);
    }

    const continuousFailureMatch = message.match(
      /failed to play a continued (PA|PID) message by (\d{2}:\d{2}:\d{2})/i
    );
    if (continuousFailureMatch) {
      windowRow.continuousBreach = true;
      windowRow.continuousBreachMinute = Number.isFinite(windowRow.continuousBreachMinute)
        ? Math.min(windowRow.continuousBreachMinute, parseClockMinute(continuousFailureMatch[2]))
        : parseClockMinute(continuousFailureMatch[2]);
    }

    const accruedMatch = message.match(/accrued ([0-9.]+)/i);
    if (accruedMatch) {
      windowRow.loggedTotalPoints = Number(accruedMatch[1]);
    }
  });

  if (concurrentDisruptions.length === 0 || platformWindows.length === 0) {
    throw new Error("No usable disruption windows found in calculation log.");
  }

  const platformRows = platformWindows
    .filter((row) => row.stopIndex >= 0)
    .map((row) => ({
      incidentId: row.incidentId,
      numericId: row.numericId,
      platformId: row.platformId,
      stopCode: row.stopCode,
      stopIndex: row.stopIndex,
      directionCode: row.directionCode,
      tripId: "",
      blockId: "",
      lrvId: "",
      startMinute: row.startMinute,
      endMinute: row.endMinute,
      triggerEvent: row.triggerEvent,
      incidentTriggerEvent: row.incidentTriggerEvent,
      endEvent: row.endEvent
    }));
  const incidents = buildUiUsdIncidents(platformRows).map((incident) => {
    const blockIds = [...new Set(
      blockWindows
        .filter((window) => rowsOverlap(window, incident))
        .map((window) => window.blockId)
    )];

    return {
      ...incident,
      blockIds,
      summary: [
        "Imported from KPI 2 calculation log.",
        `${incident.platformIds.length} platform${incident.platformIds.length > 1 ? "s" : ""} mapped to this concurrent disruption.`,
        `${blockIds.length} block${blockIds.length === 1 ? "" : "s"} overlapped this window.`
      ].join(" ")
    };
  });
  const results = platformWindows
    .filter((row) => row.stopIndex >= 0)
    .map((row) => {
      const lengthMinutes = Math.max(0, row.endMinute - row.startMinute);
      const lengthCondition = lengthMinutes > 4;
      const initialBreach = lengthCondition && row.initialBreach;
      const continuousBreach = lengthCondition && row.continuousBreach;
      const initialPoints = initialBreach ? 0.5 : 0;
      const continuousPoints = continuousBreach ? 2 : 0;
      return {
        incidentId: row.incidentId,
        numericId: row.numericId,
        platformId: row.platformId,
        startMinute: row.startMinute,
        endMinute: row.endMinute,
        lengthMinutes,
        lengthCondition,
        initialBreach,
        continuousBreach,
        initialBreachMinute: initialBreach ? row.initialBreachMinute : null,
        continuousBreachMinute: continuousBreach ? row.continuousBreachMinute : null,
        initialPoints,
        continuousPoints,
        totalPoints: initialPoints + continuousPoints,
        loggedTotalPoints: row.loggedTotalPoints
      };
    });
  const totalPoints = Number.isFinite(Number(totalLineMatch?.[1]))
    ? roundToTenth(Number(totalLineMatch[1]))
    : roundToTenth(results.reduce((sum, row) => sum + row.totalPoints, 0));
  const allMinutes = [
    ...concurrentDisruptions.flatMap((incident) => [incident.startMinute, incident.endMinute]),
    ...platformRows.flatMap((row) => [row.startMinute, row.endMinute]),
    ...results.flatMap((row) =>
      [row.initialBreachMinute, row.continuousBreachMinute].filter((value) =>
        Number.isFinite(value)
      )
    )
  ];
  const minMinute = Math.max(0, Math.floor(Math.min(...allMinutes) - 5));
  const maxMinute = Math.min(1440, Math.ceil(Math.max(...allMinutes) + 5));

  return {
    incidents,
    platformRows,
    results,
    totalPoints,
    serviceWindow: {
      min: minMinute,
      max: maxMinute
    }
  };
}

function stripLogPrefix(line) {
  return String(line || "").replace(
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?:\s*/,
    ""
  ).trim();
}

function parseClockMinute(value) {
  const match = String(value || "").match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, hour, minute, second] = match;
  return Number(hour) * 60 + Number(minute) + Number(second) / 60;
}

function buildTimelineTrips(rows) {
  const tripMap = new Map();

  rows.forEach((row) => {
    const stopIndex = stops.findIndex((stop) => stop.shortName === row.Stop);
    if (stopIndex === -1) {
      return;
    }

    const actualMinute = parseTimestampToMinute(row.Actual || row.Scheduled);
    const scheduledMinute = parseTimestampToMinute(row.Scheduled);
    if (actualMinute === null || scheduledMinute === null) {
      return;
    }

    const directionCode = row.Direction === "NB" ? "NB" : "SB";
    const direction = directionCode === "NB" ? 1 : 0;
    const tripKey = `${row.Trip}-${row.Direction}`;
    const existing = tripMap.get(tripKey) || {
      tripId: row.Trip,
      blockId: row.Block,
      lrvId: row.LRVNo || row.Lrv || row.LRV || "",
      direction,
      directionCode,
      stopMap: new Map()
    };
    const stopEvent = existing.stopMap.get(stopIndex);
    const event = {
      stopIndex,
      actualMinute,
      scheduledMinute,
      eventType: row["Arr.Dep"] || row.ArrDep || ""
    };

    if (!stopEvent || event.eventType === "DEP" || stopEvent.eventType === "ARR") {
      existing.stopMap.set(stopIndex, event);
    }

    tripMap.set(tripKey, existing);
  });

  return [...tripMap.values()]
    .map((trip) => {
      const stopTimes = sanitizeStopSequence(
        [...trip.stopMap.values()].sort((left, right) => left.actualMinute - right.actualMinute),
        trip.directionCode
      );

      if (stopTimes.length < 2) {
        return null;
      }

      return {
        tripId: trip.tripId,
        blockId: trip.blockId,
        lrvId: trip.lrvId,
        direction: trip.direction,
        directionCode: trip.directionCode,
        stopTimes,
        departure: stopTimes[0].actualMinute,
        arrival: stopTimes[stopTimes.length - 1].actualMinute,
        destination:
          trip.direction === 0 ? stops[stops.length - 1].name : stops[0].name
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.departure - right.departure);
}

function sanitizeStopSequence(stopTimes, directionCode) {
  const sanitized = [];
  let lastRouteProgress = Number.NEGATIVE_INFINITY;

  stopTimes.forEach((event) => {
    const routeProgress = getDirectionalRouteProgress(event.stopIndex, directionCode);

    if (routeProgress >= lastRouteProgress) {
      sanitized.push(event);
      lastRouteProgress = routeProgress;
    }
  });

  return sanitized;
}

function getDirectionalRouteProgress(stopIndex, directionCode) {
  return directionCode === "NB" ? stops.length - 1 - stopIndex : stopIndex;
}

function roundToTenth(value) {
  return Math.round(value * 10) / 10;
}

function getAdherenceStatus(adherenceMinutes) {
  if (adherenceMinutes > 0.5) {
    return "delayed";
  }

  if (adherenceMinutes < -0.5) {
    return "early";
  }

  return "ok";
}

function formatAdherenceLabel(adherenceMinutes) {
  if (adherenceMinutes > 0.5) {
    return `${Math.abs(adherenceMinutes).toFixed(1)} min late`;
  }

  if (adherenceMinutes < -0.5) {
    return `${Math.abs(adherenceMinutes).toFixed(1)} min early`;
  }

  return "On time";
}

function shouldShowTripLine(vehicle) {
  if (!vehicle.tripId) {
    return false;
  }

  return vehicle.label.replace(/^Trip\s+/i, "") !== String(vehicle.tripId);
}

function buildTimelineUsdModel(rows) {
  const movementRows = rows
    .map(normalizeTimelineDepartureRow)
    .filter(Boolean)
    .filter((row) => !row.tripId.startsWith("R"));
  const departureRows = movementRows
    .filter((row) => row.arrDep === "DEP")
    .sort((left, right) => {
      const platformCompare = left.platformId.localeCompare(right.platformId);
      if (platformCompare !== 0) {
        return platformCompare;
      }

      return left.scheduledMinute - right.scheduledMinute;
    });

  if (departureRows.length === 0) {
    return {
      delayTable2: [],
      platformRows: [],
      incidents: []
    };
  }

  const blockWindows = buildWabtecBlockDisruptionWindows(movementRows);
  const concurrentWindows = buildWabtecConcurrentDisruptionWindows(blockWindows);
  const terminalHeadways = buildWabtecTerminalHeadways(movementRows);
  const delayTable2 = buildWabtecPlatformDelayWindows(departureRows, terminalHeadways);
  const rawPlatformRows = buildWabtecPlatformUsdRows(concurrentWindows, delayTable2);

  return {
    delayTable2,
    blockWindows,
    concurrentWindows,
    platformRows: rawPlatformRows,
    incidents: buildUiUsdIncidents(rawPlatformRows)
  };
}

function buildWabtecBlockDisruptionWindows(movementRows) {
  const rowsByBlock = groupTimelineRows(movementRows, (row) => row.blockId);
  const blockWindows = [];

  rowsByBlock.forEach((blockRows) => {
    const sortedRows = [...blockRows].sort(compareTimelineRowsByTime);
    let currentWindow = null;
    let lastDisruptedDeparture = null;

    sortedRows.forEach((row) => {
      if (row.arrDep !== "DEP") {
        return;
      }

      if (isTimelineBlockUsdDelayed(row)) {
        if (!currentWindow) {
          currentWindow = startWabtecBlockWindow(row);
        }

        addTimelineRowIdentity(currentWindow, row);
        currentWindow.delayedRows.push(row);
        currentWindow.endMinute = row.actualMinute;
        if (
          Number.isFinite(row.actualMinute) &&
          (!Number.isFinite(currentWindow.latestDelayedActualMinute) ||
            row.actualMinute > currentWindow.latestDelayedActualMinute)
        ) {
          currentWindow.latestDelayedActualMinute = row.actualMinute;
        }
        lastDisruptedDeparture = row;
        return;
      }

      if (isTimelineBlockPlaceholderDisruption(row)) {
        if (!currentWindow) {
          currentWindow = startWabtecBlockWindow(row);
        }

        addTimelineRowIdentity(currentWindow, row);
        currentWindow.endMinute = row.actualMinute;
        currentWindow.endEvent = buildWabtecUsdEndEvent(
          row,
          row.actualMinute,
          "missing partial service movement in the active block window"
        );
        lastDisruptedDeparture = row;
        return;
      }

      if (!currentWindow) {
        return;
      }

      if (!canTimelineBlockRowRecover(row, currentWindow)) {
        return;
      }

      currentWindow.endMinute = row.actualMinute;
      currentWindow.endEvent = buildWabtecUsdEndEvent(
        row,
        row.actualMinute,
        "delay recovered below 5 minutes"
      );
      pushCompletedWabtecBlockWindow(blockWindows, currentWindow);
      currentWindow = null;
      lastDisruptedDeparture = null;
    });

    if (currentWindow && lastDisruptedDeparture) {
      const fallbackEndRow = findWabtecBlockFallbackEndRow(sortedRows, lastDisruptedDeparture);
      const resolvedMinute = fallbackEndRow
        ? fallbackEndRow.scheduledMinute
        : lastDisruptedDeparture.actualMinute;
      currentWindow.endMinute = resolvedMinute;
      currentWindow.endEvent = buildWabtecUsdEndEvent(
        fallbackEndRow || lastDisruptedDeparture,
        resolvedMinute,
        fallbackEndRow
          ? "scheduled end of the available block movement"
          : "last delayed departure in the active block window"
      );
      pushCompletedWabtecBlockWindow(blockWindows, currentWindow);
    }
  });

  return blockWindows.sort((left, right) => left.startMinute - right.startMinute);
}

function startWabtecBlockWindow(row) {
  return {
    blockId: row.blockId,
    startMinute: row.scheduledMinute,
    endMinute: row.scheduledMinute,
    triggerEvent: buildWabtecUsdTriggerEvent(row),
    endEvent: null,
    tripIds: new Set(),
    lrvIds: new Set(),
    delayedRows: [],
    latestDelayedActualMinute: row.actualMinute
  };
}

function isTimelineBlockUsdDelayed(row) {
  return Number.isFinite(row.differenceSeconds) && row.differenceSeconds > 5 * 60;
}

function isTimelineBlockPlaceholderDisruption(row) {
  const completedService = getTimelineCompletedService(row);
  return (
    completedService === "missed" ||
    (completedService === "partial" && row.actualMissing)
  );
}

function canTimelineBlockRowRecover(row, window) {
  const completedService = String(row.completedService || "").trim().toLowerCase();
  if (completedService === "missed") {
    return false;
  }

  return (
    completedService !== "partial" ||
    !Number.isFinite(row.actualMinute) ||
    !Number.isFinite(window.latestDelayedActualMinute) ||
    row.actualMinute >= window.latestDelayedActualMinute
  );
}

function pushCompletedWabtecBlockWindow(blockWindows, window) {
  if (!Number.isFinite(window.endMinute) || window.endMinute - window.startMinute <= 5) {
    return;
  }

  blockWindows.push({
    ...window,
    windowKey: `block-window-${blockWindows.length + 1}`,
    tripIds: [...window.tripIds],
    lrvIds: [...window.lrvIds],
    delayedRows: [...window.delayedRows]
  });
}

function findWabtecBlockFallbackEndRow(sortedRows, lastDelayedDeparture) {
  const lastDelayedSecond = minuteToSecond(lastDelayedDeparture.scheduledMinute);
  return (
    [...sortedRows]
      .reverse()
      .find((row) => minuteToSecond(row.scheduledMinute) >= lastDelayedSecond) || null
  );
}

function buildWabtecTerminalHeadways(movementRows) {
  const rowsByDirection = new Map();
  const headways = new Map();

  movementRows.forEach((row) => {
    if (
      row.arrDep !== "ARR" ||
      row.stopIndex !== getTerminalStopIndex(row.directionCode) ||
      !Number.isFinite(row.actualMinute)
    ) {
      return;
    }

    const directionRows = rowsByDirection.get(row.directionCode) || [];
    directionRows.push(row);
    rowsByDirection.set(row.directionCode, directionRows);
  });

  rowsByDirection.forEach((directionRows) => {
    [...directionRows]
      .sort((left, right) => left.actualMinute - right.actualMinute)
      .forEach((row, index, sortedRows) => {
        const previous = sortedRows[index - 1];
        const actualHeadway = previous ? row.actualMinute - previous.actualMinute : Number.NaN;
        headways.set(getTimelineTripDirectionKey(row), actualHeadway);
      });
  });

  return headways;
}

function getTerminalStopIndex(directionCode) {
  return directionCode === "NB" ? 0 : stops.length - 1;
}

function getOriginStopIndex(directionCode) {
  return directionCode === "NB" ? stops.length - 1 : 0;
}

function isTimelineOriginStop(row) {
  return row.stopIndex === getOriginStopIndex(row.directionCode);
}

function getTimelineTripDirectionKey(row) {
  return `${row.tripId}::${row.directionCode}`;
}

function getTimelineCompletedService(row) {
  return String(row.completedService || "").trim().toLowerCase();
}

function buildWabtecConcurrentDisruptionWindows(blockWindows) {
  const eventsBySecond = new Map();

  blockWindows.forEach((window, index) => {
    const windowKey = window.windowKey || `block-window-${index + 1}`;
    const startSecond = minuteToSecond(window.startMinute);
    const endSecond = minuteToSecond(window.endMinute);

    if (endSecond <= startSecond) {
      return;
    }

    addTimelineSweepEvent(eventsBySecond, startSecond, {
      type: "start",
      window: { ...window, windowKey }
    });
    addTimelineSweepEvent(eventsBySecond, endSecond, {
      type: "end",
      window: { ...window, windowKey }
    });
  });

  const eventSeconds = [...eventsBySecond.keys()].sort((left, right) => left - right);
  if (eventSeconds.length === 0) {
    return [];
  }

  const activeWindows = new Map();
  const concurrentSegments = [];
  let previousSecond = eventSeconds[0];

  eventSeconds.forEach((eventSecond) => {
    if (eventSecond > previousSecond && activeWindows.size > 1) {
      appendWabtecConcurrentSegment(
        concurrentSegments,
        previousSecond,
        eventSecond,
        [...activeWindows.values()]
      );
    }

    const events = eventsBySecond.get(eventSecond) || [];
    events
      .filter((event) => event.type === "end")
      .forEach((event) => {
        activeWindows.delete(event.window.windowKey);
      });
    events
      .filter((event) => event.type === "start")
      .forEach((event) => {
        activeWindows.set(event.window.windowKey, event.window);
      });

    previousSecond = eventSecond;
  });

  return concurrentSegments.map((segment, index) => ({
    id: `usd-${index + 1}`,
    numericId: index + 1,
    startMinute: segment.startSecond / 60,
    endMinute: segment.endSecond / 60,
    blockIds: [...segment.blockIds],
    tripIds: [...segment.tripIds],
    lrvIds: [...segment.lrvIds],
    blockWindows: [...segment.blockWindows.values()]
  }));
}

function appendWabtecConcurrentSegment(segments, startSecond, endSecond, activeWindows) {
  if (endSecond <= startSecond) {
    return;
  }

  const previous = segments[segments.length - 1];
  const segment =
    previous && previous.endSecond === startSecond
      ? previous
      : {
          startSecond,
          endSecond: startSecond,
          blockIds: new Set(),
          tripIds: new Set(),
          lrvIds: new Set(),
          blockWindows: new Map()
        };

  if (segment !== previous) {
    segments.push(segment);
  }

  segment.endSecond = endSecond;
  activeWindows.forEach((window) => {
    if (window.blockId) {
      segment.blockIds.add(window.blockId);
    }
    (window.tripIds || []).forEach((tripId) => segment.tripIds.add(tripId));
    (window.lrvIds || []).forEach((lrvId) => segment.lrvIds.add(lrvId));
    segment.blockWindows.set(window.windowKey, window);
  });
}

function buildWabtecPlatformDelayWindows(departureRows, terminalHeadways = new Map()) {
  const rowsByPlatform = groupTimelineRows(departureRows, (row) => row.platformId);
  const windows = [];

  rowsByPlatform.forEach((platformRows) => {
    const sortedRows = [...platformRows].sort(compareTimelineRowsByTime);
    let currentWindow = null;

    sortedRows.forEach((row) => {
      if (isTimelinePlatformUsdDelayed(row)) {
        if (!currentWindow) {
          currentWindow = startWabtecPlatformWindow(row);
        }

        currentWindow.delayedRows.push(row);
        currentWindow.impactRows.push(row);
        currentWindow.endMinute = row.actualMinute;
        currentWindow.latestDelayedActualMinute = Math.max(
          currentWindow.latestDelayedActualMinute,
          row.actualMinute
        );
        currentWindow.endEvent = buildWabtecUsdEndEvent(
          row,
          row.actualMinute,
          "last delayed departure in the active platform window"
        );
        return;
      }

      if (isWabtecPlatformPlaceholderDisruption(row)) {
        if (!currentWindow) {
          currentWindow = startWabtecPlatformWindow(row);
        }

        currentWindow.impactRows.push(row);
        currentWindow.endMinute = row.actualMinute;
        return;
      }

      if (!currentWindow) {
        return;
      }

      const completedService = getTimelineCompletedService(row);
      if (
        completedService === "partial" &&
        Number.isFinite(row.actualMinute) &&
        Number.isFinite(currentWindow.latestDelayedActualMinute) &&
        row.actualMinute < currentWindow.latestDelayedActualMinute
      ) {
        return;
      }

      if (
        completedService !== "missedheadway" &&
        !isTimelineOriginStop(row) &&
        isWabtecOutOfSequenceRecovery(row, currentWindow)
      ) {
        currentWindow.outOfSequenceRecovery = true;
        return;
      }

      // Wabtec does not close a platform window on an overtaking recovery row.
      if (
        completedService !== "missedheadway" &&
        !isTimelineOriginStop(row) &&
        currentWindow.outOfSequenceRecovery &&
        !hasWabtecTerminalHeadwayRecovered(row, terminalHeadways)
      ) {
        return;
      }

      currentWindow.recoveryRow = row;
      currentWindow.endMinute = row.actualMinute;
      currentWindow.endEvent = buildWabtecUsdEndEvent(
        row,
        row.actualMinute,
        "delay recovered below 5 minutes"
      );
      pushCompletedWabtecPlatformWindow(windows, currentWindow);
      currentWindow = null;
    });

    if (currentWindow) {
      pushCompletedWabtecPlatformWindow(windows, currentWindow);
    }
  });

  return windows.sort(compareWabtecPlatformWindows);
}

function startWabtecPlatformWindow(row) {
  return {
    platformId: row.platformId,
    stopCode: row.stopCode,
    stopIndex: row.stopIndex,
    directionCode: row.directionCode,
    startMinute: row.scheduledMinute,
    endMinute: row.actualMinute,
    triggerEvent: buildWabtecUsdTriggerEvent(row),
    endEvent: buildWabtecUsdEndEvent(
      row,
      row.actualMinute,
      "last delayed departure in the active platform window"
    ),
    delayedRows: [],
    impactRows: [],
    recoveryRow: null,
    latestDelayedActualMinute: row.actualMinute,
    outOfSequenceRecovery: false
  };
}

function isTimelinePlatformUsdDelayed(row) {
  return Number.isFinite(row.differenceSeconds) && row.differenceSeconds > 5 * 60;
}

function isWabtecPlatformPlaceholderDisruption(row) {
  const completedService = getTimelineCompletedService(row);
  return (
    completedService === "missed" ||
    (completedService === "partial" && row.actualMissing)
  );
}

function isWabtecOutOfSequenceRecovery(row, window) {
  return (
    Number.isFinite(row.actualMinute) &&
    Number.isFinite(window.latestDelayedActualMinute) &&
    minuteToSecond(row.actualMinute) < minuteToSecond(window.latestDelayedActualMinute)
  );
}

function hasWabtecTerminalHeadwayRecovered(row, terminalHeadways) {
  const actualHeadway = terminalHeadways.get(getTimelineTripDirectionKey(row));
  return !Number.isFinite(actualHeadway) || actualHeadway >= 5;
}

function pushCompletedWabtecPlatformWindow(windows, window) {
  if (!Number.isFinite(window.endMinute) || window.endMinute <= window.startMinute) {
    return;
  }

  windows.push({
    ...window,
    delayedRows: [...window.delayedRows],
    impactRows: [...window.impactRows]
  });
}

function buildWabtecPlatformUsdRows(concurrentWindows, platformDelayWindows) {
  const platformRows = [];

  concurrentWindows.forEach((concurrentWindow) => {
    const concurrentEndSecond = minuteToSecond(concurrentWindow.endMinute);

    platformDelayWindows.forEach((platformWindow) => {
      if (!timelineWindowsOverlap(platformWindow, concurrentWindow)) {
        return;
      }

      const overlapStartMinute = Math.max(
        platformWindow.startMinute,
        concurrentWindow.startMinute
      );
      const recoveryRow = platformWindow.recoveryRow;
      const recoveryScheduledBeforeConcurrentEnd =
        recoveryRow &&
        minuteToSecond(recoveryRow.scheduledMinute) <= concurrentEndSecond;
      const endMinute = recoveryScheduledBeforeConcurrentEnd
        ? platformWindow.endMinute
        : Math.min(platformWindow.endMinute, concurrentWindow.endMinute);
      const impactRowsInWindow = (platformWindow.impactRows || platformWindow.delayedRows).filter((row) => {
        const scheduledSecond = minuteToSecond(row.scheduledMinute);
        return (
          scheduledSecond >= minuteToSecond(overlapStartMinute) &&
          scheduledSecond <= minuteToSecond(endMinute)
        );
      });

      if (impactRowsInWindow.length === 0) {
        return;
      }

      const triggerRow = impactRowsInWindow[0];
      const endEvent = recoveryScheduledBeforeConcurrentEnd
        ? platformWindow.endEvent
        : buildWabtecConcurrentEndEvent(concurrentWindow, platformWindow, endMinute);

      if (minuteToSecond(endMinute) <= minuteToSecond(triggerRow.scheduledMinute)) {
        return;
      }

      platformRows.push({
        incidentId: concurrentWindow.id,
        numericId: concurrentWindow.numericId,
        platformId: platformWindow.platformId,
        stopCode: platformWindow.stopCode,
        stopIndex: platformWindow.stopIndex,
        directionCode: platformWindow.directionCode,
        tripId: triggerRow.tripId,
        blockId: triggerRow.blockId,
        lrvId: triggerRow.lrvId,
        startMinute: triggerRow.scheduledMinute,
        endMinute,
        triggerEvent: buildWabtecUsdTriggerEvent(triggerRow),
        incidentTriggerEvent: buildWabtecConcurrentTriggerEvent(concurrentWindow, platformWindow),
        endEvent
      });
    });
  });

  return platformRows.sort(compareWabtecPlatformRows);
}

function buildWabtecConcurrentTriggerEvent(concurrentWindow, platformWindow) {
  return {
    tripId: "",
    blockId: concurrentWindow.blockIds.join(", "),
    lrvId: concurrentWindow.lrvIds.join(", "),
    platformId: platformWindow.platformId,
    stopCode: platformWindow.stopCode,
    directionCode: platformWindow.directionCode,
    scheduledMinute: concurrentWindow.startMinute,
    actualMinute: concurrentWindow.startMinute,
    startMinute: concurrentWindow.startMinute,
    thresholdMinute: concurrentWindow.startMinute,
    differenceSeconds: null,
    eventType: "Concurrent disruption"
  };
}

function buildWabtecConcurrentEndEvent(concurrentWindow, platformWindow, endMinute) {
  return {
    tripId: "",
    blockId: concurrentWindow.blockIds.join(", "),
    lrvId: concurrentWindow.lrvIds.join(", "),
    platformId: platformWindow.platformId,
    stopCode: platformWindow.stopCode,
    directionCode: platformWindow.directionCode,
    scheduledMinute: concurrentWindow.endMinute,
    actualMinute: concurrentWindow.endMinute,
    resolvedMinute: endMinute,
    differenceSeconds: null,
    eventType: "Concurrent disruption",
    reason: "concurrent block disruption ended before this platform recovered"
  };
}

function buildWabtecUsdTriggerEvent(row) {
  return {
    tripId: row.tripId,
    blockId: row.blockId,
    lrvId: row.lrvId,
    platformId: row.platformId,
    stopCode: row.stopCode,
    directionCode: row.directionCode,
    scheduledMinute: row.scheduledMinute,
    actualMinute: row.actualMinute,
    startMinute: row.scheduledMinute,
    thresholdMinute: row.scheduledMinute,
    differenceSeconds: row.differenceSeconds,
    eventType: row.arrDep || "DEP"
  };
}

function buildWabtecUsdEndEvent(row, resolvedMinute, reason) {
  return {
    tripId: row.tripId,
    blockId: row.blockId,
    lrvId: row.lrvId,
    platformId: row.platformId,
    stopCode: row.stopCode,
    directionCode: row.directionCode,
    scheduledMinute: row.scheduledMinute,
    actualMinute: row.actualMinute,
    resolvedMinute,
    differenceSeconds: row.differenceSeconds,
    eventType: row.arrDep || "DEP",
    reason
  };
}

function addTimelineRowIdentity(window, row) {
  if (row.tripId) {
    window.tripIds.add(row.tripId);
  }

  if (row.lrvId) {
    window.lrvIds.add(row.lrvId);
  }
}

function addTimelineSweepEvent(eventsBySecond, second, event) {
  const events = eventsBySecond.get(second) || [];
  events.push(event);
  eventsBySecond.set(second, events);
}

function groupTimelineRows(rows, keyGetter) {
  const rowMap = new Map();

  rows.forEach((row) => {
    const key = keyGetter(row);
    if (!key) {
      return;
    }

    const group = rowMap.get(key) || [];
    group.push(row);
    rowMap.set(key, group);
  });

  return rowMap;
}

function compareTimelineRowsByTime(left, right) {
  const scheduledCompare = left.scheduledMinute - right.scheduledMinute;
  if (scheduledCompare !== 0) {
    return scheduledCompare;
  }

  return getArrDepSortOrder(left.arrDep) - getArrDepSortOrder(right.arrDep);
}

function compareWabtecPlatformWindows(left, right) {
  const stopCompare = left.stopIndex - right.stopIndex;
  if (stopCompare !== 0) {
    return stopCompare;
  }

  const directionCompare =
    getDirectionSortOrder(left.directionCode) - getDirectionSortOrder(right.directionCode);
  if (directionCompare !== 0) {
    return directionCompare;
  }

  return left.startMinute - right.startMinute;
}

function compareWabtecPlatformRows(left, right) {
  const incidentCompare = left.numericId - right.numericId;
  if (incidentCompare !== 0) {
    return incidentCompare;
  }

  const platformCompare = compareWabtecPlatformWindows(left, right);
  if (platformCompare !== 0) {
    return platformCompare;
  }

  return left.endMinute - right.endMinute;
}

function getArrDepSortOrder(arrDep) {
  return arrDep === "ARR" ? 0 : 1;
}

function getDirectionSortOrder(directionCode) {
  return directionCode === "SB" ? 0 : 1;
}

function isTimelineUsdDelayed(row) {
  return Number.isFinite(row.differenceSeconds) && row.differenceSeconds >= 5 * 60;
}

function minuteToSecond(minute) {
  return Math.round(minute * 60);
}

function timelineWindowsOverlap(left, right) {
  return (
    Number.isFinite(left.startMinute) &&
    Number.isFinite(left.endMinute) &&
    Number.isFinite(right.startMinute) &&
    Number.isFinite(right.endMinute) &&
    minuteToSecond(left.startMinute) <= minuteToSecond(right.endMinute) &&
    minuteToSecond(right.startMinute) <= minuteToSecond(left.endMinute)
  );
}

function buildDelayTable2Rows(markedRows) {
  const delayRows = [];
  const openRowsByPlatform = new Map();
  const lastDelayedRowByPlatform = new Map();

  markedRows.forEach((row) => {
    if (row.usdStatus === "Start") {
      const delayRow = {
        stopCode: row.stopCode,
        stopIndex: row.stopIndex,
        directionCode: row.directionCode,
        platformId: row.platformId,
        tripId: row.tripId,
        blockId: row.blockId,
        lrvId: row.lrvId,
        startMinute: row.scheduledMinute + 5,
        endMinute: null,
        triggerEvent: buildUsdTriggerEvent(row),
        endEvent: null,
        check: false,
        numericId: 0
      };

      delayRows.push(delayRow);
      openRowsByPlatform.set(row.platformId, delayRow);
      lastDelayedRowByPlatform.set(row.platformId, row);
      return;
    }

    if (row.usdStatus === "Cont") {
      lastDelayedRowByPlatform.set(row.platformId, row);
      return;
    }

    if (row.usdStatus === "End") {
      const openRow = openRowsByPlatform.get(row.platformId);
      const lastDelayedRow = lastDelayedRowByPlatform.get(row.platformId);
      if (openRow && lastDelayedRow) {
        openRow.endMinute = resolveUsdEndMinute(lastDelayedRow);
        openRow.endEvent = buildUsdEndEvent(lastDelayedRow);
      }

      openRowsByPlatform.delete(row.platformId);
      lastDelayedRowByPlatform.delete(row.platformId);
    }
  });

  const completedRows = delayRows
    .filter((row) => Number.isFinite(row.endMinute) && row.endMinute > row.startMinute)
    .sort((left, right) => left.startMinute - right.startMinute);

  for (let index = 1; index < completedRows.length; index += 1) {
    if (
      rowsOverlap(completedRows[index - 1], completedRows[index]) &&
      completedRows[index].tripId !== completedRows[index - 1].tripId
    ) {
      completedRows[index].check = true;
    }
  }

  let incidentId = 0;
  for (let index = 1; index < completedRows.length; index += 1) {
    const previousCheck = completedRows[index - 1].check;
    const currentCheck = completedRows[index].check;

    if (!previousCheck && currentCheck) {
      incidentId += 1;
    }

    if (currentCheck) {
      completedRows[index].numericId = incidentId;
    }
  }

  return completedRows;
}

function buildUnplannedServiceDisruption2Rows(delayTable2) {
  const platformRows = [];
  let currentId = 0;

  for (let index = 1; index < delayTable2.length; index += 1) {
    const previous = delayTable2[index - 1];
    const current = delayTable2[index];
    const previousCheck = previous.check;
    const currentCheck = current.check;

    if (currentCheck && !previousCheck) {
      currentId = current.numericId || previous.numericId || currentId || 0;
      platformRows.push(
        createPlatformUsdRow({
          sourceRow: previous,
          startMinute: current.startMinute,
          endMinute: previous.endMinute,
          numericId: currentId,
          incidentTriggerEvent: current.triggerEvent,
          endEvent: previous.endEvent
        })
      );
    } else if (currentCheck && previousCheck) {
      currentId = current.numericId || previous.numericId || currentId || 0;
      platformRows.push(
        createPlatformUsdRow({
          sourceRow: previous,
          startMinute: previous.startMinute,
          endMinute: previous.endMinute,
          numericId: currentId,
          incidentTriggerEvent: null,
          endEvent: previous.endEvent
        })
      );
    } else if (!currentCheck && previousCheck) {
      currentId = previous.numericId || currentId || 0;
      const endSource = delayTable2[index - 2] || previous;
      platformRows.push(
        createPlatformUsdRow({
          sourceRow: previous,
          startMinute: previous.startMinute,
          endMinute: endSource.endMinute,
          numericId: currentId,
          incidentTriggerEvent: null,
          endEvent: endSource.endEvent || previous.endEvent
        })
      );
    }
  }

  return platformRows.filter(
    (row) => row.numericId > 0 && Number.isFinite(row.endMinute) && row.endMinute > row.startMinute
  );
}

function createPlatformUsdRow({ sourceRow, startMinute, endMinute, numericId, incidentTriggerEvent, endEvent }) {
  return {
    incidentId: `usd-${numericId}`,
    numericId,
    platformId: sourceRow.platformId,
    stopCode: sourceRow.stopCode,
    stopIndex: sourceRow.stopIndex,
    directionCode: sourceRow.directionCode,
    tripId: sourceRow.tripId,
    blockId: sourceRow.blockId,
    lrvId: sourceRow.lrvId,
    startMinute,
    endMinute,
    triggerEvent: sourceRow.triggerEvent,
    incidentTriggerEvent,
    endEvent
  };
}

function collapsePlatformRowsByIncident(rows) {
  const grouped = new Map();

  rows.forEach((row) => {
    const key = `${row.platformId}::${row.numericId}`;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, { ...row });
      return;
    }

    existing.startMinute = Math.min(existing.startMinute, row.startMinute);
    if (row.endMinute >= existing.endMinute) {
      existing.endMinute = row.endMinute;
      existing.endEvent = row.endEvent;
    }

    if (row.startMinute <= existing.startMinute) {
      existing.triggerEvent = row.triggerEvent;
    }

    if (!existing.incidentTriggerEvent && row.incidentTriggerEvent) {
      existing.incidentTriggerEvent = row.incidentTriggerEvent;
    }
  });

  return [...grouped.values()];
}

function buildUiUsdIncidents(platformRows) {
  const incidentMap = new Map();

  platformRows.forEach((row) => {
    const existing = incidentMap.get(row.incidentId);
    if (!existing) {
      incidentMap.set(row.incidentId, {
        id: row.incidentId,
        numericId: row.numericId,
        startMinute: row.startMinute,
        endMinute: row.endMinute,
        startStopIndex: row.stopIndex,
        endStopIndex: row.stopIndex,
        tripIds: row.tripId ? [row.tripId] : [],
        blockIds: row.blockId ? [row.blockId] : [],
        lrvIds: row.lrvId ? [row.lrvId] : [],
        directionCodes: [row.directionCode],
        platformIds: [row.platformId],
        triggerEvent: row.triggerEvent,
        systemicTrigger: row.incidentTriggerEvent,
        endEvent: row.endEvent,
        windows: [row]
      });
      return;
    }

    existing.startMinute = Math.min(existing.startMinute, row.startMinute);
    if (row.endMinute >= existing.endMinute) {
      existing.endMinute = row.endMinute;
      existing.endEvent = row.endEvent;
    }

    existing.startStopIndex = Math.min(existing.startStopIndex, row.stopIndex);
    existing.endStopIndex = Math.max(existing.endStopIndex, row.stopIndex);
    existing.tripIds = [...new Set([...existing.tripIds, ...(row.tripId ? [row.tripId] : [])])];
    existing.blockIds = [...new Set([...existing.blockIds, ...(row.blockId ? [row.blockId] : [])])];
    existing.lrvIds = [...new Set([...existing.lrvIds, ...(row.lrvId ? [row.lrvId] : [])])];
    existing.directionCodes = [...new Set([...existing.directionCodes, row.directionCode])];
    existing.platformIds = [...new Set([...existing.platformIds, row.platformId])];
    existing.windows.push(row);

    const existingTriggerMinute =
      existing.triggerEvent.startMinute ?? existing.triggerEvent.thresholdMinute ?? existing.startMinute;
    if (row.startMinute < existingTriggerMinute) {
      existing.triggerEvent = row.triggerEvent;
    }

    if (!existing.systemicTrigger && row.incidentTriggerEvent) {
      existing.systemicTrigger = row.incidentTriggerEvent;
    }
  });

  return [...incidentMap.values()]
    .sort((left, right) => left.startMinute - right.startMinute)
    .map((incident) => ({
      ...incident,
      systemicTrigger: incident.systemicTrigger || incident.triggerEvent,
      summary: [
        "Derived from Wabtec-style concurrent block disruption platform windows.",
        `${incident.platformIds.length} platform${incident.platformIds.length > 1 ? "s" : ""} impacted`,
        `for ${formatDurationMinutes(incident.endMinute - incident.startMinute)}.`
      ].join(" ")
    }));
}

function rowsOverlap(left, right) {
  return (
    Number.isFinite(left.startMinute) &&
    Number.isFinite(left.endMinute) &&
    Number.isFinite(right.startMinute) &&
    Number.isFinite(right.endMinute) &&
    left.startMinute <= right.endMinute &&
    right.startMinute <= left.endMinute
  );
}

function buildTimelineUsdIncidents(rows) {
  const departureRows = rows
    .map(normalizeTimelineDepartureRow)
    .filter(Boolean)
    .filter(
      (row) =>
        row.arrDep === "DEP" &&
        !row.tripId.startsWith("R") &&
        row.stopCode !== "SFD"
    )
    .sort((left, right) => {
      const directionCompare = left.directionCode.localeCompare(right.directionCode);
      if (directionCompare !== 0) {
        return directionCompare;
      }

      const platformCompare = left.platformId.localeCompare(right.platformId);
      if (platformCompare !== 0) {
        return platformCompare;
      }

      return left.scheduledMinute - right.scheduledMinute;
    });

  if (departureRows.length === 0) {
    return [];
  }

  const markedRows = markTimelineUsdStatuses(departureRows);
  const platformWindows = buildPlatformDelayWindows(markedRows);
  return mergePlatformWindowsIntoUsdIncidents(platformWindows);
}

function normalizeTimelineDepartureRow(row) {
  const stopIndex = stops.findIndex((stop) => stop.shortName === String(row.Stop || "").trim());
  if (stopIndex === -1) {
    return null;
  }

  const scheduledMinute = parseTimestampToMinute(row.Scheduled);
  if (scheduledMinute === null) {
    return null;
  }

  const parsedActualMinute = parseTimestampToMinute(row.Actual);
  const actualMissing = parsedActualMinute === null;
  const actualMinute = parsedActualMinute ?? scheduledMinute;
  const tripId = String(row.Trip || "").trim();
  const directionCode = String(row.Direction || "").trim().toUpperCase() === "NB" ? "NB" : "SB";
  const differenceSeconds = parseDifferenceSeconds(row.Difference, actualMinute, scheduledMinute);

  return {
    tripId,
    blockId: String(row.Block || "").trim(),
    lrvId: String(row.LRVNo || row.Lrv || row.LRV || "").trim(),
    stopCode: String(row.Stop || "").trim(),
    stopIndex,
    arrDep: String(row["Arr.Dep"] || row.ArrDep || "").trim().toUpperCase(),
    scheduledMinute,
    actualMinute,
    actualMissing,
    differenceSeconds,
    directionCode,
    completedService: String(row.CompletedService || "").trim(),
    platformId: `${String(row.Stop || "").trim()}${directionCode}`
  };
}

function parseDifferenceSeconds(rawDifference, actualMinute, scheduledMinute) {
  const numericDifference = Number(rawDifference);
  if (Number.isFinite(numericDifference)) {
    return numericDifference;
  }

  if (actualMinute === null || scheduledMinute === null) {
    return Number.NaN;
  }

  return Math.round((actualMinute - scheduledMinute) * 60);
}

function markTimelineUsdStatuses(rows) {
  let previousRow = null;

  return rows
    .map((row) => {
      const nextRow = { ...row, usdStatus: "" };
      const samePlatform = previousRow && previousRow.platformId === nextRow.platformId;
      const previousStatus = previousRow?.usdStatus || "";
      const differenceSeconds = nextRow.differenceSeconds;

      if (Number.isFinite(differenceSeconds)) {
        if (samePlatform && differenceSeconds >= 5 * 60 && previousStatus === "") {
          nextRow.usdStatus = "Start";
        } else if (
          samePlatform &&
          differenceSeconds >= 5 * 60 &&
          (previousStatus === "Start" || previousStatus === "Cont")
        ) {
          nextRow.usdStatus = "Cont";
        } else if (
          samePlatform &&
          differenceSeconds < 5 * 60 &&
          (previousStatus === "Start" || previousStatus === "Cont")
        ) {
          nextRow.usdStatus = "End";
        } else if (!samePlatform && differenceSeconds >= 5 * 60) {
          nextRow.usdStatus = "Start";
        }
      } else if (samePlatform && previousStatus === "") {
        nextRow.usdStatus = "Start";
      } else if (
        samePlatform &&
        (previousStatus === "Start" || previousStatus === "Cont")
      ) {
        nextRow.usdStatus = "Cont";
      } else if (!samePlatform) {
        nextRow.usdStatus = "Start";
      }

      previousRow = nextRow;
      return nextRow;
    })
    .filter((row) => row.usdStatus !== "");
}

function buildPlatformDelayWindows(markedRows) {
  if (markedRows.length === 0) {
    return [];
  }

  const windows = [];
  let currentWindow = null;
  let lastDelayedRow = null;

  const finalizeWindow = () => {
    if (!currentWindow || !lastDelayedRow) {
      currentWindow = null;
      lastDelayedRow = null;
      return;
    }

    currentWindow.endMinute = resolveUsdEndMinute(lastDelayedRow);
    currentWindow.endEvent = buildUsdEndEvent(lastDelayedRow);
    if (currentWindow.endMinute > currentWindow.startMinute) {
      windows.push({
        ...currentWindow,
        tripIds: [...currentWindow.tripIds],
        blockIds: [...currentWindow.blockIds],
        lrvIds: [...currentWindow.lrvIds],
        platformIds: [...currentWindow.platformIds]
      });
    }

    currentWindow = null;
    lastDelayedRow = null;
  };

  markedRows.forEach((row) => {
    if (currentWindow && row.platformId !== currentWindow.platformId) {
      finalizeWindow();
    }

    if (row.usdStatus === "Start") {
      currentWindow = {
        platformId: row.platformId,
        directionCode: row.directionCode,
        startMinute: row.scheduledMinute + 5,
        endMinute: row.scheduledMinute + 5,
        startStopIndex: row.stopIndex,
        endStopIndex: row.stopIndex,
        tripIds: new Set(row.tripId ? [row.tripId] : []),
        blockIds: new Set(row.blockId ? [row.blockId] : []),
        lrvIds: new Set(row.lrvId ? [row.lrvId] : []),
        platformIds: new Set([row.platformId]),
        triggerEvent: buildUsdTriggerEvent(row)
      };
      lastDelayedRow = row;
      return;
    }

    if (!currentWindow) {
      return;
    }

    if (row.tripId) {
      currentWindow.tripIds.add(row.tripId);
    }

    if (row.blockId) {
      currentWindow.blockIds.add(row.blockId);
    }

    if (row.lrvId) {
      currentWindow.lrvIds.add(row.lrvId);
    }

    currentWindow.startStopIndex = Math.min(currentWindow.startStopIndex, row.stopIndex);
    currentWindow.endStopIndex = Math.max(currentWindow.endStopIndex, row.stopIndex);

    if (row.usdStatus === "Cont") {
      lastDelayedRow = row;
      return;
    }

    if (row.usdStatus === "End") {
      finalizeWindow();
    }
  });

  finalizeWindow();
  return windows;
}

function resolveUsdEndMinute(row) {
  const baseMinute = Number.isFinite(row.actualMinute) ? row.actualMinute : row.scheduledMinute;
  return baseMinute + 5;
}

function mergePlatformWindowsIntoUsdIncidents(platformWindows) {
  if (platformWindows.length === 0) {
    return [];
  }

  const sortedWindows = [...platformWindows].sort(
    (left, right) => left.startMinute - right.startMinute
  );
  const merged = [];

  sortedWindows.forEach((window) => {
    const previous = merged[merged.length - 1];
    if (!previous || window.startMinute > previous.endMinute) {
      merged.push(createUsdIncidentFromWindow(window));
      return;
    }

    const previousTripIds = new Set(previous.tripIds);
    const bringsNewTrip = window.tripIds.some((tripId) => !previousTripIds.has(tripId));

    previous.startMinute = Math.min(previous.startMinute, window.startMinute);
    previous.endMinute = Math.max(previous.endMinute, window.endMinute);
    previous.startStopIndex = Math.min(previous.startStopIndex, window.startStopIndex);
    previous.endStopIndex = Math.max(previous.endStopIndex, window.endStopIndex);
    previous.tripIds = [...new Set([...previous.tripIds, ...window.tripIds])];
    previous.blockIds = [...new Set([...previous.blockIds, ...window.blockIds])];
    previous.lrvIds = [...new Set([...previous.lrvIds, ...window.lrvIds])];
    previous.directionCodes = [...new Set([...previous.directionCodes, window.directionCode])];
    previous.platformIds = [...new Set([...previous.platformIds, ...window.platformIds])];
    previous.triggerEvents.push(window.triggerEvent);
    previous.endEvents.push(window.endEvent);
    previous.windows.push(window);

    if (!previous.systemicTrigger && bringsNewTrip) {
      previous.systemicTrigger = window.triggerEvent;
    }

    if (window.endMinute >= previous.endMinute) {
      previous.endEvent = window.endEvent;
    }
  });

  return merged
    .filter(
      (incident) =>
        incident.endMinute - incident.startMinute > 5 &&
        incident.tripIds.length > 1
    )
    .map((incident, index) => ({
      ...incident,
      id: `usd-${index + 1}`,
      summary: [
        "Derived from R-style delayed departure windows.",
        `${incident.tripIds.length} trips overlapped across ${incident.platformIds.length} platform windows`,
        `for ${formatDurationMinutes(incident.endMinute - incident.startMinute)}.`
      ].join(" "),
      systemicTrigger:
        incident.systemicTrigger ||
        incident.triggerEvents.find((event) => event.tripId !== incident.triggerEvent.tripId) ||
        incident.triggerEvent
    }));
}

function createUsdIncidentFromWindow(window) {
  return {
    startMinute: window.startMinute,
    endMinute: window.endMinute,
    startStopIndex: window.startStopIndex,
    endStopIndex: window.endStopIndex,
    tripIds: [...window.tripIds],
    blockIds: [...window.blockIds],
    lrvIds: [...window.lrvIds],
    directionCodes: [window.directionCode],
    platformIds: [...window.platformIds],
    triggerEvent: window.triggerEvent,
    triggerEvents: [window.triggerEvent],
    systemicTrigger: null,
    endEvent: window.endEvent,
    endEvents: [window.endEvent],
    windows: [window]
  };
}

function buildUsdTriggerEvent(row) {
  return {
    tripId: row.tripId,
    blockId: row.blockId,
    lrvId: row.lrvId,
    platformId: row.platformId,
    stopCode: row.stopCode,
    directionCode: row.directionCode,
    scheduledMinute: row.scheduledMinute,
    actualMinute: row.actualMinute,
    thresholdMinute: row.scheduledMinute + 5,
    differenceSeconds: row.differenceSeconds,
    eventType: row.arrDep || "DEP"
  };
}

function buildUsdEndEvent(row) {
  return {
    tripId: row.tripId,
    blockId: row.blockId,
    lrvId: row.lrvId,
    platformId: row.platformId,
    stopCode: row.stopCode,
    directionCode: row.directionCode,
    scheduledMinute: row.scheduledMinute,
    actualMinute: row.actualMinute,
    resolvedMinute: resolveUsdEndMinute(row),
    differenceSeconds: row.differenceSeconds,
    eventType: row.arrDep || "DEP",
    reason:
      Number.isFinite(row.differenceSeconds) && row.differenceSeconds < 5 * 60
        ? "delay recovered below 5 minutes"
        : "last delayed event in the active platform window"
  };
}

function buildTimelineKpi3Windows(rows, usdIncidents, lrvLookup = createEmptyKpi3LrvLookup()) {
  const movementRows = rows
    .map((row) => normalizeTimelineMovementRow(row, lrvLookup))
    .filter(Boolean)
    .filter((row) => row.assetKey)
    .sort((left, right) => {
      const assetCompare = left.assetKey.localeCompare(right.assetKey);
      if (assetCompare !== 0) {
        return assetCompare;
      }

      const tripCompare = left.tripId.localeCompare(right.tripId);
      if (tripCompare !== 0) {
        return tripCompare;
      }

      return left.scheduledMinute - right.scheduledMinute;
    });

  if (movementRows.length < 2 || usdIncidents.length === 0) {
    return [];
  }

  const windows = [];

  for (let index = 1; index < movementRows.length; index += 1) {
    const previous = movementRows[index - 1];
    const current = movementRows[index];

    if (previous.assetKey !== current.assetKey || previous.tripId !== current.tripId) {
      continue;
    }

    const impact = detectKpi3Impact(previous, current);
    if (!impact) {
      continue;
    }

    const startMinute = previous.scheduledMinute + 5;
    const endMinute = resolveKpi3WindowEndMinute(previous, current);
    if (!Number.isFinite(startMinute) || !Number.isFinite(endMinute) || endMinute <= startMinute) {
      continue;
    }

    const incident = findBestMatchingUsdIncident(startMinute, endMinute, usdIncidents);
    if (!incident) {
      continue;
    }

    windows.push({
      incidentId: incident.id,
      numericId: incident.numericId,
      assetKey: previous.assetKey,
      assetLabel: previous.assetLabel,
      assetKind: previous.assetKind,
      lrvId: previous.lrvId,
      blockId: previous.blockId,
      tripId: previous.tripId,
      directionCode: previous.directionCode,
      startMinute,
      endMinute,
      note: impact.note,
      triggerEvent: buildKpi3TriggerEvent(previous, current, impact, startMinute),
      endEvent: buildKpi3EndEvent(current, impact, endMinute)
    });
  }

  return windows;
}

function findBestMatchingUsdIncident(startMinute, endMinute, usdIncidents) {
  const matches = usdIncidents
    .map((incident) => {
      const overlapStart = Math.max(startMinute, incident.startMinute);
      const overlapEnd = Math.min(endMinute, incident.endMinute);
      const overlapMinutes = overlapEnd - overlapStart;

      return {
        incident,
        overlapMinutes,
        containsStart:
          startMinute >= incident.startMinute && startMinute <= incident.endMinute,
        containsEnd:
          endMinute >= incident.startMinute && endMinute <= incident.endMinute
      };
    })
    .filter((match) => match.overlapMinutes > 0)
    .sort((left, right) => {
      if (left.containsStart !== right.containsStart) {
        return left.containsStart ? -1 : 1;
      }

      if (left.containsEnd !== right.containsEnd) {
        return left.containsEnd ? -1 : 1;
      }

      if (right.overlapMinutes !== left.overlapMinutes) {
        return right.overlapMinutes - left.overlapMinutes;
      }

      if (left.incident.startMinute !== right.incident.startMinute) {
        return left.incident.startMinute - right.incident.startMinute;
      }

      return (left.incident.numericId || Number.MAX_SAFE_INTEGER) - (right.incident.numericId || Number.MAX_SAFE_INTEGER);
    });

  return matches[0]?.incident || null;
}

function normalizeTimelineMovementRow(row, lrvLookup = createEmptyKpi3LrvLookup()) {
  const stopCode = String(row.Stop || "").trim();
  const stopIndex = stops.findIndex((stop) => stop.shortName === stopCode);
  if (stopIndex === -1) {
    return null;
  }

  const scheduledMinute = parseTimestampToMinute(row.Scheduled);
  if (scheduledMinute === null) {
    return null;
  }

  const actualMinute = parseTimestampToMinute(row.Actual || row.Scheduled);
  const tripId = String(row.Trip || "").trim();
  if (!tripId || tripId.startsWith("R")) {
    return null;
  }

  const lrvInfo = normalizeKpi3LrvToken(row.LRVNo || row.Lrv || row.LRV || "");
  const directionCode = String(row.Direction || "").trim().toUpperCase() === "NB" ? "NB" : "SB";
  const resolvedLrvInfo = lrvInfo.key
    ? lrvInfo
    : resolveKpi3LrvInfoFromLookup({
        lrvLookup,
        tripId,
        stopCode,
        arrDep: String(row["Arr.Dep"] || row.ArrDep || "").trim().toUpperCase()
      });
  if (!resolvedLrvInfo.key) {
    return null;
  }
  const blockId = String(row.Block || "").trim();

  return {
    assetKey: resolvedLrvInfo.key,
    assetLabel: resolvedLrvInfo.label,
    assetKind: "LRV",
    lrvId: resolvedLrvInfo.label,
    blockId,
    tripId,
    stopCode,
    stopIndex,
    platformId: `${stopCode}${directionCode}`,
    directionCode,
    arrDep: String(row["Arr.Dep"] || row.ArrDep || "").trim().toUpperCase(),
    scheduledMinute,
    actualMinute,
    differenceSeconds: parseDifferenceSeconds(row.Difference, actualMinute, scheduledMinute)
  };
}

function detectKpi3Impact(previous, current) {
  const previousDifference = previous.differenceSeconds;
  const currentDifference = current.differenceSeconds;
  const note =
    current.arrDep === "ARR" ? "Held between platforms" : "Held at platform";

  if (Number.isFinite(previousDifference) && Number.isFinite(currentDifference)) {
    if (previousDifference <= 5 * 60 && currentDifference > 5 * 60) {
      return { reason: "threshold crossed above 5 minutes", note };
    }

    if (currentDifference - previousDifference > 5 * 60) {
      return { reason: "delay worsened by more than 5 minutes", note };
    }
  }

  if (
    !Number.isFinite(currentDifference) &&
    Number.isFinite(previousDifference) &&
    previousDifference > 5 * 60
  ) {
    return { reason: "delay remained above 5 minutes before missing next event", note };
  }

  return null;
}

function resolveKpi3WindowEndMinute(previous, current) {
  if (Number.isFinite(current.actualMinute)) {
    return current.actualMinute;
  }

  if (Number.isFinite(current.scheduledMinute)) {
    return current.scheduledMinute;
  }

  if (Number.isFinite(previous.actualMinute)) {
    return previous.actualMinute + 5;
  }

  return previous.scheduledMinute + 5;
}

function buildKpi3TriggerEvent(previous, current, impact, startMinute) {
  return {
    tripId: previous.tripId,
    blockId: previous.blockId,
    lrvId: previous.lrvId,
    platformId: previous.platformId,
    stopCode: previous.stopCode,
    directionCode: previous.directionCode,
    scheduledMinute: previous.scheduledMinute,
    actualMinute: previous.actualMinute,
    thresholdMinute: startMinute,
    differenceSeconds: previous.differenceSeconds,
    eventType: previous.arrDep || "DEP",
    reason: impact.reason,
    note: impact.note
  };
}

function buildKpi3EndEvent(current, impact, endMinute) {
  return {
    tripId: current.tripId,
    blockId: current.blockId,
    lrvId: current.lrvId,
    platformId: current.platformId,
    stopCode: current.stopCode,
    directionCode: current.directionCode,
    scheduledMinute: current.scheduledMinute,
    actualMinute: current.actualMinute,
    resolvedMinute: endMinute,
    differenceSeconds: current.differenceSeconds,
    eventType: current.arrDep || "DEP",
    reason: impact.reason,
    note: impact.note
  };
}

function buildKpi2Events(rows) {
  const serviceDateKey = getNotificationServiceDateKey(rows);
  return rows
    .flatMap((row) => expandKpi2Row(row, serviceDateKey))
    .filter(Boolean)
    .sort((left, right) => left.eventMinute - right.eventMinute);
}

function expandKpi2Row(row, serviceDateKey) {
  const type = String(row.type || "").trim();
  const messageId = String(row.messageId || "").trim();
  const eventMinute = parseTimestampToMinute(
    String(row.eventTime || "").trim(),
    serviceDateKey
  );

  if (!type || type === "----" || !messageId || messageId === "---------") {
    return [];
  }

  if (eventMinute === null) {
    return [];
  }

  const parts = type.split("&");
  const channel = parts[0] === "PA" ? "PA" : parts[0] === "PID" ? "PID" : "";
  const status = parts[parts.length - 1];
  if (!channel || !status) {
    return [];
  }

  return String(row.stationList || "")
    .split("&")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((platformToken) => {
      const platformId = normaliseKpi2Platform(platformToken);
      if (!platformId) {
        return null;
      }

      return {
        eventMinute,
        channel,
        status,
        messageId,
        platformId
      };
    })
    .filter(Boolean);
}

function getNotificationServiceDateKey(rows) {
  const dateKeys = rows
    .map((row) => {
      const match = String(row.eventTime || "").match(/^(\d{4})-(\d{2})-(\d{2}) /);
      return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
    })
    .filter(Boolean)
    .sort();

  return dateKeys[0] || "";
}

function normaliseKpi2Platform(token) {
  if (!token) {
    return "";
  }

  if (token.endsWith("1")) {
    return `${token.slice(0, -1)}SB`;
  }

  if (token.endsWith("2")) {
    return `${token.slice(0, -1)}NB`;
  }

  return token;
}

function buildKpi3Events(rows) {
  const serviceDateKey = getNotificationServiceDateKey(rows);
  return rows
    .flatMap((row) => expandKpi3Row(row, serviceDateKey))
    .filter(Boolean)
    .sort((left, right) => left.eventMinute - right.eventMinute);
}

function expandKpi3Row(row, serviceDateKey) {
  const type = String(row.type || "").trim().toUpperCase();
  const messageId = String(row.messageId || "").trim();
  const eventMinute = parseTimestampToMinute(
    String(row.eventTime || "").trim(),
    serviceDateKey
  );

  if (!type || type === "----" || !messageId || messageId === "---------") {
    return [];
  }

  if (eventMinute === null) {
    return [];
  }

  const parts = type.split("&").map((part) => part.trim()).filter(Boolean);
  const channelToken = parts[0] || "";
  const channels = [];
  if (channelToken.includes("PA")) {
    channels.push("PA");
  }
  if (channelToken.includes("PID")) {
    channels.push("PID");
  }
  const status = parts[parts.length - 1];
  if (channels.length === 0 || !status) {
    return [];
  }

  const targets = String(row.stationList || "")
    .split("&")
    .map((token) => normalizeKpi3TargetToken(token))
    .filter((target) => target.key);

  return targets.flatMap((target) =>
    channels.map((channel) => ({
      eventMinute,
      channel,
      status,
      messageId,
      assetKey: target.key,
      assetLabel: target.label
    }))
  );
}

function normalizeKpi3TargetToken(token) {
  const raw = String(token || "").trim();
  if (!raw) {
    return { key: "", label: "" };
  }

  const normalised = raw.toUpperCase().replace(/\s+/g, "");
  const digitMatch = normalised.match(/(\d{1,4})/);

  if (normalised.includes("LRV") || /^\d+$/.test(normalised)) {
    const digits = digitMatch ? digitMatch[1].padStart(3, "0") : normalised.replace(/\D/g, "");
    if (!digits) {
      return { key: "", label: "" };
    }

    return {
      key: `LRV:${digits}`,
      label: `LRV ${digits}`
    };
  }

  return {
    key: `BLOCK:${raw.toUpperCase()}`,
    label: `Block ${raw.toUpperCase()}`
  };
}

function normalizeKpi3LrvToken(token) {
  const lrvInfo = normalizeKpi3TargetToken(token);
  return lrvInfo.key.startsWith("LRV:") ? lrvInfo : { key: "", label: "" };
}

function createEmptyKpi3LrvLookup() {
  return {
    byTripEvent: new Map(),
    byTrip: new Map()
  };
}

function buildKpi3LrvLookupFromTimetableText(text) {
  const rows = parseCsvRows(text);
  if (rows.length < 2) {
    throw new Error("No usable timetable rows found.");
  }

  const flatLookup = buildFlatKpi3LrvLookup(rows);
  if (flatLookup.byTrip.size > 0) {
    return flatLookup;
  }

  const wideLookup = buildWideKpi3LrvLookup(rows);
  if (wideLookup.byTrip.size === 0 && wideLookup.byTripEvent.size === 0) {
    throw new Error("No Trip/Lrv mapping found in the timetable CSV.");
  }

  return wideLookup;
}

function buildFlatKpi3LrvLookup(rows) {
  const lookup = createEmptyKpi3LrvLookup();
  const header = rows[0].map((value) => String(value || "").trim().toUpperCase());
  const tripIndex = header.indexOf("TRIP");
  const lrvIndex = header.findIndex(
    (value) => value === "LRV" || value === "LRVNO" || value === "LRV NO"
  );

  if (tripIndex === -1 || lrvIndex === -1) {
    return lookup;
  }

  rows.slice(1).forEach((row) => {
    addKpi3TripLrvMapping(lookup, row[tripIndex], row[lrvIndex]);
  });

  return lookup;
}

function buildWideKpi3LrvLookup(rows) {
  const lookup = createEmptyKpi3LrvLookup();
  const [stopHeader, eventHeader, ...dataRows] = rows;
  const tripIndex = findKpi3TimetableColumnIndex(eventHeader, "TRIP");
  const lrvColumns = eventHeader
    .map((value, index) => ({
      value: String(value || "").trim().toUpperCase(),
      index
    }))
    .filter((column) => column.value === "LRV");

  if (tripIndex === -1 || lrvColumns.length === 0) {
    return lookup;
  }

  dataRows.forEach((row) => {
    const tripId = String(row[tripIndex] || "").trim();
    if (!tripId) {
      return;
    }

    const tripCandidates = [];
    lrvColumns.forEach((column) => {
      const lrvInfo = normalizeKpi3LrvToken(row[column.index]);
      if (!lrvInfo.key) {
        return;
      }

      tripCandidates.push(lrvInfo);
      const stopCode = String(stopHeader[column.index] || "").trim().toUpperCase();
      const arrDep = String(eventHeader[column.index + 1] || "").trim().toUpperCase();
      if (isKnownStopCode(stopCode) && (arrDep === "ARR" || arrDep === "DEP")) {
        lookup.byTripEvent.set(
          getKpi3TripEventLookupKey(tripId, stopCode, arrDep),
          lrvInfo
        );
      }
    });

    const fallbackLrvInfo = tripCandidates[0];
    if (fallbackLrvInfo && !lookup.byTrip.has(tripId)) {
      lookup.byTrip.set(tripId, fallbackLrvInfo);
    }
  });

  return lookup;
}

function findKpi3TimetableColumnIndex(header, columnName) {
  return header.findIndex(
    (value) => String(value || "").trim().toUpperCase() === columnName
  );
}

function addKpi3TripLrvMapping(lookup, rawTripId, rawLrv) {
  const tripId = String(rawTripId || "").trim();
  const lrvInfo = normalizeKpi3LrvToken(rawLrv);
  if (!tripId || !lrvInfo.key) {
    return;
  }

  lookup.byTrip.set(tripId, lrvInfo);
}

function resolveKpi3LrvInfoFromLookup({ lrvLookup, tripId, stopCode, arrDep }) {
  if (!lrvLookup) {
    return { key: "", label: "" };
  }

  return (
    lrvLookup.byTripEvent.get(getKpi3TripEventLookupKey(tripId, stopCode, arrDep)) ||
    lrvLookup.byTrip.get(String(tripId || "").trim()) ||
    { key: "", label: "" }
  );
}

function getKpi3TripEventLookupKey(tripId, stopCode, arrDep) {
  return [
    String(tripId || "").trim(),
    String(stopCode || "").trim().toUpperCase(),
    String(arrDep || "").trim().toUpperCase()
  ].join("::");
}

function isKnownStopCode(stopCode) {
  return stops.some((stop) => stop.shortName === stopCode);
}

function getVehicleAssetTarget(vehicle) {
  if (vehicle.lrvId) {
    return normalizeKpi3TargetToken(vehicle.lrvId);
  }

  if (vehicle.blockId) {
    return normalizeKpi3TargetToken(vehicle.blockId);
  }

  return { key: "", label: "" };
}

function formatAssetKey(assetKey) {
  if (!assetKey) {
    return "";
  }

  if (assetKey.startsWith("LRV:")) {
    return `LRV ${assetKey.slice(4)}`;
  }

  if (assetKey.startsWith("BLOCK:")) {
    return `Block ${assetKey.slice(6)}`;
  }

  return assetKey;
}

function compareUsdSort(leftIncidentId, leftNumericId, rightIncidentId, rightNumericId) {
  const leftOrder = getUsdSortOrder(leftIncidentId, leftNumericId);
  const rightOrder = getUsdSortOrder(rightIncidentId, rightNumericId);

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return String(leftIncidentId || "").localeCompare(String(rightIncidentId || ""));
}

function getUsdSortOrder(incidentId, numericId) {
  if (Number.isFinite(numericId)) {
    return numericId;
  }

  const match = String(incidentId || "").match(/usd-(\d+)/i);
  if (match) {
    return Number(match[1]);
  }

  return Number.MAX_SAFE_INTEGER;
}

function formatIncidentLabel(incidentId) {
  if (!incidentId) {
    return "";
  }

  if (incidentId.startsWith("usd-")) {
    return `USD ${incidentId.slice(4)}`;
  }

  return incidentId;
}

function buildKpi2IntervalCollections(kpi2Events) {
  return {
    PA: buildNotificationIntervals(kpi2Events.filter((event) => event.channel === "PA")),
    PID: buildNotificationIntervals(kpi2Events.filter((event) => event.channel === "PID"))
  };
}

function buildKpi3IntervalCollections(kpi3Events) {
  return {
    PA: buildAssetNotificationIntervals(kpi3Events.filter((event) => event.channel === "PA")),
    PID: buildAssetNotificationIntervals(kpi3Events.filter((event) => event.channel === "PID"))
  };
}

function evaluateKpi2(platformRows, intervalCollections) {
  const paIntervals = intervalCollections.PA;
  const pidIntervals = intervalCollections.PID;

  const rawResults = platformRows.map((window) =>
    evaluateKpi2PlatformWindow({
      window,
      paIntervals: paIntervals.get(window.platformId) || [],
      pidIntervals: pidIntervals.get(window.platformId) || []
    })
  );

  return collapseKpi2Results(rawResults);
}

function buildNotificationIntervals(events) {
  const platformMap = new Map();

  events.forEach((event) => {
    const list = platformMap.get(event.platformId) || [];
    list.push(event);
    platformMap.set(event.platformId, list);
  });

  const intervalMap = new Map();

  platformMap.forEach((platformEvents, platformId) => {
    const sorted = [...platformEvents].sort((left, right) => left.eventMinute - right.eventMinute);
    const intervals = [];
    const persistent = sorted.some((event) => event.channel === "PID");

    for (let index = 0; index < sorted.length; index += 1) {
      const event = sorted[index];
      if (event.status !== "START" && event.status !== "CONT") {
        continue;
      }

      let endMinute = event.eventMinute + 4;
      for (let lookAhead = index + 1; lookAhead < sorted.length; lookAhead += 1) {
        const candidate = sorted[lookAhead];
        if (candidate.status === "END") {
          endMinute = candidate.eventMinute;
          break;
        }
      }

      intervals.push({
        startMinute: event.eventMinute,
        endMinute,
        persistent,
        messageId: event.messageId
      });
    }

    intervalMap.set(platformId, intervals);
  });

  return intervalMap;
}

function buildAssetNotificationIntervals(events) {
  const assetMap = new Map();

  events.forEach((event) => {
    const list = assetMap.get(event.assetKey) || [];
    list.push(event);
    assetMap.set(event.assetKey, list);
  });

  const intervalMap = new Map();

  assetMap.forEach((assetEvents, assetKey) => {
    const sorted = [...assetEvents].sort((left, right) => left.eventMinute - right.eventMinute);
    const intervals = [];
    const persistent = sorted.some((event) => event.channel === "PID");

    for (let index = 0; index < sorted.length; index += 1) {
      const event = sorted[index];
      if (event.status !== "START" && event.status !== "CONT") {
        continue;
      }

      let endMinute = event.eventMinute + 4;
      for (let lookAhead = index + 1; lookAhead < sorted.length; lookAhead += 1) {
        const candidate = sorted[lookAhead];
        if (candidate.status === "END") {
          endMinute = candidate.eventMinute;
          break;
        }
      }

      intervals.push({
        startMinute: event.eventMinute,
        endMinute,
        persistent,
        messageId: event.messageId
      });
    }

    intervalMap.set(assetKey, intervals);
  });

  return intervalMap;
}

function collapseKpi2Results(rawResults) {
  const grouped = new Map();

  rawResults.forEach((result) => {
    const key = `${result.incidentId}::${result.platformId}`;
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        incidentId: result.incidentId,
        numericId: result.numericId,
        platformId: result.platformId,
        startMinute: result.startMinute,
        endMinute: result.endMinute,
        lengthMinutes: result.lengthMinutes,
        lengthCondition: result.lengthCondition,
        initialBreach: result.initialBreach,
        continuousBreach: result.continuousBreach,
        initialBreachMinute: result.initialBreachMinute,
        continuousBreachMinute: result.continuousBreachMinute,
        initialPoints: result.initialPoints,
        continuousPoints: result.continuousPoints,
        totalPoints: result.initialPoints + result.continuousPoints,
        paAssessment: result.paAssessment,
        pidAssessment: result.pidAssessment,
        windows: [result]
      });
      return;
    }

    existing.startMinute = Math.min(existing.startMinute, result.startMinute);
    existing.endMinute = Math.max(existing.endMinute, result.endMinute);
    existing.lengthMinutes = Math.max(existing.lengthMinutes, result.lengthMinutes);
    existing.lengthCondition = existing.lengthCondition || result.lengthCondition;
    existing.initialBreach = existing.initialBreach || result.initialBreach;
    existing.continuousBreach = existing.continuousBreach || result.continuousBreach;
    if (result.initialBreach && Number.isFinite(result.initialBreachMinute)) {
      existing.initialBreachMinute = Number.isFinite(existing.initialBreachMinute)
        ? Math.min(existing.initialBreachMinute, result.initialBreachMinute)
        : result.initialBreachMinute;
    }
    if (result.continuousBreach && Number.isFinite(result.continuousBreachMinute)) {
      existing.continuousBreachMinute = Number.isFinite(existing.continuousBreachMinute)
        ? Math.min(existing.continuousBreachMinute, result.continuousBreachMinute)
        : result.continuousBreachMinute;
    }
    existing.initialPoints = Math.max(existing.initialPoints, result.initialPoints);
    existing.continuousPoints = Math.max(existing.continuousPoints, result.continuousPoints);
    existing.totalPoints = existing.initialPoints + existing.continuousPoints;

    if (
      (!existing.paAssessment.initialWithin4 && result.paAssessment.initialWithin4) ||
      (existing.paAssessment.continuousWithin4 === false && result.paAssessment.continuousWithin4)
    ) {
      existing.paAssessment = result.paAssessment;
    }

    if (
      (!existing.pidAssessment.initialWithin4 && result.pidAssessment.initialWithin4) ||
      (existing.pidAssessment.continuousWithin4 === false && result.pidAssessment.continuousWithin4)
    ) {
      existing.pidAssessment = result.pidAssessment;
    }

    existing.windows.push(result);
  });

  return [...grouped.values()].sort((left, right) => {
    const incidentCompare = compareUsdSort(
      left.incidentId,
      left.numericId,
      right.incidentId,
      right.numericId
    );
    if (incidentCompare !== 0) {
      return incidentCompare;
    }

    return left.platformId.localeCompare(right.platformId);
  });
}

function evaluateKpi3(lrvWindows, intervalCollections) {
  const paIntervals = intervalCollections.PA;
  const pidIntervals = intervalCollections.PID;

  const rawResults = lrvWindows.map((window) =>
    evaluateKpi3AssetWindow({
      window,
      paIntervals: paIntervals.get(window.assetKey) || [],
      pidIntervals: pidIntervals.get(window.assetKey) || []
    })
  );

  return collapseKpi3Results(rawResults);
}

function collapseKpi3Results(rawResults) {
  const grouped = new Map();

  rawResults.forEach((result) => {
    const key = `${result.incidentId}::${result.assetKey}`;
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        incidentId: result.incidentId,
        numericId: result.numericId,
        assetKey: result.assetKey,
        assetLabel: result.assetLabel,
        assetKind: result.assetKind,
        lrvId: result.lrvId,
        blockId: result.blockId,
        tripId: result.tripId,
        startMinute: result.startMinute,
        endMinute: result.endMinute,
        lengthMinutes: result.lengthMinutes,
        lengthCondition: result.lengthCondition,
        initialBreach: result.initialBreach,
        continuousBreach: result.continuousBreach,
        initialBreachMinute: result.initialBreachMinute,
        continuousBreachMinute: result.continuousBreachMinute,
        initialPoints: result.initialPoints,
        continuousPoints: result.continuousPoints,
        totalPoints: result.initialPoints + result.continuousPoints,
        paAssessment: result.paAssessment,
        pidAssessment: result.pidAssessment,
        windows: [result]
      });
      return;
    }

    existing.startMinute = Math.min(existing.startMinute, result.startMinute);
    existing.endMinute = Math.max(existing.endMinute, result.endMinute);
    existing.lengthMinutes = Math.max(existing.lengthMinutes, result.lengthMinutes);
    existing.lengthCondition = existing.lengthCondition || result.lengthCondition;
    existing.initialBreach = existing.initialBreach || result.initialBreach;
    existing.continuousBreach = existing.continuousBreach || result.continuousBreach;
    if (result.initialBreach && Number.isFinite(result.initialBreachMinute)) {
      existing.initialBreachMinute = Number.isFinite(existing.initialBreachMinute)
        ? Math.min(existing.initialBreachMinute, result.initialBreachMinute)
        : result.initialBreachMinute;
    }
    if (result.continuousBreach && Number.isFinite(result.continuousBreachMinute)) {
      existing.continuousBreachMinute = Number.isFinite(existing.continuousBreachMinute)
        ? Math.min(existing.continuousBreachMinute, result.continuousBreachMinute)
        : result.continuousBreachMinute;
    }
    existing.initialPoints = Math.max(existing.initialPoints, result.initialPoints);
    existing.continuousPoints = Math.max(existing.continuousPoints, result.continuousPoints);
    existing.totalPoints = existing.initialPoints + existing.continuousPoints;
    existing.windows.push(result);
  });

  return [...grouped.values()].sort((left, right) => {
    const incidentCompare = compareUsdSort(
      left.incidentId,
      left.numericId,
      right.incidentId,
      right.numericId
    );
    if (incidentCompare !== 0) {
      return incidentCompare;
    }

    return left.assetLabel.localeCompare(right.assetLabel);
  });
}

function evaluateKpi2PlatformWindow({ window, paIntervals, pidIntervals }) {
  const paAssessment = assessNotificationChannel(window, paIntervals);
  const pidAssessment = assessNotificationChannel(window, pidIntervals);
  const lengthMinutes = Math.max(0, window.endMinute - window.startMinute);
  const lengthCondition = lengthMinutes > 4;
  const initialBreach =
    lengthCondition && (!paAssessment.initialWithin4 || !pidAssessment.initialWithin4);
  const continuousBreach =
    lengthCondition &&
    (!paAssessment.continuousWithin4 || !pidAssessment.continuousWithin4);
  const initialPoints = initialBreach ? 0.5 : 0;
  const continuousPoints = continuousBreach ? 2 : 0;
  const initialBreachMinute = initialBreach
    ? getEarliestBreachMinute([
        paAssessment.initialWithin4 ? null : paAssessment.initialFailureMinute,
        pidAssessment.initialWithin4 ? null : pidAssessment.initialFailureMinute
      ])
    : null;
  const continuousBreachMinute = continuousBreach
    ? getEarliestBreachMinute([
        paAssessment.continuousWithin4 ? null : paAssessment.continuousFailureMinute,
        pidAssessment.continuousWithin4 ? null : pidAssessment.continuousFailureMinute
      ])
    : null;

  return {
    incidentId: window.incidentId,
    numericId: window.numericId,
    platformId: window.platformId,
    startMinute: window.startMinute,
    endMinute: window.endMinute,
    lengthMinutes,
    lengthCondition,
    initialBreach,
    continuousBreach,
    initialBreachMinute,
    continuousBreachMinute,
    initialPoints,
    continuousPoints,
    totalPoints: initialPoints + continuousPoints,
    paAssessment,
    pidAssessment
  };
}

function evaluateKpi3AssetWindow({ window, paIntervals, pidIntervals }) {
  const paAssessment = assessNotificationChannel(window, paIntervals);
  const pidAssessment = assessNotificationChannel(window, pidIntervals);
  const lengthMinutes = Math.max(0, window.endMinute - window.startMinute);
  const lengthCondition = lengthMinutes > 4;
  const initialBreach =
    lengthCondition && (!paAssessment.initialWithin4 || !pidAssessment.initialWithin4);
  const continuousBreach =
    lengthCondition &&
    (!paAssessment.continuousWithin4 || !pidAssessment.continuousWithin4);
  const initialPoints = initialBreach ? 0.5 : 0;
  const continuousPoints = continuousBreach ? 2 : 0;
  const initialBreachMinute = initialBreach
    ? getEarliestBreachMinute([
        paAssessment.initialWithin4 ? null : paAssessment.initialFailureMinute,
        pidAssessment.initialWithin4 ? null : pidAssessment.initialFailureMinute
      ])
    : null;
  const continuousBreachMinute = continuousBreach
    ? getEarliestBreachMinute([
        paAssessment.continuousWithin4 ? null : paAssessment.continuousFailureMinute,
        pidAssessment.continuousWithin4 ? null : pidAssessment.continuousFailureMinute
      ])
    : null;

  return {
    incidentId: window.incidentId,
    numericId: window.numericId,
    assetKey: window.assetKey,
    assetLabel: window.assetLabel,
    assetKind: window.assetKind,
    lrvId: window.lrvId,
    blockId: window.blockId,
    tripId: window.tripId,
    startMinute: window.startMinute,
    endMinute: window.endMinute,
    lengthMinutes,
    lengthCondition,
    initialBreach,
    continuousBreach,
    initialBreachMinute,
    continuousBreachMinute,
    initialPoints,
    continuousPoints,
    totalPoints: initialPoints + continuousPoints,
    paAssessment,
    pidAssessment
  };
}

function assessNotificationChannel(window, intervals) {
  const overlapping = intervals
    .filter(
      (interval) =>
        interval.endMinute >= window.startMinute &&
        interval.startMinute <= window.endMinute
    )
    .sort((left, right) => left.startMinute - right.startMinute);

  if (overlapping.length === 0) {
    return {
      initialWithin4: false,
      continuousWithin4: false,
      firstStartMinute: null,
      lastEndMinute: null,
      initialFailureMinute: window.startMinute + 4,
      continuousFailureMinute: window.startMinute + 8
    };
  }

  const firstStart = overlapping[0].startMinute;
  const lastEnd = Math.max(...overlapping.map((interval) => interval.endMinute));
  const initialDeadline = window.startMinute + 4;
  const initialCandidates = intervals.filter(
    (interval) =>
      interval.startMinute <= initialDeadline &&
      interval.endMinute >= window.startMinute
  );
  const initialWithin4 = initialCandidates.length > 0;
  let continuousWithin4 = true;
  const continuousFailureCandidates = [];
  let lastMessageMinute = initialWithin4
    ? Math.max(...initialCandidates.map((interval) => interval.startMinute))
    : null;
  let deadline = window.startMinute + 8;

  if (!initialWithin4) {
    const seedCandidates = intervals.filter(
      (interval) =>
        interval.startMinute <= window.startMinute + 8 &&
        interval.endMinute >= window.startMinute
    );
    if (seedCandidates.length > 0) {
      lastMessageMinute = Math.max(...seedCandidates.map((interval) => interval.startMinute));
      deadline = lastMessageMinute + 4;
    }
  }

  if (!Number.isFinite(lastMessageMinute)) {
    continuousWithin4 = false;
    continuousFailureCandidates.push(window.startMinute + 8);
  }

  while (continuousWithin4 && deadline <= window.endMinute) {
    const persistentActive = intervals.some(
      (interval) =>
        interval.persistent &&
        interval.startMinute <= lastMessageMinute &&
        interval.endMinute >= deadline
    );

    if (persistentActive) {
      deadline += 4;
      continue;
    }

    const nextCandidates = intervals.filter(
      (interval) =>
        interval.startMinute > lastMessageMinute &&
        interval.startMinute <= deadline &&
        interval.endMinute >= window.startMinute
    );

    if (nextCandidates.length === 0) {
      continuousWithin4 = false;
      continuousFailureCandidates.push(deadline);
      break;
    }

    lastMessageMinute = Math.max(...nextCandidates.map((interval) => interval.startMinute));
    deadline = lastMessageMinute + 4;
  }

  return {
    initialWithin4,
    continuousWithin4,
    firstStartMinute: firstStart,
    lastEndMinute: lastEnd,
    initialFailureMinute: initialWithin4 ? null : window.startMinute + 4,
    continuousFailureMinute: getEarliestBreachMinute(continuousFailureCandidates)
  };
}

function getEarliestBreachMinute(candidates) {
  const numericCandidates = candidates.filter((value) => Number.isFinite(value));
  if (numericCandidates.length === 0) {
    return null;
  }

  return Math.min(...numericCandidates);
}

function buildMockUsdIncidents() {
  return disruptions
    .map((event, index) => {
      const impactedTrips = vehicles.flatMap((vehicle) =>
        vehicle.trips
          .filter(
            (trip) =>
              trip.departure <= event.endMinute &&
              trip.arrival >= event.startMinute &&
              trip.stopTimes.some(
                (stopTime) =>
                  stopTime.stopIndex >= event.startStopIndex &&
                  stopTime.stopIndex <= event.endStopIndex
              )
          )
          .map((trip) => ({
            tripId: trip.id,
            blockId: vehicle.label
          }))
      );

      return {
        id: `mock-usd-${index + 1}`,
        startMinute: event.startMinute,
        endMinute: event.endMinute,
        startStopIndex: event.startStopIndex,
        endStopIndex: event.endStopIndex,
        tripIds: [...new Set(impactedTrips.map((item) => item.tripId))],
        blockIds: [...new Set(impactedTrips.map((item) => item.blockId))],
        directionCodes: ["NB", "SB"],
        summary: event.summary
      };
    })
    .filter(
      (incident) =>
        incident.endMinute - incident.startMinute > 5 &&
        incident.blockIds.length > 1
    );
}

function renderTimelineUsdOverlay(usdIncidents) {
  const routeWindow = getCurrentRouteServiceWindow();
  const routeViewMode = getEffectiveRouteViewMode();
  const totalSpan = Math.max(1, routeWindow.max - routeWindow.min);
  const fragment = document.createDocumentFragment();

  usdIncidents.forEach((incident) => {
    const band = document.createElement("div");
    const tooltip = document.createElement("div");
    const causeEvent = incident.systemicTrigger || incident.triggerEvent;
    const incidentPoints = roundToTenth(
      getCurrentRouteKpi2Results()
        .filter((result) => result.incidentId === incident.id)
        .reduce((sum, result) => sum + result.totalPoints, 0)
    );
    const incidentKpi3Points = roundToTenth(
      state.kpi3Results
        .filter((result) => result.incidentId === incident.id)
        .reduce((sum, result) => sum + result.totalPoints, 0)
    );
    const start = ((incident.startMinute - routeWindow.min) / totalSpan) * 100;
    const width = ((incident.endMinute - incident.startMinute) / totalSpan) * 100;
    const tripSummary = incident.tripIds.length > 8
      ? `${incident.tripIds.slice(0, 8).join(", ")} +${incident.tripIds.length - 8} more`
      : incident.tripIds.join(", ");
    const tooltipText = [
      "USD Window",
      `Start: ${formatMinute(incident.startMinute, true)}`,
      `End: ${formatMinute(incident.endMinute, true)}`,
      `Duration: ${formatDurationMinutes(incident.endMinute - incident.startMinute)}`,
      `Directions: ${incident.directionCodes.join(" / ")}`,
      `Affected blocks/LRVs: ${incident.blockIds.join(", ")}`,
      `Affected trips: ${tripSummary}`,
      `Trigger event: ${formatUsdCauseSummary(causeEvent)}`,
      `First threshold event: ${formatUsdCauseSummary(incident.triggerEvent)}`,
      `Stop event: ${formatUsdStopSummary(incident.endEvent)}`,
      getCurrentRouteKpi2FileLabel() ? `KPI 02 points: ${incidentPoints.toFixed(1)}` : "",
      routeViewMode !== "kpi2log" && state.kpi3FileName ? `KPI 03 points: ${incidentKpi3Points.toFixed(1)}` : ""
    ].join("\n");

    band.className = "timeline-usd-band";
    tooltip.className = "timeline-usd-tooltip";
    band.style.left = `${Math.max(0, start)}%`;
    band.style.width = `${Math.max(0.8, width)}%`;
    band.tabIndex = 0;
    band.title = tooltipText;
    band.setAttribute("aria-label", tooltipText);
    tooltip.innerHTML = `
      <strong>USD Window</strong>
      <p>Start: ${formatMinute(incident.startMinute, true)}</p>
      <p>End: ${formatMinute(incident.endMinute, true)}</p>
      <p>Duration: ${formatDurationMinutes(incident.endMinute - incident.startMinute)}</p>
      <p>Directions: ${incident.directionCodes.join(" / ")}</p>
      <p>Affected blocks/LRVs: ${incident.blockIds.join(", ")}</p>
      <p>Affected trips: ${tripSummary}</p>
      <p>Trigger event: ${formatUsdCauseSummary(causeEvent)}</p>
      <p>First threshold event: ${formatUsdCauseSummary(incident.triggerEvent)}</p>
      <p>Stop event: ${formatUsdStopSummary(incident.endEvent)}</p>
      ${getCurrentRouteKpi2FileLabel() ? `<p>KPI 02 points: ${incidentPoints.toFixed(1)}</p>` : ""}
      ${routeViewMode !== "kpi2log" && state.kpi3FileName ? `<p>KPI 03 points: ${incidentKpi3Points.toFixed(1)}</p>` : ""}
    `;
    band.appendChild(tooltip);
    fragment.appendChild(band);
  });

  elements.timelineUsdOverlay.replaceChildren(fragment);
}

function parseTimestampToMinute(value, serviceDateKey = "") {
  if (!value) {
    return null;
  }

  const match = value.match(
    /(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/
  );
  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second, fractional = "0"] = match;
  const dayOffset = serviceDateKey
    ? Math.round(
        (Date.UTC(Number(year), Number(month) - 1, Number(day)) -
          Date.UTC(
            Number(serviceDateKey.slice(0, 4)),
            Number(serviceDateKey.slice(5, 7)) - 1,
            Number(serviceDateKey.slice(8, 10))
          )) /
          86400000
      )
    : 0;

  return (
    dayOffset * 24 * 60 +
    Number(hour) * 60 +
    Number(minute) +
    (Number(second) + Number(`0.${fractional}`)) / 60
  );
}

function getCurrentMinute() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
}

function formatMinute(minuteValue, includeSeconds = false) {
  const safeMinute = Math.max(0, minuteValue);
  const totalSeconds = Math.round(safeMinute * 60);
  const hours = Math.floor(totalSeconds / 3600) % 24;
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (includeSeconds) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatDurationMinutes(durationMinutes) {
  const totalSeconds = Math.max(0, Math.round(durationMinutes * 60));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function formatUsdCauseSummary(event) {
  if (!event) {
    return "Trigger event not available.";
  }

  return [
    event.tripId ? `Trip ${event.tripId}` : "",
    event.blockId ? `Block ${event.blockId}` : "",
    event.lrvId ? `LRV ${event.lrvId}` : "",
    event.platformId ? `${event.eventType} at ${event.platformId}` : "",
    `threshold at ${formatMinute(event.thresholdMinute, true)}`,
    Number.isFinite(event.differenceSeconds)
      ? formatDelaySeconds(event.differenceSeconds)
      : ""
  ]
    .filter(Boolean)
    .join(" • ");
}

function formatUsdStopSummary(event) {
  if (!event) {
    return "Stop event not available.";
  }

  return [
    `Stopped at ${formatMinute(event.resolvedMinute, true)}`,
    event.tripId ? `Trip ${event.tripId}` : "",
    event.blockId ? `Block ${event.blockId}` : "",
    event.lrvId ? `LRV ${event.lrvId}` : "",
    event.platformId ? `${event.eventType} at ${event.platformId}` : "",
    event.reason || "",
    Number.isFinite(event.differenceSeconds)
      ? formatDelaySeconds(event.differenceSeconds)
      : ""
  ]
    .filter(Boolean)
    .join(" • ");
}

function formatDelaySeconds(delaySeconds) {
  const minutes = Math.round((delaySeconds / 60) * 10) / 10;

  if (minutes > 0.5) {
    return `${minutes.toFixed(1)} min late`;
  }

  if (minutes < -0.5) {
    return `${Math.abs(minutes).toFixed(1)} min early`;
  }

  return "On time";
}
