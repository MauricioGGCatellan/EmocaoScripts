// Axis manager centralizes all axis-related DOM and scale logic.
// This keeps gantt-chart-d3.js focused on data/layout and delegates
// axis rendering to a single, reusable place.
function createAxisManager(d3) {
	var xAxisGroup = null;
	var yAxisGroup = null;
	var axisLine = null;
	var tickFormat = "%H:%M";
	var xAxis = d3.svg.axis().orient("bottom");
	var yAxis = d3.svg.axis().orient("left").tickSize(0);

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

	// Recompute axis scales based on the current x-scale and row layout.
	// We map task names to the center of each row so ticks stay aligned
	// even when rows have variable heights (expanded vs collapsed).
	function updateScales(params) {
		var xScale = params.xScale;
		var taskTypes = params.taskTypes || [];
		var rowLayout = params.rowLayout || {};
		var rowCenters = taskTypes.map(function(t) {
			var row = rowLayout[t];
			return row ? (row.y + row.height / 2) : 0;
		});

		var yScale = d3.scale.ordinal()
			.domain(taskTypes)
			.range(rowCenters);

		xAxis
			.scale(xScale)
			.tickFormat(tickFormatter())
			.tickSubdivide(true)
			.tickSize(8)
			.tickPadding(8);

		yAxis
			.scale(yScale)
			.orient("left")
			.tickSize(0);
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
			xAxisGroup = svg.append("g").attr("class", "x axis");
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
	}

	// Render x and y axes with the latest scales.
	// The x-axis is translated to the bottom of the chart, and the y-axis
	// is updated in place. We also extend the y-axis domain path to match height.
	function updateAxes(totalHeight, maybeTransition) {
		if (!xAxisGroup || !yAxisGroup) return;
		var transition = maybeTransition || function(selection) { return selection; };
		var xSel = transition(xAxisGroup);
		var ySel = transition(yAxisGroup);

		xSel.call(xAxis)
			.attr("transform", "translate(0," + totalHeight + ")");

		ySel.call(yAxis);

		yAxisGroup.select("path.domain")
			.attr("d", "M0,0V" + totalHeight);
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

		console.log(timeDomainStart, timeDomainEnd)
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

		var taskRange = width * 0.66;
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
		updateScales: updateScales,
		buildXScale: buildXScale,
		ensureAxisGroups: ensureAxisGroups,
		updateAxisLine: updateAxisLine,
		updateAxes: updateAxes
	};
}