const defaultUser = {
    email: "user@schedule.com",
    password: "12345678",
    firstName: "User",
    lastName: "Account"
};

const storedUser = JSON.parse(localStorage.getItem("user"));
const user = storedUser || defaultUser;
let activeUser = null;
const SCHEDULE_RETENTION_DAYS = 365;

if (!storedUser) {
    localStorage.setItem("user", JSON.stringify(defaultUser));
}

function goToSignup() {
    window.location.href = "signup.html";
}

function goToLogin() {
    window.location.href = "index.html";
}

function setMessage(elementId, message, isError = true) {
    const messageElement = document.getElementById(elementId);
    if (!messageElement) {
        return;
    }

    messageElement.textContent = message;
    messageElement.classList.toggle("error", isError);
    messageElement.classList.toggle("success", !isError);
}

function signup() {
    const firstName = document.getElementById("firstName").value.trim();
    const lastName = document.getElementById("lastName").value.trim();
    const email = document.getElementById("signupEmail").value.trim().toLowerCase();
    const password = document.getElementById("signupPassword").value;

    if (!firstName || !lastName || !email || !password) {
        setMessage("signupMessage", "Please fill in all fields.");
        return;
    }

    if (password.length < 8) {
        setMessage("signupMessage", "Password must be at least 8 characters.");
        return;
    }

    const newUser = { firstName, lastName, email, password };
    localStorage.setItem("user", JSON.stringify(newUser));
    setMessage("signupMessage", "Account created. Redirecting to login...", false);

    window.setTimeout(() => {
        window.location.href = "index.html";
    }, 800);
}

function login() {
    const email = document.getElementById("loginEmail").value.trim().toLowerCase();
    const password = document.getElementById("loginPassword").value;

    if (!email || !password) {
        setMessage("loginMessage", "Enter your email and password.");
        return;
    }

    if (email === user.email && password === user.password) {
        localStorage.setItem("loggedInUser", JSON.stringify(user));
        window.location.href = "dashboard.html";
        return;
    }

    setMessage("loginMessage", "Incorrect email or password.");
}

function logout() {
    localStorage.removeItem("loggedInUser");
    window.location.href = "index.html";
}

function bindForms() {
    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");

    if (loginForm) {
        loginForm.addEventListener("submit", (event) => {
            event.preventDefault();
            login();
        });
    }

    if (signupForm) {
        signupForm.addEventListener("submit", (event) => {
            event.preventDefault();
            signup();
        });
    }
}

function initHomePage() {
    if (!window.location.pathname.includes("dashboard.html")) {
        return;
    }

    const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
    if (!currentUser) {
        window.location.href = "index.html";
        return;
    }

    activeUser = currentUser;
    document.getElementById("welcomeText").innerText = `Welcome, ${currentUser.firstName}`;
    document.getElementById("userDetails").innerText = `${currentUser.firstName} ${currentUser.lastName} | ${currentUser.email}`;
    document.getElementById("todayLabel").innerText = formatTodayLabel();
    ensureScheduleRetention();
    bindTaskForm();
    renderSchedule();
    renderHistory();
}

function getTodayKey() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatTodayLabel() {
    return new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    });
}

function getScheduleStorageKey() {
    const emailKey = activeUser?.email || user.email;
    return `scheduleItems:${emailKey}`;
}

function parseStoredSchedule() {
    const storedSchedule = JSON.parse(localStorage.getItem(getScheduleStorageKey()));

    if (!storedSchedule) {
        return {};
    }

    if (storedSchedule.entries) {
        return storedSchedule;
    }

    // Migrate older plain-object schedule data into the retained format.
    return {
        retentionDays: SCHEDULE_RETENTION_DAYS,
        entries: storedSchedule
    };
}

function readSchedule() {
    const storedSchedule = parseStoredSchedule();
    return storedSchedule.entries || {};
}

function writeSchedule(scheduleData) {
    localStorage.setItem(getScheduleStorageKey(), JSON.stringify({
        retentionDays: SCHEDULE_RETENTION_DAYS,
        entries: scheduleData
    }));
}

function pruneExpiredScheduleEntries(scheduleData) {
    const cutoffDate = new Date();
    cutoffDate.setHours(0, 0, 0, 0);
    cutoffDate.setDate(cutoffDate.getDate() - SCHEDULE_RETENTION_DAYS);

    const filteredEntries = {};

    Object.entries(scheduleData).forEach(([dateKey, tasks]) => {
        const entryDate = new Date(`${dateKey}T00:00:00`);
        if (!Number.isNaN(entryDate.getTime()) && entryDate >= cutoffDate) {
            filteredEntries[dateKey] = tasks;
        }
    });

    return filteredEntries;
}

function ensureScheduleRetention() {
    const currentEntries = readSchedule();
    const prunedEntries = pruneExpiredScheduleEntries(currentEntries);
    writeSchedule(prunedEntries);
}

function getTodayTasks() {
    const scheduleData = readSchedule();
    return scheduleData[getTodayKey()] || [];
}

function bindTaskForm() {
    const taskForm = document.getElementById("taskForm");
    if (!taskForm) {
        return;
    }

    taskForm.addEventListener("submit", (event) => {
        event.preventDefault();
        addTask();
    });
}

function addTask() {
    const titleInput = document.getElementById("taskTitle");
    const timeInput = document.getElementById("taskTime");
    const notesInput = document.getElementById("taskNotes");

    const title = titleInput.value.trim();
    const time = timeInput.value;
    const notes = notesInput.value.trim();

    if (!title || !time) {
        setMessage("taskMessage", "Enter a task name and time.");
        return;
    }

    const scheduleData = readSchedule();
    const todayKey = getTodayKey();
    const tasks = scheduleData[todayKey] || [];

    tasks.push({
        id: Date.now(),
        title,
        time,
        notes,
        status: "pending"
    });

    tasks.sort((firstTask, secondTask) => firstTask.time.localeCompare(secondTask.time));
    scheduleData[todayKey] = tasks;
    writeSchedule(scheduleData);

    titleInput.value = "";
    timeInput.value = "";
    notesInput.value = "";
    setMessage("taskMessage", "Task added to today's schedule.", false);
    renderSchedule();
    renderHistory();
}

function updateTaskStatus(taskId, status) {
    const scheduleData = readSchedule();
    const todayKey = getTodayKey();
    const tasks = scheduleData[todayKey] || [];

    scheduleData[todayKey] = tasks.map((task) => {
        if (task.id === taskId) {
            return { ...task, status };
        }

        return task;
    });

    writeSchedule(scheduleData);
    renderSchedule();
    renderHistory();
}

function renderSchedule() {
    const scheduleList = document.getElementById("scheduleList");
    if (!scheduleList) {
        return;
    }

    const tasks = getTodayTasks();
    renderProgress(tasks);

    if (!tasks.length) {
        scheduleList.innerHTML = `
            <div class="empty-state">
                <h3>No tasks yet</h3>
                <p>Add your first plan for today to start tracking it.</p>
            </div>
        `;
        return;
    }

    scheduleList.innerHTML = tasks.map((task) => `
        <article class="schedule-item status-${task.status}">
            <div class="schedule-meta">
                <p class="task-time">${formatTaskTime(task.time)}</p>
                <div>
                    <h3>${escapeHtml(task.title)}</h3>
                    <p class="task-notes">${task.notes ? escapeHtml(task.notes) : "No extra notes."}</p>
                </div>
            </div>
            <div class="task-actions">
                <span class="task-status">${formatStatus(task.status)}</span>
                <div class="task-buttons">
                    <button type="button" class="status-button done-button" onclick="updateTaskStatus(${task.id}, 'done')">Done</button>
                    <button type="button" class="status-button missed-button" onclick="updateTaskStatus(${task.id}, 'missed')">X</button>
                </div>
            </div>
        </article>
    `).join("");
}

function renderProgress(tasks) {
    const progressBar = document.getElementById("progressBar");
    const progressSummary = document.getElementById("progressSummary");
    const productivityBadge = document.getElementById("productivityBadge");
    const doneCount = document.getElementById("doneCount");
    const missedCount = document.getElementById("missedCount");
    const pendingCount = document.getElementById("pendingCount");
    const progressPercent = document.getElementById("progressPercent");

    if (!progressBar || !progressSummary || !productivityBadge) {
        return;
    }

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((task) => task.status === "done").length;
    const missedTasks = tasks.filter((task) => task.status === "missed").length;
    const remainingTasks = tasks.filter((task) => task.status === "pending").length;
    const completionRate = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const productive = totalTasks > 0 && completionRate >= 60;

    progressBar.style.width = `${completionRate}%`;
    progressBar.className = `progress-bar ${productive ? "productive-bar" : "needs-work-bar"}`;

    doneCount.textContent = completedTasks;
    missedCount.textContent = missedTasks;
    pendingCount.textContent = remainingTasks;
    progressPercent.textContent = `${completionRate}%`;

    if (!totalTasks) {
        progressSummary.textContent = "Add tasks to see your progress for today.";
        productivityBadge.textContent = "Waiting for tasks";
        productivityBadge.className = "productivity-badge neutral";
        return;
    }

    progressSummary.textContent = productive
        ? `You completed ${completedTasks} of ${totalTasks} tasks. This looks like a productive day.`
        : `You completed ${completedTasks} of ${totalTasks} tasks. Finish around 60% to count the day as productive.`;

    productivityBadge.textContent = productive ? "Productive day" : "Needs more focus";
    productivityBadge.className = `productivity-badge ${productive ? "productive" : "not-productive"}`;
}

function renderHistory() {
    const historyList = document.getElementById("historyList");
    if (!historyList) {
        return;
    }

    const scheduleData = readSchedule();
    const dateGroups = Object.keys(scheduleData)
        .sort((firstDate, secondDate) => secondDate.localeCompare(firstDate));

    const previousDates = dateGroups.filter((dateKey) => dateKey !== getTodayKey());

    if (!previousDates.length) {
        historyList.innerHTML = `
            <div class="empty-state">
                <h3>No history yet</h3>
                <p>Completed days will appear here and remain saved for at least one year.</p>
            </div>
        `;
        return;
    }

    historyList.innerHTML = previousDates.map((dateKey) => {
        const tasks = scheduleData[dateKey]
            .slice()
            .sort((firstTask, secondTask) => firstTask.time.localeCompare(secondTask.time));

        return `
            <section class="history-group">
                <div class="history-heading">
                    <h3>${formatHistoryDate(dateKey)}</h3>
                    <span class="history-count">${tasks.length} item${tasks.length === 1 ? "" : "s"}</span>
                </div>
                <div class="history-items">
                    ${tasks.map((task) => `
                        <article class="schedule-item history-item status-${task.status}">
                            <div class="schedule-meta">
                                <p class="task-time">${formatTaskTime(task.time)}</p>
                                <div>
                                    <h3>${escapeHtml(task.title)}</h3>
                                    <p class="task-notes">${task.notes ? escapeHtml(task.notes) : "No extra notes."}</p>
                                </div>
                            </div>
                            <div class="task-actions">
                                <span class="task-status">${formatStatus(task.status)}</span>
                            </div>
                        </article>
                    `).join("")}
                </div>
            </section>
        `;
    }).join("");
}

function formatTaskTime(time) {
    const [hours, minutes] = time.split(":");
    const date = new Date();
    date.setHours(Number(hours), Number(minutes), 0, 0);

    return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit"
    });
}

function formatStatus(status) {
    if (status === "done") {
        return "Completed";
    }

    if (status === "missed") {
        return "Not done";
    }

    return "Pending";
}

function formatHistoryDate(dateKey) {
    const date = new Date(`${dateKey}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
        return dateKey;
    }

    return date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    });
}

function escapeHtml(value) {
    const div = document.createElement("div");
    div.innerText = value;
    return div.innerHTML;
}

bindForms();
ensureScheduleRetention();
initHomePage();
