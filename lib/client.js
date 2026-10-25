window.__ModuleLoader__.load({
	id: "dsh-automation",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		// src/client/api.ts
		/**
		* 浏览器端 /api/automation 客户端。
		*
		* 纯 fetch 封装：请求与响应均为 JSON。所有接口返回统一信封
		* `{ ok, code, message, ... }`（与工具一致）。错误时 throw ApiError。
		*/
		/** 基础 URL（同源 /api/automation）。 */
		const API_BASE = "/api/automation";
		/** API 错误。 */
		var ApiError = class extends Error {
			code;
			status;
			constructor(status, code, message) {
				super(message);
				this.name = "ApiError";
				this.code = code;
				this.status = status;
			}
		};
		/** 请求并解析 JSON 信封；非 2xx / !ok 抛 ApiError。 */
		async function request(path, options) {
			const { method = "GET", body, query } = options ?? {};
			let url = `${API_BASE}${path}`;
			if (query !== void 0) {
				const params = new URLSearchParams();
				for (const [key, value] of Object.entries(query)) if (value !== void 0) params.set(key, String(value));
				const qs = params.toString();
				if (qs !== "") url = `${url}?${qs}`;
			}
			const headers = { Accept: "application/json" };
			let payload;
			if (body !== void 0) {
				headers["Content-Type"] = "application/json";
				payload = JSON.stringify(body);
			}
			const res = await fetch(url, {
				method,
				headers,
				body: payload
			});
			let data;
			try {
				data = await res.json();
			} catch {
				data = void 0;
			}
			const envelope = data;
			if (!res.ok || envelope?.ok === false) throw new ApiError(res.status, envelope?.code ?? "HTTP_ERROR", envelope?.message ?? `请求失败（${res.status}）`);
			return data;
		}
		const api = {
			settings: () => request("/settings"),
			saveSettings: (body) => request("/settings", {
				method: "POST",
				body
			}),
			migration: () => request("/migration"),
			mutateMigration: (body) => request("/migration", {
				method: "POST",
				body
			}),
			/** 服务状态。 */
			status: () => request("/status"),
			/** 列出任务。 */
			listTasks: () => request("/tasks"),
			/** 任务详情（含 triggers / runs）。 */
			getTask: (id) => request(`/tasks/${encodeURIComponent(id)}`),
			/** 创建任务。 */
			createTask: (input) => request("/tasks", {
				method: "POST",
				body: input
			}),
			/** 更新任务。 */
			updateTask: (id, patch) => request(`/tasks/${encodeURIComponent(id)}`, {
				method: "PATCH",
				body: patch
			}),
			/** 删除任务。 */
			deleteTask: (id) => request(`/tasks/${encodeURIComponent(id)}`, { method: "DELETE" }),
			/** 立即运行。 */
			runNow: (id) => request(`/tasks/${encodeURIComponent(id)}/run`, { method: "POST" }),
			/** 添加执行时间。 */
			addTrigger: (taskId, config) => request(`/tasks/${encodeURIComponent(taskId)}/triggers`, {
				method: "POST",
				body: { config }
			}),
			/** 更新执行时间。 */
			updateTrigger: (id, patch) => request(`/triggers/${encodeURIComponent(id)}`, {
				method: "PATCH",
				body: patch
			}),
			/** 删除执行时间。 */
			deleteTrigger: (id) => request(`/triggers/${encodeURIComponent(id)}`, { method: "DELETE" }),
			/** 待运行。 */
			listUpcoming: () => request("/upcoming"),
			/** 运行中。 */
			listRunning: () => request("/running"),
			/** 历史（可按任务 / 状态筛选）。 */
			listHistory: (filter) => request("/history", { query: filter }),
			/** 运行详情。 */
			getRun: (id) => request(`/runs/${encodeURIComponent(id)}`),
			/** 取消运行。 */
			cancelRun: (id) => request(`/runs/${encodeURIComponent(id)}/cancel`, { method: "POST" })
		};
		// src/client/AutomationPage.tsx
		/**
		* AutomationPage —— dsh-automation 主面板。
		*
		* 布局：顶部标题 + 状态条，下方四个 Tab：
		*   - 任务（列表 + 新建/编辑 Drawer + 详情抽屉）
		*   - 待运行（Upcoming）
		*   - 运行中（Running）
		*   - 历史（History + Run 详情抽屉）
		*
		* 数据全部来自 /api/automation（api.ts）。无额外运行时依赖（纯 React）。
		*/
		function AutomationPage(props = {}) {
			return (0, react.createElement)(AutomationPageImpl, props);
		}
		/** 实现（hooks 不能放在条件分支内，独立组件）。 */
		function AutomationPageImpl(props) {
			const [tab, setTab] = (0, react.useState)("tasks");
			const [refreshKey, setRefreshKey] = (0, react.useState)(0);
			const [status, setStatus] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				let alive = true;
				api.status().then((s) => {
					if (alive) setStatus(s.status);
				}).catch(() => {});
				const timer = window.setInterval(() => {
					api.status().then((s) => {
						if (alive) setStatus(s.status);
					}).catch(() => {});
				}, 5e3);
				return () => {
					alive = false;
					window.clearInterval(timer);
				};
			}, []);
			const refresh = () => setRefreshKey((k) => k + 1);
			(0, react.useEffect)(() => {
				if (props.createRequest) setTab("tasks");
			}, [props.createRequest]);
			return (0, react.createElement)("div", {
				className: "da-root",
				style: {
					padding: "16px 20px",
					minWidth: 0
				}
			}, (0, react.createElement)("div", { style: {
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: 12
			} }, (0, react.createElement)("div", { style: {
				minWidth: 0,
				flex: 1
			} }, (0, react.createElement)(props.embedded ? "h2" : "h1", { style: {
				fontSize: 18,
				margin: 0
			} }, "直接执行任务"), (0, react.createElement)("div", { style: {
				fontSize: 12,
				color: "var(--dsw-alias-label-secondary,#888)",
				marginTop: 2
			} }, status === null ? "…" : `调度${status.running ? "运行中" : "已停止"} · 队列 ${status.queued} · 运行中 ${status.active} · 数据 ${status.homeDir}`)), (0, react.createElement)("button", {
				onClick: refresh,
				style: {
					...buttonStyle,
					flexShrink: 0,
					whiteSpace: "nowrap"
				}
			}, "刷新")), (0, react.createElement)("div", { style: {
				display: "flex",
				gap: 8,
				borderBottom: "1px solid #e5e5e5",
				paddingBottom: 8
			} }, tabs.map((t) => (0, react.createElement)("button", {
				key: t.key,
				onClick: () => setTab(t.key),
				style: tabStyle(t.key === tab)
			}, t.label))), (0, react.createElement)("div", { style: {
				flex: 1,
				minHeight: 0
			} }, (0, react.createElement)("div", { hidden: tab !== "tasks" }, (0, react.createElement)(TasksTab, {
				refreshKey,
				onChanged: refresh,
				embedded: props.embedded,
				createRequest: props.createRequest,
				onCreateConsumed: props.onCreateConsumed,
				registerLeaveGuard: props.registerLeaveGuard
			})), tab === "upcoming" && (0, react.createElement)(UpcomingTab, {
				refreshKey,
				onChanged: refresh
			}), tab === "running" && (0, react.createElement)(RunningTab, {
				refreshKey,
				onChanged: refresh
			}), tab === "history" && (0, react.createElement)(HistoryTab, {
				refreshKey,
				onChanged: refresh
			})));
		}
		const tabs = [
			{
				key: "tasks",
				label: "任务"
			},
			{
				key: "upcoming",
				label: "待运行"
			},
			{
				key: "running",
				label: "运行中"
			},
			{
				key: "history",
				label: "历史"
			}
		];
		const buttonStyle = {
			padding: "6px 12px",
			border: "1px solid #d0d0d0",
			borderRadius: 6,
			background: "var(--dsw-alias-bg-layer-1,#fff)",
			cursor: "pointer",
			fontSize: 13
		};
		function tabStyle(active) {
			return {
				padding: "6px 14px",
				border: "none",
				borderRadius: 6,
				cursor: "pointer",
				fontSize: 13,
				background: active ? "#e8f0fe" : "transparent",
				color: active ? "#1a56db" : "var(--dsw-alias-label-secondary,#555)",
				fontWeight: active ? 600 : 400
			};
		}
		const dangerButtonStyle = {
			...buttonStyle,
			color: "#c0392b",
			borderColor: "#e0b4b0"
		};
		const smallButtonStyle = {
			...buttonStyle,
			padding: "3px 8px",
			fontSize: 12
		};
		function TasksTab(props) {
			const [tasks, setTasks] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [drawer, setDrawer] = (0, react.useState)(null);
			const [detailId, setDetailId] = (0, react.useState)(null);
			const lastCreate = (0, react.useRef)(0);
			(0, react.useEffect)(() => {
				if (!props.createRequest || props.createRequest === lastCreate.current) return;
				lastCreate.current = props.createRequest;
				setDrawer({ mode: "create" });
				props.onCreateConsumed?.(props.createRequest);
			}, [props.createRequest]);
			(0, react.useEffect)(() => {
				let alive = true;
				setTasks(null);
				api.listTasks().then((r) => {
					if (alive) setTasks(r.tasks.filter((task) => task.action.type === "command" || task.action.type === "script"));
				}).catch((e) => {
					if (alive) setError(e instanceof Error ? e.message : String(e));
				});
				return () => {
					alive = false;
				};
			}, [props.refreshKey]);
			return (0, react.createElement)("div", { style: {
				display: "flex",
				flexDirection: "column",
				gap: 10
			} }, !props.embedded && (0, react.createElement)("div", { style: {
				display: "flex",
				justifyContent: "flex-end"
			} }, (0, react.createElement)("button", {
				onClick: () => setDrawer({ mode: "create" }),
				style: buttonStyle
			}, "+ 新建任务")), error !== null && (0, react.createElement)("div", { style: {
				color: "#c0392b",
				fontSize: 13
			} }, error), (0, react.createElement)("div", { style: {
				display: "flex",
				flexDirection: "column",
				gap: 8
			} }, (tasks ?? []).map((task) => (0, react.createElement)("div", {
				key: task.id,
				style: {
					border: "1px solid #e5e5e5",
					borderRadius: 8,
					padding: "10px 14px",
					background: "var(--dsw-alias-bg-layer-1,#fff)"
				}
			}, (0, react.createElement)("div", { style: {
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: 8,
				flexWrap: "wrap"
			} }, (0, react.createElement)("div", { style: { minWidth: 0 } }, (0, react.createElement)("div", { style: {
				fontWeight: 600,
				fontSize: 14,
				display: "flex",
				alignItems: "center",
				gap: 8
			} }, (0, react.createElement)("span", null, task.name), (0, react.createElement)("span", { style: {
				fontSize: 11,
				padding: "1px 8px",
				borderRadius: 10,
				background: task.enabled ? "#e6f4ea" : "#f0f0f0",
				color: task.enabled ? "#1e7d32" : "#888"
			} }, task.enabled ? "启用" : "暂停")), (0, react.createElement)("div", { style: {
				fontSize: 12,
				color: "var(--dsw-alias-label-secondary,#888)",
				marginTop: 2
			} }, `${actionLabel(task.action)}${task.concurrency !== void 0 ? ` · 并发:${task.concurrency}` : ""}${task.timeout_seconds !== void 0 ? ` · 超时:${task.timeout_seconds}s` : ""}`)), (0, react.createElement)("div", {
				"data-task-actions": true,
				style: {
					display: "flex",
					gap: 6,
					flexShrink: 0,
					maxWidth: "100%",
					flexWrap: "wrap"
				}
			}, (0, react.createElement)("button", {
				style: smallButtonStyle,
				onClick: () => {
					api.runNow(task.id).then(props.onChanged).catch(alertError);
				}
			}, "立即运行"), (0, react.createElement)("button", {
				style: smallButtonStyle,
				onClick: () => {
					api.updateTask(task.id, { enabled: !task.enabled }).then(props.onChanged).catch(alertError);
				}
			}, task.enabled ? "暂停" : "启用"), (0, react.createElement)("button", {
				style: smallButtonStyle,
				onClick: () => setDetailId(task.id)
			}, "详情"), (0, react.createElement)("button", {
				style: smallButtonStyle,
				onClick: () => setDrawer({
					mode: "edit",
					task
				})
			}, "编辑"), (0, react.createElement)("button", {
				style: {
					...smallButtonStyle,
					...dangerButtonStyle
				},
				onClick: () => {
					api.deleteTask(task.id).then(props.onChanged).catch(alertError);
				}
			}, "删除"))))), tasks !== null && tasks.length === 0 && (0, react.createElement)("div", { style: {
				color: "var(--dsw-alias-label-secondary,#888)",
				fontSize: 13,
				padding: "20px 16px",
				textAlign: "center",
				lineHeight: 1.8
			} }, "还没有定时任务。创建方式有两种：", (0, react.createElement)("br"), (0, react.createElement)("span", null, props.embedded ? "① 点页面上方「新建直接任务」，填写命令或脚本及执行时间；" : "① 点右上角「+ 新建任务」，填写命令或脚本及执行时间；"), (0, react.createElement)("br"), (0, react.createElement)("span", null, "② 对助手说明定时执行哪个命令或脚本。会话与Skill任务请使用官方自动化任务。")), tasks === null && error === null && (0, react.createElement)("div", { style: {
				color: "#999",
				fontSize: 13,
				padding: 16
			} }, "加载中…")), drawer !== null && (0, react.createElement)(TaskDrawer, {
				key: drawer.mode === "edit" ? drawer.task.id : "create-" + lastCreate.current,
				mode: drawer.mode,
				task: drawer.mode === "edit" ? drawer.task : void 0,
				onClose: () => setDrawer(null),
				onSaved: () => {
					setDrawer(null);
					props.onChanged();
				},
				registerLeaveGuard: props.registerLeaveGuard,
				embedded: props.embedded
			}), detailId !== null && (0, react.createElement)(TaskDetail, {
				taskId: detailId,
				onClose: () => setDetailId(null),
				onChanged: props.onChanged
			}));
		}
		function TaskDrawer(props) {
			const [name, setName] = (0, react.useState)(props.task?.name ?? "");
			const [description, setDescription] = (0, react.useState)(props.task?.description ?? "");
			const [actionType, setActionType] = (0, react.useState)(props.task?.action.type === "script" ? "script" : "command");
			const [actionCommand, setActionCommand] = (0, react.useState)(props.task?.action.command ?? "");
			const [actionPath, setActionPath] = (0, react.useState)(props.task?.action.path ?? "");
			const [actionArgs, setActionArgs] = (0, react.useState)(props.task?.action.args?.join("\n") ?? "");
			const [concurrency, setConcurrency] = (0, react.useState)(props.task?.concurrency ?? "skip");
			const [timeoutSec, setTimeoutSec] = (0, react.useState)(props.task?.timeout_seconds?.toString() ?? "");
			const [retryEnabled, setRetryEnabled] = (0, react.useState)(props.task?.retry?.enabled ?? false);
			const [retryMax, setRetryMax] = (0, react.useState)(props.task?.retry?.max_attempts?.toString() ?? "2");
			const [retryDelay, setRetryDelay] = (0, react.useState)(props.task?.retry?.delay_seconds?.toString() ?? "60");
			const [triggerType, setTriggerType] = (0, react.useState)("daily");
			const [triggerTime, setTriggerTime] = (0, react.useState)("09:00");
			const [triggerWeekday, setTriggerWeekday] = (0, react.useState)("1");
			const [triggerDay, setTriggerDay] = (0, react.useState)("1");
			const [triggerMinute, setTriggerMinute] = (0, react.useState)("0");
			const [triggerAt, setTriggerAt] = (0, react.useState)("");
			const [triggerExpr, setTriggerExpr] = (0, react.useState)("0 18 * * *");
			const [cwd, setCwd] = (0, react.useState)(props.task?.context?.cwd ?? "");
			const [envText, setEnvText] = (0, react.useState)(Object.entries(props.task?.context?.env ?? {}).map(([key, value]) => key + "=" + value).join("\n"));
			const [interpreter, setInterpreter] = (0, react.useState)(props.task?.action.interpreter ?? "");
			const [shell, setShell] = (0, react.useState)(props.task?.action.shell ?? false);
			const [timeZone, setTimeZone] = (0, react.useState)(Intl.DateTimeFormat().resolvedOptions().timeZone);
			const [weekdaySet, setWeekdaySet] = (0, react.useState)("1,2,3,4,5");
			const [saving, setSaving] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const formValue = JSON.stringify({
				name,
				description,
				actionType,
				actionCommand,
				actionPath,
				actionArgs,
				concurrency,
				timeoutSec,
				retryEnabled,
				retryMax,
				retryDelay,
				triggerType,
				triggerTime,
				triggerWeekday,
				triggerDay,
				triggerMinute,
				triggerAt,
				triggerExpr,
				cwd,
				envText,
				interpreter,
				shell,
				timeZone,
				weekdaySet
			});
			const draftChanged = formValue !== (0, react.useRef)(formValue).current;
			const requestClose = () => {
				if (saving) return false;
				if (draftChanged && !window.confirm("放弃未保存的任务修改？")) return false;
				props.onClose();
				return true;
			};
			(0, react.useEffect)(() => props.registerLeaveGuard?.(requestClose), [
				props.registerLeaveGuard,
				draftChanged,
				saving,
				formValue
			]);
			const buildAction = () => {
				switch (actionType) {
					case "command": {
						const args = splitArgs(actionArgs);
						return {
							type: "command",
							command: actionCommand,
							shell,
							...args.length > 0 ? { args } : {}
						};
					}
					case "script": {
						const args = splitArgs(actionArgs);
						return {
							type: "script",
							path: actionPath,
							...interpreter ? { interpreter } : {},
							...args.length > 0 ? { args } : {}
						};
					}
				}
			};
			const buildTrigger = () => {
				switch (triggerType) {
					case "once": return {
						type: "once",
						at: triggerAt
					};
					case "hourly": return {
						type: "hourly",
						minute: Number(triggerMinute)
					};
					case "daily": return {
						type: "daily",
						time: triggerTime
					};
					case "weekday": return {
						type: "weekday",
						weekdays: weekdaySet.split(",").map(Number),
						time: triggerTime
					};
					case "weekly": return {
						type: "weekly",
						weekday: Number(triggerWeekday),
						time: triggerTime
					};
					case "monthly": return {
						type: "monthly",
						day: Number(triggerDay),
						time: triggerTime
					};
					case "cron": return {
						type: "cron",
						expr: triggerExpr
					};
				}
			};
			const save = async () => {
				if (name.trim() === "") {
					setError("请填写任务名称。");
					return;
				}
				let action;
				try {
					action = buildAction();
				} catch (error) {
					setError(error.message);
					return;
				}
				if (action.type === "command" && action.command === "") {
					setError("请填写命令。");
					return;
				}
				if (action.type === "script" && action.path === "") {
					setError("请填写脚本路径。");
					return;
				}
				setSaving(true);
				setError(null);
				try {
					const input = {
						name: name.trim(),
						description: description !== "" ? description : void 0,
						action,
						context: {
							...cwd ? { cwd } : {},
							env: parseEnvironment(envText)
						},
						concurrency,
						...props.mode === "create" ? { triggers: [{
							...buildTrigger(),
							time_zone: timeZone
						}] } : {},
						...timeoutSec !== "" ? { timeout_seconds: Number(timeoutSec) } : {},
						retry: {
							enabled: retryEnabled,
							max_attempts: Number(retryMax),
							delay_seconds: Number(retryDelay)
						}
					};
					if (props.mode === "create") await api.createTask(input);
					else if (props.task !== void 0) await api.updateTask(props.task.id, input);
					props.onSaved();
				} catch (e) {
					setError(e instanceof Error ? e.message : String(e));
				} finally {
					setSaving(false);
				}
			};
			const fieldLabel = {
				fontSize: 12,
				color: "var(--dsw-alias-label-secondary,#666)",
				marginBottom: 4,
				display: "block"
			};
			const inputStyle = {
				width: "100%",
				padding: "6px 8px",
				border: "1px solid #d0d0d0",
				borderRadius: 6,
				fontSize: 13,
				boxSizing: "border-box"
			};
			return (0, react.createElement)("div", {
				style: {
					position: props.embedded ? "absolute" : "fixed",
					inset: 0,
					background: "rgba(0,0,0,0.25)",
					zIndex: 1e3,
					display: "flex",
					justifyContent: "flex-end"
				},
				onClick: requestClose
			}, (0, react.createElement)("div", {
				style: {
					width: 440,
					maxWidth: "92vw",
					background: "var(--dsw-alias-bg-layer-1,#fff)",
					height: "100%",
					overflowY: "auto",
					padding: 20,
					boxSizing: "border-box"
				},
				onClick: (e) => e.stopPropagation()
			}, (0, react.createElement)("h2", { style: {
				fontSize: 16,
				margin: "0 0 16px"
			} }, props.mode === "create" ? "新建直接任务" : `编辑直接任务 · ${props.task?.name ?? ""}`), (0, react.createElement)("div", { style: {
				display: "flex",
				flexDirection: "column",
				gap: 12
			} }, (0, react.createElement)("div", null, (0, react.createElement)("label", { style: fieldLabel }, "任务名称 *"), (0, react.createElement)("input", {
				style: inputStyle,
				value: name,
				onChange: (e) => setName(e.target.value),
				placeholder: "如：每日项目总结"
			})), (0, react.createElement)("div", null, (0, react.createElement)("label", { style: fieldLabel }, "描述"), (0, react.createElement)("input", {
				style: inputStyle,
				value: description,
				onChange: (e) => setDescription(e.target.value),
				placeholder: "可选"
			})), (0, react.createElement)("div", null, (0, react.createElement)("label", { style: fieldLabel }, "执行动作 *"), (0, react.createElement)("select", {
				style: inputStyle,
				value: actionType,
				onChange: (e) => setActionType(e.target.value)
			}, (0, react.createElement)("option", { value: "command" }, "命令"), (0, react.createElement)("option", { value: "script" }, "脚本"))), actionType === "command" && (0, react.createElement)("div", null, (0, react.createElement)("label", { style: fieldLabel }, "命令 *"), (0, react.createElement)("input", {
				style: inputStyle,
				value: actionCommand,
				onChange: (e) => setActionCommand(e.target.value),
				placeholder: "如：git pull"
			})), actionType === "script" && (0, react.createElement)("div", null, (0, react.createElement)("label", { style: fieldLabel }, "脚本路径 *"), (0, react.createElement)("input", {
				style: inputStyle,
				value: actionPath,
				onChange: (e) => setActionPath(e.target.value),
				placeholder: "如：scripts/daily.py"
			})), (actionType === "command" || actionType === "script") && (0, react.createElement)("div", null, (0, react.createElement)("label", { style: fieldLabel }, "参数（每行一个，保留空格）"), (0, react.createElement)("textarea", {
				style: inputStyle,
				value: actionArgs,
				onChange: (e) => setActionArgs(e.target.value)
			})), (0, react.createElement)("div", null, (0, react.createElement)("label", { style: fieldLabel }, "工作目录"), (0, react.createElement)("input", {
				style: inputStyle,
				value: cwd,
				onChange: (e) => setCwd(e.target.value)
			})), (0, react.createElement)("div", null, (0, react.createElement)("label", { style: fieldLabel }, "环境变量（每行 NAME=值）"), (0, react.createElement)("textarea", {
				style: inputStyle,
				value: envText,
				onChange: (e) => setEnvText(e.target.value)
			})), actionType === "script" && (0, react.createElement)("div", null, (0, react.createElement)("label", { style: fieldLabel }, "解释器覆盖（可选）"), (0, react.createElement)("input", {
				style: inputStyle,
				value: interpreter,
				onChange: (e) => setInterpreter(e.target.value),
				placeholder: "自动选择 Python、Bash、PowerShell 或 Node"
			})), actionType === "command" && (0, react.createElement)("label", { style: fieldLabel }, (0, react.createElement)("input", {
				type: "checkbox",
				checked: shell,
				onChange: (e) => setShell(e.target.checked)
			}), "通过系统 Shell 执行"), props.mode === "create" && (0, react.createElement)("div", null, (0, react.createElement)("label", { style: fieldLabel }, "执行时区"), (0, react.createElement)("input", {
				style: inputStyle,
				value: timeZone,
				onChange: (e) => setTimeZone(e.target.value)
			})), props.mode === "create" && triggerType === "weekday" && (0, react.createElement)("div", null, (0, react.createElement)("label", { style: fieldLabel }, "星期编号（0周日，1–6周一至周六，逗号分隔）"), (0, react.createElement)("input", {
				style: inputStyle,
				value: weekdaySet,
				onChange: (e) => setWeekdaySet(e.target.value)
			}), (0, react.createElement)("input", {
				style: inputStyle,
				type: "time",
				value: triggerTime,
				onChange: (e) => setTriggerTime(e.target.value)
			})), (0, react.createElement)("div", { style: {
				display: "flex",
				gap: 12
			} }, (0, react.createElement)("div", { style: { flex: 1 } }, (0, react.createElement)("label", { style: fieldLabel }, "并发策略"), (0, react.createElement)("select", {
				style: inputStyle,
				value: concurrency,
				onChange: (e) => setConcurrency(e.target.value)
			}, (0, react.createElement)("option", { value: "skip" }, "skip（默认，跳过）"), (0, react.createElement)("option", { value: "queue" }, "queue（排队）"), (0, react.createElement)("option", { value: "parallel" }, "parallel（并行）"))), (0, react.createElement)("div", { style: { flex: 1 } }, (0, react.createElement)("label", { style: fieldLabel }, "超时（秒）"), (0, react.createElement)("input", {
				style: inputStyle,
				value: timeoutSec,
				onChange: (e) => setTimeoutSec(e.target.value),
				placeholder: "默认 1800"
			}))), (0, react.createElement)("div", null, (0, react.createElement)("label", { style: {
				...fieldLabel,
				display: "flex",
				alignItems: "center",
				gap: 6
			} }, (0, react.createElement)("input", {
				type: "checkbox",
				checked: retryEnabled,
				onChange: (e) => setRetryEnabled(e.target.checked)
			}), "失败重试"), retryEnabled && (0, react.createElement)("div", { style: {
				display: "flex",
				gap: 12,
				marginTop: 8
			} }, (0, react.createElement)("div", { style: { flex: 1 } }, (0, react.createElement)("label", { style: fieldLabel }, "最大重试次数"), (0, react.createElement)("input", {
				style: inputStyle,
				value: retryMax,
				onChange: (e) => setRetryMax(e.target.value)
			})), (0, react.createElement)("div", { style: { flex: 1 } }, (0, react.createElement)("label", { style: fieldLabel }, "间隔（秒）"), (0, react.createElement)("input", {
				style: inputStyle,
				value: retryDelay,
				onChange: (e) => setRetryDelay(e.target.value)
			})))), props.mode === "create" && (0, react.createElement)("div", null, (0, react.createElement)("label", { style: fieldLabel }, "执行时间（后续可加多个）"), (0, react.createElement)("select", {
				style: inputStyle,
				value: triggerType,
				onChange: (e) => setTriggerType(e.target.value)
			}, (0, react.createElement)("option", { value: "daily" }, "每天"), (0, react.createElement)("option", { value: "hourly" }, "每小时"), (0, react.createElement)("option", { value: "weekly" }, "每周"), (0, react.createElement)("option", { value: "weekday" }, "指定星期"), (0, react.createElement)("option", { value: "monthly" }, "每月"), (0, react.createElement)("option", { value: "once" }, "仅一次"), (0, react.createElement)("option", { value: "cron" }, "Cron（高级）")), (0, react.createElement)("div", { style: { marginTop: 8 } }, triggerType === "once" && (0, react.createElement)("input", {
				style: inputStyle,
				value: triggerAt,
				onChange: (e) => setTriggerAt(e.target.value),
				placeholder: "ISO 时刻，如 2026-09-23T09:00:00"
			}), triggerType === "hourly" && (0, react.createElement)("div", { style: {
				display: "flex",
				alignItems: "center",
				gap: 8
			} }, (0, react.createElement)("span", { style: { fontSize: 13 } }, "每小时的第"), (0, react.createElement)("input", {
				style: {
					...inputStyle,
					width: 70
				},
				value: triggerMinute,
				onChange: (e) => setTriggerMinute(e.target.value)
			}), (0, react.createElement)("span", { style: { fontSize: 13 } }, "分钟")), triggerType === "daily" && (0, react.createElement)("input", {
				style: inputStyle,
				type: "time",
				value: triggerTime,
				onChange: (e) => setTriggerTime(e.target.value)
			}), triggerType === "weekly" && (0, react.createElement)("div", { style: {
				display: "flex",
				gap: 8
			} }, (0, react.createElement)("select", {
				style: {
					...inputStyle,
					flex: 1
				},
				value: triggerWeekday,
				onChange: (e) => setTriggerWeekday(e.target.value)
			}, weekdays.map((w) => (0, react.createElement)("option", {
				key: w.value,
				value: String(w.value)
			}, w.label))), (0, react.createElement)("input", {
				style: {
					...inputStyle,
					width: 110
				},
				type: "time",
				value: triggerTime,
				onChange: (e) => setTriggerTime(e.target.value)
			})), triggerType === "monthly" && (0, react.createElement)("div", { style: {
				display: "flex",
				gap: 8
			} }, (0, react.createElement)("div", { style: { flex: 1 } }, (0, react.createElement)("label", { style: fieldLabel }, "每月第几日"), (0, react.createElement)("input", {
				style: inputStyle,
				value: triggerDay,
				onChange: (e) => setTriggerDay(e.target.value)
			})), (0, react.createElement)("div", { style: { flex: 1 } }, (0, react.createElement)("label", { style: fieldLabel }, "时刻"), (0, react.createElement)("input", {
				style: inputStyle,
				type: "time",
				value: triggerTime,
				onChange: (e) => setTriggerTime(e.target.value)
			}))), triggerType === "cron" && (0, react.createElement)("input", {
				style: inputStyle,
				value: triggerExpr,
				onChange: (e) => setTriggerExpr(e.target.value),
				placeholder: "如 0 18 * * *"
			}))), error !== null && (0, react.createElement)("div", { style: {
				color: "#c0392b",
				fontSize: 13
			} }, error), (0, react.createElement)("div", { style: {
				display: "flex",
				justifyContent: "flex-end",
				gap: 8,
				marginTop: 4
			} }, (0, react.createElement)("button", {
				style: buttonStyle,
				onClick: requestClose,
				disabled: saving
			}, "取消"), (0, react.createElement)("button", {
				style: {
					...buttonStyle,
					background: "#1a56db",
					color: "#fff",
					borderColor: "#1a56db"
				},
				onClick: () => {
					save();
				},
				disabled: saving
			}, saving ? "保存中…" : "保存")))));
		}
		function TaskDetail(props) {
			const [data, setData] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [newTriggerType, setNewTriggerType] = (0, react.useState)("daily");
			const [newTriggerTime, setNewTriggerTime] = (0, react.useState)("09:00");
			const [newTriggerWeekday, setNewTriggerWeekday] = (0, react.useState)("1");
			const [newTriggerDay, setNewTriggerDay] = (0, react.useState)("1");
			const [newTriggerMinute, setNewTriggerMinute] = (0, react.useState)("0");
			const [editingTrigger, setEditingTrigger] = (0, react.useState)(null);
			const [newTimeZone, setNewTimeZone] = (0, react.useState)(Intl.DateTimeFormat().resolvedOptions().timeZone);
			const [newWeekdays, setNewWeekdays] = (0, react.useState)("1,2,3,4,5");
			const [newTriggerAt, setNewTriggerAt] = (0, react.useState)("");
			const [newTriggerExpr, setNewTriggerExpr] = (0, react.useState)("0 18 * * *");
			(0, react.useEffect)(() => {
				let alive = true;
				api.getTask(props.taskId).then((r) => {
					if (alive) setData({
						task: r.task,
						triggers: r.triggers,
						runs: r.runs
					});
				}).catch((e) => {
					if (alive) setError(e instanceof Error ? e.message : String(e));
				});
				return () => {
					alive = false;
				};
			}, [props.taskId]);
			const addTrigger = async () => {
				if (data === null) return;
				let config;
				switch (newTriggerType) {
					case "once":
						config = {
							type: "once",
							at: newTriggerAt
						};
						break;
					case "hourly":
						config = {
							type: "hourly",
							minute: Number(newTriggerMinute)
						};
						break;
					case "daily":
						config = {
							type: "daily",
							time: newTriggerTime
						};
						break;
					case "weekday":
						config = {
							type: "weekday",
							weekdays: newWeekdays.split(",").map(Number),
							time: newTriggerTime
						};
						break;
					case "weekly":
						config = {
							type: "weekly",
							weekday: Number(newTriggerWeekday),
							time: newTriggerTime
						};
						break;
					case "monthly":
						config = {
							type: "monthly",
							day: Number(newTriggerDay),
							time: newTriggerTime
						};
						break;
					case "cron": config = {
						type: "cron",
						expr: newTriggerExpr
					};
				}
				if (editingTrigger) await api.updateTrigger(editingTrigger, { config: {
					...config,
					time_zone: newTimeZone
				} });
				else await api.addTrigger(data.task.id, {
					...config,
					time_zone: newTimeZone
				});
				setEditingTrigger(null);
				props.onChanged();
				const fresh = await api.getTask(props.taskId);
				setData({
					task: fresh.task,
					triggers: fresh.triggers,
					runs: fresh.runs
				});
			};
			const inputStyle = {
				padding: "5px 8px",
				border: "1px solid #d0d0d0",
				borderRadius: 6,
				fontSize: 13
			};
			return (0, react.createElement)("div", {
				style: {
					position: "fixed",
					inset: 0,
					background: "rgba(0,0,0,0.25)",
					zIndex: 1e3,
					display: "flex",
					justifyContent: "flex-end"
				},
				onClick: props.onClose
			}, (0, react.createElement)("div", {
				style: {
					width: 520,
					maxWidth: "94vw",
					background: "var(--dsw-alias-bg-layer-1,#fff)",
					height: "100%",
					overflowY: "auto",
					padding: 20,
					boxSizing: "border-box"
				},
				onClick: (e) => e.stopPropagation()
			}, error !== null && (0, react.createElement)("div", { style: { color: "#c0392b" } }, error), data === null && !error && (0, react.createElement)("div", { style: { color: "#999" } }, "加载中…"), data !== null && (0, react.createElement)("div", { style: {
				display: "flex",
				flexDirection: "column",
				gap: 14
			} }, (0, react.createElement)("div", null, (0, react.createElement)("div", { style: {
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between"
			} }, (0, react.createElement)("h2", { style: {
				fontSize: 16,
				margin: 0
			} }, data.task.name), (0, react.createElement)("button", {
				style: smallButtonStyle,
				onClick: props.onClose
			}, "关闭")), (0, react.createElement)("div", { style: {
				fontSize: 12,
				color: "var(--dsw-alias-label-secondary,#888)",
				marginTop: 4
			} }, `动作: ${actionLabel(data.task.action)} · 并发: ${data.task.concurrency ?? "skip"}`)), (0, react.createElement)("div", null, (0, react.createElement)("h3", { style: {
				fontSize: 13,
				margin: "0 0 8px"
			} }, `执行时间（${data.triggers.length}）`), (0, react.createElement)("div", { style: {
				display: "flex",
				flexDirection: "column",
				gap: 6
			} }, data.triggers.map((t) => (0, react.createElement)("div", {
				key: t.id,
				style: {
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					border: "1px solid #eee",
					borderRadius: 6,
					padding: "6px 10px"
				}
			}, (0, react.createElement)("button", {
				style: smallButtonStyle,
				onClick: () => {
					setEditingTrigger(t.id);
					setNewTriggerType(t.config.type);
					setNewTriggerTime(String(t.config.time ?? "09:00"));
					setNewTimeZone(String(t.config.time_zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone));
					setNewTriggerAt(String(t.config.at ?? ""));
					setNewTriggerMinute(String(t.config.minute ?? 0));
					setNewTriggerDay(String(t.config.day ?? 1));
					setNewTriggerWeekday(String(t.config.weekday ?? 1));
					setNewWeekdays((t.config.weekdays ?? [
						1,
						2,
						3,
						4,
						5
					]).join(","));
					setNewTriggerExpr(String(t.config.expr ?? "0 18 * * *"));
				}
			}, "编辑"), (0, react.createElement)("span", { style: { fontSize: 13 } }, `${triggerLabel(t.config)} · ${t.config.time_zone ?? "系统时区"} ${t.enabled ? "" : "（已停用）"}`), (0, react.createElement)("div", { style: {
				display: "flex",
				gap: 4
			} }, (0, react.createElement)("button", {
				style: {
					...smallButtonStyle,
					...dangerButtonStyle
				},
				onClick: () => {
					api.deleteTrigger(t.id).then(async () => {
						props.onChanged();
						const fresh = await api.getTask(props.taskId);
						setData({
							task: fresh.task,
							triggers: fresh.triggers,
							runs: fresh.runs
						});
					}).catch(alertError);
				}
			}, "删除")))), data.triggers.length === 0 && (0, react.createElement)("div", { style: {
				color: "#999",
				fontSize: 13
			} }, "还没有执行时间。")), (0, react.createElement)("div", { style: {
				marginTop: 10,
				borderTop: "1px dashed #e0e0e0",
				paddingTop: 10,
				display: "flex",
				gap: 8,
				flexWrap: "wrap",
				alignItems: "flex-end"
			} }, (0, react.createElement)("select", {
				style: inputStyle,
				value: newTriggerType,
				onChange: (e) => setNewTriggerType(e.target.value)
			}, (0, react.createElement)("option", { value: "daily" }, "每天"), (0, react.createElement)("option", { value: "hourly" }, "每小时"), (0, react.createElement)("option", { value: "weekly" }, "每周"), (0, react.createElement)("option", { value: "weekday" }, "指定星期"), (0, react.createElement)("option", { value: "monthly" }, "每月"), (0, react.createElement)("option", { value: "once" }, "仅一次"), (0, react.createElement)("option", { value: "cron" }, "Cron")), newTriggerType === "once" && (0, react.createElement)("input", {
				style: inputStyle,
				value: newTriggerAt,
				onChange: (e) => setNewTriggerAt(e.target.value),
				placeholder: "ISO 时刻"
			}), newTriggerType === "hourly" && (0, react.createElement)("input", {
				style: {
					...inputStyle,
					width: 70
				},
				value: newTriggerMinute,
				onChange: (e) => setNewTriggerMinute(e.target.value),
				placeholder: "分钟"
			}), (newTriggerType === "daily" || newTriggerType === "weekly" || newTriggerType === "monthly" || newTriggerType === "weekday") && (0, react.createElement)("input", {
				style: {
					...inputStyle,
					width: 110
				},
				type: "time",
				value: newTriggerTime,
				onChange: (e) => setNewTriggerTime(e.target.value)
			}), newTriggerType === "weekly" && (0, react.createElement)("select", {
				style: inputStyle,
				value: newTriggerWeekday,
				onChange: (e) => setNewTriggerWeekday(e.target.value)
			}, weekdays.map((w) => (0, react.createElement)("option", {
				key: w.value,
				value: String(w.value)
			}, w.label))), newTriggerType === "monthly" && (0, react.createElement)("input", {
				style: {
					...inputStyle,
					width: 70
				},
				value: newTriggerDay,
				onChange: (e) => setNewTriggerDay(e.target.value),
				placeholder: "日"
			}), newTriggerType === "cron" && (0, react.createElement)("input", {
				style: {
					...inputStyle,
					width: 180
				},
				value: newTriggerExpr,
				onChange: (e) => setNewTriggerExpr(e.target.value)
			}), (0, react.createElement)("input", {
				style: inputStyle,
				value: newTimeZone,
				onChange: (e) => setNewTimeZone(e.target.value),
				"aria-label": "执行时区"
			}), newTriggerType === "weekday" && (0, react.createElement)("input", {
				style: inputStyle,
				value: newWeekdays,
				onChange: (e) => setNewWeekdays(e.target.value),
				"aria-label": "星期编号"
			}), (0, react.createElement)("button", {
				style: smallButtonStyle,
				onClick: () => {
					addTrigger().catch(alertError);
				}
			}, editingTrigger ? "保存执行时间" : "添加"), editingTrigger && (0, react.createElement)("button", {
				style: smallButtonStyle,
				onClick: () => setEditingTrigger(null)
			}, "取消编辑"))), (0, react.createElement)("div", null, (0, react.createElement)("h3", { style: {
				fontSize: 13,
				margin: "0 0 8px"
			} }, "最近运行"), (0, react.createElement)("div", { style: {
				display: "flex",
				flexDirection: "column",
				gap: 4
			} }, data.runs.slice(0, 10).map((r) => (0, react.createElement)("div", {
				key: r.id,
				style: {
					display: "flex",
					justifyContent: "space-between",
					fontSize: 12,
					color: "var(--dsw-alias-label-secondary,#666)",
					borderBottom: "1px solid #f2f2f2",
					padding: "4px 0"
				}
			}, (0, react.createElement)("span", null, `${r.scheduled_at.replace("T", " ").slice(0, 16)}`), (0, react.createElement)("span", { style: { color: statusColor(r.status) } }, statusLabel(r.status)))), data.runs.length === 0 && (0, react.createElement)("div", { style: {
				color: "#999",
				fontSize: 13
			} }, "还没有运行记录。"))))));
		}
		function UpcomingTab(props) {
			const [items, setItems] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [runDetail, setRunDetail] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				let alive = true;
				setItems(null);
				api.listUpcoming().then((r) => {
					if (alive) setItems(r.upcoming);
				}).catch((e) => {
					if (alive) setError(e instanceof Error ? e.message : String(e));
				});
				return () => {
					alive = false;
				};
			}, [props.refreshKey]);
			return (0, react.createElement)("div", { style: {
				display: "flex",
				flexDirection: "column",
				gap: 8
			} }, error !== null && (0, react.createElement)("div", { style: {
				color: "#c0392b",
				fontSize: 13
			} }, error), (0, react.createElement)("div", { style: {
				display: "flex",
				flexDirection: "column",
				gap: 6
			} }, (items ?? []).map((item) => (0, react.createElement)("div", {
				key: `${item.run_id}`,
				style: {
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					border: "1px solid #eee",
					borderRadius: 6,
					padding: "8px 12px"
				}
			}, (0, react.createElement)("div", null, (0, react.createElement)("div", { style: {
				fontSize: 13,
				fontWeight: 600
			} }, item.task_name), (0, react.createElement)("div", { style: {
				fontSize: 12,
				color: "var(--dsw-alias-label-secondary,#888)"
			} }, `${item.trigger_label} · ${formatTime(item.scheduled_at)}`)), (0, react.createElement)("div", { style: {
				display: "flex",
				gap: 4
			} }, (0, react.createElement)("button", {
				style: smallButtonStyle,
				onClick: () => {
					api.runNow(item.task_id).then(props.onChanged).catch(alertError);
				}
			}, "立即运行"), !item.run_id.startsWith("upcoming_") && (0, react.createElement)("button", {
				style: {
					...smallButtonStyle,
					...dangerButtonStyle
				},
				onClick: () => {
					api.cancelRun(item.run_id).then(props.onChanged).catch(alertError);
				}
			}, "取消")))), items !== null && items.length === 0 && (0, react.createElement)("div", { style: {
				color: "#999",
				fontSize: 13,
				padding: 16,
				textAlign: "center"
			} }, "没有待运行的任务。"), items === null && error === null && (0, react.createElement)("div", { style: {
				color: "#999",
				fontSize: 13,
				padding: 16
			} }, "加载中…")), runDetail !== null && (0, react.createElement)(RunDetail, {
				runId: runDetail,
				onClose: () => setRunDetail(null)
			}));
		}
		function RunningTab(props) {
			const [items, setItems] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				let alive = true;
				setItems(null);
				api.listRunning().then((r) => {
					if (alive) setItems(r.running);
				}).catch((e) => {
					if (alive) setError(e instanceof Error ? e.message : String(e));
				});
				return () => {
					alive = false;
				};
			}, [props.refreshKey]);
			return (0, react.createElement)("div", { style: {
				display: "flex",
				flexDirection: "column",
				gap: 8
			} }, error !== null && (0, react.createElement)("div", { style: {
				color: "#c0392b",
				fontSize: 13
			} }, error), (0, react.createElement)("div", { style: {
				display: "flex",
				flexDirection: "column",
				gap: 6
			} }, (items ?? []).map((item) => (0, react.createElement)("div", {
				key: item.run_id,
				style: {
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					border: "1px solid #eee",
					borderRadius: 6,
					padding: "8px 12px"
				}
			}, (0, react.createElement)("div", null, (0, react.createElement)("div", { style: {
				fontSize: 13,
				fontWeight: 600
			} }, item.task_name), (0, react.createElement)("div", { style: {
				fontSize: 12,
				color: "var(--dsw-alias-label-secondary,#888)"
			} }, `已运行 ${Math.round(item.elapsed_ms / 1e3)}s · ${formatTime(item.started_at)} 开始`)), (0, react.createElement)("button", {
				style: {
					...smallButtonStyle,
					...dangerButtonStyle
				},
				onClick: () => {
					api.cancelRun(item.run_id).then(props.onChanged).catch(alertError);
				}
			}, "取消"))), items !== null && items.length === 0 && (0, react.createElement)("div", { style: {
				color: "#999",
				fontSize: 13,
				padding: 16,
				textAlign: "center"
			} }, "当前没有运行中的任务。"), items === null && error === null && (0, react.createElement)("div", { style: {
				color: "#999",
				fontSize: 13,
				padding: 16
			} }, "加载中…")));
		}
		function HistoryTab(props) {
			const [items, setItems] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [statusFilter, setStatusFilter] = (0, react.useState)("");
			const [runDetail, setRunDetail] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				let alive = true;
				setItems(null);
				api.listHistory(statusFilter !== "" ? { status: statusFilter } : void 0).then((r) => {
					if (alive) setItems(r.runs);
				}).catch((e) => {
					if (alive) setError(e instanceof Error ? e.message : String(e));
				});
				return () => {
					alive = false;
				};
			}, [props.refreshKey, statusFilter]);
			return (0, react.createElement)("div", { style: {
				display: "flex",
				flexDirection: "column",
				gap: 8
			} }, (0, react.createElement)("div", { style: {
				display: "flex",
				gap: 8,
				alignItems: "center"
			} }, (0, react.createElement)("label", { style: {
				fontSize: 13,
				color: "var(--dsw-alias-label-secondary,#666)"
			} }, "状态:"), (0, react.createElement)("select", {
				style: {
					padding: "4px 8px",
					border: "1px solid #d0d0d0",
					borderRadius: 6,
					fontSize: 13
				},
				value: statusFilter,
				onChange: (e) => setStatusFilter(e.target.value)
			}, (0, react.createElement)("option", { value: "" }, "全部"), [
				"success",
				"failed",
				"cancelled",
				"timeout",
				"skipped",
				"running",
				"pending"
			].map((s) => (0, react.createElement)("option", {
				key: s,
				value: s
			}, statusLabel(s))))), error !== null && (0, react.createElement)("div", { style: {
				color: "#c0392b",
				fontSize: 13
			} }, error), (0, react.createElement)("div", { style: {
				display: "flex",
				flexDirection: "column",
				gap: 4
			} }, (items ?? []).map((item) => (0, react.createElement)("div", {
				key: item.run_id,
				style: {
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					borderBottom: "1px solid #f2f2f2",
					padding: "6px 4px"
				}
			}, (0, react.createElement)("div", null, (0, react.createElement)("div", { style: {
				fontSize: 13,
				fontWeight: 600
			} }, item.task_name), (0, react.createElement)("div", { style: {
				fontSize: 12,
				color: "var(--dsw-alias-label-secondary,#888)"
			} }, `${formatTime(item.scheduled_at)}${item.duration_ms !== void 0 ? ` · ${Math.round(item.duration_ms / 1e3)}s` : ""}${item.error !== void 0 ? ` · ${item.error.slice(0, 40)}` : ""}`)), (0, react.createElement)("div", { style: {
				display: "flex",
				gap: 6,
				alignItems: "center"
			} }, (0, react.createElement)("span", { style: {
				fontSize: 12,
				color: statusColor(item.status),
				fontWeight: 600
			} }, statusLabel(item.status)), (0, react.createElement)("button", {
				style: smallButtonStyle,
				onClick: () => setRunDetail(item.run_id)
			}, "日志")))), items !== null && items.length === 0 && (0, react.createElement)("div", { style: {
				color: "#999",
				fontSize: 13,
				padding: 16,
				textAlign: "center"
			} }, "没有历史记录。"), items === null && error === null && (0, react.createElement)("div", { style: {
				color: "#999",
				fontSize: 13,
				padding: 16
			} }, "加载中…")), runDetail !== null && (0, react.createElement)(RunDetail, {
				runId: runDetail,
				onClose: () => setRunDetail(null)
			}));
		}
		function RunDetail(props) {
			const [data, setData] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				let alive = true;
				api.getRun(props.runId).then((r) => {
					if (alive) setData({
						run: r.run,
						logs: r.logs
					});
				}).catch((e) => {
					if (alive) setError(e instanceof Error ? e.message : String(e));
				});
				return () => {
					alive = false;
				};
			}, [props.runId]);
			return (0, react.createElement)("div", {
				style: {
					position: "fixed",
					inset: 0,
					background: "rgba(0,0,0,0.25)",
					zIndex: 1100,
					display: "flex",
					justifyContent: "flex-end"
				},
				onClick: props.onClose
			}, (0, react.createElement)("div", {
				style: {
					width: 560,
					maxWidth: "94vw",
					background: "var(--dsw-alias-bg-layer-1,#fff)",
					height: "100%",
					overflowY: "auto",
					padding: 20,
					boxSizing: "border-box"
				},
				onClick: (e) => e.stopPropagation()
			}, error !== null && (0, react.createElement)("div", { style: { color: "#c0392b" } }, error), data === null && !error && (0, react.createElement)("div", { style: { color: "#999" } }, "加载中…"), data !== null && (0, react.createElement)("div", { style: {
				display: "flex",
				flexDirection: "column",
				gap: 12
			} }, (0, react.createElement)("div", { style: {
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between"
			} }, (0, react.createElement)("div", null, (0, react.createElement)("h2", { style: {
				fontSize: 16,
				margin: 0
			} }, `运行 ${data.run.id.slice(0, 20)}…`), (0, react.createElement)("div", { style: {
				fontSize: 12,
				color: statusColor(data.run.status),
				fontWeight: 600
			} }, statusLabel(data.run.status))), (0, react.createElement)("button", {
				style: smallButtonStyle,
				onClick: props.onClose
			}, "关闭")), (0, react.createElement)("div", { style: {
				fontSize: 12,
				color: "var(--dsw-alias-label-secondary,#888)"
			} }, `计划: ${formatTime(data.run.scheduled_at)}`, data.run.started_at !== void 0 ? ` · 开始: ${formatTime(data.run.started_at)}` : "", data.run.finished_at !== void 0 ? ` · 结束: ${formatTime(data.run.finished_at)}` : "", data.run.exit_code !== void 0 ? ` · 退出码: ${data.run.exit_code}` : ""), data.run.error !== void 0 && (0, react.createElement)("div", { style: {
				fontSize: 13,
				color: "#c0392b",
				background: "#fdf0ef",
				borderRadius: 6,
				padding: 10
			} }, data.run.error), data.run.output !== void 0 && data.run.output !== "" && (0, react.createElement)("div", null, (0, react.createElement)("h3", { style: {
				fontSize: 13,
				margin: "0 0 6px"
			} }, "输出"), (0, react.createElement)("pre", { style: {
				fontSize: 12,
				background: "var(--dsw-alias-bg-layer-2,#f7f7f7)",
				borderRadius: 6,
				padding: 10,
				overflowX: "auto",
				maxHeight: 240,
				overflowY: "auto",
				whiteSpace: "pre-wrap",
				margin: 0
			} }, data.run.output)), (0, react.createElement)("div", null, (0, react.createElement)("h3", { style: {
				fontSize: 13,
				margin: "0 0 6px"
			} }, "执行日志"), data.logs.length === 0 ? (0, react.createElement)("div", { style: {
				color: "#999",
				fontSize: 13
			} }, "（无日志）") : (0, react.createElement)("pre", { style: {
				fontSize: 12,
				background: "var(--dsw-alias-bg-layer-2,#f7f7f7)",
				borderRadius: 6,
				padding: 10,
				overflowX: "auto",
				maxHeight: 320,
				overflowY: "auto",
				whiteSpace: "pre-wrap",
				margin: 0
			} }, data.logs.join("\n"))))));
		}
		const weekdays = [
			{
				value: 0,
				label: "周日"
			},
			{
				value: 1,
				label: "周一"
			},
			{
				value: 2,
				label: "周二"
			},
			{
				value: 3,
				label: "周三"
			},
			{
				value: 4,
				label: "周四"
			},
			{
				value: 5,
				label: "周五"
			},
			{
				value: 6,
				label: "周六"
			}
		];
		/** Action 的人类可读标签。 */
		function actionLabel(action) {
			switch (action.type) {
				case "skill": return `Skill: ${action.skill ?? ""}`;
				case "agent_prompt": return `Agent: ${action.agent ?? ""}`;
				case "command": return `命令: ${action.command ?? ""}`;
				case "script": return `脚本: ${action.path ?? ""}`;
				default: return action.type;
			}
		}
		/** Trigger 配置的人类可读标签。 */
		function triggerLabel(config) {
			const type = config.type;
			switch (type) {
				case "once": return `仅一次 · ${String(config.at ?? "")}`;
				case "hourly": return config.minute === 0 || config.minute === void 0 ? "每小时整点" : `每小时 :${String(config.minute).padStart(2, "0")}`;
				case "daily": return `每天 ${String(config.time ?? "")}`;
				case "weekday": return `每星期${(config.weekdays ?? []).map((w) => weekdays.find((x) => x.value === w)?.label ?? w).join("、")} ${String(config.time ?? "")}`;
				case "weekly": return `每星期${weekdays.find((x) => x.value === config.weekday)?.label ?? String(config.weekday)} ${String(config.time ?? "")}`;
				case "monthly": return `每月 ${String(config.day ?? "")} 日 ${String(config.time ?? "")}`;
				case "cron": return `Cron ${String(config.expr ?? "")}`;
				default: return type;
			}
		}
		/** 运行状态标签。 */
		function statusLabel(status) {
			switch (status) {
				case "pending": return "排队中";
				case "running": return "运行中";
				case "success": return "成功";
				case "failed": return "失败";
				case "cancelled": return "已取消";
				case "timeout": return "超时";
				case "skipped": return "已跳过";
				default: return status;
			}
		}
		/** 运行状态颜色。 */
		function statusColor(status) {
			switch (status) {
				case "running": return "#1a56db";
				case "success": return "#1e7d32";
				case "failed": return "#c0392b";
				case "cancelled": return "#888";
				case "timeout": return "#b26a00";
				case "skipped": return "#888";
				default: return "#555";
			}
		}
		/** 时间格式化。 */
		function formatTime(iso) {
			try {
				return new Date(iso).toLocaleString("zh-CN", { hour12: false });
			} catch {
				return iso;
			}
		}
		/** 每行一个参数；参数内空格和引号按原样传入。 */
		function splitArgs(text) {
			return text.split(/\r?\n/).filter((part) => part !== "");
		}
		/** 错误提示。 */
		function alertError(e) {
			window.alert(e instanceof Error ? e.message : String(e));
		}
		function parseEnvironment(text) {
			const result = {};
			for (const line of text.split(/\r?\n/)) {
				if (!line.trim()) continue;
				const separator = line.indexOf("=");
				const key = line.slice(0, separator).trim();
				if (separator < 1 || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw Error("环境变量请每行填写 NAME=值。");
				result[key] = line.slice(separator + 1);
			}
			return result;
		}
		// src/client/IntegratedTaskPage.tsx
		function IntegratedTaskPage({ navigation, official, officialProps }) {
			const state = (0, react.useSyncExternalStore)(navigation.subscribe, navigation.getSnapshot);
			const directVisited = (0, react.useRef)(state.kind === "direct");
			if (state.kind === "direct") directVisited.current = true;
			const showDirect = directVisited.current;
			return (0, react.createElement)("section", {
				className: "da-integrated",
				"data-automation-integrated": true,
				"aria-label": "自动化任务"
			}, (0, react.createElement)("div", { className: "da-integrated-top" }, (0, react.createElement)("div", { className: "da-integrated-actions" }, (0, react.createElement)("div", {
				role: "group",
				"aria-label": "任务类型",
				className: "da-kind-switch"
			}, (0, react.createElement)("button", {
				type: "button",
				"aria-pressed": state.kind === "session",
				onClick: () => navigation.select("session")
			}, "会话任务"), (0, react.createElement)("button", {
				type: "button",
				"aria-pressed": state.kind === "direct",
				onClick: () => navigation.select("direct")
			}, "直接任务")), (0, react.createElement)("button", {
				type: "button",
				className: "da-new-direct",
				onClick: () => navigation.create()
			}, "＋ 新建直接任务")), (0, react.createElement)("div", {
				className: "da-task-explanation",
				"data-task-explanation": true
			}, (0, react.createElement)("p", null, (0, react.createElement)("strong", null, "会话任务："), "到时间后让模型在原会话处理指令，可使用 Skill，适合总结和分析。"), (0, react.createElement)("p", null, (0, react.createElement)("strong", null, "直接任务："), "到时间后运行本机命令或脚本，不创建会话、不调用模型，适合确定性工作。"), (0, react.createElement)("p", { className: "da-task-note" }, "两类任务都需要 DSH 保持运行；直接执行不代表立即执行。脚本先保存为本地文件，再填写路径。"))), (0, react.createElement)("div", {
				className: "da-task-body",
				hidden: state.kind !== "session",
				"data-task-kind": "session"
			}, (0, react.createElement)(official, officialProps)), showDirect && (0, react.createElement)("div", {
				className: "da-task-body",
				hidden: state.kind !== "direct",
				"data-task-kind": "direct"
			}, (0, react.createElement)(AutomationPage, {
				embedded: true,
				createRequest: state.createRequest,
				onCreateConsumed: navigation.consumeCreate,
				registerLeaveGuard: navigation.registerLeaveGuard
			})));
		}
		// src/client/task-navigation.ts
		/** 客户端内存导航；请求只打开表单，绝不执行任务。 */
		function createTaskNavigation() {
			let snapshot = {
				kind: "session",
				createRequest: 0
			};
			let guard;
			let serial = 0;
			const listeners = /* @__PURE__ */ new Set();
			const publish = (next) => {
				snapshot = next;
				listeners.forEach((listener) => listener());
			};
			return {
				getSnapshot: () => snapshot,
				subscribe(listener) {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				registerLeaveGuard(next) {
					guard = next;
					return () => {
						if (guard === next) guard = void 0;
					};
				},
				consumeCreate(request) {
					if (request && snapshot.createRequest === request) publish({
						...snapshot,
						createRequest: 0
					});
				},
				select(kind) {
					if (snapshot.kind === kind) return true;
					if (guard && !guard()) return false;
					publish({
						...snapshot,
						kind
					});
					return true;
				},
				create() {
					if (guard && !guard()) return false;
					publish({
						kind: "direct",
						createRequest: ++serial
					});
					return true;
				}
			};
		}
		// src/client/integrated-registration.ts
		const OFFICIAL_TASK_PANEL = "schedules";
		/** 只使用公开注册表；保留原组件／注入／locale，卸载后原条目仍在。 */
		function registerIntegratedTasks(ctx, render) {
			ctx.slots.inject("main", () => {
				let current, dispose;
				const synchronize = () => {
					const entries = ctx.slots.entries("main").filter((entry) => entry.options.key === "schedules" && entry.locale === "schedule.manager" && entry.registrant !== "dsh-automation:integrated");
					const next = entries.length === 1 ? entries[0] : void 0;
					if (current === next) return;
					dispose?.();
					dispose = void 0;
					current = next;
					if (!next) return;
					dispose = ctx.slots.register({
						name: "main",
						key: OFFICIAL_TASK_PANEL,
						priority: -100,
						registrant: "dsh-automation:integrated",
						locale: next.locale,
						inject: next.inject
					}, (props) => render(next, props));
				};
				const unsubscribe = ctx.slots.subscribe("main", synchronize);
				synchronize();
				return () => {
					unsubscribe();
					dispose?.();
					current = void 0;
				};
			});
		}
		// src/client/settings-state.ts
		const emptyDraftState = () => ({
			owners: {},
			drafts: {},
			resets: {}
		});
		function receiveOwners(state, owners, saved) {
			const next = {
				owners: { ...state.owners },
				drafts: { ...state.drafts },
				resets: { ...state.resets }
			};
			for (const owner of owners) {
				if (saved && owner.owner !== saved) continue;
				if (state.drafts[owner.owner] && !saved) continue;
				next.owners[owner.owner] = owner;
				next.drafts[owner.owner] = { ...owner.effective };
				next.resets[owner.owner] = [];
			}
			return next;
		}
		function editDraft(state, owner, field, value, reset = false) {
			return {
				...state,
				drafts: {
					...state.drafts,
					[owner]: {
						...state.drafts[owner],
						[field]: value
					}
				},
				resets: {
					...state.resets,
					[owner]: [...(state.resets[owner] ?? []).filter((key) => key !== field), ...reset ? [field] : []]
				}
			};
		}
		function draftOperations(state, owner) {
			const snapshot = state.owners[owner], draft = state.drafts[owner] ?? {};
			return snapshot.fields.flatMap((field) => (state.resets[owner] ?? []).includes(field.path) ? [{
				op: "unset",
				path: field.path
			}] : JSON.stringify(draft[field.path]) !== JSON.stringify(snapshot.effective[field.path]) ? [{
				op: "set",
				path: field.path,
				value: draft[field.path]
			}] : []);
		}
		// src/client/SettingsSection.tsx
		const { Button, Tooltip, SegmentedTabs } = require("@deepseek-ai/dsh-client-ui-primitives");
		const ownerLabels = {
			"time-context": "时间感知",
			schedule: "任务调度",
			automation: "Automation 配置"
		};
		function SettingsSection({ onOpen }) {
			const [state, setState] = (0, react.useState)(emptyDraftState);
			const [tab, setTab] = (0, react.useState)("official");
			const [messages, setMessages] = (0, react.useState)({});
			const [saving, setSaving] = (0, react.useState)({});
			const [problem, setProblem] = (0, react.useState)("");
			(0, react.useEffect)(() => {
				let alive = true;
				api.settings().then((value) => {
					if (alive) {
						setState((previous) => receiveOwners(previous, value.owners));
						if (!value.compatibility?.matched) setProblem(value.compatibility?.reasons?.join("；") ?? "");
					}
				}).catch((error) => {
					if (alive) setProblem(error.message);
				});
				return () => {
					alive = false;
				};
			}, []);
			async function save(owner) {
				const snapshot = state.owners[owner];
				setSaving((previous) => ({
					...previous,
					[owner]: true
				}));
				setMessages((previous) => ({
					...previous,
					[owner]: "正在保存此分区…"
				}));
				try {
					const result = await api.saveSettings({
						owner,
						entryId: snapshot.entryId,
						expectedRevisionToken: snapshot.revisionToken,
						operations: draftOperations(state, owner)
					});
					setState((previous) => receiveOwners(previous, result.owners, owner));
					setMessages((previous) => ({
						...previous,
						[owner]: "已保存；" + snapshot.applies
					}));
				} catch (error) {
					setMessages((previous) => ({
						...previous,
						[owner]: error.message
					}));
				} finally {
					setSaving((previous) => ({
						...previous,
						[owner]: false
					}));
				}
			}
			const renderOwner = (owner) => {
				const snapshot = state.owners[owner];
				if (!snapshot) return (0, react.createElement)("p", { key: owner }, "正在读取" + ownerLabels[owner] + "…");
				return (0, react.createElement)("section", {
					key: owner,
					className: "da-settings-owner",
					"data-owner": owner
				}, (0, react.createElement)("h3", null, ownerLabels[owner]), !snapshot.writable && (0, react.createElement)("p", { role: "status" }, snapshot.unavailableReason ?? "配置所有者不可用，请启用对应插件。"), snapshot.fields.map((field) => {
					const value = state.drafts[owner]?.[field.path] ?? field.default;
					const id = "automation-setting-" + owner + "-" + field.path;
					const expression = value && typeof value === "object";
					return (0, react.createElement)("div", {
						key: field.path,
						className: "da-setting-row",
						"data-field": field.path
					}, (0, react.createElement)("label", { htmlFor: id }, field.label), (0, react.createElement)("div", { className: "da-setting-control" }, (0, react.createElement)("input", {
						id,
						type: field.type === "number" ? "number" : "text",
						value: expression ? "由组装表达式提供" : String(value),
						min: field.min,
						max: field.max,
						step: 1,
						disabled: !snapshot.writable || !!saving[owner] || !!expression,
						onChange: (event) => setState((previous) => editDraft(previous, owner, field.path, field.type === "number" ? Number(event.target.value) : event.target.value))
					}), (0, react.createElement)(Tooltip, {
						label: field.help,
						openOnClick: true,
						portal: true,
						maxWidth: 360
					}, (0, react.createElement)(Button, {
						type: "button",
						size: "small",
						"aria-label": field.label + "帮助"
					}, "ⓘ")), (0, react.createElement)(Button, {
						type: "button",
						size: "small",
						disabled: !snapshot.writable || !!saving[owner],
						"aria-label": "恢复继承：" + field.label,
						onClick: () => setState((previous) => editDraft(previous, owner, field.path, snapshot.base[field.path] ?? field.default, true))
					}, "↺")), (0, react.createElement)("small", null, expression ? "未编辑表达式将保留。" : Object.hasOwn(snapshot.user, field.path) ? "当前为用户覆盖" : "当前继承组装值或默认值"));
				}), (0, react.createElement)("div", { className: "da-settings-actions" }, (0, react.createElement)(Button, {
					type: "button",
					variant: "primary",
					disabled: !snapshot.writable || !!saving[owner],
					onClick: () => void save(owner)
				}, !!saving[owner] ? "保存中…" : "保存" + ownerLabels[owner]), (0, react.createElement)(Button, {
					type: "button",
					disabled: !!saving[owner],
					onClick: () => {
						if (window.confirm("放弃这个分区的未保存修改？")) api.settings().then((value) => setState((previous) => receiveOwners(previous, value.owners, owner))).catch((error) => setMessages((previous) => ({
							...previous,
							[owner]: error.message
						})));
					}
				}, "放弃修改")), (0, react.createElement)("p", {
					role: "status",
					"data-owner-message": owner
				}, messages[owner] ?? snapshot.applies));
			};
			return (0, react.createElement)("section", {
				className: "da-settings",
				"data-automation-settings": true
			}, (0, react.createElement)("h2", null, "Irving · 自动化增强"), (0, react.createElement)("p", null, "官方负责会话提醒；Automation 负责无会话的命令和脚本。两区分别保存。"), problem && (0, react.createElement)("p", { role: "alert" }, problem), (0, react.createElement)("div", { className: "da-settings-actions" }, (0, react.createElement)(Button, {
				type: "button",
				onClick: onOpen
			}, "直接执行任务")), (0, react.createElement)(SegmentedTabs, {
				label: "自动化配置分区",
				items: [{
					value: "official",
					label: "官方配置"
				}, {
					value: "automation",
					label: "Automation 配置"
				}],
				value: tab,
				onChange: setTab
			}), (0, react.createElement)("div", {
				hidden: tab !== "official",
				"data-settings-group": "official"
			}, renderOwner("time-context"), renderOwner("schedule")), (0, react.createElement)("div", {
				hidden: tab !== "automation",
				"data-settings-group": "automation"
			}, renderOwner("automation")), (0, react.createElement)(MigrationSection));
		}
		function MigrationSection() {
			const [preview, setPreview] = (0, react.useState)(null), [message, setMessage] = (0, react.useState)(""), [busy, setBusy] = (0, react.useState)(false);
			const [taskId, setTaskId] = (0, react.useState)(""), [sessionId, setSessionId] = (0, react.useState)("");
			const [replacements, setReplacements] = (0, react.useState)({});
			async function replaceRule(trigger) {
				try {
					await api.updateTrigger(trigger.id, {
						config: {
							type: "cron",
							expr: replacements[trigger.id] ?? "",
							time_zone: trigger.proposedTimeZone
						},
						enabled: true
					});
					await inspect();
				} catch (error) {
					setMessage(error.message);
				}
			}
			async function inspect() {
				try {
					setPreview(await api.migration());
					setMessage("只读预览；应用前会备份，恢复遇到后续修改会拒绝覆盖。");
				} catch (error) {
					setMessage(error.message);
				}
			}
			async function apply(operation, migration_id) {
				setBusy(true);
				try {
					setPreview(await api.mutateMigration({
						operation,
						migration_id,
						expectedRevisionToken: preview.revisionToken,
						...taskId && operation === "apply" ? {
							task_id: taskId,
							session_id: sessionId
						} : {}
					}));
					setMessage("操作完成。");
				} catch (error) {
					setMessage(error.message);
				} finally {
					setBusy(false);
				}
			}
			return (0, react.createElement)("section", {
				className: "da-settings-owner",
				"data-automation-migration": true
			}, (0, react.createElement)("h3", null, "旧任务迁移"), (0, react.createElement)(Button, {
				type: "button",
				disabled: busy,
				onClick: () => void inspect()
			}, "预览旧任务"), preview && (0, react.createElement)("div", null, (0, react.createElement)("p", null, "缺少时区的规则拟采用：" + preview.timeZone + "；运行中不能应用迁移。"), preview.tasks.map((task) => (0, react.createElement)("div", { key: task.id }, (0, react.createElement)("strong", null, task.name), (0, react.createElement)("p", null, task.type === "command" || task.type === "script" ? "直接任务：保留ID、启用状态和历史。" : "旧模型任务已暂停，迁移后使用官方原会话。"), (0, react.createElement)("pre", { className: "da-migration-rule" }, JSON.stringify(task.action, null, 2)), task.triggers.map((trigger) => (0, react.createElement)("div", { key: trigger.id }, (0, react.createElement)("pre", { className: "da-migration-rule" }, JSON.stringify(trigger.config, null, 2)), (0, react.createElement)("p", null, (trigger.issue ?? "规则可迁移") + " · 时区 " + trigger.proposedTimeZone), trigger.issue && (0, react.createElement)("div", null, (0, react.createElement)("label", null, "明确选择新的官方Cron规则（日期不存在时跳过） ", (0, react.createElement)("input", {
				value: replacements[trigger.id] ?? "",
				placeholder: "例如 0 9 1 * *",
				onChange: (event) => setReplacements((previous) => ({
					...previous,
					[trigger.id]: event.target.value
				}))
			})), (0, react.createElement)(Button, {
				type: "button",
				disabled: busy,
				onClick: () => void replaceRule(trigger)
			}, "保存并启用替代规则")))))), (0, react.createElement)("label", null, "迁移对象 ", (0, react.createElement)("select", {
				value: taskId,
				onChange: (event) => setTaskId(event.target.value)
			}, (0, react.createElement)("option", { value: "" }, "全部直接任务（只固定时区）"), preview.tasks.map((task) => (0, react.createElement)("option", {
				key: task.id,
				value: task.id
			}, task.name)))), (0, react.createElement)("label", null, " 目标原会话 ", (0, react.createElement)("select", {
				value: sessionId,
				onChange: (event) => setSessionId(event.target.value)
			}, (0, react.createElement)("option", { value: "" }, "模型任务迁移时选择"), preview.sessions.map((session) => (0, react.createElement)("option", {
				key: session.id,
				value: session.id
			}, session.label)))), preview.sessionError && (0, react.createElement)("p", { role: "alert" }, "会话列表不可用，模型任务迁移已禁用。"), (0, react.createElement)("div", { className: "da-settings-actions" }, (0, react.createElement)(Button, {
				type: "button",
				disabled: busy || preview.running,
				onClick: () => void apply("apply")
			}, "应用已预览的迁移")), preview.records.map((record) => (0, react.createElement)("div", { key: record.id }, (0, react.createElement)("span", null, record.id + " · " + record.state), [
				"applied",
				"failed",
				"recovery-required"
			].includes(record.state) && (0, react.createElement)(Button, {
				type: "button",
				disabled: busy,
				onClick: () => void apply("restore", record.id)
			}, "恢复迁移前数据")))), (0, react.createElement)("p", { role: "status" }, message));
		}
		// src/client/style.ts
		/**
		* dsh-automation — 注入的样式（唯一 `<style data-dsh-automation-style>`，类名带 `da-` 前缀）。
		*
		* 颜色全部取自 DSH 主题变量（dsh-client-ui-theme 的 --dsw-alias-*，带兜底值），
		* 与「新会话」「日程」等主界面保持一致。增强界面只影响自有da-类。
		*/
		const CSS = `
.da-task-body{position:relative}
.da-integrated{height:100%;min-height:0;min-width:0;display:flex;flex-direction:column;color:var(--dsw-alias-label-primary,#1f2328);background:var(--dsw-alias-bg-base,#f7f8fa)}.da-integrated [hidden]{display:none!important}.da-integrated-top{flex:none;width:100%;max-width:1056px;box-sizing:border-box;margin:0 auto;padding:20px clamp(16px,4vw,48px) 12px}.da-integrated-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.da-kind-switch{display:flex;gap:6px;flex-wrap:wrap}.da-kind-switch button,.da-new-direct{cursor:pointer;font:inherit;border:1px solid var(--dsw-alias-border-l2,#ddd);border-radius:16px;padding:6px 12px;background:var(--dsw-alias-bg-layer-1,#fff);color:inherit}.da-kind-switch button[aria-pressed=true]{background:var(--dsw-alias-interactive-bg-hover,#e9edf3);font-weight:600}.da-new-direct{background:var(--dsw-alias-label-primary,#1f2328);color:var(--dsw-alias-bg-base,#fff);white-space:nowrap}.da-task-explanation{margin-top:12px;border-radius:10px;background:var(--dsw-alias-bg-layer-1,#fff);padding:10px 14px;font-size:12px;line-height:1.65;color:var(--dsw-alias-label-secondary,#57606a)}.da-task-explanation p{margin:2px 0;overflow-wrap:anywhere}.da-task-note{color:var(--dsw-alias-label-tertiary,#888)}.da-task-body{flex:1;min-height:0;min-width:0;overflow:hidden}.da-task-body>.da-root{height:100%}.da-kind-switch button:focus-visible,.da-new-direct:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#2f6fed);outline-offset:2px}.da-root [hidden]{display:none!important}@media(max-width:640px){.da-integrated-top{padding-top:12px}.da-integrated-actions{gap:8px}.da-task-explanation{padding:8px 10px}.da-kind-switch button,.da-new-direct{font-size:12px}}
.da-settings{color:var(--dsw-alias-label-primary,#1f2328);font-size:14px;min-width:0;padding:16px 0;box-sizing:border-box}.da-settings *{box-sizing:border-box}.da-settings-owner{border:1px solid var(--dsw-alias-border-l2,#ddd);border-radius:12px;padding:16px;margin:16px 0;background:var(--dsw-alias-bg-layer-1,#fff)}.da-settings h2,.da-settings h3{margin:0 0 12px}.da-setting-row{display:grid;grid-template-columns:minmax(150px,1fr) minmax(160px,2fr);gap:8px 16px;margin:14px 0;align-items:center}.da-setting-control{display:flex;gap:8px;align-items:center;min-width:0}.da-setting-control input{width:100%;min-width:0;height:36px;border:1px solid var(--dsw-alias-border-l2,#ddd);border-radius:8px;background:var(--dsw-alias-bg-layer-2,#fafafa);color:inherit;padding:6px 10px}.da-setting-row small{grid-column:2;color:var(--dsw-alias-label-secondary,#666)}.da-settings-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.da-settings [hidden]{display:none!important}.da-migration-rule{white-space:pre-wrap;overflow-wrap:anywhere;max-width:100%;font-size:12px}.da-settings select{max-width:100%;background:var(--dsw-alias-bg-layer-1,#fff);color:inherit}.da-root input:not([type=checkbox]),.da-root select,.da-root textarea{color:var(--da-text);background:var(--da-card-2)}.da-root button{color:var(--da-text)}@media(max-width:640px){.da-setting-row{grid-template-columns:1fr}.da-setting-row small{grid-column:1}.da-root button{white-space:normal}.da-root [data-task-actions]{flex-wrap:wrap}}

.da-root{--da-border:var(--dsw-alias-border-l2,#e5e7eb);--da-border-strong:var(--dsw-alias-border-l3,#d0d3d9);--da-text:var(--dsw-alias-label-primary,#1f2328);--da-text-dim:var(--dsw-alias-label-secondary,#57606a);--da-text-faint:var(--dsw-alias-label-tertiary,#8b949e);--da-accent:var(--dsw-alias-brand-primary,#2f6fed);--da-bg:var(--dsw-alias-bg-base,#f7f8fa);--da-card:var(--dsw-alias-bg-layer-1,#ffffff);--da-card-2:var(--dsw-alias-bg-layer-2,#f2f3f5);--da-hover:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05));--da-ok:var(--dsw-alias-state-success-primary,#2e7d32);--da-err:var(--dsw-alias-state-error-primary,#c62828);--da-warn:var(--dsw-alias-state-warn-primary,#b26a00);
display:flex;flex-direction:column;height:100%;min-height:0;background:var(--da-bg);color:var(--da-text);font-size:14px;line-height:1.5;overflow-wrap:anywhere;overflow:auto;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;}
.da-root *{box-sizing:border-box;}
.da-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 16px;border-bottom:1px solid var(--da-border-strong);background:var(--da-card);flex:none;}
.da-header h1{font-size:15px;font-weight:600;margin:0;letter-spacing:.2px;}
.da-header-sub{font-size:12px;color:var(--da-text-dim);margin-top:2px;}
.da-tabs{display:flex;gap:8px;border-bottom:1px solid var(--da-border);padding:0 16px;flex:none;}
.da-tabs button{border:0;background:transparent;color:var(--da-text-dim);padding:8px 14px;border-radius:6px 6px 0 0;cursor:pointer;font-size:13px;border-bottom:2px solid transparent;}
.da-tabs button:hover{background:var(--da-hover);}
.da-tabs button.da-active{color:var(--da-accent);font-weight:600;border-bottom-color:var(--da-accent);}
.da-main{flex:1;min-height:0;overflow:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px;}
.da-btn{border:1px solid var(--da-border);background:var(--da-card);color:var(--da-text);padding:4px 12px;border-radius:6px;cursor:pointer;font-size:13px;}
.da-btn:hover{background:var(--da-hover);}
.da-btn.da-primary{background:var(--da-accent);border-color:var(--da-accent);color:#fff;}
.da-btn.da-primary:hover{filter:brightness(1.05);}
.da-btn.da-danger{color:var(--da-err);border-color:color-mix(in srgb,var(--da-err) 40%,transparent);}
.da-btn:disabled{opacity:.5;cursor:default;}
.da-btn-sm{padding:2px 8px;font-size:12px;}
.da-card{background:var(--da-card);border:1px solid var(--da-border);border-radius:10px;padding:10px 14px;}
.da-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.da-card-title{font-weight:600;font-size:14px;display:flex;align-items:center;gap:8px;min-width:0;}
.da-card-sub{font-size:12px;color:var(--da-text-dim);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.da-dim{color:var(--da-text-dim);font-size:12px;}
.da-empty{color:var(--da-text-dim);text-align:center;padding:24px 8px;font-size:13px;}
.da-badge{display:inline-flex;align-items:center;border-radius:10px;padding:1px 8px;font-size:11px;line-height:18px;flex:none;}
.da-badge.da-on{background:color-mix(in srgb,var(--da-ok) 12%,transparent);color:var(--da-ok);}
.da-badge.da-off{background:var(--da-hover);color:var(--da-text-dim);}
.da-tag{font-size:11px;padding:1px 8px;border-radius:10px;background:color-mix(in srgb,var(--da-accent) 10%,transparent);color:var(--da-accent);flex:none;}
.da-filter{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.da-input,.da-select{border:1px solid var(--da-border);border-radius:6px;padding:4px 8px;font-size:13px;background:var(--da-card);color:var(--da-text);}
.da-input:focus,.da-select:focus{outline:2px solid color-mix(in srgb,var(--da-accent) 35%,transparent);outline-offset:-1px;}
.da-run{display:flex;align-items:center;justify-content:space-between;gap:8px;border-bottom:1px solid var(--da-border);padding:6px 4px;}
.da-run:last-child{border-bottom:0;}
.da-status{font-size:12px;font-weight:600;}
.da-status.da-s-running{color:var(--da-accent);}
.da-status.da-s-success{color:var(--da-ok);}
.da-status.da-s-failed{color:var(--da-err);}
.da-status.da-s-cancelled,.da-status.da-s-skipped{color:var(--da-text-dim);}
.da-status.da-s-timeout{color:var(--da-warn);}
.da-modal{position:fixed;inset:0;background:var(--dsw-alias-bg-mask-2,rgba(0,0,0,.4));display:flex;justify-content:flex-end;z-index:1000;}
.da-modal-card{background:var(--da-card);height:100%;width:460px;max-width:94vw;overflow:auto;padding:18px 20px;box-sizing:border-box;box-shadow:-8px 0 32px rgba(0,0,0,.12);}
.da-modal-card h2{margin:0 0 14px;font-size:15px;}
.da-form{display:flex;flex-direction:column;gap:12px;}
.da-field{display:flex;flex-direction:column;gap:4px;}
.da-field>label{font-size:12px;color:var(--da-text-dim);}
.da-inline{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.da-log{font-size:12px;background:var(--da-card-2);border-radius:8px;padding:10px;overflow:auto;max-height:300px;white-space:pre-wrap;margin:0;color:var(--da-text);}


`;
		let injected = false;
		function injectStyle() {
			if (injected) return;
			const style = document.createElement("style");
			style.setAttribute("data-dsh-automation-style", "");
			style.textContent = CSS;
			document.head.appendChild(style);
			injected = true;
		}
		function removeStyle() {
			document.head.querySelectorAll("[data-dsh-automation-style]").forEach((node) => node.remove());
			injected = false;
		}
		// src/client/index.ts
		const AUTOMATION_PANEL = "automation";
		const inject = ["slots", "layout"];
		function apply(raw) {
			const ctx = raw;
			injectStyle();
			const navigation = createTaskNavigation();
			const openDirect = () => {
				if (navigation.select("direct")) ctx.layout.selectPanel(OFFICIAL_TASK_PANEL);
			};
			registerIntegratedTasks(ctx, (entry, props) => (0, react.createElement)(IntegratedTaskPage, {
				navigation,
				official: entry.component,
				officialProps: props
			}));
			function LegacyDirectPanel() {
				(0, react.useEffect)(openDirect, []);
				return null;
			}
			ctx.slots.inject("main", () => ctx.slots.register({
				name: "main",
				key: AUTOMATION_PANEL
			}, LegacyDirectPanel));
			ctx.slots.inject("plugins.detail.section", () => ctx.slots.register({
				name: "plugins.detail.section",
				id: "automation-settings",
				order: 50
			}, (props) => props.subject?.kind === "bundle" && props.subject.pkg.name === "dsh-automation" ? (0, react.createElement)(SettingsSection, { onOpen: openDirect }) : null));
			ctx.effect(() => () => removeStyle(), "automation: styles");
		}
		exports.AUTOMATION_PANEL = AUTOMATION_PANEL;
		exports.AUTOMATION_PANEL_ID = AUTOMATION_PANEL;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
