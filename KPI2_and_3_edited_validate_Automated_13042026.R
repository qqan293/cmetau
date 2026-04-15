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
date_runner <- 0


# KPI2and3 <- function(date_runner){

o_date <- as.Date(today() - date_runner - 1)

month_string <- format(o_date, format = "%Y%m. %B %Y")
date_string_1 <- format(o_date, format = "%y%m%d")
date_string <- format(o_date, format = "%d%m%Y")


folder_string_1 <- paste("C:/Users/svcPowerBI/OneDrive - Canberra Metro Operation/Business_Statistics - 01_Datasets/01_Cleaned Data/01_AOTRA/Timeline/", month_string, "/", sep = "")
setwd(folder_string_1)



Timeline <- read.csv(paste("Timeline-", date_string, ".csv", sep = ""))


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
  
  setwd(folder_string_1)
  
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

FolderString2 <- paste("C:/Users/svcPowerBI/OneDrive - Canberra Metro Operation/Business_Statistics - 01_Datasets/01_Cleaned Data/02_KPI/", month_string, "/",
    date_string, "/",
    sep = ""
)

setwd(FolderString2)
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
PIDPARaw2$code <- substring(PIDPARaw2$type, 1, 2)

PARaw2 <- PIDPARaw2[(PIDPARaw2$code == "PA"), ]
PARaw2 <- PARaw2[order(PARaw2$stationList, PARaw2$eventTime), ]

PARaw2$type <- substring(PARaw2$type, 11, 20)




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
PIDRaw2$type <- substring(PIDRaw2$type, 7, 11)
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
        UnplannedServiceDisruption2$InitialPID[i] <- FALSE
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
# Populating table to calculate KPI02
UnplannedServiceDisruption2 <- UnplannedServiceDisruption2[(!UnplannedServiceDisruption2$Platform == "ABC"), ]

UnplannedServiceDisruption2$LengthofDisruption <- difftime(UnplannedServiceDisruption2$StopTime,
    UnplannedServiceDisruption2$StartTime,
    tz = "", units = "mins"
)
UnplannedServiceDisruption2$LengthCondition <- ifelse(UnplannedServiceDisruption2$LengthofDisruption > 4, TRUE, FALSE)

UnplannedServiceDisruption2$InitialKPI <- ifelse((UnplannedServiceDisruption2$InitialPAin4Mins == FALSE |
    UnplannedServiceDisruption2$InitialPIDin4Mins == FALSE) &
    UnplannedServiceDisruption2$LengthCondition == TRUE, 0.5, 0)

UnplannedServiceDisruption2$SubsequentKPI <- ifelse((UnplannedServiceDisruption2$PAevery4Mins == FALSE |
    UnplannedServiceDisruption2$PIDevery4Mins == FALSE) &
    UnplannedServiceDisruption2$LengthCondition == TRUE, 2, 0)


UnplannedServiceDisruption2$InitialKPIOfficial <- UnplannedServiceDisruption2$InitialKPI - UnplannedServiceDisruption2$InitialKPI
UnplannedServiceDisruption2$SubsequentKPIOfficial <- UnplannedServiceDisruption2$SubsequentKPI - UnplannedServiceDisruption2$SubsequentKPI


# Calculating for 0.5PP and 2PP in KPI02
for (i in 1:nrow(UnplannedServiceDisruption2)) {
    InitialKPI <- as.numeric(UnplannedServiceDisruption2$InitialKPIOfficial[i])
    SubsequentKPI <- as.numeric(UnplannedServiceDisruption2$SubsequentKPIOfficial[i])
    Platform <- as.character(UnplannedServiceDisruption2$Platform[i])
    ID <- as.character(UnplannedServiceDisruption2$ID[i])

    # a = For 0.5PP calculation for missing initial notification within 4min of PID or PA per platform after a USD
    a <- which(UnplannedServiceDisruption2$Platform == Platform & UnplannedServiceDisruption2$InitialKPI > InitialKPI & UnplannedServiceDisruption2$ID == ID, )
    RUnningTableA <- UnplannedServiceDisruption2[UnplannedServiceDisruption2$Platform == Platform & UnplannedServiceDisruption2$InitialKPI > InitialKPI & UnplannedServiceDisruption2$ID == ID, ]

    # b = For 2PP for Subsequent PA or PID are missed per platform
    b <- which(UnplannedServiceDisruption2$Platform == Platform & UnplannedServiceDisruption2$SubsequentKPI > SubsequentKPI & UnplannedServiceDisruption2$ID == ID, )
    RUnningTableB <- UnplannedServiceDisruption2[UnplannedServiceDisruption2$Platform == Platform & UnplannedServiceDisruption2$SubsequentKPI > SubsequentKPI & UnplannedServiceDisruption2$ID == ID, ]

    if (length(a) == 0) {
        UnplannedServiceDisruption2$InitialKPIOfficial[i] <- UnplannedServiceDisruption2$InitialKPI[i]
    }


    if (length(a) == 1) {
        if (a == i) {
            UnplannedServiceDisruption2$InitialKPIOfficial[i] <- as.numeric(UnplannedServiceDisruption2$InitialKPI[a])
        }
    }


    if (length(b) == 0) {
        UnplannedServiceDisruption2$SubsequentKPIOfficial[i] <- as.numeric(UnplannedServiceDisruption2$SubsequentKPI[i])
    }

    if (length(b) == 1) {
        if (b == i) {
            UnplannedServiceDisruption2$SubsequentKPIOfficial[i] <- as.numeric(UnplannedServiceDisruption2$SubsequentKPI[b])
        }
    }
}

UnplannedServiceDisruption2$totalPP <- UnplannedServiceDisruption2$InitialKPIOfficial + UnplannedServiceDisruption2$SubsequentKPIOfficial


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
