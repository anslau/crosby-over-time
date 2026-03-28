class CareerChart {

    constructor(parentElement, data, annotations, gameData) {
        this.parentElement  = parentElement;
        this.data           = data;
        this.annotations    = annotations;
        this.gameData       = gameData;
        this.displayData    = [];
        this._shouldAnimate = true;
        this._pendingTimers = [];
        this._brushSelection = null;
        this.initVis();
    }

    initVis() {
        let vis = this;

        vis.ANIM_DURATION = 3000;

        vis.margin = { top: 40, right: 40, bottom: 42, left: 56 };
        vis.brushMargin = { top: 14, right: 40, bottom: 46, left: 56 };
        vis.width = document.getElementById(vis.parentElement)
                    .getBoundingClientRect().width - vis.margin.left - vis.margin.right;
        vis.height = 500 - vis.margin.top  - vis.margin.bottom;
        vis.brushHeight = 165 - vis.brushMargin.top - vis.brushMargin.bottom;

        // init the drawing area
        vis.svg = d3.select("#" + vis.parentElement).append("svg")
            .attr("class", "context-svg")
            .attr("width",  vis.width  + vis.margin.left + vis.margin.right)
            .attr("height", vis.height + vis.margin.top  + vis.margin.bottom)
            .append("g")
            .attr("transform", `translate(${vis.margin.left},${vis.margin.top})`);

        // init the area for the brushed panel 
        vis.brushPanel = d3.select("#" + vis.parentElement).append("div")
            .attr("class", "brush-panel");

        vis.brushPanel.append("div").attr("class", "brush-label").text("Monthly breakdown");

        vis.brushSvg = vis.brushPanel.append("svg")
            .attr("width",  vis.width  + vis.brushMargin.left + vis.brushMargin.right)
            .attr("height", vis.brushHeight + vis.brushMargin.top + vis.brushMargin.bottom)
            .append("g")
            .attr("transform", `translate(${vis.brushMargin.left},${vis.brushMargin.top})`);

        vis.brushSvg.append("defs").append("clipPath")
            .attr("id", "brush-clip")
            .append("rect")
            .attr("width", vis.width)
            .attr("height", vis.brushHeight + 10);

        // scales
        vis.x = d3.scalePoint()
            .range([0, vis.width])
            .padding(0.3);

        vis.y = d3.scaleLinear()
            .range([vis.height, 0]);

        vis.xBrush = d3.scaleTime()
                .range([0, vis.width]);   // time scale for months
        vis.yBrush = d3.scaleLinear()
                .range([vis.brushHeight, 0]);

        // axes
        vis.xAxis = d3.axisBottom(vis.x)
                .tickFormat(d => `'${String(d).slice(2)}`);
        vis.yAxis = d3.axisLeft(vis.y)
                .ticks(5);

        vis.svg.append("g")
            .attr("class", "x-axis axis")
            .attr("transform", `translate(0,${vis.height})`);
        vis.svg.append("g")
            .attr("class", "y-axis axis");

        vis.yLabel = vis.svg.append("text")
            .attr("class", "axis-label")
            .attr("transform", "rotate(-90)")
            .attr("x", -vis.height / 2).attr("y", -44)
            .attr("text-anchor", "middle");

        // brushed chart axes
        vis.xAxisBrush = d3.axisBottom(vis.xBrush)
            .tickFormat(d3.timeFormat("%b '%y"))
            .ticks(d3.timeMonth.every(2));

        vis.yAxisBrush = d3.axisLeft(vis.yBrush)
                    .ticks(5);

        vis.brushSvg.append("g")
            .attr("class", "x-axis-brush axis")
            .attr("transform", `translate(0,${vis.brushHeight})`);

        vis.brushSvg.append("g")
            .attr("class", "y-axis-brush axis");

        vis.yLabelBrush = vis.brushSvg.append("text")
            .attr("class", "axis-label")
            .attr("transform", "rotate(-90)")
            .attr("x", -vis.brushHeight / 2).attr("y", -44)
            .attr("text-anchor", "middle");

        // line path for the main chart
        vis.line = d3.line()
            .x(d => vis.x(d.season))
            .y(d => vis.y(d.value))
            .curve(d3.curveMonotoneX);

        vis.linePath = vis.svg.append("path")
            .attr("class", "career-line")
            .attr("fill", "none")
            .attr("stroke", "#fcbc19")
            .attr("stroke-width", 2.5);

        // brushed component path
        vis.lineBrush = d3.line()
            .x(d => vis.xBrush(d.month))
            .y(d => vis.yBrush(d.value))
            .curve(d3.curveMonotoneX);

        vis.areaBrush = d3.area()
            .x(d => vis.xBrush(d.month))
            .y0(vis.brushHeight)
            .y1(d => vis.yBrush(d.value))
            .curve(d3.curveMonotoneX);

        vis.brushAreaPath = vis.brushSvg.append("path")
            .attr("class", "brush-area")
            .attr("clip-path", "url(#brush-clip)")
            .attr("fill", "#fcbc19").attr("fill-opacity", 0.08);

        vis.brushLinePath = vis.brushSvg.append("path")
            .attr("class", "career-line brush-line")
            .attr("clip-path", "url(#brush-clip)")
            .attr("fill", "none")
            .attr("stroke", "#fcbc19")
            .attr("stroke-width", 2.5);

        // annotations for the chart
        vis.annotationGroup = vis.svg.append("g").attr("class", "annotations");


        // init the brush component
        vis.brush = d3.brushX()
            .extent([[0, 0], [vis.width, vis.height]])
            .on("brush", (event) => vis._onBrush(event))
            .on("end", (event) => vis._onBrush(event));

        vis.brushGroup = vis.svg.append("g")
            .attr("class", "brush")
            .call(vis.brush);

        vis.dotGroup = vis.svg.append("g")
            .attr("class", "dots")
            .attr("pointer-events", "all"); 

        vis.brushDotGroup = vis.brushSvg.append("g")
                        .attr("class", "brush-dots");

        // dividers per season for the brushed component
        vis.brushDividerGroup = vis.brushSvg.append("g")
                            .attr("class", "brush-dividers");

        // adding a prompt under the chart to make brushing capability more clear
        vis.brushPrompt = vis.svg.append("text")
            .attr("class", "brush-prompt")
            .attr("x", vis.width / 2)
            .attr("y", vis.height + 38)
            .attr("text-anchor", "middle")
            .style("font-size", "14px")
            .style("fill", "#666")
            .text("Drag to zoom into a range of seasons");

        vis.tooltip = d3.select("body").append("div")
            .attr("class", "tooltip-box")
            .style("opacity", 0);


        
        vis.wrangleData();
    }

    wrangleData() {
        let vis = this;

        // metrics to filter by.
        // only goals and xGoals have situation-split fields in the dataset;
        // points, assists, and avgGameScore have no 5v5/PP breakdown so they always
        // use the all-situation field — main.js blocks those combos in the UI,
        // but the fallback here prevents silently showing the wrong data
        const metricMap = {
            all: { 
                   points:"points",
                   goals:"goals",   
                   assists:"assists",
                   xGoals:"xGoals",   
                   avgGameScore:"avgGameScore" 
                },
            "5v5": { 
                    goals:"goals5v5",
                    xGoals:"xGoals5v5",
                    points:"points",            // no 5v5 split — fall back to all-sit
                    assists:"assists",          // no 5v5 split — fall back to all-sit
                    avgGameScore:"avgGameScore" // no 5v5 split — fall back to all-sit
                },
            pp: {
                    goals:"goalsPP",
                    xGoals:"xGoalsPP",
                    points:"points",            // no PP split — fall back to all-sit
                    assists:"assists",          // no PP split — fall back to all-sit
                    avgGameScore:"avgGameScore" // no PP split — fall back to all-sit
                },
        };

        const field = (metricMap[selectedSit] || metricMap.all)[selectedMetric] || selectedMetric;
        const canCumulate = selectedMetric !== "avgGameScore";

        let running = 0;
        vis.displayData = vis.data.map(d => {
            const perSeason = d[field];
            if (isCumulative && canCumulate) {
                running += perSeason;
            }
                
            return {
                season: d.season,
                seasonLabel: d.seasonLabel,
                gp: d.gp,
                value: (isCumulative && canCumulate) ? running : perSeason,
                rawGoals: d.goals,
                rawPoints: d.points,
                rawAssists: d.assists,
                xGoals: d.xGoals,
                avgGs: d.avgGameScore,
            };
        });

        vis.currentField = field;
        vis.isCumulativeActive = isCumulative && canCumulate;
        vis._shouldAnimate = true;

        vis.updateVis();
    }

    updateVis() {
        let vis = this;

        vis.x.domain(vis.displayData.map(d => d.season));
        vis.y.domain([0, d3.max(vis.displayData, d => d.value) * 1.15]).nice();

        const labelMap = {
            points:"Points", 
            goals:"Goals", 
            assists:"Assists",
            xGoals:"xGoals", 
            avgGameScore:"Avg GameScore",
            goals5v5:"Goals (5v5)", 
            xGoals5v5:"xGoals (5v5)",
            goalsPP:"Goals (PP)",   
            xGoalsPP:"xGoals (PP)",
        };

        // get the label for the current metric and adjust if cumulative
        const baseLabel = labelMap[vis.currentField] || vis.currentField;
        const fullLabel = vis.isCumulativeActive ? `Cumulative ${baseLabel}` : baseLabel;
        vis.yLabel.text(fullLabel);
        vis.yLabelBrush.text(fullLabel + " / month");

        vis.svg.select(".x-axis")
            .transition().
            duration(500)
            .call(vis.xAxis)
            .selectAll("text")
            .attr("dy", "1.2em");

        vis.svg.select(".y-axis")
            .transition()
            .duration(500)
            .call(vis.yAxis);

        // canceling and rebuilding the line 
        vis._cancelTimers();
        vis.linePath.interrupt();
        vis.linePath.datum(vis.displayData)
            .attr("d", vis.line)
            .attr("stroke-dasharray", null)
            .attr("stroke-dashoffset", null);

        vis._buildAnnotations();
        vis._buildDots();

        // reset the brush — hide the panel via class (not display) to avoid layout shift
        vis.brushGroup.call(vis.brush.move, null);
        vis._brushSelection = null;
        vis.brushPanel.classed("active", false);

        requestAnimationFrame(() => vis.playAnimation());
    }

    // brush handler
    _onBrush(event) {
        let vis = this;
        const sel = event.selection;

        // first check if no selection exists, then reset the brush state
        if (!sel) {
            vis._brushSelection = null;
            vis.brushPanel.classed("active", false);
            vis.brushPrompt.text("↔ Drag to zoom into a range of seasons");
            return;
        }

        // otherwise find the seasons whose x-position falls inside the brush
        // and update the brushed seasons
        vis._brushSelection = sel;
        const [x0, x1] = sel;
        const brushedSeasons = vis.displayData
            .filter(d => vis.x(d.season) >= x0 - 1 && vis.x(d.season) <= x1 + 1)
            .map(d => d.season);

        if (brushedSeasons.length < 1) return; // no seasons selected

        vis.brushPrompt.text(
            brushedSeasons.length === 1
                ? `${brushedSeasons[0]}-${String(brushedSeasons[0]+1).slice(2)}`
                : `${brushedSeasons[0]}-${String(brushedSeasons[0]+1).slice(2)} → ` +
                  `${brushedSeasons[brushedSeasons.length-1]}-${String(brushedSeasons[brushedSeasons.length-1]+1).slice(2)}`
        );

        vis._updateBrushPanel(brushedSeasons);
    }

    _updateBrushPanel(brushedSeasons) {
        let vis = this;

        const seasonSet = new Set(brushedSeasons);
        const gameFieldMap = {
            points: g => g.points,
            goals: g => g.goals,
            assists: g => g.primaryAssists + g.secondaryAssists,
            xGoals: g => g.xGoals,
            avgGameScore: g => g.gameScore,
            goals5v5: g => g.goals5v5,
            xGoals5v5: g => g.xGoals5v5,
            goalsPP: g => g.goalsPP,
            xGoalsPP: g => g.xGoalsPP,
        };

        const getValue = gameFieldMap[vis.currentField] || (g => g.points);
        const isAvg = vis.currentField === "avgGameScore";

        // filter games to include only brushed seasons
        const games = vis.gameData.filter(g => seasonSet.has(g.season));
        const parseDate = d3.timeParse("%Y%m%d");
        const monthMap  = new Map();   // key: "YYYY-MM", value: {month, sum, count, season}

        games.forEach(g => {
            const dt = parseDate(String(g.gameDate));
            if (!dt) return;
            const key = d3.timeFormat("%Y-%m")(dt);
            const monthD = new Date(dt.getFullYear(), dt.getMonth(), 1);
            if (!monthMap.has(key)) {
                monthMap.set(key, { month: monthD, sum: 0, count: 0, season: g.season });
            }
            const entry = monthMap.get(key);
            entry.sum += getValue(g);
            entry.count += 1;
        });

        // sort by month and compute the avg value
        const monthData = Array.from(monthMap.values())
            .sort((a, b) => a.month - b.month)
            .map(d => ({
                month: d.month,
                value: isAvg ? (d.count > 0 ? d.sum / d.count : 0) : d.sum,
                season: d.season,
            }));

        if (monthData.length < 2) return;

        if (vis.isCumulativeActive) {
            let cum = 0;
            monthData.forEach(d => { 
                cum += d.value; d.value = cum; 
            });
        }

        // reveal the panel via class — height is always reserved so no layout shift
        vis.brushPanel.classed("active", true);

        // scales for the brushed area
        vis.xBrush.domain(d3.extent(monthData, d => d.month));

        const yMin = d3.min(monthData, d => d.value);
        const yMax = d3.max(monthData, d => d.value);
        const padding = (yMax - yMin) * 0.2 || 0.5;
        vis.yBrush.domain([Math.max(0, yMin - padding), yMax + padding]).nice();

        // adjust tick density to number of months
        const nMonths = monthData.length;
        vis.xAxisBrush.ticks(nMonths <= 12 ? d3.timeMonth.every(1) : d3.timeMonth.every(2));

        vis.brushSvg.select(".x-axis-brush")
            .transition().duration(250).call(vis.xAxisBrush)
            .selectAll("text")
            .attr("transform", "rotate(-35)")
            .style("text-anchor", "end")
            .attr("dy", "0.4em").attr("dx", "-0.4em");

        vis.brushSvg.select(".y-axis-brush")
            .transition().duration(250).call(vis.yAxisBrush);

        // the brush area and the line
        vis.brushAreaPath.datum(monthData)
            .transition().duration(300).attr("d", vis.areaBrush);

        vis.brushLinePath.datum(monthData)
            .transition().duration(300).attr("d", vis.lineBrush);

        // divider labels for a new season
        const seasonBoundaries = [];
        let prevSeason = null;
        monthData.forEach(d => {
            if (d.season !== prevSeason && prevSeason !== null) {
                seasonBoundaries.push({ x: vis.xBrush(d.month), season: d.season });
            }
            prevSeason = d.season;
        });

        let dividers = vis.brushDividerGroup.selectAll(".season-divider")
            .data(seasonBoundaries, d => d.season);

        dividers.enter().append("line")
            .attr("class", "season-divider")
            .attr("y1", 0).attr("y2", vis.brushHeight)
            .attr("stroke", "#fcbc19").attr("stroke-opacity", 0.25)
            .attr("stroke-width", 1).attr("stroke-dasharray", "4,3")
            .merge(dividers)
            .attr("x1", d => d.x).attr("x2", d => d.x);
        dividers.exit().remove();

        let divLabels = vis.brushDividerGroup.selectAll(".season-divider-label")
            .data(seasonBoundaries, d => d.season);

        divLabels.enter().append("text")
            .attr("class", "season-divider-label")
            .attr("y", -5)
            .attr("text-anchor", "middle")
            .style("font-size", "9px")
            .style("fill", "#fcbc19").style("opacity", 0.5)
            .merge(divLabels)
            .attr("x", d => d.x)
            .text(d => `'${String(d.season).slice(2)}`);

        divLabels.exit().remove();

        // the monthly overview dots in the brushed panel
        let bDots = vis.brushDotGroup.selectAll(".brush-dot")
            .data(monthData, d => d.month.getTime());

        let bDotsEnter = bDots.enter().append("circle")
            .attr("class", "brush-dot")
            .attr("r", 3.5)
            .style("fill", "#fcbc19")
            .style("stroke", "#0f2744")
            .style("stroke-width", 1.5);

        bDotsEnter.merge(bDots)
            .on("mouseover", (event, d) => {
                vis.tooltip.style("opacity", 1)
                    .html(`
                        <strong>${d3.timeFormat("%B %Y")(d.month)}</strong><br>
                        ${vis.currentField.replace(/([A-Z])/g, " $1").trim()}: 
                        <strong>${d.value % 1 === 0 ? d.value : d.value.toFixed(2)}</strong>
                    `)
                    .style("left", (event.pageX + 12) + "px")
                    .style("top",  (event.pageY - 20) + "px");
            })
            .on("mouseout", () => vis.tooltip.style("opacity", 0))
            .transition().duration(250)
            .attr("cx", d => vis.xBrush(d.month))
            .attr("cy", d => vis.yBrush(d.value));

        bDots.exit().remove();
    }

    // animate the chart drawing whenever the filter updates
    playAnimation() {
        let vis = this;

        vis._cancelTimers();
        vis.dotGroup.selectAll(".season-dot").style("opacity", 0);
        vis.annotationGroup.selectAll(".annot-group").style("opacity", 0);

        const totalLen = vis.linePath.node().getTotalLength();

        // draw the line
        vis.linePath
            .attr("stroke-dasharray", `${totalLen} ${totalLen}`)
            .attr("stroke-dashoffset", totalLen)
            .transition().duration(vis.ANIM_DURATION).ease(d3.easeCubicInOut)
            .attr("stroke-dashoffset", 0)
            .on("end", () => {
                vis.linePath.attr("stroke-dasharray", null).attr("stroke-dashoffset", null);
            });

        // draw the dots
        vis.displayData.forEach(d => {
            const frac  = vis.x(d.season) / vis.width;
            const delay = frac * vis.ANIM_DURATION;

            vis._pendingTimers.push(setTimeout(() => {
                vis.dotGroup.selectAll(".season-dot")
                    .filter(dd => dd.season === d.season)
                    .transition().duration(180).ease(d3.easeBackOut.overshoot(2.5))
                    .style("opacity", 1).attr("r", 8)
                    .transition().duration(120).attr("r", 6);
            }, delay));
        });

        // finally draw in the animations
        vis.annotations.forEach(ann => {
            const xPos = vis.x(ann.season);
            if (xPos == null) return;
            const delay = (xPos / vis.width) * vis.ANIM_DURATION;
            vis._pendingTimers.push(setTimeout(() => {
                vis.annotationGroup.selectAll(".annot-group")
                    .filter(d => d.season === ann.season)
                    .transition().duration(350).style("opacity", 1);
            }, delay));
        });
    }

    // annotations for major events across crosbys career
    _buildAnnotations() {
        let vis = this;

        let annots = vis.annotationGroup.selectAll(".annot-group")
            .data(vis.annotations, d => d.season);

        let enter = annots.enter().append("g")
            .attr("class", "annot-group").style("opacity", 0);

        enter.append("line").attr("class", "annot-line").attr("y1", 0)
            .attr("stroke-width", 1).attr("stroke-dasharray", "4,3");

        enter.append("text").attr("class", "annot-label")
            .attr("text-anchor", "middle").attr("y", -8).style("font-size", "10px");

        let merged = enter.merge(annots);
        merged.attr("transform", d => `translate(${vis.x(d.season)},0)`);
        merged.select(".annot-line").attr("y2", vis.height)
            .attr("stroke", d => d.type === "championship" ? "#fcbc19" : "#666");
        merged.select(".annot-label").text(d => d.label)
            .style("fill", d => d.type === "championship" ? "#fcbc19" : "#888");

        annots.exit().remove();
    }

    // build each season dot
    // on hover show a tooltip info overview
    _buildDots() {
        let vis = this;

        let dots = vis.dotGroup.selectAll(".season-dot")
            .data(vis.displayData, d => d.season);

        let enter = dots.enter().append("circle")
            .attr("class", "season-dot")
            .attr("r", 6)
            .attr("cx", d => vis.x(d.season))
            .attr("cy", d => vis.y(d.value))
            .style("opacity", 0)
            .style("cursor", "pointer");


        enter.merge(dots)
        .on("click", (event, d) => {
            event.stopPropagation();
            vis.dotGroup.selectAll(".season-dot").classed("selected", false);
            d3.select(event.currentTarget).classed("selected", true);
            onSeasonSelected(d.season, d.seasonLabel, d.gp);
        })
        .on("mouseover", (event, d) => {
            vis.tooltip.style("opacity", 1)
                .html(`
                    <strong>${d.seasonLabel}</strong><br>
                    GP: ${d.gp}<br>
                    Goals: ${d.rawGoals} | Assists: ${d.rawAssists}<br>
                    Points: ${d.rawPoints}<br>
                    xGoals: ${d.xGoals.toFixed(1)}<br>
                    Avg GameScore: ${d.avgGs.toFixed(2)}<br>
                    ${vis.isCumulativeActive ? `<em>Cumulative: ${d.value.toFixed(0)}</em>` : ""}
                `)
                .style("left", (event.pageX + 12) + "px")
                .style("top",  (event.pageY - 20) + "px");
        })
        .on("mouseout", () => vis.tooltip.style("opacity", 0))
        .attr("cx", d => vis.x(d.season))
        .attr("cy", d => vis.y(d.value));

        dots.exit().remove();
    }

    // clear the timer for the aniamtion whenever a new filter is selected
    _cancelTimers() {
        this._pendingTimers.forEach(t => clearTimeout(t));
        this._pendingTimers = [];
    }
}