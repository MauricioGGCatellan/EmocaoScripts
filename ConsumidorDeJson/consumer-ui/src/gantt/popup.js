// Popup factory that returns a small, focused API for the chart.
// We keep construction and update logic inside this module so the chart only
// needs to call showInfoTooltip(task) without worrying about DOM details.
// "deps" allows injecting helpers (like getBaseTask) and a document reference,
// which makes the module more testable and avoids hard-coding globals.
export function createInfoModal(deps) {
	var getBaseTask = deps && deps.getBaseTask ? deps.getBaseTask : function(task) { return task; };
	var getPopupCatalog = deps && deps.getPopupCatalog ? deps.getPopupCatalog : function() { return null; };
	var getCurrentUser = deps && deps.getCurrentUser ? deps.getCurrentUser : function() { return null; };
	var doc = deps && deps.document ? deps.document : document;
	var win = doc.defaultView || window;

	// Modal UI for task details (kept outside SVG for easier layout).
	// We keep references to the top-level nodes only; individual fields are
	// queried on demand
	var infoModal = null;
	var infoBackdrop = null;
	var currentTemplateKey = null;
	var currentBaseTask = null;
	var createEl = function(tag, className, text) {
		return createPopupEl(doc, tag, className, text);
	};
	var storylinesInfoModal = createStorylinesInfoModal({ document: doc });

	function normalizeText(value) {
		return String(value || "")
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.toLowerCase()
			.trim();
	}

	function resolveCatalogUsers(catalog) {
		var list = catalog && Array.isArray(catalog.users) ? catalog.users : [];
		return list.map(function(user, index) {
			return {
				id: user && user.id ? String(user.id) : ("user-" + (index + 1)),
				label: user && user.label ? String(user.label) : ("Usuário " + (index + 1))
			};
		});
	}

	function resolveCatalogUserId(catalog, currentUser) {
		var users = resolveCatalogUsers(catalog);
		if (!users.length) return "";
		var user = currentUser || {};
		var rawId = String(user.id || "").trim();
		var rawLabel = String(user.label || user.name || "").trim();
		if (rawId) {
			var byId = users.find(function(entry) {
				return String(entry.id) === rawId;
			});
			if (byId) return byId.id;
		}
		if (rawLabel) {
			var normalizedLabel = normalizeText(rawLabel);
			var byLabel = users.find(function(entry) {
				return normalizeText(entry.label) === normalizedLabel;
			});
			if (byLabel) return byLabel.id;
		}
		return users[0].id;
	}

	function resolveIndividualSubtype(baseTask, catalog) {
		var sceneName = baseTask && baseTask.taskName ? String(baseTask.taskName) : "";
		var explicitType = catalog && catalog.sceneTypeByName && catalog.sceneTypeByName[sceneName]
			? String(catalog.sceneTypeByName[sceneName])
			: "";
		if (explicitType) {
			return explicitType;
		}
		var status = String(baseTask && baseTask.status ? baseTask.status : "").toUpperCase();
		var normalizedScene = normalizeText(sceneName);
		if (status === "QUIZ" || normalizedScene.indexOf("quiz") !== -1) return "quiz";
		if (status === "COLETA" || normalizedScene.indexOf("coleta") !== -1) return "coleta";
		if (status === "ENCAIXE" || normalizedScene.indexOf("encaixe") !== -1) return "encaixe";
		return "cena";
	}

	function getCatalogEntry(catalog, mode, subtype, sceneName) {
		var modeBucket = catalog && catalog[mode] ? catalog[mode] : null;
		var typeBucket = modeBucket && modeBucket[subtype] ? modeBucket[subtype] : null;
		if (!typeBucket) return null;
		return typeBucket[sceneName] || null;
	}

	function toSeconds(valueMs) {
		return Math.max(0, Math.round((valueMs || 0) / 1000));
	}

	function buildFallbackSceneEntry(baseTask, userId) {
		if (!baseTask) return null;
		var subtasks = getSubtaskList(baseTask);
		var dialogs = subtasks.map(function(subtask, index) {
			var selectedIndex = typeof subtask.selectedAlternative === "number" ? subtask.selectedAlternative : null;
			var options = (Array.isArray(subtask.alternatives) ? subtask.alternatives : []).map(function(option, optionIndex) {
				var text = "";
				if (typeof option === "string") {
					text = option;
				} else if (option && typeof option.texto === "string") {
					text = option.texto;
				} else if (option != null) {
					text = String(option);
				}
				var isSelected = selectedIndex === optionIndex;
				return {
					texto: text || ("Opção " + (optionIndex + 1)),
					percentual: selectedIndex === null ? 0 : (isSelected ? 100 : 0),
					selecionada: isSelected
				};
			});
			return {
				label: subtask && subtask.taskName ? subtask.taskName : ("Diálogo " + (index + 1)),
				texto: subtask && subtask.text ? subtask.text : "",
				tempoDialogoSeg: toSeconds((subtask && subtask.endDate && subtask.startDate) ? (subtask.endDate - subtask.startDate) : 0),
				actorType: (subtask && (subtask.actorType || subtask.speaker || subtask.actor || subtask.who)) || "Jogador",
				opcoes: options,
				images: subtask && subtask.imageUrl ? [ subtask.imageUrl ] : []
			};
		});
		var interactionCount = dialogs.filter(function(dialog) {
			return Array.isArray(dialog.opcoes) && dialog.opcoes.length;
		}).length;
		var start = baseTask && baseTask.startDate ? baseTask.startDate : null;
		var end = baseTask && baseTask.endDate ? baseTask.endDate : null;
		var durationMs = start && end ? Math.max(0, end - start) : 0;
		var safeUserId = userId || "user-1";
		var users = {};
		users[safeUserId] = {
			tempoPermanenciaSeg: toSeconds(durationMs),
			interacoesRealizadas: interactionCount,
			dialogos: dialogs
		};
		return {
			title: baseTask && baseTask.taskName ? baseTask.taskName : "Detalhes",
			users: users
		};
	}

	function buildNavigationFromCatalog(catalog, defaultUserId) {
		var navigation = [];
		var seen = {};
		var pushEntry = function(mode, subtype, sceneName, entry) {
			if (!sceneName || !entry) return;
			var key = [ mode, subtype, sceneName ].join("::");
			if (seen[key]) return;
			seen[key] = true;
			navigation.push({
				mode: mode,
				subtype: subtype,
				sceneName: sceneName,
				title: entry && entry.title ? entry.title : sceneName,
				entry: entry,
				defaultUserId: defaultUserId || ""
			});
		};

		[ "general", "individual" ].forEach(function(mode) {
			var modeBucket = catalog && catalog[mode] ? catalog[mode] : null;
			[ "cena", "quiz", "coleta", "encaixe" ].forEach(function(subtype) {
				var bucket = modeBucket && modeBucket[subtype] ? modeBucket[subtype] : null;
				if (!bucket && mode === "individual" && subtype === "encaixe") {
					bucket = catalog && catalog.general && catalog.general.encaixe ? catalog.general.encaixe : null;
				}
				if (!bucket) return;
				Object.keys(bucket).forEach(function(sceneName) {
					pushEntry(mode, subtype, sceneName, bucket[sceneName]);
				});
			});
		});

		return navigation;
	}

	function buildStorylinesPayload(task) {
		var catalog = getPopupCatalog();
		if (!catalog) return null;

		var baseTask = getBaseTask(task) || task;
		if (!baseTask) return null;

		var sceneName = baseTask.taskName ? String(baseTask.taskName) : "";
		if (!sceneName) return null;

		var users = resolveCatalogUsers(catalog);
		var userId = resolveCatalogUserId(catalog, getCurrentUser());
		if (!userId && users.length) {
			userId = users[0].id;
		}

		var subtype = resolveIndividualSubtype(baseTask, catalog);
		var entry = getCatalogEntry(catalog, "individual", subtype, sceneName);
		if (!entry && subtype === "encaixe") {
			entry = getCatalogEntry(catalog, "general", "encaixe", sceneName);
		}
		if (!entry && subtype !== "cena") {
			entry = getCatalogEntry(catalog, "individual", "cena", sceneName)
				|| getCatalogEntry(catalog, "general", "cena", sceneName);
			if (entry) {
				subtype = "cena";
			}
		}
		if (!entry) {
			subtype = "cena";
			entry = buildFallbackSceneEntry(baseTask, userId);
		}
		if (!entry) return null;

		var selectedUserIds = userId ? [ userId ] : [];
		var navigation = buildNavigationFromCatalog(catalog, userId);
		var currentKey = [ "individual", subtype, sceneName ].join("::");
		var hasCurrent = navigation.some(function(item) {
			return [ item.mode, item.subtype, item.sceneName ].join("::") === currentKey;
		});
		if (!hasCurrent) {
			navigation.unshift({
				mode: "individual",
				subtype: subtype,
				sceneName: sceneName,
				title: entry && entry.title ? entry.title : sceneName,
				entry: entry,
				defaultUserId: userId || ""
			});
		}

		return {
			mode: "individual",
			subtype: subtype,
			sceneName: sceneName,
			title: entry && entry.title ? entry.title : sceneName,
			entry: entry,
			users: users,
			defaultUserId: userId || "",
			selectedUserIds: selectedUserIds,
			navigation: navigation
		};
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

	var baseValueStyles = { font: "20px var(--font-main)" };
	var baseLabelStyles = {
		font: "14px var(--font-main)",
		textTransform: "uppercase",
		color: "rgba(0, 0, 0, 0.6)"
	};
	var baseBodyStyles = { font: "16px var(--font-main)" };
	var baseGridStyles = {
		display: "grid",
		gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
		gridAutoRows: "minmax(54px, 1fr)",
		columnGap: "clamp(12px, 2vw, 40px)",
		rowGap: "clamp(12px, 1.6vw, 18px)",
		padding: "clamp(6px, 1vh, 9px) clamp(12px, 2vw, 30px) clamp(12px, 2.5vh, 30px)",
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
		// Resolve template by normalized base status so payload variations
		// (case/whitespace/new statuses) do not fall into the "ERRO" fallback.
		var baseTask = getBaseTask(task);
		var target = baseTask || task;
		var status = String(target && target.status ? target.status : "")
			.trim()
			.toUpperCase();
		if (status === "MINIGAME" || status === "QUIZ" || status === "COLETA" || status === "ENCAIXE") {
			return "minigame";
		}
		if (status === "CENA" || status === "DIALOGO" || status === "PERGUNTA" || status === "PARTE") {
			return "cena";
		}
		return "cena";

		const emocoes = ['fear', 'sad','happy', 'disgust', 'surprise', 'angry', 'neutral']
		const emocoesPt = ['medo', 'triste', 'feliz', 'nojo', 'surpresa', 'raiva', 'neutro']
		if(target && (emocoes.includes(target.status) || emocoesPt.includes(target.status))){
			return "emocao";
		}

		return "default";
	}

	function ensurePopupShellDom() {
		var shell = ensurePopupShell({
			document: doc,
			backdropClass: "popup-backdrop task-info-backdrop",
			modalClass: "popup-modal task-info-modal",
			closeClass: "popup-close task-info-close",
			titleClass: "popup-title task-info-title",
			bodyClass: "popup-grid task-info-grid",
			closeText: "X"
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
		infoBackdrop = shell.backdrop;
		infoModal = shell.modal;
		bindPopupShellEvents(shell, {
			document: doc,
			window: win,
			onClose: hideInfoTooltip,
			onResizeVisible: ResizePopup
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
		return shell.body;
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
								attrs: {
									"aria-describedby": ensureDropdownDescription(doc)
								},
								styles: {
									width: "100%",
									padding: "7px 9px",
									borderRadius: "8px",
									border: "1px solid rgba(0, 0, 0, 0.2)",
									font: "16px var(--font-main)"
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
						font: "14px var(--font-main)"
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
						var task = context.task || null;
						var baseTask = context.baseTask || getBaseTask(task);
						var start = baseTask && baseTask.startDate ? baseTask.startDate : null;
						var end = baseTask && baseTask.endDate ? baseTask.endDate : null;
						var durationMs = start && end ? Math.max(0, end - start) : 0;
						var subtaskCount = countSubtasks(baseTask);

						var title = infoModal.querySelector(".task-info-title");
						var durationValue = infoModal.querySelector(".task-info-duration .task-info-value");
						var subtaskValue = infoModal.querySelector(".task-info-subtasks .task-info-value");

						if (title) {
							title.textContent = baseTask && baseTask.taskName ? baseTask.taskName : "";
						}
						if (durationValue) {
							durationValue.textContent = formatDuration(durationMs);
						}
						if (subtaskValue) {
							subtaskValue.textContent = subtaskCount;
						}
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
				,
				default: {
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
								{ className: "task-info-label", text: "Tempo total", styles: baseLabelStyles }
							]
						});
					},
					updateContent: function(context) {
						var task = context.task || null;
						var baseTask = context.baseTask || getBaseTask(task);
						var start = baseTask && baseTask.startDate ? baseTask.startDate : null;
						var end = baseTask && baseTask.endDate ? baseTask.endDate : null;
						var durationMs = start && end ? Math.max(0, end - start) : 0;

						var title = infoModal.querySelector(".task-info-title");
						var durationValue = infoModal.querySelector(".task-info-duration .task-info-value");
						if (title) {
							title.textContent = baseTask && baseTask.taskName ? baseTask.taskName : "";
						}
						if (durationValue) {
							durationValue.textContent = formatDuration(durationMs);
						}
					}
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
		applyPopupViewportInset(infoModal, 80);
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
		if (!infoModal) return;
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

		grid = ensurePopupShellDom();

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

	// Count nested dialog tasks to show dialog totals.
	// We walk the full tree so deeply nested dialogs are included, but we ignore
	// non-dialog descendants such as PARTES.
	function countSubtasks(task) {
		var list = getSubtaskList(task);
		if (!list.length) return 0;
		var count = 0;
		list.forEach(function(subtask) {
			if (subtask && subtask.status === "DIALOGO") {
				count += 1;
			}
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

		var computed = win.getComputedStyle ? win.getComputedStyle(grid) : null;
		var padTop = computed ? (parseFloat(computed.paddingTop) || 0) : 0;
		var padBottom = computed ? (parseFloat(computed.paddingBottom) || 0) : 0;

		fitPopupGridHeight(infoModal, {
			gridSelector: ".task-info-grid",
			titleSelector: ".task-info-title",
			padTop: padTop,
			padBottom: padBottom
		});
	}

	// Display the popup for a task and fill all the data fields.
	// We always resolve to the base task for the title and summary metrics so the
	// popup is stable, but if the click originated from a subtask we also preselect
	// that subtask in the dropdown to preserve user intent.

	// funcao principal, ela chama todas as outras, garante a criacao/remocao da invisibilidade do popup
	// e preenche todas as boxes
	function showInfoTooltip(task) {
		var storylinesPayload = buildStorylinesPayload(task);
		if (storylinesPayload && storylinesInfoModal && storylinesInfoModal.showInfoTooltip) {
			storylinesInfoModal.showInfoTooltip(storylinesPayload);
			return;
		}

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
		if (storylinesInfoModal && storylinesInfoModal.hideInfoTooltip) {
			storylinesInfoModal.hideInfoTooltip();
		}
		if (infoModal) {
			infoModal.style.display = "none";
		}
		if (infoBackdrop) {
			infoBackdrop.style.display = "none";
		}
	}

	return {
		showInfoTooltip: showInfoTooltip,
		hideInfoTooltip: hideInfoTooltip
	};
}
