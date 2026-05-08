/**
 * @author Dimitry Kudrayvtsev
 * @version 2.1
 */ 

d3.gantt = function() {
    // Factory function: each call to d3.gantt() creates an isolated chart instance.
    // The instance stores mutable state (scales, layout metrics, DOM refs) in this
    // closure so redraw() can update what already exists instead of rebuilding
    // everything.
    var FIT_TIME_DOMAIN_MODE = "fit";
    var FIXED_TIME_DOMAIN_MODE = "fixed";
    
    var margin = {
	top : 20,
	right : 40,
	bottom : 40,
	left : 150
    };
    var selector = 'body';
    var fixedTimeDomainStart = new Date(+timeDomainStart);
    var fixedTimeDomainEnd = new Date(+timeDomainEnd);
	var now = new Date();

	var timeDomainStart = d3.time.day.offset(d3.time.day.floor(now), -3);
	var timeDomainEnd   = d3.time.hour.offset(now, +3);
    // timeDomainMode controls whether we compute bounds from data (fit) or use a fixed range.
    // We default to FIT so a basic chart "just works" without explicit domain settings.
    var timeDomainMode = FIT_TIME_DOMAIN_MODE;
    var taskTypes = [];
    var taskStatus = {};
	var currentTasks = [];
    
    var height = (document.body.clientHeight) - margin.top - margin.bottom-5;
    var width = document.body.clientWidth - margin.right - margin.left-5;

	// Precomputed row positions enable variable row heights for expanded tasks.
	// rowLayout maps taskName -> { y, height } so every visual element can align
	// to the same geometry. rowPadding enforces breathing room between rows, and
	// minRowHeight prevents collapsed rows from becoming too thin to see/click.
	// totalChartHeight is used to size the SVG and position the axes.
	var rowLayout = {};
	var rowPadding = 5;
	var minRowHeight = 8;
	var rowBarInset = 0;
	var totalChartHeight = 0;

	// Root SVG and translated group for the main chart; stored to reuse on redraw.
	var rootSvg = null; // the <svg> element from the DOM
    var ganttChartGroup = null; // the <g> element from the DOM, inside the <svg> but with
								// an offset because of the margins
	var linksClipId = "gantt-links-clip-" + Math.random().toString(36).slice(2);
	var purpleDotsPatternId = "gantt-bar-purple-dots-" + Math.random().toString(36).slice(2);
	var tealStripesPatternId = "gantt-bar-teal-stripes-" + Math.random().toString(36).slice(2);
	var yellowGridPatternId = "gantt-bar-yellow-grid-" + Math.random().toString(36).slice(2);
	var expandedPurpleBackdropPatternId = "gantt-bar-expanded-purple-backdrop-" + Math.random().toString(36).slice(2);
	var expandedGreenBackdropPatternId = "gantt-bar-expanded-green-backdrop-" + Math.random().toString(36).slice(2);
	var expandedYellowBackdropPatternId = "gantt-bar-expanded-yellow-backdrop-" + Math.random().toString(36).slice(2);
	var linksClipRect = null;
	var sceneLegendGroup = null;
	var dateBadgeGroup = null;
	var expandedYLabelsGroup = null;
	// Axes are managed by a helper so tick generation and DOM selection live
	// outside the core chart logic.
	var axisManager = createAxisManager(d3);
	// Connector lines are managed by a helper so they can live outside this file.
	var linkManager = createLinksLayerManager(d3);
	// Modal UI helper is created once per chart instance.
	var modal = null;
	var popupCatalog = null;
	var currentUserInfo = null;
	

	var xAxisTickValues = null;
	var yAxisLabelFormatter = null;
	var axisLabelsEnabled = true;
	var axisLinesEnabled = true;
	var subchartAxisLabelsEnabled = true;
	var subchartAxisLinesEnabled = true;
	var tickFormat = "%M:%S";
	var transitionDuration = 250;
	var chartLines = false;
	var subchartLines = false;
	var xAxisDistortion = true;
	var hideUnvisitedRows = false;
	var sceneLegendEnabled = true;
	var sceneLegendMode = "scene-categories";
	var dateBadgeEnabled = true;
	var focusTask = null;
	var yScale = d3.scale.linear();
	var zoomEnabled = true;
	var rectZoomEnabled = false;
	var zoomAllowedEventTypes = { wheel: true, mousewheel: true, MozMousePixelScroll: true };
	var yBrushScale = d3.scale.linear();
	var xZoomDomain = null;
	var xZoomBoundsDomain = [ new Date(+timeDomainStart), new Date(+timeDomainEnd) ];
	var yZoomState = null;
	var renderRowLayout = rowLayout;
	var renderTaskTypes = [];
	var expandVisibleLock = null;
	var iconTooltipManager = createIconTooltipManager({ d3: d3 });
	var configuredLeftMargin = margin.left;
	// Use a stable palette so status-to-color mapping is deterministic.
	// This avoids colors "jumping" when tasks are added/removed or status order changes.
	var tableau10 = d3.scale.category10().range();
	var barClassOrder = [];
	var uidCounter = 0;
	var runtimeMarker = "gantt-chart-d3.js@2026-03-04-zoom-wheel-only-v1";
	if (typeof window !== "undefined") {
		window.__GANTT_RUNTIME_MARKER__ = runtimeMarker;
	}

	var zoomManager = createZoomManager({
		d3: d3,
		document: document,
		allowUnclampedXScale: true,
		allowedEventTypes: zoomAllowedEventTypes,
		getState: function() {
			return {
				xZoomDomain: cloneDomain(xZoomDomain),
				yZoomState: yZoomState
			};
		},
		setState: function(nextState) {
			var nextXZoomDomain = nextState ? cloneDomain(nextState.xZoomDomain) : null;
			xZoomDomain = domainsMatch(nextXZoomDomain, xZoomBoundsDomain)
				? null
				: nextXZoomDomain;
			yZoomState = nextState ? nextState.yZoomState : null;
		}
	});

	// ---------------------------------------------------------------------------
	// Small helpers + status/color utilities
	// ---------------------------------------------------------------------------

	function ensureTaskId(task) {
		if (!task) return "";
		if (!task.__uid) {
			uidCounter += 1;
			task.__uid = "task-" + uidCounter;
		}
		return task.__uid;
	}

	function refreshBarClassOrder() {
		barClassOrder = [];
		 
		if (taskStatus) {
			Object.keys(taskStatus).forEach(function(key) {
				var className = taskStatus[key];
				if (className) {
					barClassOrder.push(className);
				}
			});
		}
	}

	function getBaseBarClass(d) { 
		if (d && taskStatus && taskStatus[d.status]) {  
			return taskStatus[d.status];
		}
		return "bar";
	}

	function getConditionalBarClass(d) {  
		if (!d || d.status !== "PERGUNTA") { 
			return "";
		}
		var hasSelected = typeof d.selectedAlternative === "number";
		var correctList = getOutcomeCorrectList(d);
		if (hasSelected) {
			if (!correctList.length) {
				return "bar-pergunta-unanswered";
			}
			var isCorrect = correctList.indexOf(d.selectedAlternative) !== -1;
			return isCorrect ? "bar-pergunta-correct" : "bar-pergunta-wrong";
		}
		return "bar-pergunta-unanswered";
	}

	// Compute nesting depth so layered bars can be styled per hierarchy level.
	// We walk up the __parentTask chain so a subtask can get a depth-specific
	// class (e.g., bar-layer-2) and remain distinguishable within its parent.

	//currently useless
	function getTaskDepth(task) {
		// Determine how deep a task is in the subtask tree.
		// This lets us style nested tasks differently without
		// changing the base status color.
		var depth = 0;
		var current = task && task.__parentTask;
		while (current) {
			depth += 1;
			current = current.__parentTask;
		}
		return depth;
	}

	// Combine base status class with a depth-specific class for nested styling.
	// This keeps the semantic status class (color) while adding a level marker
	// (layer-N) for CSS tweaks as depth increases.

	//currently useless too
	function getBarClass(d) {
		// Combine status class + depth class to create a single
		// class string applied to the bar rectangle.
		// This makes CSS selection straightforward (e.g. ".layer-1").
		var baseClass = getBaseBarClass(d);
		var depth = getTaskDepth(d);
		var conditionalClass = getConditionalBarClass(d);
		var inheritedParentClass = inheritsParentSemanticColor(d) ? " inherited-parent-color" : "";
		var expandedBackdropClass = shouldUseExpandedBackdrop(d) ? " expanded-backdrop" : "";
		return baseClass + " task-bar layer-" + depth + inheritedParentClass + expandedBackdropClass + (conditionalClass ? " " + conditionalClass : "");
	}

	function getBarFill(d) {
		var conditionalClass = getConditionalBarClass(d);
		if (!conditionalClass) {
			return null;
		}
		var expandedBackdropBaseClass = getExpandedBackdropBaseClass(d);
		if (expandedBackdropBaseClass) {
			var backdropPatternId = getExpandedBackdropPatternId(expandedBackdropBaseClass);
			return backdropPatternId ? "url(#" + backdropPatternId + ")" : getBarColorByClass(expandedBackdropBaseClass);
		}
		var baseClass = getBaseBarClass(d);
		if (inheritsParentSemanticColor(d) && normalizeStatusKey(d && d.status) !== "DIALOGO") {
			var contrast = getSemanticContrastColor(baseClass);
			if (contrast) {
				return contrast;
			}
		}
		if (baseClass === "bar-purple") {
			return "url(#" + purpleDotsPatternId + ")";
		}
		if (baseClass === "bar-green") {
			return "url(#" + tealStripesPatternId + ")";
		}
		if (baseClass === "bar-yellow") {
			return "url(#" + yellowGridPatternId + ")";
		}
		return getBarColor(d);
	}

	function getBarOpacity(d) {
		return 1;
	}

	function getBarStroke(d) {
		var expandedBackdropBaseClass = getExpandedBackdropBaseClass(d);
		return expandedBackdropBaseClass ? getBarColorByClass(expandedBackdropBaseClass) : null;
	}

	function getBarStrokeWidth(d) {
		return getExpandedBackdropBaseClass(d) ? 1.6 : null;
	}

	function ensureBarPatterns(defs) {
		if (!defs || defs.empty()) return;

		var purplePattern = defs.select("#" + purpleDotsPatternId);
		if (purplePattern.empty()) {
			purplePattern = defs.append("pattern")
				.attr("id", purpleDotsPatternId)
				.attr("patternUnits", "userSpaceOnUse")
				.attr("width", 8)
				.attr("height", 8);
			purplePattern.append("rect")
				.attr("width", 8)
				.attr("height", 8)
				.attr("fill", getSemanticBaseColor("bar-purple"));
			purplePattern.append("circle")
				.attr("cx", 2)
				.attr("cy", 2)
				.attr("r", 1.2)
				.attr("fill", "rgba(108, 37, 97, 0.42)");
			purplePattern.append("circle")
				.attr("cx", 6)
				.attr("cy", 6)
				.attr("r", 1.2)
				.attr("fill", "rgba(108, 37, 97, 0.42)");
		}

		var tealPattern = defs.select("#" + tealStripesPatternId);
		if (tealPattern.empty()) {
			tealPattern = defs.append("pattern")
				.attr("id", tealStripesPatternId)
				.attr("patternUnits", "userSpaceOnUse")
				.attr("width", 8)
				.attr("height", 8)
				.attr("patternTransform", "rotate(45)");
			tealPattern.append("rect")
				.attr("width", 8)
				.attr("height", 8)
				.attr("fill", getSemanticBaseColor("bar-green"));
			tealPattern.append("rect")
				.attr("x", 0)
				.attr("y", 0)
				.attr("width", 3)
				.attr("height", 8)
				.attr("fill", "#37897c");
		}

		var yellowPattern = defs.select("#" + yellowGridPatternId);
		if (yellowPattern.empty()) {
			yellowPattern = defs.append("pattern")
				.attr("id", yellowGridPatternId)
				.attr("patternUnits", "userSpaceOnUse")
				.attr("width", 8)
				.attr("height", 8);
			yellowPattern.append("rect")
				.attr("width", 8)
				.attr("height", 8)
				.attr("fill", getSemanticBaseColor("bar-yellow"));
			yellowPattern.append("path")
				.attr("d", "M 8 0 L 0 0 0 8")
				.attr("fill", "none")
				.attr("stroke", "#b1a35f")
				.attr("stroke-width", 1);
		}

		var expandedPurpleBackdropPattern = defs.select("#" + expandedPurpleBackdropPatternId);
		if (expandedPurpleBackdropPattern.empty()) {
			expandedPurpleBackdropPattern = defs.append("pattern")
				.attr("id", expandedPurpleBackdropPatternId)
				.attr("patternUnits", "userSpaceOnUse")
				.attr("width", 12)
				.attr("height", 12)
				.attr("patternTransform", "rotate(45)");
			expandedPurpleBackdropPattern.append("rect")
				.attr("width", 12)
				.attr("height", 12)
				.attr("fill", "#eed5e6");
			expandedPurpleBackdropPattern.append("rect")
				.attr("x", 0)
				.attr("y", 0)
				.attr("width", 5)
				.attr("height", 12)
				.attr("fill", "#e1bdd7");
		}

		var expandedGreenBackdropPattern = defs.select("#" + expandedGreenBackdropPatternId);
		if (expandedGreenBackdropPattern.empty()) {
			expandedGreenBackdropPattern = defs.append("pattern")
				.attr("id", expandedGreenBackdropPatternId)
				.attr("patternUnits", "userSpaceOnUse")
				.attr("width", 12)
				.attr("height", 12)
				.attr("patternTransform", "rotate(45)");
			expandedGreenBackdropPattern.append("rect")
				.attr("width", 12)
				.attr("height", 12)
				.attr("fill", "#d7eae7");
			expandedGreenBackdropPattern.append("rect")
				.attr("x", 0)
				.attr("y", 0)
				.attr("width", 5)
				.attr("height", 12)
				.attr("fill", "#caddda");
		}

		var expandedYellowBackdropPattern = defs.select("#" + expandedYellowBackdropPatternId);
		if (expandedYellowBackdropPattern.empty()) {
			expandedYellowBackdropPattern = defs.append("pattern")
				.attr("id", expandedYellowBackdropPatternId)
				.attr("patternUnits", "userSpaceOnUse")
				.attr("width", 12)
				.attr("height", 12)
				.attr("patternTransform", "rotate(45)");
			expandedYellowBackdropPattern.append("rect")
				.attr("width", 12)
				.attr("height", 12)
				.attr("fill", "#f4ebc1");
			expandedYellowBackdropPattern.append("rect")
				.attr("x", 0)
				.attr("y", 0)
				.attr("width", 5)
				.attr("height", 12)
				.attr("fill", "#e9dd9a");
		}

	}

	function getBarColor(d) {
		var baseClass = getBaseBarClass(d);
		var baseIndex = barClassOrder.indexOf(baseClass);
		if (baseIndex < 0) {
			baseIndex = 0;
		}
		return tableau10[baseIndex % tableau10.length];
	}

	function getBarFillByClass(baseClass) {
		if (baseClass === "bar-purple") {
			return "url(#" + purpleDotsPatternId + ")";
		}
		if (baseClass === "bar-green") {
			return "url(#" + tealStripesPatternId + ")";
		}
		if (baseClass === "bar-yellow") {
			return "url(#" + yellowGridPatternId + ")";
		}
		return getBarColorByClass(baseClass);
	}

	function hasQuestionTasks(tasks) {
		var found = false;
		function scan(list) {
			(list || []).forEach(function(task) {
				if (found || !task) return;
				if (hasOutcomeMetadata(task)) {
					found = true;
					return;
				}
				if (task.subtasks && task.subtasks.length) {
					scan(task.subtasks);
				}
			});
		}
		scan(tasks);
		return found;
	}

	function buildSceneLegendData(tasks) {
		if (sceneLegendMode === "question-outcome") {
			if (!hasQuestionTasks(tasks)) {
				return [];
			}
			return [
				{
					id: "PERGUNTA_CORRETA",
					label: "Resposta correta",
					color: getBarColorByClass("bar-pergunta-correct"),
					fill: getBarColorByClass("bar-pergunta-correct")
				},
				{
					id: "PERGUNTA_INCORRETA",
					label: "Resposta incorreta",
					color: getBarColorByClass("bar-pergunta-wrong"),
					fill: getBarColorByClass("bar-pergunta-wrong")
				}
			];
		}

		// Default legend for the individual main chart.
		return [
			{
				id: "SEM_INTERACOES",
				label: "Eventos sem interações",
				color: getBarColorByClass("bar-purple"),
				fill: getBarFillByClass("bar-purple")
			},
			{
				id: "COM_INTERACOES",
				label: "Eventos com interações",
				color: getBarColorByClass("bar-green"),
				fill: getBarFillByClass("bar-green")
			},
			{
				id: "MINI_JOGOS",
				label: "Mini-jogos",
				color: getBarColorByClass("bar-yellow"),
				fill: getBarFillByClass("bar-yellow")
			}
		];
	}

	function updateSceneLegend(tasks) {
		if (!sceneLegendGroup) return;

		if (!sceneLegendEnabled) {
			sceneLegendGroup.selectAll("*").remove();
			return;
		}

		var lineData = buildSceneLegendData(tasks);
		var isQuestionLegend = sceneLegendMode === "question-outcome";
		var itemHeight = isQuestionLegend ? 28 : 34;
		var padX = isQuestionLegend ? 16 : 18;
		var padY = isQuestionLegend ? 12 : 16;
		var swatch = isQuestionLegend ? 14 : 18;
		var longest = 0;
		lineData.forEach(function(item) {
			var len = item && item.label ? String(item.label).length : 0;
			if (len > longest) longest = len;
		});
		var legendWidth = isQuestionLegend
			? Math.max(210, (longest * 8) + 66)
			: Math.max(270, (longest * 8) + 78);
		var legendHeight = (lineData.length * itemHeight) + (padY * 2);
		var legendX = isQuestionLegend
			? Math.max(0, width - legendWidth - 10)
			: 10;
		var legendY = isQuestionLegend
			? 24
			: Math.max(24, totalChartHeight - legendHeight - 18);

		sceneLegendGroup.attr("transform", "translate(" + (margin.left + legendX) + "," + (margin.top + legendY) + ")");

		var bgJoin = sceneLegendGroup.selectAll("rect.gantt-scene-legend-bg").data(lineData.length ? [ null ] : []);
		bgJoin.enter()
			.append("rect")
			.attr("class", "gantt-scene-legend-bg");
		bgJoin
			.attr("width", legendWidth)
			.attr("height", legendHeight);
		bgJoin.exit().remove();

		// Rebuild legend items in data order to keep ordering deterministic.
		sceneLegendGroup.selectAll("g.gantt-scene-legend-item").remove();

		var allItems = sceneLegendGroup.selectAll("g.gantt-scene-legend-item")
			.data(lineData)
			.enter()
			.append("g")
			.attr("class", "gantt-scene-legend-item")
			.attr("transform", function(d, i) {
				return "translate(" + padX + "," + (padY + i * itemHeight + itemHeight / 2) + ")";
			});

		allItems.append("rect")
			.attr("class", "gantt-scene-legend-swatch")
			.attr("x", 0)
			.attr("y", -(swatch / 2))
			.attr("width", swatch)
			.attr("height", swatch)
			.style("fill", function(d) { return d.fill || d.color; })
			.style("stroke", function(d) { return d.color || "#1b1b1b"; })
			.style("stroke-width", 0.75);

		allItems.append("text")
			.attr("class", "gantt-scene-legend-label")
			.attr("dominant-baseline", "middle")
			.attr("x", swatch + 12)
			.text(function(d) { return d.label || d.id; });
	}

	function bringLegendToFront() {
		if (!sceneLegendGroup || typeof sceneLegendGroup.node !== "function") return;
		var legendNode = sceneLegendGroup.node();
		if (!legendNode || !legendNode.parentNode) return;
		legendNode.parentNode.appendChild(legendNode);
	}

	function getLabelMeasureFont() {
		var container = document.querySelector(selector);
		var bodyStyle = window.getComputedStyle(document.body);
		var family = bodyStyle && bodyStyle.fontFamily ? bodyStyle.fontFamily : "sans-serif";
		var size = "12px";
		if (container) {
			var containerStyle = window.getComputedStyle(container);
			if (containerStyle && containerStyle.fontFamily) {
				family = containerStyle.fontFamily;
			}
		}
		return size + " " + family;
	}

	function getMeasuredTaskLabel(name) {
		if (!axisLabelsEnabled) {
			return "";
		}
		var raw = name == null ? "" : String(name);
		if (typeof yAxisLabelFormatter !== "function") {
			return raw;
		}
		var formatted = yAxisLabelFormatter(raw, raw);
		return formatted == null ? raw : String(formatted);
	}

	function measureMaxTaskLabelWidth(taskNames) {
		if (!taskNames || !taskNames.length) return 0;
		var canvas = measureMaxTaskLabelWidth._canvas;
		if (!canvas) {
			canvas = document.createElement("canvas");
			measureMaxTaskLabelWidth._canvas = canvas;
		}
		var ctx = canvas.getContext("2d");
		if (!ctx) return 0;
		ctx.font = getLabelMeasureFont();
		var maxWidth = 0;
		taskNames.forEach(function(name) {
			var text = getMeasuredTaskLabel(name);
			var measured = ctx.measureText(text).width;
			if (measured > maxWidth) {
				maxWidth = measured;
			}
		});
		return maxWidth;
	}

	function getExpandedTask() {
		if (!currentTasks || !currentTasks.length) return null;
		for (var i = 0; i < currentTasks.length; i++) {
			if (currentTasks[i] && currentTasks[i].expanded) {
				return currentTasks[i];
			}
		}
		return null;
	}

	function getDialogLabelItems(task) {
		var subtasks = task && Array.isArray(task.subtasks) ? task.subtasks : [];
		var dialogs = subtasks.filter(function(subtask) {
			return subtask && String(subtask.status || "").toUpperCase() === "DIALOGO";
		});
		var source = dialogs.length ? dialogs : subtasks;
		return source.map(function(subtask, index) {
			return {
				key: ensureTaskId(subtask || {}) || ((task && task.taskName ? task.taskName : "task") + "-dialog-" + index),
				label: subtask && subtask.taskName ? String(subtask.taskName) : ("Dialogo " + (index + 1))
			};
		});
	}

	function getTaskLabelNamesForMargin(taskNames) {
		var names = (taskNames || []).slice();
		var expandedTask = getExpandedTask();
		if (expandedTask && taskNames && taskNames.indexOf(expandedTask.taskName) !== -1) {
			getDialogLabelItems(expandedTask).forEach(function(item) {
				if (item && item.label) {
					names.push(item.label);
				}
			});
		}
		return names;
	}

	function updateDynamicLeftMargin(taskNames) {
		var labelWidth = measureMaxTaskLabelWidth(taskNames);
		// Reserve extra breathing room only when axis labels are visible.
		// When labels are hidden, keep the configured left margin exactly.
		var extraPadding = axisLabelsEnabled ? 20 : 0;
		var targetLeft = Math.max(configuredLeftMargin, Math.ceil(labelWidth) + extraPadding);
		if (targetLeft === margin.left) return;
		var outerWidth = width + margin.left + margin.right;
		margin.left = targetLeft;
		width = Math.max(220, outerWidth - margin.left - margin.right);
	}

	var rectTransform = function(d) {
		// Translate each task group to its x/y position.
		// Using a group transform keeps the bar, icon, and subchart
		// aligned as one unit, and makes transitions simpler.
  
		var xPos = (d && typeof d.x === "number") ? d.x : xScale(d.startDate);
		var yPos = (d && typeof d.y === "number") ? d.y : (renderRowLayout[d.taskName] ? renderRowLayout[d.taskName].y : 0);
		return "translate(" + xPos + "," + yPos + ")";
	};

	// Create a DOM-safe key for subchart containers.
	// We use a sanitized version of the task key so it can safely be used in IDs.
	function subKey(task) {
		// Build a DOM-safe identifier for subchart containers.
		// We reuse the task id for stability, then sanitize it so
		// it is safe to embed in element ids and data attributes.
		// Same information as the task's unique id, but sanitized for id/class use so it can
		// be safely embedded in DOM IDs and class names.
		return String(ensureTaskId(task))
			.replace(/[^a-zA-Z0-9_-]/g, "_");
	}

	// Prevent subchart container clicks from collapsing when clicking actual bars/icons.
	// We rely on bubbling clicks for collapse, so we must ignore clicks on bars
	// and icons to avoid collapsing immediately after an intentional interaction.
	function isSubtaskClickTarget(target) {
		// Determine whether the click originated on a bar or icon.
		// Subcharts listen for clicks to collapse the parent; this
		// guard prevents collapsing when the user clicked a bar.
		if (!target || !target.closest) return false;
		return !!target.closest(".task-bar, .task-info-icon, .task-expand-icon");
	}

	// Chart height includes top/bottom margins so the SVG size matches content.
	// Using this helper keeps the SVG container and translated group in sync.
	function getChartHeight() {
		// The SVG height must include the top/bottom margins because the
		// translated chart group starts at margin.top. Using this helper
		// ensures the SVG is always large enough to contain the content.
		return totalChartHeight + margin.top + margin.bottom;
	}

	refreshBarClassOrder();
    var xScale = d3.time.scale().domain([ timeDomainStart, timeDomainEnd ]).range([ 0, width ]).clamp(true); 
	// the y axis is not used anymore, rowLayout deals with it
    //var y = d3.scale.ordinal().domain(taskTypes).rangeRoundBands([ 0, height - margin.top - margin.bottom ], .1);

	// ---------------------------------------------------------------------------
	// Time domain + horizontal scale
	// ---------------------------------------------------------------------------

    // Compute time domain from data (fit) or keep fixed; optionally zoom to focus task.
    // In "fit" mode we derive bounds from tasks so the chart always covers the data.
    // In "fixed" mode we keep explicit bounds set by the caller. The optional focus
    // zoom is a UX feature: when distortion is off and a task is expanded, we
    // center and enlarge its span so details are easier to read.
	function computeFitTimeBounds(tasks) {
		if (tasks === undefined || !tasks.length) {
			return [ d3.time.day.offset(new Date(), -3), d3.time.hour.offset(new Date(), +3) ];
		}
		var minStart = null;
		var maxEnd = null;
		tasks.forEach(function(task) {
			if (!task) return;
			var start = task.startDate;
			var end = task.endDate;
			if (start && (!minStart || +start < +minStart)) {
				minStart = start;
			}
			if (end && (!maxEnd || +end > +maxEnd)) {
				maxEnd = end;
			}
		});
		if (!minStart || !maxEnd || +minStart === +maxEnd) {
			return [ d3.time.day.offset(new Date(), -3), d3.time.hour.offset(new Date(), +3) ];
		}
		return +minStart <= +maxEnd ? [ minStart, maxEnd ] : [ maxEnd, minStart ];
	}

	function cloneDomain(domain) {
		if (!domain || domain.length !== 2 || !domain[0] || !domain[1]) return null;
		return [ new Date(+domain[0]), new Date(+domain[1]) ];
	}

	function getExpandFloor(value) {
		return (typeof value === "number" && isFinite(value) && value > 0) ? value : 0;
	}

	function getExpandedTaskByName(taskName) {
		if (!taskName || !currentTasks || !currentTasks.length) return null;
		for (var i = 0; i < currentTasks.length; i++) {
			var task = currentTasks[i];
			if (task && task.taskName === taskName && task.expanded) {
				return task;
			}
		}
		return null;
	}

	function getExpandedMinHeightForTaskName(taskName) {
		var expandedTask = getExpandedTaskByName(taskName);
		return expandedTask ? getExpandFloor(expandedTask.__expandMinHeight) : 0;
	}

	function captureTaskExpandFloors(task) {
		if (!task || !xScale || !renderRowLayout) return;
		var row = renderRowLayout[task.taskName];
		if (!row) return;

		var rawXStart = xScale(task.startDate);
		var rawXEnd = xScale(task.endDate);
		var xStart = Math.max(0, Math.min(width, rawXStart));
		var xEnd = Math.max(0, Math.min(width, rawXEnd));
		var widthValue = Math.max(0, xEnd - xStart);

		var rawYStart = row.y;
		var rawYEnd = rawYStart + row.height;
		var yStart = Math.max(0, Math.min(totalChartHeight, rawYStart));
		var yEnd = Math.max(0, Math.min(totalChartHeight, rawYEnd));
		var heightValue = Math.max(0, yEnd - yStart);

		task.__expandMinWidth = widthValue;
		task.__expandMinHeight = heightValue;
	}

	function domainsMatch(domainA, domainB) {
		if (!domainA || !domainB || domainA.length !== 2 || domainB.length !== 2) {
			return false;
		}
		return (+domainA[0] === +domainB[0]) && (+domainA[1] === +domainB[1]);
	}

    var setTimeDomain = function(tasks) {
		var baseDomain;
		// Compute or preserve the visible time range.
		// In "fit" mode, we derive bounds from the earliest start and latest end.
		// In "fixed" mode, we keep whatever the caller previously set.
		// The optional focus zoom (when distortion is off) enlarges a single
		// expanded task for readability.

		timeDomainStart = d3.time.day.offset(new Date(),-3);
    	timeDomainEnd = d3.time.hour.offset(new Date(),+3);
		if (timeDomainMode === FIT_TIME_DOMAIN_MODE) {
			baseDomain = computeFitTimeBounds(tasks);
		} else {
			baseDomain = [ fixedTimeDomainStart, fixedTimeDomainEnd ];
			if (tasks === undefined || tasks.length < 1) {
				timeDomainStart = d3.time.day.offset(new Date(), -3);
				timeDomainEnd = d3.time.hour.offset(new Date(), +3);
				return;
			}
			tasks.sort(function(a, b) {	
				return +a.endDate - +b.endDate;
			});
			timeDomainEnd = tasks[tasks.length - 1].endDate;
			tasks.sort(function(a, b) {
				return +a.startDate - +b.startDate;
			});
			timeDomainStart = tasks[0].startDate; 
		}
		timeDomainStart = baseDomain[0];
		timeDomainEnd = baseDomain[1];
		xZoomBoundsDomain = cloneDomain(baseDomain);

		// Override domain to zoom on the focused task (66% of width, centered) when distortion is off.
		// This "manual zoom" keeps the task readable without turning on the non-linear
		// distortion scale, which some users find confusing.
		if (!xAxisDistortion && focusTask && tasks && tasks.indexOf(focusTask) !== -1) {
			var mid = (focusTask.startDate.getTime() + focusTask.endDate.getTime()) / 2;
			var duration = Math.max(1, focusTask.endDate - focusTask.startDate);
			// Keep the focused task readable (default 66%), but never below the
			// width it had when expansion started.
			var targetRatio = 0.66;
			var focusMinWidth = getExpandFloor(focusTask.__expandMinWidth);
			if (width > 0 && focusMinWidth > 0) {
				targetRatio = Math.max(targetRatio, Math.min(1, focusMinWidth / width));
			}
			var targetSpan = duration / Math.max(0.0001, targetRatio);
			timeDomainStart = new Date(mid - targetSpan / 2);
			timeDomainEnd = new Date(mid + targetSpan / 2); 
		}
    };

    // Axis creation/update moved to gantt/axes.js.


	// Allocate vertical space across rows, giving expanded rows more room for subcharts.
	// The algorithm reserves a larger share of height for expanded rows (so nested
	// charts are readable), then normalizes everything to fill the available space
	// without exceeding it. This prevents a single expanded row from collapsing
	// everything else.

	// ---------------------------------------------------------------------------
	// Row layout calculation (heights + positions)
	// ---------------------------------------------------------------------------

	function computeRowLayout(tasks, visibleTaskTypes) {
		// Calculate vertical layout for each row.
		// We distribute the available height across rows, giving expanded
		// rows extra space so their subcharts are usable.
		// The result is stored in rowLayout for reuse by bars, icons, and axes. 
		rowLayout = {};
		var layoutTypes = visibleTaskTypes && visibleTaskTypes.length ? visibleTaskTypes : taskTypes;
		var rows = layoutTypes.length || (tasks ? tasks.length : 0);
		var available = Math.max(0, height - margin.top - margin.bottom);
		var totalPad = Math.max(0, (rows - 1) * rowPadding);
		var usable = Math.max(0, available - totalPad);

		// Count expanded rows in this chart level. Expanded rows receive more height
		// to make their nested subcharts usable.
		var expandedCount = 0;
		if (tasks && tasks.length) {
			layoutTypes.forEach(function(t) {
				var hasExpanded = tasks.some(function(d) {
					return d.taskName === t && d.expanded;
				});
				if (hasExpanded) expandedCount++;
			});
		}
		var collapsedCount = Math.max(0, rows - expandedCount);

		// Allocate 66% of height to expanded rows (shared if multiple), rest to others.
		// The 66% ratio is a compromise: expanded rows are emphasized, but collapsed
		// rows still remain visible for navigation.
		var expandedTotal = expandedCount > 0 ? usable * 0.66 : 0;
		var remaining = usable - expandedTotal;

		var expandedH = expandedCount > 0 ? expandedTotal / expandedCount : 0;
		var collapsedH = collapsedCount > 0 ? remaining / collapsedCount :
			(expandedCount > 0 ? expandedH : (rows > 0 ? usable / rows : 0));

		// Enforce min height, then renormalize to keep total height constant.
		// This prevents rows from becoming unusably thin while preserving total layout height.
		expandedH = Math.max(minRowHeight, expandedH);
		collapsedH = Math.max(minRowHeight, collapsedH);
		var totalH = expandedH * expandedCount + collapsedH * collapsedCount;
		if (totalH > 0 && totalH < usable) {
			var scale = usable / totalH;
			expandedH *= scale;
			collapsedH *= scale;
		}

		var yPos = 0;
		// Initialize all rows to height 0 so non-visible rows are hidden.
		taskTypes.forEach(function(t) {
			rowLayout[t] = { y: 0, height: 0 };
		});

		layoutTypes.forEach(function(t) {
			var hasExpanded = tasks.some(function(d) { return d.taskName === t && d.expanded; });
			var h = hasExpanded ? expandedH : collapsedH;
			rowLayout[t] = { y: yPos, height: h };
			yPos += h + rowPadding;
		});
		totalChartHeight = yPos ? yPos - rowPadding : 0;
	}

	function updateRenderRowLayout() {
		// Apply vertical zoom (if any) by transforming row positions/heights.
		// We keep the overall chart height constant, scaling rows so the selected
		// vertical slice fills the available space.
		var zoomState = yZoomState;
		if (!zoomState) {
			yScale.domain([ 0, totalChartHeight ]).range([ 0, totalChartHeight ]);
			renderRowLayout = rowLayout;
			return;
		}
		var ratioRange = getCurrentYRatioRange();
		var start = totalChartHeight * ratioRange.start;
		var end = totalChartHeight * ratioRange.end;
		var span = Math.max(1, end - start);
		var scale = totalChartHeight / span;

		// Keep expanded rows from becoming taller than a reasonable share
		// of the viewport during box zoom. We reuse the 66% cap that the
		// base layout uses, but apply it after vertical scaling.
		var maxExpandedHeight = 0;
		var maxExpandedMinHeight = 0;
		if (currentTasks && currentTasks.length) {
			taskTypes.forEach(function(t) {
				var row = rowLayout[t];
				if (!row) return;
				var hasExpanded = currentTasks.some(function(d) {
					return d.taskName === t && d.expanded;
				});
				if (hasExpanded && row.height > maxExpandedHeight) {
					maxExpandedHeight = row.height;
				}
				if (hasExpanded) {
					maxExpandedMinHeight = Math.max(maxExpandedMinHeight, getExpandedMinHeightForTaskName(t));
				}
			});
		}
		if (maxExpandedHeight > 0) {
			var maxAllowed = Math.max(totalChartHeight * 0.66, maxExpandedMinHeight);
			var scaledMax = maxExpandedHeight * scale;
			if (scaledMax > maxAllowed) {
				scale = maxAllowed / maxExpandedHeight;
			}
		}
		var rangeSpan = span * scale;
		yScale.domain([ start, end ]).range([ 0, rangeSpan ]);
		var layout = {};
		taskTypes.forEach(function(t) {
			var row = rowLayout[t];
			if (!row) return;
			layout[t] = {
				y: yScale(row.y),
				height: row.height * scale
			};
		});

		if (expandVisibleLock && Array.isArray(expandVisibleLock.taskTypes) && expandVisibleLock.taskTypes.length) {
			var expandedStillVisible = currentTasks.some(function(d) {
				return d.taskName === expandVisibleLock.expandedTaskName && d.expanded;
			});
			if (!expandedStillVisible) {
				expandVisibleLock = null;
			}
		}

		if (expandVisibleLock && Array.isArray(expandVisibleLock.taskTypes) && expandVisibleLock.taskTypes.length) {
			var lockedTypes = expandVisibleLock.taskTypes.filter(function(t) {
				var row = rowLayout[t];
				return !!row && row.height > 0;
			});
			if (lockedTypes.length) {
				var expandedTaskName = expandVisibleLock.expandedTaskName;
				if (lockedTypes.indexOf(expandedTaskName) === -1) {
					expandedTaskName = lockedTypes[0];
				}
				var redistributed = {};
				var expandedMinHeight = getExpandedMinHeightForTaskName(expandedTaskName);
				var expandedHeightBase = lockedTypes.length > 1 ? (totalChartHeight * 0.66) : totalChartHeight;
				var expandedHeight = Math.min(totalChartHeight, Math.max(expandedHeightBase, expandedMinHeight));
				var otherCount = Math.max(0, lockedTypes.length - 1);
				var otherHeight = otherCount > 0
					? ((totalChartHeight - expandedHeight) / otherCount)
					: 0;
				var cursorY = 0;

				lockedTypes.forEach(function(t) {
					var h = t === expandedTaskName ? expandedHeight : otherHeight;
					redistributed[t] = {
						y: cursorY,
						height: h
					};
					cursorY += h;
				});

				renderRowLayout = redistributed;
				renderTaskTypes = lockedTypes.slice();
				return;
			}
		}

		renderRowLayout = layout;
		renderTaskTypes = taskTypes.slice();
	}

	function captureVisibleRowsForExpand(expandedTaskName) {
		if (!yZoomState || !expandedTaskName || !renderRowLayout) {
			return null;
		}
		var visibleRows = taskTypes.filter(function(t) {
			var row = renderRowLayout[t];
			if (!row || row.height <= 0) return false;
			return row.y < totalChartHeight && (row.y + row.height) > 0;
		});
		if (!visibleRows.length) {
			return null;
		}
		if (visibleRows.indexOf(expandedTaskName) === -1) {
			visibleRows.push(expandedTaskName);
		}
		return {
			taskTypes: visibleRows,
			expandedTaskName: expandedTaskName
		};
	}

	// ---------------------------------------------------------------------------
	// Task hierarchy helpers (expand/collapse + parent/base tracking)
	// ---------------------------------------------------------------------------

	// Collapse a task and its descendants to keep layout consistent.
	// This is used whenever we change focus or time domain so nested charts do not
	// linger with stale geometry.
	function collapseAll(task) {
		// Recursively collapse a task and its descendants.
		// This keeps the UI consistent when the time domain or focus changes.
		task.expanded = false;
		task.__expanding = false;
		delete task.__expandMinWidth;
		delete task.__expandMinHeight;
		if (task.subtasks && task.subtasks.length) {
			task.subtasks.forEach(collapseAll);
		}
	}

	// Store parent/base references so subtasks can map back to their root task.
	// We need both __parentTask (for traversal) and __baseTask (for quick lookup)
	// so the popup and depth styling can work regardless of nesting depth.
	function annotateParents(taskList, parentTask, preserveRootParent) {
		// Annotate each task with references to its parent and base task.
		// This makes it cheap to walk "up" the hierarchy later (for popups,
		// depth styling, and subchart behavior) without repeatedly searching.
		if (!taskList || !taskList.length) return;
		taskList.forEach(function(task) {
			ensureTaskId(task);
			if (parentTask) {
				task.__parentTask = parentTask;
				task.__baseTask = parentTask.__baseTask || parentTask;
			} else {
				if (!preserveRootParent || !task.__baseTask || !task.__parentTask) {
					task.__baseTask = task;
				}
				if (!preserveRootParent || !task.__parentTask) {
					task.__parentTask = null;
				}
			}

			if (task.subtasks && task.subtasks.length) {
				annotateParents(task.subtasks, task, preserveRootParent);
			}
		});
	}

	// Resolve the root task for display in the modal, even for deep subtasks.
	// The UI uses base tasks for titles and summary metrics so subtask clicks
	// still show the correct parent context.
	function getBaseTask(task) {
		// Resolve the root task for any nested subtask.
		// The popup always displays base-task info, even when a subtask
		// was clicked, so we walk up the parent chain to find it.
		if (task && task.__baseTask) return task.__baseTask;
		var current = task;
		while (current && current.__parentTask) {
			current = current.__parentTask;
		}
		return current || task;
	}

	function getAllStatus(){
		return taskStatus;
	}

	// Wire up modal helper now that core helpers exist.
	// The modal stays outside the SVG so layout is handled by normal DOM flow.
	modal = createInfoModal({
		d3: d3,
		getBaseTask: getBaseTask,
		getPopupCatalog: function() {
			return popupCatalog;
		},
		getCurrentUser: function() {
			return currentUserInfo;
		}
		getAllStatus: getAllStatus
	});

	// Collapse all tasks in the given list except the target (operates within one chart level).
	// This keeps the interface manageable by allowing only one expanded row at a time.
	function collapseOthers(taskList, target) {
		// Keep only one expanded row at a time by collapsing siblings.
		// This avoids multiple subcharts fighting for vertical space.
		if (!taskList || !taskList.length) return;
		taskList.forEach(function(t) {
			if (t === target) return;
			collapseAll(t);
		});
	}

	function hasExpandableSubtasks(task) {
		return !!(task && task.subtasks && task.subtasks.length);
	}

	function toggleTaskExpanded(task) {
		if (!task || !hasExpandableSubtasks(task)) {
			return;
		}
		var expanding = !task.expanded;
		if (expanding) {
			captureTaskExpandFloors(task);
		}
		expandVisibleLock = expanding
			? captureVisibleRowsForExpand(task && task.taskName ? task.taskName : "")
			: null;
		if (expanding) {
			task.__expanding = true;
			collapseOthers(currentTasks, task);
			focusTask = task;
		} else {
			focusTask = null;
			task.__expanding = false;
			delete task.__expandMinWidth;
			delete task.__expandMinHeight;
		}
		task.expanded = expanding;
		gantt.redraw(currentTasks);
	}

	// Keep focusTask aligned to the currently expanded row.
	// The focused task drives x-axis distortion and must be cleared if it disappears.
	function refreshFocus(tasks) {
		// Ensure focusTask tracks the currently expanded item.
		// Focus drives time-domain zoom and distortion, so if the
		// focused task disappears or collapses, we clear it.
		if (!focusTask || tasks.indexOf(focusTask) === -1 || !focusTask.expanded) {
			focusTask = null;
			for (var i = 0; i < tasks.length; i++) {
				if (tasks[i].expanded) {
					focusTask = tasks[i];
					break;
				}
			}
		}
	}

    // Single render pipeline: initialize SVG once, then always render via updateChart().

	// ---------------------------------------------------------------------------
	// SVG scaffolding + bar rendering helpers
	// ---------------------------------------------------------------------------

	function ensureSvg() {
		// Create the main SVG once, then reuse it on every redraw.
		// Using a data join here keeps the "create once, update always"
		// pattern without duplicating DOM nodes.
		var svgJoin = d3.select(selector)
			.selectAll("svg.chart")
			.data([ null ]);

		svgJoin.enter()
			.append("svg")
			.attr("class", "chart");

		rootSvg = d3.select(selector).select("svg.chart");

		var groupJoin = rootSvg.selectAll("g.gantt-chart")
			.data([ null ]);
		groupJoin.enter()
			.append("g")
			.attr("class", "gantt-chart");

		ganttChartGroup = rootSvg.select("g.gantt-chart");

		var dateBadgeJoin = rootSvg.selectAll("g.gantt-date-badge")
			.data(dateBadgeEnabled ? [ null ] : []);
		dateBadgeJoin.exit().remove();
		dateBadgeJoin.enter()
			.append("g")
			.attr("class", "gantt-date-badge")
			.attr("aria-hidden", "true")
			.style("pointer-events", "none");
		dateBadgeGroup = rootSvg.select("g.gantt-date-badge");

		if (dateBadgeEnabled && dateBadgeGroup && !dateBadgeGroup.empty()) {
			var badgeBgJoin = dateBadgeGroup.selectAll("rect.gantt-date-badge-bg").data([ null ]);
			badgeBgJoin.enter().append("rect").attr("class", "gantt-date-badge-bg");
			var badgeTextJoin = dateBadgeGroup.selectAll("text.gantt-date-badge-text").data([ null ]);
			badgeTextJoin.enter().append("text").attr("class", "gantt-date-badge-text");
		}

		var defsJoin = rootSvg.selectAll("defs.gantt-defs")
			.data([ null ]);
		defsJoin.enter()
			.append("defs")
			.attr("class", "gantt-defs");
		var defs = rootSvg.select("defs.gantt-defs");
		ensureBarPatterns(defs);

		var clipJoin = defs.selectAll("clipPath.gantt-links-clip")
			.data([ null ]);
		clipJoin.enter()
			.append("clipPath")
			.attr("class", "gantt-links-clip")
			.attr("id", linksClipId);

		var clipRectJoin = defs.select("clipPath.gantt-links-clip")
			.selectAll("rect")
			.data([ null ]);
		clipRectJoin.enter().append("rect");
		linksClipRect = defs.select("clipPath.gantt-links-clip").select("rect");

		axisManager.ensureAxisGroups(ganttChartGroup);

		var expandedLabelsJoin = ganttChartGroup.selectAll("g.expanded-y-dialog-labels")
			.data([ null ]);
		expandedLabelsJoin.enter()
			.append("g")
			.attr("class", "expanded-y-dialog-labels")
			.attr("aria-hidden", "true")
			.style("pointer-events", "none");
		expandedYLabelsGroup = ganttChartGroup.select("g.expanded-y-dialog-labels");

		var legendJoin = rootSvg.selectAll("g.gantt-scene-legend")
			.data([ null ]);
		legendJoin.enter()
			.append("g")
			.attr("class", "gantt-scene-legend");
		sceneLegendGroup = rootSvg.select("g.gantt-scene-legend");

		rootSvg
			.attr("width", width + margin.left + margin.right)
			.attr("height", getChartHeight());
			.attr("height", getChartHeight() + 5);

		ganttChartGroup
			.attr("transform", "translate(" + margin.left + ", " + margin.top + ")");

		if (linksClipRect) {
			linksClipRect
				.attr("x", 0)
				.attr("y", 0)
				.attr("width", width)
				.attr("height", totalChartHeight);
		}
	}

	function updateDateBadge() {
		if (!dateBadgeGroup || dateBadgeGroup.empty()) {
			return;
		}
		var dateValue = timeDomainStart instanceof Date ? timeDomainStart : new Date(timeDomainStart);
		var dateFormat = d3.time.format("%d/%m/%Y");
		var label = dateValue && isFinite(dateValue.getTime()) ? dateFormat(dateValue) : "---";
		var paddingX = 10;
		var badgeHeight = 20;
		var badgeWidth = 90;

		dateBadgeGroup.attr("transform", "translate(0,0)");

		dateBadgeGroup.select("text.gantt-date-badge-text")
			.text(label)
			.attr("x", paddingX)
			.attr("y", 12)
			.attr("dominant-baseline", "middle");

		dateBadgeGroup.select("rect.gantt-date-badge-bg")
			.attr("x", 0)
			.attr("y", 0)
			.attr("rx", 8)
			.attr("ry", 8)
			.attr("width", badgeWidth)
			.attr("height", badgeHeight);
	}

	function getCurrentXAxisTicks() {
		if (!xScale || typeof xScale.ticks !== "function") {
			return null;
		}
		try {
			var ticks = xScale.ticks();
			return Array.isArray(ticks) && ticks.length ? ticks : null;
		} catch (err) {
			return null;
		}
	}

	function formatAriaTime(value) {
		if (!value) return "";
		try {
			return d3.time.format(tickFormat)(value instanceof Date ? value : new Date(value));
		} catch (err) {
			return "";
		}
	}

	function formatAriaDuration(milliseconds) {
		var totalSeconds = Math.max(0, Math.round((milliseconds || 0) / 1000));
		var hours = Math.floor(totalSeconds / 3600);
		var minutes = Math.floor((totalSeconds % 3600) / 60);
		var seconds = totalSeconds % 60;
		var parts = [];
		if (hours) {
			parts.push(hours + (hours === 1 ? " hora" : " horas"));
		}
		if (minutes) {
			parts.push(minutes + (minutes === 1 ? " minuto" : " minutos"));
		}
		if (!parts.length || seconds) {
			parts.push(seconds + (seconds === 1 ? " segundo" : " segundos"));
		}
		return parts.join(" e ");
	}

	function getTaskAriaLabel(task) {
		var taskName = task && task.taskName ? String(task.taskName) : "atividade";
		var start = formatAriaTime(task && task.startDate);
		var duration = (task && task.startDate && task.endDate)
			? formatAriaDuration(task.endDate - task.startDate)
			: "";
		var parts = [ taskName ];
		if (start) {
			parts.push("início " + start);
		}
		if (duration) {
			parts.push("duração " + duration);
		}
		return parts.join(", ");
	}

	function enterBars(selection) {
		// Configure bar rectangles when they are first created.
		// We only set attributes that do not depend on size/position here,
		// so the update phase can handle geometry independently.
		var expansionDescriptionId = ensureExpansionToggleDescription(document);
		selection
			.attr("class", function(d) { return d.barClass || getBarClass(d.task || d); })
			.style("fill", function(d) { return getBarFill(d.task || d); })
			.style("opacity", function(d) { return getBarOpacity(d.task || d); })
			.style("stroke", function(d) { return getBarStroke(d.task || d); })
			.style("stroke-width", function(d) { return getBarStrokeWidth(d.task || d); })
			.attr("data-task-key", function(d) { return d.key || ""; })
			.attr("role", "button")
			.attr("focusable", "true")
			.attr("aria-describedby", expansionDescriptionId)
			.attr("aria-label", function(d) {
				var task = d.task || d;
				return getTaskAriaLabel(task);
			})
				.on("click", function(d) {
					var task = d.task || d;
					toggleTaskExpanded(task);
				})
			.on("keydown", function(d) {
				var evt = d3.event;
				var key = evt && (evt.key || evt.keyCode);
				var isEnter = key === "Enter" || key === 13;
				var isSpace = key === " " || key === "Spacebar" || key === 32;
				if (!isEnter && !isSpace) {
					return;
				}
				if (evt) {
					evt.preventDefault();
					evt.stopPropagation();
					}
					var task = d.task || d;
					toggleTaskExpanded(task);
				})
			.on("dblclick", function() {
				// Prevent zoom behavior from catching double-clicks on tasks.
				d3.event.stopPropagation();
			});
	}

	function updateBars(selection) {
		// Update the geometry and visibility of bars on every redraw.
		// This is separate from enterBars so transitions can animate
		// width/height and visibility changes smoothly.
		var expansionDescriptionId = ensureExpansionToggleDescription(document);
		selection
			.attr("class", function(d) { return d.barClass || getBarClass(d.task || d); })
			.style("fill", function(d) { return getBarFill(d.task || d); })
			.style("opacity", function(d) { return getBarOpacity(d.task || d); })
			.style("stroke", function(d) { return getBarStroke(d.task || d); })
			.style("stroke-width", function(d) { return getBarStrokeWidth(d.task || d); })
			.attr("expanded", function(d) { return d.expanded; })
			.attr("role", "button")
			.attr("focusable", "true")
			.attr("aria-describedby", expansionDescriptionId)
			.attr("aria-label", function(d) {
				var task = d.task || d;
				return getTaskAriaLabel(task);
			})
			.attr("tabindex", function(d) { return d.visible ? 0 : -1; })
			.attr("visibility", function(d) { return d.visible ? "visible" : "hidden"; });
	}

	function bringExpandedYLabelsToFront() {
		if (!expandedYLabelsGroup || expandedYLabelsGroup.empty()) return;
		var node = expandedYLabelsGroup.node();
		if (node && node.parentNode) {
			node.parentNode.appendChild(node);
		}
	}

	function clearExpandedYDialogLabels() {
		if (ganttChartGroup) {
			ganttChartGroup.selectAll("g.expanded-y-dialog-labels").remove();
		}
		expandedYLabelsGroup = null;
	}

	function ensureExpandedYDialogLabelsGroup() {
		if (!ganttChartGroup) return null;
		var join = ganttChartGroup.selectAll("g.expanded-y-dialog-labels")
			.data([ null ]);
		join.enter()
			.append("g")
			.attr("class", "expanded-y-dialog-labels")
			.attr("aria-hidden", "true")
			.style("pointer-events", "none");
		expandedYLabelsGroup = ganttChartGroup.select("g.expanded-y-dialog-labels");
		return expandedYLabelsGroup;
	}

	function updateExpandedYDialogLabels() {
		if (!ganttChartGroup) return;
		var expandedTask = getExpandedTask();
		var hasExpandedRow = expandedTask &&
			expandedTask.taskName &&
			renderTaskTypes.indexOf(expandedTask.taskName) !== -1 &&
			renderRowLayout[expandedTask.taskName];
		var dialogItems = hasExpandedRow ? getDialogLabelItems(expandedTask) : [];
		var row = hasExpandedRow ? renderRowLayout[expandedTask.taskName] : null;

		ganttChartGroup.selectAll(".y.axis .tick text")
			.style("display", function(d) {
				if (!hasExpandedRow) return null;
				return String(d) === String(expandedTask.taskName) ? "none" : null;
			});

		if (!axisLabelsEnabled || !row || !dialogItems.length) {
			clearExpandedYDialogLabels();
			return;
		}

		var labelsGroup = ensureExpandedYDialogLabelsGroup();
		if (!labelsGroup || labelsGroup.empty()) return;

		var topPad = Math.min(14, Math.max(4, row.height * 0.12));
		var availableHeight = Math.max(1, row.height - (topPad * 2));
		var count = dialogItems.length;
		dialogItems.forEach(function(item, index) {
			item.x = -10;
			item.y = row.y + topPad + ((index + 0.5) * (availableHeight / count));
		});

		var labels = expandedYLabelsGroup.selectAll("text.expanded-y-dialog-label")
			.data(dialogItems, function(d) { return d.key; });

		labels.exit().remove();

		labels.enter()
			.append("text")
			.attr("class", "expanded-y-dialog-label")
			.attr("text-anchor", "end")
			.attr("dominant-baseline", "middle")
			.text(function(d) { return d.label; });

		var allLabels = expandedYLabelsGroup.selectAll("text.expanded-y-dialog-label");
		allLabels
			.attr("x", function(d) { return d.x; })
			.attr("y", function(d) { return d.y; })
			.text(function(d) { return d.label; });

		bringExpandedYLabelsToFront();
	}

	function prepareRenderData(tasks) {
		// Convert raw task data into render-ready bar objects.
		// This precomputes x/y/width/height, visibility, and subchart layout
		// so the render layer only reads values (no heavy computation).
		var barData = []; 
		tasks.forEach(function(task) {
			var row = renderRowLayout[task.taskName];
			var rawXStart = xScale(task.startDate);
			var rawXEnd = xScale(task.endDate);
			// Keep rendered bars inside plot bounds even when xScale is unclamped
			// for wheel zoom-out behavior.
			var xStart = Math.max(0, Math.min(width, rawXStart));
			var xEnd = Math.max(0, Math.min(width, rawXEnd));
			var widthValue = Math.max(0, xEnd - xStart);
			// Keep rendered bars inside vertical plot bounds to mirror x clamping.
			var rawYStart = row ? row.y : 0;
			var rawYEnd = rawYStart + (row ? row.height : 0);
			var yStart = Math.max(0, Math.min(totalChartHeight, rawYStart));
			var yEnd = Math.max(0, Math.min(totalChartHeight, rawYEnd));
			var heightValue = Math.max(0, yEnd - yStart);
			var appliedBarInset = Math.min(
				Math.max(0, rowBarInset),
				Math.max(0, (heightValue / 2) - 1)
			);
			var barY = yStart + appliedBarInset;
			var barHeight = Math.max(0, heightValue - (appliedBarInset * 2));

			var widthValue = Math.max(0, xEnd - xStart);
			var heightValue = row ? row.height : 0;
			var visible = !!row &&
				barHeight > 0 &&
				rawXEnd > 0 &&
				rawXStart < width &&
				widthValue > 0;

			var bar = {
				key: ensureTaskId(task),
				task: task,
				x: xStart,
				y: barY,
				width: widthValue,
				height: barHeight,
				visible: visible,
				expanded: task.expanded,
				barClass: getBarClass(task),
				barColor: getBarColor(task)
			};

			if (task.expanded && task.subtasks && task.subtasks.length && visible) {
				var containerW = widthValue - 10;
				var containerH = Math.max(0, heightValue - 10);
				var subMargin = subchartAxisLabelsEnabled
					? { top: 5, right: 20, bottom: 20, left: 60 }
					: { top: 0, right: 0, bottom: 0, left: 0 };
				var innerW = Math.max(0, containerW - subMargin.left - subMargin.right);
				var innerH = Math.max(0, containerH - subMargin.top - subMargin.bottom);

				var subTaskNames = [];
				if (task.subtaskLayout && Array.isArray(task.subtaskLayout.rowOrder)) {
					subTaskNames = task.subtaskLayout.rowOrder.slice();
					if (hideUnvisitedRows) {
						var subtaskVisited = {};
						task.subtasks.forEach(function(st) {
							if (st.taskName) {
								subtaskVisited[st.taskName] = true;
							}
						});
						subTaskNames = subTaskNames.filter(function(name) {
							return !!subtaskVisited[name];
						});
					}
				} else {
					var seen = {};
					task.subtasks.forEach(function(st) {
						if (st.taskName && !seen[st.taskName]) {
							seen[st.taskName] = true;
							subTaskNames.push(st.taskName);
						}
					});
				}

				var subRowBase = Math.max(minRowHeight, 24);
				var naturalInnerH = (subTaskNames.length * subRowBase) + Math.max(0, (subTaskNames.length - 1) * rowPadding);
				var targetHeight = Math.max(innerH, naturalInnerH);

				bar.subchart = {
					key: subKey(task),
					task: task,
					containerW: containerW,
					containerH: containerH,
					subMargin: subMargin,
					innerW: innerW,
					targetHeight: targetHeight,
					subTaskNames: subTaskNames
				};
			}

			barData.push(bar);
		});
		return { bars: barData };
	}

	function updateTaskGroups(svg, barData, maybeTransition) {
		// Main D3 join for task groups (one <g> per task).
		// Each group owns the bar rect, info icon, and optional subchart.
		var groups = svg.selectAll("g.task-group").data(barData, function(d) { return d.key; });
		groups.exit().remove();

		var groupsEnter = groups.enter()
			.insert("g", function() {
				var axisRefNode = svg.select("g.x.axis").node();
				return axisRefNode || null;
			})
			.attr("class", "task-group");

		groupsEnter.attr("transform", rectTransform);

		groupsEnter.append("rect")
			.attr("class", "task-bar");

		var allGroups = svg.selectAll("g.task-group");
		maybeTransition(allGroups).attr("transform", rectTransform);

		allGroups.style("display", function(d) {
			return d.visible ? null : "none";
		});

		enterBars(groupsEnter.select("rect.task-bar"));
		var bars = allGroups.select("rect.task-bar");
		// Apply focus/tab attributes immediately (not via transition),
		// then animate geometry updates.
		bars.call(updateBars);
		maybeTransition(bars)
			.attr("x", 0)
			.attr("y", 0)
			.attr("height", function(d) { return d.height; })
			.attr("width", function(d) { return d.width; });

		updateTaskIcons(groupsEnter, allGroups, maybeTransition);

		return allGroups;
	}

	// ---------------------------------------------------------------------------
	// Icon rendering + tooltip behavior
	// ---------------------------------------------------------------------------
	function updateTaskIcons(groupsEnter, allGroups, maybeTransition) {
		// Create and update two action icons for each bar:
		// - "i" opens the popup
		// - "+" expands to the detailed (subchart) view
		var iconSize = 16;
		var iconPadding = 4;
		var iconHitSize = 20;

		function getTask(d) {
			return d && d.task ? d.task : d;
		}

		function infoTransform(d) {
			var w = d.width;
			var xPos = w - (iconSize / 2) - iconPadding;
			var yPos = (iconSize / 2) + iconPadding;
			return "translate(" + xPos + "," + yPos + ")";
		}

		function expandTransform(d) {
			var w = d.width;
			var h = d.height;
			var xPos = w - (iconSize / 2) - iconPadding;
			var yPos = h - (iconSize / 2) - iconPadding;
			return "translate(" + xPos + "," + yPos + ")";
		}

		function infoVisible(d) {
			if (!d.visible) return false;
			var w = d.width;
			var h = d.height;
			var minWSize = (iconSize + iconPadding) * 2;
			var minHSize = iconSize + (iconPadding * 2);
			return w > minWSize && h > minHSize;
		}

		function expandVisible(d) {
			if (!infoVisible(d)) return false;
			var task = getTask(d);
			if (!hasExpandableSubtasks(task)) return false;
			if (task && task.expanded) return false;
			var h = d.height;
			var minHForTwoIcons = (iconSize * 2) + (iconPadding * 3);
			return h > minHForTwoIcons;
		}

		var infoEnter = groupsEnter.append("g")
			.attr("class", "task-info-icon")
			.attr("role", "button")
			.attr("focusable", "true")
			.attr("aria-label", function(d) {
				var task = getTask(d);
				var taskName = task && task.taskName ? String(task.taskName) : "atividade";
				return "Exibir detalhes de " + taskName;
			})
			.on("click", function(d) {
				d3.event.stopPropagation();
				modal.showInfoTooltip(getTask(d));
			})
			.on("keydown", function(d) {
				var evt = d3.event;
				var key = evt && (evt.key || evt.keyCode);
				var isEnter = key === "Enter" || key === 13;
				var isSpace = key === " " || key === "Spacebar" || key === 32;
				if (!isEnter && !isSpace) return;
				if (evt) {
					evt.preventDefault();
					evt.stopPropagation();
				}
				modal.showInfoTooltip(getTask(d));
			})
			.on("mouseenter", function() {
				iconTooltipManager.show("Exibir detalhes");
			})
			.on("mousemove", function() {
				iconTooltipManager.move();
			})
			.on("mouseleave", function() {
				iconTooltipManager.hide();
			});

		infoEnter.append("circle")
			.attr("class", "task-info-icon-circle")
			.attr("r", 10);

		infoEnter.append("text")
			.attr("class", "task-info-icon-text")
			.text("i")
			.attr("dy", "0.35em");

		var expandEnter = groupsEnter.append("g")
			.attr("class", "task-expand-icon")
			.attr("aria-hidden", "true")
			.attr("focusable", "false")
			.attr("tabindex", -1)
			.on("click", function(d) {
				d3.event.stopPropagation();
				toggleTaskExpanded(getTask(d));
			})
			.on("keydown", function(d) {
				var evt = d3.event;
				var key = evt && (evt.key || evt.keyCode);
				var isEnter = key === "Enter" || key === 13;
				var isSpace = key === " " || key === "Spacebar" || key === 32;
				if (!isEnter && !isSpace) return;
				if (evt) {
					evt.preventDefault();
					evt.stopPropagation();
				}
				toggleTaskExpanded(getTask(d));
			})
			.on("mouseenter", function(d) {
				if (!expandVisible(d)) return;
				iconTooltipManager.show("Expandir visão detalhada");
			})
			.on("mousemove", function() {
				iconTooltipManager.move();
			})
			.on("mouseleave", function() {
				iconTooltipManager.hide();
			});

		expandEnter.append("rect")
			.attr("class", "task-expand-icon-hit")
			.attr("x", -(iconHitSize / 2))
			.attr("y", -(iconHitSize / 2))
			.attr("width", iconHitSize)
			.attr("height", iconHitSize);

		expandEnter.append("text")
			.attr("class", "task-expand-icon-text")
			.attr("dy", "0.35em")
			.text("+");

		var infoIcons = allGroups.select("g.task-info-icon");
		var expandIcons = allGroups.select("g.task-expand-icon");

		infoEnter.attr("transform", infoTransform);
		expandEnter.attr("transform", expandTransform);

		infoIcons
			.attr("role", "button")
			.attr("focusable", "true")
			.attr("aria-label", function(d) {
				var task = getTask(d);
				var taskName = task && task.taskName ? String(task.taskName) : "atividade";
				return "Exibir detalhes de " + taskName;
			})
			.attr("display", function(d) { return infoVisible(d) ? null : "none"; })
			.attr("tabindex", function(d) { return infoVisible(d) ? 0 : -1; })
			.style("pointer-events", function(d) { return infoVisible(d) ? "all" : "none"; });

		expandIcons
			.attr("role", null)
			.attr("aria-label", null)
			.attr("aria-hidden", "true")
			.attr("focusable", "false")
			.attr("display", function(d) { return expandVisible(d) ? null : "none"; })
			.attr("tabindex", -1)
			.style("pointer-events", function(d) { return expandVisible(d) ? "all" : "none"; });

		maybeTransition(infoIcons)
			.attr("transform", infoTransform);

		maybeTransition(expandIcons)
			.attr("transform", expandTransform);
	}

	// ---------------------------------------------------------------------------
	// Zoom behavior (wheel zoom + box zoom)
	// ---------------------------------------------------------------------------

	function getCurrentYRatioRange() {
		return getCurrentYRatioRangeFromState(yZoomState);
	}

	function applyZoomHandlers() {
		// Keep wheel zoom and box zoom wired to the current SVG + scales.
		zoomManager.applyHandlers({
			svg: rootSvg,
			chartGroup: ganttChartGroup,
			xScale: xScale,
			yBrushScale: yBrushScale,
			innerWidth: width,
			innerHeight: totalChartHeight,
			fallbackDomain: [ timeDomainStart, timeDomainEnd ],
			boundsDomain: xZoomBoundsDomain,
			redraw: function(meta) {
				iconTooltipManager.hide();
				if (meta && meta.source) {
					expandVisibleLock = null;
				}
				gantt.redraw(currentTasks, meta);
			}
		});
	}

	function getVisibleTaskTypes() {
		return taskTypes;
	}

	function resetZoomDomain() {
		expandVisibleLock = null;
		zoomManager.resetZoom();
	}

	function clearInteractionStateForDatasetChange() {
		// Loading a new dataset while a row is expanded can leave stale subchart/
		// focus/zoom UI state around. Reset chart-local interactions first.
		if (currentTasks && currentTasks.length) {
			currentTasks.forEach(collapseAll);
		}
		focusTask = null;
		expandVisibleLock = null;
		zoomManager.clearState();
		if (modal && typeof modal.hideInfoTooltip === "function") {
			modal.hideInfoTooltip();
		}
		// Remove stale nested subchart DOM before the next dataset redraw.
		// With descendant-based selections, leftover subgantt DOM can be picked up
		// by the parent chart joins and corrupt the render.
		if (ganttChartGroup && typeof ganttChartGroup.selectAll === "function") {
			ganttChartGroup.selectAll("foreignObject.subgantt-container").remove();
		}
	}

	// ---------------------------------------------------------------------------
	// Main render pipeline
	// ---------------------------------------------------------------------------

	function updateChart(tasks, renderOptions) {
		// Single render pipeline that handles both initial render and redraws.
		// This keeps all updates in one place to avoid drift between gantt()
		// and gantt.redraw(), and ensures all dependent elements stay in sync.
		var animateRender = !(renderOptions && renderOptions.animate === false);
		currentTasks = tasks || [];
		var visibleTaskTypes = getVisibleTaskTypes();
		renderTaskTypes = visibleTaskTypes.slice();
		updateDynamicLeftMargin(getTaskLabelNamesForMargin(visibleTaskTypes));
		annotateParents(currentTasks, null, !!gantt._preserveBaseTask);
		computeRowLayout(currentTasks, visibleTaskTypes);
		updateRenderRowLayout();
		refreshFocus(currentTasks);
		var zoomDomain = xZoomDomain;
		if (zoomDomain && zoomDomain.length === 2) {
			timeDomainStart = zoomDomain[0];
			timeDomainEnd = zoomDomain[1];
		} else {
			setTimeDomain(currentTasks);
		}
		xScale = axisManager.buildXScale({
			timeDomainStart: timeDomainStart,
			timeDomainEnd: timeDomainEnd,
			width: width,
			focusTask: focusTask,
			xAxisDistortion: xAxisDistortion,
			focusMinPixelWidth: focusTask && focusTask.expanded
				? getExpandFloor(focusTask.__expandMinWidth)
				: 0,
		});
		axisManager.setTickFormat(tickFormat);
		if (axisManager.setXTickValues) {
			axisManager.setXTickValues(xAxisTickValues);
		}
		if (axisManager.setYTickFormatter) {
			axisManager.setYTickFormatter(yAxisLabelFormatter);
		}
		if (axisManager.setAxisLabelsEnabled) {
			axisManager.setAxisLabelsEnabled(axisLabelsEnabled);
		}
		if (axisManager.setAxisLinesEnabled) {
			axisManager.setAxisLinesEnabled(axisLinesEnabled);
		}
		axisManager.updateScales({
			xScale: xScale,
			taskTypes: renderTaskTypes,
			rowLayout: renderRowLayout,
			width: width,
			totalHeight: totalChartHeight
		});

		var hadSvg = rootSvg && typeof rootSvg.empty === "function" ? !rootSvg.empty() : !!rootSvg;
		ensureSvg();
		updateDateBadge();
		applyZoomHandlers();

		function maybeTransition(selection) {
			// Use transitions only after the SVG exists to avoid animating
			// initial creation. This keeps first render snappy and avoids
			// confusing "from zero" animations.
			if (animateRender && hadSvg && transitionDuration > 0) {
				return selection.transition().duration(transitionDuration);
			}
			return selection;
		}

		var svg = ganttChartGroup;
		var linksGroup = linkManager.ensureLinksLayer(svg);
		linksGroup.attr("clip-path", "url(#" + linksClipId + ")");
		axisManager.ensureAxisGroups(ganttChartGroup);
		var prepared = prepareRenderData(currentTasks);

		axisManager.updateAxisLine(totalChartHeight, maybeTransition);

		var groups = updateTaskGroups(svg, prepared.bars, maybeTransition);

		axisManager.updateAxes(totalChartHeight, maybeTransition);
		if (axisManager.sendToBack) {
			axisManager.sendToBack();
		}
		updateExpandedYDialogLabels(maybeTransition);
		linkManager.updateLinks({
			linksGroup: linksGroup,
			tasks: currentTasks,
			x: xScale,
			rowLayout: renderRowLayout,
			chartLines: chartLines,
			maybeTransition: maybeTransition,
			hadSvg: hadSvg
		});

		linkManager.bringLinksToFront();

		updateSubGantts({
			d3: d3,
			groups: groups,
			maybeTransition: maybeTransition,
			annotateParents: annotateParents,
			subKey: subKey,
			isSubtaskClickTarget: isSubtaskClickTarget,
			collapseAll: collapseAll,
			clearFocus: function() { focusTask = null; },
			gantt: gantt,
			currentTasks: currentTasks,
			taskStatus: taskStatus,
			hideUnvisitedRows: hideUnvisitedRows,
			xAxisDistortion: xAxisDistortion,
			subchartLines: subchartLines,
			subchartAxisLabelsEnabled: subchartAxisLabelsEnabled,
			subchartAxisLinesEnabled: subchartAxisLinesEnabled,
			parentTickValues: getCurrentXAxisTicks(),
			popupCatalog: popupCatalog,
			currentUser: currentUserInfo,
			transitionDuration: animateRender ? transitionDuration : 0
		});
		// Keep legend above axis/grid and bars in the individual chart.
		updateSceneLegend(currentTasks);
		bringLegendToFront();

		return gantt;
	}
	// ---------------------------------------------------------------------------
	// Public chart API
	// ---------------------------------------------------------------------------

	function gantt(selection) {
		// Primary entry point: render with the current configuration.
		// We keep this thin so the core logic stays in updateChart().
		selection.each(function(data) { 
			
			return updateChart(data);
		})
    };

    // Update render: reuse SVG, apply transitions, and keep subcharts in sync.
    gantt.redraw = function(tasks) {
		// Public redraw API used after interactions (expand/collapse, resize, etc.).
		// It intentionally delegates to updateChart() so the render path stays unified.
		return updateChart(tasks);
    };

    // Chainable setters/getters for configuration.
	// These follow the standard D3 pattern: call with no args to read,
	// call with a value to set and return the chart for chaining.
    gantt.margin = function(value) {
		if (!arguments.length)
			return margin;
		margin = value;
		configuredLeftMargin = margin && typeof margin.left === "number" ? margin.left : configuredLeftMargin;
		return gantt;
    };

    gantt.timeDomain = function(value) {
		if (!arguments.length)
			return [ timeDomainStart, timeDomainEnd ];
		timeDomainStart = new Date(+value[0]);
		timeDomainEnd = new Date(+value[1]);
		fixedTimeDomainStart = new Date(+timeDomainStart);
		fixedTimeDomainEnd = new Date(+timeDomainEnd);
		xZoomBoundsDomain = [ new Date(+timeDomainStart), new Date(+timeDomainEnd) ];
		expandVisibleLock = null;
		zoomManager.clearState();
		return gantt;
    };

    /**
     * @param {string}
     *                vale The value can be "fit" - the domain fits the data or
     *                "fixed" - fixed domain.
     */
    gantt.timeDomainMode = function(value) {
		if (!arguments.length)
			return timeDomainMode;
		// Collapse everything when the interval changes to avoid stale subchart layouts.
		// Changing domain can shift bars dramatically; collapsing avoids leaving
		// nested charts sized for the previous scale.
		if (currentTasks && currentTasks.length) {
			currentTasks.forEach(collapseAll);
		}
        timeDomainMode = value;
		expandVisibleLock = null;
		zoomManager.clearState();
        return gantt;
    };

    gantt.taskTypes = function(value) {
		if (!arguments.length)
			return taskTypes;
		taskTypes = value;
		return gantt;
    };
    
    gantt.taskStatus = function(value) {
		if (!arguments.length)
			return taskStatus;
		taskStatus = value;
		refreshBarClassOrder();
 
		return gantt;
    };

    gantt.width = function(value) {
		if (!arguments.length)
			return width;
		width = +value;
		return gantt;
    };

    gantt.height = function(value) {
		if (!arguments.length)
			return height;
		height = +value;
		return gantt;
    };

    gantt.tickFormat = function(value) {
		if (!arguments.length)
			return tickFormat;
		tickFormat = value;
		return gantt;
    };

	gantt.xTickValues = function(value) {
		if (!arguments.length) {
			return xAxisTickValues;
		}
		xAxisTickValues = Array.isArray(value) && value.length ? value.slice() : null;
		return gantt;
	};

	gantt.yAxisLabelFormatter = function(value) {
		if (!arguments.length) {
			return yAxisLabelFormatter;
		}
		yAxisLabelFormatter = (typeof value === "function") ? value : null;
		return gantt;
	};

	gantt.axisLabelsEnabled = function(value) {
		if (!arguments.length) {
			return axisLabelsEnabled;
		}
		axisLabelsEnabled = value !== false;
		return gantt;
	};

	gantt.axisLinesEnabled = function(value) {
		if (!arguments.length) {
			return axisLinesEnabled;
		}
		axisLinesEnabled = value !== false;
		return gantt;
	};

	gantt.subchartAxisLabelsEnabled = function(value) {
		if (!arguments.length) {
			return subchartAxisLabelsEnabled;
		}
		subchartAxisLabelsEnabled = value !== false;
		return gantt;
	};

	gantt.subchartAxisLinesEnabled = function(value) {
		if (!arguments.length) {
			return subchartAxisLinesEnabled;
		}
		subchartAxisLinesEnabled = value !== false;
		return gantt;
	};

    gantt.selector = function(value) {
		if (!arguments.length)
			return selector;
		selector = value;
		return gantt;
    };

	gantt.chartLines = function(value) {
		if (!arguments.length)
			return chartLines;
		chartLines = !!value;
		return gantt;
    };

	gantt.subchartLines = function(value) {
		if (!arguments.length)
			return subchartLines;
		subchartLines = !!value;
		return gantt;
    };

	gantt.rowBarInset = function(value) {
		if (!arguments.length)
			return rowBarInset;
		var numeric = Number(value);
		rowBarInset = isFinite(numeric) ? Math.max(0, numeric) : 0;
		return gantt;
	};

	gantt.xAxisDistortion = function(value) {
		if (!arguments.length)
			return xAxisDistortion;
		xAxisDistortion = !!value;
		return gantt;
    };

	gantt.hideUnvisitedRows = function(value) {
		if (!arguments.length)
			return hideUnvisitedRows;
		hideUnvisitedRows = !!value;
		return gantt;
	};

	gantt.sceneLegendEnabled = function(value) {
		if (!arguments.length)
			return sceneLegendEnabled;
		sceneLegendEnabled = !!value;
		return gantt;
	};

	gantt.sceneLegendMode = function(value) {
		if (!arguments.length) {
			return sceneLegendMode;
		}
		var normalized = String(value || "").trim().toLowerCase();
		sceneLegendMode = normalized === "question-outcome"
			? "question-outcome"
			: "scene-categories";
		return gantt;
	};

	gantt.dateBadgeEnabled = function(value) {
		if (!arguments.length) {
			return dateBadgeEnabled;
		}
		dateBadgeEnabled = !!value;
		return gantt;
	};

	gantt.popupCatalog = function(value) {
		if (!arguments.length) {
			return popupCatalog;
		}
		popupCatalog = value || null;
		return gantt;
	};

	gantt.currentUser = function(value) {
		if (!arguments.length) {
			return currentUserInfo;
		}
		currentUserInfo = value || null;
		return gantt;
	};

	gantt.zoomEnabled = function(value) {
		if (!arguments.length) {
			return zoomManager.zoomEnabled();
		}
		zoomEnabled = !!value;
		zoomManager.zoomEnabled(zoomEnabled);
		return gantt;
	};

	gantt.rectZoomEnabled = function(value) {
		if (!arguments.length) {
			return zoomManager.rectZoomEnabled();
		}
		rectZoomEnabled = !!value;
		zoomManager.rectZoomEnabled(rectZoomEnabled);
		return gantt;
	};

	gantt.zoomIn = function() {
		zoomManager.zoomIn();
		return gantt;
	};

	gantt.zoomOut = function() {
		zoomManager.zoomOut();
		return gantt;
	};

	gantt.resetZoom = function() {
		resetZoomDomain();
		return gantt;
	};

	gantt.resetForDatasetChange = function() {
		clearInteractionStateForDatasetChange();
		return gantt;
	};

    return gantt;
};
