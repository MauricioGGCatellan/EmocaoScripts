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
    var timeDomainStart = d3.time.day.offset(new Date(),-3);
    var timeDomainEnd = d3.time.hour.offset(new Date(),+3);
    // timeDomainMode controls whether we compute bounds from data (fit) or use a fixed range.
    // We default to FIT so a basic chart "just works" without explicit domain settings.
    var timeDomainMode = FIT_TIME_DOMAIN_MODE;
    var taskTypes = [];
    var taskStatus = [];
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
	var totalChartHeight = 0;

	// Root SVG and translated group for the main chart; stored to reuse on redraw.
	var rootSvg = null; // the <svg> element from the DOM
    var ganttChartGroup = null; // the <g> element from the DOM, inside the <svg> but with
								// an offset because of the margins
	// Axes are managed by a helper so tick generation and DOM selection live
	// outside the core chart logic.
	var axisManager = createAxisManager(d3);
	// Connector lines are managed by a helper so they can live outside this file.
	var linkManager = createLinksLayerManager(d3);
	// Modal UI helper is created once per chart instance.
	var modal = null;
	

	var tickFormat = "%H:%M";
	var transitionDuration = 250;
	var chartLines = false;
	var subchartLines = false;
	var xAxisDistortion = true;
	var hideUnvisitedRows = false;
	var focusTask = null;
	var yScale = d3.scale.linear();
	var zoomEnabled = true;
	var rectZoomEnabled = false;
	var zoomBehavior = null;
	var zoomBrush = null;
	var brushGroup = null;
	var yBrushScale = d3.scale.linear();
	var xZoomDomain = null;
	var yZoomState = null;
	var renderRowLayout = rowLayout;
	var iconTooltip = null;
	// Use a stable palette so status-to-color mapping is deterministic.
	// This avoids colors "jumping" when tasks are added/removed or status order changes.
	var tableau10 = d3.scale.category10().range();
	var barClassOrder = [];
	var uidCounter = 0;

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
		var correctList = Array.isArray(d.correctAlternative) ? d.correctAlternative : [ d.correctAlternative ];
		var hasCorrect = correctList.some(function(value) { return typeof value === "number"; });
		if (hasSelected && hasCorrect) {
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
		return baseClass + " task-bar layer-" + depth + (conditionalClass ? " " + conditionalClass : "");
	}

	function getBarFill(d) {
		var conditionalClass = getConditionalBarClass(d);
		if (conditionalClass) {
			return null;
		}
		return getBarColor(d);
	}

	function getBarColor(d) {
		var baseClass = getBaseBarClass(d);
		var baseIndex = barClassOrder.indexOf(baseClass);
		if (baseIndex < 0) {
			baseIndex = 0;
		}
		return tableau10[baseIndex % tableau10.length];
	}

	var rectTransform = function(d) {
		// Translate each task group to its x/y position.
		// Using a group transform keeps the bar, icon, and subchart
		// aligned as one unit, and makes transitions simpler.
 
		console.log(d)
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
		return !!target.closest(".task-bar");
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
	console.log(xScale)
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
    var setTimeDomain = function(tasks) {
		// Compute or preserve the visible time range.
		// In "fit" mode, we derive bounds from the earliest start and latest end.
		// In "fixed" mode, we keep whatever the caller previously set.
		// The optional focus zoom (when distortion is off) enlarges a single
		// expanded task for readability.

		timeDomainStart = d3.time.day.offset(new Date(),-3);
    	timeDomainEnd = d3.time.hour.offset(new Date(),+3);
		if (timeDomainMode === FIT_TIME_DOMAIN_MODE) {
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
			console.log(timeDomainStart, timeDomainEnd)
		}

		// Override domain to zoom on the focused task (66% of width, centered) when distortion is off.
		// This "manual zoom" keeps the task readable without turning on the non-linear
		// distortion scale, which some users find confusing.
		if (!xAxisDistortion && focusTask && tasks && tasks.indexOf(focusTask) !== -1) {
			var mid = (focusTask.startDate.getTime() + focusTask.endDate.getTime()) / 2;
			var duration = Math.max(1, focusTask.endDate - focusTask.startDate);
			// Make the focused task occupy ~66% of the chart width for readability.
			var targetSpan = duration / 0.66;
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
		if (totalH > 0) {
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
		if (zoomState.startRow && zoomState.endRow) {
			// When zoom is snapped to full rows, the rowLayout already reflects
			// the visible set. We simply mirror it here to avoid double scaling.
			yScale.domain([ 0, totalChartHeight ]).range([ 0, totalChartHeight ]);
			renderRowLayout = rowLayout;
			return;
		}
		var start;
		var end;
		if (zoomState.startRow && zoomState.endRow) {
			var startRow = rowLayout[zoomState.startRow];
			var endRow = rowLayout[zoomState.endRow];
			if (startRow && endRow) {
				start = startRow.y + startRow.height * (zoomState.startOffset || 0);
				end = endRow.y + endRow.height * (zoomState.endOffset || 0);
				if (start > end) {
					var swap = start;
					start = end;
					end = swap;
				}
			}
		}
		if (typeof start !== "number" || typeof end !== "number") {
			if (typeof zoomState.startRatio === "number" && typeof zoomState.endRatio === "number") {
				start = totalChartHeight * zoomState.startRatio;
				end = totalChartHeight * zoomState.endRatio;
			} else {
				start = Math.min(zoomState.start, zoomState.end);
				end = Math.max(zoomState.start, zoomState.end);
			}
		}
		var span = Math.max(1, end - start);
		var scale = totalChartHeight / span;

		// Keep expanded rows from becoming taller than a reasonable share
		// of the viewport during box zoom. We reuse the 66% cap that the
		// base layout uses, but apply it after vertical scaling.
		var maxExpandedHeight = 0;
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
			});
		}
		if (maxExpandedHeight > 0) {
			var maxAllowed = totalChartHeight * 0.66;
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
		renderRowLayout = layout;
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

	// Wire up modal helper now that core helpers exist.
	// The modal stays outside the SVG so layout is handled by normal DOM flow.
	modal = createInfoModal({
		d3: d3,
		getBaseTask: getBaseTask
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

		axisManager.ensureAxisGroups(ganttChartGroup);

		rootSvg
			.attr("width", width + margin.left + margin.right)
			.attr("height", getChartHeight() + 5);

		ganttChartGroup
			.attr("transform", "translate(" + margin.left + ", " + margin.top + ")");
	}

	function enterBars(selection) {
		// Configure bar rectangles when they are first created.
		// We only set attributes that do not depend on size/position here,
		// so the update phase can handle geometry independently.
		selection
			.attr("class", function(d) { return d.barClass || getBarClass(d.task || d); })
			.style("fill", function(d) { return getBarFill(d.task || d); })
			.attr("data-task-key", function(d) { return d.key || ""; })
			.on("click", function(d) {
				var task = d.task || d;
				var expanding = !task.expanded;
				if (expanding) {
					task.__expanding = true;
					collapseOthers(currentTasks, task);
					focusTask = task;
				} else {
					focusTask = null;
					task.__expanding = false;
				}
				task.expanded = expanding;
				gantt.redraw(currentTasks);
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
		selection
			.attr("expanded", function(d) { return d.expanded; })
			.attr("x", 0)
			.attr("y", 0)
			.attr("height", function(d) { return d.height; })
			.attr("width", function(d) { return d.width; })
			.attr("visibility", function(d) { return d.visible ? "visible" : "hidden"; });
	}

	function prepareRenderData(tasks) {
		// Convert raw task data into render-ready bar objects.
		// This precomputes x/y/width/height, visibility, and subchart layout
		// so the render layer only reads values (no heavy computation).
		var barData = [];
		console.log(tasks)
		tasks.forEach(function(task) {
			var row = renderRowLayout[task.taskName];
			var xStart = xScale(task.startDate);
			var xEnd = xScale(task.endDate);
 
			console.log(xStart)
			console.log(xEnd)
			console.log(task.startDate)

			var widthValue = Math.max(0, xEnd - xStart);
			var heightValue = row ? row.height : 0;
			var visible = !!row &&
				heightValue > 0 &&
				xEnd > 0 &&
				xStart < width &&
				widthValue > 0 &&
				(row.y + heightValue) > 0 &&
				row.y < totalChartHeight;

			var bar = {
				key: ensureTaskId(task),
				task: task,
				x: xStart,
				y: row ? row.y : 0,
				width: widthValue,
				height: heightValue,
				visible: visible,
				expanded: task.expanded,
				barClass: getBarClass(task),
				barColor: getBarColor(task)
			};

			if (task.expanded && task.subtasks && task.subtasks.length && visible) {
				var containerW = widthValue - 10;
				var containerH = Math.max(0, heightValue - 10);
				var subMargin = { top: 5, right: 20, bottom: 20, left: 60 };
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
		// We insert groups before the x-axis so axes remain on top.
		var axisRefNode = svg.select("g.x.axis").node();
		var groups = svg.selectAll("g.task-group").data(barData, function(d) { return d.key; });
		groups.exit().remove();

		var groupsEnter = groups.enter()
			.insert("g", function() { return axisRefNode; })
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
		maybeTransition(bars).call(updateBars);

		updateTaskIcons(groupsEnter, allGroups, maybeTransition);

		return allGroups;
	}

	// ---------------------------------------------------------------------------
	// Icon rendering + tooltip behavior
	// ---------------------------------------------------------------------------
	function updateTaskIcons(groupsEnter, allGroups, maybeTransition) {
		// Create and update the info "i" icons for each task group.
		// We position them relative to the bar width, and hide them
		// when the bar is too narrow to avoid overlap.
		var iconEnter = groupsEnter.append("g")
			.attr("class", "task-info-icon")
			.on("click", function(d) {
				d3.event.stopPropagation();
				modal.showInfoTooltip(d.task || d);
			})
			.on("mouseenter", function() {
				showIconTooltip("Exibir Detalhes");
			})
			.on("mousemove", function() {
				moveIconTooltip();
			})
			.on("mouseleave", function() {
				hideIconTooltip();
			});

		iconEnter.append("circle")
			.attr("class", "task-info-icon-circle")
			.attr("r", 10);

		iconEnter.append("text")
			.attr("class", "task-info-icon-text")
			.text("i")
			.attr("dy", "0.35em");

		var icons = allGroups.select("g.task-info-icon");
		var iconSize = 16;
		var iconPadding = 4;

		function iconTransform(d) {
			var w = d.width;
			var xPos = w - (iconSize / 2) - iconPadding;
			var yPos = (iconSize / 2) + iconPadding;
			return "translate(" + xPos + "," + yPos + ")";
		}

		function iconVisible(d) {
			if (!d.visible) return false;
			var w = d.width;
			var h = d.height;
			var minWSize = (iconSize + iconPadding) * 2;
			var minHSize = iconSize + (iconPadding * 2);
			return w > minWSize && h > minHSize;
		}

		iconEnter
			.attr("transform", iconTransform)
			.attr("display", function(d) { return iconVisible(d) ? null : "none"; })
			.style("pointer-events", function(d) { return iconVisible(d) ? "all" : "none"; });

		maybeTransition(icons)
			.attr("transform", iconTransform)
			.attr("display", function(d) { return iconVisible(d) ? null : "none"; })
			.style("pointer-events", function(d) { return iconVisible(d) ? "all" : "none"; });
	}

	function ensureIconTooltip() {
		var tooltipJoin = d3.select("body")
			.selectAll(".task-info-tooltip")
			.data([ null ]);

		tooltipJoin.enter()
			.append("div")
			.attr("class", "task-info-tooltip")
			.style("position", "absolute")
			.style("display", "none")
			.style("pointer-events", "none");

		iconTooltip = d3.select("body").select(".task-info-tooltip");
		return iconTooltip;
	}

	function showIconTooltip(text) {
		var tooltip = ensureIconTooltip();
		tooltip.text(text || "")
			.style("display", "block");
		moveIconTooltip();
	}

	function moveIconTooltip() {
		if (!iconTooltip || iconTooltip.empty() || !d3.event) return;
		var offset = 12;
		iconTooltip
			.style("left", (d3.event.pageX + offset) + "px")
			.style("top", (d3.event.pageY + offset) + "px");
	}

	function hideIconTooltip() {
		if (!iconTooltip || iconTooltip.empty()) return;
		iconTooltip.style("display", "none");
	}

	// ---------------------------------------------------------------------------
	// Zoom behavior (wheel zoom + box zoom)
	// ---------------------------------------------------------------------------
	
	function applyZoomHandlers() {
		// Keep wheel zoom and box zoom wired to the current SVG + scales.
		applyZoomBehavior();
		applyRectZoom();
	}

	function getVisibleTaskTypes() {
		var zoomState = yZoomState;
		if (zoomState && zoomState.startRow && zoomState.endRow) {
			var startIndex = taskTypes.indexOf(zoomState.startRow);
			var endIndex = taskTypes.indexOf(zoomState.endRow);
			if (startIndex === -1 || endIndex === -1) {
				return taskTypes;
			}
			if (startIndex > endIndex) {
				var swap = startIndex;
				startIndex = endIndex;
				endIndex = swap;
			}
			return taskTypes.slice(startIndex, endIndex + 1);
		}
		return taskTypes;
	}

	function applyZoomBehavior() {
		// Wheel/drag zoom only affects the x domain (time).
		if (!zoomEnabled || !rootSvg) return;
		if (!zoomBehavior) {
			zoomBehavior = d3.behavior.zoom()
				.x(xScale)
				.on("zoom", handleZoom);
		} else {
			zoomBehavior.x(xScale);
		}
		rootSvg.call(zoomBehavior);
	}

	function handleZoom() {
		// Apply the new x domain without recomputing row layout.
		if (!ganttChartGroup) return;
		applyZoomDomain(xScale.domain(), { recomputeLayout: false });
	}

	function applyRectZoom() {
		// Create/update the brush overlay used for box zoom.
		if (!ganttChartGroup) return;
		if (!rectZoomEnabled) {
			if (brushGroup) {
				brushGroup.style("display", "none");
			}
			return;
		}

		var brushJoin = ganttChartGroup.selectAll("g.zoom-brush").data([ null ]);
		brushJoin.enter()
			.append("g")
			.attr("class", "zoom-brush");
		brushGroup = ganttChartGroup.select("g.zoom-brush");
		brushGroup.style("display", null);

		if (!zoomBrush) {
			zoomBrush = d3.svg.brush()
				.on("brushend", handleRectZoomEnd);
		}

		yBrushScale.domain([ 0, totalChartHeight ]).range([ 0, totalChartHeight ]);
		zoomBrush.x(xScale).y(yBrushScale);
		brushGroup.call(zoomBrush);
	}

	function handleRectZoomEnd() {
		// Convert the brush rectangle into x domain + row range.
		if (!zoomBrush || !brushGroup || zoomBrush.empty()) return;
		var extent = zoomBrush.extent();
		var x0 = extent[0][0];
		var x1 = extent[1][0];
		var y0 = extent[0][1];
		var y1 = extent[1][1];
		if (x0 === x1 || y0 === y1) {
			zoomBrush.clear();
			brushGroup.call(zoomBrush);
			return;
		}
		var start;
		var end;
		if (x0 instanceof Date || x1 instanceof Date) {
			start = x0 instanceof Date ? x0 : x1;
			end = x1 instanceof Date ? x1 : x0;
			if (start > end) {
				var swap = start;
				start = end;
				end = swap;
			}
		} else {
			start = xScale.invert(Math.min(x0, x1));
			end = xScale.invert(Math.max(x0, x1));
		}
		if (!start || !end || +start === +end) {
			zoomBrush.clear();
			brushGroup.call(zoomBrush);
			return;
		}
		var yStart = Math.min(y0, y1);
		var yEnd = Math.max(y0, y1);
		var baseStart = yScale.invert(yStart);
		var baseEnd = yScale.invert(yEnd);
		if (baseStart > baseEnd) {
			var tmp = baseStart;
			baseStart = baseEnd;
			baseEnd = tmp;
		}

		var startRow = null;
		var endRow = null;
		for (var i = 0; i < taskTypes.length; i++) {
			var name = taskTypes[i];
			var row = rowLayout[name];
			if (!row) continue;
			if (!startRow && baseStart <= (row.y + row.height)) {
				startRow = name;
			}
			if (baseEnd <= (row.y + row.height)) {
				endRow = name;
				break;
			}
		}
		if (!startRow && taskTypes.length) {
			startRow = taskTypes[0];
		}
		if (!endRow && taskTypes.length) {
			endRow = taskTypes[taskTypes.length - 1];
		}
		if (startRow && endRow) {
			yZoomState = {
				startRow: startRow,
				startOffset: 0,
				endRow: endRow,
				endOffset: 1
			};
		} else {
			var normStart = totalChartHeight > 0 ? (yStart / totalChartHeight) : 0;
			var normEnd = totalChartHeight > 0 ? (yEnd / totalChartHeight) : 1;
			yZoomState = {
				startRatio: Math.max(0, Math.min(1, normStart)),
				endRatio: Math.max(0, Math.min(1, normEnd))
			};
		}

		applyZoomDomain([ start, end ], { recomputeLayout: true });

		zoomBrush.clear();
		brushGroup.call(zoomBrush);

		if (rectZoomEnabled) {
			rectZoomEnabled = false;
			applyRectZoom();
			var event;
			if (typeof CustomEvent === "function") {
				event = new CustomEvent("rectzoom:complete");
			} else {
				event = document.createEvent("Event");
				event.initEvent("rectzoom:complete", true, true);
			}
			document.dispatchEvent(event);
		}
	}


	function applyZoomDomain(domain, options) {
		// Apply the x domain and optionally recompute row layout for y-zoom.
		if (!domain || domain.length !== 2) return;
		var start = domain[0];
		var end = domain[1];
		if (!start || !end || +start === +end) return;
		if (start > end) {
			var swap = start;
			start = end;
			end = swap;
		}
		timeDomainStart = start;
		timeDomainEnd = end;
		xZoomDomain = [ start, end ];
		xScale.domain([ start, end ]);
		if (zoomBehavior) {
			zoomBehavior.x(xScale);
		}

		var recomputeLayout = options && options.recomputeLayout;
		if (recomputeLayout) {
			computeRowLayout(currentTasks, getVisibleTaskTypes());
			updateRenderRowLayout();
		}
		axisManager.setTickFormat(tickFormat);
		axisManager.updateScales({
			xScale: xScale,
			taskTypes: getVisibleTaskTypes(),
			rowLayout: renderRowLayout
		});
		axisManager.updateAxes(totalChartHeight, function(selection) { return selection; });

		var prepared = prepareRenderData(currentTasks);
		var groups = updateTaskGroups(ganttChartGroup, prepared.bars, function(selection) { return selection; });
		var linksGroup = linkManager.ensureLinksLayer(ganttChartGroup);
		linkManager.updateLinks({
			linksGroup: linksGroup,
			tasks: currentTasks,
			x: xScale,
			rowLayout: renderRowLayout,
			chartLines: chartLines,
			maybeTransition: function(selection) { return selection; },
			hadSvg: true
		});
		linkManager.bringLinksToFront();

		updateSubGantts({
			d3: d3,
			groups: groups,
			maybeTransition: function(selection) { return selection; },
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
			transitionDuration: 0
		});
	}

	function zoomByFactor(factor) {
		// Button zoom: scale the current time window around its midpoint.
		if (!xScale || !factor) return;
		var domain = xScale.domain();
		if (!domain || domain.length !== 2) return;
		var startMs = +domain[0];
		var endMs = +domain[1];
		if (!isFinite(startMs) || !isFinite(endMs) || startMs === endMs) return;
		var mid = (startMs + endMs) / 2;
		var span = (endMs - startMs) / factor;
		if (!isFinite(span) || span <= 0) return;
		var nextStart = new Date(mid - span / 2);
		var nextEnd = new Date(mid + span / 2);
		applyZoomDomain([ nextStart, nextEnd ], { recomputeLayout: false });
	}

	function resetZoomDomain() {
		// Clear zoom state and return to the full time domain.
		xZoomDomain = null;
		yZoomState = null;
		if (zoomBrush && brushGroup) {
			zoomBrush.clear();
			brushGroup.call(zoomBrush);
		}
		setTimeDomain(currentTasks);
		xScale = axisManager.buildXScale({
			timeDomainStart: timeDomainStart,
			timeDomainEnd: timeDomainEnd,
			width: width,
			focusTask: focusTask,
			xAxisDistortion: xAxisDistortion,
		});
		applyZoomDomain(xScale.domain(), { recomputeLayout: true });
	}

	// ---------------------------------------------------------------------------
	// Main render pipeline
	// ---------------------------------------------------------------------------

	function updateChart(tasks) {
		// Single render pipeline that handles both initial render and redraws.
		// This keeps all updates in one place to avoid drift between gantt()
		// and gantt.redraw(), and ensures all dependent elements stay in sync.
		currentTasks = tasks || [];
		var visibleTaskTypes = getVisibleTaskTypes();
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
		});
		axisManager.setTickFormat(tickFormat);
		axisManager.updateScales({
			xScale: xScale,
			taskTypes: visibleTaskTypes,
			rowLayout: renderRowLayout
		});

		var hadSvg = rootSvg && typeof rootSvg.empty === "function" ? !rootSvg.empty() : !!rootSvg;
		ensureSvg();
		applyZoomHandlers();

		function maybeTransition(selection) {
			// Use transitions only after the SVG exists to avoid animating
			// initial creation. This keeps first render snappy and avoids
			// confusing "from zero" animations.
			if (hadSvg && transitionDuration > 0) {
				return selection.transition().duration(transitionDuration);
			}
			return selection;
		}

		var svg = ganttChartGroup;
		var linksGroup = linkManager.ensureLinksLayer(svg);
		axisManager.ensureAxisGroups(ganttChartGroup);
		var prepared = prepareRenderData(currentTasks);

		axisManager.updateAxisLine(totalChartHeight, maybeTransition);

		var groups = updateTaskGroups(svg, prepared.bars, maybeTransition);

		axisManager.updateAxes(totalChartHeight, maybeTransition);
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
			transitionDuration: transitionDuration
		});

		return gantt;
	}
	// ---------------------------------------------------------------------------
	// Public chart API
	// ---------------------------------------------------------------------------

	function gantt(selection) {
		// Primary entry point: render with the current configuration.
		// We keep this thin so the core logic stays in updateChart().
		selection.each(function(data) {
			console.log(data);
			
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
		return gantt;
    };

    gantt.timeDomain = function(value) {
		if (!arguments.length)
			return [ timeDomainStart, timeDomainEnd ];
		timeDomainStart = +value[0], timeDomainEnd = +value[1];
		xZoomDomain = null;
		yZoomState = null;
		if (zoomBrush && brushGroup) {
			zoomBrush.clear();
			brushGroup.call(zoomBrush);
		}
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
		xZoomDomain = null;
		yZoomState = null;
		if (zoomBrush && brushGroup) {
			zoomBrush.clear();
			brushGroup.call(zoomBrush);
		}
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

	gantt.zoomEnabled = function(value) {
		if (!arguments.length)
			return zoomEnabled;
		zoomEnabled = !!value;
		return gantt;
	};

	gantt.rectZoomEnabled = function(value) {
		if (!arguments.length)
			return rectZoomEnabled;
		rectZoomEnabled = !!value;
		applyZoomHandlers();
		return gantt;
	};

	gantt.zoomIn = function() {
		zoomByFactor(1.2);
		return gantt;
	};

	gantt.zoomOut = function() {
		zoomByFactor(1 / 1.2);
		return gantt;
	};

	gantt.resetZoom = function() {
		resetZoomDomain();
		return gantt;
	};

    return gantt;
};