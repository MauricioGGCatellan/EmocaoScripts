// Popup factory that returns a small, focused API for the chart.
// We keep construction and update logic inside this module so the chart only
// needs to call showInfoTooltip(task) without worrying about DOM details.
// "deps" allows injecting helpers (like getBaseTask) and a document reference,
// which makes the module more testable and avoids hard-coding globals.
 
function createInfoModal(deps) {
	var getBaseTask = deps && deps.getBaseTask ? deps.getBaseTask : function(task) { return task; };
	var doc = deps && deps.document ? deps.document : document; 
	var getAllStatus = deps && deps.getAllStatus ? deps.getAllStatus : function(){return null;};

	// Modal UI for task details (kept outside SVG for easier layout).
	// We keep references to the top-level nodes only; individual fields are
	// queried on demand
	var infoModal = null;
	var infoBackdrop = null;
	var resizeBound = false;
	var currentTemplateKey = null;
	var currentBaseTask = null;
	var emoImages = {happy: "/assets/feliz.jpg",
		sad: "/assets/triste.png",
		fear: "/assets/medo.png",
		neutral: "/assets/neutro.png",
		disgust: "/assets/nojo.png",
		angry: "/assets/raiva.jpg"
	}

	// Apply multiple inline styles in one call.
	// This keeps element creation readable and ensures the popup can be fully
	// styled without relying on external CSS ordering or bundler timing.
	function setStyles(el, styles) {
		if (!el || !styles) return;
		Object.keys(styles).forEach(function(key) {
			el.style[key] = styles[key];
		});
	}

	// Small DOM factory to reduce repeated boilerplate.
	// We centralize class/text assignment so the markup structure is obvious
	// when scanning the popup builder below.
	function createEl(tag, className, text) {
		var el = doc.createElement(tag);
		if (className) {
			el.className = className;
		}
		if (text !== undefined) {
			el.textContent = text;
		}
		return el;
	}

	// Merge style objects without mutating the originals.
	function mergeStyles(base, overrides) {
		var merged = {};
		Object.keys(base || {}).forEach(function(key) {
			merged[key] = base[key];
		});
		Object.keys(overrides || {}).forEach(function(key) {
			merged[key] = overrides[key];
		});
		return merged;
	}

	var baseBoxStyles = {
		width: "100%",
		boxSizing: "border-box",
		height: "100%",
		minHeight: "54px",
		padding: "14px",
		border: "1px solid rgba(0, 0, 0, 0.2)",
		borderRadius: "12px",
		background: "rgba(0, 0, 0, 0.03)",
		textAlign: "center",
		display: "flex",
		flexDirection: "column",
		justifyContent: "center"
	};

	var baseValueStyles = { font: "20px Arial, sans-serif" };
	var baseLabelStyles = {
		font: "14px Arial, sans-serif",
		textTransform: "uppercase",
		color: "rgba(0, 0, 0, 0.6)"
	};
	var baseBodyStyles = { font: "16px Arial, sans-serif" };
	var baseGridStyles = {
		display: "grid",
		gridTemplateColumns: "248px 292px 225px",
		gridAutoRows: "minmax(54px, 1fr)",
		columnGap: "40px",
		rowGap: "18px",
		padding: "9px 30px 30px",
		alignItems: "stretch",
		justifyContent: "stretch",
		alignContent: "stretch",
		width: "100%",
		height: "100%",
		boxSizing: "border-box"
	};

	function createBox(grid, className, styles) {
		var box = createEl("div", "task-info-box " + className);
		setStyles(box, mergeStyles(baseBoxStyles, styles));
		grid.appendChild(box);
		return box;
	}

	function createBoxTemplate(grid, config) {
		var box = createBox(grid, config.className || "", config.styles);
		(config.elements || []).forEach(function(def) {
			var el = createEl(def.tag || "div", def.className || "", def.text);
			if (def.styles) {
				setStyles(el, def.styles);
			}
			if (def.attrs) {
				Object.keys(def.attrs).forEach(function(key) {
					el.setAttribute(key, def.attrs[key]);
				});
			}
			box.appendChild(el);
		});
		return box;
	}

	function getPopupTemplateKey(task) {
		// INSERT HERE: only need to add the base status 
		var baseTask = getBaseTask(task);
		var target = baseTask || task;

		if (target && target.status === "MINIGAME") {
			return "minigame";
		}

		if (target && target.status === "CENA") {
			return "cena";
		}

		const emocoes = ['fear', 'sad','happy', 'disgust', 'surprise', 'angry', 'neutral']
		const emocoesPt = ['medo', 'triste', 'feliz', 'nojo', 'surpresa', 'raiva', 'neutro']
		if(target && (emocoes.includes(target.status) || emocoesPt.includes(target.status))){
			return "emocao";
		}

		return "default";
	}

	function buildPopupShell() {
		infoBackdrop = createEl("div", "task-info-backdrop");
		setStyles(infoBackdrop, {
			position: "fixed",
			left: "0",
			top: "0",
			width: "100%",
			height: "100%",
			background: "rgba(0, 0, 0, 0.35)",
			display: "none",
			zIndex: 999
		});
		doc.body.appendChild(infoBackdrop);

		infoModal = createEl("div", "task-info-modal");
		setStyles(infoModal, {
			position: "fixed",
			display: "none",
			left: "10vw",
			top: "10vh",
			width: "80vw",
			height: "80vh",
			maxWidth: "none",
			maxHeight: "none",
			boxSizing: "border-box",
			padding: "20px",
			background: "#ffffff",
			border: "2px solid rgba(0, 0, 0, 0.25)",
			borderRadius: "16px",
			boxShadow: "0 10px 30px rgba(0, 0, 0, 0.35)",
			font: "22px Arial, sans-serif",
			color: "#1a1a1a",
			textAlign: "center",
			zIndex: 1000
		});
		doc.body.appendChild(infoModal);

		var closeButton = createEl("button", "task-info-close", "X");
		closeButton.type = "button";
		setStyles(closeButton, {
			position: "absolute",
			top: "10px",
			right: "12px",
			background: "transparent",
			border: "none",
			font: "18px Arial, sans-serif",
			color: "#000000",
			cursor: "pointer"
		});
		infoModal.appendChild(closeButton);

		var title = createEl("div", "task-info-title");
		setStyles(title, {
			padding: "8px 40px 4px",
			fontWeight: "bold",
			textAlign: "center"
		});
		infoModal.appendChild(title);

		var grid = createEl("div", "task-info-grid");
		infoModal.appendChild(grid);

		return grid;
	}

	function getPopupTemplates() {
		// INSERT HERE: add new popup types (gridStyles + buildContent + updateContent) in this map.
		return {
			cena: {
				gridStyles: {
					gridTemplateRows: "repeat(6, minmax(54px, 1fr))"
				},
				buildContent: function(grid) {
					// INSERT HERE: add new box templates for the "cena" popup.
					// Box template fields:
					// - className: extra class(es) for the box container
					// - styles: inline style overrides for the box
					// - elements: array of child definitions:
					//   - tag: element tag name (defaults to "div")
					//   - className: class(es) for the child
					//   - text: textContent for the child
					//   - styles: inline styles for the child
					//   - attrs: attributes map (e.g., { "data-id": "..." })
					createBoxTemplate(grid, {
						className: "task-info-duration",
						styles: {
							gridColumn: "1",
							gridRow: "1"
						},
						elements: [
							{ className: "task-info-value", styles: baseValueStyles },
							{ className: "task-info-label", text: "Tempo total", styles: baseLabelStyles }
						]
					});

					createBoxTemplate(grid, {
						className: "task-info-current-subtask",
						styles: {
							gridColumn: "2",
							gridRow: "1",
							justifySelf: "stretch",
							alignSelf: "stretch",
							display: "none"
						},
						elements: [
							{ className: "task-info-value", styles: baseValueStyles },
							{ className: "task-info-label", text: "Tempo de permanencia no dialogo", styles: baseLabelStyles }
						]
					});

					createBoxTemplate(grid, {
						className: "task-info-subtask-selector",
						styles: {
							gridColumn: "3",
							gridRow: "1",
							justifySelf: "stretch",
							padding: "11px 14px",
							display: "none",
							alignItems: "stretch",
							gap: "8px"
						},
						elements: [
							{ className: "task-info-label", text: "Selecionar dialogo", styles: baseLabelStyles },
							{
								tag: "select",
								className: "task-info-subtask-select",
								styles: {
									width: "100%",
									padding: "7px 9px",
									borderRadius: "8px",
									border: "1px solid rgba(0, 0, 0, 0.2)",
									font: "16px Arial, sans-serif"
								}
							}
						]
					});

					createBoxTemplate(grid, {
						className: "task-info-subtasks",
						styles: {
							gridColumn: "2",
							gridRow: "2"
						},
						elements: [
							{ className: "task-info-value", styles: baseValueStyles },
							{ className: "task-info-label", text: "Dialogos", styles: baseLabelStyles }
						]
					});

					createBoxTemplate(grid, {
						className: "task-info-question",
						styles: {
							gridColumn: "1",
							gridRow: "2",
							background: "#f6d84a"
						},
						elements: [
							{ className: "task-info-question-title", text: "Pergunta:", styles: mergeStyles(baseLabelStyles, { color: "rgba(0, 0, 0, 0.7)" }) },
							{ className: "task-info-question-text", styles: mergeStyles(baseBodyStyles, { marginTop: "4px" }) }
						]
					});

					var imageBox = createEl("div", "task-info-box task-info-image", "Imagem (placeholder)");
					setStyles(imageBox, {
						gridColumn: "2 / span 2",
						gridRow: "3 / span 3",
						justifySelf: "stretch",
						width: "100%",
						boxSizing: "border-box",
						height: "100%",
						minHeight: "200px",
						padding: "14px",
						border: "2px dashed rgba(0, 0, 0, 0.2)",
						borderRadius: "12px",
						background: "rgba(0, 0, 0, 0.02)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						textAlign: "center",
						color: "rgba(0, 0, 0, 0.45)",
						font: "14px Arial, sans-serif"
					});
					grid.appendChild(imageBox);
				},
				updateContent: function(context) {
					var task = context.task || null;
					var selectedSubtask = context.selectedSubtask || (task && task.__parentTask ? task : null);
					var baseTask = context.baseTask || getBaseTask(task);
					var start = baseTask && baseTask.startDate ? baseTask.startDate : null;
					var end = baseTask && baseTask.endDate ? baseTask.endDate : null;
					var durationMs = start && end ? Math.max(0, end - start) : 0;
					var subtaskCount = countSubtasks(baseTask);
					var subtasks = getSubtaskList(baseTask);
					var firstSubtask = subtasks.length ? subtasks[0] : null;
					var activeTextTask = selectedSubtask || firstSubtask || baseTask;

					currentBaseTask = baseTask;

					var title = infoModal.querySelector(".task-info-title");
					var durationValue = infoModal.querySelector(".task-info-duration .task-info-value");
					var subtaskValue = infoModal.querySelector(".task-info-subtasks .task-info-value");
					var currentSubtaskBox = infoModal.querySelector(".task-info-current-subtask");
					if (title) {
						title.textContent = baseTask && baseTask.taskName ? baseTask.taskName : ""; 
					}
					if (durationValue) {
						durationValue.textContent = formatDuration(durationMs); 
						durationValue.textContent += baseTask.status; 
					}
					if (subtaskValue) {
						subtaskValue.textContent = subtaskCount; 
					}
					if (currentSubtaskBox) {
						currentSubtaskBox.style.display = firstSubtask ? "flex" : "none"; 
					}

					updateSelectedSubtaskDuration(selectedSubtask || firstSubtask);
					updateQuestionText(activeTextTask);
					updateAlternatives(activeTextTask);
					updateOptionMarkers(activeTextTask ? activeTextTask.selectedAlternative : null);
					updateSelector(subtasks, selectedSubtask);
				}
			},
			minigame: {
				gridStyles: {
					gridTemplateColumns: "1fr 1fr 1fr",
					gridAutoRows: "minmax(70px, 1fr)",
					columnGap: "20px",
					rowGap: "20px"
				},
				buildContent: function(grid) {
					// INSERT HERE: add new box templates for the "minigame" popup.
					createBoxTemplate(grid, {
						className: "task-info-duration",
						styles: { gridColumn: "1", gridRow: "1" },
						elements: [
							{ className: "task-info-value", styles: baseValueStyles },
							{ className: "task-info-label", text: "Tempo total", styles: baseLabelStyles }
						]
					});
					createBoxTemplate(grid, {
						className: "task-info-subtasks",
						styles: { gridColumn: "2", gridRow: "1" },
						elements: [
							{ className: "task-info-value", styles: baseValueStyles },
							{ className: "task-info-label", text: "Dialogos", styles: baseLabelStyles }
						]
					});
				},
				updateContent: function(context) {
					// placeholder for minigame-specific updates


				}
			}
			,
			emocao: {
				gridStyles: {
					gridTemplateRows: "repeat(6, minmax(54px, max-content))"
				},
				buildContent: function(grid) {
					// INSERT HERE: add new box templates for the "cena" popup.
					// Box template fields:
					// - className: extra class(es) for the box container
					// - styles: inline style overrides for the box
					// - elements: array of child definitions:
					//   - tag: element tag name (defaults to "div")
					//   - className: class(es) for the child
					//   - text: textContent for the child
					//   - styles: inline styles for the child
					//   - attrs: attributes map (e.g., { "data-id": "..." })
					createBoxTemplate(grid, {
						className: "task-info-duration",
						styles: {
							gridColumn: "1",
							gridRow: "1"
						},
						elements: [
							{ className: "task-info-value", styles: baseValueStyles },
							{ className: "task-info-label", text: "Tempo total", styles: baseLabelStyles }
						]
					});

					createBoxTemplate(grid, {
						className: "task-info-current-subtask",
						styles: {
							gridColumn: "2",
							gridRow: "1",
							justifySelf: "stretch",
							alignSelf: "stretch",
							display: "none"
						},
						elements: [
							{ className: "task-info-value", styles: baseValueStyles },
							{ className: "task-info-label", text: "Tempo de permanencia no dialogo", styles: baseLabelStyles }
						]
					});

					createBoxTemplate(grid, {
						className: "task-info-subtask-selector",
						styles: {
							gridColumn: "3",
							gridRow: "1",
							justifySelf: "stretch",
							padding: "11px 14px",
							display: "none",
							alignItems: "stretch",
							gap: "8px"
						},
						elements: [
							{ className: "task-info-label", text: "Selecionar dialogo", styles: baseLabelStyles },
							{
								tag: "select",
								className: "task-info-subtask-select",
								styles: {
									width: "100%",
									padding: "7px 9px",
									borderRadius: "8px",
									border: "1px solid rgba(0, 0, 0, 0.2)",
									font: "16px Arial, sans-serif"
								}
							}
						]
					});

					createBoxTemplate(grid, {
						className: "task-info-subtasks",
						styles: {
							gridColumn: "2",
							gridRow: "2"
						},
						elements: [
							{ className: "task-info-value", styles: baseValueStyles },
							{ className: "task-info-label", text: "Dialogos", styles: baseLabelStyles }
						]
					});

					createBoxTemplate(grid, {
						className: "task-info-question",
						styles: {
							gridColumn: "1",
							gridRow: "2",
							background: "#f6d84a"
						},
						elements: [
							{ className: "task-info-question-title", text: "Todas as emoções:", styles: mergeStyles(baseLabelStyles, { color: "rgba(0, 0, 0, 0.7)" }) },
							{ className: "task-info-question-text", styles: mergeStyles(baseBodyStyles, { marginTop: "4px" }) }
						]
					});

					createBoxTemplate(grid, {
						className: "task-info-status",
						styles: {
							gridColumn: "2 / span 2",
							gridRow: "6",
							justifySelf: "stretch",
							alignSelf: "stretch"
						},
						elements: [
							{ className: "task-info-value", styles: baseValueStyles },
							{ className: "task-info-label", text: "Status", styles: baseLabelStyles }
						]
					});
 
					
					createBoxTemplate(grid, { 
						className: "task-info-status-text", 
						styles: mergeStyles(baseBodyStyles, { 
							gridColumn: "1",
							gridRow: "3", 
							gap: "6px",
							width: "100%", 
							display: "flex",
							flexWrap: "wrap",
							flexDirection: "row",	
							minHeight: 0,
							backgroundColor: "white",
							borderColor: "white"
						}) 
					}); 

					var imageBox = createEl("div", "task-info-box task-info-image", "");
					//emoImages
					setStyles(imageBox, {
						gridColumn: "2 / span 2",
						gridRow: "3 / span 3",

						alignSelf: "start",
						justifySelf: "start" ,
						width: "100%",
						boxSizing: "border-box",
						//height: "100%", 
						//minHeight: "200px",
						maxHeight: "200px", 
						padding: "14px",
						border: "2px dashed rgba(0, 0, 0, 0.2)",
						borderRadius: "12px",
						background: "rgba(0, 0, 0, 0.02)",
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						textAlign: "center",
						color: "rgba(0, 0, 0, 0.45)",
						font: "14px Arial, sans-serif"
					});

				var img = createEl("img", "task-info-image-content");

				setStyles(img, {
					maxWidth: "100%",
					maxHeight: "190px",
					width: "auto",
					height: "auto",
					objectFit: "contain",
					borderRadius: "8px"
				});

				imageBox.appendChild(img);
				grid.appendChild(imageBox);
					grid.appendChild(imageBox);
				},
				updateContent: function(context) {
					// placeholder for default popup updates
					
					var task = context.task || null;
					var selectedSubtask = context.selectedSubtask || (task && task.__parentTask ? task : null);
					var baseTask = context.baseTask || getBaseTask(task);
					var start = baseTask && baseTask.startDate ? baseTask.startDate : null;
					var end = baseTask && baseTask.endDate ? baseTask.endDate : null;
					var durationMs = start && end ? Math.max(0, end - start) : 0;
					var subtaskCount = countSubtasks(baseTask);
					var subtasks = getSubtaskList(baseTask);
					var firstSubtask = subtasks.length ? subtasks[0] : null;
					var activeTextTask = selectedSubtask || firstSubtask || baseTask;

					currentBaseTask = baseTask;

					var title = infoModal.querySelector(".task-info-title");
					var durationValue = infoModal.querySelector(".task-info-duration .task-info-value");
					var subtaskValue = infoModal.querySelector(".task-info-subtasks .task-info-value");
					var currentSubtaskBox = infoModal.querySelector(".task-info-current-subtask");
					var statusValue = infoModal.querySelector(".task-info-status .task-info-value");
					var emotionsContainer  = infoModal.querySelector(".task-info-status-text");
					var imageContainer = infoModal.querySelector(".task-info-image-content")
					let emotionsObj = getAllStatus(); 
					const emotionTranslations = {
						"fear": "medo",
						"sad": "triste",
						"neutral": "neutro",
						"happy": "feliz",
						"surprise": "surpresa",
						"disgust": "nojo",
						"angry": "raiva"
					}
					if (emotionsObj && typeof emotionsObj === "object") {
						
						//imageContainer.style.backgroundImage = `url(${emoImages[task.status]})`;
						//imageContainer.style.backgroundSize = "cover";
						//imageContainer.style.backgroundPosition = "center";
						
						Object.keys(emotionsObj).forEach(function(emotion) {

							var box = createEl("div", "task-info-emotion-box", emotionTranslations[emotion] || emotion);
							let color = "white"

							if(emotion == task.status){
								color = "#f6d84a"
							}
							// estilos básicos (ajuste depois via CSS se quiser)
							setStyles(box, {
								padding: "6px 10px",
								borderRadius: "8px", 
								font: "13px Arial, sans-serif",
								display: "flex", 
								marginTop: "4px",
								width: "100%",
								alignContent: "flex-start",
								backgroundColor: color
							});

							emotionsContainer.appendChild(box);
					});
					} else {
							emotionsContainer.textContent = "Nenhuma emoção detectada";
					} 

					if (statusValue) {
						statusValue.textContent = task && task.status ? emotionTranslations[task.status] || task.status : "N/A";

						console.log(imageContainer)
						imageContainer.src = emoImages[task.status];
					}
					if (title) {
						title.textContent = baseTask && baseTask.taskName ? baseTask.taskName : "";
					}
					if (durationValue) {
						durationValue.textContent =  formatDuration(durationMs);
					}
					if (subtaskValue) {
						subtaskValue.textContent = subtaskCount;
					}
					if (currentSubtaskBox) {
						currentSubtaskBox.style.display = firstSubtask ? "flex" : "none";
					}

					updateSelectedSubtaskDuration(selectedSubtask || firstSubtask);
					updateQuestionText(activeTextTask);
					updateAlternatives(activeTextTask);
					updateOptionMarkers(activeTextTask ? activeTextTask.selectedAlternative : null);
					updateSelector(subtasks, selectedSubtask);
				}
			},
			default: {
				gridStyles: {
					gridTemplateColumns: "248px 292px 225px",
					gridAutoRows: "minmax(54px, 1fr)"
				},
				buildContent: function(grid) {
					createBoxTemplate(grid, {
						className: "task-info-duration",
						styles: { gridColumn: "1", gridRow: "1" },
						elements: [
							{ className: "task-info-value", styles: baseValueStyles },
							{ className: "task-info-label", text: "ERRO", styles: baseLabelStyles }
						]
					});
				},
				updateContent: function(context) {
					// placeholder for default popup updates
				}
			}
		};
	}

	// Size the modal using viewport units so it stays responsive across screens.
	// We set left/right/top/bottom instead of width/height so the browser keeps the
	// box centered and proportional even when the viewport changes. This approach
	// also avoids reflowing the SVG chart underneath, because the modal is fixed
	// and does not participate in the document flow.
	function definePopupTotalSize() {
		if (!infoModal) return;
		var sizePercent = 80;
		var insetW = (100 - sizePercent) / 2;
		var insetH = (100 - sizePercent) / 2;
		infoModal.style.setProperty("left", insetW + "vw");
		infoModal.style.setProperty("right", insetW + "vw");
		infoModal.style.setProperty("top", insetH + "vh");
		infoModal.style.setProperty("bottom", insetH + "vh");
		infoModal.style.setProperty("box-sizing", "border-box");
	}

	// Bind a single resize listener that only recomputes layout when visible.
	// This keeps the popup responsive without doing unnecessary work while hidden.
	function addResizeListener() {
		if (resizeBound) return;
		resizeBound = true;
		window.addEventListener("resize", function() {
			if (!infoModal) return;
			if (infoModal.style.display === "block") {
				ResizePopup();
			}
		});
	}

	// Handle dropdown changes by looking up the selected subtask.
	// We store the subtask list on the <select> node so the handler can stay
	// stateless and avoid extra global variables.
	function onSubtaskChange(event) {
		var selectNode = event && event.target ? event.target : null;
		if (!selectNode) return;
		var subtasks = selectNode.__subtasks || [];
		var index = parseInt(selectNode.value, 10);
		var selected = subtasks[index];
		applyTemplateUpdate(currentTemplateKey, {
			task: currentBaseTask || selected,
			selectedSubtask: selected
		});
	}

	// Attach event handlers once and mark them to avoid duplicates.
	// This makes repeated calls to createPopupDOM() safe and prevents
	// multiple listeners stacking up across opens.
	function addButtonListeners() {
		if (!infoModal || !infoBackdrop) return;
		var closeButton = infoModal.querySelector(".task-info-close");
		if (closeButton && !closeButton.__bound) {
			closeButton.addEventListener("click", hideInfoTooltip);
			closeButton.__bound = true;
		}
		if (!infoBackdrop.__bound) {
			infoBackdrop.addEventListener("click", hideInfoTooltip);
			infoBackdrop.__bound = true;
		}
		var select = infoModal.querySelector(".task-info-subtask-select");
		if (select && !select.__bound) {
			select.addEventListener("change", onSubtaskChange);
			select.__bound = true;
		}
	}

	// Create (or reuse) the info modal once at the body level.
	// We also reuse an existing modal if it already exists, which keeps hot reloads
	// and multiple chart instances from creating duplicate DOM nodes.
	function createPopupDOM(templateKey) {
		var templates = getPopupTemplates();
		var selectedKey = templates[templateKey] ? templateKey : "default";
		var template = templates[selectedKey];
		var grid = null;

		if (!infoModal) {
			var existingModal = doc.querySelector(".task-info-modal");
			if (existingModal) {
				infoModal = existingModal;
			}
		}
		if (!infoBackdrop) {
			var existingBackdrop = doc.querySelector(".task-info-backdrop");
			if (existingBackdrop) {
				infoBackdrop = existingBackdrop;
			}
		}

		if (!infoModal || !infoBackdrop) {
			grid = buildPopupShell();
		} else {
			var hasTitle = infoModal.querySelector(".task-info-title");
			var hasClose = infoModal.querySelector(".task-info-close");
			grid = infoModal.querySelector(".task-info-grid");
			if (!hasTitle || !hasClose || !grid) {
				if (infoModal.parentNode) {
					infoModal.parentNode.removeChild(infoModal);
				}
				if (infoBackdrop.parentNode) {
					infoBackdrop.parentNode.removeChild(infoBackdrop);
				}
				infoModal = null;
				infoBackdrop = null;
				grid = buildPopupShell();
			}
		}

		if (grid) {
			var gridExtras = (template && template.gridStyles) ? template.gridStyles : null;
			while (grid.firstChild) {
				grid.removeChild(grid.firstChild);
			}
			setStyles(grid, mergeStyles(baseGridStyles, gridExtras || {}));
		}

		if (template && grid) {
			template.buildContent(grid);
		}
		addButtonListeners();
		addResizeListener();
		definePopupTotalSize();
	}

	// Convert a millisecond duration into a human-readable label.
	// This is UI-focused formatting (minutes/seconds for short spans, hours/minutes
	// for long spans) so users can scan the values without doing mental math.
	function formatDuration(milliseconds) {
		var totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
		var totalMinutes = Math.floor(totalSeconds / 60);
		var seconds = totalSeconds % 60;
		if (totalMinutes >= 60) {
			var hours = Math.floor(totalMinutes / 60);
			var minutes = totalMinutes % 60;
			return hours + " horas e " + minutes + " minutos";
		}
		return totalMinutes + " minutos e " + seconds + " segundos";
	}

	// Count nested subtasks to show dialog totals.
	// We walk the full tree so the count reflects every nested dialog, not just
	// the immediate children of a task. This matches how users expect totals to work.
	function countSubtasks(task) {
		var list = getSubtaskList(task);
		if (!list.length) return 0;
		var count = list.length;
		list.forEach(function(subtask) {
			count += countSubtasks(subtask);
		});
		return count;
	}

	function getSubtaskList(task) {
		if (!task) return [];
		var sub = task.subtasks;
		if (Array.isArray(sub)) {
			return sub;
		}
		if (sub && Array.isArray(sub.tasks)) {
			return sub.tasks;
		}
		return [];
	}

	// Update the "selected dialog" duration field.
	// This is separated from showInfoTooltip() so both initial render and
	// dropdown changes share the same formatting logic.
	function updateSelectedSubtaskDuration(subtask) {
		if (!infoModal) return;
		var currentSubtaskValue = infoModal.querySelector(".task-info-current-subtask .task-info-value");
		if (!currentSubtaskValue) return;
		var start = subtask && subtask.startDate ? subtask.startDate : null;
		var end = subtask && subtask.endDate ? subtask.endDate : null;
		var durationMs = start && end ? Math.max(0, end - start) : 0;
		currentSubtaskValue.textContent = subtask ? formatDuration(durationMs) : "";
	}

	function updateQuestionText(task) {
		if (!infoModal) return;
		var questionText = infoModal.querySelector(".task-info-question-text");
		if (!questionText) return;
		questionText.textContent = task && task.text ? task.text : "";
	}

	function updateOptionMarkers(selectedAlternative) {
		if (!infoModal) return;
		var options = Array.prototype.slice.call(infoModal.querySelectorAll(".task-info-option"));
		if (!options.length) return;

		var selected = typeof selectedAlternative === "number" ? [selectedAlternative] : [];

		options.forEach(function(optionEl, index) {
			var selectedMarker = optionEl.querySelector(".task-info-option-selected");
			var isSelected = !!(selected && selected.indexOf(index) !== -1);
			if (selectedMarker) {
				selectedMarker.style.display = isSelected ? "block" : "none";
			}
			optionEl.classList.toggle("is-selected", isSelected);
		});
	}

	function updateSelector(subtasks, selectedSubtask) {
		if (!infoModal) return;
		var selectorBox = infoModal.querySelector(".task-info-subtask-selector");
		var select = infoModal.querySelector(".task-info-subtask-select");
		if (selectorBox) {
			selectorBox.style.display = subtasks && subtasks.length ? "flex" : "none";
		}
		if (!select) return;
		select.innerHTML = "";
		(subtasks || []).forEach(function(subtask, index) {
			var option = createEl("option", null, subtask.taskName ? subtask.taskName : ("Dialogo " + (index + 1)));
			option.value = String(index);
			select.appendChild(option);
		});
		var selectedIndex = 0;
		if (selectedSubtask && subtasks && subtasks.length) {
			selectedIndex = subtasks.indexOf(selectedSubtask);
			if (selectedIndex < 0) {
				selectedIndex = 0;
			}
		}
		select.value = (subtasks && subtasks.length) ? String(selectedIndex) : "";
		select.__subtasks = subtasks || [];
	}

	function updateAlternatives(task) {
		if (!infoModal) return;
		var grid = infoModal.querySelector(".task-info-grid");
		if (!grid) return;
		var existing = Array.prototype.slice.call(grid.querySelectorAll(".task-info-option"));
		existing.forEach(function(optionEl) {
			optionEl.parentNode.removeChild(optionEl);
		});
		var list = task && Array.isArray(task.alternatives) ? task.alternatives : [];
		list.forEach(function(value, index) {
			if (typeof value !== "string" || !value.length) return;
			var optionEl = createEl("div", "task-info-box task-info-option task-info-option-" + (index + 1));
			setStyles(optionEl, mergeStyles(baseBoxStyles, { gridColumn: "1", gridRow: String(3 + index) }));

			var textEl = createEl("div", "task-info-option-text", value);
			setStyles(textEl, baseBodyStyles);
			optionEl.appendChild(textEl);

			var selectedMarker = createEl("div", "task-info-option-marker task-info-option-selected", "");
			optionEl.appendChild(selectedMarker);

			grid.appendChild(optionEl);
		});
	}

	function applyTemplateUpdate(templateKey, context) {
		var templates = getPopupTemplates();
		var selectedKey = templates[templateKey] ? templateKey : "default";
		var template = templates[selectedKey];
		if (template && typeof template.updateContent === "function") {
			template.updateContent(context || {});
		}
	}

	// Scale the modal grid based on current width to prevent overflow.
	// We start with "ideal" column sizes and gaps, then scale proportionally to fit
	// the available width. If it still doesn't fit, we tighten again with smaller
	// minimums. This keeps the layout readable without adding horizontal scroll.
	function ResizePopup() {
		if (!infoModal) return;
		var grid = infoModal.querySelector(".task-info-grid");
		if (!grid) return;
		var modalWidth = infoModal.clientWidth;
		if (!modalWidth) return;

		var base = {
			left: 248,
			center: 292,
			right: 225,
			gap: 40,
			padX: 30,
			padTop: 9,
			padBottom: 30
		};

		var required = base.left + base.center + base.right + (base.gap * 2) + (base.padX * 2);
		var scale = modalWidth / required;
		var left = Math.max(120, Math.floor(base.left * scale));
		var center = Math.max(160, Math.floor(base.center * scale));
		var right = Math.max(120, Math.floor(base.right * scale));
		var gap = Math.max(12, Math.floor(base.gap * scale));
		var padX = Math.max(12, Math.floor(base.padX * scale));
		var padTop = Math.max(6, Math.floor(base.padTop * scale));
		var padBottom = Math.max(12, Math.floor(base.padBottom * scale));

		grid.style.gridTemplateColumns = left + "px " + center + "px " + right + "px";
		grid.style.columnGap = gap + "px";
		grid.style.padding = padTop + "px " + padX + "px " + padBottom + "px";

		var title = infoModal.querySelector(".task-info-title");
		var titleHeight = title ? title.offsetHeight : 0;
		var availableHeight = Math.max(0, infoModal.clientHeight - titleHeight - (padTop + padBottom));
		if (availableHeight) {
			grid.style.height = availableHeight + "px";
		}
	}

	// Display the popup for a task and fill all the data fields.
	// We always resolve to the base task for the title and summary metrics so the
	// popup is stable, but if the click originated from a subtask we also preselect
	// that subtask in the dropdown to preserve user intent.

	// funcao principal, ela chama todas as outras, garante a criacao/remocao da invisibilidade do popup
	// e preenche todas as boxes
	function showInfoTooltip(task) {
		var templateKey = getPopupTemplateKey(task);
		createPopupDOM(templateKey);
		if (!infoModal || !infoBackdrop) return;
		infoBackdrop.style.display = "block";
		infoModal.style.display = "block";

		currentTemplateKey = templateKey;
		applyTemplateUpdate(templateKey, { task: task });

		setTimeout(function() {
			ResizePopup();
		}, 0);
	}

	// Hide modal and backdrop without destroying DOM nodes.
	// We keep the DOM alive so re-opening is instant and doesn't recreate a large
	// grid of elements or rebind event listeners.
	function hideInfoTooltip() {
		if (infoModal) {
			infoModal.style.display = "none";
		}
		if (infoBackdrop) {
			infoBackdrop.style.display = "none";
		}
	}

	return {
		showInfoTooltip: showInfoTooltip
	};
}