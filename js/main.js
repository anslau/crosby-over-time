let selectedMetric  = "points";
let selectedSit     = "all";
let isCumulative    = false;
let selectedSeason  = null;
let selectedGMetric = "gameScore";
let showRolling     = true;

let careerChart, gameChart, dangerChart, seasonStoryOverlay;

let seasonStatsData = [];
let gameStatsData = [];
let annotationData = [];

// metrics that have situation-split fields in the dataset (goals5v5, goalsPP, xGoals5v5, xGoalsPP)
// everything else only exists as an all-situation total
const SIT_SPLIT_METRICS = new Set(["goals", "xGoals"]);

// avgGameScore has no meaningful cumulative sum
const CUMUL_METRICS = new Set(["points", "goals", "assists", "xGoals"]);

// update the visual state of the filter controls to reflect what's actually possible
// with the current dataset disables buttons for combos that have no data
function updateControlStates() {
    const hasSitSplit = SIT_SPLIT_METRICS.has(selectedMetric);
    const canCumulate = CUMUL_METRICS.has(selectedMetric);

    // situation buttons: disable 5v5 and PP when the selected metric has no split data
    d3.selectAll("#situation-selector .btn-ctrl").each(function () {
        const sit = d3.select(this).attr("data-sit");
        if (sit === "all") return; // "all" is always valid
        d3.select(this)
            .classed("btn-ctrl-disabled", !hasSitSplit)
            .property("disabled", !hasSitSplit);
    });

    // if the current situation is now invalid, silently reset to "all"
    if (!hasSitSplit && selectedSit !== "all") {
        selectedSit = "all";
        d3.selectAll("#situation-selector .btn-ctrl").classed("active", false);
        d3.select("#situation-selector [data-sit='all']").classed("active", true);
    }

    // cumulative toggle: disable "Cumulative" for avgGameScore
    d3.selectAll("#cumulative-selector .btn-ctrl").each(function () {
        const cumul = d3.select(this).attr("data-cumul");
        if (cumul === "false") return; // "Per Season" is always valid
        d3.select(this)
            .classed("btn-ctrl-disabled", !canCumulate)
            .property("disabled", !canCumulate);
    });

    // if cumulative is active but now disabled, reset to per-season
    if (!canCumulate && isCumulative) {
        isCumulative = false;
        d3.selectAll("#cumulative-selector .btn-ctrl").classed("active", false);
        d3.select("#cumulative-selector [data-cumul='false']").classed("active", true);
    }
}

// load all data
loadData();
function loadData() {
    Promise.all([
        d3.json("data/season_stats.json"),
        d3.json("data/game_stats.json"),
        d3.json("data/annotations.json"),
    ]).then(([seasonData, gameData, annotations]) => {
        seasonStatsData = seasonData;
        gameStatsData = gameData;
        annotationData = annotations;

        careerChart = new CareerChart("career-chart", seasonData, annotations, gameData);
        seasonStoryOverlay = new SeasonStoryOverlay("season-story-overlay", seasonData, gameData, annotations);

        updateControlStates();
        careerChart.playAnimation();
    }).catch(err => console.error("Error loading data:", err));
}

// called by the careerchart when a season node is clicked
function onSeasonSelected(season) {
    selectedSeason = season;

    // Open scrolly layer
    if (seasonStoryOverlay) {
        seasonStoryOverlay.open(season);
    }
}

// metric to filter by
d3.selectAll("#metric-selector .btn-ctrl").on("click", function () {
    d3.selectAll("#metric-selector .btn-ctrl").classed("active", false);
    d3.select(this).classed("active", true);
    selectedMetric = d3.select(this).attr("data-metric");
    updateControlStates();
    careerChart.wrangleData();
});

// situation to filter by
d3.selectAll("#situation-selector .btn-ctrl").on("click", function () {
    if (d3.select(this).classed("btn-ctrl-disabled")) return; // ignore clicks on disabled buttons
    d3.selectAll("#situation-selector .btn-ctrl").classed("active", false);
    d3.select(this).classed("active", true);
    selectedSit = d3.select(this).attr("data-sit");
    careerChart.wrangleData();
});

// cumulative / per season toggle
d3.selectAll("#cumulative-selector .btn-ctrl").on("click", function () {
    if (d3.select(this).classed("btn-ctrl-disabled")) return; // ignore clicks on disabled buttons
    d3.selectAll("#cumulative-selector .btn-ctrl").classed("active", false);
    d3.select(this).classed("active", true);
    isCumulative = d3.select(this).attr("data-cumul") === "true";
    careerChart.wrangleData();
});