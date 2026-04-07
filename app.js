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
  kpi3Events: [],
  kpi3FileName: "",
  kpi3Results: [],
  kpi3TotalPoints: 0,
  kpi3Intervals: { PA: new Map(), PID: new Map() },
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
  kpi3Input: document.querySelector("#kpi3Input"),
  kpi3Status: document.querySelector("#kpi3Status"),
  playPauseButton: document.querySelector("#playPauseButton"),
  speedSelect: document.querySelector("#speedSelect"),
  liveButton: document.querySelector("#liveButton"),
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
  elements.kpi3Input.addEventListener("change", handleKpi3Selection);
  elements.liveButton.addEventListener("click", jumpToLive);
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

function render() {
  const activeDisruptions = getActiveDisruptions();
  const activeUsdIncidents = getActiveUsdIncidents();
  const allUsdIncidents = getAllUsdIncidents();
  const activeVehicles = getActiveVehicles();

  elements.timeSlider.min = String(state.serviceWindow.min);
  elements.timeSlider.max = String(state.serviceWindow.max);
  elements.timeSlider.value = String(Math.round(state.simulationMinute));
  elements.clockLabel.textContent = formatMinute(state.simulationMinute, true);
  elements.timelineLabel.textContent = formatMinute(state.simulationMinute, true);
  elements.timelineStart.textContent = formatMinute(state.serviceWindow.min, true);
  elements.timelineEnd.textContent = formatMinute(state.serviceWindow.max, true);
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
  elements.kpi3Status.textContent = state.kpi3FileName
    ? `Loaded ${state.kpi3FileName}`
    : "No KPI 03 file loaded.";
  renderTimelineUsdOverlay(allUsdIncidents);

  renderRoute(activeVehicles, activeDisruptions, activeUsdIncidents);
  renderNetworkStatus(activeVehicles, activeDisruptions, activeUsdIncidents);
  renderKpi2Status();
  renderKpi3Status();
  renderKpi2Audit();
  renderKpi3Audit();
  renderDisruptions(activeUsdIncidents);
  renderVehicles(activeVehicles);
  renderMessageInspector();
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
    const kpi3Points = getCurrentKpi3PointsForAsset(assetTarget.key);
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

  state.kpi2Results.forEach((result) => {
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
  if (activeUsdIncidents.length > 0) {
    const affectedTrips = new Set(activeUsdIncidents.flatMap((incident) => incident.blockIds)).size;
    elements.networkState.textContent = "USD active";
    elements.networkSummary.textContent = `Systemic interruption detected: ${affectedTrips} impacted LRVs/blocks for more than 5 minutes.`;
  } else if (activeDisruptions.length === 0) {
    elements.networkState.textContent = state.dataSource === "timeline" ? "Timeline playback" : "Normal service";
    elements.networkSummary.textContent =
      state.dataSource === "timeline"
        ? "Playback is using actual trip events from the loaded CSV."
        : "No active disruption.";
  } else {
    elements.networkState.textContent = activeDisruptions.length > 1 ? "Multiple disruptions" : "Disruption active";
    elements.networkSummary.textContent = activeDisruptions
      .map((event) => event.title)
      .join(" ");
  }

  elements.activeCount.textContent = String(activeVehicles.length);

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
  if (!state.kpi2FileName) {
    elements.kpi2Total.textContent = "--";
    elements.kpi2Summary.textContent = "Load a KPI 02 CSV to assess stop notifications.";
    return;
  }

  if (state.dataSource !== "timeline" || state.timelineUsdPlatformRows.length === 0) {
    elements.kpi2Total.textContent = "0.0";
    elements.kpi2Summary.textContent = "Load a Timeline CSV with USD windows to score KPI 02.";
    return;
  }

  const breachCount = state.kpi2Results.filter((result) => result.totalPoints > 0).length;
  elements.kpi2Total.textContent = state.kpi2TotalPoints.toFixed(1);
  elements.kpi2Summary.textContent =
    breachCount === 0
      ? "No KPI 02 point failures detected for the loaded USD windows."
        : `${breachCount} platform breach${breachCount > 1 ? "es" : ""} across the loaded USD windows.`;
}

function renderKpi3Status() {
  if (!state.kpi3FileName) {
    elements.kpi3Total.textContent = "--";
    elements.kpi3Summary.textContent = "Load a KPI 03 CSV to assess onboard notifications.";
    return;
  }

  if (state.dataSource !== "timeline" || state.timelineKpi3Rows.length === 0) {
    elements.kpi3Total.textContent = "0.0";
    elements.kpi3Summary.textContent =
      "Load a Timeline CSV with identifiable LRVs to score KPI 03.";
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
  if (!state.kpi2FileName) {
    elements.kpi2Audit.innerHTML = '<div class="audit-empty">Load a KPI 02 CSV to inspect platform-level scoring.</div>';
    return;
  }

  if (state.dataSource !== "timeline" || state.timelineUsdPlatformRows.length === 0) {
    elements.kpi2Audit.innerHTML = '<div class="audit-empty">Load a Timeline CSV with USD windows to build the KPI 02 audit table.</div>';
    return;
  }

  if (state.kpi2Results.length === 0) {
    elements.kpi2Audit.innerHTML = '<div class="audit-empty">No KPI 02 audit rows were generated for the loaded files.</div>';
    return;
  }

  const rows = state.kpi2Results
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
  if (!state.kpi3FileName) {
    elements.kpi3Audit.innerHTML = '<div class="audit-empty">Load a KPI 03 CSV to inspect onboard scoring.</div>';
    return;
  }

  if (state.dataSource !== "timeline" || state.timelineKpi3Rows.length === 0) {
    elements.kpi3Audit.innerHTML = '<div class="audit-empty">Load a Timeline CSV with identifiable LRVs to build the KPI 03 audit table.</div>';
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
    const kpi2Rows = state.kpi2Results.filter((result) => result.incidentId === event.id);
    const kpi3Rows = state.kpi3Results.filter((result) => result.incidentId === event.id);
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
      ${state.kpi2FileName ? `<p>KPI 02 points for this USD: ${incidentPoints.toFixed(1)}</p>` : ""}
      ${state.kpi3FileName ? `<p>KPI 03 points for this USD: ${incidentKpi3Points.toFixed(1)}</p>` : ""}
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

function renderVehicles(activeVehicles) {
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

  activeVehicles
    .sort((left, right) => left.progressPercent - right.progressPercent)
    .forEach((vehicle) => {
      const item = document.createElement("article");
      item.className = "stack-item";
      item.innerHTML = `
        <h4>${vehicle.label}</h4>
        <p>${vehicle.locationLabel}</p>
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
      state.timelineTrips = timelineTrips;
      state.timelineUsdIncidents = usdModel.incidents;
      state.timelineUsdPlatformRows = usdModel.platformRows;
      state.timelineKpi3Rows = buildTimelineKpi3Windows(rows, usdModel.incidents);
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

function getCurrentKpi3PointsForAsset(assetKey) {
  if (!assetKey) {
    return 0;
  }

  return roundToTenth(
    state.kpi3Results
      .filter((result) => result.assetKey === assetKey)
      .reduce((sum, result) => sum + getKpi3PointsAtMinute(result, state.simulationMinute), 0)
  );
}

function getVehicleTooltipPointLines(vehicle) {
  const lines = [];
  const platformIds = [...new Set(vehicle.tooltipPlatformIds || [])];

  platformIds.forEach((platformId) => {
    const points = roundToTenth(
      state.kpi2Results
        .filter((result) => result.platformId === platformId)
        .reduce((sum, result) => sum + getKpi2PointsAtMinute(result, state.simulationMinute), 0)
    );

    if (points > 0) {
      lines.push(`KPI 02 ${platformId} ${points.toFixed(1)} PP`);
    }
  });

  const assetTarget = getVehicleAssetTarget(vehicle);
  if (assetTarget.key) {
    const points = getCurrentKpi3PointsForAsset(assetTarget.key);

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

  const [header, ...data] = rows;
  return data.map((values) =>
    Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""]))
  );
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
    return {
      delayTable2: [],
      platformRows: [],
      incidents: []
    };
  }

  const markedRows = markTimelineUsdStatuses(departureRows);
  const delayTable2 = buildDelayTable2Rows(markedRows);
  const rawPlatformRows = buildUnplannedServiceDisruption2Rows(delayTable2);

  return {
    delayTable2,
    platformRows: rawPlatformRows,
    incidents: buildUiUsdIncidents(rawPlatformRows)
  };
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

    if (row.startMinute < existing.triggerEvent.startMinute) {
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
        "Derived from DelayTable2 and UnplannedServiceDisruption2 style platform windows.",
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

  const actualMinute = parseTimestampToMinute(row.Actual || row.Scheduled) ?? scheduledMinute;
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
    differenceSeconds,
    directionCode,
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

function buildTimelineKpi3Windows(rows, usdIncidents) {
  const movementRows = rows
    .map(normalizeTimelineMovementRow)
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

    const overlappingIncidents = usdIncidents.filter(
      (incident) =>
        incident.startMinute <= endMinute && incident.endMinute >= startMinute
    );

    overlappingIncidents.forEach((incident) => {
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
    });
  }

  return windows;
}

function normalizeTimelineMovementRow(row) {
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

  const lrvInfo = normalizeKpi3TargetToken(row.LRVNo || row.Lrv || row.LRV || "");
  const blockId = String(row.Block || "").trim();
  const assetKey = lrvInfo.key || (blockId ? `BLOCK:${blockId.toUpperCase()}` : "");
  const assetLabel = lrvInfo.label || (blockId ? `Block ${blockId}` : "");
  const directionCode = String(row.Direction || "").trim().toUpperCase() === "NB" ? "NB" : "SB";

  return {
    assetKey,
    assetLabel,
    assetKind: lrvInfo.key ? "LRV" : "BLOCK",
    lrvId: lrvInfo.label,
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
  return rows
    .flatMap((row) => expandKpi2Row(row))
    .filter(Boolean)
    .sort((left, right) => left.eventMinute - right.eventMinute);
}

function expandKpi2Row(row) {
  const type = String(row.type || "").trim();
  const messageId = String(row.messageId || "").trim();
  const eventMinute = parseTimestampToMinute(String(row.eventTime || "").trim());

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
  return rows
    .flatMap((row) => expandKpi3Row(row))
    .filter(Boolean)
    .sort((left, right) => left.eventMinute - right.eventMinute);
}

function expandKpi3Row(row) {
  const type = String(row.type || "").trim().toUpperCase();
  const messageId = String(row.messageId || "").trim();
  const eventMinute = parseTimestampToMinute(String(row.eventTime || "").trim());

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
    const readFlags = new Array(sorted.length).fill(false);

    for (let index = 0; index < sorted.length; index += 1) {
      const event = sorted[index];
      if ((event.status !== "START" && event.status !== "CONT") || readFlags[index]) {
        continue;
      }

      let endMinute = event.eventMinute + 4;
      let endFound = false;
      for (let lookAhead = index + 1; lookAhead < sorted.length; lookAhead += 1) {
        const candidate = sorted[lookAhead];
        const unread = !readFlags[lookAhead];

        if (!endFound && candidate.status === "END" && unread) {
          endMinute = candidate.eventMinute;
          endFound = true;
        }

        readFlags[lookAhead] = true;

        if (endFound) {
          break;
        }
      }

      intervals.push({
        startMinute: event.eventMinute,
        endMinute,
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
    const readFlags = new Array(sorted.length).fill(false);

    for (let index = 0; index < sorted.length; index += 1) {
      const event = sorted[index];
      if ((event.status !== "START" && event.status !== "CONT") || readFlags[index]) {
        continue;
      }

      let endMinute = event.eventMinute + 4;
      let endFound = false;
      for (let lookAhead = index + 1; lookAhead < sorted.length; lookAhead += 1) {
        const candidate = sorted[lookAhead];
        const unread = !readFlags[lookAhead];

        if (!endFound && candidate.status === "END" && unread) {
          endMinute = candidate.eventMinute;
          endFound = true;
        }

        readFlags[lookAhead] = true;

        if (endFound) {
          break;
        }
      }

      intervals.push({
        startMinute: event.eventMinute,
        endMinute,
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
      continuousFailureMinute: window.startMinute + 4
    };
  }

  const firstStart = overlapping[0].startMinute;
  const initialWithin4 = firstStart <= window.startMinute + 4;
  const lastEnd = Math.max(...overlapping.map((interval) => interval.endMinute));
  let continuousWithin4 = true;
  const continuousFailureCandidates = [];

  if (lastEnd < window.endMinute - 4) {
    continuousWithin4 = false;
    continuousFailureCandidates.push(lastEnd + 4);
  }

  for (let index = 1; index < overlapping.length; index += 1) {
    const previous = overlapping[index - 1];
    const current = overlapping[index];
    if (current.startMinute > previous.endMinute + 4) {
      continuousWithin4 = false;
      continuousFailureCandidates.push(previous.endMinute + 4);
    }
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
  const totalSpan = Math.max(1, state.serviceWindow.max - state.serviceWindow.min);
  const fragment = document.createDocumentFragment();

  usdIncidents.forEach((incident) => {
    const band = document.createElement("div");
    const tooltip = document.createElement("div");
    const causeEvent = incident.systemicTrigger || incident.triggerEvent;
    const incidentPoints = roundToTenth(
      state.kpi2Results
        .filter((result) => result.incidentId === incident.id)
        .reduce((sum, result) => sum + result.totalPoints, 0)
    );
    const incidentKpi3Points = roundToTenth(
      state.kpi3Results
        .filter((result) => result.incidentId === incident.id)
        .reduce((sum, result) => sum + result.totalPoints, 0)
    );
    const start = ((incident.startMinute - state.serviceWindow.min) / totalSpan) * 100;
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
      state.kpi2FileName ? `KPI 02 points: ${incidentPoints.toFixed(1)}` : "",
      state.kpi3FileName ? `KPI 03 points: ${incidentKpi3Points.toFixed(1)}` : ""
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
      ${state.kpi2FileName ? `<p>KPI 02 points: ${incidentPoints.toFixed(1)}</p>` : ""}
      ${state.kpi3FileName ? `<p>KPI 03 points: ${incidentKpi3Points.toFixed(1)}</p>` : ""}
    `;
    band.appendChild(tooltip);
    fragment.appendChild(band);
  });

  elements.timelineUsdOverlay.replaceChildren(fragment);
}

function parseTimestampToMinute(value) {
  if (!value) {
    return null;
  }

  const match = value.match(
    /(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/
  );
  if (!match) {
    return null;
  }

  const [, , , , hour, minute, second, fractional = "0"] = match;
  return Number(hour) * 60 + Number(minute) + (Number(second) + Number(`0.${fractional}`)) / 60;
}

function getCurrentMinute() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
}

function formatMinute(minuteValue, includeSeconds = false) {
  const safeMinute = Math.max(0, Math.min(minuteValue, 24 * 60));
  const hours = Math.floor(safeMinute / 60) % 24;
  const minutes = Math.floor(safeMinute % 60);
  const seconds = Math.floor((safeMinute - Math.floor(safeMinute)) * 60);

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
