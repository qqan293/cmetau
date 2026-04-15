#setwd("C:/Users/svcPowerBi/OneDrive - Canberra Metro Operation/Business_Statistics - 03_R_Code/00_Published R_Code")

#library.path <- .libPaths()[1]
#install.packages("quantmod", repos = "http://cran.us.r-project.org", lib=library.path)

#require("quantmod")

library(curl)
library(RCurl)
library(data.table)
library(lubridate)
library(stringr)
library(anytime)
library(dplyr)
library(DescTools)
library(XML)
library(methods)
#library(xlsx)



rm(list = ls())

# Select date using day runner: 0 = yesterday
date_runner <- 76


# KPI2and3 <- function(date_runner){

o_date <- as.Date(today() - date_runner - 1)

month_string <- format(o_date, format = "%Y%m. %B %Y")
date_string_1 <- format(o_date, format = "%y%m%d")
date_string <- format(o_date, format = "%d%m%Y")


#folder_string_1 <- paste("C:/Users/svcPowerBI/OneDrive - Canberra Metro Operation/Business_Statistics - 01_Datasets/01_Cleaned Data/01_AOTRA/Timeline/", month_string, "/", sep = "")

#setwd(folder_string_1)



Timeline <- read.csv(paste("/Users/laylatran/Documents/CMET/202601. January 2026/Timeline-", date_string, ".csv", sep = ""))

### Wabtec-aligned KPI 2 and 3 -----------------------------------------------

kpi_stop_order <- c("GGN", "MCK", "MPN", "NLR", "WSN", "EPC", "SFD", "PLP",
                    "SWN", "DKN", "MCR", "IPA", "ELA", "ALG")

as_kpi_time <- function(value) {
  value <- as.character(value)
  hour <- suppressWarnings(as.numeric(substr(value, 12, 13)))
  minute <- suppressWarnings(as.numeric(substr(value, 15, 16)))
  second <- suppressWarnings(as.numeric(substr(value, 18, nchar(value))))
  service_seconds <- hour * 60 * 60 + minute * 60 + second
  as.POSIXct(service_seconds, origin = "1970-01-01", tz = "UTC")
}

as_notification_time <- function(value, service_date) {
  notification_time <- as_kpi_time(value)
  event_date <- suppressWarnings(as.Date(substr(as.character(value), 1, 10)))
  if (is.na(notification_time) || is.na(event_date) || is.na(service_date)) {
    return(notification_time)
  }

  notification_time + as.numeric(event_date - service_date) * 24 * 60 * 60
}

notification_service_date <- function(values) {
  dates <- suppressWarnings(as.Date(substr(as.character(values), 1, 10)))
  dates <- dates[!is.na(dates)]
  if (length(dates) == 0) {
    return(as.Date(NA))
  }
  min(dates)
}

restore_kpi_date <- function(value, date_value) {
  base <- as.POSIXct(paste(as.Date(date_value), "00:00:00"), tz = "Australia/Sydney")
  base + as.numeric(value)
}

kpi_platform_id <- function(stop, direction) {
  paste0(as.character(stop), as.character(direction))
}

kpi_stop_index <- function(stop) {
  match(as.character(stop), kpi_stop_order)
}

kpi_direction_order <- function(direction) {
  ifelse(as.character(direction) == "SB", 0, 1)
}

prepare_kpi_timeline <- function(timeline) {
  out <- timeline
  out$Trip <- as.character(out$Trip)
  out$Block <- as.character(out$Block)
  out$Stop <- as.character(out$Stop)
  out$Arr.Dep <- as.character(out$Arr.Dep)
  out$Direction <- as.character(out$Direction)
  out$ScheduledTime <- as_kpi_time(out$Scheduled)
  out$ActualTime <- as_kpi_time(out$Actual)
  missing_actual <- is.na(out$ActualTime) & !is.na(out$ScheduledTime)
  out$ActualMissing <- missing_actual
  out$ActualTime[missing_actual] <- out$ScheduledTime[missing_actual]
  out$DifferenceSeconds <- suppressWarnings(as.numeric(out$Difference))

  missing_difference <- is.na(out$DifferenceSeconds) &
    !is.na(out$ActualTime) & !is.na(out$ScheduledTime)
  out$DifferenceSeconds[missing_difference] <- as.numeric(
    difftime(out$ActualTime[missing_difference],
             out$ScheduledTime[missing_difference],
             units = "secs")
  )

  out$Platform <- kpi_platform_id(out$Stop, out$Direction)
  out <- out[!is.na(out$ScheduledTime) & substring(out$Trip, 1, 1) != "R", ]
  out
}

is_kpi_delayed <- function(row) {
  !is.na(row$DifferenceSeconds) && row$DifferenceSeconds >= 5 * 60
}

is_wabtec_block_delayed <- function(row) {
  !is.na(row$DifferenceSeconds) && row$DifferenceSeconds > 5 * 60
}

is_wabtec_block_placeholder_disruption <- function(row) {
  completed_service <- completed_service_value(row)
  completed_service == "missed" ||
    (completed_service == "partial" && isTRUE(row$ActualMissing))
}

completed_service_value <- function(row) {
  if (!("CompletedService" %in% names(row))) {
    return("")
  }
  tolower(trimws(as.character(row$CompletedService)))
}

can_wabtec_block_row_recover <- function(row, window) {
  completed_service <- completed_service_value(row)
  if (completed_service == "missed") {
    return(FALSE)
  }

  if (completed_service == "partial" &&
      !is.na(row$ActualTime) &&
      !is.null(window$LatestDelayedActualTime) &&
      !is.na(window$LatestDelayedActualTime) &&
      row$ActualTime < window$LatestDelayedActualTime) {
    return(FALSE)
  }

  TRUE
}

is_kpi_window_longer_than <- function(start_time, stop_time, threshold_mins) {
  length_mins <- as.numeric(difftime(stop_time, start_time, units = "mins"))
  !is.na(length_mins) && length_mins > threshold_mins
}

append_list_row <- function(rows, row) {
  rows[[length(rows) + 1]] <- row
  rows
}

build_wabtec_block_windows <- function(timeline) {
  rows <- prepare_kpi_timeline(timeline)
  blocks <- split(rows, rows$Block)
  windows <- list()

  for (block_id in names(blocks)) {
    block_rows <- blocks[[block_id]]
    block_rows <- block_rows[order(block_rows$ScheduledTime,
                                   ifelse(block_rows$Arr.Dep == "ARR", 0, 1)), ]
    current <- NULL
    last_disrupted <- NULL

    for (i in seq_len(nrow(block_rows))) {
      row <- block_rows[i, ]
      if (row$Arr.Dep != "DEP") {
        next
      }

      if (is_wabtec_block_delayed(row)) {
        if (is.null(current)) {
          current <- list(
            Block = block_id,
            StartTime = row$ScheduledTime,
            StopTime = row$ScheduledTime,
            Trip = row$Trip,
            LRVNo = if ("LRVNo" %in% names(row)) as.character(row$LRVNo) else "",
            TriggerStop = row$Stop,
            LatestDelayedActualTime = row$ActualTime
          )
        }
        current$StopTime <- row$ActualTime
        if (!is.na(row$ActualTime) &&
            (is.na(current$LatestDelayedActualTime) ||
             row$ActualTime > current$LatestDelayedActualTime)) {
          current$LatestDelayedActualTime <- row$ActualTime
        }
        last_disrupted <- row
      } else if (is_wabtec_block_placeholder_disruption(row)) {
        if (is.null(current)) {
          current <- list(
            Block = block_id,
            StartTime = row$ScheduledTime,
            StopTime = row$ScheduledTime,
            Trip = row$Trip,
            LRVNo = if ("LRVNo" %in% names(row)) as.character(row$LRVNo) else "",
            TriggerStop = row$Stop,
            LatestDelayedActualTime = row$ActualTime
          )
        }
        current$StopTime <- row$ActualTime
        last_disrupted <- row
      } else if (!is.null(current)) {
        if (!can_wabtec_block_row_recover(row, current)) {
          next
        }

        current$StopTime <- row$ActualTime
        if (is_kpi_window_longer_than(current$StartTime, current$StopTime, 5)) {
          windows <- append_list_row(windows, current)
        }
        current <- NULL
        last_disrupted <- NULL
      }
    }

    if (!is.null(current) && !is.null(last_disrupted)) {
      fallback_rows <- block_rows[block_rows$ScheduledTime >= last_disrupted$ScheduledTime, ]
      fallback <- if (nrow(fallback_rows) > 0) fallback_rows[nrow(fallback_rows), ] else last_disrupted
      current$StopTime <- fallback$ScheduledTime
      if (is_kpi_window_longer_than(current$StartTime, current$StopTime, 5)) {
        windows <- append_list_row(windows, current)
      }
    }
  }

  if (length(windows) == 0) {
    return(data.frame())
  }

  out <- do.call(rbind, lapply(seq_along(windows), function(i) {
    data.frame(
      WindowKey = paste0("block-window-", i),
      Block = windows[[i]]$Block,
      StartTime = windows[[i]]$StartTime,
      StopTime = windows[[i]]$StopTime,
      Trip = windows[[i]]$Trip,
      LRVNo = windows[[i]]$LRVNo,
      TriggerStop = windows[[i]]$TriggerStop,
      stringsAsFactors = FALSE
    )
  }))
  out[order(out$StartTime), ]
}

build_wabtec_concurrent_windows <- function(block_windows) {
  if (nrow(block_windows) == 0) {
    return(data.frame())
  }

  events <- rbind(
    data.frame(Time = block_windows$StartTime, Type = "start", Key = block_windows$WindowKey,
               stringsAsFactors = FALSE),
    data.frame(Time = block_windows$StopTime, Type = "end", Key = block_windows$WindowKey,
               stringsAsFactors = FALSE)
  )
  events <- events[order(events$Time, ifelse(events$Type == "end", 0, 1)), ]
  event_times <- sort(unique(events$Time))
  active <- character()
  segments <- list()
  previous_time <- event_times[1]

  for (event_time in event_times) {
    if (event_time > previous_time && length(active) > 1) {
      active_blocks <- block_windows[match(active, block_windows$WindowKey), ]
      segment <- list(
        StartTime = previous_time,
        StopTime = event_time,
        Blocks = paste(unique(active_blocks$Block), collapse = ";")
      )
      if (length(segments) > 0 &&
          as.numeric(segments[[length(segments)]]$StopTime) == as.numeric(segment$StartTime)) {
        segments[[length(segments)]]$StopTime <- segment$StopTime
        segments[[length(segments)]]$Blocks <- paste(
          unique(c(strsplit(segments[[length(segments)]]$Blocks, ";")[[1]],
                   strsplit(segment$Blocks, ";")[[1]])),
          collapse = ";"
        )
      } else {
        segments <- append_list_row(segments, segment)
      }
    }

    ending <- events$Key[events$Time == event_time & events$Type == "end"]
    starting <- events$Key[events$Time == event_time & events$Type == "start"]
    active <- setdiff(active, ending)
    active <- unique(c(active, starting))
    previous_time <- event_time
  }

  if (length(segments) == 0) {
    return(data.frame())
  }

  do.call(rbind, lapply(seq_along(segments), function(i) {
    data.frame(
      ID = i,
      StartTime = segments[[i]]$StartTime,
      StopTime = segments[[i]]$StopTime,
      Blocks = segments[[i]]$Blocks,
      stringsAsFactors = FALSE
    )
  }))
}

terminal_stop_for_direction <- function(direction) {
  ifelse(as.character(direction) == "NB",
         kpi_stop_order[1],
         kpi_stop_order[length(kpi_stop_order)])
}

origin_stop_for_direction <- function(direction) {
  ifelse(as.character(direction) == "NB",
         kpi_stop_order[length(kpi_stop_order)],
         kpi_stop_order[1])
}

is_origin_stop <- function(row) {
  as.character(row$Stop) == origin_stop_for_direction(row$Direction)
}

kpi_trip_direction_key <- function(trip, direction) {
  paste(as.character(trip), as.character(direction), sep = "::")
}

build_wabtec_terminal_headways <- function(timeline) {
  rows <- prepare_kpi_timeline(timeline)
  rows <- rows[
    rows$Arr.Dep == "ARR" &
      rows$Stop == terminal_stop_for_direction(rows$Direction) &
      !is.na(rows$ActualTime),
  ]

  if (nrow(rows) == 0) {
    return(setNames(numeric(), character()))
  }

  headways <- setNames(numeric(), character())
  direction_rows <- split(rows, rows$Direction)

  for (direction in names(direction_rows)) {
    rows_for_direction <- direction_rows[[direction]]
    rows_for_direction <- rows_for_direction[order(rows_for_direction$ActualTime), ]
    actual_headways <- rep(NA_real_, nrow(rows_for_direction))

    if (nrow(rows_for_direction) > 1) {
      actual_headways[-1] <- as.numeric(
        difftime(rows_for_direction$ActualTime[-1],
                 rows_for_direction$ActualTime[-nrow(rows_for_direction)],
                 units = "mins")
      )
    }

    keys <- kpi_trip_direction_key(rows_for_direction$Trip, rows_for_direction$Direction)
    headways[keys] <- actual_headways
  }

  headways
}

is_wabtec_out_of_sequence_recovery <- function(row, window) {
  !is.na(row$ActualTime) &&
    !is.null(window$LatestDelayedActualTime) &&
    !is.na(window$LatestDelayedActualTime) &&
    row$ActualTime < window$LatestDelayedActualTime
}

has_wabtec_terminal_headway_recovered <- function(row, terminal_headways) {
  key <- kpi_trip_direction_key(row$Trip, row$Direction)
  actual_headway <- if (key %in% names(terminal_headways)) {
    terminal_headways[[key]]
  } else {
    NA_real_
  }
  is.na(actual_headway) || actual_headway >= 5
}

is_wabtec_platform_delayed <- function(row) {
  !is.na(row$DifferenceSeconds) && row$DifferenceSeconds > 5 * 60
}

is_wabtec_platform_placeholder_disruption <- function(row) {
  completed_service <- completed_service_value(row)
  completed_service == "missed" ||
    (completed_service == "partial" && isTRUE(row$ActualMissing))
}

start_wabtec_platform_window <- function(row, platform) {
  list(
    Platform = platform,
    Stop = row$Stop,
    Direction = row$Direction,
    StartTime = row$ScheduledTime,
    StopTime = row$ActualTime,
    Trip = row$Trip,
    Block = row$Block,
    DelayedRows = row[FALSE, ],
    ImpactRows = row[FALSE, ],
    RecoveryRow = NULL,
    LatestDelayedActualTime = row$ActualTime,
    OutOfSequenceRecovery = FALSE
  )
}

build_wabtec_platform_delay_windows <- function(timeline, terminal_headways = NULL) {
  if (is.null(terminal_headways)) {
    terminal_headways <- build_wabtec_terminal_headways(timeline)
  }

  rows <- prepare_kpi_timeline(timeline)
  rows <- rows[rows$Arr.Dep == "DEP", ]
  platforms <- split(rows, rows$Platform)
  windows <- list()

  for (platform in names(platforms)) {
    platform_rows <- platforms[[platform]]
    platform_rows <- platform_rows[order(platform_rows$ScheduledTime), ]
    current <- NULL

    for (i in seq_len(nrow(platform_rows))) {
      row <- platform_rows[i, ]

      if (is_wabtec_platform_delayed(row)) {
        if (is.null(current)) {
          current <- start_wabtec_platform_window(row, platform)
        }

        current$DelayedRows <- rbind(current$DelayedRows, row)
        current$ImpactRows <- rbind(current$ImpactRows, row)
        current$StopTime <- row$ActualTime
        if (!is.na(row$ActualTime) &&
            (is.na(current$LatestDelayedActualTime) ||
             row$ActualTime > current$LatestDelayedActualTime)) {
          current$LatestDelayedActualTime <- row$ActualTime
        }
      } else if (is_wabtec_platform_placeholder_disruption(row)) {
        if (is.null(current)) {
          current <- start_wabtec_platform_window(row, platform)
        }

        current$ImpactRows <- rbind(current$ImpactRows, row)
        current$StopTime <- row$ActualTime
      } else if (!is.null(current)) {
        completed_service <- completed_service_value(row)
        if (completed_service == "partial" &&
            !is.na(row$ActualTime) &&
            !is.na(current$LatestDelayedActualTime) &&
            row$ActualTime < current$LatestDelayedActualTime) {
          next
        }

        if (completed_service != "missedheadway" &&
            !is_origin_stop(row) &&
            is_wabtec_out_of_sequence_recovery(row, current)) {
          current$OutOfSequenceRecovery <- TRUE
          next
        }

        # Wabtec does not close a platform window on an overtaking recovery row.
        if (completed_service != "missedheadway" &&
            !is_origin_stop(row) &&
            isTRUE(current$OutOfSequenceRecovery) &&
            !has_wabtec_terminal_headway_recovered(row, terminal_headways)) {
          next
        }

        current$RecoveryRow <- row
        current$StopTime <- row$ActualTime
        if (is_kpi_window_longer_than(current$StartTime, current$StopTime, 0)) {
          windows <- append_list_row(windows, current)
        }
        current <- NULL
      }
    }

    if (!is.null(current) && is_kpi_window_longer_than(current$StartTime, current$StopTime, 0)) {
      windows <- append_list_row(windows, current)
    }
  }

  windows
}

build_wabtec_kpi2_windows <- function(timeline) {
  block_windows <- build_wabtec_block_windows(timeline)
  concurrent_windows <- build_wabtec_concurrent_windows(block_windows)
  terminal_headways <- build_wabtec_terminal_headways(timeline)
  platform_windows <- build_wabtec_platform_delay_windows(timeline, terminal_headways)
  output <- list()

  if (nrow(concurrent_windows) == 0 || length(platform_windows) == 0) {
    return(list(
      BlockWindows = block_windows,
      ConcurrentWindows = concurrent_windows,
      PlatformWindows = data.frame()
    ))
  }

  for (i in seq_len(nrow(concurrent_windows))) {
    concurrent <- concurrent_windows[i, ]
    for (window in platform_windows) {
      if (window$StartTime > concurrent$StopTime || concurrent$StartTime > window$StopTime) {
        next
      }

      overlap_start <- max(window$StartTime, concurrent$StartTime)
      recovery_before_concurrent_end <- !is.null(window$RecoveryRow) &&
        window$RecoveryRow$ScheduledTime <= concurrent$StopTime
      stop_time <- if (recovery_before_concurrent_end) {
        window$StopTime
      } else {
        min(window$StopTime, concurrent$StopTime)
      }

      impact_rows <- window$ImpactRows[
        window$ImpactRows$ScheduledTime >= overlap_start &
          window$ImpactRows$ScheduledTime <= stop_time,
      ]
      if (nrow(impact_rows) == 0) {
        next
      }

      trigger <- impact_rows[1, ]

      if (stop_time <= trigger$ScheduledTime) {
        next
      }

      output <- append_list_row(output, data.frame(
        Platform = window$Platform,
        StartTime = trigger$ScheduledTime,
        StopTime = stop_time,
        ID = concurrent$ID,
        Stop = window$Stop,
        Direction = window$Direction,
        Trip = trigger$Trip,
        Block = trigger$Block,
        DueToConcurrentStart = concurrent$StartTime,
        DueToConcurrentStop = concurrent$StopTime,
        stringsAsFactors = FALSE
      ))
    }
  }

  platform_output <- if (length(output) == 0) {
    data.frame()
  } else {
    out <- do.call(rbind, output)
    out$StopIndex <- kpi_stop_index(out$Stop)
    out$DirectionOrder <- kpi_direction_order(out$Direction)
    out[order(out$ID, out$StopIndex, out$DirectionOrder, out$StartTime), ]
  }

  list(
    BlockWindows = block_windows,
    ConcurrentWindows = concurrent_windows,
    PlatformWindows = platform_output
  )
}

normalise_kpi2_platform <- function(token) {
  token <- toupper(trimws(as.character(token)))
  if (grepl("1$", token)) {
    return(paste0(substr(token, 1, nchar(token) - 1), "SB"))
  }
  if (grepl("2$", token)) {
    return(paste0(substr(token, 1, nchar(token) - 1), "NB"))
  }
  token
}

normalise_kpi3_lrv <- function(token) {
  token <- toupper(gsub("\\s+", "", trimws(as.character(token))))
  digits <- gsub("\\D", "", token)
  if (digits == "") {
    return("")
  }
  paste0("LRV", sprintf("%03d", as.integer(digits)))
}

read_notification_intervals <- function(file_path, target_normaliser) {
  if (is.null(file_path) || !file.exists(file_path)) {
    return(list(PA = list(), PID = list()))
  }

  raw <- read.csv(file_path, stringsAsFactors = FALSE, check.names = FALSE)
  raw <- raw[!(raw$type == "----" | raw$messageId == "" | raw$messageId == "---------"), ]
  service_date <- notification_service_date(raw$eventTime)
  events <- list()

  for (i in seq_len(nrow(raw))) {
    event_time <- as_notification_time(raw$eventTime[i], service_date)
    if (is.na(event_time)) {
      next
    }

    type_parts <- strsplit(toupper(raw$type[i]), "&", fixed = TRUE)[[1]]
    channel_token <- type_parts[1]
    status <- type_parts[length(type_parts)]
    channels <- character()
    if (grepl("PA", channel_token, fixed = TRUE)) {
      channels <- c(channels, "PA")
    }
    if (grepl("PID", channel_token, fixed = TRUE)) {
      channels <- c(channels, "PID")
    }
    if (length(channels) == 0 || !(status %in% c("START", "CONT", "END"))) {
      next
    }

    targets <- unlist(strsplit(raw$stationList[i], "&", fixed = TRUE))
    targets <- unique(Filter(nzchar, vapply(targets, target_normaliser, character(1))))
    for (channel in channels) {
      for (target in targets) {
        events <- append_list_row(events, data.frame(
          Channel = channel,
          Target = target,
          EventTime = event_time,
          Status = status,
          MessagePlayed = raw$messageId[i],
          stringsAsFactors = FALSE
        ))
      }
    }
  }

  if (length(events) == 0) {
    return(list(PA = list(), PID = list()))
  }

  event_table <- do.call(rbind, events)
  interval_by_channel <- list(PA = list(), PID = list())

  for (channel in names(interval_by_channel)) {
    channel_events <- event_table[event_table$Channel == channel, ]
    for (target in unique(channel_events$Target)) {
      target_events <- channel_events[channel_events$Target == target, ]
      target_events <- target_events[order(target_events$EventTime), ]
      intervals <- list()

      for (i in seq_len(nrow(target_events))) {
        if (!(target_events$Status[i] %in% c("START", "CONT"))) {
          next
        }

        stop_time <- target_events$EventTime[i] + 4 * 60
        if (i < nrow(target_events)) {
          end_index <- which(target_events$Status[(i + 1):nrow(target_events)] == "END")[1]
          if (!is.na(end_index)) {
            stop_time <- target_events$EventTime[i + end_index]
          }
        }

        intervals <- append_list_row(intervals, data.frame(
          Target = target,
          StartTime = target_events$EventTime[i],
          StopTime = stop_time,
          MessagePlayed = target_events$MessagePlayed[i],
          Persistent = channel == "PID",
          stringsAsFactors = FALSE
        ))
      }

      interval_by_channel[[channel]][[target]] <- if (length(intervals) == 0) {
        data.frame()
      } else {
        do.call(rbind, intervals)
      }
    }
  }

  interval_by_channel
}

assess_notification_channel <- function(start_time, stop_time, intervals) {
  empty_time <- as.POSIXct(NA, origin = "1970-01-01", tz = "UTC")
  if (is.null(intervals) || nrow(intervals) == 0) {
    return(list(
      InitialWithin4 = FALSE,
      ContinuousWithin4 = FALSE,
      FirstStart = empty_time,
      LastEnd = empty_time
    ))
  }

  overlapping <- intervals[
    intervals$StopTime >= start_time & intervals$StartTime <= stop_time,
  ]
  if (nrow(overlapping) == 0) {
    return(list(
      InitialWithin4 = FALSE,
      ContinuousWithin4 = FALSE,
      FirstStart = empty_time,
      LastEnd = empty_time
    ))
  }

  overlapping <- overlapping[order(overlapping$StartTime), ]
  first_start <- min(overlapping$StartTime)
  last_end <- max(overlapping$StopTime)
  initial_deadline <- start_time + 4 * 60
  initial_candidates <- intervals[
    intervals$StartTime <= initial_deadline & intervals$StopTime >= start_time,
  ]
  initial_within4 <- nrow(initial_candidates) > 0
  continuous_within4 <- TRUE
  continuous_failure_time <- empty_time

  latest_before <- function(rows, deadline, previous_time = NULL) {
    candidates <- rows[rows$StartTime <= deadline & rows$StopTime >= start_time, ]
    if (!is.null(previous_time)) {
      candidates <- candidates[candidates$StartTime > previous_time, ]
    }
    if (nrow(candidates) == 0) {
      return(empty_time)
    }
    max(candidates$StartTime)
  }

  if (initial_within4) {
    last_message_time <- max(initial_candidates$StartTime)
    deadline <- start_time + 8 * 60
  } else {
    last_message_time <- latest_before(intervals, start_time + 8 * 60)
    deadline <- if (is.na(last_message_time)) {
      start_time + 8 * 60
    } else {
      last_message_time + 4 * 60
    }
  }

  while (deadline <= stop_time) {
    persistent_active <- "Persistent" %in% names(intervals) &&
      !is.na(last_message_time) &&
      any(intervals$Persistent &
            intervals$StartTime <= last_message_time &
            intervals$StopTime >= deadline)

    if (persistent_active) {
      deadline <- deadline + 4 * 60
      next
    }

    next_message_time <- latest_before(intervals, deadline, last_message_time)
    if (is.na(next_message_time)) {
      continuous_within4 <- FALSE
      continuous_failure_time <- deadline
      break
    }
    last_message_time <- next_message_time
    deadline <- last_message_time + 4 * 60
  }

  if (is.na(last_message_time)) {
    continuous_within4 <- FALSE
    continuous_failure_time <- start_time + 8 * 60
  }

  if (continuous_within4) {
    continuous_failure_time <- empty_time
  }

  list(
    InitialWithin4 = initial_within4,
    ContinuousWithin4 = continuous_within4,
    FirstStart = first_start,
    LastEnd = last_end,
    ContinuousFailureTime = continuous_failure_time
  )
}

min_kpi_time <- function(values) {
  values <- values[!is.na(values)]
  if (length(values) == 0) {
    return(as.POSIXct(NA, origin = "1970-01-01", tz = "UTC"))
  }
  min(values)
}

combine_kpi_notes <- function(values) {
  values <- unique(values[!is.na(values) & nzchar(values)])
  if (length(values) == 0) {
    return("")
  }
  paste(values, collapse = " | ")
}

format_kpi_clock <- function(value) {
  if (is.na(value)) {
    return("")
  }
  format(value, "%H:%M:%S")
}

build_kpi_notification_note <- function(channel, target, assessment) {
  if (is.na(assessment$FirstStart)) {
    return(paste("No", channel, "played at", target, "during this disruption duration."))
  }

  paste(
    "First", channel, "starts at", format_kpi_clock(assessment$FirstStart),
    "Last", channel, "ends at", format_kpi_clock(assessment$LastEnd)
  )
}

score_wabtec_windows <- function(windows, intervals, target_column) {
  if (nrow(windows) == 0) {
    return(data.frame())
  }

  scored <- lapply(seq_len(nrow(windows)), function(i) {
    row <- windows[i, ]
    target <- as.character(row[[target_column]])
    pa <- assess_notification_channel(row$StartTime, row$StopTime, intervals$PA[[target]])
    pid <- assess_notification_channel(row$StartTime, row$StopTime, intervals$PID[[target]])
    length_mins <- as.numeric(difftime(row$StopTime, row$StartTime, units = "mins"))
    length_condition <- length_mins > 4
    initial_breach <- length_condition && (!pa$InitialWithin4 || !pid$InitialWithin4)
    subsequent_breach <- length_condition && (!pa$ContinuousWithin4 || !pid$ContinuousWithin4)
    note <- if ("Note" %in% names(row)) as.character(row$Note) else ""

    data.frame(
      Target = target,
      ID = row$ID,
      StartTime = row$StartTime,
      StopTime = row$StopTime,
      Note = note,
      InitialPID = pid$FirstStart,
      InitialPIDin4Mins = pid$InitialWithin4,
      InitialPA = pa$FirstStart,
      InitialPAin4Mins = pa$InitialWithin4,
      PIDevery4Mins = pid$ContinuousWithin4,
      PAevery4Mins = pa$ContinuousWithin4,
      PANote = build_kpi_notification_note("PA", target, pa),
      PIDNote = build_kpi_notification_note("PID", target, pid),
      LengthofDisruption = length_mins,
      LengthCondition = length_condition,
      InitialKPI = ifelse(initial_breach, 0.5, 0),
      SubsequentKPI = ifelse(subsequent_breach, 2.0, 0),
      stringsAsFactors = FALSE
    )
  })

  scored <- do.call(rbind, scored)
  keys <- unique(scored[, c("ID", "Target")])
  official <- lapply(seq_len(nrow(keys)), function(i) {
    subset <- scored[scored$ID == keys$ID[i] & scored$Target == keys$Target[i], ]
    data.frame(
      ID = keys$ID[i],
      Target = keys$Target[i],
      StartTime = min(subset$StartTime),
      StopTime = max(subset$StopTime),
      Note = combine_kpi_notes(subset$Note),
      InitialPID = min_kpi_time(subset$InitialPID),
      InitialPIDin4Mins = all(subset$InitialPIDin4Mins),
      InitialPA = min_kpi_time(subset$InitialPA),
      InitialPAin4Mins = all(subset$InitialPAin4Mins),
      PIDevery4Mins = all(subset$PIDevery4Mins),
      PAevery4Mins = all(subset$PAevery4Mins),
      PANote = combine_kpi_notes(subset$PANote),
      PIDNote = combine_kpi_notes(subset$PIDNote),
      LengthofDisruption = max(subset$LengthofDisruption),
      LengthCondition = any(subset$LengthCondition),
      InitialKPI = max(subset$InitialKPI),
      SubsequentKPI = max(subset$SubsequentKPI),
      InitialKPIOfficial = max(subset$InitialKPI),
      SubsequentKPIOfficial = max(subset$SubsequentKPI),
      totalPP = max(subset$InitialKPI) + max(subset$SubsequentKPI),
      stringsAsFactors = FALSE
    )
  })
  out <- do.call(rbind, official)
  names(out)[names(out) == "Target"] <- target_column
  out[order(out$ID, out[[target_column]]), ]
}

read_lrv_lookup_from_timetable <- function(file_path = NULL, csv_text = NULL) {
  if (!is.null(csv_text) && nzchar(csv_text)) {
    wide <- read.csv(text = csv_text, header = FALSE, stringsAsFactors = FALSE, check.names = FALSE)
  } else if (!is.null(file_path) && file.exists(file_path)) {
    wide <- read.csv(file_path, header = FALSE, stringsAsFactors = FALSE, check.names = FALSE)
  } else {
    return(list(by_trip = list(), by_trip_event = list()))
  }
  if (nrow(wide) < 3) {
    return(list(by_trip = list(), by_trip_event = list()))
  }

  stop_header <- as.character(wide[1, ])
  event_header <- as.character(wide[2, ])
  trip_col <- which(toupper(event_header) == "TRIP")[1]
  lrv_cols <- which(toupper(event_header) == "LRV")
  if (is.na(trip_col) || length(lrv_cols) == 0) {
    return(list(by_trip = list(), by_trip_event = list()))
  }

  by_trip <- list()
  by_trip_event <- list()
  for (i in 3:nrow(wide)) {
    trip <- trimws(as.character(wide[i, trip_col]))
    if (!nzchar(trip)) {
      next
    }
    trip_lrvs <- character()

    for (lrv_col in lrv_cols) {
      lrv <- normalise_kpi3_lrv(wide[i, lrv_col])
      if (!nzchar(lrv)) {
        next
      }
      trip_lrvs <- c(trip_lrvs, lrv)
      stop <- toupper(trimws(stop_header[lrv_col]))
      arr_dep <- toupper(trimws(event_header[lrv_col + 1]))
      if (stop %in% kpi_stop_order && arr_dep %in% c("ARR", "DEP")) {
        by_trip_event[[paste(trip, stop, arr_dep, sep = "|")]] <- lrv
      }
    }

    if (length(trip_lrvs) > 0 && is.null(by_trip[[trip]])) {
      by_trip[[trip]] <- trip_lrvs[1]
    }
  }

  list(by_trip = by_trip, by_trip_event = by_trip_event)
}

resolve_lrv_for_event <- function(lookup, trip, stop, arr_dep) {
  key <- paste(trip, stop, arr_dep, sep = "|")
  lrv <- lookup$by_trip_event[[key]]
  if (!is.null(lrv)) {
    return(lrv)
  }
  lrv <- lookup$by_trip[[as.character(trip)]]
  if (!is.null(lrv)) {
    return(lrv)
  }
  ""
}

build_wabtec_kpi3_windows <- function(timeline, concurrent_windows, lrv_lookup = NULL) {
  if (is.null(lrv_lookup)) {
    lrv_lookup <- list(by_trip = list(), by_trip_event = list())
  }
  rows <- prepare_kpi_timeline(timeline)
  rows <- rows[rows$Stop != "SFD", ]
  rows$LRVNoResolved <- if ("LRVNo" %in% names(rows)) {
    vapply(rows$LRVNo, normalise_kpi3_lrv, character(1))
  } else {
    ""
  }
  needs_lookup <- rows$LRVNoResolved == ""
  rows$LRVNoResolved[needs_lookup] <- mapply(
    function(trip, stop, arr_dep) resolve_lrv_for_event(lrv_lookup, trip, stop, arr_dep),
    rows$Trip[needs_lookup],
    rows$Stop[needs_lookup],
    rows$Arr.Dep[needs_lookup],
    USE.NAMES = FALSE
  )
  rows <- rows[rows$LRVNoResolved != "", ]

  rows <- rows[order(rows$LRVNoResolved, rows$Trip, rows$ScheduledTime), ]
  windows <- list()
  if (nrow(rows) < 2 || nrow(concurrent_windows) == 0) {
    return(data.frame())
  }

  for (i in 2:nrow(rows)) {
    previous <- rows[i - 1, ]
    current <- rows[i, ]
    if (previous$LRVNoResolved != current$LRVNoResolved || previous$Trip != current$Trip) {
      next
    }

    previous_difference <- previous$DifferenceSeconds
    current_difference <- current$DifferenceSeconds
    impact <- FALSE
    note <- ifelse(current$Arr.Dep == "ARR", "Held between platforms", "Held at platform")
    if (!is.na(previous_difference) && !is.na(current_difference)) {
      impact <- (previous_difference <= 5 * 60 && current_difference > 5 * 60) ||
        (current_difference - previous_difference > 5 * 60)
    } else if (is.na(current_difference) && !is.na(previous_difference)) {
      impact <- previous_difference > 5 * 60
    }
    if (!impact) {
      next
    }

    start_time <- previous$ScheduledTime + 5 * 60
    stop_time <- if (!is.na(current$ActualTime)) current$ActualTime else current$ScheduledTime
    incident_matches <- concurrent_windows[
      concurrent_windows$StopTime >= start_time & concurrent_windows$StartTime <= stop_time,
    ]
    if (nrow(incident_matches) == 0 || stop_time <= start_time) {
      next
    }
    incident_matches$Overlap <- pmin(incident_matches$StopTime, stop_time) -
      pmax(incident_matches$StartTime, start_time)
    incident <- incident_matches[which.max(incident_matches$Overlap), ]

    windows <- append_list_row(windows, data.frame(
      LRVNo = previous$LRVNoResolved,
      StartTime = start_time,
      StopTime = stop_time,
      ID = incident$ID,
      Trip = previous$Trip,
      Block = previous$Block,
      Note = note,
      stringsAsFactors = FALSE
    ))
  }

  if (length(windows) == 0) {
    return(data.frame())
  }
  out <- do.call(rbind, windows)
  out[order(out$ID, out$LRVNo, out$StartTime), ]
}

find_existing_file <- function(candidates) {
  candidates <- candidates[!is.na(candidates) & nzchar(candidates)]
  found <- candidates[file.exists(candidates)]
  if (length(found) == 0) {
    return(NULL)
  }
  found[1]
}

format_result_times <- function(results, date_value) {
  if (nrow(results) == 0) {
    return(results)
  }
  time_columns <- intersect(c("StartTime", "StopTime", "InitialPID", "InitialPA"), names(results))
  for (column in time_columns) {
    results[[column]] <- restore_kpi_date(results[[column]], date_value)
  }
  results
}

empty_wabtec_result <- function(target_column) {
  first_column <- if (target_column == "Platform") "empty" else "Empty"
  columns <- c(
    first_column,
    target_column,
    "StartTime",
    "StopTime",
    "ID"
  )
  if (target_column == "LRVNo") {
    columns <- c(columns, "Note")
  }
  columns <- c(
    columns,
    "InitialPID",
    "InitialPIDin4Mins",
    "InitialPA",
    "InitialPAin4Mins",
    "PIDevery4Mins",
    "PAevery4Mins",
    "PANote",
    "PIDNote",
    "LengthofDisruption",
    "LengthCondition",
    "InitialKPI",
    "SubsequentKPI",
    "InitialKPIOfficial",
    "SubsequentKPIOfficial",
    "totalPP"
  )
  out <- as.data.frame(setNames(replicate(length(columns), logical(0), simplify = FALSE), columns))
  out
}

format_wabtec_result_for_csv <- function(results, target_column, date_value) {
  if (nrow(results) == 0) {
    return(empty_wabtec_result(target_column))
  }

  out <- format_result_times(results, date_value)
  first_column <- if (target_column == "Platform") "empty" else "Empty"
  out[[first_column]] <- ""

  columns <- c(
    first_column,
    target_column,
    "StartTime",
    "StopTime",
    "ID"
  )
  if (target_column == "LRVNo") {
    columns <- c(columns, "Note")
  }
  columns <- c(
    columns,
    "InitialPID",
    "InitialPIDin4Mins",
    "InitialPA",
    "InitialPAin4Mins",
    "PIDevery4Mins",
    "PAevery4Mins",
    "PANote",
    "PIDNote",
    "LengthofDisruption",
    "LengthCondition",
    "InitialKPI",
    "SubsequentKPI",
    "InitialKPIOfficial",
    "SubsequentKPIOfficial",
    "totalPP"
  )

  out[, columns]
}

read_lrv_lookup_for_date <- function(date_yymmdd, output_folder) {
  local_file <- find_existing_file(c(
    file.path(output_folder, paste0(date_yymmdd, "_timetable_including_lrvs.csv")),
    file.path("/Users/laylatran/Downloads/Date with KPI2-3 PPs", paste0(date_yymmdd, "_timetable_including_lrvs.csv")),
    file.path(getwd(), paste0(date_yymmdd, "_timetable_including_lrvs.csv"))
  ))
  if (!is.null(local_file)) {
    return(read_lrv_lookup_from_timetable(file_path = local_file))
  }

  csv_text <- tryCatch({
    getURL(
      paste("ftp://172.28.2.4:2123/TCCS/KPI/AOTRA/", date_yymmdd, "_timetable_including_lrvs.csv", sep = ""),
      userpwd = "svcPowerBi:U$V98Rbxk39x",
      connecttimeout = 60
    )
  }, error = function(e) "")

  read_lrv_lookup_from_timetable(csv_text = csv_text)
}

run_wabtec_kpi2_kpi3 <- function(timeline, date_value, month_string, date_string, date_yymmdd) {
  date_yyyymmdd <- format(as.Date(date_value), "%Y%m%d")
  output_folder <- file.path("/Users/laylatran/Documents/CMET", month_string, date_string)
  if (!dir.exists(output_folder)) {
    dir.create(output_folder, recursive = TRUE)
  }

  kpi02_file <- find_existing_file(c(
    file.path(output_folder, paste0("KPI02_", date_yyyymmdd, ".csv")),
    file.path("/Users/laylatran/Downloads", date_yyyymmdd, paste0("KPI02_", date_yyyymmdd, ".csv")),
    file.path("/Users/laylatran/Documents/CMET", month_string, paste0("KPI02_", date_yyyymmdd, ".csv")),
    file.path(getwd(), paste0("KPI02_", date_yyyymmdd, ".csv"))
  ))
  kpi03_file <- find_existing_file(c(
    file.path(output_folder, paste0("KPI03_", date_yyyymmdd, ".csv")),
    file.path("/Users/laylatran/Downloads", date_yyyymmdd, paste0("KPI03_", date_yyyymmdd, ".csv")),
    file.path("/Users/laylatran/Documents/CMET", month_string, paste0("KPI03_", date_yyyymmdd, ".csv")),
    file.path(getwd(), paste0("KPI03_", date_yyyymmdd, ".csv"))
  ))

  kpi2_model <- build_wabtec_kpi2_windows(timeline)
  kpi02_results <- data.frame()
  if (!is.null(kpi02_file)) {
    kpi02_intervals <- read_notification_intervals(kpi02_file, normalise_kpi2_platform)
    kpi02_results <- score_wabtec_windows(kpi2_model$PlatformWindows, kpi02_intervals, "Platform")
    write.csv(format_wabtec_result_for_csv(kpi02_results, "Platform", date_value),
              file.path(output_folder, paste0("KPI02-result", date_yyyymmdd, ".csv")))
  } else {
    message("KPI02 input file not found; KPI2 Wabtec windows were built but not scored.")
  }

  kpi03_results <- data.frame()
  if (!is.null(kpi03_file)) {
    lrv_lookup <- read_lrv_lookup_for_date(date_yymmdd, output_folder)
    kpi3_windows <- build_wabtec_kpi3_windows(timeline, kpi2_model$ConcurrentWindows, lrv_lookup)
    kpi03_intervals <- read_notification_intervals(kpi03_file, normalise_kpi3_lrv)
    kpi03_results <- score_wabtec_windows(kpi3_windows, kpi03_intervals, "LRVNo")
    write.csv(format_wabtec_result_for_csv(kpi03_results, "LRVNo", date_value),
              file.path(output_folder, paste0("KPI03-result", date_yyyymmdd, ".csv")))
  } else {
    message("KPI03 input file not found; KPI3 was not scored.")
  }

  list(
    KPI2BlockWindows = kpi2_model$BlockWindows,
    KPI2ConcurrentWindows = kpi2_model$ConcurrentWindows,
    KPI2PlatformWindows = kpi2_model$PlatformWindows,
    KPI02Results = kpi02_results,
    KPI03Results = kpi03_results,
    KPI02Total = if (nrow(kpi02_results) == 0) 0 else sum(kpi02_results$totalPP),
    KPI03Total = if (nrow(kpi03_results) == 0) 0 else sum(kpi03_results$totalPP)
  )
}

WabtecKPIResults <- run_wabtec_kpi2_kpi3(
  timeline = Timeline,
  date_value = o_date,
  month_string = month_string,
  date_string = date_string,
  date_yymmdd = date_string_1
)

UnplannedServiceDisruption2 <- WabtecKPIResults$KPI02Results
UnplannedServiceDisruption3 <- WabtecKPIResults$KPI03Results

print(paste("Wabtec KPI02 total PP:", round(WabtecKPIResults$KPI02Total, 1)))
print(paste("Wabtec KPI03 total PP:", round(WabtecKPIResults$KPI03Total, 1)))

if (FALSE) {

### KPI 2 and 3

# KPI2 - PA & PIDS @ Stops --------

Timeline <- Timeline[order(Timeline$Stop, Timeline$Scheduled), ]

TimelineDEP <- Timeline[Timeline$Arr.Dep == "DEP", ]

k <- 0

DelayTable2 <- data.frame("Stop", "StartTime", "StopTime", "Direction", "Trip")
names(DelayTable2)[1] <- "Stop"
names(DelayTable2)[2] <- "StartTime"
names(DelayTable2)[3] <- "StopTime"
names(DelayTable2)[4] <- "Direction"
names(DelayTable2)[5] <- "Trip"

DelayTable2$Stop <- "ABC"
DelayTable2$StartTime <- as.POSIXct(now(), tz = "")
DelayTable2$StopTime <- as.POSIXct(now(), tz = "")
DelayTable2$Direction <- "Direction"
DelayTable2$Trip <- "ABC"

TimelineDEP$USDStatus <- ""

TimelineDEP$Code2 <- substring(TimelineDEP$Trip, 1, 1)

TimelineDEP <- TimelineDEP[TimelineDEP$Code2 != "R", ]
TimelineDEP <- TimelineDEP[TimelineDEP$Stop != "SFD", ]


TimelineDEP <- TimelineDEP[, colnames(TimelineDEP) %in% c("Block", "Trip", "Stop", "Arr.Dep", "Scheduled", "Actual", "Difference", "CompletedService", "Direction", "USDStatus")]
TimelineDEP <- TimelineDEP[order(TimelineDEP$Direction, TimelineDEP$Stop, TimelineDEP$Scheduled), ]

TimelineDEP$Difference <- as.numeric(TimelineDEP$Difference)



for (i in 2:nrow(TimelineDEP)) {
    Stop <- TimelineDEP$Stop[i]
    prevStop <- TimelineDEP$Stop[i - 1]
    statusPrevStop <- TimelineDEP$USDStatus[i - 1]
    Difference <- as.numeric(TimelineDEP$Difference[i])


    if (is.na(Difference) == FALSE) {
        if (Stop == prevStop & Difference >= 5 * 60 & statusPrevStop == "") {
            TimelineDEP$USDStatus[i] <- "Start"
        } else if (Stop == prevStop & Difference >= 5 * 60 & (statusPrevStop == "Start" | statusPrevStop == "Cont")) {
            TimelineDEP$USDStatus[i] <- "Cont"
        } else if (Stop == prevStop & Difference < 5 * 60 & (statusPrevStop == "Start" | statusPrevStop == "Cont")) {
            TimelineDEP$USDStatus[i] <- "End"
        } else if ((Stop != prevStop) & (Difference >= 5 * 60)) {
            TimelineDEP$USDStatus[i] <- "Start"
        }
    } else if (is.na(Difference) == TRUE) {
        if (Stop == prevStop & statusPrevStop == "") {
            TimelineDEP$USDStatus[i] <- "Start"
        } else if (Stop == prevStop & (statusPrevStop == "Start" | statusPrevStop == "Cont")) {
            TimelineDEP$USDStatus[i] <- "Cont"
        } else if ((Stop != prevStop)) {
            TimelineDEP$USDStatus[i] <- "Start"
        }
    }
}

TimelineDEP <- TimelineDEP[!(TimelineDEP$USDStatus == ""), ]
TimelineDEP <- TimelineDEP[!(TimelineDEP$Stop == "SFD"), ]


if (nrow(TimelineDEP) == 0) {
  # Code to handle empty dataframe goes here, e.g.:
  print("TimelineDEP dataframe is empty")
  
  DateString2 <- paste(substring(date_string, 5, 8), substring(date_string, 3, 4), substring(date_string, 1, 2), sep = "")
  
  FolderString2 <- paste("C:/Users/svcPowerBI/OneDrive - Canberra Metro Operation/Business_Statistics - 01_Datasets/01_Cleaned Data/02_KPI/", month_string, "/",
                         date_string, "/",
                         sep = ""
  )
  
  
  if (dir.exists(paste("C:/Users/svcPowerBI/OneDrive - Canberra Metro Operation/Business_Statistics - 01_Datasets/01_Cleaned Data/02_KPI/", month_string, "/", sep = "")) == FALSE) {
    dir.create(paste("C:/Users/svcPowerBI/OneDrive - Canberra Metro Operation/Business_Statistics - 01_Datasets/01_Cleaned Data/02_KPI/", month_string, "/", sep = ""))
  }
  
  
  if (dir.exists(FolderString2) == FALSE) {
    dir.create(FolderString2)
  }
  
  setwd(FolderString2)
  
  #create empty dataframe
  UnplannedServiceDisruption2 <- data.frame(
    empty = character(),
    Platform = character(),
    StartTime = character(),
    StopTime = character(),
    ID = character(),
    InitialPID = character(),
    InitialPIDin4Mins = character(),
    InitialPA = character(),
    InitialPAin4Mins = character(),
    PIDevery4Mins = character(),
    PAevery4Mins = character(),
    PANote = character(),
    PIDNote = character(),
    LengthofDisruption = character(),
    LengthCondition = character(),
    InitialKPI = character(),
    SubsequentKPI = character(),
    InitialKPIOfficial = character(),
    SubsequentKPIOfficial = character(),
    totalPP = character(),
    stringsAsFactors = FALSE
  )
  
  write.csv(UnplannedServiceDisruption2, paste("KPI02-result", DateString2, ".csv", sep = ""))
  
  # Create a new data frame with the specified columns
  UnplannedServiceDisruption3 <- data.frame(
     Empty = character(),
     LRVNo = character(),
     StartTime = character(),
     StopTime = character(),
     ID = character(),
     Note = character(),
     InitialPID = character(),
     InitialPIDin4Mins = character(),
     InitialPA = character(),
     InitialPAin4Mins = character(),
     PIDevery4Mins = character(),
     PAevery4Mins = character(),
     PANote = character(),
     PIDNote = character(),
     LengthofDisruption = character(),
     LengthCondition = character(),
     InitialKPI = character(),
     SubsequentKPI = character(),
     InitialKPIOfficial = character(),
     SubsequentKPIOfficial = character(),
     totalPP = character(),
     stringsAsFactors = FALSE
     )
  
  write.csv(UnplannedServiceDisruption3, paste("KPI03-result", DateString2, ".csv", sep = ""))
  
} else {
  
 # setwd(folder_string_1)
  
j <- 0

  for (i in 1:nrow(TimelineDEP)) {
    Stop <- as.character(TimelineDEP$Stop[i])
    Direction <- as.character(TimelineDEP$Direction[i])
    StartTime <- NA
    EndTime <- NA
    Trip <- as.character(TimelineDEP$Trip[i])


    if (TimelineDEP$USDStatus[i] == "Start") {
        StartTime <- as.POSIXct(TimelineDEP$Scheduled[i], tz = "") + 5 * 60

        if (is.na(StartTime) == TRUE) {
            StartTime <- as.POSIXct(TimelineDEP$Scheduled[i], tz = "") + 5 * 60
        }

        tz(StartTime) <- ""

        j <- j + 1
        DelayTable2[j, 1] <- "ABC"
        DelayTable2[j, 4] <- "ABC"
        DelayTable2$Trip[j] <- "ABC"
        DelayTable2$Stop[j] <- Stop
        DelayTable2$Direction[j] <- Direction
        DelayTable2$StartTime[j] <- StartTime
        DelayTable2$Trip[j] <- Trip
    } 
    else if (TimelineDEP$USDStatus[i] == "End") {
        if (is.na(TimelineDEP$Actual[i - 1]) == TRUE) {
            EndTime <- as.POSIXct(TimelineDEP$Scheduled[i - 1]) + 5 * 60

            if (is.na(EndTime) == TRUE) {
                EndTime <- as.POSIXct(TimelineDEP$Scheduled[i - 1]) + 5 * 60
            }
        } else if (is.na(TimelineDEP$Actual[i - 1]) == FALSE) {
            EndTime <- as.POSIXct(TimelineDEP$Actual[i - 1]) + 5 * 60


            if (is.na(EndTime) == TRUE) {
                EndTime <- as.POSIXct(TimelineDEP$Scheduled[i - 1]) + 5 * 60
            }
        }

        tz(EndTime) <- ""
        DelayTable2$StopTime[j] <- EndTime
    }
}



DelayTable2 <- DelayTable2[order(DelayTable2$StartTime), ]
#DelayTable2 <- DelayTable2[!DelayTable2$Stop == "ABC", ]
DelayTable2$Platform <- paste(DelayTable2$Stop, DelayTable2$Direction, sep = "")
DelayTable2$Check <- ""


# finding if the time overlaps
if (nrow(DelayTable2) >= 2) {
  
for (i in 2:nrow(DelayTable2)) {
    StartTime1 <- DelayTable2$StartTime[i - 1]
    EndTime1 <- DelayTable2$StopTime[i - 1]

    StartTime2 <- DelayTable2$StartTime[i]
    EndTime2 <- DelayTable2$StopTime[i]

    Timeframe1 <- as.POSIXct(c(StartTime1, EndTime1), tz = "")
    Timeframe2 <- as.POSIXct(c(StartTime2, EndTime2), tz = "")

    if (Timeframe1 %overlaps% Timeframe2 & DelayTable2$Trip[i] != DelayTable2$Trip[i - 1]) {
        DelayTable2$Check[i] <- TRUE
    }
  }
} else {
  DelayTable2$Check <- FALSE
}

# finding if the incidents are in the same bigger incidents
# only look from row 1 to row second last
# if true, then rows are assigned same ID #
DelayTable2$ID <- 0


j <- 0
if (nrow(DelayTable2) >= 2) {

for (i in 2:(nrow(DelayTable2))) {
    status1 <- as.character(DelayTable2$Check[i - 1])
    status2 <- as.character(DelayTable2$Check[i])
    if (status1 == "" & status2 == TRUE) {
        j <- j + 1
    }

    if (status2 != "") {
        DelayTable2$ID[i] <- j
    } 
}
  } else {DelayTable2$ID <- 0}

  

# New table to calculate unplanned service disruption
UnplannedServiceDisruption2 <- data.frame("StopsAffected", "StartTime", "StopTime", "ID")
names(UnplannedServiceDisruption2)[1] <- "StopsAffected"
names(UnplannedServiceDisruption2)[2] <- "StartTime"
names(UnplannedServiceDisruption2)[3] <- "StopTime"
names(UnplannedServiceDisruption2)[4] <- "ID"
UnplannedServiceDisruption2$StopsAffected <- "ABC"
UnplannedServiceDisruption2$StartTime <- as.POSIXct(now(), tz = "")
UnplannedServiceDisruption2$StopTime <- as.POSIXct(now(), tz = "")
UnplannedServiceDisruption2$ID <- 0


# Exports true values from DelayTable2
j <- 0

for (i in 2:nrow(DelayTable2)) {
    if (DelayTable2$Check[i] == TRUE & DelayTable2$Check[i - 1] == "") {
        j <- j + 1

        Stop <- DelayTable2$Platform[i - 1]
        StartTime <- DelayTable2$StartTime[i]
        EndTime <- DelayTable2$StopTime[i - 1]

        ID <- as.numeric(DelayTable2$ID[i])

        if (ID == 0 && i != nrow(DelayTable2)) {
            if (as.numeric(DelayTable2$ID[i - 1]) != 0) {
                ID <- as.numeric(DelayTable2$ID[i - 1])
            }
        }

        UnplannedServiceDisruption2[j, 1:3] <- NA

        UnplannedServiceDisruption2$StopsAffected[j] <- Stop
        UnplannedServiceDisruption2$StartTime[j] <- as.POSIXct(StartTime, tz = "")
        UnplannedServiceDisruption2$StopTime[j] <- as.POSIXct(EndTime, tz = "")
        UnplannedServiceDisruption2$ID[j] <- ID
    } else if (DelayTable2$Check[i] == TRUE & DelayTable2$Check[i - 1] == TRUE) {
        j <- j + 1

        UnplannedServiceDisruption2[j, 1:3] <- NA

        Stop <- DelayTable2$Platform[i - 1]
        StartTime <- DelayTable2$StartTime[i - 1]
        EndTime <- DelayTable2$StopTime[i - 1]

        UnplannedServiceDisruption2$StopsAffected[j] <- Stop
        UnplannedServiceDisruption2$StartTime[j] <- as.POSIXct(StartTime, tz = "")
        UnplannedServiceDisruption2$StopTime[j] <- as.POSIXct(EndTime, tz = "")
        UnplannedServiceDisruption2$ID[j] <- ID
    } else if (DelayTable2$Check[i] != TRUE & DelayTable2$Check[i - 1] == TRUE) {
        j <- j + 1

        UnplannedServiceDisruption2[j, 1:3] <- NA

        Stop <- DelayTable2$Platform[i - 1]
        StartTime <- DelayTable2$StartTime[i - 1]
        EndTime <- DelayTable2$StopTime[i - 2]

        UnplannedServiceDisruption2$StopsAffected[j] <- Stop
        UnplannedServiceDisruption2$StartTime[j] <- as.POSIXct(StartTime, tz = "")
        UnplannedServiceDisruption2$StopTime[j] <- as.POSIXct(EndTime, tz = "")
        UnplannedServiceDisruption2$ID[j] <- ID
    }
}

names(UnplannedServiceDisruption2)[1] <- "Platform"


# Retrieves KPI 2 Raw Data to find announcements
j <- 0

DateString2 <- paste(substring(date_string, 5, 8), substring(date_string, 3, 4), substring(date_string, 1, 2), sep = "")

FolderString2 <- paste("C/Users/laylatran/Downloads/20260109/",
    sep = ""
)

#setwd(FolderString2)
PIDPARaw2 <- read.csv(paste("KPI02_", DateString2, ".csv", sep = ""))
PIDPARaw2 <- PIDPARaw2[!(PIDPARaw2$type == "----" | PIDPARaw2$messageId == ""), ]
PIDPARaw2 <- PIDPARaw2[, colnames(PIDPARaw2) %in% c("eventTime", "type", "messageId", "stationList")]
 
PIDPARaw2$stationList <- gsub("1", "SB", PIDPARaw2$stationList)
PIDPARaw2$stationList <- gsub("2", "NB", PIDPARaw2$stationList)

PIDPARaw2$eventTime <- as.POSIXct(PIDPARaw2$eventTime, tz = "")

j <- nrow(PIDPARaw2)
m <- 0

PIDPARaw2$note <- ""


for (i in 1:nrow(PIDPARaw2)) {
    freeText <- PIDPARaw2$stationList[i]

    if (grepl("&", freeText) == TRUE) {
        oTime <- as.POSIXct(PIDPARaw2$eventTime[i], tz = "")
        oDesc <- as.character(PIDPARaw2$messageId[i])
        oType <- as.character(PIDPARaw2$type[i])

        m <- m + 1

        PIDPARaw2$note[i] <- paste("a", as.character(m), sep = "")

        a <- strsplit(freeText, "&")
        b <- array(as.character(unlist(a)))

        for (k in 1:length(b)) {
            j <- j + 1
            PIDPARaw2[j, 3:5] <- NA
            PIDPARaw2$eventTime[j] <- oTime
            PIDPARaw2$messageId[j] <- oDesc
            PIDPARaw2$type[j] <- oType
            PIDPARaw2$stationList[j] <- as.character(b[k])
            PIDPARaw2$note[j] <- paste("b", as.character(m), sep = "")
        }
    }
}



PIDPARaw2$code <- substring(PIDPARaw2$note, 1, 1)
PIDPARaw2 <- PIDPARaw2[!(PIDPARaw2$code == "a"), ]
PIDPARaw2 <- PIDPARaw2[, colnames(PIDPARaw2) %in% c("eventTime", "type", "messageId", "stationList")]


# Extracts only PA instances from PIDPARAW2
#PIDPARaw2$code <- substring(PIDPARaw2$type, 1, 2)

#PARaw2 <- PIDPARaw2[(PIDPARaw2$code == "PA"), ]
#PARaw2 <- PARaw2[order(PARaw2$stationList, PARaw2$eventTime), ]

#PARaw2$type <- substring(PARaw2$type, 11, 20)

get_status <- function(type_str) {
  parts <- strsplit(as.character(type_str), "&")[[1]]
  return(tail(parts, 1))
}

PIDPARaw2$extracted_status <- sapply(PIDPARaw2$type, get_status)

# Now filter your PA and PID tables using the clean status
PARaw2 <- PIDPARaw2[grepl("^PA", PIDPARaw2$type), ]
PARaw2$type <- PARaw2$extracted_status 

PIDRaw2 <- PIDPARaw2[grepl("^PID", PIDPARaw2$type), ]
PIDRaw2$type <- PIDRaw2$extracted_status


PARaw2$Read <- FALSE

# Creates a new table for PA from PA extraction
j <- 0

PA2 <- data.frame("Platform", "StartTime", "StopTime", "Note")
names(PA2)[1] <- "Platform"
names(PA2)[2] <- "StartTime"
names(PA2)[3] <- "StopTime"
names(PA2)[4] <- "MessagePlayed"

PA2$StartTime <- as.POSIXct(now())
PA2$StopTime <- as.POSIXct(now())
PA2$StartTime <- as.POSIXct(PA2$StartTime, tz = "")
PA2$StopTime <- as.POSIXct(PA2$StopTime, tz = "")
PA2$Platform <- "ABC"
PA2$MessagePlayed <- "ABC"


listofPlatforms <- unique(PARaw2$stationList)

# Populates Platforms with station list data from PaRaw2
for (l in 1:length(listofPlatforms)) {
    Platform <- listofPlatforms[l]
    RunningTable <- PARaw2[PARaw2$stationList == Platform, ]
    endLoop <- 0

    for (i in 1:nrow(RunningTable)) {
        status <- as.character(RunningTable$type[i])
        oTime <- as.POSIXct(RunningTable$eventTime[i], tz = "")
        Platform <- as.character(RunningTable$stationList[i])
        MessagePlayed <- as.character(RunningTable$messageId[i])
        readStatus <- RunningTable$Read[i]
        endLoop <- 0

        # Populating new PA2 table with data from PARAW2
        if ((status == "START" | status == "CONT") & endLoop == 0 & readStatus == FALSE) {
            j <- j + 1

            PA2[j, 1] <- NA

            PA2$StartTime[j] <- oTime
            PA2$Platform[j] <- Platform
            PA2$MessagePlayed[j] <- MessagePlayed

            k <- i + 1

            while (endLoop == 0 & k <= nrow(RunningTable)) {
                status1 <- as.character(RunningTable$type[k])
                oTime1 <- as.POSIXct(RunningTable$eventTime[k], tz = "")
                MessagePlayed1 <- as.character(RunningTable$messageId[k])
                readStatus1 <- RunningTable$Read[k]

                if (endLoop == 0 & status1 == "END" & readStatus1 == FALSE) {
                    PA2$StopTime[j] <- oTime1
                    endLoop <- 1
                }
                RunningTable$Read[k] <- TRUE
                k <- k + 1
            }

            if (endLoop == 0) {
                PA2$StopTime[j] <- oTime + 4 * 60
            }
        }
    }
}



PA2$PA.PID <- "PA"






# PID extraction
PIDPARaw2$code <- substring(PIDPARaw2$type, 1, 3)

PIDRaw2 <- PIDPARaw2[(PIDPARaw2$code == "PID"), ]
PIDRaw2 <- PIDRaw2[order(PIDRaw2$stationList, PIDRaw2$eventTime), ]
PIDRaw2 <- PIDPARaw2[grepl("^PID", PIDPARaw2$type), ]
PIDRaw2$type <- PIDRaw2$extracted_status
PIDRaw2$Read <- FALSE

j <- 0

PID2 <- data.frame("Platform", "StartTime", "StopTime", "MessagePlayed")
names(PID2)[1] <- "Platform"
names(PID2)[2] <- "StartTime"
names(PID2)[3] <- "StopTime"
names(PID2)[4] <- "MessagePlayed"

PID2$StartTime <- as.POSIXct(now())
PID2$StopTime <- as.POSIXct(now())
PID2$StartTime <- as.POSIXct(PID2$StartTime, tz = "")
PID2$StopTime <- as.POSIXct(PID2$StopTime, tz = "")
PID2$Platform <- "ABC"
PID2$MessagePlayed <- "ABC"




listofPlatforms <- unique(PIDRaw2$stationList)

for (l in 1:length(listofPlatforms)) {
    Platform <- listofPlatforms[l]
    RunningTable <- PIDRaw2[PIDRaw2$stationList == Platform, ]
    endLoop <- 0

    for (i in 1:nrow(RunningTable)) {
        status <- as.character(RunningTable$type[i])
        oTime <- as.POSIXct(RunningTable$eventTime[i], tz = "")
        Platform <- as.character(RunningTable$stationList[i])
        MessagePlayed <- as.character(RunningTable$messageId[i])
        readStatus <- RunningTable$Read[i]
        endLoop <- 0

        if ((status == "START" | status == "CONT") & endLoop == 0 & readStatus == FALSE) {
            j <- j + 1

            PID2[j, 1] <- NA

            PID2$StartTime[j] <- oTime
            PID2$Platform[j] <- Platform
            PID2$MessagePlayed[j] <- MessagePlayed

            k <- i + 1

            while (endLoop == 0 & k <= nrow(RunningTable)) {
                status1 <- as.character(RunningTable$type[k])
                oTime1 <- as.POSIXct(RunningTable$eventTime[k], tz = "")
                MessagePlayed1 <- as.character(RunningTable$messageId[k])
                readStatus1 <- RunningTable$Read[k]

                if (endLoop == 0 & status1 == "END" & readStatus1 == FALSE) {
                    PID2$StopTime[j] <- oTime1
                    endLoop <- 1
                }

                RunningTable$Read[k] <- TRUE
                k <- k + 1
            }

            if (endLoop == 0) {
                PID2$StopTime[j] <- oTime + 4 * 60
            }
        }
    }
}




PID2$PA.PID <- "PID"


PA2$USD <- 0
PID2$USD <- 0
PA2$status <- FALSE
PID2$status <- FALSE




# finding overlaps between USD and PID/PA
# This part calculates whether if we notified disruptions or not

for (i in 1:nrow(UnplannedServiceDisruption2)) {
    Platform <- as.character(UnplannedServiceDisruption2$Platform[i])
    StartTime <- as.POSIXct(UnplannedServiceDisruption2$StartTime[i], tz = "")
    StopTime <- as.POSIXct(UnplannedServiceDisruption2$StopTime[i], tz = "")
    TimeFrameUSD <- as.POSIXct(c(StartTime, StopTime), tz = "")
    USDID <- as.numeric(UnplannedServiceDisruption2$ID[i])

    # Finding PA platform matches USD ID
    for (x in 1:nrow(PA2)) {
        PlatformPA <- as.character(PA2$Platform[x])

        if (Platform == PlatformPA) {
            StartTimePA <- as.POSIXct(PA2$StartTime[x], tz = "")
            StopTimePA <- as.POSIXct(PA2$StopTime[x], tz = "")
            TimeframePA <- as.POSIXct(c(StartTimePA, StopTimePA), tz = "")

            if (TimeframePA %overlaps% TimeFrameUSD) {

                PA2$status[x] <- TRUE
                PA2$USD[x] <- USDID
            }
        }
    }


    # finding PID corresponding to that USD

    for (x in 1:nrow(PID2)) {
        PlatformPID <- as.character(PID2$Platform[x])

        if (Platform == PlatformPID) {
            StartTimePID <- as.POSIXct(PID2$StartTime[x], tz = "")
            StopTimePID <- as.POSIXct(PID2$StopTime[x], tz = "")
            TimeframePID <- as.POSIXct(c(StartTimePID, StopTimePID), tz = "")

            if (TimeframePID %overlaps% TimeFrameUSD) {

                PID2$status[x] <- TRUE
                PID2$USD[x] <- USDID
            }
        }
    }
}



# Finding whether PID or PA is later than 4 Minutes
# Creates 4min interval and a code column, showing whether if True or False
PID2$Interval4Mins <- as.POSIXct(PID2$StopTime, tz = "") + 4 * 60
PID2$Code <- paste(PID2$Platform, PID2$status, sep = " ")
PID2 <- PID2[order(PID2$Code, PID2$StartTime), ]


PA2$Interval4Mins <- as.POSIXct(PA2$StopTime, tz = "") + 4 * 60
PA2$Code <- paste(PA2$Platform, PA2$status, sep = " ")
PA2 <- PA2[order(PA2$Code, PA2$StartTime), ]


# Populates USD2 table and clearly shows data from previous calculation whether PID&PA where played innitally and every 4mins for length of USD.
UnplannedServiceDisruption2$InitialPID <- NA
UnplannedServiceDisruption2$InitialPIDin4Mins <- TRUE
UnplannedServiceDisruption2$InitialPID <- as.POSIXct(UnplannedServiceDisruption2$InitialPID)
UnplannedServiceDisruption2$InitialPA <- NA
UnplannedServiceDisruption2$InitialPA <- as.POSIXct(UnplannedServiceDisruption2$InitialPA)
UnplannedServiceDisruption2$InitialPAin4Mins <- TRUE
UnplannedServiceDisruption2$PIDevery4Mins <- TRUE
UnplannedServiceDisruption2$PAevery4Mins <- TRUE
UnplannedServiceDisruption2$PANote <- ""
UnplannedServiceDisruption2$PIDNote <- ""
# UnplannedServiceDisruption2$LastPA <- NA
# UnplannedServiceDisruption2$LastPA <- as.POSIXct.numeric(UnplannedServiceDisruption2$LastPA)
# UnplannedServiceDisruption2$LastPID <- NA
# UnplannedServiceDisruption2$LastPID <- as.POSIXct.numeric(UnplannedServiceDisruption2$LastPID)


# Analysing PA

for (i in 1:nrow(UnplannedServiceDisruption2)) {
    Platform <- as.character(UnplannedServiceDisruption2$Platform[i])
    ID <- as.numeric(UnplannedServiceDisruption2$ID[i])
    StartTimeUSD <- as.POSIXct(UnplannedServiceDisruption2$StartTime[i], tz = "")
    StopTimeUSD <- as.POSIXct(UnplannedServiceDisruption2$StopTime[i], tz = "")

    TimeFrameUSD <- as.POSIXct(c(StartTimeUSD, StopTimeUSD), tz = "")

    Code <- paste(Platform, "TRUE", sep = " ")

    PANote <- ""

    filterPA2 <- PA2[PA2$Platform == Platform, ]

    # after filtering, there will be 3 scenarios (1) zero result (2) 1 result - can't loop (3) many results
    # zero result

    # If no PA played than make PA Note
    if (nrow(filterPA2) == 0) {
        UnplannedServiceDisruption2$InitialPAin4Mins[i] <- FALSE
        UnplannedServiceDisruption2$PAevery4Mins[i] <- FALSE
        UnplannedServiceDisruption2$PANote[i] <- paste("No PA played at ", Platform, " during this disruption duration.", sep = "")
        UnplannedServiceDisruption2$InitialPA[i] <- NA
    }

    for (j in 1:nrow(filterPA2)) {
        TimeStart <- as.POSIXct(filterPA2$StartTime[j], tz = "")
        TimeEnd <- as.POSIXct(filterPA2$StopTime[j], tz = "")
        TimeFramePA2 <- as.POSIXct(c(TimeStart, TimeEnd), tz = "")

        if (TimeFrameUSD %overlaps% TimeFramePA2) {
            filterPA2$status[j] <- TRUE
            filterPA2$Code[j] <- paste(Platform, TRUE, sep = " ")
        }
    }



    # analysing PA
    filterPA2 <- filterPA2[(filterPA2$status == TRUE), ]
    # filterPA2$TimeFrame <- as.POSIXct(c(filterPA2$StartTime, filterPA2$StopTime), tz = "")



    if (nrow(filterPA2) > 1) {
        # working on scenario 3

        InitialPA <- as.POSIXct(min(filterPA2$StartTime), tz = "")
        UnplannedServiceDisruption2$InitialPA[i] <- InitialPA
        PANote <- paste(PANote, "First PA starts at ", InitialPA, " ", sep = "")

        # added 07/01/2021 for accuracy testing
        LastPA <- as.POSIXct(max(filterPA2$StopTime), tz = "")
        PANote <- paste(PANote, "Last PA ends at ", LastPA, " ", sep = "")
        # added 07/01/2021 for accuracy testing


        if (InitialPA > as.POSIXct(StartTimeUSD, tz = "") + 4 * 60) {
            UnplannedServiceDisruption2$InitialPAin4Mins[i] <- FALSE

            PANote <- paste(PANote, "PA starts later than 4 mins: PA from ", InitialPA, " to ", LastPA, sep = "")
        }



        if (LastPA < as.POSIXct(StopTimeUSD, tz = "") - 4 * 60) {
            UnplannedServiceDisruption2$PAevery4Mins[i] <- FALSE
            PANote <- paste(PANote, "PA ends earlier than 4 mins: PA from ", InitialPA, " to ", LastPA, sep = "")
        }


        for (j in 1:(nrow(filterPA2) - 1)) {
            EndTimeFirstInterval <- as.POSIXct(filterPA2$Interval4Mins[j], tz = "")
            RealEndTime <- as.POSIXct(filterPA2$StopTime[j], tz = "")
            StartTimeNextInterval <- as.POSIXct(filterPA2$StartTime[j + 1], tz = "")

            if (StartTimeNextInterval > EndTimeFirstInterval) {
                UnplannedServiceDisruption2$PAevery4Mins[i] <- FALSE
                PANote <- paste(PANote, "Interval > 4 mins from", RealEndTime, "to", StartTimeNextInterval, sep = " ")
            } else {
                PANote <- paste(PANote, "Interval < 4 mins from", RealEndTime, "to", StartTimeNextInterval, sep = " ")
            }
        }
    } else if (nrow(filterPA2) == 1) {

        # working on scenario 2
        InitialPA <- as.POSIXct(filterPA2$StartTime[1], tz = "")
        FinalPA <- as.POSIXct(filterPA2$StopTime[1], tz = "")

        UnplannedServiceDisruption2$InitialPA[i] <- InitialPA


        if (InitialPA > StartTimeUSD + 4 * 60) {
            UnplannedServiceDisruption2$InitialPAin4Mins[i] <- FALSE
        }

        if (FinalPA < StopTimeUSD - 4 * 60) {
            UnplannedServiceDisruption2$PAevery4Mins[i] <- FALSE
        }

        PANote <- paste(PANote, "One PA played from ", InitialPA, " to ", FinalPA, " at ", Platform, sep = "")
    }

    UnplannedServiceDisruption2$PANote[i] <- PANote
}

# KPI02 - Analyzing PID-----
for (i in 1:nrow(UnplannedServiceDisruption2)) {
    Platform <- as.character(UnplannedServiceDisruption2$Platform[i])
    ID <- as.numeric(UnplannedServiceDisruption2$ID[i])
    StartTimeUSD <- as.POSIXct(UnplannedServiceDisruption2$StartTime[i], tz = "")
    StopTimeUSD <- as.POSIXct(UnplannedServiceDisruption2$StopTime[i], tz = "")

    TimeFrameUSD <- as.POSIXct(c(StartTimeUSD, StopTimeUSD), tz = "")
    Code <- paste(Platform, "TRUE", sep = " ")

    PIDNote <- ""

    filterPID2 <- PID2[PID2$Platform == Platform, ]
    for (j in 1:nrow(filterPID2)) {
        TimeStart <- as.POSIXct(filterPID2$StartTime[j], tz = "")
        TimeEnd <- as.POSIXct(filterPID2$StopTime[j], tz = "")
        TimeFramePID2 <- as.POSIXct(c(TimeStart, TimeEnd), tz = "")
        if (TimeFrameUSD %overlaps% TimeFramePID2) {
            filterPID2$status[j] <- TRUE
        }
        else if (TimeFrameUSD %overlaps% TimeFramePID2) {
          filterPID2$status[j] <- FALSE
        }
    }


    filterPID2 <- filterPID2[(filterPID2$status == TRUE), ]

    # after filtering, there will be 3 scenarios (1) zero result (2) 1 result - can't loop (3) many results
    # zero result

    if (nrow(filterPID2) == 0) {
        UnplannedServiceDisruption2$InitialPIDin4Mins[i] <- FALSE
        UnplannedServiceDisruption2$PIDevery4Mins[i] <- FALSE
        UnplannedServiceDisruption2$PIDNote[i] <- paste("None PID played at ", Platform, "for this disruption duration.", sep = "")
        UnplannedServiceDisruption2$InitialPID[i] <- NULL
    }

    #First error trigger -------------------------------------------------------------------------------------------------------------------
    j = 1
    for (n in 1:nrow(filterPID2)) {
        TimeStart <- as.POSIXct(filterPID2$StartTime[j], tz = "")
        TimeEnd <- as.POSIXct(filterPID2$StopTime[j], tz = "")
        TimeFramePID2 <- as.POSIXct(c(TimeStart, TimeEnd), tz = "")
        if (TimeFrameUSD %overlaps% TimeFramePID2) {
          filterPID2$status[j] <- TRUE
        }
        else if (TimeFrameUSD %overlaps% TimeFramePID2) {
          filterPID2$status[j] <- FALSE
        }
    }

    filterPID2 <- filterPID2[(filterPID2$status == TRUE), ]

    # after filtering, there will be 3 scenarios (1) zero result (2) 1 result - can't loop (3) many results
    # zero result


    if (nrow(filterPID2) > 1) {
        # working on scenario 3

        InitialPID <- as.POSIXct(min(filterPID2$StartTime), tz = "")
        UnplannedServiceDisruption2$InitialPID[i] <- InitialPID

        # added 07/01/2021 for accuracy testing
        LastPID <- as.POSIXct(max(filterPID2$StopTime), tz = "")
        # UnplannedServiceDisruption2$LastPID[i] <- LastPID
        # added 07/01/2021 for accuracy testing

        if (InitialPID > as.POSIXct(StartTimeUSD, tz = "") + 4 * 60) {
            UnplannedServiceDisruption2$InitialPIDin4Mins[i] <- FALSE
        }

        PIDNote <- paste(PIDNote, "First PID starts at", InitialPID, sep = "")

        FinalPID <- as.POSIXct(max(filterPID2$StopTime), tz = "")

        if (FinalPID < as.POSIXct(StopTimeUSD, tz = "") - 4 * 60) {
            UnplannedServiceDisruption2$PIDevery4Mins[i] <- FALSE
        }
        PIDNote <- paste(PIDNote, "Last PID ends at", FinalPID, sep = " ")

        for (j in 1:(nrow(filterPID2) - 1)) {
            EndTimeFirstInterval <- as.POSIXct(filterPID2$Interval4Mins[j], tz = "")
            RealEndTime <- as.POSIXct(filterPID2$StopTime[j], tz = "")
            StartTimeNextInterval <- as.POSIXct(filterPID2$StartTime[j + 1], tz = "")

            if (StartTimeNextInterval > EndTimeFirstInterval) {
                UnplannedServiceDisruption2$PIDevery4Mins[i] <- FALSE
                PIDNote <- paste(PIDNote, "Interval > 4 mins from", RealEndTime, "to", StartTimeNextInterval, sep = " ")
            } else {
                PIDNote <- paste(PIDNote, "Interval < 4 mins from", RealEndTime, "to", StartTimeNextInterval, sep = " ")
            }
        }
    } else if (nrow(filterPID2) == 1) {
        # working on scenario 2
        InitialPID <- as.POSIXct(filterPID2$StartTime[1], tz = "")
        FinalPID <- as.POSIXct(filterPID2$StopTime[1], tz = "")

        UnplannedServiceDisruption2$InitialPID[i] <- InitialPID

        if (InitialPID > StartTimeUSD + 4 * 60) {
            UnplannedServiceDisruption2$InitialPIDin4Mins[i] <- FALSE
        }

        if (FinalPID < StopTimeUSD - 4 * 60) {
            UnplannedServiceDisruption2$PIDevery4Mins[i] <- FALSE
        }

        PIDNote <- paste(PIDNote, "One PID played from", InitialPID, "to", FinalPID, sep = " ")
    }

    UnplannedServiceDisruption2$PIDNote[i] <- PIDNote
}


# After analyses of PA and PID; USD2 table notes will show the event log.


# Calculating KPI02 PP --------
# INSERT THIS NEW AGGREGATION BLOCK:
library(dplyr)

# 1. Calculate raw points for every window found
UnplannedServiceDisruption2 <- UnplannedServiceDisruption2 %>%
  filter(Platform != "ABC") %>%
  mutate(
    LengthofDisruption = as.numeric(difftime(StopTime, StartTime, units = "mins")),
    LengthCondition = LengthofDisruption > 4,
    # Assign points if notifications were missed
    InitialKPI_Raw = ifelse((InitialPAin4Mins == FALSE | InitialPIDin4Mins == FALSE) & LengthCondition == TRUE, 0.5, 0),
    SubsequentKPI_Raw = ifelse((PAevery4Mins == FALSE | PIDevery4Mins == FALSE) & LengthCondition == TRUE, 2.0, 0)
  )

# 2. Deduplicate: Group by Incident ID and Platform to ensure penalties only apply once
Final_KPI02_Results <- UnplannedServiceDisruption2 %>%
  group_by(ID, Platform) %>%
  summarise(
    StartTime = min(StartTime),
    StopTime = max(StopTime),
    InitialKPIOfficial = max(InitialKPI_Raw),
    SubsequentKPIOfficial = max(SubsequentKPI_Raw),
    totalPP = InitialKPIOfficial + SubsequentKPIOfficial,
    PANote = first(PANote),
    PIDNote = first(PIDNote),
    .groups = 'drop'
  )
setwd(FolderString2)
write.csv(UnplannedServiceDisruption2, paste("KPI02-result", DateString2, ".csv", sep = ""))




























# -------------KPI3 - PA & PIDS on LRV -------------

FolderString3 <- paste("C:/Users/svcPowerBI/OneDrive - Canberra Metro Operation/Business_Statistics - 01_Datasets/01_Cleaned Data/02_KPI/", month_string, "/", sep = "")
setwd(FolderString3)
# Service Time

url <- paste("ftp://172.28.2.4:2123/TCCS/KPI/AOTRA/", date_string_1, "_timetable_including_lrvs", ".csv", sep = "")
text_data <- getURL(url, userpwd = "svcPowerBi:U$V98Rbxk39x", connecttimeout = 60)
LRVTime <- read.csv(text = text_data)


names(LRVTime) <- as.matrix(LRVTime[1, ])
LRVTime <- LRVTime[-1, ]
#LRVTime[] <- lapply(LRVTime, function(x) type.convert(as.character(x)))
LRVTime[] <- lapply(LRVTime[],type.convert, as.is = TRUE)

LRVTime$Lrv <- paste("LRV", str_pad(LRVTime$Lrv, 3, pad = "0"), sep = "")


# LRVTime$Date <- trimws(substring(LRVTime$Time.In, 1, 10))
# LRVTime$Date1 <- dmy(LRVTime$Date)
# LRVTime$Code <- paste(LRVTime$Trip, format(LRVTime$Date1, "%d %m %Y"))


LRVTime <- subset(LRVTime, select = c("Trip", "Lrv"))

LRVTime$Trip <- as.character(LRVTime$Trip)


Timeline$Trip <- as.character(Timeline$Trip)

# Joins LRV & Number from excel
# Timeline3 <- LRVTime

Timeline3 <- LRVTime %>%
    select(Trip, Lrv) %>%
    distinct() %>%
    right_join(Timeline, by = "Trip")



# Timeline$Code2 <- paste(Timeline$Trip, format(as.POSIXct(Timeline$Actual, tz =""), format = "%d %m %Y"), sep = " ")
# Timeline <- merge(Timeline, LRVTime, by.x = "Code2", by.y = "Code", all.x = TRUE)

# Timeline <- Timeline[, !(colnames(Timeline) %in% c("Trip.y", "Code", "Code1", "Code2"))]

# names(Timeline)[3] <- "Trip"

Timeline3 <- Timeline3[order(Timeline3$Lrv, Timeline3$Scheduled), ]

names(Timeline3)[2] <- "LRVNo"

k <- 0



TimelineKPI3 <- Timeline3

TimelineKPI3$USDStatus <- ""

TimelineKPI3 <- TimelineKPI3[!(TimelineKPI3$Stop == "SFD"), ]

TimelineKPI3 <- TimelineKPI3[, colnames(TimelineKPI3) %in% c("Block", "Trip", "Stop", "LRVNo", "Arr.Dep", "Scheduled", "Actual", "Difference", "CompletedService", "Direction", "USDStatus")]
TimelineKPI3 <- TimelineKPI3[order(TimelineKPI3$Block, TimelineKPI3$LRVNo, TimelineKPI3$Direction, TimelineKPI3$Scheduled), ]

TimelineKPI3$Trip<- as.numeric(TimelineKPI3$Trip)

TimelineKPI3$Difference <- as.numeric(TimelineKPI3$Difference)
TimelineKPI3 <- TimelineKPI3[!(is.na(TimelineKPI3$Block)), ]
TimelineKPI3$Note <- ""

for (i in 2:nrow(TimelineKPI3)) {
    LRVNo <- as.character(TimelineKPI3$LRVNo[i])
    LRVNoP1 <- as.character(TimelineKPI3$LRVNo[i - 1])

    StatusP1 <- as.character(TimelineKPI3$USDStatus[i - 1])

    TripNo <- as.character(TimelineKPI3$Trip[i])
    TripNoP1 <- as.character(TimelineKPI3$Trip[i - 1])

    Difference <- as.numeric(TimelineKPI3$Difference[i])
    DifferenceP1 <- as.numeric(TimelineKPI3$Difference[i - 1])

    Arr.Dep <- as.character(TimelineKPI3$Arr.Dep[i])

    # when held at a platform then arrival is on time and departure is later than 5 mins
    # when held after the platform but before the next platform (in between platforms) the departure will be on-time but arrival will be 5 mins late


    if (is.na(Difference) == FALSE & is.na(DifferenceP1) == FALSE & TripNo == TripNoP1) {
        if (DifferenceP1 <= 5 * 60 & StatusP1 == "" & LRVNo == LRVNoP1 & Difference > 5 * 60) {
            TimelineKPI3$USDStatus[i - 1] <- "Start"
            TimelineKPI3$USDStatus[i] <- "End"

            if (Arr.Dep == "ARR") {
                TimelineKPI3$Note[i - 1] <- "Held between platforms"
            } else if (Arr.Dep == "DEP") {
                TimelineKPI3$Note[i - 1] <- "Held at platform"
            }
        } else if (DifferenceP1 + 5 * 60 < Difference & TripNo == TripNoP1) {
            TimelineKPI3$USDStatus[i - 1] <- "Start"
            TimelineKPI3$USDStatus[i] <- "End"

            if (Arr.Dep == "ARR") {
                TimelineKPI3$Note[i - 1] <- "Held between platforms"
            } else if (Arr.Dep == "DEP") {
                TimelineKPI3$Note[i - 1] <- "Held at platform"
            }
        }
    } else if (is.na(Difference) == TRUE & is.na(DifferenceP1) == FALSE & is.na(LRVNo) == TRUE & is.na(LRVNoP1) == FALSE &
        TripNo == TripNoP1) {
        if (DifferenceP1 > 5 * 60) {
            TimelineKPI3$USDStatus[i - 1] <- "Start"
            TimelineKPI3$USDStatus[i] <- "End"

            if (Arr.Dep == "ARR") {
                TimelineKPI3$Note[i - 1] <- "Held between platforms"
            } else if (Arr.Dep == "DEP") {
                TimelineKPI3$Note[i - 1] <- "Held at platform"
            }
        }
    }
}




TimelineKPI3 <- TimelineKPI3[!(TimelineKPI3$USDStatus == ""), ]
#TimelineKPI3$Scheduled <- as.POSIXct(TimelineKPI3$Scheduled)
TimelineKPI3$Scheduled<- as.character(TimelineKPI3$Scheduled)
TimelineKPI3$Actual<- as.character(TimelineKPI3$Actual)

#TimelineKPI3$Actual <- as.POSIXct(TimelineKPI3$Actual)
#tz(TimelineKPI3$Scheduled) <- ""
#tz(TimelineKPI3$Actual) <- ""



DelayTable3 <- data.frame("LRVNo", "StartTime", "StopTime", "Note", "Platform")
names(DelayTable3)[1] <- "LRVNo"
names(DelayTable3)[2] <- "StartTime"
names(DelayTable3)[3] <- "StopTime"
names(DelayTable3)[4] <- "Note"
names(DelayTable3)[5] <- "Platform"


DelayTable3$LRVNo <- "ABC"
DelayTable3$StartTime <- as.POSIXct(now(), tz = "")
DelayTable3$StopTime <- as.POSIXct(now(), tz = "")
DelayTable3$Stop <- "ABC"


DelayTable3$Note <- "Note"
DelayTable3$Platform <- "ABC"

TimelineKPI3$Platform <- paste(TimelineKPI3$Stop, TimelineKPI3$Direction, sep = "")

# Export rows from TimelineKPI3 with notes to DelayTable3
j <- 0

 for (i in 1:nrow(TimelineKPI3)) {
#for (i in seq_len(TimelineKPI3)) {

  #for (i in seq_along(TimelineKPI3)) {
    LRVNo <- as.character(TimelineKPI3$LRVNo[i])
    Note <- as.character(TimelineKPI3$Note[i])
    StartTime <- NA
    EndTime <- NA
    Trip <- as.character(TimelineKPI3$Trip[i])
    Direction <- as.character(TimelineKPI3$Direction[i])
    Stop <- as.character(TimelineKPI3$Stop[i])


    if (TimelineKPI3$USDStatus[i] == "Start") {
        StartTime <- as.POSIXct(TimelineKPI3$Scheduled[i], tz = "") + 5 * 60

        if (is.na(StartTime) == TRUE) {
            StartTime <- as.POSIXct(TimelineKPI3$Scheduled[i], tz = "") + 5 * 60
        }

        tz(StartTime) <- ""

        j <- j + 1
        DelayTable3[j, 1] <- "ABC"
        DelayTable3[j, 4] <- "ABC"
        DelayTable3[j, 5] <- "ABC"
        DelayTable3$Trip[j] <- "ABC"


        DelayTable3$LRVNo[j] <- LRVNo
        DelayTable3$Stop[j] <- Stop
        DelayTable3$Platform[j] <- paste(Stop, Direction, sep = "")
        DelayTable3$StartTime[j] <- StartTime
        DelayTable3$Note[j] <- Note
        DelayTable3$Trip[j] <- Trip
        
    } else if (TimelineKPI3$USDStatus[i] == "End") {
        if (is.na(TimelineKPI3$Actual[i - 1]) == TRUE) {
            EndTime <- as.POSIXct(TimelineKPI3$Scheduled[i - 1]) + 5 * 60

            if (is.na(EndTime) == TRUE) {
                EndTime <- as.POSIXct(TimelineKPI3$Scheduled[i - 1]) + 5 * 60
            }
        } else if (is.na(TimelineKPI3$Actual[i - 1]) == FALSE) {
            EndTime <- as.POSIXct(TimelineKPI3$Actual[i - 1]) + 5 * 60

            if (is.na(EndTime) == TRUE) {
                EndTime <- as.POSIXct(TimelineKPI3$Scheduled[i - 1]) + 5 * 60
            }
        }


        #tz(EndTime) <- ""
        DelayTable3$StopTime[j] <- EndTime
    }
}




#DelayTable3 <- DelayTable3[(!DelayTable3$StopTime == TRUE ),]

DelayTable3 <- DelayTable3[order(DelayTable3$StartTime), ]
DelayTable3 <- DelayTable3[!DelayTable3$Trip == "ABC", ]
#DelayTable3$Platform <- paste(DelayTable3$LRVNo, DelayTable3$Direction, sep ="")

#DelayTable3 <- DelayTable3[!DelayTable3$Trip == NA |is.na(DelayTable3$Trip),]
DelayTable3$Check <- ""


# finding if the time overlaps
for (i in 2:nrow(DelayTable3)) {
    StartTime1 <- DelayTable3$StartTime[i - 1]
    EndTime1 <- DelayTable3$StopTime[i - 1]

    StartTime2 <- DelayTable3$StartTime[i]
    EndTime2 <- DelayTable3$StopTime[i]

    Timeframe1 <- as.POSIXct(c(StartTime1, EndTime1), tz = "")
    Timeframe2 <- as.POSIXct(c(StartTime2, EndTime2), tz = "")



    if (Timeframe1 %overlaps% Timeframe2 & DelayTable3$Trip[i] != DelayTable3$Trip[i - 1]) {
        DelayTable3$Check[i] <- TRUE
    }
}

DelayTable3$Check <- TRUE

# finding if the incidents are in the same bigger incidents
# only look from row 1 to row second last

DelayTable3$ID <- 0

j <- 0

for (i in 2:(nrow(DelayTable3))) {
    status1 <- as.character(DelayTable3$Check[i - 1])
    status2 <- as.character(DelayTable3$Check[i])
    if (status1 == "" & status2 == TRUE) {
        j <- j + 1
    }

    if (status2 != "") {
        DelayTable3$ID[i] <- j
    }
}


# New table to calculate unplanned service disruption
UnplannedServiceDisruption3 <- data.frame("LRVNo", "StartTime", "StopTime", "ID", "Note")
names(UnplannedServiceDisruption3)[1] <- "LRVNo"
names(UnplannedServiceDisruption3)[2] <- "StartTime"
names(UnplannedServiceDisruption3)[3] <- "StopTime"
names(UnplannedServiceDisruption3)[4] <- "ID"
names(UnplannedServiceDisruption3)[5] <- "Note"
UnplannedServiceDisruption3$LRVNo <- "ABC"
UnplannedServiceDisruption3$StartTime <- as.POSIXct(now(), tz = "")
UnplannedServiceDisruption3$StopTime <- as.POSIXct(now(), tz = "")
UnplannedServiceDisruption3$ID <- 0
UnplannedServiceDisruption3$Note <- ""




j <- 0

for (i in 2:nrow(DelayTable3)) {
    if (DelayTable3$Check[i] == TRUE & DelayTable3$Check[i - 1] == FALSE) {
        j <- j + 1

        LRVNo <- as.character(DelayTable3$LRVNo[i - 1])
        StartTime <- as.POSIXct(DelayTable3$StartTime[i], tz = "")
        EndTime <- as.POSIXct(DelayTable3$StopTime[i - 1], tz = "")
        Note <- as.character(DelayTable3$Note[i])
        ID <- as.numeric(DelayTable3$ID[i])


        # if (ID == 0 && i != nrow(DelayTable3)) {
        #   if (as.numeric(DelayTable3$ID[i-1]) != 0) {
        #      ID <- as.numeric(DelayTable2$ID[i-1])
        #    }
        #  }

        UnplannedServiceDisruption3[j, 1:3] <- NA

        UnplannedServiceDisruption3$LRVNo[j] <- LRVNo
        UnplannedServiceDisruption3$StartTime[j] <- as.POSIXct(StartTime, tz = "")
        UnplannedServiceDisruption3$StopTime[j] <- as.POSIXct(EndTime, tz = "")
        UnplannedServiceDisruption3$ID[j] <- ID
        UnplannedServiceDisruption3$Note[j] <- Note
    } else if (DelayTable3$Check[i] == TRUE & DelayTable3$Check[i - 1] == TRUE) {
        j <- j + 1

        UnplannedServiceDisruption3[j, 1:3] <- NA
        LRVNo <- DelayTable3$LRVNo[i - 1]
        StartTime <- DelayTable3$StartTime[i - 1]
        EndTime <- DelayTable3$StopTime[i - 1]
        Note <- as.character(DelayTable3$Note[i - 1])

        UnplannedServiceDisruption3$LRVNo[j] <- LRVNo
        UnplannedServiceDisruption3$StartTime[j] <- as.POSIXct(StartTime, tz = "")
        UnplannedServiceDisruption3$StopTime[j] <- as.POSIXct(EndTime, tz = "")
        UnplannedServiceDisruption3$ID[j] <- ID
        UnplannedServiceDisruption3$Note[j] <- Note
    } else if (DelayTable3$Check[i] != TRUE & DelayTable3$Check[i - 1] == TRUE) {
        j <- j + 1

        UnplannedServiceDisruption3[j, 1:3] <- NA

        Note <- as.character(DelayTable3$Note[i - 1])
        LRVNo <- DelayTable3$LRVNo[i - 1]
        StartTime <- DelayTable3$StartTime[i - 1]
        EndTime <- DelayTable3$StopTime[i - 2]

        UnplannedServiceDisruption3$LRVNo[j] <- LRVNo
        UnplannedServiceDisruption3$StartTime[j] <- as.POSIXct(StartTime, tz = "")
        UnplannedServiceDisruption3$StopTime[j] <- as.POSIXct(EndTime, tz = "")
        UnplannedServiceDisruption3$ID[j] <- ID
        UnplannedServiceDisruption3$Note[j] <- Note
    }
}


#UnplannedServiceDisruption3 <- UnplannedServiceDisruption3[UnplannedServiceDisruption3$LRVno != "LRVNA", ]




#names(UnplannedServiceDisruption3)[1] <- "Platform"




j <- 0

DateString2 <- paste(substring(date_string, 5, 8), substring(date_string, 3, 4), substring(date_string, 1, 2), sep = "")

FolderString2 <- paste("C:/Users/svcPowerBI/OneDrive - Canberra Metro Operation/Business_Statistics - 01_Datasets/01_Cleaned Data/02_KPI/", month_string, "/",
    date_string, "/",
    sep = ""
)

setwd(FolderString2)
PIDPARaw3 <- read.csv(paste("KPI03_", DateString2, ".csv", sep = ""))
PIDPARaw3 <- PIDPARaw3[!(PIDPARaw3$type == "----" | PIDPARaw3$messageId == ""), ]
PIDPARaw3 <- PIDPARaw3[, colnames(PIDPARaw3) %in% c("eventTime", "type", "messageId", "stationList")]


PIDPARaw3$eventTime <- as.POSIXct(PIDPARaw3$eventTime, tz = "")

j <- nrow(PIDPARaw3)
m <- 0

PIDPARaw3$note <- ""

PIDPARaw3$stationList <- as.character(PIDPARaw3$stationList)

for (i in 1:nrow(PIDPARaw3)) {
    freeText <- as.character(PIDPARaw3$stationList[i])

    if (grepl("&", freeText) == TRUE) {
        oTime <- as.POSIXct(PIDPARaw3$eventTime[i], tz = "")
        oDesc <- as.character(PIDPARaw3$messageId[i])
        oType <- as.character(PIDPARaw3$type[i])

        m <- m + 1

        PIDPARaw3$note[i] <- paste("a", as.character(m), sep = "")

        a <- strsplit(freeText, "&")

        b <- array(as.character(unlist(a)))

        for (k in 1:length(b)) {
            j <- j + 1
            PIDPARaw3[j, 1:5] <- NA
            PIDPARaw3$eventTime[j] <- oTime
            PIDPARaw3$messageId[j] <- oDesc
            PIDPARaw3$type[j] <- oType


            PIDPARaw3$stationList[j] <- as.character(b[k])
            PIDPARaw3$note[j] <- paste("b", as.character(m), sep = "")
        }
    }
}



PIDPARaw3$code <- substring(PIDPARaw3$note, 1, 1)
PIDPARaw3 <- PIDPARaw3[!(PIDPARaw3$code == "a"), ]
PIDPARaw3 <- PIDPARaw3[, colnames(PIDPARaw3) %in% c("eventTime", "type", "messageId", "stationList")]



# PA Extraction
PIDPARaw3$code <- substring(PIDPARaw3$type, 1, 2)

PARaw3 <- PIDPARaw3[(PIDPARaw3$code == "PA"), ]
PARaw3 <- PARaw3[order(PARaw3$stationList, PARaw3$eventTime), ]
PARaw3$type <- substring(PARaw3$type, 13, 20)
PARaw3$Read <- FALSE

j <- 0

PA3 <- data.frame("LRVNo", "StartTime", "StopTime", "Note")
names(PA3)[1] <- "LRVNo"
names(PA3)[2] <- "StartTime"
names(PA3)[3] <- "StopTime"
names(PA3)[4] <- "MessagePlayed"

PA3$StartTime <- as.POSIXct(now())
PA3$StopTime <- as.POSIXct(now())
PA3$StartTime <- as.POSIXct(PA3$StartTime, tz = "")
PA3$StopTime <- as.POSIXct(PA3$StopTime, tz = "")
PA3$LRVNo <- "ABC"
PA3$MessagePlayed <- "ABC"

listofLRV <- unique(PARaw3$stationList)


for (l in 1:length(listofLRV)) {
    LRVNo <- listofLRV[l]
    RunningTable <- PARaw3[PARaw3$stationList == LRVNo, ]
    endLoop <- 0

    for (i in 1:nrow(RunningTable)) {
        status <- as.character(RunningTable$type[i])
        oTime <- as.POSIXct(RunningTable$eventTime[i], tz = "")
        LRVNo <- as.character(RunningTable$stationList[i])
        MessagePlayed <- as.character(RunningTable$messageId[i])
        readStatus <- RunningTable$Read[i]
        endLoop <- 0

        if ((status == "START" | status == "CONT") & endLoop == 0 & readStatus == FALSE) {
            j <- j + 1

            PA3[j, 1] <- NA

            PA3$StartTime[j] <- oTime
            PA3$LRVNo[j] <- LRVNo
            PA3$MessagePlayed[j] <- MessagePlayed

            k <- i + 1

            while (endLoop == 0 & k <= nrow(RunningTable)) {
                status1 <- as.character(RunningTable$type[k])
                oTime1 <- as.POSIXct(RunningTable$eventTime[k], tz = "")
                MessagePlayed1 <- as.character(RunningTable$messageId[k])
                readStatus1 <- RunningTable$Read[k]

                if (endLoop == 0 & status1 == "END" & readStatus1 == FALSE) {
                    PA3$StopTime[j] <- oTime1
                    endLoop <- 1
                }
                RunningTable$Read[k] <- TRUE
                k <- k + 1
            }

            if (endLoop == 0) {
                PA3$StopTime[j] <- oTime + 4 * 60
            }
        }
    }
}



PA3$PA.PID <- "PA"



# PID extraction
PIDPARaw3$code <- substring(PIDPARaw3$type, 4, 6)

PIDRaw3 <- PIDPARaw3[(PIDPARaw3$code == "PID"), ]
PIDRaw3 <- PIDRaw3[order(PIDRaw3$stationList, PIDRaw3$eventTime), ]
PIDRaw3$type <- substring(PIDRaw3$type, 13, 20)
PIDRaw3$Read <- FALSE

j <- 0

PID3 <- data.frame("Platform", "StartTime", "StopTime", "MessagePlayed")
names(PID3)[1] <- "Platform"
names(PID3)[2] <- "StartTime"
names(PID3)[3] <- "StopTime"
names(PID3)[4] <- "MessagePlayed"

PID3$StartTime <- as.POSIXct(now())
PID3$StopTime <- as.POSIXct(now())
PID3$StartTime <- as.POSIXct(PID3$StartTime, tz = "")
PID3$StopTime <- as.POSIXct(PID3$StopTime, tz = "")
PID3$Platform <- "ABC"
PID3$MessagePlayed <- "ABC"

listofPlatforms <- unique(PIDRaw3$stationList)



for (l in 1:length(listofPlatforms)) {
    Platform <- listofPlatforms[l]
    RunningTable <- PIDRaw3[PIDRaw3$stationList == Platform, ]
    endLoop <- 0

    for (i in 1:nrow(RunningTable)) {
        status <- as.character(RunningTable$type[i])
        oTime <- as.POSIXct(RunningTable$eventTime[i], tz = "")
        Platform <- as.character(RunningTable$stationList[i])
        MessagePlayed <- as.character(RunningTable$messageId[i])
        readStatus <- RunningTable$Read[i]
        endLoop <- 0

        if ((status == "START" | status == "CONT") & endLoop == 0 & readStatus == FALSE) {
            j <- j + 1

            PID3[j, 1] <- NA

            PID3$StartTime[j] <- oTime
            PID3$Platform[j] <- Platform
            PID3$MessagePlayed[j] <- MessagePlayed

            k <- i + 1

            while (endLoop == 0 & k <= nrow(RunningTable)) {
                status1 <- as.character(RunningTable$type[k])
                oTime1 <- as.POSIXct(RunningTable$eventTime[k], tz = "")
                MessagePlayed1 <- as.character(RunningTable$messageId[k])
                readStatus1 <- RunningTable$Read[k]

                if (endLoop == 0 & status1 == "END" & readStatus1 == FALSE) {
                    PID3$StopTime[j] <- oTime1
                    endLoop <- 1
                }
                RunningTable$Read[k] <- TRUE
                k <- k + 1
            }

            if (endLoop == 0) {
                PID3$StopTime[j] <- oTime + 4 * 60
            }
        }
    }
}




PID3$PA.PID <- "PID"


PA3$USD <- 0
PID3$USD <- 0
PA3$status <- FALSE
PID3$status <- FALSE




# finding overlaps between USD and PID/PA

for (i in 1:nrow(UnplannedServiceDisruption3)) {
    LRVNo <- as.character(UnplannedServiceDisruption3$LRVNo[i])
    StartTime <- as.POSIXct(UnplannedServiceDisruption3$StartTime[i], tz = "")
    StopTime <- as.POSIXct(UnplannedServiceDisruption3$StopTime[i], tz = "")
    TimeFrameUSD <- as.POSIXct(c(StartTime, StopTime), tz = "")
    USDID <- as.numeric(UnplannedServiceDisruption3$ID[i])


    for (x in 1:nrow(PA3)) {
        LRVNo <- as.character(PA3$LRVNo[x])

        if (LRVNo == LRVNo) {
            StartTimePA <- as.POSIXct(PA3$StartTime[x], tz = "")
            StopTimePA <- as.POSIXct(PA3$StopTime[x], tz = "")
            TimeframePA <- as.POSIXct(c(StartTimePA, StopTimePA), tz = "")

            if (TimeframePA %overlaps% TimeFrameUSD) {
                PA3$status[x] <- TRUE
                PA3$USD[x] <- USDID
            }
        }
    }

    # Finding PID corresponding to USD
    for (x in 1:nrow(PID3)) {
        PlatformPID <- as.character(PID3$Platform[x])

        if (LRVNo == LRVNo) {
            StartTimePID <- as.POSIXct(PID3$StartTime[x], tz = "")
            StopTimePID <- as.POSIXct(PID3$StopTime[x], tz = "")
            TimeframePID <- as.POSIXct(c(StartTimePID, StopTimePID), tz = "")

            if (TimeframePID %overlaps% TimeFrameUSD) {
                PID3$status[x] <- TRUE
                PID3$USD[x] <- USDID
            }
        }
    }
}


# Finding whether PID or PA is later than 4 minutes
# Creates 4min interval and a code column, showing whether if TRUE or FALSE
PID3$Interval4Mins <- as.POSIXct(PID3$StopTime, tz = "") + 4 * 60
PID3$Code <- paste(PID3$Platform, PID3$USD, PID3$status, sep = " ")
PID3 <- PID3[order(PID3$Code, PID3$StartTime), ]


PA3$Interval4Mins <- as.POSIXct(PA3$StopTime, tz = "") + 4 * 60
PA3$Code <- paste(PA3$LRVNo, PA3$USD, PA3$status, sep = " ")
PA3 <- PA3[order(PA3$Code, PA3$StartTime), ]



UnplannedServiceDisruption3$InitialPID <- as.POSIXct(now())
UnplannedServiceDisruption3$InitialPIDin4Mins <- TRUE
UnplannedServiceDisruption3$InitialPA <- as.POSIXct(now())
# UnplannedServiceDisruption3$InitialPA <- as.POSIXct(UnplannedServiceDisruption3$InitialPA)
UnplannedServiceDisruption3$InitialPAin4Mins <- TRUE
UnplannedServiceDisruption3$PIDevery4Mins <- TRUE
UnplannedServiceDisruption3$PAevery4Mins <- TRUE
UnplannedServiceDisruption3$PANote <- ""
UnplannedServiceDisruption3$PIDNote <- ""




for (i in 1:nrow(UnplannedServiceDisruption3)) {
    Platform <- as.character(UnplannedServiceDisruption3$LRVNo[i])
    ID <- as.numeric(UnplannedServiceDisruption3$ID[i])
    StartTimeUSD <- as.POSIXct(UnplannedServiceDisruption3$StartTime[i], tz = "")
    StopTimeUSD <- as.POSIXct(UnplannedServiceDisruption3$StopTime[i], tz = "")

    Code <- paste(Platform, ID, "TRUE", sep = " ")


    # analysing PA
    filterPA3 <- PA3[(PA3$Code == Code), ]

    # after filtering, there will be 3 scenarios (1) zero result (2) 1 result - can't loop (3) many results
    # zero result

    if (nrow(filterPA3) == 0) {
        UnplannedServiceDisruption3$InitialPAin4Mins[i] <- FALSE
        UnplannedServiceDisruption3$PAevery4Mins[i] <- FALSE
        UnplannedServiceDisruption3$PANote[i] <- "No PA played"
        UnplannedServiceDisruption3$InitialPA[i] <- NA
    } else if (nrow(filterPA3) > 1) {
        # working on scenario 3

        InitialPA <- as.POSIXct(min(filterPA3$StartTime), tz = "")
        UnplannedServiceDisruption3$InitialPA[i] <- InitialPA


        if (InitialPA > as.POSIXct(StartTimeUSD, tz = "") + 4 * 60) {
            UnplannedServiceDisruption3$InitialPAin4Mins[i] <- FALSE
        }

        FinalPA <- as.POSIXct(max(filterPA3$StopTime), tz = "")

        if (FinalPA < as.POSIXct(StopTimeUSD, tz = "") - 4 * 60) {
            UnplannedServiceDisruption3$PAevery4Mins[i] <- FALSE
        }

        for (j in 1:(nrow(filterPA3) - 1)) {
            EndTimeFirstInterval <- as.POSIXct(filterPA3$Interval4Mins[j], tz = "")
            RealEndTime <- as.POSIXct(filterPA3$StopTime[j], tz = "")
            StartTimeNextInterval <- as.POSIXct(filterPA3$StartTime[j + 1], tz = "")

            if (StartTimeNextInterval > EndTimeFirstInterval) {
                UnplannedServiceDisruption3$PAevery4Mins[i] <- FALSE
                UnplannedServiceDisruption3$PANote[i] <- paste(UnplannedServiceDisruption3$Note[i], "Interval > 4 mins from", RealEndTime, "to", StartTimeNextInterval, sep = " ")
            }

            UnplannedServiceDisruption3$PANote[i] <- paste(UnplannedServiceDisruption3$Note[i], "Interval < 4 mins from", RealEndTime, "to", StartTimeNextInterval, sep = " ")
        }
    } else if (nrow(filterPA3) == 1) {

        # working on scenario 3
        InitialPA <- as.POSIXct(filterPA3$StartTime[1], tz = "")
        FinalPA <- as.POSIXct(filterPA3$StopTime[1], tz = "")

        UnplannedServiceDisruption3$InitialPA[i] <- InitialPA


        if (InitialPA > StartTimeUSD + 4 * 60) {
            UnplannedServiceDisruption3$InitialPAin4Mins[i] <- FALSE
        }

        if (FinalPA < StopTimeUSD - 4 * 60) {
            UnplannedServiceDisruption3$PAevery4Mins[i] <- TRUE
        }

        UnplannedServiceDisruption3$PANote[i] <- paste("One PA played from", InitialPA, "to", FinalPA, sep = " ")
    }
}









# KPI03 Analysing PID -------------
for (i in 1:nrow(UnplannedServiceDisruption3)) {
    Platform <- as.character(UnplannedServiceDisruption3$LRVNo[i])
    ID <- as.numeric(UnplannedServiceDisruption3$ID[i])
    StartTimeUSD <- as.POSIXct(UnplannedServiceDisruption3$StartTime[i], tz = "")
    StopTimeUSD <- as.POSIXct(UnplannedServiceDisruption3$StopTime[i], tz = "")

    Code <- paste(Platform, ID, "TRUE" , sep = " ")


    filterPID3 <- PID3[(PID3$Code == Code), ]

    # after filtering, there will be 3 scenarios (1) zero result (3) 1 result - can't loop (3) many results
    
    # (1)zero result
    if (nrow(filterPID3) == 0) {
        UnplannedServiceDisruption3$InitialPIDin4Mins[i] <- FALSE
        UnplannedServiceDisruption3$PIDevery4Mins[i] <- FALSE
        UnplannedServiceDisruption3$PIDNote[i] <- "None PID played"
        UnplannedServiceDisruption3$InitialPID[i] <- NA
    } else if (nrow(filterPID3) > 1) {
        # working on scenario 3

        InitialPID <- as.POSIXct(min(filterPID3$StartTime), tz = "")
        UnplannedServiceDisruption3$InitialPID[i] <- InitialPID
        FinalPID <- as.POSIXct(max(filterPID3$StopTime), tz = "")


        if (InitialPID > as.POSIXct(StartTimeUSD, tz = "") + 4 * 60) {
            UnplannedServiceDisruption3$InitialPIDin4Mins[i] <- FALSE
        }


        if (FinalPID < as.POSIXct(StopTimeUSD, tz = "") - 4 * 60) {
            UnplannedServiceDisruption3$PIDevery4Mins[i] <- TRUE
        }

        for (j in 1:(nrow(filterPID3) - 1)) {
            EndTimeFirstInterval <- as.POSIXct(filterPID3$Interval4Mins[j], tz = "")
            RealEndTime <- as.POSIXct(filterPID3$StopTime[j], tz = "")
            StartTimeNextInterval <- as.POSIXct(filterPID3$StartTime[j + 1], tz = "")

            if (StartTimeNextInterval > EndTimeFirstInterval) {
                UnplannedServiceDisruption3$PIDevery4Mins[i] <- FALSE
                UnplannedServiceDisruption3$PIDNote[i] <- paste(UnplannedServiceDisruption3$Note[i], "Interval > 4 mins from", RealEndTime, "to", StartTimeNextInterval, sep = " ")
            }

            UnplannedServiceDisruption3$PIDNote[i] <- paste(UnplannedServiceDisruption3$Note[i], "Interval < 4 mins from", RealEndTime, "to", StartTimeNextInterval, sep = " ")
        }
    } else if (nrow(filterPID3) == 1) {
        # working on scenario 3
        InitialPID <- as.POSIXct(filterPID3$StartTime[1], tz = "")
        FinalPID <- as.POSIXct(filterPID3$StopTime[1], tz = "")

        UnplannedServiceDisruption3$InitialPID[i] <- InitialPID

        if (InitialPID > StartTimeUSD + 4 * 60) {
            UnplannedServiceDisruption3$InitialPIDin4Mins[i] <- FALSE
        }

        if (FinalPID < StopTimeUSD - 4 * 60) {
            UnplannedServiceDisruption3$PIDevery4Mins[i] <- FALSE
        }

        UnplannedServiceDisruption3$PIDNote[i] <- paste("One PID played from", InitialPID, "to", FinalPID, sep = " ")
    }
}





# Calculating KPI03 ------
UnplannedServiceDisruption3 <- UnplannedServiceDisruption3[(!UnplannedServiceDisruption3$LRVNo == "ABC"), ]

UnplannedServiceDisruption3$LengthofDisruption <- difftime(UnplannedServiceDisruption3$StopTime,
    UnplannedServiceDisruption3$StartTime,
    tz = "", units = "mins"
)

UnplannedServiceDisruption3$LengthCondition <- ifelse(UnplannedServiceDisruption3$LengthofDisruption > 4, TRUE, FALSE)

UnplannedServiceDisruption3$InitialKPI <- ifelse((UnplannedServiceDisruption3$InitialPAin4Mins == FALSE |
    UnplannedServiceDisruption3$InitialPIDin4Mins == FALSE) &
    UnplannedServiceDisruption3$LengthCondition == TRUE, 0.5, 0)

UnplannedServiceDisruption3$SubsequentKPI <- ifelse((UnplannedServiceDisruption3$PAevery4Mins == FALSE |
    UnplannedServiceDisruption3$PIDevery4Mins == FALSE) &
    UnplannedServiceDisruption3$LengthCondition == TRUE, 2, 0)


UnplannedServiceDisruption3$InitialKPIOfficial <- UnplannedServiceDisruption3$InitialKPI - UnplannedServiceDisruption3$InitialKPI
UnplannedServiceDisruption3$SubsequentKPIOfficial <- UnplannedServiceDisruption3$SubsequentKPI - UnplannedServiceDisruption3$SubsequentKPI


for (i in 1:nrow(UnplannedServiceDisruption3)) {
    InitialKPI <- as.numeric(UnplannedServiceDisruption3$InitialKPIOfficial[i])
    SubsequentKPI <- as.numeric(UnplannedServiceDisruption3$SubsequentKPIOfficial[i])
    LRVNo <- as.character(UnplannedServiceDisruption3$LRVNo[i])

    a <- which(UnplannedServiceDisruption3$LRVNo == LRVNo & UnplannedServiceDisruption3$InitialKPI > InitialKPI, )
    b <- which(UnplannedServiceDisruption3$LRVNo == LRVNo & UnplannedServiceDisruption3$SubsequentKPI > SubsequentKPI, )

    if (length(a) == 0) {
        UnplannedServiceDisruption3$InitialKPIOfficial[i] <- as.numeric(UnplannedServiceDisruption3$InitialKPI[i])
    }

    if (length(a) == 1) {
        if (a == i) {
            UnplannedServiceDisruption3$InitialKPIOfficial[i] <- as.numeric(UnplannedServiceDisruption3$InitialKPI[a])
        }
    }

    if (length(b) == 0) {
        UnplannedServiceDisruption3$SubsequentKPIOfficial[i] <- as.numeric(UnplannedServiceDisruption3$SubsequentKPI[i])
    }

    if (length(b) == 1) {
        if (b == i) {
            UnplannedServiceDisruption3$SubsequentKPIOfficial[i] <- as.numeric(UnplannedServiceDisruption3$SubsequentKPI[b])
        }
    }
}







UnplannedServiceDisruption3$LengthofDisruption <- difftime(UnplannedServiceDisruption3$StopTime,
    UnplannedServiceDisruption3$StartTime,
    tz = "", units = "mins"
)

UnplannedServiceDisruption3$LengthCondition <- ifelse(UnplannedServiceDisruption3$LengthofDisruption > 4, TRUE, FALSE)

#UnplannedServiceDisruption3$totalPP <- ifelse(UnplannedServiceDisruption3$LengthCondition == TRUE, 2.5, 0)
UnplannedServiceDisruption3$totalPP <- UnplannedServiceDisruption3$InitialKPIOfficial + UnplannedServiceDisruption3$SubsequentKPIOfficial


DateString2 <- paste(substring(date_string, 5, 8), substring(date_string, 3, 4), substring(date_string, 1, 2), sep = "")

# Remove LRVNA from list
UnplannedServiceDisruption3 <- UnplannedServiceDisruption3[!grepl("LRVNA", UnplannedServiceDisruption3$LRVNo), ]



# KPI03 Calculation END ------


FolderString2 <- paste("C:/Users/svcPowerBI/OneDrive - Canberra Metro Operation/Business_Statistics - 01_Datasets/01_Cleaned Data/02_KPI/", month_string, "/",
    date_string, "/",
    sep = ""
)

if (dir.exists(paste("C:/Users/svcPowerBI/OneDrive - Canberra Metro Operation/Business_Statistics - 01_Datasets/01_Cleaned Data/02_KPI/", month_string, "/", sep = "")) == FALSE) {
    dir.create(paste("C:/Users/svcPowerBI/OneDrive - Canberra Metro Operation/Business_Statistics - 01_Datasets/01_Cleaned Data/02_KPI/", month_string, "/", sep = ""))
}


if (dir.exists(FolderString2) == FALSE) {
    dir.create(FolderString2)
}

setwd(FolderString2)



UnplannedServiceDisruption3 <- UnplannedServiceDisruption3[!(UnplannedServiceDisruption3$LRVNo == "ABC"), ]

setwd(FolderString2)
write.csv(UnplannedServiceDisruption3, paste("KPI03-result", DateString2, ".csv", sep = ""))
}
# }
}
