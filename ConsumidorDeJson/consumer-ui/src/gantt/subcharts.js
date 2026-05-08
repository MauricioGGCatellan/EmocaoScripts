export function updateSubGantts(options) {
	// Render or update nested subcharts inside expanded tasks.
	// This function is called every redraw so subcharts stay aligned
	// with the parent bar geometry and reflect the latest data.
	var groups = options.groups;
	if (!groups) return;
	var d3 = options.d3;
	var applyTransition = (typeof options.maybeTransition === "function")
		? options.maybeTransition
		: function(selection) { return selection; };
	var annotateParents = options.annotateParents;
	var subKey = options.subKey;
	var isSubtaskClickTarget = options.isSubtaskClickTarget;
	var collapseAll = options.collapseAll;
	var clearFocus = options.clearFocus;
	var gantt = options.gantt;
	var currentTasks = options.currentTasks || [];
	var taskStatus = options.taskStatus || {};
	var hideUnvisitedRows = !!options.hideUnvisitedRows;
	var xAxisDistortion = !!options.xAxisDistortion;
	var subchartLines = !!options.subchartLines;
	var subchartAxisLabelsEnabled = options.subchartAxisLabelsEnabled !== false;
	var subchartAxisLinesEnabled = options.subchartAxisLinesEnabled !== false;
	var parentTickValues = options.parentTickValues || null;
	var popupCatalog = options.popupCatalog || null;
	var currentUser = options.currentUser || null;
	var transitionDuration = options.transitionDuration || 0;
	function buildSubtaskLabelFormatter(parentTaskName) {
		var prefix = String(parentTaskName || "").trim();
		var dashedPrefix = prefix ? (prefix + " - ") : "";
		return function(rawLabel) {
			var label = String(rawLabel == null ? "" : rawLabel);
			if (dashedPrefix && label.indexOf(dashedPrefix) === 0) {
				return label.slice(dashedPrefix.length).trim();
			}
			var separatorIndex = label.indexOf(" - ");
			if (separatorIndex >= 0) {
				return label.slice(separatorIndex + 3).trim();
			}
			return label;
		};
	}

	function buildAlignedTickValues(taskStart, taskEnd) {
		if (!Array.isArray(parentTickValues) || !parentTickValues.length) {
			return null;
		}
		var startMs = +taskStart;
		var endMs = +taskEnd;
		if (!isFinite(startMs) || !isFinite(endMs) || endMs <= startMs) {
			return null;
		}
		var seen = {};
		var ticks = [];
		parentTickValues.forEach(function(value) {
			var ms = value instanceof Date ? +value : +value;
			if (!isFinite(ms) || ms < startMs || ms > endMs) {
				return;
			}
			var key = String(ms);
			if (seen[key]) {
				return;
			}
			seen[key] = true;
			ticks.push(new Date(ms));
		});
		return ticks.length ? ticks : null;
	}

	function applyFixedDomainFromParent(subGantt, parentTask) {
		if (!subGantt || !subGantt.timeDomain || !subGantt.timeDomainMode) {
			return;
		}
		var start = parentTask && parentTask.startDate ? new Date(+parentTask.startDate) : null;
		var end = parentTask && parentTask.endDate ? new Date(+parentTask.endDate) : null;
		var startMs = start ? +start : NaN;
		var endMs = end ? +end : NaN;
		if (isFinite(startMs) && isFinite(endMs) && endMs > startMs) {
			subGantt.timeDomain([ start, end ]);
			subGantt.timeDomainMode("fixed");
			return;
		}
		subGantt.timeDomainMode("fit");
	}

	function hasQuestionSubtasks(list) {
		var found = false;
		function scan(tasks) {
			(tasks || []).forEach(function(task) {
				if (found || !task) return;
				var status = String(task.status || "").toUpperCase();
				var isQuestion = status === "PERGUNTA";
				var correctList = Array.isArray(task.correctAlternative)
					? task.correctAlternative
					: [ task.correctAlternative ];
				var hasExplicitCorrect = correctList.some(function(value) {
					return typeof value === "number" && isFinite(value);
				});
				var hasOutcome = hasExplicitCorrect || (isQuestion && typeof task.selectedAlternative === "number");
				if (hasOutcome) {
					found = true;
					return;
				}
				if (task.subtasks && task.subtasks.length) {
					scan(task.subtasks);
				}
			});
		}
		scan(list);
		return found;
	}

	groups.each(function(bar) {
		// Each task group may own a subchart configuration (bar.subchart).
		// We use a 0/1 data join so the foreignObject exists only when needed.
		var group = d3.select(this);
		var subchart = bar.subchart || null;

		var fo = group.selectAll("foreignObject.subgantt-container")
			.data(subchart ? [subchart] : [], function(d) { return d.key; });

		fo.exit().remove();

		fo.enter()
			.insert("foreignObject", "g.task-info-icon")
			.attr("class", "subgantt-container");

		var all = group.selectAll("foreignObject.subgantt-container");
		all.each(function(subchartData) {
			// Normalize subtask parent references so nested charts can resolve
			// base tasks and depth when they render.
			var subtaskRoot = subchartData.task;
			annotateParents(subtaskRoot.subtasks, subtaskRoot, false);

			var containerW = subchartData.containerW;
			var containerH = subchartData.containerH;
			if (containerW <= 0 || containerH <= 0) {
				// Avoid rendering when the container has no space.
				// This keeps layout stable during transitions and prevents
				// rendering an off-screen subchart.
				d3.select(this).style("display", "none");
				return;
			}

			var subMargin = subchartData.subMargin;
			var innerW = subchartData.innerW;
			var targetHeight = subchartData.targetHeight;
			var subTaskNames = subchartData.subTaskNames;
			var subtaskLabelFormatter = buildSubtaskLabelFormatter(subtaskRoot.taskName);
			var alignedTickValues = buildAlignedTickValues(subtaskRoot.startDate, subtaskRoot.endDate);
			var showQuestionLegend = hasQuestionSubtasks(subtaskRoot.subtasks);

			var foNode = d3.select(this);
			foNode.style("display", null);

			if (subtaskRoot.__expanding) {
				// Hide the subchart while the parent bar expands.
				// This avoids a "jump" where the subchart is positioned for
				// the collapsed bar then animates into place.
				foNode.style("visibility", "hidden");
				foNode.style("opacity", "0");
			} else {
				foNode.style("opacity", "1");
			}

			var isNewContainer = !this.__subganttPositioned;
			if (isNewContainer) {
				// Initial placement without transition keeps the first frame correct.
				foNode
					.attr("x", 5)
					.attr("y", 5)
					.attr("width", containerW)
					.attr("height", containerH)
					.attr("data-subkey", subKey(subtaskRoot));
				this.__subganttPositioned = true;
			} else {
				// Subsequent updates can animate to follow bar geometry changes.
				applyTransition(foNode)
					.attr("x", 5)
					.attr("y", 5)
					.attr("width", containerW)
					.attr("height", containerH)
					.attr("data-subkey", subKey(subtaskRoot));
			}

			var divJoin = foNode.selectAll("div.subgantt-inner").data([ null ]);
			divJoin.enter()
				.append("xhtml:div")
				.attr("class", "subgantt-inner")
				.style("overflow-x", "hidden")
				.style("overflow-y", "auto")
				.style("cursor", "pointer");

			var subId = "subgantt-" + subchartData.key;
			divJoin
				// Size the HTML container to the foreignObject so the nested
				// chart has a predictable viewport and can scroll internally.
				.attr("id", subId)
				.style("width", containerW + "px")
				.style("height", containerH + "px")
				.style("overflow-x", "hidden")
				.style("overflow-y", "auto")
				.style("cursor", "pointer")
				.style("opacity", subtaskRoot.__expanding ? "0" : "1");

			var entry = this.__subgantt;
			if (!entry) {
				// Lazily create the nested gantt instance once per container.
				// We reuse it across redraws to avoid losing internal state.
				var subGantt = d3.gantt()
					.selector("#" + subId)
					.taskTypes(subTaskNames)
					.taskStatus(taskStatus)
					.hideUnvisitedRows(hideUnvisitedRows)
					.sceneLegendEnabled(showQuestionLegend)
					.dateBadgeEnabled(false)
					.zoomEnabled(false)
					.rowBarInset(6)
					.xAxisDistortion(xAxisDistortion)
					.chartLines(subchartLines)
					.subchartLines(subchartLines);
				if (subGantt.axisLabelsEnabled) {
					subGantt.axisLabelsEnabled(subchartAxisLabelsEnabled);
				}
				if (subGantt.axisLinesEnabled) {
					subGantt.axisLinesEnabled(subchartAxisLinesEnabled);
				}
				if (subGantt.sceneLegendMode) {
					subGantt.sceneLegendMode(showQuestionLegend ? "question-outcome" : "scene-categories");
				}
				if (subGantt.xTickValues) {
					subGantt.xTickValues(alignedTickValues);
				}
				applyFixedDomainFromParent(subGantt, subtaskRoot);
				if (subGantt.yAxisLabelFormatter) {
					subGantt.yAxisLabelFormatter(subtaskLabelFormatter);
				}
				if (subGantt.popupCatalog) {
					subGantt.popupCatalog(popupCatalog);
				}
				if (subGantt.currentUser) {
					subGantt.currentUser(currentUser);
				}
				subGantt._preserveBaseTask = true;
				entry = { gantt: subGantt };
				this.__subgantt = entry;
			}

			entry.gantt
				// Keep the nested chart in sync with the parent geometry
				// and current configuration toggles.
				.selector("#" + subId)
				.taskTypes(subTaskNames)
				.taskStatus(taskStatus)
				.hideUnvisitedRows(hideUnvisitedRows)
				.sceneLegendEnabled(showQuestionLegend)
				.dateBadgeEnabled(false)
				.margin(subMargin)
				.width(innerW)
				.height(targetHeight)
				.rowBarInset(6)
				.xAxisDistortion(xAxisDistortion)
				.chartLines(subchartLines)
				.subchartLines(subchartLines);
			if (entry.gantt.axisLabelsEnabled) {
				entry.gantt.axisLabelsEnabled(subchartAxisLabelsEnabled);
			}
			if (entry.gantt.axisLinesEnabled) {
				entry.gantt.axisLinesEnabled(subchartAxisLinesEnabled);
			}
			if (entry.gantt.sceneLegendMode) {
				entry.gantt.sceneLegendMode(showQuestionLegend ? "question-outcome" : "scene-categories");
			}
			if (entry.gantt.xTickValues) {
				entry.gantt.xTickValues(alignedTickValues);
			}
			applyFixedDomainFromParent(entry.gantt, subtaskRoot);
			if (entry.gantt.yAxisLabelFormatter) {
				entry.gantt.yAxisLabelFormatter(subtaskLabelFormatter);
			}
			if (entry.gantt.popupCatalog) {
				entry.gantt.popupCatalog(popupCatalog);
			}
			if (entry.gantt.currentUser) {
				entry.gantt.currentUser(currentUser);
			}

			if (entry.gantt.redraw) {
				// Prefer redraw() when available so the nested chart follows
				// the same update pipeline as the main chart.
				entry.gantt.redraw(subtaskRoot.subtasks);
			} else {
				entry.gantt(subtaskRoot.subtasks);
			}

			foNode.on("click", function() {
				// Clicking the empty subchart area collapses the parent task.
				// We ignore clicks on bars/icons so subchart interactions still work.
				if (isSubtaskClickTarget(d3.event.target)) return;
				d3.event.stopPropagation();
				collapseAll(subtaskRoot);
				clearFocus();
				gantt.redraw(currentTasks);
			});

			if (subtaskRoot.__expanding) {
				// Reveal the subchart after the expand transition completes.
				// This avoids showing a subchart sized for the collapsed state.
				var showDelay = transitionDuration > 0 ? transitionDuration : 0;
				var barVisible = bar.visible;
				setTimeout(function() {
					if (subtaskRoot.expanded && barVisible) {
						foNode.style("visibility", null);
						foNode.style("opacity", "1");
						foNode.select("div, xhtml\\:div").style("opacity", "1");
					}
					subtaskRoot.__expanding = false;
				}, showDelay);
			}
		});

		// Ensure the info icon sits above the subchart container so it remains clickable.
		var iconNode = group.select("g.task-info-icon").node();
		if (iconNode && iconNode.parentNode) {
			iconNode.parentNode.appendChild(iconNode);
		}
	});
}
