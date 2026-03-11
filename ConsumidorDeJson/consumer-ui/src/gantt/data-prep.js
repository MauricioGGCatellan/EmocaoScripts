// Normalize a single task object into the exact shape the chart expects.
// We do this once up front so the render layer can assume consistent fields
// (Date objects, taskName, status, expanded flag, and a real subtasks array).
// This avoids repeated defensive checks scattered across rendering code.
function normalizeTask(task) {
	var normalized = {};
	Object.keys(task || {}).forEach(function(key) {
		if (key !== "subtasks") {
			normalized[key] = task[key];
		}
	});
	normalized.startDate = new Date(task.startDate);
	normalized.endDate = new Date(task.endDate);
	normalized.taskName = task.taskName || "";
	normalized.status = task.status || "";
	normalized.expanded = false;
	var subtasks = task.subtasks;
	// Preserve subtask layout metadata (row order/statuses) if provided.
	// JSON subtasks are always shaped as { layout, tasks }.
	var subtaskLayout = null;
	var subList = [];
	if (subtasks && Array.isArray(subtasks.tasks)) {
		subList = subtasks.tasks;
		subtaskLayout = subtasks.layout || null;
	}
	normalized.subtaskLayout = subtaskLayout;
	normalized.subtasks = subList.map(normalizeTask); // recursion to normalize the subtasks as well
	return normalized;
}

// Normalize an entire task list (top-level tasks only).
// Returning an empty array for invalid inputs keeps callers simple and avoids
// crashes when JSON is missing or malformed.
function normalizeTaskList(list) {
	if (!Array.isArray(list)) {
		return [];
	}
	return list.map(normalizeTask);
}

// Map each status string to a CSS class name representing a color bucket.
// We assume the JSON-provided statuses list is complete, so we don't scan
// the tasks for unknown statuses.
// Create a simple status -> color-class map using the provided status list.
function mapStatusColors(declared, classPool) {
	var order = Array.isArray(declared) ? declared : [];
	var mapping = {};
	var pool = Array.isArray(classPool) && classPool.length ? classPool : [ "bar" ];
	order.forEach(function(status, index) {
		mapping[status] = pool[index % pool.length];
	});
	return mapping;
}

// Determine which row labels should appear on the chart and in what order.
// We assume the JSON-provided row list is complete, so we only filter it
// when the user wants to hide unvisited rows.
function defineRowOrder(list, scenes, hideUnvisited) {
	var visited = {};
	list.forEach(function(task) {
		if (task.taskName) {
			visited[task.taskName] = true;
		}
	});
	var rows = Array.isArray(scenes) ? scenes : [];
	if (!hideUnvisited) {
		return rows.slice();
	}
	return rows.filter(function(row) {
		return !!visited[row];
	});
}

// Read the full JSON payload and split it into ready-to-use pieces for the UI:
// normalized tasks, row order, status order, and user metadata.
// This keeps the rest of the app focused on rendering rather than parsing.
function readJsonFile(data) {
	var payload = data && data.tasks ? data.tasks : data;
	var tasks = normalizeTaskList(payload || []);
	var scenesOrder = data && data.layout && Array.isArray(data.layout.rowOrder)
		? data.layout.rowOrder
		: (data && Array.isArray(data.rowOrder) ? data.rowOrder : []);
	var statusOrder = data && data.layout && Array.isArray(data.layout.statuses)
		? data.layout.statuses
		: (data && Array.isArray(data.statuses) ? data.statuses : []);
	var userInfo = data && data.user ? data.user : null;
	return {
		tasks: tasks,
		scenesOrder: scenesOrder,
		statusOrder: statusOrder,
		userInfo: userInfo
	};
}