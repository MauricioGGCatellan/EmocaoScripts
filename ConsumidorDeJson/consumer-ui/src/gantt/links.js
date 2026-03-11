function createLinksLayerManager(d3) {
	var linksLayer = null;

	function linkPath(d) {
		var xOffset = Math.min(40, (d.x2 - d.x1) / 2);
		return "M" + d.x1 + "," + d.y1 +
			" C" + (d.x1 + xOffset) + "," + d.y1 +
			" " + (d.x2 - xOffset) + "," + d.y2 +
			" " + d.x2 + "," + d.y2;
	}

	function ensureLinksLayer(svg) {
		if (!linksLayer) {
			linksLayer = svg.append("g")
				.attr("class", "links-layer")
				.style("pointer-events", "none");
		}
		return linksLayer;
	}

	function bringLinksToFront() {
		if (!linksLayer) return;
		var node = (linksLayer.node && linksLayer.node()) || (linksLayer[0] && linksLayer[0][0]);
		if (node && node.parentNode) {
			node.parentNode.appendChild(node);
		}
	}

	function updateLinks(params) {
		var linksGroup = params.linksGroup;
		var tasks = params.tasks || [];
		var x = params.x;
		var rowLayout = params.rowLayout || {};
		var chartLines = !!params.chartLines;
		var maybeTransition = params.maybeTransition || function(selection) { return selection; };
		var hadSvg = !!params.hadSvg;

		if (!linksGroup || !chartLines) {
			if (linksGroup) {
				linksGroup.selectAll(".link-path").remove();
			}
			return;
		}

		var lineData = [];
		for (var i = 0; i < tasks.length - 1; i++) {
			var curr = tasks[i];
			var next = tasks[i + 1];
			var rowCurr = rowLayout[curr.taskName];
			var rowNext = rowLayout[next.taskName];
			if (!rowCurr || !rowNext) continue;

			lineData.push({
				x1: x(curr.endDate),
				y1: rowCurr.y + rowCurr.height / 2,
				x2: x(next.startDate),
				y2: rowNext.y + rowNext.height / 2
			});
		}

		var links = linksGroup.selectAll(".link-path").data(lineData);
		links.exit().remove();

		var linksEnter = links.enter()
			.append("path")
			.attr("class", "link-path")
			.attr("stroke", "blue")
			.attr("stroke-width", 3)
			.attr("fill", "none")
			.attr("d", linkPath);

		maybeTransition(links).attr("d", linkPath);
		if (!hadSvg) {
			linksEnter.attr("d", linkPath);
		}
	}

	return {
		ensureLinksLayer: ensureLinksLayer,
		bringLinksToFront: bringLinksToFront,
		updateLinks: updateLinks
	};
}