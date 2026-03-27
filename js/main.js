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
    careerChart.wrangleData();
});

// situation to filter by
d3.selectAll("#situation-selector .btn-ctrl").on("click", function () {
    d3.selectAll("#situation-selector .btn-ctrl").classed("active", false);
    d3.select(this).classed("active", true);
    selectedSit = d3.select(this).attr("data-sit");
    careerChart.wrangleData();
});

// cumulative / per season toggle
d3.selectAll("#cumulative-selector .btn-ctrl").on("click", function () {
    d3.selectAll("#cumulative-selector .btn-ctrl").classed("active", false);
    d3.select(this).classed("active", true);
    isCumulative = d3.select(this).attr("data-cumul") === "true";
    careerChart.wrangleData();
});

