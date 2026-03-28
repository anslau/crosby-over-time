// https://pudding.cool/process/introducing-scrollama/
// https://github.com/russellsamora/scrollama/blob/main/docs/sticky-overlay/index.html

class SeasonStoryOverlay {
    constructor(parentId, seasonData, gameData, annotations) {
        this.parent = d3.select(`#${parentId}`);
        this.seasonData = seasonData;
        this.gameData = gameData;
        this.annotations = annotations || [];

        this.currentSeason = null;
        this.currentSeasonInfo = null;
        this.currentGames = [];
        this.stepsData = [];

        this.tooltip = d3.select("body")
            .append("div")
            .attr("class", "story-tooltip");

        this.scroller = scrollama();
        this._scrollerActive = false;   // track whether scroller has been set up

        this.parseDate = d3.timeParse("%Y%m%d");
        this.formatDate = d3.timeFormat("%b %-d, %Y");
        this.formatMonth = d3.timeFormat("%b %Y");

        this._bindUI();
        this._setupChart();

        this.handleResize = this.handleResize.bind(this);
        window.addEventListener("resize", this.handleResize);
    }

    // close the scrolly using the x button or clickign the backdrop
    _bindUI() {
        d3.select("#close-story-overlay").on("click", () => this.close());
        d3.select("#season-story-backdrop").on("click", () => this.close());
    }

    // create the svg once
    _setupChart() {
        this.svg = d3.select("#story-chart");
        this.figureCaption = d3.select("#story-figure-caption");
        this.stepsContainer = d3.select("#story-steps");

        this.margin = { top: 30, right: 30, bottom: 50, left: 60 };

        this.chartG = this.svg.append("g");
        this.gridG = this.chartG.append("g").attr("class", "story-grid");
        this.bandG = this.chartG.append("g");
        this.lineG = this.chartG.append("g");
        this.dotG = this.chartG.append("g");
        this.annotationG = this.chartG.append("g");
        this.xAxisG = this.chartG.append("g").attr("class", "story-axis");
        this.yAxisG = this.chartG.append("g").attr("class", "story-axis");

        this.x = d3.scaleLinear();
        this.y = d3.scaleLinear();
    }

    // open
    open(season) {
        // tear down any previous scrolly session first 
        this._destroyScroller();

        this.currentSeason = season;
        this.currentSeasonInfo = this.seasonData.find(d => d.season === season);

        this.currentGames = this.gameData
            .filter(d => d.season === season)
            .map(d => ({ ...d, parsedDate: this.parseDate(String(d.gameDate)) }))
            .sort((a, b) => a.parsedDate - b.parsedDate);

        if (!this.currentSeasonInfo || !this.currentGames.length) return;

        this._precompute();
        this.stepsData = this._buildStorySteps();

        d3.select("#story-title").text(`${this.currentSeasonInfo.seasonLabel} Season`);
        d3.select("#story-subtitle").text(
            `${this.currentSeasonInfo.gp} GP · ${this.currentSeasonInfo.goals} G · ` +
            `${this.currentSeasonInfo.assists} A · ${this.currentSeasonInfo.points} P`
        );

        // fully clear previous step cards before re-rendering 
        this.stepsContainer.selectAll(".story-step").remove();
        this._renderSteps();

        this._renderBaseChart();
        this._setupScroller();

        this.parent.classed("open", true);
        d3.select("body").classed("story-overlay-open", true);

        const scrollArea = document.getElementById("story-scrolly");
        if (scrollArea) scrollArea.scrollTop = 0;

        this.updateStep(0);
    }

    close() {
        this._destroyScroller();
        this.parent.classed("open", false);
        d3.select("body").classed("story-overlay-open", false);
        d3.selectAll(".story-step").classed("is-active", false);
        this.tooltip.style("opacity", 0);
    }

    // scroller lifecycle helpers
    _destroyScroller() {
        if (this._scrollerActive) {
            try { this.scroller.destroy(); } catch(e) {}
            this._scrollerActive = false;
        }
    }

    _setupScroller() {
        this.handleResize();
        this.scroller
            .setup({ step: ".story-step", offset: 0.55, debug: false, container: "#story-scrolly" })
            .onStepEnter(response => {
                d3.selectAll(".story-step").classed("is-active", (d, i) => i === response.index);
                this.updateStep(response.index);
            });
        this._scrollerActive = true;
    }

    // precompute season-level stats once 
    _precompute() {
        const g = this.currentGames;
        const info = this.currentSeasonInfo;

        this.stats = {
            totalPoints: d3.sum(g, d => d.points   || 0),
            totalGoals: d3.sum(g, d => d.goals     || 0),
            totalAssists: d3.sum(g, d => (d.primaryAssists||0) + (d.secondaryAssists||0)),
            totalXGoals: d3.sum(g, d => d.xGoals    || 0),
            avgGS: d3.mean(g, d => d.gameScore || 0) || 0,

            homeGames: g.filter(d => d.homeAway === "HOME"),
            awayGames: g.filter(d => d.homeAway === "AWAY"),

            highDG: d3.sum(g, d => d.highDangerGoals  || 0),
            medDG: d3.sum(g, d => d.medDangerGoals   || 0),
            lowDG: d3.sum(g, d => d.lowDangerGoals   || 0),
            highXG: d3.sum(g, d => d.highDangerxGoals || 0),
            medXG: d3.sum(g, d => d.medDangerxGoals  || 0),
            lowXG: d3.sum(g, d => d.lowDangerxGoals  || 0),

            overGames: g.filter(d => (d.goals||0) > (d.xGoals||0)).length,
            underGames: g.filter(d => (d.goals||0) < (d.xGoals||0)).length,

            topGames: [...g].sort((a,b) => (b.points||0)-(a.points||0)).slice(0, 8),
        };

        const stats = this.stats;
        stats.homePPG  = stats.homeGames.length ? d3.mean(stats.homeGames, d => d.points || 0) : 0;
        stats.awayPPG  = stats.awayGames.length ? d3.mean(stats.awayGames, d => d.points || 0) : 0;
        stats.homeGPG  = stats.homeGames.length ? d3.mean(stats.homeGames, d => d.goals || 0) : 0;
        stats.awayGPG  = stats.awayGames.length ? d3.mean(stats.awayGames, d => d.goals || 0) : 0;
        stats.homeAPG  = stats.homeGames.length ? d3.mean(stats.homeGames, d => (d.primaryAssists || 0) + (d.secondaryAssists || 0)) : 0;
        stats.awayAPG  = stats.awayGames.length ? d3.mean(stats.awayGames, d => (d.primaryAssists || 0) + (d.secondaryAssists || 0)) : 0;
        stats.homeGsPG = stats.homeGames.length ? d3.mean(stats.homeGames, d => d.gameScore || 0) : 0;
        stats.awayGsPG = stats.awayGames.length ? d3.mean(stats.awayGames, d => d.gameScore || 0) : 0;
        stats.homeXGPG = stats.homeGames.length ? d3.mean(stats.homeGames, d => d.xGoals || 0) : 0;
        stats.awayXGPG = stats.awayGames.length ? d3.mean(stats.awayGames, d => d.xGoals || 0) : 0;

        // hot streak: consecutive games above avgGS + 0.3
        const hotStreakThreshold = stats.avgGS + 0.3;
        let longestStreakLen = 0, currentStreakLen = 0, longestStreakStart = 0, currentStreakStart = 0;
        g.forEach((game, i) => {
            if ((game.gameScore || 0) >= hotStreakThreshold) {
                if (currentStreakLen === 0) {
                    currentStreakStart = i;
                }
                currentStreakLen++;
                if (currentStreakLen > longestStreakLen) { 
                    longestStreakLen = currentStreakLen; 
                    longestStreakStart = currentStreakStart; 
                }
            } else { 
                currentStreakLen = 0; 
            }
        });
        stats.streakLen = longestStreakLen;
        stats.streakStart = longestStreakStart;
        stats.streakPoints = d3.sum(g.slice(longestStreakStart, longestStreakStart + longestStreakLen), d => d.points||0);
        stats.pctHigh = stats.totalGoals > 0 ? (stats.highDG / stats.totalGoals * 100).toFixed(0) : 0;
    }

    // story steps
    _buildStorySteps() {
        const stats = this.stats;
        const info = this.currentSeasonInfo;
        const top  = stats.topGames[0];
        const haDir = stats.homePPG > stats.awayPPG ? "at home" :
                      stats.homePPG < stats.awayPPG ? "on the road" : "evenly home and away";

        return [
            {
                key: "heatmap",
                title: "Season at a Glance",
                text: `The ${info.seasonLabel} season spanned ${info.gp} games: ${stats.totalGoals} goals, ${stats.totalAssists} assists, ${stats.totalPoints} points. Each square represents one game, colored by GameScore, a composite measure of individual impact and productivity per game. `,
                caption: "Each square = one game. Color = GameScore. Hover for details."
            },
            {
                key: "top-games",
                title: "Best Single-Game Performances",
                text: `His biggest game produced ${top?.points || 0} points${top ? ` against ${top.opponent}` : ""}. The chart breaks down his top 8 performances by points, separating goals (gold) from assists.`,
                caption: "Top 8 games by points. Gold = goals, muted = assists."
            },
            {
                key: "danger",
                title: "Where the Goals Came From",
                text: `${stats.pctHigh}% of his goals this season came from high-danger areas (the slot and crease front). High-danger chances are the hardest to generate and the most likely to score. This chart compares actual goals to expected goals across each danger zone.`,
                caption: "Actual goals vs. xGoals (expected goals - the probability of a shot resulting in a goal) by shot danger zone."
            },
            {
                key: "home-away",
                title: "Home vs. Away",
                text: `He produced more ${haDir} this season. Home: ${stats.homePPG.toFixed(2)} pts/game, ${stats.homeGPG.toFixed(2)} goals/game. Away: ${stats.awayPPG.toFixed(2)} pts/game, ${stats.awayGPG.toFixed(2)} goals/game. The bars compare five per-game averages split by venue.`,
                caption: "Per-game averages across five metrics, split by home and away."
            },
            {
                key: "streak",
                title: "Hot Streaks & Cold Spells",
                text: stats.streakLen > 0
                    ? `His longest hot streak ran ${stats.streakLen} straight games above his seasonal GameScore average, during which he produced ${stats.streakPoints} points. The grid shows the full season colored by GameScore intensity, with the gold border marking that peak run.`
                    : `The grid shows every game colored by GameScore, making hot and cold stretches immediately visible across the full arc of the season.`,
                caption: "Color = GameScore intensity. Gold border = longest above-average streak."
            }
        ];
    }

    // the sidebar car
    _renderSteps() {
        this.stepsData.forEach((d, i) => {
            this.stepsContainer.append("div")
                .attr("class", "story-step")
                .attr("data-step", i)
                .html(`<h3>${d.title}</h3><p>${d.text}</p>`);
        });
    }

    // render the chart area
    _renderBaseChart() {
        const svgNode = document.getElementById("story-chart");
        const rect = svgNode.getBoundingClientRect();

        this.outerWidth  = rect.width  || 800;
        this.outerHeight = rect.height || 520;
        this.width  = this.outerWidth - this.margin.left - this.margin.right;
        this.height = this.outerHeight - this.margin.top - this.margin.bottom;

        this.svg.attr("width", this.outerWidth).attr("height", this.outerHeight);
        this.chartG.attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        this._clearChart();
    }

    _clearChart() {
        [this.gridG, this.bandG, this.lineG, this.dotG, this.annotationG].forEach(g => g.selectAll("*").remove());
        this.xAxisG.selectAll("*").remove().style("opacity", 0);
        this.yAxisG.selectAll("*").remove().style("opacity", 0);
    }

    handleResize() {
        const scrollArea  = document.getElementById("story-scrolly");
        const storyFigure = document.getElementById("story-figure");
        if (scrollArea && storyFigure && window.innerWidth > 1100) {
            storyFigure.style.height = `${Math.max(520, scrollArea.clientHeight - 8)}px`;
        }
        const svgNode = document.getElementById("story-chart");
        if (svgNode && this.currentGames.length) {
            this._renderBaseChart();
            const active = d3.select(".story-step.is-active");
            this.updateStep(active.empty() ? 0 : +active.attr("data-step"));
        }
        if (this._scrollerActive) this.scroller.resize();
    }

    // draw the correct chart based on the scroll step
    updateStep(stepIndex) {
        const games = this.currentGames;
        if (!games.length) return;

        this.figureCaption.text(this.stepsData[stepIndex]?.caption || "");
        this._clearChart();

        const W = this.width, H = this.height;

        if (stepIndex === 0) this._drawHeatmap(games, W, H);
        else if (stepIndex === 1) this._drawTopGames(games, W, H);
        else if (stepIndex === 2) this._drawDanger(games, W, H);
        else if (stepIndex === 3) this._drawHomeAway(games, W, H);
        else if (stepIndex === 4) this._drawStreak(games, W, H);
    }

    // step 0: GameScore heatmap grid 
    _drawHeatmap(games, chartWidth, chartHeight) {
        const numCols  = Math.ceil(Math.sqrt(games.length * (chartWidth / chartHeight)));
        const cellWidth = chartWidth / numCols;
        const cellHeight = chartHeight / Math.ceil(games.length / numCols);
        const cellPadding   = 2.5;
 
        const gameScoreExtent = d3.extent(games, d => d.gameScore || 0);
        const medianScore   = d3.median(games, d => d.gameScore || 0) || 0;
        const color = d3.scaleDiverging(t => d3.interpolateRgb("#1a2a3a", "#fcbc19")(t))
            .domain([gameScoreExtent[0], medianScore, gameScoreExtent[1]]);
 
        this.dotG.selectAll(".heat-cell")
            .data(games)
            .join("rect")
            .attr("class", "heat-cell")
            .attr("x", (d, i) => (i % numCols) * cellWidth + cellPadding / 2)
            .attr("y", (d, i) => Math.floor(i / numCols) * cellHeight + cellPadding / 2)
            .attr("width",  cellWidth - cellPadding)
            .attr("height", cellHeight - cellPadding)
            .attr("rx", 3)
            .attr("fill", d => color(d.gameScore || 0))
            .style("cursor", "pointer")
            .style("opacity", 0)
            .on("mousemove", (event, d) => this._showTooltip(event,
                `<strong>vs ${d.opponent}</strong> (${d.homeAway})<br>
                 ${d.parsedDate ? this.formatDate(d.parsedDate) : d.gameDate}<br>
                 Points: ${d.points} &nbsp; <br> Goals: ${d.goals}<br>
                 GameScore: ${(d.gameScore||0).toFixed(2)}`))
            .on("mouseout", () => this.tooltip.style("opacity", 0))
            .transition().duration(350).delay((d, i) => i * 7)
            .style("opacity", 1);
 
        this._addColorLegend(chartWidth, chartHeight, gameScoreExtent[0], gameScoreExtent[1], "Low", "High", "GameScore");
    }

    // step 1: Top 8 games horizontal stacked bar 
    _drawTopGames(games, chartWidth, chartHeight) {
        const topGames = this.stats.topGames;
        const innerMargin = { l: 130, r: 60, t: 10, b: 35 };
        const innerWidth = chartWidth - innerMargin.l - innerMargin.r;
        const innerHeight = chartHeight - innerMargin.t - innerMargin.b;
 
        const xScale = d3.scaleLinear()
            .domain([0, d3.max(topGames, d => d.points || 0) * 1.1])
            .range([0, innerWidth]);
        const yScale = d3.scaleBand()
            .domain(d3.range(topGames.length))
            .range([0, innerHeight]).padding(0.28);
 
        const chartGroup = this.dotG.append("g")
            .attr("transform", `translate(${innerMargin.l},${innerMargin.t})`);
 
        chartGroup.selectAll(".tgrid")
            .data(xScale.ticks(5))
            .join("line")
            .attr("x1", d => xScale(d)).attr("x2", d => xScale(d))
            .attr("y1", 0).attr("y2", innerHeight)
            .attr("stroke", "#223344").attr("stroke-dasharray", "3,3");
 
        // goals segment (gold)
        chartGroup.selectAll(".bg")
            .data(topGames)
            .join("rect")
            .attr("class", "bg")
            .attr("x", 0).attr("y", (d, i) => yScale(i))
            .attr("height", yScale.bandwidth()).attr("width", 0)
            .attr("fill", "#fcbc19").attr("rx", 2)
            .transition().duration(480).delay((d, i) => i * 55)
            .attr("width", d => xScale(d.goals || 0));
 
        // assists segment (dark gold), starting where goals end
        chartGroup.selectAll(".ba")
            .data(topGames)
            .join("rect")
            .attr("class", "ba")
            .attr("x", d => xScale(d.goals || 0)).attr("y", (d, i) => yScale(i))
            .attr("height", yScale.bandwidth()).attr("width", 0)
            .attr("fill", "#7a6020").attr("rx", 2)
            .transition().duration(480).delay((d, i) => i * 55)
            .attr("width", d => xScale((d.primaryAssists||0) + (d.secondaryAssists||0)));
 
        chartGroup.selectAll(".blbl")
            .data(topGames)
            .join("text")
            .attr("class", "blbl")
            .attr("x", -6).attr("y", (d, i) => yScale(i) + yScale.bandwidth() / 2)
            .attr("dy", "0.35em").attr("text-anchor", "end")
            .style("font-size", "11px").style("fill", "#bbb")
            .text(d => `vs ${d.opponent}${d.parsedDate ? "  " + this.formatDate(d.parsedDate).replace(/,.*/, "") : ""}`);
 
        chartGroup.selectAll(".bval")
            .data(topGames)
            .join("text")
            .attr("class", "bval")
            .attr("x", d => xScale(d.points || 0) + 6)
            .attr("y", (d, i) => yScale(i) + yScale.bandwidth() / 2)
            .attr("dy", "0.35em")
            .style("font-size", "11px")
            .style("fill", "#fcbc19")
            .style("font-weight", "600")
            .style("opacity", 0).text(d => `${d.points}pts`)
            .transition().delay((d, i) => i * 55 + 400).style("opacity", 1);
 
        this.xAxisG.style("opacity", 1)
            .attr("transform", `translate(${innerMargin.l},${innerHeight + innerMargin.t})`)
            .call(d3.axisBottom(xScale).ticks(5));
 
        const legendGroup = this.annotationG.append("g")
                .attr("transform", `translate(${innerMargin.l},${chartHeight + 5})`);

        [["Goals", "#fcbc19"], ["Assists", "#7a6020"]].forEach(([label, color], i) => {
            legendGroup.append("rect")
                    .attr("x", i * 80)
                    .attr("width", 12)
                    .attr("height", 12)
                    .attr("fill", color)
                    .attr("rx", 2);
            legendGroup.append("text")
                    .attr("x", i * 80 + 16)
                    .attr("y", 10)
                    .style("fill", "#aaa")
                    .style("font-size", "10px")
                    .text(label);
        });
    }

    // step 2: Danger zone grouped bars
    _drawDanger(games, chartWidth, chartHeight) {
        const stats = this.stats;
        const zones = [
            { label: "Low", actual: stats.lowDG, expected: stats.lowXG  },
            { label: "Medium", actual: stats.medDG, expected: stats.medXG  },
            { label: "High", actual: stats.highDG, expected: stats.highXG },
        ];
 
        const innerMargin  = { l: 52, r: 20, t: 20, b: 50 };
        const innerWidth  = chartWidth - innerMargin.l - innerMargin.r;
        const innerHeight  = chartHeight - innerMargin.t - innerMargin.b;
 
        const xScale = d3.scaleBand().domain(zones.map(d => d.label)).range([0, innerWidth]).padding(0.32);

        // positions the two bars (actual vs expected) within each zone band
        const groupScale = d3.scaleBand().domain(["actual", "expected"]).range([0, xScale.bandwidth()]).padding(0.1);
        const maxValue = d3.max(zones, d => Math.max(d.actual, d.expected)) * 1.25 || 1;
        const yScale = d3.scaleLinear().domain([0, maxValue]).range([innerHeight, 0]).nice();
 
        const chartGroup = this.dotG.append("g").attr("transform", `translate(${innerMargin.l},${innerMargin.t})`);
 
        chartGroup.selectAll(".dgrid")
            .data(yScale.ticks(5))
            .join("line")
            .attr("x1", 0)
            .attr("x2", innerWidth)
            .attr("y1", d => yScale(d))
            .attr("y2", d => yScale(d))
            .attr("stroke", "#223344").attr("stroke-dasharray", "3,3");
 
        const colorMap = { actual: "#fcbc19", expected: "#3a6a9a" };
 
        zones.forEach((zone, zoneIndex) => {
            ["actual", "expected"].forEach(type => {
                const val = zone[type];
                chartGroup.append("rect")
                    .attr("x", xScale(zone.label) + groupScale(type))
                    .attr("y", innerHeight).attr("width", groupScale.bandwidth())
                    .attr("height", 0)
                    .attr("fill", colorMap[type])
                    .attr("fill-opacity", type === "expected" ? 0.55 : 1)
                    .attr("rx", 2)
                    .transition().duration(500).delay(zoneIndex * 120)
                    .attr("y", yScale(val)).attr("height", innerHeight - yScale(val));
 
                chartGroup.append("text")
                    .attr("x", xScale(zone.label) + groupScale(type) + groupScale.bandwidth() / 2)
                    .attr("y", yScale(val) - 5)
                    .attr("text-anchor", "middle")
                    .style("font-size", "10px")
                    .style("fill", "#ccc")
                    .style("opacity", 0)
                    .text(val.toFixed(1))
                    .transition().delay(zoneIndex * 120 + 400)
                    .style("opacity", 1);
            });
        });
 
        this.xAxisG.style("opacity", 1)
            .attr("transform", `translate(${innerMargin.l},${innerHeight + innerMargin.t})`)
            .call(d3.axisBottom(xScale)
            .tickSize(0));
        this.yAxisG.style("opacity", 1)
            .attr("transform", `translate(${innerMargin.l},${innerMargin.t})`)
            .call(d3.axisLeft(yScale)
            .ticks(5));
 
        this.annotationG.append("text")
            .attr("x", innerMargin.l + innerWidth / 2)
            .attr("y", chartHeight + 14)
            .attr("text-anchor", "middle")
            .style("fill", "#888")
            .style("font-size", "11px")
            .text("Shot Danger Zone");
 
        const legendGroup = this.annotationG.append("g")
                .attr("transform", `translate(${innerMargin.l},${chartHeight + 2})`);
 
        [["Actual Goals", "#fcbc19"], ["Expected (xG)", "#3a6a9a"]].forEach(([label, color], i) => {
            legendGroup.append("rect")
                .attr("x", i * 120)
                .attr("width", 12)
                .attr("height", 12)
                .attr("fill", color)
                .attr("rx", 2);
            legendGroup.append("text")
                .attr("x", i * 120 + 16)
                .attr("y", 10)
                .style("fill", "#aaa")
                .style("font-size", "10px")
                .text(label);
        });
    }
 

    // step 3: Home vs Away grouped bars
    _drawHomeAway(games, chartWidth, chartHeight) {
        const stats = this.stats;
        const metrics = [
            { key: "pts", label: "Points/G", home: stats.homePPG, away: stats.awayPPG  },
            { key: "g", label: "Goals/G", home: stats.homeGPG, away: stats.awayGPG  },
            { key: "a", label: "Assists/G", home: stats.homeAPG, away: stats.awayAPG  },
            { key: "xg", label: "xGoals/G", home: stats.homeXGPG, away: stats.awayXGPG },
            { key: "gs", label: "GameScore/G", home: stats.homeGsPG, away: stats.awayGsPG },
        ];
 
        const innerMargin  = { l: 52, r: 20, t: 20, b: 50 };
        const innerWidth  = chartWidth - innerMargin.l - innerMargin.r;
        const innerHeight  = chartHeight - innerMargin.t - innerMargin.b;
 
        const xScale = d3.scaleBand()
            .domain(metrics.map(d => d.key))
            .range([0, innerWidth])
            .padding(0.3);
        // groupScale positions the home and away bars side-by-side within each metric band
        const groupScale = d3.scaleBand()
            .domain(["home", "away"])
            .range([0, xScale.bandwidth()])
            .padding(0.1);
        const maxValue = d3.max(metrics, d => Math.max(d.home, d.away)) * 1.25 || 1;
        const yScale = d3.scaleLinear()
            .domain([0, maxValue])
            .range([innerHeight, 0])
            .nice();
 
        const chartGroup = this.dotG.append("g")
            .attr("transform", `translate(${innerMargin.l},${innerMargin.t})`);
 
        chartGroup.selectAll(".hagrid")
            .data(yScale.ticks(5))
            .join("line")
            .attr("x1", 0)
            .attr("x2", innerWidth)
            .attr("y1", d => yScale(d))
            .attr("y2", d => yScale(d))
            .attr("stroke", "#223344")
            .attr("stroke-dasharray", "3,3");
 
        const colorMap = { home: "#fcbc19", away: "#3a6a9a" };
 
        metrics.forEach((metric, metricIndex) => {
            ["home", "away"].forEach(venue => {
                const val = metric[venue];
                chartGroup.append("rect")
                    .attr("x", xScale(metric.key) + groupScale(venue))
                    .attr("y", innerHeight)
                    .attr("width", groupScale.bandwidth())
                    .attr("height", 0)
                    .attr("fill", colorMap[venue])
                    .attr("rx", 2)
                    .transition().duration(500).delay(metricIndex * 80)
                    .attr("y", yScale(val))
                    .attr("height", innerHeight - yScale(val));
 
                chartGroup.append("text")
                    .attr("x", xScale(metric.key) + groupScale(venue) + groupScale.bandwidth() / 2)
                    .attr("y", yScale(val) - 5)
                    .attr("text-anchor", "middle")
                    .style("font-size", "9px")
                    .style("fill", "#ccc")
                    .style("opacity", 0)
                    .text(val.toFixed(2))
                    .transition().delay(metricIndex * 80 + 400)
                    .style("opacity", 1);
            });
        });
 
        this.xAxisG.style("opacity", 1)
            .attr("transform", `translate(${innerMargin.l},${innerHeight + innerMargin.t})`)
            .call(d3.axisBottom(xScale)
            .tickFormat(k => metrics.find(m => m.key === k)?.label || k)
            .tickSize(0));
        this.yAxisG.style("opacity", 1)
            .attr("transform", `translate(${innerMargin.l},${innerMargin.t})`)
            .call(d3.axisLeft(yScale)
            .ticks(5));
 
        const legendGroup = this.annotationG.append("g")
            .attr("transform", `translate(${innerMargin.l},${chartHeight + 2})`);
 
        [["Home", "#fcbc19", stats.homeGames.length], ["Away", "#3a6a9a", stats.awayGames.length]].forEach(([label, color, gameCount], i) => {
            legendGroup.append("circle")
            .attr("cx", i * 90 + 5)
            .attr("cy", 6)
            .attr("r", 5)
            .attr("fill", color);
 
            legendGroup.append("text")
            .attr("x", i * 90 + 13)
            .attr("y", 10)
            .style("fill", "#aaa")
            .style("font-size", "10px")
            .text(`${label} (${gameCount}G)`);
        });
    }

    // step 4: Hot streak grid ───────────────────────────────────────────────────
    _drawStreak(games, chartWidth, chartHeight) {
        const stats = this.stats;
        const numCols = Math.ceil(Math.sqrt(games.length * (chartWidth / (chartHeight * 0.85))));
        const cellWidth = chartWidth / numCols;
        const cellHeight = (chartHeight * 0.85) / Math.ceil(games.length / numCols);
        const cellPadding = 2.5;
        const offsetY = 18;  // vertical offset to leave room for the streak label above the grid
 
        const gameScoreExtent = d3.extent(games, d => d.gameScore || 0);
        const color = d3.scaleSequential()
            .domain(gameScoreExtent)
            .interpolator(t => d3.interpolateRgb("#1a2a3a", "#fcbc19")(t));
 
        const chartGroup = this.dotG.append("g")
            .attr("transform", `translate(0,${offsetY})`);
 
        // draw gold border outline around every cell in the longest hot-streak run
        if (stats.streakLen > 0) {
            for (let streakOffset = 0; streakOffset < stats.streakLen; streakOffset++) {
                const cellIndex = stats.streakStart + streakOffset;
                chartGroup.append("rect")
                    .attr("x", (cellIndex % numCols) * cellWidth)
                    .attr("y", Math.floor(cellIndex / numCols) * cellHeight)
                    .attr("width", cellWidth)
                    .attr("height", cellHeight)
                    .attr("fill", "none")
                    .attr("stroke", "#fcbc19")
                    .attr("stroke-width", 2.5)
                    .attr("rx", 3)
                    .style("opacity", 0)
                    .transition().delay(games.length * 6 + 100)
                    .style("opacity", 1);
            }
 
            const streakMidCol = (stats.streakStart % numCols) +
                Math.min(stats.streakLen - 1, numCols - (stats.streakStart % numCols) - 1) * 0.5;
            chartGroup.append("text")
                .attr("x", (streakMidCol + 0.5) * cellWidth)
                .attr("y", Math.floor(stats.streakStart / numCols) * cellHeight - 6)
                .attr("text-anchor", "middle")
                .style("font-size", "10px")
                .style("fill", "#fcbc19")
                .style("font-weight", "600")
                .text(`${stats.streakLen}-game hot streak`)
                .style("opacity", 0)
                .transition().delay(games.length * 6 + 150)
                .style("opacity", 1);
        }
 
        chartGroup.selectAll(".streak-cell")
            .data(games)
            .join("rect")
            .attr("class", "streak-cell")
            .attr("x", (d, i) => (i % numCols) * cellWidth + cellPadding / 2)
            .attr("y", (d, i) => Math.floor(i / numCols) * cellHeight + cellPadding / 2)
            .attr("width", cellWidth - cellPadding)
            .attr("height", cellHeight - cellPadding)
            .attr("rx", 3).attr("fill", d => color(d.gameScore || 0))
            .style("cursor", "pointer")
            .style("opacity", 0)
            .on("mousemove", (event, d) => this._showTooltip(event,
                `<strong>vs ${d.opponent}</strong> (${d.homeAway})<br>
                 ${d.parsedDate ? this.formatDate(d.parsedDate) : d.gameDate}<br>
                 GameScore: ${(d.gameScore||0).toFixed(2)} &nbsp; Points: ${d.points}`))
            .on("mouseout", () => this.tooltip.style("opacity", 0))
            .transition().duration(300).delay((d, i) => i * 6)
            .style("opacity", 1);
 
        this._addColorLegend(chartWidth, chartHeight, gameScoreExtent[0], gameScoreExtent[1], "Quiet game", "Strong game", "GameScore");
    }

    _showTooltip(event, html) {
        this.tooltip.style("opacity", 1)
            .html(html)
            .style("left", `${event.pageX + 14}px`)
            .style("top",  `${event.pageY - 18}px`);
    }

    // render a horizontal gradient bar with low/high labels into the bottom-right corner
    _addColorLegend(chartWidth, chartHeight, minLabel, maxLabel, title) {
        const legendWidth = Math.min(180, chartWidth * 0.38);
        const legendGroup = this.annotationG.append("g")
            .attr("transform", `translate(${chartWidth - legendWidth - 4},${chartHeight - 22})`);
 
        // unique id so multiple gradients on the same SVG don't collide
        const gradientId = "cg-" + Math.random().toString(36).slice(2, 7);
        const defs = this.svg.select("defs").empty()
            ? this.svg.append("defs") : this.svg.select("defs");
        defs.selectAll(`#${gradientId}`).remove();
        const gradient = defs.append("linearGradient")
                .attr("id", gradientId);
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", "#1a2a3a");
 
        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", "#fcbc19");
 
        legendGroup.append("rect")
            .attr("width", legendWidth)
            .attr("height", 7)
            .attr("rx", 2)
            .attr("fill", `url(#${gradientId})`);
 
        legendGroup.append("text")
            .attr("y", 17)
            .style("font-size", "9px")
            .style("fill", "#555")
            .text(minLabel);
 
        legendGroup.append("text")
            .attr("x", legendWidth)
            .attr("y", 17)
            .attr("text-anchor", "end")
            .style("font-size", "9px")
            .style("fill", "#aaa")
            .text(maxLabel);
            
        if (title) {
            legendGroup.append("text")
            .attr("x", legendWidth / 2)
            .attr("y", -4)
            .attr("text-anchor", "middle")
            .style("font-size", "9px")
            .style("fill", "#555")
            .text(title);
        }
    }
}