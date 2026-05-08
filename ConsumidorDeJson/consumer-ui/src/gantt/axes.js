// Axis manager centralizes all axis-related DOM and scale logic.
// This keeps gantt-chart-d3.js focused on data/layout and delegates
// axis rendering to a single, reusable place.
export function createAxisManager(d3) {
	var xAxisGroup = null;
	var yAxisGroup = null;
	var axisLine = null;
	var tickFormat = "%H:%M";
	var xTickValues = null;
	var yTickFormatter = null;
	var axisLabelsEnabled = true;
	var axisLinesEnabled = true;
	var showGrid = true;
	var xAxis = d3.svg.axis().orient("bottom");
	var yAxis = d3.svg.axis().orient("left").tickSize(0);
	var lastRowLayout = {};
	var lastTaskTypes = [];

	// Build a formatter function based on the current tickFormat string.
	// We wrap it so the axis can be updated when the format changes.
	function tickFormatter() {
		return function(d) {
			return d3.time.format(tickFormat)(d instanceof Date ? d : new Date(d));
		};
	}

	// Update the tick format string used by the x-axis.
	// This is called whenever the time domain or zoom level changes.
	function setTickFormat(format) {
		tickFormat = format || "%H:%M";
	}

	function setXTickValues(values) {
		xTickValues = Array.isArray(values) && values.length ? values.slice() : null;
	}

	function setYTickFormatter(formatter) {
		yTickFormatter = typeof formatter === "function" ? formatter : null;
	}

	function setAxisLabelsEnabled(enabled) {
		axisLabelsEnabled = enabled !== false;
	}

	function setAxisLinesEnabled(enabled) {
		axisLinesEnabled = enabled !== false;
	}

	// Recompute axis scales based on the current x-scale and row layout.
	// We map task names to the center of each row so ticks stay aligned
	// even when rows have variable heights (expanded vs collapsed).
	function updateScales(params) {
		var xScale = params.xScale;
		var taskTypes = params.taskTypes || [];
		var rowLayout = params.rowLayout || {};
		var chartWidth = Math.max(0, params.width || 0);
		var totalHeight = Math.max(0, params.totalHeight || 0);
		lastRowLayout = rowLayout;
		lastTaskTypes = taskTypes.slice();
		var rowCenters = taskTypes.map(function(t) {
			var row = rowLayout[t];
			return row ? (row.y + row.height / 2) : 0;
		});

		var yScale = d3.scale.ordinal()
			.domain(taskTypes)
			.range(rowCenters);
		var showGridLines = showGrid && axisLinesEnabled;
		var xTickSize = showGridLines ? -totalHeight : (axisLinesEnabled ? 8 : 0);
		var yTickSize = showGridLines ? -chartWidth : 0;

		xAxis
			.scale(xScale)
			.tickFormat(axisLabelsEnabled ? tickFormatter() : function() { return ""; })
			.tickSubdivide(true)
			.tickSize(xTickSize)
			.tickPadding(8);
		xAxis.tickValues(xTickValues ? xTickValues : null);

		yAxis
			.scale(yScale)
			.orient("left")
			.tickSize(yTickSize);
	}

	// Ensure the axis line and axis groups exist on the chart.
	// These are created once and then reused across redraws.
	function ensureAxisGroups(svg) {
		if (!axisLine || axisLine.empty()) {
			axisLine = svg.append("line")
				.attr("class", "y-axis-line")
				.attr("x1", 0)
				.attr("x2", 0)
				.attr("y1", 0)
				.attr("y2", 0)
				.attr("stroke", "black")
				.attr("stroke-width", 1);
		}
		if (!xAxisGroup || xAxisGroup.empty()) {
			xAxisGroup = svg.append("g")
				.attr("class", "x axis")
				.attr("aria-hidden", "true");
		}
		if (!yAxisGroup || yAxisGroup.empty()) {
			yAxisGroup = svg.append("g").attr("class", "y axis");
		}
	}

	// Update the vertical axis line height to match the chart.
	// We use the same transition helper as the rest of the chart for smooth updates.
	function updateAxisLine(totalHeight, maybeTransition) {
		if (!axisLine) return;
		var transition = maybeTransition || function(selection) { return selection; };
		transition(axisLine)
			.attr("y1", 0)
			.attr("y2", totalHeight);
		axisLine.style("display", axisLinesEnabled ? null : "none");
	}

	// Render x and y axes with the latest scales.
	// The x-axis is translated to the bottom of the chart, and the y-axis
	// is updated in place. We also extend the y-axis domain path to match height.
	function updateAxes(totalHeight, maybeTransition) {
		if (!xAxisGroup || !yAxisGroup) return;
		var transition = maybeTransition || function(selection) { return selection; };
		var xSel = transition(xAxisGroup);
		var ySel = transition(yAxisGroup);
		var showGridLines = showGrid && axisLinesEnabled;

		xSel.call(xAxis)
			.attr("transform", "translate(0," + totalHeight + ")");

		var transform = xAxisGroup.attr("transform") || "";
		var match = /translate\(\s*[-\d.]+\s*,\s*([-\d.]+)\s*\)/.exec(transform);
		var axisY = match ? parseFloat(match[1]) : totalHeight;
		var isTop = isFinite(axisY) ? axisY <= (totalHeight / 2) : false;

		ySel.call(yAxis);
		yAxisGroup.selectAll(".tick text")
			.text(function(d) {
				if (!axisLabelsEnabled) return "";
				var raw = d == null ? "" : String(d);
				return yTickFormatter ? yTickFormatter(raw, d) : raw;
			});

		xAxisGroup.classed("has-grid", showGridLines);
		yAxisGroup.classed("has-grid", showGridLines);
		xAxisGroup.selectAll(".tick line")
			.classed("chart-grid-line-x", showGridLines)
			.style("display", axisLinesEnabled ? null : "none");
		yAxisGroup.selectAll(".tick line")
			.classed("chart-grid-line-y", showGridLines)
			.style("display", axisLinesEnabled ? null : "none")
			.attr("transform", function(d) {
				// Place horizontal grid lines in the middle of the gap between rows.
				// If X-axis is at the bottom, use the gap above each row.
				// If X-axis is at the top, use the gap below each row.
				var raw = d == null ? "" : String(d);
				var row = lastRowLayout && raw ? lastRowLayout[raw] : null;
				if (!row || !isFinite(row.height)) {
					return "translate(0,0)";
				}
				var half = row.height / 2;
				var rowIndex = lastTaskTypes.indexOf(raw);
				var offset = isTop ? half : -half;
				if (rowIndex >= 0) {
					if (isTop) {
						var nextName = lastTaskTypes[rowIndex + 1];
						var nextRow = nextName ? lastRowLayout[nextName] : null;
						var gapBelow = nextRow ? Math.max(0, nextRow.y - (row.y + row.height)) : 0;
						offset = half + (gapBelow / 2);
					} else {
						var prevName = lastTaskTypes[rowIndex - 1];
						var prevRow = prevName ? lastRowLayout[prevName] : null;
						var gapAbove = prevRow ? Math.max(0, row.y - (prevRow.y + prevRow.height)) : 0;
						offset = -(half + (gapAbove / 2));
					}
				}
				return "translate(0," + offset + ")";
			});
		// Minor ticks in d3 can be emitted as <line class="tick minor">.
		// Keep them hidden so only major grid lines are drawn.
		xAxisGroup.selectAll("line.tick.minor, line.minor, .minor line")
			.style("display", "none");
		yAxisGroup.selectAll("line.tick.minor, line.minor, .minor line")
			.style("display", "none");

		// Keep X-grid direction opposite to X-axis position:
		// - axis at top  -> lines go down (+)
		// - axis at bottom -> lines go up (-)
		if (showGridLines) {
			var gridY2 = isTop ? totalHeight : -totalHeight;
			xAxisGroup.selectAll(".tick line.chart-grid-line-x")
				.attr("y2", gridY2);
		}

		xAxisGroup.select("path.domain")
			.style("display", axisLinesEnabled ? null : "none");

		yAxisGroup.select("path.domain")
			.attr("d", "M0,0V" + totalHeight)
			.style("display", axisLinesEnabled ? null : "none");
	}

	function moveSelectionToBack(selection) {
		if (!selection || typeof selection.node !== "function") {
			return;
		}
		var node = selection.node();
		if (!node || !node.parentNode) {
			return;
		}
		node.parentNode.insertBefore(node, node.parentNode.firstChild);
	}

	function moveSelectionToFront(selection) {
		if (!selection || typeof selection.node !== "function") {
			return;
		}
		var node = selection.node();
		if (!node || !node.parentNode) {
			return;
		}
		node.parentNode.appendChild(node);
	}

	// Keep axis/grid in front of bars so grid lines remain visible.
	function bringToFront() {
		moveSelectionToFront(axisLine);
		moveSelectionToFront(xAxisGroup);
		moveSelectionToFront(yAxisGroup);
	}

	// Legacy helper kept for compatibility.
	function sendToBack() {
		moveSelectionToBack(yAxisGroup);
		moveSelectionToBack(xAxisGroup);
		moveSelectionToBack(axisLine);
	}

	// Build the x-scale used by the chart (time -> pixel).
	// This lives here so the axis module owns scale construction and the chart
	// just provides the current time domain + focus settings.
	function buildXScale(params) {
		var timeDomainStart = params.timeDomainStart;
		var timeDomainEnd = params.timeDomainEnd;
		var width = params.width;
		var focusTask = params.focusTask;
		var xAxisDistortion = !!params.xAxisDistortion;
		var focusMinPixelWidth = (typeof params.focusMinPixelWidth === "number" && isFinite(params.focusMinPixelWidth))
			? Math.max(0, params.focusMinPixelWidth)
			: 0;

		var base = d3.time.scale()
			.domain([ timeDomainStart, timeDomainEnd ])
			.range([ 0, width ])
			.clamp(true);

		if (!xAxisDistortion || !focusTask) {
			return base;
		}

		var startMs = +timeDomainStart;
		var endMs = +timeDomainEnd;
		var fs = +focusTask.startDate;
		var fe = +focusTask.endDate;

		if (fs >= fe || endMs <= startMs) {
			return base;
		}

		var totalBefore = Math.max(0, fs - startMs);
		var totalAfter = Math.max(0, endMs - fe);
		var totalOther = totalBefore + totalAfter;

		var taskRange = Math.max(width * 0.66, Math.min(width, focusMinPixelWidth));
		var remainingRange = Math.max(0, width - taskRange);
		var leftRange = totalOther > 0 ? remainingRange * (totalBefore / totalOther) : remainingRange / 2;
		var rightRange = remainingRange - leftRange;

		var dom = [ startMs, fs, fe, endMs ];
		var rng = [ 0, leftRange, leftRange + taskRange, leftRange + taskRange + rightRange ];

		var linear = d3.scale.linear()
			.domain(dom)
			.range(rng)
			.clamp(true);

		linear.invert = function(y) {
			var inv = d3.scale.linear().domain(rng).range(dom);
			return new Date(inv(y));
		};

		return linear;
	}

	// Public API consumed by gantt-chart-d3.js.
	return {
		setTickFormat: setTickFormat,
		setXTickValues: setXTickValues,
		setYTickFormatter: setYTickFormatter,
		setAxisLabelsEnabled: setAxisLabelsEnabled,
		setAxisLinesEnabled: setAxisLinesEnabled,
		updateScales: updateScales,
		buildXScale: buildXScale,
		ensureAxisGroups: ensureAxisGroups,
		updateAxisLine: updateAxisLine,
		updateAxes: updateAxes,
		bringToFront: bringToFront,
		sendToBack: sendToBack
	};
}
